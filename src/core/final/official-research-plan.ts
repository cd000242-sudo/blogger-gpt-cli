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
}

export const OFFICIAL_QUESTIONS = ['현재 가입·모집 조건과 일정', '기존 안내 이후 변경사항', '비교 결론을 바꾸는 예외·단서'];

export function buildOfficialResearchPlan(keyword: string, scope?: SourceScope): OfficialResearchPlan {
  const text = String(keyword || '').trim();
  const comparison = isComparisonTopic(text);
  const subjects = scope?.subjects?.length ? scope.subjects : (comparison ? comparisonSubjects(text) : [text]);
  const { needsOfficial } = topicNeeds(text);
  if (!needsOfficial) return { keyword: text, needsOfficial, comparison, subjects, questions: [], queries: [], reason: '제도·행정 주제가 아니라 공식자료 조사를 계획하지 않음' };
  if (scope) return { keyword: text, needsOfficial, comparison, subjects, questions: OFFICIAL_QUESTIONS, queries: [], reason: `주관기관 ${scope.agency} 매핑 있음 — 기존 기관 재검색 슬롯이 맡는다` };
  const queries = subjects.slice(0, 2).map((s) => `${s} 공식 안내 가입 조건`);
  return { keyword: text, needsOfficial, comparison, subjects, questions: OFFICIAL_QUESTIONS, queries, reason: '기관 매핑 없음 — 대상별 공식 안내 검색어로 조건부 보강(승인 시 최대 1회)' };
}
