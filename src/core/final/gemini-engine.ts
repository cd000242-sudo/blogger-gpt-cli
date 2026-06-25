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
import { findTier, DEFAULT_TIER_VALUE } from '../llm/pricing';
import {
  waitAfterProviderRateLimit,
  waitForTextProviderTurn,
} from '../llm/provider-throttle';

const GEMINI_BASE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
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

function buildGeminiChain(): string[] {
  const tierValue = process.env['PRIMARY_TEXT_MODEL'] || DEFAULT_TIER_VALUE;
  const tier = findTier(tierValue);
  const selected = tier && tier.provider === 'gemini'
    ? unique([tier.modelId, ...tier.fallback, ...GEMINI_BASE_MODELS])
    : unique(['gemini-2.5-flash', 'gemini-2.5-flash-lite', ...GEMINI_BASE_MODELS]);

  const selectedPro = tier?.provider === 'gemini' && tier.modelId === 'gemini-2.5-pro';
  const allowProFallback = selectedPro || envFlag('GEMINI_ENABLE_PRO_FALLBACK');
  const withoutUnexpectedPro = allowProFallback
    ? selected
    : selected.filter(model => model !== 'gemini-2.5-pro');

  const limit = envInt('GEMINI_MAX_MODEL_FALLBACKS', DEFAULT_MODEL_FALLBACKS);
  return withoutUnexpectedPro.slice(0, Math.max(1, limit));
}

function getPrimaryProvider(): Provider {
  const tier = findTier(process.env['PRIMARY_TEXT_MODEL']);
  return (tier?.provider ?? 'gemini') as Provider;
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

  if (/api key.*(not valid|invalid)|invalid.*api key|invalid.*key|unauthorized|authentication|401/.test(lower)) {
    return { kind: 'auth', message, status };
  }
  if (/billing|payment|paid plan|pay-as-you-go|project.*billing|billing account|disabled billing/.test(lower)) {
    return { kind: 'billing', message, status };
  }
  if (/resource_exhausted|quota|exceeded.*limit|exceeded.*current|credits?|insufficient_quota/.test(lower)) {
    return { kind: 'quota', message, status };
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
    case 'auth':
      reason = `${providerName} API 키 인증 또는 프로젝트 권한 문제가 감지되었습니다.`;
      fix = provider === 'gemini'
        ? 'Google AI Studio에서 유료/선불 결제된 프로젝트의 키가 맞는지 확인하고, 앱에 저장된 키를 다시 저장해 주세요.'
        : `${providerName} 콘솔에서 키가 활성 상태인지 확인해 주세요.`;
      break;
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
      fix = 'Flash 계열 모델을 선택하거나 본문 길이/이미지 생성 옵션을 줄여 다시 시도해 주세요.';
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
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timeout after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs);
      }),
    ]);
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

