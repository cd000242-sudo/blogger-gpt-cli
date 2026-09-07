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
  /**
   * v3.8.636 — 숨기지 않고 **알린다.**
   *
   * 업데이트가 이미 돌고 있는데 인증창이 뒤늦게 뜨는 경우다. 예전에는 그 창을
   * 곧바로 숨겼는데, 그러면 사장님 눈에는 앱이 안 뜨는 것으로 보인다.
   * 창은 그대로 두고 진행 상황을 알려 준다 — 알림이 화면을 덮으므로
   * 그 사이에 로그인이 눌리지도 않는다.
   */
  if (isUpdateInProgress && loginWindowRef && !loginWindowRef.isDestroyed()) {
    try {
      loginWindowRef.webContents.send('auto-update-event', { type: 'available', version: '' });
      console.log('[Updater] 인증창에 업데이트 진행 알림 전달');
    } catch { /* 아직 로드 전이면 다음 progress 이벤트가 다시 알린다 */ }
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
.bar { height:100%; width:100%; transform:scaleX(0); transform-origin:left center; background:linear-gradient(90deg,#6366f1,#a855f7); border-radius:8px; transition:transform 0.3s; }
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
    document.getElementById('bar').style.transform='scaleX(${(pct / 100).toFixed(3)})';
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
    // v3.7.6: 별도 progressWindow 생성 제거 — 메인 앱/인증창의 자체 progress UI가 표시하므로 중복 회피
    //   (createProgressWindow가 만든 BrowserWindow가 메인 modal과 겹쳐서 사용자 경험 저하)
    // createProgressWindow(info.version);

    /**
     * v3.8.636 — "새 버전 감지" 를 **창들에게 알린다.**
     *
     * 사장님: "새버전을 감지했습니다가 로그인 인증 창에서도 떠야되고"
     *
     * 예전에는 여기서 아무 창에도 알리지 않고 로그인 창을 숨기기만 했다.
     * 그래서 progress 가 오기 전까지는 아무 데도 표시가 없었고, 인증 단계에서는
     * 화면이 그냥 사라져 앱이 멈춘 것처럼 보였다.
     * 이제 알림을 보내고 창은 그대로 둔다 — 알림 자체가 화면을 덮는다.
     */
    BrowserWindow.getAllWindows().forEach((w) => {
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

    // v3.7.6: confirm dialog 제거 — 자동으로 NSIS installer 띄움.
    //   사용자 요청: "앱 종료는 자동, NSIS 화면만 띄워줘"
    //   2초 짧은 grace period (메인 앱이 progress UI를 "완료" 상태로 잠시 보여줄 시간) 후 quitAndInstall.
    // v3.7.14 fix: 이전엔 여기서 isUpdateInProgress=false로 풀어 mainWindow.close 핸들러가
    //   "정말 종료?" confirm을 띄우는 버그가 있었음. quitAndInstall 직전까진 true 유지.

    // 메인 앱에 "다운로드 완료, 곧 NSIS 설치 화면 띄움" 알림
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) {
        w.webContents.send('auto-update-event', { type: 'downloaded', version: info.version });
      }
    });

    // 잔존 progressWindow 있으면 즉시 닫기 (이전 버전 호환)
    if (progressWindow && !progressWindow.isDestroyed()) {
      try { progressWindow.close(); } catch {}
      progressWindow = null;
    }

    // 인증창도 닫기 (열려 있으면)
    if (loginWindowRef && !loginWindowRef.isDestroyed()) {
      try { loginWindowRef.close(); } catch {}
    }

    /**
     * 🔇 v3.8.694 — **조용히 깔아 보고, 안 되면 그때 마법사를 띄운다.**
     *
     * 사장님: "자동으로 업데이트가 되면 마법사가 뜰필요없고 안되는상황이면
     *          자동으로 마법사가뜨도록해"
     *
     * ## 예전에는 왜 마법사부터 띄웠나 (v3.7.6)
     * 그때 사장님 요청은 "앱 종료는 자동, NSIS 화면만 띄워줘" 였다. 그런데 이 앱은
     * `oneClick:false · allowToChangeInstallationDirectory:true` 라 마법사의 **기본
     * 설치 위치가 앱이 실제로 있는 곳과 다르다.** 2026-09-07 실측:
     *   앱 실제 위치   C:\Program Files\Blog Automation Premium\LEADERNAM Orbit\
     *   마법사 기본값  %LOCALAPPDATA%\Programs\LEADERNAM Orbit\   ← 빈 폴더로 남아 있었다
     * 그래서 "설치했다는데 앱은 그대로" 가 됐다.
     *
     * ## 지금 순서
     * ① isSilent=true 로 조용한 설치를 건다. /S 는 **레지스트리에 기억된 기존 설치 위치**로
     *    들어가므로 위치가 어긋나지 않고, 클릭할 것도 없다.
     * ② 그 호출이 던지거나, 6초가 지나도 앱이 살아 있으면 조용한 설치가 안 먹은 것이다
     *    → 그때 마법사(isSilent=false)를 띄운다. 아무것도 안 하는 것보다 낫다.
     *
     * 성공하면 ①에서 앱이 종료되므로 ②는 실행되지 않는다.
     */
    setTimeout(() => {
      let silentFailed = false;
      try {
        console.log('[Updater] 자동 재시작 → 조용한 설치 시도');
        updater.quitAndInstall(true, true);
      } catch (e: any) {
        silentFailed = true;
        console.error('[Updater] 조용한 설치 실패:', e?.message);
      }

      // 여기서 앱이 아직 살아 있으면 조용한 설치가 시작되지 않은 것이다
      setTimeout(() => {
        if (!silentFailed) console.log('[Updater] 6초가 지나도 종료되지 않음 — 마법사로 물러섬');
        try {
          updater.quitAndInstall(false, true);
        } catch (e2: any) {
          // 둘 다 실패 — 앱은 계속 쓸 수 있게 두고 플래그만 푼다
          isUpdateInProgress = false;
          console.error('[Updater] 마법사 설치도 실패:', e2?.message);
        }
      }, 6000);
    }, 2000);
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

  /**
   * 🔁 v3.8.692 — **최신 버전으로 재시작** (로그인 인증창의 수동 버튼)
   *
   * 사장님: "자동업데이트가 안되면 로그인인증창에 제일 최신버전으로 재시작하기 버튼생성하고
   *          누르면 자동 업데이트하고 재시작되게하면되지않니"
   *
   * ## 왜 버튼만으로는 부족했나 — 여기가 핵심이다
   * 기존 `updater:install` 은 `quitAndInstall()` 을 **인자 없이** 불렀다.
   * 그러면 isSilent=false 라서 NSIS **설치 마법사 창**이 뜨고 사람이 클릭해야 끝난다.
   * 게다가 이 앱은 `oneClick:false · allowToChangeInstallationDirectory:true` 라
   * 마법사의 기본 설치 위치가 **지금 앱이 있는 곳과 다르다**(실측: 앱은
   * `C:\Program Files\Blog Automation Premium\...`, 마법사 기본값은 `%LOCALAPPDATA%\Programs\...`
   * — 그 폴더가 빈 채로 남아 있었다). 그래서 "설치했다는데 앱은 그대로"가 됐다.
   *
   * 그래서 여기서는 `quitAndInstall(true, true)` 를 쓴다.
   *   isSilent=true       → NSIS 를 /S 로 돌린다. 조용히 깔리고, **레지스트리에 기억된
   *                         기존 설치 위치**로 들어간다(마법사 기본값이 아니라).
   *   isForceRunAfter=true → 설치 후 앱을 자동으로 다시 띄운다.
   *
   * 이미 최신이면 아무것도 하지 않고 그렇다고 알려 준다 — 조용히 끝내면
   * 사장님은 버튼이 먹었는지 알 수 없다.
   */
  ipcMain.handle('updater:restart-to-latest', async () => {
    const updater = getAutoUpdater();
    if (!updater) return { ok: false, error: '이 빌드에서는 자동 업데이트를 쓸 수 없습니다 (개발 모드).' };

    const current = app.getVersion();
    try {
      const result = await updater.checkForUpdates();
      const latest = String(result?.updateInfo?.version || '');
      if (!latest || latest === current) {
        return { ok: true, upToDate: true, current, latest: latest || current };
      }

      /**
       * 내려받기를 기다린다. autoDownload=true 라 이미 받고 있을 수 있으므로
       * **두 경우 다** 처리한다: 이미 끝났으면 곧바로, 아니면 이벤트를 기다린다.
       * 5분을 넘기면 포기하고 이유를 돌려준다 — 무한정 도는 버튼은 고장과 구별이 안 된다.
       */
      await new Promise<void>((resolve, reject) => {
        const done = () => { cleanup(); resolve(); };
        const fail = (e: any) => { cleanup(); reject(e instanceof Error ? e : new Error(String(e?.message || e))); };
        const timer = setTimeout(() => fail(new Error('내려받기가 5분을 넘겨 중단했습니다.')), 5 * 60 * 1000);
        const cleanup = () => {
          clearTimeout(timer);
          updater.removeListener('update-downloaded', done);
          updater.removeListener('error', fail);
        };
        updater.once('update-downloaded', done);
        updater.once('error', fail);
        try { updater.downloadUpdate(); } catch (e) { /* 이미 받는 중이면 여기서 던진다 — 이벤트를 계속 기다린다 */ }
      });

      isUpdateInProgress = true;
      // 조용히 설치하고 자동 재시작 — 위 주석의 두 인자가 이 기능의 전부다
      setTimeout(() => {
        try {
          updater.quitAndInstall(true, true);
        } catch (e: any) {
          isUpdateInProgress = false;
          console.error('[Updater] 수동 재시작 설치 실패:', e?.message);
        }
      }, 300);
      return { ok: true, upToDate: false, current, latest, installing: true };
    } catch (error: any) {
      return { ok: false, current, error: String(error?.message || error).slice(0, 200) };
    }
  });

  // 기존 호환
  ipcMain.handle('auto-update:install', () => {
    const updater = getAutoUpdater();
    if (updater) updater.quitAndInstall();
  });
}
