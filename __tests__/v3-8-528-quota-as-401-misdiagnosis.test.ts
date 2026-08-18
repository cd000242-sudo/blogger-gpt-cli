/**
 * v3.8.528 — 잔액 소진을 401 로 돌려주는 provider 의 오진 방지
 *
 * 실측(2026-08-19): Perplexity 는 크레딧이 바닥나도 HTTP 401 로 응답한다.
 *   401 | "You exceeded your current quota, please check your plan and billing details."
 *
 * 기존 분류기는 두 계층(llm-caller / gemini-engine) 모두 401 을 무조건 auth 로 읽어
 * "API 키가 만료되었거나 권한이 없습니다"라는 처방을 내보냈다.
 * 사용자는 멀쩡한 키를 재발급하고, 문제(충전)는 그대로 남는다.
 *
 * 이 테스트는 세 가지를 잠근다:
 *  1) llm-caller: 401 + 쿼터 문구 → quota 처방 (auth 아님)
 *  2) llm-caller: 401 + "API key is invalid" → 여전히 auth 처방 (회귀 방지)
 *  3) gemini-engine: 감싸진 Perplexity 쿼터 오류 → quota 처방 + [BILLING:perplexity] 마커
 *
 * 유출 차단 키(403 + reported as leaked → auth)는 gemini-leaked-key.test.ts 가 잠근다.
 */

const postMock = jest.fn();

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    __esModule: true,
    ...actual,
    default: Object.assign(
      (...args: unknown[]) => (actual.default as (...a: unknown[]) => unknown)(...args),
      actual.default,
      { post: postMock },
    ),
    AxiosError: actual.AxiosError,
  };
});

jest.mock('../src/core/llm/api-keys', () => ({
  getApiKey: jest.fn(() => 'test-key'),
  getOpenAIApiKey: jest.fn(() => 'test-key'),
  getClaudeApiKey: jest.fn(() => 'test-key'),
  getPerplexityApiKey: jest.fn(() => 'test-key'),
  getGenAI: jest.fn(),
}));

jest.mock('../src/core/llm/provider-throttle', () => ({
  getTextProviderMaxRetries: jest.fn(() => 1),
  waitAfterProviderBackoff: jest.fn(async () => undefined),
  waitAfterProviderRateLimit: jest.fn(async () => undefined),
  waitForTextProviderTurn: jest.fn(async () => undefined),
}));

import { AxiosError } from 'axios';
import { callLLM } from '../src/core/llm/llm-caller';

/** 실측 응답 모양 그대로: status 401 + 쿼터 메시지 */
function axios401(message: string): AxiosError {
  return new AxiosError(
    'Request failed with status code 401',
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    { status: 401, statusText: 'Unauthorized', headers: {}, config: {} as never, data: { error: { message } } },
  );
}

describe('llm-caller — 401 이어도 쿼터 문구면 quota 처방 (v3.8.528)', () => {
  beforeEach(() => postMock.mockReset());

  test('Perplexity 잔액 소진(401+quota 문구) → "쿼터" 처방, "키 만료" 오진 금지', async () => {
    postMock.mockRejectedValue(
      axios401('You exceeded your current quota, please check your plan and billing details.'),
    );

    await expect(callLLM('perplexity', '테스트')).rejects.toThrow(/쿼터/);
    await expect(callLLM('perplexity', '테스트')).rejects.not.toThrow(/키가 만료되었거나/);
  });

  test('회귀 방지: 진짜 키 오류(401+invalid key)는 여전히 auth 처방', async () => {
    postMock.mockRejectedValue(axios401('API key is invalid.'));

    await expect(callLLM('claude', '테스트')).rejects.toThrow(/키가 만료되었거나/);
  });
});

describe('gemini-engine — 감싸진 Perplexity 쿼터 오류도 quota 로 (v3.8.528)', () => {
  const savedModel = process.env['PRIMARY_TEXT_MODEL'];

  afterEach(() => {
    if (savedModel === undefined) delete process.env['PRIMARY_TEXT_MODEL'];
    else process.env['PRIMARY_TEXT_MODEL'] = savedModel;
    jest.resetModules();
  });

  test('401 문구가 섞인 쿼터 오류 → 쿼터 처방 + BILLING 마커, auth 오진 금지', async () => {
    process.env['PRIMARY_TEXT_MODEL'] = 'perplexity-sonar';
    jest.resetModules();

    // llm-caller 가 실제로 던지는 모양(원인+세부, "401" 문자열 포함)을 그대로 흉내낸다
    const wrapped = new Error(
      'Perplexity 엔진 호출 실패 (1회 시도, model=sonar-pro)\n'
      + '원인: 결제 잔액이 있어도 분당/일일/토큰 한도 또는 프로젝트 쿼터에 걸릴 수 있습니다.\n'
      + '세부: HTTP 401 | You exceeded your current quota, please check your plan and billing details.',
    );

    jest.doMock('../src/core/llm', () => ({
      getGenAI: jest.fn(),
      getOpenAIApiKey: () => 'test-key',
      getClaudeApiKey: () => 'test-key',
      getPerplexityApiKey: () => 'test-key',
      callOpenAIAPI: jest.fn(),
      callClaudeAPI: jest.fn(),
      callPerplexityAPI: jest.fn(async () => { throw wrapped; }),
    }));

    const { callGeminiWithRetry } = require('../src/core/final/gemini-engine');

    let thrown: Error | null = null;
    try {
      await callGeminiWithRetry('테스트');
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown!.message).toMatch(/쿼터 또는 사용량 제한/);
    expect(thrown!.message).toContain('[BILLING:perplexity]');
    expect(thrown!.message).not.toMatch(/API 키 인증 또는 프로젝트 권한 문제/);
  });
});
