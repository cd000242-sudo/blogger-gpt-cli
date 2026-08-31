#!/usr/bin/env node
/**
 * CLS 범인 찾기 — "화면이 밀린다"를 누가 밀었는지까지 적는다.
 *
 * layout-shift 항목에는 sources 가 붙어 있어서 어떤 엘리먼트가
 * 어디에서 어디로 움직였는지 알 수 있다. 총점만 보면 고칠 곳을 못 찾는다.
 *
 * 사용: node docs/site-kit/bench/cls-blame.js <url> [desktop|mobile]
 */
const { chromium, devices } = require('playwright');

const URL_ARG = process.argv[2];
const DEVICE = process.argv[3] || 'desktop';
if (!URL_ARG) {
  console.error('사용법: cls-blame.js <url> [desktop|mobile]');
  process.exit(1);
}

const PRESET = DEVICE === 'mobile'
  ? (devices['Pixel 7'] || { viewport: { width: 390, height: 844 }, isMobile: true })
  : { viewport: { width: 1440, height: 900 } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(PRESET);
  const page = await ctx.newPage();

  await page.addInitScript(() => {
    window.__shifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__shifts.push({
            value: e.value,
            at: Math.round(e.startTime),
            sources: (e.sources || []).map((s) => {
              const el = s.node;
              const desc = el
                ? el.tagName + (el.id ? '#' + el.id : '') +
                  (el.className && typeof el.className === 'string'
                    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                    : '')
                : '(사라진 엘리먼트)';
              const prev = s.previousRect || {};
              const cur = s.currentRect || {};
              return {
                el: desc,
                움직임: Math.round((cur.y || 0) - (prev.y || 0)) + 'px 세로, ' +
                        Math.round((cur.height || 0) - (prev.height || 0)) + 'px 높이변화',
                previousRect: { y: Math.round(prev.y || 0), h: Math.round(prev.height || 0) },
                currentRect: { y: Math.round(cur.y || 0), h: Math.round(cur.height || 0) },
              };
            }),
          });
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {
      /* 관측기 미지원 */
    }
  });

  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(5000); // 지연 주입되는 광고가 미는 것까지 기다린다

  const shifts = await page.evaluate(() => window.__shifts || []);
  const total = shifts.reduce((a, s) => a + s.value, 0);

  console.log('CLS 합계 ' + total.toFixed(4) + '  (' + DEVICE + ', 밀림 ' + shifts.length + '회)\n');

  const ranked = shifts.slice().sort((a, b) => b.value - a.value);
  for (const s of ranked.slice(0, 8)) {
    const share = total > 0 ? Math.round((s.value / total) * 100) : 0;
    console.log('▶ ' + s.value.toFixed(4) + ' (' + share + '%)  ' + s.at + 'ms 시점');
    for (const src of s.sources.slice(0, 3)) {
      console.log('    ' + src.el);
      console.log('      ' + src.움직임 + '   y ' + src.previousRect.y + '→' + src.currentRect.y +
                  ', 높이 ' + src.previousRect.h + '→' + src.currentRect.h);
    }
  }

  await browser.close();
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
