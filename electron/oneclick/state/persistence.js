"use strict";
// electron/oneclick/state/persistence.ts
// 🗂️ 원클릭 세팅 체크포인트 persist — 앱 재시작 후 중단된 세팅을 이어서 재개할 수 있도록
//
// 파일 위치: {userData}/oneclick-checkpoints.json
// 저장 트리거: 각 step 완료 시 / 에러 발생 시 / 취소 시
// 로드 트리거: 앱 시작 시 setupHandlers.ts의 get-resume-info IPC 호출
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCheckpoint = saveCheckpoint;
exports.loadAllCheckpoints = loadAllCheckpoints;
exports.loadCheckpoint = loadCheckpoint;
exports.clearCheckpoint = clearCheckpoint;
exports.getResumableCheckpoints = getResumableCheckpoints;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const CURRENT_VERSION = 1;
function getPath() {
    return path.join(electron_1.app.getPath('userData'), 'oneclick-checkpoints.json');
}
function saveCheckpoint(state, config) {
    try {
        const p = getPath();
        const all = loadAllCheckpoints();
        const cp = {
            platform: state.platform,
            currentStep: state.currentStep,
            totalSteps: state.totalSteps,
            stepStatus: state.stepStatus,
            message: state.message,
            completed: state.completed,
            error: state.error,
            stepResults: [...(state.stepResults || [])],
            config: config || undefined,
            savedAt: new Date().toISOString(),
            version: CURRENT_VERSION,
        };
        all[state.platform] = cp;
        fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
    }
    catch (e) {
        console.warn('[ONECLICK-PERSIST] 체크포인트 저장 실패:', e?.message);
    }
}
function loadAllCheckpoints() {
    try {
        const p = getPath();
        if (!fs.existsSync(p))
            return {};
        const content = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(content);
        return typeof parsed === 'object' && parsed ? parsed : {};
    }
    catch {
        return {};
    }
}
function loadCheckpoint(platform) {
    const all = loadAllCheckpoints();
    const cp = all[platform];
    if (!cp || cp.version !== CURRENT_VERSION)
        return null;
    return cp;
}
function clearCheckpoint(platform) {
    try {
        const p = getPath();
        const all = loadAllCheckpoints();
        delete all[platform];
        fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
    }
    catch { /* 무시 */ }
}
/**
 * 재개 가능한 체크포인트만 반환 — 완료된 것은 제외, 24시간 이상된 것은 무효화.
 */
function getResumableCheckpoints() {
    const all = loadAllCheckpoints();
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    return Object.values(all).filter(cp => {
        if (cp.completed)
            return false;
        if (cp.version !== CURRENT_VERSION)
            return false;
        try {
            const age = now - new Date(cp.savedAt).getTime();
            return age < DAY_MS;
        }
        catch {
            return false;
        }
    });
}
