/**
 * 키워드 좁히기 제안 (v3.8.392)
 *
 * 근거 — 사용자가 제공한 영상 7:56~9:07:
 *   "주제를 너무 넓게 잡지 말고 깊게 파보라. 주제와 키워드가 좁아질수록 상위 노출에 유리하다.
 *    **하지만 그 키워드의 검색 유입 정도, 트래픽을 반드시 확인하라.**
 *    경쟁이 없다는 건 진입 장벽이 낮아 좋지만 사람이 안 들어오면 수익이 안 난다."
 *
 * 기존 keyword-demand.ts 는 **넓히기(머리 절단)만** 한다.
 *   "청년월세 지원금 신청방법" → "청년월세 지원금" → "청년월세" → "청년"
 *   사용자가 입력한 것보다 좁은 표현은 한 번도 시험해보지 않았다. 이 모듈이 반대를 담당한다.
 *
 * ── 실측으로 설계가 두 번 바뀌었다 (2026-07-30, DataLab 실호출) ──
 *
 * 1차 설계(앞에 붙이기)는 **완전히 실패했다**. 6개 키워드 전부 0:
 *     "아이와 함께 제주도 렌트카"  → 데이터점 0개
 *     "주말 제주도 렌트카"        → 데이터점 0개
 *   API 는 정상이었다(대조군 "날씨" 합 827). 한국어 검색은 수식어를 앞이 아니라 뒤에 붙인다.
 *
 * 2차 설계(뒤에 붙이기)는 6개 중 4개 성공:
 *     "제주도 렌트카 추천"     합  33.2   (원본 1014.6 의 3.3%)
 *     "장기요양 등급 신청방법"  합 231.5   (원본 1226.8 의 18.9%)
 *     "실손보험 청구방법"      합  42.1   (원본  845.9 의 5.0%)
 *     "청년월세 지원금 서류"    합  59.9   (원본  693.0 의 8.6%)
 *   실패한 2개("전세 보증금 증액", "누수 배상")는 원본 검색량 자체가 작은 니치라
 *   접미어를 붙이면 측정 하한 아래로 떨어진다. 그 경우엔 아무것도 제안하지 않는다.
 *
 * ⚠️ 영상이 예로 든 "아이와 함께" 같은 **대상 한정어는 의도적으로 제외했다.**
 *   DataLab 해상도로 검증이 불가능하고(데이터점 0), 검증 없이 제안하면
 *   영상이 바로 경고한 함정 — "경쟁은 없지만 사람도 안 오는 키워드" — 에 빠진다.
 *   측정할 수 없는 것을 추천하지 않는 것이 이 모듈의 원칙이다.
 *
 * ⚠️ 키워드를 자동으로 바꾸지 않는다. 사용자가 고른 주제를 도구가 갈아치우면 안 된다.
 *   (a) 수요가 확인된 좁은 초점을 **제안**하고
 *   (b) 본문이 그 초점을 깊게 다루도록 프롬프트에 지시를 넣는다.
 *   제목·키워드는 사용자 것 그대로다.
 *
 * 비용: DataLab 1회 추가 호출(무료 API). LLM 호출 0.
 */
import { buildDatalabBody } from './keyword-demand';

export interface NarrowCandidate {
  /** 좁힌 표현 전체 (예: "청년월세 지원금 서류") */
  term: string;
  /** 붙인 접미어 (예: "서류") */
  suffix: string;
  /** DataLab 비율 합 */
  ratioSum: number;
  /** 원본 대비 비중 (0~1). 노이즈 판정에 쓴다. */
  share: number;
}

export interface NarrowingResult {
  keyword: string;
  /** 원본 키워드의 비율 합 */
  baseRatioSum: number;
  /** 수요가 확인된 좁은 표현들 (비율 내림차순) */
  measured: NarrowCandidate[];
  /** 가장 유망한 것 (없으면 null) */
  best: NarrowCandidate | null;
  /** 로그용 요약 */
  summary: string;
}

