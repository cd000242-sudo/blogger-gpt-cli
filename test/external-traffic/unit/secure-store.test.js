// 임시 디렉토리로 isolated 테스트.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// secure-store 로드 전에 ORBIT_DATA_DIR 환경변수로 임시 dir 지정.
const TMP = path.join(os.tmpdir(), 'orbit-et-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

const secure = require('../../../src/core/external-traffic/_shared/secure-store');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

describe('secure-store', () => {
  test('write → read 라운드트립', () => {
    secure.secureWrite('k1', { hello: 'world', n: 42 });
    const out = secure.secureRead('k1');
    expect(out).toEqual({ hello: 'world', n: 42 });
  });

  test('미존재 key는 null', () => {
    expect(secure.secureRead('nonexistent')).toBeNull();
  });

  test('append + read lines', () => {
    secure.secureAppendLine('logs', { i: 1 });
    secure.secureAppendLine('logs', { i: 2 });
    secure.secureAppendLine('logs', { i: 3 });
    const out = secure.secureReadLines('logs', 10);
    expect(out.length).toBe(3);
    expect(out[2].i).toBe(3);
  });

  test('readLines tail N', () => {
    for (let i = 0; i < 10; i++) {
      secure.secureAppendLine('logs2', { i });
    }
    const out = secure.secureReadLines('logs2', 3);
    expect(out.length).toBe(3);
    expect(out.map((r) => r.i)).toEqual([7, 8, 9]);
  });

  test('delete 후 read는 null', () => {
    secure.secureWrite('k2', { a: 1 });
    secure.secureDelete('k2');
    expect(secure.secureRead('k2')).toBeNull();
  });

  test('파일명 sanitize', () => {
    secure.secureWrite('a/b\\c..d', { ok: true });
    const out = secure.secureRead('a/b\\c..d');
    expect(out).toEqual({ ok: true });
  });
});
