// src/core/external-traffic/phase-gate.js
// Phase 진행 정량 기준 — 피드백 누적·verdict 비율 기반.

'use strict';

const feedback = require('./feedback-store');

/**
 * @typedef {Object} PhaseGateResult
 * @property {string} phase
 * @property {boolean} pass
 * @property {string[]} reasons
 * @property {Object} metrics
 */

const PHASE_CRITERIA = {
  'A0-to-A1': {
    minDistinctChannels: 5,
    minTotalGenerations: 100,
    minSamples: 30,
  },
  'A1-to-B': {
    minTotalGenerations: 1000,
    maxBanRate: 0.05,
    minGoodRate: 0.40,
  },
  'B-to-C': {
    minTotalGenerations: 5000,
    maxBanRate: 0.05,
  },
};

/**
 * @param {string} phaseKey
 * @returns {PhaseGateResult}
 */
function check(phaseKey) {
  const crit = PHASE_CRITERIA[phaseKey];
  if (!crit) {
    return { phase: phaseKey, pass: false, reasons: ['UNKNOWN_PHASE'], metrics: {} };
  }
  const all = feedback.listAll();
  const distinctChannels = new Set(all.map((r) => r.channel)).size;
  const total = all.length;
  const counts = { good: 0, meh: 0, bad: 0, banned: 0 };
  for (const r of all) if (r.verdict in counts) counts[r.verdict]++;
  const banRate = total > 0 ? counts.banned / total : 0;
  const goodRate = total > 0 ? counts.good / total : 0;
  const metrics = { distinctChannels, total, counts, banRate, goodRate };
  const reasons = [];

  if (typeof crit.minDistinctChannels === 'number' && distinctChannels < crit.minDistinctChannels) {
    reasons.push(`distinctChannels ${distinctChannels} < ${crit.minDistinctChannels}`);
  }
  if (typeof crit.minTotalGenerations === 'number' && total < crit.minTotalGenerations) {
    reasons.push(`total ${total} < ${crit.minTotalGenerations}`);
  }
  if (typeof crit.minSamples === 'number' && total < crit.minSamples) {
    reasons.push(`samples ${total} < ${crit.minSamples}`);
  }
  if (typeof crit.maxBanRate === 'number' && banRate > crit.maxBanRate) {
    reasons.push(`banRate ${(banRate * 100).toFixed(1)}% > ${(crit.maxBanRate * 100).toFixed(1)}%`);
  }
  if (typeof crit.minGoodRate === 'number' && goodRate < crit.minGoodRate) {
    reasons.push(`goodRate ${(goodRate * 100).toFixed(1)}% < ${(crit.minGoodRate * 100).toFixed(1)}%`);
  }

  return {
    phase: phaseKey,
    pass: reasons.length === 0,
    reasons,
    metrics,
  };
}

module.exports = {
  PHASE_CRITERIA,
  check,
};
