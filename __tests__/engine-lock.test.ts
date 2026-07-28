/**
 * R5 안전망 — 엔진 락 워치독 (v3.8.380)
 *
 * 배경: orchestration.ts의 engineLock은 이전 작업이 영원히 안 끝나면 대기자도 영원히 기다린다.
 *   R4가 503 무한루프(락 미반환의 주범)를 고쳤지만, 다른 원인(이미지 브라우저 hang 등)으로
 *   보유자가 멈추면 여전히 무한 대기다. 대기자에게 상한(기본 60분)을 주고,
 *   초과 시 명확한 한국어 에러로 실패시킨다 (조용한 무한 대기 → 보이는 실패).
 *
 * 설계 결정: "강제 해제"가 아니라 "대기자 타임아웃"이다.
 *   강제 해제는 멈춘 보유자와 새 작업이 동시 실행되어 process.env 오염(PRIMARY_TEXT_MODEL 등)을
 *   일으킨다. 타임아웃 실패는 직렬성을 보존한다.
 *
 * 핵심 불변식: 타임아웃한 대기자가 체인을 끊으면 안 된다 —
 *   뒤 대기자는 여전히 "원래 보유자의 해제"를 기다려야 한다 (안 그러면 몰래 동시 실행).
 */

import * as fs from 'fs';
import * as path from 'path';

const load = () => require('../src/core/final/engine-lock');

describe('acquireEngineLock — 직렬화 + 대기자 타임아웃 (R5 안전망)', () => {
  const savedEnv = process.env['ENGINE_LOCK_WAIT_MS'];

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    delete process.env['ENGINE_LOCK_WAIT_MS'];
  });

  afterEach(() => {
    jest.useRealTimers();
    if (savedEnv === undefined) delete process.env['ENGINE_LOCK_WAIT_MS'];
    else process.env['ENGINE_LOCK_WAIT_MS'] = savedEnv;
  });

  it('모듈이 존재하고 acquireEngineLock을 export한다', () => {
    expect(typeof load().acquireEngineLock).toBe('function');
  });

  it('직렬화: 두 번째 획득은 첫 번째가 해제해야 완료된다', async () => {
    const { acquireEngineLock } = load();
    const releaseA = await acquireEngineLock('A');

    let bAcquired = false;
    const bPromise = acquireEngineLock('B').then((rel: () => void) => { bAcquired = true; return rel; });
    await jest.advanceTimersByTimeAsync(1000);
    expect(bAcquired).toBe(false); // A가 쥐고 있는 동안 B는 대기

    releaseA();
    await jest.advanceTimersByTimeAsync(0);
    expect(bAcquired).toBe(true);
    (await bPromise)();
  });

  it('대기자 타임아웃: 기본 60분 초과 시 ENGINE_LOCK_TIMEOUT 에러', async () => {
    const { acquireEngineLock } = load();
    await acquireEngineLock('A'); // 해제하지 않음 (멈춘 보유자 재현)

    const bPromise = acquireEngineLock('B').catch((e: any) => `ERR:${e.message}`);
    await jest.advanceTimersByTimeAsync(61 * 60 * 1000);
    const result = await bPromise;
    expect(String(result)).toContain('ERR:');
    expect(String(result)).toContain('ENGINE_LOCK_TIMEOUT');
  });

  it('타임아웃 후에도 체인이 보존된다: 뒤 대기자는 원래 보유자를 기다리고, 해제되면 획득한다', async () => {
    const { acquireEngineLock } = load();
    const releaseA = await acquireEngineLock('A');

    // B는 타임아웃으로 탈락
    const bPromise = acquireEngineLock('B').catch(() => 'B_TIMEOUT');
    await jest.advanceTimersByTimeAsync(61 * 60 * 1000);
    expect(await bPromise).toBe('B_TIMEOUT');

    // C는 B 탈락과 무관하게 A를 기다려야 한다 (B 탈락이 락을 열어주면 A와 동시 실행 = 위반)
    let cAcquired = false;
    const cPromise = acquireEngineLock('C').then((rel: () => void) => { cAcquired = true; return rel; });
    await jest.advanceTimersByTimeAsync(1000);
    expect(cAcquired).toBe(false); // A가 아직 쥐고 있음

    releaseA();
    await jest.advanceTimersByTimeAsync(0);
    expect(cAcquired).toBe(true);
    (await cPromise)();
  });

  it('ENGINE_LOCK_WAIT_MS=0 이면 무제한 대기 (킬스위치)', async () => {
    process.env['ENGINE_LOCK_WAIT_MS'] = '0';
    const { acquireEngineLock } = load();
    const releaseA = await acquireEngineLock('A');

    let settled = '';
    const bPromise = acquireEngineLock('B').then(() => { settled = 'acquired'; }, () => { settled = 'rejected'; });
    await jest.advanceTimersByTimeAsync(120 * 60 * 1000); // 2시간 지나도
    expect(settled).toBe(''); // 타임아웃 없음 — 계속 대기

    releaseA();
    await jest.advanceTimersByTimeAsync(0);
    await bPromise;
    expect(settled).toBe('acquired');
  });

  it('이중 해제는 무해하다', async () => {
    const { acquireEngineLock } = load();
    const releaseA = await acquireEngineLock('A');
    releaseA();
    releaseA(); // 두 번째 호출이 다음 보유자의 락을 풀면 안 된다

    const releaseB = await acquireEngineLock('B');
    let cAcquired = false;
    acquireEngineLock('C').then(() => { cAcquired = true; });
    await jest.advanceTimersByTimeAsync(1000);
    expect(cAcquired).toBe(false); // B가 쥐고 있는 동안 C는 대기해야 정상
    releaseB();
  });
});

describe('orchestration 배선 — 락 획득 직후 try 진입 (R5)', () => {
  it('acquireEngineLock 호출과 try 블록 사이에 throw 가능한 코드가 200자 이내다 (throw-gap 데드락 방지)', () => {
    // 락을 쥔 채 try 밖에서 예외가 나면 finally(releaseLock)가 실행되지 않아 영구 데드락.
    // 획득 직후 곧바로 try에 들어가야 한다. 주석과 빈 줄은 throw할 수 없으므로 제외하고 잰다.
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'core', 'final', 'orchestration.ts'), 'utf8');
    const pos = src.indexOf('await acquireEngineLock');
    expect(pos).toBeGreaterThan(-1);
    const codeOnly = src.slice(pos, pos + 1200)
      .split('\n')
      .filter(line => line.trim() && !line.trim().startsWith('//'))
      .join('\n');
    const gap = codeOnly.slice(0, codeOnly.search(/try\s*\{/));
    expect(codeOnly).toMatch(/try\s*\{/);
    expect(gap.length).toBeLessThan(200);
  });
});
