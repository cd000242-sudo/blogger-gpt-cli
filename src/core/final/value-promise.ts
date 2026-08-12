/**
 * value-promise — "값이 있다"고 해놓고 값을 안 적는 문장·소제목을 걸러낸다.
 *
 * ## 무엇이 문제인가
 * "지원 금액은 소득 구간에 따라 다릅니다" 는 한 글자도 틀리지 않았지만
 * 독자가 알고 싶었던 걸 하나도 안 알려준다. 얼마인지 알려고 검색해서 들어온 사람이
 * "다릅니다" 를 읽고 나간다. 이런 문장이 쌓인 게 두루뭉실한 글이다.
 *
 * 틀린 정보보다 낫다고 볼 수도 있지만, 그렇지 않다 — 값을 모르면 그 소제목을
 * 애초에 쓰지 않는 게 맞다. 빈 약속을 목차에 걸어두면 독자를 두 번 속인다.
 *
 * ## 무엇을 막지 않는가
 * 값을 **주면서** 조건을 나누는 문장은 좋은 글이다.
 *   "1구간은 월 30만원, 2구간은 월 20만원입니다" → 통과
 * 값 이야기가 아닌 문장도 건드리지 않는다.
 *   "신청 방법은 사람마다 다릅니다" → 통과
 */

export interface ValuePromise {
  sentence: string;
  /** 무엇을 약속했는지 — 로그용 */
  subject: string;
}

export interface SectionLike { h3: string; content: string }

/** 값을 가리키는 말 — 이 말이 주어에 있으면 독자는 숫자를 기대한다 */
const VALUE_SUBJECT = /(금액|비용|가격|요금|한도|지원금|급여액|수수료|이자율|금리|기간|기한|마감|소요\s*시간|나이|연령|소득\s*기준|자격\s*요건|점수|배점|횟수|주기)/;

/** 값을 안 주고 넘기는 말 */
const DEFERRAL = /(다릅니다|달라집니다|달라져요|차이가\s*있습니다|상이합니다|확인해야\s*합니다|확인하시기\s*바랍니다|확인하세요|참고하시기\s*바랍니다|참고하세요|문의(?:하시기|하세요|해야)|안내를\s*기다)/;

/** 실제 값 — 단위가 붙은 숫자여야 값이다. 맨 숫자는 목록 번호와 구별이 안 된다 */
const CONCRETE_VALUE = /\d[\d,]*(?:\.\d+)?\s*(?:원|만원|억|달러|%|퍼센트|명|건|배|회|일|주|개월|년|세|시간|분|점|등급|구간)/;

/** 제목이 값을 약속하는가 */
const TITLE_PROMISES_VALUE = new RegExp(
  `${VALUE_SUBJECT.source}|얼마|언제까지|몇\\s*(?:살|명|번|개|년|월|일)`,
);

function stripMarkup(html: unknown): string {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?。])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 값을 약속하고 안 주는 문장을 찾는다.
 *
 * 같은 문장 안에 실제 값이 있으면 잡지 않는다 — 값을 주면서 조건을 나누는 건
 * 오히려 좋은 글이고, 그것까지 막으면 쓸 수 있는 문장이 남지 않는다.
 */
export function findValuePromises(html: string): ValuePromise[] {
  try {
    const text = stripMarkup(html);
    if (!text) return [];

    const out: ValuePromise[] = [];
    for (const sentence of splitSentences(text)) {
      const subject = VALUE_SUBJECT.exec(sentence);
      if (!subject) continue;                      // 값 이야기가 아니다
      if (!DEFERRAL.test(sentence)) continue;      // 얼버무리지 않았다
      if (CONCRETE_VALUE.test(sentence)) continue; // 값을 같이 줬다 → 정상
      out.push({ sentence, subject: subject[0] });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * 이 소제목이 약속한 값을 본문이 실제로 담고 있는가.
 * 값을 약속하지 않는 제목(방법·절차·실수 등)은 수치가 없어도 정상이다.
 */
export function hasConcreteValue(title: string, content: string): boolean {
  try {
    const heading = stripMarkup(title);
    if (!TITLE_PROMISES_VALUE.test(heading)) return true;   // 애초에 값을 약속하지 않았다
    return CONCRETE_VALUE.test(stripMarkup(content));
  } catch {
    return true;   // 판단이 안 서면 살린다 — 멀쩡한 섹션을 지우는 쪽이 더 손해다
  }
}

/**
 * 값을 약속해놓고 못 지킨 소제목을 통째로 들어낸다.
 *
 * 전부 탈락하더라도 최소 하나는 남긴다 — 본문이 통째로 비면 그게 더 나쁘고,
 * 빈 글은 v3.8.484 의 발행 중단에도 걸린다.
 */
export function dropValuelessSections<T extends SectionLike>(sections: T[]): T[] {
  try {
    if (!Array.isArray(sections) || sections.length === 0) return [];
    const kept = sections.filter((s) => s && hasConcreteValue(s.h3, s.content));
    return kept.length > 0 ? kept : sections.slice(0, 1);
  } catch {
    return Array.isArray(sections) ? sections : [];
  }
}
