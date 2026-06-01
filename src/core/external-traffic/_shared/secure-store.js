// src/core/external-traffic/_shared/secure-store.js
// safeStorage (electron 키체인) 기반 암호화 + 폴백 평문 저장.
// node-only — renderer에서 직접 호출 X (IPC 경유).

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

let _electron = null;
try {
  _electron = require('electron');
} catch {
  // 테스트/스탠드얼론 환경 — electron 없음
}

const DEFAULT_DIR = process.env.ORBIT_DATA_DIR
  || (_electron && _electron.app && _electron.app.getPath
    ? _electron.app.getPath('userData')
    : path.join(os.homedir(), '.config', 'Orbit'));

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function resolvePath(key) {
  const safe = String(key).replace(/[^a-z0-9._-]/gi, '_');
  return path.join(DEFAULT_DIR, 'external-traffic', safe);
}

function isEncryptionAvailable() {
  try {
    return !!(_electron && _electron.safeStorage && _electron.safeStorage.isEncryptionAvailable && _electron.safeStorage.isEncryptionAvailable());
  } catch {
    return false;
  }
}

/**
 * 객체 직렬화 + 암호화 저장. 키체인 미사용 시 평문 + .plain 마커.
 * @param {string} key  파일명 안전 토큰
 * @param {any} data
 */
function secureWrite(key, data) {
  const filePath = resolvePath(key);
  ensureDir(path.dirname(filePath));
  const json = JSON.stringify(data);
  if (isEncryptionAvailable()) {
    const enc = _electron.safeStorage.encryptString(json);
    fs.writeFileSync(filePath + '.enc', enc);
    return { ok: true, encrypted: true, path: filePath + '.enc' };
  }
  fs.writeFileSync(filePath + '.plain.json', json, 'utf8');
  return { ok: true, encrypted: false, path: filePath + '.plain.json' };
}

/**
 * @param {string} key
 * @returns {any|null}
 */
function secureRead(key) {
  const base = resolvePath(key);
  const encPath = base + '.enc';
  const plainPath = base + '.plain.json';
  if (fs.existsSync(encPath) && isEncryptionAvailable()) {
    try {
      const buf = fs.readFileSync(encPath);
      const str = _electron.safeStorage.decryptString(buf);
      return JSON.parse(str);
    } catch (e) {
      console.error('[SECURE-STORE] decrypt 실패:', e && e.message);
      return null;
    }
  }
  if (fs.existsSync(plainPath)) {
    try {
      return JSON.parse(fs.readFileSync(plainPath, 'utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * append-only JSONL — 사용 로그용.
 * @param {string} key
 * @param {any} record
 */
function secureAppendLine(key, record) {
  const filePath = resolvePath(key) + '.jsonl';
  ensureDir(path.dirname(filePath));
  const line = JSON.stringify(record) + '\n';
  if (isEncryptionAvailable()) {
    // 줄 단위 암호화는 비효율 — 전체 파일을 매번 재암호화하는 대신 평문 append + 별도 .enc 미사용
    // 대안: append-only 파일은 마지막 N건만 읽으면 되므로 평문 + 디스크 권한 제어로 충분.
    // 보안 강화 필요 시 별도 전체 dump 로테이션을 secureWrite로 처리.
  }
  fs.appendFileSync(filePath, line, 'utf8');
  return { ok: true, path: filePath };
}

/**
 * JSONL 마지막 N건 읽기.
 * @param {string} key
 * @param {number} [n=100]
 * @returns {any[]}
 */
function secureReadLines(key, n = 100) {
  const filePath = resolvePath(key) + '.jsonl';
  if (!fs.existsSync(filePath)) return [];
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    const slice = lines.slice(-n);
    return slice.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * 키에 해당하는 파일 삭제 (사용자 요청 시).
 * @param {string} key
 */
function secureDelete(key) {
  const base = resolvePath(key);
  for (const ext of ['.enc', '.plain.json', '.jsonl']) {
    const p = base + ext;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  return { ok: true };
}

module.exports = {
  secureWrite,
  secureRead,
  secureAppendLine,
  secureReadLines,
  secureDelete,
  isEncryptionAvailable,
  resolvePath,
  DEFAULT_DIR,
};
