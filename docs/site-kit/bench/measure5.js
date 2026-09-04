/**
 * 5차 — 1차에서 놓쳤거나 잘못 잰 것을 다시 잰다.
 *
 * 왜 다시 재나 (2026-08-27):
 *  ① 카드 그리드를 "세로 한 줄"로 잘못 봤다. 실제 화면은 2열 지그재그다.
 *  ② "카드 제목 40px/60px/700" 은 오측 의심 — querySelectorAll('a') 의 첫 링크에서
 *     뽑았는데 그게 대표글 제목 링크였을 가능성이 크다. 정확한 선택자로 다시 잰다.
 *  ③ hover 시 박스가 커지는 게 형제를 미는지 잘리는지 — 1차에서 안 쟀다.
 *     목록 전체 높이를 hover 전후로 재서 결론을 낸다.
 *  ④ 배지·작성자·패널 등 세부 요소는 아예 안 쟀다.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const URL = process.argv[2] || 'https://the-edit.co.kr/';

const T = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'fontStyle'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  // 지연 로딩 카드까지 나오게 한 번 훑고 돌아온다
  await page.evaluate(async () => {
    for (let y = 0; y < 4000; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 220)); }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1500);

  const out = await page.evaluate((TT) => {
    const g = (el) => (el ? getComputedStyle(el) : null);
    const pick = (el, keys) => { const s = g(el); if (!s) return null; const o = {}; for (const k of keys) o[k] = s[k]; return o; };
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
    const name = (el) => el ? (el.tagName + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 3).join('.') : '')).slice(0, 60) : null;

    // ── ① 카드 그리드 기하 ────────────────────────────────
    const cards = [...document.querySelectorAll('.loop')].slice(0, 8);
    const cardGeom = cards.map((el, i) => ({ i, sel: name(el), ...rect(el) }));
    const listWrap = cards[0] ? cards[0].parentElement : null;
    const wrapStyle = listWrap ? {
      sel: name(listWrap), ...rect(listWrap),
      display: g(listWrap).display, gridTemplateColumns: g(listWrap).gridTemplateColumns,
      columnGap: g(listWrap).columnGap, rowGap: g(listWrap).rowGap, gap: g(listWrap).gap,
      flexWrap: g(listWrap).flexWrap, columnCount: g(listWrap).columnCount, alignItems: g(listWrap).alignItems,
      paddingLeft: g(listWrap).paddingLeft, paddingRight: g(listWrap).paddingRight,
    } : null;
    // 열 개수 = 서로 다른 x 값의 수
    const xs = [...new Set(cardGeom.map((c) => c.x))].sort((a, b) => a - b);

    // ── ② 카드 내부 타이포 (정확한 선택자로) ──────────────
    const c0 = cards[0];
    const q = (sel) => (c0 ? c0.querySelector(sel) : null);
    const cardParts = c0 ? {
      title: { sel: name(q('h3, h2, .title')), typo: pick(q('h3, h2, .title'), TT), rect: rect(q('h3, h2, .title')) },
      titleLink: { typo: pick(q('h3 a, h2 a, .title a'), TT) },
      sub: { sel: name(q('p')), typo: pick(q('p'), TT) },
      image: { sel: name(q('.image, figure, .thumb')), rect: rect(q('.image, figure, .thumb')),
               overflow: g(q('.image, figure, .thumb')) && g(q('.image, figure, .thumb')).overflow },
      img: { rect: rect(q('img')) },
      badge: (function () {
        const b = [...c0.querySelectorAll('*')].find((e) => /^(EAT|LIFE|TECH|CULTURE|DRINK|NEWS|리뷰|뉴스)$/i.test((e.innerText || '').trim()));
        return b ? { sel: name(b), text: b.innerText.trim(), typo: pick(b, TT), rect: rect(b),
                     bg: g(b).backgroundColor, padding: g(b).padding, position: g(b).position,
                     radius: g(b).borderRadius, mixBlend: g(b).mixBlendMode } : null;
      })(),
      time: { typo: pick(q('time'), TT) },
      avatar: (function () { const a = q('img.avatar, .author img, [class*=author] img, [class*=writer] img');
        return a ? { rect: rect(a), radius: g(a).borderRadius } : null; })(),
    } : null;

    // ── ③ 대표글 세부 ─────────────────────────────────────
    const feat = document.querySelector('.loop-home-featured');
    const featParts = feat ? {
      rect: rect(feat), overflow: g(feat).overflow, bg: g(feat).backgroundColor,
      kicker: pick(feat.querySelector('h3, .cat, [class*=cat]'), TT),
      title: pick(feat.querySelector('h2'), TT),
      titleRect: rect(feat.querySelector('h2')),
      sub: pick(feat.querySelector('p'), TT),
      time: pick(feat.querySelector('time'), TT),
      after: (function () { const cs = getComputedStyle(feat, '::after');
        return { content: cs.content, background: cs.backgroundColor, opacity: cs.opacity, transform: cs.transform, inset: cs.inset }; })(),
      avatar: (function () { const a = feat.querySelector('img[class*=avatar], [class*=author] img, [class*=writer] img');
        return a ? { rect: rect(a), radius: getComputedStyle(a).borderRadius } : null; })(),
      imgRect: rect(feat.querySelector('.image img, img')),
    } : null;

    // ── ⑥ .image 가 성장을 자르는가 ───────────────────────
    const imageBox = c0 ? c0.querySelector('.image, .thumb, figure') : null;
    const clipInfo = imageBox ? { overflow: g(imageBox).overflow, overflowX: g(imageBox).overflowX, position: g(imageBox).position, h: rect(imageBox).h } : null;

    return {
      viewport: { w: innerWidth, h: innerHeight },
      cardGeom, wrapStyle, columnXs: xs, columnCount: xs.length,
      cardParts, featParts, clipInfo,
      listHeightBefore: document.documentElement.scrollHeight,
      panel: (function () { const p = document.querySelector('.panel'); if (!p) return null;
        const a = p.querySelector('a');
        return { width: g(p).width, bg: g(p).backgroundColor, linkTypo: pick(a, TT), padding: g(p).padding }; })(),
    };
  }, T);

  // ── ③ hover 가 형제를 미는가 — 목록 전체 높이를 전후로 잰다 ──
  const listH = () => page.evaluate(() => {
    const c = document.querySelector('.loop');
    const wrap = c ? c.parentElement : null;
    return {
      docH: document.documentElement.scrollHeight,
      wrapH: wrap ? Math.round(wrap.getBoundingClientRect().height) : null,
      card0: Math.round(document.querySelectorAll('.loop')[0].getBoundingClientRect().height),
      card1: document.querySelectorAll('.loop')[1] ? Math.round(document.querySelectorAll('.loop')[1].getBoundingClientRect().top) : null,
      img0: (function () { const i = document.querySelector('.loop img'); const r = i.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })(),
    };
  });
  const before = await listH();
  const el = await page.$('.loop img');
  if (el) { await el.hover(); await page.waitForTimeout(1100); }
  const after = await listH();
  await page.mouse.move(0, 0); await page.waitForTimeout(900);

  const result = { url: URL, ...out, pushTest: { before, after,
    결론: before.wrapH === after.wrapH && before.card0 === after.card0
      ? '형제를 밀지 않는다 — 부모가 자른다(레이아웃 불변)'
      : '형제를 민다 — 레이아웃이 실제로 변한다' } };

  await page.screenshot({ path: path.join(OUT, 'grid-desktop.png') });
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report5.json'), JSON.stringify(result, null, 2), 'utf-8');

  console.log('열 개수:', result.columnCount, '/ 열 x좌표:', result.columnXs.join(', '));
  console.log('카드 기하:'); result.cardGeom.forEach((c) => console.log('  ', JSON.stringify(c)));
  console.log('래퍼:', JSON.stringify(result.wrapStyle));
  console.log('카드 제목:', JSON.stringify(result.cardParts && result.cardParts.title));
  console.log('배지:', JSON.stringify(result.cardParts && result.cardParts.badge));
  console.log('밀기 테스트:', result.pushTest.결론);
  console.log('  전:', JSON.stringify(before), '\n  후:', JSON.stringify(after));
  console.log('→ report5.json');
})();
