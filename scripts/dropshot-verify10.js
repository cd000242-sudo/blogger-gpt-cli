// scripts/dropshot-verify10.js — Playwright page.request 사용 (browser-context fetch)

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');

async function loadChromium() {
  try { return (await import('patchright')).chromium; }
  catch { return (await import('playwright')).chromium; }
}

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
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    ignoreDefaultArgs: ['--enable-automation'],
  };
  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { const o = channel ? { ...opts, channel } : opts; context = await chromium.launchPersistentContext(PROFILE_DIR, o); break; } catch {}
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  // ─── page.request로 POST (browser-context fetch — UI와 동일) ───
  console.log('[v10] 🍌 page.request.post — browser context');

  const boardId = pushId();
  const messageId = pushId();
  const body = {
    prompt: '귀여운 노란 고양이가 햇살 비치는 창가에 앉아있는 사실적인 사진, 시네마틱',
    modelName: 'google/nano-banana-pro',
    isUnlimited: true,
    aspect_ratio: '1:1',
    resolution: '2K',
    messageId,
    boardId,
  };

  try {
    const apiResp = await page.request.post('https://api.aistudio.dropshot.io/v1/job/google%2Fnano-banana-pro', {
      data: body,
      headers: {
        'accept': '*/*',
        'accept-language': 'ko-KR',
        'content-type': 'application/json',
        'origin': 'https://aistudio.dropshot.io',
        'referer': 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro',
      },
    });
    const status = apiResp.status();
    const text = await apiResp.text();
    console.log(`[v10] POST status=${status}`);
    console.log(`  body: ${text.slice(0, 500)}`);

    if (apiResp.ok()) {
      let data; try { data = JSON.parse(text); } catch { data = null; }
      const jobId = data?.id;
      console.log(`[v10] ✅ jobId=${jobId} — 결과 polling`);

      // polling — same browser context
      const pollUrls = [
        `https://api.aistudio.dropshot.io/v1/job/${jobId}`,
        `https://api.aistudio.dropshot.io/v1/message/${messageId}`,
        `https://api.aistudio.dropshot.io/v1/board/${boardId}/message/${messageId}`,
        `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/jobs/${jobId}.json`,
        `https://ai-studio-prod-67d22-default-rtdb.asia-southeast1.firebasedatabase.app/messages/${messageId}.json`,
      ];

      let winner = null;
      const samples = [];
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 2000));
        for (const u of pollUrls) {
          try {
            const r = await page.request.get(u, { headers: { 'origin': 'https://aistudio.dropshot.io' } });
            if (r.status() === 404 || r.status() === 401) continue;
            const t = await r.text();
            samples.push({ try: i+1, url: u, status: r.status(), body: t.slice(0, 400) });
            if (r.ok() && (t.includes('imageUrl') || t.includes('"image":"') || t.includes('base64,iV'))) {
              winner = { url: u, body: t };
              break;
            }
          } catch {}
        }
        if (winner) break;
        if (i % 5 === 4) console.log(`  poll ${i+1}/45 — ${samples.length}개 응답`);
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (winner) {
        console.log('🎉 결과 발견!');
        console.log(`  URL: ${winner.url}`);
        console.log(`  body (2000자):\n${winner.body.slice(0, 2000)}`);
        // 이미지 URL/base64 추출 시도
        try {
          const j = JSON.parse(winner.body);
          const imageUrl = j.imageUrl || j.image_url || j.image || j.resultImage;
          if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            console.log(`\n📥 이미지 다운로드: ${imageUrl}`);
            const imgResp = await fetch(imageUrl);
            const buf = Buffer.from(await imgResp.arrayBuffer());
            const outPath = path.resolve(__dirname, '..', 'dropshot-test-image.png');
            fs.writeFileSync(outPath, buf);
            console.log(`💾 saved → ${outPath} (${buf.length} bytes)`);
          }
        } catch (e) { console.log(`이미지 파싱 실패: ${e.message}`); }
      } else {
        console.log('⚠️ polling timeout — 부분 응답:');
        for (const s of samples.slice(0, 10)) {
          console.log(`  [${s.try}] ${s.status} ${s.url}`);
          console.log(`    ${s.body.slice(0, 150)}`);
        }
      }
      fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v10-result.json'), JSON.stringify({ body, jobId, winner, samples: samples.slice(0, 30) }, null, 2));
    } else {
      console.log(`[v10] ❌ POST 실패`);
    }
  } catch (e) {
    console.log('[v10] FATAL:', e);
  }

  await context.close();
  process.exit(0);
})();