export async function callGeminiWithRetry(prompt: string, maxRetries: number = 1): Promise<string> {
  const primaryProvider = getPrimaryProvider();
  const modelValue = process.env['PRIMARY_TEXT_MODEL'] || DEFAULT_TIER_VALUE;
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
      throw buildUserError(primaryProvider, classifyFailure(error), 1);
    }

    throw buildUserError(primaryProvider, { kind: 'unknown', message: 'Provider branch did not return text' }, 1);
  }

  let genAI: ReturnType<typeof getGenAI>;
  try {
    genAI = getGenAI();
  } catch (error: any) {
    throw buildUserError('gemini', { kind: 'missing_key', message: errorToText(error) }, 0);
  }
  const geminiChain = buildGeminiChain();
  let lastInfo: FailureInfo = { kind: 'unknown', message: 'No Gemini model was called' };
  let totalAttempts = 0;

  for (const modelName of geminiChain) {
    for (let retry = 0; retry < attemptsPerModel; retry++) {
      totalAttempts++;
      try {
        await waitForTextProviderTurn('gemini', modelName);
        console.log(`[Gemini] ${modelName} attempt ${retry + 1}/${attemptsPerModel}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        // v3.8.99: maxOutputTokens 미지정 → Gemini가 기본 4096-8192 토큰으로 잘림 → 본문 짧음 (사용자 반복 보고).
        //   해결: 16,384 토큰 (한국어 약 12,000자 가능) 명시. 거미줄 v3.8.81/main.ts:1163과 동일.
        const result: any = await withTimeout(
          model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 16384, temperature: 0.8 },
          }),
          envInt('GEMINI_TIMEOUT_MS', DEFAULT_GEMINI_TIMEOUT_MS),
          modelName,
        );
        const text = result?.response?.text?.() || '';
        if (!text.trim()) throw new Error('empty text response');
        console.log(`[Gemini] ${modelName} success (${text.length} chars)`);
        return repairBrokenGeneratedText(`${modelName} response`, text);
      } catch (error: any) {
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

        // v3.8.163: 503/overloaded는 서버 측 transient — 30s/60s/90s backoff 후 같은 모델 retry
        if (info.kind === 'service_unavailable' && retry < attemptsPerModel - 1) {
          const backoff = 30000 + retry * 30000;
          console.log(`[Gemini] ${modelName} 503/overloaded — ${backoff/1000}s 대기 후 재시도`);
          await sleep(backoff);
          continue;
        }

        if (shouldStopGeminiChain(info.kind)) {
          throw buildUserError('gemini', info, totalAttempts);
        }

        break;
      }
    }
  }

  // v3.8.163: 모든 Gemini 모델 실패 → OpenAI/Claude/Perplexity 자동 fallback (다른 키 있을 때만)
  //   사용자 보고: gemini-2.5-flash-lite 503 → 큐 연속 실패. 다른 provider 자동 시도로 차단
  const fallbackOrder: Provider[] = ['openai', 'claude', 'perplexity'];
  for (const fp of fallbackOrder) {
    const fpKey = getProviderKey(fp);
    if (!fpKey) continue;
    try {
      console.log(`[Engine-Fallback] 모든 Gemini 모델 실패 → ${PROVIDER_NAMES[fp]} 자동 시도`);
      if (fp === 'openai') return repairBrokenGeneratedText('openai fallback', await callOpenAIAPI(prompt));
      if (fp === 'claude') return repairBrokenGeneratedText('claude fallback', await callClaudeAPI(prompt));
      if (fp === 'perplexity') return repairBrokenGeneratedText('perplexity fallback', await callPerplexityAPI(prompt));
    } catch (fpErr: any) {
      const fpInfo = classifyFailure(fpErr);
      console.warn(`[Engine-Fallback] ${PROVIDER_NAMES[fp]} 실패 (${fpInfo.kind}): ${fpInfo.message.slice(0, 120)}`);
    }
  }

  throw buildUserError('gemini', lastInfo, totalAttempts);
}

export async function callGeminiWithGrounding(prompt: string, maxRetries: number = 1): Promise<string> {
  const primaryProvider = getPrimaryProvider();
  if (primaryProvider !== 'gemini') {
    console.log(`[Grounding] ${primaryProvider} selected; using selected provider without Gemini Search.`);
    return callGeminiWithRetry(prompt, maxRetries);
  }

  if (envFlag('DISABLE_GEMINI_GROUNDING')) {
    return callGeminiWithRetry(prompt, maxRetries);
  }

  let genAI: ReturnType<typeof getGenAI>;
  try {
    genAI = getGenAI();
  } catch (error: any) {
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
        const result: any = await withTimeout(
          model.generateContent(prompt),
          envInt('GROUNDING_TIMEOUT_MS', DEFAULT_GROUNDING_TIMEOUT_MS),
          `${modelName} grounding`,
        );
        const text = result?.response?.text?.() || '';
        if (!text.trim()) throw new Error('empty text response');

        const metadata = result?.response?.candidates?.[0]?.groundingMetadata;
        if (metadata?.webSearchQueries?.length) {
          console.log(`[Grounding] queries: ${metadata.webSearchQueries.join(', ')}`);
        }
        if (metadata?.groundingChunks?.length) {
          console.log(`[Grounding] referenced chunks: ${metadata.groundingChunks.length}`);
        }

        console.log(`[Grounding] ${modelName} success (${text.length} chars)`);
        return repairBrokenGeneratedText(`${modelName} grounding response`, text);
      } catch (error: any) {
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

  console.log(`[Grounding] failed after ${totalAttempts} attempt(s); falling back to normal Gemini.`);
  const safePrompt = `${prompt}

IMPORTANT:
- Search grounding is unavailable for this request, so do not invent exact numbers, dates, URLs, or statistics.
- If a fact cannot be verified from the supplied context, write that the reader should confirm it on the official site.
- Keep the answer useful, but avoid unsupported claims.`;

  try {
    return await callGeminiWithRetry(safePrompt, maxRetries);
  } catch (fallbackError: any) {
    if (String(fallbackError?.message || '').includes('원인:')) {
      throw fallbackError;
    }
    const fallbackInfo = classifyFailure(fallbackError);
    const finalInfo = fallbackInfo.kind === 'unknown' ? lastInfo : fallbackInfo;
    throw buildUserError('gemini', finalInfo, totalAttempts + 1, 'Grounding 실패 후 일반 호출');
  }
}
