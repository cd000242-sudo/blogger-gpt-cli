// scripts/dropshot-verify8.js — Node.js 직접 fetch + 브라우저 cookies/headers emulate

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

// Firebase push ID
function pushId() {
  const C = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  const now = Date.now(); let n = now; const arr = [];
  for (let i = 7; i >= 0; i--) { arr[i] = C.charAt(n % 64); n = Math.floor(n / 64); }
  let id = arr.join('');
  for (let i = 0; i < 12; i++) id += C.charAt(Math.floor(Math.random() * 64));
  return id;
}

(async () => {
  const chromium = await loadChromium();
  const opts = {
    headless: false,
    args: ['--no-first-run', '--disable-blink-features=AutomationControlled', '--no-sandbox', '--lang=ko-KR,ko'],
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    ignoreDefaultArgs: ['--enable-automation'],
  };
  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { const o = channel ? { ...opts, channel } : opts; context = await chromium.launchPersistentContext(PROFILE_DIR, o); break; } catch {}
  }

  const page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  // ── 브라우저에서 cookies 추출 ──
  const cookies = await context.cookies();
  const apiCookies = cookies.filter(c =>
    c.domain.includes('dropshot.io') || c.domain === '.dropshot.io' || c.domain === '.aistudio.dropshot.io' || c.domain === 'api.aistudio.dropshot.io'
  );
  const cookieStr = apiCookies.map(c => `${c.name}=${c.value}`).join('; ');
  console.log(`[v8] 추출된 cookie ${apiCookies.length}개 (총 length=${cookieStr.length})`);
  console.log('  도메인:', [...new Set(apiCookies.map(c => c.domain))]);

  await context.close();

  // ── Node.js에서 직접 POST ──
  const boardId = pushId();
  const messageId = pushId();
  const body = {
    prompt: '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진, 시네마틱',
    modelName: 'google/nano-banana-pro',
    isUnlimited: true,
    aspect_ratio: '1:1',
    resolution: '2K',
    messageId,
    boardId,
  };

  console.log('[v8] 🍌 Node.js 직접 POST → api.aistudio.dropshot.io');
  console.log('  boardId:', boardId, 'messageId:', messageId);

  const commonHeaders = {
    'accept': '*/*',
    'accept-language': 'ko-KR',
    'content-type': 'application/json',
    'origin': 'https://aistudio.dropshot.io',
    'referer': 'https://aistudio.dropshot.io/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'cookie': cookieStr,
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
  };

  try {
    const res = await fetch('https://api.aistudio.dropshot.io/v1/job/google%2Fnano-banana-pro', {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`[v8] POST status=${res.status}`);
    console.log(`  resp headers:`, Object.fromEntries([...res.headers.entries()].filter(([k]) => !k.startsWith('access-control'))));
    console.log(`  body: ${text.slice(0, 1000)}`);

    if (!res.ok) {
      console.log('[v8] ❌ POST 실패');
      process.exit(1);
    }

    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    const jobId = data.id;
    console.log(`[v8] ✅ jobId=${jobId}`);

    // ── 결과 polling — 다양한 endpoint 시도 ──
    console.log('[v8] 🔥 polling 시작 (60초)');
    const tryUrls = [
      `https://api.aistudio.dropshot.io/v1/job/${jobId}`,
      `https://api.aistudio.dropshot.io/v1/message/${messageId}`,
      `https://api.aistudio.dropshot.io/v1/board/${boardId}/message/${messageId}`,
      `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/jobs/${jobId}.json`,
      `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/messages/${messageId}.json`,
      `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/boards/${boardId}/messages/${messageId}.json`,
    ];

    const findings = [];
    let winner = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      for (const u of tryUrls) {
        try {
          const r2 = await fetch(u, { method: 'GET', headers: commonHeaders });
          if (r2.status === 404 || r2.status === 401) continue;
          const t = await r2.text();
          findings.push({ try: i+1, url: u, status: r2.status, body: t.slice(0, 500) });
          if (r2.ok && (t.includes('imageUrl') || t.includes('"image":"') || t.includes('base64,iV') || t.includes('"image_url'))) {
            winner = { url: u, body: t };
            break;
          }
        } catch (e) { /* skip */ }
      }
      if (winner) break;
      if (i % 5 === 4) console.log(`  poll ${i+1}/30 — ${findings.length}개 부분 응답`);
    }

    console.log('\n[v8] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (winner) {
      console.log('[v8] 🎉 결과 발견!');
      console.log(`  ${winner.url}`);
      console.log(`  body (1000자):`);
      console.log(winner.body.slice(0, 1000));
    } else {
      console.log('[v8] ⚠️ polling timeout — 부분 응답 샘플:');
      for (const f of findings.slice(0, 8)) {
        console.log(`  [${f.try}] ${f.status} ${f.url}`);
        console.log(`        ${f.body.slice(0, 200)}`);
      }
    }
    fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v8-result.json'), JSON.stringify({ jobId, body, postStatus: 'ok', winner, findings }, null, 2));
  } catch (e) {
    console.log('[v8] FATAL:', e);
  }

  process.exit(0);
})();
