/**
 * v3.8.782 — 워드프레스 다중 계정: 글이 전부 기본 계정 하나로 올라가던 문제
 *
 * 구매자: "워드프레스 다중계정 발행하면 아이디가 2개면 글2개가 한 아이디에 다 들어가는 버그가있습니다"
 *
 * ## 원인
 * 다중 계정 핸들러는 계정마다 주소·아이디·비밀번호를 발행 직전까지 정확히 실어 보냈다.
 * 그런데 발행 함수의 워드프레스 분기가 그 값을 읽지 않고 `.env` 의 기본 계정만 읽었다.
 *
 * ## 고친 방식
 * 다중 계정 핸들러만 계정 자격을 **별도 인자**로 넘긴다. payload 안의 값은 여전히 믿지 않는다 —
 * 단일 발행 payload 에는 낡은 저장값이 실려 401 이 났던 사고(v3.8.698)가 있어 `.env` 가 정본이다.
 * 계정 자격은 통째로 쓴다: 하나라도 비면 기본 계정으로 조용히 떨어지지 않고 실패로 알린다.
 *
 * 실제 발행 0: 워드프레스 발행기를 가짜로 바꾸고 fetch·axios 를 막는다.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-782'), isPackaged: false } }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

type Creds = { siteUrl: string; username: string; password: string };
const mockEnv: Record<string, string> = {};
const mockCreated: Creds[] = [];
jest.mock('../src/env', () => ({ ...jest.requireActual('../src/env'), loadEnvFromFile: () => ({ ...mockEnv }) }));
jest.mock('../src/wordpress/wordpress-publisher', () => ({
  WordPressPublisher: class {
    private readonly cfg: Creds;
    constructor(cfg: Creds) { this.cfg = { ...cfg }; mockCreated.push(this.cfg); }
    async publish() {
      // Yield once so overlapping publishes interleave like real network calls do.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { success: true, url: `${this.cfg.siteUrl}/post-by-${this.cfg.username}`, postId: 1 };
    }
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import { blockBetween, braceBlock } from './helpers/source-block';
import { clearPublishDecisions } from '../src/core/final/publish-gate';
import { pickAccountWordPressCredentials } from '../src/wordpress/wp-credentials';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const MAIN = read('electron/main.ts');
/** 앱이 실제로 실행하는 것은 컴파일된 main.js 다 — 둘 다 본다 */
const MAIN_JS = read('electron/main.js');
const SCHEDULE = read('src/core/schedule-manager.ts');

const ENV_DEFAULT: Creds = { siteUrl: 'https://default.example', username: 'default-user', password: 'default-pass' };
const ACCOUNT_A: Creds = { siteUrl: 'https://site-a.example', username: 'user-a', password: 'pass-a' };
const ACCOUNT_B: Creds = { siteUrl: 'https://site-b.example', username: 'user-b', password: 'pass-b' };
const HTML = '<h2>소제목</h2><p>본문입니다.</p>';

const TMP = path.join(__dirname, '..', '.tmp-tests', 'test-782');
let realFetch: typeof fetch;
beforeAll(() => {
  realFetch = global.fetch;
  global.fetch = jest.fn(async () => { throw new Error('network blocked in test'); }) as unknown as typeof fetch;
  fs.mkdirSync(TMP, { recursive: true });
  process.env['PUBLISH_LEDGER_PATH'] = path.join(TMP, 'publish-ledger.json');
});
afterAll(() => { global.fetch = realFetch; delete process.env['PUBLISH_LEDGER_PATH']; });
beforeEach(() => {
  mockCreated.length = 0;
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  // The pre-publish repair step is not what this suite measures.
  mockEnv['VERIFY_GATE'] = 'off';
  clearPublishDecisions();
});

