/**
 * 통합 LLM 호출 엔진
 * 3개 중복 함수(callPerplexityAPI, callOpenAIAPI, callClaudeAPI)를 1개로 통합
 */

import axios, { AxiosError } from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey } from './api-keys';

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
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
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

const RATE_LIMIT_DELAY_MS = 3_000;

function extractErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

  for (const model of config.models) {
    try {
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
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMsg = extractErrorMessage(error);

      // 인증 오류 → 다른 모델 시도해도 같은 키이므로 즉시 실패
      if (config.authErrorPattern.test(errorMsg)) {
        throw new Error(`${config.name} 인증 실패 (API 키를 확인하세요): ${errorMsg.substring(0, 100)}`);
      }

      if (config.rateLimitPattern.test(errorMsg)) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
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
