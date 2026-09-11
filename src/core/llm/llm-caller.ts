/**
 * 통합 LLM 호출 엔진
 * 3개 중복 함수(callPerplexityAPI, callOpenAIAPI, callClaudeAPI)를 1개로 통합
 */

import axios, { AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './api-keys';
import { findTier } from './pricing';
import { applyOpenAiTokenParams } from './openai-params';
// v3.8.565 (E2): 출력 언어는 language-rules 가 단독으로 정한다.
//   본문 프롬프트(generation.ts)와 여기가 서로 다른 언어를 지시하면 모델이 흔들린다.
import { systemLanguageLine } from '../final/language-rules';
import {
  getTextProviderMaxRetries,
  waitAfterProviderBackoff,
  waitAfterProviderRateLimit,
  waitForTextProviderTurn,
  type TextProvider,
} from './provider-throttle';

// ─── 응답 타입 ──────────────────────────────────
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>;
}

// ─── 프로바이더 설정 ────────────────────────────
interface LLMProviderConfig {
  name: string;
  provider: TextProvider;
  endpoint: string;
  models: string[];
  timeout: number;
  rateLimitPattern: RegExp;
  authErrorPattern: RegExp;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (model: string, prompt: string) => Record<string, unknown>;
  extractText: (data: ChatCompletionResponse | ClaudeResponse) => string;
}

/**
 * 시스템 프롬프트 — 언어 줄만 갈리고 나머지 사실성 규칙은 언어와 무관하다. (v3.8.565 · E2)
 *
 * ⚠️ 상수가 아니라 **함수**여야 한다. 모듈이 처음 읽힐 때 값이 굳으면
 *    그 시점의 언어(대개 기본값 한국어)가 프로세스 내내 남는다 —
 *    연속발행에서 영어 글을 만들어도 "always respond in Korean" 이 계속 나간다.
 */
const FACTUAL_SYSTEM_TAIL = [
  'Preserve the requested structure and supplied evidence.',
  'Treat dates, amounts, eligibility, schedules, statistics, organization names, and URLs as factual claims.',
  'Use an exact factual claim only when it appears in supplied evidence; never combine unrelated facts into a new claim.',
  'Never invent a source, citation, URL, or plausible-looking value. When evidence is missing, use a neutral official-verification note instead of guessing.',
].join(' ');

/** 호출할 때마다 현재 언어로 조립한다 — 굳혀 두면 언어가 안 바뀐다 */
function factualSystemPrompt(): string {
  return `${systemLanguageLine()} ${FACTUAL_SYSTEM_TAIL}`;
}

function getGenerationTemperature(prompt: string): number {
  return /\[FACT EVIDENCE|FACT INTEGRITY|Verified source URLs|grounding response/i.test(prompt) ? 0.28 : 0.52;
}

/**
 * 출력 토큰 상한 — **모든 제공자가 이 하나를 쓴다.** (v3.8.434)
 *
 * ## 왜
 * 사용자 지적: "왜자꾸 기준을 제미나이로 잡는지 모르겠네 다른 API도 많은데"
 *
 * 맞는 지적이었다. v3.8.432~433 에서 본문이 통째로 비는 문제(응답 잘림)를
 * 고치면서 Gemini 만 32,768 로 올렸다. 그런데 사용자가 글 생성 AI 로
 * OpenAI(6,000) · Claude(8,192) · Perplexity(8,192) 를 고르면 **같은 버그가
 * 그대로 남아 있었다.** 한국어는 글자당 토큰이 커서 H2 7개 분량이면
 * 8,192 로는 거의 확실히 잘린다.
 *
 * 상한은 "여기까지 허용"이지 "여기까지 쓴다"가 아니다. 실사용량만큼 과금되므로
 * 올린다고 비용이 늘지 않는다. 오히려 잘려서 다시 만드는 쪽이 비싸다.
 *
 * ⚠️ 새 제공자를 추가할 때 숫자를 직접 박지 말 것 — 이 함수를 쓸 것.
 *    (wiring-integrity-guard.test.ts 가 숫자 직접 박기를 실패시킨다)
 */
export function resolveLlmMaxTokens(): number {
  const raw = Number(process.env['LLM_MAX_OUTPUT_TOKENS'] || '');
  if (Number.isFinite(raw) && raw >= 1024) return Math.floor(raw);
  return 16384;
}

function buildOpenAIChatBody(model: string, prompt: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: factualSystemPrompt() },
      { role: 'user', content: prompt },
    ],
  };

  /**
   * v3.8.714 — 규칙을 openai-params 한 곳에서 정한다.
   * 예전엔 `/^gpt-5/` 만 새 규칙을 썼다 → **gpt-6-astra** 가 옛 취급을 받아
   * max_tokens·temperature 를 보냈고 HTTP 400 으로 발행이 통째로 실패했다(사장님 실측).
   */
  return applyOpenAiTokenParams(
    body,
    model,
    resolveLlmMaxTokens(),
    getGenerationTemperature(prompt),
    { reasoningEffort: 'medium' },
  );
}

