/**
 * v3.8.773 - Dropshot: the login is finished but the app waits 6 minutes and says "6분 내 로그인 미완료"
 *
 * Live evidence (F:\work\orbit-release\ds_watch.log, same profile and launch style as the app, 2026-11-12):
 *   14:01:50 Google sign-in finished
 *   14:01:52 session cookies = 2 (long), session API 200 with user - but the tab stayed on https://stock.dropshot.io/ko/logIn
 *   (the site does not redirect to the board by itself; goto(board) then took >45 s once and the board was up 6 s later)
 * The old loop only checked tabs already on the board (`if (!isDropshotBoardUrl(...)) continue;`) so it never saw the login.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';
import { classifyDropshotSessionResponse } from '../src/core/dropshotGenerator';
import {
  createDropshotLoginWatcher,
  isDropshotSessionCookie,
  probeDropshotContextSession,
} from '../src/core/dropshotLoginWatch';

const BOARD = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const LOGIN = 'https://stock.dropshot.io/ko/logIn';
const SESSION_API = 'https://aistudio.dropshot.io/api/auth/session';
const USER_BODY = JSON.stringify({ user: { id: 'u1', name: '박성현' } });
const SESSION_COOKIES = [
  { domain: '.dropshot.io', name: 'ds.session-token.0', value: 'a'.repeat(150) },
  { domain: '.dropshot.io', name: 'ds.session-token.1', value: 'b'.repeat(150) },
];

type FakePage = { url: () => string; goto: jest.Mock; state: { url: string } };
function fakePage(url: string, onGoto?: (page: FakePage, target: string) => void): FakePage {
  const state = { url };
  const page: FakePage = {
    state,
    url: () => state.url,
    goto: jest.fn(async (target: string) => {
      if (onGoto) { onGoto(page, target); return; }
      state.url = target;
    }),
  };
  return page;
}

function fakeContext(pages: FakePage[], opts: { cookies?: any[]; session?: () => { status: number; text: string } | Error } = {}) {
  const reply = opts.session ?? (() => ({ status: 200, text: 'null' }));
  const ctx: any = {
    pages: () => pages,
    cookies: async () => opts.cookies ?? [],
    newPage: jest.fn(async () => { const page = fakePage('about:blank'); pages.push(page); return page; }),
    request: {
      get: jest.fn(async () => {
        const r = reply();
        if (r instanceof Error) throw r;
        return { status: () => r.status, text: async () => r.text };
      }),
    },
  };
  return ctx;
}

function watcherFor(ctx: any, nowRef: { t: number } = { t: 0 }) {
  return createDropshotLoginWatcher(ctx, {
    boardUrl: BOARD,
    isBoardUrl: (url) => /aistudio\.dropshot\.io\/ko\/workspace\/board/i.test(url),
    isLoginUrl: (url) => /stock\.dropshot\.io\/ko\/login/i.test(url),
    // In-page fetch on a tab that is on the board: answers like the site does for the current session state.
    probeBoardPage: async () => classifyDropshotSessionResponse(200, ctx.__boardBody ?? USER_BODY),
    probeContextSession: (c) => probeDropshotContextSession(c, SESSION_API, classifyDropshotSessionResponse),
    now: () => nowRef.t,
  });
}

describe('isDropshotSessionCookie', () => {
  test('long ds.session-token.* on a dropshot domain only', () => {
    expect(isDropshotSessionCookie(SESSION_COOKIES[0])).toBe(true);
    expect(isDropshotSessionCookie({ ...SESSION_COOKIES[0], value: 'short' })).toBe(false);
    expect(isDropshotSessionCookie({ ...SESSION_COOKIES[0], domain: '.example.com' })).toBe(false);
    expect(isDropshotSessionCookie({ ...SESSION_COOKIES[0], name: 'other' })).toBe(false);
  });
});

describe('login watcher - the measured case (tab stays on the login address)', () => {
  test('session cookie + session API user -> the app opens the board itself and reports the login', async () => {
    const login = fakePage(LOGIN);
    const ctx = fakeContext([login], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    const result = await watcherFor(ctx).tick();
    expect(login.goto).toHaveBeenCalledTimes(1);
    expect(login.goto.mock.calls[0]![0]).toBe(BOARD);
    expect(result).toMatchObject({ done: true, name: '박성현' });
  });

  test('a slow board navigation (goto times out) is not a failure - the address and session decide', async () => {
    const login = fakePage(LOGIN, (page, target) => { page.state.url = target; throw new Error('page.goto: Timeout 45000ms exceeded.'); });
    const ctx = fakeContext([login], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    await expect(watcherFor(ctx).tick()).resolves.toMatchObject({ done: true });
  });

  test('goto times out and the board is not up yet -> not done now, retried only after the wait', async () => {
    const login = fakePage(LOGIN, () => { throw new Error('Timeout 45000ms exceeded.'); });
    const ctx = fakeContext([login], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    const nowRef = { t: 1_000 };
    const watcher = watcherFor(ctx, nowRef);
    await expect(watcher.tick()).resolves.toEqual({ done: false });
    nowRef.t += 5_000;
    await watcher.tick();
    expect(login.goto).toHaveBeenCalledTimes(1);
    nowRef.t += 20_000;
    await watcher.tick();
    expect(login.goto).toHaveBeenCalledTimes(2);
  });

  test('a tab that left the login address for another Dropshot page is a hint too', async () => {
    const tab = fakePage('https://aistudio.dropshot.io/ko');
    const ctx = fakeContext([tab], { cookies: [], session: () => ({ status: 200, text: USER_BODY }) });
    await expect(watcherFor(ctx).tick()).resolves.toMatchObject({ done: true });
    expect(tab.goto).toHaveBeenCalledWith(BOARD, expect.anything());
  });

  test('cookie present but the session API cannot be read (network) -> the cookie is enough to open the board', async () => {
    const login = fakePage(LOGIN);
    const ctx = fakeContext([login], { cookies: SESSION_COOKIES, session: () => new Error('net::ERR_FAILED') });
    await watcherFor(ctx).tick();
    expect(login.goto).toHaveBeenCalledTimes(1);
  });
});

describe('login watcher - does not disturb a login that is still going on', () => {
  test('nobody signed in (200 + null) -> the login tab is left alone', async () => {
    const login = fakePage(LOGIN);
    const ctx = fakeContext([login], { cookies: [], session: () => ({ status: 200, text: 'null' }) });
    const watcher = watcherFor(ctx);
    for (let i = 0; i < 12; i += 1) await expect(watcher.tick()).resolves.toEqual({ done: false });
    expect(login.goto).not.toHaveBeenCalled();
  });

  test('a stale session cookie with "nobody signed in" does not move the tab', async () => {
    const login = fakePage(LOGIN);
    const ctx = fakeContext([login], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: 'null' }) });
    await expect(watcherFor(ctx).tick()).resolves.toEqual({ done: false });
    expect(login.goto).not.toHaveBeenCalled();
  });

  test('Google / Kakao sign-in tabs are never navigated; the login tab is', async () => {
    const google = fakePage('https://accounts.google.com/v3/signin/challenge/pwd');
    const login = fakePage(LOGIN);
    const ctx = fakeContext([google, login], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    await watcherFor(ctx).tick();
    expect(google.goto).not.toHaveBeenCalled();
    expect(login.goto).toHaveBeenCalledWith(BOARD, expect.anything());
  });

  test('only a third-party tab is left -> a new tab is used, the third-party tab is untouched', async () => {
    const google = fakePage('https://accounts.google.com/signin');
    const ctx = fakeContext([google], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    await watcherFor(ctx).tick();
    expect(google.goto).not.toHaveBeenCalled();
    expect(ctx.newPage).toHaveBeenCalledTimes(1);
  });

  test('the board address alone is not a login (signed-out board answers 200 + null)', async () => {
    const board = fakePage(BOARD);
    const ctx = fakeContext([board], { cookies: [], session: () => ({ status: 200, text: 'null' }) });
    ctx.__boardBody = 'null';
    await expect(watcherFor(ctx).tick()).resolves.toEqual({ done: false });
    expect(board.goto).not.toHaveBeenCalled();
  });

  test('a tab already on the board whose session answers with a user is done without navigating', async () => {
    const board = fakePage(BOARD);
    const ctx = fakeContext([board], { cookies: SESSION_COOKIES, session: () => ({ status: 200, text: USER_BODY }) });
    await expect(watcherFor(ctx).tick()).resolves.toMatchObject({ done: true, page: board });
    expect(board.goto).not.toHaveBeenCalled();
  });
});

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'dropshotGenerator.ts'), 'utf8');

describe('loginDropshot uses the watcher', () => {
  test('the wait loop no longer gives up on tabs that are not on the board', () => {
    const body = braceBlock(src, 'async function _loginDropshotInternal');
    expect(body).toContain('createDropshotLoginWatcher(');
    expect(body).toContain('await watcher.tick()');
    expect(body).not.toMatch(/if \(!isDropshotBoardUrl\([^)]*\)[^)]*\)\s*continue;/);
  });
});

describe('loginDropshot end to end with fake browsers: login finished, tab still on the login address', () => {
  const mockLaunchRef = { fn: null as null | jest.Mock };
  test('the app notices the login and reports success', async () => {
    jest.resetModules();
    const launch = jest.fn();
    mockLaunchRef.fn = launch;
    jest.doMock('patchright', () => ({ chromium: { launchPersistentContext: (...a: any[]) => launch(...a) } }));
    jest.doMock('playwright', () => ({ chromium: { launchPersistentContext: (...a: any[]) => launch(...a) } }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const osReal = require('os');
    const home = fs.mkdtempSync(path.join(osReal.tmpdir(), 'ds-watch-test-'));
    jest.spyOn(osReal, 'homedir').mockReturnValue(home);

    const evaluate = (state: { signedIn: boolean }) => jest.fn(async (fn: unknown) => {
      const code = String(fn);
      if (code.includes('textLength')) return { ready: true, textLength: 100, controls: 5, title: 't', url: LOGIN };
      if (code.includes('res.text()')) return { status: 200, text: state.signedIn ? USER_BODY : 'null' };
      if (code.includes('res.json()')) return state.signedIn ? { ok: true, userId: 'u1', userName: '박성현', email: '' } : { ok: false, status: 200 };
      if (code.includes('ancestorsContain')) return true;
      if (code.includes('isBadButton')) return { ready: true, clicked: false, detail: 'ok', candidate: '생성' };
      return null;
    });
    // stay=true: a signed-out profile is bounced back to the login address when the board is opened (what the site does).
    const make = (url: string, signedIn: boolean, cookies: any[] = [], stay = false) => {
      const state = { signedIn };
      const page: any = { ...fakePage(url, stay ? () => undefined : undefined), evaluate: evaluate(state), bringToFront: jest.fn(async () => undefined) };
      const ctx: any = {
        ...fakeContext([page], { cookies, session: () => ({ status: 200, text: signedIn ? USER_BODY : 'null' }) }),
        addInitScript: async () => undefined, close: jest.fn(async () => undefined), on: () => undefined, browser: () => null,
      };
      page.context = () => ctx;
      return { ctx, page };
    };
    const precheck = make(LOGIN, false, [], true);
    const loginWindow = make(LOGIN, true, SESSION_COOKIES);
    const background = make(BOARD, true);
    launch.mockResolvedValueOnce(precheck.ctx).mockResolvedValueOnce(loginWindow.ctx).mockResolvedValueOnce(background.ctx);

    const { loginDropshot } = await import('../src/core/dropshotGenerator');
    const result = await loginDropshot();
    expect(loginWindow.page.goto.mock.calls.map((c: any[]) => c[0])).toContain(BOARD);
    expect(result).toMatchObject({ loggedIn: true, message: '로그인 완료' });
    jest.restoreAllMocks();
  }, 30_000);
});
