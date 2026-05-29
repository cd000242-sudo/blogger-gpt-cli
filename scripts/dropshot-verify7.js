// scripts/dropshot-verify7.js — 사이트 자동 호출의 요청 헤더 캡처

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
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'], configurable: true });
  });

  const page = context.pages()[0] || await context.newPage();
  const requests = [];
  page.on('request', (req) => {
    try {
      const url = req.url();
      if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') return;
      if (!url.includes('api.aistudio.dropshot.io')) return;
      requests.push({ method: req.method(), url, headers: req.headers() });
    } catch {}
  });

  console.log('[v7] navigate + 10s wait — 자동 GET 호출의 요청 헤더 캡처');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 10000));

  console.log(`[v7] 캡처된 cross-origin 요청 ${requests.length}개`);
  const sample = requests[0];
  if (sample) {
    console.log('--- 첫 요청 헤더 (사이트가 어떻게 인증하는지) ---');
    console.log(`${sample.method} ${sample.url}`);
    console.log(JSON.stringify(sample.headers, null, 2));
  }

  // 모든 요청에 공통된 header만 추출 (auth 관련 식별)
  if (requests.length > 1) {
    const authKeys = new Set();
    for (const k of Object.keys(requests[0].headers)) {
      if (k.match(/auth|token|session|cognito|key|bearer|x-/i)) {
        if (requests.every(r => r.headers[k])) authKeys.add(k);
      }
    }
    console.log('\n--- 공통 auth-like 헤더 키 ---');
    console.log([...authKeys]);
  }

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v7-req-headers.json'),
    JSON.stringify(requests.slice(0, 10), null, 2));

  await context.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
