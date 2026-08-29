/**
 * number-token — 수치를 **경계까지 보고** 대조한다. (v3.8.594)
 *
 * ## 왜 만들었나 — 발행글 "…IT 용어 20개인가" 실측
 * 제목이 "IT 용어 20개"를 약속했는데 본문에 실린 용어는 **4개**였고,
 * 본문 어디에도 "20개"라는 말이 없었다. 그런데 근거 대조는 통과했다.
 *
 * 원인이 두 겹이다.
 *   ① 단위 교대 순서 — `개|개월` 순서라 "120개월"에서 **"120개"** 가 뽑힌다.
 *   ② 대조 방식 — 근거 본문을 공백 없이 이어 붙인 뒤 `includes` 로 본다.
 *      그래서 "120개월" 안에 "20개" 가 들어 있어 **없는 수치가 확인된 것처럼** 통과한다.
 *      숫자는 짧을수록 남의 숫자 안에 잘 숨는다 — 가장 흔한 값이 가장 잘 뚫린다.
 *
 * ## 무엇을 하나
 * `includes` 대신 **앞뒤를 본다.**
 *   · 앞이 숫자면 남의 숫자 꼬리다 (120개 ⊃ 20개) → 아니다.
 *   · 뒤가 단위를 늘리면 다른 단위다 (20개 + 월 = 20개월) → 아니다.
 *
 * ## 공백은 지우지 않는다
 * 처음엔 공백을 지운 문자열에서 앞글자만 봤는데, 그러면 "S10 3년" 이 "s103년" 이 되어
 * **멀쩡한 3년이 남의 숫자 꼬리로 몰린다.** 공백이 곧 경계라 지우면 안 된다.
 * 그래서 공백은 한 칸으로만 줄이고, 숫자와 단위 사이의 공백은 대조할 때 `\s*` 로 흡수한다.
 */

/** 대조용 정규화 — 태그·쉼표를 지우고 공백은 한 칸으로 줄인다 (지우지 않는다) */
export function normalizeForMatch(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/,/g, '')
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * 단위가 더 긴 단위의 앞부분인 경우들.
 * 여기 있는 조합만 "다른 단위"로 본다 — 넓히면 멀쩡한 수치가 미확인이 된다.
 */
const UNIT_EXTENSIONS: Record<string, string[]> = {
  개: ['월'],
  억: ['원'],
  만: ['원'],
  시: ['간'],
  주: ['일'],
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * `haystack` 안에 `token`(예: "20개")이 **그 수치로** 들어 있는가.
 *
 * 둘 다 normalizeForMatch 를 거친 값이어야 한다.
 * 숫자로 시작하지 않는 말(기관명 등)은 예전처럼 단순 포함으로 본다.
 */
export function containsValueToken(haystack: string, token: string): boolean {
  const hay = String(haystack || '');
  const needle = String(token || '');
  if (!hay || !needle) return false;
  if (!/^\d/.test(needle)) return hay.includes(needle);

  /**
   * 글자 사이마다 공백을 허용한다.
   *
   * 수치 토큰은 공백을 지운 꼴로 들어온다("2026년7월15일"). 그런데 대조 대상은
   * 공백을 살린 원문이라("2026년 7월 15일") 숫자와 단위 사이에만 `\s*` 를 두면
   * **여러 마디짜리 값이 통째로 미확인이 된다.** (게이트가 잡은 회귀 —
   * fact-integrity-regression 의 "2026년 7월 15일 · 25만원" 사례)
   */
  const spaced = needle.split('').map(escapeRegex).join('\\s*');
  const extensions = UNIT_EXTENSIONS[needle.slice(-1) || ''] || [];
  const tailGuard = extensions.length > 0 ? `(?!\\s*(?:${extensions.map(escapeRegex).join('|')}))` : '';
  return new RegExp(`(?<![\\d.])${spaced}${tailGuard}`).test(hay);
}
