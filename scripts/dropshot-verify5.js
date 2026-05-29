// scripts/dropshot-verify5.js
// 사이트 UI 흐름 그대로 — same-origin POST + 307 자동 follow.

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
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
      console.log(`[v5] ✅ ${channel || 'bundled'}`);
      break;
    } catch {}
  }
  if (!context) { console.error('[v5] ❌'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  // Network listener — 우리가 만든 POST 응답 + follow된 응답 모두 캡처
  const captures = [];
  const page = context.pages()[0] || await context.newPage();
  page.on('response', async (res) => {
    try {
      const req = res.request();
      const url = req.url();
      if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') return;
      if (!url.includes('dropshot.io')) return;
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      let body = null;
      try {
        if (ct.includes('json') || ct.includes('text')) {
          const t = await res.text();
          body = t.length > 4000 ? t.slice(0, 4000) + '...[TRUNC]' : t;
        } else { body = `[${ct}]`; }
      } catch { body = '[err]'; }
      captures.push({
        ts: new Date().toISOString(),
        method: req.method(),
        url,
        finalUrl: res.url(),
        status: res.status(),
        headers: res.headers(),
        body,
      });
    } catch {}
  });

  console.log('[v5] 🌐 board page');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  // ───────────────────────────────────────────────────
  // same-origin path + UI body 형식 100% 재현
  // ───────────────────────────────────────────────────
  const result = await page.evaluate(async () => {
    function pushId() {
      const C = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
      const now = Date.now();
      let n = now, ts = '';
      const arr = [];
      for (let i = 7; i >= 0; i--) { arr[i] = C.charAt(n % 64); n = Math.floor(n / 64); }
      ts = arr.join('');
      let rand = '';
      for (let i = 0; i < 12; i++) rand += C.charAt(Math.floor(Math.random() * 64));
      return ts + rand;
    }

    const boardId = pushId();
    const messageId = pushId();
    const logs = [`generated boardId=${boardId} messageId=${messageId}`];

    const body = {
      prompt: '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진, 시네마틱',
      modelName: 'google/nano-banana-pro',
      isUnlimited: true,
      aspect_ratio: '1:1',
      resolution: '2K',
      messageId,
      boardId,
    };
    logs.push(`body: ${JSON.stringify(body)}`);

    try {
      // ⭐ same-origin — 사이트 UI 흐름 정확히 재현
      const res = await fetch('/v1/job/google%2Fnano-banana-pro', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      logs.push(`status=${res.status} finalUrl=${res.url} body=${text.slice(0, 500)}`);

      if (!res.ok) return { ok: false, status: res.status, body: text.slice(0, 1000), boardId, messageId, logs };

      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      logs.push(`✅ POST 성공 jobId=${data.id}`);
      return { ok: true, jobId: data.id, boardId, messageId, logs };
    } catch (e) {
      logs.push(`exception: ${e.message}`);
      return { ok: false, error: e.message, boardId, messageId, logs };
    }
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 POST 결과');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(result, null, 2));

  // ───────────────────────────────────────────────────
  // POST 성공 시 — Firebase Realtime DB로 결과 polling
  // ───────────────────────────────────────────────────
  if (result.ok && result.jobId) {
    console.log('');
    console.log('🔥 결과 수신 — Firebase + REST polling 동시 시도 (60초)');
    const polled = await page.evaluate(async ({ jobId, messageId, boardId }) => {
      const fbHost = 'https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app';
      const logs = [];
      const tryUrls = [
        `${fbHost}/jobs/${jobId}.json`,
        `${fbHost}/messages/${messageId}.json`,
        `${fbHost}/board/${boardId}/messages/${messageId}.json`,
        `${fbHost}/users/IKL0UI21/jobs/${jobId}.json`,
        `/v1/job/${jobId}`,            // same-origin
        `/v1/message/${messageId}`,    // same-origin
      ];
      const seenStatus = {};
      const winners = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        for (const u of tryUrls) {
          try {
            const r = await fetch(u, { credentials: 'include' });
            const key = `${r.status} ${u}`;
            if (!seenStatus[key]) {
              seenStatus[key] = true;
              const t = await r.text();
              logs.push({ try: i+1, url: u, status: r.status, body: t.slice(0, 600) });
              if (r.ok && (t.includes('imageUrl') || t.includes('"image":"') || t.includes('base64') || t.includes('resultImage'))) {
                winners.push({ url: u, body: t.slice(0, 2000) });
              }
            }
          } catch (e) {}
        }
        if (winners.length > 0) break;
      }
      return { winners, sampleLogs: logs.slice(0, 30) };
    }, { jobId: result.jobId, messageId: result.messageId, boardId: result.boardId });

    console.log(JSON.stringify(polled, null, 2));
  }

  // 추가로 — network listener가 잡은 모든 dropshot 요청 dump
  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v5-traces.json'), JSON.stringify({
    postResult: result,
    networkTraces: captures,
  }, null, 2));
  console.log(`[v5] 💾 → dropshot-v5-traces.json (${captures.length} traces)`);

  await new Promise(r => setTimeout(r, 1500));
  await context.close();
  process.exit(0);
})().catch(e => { console.error('[v5] FATAL:', e); process.exit(1); });
