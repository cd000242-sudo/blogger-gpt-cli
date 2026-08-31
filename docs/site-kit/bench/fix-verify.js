#!/usr/bin/env node
/**
 * 최종 처방 검증 — 사장님께 드리는 CSS 파일 그대로를 홈·글 양쪽에 적용해 잰다.
 *
 * 시험한 것과 드리는 것이 다르면 검증이 아니다. 그래서 이 스크립트는
 * fix-cls.css 파일을 읽어서 쓴다. 파일을 고치면 검증도 같이 바뀐다.
 *
 * 사용: node docs/site-kit/bench/fix-verify.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, 'fix-cls.css'), 'utf8');
const CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'));
const FONT_RE = /jsdelivr|fonts\.(googleapis|gstatic)/i;
const FONT_DELAY_MS = 2500;

async function run(browser, url, applyFix) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.route('**/*', async (route) => {
    const isFont = FONT_RE.test(route.request().url()) || route.request().resourceType() === 'font';
    if (isFont) {
      await new Promise((r) => setTimeout(r, FONT_DELAY_MS));
      return route.continue();
    }
    if (applyFix && route.request().resourceType() === 'document') {
      try {
        const res = await route.fetch();
        const html = await res.text();
        return route.fulfill({ response: res, body: html.replace('</head>', '<style>' + CSS + '</style></head>') });
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

  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(FONT_DELAY_MS + 3500);

  const out = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const p = document.querySelector('.entry-content p');
    return {
      cls: window.__cls || 0,
      본문글꼴: body.fontFamily.split(',')[0].replace(/["']/g, ''),
      본문크기: p ? getComputedStyle(p).fontSize : null,
      본문줄높이: p ? getComputedStyle(p).lineHeight : null,
    };
  });
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch();
  console.log('처방: fix-cls.css (' + CSS.split('\n').length + '줄)');
  console.log('조건: 폰트 응답 ' + FONT_DELAY_MS + 'ms 지연\n');

  for (const t of CFG.urls) {
    const before = await run(browser, t.url, false);
    const after = await run(browser, t.url, true);
    const mark = after.cls <= 0.1 ? '✅' : after.cls <= 0.25 ? '⚠️' : '❌';
    console.log('── ' + t.name + ' ──');
    console.log('   CLS  ' + before.cls.toFixed(4) + '  →  ' + after.cls.toFixed(4) + '   ' + mark);
    console.log('   폰트 도착 후 본문: ' + after.본문글꼴 + ' ' + (after.본문크기 || '—') + '/' + (after.본문줄높이 || '—') +
                '   (처방 전: ' + before.본문글꼴 + ' ' + (before.본문크기 || '—') + '/' + (before.본문줄높이 || '—') + ')');
    if (after.본문크기 !== before.본문크기 || after.본문줄높이 !== before.본문줄높이) {
      console.log('   ⚠️ 최종 타이포가 달라졌다 — 처방이 본문 모양을 건드렸다');
    }
  }
  await browser.close();
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
