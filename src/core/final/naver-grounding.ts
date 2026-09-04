/**
 * naver-grounding — 이미 쓰는 네이버 검색 키로 **근거를 넓히고 최신성을 본다**. (v3.8.575)
 *
 * ## 왜 네이버인가
 * 제미나이 그라운딩·퍼플렉시티는 비싸서 못 쓴다. 사장님 말대로
 * **"최대한 무료에 가깝게 쓰게 하는 것"** 이 이 앱의 차별점이다.
 * 네이버 검색 키는 CTA 목적지를 찾을 때 이미 쓰고 있다 — 추가 비용이 사실상 없다.
 *
 * ## 두 가지를 한다
 *
 * ### ① 근거 장부를 넓힌다 (거짓 삭제를 줄인다)
 * fact-guard 는 "자료에 없는 수치"를 찾아 문단을 고친다. 그런데 자료가 생성 시점에
 * 크롤한 것뿐이라 **얇으면 맞는 문장까지 지워졌다**(실제로 62자 문단이 24자가 된 적 있다).
 * 검색 결과의 제목·요약에는 금액·기한·비율이 그대로 들어 있다. 그걸 장부에 보태면
 * **진짜 지어낸 수치만 남는다.**
 *
 * ⚠️ **출처에 순서를 둔다.** 뉴스·기관 원문이 먼저고, 블로그는 뒤다.
 *    사장님: "블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까."
 *
 *    ⚠️ v3.8.581 정정 — **배제하라는 뜻이 아니었다.** 사장님이 바로잡아 줬다:
 *    "나보다 먼저 글을 올려서 상위노출이 되어 있는 글이 있어.
 *     그 글들은 정보가 정확하고 신뢰되니 상위노출된 게 아니니"
 *
 *    맞는 말이다. 네이버 상위노출은 체류시간·재방문·신고 같은 신호가 누적된 결과라
 *    **순위 자체가 검증의 대용물**이다. 아무 블로그나 넣지 말라는 뜻이었지
 *    상위 글까지 버리라는 뜻이 아니었다. 그래서 지금은
 *    **정확도순 상위 몇 건만** 받고, 뉴스·기관 뒤에 놓는다.
 *
 * ### ② 낡았는지 본다
 * "2026년" 을 제목에 박았는데 2026년에 뭐가 바뀌었는지 확인한 흔적이 없던 글이 있었다.
 * 제도가 바뀌었으면 그 글은 **정확하게 낡은 글**이 된다.
 * 검색이 되풀이해 말하는데 본문엔 한 번도 없는 개념을 찾아 알린다.
 *
 * ## 막지 않는다
 * fact-guard·structure-guard 와 같은 원칙이다. 검색이 실패하면 조용히 빈 값을 돌려주고,
 * 어떤 경우에도 예외를 던지지 않는다. 발행이 검수 때문에 멈추는 일은 만들지 않는다.
 */

import { isOfficialDestination, isUserGeneratedUrl } from '../../cta/host-trust';

/** naverSearch 를 주입받는다 — 테스트에서 네트워크를 타지 않기 위해서다 */
export type NaverSearchFn = (
  type: 'webkr' | 'news' | 'blog',
  params: Record<string, any>,
) => Promise<{ ok: boolean; items: any[]; error?: string }>;

/**
 * 본문 수집기도 주입받는다 — 검색기와 같은 이유다(테스트가 네트워크를 타면 안 된다).
 * 비워 두면 실제 수집기(`crawlers/official-page-body`)를 쓴다.
 */
export type FetchBodyFn = (url: string) => Promise<string | null>;

const stripTags = (s: string): string => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

/**
 * 근거 장부 전체 상한. (v3.8.580 에 4,000 → 9,000)
 *
 * 스니펫만 쓰던 때는 20건 × 150자라 4,000자면 넉넉했다. 이제 앞쪽 몇 건은 본문이
 * 들어오므로 같은 상한이면 **본문이 뒤 자료를 통째로 밀어낸다.**
 *
 * 무한정 늘리지는 않는다 — 이 장부는 그대로 프롬프트에 실려 토큰 값이 된다.
 * 본문 6건(5,400자) + 나머지 스니펫이 들어갈 만큼만 잡는다.
 */
const MAX_SNIPPET_CHARS = 9000;

/** 본문을 긁을 최대 건수 — 지연과 토큰을 같이 묶는 예산이다 */
const BODY_FETCH_MAX = 6;

/** 한 건에서 가져올 본문 글자수 */
const BODY_CHARS = 900;

