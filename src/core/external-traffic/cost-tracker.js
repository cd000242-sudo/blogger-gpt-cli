// src/core/external-traffic/cost-tracker.js
// 채널별·월별 토큰·비용 추적 + 상한 강제.

'use strict';

const secure = require('./_shared/secure-store');

const KEY = 'cost-tracker';

const PROVIDER_RATES = {
  gemini: { inputPerM: 0.075, outputPerM: 0.30 },
  openai: { inputPerM: 0.15, outputPerM: 0.60 },
  claude: { inputPerM: 3.0, outputPerM: 15.0 },
};

const DEFAULT_LIMITS = {
  monthlyTokens: 500_000,
  perGenerationRetries: 3,
};

function _now() { return Date.now(); }

function _yearMonth(ts) {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function _load() {
  return secure.secureRead(KEY) || { months: {}, limits: { ...DEFAULT_LIMITS } };
}

function _save(store) {
  secure.secureWrite(KEY, store);
}

/**
 * 토큰 사용량 기록.
 * @param {Object} p
 * @param {string} p.provider
 * @param {number} p.inputTokens
 * @param {number} p.outputTokens
 * @param {string} [p.channel]
 */
function recordUsage(p) {
  const ts = _now();
  const ym = _yearMonth(ts);
  const store = _load();
  if (!store.months[ym]) {
    store.months[ym] = { totalTokens: 0, inputTokens: 0, outputTokens: 0, byProvider: {}, byChannel: {}, costUSD: 0 };
  }
  const slot = store.months[ym];
  const inT = Math.max(0, p.inputTokens || 0);
  const outT = Math.max(0, p.outputTokens || 0);
  slot.totalTokens += inT + outT;
  slot.inputTokens += inT;
  slot.outputTokens += outT;
  const rate = PROVIDER_RATES[p.provider] || { inputPerM: 0.15, outputPerM: 0.30 };
  const cost = (inT / 1_000_000) * rate.inputPerM + (outT / 1_000_000) * rate.outputPerM;
  slot.costUSD = Number(((slot.costUSD || 0) + cost).toFixed(6));
  if (!slot.byProvider[p.provider]) slot.byProvider[p.provider] = { tokens: 0, costUSD: 0 };
  slot.byProvider[p.provider].tokens += inT + outT;
  slot.byProvider[p.provider].costUSD = Number((slot.byProvider[p.provider].costUSD + cost).toFixed(6));
  if (p.channel) {
    if (!slot.byChannel[p.channel]) slot.byChannel[p.channel] = { tokens: 0, costUSD: 0, generations: 0 };
    slot.byChannel[p.channel].tokens += inT + outT;
    slot.byChannel[p.channel].costUSD = Number((slot.byChannel[p.channel].costUSD + cost).toFixed(6));
    slot.byChannel[p.channel].generations += 1;
  }
  _save(store);
  return slot;
}

function currentMonth() {
  const store = _load();
  const ym = _yearMonth(_now());
  return store.months[ym] || { totalTokens: 0, costUSD: 0, byProvider: {}, byChannel: {} };
}

function getLimits() {
  const store = _load();
  return { ...DEFAULT_LIMITS, ...(store.limits || {}) };
}

function setLimits(partial) {
  const store = _load();
  store.limits = { ...DEFAULT_LIMITS, ...(store.limits || {}), ...(partial || {}) };
  _save(store);
  return store.limits;
}

/**
 * 사용량 상한 검사 — true면 차단.
 * @returns {{ exceeded: boolean, used: number, limit: number, remaining: number }}
 */
function checkBlockOnLimit() {
  const limit = getLimits().monthlyTokens;
  const used = currentMonth().totalTokens;
  const remaining = Math.max(0, limit - used);
  return { exceeded: used >= limit, used, limit, remaining };
}

function clearAll() {
  secure.secureDelete(KEY);
}

module.exports = {
  recordUsage,
  currentMonth,
  getLimits,
  setLimits,
  checkBlockOnLimit,
  clearAll,
  PROVIDER_RATES,
  DEFAULT_LIMITS,
};
