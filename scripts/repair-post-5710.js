/**
 * 발행글 5710 응급 수리 — 손님(변호사)께 보여드릴 글의 명백한 결함만 걷는다. (2026-09-11)
 *
 * 사장님: "설치 전이고 이 글부터 먼저 고쳐봐"
 *
 * ## 고치는 것 (전부 "명백히 틀린 것"만)
 *   ① CTA 링크 오배송 — "공식 사이트 바로가기"가 postmate.waffle-gl.org(정체불명 중계)로 간다.
 *      판정기(host-trust)는 이미 redirector 로 막으라고 하는데 이 경로가 그걸 안 불렀다.
 *      대체할 공식 주소를 확신할 수 없으므로 **블록을 지운다** — 틀린 링크보다 없는 편이 낫다.
 *   ② 본문에 날것으로 노출된 URL 2개 → 기관명 앵커로 바꾼다.
 *      게다가 대법원 주소는 &#038; 때문에 클릭해도 안 열린다(엔티티 14곳).
 *   ③ 번호형 소제목("1.", "1-1.") → 설명형. 변호사님이 명시적으로 피해달라고 한 부분이다.
 *
 * ## 안 고치는 것
 *   · 주제 이탈 섹션(혼인신고 직후·기간비용 비교) 삭제 — 문단을 들어내는 일이라 사람이 정할 몫이다.
 *   · 본문 내용·문체 — 다시 쓰는 건 수리가 아니라 재생성이다.
 *
 * 되돌리기: 워드프레스가 수정 전 판(리비전)을 남긴다.
 *
 *   node scripts/repair-post-5710.js          → 무엇이 바뀌는지만 보여준다
 *   node scripts/repair-post-5710.js --apply  → 실제로 저장한다
 */
const fs = require('fs');
const path = require('path');

const POST_ID = Number(process.env.POST_ID || 5710);
const apply = process.argv.includes('--apply');

