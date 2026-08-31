#!/usr/bin/env node
/**
 * CLS 처방 시험대 — 붙여넣기 전에 여기서 먼저 재본다.
 *
 * 재현 조건이 핵심이다. 폰트를 아예 막으면 바뀔 일이 없어서 CLS 가 0 으로 나온다.
 * 실제 사용자가 겪는 것은 "늦게 도착하는 것"이므로, 폰트 응답을 일부러 늦춘다.
 *
 * 그 상태에서 후보 CSS 를 페이지에 끼워 넣고 각각 CLS 를 잰다.
 * 0.1 아래로 내려가는 처방만 사장님께 드린다.
 *
 * 사용: node docs/site-kit/bench/cls-fix-test.js <url>
 */
const { chromium } = require('playwright');

const URL_ARG = process.argv[2] || 'https://leadernam.com/';
const FONT_RE = /jsdelivr|fonts\.(googleapis|gstatic)/i;
const FONT_DELAY_MS = 2500;

/** 실측: 한글에서 맑은 고딕이 Pretendard 보다 약 15% 넓다 (86.6% / 85.6%) */
const 대체글꼴보정 = `
@font-face {
  font-family: "Pretendard 대체";
  src: local("Malgun Gothic"), local("Apple SD Gothic Neo"), local("Noto Sans KR"), local("sans-serif");
  size-adjust: 86%;
  ascent-override: 92%;
  descent-override: 24%;
  line-gap-override: 0%;
}
body, .main-navigation a, .main-title, .site-description, .entry-content {
  font-family: "Pretendard Variable", Pretendard, "Pretendard 대체", "Apple SD Gothic Neo", sans-serif !important;
}
`;

const 메뉴줄바꿈금지 = `
.main-navigation .main-nav > ul { flex-wrap: nowrap !important; }
`;

const 메뉴여백축소 = `
.main-navigation .main-nav > ul > li > a { padding-left: 12px !important; padding-right: 12px !important; }
`;

const CANDIDATES = [
  { name: '대조군 (지금 그대로)', css: '' },
  { name: '가) 대체글꼴 보정 86%', css: 대체글꼴보정 },
  { name: '나) 메뉴 줄바꿈 금지', css: 메뉴줄바꿈금지 },
  { name: '다) 메뉴 여백 축소', css: 메뉴여백축소 },
  { name: '라) 가 + 나', css: 대체글꼴보정 + 메뉴줄바꿈금지 },
];

async function run(browser, css) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 폰트를 늦춘다 — 실제 사용자가 겪는 상황을 만든다
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const isFont = FONT_RE.test(url) || route.request().resourceType() === 'font';
    if (isFont) {
      await new Promise((r) => setTimeout(r, FONT_DELAY_MS));
      return route.continue();
    }
    // 처방을 </head> 앞에 끼워 넣는다
    if (css && route.request().resourceType() === 'document') {
      try {
        const res = await route.fetch();
        const html = await res.text();
        return route.fulfill({
          response: res,
          body: html.replace('</head>', '<style id="처방">' + css + '</style></head>'),
        });
      } catch {
        return route.continue();
      }
    }
    return route.continue();
  });

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

  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(FONT_DELAY_MS + 3500);

  const out = await page.evaluate(() => {
    const nav = document.querySelector('#site-navigation');
    const rows = [...new Set([...document.querySelectorAll('.main-nav > ul > li')].map((li) => Math.round(li.getBoundingClientRect().y)))];
    return {
      cls: window.__cls || 0,
      nav높이: nav ? Math.round(nav.getBoundingClientRect().height) : null,
      메뉴줄수: rows.length,
    };
  });
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  console.log('대상: ' + URL_ARG);
  console.log('조건: 폰트 응답을 ' + FONT_DELAY_MS + 'ms 늦춰 실제 상황을 재현\n');

  for (const c of CANDIDATES) {
    const a = await run(browser, c.css);
    const b = await run(browser, c.css);
    const cls = Math.max(a.cls, b.cls); // 나쁜 쪽을 취한다 — 처방은 최악에서 버텨야 한다
    const mark = cls <= 0.1 ? '✅' : cls <= 0.25 ? '⚠️' : '❌';
    console.log(
      '  ' + mark + ' ' + c.name.padEnd(24) +
      'CLS ' + cls.toFixed(4).padStart(7) +
      '   메뉴 ' + a.메뉴줄수 + '줄, nav ' + a.nav높이 + 'px' +
      '   (2회: ' + a.cls.toFixed(3) + ', ' + b.cls.toFixed(3) + ')'
    );
  }
  await browser.close();
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
