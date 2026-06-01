// src/core/external-traffic/feedback-store.js
// 사용자 결과 피드백 (👍/😐/👎/🚫) — verdict 분포 기반 캘리브레이션 입력.

'use strict';

const secure = require('./_shared/secure-store');
const log = require('./_shared/usage-log');

const KEY = 'feedback-store';

/**
 * @typedef {Object} FeedbackRecord
 * @property {string} id            unique
 * @property {string} ts            ISO
 * @property {string} channel
 * @property {string} [subChannel]
 * @property {'good'|'meh'|'bad'|'banned'} verdict
 * @property {string} [reason]
 * @property {number} riskScore     생성 시점 score
 * @property {string} band
 * @property {string} promptVersion 채널 lastVerified 값
 */

function _now() {
  return Date.now();
}

function _genId() {
  // Math.random + Date.now 회피: 단조 증가 카운터 + 프로세스 PID
  if (!_genId._n) _genId._n = 1;
  _genId._n++;
  return `${_now()}_${process.pid}_${_genId._n}`;
}

function _load() {
  return secure.secureRead(KEY) || { records: [] };
}

function _save(store) {
  secure.secureWrite(KEY, store);
}

/**
 * 피드백 1건 저장.
 * @param {Omit<FeedbackRecord, 'id'|'ts'>} payload
 * @returns {FeedbackRecord}
 */
function recordFeedback(payload) {
  const store = _load();
  const record = {
    id: _genId(),
    ts: new Date(_now()).toISOString(),
    channel: payload.channel,
    subChannel: payload.subChannel || null,
    verdict: payload.verdict,
    reason: payload.reason || null,
    riskScore: typeof payload.riskScore === 'number' ? payload.riskScore : null,
    band: payload.band || null,
    promptVersion: payload.promptVersion || null,
  };
  store.records.push(record);
  _save(store);
  log.logFeedback({ channel: record.channel, verdict: record.verdict, reason: record.reason });
  return record;
}

/**
 * 모든 피드백.
 * @returns {FeedbackRecord[]}
 */
function listAll() {
  return _load().records || [];
}

/**
 * 채널별 verdict 분포 (캘리브레이션 입력).
 * @param {string} channel
 * @returns {{ counts: Record<string, number>, total: number, banRate: number, scoreOfBanned: number[] }}
 */
function aggregateChannel(channel) {
  const all = listAll().filter((r) => r.channel === channel);
  const counts = { good: 0, meh: 0, bad: 0, banned: 0 };
  const scoreOfBanned = [];
  for (const r of all) {
    if (r.verdict in counts) counts[r.verdict]++;
    if (r.verdict === 'banned' && typeof r.riskScore === 'number') {
      scoreOfBanned.push(r.riskScore);
    }
  }
  const total = all.length;
  const banRate = total > 0 ? counts.banned / total : 0;
  return { counts, total, banRate, scoreOfBanned };
}

function clearAll() {
  secure.secureDelete(KEY);
}

module.exports = {
  recordFeedback,
  listAll,
  aggregateChannel,
  clearAll,
};
