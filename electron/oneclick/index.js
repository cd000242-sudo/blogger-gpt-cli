"use strict";
// electron/oneclick/index.ts
// 원클릭 세팅 모듈 엔트리포인트 — IPC 핸들러 통합 등록
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOneclickSetupIpcHandlers = registerOneclickSetupIpcHandlers;
const setupHandlers_1 = require("./handlers/setupHandlers");
const webmasterHandlers_1 = require("./handlers/webmasterHandlers");
const connectHandlers_1 = require("./handlers/connectHandlers");
const infraHandlers_1 = require("./handlers/infraHandlers");
const dialogHandler_1 = require("./handlers/dialogHandler");
const verifyHandlers_1 = require("./handlers/verifyHandlers");
/**
 * 원클릭 세팅 IPC 핸들러 15개를 등록한다.
 * - 세팅: 4채널 (start-setup, get-status, cancel, confirm-login)
 * - 웹마스터: 3채널 (start-webmaster, get-webmaster-status, cancel-webmaster)
 * - 연동: 3채널 (platform-connect, get-connect-status, cancel-connect)
 * - 인프라: 4채널 (start-infra, get-infra-status, cancel-infra, confirm-infra-login)
 * - 다이얼로그: 1채널 (dialog:open-file)
 */
function registerOneclickSetupIpcHandlers() {
    console.log('[ONECLICK-IPC] 🚀 원클릭 세팅 IPC 핸들러 등록 시작...');
    (0, setupHandlers_1.registerSetupHandlers)();
    (0, webmasterHandlers_1.registerWebmasterHandlers)();
    (0, connectHandlers_1.registerConnectHandlers)();
    (0, infraHandlers_1.registerInfraHandlers)();
    (0, dialogHandler_1.registerDialogHandler)();
    (0, verifyHandlers_1.registerVerifyIpcHandlers)();
    console.log('[ONECLICK-IPC] ✅ 원클릭 세팅 IPC 핸들러 18개 등록 완료');
}
