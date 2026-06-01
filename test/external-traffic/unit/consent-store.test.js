'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'orbit-consent-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

// secure-store 캐시 회피를 위해 매번 fresh require
jest.resetModules();
const consent = require('../../../src/core/external-traffic/_shared/consent-store');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

describe('consent-store', () => {
  test('첫 사용 → needed: full', () => {
    const out = consent.checkConsent('general');
    expect(out.needed).toBe('full');
  });

  test('동의 기록 후 → needed: none', () => {
    consent.recordConsent('general', { readTerms: true });
    const out = consent.checkConsent('general');
    expect(out.needed).toBe('none');
    expect(out.record.consents.readTerms).toBe(true);
  });

  test('listConsents 반환', () => {
    consent.recordConsent('general', { a: true });
    consent.recordConsent('channel:dcinside', { hasExperience: true });
    const list = consent.listConsents();
    expect(list.length).toBe(2);
  });

  test('revoke 후 → needed: full', () => {
    consent.recordConsent('general', { a: true });
    consent.revokeConsent('general');
    expect(consent.checkConsent('general').needed).toBe('full');
  });

  test('CURRENT_TERMS_VERSION 정의됨', () => {
    expect(consent.CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
