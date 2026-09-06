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

import { blockStrings, normalizeBlockLanguage } from './block-strings';

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

/**
 * 근거로 쓸 수 없는 답을 걸러낸다 (v3.8.564).
 *
 * ## 왜 필요한가 — 실측으로 발각
 * 2026-08-27 "신라면 맛있게 끓이는 법" 을 실제로 생성해 보니 결론 블록에 이게 나갔다:
 *
 *     근거: 기관명과 기준 시점 본문 미기재
 *
 * `generation.ts` 가 모델에게 `basis: 그 답의 근거가 되는 기관 이름과 기준 시점` 을 요구하는데,
 * 레시피처럼 **인용할 기관이 애초에 없는 주제**에서는 모델이 빈 값 대신
 * **지시문을 그대로 되돌려준다.** 그리고 이 블록은 길이만 다듬고 내용은 안 봤다.
 *
 * 세금·환급 글에서는 기관이 늘 있어서 안 드러났지만, 음식·취미처럼 기관 근거가 없는
 * 주제로 넓히는 순간 **모든 글에 이 문구가 박힌다.**
 *
 * ## 지우는 편이 낫다
 * 근거가 없으면 근거 줄을 **아예 안 만든다.** "없음" 이라고 쓰면 독자에게
 * 근거가 필요한 글인데 못 댔다는 인상만 준다 — 레시피에는 원래 필요 없는 줄이다.
 */
const BASIS_NON_ANSWERS = [
  '미기재', '없음', '해당없음', '해당 없음', '미상', '불명', '불명확', '확인불가', '확인 불가',
  '알수없음', '알 수 없음', '미제공', '제공되지', '명시되지', '기재되지', '언급되지',
  // v3.8.656 실측: "근거: 공식 확인 필요 2026 09 05" 가 첫 화면에 그대로 찍혔다 — 메모지 근거가 아니다
  '확인 필요', '확인필요', '미확인', '추후 확인', '검증 필요',
  'n/a', 'na', 'none', 'unknown', 'not specified', 'not available', 'not mentioned',
];
/** 프롬프트의 필드 설명이 그대로 돌아온 경우 */
const BASIS_ECHOES = ['기관 이름', '기관명', '기준 시점', '조사명'];

export function usableBasis(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  const low = s.toLowerCase().replace(/\s+/g, ' ');
  if (BASIS_NON_ANSWERS.some((w) => low.includes(w))) return '';
  if (BASIS_ECHOES.some((w) => low.includes(w))) return '';
  // 구두점·기호만 남은 경우("· -" 같은 껍데기)
  if (!/[0-9A-Za-z가-힣]/.test(s)) return '';
  return s;
}

export interface AnswerBlockInput {
  keyword: string;
  /** v3.8.562 — 'ko' | 'en'. 없으면 한국어(기존 동작) */
  language?: unknown;
  question?: unknown;
  answer?: unknown;
  /** 근거 — 기관 이름과 기준일 (예: "국세청 · 2026-08 기준") */
  basis?: unknown;
}

/**
 * 빠진 마침표를 되살린다 (v3.8.653).
 *
 * 실측 2026-09-05, 생성된 10편 중 4편의 결론 박스가 이랬다:
 *   "…경유차를 대상으로 제시했습니다 국가유공자 중증 장애인 … 면제 대상입니다 …"
 *
 * 요약을 JSON 으로 받는데 프롬프트가 "2~4문장" 이라고만 하고 문장부호를 요구하지
 * 않는다. 그래서 모델이 마침표 없이 이어 붙인다. 읽는 사람은 한 덩어리로 만난다.
 *
 * 더 나쁜 건 **v3.8.639 의 문단정리가 무력화된다**는 것이다 —
 * 문장마다 줄을 바꾸려면 문장 끝을 알아야 하는데, 마침표가 없으면 못 찾는다.
 * 사장님이 편집기에서 손으로 하던 그 일이 4편에서 그대로 안 됐다.
 *
 * 한국어 종결어미는 애매하지 않다. 어미 뒤에 공백 + 한글이 오면 문장이 끝난 것이다.
 * 이미 부호가 있으면 건드리지 않는다.
 */
