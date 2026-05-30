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
    // Race Condition 방지: 업데이트 진행 중인데 인증창이 나중에 설정된 경우 → 즉시 숨김
    if (isUpdateInProgress && loginWindowRef && !loginWindowRef.isDestroyed()) {
        loginWindowRef.hide();
        console.log('[Updater] 인증창 즉시 숨김 (업데이트가 이미 진행 중)');
    }
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
                console.log('[Updater] 업데이트 체크 타임아웃 (15초) - 업데이트 없음으로 처리');
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
    // 🔥 코드 서명 검증 비활성화: publisherName 설정 없으면 검증 스킵됨
    // 파일 무결성은 latest.yml의 SHA-512로 여전히 검증됨
    try {
        if (updater.allowPrerelease !== undefined)
            updater.allowPrerelease = false;
        // NSIS updater: publisherName이 없으면 verifySignature 검증이 스킵됨
        if (updater.updateConfigPath !== undefined) { /* placeholder */ }
    }
    catch { }
    // 이벤트 리스너
    updater.on('checking-for-update', () => {
        console.log('[Updater] 업데이트 확인 중...');
    });
    updater.on('update-available', (info) => {
        console.log('[Updater] 새 버전 발견:', info.version);
        isUpdateInProgress = true;
        // v3.7.6: 별도 progressWindow 생성 제거 — 메인 앱/인증창의 자체 progress UI가 표시하므로 중복 회피
        //   (createProgressWindow가 만든 BrowserWindow가 메인 modal과 겹쳐서 사용자 경험 저하)
        // createProgressWindow(info.version);
        // 로그인 창 숨기기
        if (loginWindowRef && !loginWindowRef.isDestroyed()) {
            loginWindowRef.hide();
        }
        if (updateCheckResolve) {
            updateCheckResolve(true);
            updateCheckResolve = null;
        }
    });
    updater.on('update-not-available', () => {
        console.log('[Updater] ✅ 최신 버전입니다 → 인증 진행');
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
        // v3.7.6: confirm dialog 제거 — 자동으로 NSIS installer 띄움.
        //   사용자 요청: "앱 종료는 자동, NSIS 화면만 띄워줘"
        //   2초 짧은 grace period (메인 앱이 progress UI를 "완료" 상태로 잠시 보여줄 시간) 후 quitAndInstall.
        isUpdateInProgress = false;
        // 메인 앱에 "다운로드 완료, 곧 NSIS 설치 화면 띄움" 알림
        electron_1.BrowserWindow.getAllWindows().forEach((w) => {
            if (!w.isDestroyed()) {
                w.webContents.send('auto-update-event', { type: 'downloaded', version: info.version });
            }
        });
        // 잔존 progressWindow 있으면 즉시 닫기 (이전 버전 호환)
        if (progressWindow && !progressWindow.isDestroyed()) {
            try {
                progressWindow.close();
            }
            catch { }
            progressWindow = null;
        }
        // 인증창도 닫기 (열려 있으면)
        if (loginWindowRef && !loginWindowRef.isDestroyed()) {
            try {
                loginWindowRef.close();
            }
            catch { }
        }
        // 2초 뒤 자동 quitAndInstall — confirm 다이얼로그 없이 NSIS installer 바로 띄움
        setTimeout(() => {
            console.log('[Updater] 자동 재시작 → NSIS installer');
            try {
                // isSilent=false → NSIS GUI 띄움 / isForceRunAfter=true → 설치 후 자동 실행
                updater.quitAndInstall(false, true);
            }
            catch (e) {
                console.error('[Updater] quitAndInstall 실패:', e.message);
            }
        }, 2000);
    });
    updater.on('error', (err) => {
        console.error('[Updater] 오류:', err.message);
        isUpdateInProgress = false;
        if (updateCheckResolve) {
            updateCheckResolve(false);
            updateCheckResolve = null;
        }
        // 인증창 다시 표시
        if (loginWindowRef && !loginWindowRef.isDestroyed()) {
            loginWindowRef.show();
            console.log('[Updater] 인증창 다시 표시 (업데이트 실패)');
        }
        // 프로그레스 창이 있으면 에러 UI로 전환 → 8초 후 자동 닫기
        if (progressWindow && !progressWindow.isDestroyed()) {
            const safeMsg = err.message.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, ' ');
            progressWindow.webContents.executeJavaScript(`
        document.querySelector('h2').innerHTML = '❌ 업데이트 실패';
        document.querySelector('h2').style.color = '#ef4444';
        document.getElementById('ver').textContent = '${safeMsg}';
        document.getElementById('ver').style.color = '#fca5a5';
        document.querySelector('.bar-bg').style.display = 'none';
        document.querySelector('.info').innerHTML = '<span style="color:#fff;font-weight:600;">클릭하여 닫기</span>';
        document.body.style.cursor = 'pointer';
        document.body.onclick = function() { window.close(); };
      `).catch(() => { });
            setTimeout(() => closeProgressWindow(), 8000);
        }
        else {
            closeProgressWindow();
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
