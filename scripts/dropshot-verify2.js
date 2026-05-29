// scripts/dropshot-verify2.js
// 진짜 API endpoint + body 형식 발견을 위한 차세대 verify.
//
// 전략:
//   1. 같은 profile로 board 페이지 진입 (probe와 동일 컨텍스트)
//   2. window.fetch monkey-patch — 모든 fetch 호출 캡처 (URL, method, body, response.url)
//   3. 사용자가 단 한 번만 더 "생성" 버튼 클릭하면 정확한 endpoint + body + 응답 패턴 캡처
//   4. 캡처 후 즉시 자동 분석 + 같은 호출을 우리가 직접 재현 → 검증

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const OUTPUT_LOG = path.resolve(__dirname, '..', 'dropshot-fetch-trace.json');
const OUTPUT_IMG = path.resolve(__dirname, '..', 'dropshot-test-image.png');
const MAX_WAIT_MS = 5 * 60 * 1000;

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

(async () => {
  const chromium = await loadChromium();
  const launchOpts = {
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
      const opts = channel ? { ...launchOpts, channel } : launchOpts;
      context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
      console.log(`[v2] ✅ launched (channel=${channel || 'bundled'})`);
      break;
    } catch {}
  }
  if (!context) { console.error('[v2] ❌ 실행 실패'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  // ── window.fetch monkey-patch — 모든 fetch 호출 캡처 (가장 빠른 navigation 전에 init script로 주입) ──
  await context.addInitScript(() => {
    const origFetch = window.fetch;
    const traces = [];
    window.__fetchTraces = traces;
    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init?.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
      let body = null;
      try {
        if (init?.body) {
          if (typeof init.body === 'string') body = init.body;
          else if (init.body instanceof FormData) body = '[FormData]';
          else if (init.body instanceof Blob) body = '[Blob]';
          else body = JSON.stringify(init.body);
        }
      } catch { body = '[body-err]'; }

      const trace = {
        ts: Date.now(),
        url,
        method,
        reqHeaders: init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {},
        body: body ? (body.length > 5000 ? body.slice(0, 5000) + '...[TRUNC]' : body) : null,
      };

      try {
        const res = await origFetch.call(this, input, init);
        trace.finalUrl = res.url;
        trace.status = res.status;
        trace.resHeaders = Object.fromEntries(res.headers.entries());

        // body 읽기 — clone해서 원본 영향 X
        try {
          const cloned = res.clone();
          const ct = (res.headers.get('content-type') || '').toLowerCase();
          if (ct.includes('json') || ct.includes('text')) {
            const t = await cloned.text();
            trace.resBody = t.length > 6000 ? t.slice(0, 6000) + '...[TRUNC]' : t;
          } else { trace.resBody = `[${ct}]`; }
        } catch (e) { trace.resBody = `[read-err: ${e.message}]`; }

        traces.push(trace);
        return res;
      } catch (e) {
        trace.error = e.message;
        traces.push(trace);
        throw e;
      }
    };
    console.log('[FETCH-PATCH] 활성화됨');
  });

  const page = context.pages()[0] || await context.newPage();
  console.log('[v2] 🌐 navigating to board page');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📋 작업 안내 (한 번만 더!)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  1) 열린 브라우저(board 페이지)에서 임의 프롬프트로');
  console.log('     이미지 1장만 생성 — 이미지가 화면에 나타날 때까지 대기');
  console.log('  2) 자동으로 5분 후 또는 첫 이미지 응답 수신 시 자동 종료');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // 이미지 응답이 들어오면 자동 종료
  let done = false;
  const startTs = Date.now();

  while (!done && (Date.now() - startTs) < MAX_WAIT_MS) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const traces = await page.evaluate(() => window.__fetchTraces || []);
      const elapsed = Math.round((Date.now() - startTs) / 1000);

      // 이미지 응답 시그니처 찾기
      for (const t of traces) {
        if (!t.url) continue;
        const isJob = t.url.includes('/v1/job/') || t.url.includes('/job/google');
        const hasImg = (t.resBody && (t.resBody.includes('"imageUrl"') || t.resBody.includes('"image"') || t.resBody.includes('base64,')));
        if (isJob || hasImg) {
          // 한번 보고 종료 시그널
          if (t.method === 'POST' && t.url.includes('/job/')) {
            console.log(`[v2] 🎯 POST job 응답 캡처 (status ${t.status})`);
            if (t.resBody && t.resBody.length > 30) {
              console.log(`    body 일부: ${t.resBody.slice(0, 300)}`);
            }
          }
        }
      }
      // 응답에 imageUrl 또는 base64가 있으면 done
      const hasImageResponse = traces.some(t => t.resBody && (t.resBody.includes('"imageUrl"') || t.resBody.includes(',"image":"') || t.resBody.match(/base64.+iVBOR/i)));
      if (hasImageResponse) {
        console.log('[v2] ✅ 이미지 응답 감지 — 종료 진행');
        done = true;
        break;
      }
      console.log(`[v2] ⏳ ${elapsed}s — 총 ${traces.length}개 fetch 캡처 (이미지 응답 대기)`);
    } catch (e) {
      console.log('[v2] ⚠️ poll err:', e.message);
    }
  }

  // 최종 traces dump
  const finalTraces = await page.evaluate(() => window.__fetchTraces || []);
  fs.writeFileSync(OUTPUT_LOG, JSON.stringify({
    capturedAt: new Date().toISOString(),
    count: finalTraces.length,
    traces: finalTraces,
  }, null, 2));
  console.log(`[v2] 💾 trace → ${OUTPUT_LOG} (${finalTraces.length}개)`);

  // 핵심 호출 추출
  const jobCalls = finalTraces.filter(t => t.url && (t.url.includes('/job/') || t.url.includes('generate')));
  console.log('');
  console.log(`[v2] 🔍 job 관련 호출 ${jobCalls.length}개:`);
  for (const c of jobCalls) {
    console.log(`  ${c.method} ${c.url}`);
    console.log(`    finalUrl=${c.finalUrl || '?'}  status=${c.status || '?'}`);
    if (c.body) console.log(`    body: ${c.body.slice(0, 300)}`);
    if (c.resBody) console.log(`    res:  ${c.resBody.slice(0, 300)}`);
  }

  await new Promise(r => setTimeout(r, 1500));
  await context.close();
  process.exit(0);
})().catch(e => { console.error('[v2] FATAL:', e); process.exit(1); });
