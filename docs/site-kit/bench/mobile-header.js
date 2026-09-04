/**
 * 모바일 헤더 실측 — 눈으로 짐작하지 않고 좌표로 잰다.
 * 사장님: "이거 모바일이문제네"
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },   // 아이폰 14 급
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  await page.goto('https://leadernam.com/?v=' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });

  const box = async (sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      bg: cs.backgroundColor, display: cs.display,
    };
  }, sel);

  const targets = {
    '헤더': 'header.site-header',
    '사이트 브랜딩': '.site-branding',
    '모바일 헤더': '.mobile-header-navigation',
    '주 내비': '#site-navigation',
    '모바일 토글 감싸개': '#mobile-menu-control-wrapper',
    '햄버거 버튼': '.menu-toggle',
    '검색 아이콘': '.search-item',
    '메뉴바 항목': '.menu-bar-items',
  };
  console.log('뷰포트 390px 실측');
  for (const [name, sel] of Object.entries(targets)) {
    const b = await box(sel);
    console.log(' ', name.padEnd(16), b ? `x=${b.x} y=${b.y} w=${b.w} h=${b.h} bg=${b.bg}` : '(없음)');
  }

  const overflow = await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  console.log('\n가로 넘침:', overflow.docWidth > overflow.viewport ? `❌ ${overflow.docWidth}px > ${overflow.viewport}px` : '✅ 없음');

  await page.screenshot({ path: 'docs/site-kit/bench/shots/mobile-header.png', clip: { x: 0, y: 0, width: 390, height: 260 } });
  console.log('스크린샷: docs/site-kit/bench/shots/mobile-header.png');
  await browser.close();
})();
