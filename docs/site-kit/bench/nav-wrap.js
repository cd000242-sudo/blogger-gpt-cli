#!/usr/bin/env node
/**
 * 헤더에서 정확히 무엇이 접히는지 — 캔버스 말고 실제 배치로 잰다.
 *
 * 앞선 측정에서 캔버스(101%)와 DOM(87%)이 어긋났다. 캔버스의 font 지정은
 * 웹폰트가 실제로 적용됐는지 보장하지 못한다. 그러니 진짜 배치된 좌표만 믿는다.
 *
 * 메뉴 항목들의 y 좌표를 모아 몇 줄로 놓였는지 세고, 폰트 유무로 비교한다.
 *
 * 사용: node docs/site-kit/bench/nav-wrap.js <url>
 */
const { chromium } = require('playwright');

const URL_ARG = process.argv[2] || 'https://leadernam.com/';
const FONT_HOST = /jsdelivr|fonts\.(googleapis|gstatic)/i;

const PROBE = () => {
  const items = [...document.querySelectorAll('.main-nav > ul > li')].map((li) => {
    const r = li.getBoundingClientRect();
    return { 글자: (li.textContent || '').trim().slice(0, 12), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
  });
  const 줄 = [...new Set(items.map((i) => i.y))].sort((a, b) => a - b);

  // 같은 문자열을 두 글꼴로 나란히 놓고 실제 배치 너비를 잰다
  const 표본 = ['CLAIMWISE', '보험금·지원금·환급, 돈 돌려받는 기준', '국민연금 수령액'];
  const 재기 = (family, text) => {
    const s = document.createElement('span');
    s.style.cssText = 'position:absolute;left:-9999px;white-space:nowrap;font-size:100px;font-family:' + family;
    s.textContent = text;
    document.body.appendChild(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  const 비교 = 표본.map((t) => ({
    글자: t.slice(0, 16),
    Pretendard: Math.round(재기('"Pretendard Variable"', t)),
    대체: Math.round(재기('"Malgun Gothic"', t)),
  }));

  return {
    메뉴항목수: items.length,
    메뉴줄수: 줄.length,
    메뉴총너비: items.reduce((a, i) => a + i.w, 0),
    항목들: items,
    제목너비: Math.round((document.querySelector('.main-title') || { getBoundingClientRect: () => ({ width: 0 }) }).getBoundingClientRect().width),
    글꼴비교: 비교,
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
  const a = await probe(browser, false);
  const b = await probe(browser, true);
  await browser.close();

  console.log('메뉴 항목 ' + a.메뉴항목수 + '개\n');
  console.log('               폰트 있을 때   폰트 없을 때');
  console.log('  메뉴 줄 수      ' + String(a.메뉴줄수).padEnd(14) + b.메뉴줄수 + (a.메뉴줄수 !== b.메뉴줄수 ? '   ← 여기가 접힌다' : ''));
  console.log('  메뉴 총 너비    ' + String(a.메뉴총너비 + 'px').padEnd(14) + b.메뉴총너비 + 'px  (' + (((b.메뉴총너비 / a.메뉴총너비) - 1) * 100).toFixed(1) + '% 넓어짐)');
  console.log('  제목 너비       ' + String(a.제목너비 + 'px').padEnd(14) + b.제목너비 + 'px');

  console.log('\n실제 배치로 잰 글자폭 (100px 기준):');
  for (let i = 0; i < a.글꼴비교.length; i++) {
    const row = a.글꼴비교[i];
    const 비율 = row.대체 > 0 ? (row.Pretendard / row.대체) : null;
    console.log('  "' + row.글자 + '"  Pretendard ' + row.Pretendard + 'px / 맑은고딕 ' + row.대체 + 'px  → ' + (비율 ? (비율 * 100).toFixed(1) + '%' : '—'));
  }

  console.log('\n메뉴 항목별 위치 (폰트 없을 때):');
  for (const it of b.항목들) console.log('   y' + String(it.y).padStart(4) + '  ' + String(it.w + 'px').padEnd(8) + it.글자);
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
