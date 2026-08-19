/**
 * Stable text-engine dispatcher for LEADERNAM Orbit.
 *
 * Goals:
 * - Do not burn six or more Gemini calls when the key/project/quota is already broken.
 * - Keep the selected engine deterministic: Gemini only falls back to Gemini models.
 * - Use Search Grounding only where the caller explicitly asks for it.
 * - Return Korean, actionable errors that help the user fix the real cause.
 */

import {
  getGenAI, getOpenAIApiKey, getClaudeApiKey, getPerplexityApiKey,
  callOpenAIAPI, callClaudeAPI, callPerplexityAPI,
} from '../llm';
import { findTier, DEFAULT_TIER_VALUE, resolveDefaultTierValue, resolveDefaultProvider } from '../llm/pricing';
import {
  waitAfterProviderRateLimit,
  waitForTextProviderTurn,
} from '../llm/provider-throttle';

/**
 * v3.8.483 — 3.6 Flash 도입, 3.1 Pro Preview 제거.
 *   Preview 모델은 선불 티어에서 호출이 막힌다(사용자 실측). 폴백 체인에 두면
 *   조용히 실패하고 다음 모델로 내려가느라 시간만 버린다.
 *   최신순으로 둔다 — 앞이 먼저 시도된다.
 */
const GEMINI_BASE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

export const GEMINI_MODELS = GEMINI_BASE_MODELS;
export const GROUNDING_MODELS = GEMINI_BASE_MODELS;

const DEFAULT_GEMINI_TIMEOUT_MS = 60_000;
const DEFAULT_GROUNDING_TIMEOUT_MS = 75_000;
const DEFAULT_MODEL_FALLBACKS = 2;
const DEFAULT_GROUNDING_FALLBACKS = 1;
const TIMEOUT_BACKOFF_MS = 2_000;

type Provider = 'gemini' | 'openai' | 'claude' | 'perplexity';
type FailureKind =
  | 'missing_key'
  | 'auth'
  | 'billing'
  | 'quota'
  | 'rate_limit'
  | 'timeout'
  | 'safety'
  | 'model'
  | 'network'
  | 'empty'
  | 'service_unavailable'
  | 'unknown';

interface FailureInfo {
  kind: FailureKind;
  message: string;
  status?: number | undefined;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  claude: 'Claude',
  perplexity: 'Perplexity',
};

const BILLING_URLS: Record<Provider, string> = {
  gemini: 'https://aistudio.google.com/plan_billing',
  openai: 'https://platform.openai.com/settings/organization/billing',
  claude: 'https://console.anthropic.com/settings/billing',
  perplexity: 'https://www.perplexity.ai/settings/api',
};

const LLM_BROKEN_TEXT_PATTERN = /\uFFFD|&#(?:65533|xfffd);|%EF%BF%BD/gi;

function envFlag(name: string): boolean {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || '').trim());
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item || seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}

/**
 * 출력 토큰 상한 — **모든 Gemini 호출 경로가 이 하나를 쓴다.**
 *
 * v3.8.432 에서 상한을 올렸지만 callGeminiWithRetry 한쪽에만 넣었고, 정작
 * 본문 생성이 타는 grounding 경로에는 안 걸려 있었다(그쪽은 generationConfig
 * 자체가 없었다). "고쳤는데 실제 경로엔 안 닿는" 사고를 막으려고 함수로 뺀다.
 *
 * 실사용량만큼 과금되므로 상한을 올린다고 비용이 늘지 않는다.
 */
export function resolveMaxOutputTokens(): number {
  return envInt('GEMINI_MAX_OUTPUT_TOKENS', 32768);
}

/**
 * 본문(섹션)급 호출의 응답 대기 상한 (v3.8.536)
 *
 * 실사고(2026-08-19): 본문 통짜 JSON(최대 32,768토큰 ≈ 한국어 12,000자)을
 * 제목과 같은 60초 상한으로 기다리다 "gemini-3.5-flash timeout after 60s"
 * 2회 시도 후 발행이 통째로 실패했다. 서버가 조금만 느린 날이면 반복된다.
 *
 * 제목·FAQ 같은 짧은 호출은 60초를 유지한다 — 죽은 서버에서 호출마다
 * 3분씩 기다리는 낭비를 막기 위해, 긴 예산은 본문급 호출에만 준다.
 */
export function resolveSectionTimeoutMs(): number {
  return envInt('GEMINI_SECTION_TIMEOUT_MS', 180_000);
}