const PROVIDERS: Record<string, LLMProviderConfig> = {
  perplexity: {
    name: 'Perplexity',
    provider: 'perplexity',
    endpoint: 'https://api.perplexity.ai/chat/completions',
    models: ['sonar-pro', 'sonar'],
    timeout: 60_000,
    rateLimitPattern: /429|rate.*limit|quota/i,
    authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key/i,
    buildHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    buildBody: (model, prompt) => ({
      model,
      messages: [
        { role: 'system', content: factualSystemPrompt() },
        { role: 'user', content: prompt },
      ],
      max_tokens: resolveLlmMaxTokens(),
      temperature: getGenerationTemperature(prompt),
    }),
    extractText: (data) => (data as ChatCompletionResponse)?.choices?.[0]?.message?.content || '',
  },

  openai: {
    name: 'OpenAI',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol'],
    timeout: 90_000,
    rateLimitPattern: /429|rate.*limit|quota|insufficient_quota/i,
    authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key/i,
    buildHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    buildBody: buildOpenAIChatBody,
    extractText: (data) => (data as ChatCompletionResponse)?.choices?.[0]?.message?.content || '',
  },

  claude: {
    name: 'Claude',
    provider: 'claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-haiku-4-5-20251001'],
    timeout: 90_000,
    rateLimitPattern: /429|rate.*limit|overloaded/i,
    authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key|authentication/i,
    buildHeaders: (key) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }),
    buildBody: (model, prompt) => ({
      model,
      max_tokens: resolveLlmMaxTokens(),
      messages: [{ role: 'user', content: prompt }],
      system: factualSystemPrompt(),
      temperature: getGenerationTemperature(prompt),
    }),
    extractText: (data) => {
      const content = (data as ClaudeResponse)?.content;
      if (Array.isArray(content)) {
        return content
          .filter((block): block is { type: 'text'; text: string } => block.type === 'text' && typeof block.text === 'string')
          .map((block) => block.text)
          .join('');
      }
      return '';
    },
  },
};

type ProviderFailureKind =
  | 'auth'
  | 'billing'
  | 'quota'
  | 'rate_limit'
  | 'model'
  | 'timeout'
  | 'network'
  | 'empty'
  | 'unknown';

/**
 * 사용자 선택 티어가 해당 provider에 속하면, 그 모델을 1순위로 폴백 체인 재구성.
 * 아니면 기본 PROVIDERS[provider].models 그대로 사용.
 */