/**
 * ① 검색 결과에서 근거가 될 만한 글자를 모은다.
 *
 * ## 출처 우선순위 — 이게 핵심이다 (v3.8.576, v3.8.581 정정)
 * 근거 장부는 fact-guard 가 "이 수치는 자료에 있다"고 판단하는 근거다.
 * 그래서 **아무 글이나 넣으면 틀린 수치를 보증해 주는 꼴**이 된다.
 *
 * 처음엔 이걸 "블로그를 빼자"로 옮겼는데, 그건 과했다. 사장님 정정:
 *   "나보다 먼저 글을 올려서 상위노출이 되어 있는 글이 있어.
 *    그 글들은 정보가 정확하고 신뢰되니 상위노출된 게 아니니"
 * 상위노출은 신호가 누적된 결과라 **순위가 곧 검증의 대용물**이다.
 * 문제는 출처의 종류가 아니라 **검증되지 않은 출처**였다.
 *
 * 그래서 배제가 아니라 순서를 둔다:
 *   1. **뉴스(최신순)** — 언론사는 최소한 데스크를 거친다. 제도 변경도 여기 먼저 뜬다.
 *   2. **기관·기업 웹문서**
 *   3. **블로그 정확도순 상위 몇 건** (v3.8.581) — 상위노출은 그 자체로 검증의 대용물이다.
 *      순위가 낮은 글은 안 받는다. 걸러야 할 건 "블로그"가 아니라 "아무 블로그"였다.
 *
 * ## 앞쪽 몇 건은 본문까지 긁는다 (v3.8.580)
 * 사장님: "결과를 스니펫 말고 본문을 긁게 해야 하는 거 아니니?" — 맞다.
 * 요약 120자에도 "월 최대 20만원" 같은 수치는 들어 있지만, **표·조건 목록은 통째로 빠진다.**
 * 실측: 서울시 보육포털 스니펫 122자 → 본문 2,017자.
 *
 * 전부 긁지는 않는다. 장부는 그대로 프롬프트에 실려 토큰 값이 되고, 기관 검색 결과의
 * 대부분은 애초에 첨부파일이라 못 긁는다(실측 18건 중 15건). 앞쪽 몇 건만 채우고
 * 실패하면 스니펫을 남긴다 — **어느 쪽이든 예전보다 나빠지지 않는다.**
 */
export interface GroundingResult {
  /** 근거 장부에 보탤 글자 */
  text: string;
  /** 뉴스에서 온 조각 수 */
  newsCount: number;
  /** 기관·기업 웹문서에서 온 조각 수 */
  webCount: number;
  /** 공공기관 페이지에서 온 조각 수 (뉴스가 없을 때 따로 찾아온 것) */
  officialCount: number;
  /** 정확도순 상위 블로그에서 온 조각 수 (v3.8.581) */
  blogCount: number;
  /** 순위가 낮아 안 받은 블로그 수 — 왜 근거가 이만큼인지 설명할 수 있어야 한다 */
  skippedBlogs: number;
  /**
   * 속보 판정 (v3.8.633). 없으면 속보가 아니거나 판정을 못 한 것이다.
   *
   * **반환값으로 넘긴다.** 전역(globalThis)에만 두면 이 함수가 orchestration
   * 밖에서 불릴 때 지난 판정이 그대로 쓰인다 — 조용히 틀리는 종류다.
   */
  breakingEvent?: any;
}

/**
 * 블로그는 **정확도순 상위 몇 건까지**. (v3.8.581)
 *
 * 사장님: "나보다 먼저 글을 올려서 상위노출이 되어 있는 글이 있어.
 *          그 글들은 정보가 정확하고 신뢰되니 상위노출된 게 아니니"
 *
 * 상위노출은 체류시간·재방문 같은 신호가 누적된 결과라 **순위가 곧 검증의 대용물**이다.
 * 그래서 순위를 믿되, 믿는 만큼만 받는다 — 3건을 넘어가면 그 신호가 옅어진다.
 * 자리도 맨 뒤다. 수치가 엇갈리면 뉴스·기관 원문이 이겨야 한다.
 */
const BLOG_MAX = 3;

/**
 * 블로그가 **정말 이 주제 글인지** 본다. (v3.8.581)
 *
 * ## 왜 순위만 믿으면 안 되나 — 실측
 * "상위노출 글은 신뢰할 만하다"는 맞는 말인데, 네이버 정확도순은 검색어가 길면
 * 느슨해진다. `해외 항공권 취소 수수료 면제` 로 받은 상위 3건이 이랬다:
 *   · 2018년 7월10일자 조간신문 머릿기사 종합
 *   · KB국민 WE:SH Travel 카드 혜택 정리
 *   · KB국민 탄탄대로 온리유 티타늄카드 혜택 정리
 * 항공권 취소 수수료와 아무 상관이 없다. 이런 게 장부에 들어가면 사장님이 처음
 * 걱정한 바로 그 일이 벌어진다 — **엉뚱한 글이 수치를 보증한다.**
 *
 * 그래서 순위(신뢰) 위에 주제 일치(관련)를 한 겹 더 얹는다.
 * 검색어의 낱말이 제목·요약에 실제로 몇 개나 있는지 세고, 절반 넘게 겹칠 때만 받는다.
 * 같은 실측에서 헬스장 PT 환불 글들은 이 문턱을 그대로 넘었다.
 */
const TOPIC_MATCH_RATIO = 0.6;

