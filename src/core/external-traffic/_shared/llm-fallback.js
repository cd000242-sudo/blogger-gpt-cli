// src/core/external-traffic/_shared/llm-fallback.js
// API 폴백 체인 — Gemini → OpenAI → Claude.
// IPC 핸들러에서 호출되는 단일 진입점.

'use strict';

/**
 * @typedef {Object} CallParams
 * @property {string} system
 * @property {string} user
 * @property {number} [maxOutputTokens]
 * @property {number} [temperature]
 */

/**
 * @typedef {Object} ProviderKeys
 * @property {string} [gemini]
 * @property {string} [openai]
 * @property {string} [claude]
 */

function isAvailable(provider, keys) {
  if (!keys) return false;
  const k = (keys[provider] || '').trim();
  return k.length >= 20;
}

const MODEL_CHAINS = {
  gemini: {
    'gemini-2.5-flash-lite': ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
    'gemini-2.5-flash': ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
    'gemini-2.5-pro': ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
    'gemini-3.1-flash-lite': ['gemini-3.1-flash-lite', 'gemini-3.5-flash'],
    'gemini-3.5-flash': ['gemini-3.5-flash', 'gemini-3.1-flash-lite'],
    'gemini-3.1-pro-preview': ['gemini-3.1-pro-preview', 'gemini-3.5-flash'],
  },
  openai: {
    'openai-gpt4o-mini': ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5-mini'],
    'openai-gpt41': ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    'openai-gpt4o': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5-mini'],
    'gpt-5-nano': ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5-mini'],
    'gpt-5-mini': ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    'gpt-5': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5-mini'],
    'gpt-5.6-luna': ['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5-mini'],
    'gpt-5.6-terra': ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5-mini'],
    'gpt-5.6-sol': ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5-mini'],
  },
  claude: {
    'claude-haiku': ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
    'claude-sonnet': ['claude-sonnet-5', 'claude-haiku-4-5-20251001'],
    'claude-opus': ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
    'claude-haiku-4-5-20251001': ['claude-haiku-4-5-20251001', 'claude-sonnet-5'],
    'claude-sonnet-5': ['claude-sonnet-5', 'claude-haiku-4-5-20251001'],
    'claude-fable-5': ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5'],
  },
  perplexity: {
    'perplexity-sonar': ['sonar-pro', 'sonar'],
    'sonar-pro': ['sonar-pro', 'sonar'],
    sonar: ['sonar', 'sonar-pro'],
  },
};

const FACTUAL_GENERATION_RULES = 'Use exact dates, amounts, eligibility, statistics, organization names, and URLs only when they are supplied in evidence. Never invent or combine facts from separate sources. When evidence is missing, use a neutral official-verification note.';

function factualSystem(params) {
  return `${FACTUAL_GENERATION_RULES}\n${params.system || 'Always respond in Korean.'}`;
}

function generationTemperature(params) {
  const requested = typeof params.temperature === 'number' ? params.temperature : 0.52;
  const factual = /FACT EVIDENCE|FACT INTEGRITY|Verified source URLs|팩트 기반|팩트체크/i.test(`${params.system || ''}\n${params.user || ''}`);
  return factual ? Math.min(requested, 0.28) : Math.min(requested, 0.62);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function getRequestedModel(params) {
  return String(
    params?.primaryGeminiTextModel ||
    params?.textGenerator ||
    params?.textModel ||
    params?.model ||
    ''
  ).trim();
}

function inferProviderFromModel(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('gemini-')) return 'gemini';
  if (value.startsWith('openai-') || value.startsWith('gpt-')) return 'openai';
  if (value.startsWith('claude-')) return 'claude';
  if (value.startsWith('perplexity-') || value.startsWith('sonar')) return 'perplexity';
  return '';
}

function resolveCandidateModels(provider, params, defaults) {
  const requested = getRequestedModel(params);
  const requestedKey = requested.toLowerCase();
  const requestedProvider = inferProviderFromModel(requestedKey);
  if (!requested || (requestedProvider && requestedProvider !== provider)) {
    return [...defaults];
  }
  const mapped = MODEL_CHAINS[provider]?.[requestedKey];
  if (mapped) {
    return unique([...mapped, ...defaults]);
  }
  if (requestedProvider === provider) {
    return unique([requested, ...defaults]);
  }
  return [...defaults];
}

