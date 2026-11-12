/**
 * v3.8.773 - Dropshot: pressing [login] while the login window is already open
 *
 * Owner report (2026-11-12): several blank tabs and an error dialog full of launch logs
 * ("로그인 실패: 예외: Chrome/Edge/Chromium 실행 실패: browserType.launchPersistentContext: Target page,
 * context or browser has been closed ... <launched> pid=26100 ...").
 *
 * Root cause: the profile (~/.blogger-gpt/dropshot-profile) is owned by the window that is already open.
 * A second Chrome hands about:blank to that window and exits with code 0 at once. launchBrowser() then retried
 * 2 engines x 3 channels = up to 6 launches (6 blank tabs) and showed the last raw error on screen.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  DROPSHOT_LOGIN_BUSY_MESSAGE,
  DROPSHOT_LOGIN_CLOSED_MESSAGE,
  DROPSHOT_PROFILE_IN_USE_MESSAGE,
  createSingleFlight,
  dropshotFailureMessage,
  isDropshotProfileInUseError,
  isDropshotProfileLockHeld,
  summarizeDropshotLaunchError,
} from '../src/core/dropshotProfileLock';

const mockLaunch = jest.fn();
jest.mock('patchright', () => ({ chromium: { launchPersistentContext: (...a: any[]) => mockLaunch(...a) } }));
jest.mock('playwright', () => ({ chromium: { launchPersistentContext: (...a: any[]) => mockLaunch(...a) } }));

// Shape of the real message captured with Playwright 1.x on Windows (Chrome Korean strings arrive garbled).
const RAW_HANDOFF_ERROR = [
  'browserType.launchPersistentContext: Target page, context or browser has been closed',
  'Browser logs:',
  '',
  '<launching> C:\\pw\\chromium-1187\\chrome-win\\chrome.exe --disable-field-trial-config --disable-background-networking --no-first-run --lang=ko-KR,ko --window-size=1280,900 --user-data-dir=C:\\Users\\x\\.blogger-gpt\\dropshot-profile --remote-debugging-pipe about:blank',
  '<launched> pid=26100',
  '[pid=26100][out] \uFFFD\uFFFD\uFFFD\uFFFD \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD \uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD \uFFFD\uFFFD\uFFFD\uFFFD \uFFFD\uFFFD\uFFFD\u0534\u03F4\uFFFD.',
  '[pid=26100] <process did exit: exitCode=0, signal=null>',
  '[pid=26100] starting temporary directory cleanup',
].join('\n');

// Plain require: the real module object can be spied on (a namespace import cannot).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const osReal = require('os');
let tmpHome: string;
beforeEach(() => {
  mockLaunch.mockReset();
  tmpHome = fs.mkdtempSync(path.join(osReal.tmpdir(), 'ds-lock-test-'));
  jest.spyOn(osReal, 'homedir').mockReturnValue(tmpHome);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('isDropshotProfileInUseError', () => {
  test.each([
    ['English Chromium lock text', 'Failed to create a ProcessSingleton for your profile directory'],
    ['SingletonLock file', "Error: EEXIST: SingletonLock: file already exists"],
    ['user data directory in use', 'The user data directory is already in use, please specify a unique value'],
    ['Chrome English hand-off line', 'Opening in existing browser session.'],
    ['Chrome Korean hand-off line', '[pid=26100][out] 기존 브라우저 세션에서 여는 중입니다.'],
    ['garbled Korean + launched + exit 0 (what the owner really got)', RAW_HANDOFF_ERROR],
  ])('%s -> true', (_label, text) => {
    expect(isDropshotProfileInUseError(new Error(text))).toBe(true);
    expect(isDropshotProfileInUseError(text)).toBe(true);
  });

  test.each([
    ['missing browser', "browserType.launchPersistentContext: Executable doesn't exist at C:\\x\\chrome.exe\nrun playwright install"],
    ['network', 'page.goto: net::ERR_NAME_NOT_RESOLVED at https://aistudio.dropshot.io/'],
    ['crash with non-zero exit', '<launched> pid=1\n[pid=1] <process did exit: exitCode=21, signal=null>'],
    ['exit 0 without ever launching', '<process did exit: exitCode=0, signal=null>'],
    ['timeout', 'Timeout 45000ms exceeded.'],
    ['empty', ''],
  ])('%s -> false', (_label, text) => {
    expect(isDropshotProfileInUseError(new Error(text))).toBe(false);
  });

  test('null / undefined are false', () => {
    expect(isDropshotProfileInUseError(null)).toBe(false);
    expect(isDropshotProfileInUseError(undefined)).toBe(false);
  });
});

describe('messages shown on screen are short and carry no launch log', () => {
  const banned = /pid=|<launch|--disable|--user-data-dir|Browser logs|\[out\]|\.exe/;

  test('constants are one or two lines with the next step', () => {
    for (const text of [DROPSHOT_LOGIN_BUSY_MESSAGE, DROPSHOT_PROFILE_IN_USE_MESSAGE, DROPSHOT_LOGIN_CLOSED_MESSAGE]) {
      expect(text.split('\n').length).toBeLessThanOrEqual(2);
      expect(text.length).toBeLessThan(120);
      expect(text).not.toMatch(banned);
    }
    expect(DROPSHOT_LOGIN_BUSY_MESSAGE).toContain('로그인');
    expect(DROPSHOT_LOGIN_BUSY_MESSAGE).toContain('이미');
  });

  test('summarizeDropshotLaunchError drops the log block and the argument list', () => {
    const text = summarizeDropshotLaunchError(new Error(RAW_HANDOFF_ERROR));
    expect(text).not.toMatch(banned);
    expect(text.split('\n').length).toBe(1);
    expect(text.length).toBeLessThan(200);
  });

  test('dropshotFailureMessage: lock errors keep their short message without the "예외:" prefix', () => {
    const lock = Object.assign(new Error(DROPSHOT_PROFILE_IN_USE_MESSAGE), { name: 'DropshotProfileInUseError' });
    expect(dropshotFailureMessage(lock)).toBe(DROPSHOT_PROFILE_IN_USE_MESSAGE);
    expect(dropshotFailureMessage(new Error('boom'))).toBe('예외: boom');
  });
});

describe('createSingleFlight', () => {
  test('a second call while the first runs gets the busy answer and does not start a second run', async () => {
    const flight = createSingleFlight<string>();
    let release!: (v: string) => void;
    const work = jest.fn(() => new Promise<string>((r) => { release = r; }));
    const first = flight.run(work, () => 'busy');
    const second = await flight.run(work, () => 'busy');
    expect(second).toBe('busy');
    expect(work).toHaveBeenCalledTimes(1);
    expect(flight.isRunning()).toBe(true);
    release('done');
    await expect(first).resolves.toBe('done');
    expect(flight.isRunning()).toBe(false);
  });

  test('after a failure the guard is released', async () => {
    const flight = createSingleFlight<string>();
    await expect(flight.run(async () => { throw new Error('x'); }, () => 'busy')).rejects.toThrow('x');
    await expect(flight.run(async () => 'ok', () => 'busy')).resolves.toBe('ok');
  });
});

describe('launch is not repeated when the profile is already open (real generator, mocked browser engines)', () => {
  test('background check: one launch only, short message', async () => {
    mockLaunch.mockRejectedValue(new Error(RAW_HANDOFF_ERROR));
    const { checkDropshotLogin } = await import('../src/core/dropshotGenerator');
    const result = await checkDropshotLogin({ force: true });
    expect(mockLaunch).toHaveBeenCalledTimes(1);
    expect(result.loggedIn).toBe(false);
    expect(result.message).toBe(DROPSHOT_PROFILE_IN_USE_MESSAGE);
  });

  test('login button: one launch only, the message is not the raw log', async () => {
    mockLaunch.mockRejectedValue(new Error(RAW_HANDOFF_ERROR));
    const { loginDropshot } = await import('../src/core/dropshotGenerator');
    const result = await loginDropshot();
    expect(mockLaunch).toHaveBeenCalledTimes(1);
    expect(result.loggedIn).toBe(false);
    expect(String(result.message)).not.toMatch(/pid=|<launch|--disable|Browser logs/);
    expect(String(result.message).split('\n').length).toBeLessThanOrEqual(2);
    expect(String(result.message)).toContain('이미');
  });

  test('other launch failures are still tried on every engine but the message stays short', async () => {
    mockLaunch.mockRejectedValue(new Error("browserType.launchPersistentContext: spawn EPERM\n<launching> C:\\x\\chrome.exe --a --b --c\n<launched> pid=5"));
    const { checkDropshotLogin } = await import('../src/core/dropshotGenerator');
    const result = await checkDropshotLogin({ force: true });
    expect(mockLaunch.mock.calls.length).toBeGreaterThan(1);
    expect(String(result.message)).not.toMatch(/pid=|<launch|--a/);
    expect(String(result.message).split('\n').length).toBe(1);
  });
});

function fakeLoginContext() {
  const handlers: Record<string, Array<() => void>> = {};
  const page = {
    url: () => 'https://stock.dropshot.io/ko/logIn',
    goto: jest.fn(async () => undefined),
    bringToFront: jest.fn(async () => undefined),
    evaluate: jest.fn(async () => ({ ready: true, textLength: 100, controls: 5, title: 'login', url: 'https://stock.dropshot.io/ko/logIn' })),
    context: () => ctx,
  };
  const ctx: any = {
    pages: () => [page],
    newPage: async () => page,
    addInitScript: async () => undefined,
    cookies: async () => [],
    request: { get: async () => ({ status: () => 200, text: async () => 'null' }) },
    on: (event: string, cb: () => void) => { (handlers[event] ||= []).push(cb); },
    close: jest.fn(async () => { (handlers['close'] || []).forEach((cb) => cb()); }),
    browser: () => null,
  };
  return { ctx, page, emitClose: () => (handlers['close'] || []).forEach((cb) => cb()) };
}

describe('login button pressed again while the login window is open', () => {
  test('second press is answered at once, background checks do not launch a browser, closing the window ends the wait', async () => {
    const headless = fakeLoginContext();
    const visible = fakeLoginContext();
    mockLaunch.mockResolvedValueOnce(headless.ctx).mockResolvedValueOnce(visible.ctx);
    const { loginDropshot, checkDropshotLogin } = await import('../src/core/dropshotGenerator');

    const first = loginDropshot();
    const deadline = Date.now() + 8000;
    while (visible.page.goto.mock.calls.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(mockLaunch).toHaveBeenCalledTimes(2);
    expect(visible.page.goto).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 1500));

    const second = await loginDropshot();
    expect(second).toMatchObject({ loggedIn: false, message: DROPSHOT_LOGIN_BUSY_MESSAGE });
    expect(visible.page.bringToFront.mock.calls.length).toBeGreaterThan(1);

    const background = await checkDropshotLogin({ force: true });
    expect(background).toMatchObject({ loggedIn: false, message: DROPSHOT_LOGIN_BUSY_MESSAGE });
    expect(mockLaunch).toHaveBeenCalledTimes(2);

    visible.emitClose();
    const done = await first;
    expect(done).toMatchObject({ loggedIn: false, message: DROPSHOT_LOGIN_CLOSED_MESSAGE });

    mockLaunch.mockRejectedValue(new Error(RAW_HANDOFF_ERROR));
    const again = await loginDropshot();
    expect(again.message).not.toBe(DROPSHOT_LOGIN_BUSY_MESSAGE);
  }, 30_000);
});

// Real capture (2026-11-12, Playwright with a second Chromium on a profile that a running Chromium owns, F:\work\orbit-release\ds_gen\bug2_real_error.txt):
// the message carries NO lock wording at all - only "Target page, context or browser has been closed" + <launched> + exitCode=21.
// Chromium keeps <profile>\lockfile open while it runs (open r+ -> EBUSY, measured), so the profile owner is read from disk.
const REAL_CAPTURE_WITHOUT_LOCK_WORDING = [
  'browserType.launchPersistentContext: Target page, context or browser has been closed',
  'Browser logs:',
  '',
  '<launching> C:/pw/chromium-1223/chrome-win64/chrome.exe --disable-field-trial-config --user-data-dir=C:/x/profile about:blank',
  '<launched> pid=10608',
  'Call log:',
  '  - <gracefully close start>',
  '  - <kill>',
  '  - <process did exit: exitCode=21, signal=null>',
].join('\n');

describe('isDropshotProfileLockHeld', () => {
  const fsReal = require('fs');
  const realOpen = fsReal.openSync.bind(fsReal);
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(osReal.tmpdir(), 'ds-lockheld-')); });

  function openFailsWith(code: string | null) {
    return jest.spyOn(fsReal, 'openSync').mockImplementation(((p: any, ...rest: any[]) => {
      if (String(p).endsWith('lockfile') && code) throw Object.assign(new Error(code), { code });
      return realOpen(p, ...rest);
    }) as any);
  }

  test('win32: no lockfile -> not held', () => {
    expect(isDropshotProfileLockHeld(dir, 'win32')).toBe(false);
  });

  test('win32: lockfile that Chromium keeps open (EBUSY / EPERM / EACCES) -> held', () => {
    fs.writeFileSync(path.join(dir, 'lockfile'), '');
    for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
      const spy = openFailsWith(code);
      expect(isDropshotProfileLockHeld(dir, 'win32')).toBe(true);
      spy.mockRestore();
    }
  });

  test('win32: leftover lockfile nobody holds -> not held', () => {
    fs.writeFileSync(path.join(dir, 'lockfile'), '');
    expect(isDropshotProfileLockHeld(dir, 'win32')).toBe(false);
  });

  test('posix: SingletonLock pointing at a live process -> held, dead process or no link -> not held', () => {
    const readlink = jest.spyOn(fsReal, 'readlinkSync');
    readlink.mockReturnValue(`host-${process.pid}` as any);
    expect(isDropshotProfileLockHeld(dir, 'linux')).toBe(true);
    readlink.mockReturnValue('host-2147483000' as any);
    expect(isDropshotProfileLockHeld(dir, 'linux')).toBe(false);
    readlink.mockImplementation(() => { throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' }); });
    expect(isDropshotProfileLockHeld(dir, 'linux')).toBe(false);
  });

  test('the real capture has no lock wording, so message sniffing alone cannot tell (the disk check is what catches it)', () => {
    expect(isDropshotProfileInUseError(new Error(REAL_CAPTURE_WITHOUT_LOCK_WORDING))).toBe(false);
  });
});

describe('profile owned by a running browser (lock held on disk)', () => {
  const fsReal = require('fs');
  const realOpen = fsReal.openSync.bind(fsReal);

  function holdLockOnDisk() {
    const lockDir = path.join(tmpHome, '.blogger-gpt', 'dropshot-profile');
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(path.join(lockDir, 'lockfile'), '');
    return jest.spyOn(fsReal, 'openSync').mockImplementation(((p: any, ...rest: any[]) => {
      if (String(p).endsWith('lockfile')) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return realOpen(p, ...rest);
    }) as any);
  }

  test('background check: no browser is launched at all (no blank tab), short message', async () => {
    holdLockOnDisk();
    mockLaunch.mockRejectedValue(new Error(REAL_CAPTURE_WITHOUT_LOCK_WORDING));
    const { checkDropshotLogin } = await import('../src/core/dropshotGenerator');
    const result = await checkDropshotLogin({ force: true });
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ loggedIn: false, message: DROPSHOT_PROFILE_IN_USE_MESSAGE });
  });

  test('login button: no launch, answered with the short message', async () => {
    holdLockOnDisk();
    const { loginDropshot } = await import('../src/core/dropshotGenerator');
    const result = await loginDropshot();
    expect(mockLaunch).not.toHaveBeenCalled();
    expect(result).toMatchObject({ loggedIn: false, message: DROPSHOT_PROFILE_IN_USE_MESSAGE });
  });

  test('a launch that fails without lock wording while the lock is held on disk is not retried on other channels', async () => {
    const { checkDropshotLogin } = await import('../src/core/dropshotGenerator');
    const lockDir = path.join(tmpHome, '.blogger-gpt', 'dropshot-profile');
    fs.mkdirSync(lockDir, { recursive: true });
    fs.writeFileSync(path.join(lockDir, 'lockfile'), '');
    let held = false;
    jest.spyOn(fsReal, 'openSync').mockImplementation(((p: any, ...rest: any[]) => {
      if (String(p).endsWith('lockfile') && held) throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
      return realOpen(p, ...rest);
    }) as any);
    // The owner appears between the pre-check and the launch (race): the launch fails with the lock-less message.
    mockLaunch.mockImplementation(async () => { held = true; throw new Error(REAL_CAPTURE_WITHOUT_LOCK_WORDING); });
    const result = await checkDropshotLogin({ force: true });
    expect(mockLaunch).toHaveBeenCalledTimes(1);
    expect(result.message).toBe(DROPSHOT_PROFILE_IN_USE_MESSAGE);
  });
});
