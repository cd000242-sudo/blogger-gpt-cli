const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

// 🔧 개발 모드 설정 (라이센스 체크 건너뛰기)
process.env.DEV_MODE = 'true';
process.env.NODE_ENV = 'development';

// IPC 핸들러 등록 (electron/main.js에서)
require('./electron/main.js');

let mainWindow;

function createWindow() {
  // preload 경로 설정 (존재 여부 확인)
  const preloadPath1 = path.join(__dirname, 'electron/preload.js');
  const preloadPath2 = path.join(__dirname, 'electron/ui/preload.js');
  const preloadPath = fs.existsSync(preloadPath1) ? preloadPath1 : 
                      (fs.existsSync(preloadPath2) ? preloadPath2 : preloadPath1);
  
  console.log('[APP] Preload 경로:', preloadPath);
  console.log('[APP] Preload 파일 존재:', fs.existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      cache: false // 캐시 비활성화
    }
  });

  // 🔧 개발 모드: 개발자 도구 자동 열기
  mainWindow.webContents.openDevTools();

  // 🔧 강제 새로고침 단축키 (Ctrl+Shift+R)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === 'r') {
      console.log('[APP] 🔄 강제 새로고침 실행...');
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // 캐시 없이 로드 (빌드된 최신 파일 사용)
  // 개발 모드: dist/ui가 없으면 electron/ui를 직접 사용
  const uiPath = path.join(__dirname, 'dist/ui/index.html');
  const electronUiPath = path.join(__dirname, 'electron/ui/index.html');
  const htmlPath = fs.existsSync(uiPath) ? uiPath : electronUiPath;
  
  console.log('[APP] HTML 경로:', htmlPath);
  console.log('[APP] HTML 파일 존재:', fs.existsSync(htmlPath));
  
  if (!fs.existsSync(htmlPath)) {
    console.error('[APP] ❌ HTML 파일을 찾을 수 없습니다!');
    console.error('[APP] 시도한 경로들:');
    console.error('  -', uiPath);
    console.error('  -', electronUiPath);
    return;
  }
  
  mainWindow.loadFile(htmlPath, {
    query: { 
      t: Date.now(),
      nocache: 'true'
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  console.log('[APP] 앱 시작 - 창 생성 중...');
  
  // 🔧 개발 모드: 강력한 캐시 완전 삭제
  try {
    await session.defaultSession.clearCache();
    await session.defaultSession.clearStorageData({
      storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
    });
    console.log('[APP] ✅ 캐시 완전 삭제 완료');
  } catch (error) {
    console.warn('[APP] ⚠️ 캐시 삭제 중 오류:', error.message);
  }
  
  // Content Security Policy 설정 - 개발 모드에서는 비활성화
  // CSP를 일시적으로 완전히 비활성화하여 테스트
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // CSP 헤더를 제거하여 모든 제약 해제
    const responseHeaders = { ...details.responseHeaders };
    delete responseHeaders['Content-Security-Policy'];
    delete responseHeaders['content-security-policy'];
    
    callback({ responseHeaders });
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

