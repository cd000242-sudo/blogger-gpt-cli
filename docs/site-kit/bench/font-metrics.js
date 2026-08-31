#!/usr/bin/env node
/**
 * 대체글꼴 보정값 실측 — size-adjust 를 짐작하지 않는다.
 *
 * Pretendard 가 늦게 오는 동안 대체글꼴이 더 넓어서 제목이 한 줄 더 접힌다.
 * 대체글꼴을 Pretendard 와 같은 너비로 눌러 두면 줄바꿈이 안 바뀌고, 밀림이 사라진다.
 *
 * 눌러야 할 비율 = Pretendard 글자폭 ÷ 대체글꼴 글자폭.
 * 그 값을 실제 사이트 제목 문자열로 잰다.
 *
 * 사용: node docs/site-kit/bench/font-metrics.js <url>
 */
const { chromium } = require('playwright');

const URL_ARG = process.argv[2] || 'https://leadernam.com/';

const FALLBACKS = ['Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL_ARG, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(4000);

  const result = await page.evaluate((fallbacks) => {
    const titleEl = document.querySelector('.main-title, .site-title');
    const 제목 = (titleEl ? titleEl.textContent : '').trim();
    const 본문 = (document.querySelector('p') ? document.querySelector('p').textContent : '').trim().slice(0, 60);
    const 표본 = [제목, 본문 || '보험금 지원금 환급 신청 기준과 절차 안내'].filter(Boolean);

    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d');

    const 폭 = (family, text) => {
      ctx2d.font = '100px "' + family + '"';
      return ctx2d.measureText(text).width;
    };

    const 있나 = (family) => {
      try { return document.fonts.check('100px "' + family + '"'); } catch { return false; }
    };

    const rows = [];
    for (const fb of fallbacks) {
      const perSample = 표본.map((t) => {
        const p = 폭('Pretendard Variable', t);
        const f = 폭(fb, t);
        return f > 0 ? p / f : null;
      }).filter((r) => r !== null);
      const 평균 = perSample.length ? perSample.reduce((a, b) => a + b, 0) / perSample.length : null;
      rows.push({ 대체글꼴: fb, 설치됨: 있나(fb), 비율: 평균 });
    }

    return { 제목, 표본수: 표본.length, rows };
  }, FALLBACKS);

  await browser.close();

  console.log('사이트 제목: "' + result.제목 + '"');
  console.log('표본 ' + result.표본수 + '개로 잰 글자폭 비율 (Pretendard ÷ 대체글꼴)\n');

  for (const r of result.rows) {
    if (r.비율 === null) { console.log('  ' + r.대체글꼴.padEnd(22) + '측정 불가'); continue; }
    const pct = (r.비율 * 100).toFixed(1);
    console.log(
      '  ' + r.대체글꼴.padEnd(22) +
      'size-adjust: ' + pct + '%' +
      (r.설치됨 ? '   (이 기기에 설치됨)' : '')
    );
  }

  const 유효 = result.rows.filter((r) => r.비율 !== null && r.설치됨);
  if (유효.length) {
    const 평균 = 유효.reduce((a, r) => a + r.비율, 0) / 유효.length;
    console.log('\n실제로 쓰일 대체글꼴 기준 권장값: size-adjust: ' + (평균 * 100).toFixed(0) + '%');
  }
})().catch((e) => {
  console.error('❌ 실패:', e.message);
  process.exit(1);
});
