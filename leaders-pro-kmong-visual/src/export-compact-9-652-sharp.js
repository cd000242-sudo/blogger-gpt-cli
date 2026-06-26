const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const visualRoot = path.resolve(__dirname, '..');
const captureDir = path.join(visualRoot, 'captures', 'safe');
const assetDir = path.join(visualRoot, 'assets', 'generated');
const outDir = path.join(visualRoot, 'export', 'upload-9-652x488');
const W = 652;
const H = 488;

function ensureCleanDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const file of fs.readdirSync(dir)) {
    if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.md')) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function text(lines, opts) {
  const {
    x,
    y,
    size = 18,
    line = Math.round(size * 1.25),
    fill = '#fff',
    weight = 900,
    anchor = 'start',
    opacity = 1,
  } = opts;
  const arr = Array.isArray(lines) ? lines : [lines];
  return arr.map((lineText, i) => `
    <text x="${x}" y="${y + i * line}" fill="${fill}" opacity="${opacity}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="Malgun Gothic, Noto Sans KR, Arial, sans-serif" paint-order="stroke" stroke="rgba(2,6,23,0.36)" stroke-width="${size >= 24 ? 3 : 1.5}" stroke-linejoin="round">${esc(lineText)}</text>
  `).join('');
}

function badge(label, x = 32, y = 30) {
  const width = Math.max(122, label.length * 12 + 30);
  return `
    <rect x="${x}" y="${y}" width="${width}" height="30" rx="15" fill="rgba(14,116,144,0.45)" stroke="rgba(56,189,248,0.55)"/>
    ${text(label, { x: x + 15, y: y + 21, size: 14, fill: '#bae6fd', weight: 900 })}
  `;
}

function background() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="0.58" stop-color="#111827"/>
      <stop offset="1" stop-color="#06101e"/>
    </linearGradient>
    <linearGradient id="teal" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#38bdf8"/>
      <stop offset="1" stop-color="#2dd4bf"/>
    </linearGradient>
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.038)" stroke-width="1"/>
    </pattern>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#000" flood-opacity="0.30"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>
  <circle cx="82" cy="72" r="210" fill="rgba(56,189,248,0.18)"/>
  <circle cx="595" cy="40" r="210" fill="rgba(45,212,191,0.13)"/>
  <path d="M-80,410 L270,-40 L380,-40 L30,488 Z" fill="rgba(20,184,166,0.16)"/>
  <path d="M438,488 L686,70 L716,122 L470,488 Z" fill="rgba(56,189,248,0.10)"/>
  `;
}

function rect(x, y, w, h, rx = 12, fill = 'rgba(15,23,42,0.84)', stroke = 'rgba(148,163,184,0.24)') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" filter="url(#shadow)"/>`;
}

function cardFrame(card) {
  return `
    ${rect(card.x, card.y, card.w, card.h, card.rx || 12)}
    <rect x="${card.x + 8}" y="${card.y + 8}" width="${card.w - 16}" height="${card.imgH}" rx="8" fill="${card.bg || '#06101f'}"/>
  `;
}

function caption(card, title, sub) {
  const y = card.y + 8 + card.imgH + 26;
  const titleSize = card.titleSize || 15;
  const subSize = card.subSize || 11;
  return `
    ${text(title, { x: card.x + 13, y, size: titleSize, fill: '#ffffff', weight: 950 })}
    ${sub ? text(sub, { x: card.x + 13, y: y + titleSize + 10, size: subSize, fill: '#dbeafe', weight: 850 }) : ''}
  `;
}

