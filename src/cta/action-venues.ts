/**
 * action-venues — 같은 행동을 할 수 있는 곳이 여러 곳이면, 버튼도 여러 개여야 한다.
 *
 * ## 왜 만드는가 (v3.8.558)
 * 사장님: "근로장려금 신청이라면 은행마다 신청이 가능하잖아. 그럼 가능한 은행을
 *   버튼으로 전부 박스로 감싸서 깔끔하게 연동되어야 되겠지? 그리고 버튼을 누르면
 *   농협이라면 농협 홈으로 가면 안 되고 근로장려금 신청할 수 있는 페이지로 가야 돼."
 *
 * 지금 글 하나에 버튼이 사실상 1개인 이유는 중복 방지가 과했기 때문이 아니다.
 * 후보 배열에 애초에 한 개만 담긴다 — 중복 방지(renderedCtaUrls)는 제대로 돌고 있었고,
 * 채울 후보가 없어서 하단 CTA 자리가 스스로 생략됐던 것이다. 이 모듈이 그 후보를 만든다.
 *
 * ## 규칙 세 가지
 * ① 창구는 **본문에서 읽는다.** 글이 이미 "농협·국민·기업은행에서 신청" 이라고 적고 있다.
 *    코드에 은행 목록을 박아 두면 글과 어긋나고, 제도가 바뀌면 조용히 틀린다.
 * ② 창구마다 **그 행동을 하는 화면**을 따로 찾는다. 농협 홈은 버튼이 될 수 없다 —
 *    v3.8.557 목적지 게이트를 창구 버튼에도 똑같이 건다.
 * ③ **못 찾은 창구는 버튼을 안 만든다.** 홈으로 보내느니 그 은행을 빼는 게 낫다.
 *
 * ## AI 를 부르지 않는다
 * 검색(네이버 API HUB, 무료)과 페이지 채점(코드)만 쓴다. 추가 비용 0원이고,
 * 같은 입력에 같은 결과가 나와 테스트가 된다.
 */
import type { ActionIntent } from './action-intent';
import { keywordTokens } from './action-link-harness';
import type { PageFetcher } from './action-link-harness';
import { gateCtaDestination, isDocumentUrl } from './destination-gate';
import { judgeCtaHost } from './host-trust';

export interface ActionVenue {
  /** 창구 이름 — 버튼에 그대로 쓴다 (농협은행) */
  name: string;
  /** 그 창구에서 이 행동을 하는 화면 */
  url: string;
  score: number;
  reasons: string[];
}

/** 검색 한 번 — 밖에서 넣는다(테스트에서 갈아끼우고, 네이버 클라이언트를 여기로 끌고 오지 않기 위해) */
export type VenueSearcher = (query: string) => Promise<Array<{ url: string; title: string }>>;

/**
 * 창구로 보이는 이름 — 접미어로 잡는다.
 * `저축은행` 을 `은행` 보다 앞에 둬야 "OK저축은행" 이 "OK저축"+"은행" 으로 쪼개지지 않는다.
 */
const VENUE_SUFFIX = /[가-힣A-Za-z0-9]{1,10}(?:저축은행|은행|증권|카드사|캐피탈|생명|화재)/g;

/** 접미어가 없어서 규칙으로는 못 잡는 창구들 */
const VENUE_FIXED = [
  '농협', '수협', '신협', '새마을금고', '우체국', '산림조합',
  '카카오뱅크', '토스뱅크', '케이뱅크', '홈택스', '손택스', '정부24',
];

/**
 * 창구가 아닌 것들 — "시중은행에서 신청하세요" 의 '시중은행' 은 갈 곳이 아니다.
 * 이걸 안 거르면 존재하지 않는 창구를 검색하다 시간만 버린다.
 */
const NOT_A_VENUE =
  /^(시중|인터넷|지방|국책|일반|해당|각|여러|모든|주거래|거래|가까운|근처|타|우리나라|제1금융|제2금융|1금융|2금융)/;

/** 이름이 너무 짧거나 흔한 말이면 창구로 보지 않는다 */
const MIN_VENUE_LENGTH = 2;

/**
 * ① 본문에서 창구 이름을 뽑는다. 많이 나온 순 — 글이 여러 번 부른 이름이 진짜 창구다.
 *
 * @param exclude 이미 대표 CTA 가 가리키는 곳 등, 다시 뽑을 필요 없는 이름
 */
