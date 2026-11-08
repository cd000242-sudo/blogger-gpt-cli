/**
 * Stage 1 - connection misjudgement ("CLI did not answer" was shown as "login needed").
 *
 * A probe that times out, fails to start, or prints nothing says nothing about the account.
 * It must be reported as "delayed" (check was slow, login is untouched), never as "needs login",
 * and a recently verified login is reused for 6 hours. A folder that only has config files
 * (no real token) must not count as a login. Nothing here starts a CLI or reads a real login file.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AGENT_VERIFIED_REUSE_MS,
  classifyLoginProbe,
  createVerifiedLoginMemo,
  credentialTextHasToken,
  delayedLoginMessage,
  isolatedProfileHasRealLogin,
  settleLoginState,
} from '../electron/agent-login-verdict';
import { pickAgentProfile } from '../electron/agent-profile-state';

const facts = (over: Record<string, unknown> = {}) => ({
  timedOut: false,
  launchError: false,
  loginStatus: true as boolean | null,
  authRequired: false,
  quotaExceeded: false,
  exitCode: 0 as number | null,
  ...over,
});

describe('classifyLoginProbe - a probe that cannot answer is "delayed"', () => {
  test('timeout -> delayed (not needs-login)', () => {
    expect(classifyLoginProbe(facts({ timedOut: true, loginStatus: null, exitCode: null }))).toBe('delayed');
  });
  test('the CLI could not even be started -> delayed', () => {
    expect(classifyLoginProbe(facts({ launchError: true, loginStatus: null, exitCode: null }))).toBe('delayed');
  });
  test('empty or unparseable output -> delayed', () => {
    expect(classifyLoginProbe(facts({ loginStatus: null, exitCode: 0 }))).toBe('delayed');
    expect(classifyLoginProbe(facts({ loginStatus: null, exitCode: 1 }))).toBe('delayed');
  });
  test('"logged in" text with a failing exit code is not a confirmation -> delayed', () => {
    expect(classifyLoginProbe(facts({ loginStatus: true, exitCode: 1 }))).toBe('delayed');
  });
  test('only an explicit logout signal means needs-login', () => {
    expect(classifyLoginProbe(facts({ loginStatus: false, authRequired: true, exitCode: 1 }))).toBe('needs-login');
    expect(classifyLoginProbe(facts({ authRequired: true }))).toBe('needs-login');
  });
  test('usage limit keeps its own state (the login is fine)', () => {
    expect(classifyLoginProbe(facts({ quotaExceeded: true }))).toBe('quota');
  });
  test('clean answer -> ready', () => {
    expect(classifyLoginProbe(facts())).toBe('ready');
  });
});

describe('verified login memo - 6 hour reuse', () => {
  const T0 = 1_000_000_000_000;

  test('reuse window is exactly 6 hours', () => {
    expect(AGENT_VERIFIED_REUSE_MS).toBe(6 * 60 * 60 * 1000);
  });

  test('a verified login is recalled inside the window and gone at 6 hours', () => {
    let now = T0;
    const memo = createVerifiedLoginMemo({ now: () => now });
    memo.remember('claude-a');
    now = T0 + AGENT_VERIFIED_REUSE_MS - 1;
    expect(memo.recall('claude-a')?.verifiedAt).toBe(T0);
    now = T0 + AGENT_VERIFIED_REUSE_MS;
    expect(memo.recall('claude-a')).toBeNull();
  });

  test('recalling never extends the window', () => {
    let now = T0;
    const memo = createVerifiedLoginMemo({ now: () => now });
    memo.remember('p');
    now = T0 + 5 * 60 * 60 * 1000;
    expect(memo.recall('p')).not.toBeNull();
    now = T0 + 6 * 60 * 60 * 1000 + 1;
    expect(memo.recall('p')).toBeNull();
  });

  test('forget drops one profile or all of them', () => {
    const memo = createVerifiedLoginMemo({ now: () => T0 });
    memo.remember('a');
    memo.remember('b');
    memo.forget('a');
    expect(memo.recall('a')).toBeNull();
    expect(memo.recall('b')).not.toBeNull();
    memo.forget();
    expect(memo.recall('b')).toBeNull();
  });

  test('serialize/restore keeps valid entries and drops malformed or future ones', () => {
    let now = T0;
    const memo = createVerifiedLoginMemo({ now: () => now });
    memo.remember('keep');
    const saved = memo.serialize();
    const restored = createVerifiedLoginMemo({
      now: () => now,
      initial: { ...saved, bad: 'x', future: T0 + 10 * 60 * 1000, old: T0 - AGENT_VERIFIED_REUSE_MS - 1 } as never,
    });
    expect(restored.recall('keep')?.verifiedAt).toBe(T0);
    expect(restored.recall('bad')).toBeNull();
    expect(restored.recall('future')).toBeNull();
    expect(restored.recall('old')).toBeNull();
  });
});

describe('settleLoginState - what the caller finally sees', () => {
  test('delayed + a recent verification -> ready (reused), the job may go on', () => {
    const out = settleLoginState('delayed', { verifiedAt: 5 });
    expect(out).toMatchObject({ state: 'ready', ready: true, reused: true, delayed: false });
  });
  test('delayed with nothing to reuse -> blocked as delayed (not as a logout)', () => {
    const out = settleLoginState('delayed', null);
    expect(out).toMatchObject({ state: 'delayed', ready: false, reused: false, delayed: true });
  });
  test('needs-login is never rescued by an old verification', () => {
    expect(settleLoginState('needs-login', { verifiedAt: 5 })).toMatchObject({ state: 'needs-login', ready: false, delayed: false });
  });
  test('quota is never rescued either', () => {
    expect(settleLoginState('quota', { verifiedAt: 5 })).toMatchObject({ state: 'quota', ready: false });
  });
  test('ready stays ready and is not "reused"', () => {
    expect(settleLoginState('ready', null)).toMatchObject({ state: 'ready', ready: true, reused: false });
  });
});

describe('delayed copy never tells the user to log in or install', () => {
  test('message keeps the login and offers a re-check', () => {
    const text = delayedLoginMessage('Claude Code');
    expect(text).toContain('확인 지연');
    expect(text).toContain('로그인은 그대로 유지됩니다');
    expect(text).toContain('다시 확인');
    expect(text).not.toMatch(/로그인해|설치해|업데이트/);
  });
});

describe('credentialTextHasToken - a real token, not just a config file', () => {
  const long = 'a'.repeat(40);
  test('Claude credentials with tokens', () => {
    const text = JSON.stringify({ claudeAiOauth: { accessToken: `sk-ant-oat01-${long}`, refreshToken: `sk-ant-ort01-${long}`, expiresAt: 1 } });
    expect(credentialTextHasToken(text)).toBe(true);
  });
  test('Codex auth.json (ChatGPT login) and API key login', () => {
    const chatgpt = JSON.stringify({ OPENAI_API_KEY: null, tokens: { id_token: long, access_token: long, refresh_token: long } });
    expect(credentialTextHasToken(chatgpt)).toBe(true);
    expect(credentialTextHasToken(JSON.stringify({ OPENAI_API_KEY: `sk-proj-${long}` }))).toBe(true);
  });
  test.each([
    ['empty text', ''],
    ['not json', 'oauth session account'],
    ['empty object', '{}'],
    ['null oauth', '{"claudeAiOauth":null}'],
    ['blank tokens', '{"claudeAiOauth":{"accessToken":"","refreshToken":""}}'],
    ['placeholder tokens', '{"tokens":{"access_token":"xxx","refresh_token":"TODO"}}'],
    ['null api key', '{"OPENAI_API_KEY":null,"tokens":null}'],
    ['token-like text in a non-token field', JSON.stringify({ note: long, oauthAccount: { emailAddress: 'a@b.c' } })],
  ])('%s -> false', (_name, text) => {
    expect(credentialTextHasToken(text)).toBe(false);
  });
});

describe('isolatedProfileHasRealLogin - an empty isolated folder is not a login', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-verdict-'));
  const tokenJson = JSON.stringify({ claudeAiOauth: { accessToken: `t${'a'.repeat(40)}`, refreshToken: `r${'b'.repeat(40)}` } });
  const dir = (name: string) => {
    const d = path.join(root, name);
    fs.mkdirSync(d, { recursive: true });
    return d;
  };
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  test('missing folder and empty folder -> false', () => {
    expect(isolatedProfileHasRealLogin(path.join(root, 'nope'), 'claude')).toBe(false);
    expect(isolatedProfileHasRealLogin(dir('empty'), 'claude')).toBe(false);
  });

  test('config-only folder (the July leftover: .claude.json + profile marker) -> false', () => {
    const d = dir('config-only');
    fs.writeFileSync(path.join(d, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'a@b.c' }, claude_ai: true, padding: 'x'.repeat(400) }));
    fs.writeFileSync(path.join(d, '.leadernam-agent-profile.json'), '{"provider":"claude"}');
    expect(isolatedProfileHasRealLogin(d, 'claude')).toBe(false);
  });

  test('credentials file without a token -> false; with a token -> true', () => {
    const hollow = dir('hollow');
    fs.writeFileSync(path.join(hollow, '.credentials.json'), '{"claudeAiOauth":{"accessToken":"","refreshToken":""}}   ');
    expect(isolatedProfileHasRealLogin(hollow, 'claude')).toBe(false);
    const real = dir('real');
    fs.writeFileSync(path.join(real, '.credentials.json'), tokenJson);
    expect(isolatedProfileHasRealLogin(real, 'claude')).toBe(true);
  });

  test('Codex looks at auth.json', () => {
    const d = dir('codex');
    fs.writeFileSync(path.join(d, 'auth.json'), JSON.stringify({ tokens: { access_token: 'q'.repeat(40), refresh_token: 'w'.repeat(40) } }));
    expect(isolatedProfileHasRealLogin(d, 'codex')).toBe(true);
    expect(isolatedProfileHasRealLogin(dir('codex-empty'), 'codex')).toBe(false);
  });
});

describe('pickAgentProfile - this PC login is the default', () => {
  const p = (over: Record<string, unknown>) => ({ id: 'x', provider: 'claude', status: 'ready' as const, ...over });
  const isolated = p({ id: 'iso', status: 'ready' });
  const system = p({ id: 'sys', status: 'ready', useSystemHome: true });

  test('no choice: the system-home profile beats an earlier ready isolated one', () => {
    expect(pickAgentProfile([isolated, system], { provider: 'claude' })?.id).toBe('sys');
  });
  test('an alive choice made by the user still wins', () => {
    expect(pickAgentProfile([isolated, system], { provider: 'claude', preferredId: 'iso' })?.id).toBe('iso');
  });
  test('a dead choice gives way to the system-home profile', () => {
    const dead = p({ id: 'old', status: 'needs-login' });
    expect(pickAgentProfile([dead, isolated, system], { provider: 'claude', preferredId: 'old' })?.id).toBe('sys');
  });
  test('nothing is ready and nothing was chosen: the system-home profile carries the clear error', () => {
    const deadIso = p({ id: 'iso2', status: 'needs-login' });
    const deadSys = p({ id: 'sys2', status: 'needs-login', useSystemHome: true });
    expect(pickAgentProfile([deadIso, deadSys], { provider: 'claude' })?.id).toBe('sys2');
  });
  test('an explicit id still wins over everything', () => {
    expect(pickAgentProfile([isolated, system], { provider: 'claude', profileId: 'iso' })?.id).toBe('iso');
  });
});
