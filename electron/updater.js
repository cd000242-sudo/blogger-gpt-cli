"use strict";
/**
 * electron/updater.ts
 * 자동 업데이트 모듈 — 네이버 자동화 앱 구조 참고
 *
 * electron-updater를 사용하여 GitHub Release에서 업데이트 확인/다운로드/설치
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUpdaterLoginWindow = setUpdaterLoginWindow;
exports.isUpdating = isUpdating;
exports.waitForUpdateCheck = waitForUpdateCheck;
exports.initAutoUpdaterEarly = initAutoUpdaterEarly;
exports.registerUpdaterHandlers = registerUpdaterHandlers;
const electron_1 = require("electron");
// Lazy load — 개발 모드 크래시 방지
let _autoUpdater = null;
function getAutoUpdater() {
    if (!_autoUpdater) {
        try {
            const { autoUpdater } = require('electron-updater');
            _autoUpdater = autoUpdater;
        }
        catch (e) {
            console.error('[Updater] electron-updater 로드 실패:', e);
        }
    }
    return _autoUpdater;
}
// 상태 플래그
let isInitialized = false;
let isUpdateInProgress = false;
let updateCheckResolve = null;
let progressWindow = null;
let loginWindowRef = null;
/** 로그인 창 참조 설정 (main에서 호출) */
function setUpdaterLoginWindow(win) {
    loginWindowRef = win;
}
/** 업데이트 진행 중 여부 */
function isUpdating() {
    return isUpdateInProgress;
}
/** 업데이트 체크 결과 대기 (최대 15초) */
function waitForUpdateCheck() {
    return new Promise((resolve) => {
        updateCheckResolve = resolve;
        setTimeout(() => {
            if (updateCheckResolve) {
                updateCheckResolve(false);
                updateCheckResolve = null;
            }
        }, 15000);
    });
}
/** 프로그레스 창 생성 */
function createProgressWindow(version) {
    if (progressWindow && !progressWindow.isDestroyed())
        return;
    progressWindow = new electron_1.BrowserWindow({
        width: 420,
        height: 200,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        center: true,
        transparent: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
body { margin:0; padding:24px; background:linear-gradient(135deg,#1e1b4b,#312e81); color:white; font-family:'Segoe UI',sans-serif; display:flex; flex-direction:column; justify-content:center; height:100vh; box-sizing:border-box; }
h2 { margin:0 0 4px 0; font-size:18px; font-weight:800; }
.ver { font-size:12px; color:rgba(255,255,255,0.5); margin-bottom:16px; }
.bar-bg { background:rgba(255,255,255,0.1); border-radius:8px; height:10px; overflow:hidden; margin-bottom:8px; }
.bar { height:100%; width:0%; background:linear-gradient(90deg,#6366f1,#a855f7); border-radius:8px; transition:width 0.3s; }
.info { font-size:12px; color:rgba(255,255,255,0.6); display:flex; justify-content:space-between; }
</style></head><body>
<h2>🔄 업데이트 다운로드 중</h2>
<div class="ver" id="ver">v${version}</div>
<div class="bar-bg"><div class="bar" id="bar"></div></div>
<div class="info"><span id="pct">0%</span><span id="speed"></span></div>
</body></html>`;
    progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}
function updateProgress(percent, speed) {
    if (!progressWindow || progressWindow.isDestroyed())
        return;
    const pct = Math.round(percent);
    const speedText = speed ? `${(speed / 1024 / 1024).toFixed(1)} MB/s` : '';
    progressWindow.webContents.executeJavaScript(`
    document.getElementById('bar').style.width='${pct}%';
    document.getElementById('pct').textContent='${pct}%';
    document.getElementById('speed').textContent='${speedText}';
  `).catch(() => { });
}
function closeProgressWindow() {
    if (progressWindow && !progressWindow.isDestroyed()) {
        progressWindow.close();
    }
    progressWindow = null;
}
/** 초기화 (앱 시작 시 호출) */
function initAutoUpdaterEarly() {
    if (isInitialized || !electron_1.app.isPackaged)
        return;
    isInitialized = true;
    const updater = getAutoUpdater();
    if (!updater)
        return;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    // 이벤트 리스너
    updater.on('checking-for-update', () => {
        console.log('[Updater] 업데이트 확인 중...');
    });
    updater.on('update-available', (info) => {
        console.log('[Updater] 새 버전 발견:', info.version);
        isUpdateInProgress = true;
        createProgressWindow(info.version);
        // 로그인 창 숨기기
        if (loginWindowRef && !loginWindowRef.isDestroyed()) {
            loginWindowRef.hide();
        }
        // 렌더러에 알림
        electron_1.BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContents.send('auto-update-event', { type: 'available', version: info.version });
            }
        });
        if (updateCheckResolve) {
            updateCheckResolve(true);
            updateCheckResolve = null;
        }
    });
    updater.on('update-not-available', () => {
        console.log('[Updater] 최신 버전입니다.');
        if (updateCheckResolve) {
            updateCheckResolve(false);
            updateCheckResolve = null;
        }
    });
    updater.on('download-progress', (progress) => {
        const pct = Math.round(progress.percent);
        console.log(`[Updater] 다운로드: ${pct}%`);
        updateProgress(pct, progress.bytesPerSecond);
        electron_1.BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContents.send('auto-update-event', { type: 'progress', percent: pct });
            }
        });
    });
    updater.on('update-downloaded', (info) => {
        console.log('[Updater] 다운로드 완료:', info.version);
        closeProgressWindow();
        electron_1.BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContents.send('auto-update-event', { type: 'downloaded', version: info.version });
            }
        });
        // 5초 후 자동 재시작 (사용자가 모달에서 선택할 수도 있음)
        const focusedWin = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (focusedWin && !focusedWin.isDestroyed()) {
            electron_1.dialog.showMessageBox(focusedWin, {
                type: 'info',
                title: '✅ 업데이트 준비 완료',
                message: `v${info.version} 다운로드 완료!\n재시작하면 자동으로 업데이트됩니다.`,
                buttons: ['지금 재시작', '나중에'],
                defaultId: 0,
            }).then((result) => {
                if (result.response === 0) {
                    updater.quitAndInstall();
                }
            });
        }
        else {
            // 창이 없으면 5초 후 자동 재시작
            setTimeout(() => updater.quitAndInstall(), 5000);
        }
    });
    updater.on('error', (err) => {
        console.error('[Updater] 오류:', err.message);
        isUpdateInProgress = false;
        closeProgressWindow();
        if (updateCheckResolve) {
            updateCheckResolve(false);
            updateCheckResolve = null;
        }
    });
    // 즉시 업데이트 체크 시작
    console.log('[Updater] 업데이트 체크 시작...');
    updater.checkForUpdates().catch((e) => {
        console.error('[Updater] 체크 실패:', e.message);
        if (updateCheckResolve) {
            updateCheckResolve(false);
            updateCheckResolve = null;
        }
    });
}
/** IPC 핸들러 등록 */
function registerUpdaterHandlers() {
    electron_1.ipcMain.handle('updater:check', async () => {
        const updater = getAutoUpdater();
        if (updater)
            await updater.checkForUpdates();
        return { success: true };
    });
    electron_1.ipcMain.handle('updater:install', () => {
        const updater = getAutoUpdater();
        if (updater)
            updater.quitAndInstall();
        return { success: true };
    });
    electron_1.ipcMain.handle('updater:getVersion', () => {
        return electron_1.app.getVersion();
    });
    // 기존 호환
    electron_1.ipcMain.handle('auto-update:install', () => {
        const updater = getAutoUpdater();
        if (updater)
            updater.quitAndInstall();
    });
}