/**
 * 어느 주제에나 나오는 낱말 — **이것만 겹치는 건 주제가 겹친 게 아니다.**
 *
 * 처음엔 낱말 개수만 셌는데 실측에서 그대로 뚫렸다:
 *   · `해외 항공권 취소 수수료 면제` → KB국민카드 혜택 글이 통과
 *     (해외 ✓ · 수수료 ✓ · "매출**취소**금액" ✓ = 3/5)
 *   · `실손보험 도수치료 보장` → 백내장 수술 글이 통과
 *     ("**도수**가 조정된 인공수정체" — 도수치료와 아무 상관 없다)
 * 정작 없어서는 안 될 낱말(**항공권**, **도수치료**)이 빠져 있었다.
 *
 * v3.8.573 의 CTA 범용 태그 오배송과 **같은 병**이다. 넓은 말에 무게를 실으면
 * 엉뚱한 것이 뽑힌다. 그래서 넓은 말은 세지 않고, 주제를 가리키는 말만 센다.
 */
const GENERIC_TERMS = new Set([
  '해외', '국내', '취소', '수수료', '면제', '환불', '신청', '접수', '조회', '발급',
  '납부', '가입', '등록', '문의', '상담', '안내', '정보', '혜택', '지원', '할인',
  '기준', '대상', '서류', '방법', '비용', '가격', '기간', '절차', '조건', '한도',
  '보장', '변경', '해지', '예약', '예매', '후기', '정리', '총정리', '비교', '추천',
  '금액', '요건', '가능', '필요', '관련', '경우', '이상', '이하',
]);

/**
 * 검색어의 **주제어**가 실제로 들어 있는 글인가.
 *
 * 넓은 말을 빼고 남은 낱말(주제어)만 센다. 주제어가 하나도 안 남는 검색어
 * (예: "환불 신청 방법")는 그때만 원래대로 전체 낱말로 센다 — 셀 것이 없으면
 * 아무것도 못 받게 되기 때문이다.
 */
function matchesTopic(text: string, keyword: string): boolean {
  const terms = String(keyword || '')
    .split(/\s+/).map((t) => t.trim()).filter((t) => t.length >= 2);
  if (terms.length === 0) return true;

  const haystack = String(text || '');
  const covered = (list: string[]) => list.filter((t) => haystack.includes(t)).length;

  const distinctive = terms.filter((t) => !GENERIC_TERMS.has(t));
  const scored = distinctive.length > 0 ? distinctive : terms;

  // ① 주제어가 있어야 한다 — 이게 없으면 다른 글이다
  const needTopic = Math.max(1, Math.ceil(scored.length * TOPIC_MATCH_RATIO));
  if (covered(scored) < needTopic) return false;

  /**
   * ② 검색어 전체와도 어느 정도 겹쳐야 한다.
   *
   * 주제어가 하나뿐인 검색어(`해외 **항공권** 취소 수수료 면제`)에서는 ① 만으로
   * 부족하다. 그 낱말이 스쳐 지나가기만 해도 통과하기 때문이다 — 실측에서
   * 카드 혜택 글이 "여행, 항공권," 한 줄로 뚫었다.
   * 전체 낱말 중 절반 넘게 겹치면 그 글은 정말 그 얘기를 하고 있는 것이다.
   */
  return covered(terms) >= Math.ceil(terms.length * TOPIC_MATCH_RATIO);
}

/**
 * 뉴스가 없을 때 기관 페이지를 찾으려고 덧붙이는 말. (v3.8.579)
 *
 * 사장님: **"뉴스가 없다면 공식사이트의 공식정보를 참고하면 되잖아. 퍼플렉은 비용이 드니까."**
 *
 * 맞다. 그리고 제도·지원금·수수료 같은 주제에서는 기관 페이지가 뉴스보다 **정확하다** —
 * 기사는 요약하다 틀리지만 고시·안내문은 원문이다.
 *
 * 네이버 검색에는 `site:` 같은 도메인 한정이 없다. 그래서 기관 페이지가 실제로 제목에
 * 쓰는 말을 붙여 검색 결과를 그쪽으로 끌고 온 뒤, **도메인으로 다시 거른다**
 * (`isOfficialDestination` — .go.kr/.or.kr 등만 통과). 검색어로 유도하고 도메인으로
 * 확정하는 2단이라, 말만 그럴듯한 민간 페이지는 통과하지 못한다.
 */
const OFFICIAL_QUERY_HINTS = ['공식 안내', '제도 기준'];

/**
 * 기관 원문은 몇 건까지 담을지. (v3.8.579)
 *
 * 근거 장부 전체가 4,000자로 잘리므로, 기관 문서가 다 차지하면 뒤의 웹문서가 통째로
 * 밀려난다. 원문이 좋다고 장부를 독점하게 두지는 않는다.
 */
const OFFICIAL_MAX = 10;

