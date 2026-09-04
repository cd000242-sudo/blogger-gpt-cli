/**
 * 벤치마크 사이트 실측 — 추측 금지. 브라우저로 열어서 계산값을 그대로 받아 적는다.
 *
 * 재는 것:
 *  1) 무슨 테마·플러그인으로 만들었나 (generator, 스타일시트 경로, 폰트 파일)
 *  2) 타이포 — 실제 computed font-family / size / line-height / letter-spacing
 *  3) 색 — 배경·글자·링크·헤더·버튼 (rgb 그대로)
 *  4) 레이아웃 — 본문 폭, 좌우 여백, 섹션 간격
 *  5) 애니메이션 — transition / animation / @keyframes 전수, 헤더 스크롤 반응, hover 전후 차이
 *  6) 데스크톱/모바일 각각
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const TARGETS = process.argv.slice(2);
if (!TARGETS.length) {
  console.error('usage: node measure.js <url> [url...]');
  process.exit(1);
}

const px = (v) => (typeof v === 'string' ? v : String(v));

async function probe(page) {
  return await page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const pick = (el, keys) => {
      const s = cs(el);
      if (!s) return null;
      const o = {};
      for (const k of keys) o[k] = s[k];
      return o;
    };
    const TYPO = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];
    const BOX = ['width', 'maxWidth', 'paddingLeft', 'paddingRight', 'marginTop', 'marginBottom', 'backgroundColor'];

    // ── 1. 무엇으로 만들었나 ────────────────────────────────
    const meta = {};
    document.querySelectorAll('meta[name], meta[property]').forEach((m) => {
      const k = m.getAttribute('name') || m.getAttribute('property');
      if (/generator|viewport|theme-color|description/i.test(k)) meta[k] = m.getAttribute('content');
    });
    const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.href);
    const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.src);

    // ── 2. 폰트 — 실제 로드된 파일까지 ──────────────────────
    const fontFaces = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; } // CORS
      if (!rules) continue;
      for (const r of rules) {
        if (r.constructor && r.constructor.name === 'CSSFontFaceRule') {
          fontFaces.push({ family: r.style.fontFamily, src: (r.style.src || '').slice(0, 300), weight: r.style.fontWeight, display: r.style.fontDisplay });
        }
      }
    }

    // ── 3. 애니메이션 전수 ─────────────────────────────────
    const transitions = new Map();
    const animations = new Map();
    const keyframes = [];
    const walk = (rules, sheetHref) => {
      for (const r of rules) {
        const n = r.constructor && r.constructor.name;
        if (n === 'CSSKeyframesRule') {
          keyframes.push({
            name: r.name,
            steps: [...r.cssRules].map((k) => `${k.keyText} { ${k.style.cssText} }`).join('  '),
            from: sheetHref,
          });
        } else if (n === 'CSSMediaRule' || n === 'CSSSupportsRule') {
          walk(r.cssRules, sheetHref);
        } else if (r.style) {
          const t = r.style.transition || r.style.transitionProperty;
          if (t && t !== 'all 0s ease 0s' && t !== 'none') {
            const key = `${r.selectorText} :: ${t}`;
            if (!transitions.has(key)) transitions.set(key, { selector: r.selectorText, transition: t, from: sheetHref });
          }
          const a = r.style.animation || r.style.animationName;
          if (a && a !== 'none') {
            const key = `${r.selectorText} :: ${a}`;
            if (!animations.has(key)) animations.set(key, { selector: r.selectorText, animation: a, from: sheetHref });
          }
        }
      }
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) continue;
      walk(rules, sheet.href || '(inline)');
    }

    // ── 4. 실제 요소들 ─────────────────────────────────────
    const body = document.body;
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    const p = [...document.querySelectorAll('p')].find((el) => el.innerText.trim().length > 60);
    const a = [...document.querySelectorAll('a')].find((el) => el.innerText.trim().length > 1);
    const header = document.querySelector('header, .site-header, #masthead, [class*="header"]');
    const nav = document.querySelector('nav, .main-navigation, #site-navigation');
    const footer = document.querySelector('footer, .site-footer, #colophon');
    // 본문 컨테이너 후보 — 폭이 가장 안정적인 래퍼
    const containerEl =
      document.querySelector('.site-content .entry-content, .entry-content, main article, main .container, .grid-container, main') || body;

    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };

    // 본문 문단 사이 실제 간격
    const paras = [...document.querySelectorAll('.entry-content p, main p, article p')].slice(0, 6);
    const paraGaps = [];
    for (let i = 1; i < paras.length; i++) {
      const prev = paras[i - 1].getBoundingClientRect();
      const cur = paras[i].getBoundingClientRect();
      paraGaps.push(Math.round(cur.top - prev.bottom));
    }

    return {
      url: location.href,
      title: document.title,
      meta,
      stylesheets,
      scripts: scripts.filter((s) => !/google|gtag|adsbygoogle|analytics/i.test(s)),
      thirdParty: scripts.filter((s) => /google|gtag|adsbygoogle|analytics/i.test(s)).length,
      fontFaces,
      typo: {
        body: pick(body, TYPO),
        h1: pick(h1, TYPO),
        h2: pick(h2, TYPO),
        p: pick(p, TYPO),
        link: pick(a, TYPO),
      },
      layout: {
        html: pick(document.documentElement, ['backgroundColor']),
        body: pick(body, BOX),
        container: { box: pick(containerEl, BOX), rect: rect(containerEl), selector: containerEl.className || containerEl.tagName },
        header: { box: pick(header, ['height', 'backgroundColor', 'position', 'boxShadow', 'borderBottom', 'paddingTop', 'paddingBottom']), rect: rect(header) },
        nav: { box: pick(nav, ['display', 'gap', 'fontSize']), rect: rect(nav) },
        footer: { box: pick(footer, ['backgroundColor', 'paddingTop', 'paddingBottom']), rect: rect(footer) },
        paraGaps,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        docHeight: document.documentElement.scrollHeight,
      },
      motion: {
        transitions: [...transitions.values()].slice(0, 80),
        animations: [...animations.values()].slice(0, 40),
        keyframes: keyframes.slice(0, 30),
        transitionCount: transitions.size,
        keyframeCount: keyframes.length,
      },
      counts: {
        h1: document.querySelectorAll('h1').length,
        h2: document.querySelectorAll('h2').length,
        h3: document.querySelectorAll('h3').length,
        img: document.querySelectorAll('img').length,
        imgWithAlt: document.querySelectorAll('img[alt]:not([alt=""])').length,
        internalLinks: [...document.querySelectorAll('a[href]')].filter((x) => x.hostname === location.hostname).length,
      },
    };
  });
}

/** 헤더가 스크롤에 반응하는가 — 추측하지 말고 스크롤해서 전후를 비교한다 */
async function probeScroll(page) {
  const sel = await page.evaluate(() => {
    const h = document.querySelector('header, .site-header, #masthead');
    if (!h) return null;
    if (h.id) return '#' + h.id;
    if (h.className) return h.tagName.toLowerCase() + '.' + String(h.className).trim().split(/\s+/).join('.');
    return h.tagName.toLowerCase();
  });
  if (!sel) return { header: null };
  const snap = () =>
    page.evaluate((s) => {
      const h = document.querySelector(s);
      if (!h) return null;
      const cs = getComputedStyle(h);
      const r = h.getBoundingClientRect();
      return {
        position: cs.position, top: cs.top, height: Math.round(r.height), y: Math.round(r.y),
        background: cs.backgroundColor, shadow: cs.boxShadow, transform: cs.transform, opacity: cs.opacity,
        transition: cs.transition, classes: h.className,
      };
    }, sel);

  const before = await snap();
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(900);
  const after = await snap();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const back = await snap();
  return { selector: sel, before, afterScroll800: after, backToTop: back };
}

