/**
 * 🧭 v3.8.761 — 비교·전환형 글의 핵심 판단 질문(코드 계획·호출 0회).
 *
 * 실측(run b8cdb4, "청년미래적금 VS 청년 도약계좌"): 과거 실행(d7a142)에서는 초안에 있던 "기존 가입자는 남은 기간을 봐야 한다" 가
 * 후처리에서 사라졌고, 이번 실행에서는 초안부터 그 질문이 없었다 — 보존 문제가 아니라 계획(coverage) 문제다.
 *
 * 규칙(상품명 없음): 의도가 전환·비교(A vs B·갈아타기·유지 vs 전환·해지·변경)이고, 대상이 시간이 진행 중인 계약(가입·계약·구독·약정·대출·보험·적금·계좌·요금제·만기)
 * 이면 ORIGINAL_TERM/REMAINING_TERM 구분 질문을 계획에 넣는다. 자동차 A vs B·여행지 A vs B 처럼 진행 중인 계약이 없으면 넣지 않는다.
 * 개인 가입일을 모르므로 잔여 개월 수를 만들지 않는다 — Writer 가 설명할 것은 "원래 만기가 아니라 지금부터 남은 기간으로 비교한다" 는 판단 원리다.
 * MISSING 은 새 LLM 호출로 채우지 않는다(검출·보존 계약까지). 다음 라이브에서 효과를 본다.
 */
export interface CoreQuestion { id: string; question: string; principle: string; dimension: string; applicable: boolean; reason: string }
export type CoverageStatus = 'ANSWERED' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';
export interface CoverageResult { id: string; status: CoverageStatus; evidence: string[] }

const SWITCH_INTENT = /\bvs\.?\b|비교|갈아타|전환|환승|바꾸|옮기|(?:유지|해지)[^.]{0,12}(?:할까|여부|판단|선택)|해지하고|변경/i;
const ONGOING_CONTRACT = /가입|계약|구독|약정|대출|보험|적금|계좌|요금제|만기|납입|보험료|월세|리스/;
/** 시간이 진행 중인 계약이 아닌 비교의 표지 — 이 낱말만 있으면 진행 중 계약 판단을 하지 않는다 */
const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function planCoreQuestions(input: { keyword: string; searchIntent?: string; readerQuestions?: string[]; evidenceText?: string }): CoreQuestion[] {
  const intentText = [input.keyword, input.searchIntent || '', ...(input.readerQuestions || [])].map(plain).join(' \n ');
  const subjectText = `${intentText} \n ${plain(String(input.evidenceText || '').slice(0, 4000))}`;
  const switching = SWITCH_INTENT.test(intentText);
  // 계약 낱말은 의도(키워드·질문)에 있거나, 근거 앞부분에 두 번 이상 나와야 한다 — 근거 한 줄의 우연한 낱말로 켜지지 않게
  const contractHits = (subjectText.match(new RegExp(ONGOING_CONTRACT.source, 'g')) || []).length;
  const contractInIntent = ONGOING_CONTRACT.test(intentText);
  const ongoing = contractInIntent || contractHits >= 2;
  const applicable = switching && ongoing;
  return [{
    id: 'CQ-REMAINING-TERM',
    question: '이미 가입(계약) 중이라면 지금부터 남은 기간은 원래 만기와 어떻게 다른가',
    principle: '기존 가입자는 상품의 원래 만기만 비교하면 안 되고, 현재 가입 시점에서 실제로 남은 기간과 이미 낸 금액을 함께 놓고 판단한다',
    dimension: '남은 기간',
    applicable,
    reason: applicable ? '전환·비교 의도 + 진행 중인 계약 대상' : !switching ? '전환·비교 의도 아님' : '진행 중인 계약 대상 아님',
  }];
}

const REMAINING = /남은\s*(?:기간|만기|개월|계약\s*기간|납입\s*기간)|잔여\s*(?:기간|만기|개월)|남아\s*있는\s*(?:기간|만기)/;
const EXISTING = /(?:이미|기존|현재)\s*(?:가입|계약|보유|납입)(?:자|한|중|된|되어|해)|가입\s*시점(?:에\s*따라|부터\s*남|기준으로)|계약\s*시점에\s*따라|원래\s*(?:만기|기간|계약)/;

/** 글(태그 없는 글이든 HTML 이든)이 계획한 핵심 질문에 답했는가 — 문장 단위 표지로 본다 */
export function coverCoreQuestions(text: string, questions: CoreQuestion[]): CoverageResult[] {
  const sentences = plain(text).split(/(?<=[.!?])\s+/);
  return questions.map((q) => {
    if (!q.applicable) return { id: q.id, status: 'NOT_APPLICABLE' as const, evidence: [] };
    if (q.id !== 'CQ-REMAINING-TERM') return { id: q.id, status: 'MISSING' as const, evidence: [] };
    const both = sentences.filter((s) => REMAINING.test(s) && EXISTING.test(s));
    if (both.length) return { id: q.id, status: 'ANSWERED', evidence: both.slice(0, 3).map((s) => s.slice(0, 160)) };
    const one = sentences.filter((s) => REMAINING.test(s) || EXISTING.test(s));
    if (one.length) return { id: q.id, status: 'PARTIAL', evidence: one.slice(0, 3).map((s) => s.slice(0, 160)) };
    return { id: q.id, status: 'MISSING', evidence: [] };
  });
}

/** 핵심 질문에 답하는 문장인가 — 자가 수정 게이트가 이 문장을 보호한다 */
export function isCoreAnswerSentence(sentence: string, questions: CoreQuestion[]): boolean {
  if (!questions.some((q) => q.applicable && q.id === 'CQ-REMAINING-TERM')) return false;
  const s = plain(sentence);
  return REMAINING.test(s) && EXISTING.test(s);
}

/** Writer 패킷에 싣는 한 절 — 상품명 없음, 질문·판단 원리만 */
export function renderCoreQuestions(questions: CoreQuestion[]): string[] {
  const rows = questions.filter((q) => q.applicable);
  if (!rows.length) return [];
  return ['▸ 판단에 꼭 필요한 질문 (코드 계획 — 본문 어딘가에서 판단 원리로 답하세요. 개인별 숫자는 만들지 마세요)', ...rows.map((q) => `- [${q.id}] ${q.question} — ${q.principle}`)];
}
