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
  // v3.8.127: JSON 모드 강제 — schema instruction에 finalRevision이 있으면 응답을 순수 JSON으로 받음.
  // schema 부분 무시(context만 출력하고 끝)를 방지.
  const wantsJson = params.responseFormat === 'json'
    || /finalRevision|RESULT_JSON|"variants"/i.test(`${params.system}\n${params.user}`);
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const generationConfig = {
        maxOutputTokens: params.maxOutputTokens || 2000,
        temperature: typeof params.temperature === 'number' ? params.temperature : 0.85,
      };
      if (wantsJson) generationConfig.responseMimeType = 'application/json';
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${params.system}\n\n${params.user}` }] }],
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
  const candidates = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
  let lastErr = null;
  // v3.8.127: OpenAI JSON 모드 — finalRevision 누락 방지.
  const wantsJson = params.responseFormat === 'json'
    || /finalRevision|RESULT_JSON|"variants"/i.test(`${params.system}\n${params.user}`);
  for (const modelName of candidates) {
    try {
      const req = {
        model: modelName,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
        max_tokens: params.maxOutputTokens || 2000,
        temperature: typeof params.temperature === 'number' ? params.temperature : 0.85,
      };
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

async function callPerplexity(params, key) {
  const candidates = ['sonar-pro', 'sonar'];
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
            { role: 'system', content: params.system || 'Always respond in Korean.' },
            { role: 'user', content: params.user || '' },
          ],
          max_tokens: params.maxOutputTokens || 2000,
          temperature: typeof params.temperature === 'number' ? params.temperature : 0.85,
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
  PROVIDERS,
};
