/**
 * __tests__/integration/quota-ipc.test.ts
 * 쿼터 시스템 통합 테스트 — IPC 핸들러 + quota-manager + auth-utils 연동
 */

// Electron 모킹
jest.mock('electron', () => {
  const handlers = new Map<string, Function>();
  return {
    app: {
      getPath: jest.fn(() => '/tmp/test-quota-ipc'),
      isPackaged: true, // 패키지 모드로 테스트 (체험판 활성)
    },
    ipcMain: {
      handle: jest.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
    },
    BrowserWindow: { getFocusedWindow: jest.fn(), getAllWindows: jest.fn(() => []) },
    dialog: { showOpenDialog: jest.fn() },
    ipcRenderer: { invoke: jest.fn(), on: jest.fn(), off: jest.fn() },
    contextBridge: { exposeInMainWorld: jest.fn() },
    _getHandler: (channel: string) => handlers.get(channel),
  };
});

import * as fs from 'fs';
import * as path from 'path';

const QUOTA_DIR = '/tmp/test-quota-ipc';
const QUOTA_FILE = path.join(QUOTA_DIR, 'quota-state.json');
const BACKUP_FILE = path.join(QUOTA_DIR, 'quota-state.backup.json');

function cleanFiles() {
  try { fs.unlinkSync(QUOTA_FILE); } catch { /* ignore */ }
  try { fs.unlinkSync(BACKUP_FILE); } catch { /* ignore */ }
}

describe('Quota IPC Integration', () => {
  beforeEach(() => {
    cleanFiles();
    jest.resetModules();
  });

  afterAll(() => {
    cleanFiles();
  });

  it('consume → getQuotaStatus → isPaywalled 플로우', async () => {
    const quotaManager = require('../../electron/quota-manager');

    // 초기 상태: 0/2
    const status0 = await quotaManager.getQuotaStatus(2);
    expect(status0.usage).toBe(0);
    expect(status0.isPaywalled).toBe(false);

    // 1회 소비
    await quotaManager.consume(1);
    const status1 = await quotaManager.getQuotaStatus(2);
    expect(status1.usage).toBe(1);
    expect(status1.isPaywalled).toBe(false);

    // 2회 소비 → 페이월
    await quotaManager.consume(1);
    const status2 = await quotaManager.getQuotaStatus(2);
    expect(status2.usage).toBe(2);
    expect(status2.isPaywalled).toBe(true);
  });

  it('consume → refund → 복구', async () => {
    const quotaManager = require('../../electron/quota-manager');

    await quotaManager.consume(1);
    expect(await quotaManager.getUsageToday()).toBe(1);

    await quotaManager.refund(1);
    expect(await quotaManager.getUsageToday()).toBe(0);
  });

  it('페이월 상태에서 canConsume = false', async () => {
    const quotaManager = require('../../electron/quota-manager');

    await quotaManager.consume(1);
    await quotaManager.consume(1);

    const canUse = await quotaManager.canConsume(2, 1);
    expect(canUse).toBe(false);
  });

  it('전체 플로우: 2회 소비 → 페이월 → 환불 → 복구', async () => {
    const quotaManager = require('../../electron/quota-manager');

    // 2회 소비 → 페이월
    await quotaManager.consume(1);
    await quotaManager.consume(1);
    const paywalled = await quotaManager.getQuotaStatus(2);
    expect(paywalled.isPaywalled).toBe(true);
    expect(await quotaManager.canConsume(2)).toBe(false);

    // 1회 환불 → 다시 사용 가능
    await quotaManager.refund(1);
    const recovered = await quotaManager.getQuotaStatus(2);
    expect(recovered.isPaywalled).toBe(false);
    expect(recovered.usage).toBe(1);
    expect(await quotaManager.canConsume(2)).toBe(true);
  });
});
