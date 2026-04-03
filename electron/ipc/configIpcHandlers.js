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
exports.registerConfigIpcHandlers = registerConfigIpcHandlers;
/**
 * 사용자 설정 + 설정 보호 + 외부 링크 IPC 핸들러
 * electron/main.ts에서 분리
 */
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function getUserConfigPath() {
    return path.join(electron_1.app.getPath('userData'), 'user-config.json');
}
function readUserConfig() {
    const p = getUserConfigPath();
    if (!fs.existsSync(p))
        return {};
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
function registerConfigIpcHandlers() {
    // 설정 보호
    electron_1.ipcMain.handle('set-settings-protection', async (_evt, protectedMode) => {
        try {
            const config = readUserConfig();
            config.settingsProtected = protectedMode;
            fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
            return { ok: true };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
        }
    });
    electron_1.ipcMain.handle('is-settings-protected', async () => {
        try {
            const config = readUserConfig();
            return { ok: true, protected: !!config.settingsProtected };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '확인 실패', protected: false };
        }
    });
    // 사용자 설정
    electron_1.ipcMain.handle('save-user-config', async (_evt, config) => {
        try {
            fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
            return { ok: true };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
        }
    });
    electron_1.ipcMain.handle('get-user-config', async () => {
        try {
            return { ok: true, config: readUserConfig() };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', config: {} };
        }
    });
    // 외부 링크
    electron_1.ipcMain.handle('open-link', async (_evt, href) => {
        try {
            await electron_1.shell.openExternal(href);
            return { ok: true };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
        }
    });
    electron_1.ipcMain.handle('open-external', async (_evt, url) => {
        try {
            await electron_1.shell.openExternal(url);
            return { ok: true };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
        }
    });
}
