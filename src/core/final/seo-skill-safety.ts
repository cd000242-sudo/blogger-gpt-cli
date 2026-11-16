/**
 * claude-seo review pass - reply parsing and the safety gate. Pure functions, no I/O.
 *
 * The review is optional polish. A bad answer (empty, truncated, a changed number, a dropped image) must never
 * reach publishing, so every answer goes through `checkReviewSafety` and anything doubtful means "use the draft".
 */

export interface SafetyVerdict { ok: boolean; reason: string }

/** Visible text only: scripts and styles are removed, tags stripped, whitespace collapsed. */
export function visibleText(html: string): string {
  return String(html || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_RATIO = 0.8;
const MAX_RATIO = 1.25;

/** Tags whose count must stay exactly the same (images, links, tables, headings, schema, embeds). */
const GUARDED_TAGS: Array<{ label: string; re: RegExp }> = [
  { label: '<img', re: /<img(?=[\s>/])/gi },
  { label: '<a', re: /<a(?=[\s>/])/gi },
  { label: '<table', re: /<table(?=[\s>/])/gi },
  { label: '<h2', re: /<h2(?=[\s>/])/gi },
  { label: '<h3', re: /<h3(?=[\s>/])/gi },
  { label: '<script', re: /<script(?=[\s>/])/gi },
  { label: '<iframe', re: /<iframe(?=[\s>/])/gi },
];

/** Numbers such as 1,200 / 2026 / 35% / 3.5. A comma only counts inside a thousands group, so "2025, 2026" is two tokens. */
const NUMBER_RE = /\d+(?:,\d{3})*(?:\.\d+)?%?/g;

const countMatches = (text: string, re: RegExp): number => (text.match(re) || []).length;

/** Decides whether the reviewed article may replace the draft. The first failed check wins. */
export function checkReviewSafety(before: string, after: string): SafetyVerdict {
  const draft = String(before || '');
  const reviewed = String(after || '');
  if (!reviewed.trim()) return { ok: false, reason: '빈 글' };

  const beforeText = visibleText(draft).length;
  const afterText = visibleText(reviewed).length;
  if (beforeText === 0) return { ok: false, reason: '원래 글에 본문 글자가 없음' };
  const textRatio = afterText / beforeText;
  if (textRatio < MIN_RATIO || textRatio > MAX_RATIO) {
    return { ok: false, reason: `글자 수 ${Math.round(textRatio * 100)}% (허용 80~125%)` };
  }
  const htmlRatio = reviewed.length / Math.max(1, draft.length);
  if (htmlRatio < MIN_RATIO || htmlRatio > MAX_RATIO) {
    return { ok: false, reason: `HTML 길이 ${Math.round(htmlRatio * 100)}% (허용 80~125%)` };
  }

  for (const { label, re } of GUARDED_TAGS) {
    const was = countMatches(draft, re);
    const now = countMatches(reviewed, re);
    if (was !== now) return { ok: false, reason: `${label} 개수 ${was}→${now}` };
  }

  // Every number of the draft must still be somewhere in the reviewed text (order does not matter).
  const kept = new Set(reviewed.match(NUMBER_RE) || []);
  const lost = [...new Set(draft.match(NUMBER_RE) || [])].filter((token) => !kept.has(token));
  if (lost.length > 0) return { ok: false, reason: `숫자 사라짐: ${lost.slice(0, 5).join(', ')}${lost.length > 5 ? ' 외' : ''}` };

  return { ok: true, reason: '' };
}

const stripFence = (text: string): string => {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] ?? '' : text).trim();
};

const MAX_NOTES = 3;
/** At most this many edits are applied from one answer. */
export const MAX_PATCHES = 12;
/** A phrase shorter than this is too likely to be ambiguous or to hit the wrong spot. */
const MIN_FIND_CHARS = 15;

export interface ReviewPatch { find: string; replace: string }

/**
 * Takes the edit list between ARTICLE_PATCH_BEGIN / ARTICLE_PATCH_END and up to three "changed" lines after it.
 * The model returns only the phrases to change, not the whole article: re-typing a 14,000-character article took
 * 197 seconds in a live run (2026-11-16), and a longer one would pass the 5-minute limit every time.
 * Strict on purpose: no markers, or no JSON array between them, means no result.
 */
export function parsePatchReply(reply: string): { patches: ReviewPatch[]; dropped: number; notes: string[] } | null {
  const raw = String(reply || '');
  const re = /ARTICLE_PATCH_BEGIN\s*([\s\S]*?)\s*ARTICLE_PATCH_END/gi;
  let found: { items: unknown[]; end: number } | null = null;
  for (let m = re.exec(raw); m; m = re.exec(raw)) {
    try {
      const value: unknown = JSON.parse(stripFence(String(m[1] || '')));
      if (Array.isArray(value)) found = { items: value, end: m.index + m[0].length };
    } catch { /* a marker mentioned in prose, or broken JSON: keep looking */ }
  }
  if (!found) return null;

  const patches: ReviewPatch[] = [];
  let dropped = 0;
  for (const item of found.items) {
    const entry = item as { find?: unknown; replace?: unknown } | null;
    if (entry && typeof entry.find === 'string' && typeof entry.replace === 'string') patches.push({ find: entry.find, replace: entry.replace });
    else dropped += 1;
  }
  const notes = raw.slice(found.end).split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:[-*•·]|\d+[.)])\s+/, '').replace(/^바꾼 곳\s*[:：]\s*/, '').trim())
    .filter((line) => line && !/^바꾼 곳\s*[:：]?$/.test(line))
    .slice(0, MAX_NOTES);
  return { patches, dropped, notes };
}

/** Spans where text must never be edited: every tag (attributes included) and the inside of script / style. */
function markupSpans(html: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const re = /<(script|style)\b[\s\S]*?<\/\1\s*>|<[^>]*>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) spans.push([m.index, m.index + m[0].length]);
  return spans;
}

const countOccurrences = (text: string, part: string): number => (part ? text.split(part).length - 1 : 0);

/**
 * Applies the edits one by one to the article text. An edit that breaks a rule is skipped on its own (with the
 * reason) and the others still apply. Rules: no '<' or '>' on either side (tags cannot be touched), the phrase is at
 * least 15 characters, appears exactly once and only in visible text, and the replacement is a real change.
 */
export function applyPatches(html: string, patches: ReviewPatch[]): { html: string; applied: number; skipped: string[] } {
  let text = String(html || '');
  let applied = 0;
  const skipped: string[] = [];
  patches.forEach((patch, i) => {
    const label = `${i + 1}번`;
    if (i >= MAX_PATCHES) { skipped.push(`${label} 개수 초과`); return; }
    const { find, replace } = patch;
    if (/[<>]/.test(find) || /[<>]/.test(replace)) { skipped.push(`${label} 태그 포함`); return; }
    if (find.trim().length < MIN_FIND_CHARS) { skipped.push(`${label} 찾을 구절이 짧음`); return; }
    if (!replace.trim() || replace === find) { skipped.push(`${label} 바꿀 내용 없음`); return; }
    const times = countOccurrences(text, find);
    if (times !== 1) { skipped.push(`${label} 찾을 구절 ${times}곳`); return; }
    const at = text.indexOf(find);
    if (markupSpans(text).some(([from, to]) => at < to && at + find.length > from)) { skipped.push(`${label} 태그·스크립트 안`); return; }
    text = text.slice(0, at) + replace + text.slice(at + find.length);
    applied += 1;
  });
  return { html: text, applied, skipped };
}
