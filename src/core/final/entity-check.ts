/**
 * entity-check — 키워드 속 **고유명사의 정체를 먼저 확인한다**. (v3.8.587)
 *
 * ## 왜 만들었나 — 발행글 5429 실측
 * 제목이 `2026년 청년일자리도약장려금 비즈스캔 사업소득 있으면 가능한지` 였는데,
 * 글이 **"비즈스캔"을 "흩어진 정보를 한 번에 점검하려는 검색 흐름"이라고 재정의**하고
 * 그 위에 글 전체를 세웠다. 본문에 30번 나온다.
 *
 * 실제로 검색해 보면 비즈스캔은 **실재하는 민간 서비스**다:
 *   "비즈스캔 | 1분 정책자금·정부지원사업 무료 진단" (웹문서 283,553건)
 * 즉 없는 것을 있다고 한 게 아니라, **있는 것을 모르는 채로 뜻을 만들어 냈다.**
 * 이건 날조보다 알아채기 어렵다 — 문장은 그럴듯하고 수치도 안 틀렸기 때문이다.
 *
 * ## 어떻게 구분하나 (실측으로 정한 신호)
 * 웹문서 검색 결과의 **제목에 그 말이 그대로 있는 건수**가 갈랐다:
 *   고용24        총 24,558,287건 · 제목 8/10   ← 실재
 *   청년일자리도약장려금 총 2,451,893건 · 제목 9/10   ← 실재
 *   비즈스캔       총   283,553건 · 제목 3/10   ← 실재 (민간 서비스)
 *   퀀텀스캔봇      총         0건 · 제목 0/0    ← 없는 말
 *
 * 총 건수만 보면 안 된다 — 검색엔진은 부분 일치로도 수십만 건을 준다.
 * **제목에 그대로 들어간 결과가 하나라도 있는가**가 실체의 신호다.
 *
 * ## 무엇을 하나
 *   · 실재하면 → **그 정체를 프롬프트에 넣어 준다.** 모델이 지어낼 이유를 없앤다.
 *   · 없으면   → 알린다. 지어내지 말고 그 말을 빼라고 지시한다.
 *
 * ## 막지 않는다
 * 검색이 실패하면 조용히 빈 값을 돌려준다. 발행이 검수 때문에 멈추는 일은 만들지 않는다.
 */

/** naverSearch 를 주입받는다 — 테스트가 네트워크를 타지 않게 */
export type EntitySearchFn = (
  type: 'webkr',
  params: Record<string, any>,
) => Promise<{ ok: boolean; items: any[]; total?: number }>;