// 합니다체는 전부 「…니다」 로 끝나니 그 하나면 된다. 해요체는 축약형(돼요·봐요·줘요·와요)이 따로 있다.
// v3.8.656 — 다음 문장이 숫자·영문으로 시작해도 마침표를 찍는다 (실측: "신청할 수 있습니다 10월8일까지")
const SENTENCE_END = /(니다|해요|예요|에요|어요|아요|여요|네요|세요|돼요|봐요|줘요|와요|져요|나요|까요|죠)(?=\s+[가-힣0-9A-Za-z])/g;

export function restoreSentencePeriods(text: string): string {
  return String(text || '').replace(SENTENCE_END, '$1.');
}

/**
 * 문장마다 줄을 바꾼다 (v3.8.639).
 *
 * 사장님이 발행된 글을 편집기에서 **손으로** 이렇게 고쳐 놓으셨다.
 * 결론 박스는 훑어보는 자리라 한 덩어리로 붙어 있으면 눈이 미끄러진다.
 * 문장이 끊겨 있으면 "대상은 이것 / 제외는 이것 / 심사는 이것" 이 한눈에 들어온다.
 *
 * **이스케이프가 끝난 뒤에** 부른다 — 먼저 넣으면 <br> 이 그대로 글자가 된다.
 *
 * 안 끊는 자리:
 *   · 숫자 사이의 점 (3.5%, 2026. 9. 4.)
 *   · 끊고 나서 조각이 너무 짧으면 (한두 단어짜리 줄은 더 지저분하다)
 */
const MIN_SENTENCE_CHARS = 10;

export function breakSentences(escaped: string): string {
  const parts = String(escaped || '')
    .split(/(?<=[.!?])\s+(?=[^\s\d])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length < 2) return escaped;
  if (parts.some((s) => s.length < MIN_SENTENCE_CHARS)) return escaped;
  return parts.join('<br>');
}

/**
 * 결론 블록 HTML. 쓸 만한 답이 없으면 **빈 문자열을 돌려준다** —
 * 억지로 채우면 "위 본문을 참고해주세요" 같은 빈 말이 글 맨 위에 박힌다.
 */
/** 질문 자리에 온 것이 질문인가 — 아니면 키워드 질문으로 (v3.8.661 실측: 60자 넘는 서술문 "고용노동부 … 보지 않았습니다." 가 왔다) */
function pickQuestion(rawInput: unknown, keyword: string, strings: { answerQuestionFallback: (k: string) => string }): string {
  const rawQuestion = sanitizeAnswerText(rawInput, MAX_QUESTION_LEN);
  const looksLikeNote = /^\[\d+\]|확인\s*필요|^근거\s*[:：]|^출처\s*[:：]/.test(rawQuestion)
    || (rawQuestion.length > 60 && !/[?？]\s*$/.test(rawQuestion));
  return (rawQuestion && !looksLikeNote ? rawQuestion : '') || (keyword ? strings.answerQuestionFallback(keyword) : '');
}

const ANSWER_SECTION_RE = /<section class="answer-first"[^>]*>[\s\S]*?<\/section>/i;
const ANSWER_Q_STYLE = 'margin:0 0 10px;font-size:15px;font-weight:800;color:var(--rv-answer-accent,#0f766e);-webkit-text-fill-color:var(--rv-answer-accent,#0f766e);line-height:1.5;word-break:keep-all;';

/**
 * v3.8.664 — 답변 블록의 질문 줄을 지킨다.
 * 실측(햇살론15 글): 발행 직전 html 에서 <p class="answer-first-q"> 가 사라지고 그 자리에 결론의 댓글 문장이
 * 이름 없는 <p> 로 들어와 있었다. 어느 단계가 바꿨든 여기서 되돌린다 — 블록 안의 이름 없는 <p> 는 빼고, 질문 줄이 없으면 만들어 넣는다.
 */
