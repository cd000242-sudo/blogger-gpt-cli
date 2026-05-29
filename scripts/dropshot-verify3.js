// scripts/dropshot-verify3.js
// 네트워크 레벨 캡처 + SIGTERM 핸들러 (즉시 종료 시 dump 보장).
//   - request body + response body + ALL headers
//   - redirect chain 추적 (request.redirectedFrom() / response.url())
//   - 'q'+Enter로 즉시 종료 가능
//   - 5분 자동 timeout

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const readline = require('node:readline');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const OUTPUT = path.resolve(__dirname, '..', 'dropshot-final-trace.json');
const MAX_MS = 5 * 60 * 1000;

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

(async () => {
  const chromium = await loadChromium();
  const opts = {
    headless: false,
    args: ['--no-first-run', '--disable-blink-features=AutomationControlled', '--no-sandbox', '--lang=ko-KR,ko', '--window-size=1280,900'],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'; } catch { return 'Asia/Seoul'; } })(),
    ignoreDefaultArgs: ['--enable-automation'],
  };

  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const o = channel ? { ...opts, channel } : opts;
      context = await chromium.launchPersistentContext(PROFILE_DIR, o);
      console.log(`[v3] ✅ ${channel || 'bundled'}`);
      break;
    } catch {}
  }
  if (!context) { console.error('[v3] ❌'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const captures = []; // { idx, ts, method, url, reqHeaders, body, status, resHeaders, resBody, finalUrl, redirectedFrom }
  const page = context.pages()[0] || await context.newPage();

  page.on('request', (req) => {
    try {
      const url = req.url();
      const rt = req.resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      if (/(analytics|gtag|googletagmanager|googleadservices|facebook|fbevents|hotjar|intercom|sentry|amplitude|mixpanel)/i.test(url)) return;
      const body = (() => { try { return req.postData(); } catch { return null; } })();
      captures.push({
        idx: captures.length,
        ts: new Date().toISOString(),
        method: req.method(),
        url,
        reqHeaders: req.headers(),
        body: body ? (body.length > 6000 ? body.slice(0, 6000) + '...[TRUNC]' : body) : null,
        redirectedFrom: req.redirectedFrom()?.url() || null,
      });
      if (req.method() === 'POST') {
        console.log(`[v3] 📤 POST ${url.replace(/^https?:\/\/[^/]+/, '')} ${body ? `(${body.length}B)` : ''}`);
        if (body) console.log(`     body: ${body.slice(0, 200)}`);
      }
    } catch {}
  });

  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      const rt = req.resourceType();
      if (rt !== 'xhr' && rt !== 'fetch') return;
      if (/(analytics|gtag|googletagmanager|googleadservices|facebook|fbevents|hotjar|intercom|sentry|amplitude|mixpanel)/i.test(url)) return;
      const target = captures.find(c => c.url === url && c.method === req.method() && c.status === undefined);
      if (!target) return;
      target.status = res.status();
      target.resHeaders = res.headers();
      target.finalUrl = res.url();
      try {
        const ct = (target.resHeaders['content-type'] || '').toLowerCase();
        if (ct.includes('json') || ct.includes('text')) {
          const t = await res.text();
          target.resBody = t.length > 8000 ? t.slice(0, 8000) + '...[TRUNC]' : t;
        } else if (ct.includes('image')) {
          target.resBody = `[IMAGE ${ct} ${target.resHeaders['content-length'] || '?'}]`;
        } else {
          target.resBody = `[${ct}]`;
        }
      } catch (e) { target.resBody = `[err: ${e.message}]`; }

      // 핵심 마커
      const isJob = /\/job\/|\/generate/i.test(url);
      if (isJob || (target.resBody && /imageUrl|"image":"|base64.*iVBOR/i.test(target.resBody))) {
        console.log(`[v3] 🎯 ${res.status()} ${req.method()} ${url}`);
        if (target.resHeaders.location) console.log(`     Location: ${target.resHeaders.location}`);
        if (target.resBody) console.log(`     resBody: ${target.resBody.slice(0, 300)}`);
      }
    } catch {}
  });

  console.log('[v3] 🌐 navigating');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));

  // ── dump 함수 (어디서 호출하든 안전) ──
  const dump = (reason) => {
    try {
      fs.writeFileSync(OUTPUT, JSON.stringify({
        capturedAt: new Date().toISOString(),
        reason,
        captureCount: captures.length,
        captures,
      }, null, 2));
      console.log(`[v3] 💾 dumped (${reason}) → ${OUTPUT} (${captures.length} items)`);
    } catch (e) { console.error('[v3] dump err:', e); }
  };

  // SIGTERM / SIGINT 핸들러 — 강제 종료 시에도 dump 보장
  let exiting = false;
  const gracefulExit = async (sig) => {
    if (exiting) return;
    exiting = true;
    console.log(`[v3] ${sig} received — graceful dump`);
    dump(sig);
    try { await context.close(); } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', () => gracefulExit('SIGTERM'));
  process.on('SIGINT', () => gracefulExit('SIGINT'));
  process.on('SIGHUP', () => gracefulExit('SIGHUP'));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📋 마지막 협조 부탁드립니다 (한 번만)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  열린 브라우저에서 임의 프롬프트로 이미지 1장 생성');
  console.log('  이미지가 화면에 나타나면 → 콘솔에 q+Enter (즉시 종료+dump)');
  console.log('  또는 자동 5분 후 종료+dump');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  let qPressed = false;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (l) => { if (l.trim().toLowerCase() === 'q') { qPressed = true; console.log('[v3] q received'); } });

  const start = Date.now();
  while (!qPressed && (Date.now() - start) < MAX_MS) {
    await new Promise(r => setTimeout(r, 30000));
    console.log(`[v3] ⏳ ${Math.round((Date.now()-start)/1000)}s — ${captures.length}개 캡처 (POST ${captures.filter(c=>c.method==='POST').length})`);
  }
  rl.close();

  dump(qPressed ? 'q' : 'timeout');
  await context.close();
  process.exit(0);
})().catch(e => { console.error('[v3] FATAL:', e); process.exit(1); });