/**
 * 접미어 후보 풀 — 사람들이 실제로 **뒤에** 붙이는 말.
 *
 * DataLab 이 걸러주므로 후보가 빗나가도 손해는 없다(수요 0이면 버려진다).
 * 호출당 그룹 5개 상한이라 원본 1개 + 후보 4개까지만 쓴다.
 */
const SUFFIX_POOL: Array<{ match: RegExp; suffixes: string[] }> = [
  {
    // 여행·장소·외식 — 실측: "추천" 33.2, "가격" 13.1
    match: /여행|렌트카|렌터카|숙소|호텔|펜션|카페|맛집|공항|관광|투어|입장료|주차|코스/,
    suffixes: ['추천', '가격', '예약', '코스'],
  },
  {
    // 정부 지원·신청 제도 — 실측: "신청방법" 231.5, "서류" 59.9, "조건" 56.4
    match: /지원금|보조금|신청|급여|수당|바우처|장려금|환급|감면|공고|등급|자격/,
    suffixes: ['신청방법', '조건', '서류', '기간'],
  },
  {
    // 보험·보상·분쟁 — 실측: "청구방법" 42.1
    match: /보험|보상|청구|합의|배상|손해|과실|약관|면책/,
    suffixes: ['청구방법', '기준', '한도', '서류'],
  },
  {
    // 부동산·임대차
    match: /전세|월세|임대|보증금|계약|확정일자|등기|매매|중개|누수/,
    suffixes: ['방법', '비용', '절차', '기준'],
  },
  {
    // 금융·대출·세금
    match: /대출|금리|카드|적금|예금|세금|연금|투자|주식|한도/,
    suffixes: ['조건', '금리', '한도', '비교'],
  },
];

/** 어느 풀에도 걸리지 않을 때 */
const DEFAULT_SUFFIXES = ['방법', '조건', '기준', '비용'];

/** 키워드에 맞는 접미어 후보를 고른다. */
export function pickSuffixes(keyword: string): string[] {
  const kw = String(keyword || '');
  for (const entry of SUFFIX_POOL) {
    if (entry.match.test(kw)) return entry.suffixes.slice(0, 4);
  }
  return DEFAULT_SUFFIXES.slice(0, 4);
}

/** 좁힌 표현을 만든다. 이미 그 말이 들어있으면 건너뛴다. */
export function buildNarrowTerms(keyword: string, suffixes: string[]): NarrowCandidate[] {
  const kw = String(keyword || '').trim();
  if (!kw) return [];
  const out: NarrowCandidate[] = [];
  suffixes.forEach((suffix) => {
    const s = String(suffix || '').trim();
    if (!s || kw.includes(s)) return;                   // 중복 방지
    const term = `${kw} ${s}`;
    if (out.some(c => c.term === term)) return;
    out.push({ term, suffix: s, ratioSum: 0, share: 0 });
  });
  return out.slice(0, 4);
}

export interface NarrowingOptions {
  clientId: string;
  clientSecret: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * 원본 대비 최소 비중. 기본 0.01(1%).
   * 실측 근거: 절대값만 보면 "제주도 렌트카 후기"(합 0.3, 원본의 0.03%)처럼
   *   사실상 검색되지 않는 표현이 통과한다. 상대 비중이 노이즈를 정확히 걸러낸다.
   */
  minShare?: number;
  /** 절대 하한 — 원본 자체가 작을 때 상대비만 보면 노이즈가 통과한다 */
  minRatio?: number;
}

/**
 * 좁힌 표현들의 실제 검색 수요를 측정한다. 절대 throw 하지 않는다.
 * 실패·미확보 시 best 가 null → 호출부는 아무것도 하지 않으면 된다.
 */
