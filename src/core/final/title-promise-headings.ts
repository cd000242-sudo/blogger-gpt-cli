/**
 * 🎯 제목이 약속한 것마다 그것을 맡는 소제목을 둔다 (v3.8.655)
 *
 * ## 왜
 * v3.8.654 검사가 잡은 것: 제목 「자동 적용 여부와 신청 방법, 9월 30일 납부기한」에
 * 「자동 적용 여부」도 「신청 방법」도 맡은 소제목이 없었다. 잡기만 하면 88점 딱지를
 * 달고 같은 글이 나간다. **첫 생성에서** 지켜야 호출이 안 늘어난다.
 *
 * ## 두 겹, 둘 다 호출 0회
 *   ① 소제목 프롬프트에 약속 조각을 적어 준다 — 모델이 스스로 맡게
 *   ② 그래도 안 맡았으면 코드가 가장 동떨어진 소제목 하나를 약속 조각으로 바꾼다
 *      (개수를 늘리지 않는다 — 절이 늘면 본문 호출·비용이 는다)
 *
 * 제목이 미리 정해진 경우(리포트 확정 제목·사용자 지정)에만 의미가 있다.
 * AI 가 본문 뒤에 제목을 짓는 흐름에서는 제목이 본문을 따라가므로 여기 올 일이 없다.
 */

import { titlePromises, findUnkeptTitlePromises } from './reader-retention';

const NON_BODY = /자주\s*묻는|FAQ|요약|목차|읽어보기|한눈에/i;

function words(text: string): string[] {
  return String(text || '')
    .replace(/[^가-힣0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/** ① 소제목 프롬프트에 얹을 블록. 약속 조각이 둘 미만이면 빈 문자열. */
export function buildTitlePromiseBlock(title: string): string {
  const promises = titlePromises(title);
  if (promises.length < 2) return '';
  return [
    '',
    '🔴 **[제목이 이미 정해져 있습니다 — 제목이 약속한 것을 소제목이 맡아야 합니다]**',
    `제목: "${title}"`,
    '독자는 아래 조각을 보고 들어옵니다. **조각마다 그것을 정면으로 다루는 소제목을 하나씩** 두세요.',
    '본문 어딘가에 낱말이 흩어져 있는 것으로는 안 됩니다 — 소제목만 훑고 못 찾으면 나갑니다.',
    ...promises.map((p, i) => `   ${i + 1}) ${p}`),
    '나머지 소제목은 다른 각도로 채웁니다. 같은 조각을 두 소제목이 나눠 맡지 않습니다.',
    '조각이 "9·3 지침" 처럼 날짜 숫자로 시작하면 그 숫자는 번호가 아니라 날짜입니다 — 소제목에 그대로 둡니다.',
    '',
  ].join('\n');
}

/** 약속 조각을 소제목 문장으로 — 키워드가 이미 들어 있으면 그대로, 아니면 앞에 붙인다 */
export function promiseToHeading(promise: string, keyword: string): string {
  const kw = words(keyword);
  const p = promise.replace(/\s+/g, ' ').trim();
  const hasKeyword = kw.some((w) => p.includes(w));
  const heading = hasKeyword ? p : `${keyword} ${p}`.trim();
  return heading.length > 40 ? p : heading;
}

/**
 * 날짜 접두어 되돌리기 (v3.8.661).
 * 제목에 "9·3 노동부 지침" 이 있으면 모델은 소제목을 "3 노동부 지침과 …" 로 돌려준다 —
 * "번호/접두어 없이" 규칙을 "9·" 에 적용해 떼 버린다(실측 3회, 코드 쪽 정규식은 무관했다).
 * 소제목이 숫자+공백+한글로 시작하고, 제목에 "N·그숫자" 꼴이 있으면 그 접두어를 되살린다.
 */
export function restoreDatePrefix(heading: string, title: string): string {
  const h = String(heading || '').trim();
  const m = h.match(/^(\d{1,2})\s+([가-힣])/);
  if (!m) return h;
  const day = m[1]!;
  const re = new RegExp(`(\\d{1,2})[·・.](${day})(?=\\s|$)`);
  const t = String(title || '').match(re);
  if (!t) return h;
  return `${t[1]}·${day}${h.slice(day.length)}`;
}

export interface EnsureResult {
  h2Titles: string[];
  /** 바꾼 것 — 로그용 */
  replaced: Array<{ from: string; to: string }>;
}

/**
 * ② 코드 보증. 못 맡은 약속마다 제목과 가장 동떨어진 소제목 하나를 바꾼다.
 * 이미 약속을 맡은 소제목과 FAQ·요약 계열은 건드리지 않는다.
 */
export function ensureTitlePromiseHeadings(title: string, h2Titles: string[], keyword: string): EnsureResult {
  const list = [...(h2Titles || [])];
  const unkept = findUnkeptTitlePromises(title, list, '');
  if (unkept.length === 0) return { h2Titles: list, replaced: [] };

  // 어떤 조각이 안 맡아졌는지 — 조각별로 다시 판정
  const missing = titlePromises(title).filter((p) => findUnkeptTitlePromises(`${p}, ${p}`, list, '').length > 0);
  const titleWords = new Set(words(title));
  const replaced: Array<{ from: string; to: string }> = [];
  const locked = new Set<number>();

  for (const promise of missing) {
    // 제목 낱말과 겹침이 가장 적은 소제목 — 그 절이 제목과 가장 무관하다
    let pick = -1;
    let best = Infinity;
    list.forEach((h, i) => {
      if (locked.has(i) || NON_BODY.test(h)) return;
      const overlap = words(h).filter((w) => titleWords.has(w)).length;
      if (overlap < best) { best = overlap; pick = i; }
    });
    if (pick === -1) break;
    const to = promiseToHeading(promise, keyword);
    replaced.push({ from: list[pick]!, to });
    list[pick] = to;
    locked.add(pick);
  }
  // 바꾼 것도 잠근다 — 다음 조각이 방금 넣은 소제목을 다시 덮지 않도록
  return { h2Titles: list, replaced };
}
