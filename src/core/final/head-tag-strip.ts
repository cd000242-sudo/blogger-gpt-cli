/**
 * head-tag-strip — `<head>` 에 들어갈 태그가 **본문에 섞여 들어온 것**을 걷어낸다. (v3.8.609)
 *
 * ## 실측 사고 (발행글 5448)
 * 사장님: "실제글에서는 핵심요약위에 왜 빈공간이 생기는거니"
 * 제목과 핵심 요약 사이에 화면 높이 3분의 1쯤 되는 빈 칸이 있었다.
 *
 * 본문 첫머리가 이랬다:
 *   <p><meta name="description" content="…"><br />
 *      <meta name="robots" content="…"><br />
 *      <meta property="og:title" …><br />   … 12개
 *   </p>
 *
 * `<meta>` 는 화면에 안 보인다. 그런데 워드프레스가 그것들을 `<p>` 로 감싸고
 * 사이사이에 `<br />` 를 넣으면서, **보이지 않는 태그가 빈 줄로 쌓였다.**
 * 즉 공백의 정체는 여백 설정이 아니라 **줄바꿈 12개**다.
 *
 * ## 왜 들어왔나
 * 에이전트 지시서가 SEO 메타를 요구하니 모델이 성실하게 본문에 적어 넣었다.
 * 하지만 메타는 `<head>` 소관이고, 워드프레스에서는 Yoast 가 이미 넣는다 —
 * 본문에 있으면 **중복이고, 보이지 않으면서 자리만 차지한다.**
 *
 * ## 무엇을 지우나
 * `<head>` 전용 태그만 지운다. 본문에 쓰이는 태그는 건드리지 않는다.
 * `<style>` 은 **남긴다** — 이 저장소는 본문에 스킨 CSS 를 실어 보낸다(generateCSSFinal).
 */

/** head 에만 들어가는 태그들 — 본문에 있으면 안 보이면서 자리만 먹는다 */
const HEAD_ONLY = /<\s*(meta|link|title|base)\b[^>]*\/?>(?:\s*<\/\s*\1\s*>)?/gi;

/** 태그를 걷어낸 뒤 남는 빈 껍데기 — `<p><br></p>` 같은 것 */
const EMPTY_SHELLS: RegExp[] = [
  /<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi,
  /<div\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/div>/gi,
];

export interface HeadTagStripResult {
  html: string;
  /** 지운 head 태그 수 — 로그용 */
  removed: number;
}

export function stripHeadOnlyTags(html: string): HeadTagStripResult {
  const src = String(html || '');
  if (!src) return { html: src, removed: 0 };

  const matches = src.match(HEAD_ONLY);
  if (!matches || matches.length === 0) return { html: src, removed: 0 };

  let out = src.replace(HEAD_ONLY, '');

  /**
   * 태그가 빠지면 `<p><br /><br /></p>` 만 남는다 — 그게 그대로 빈 줄이다.
   * 껍데기를 반복해서 걷는다(중첩된 것이 한 번에 안 지워진다).
   */
  for (let pass = 0; pass < 3; pass += 1) {
    const before = out;
    for (const shell of EMPTY_SHELLS) out = out.replace(shell, '');
    // 태그 사이에 남은 <br> 연속도 하나로 줄인다
    out = out.replace(/(?:\s*<br\s*\/?>\s*){2,}/gi, '<br />');
    if (out === before) break;
  }

  return { html: out.trim(), removed: matches.length };
}