export function collectActionVenues(articleText: string, exclude: string[] = []): string[] {
  const text = String(articleText || '').replace(/<[^>]+>/g, ' ');
  const excluded = new Set(exclude.map((e) => String(e || '').trim()).filter(Boolean));

  const counts = new Map<string, number>();
  const bump = (raw: string) => {
    const name = raw.trim();
    if (name.length < MIN_VENUE_LENGTH) return;
    if (NOT_A_VENUE.test(name)) return;
    if (excluded.has(name)) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  };

  for (const m of text.matchAll(VENUE_SUFFIX)) bump(m[0] || '');
  for (const fixed of VENUE_FIXED) {
    const hits = text.split(fixed).length - 1;
    if (hits > 0 && !excluded.has(fixed)) {
      counts.set(fixed, (counts.get(fixed) || 0) + hits);
    }
  }

  /**
   * "농협" 과 "농협은행" 이 함께 잡히면 긴 쪽만 남긴다 — 같은 창구에 버튼 두 개는
   * 사장님이 금지한 중복이다. 짧은 쪽의 횟수는 긴 쪽에 얹는다.
   */
  const names = [...counts.keys()];
  for (const short of names) {
    const longer = names.find((n) => n !== short && n.includes(short));
    if (longer) {
      counts.set(longer, (counts.get(longer) || 0) + (counts.get(short) || 0));
      counts.delete(short);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/**
 * 중복 판정용 주소 키. `?utm=` 만 다른 같은 페이지를 두 번 넣지 않기 위해서다.
 * (orchestration 에도 같은 성격의 함수가 있지만 그쪽은 렌더 단계 전용이라 여기서 따로 둔다 —
 *  이 모듈은 렌더를 모르는 채로 테스트돼야 한다.)
 */
export function venueUrlKey(url: string): string {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const u = new URL(value);
    u.hash = '';
    u.search = '';
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString().toLowerCase();
  } catch {
    return value.replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

/** 창구 이름의 한글을 뺀 영문·숫자 토막 — kbstar 처럼 도메인에 드러난 브랜드를 맞춰 본다 */
function latinTokens(name: string): string[] {
  return (String(name || '').toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || []);
}

/**
 * 이 주소를 이 창구의 것으로 믿어도 되는가.
 *
 * `judgeCtaHost` 가 1차다(등록된 공식 사이트·공공 도메인). 그것만으로는 부족한 이유는
 * 창구가 은행이라 `.go.kr` 이 아니고, 카탈로그에 없는 은행도 있기 때문이다.
 * 그래서 **페이지가 스스로 그 창구임을 말하는지**(제목에 이름이 있는지)를 함께 본다.
 */
export function judgeVenueHost(url: string, venue: string, title: string, keyword: string): boolean {
  if (judgeCtaHost(url, `${keyword} ${venue}`).ok) return true;

  const host = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
  })();
  if (!host) return false;

  // 창구 이름이 영문으로 드러난 경우 (KB국민은행 → kbstar 는 못 잡지만 K뱅크 → kbank 는 잡는다)
  if (latinTokens(venue).some((t) => host.includes(t))) return true;

  // 검색 결과 제목이 그 창구를 말하고 있고, 블로그·카페가 아닌 곳이면 받는다
  return String(title || '').includes(venue);
}

/** 창구 후보에서 애초에 빼는 곳 — 블로그·카페·백과는 행동 화면이 아니다 */
const VENUE_EXCLUDE_HOSTS = [
  'blog.naver.com', 'cafe.naver.com', 'kin.naver.com', 'tistory.com', 'velog.io',
  'brunch.co.kr', 'namu.wiki', 'wikipedia.org', 'youtube.com', 'facebook.com',
  'instagram.com', 'twitter.com', 'x.com',
];

/** 게이트가 "읽지 못한 페이지"를 통과시키는 경로가 있다 — 창구 버튼은 그걸 받지 않는다 */
const MIN_VENUE_SCORE = 1;

export interface ResolveVenuesInput {
  keyword: string;
  intent: ActionIntent;
  /** 본문에서 뽑은 창구 이름들 (많이 나온 순) */
  venues: string[];
  /** 글이 지목한 기관 — 게이트의 오배송 판정 기준 */
  agencies?: string[];
  search: VenueSearcher;
  fetchPage: PageFetcher;
  /** 버튼 상한 */
  limit?: number;
  /** 창구 하나당 열어 볼 페이지 수 */
  probePerVenue?: number;
  /** 이미 다른 자리에 쓰인 주소 — 같은 링크를 두 번 넣지 않는다 */
  skipUrls?: string[];
  /** 전체 시간 상한(ms). 넘으면 거기까지 찾은 것만 쓴다 — 발행을 붙잡아 두지 않는다 */
  budgetMs?: number;
  onLog?: (message: string) => void;
}

/**
 * ② 창구마다 그 행동을 하는 화면을 찾는다.
 *
 * 창구를 차례로 도는 이유는 시간 상한을 지키기 위해서다. 병렬로 열면 빠르지만
 * 기관 서버에 동시에 달려드는 모양이 되고, 남은 예산을 중간에 끊기도 어렵다.
 */
export async function resolveActionVenues(input: ResolveVenuesInput): Promise<ActionVenue[]> {
  const limit = input.limit ?? 6;
  const probe = input.probePerVenue ?? 3;
  /**
   * 45초. 상한을 창구 단위로만 확인하므로 실제로는 마지막 창구가 끝나는 만큼 더 걸린다
   * (한 창구 최악 = 검색 1초 + 페이지 3개 × 4초 = 13초). 그래서 최악이 약 58초다.
   * 창구가 2곳 이상인 글에서만 도는 비용이고, 행동을 못 읽은 글에는 0초다.
   */
  const budgetMs = input.budgetMs ?? 45_000;
  const startedAt = Date.now();
  const log = input.onLog || (() => {});

  const seen = new Set<string>((input.skipUrls || []).map(venueUrlKey).filter(Boolean));
  const subject = keywordTokens(input.keyword).join(' ') || String(input.keyword || '').trim();
  const found: ActionVenue[] = [];

  for (const venue of input.venues) {
    if (found.length >= limit) break;
    if (Date.now() - startedAt > budgetMs) {
      log(`[CTA] ⏱️ 창구 탐색 시간 상한 도달 — ${found.length}개까지만 사용`);
      break;
    }

    const query = `${venue} ${subject} ${input.intent}`.replace(/\s+/g, ' ').trim();
    let results: Array<{ url: string; title: string }> = [];
    try {
      results = await input.search(query);
    } catch {
      results = [];
    }
    if (!results.length) {
      log(`[CTA] 🔍 ${venue}: 검색 결과 없음`);
      continue;
    }

    const picked = await pickVenuePage({
      venue,
      results,
      probe,
      seen,
      keyword: input.keyword,
      intent: input.intent,
      agencies: input.agencies || [],
      fetchPage: input.fetchPage,
    });

    if (picked) {
      seen.add(venueUrlKey(picked.url));
      found.push(picked);
      log(`[CTA] ✅ ${venue} ${input.intent} 화면(${picked.score}점): ${picked.url}`);
    } else {
      // 사장님 지시: 홈으로 보내느니 그 창구는 버튼을 안 만든다
      log(`[CTA] ⛔ ${venue}: ${input.intent} 화면을 못 찾아 버튼 제외`);
    }
  }

  return found;
}

/** 한 창구의 검색 결과에서 쓸 만한 화면 하나를 고른다 */
async function pickVenuePage(input: {
  venue: string;
  results: Array<{ url: string; title: string }>;
  probe: number;
  seen: Set<string>;
  keyword: string;
  intent: ActionIntent;
  agencies: string[];
  fetchPage: PageFetcher;
}): Promise<ActionVenue | null> {
  let opened = 0;

  for (const result of input.results) {
    if (opened >= input.probe) break;

    const url = String(result?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (VENUE_EXCLUDE_HOSTS.some((h) => url.includes(h))) continue;
    if (isDocumentUrl(url)) continue;

    const key = venueUrlKey(url);
    if (!key || input.seen.has(key)) continue;
    if (!judgeVenueHost(url, input.venue, String(result?.title || ''), input.keyword)) continue;

    opened++;
    const gate = await gateCtaDestination({
      url,
      keyword: input.keyword,
      intent: input.intent,
      // 창구 이름을 기준에 넣는다 — 국민은행을 찾다 엉뚱한 기관에 닿으면 오배송이다
      agencies: [input.venue, ...input.agencies],
      fetchPage: input.fetchPage,
    });

    if (gate.ok && gate.score >= MIN_VENUE_SCORE) {
      return { name: input.venue, url, score: gate.score, reasons: gate.reasons };
    }
  }

  return null;
}

/** 버튼에 쓸 문구 — "농협은행 신청하기" */
export function venueButtonText(venue: string, intent: ActionIntent): string {
  return `${venue} ${intent}하기`;
}
