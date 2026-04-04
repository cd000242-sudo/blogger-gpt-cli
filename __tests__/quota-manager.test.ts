/**
 * __tests__/quota-manager.test.ts
 * quota-manager 단위 테스트 — 서명, 변조 감지, 롤백, consume/refund
 */

// electron app 모킹
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-quota'),
    isPackaged: false,
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// 테스트 전 파일 정리
const QUOTA_DIR = '/tmp/test-quota';
const QUOTA_FILE = path.join(QUOTA_DIR, 'quota-state.json');
const BACKUP_FILE = path.join(QUOTA_DIR, 'quota-state.backup.json');

function cleanQuotaFiles() {
  try { fs.unlinkSync(QUOTA_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(BACKUP_FILE); } catch { /* ignore */ }
}

function writeRawQuotaFile(data: any, file: string = QUOTA_FILE) {
  if (!fs.existsSync(QUOTA_DIR)) {
    fs.mkdirSync(QUOTA_DIR, { recursive: true });
  }
  fs.writeFileSync(file, JSON.stringify(data), 'utf-8');
}

function getToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 테스트용 서명 생성 (quota-manager 내부 로직 복제)
function computeTestSignature(state: { date: string; publish: number; lastSeenDate?: string }): string {
  const salt = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');
  const payload = JSON.stringify({
    d: state.date,
    p: state.publish,
    l: state.lastSeenDate || state.date,
  });
  return crypto.createHmac('sha256', salt).update(payload).digest('hex').substring(0, 16);
}

describe('QuotaManager', () => {
  let quotaManager: typeof import('../electron/quota-manager');

  beforeEach(() => {
    cleanQuotaFiles();
    // 모듈 캐시 초기화 (매 테스트마다 fresh state)
    jest.resetModules();
    quotaManager = require('../electron/quota-manager');
  });

  afterAll(() => {
    cleanQuotaFiles();
  });

  // ── 초기 상태 ──

  it('첫 실행: 파일 없으면 사용량 0', async () => {
    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(0);
  });

  it('첫 실행: isPaywalled = false', async () => {
    const status = await quotaManager.getQuotaStatus(2);
    expect(status.isPaywalled).toBe(false);
    expect(status.usage).toBe(0);
    expect(status.limit).toBe(2);
  });

  // ── consume / refund ──

  it('consume: 사용량 증가', async () => {
    await quotaManager.consume(1);
    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(1);
  });

  it('consume 2회: 한도 도달', async () => {
    await quotaManager.consume(1);
    await quotaManager.consume(1);
    const status = await quotaManager.getQuotaStatus(2);
    expect(status.usage).toBe(2);
    expect(status.isPaywalled).toBe(true);
  });

  it('canConsume: 한도 내 true, 초과 false', async () => {
    expect(await quotaManager.canConsume(2, 1)).toBe(true);
    await quotaManager.consume(1);
    expect(await quotaManager.canConsume(2, 1)).toBe(true);
    await quotaManager.consume(1);
    expect(await quotaManager.canConsume(2, 1)).toBe(false);
  });

  it('refund: 사용량 감소 (최소 0)', async () => {
    await quotaManager.consume(1);
    await quotaManager.refund(1);
    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(0);
  });

  it('refund: 0 이하로 내려가지 않음', async () => {
    await quotaManager.refund(5);
    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(0);
  });

  // ── 날짜 변경 (리셋) ──

  it('다른 날짜의 파일 → 리셋', async () => {
    const yesterday = '2020-01-01';
    const sig = computeTestSignature({ date: yesterday, publish: 5, lastSeenDate: yesterday });
    writeRawQuotaFile({ date: yesterday, publish: 5, lastSeenDate: yesterday, _sig: sig });

    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(0); // 리셋됨
  });

  // ── 변조 감지 ──

  it('서명 불일치 → 강제 차단 (999)', async () => {
    const today = getToday();
    writeRawQuotaFile({ date: today, publish: 0, lastSeenDate: today, _sig: 'tampered_signature' });

    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(999); // TAMPERED_STATE
  });

  it('JSON 파싱 실패 → 강제 차단', async () => {
    if (!fs.existsSync(QUOTA_DIR)) fs.mkdirSync(QUOTA_DIR, { recursive: true });
    fs.writeFileSync(QUOTA_FILE, 'not valid json!!!', 'utf-8');

    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(999); // TAMPERED_STATE
  });

  // ── 날짜 롤백 감지 ──

  it('날짜 롤백 → 기존 사용량 유지', async () => {
    // 미래 날짜로 저장 (lastSeenDate가 오늘보다 미래)
    const futureDate = '2099-12-31';
    const sig = computeTestSignature({ date: futureDate, publish: 1, lastSeenDate: futureDate });
    writeRawQuotaFile({ date: futureDate, publish: 1, lastSeenDate: futureDate, _sig: sig });

    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(1); // 리셋되지 않고 기존 사용량 유지
  });

  // ── 백업 복구 ──

  it('메인 파일 손상 → 백업에서 복구', async () => {
    const today = getToday();
    const sig = computeTestSignature({ date: today, publish: 1, lastSeenDate: today });

    // 백업에만 유효한 데이터 저장
    writeRawQuotaFile({ date: today, publish: 1, lastSeenDate: today, _sig: sig }, BACKUP_FILE);
    // 메인은 손상
    if (!fs.existsSync(QUOTA_DIR)) fs.mkdirSync(QUOTA_DIR, { recursive: true });
    fs.writeFileSync(QUOTA_FILE, 'corrupted!!!', 'utf-8');

    const usage = await quotaManager.getUsageToday();
    expect(usage).toBe(1); // 백업에서 복구
  });

  // ── 듀얼 저장 ──

  it('consume 후 메인+백업 모두 저장됨', async () => {
    await quotaManager.consume(1);

    expect(fs.existsSync(QUOTA_FILE)).toBe(true);
    expect(fs.existsSync(BACKUP_FILE)).toBe(true);

    const mainData = JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf-8'));
    const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));

    expect(mainData.publish).toBe(1);
    expect(backupData.publish).toBe(1);
    expect(mainData._sig).toBe(backupData._sig);
  });
});
