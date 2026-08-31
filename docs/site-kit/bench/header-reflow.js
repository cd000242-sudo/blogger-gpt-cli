#!/usr/bin/env node
/**
 * 헤더가 왜 60px 줄어드는지 본다 — 폰트 있을 때 / 없을 때를 같은 자리에서 잰다.
 *
 * 고칠 방법이 둘인데 어느 쪽인지에 따라 답이 다르다:
 *   (가) 글자가 두 줄로 접혔다 펴진다  → 줄바꿈을 막으면 끝
 *   (나) 글자 높이 자체가 다르다        → 대체글꼴 지표를 맞춰야 한다
 *
 * 사용: node docs/site-kit/bench/header-reflow.js <url>
 */
const { chromium } = require('playwright');

const URL_ARG = process.argv[2] || 'https://leadernam.com/';
const FONT_HOST = /jsdelivr|fonts\.(googleapis|gstatic)/i;

const PROBE = () => {
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      높이: Math.round(r.height),
      너비: Math.round(r.width),
      글꼴: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      크기: cs.fontSize,
      줄높이: cs.lineHeight,
      글자: (el.textContent || '').trim().slice(0, 40),
    };
  };
  const title = document.querySelector('.main-title, .site-title, .site-branding a');
  let 줄수 = null;
  if (title) {
    const lh = parseFloat(getComputedStyle(title).lineHeight);
    const h = title.getBoundingClientRect().height;
    줄수 = lh > 0 ? Math.round((h / lh) * 10) / 10 : null;
  }
  return {
    'NAV#site-navigation': pick('#site-navigation'),
    '.site-branding': pick('.site-branding'),
    '.main-title': pick('.main-title'),
    '.site-description': pick('.site-description'),
    제목줄수: 줄수,
    로고이미지: !!document.querySelector('.site-branding img, .site-logo img'),
  };
};

async function probe(browser, blockFonts) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  if (blockFonts) {
    await page.route('**/*', (route) => {
      const isFont = FONT_HOST.test(route.request().url()) || route.request().resourceType() === 'font';
      return isFont ? route.abort() : route.continue();
    });
  }
  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(4000);
  const out = await page.evaluate(PROBE);
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const withFont = await probe(browser, false);
  const noFont = await probe(browser, true);
  await browser.close();

  console.log('대상: ' + URL_ARG + '\n');
  console.log('로고 이미지 있음? ' + (withFont.로고이미지 ? '예' : '아니오 (글자 제목)'));
  console.log('제목 줄 수 — 폰트 있을 때 ' + withFont.제목줄수 + '줄 / 폰트 없을 때 ' + noFont.제목줄수 + '줄\n');

  for (const key of Object.keys(withFont)) {
    const a = withFont[key];
    const b = noFont[key];
    if (!a || typeof a !== 'object') continue;
    const 차이 = (b.높이 || 0) - (a.높이 || 0);
    console.log(key);
    console.log('   폰트 있을 때 : ' + a.높이 + 'px 높이, ' + a.너비 + 'px 너비, ' + a.글꼴 + ' ' + a.크기 + '/' + a.줄높이);
    console.log('   폰트 없을 때 : ' + b.높이 + 'px 높이, ' + b.너비 + 'px 너비, ' + b.글꼴 + ' ' + b.크기 + '/' + b.줄높이);
    console.log('   → 차이 ' + (차이 > 0 ? '+' : '') + 차이 + 'px' + (차이 !== 0 ? '  ← 여기가 민다' : ''));
  }
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