/**
 * 문서에 적힌 가장 최근 연도. 없으면 0.
 *
 * ## 왜 필요한가 — 낡은 고시도 틀린 블로그와 같은 병이다
 * 실측(어린이집 보육교직원 겸직): 기관 원문 13건 안에 **2012·2016·2017년 안내문**이
 * 섞여 들어왔다. 그대로 장부에 넣으면 fact-guard 가 낡은 금액·기준을
 * "자료에 있다"며 **보증해 준다.** 블로그를 배제한 이유와 똑같다.
 *
 * 그렇다고 오래된 문서를 버리지는 않는다 — 제도 원문은 몇 년이 지나도 유효한 경우가
 * 많고, 버리면 틈새 주제에서 근거가 다시 0이 된다. **최신 것부터 담고 오래된 건 뒤로**
 * 미뤄, 4,000자 상한에서 자연스럽게 잘려 나가게 한다.
 */
function latestYearIn(text: string): number {
  const years = [...String(text).matchAll(/(20\d{2})/g)].map((m) => Number(m[1]));
  return years.length ? Math.max(...years) : 0;
}

export async function fetchGrounding(
  keyword: string,
  naverSearch: NaverSearchFn,
  options: { display?: number; fetchBody?: FetchBodyFn } = {},
): Promise<GroundingResult> {
  const empty: GroundingResult = {
    text: '', newsCount: 0, webCount: 0, officialCount: 0, blogCount: 0, skippedBlogs: 0,
  };
  let breakingEvent: any = null;
  const query = String(keyword || '').trim();
  if (!query) return empty;
  const display = options.display ?? 10;

  const snippet = (it: any, tag: string) =>
    `[${tag}] ${stripTags(it?.title)} ${stripTags(it?.description)}`.trim();

  /**
   * 본문을 긁어 스니펫을 대체한다. (v3.8.580)
   *
   * 사장님: **"결과를 스니펫 말고 본문을 긁게 해야 하는 거 아니니?"**
   * 스니펫은 120자쯤이라 표·금액표·조건 목록이 통째로 빠진다.
   * 실측: 서울시 보육포털 스니펫 122자 → 본문 2,017자.
   *
   * 다만 **전부 긁지는 않는다.** 근거 장부는 그대로 프롬프트에 실려 토큰 값이 되고,
   * 기관 검색 결과의 대부분은 첨부파일이라 애초에 못 긁는다(실측 18건 중 15건).
   * 그래서 앞쪽 몇 건만 채우고, 실패하면 조용히 스니펫을 남긴다 — 절대 나빠지지 않는다.
   */
  const fetchBody: FetchBodyFn = options.fetchBody
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    || ((url) => require('../crawlers/official-page-body').fetchPageBody(url, BODY_CHARS));

  // 뉴스는 originallink 가 실제 언론사 주소다 — 네이버 중계 주소보다 본문이 잘 나온다
  const bodyUrlOf = (it: any) => String(it?.originallink || it?.link || '');

  /**
   * 남은 예산. 뉴스 → 기관 원문 → 웹문서 순으로 **한 통에서 꺼내 쓴다.** (v3.8.580)
   *
   * 갈래마다 따로 주면 안 된다. 실측에서 그렇게 하다 놓쳤다 — 뉴스가 0건인 주제에서
   * 본문 2,017자짜리 서울시 보육포털 페이지가 **일반 웹문서 갈래로 들어왔는데**
   * 그 갈래엔 예산이 없어 120자 스니펫으로 남았다. 한 통이면 그런 구멍이 없다.
   */
  let budgetLeft = BODY_FETCH_MAX;

  const enrich = async (items: any[], tag: string, budget: number): Promise<string[]> => {
    if (budget <= 0) return items.map((it) => snippet(it, tag));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { looksLikeFileUrl } = require('../crawlers/official-page-body');

    /**
     * 예산은 **긁을 수 있는 것에만** 쓴다. (v3.8.580)
     *
     * 실측에서 이걸 놓쳐 기관 원문 본문이 한 건도 안 들어왔다. 최신순 상위 10건이
     * 전부 첨부파일(.hwp·fileDown)이라 예산 6건이 그대로 소진됐고, 정작 본문이
     * 2,017자 나오는 서울시 보육포털 페이지는 스니펫으로 남았다.
     * "앞에서부터 N건"이 아니라 "받아올 수 있는 것 N건"이어야 한다.
     */
    const spend = new Set<number>();
    for (let i = 0; i < items.length && spend.size < budget; i += 1) {
      const url = bodyUrlOf(items[i]);
      if (url && !looksLikeFileUrl(url)) spend.add(i);
    }
    budgetLeft -= spend.size;

    const bodies = await Promise.all(
      items.map(async (it, i) => {
        if (!spend.has(i)) return null;
        try {
          return await fetchBody(bodyUrlOf(it));
        } catch {
          return null;   // 본문을 못 구해도 스니펫이 남는다 — 나빠지지 않는다
        }
      }),
    );

    return items.map((it, i) => {
      const body = bodies[i];
      if (!body) return snippet(it, tag);
      return `[${tag}] ${stripTags(it?.title)} ${body}`.trim();
    });
  };

  const usable = (items: any[], filter?: (it: any) => boolean) =>
    (Array.isArray(items) ? items : [])
      .filter((it) => (filter ? filter(it) : true))
      .filter((it) => snippet(it, '.').length > 15);

  try {
    const [news, web, blog] = await Promise.all([
      naverSearch('news', { query, display, sort: 'date' }).catch(() => ({ ok: false, items: [] })),
      naverSearch('webkr', { query, display }).catch(() => ({ ok: false, items: [] })),
      /**
       * 정확도순(sort 를 주지 않으면 'sim')이 곧 상위노출 순이다. (v3.8.581)
       * 최신순으로 받으면 안 된다 — 어제 올라온 아무 글이 1등이 되어 버린다.
       * 우리가 믿는 건 "새 글"이 아니라 "위에 있는 글"이다.
       */
      naverSearch('blog', { query, display }).catch(() => ({ ok: false, items: [] })),
    ]);

    const webItems: any[] = web?.ok && Array.isArray(web.items) ? web.items : [];

    let newsItems = usable(news?.ok ? news.items : []);

    /**
     * ⏱️ v3.8.633 — 지금 터진 일이면 **같은 이름의 옛 사건 자료를 걷어낸다.**
     *
     * 사장님 실제 사고(2026-09-04): 「티빙 개인정보 유출」이 터진 지 10분 만에
     * 글을 돌렸더니 작년 티빙 유출 사건 내용이 나왔다. 옛 글은 색인이 쌓여
     * 검색에서 더 위에 잡히고, 터진 직후엔 새 글이 거의 없기 때문이다.
     *
     * 속보가 아니면 아무것도 하지 않는다 — 평범한 주제에서 옛 자료를 걷어내면
     * 근거가 텅 비어 오히려 글이 얕아진다.
     */
    let breakingNote = '';
    try {
      const guard = require('./breaking-news-guard');
      const event = guard.detectBreakingEvent(newsItems);
      if (event.isBreaking && event.olderCount > 0) {
        const cut = guard.dropPreEventSources(newsItems, event);
        newsItems = cut.kept;
        breakingNote = cut.skippedReason ? (event.note + ' — ' + cut.skippedReason) : event.note;
        breakingEvent = event;
        (globalThis as any).__lastBreakingEvent = event;
      } else if (event.isBreaking) {
        breakingEvent = event;
        (globalThis as any).__lastBreakingEvent = event;
      }
    } catch { /* 판정 실패는 근거 수집을 막지 않는다 */ }
    if (breakingNote) console.log('[BREAKING] ' + breakingNote);
    /**
     * 웹문서 갈래에서는 블로그를 뺀다 — 여기 섞이면 순위를 알 수 없어서다.
     * 블로그는 아래에서 **정확도순 상위 몇 건만** 따로 받는다(v3.8.581).
     */
    const webUsable = usable(webItems, (it) => !isUserGeneratedUrl(String(it?.link || '')));

    /** 이미 담은 주소 — 블로그 갈래에서 같은 글을 두 번 넣지 않으려고 모아 둔다 */
    const seenLinks = new Set<string>(
      webItems.map((it) => String(it?.link || '')).filter(Boolean),
    );

    // 뉴스 본문을 먼저 채운다 — 언론사 기사는 추출이 가장 잘 된다(실측 2,540~7,703자)
    const newsParts = await enrich(newsItems, '뉴스', budgetLeft);

    /**
     * 뉴스가 한 건도 없을 때만 기관 페이지를 따로 찾는다.
     *
     * 뉴스가 있으면 굳이 호출을 늘리지 않는다 — 일반 웹문서 검색에도 기관 페이지가
     * 이미 섞여 들어오기 때문이다. 여기서 찾는 건 그것마저 없을 때의 **마지막 원문**이다.
     */
    const officialParts: string[] = [];
    if (newsParts.length === 0) {
      const seen = seenLinks;
      const rounds = await Promise.all(
        OFFICIAL_QUERY_HINTS.map((hint) =>
          naverSearch('webkr', { query: `${query} ${hint}`, display })
            .catch(() => ({ ok: false, items: [] })),
        ),
      );
      const picked: any[] = [];
      for (const round of rounds) {
        if (!round?.ok || !Array.isArray(round.items)) continue;
        for (const it of round.items) {
          const link = String(it?.link || '');
          if (!link || seen.has(link)) continue;      // 같은 문서를 두 번 넣지 않는다
          if (!isOfficialDestination(link)) continue; // 도메인으로 확정한다
          seen.add(link);
          if (snippet(it, '공식').length > 14) picked.push(it);
        }
      }

      /**
       * 최신 문서부터 담는다. 연도가 안 적힌 문서는 중간에 둔다 —
       * 상시 안내 페이지가 대부분이라 낡았다고 볼 근거도, 최신이라고 볼 근거도 없다.
       *
       * **본문을 긁기 전에** 정렬한다. 긁는 예산이 몇 건뿐이므로, 낡은 문서를
       * 먼저 긁어 예산을 태우면 정작 최신 안내문은 스니펫으로 남는다.
       */
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { looksLikeFileUrl } = require('../crawlers/official-page-body');
      const neutral = new Date().getFullYear() - 1;
      const byYear = (a: any, b: any) => (b.year - a.year) || (a.order - b.order);
      const ranked = picked
        .map((it, order) => ({ it, order, year: latestYearIn(snippet(it, '공식')) || neutral }))
        .sort(byYear);

      /**
       * 읽을 수 있는 페이지에 자리를 먼저 준다. (v3.8.580)
       *
       * 최신순으로만 자르면 실측에서 **본문이 한 건도 안 들어왔다.** 기관 검색의 상위
       * 10건이 전부 첨부파일(.hwp·fileDown)이라, 본문 2,017자가 나오는 서울시 보육포털
       * 페이지가 잘려 나간 것이다. 첨부파일은 제목 120자밖에 못 쓰지만 웹페이지는
       * 900자를 준다 — 근거의 두께가 한 자리 수 다르다.
       *
       * 그렇다고 첨부파일을 버리지는 않는다. 앞자리만 웹페이지에 예약하고
       * 나머지는 원래대로 최신순으로 채운다. 두 그룹 모두 최신 것이 먼저다.
       */
      const readable = ranked.filter((e) => !looksLikeFileUrl(bodyUrlOf(e.it)));
      const reserved = readable.slice(0, BODY_FETCH_MAX);
      const reservedSet = new Set(reserved.map((e) => e.order));
      const ordered = [...reserved, ...ranked.filter((e) => !reservedSet.has(e.order))]
        .slice(0, OFFICIAL_MAX)
        .map((entry) => entry.it);

      // 뉴스가 0건이라 예산이 통째로 남아 있다 — 기관 원문에 쓴다
      officialParts.push(...await enrich(ordered, '공식', budgetLeft));
    }

    /**
     * 남은 예산을 웹문서에 쓴다.
     *
     * 여기가 실측에서 비어 있던 자리다 — 뉴스가 0건인 주제에서 본문 2,017자짜리
     * 서울시 보육포털 페이지가 **일반 웹문서로 들어와** 스니펫 122자로 남아 있었다.
     * (기관 갈래에서는 "이미 본 주소"라 중복 제외됐다.)
     */
    const webParts = await enrich(webUsable, '웹', budgetLeft);

    /**
     * 정확도순 상위 블로그를 **맨 뒤에** 담는다. (v3.8.581)
     *
     * 이미 웹문서로 들어온 주소는 중복으로 넣지 않는다.
     * 태그를 `[블로그]` 로 달아 두는 이유는, 수치가 엇갈릴 때 어느 쪽이 원문이고
     * 어느 쪽이 남의 정리인지 프롬프트에서 구분되게 하기 위해서다.
     */
    const blogSeen = usable(
      blog?.ok && Array.isArray(blog.items) ? blog.items : [],
      (it) => !seenLinks.has(String(it?.link || '')),
    );
    // 순위(신뢰) 위에 주제 일치(관련)를 한 겹 더 얹는다 — 위 matchesTopic 주석 참고
    let blogAll = blogSeen.filter((it) => matchesTopic(snippet(it, ''), query));

    /**
     * ⏱️ v3.8.633 — 속보면 블로그에서도 옛 사건 글을 걷어낸다.
     *
     * 「티빙」 사고에서 작년 사건이 잡힌 곳이 바로 여기다. 뉴스만 걸러서는
     * 소용이 없다 — 블로그가 근거의 대부분을 차지하고, 옛 글일수록 색인이
     * 쌓여 정확도순 상위에 있기 때문이다.
     * 네이버 블로그는 postdate(YYYYMMDD)를 주므로 날짜로 가를 수 있다.
     */
    try {
      const event = (globalThis as any).__lastBreakingEvent;
      if (event?.isBreaking) {
        const guard = require('./breaking-news-guard');
        const cut = guard.dropPreEventSources(blogAll, event);
        if (cut.dropped > 0) {
          console.log('[BREAKING] 블로그에서 옛 사건 글 ' + cut.dropped + '건을 걷어냈습니다');
          blogAll = cut.kept;
        } else if (cut.skippedReason) {
          // 걷어내면 근거가 비므로 그대로 두고 못박음만 싣는다
          console.log('[BREAKING] 블로그 ' + cut.skippedReason);
        }
      }
    } catch { /* 판정 실패는 근거 수집을 막지 않는다 */ }
    const blogTop = blogAll.slice(0, BLOG_MAX);
    const blogParts = await enrich(blogTop, '블로그', budgetLeft);

    return {
      text: [...newsParts, ...officialParts, ...webParts, ...blogParts]
        .join('\n').slice(0, MAX_SNIPPET_CHARS),
      newsCount: newsParts.length,
      webCount: webParts.length,
      officialCount: officialParts.length,
      blogCount: blogParts.length,
      skippedBlogs: Math.max(0, blogSeen.length - blogTop.length),
      breakingEvent,
    };
  } catch {
    return empty;
  }
}

