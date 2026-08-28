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
 * ⚠️ **출처를 가린다.** 뉴스를 먼저 쓰고, 블로그·카페·커뮤니티는 근거로 쓰지 않는다.
 *    사장님: "블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까."
 *    틀린 블로그가 장부에 들어가면 틀린 수치를 **보증해 주는** 꼴이라 없느니만 못하다.
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

import { isUserGeneratedUrl } from '../../cta/host-trust';

/** naverSearch 를 주입받는다 — 테스트에서 네트워크를 타지 않기 위해서다 */
export type NaverSearchFn = (
  type: 'webkr' | 'news',
  params: Record<string, any>,
) => Promise<{ ok: boolean; items: any[]; error?: string }>;

const stripTags = (s: string): string => String(s || '')
  .replace(/<[^>]+>/g, '')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();

const MAX_SNIPPET_CHARS = 4000;

/**
 * ① 검색 결과에서 근거가 될 만한 글자를 모은다.
 *
 * ## 출처 우선순위 — 이게 핵심이다 (v3.8.576)
 * 사장님: **"블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까."**
 *
 * 정확히 그렇다. 근거 장부는 fact-guard 가 "이 수치는 자료에 있다"고 판단하는 근거다.
 * 틀린 블로그가 장부에 들어가면 **틀린 수치를 보증해 주는 꼴**이 된다.
 * 없느니만 못하다 — 검수를 통과시켜 버리기 때문이다.
 *
 * 그래서 순서를 둔다:
 *   1. **뉴스(최신순)** — 언론사는 최소한 데스크를 거친다. 제도 변경도 여기 먼저 뜬다.
 *   2. **웹문서 중 기관·기업 페이지** — 블로그·카페·지식iN·SNS 는 뺀다.
 * 블로그 검색('blog')은 아예 쓰지 않는다.
 *
 * 제목 + 요약만 쓴다. 본문까지 받으면 느려지는데, 요약에도
 * "월 최대 20만원", "3월 31일까지" 같은 수치는 대개 들어 있다.
 */
export interface GroundingResult {
  /** 근거 장부에 보탤 글자 */
  text: string;
  /** 뉴스에서 온 조각 수 */
  newsCount: number;
  /** 기관·기업 웹문서에서 온 조각 수 */
  webCount: number;
  /** 블로그·카페라서 뺀 개수 — 왜 근거가 얇은지 설명할 수 있어야 한다 */
  skippedBlogs: number;
}

export async function fetchGrounding(
  keyword: string,
  naverSearch: NaverSearchFn,
  options: { display?: number } = {},
): Promise<GroundingResult> {
  const empty: GroundingResult = { text: '', newsCount: 0, webCount: 0, skippedBlogs: 0 };
  const query = String(keyword || '').trim();
  if (!query) return empty;
  const display = options.display ?? 10;

  const take = (items: any[], tag: string, filter?: (it: any) => boolean) =>
    (Array.isArray(items) ? items : [])
      .filter((it) => (filter ? filter(it) : true))
      .map((it) => `[${tag}] ${stripTags(it?.title)} ${stripTags(it?.description)}`.trim())
      .filter((t) => t.length > 14);

  try {
    const [news, web] = await Promise.all([
      naverSearch('news', { query, display, sort: 'date' }).catch(() => ({ ok: false, items: [] })),
      naverSearch('webkr', { query, display }).catch(() => ({ ok: false, items: [] })),
    ]);

    const webItems: any[] = web?.ok && Array.isArray(web.items) ? web.items : [];
    const blogItems = webItems.filter((it) => isUserGeneratedUrl(String(it?.link || '')));

    const newsParts = take(news?.ok ? news.items : [], '뉴스');
    // 블로그·카페·커뮤니티는 근거로 쓰지 않는다 — 틀린 글이 사실을 보증해 버린다
    const webParts = take(webItems, '웹', (it) => !isUserGeneratedUrl(String(it?.link || '')));

    return {
      text: [...newsParts, ...webParts].join('\n').slice(0, MAX_SNIPPET_CHARS),
      newsCount: newsParts.length,
      webCount: webParts.length,
      skippedBlogs: blogItems.length,
    };
  } catch {
    return empty;
  }
}

/** 예전 호출부·테스트를 위해 글자만 돌려주는 얇은 껍데기 */
export async function fetchGroundingSnippets(
  keyword: string,
  naverSearch: NaverSearchFn,
  options: { display?: number } = {},
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
  const parts = [`뉴스 ${g.newsCount}건 · 기관·기업 문서 ${g.webCount}건`];
  if (g.skippedBlogs) parts.push(`블로그·카페 ${g.skippedBlogs}건 제외`);
  const head = `근거 ${g.newsCount + g.webCount}건 (${parts.join(' · ')})`;

  if (g.newsCount + g.webCount === 0) {
    return `${head}\n  ⚠️ 믿을 만한 근거를 못 찾았습니다 — 본문의 금액·기한·비율은 사람이 확인해 주세요.`
      + (g.skippedBlogs ? '\n     (블로그만 검색됐습니다. 틀린 블로그는 틀린 수치를 보증하므로 근거로 쓰지 않습니다.)' : '');
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