/**
 * 🚫 v3.8.647 — 폴백을 걷어낸다. **고른 모델 하나만 쓴다.**
 *
 * 사장님: "폴백없어 실패로그띄우면서 충전을 하거나 다른 모델로하라고 안내가나와야정상이야"
 *
 * 예전에는 고른 모델이 실패하면 같은 provider 의 다른 모델로 조용히 넘어갔다.
 * 그러면 사장님은 고른 모델로 글이 써진 줄 아는데 실제로는 다른 모델이 썼다 —
 * 품질도 단가도 다르고, 무엇보다 **키가 죽은 걸 모르고 지나간다.**
 * 실패는 실패로 알리고, 충전하거나 모델을 바꾸는 판단은 사람이 한다.
 *
 * 재시도(같은 모델 N회)는 남긴다 — 일시적인 네트워크 오류까지 실패로 볼 이유는 없다.
 */
function resolveModelChain(provider: keyof typeof PROVIDERS): string[] {
  const baseModels = PROVIDERS[provider]!.models;
  const tier = findTier(process.env['PRIMARY_TEXT_MODEL']);
  if (tier && tier.provider === provider) return [tier.modelId];
  // 고른 모델이 없으면 그 provider 의 대표 모델 하나만 — 이건 폴백이 아니라 기본값이다
  return baseModels.slice(0, 1);
}

/**
 * ⏱️ v3.8.717 — **제한시간을 모델에 맞춘다.**
 *
 * 사장님 실측(2026-09-11): `timeout of 90000ms exceeded` 로 발행이 두 번 다 실패.
 * 90초는 추론 모델이 한국어 장문을 끝내기에 짧다 — OpenAI 가 붐비는 시간대면 더 그렇다.
 * 빠른 모델까지 같이 늘리면 진짜 장애일 때 사용자가 4분을 기다리므로, **느린 모델만** 늘린다.
 *
 * 제한시간은 "여기까지 기다린다"이지 "여기까지 쓴다"가 아니다 — 늘려도 비용은 그대로다.
 * 잘려서 다시 만드는 쪽이 비싸다.
 */
const SLOW_REASONING_MODEL = /astra|sol\b|^o\d|fable|opus/i;
const SLOW_MODEL_TIMEOUT_MS = 240_000;

function resolveCallTimeout(config: LLMProviderConfig, model: string): number {
  const override = Number(process.env['LLM_TIMEOUT_MS'] || '');
  if (Number.isFinite(override) && override >= 10_000) return Math.floor(override);
  return SLOW_REASONING_MODEL.test(model) ? Math.max(config.timeout, SLOW_MODEL_TIMEOUT_MS) : config.timeout;
}

/**
 * 🐢→🐇 v3.8.717 — **시간초과일 때만** 같은 회사의 빠른 모델로 한 번 내려간다.
 *
 * 사장님: "제한시간에 맞춰 늘려주고 2번도 같이해"
 *
 * v3.8.647 이 폴백을 걷어낸 이유는 살아 있다 — 키가 죽은 걸 모르고 지나가면 안 된다.
 * 그래서 **인증·결제·쿼터·레이트리밋은 그대로 즉시 실패**시키고, 시간초과 하나만 예외로 둔다.
 * 시간초과는 키 문제가 아니라 "이 모델이 이 시간엔 느리다"는 뜻이라, 사람이 할 판단이 없다.
 *
 * 두 가지를 지킨다:
 *   · **다른 회사로는 절대 안 넘어간다** — 고른 엔진 안에서만 움직인다
 *   · 한 번만 내려간다. 그리고 로그·장부에 어느 모델이 실제로 썼는지 남긴다(조용한 대체 금지)
 */
const FASTER_SIBLING: Record<string, Record<string, string>> = {
  openai: {
    'gpt-6-astra': 'gpt-5.6-luna',
    'gpt-5.6-sol': 'gpt-5.6-luna',
    'gpt-5.6-terra': 'gpt-5.6-luna',
  },
  claude: {
    'claude-fable-5': 'claude-sonnet-5',
    'claude-fable-5-1': 'claude-sonnet-5',
    'claude-opus-5': 'claude-sonnet-5',
  },
  perplexity: {
    'sonar-pro': 'sonar',
  },
};

function fasterSiblingOf(provider: string, model: string): string | null {
  return FASTER_SIBLING[provider]?.[model] || null;
}

