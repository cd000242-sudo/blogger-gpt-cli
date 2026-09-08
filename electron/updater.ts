/**
 * electron/updater.ts
 * 자동 업데이트 모듈 — 네이버 자동화 앱 구조 참고
 *
 * electron-updater를 사용하여 GitHub Release에서 업데이트 확인/다운로드/설치
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { readAttempt, recordAttempt, clearAttempt, isRepeatAttempt } from './updater-attempt';

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

/**
 * 🔁 v3.8.697 — **설치가 끝나면 앱을 다시 띄운다.**
 *
 * 사장님: "새버전감지 모달뜨면서 업데이트 되고 꺼지자나? 그럼 다시 켜지도록해줘야지 꺼지고 끝이네"
 *
 * ## 실측으로 확인한 것 (2026-09-07)
 * `quitAndInstall(true, true)` 의 조용한 설치는 **성공했다** — 설치본이 3.8.687 → 3.8.696 으로
 * 바뀌었고 마법사도 뜨지 않았다. 그런데 두 번째 인자 `isForceRunAfter` 가 일을 하지 않아
 * **앱이 꺼진 채로 끝났다.** (전자는 v3.8.694 가 고친 것, 후자가 남은 문제다.)
 *
 * electron-updater 에 기대지 않고 **밖에서 지켜보는 감시자**를 띄운다.
 * 앱은 곧 죽으므로 이 프로세스는 반드시 detached 여야 한다 — 안 그러면 같이 죽는다.
 *
 * ## 두 번 켜지지 않게
 * 먼저 프로세스가 살아 있는지 본다. `--force-run` 이 어쩌다 동작한 기기에서는
 * 감시자가 아무것도 하지 않고 조용히 끝난다.
 *
 * 설치 중에는 exe 가 잠겨 있어 실행이 실패할 수 있다 — 그래서 한 번이 아니라 되풀이한다.
 */
