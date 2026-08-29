/**
 * reform-check — 제도가 **올해 바뀌었는지** 먼저 물어본다. (v3.8.588)
 *
 * ## 왜 만들었나 — 발행글 5429 실측
 * 2026년 글인데 내용이 **2025년 체계**였다.
 *   글: 기업 720만원 + 청년 480만원 (2025년 유형Ⅰ·Ⅱ 체계)
 *   실제 2026: 수도권형 / 비수도권형으로 개편. 신청은 고용24.
 * 글 어디에도 수도권형·비수도권형이 없다(실측 0회). 2026년 독자에게는
 * "우리 회사가 어느 쪽인가"가 첫 질문인데 그 축이 통째로 빠졌다.
 *
 * 게다가 글은 옛 수치에 **"2026년 안내에 적혀 있다"** 는 귀속을 붙였다.
 * 숫자를 지어낸 게 아니라 **작년 숫자에 올해 라벨을 단 것**이라, 팩트 검사도
 * 통과한다(그 숫자는 자료에 실제로 있다). 가장 잡기 어려운 종류의 오류다.
 *
 * ## 왜 기존 검사로는 안 걸렸나
 * `checkFreshness` 는 **글을 다 쓴 뒤** "검색이 되풀이하는데 본문에 없는 개념"을 찾는다.
 * 경고는 뜨지만 글은 이미 쓰인 뒤다. 그리고 근거 수집은 **키워드 전체**로 검색하는데,
 * 실측에서 그 키워드가 `2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지`
 * 처럼 길어 개편 정보가 상위에 오지 않았다.
 *
 * 반면 제도명만 떼어 `{제도명} {올해} 개편` 으로 물으면 1차 소스가 바로 나온다(실측):
 *   "2026년 청년일자리도약장려금 사업운영 지침('26.1월) | 고용노동부"
 *   "'26년 청년일자리도약장려금 지방 기업·청년의 성장을 지원합니다 | 고용노동부"
 *
 * 그래서 이 모듈은 **쓰기 전에** 묻고, 결과를 프롬프트에 넣는다.
 *
 * ## 막지 않는다
 * 실패하면 조용히 빈 값이다. 발행이 검수 때문에 멈추는 일은 만들지 않는다.
 */

export type ReformSearchFn = (
  type: 'webkr' | 'news',
  params: Record<string, any>,
) => Promise<{ ok: boolean; items: any[] }>;

const stripTags = (s: string): string => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * 제도처럼 보이는 이름인가.
 *
 * 아무 고유명사나 "개편됐나" 물으면 호출만 는다. 제도·지원금·사업 이름의
 * 꼬리를 가진 것만 본다 — 개편이라는 개념이 성립하는 대상이다.
 */
const INSTITUTION_TAIL = /(장려금|지원금|보조금|수당|급여|연금|바우처|제도|사업|정책|공제|세액공제|지원사업|보험)$/;

export function looksLikeInstitution(token: string): boolean {
  return INSTITUTION_TAIL.test(String(token || '').trim());
}

/** 올해 뭐가 바뀌었는지 묻는 말 — 실측에서 1차 소스를 끌어온 조합 */
const REFORM_QUERIES = ['개편', '달라진'];

/** 개편의 흔적을 나타내는 말 */
const REFORM_SIGNALS = /(개편|전면\s*개편|신설|폐지|통합|분리|변경|개정|시행|바뀌|달라)/;

export interface ReformFinding {
  /** 물어본 제도 이름 */
  institution: string;
  /** 개편 신호가 담긴 조각들 */
  snippets: string[];
  /** 올해 자료에서 되풀이되는데 이름에는 없는 개념 (수도권형·비수도권형 같은 것) */
  newTerms: string[];
}

const STOP = new Set([
  '지원', '사업', '신청', '기업', '청년', '대상', '기준', '내용', '경우', '가능',
  '위해', '따라', '통해', '관련', '확인', '안내', '정보', '방법', '이상', '이하',
  '올해', '작년', '내년', '정부', '고용', '노동부', '한눈에', '알아보기',
  // 검색 결과의 **매체·섹션 이름**. 개편 개념이 아니라 그 글이 실린 자리다.
  '정책뉴스', '뉴스', '멀티미디어', '카드', '한컷', '전체', '보도자료', '공지사항',
  '트렌드', '블로그', '완전', '정리', '총정리', '요약', '핵심',
]);

/**
 * 조사·어미가 붙은 토막은 개념이 아니다.
 * 실측에서 `청년을`·`만원으로`·`신청절차까지`·`달라진` 이 "새 개념"으로 뽑혔다.
 * 그대로 두면 모델에게 "정책뉴스를 본문에 넣어라"고 시키는 꼴이 된다.
 */
const TERM_TAIL = /(을|를|이|가|은|는|의|에|로|으로|까지|부터|에서|와|과|도|만|보다|처럼|이나|라도|한|된|될|하는|되는|진|짐)$/;

