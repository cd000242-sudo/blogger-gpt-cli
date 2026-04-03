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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postToBlogger = postToBlogger;
// src/cli.ts — 통합본 + 비대화식 플래그 지원
require("dotenv/config");
const dayjs_1 = __importDefault(require("dayjs"));
const promises_1 = __importDefault(require("node:readline/promises"));
const googleapis_1 = require("googleapis");
const node_http_1 = __importDefault(require("node:http"));
const node_url_1 = require("node:url");
const promises_2 = require("node:timers/promises");
const openai_1 = __importDefault(require("openai"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const generative_ai_1 = require("@google/generative-ai");
const XLSX = __importStar(require("xlsx"));
/* =========================
 * 0) 환경변수
 * ========================= */
const BLOG_ID = process.env.BLOG_ID || process.env.blogId || '';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.googleClientId || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.googleClientSecret || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:8080';
const DEFAULT_LABELS = (process.env.DEFAULT_LABELS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOW_COMMENTS = (process.env.ALLOW_COMMENTS || 'true') === 'true';
const RATE_LIMIT_SECONDS = parseInt(process.env.RATE_LIMIT_SECONDS || '30', 10);
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const PROVIDER = (process.env.PROVIDER || 'openai').toLowerCase(); // openai | gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MIN_CHARS = parseInt(process.env.MIN_CHARS || '3000', 10); // ★ 최소 3,000자
const TOKEN_PATH = 'token.json';
/* 사이트/작성자 메타 + CTA */
const AUTHOR_NAME = process.env.AUTHOR_NAME || 'Author';
const AUTHOR_ROLE = process.env.AUTHOR_ROLE || '';
const AUTHOR_CREDENTIALS = process.env.AUTHOR_CREDENTIALS || '';
const SITE_NAME = process.env.SITE_NAME || '';
const CONTACT_URL = process.env.CONTACT_URL || '#';
const PRIVACY_URL = process.env.PRIVACY_URL || '#';
const CTA_MODE = (process.env.CTA_MODE || 'search').toLowerCase(); // search | site | path
const CTA_SEARCH_SITE = process.env.CTA_SEARCH_SITE || '';
const CTA_BASE_URL = process.env.CTA_BASE_URL || '';
const CTA_QUERY_SUFFIX = process.env.CTA_QUERY_SUFFIX || '신청 방법';
const CTA_TEXT_PREFIX = process.env.CTA_TEXT_PREFIX || '바로가기';
/* Excel 일괄 포스팅 */
const EXCEL_PATH = process.env.EXCEL_PATH || '';
const EXCEL_SHEET = process.env.EXCEL_SHEET || 'Sheet1';
const EXCEL_RATE_DELAY = parseInt(process.env.EXCEL_RATE_DELAY || `${RATE_LIMIT_SECONDS}`, 10);
/* =========================
 * 1) 오프라인 라이선스(영구, 공개키 검증)
 * ========================= */
const PUBLIC_KEY_PEM = `
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEARFwrms/n44X/Zu/roeTsaf2powAMiOQJRjkyn5oo+iE=
-----END PUBLIC KEY-----
`.trim();
function getDeviceId() {
    const base = `${node_os_1.default.hostname()}|${node_os_1.default.platform()}|${node_os_1.default.arch()}`;
    return Buffer.from(base).toString('hex').slice(0, 16);
}
function licensePath() {
    const home = node_os_1.default.homedir();
    const dir = process.platform === 'win32'
        ? node_path_1.default.join(process.env.APPDATA || node_path_1.default.join(home, 'AppData', 'Roaming'), 'blogger-gpt-cli')
        : node_path_1.default.join(home, '.blogger-gpt-cli');
    if (!node_fs_1.default.existsSync(dir))
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    return node_path_1.default.join(dir, 'license.lic');
}
function verifyLicense(lic, currentDeviceId) {
    try {
        if (!lic || !lic.sig)
            return { ok: false, reason: 'no_license' };
        if (lic.deviceId !== currentDeviceId)
            return { ok: false, reason: 'device_mismatch' };
        const { sig, ...unsigned } = lic;
        const ok = node_crypto_1.default.verify(null, Buffer.from(JSON.stringify(unsigned)), PUBLIC_KEY_PEM, Buffer.from(sig, 'base64'));
        return ok ? { ok: true } : { ok: false, reason: 'bad_signature' };
    }
    catch (e) {
        return { ok: false, reason: e.message };
    }
}
/* =========================
 * 2) Google OAuth2
 * ========================= */
function oauth2Client() {
    const o = new googleapis_1.google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
    if (node_fs_1.default.existsSync(TOKEN_PATH)) {
        const t = JSON.parse(node_fs_1.default.readFileSync(TOKEN_PATH, 'utf-8'));
        o.setCredentials(t);
    }
    return o;
}
async function ensureAuth(o) {
    try {
        console.log('[ensureAuth] 토큰 확인 중...');
        const token = await o.getAccessToken();
        console.log('[ensureAuth] 토큰 유효함');
        return o;
    }
    catch (error) {
        console.log('[ensureAuth] 토큰 만료 또는 없음, 재인증 필요');
        console.log('[ensureAuth] 오류:', error.message);
        // 재인증 시도 전 메모리 정리
        if (global.gc) {
            global.gc();
            console.log('[ensureAuth] 재인증 전 가비지 컬렉션 실행');
        }
        try {
            return await doAuthFlow(o);
        }
        catch (authError) {
            console.error('[ensureAuth] 재인증 실패:', authError);
            // 재인증 실패 시 메모리 정리
            if (global.gc) {
                global.gc();
                console.log('[ensureAuth] 재인증 실패 후 가비지 컬렉션 실행');
            }
            throw authError;
        }
    }
}
async function doAuthFlow(o) {
    const scopes = ['https://www.googleapis.com/auth/blogger'];
    const url = o.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' });
    console.log('\n[OAuth] 승인 URL:\n', url, '\n');
    const code = await new Promise((resolve, reject) => {
        const ports = [8080, 8081, 8082, 8083, 8084];
        let currentPortIndex = 0;
        let server = null;
        // 전체 타임아웃 설정 (5분)
        const overallTimeout = setTimeout(() => {
            if (server) {
                server.close();
            }
            reject(new Error('OAuth 인증 전체 시간 초과: 5분을 초과했습니다.'));
        }, 5 * 60 * 1000);
        const tryPort = () => {
            if (currentPortIndex >= ports.length) {
                clearTimeout(overallTimeout);
                reject(new Error('사용 가능한 포트를 찾을 수 없습니다.'));
                return;
            }
            const port = ports[currentPortIndex];
            server = node_http_1.default.createServer((req, res) => {
                try {
                    const u = new node_url_1.URL(req.url || '', `http://localhost:${port}`);
                    const received = u.searchParams.get('code');
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end('<h3>인증 완료: 창을 닫고 프로그램으로 돌아오세요.</h3>');
                    if (received) {
                        clearTimeout(overallTimeout);
                        resolve(received);
                        if (server) {
                            server.close();
                        }
                    }
                }
                catch (error) {
                    console.error('[OAuth] 요청 처리 오류:', error);
                    res.writeHead(500);
                    res.end('오류가 발생했습니다.');
                }
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log(`포트 ${port}가 사용 중입니다. 다음 포트를 시도합니다...`);
                    currentPortIndex++;
                    if (server) {
                        server.close();
                    }
                    setTimeout(tryPort, 500);
                }
                else {
                    console.error(`[OAuth] 서버 오류:`, err);
                    clearTimeout(overallTimeout);
                    reject(err);
                }
            });
            server.listen(port, () => {
                console.log(`[OAuth] 콜백 대기중: http://localhost:${port}`);
                // URL도 동적으로 업데이트
                const dynamicUrl = o.generateAuthUrl({
                    access_type: 'offline',
                    scope: scopes,
                    prompt: 'consent',
                    redirect_uri: `http://localhost:${port}`
                });
                console.log('\n[OAuth] 승인 URL:\n', dynamicUrl, '\n');
            });
        };
        tryPort();
    });
    console.log('[OAuth] 인증 코드 수신 완료');
    const { tokens } = await o.getToken(code);
    o.setCredentials(tokens);
    node_fs_1.default.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log('[OAuth] 토큰 저장:', TOKEN_PATH);
    return o;
}
/* =========================
 * 3) 유틸: 길이 계산/CTA/스킨
 * ========================= */
function charCountFromHtml(html) {
    const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, '');
    return text.length;
}
function toKebabSlug(input) {
    return input.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s+/g, '-').replace(/-+/g, '-');
}
function buildCtaUrl(topic, keywords) {
    const baseQuery = [topic, CTA_QUERY_SUFFIX].filter(Boolean).join(' ');
    if (CTA_MODE === 'site' && CTA_SEARCH_SITE) {
        const q = encodeURIComponent(`site:${CTA_SEARCH_SITE} ${baseQuery}`);
        return `https://www.google.com/search?q=${q}`;
    }
    if (CTA_MODE === 'path' && CTA_BASE_URL) {
        const slug = toKebabSlug(topic);
        return `${CTA_BASE_URL.replace(/\/+$/, '')}/${encodeURIComponent(slug)}`;
    }
    const q = encodeURIComponent(baseQuery);
    return `https://www.google.com/search?q=${q}`;
}
function buildCtaText(topic) {
    return `${topic} ${CTA_QUERY_SUFFIX} ${CTA_TEXT_PREFIX}`.trim();
}
function getSkinCssMono() {
    const accent = process.env.ACCENT_COLOR || '#111111';
    const maxWidth = process.env.MAX_WIDTH || '760px';
    return `
  <style data-skin="mono">
    :root{--accent:${accent};--ink:#111827;--muted:#6b7280;--line:#e5e7eb;--bg:#ffffff}
    .mono-wrap{box-sizing:border-box;margin:0 auto;max-width:${maxWidth};padding:24px;background:var(--bg);color:var(--ink);position:relative}
    .mono-article{border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.05);overflow:hidden;background:#fff}
    .mono-head{padding:28px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fff,#fafafa)}
    .mono-kicker{letter-spacing:.15em;text-transform:uppercase;color:var(--muted);font:700 12px/1 ui-sans-serif,system-ui}
    .mono-title{font:700 clamp(26px,3.4vw,36px)/1.25 'Noto Serif KR',serif;margin:8px 0 6px}
    .mono-sub{color:var(--muted)}
    .mono-meta{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:13px;margin-top:10px}
    .mono-author{margin-top:12px; padding:12px 14px; border:1px solid var(--line); border-radius:10px; background:#fff}
    .mono-author .name{font-weight:800}
    .mono-author .role{color:var(--muted); margin-top:2px}
    .mono-author .creds{color:#475569; font-size:14px; margin-top:4px}
    .mono-body{padding:26px}
    .mono-body p{margin:14px 0;font:400 17px/1.9 'Noto Serif KR',serif}
    .mono-body h2{
      font:700 20px/1.5 'Noto Serif KR',serif;
      margin:24px 0 12px;
      background:#ECFDF5;
      border:1px solid #10B981;
      border-left:6px solid #10B981;
      color:#065F46;
      padding:10px 12px;
      border-radius:8px;
    }
    .mono-body h3{font:600 18px/1.5 'Noto Serif KR',serif;margin:22px 0 8px}
    .mono-body ul,.mono-body ol{margin:12px 0 12px 22px}
    .mono-body li{margin:6px 0}
    .mono-dropcap p:first-of-type::first-letter{float:left;font:700 56px/1 'Noto Serif KR',serif;margin:6px 10px 0 0;color:var(--accent)}
    .mono-quote{margin:18px 0;padding:12px 16px;border-left:4px solid var(--accent);background:#fafafa;color:#374151;border-radius:6px}
    .mono-footer{padding:16px 26px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;background:#fafafa}
    a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(0,0,0,.15)}
    .mono-toc-side{position:fixed; top:100px; left:20px; width:180px; display:flex; flex-direction:column; gap:8px;}
    .mono-toc-head{font-weight:700; margin-bottom:6px;}
    .mono-toc button{all:unset; cursor:pointer; padding:8px 12px; border-radius:6px; border:1px solid var(--line);
      background:#fff; font-size:14px; color:var(--ink); transition:background .2s}
    .mono-toc button:hover{background:var(--accent); color:#fff}
    @media(max-width:900px){ .mono-toc-side{display:none} .mono-article{margin-left:0 !important; max-width:100% !important} }
    .api-links{border:1px dashed #10B981;background:#F0FFF7;padding:14px;border-radius:10px;margin:12px 0}
    .api-links .title{font-weight:700;color:#065F46;margin-bottom:8px}
    .api-links .btns{display:flex;flex-wrap:wrap;gap:10px}
    .api-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;background:#10B981;color:#fff !important;text-decoration:none;font-weight:700}
    .api-btn:hover{filter:brightness(1.05)}
  </style>`;
}
function wrapWithSkinMono(title, html, topic, keywords) {
    // 1) 본문 h2/h3에 id 부여 (스크롤 앵커)
    const h2Ids = [];
    let sec = 0;
    let body = html.replace(/<h(2|3)>(.*?)<\/h\1>/gi, (_m, lvl, text) => {
        if (lvl === '2') {
            const id = `s-${++sec}`;
            h2Ids.push(id);
            return `<h2 id="${id}">${text}</h2>`;
        }
        return `<h3>${text}</h3>`;
    });
    // 2) 키워드 기반 목차 버튼(부족하면 실제 h2 제목으로 보완)
    //    버튼 클릭 시 해당 섹션으로 스무스 스크롤
    const tocButtons = (() => {
        // h2 제목들도 추출해서, 키워드 부족분을 보완용으로 사용
        const h2Texts = [];
        html.replace(/<h2>(.*?)<\/h2>/gi, (_mm, text) => {
            h2Texts.push(String(text).trim());
            return '';
        });
        const maxItems = Math.max(h2Ids.length, keywords.length);
        const labels = [];
        for (let i = 0; i < maxItems; i++) {
            const label = (keywords[i] && keywords[i].trim()) || h2Texts[i] || `섹션 ${i + 1}`;
            labels.push(label);
        }
        return labels.slice(0, h2Ids.length).map((label, i) => {
            const id = h2Ids[i];
            return `<button class="toc-btn" onclick="document.getElementById('${id}').scrollIntoView({behavior:'smooth', block:'start'});">${label}</button>`;
        }).join('');
    })();
    // 3) 본문 첫 문단 드롭캡 유지
    body = body.replace('<article', '<article class="mono-dropcap"');
    // 4) 콘텐츠 스킨/CSS
    const css = getSkinCssMono();
    // 5) 날짜/CTA
    const date = new Date().toLocaleDateString();
    const ctaUrl = buildCtaUrl(topic, keywords);
    const ctaText = buildCtaText(topic);
    const ctaBlock = `
  <div>
    <style>
      .myBigButton{background:linear-gradient(to bottom,#FF3B2F,#E62A1E);border-radius:50px;border:none;display:inline-flex;cursor:pointer;color:#fff!important;font-family:Arial,sans-serif;font-size:24px;font-weight:bold;padding:25px 51px;text-decoration:none;text-shadow:1px 1px 2px rgba(0,0,0,.3);box-shadow:0 6px 10px rgba(0,0,0,.2);transition:all .3s;align-items:center;justify-content:center;gap:12px}
      .myBigButton:hover{background:linear-gradient(to bottom,#FF5C4D,#E62A1E);box-shadow:0 8px 14px rgba(0,0,0,.3);transform:scale(1.05)}
      .myBigButton:active{transform:scale(.98)}
      .eeat-hidden{display:none!important}
    </style>
  </div>
  <div style="text-align:center;margin:30px 0;">
    <a class="myBigButton" href="${ctaUrl}" target="_blank" rel="noopener"><b>${ctaText}</b> 👆</a>
  </div>`;
    // 6) E-E-A-T 숨김 메모(meta 성격)
    const eeatHidden = `
  <div class="eeat-hidden" aria-hidden="true">
    <p>E-E-A-T 체크: 경험/전문성/권위성/신뢰성 준수(허위 출처 금지, 추정은 추정으로 명시).</p>
  </div>`;
    // 7) 완성된 HTML 반환 — ★ API 발급 박스는 UI에서만 보이고, 본문에서는 제외됨
    return `
  ${css}
  <div class="mono-wrap">
    <aside class="mono-toc-side">
      <div class="mono-toc-head">연관 키워드</div>
      <div class="mono-toc">${tocButtons}</div>
    </aside>

    <article class="mono-article" style="margin-left:220px;max-width:calc(100% - 240px);">
      <header class="mono-head">
        <div class="mono-kicker">REPORT</div>
        <h1 class="mono-title">${title}</h1>
        <div class="mono-sub">${SITE_NAME ? `${SITE_NAME} 전문 리포트` : '전문 리포트'}</div>
        <div class="mono-meta"><span>${date}</span> · <span>친절 안내</span></div>

        <div class="mono-author">
          <div class="name">${AUTHOR_NAME}</div>
          <div class="role">${AUTHOR_ROLE}</div>
          <div class="creds">${AUTHOR_CREDENTIALS}</div>
        </div>
      </header>

      <section class="mono-body">
        ${body}
        ${ctaBlock}
        ${eeatHidden}

        <div style="margin:18px 0;display:flex;gap:12px;">
          <a href="${CONTACT_URL}" target="_blank" rel="noopener">문의하기</a>
          <a href="${PRIVACY_URL}" target="_blank" rel="noopener">개인정보 처리방침</a>
        </div>

        <blockquote class="mono-quote"><strong>면책 고지.</strong> 본 글은 일반 정보 제공 목적이에요. 개인 상황에 따라 다를 수 있으니, 중요한 결정 전에는 꼭 관련 전문가와 상담해 주세요.</blockquote>
      </section>

      <footer class="mono-footer">© ${new Date().getFullYear()} ${SITE_NAME || 'This site'} — Mono Edition</footer>
    </article>
  </div>`;
}
/* =========================
 * 4) LLM: OpenAI/Gemini
 * ========================= */
