/**
 * answer-block — 글 맨 위에 "결론부터" 한 덩어리를 둔다.
 *
 * ## 왜 만드는가 (v3.8.559)
 * 해외 실측 두 가지가 같은 곳을 가리킨다.
 *   · AI 답변이 인용한 대목의 **55%가 페이지 상단 30%** 에서 나온다(중간 24%, 하단 21%).
 *   · 인용된 페이지의 **53.4%가 1,000단어 미만**이고, 글자수와 인용의 상관은 0.04 — 사실상 없다.
 *
 * 우리 글은 길다. 길이를 줄이면 검색 쪽을 잃으므로, 대신
 * **인용해 가기 좋은 짧은 덩어리를 맨 위에** 둔다. 긴 본문은 그대로 둔다.
 *
 * ## 무엇이 문제였나
 * 조립 순서가 `상단CTA → 서론 → 요약표` 였다. 요약표는 인용될 만한 덩어리인데
 * **서론 뒤에 있었다.** 서론은 "안녕하세요, 오늘은…" 로 시작하는 도입부라
 * 인용 가치가 없는데 그게 상단을 차지하고 있었던 것이다.
 *
 * ## AI 를 새로 부르지 않는다
 * 요약표를 만드는 호출에서 필드 세 개(question·answer·basis)를 더 받아 온다.
 * 호출 수는 그대로고 출력 토큰만 조금 는다 — 발행 1회 비용은 사실상 같다.
 *
 * ## 스타일이 지워지는 것을 전제로 만든다
 * 워드프레스는 REST 저장 때 `style` 속성을 통째로 제거한다(클래스만 살아남는다).
 * 그래서 **태그가 다 벗겨져도 읽히는 구조**로 짜고, 색·여백은 클래스에 맡긴다.
 * 티스토리·블로그스팟에서는 인라인 style 이 그대로 살아 두 경우 다 보기 좋다.
 */

/** 답으로 인정하는 최소 길이 — 이보다 짧으면 "네" 수준이라 인용 가치가 없다 */
const MIN_ANSWER_LEN = 40;
/** 최대 길이 — 넘으면 본문 요약이지 답이 아니다. 문장 경계에서 자른다 */
const MAX_ANSWER_LEN = 400;
const MAX_QUESTION_LEN = 80;
const MAX_BASIS_LEN = 120;

/** 프로젝트 공통 규칙: 한자는 쓰지 않는다 */
const CJK = /[一-鿿㐀-䶿]/g;

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 문장 경계에서 자른다. 글자 수로만 자르면 "…신청할 수 있습니" 처럼 끊겨
 * 인용됐을 때 오히려 손해다.
 */
export function trimToSentence(text: string, maxLen: number): string {
  const value = String(text || '').trim();
  if (value.length <= maxLen) return value;

  const head = value.slice(0, maxLen);
  const lastStop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('다.'), head.lastIndexOf('요.'), head.lastIndexOf('!'), head.lastIndexOf('?'));
  if (lastStop > maxLen * 0.4) {
    // '다.' 같은 두 글자 경계를 잘라먹지 않도록 마침표까지 포함시킨다
    const end = value.startsWith('.', lastStop + 1) ? lastStop + 2 : lastStop + 1;
    return value.slice(0, end).trim();
  }
  return head.trim();
}

/** AI 가 돌려준 문자열을 본문에 넣을 수 있는 평문으로 만든다 */
export function sanitizeAnswerText(raw: unknown, maxLen: number): string {
  const text = String(raw ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(CJK, '')
    .replace(/\s+/g, ' ')
    .trim();
  return trimToSentence(text, maxLen);
}

export interface AnswerBlockInput {
  keyword: string;
  question?: unknown;
  answer?: unknown;
  /** 근거 — 기관 이름과 기준일 (예: "국세청 · 2026-08 기준") */
  basis?: unknown;
}

/**
 * 결론 블록 HTML. 쓸 만한 답이 없으면 **빈 문자열을 돌려준다** —
 * 억지로 채우면 "위 본문을 참고해주세요" 같은 빈 말이 글 맨 위에 박힌다.
 */
export function buildAnswerBlock(input: AnswerBlockInput): string {
  const answer = sanitizeAnswerText(input.answer, MAX_ANSWER_LEN);
  if (answer.length < MIN_ANSWER_LEN) return '';

  const keyword = String(input.keyword || '').trim();
  const question = sanitizeAnswerText(input.question, MAX_QUESTION_LEN)
    || (keyword ? `${keyword}, 결론부터` : '');
  if (!question) return '';

  const basis = sanitizeAnswerText(input.basis, MAX_BASIS_LEN);

  const q = escapeHtml(question);
  const a = escapeHtml(answer);
  const b = basis ? escapeHtml(basis) : '';

  /**
   * 태그 순서가 곧 읽는 순서다 — 질문 → 답 → 근거.
   * style 이 전부 지워져도 이 순서와 <strong> 만으로 읽힌다.
   */
  return `
<section class="answer-first" style="margin:0 0 26px;padding:20px 22px;background:var(--rv-answer-bg,#f6faf9);border:1px solid var(--rv-answer-border,#cfe3de);border-radius:10px;box-sizing:border-box;max-width:100%;">
  <p class="answer-first-q" style="margin:0 0 10px;font-size:15px;font-weight:800;color:var(--rv-answer-accent,#0f766e);-webkit-text-fill-color:var(--rv-answer-accent,#0f766e);line-height:1.5;word-break:keep-all;">${q}</p>
  <p class="answer-first-a" style="margin:0;font-size:17px;font-weight:700;color:#1f2937;-webkit-text-fill-color:#1f2937;line-height:1.68;word-break:keep-all;">${a}</p>${b ? `
  <p class="answer-first-basis" style="margin:10px 0 0;font-size:13px;font-weight:600;color:#64748b;-webkit-text-fill-color:#64748b;line-height:1.5;">근거: ${b}</p>` : ''}
</section>
`;
}
