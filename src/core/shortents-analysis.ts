/** Measured writing opportunities, never a prediction of search position. No LLM calls. */
import { load } from 'cheerio';

export interface ShortentsItem { keyword: string; url: string }
export interface SearchSample { ok: boolean; total?: number; items: any[]; error?: string }
export type ShortentsSearch = (type: 'blog' | 'news', params: Record<string, any>) => Promise<SearchSample>;
export interface ShortentsOpportunity {
  keyword: string;
  url: string;
  score: number | null;
  verdict: string;
  reasons: string[];
  blogTotal: number | null;
  sampleSize: number;
  directTitles: number;
  recentNews: number;
  evidence: Array<{ title: string; url: string; publishedAt: string }>;
  error?: string;
}

const clean = (s: unknown): string => load(`<span>${String(s || '')}</span>`)('span').text().replace(/\s+/g, ' ').trim();
export function normalizeShortents(items: ShortentsItem[]): ShortentsItem[] {
  const seen = new Set<string>();
  return items.map(i => ({ keyword: clean(i.keyword).slice(0, 120), url: String(i.url || '') }))
    .filter(i => {
      const key = i.keyword.toLocaleLowerCase('ko');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      i.url = `https://search.naver.com/search.naver?query=${encodeURIComponent(i.keyword)}`;
      return true;
    });
}

export function scoreShortents(item: ShortentsItem, blog: SearchSample, news: SearchSample, now: number): ShortentsOpportunity {
  const result: ShortentsOpportunity = { ...item, score: null, verdict: '분석 불가', reasons: [], blogTotal: null, sampleSize: 0, directTitles: 0, recentNews: 0, evidence: [] };
  if (!blog.ok || !news.ok) return { ...result, error: [!blog.ok && (blog.error || '블로그 검색 실패'), !news.ok && (news.error || '뉴스 검색 실패')].filter(Boolean).join(' · ') };
  // An empty or malformed response must never become "zero competition".
  if (!Number.isFinite(blog.total) || Number(blog.total) < 0 || !Array.isArray(blog.items) || !Array.isArray(news.items)) {
    return { ...result, error: '검색 지표가 누락되어 점수를 계산하지 않았습니다.' };
  }
  const blogs = blog.items.slice(0, 20);
  const tokens = clean(item.keyword).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const directTitles = blogs.filter(b => {
    const title = clean(b.title).toLowerCase();
    return tokens.length > 0 && tokens.every(t => title.includes(t));
  }).length;
  const uniqueNews = new Map<string, any>();
  for (const n of news.items.slice(0, 20)) {
    const title = clean(n.title);
    const published = Date.parse(String(n.pubDate || ''));
    if (!title || !Number.isFinite(published) || published > now || now - published > 86400000) continue;
    const normalizedTitle = title.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    if (!uniqueNews.has(normalizedTitle)) uniqueNews.set(normalizedTitle, n);
  }
  const recent = [...uniqueNews.values()];
  result.blogTotal = Number(blog.total);
  result.sampleSize = blogs.length;
  result.directTitles = directTitles;
  result.recentNews = recent.length;
  result.evidence = recent.slice(0, 3).map(n => ({ title: clean(n.title), url: String(n.originallink || n.link || ''), publishedAt: String(n.pubDate || '') }))
    .filter(n => /^https?:\/\//i.test(n.url));
  if (!blogs.length || !recent.length) {
    return { ...result, verdict: '근거 부족', reasons: ['최근 24시간 뉴스와 비교할 블로그 표본이 모두 있어야 작성 우선순위를 계산합니다.'] };
  }
  const coverageGap = 1 - directTitles / blogs.length;
  const competition = Math.max(0, 1 - Math.log10(Math.max(1, Number(blog.total))) / 6);
  const activity = Math.min(1, recent.length / 10);
  result.score = Math.round(40 * competition + 35 * coverageGap + 25 * activity);
  result.verdict = result.score >= 65 ? '먼저 검토' : result.score >= 40 ? '차별화 후 검토' : '경쟁 주의';
  result.reasons = [
    `블로그 검색 문서 ${result.blogTotal.toLocaleString('ko-KR')}건 (대략적인 경쟁 규모)`,
    `관련도순 표본 ${blogs.length}개 중 주제어를 모두 포함한 제목 ${directTitles}개`,
    `최신 뉴스 표본에서 최근 24시간 보도 ${recent.length}개 (같은 제목 제외)`,
  ];
  return result;
}

export async function analyzeShortents(items: ShortentsItem[], search: ShortentsSearch, now = Date.now()): Promise<ShortentsOpportunity[]> {
  const candidates = normalizeShortents(items);
  if (candidates.length > 20) throw new Error('한 번에 최대 20개의 숏텐츠를 분석할 수 있습니다.');
  if (!candidates.length) throw new Error('분석할 숏텐츠가 없습니다.');
  const results: ShortentsOpportunity[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < candidates.length) {
      const item = candidates[cursor++]!;
      const safeSearch = async (type: 'blog' | 'news', sort: string): Promise<SearchSample> => {
        try { return await search(type, { query: item.keyword, display: 20, sort }); }
        catch (e: any) { return { ok: false, items: [], error: String(e?.message || e) }; }
      };
      const [blog, news] = await Promise.all([safeSearch('blog', 'sim'), safeSearch('news', 'date')]);
      results.push(scoreShortents(item, blog, news, now));
    }
  }
  await Promise.all([worker(), worker()]);
  return results.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.keyword.localeCompare(b.keyword, 'ko'));
}
