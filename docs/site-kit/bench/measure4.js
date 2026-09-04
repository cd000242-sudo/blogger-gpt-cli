/** 4차 — 색. 눈으로 "연두색"이라 적지 않고 rgb 를 센다. + CSS 변수 + 모바일 글페이지 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const scan = () => {
  const count = new Map();
  const add = (k, v) => { if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') return; const m = count.get(v) || { v, n: 0, where: [] }; m.n++; if (m.where.length < 4) m.where.push(k); count.set(v, m); };
  document.querySelectorAll('*').forEach((el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 400) return;
    const tag = (el.tagName + (el.className ? '.' + String(el.className).trim().split(/\s+/)[0] : '')).slice(0, 40);
    add(tag, s.backgroundColor);
  });
  const textCount = new Map();
  document.querySelectorAll('h1,h2,h3,p,a,span,li,time').forEach((el) => {
    if (!el.innerText || !el.innerText.trim()) return;
    const c = getComputedStyle(el).color;
    const m = textCount.get(c) || { v: c, n: 0 }; m.n++; textCount.set(c, m);
  });
  // 테마가 선언한 CSS 변수
  const rootVars = {};
  const rs = getComputedStyle(document.documentElement);
  for (let i = 0; i < rs.length; i++) {
    const p = rs[i];
    if (p.startsWith('--') && !p.startsWith('--bs-')) rootVars[p] = rs.getPropertyValue(p).trim();
  }
  return {
    backgrounds: [...count.values()].sort((a, b) => b.n - a.n).slice(0, 14),
    textColors: [...textCount.values()].sort((a, b) => b.n - a.n).slice(0, 10),
    rootVars,
  };
};

(async () => {
  const browser = await chromium.launch();
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('https://the-edit.co.kr/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1600);
  out.home = await page.evaluate(scan);
  // 카테고리 배지(EAT/LIFE/CULTURE)의 배경·글자
  out.badges = await page.evaluate(() =>
    [...document.querySelectorAll('[class*="cat"], [class*="category"]')].slice(0, 8).map((el) => {
      const s = getComputedStyle(el);
      return { cls: String(el.className).slice(0, 50), text: (el.innerText || '').trim().slice(0, 20), bg: s.backgroundColor, color: s.color, fontSize: s.fontSize, fontWeight: s.fontWeight, padding: s.padding, radius: s.borderRadius, letterSpacing: s.letterSpacing };
    })
  );
  await page.close();

  const p2 = await ctx.newPage();
  await p2.goto('https://the-edit.co.kr/87752', { waitUntil: 'networkidle', timeout: 60000 });
  await p2.waitForTimeout(1600);
  out.article = await p2.evaluate(scan);
  await p2.close();

  // 모바일 글페이지
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const p3 = await mctx.newPage();
  await p3.goto('https://the-edit.co.kr/87752', { waitUntil: 'networkidle', timeout: 60000 });
  await p3.waitForTimeout(1600);
  out.articleMobile = await p3.evaluate(() => {
    const g = (el) => (el ? getComputedStyle(el) : null);
    const T = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];
    const pick = (el) => { const s = g(el); if (!s) return null; const o = {}; for (const k of T) o[k] = s[k]; return o; };
    let best = null, n = 0;
    document.querySelectorAll('div,article,section').forEach((el) => { const c = el.querySelectorAll(':scope > p').length; if (c > n) { n = c; best = el; } });
    const b = best || document.body;
    const r = b.getBoundingClientRect();
    const img = b.querySelector('img');
    return {
      h1: pick(document.querySelector('h1')), h2: pick(b.querySelector('h2')),
      p: pick([...b.querySelectorAll(':scope > p')].find((x) => x.innerText.trim().length > 30)),
      contentWidth: Math.round(r.width), contentX: Math.round(r.x),
      imgWidth: img ? Math.round(img.getBoundingClientRect().width) : null,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    };
  });
  await p3.screenshot({ path: path.join(OUT, 'article-mobile.png') });
  await p3.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report4.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log(JSON.stringify(out.home.backgrounds.slice(0, 8), null, 1));
  console.log('TEXT', JSON.stringify(out.home.textColors.slice(0, 5)));
  console.log('MOBILE ARTICLE', JSON.stringify(out.articleMobile, null, 1));
})();
