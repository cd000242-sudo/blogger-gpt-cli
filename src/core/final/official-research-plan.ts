/**
 * 🧭 v3.8.758 — 공식자료 조사 계획(호출 0회·결정론).
 *
 * 실측(run f607bc, "청년미래적금 VS 청년 도약계좌"): 비교 형식 분기를 고쳐도 이 주제는 기관 매핑(주택 공고 5개 기관)이
 * 없어 sourceScope 가 안 생기고, 그러면 공식기관을 겨냥한 검색이 하나도 없었다(11개 검색어 전부 키워드·약속 검색).
 * 2차 모집 공고는 어느 결과에도 없었다.
 *
 * 기관 매핑이 없어도 조사를 **시작**할 수 있게, 입력의 실제 대상(비교면 대상별)과 독자 질문으로 검색어를 만든다.
 * 기관명·공식 도메인은 지어내지 않는다 — 검색 결과의 공식 도메인(isOfficialDestination)으로만 확정한다.
 * 상품명·금액·공고 번호는 여기 없다. 제도·행정 주제가 아니면(topicNeeds.needsOfficial=false) 계획을 만들지 않는다.
 *
 * 이 계획은 grounding 의 **조건부 보강**(OFFICIAL_BOOST, 기본 꺼짐 · 최대 1회)에서만 쓰인다. 기본 검색 수는 그대로다.
 */
import { isComparisonTopic, comparisonSubjects, type SourceScope } from './source-scope';
import { topicNeeds } from './evidence-gate';

export interface OfficialResearchPlan {
  keyword: string;
  needsOfficial: boolean;
  comparison: boolean;
  subjects: string[];
  /** 공식자료로 확인해야 하는 독자 질문(주제 공통 — 상품별 정답이 아니다) */
  questions: string[];
  /** 보강 시 쓸 검색어(대상별, 최대 2). 기관 매핑(scope)이 있으면 기존 기관 재검색 슬롯이 맡으므로 비운다 */
  queries: string[];
  reason: string;
  /** v3.8.759 — 공식 근거가 필요한 독자 질문(id 만; 판정 규칙은 OFFICIAL_NEEDS) */
  needs: Array<OfficialNeed['id']>;
}

export const OFFICIAL_QUESTIONS = ['현재 가입·모집 조건과 일정', '기존 안내 이후 변경사항', '비교 결론을 바꾸는 예외·단서'];

/**
 * v3.8.759 — 독자 질문 ↔ 필요한 공식 근거. 공식자료가 "충분한가" 는 문서 개수가 아니라 이 항목을 실제 본문이 답하는가로 본다.
 * markers 는 주제 공통 낱말이다(상품명·금액·공고 번호 없음). 'schedule' 은 현재 회차가 있는 주제에서 회차 일치까지 본다.
 */
export interface OfficialNeed { id: 'schedule' | 'conditions' | 'transition' | 'exceptions'; question: string; evidence: string; markers: RegExp; core: boolean }
export const OFFICIAL_NEEDS: OfficialNeed[] = [
  { id: 'schedule', question: '현재 모집·신청은 언제인가', evidence: '현재 회차 신청·모집 기간(날짜 범위)', markers: /(?:신청|모집|접수|청구)[^.]{0,40}\d{1,2}\s*월\s*\d{1,2}\s*일|\d{1,2}\s*월\s*\d{1,2}\s*일[^.]{0,40}(?:신청|모집|접수|청구)/, core: true },
  { id: 'conditions', question: '현재 가입·대상 조건은 무엇인가', evidence: '현재 적용 소득·재직·가구·연령 기준', markers: /(?:소득|재직|가구|자격|요건|대상|기준|연령|가입기간)[^.]{0,40}(?:이하|이상|미만|초과|충족|해당|기준)/, core: true },
  { id: 'transition', question: '전환·해지·변경 시 어떻게 되는가', evidence: '전환·해지 시 혜택·기여금·비과세 처리', markers: /(?:해지|전환|갈아타|변경|정지)[^.]{0,60}(?:유지|소멸|불가|가능|인정|지급)/, core: false },
  { id: 'exceptions', question: '결론을 바꾸는 예외는 무엇인가', evidence: '예외·단서·제외 조건', markers: /(?:제외|예외|단,|다만|불가|할 수 없)/, core: false },
];

export function buildOfficialResearchPlan(keyword: string, scope?: SourceScope): OfficialResearchPlan {
  const text = String(keyword || '').trim();
  const comparison = isComparisonTopic(text);
  const subjects = scope?.subjects?.length ? scope.subjects : (comparison ? comparisonSubjects(text) : [text]);
  const { needsOfficial } = topicNeeds(text);
  const needs = OFFICIAL_NEEDS.map((n) => n.id);
  if (!needsOfficial) return { keyword: text, needsOfficial, comparison, subjects, questions: [], queries: [], reason: '제도·행정 주제가 아니라 공식자료 조사를 계획하지 않음', needs: [] };
  if (scope) return { keyword: text, needsOfficial, comparison, subjects, questions: OFFICIAL_QUESTIONS, queries: [], reason: `주관기관 ${scope.agency} 매핑 있음 — 기존 기관 재검색 슬롯이 맡는다`, needs };
  const queries = subjects.slice(0, 2).map((s) => `${s} 공식 안내 가입 조건`);
  return { keyword: text, needsOfficial, comparison, subjects, questions: OFFICIAL_QUESTIONS, queries, reason: '기관 매핑 없음 — 대상별 공식 안내 검색어로 조건부 보강(승인 시 최대 1회)', needs };
}