/** 예전 호출부·테스트를 위해 글자만 돌려주는 얇은 껍데기 */
export async function fetchGroundingSnippets(
  keyword: string,
  naverSearch: NaverSearchFn,
  options: { display?: number; fetchBody?: FetchBodyFn } = {},
): Promise<string> {
  return (await fetchGrounding(keyword, naverSearch, options)).text;
}

/**
 * 근거가 얼마나 단단한지 한 줄로.
 *
 * ## "기사가 없으면?" — 이 질문에 대한 답이 여기 있다 (사장님 질문)
 * 지역 소식·틈새 주제·오래된 제도는 뉴스가 아예 없을 수 있다.
 * 그때 **조용히 넘어가면 안 된다.** 근거 장부가 얇으면 fact-guard 가
 * "이 수치는 자료에 없다"고 판단해 **맞는 문장까지 지운다**(실측: 62자 → 24자).
 *
 * 그렇다고 블로그를 대신 넣지도 않는다 — 틀린 블로그는 틀린 수치를 **보증해 준다.**
 * 없느니만 못하다.
 *
 * 그래서 **없으면 없다고 말한다.** 수치는 사람이 확인해야 한다고 알린다.
 */
export function describeGrounding(g: GroundingResult): string {
  const official = g.officialCount || 0;
  const blogs = g.blogCount || 0;
  const total = g.newsCount + official + g.webCount + blogs;

  const parts = [`뉴스 ${g.newsCount}건`];
  if (official) parts.push(`공공기관 원문 ${official}건`);
  parts.push(`기관·기업 문서 ${g.webCount}건`);
  // v3.8.581: 블로그는 "제외한 수"가 아니라 **쓴 수**를 말한다 — 상위노출 글은 근거다
  if (blogs) parts.push(`상위 블로그 ${blogs}건`);
  if (g.skippedBlogs) parts.push(`안 쓴 블로그 ${g.skippedBlogs}건`);
  const head = `근거 ${total}건 (${parts.join(' · ')})`;

  if (total === 0) {
    return `${head}\n  ⚠️ 믿을 만한 근거를 못 찾았습니다 — 본문의 금액·기한·비율은 사람이 확인해 주세요.`;
  }
  /**
   * 기관 원문을 찾았으면 "기사가 없다"는 경고를 그대로 두면 안 된다. (v3.8.579)
   * 제도·수수료 주제에서 고시·안내문은 기사보다 **오히려 정확한 원문**이다.
   * 경고를 남겨 두면 사람이 확인해야 할 진짜 경우와 구분이 안 된다.
   */
  if (g.newsCount === 0 && official > 0) {
    return `${head}\n  ℹ️ 최신 기사는 없지만 공공기관 원문 ${official}건을 근거로 씁니다.`;
  }
  if (g.newsCount === 0) {
    return `${head}\n  ⚠️ 최신 기사가 없습니다 — 제도가 최근 바뀌었다면 반영되지 않았을 수 있습니다.`;
  }
  return head;
}

