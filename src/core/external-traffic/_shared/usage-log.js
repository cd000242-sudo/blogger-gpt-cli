// src/core/external-traffic/_shared/usage-log.js
// 사용 로그 (append-only JSONL) — 동의 + 변환 + 위험 등급 기록.
// 양면성 명시: 사용자 본인 동의 입증용. 외부 채널이 사용자 불리 자료로도 활용 가능.

'use strict';

const secure = require('./secure-store');

const LOG_KEY = 'usage-log';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AUTO_PRUNE_DAYS = 90;

function _now() {
  return Date.now();
}

/**
 * 동의 이벤트 기록.
 * @param {Object} params
 * @param {string} params.consentKey
 * @param {string} params.termsVersion
 * @param {Object} params.consents
 */
function logConsent({ consentKey, termsVersion, consents }) {
  secure.secureAppendLine(LOG_KEY, {
    ts: new Date(_now()).toISOString(),
    type: 'consent',
    consentKey,
    termsVersion,
    consents,
  });
}

/**
 * 변환 이벤트 기록.
 * @param {Object} params
 * @param {string} params.channel
 * @param {number} params.riskScore
 * @param {string} params.band
 * @param {string} [params.sourceUrl]
 * @param {number} [params.violationCount]
 * @param {string} [params.subChannel]
 */
function logGenerate({ channel, riskScore, band, sourceUrl, violationCount, subChannel }) {
  secure.secureAppendLine(LOG_KEY, {
    ts: new Date(_now()).toISOString(),
    type: 'generate',
    channel,
    subChannel: subChannel || null,
    riskScore: typeof riskScore === 'number' ? riskScore : null,
    band: band || null,
    sourceUrl: sourceUrl || null,
    violationCount: typeof violationCount === 'number' ? violationCount : null,
  });
}

/**
 * Critical Tier 추가 동의 기록 (디시·더쿠 등 🔴 채널).
 * @param {Object} params
 * @param {string} params.channel
 * @param {string[]} params.consentSteps   ['has-experience','will-review','accept-responsibility']
 */
function logCriticalConsent({ channel, consentSteps }) {
  secure.secureAppendLine(LOG_KEY, {
    ts: new Date(_now()).toISOString(),
    type: 'critical-consent',
    channel,
    consentSteps: consentSteps || [],
  });
}

/**
 * 사용자 결과 피드백 기록.
 * @param {Object} params
 * @param {string} params.channel
 * @param {'good'|'meh'|'bad'|'banned'} params.verdict
 * @param {string} [params.reason]
 */
function logFeedback({ channel, verdict, reason }) {
  secure.secureAppendLine(LOG_KEY, {
    ts: new Date(_now()).toISOString(),
    type: 'feedback',
    channel,
    verdict,
    reason: reason || null,
  });
}

/**
 * 최근 N건 조회.
 * @param {number} [n=200]
 */
function recent(n = 200) {
  return secure.secureReadLines(LOG_KEY, n);
}

/**
 * 90일 초과 비-consent 레코드 자동 삭제 (동의 기록만 영구 보존).
 * @returns {{ removed: number, kept: number }}
 */
function pruneOldLogs() {
  const all = secure.secureReadLines(LOG_KEY, 100000);
  const cutoff = _now() - AUTO_PRUNE_DAYS * MS_PER_DAY;
  const kept = all.filter((rec) => {
    if (!rec || !rec.ts) return false;
    const ts = new Date(rec.ts).getTime();
    if (Number.isNaN(ts)) return false;
    if (rec.type === 'consent' || rec.type === 'critical-consent') return true;
    return ts >= cutoff;
  });
  secure.secureDelete(LOG_KEY);
  for (const rec of kept) secure.secureAppendLine(LOG_KEY, rec);
  return { removed: all.length - kept.length, kept: kept.length };
}

/**
 * 사용자 명시 삭제.
 */
function clearAll() {
  secure.secureDelete(LOG_KEY);
}

module.exports = {
  logConsent,
  logGenerate,
  logCriticalConsent,
  logFeedback,
  recent,
  pruneOldLogs,
  clearAll,
  AUTO_PRUNE_DAYS,
};
