// electron/oneclick/handlers/setupHandlers.ts
// IPC: 플랫폼 세팅 (Blogspot / WordPress) — 4채널

import { ipcMain } from 'electron';
import { setupStateManager } from '../state/instances';
import type { SetupState } from '../types';
import { runBlogspotSetup } from '../automation/blogspot/blogspotSetup';
import { runWordPressSetup } from '../automation/wordpressSetup';

export function registerSetupHandlers(): void {
  // 세팅 시작
  ipcMain.handle('oneclick:start-setup', async (_evt, args: { platform: string; adminUrl: string; steps: string[]; blogspotConfig?: any }) => {
    try {
      const { platform, adminUrl, steps, blogspotConfig } = args;

      setupStateManager.reset(platform);
      const state = setupStateManager.getOrCreate(platform, (): SetupState => ({
        platform,
        currentStep: 0,
        totalSteps: steps.length,
        stepStatus: 'idle',
        message: '',
        completed: false,
        cancelled: false,
        error: null,
        browser: null,
        page: null,
      }));

      console.log(`[ONECLICK] 🚀 ${platform} 세팅 시작, 총 ${steps.length}단계`);

      const waitForLogin = (p: string) => setupStateManager.waitForLogin(p);

      const run = async () => {
        try {
          switch (platform) {
            case 'blogspot':
              await runBlogspotSetup(state, adminUrl || 'https://www.blogger.com/', blogspotConfig, waitForLogin);
              break;
            case 'wordpress':
              await runWordPressSetup(state, adminUrl || '', waitForLogin);
              break;
            default:
              state.error = `지원하지 않는 플랫폼: ${platform}`;
              state.stepStatus = 'error';
          }
        } catch (e) {
          console.error(`[ONECLICK] ❌ ${platform} 세팅 오류:`, e);
          state.error = e instanceof Error ? e.message : String(e);
          state.stepStatus = 'error';
        }
      };
      run().catch((e) => console.error('[ONECLICK] Unhandled:', e));

      return { ok: true, totalSteps: steps.length };
    } catch (error) {
      console.error('[ONECLICK] ❌ 세팅 시작 실패:', error);
      return { ok: false, error: error instanceof Error ? error.message : '세팅 시작 실패' };
    }
  });

  // 상태 조회
  ipcMain.handle('oneclick:get-status', async (_evt, args: { platform: string }) => {
    const state = setupStateManager.get(args.platform);
    if (!state) {
      return { ok: false, error: '실행 중인 세팅이 없습니다' };
    }

    return {
      ok: true,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error,
    };
  });

  // 세팅 취소
  ipcMain.handle('oneclick:cancel', async (_evt, args: { platform: string }) => {
    const state = setupStateManager.get(args.platform);
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      setupStateManager.reset(args.platform);
    }
    return { ok: true };
  });

  // 로그인 완료 확인
  ipcMain.handle('oneclick:confirm-login', async (_evt, args: { platform: string }) => {
    const { platform } = args;
    console.log(`[ONECLICK] 🔔 로그인 완료 확인 수신: ${platform}`);

    const resolved = setupStateManager.confirmLogin(platform);
    if (resolved) {
      return { ok: true };
    } else {
      console.log(`[ONECLICK] ⚠️ 로그인 대기 중인 세팅 없음: ${platform}`);
      return { ok: false, error: '로그인 대기 중인 세팅이 없습니다' };
    }
  });
}
