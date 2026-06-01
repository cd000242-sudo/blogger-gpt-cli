// src/core/external-traffic/calibration.js
// 피드백 100+ 누적 시 채널별 임계값 자동 캘리브레이션.
// verdict='banned' 샘플의 score 분포 → 5th percentile 을 critical 임계값으로 권고.

'use strict';

const feedback = require('./feedback-store');
const secure = require('./_shared/secure-store');

const KEY = 'calibration';
const MIN_SAMPLES = 100;

/**
 * @typedef {Object} CalibrationResult
 * @property {string} channel
 * @property {boolean} eligible
 * @property {number} sampleSize
 * @property {number} [recommendedCritical]
 * @property {number} [recommendedHigh]
 * @property {number} [actualBanRate]
 * @property {string} ts
 */

function _now() {
  return Date.now();
}

function _percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
  return sorted[idx];
}

/**
 * 채널 캘리브레이션 권고 계산.
 * @param {string} channel
 * @returns {CalibrationResult}
 */
function computeChannel(channel) {
  const agg = feedback.aggregateChannel(channel);
  const ts = new Date(_now()).toISOString();
  if (agg.total < MIN_SAMPLES) {
    return { channel, eligible: false, sampleSize: agg.total, ts };
  }
  const bannedScores = agg.scoreOfBanned.filter((s) => typeof s === 'number');
  if (bannedScores.length < 10) {
    return { channel, eligible: false, sampleSize: agg.total, ts };
  }
  // banned 그룹의 5th percentile 점수를 critical 임계 권고로 사용.
  const critical = _percentile(bannedScores, 0.05);
  // banned 그룹의 25th percentile을 high 임계 권고로 사용.
  const high = _percentile(bannedScores, 0.25);
  return {
    channel,
    eligible: true,
    sampleSize: agg.total,
    actualBanRate: agg.banRate,
    recommendedCritical: critical,
    recommendedHigh: high,
    ts,
  };
}

/**
 * 모든 채널 캘리브레이션 권고.
 * @param {string[]} channelIds
 * @returns {CalibrationResult[]}
 */
function computeAll(channelIds) {
  return channelIds.map(computeChannel);
}

/**
 * 권고를 store에 저장.
 * @param {CalibrationResult[]} recs
 */
function persistRecommendations(recs) {
  return secure.secureWrite(KEY, { ts: new Date(_now()).toISOString(), recs });
}

function loadRecommendations() {
  return secure.secureRead(KEY) || { ts: null, recs: [] };
}

function clearAll() {
  secure.secureDelete(KEY);
}

module.exports = {
  computeChannel,
  computeAll,
  persistRecommendations,
  loadRecommendations,
  clearAll,
  MIN_SAMPLES,
};
