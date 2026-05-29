// scripts/dropshot-verify4.js
// 실제 endpoint(api.aistudio.dropshot.io)로 우리가 직접 POST 호출.
//   - Firebase push ID 알고리즘으로 messageId/boardId 생성
//   - 시도 1: 임의 boardId (server가 검증 안 하는지 테스트)
//   - 시도 2: page에서 board 페이지 navigate 후 클라이언트가 만든 boardId 추출
//   - 응답 받으면 결과 polling 또는 Firebase Realtime DB 시도

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const API_HOST = 'https://api.aistudio.dropshot.io';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const FIREBASE_HOST = 'https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app';

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
      console.log(`[v4] ✅ ${channel || 'bundled'}`);
      break;
    } catch {}
  }
  if (!context) { console.error('[v4] ❌'); process.exit(1); }

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const page = context.pages()[0] || await context.newPage();
  console.log('[v4] 🌐 navigating to board page (board 자동 생성)');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000)); // board 생성 대기

  // ───────────────────────────────────────────────────
  // 실험: page에서 임의의 boardId/messageId 생성 + POST 시도
  // ───────────────────────────────────────────────────
  const result = await page.evaluate(async ({ apiHost, fbHost }) => {
    // Firebase push ID 알고리즘
    function pushId() {
      const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
      const now = Date.now();
      let n = now;
      const ts = new Array(8);
      for (let i = 7; i >= 0; i--) { ts[i] = PUSH_CHARS.charAt(n % 64); n = Math.floor(n / 64); }
      let id = ts.join('');
      for (let i = 0; i < 12; i++) id += PUSH_CHARS.charAt(Math.floor(Math.random() * 64));
      return id;
    }

    const boardId = pushId();
    const messageId = pushId();
    const logs = [];

    // ─── POST 시도 ───
    const body = {
      prompt: '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진, 시네마틱',
      modelName: 'google/nano-banana-pro',
      isUnlimited: true,
      aspect_ratio: '1:1',     // match_input_image 대신 표준 ratio
      resolution: '2K',
      messageId,
      boardId,
    };
    logs.push(`generated boardId=${boardId} messageId=${messageId}`);
    logs.push(`POST body: ${JSON.stringify(body)}`);

    try {
      const res = await fetch(`${apiHost}/v1/job/google%2Fnano-banana-pro`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      logs.push(`POST status=${res.status} body=${text.slice(0, 500)}`);

      if (!res.ok) {
        return { ok: false, status: res.status, body: text.slice(0, 1000), logs };
      }

      let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
      const jobId = data.id;
      logs.push(`✅ jobId=${jobId}`);

      // ─── 결과 polling 시도 (3가지 endpoint) ───
      const pollResults = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const attempts = [
          { name: 'api-job-get', url: `${apiHost}/v1/job/${jobId}` },
          { name: 'api-message-get', url: `${apiHost}/v1/message/${messageId}` },
          { name: 'fb-job', url: `${fbHost}/jobs/${jobId}.json` },
          { name: 'fb-message', url: `${fbHost}/messages/${messageId}.json` },
          { name: 'fb-board-msg', url: `${fbHost}/boards/${boardId}/messages/${messageId}.json` },
        ];
        for (const a of attempts) {
          try {
            const pr = await fetch(a.url, { credentials: 'include' });
            if (pr.status !== 404 && pr.status !== 401) {
              const pt = await pr.text();
              pollResults.push({ try: i+1, name: a.name, url: a.url, status: pr.status, body: pt.slice(0, 800) });
              if (pr.ok && (pt.includes('imageUrl') || pt.includes('"image":"') || pt.includes('imageUrl') || pt.includes('"resultImage'))) {
                logs.push(`🎉 polling 성공: ${a.name}`);
                return { ok: true, jobId, finalData: pt.slice(0, 2000), pattern: a.name, logs };
              }
            }
          } catch (e) { /* ignore */ }
        }
        if (i % 5 === 4) logs.push(`⏳ polling ${i+1}/30 — ${pollResults.length}개 응답`);
      }

      return { ok: false, jobId, pollResults: pollResults.slice(0, 20), logs };
    } catch (e) {
      logs.push(`exception: ${e.message}`);
      return { ok: false, error: e.message, logs };
    }
  }, { apiHost: API_HOST, fbHost: FIREBASE_HOST });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  📊 결과');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(JSON.stringify(result, null, 2));

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v4-result.json'), JSON.stringify(result, null, 2));

  await context.close();
  process.exit(0);
})().catch(e => { console.error('[v4] FATAL:', e); process.exit(1); });
