/**
 * v3.8.461 — 무료체험 "하루 3회" 가 실제로 하루 3회인지 검증한다.
 *
 * 사용자 요청: "리셋이안되거나 카운팅이안되서 버그가있는데 3회이상 쓸수있게되면
 * 골치아픕니다". 실제 모듈을 격리 폴더에서 공격해 보니 **네 가지 우회가 통했다**:
 *   · 시계를 미래로 돌렸다가 되돌리면 사용량이 0 으로 풀렸다
 *   · `_sig` 필드를 통째로 지우면 서명 검사 자체가 건너뛰어졌다
 *   · 상태 파일 2개를 지우면 0 으로 초기화됐다
 *   · 동시에 5건을 기록하면 5건 전부 통과하고 사용량은 1 이었다 (경쟁 조건)
 * 다섯 번째는 소스를 읽다 찾았다 — 메인 파일 하나만 구버전(v1) 형식으로 바꾸면
 * "정책 이관"이 발동해 세 사본이 전부 0 으로 덮였다.
 *
 * 이 테스트는 다섯 가지가 전부 막혀 있고, **정상 사용자의 일일 리셋은 그대로
 * 동작**하는지를 함께 고정한다.
 */

const TEST_HOME = '.tmp-tests/quota-461';

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '.tmp-tests/quota-461'),
    isPackaged: false,
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** 진짜 구버전(v1) 파일을 만든다 — 서명 규칙이 v2 와 다르다 */
function signV1(state: { date: string; publish: number; lastSeenDate?: string }): string {
  const salt = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');
  const payload = JSON.stringify({ d: state.date, p: state.publish, l: state.lastSeenDate || state.date });
  return crypto.createHmac('sha256', salt).update(payload).digest('hex').substring(0, 16);
}

const DIR = path.resolve(TEST_HOME);
const MAIN = path.join(DIR, 'quota-state.json');
const BACKUP = path.join(DIR, 'quota-state.backup.json');
const MIRROR = path.join(DIR, '.leadernam-orbit', 'quota-state.json');
const LIMIT = 3;

/** 세 사본을 모두 지운다 — 미러를 빠뜨리면 테스트 간 사용량이 샌다 */
function wipe(): void {
  for (const f of [MAIN, BACKUP, MIRROR]) {
    try { fs.unlinkSync(f); } catch { /* 없으면 그만 */ }
  }
}

// ── 날짜 조작 ──
const RealDate = Date;
function setToday(iso: string): void {
  const fixed = new RealDate(`${iso}T12:00:00`).getTime();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const FakeDate: any = function (this: any, ...args: any[]) {
    return args.length ? new (RealDate as any)(...args) : new RealDate(fixed);
  };
  FakeDate.prototype = RealDate.prototype;
  FakeDate.now = () => fixed;
  FakeDate.parse = RealDate.parse;
  FakeDate.UTC = RealDate.UTC;
  (global as any).Date = FakeDate;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}
function restoreDate(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Date = RealDate;
}

type QuotaModule = typeof import('../electron/quota-manager');

function freshModule(): QuotaModule {
  jest.resetModules();
  return require('../electron/quota-manager');
}

