/**
 * Spider (cornerstone) post — last step before the response: let it through the publishers as it is.
 *
 * Why: the spider post is `sw-cornerstone` + inline styles + its own `<style>` (`.max-mode-article …`). Without a
 * pass-through marker the publishers took the legacy path: a `.wp-styled-content` wrapper with 860/1000px
 * `!important` widths, h2/h3 rewritten, our own `max-width:760px` on top of the theme width (WordPress), and
 * the post's `<style>` deleted plus a teal inline repaint (Blogger).
 *
 * The first fix also put the ordinary-post app skin (generateCSSFinal, ~44KB `<style>`) on the spider post. Measured
 * on a real post that skin fights the spider's own design: the summary box got a dark background under dark inline
 * text (and white-on-white on mobile), the related-posts grid fell into the skin's table-to-card rule, and table
 * cells got a monospace font with letter spacing. The spider post already carries its whole design, so no skin
 * CSS is added any more — only the marker the publishers look for.
 *
 * What it does:
 *   1. removes every body <h1> (the platform renders the title; a passed-through post gets no publisher cleanup)
 *   2. releases the spider root's own `max-width` so the theme decides the width (no double narrowing), and the
 *      `!important` on table cells' inline percent width so the post's mobile rule can stack them
 *      and raises a CTA button's inline `font-size` below 17px to 17px (format only — the wording is never touched)
 *   3. WordPress / Blogger: wraps the body in `<article class="bgpt-wp-ready">` / `<article class="bgpt-blogger-ready">`.
 *      WordPress hands such a post back untouched (wordpress-publisher: `bgpt-wp-ready`); Blogger's applyInlineStyles does
 *      the same (`bgpt-blogger-ready`) and its forced inline-style step skips it (`carriesSpiderFrame`).
 *      If the Agent already wrapped the whole body in an article carrying the marker, that article is kept (no second one).
 *   Other platforms (Tistory …) only get 1 and 2 — their editor owns the look.
 * Running it twice gives the same result.
 */

export type SpiderFinishPlatform = 'wordpress' | 'blogger' | 'other';

export interface SpiderFinishResult {
  html: string;
  platform: SpiderFinishPlatform;
  /** Short notes for the diagnostic log. */
  changes: string[];
}

export function normalizeSpiderFinishPlatform(raw: unknown): SpiderFinishPlatform {
  const value = String(raw ?? '').toLowerCase();
  if (/wordpress|^wp$|워드프레스/.test(value)) return 'wordpress';
  if (/blogger|blogspot|블로거|블로그스팟/.test(value)) return 'blogger';
  return 'other';
}

