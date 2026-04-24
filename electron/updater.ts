/**
 * electron/updater.ts
 * 자동 업데이트 모듈 — 네이버 자동화 앱 구조 참고
 *
 * electron-updater를 사용하여 GitHub Release에서 업데이트 확인/다운로드/설치
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';

// Lazy load — 개발 모드 크래시 방지
let _autoUpdater: any = null;
function getAutoUpdater(): any {
  if (!_autoUpdater) {
    try {
      const { autoUpdater } = require('electron-updater');
      _autoUpdater = autoUpdater;
    } catch (e) {
      console.error('[Updater] electron-updater 로드 실패:', e);
    }
  }
  return _autoUpdater;
}

// 상태 플래그
let isInitialized = false;
let isUpdateInProgress = false;
let updateCheckResolve: ((hasUpdate: boolean) => void) | null = null;
let progressWindow: BrowserWindow | null = null;
let loginWindowRef: BrowserWindow | null = null;

/** 로그인 창 참조 설정 (main에서 호출) */
export function setUpdaterLoginWindow(win: BrowserWindow | null): void {
  loginWindowRef = win;
  // Race Condition 방지: 업데이트 진행 중인데 인증창이 나중에 설정된 경우 → 즉시 숨김
  if (isUpdateInProgress && loginWindowRef && !loginWindowRef.isDestroyed()) {
    loginWindowRef.hide();
    console.log('[Updater] 인증창 즉시 숨김 (업데이트가 이미 진행 중)');
  }
}

/** 업데이트 진행 중 여부 */
export function isUpdating(): boolean {
  return isUpdateInProgress;
}

/** 업데이트 체크 결과 대기 (최대 15초) */
export function waitForUpdateCheck(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
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
function createProgressWindow(version: string): void {
  if (progressWindow && !progressWindow.isDestroyed()) return;

  progressWindow = new BrowserWindow({
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

function updateProgress(percent: number, speed?: number): void {
  if (!progressWindow || progressWindow.isDestroyed()) return;
  const pct = Math.round(percent);
  const speedText = speed ? `${(speed / 1024 / 1024).toFixed(1)} MB/s` : '';
  progressWindow.webContents.executeJavaScript(`
    document.getElementById('bar').style.width='${pct}%';
    document.getElementById('pct').textContent='${pct}%';
    document.getElementById('speed').textContent='${speedText}';
  `).catch(() => {});
}

function closeProgressWindow(): void {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close();
  }
  progressWindow = null;
}

/** 초기화 (앱 시작 시 호출) */
export function initAutoUpdaterEarly(): void {
  if (isInitialized || !app.isPackaged) return;
  isInitialized = true;

  const updater = getAutoUpdater();
  if (!updater) return;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;
  // 🔥 코드 서명 검증 비활성화: publisherName 설정 없으면 검증 스킵됨
  // 파일 무결성은 latest.yml의 SHA-512로 여전히 검증됨
  try {
    if (updater.allowPrerelease !== undefined) updater.allowPrerelease = false;
    // NSIS updater: publisherName이 없으면 verifySignature 검증이 스킵됨
    if (updater.updateConfigPath !== undefined) { /* placeholder */ }
  } catch {}

  // 이벤트 리스너
  updater.on('checking-for-update', () => {
    console.log('[Updater] 업데이트 확인 중...');
  });

  updater.on('update-available', (info: any) => {
    console.log('[Updater] 새 버전 발견:', info.version);
    isUpdateInProgress = true;
    createProgressWindow(info.version);

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

  updater.on('download-progress', (progress: any) => {
    const pct = Math.round(progress.percent);
    console.log(`[Updater] 다운로드: ${pct}%`);
    updateProgress(pct, progress.bytesPerSecond);

    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('auto-update-event', { type: 'progress', percent: pct });
      }
    });
  });

  updater.on('update-downloaded', (info: any) => {
    console.log('[Updater] 다운로드 완료:', info.version);

    // 중복 재시작 방지
    let isRestarting = false;
    const doRestart = () => {
      if (isRestarting) return;
      isRestarting = true;
      console.log('[Updater] 재시작 실행');
      isUpdateInProgress = false;
      // 인증창 닫기
      if (loginWindowRef && !loginWindowRef.isDestroyed()) {
        loginWindowRef.close();
      }
      updater.quitAndInstall();
    };

    // 프로그레스 창이 있으면 → 완료 UI로 전환 (네이버 패턴)
    if (progressWindow && !progressWindow.isDestroyed()) {
      progressWindow.webContents.executeJavaScript(`
        document.querySelector('h2').innerHTML = '✅ 업데이트 준비 완료';
        document.querySelector('h2').style.fontSize = '17px';
        document.getElementById('ver').textContent = 'LEADERNAM Orbit v${info.version}';
        document.getElementById('ver').style.color = '#a78bfa';
        document.querySelector('.bar-bg').style.display = 'none';
        document.querySelector('.info').innerHTML = '<span style="color:#a78bfa;font-weight:600;">클릭하여 재시작</span><span style="color:rgba(255,255,255,0.4);">5초 후 자동 재시작</span>';
        document.body.style.cursor = 'pointer';
        document.body.onclick = function() { window.close(); };
      `).catch(() => {});

      // 프로그레스 창 닫히면 → 재시작
      progressWindow.once('closed', () => {
        progressWindow = null;
        doRestart();
      });

      // 5초 후 자동 재시작 (프로그레스 창 먼저 닫고 → closed 이벤트로 doRestart)
      setTimeout(() => {
        if (!isRestarting) {
          closeProgressWindow();
        }
      }, 5000);
    } else {
      // 프로그레스 창 없으면 독립 다이얼로그
      dialog.showMessageBox({
        type: 'info',
        title: '업데이트 준비 완료',
        message: `LEADERNAM Orbit v${info.version}`,
        detail: '새로운 버전이 다운로드되었습니다.\n재시작하여 업데이트를 적용합니다.',
        buttons: ['지금 재시작하여 업데이트'],
        defaultId: 0,
        noLink: true,
      }).then(doRestart).catch(doRestart);
    }
  });

  updater.on('error', (err: any) => {
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
      `).catch(() => {});
      setTimeout(() => closeProgressWindow(), 8000);
    } else {
      closeProgressWindow();
    }
  });

  // 즉시 업데이트 체크 시작
  console.log('[Updater] 업데이트 체크 시작...');
  updater.checkForUpdates().catch((e: any) => {
    console.error('[Updater] 체크 실패:', e.message);
    if (updateCheckResolve) {
      updateCheckResolve(false);
      updateCheckResolve = null;
    }
  });
}

/** IPC 핸들러 등록 */
export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', async () => {
    const updater = getAutoUpdater();
    if (updater) await updater.checkForUpdates();
    return { success: true };
  });

  ipcMain.handle('updater:install', () => {
    const updater = getAutoUpdater();
    if (updater) updater.quitAndInstall();
    return { success: true };
  });

  ipcMain.handle('updater:getVersion', () => {
    return app.getVersion();
  });

  // 기존 호환
  ipcMain.handle('auto-update:install', () => {
    const updater = getAutoUpdater();
    if (updater) updater.quitAndInstall();
  });
}
