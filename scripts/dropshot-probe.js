// scripts/dropshot-probe.js
// Dropshot 사이트의 이미지 생성 endpoint/payload/응답 패턴을 자동 캡처.
//
// 사용:
//   node scripts/dropshot-probe.js
//
// 흐름:
//   1. Patchright(또는 playwright)로 visible Chrome 띄움
//   2. ~/.blogger-gpt/dropshot-profile/ 영구 프로필
//   3. https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro 이동
//   4. 모든 Network 요청/응답 캡처 (fetch/XHR, body 포함)
//   5. 사용자가 로그인 + 이미지 1장 생성하는 동안 stdout으로 상황 출력
//   6. 9분 후 자동 종료 + dropshot-probe-result.json 작성
//   7. 사용자가 그 전에 콘솔에 q+Enter 입력하면 즉시 종료

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const readline = require('node:readline');

const TARGET_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const HOME_URL = 'https://aistudio.dropshot.io';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const OUTPUT_FILE = path.resolve(__dirname, '..', 'dropshot-probe-result.json');
const MAX_DURATION_MS = 9 * 60 * 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function loadChromium() {
  try {
    const { chromium } = await import('patchright');
    console.log('[probe] ✅ patchright loaded');
    return chromium;
  } catch (e) {
    const { chromium } = await import('playwright');
    console.log('[probe] ⚠️ patchright not available → playwright fallback');
    return chromium;
  }
}

(async () => {
  ensureDir(PROFILE_DIR);
  const chromium = await loadChromium();

  const launchOpts = {
    headless: false,
    args: [
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-sandbox',
      '--lang=ko-KR,ko',
      '--window-size=1280,900',
    ],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch { return 'Asia/Seoul'; } })(),
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
  };

  let context;
  let lastErr;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const opts = channel ? { ...launchOpts, channel } : launchOpts;
      context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
      console.log(`[probe] ✅ browser launched (channel=${channel || 'bundled-chromium'})`);
      break;
    } catch (e) { lastErr = e; }
  }
  if (!context) {
    console.error('[probe] ❌ 브라우저 실행 실패:', lastErr?.message);
    process.exit(1);
  }

  // stealth init
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const page = context.pages()[0] || await context.newPage();

  // ── 네트워크 캡처 ──
  const captures = [];
  const seenUrls = new Set();

  page.on('request', (req) => {
    try {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (url.includes('analytics') || url.includes('googletag') || url.includes('intercom') || url.includes('sentry')) return;
      const method = req.method();
      const rt = req.resourceType();
      // 우리가 관심있는 건 XHR/fetch만
      if (rt !== 'xhr' && rt !== 'fetch') return;
      const body = (() => { try { return req.postData(); } catch { return null; } })();
      const idx = captures.length;
      captures.push({
        idx,
        ts: new Date().toISOString(),
        method,
        url,
        resourceType: rt,
        headers: req.headers(),
        body: body ? (body.length > 5000 ? body.slice(0, 5000) + '...[TRUNC]' : body) : null,
        response: null, // 채워질 예정
      });
      if (method === 'POST') {
        console.log(`[probe] 📤 POST ${url.replace(/^https?:\/\/[^/]+/, '')} ${body ? `(body ${body.length}B)` : ''}`);
      } else if (!seenUrls.has(url)) {
        seenUrls.add(url);
        console.log(`[probe] 📥 ${method} ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 100)}`);
      }
    } catch (e) { /* ignore */ }
  });

  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      const rt = req.resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      const target = captures.find(c => c.url === url && c.method === req.method() && !c.response);
      if (!target) return;
      const status = res.status();
      const headers = res.headers();
      const ct = (headers['content-type'] || '').toLowerCase();
      let bodyText = null;
      try {
        if (ct.includes('json') || ct.includes('text') || ct.includes('javascript')) {
          const t = await res.text();
          bodyText = t.length > 8000 ? t.slice(0, 8000) + '...[TRUNC]' : t;
        } else if (ct.includes('image')) {
          bodyText = `[IMAGE ${ct} ${headers['content-length'] || '?'}B]`;
        } else {
          bodyText = `[BINARY ${ct} ${headers['content-length'] || '?'}B]`;
        }
      } catch (e) { bodyText = `[READ_ERR: ${e.message}]`; }
      target.response = { status, headers, body: bodyText };

      if (status >= 400) {
        console.log(`[probe] ⚠️ ${status} ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 100)}`);
      } else if (req.method() === 'POST' && status === 200) {
        console.log(`[probe] ✅ 200 POST ← ${url.replace(/^https?:\/\/[^/]+/, '').slice(0, 80)}`);
      }
    } catch (e) { /* ignore */ }
  });

  // ── 페이지 이동 ──
  console.log('[probe] 🌐 navigating to', TARGET_URL);
  try {
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  } catch (e) {
    console.warn('[probe] ⚠️ goto warn:', e.message);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📋 사용자 작업 안내');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  1) 브라우저에서 Dropshot 로그인 (Google/이메일/디스코드 등)');
  console.log('  2) "google/nano-banana-pro" 모델이 선택돼 있는지 확인');
  console.log('  3) 임의의 프롬프트로 이미지 1장 생성');
  console.log('  4) 이미지가 나타날 때까지 기다림');
  console.log('  5) 완료되면 이 콘솔에서 q + Enter (또는 자동 9분 대기)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const startTs = Date.now();
  const stopFlag = { stop: false };
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (input) => {
    if (input.trim().toLowerCase() === 'q') {
      console.log('[probe] 🛑 사용자 종료 요청');
      stopFlag.stop = true;
    }
  });

  // 폴링 — 1분마다 상황 보고
  while (!stopFlag.stop && (Date.now() - startTs) < MAX_DURATION_MS) {
    await new Promise(r => setTimeout(r, 60_000));
    const postCount = captures.filter(c => c.method === 'POST').length;
    const minutesElapsed = Math.round((Date.now() - startTs) / 60_000);
    console.log(`[probe] ⏳ ${minutesElapsed}분 경과 — 총 ${captures.length}개 XHR/fetch 캡처 (POST ${postCount}개)`);
  }

  rl.close();

  // ── localStorage / 쿠키 snapshot ──
  let storage = null;
  try {
    storage = await page.evaluate(() => {
      const out = { localStorage: {}, sessionStorage: {}, cookies: document.cookie };
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) out.localStorage[k] = localStorage.getItem(k); } } catch {}
      try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k) out.sessionStorage[k] = sessionStorage.getItem(k); } } catch {}
      return out;
    });
  } catch (e) { storage = { err: e.message }; }

  let cookies = null;
  try { cookies = await context.cookies(); } catch (e) { cookies = [{ err: e.message }]; }

  // ── 저장 ──
  const result = {
    capturedAt: new Date().toISOString(),
    targetUrl: TARGET_URL,
    durationMs: Date.now() - startTs,
    captureCount: captures.length,
    captures,
    storage,
    cookies: cookies?.map(c => ({ name: c.name, domain: c.domain, path: c.path, httpOnly: c.httpOnly, secure: c.secure, sameSite: c.sameSite, expires: c.expires, valueLen: (c.value || '').length })),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
  console.log('');
  console.log(`[probe] 💾 saved → ${OUTPUT_FILE}`);
  console.log(`[probe]   총 ${captures.length}개 캡처, POST ${captures.filter(c => c.method === 'POST').length}개`);
  console.log('');

  await context.close();
  process.exit(0);
})().catch(e => {
  console.error('[probe] FATAL:', e);
  process.exit(1);
});
