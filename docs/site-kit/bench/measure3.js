/**
 * 3차 — 글 페이지. 2차에서 링크 정규식이 0건이라 못 열었다.
 * 이번엔 카드 앵커에서 직접 주소를 꺼낸다(추측 금지).
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
  await page.goto('https://the-edit.co.kr/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);

  const hrefs = await page.evaluate(() =>
    [...new Set(
      [...document.querySelectorAll('.loop a[href], .loop-home-featured a[href], article a[href]')]
        .map((a) => a.href)
        .filter((h) => h.startsWith('https://the-edit.co.kr/') && !/\/category\/|\/tag\/|\/author\/|#/.test(h))
    )]
  );
  const out = { hrefs: hrefs.slice(0, 20) };

  const url = hrefs[0];
  out.articleUrl = url || null;
  if (url) {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await p.waitForTimeout(1800);
    out.article = await p.evaluate(() => {
      const gs = (el) => (el ? getComputedStyle(el) : null);
      const T = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'color'];
      const pick = (el) => { const s = gs(el); if (!s) return null; const o = {}; for (const k of T) o[k] = s[k]; return o; };

      // 본문 컨테이너를 이름이 아니라 "문단이 가장 많이 든 블록"으로 찾는다
      let best = null, bestN = 0;
      document.querySelectorAll('div, article, section, main').forEach((el) => {
        const n = el.querySelectorAll(':scope > p').length;
        if (n > bestN) { bestN = n; best = el; }
      });
      const body = best || document.body;
      const paras = [...body.querySelectorAll(':scope > p')].filter((x) => x.innerText.trim().length > 30);
      const gaps = [];
      for (let i = 1; i < Math.min(paras.length, 10); i++)
        gaps.push(Math.round(paras[i].getBoundingClientRect().top - paras[i - 1].getBoundingClientRect().bottom));
      const r = body.getBoundingClientRect();
      const h1 = document.querySelector('h1');
      const imgs = [...body.querySelectorAll('img')];
      const figs = [...body.querySelectorAll('figure')];
      const s = gs(body);
      return {
        url: location.href, title: document.title,
        containerSelector: (body.tagName + '.' + String(body.className || '').trim().split(/\s+/).slice(0, 3).join('.')).slice(0, 80),
        h1Text: h1 && h1.innerText.trim().slice(0, 80),
        counts: {
          h1: document.querySelectorAll('h1').length,
          h2: body.querySelectorAll('h2').length, h3: body.querySelectorAll('h3').length,
          paragraphs: paras.length, img: imgs.length, imgAlt: imgs.filter((i) => i.alt && i.alt.trim()).length,
          figure: figs.length, figcaption: body.querySelectorAll('figcaption').length,
          internalLinks: [...document.querySelectorAll('a[href]')].filter((a) => a.hostname === location.hostname).length,
          outboundLinks: [...document.querySelectorAll('a[href]')].filter((a) => a.hostname && a.hostname !== location.hostname).length,
        },
        typo: { h1: pick(h1), h2: pick(body.querySelector('h2')), h3: pick(body.querySelector('h3')),
                p: pick(paras[0]), figcaption: pick(body.querySelector('figcaption')), strong: pick(body.querySelector('strong')) },
        contentBox: { width: Math.round(r.width), x: Math.round(r.x), maxWidth: s.maxWidth,
                      padLeft: s.paddingLeft, padRight: s.paddingRight, marginLeft: s.marginLeft },
        firstImageWidth: imgs[0] ? Math.round(imgs[0].getBoundingClientRect().width) : null,
        paraGaps: gaps,
        pageBg: gs(document.body).backgroundColor,
        charCount: (body.innerText || '').replace(/\s+/g, ' ').trim().length,
        canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
        metaDesc: (document.querySelector('meta[name=description]') || {}).content || null,
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((x) => {
          try { const j = JSON.parse(x.textContent); return j['@type'] || (j['@graph'] || []).map((g) => g['@type']); }
          catch (e) { return 'parse-error'; }
        }),
        relatedBlock: !!document.querySelector('[class*="related"], [class*="recommend"]'),
        shareBlock: !!document.querySelector('[class*="share"], [class*="sns"]'),
        authorBlock: !!document.querySelector('[class*="author"], [class*="writer"], [rel="author"]'),
      };
    });
    await p.screenshot({ path: path.join(OUT, 'article-top.png') });
    await p.evaluate(() => window.scrollTo(0, 1600));
    await p.waitForTimeout(1200);
    await p.screenshot({ path: path.join(OUT, 'article-mid.png') });
    await p.screenshot({ path: path.join(OUT, 'article-full.png'), fullPage: true });
    await p.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report3.json'), JSON.stringify(out, null, 2), 'utf-8');
  console.log('article:', out.articleUrl);
  console.log(JSON.stringify(out.article && { counts: out.article.counts, box: out.article.contentBox, gaps: out.article.paraGaps }, null, 1));
})();
