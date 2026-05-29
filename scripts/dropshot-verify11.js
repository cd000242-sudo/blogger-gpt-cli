// scripts/dropshot-verify11.js — Cognito token을 명시적으로 추출 + Authorization 헤더로 시도

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
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    ignoreDefaultArgs: ['--enable-automation'],
  };
  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try { const o = channel ? { ...opts, channel } : opts; context = await chromium.launchPersistentContext(PROFILE_DIR, o); break; } catch {}
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 5000));

  // ─── 모든 storage 추출 ───
  const allStorage = await page.evaluate(() => {
    const out = { localStorage: {}, sessionStorage: {}, indexedDBList: [] };
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out.localStorage[k] = localStorage.getItem(k); } } catch {}
    try { for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); out.sessionStorage[k] = sessionStorage.getItem(k); } } catch {}
    try { if (indexedDB.databases) { return indexedDB.databases().then(dbs => { out.indexedDBList = dbs.map(d => d.name); return out; }); } } catch {}
    return out;
  });

  console.log('--- localStorage keys ---');
  for (const k of Object.keys(allStorage.localStorage || {})) {
    const v = allStorage.localStorage[k];
    console.log(`  ${k}: ${(v || '').slice(0, 100)}`);
  }
  console.log('--- sessionStorage keys ---');
  for (const k of Object.keys(allStorage.sessionStorage || {})) {
    const v = allStorage.sessionStorage[k];
    console.log(`  ${k}: ${(v || '').slice(0, 100)}`);
  }
  console.log('--- indexedDB databases ---');
  console.log(allStorage.indexedDBList);

  // 모든 cookies + 자세히 dump
  const cookies = await context.cookies();
  console.log('\n--- Cognito 관련 cookies (key 부분만) ---');
  const cognitoCookies = cookies.filter(c => c.name.includes('Cognito') || c.name.includes('cognito'));
  for (const c of cognitoCookies) {
    console.log(`  ${c.name} (domain=${c.domain}, len=${(c.value||'').length})`);
  }

  // 사이트 페이지의 window 전역에서 Firebase/Cognito SDK instance 찾기
  const windowKeys = await page.evaluate(() => {
    const interesting = [];
    for (const k of Object.keys(window)) {
      if (/firebase|cognito|auth|amplify|user|token|session/i.test(k)) {
        try { interesting.push({ key: k, type: typeof window[k] }); } catch {}
      }
    }
    return interesting;
  });
  console.log('\n--- window 전역 관심 keys ---');
  console.log(windowKeys.slice(0, 20));

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-v11-storage.json'), JSON.stringify({ allStorage, cognitoCookies: cognitoCookies.map(c => ({ name: c.name, domain: c.domain, valueLen: c.value.length })), windowKeys }, null, 2));

  await context.close();
  process.exit(0);
})();
