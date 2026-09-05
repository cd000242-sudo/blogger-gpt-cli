/** 브라우저가 실제로 그린 글자로 "마침표 뒤 붙음" 을 판정한다 — HTML 추측이 아니라 innerText */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 60000 });
  const out = await p.evaluate(() => {
    const el = document.querySelector('.entry-content');
    const t = el.innerText.replace(/\u00a0/g, ' ');
    const hits = [...t.matchAll(/[.!?][가-힣]/g)].map((m) => t.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, '⏎'));
    return { len: t.length, count: hits.length, hits: hits.slice(0, 6) };
  });
  console.log('브라우저가 그린 글자 수:', out.len);
  console.log('마침표 뒤 붙음:', out.count, '건');
  out.hits.forEach((h) => console.log('   …' + h + '…'));
  await b.close();
})();
