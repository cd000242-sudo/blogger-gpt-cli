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
      stepResults: state.stepResults || [],
    };
  });

  // 🔁 Step 단위 재시도 — 특정 step부터 다시 실행 (처음부터 재시작 불필요)
  ipcMain.handle('oneclick:retry-step', async (_evt, args: { platform: string; fromStep: number; blogspotConfig?: any }) => {
    try {
      const { platform, fromStep, blogspotConfig } = args;
      const existing = setupStateManager.get(platform);
      if (!existing) {
        return { ok: false, error: '원본 세팅 기록이 없습니다 — 전체 실행부터 다시 시작하세요' };
      }
      const savedResults = existing.stepResults || [];
      setupStateManager.reset(platform);

      const state = setupStateManager.getOrCreate(platform, (): SetupState => ({
        platform,
        currentStep: fromStep,
        totalSteps: existing.totalSteps,
        stepStatus: 'idle',
        message: `🔁 Step ${fromStep}부터 재시도`,
        completed: false,
        cancelled: false,
        error: null,
        browser: null,
        page: null,
        stepResults: savedResults.filter(r => r.index < fromStep),
        resumeFromStep: fromStep,
      }));

      console.log(`[ONECLICK] 🔁 ${platform} Step ${fromStep}부터 재시도`);
      const waitForLogin = (p: string) => setupStateManager.waitForLogin(p);

      const run = async () => {
        try {
          if (platform === 'blogspot') {
            await runBlogspotSetup(state, 'https://www.blogger.com/', blogspotConfig, waitForLogin);
          } else {
            state.error = `retry-step은 현재 blogspot만 지원합니다 (요청 플랫폼: ${platform})`;
            state.stepStatus = 'error';
          }
        } catch (e) {
          state.error = e instanceof Error ? e.message : String(e);
          state.stepStatus = 'error';
        }
      };
      run().catch((e) => console.error('[ONECLICK] retry-step Unhandled:', e));
      return { ok: true, fromStep };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '재시도 실패' };
    }
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
