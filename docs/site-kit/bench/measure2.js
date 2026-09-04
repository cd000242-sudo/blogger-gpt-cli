/**
 * 2차 실측 — CSS에 안 적혀 있는 것들. 굴려 봐야만 알 수 있다.
 *  A) 글 페이지 본문 타이포·폭·간격 (사이트 스펙에 실제로 필요한 값)
 *  B) GSAP ScrollTrigger 가 무엇을 움직이는가 — 스크롤 구간마다 transform/opacity 를 찍어 비교
 *  C) 햄버거 패널 열기 — 무엇이 어떻게 들어오는가
 *  D) 카드 hover 실제 전후 (진짜 마우스를 올린다)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const result = {};

  // ── 홈에서 글 주소를 실제로 주워 온다 (추측 금지) ──────────
  await page.goto('https://the-edit.co.kr/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const links = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href]')]
      .map((a) => a.href)
      .filter((h) => h.startsWith('https://the-edit.co.kr/') && /\/\d{4}\/|\/[a-z-]+\/[^/]+\/$/.test(h))
    )].slice(0, 40)
  );
  result.sampledLinks = links;

  // ── B) GSAP 스크롤 — 구간별로 같은 요소를 다시 잰다 ────────
  const scrollProbe = async (y) => {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(1100);
    return await page.evaluate(() => {
      const out = [];
      const els = [...document.querySelectorAll('.loop, .loop-home-featured, section, [class*="scroll"], [class*="pin"], .swiper')].slice(0, 14);
      for (const el of els) {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out.push({
          sel: (el.tagName + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70),
          transform: s.transform, opacity: s.opacity, position: s.position, willChange: s.willChange,
          top: Math.round(r.top), h: Math.round(r.height),
        });
      }
      return { scrollY: Math.round(window.scrollY), els: out };
    });
  };
  result.gsapScroll = [];
  for (const y of [0, 600, 1400, 2200]) result.gsapScroll.push(await scrollProbe(y));

  // GSAP 이 실제로 등록한 ScrollTrigger 목록 — 라이브러리에 직접 물어본다
  result.scrollTriggers = await page.evaluate(() => {
    const g = window.gsap, ST = window.ScrollTrigger;
    if (!ST || !ST.getAll) return { available: false, gsap: !!g };
    return {
      available: true,
      gsapVersion: g && g.version,
      count: ST.getAll().length,
      list: ST.getAll().slice(0, 20).map((t) => ({
        trigger: t.trigger ? (t.trigger.tagName + '.' + String(t.trigger.className || '').trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 70) : null,
        start: t.start, end: t.end, pin: !!t.pin, scrub: t.vars && t.vars.scrub, toggleActions: t.vars && t.vars.toggleActions,
      })),
    };
  });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);

  // ── C) 햄버거 패널 ────────────────────────────────────────
  const panelBefore = await page.evaluate(() => {
    const p = document.querySelector('.panel');
    if (!p) return null;
    const s = getComputedStyle(p);
    return { transform: s.transform, transition: s.transition, width: s.width, background: s.backgroundColor, visibility: s.visibility, zIndex: s.zIndex };
  });
  let panelAfter = null, panelShot = false;
  const burger = await page.$('header button, .btn-menu, [class*="hamburger"], [class*="menu-toggle"], header a[class*="menu"]');
  if (burger) {
    await burger.click().catch(() => {});
    await page.waitForTimeout(1200);
    panelAfter = await page.evaluate(() => {
      const p = document.querySelector('.panel');
      if (!p) return null;
      const s = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      return { transform: s.transform, width: s.width, background: s.backgroundColor, visibility: s.visibility, x: Math.round(r.x), classes: document.body.className };
    });
    await page.screenshot({ path: path.join(OUT, 'panel-open.png') });
    panelShot = true;
  }
  result.panel = { before: panelBefore, after: panelAfter, burgerFound: !!burger, shot: panelShot };

  // ── A) 글 페이지 ──────────────────────────────────────────
  const article = links.find((h) => !/\/category\/|\/tag\/|\/author\//.test(h));
  result.articleUrl = article || null;
  if (article) {
    const p2 = await ctx.newPage();
    await p2.goto(article, { waitUntil: 'networkidle', timeout: 60000 });
    await p2.waitForTimeout(1500);
    result.article = await p2.evaluate(() => {
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const T = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];
      const pick = (el) => { const s = cs(el); if (!s) return null; const o = {}; for (const k of T) o[k] = s[k]; return o; };
      const body = document.querySelector('.entry-content, article .content, main article') || document.body;
      const paras = [...body.querySelectorAll('p')].filter((x) => x.innerText.trim().length > 40);
      const gaps = [];
      for (let i = 1; i < Math.min(paras.length, 8); i++)
        gaps.push(Math.round(paras[i].getBoundingClientRect().top - paras[i - 1].getBoundingClientRect().bottom));
      const r = body.getBoundingClientRect();
      const h1 = document.querySelector('h1');
      const imgs = [...body.querySelectorAll('img')];
      return {
        url: location.href, title: document.title,
        h1Text: h1 && h1.innerText.slice(0, 80),
        counts: { h1: document.querySelectorAll('h1').length, h2: body.querySelectorAll('h2').length, h3: body.querySelectorAll('h3').length,
                  p: paras.length, img: imgs.length, imgAlt: imgs.filter((i) => i.alt && i.alt.trim()).length,
                  internal: [...document.querySelectorAll('a[href]')].filter((a) => a.hostname === location.hostname).length },
        typo: { h1: pick(h1), h2: pick(body.querySelector('h2')), p: pick(paras[0]), figcaption: pick(body.querySelector('figcaption')) },
        contentBox: { width: Math.round(r.width), x: Math.round(r.x), maxWidth: cs(body).maxWidth, padding: cs(body).paddingLeft + ' / ' + cs(body).paddingRight },
        paraGaps: gaps,
        pageBg: cs(document.body).backgroundColor,
        wordCount: (body.innerText || '').replace(/\s+/g, ' ').trim().split(' ').length,
        canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
        metaDesc: (document.querySelector('meta[name=description]') || {}).content || null,
        jsonLdTypes: [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((s) => { try { const j = JSON.parse(s.textContent); return j['@type'] || (j['@graph'] || []).map((g) => g['@type']); } catch (e) { return 'parse-error'; } }),
      };
    });
    await p2.screenshot({ path: path.join(OUT, 'article-desktop.png') });
    await p2.screenshot({ path: path.join(OUT, 'article-desktop-full.png'), fullPage: true });
    await p2.close();
  }

  // ── D) 카드 hover 진짜로 ──────────────────────────────────
  const p3 = await ctx.newPage();
  await p3.goto('https://the-edit.co.kr/', { waitUntil: 'networkidle', timeout: 60000 });
  await p3.waitForTimeout(1500);
  result.cardHover = await (async () => {
    const card = await p3.$('.loop .image img, .loop img');
    if (!card) return { found: false };
    const read = () => p3.evaluate(() => {
      const el = document.querySelector('.loop .image img, .loop img');
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { transform: s.transform, width: Math.round(r.width), height: Math.round(r.height), transition: s.transition, filter: s.filter };
    });
    const before = await read();
    await card.hover();
    await p3.waitForTimeout(1000);
    const after = await read();
    return { found: true, before, after };
  })();
  await p3.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report2.json'), JSON.stringify(result, null, 2), 'utf-8');
  console.log('article:', result.articleUrl);
  console.log('scrollTriggers:', JSON.stringify(result.scrollTriggers && { available: result.scrollTriggers.available, count: result.scrollTriggers.count, v: result.scrollTriggers.gsapVersion }));
  console.log('cardHover:', JSON.stringify(result.cardHover));
  console.log('→ report2.json');
})();
