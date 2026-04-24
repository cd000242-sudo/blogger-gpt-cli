/**
 * 하이브리드 로그인 시스템 (자동 로그인 + 로그인 창)
 * 앱 시작 시 자동 로그인 시도, 실패 시 로그인 창 표시
 */

import { BrowserWindow, ipcMain, app } from 'electron';
import * as path from 'path';
import { tryAutoLogin, saveAutoLoginConfig, loadAutoLoginConfig } from '../dist/utils/auto-login-manager';
import { getLicenseManager } from '../dist/utils/license-manager-new';

let loginWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

// 🔥 Metrics OAuth (Search Console + GA4)
let metricsOAuthServer: any = null;
const METRICS_OAUTH_PORT = 58393; // 고정 포트

/**
 * 로그인 창 생성 및 표시
 */
function createLoginWindow(parent?: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (value: boolean) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    // 기존 로그인 창이 있으면 닫기
    if (loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }

    // Preload 경로 설정 (배포 환경 대응)
    const preloadPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.js')
      : path.join(__dirname, 'preload.js');
    
    console.log('[LOGIN] Preload 경로:', preloadPath);
    console.log('[LOGIN] isPackaged:', app.isPackaged);

    loginWindow = new BrowserWindow({
      width: 520,
      height: 750,
      resizable: true,
      minWidth: 480,
      minHeight: 650,
      modal: true,
      parent: parent || undefined,
      frame: true,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: preloadPath,
        webSecurity: true
      },
      show: false // 준비될 때까지 숨김
    });

    // 🔥 업데이터에 로그인 창 참조 연결 (업데이트 발견 시 자동 숨김)
    try {
      const { setUpdaterLoginWindow } = require('./updater');
      setUpdaterLoginWindow(loginWindow);
    } catch (e) {
      console.log('[LOGIN] updater 연결 생략:', e);
    }

    const loginHtmlPath = path.join(__dirname, 'ui', 'login-window.html');

    // 로그인 창 로드
    loginWindow.loadFile(loginHtmlPath).then(() => {
      loginWindow?.show();
    }).catch((error) => {
      console.error('[LOGIN] 로그인 창 로드 실패:', error);
      // 폴백: 인라인 HTML 사용
      const fallbackHtml = `
        <!doctype html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>라이선스 인증</title>
          <style>
            body { font-family: system-ui; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
            .container { background: white; border-radius: 24px; padding: 40px; max-width: 450px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
            h1 { text-align: center; margin-bottom: 8px; color: #1e293b; }
            p { text-align: center; color: #64748b; margin-bottom: 32px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 8px; color: #334155; font-weight: 600; }
            input { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; box-sizing: border-box; }
            input:focus { outline: none; border-color: #667eea; }
            .auto-login { display: flex; align-items: center; margin-bottom: 24px; }
            .auto-login input { width: 20px; margin-right: 10px; }
            button { width: 100%; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; }
            button:hover { transform: translateY(-2px); }
            .error { background: #fee2e2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 20px; display: none; }
            .error.show { display: block; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔐 라이선스 인증</h1>
            <p>앱을 사용하려면 인증이 필요합니다</p>
            <div id="error" class="error"></div>
            <form id="loginForm">
              <div class="form-group">
                <label for="userId">아이디</label>
                <input type="text" id="userId" placeholder="아이디를 입력하세요" required>
              </div>
              <div class="form-group">
                <label for="password">비밀번호</label>
                <input type="password" id="password" placeholder="비밀번호를 입력하세요" required>
              </div>
              <div class="form-group">
                <label for="licenseCode">라이선스 코드 <span style="color: #94a3b8; font-weight: normal;">(선택사항)</span></label>
                <input type="text" id="licenseCode" placeholder="기간제: 코드 입력 | 영구제: 패치 파일 필요">
              </div>
              <div class="auto-login">
                <input type="checkbox" id="autoLogin" checked>
                <label for="autoLogin">자동 로그인 (다음부터 자동으로 로그인)</label>
              </div>
              <button type="submit">로그인</button>
            </form>
          </div>
          <script>
            const electronAPI = window.electronAPI || window.electron || window.blogger;
            const form = document.getElementById('loginForm');
            const error = document.getElementById('error');
            
            if (!electronAPI) {
              error.textContent = '앱 초기화 오류가 발생했습니다. 앱을 다시 시작해주세요.';
              error.classList.add('show');
            }
            
            form.addEventListener('submit', async (e) => {
              e.preventDefault();
              if (!electronAPI) {
                error.textContent = 'IPC를 사용할 수 없습니다.';
                error.classList.add('show');
                return;
              }
              
              const userId = document.getElementById('userId').value.trim();
              const password = document.getElementById('password').value;
              const licenseCode = document.getElementById('licenseCode').value.trim() || undefined;
              const autoLogin = document.getElementById('autoLogin').checked;
              
              if (!userId || !password) {
                error.textContent = '아이디와 비밀번호를 입력해주세요.';
                error.classList.add('show');
                return;
              }
              
              try {
                const result = await electronAPI.invoke('license-authenticate', { userId, password, licenseCode });
                
                if (result.success) {
                  if (autoLogin) {
                    await electronAPI.invoke('save-auto-login-config', true, userId);
                  }
                  await electronAPI.invoke('login-success-signal');
                } else {
                  error.textContent = result.message || '인증 실패';
                  error.classList.add('show');
                }
              } catch (err) {
                error.textContent = '인증 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류');
                error.classList.add('show');
              }
            });
          </script>
        </body>
        </html>
      `;
      loginWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`);
    });

    // 로그인 성공 이벤트 (contextBridge를 통한 invoke 사용)
    const loginSuccessHandler = async () => {
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      return { success: true };
    };
    
    // 기존 핸들러 제거 후 등록 (중복 방지)
    ipcMain.removeHandler('login-success-signal');
    ipcMain.handle('login-success-signal', loginSuccessHandler);
    
    // 로그인 성공 시 resolve 호출
    loginWindow.webContents.on('ipc-message', (_event: any, channel: string) => {
      if (channel === 'login-success') {
        safeResolve(true);
      }
    });
    
    // 로그인 성공 핸들러에서 resolve 호출
    const originalHandler = loginSuccessHandler;
    ipcMain.removeHandler('login-success-signal');
    ipcMain.handle('login-success-signal', async () => {
      const result = await originalHandler();
      safeResolve(true);
      return result;
    });

    // 창 닫힘 이벤트
    loginWindow.on('closed', () => {
      loginWindow = null;
      // 창이 닫혔지만 로그인 성공하지 않은 경우
      safeResolve(false);
    });

    // ESC 키로 창 닫기 방지 (로그인 필수)
    loginWindow.on('close', (e) => {
      // 로그인 성공하지 않은 경우 창 닫기 방지
      // (실제로는 사용자가 강제로 닫을 수 있도록 허용)
    });
  });
}

/**
 * 하이브리드 로그인 시스템 (자동 로그인 + 로그인 창)
 * 앱 시작 시 호출
 */
export async function checkLicenseWithAutoLogin(): Promise<boolean> {
  try {
    console.log('[AUTO-LOGIN] 자동 로그인 확인 시작...');
    
    // 1. 자동 로그인 시도
    const autoLoginResult = await tryAutoLogin();
    
    if (autoLoginResult.success) {
      console.log('[AUTO-LOGIN] ✅ 자동 로그인 성공:', autoLoginResult.message);
      return true; // 자동 로그인 성공, 메인 윈도우 표시
    }
    
    // 2. 자동 로그인 실패 시 로그인 창 표시
    console.log('[AUTO-LOGIN] ⚠️ 자동 로그인 실패, 로그인 창 표시:', autoLoginResult.message);
    
    const loginSuccess = await createLoginWindow(mainWindow || undefined);
    
    if (loginSuccess) {
      console.log('[AUTO-LOGIN] ✅ 로그인 창을 통한 인증 성공');
      return true;
    }
    
    console.log('[AUTO-LOGIN] ❌ 로그인 실패 또는 취소');
    return false;
  } catch (error: any) {
    console.error('[AUTO-LOGIN] 로그인 확인 중 오류:', error);
    // 오류 발생 시에도 로그인 창 표시 시도
    try {
      const loginSuccess = await createLoginWindow(mainWindow || undefined);
      return loginSuccess;
    } catch (loginError) {
      console.error('[AUTO-LOGIN] 로그인 창 표시 실패:', loginError);
      return false;
    }
  }
}

/**
 * 메인 윈도우 참조 설정
 */
export function setMainWindow(window: BrowserWindow | null) {
  mainWindow = window;
}

/**
 * 🔥 Metrics OAuth 로컬 서버 시작 및 자동 콜백 처리
 */
export function startMetricsOAuthServer(onCodeReceived: (code: string) => void): Promise<{ success: boolean; port?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const http = require('http');

      if (metricsOAuthServer) {
        try {
          metricsOAuthServer.close();
        } catch {}
        metricsOAuthServer = null;
      }

      metricsOAuthServer = http.createServer((req: any, res: any) => {
        const url = new URL(req.url || '', `http://127.0.0.1:${METRICS_OAUTH_PORT}`);

        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

          if (error) {
            res.end(`<h2>❌ 연동 실패</h2><p>${error}</p><p>이 창을 닫고 앱으로 돌아가세요.</p>`);
            return;
          }

          if (!code) {
            res.end(`<h2>❌ 연동 실패</h2><p>인증 코드가 없습니다.</p><p>이 창을 닫고 앱으로 돌아가세요.</p>`);
            return;
          }

          res.end(`<h2>✅ 연동 완료</h2><p>이 창을 닫고 앱으로 돌아가세요.</p>`);

          setTimeout(() => {
            try {
              onCodeReceived(String(code));
            } catch {}
          }, 50);
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      });

      metricsOAuthServer.listen(METRICS_OAUTH_PORT, '127.0.0.1', () => {
        console.log(`[METRICS-OAUTH-SERVER] ✅ 서버 시작: http://127.0.0.1:${METRICS_OAUTH_PORT}`);
        resolve({ success: true, port: METRICS_OAUTH_PORT });
      });

      metricsOAuthServer.on('error', (err: any) => {
        console.error('[METRICS-OAUTH-SERVER] ❌ 서버 오류:', err);
        resolve({ success: false, error: err?.message || String(err || '서버 오류') });
      });
    } catch (error: any) {
      console.error('[METRICS-OAUTH-SERVER] ❌ 서버 시작 실패:', error);
      resolve({ success: false, error: error?.message || String(error || '서버 시작 실패') });
    }
  });
}