describe('v3.8.461 무료체험 하루 3회 — 카운팅과 리셋', () => {
  let Q: QuotaModule;

  beforeEach(() => {
    wipe();
    Q = freshModule();
    setToday('2026-08-04');
  });

  afterEach(() => {
    restoreDate();
    wipe();
  });

  afterAll(() => {
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  // ── 정상 동작 ──

  it('⭐⭐ 3회까지 기록되고 4회차는 거부된다', async () => {
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(true);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);

    const status = await Q.getQuotaStatus(LIMIT);
    expect(status.usage).toBe(3);
    expect(status.isPaywalled).toBe(true);
    expect(await Q.canConsume(LIMIT)).toBe(false);
  });

  it('⭐⭐ 날짜가 바뀌면 0으로 리셋된다 (정상 사용자)', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);
    expect(await Q.getUsageToday()).toBe(3);

    setToday('2026-08-05');
    expect(await Q.getUsageToday()).toBe(0);
    expect(await Q.canConsume(LIMIT)).toBe(true);
  });

  it('⭐ 발행 실패 환불이 그 날의 기록에도 반영된다', async () => {
    await Q.consumeIfAvailable(LIMIT);
    await Q.consumeIfAvailable(LIMIT);
    await Q.refund(1);
    // history 를 안 내리면 다음 조회에서 최댓값 때문에 2 로 되살아난다
    expect(await Q.getUsageToday()).toBe(1);
  });

  // ── 우회 차단 ──

  it('⭐⭐ [시계 조작] 미래로 갔다 돌아와도 그 날 사용량이 되살아난다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);

    setToday('2026-08-10');            // 미래로 점프 → 새 날짜라 0
    expect(await Q.getUsageToday()).toBe(0);

    setToday('2026-08-04');            // 원래 날짜로 복귀
    expect(await Q.getUsageToday()).toBe(3);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [서명 삭제] _sig 를 지우면 위조로 보고 차단한다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);

    const forged = JSON.parse(fs.readFileSync(MAIN, 'utf-8'));
    delete forged._sig;
    forged.publish = 0;
    fs.writeFileSync(MAIN, JSON.stringify(forged), 'utf-8');
    fs.writeFileSync(BACKUP, JSON.stringify(forged), 'utf-8');

    expect(await Q.getUsageToday()).not.toBe(0);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [파일 삭제] 메인+백업을 지워도 미러 사본에서 살아난다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);
    expect(fs.existsSync(MIRROR)).toBe(true);

    fs.unlinkSync(MAIN);
    fs.unlinkSync(BACKUP);

    expect(await Q.getUsageToday()).toBe(3);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [경쟁 조건] 동시에 5건을 기록해도 3건만 통과한다', async () => {
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => Q.consumeIfAvailable(LIMIT)));
    expect(results.filter(Boolean)).toHaveLength(3);
    expect(await Q.getUsageToday()).toBe(3);
  });

  it('⭐⭐ [구버전 바꿔치기] 서명 없는 v1 을 써넣어도 이관되지 않는다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);

    // 예전에는 policyVersion 이 없으면 서명 검증을 건너뛰어 0 으로 이관됐다
    fs.writeFileSync(MAIN, JSON.stringify({ date: '2026-08-04', publish: 0 }), 'utf-8');

    expect(await Q.getUsageToday()).not.toBe(0);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [구버전 바꿔치기] 서명이 맞는 v1 을 메인에만 넣어도 이관되지 않는다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);

    // v1 서명까지 정확히 맞춰도, 다른 사본이 v2 면 진짜 이관이 아니다
    const forged = { date: '2026-08-04', publish: 0, lastSeenDate: '2026-08-04' };
    fs.writeFileSync(MAIN, JSON.stringify({ ...forged, _sig: signV1(forged) }), 'utf-8');

    expect(await Q.getUsageToday()).toBe(3);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [앱 실행 중 삭제] 세 사본이 다 사라져도 그 실행 동안은 사용량이 유지된다', async () => {
    for (let i = 0; i < 3; i++) await Q.consumeIfAvailable(LIMIT);

    // 앱을 켜 둔 채로 상태 파일을 통째로 지우는 시나리오
    wipe();

    expect(await Q.getUsageToday()).toBe(3);
    expect(await Q.consumeIfAvailable(LIMIT)).toBe(false);
  });

  it('⭐⭐ [영구 잠금 방지] 세 사본이 다 깨져도 다음 날이면 리셋된다', async () => {
    for (const f of [MAIN, BACKUP]) fs.writeFileSync(f, '{"date":"2026-08', 'utf-8');
    fs.mkdirSync(path.dirname(MIRROR), { recursive: true });
    fs.writeFileSync(MIRROR, 'corrupted!!!', 'utf-8');

    // 오늘은 차단된다
    expect(await Q.getUsageToday()).toBe(999);
    expect(await Q.canConsume(LIMIT)).toBe(false);

    // 하지만 영원히는 아니다 — 예전에는 여기서도 999 였다
    setToday('2026-08-05');
    expect(await Q.getUsageToday()).toBe(0);
    expect(await Q.canConsume(LIMIT)).toBe(true);
  });

  it('⭐ [원자적 저장] 쓰기 도중 죽어도 반쯤 잘린 파일이 남지 않는다', async () => {
    await Q.consumeIfAvailable(LIMIT);

    // .tmp 에 쓰고 rename 하므로 임시 파일이 남아 있으면 안 된다
    for (const f of [MAIN, BACKUP, MIRROR]) {
      expect(fs.existsSync(`${f}.tmp`)).toBe(false);
      expect(() => JSON.parse(fs.readFileSync(f, 'utf-8'))).not.toThrow();
    }
  });

  it('⭐ [구버전 이관] 세 사본이 모두 진짜 v1 이면 예전 사용자로 보고 정상 이관한다', async () => {
    const old = { date: '2026-08-04', publish: 1, lastSeenDate: '2026-08-04' };
    const v1 = JSON.stringify({ ...old, _sig: signV1(old) });
    fs.mkdirSync(path.dirname(MIRROR), { recursive: true });
    for (const f of [MAIN, BACKUP, MIRROR]) fs.writeFileSync(f, v1, 'utf-8');

    expect(await Q.getUsageToday()).toBe(0);
    expect(await Q.canConsume(LIMIT)).toBe(true);
  });
});
