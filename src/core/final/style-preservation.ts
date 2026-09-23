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

import { createHash } from 'crypto';
import * as cheerio from 'cheerio';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

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
 * html/body 속성을 각각의 <div> 로 옮기고 CSS AST의 html/body/:root 선택자를 그 래퍼로 연결한다.
 * 인라인 스타일 규칙은 문서별 영역에 한정한다. 외부 link/@import 파일은 내려받거나 변경하지 않는다.
 * 문서가 아니면 손대지 않는다.
 */
export function flattenDocumentForPost(html: string): { html: string; flattened: boolean } {
  const source = String(html || '');
  if (!/<html\b/i.test(source) || !/<body\b/i.test(source)) return { html: source, flattened: false };

  // Parse attributes as HTML, then let the serializer escape quotes and entities.
  // A regex cannot safely read style='font-family:"A > B"' or preserve html attrs.
  const $ = cheerio.load(source);
  const htmlElement = $('html').first();
  const bodyElement = $('body').first();
  const scopeId = createHash('sha256').update(source).digest('hex').slice(0, 16);
  $('style').each((_index, element) => {
    $(element).text(adaptDocumentCss($(element).text(), scopeId));
  });

  // One DOM traversal preserves the cascade order of interleaved links/styles.
  const headStyles = $('head').children().filter((_i, element) =>
    $(element).is('style') || ($(element).is('link')
      && /(?:^|\s)stylesheet(?:\s|$)/i.test($(element).attr('rel') || '')),
  );
  const bodyWrapper = $('<div></div>');
  const bodyNode = bodyElement[0]!;
  if ('attribs' in bodyNode) {
    for (const [name, value] of Object.entries(bodyNode.attribs)) bodyWrapper.attr(name, value);
  }
  bodyWrapper.attr('class', ['orbit-import', bodyElement.attr('class')].filter(Boolean).join(' '));
  bodyWrapper.attr('data-orbit-document-body', scopeId);
  bodyWrapper.append(bodyElement.contents());
  const rootWrapper = $('<div></div>');
  const htmlNode = htmlElement[0]!;
  if ('attribs' in htmlNode) {
    for (const [name, value] of Object.entries(htmlNode.attribs)) rootWrapper.attr(name, value);
  }
  rootWrapper.attr('data-orbit-document-root', scopeId);
  rootWrapper.append(headStyles).append(bodyWrapper);
  return { html: $.html(rootWrapper), flattened: true };
}

/** Rewrite selector nodes only: declaration strings, URLs, keyframes and media stay intact. */
function adaptDocumentCss(css: string, scopeId: string): string {
  const rootSelector = `[data-orbit-document-root="${scopeId}"]`;
  const bodySelector = `[data-orbit-document-body="${scopeId}"]`;
  const nodeFrom = (selector: string) => selectorParser().astSync(selector).first!.first!;
  const sheet = postcss.parse(css);
  sheet.walkRules(rule => {
    // 'from', 'to' and '50%' are animation steps, not document selectors.
    for (let ancestor: postcss.AnyNode | undefined = rule.parent; ancestor; ancestor = ancestor.parent) {
      if (ancestor.type === 'atrule' && /(?:^|-)keyframes$/i.test(ancestor.name)) return;
    }
    rule.selector = selectorParser(selectors => {
      selectors.walkTags(tag => {
        if (tag.namespace) return;
        const name = tag.value.toLowerCase();
        if (name === 'div') {
          // The transport wrappers were html/body in the original document.
          // Author rules for ordinary divs must not start styling them.
          tag.parent!.insertAfter(tag, nodeFrom(`:not(:where(${rootSelector}, ${bodySelector}))`).clone());
          return;
        }
        if (name !== 'html' && name !== 'body') return;
        tag.value = 'div';
        // A type selector keeps its original specificity (the marker adds zero).
        tag.parent!.insertAfter(tag, nodeFrom(`:where(${name === 'html' ? rootSelector : bodySelector})`).clone());
      });
      selectors.walkPseudos(pseudo => {
        if (pseudo.value.toLowerCase() === ':root') pseudo.replaceWith(nodeFrom(rootSelector).clone());
      });
      // Constrain the selected subject, including the root itself. Prefixing a
      // descendant selector would incorrectly exclude html/:root rules.
      selectors.each(selector => {
        const scope = nodeFrom(`:where(${rootSelector}, ${rootSelector} *)`).clone();
        const pseudoElement = selector.nodes.find(node => node.type === 'pseudo'
          && /^(?:::|:(?:before|after|first-line|first-letter)$)/i.test(node.value));
        if (pseudoElement) selector.insertBefore(pseudoElement, scope);
        else selector.append(scope);
      });
    }).processSync(rule.selector);
  });
  return sheet.toString();
}