export async function suggestNarrowerKeywords(
  keyword: string,
  opts: NarrowingOptions,
): Promise<NarrowingResult> {
  const kw = String(keyword || '').trim();
  const empty: NarrowingResult = { keyword: kw, baseRatioSum: 0, measured: [], best: null, summary: '' };
  if (!kw || !opts?.clientId || !opts?.clientSecret) {
    return { ...empty, summary: '좁히기 측정 건너뜀(키 또는 키워드 없음)' };
  }

  const candidates = buildNarrowTerms(kw, pickSuffixes(kw));
  if (candidates.length === 0) return { ...empty, summary: '좁힐 후보가 없음' };

  const minShare = opts.minShare ?? 0.01;
  const minRatio = opts.minRatio ?? 1;
  const doFetch = opts.fetchImpl || fetch;
  // 원본을 같은 호출에 넣어야 상대 비중을 계산할 수 있다 (DataLab 은 상대 비율만 준다)
  const terms = [kw, ...candidates.map(c => c.term)];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  let res: Response;
  try {
    res = await doFetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'X-Naver-Client-Id': opts.clientId,
        'X-Naver-Client-Secret': opts.clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildDatalabBody(terms)),
      signal: ctrl.signal,
    });
  } catch {
    return { ...empty, summary: '좁히기 측정 실패(네트워크)' };
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return { ...empty, summary: `좁히기 측정 실패(HTTP ${res.status})` };

  let results: Array<{ title: string; data: Array<{ ratio: number }> }>;
  try {
    const json = await res.json() as { results?: Array<{ title: string; data: Array<{ ratio: number }> }> };
    results = json.results || [];
  } catch {
    return { ...empty, summary: '좁히기 측정 실패(응답 파싱)' };
  }

  const sums = new Map<string, number>();
  results.forEach((r) => {
    sums.set(r.title, (r.data || []).reduce((a, d) => a + (d.ratio || 0), 0));
  });

  const baseRatioSum = sums.get(kw) ?? 0;
  const scored = candidates.map((c) => {
    const ratioSum = sums.get(c.term) ?? 0;
    return { ...c, ratioSum, share: baseRatioSum > 0 ? ratioSum / baseRatioSum : 0 };
  });

  const measured = scored
    .filter(c => c.ratioSum >= minRatio && c.share >= minShare)
    .sort((a, b) => b.ratioSum - a.ratioSum);

  const fmt = (n: number) => n === 0 ? '0' : n >= 10 ? n.toFixed(0) : n.toFixed(1);
  const ladder = scored.map(c => `${c.suffix}=${fmt(c.ratioSum)}`).join(' · ');

  if (measured.length === 0) {
    return {
      keyword: kw, baseRatioSum, measured: [], best: null,
      summary: `좁힌 표현 전부 수요 하한 미만 (${ladder}) — 원 키워드 유지`,
    };
  }
  const best = measured[0]!;
  return {
    keyword: kw,
    baseRatioSum,
    measured,
    best,
    summary: `수요 확인된 좁은 초점 ${measured.length}개 (${ladder})`
      + ` → 1순위 "${kw} ${best.suffix}" (원본의 ${(best.share * 100).toFixed(1)}%)`,
  };
}

/**
 * 프롬프트용 초점 지시. 키워드·제목은 바꾸지 않고 **본문 깊이만** 좁힌다.
 * 확보한 게 없으면 빈 문자열 → 프롬프트가 이전과 동일하다.
 */
export function buildNarrowFocusBlock(result: NarrowingResult): string {
  if (!result?.best) return '';
  const top = result.measured.slice(0, 2);
  return `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 **[초점 좁히기 — 넓게 훑지 말고 이 부분을 깊게]**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"${result.keyword}"를 검색하는 사람들이 **실제로 함께 찾는** 것이 측정됐습니다:
${top.map((c, i) => `   ${i + 1}. ${c.suffix} (검색 수요 확인)`).join('\n')}

**"${top[0]!.suffix}"** 를 이 글의 중심에 두세요.

- 전체를 얕게 훑는 글은 이미 넘칩니다. 좁은 지점을 깊게 파야 상위에 올라갑니다.
- "${top[0]!.suffix}" 에 관련된 조건·예외·순서·주의점을 구체적으로 다루세요.
  이 부분에 소제목을 2개 이상 배정해도 좋습니다.
- 나머지 내용은 짧게 언급하고 넘어가세요.
- 제목과 키워드는 그대로 유지하세요. **초점만 좁히는 것입니다.**
`;
}
