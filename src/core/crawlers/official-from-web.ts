/**
 * 🏛️ 기관 근거를 CSE 없이 만든다 (v3.8.476)
 *
 * ## 왜 필요한가
 * `official-sources.ts` 는 Google CSE 로만 돈다. 그런데 CSE 는
 *   · 신규 고객에게 **발급이 막혔고**(새 계정은 403 PERMISSION_DENIED)
 *   · 기존 고객도 **2027-01-01 에 종료**된다
 * 즉 지금 쓰는 사람에게만 4개월 남은 기능이고, 새로 사는 사람에게는 처음부터 없다.
 * 공공기관 근거가 통째로 사라지는 자리라 대체 경로가 필요하다.
 *
 * ## 무엇으로 대체하나
 * 네이버 웹문서(webkr). **이미 쓰는 네이버 검색 키 그대로**라 추가 발급이 없다.
 * 실측 2026-08-11 (display=10, 기관 도메인 = go.kr · or.kr · re.kr):
 *   "청년 월세 지원"   기관 10건 → "월 최대 20만원씩 최장 24개월간 월세를 지원합니다(생애1회)"
 *   "기초연금 수급자격" 기관  8건 → "단독가구: 8억7,600만원 이하인 경우 지급대상"
 *   "전기차 보조금"    기관  7건 → "2년 내 2만Km를 운행하지 않고 판매 시 환수금이 발생함"
 *   "치아교정 비용"    기관  0건 → 정부 주제가 아니면 안 나온다(정상)
 *
 * 본문 fetch 는 기대하지 않는다 — 기관 사이트는 SPA(bokjiro·ev.or.kr 는 fetch 평문 0~3자)
 * 이거나 컨테이너가 사이트 고유(easylaw `ovDivbox1`)라 범용 추출이 대체로 실패한다.
 * 검색 API 가 준 요약만으로도 위처럼 조건·금액·기간이 들어 있다.
 */

import { extractNumericSentences, resolveAgency, mergeByAgency, type OfficialSource } from '../final/official-sources';

/**
 * 게시판 목록·진단 위젯이 문장인 척 넘어오는 것들.
 * 실측: "제목: 2026년 지자체 출산지원금…, 등록일: 2026-03-17",
 *       "청년월세지원진단 진단결과보기 진단 조건 선택 1 주민등록상 출생년도 입력하세요."
 * 숫자가 있어서 extractNumericSentences 를 통과하지만 정보량은 0이다.
 */
const LIST_NOISE = /제목\s*:|등록일\s*:|작성일\s*:|조회수|첨부파일|진단결과|조건\s*선택|입력하세요|선택하세요|더보기/;

/** 이 이름으로는 "기관 근거" 라고 부를 수 없다 — 사람이 읽는 기관명이어야 한다 */
function agencyLabel(url: string): string {
  const named = resolveAgency(url);
  if (named) return named;
  const host = (String(url || '').match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
  return host.replace(/^www\.|^m\./i, '').replace(/:\d+$/, '');
}

export interface WebOfficialInput {
  url?: string;
  content?: string;
  source?: string;
}

/**
 * 크롤링 결과 중 기관 도메인 항목만 골라 `OfficialSource[]` 로 바꾼다.
 * 쓸 만한 수치 문장이 하나도 없으면 빈 배열 — 호출부는 아무것도 넣지 않으면 된다.
 */
export function buildOfficialSourcesFromWeb(
  posts: WebOfficialInput[],
  maxAgencies = 4,
): OfficialSource[] {
  const collected: OfficialSource[] = [];

  for (const post of Array.isArray(posts) ? posts : []) {
    if (String(post?.source || '') !== 'naver-web-official') continue;
    const url = String(post?.url || '').trim();
    if (!url) continue;

    const sentences = extractNumericSentences(String(post?.content || ''), 3)
      .filter((sentence) => !LIST_NOISE.test(sentence));
    if (sentences.length === 0) continue;

    const agency = agencyLabel(url);
    if (!agency) continue;

    collected.push({ agency, url, sentences } as OfficialSource);
  }

  if (collected.length === 0) return [];
  return mergeByAgency(collected).slice(0, Math.max(1, maxAgencies));
}
