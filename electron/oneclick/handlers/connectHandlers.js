"use strict";
// @ts-nocheck
// electron/oneclick/handlers/connectHandlers.ts
// IPC: 플랫폼 연동 (WordPress App Password / Blogger OAuth) — 3채널
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConnectHandlers = registerConnectHandlers;
const electron_1 = require("electron");
const instances_1 = require("../state/instances");
const browser_1 = require("../utils/browser");
const wordpressConnect_1 = require("../automation/connect/wordpressConnect");
const bloggerConnect_1 = require("../automation/connect/bloggerConnect");
function registerConnectHandlers() {
    // 플랫폼 연동 시작
    electron_1.ipcMain.handle('oneclick:platform-connect', async (_evt, args) => {
        const { platform, siteUrl } = args;
        instances_1.connectStateManager.reset(platform);
        const state = instances_1.connectStateManager.getOrCreate(platform, () => ({
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
            const { browser, page } = await (0, browser_1.launchBrowser)({ viewport: { width: 1280, height: 900 } });
            state.browser = browser;
            state.page = page;
            const run = async () => {
                try {
                    if (platform === 'wordpress') {
                        if (!siteUrl)
                            throw new Error('WordPress 사이트 URL이 필요합니다.');
                        await (0, wordpressConnect_1.automateWordPressConnect)(state, page, siteUrl);
                    }
                    else if (platform === 'blogger' || platform === 'blogspot') {
                        await (0, bloggerConnect_1.automateBloggerConnect)(state, page);
                    }
                    else {
                        throw new Error(`지원하지 않는 플랫폼: ${platform}`);
                    }
                    if (!state.cancelled) {
                        state.completed = true;
                        state.stepStatus = 'done';
                        if (!state.message.startsWith('⚠️')) {
                            state.message = '✅ 연동 완료! 추출된 값을 환경설정에 저장합니다.';
                        }
                    }
                }
                catch (err) {
                    if (!state.cancelled) {
                        state.error = err instanceof Error ? err.message : String(err);
                        state.stepStatus = 'error';
                        state.message = `❌ 오류: ${state.error}`;
                    }
                }
                finally {
                    setTimeout(async () => {
                        try {
                            await browser.close();
                        }
                        catch { /* ignore */ }
                    }, 30000);
                }
            };
            run().catch((e) => console.error('[ONECLICK-CONNECT] Unhandled:', e));
            return { ok: true };
        }
        catch (error) {
            state.error = error instanceof Error ? error.message : '연동 시작 실패';
            state.stepStatus = 'error';
            return { ok: false, error: state.error };
        }
    });
    // 연동 상태 조회
    electron_1.ipcMain.handle('oneclick:get-connect-status', async (_evt, args) => {
        const state = instances_1.connectStateManager.get(args.platform);
        if (!state)
            return { ok: false, error: '실행 중인 연동이 없습니다' };
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
    electron_1.ipcMain.handle('oneclick:cancel-connect', async (_evt, args) => {
        const state = instances_1.connectStateManager.get(args.platform);
        if (state) {
            state.cancelled = true;
            state.stepStatus = 'error';
            state.message = '사용자가 취소함';
            instances_1.connectStateManager.reset(args.platform);
        }
        return { ok: true };
    });
}
