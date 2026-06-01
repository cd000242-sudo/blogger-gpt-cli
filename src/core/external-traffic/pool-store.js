// src/core/external-traffic/pool-store.js
// 옵트인 협력 풀 — 익명화된 피드백 통계만 보유.
// 글로벌 전송은 사용자 명시 선택 시에만, 그리고 별도 IPC로 — 본 모듈은 로컬 캐시·익명화만 담당.

'use strict';

const secure = require('./_shared/secure-store');
const feedback = require('./feedback-store');
const crypto = require('crypto');

const OPT_KEY = 'pool-opt-in';
const CACHE_KEY = 'pool-cache';

function _now() { return Date.now(); }

function isOptedIn() {
  const rec = secure.secureRead(OPT_KEY);
  return !!(rec && rec.optedIn);
}

function setOptIn(value) {
  secure.secureWrite(OPT_KEY, {
    optedIn: !!value,
    at: new Date(_now()).toISOString(),
  });
  return { ok: true, optedIn: !!value };
}

/**
 * 사용자 식별자 익명화 — 별도 ID 없으면 OS-level의 hostname 기반 해시.
 * 복원 불가.
 * @returns {string}
 */
function anonymousUserHash() {
  const os = require('os');
  const seed = `${os.hostname()}|${os.userInfo().username}|orbit-external-traffic`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

/**
 * 익명화된 피드백 통계 생성.
 * 원문·URL·사용자 ID 포함 X.
 *
 * @returns {Array<{ channel: string, band: string, verdict: string, riskScore: number, anonUserHash: string }>}
 */
function buildAnonymizedDigest() {
  const rows = feedback.listAll().map((r) => ({
    channel: r.channel,
    band: r.band,
    verdict: r.verdict,
    riskScore: r.riskScore,
    anonUserHash: anonymousUserHash(),
  }));
  return rows;
}

/**
 * 협력 풀 다운로드 캐시 (다른 사용자 익명 통계).
 * 미연결 환경에서는 빈 배열. 실제 서버 연동은 별도 IPC.
 * @returns {{ pulledAt: string|null, items: any[] }}
 */
function getRemoteCache() {
  return secure.secureRead(CACHE_KEY) || { pulledAt: null, items: [] };
}

function setRemoteCache(items) {
  return secure.secureWrite(CACHE_KEY, {
    pulledAt: new Date(_now()).toISOString(),
    items: Array.isArray(items) ? items : [],
  });
}

function clearAll() {
  secure.secureDelete(OPT_KEY);
  secure.secureDelete(CACHE_KEY);
}

module.exports = {
  isOptedIn,
  setOptIn,
  buildAnonymizedDigest,
  getRemoteCache,
  setRemoteCache,
  anonymousUserHash,
  clearAll,
};