/**
 * 🔥 Metrics OAuth 콜백 처리 (코드를 토큰으로 교환 후 저장)
 */
export async function handleMetricsCallback(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const fs = require('fs');
    const envPath = path.join(app.getPath('userData'), '.env');

    if (!fs.existsSync(envPath)) {
      throw new Error('.env 파일이 없습니다. 환경설정에서 Google Client ID/Secret을 먼저 저장해주세요.');
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const parseEnvFile = (content: string) => {
      const vars: Record<string, string> = {};
      content.split('\n').forEach((line) => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
      });
      return vars;
    };

    const envVars = parseEnvFile(envContent);
    const clientId = envVars.GOOGLE_CLIENT_ID || envVars.googleClientId || '';
    const clientSecret = envVars.GOOGLE_CLIENT_SECRET || envVars.googleClientSecret || '';

    if (!clientId || !clientSecret) {
      throw new Error('Google Client ID 또는 Secret이 설정되지 않았습니다.');
    }

    const redirectUri = `http://127.0.0.1:${METRICS_OAUTH_PORT}/callback`;
    const tokens = await exchangeOAuthToken({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code).trim(),
      redirect_uri: redirectUri
    });

    const tokenPath = path.join(app.getPath('userData'), 'metrics-token.json');
    let existingRefreshToken: string | undefined;
    try {
      if (fs.existsSync(tokenPath)) {
        const existingRaw = fs.readFileSync(tokenPath, 'utf-8');
        const existing = JSON.parse(existingRaw);
        if (existing && existing.refresh_token) existingRefreshToken = String(existing.refresh_token);
      }
    } catch {}

    const tokenFileData = {
      ...tokens,
      refresh_token: tokens.refresh_token || existingRefreshToken,
      created_at: Date.now(),
      expires_at: tokens.expires_in ? Date.now() + (Number(tokens.expires_in) * 1000) : undefined,
    };
    fs.writeFileSync(tokenPath, JSON.stringify(tokenFileData, null, 2), 'utf-8');
    console.log('[METRICS-CALLBACK] ✅ 토큰 저장 완료:', tokenPath);
    return { success: true };
  } catch (error: any) {
    console.error('[METRICS-CALLBACK] 오류:', error);
    return { success: false, error: error?.message || String(error || '알 수 없는 오류') };
  }
}

