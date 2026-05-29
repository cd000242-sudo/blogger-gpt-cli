// scripts/dropshot-i2i-probe.js — i2i reference 업로드 UI selector 발견

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

  // file input 및 image upload 관련 모든 요소 dump
  const layout = await page.evaluate(() => {
    const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((i, idx) => ({
      idx, accept: i.accept, multiple: i.multiple, name: i.name,
      hidden: i.hidden || i.style.display === 'none',
      parent: i.parentElement?.outerHTML?.slice(0, 200),
    }));
    // ic_image_add.svg 가지는 모든 img + 그 부모 button
    const addIcons = Array.from(document.querySelectorAll('img[src*="ic_image_add"]')).map((i, idx) => {
      let parent = i.parentElement;
      for (let d = 0; d < 5; d++) {
        if (parent && parent.tagName === 'BUTTON') {
          return { idx, btnClasses: parent.className, btnText: (parent.innerText || '').slice(0, 50), btnHTML: parent.outerHTML.slice(0, 300) };
        }
        parent = parent?.parentElement;
        if (!parent) break;
      }
      return { idx, parent: i.parentElement?.outerHTML?.slice(0, 200) };
    });
    // 텍스트로 "이미지 추가" 또는 "참조" 또는 "Reference" 포함
    const textRefs = Array.from(document.querySelectorAll('button, div, label')).filter(el => {
      const t = (el.innerText || el.textContent || '').slice(0, 50);
      return /참조|이미지\s*추가|reference|업로드|첨부/i.test(t);
    }).slice(0, 10).map(el => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').slice(0, 80).replace(/\s+/g, ' '),
      classes: typeof el.className === 'string' ? el.className.slice(0, 100) : '',
    }));
    return { fileInputs, addIcons, textRefs };
  });

  console.log('═══════════════════════════════════════════');
  console.log('--- input[type=file] (reference 업로드 후보) ---');
  layout.fileInputs.forEach((f, i) => {
    console.log(`  [${i}] accept=${f.accept} multiple=${f.multiple} hidden=${f.hidden}`);
    console.log(`      parent: ${f.parent}`);
  });
  console.log('\n--- ic_image_add.svg 아이콘이 있는 button ---');
  layout.addIcons.forEach((a, i) => {
    console.log(`  [${i}]`, JSON.stringify(a, null, 2));
  });
  console.log('\n--- "참조/이미지 추가/reference/업로드" 텍스트 가진 요소 ---');
  layout.textRefs.forEach((t, i) => console.log(`  [${i}] ${t.tag}: "${t.text}" (class: ${t.classes})`));

  fs.writeFileSync(path.resolve(__dirname, '..', 'dropshot-i2i-layout.json'), JSON.stringify(layout, null, 2));

  await new Promise(r => setTimeout(r, 1500));
  await context.close();
  process.exit(0);
})();