async function generatePost(topic, minWords = 1000, lang = 'ko', style = '친절하고 친구에게 설명하듯 ~요체', keywords = []) {
    const sys = `너는 ${SITE_NAME || '사이트'}의 전문 칼럼니스트예요.
- 말투는 "~요"체, 친구에게 알려주듯 자연스럽게.
- 1인칭 경험 느낌(제가 해보니…).
- E-E-A-T 준수(본문 노출X, 숨김 메타).
- YMYL 주제는 조심스럽게(추정은 추정으로).
- 임의 수치/기관/URL 생성 금지, 중복 문장 금지.`;
    const user = `주제: ${topic}
키워드: ${keywords.join(', ')}

요구사항:
- 최소 ${minWords}자 이상(실제는 MIN_CHARS=${MIN_CHARS}로 확장 루프)
- 정확히 7섹션(<h2>): 
  1) 시작해요
  2) 준비물과 자격요건
  3) 단계별 절차
  4) 제가 써보니 좋았던 팁
  5) 비용·시간·주의할 점
  6) 체크리스트(✓ 목록)
  7) F&Q(3문항+) → 면책사항 → 해시태그(5개 이상 #형식)
- 반드시 포함: 체크리스트
- 절대 금지: "용어사전", "리스크관리", "관련데이터", "사례연구"
- HTML 태그: <h2>,<h3>,<p>,<ul>,<li>,<strong>,<em>,<table>
- '참고자료'는 1회 이하(자료 유형만; URL 미포함)

출력: JSON {"title": string, "html": string}`;
    const chat = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
        ],
        temperature: 0.65,
    });
    const content = chat.choices[0].message?.content || '{}';
    try {
        const parsed = JSON.parse(content);
        const cleanHtml = String(parsed.html || '').replace(/\\n/g, ' ').replace(/\n/g, ' ');
        return { title: parsed.title || topic, html: cleanHtml };
    }
    catch {
        const cleanFallback = content.replace(/\\n/g, ' ').replace(/\n/g, ' ');
        return { title: `임시 제목: ${topic}`, html: `<article><h2>${topic}</h2><p>${cleanFallback}</p></article>` };
    }
}
let _gemini = null;
function gemini() {
    if (!_gemini) {
        if (!GEMINI_API_KEY)
            throw new Error('GEMINI_API_KEY 누락');
        _gemini = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    }
    return _gemini;
}
async function generatePostGemini(topic, minWords = 1000, lang = 'ko', style = '친절하고 친구에게 설명하듯 ~요체', keywords = []) {
    const sys = `너는 전문 칼럼니스트예요. ~요체, 중복 금지, E-E-A-T 준수(숨김 메타).`;
    const user = `주제: ${topic}
키워드: ${keywords.join(', ')}
요구: 최소 ${minWords}자, 7섹션(체크리스트 포함, 금지: 용어사전/리스크관리/관련데이터/사례연구)
출력: JSON {"title": string, "html": string}`;
    const model = gemini().getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp' });
    const resp = await model.generateContent([{ text: sys }, { text: user }]);
    const txt = resp.response.text();
    let parsed;
    try {
        parsed = JSON.parse(txt);
    }
    catch {
        parsed = { title: `임시 제목: ${topic}`, html: `<article><h2>${topic}</h2><p>${txt}</p></article>` };
    }
    const cleanHtml = String(parsed.html || '').replace(/\\n/g, ' ').replace(/\n/g, ' ');
    return { title: parsed.title || topic, html: cleanHtml };
}
async function expandArticleHtml(topic, previousHtml, targetChars) {
    const sys = '너는 친절한 에디터예요. "~요"체 유지, 중복 없이 자연스럽게 품질을 높여 확장.';
    const user = `주제: ${topic}
다음 HTML을 ${targetChars}자 이상이 되게 보강(체크리스트/팁 위주, 금지: 용어사전/리스크관리/관련데이터/사례연구).
출력: 수정된 전체 HTML만(<article> 포함)
원문:
${previousHtml}`;
    const chat = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
            { role: 'system', content: sys },
            { role: 'user', content: user },
        ],
        temperature: 0.5,
    });
    const out = (chat.choices[0].message?.content || '').trim();
    return out.startsWith('<article') ? out : `<article>${out}</article>`;
}
async function expandArticleHtmlGemini(topic, previousHtml, targetChars) {
    const sys = `너는 친절한 에디터예요. ~요체 유지, 중복 최소화, 자연스럽게 확장.`;
    const user = `주제: ${topic}
다음 HTML을 ${targetChars}자 이상이 되게 보강(체크리스트/팁 위주, 금지: 용어사전/리스크관리/관련데이터/사례연구).
출력: 수정된 전체 HTML만(<article> 포함)
원문:
${previousHtml}`;
    const model = gemini().getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp' });
    const resp = await model.generateContent([{ text: sys }, { text: user }]);
    const out = resp.response.text().trim();
    return out.startsWith('<article') ? out : `<article>${out}</article>`;
}
async function generatePostByProvider(topic, minWords = 1000, lang = 'ko', style = '친절요체', keywords = []) {
    return (process.env.PROVIDER || 'openai') === 'gemini'
        ? await generatePostGemini(topic, minWords, lang, style, keywords)
        : await generatePost(topic, minWords, lang, style, keywords);
}
async function expandArticleHtmlByProvider(topic, prev, targetChars) {
    return (process.env.PROVIDER || 'openai') === 'gemini'
        ? await expandArticleHtmlGemini(topic, prev, targetChars)
        : await expandArticleHtml(topic, prev, targetChars);
}
/* =========================
 * 6) Blogger API: 게시
 * ========================= */
