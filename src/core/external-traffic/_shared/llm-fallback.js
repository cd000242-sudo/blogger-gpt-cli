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

async function callGemini(params, key) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(key);
  const candidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];
  let lastErr = null;
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${params.system}\n\n${params.user}` }] }],
        generationConfig: {
          maxOutputTokens: params.maxOutputTokens || 2000,
          temperature: typeof params.temperature === 'number' ? params.temperature : 0.85,
        },
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
  const candidates = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
  let lastErr = null;
  for (const modelName of candidates) {
    try {
      const resp = await client.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        max_tokens: params.maxOutputTokens || 2000,
        temperature: typeof params.temperature === 'number' ? params.temperature : 0.85,
      });
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
  const candidates = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];
  let lastErr = null;
  for (const modelName of candidates) {
    try {
      const resp = await client.messages.create({
        model: modelName,
        max_tokens: params.maxOutputTokens || 2000,
        system: params.system,
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

const PROVIDERS = [
  { id: 'gemini', call: callGemini },
  { id: 'openai', call: callOpenAI },
  { id: 'claude', call: callClaude },
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
  isAvailable,
  PROVIDERS,
};
