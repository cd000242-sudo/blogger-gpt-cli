"use strict";
// electron/oneclick/handlers/infraHandlers.ts
// IPC: 인프라 세팅 (Cloudways DNS + SSL) — 4채널
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInfraHandlers = registerInfraHandlers;
const electron_1 = require("electron");
const instances_1 = require("../state/instances");
const cloudwaysInfra_1 = require("../automation/cloudwaysInfra");
function registerInfraHandlers() {
    // 인프라 세팅 시작
    electron_1.ipcMain.handle('oneclick:start-infra', async (_evt, args) => {
        try {
            const { domain, email, preferredAppId } = args;
            if (!domain || !email) {
                return { ok: false, error: '도메인과 이메일이 필요합니다.' };
            }
            // 🛡️ 중복 실행 차단
            if (instances_1.infraStateManager.isBusy('infra')) {
                return { ok: false, error: '인프라 세팅이 이미 진행 중입니다.' };
            }
            await instances_1.infraStateManager.reset('infra');
            const state = instances_1.infraStateManager.getOrCreate('infra', () => ({
                currentStep: 0,
                totalSteps: 5,
                stepStatus: 'idle',
                message: '',
                completed: false,
                cancelled: false,
                error: null,
                browser: null,
                page: null,
            }));
            console.log(`[ONECLICK-INFRA] 🚀 인프라 세팅 시작: ${domain} / ${email}`);
            const run = async () => {
                try {
                    const waitForLogin = (key, timeout) => instances_1.infraStateManager.waitForLogin(key, timeout);
                    await (0, cloudwaysInfra_1.runCloudwaysInfraSetup)(state, domain, email, waitForLogin, { preferredAppId });
                }
                catch (e) {
                    console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 오류:', e);
                    state.error = e instanceof Error ? e.message : String(e);
                    state.stepStatus = 'error';
                }
            };
            run().catch((e) => console.error('[ONECLICK-INFRA] Unhandled:', e));
            return { ok: true, totalSteps: 5 };
        }
        catch (error) {
            console.error('[ONECLICK-INFRA] ❌ 인프라 세팅 시작 실패:', error);
            return { ok: false, error: error instanceof Error ? error.message : '인프라 세팅 시작 실패' };
        }
    });
    // 인프라 상태 조회
    electron_1.ipcMain.handle('oneclick:get-infra-status', async () => {
        const state = instances_1.infraStateManager.get('infra');
        if (!state) {
            return { ok: false, error: '실행 중인 인프라 세팅이 없습니다' };
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
    // 인프라 세팅 취소
    electron_1.ipcMain.handle('oneclick:cancel-infra', async () => {
        const state = instances_1.infraStateManager.get('infra');
        if (state) {
            state.cancelled = true;
            state.stepStatus = 'error';
            state.message = '사용자가 취소함';
            await instances_1.infraStateManager.reset('infra');
        }
        return { ok: true };
    });
    // 인프라 로그인 확인
    electron_1.ipcMain.handle('oneclick:confirm-infra-login', async () => {
        instances_1.infraStateManager.confirmLogin('infra');
        return { ok: true };
    });
}