export function restoreAnswerBlockQuestion(
  html: string,
  input: { question?: unknown; keyword?: unknown; language?: unknown },
): { html: string; changed: boolean; removed?: boolean } {
  const src = String(html || '');
  const block = src.match(ANSWER_SECTION_RE);
  if (!block) return { html: src, changed: false };
  const before = block[0];
  /**
   * v3.8.666 실측(상생보험 글): 사실검증이 답 문단을 통째로 비웠다(<p class="answer-first-a"></p>).
   * 빈 답을 글 맨 위에 두느니 블록을 뺀다 — 예전 순서(서론부터)로 나간다.
   */
  const answerInner = (before.match(/<p[^>]*class="answer-first-a"[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';
  if (answerInner.replace(/<[^>]+>/g, '').replace(/&nbsp;|\s/g, '').length < 10) {
    return { html: src.replace(before, () => ''), changed: true, removed: true };
  }
  let after = before.replace(/\s*<p>[\s\S]*?<\/p>/gi, '');
  if (!/class="answer-first-q"/i.test(after)) {
    const strings = blockStrings(normalizeBlockLanguage(input.language));
    const question = pickQuestion(input.question, String(input.keyword || '').trim(), strings);
    if (!question) return { html: src, changed: false };
    const line = `<p class="answer-first-q" style="${ANSWER_Q_STYLE}">${escapeHtml(question)}</p>\n  `;
    after = after.replace(/<p[^>]*class="answer-first-a"/i, (m) => `${line}${m}`);
  }
  if (after === before) return { html: src, changed: false };
  return { html: src.replace(before, () => after), changed: true };
}

/** 문장 표시가 하나라도 있는가 — 마침표·물음표, 또는 합니다체·해요체 종결 */
const HAS_SENTENCE = /[.!?]|(?:니다|해요|예요|에요|어요|아요|여요|네요|세요|돼요|봐요|줘요|와요|져요|나요|까요|죠)(?=\s|$)/;

export function buildAnswerBlock(input: AnswerBlockInput): string {
  const answer = sanitizeAnswerText(input.answer, MAX_ANSWER_LEN);
  if (answer.length < MIN_ANSWER_LEN) return '';
  /**
   * v3.8.668 실측(영업신고 글): 답이 "…두 신청서를 함께 낸다 법인과 유흥주점업은 …따로 따른다" 처럼
   * 마침표 없는 해라체 한 덩어리로 왔다. 줄도 못 바꾸고 말투도 본문과 어긋난다 — 문장 표시가 없으면 답이 아니라 덩어리다.
   */
  if (!HAS_SENTENCE.test(answer)) return '';

  // v3.8.562: 문구를 언어별 표에서 가져온다. language 를 안 주면 예전처럼 한국어다
  const strings = blockStrings(normalizeBlockLanguage(input.language));

  const keyword = String(input.keyword || '').trim();
  // v3.8.658 실측: 질문 자리에 "[2] 확인 필요: 관리종목 지정 시점" 같은 리포트 점검 항목이 그대로 왔다
  const question = pickQuestion(input.question, keyword, strings);
  if (!question) return '';

  const basis = usableBasis(sanitizeAnswerText(input.basis, MAX_BASIS_LEN));

  const q = escapeHtml(question);
  // v3.8.653: 빠진 마침표를 먼저 되살린다 — 없으면 아래 줄바꿈이 문장 끝을 못 찾는다
  // v3.8.639: 문장마다 줄바꿈. 이스케이프 뒤에 넣어야 <br> 이 태그로 산다
  const a = breakSentences(restoreSentencePeriods(escapeHtml(answer)));
  const b = basis ? escapeHtml(basis) : '';

  /**
   * 태그 순서가 곧 읽는 순서다 — 질문 → 답 → 근거.
   * style 이 전부 지워져도 이 순서와 <strong> 만으로 읽힌다.
   */
  return `
<section class="answer-first" style="margin:0 0 26px;padding:20px 22px;background:var(--rv-answer-bg,#f6faf9);border:1px solid var(--rv-answer-border,#cfe3de);border-radius:10px;box-sizing:border-box;max-width:100%;">
  <p class="answer-first-q" style="margin:0 0 10px;font-size:15px;font-weight:800;color:var(--rv-answer-accent,#0f766e);-webkit-text-fill-color:var(--rv-answer-accent,#0f766e);line-height:1.5;word-break:keep-all;">${q}</p>
  <p class="answer-first-a" style="margin:0;font-size:17px;font-weight:700;color:#1f2937;-webkit-text-fill-color:#1f2937;line-height:1.68;word-break:keep-all;">${a}</p>${b ? `
  <p class="answer-first-basis" style="margin:10px 0 0;font-size:13px;font-weight:600;color:#64748b;-webkit-text-fill-color:#64748b;line-height:1.5;">${strings.answerBasisLabel}: ${b}</p>` : ''}
</section>
`;
}
