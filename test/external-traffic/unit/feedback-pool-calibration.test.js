'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'orbit-fbpool-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

jest.resetModules();
const feedback = require('../../../src/core/external-traffic/feedback-store');
const pool = require('../../../src/core/external-traffic/pool-store');
const calibration = require('../../../src/core/external-traffic/calibration');
const phaseGate = require('../../../src/core/external-traffic/phase-gate');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

describe('feedback-store', () => {
  test('피드백 기록 + listAll', () => {
    feedback.recordFeedback({ channel: 'instagram', verdict: 'good', riskScore: 23, band: 'low' });
    feedback.recordFeedback({ channel: 'instagram', verdict: 'banned', riskScore: 72, band: 'high' });
    const list = feedback.listAll();
    expect(list.length).toBe(2);
  });
  test('channel aggregation', () => {
    for (let i = 0; i < 5; i++) {
      feedback.recordFeedback({ channel: 'x', verdict: 'good', riskScore: 30, band: 'low' });
    }
    feedback.recordFeedback({ channel: 'x', verdict: 'banned', riskScore: 80, band: 'high' });
    const agg = feedback.aggregateChannel('x');
    expect(agg.total).toBe(6);
    expect(agg.counts.good).toBe(5);
    expect(agg.counts.banned).toBe(1);
    expect(agg.banRate).toBeCloseTo(1 / 6, 2);
  });
});

describe('pool-store', () => {
  test('기본 옵트아웃', () => {
    expect(pool.isOptedIn()).toBe(false);
  });
  test('옵트인 후 isOptedIn true', () => {
    pool.setOptIn(true);
    expect(pool.isOptedIn()).toBe(true);
  });
  test('익명화 digest — 사용자 ID 해시만 포함', () => {
    feedback.recordFeedback({ channel: 'x', verdict: 'good', riskScore: 30, band: 'low' });
    const digest = pool.buildAnonymizedDigest();
    expect(digest.length).toBe(1);
    expect(digest[0].anonUserHash).toMatch(/^[0-9a-f]{16}$/);
    expect(digest[0]).not.toHaveProperty('sourceUrl');
  });
  test('동일 PC 기준 익명 해시 일관', () => {
    const h1 = pool.anonymousUserHash();
    const h2 = pool.anonymousUserHash();
    expect(h1).toBe(h2);
  });
});

describe('calibration', () => {
  test('샘플 부족 시 eligible: false', () => {
    feedback.recordFeedback({ channel: 'x', verdict: 'good', riskScore: 30, band: 'low' });
    const out = calibration.computeChannel('x');
    expect(out.eligible).toBe(false);
  });
  test('샘플 100+ 누적 시 권고 산출', () => {
    for (let i = 0; i < 100; i++) {
      feedback.recordFeedback({
        channel: 'x', verdict: i % 5 === 0 ? 'banned' : 'good',
        riskScore: i % 5 === 0 ? 75 + (i % 10) : 25, band: i % 5 === 0 ? 'high' : 'low',
      });
    }
    const out = calibration.computeChannel('x');
    expect(out.eligible).toBe(true);
    expect(out.sampleSize).toBe(100);
    expect(typeof out.recommendedCritical).toBe('number');
  });
});

describe('phase-gate', () => {
  test('UNKNOWN_PHASE는 reasons', () => {
    const out = phaseGate.check('xxx');
    expect(out.pass).toBe(false);
    expect(out.reasons).toContain('UNKNOWN_PHASE');
  });
  test('A0-to-A1 기준 미달', () => {
    for (let i = 0; i < 50; i++) {
      feedback.recordFeedback({ channel: 'instagram', verdict: 'good', riskScore: 20, band: 'low' });
    }
    const out = phaseGate.check('A0-to-A1');
    expect(out.pass).toBe(false);
    expect(out.reasons.some((r) => /distinctChannels/.test(r))).toBe(true);
  });
});
