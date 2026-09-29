/**
 * 🧭 v3.8.759 — 요약이 본문보다 강해지지 않게(answer fidelity). 호출 0회·결정론.
 *
 * 실측(run d7a142, "청년미래적금 VS 청년 도약계좌"): 본문은 "월 최대 70만원을 납입하는 구조"·"50만원은 의무 납입액이 아니라 최대 한도"
 * 라고 썼는데, 답 상자는 "월 70만원을 유지하며 … 청년도약계좌를 유지하는 편이 낫습니다" — 한도(최대)를 유지 **조건**으로 바꿨다.
 * 같은 run 의 FAQ 1번은 질문(우대형·이직·자격)과 답(도약계좌 금리 구조)이 다른 주제였다.
 *
 * 여기서 하는 일(약해지는 쪽만 허용, 강해지는 쪽은 금지):
 *  1. 한도→조건 승격 되돌리기: 본문이 "최대 X" 로만 말한 금액을 요약이 "X 을 유지하며/납입할 수 있으면" 조건으로 쓰면 "최대 X까지 납입할 수 있고" 로 되돌린다.
 *  2. 본문에 없는 절대 부사(무조건·반드시·항상·누구나·예외 없이) 제거.
 *  3. 본문에 없는 값(금액·비율·기간)을 담은 요약 문장 제거 — 표 칸은 칸 단위.
 *  4. FAQ 질문·답변의 중심 대상 일치: 답이 질문의 내용 낱말을 하나도 안 담거나, 비교 주제에서 질문의 대상이 아닌 쪽만 답하면 그 항목을 뺀다.
 * 하지 않는 것: 새 문장 생성·LLM 판정·본문 수정. 상품명·금액·기관명은 여기 없다(모두 본문에서 읽는다).
 */
import { containsValueToken, normalizeForMatch } from './number-token';
import { comparisonSubjects, isComparisonTopic } from './source-scope';
import { FAQ_Q_STOP } from './reader-retention';
import { weakenSentence } from './decision-semantics';

export interface FidelityChange { rule: 'limit-as-condition' | 'absolute-adverb' | 'unsupported-value'; before: string; after: string; detail: string }
export interface FidelityResult { text: string; changes: FidelityChange[] }

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const compact = (s: string) => plain(s).replace(/\s+/g, '');
const AMOUNT_SRC = '\\d[\\d,]*(?:\\.\\d+)?\\s*(?:만\\s*원|억\\s*원|원)';
/** "월 70만원을 유지하며" · "월 70만원 납입을 유지할 수 있고" · "70만원을 납입할 수 있으면" */
const LIMIT_AS_CONDITION = new RegExp(`((?:월|매월|매달|연|매년)\\s*)?(${AMOUNT_SRC})(?:을|를)?\\s*(?:납입을\\s*|납입\\s*)?(?:유지|납입|계속\\s*넣|넣)(?:하며|하면서|할\\s*수\\s*있(?:으면|고|다면)|하고|하면|가능하면|가능하다면|이\\s*가능하면)`, 'g');
const ABSOLUTE = /(?:무조건|반드시|항상|누구나|예외\s*없이|어떤\s*경우에도)\s*/g;
const VALUE = /(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:만\s*원|억(?:\s*원)?|원|%p|퍼센트\s*포인트|%|퍼센트|개월|세|년|일)/g;