/**
 * 자동 로그인 설정 저장 IPC 핸들러
 */
export function setupAutoLoginHandlers() {
  ipcMain.handle('save-auto-login-config', async (_evt, enabled: boolean, userId?: string) => {
    saveAutoLoginConfig(enabled, userId);
    return { success: true };
  });

  ipcMain.handle('load-auto-login-config', async () => {
    return loadAutoLoginConfig();
  });
}

type OAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
};

/**
 * OAuth 토큰 교환 (코드를 토큰으로 교환)
 */
export async function exchangeOAuthToken(args: { 
  client_id: string; 
  client_secret: string; 
  code: string; 
  redirect_uri: string 
}): Promise<{ access_token: string; refresh_token?: string; expires_in: number; token_type: string }> {
  try {
    console.log('[OAUTH-TOKEN] OAuth 토큰 교환 시작');
    
    const { client_id, client_secret, code, redirect_uri } = args;
    
    if (!client_id || !client_secret || !code) {
      throw new Error('필수 파라미터가 누락되었습니다.');
    }
    
    // Node.js https 모듈 사용 (fetch 대신)
    const https = require('https');
    const querystring = require('querystring');
    
    const postData = querystring.stringify({
      code: code,
      client_id: client_id,
      client_secret: client_secret,
      redirect_uri: redirect_uri,
      grant_type: 'authorization_code',
    });
    
    console.log('[OAUTH-TOKEN] 요청 데이터:', {
      code: code.substring(0, 20) + '...',
      client_id: client_id.substring(0, 20) + '...',
      redirect_uri: redirect_uri
    });
    
    // OAuth 토큰 교환
    const tokenData = await new Promise<OAuthTokenResponse>((resolve, reject) => {
      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('[OAUTH-TOKEN] 토큰 교환 실패:', responseData);
              reject(new Error(`토큰 교환 실패 (${res.statusCode}): ${responseData}`));
              return;
            }
            
            const parsed = JSON.parse(responseData);
            if (!parsed || !parsed.access_token) {
              reject(new Error('토큰 교환 실패: access_token이 없습니다.'));
              return;
            }
            resolve(parsed);
          } catch (parseError) {
            console.error('[OAUTH-TOKEN] 응답 파싱 실패:', parseError);
            reject(new Error(`응답 파싱 실패: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}`));
          }
        });
      });
      
      req.on('error', (error: Error) => {
        console.error('[OAUTH-TOKEN] 요청 오류:', error);
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    return {
      access_token: String(tokenData.access_token || ''),
      refresh_token: tokenData.refresh_token ? String(tokenData.refresh_token) : undefined,
      expires_in: Number(tokenData.expires_in || 0),
      token_type: String(tokenData.token_type || 'Bearer'),
    };
  } catch (error) {
    console.error('[OAUTH-TOKEN] 오류:', error);
    throw error;
  }
}

