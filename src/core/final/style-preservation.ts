/**
 * style-preservation — **밖에서 가져온 HTML 의 스킨은 그대로 둔다.** (v3.8.729)
 *
 * 사장님: "LLM 에서 글 생성을 하고 HTML 로 변환해서 편집기에 들고왔는데 편집기에서는 그 CSS 가 그대로 있는데
 *          발행만 하면 CSS 가 충돌을 하거든? 외부에서 가져온 글이 있다면 억지로 앱에 있는 스킨으로 씌우려 하지 말고
 *          외부에서 가져온 스킨을 그대로 쓰게 냅둬. 충돌하니까 스킨이 이상해지고 깨져 버려"
 *
 * 발행기(blogger-publisher · wordpress-publisher)는 글이 어디서 왔든 앱 스킨(래퍼·인라인 스타일 강제·WP 핵 옵션 CSS)을
 * 덮어씌운다. 앱이 만든 글에는 그게 맞지만, 자기 <style> 을 들고 온 글에는 두 스킨이 부딪혀 깨진다.
 *
 * ## 판정 (둘 중 하나)
 *   ① 편집기가 **파일·붙여넣기** 글이라고 표를 달아 보냈다 (payload.preserveOriginalStyles === true)
 *   ② 표가 없어도 본문이 **자기 스타일시트**(<style> 또는 <link rel=stylesheet>)를 들고 있고, 앱이 만든 글의 표식이 없다
 *
 * 인라인 style= 하나로는 판정하지 않는다 — 에이전트 글은 인라인 스타일이 167개(발행글 5445 실측)라
 * 그 기준이면 에이전트 글까지 스킨을 잃는다(v3.8.606 회귀). 앱 표식(bgpt-content 등)이 있으면 언제나 앱 글이다.
 */

const APP_MARKS = /\bclass\s*=\s*["'][^"']*\b(?:bgpt-content|max-mode-article|sw-cornerstone|wp-styled-content|blogger-gpt-content|bgpt-wp-ready)\b/i;
const STYLE_BLOCK = /<style\b[^>]*>[\s\S]*?<\/style\s*>/i;
const STYLESHEET_LINK = /<link\b[^>]*\brel\s*=\s*(?:"[^"]*\bstylesheet\b[^"]*"|'[^']*\bstylesheet\b[^']*'|stylesheet\b)/i;

/** 본문이 자기 스타일시트를 들고 있는가 (주석 안은 세지 않는다) */
export function hasAuthoredStyles(html: string): boolean {
  const source = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  return STYLE_BLOCK.test(source) || STYLESHEET_LINK.test(source);
}

/** 앱이 만든 글인가 — 스킨·발행기 표식이 하나라도 있으면 그렇다 */
export function looksLikeAppArticle(html: string): boolean {
  return APP_MARKS.test(String(html || ''));
}

/**
 * 이 글의 원본 스타일을 지켜야 하는가.
 * @param explicit 편집기가 단 표 — true 면 묻지 않고 지킨다. undefined 면 본문을 보고 정한다.
 */
export function shouldPreserveOriginalStyles(html: string, explicit?: boolean): boolean {
  const source = String(html || '');
  if (explicit === true || source.includes('<!-- orbit:preserve-original-styles -->')) return true;
  if (looksLikeAppArticle(source)) return false;
  return hasAuthoredStyles(source);
}

/**
 * 통째 문서(<!doctype html><html><head>…</head><body>…</body></html>)를 **글 본문에 실을 모양**으로 편다.
 *
 * 편집기는 파일·붙여넣기 글을 문서 그대로 들고 있다. 그걸 그대로 포스트 본문에 넣으면 <title>·<meta>·<html> 이
 * 본문 한가운데 박힌다. head 에서는 스타일시트(<style>·<link rel=stylesheet>)만 살리고, body 의 class·style 은
 * 감싸는 <div> 로 옮긴다 — `.custom p {…}` 처럼 body 의 클래스에 기대는 선택자가 계속 맞도록.
 * 문서가 아니면 손대지 않는다.
 */
export function flattenDocumentForPost(html: string): { html: string; flattened: boolean } {
  const source = String(html || '');
  const bodyMatch = source.match(/<body\b([^>]*)>([\s\S]*?)<\/body\s*>/i);
  if (!/<html\b/i.test(source) || !bodyMatch) return { html: source, flattened: false };

  const headMatch = source.match(/<head\b[^>]*>([\s\S]*?)<\/head\s*>/i);
  const head = headMatch ? headMatch[1]! : '';
  const keptFromHead = [
    ...(head.match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) || []),
    ...(head.match(/<link\b[^>]*>/gi) || []).filter((tag) => STYLESHEET_LINK.test(tag)),
  ];

  const attrs = bodyMatch[1] || '';
  const classAttr = attrs.match(/\bclass\s*=\s*("([^"]*)"|'([^']*)')/i);
  const styleAttr = attrs.match(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
  const classes = ['orbit-import', classAttr ? (classAttr[2] ?? classAttr[3] ?? '') : ''].filter(Boolean).join(' ');
  const style = styleAttr ? (styleAttr[2] ?? styleAttr[3] ?? '') : '';
  const wrapperOpen = `<div class="${classes}"${style ? ` style="${style}"` : ''}>`;

  return {
    html: `${keptFromHead.join('\n')}${keptFromHead.length ? '\n' : ''}${wrapperOpen}${bodyMatch[2]}</div>`,
    flattened: true,
  };
}