function scheduleRelaunchWatchdog(): void {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  try {
    const { spawn } = require('child_process');
    const exePath = process.execPath;
    // 실행 파일 이름에서 확장자를 뗀 것이 프로세스 이름이다 ("LEADERNAM Orbit")
    const processName = String(exePath.split(/[\\/]/).pop() || '').replace(/\.exe$/i, '');
    const psExe = exePath.replace(/'/g, "''");
    const psName = processName.replace(/'/g, "''");

    const script = [
      // 설치기가 파일을 바꿔 끼울 시간을 준다
      'Start-Sleep -Seconds 12',
      'for ($i = 0; $i -lt 30; $i++) {',
      //   이미 떠 있으면(--force-run 이 동작한 기기) 아무것도 하지 않는다
      `  if (Get-Process -Name '${psName}' -ErrorAction SilentlyContinue) { exit }`,
      `  try { Start-Process -FilePath '${psExe}'; exit } catch { Start-Sleep -Seconds 4 }`,
      '}',
    ].join('\n');

    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
      { detached: true, stdio: 'ignore', windowsHide: true },
    );
    child.unref();
    console.log('[Updater] 재시작 감시자 등록 — 설치 뒤 앱을 다시 띄웁니다');
  } catch (e: any) {
    // 감시자를 못 띄워도 설치 자체는 진행한다 — 최악이라도 사장님이 손으로 켜면 된다
    console.error('[Updater] 재시작 감시자 등록 실패:', e?.message);
  }
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

// 다운로드가 끝난 버전 — 설치를 걸 수 있는 상태인지의 근거
let downloadedVersion: string | null = null;
let installTriggered = false;

function attemptDir(): string {
  return app.getPath('userData');
}

/**
 * 🔧 v3.8.707 — **다운로드된 업데이트를 지금 설치한다.** 설치가 걸리면 true.
 *
 * 사장님: "지금 자동업데이트가 안되고 로그인인증창에서 자꾸 꺼지는데?"
 *
 * ## 실측으로 잡은 원인 (2026-09-08)
 * update-downloaded 가 인증창을 닫았다. 인증 단계에서는 그 창이 유일한 창이라
 * main.ts 의 `window-all-closed → app.quit()` 이 곧바로 돌고, 2초 뒤에 걸어 둔
 * quitAndInstall 은 오지 않는다(Electron 재현: 마지막 창을 닫으면 1초 안에 끝나고
 * 2초 타이머는 찍히지 않았다). v3.8.701 까지는 autoInstallOnAppQuit 가 그 "그냥 꺼짐"
 * 을 우연히 설치로 바꿔 줬는데(force-run 없이 → "다시 안 뜬다"의 뿌리), v3.8.702 가
 * 그 옵션을 끄자 아무것도 남지 않았다: 다운로드 → 창 꺼짐 → 끝. 켤 때마다 되풀이.
 *
 * 설치를 거는 길을 이 한 함수로 모은다 — 다운로드 완료 뒤 2초, 마지막 창이 닫힐 때
 * (main.ts window-all-closed), 사장님이 [지금 재시작] 을 눌렀을 때. 어디서 오든
 * 장부에 적고 감시자를 세운 뒤 조용한 설치를 건다. 종료는 quitAndInstall 이 한다.
 */
export function installDownloadedUpdateNow(reason: string): boolean {
  const updater = getAutoUpdater();
  if (!updater || !downloadedVersion || installTriggered) return false;
  installTriggered = true;
  const attempt = recordAttempt(attemptDir(), downloadedVersion);
  console.log(`[Updater] 조용한 설치 시작 (${reason}) — v${downloadedVersion} ${attempt.count}번째 시도`);
  try {
    scheduleRelaunchWatchdog();
    // electron-updater 는 quitAndInstall 을 두 번째 부르면 "install call ignored" 로 무시하고
    // 플래그만 되돌린다(BaseUpdater.install). [지금 재시작] 으로 다시 거는 길이 막히지 않게 먼저 푼다.
    if (updater.quitAndInstallCalled) updater.quitAndInstallCalled = false;
    // 언제나 조용한 설치(/S): 레지스트리에 기억된 기존 설치 위치로 들어간다.
    // 마법사(isSilent=false)는 기본 위치가 %LOCALAPPDATA% 라 엉뚱한 곳에 깔린 전례(v3.8.694).
    updater.quitAndInstall(true, true);
    return true;
  } catch (e: any) {
    installTriggered = false;
    console.error('[Updater] 설치 호출 실패:', e?.message);
    return false;
  }
}

/**
 * 🙋 v3.8.702 — 조용한 설치가 안 먹히면 **사장님께 묻는다.**
 *
 * 사장님: "그두개가 떳으면 그걸로만가던지 아니면 … 깔끔하게 업데이트되고 다시 앱을
 *          띄우던데 둘중하나만해줄래?? 그게 안먹히면 버튼두개를 띄우라고"
 *
 * 기본은 **조용한 설치 + 자동 재시작** 하나다. 그게 안 되면 마법사를 몰래 띄우지 않고
 * 우리 대화상자로 **[지금 재시작] / [나중에]** 를 묻는다 — 어디서 온 창인지 알 수 있고,
 * 사장님이 하던 일을 끊을지 직접 정한다.
 *
 * v3.8.707: 되풀이(같은 버전을 10분 안에 또)도 여기로 온다 — 권한 확인창에서 '아니오'
 * 를 눌렀거나 설치기가 죽은 경우라, 말없이 또 걸면 창만 또 꺼진다.
 */
async function askThenInstall(version: string, detail: string): Promise<void> {
  try {
    const answer = await dialog.showMessageBox({
      type: 'info',
      buttons: ['지금 재시작', '나중에'],
      defaultId: 0,
      cancelId: 1,
      title: '업데이트 준비 완료',
      message: `새 버전 v${version} 이 준비됐습니다.`,
      detail,
    });
    if (answer.response !== 0) {
      isUpdateInProgress = false;   // 하던 일을 계속하신다 — 다음 실행 때 다시 묻는다
      console.log('[Updater] 사장님이 "나중에"를 고르셨습니다');
      BrowserWindow.getAllWindows().forEach((w) => {
        if (!w.isDestroyed()) w.webContents.send('auto-update-event', { type: 'postponed', version });
      });
      return;
    }
    installTriggered = false;   // 사장님이 다시 하라셨다
    installDownloadedUpdateNow('사장님이 [지금 재시작]');
  } catch (e2: any) {
    // 묻지도 못했다 — 앱은 계속 쓸 수 있게 두고 플래그만 푼다
    isUpdateInProgress = false;
    console.error('[Updater] 설치 확인 창 실패:', e2?.message);
  }
}

/** 초기화 (앱 시작 시 호출) */
export function initAutoUpdaterEarly(): void {
  if (isInitialized || !app.isPackaged) return;
  isInitialized = true;

  const updater = getAutoUpdater();
  if (!updater) return;

  // v3.8.707: 장부의 버전이 지금 버전이면 설치가 끝난 것 — 되풀이 감지에 걸리지 않게 지운다
  try {
    const prev = readAttempt(attemptDir());
    if (prev && prev.version === app.getVersion()) {
      clearAttempt(attemptDir());
      console.log(`[Updater] v${prev.version} 설치 확인 — 시도 기록 정리`);
    }
  } catch { /* 장부 없음 */ }

  updater.autoDownload = true;
  /**
   * 🚫 v3.8.702 — **끈다. 설치가 두 번 일어나고 있었다.**
   *
   * 사장님: "여전히 다시안뜨고 키면 버튼두개가뜨거든 재시작하기랑 계속하기"
   *
   * 실측(2026-09-07): 설치본은 이미 3.8.701 인데 업데이트 캐시(`lba-updater/pending`)에
   * **3.8.701 설치기가 그대로 남아** 있었다. 우리가 quitAndInstall 로 직접 설치를 끝냈는데
   * 이 옵션 때문에 **앱이 꺼질 때 같은 설치기가 또 돈다.** 그 두 번째 설치가
   * "앱이 실행 중입니다 — 재시작/계속" 같은 창을 띄운다.
   *
   * 설치 시점은 우리가 정한다(update-downloaded 에서 한 번). 그러니 이 자동 설치는 필요 없다.
   */
  updater.autoInstallOnAppQuit = false;
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

    /**
     * v3.8.707: 인증창을 **닫지 않는다.** 예전에는 여기서 닫았는데, 인증 단계에서는
     * 그 창이 유일한 창이라 window-all-closed → app.quit() 이 곧바로 돌아 아래 2초
     * 타이머가 영영 오지 않았다(설치 0번, 창만 꺼짐). 창은 "설치 중" 모달을 보여 주며
     * 남아 있다가 quitAndInstall 이 앱을 끌 때 함께 닫힌다.
     */
    downloadedVersion = String(info.version || '');
    installTriggered = false;

    /**
     * 🔇 v3.8.694 — **조용히 깔아 보고, 안 되면 그때 묻는다.**
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
     * ① 2초 뒤 조용한 설치(/S). 레지스트리에 기억된 기존 설치 위치로 들어가므로
     *    위치가 어긋나지 않고, 클릭할 것도 없다. 모든 사용자용(Program Files) 설치본은
     *    Windows 가 권한 확인창을 한 번 띄운다 — 화면 안내문이 그걸 미리 말한다.
     * ② 8초가 지나도 앱이 살아 있으면 설치가 안 걸린 것이다 → [지금 재시작]/[나중에].
     * ③ 같은 버전을 10분 안에 또 깔려 하면(권한 확인창에서 '아니오' 등) ①을 건너뛰고
     *    바로 ② — 말없이 또 걸면 창만 또 꺼진다.
     *
     * 성공하면 ①에서 앱이 종료되므로 ②는 실행되지 않는다.
     */
    const version = downloadedVersion;
    const prev = readAttempt(attemptDir());
    if (isRepeatAttempt(prev, version)) {
      console.log(`[Updater] v${version} 설치를 ${prev?.count}번 걸었는데 아직 그대로 — 조용히 되풀이하지 않고 묻는다`);
      void askThenInstall(version,
        '조금 전 자동 설치가 적용되지 않았습니다. Windows 권한 확인창에서 \'아니오\'를 눌렀거나 창이 닫혔을 수 있습니다.\n'
        + '[지금 재시작] 을 누르면 다시 설치합니다 — 권한 확인창이 뜨면 \'예\'를 눌러 주세요. 끝나면 앱이 다시 열립니다.');
      return;
    }

    setTimeout(() => {
      const started = installDownloadedUpdateNow('다운로드 완료 2초 뒤');
      setTimeout(() => {
        if (started) console.log('[Updater] 8초가 지나도 종료되지 않음 — 사장님께 묻는다');
        void askThenInstall(version,
          '자동 설치가 되지 않아 직접 여쭙니다.\n[지금 재시작] 을 누르면 설치가 시작되고(권한 확인창이 뜨면 \'예\'), 끝나면 앱이 다시 열립니다.');
      }, 8000);
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

  // v3.8.702: 옛 호환 채널이라도 설치를 걸면 앱이 다시 떠야 한다 — 감시자를 함께 건다
  ipcMain.handle('updater:install', () => {
    // v3.8.707: 마법사(인자 없음)가 아니라 자동 경로와 같은 조용한 설치
    return { success: installDownloadedUpdateNow('옛 채널 updater:install') };
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
      // 조용히 설치하고 자동 재시작 — v3.8.707: update-downloaded 의 자동 경로와 같은 함수를 탄다.
      // 그쪽 2초 타이머가 먼저 걸었으면 여기서는 false 가 돌아와 두 번 걸리지 않는다.
      setTimeout(() => {
        if (!installDownloadedUpdateNow('설정의 [최신으로 재시작]')) {
          console.log('[Updater] 수동 재시작 — 이미 설치가 걸려 있어 건너뜀');
        }
      }, 300);
      return { ok: true, upToDate: false, current, latest, installing: true };
    } catch (error: any) {
      return { ok: false, current, error: String(error?.message || error).slice(0, 200) };
    }
  });

  // 기존 호환 (v3.8.702: 여기도 감시자를 건다 — 빠뜨리면 이 경로만 앱이 안 돌아온다)
  ipcMain.handle('auto-update:install', () => {
    installDownloadedUpdateNow('옛 채널 auto-update:install');
  });
}
