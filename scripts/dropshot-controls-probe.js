// scripts/dropshot-controls-probe.js — 무제한 모드 토글 + 카운터 selector 식별

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
  let context;
  for (const channel of ['chrome', 'msedge', undefined]) {
    try {
      context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: false,
        args: ['--no-first-run', '--disable-blink-features=AutomationControlled', '--no-sandbox', '--lang=ko-KR,ko'],
        viewport: { width: 1280, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
        ignoreDefaultArgs: ['--enable-automation'],
        ...(channel ? { channel } : {}),
      });
      break;
    } catch {}
  }
  const page = context.pages()[0] || await context.newPage();
  await page.goto(BOARD_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise(r => setTimeout(r, 6000));

  const layout = await page.evaluate(() => {
    function desc(el) {
      if (!el) return null;
      const tag = el.tagName?.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = (typeof el.className === 'string') ? '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 5).join('.') : '';
      const text = (el.innerText || '').slice(0, 50).replace(/\s+/g, ' ');
      const role = el.getAttribute?.('role') || '';
      const ariaLabel = el.getAttribute?.('aria-label') || '';
      const dataSentry = el.getAttribute?.('data-sentry-component') || '';
      return `${tag}${id}${cls.slice(0, 80)} ${role ? `[role=${role}]` : ''}${ariaLabel ? ` aria="${ariaLabel}"` : ''}${dataSentry ? ` sentry="${dataSentry}"` : ''} ${text ? `t="${text}"` : ''}`;
    }
    // "무제한" 텍스트 또는 비슷한 라벨 가진 element 탐색
    const unlimitedElems = Array.from(document.querySelectorAll('label, button, div, span'))
      .filter(el => /무제한|Unlimited|unlimited/i.test(el.innerText || ''))
      .slice(0, 10)
      .map(desc);
    // 카운터 +/-  버튼
    const plusMinusElems = Array.from(document.querySelectorAll('button'))
      .filter(el => /^[\s+\-−]?$/.test((el.innerText || '').trim()) || /ic_plus|ic_minus/.test(el.outerHTML))
      .slice(0, 15)
      .map(desc);
    // role=switch
    const switches = Array.from(document.querySelectorAll('[role="switch"], input[type="checkbox"]'))
      .slice(0, 10)
      .map(desc);
    // 2K / 1K 같은 해상도 옵션
    const resolutionElems = Array.from(document.querySelectorAll('button, span, label'))
      .filter(el => /^(1K|2K|4K|HD|FHD)$/i.test((el.innerText || '').trim()))
      .slice(0, 5)
      .map(desc);
    return { unlimitedElems, plusMinusElems, switches, resolutionElems };
  });

  console.log('═══════════════ 무제한 모드 후보 ═══════════════');
  layout.unlimitedElems.forEach((t, i) => console.log(`  [${i}] ${t}`));
  console.log('\n═══════════════ +/- 카운터 버튼 후보 ═══════════════');
  layout.plusMinusElems.forEach((t, i) => console.log(`  [${i}] ${t}`));
  console.log('\n═══════════════ switch/checkbox ═══════════════');
  layout.switches.forEach((t, i) => console.log(`  [${i}] ${t}`));
  console.log('\n═══════════════ 해상도 옵션 ═══════════════');
  layout.resolutionElems.forEach((t, i) => console.log(`  [${i}] ${t}`));

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-controls-layout.json'), JSON.stringify(layout, null, 2));

  await new Promise(r => setTimeout(r, 2000));
  await context.close();
  process.exit(0);
})();
