#!/usr/bin/env node
/**
 * CLS 원인 확정 실험 — 짐작을 지우고 하나씩 빼 본다.
 *
 * 헤더가 1934ms 에 60px 줄었다. 후보가 둘이다:
 *   (가) 늦게 도착한 Pretendard 폰트가 제목 줄바꿈을 바꿔서
 *   (나) 광고/스크립트가 헤더를 건드려서
 *
 * 그래서 조건을 나눠 각각 재고, CLS 가 사라지는 쪽이 범인이다.
 *
 * 사용: node docs/site-kit/bench/cls-cause-test.js <url>
 */
const { chromium } = require('playwright');

const URL_ARG = process.argv[2] || 'https://leadernam.com/';

const CONDITIONS = [
  { name: '있는 그대로', block: [] },
  { name: '폰트만 차단', block: ['font'] },
  { name: '광고·분석만 차단', block: ['ads'] },
  { name: '폰트+광고 둘 다 차단', block: ['font', 'ads'] },
];

const FONT_HOST = /jsdelivr|fonts\.(googleapis|gstatic)/i;
const ADS_HOST = /googlesyndication|googletagmanager|doubleclick|adtrafficquality|analytics\.google|google-analytics|pixel\.wp\.com/i;

async function run(browser, condition) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  if (condition.block.length) {
    await page.route('**/*', (route) => {
      const url = route.request().url();
      const isFont = FONT_HOST.test(url) || route.request().resourceType() === 'font';
      const isAds = ADS_HOST.test(url);
      if ((condition.block.includes('font') && isFont) || (condition.block.includes('ads') && isAds)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  await page.addInitScript(() => {
    window.__cls = 0;
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* 미지원 */
    }
  });

  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(5000);
  const cls = await page.evaluate(() => window.__cls || 0);
  await ctx.close();
  return cls;
}

(async () => {
  const browser = await chromium.launch();
  console.log('대상: ' + URL_ARG + '\n');
  for (const c of CONDITIONS) {
    // 조건마다 두 번 재서 낮은 쪽을 쓴다 — 한 번의 딸꾹질로 결론이 뒤집히면 안 된다
    const a = await run(browser, c);
    const b = await run(browser, c);
    const cls = Math.min(a, b);
    const mark = cls <= 0.1 ? '✅' : cls <= 0.25 ? '⚠️' : '❌';
    console.log('  ' + mark + ' ' + c.name.padEnd(22) + 'CLS ' + cls.toFixed(4) + '   (2회: ' + a.toFixed(4) + ', ' + b.toFixed(4) + ')');
  }
  await browser.close();
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