const setDefaultAccount = (creds: Creds) => {
  mockEnv['wordpressSiteUrl'] = creds.siteUrl;
  mockEnv['wordpressUsername'] = creds.username;
  mockEnv['wordpressPassword'] = creds.password;
};
/** 다중 계정 핸들러가 부르는 모양 그대로 — payload 에도 같은 값이 실려 있다 */
const publishAs = (account: Partial<Creds>, title = '다중 계정 글') => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { publishGeneratedContent } = require('../src/core/index');
  const payload = { platform: 'wordpress', topic: title, wordpressSiteUrl: account.siteUrl, wordpressUsername: account.username, wordpressPassword: account.password };
  return publishGeneratedContent(payload, title, HTML, '', undefined, { wordpressAccount: account });
};

describe('① 계정마다 자기 자격으로 발행한다', () => {
  test('⭐ 계정 2개를 차례로 — 각자 자기 사이트·아이디로 나간다 (기본 계정으로 쏠리지 않는다)', async () => {
    setDefaultAccount(ENV_DEFAULT);
    const a = await publishAs(ACCOUNT_A, '글 A');
    const b = await publishAs(ACCOUNT_B, '글 B');
    expect(mockCreated).toEqual([ACCOUNT_A, ACCOUNT_B]);
    expect(a).toMatchObject({ ok: true, url: 'https://site-a.example/post-by-user-a' });
    expect(b).toMatchObject({ ok: true, url: 'https://site-b.example/post-by-user-b' });
  });

  test('⭐ 계정 2개를 동시에 — 값이 섞이지 않는다', async () => {
    setDefaultAccount(ENV_DEFAULT);
    const [a, b] = await Promise.all([publishAs(ACCOUNT_A, '글 A'), publishAs(ACCOUNT_B, '글 B')]);
    expect(a.url).toBe('https://site-a.example/post-by-user-a');
    expect(b.url).toBe('https://site-b.example/post-by-user-b');
    expect(mockCreated).toHaveLength(2);
    expect(mockCreated).toEqual(expect.arrayContaining([ACCOUNT_A, ACCOUNT_B]));
  });

  test('같은 사이트에 아이디 2개 — 아이디가 각각 유지된다', async () => {
    setDefaultAccount(ENV_DEFAULT);
    const second: Creds = { siteUrl: ACCOUNT_A.siteUrl, username: 'user-a2', password: 'pass-a2' };
    await publishAs(ACCOUNT_A);
    await publishAs(second);
    expect(mockCreated.map((c) => c.username)).toEqual(['user-a', 'user-a2']);
  });

  test('기본 계정(.env)이 비어 있어도 계정 자격만으로 발행된다', async () => {
    const result = await publishAs(ACCOUNT_B);
    expect(result).toMatchObject({ ok: true, url: 'https://site-b.example/post-by-user-b' });
    expect(mockCreated).toEqual([ACCOUNT_B]);
  });
});

describe('② 계정 자격이 비면 기본 계정으로 조용히 떨어지지 않는다', () => {
  test.each([
    ['siteUrl', '사이트 주소'],
    ['username', '아이디'],
    ['password', '앱 비밀번호'],
  ] as const)('⭐ %s 가 비면 실패로 알리고 발행기를 만들지 않는다', async (field, label) => {
    setDefaultAccount(ENV_DEFAULT);
    const result = await publishAs({ ...ACCOUNT_A, [field]: '   ' });
    expect(result.ok).toBe(false);
    expect(result.error).toContain(label);
    expect(mockCreated).toHaveLength(0);
  });
});

describe('③ 단일 발행은 그대로 — .env 가 정본이다 (v3.8.698 회귀 방지)', () => {
  test('⭐ 계정 인자 없이 부르면 payload 의 낡은 값이 아니라 .env 값을 쓴다', async () => {
    setDefaultAccount(ENV_DEFAULT);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { publishGeneratedContent } = require('../src/core/index');
    const stale = { platform: 'wordpress', topic: '단일 글', wordpressSiteUrl: 'https://stale.example', wordpressUsername: 'stale-user', wordpressPassword: 'OLD-401' };
    const result = await publishGeneratedContent(stale, '단일 글', HTML, '');
    expect(mockCreated).toEqual([ENV_DEFAULT]);
    expect(result).toMatchObject({ ok: true, url: 'https://default.example/post-by-default-user' });
  });

  test('계정 인자가 없고 .env 도 비면 기존 안내 그대로 실패한다', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { publishGeneratedContent } = require('../src/core/index');
    const result = await publishGeneratedContent({ platform: 'wordpress', topic: '단일 글' }, '단일 글', HTML, '');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('워드프레스 설정이 완료되지 않았습니다');
    expect(mockCreated).toHaveLength(0);
  });
});

