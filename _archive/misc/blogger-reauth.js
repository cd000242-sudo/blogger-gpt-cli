/**
 * 🔐 Blogger OAuth 재인증 스크립트
 * Playwright 브라우저에서 Google 로그인 → 토큰 발급 → 저장
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const APPDATA = process.env.APPDATA || '';
const USER_DATA = path.join(APPDATA, 'blogger-gpt-cli');
const ENV_PATH = path.join(USER_DATA, '.env');
const TOKEN_PATH = path.join(USER_DATA, 'blogger-token.json');

const REDIRECT_URI = 'http://127.0.0.1:58392/callback';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/blogger';
const AUTH_URL_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';

function loadEnv() {
    const content = fs.readFileSync(ENV_PATH, 'utf8');
    const env = {};
    content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
            env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
        }
    });
    return env;
}

async function main() {
    const env = loadEnv();
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error('❌ GOOGLE_CLIENT_ID 또는 GOOGLE_CLIENT_SECRET이 .env에 없습니다');
        process.exit(1);
    }

    // OAuth URL 생성
    const authUrl = `${AUTH_URL_BASE}?` + new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: SCOPE,
        access_type: 'offline',
        prompt: 'consent'  // refresh_token을 반드시 돌려받기 위해
    }).toString();

    console.log('════════════════════════════════════════════');
    console.log('  🔐 Blogger OAuth 재인증');
    console.log('════════════════════════════════════════════');
    console.log('\n[AUTH] OAuth URL 준비 완료');
    console.log('[AUTH] 로컬 콜백 서버 시작 중...\n');

    // 콜백 서버 시작 (Promise로 auth code 대기)
    const authCode = await new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, `http://127.0.0.1:58392`);

                if (url.pathname === '/callback') {
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');

                    if (error) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>❌ 인증 실패</h1><p>' + error + '</p><script>window.close()</script>');
                        reject(new Error('OAuth 인증 거부: ' + error));
                        return;
                    }

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(`
              <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#1a1a2e;color:#e0e0e0">
                <h1>✅ 인증 성공!</h1>
                <p>이 창을 닫아도 됩니다.</p>
                <script>setTimeout(()=>window.close(),2000)</script>
              </body></html>
            `);
                        server.close();
                        resolve(code);
                    }
                }
            } catch (e) {
                reject(e);
            }
        });

        server.listen(58392, '127.0.0.1', () => {
            console.log('[AUTH] ✅ 콜백 서버 시작됨: http://127.0.0.1:58392');
            console.log('[AUTH] 🌐 Playwright 브라우저에서 Google 로그인 페이지를 여세요...');
            console.log('[AUTH] AUTH_URL:', authUrl);
            console.log('\n⏳ Google 로그인을 기다리는 중...\n');
        });

        // 5분 타임아웃
        setTimeout(() => {
            server.close();
            reject(new Error('인증 타임아웃 (5분)'));
        }, 5 * 60 * 1000);
    });

    console.log('[AUTH] ✅ Auth code 수신 완료!');

    // Auth code → Token 교환
    console.log('[TOKEN] 🔄 토큰 교환 중...');
    const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code: authCode,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        })
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
        console.error('❌ 토큰 교환 실패:', tokenData.error, tokenData.error_description);
        process.exit(1);
    }

    // expires_at 추가
    if (tokenData.expires_in) {
        tokenData.expires_at = Date.now() + (tokenData.expires_in * 1000);
    }

    // 토큰 저장
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2), 'utf8');
    console.log('[TOKEN] ✅ 토큰 저장 완료:', TOKEN_PATH);
    console.log('[TOKEN] access_token:', tokenData.access_token?.substring(0, 20) + '...');
    console.log('[TOKEN] has refresh_token:', !!tokenData.refresh_token);
    console.log('[TOKEN] expires_at:', new Date(tokenData.expires_at).toISOString());

    console.log('\n════════════════════════════════════════════');
    console.log('  ✅ Blogger OAuth 재인증 완료!');
    console.log('  이제 블로거 발행이 가능합니다.');
    console.log('════════════════════════════════════════════');
}

main().catch(err => {
    console.error('❌ 인증 실패:', err.message);
    process.exit(1);
});
