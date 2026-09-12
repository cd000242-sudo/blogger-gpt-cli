/**
 * wp-html-block — 본문을 **구텐베르크 HTML 블록**으로 감싼다. (v3.8.726)
 *
 * ## 왜 (사장님: "미리보기 그대로 나오면 좋겠는데")
 * 편집기(미리보기)는 워드프레스에 **저장된 원본**을 보여준다. 그런데 실제 페이지는
 * 그 원본에 워드프레스가 `wpautop` 을 한 번 더 씌운 결과다. 그래서 둘이 갈렸다.
 *
 * 실측(발행글 5714):
 *   저장된 원본 : <p> 48개 · </p> 48개      ← 짝이 맞는다
 *   실제 화면   : <p> 53개 · </p> 78개      ← **짝 없는 </p> 25개**
 * 짝 없는 `</p>` 는 브라우저가 빈 문단으로 그린다 — 글 중간중간이 벌어지는 그 증상이다.
 *
 * ## 무엇을 하나
 * 본문을 `<!-- wp:html --> … <!-- /wp:html -->` 로 감싼다. 워드프레스는 그 안을
 * **손대지 않고 그대로** 내보낸다.
 *
 * 같은 글로 직접 실험해 확인했다:
 *   감싸기 전 : 짝 없는 </p> 25개
 *   감싼 뒤   : 짝 없는 </p> **0개** (원본과 화면이 완전히 같아짐)
 *
 * ## 읽을 때는 벗긴다
 * 편집기는 깨끗한 HTML 을 봐야 한다. 목록·편집으로 불러올 때 주석을 걷어내고,
 * 저장할 때 다시 감싼다. 두 번 감싸지 않도록 이미 감싼 글은 그대로 둔다.
 */

const OPEN = '<!-- wp:html -->';
const CLOSE = '<!-- /wp:html -->';

/** 이미 HTML 블록으로 감싸져 있는가 */
export function isHtmlBlockWrapped(html: string): boolean {
  const trimmed = String(html || '').trim();
  return trimmed.startsWith(OPEN) && trimmed.endsWith(CLOSE);
}

/**
 * 워드프레스에 저장할 모양으로 감싼다.
 * 빈 본문은 감싸지 않는다 — 빈 블록만 남으면 편집 화면이 이상해진다.
 */
export function wrapAsHtmlBlock(html: string): string {
  const body = String(html || '').trim();
  if (!body) return String(html || '');
  if (isHtmlBlockWrapped(body)) return body;
  return `${OPEN}\n${body}\n${CLOSE}`;
}

/**
 * 편집기에 보여줄 모양으로 벗긴다.
 * 감싸져 있지 않으면 그대로 돌려준다(예전 글은 안 감싸져 있다).
 */
export function unwrapHtmlBlock(html: string): string {
  const body = String(html || '').trim();
  if (!isHtmlBlockWrapped(body)) return String(html || '');
  return body.slice(OPEN.length, body.length - CLOSE.length).trim();
}