function getGeminiTemperature(prompt: string): number {
  return /\[FACT EVIDENCE|FACT INTEGRITY|Verified source URLs|grounding response/i.test(prompt) ? 0.28 : 0.52;
}

export function extractGroundingSourceUrls(metadata: unknown): string[] {
  const chunks = (metadata as { groundingChunks?: Array<{ web?: { uri?: unknown; url?: unknown } }> } | null)
    ?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  return unique(chunks
    .map((chunk) => chunk?.web?.uri ?? chunk?.web?.url)
    .filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)));
}

function notifyGroundingEvidence(listener: ((sourceUrls: string[]) => void) | undefined, sourceUrls: string[]): void {
  try {
    listener?.(sourceUrls);
  } catch {
    // Evidence reporting must never interrupt generation.
  }
}

function buildGeminiChain(): string[] {
  const tierValue = process.env['PRIMARY_TEXT_MODEL'] || resolveDefaultTierValue();
  const tier = findTier(tierValue);
  const selected = tier && tier.provider === 'gemini'
    ? unique([tier.modelId, ...tier.fallback, ...GEMINI_BASE_MODELS])
    : unique(['gemini-3.6-flash', 'gemini-3.5-flash', ...GEMINI_BASE_MODELS]);

  /**
   * v3.8.483 — Preview 모델을 폴백 체인에서 걷어낸다.
   *   3.1 Pro Preview 는 선불 티어에서 호출이 막혀(사용자 실측) 시도해봐야
   *   실패만 하고 시간을 버린다. 사용자가 env 로 명시할 때만 남긴다.
   *   (예전엔 티어에서 Pro 를 고른 경우를 허용했는데, 그 티어 자체를 없앴다.)
   */
  const allowPreview = envFlag('GEMINI_ENABLE_PRO_FALLBACK');
  const withoutPreview = allowPreview
    ? selected
    : selected.filter(model => !/preview/i.test(model));

  const limit = envInt('GEMINI_MAX_MODEL_FALLBACKS', DEFAULT_MODEL_FALLBACKS);
  return withoutPreview.slice(0, Math.max(1, limit));
}

/**
 * v3.8.412 — 모르는 모델 값이면 조용히 Gemini 로 떨어지지 않는다.
 *
 * 사용자 지적: "제목은 왜 제미나이니?? 선택한 AI 모델로 생성해줘야 되잖아"
 *   실제로는 선택한 모델로 가고 있었다(함수 이름이 오해를 샀다).
 *   다만 확인하다 진짜 위험을 찾았다 —
 *   findTier 가 못 찾으면 아무 말 없이 'gemini' 를 쓴다.
 *   모델 목록이 바뀌거나 값에 오타가 나면
 *   **선택한 모델과 다른 모델로 글이 써지는데 아무도 모르는** 상태가 된다.
 *   조용한 실패는 이 프로젝트에서 이미 여러 번 사고를 냈다. 반드시 알린다.
 */
function getPrimaryProvider(): Provider {
  const raw = process.env['PRIMARY_TEXT_MODEL'];
  const tier = findTier(raw);
  if (raw && !tier) {
    console.warn(
      `[Engine] ⚠️ 등록되지 않은 모델 값 "${raw}" — Gemini 로 대체합니다.`
      + ' 선택한 모델과 다른 모델로 글이 써집니다. 모델 목록(pricing.ts)을 확인하세요.',
    );
  }
  // v3.8.446: 모델이 안 정해졌으면 설정(AI_PROVIDER)을 따른다 — 예전엔 무조건 gemini 였다
  return (tier?.provider ?? resolveDefaultProvider()) as Provider;
}

function errorToText(error: any): string {
  const parts = [
    error?.message,
    error?.statusText,
    error?.code,
    error?.response?.statusText,
    error?.response?.data?.error?.message,
    error?.error?.message,
  ].filter(Boolean).map(String);

  try {
    if (error?.response?.data && typeof error.response.data !== 'string') {
      parts.push(JSON.stringify(error.response.data));
    } else if (error?.response?.data) {
      parts.push(String(error.response.data));
    }
  } catch {
    // ignore JSON inspection errors
  }

  return parts.join(' | ') || String(error || 'Unknown error');
}

function getStatus(error: any): number | undefined {
  const status = Number(error?.status ?? error?.response?.status ?? error?.cause?.status);
  return Number.isFinite(status) ? status : undefined;
}

