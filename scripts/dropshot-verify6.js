// scripts/dropshot-verify6.js — cross-origin POST 정확한 재현

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const API_HOST = 'https://api.aistudio.dropshot.io';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');

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
    timezoneId: 'Asia/Seoul',
    ignoreDefaultArgs: ['--enable-automation'],
  };

  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      const o = channel ? { ...opts, channel } : opts;
      context = await chromium.launchPersistentContext(PROFILE_DIR, o);
      break;
    } catch {}
  }
  if (!context) { console.error('[v6] ❌'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const captures = [];
  const page = context.pages()[0] || await context.newPage();
  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') return;
      if (!url.includes('dropshot.io')) return;
      let body = null;
      try {
        const ct = (res.headers()['content-type'] || '').toLowerCase();
        if (ct.includes('json') || ct.includes('text')) {
          const t = await res.text(); body = t.slice(0, 4000);
        } else body = `[${ct}]`;
      } catch { body = '[err]'; }
      captures.push({ method: req.method(), url, status: res.status(), headers: res.headers(), body });
    } catch {}
  });

  console.log('[v6] 🌐 navigate + wait 10s for board init');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 10000));

  // ───────────────────────────────────────────────────
  // cross-origin POST with detailed error trace
  // ───────────────────────────────────────────────────
  const result = await page.evaluate(async ({ apiHost }) => {
    function pushId() {
      const C = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
      const now = Date.now(); let n = now; const arr = [];
      for (let i = 7; i >= 0; i--) { arr[i] = C.charAt(n % 64); n = Math.floor(n / 64); }
      let id = arr.join('');
      for (let i = 0; i < 12; i++) id += C.charAt(Math.floor(Math.random() * 64));
      return id;
    }

    const boardId = pushId();
    const messageId = pushId();
    const logs = [];
    const body = {
      prompt: '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진, 시네마틱',
      modelName: 'google/nano-banana-pro',
      isUnlimited: true,
      aspect_ratio: '1:1',
      resolution: '2K',
      messageId,
      boardId,
    };
    logs.push(`generated: boardId=${boardId} messageId=${messageId}`);
    logs.push(`window.origin=${window.location.origin}`);

    const targetUrl = `${apiHost}/v1/job/google%2Fnano-banana-pro`;
    logs.push(`target: ${targetUrl}`);

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        credentials: 'include',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      logs.push(`status=${res.status} url=${res.url} type=${res.type} body=${text.slice(0, 500)}`);

      if (!res.ok) return { ok: false, status: res.status, body: text, boardId, messageId, logs };

      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { ok: true, jobId: data.id, boardId, messageId, logs };
    } catch (e) {
      logs.push(`exception name=${e.name} message=${e.message} stack=${(e.stack||'').slice(0,400)}`);
      // 진단용: 사이트 UI가 어떻게 호출하는지 봤던 API에 GET 시도해서 같은 cookies로 통과 가능한지
      try {
        const gtest = await fetch(`${apiHost}/v1/avatar?lang=ko&count=1`, { credentials: 'include' });
        logs.push(`diag GET avatar: status=${gtest.status} type=${gtest.type}`);
      } catch (e2) {
        logs.push(`diag GET also failed: ${e2.message}`);
      }
      return { ok: false, error: e.message, errorName: e.name, boardId, messageId, logs };
    }
  }, { apiHost: API_HOST });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 결과');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(result, null, 2));

  // POST 응답 + OPTIONS preflight 응답 모두 확인
  console.log('\n--- 캡처된 /v1/job 관련 네트워크 ---');
  for (const c of captures) {
    if (c.url.includes('/v1/job/') || c.url.includes('/job/google')) {
      console.log(`${c.method} ${c.status} ${c.url}`);
      console.log('  CORS-ALLOW-ORIGIN:', c.headers['access-control-allow-origin']);
      console.log('  CORS-ALLOW-METHODS:', c.headers['access-control-allow-methods']);
      console.log('  CORS-ALLOW-HEADERS:', c.headers['access-control-allow-headers']);
      console.log('  CORS-ALLOW-CREDS:', c.headers['access-control-allow-credentials']);
      console.log('  Location:', c.headers.location);
      console.log('  body:', (c.body || '').slice(0, 200));
    }
  }

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v6-result.json'), JSON.stringify({ result, captures }, null, 2));

  // ─── POST 성공 시 결과 polling ───
  if (result.ok && result.jobId) {
    console.log('\n🔥 결과 polling 시도...');
    const polled = await page.evaluate(async ({ jobId, messageId, boardId, apiHost }) => {
      const fbHost = 'https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app';
      const urls = [
        `${apiHost}/v1/job/${jobId}`,
        `${apiHost}/v1/message/${messageId}`,
        `${apiHost}/v1/board/${boardId}/message/${messageId}`,
        `${fbHost}/jobs/${jobId}.json`,
        `${fbHost}/messages/${messageId}.json`,
      ];
      const findings = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        for (const u of urls) {
          try {
            const r = await fetch(u, { credentials: 'include' });
            if (r.status >= 200 && r.status < 400) {
              const t = await r.text();
              findings.push({ try: i+1, url: u, status: r.status, body: t.slice(0, 800) });
              if (t.includes('imageUrl') || t.includes('"image":"') || t.includes('base64,iV')) {
                return { winner: u, body: t };
              }
            }
          } catch {}
        }
      }
      return { winner: null, sampleFindings: findings.slice(0, 25) };
    }, { jobId: result.jobId, messageId: result.messageId, boardId: result.boardId, apiHost: API_HOST });
    console.log(JSON.stringify(polled, null, 2).slice(0, 4000));
  }

  await new Promise(r => setTimeout(r, 1500));
  await context.close();
  process.exit(0);
})().catch(e => { console.error('[v6] FATAL:', e); process.exit(1); });
