/**
 * 박스 실측 — 줄 수는 Range 로 세고(블록 요소는 항상 1을 준다), 테두리는 computed 로 본다.
 */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const list = await p.request.get('https://leadernam.com/wp-json/wp/v2/posts?per_page=5&_fields=link,title');
  const posts = await list.json();
  const hit = posts.find((x) => /갈아타기|부결/.test(x.title.rendered)) || posts[0];
  await p.goto(hit.link, { waitUntil: 'networkidle', timeout: 60000 });

  const out = await p.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        bg: cs.backgroundColor,
      };
    };
    const lineCount = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getClientRects().length;   // 줄 상자 수
    };
    return {
      answerBox: pick('section.answer-first'),
      answerLines: lineCount('.answer-first-a'),
      answerBr: document.querySelectorAll('.answer-first-a br').length,
      table: pick('.table-wrapper'),
      quote: pick('blockquote'),
      toc: pick('.toc-grid-container'),
      audience: pick('.audience-block'),
      h2: pick('.white-paper h2') || pick('h2'),
    };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
