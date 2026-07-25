/**
 * R0 안전망 — Gemini 503 재시도가 반드시 유한하게 끝나는지 (v3.8.376)
 *
 * 배경: gemini-engine.ts 의 catch 블록이 매 실패마다 `lastInfo = info` 로 덮어쓰는데,
 *   503 분기는 `lastInfo.__svcRetry` 를 읽어 백오프 단계를 정한다.
 *   덮어쓰기가 먼저 일어나므로 __svcRetry 는 **항상 0** 이고, 게다가 `retry--` 로 슬롯을 재사용한다.
 *   → 지속적 503 에서 "2분 대기 → 재시도" 를 영원히 반복하며 함수가 반환하지 않는다.
 *   → orchestration.ts 의 releaseLock() 이 finally 에 있어 try 를 못 빠져나가면 실행되지 않는다.
 *     결과: engineLock 영구 점유 → 이후 모든 글 생성이 무한 대기 (503 한 번 = 그날 0편).
 *
 * 이 테스트는 가짜 타이머로 가상 시간을 돌려 "호출 횟수가 유한한가"만 본다.
 * 수정 전에는 LOOP_GUARD 까지 치솟아 실패해야 한다.
 */

// 실제 네트워크·키·스로틀을 전부 차단한다
const generateContent = jest.fn();
const getGenerativeModel = jest.fn(() => ({ generateContent }));

jest.mock('../src/core/llm', () => ({
  getGenAI: () => ({ getGenerativeModel }),
  getOpenAIApiKey: () => '',
  getClaudeApiKey: () => '',
  getPerplexityApiKey: () => '',
  callOpenAIAPI: jest.fn(),
  callClaudeAPI: jest.fn(),
  callPerplexityAPI: jest.fn(),
}));

jest.mock('../src/core/llm/provider-throttle', () => ({
  waitForTextProviderTurn: jest.fn(async () => undefined),
  waitAfterProviderRateLimit: jest.fn(async () => undefined),
}));

/** 무한루프를 유한 시간에 잡아내기 위한 상한. 이 값에 도달하면 루프가 안 끝나는 것으로 본다. */
const LOOP_GUARD = 40;
/** 정상 구현에서 기대하는 최대 호출 수 (모델 3종 × 503 백오프 5단계 + 여유) */
const EXPECTED_MAX_CALLS = 25;

describe('callGeminiWithRetry — 503 재시도 상한 (R0 안전망)', () => {
  const savedModel = process.env['PRIMARY_TEXT_MODEL'];

  beforeEach(() => {
    jest.useFakeTimers();
    generateContent.mockReset();
    getGenerativeModel.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    // process.env 는 워커 수명 내내 파일 간 공유되므로 반드시 원복한다
    if (savedModel === undefined) delete process.env['PRIMARY_TEXT_MODEL'];
    else process.env['PRIMARY_TEXT_MODEL'] = savedModel;
  });

  it('지속적 503 에서 호출 횟수가 유한하게 수렴한다', async () => {
    let calls = 0;
    generateContent.mockImplementation(async () => {
      calls++;
      if (calls >= LOOP_GUARD) {
        // 루프를 강제로 끝내 프라미스가 settle 되게 한다 (테스트가 매달리지 않도록)
        return { response: { text: () => '루프 가드로 강제 종료' } };
      }
      const err: any = new Error('503 Service Unavailable — model is overloaded');
      err.status = 503;
      throw err;
    });

    const { callGeminiWithRetry } = require('../src/core/final/gemini-engine');
    const pending = callGeminiWithRetry('테스트 프롬프트', 1).catch((e: any) => `ERR:${e?.message}`);

    // 가상 시간을 넉넉히 돌린다 (503 백오프 총합 최대 67분 + 여유)
    for (let i = 0; i < 40; i++) {
      if (calls >= LOOP_GUARD) break;
      await jest.advanceTimersByTimeAsync(10 * 60 * 1000); // 10분씩
    }
    await pending;

    expect(calls).toBeLessThan(LOOP_GUARD);
    expect(calls).toBeLessThanOrEqual(EXPECTED_MAX_CALLS);
  }, 30000);

  it('503 백오프 단계가 실제로 길어진다 (2분에 고정되지 않는다)', async () => {
    const waits: number[] = [];
    const realSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: any, ms?: number) => {
      if (typeof ms === 'number' && ms >= 60_000) waits.push(ms);
      return (realSetTimeout as any)(fn, ms);
    }) as any);

    let calls = 0;
    generateContent.mockImplementation(async () => {
      calls++;
      if (calls >= LOOP_GUARD) return { response: { text: () => 'stop' } };
      const err: any = new Error('503 overloaded');
      err.status = 503;
      throw err;
    });

    const { callGeminiWithRetry } = require('../src/core/final/gemini-engine');
    const pending = callGeminiWithRetry('프롬프트', 1).catch(() => 'err');
    for (let i = 0; i < 40; i++) {
      if (calls >= LOOP_GUARD) break;
      await jest.advanceTimersByTimeAsync(10 * 60 * 1000);
    }
    await pending;

    // 버그 상태에서는 첫 단계(2분=120000)가 계속 재선택되어 수십 번 반복된다.
    // 정상 구현이면 모델 1개당 최대 1번이므로 모델 3종 기준 3번을 넘지 않는다.
    const twoMinuteWaits = waits.filter(ms => ms === 120000).length;
    expect(twoMinuteWaits).toBeLessThanOrEqual(3);
  }, 30000);
});