const stripTags = (s: string): string => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&[a-z#0-9]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * 확인할 필요가 없는 말 — 흔한 명사·조사·어미가 붙은 것.
 * 이걸 안 거르면 "있으면"·"가능한지" 까지 검색해 호출만 늘어난다.
 */
const SKIP_TOKENS = new Set([
  '사업소득', '근로소득', '지원금', '보조금', '장려금', '수수료', '위약금',
  '신청방법', '신청기간', '지급일', '조건', '기준', '대상', '서류', '방법',
  '가능', '여부', '경우', '이상', '이하', '올해', '작년', '내년',
]);

/** 어미·조사로 끝나면 고유명사가 아니다 */
const GRAMMAR_TAIL = /(으면|이면|한지|는지|까지|부터|에서|으로|하는|되는|받는|보다|처럼|만큼|이나|라도)$/;

/** 몇 개까지 확인할지 — 호출을 묶는 예산 */
const MAX_TOKENS = 3;

export interface EntityFinding {
  token: string;
  /** 실재하는 이름인가 */
  found: boolean;
  /** 검색 총 건수 (참고용 — 판단은 제목 일치로 한다) */
  total: number;
  /** 제목에 그 말이 그대로 들어간 결과들 — 정체를 알려 주는 근거 */
  titles: string[];
}

/**
 * 키워드에서 **확인할 만한 고유명사 후보**를 뽑는다.
 *
 * 연도(2026년)·숫자·한 글자·어미가 붙은 말은 뺀다.
 * 남은 것 중 흔한 명사도 뺀다 — 검색해 봐야 아는 게 없다.
 */
export function properNounCandidates(keyword: string): string[] {
  return String(keyword || '')
    .split(/\s+/)
    .map((t) => t.trim())
    /**
     * 네 글자부터 본다. (v3.8.587)
     *
     * 세 글자까지 열었더니 "항공권" 같은 **보통명사**가 걸려, 모델에게
     * "항공권이란 무엇인가"를 497자로 알려 주는 우스운 블록이 만들어졌다.
     * 우리가 막으려는 건 낯선 이름을 모델이 임의로 해석하는 것이고,
     * 그런 이름(비즈스캔 4 · 퀀텀스캔봇 5 · 청년일자리도약장려금 11)은 대개 길다.
     * 세 글자 고유명사(워크넷·복지로)는 널리 알려져 있어 모델이 잘못 정의할 일이 적다.
     */
    .filter((t) => t.length >= 4)
    .filter((t) => !/^\d/.test(t))            // 2026년
    .filter((t) => !/^\d+[가-힣]{0,2}$/.test(t))
    .filter((t) => !SKIP_TOKENS.has(t))
    .filter((t) => !GRAMMAR_TAIL.test(t))
    .slice(0, MAX_TOKENS);
}

/**
 * 후보들이 실재하는 이름인지 확인한다.
 *
 * 판단은 **제목 일치**로 한다(위 머리말 참고). 총 건수는 참고로만 담는다.
 */
export async function checkEntities(
  keyword: string,
  search: EntitySearchFn,
): Promise<EntityFinding[]> {
  const tokens = properNounCandidates(keyword);
  if (tokens.length === 0) return [];

  const rounds = await Promise.all(tokens.map(async (token) => {
    try {
      const res = await search('webkr', { query: token, display: 10 });
      const items = res?.ok && Array.isArray(res.items) ? res.items : [];
      const titles = items
        .map((it) => stripTags(it?.title))
        .filter((t) => t.includes(token));
      return { token, found: titles.length > 0, total: Number(res?.total || 0), titles: titles.slice(0, 3) };
    } catch {
      // 못 물어봤으면 "없다"고 단정하지 않는다 — 있는 것으로 두고 넘어간다
      return { token, found: true, total: 0, titles: [] as string[] };
    }
  }));

  return rounds;
}

/** 로그 한 줄 */
export function describeEntities(findings: EntityFinding[]): string {
  if (!findings.length) return '고유명사 확인 대상 없음';
  return findings
    .map((f) => `${f.token}=${f.found ? `실재(제목 ${f.titles.length}건)` : '미확인'}`)
    .join(' · ');
}

/**
 * 프롬프트에 넣을 블록.
 *
 * 실재하는 이름은 **정체를 알려 주고**, 없는 이름은 **지어내지 말라**고 한다.
 * 둘 다 해당 없으면 빈 문자열 — 프롬프트를 괜히 늘리지 않는다.
 */
export function buildEntityBlock(findings: EntityFinding[]): string {
  const known = findings.filter((f) => f.found && f.titles.length > 0);
  const unknown = findings.filter((f) => !f.found);
  if (known.length === 0 && unknown.length === 0) return '';

  const lines: string[] = [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '🔍 **[고유명사 — 뜻을 지어내지 마세요]**',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  if (known.length > 0) {
    lines.push('아래는 검색으로 확인한 **실재하는 이름**입니다. 이 정체를 그대로 쓰세요.');
    lines.push('');
    for (const f of known) {
      lines.push(`· **${f.token}**`);
      for (const t of f.titles) lines.push(`    ${t}`);
    }
    lines.push('');
    lines.push('⚠️ 위 검색 결과와 **다른 뜻으로 재정의하지 마세요.**');
    lines.push('   실제 사고: "비즈스캔"을 "흩어진 정보를 한 번에 점검하려는 검색 흐름"이라고');
    lines.push('   지어내고 그 위에 글 전체를 세운 적이 있습니다(본문에 30번 등장).');
    lines.push('   비즈스캔은 실제로는 정책자금·정부지원사업을 진단해 주는 민간 서비스입니다.');
    lines.push('   문장은 그럴듯하고 수치도 안 틀려서, 이런 오류는 **읽어도 안 보입니다.**');
    lines.push('');
  }

  if (unknown.length > 0) {
    lines.push(`⛔ 아래 이름은 검색으로 **실체가 확인되지 않았습니다**: ${unknown.map((f) => f.token).join(', ')}`);
    lines.push('   뜻을 추측해서 쓰지 마세요. 글의 뼈대로 삼지도 마세요.');
    lines.push('   그 말 없이도 성립하도록 쓰고, 제목에도 넣지 마세요.');
    lines.push('');
  }

  return lines.join('\n');
}