async function imageComposite(file, card) {
  let pipeline = sharp(path.join(captureDir, file));
  if (card.extract) {
    pipeline = pipeline.extract(card.extract);
  }
  const buffer = await pipeline
    .resize(card.w - 16, card.imgH, {
      fit: 'contain',
      background: card.bg || '#06101f',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  return { input: buffer, left: card.x + 8, top: card.y + 8 };
}

function sideCardFrame(card) {
  return `
    ${rect(card.x, card.y, card.w, card.h, card.rx || 12)}
    <rect x="${card.x + 8}" y="${card.y + 8}" width="${card.imgW}" height="${card.imgH}" rx="8" fill="${card.bg || '#06101f'}"/>
  `;
}

function sideCaption(card, title, sub) {
  return `
    ${text(title, { x: card.x + card.imgW + 20, y: card.y + 33, size: card.titleSize || 14, fill: '#ffffff', weight: 950 })}
    ${sub ? text(sub, { x: card.x + card.imgW + 20, y: card.y + 55, size: card.subSize || 10, fill: '#dbeafe', weight: 850 }) : ''}
  `;
}

async function sideImageComposite(file, card) {
  let pipeline = sharp(path.join(captureDir, file));
  if (card.extract) {
    pipeline = pipeline.extract(card.extract);
  }
  const buffer = await pipeline
    .resize(card.imgW, card.imgH, {
      fit: 'contain',
      background: card.bg || '#06101f',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  return { input: buffer, left: card.x + 8, top: card.y + 8 };
}

async function logoComposite(file, box) {
  const buffer = await sharp(path.join(assetDir, file))
    .resize(box.w, box.h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return { input: buffer, left: box.x, top: box.y };
}

async function render(fileName, svgParts, composites = []) {
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${background()}${svgParts.join('\n')}</svg>`);
  const outPath = path.join(outDir, fileName);
  await sharp(svg)
    .composite(composites)
    .png()
    .toFile(outPath);
  const meta = await sharp(outPath).metadata();
  if (meta.width !== W || meta.height !== H) {
    throw new Error(`${fileName} expected ${W}x${H}, got ${meta.width}x${meta.height}`);
  }
  return fileName;
}

async function main() {
  ensureCleanDir(outDir);
  const exported = [];

  exported.push(await render('01-main-image.png', [
    badge('리더스 키워드 · 블로그 SEO 자동화'),
    text(['자동화인데', '사람이 짠 듯'], { x: 36, y: 130, size: 48, line: 60 }),
    text(['키워드 · 내부링크 · 외부유입', 'SEO 동선 자동화앱'], { x: 36, y: 245, size: 22, line: 32, fill: '#dbeafe' }),
    rect(36, 378, 580, 76, 12, 'rgba(15,118,110,0.24)', 'rgba(45,212,191,0.48)'),
    text('LEWORD + Better Life Naver + Leadernam Orbit', { x: 326, y: 427, size: 21, anchor: 'middle' }),
  ]));

  const logos = [
    { file: 'leword-logo.svg', x: 72, y: 262, w: 76, h: 76 },
    { file: 'leaders-pro-logo.png', x: 286, y: 262, w: 76, h: 76 },
    { file: 'orbit-logo.png', x: 500, y: 262, w: 76, h: 76 },
  ];
  exported.push(await render('02-solution.png', [
    badge('단순 자동글 생성기가 아닙니다'),
    text(['키워드에서 발행까지', '운영 흐름을 정리합니다'], { x: 36, y: 118, size: 34, line: 43 }),
    ...['키워드', '본문', '이미지', 'CTA', '발행'].map((label, i) => {
      const x = 36 + i * 118;
      return `${rect(x, 196, 104, 39, 9, 'rgba(20,184,166,0.20)', 'rgba(45,212,191,0.42)')}${text(label, { x: x + 52, y: 221, size: 16, anchor: 'middle' })}`;
    }),
    ...[
      { x: 36, title: 'LEWORD', sub: '검색어 · 황금키워드' },
      { x: 250, title: 'Better Life Naver', sub: '대기열 · 순차 발행' },
      { x: 464, title: 'Leadernam Orbit', sub: 'CTA · 외부유입' },
    ].flatMap((c) => [
      rect(c.x, 248, 152, 170, 13),
      text(c.title, { x: c.x + 76, y: 364, size: 18, anchor: 'middle' }),
      text(c.sub, { x: c.x + 76, y: 392, size: 13, fill: '#dbeafe', anchor: 'middle', weight: 850 }),
    ]),
  ], await Promise.all(logos.map((item) => logoComposite(item.file, item)))));

  const suiteCards = [
    { file: '14-leword-latest-keywords.png', x: 32, y: 172, w: 188, h: 244, imgH: 178, title: 'LEWORD', sub: '키워드 발굴' },
    { file: '15-naver-latest-smart-publish.png', x: 234, y: 172, w: 188, h: 244, imgH: 178, title: 'Better Life Naver', sub: '발행 실행' },
    { file: '01-posting-keyword.png', x: 436, y: 172, w: 188, h: 244, imgH: 178, title: 'Leadernam Orbit', sub: '발행 보조' },
  ];
  exported.push(await render('03-suite.png', [
    badge('실제 최신 앱 화면'),
    text('세 가지 앱을 한 패키지로', { x: 36, y: 122, size: 34 }),
    ...suiteCards.flatMap((c) => [cardFrame(c), caption(c, c.title, c.sub)]),
  ], await Promise.all(suiteCards.map((c) => imageComposite(c.file, c)))));

  const lewordMain = { file: '39-leword-golden-analysis.png', x: 32, y: 168, w: 356, h: 270, imgH: 206, title: '황금키워드 분석', sub: '검색량 · 문서수 · 경쟁비율' };
  const lewordMini = [
    { file: '38-leword-realtime-trends.png', x: 404, y: 168, w: 216, h: 80, imgH: 46, title: '실시간 검색어' },
    { file: '40-leword-traffic-hunter.png', x: 404, y: 260, w: 216, h: 80, imgH: 46, title: '트래픽 키워드 헌터' },
    { file: '32-leword-mindmap.png', x: 404, y: 352, w: 216, h: 80, imgH: 46, title: '마인드맵 확장' },
  ];
  exported.push(await render('04-leword.png', [
    badge('LEWORD 핵심 기능'),
    text('쓸 만한 키워드를 먼저 찾습니다', { x: 36, y: 122, size: 34 }),
    cardFrame(lewordMain),
    caption(lewordMain, lewordMain.title, lewordMain.sub),
    ...lewordMini.flatMap((c) => [cardFrame(c), caption(c, c.title, '')]),
  ], await Promise.all([lewordMain, ...lewordMini].map((c) => imageComposite(c.file, c)))));

  const naverMain = { file: '36-naver-full-auto.png', x: 32, y: 168, w: 250, h: 300, imgH: 240, title: '풀오토 발행 모드', sub: '키워드 입력부터 발행까지' };
  const naverMini = [
    { file: '35-naver-multi-account.png', x: 300, y: 168, w: 292, h: 82, imgH: 48, title: '다중계정 순차 발행' },
    { file: '37-naver-queue-board.png', x: 300, y: 262, w: 292, h: 82, imgH: 48, title: '연속발행 대기열' },
    { file: '27-naver-progress-modal.png', x: 300, y: 356, w: 292, h: 82, imgH: 48, title: '작업 진행률' },
  ];
  exported.push(await render('05-naver.png', [
    badge('Better Life Naver'),
    text(['대기열 · 순차 발행 · 진행률을', '한눈에 확인합니다'], { x: 36, y: 112, size: 31, line: 38 }),
    cardFrame(naverMain),
    caption(naverMain, naverMain.title, naverMain.sub),
    ...naverMini.flatMap((c) => [cardFrame(c), caption(c, c.title, '')]),
  ], await Promise.all([naverMain, ...naverMini].map((c) => imageComposite(c.file, c)))));

  const platformMain = { file: '11-clean-article-body.png', x: 32, y: 168, w: 356, h: 270, imgH: 206, title: '공개 발행글 본문', sub: '깔끔한 이미지 · 본문 · 강조 문구', bg: '#ffffff' };
  const platformMini = [
    { file: '12-clean-article-faq-top.png', x: 404, y: 168, w: 216, h: 80, imgH: 46, title: 'FAQ 시작 구간', bg: '#ffffff' },
    { file: '13-clean-article-faq-full.png', x: 404, y: 260, w: 216, h: 80, imgH: 46, title: 'FAQ 전체 구성', bg: '#ffffff' },
    { file: '17-external-traffic-generate.png', x: 404, y: 352, w: 216, h: 80, imgH: 46, title: '외부유입 글 생성' },
  ];
  exported.push(await render('06-platforms.png', [
    badge('Leadernam Orbit · 외부유입'),
    text(['공개 글과 유입 글까지', '모바일 친화형으로'], { x: 36, y: 112, size: 31, line: 38 }),
    cardFrame(platformMain),
    caption(platformMain, platformMain.title, platformMain.sub),
    ...platformMini.flatMap((c) => [cardFrame(c), caption(c, c.title, '')]),
  ], await Promise.all([platformMain, ...platformMini].map((c) => imageComposite(c.file, c)))));

  const spiderMain = { file: '03-internal-links.png', x: 32, y: 168, w: 248, h: 300, imgH: 240, title: '앱에서 거미줄 세팅', sub: '기존 글 선택 후 종합글 구성' };
  const spiderMini = [
    { file: '08-linked-list.png', x: 298, y: 168, w: 294, h: 82, imgH: 48, title: 'Leadernam Orbit 관련 글 목록', bg: '#ffffff' },
    { file: '09-linked-cta.png', x: 298, y: 262, w: 294, h: 82, imgH: 48, title: '하위 글 → 종합글 CTA', bg: '#ffffff' },
    { file: '10-linked-cards.png', x: 298, y: 356, w: 294, h: 82, imgH: 48, title: '종합글 → 관련글 카드', bg: '#ffffff' },
  ];
  exported.push(await render('07-spiderweb.png', [
    badge('거미줄 내부링크 구조'),
    text(['앱에서 세팅하고', 'Leadernam Orbit 글로 연결합니다'], { x: 36, y: 112, size: 29, line: 36 }),
    cardFrame(spiderMain),
    caption(spiderMain, spiderMain.title, spiderMain.sub),
    ...spiderMini.flatMap((c) => [cardFrame(c), caption(c, c.title, '')]),
  ], await Promise.all([spiderMain, ...spiderMini].map((c) => imageComposite(c.file, c)))));

  exported.push(await render('08-persona-flow.png', [
    badge('이런 분께 추천드립니다'),
    text(['반복 작업은 줄이고', '운영 방향에 집중하세요'], { x: 36, y: 112, size: 34, line: 43 }),
    ...[
      [36, 190, '키워드 찾기가 막막한 분'],
      [332, 190, '발행 관리가 복잡한 분'],
      [36, 274, '글끼리 연결이 안 되는 분'],
      [332, 274, '여러 플랫폼을 쓰는 분'],
    ].flatMap(([x, y, label]) => [rect(x, y, 284, 58, 12), text(label, { x: x + 142, y: y + 37, size: 17, anchor: 'middle' })]),
    ...['1 키워드', '2 역할', '3 본문/이미지', '4 대기열', '5 내부링크'].map((label, i) => {
      const x = 36 + i * 118;
      return `${rect(x, 356, 104, 40, 9, 'rgba(20,184,166,0.20)', 'rgba(45,212,191,0.42)')}${text(label, { x: x + 52, y: 382, size: 14, anchor: 'middle' })}`;
    }),
    rect(36, 412, 580, 48, 12, 'rgba(15,23,42,0.80)', 'rgba(148,163,184,0.24)'),
    text('무작정 많이 쓰는 것이 아니라, 글이 이어지는 운영 흐름을 만듭니다.', { x: 326, y: 443, size: 17, anchor: 'middle' }),
  ]));

  exported.push(await render('09-package.png', [
    badge('올인원 패키지 안내'),
    text('3개 앱 모두 포함된 구성입니다', { x: 36, y: 122, size: 34 }),
    ...[
      { x: 36, title: '1년 이용권', price: '500,000원', sub: '기본 가이드 · 문의 응대' },
      { x: 232, title: '1년+세팅', price: '600,000원', sub: '초기세팅 동행 안내' },
      { x: 428, title: '영구 이용권', price: '1,650,000원', sub: '장기 운영자용' },
    ].flatMap((p) => [
      rect(p.x, 174, 172, 108, 13),
      text(p.title, { x: p.x + 86, y: 206, size: 16, fill: '#bae6fd', anchor: 'middle' }),
      text(p.price, { x: p.x + 86, y: 242, size: 23, anchor: 'middle' }),
      text(p.sub, { x: p.x + 86, y: 265, size: 11, fill: '#dbeafe', anchor: 'middle', weight: 800 }),
    ]),
    rect(36, 302, 580, 72, 12, 'rgba(120,53,15,0.20)', 'rgba(251,191,36,0.30)'),
    text('구매 전 확인', { x: 54, y: 331, size: 16, fill: '#fde68a' }),
    text('검색 노출 · 수익 · 애드센스 승인 · 순위 달성은 보장하지 않습니다.', { x: 54, y: 354, size: 12, fill: '#fef3c7', weight: 850 }),
    text('API 키 · 계정 연동 · 플랫폼 설정이 필요할 수 있습니다.', { x: 54, y: 372, size: 12, fill: '#fef3c7', weight: 850 }),
    rect(36, 392, 580, 56, 12, 'url(#teal)', 'rgba(45,212,191,0.55)'),
    text(['키워드 찾기부터 발행, 내부링크, 외부유입 글 구성까지', '한 번에 정리하세요.'], { x: 326, y: 418, size: 16, fill: '#06111f', anchor: 'middle', line: 21 }),
  ]));

  const uploadOrder = [
    '# 크몽 652x488px 업로드 이미지 순서',
    '',
    '이 폴더의 PNG 9장은 모두 정확히 652x488px입니다.',
    '',
    ...exported.map((file, index) => `${index + 1}. \`${file}\``),
    '',
    '가격: 1년 500,000원 / 1년+세팅 600,000원 / 영구 1,650,000원',
    '구성: 대표/후킹 -> 문제 해결 -> 실제 앱 3종 -> LEWORD -> Better Life Naver -> Leadernam Orbit/외부유입 -> 거미줄 구조 -> 추천 대상/흐름 -> 가격/주의',
  ].join('\n');

  fs.writeFileSync(path.join(outDir, 'upload-order-652x488.md'), uploadOrder, 'utf8');
  console.log(JSON.stringify({ ok: true, size: `${W}x${H}`, count: exported.length, outDir, files: exported }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
