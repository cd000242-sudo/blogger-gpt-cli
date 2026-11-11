/**
 * Did the Agent's article get written to the end? (Agent mode only; API mode keeps its own continuation logic.)
 *
 * The old `looksTruncated` mixed two kinds of signals:
 *  - structural ones that a finished article basically never shows -> `hard`, the run fails:
 *      · the text ends inside a tag (`<a href="https://exa`)
 *      · a <ul>/<ol>/<table> that is never closed
 *      · more than 2 <div> left open (a nested card layout cut off)
 *      · the cornerstone root (`<div class="sw-cornerstone …">`) is never closed, however few divs are missing
 *        (the article stopped at a `</p>` inside the root)
 *  - heuristics with many false positives -> `soft`, only a warning on the finished screen:
 *      · 1-2 <div> left open in an article that has no cornerstone root marker
 *      · the last tag is not one of div/p/li/table/ul/ol/aside (e.g. a valid </section> ending)
 *      · the last visible Korean syllable has no sentence punctuation (headings, list items, "…" endings)
 *
 * Tag matching is name-exact: `<table-of-contents>` is not a <table>, and `</ul >` closes a <ul>.
 */
export interface SpiderCompleteness {
  hard: string[];
  soft: string[];
}

const count = (html: string, re: RegExp): number => (html.match(re) || []).length;

/** The tag name must end at whitespace, `>` or `/` — so custom elements like <table-of-contents> never match. */
const openTagRe = (tag: string): RegExp => new RegExp(`<${tag}(?=[\\s>/])`, 'gi');
const closeTagRe = (tag: string): RegExp => new RegExp(`</${tag}(?=[\\s>/])`, 'gi');

const DIV_TOKEN = /<(\/?)div(?=[\s>/])[^>]*>/gi;
const CLASS_ATTR = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const ROOT_CLASS = 'sw-cornerstone';

function isCornerstoneRootOpen(tag: string): boolean {
  const match = tag.match(CLASS_ATTR);
  const classes = (match?.[1] ?? match?.[2] ?? '').split(/\s+/);
  return classes.includes(ROOT_CLASS);
}

/** Walks the <div> opens/closes in order. Returns whether a cornerstone root exists and whether it was left open. */
function inspectCornerstoneRoot(html: string): { present: boolean; unclosed: boolean } {
  let depth = 0;
  let rootDepth = -1; // depth right before the root's own open tag; -1 until a root is seen
  let present = false;
  let closed = false;
  for (const token of html.matchAll(DIV_TOKEN)) {
    if (token[1]) {
      depth = Math.max(0, depth - 1);
      if (present && !closed && depth <= rootDepth) closed = true;
    } else {
      if (!present && isCornerstoneRootOpen(token[0])) {
        present = true;
        rootDepth = depth;
      }
      depth += 1;
    }
  }
  return { present, unclosed: present && !closed };
}

export function judgeSpiderCompleteness(html: string): SpiderCompleteness {
  const cleaned = String(html || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .trim();
  const hard: string[] = [];
  const soft: string[] = [];
  if (!cleaned) return { hard, soft };

  if (/<[^>]*$/.test(cleaned)) hard.push('글 끝이 태그 중간에서 끊겼습니다');
  for (const tag of ['ul', 'ol', 'table']) {
    const open = count(cleaned, openTagRe(tag));
    const close = count(cleaned, closeTagRe(tag));
    if (open - close > 0) hard.push(`<${tag}> 가 닫히지 않았습니다 (${open - close}개)`);
  }
  const divDeficit = count(cleaned, openTagRe('div')) - count(cleaned, closeTagRe('div'));
  const root = inspectCornerstoneRoot(cleaned);
  if (divDeficit > 2) {
    hard.push(`<div> ${divDeficit}개가 닫히지 않았습니다`);
  } else if (divDeficit > 0 && root.unclosed) {
    hard.push(`글의 마지막 부분이 닫히지 않았습니다 (종합글 바깥 <div> 가 닫히지 않음, 모자란 <div> ${divDeficit}개)`);
  } else if (divDeficit > 0) {
    soft.push(`<div> ${divDeficit}개가 닫히지 않았습니다 (글 끝이 잘렸을 수 있습니다)`);
  }

  if (!/<\/(div|p|li|table|ul|ol|aside)\s*>\s*$/i.test(cleaned.slice(-400))) {
    soft.push('글이 div·p·li·table·ul·ol·aside 닫는 태그로 끝나지 않았습니다');
  }
  const lastVisible = cleaned.replace(/<[^>]+>/g, '').trim().slice(-30);
  if (/[가-힣]$/.test(lastVisible) && !/[.?!。？！」』]\s*$/.test(lastVisible)) {
    soft.push('마지막 문장이 문장부호 없이 끝났습니다');
  }
  return { hard, soft };
}
