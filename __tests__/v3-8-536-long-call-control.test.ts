/**
 * 긴 호출 제어 테스트 — 본문 타임아웃 분리 + 즉시 중지 (v3.8.536)
 *
 * 실사고 2건이 한 릴리스인 이유:
 *  ① "gemini-3.5-flash timeout after 60s" — 본문 통짜 JSON(32k 토큰)을 제목과
 *     같은 60초 상한으로 기다리다 발행이 통째로 실패 (사장님 실보고).
 *  ② "중지버튼누르면 칼같이바로 중지되게못하니" — 기존 취소는 검문소 방식이라
 *     이미 굴러가는 60~180초 호출 중간엔 안 멈췄다.
 *  ①만 고치면(대기 3배) ②의 "안 멈추는 구간"도 3배가 된다 — 세트가 맞다.
 */

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

import { callGeminiWithRetry, resolveSectionTimeoutMs } from '../src/core/final/gemini-engine';
import {
  beginRun, requestCancel, endRun, isCancellation, getCancelSignal, cancelRace,
} from '../src/core/cancel-token';
import * as fs from 'fs';
import * as path from 'path';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const savedModel = process.env['PRIMARY_TEXT_MODEL'];
const savedTimeout = process.env['GEMINI_TIMEOUT_MS'];

beforeEach(() => {
  generateContent.mockReset();
  process.env['PRIMARY_TEXT_MODEL'] = 'gemini-2.5-flash'; // gemini 티어 강제 (기본은 openai)
  endRun();
});

afterAll(() => {
  if (savedModel === undefined) delete process.env['PRIMARY_TEXT_MODEL'];
  else process.env['PRIMARY_TEXT_MODEL'] = savedModel;
  if (savedTimeout === undefined) delete process.env['GEMINI_TIMEOUT_MS'];
  else process.env['GEMINI_TIMEOUT_MS'] = savedTimeout;
  endRun();
});

const hang = () => new Promise<never>(() => { /* 영원히 대기 */ });
const after = (ms: number, text: string) => new Promise((resolve) => {
  setTimeout(() => resolve({ response: { text: () => text } }), ms);
});

describe('① 본문급 타임아웃 분리', () => {
  it('기본 호출은 짧은 상한(GEMINI_TIMEOUT_MS) 그대로 — 죽은 서버에서 빨리 실패', async () => {
    process.env['GEMINI_TIMEOUT_MS'] = '120';
    generateContent.mockImplementation(hang);
    const t0 = Date.now();
    await expect(callGeminiWithRetry('짧은 호출')).rejects.toThrow(/응답 시간|timeout/);
    expect(Date.now() - t0).toBeLessThan(5000); // 모델 2개 × 120ms + 여유
  }, 15000);

  it('opts.timeoutMs 가 env 짧은 상한을 이긴다 — 본문급 호출은 오래 기다린다', async () => {
    process.env['GEMINI_TIMEOUT_MS'] = '120';         // env 는 120ms 로 짧게
    generateContent.mockImplementation(() => after(600, '본문 JSON'));
    const out = await callGeminiWithRetry('본문급 호출', 1, { timeoutMs: 5000 });
    expect(out).toBe('본문 JSON'); // 120ms 였다면 죽었을 호출이 살아남는다
  }, 15000);

  it('본문 기본 예산은 180초이고 env 로 조정 가능하다', () => {
    delete process.env['GEMINI_SECTION_TIMEOUT_MS'];
    expect(resolveSectionTimeoutMs()).toBe(180_000);
  });

  it('generation.ts 의 본문급 4개 호출부가 전부 긴 예산을 쓴다', () => {
    const gen = read('src/core/final/generation.ts');
    const count = (gen.match(/resolveSectionTimeoutMs\(\)/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4); // grounding + 재시도 + 보강 + 수리
  });

  it('타임아웃 처방이 더는 "Flash 를 선택하라"고 헛짚지 않는다', () => {
    const engine = read('src/core/final/gemini-engine.ts');
    expect(engine).not.toContain("fix = 'Flash 계열 모델을 선택하거나");
    expect(engine).toContain('서버 혼잡일 수 있습니다');
  });
});

describe('② 즉시 중지 — 진행 중 호출에서 바로 탈출', () => {
  it('⭐ 중지를 누르면 굴러가던 Gemini 대기가 1초 안에 CanceledError 로 끝난다', async () => {
    generateContent.mockImplementation(hang);
    beginRun();
    const t0 = Date.now();
    setTimeout(() => requestCancel(), 100);
    let thrown: unknown = null;
    try {
      await callGeminiWithRetry('본문', 1, { timeoutMs: 30_000 });
    } catch (e) { thrown = e; }
    const elapsed = Date.now() - t0;
    endRun();
    expect(isCancellation(thrown)).toBe(true);
    expect(elapsed).toBeLessThan(2500); // 30초 타임아웃을 기다리지 않는다
  }, 15000);

  it('도는 작업이 없으면 신호도 레이스도 조용하다 — 평소 호출에 영향 0', async () => {
    expect(getCancelSignal()).toBeNull();
    generateContent.mockImplementation(() => after(50, '정상'));
    await expect(callGeminiWithRetry('평소 호출', 1, { timeoutMs: 5000 })).resolves.toBe('정상');
  });

  it('cancelRace 는 취소 순간 reject, 새 run 에서는 초기화된다', async () => {
    beginRun();
    const race = cancelRace('테스트 지점');
    requestCancel();
    await expect(race).rejects.toThrow(/테스트 지점/);
    endRun();
    beginRun(); // 새 작업 — 이전 취소가 새 신호를 오염시키면 안 된다
    expect(getCancelSignal()?.aborted).toBe(false);
    endRun();
  });

  it('llm-caller 는 abort(ERR_CANCELED) 를 실패가 아니라 중지로 던진다', async () => {
    jest.resetModules();
    jest.doMock('axios', () => {
      const actual = jest.requireActual('axios');
      return {
        __esModule: true, ...actual,
        default: Object.assign((...a: unknown[]) => (actual.default as any)(...a), actual.default, {
          post: jest.fn().mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' })),
        }),
        AxiosError: actual.AxiosError,
      };
    });
    jest.doMock('../src/core/llm/api-keys', () => ({ getApiKey: () => 'test-key' }));
    jest.doMock('../src/core/llm/provider-throttle', () => ({
      getTextProviderMaxRetries: () => 3, // 중지면 재시도 없이 즉시 던져야 한다
      waitAfterProviderBackoff: async () => undefined,
      waitAfterProviderRateLimit: async () => undefined,
      waitForTextProviderTurn: async () => undefined,
    }));
    const ct = require('../src/core/cancel-token');
    const { callLLM } = require('../src/core/llm/llm-caller');
    ct.beginRun(); ct.requestCancel();
    let thrown: unknown = null;
    try { await callLLM('openai', '테스트'); } catch (e) { thrown = e; }
    ct.endRun();
    expect(ct.isCancellation(thrown)).toBe(true);
    expect(String((thrown as Error).message)).toContain('중지');
  });

  it('이미지 요청도 취소 신호를 합쳐 쓴다 (thumbnail 2곳)', () => {
    const thumb = read('src/thumbnail.ts');
    expect((thumb.match(/composeAbortSignal\(180000\)/g) || []).length).toBe(2);
    expect(thumb).toContain('AbortSignal.any');
    expect(thumb).toContain("require('./core/cancel-token')");
  });
});