async function postToBlogger(data, publishedIso, labels = [], allowComments = true, isDraft = true) {
    try {
        console.log('[postToBlogger] 시작');
        console.log('[postToBlogger] BLOG_ID:', BLOG_ID);
        console.log('[postToBlogger] 제목:', data.title);
        console.log('[postToBlogger] 콘텐츠 길이:', data.html.length);
        console.log('[postToBlogger] isDraft:', isDraft);
        // 메모리 정리
        if (global.gc) {
            global.gc();
            console.log('[postToBlogger] 시작 전 가비지 컬렉션 실행');
        }
        // OAuth 클라이언트 생성 및 인증 (타임아웃 추가)
        const oauthClient = oauth2Client();
        console.log('[postToBlogger] OAuth 클라이언트 생성 완료');
        // 인증 타임아웃 설정 (30초)
        const authPromise = ensureAuth(oauthClient);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('OAuth 인증 시간 초과: 30초를 초과했습니다.'));
            }, 30000);
        });
        const auth = await Promise.race([authPromise, timeoutPromise]);
        console.log('[postToBlogger] 인증 완료');
        const blogger = googleapis_1.google.blogger({ version: 'v3', auth });
        console.log('[postToBlogger] Blogger API 클라이언트 생성 완료');
        const body = {
            kind: 'blogger#post',
            blog: { id: BLOG_ID },
            title: data.title,
            content: data.html,
            labels
            // replies 필드 제거: Blogger API v3에서 invalid argument 오류 발생
        };
        if (publishedIso)
            body.published = publishedIso;
        console.log('[postToBlogger] 요청 본문 준비 완료');
        console.log('[postToBlogger] 요청 본문 크기:', JSON.stringify(body).length);
        // API 호출 타임아웃 설정 (60초)
        const apiPromise = blogger.posts.insert({
            blogId: BLOG_ID,
            isDraft,
            requestBody: body,
        });
        const apiTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Blogger API 호출 시간 초과: 60초를 초과했습니다.'));
            }, 60000);
        });
        const res = await Promise.race([apiPromise, apiTimeoutPromise]);
        console.log('[postToBlogger] API 호출 완료');
        console.log('[postToBlogger] 응답:', res.data);
        // 성공 후 메모리 정리
        if (global.gc) {
            global.gc();
            console.log('[postToBlogger] 성공 후 가비지 컬렉션 실행');
        }
        return res.data;
    }
    catch (error) {
        console.error('[postToBlogger] 오류 발생:', error);
        console.error('[postToBlogger] 오류 상세:', {
            message: error.message,
            code: error.code,
            status: error.status,
            response: error.response?.data
        });
        // 에러 발생 시 메모리 정리
        if (global.gc) {
            global.gc();
            console.log('[postToBlogger] 에러 발생 후 가비지 컬렉션 실행');
        }
        throw error;
    }
}
function readExcelRows(filePath, sheetName) {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[sheetName];
    if (!ws)
        throw new Error(`엑셀 시트 없음: ${sheetName}`);
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    return rows
        .map(r => ({
        topic: String(r.Topic || r.topic || '').trim(),
        keywords: String(r.Keywords || r.keywords || '')
            .split(',').map((s) => s.trim()).filter(Boolean),
        type: String(r.Type || r.type || 'draft').trim().toLowerCase() || 'draft',
        scheduleISO: String(r.ScheduleISO || r.scheduleISO || '').trim(),
        labels: String(r.Labels || r.labels || '')
            .split(',').map((s) => s.trim()).filter(Boolean),
    }))
        .filter(r => !!r.topic);
}
/* =========================
 * 8) 비대화식 플래그 파서
 * ========================= */
