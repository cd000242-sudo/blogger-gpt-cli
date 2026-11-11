/**
 * Spider post title: the user's title, else the AI's H1, else stop.
 * A generic placeholder ("종합 가이드", "거미줄치기 통합글") must never become the published title.
 */

export const SPIDER_TITLE_MISSING_MESSAGE = '제목을 만들지 못했습니다. 통합글 제목 칸에 직접 입력해 주세요.';

/** Shown to the model ONLY when the user left the title empty. It is an instruction, never a title. */
export const SPIDER_PROMPT_TITLE_PLACEHOLDER = '(미정 — 아래 자료를 아우르는 새 제목을 H1에 직접 작성하세요)';

/**
 * Seed for the eye-comfort palette pick when no title was typed. Keeps the colour choice identical to
 * the old behaviour; it is never used as a title.
 */
export const SPIDER_PALETTE_SEED_TITLE = '종합 가이드';

/** Whitespace-free keys. electron/ui/modules/internal-links.js keeps the same list (SW_GENERIC_TITLES); a test compares them. */
export const SPIDER_GENERIC_TITLE_KEYS: readonly string[] = ['종합가이드', '거미줄치기통합글', '통합글', '종합글', '제목없음', 'untitled'];
const GENERIC_TITLE_KEYS = new Set(SPIDER_GENERIC_TITLE_KEYS);

function titleKey(value: unknown): string {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function isGenericSpiderTitle(value: unknown): boolean {
  const key = titleKey(value);
  if (!key) return false;
  if (key.startsWith('(미정')) return true;
  return GENERIC_TITLE_KEYS.has(key);
}

export type SpiderTitleDecision =
  | { ok: true; title: string; source: 'user' | 'ai' }
  | { ok: false; error: string };

/** `aiTitles` are tried in order (e.g. [H1, metadata title]); the first non-empty, non-generic one wins. */
export function resolveSpiderTitle(input: { userTitle?: unknown; aiTitle?: unknown; aiTitles?: readonly unknown[] }): SpiderTitleDecision {
  const user = String(input.userTitle ?? '').trim();
  if (user) return { ok: true, title: user, source: 'user' };
  const candidates = [...(input.aiTitles ?? []), input.aiTitle];
  for (const candidate of candidates) {
    const ai = String(candidate ?? '').replace(/\s+/g, ' ').trim();
    if (ai && !isGenericSpiderTitle(ai)) return { ok: true, title: ai, source: 'ai' };
  }
  return { ok: false, error: SPIDER_TITLE_MISSING_MESSAGE };
}

/** Plain-text length of an HTML body (style/script/tags removed). */
export function spiderPlainTextLength(html: unknown): number {
  return String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/** Below this the body is "empty" for practical purposes. Short-but-real bodies only get a warning elsewhere. */
export const SPIDER_MIN_BODY_PLAIN_CHARS = 200;

export type SpiderBodyCheck = { ok: true; plainLength: number } | { ok: false; reason: string };

export function checkSpiderBody(html: unknown): SpiderBodyCheck {
  const plainLength = spiderPlainTextLength(html);
  if (plainLength < SPIDER_MIN_BODY_PLAIN_CHARS) {
    return { ok: false, reason: `생성된 글 본문이 비어 있거나 너무 짧습니다 (본문 ${plainLength}자)` };
  }
  return { ok: true, plainLength };
}
