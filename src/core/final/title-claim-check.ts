/**
 * title-claim-check — 제목이 약속한 수치를 **본문이 갖고 있는지** 본다. (v3.8.594, 호출 0회)
 *
 * ## 실측 사고 — "혁신성장촉진자금 비즈스캔 2026년 신청때 IT 용어 20개인가"
 * 입력 키워드는 `혁신성장촉진자금 비즈스캔` 이었다. 뒤의 "IT 용어 20개"는 우리 글에서
 * 나온 말이 아니다. 본문에 실린 IT 용어는 **4개**(디지털 전환·스마트기술·스마트공장·DX)이고,
 * "20개"라는 말은 **본문에 0회** 나온다. 제목에만 있다.
 *
 * ## 왜 새는가 — 제목이 본문보다 먼저 만들어진다
 * 제목은 진행률 25% 지점에서 만들어지고(orchestration), 그때 재료는 **남의 인기 제목 10개**다.
 * 거기 있던 숫자가 그대로 제목에 옮겨 붙고, **본문은 그 제목을 따라 쓰인다.**
 * 그래서 다섯 섹션 중 네 번째에 억지로 "IT 용어" 섹션이 생겼고, 약속한 20개는 채우지 못했다.
 * 지어낸 문장이 아니라 **못 지킨 약속**이라 fact-guard 도 실속 게이트도 통과한다.
 *
 * ## 무엇을 하나
 * 본문이 완성된 뒤(호출 0회) 제목의 수치를 본문과 대조한다.
 * 본문에 없는 수치는 **그 구절만 도려낸다.** 제목을 다시 짓지 않는다 —
 * 품질은 첫 생성 프롬프트에서 올리고, 여기서는 거짓 약속만 걷어낸다.
 *
 * ## 막지 않는다
 * 도려내고 남는 게 너무 짧으면 손대지 않는다. 발행이 검수 때문에 멈추는 일은 만들지 않는다.
 */

import { normalizeForMatch, containsValueToken } from './number-token';

/**
 * 제목에서 볼 수치. 긴 단위를 먼저 놓는다(개월 ↛ 개).
 * 연도(20XX년)는 시스템이 프롬프트로 직접 넣는 값이라 아래에서 따로 뺀다.
 */
const TITLE_VALUE_PATTERN = /(?<![\d.])\d+(?:,\d{3})*(?:\.\d+)?\s*(?:만원|억원|억|원|퍼센트|%|개월|가지|단계|곳|명|건|개|위|배|종|주|시간|일|세|회|년)/g;

/** 시스템이 넣는 연도 토큰 — 근거를 물을 값이 아니다 */
const SYSTEM_YEAR = /^20\d{2}년$/;

export interface UnkeptTitleClaim {
  /** 정규화된 수치 (예: "20개") */
  token: string;
  /** 제목에서 도려낼 구절 — 수치에 붙은 조사·어미까지 (예: "20개인가") */
  phrase: string;
}

/**
 * 제목이 약속했는데 **본문에 없는** 수치를 찾는다.
 *
 * 키워드에 들어 있는 수치는 사용자가 직접 넣은 말이므로 건드리지 않는다.
 */
export function findUnkeptTitleClaims(input: {
  title: string;
  bodyText: string;
  keyword?: string;
}): UnkeptTitleClaim[] {
  const title = String(input.title || '');
  if (!title.trim()) return [];

  const bodyN = normalizeForMatch(input.bodyText || '');
  const keywordN = normalizeForMatch(input.keyword || '');
  const found: UnkeptTitleClaim[] = [];
  const seen = new Set<string>();

  TITLE_VALUE_PATTERN.lastIndex = 0;
  for (let m = TITLE_VALUE_PATTERN.exec(title); m; m = TITLE_VALUE_PATTERN.exec(title)) {
    const raw = m[0];
    const token = normalizeForMatch(raw);
    if (!token || seen.has(token)) continue;
    if (SYSTEM_YEAR.test(token)) continue;
    if (keywordN && containsValueToken(keywordN, token)) continue;
    if (bodyN && containsValueToken(bodyN, token)) continue;

    // 수치에 붙은 조사·어미까지 한 구절로 본다 ("20개" → "20개인가")
    const tailStart = m.index + raw.length;
    const tail = (title.slice(tailStart).match(/^[가-힣]+/) || [''])[0];
    seen.add(token);
    found.push({ token, phrase: `${raw}${tail}` });
  }

  return found;
}

/** 도려내고 이만큼도 안 남으면 손대지 않는다 */
const MIN_TITLE_LENGTH = 8;

/**
 * 못 지킨 약속을 제목에서 도려낸다.
 *
 * 남는 게 너무 짧으면 원래 제목을 그대로 돌려준다 — 제목을 망가뜨리느니 그대로가 낫다.
 */
export function stripUnkeptClaims(title: string, claims: UnkeptTitleClaim[]): string {
  const original = String(title || '');
  if (!original.trim() || claims.length === 0) return original;

  const stripped = claims
    .reduce((acc, claim) => acc.split(claim.phrase).join(' '), original)
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,·\-:]+|[\s,·\-:]+$/g, '')
    .trim();

  return stripped.length >= MIN_TITLE_LENGTH ? stripped : original;
}

/** 로그 한 줄 */
export function describeUnkeptClaims(claims: UnkeptTitleClaim[]): string {
  if (claims.length === 0) return '제목이 약속한 수치가 본문에 모두 있습니다';
  return `제목이 약속했는데 본문에 없는 수치: ${claims.map((c) => c.token).join(', ')}`;
}
