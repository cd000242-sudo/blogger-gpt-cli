// scripts/dropshot-ui-probe.js — board UI의 input/button/result selector 자동 식별

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
  console.log('[ui-probe] navigate');
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 6000));

  // ─── DOM 분석 ───
  const layout = await page.evaluate(() => {
    function desc(el) {
      if (!el) return null;
      const id = el.id ? `#${el.id}` : '';
      const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
      const tag = el.tagName.toLowerCase();
      const t = (el.innerText || '').slice(0, 60).replace(/\s+/g, ' ');
      const ph = el.placeholder || el.getAttribute?.('placeholder') || '';
      const role = el.getAttribute?.('role') || '';
      const ariaLabel = el.getAttribute?.('aria-label') || '';
      return `${tag}${id}${cls} ${role ? `[role=${role}]` : ''} ${ariaLabel ? `[aria-label="${ariaLabel}"]` : ''} ${ph ? `[placeholder="${ph}"]` : ''} ${t ? `text="${t}"` : ''}`;
    }
    return {
      textareas: Array.from(document.querySelectorAll('textarea')).slice(0, 10).map(desc),
      inputs: Array.from(document.querySelectorAll('input[type="text"], input:not([type])')).slice(0, 10).map(desc),
      buttons: Array.from(document.querySelectorAll('button')).slice(0, 20).map(desc),
      contentEditables: Array.from(document.querySelectorAll('[contenteditable="true"]')).slice(0, 10).map(desc),
      imgs: Array.from(document.querySelectorAll('img')).slice(0, 10).map(i => ({ src: i.src.slice(0, 100), alt: i.alt, w: i.width, h: i.height })),
    };
  });

  console.log('═══════════════════════════════════════════');
  console.log('--- TEXTAREA (프롬프트 입력 후보) ---');
  layout.textareas.forEach((t, i) => console.log(`  ${i}: ${t}`));
  console.log('\n--- INPUT (텍스트) ---');
  layout.inputs.forEach((t, i) => console.log(`  ${i}: ${t}`));
  console.log('\n--- CONTENTEDITABLE ---');
  layout.contentEditables.forEach((t, i) => console.log(`  ${i}: ${t}`));
  console.log('\n--- BUTTON (생성 버튼 후보 — text "생성" 또는 아이콘) ---');
  layout.buttons.forEach((t, i) => console.log(`  ${i}: ${t}`));
  console.log('\n--- IMG (결과 이미지 영역) ---');
  layout.imgs.forEach((t, i) => console.log(`  ${i}: ${JSON.stringify(t)}`));

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-ui-layout.json'), JSON.stringify(layout, null, 2));

  await new Promise(r => setTimeout(r, 1000));
  await context.close();
  process.exit(0);
})();
