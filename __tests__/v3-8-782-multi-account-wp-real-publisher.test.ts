/**
 * v3.8.782 — 워드프레스 다중 계정, **진짜 발행 코드**로 확인
 *
 * 옆 파일(v3-8-782-multi-account-wp-credentials)은 발행기를 가짜로 바꿔 "어느 값으로 만들어졌나"를 본다.
 * 여기서는 발행기(WordPressPublisher)와 통신 코드(WordPressAPI)를 그대로 두고,
 * 이 PC 안에 띄운 가짜 워드프레스 서버 3대(계정 A · 계정 B · 기본 계정)에 물려
 * **어느 서버에, 어느 아이디로** 글 쓰기 요청이 가는지 본다. 127.0.0.1 밖으로는 아무것도 나가지 않는다.
 */
jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '.tmp-tests/test-782-real'), isPackaged: false } }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return fn(); } } }));
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: () => unknown) => fn() }));
jest.mock('axios', () => { const blocked = () => Promise.reject(new Error('network blocked in test')); const a = Object.assign(blocked, { get: blocked, post: blocked, put: blocked, request: blocked, create: () => a, defaults: { headers: { common: {} } }, interceptors: { request: { use: () => 0 }, response: { use: () => 0 } } }); return { __esModule: true, default: a, ...a }; });

const mockEnv: Record<string, string> = {};
jest.mock('../src/env', () => ({ ...jest.requireActual('../src/env'), loadEnvFromFile: () => ({ ...mockEnv }) }));

import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { clearPublishDecisions } from '../src/core/final/publish-gate';

type Seen = { method: string; path: string; user: string };
type FakeSite = { name: string; base: string; seen: Seen[]; close: () => Promise<void> };

/** 워드프레스 REST 를 흉내 내는 서버 — 받은 요청마다 방법·경로·로그인 아이디를 적어 둔다 */
async function fakeWordPress(name: string): Promise<FakeSite> {
  const seen: Seen[] = [];
  let base = '';
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const auth = String(req.headers.authorization || '');
      const user = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':')[0]! : '';
      const pathname = new URL(String(req.url), 'http://local').pathname;
      const method = String(req.method);
      seen.push({ method, path: pathname, user });
      const send = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (/\/wp\/v2\/posts(\/\d+)?$/.test(pathname) && method !== 'GET') {
        return send(201, { id: 101, link: `${base}/posted-on-${name}`, status: 'publish', title: { rendered: 'ok' }, content: { rendered: '' } });
      }
      if (method !== 'GET') return send(201, { id: 7, name: 'item', slug: 'item' });
      if (pathname.endsWith('/users/me')) return send(200, { id: 1, name, capabilities: { publish_posts: true, edit_posts: true, upload_files: true } });
      if (/\/wp-json\/?$/.test(pathname)) return send(200, { name, namespaces: ['wp/v2'] });
      return send(200, []);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { name, base, seen, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

const HTML = [
  '<h2>첫 번째 소제목</h2><p>다중 계정 발행을 확인하는 본문입니다. 충분한 길이를 가진 문단을 둡니다.</p>',
  '<h2>두 번째 소제목</h2><p>계정마다 자기 사이트로 가야 합니다. 기본 계정으로 쏠리면 안 됩니다.</p>',
  '<h2>세 번째 소제목</h2><p>이 글은 이 PC 안의 가짜 서버로만 갑니다.</p>',
].join('\n');

const TMP = path.join(__dirname, '..', '.tmp-tests', 'test-782-real');
let siteA: FakeSite;
let siteB: FakeSite;
let siteDefault: FakeSite;
let realFetch: typeof fetch;
const outside: string[] = [];

beforeAll(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  process.env['PUBLISH_LEDGER_PATH'] = path.join(TMP, 'publish-ledger.json');
  [siteA, siteB, siteDefault] = await Promise.all([fakeWordPress('A'), fakeWordPress('B'), fakeWordPress('default')]);
  // Nothing may leave this machine: anything that is not one of the three local servers is refused and recorded.
  realFetch = global.fetch;
  global.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(typeof input === 'string' ? input : (input as { url?: string }).url ?? input);
    if (!url.startsWith('http://127.0.0.1:')) { outside.push(url.slice(0, 80)); throw new Error('network blocked in test'); }
    return realFetch(input, init);
  }) as typeof fetch;
});
afterAll(async () => {
  global.fetch = realFetch;
  delete process.env['PUBLISH_LEDGER_PATH'];
  await Promise.all([siteA.close(), siteB.close(), siteDefault.close()]);
});
beforeEach(() => {
  for (const site of [siteA, siteB, siteDefault]) site.seen.length = 0;
  for (const key of Object.keys(mockEnv)) delete mockEnv[key];
  mockEnv['VERIFY_GATE'] = 'off';
  mockEnv['wordpressSiteUrl'] = siteDefault.base;
  mockEnv['wordpressUsername'] = 'default-user';
  mockEnv['wordpressPassword'] = 'default-pass';
  clearPublishDecisions();
});

