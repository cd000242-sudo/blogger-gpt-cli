// electron/oneclick/handlers/connectHandlers.ts
// IPC: 플랫폼 연동 (WordPress App Password / Blogger OAuth) — 3채널

import { ipcMain } from 'electron';
import { connectStateManager } from '../state/instances';
import type { ConnectState } from '../types';
import { launchBrowser } from '../utils/browser';
import { automateWordPressConnect } from '../automation/connect/wordpressConnect';
import { automateBloggerConnect } from '../automation/connect/bloggerConnect';

export function registerConnectHandlers(): void {
  // 플랫폼 연동 시작
  ipcMain.handle('oneclick:platform-connect', async (_evt, args: { platform: string; siteUrl?: string }) => {
    const { platform, siteUrl } = args;

    await connectStateManager.reset(platform);
    const state = connectStateManager.getOrCreate(platform, (): ConnectState => ({
      platform,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      results: null,
      browser: null,
      page: null,
    }));

    try {
      state.stepStatus = 'running';
      state.message = '브라우저를 여는 중...';

      const { browser, page } = await launchBrowser({ viewport: { width: 1280, height: 900 } });
      state.browser = browser;
      state.page = page;

      const run = async () => {
        try {
          if (platform === 'wordpress') {
            if (!siteUrl) throw new Error('WordPress 사이트 URL이 필요합니다.');
            await automateWordPressConnect(state, page, siteUrl);
          } else if (platform === 'blogger' || platform === 'blogspot') {
            await automateBloggerConnect(state, page);
          } else {
            throw new Error(`지원하지 않는 플랫폼: ${platform}`);
          }

          if (!state.cancelled) {
            state.completed = true;
            state.stepStatus = 'done';
            if (!state.message.startsWith('⚠️')) {
              state.message = '✅ 연동 완료! 추출된 값을 환경설정에 저장합니다.';
            }
          }
        } catch (err) {
          if (!state.cancelled) {
            state.error = err instanceof Error ? err.message : String(err);
            state.stepStatus = 'error';
            state.message = `❌ 오류: ${state.error}`;
          }
        } finally {
          // 완료 후 3초 뒤 브라우저 자동 닫기
          setTimeout(async () => {
            try { await browser.close(); } catch { /* ignore */ }
          }, 3000);
        }
      };
      run().catch((e) => console.error('[ONECLICK-CONNECT] Unhandled:', e));

      return { ok: true };
    } catch (error) {
      state.error = error instanceof Error ? error.message : '연동 시작 실패';
      state.stepStatus = 'error';
      return { ok: false, error: state.error };
    }
  });

  // 연동 상태 조회
  ipcMain.handle('oneclick:get-connect-status', async (_evt, args: { platform: string }) => {
    const state = connectStateManager.get(args.platform);
    if (!state) return { ok: false, error: '실행 중인 연동이 없습니다' };

    return {
      ok: true,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error,
      results: state.results,
    };
  });

  // 연동 취소
  ipcMain.handle('oneclick:cancel-connect', async (_evt, args: { platform: string }) => {
    const state = connectStateManager.get(args.platform);
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      await connectStateManager.reset(args.platform);
    }
    return { ok: true };
  });
}