// 🔥 Blogger OAuth 로컬 서버 (Google OOB 플로우 deprecated 대응)
let bloggerOAuthServer: any = null;
const BLOGGER_OAUTH_PORT = 58392; // 고정 포트

/**
 * Blogger OAuth 시작 (로컬 서버 기반)
 */
export async function startBloggerOAuthWithServer(): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fs = require('fs');
    const envPath = path.join(app.getPath('userData'), '.env');
    
    if (!fs.existsSync(envPath)) {
      throw new Error('환경 설정 파일이 없습니다.');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const parseEnvFile = (content: string) => {
      const vars: Record<string, string> = {};
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
      });
      return vars;
    };
    
    const envVars = parseEnvFile(envContent);
    const clientId = envVars.GOOGLE_CLIENT_ID || envVars.googleClientId || '';
    
    if (!clientId) {
      throw new Error('Google Client ID가 설정되지 않았습니다.');
    }
    
    // 기존 서버 종료
    if (bloggerOAuthServer) {
      try { bloggerOAuthServer.close(); } catch (e) {}
      bloggerOAuthServer = null;
    }
    
    const redirectUri = `http://127.0.0.1:${BLOGGER_OAUTH_PORT}/callback`;
    const scope = 'https://www.googleapis.com/auth/blogger';
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    console.log('[BLOGGER-OAUTH] OAuth URL 생성:', oauthUrl);
    console.log('[BLOGGER-OAUTH] Redirect URI:', redirectUri);
    
    return { success: true, url: oauthUrl };
    
  } catch (error) {
    console.error('[BLOGGER-OAUTH] 오류:', error);
    return { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' };
  }
}

