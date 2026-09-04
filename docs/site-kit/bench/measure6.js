/**
 * 6차 — 실측서 §10 "아직 안 잰 것" 을 지운다.
 *
 *  A) 배지(EAT/LIFE 라벨) — measure5 의 선택자가 배지가 아니라 부모 앵커(a.image)를 집었다.
 *     목업의 배지는 스크린샷을 보고 만든 것이라 **실측이 아니다**. 제대로 다시 잰다.
 *  B) 카테고리 목록 페이지 — 홈·글 두 장만 쟀다. 목록 페이지 구조는 아예 모른다.
 *  C) 작성자 블록·푸터 세부
 *
 * ⚠️ 이 스크립트는 브라우저를 띄운다. 전체 jest 게이트와 **절대 같이 돌리지 않는다**
 *    (RAM 15.6GB — 겹치면 시스템이 멈춘다. project-machine-memory-budget 참고).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const T = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color', 'textTransform'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = {};

  await page.goto('https://the-edit.co.kr/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);

  /**
   * ── A) 라벨 두 종류를 **갈라서** 잰다 ────────────────────────
   * 1차 시도(measure5)는 부모 앵커를, 2차 시도는 대표글 머리말을 집었다.
   * 같은 텍스트(EAT/LIFE…)가 두 자리에 다 나오기 때문이다:
   *   · 카드 이미지 위에 얹힌 배지  (.loop .image 안)
   *   · 대표글 제목 위 머리말        (.loop-home-featured .desc 안)
   * 범위를 나눠서 각각 잡는다. "가장 안쪽" 만으로는 어느 쪽인지 구분이 안 된다.
   */
  const LABEL_PROBE = (TT, scope, mustBeInsideImage) => {
    const LABELS = /^(EAT|LIFE|TECH|CULTURE|DRINK|NEWS|STYLE|PLAY)$/i;
    const roots = [...document.querySelectorAll(scope)];
    const hit = [];
    for (const root of roots) {
      [...root.querySelectorAll('*')].forEach((el) => {
        if (!LABELS.test((el.textContent || '').trim())) return;
        if ([...el.children].some((c) => LABELS.test((c.textContent || '').trim()))) return; // 가장 안쪽만
        const inImage = !!el.closest('.image, figure, picture');
        if (mustBeInsideImage !== inImage) return;
        hit.push(el);
      });
    }
    if (!hit.length) return { found: false, scope, mustBeInsideImage };
    const el = hit[0];
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const parent = el.offsetParent || el.parentElement;
    const pr = parent ? parent.getBoundingClientRect() : null;
    return {
      found: true,
      text: el.textContent.trim(),
      selector: (el.tagName + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70),
      typo: (() => { const o = {}; for (const k of TT) o[k] = s[k]; return o; })(),
      background: s.backgroundColor, padding: s.padding, borderRadius: s.borderRadius,
      position: s.position, left: s.left, bottom: s.bottom, top: s.top,
      textShadow: s.textShadow, mixBlendMode: s.mixBlendMode, zIndex: s.zIndex,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      // 이미지 상자 기준으로 어디에 붙어 있나 — 목업이 left:16 bottom:14 로 짐작했었다
      offsetFromParent: pr
        ? { left: Math.round(r.left - pr.left), bottom: Math.round(pr.bottom - r.bottom) }
        : null,
      parent: parent ? (parent.tagName + '.' + String(parent.className || '').trim().split(/\s+/).slice(0, 2).join('.')).slice(0, 60) : null,
      // 이미지 상자를 기준으로 붙은 위치 (목업은 left:16 bottom:14 로 짐작했었다)
      offsetFromImage: (() => {
        const img = el.closest('.image, figure, picture');
        if (!img) return null;
        const ir = img.getBoundingClientRect();
        return { left: Math.round(r.left - ir.left), bottom: Math.round(ir.bottom - r.bottom),
                 imageW: Math.round(ir.width), imageH: Math.round(ir.height),
                 imageOverflow: getComputedStyle(img).overflow };
      })(),
    };
  };

  // 카드 이미지 위 배지 / 대표글 머리말 — 따로 잰다
  out.cardBadge = await page.evaluate(
    ([TT, fn]) => new Function('TT', 'scope', 'mustBeInsideImage', `return (${fn})(TT, scope, mustBeInsideImage)`)(TT, '.loop', true),
    [T, LABEL_PROBE.toString()],
  );
  out.featuredKicker = await page.evaluate(
    ([TT, fn]) => new Function('TT', 'scope', 'mustBeInsideImage', `return (${fn})(TT, scope, mustBeInsideImage)`)(TT, '.loop-home-featured', false),
    [T, LABEL_PROBE.toString()],
  );

  // ── C) 작성자 블록 ────────────────────────────────────────
  out.author = await page.evaluate((TT) => {
    const el = document.querySelector('.loop [class*="author"], .loop [class*="writer"], .loop img[class*="avatar"]');
    if (!el) return { found: false };
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { found: true, selector: el.tagName + '.' + String(el.className).slice(0, 40),
             rect: { w: Math.round(r.width), h: Math.round(r.height) },
             borderRadius: s.borderRadius,
             typo: (() => { const o = {}; for (const k of TT) o[k] = s[k]; return o; })() };
  }, T);

  // ── B) 카테고리 목록 페이지 ───────────────────────────────
  const catUrl = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href]')].find((x) => /\/category\//.test(x.href));
    return a ? a.href : null;
  });
  out.categoryUrl = catUrl;
  if (catUrl) {
    const p2 = await ctx.newPage();
    await p2.goto(catUrl, { waitUntil: 'networkidle', timeout: 90000 });
    await p2.waitForTimeout(1800);
    out.category = await p2.evaluate((TT) => {
      const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const pick = (el) => { if (!el) return null; const s = getComputedStyle(el); const o = {}; for (const k of TT) o[k] = s[k]; return o; };
      const cards = [...document.querySelectorAll('.loop')];
      const geom = cards.slice(0, 8).map((c) => { const r = c.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; });
      const xs = [...new Set(geom.map((c) => c.x))].sort((a, b) => a - b);
      return {
        url: location.href, title: document.title,
        h1: pick(document.querySelector('h1')), h1Text: document.querySelector('h1')?.innerText?.trim().slice(0, 40),
        counts: { h1: document.querySelectorAll('h1').length, cards: cards.length,
                  img: document.querySelectorAll('img').length,
                  imgAlt: document.querySelectorAll('img[alt]:not([alt=""])').length },
        columnXs: xs, columnCount: xs.length, cardGeom: geom,
        cardW: geom[0] ? geom[0].w : null,
        gutter: xs.length >= 2 && geom[0] ? xs[1] - xs[0] - geom[0].w : null,
        bodyBg: g('body').backgroundColor,
        pagination: !!document.querySelector('[class*="pag"], [class*="more"], [class*="load"]'),
        metaDesc: document.querySelector('meta[name=description]')?.content || null,
        canonical: document.querySelector('link[rel=canonical]')?.href || null,
      };
    }, T);
    await p2.screenshot({ path: path.join(OUT, 'category-desktop.png') });
    await p2.screenshot({ path: path.join(OUT, 'category-full.png'), fullPage: true });
    await p2.close();
  }

  // ── 푸터 ──────────────────────────────────────────────────
  out.footer = await page.evaluate((TT) => {
    const f = document.querySelector('footer');
    if (!f) return { found: false };
    const s = getComputedStyle(f);
    const a = f.querySelector('a');
    const r = f.getBoundingClientRect();
    return { found: true, background: s.backgroundColor, padding: s.padding,
             height: Math.round(r.height),
             linkTypo: (() => { if (!a) return null; const cs = getComputedStyle(a); const o = {}; for (const k of TT) o[k] = cs[k]; return o; })(),
             linkCount: f.querySelectorAll('a').length };
  }, T);

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report6.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log('카드 배지:', JSON.stringify(out.cardBadge, null, 1));
  console.log('대표글 머리말:', JSON.stringify(out.featuredKicker && out.featuredKicker.typo));
  console.log('카테고리 URL:', out.categoryUrl);
  console.log('카테고리 그리드:', out.category && JSON.stringify({
    열: out.category.columnCount, x: out.category.columnXs, 폭: out.category.cardW, 거터: out.category.gutter,
  }));
  console.log('푸터:', JSON.stringify(out.footer));
  console.log('→ report6.json');
})();