/** 조각들에서 되풀이되는 낱말을 뽑는다 — 두 문서 이상에 나온 것만 */
function repeatedTerms(snippets: string[], exclude: string): string[] {
  const counts = new Map<string, number>();
  for (const s of snippets) {
    const seen = new Set<string>();
    for (const m of s.matchAll(/[가-힣]{2,10}/g)) {
      const w = m[0];
      if (w.length < 3 || STOP.has(w) || exclude.includes(w)) continue;
      if (TERM_TAIL.test(w)) continue;
      if (seen.has(w)) continue;
      seen.add(w);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

/**
 * 제도가 올해 바뀌었는지 묻는다.
 *
 * 제도처럼 보이는 이름이 없으면 아무것도 하지 않는다(호출 0회).
 */
export async function checkReform(
  institutions: string[],
  year: number,
  search: ReformSearchFn,
): Promise<ReformFinding | null> {
  const target = (institutions || []).map((t) => String(t || '').trim()).find(looksLikeInstitution);
  if (!target) return null;

  try {
    const rounds = await Promise.all(REFORM_QUERIES.map((hint) =>
      search('webkr', { query: `${target} ${year} ${hint}`, display: 10 })
        .catch(() => ({ ok: false, items: [] as any[] }))));

    const seen = new Set<string>();
    const snippets: string[] = [];
    for (const r of rounds) {
      if (!r?.ok || !Array.isArray(r.items)) continue;
      for (const it of r.items) {
        const line = `${stripTags(it?.title)} ${stripTags(it?.description)}`.trim();
        if (line.length < 20 || seen.has(line)) continue;
        seen.add(line);
        // 올해 이야기이면서 바뀜의 신호가 있는 것만
        if (!line.includes(String(year)) && !line.includes(`'${String(year).slice(2)}`)) continue;
        if (!REFORM_SIGNALS.test(line)) continue;
        snippets.push(line);
      }
    }

    if (snippets.length === 0) return null;
    return {
      institution: target,
      snippets: snippets.slice(0, 8),
      newTerms: repeatedTerms(snippets, target),
    };
  } catch {
    return null;
  }
}

/** 로그 한 줄 */
export function describeReform(finding: ReformFinding | null): string {
  if (!finding) return '올해 개편 흔적 없음';
  const terms = finding.newTerms.length ? ` · 새 개념: ${finding.newTerms.slice(0, 5).join(', ')}` : '';
  return `${finding.institution} 올해 개편 자료 ${finding.snippets.length}건${terms}`;
}

/**
 * 프롬프트 블록.
 *
 * 핵심은 **"작년 숫자에 올해 라벨을 붙이지 마라"** 한 줄이다.
 * 실측 사고가 정확히 그것이었고, 그건 팩트 검사로는 안 잡힌다 —
 * 그 숫자는 자료에 실제로 있기 때문이다.
 */
export function buildReformBlock(finding: ReformFinding | null, year: number): string {
  if (!finding) return '';

  const lines: string[] = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `🔄 **[${year}년 개편 — 작년 체계로 쓰면 틀린 글이 됩니다]**`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `**${finding.institution}** 은(는) ${year}년에 바뀐 정황이 있습니다. 아래는 검색으로 확인한 자료입니다.`,
    '',
    ...finding.snippets.map((s) => `· ${s}`),
    '',
  ];

  /**
   * v3.8.588 — 뽑아낸 "새 개념" 목록은 **프롬프트에 넣지 않는다.**
   *
   * 실측에서 나온 것들이 `정책뉴스`·`달라진`·`청년을`·`채용하면`·`모두에게` 였다.
   * 조사·매체 이름을 걸러 내도 이 정도라, 이걸 "본문에 넣으라"고 시키면
   * **엉뚱한 낱말을 본문에 심게 된다.** 못 미더운 지시는 넣지 않는 편이 낫다.
   *
   * 위 조각(snippets)은 원문 그대로라 정확하고, 개편의 실제 내용
   * (지방/수도권 구분 같은 것)이 그 안에 이미 들어 있다. 모델은 그걸 읽으면 된다.
   * newTerms 는 로그에만 남겨 진단에 쓴다.
   */
  lines.push('**지켜야 할 것**');
  lines.push(`1. 작년 체계의 금액·유형 구분을 **${year}년 것처럼 쓰지 마세요.**`);
  lines.push('   실제 사고: 2025년 유형Ⅰ·Ⅱ 체계의 금액(기업 720만원·청년 480만원)을 그대로 쓰면서');
  lines.push('   "2026년 안내에 적혀 있다"고 귀속했습니다. 숫자는 자료에 있으니 팩트 검사도 통과합니다.');
  lines.push('   **작년 숫자에 올해 라벨을 다는 것**이 가장 잡기 어려운 오류입니다.');
  lines.push(`2. 올해 기준을 확인 못 한 금액은 "${year - 1}년 기준으로는 …였습니다"처럼 **연도를 밝혀** 쓰세요.`);
  lines.push('3. 개편으로 새로 생긴 구분이 있으면 **그 구분을 글의 앞쪽에** 두세요.');
  lines.push('   독자의 첫 질문은 "나는 어느 쪽인가"입니다.');
  lines.push('');

  return lines.join('\n');
}