/** hover 전후 실제 차이 — "링크에 밑줄이 생긴다" 같은 걸 눈이 아니라 값으로 */
async function probeHover(page) {
  return await page.evaluate(async () => {
    const out = [];
    const targets = [
      ['본문 링크', '.entry-content a, article a, main a'],
      ['메뉴 링크', 'nav a, .main-navigation a'],
      ['카드/글목록', 'article a[href], .post a[href], [class*="card"] a'],
      ['버튼', 'button, .button, .wp-block-button__link, [class*="btn"]'],
    ];
    const read = (el) => {
      const s = getComputedStyle(el);
      return {
        color: s.color, background: s.backgroundColor, textDecoration: s.textDecorationLine,
        transform: s.transform, boxShadow: s.boxShadow, opacity: s.opacity, borderColor: s.borderColor,
        transition: s.transition,
      };
    };
    for (const [label, sel] of targets) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ label, sel, found: false }); continue; }
      const before = read(el);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      // :hover 는 합성 이벤트로 안 걸린다 — CSS 규칙에서 직접 캐낸다
      const hoverRules = [];
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (const r of rules) {
          if (!r.selectorText || !/:hover/.test(r.selectorText)) continue;
          const base = r.selectorText.replace(/:hover/g, '');
          try { if (el.matches(base.split(',')[0].trim())) hoverRules.push(`${r.selectorText} { ${r.style.cssText} }`); } catch (e) {}
        }
      }
      out.push({ label, sel, found: true, before, hoverRules: hoverRules.slice(0, 6) });
    }
    return out;
  });
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const url of TARGETS) {
    const host = new URL(url).hostname.replace(/\W/g, '_');
    const slug = host + (new URL(url).pathname.replace(/\W/g, '_').slice(0, 40) || '');
    report[url] = {};
    for (const [device, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({
        viewport,
        deviceScaleFactor: 1,
        userAgent: device === 'mobile'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : undefined,
        isMobile: device === 'mobile',
        hasTouch: device === 'mobile',
      });
      const page = await ctx.newPage();
      const t0 = Date.now();
      let status = null;
      try {
        const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        status = resp && resp.status();
      } catch (e) {
        try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = 'domcontentloaded-fallback'; }
        catch (e2) { report[url][device] = { error: String(e2).slice(0, 300) }; await ctx.close(); continue; }
      }
      await page.waitForTimeout(1500);
      const data = await probe(page);
      data.httpStatus = status;
      data.loadMs = Date.now() - t0;
      data.scroll = await probeScroll(page);
      if (device === 'desktop') data.hover = await probeHover(page);
      await page.screenshot({ path: path.join(OUT, `${slug}-${device}.png`), fullPage: false });
      await page.screenshot({ path: path.join(OUT, `${slug}-${device}-full.png`), fullPage: true });
      report[url][device] = data;
      await ctx.close();
      console.log(`✔ ${url} [${device}] ${status} ${data.loadMs}ms`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log('\n→ ' + path.join(OUT, 'report.json'));
})();
