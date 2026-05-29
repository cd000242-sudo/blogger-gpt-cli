// scripts/dropshot-ui-test.js — UI 자동화로 이미지 1장 생성 시도

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const BOARD_URL = 'https://aistudio.dropshot.io/ko/workspace/board?panel=image&imageModelName=google/nano-banana-pro';
const PROFILE_DIR = path.join(os.homedir(), '.blogger-gpt', 'dropshot-profile');
const PROMPT = '귀여운 노란 고양이가 햇살 비치는 창가에서 잠자는 사실적인 사진';

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

  // 이미지 응답 capture (Firebase Realtime DB의 push 결과)
  const capturedImages = [];
  page.on('response', async (res) => {
    try {
      const url = res.request().url();
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      // CDN 이미지 또는 firebase realtime 응답
      if ((ct.startsWith('image/') && url.includes('aistudio')) || url.includes('result')) {
        capturedImages.push({ url, ct, status: res.status() });
        console.log(`[img-capture] ${res.status()} ${url.slice(0, 120)} (${ct})`);
      }
      // JSON 응답 중 imageUrl 포함하는 것
      if (ct.includes('json') && url.includes('dropshot.io')) {
        try {
          const t = await res.text();
          if (t.includes('imageUrl') || t.includes('"image":"') || t.includes('imageGroup')) {
            console.log(`[json-img] ${url.slice(0, 100)}: ${t.slice(0, 300)}`);
            capturedImages.push({ url, json: t.slice(0, 2000) });
          }
        } catch {}
      }
    } catch {}
  });

  console.log('[ui-test] navigate');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 6000));

  // ─── 프롬프트 입력 ───
  console.log('[ui-test] 프롬프트 입력');
  const promptSel = 'textarea[placeholder="어떤 장면을 만들고 싶나요?"]';
  try {
    await page.waitForSelector(promptSel, { timeout: 10000 });
    await page.click(promptSel);
    await page.fill(promptSel, PROMPT);
    console.log(`  입력: "${PROMPT}"`);
  } catch (e) {
    console.log('[ui-test] ❌ textarea 못 찾음:', e.message);
    await context.close(); process.exit(1);
  }

  await new Promise(r => setTimeout(r, 1500));

  // ─── 생성 버튼 찾기 ───
  // textarea 옆 send 버튼 — `button.absolute.right-2.top-1/2`
  console.log('[ui-test] 생성 버튼 클릭 시도');
  let clicked = false;

  // 전략 1: textarea의 sibling button (`right-2 top-1/2`)
  try {
    const sendBtn = await page.$('textarea[placeholder="어떤 장면을 만들고 싶나요?"] ~ button.absolute, textarea[placeholder="어떤 장면을 만들고 싶나요?"] + button, textarea[placeholder="어떤 장면을 만들고 싶나요?"] ~ * button.absolute.right-2');
    if (sendBtn) {
      await sendBtn.click();
      clicked = true;
      console.log('  ✅ 전략 1 (sibling button)');
    }
  } catch {}

  // 전략 2: textarea container 안의 첫 번째 absolute button
  if (!clicked) {
    try {
      await page.evaluate(() => {
        const ta = document.querySelector('textarea[placeholder="어떤 장면을 만들고 싶나요?"]');
        if (!ta) return false;
        // 같은 form/div 안의 absolute button
        let parent = ta.parentElement;
        for (let depth = 0; depth < 5 && parent; depth++) {
          const btn = parent.querySelector('button.absolute');
          if (btn) { btn.click(); return true; }
          parent = parent.parentElement;
        }
        return false;
      });
      clicked = true;
      console.log('  ✅ 전략 2 (parent absolute)');
    } catch {}
  }

  // 전략 3: Enter 키 — 많은 chat UI가 지원
  if (!clicked) {
    try {
      await page.keyboard.press('Enter');
      clicked = true;
      console.log('  ✅ 전략 3 (Enter 키)');
    } catch {}
  }

  if (!clicked) {
    console.log('[ui-test] ❌ 어떤 전략으로도 클릭 실패');
    await context.close(); process.exit(1);
  }

  // ─── 결과 이미지 대기 ───
  console.log('[ui-test] ⏳ 이미지 생성 대기 (60초)');
  const startTs = Date.now();
  let foundImg = null;
  while ((Date.now() - startTs) < 60_000) {
    await new Promise(r => setTimeout(r, 3000));
    // cdn.aistudio.dropshot.io 이미지 캡처 확인
    const cdnImg = capturedImages.find(c => c.url && c.url.includes('cdn.aistudio.dropshot.io/result') || (c.url && c.url.match(/\/job\/.*\.(png|jpg|webp)/i)));
    if (cdnImg) { foundImg = cdnImg.url; break; }

    // DOM에서 새 이미지 찾기 (icons 제외)
    const domImg = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      const result = imgs.find(i => i.src && !i.src.includes('/icons/') && !i.src.includes('/sample/') && i.naturalWidth > 200);
      return result ? result.src : null;
    });
    if (domImg) { foundImg = domImg; break; }

    const elapsed = Math.round((Date.now() - startTs)/1000);
    if (elapsed % 9 === 0) console.log(`  ${elapsed}s — capturedImages=${capturedImages.length}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (foundImg) {
    console.log(`🎉 이미지 발견: ${foundImg.slice(0, 150)}`);
    // 다운로드
    try {
      const r = await fetch(foundImg);
      const buf = Buffer.from(await r.arrayBuffer());
      const out = path.resolve(__dirname, '..', 'dropshot-ui-test.png');
      fs.writeFileSync(out, buf);
      console.log(`💾 saved → ${out} (${buf.length} bytes)`);
    } catch (e) {
      console.log(`download err: ${e.message}`);
    }
  } else {
    console.log('⚠️ 60초 내 결과 이미지 없음');
    console.log(`  capturedImages: ${capturedImages.length}`);
    for (const c of capturedImages.slice(0, 10)) {
      console.log(`    ${c.status || ''} ${(c.url || '').slice(0, 100)}`);
    }
  }

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-ui-result.json'), JSON.stringify({ foundImg, capturedImages: capturedImages.slice(0, 20) }, null, 2));

  await new Promise(r => setTimeout(r, 2000));
  await context.close();
  process.exit(foundImg ? 0 : 1);
})();