const wrotePost = (site: FakeSite) => site.seen.filter((r) => r.method === 'POST' && /\/wp\/v2\/posts$/.test(r.path));
const usersOn = (site: FakeSite) => [...new Set(site.seen.map((r) => r.user).filter(Boolean))];
const publish = (title: string, payload: Record<string, unknown>, account?: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { publishGeneratedContent } = require('../src/core/index');
  return publishGeneratedContent({ platform: 'wordpress', topic: title, ...payload }, title, HTML, '', undefined, account ? { wordpressAccount: account } : undefined);
};

describe('진짜 발행 코드 + 가짜 워드프레스 서버 3대', () => {
  test('⭐ 계정 A 글은 A 서버에 A 아이디로, 계정 B 글은 B 서버에 B 아이디로 — 기본 계정 서버에는 아무 요청도 안 간다', async () => {
    const accountA = { siteUrl: siteA.base, username: 'user-a', password: 'pass-a' };
    const accountB = { siteUrl: siteB.base, username: 'user-b', password: 'pass-b' };

    const [a, b] = await Promise.all([
      publish('계정 A 글', { wordpressSiteUrl: accountA.siteUrl, wordpressUsername: accountA.username, wordpressPassword: accountA.password }, accountA),
      publish('계정 B 글', { wordpressSiteUrl: accountB.siteUrl, wordpressUsername: accountB.username, wordpressPassword: accountB.password }, accountB),
    ]);

    expect(a).toMatchObject({ ok: true });
    expect(b).toMatchObject({ ok: true });
    expect(String(a.url)).toContain(siteA.base);
    expect(String(b.url)).toContain(siteB.base);
    expect(wrotePost(siteA)).toHaveLength(1);
    expect(wrotePost(siteB)).toHaveLength(1);
    expect(usersOn(siteA)).toEqual(['user-a']);
    expect(usersOn(siteB)).toEqual(['user-b']);
    expect(siteDefault.seen).toEqual([]);
    expect(outside).toEqual([]);
  }, 60000);

  test('⭐ 단일 발행은 payload 에 다른 사이트가 실려 있어도 기본 계정 서버로만 간다 (v3.8.698 규칙)', async () => {
    const result = await publish('단일 글', { wordpressSiteUrl: siteB.base, wordpressUsername: 'stale-user', wordpressPassword: 'OLD-401' });
    expect(result).toMatchObject({ ok: true });
    expect(String(result.url)).toContain(siteDefault.base);
    expect(wrotePost(siteDefault)).toHaveLength(1);
    expect(usersOn(siteDefault)).toEqual(['default-user']);
    expect(siteA.seen).toEqual([]);
    expect(siteB.seen).toEqual([]);
  }, 60000);
});
