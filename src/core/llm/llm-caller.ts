/**
 * 통합 LLM 호출 엔진
 * 3개 중복 함수(callPerplexityAPI, callOpenAIAPI, callClaudeAPI)를 1개로 통합
 */

import axios, { AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './api-keys';
import { findTier } from './pricing';
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
        { role: 'system', content: 'You are a helpful assistant that generates blog content in Korean. Always respond in Korean.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
    extractText: (data) => (data as ChatCompletionResponse)?.choices?.[0]?.message?.content || '',
  },

  openai: {
    name: 'OpenAI',
    provider: 'openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4.1', 'o3', 'gpt-4.1-mini'],
    timeout: 90_000,
    rateLimitPattern: /429|rate.*limit|quota|insufficient_quota/i,
    authErrorPattern: /401|403|unauthorized|forbidden|invalid.*key/i,
    buildHeaders: (key) => ({
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    }),
    buildBody: (model, prompt) => ({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates high-quality blog content in Korean. Always respond in Korean.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
    extractText: (data) => (data as ChatCompletionResponse)?.choices?.[0]?.message?.content || '',
  },

  claude: {
    name: 'Claude',
    provider: 'claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7'],
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
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a helpful assistant that generates high-quality blog content in Korean. Always respond in Korean.',
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
function resolveModelChain(provider: keyof typeof PROVIDERS): string[] {
  const baseModels = PROVIDERS[provider]!.models;
  const tier = findTier(process.env['PRIMARY_TEXT_MODEL']);
  if (!tier || tier.provider !== provider) {
    return [...baseModels];
  }
  // 티어 폴백 체인 + 베이스 모델 (중복 제거)
  const seen = new Set<string>();
  const chain: string[] = [];
  [...tier.fallback, ...baseModels].forEach(m => {
    if (!seen.has(m)) { seen.add(m); chain.push(m); }
  });
  return chain;
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

  if (config.authErrorPattern.test(msg) || status === 401 || status === 403) return 'auth';
  if (/billing|payment|paid plan|pay-as-you-go|billing account|project.*billing|disabled billing/i.test(msg)) return 'billing';
  if (/quota|insufficient_quota|resource_exhausted|credits?|exceeded.*current|exceeded.*limit/i.test(msg)) return 'quota';
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
    timeout: '응답 시간이 제한을 넘었습니다. 더 빠른 모델이나 짧은 글 길이로 다시 시도해 주세요.',
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

  for (const model of modelChain) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      totalAttempts++;
      try {
        await waitForTextProviderTurn(config.provider, `${config.name}/${model}`);
        console.log(`[LLM] ${config.name} ${model} attempt ${attempt + 1}/${maxRetries}`);
        const response = await axios.post(
          config.endpoint,
          config.buildBody(model, prompt),
          {
            headers: config.buildHeaders(apiKey),
            timeout: config.timeout,
          }
        );

        const text = config.extractText(response.data);
        if (text) {
          return text;
        }
        throw new Error('빈 응답');
      } catch (error: unknown) {
        const errorMsg = extractErrorMessage(error);
        const kind = classifyProviderFailure(config, error);
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
