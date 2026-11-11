/**
 * Dropshot signed-out session: say "login expired" instead of the vague "could not verify" message.
 *
 * Measured on this PC (2026-11-10): the saved profile stays on the board URL when logged out and
 * /api/auth/session answers 200 with the body `null`. verifyDropshotGenerationSession only knew
 * "login URL" and "401/403" as logged-out, so it waited the full 20 s and ended with
 * "Dropshot 생성 권한을 확인하지 못했습니다 (board 주소)". Users read that as a bug, not as "log in again".
 *
 * Network errors and other uncertain answers must keep the old wording, and the 20 s polling stays
 * (a session can be briefly empty right after a login) - both are locked here.
 */
const mod: any = require('../src/core/dropshotGenerator');

const BOARD = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const EXPIRED = 'Dropshot 로그인이 만료되었습니다. [리더스 나노바나나 로그인]으로 다시 로그인해주세요.';
const VAGUE = 'Dropshot 생성 권한을 확인하지 못했습니다';
const NEED_AUTH = 'Dropshot 생성 권한 인증이 필요합니다.';

type Reply = { status: number; body: string } | 'network-error';

/** Runs the in-page function in Node against a stubbed fetch, so the test does not depend on how the probe is written. */
function fakePage(replies: () => Reply, cookies: any[] = []) {
  const stubFetch = jest.fn(async () => {
    const reply = replies();
    if (reply === 'network-error') throw new TypeError('Failed to fetch');
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      text: async () => reply.body,
      json: async () => JSON.parse(reply.body),
    };
  });
  (global as any).fetch = stubFetch;
  return {
    url: () => BOARD,
    goto: jest.fn(async () => undefined),
    evaluate: async (fn: any, arg: any) => fn(arg),
    context: () => ({ cookies: async () => cookies }),
  };
}

/** Moves the fake clock until the promise settles (the function polls every 500 ms for up to 20 s). */
async function settle<T>(promise: Promise<T>): Promise<{ value: T; waitedMs: number }> {
  let done = false;
  const guarded = promise.finally(() => { done = true; });
  let waitedMs = 0;
  while (!done && waitedMs < 60_000) {
    await jest.advanceTimersByTimeAsync(500);
    waitedMs += 500;
  }
  return { value: await guarded, waitedMs };
}

const SIGNED_IN = JSON.stringify({ user: { id: 'u1', email: 'a@b.c', name: 'Tester' }, idToken: 'x' });
const realFetch = (global as any).fetch;

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); (global as any).fetch = realFetch; });

describe('classifyDropshotSessionResponse', () => {
  it('200 + null / {} / user without id is "signed out", not "unknown"', () => {
    for (const body of ['null', '{}', '{"user":null}', '{"user":{}}']) {
      const r = mod.classifyDropshotSessionResponse(200, body);
      expect(r.ok).toBe(false);
      expect(r.signedOut).toBe(true);
    }
  });

  it('200 + user with id or email is signed in', () => {
    const r = mod.classifyDropshotSessionResponse(200, SIGNED_IN);
    expect(r.ok).toBe(true);
    expect(r.name).toBe('Tester');
    expect(r.signedOut).not.toBe(true);
  });

  it('401, 5xx and non-JSON answers are uncertain, never "signed out"', () => {
    expect(mod.classifyDropshotSessionResponse(401, '').signedOut).not.toBe(true);
    expect(mod.classifyDropshotSessionResponse(401, '').status).toBe(401);
    expect(mod.classifyDropshotSessionResponse(500, 'null').signedOut).not.toBe(true);
    expect(mod.classifyDropshotSessionResponse(200, '<html>challenge</html>').signedOut).not.toBe(true);
    expect(mod.classifyDropshotSessionResponse(200, '').signedOut).not.toBe(true);
  });
});

describe('verifyDropshotGenerationSession - signed-out wording', () => {
  it('200 + null for the whole window ends with the clear "login expired" message', async () => {
    const page = fakePage(() => ({ status: 200, body: 'null' }));
    const { value } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.authenticated).toBe(false);
    expect(value.message).toBe(EXPIRED);
    expect(value.message).not.toContain(VAGUE);
  });

  it('a network error keeps the old vague wording (uncertain stays uncertain)', async () => {
    const page = fakePage(() => 'network-error');
    const { value } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.authenticated).toBe(false);
    expect(value.message).toContain(VAGUE);
    expect(value.message).not.toBe(EXPIRED);
  });

  it('a 200 that is not JSON (challenge page) is not called "expired"', async () => {
    const page = fakePage(() => ({ status: 200, body: '<html>Just a moment</html>' }));
    const { value } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.message).toContain(VAGUE);
  });

  it('401 still says authentication is needed', async () => {
    const page = fakePage(() => ({ status: 401, body: '' }));
    const { value } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.authenticated).toBe(false);
    expect(value.message).toBe(`${NEED_AUTH} Google 또는 Kakao 로그인을 완료해주세요.`);
  });

  it('a signed-in session is accepted right away', async () => {
    const page = fakePage(() => ({ status: 200, body: SIGNED_IN }));
    const { value, waitedMs } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.authenticated).toBe(true);
    expect(waitedMs).toBeLessThanOrEqual(500);
  });

  it('keeps polling: three empty answers followed by a user is still accepted (session briefly empty after login)', async () => {
    let calls = 0;
    const page = fakePage(() => (++calls <= 3 ? { status: 200, body: 'null' } : { status: 200, body: SIGNED_IN }));
    const { value } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(value.authenticated).toBe(true);
    expect(calls).toBeGreaterThan(3);
  });

  it('signed-out answers are polled for the whole 20 s window before giving up (no early exit without evidence)', async () => {
    const page = fakePage(() => ({ status: 200, body: 'null' }));
    const { waitedMs } = await settle(mod.verifyDropshotGenerationSession(page));
    expect(waitedMs).toBeGreaterThanOrEqual(20_000);
  });
});
