"use strict";
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
exports.registerAdsPowerIpcHandlers = registerAdsPowerIpcHandlers;
// electron/adspowerIpcHandlers.ts
// 🛡️ AdsPower IPC 핸들러 — 싱글톤 패턴 + API Key sanitize
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ── 싱글톤 캐시 ──
let cachedManager = null;
let cachedConfig = null;
/**
 * .env에서 AdsPower 설정 읽기 (포트 + API Key)
 */
function getAdsPowerConfig() {
    try {
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const portMatch = content.match(/ADSPOWER_PORT=(\d+)/);
            const keyMatch = content.match(/ADSPOWER_API_KEY=([^\r\n]+)/);
            return {
                port: portMatch?.[1] ? parseInt(portMatch[1], 10) : 50325,
                apiKey: keyMatch?.[1]?.trim() || '',
            };
        }
    }
    catch { }
    return { port: 50325, apiKey: '' };
}
/**
 * 싱글톤 AdsPowerManager 인스턴스 반환
 * - 설정 변경 시 자동 재생성
 * - require()는 최초 1회만 실행
 */
function getOrCreateManager() {
    const config = getAdsPowerConfig();
    // 설정이 변경되지 않았으면 캐시된 인스턴스 재사용
    if (cachedManager && cachedConfig &&
        cachedConfig.port === config.port &&
        cachedConfig.apiKey === config.apiKey) {
        return cachedManager;
    }
    // 새로 생성
    try {
        const distPath = path.join(__dirname, '..', 'dist', 'core', 'adspower-manager');
        const srcPath = path.join(__dirname, '..', 'src', 'core', 'adspower-manager');
        let ManagerClass = null;
        if (fs.existsSync(distPath + '.js')) {
            ManagerClass = require(distPath).AdsPowerManager;
        }
        else if (fs.existsSync(srcPath + '.js') || fs.existsSync(srcPath + '.ts')) {
            ManagerClass = require(srcPath).AdsPowerManager;
        }
        if (!ManagerClass) {
            throw new Error('AdsPowerManager 모듈을 찾을 수 없습니다');
        }
        cachedManager = new ManagerClass({ port: config.port, apiKey: config.apiKey });
        cachedConfig = config;
        console.log(`[ADSPOWER-IPC] ✅ 싱글톤 매니저 생성 (port: ${config.port})`);
        return cachedManager;
    }
    catch (error) {
        console.error('[ADSPOWER-IPC] 모듈 로드 실패:', error);
        return null;
    }
}
/**
 * 에러 메시지에서 API Key 제거 (보안)
 */
function sanitizeError(error, apiKey) {
    let msg = error instanceof Error ? error.message : String(error);
    if (apiKey && apiKey.length > 0) {
        msg = msg.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
    }
    return msg;
}
// ── IPC 핸들러 등록 ──
function registerAdsPowerIpcHandlers() {
    console.log('[ADSPOWER-IPC] 🛡️ AdsPower IPC 핸들러 등록 시작...');
    const apiKey = getAdsPowerConfig().apiKey;
    // 1. 연결 상태 확인
    electron_1.ipcMain.handle('adspower:check-status', async () => {
        try {
            const manager = getOrCreateManager();
            if (!manager) {
                return { ok: false, running: false, error: 'AdsPowerManager 모듈 로드 실패' };
            }
            const status = await manager.checkStatus();
            console.log(`[ADSPOWER-IPC] 상태: ${status.running ? '✅ 실행 중' : '❌ 미실행'}`);
            return { ok: true, ...status };
        }
        catch (error) {
            console.error('[ADSPOWER-IPC] 상태 확인 실패:', sanitizeError(error, apiKey));
            return { ok: false, running: false, error: sanitizeError(error, apiKey) };
        }
    });
    // 2. 프로필 목록 조회
    electron_1.ipcMain.handle('adspower:list-profiles', async () => {
        try {
            const manager = getOrCreateManager();
            if (!manager) {
                return { ok: false, profiles: [], error: 'AdsPowerManager 모듈 로드 실패' };
            }
            const result = await manager.listProfiles();
            console.log(`[ADSPOWER-IPC] ✅ 프로필 ${result.profiles.length}개 조회 (전체: ${result.total})`);
            return { ok: true, profiles: result.profiles, total: result.total };
        }
        catch (error) {
            console.error('[ADSPOWER-IPC] ❌ 프로필 목록 조회 실패:', sanitizeError(error, apiKey));
            return { ok: false, profiles: [], error: sanitizeError(error, apiKey) };
        }
    });
    // 3. 프로필 브라우저 시작
    electron_1.ipcMain.handle('adspower:start-profile', async (_evt, profileId) => {
        try {
            if (!profileId) {
                return { ok: false, error: '프로필 ID가 필요합니다' };
            }
            const manager = getOrCreateManager();
            if (!manager) {
                return { ok: false, error: 'AdsPowerManager 모듈 로드 실패' };
            }
            const result = await manager.startProfile(profileId);
            console.log(`[ADSPOWER-IPC] ✅ 프로필 시작 완료: ${profileId}`);
            return { ok: true, wsUrl: result.wsUrl };
        }
        catch (error) {
            console.error('[ADSPOWER-IPC] ❌ 프로필 시작 실패:', sanitizeError(error, apiKey));
            return { ok: false, error: sanitizeError(error, apiKey) };
        }
    });
    // 4. 프로필 브라우저 중지
    electron_1.ipcMain.handle('adspower:stop-profile', async (_evt, profileId) => {
        try {
            if (!profileId) {
                return { ok: false, error: '프로필 ID가 필요합니다' };
            }
            const manager = getOrCreateManager();
            if (!manager) {
                return { ok: false, error: 'AdsPowerManager 모듈 로드 실패' };
            }
            await manager.stopProfile(profileId);
            console.log(`[ADSPOWER-IPC] ✅ 프로필 중지 완료: ${profileId}`);
            return { ok: true };
        }
        catch (error) {
            console.error('[ADSPOWER-IPC] ❌ 프로필 중지 실패:', sanitizeError(error, apiKey));
            return { ok: false, error: sanitizeError(error, apiKey) };
        }
    });
    // 5. 프로필 생성
    electron_1.ipcMain.handle('adspower:create-profile', async (_evt, profileName) => {
        try {
            const manager = getOrCreateManager();
            if (!manager)
                return { ok: false, error: 'AdsPower 설정이 없습니다.' };
            return await manager.createProfile(profileName);
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    // 6. 프로필 삭제
    electron_1.ipcMain.handle('adspower:delete-profile', async (_evt, profileIds) => {
        try {
            const manager = getOrCreateManager();
            if (!manager)
                return { ok: false, error: 'AdsPower 설정이 없습니다.' };
            return await manager.deleteProfile(profileIds);
        }
        catch (e) {
            return { ok: false, error: e.message };
        }
    });
    console.log('[ADSPOWER-IPC] ✅ AdsPower IPC 핸들러 6개 등록 완료 (싱글톤 패턴)');
}
