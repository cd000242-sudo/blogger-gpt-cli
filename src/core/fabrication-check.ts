/**
 * 날조 검사 — 글에만 있고 수집 재료에는 없는 검증 가능한 수치·고유명사를 찾는다.
 *
 * 왜 (2026-08-12, Better Life Naver 에서 먼저 발견해 이식):
 *   충실도 검사는 "재료의 사실이 글에서 빠졌나"(누락 방향)를 본다.
 *   환각 검사는 "혹평을 호평으로 뒤집었나"(감정 축)를 본다.
 *   LLM 이 없던 금액·날짜를 하나 만들어 넣는 것은 둘 다 통과한다.
 *   "지어내지 마라"는 프롬프트에만 있고 지켰는지 확인하는 코드가 없었다.
 *
 * 설계 원칙
 *   · 판단이 필요한 주장은 보지 않는다. 기계적으로 대조 가능한 것만 본다.
 *   · 오탐이 나면 쓸모가 없어진다. 서수·개수·일반 기간처럼 재료에 없어도
 *     정상인 표현은 애초에 후보에서 뺀다.
 *   · 측정·경고만 한다. 발행을 막거나 재작성을 트리거하지 않는다.
 */

export interface FabricationFinding {
  /** 글에서 발견된 원문 조각 */
  readonly claim: string;
  readonly kind: 'money' | 'percent' | 'date' | 'people' | 'org';
}

export interface FabricationCheckResult {
  readonly checked: boolean;
  readonly findings: readonly FabricationFinding[];
  readonly warnings: readonly string[];
  readonly totalClaims: number;
}

/** 재료가 이보다 짧으면 대조 자체가 무의미하다 */
const MIN_SOURCE_CHARS = 200;

/** 재료에 없어도 정상인 표현 — 이 목록이 곧 오탐 방어선이다. */
const BENIGN_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\d+\s*(가지|번째|단계|순위|위)$/u,
  /^\d+\s*(초|분|시간|일|주|주일|개월|달|년)\s*(정도|쯤|가량|이면|만에)?$/u,
  /^(하루|이틀|사흘|일주일|한\s?달|반년)$/u,
]);

const MONEY = /\d[\d,]*\s*(억|천만|백만|만)?\s*원/gu;
const PERCENT = /\d+(?:\.\d+)?\s*(?:%|퍼센트|퍼)/gu;
const DATE = /\d{1,2}\s*월\s*\d{1,2}\s*일|\d{4}\s*년\s*\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?/gu;
const PEOPLE = /\d[\d,]*\s*(?:명|가구|세대|팀)/gu;
/** 기관·제도명. 5자 미만은 "종합병원" 같은 일반명사라 뺀다. */
const ORG = /[가-힣]{2,}(?:청|부|처|원|공단|공사|재단|협회|위원회|센터)/gu;
const ORG_MIN_CHARS = 5;

const KIND_LABEL: Readonly<Record<FabricationFinding['kind'], string>> = Object.freeze({
  money: '금액', percent: '비율', date: '날짜', people: '인원', org: '기관명',
});

/** 숫자 표기 흔들림을 흡수한다 — "1,200만원"과 "1200 만 원"을 같게 본다 */
function normalizeForMatch(value: string): string {
  return value.replace(/[\s,]/gu, '');
}

function isBenign(claim: string): boolean {
  return BENIGN_PATTERNS.some(pattern => pattern.test(claim.replace(/\s+/gu, ' ').trim()));
}

function collect(
  text: string,
  pattern: RegExp,
  kind: FabricationFinding['kind'],
  minChars = 0,
): FabricationFinding[] {
  const out: FabricationFinding[] = [];
  for (const match of text.matchAll(pattern)) {
    const claim = match[0].trim();
    if (!claim || claim.length < minChars || isBenign(claim)) continue;
    out.push({ claim, kind });
  }
  return out;
}

/** HTML 본문에서도 쓰이므로 태그를 걷어낸다 — 태그가 숫자 사이에 끼면 매칭이 깨진다. */
export function stripHtmlForCheck(html: string): string {
  return String(html ?? '')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/&nbsp;/gu, ' ')
    .replace(/\s+/gu, ' ');
}

/** 글에서 기계적으로 대조 가능한 주장만 뽑는다. */
export function extractVerifiableClaims(text: string): FabricationFinding[] {
  const body = String(text ?? '');
  if (!body) return [];
  const all = [
    ...collect(body, MONEY, 'money'),
    ...collect(body, PERCENT, 'percent'),
    ...collect(body, DATE, 'date'),
    ...collect(body, PEOPLE, 'people'),
    ...collect(body, ORG, 'org', ORG_MIN_CHARS),
  ];
  const seen = new Set<string>();
  return all.filter((finding) => {
    const key = `${finding.kind}:${normalizeForMatch(finding.claim)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 결과 본문의 주장이 재료에 실제로 있는지 대조한다.
 * 측정·경고만 한다 — 호출 측에서 발행을 막지 않는다.
 */
export function checkFabrication(
  rawText: string,
  resultBody: string,
): FabricationCheckResult {
  const source = stripHtmlForCheck(rawText);
  const body = stripHtmlForCheck(resultBody);

  if (source.length < MIN_SOURCE_CHARS || !body.trim()) {
    return { checked: false, findings: [], warnings: [], totalClaims: 0 };
  }

  const claims = extractVerifiableClaims(body);
  const normalizedSource = normalizeForMatch(source);
  const findings = claims.filter(
    finding => !normalizedSource.includes(normalizeForMatch(finding.claim)),
  );

  return {
    checked: true,
    findings,
    warnings: findings.map(f => `재료에 없는 ${KIND_LABEL[f.kind]}: "${f.claim}"`),
    totalClaims: claims.length,
  };
}
