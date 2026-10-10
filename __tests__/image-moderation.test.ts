/**
 * AI 이미지 선정성 검사 — 글에 넣기 전에 OpenAI moderation 1회(사장님 승인, v3.8.759 의 이중 방어).
 *
 * v3.8.759 가 원인(Dropshot 이 남의 썸네일을 집던 것)은 막았다. 이건 그래도 뭔가 새어 나올 때를 위한 두 번째 문이다.
 * 검사를 못 하는 경우(키 없음·오류·시간초과)는 **이미지를 막지 않고** 기록만 남긴다 — 검사 때문에 글이 멈추면 안 된다.
 * 네트워크는 가짜를 주입한다.
 */
import { moderateGeneratedImage, moderationBlockedError, resetImageModerationNotices } from '../src/core/image-moderation';
import { classifyImageError } from '../src/core/image-error-classifier';

const KEY = 'sk-test-moderation-key-1234567890';
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const reply = (status: number, body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

beforeEach(() => {
  resetImageModerationNotices();
  delete process.env['NO_LIVE_LLM'];
});

describe('검사 요청', () => {
  test('OpenAI moderation 에 omni-moderation-latest 로 이미지를 한 번 보낸다', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ results: [{ flagged: false, categories: { sexual: false } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const v = await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl });
    expect(v).toMatchObject({ checked: true, flagged: false, categories: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.openai.com/v1/moderations');
    expect(calls[0]!.init.method).toBe('POST');
    expect((calls[0]!.init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url: IMG } }] });
  });

  test('설정의 openaiKey 이름도 읽는다', async () => {
    let auth = '';
    const fetchImpl = (async (_u: string, init: RequestInit) => { auth = (init.headers as Record<string, string>)['Authorization'] || ''; return new Response(JSON.stringify({ results: [{ flagged: false, categories: {} }] })); }) as unknown as typeof fetch;
    await moderateGeneratedImage(IMG, { env: { openaiKey: KEY }, fetchImpl });
    expect(auth).toBe(`Bearer ${KEY}`);
  });
});

describe('판정', () => {
  test('걸리면 flagged 와 걸린 항목(sexual 등)을 돌려준다', async () => {
    const v = await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl: reply(200, { results: [{ flagged: true, categories: { sexual: true, violence: false, 'self-harm': false } }] }) });
    expect(v).toMatchObject({ checked: true, flagged: true, categories: ['sexual'] });
  });

  test('막는 오류 문구는 안전 필터로 분류된다(다른 엔진·대체 이미지로 넘어가고 발행을 막지 않는다) — 숫자가 없어야 403·429 로 잘못 읽히지 않는다', () => {
    const msg = moderationBlockedError(['sexual', 'violence/graphic']);
    expect(msg).toContain('IMAGE_MODERATION_BLOCKED');
    expect(msg).not.toMatch(/\d/);
    const c = classifyImageError(msg);
    expect(c.category).toBe('safety_filter');
    expect(c.bypassable).toBe(true);
  });
});

describe('검사를 못 하면 막지 않는다(기록만)', () => {
  test('OpenAI 키가 없으면 검사를 건너뛰고, 안내는 한 번만 한다', async () => {
    const logs: string[] = [];
    let called = 0;
    const fetchImpl = (async () => { called += 1; return new Response('{}'); }) as unknown as typeof fetch;
    const a = await moderateGeneratedImage(IMG, { env: {}, fetchImpl, onLog: (m) => logs.push(m) });
    const b = await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: 'short' }, fetchImpl, onLog: (m) => logs.push(m) });
    expect(a).toMatchObject({ checked: false, flagged: false });
    expect(b).toMatchObject({ checked: false, flagged: false });
    expect(called).toBe(0);
    expect(logs.filter((l) => l.includes('OpenAI 키 없음'))).toHaveLength(1);
  });

  test('NO_LIVE_LLM=1(시험 모드)이면 검사하지 않는다', async () => {
    process.env['NO_LIVE_LLM'] = '1';
    let called = 0;
    const v = await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl: (async () => { called += 1; return new Response('{}'); }) as unknown as typeof fetch });
    expect(v.checked).toBe(false);
    expect(called).toBe(0);
  });

  test('HTTP 오류(429·500)·이상한 응답·시간초과·망 오류 — 이미지는 그대로 쓰고 사유를 남긴다', async () => {
    const logs: string[] = [];
    const onLog = (m: string) => logs.push(m);
    for (const fetchImpl of [
      reply(429, { error: { message: 'rate limit' } }),
      reply(500, 'oops'),
      reply(200, 'not json'),
      reply(200, { results: [] }),
      (async () => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); }) as unknown as typeof fetch,
      (async () => { throw new Error('getaddrinfo ENOTFOUND api.openai.com'); }) as unknown as typeof fetch,
    ]) {
      const v = await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl, onLog });
      expect(v).toMatchObject({ checked: false, flagged: false });
    }
    expect(logs.filter((l) => l.includes('검사 없이 사용')).length).toBe(6);
  });

  test('어떤 기록에도 키가 찍히지 않는다', async () => {
    const logs: string[] = [];
    const spy = jest.spyOn(console, 'warn').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
    const spyLog = jest.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { logs.push(a.map(String).join(' ')); });
    try {
      await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl: reply(401, { error: { message: `Incorrect API key provided: ${KEY}` } }), onLog: (m) => logs.push(m) });
      await moderateGeneratedImage(IMG, { env: { OPENAI_API_KEY: KEY }, fetchImpl: reply(200, { results: [{ flagged: true, categories: { sexual: true } }] }), onLog: (m) => logs.push(m) });
    } finally { spy.mockRestore(); spyLog.mockRestore(); }
    expect(logs.join('\n')).not.toContain(KEY);
  });

  test('이미지가 비었으면 검사하지 않는다', async () => {
    let called = 0;
    const v = await moderateGeneratedImage('', { env: { OPENAI_API_KEY: KEY }, fetchImpl: (async () => { called += 1; return new Response('{}'); }) as unknown as typeof fetch });
    expect(v.checked).toBe(false);
    expect(called).toBe(0);
  });
});
