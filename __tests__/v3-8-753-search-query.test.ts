const captured: Array<{ type: string; query: string; sort?: string }> = [];

// p-limit 는 ESM 전용이라 jest(ts-jest commonjs)가 못 읽는다 — 동시성 제한은 이 테스트의 관심사가 아니다
jest.mock('p-limit', () => ({ __esModule: true, default: () => (fn: (...a: unknown[]) => unknown, ...args: unknown[]) => fn(...args) }));
jest.mock('p-queue', () => ({ __esModule: true, default: class { add(fn: () => unknown) { return Promise.resolve().then(fn); } onIdle() { return Promise.resolve(); } get size() { return 0; } get pending() { return 0; } } }));

jest.mock('../src/core/naver-search-client', () => ({
  naverSearch: jest.fn(async (type: string, params: any) => { captured.push({ type, query: params.query, sort: params.sort }); return { ok: true, items: [], total: 0, mode: 'legacy' }; }),
  resolveAllNaverCredentials: () => [{ mode: 'legacy', keyId: 'x', keySecret: 'y' }],
  resolveNaverCredentials: () => ({ mode: 'legacy', keyId: 'x', keySecret: 'y' }),
  getNaverCallLog: () => [], resetNaverCallLog: () => {}, summarizeNaverCalls: () => ({ line: '', failed: [], bySource: {} }), summarizeNaverChannels: () => ({}),
}));

import { ContentCrawler } from '../src/core/content-crawler';

/*
 * v3.8.753 — 실제 run 1b7d92 의 blog 채널 검색어가 키워드를 두 번 이어 붙였다:
 *   "청년미래적금 VS 청년 도약계좌 청년미래적금 VS 청년 도약계좌"
 * orchestration 이 crawlerConfig 를 { topic: keyword, keywords: [keyword] } 로 만들고, 크롤러가 `${topic} ${keywords.join(' ')}` 로 이었다.
 * 정규식으로 반복 낱말을 지우지 않는다 — topic 과 똑같은 항목만 뺀다(다른 보조 검색어는 그대로).
 */
describe('v3.8.753 블로그 검색어 중복 결합 제거', () => {
  const K = '청년미래적금 VS 청년 도약계좌';
  beforeEach(() => { captured.length = 0; });

  test('orchestration 과 같은 설정({topic, keywords:[topic]})이면 검색어는 키워드 한 번', async () => {
    const crawler = new ContentCrawler();
    await crawler.crawlFromNaverAPI({ topic: K, keywords: [K], maxResults: 5, naverClientId: 'x', naverClientSecret: 'y' } as any);
    const blog = captured.filter((c) => c.type === 'blog');
    expect(blog.length).toBeGreaterThan(0);
    for (const c of blog) expect(c.query).toBe(K);
  });

  test('topic 과 다른 보조 검색어는 그대로 붙는다 · 같은 낱말이 든 정상 검색어를 훼손하지 않는다', async () => {
    const crawler = new ContentCrawler();
    await crawler.crawlFromNaverAPI({ topic: '청년미래적금', keywords: ['청년미래적금', '갈아타기', '청년미래적금 조건'], maxResults: 5, naverClientId: 'x', naverClientSecret: 'y' } as any);
    const blog = captured.filter((c) => c.type === 'blog');
    expect(blog[0]!.query).toBe('청년미래적금 갈아타기 청년미래적금 조건');   // "청년미래적금 조건" 은 다른 검색어라 남는다
  });

  test('orchestration 의 crawlerConfig 는 여전히 { topic: keyword, keywords: [keyword] } 다 (배선 확인)', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/core/final/orchestration.ts'), 'utf8');
    expect(src).toContain('topic: keyword,\n          keywords: [keyword],');
  });
});