const H1_BLOCK = /\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*(?:<br\s*\/?>\s*)*/gi;
// <style>, <script> (JSON-LD) and comments in front of the article stay outside the frame
const LEADING_NON_BODY = /^(?:\s+|<style\b[\s\S]*?<\/style\s*>|<script\b[\s\S]*?<\/script\s*>|<!--[\s\S]*?-->)*/i;
const SPIDER_ROOT_OPEN = /<(?:div|article|section)\b[^>]*\bclass\s*=\s*(["'])[^"']*\b(?:sw-cornerstone|max-mode-article)\b[^"']*\1[^>]*>/i;
// An ordinary post that already carries the app skin is left alone (same as before)
const ALREADY_SKINNED = /\bclass\s*=\s*["'][^"']*\bbgpt-content\b/i;
const MARKER_CLASS: Record<'wordpress' | 'blogger', string> = { wordpress: 'bgpt-wp-ready', blogger: 'bgpt-blogger-ready' };
const ARTICLE_OPEN_AT_START = /^<article(?=[\s>/])[^>]*>/i;
const ARTICLE_TOKEN = /<(\/?)article(?=[\s>/])[^>]*>/gi;
const CLASS_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

/** True when the whole body is ONE <article> (its matching close is the very last tag) that carries `marker`. */
function isWrappedInMarkerArticle(body: string, marker: string): boolean {
  const text = body.trim();
  const open = text.match(ARTICLE_OPEN_AT_START);
  if (!open) return false;
  const classAttr = open[0].match(CLASS_ATTR);
  const classes = (classAttr?.[1] ?? classAttr?.[2] ?? '').split(/\s+/);
  if (!classes.includes(marker)) return false;
  let depth = 0;
  for (const token of text.matchAll(ARTICLE_TOKEN)) {
    depth += token[1] ? -1 : 1;
    if (depth <= 0) return (token.index ?? 0) + token[0].length === text.length;
  }
  return false;
}

/**
 * True for a spider post that was framed for Blogger: a `bgpt-blogger-ready` article around a `sw-cornerstone` root.
 * The Blogger publisher uses it to skip its forced inline-style step (which would repaint the spider's bare
 * h2/p/li/strong/span over the post's own `<style>`). Ordinary posts never match — they have no `sw-cornerstone`.
 */
export function carriesSpiderFrame(html: string): boolean {
  const src = String(html || '');
  return /<article\b[^>]*\bclass\s*=\s*["'][^"']*\bbgpt-blogger-ready\b/i.test(src)
    && /\bclass\s*=\s*["'][^"']*\bsw-cornerstone\b/i.test(src);
}

/** Drops `max-width` from the root's inline style only; every other declaration stays byte for byte. */
function releaseRootWidthLock(openTag: string): string {
  return openTag.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i, (whole, quote: string, css: string) => {
    if (!/max-width\s*:/i.test(css)) return whole;
    const kept = css.replace(/(^|;)\s*max-width\s*:[^;]*(?=;|$)/gi, '$1').replace(/;{2,}/g, ';').replace(/^;/, '').trim();
    return kept ? `style=${quote}${kept}${quote}` : '';
  });
}

const CELL_OPEN = /<(?:td|th)\b[^>]*>/gi;
const CELL_WIDTH_LOCK = /((?:^|;)\s*width\s*:\s*[\d.]+%)\s*!important\s*(?=;|$)/gi;

/**
 * Drops `!important` from a table cell's inline percent `width` (the value stays). An inline `!important` beats the
 * post's own mobile rule `.max-mode-article td{width:100% !important}`, so the related-posts cards stayed half
 * wide on a phone (measured 2026-11-11). `max-width` / `min-width` and the table itself are not touched.
 */
function releaseCellWidthLocks(body: string): { html: string; released: number } {
  let released = 0;
  const html = body.replace(CELL_OPEN, (tag) => tag.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i, (whole, quote: string, css: string) => {
    const next = css.replace(CELL_WIDTH_LOCK, '$1');
    if (next === css) return whole;
    released += 1;
    return `style=${quote}${next}${quote}`;
  }));
  return { html, released };
}

const ANCHOR_OPEN = /<a\b[^>]*>/gi;
// What the spider CTA button style (buildSpiderCtaButtonStyle) always carries; an ordinary link has none of this together
const CTA_BUTTON_MARKS = [/display\s*:\s*inline-block/i, /word-break\s*:\s*keep-all/i, /white-space\s*:\s*normal/i, /(?:^|;)\s*color\s*:\s*#fff(?:fff)?\b/i];
const CTA_FONT_SIZE = /(^|;)(\s*font-size\s*:\s*)(\d+(?:\.\d+)?)px/i;
const CTA_MIN_FONT_PX = 17;

/** Raises a CTA button's inline font-size to 17px when it is smaller. Never lowers it, never edits the text. */
function raiseCtaButtonFontSize(body: string): { html: string; raised: number } {
  let raised = 0;
  const html = body.replace(ANCHOR_OPEN, (tag) => tag.replace(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i, (whole, quote: string, css: string) => {
    if (!CTA_BUTTON_MARKS.every((mark) => mark.test(css))) return whole;
    const next = css.replace(CTA_FONT_SIZE, (found, lead: string, label: string, px: string) =>
      Number(px) < CTA_MIN_FONT_PX ? `${lead}${label}${CTA_MIN_FONT_PX}px` : found);
    if (next === css) return whole;
    raised += 1;
    return `style=${quote}${next}${quote}`;
  }));
  return { html, raised };
}

export function finishSpiderHtml(html: string, opts: { platform: unknown }): SpiderFinishResult {
  const platform = normalizeSpiderFinishPlatform(opts.platform);
  const source = String(html ?? '');
  const changes: string[] = [];
  if (!source.trim()) return { html: source, platform, changes };

  let next = source.replace(H1_BLOCK, () => {
    changes.push('본문 H1 제거');
    return '\n';
  });

  const bodyStart = (next.match(LEADING_NON_BODY) || [''])[0].length;
  const head = next.slice(0, bodyStart);
  let body = next.slice(bodyStart);
  body = body.replace(SPIDER_ROOT_OPEN, (tag) => {
    const released = releaseRootWidthLock(tag);
    if (released !== tag) changes.push('종합글 자체 폭 고정(max-width) 해제');
    return released;
  });
  const cells = releaseCellWidthLocks(body);
  if (cells.released > 0) {
    body = cells.html;
    changes.push(`표 칸 폭 고정(!important) 해제 ${cells.released}곳 — 모바일에서 한 줄로 쌓이게`);
  }
  const buttons = raiseCtaButtonFontSize(body);
  if (buttons.raised > 0) {
    body = buttons.html;
    changes.push(`CTA 버튼 글자 크기 ${buttons.raised}곳을 17px 로 맞춤 (문구는 그대로)`);
  }
  next = head + body;

  if (platform === 'other' || ALREADY_SKINNED.test(next) || !body.trim()) {
    return { html: next, platform, changes };
  }

  const marker = MARKER_CLASS[platform];
  if (isWrappedInMarkerArticle(body, marker)) {
    changes.push(`에이전트가 감싼 article(${marker}) 을 그대로 유지 (스킨 CSS 없음)`);
    return { html: next, platform, changes };
  }
  changes.push(`통과 표식 입힘 (${marker}) — 스킨 CSS 는 넣지 않음`);
  return { html: `${head}<article class="${marker}">${body}</article>`, platform, changes };
}