/** 대체가 일어났다는 사실을 남긴다 — 장부와 로그가 모르면 그게 '조용한 대체'다 */
function recordDowngrade(provider: string, from: string, to: string): void {
  try {
    const g: any = globalThis as any;
    if (!g.__llmDowngrades) g.__llmDowngrades = [];
    g.__llmDowngrades.push({ provider, from, to, at: Date.now() });
  } catch { /* 기록 실패가 생성을 막지 않는다 */ }
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data: any = error.response?.data;
    const providerMessage = data?.error?.message || data?.error?.type || data?.message;
    const status = error.response?.status ? `HTTP ${error.response.status}` : '';
    return [status, providerMessage, error.message].filter(Boolean).join(' | ');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function classifyProviderFailure(config: LLMProviderConfig, error: unknown): ProviderFailureKind {
  const msg = extractErrorMessage(error).toLowerCase();
  const status = error instanceof AxiosError ? error.response?.status : undefined;

  // v3.8.528 — 잔액 소진을 HTTP 401 로 돌려주는 provider 가 있다 (Perplexity 실측 2026-08-19:
  //   401 + "You exceeded your current quota, please check your plan and billing details").
  //   401 이라고 무조건 auth 로 읽으면 "키가 만료됐다"는 오진이 나가고,
  //   사용자는 멀쩡한 키를 재발급한다 — 진짜 처방은 충전이다.
  //   메시지에 쿼터·결제 신호가 있으면 상태코드보다 그쪽을 먼저 믿는다.
  if (/quota|insufficient_quota|resource_exhausted|credits?|exceeded.*current|exceeded.*limit/i.test(msg)) return 'quota';
  if (/billing|payment|paid plan|pay-as-you-go|billing account|project.*billing|disabled billing/i.test(msg)) return 'billing';
  if (config.authErrorPattern.test(msg) || status === 401 || status === 403) return 'auth';
  if (config.rateLimitPattern.test(msg) || status === 429) return 'rate_limit';
  if (/model.*not.*found|invalid.*model|does not exist|unsupported model|404/i.test(msg)) return 'model';
  if (/timeout|timed out|time out|abort|deadline/i.test(msg)) return 'timeout';
  if (/network|econnreset|enotfound|etimedout|socket|dns|connection/i.test(msg)) return 'network';
  if (/empty response|empty text|빈 응답/i.test(msg)) return 'empty';
  return 'unknown';
}

function shouldStopModelChain(kind: ProviderFailureKind): boolean {
  return kind === 'auth' ||
    kind === 'billing' ||
    kind === 'quota' ||
    kind === 'rate_limit';
}

function buildProviderError(
  config: LLMProviderConfig,
  kind: ProviderFailureKind,
  model: string,
  attempts: number,
  rawMessage: string,
): Error {
  const detail = rawMessage.replace(/\s+/g, ' ').slice(0, 260);
  const guide: Record<ProviderFailureKind, string> = {
    auth: 'API 키가 만료되었거나 해당 프로젝트/조직에서 사용할 권한이 없습니다.',
    billing: '결제 연결 또는 유료 플랜/프로젝트 연결 상태를 확인해야 합니다.',
    quota: '결제 잔액이 있어도 분당/일일/토큰 한도 또는 프로젝트 쿼터에 걸릴 수 있습니다.',
    rate_limit: '짧은 시간에 요청이 몰렸습니다. 앱이 자동 대기 후 재시도했지만 provider 제한이 계속 반환되었습니다.',
    model: '현재 선택된 모델을 사용할 수 없습니다. 같은 provider의 다른 모델로 변경해 주세요.',
    timeout: '응답 시간이 제한을 넘었습니다(같은 엔진의 빠른 모델로 한 번 더 시도한 뒤에도 실패). provider 가 붐비는 시간일 수 있습니다 — 잠시 후 다시 시도하거나 글 길이를 줄여 보세요.',
    network: '네트워크, VPN, 방화벽 또는 provider 일시 장애를 확인해 주세요.',
    empty: 'provider가 빈 응답을 반환했습니다.',
    unknown: 'provider에서 분류되지 않은 오류가 반환되었습니다.',
  };

  return new Error(
    `${config.name} 엔진 호출 실패 (${attempts}회 시도, model=${model})\n` +
    `원인: ${guide[kind]}\n` +
    `세부: ${detail}`
  );
}

// ─── 통합 호출 함수 ─────────────────────────────
export async function callLLM(
  provider: keyof typeof PROVIDERS,
  prompt: string
): Promise<string> {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }

  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(`${config.name} API 키가 설정되지 않았습니다.`);
  }

  let lastError: Error | null = null;
  const modelChain = resolveModelChain(provider);
  const maxRetries = getTextProviderMaxRetries(config.provider);
  let totalAttempts = 0;

  // v3.8.536: 중지 버튼 즉시 반응 — 진행 중 HTTP 를 실제로 끊는다 (탈출 + 과금 중단).
  //   취소 모듈을 못 불러와도 호출은 정상 동작해야 한다.
  let cancelToken: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cancelToken = require('../cancel-token');
  } catch { /* 취소 기능 없이 진행 */ }
  const cancelSignal: AbortSignal | undefined = cancelToken?.getCancelSignal?.() || undefined;

  /**
   * v3.8.717 — 체인을 **큐**로 든다. 시간초과일 때 같은 회사의 빠른 모델을 뒤에 한 번 붙이기 위해서다.
   * 붙이지 않으면 예전과 똑같이 고른 모델 하나만 돈다.
   */
  const queue = [...modelChain];
  const tried = new Set<string>();
  let downgraded = false;

  while (queue.length > 0) {
    const model = queue.shift()!;
    tried.add(model);
    let lastKind: ProviderFailureKind | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      totalAttempts++;
      try {
        await waitForTextProviderTurn(config.provider, `${config.name}/${model}`);
        const callTimeout = resolveCallTimeout(config, model);
        console.log(`[LLM] ${config.name} ${model} attempt ${attempt + 1}/${maxRetries} (제한 ${Math.round(callTimeout / 1000)}초)`);
        const response = await axios.post(
          config.endpoint,
          config.buildBody(model, prompt),
          {
            headers: config.buildHeaders(apiKey),
            timeout: callTimeout,
            // v3.8.536: 중지 순간 요청 자체가 끊긴다 (신호 없으면 undefined — 평소와 동일)
            ...(cancelSignal ? { signal: cancelSignal } : {}),
          }
        );

        /**
         * 💰 v3.8.650 — 토큰 사용량을 기록한다.
         *
         * 사장님: "한편당 얼마니 10편하면 5달러면 충분해?"
         * 그동안 한 편에 얼마인지 **아무도 몰랐다.** provider 응답에 usage 가
         * 들어오는데 그냥 버리고 있었다. 여기서 모아 두면 발행 한 편의 실제 비용을
         * 추측이 아니라 숫자로 말할 수 있다.
         */
        try {
          const usage: any = (response.data as any)?.usage;
          if (usage) {
            const g: any = globalThis as any;
            if (!g.__llmUsage) g.__llmUsage = { calls: 0, input: 0, output: 0, byModel: {} };
            const inTok = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0) || 0;
            const outTok = Number(usage.completion_tokens ?? usage.output_tokens ?? 0) || 0;
            g.__llmUsage.calls += 1;
            g.__llmUsage.input += inTok;
            g.__llmUsage.output += outTok;
            const key = `${config.provider}/${model}`;
            const slot = g.__llmUsage.byModel[key] || { calls: 0, input: 0, output: 0 };
            slot.calls += 1; slot.input += inTok; slot.output += outTok;
            g.__llmUsage.byModel[key] = slot;
          }
        } catch { /* 기록 실패가 생성을 막지 않는다 */ }

        const text = config.extractText(response.data);
        if (text) {
          return text;
        }
        throw new Error('빈 응답');
      } catch (error: unknown) {
        // v3.8.536: 사용자 중지는 실패가 아니다 — 재시도·모델 체인 없이 즉시 위로 던진다.
        //   axios 는 abort 시 code='ERR_CANCELED' 로 거절한다.
        if (cancelToken && ((error as any)?.code === 'ERR_CANCELED' || cancelToken.isCancellation?.(error) || cancelToken.isCanceled?.())) {
          throw new cancelToken.CanceledError(`${config.name} 호출 중`);
        }
        /**
         * 실패한 호출도 **입력 토큰은 이미 썼다** (v3.8.650).
         * 세지 않으면 "편당 얼마" 가 실제보다 싸 보인다 — 실측 2026-09-05 에
         * 10편 중 4편이 엔진 문제로 죽었는데 그 비용이 장부에서 빠져 있었다.
         * 응답이 없어 정확한 토큰 수를 모르므로, 프롬프트 길이로 어림한다.
         */
        try {
          const g: any = globalThis as any;
          if (!g.__llmUsage) g.__llmUsage = { calls: 0, input: 0, output: 0, failedCalls: 0, byModel: {} };
          g.__llmUsage.failedCalls = (g.__llmUsage.failedCalls || 0) + 1;
          g.__llmUsage.input += Math.ceil(String(prompt || '').length / 2);   // 한글 대략 2자당 1토큰
        } catch { /* 기록 실패가 오류 처리를 막지 않는다 */ }

        const errorMsg = extractErrorMessage(error);
        const kind = classifyProviderFailure(config, error);
        lastKind = kind;
        lastError = buildProviderError(config, kind, model, totalAttempts, errorMsg);

        console.warn(`[LLM] ${config.name} ${model} 실패 (${kind}): ${errorMsg.slice(0, 140)}`);

        if (kind === 'rate_limit' && attempt < maxRetries - 1) {
          await waitAfterProviderRateLimit(config.provider, error, attempt, `${config.name}/${model}`);
          continue;
        }

        if (kind === 'timeout' || kind === 'network') {
          if (attempt < maxRetries - 1) {
            await waitAfterProviderBackoff(config.provider, error, attempt, `${config.name}/${model} transient`, `${kind} 재시도`);
            continue;
          }
        }

        // 인증/결제/쿼터/레이트리밋은 모델을 바꿔도 같은 계정 한도라서 즉시 중단한다.
        if (shouldStopModelChain(kind)) {
          throw lastError;
        }

        break;
      }
    }

    /**
     * v3.8.717 — 재시도를 다 쓰고도 **시간초과**로 끝났으면, 같은 회사의 빠른 모델로 한 번만 내려간다.
     * 시간초과 외의 실패(모델 없음·빈 응답 등)는 예전 그대로 여기서 끝난다.
     */
    if (lastKind === 'timeout' && !downgraded) {
      const faster = fasterSiblingOf(provider as string, model);
      if (faster && !tried.has(faster)) {
        downgraded = true;
        recordDowngrade(provider as string, model, faster);
        const note = `⏱️ ${config.name} ${model} 이(가) 제한시간을 넘겼습니다 → 같은 엔진의 빠른 모델 ${faster} 로 한 번 더 시도합니다 (다른 엔진으로 넘어가지 않습니다).`;
        console.warn(`[LLM] ${note}`);
        queue.push(faster);
      }
    }
  }

  throw lastError || new Error(`모든 ${config.name} 모델 호출 실패`);
}

// ─── 하위호환 ────────────────────────────────────
export const callPerplexityAPI = (prompt: string) => callLLM('perplexity', prompt);
export const callOpenAIAPI = (prompt: string) => callLLM('openai', prompt);
export const callClaudeAPI = (prompt: string) => callLLM('claude', prompt);

// ─── Gemini 클라이언트 (Lazy init) ───────────────
let _genAI: GoogleGenerativeAI | null = null;

export function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = getApiKey('gemini');
    if (!apiKey) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}