function classifyFailure(error: any): FailureInfo {
  const message = errorToText(error);
  const lower = message.toLowerCase();
  const status = getStatus(error);

  /**
   * v3.8.502 — 차단된 키(유출 신고)가 미분류로 새던 구멍.
   *
   * 실사용 보고: 발행이 "응답 시간이 너무 길어 중단(60s×2)" 으로 실패했는데,
   * 실제 원인은 403 PERMISSION_DENIED — "Your API key was reported as leaked" 였다.
   * 이 문구가 어느 가지에도 안 걸려 재시도를 다 태우고 타임아웃으로 보고됐다.
   * auth 로 잡히면 즉시 멈추고(재시도 없음) 키 안내가 나간다 — 그게 맞는 동작이다.
   */
  // v3.8.528 — 잔액 소진이 401/403 으로 오는 provider 가 있다 (Perplexity 실측 2026-08-19:
  //   401 + "exceeded your current quota"). 상태코드보다 메시지의 쿼터·결제 신호를 먼저 믿는다.
  //   유출 차단 키(v3.8.502)는 쿼터·결제 문구가 없어 그대로 auth 로 잡힌다
  //   (gemini-leaked-key.test.ts 가 잠근다).
  if (/resource_exhausted|quota|exceeded.*limit|exceeded.*current|credits?|insufficient_quota/.test(lower)) {
    return { kind: 'quota', message, status };
  }
  if (/billing|payment|paid plan|pay-as-you-go|project.*billing|billing account|disabled billing/.test(lower)) {
    return { kind: 'billing', message, status };
  }
  if (status === 403
    || /api key.*(not valid|invalid)|invalid.*api key|invalid.*key|unauthorized|authentication|401|permission[_\s-]?denied|reported as leaked|use another api key/.test(lower)) {
    return { kind: 'auth', message, status };
  }
  if (/429|too many requests|rate.*limit|rate_limit|rpm|requests per minute|temporarily overloaded/.test(lower)) {
    return { kind: 'rate_limit', message, status };
  }
  if (/timeout|timed out|time out|aborterror|aborted/.test(lower)) {
    return { kind: 'timeout', message, status };
  }
  if (/safety|blocked|finishreason.*safety|prompt was blocked/.test(lower)) {
    return { kind: 'safety', message, status };
  }
  if (/model.*not found|not found|404|not supported|unsupported model/.test(lower)) {
    return { kind: 'model', message, status };
  }
  // v3.8.163: 503/overloaded는 transient — retry + 모델 폴백 + provider 폴백으로 처리
  if (status === 503 || /503|service unavailable|overloaded|high demand|currently experiencing|temporarily unavailable|bad gateway|502|504/.test(lower)) {
    return { kind: 'service_unavailable', message, status };
  }
  if (/fetch failed|network|econnreset|enotfound|etimedout|socket|dns|connection/.test(lower)) {
    return { kind: 'network', message, status };
  }
  if (/empty response|empty text|no text/.test(lower)) {
    return { kind: 'empty', message, status };
  }
  if (status === 403) {
    return { kind: 'auth', message, status };
  }

  return { kind: 'unknown', message, status };
}

function shouldStopGeminiChain(kind: FailureKind): boolean {
  return kind === 'missing_key' ||
    kind === 'auth' ||
    kind === 'billing' ||
    kind === 'quota' ||
    kind === 'rate_limit' ||
    kind === 'safety';
}

