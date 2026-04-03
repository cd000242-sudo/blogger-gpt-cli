// @ts-nocheck
// electron/oneclick/handlers/webmasterHandlers.ts
// IPC: 웹마스터 도구 자동화 — 3채널

import { ipcMain } from 'electron';
import { webmasterStateManager } from '../state/instances';
import type { WebmasterState } from '../types';
import { launchBrowser } from '../utils/browser';
import { automateGoogleSearchConsole } from '../automation/webmaster/googleSearchConsole';
import { automateNaverSearchAdvisor } from '../automation/webmaster/naverSearchAdvisor';
import { automateDaumWebmaster } from '../automation/webmaster/daumWebmaster';
import { automateBingWebmaster } from '../automation/webmaster/bingWebmaster';
import { automateZumWebmaster } from '../automation/webmaster/zumWebmaster';

export function registerWebmasterHandlers(): void {
  // 웹마스터 세팅 시작
  ipcMain.handle('oneclick:start-webmaster', async (_evt, args: { engine: string; blogUrl: string }) => {
    const { engine, blogUrl } = args;

    webmasterStateManager.reset(engine);
    const state = webmasterStateManager.getOrCreate(engine, (): WebmasterState => ({
      engine,
      blogUrl,
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
          switch (engine) {
            case 'google': await automateGoogleSearchConsole(state, page, blogUrl); break;
            case 'naver': await automateNaverSearchAdvisor(state, page, blogUrl); break;
            case 'daum': await automateDaumWebmaster(state, page, blogUrl); break;
            case 'bing': await automateBingWebmaster(state, page, blogUrl); break;
            case 'zum': await automateZumWebmaster(state, page, blogUrl); break;
            default: throw new Error(`지원하지 않는 엔진: ${engine}`);
          }

          if (!state.cancelled) {
            state.completed = true;
            state.stepStatus = 'done';
            state.message = '세팅 완료!';
          }
        } catch (err) {
          if (!state.cancelled) {
            state.error = err instanceof Error ? err.message : String(err);
            state.stepStatus = 'error';
            state.message = `오류: ${state.error}`;
          }
        } finally {
          setTimeout(async () => {
            try { await browser.close(); } catch { /* ignore */ }
          }, 10000);
        }
      };
      run().catch((e) => console.error('[ONECLICK-WEBMASTER] Unhandled:', e));

      return { ok: true };
    } catch (error) {
      state.error = error instanceof Error ? error.message : '세팅 시작 실패';
      state.stepStatus = 'error';
      return { ok: false, error: state.error };
    }
  });

  // 웹마스터 상태 조회
  ipcMain.handle('oneclick:get-webmaster-status', async (_evt, args: { engine: string }) => {
    const state = webmasterStateManager.get(args.engine);
    if (!state) return { ok: false, error: '실행 중인 세팅이 없습니다' };

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

  // 웹마스터 취소
  ipcMain.handle('oneclick:cancel-webmaster', async (_evt, args: { engine: string }) => {
    const state = webmasterStateManager.get(args.engine);
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      webmasterStateManager.reset(args.engine);
    }
    return { ok: true };
  });
}
