import axios from 'axios';

export interface ShortentsItem {
  keyword: string;
  url: string;
}

export interface ShortentsSnapshot {
  items: ShortentsItem[];
  fetchedAt: string;
  sourceUrl: string;
  scope: string;
}

export const SHORTENTS_SOURCE_URL = 'https://m.naver.com/';
const ENDPOINT = 'https://s.search.naver.com/n/rkeyword/search.naver';
const MAX_PAGES = 5;
const MAX_ITEMS = 20;
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Observed in the public mobile search box on 2026-09-17 (no login/cookies):
 * page 1 returns four contents, refresh advances through page 5, page 6 repeats.
 * shortents_list contains the PREVIOUS page's gdids, not every gdid seen so far.
 * This is a website endpoint, not a supported developer API. Reject changed/blocked
 * responses explicitly; never substitute trending queries or generated keywords.
 * Help: https://help.naver.com/service/5627/contents/9145
 */
export function buildShortentsPageUrl(page: number, previousIds: string[]): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set('ssc', 'm.recentkeyword.main');
  url.searchParams.set('shortents_page', String(page));
  url.searchParams.set('shortents_list', previousIds.join(','));
  url.searchParams.set('display_keyword', '0');
  return url.toString();
}

export function parseShortentsPage(data: unknown): { items: ShortentsItem[]; ids: string[] } {
  if (!data || typeof data !== 'object' || !Array.isArray((data as any).contents)) {
    throw new Error('숏텐츠 응답 형식이 변경되었거나 접근이 제한되었습니다.');
  }
  const rows = (data as any).contents as any[];
  if (rows.length > MAX_ITEMS) throw new Error('숏텐츠 응답의 항목 수가 예상 범위를 벗어났습니다.');
  const items: ShortentsItem[] = [];
  const ids: string[] = [];
  for (const row of rows) {
    const keyword = typeof row?.title === 'string' ? row.title.replace(/\s+/g, ' ').trim() : '';
    const id = typeof row?.gdid === 'string' ? row.gdid : '';
    if (!keyword || keyword.length > 200 || /[<>\u0000-\u0008]/.test(keyword) || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
      throw new Error('숏텐츠 항목의 제목 또는 식별자를 확인하지 못했습니다.');
    }
    let url: URL;
    try { url = new URL(row.linkUrl); } catch { throw new Error('숏텐츠 항목의 검색 링크를 확인하지 못했습니다.'); }
    if (url.protocol !== 'https:' || !['m.search.naver.com', 'search.naver.com'].includes(url.hostname) ||
        url.pathname !== '/search.naver' || !url.searchParams.get('query') || url.username || url.password || url.port) {
      throw new Error('숏텐츠 항목에 네이버 검색 이외의 링크가 포함되었습니다.');
    }
    items.push({ keyword, url: url.toString() });
    ids.push(id);
  }
  return { items, ids };
}

export interface ShortentsSourceDependencies {
  /** Injectable transport for offline regression tests. Production uses bounded public HTTP GETs. */
  getJson?: (url: string) => Promise<unknown>;
  now?: () => Date;
}

export async function listShortents(deps: ShortentsSourceDependencies = {}): Promise<ShortentsSnapshot> {
  const getJson = deps.getJson || (async (url: string) => {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      maxContentLength: 512 * 1024,
      headers: { Accept: 'application/json', Referer: SHORTENTS_SOURCE_URL },
    });
    return response.data;
  });
  const items: ShortentsItem[] = [];
  const seen = new Set<string>();
  let previousIds: string[] = [];
  let pages = 0;
  try {
    for (let page = 1; page <= MAX_PAGES && items.length < MAX_ITEMS; page += 1) {
      const result = parseShortentsPage(await getJson(buildShortentsPageUrl(page, previousIds)));
      pages += 1;
      previousIds = result.ids;
      let added = 0;
      for (const item of result.items) {
        const key = item.keyword.normalize('NFKC').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        added += 1;
        if (items.length === MAX_ITEMS) break;
      }
      if (added === 0) break;
    }
  } catch (error: any) {
    // Do not silently present a partly collected set as a successful full snapshot.
    const reason = error?.isAxiosError ? '네이버 응답 지연 또는 연결/접근 오류' : String(error?.message || '응답 확인 실패');
    throw new Error(`숏텐츠 자동 수집 실패: ${reason}. 잠시 후 다시 시도하거나 모바일 숏텐츠 키워드를 직접 입력해 주세요.`);
  }
  if (!items.length) {
    throw new Error('공개 모바일 검색창에서 숏텐츠 키워드를 찾지 못했습니다. 잠시 후 다시 시도하거나 키워드를 직접 입력해 주세요.');
  }
  return {
    items,
    fetchedAt: (deps.now || (() => new Date()))().toISOString(),
    sourceUrl: SHORTENTS_SOURCE_URL,
    scope: `수집 시점 네이버 모바일 검색창 숏텐츠 ${items.length}개 (${pages}페이지, 최대 20개). 시간·노출 조건에 따라 달라지는 공개 목록이며 네이버 전체 숏텐츠를 뜻하지 않습니다.`,
  };
}