function buildUserError(provider: Provider, info: FailureInfo, attempts: number, context?: string): Error {
  const providerName = PROVIDER_NAMES[provider] || provider;
  const prefix = context ? `${providerName} 호출 실패 (${context})` : `${providerName} 엔진 호출 실패`;
  const detail = info.message.replace(/\s+/g, ' ').slice(0, 260);

  let reason: string;
  let fix: string;
  let marker = '';

  switch (info.kind) {
    case 'missing_key':
      reason = `${providerName} API 키가 저장되어 있지 않습니다.`;
      fix = '환경 설정에서 API 키를 저장한 뒤 다시 시도해 주세요.';
      break;
    case 'auth': {
      // 유출 신고로 차단된 키는 충전(결제)으로 안 풀린다 — 새 키 발급이 유일한 해결이다
      const leaked = /reported as leaked|use another api key/i.test(info.message);
      reason = leaked
        ? `${providerName} API 키가 유출 신고로 차단되어 있습니다. 결제를 충전해도 이 키로는 호출이 되지 않습니다.`
        : `${providerName} API 키 인증 또는 프로젝트 권한 문제가 감지되었습니다.`;
      fix = provider === 'gemini'
        ? (leaked
          ? 'Google AI Studio(aistudio.google.com/apikey)에서 새 API 키를 만들어 환경설정에 저장해 주세요. 충전한 잔액은 프로젝트에 남아 있어 새 키로 그대로 쓰입니다.'
          : 'Google AI Studio에서 유료/선불 결제된 프로젝트의 키가 맞는지 확인하고, 앱에 저장된 키를 다시 저장해 주세요.')
        : `${providerName} 콘솔에서 키가 활성 상태인지 확인해 주세요.`;
      break;
    }
    case 'billing':
      reason = `${providerName} 결제 또는 프로젝트 연결 문제가 감지되었습니다.`;
      fix = `${BILLING_URLS[provider]} 에서 결제 연결과 프로젝트를 확인해 주세요.`;
      marker = `\n[BILLING:${provider}]`;
      break;
    case 'quota':
      reason = `${providerName} API 쿼터 또는 사용량 제한에 걸렸습니다.`;
      fix = provider === 'gemini'
        ? '유료 1티어/Prepay 잔액이 있어도 분당 제한, Grounding/Search 제한, 프로젝트/API 키 불일치가 있으면 발생할 수 있습니다. 현재 앱에 저장된 키가 결제된 Google AI Studio 프로젝트 키인지와 해당 모델 쿼터를 확인해 주세요.'
        : '결제 잔액, 분당 요청 제한, 일일 사용량 제한을 확인해 주세요.';
      marker = `\n[BILLING:${provider}]`;
      break;
    case 'rate_limit':
      reason = `${providerName} 요청이 짧은 시간에 몰려 속도 제한에 걸렸습니다.`;
      fix = provider === 'gemini'
        ? '앱이 provider 공통 큐로 자동 대기 후 재시도했지만 Google 프로젝트 RPM/Search Grounding 제한이 계속 반환되었습니다. 1~3분 뒤 다시 시도하거나 연속 발행 간격을 늘리고, 같은 프로젝트 키로 다른 작업이 동시에 돌고 있지 않은지 확인해 주세요.'
        : '앱이 provider 공통 큐로 자동 대기 후 재시도했지만 속도 제한이 계속 반환되었습니다. 1~3분 뒤 다시 시도하거나 연속 발행 간격을 늘려 주세요.';
      break;
    case 'timeout':
      reason = `${providerName} 응답 시간이 너무 길어 중단되었습니다.`;
      // v3.8.536: "Flash 를 선택하라"는 처방은 이미 Flash 에서도 나는 오류라 헛짚었다 (실보고)
      fix = '서버 혼잡일 수 있습니다 — 잠시 후 그대로 다시 시도해 주세요. 반복되면 이미지 생성 옵션이나 섹션 수를 줄여 보세요.';
      break;
    case 'safety':
      reason = `${providerName} 안전 정책으로 프롬프트 또는 응답이 차단되었습니다.`;
      fix = '키워드와 원문에 민감한 표현이 있는지 확인하고 문구를 순화해 주세요.';
      break;
    case 'model':
      reason = `${providerName} 모델을 사용할 수 없습니다.`;
      fix = '환경 설정에서 Gemini 2.5 Flash 또는 Flash-Lite를 선택해 주세요.';
      break;
    case 'network':
      reason = `${providerName} 서버에 연결하지 못했습니다.`;
      fix = '인터넷 연결, VPN/방화벽, 회사망 보안 프로그램을 확인해 주세요.';
      break;
    case 'empty':
      reason = `${providerName} 응답이 비어 있습니다.`;
      fix = '잠시 뒤 다시 시도해 주세요.';
      break;
    default:
      reason = `${providerName}에서 알 수 없는 오류가 발생했습니다.`;
      fix = '다른 텍스트 엔진을 선택하거나 API 키 상태를 확인해 주세요.';
      break;
  }

  return new Error(
    `${prefix} (${attempts}회 시도)\n` +
    `원인: ${reason}\n` +
    `해결: ${fix}\n` +
    `세부: ${detail}${marker}`
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const contenders: Array<Promise<T>> = [
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      }),
    ];
    /**
     * v3.8.536 — 중지 버튼 즉시 반응.
     *   기존 취소는 "다음 단계 시작 전" 검문소 방식이라, 이미 굴러가는 60~180초
     *   호출 중간에는 중지가 안 먹었다 (사장님: "칼같이 바로 중지되게 못하니").
     *   여기(모든 Gemini 대기의 공통 관문)에 취소 레이스를 끼우면
     *   버튼을 누르는 순간 진행 중 호출에서 즉시 탈출한다.
     *   중지 기능을 못 불러와도 생성은 계속돼야 한다 — 조용히 건너뛴다.
     */
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const cancelToken = require('../cancel-token');
      if (typeof cancelToken.cancelRace === 'function') contenders.push(cancelToken.cancelRace(label));
    } catch { /* 취소 모듈 없음 — 생성은 계속 */ }
    return await Promise.race(contenders);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function repairBrokenGeneratedText(label: string, text: string): string {
  const matches = text.match(LLM_BROKEN_TEXT_PATTERN);
  if (!matches || matches.length === 0) return text;

  const repaired = text
    .replace(LLM_BROKEN_TEXT_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  console.warn(`[TEXT-REPAIR] ${label}: removed ${matches.length} broken replacement marker(s).`);
  return repaired;
}

function getProviderKey(provider: Provider): string {
  if (provider === 'openai') return getOpenAIApiKey();
  if (provider === 'claude') return getClaudeApiKey();
  if (provider === 'perplexity') return getPerplexityApiKey();
  return '';
}

export async function callGeminiWithRetry(prompt: string, maxRetries: number = 1, opts?: { timeoutMs?: number }): Promise<string> {
  const primaryProvider = getPrimaryProvider();
  const modelValue = process.env['PRIMARY_TEXT_MODEL'] || resolveDefaultTierValue();
  const tier = findTier(modelValue);
  const providerName = PROVIDER_NAMES[primaryProvider] || primaryProvider;
  const attemptsPerModel = Math.max(1, Math.floor(maxRetries || 1));

  if (primaryProvider !== 'gemini') {
    const apiKey = getProviderKey(primaryProvider);
    if (!apiKey) {
      throw buildUserError(primaryProvider, { kind: 'missing_key', message: 'API key is empty' }, 0);
    }

    try {
      console.log(`[Engine] ${providerName} (${tier?.modelId || modelValue}) call`);
      if (primaryProvider === 'openai') {
        return repairBrokenGeneratedText(`${providerName} response`, await callOpenAIAPI(prompt));
      }
      if (primaryProvider === 'claude') {
        return repairBrokenGeneratedText(`${providerName} response`, await callClaudeAPI(prompt));
      }
      if (primaryProvider === 'perplexity') {
        return repairBrokenGeneratedText(`${providerName} response`, await callPerplexityAPI(prompt));
      }
    } catch (error: any) {
    if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
      if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 실패 분류·재시도 없이 즉시 위로
      throw buildUserError(primaryProvider, classifyFailure(error), 1);
    }

    throw buildUserError(primaryProvider, { kind: 'unknown', message: 'Provider branch did not return text' }, 1);
  }

  let genAI: ReturnType<typeof getGenAI>;
  try {
    genAI = getGenAI();
  } catch (error: any) {
    if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
    throw buildUserError('gemini', { kind: 'missing_key', message: errorToText(error) }, 0);
  }
  const geminiChain = buildGeminiChain();
  let lastInfo: FailureInfo = { kind: 'unknown', message: 'No Gemini model was called' };
  let totalAttempts = 0;

  // v3.8.379(R4): 요청 단위 누적 재시도 마감 — "이 요청은 최대 N분"의 절대 상한.
  //   개별 카운터가 어떤 버그로 다시 깨져도 함수가 유한 시간 안에 반드시 반환하게 한다
  //   (미반환 = orchestration의 finally가 실행되지 않아 engineLock 영구 점유 = 그날 0편).
  //   env GEMINI_RETRY_DEADLINE_MS 로 조정, '0'이면 마감 비활성(킬스위치 — 이전 동작 복원).
  const deadlineEnvRaw = process.env['GEMINI_RETRY_DEADLINE_MS'];
  const retryDeadlineMs = deadlineEnvRaw === '0' ? 0 : envInt('GEMINI_RETRY_DEADLINE_MS', 20 * 60_000);
  const retryDeadlineAt = retryDeadlineMs > 0 ? Date.now() + retryDeadlineMs : 0;
  let deadlineExceeded = false;

  for (const modelName of geminiChain) {
    // v3.8.379(R4): 503 백오프 카운터를 실제 변수로 승격 (모델별 리셋).
    //   기존 __svcRetry는 catch 진입마다 `lastInfo = info`가 먼저 덮어써 항상 0으로 읽혔고,
    //   retry-- 와 결합해 "2분 대기"를 영원히 반복했다 (gemini-engine-503-loop.test.ts로 재현).
    let svcRetryCount = 0;
    for (let retry = 0; retry < attemptsPerModel; retry++) {
      if (retryDeadlineAt && Date.now() > retryDeadlineAt) { deadlineExceeded = true; break; }
      totalAttempts++;
      try {
        await waitForTextProviderTurn('gemini', modelName);
        console.log(`[Gemini] ${modelName} attempt ${retry + 1}/${attemptsPerModel}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        // v3.8.99: maxOutputTokens 미지정 → Gemini가 기본 4096-8192 토큰으로 잘림 → 본문 짧음 (사용자 반복 보고).
        //   해결: 16,384 토큰 (한국어 약 12,000자 가능) 명시. 거미줄 v3.8.81/main.ts:1163과 동일.
        //
        // v3.8.432 — 16,384 로는 부족한 경우가 있다.
        //   사용자 실측(2026-08-03 쇼핑 발행글): H2 7개 × H3 각 1~2개 구성인데
        //   "3-1. 용도별 비교 기준", "6-1. 장바구니 가격 확인" 두 곳의 본문이 통째로 비었다.
        //   본문 생성은 전 섹션을 **한 번의 JSON 응답**으로 받는다. H3 하나에 600자 이상을
        //   요구하므로 7×2×600 = 8,400자에 HTML 태그·표·JSON 이스케이프가 더해지고,
        //   한국어는 글자당 토큰이 커서 16,384 를 넘긴다. 넘긴 응답은 잘리고, 잘린 JSON 을
        //   복구하는 과정에서 뒷부분 content 가 빈 채로 살아남는다.
        //   → 상한을 올린다. 실제 사용량만큼만 과금되므로 상한을 올린다고 비용이 늘지 않는다.
        //   v3.8.433: grounding 경로와 **같은 함수**를 쓴다 (한쪽만 올리는 실수 방지).
        const result: any = await withTimeout(
          model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: resolveMaxOutputTokens(), temperature: getGeminiTemperature(prompt) },
          }),
          opts?.timeoutMs ?? envInt('GEMINI_TIMEOUT_MS', DEFAULT_GEMINI_TIMEOUT_MS), // v3.8.536: 본문급은 호출자가 긴 예산을 준다
          modelName,
        );
        const text = result?.response?.text?.() || '';
        if (!text.trim()) throw new Error('empty text response');
        console.log(`[Gemini] ${modelName} success (${text.length} chars)`);
        return repairBrokenGeneratedText(`${modelName} response`, text);
      } catch (error: any) {
    if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
        if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
      if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 실패 분류·재시도 없이 즉시 위로
        const info = classifyFailure(error);
        lastInfo = info;
        console.warn(`[Gemini] ${modelName} failed (${info.kind}): ${info.message.slice(0, 140)}`);

        if (info.kind === 'rate_limit' && retry < attemptsPerModel - 1) {
          await waitAfterProviderRateLimit('gemini', error, retry, modelName);
          continue;
        }

        if (info.kind === 'timeout' && retry < attemptsPerModel - 1) {
          await sleep(TIMEOUT_BACKOFF_MS);
          continue;
        }

        // v3.8.165: 503/overloaded backoff 실측 데이터 기반 재조정
        //   사용자 패턴 분석: 11:16 실패 → 11:27 실패 → 11:35 성공 (회복까지 약 20분)
        //   기존 60s 첫 대기는 너무 짧아 503 회피 불가 → 2분부터 시작
        //   backoff: 2분 → 5분 → 10분 → 20분 → 30분 (5회, 총 67분 max)
        //   첫 2분은 정말 일시적 spike 회복용, 그 이후 점진적으로 길게
        if (info.kind === 'service_unavailable') {
          const backoffSchedule: number[] = [120000, 300000, 600000, 1200000, 1800000]; // 2m, 5m, 10m, 20m, 30m
          if (svcRetryCount < backoffSchedule.length) {
            const backoff: number = backoffSchedule[svcRetryCount] ?? 600000;
            // 마감을 넘길 대기는 아예 시작하지 않는다 (30분 자고 나서 마감 초과 확인하는 낭비 방지)
            if (retryDeadlineAt && Date.now() + backoff > retryDeadlineAt) {
              console.log(`[Gemini] ${modelName} 503 — 누적 재시도 마감(${Math.round(retryDeadlineMs / 60000)}분) 초과 예정, 재시도 중단`);
              deadlineExceeded = true;
              break;
            }
            const mins = Math.round(backoff / 60000);
            console.log(`[Gemini] ${modelName} 503/overloaded — ${mins}분 대기 후 재시도 (${svcRetryCount + 1}/${backoffSchedule.length})`);
            await sleep(backoff);
            svcRetryCount++;
            retry--; // 같은 retry 슬롯 재사용 (모델 폴백 안 함)
            continue;
          }
          console.log(`[Gemini] ${modelName} 503 ${backoffSchedule.length}회 시도 후 실패 → 다음 모델로`);
          // 503 retry 소진 → 다음 모델로 (chain 진행)
        }

        if (info.kind === 'rate_limit' && retry < attemptsPerModel - 1) {
          await waitAfterProviderRateLimit('gemini', error, retry, modelName);
          continue;
        }

        if (info.kind === 'timeout' && retry < attemptsPerModel - 1) {
          await sleep(TIMEOUT_BACKOFF_MS);
          continue;
        }

        if (shouldStopGeminiChain(info.kind)) {
          throw buildUserError('gemini', info, totalAttempts);
        }

        break;
      }
    }
    // v3.8.379(R4): 마감 초과 시 남은 모델 체인도 건너뛰고 즉시 종료 (유한 반환 보장)
    if (deadlineExceeded) break;
  }

  if (deadlineExceeded) {
    console.warn(`[Gemini] 누적 재시도 마감(${Math.round(retryDeadlineMs / 60000)}분) 초과 — 재시도 전면 중단 (env GEMINI_RETRY_DEADLINE_MS로 조정 가능)`);
  }

  // v3.8.164: provider auto-fallback 제거 — 사용자 선택 존중
  //   같은 provider 안에서 모델 chain (flash-lite → flash → pro) 다 시도 후도 503이면
  //   throw하여 사용자가 직접 대처 (대기 후 재시도 / 다른 엔진 선택)
  throw buildUserError('gemini', lastInfo, totalAttempts);
}

export async function callGeminiWithGrounding(
  prompt: string,
  maxRetries: number = 1,
  forceGeminiSearch: boolean = false,
  onGroundingEvidence?: (sourceUrls: string[]) => void,
  opts?: { timeoutMs?: number },
): Promise<string> {
  const primaryProvider = getPrimaryProvider();
  if (!forceGeminiSearch && primaryProvider !== 'gemini') {
    console.log(`[Grounding] ${primaryProvider} selected; using selected provider without Gemini Search.`);
    notifyGroundingEvidence(onGroundingEvidence, []);
    return callGeminiWithRetry(prompt, maxRetries);
  }

  if (envFlag('DISABLE_GEMINI_GROUNDING')) {
    if (forceGeminiSearch) {
      throw new Error('Gemini Search Grounding is disabled, so verified fact evidence cannot be collected.');
    }
    notifyGroundingEvidence(onGroundingEvidence, []);
    return callGeminiWithRetry(prompt, maxRetries);
  }

  let genAI: ReturnType<typeof getGenAI>;
  try {
    genAI = getGenAI();
  } catch (error: any) {
    if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
    throw buildUserError('gemini', { kind: 'missing_key', message: errorToText(error) }, 0, 'Grounding');
  }
  const attemptsPerModel = Math.max(1, Math.floor(maxRetries || 1));
  const groundingLimit = envInt('GEMINI_GROUNDING_MAX_MODEL_FALLBACKS', DEFAULT_GROUNDING_FALLBACKS);
  const groundingChain = buildGeminiChain().slice(0, Math.max(1, groundingLimit));
  let lastInfo: FailureInfo = { kind: 'unknown', message: 'No Gemini grounding model was called' };
  let totalAttempts = 0;

  for (const modelName of groundingChain) {
    for (let retry = 0; retry < attemptsPerModel; retry++) {
      totalAttempts++;
      try {
        await waitForTextProviderTurn('gemini', `${modelName}/grounding`);
        console.log(`[Grounding] ${modelName} + Google Search attempt ${retry + 1}/${attemptsPerModel}`);
        const is2xOrNewer = /gemini-[2-9]/.test(modelName);
        const groundingTool: any = is2xOrNewer
          ? [{ googleSearch: {} }]
          : [{ googleSearchRetrieval: {} }];
        const model = genAI.getGenerativeModel({
          model: modelName,
          tools: groundingTool,
        });
        /**
         * 🚨 v3.8.433 — 이 경로에도 출력 토큰 상한을 건다.
         *
         * v3.8.432 에서 본문 누락(빈 소제목)의 원인이 응답 잘림이라 보고
         * maxOutputTokens 를 32,768 로 올렸는데, **올린 곳이 callGeminiWithRetry
         * 뿐이었다.** 본문 생성(generateAllSectionsFinal)은 여기 grounding 경로를
         * 타는데 여기는 generationConfig 자체가 없어 Gemini 기본값(4k~8k)으로
         * 잘리고 있었다 — 고쳤다고 생각한 게 실제 경로에는 닿지 않았다.
         * 같은 실수를 또 하지 않도록 두 경로가 같은 상수를 쓰게 한다.
         */
        const result: any = await withTimeout(
          model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: resolveMaxOutputTokens() },
          }),
          opts?.timeoutMs ?? envInt('GROUNDING_TIMEOUT_MS', DEFAULT_GROUNDING_TIMEOUT_MS), // v3.8.536
          `${modelName} grounding`,
        );
        const text = result?.response?.text?.() || '';
        if (!text.trim()) throw new Error('empty text response');

        const metadata = result?.response?.candidates?.[0]?.groundingMetadata;
        const sourceUrls = extractGroundingSourceUrls(metadata);
        if (metadata?.webSearchQueries?.length) {
          console.log(`[Grounding] queries: ${metadata.webSearchQueries.join(', ')}`);
        }
        if (metadata?.groundingChunks?.length) {
          console.log(`[Grounding] referenced chunks: ${metadata.groundingChunks.length}`);
        }
        notifyGroundingEvidence(onGroundingEvidence, sourceUrls);

        console.log(`[Grounding] ${modelName} success (${text.length} chars)`);
        return repairBrokenGeneratedText(`${modelName} grounding response`, text);
      } catch (error: any) {
    if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
        if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 즉시 위로
      if (error?.canceled === true) throw error; // v3.8.536: 사용자 중지는 실패 분류·재시도 없이 즉시 위로
        const info = classifyFailure(error);
        lastInfo = info;
        console.warn(`[Grounding] ${modelName} failed (${info.kind}): ${info.message.slice(0, 140)}`);

        if (info.kind === 'rate_limit' && retry < attemptsPerModel - 1) {
          await waitAfterProviderRateLimit('gemini', error, retry, `${modelName}/grounding`);
          continue;
        }

        if (info.kind === 'timeout' && retry < attemptsPerModel - 1) {
          await sleep(TIMEOUT_BACKOFF_MS);
          continue;
        }

        if (info.kind === 'auth' || info.kind === 'billing' || info.kind === 'quota' || info.kind === 'rate_limit' || info.kind === 'safety') {
          throw buildUserError('gemini', info, totalAttempts, 'Grounding');
        }

        break;
      }
    }
  }

  if (forceGeminiSearch) {
    throw buildUserError('gemini', lastInfo, totalAttempts, 'mandatory Google Search grounding');
  }

  console.log(`[Grounding] failed after ${totalAttempts} attempt(s); falling back to normal Gemini.`);
  notifyGroundingEvidence(onGroundingEvidence, []);
  const safePrompt = `${prompt}

IMPORTANT:
- Search grounding is unavailable for this request, so do not invent exact numbers, dates, URLs, or statistics.
- v3.8.382: 확인 불가한 값이 있어도 "공식 사이트에서 확인하세요"로 문단을 끝내지 마라.
  그 문장은 독자에게 아무것도 주지 않고, 실속 게이트(substance-gate.ts)가 탈락시키는 바로 그 패턴이다.
  대신 아래를 구체적으로 써라:
  ① 판단 기준 — 어떤 조건이면 A이고 어떤 조건이면 B인지
  ② 절차 — 무엇을 어디서 어떤 순서로 (메뉴 이름·서류 이름 수준까지)
  ③ 확인 경로 — "공식 사이트"가 아니라 정확한 기관명 + 메뉴 경로 + 준비물
  ④ 흔한 실수 — 사람들이 여기서 무엇을 놓쳐 손해를 보는지
- 주어진 컨텍스트에 실제 숫자·기간·금액·기관명이 있으면 그대로 본문에 옮겨라. 요약하며 숫자를 빼지 마라.
- Keep the answer useful, but avoid unsupported claims.`;

  try {
    return await callGeminiWithRetry(safePrompt, maxRetries, opts); // v3.8.536: 본문급 예산 상속
  } catch (fallbackError: any) {
    if (String(fallbackError?.message || '').includes('원인:')) {
      throw fallbackError;
    }
    const fallbackInfo = classifyFailure(fallbackError);
    const finalInfo = fallbackInfo.kind === 'unknown' ? lastInfo : fallbackInfo;
    throw buildUserError('gemini', finalInfo, totalAttempts + 1, 'Grounding 실패 후 일반 호출');
  }
}