/**
 * Blogger OAuth 콜백 처리 (코드를 토큰으로 교환)
 */
export async function handleBloggerCallback(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[BLOGGER-CALLBACK] OAuth 코드 처리 시작');
    console.log('[BLOGGER-CALLBACK] 코드 길이:', code?.length || 0);
    
    // 🔥 코드 정리 (앞뒤 공백, URL 인코딩 제거)
    let cleanCode = code.trim();
    // URL 인코딩된 슬래시 디코딩
    cleanCode = cleanCode.replace(/%2F/g, '/');
    console.log('[BLOGGER-CALLBACK] 정리된 코드:', cleanCode.substring(0, 20) + '...');
    
    const fs = require('fs');
    const envPath = path.join(app.getPath('userData'), '.env');
    
    if (!fs.existsSync(envPath)) {
      throw new Error('환경 설정 파일이 없습니다.');
    }
    
    // .env 파일 읽기
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const parseEnvFile = (content: string) => {
      const vars: Record<string, string> = {};
      content.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
      });
      return vars;
    };
    
    const envVars = parseEnvFile(envContent);
    const clientId = envVars.GOOGLE_CLIENT_ID || envVars.googleClientId || '';
    const clientSecret = envVars.GOOGLE_CLIENT_SECRET || envVars.googleClientSecret || '';
    
    // 🔥 redirect_uri: 로컬 서버 기반 (OOB deprecated 대응)
    const redirectUri = `http://127.0.0.1:${BLOGGER_OAUTH_PORT}/callback`;
    
    if (!clientId || !clientSecret) {
      throw new Error('Google Client ID 또는 Secret이 설정되지 않았습니다.');
    }
    
    console.log('[BLOGGER-CALLBACK] Client ID:', clientId.substring(0, 20) + '...');
    console.log('[BLOGGER-CALLBACK] Redirect URI:', redirectUri);
    
    // Node.js https 모듈 사용 (fetch 대신)
    const https = require('https');
    const querystring = require('querystring');
    
    const postData = querystring.stringify({
      code: cleanCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    
    console.log('[BLOGGER-CALLBACK] POST 데이터 길이:', postData.length);
    
    // OAuth 토큰 교환
    const tokenData = await new Promise<any>((resolve, reject) => {
      const options = {
        hostname: 'oauth2.googleapis.com',
        port: 443,
        path: '/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };
      
      const req = https.request(options, (res: any) => {
        let responseData = '';
        
        res.on('data', (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              console.error('[BLOGGER-CALLBACK] 토큰 교환 실패:', responseData);
              reject(new Error(`토큰 교환 실패 (${res.statusCode}): ${responseData}`));
              return;
            }
            
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (parseError) {
            console.error('[BLOGGER-CALLBACK] 응답 파싱 실패:', parseError);
            reject(new Error(`응답 파싱 실패: ${parseError instanceof Error ? parseError.message : '알 수 없는 오류'}`));
          }
        });
      });
      
      req.on('error', (error: Error) => {
        console.error('[BLOGGER-CALLBACK] 요청 오류:', error);
        reject(error);
      });
      
      req.write(postData);
      req.end();
    });
    
    // 토큰 파일에 저장
    const tokenPath = path.join(app.getPath('userData'), 'blogger-token.json');
    const tokenFileData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type || 'Bearer',
      scope: tokenData.scope,
      expires_at: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : null,
    };
    
    fs.writeFileSync(tokenPath, JSON.stringify(tokenFileData, null, 2), 'utf-8');
    
    console.log('[BLOGGER-CALLBACK] ✅ 토큰 저장 완료');
    
    return { success: true };
  } catch (error) {
    console.error('[BLOGGER-CALLBACK] 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * 🔥 Blogger OAuth 로컬 서버 시작 및 자동 콜백 처리
 */
export function startBloggerOAuthServer(onCodeReceived: (code: string) => void): Promise<{ success: boolean; port?: number; error?: string }> {
  return new Promise((resolve) => {
    try {
      const http = require('http');
      
      // 기존 서버 종료
      if (bloggerOAuthServer) {
        try { bloggerOAuthServer.close(); } catch (e) {}
        bloggerOAuthServer = null;
      }
      
      bloggerOAuthServer = http.createServer((req: any, res: any) => {
        const url = new URL(req.url || '', `http://127.0.0.1:${BLOGGER_OAUTH_PORT}`);
        
        if (url.pathname === '/callback') {
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          
          if (error) {
            console.error('[BLOGGER-OAUTH-SERVER] OAuth 오류:', error);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
              <head><title>인증 실패</title></head>
              <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: #fef2f2;">
                <h1 style="color: #dc2626;">❌ 인증 실패</h1>
                <p>오류: ${error}</p>
                <p>이 창을 닫고 다시 시도해주세요.</p>
              </body>
              </html>
            `);
            return;
          }
          
          if (code) {
            console.log('[BLOGGER-OAUTH-SERVER] ✅ 인증 코드 수신:', code.substring(0, 20) + '...');
            
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
              <head><title>인증 성공</title></head>
              <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);">
                <h1 style="color: #059669;">✅ 인증 성공!</h1>
                <p style="font-size: 18px; color: #047857;">Blogger 계정이 연동되었습니다.</p>
                <p style="color: #6b7280;">이 창을 닫아도 됩니다.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
              </html>
            `);
            
            // 콜백 함수 호출
            onCodeReceived(code);
            
            // 3초 후 서버 종료
            setTimeout(() => {
              if (bloggerOAuthServer) {
                try { bloggerOAuthServer.close(); } catch (e) {}
                bloggerOAuthServer = null;
              }
            }, 3000);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <html>
              <head><title>오류</title></head>
              <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #dc2626;">❌ 인증 코드가 없습니다</h1>
              </body>
              </html>
            `);
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      
      bloggerOAuthServer.listen(BLOGGER_OAUTH_PORT, '127.0.0.1', () => {
        console.log(`[BLOGGER-OAUTH-SERVER] ✅ 서버 시작: http://127.0.0.1:${BLOGGER_OAUTH_PORT}`);
        resolve({ success: true, port: BLOGGER_OAUTH_PORT });
      });
      
      bloggerOAuthServer.on('error', (err: any) => {
        console.error('[BLOGGER-OAUTH-SERVER] 서버 오류:', err);
        resolve({ success: false, error: err.message });
      });
      
    } catch (error) {
      console.error('[BLOGGER-OAUTH-SERVER] 오류:', error);
      resolve({ success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' });
    }
  });
}

/**
 * Blogger OAuth 서버 종료
 */
export function stopBloggerOAuthServer(): void {
  if (bloggerOAuthServer) {
    try { bloggerOAuthServer.close(); } catch (e) {}
    bloggerOAuthServer = null;
    console.log('[BLOGGER-OAUTH-SERVER] 서버 종료됨');
  }
}


