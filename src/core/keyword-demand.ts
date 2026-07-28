/**
 * 키워드 수요 실측 게이트 (v3.8.383, 관측 전용)
 *
 * 배경: 검색광고 API 자격증명이 등록된 적이 없어(NAVERCUSTOMERID에 개발자센터 CLIENT_ID가
 *   중복 저장돼 있었음) 앱의 "검색량"은 전부 블로그 문서수 × 0.3 추정 폴백이었다
 *   (naver-datalab-api.ts getBlogSearchFallback). 문서수는 경쟁도지 수요가 아니므로
 *   이 숫자는 경쟁 심한 키워드를 수요 높은 키워드로 오인하게 만드는 거꾸로 된 신호였다.
 *
 * 실측 근거(2026-07-28, GSC 90일 + DataLab 13주):
 *   - 4~10위에 26편이 있는데 페이지당 노출 17회 — 순위가 아니라 표현의 검색량이 병목.
 *   - 최근 발행 6편 중 5편의 제목 표현("실손보험 지급거절" 등)이 DataLab 측정 하한 미만.
 *   - 같은 주제의 넓은 표현("실손보험 청구")은 측정 가능한 수요가 있음.
 *
 * 원리: 네이버 DataLab 통합검색어 트렌드로 키워드와 그 머리 절단형(head truncation)들을
 *   한 호출에서 비교한다. "가장 길면서 측정 가능한 변형" = 사람들이 실제로 치는 가장
 *   구체적인 표현이며, 제목 앞부분은 그 표현으로 시작해야 한다. 입력 키워드의 나머지
 *   토큰(각도)은 부제·H2로 배치한다.
 *
 * 절대 규칙: 이 게이트는 발행을 막지 않는다. 실패 시 verdict='error'로 조용히 물러난다.
 */

export interface DemandVariant {
  term: string;
  /** 13주 주간 상대지수 합 (호출 내 상대값, 0 = 측정 하한 미만) */
  ratioSum: number;
}

export type DemandVerdict = 'ok' | 'rephrase' | 'no-demand' | 'error';

export interface KeywordDemandResult {
  keyword: string;
  verdict: DemandVerdict;
  variants: DemandVariant[];
  /** 측정 가능한 가장 구체적(긴) 표현. no-demand/error면 null */
  searchedTerm: string | null;
  /** 입력 키워드에서 searchedTerm을 제외한 나머지 = 부제·H2로 보낼 각도 */
  angle: string | null;
  /** 제목 생성 프롬프트에 그대로 넣는 지시문. 없으면 null */
  titleHint: string | null;
  /** 로그용 한 줄 요약 */
  summary: string;
}

export interface DemandGateOptions {
  clientId: string;
  clientSecret: string;
  /** 테스트 주입용. 기본 globalThis.fetch */
  fetchImpl?: typeof fetch;
  /** DataLab 호출 타임아웃(ms). 기본 8000 */
  timeoutMs?: number;
}

/**
 * 키워드의 머리 절단형 변형을 만든다.
 * "실손보험 지급거절 이의신청" → [전체, "실손보험 지급거절", "실손보험"]
 * DataLab은 호출당 5그룹까지라 최대 5개로 자른다.
 */
export function buildVariants(keyword: string): string[] {
  const tokens = keyword.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let n = tokens.length; n >= 1; n--) {
    const v = tokens.slice(0, n).join(' ');
    if (!out.includes(v)) out.push(v);
  }
  return out.slice(0, 5);
}

/** DataLab 요청 본문을 만든다 (최근 13주, 주 단위) */
export function buildDatalabBody(variants: string[], today: Date = new Date()): object {
  const end = new Date(today);
  end.setDate(end.getDate() - 1); // DataLab은 당일 데이터가 없다
  const start = new Date(end);
  start.setDate(start.getDate() - 7 * 13);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    startDate: fmt(start),
    endDate: fmt(end),
    timeUnit: 'week',
    keywordGroups: variants.map(v => ({ groupName: v, keywords: [v] })),
  };
}

