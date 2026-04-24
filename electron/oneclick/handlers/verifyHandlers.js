"use strict";
// electron/oneclick/handlers/verifyHandlers.ts
// 🔍 원클릭 "검증만 실행" — 이미 수동 세팅한 사용자를 위한 헬스체크
//
// 실측 방식: 저장된 자격증명을 읽어 실제 외부 API에 1회씩 호출해 응답을 확인한다.
// Playwright 자동화를 돌리지 않고 HTTP/REST 검증만 수행하므로 수 초 내 완료된다.
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
exports.registerVerifyIpcHandlers = registerVerifyIpcHandlers;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────
function readEnv() {
    try {
        const p = path.join(electron_1.app.getPath('userData'), '.env');
        if (!fs.existsSync(p))
            return {};
        const content = fs.readFileSync(p, 'utf-8');
        const env = {};
        for (const line of content.split('\n')) {
            const t = line.trim();
            if (!t || t.startsWith('#'))
                continue;
            const m = t.match(/^([^=]+)=(.*)$/);
            if (m)
                env[m[1].trim()] = m[2].trim();
        }
        return env;
    }
    catch {
        return {};
    }
}
async function withTimeout(p, ms, label) {
    return Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} 시간 초과(${ms}ms)`)), ms)),
    ]);
}
async function httpGet(url, init = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    }
    finally {
        clearTimeout(timer);
    }
}
function makeItem(id, label) {
    return { id, label, status: 'skip', detail: '', elapsedMs: 0 };
}
// ───────────────────────────────────────────────
// 개별 검증
// ───────────────────────────────────────────────
/** #1 Blogger OAuth — 액세스 토큰으로 블로그 목록 조회 */
async function verifyBloggerOAuth(input) {
    const item = makeItem('bloggerOAuth', 'Blogger OAuth');
    const t0 = Date.now();
    try {
        let token = input.accessToken;
        // refresh token이 있으면 토큰 재발급 시도 (access token이 만료됐을 수 있음)
        if (input.refreshToken && input.clientId && input.clientSecret) {
            try {
                const res = await httpGet('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: input.clientId,
                        client_secret: input.clientSecret,
                        refresh_token: input.refreshToken,
                        grant_type: 'refresh_token',
                    }).toString(),
                });
                if (res.ok) {
                    const j = (await res.json());
                    if (j.access_token)
                        token = j.access_token;
                }
            }
            catch { /* 무시 — 기존 access_token으로 재시도 */ }
        }
        if (!token) {
            item.status = 'skip';
            item.detail = 'access token 없음';
            item.fix = '원클릭 → Blogger 연동에서 OAuth 재인증';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const r = await httpGet('https://www.googleapis.com/blogger/v3/users/self/blogs', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
            item.status = 'fail';
            item.detail = `HTTP ${r.status}`;
            item.fix = r.status === 401
                ? '액세스 토큰 만료 — 환경설정에서 재인증'
                : 'Blogger API 접근 권한 확인';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const j = (await r.json());
        const count = Array.isArray(j.items) ? j.items.length : 0;
        item.status = 'ok';
        item.detail = `블로그 ${count}개 조회 성공`;
    }
    catch (e) {
        item.status = 'fail';
        item.detail = e?.message || '네트워크 오류';
        item.fix = '인터넷 연결 또는 Google OAuth 자격증명 확인';
    }
    return { ...item, elapsedMs: Date.now() - t0 };
}
/** #2 WordPress REST 인증 — /users/me?context=edit */
async function verifyWordPressAuth(input) {
    const item = makeItem('wordpressAuth', 'WordPress REST API 인증');
    const t0 = Date.now();
    try {
        if (!input.siteUrl || !input.username || !input.password) {
            item.status = 'skip';
            item.detail = '워드프레스 자격증명 없음';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const base = input.siteUrl.replace(/\/$/, '');
        const auth = Buffer.from(`${input.username}:${input.password}`).toString('base64');
        const r = await httpGet(`${base}/wp-json/wp/v2/users/me?context=edit`, {
            headers: { Authorization: `Basic ${auth}` },
        });
        if (!r.ok) {
            item.status = 'fail';
            item.detail = `HTTP ${r.status}`;
            item.fix = r.status === 401
                ? 'Application Password 재발급 (WP 관리자 → 사용자 → 프로필)'
                : r.status === 403
                    ? '관리자 권한 부족'
                    : '사이트 URL과 인증 정보 확인';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const j = (await r.json());
        item.status = 'ok';
        item.detail = `${j?.name || input.username} (roles: ${(j?.roles || []).join(',')})`;
    }
    catch (e) {
        item.status = 'fail';
        item.detail = e?.message || '네트워크 오류';
        item.fix = '사이트 URL이 올바른지 확인 (https:// 포함)';
    }
    return { ...item, elapsedMs: Date.now() - t0 };
}
/** #3 ads.txt 존재 확인 */
async function verifyAdsTxt(input) {
    const item = makeItem('adsTxt', 'ads.txt');
    const t0 = Date.now();
    try {
        if (!input.blogUrl) {
            item.status = 'skip';
            item.detail = 'blogUrl 없음';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const base = input.blogUrl.replace(/\/$/, '');
        const r = await httpGet(`${base}/ads.txt`);
        if (!r.ok) {
            item.status = 'fail';
            item.detail = `HTTP ${r.status} — ads.txt 없음`;
            item.fix = 'Blogger 설정 → 수익 → 맞춤 ads.txt 사용 활성화';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const text = (await r.text()).slice(0, 5000);
        if (!/pub-\d+/.test(text)) {
            item.status = 'fail';
            item.detail = 'ads.txt 존재하나 pub- 항목 없음';
            item.fix = 'AdSense 게시자 ID(pub-xxxx)를 포함한 ads.txt 재등록';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const match = text.match(/pub-\d+/);
        item.status = 'ok';
        item.detail = `${match?.[0] || 'pub-...'} 확인`;
    }
    catch (e) {
        item.status = 'fail';
        item.detail = e?.message || '네트워크 오류';
        item.fix = '블로그 URL 접근 가능 여부 확인';
    }
    return { ...item, elapsedMs: Date.now() - t0 };
}
/** #4 WordPress 도메인/SSL — public REST 루트 */
async function verifyWordPressDomain(input) {
    const item = makeItem('wordpressDomain', 'WordPress 도메인/SSL');
    const t0 = Date.now();
    try {
        if (!input.siteUrl) {
            item.status = 'skip';
            item.detail = 'siteUrl 없음';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const base = input.siteUrl.replace(/\/$/, '');
        if (!base.startsWith('https://')) {
            item.status = 'fail';
            item.detail = 'HTTPS 미사용';
            item.fix = 'Cloudways에서 Let\'s Encrypt SSL 설치 후 사이트 URL을 https:// 로 변경';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const r = await httpGet(`${base}/wp-json/wp/v2/`);
        if (!r.ok) {
            item.status = 'fail';
            item.detail = `HTTP ${r.status}`;
            item.fix = 'WP REST API 활성화 여부 확인 또는 DNS 전파 대기';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const j = (await r.json());
        const ns = Array.isArray(j?.namespaces) ? j.namespaces.length : 0;
        item.status = 'ok';
        item.detail = `REST 응답 정상 (namespaces ${ns}개)`;
    }
    catch (e) {
        item.status = 'fail';
        item.detail = e?.message || '네트워크 오류';
        item.fix = 'DNS 전파 대기 또는 SSL 인증서 상태 확인';
    }
    return { ...item, elapsedMs: Date.now() - t0 };
}
/** #5 GSC 속성 소유권 */
async function verifyGscOwnership(input) {
    const item = makeItem('gscOwnership', 'Search Console 소유권');
    const t0 = Date.now();
    try {
        let token = input.accessToken;
        if (input.refreshToken && input.clientId && input.clientSecret) {
            try {
                const res = await httpGet('https://oauth2.googleapis.com/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: input.clientId,
                        client_secret: input.clientSecret,
                        refresh_token: input.refreshToken,
                        grant_type: 'refresh_token',
                    }).toString(),
                });
                if (res.ok) {
                    const j = (await res.json());
                    if (j.access_token)
                        token = j.access_token;
                }
            }
            catch { /* 무시 */ }
        }
        if (!token || !input.blogUrl) {
            item.status = 'skip';
            item.detail = !token ? 'access token 없음' : 'blogUrl 없음';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const siteUrl = encodeURIComponent(input.blogUrl.replace(/\/$/, '') + '/');
        const r = await httpGet(`https://searchconsole.googleapis.com/webmasters/v3/sites/${siteUrl}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (r.status === 404) {
            item.status = 'fail';
            item.detail = 'GSC에 사이트가 등록되어 있지 않음';
            item.fix = 'Search Console에서 URL 접두어 방식으로 사이트 추가';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        if (!r.ok) {
            item.status = 'fail';
            item.detail = `HTTP ${r.status}`;
            item.fix = 'Search Console API 권한 확인 (webmasters.readonly 스코프 필요)';
            return { ...item, elapsedMs: Date.now() - t0 };
        }
        const j = (await r.json());
        const level = j?.permissionLevel || 'unknown';
        if (/owner/i.test(level)) {
            item.status = 'ok';
            item.detail = `소유권 확인 (${level})`;
        }
        else {
            item.status = 'fail';
            item.detail = `권한 부족 (${level})`;
            item.fix = 'GSC에서 소유자 권한으로 재확인';
        }
    }
    catch (e) {
        item.status = 'fail';
        item.detail = e?.message || '네트워크 오류';
        item.fix = 'Google OAuth 자격증명 재확인';
    }
    return { ...item, elapsedMs: Date.now() - t0 };
}
// ───────────────────────────────────────────────
// IPC 등록
// ───────────────────────────────────────────────
function registerVerifyIpcHandlers() {
    electron_1.ipcMain.handle('oneclick:verify-only', async (_evt, payload = {}) => {
        const startedAt = new Date().toISOString();
        const t0 = Date.now();
        console.log('[ONECLICK-VERIFY] 🔍 검증 시작');
        // 환경값 로드 (payload 우선, 없으면 .env에서 읽기)
        const env = readEnv();
        const blogUrl = payload.blogUrl || env.BLOG_URL || env.BLOGGER_URL || '';
        const siteUrl = payload.wordpressSiteUrl || env.WORDPRESS_SITE_URL || '';
        const wpUser = payload.wordpressUsername || env.WORDPRESS_USERNAME || '';
        const wpPass = payload.wordpressPassword || env.WORDPRESS_PASSWORD || '';
        const clientId = payload.googleClientId || env.GOOGLE_CLIENT_ID || '';
        const clientSecret = payload.googleClientSecret || env.GOOGLE_CLIENT_SECRET || '';
        const accessToken = payload.googleAccessToken || env.GOOGLE_ACCESS_TOKEN || '';
        const refreshToken = payload.googleRefreshToken || env.GOOGLE_REFRESH_TOKEN || '';
        const bloggerCreds = { accessToken, clientId, clientSecret, refreshToken };
        // 5개 검증을 병렬로 실행 (각각 독립적)
        const results = await Promise.all([
            withTimeout(verifyBloggerOAuth(bloggerCreds), 15000, 'Blogger OAuth').catch((e) => ({
                id: 'bloggerOAuth', label: 'Blogger OAuth', status: 'fail',
                detail: e?.message || '검증 실패', elapsedMs: 0,
            })),
            withTimeout(verifyWordPressAuth({ siteUrl, username: wpUser, password: wpPass }), 15000, 'WP Auth').catch((e) => ({
                id: 'wordpressAuth', label: 'WordPress REST API 인증', status: 'fail',
                detail: e?.message || '검증 실패', elapsedMs: 0,
            })),
            withTimeout(verifyAdsTxt({ blogUrl }), 15000, 'ads.txt').catch((e) => ({
                id: 'adsTxt', label: 'ads.txt', status: 'fail',
                detail: e?.message || '검증 실패', elapsedMs: 0,
            })),
            withTimeout(verifyWordPressDomain({ siteUrl }), 15000, 'WP Domain').catch((e) => ({
                id: 'wordpressDomain', label: 'WordPress 도메인/SSL', status: 'fail',
                detail: e?.message || '검증 실패', elapsedMs: 0,
            })),
            withTimeout(verifyGscOwnership({ blogUrl, ...bloggerCreds }), 15000, 'GSC Ownership').catch((e) => ({
                id: 'gscOwnership', label: 'Search Console 소유권', status: 'fail',
                detail: e?.message || '검증 실패', elapsedMs: 0,
            })),
        ]);
        // critical = Blogger OAuth + WordPress Auth (사용자가 선택한 플랫폼 중 하나는 반드시 OK여야 함)
        const bloggerOk = results[0].status === 'ok';
        const wpOk = results[1].status === 'ok';
        const overallOk = bloggerOk || wpOk; // 둘 중 하나라도 OK면 최소 운영 가능
        const report = {
            ok: overallOk,
            items: results,
            startedAt,
            elapsedMs: Date.now() - t0,
        };
        console.log(`[ONECLICK-VERIFY] ✅ 검증 완료 (${report.elapsedMs}ms) — ok=${overallOk}`);
        return report;
    });
    console.log('[ONECLICK-VERIFY] ✅ verify-only 핸들러 등록');
}