function parseFlags(argv) {
    const out = {};
    for (const a of argv) {
        if (a.startsWith('--')) {
            const [k, ...rest] = a.replace(/^--/, '').split('=');
            const v = rest.join('=');
            out[k] = v === '' ? true : v;
        }
    }
    return out;
}
/* =========================
 * 9) 메인
 * ========================= */
async function main() {
    // Electron 환경에서는 readline을 사용하지 않음
    const isElectron = process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true';
    let rl = null;
    if (!isElectron) {
        rl = promises_1.default.createInterface({ input: process.stdin, output: process.stdout });
    }
    // 비대화식 처리
    const flags = parseFlags(process.argv.slice(2));
    const nonInteractive = !!flags['nonInteractive'];
    // 라이선스 스킵 가능
    if (flags['skipLicense'])
        process.env.SKIP_LICENSE = '1';
    if (process.env.SKIP_LICENSE !== '1') {
        const ok = await (async () => {
            const deviceId = getDeviceId();
            const p = licensePath();
            // 개발 환경에서는 라이선스 검증을 우회
            if (process.env.NODE_ENV === 'development' || process.env.DEV_MODE === 'true') {
                console.log('🔧 개발 모드: 라이선스 검증을 우회합니다.');
                return true;
            }
            if (!node_fs_1.default.existsSync(p)) {
                console.log('\n=== 라이선스가 필요해요 ===');
                console.log(`디바이스 ID: ${deviceId}`);
                console.log(`아래 경로에 license.lic 파일을 넣어주세요:\n${p}\n`);
                if (rl) {
                    await rl.question('파일을 넣은 뒤 Enter를 누르면 확인하겠습니다...');
                }
                else {
                    console.log('Electron 환경에서는 자동으로 라이선스를 확인합니다.');
                }
            }
            if (!node_fs_1.default.existsSync(p)) {
                console.error('license.lic 파일이 아직 없어요. 종료합니다.');
                return false;
            }
            let lic;
            try {
                lic = JSON.parse(node_fs_1.default.readFileSync(p, 'utf-8'));
            }
            catch {
                console.error('license.lic 형식 오류');
                return false;
            }
            const check = verifyLicense(lic, deviceId);
            if (!check.ok) {
                console.error('라이선스 검증 실패:', check.reason);
                return false;
            }
            console.log('✅ 라이선스 확인 완료(영구) -', lic.subject);
            return true;
        })();
        if (!ok) {
            if (rl)
                rl.close();
            process.exit(1);
        }
    }
    // 플래그 기반 실행(UI가 호출)
    if (nonInteractive) {
        const setIf = (key, val) => { if (val !== undefined && val !== '')
            process.env[key] = String(val); };
        setIf('PROVIDER', flags['provider']);
        setIf('OPENAI_API_KEY', flags['openaiKey']);
        setIf('GEMINI_API_KEY', flags['geminiKey']);
        setIf('BLOG_ID', flags['blogId']);
        setIf('GOOGLE_CLIENT_ID', flags['clientId']);
        setIf('GOOGLE_CLIENT_SECRET', flags['clientSecret']);
        setIf('GOOGLE_REDIRECT_URI', flags['redirectUri'] || 'http://localhost:8080');
        setIf('DEFAULT_LABELS', flags['labels']);
        setIf('ALLOW_COMMENTS', flags['allowComments']);
        setIf('CTA_MODE', flags['ctaMode']);
        setIf('CTA_BASE_URL', flags['ctaBaseUrl']);
        setIf('CTA_SEARCH_SITE', flags['ctaSearchSite']);
        setIf('MIN_CHARS', flags['minChars']);
        const topic = String(flags['topic'] || '');
        const keywordsStr = String(flags['keywords'] || '');
        const publishType = String(flags['publishType'] || 'draft');
        const scheduleISO = String(flags['schedule'] || '');
        if (!topic) {
            console.error('topic은 필수입니다.');
            process.exit(1);
        }
        const keywords = keywordsStr ? keywordsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        console.log('\n[1/3] 콘텐츠 생성 중...');
        let gen = await generatePostByProvider(topic, 1000, 'ko', '친절하고 친구에게 설명하듯 ~요체', keywords);
        let current = charCountFromHtml(gen.html);
        let tries = 0;
        const MIN_CHARS_FLAG = parseInt(String(flags['minChars'] || process.env.MIN_CHARS || '3000'), 10);
        while (current < MIN_CHARS_FLAG && tries < 5) {
            console.log(`[확장] 현재 ${current}자 < 목표 ${MIN_CHARS_FLAG}자 → 확장 시도 ${tries + 1}/5`);
            gen = { ...gen, html: await expandArticleHtmlByProvider(topic, gen.html, MIN_CHARS_FLAG) };
            current = charCountFromHtml(gen.html);
            tries++;
        }
        const finalHtml = wrapWithSkinMono(gen.title, gen.html, topic, keywords);
        let publishedIso = undefined;
        let isDraft = true;
        if (publishType === 'now') {
            isDraft = false;
            publishedIso = (0, dayjs_1.default)().toISOString();
        }
        else if (publishType === 'schedule') {
            isDraft = false;
            publishedIso = scheduleISO || undefined;
        }
        console.log('[2/3] 게시 준비...');
        const labels = (process.env.DEFAULT_LABELS || '').split(',').map(s => s.trim()).filter(Boolean);
        const allow = (process.env.ALLOW_COMMENTS || 'true') === 'true';
        const result = await postToBlogger({ title: gen.title, html: finalHtml }, publishedIso, labels, allow, isDraft);
        console.log('[3/3] 완료! 포스트 ID:', result.id, 'URL:', result.url);
        if (rl)
            rl.close();
        return;
    }
    // ── 기존 대화식 모드 ──
    if (EXCEL_PATH && node_fs_1.default.existsSync(EXCEL_PATH)) {
        if (rl) {
            const ans = (await rl.question(`엑셀(${EXCEL_PATH})로 일괄 포스팅할까요? [y/N]: `)).trim().toLowerCase();
            if (ans === 'y') {
                rl.close();
                const items = readExcelRows(EXCEL_PATH, EXCEL_SHEET);
                console.log(`엑셀 ${items.length}건 로드 완료.`);
                for (let i = 0; i < items.length; i++) {
                    const it = items[i];
                    try {
                        console.log(`\n[엑셀 ${i + 1}/${items.length}] 주제: ${it.topic}`);
                        const kw = it.keywords;
                        let gen = await generatePostByProvider(it.topic, 1000, 'ko', '친절하고 친구에게 설명하듯 ~요체', kw);
                        let current = charCountFromHtml(gen.html);
                        let tries = 0;
                        while (current < MIN_CHARS && tries < 5) {
                            console.log(`[확장] 현재 ${current}자 < 목표 ${MIN_CHARS}자 → 확장 시도 ${tries + 1}/5`);
                            gen = { ...gen, html: await expandArticleHtmlByProvider(it.topic, gen.html, MIN_CHARS) };
                            current = charCountFromHtml(gen.html);
                            tries++;
                        }
                        const finalHtml = wrapWithSkinMono(gen.title, gen.html, it.topic, kw);
                        let isDraft = true;
                        let publishedIso = undefined;
                        const t = (it.type || 'draft').toLowerCase();
                        if (t === 'now') {
                            isDraft = false;
                            publishedIso = (0, dayjs_1.default)().toISOString();
                        }
                        else if (t === 'schedule') {
                            isDraft = false;
                            publishedIso = it.scheduleISO || undefined;
                        }
                        const labels = (it.labels && it.labels.length) ? it.labels : DEFAULT_LABELS;
                        console.log(`[대기] ${EXCEL_RATE_DELAY}s…`);
                        await (0, promises_2.setTimeout)(EXCEL_RATE_DELAY * 1000);
                        const result = await postToBlogger({ title: gen.title, html: finalHtml }, publishedIso, labels, ALLOW_COMMENTS, isDraft);
                        console.log(`완료: ${result.id} ${result.url}`);
                    }
                    catch (e) {
                        console.error(`[실패] ${it.topic}:`, e.message || e);
                    }
                }
                console.log('\n엑셀 처리 종료.');
                return;
            }
        }
        // Electron 환경에서는 대화식 모드를 사용하지 않음
        if (isElectron) {
            console.log('Electron 환경에서는 대화식 모드를 사용할 수 없습니다.');
            if (rl)
                rl.close();
            return;
        }
        const topic = await rl.question('주제: ');
        const kw = await rl.question('키워드(콤마 구분, 생략 가능): ');
        await rl.question('최소 글자수(표시용, 실제는 MIN_CHARS로 강제) [엔터로 계속]: ');
        const publishType = (await rl.question('발행 타입 [draft|now|schedule]: ')).trim().toLowerCase() || 'draft';
        let publishedIso = undefined;
        let isDraft = true;
        if (publishType === 'now') {
            isDraft = false;
            publishedIso = (0, dayjs_1.default)().toISOString();
        }
        else if (publishType === 'schedule') {
            const when = await rl.question('예약 시각 ISO(예: 2025-09-12T10:00:00+09:00): ');
            isDraft = false;
            publishedIso = when;
        }
        rl.close();
        console.log('\n[1/3] 콘텐츠 생성 중...');
        const keywords = kw ? kw.split(',').map(s => s.trim()).filter(Boolean) : [];
        let gen = await generatePostByProvider(topic, 1000, 'ko', '친절하고 친구에게 설명하듯 ~요체', keywords);
        let current = charCountFromHtml(gen.html);
        let tries = 0;
        while (current < MIN_CHARS && tries < 5) {
            console.log(`[확장] 현재 ${current}자 < 목표 ${MIN_CHARS}자 → 확장 시도 ${tries + 1}/5`);
            gen = { ...gen, html: await expandArticleHtmlByProvider(topic, gen.html, MIN_CHARS) };
            current = charCountFromHtml(gen.html);
            tries++;
        }
        const finalHtml = wrapWithSkinMono(gen.title, gen.html, topic, keywords);
        console.log(`[2/3] ${RATE_LIMIT_SECONDS}s 대기(안전 제한)…`);
        await (0, promises_2.setTimeout)(RATE_LIMIT_SECONDS * 1000);
        console.log('[3/3] Blogger 게시 중...');
        const result = await postToBlogger({ title: gen.title, html: finalHtml }, publishedIso, DEFAULT_LABELS, ALLOW_COMMENTS, isDraft);
        console.log('\n완료! 포스트 ID:', result.id, 'URL:', result.url);
    }
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
