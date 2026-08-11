/**
 * 🕐 자료의 시점을 재료에 붙인다 (v3.8.479)
 *
 * ## 왜 필요한가 — 실측 사고
 * 사용자가 "2026 부산 청년 게임개발자 정착지원사업" 글을 뽑아 팩트체크한 결과,
 * **2024년 조건이 2026년 원고에 섞여 있었다**:
 *   · "임차보증금 이자와 월세의 최대 50%"      → 2024 조건 (2026 은 월세만)
 *   · "선정일로부터 2주 이내 임차계약"          → 2024 조건 (2026 은 협약일 1개월 내 전입)
 *   · "소득 수준·주택 소유 여부와 무관"         → 2024 보도자료 표현
 * 반대로 2026 핵심(만 18~39세 · 2024.1.1 이후 입사 · 전입신고)은 빠졌다.
 *
 * ## 원인은 모델이 아니라 재료다
 * 1) 블로그 검색이 `sort=sim` 이라 글이 가장 많이 쓰인 **첫 시행 연도(2024)** 글이 상위로 온다
 * 2) 네이버 API 가 주는 `postdate` 를 크롤러가 **버렸다** — 재료에 날짜가 없었다
 * 3) fact-integrity 는 "근거 장부에 없는 수치"만 지운다. 2024 조건이 장부에 있으니 통과한다
 * 4) FRESHNESS_RULES 는 "끝난 사업을 현재형으로 쓰지 말라"고 하는데,
 *    모델이 그 자료가 작년 것인지 **알 방법이 없었다**
 *
 * v3.8.473 으로 본문을 1,200자씩 가져오게 되면서 이 실패 모드가 커졌다 —
 * 예전엔 오래된 글이 스니펫 175자만 기여했지만 이제 상세 조건을 통째로 기여한다.
 * 재료의 양을 늘렸으면 시점 검증도 같이 넣었어야 했다.
 *
 * ## 무엇을 하는가
 * 자료마다 작성일을 앞에 박고, 오래된 것에는 **그대로 옮기지 말라는 경고**를 붙인다.
 * 모델이 시점을 알면 FRESHNESS_RULES 가 비로소 작동한다.
 */

/** 이보다 오래되면 "지금 조건과 다를 수 있다" 고 경고한다 */
export const STALE_AFTER_MONTHS = 12;

/** 네이버 검색 API 의 postdate 형식(YYYYMMDD)을 ISO 날짜로 */
export function parseNaverPostDate(postdate: unknown): string {
  const raw = String(postdate || '').replace(/\D/g, '');
  if (raw.length !== 8) return '';
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(4, 6));
  const day = Number(raw.slice(6, 8));
  if (year < 1990 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

/** 두 시점 사이 개월 수 (음수면 0) */
export function monthsBetween(isoDate: string, now: Date = new Date()): number {
  const then = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(then.getTime())) return 0;
  const months = (now.getUTCFullYear() - then.getUTCFullYear()) * 12
    + (now.getUTCMonth() - then.getUTCMonth());
  return Math.max(0, months);
}

/** 사람이 읽는 경과 표현 — "2년 5개월 전" */
function elapsedLabel(months: number): string {
  if (months < 1) return '이번 달';
  if (months < 12) return `${months}개월 전`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years}년 전` : `${years}년 ${rest}개월 전`;
}

/**
 * 자료 앞에 붙일 시점 표시.
 * 날짜를 모르면 빈 문자열 — 없는 날짜를 지어내지 않는다.
 */
export function buildFreshnessLabel(isoDate: string, now: Date = new Date()): string {
  if (!isoDate) return '';
  const months = monthsBetween(isoDate, now);
  if (months < STALE_AFTER_MONTHS) {
    return `[${isoDate} 작성 · ${elapsedLabel(months)}]`;
  }
  return `[${isoDate} 작성 · ${elapsedLabel(months)} ⚠️ 오래된 자료입니다. `
    + `여기 적힌 금액·기간·조건은 그 시점 기준이라 지금과 다를 수 있습니다. `
    + `현재 기준으로 확인되지 않은 값은 본문에 옮기지 마세요]`;
}

/**
 * 자료 본문 앞에 시점 표시를 붙인다.
 * 날짜가 없으면 원문 그대로 — 동작이 나빠지지 않는다.
 */
export function withFreshnessLabel(content: string, isoDate: string, now: Date = new Date()): string {
  const label = buildFreshnessLabel(isoDate, now);
  const body = String(content || '');
  if (!label) return body;
  return `${label}\n${body}`;
}

/** 오래된 자료인가 */
export function isStaleSource(isoDate: string, now: Date = new Date()): boolean {
  if (!isoDate) return false;
  return monthsBetween(isoDate, now) >= STALE_AFTER_MONTHS;
}
