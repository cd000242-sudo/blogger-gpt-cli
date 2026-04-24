"use strict";
// electron/oneclick/handlers/setupHandlers.ts
// IPC: 플랫폼 세팅 (Blogspot / WordPress) — 4채널
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSetupHandlers = registerSetupHandlers;
const electron_1 = require("electron");
const instances_1 = require("../state/instances");
const blogspotSetup_1 = require("../automation/blogspot/blogspotSetup");
const wordpressSetup_1 = require("../automation/wordpressSetup");
const persistence_1 = require("../state/persistence");
function registerSetupHandlers() {
    // 세팅 시작
    electron_1.ipcMain.handle('oneclick:start-setup', async (_evt, args) => {
        try {
            const { platform, adminUrl, steps, blogspotConfig } = args;
            // 🛡️ 중복 실행 차단 — 같은 플랫폼이 이미 running/waiting-login 이면 거절
            //    (이중 Playwright 브라우저 실행 + profile lock 충돌 방지)
            if (instances_1.setupStateManager.isBusy(platform)) {
                console.warn(`[ONECLICK] ⛔ ${platform} 세팅이 이미 실행 중 — 중복 호출 차단`);
                return { ok: false, error: `${platform} 세팅이 이미 실행 중입니다. 완료하거나 취소한 뒤 다시 시도하세요.` };
            }
            await instances_1.setupStateManager.reset(platform);
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
            stepResults: state.stepResults || [],
        };
    });
    // 🔁 Step 단위 재시도 — 특정 step부터 다시 실행 (처음부터 재시작 불필요)
    electron_1.ipcMain.handle('oneclick:retry-step', async (_evt, args) => {
        try {
            const { platform, fromStep, blogspotConfig } = args;
            // 🛡️ 중복 차단 — 이미 running 상태면 재시도 요청 거절
            if (instances_1.setupStateManager.isBusy(platform)) {
                return { ok: false, error: `${platform} 세팅이 진행 중입니다. 완료 또는 취소 후 재시도하세요.` };
            }
            // 🛡️ TOCTOU 경합 방지 — existing 읽기와 reset 사이에 다른 IPC가 끼어들어 stepResults가 유실되지 않도록
            //    savedResults를 먼저 복사하고 reset을 await 해서 완료된 뒤에만 새 state 생성
            const existing = instances_1.setupStateManager.get(platform);
            if (!existing) {
                return { ok: false, error: '원본 세팅 기록이 없습니다 — 전체 실행부터 다시 시작하세요' };
            }
            const savedResults = [...(existing.stepResults || [])];
            const savedTotalSteps = existing.totalSteps;
            await instances_1.setupStateManager.reset(platform);
            const state = instances_1.setupStateManager.getOrCreate(platform, () => ({
                platform,
                currentStep: fromStep,
                totalSteps: savedTotalSteps,
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
            const waitForLogin = (p) => instances_1.setupStateManager.waitForLogin(p);
            const run = async () => {
                try {
                    if (platform === 'blogspot') {
                        await (0, blogspotSetup_1.runBlogspotSetup)(state, 'https://www.blogger.com/', blogspotConfig, waitForLogin);
                    }
                    else {
                        state.error = `retry-step은 현재 blogspot만 지원합니다 (요청 플랫폼: ${platform})`;
                        state.stepStatus = 'error';
                    }
                }
                catch (e) {
                    state.error = e instanceof Error ? e.message : String(e);
                    state.stepStatus = 'error';
                }
            };
            run().catch((e) => console.error('[ONECLICK] retry-step Unhandled:', e));
            return { ok: true, fromStep };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '재시도 실패' };
        }
    });
    // 세팅 취소
    electron_1.ipcMain.handle('oneclick:cancel', async (_evt, args) => {
        const state = instances_1.setupStateManager.get(args.platform);
        if (state) {
            state.cancelled = true;
            state.stepStatus = 'error';
            state.message = '사용자가 취소함';
            await instances_1.setupStateManager.reset(args.platform);
        }
        return { ok: true };
    });
    // 🗂️ 재개 가능한 체크포인트 조회 — 앱 시작 시 UI가 호출해서 "이어서 계속하시겠습니까?" 모달 표시용
    electron_1.ipcMain.handle('oneclick:get-resume-info', async () => {
        try {
            const checkpoints = (0, persistence_1.getResumableCheckpoints)();
            return { ok: true, checkpoints };
        }
        catch (e) {
            return { ok: false, error: e?.message || '체크포인트 조회 실패', checkpoints: [] };
        }
    });
    // 🗑️ 체크포인트 삭제 — 사용자가 "처음부터 다시"를 선택한 경우
    electron_1.ipcMain.handle('oneclick:clear-checkpoint', async (_evt, args) => {
        try {
            (0, persistence_1.clearCheckpoint)(args.platform);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e?.message || '삭제 실패' };
        }
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
