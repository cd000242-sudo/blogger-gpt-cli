"use strict";
// electron/oneclick/handlers/webmasterHandlers.ts
// IPC: 웹마스터 도구 자동화 — 3채널
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebmasterHandlers = registerWebmasterHandlers;
const electron_1 = require("electron");
const instances_1 = require("../state/instances");
const browser_1 = require("../utils/browser");
const googleSearchConsole_1 = require("../automation/webmaster/googleSearchConsole");
const naverSearchAdvisor_1 = require("../automation/webmaster/naverSearchAdvisor");
const daumWebmaster_1 = require("../automation/webmaster/daumWebmaster");
const bingWebmaster_1 = require("../automation/webmaster/bingWebmaster");
// ZUM 웹마스터 서비스 종료됨 (2026-04 확인: webmaster.zum.com DNS 해결 불가)
function registerWebmasterHandlers() {
    // 웹마스터 세팅 시작
    electron_1.ipcMain.handle('oneclick:start-webmaster', async (_evt, args) => {
        const { engine, blogUrl } = args;
        instances_1.webmasterStateManager.reset(engine);
        const state = instances_1.webmasterStateManager.getOrCreate(engine, () => ({
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
            const { browser, page } = await (0, browser_1.launchBrowser)({ viewport: { width: 1280, height: 900 } });
            state.browser = browser;
            state.page = page;
            const run = async () => {
                try {
                    switch (engine) {
                        case 'google':
                            await (0, googleSearchConsole_1.automateGoogleSearchConsole)(state, page, blogUrl);
                            break;
                        case 'naver':
                            await (0, naverSearchAdvisor_1.automateNaverSearchAdvisor)(state, page, blogUrl);
                            break;
                        case 'daum':
                            await (0, daumWebmaster_1.automateDaumWebmaster)(state, page, blogUrl);
                            break;
                        case 'bing':
                            await (0, bingWebmaster_1.automateBingWebmaster)(state, page, blogUrl);
                            break;
                        case 'zum': throw new Error('ZUM 웹마스터 서비스가 종료되었습니다.');
                        default: throw new Error(`지원하지 않는 엔진: ${engine}`);
                    }
                    if (!state.cancelled) {
                        state.completed = true;
                        state.stepStatus = 'done';
                        state.message = '세팅 완료!';
                    }
                }
                catch (err) {
                    if (!state.cancelled) {
                        state.error = err instanceof Error ? err.message : String(err);
                        state.stepStatus = 'error';
                        state.message = `오류: ${state.error}`;
                    }
                }
                finally {
                    setTimeout(async () => {
                        try {
                            await browser.close();
                        }
                        catch { /* ignore */ }
                    }, 10000);
                }
            };
            run().catch((e) => console.error('[ONECLICK-WEBMASTER] Unhandled:', e));
            return { ok: true };
        }
        catch (error) {
            state.error = error instanceof Error ? error.message : '세팅 시작 실패';
            state.stepStatus = 'error';
            return { ok: false, error: state.error };
        }
    });
    // 웹마스터 상태 조회
    electron_1.ipcMain.handle('oneclick:get-webmaster-status', async (_evt, args) => {
        const state = instances_1.webmasterStateManager.get(args.engine);
        if (!state)
            return { ok: false, error: '실행 중인 세팅이 없습니다' };
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
    electron_1.ipcMain.handle('oneclick:cancel-webmaster', async (_evt, args) => {
        const state = instances_1.webmasterStateManager.get(args.engine);
        if (state) {
            state.cancelled = true;
            state.stepStatus = 'error';
            state.message = '사용자가 취소함';
            instances_1.webmasterStateManager.reset(args.engine);
        }
        return { ok: true };
    });
}
