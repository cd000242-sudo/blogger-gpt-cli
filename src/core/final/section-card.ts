/**
 * H3 섹션을 카드로 묶는다 (v3.8.413)
 *
 * 사용자 지적(2026-08-02):
 *   "h3랑 본문은 박스로 못 감나요? 스킨이 깔끔하고 이쁘면서 고급져야 되는데 끝판왕이 아닌데..?"
 *
 * 지금은 H3 도 본문도 그냥 위에서 아래로 흐른다.
 * 글이 길어지면 어디서 한 덩어리가 끝나고 다음이 시작되는지 눈으로 안 잡힌다.
 * 소제목과 그 아래 내용을 **한 장의 카드**로 묶으면 읽는 사람이 덩어리를 인식한다.
 *
 * 왜 인라인 스타일인가:
 *   블로그스팟·워드프레스·티스토리 모두 외부 CSS 를 못 붙이거나 스킨이 덮어쓴다.
 *   실제로 발행되는 건 인라인 스타일뿐이라 여기서 전부 인라인으로 박는다.
 *
 * ⚠️ 이미 카드 안에 있는 것(CTA 카드·FAQ 박스)은 두 번 감싸지 않는다.
 */

/** 카드 한 장 — 흰 바탕, 얇은 테두리, 부드러운 그림자. 요란하지 않게. */
const CARD_OPEN =
  '<section data-orbit-card="1" style="'
  + 'background:#ffffff;'
  + 'border:3px solid #d5dde7;'   /* v3.8.433: 경계를 분명하게 */
  + 'border-radius:18px;'
  // v3.8.413 모바일 — 사용자 요구 "어떤 모드든 모바일 친화적으로 최적화"
  //   좁은 화면에서 좌우 24px 씩 먹으면 본문 폭이 확 줄어 글이 답답해진다.
  //   clamp 로 화면이 좁을수록 안쪽 여백을 줄인다(최소 14px).
  + 'padding:clamp(16px,4.2vw,26px) clamp(14px,3.8vw,24px) 8px;'
  + 'margin:clamp(18px,4.5vw,26px) 0;'
  + 'box-shadow:0 1px 2px rgba(16,24,40,.04), 0 8px 24px -12px rgba(16,24,40,.10);'
  // 표·긴 URL 이 카드를 뚫고 나가 가로 스크롤을 만들지 않게 한다
  + 'max-width:100%;'
  + 'box-sizing:border-box;'
  + 'overflow-wrap:break-word;'
  + '">';

const CARD_CLOSE = '</section>';

/** 카드 안에 들어갈 H3 — 카드가 이미 테두리를 가지니 소제목은 담백하게. */
export const H3_IN_CARD_STYLE =
  'color:#0f172a;'
  + 'font-size:clamp(19px,4.9vw,22px);'
  + 'font-weight:800;'
  + 'letter-spacing:-0.02em;'
  + 'line-height:1.45;'
  + 'margin:0 0 16px 0;'
  + 'padding:0 0 14px 0;'
  + 'border-bottom:1px solid #eef1f5;'
  + 'word-break:keep-all;';

/**
 * 글 안에서 '감싸면 안 되는 구간'인지 본다.
 * FAQ·CTA 처럼 이미 자기 박스를 가진 블록을 또 감싸면 액자 속 액자가 된다.
 */
function alreadyBoxed(chunk: string): boolean {
  // v3.8.433: data-orbit-h3box — H3 가 스스로 파스텔 박스를 두른 경우.
  //   이걸 흰 카드로 또 감싸면 액자 속 액자가 된다(사용자 지적: "경계를 애매하게
  //   하지말고 명확히 보이게"). 자기 박스가 있으면 그걸로 충분하다.
  return /data-orbit-cta|data-orbit-card|data-orbit-h3box|itemtype="https:\/\/schema\.org\/(FAQPage|Question)"/i.test(chunk);
}

/** 눈에 보이는 내용이 있는가 — 빈 태그만 있는 조각은 카드로 만들 필요가 없다. */
function hasVisibleContent(chunk: string): boolean {
  return chunk.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '').length > 0;
}

/**
 * 이 조각을 감싸도 태그가 교차하지 않는가.
 *
 * 실측 버그(개발 중): CTA 카드 안의 H3 를 감쌌더니
 *   <div data-orbit-cta><section><h3>…</p></div></section>
 * 처럼 </div> 와 </section> 이 엇갈렸다. 브라우저가 제멋대로 고쳐 레이아웃이 깨진다.
 *
 * 원인은 '이미 박스인가' 판정을 **H3 뒤쪽만** 보고 했기 때문이다.
 * 마커는 H3 **앞쪽 부모**에 있어서 안 걸렸다.
 *
 * 앞뒤를 다 뒤지는 대신 더 확실한 걸 본다 —
 * 조각 안에서 컨테이너 여닫이 수가 안 맞으면 그 H3 는 남의 상자 안에 있다는 뜻이다.
 * 그러면 감싸지 않는다.
 */
function containersBalanced(chunk: string): boolean {
  for (const tag of ['div', 'section', 'article', 'aside', 'blockquote', 'figure', 'table']) {
    const opens = (chunk.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
    const closes = (chunk.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    if (opens !== closes) return false;
  }
  return true;
}

/**
 * H3 부터 다음 H2/H3 직전까지를 한 장의 카드로 묶는다.
 *
 * @param html 인라인 스타일이 이미 주입된 본문
 */
export function wrapH3Sections(html: string): { html: string; wrapped: number } {
  const src = String(html || '');
  if (!src.trim()) return { html: src, wrapped: 0 };
  // 이미 감싼 글을 다시 돌려도 두 번 감싸지 않는다(수정발행 재처리 대비)
  if (src.includes('data-orbit-card')) return { html: src, wrapped: 0 };

  // H2/H3 여는 태그 위치를 모두 찾는다 — 경계로만 쓰고 태그 자체는 건드리지 않는다
  const boundary = /<h([23])(\s[^>]*)?>/gi;
  const marks: Array<{ index: number; level: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(src)) !== null) {
    marks.push({ index: m.index, level: Number(m[1]) });
  }
  if (!marks.length) return { html: src, wrapped: 0 };

  const pieces: string[] = [];
  let cursor = 0;
  let wrapped = 0;

  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i]!;
    if (mark.level !== 3) continue;                    // H2 는 카드로 안 묶는다(큰 제목은 밖에 둔다)

    const end = marks[i + 1]?.index ?? src.length;     // 다음 H2/H3 직전까지가 이 섹션이다
    const chunk = src.slice(mark.index, end);
    if (alreadyBoxed(chunk) || !hasVisibleContent(chunk) || !containersBalanced(chunk)) continue;

    pieces.push(src.slice(cursor, mark.index));        // 카드 앞의 원본
    pieces.push(CARD_OPEN, chunk, CARD_CLOSE);
    cursor = end;
    wrapped += 1;
  }
  if (!wrapped) return { html: src, wrapped: 0 };

  pieces.push(src.slice(cursor));
  return { html: pieces.join(''), wrapped };
}
