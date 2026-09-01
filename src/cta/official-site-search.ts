/**
 * official-site-search — 사전에 없는 기관도 **검색으로 공식 주소를 찾는다.** (v3.8.619)
 *
 * ## 사장님 요구
 * "어떤 주제로 글을 쓰든지 자동으로 완벽하게 버튼이 생기고 링크가 걸려야 돼요"
 *
 * 이름 사전(name-to-url)은 230곳이다. 넓지만 한국의 기관은 그보다 훨씬 많고,
 * 사전에 없으면 여전히 버튼이 0개가 된다. 그 마지막 구멍을 검색으로 메운다.
 *
 * ## 무엇을 하지 않는가
 * **검색 결과 페이지를 버튼에 걸지 않는다.** 그건 독자를 검색창으로 떠넘기는 것이고,
 * 코드에도 "구글 검색 URL X (자기 트래픽 보호)"라는 결정이 이미 있다.
 * 여기서 검색은 **주소를 알아내는 수단**이지 목적지가 아니다.
 *
 * ## 어떻게 고르는가
 * 검색은 아무거나 물어 온다 — 블로그 글, 뉴스, 광고 랜딩, 남의 정리글이 섞인다.
 * 그래서 후보를 좁히는 기준을 **이미 검증된 판정기로** 세운다:
 *   · `isOfficialDestination` — 공공기관 도메인만. 상업 사이트·광고 랜딩은 탈락
 *   · `isUserGeneratedUrl`    — 블로그·카페·커뮤니티 탈락
 *   · `isDocumentUrl`         — PDF·내려받기 주소 탈락 ("바로가기"인데 파일이 떨어지면 안 된다)
 *   · 홈에 가까운 주소 우선   — 깊은 페이지는 개편되면 죽는다
 *
 * 판정은 전부 순수 함수라 네트워크 없이 시험할 수 있다. 검색 호출은 밖에서 주입한다.
 */

import { isOfficialDestination, isUserGeneratedUrl } from './host-trust';
import { isDocumentUrl } from './destination-gate';

/** 검색 한 건 — 네이버 검색 API 응답에서 필요한 것만 */
export interface SiteSearchHit {
  title: string;
  link: string;
  description?: string;
}

/** 검색을 실제로 수행하는 함수 — 테스트에서는 가짜를 넣는다 */
export type SiteSearchFn = (query: string) => Promise<SiteSearchHit[]>;

export interface OfficialSiteCandidate {
  name: string;
  url: string;
  /** 왜 이걸 골랐는지 — 로그로 남긴다 */
  reason: string;
}

const stripTags = (value: string): string => String(value || '').replace(/<[^>]+>/g, '').trim();

function hostOf(url: string): string {
  try { return new URL(String(url || '').trim()).hostname.toLowerCase().replace(/^www\./, ''); }
  catch { return ''; }
}

/** 주소의 경로 깊이 — 홈이 0 */
function pathDepth(url: string): number {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    return path && path !== '/' ? path.split('/').filter(Boolean).length : 0;
  } catch { return 99; }
}

/**
 * CTA 목적지로 쓸 수 있는 검색 결과인가.
 *
 * 하나라도 걸리면 버린다 — 애매한 것을 통과시키느니 버튼을 안 만드는 편이 낫다.
 */
export function isUsableOfficialResult(url: string): boolean {
  if (!/^https:\/\//i.test(String(url || ''))) return false;
  if (!hostOf(url)) return false;
  if (isUserGeneratedUrl(url)) return false;
  if (isDocumentUrl(url)) return false;
  return isOfficialDestination(url);
}

/**
 * 기관 이름이 이 결과와 맞는가.
 *
 * 검색은 "인사혁신처"를 물었는데 엉뚱한 기관의 보도자료가 1위로 오는 일이 흔하다.
 * 제목이나 설명에 그 이름이 들어 있어야 그 기관의 자리로 본다.
 */
function mentionsName(hit: SiteSearchHit, name: string): boolean {
  const needle = String(name || '').replace(/\s/g, '');
  if (needle.length < 2) return false;
  const haystack = `${stripTags(hit.title)} ${stripTags(hit.description || '')}`.replace(/\s/g, '');
  return haystack.includes(needle);
}

/**
 * 검색 결과에서 공식 사이트 하나를 고른다. **순수 함수 — 네트워크를 타지 않는다.**
 *
 * 고르는 순서:
 *   ① 쓸 수 있는 주소만 남긴다 (공공기관·광고 아님·문서 아님)
 *   ② 이름이 언급된 결과를 앞세운다
 *   ③ 그중 홈에 가까운 주소를 고른다 — 깊은 페이지는 개편되면 죽는다
 */
export function pickOfficialSite(name: string, hits: SiteSearchHit[]): OfficialSiteCandidate | null {
  const usable = (hits || []).filter((hit) => hit && isUsableOfficialResult(hit.link));
  if (usable.length === 0) return null;

  const named = usable.filter((hit) => mentionsName(hit, name));
  const pool = named.length > 0 ? named : usable;

  const best = [...pool].sort((a, b) => pathDepth(a.link) - pathDepth(b.link))[0]!;
  return {
    name,
    url: best.link,
    reason: named.length > 0
      ? `검색 결과 중 이름이 일치하는 공공기관 도메인 (깊이 ${pathDepth(best.link)})`
      : `검색 결과 중 공공기관 도메인 (이름 일치 없음, 깊이 ${pathDepth(best.link)})`,
  };
}

/** 같은 이름을 여러 글에서 다시 묻지 않게 한다 */
const CACHE = new Map<string, { value: OfficialSiteCandidate | null; expireAt: number }>();
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * 기관 이름으로 공식 사이트를 찾는다.
 *
 * 어떤 실패에도 예외를 던지지 않는다 — CTA 하나 때문에 발행이 멈추면 안 된다.
 * 못 찾으면 null 이고, 호출자는 버튼을 만들지 않는다.
 */
export async function findOfficialUrlBySearch(
  name: string,
  search: SiteSearchFn,
): Promise<OfficialSiteCandidate | null> {
  const query = String(name || '').trim();
  if (!query || typeof search !== 'function') return null;

  const cached = CACHE.get(query);
  if (cached && cached.expireAt > Date.now()) return cached.value;

  let value: OfficialSiteCandidate | null = null;
  try {
    const hits = await search(`${query} 공식 홈페이지`);
    value = pickOfficialSite(query, hits || []);
  } catch {
    value = null;
  }

  CACHE.set(query, { value, expireAt: Date.now() + TTL_MS });
  return value;
}

/** 테스트에서 캐시를 비운다 */
export function resetOfficialSiteSearchCache(): void {
  CACHE.clear();
}