function loadEnv() {
  const p = path.join(process.env.APPDATA, 'lba', '.env');
  const env = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const SITE = String(env.WORDPRESS_SITE_URL || '').replace(/\/+$/, '');
const auth = 'Basic ' + Buffer.from(`${env.WORDPRESS_USERNAME}:${env.WORDPRESS_PASSWORD}`).toString('base64');

async function wpGet(pathname) {
  const res = await fetch(`${SITE}/wp-json/wp/v2/${pathname}`, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`GET ${pathname} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function wpPutContent(id, content) {
  const res = await fetch(`${SITE}/wp-json/wp/v2/posts/${id}`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`UPDATE ${id} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** ① 신뢰할 수 없는 목적지로 가는 CTA 블록을 통째로 들어낸다 */
function removeUntrustedCta(html) {
  let removed = 0;
  let out = html;

  // CTA 버튼을 감싼 가장 가까운 바깥 div 를 찾아 통째로 지운다
  const badHrefRe = /https?:\/\/[^"']*(?:postmate\.waffle-gl\.org|waffle-gl\.org)[^"']*/i;
  while (badHrefRe.test(out)) {
    const at = out.search(badHrefRe);
    // 버튼 앞쪽에서 CTA 컨테이너 시작점을 찾는다
    const head = out.lastIndexOf('<div', Math.max(0, at - 1));
    if (head < 0) break;
    // 그 div 의 짝을 센다
    let i = head;
    let depth = 0;
    let end = -1;
    const tagRe = /<div\b[^>]*>|<\/div>/gi;
    tagRe.lastIndex = head;
    let m;
    while ((m = tagRe.exec(out)) !== null) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) { end = m.index + m[0].length; break; }
      i = m.index;
    }
    if (end < 0) break;
    out = out.slice(0, head) + out.slice(end);
    removed += 1;
    if (removed > 5) break;   // 안전장치
  }
  return { html: out, removed };
}

/** ② 날 URL → 기관명 앵커. 깨진 &#038; 도 되살린다 */
function fixBareUrls(html) {
  let fixed = 0;
  let out = html;

  const LABEL = [
    { re: /law\.go\.kr/i, name: '국가법령정보센터' },
    { re: /scourt\.go\.kr/i, name: '대법원' },
  ];

  // 태그 밖에 노출된 http(s) 주소만 잡는다 (href="..." 안쪽은 건드리지 않는다)
  out = out.replace(/(^|[>\s(])(https?:\/\/(?:www\.)?(?:law|scourt)\.go\.kr[^\s<)"']*)/gi, (full, pre, url) => {
    const clean = url.replace(/&#0?38;/g, '&').replace(/&amp;/g, '&');
    const label = (LABEL.find((l) => l.re.test(clean)) || {}).name || '공식 문서';
    fixed += 1;
    return `${pre}<a href="${clean.replace(/&/g, '&amp;')}" target="_blank" rel="nofollow noopener">${label} 원문</a>`;
  });

  return { html: out, fixed };
}

/**
 * ④ 빈 블록 제거 — 사장님: "이거 공란도"
 *
 * 실측: `<blockquote class="bgpt-s11"></blockquote>` 가 4개. 테두리만 있는 빈 상자로 그려진다.
 * 빈 블록 가드(empty-block-guard)가 있지만 heading·faq·cell 만 보고 blockquote 는 안 본다.
 */
function removeEmptyBlocks(html) {
  let removed = 0;
  const EMPTY = [
    /<blockquote\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/blockquote>/gi,
    /<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi,
    /<li\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/li>/gi,
  ];
  let out = html;
  for (const re of EMPTY) {
    out = out.replace(re, () => { removed += 1; return ''; });
  }
  return { html: out, removed };
}

/** ③ 번호형 소제목 → 설명형 ("1. 제목" / "1-1. 제목" 의 번호만 뗀다) */
function deNumberHeadings(html) {
  let fixed = 0;
  const out = html.replace(/(<h[23][^>]*>)([\s\S]*?)(<\/h[23]>)/gi, (full, open, inner, close) => {
    const stripped = inner.replace(/^(\s*)(\d+(?:-\d+)?\.\s*)/, (m, sp) => { fixed += 1; return sp; });
    return stripped === inner ? full : `${open}${stripped}${close}`;
  });
  return { html: out, fixed };
}

(async () => {
  console.log(`🔎 ${SITE} · 글 ${POST_ID}`);
  const post = await wpGet(`posts/${POST_ID}?context=edit&_fields=id,title,content,link`);
  const before = post.content.raw;
  console.log(`제목: ${post.title.raw || post.title.rendered}`);
  console.log(`원본 본문: ${before.length}자\n`);

  const cta = removeUntrustedCta(before);
  const urls = fixBareUrls(cta.html);
  const heads = deNumberHeadings(urls.html);
  const empties = removeEmptyBlocks(heads.html);
  const after = empties.html;

  console.log(`① 신뢰 불가 CTA 블록 제거 : ${cta.removed}개`);
  console.log(`② 날 URL → 기관 앵커      : ${urls.fixed}개`);
  console.log(`③ 번호형 소제목 정리      : ${heads.fixed}개`);
  console.log(`④ 빈 블록(공란 상자) 제거 : ${empties.removed}개`);
  console.log(`\n본문 ${before.length} → ${after.length}자`);
  console.log(`남은 waffle-gl 링크 : ${(after.match(/waffle-gl/gi) || []).length}개 (0이어야 함)`);
  console.log(`남은 &#038;         : ${(after.match(/&#0?38;/g) || []).length}개`);

  const h = [...after.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
  console.log('\n바뀐 H2:');
  h.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  if (!apply) {
    console.log('\n(미리보기입니다 — 저장하려면 --apply)');
    return;
  }

  await wpPutContent(POST_ID, after);
  const check = await wpGet(`posts/${POST_ID}?context=edit&_fields=content`);
  const saved = check.content.raw;
  console.log('\n✅ 저장 완료');
  console.log(`  waffle-gl 링크: ${(saved.match(/waffle-gl/gi) || []).length}개`);
  console.log(`  번호형 소제목 : ${(saved.match(/<h[23][^>]*>\s*\d+(-\d+)?\./gi) || []).length}개`);
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
