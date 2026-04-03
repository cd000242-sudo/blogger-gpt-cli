"use strict";
// electron/oneclick/handlers/setupHandlers.ts
// IPC: 플랫폼 세팅 (Blogspot / WordPress) — 4채널
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSetupHandlers = registerSetupHandlers;
const electron_1 = require("electron");
const instances_1 = require("../state/instances");
const blogspotSetup_1 = require("../automation/blogspot/blogspotSetup");
const wordpressSetup_1 = require("../automation/wordpressSetup");
function registerSetupHandlers() {
    // 세팅 시작
    electron_1.ipcMain.handle('oneclick:start-setup', async (_evt, args) => {
        try {
            const { platform, adminUrl, steps, blogspotConfig } = args;
            instances_1.setupStateManager.reset(platform);
            const state = instances_1.setupStateManager.getOrCreate(platform, () => ({
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
            const waitForLogin = (p) => instances_1.setupStateManager.waitForLogin(p);
            const run = async () => {
                try {
                    switch (platform) {
                        case 'blogspot':
                            await (0, blogspotSetup_1.runBlogspotSetup)(state, adminUrl || 'https://www.blogger.com/', blogspotConfig, waitForLogin);
                            break;
                        case 'wordpress':
                            await (0, wordpressSetup_1.runWordPressSetup)(state, adminUrl || '', waitForLogin);
                            break;
                        default:
                            state.error = `지원하지 않는 플랫폼: ${platform}`;
                            state.stepStatus = 'error';
                    }
                }
                catch (e) {
                    console.error(`[ONECLICK] ❌ ${platform} 세팅 오류:`, e);
                    state.error = e instanceof Error ? e.message : String(e);
                    state.stepStatus = 'error';
                }
            };
            run().catch((e) => console.error('[ONECLICK] Unhandled:', e));
            return { ok: true, totalSteps: steps.length };
        }
        catch (error) {
            console.error('[ONECLICK] ❌ 세팅 시작 실패:', error);
            return { ok: false, error: error instanceof Error ? error.message : '세팅 시작 실패' };
        }
    });
    // 상태 조회
    electron_1.ipcMain.handle('oneclick:get-status', async (_evt, args) => {
        const state = instances_1.setupStateManager.get(args.platform);
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
    electron_1.ipcMain.handle('oneclick:cancel', async (_evt, args) => {
        const state = instances_1.setupStateManager.get(args.platform);
        if (state) {
            state.cancelled = true;
            state.stepStatus = 'error';
            state.message = '사용자가 취소함';
            instances_1.setupStateManager.reset(args.platform);
        }
        return { ok: true };
    });
    // 로그인 완료 확인
    electron_1.ipcMain.handle('oneclick:confirm-login', async (_evt, args) => {
        const { platform } = args;
        console.log(`[ONECLICK] 🔔 로그인 완료 확인 수신: ${platform}`);
        const resolved = instances_1.setupStateManager.confirmLogin(platform);
        if (resolved) {
            return { ok: true };
        }
        else {
            console.log(`[ONECLICK] ⚠️ 로그인 대기 중인 세팅 없음: ${platform}`);
            return { ok: false, error: '로그인 대기 중인 세팅이 없습니다' };
        }
    });
}