async function callGemini(params, key) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(key);
  const candidates = resolveCandidateModels('gemini', params, ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview']);
  let lastErr = null;
  // v3.8.127: JSON 모드 강제 — schema instruction에 finalRevision이 있으면 응답을 순수 JSON으로 받음.
  // schema 부분 무시(context만 출력하고 끝)를 방지.
  const wantsJson = params.responseFormat === 'json'
    || /finalRevision|RESULT_JSON|"variants"/i.test(`${params.system}\n${params.user}`);
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const generationConfig = {
        // v3.8.254: 기본값 2000 → 4000 (structured 호출은 8000 명시 전달)
        maxOutputTokens: params.maxOutputTokens || 4000,
        temperature: generationTemperature(params),
      };
      if (wantsJson) generationConfig.responseMimeType = 'application/json';
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${factualSystem(params)}\n\n${params.user}` }] }],
        generationConfig,
      });
      const response = await result.response;
      const text = (response.text() || '').trim();
      if (text) return { text, model: modelName, provider: 'gemini' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('GEMINI_ALL_MODELS_FAILED');
}

async function callOpenAI(params, key) {
  const OpenAI = require('openai').default || require('openai');
  const client = new OpenAI({ apiKey: key });
  const candidates = resolveCandidateModels('openai', params, ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6-sol']);
  let lastErr = null;
  // v3.8.127: OpenAI JSON 모드 — finalRevision 누락 방지.
  const wantsJson = params.responseFormat === 'json'
    || /finalRevision|RESULT_JSON|"variants"/i.test(`${params.system}\n${params.user}`);
  for (const modelName of candidates) {
    try {
      const req = {
        model: modelName,
        messages: [
          { role: 'system', content: factualSystem(params) },
          { role: 'user', content: params.user },
        ],
      };
      if (/^gpt-5/i.test(modelName)) {
        req.max_completion_tokens = params.maxOutputTokens || 4000;
        if (/^gpt-5\.6/i.test(modelName)) req.reasoning_effort = 'medium';
      } else {
        req.max_tokens = params.maxOutputTokens || 4000;
        req.temperature = typeof params.temperature === 'number' ? params.temperature : 0.85;
      }
      if (wantsJson) req.response_format = { type: 'json_object' };
      const resp = await client.chat.completions.create(req);
      const text = (resp && resp.choices && resp.choices[0] && resp.choices[0].message && resp.choices[0].message.content || '').trim();
      if (text) return { text, model: modelName, provider: 'openai' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('OPENAI_ALL_MODELS_FAILED');
}

async function callClaude(params, key) {
  // @anthropic-ai/sdk 의존성이 없을 수 있음 — 동적 로드 + 실패 시 명시.
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
    if (Anthropic && Anthropic.default) Anthropic = Anthropic.default;
  } catch {
    throw new Error('CLAUDE_SDK_NOT_INSTALLED');
  }
  const client = new Anthropic({ apiKey: key });
  const candidates = resolveCandidateModels('claude', params, ['claude-sonnet-5', 'claude-fable-5', 'claude-haiku-4-5-20251001']);
  let lastErr = null;
  for (const modelName of candidates) {
    try {
      const resp = await client.messages.create({
        model: modelName,
        // v3.8.254: 기본값 2000 → 4000 (structured 호출은 8000 명시 전달)
        max_tokens: params.maxOutputTokens || 4000,
        system: factualSystem(params),
        temperature: generationTemperature(params),
        messages: [{ role: 'user', content: params.user }],
      });
      const text = (resp && resp.content && resp.content[0] && resp.content[0].text || '').trim();
      if (text) return { text, model: modelName, provider: 'claude' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('CLAUDE_ALL_MODELS_FAILED');
}

async function callPerplexity(params, key) {
  const candidates = resolveCandidateModels('perplexity', params, ['sonar-pro', 'sonar']);
  let lastErr = null;
  for (const modelName of candidates) {
    try {
      const resp = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: factualSystem(params) },
            { role: 'user', content: params.user || '' },
          ],
          max_tokens: params.maxOutputTokens || 2000,
          temperature: generationTemperature(params),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const providerMessage = data?.error?.message || data?.error?.type || data?.message || resp.statusText;
        throw new Error(`Perplexity ${resp.status}: ${providerMessage}`);
      }
      const text = (data?.choices?.[0]?.message?.content || '').trim();
      if (text) return { text, model: modelName, provider: 'perplexity' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('PERPLEXITY_ALL_MODELS_FAILED');
}

const PROVIDERS = [
  { id: 'gemini', call: callGemini },
  { id: 'openai', call: callOpenAI },
  { id: 'claude', call: callClaude },
  { id: 'perplexity', call: callPerplexity },
];

/**
 * 폴백 체인 호출.
 * @param {CallParams} params
 * @param {ProviderKeys} keys
 * @returns {Promise<{ text: string, model: string, provider: string, tries: Array<{provider: string, error?: string}> }>}
 */
async function callLLMWithFallback(params, keys) {
  const tries = [];
  for (const p of PROVIDERS) {
    if (!isAvailable(p.id, keys)) {
      tries.push({ provider: p.id, error: 'NO_KEY' });
      continue;
    }
    try {
      const result = await p.call(params, keys[p.id]);
      return { ...result, tries: tries.concat({ provider: p.id }) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tries.push({ provider: p.id, error: msg });
    }
  }
  const err = new Error('LLM_ALL_PROVIDERS_FAILED');
  err.tries = tries;
  throw err;
}

module.exports = {
  callLLMWithFallback,
  callGemini,
  callOpenAI,
  callClaude,
  callPerplexity,
  isAvailable,
  inferProviderFromModel,
  resolveCandidateModels,
  PROVIDERS,
};