describe('④ 자격 고르기 규칙 (순수 함수)', () => {
  test('앞뒤 공백을 떼고 세 값이 다 있으면 통째로 돌려준다', () => {
    expect(pickAccountWordPressCredentials({ siteUrl: ' https://site-a.example ', username: ' user-a ', password: ' pass-a ' }))
      .toEqual({ ok: true, credentials: ACCOUNT_A });
  });

  test('빈 칸을 전부 이름으로 알려준다 — 공백만 있는 값도 빈 것이다', () => {
    expect(pickAccountWordPressCredentials({ siteUrl: 'https://site-a.example', username: '  ', password: undefined }))
      .toEqual({ ok: false, missing: ['username', 'password'] });
    expect(pickAccountWordPressCredentials({})).toEqual({ ok: false, missing: ['siteUrl', 'username', 'password'] });
  });
});

describe('⑤ 배선 — 다중 계정 경로만 계정 자격을 넘긴다', () => {
  const handlerOf = (src: string) => blockBetween(src, "ipcMain.handle('run-multi-account-post'", "ipcMain.handle('get-env'");
  const multiAccount = handlerOf(MAIN);
  /** 발행 호출 한 문장을 공백 없이 — 줄바꿈·들여쓰기가 달라도 같은 모양으로 비교한다 */
  const publishCallOf = (handler: string) => blockBetween(handler, 'const publishResult = await publishGeneratedContent(', ');').replace(/\s+/g, '');

  test.each([
    ['main.ts', MAIN],
    ['main.js (컴파일본)', MAIN_JS],
  ])('⭐ %s — 다중 계정 핸들러가 그 계정의 주소·아이디·비밀번호를 여섯 번째 인자로, 제 짝에 맞게 넘긴다', (_name, src) => {
    // 자리가 하나 밀리면(다섯 번째 = 로그 콜백) 계정 값이 조용히 무시되고, 짝이 바뀌면 엉뚱한 값으로 로그인한다
    expect(publishCallOf(handlerOf(src))).toContain(
      "publishGeneratedContent(postPayload,articleTitle,articleHtml,articleThumbnail,undefined,postPayload.platform==='wordpress'?{"
      + 'wordpressAccount:{siteUrl:postPayload.wordpressSiteUrl,username:postPayload.wordpressUsername,password:postPayload.wordpressPassword},'
      + '}:undefined',
    );
  });

  test('단일·편집기·거미줄·예약 경로는 계정 인자를 넘기지 않는다 (.env 정본 유지)', () => {
    const runPost = blockBetween(MAIN, "ipcMain.handle('run-post'", "ipcMain.handle('publish-content'");
    const publishContent = braceBlock(MAIN, "ipcMain.handle('publish-content'");
    const internalLink = braceBlock(MAIN, "safeRegisterHandler('publish-internal-link-content'");
    for (const block of [runPost, publishContent, internalLink, SCHEDULE]) {
      expect(block).toContain('publishGeneratedContent(');
      expect(block).not.toContain('wordpressAccount');
    }
  });

  test('다중 계정 발행 장부의 대상 칸에 워드프레스 계정 주소가 남는다 — 어느 계정으로 나갔는지 추적', () => {
    expect(multiAccount.replace(/\s+/g, '')).toContain("target:publishTargetOf(postPayload)||String(postPayload.wordpressSiteUrl||'')");
  });

  test('다른 경로의 장부 기록 규칙은 그대로다 — 단일 발행 payload 의 워드프레스 주소는 낡은 저장값일 수 있다', () => {
    expect(braceBlock(MAIN, 'function publishTargetOf(')).not.toContain('wordpressSiteUrl');
  });
});
