// src/core/external-traffic/_shared/consent-store.js
// 1회 누적 동의 + 90일 갱신 + 약관 버전 mismatch 처리.

'use strict';

const secure = require('./secure-store');

const CURRENT_TERMS_VERSION = '2026-06-01-beta';
const RENEWAL_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @typedef {Object} ConsentRecord
 * @property {string} key                'general'|'channel:<id>'
 * @property {string} version            동의한 약관 버전
 * @property {number} consentedAt        epoch ms
 * @property {number} expiresAt          epoch ms
 * @property {Object} consents           모든 체크 항목
 * @property {string[]} channels         general 동의에 포함된 채널 목록 (선택)
 */

function _now() {
  return Date.now();
}

function _allKey() {
  return 'consent-store';
}

function _load() {
  return secure.secureRead(_allKey()) || { records: {} };
}

function _save(store) {
  secure.secureWrite(_allKey(), store);
}

/**
 * 동의 필요 여부.
 *  - 'full': 첫 사용 또는 약관 버전 mismatch
 *  - 'renew': 90일 경과
 *  - 'none': 유효
 *
 * @param {string} consentKey  'general' 또는 'channel:dcinside' 등
 * @returns {{ needed: 'full'|'renew'|'none', record: ConsentRecord|null }}
 */
function checkConsent(consentKey) {
  const store = _load();
  const record = store.records[consentKey];
  if (!record) return { needed: 'full', record: null };
  if (record.version !== CURRENT_TERMS_VERSION) return { needed: 'full', record };
  if (record.expiresAt < _now()) return { needed: 'renew', record };
  return { needed: 'none', record };
}

/**
 * 동의 저장.
 * @param {string} consentKey
 * @param {Object} consents  체크 항목 (key: bool)
 * @param {string[]} [channels]
 * @returns {ConsentRecord}
 */
function recordConsent(consentKey, consents, channels) {
  const store = _load();
  const now = _now();
  const record = {
    key: consentKey,
    version: CURRENT_TERMS_VERSION,
    consentedAt: now,
    expiresAt: now + RENEWAL_DAYS * MS_PER_DAY,
    consents: consents || {},
    channels: Array.isArray(channels) ? channels.slice() : [],
  };
  store.records[consentKey] = record;
  _save(store);
  return record;
}

/**
 * 모든 동의 기록 (사용자가 본인 동의 이력 확인).
 * @returns {ConsentRecord[]}
 */
function listConsents() {
  const store = _load();
  return Object.values(store.records || {});
}

/**
 * 특정 동의 철회 (사용자 명시 요청).
 * @param {string} consentKey
 */
function revokeConsent(consentKey) {
  const store = _load();
  delete store.records[consentKey];
  _save(store);
}

/**
 * 전체 초기화 (테스트/사용자 요청).
 */
function clearAll() {
  secure.secureDelete(_allKey());
}

module.exports = {
  CURRENT_TERMS_VERSION,
  RENEWAL_DAYS,
  checkConsent,
  recordConsent,
  listConsents,
  revokeConsent,
  clearAll,
};
