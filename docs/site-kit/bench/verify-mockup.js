/**
 * 목업 검증 — 실측서의 숫자가 목업에서 진짜 그 값으로 렌더되는지 잰다.
 * 눈으로 "비슷해 보인다" 대신, the-edit 에서 잰 값과 1:1 로 대조한다.
 *
 * 색은 검증 대상이 아니다 — 색은 일부러 바꿨다(AI 블로그용 전기 보라).
 * 대신 "회색이 없는가", "브랜드 면적이 한 곳인가" 같은 규칙을 본다.
 *
 * 사용: NODE_PATH=<프로젝트>/node_modules BENCH_OUT=<출력폴더> node verify-mockup.js <html경로>
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = 'file:///' + String(process.argv[2] || '').replace(/\\/g, '/');
const OUT = process.env.BENCH_OUT || __dirname;
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* 우리가 정한 팔레트 — 구조는 실측, 색은 교체 */
const PALETTE = { bg: '#F6F5FB', brand: '#5B4BFF', ink: '#0B0A1A' };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1400);

  const got = await page.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const h1 = g('.single-header h1'), h2 = g('.single-content h2');
    const ps = [...document.querySelectorAll('.single-content > p')];
    const p = getComputedStyle(ps[0]);
    // 문단 간격은 **바로 옆에 붙은 p 끼리만** 잰다.
    // 사이에 figure·h2 가 낀 쌍까지 재면 710 같은 값이 나와 거짓 실패가 된다.
    const gaps = [];
    for (let i = 1; i < ps.length; i++) {
      if (ps[i].previousElementSibling !== ps[i - 1]) continue;   // 인접하지 않으면 건너뛴다
      if (ps[i].classList.contains('pull') || ps[i - 1].classList.contains('pull')) continue;
      gaps.push(Math.round(ps[i].getBoundingClientRect().top - ps[i - 1].getBoundingClientRect().bottom));
    }

    // 카드 그리드 기하 — x 좌표로 열을 묶는다 (DOM 순서에 기대지 않는다)
    const cards = [...document.querySelectorAll('.strip:not(.strip--flip) .card')];
    const cg = cards.map((c) => { const r = c.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; });
    const colXs = [...new Set(cg.map((c) => c.x))].sort((a, b) => a - b);
    const col1 = cg.filter((c) => c.x === colXs[0]).sort((a, b) => a.y - b.y);
    const col2 = colXs[1] != null ? cg.filter((c) => c.x === colXs[1]).sort((a, b) => a.y - b.y) : [];
    const gutter = colXs.length >= 2 ? colXs[1] - colXs[0] - col1[0].w : null;
    const stagger = col2.length && col1.length ? col2[0].y - col1[0].y : null;
    const rowGap = col1.length >= 2 ? col1[1].y - (col1[0].y + col1[0].h) : null;

    // 회색이 섞이지 않았는가 — 채도가 아주 낮은 중간 밝기 색을 찾는다
    const grays = [];
    document.querySelectorAll('h1,h2,h3,p,a,span,time,li').forEach((el) => {
      if (!el.innerText || !el.innerText.trim()) return;
      const c = getComputedStyle(el).color;
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) return;
      const [r, gg, b] = [+m[1], +m[2], +m[3]];
      const max = Math.max(r, gg, b), min = Math.min(r, gg, b);
      const lum = (max + min) / 2;
      if (max - min < 22 && lum > 60 && lum < 210) grays.push(c);
    });

    // 한쪽에만 굵게 두른 액센트 바 — AI 가 만든 UI 의 대표적 티다.
    // v3.8.561 에서 결론 블록의 좌측 바를 걷어냈고, 목업에도 다시 새어 들어온 적이 있다.
    const sideBars = [];
    document.querySelectorAll('*').forEach((el) => {
      const s = getComputedStyle(el);
      const sides = [['Left', s.borderLeftWidth, s.borderLeftStyle],
                     ['Right', s.borderRightWidth, s.borderRightStyle]];
      for (const [side, w, style] of sides) {
        const px = parseFloat(w);
        if (!px || px < 3 || style === 'none') continue;
        // 나머지 세 면이 사실상 없으면 "한쪽만 두른 바"다
        const others = side === 'Left'
          ? [s.borderRightWidth, s.borderTopWidth, s.borderBottomWidth]
          : [s.borderLeftWidth, s.borderTopWidth, s.borderBottomWidth];
        if (others.every((v) => parseFloat(v) < 1)) {
          sideBars.push(`${el.tagName}.${String(el.className).trim().split(/\s+/)[0] || ''} border${side} ${w}`);
        }
      }
    });

    // 브랜드 색이 큰 면적으로 쓰인 곳의 수
    const brandVar = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
    const toRgb = (hex) => { const h = hex.replace('#', ''); return `rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`; };
    const brandRgb = toRgb(brandVar);
    let brandAreas = 0;
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 40000) return;
      if (getComputedStyle(el).backgroundColor === brandRgb) brandAreas++;
    });

    return {
      h1: { fontSize: h1.fontSize, lineHeight: h1.lineHeight, fontWeight: h1.fontWeight, letterSpacing: h1.letterSpacing },
      h2: { fontSize: h2.fontSize, lineHeight: h2.lineHeight, fontWeight: h2.fontWeight },
      p: { fontSize: p.fontSize, lineHeight: p.lineHeight, fontWeight: p.fontWeight, letterSpacing: p.letterSpacing },
      cardTitle: (function () { const c = g('.card h3'); return c ? { fontSize: c.fontSize, lineHeight: c.lineHeight, fontWeight: c.fontWeight, letterSpacing: c.letterSpacing } : null; })(),
      contentWidth: Math.round(document.querySelector('.single-content').getBoundingClientRect().width),
      paraGaps: gaps,
      cardW: col1[0] ? col1[0].w : null, colXs, gutter, stagger, rowGap, colCount: colXs.length,
      thumb: R('.card .thumb'),
      // measure6 실측: 이미지 상자 기준 left 16 / bottom 16, 18px/18px/800/1px, 그림자 없음
      badge: (function () {
        const b = document.querySelector('.card .badge');
        const img = document.querySelector('.card .thumb');
        if (!b || !img) return null;
        const br = b.getBoundingClientRect(); const ir = img.getBoundingClientRect();
        const s = getComputedStyle(b);
        return { left: Math.round(br.left - ir.left), bottom: Math.round(ir.bottom - br.bottom),
                 fontSize: s.fontSize, lineHeight: s.lineHeight, fontWeight: s.fontWeight,
                 letterSpacing: s.letterSpacing, textShadow: s.textShadow, background: s.backgroundColor };
      })(),
      headerH: Math.round(document.querySelector('header').getBoundingClientRect().height),
      headerPos: g('header').position,
      headerBg: g('header').backgroundColor,
      headerShadow: g('header').boxShadow,
      headerBlend: g('header').mixBlendMode,
      panelW: Math.round(document.querySelector('.panel').getBoundingClientRect().width),
      featuredPos: g('.featured').position,
      // 핀 지속 거리 — 기둥 높이 - 화면 한 칸 = 실측 478px 이어야 한다
      pinRun: (function () {
        const col = document.querySelector('.featured-col');
        if (!col) return null;
        return Math.round(col.getBoundingClientRect().height - window.innerHeight);
      })(),
      // 카테고리 목록 — 홈과 **다른** 그리드 (measure6)
      archive: (function () {
        const cards = [...document.querySelectorAll('.archive .card')];
        if (!cards.length) return null;
        const geom = cards.map((c) => { const r = c.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; });
        const xs = [...new Set(geom.map((c) => c.x))].sort((a, b) => a - b);
        const firstRow = geom.filter((c) => c.y === geom[0].y);
        const h1 = g('.archive h1');
        return {
          cols: xs.length, firstX: xs[0], w: geom[0].w,
          gutter: xs.length >= 2 ? xs[1] - xs[0] - geom[0].w : null,
          // 엇갈림이 없어야 한다 — 첫 행 카드들의 y 가 전부 같다
          staggered: firstRow.length !== xs.length,
          h1: h1 && { fontSize: h1.fontSize, lineHeight: h1.lineHeight, fontWeight: h1.fontWeight,
                      textTransform: h1.textTransform, color: h1.color },
          h1Count: document.querySelectorAll('.archive h1').length,
        };
      })(),
      // 글 헤더 색은 글마다 다른 자리여야 한다 (브랜드색을 그대로 쓰면 안 된다)
      postAccent: (function () {
        const s = document.querySelector('.single');
        if (!s) return null;
        const v = getComputedStyle(s).getPropertyValue('--post-accent').trim();
        const brand = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
        return { value: v, sameAsBrand: v.toLowerCase() === brand.toLowerCase(),
                 headerBg: getComputedStyle(document.querySelector('.single-header')).backgroundColor };
      })(),
      bodyBg: g('body').backgroundColor,
      brandVar, brandAreas,
      grayCount: grays.length, graySamples: [...new Set(grays)].slice(0, 3),
      sideBars: [...new Set(sideBars)],
      fontFamily: g('body').fontFamily,
      strongWeight: g('.single-content strong') && g('.single-content strong').fontWeight,
      strongColor: g('.single-content strong') && g('.single-content strong').color,
      pColor: p.color,
    };
  });

  // 헤더 스크롤 반응
  const hdr = () => page.evaluate(() => {
    const h = document.querySelector('header');
    return { top: getComputedStyle(h).top, cls: h.className };
  });
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(700);
  const down = await hdr();
  await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(700);
  const up = await hdr();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(600);

  // 카드 hover — 진짜 올려서 transform 을 읽고, 형제를 미는지도 본다
  const layout = () => page.evaluate(() => {
    const cs = [...document.querySelectorAll('.strip:not(.strip--flip) .card')];
    return { wrapH: Math.round(document.querySelector('.strip:not(.strip--flip) .cards').getBoundingClientRect().height),
             card1Top: Math.round(cs[2].getBoundingClientRect().top),
             img: (function(){ const r = document.querySelector('.card .thumb .img').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })() };
  });
  const beforeL = await layout();
  const card = await page.$('.card .thumb .img');
  await card.hover(); await page.waitForTimeout(1000);
  const afterL = await layout();
  const cardT = await page.evaluate(() => {
    const e = document.querySelector('.card .thumb .img');
    return { transform: getComputedStyle(e).transform, transition: getComputedStyle(e).transition };
  });
  await page.mouse.move(0, 0); await page.waitForTimeout(800);

  // 패널
  await page.click('#burger'); await page.waitForTimeout(900);
  const panelOpen = await page.evaluate(() => {
    const p = document.querySelector('.panel');
    return { x: Math.round(p.getBoundingClientRect().x), transform: getComputedStyle(p).transform };
  });
  await page.screenshot({ path: path.join(OUT, 'mockup-panel.png') });
  // 열린 상태에서 닫기 버튼이 실제로 눌리는가.
  // 패널(z-index 9999)이 헤더를 덮어 X 가 사라졌던 적이 있다 — Esc 말고 클릭으로 확인한다.
  let closeClickable = true;
  try { await page.click('#burger', { timeout: 4000 }); await page.waitForTimeout(800); }
  catch (e) { closeClickable = false; await page.keyboard.press('Escape'); await page.waitForTimeout(700); }
  const panelClosed = await page.evaluate(() => !document.body.classList.contains('open'));

  await page.screenshot({ path: path.join(OUT, 'mockup-home.png') });
  await page.evaluate(() => window.scrollTo(0, 1500)); await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'mockup-home-scrolled.png') });
  await page.evaluate(() => document.getElementById('single').scrollIntoView()); await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, 'mockup-article.png') });
  await page.evaluate(() => { document.getElementById('single').scrollIntoView(); window.scrollBy(0, 1000); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'mockup-article-body.png') });

  // 모바일
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(FILE, { waitUntil: 'load', timeout: 60000 });
  await mp.waitForTimeout(1400);
  const mobile = await mp.evaluate(() => {
    const g = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
    const h1 = g('.single-header h1'), h2 = g('.single-content h2'), p = g('.single-content > p');
    return {
      h1: { fontSize: h1.fontSize, lineHeight: h1.lineHeight },
      h2: { fontSize: h2.fontSize, lineHeight: h2.lineHeight },
      p: { fontSize: p.fontSize, lineHeight: p.lineHeight, fontWeight: p.fontWeight },
      headerH: Math.round(document.querySelector('header').getBoundingClientRect().height),
      cardCols: [...new Set([...document.querySelectorAll('.card')].map((c) => Math.round(c.getBoundingClientRect().x)))].length,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    };
  });
  await mp.screenshot({ path: path.join(OUT, 'mockup-mobile.png') });
  await mp.evaluate(() => document.getElementById('single').scrollIntoView()); await mp.waitForTimeout(800);
  await mp.screenshot({ path: path.join(OUT, 'mockup-mobile-article.png') });
  await browser.close();

  // ── 대조 ────────────────────────────────────────────────
  const m = cardT.transform.match(/matrix\(([-\d.]+),\s*([-\d.]+)/);
  const scale = m ? Math.sqrt(+m[1] * +m[1] + +m[2] * +m[2]) : null;
  const rot = m ? (Math.atan2(+m[2], +m[1]) * 180) / Math.PI : null;
  const pushed = beforeL.wrapH !== afterL.wrapH || beforeL.card1Top !== afterL.card1Top;

  const rows = [
    // [항목, 기대(실측), 실제, 통과여부]
    ['글 h1', '72px / 82.8px / 800', `${got.h1.fontSize} / ${got.h1.lineHeight} / ${got.h1.fontWeight}`,
      got.h1.fontSize === '72px' && got.h1.lineHeight === '82.8px' && got.h1.fontWeight === '800'],
    ['글 h1 자간', '-0.5px', got.h1.letterSpacing, got.h1.letterSpacing === '-0.5px'],
    ['글 h2', '25px / 37.5px / 800', `${got.h2.fontSize} / ${got.h2.lineHeight} / ${got.h2.fontWeight}`,
      got.h2.fontSize === '25px' && got.h2.lineHeight === '37.5px' && got.h2.fontWeight === '800'],
    ['본문 p', '16px / 28px / 300 / -0.2px', `${got.p.fontSize} / ${got.p.lineHeight} / ${got.p.fontWeight} / ${got.p.letterSpacing}`,
      got.p.fontSize === '16px' && got.p.lineHeight === '28px' && got.p.fontWeight === '300' && got.p.letterSpacing === '-0.2px'],
    ['카드 제목 (measure5)', '28.8px / 36px / 800 / -1px',
      got.cardTitle && `${got.cardTitle.fontSize} / ${got.cardTitle.lineHeight} / ${got.cardTitle.fontWeight} / ${got.cardTitle.letterSpacing}`,
      !!got.cardTitle && got.cardTitle.fontSize === '28.8px' && got.cardTitle.lineHeight === '36px' && got.cardTitle.fontWeight === '800' && got.cardTitle.letterSpacing === '-1px'],
    ['본문 컬럼 폭', '800', String(got.contentWidth), got.contentWidth === 800],
    ['문단 간격', '30 (전부)', got.paraGaps.join(','), got.paraGaps.length > 0 && got.paraGaps.every((x) => x === 30)],
    ['strong 굵기 800 · 색 동일', '800 / 본문색과 같음', `${got.strongWeight} / ${got.strongColor === got.pColor ? '같음' : '다름'}`,
      got.strongWeight === '800' && got.strongColor === got.pColor],
    ['카드 폭', '318', String(got.cardW), Math.abs(got.cardW - 318) <= 1],
    ['열 개수', '2', String(got.colCount), got.colCount === 2],
    ['열 거터', '26', String(got.gutter), Math.abs(got.gutter - 26) <= 1],
    ['둘째 열 엇갈림', '128', String(got.stagger), Math.abs(got.stagger - 128) <= 1],
    ['같은 열 세로 간격', '48', String(got.rowGap), got.rowGap !== null && Math.abs(got.rowGap - 48) <= 1],
    ['카드 이미지 프레임', '318 × 397', got.thumb && `${got.thumb.w} × ${got.thumb.h}`,
      !!got.thumb && Math.abs(got.thumb.w - 318) <= 1 && Math.abs(got.thumb.h - 397) <= 2],
    ['배지 위치 (measure6)', 'left 16 / bottom 16', got.badge && `left ${got.badge.left} / bottom ${got.badge.bottom}`,
      !!got.badge && got.badge.left === 16 && got.badge.bottom === 16],
    ['배지 타이포 (measure6)', '18px / 18px / 800 / 1px',
      got.badge && `${got.badge.fontSize} / ${got.badge.lineHeight} / ${got.badge.fontWeight} / ${got.badge.letterSpacing}`,
      !!got.badge && got.badge.fontSize === '18px' && got.badge.lineHeight === '18px'
        && got.badge.fontWeight === '800' && got.badge.letterSpacing === '1px'],
    ['배지 — 원본에 없는 장식 안 붙임', '그림자·배경 없음',
      got.badge && `${got.badge.textShadow} / ${got.badge.background}`,
      !!got.badge && got.badge.textShadow === 'none' && got.badge.background === 'rgba(0, 0, 0, 0)'],
    ['헤더 높이 / position', '130 / fixed', `${got.headerH} / ${got.headerPos}`, got.headerH === 130 && got.headerPos === 'fixed'],
    ['헤더 배경 투명 · 그림자 0', 'transparent / none', `${got.headerBg} / ${got.headerShadow}`,
      got.headerBg === 'rgba(0, 0, 0, 0)' && got.headerShadow === 'none'],
    ['헤더 blend 미사용(이전 버그)', 'normal', got.headerBlend, got.headerBlend === 'normal'],
    ['헤더 스크롤↓', '-130px / nav-up', `${down.top} / ${down.cls}`, down.top === '-130px' && /nav-up/.test(down.cls)],
    ['헤더 스크롤↑', '0px / nav-down', `${up.top} / ${up.cls}`, up.top === '0px' && /nav-down/.test(up.cls)],
    ['대표글 고정', 'sticky', got.featuredPos, got.featuredPos === 'sticky'],
    ['핀 지속 거리 (ScrollTrigger 실측)', '478', String(got.pinRun), Math.abs(got.pinRun - 478) <= 1],
    ['카테고리 그리드 (홈과 다르다)', '4열 · 폭 306 · 거터 24',
      got.archive && `${got.archive.cols}열 · 폭 ${got.archive.w} · 거터 ${got.archive.gutter}`,
      !!got.archive && got.archive.cols === 4 && Math.abs(got.archive.w - 306) <= 1 && Math.abs(got.archive.gutter - 24) <= 1],
    ['카테고리 첫 열 x', '72', got.archive && String(got.archive.firstX),
      !!got.archive && Math.abs(got.archive.firstX - 72) <= 1],
    ['카테고리는 엇갈리지 않는다', '엇갈림 없음', got.archive && (got.archive.staggered ? '엇갈림 있음' : '엇갈림 없음'),
      !!got.archive && !got.archive.staggered],
    ['카테고리 h1 (홈엔 0개)', '64px / 96px / 800 / uppercase / 1개',
      got.archive && got.archive.h1
        && `${got.archive.h1.fontSize} / ${got.archive.h1.lineHeight} / ${got.archive.h1.fontWeight} / ${got.archive.h1.textTransform} / ${got.archive.h1Count}개`,
      !!(got.archive && got.archive.h1) && got.archive.h1.fontSize === '64px' && got.archive.h1.lineHeight === '96px'
        && got.archive.h1.fontWeight === '800' && got.archive.h1.textTransform === 'uppercase' && got.archive.h1Count === 1],
    ['글 헤더 색은 글마다 다른 자리', '브랜드색과 달라야 함',
      got.postAccent && `${got.postAccent.value} (브랜드와 ${got.postAccent.sameAsBrand ? '같음' : '다름'})`,
      !!got.postAccent && !!got.postAccent.value && !got.postAccent.sameAsBrand],
    ['카드 hover 변형', 'scale 1.100 / rotate 2.0°', `${scale ? scale.toFixed(3) : '?'} / ${rot ? rot.toFixed(1) : '?'}°`,
      !!scale && Math.abs(scale - 1.1) < 0.005 && Math.abs(rot - 2) < 0.05],
    ['카드 hover 지속', '0.7s', /0\.7s/.test(cardT.transition) ? '0.7s' : cardT.transition, /0\.7s/.test(cardT.transition)],
    ['hover 가 형제를 밀지 않음', '레이아웃 불변', pushed ? '밀었다' : '불변', !pushed],
    ['패널 폭', '734 (51vw)', String(got.panelW), Math.abs(got.panelW - 734) <= 2],
    ['패널 열림 x', '706', String(panelOpen.x), Math.abs(panelOpen.x - 706) <= 3],
    ['패널 닫기 버튼 클릭 가능', '클릭으로 닫힘', closeClickable && panelClosed ? '닫힘' : (closeClickable ? '클릭됐지만 안 닫힘' : '가려져서 클릭 불가'),
      closeClickable && panelClosed],
    ['모바일 h1', '36px / 50.4px', `${mobile.h1.fontSize} / ${mobile.h1.lineHeight}`,
      mobile.h1.fontSize === '36px' && mobile.h1.lineHeight === '50.4px'],
    ['모바일 h2 (안 줄임)', '25px / 37.5px', `${mobile.h2.fontSize} / ${mobile.h2.lineHeight}`,
      mobile.h2.fontSize === '25px' && mobile.h2.lineHeight === '37.5px'],
    ['모바일 본문 (안 줄임)', '16px / 28px / 300', `${mobile.p.fontSize} / ${mobile.p.lineHeight} / ${mobile.p.fontWeight}`,
      mobile.p.fontSize === '16px' && mobile.p.lineHeight === '28px' && mobile.p.fontWeight === '300'],
    ['모바일 헤더', '80', String(mobile.headerH), mobile.headerH === 80],
    ['모바일 카드 1열', '1', String(mobile.cardCols), mobile.cardCols === 1],
    ['모바일 가로 스크롤', '없음', mobile.horizontalScroll ? `있음 ${mobile.scrollW}>${mobile.clientW}` : '없음', !mobile.horizontalScroll],
    // 색은 일부러 바꿨다 — 값이 아니라 규칙을 본다
    ['[규칙] 회색 글자 없음', '0개', `${got.grayCount}개 ${got.graySamples.join(' ')}`, got.grayCount === 0],
    ['[규칙] 한쪽만 두른 액센트 바 없음', '0개', got.sideBars.length ? `${got.sideBars.length}개 ${got.sideBars[0]}` : '0개', got.sideBars.length === 0],
    ['[규칙] 브랜드 큰 면적', '1~4곳', `${got.brandAreas}곳`, got.brandAreas >= 1 && got.brandAreas <= 4],
    ['[선택] 팔레트', `bg ${PALETTE.bg} / brand ${PALETTE.brand}`, `${got.bodyBg} / ${got.brandVar}`,
      got.brandVar.toUpperCase() === PALETTE.brand],
  ];

  let fail = 0;
  console.log('\n  항목'.padEnd(32) + '기대'.padEnd(30) + '목업'.padEnd(32) + '판정');
  console.log('  ' + '─'.repeat(104));
  for (const [k, exp, act, ok] of rows) {
    if (!ok) fail++;
    console.log('  ' + String(k).padEnd(30) + String(exp).padEnd(28) + String(act).padEnd(30) + (ok ? '✅' : '❌'));
  }
  console.log('\n  폰트: ' + got.fontFamily);
  console.log('  총 ' + rows.length + '항목 · 불일치 ' + fail + '건');
  process.exit(fail ? 1 : 0);
})();