/** 본문이 금액 X 를 "최대" 로 규정하는가 — "월 최대 70만원" · "최대 70만원까지" · "70만원은 의무 납입액이 아니라 최대 한도" */
export function isLimitInBody(body: string, amount: string): boolean {
  const b = compact(body);
  const a = compact(amount);
  if (!a || !b.includes(a)) return false;
  return b.includes(`최대${a}`) || new RegExp(`${escape(a)}[^.]{0,20}최대(?:한도|납입|금액)`).test(b) || new RegExp(`${escape(a)}(?:은|는)?의무납입액이아니`).test(b);
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 문장 나누기 — 값 뒤의 마침표("3,511원.")도 문장 끝으로 본다 */
export const splitFidelitySentences = (text: string): string[] => plain(text).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

/**
 * 요약 문장(답 상자·판정문)을 본문에 맞춘다. 본문보다 약해지는 수정만 한다.
 */
export function alignSummaryToBody(summary: string, body: string, options: { dimensions?: string[] } = {}): FidelityResult {
  const changes: FidelityChange[] = [];
  const bodyNorm = normalizeForMatch(plain(body));
  const sentences = splitFidelitySentences(summary).map((sentence) => {
    let s = sentence;
    // 1. 한도 → 조건 승격 되돌리기
    s = s.replace(LIMIT_AS_CONDITION, (whole, period: string | undefined, amount: string) => {
      const already = new RegExp(`최대\\s*${escape(amount)}`).test(sentence);
      if (already || !isLimitInBody(body, amount)) return whole;
      const after = `${period || ''}최대 ${amount.replace(/\s+/g, '')}까지 납입할 수 있고`;
      changes.push({ rule: 'limit-as-condition', before: whole, after, detail: `본문은 ${amount.replace(/\s+/g, '')} 을 최대 한도로만 말한다 — 유지 조건이 아니다` });
      return after;
    });
    // 1b. v3.8.761 — 새 문형("X 납입을 유지할 여력이 있다면", "X를 낼 수 있는 소득 흐름이라면")은 decision-semantics 의 역할 판정을 그대로 쓴다(본문이 "최대 X" 로 말할 때만)
    try {
      const w = weakenSentence(s, body, options);
      for (const c of w.changes.filter((x) => x.action === 'weakened')) changes.push({ rule: 'limit-as-condition', before: s, after: w.after, detail: c.reason });
      s = w.after;
    } catch { /* 역할 판정 실패는 넘어간다 */ }
    // 2. 본문에 없는 절대 부사
    s = s.replace(ABSOLUTE, (whole) => {
      const word = whole.trim();
      if (compact(body).includes(word.replace(/\s+/g, ''))) return whole;
      changes.push({ rule: 'absolute-adverb', before: word, after: '', detail: `본문에 없는 절대 표현 "${word}" 제거` });
      return '';
    });
    // 3. 본문에 없는 값 — 문장을 뺀다
    const missing = [...s.matchAll(VALUE)].map((m) => m[0]).filter((v) => !containsValueToken(bodyNorm, normalizeForMatch(v)));
    if (missing.length > 0) {
      changes.push({ rule: 'unsupported-value', before: s, after: '', detail: `본문에 없는 값: ${missing.join(', ')}` });
      return '';
    }
    return s.replace(/\s{2,}/g, ' ').trim();
  }).filter(Boolean);
  return { text: sentences.join(' '), changes };
}

/** 요약표 칸 — 문장을 빼는 대신 칸을 비운다(빈 칸은 호출부의 dropValuelessRows 가 줄째 뺀다) */
export function alignRowsToBody(rows: string[][], body: string): { rows: string[][]; changes: Array<FidelityChange & { row: string }> } {
  const changes: Array<FidelityChange & { row: string }> = [];
  const out = rows.map((row) => row.map((cell, ci) => {
    if (ci === 0) return cell;
    const r = alignSummaryToBody(cell, body);
    if (r.changes.length === 0) return cell;
    for (const c of r.changes) changes.push({ ...c, row: String(row[0] || '') });
    // 값이 본문에 없으면 칸을 비운다(문장 단위 삭제가 칸 전체를 비운 경우 포함)
    return r.text;
  }));
  return { rows: out, changes };
}

/** FAQ 질문·답변의 중심 대상 일치 */
export interface FaqConsistencyNote { question: string; action: 'kept' | 'dropped'; reason: string; questionTokens: string[]; matched: string[] }
export interface FaqConsistencyResult<T extends { question: string; answer: string }> { faqs: T[]; notes: FaqConsistencyNote[]; dropped: number }

/** 질문 틀 낱말 — 내용이 아니다 */
const FRAME = new Set(['무엇', '무엇을', '어떻게', '어떤', '언제', '어디', '왜', '경우', '경우에', '여부', '방법', '가능', '가능한가요', '있나요', '없나요', '하나요', '되나요', '인가요', '일까요', '수', '것', '때', '때는', '뒤', '전', '전에', '후', '후에', '조금', '바로', '그대로', '정도', '대로', '까지', '부터', '이면', '라면', '다면']);
const PARTICLE = /(?:으로|에서|에게|한테|까지|부터|처럼|보다|이면|라면|다면|은|는|이|가|을|를|의|에|로|도|과|와|만|요)$/;

export function questionTokens(question: string): string[] {
  return plain(question).replace(/[?？!.,·()[\]"'“”‘’]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/(?:하면|되면|이면|라면|다면|하나요|되나요|인가요|있나요|없나요|할까요|일까요|되는지|하는지)$/, ''))
    .map((w) => w.replace(PARTICLE, ''))
    .filter((w) => w.length >= 2 && !FRAME.has(w));
}

/**
 * v3.8.760 — 약한 낱말(FAQ 질문 정지어 + 절차 낱말)은 일치 증거로 세지 않는다. 실측(run fba7e9 4번): "먼저" 하나로 통과했다.
 * 기존 FAQ_Q_STOP(reader-retention)을 재사용하고 몇 개만 더한다 — 한국어 일반 낱말 사전을 새로 만들지 않는다.
 */
const WEAK_EXTRA = new Set(['먼저', '경우', '확인', '조건', '가능', '받다', '하다', '방법', '여부', '이유', '정도', '내용', '관련', '해당', '기준']);
export const isWeakToken = (t: string): boolean => FAQ_Q_STOP.has(t) || WEAK_EXTRA.has(t);
/**
 * 질문의 핵심 낱말(대상·행동·수치)이 답에 남아 있는가. 통째로 있거나, 수치는 숫자부가 있거나, 3자 이상 낱말은 앞 2자 어근이 답에 있으면 유지로 본다
 * ("조기수령" ↔ "조기노령연금" 처럼 공식 제도명과 검색 표현이 다른 경우). 어근 대조는 느슨하므로 비교 주제의 대상 뒤바뀜 검사가 함께 돈다.
 */
export function faqTokenKept(token: string, answerCompact: string): boolean {
  const t = token.replace(/\s+/g, '');
  if (answerCompact.includes(t)) return true;
  if (/^\d/.test(t)) { const digits = (t.match(/^\d[\d,.]*/) || [])[0] || ''; return digits.length >= 2 && answerCompact.includes(digits); }
  // 어근 대조는 4자 이상 낱말만 — "우대형" 의 "우대" 가 "우대금리" 에 걸리면 다른 개념을 같은 것으로 본다
  const head = t.slice(0, 2);
  return t.length >= 4 && !isWeakToken(head) && answerCompact.includes(head);
}

/**
 * 답이 질문의 핵심 낱말을 하나도 안 담으면 다른 주제의 답이다. 비교 주제(A vs B)에서 질문이 A 만 말하는데 답이 B 만 말해도 같다.
 * 결정론·낱말 기준이라 "일치 보장" 이 아니라 "명백한 어긋남 차단" 이다.
 */
export function checkFaqConsistency<T extends { question: string; answer: string }>(faqs: T[], keyword: string): FaqConsistencyResult<T> {
  const subjects = isComparisonTopic(keyword) ? comparisonSubjects(keyword).map(compact).filter((s) => s.length >= 2) : [];
  const notes: FaqConsistencyNote[] = [];
  const kept: T[] = [];
  for (const faq of faqs) {
    const all = questionTokens(faq.question);
    const q = all.filter((t) => !isWeakToken(t));
    const a = compact(faq.answer);
    const matched = q.filter((t) => faqTokenKept(t, a));
    let reason = '';
    if (q.length > 0 && matched.length === 0) reason = `답이 질문의 핵심 낱말(${q.slice(0, 5).join('·')})을 하나도 담지 않음`;
    if (!reason && subjects.length >= 2) {
      const qc = compact(faq.question);
      const inQ = subjects.filter((s) => qc.includes(s));
      const inA = subjects.filter((s) => a.includes(s));
      if (inQ.length === 1 && inA.length >= 1 && !inA.includes(inQ[0]!)) reason = `질문은 ${inQ[0]} 를 묻는데 답은 ${inA.join('·')} 만 말함`;
    }
    if (reason) { notes.push({ question: faq.question, action: 'dropped', reason, questionTokens: q, matched }); continue; }
    notes.push({ question: faq.question, action: 'kept', reason: '', questionTokens: q, matched });
    kept.push(faq);
  }
  return { faqs: kept, notes, dropped: faqs.length - kept.length };
}