/** 판정 결과로 제목 지시문을 만든다 */
export function composeTitleHint(
  keyword: string,
  verdict: DemandVerdict,
  searchedTerm: string | null,
  angle: string | null
): string | null {
  if (verdict === 'ok') {
    return `검색 실측: "${keyword}"는 실제로 검색되는 표현이다. 제목 앞부분(첫 12자 이내)에 이 표현을 변형 없이 그대로 포함하라.`;
  }
  if (verdict === 'rephrase' && searchedTerm) {
    const anglePart = angle
      ? ` "${angle}"(은)는 검색되지 않는 표현이므로 제목 뒤쪽 부제로 배치하고, 본문 H2 소제목에서 정면으로 다뤄라.`
      : '';
    return `검색 실측: "${keyword}" 전체는 검색량 측정 하한 미만이다. 사람들이 실제로 치는 표현은 "${searchedTerm}"이다. 제목은 반드시 "${searchedTerm}"(으)로 시작하라.${anglePart}`;
  }
  return null; // no-demand / error 는 제목 지시 없음 (경고 로그만)
}

/**
 * 키워드의 실제 검색 수요를 측정한다. 절대 throw 하지 않는다.
 */
export async function analyzeKeywordDemand(
  keyword: string,
  opts: DemandGateOptions
): Promise<KeywordDemandResult> {
  const base: KeywordDemandResult = {
    keyword, verdict: 'error', variants: [], searchedTerm: null,
    angle: null, titleHint: null, summary: '수요 실측 실패(API)',
  };
  const kw = keyword.trim();
  if (!kw || !opts.clientId || !opts.clientSecret) {
    return { ...base, summary: '수요 실측 건너뜀(키 또는 키워드 없음)' };
  }

  const variants = buildVariants(kw);
  const doFetch = opts.fetchImpl || fetch;
  let res: Response;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  try {
    res = await doFetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': opts.clientId,
        'X-Naver-Client-Secret': opts.clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildDatalabBody(variants)),
      signal: ctrl.signal,
    });
  } catch {
    return base;
  } finally {
    clearTimeout(timer); // fetch가 throw 해도 타이머를 걷는다 (open handle 방지)
  }
  if (!res.ok) return { ...base, summary: `수요 실측 실패(HTTP ${res.status})` };

  let results: Array<{ title: string; data: Array<{ ratio: number }> }>;
  try {
    const json = await res.json() as { results?: Array<{ title: string; data: Array<{ ratio: number }> }> };
    results = json.results || [];
  } catch {
    return { ...base, summary: '수요 실측 실패(응답 파싱)' };
  }

  const sums = new Map<string, number>();
  for (const r of results) {
    sums.set(r.title, (r.data || []).reduce((a, d) => a + (d.ratio || 0), 0));
  }
  const measured: DemandVariant[] = variants.map(term => ({ term, ratioSum: sums.get(term) ?? 0 }));

  // "가장 길면서 측정 가능한" 변형 = 사람들이 실제로 치는 가장 구체적인 표현.
  // variants 는 전체→머리 순으로 정렬돼 있으므로 앞에서부터 첫 양수를 찾으면 된다.
  const searched = measured.find(v => v.ratioSum > 0) || null;

  let verdict: DemandVerdict;
  if (!searched) verdict = 'no-demand';
  else if (searched.term === kw) verdict = 'ok';
  else verdict = 'rephrase';

  const angle = verdict === 'rephrase' && searched
    ? kw.slice(searched.term.length).trim() || null
    : null;
  const titleHint = composeTitleHint(kw, verdict, searched?.term ?? null, angle);

  // 10 미만은 소수 1자리로 표시 — 0.3을 "0"으로 보여주면 "0인데 왜 검색됨?"이 된다
  const fmtRatio = (n: number) => n === 0 ? '0' : n >= 10 ? n.toFixed(0) : n.toFixed(1);
  const ladder = measured
    .map(v => `${v.term}=${fmtRatio(v.ratioSum)}`)
    .join(' · ');
  const summary =
    verdict === 'ok' ? `"${kw}" 검색됨 (${ladder})`
      : verdict === 'rephrase' ? `"${kw}"는 하한 미만 → 검색되는 표현 "${searched!.term}" (${ladder})`
        : `전 변형 측정 하한 미만 (${ladder}) — 검색 유입 기대 불가`;

  return { keyword: kw, verdict, variants: measured, searchedTerm: searched?.term ?? null, angle, titleHint, summary };
}