export interface FreshnessWarning {
  /** 사람이 읽고 판단할 수 있게 쓴다 */
  detail: string;
  /** 근거가 된 기사 제목들 */
  headlines: string[];
}

/** 네이버 뉴스 날짜(pubDate)는 RFC822 — 못 읽으면 0 */
function pubTime(item: any): number {
  const t = Date.parse(String(item?.pubDate || ''));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 어디에나 붙는 말 — 이걸 "본문이 놓친 개념"이라고 하면 경고가 늑대 소년이 된다.
 */
const STOPWORDS = new Set([
  '있습니다', '있는', '없는', '하는', '위한', '통해', '대한', '따라', '경우', '때문',
  '가능', '방법', '안내', '정리', '총정리', '확인', '신청', '기준', '내용', '관련',
  '이번', '올해', '작년', '내년', '최근', '지난', '오늘', '기사', '뉴스', '보도',
  '무엇', '어떻게', '얼마', '이유', '문제', '상황', '결과', '전망', '분석',
]);

/**
 * 서술어 꼬리 — 개념이 아니라 문장을 잇는 말이다.
 *
 * 형태소 분석기 없이 어미로만 거른다. 테스트에서 "달라지는지", "살펴봅니다" 가
 * 개념어로 잡혀 경고가 헛돌았다 — 이 목록이 그때 생겼다.
 */
const PREDICATE_TAILS = /(습니다|입니다|합니다|됩니다|봅니다|니다|는지|지만|으로|에서|이며|하는|되는|하고|하며|한다|된다|있다|없다|이다|세요|어요|아요|네요|겠다|였다|졌다|는다)$/;

/**
 * 조사 — 붙은 채로 두면 같은 개념이 다른 낱말로 세어진다.
 *
 * 실측에서 "도수치료는"·"하반기부터"가 따로 잡혔다. 앞의 것은 본문에 "도수치료"로
 * 이미 있는데도 "본문에 없는 개념"으로 보고됐다 — 그대로 두면 헛경고가 된다.
 * 떼고 나서도 두 글자 이상 남을 때만 뗀다("보다"가 통째로 사라지지 않게).
 */
const PARTICLE_TAIL = /(에서|으로|에게|한테|부터|까지|보다|처럼|이나|라도|마다|조차|밖에|은|는|이|가|을|를|의|에|와|과|도|만|로)$/;

function stripParticle(word: string): string {
  const cut = word.replace(PARTICLE_TAIL, '');
  return cut.length >= 2 ? cut : word;
}

/**
 * 검색 결과에서 **개념어**를 뽑는다.
 * 3글자 이상 한글 덩어리, 그리고 "5세대"처럼 숫자+한글도 받는다.
 */
function conceptTerms(text: string): string[] {
  const words = String(text || '').match(/\d+[가-힣]{1,4}|[가-힣]{3,8}/g) || [];
  return words
    .filter((w) => !PREDICATE_TAILS.test(w))
    .map(stripParticle)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/**
 * ② 검색이 반복해서 말하는데 본문에는 없는 개념을 찾는다.
 *
 * ## 왜 "변경 낱말 목록"을 안 쓰나 (한 번 그렇게 짰다가 못 잡았다)
 * 처음엔 제목에 `개편|시행|폐지` 같은 말이 있는지 봤다. 그런데 실제 헤드라인은
 * **"22조원 비급여, 관리급여로 잡을 수 있나…국감서 실효성 점검"** 이었다.
 * 목록에 없는 표현이라 그냥 지나갔다. 낱말 목록으로는 현실을 못 따라간다.
 *
 * 그래서 **증거로 판단한다**: 여러 검색 결과가 되풀이해 말하는 개념인데
 * 본문에 한 번도 안 나오면, 글이 놓친 것이다.
 *
 * 실측(도수치료 실비보험 글): 본문에 비급여 5회, **관리급여 0회 · 5세대 0회 · 개편 0회**.
 * 검색 결과는 "7월 관리급여 전환", "5세대 실손" 을 되풀이하고 있었다.
 */
export async function checkFreshness(input: {
  keyword: string;
  articleText: string;
  naverSearch: NaverSearchFn;
  /** 며칠 안의 뉴스를 볼 것인가 (기본 90일) */
  withinDays?: number;
  /** 몇 개 결과에서 겹쳐야 "되풀이"로 볼 것인가 */
  minRepeat?: number;
}): Promise<FreshnessWarning | null> {
  const keyword = String(input?.keyword || '').trim();
  const body = stripTags(String(input?.articleText || ''));
  if (!keyword || body.length < 200) return null;

  const minRepeat = input.minRepeat ?? 3;
  try {
    const [news, web] = await Promise.all([
      input.naverSearch('news', { query: keyword, display: 10, sort: 'date' }),
      input.naverSearch('webkr', { query: keyword, display: 10 }),
    ]);

    const cutoff = Date.now() - (input.withinDays ?? 90) * 24 * 60 * 60 * 1000;
    /** 뉴스는 최근 것만, 웹문서는 날짜가 없으니 그대로 */
    const docs: string[] = [
      ...(Array.isArray(news?.items) ? news.items : [])
        .filter((it: any) => pubTime(it) >= cutoff)
        .map((it: any) => `${stripTags(it?.title)} ${stripTags(it?.description)}`),
      ...(Array.isArray(web?.items) ? web.items : [])
        .map((it: any) => `${stripTags(it?.title)} ${stripTags(it?.description)}`),
    ].filter((t) => t.trim().length > 10);
    if (docs.length < minRepeat) return null;

    /** 개념어가 몇 개의 **서로 다른** 문서에 나오는지 센다 */
    const docCount = new Map<string, number>();
    for (const doc of docs) {
      for (const term of new Set(conceptTerms(doc))) {
        docCount.set(term, (docCount.get(term) || 0) + 1);
      }
    }

    const missed = [...docCount.entries()]
      .filter(([term, n]) => n >= minRepeat            // 여러 문서가 되풀이하고
        && !keyword.includes(term)                     // 검색어 자신이 아니고
        && !body.includes(term))                       // 본문엔 한 번도 없다
      .sort((a, b) => b[1] - a[1])
      .map(([term, n]) => `${term} (검색 결과 ${n}건)`);

    if (!missed.length) return null;
    return {
      detail: `검색이 되풀이하는데 본문에 한 번도 없는 개념이 ${missed.length}개입니다 — 제도가 바뀌었다면 이 글은 낡은 글이 됩니다`,
      headlines: missed.slice(0, 5),
    };
  } catch {
    return null;
  }
}

/** 로그 한 줄 */
export function describeFreshness(w: FreshnessWarning | null): string {
  if (!w) return '최신성 확인 — 최근 제도 변경 신호 없음';
  return `최신성 주의: ${w.detail}\n` + w.headlines.map((h) => `  · ${h}`).join('\n');
}
