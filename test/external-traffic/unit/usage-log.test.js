'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'orbit-log-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

jest.resetModules();
const log = require('../../../src/core/external-traffic/_shared/usage-log');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

describe('usage-log', () => {
  test('동의 + 생성 + 피드백 기록', () => {
    log.logConsent({ consentKey: 'general', termsVersion: 'v1', consents: { a: true } });
    log.logGenerate({ channel: 'instagram', riskScore: 25, band: 'low' });
    log.logFeedback({ channel: 'instagram', verdict: 'good' });
    const out = log.recent(10);
    expect(out.length).toBe(3);
    expect(out[0].type).toBe('consent');
    expect(out[1].type).toBe('generate');
    expect(out[2].type).toBe('feedback');
  });

  test('critical-consent 기록', () => {
    log.logCriticalConsent({ channel: 'dcinside', consentSteps: ['hasExperience', 'willReview'] });
    const out = log.recent(5);
    expect(out[0].type).toBe('critical-consent');
    expect(out[0].consentSteps.length).toBe(2);
  });

  test('clearAll 후 빈 상태', () => {
    log.logGenerate({ channel: 'x', riskScore: 30, band: 'low' });
    log.clearAll();
    expect(log.recent(5).length).toBe(0);
  });

  test('AUTO_PRUNE_DAYS 정의', () => {
    expect(log.AUTO_PRUNE_DAYS).toBe(90);
  });
});
