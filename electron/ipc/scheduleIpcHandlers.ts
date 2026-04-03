/**
 * 스케줄 관리 IPC 핸들러
 * electron/main.ts에서 분리
 */
import { ipcMain } from 'electron';

function getManager() {
  const { getScheduleManager } = require('../../src/core/schedule-manager');
  return getScheduleManager();
}

function wrapError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function registerScheduleIpcHandlers(): void {
  ipcMain.handle('get-schedules', async () => {
    try {
      const manager = getManager();
      return { ok: true, schedules: manager.getAllSchedules() };
    } catch (error) {
      console.error('[SCHEDULE] 조회 실패:', error);
      return { ok: false, error: wrapError(error, '조회 실패'), schedules: [] };
    }
  });

  ipcMain.handle('add-schedule', async (_evt, schedule) => {
    try {
      const manager = getManager();
      const id = manager.addSchedule(schedule);
      return { ok: true, schedule: manager.getSchedule(id) };
    } catch (error) {
      console.error('[SCHEDULE] 추가 실패:', error);
      return { ok: false, error: wrapError(error, '추가 실패') };
    }
  });

  ipcMain.handle('toggle-schedule', async (_evt, id, enabled) => {
    try {
      const manager = getManager();
      manager.updateSchedule(id, { status: enabled ? 'pending' : 'cancelled' });
      return { ok: true };
    } catch (error) {
      console.error('[SCHEDULE] 토글 실패:', error);
      return { ok: false, error: wrapError(error, '토글 실패') };
    }
  });

  ipcMain.handle('delete-schedule', async (_evt, id) => {
    try {
      const manager = getManager();
      return { ok: manager.deleteSchedule(id) };
    } catch (error) {
      console.error('[SCHEDULE] 삭제 실패:', error);
      return { ok: false, error: wrapError(error, '삭제 실패') };
    }
  });

  ipcMain.handle('get-schedule-status', async () => {
    try {
      const manager = getManager();
      return { ok: true, status: manager.getScheduleStatus() };
    } catch (error) {
      console.error('[SCHEDULE] 상태 조회 실패:', error);
      return { ok: false, error: wrapError(error, '상태 조회 실패'), status: null };
    }
  });

  ipcMain.handle('start-schedule-monitoring', async () => {
    try {
      const manager = getManager();
      manager.startMonitoring();
      return { ok: true };
    } catch (error) {
      console.error('[SCHEDULE] 모니터링 시작 실패:', error);
      return { ok: false, error: wrapError(error, '모니터링 시작 실패') };
    }
  });

  ipcMain.handle('stop-schedule-monitoring', async () => {
    try {
      const manager = getManager();
      manager.stopMonitoring();
      return { ok: true };
    } catch (error) {
      console.error('[SCHEDULE] 모니터링 중지 실패:', error);
      return { ok: false, error: wrapError(error, '모니터링 중지 실패') };
    }
  });

  ipcMain.handle('cleanup-schedules', async (_evt, daysToKeep = 30) => {
    try {
      const manager = getManager();
      return { ok: true, deletedCount: manager.cleanupOldSchedules(daysToKeep) };
    } catch (error) {
      console.error('[SCHEDULE] 정리 실패:', error);
      return { ok: false, error: wrapError(error, '정리 실패') };
    }
  });
}
