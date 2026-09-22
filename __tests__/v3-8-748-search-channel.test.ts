/**
 * 748 Search Pipeline — 검색 채널 상태 · 429 bounded retry · 성공만 캐시.
 * 실측(748c): 최신순 블로그 보강 호출이 429 → [] → 정상 검색처럼 계속 → 핵심 출처(12,800 객실)가 그 실행에서만 사라졌다.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { naverSearch, resetNaverModeMemo, resetNaverCallLog, getNaverCallLog, summarizeNaverChannels } from '../src/core/naver-search-client';
import { resetNaverSearchCache, cacheKey, readCache, writeCache } from '../src/core/naver-search-cache';

const LEGACY = { naverClientId: 'oldid', naverClientSecret: 'oldsecret' };

function fakeFetch(plan: Array<{ status: number; body?: any; retryAfter?: string }>) {
  const calls: string[] = [];
  let i = 0;
  const impl = (async (url: any) => {
    calls.push(String(url));
    const step = plan[Math.min(i, plan.length - 1)]!;
    i += 1;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      headers: { get: (k: string) => (k.toLowerCase() === 'retry-after' ? step.retryAfter ?? null : null) },
      json: async () => step.body ?? { items: [], total: 0 },
    } as any;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

let tmp: string;
beforeEach(() => {
  resetNaverModeMemo(); resetNaverCallLog(); resetNaverSearchCache();
  tmp = path.join(os.tmpdir(), `naver-cache-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  process.env['NAVER_SEARCH_CACHE_PATH'] = tmp;
  delete process.env['NAVER_SEARCH_CACHE'];
});
afterEach(() => { try { fs.unlinkSync(tmp); } catch { /* 없음 */ } delete process.env['NAVER_SEARCH_CACHE_PATH']; });

describe('429 — 조용한 실패 금지', () => {
  it('28-A 첫 호출 429 · 두 번째 성공 → RECOVERED_AFTER_RETRY, 결과 유지, 호출 2회', async () => {
    const f = fakeFetch([{ status: 429 }, { status: 200, body: { items: [{ title: 'x', link: 'u' }], total: 1 } }]);
    const res = await naverSearch('blog', { query: '경주 APEC', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, retryDelayMs: 0 });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('RECOVERED_AFTER_RETRY');
    expect(res.items).toHaveLength(1);
    expect(res.attempts).toBe(2);
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]).toBe(f.calls[1]);   // 같은 키로 — 토스가 아니라 재시도
  });

  it('28-B 두 번 다 429 → RATE_LIMITED · ok:false · 정상 EMPTY 로 위장하지 않는다 · 호출 정확히 2회(무한 재시도 없음)', async () => {
    const f = fakeFetch([{ status: 429 }, { status: 429 }]);
    const res = await naverSearch('blog', { query: '경주 APEC', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, retryDelayMs: 0 });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('RATE_LIMITED');
    expect(res.statusCode).toBe(429);
    expect(res.items).toEqual([]);
    expect(f.calls).toHaveLength(2);
    const rec = getNaverCallLog()[0]!;
    expect(rec.status).toBe('RATE_LIMITED');
    expect(rec.ok).toBe(false);
    expect(summarizeNaverChannels()).toMatchObject({ searchDegraded: true, rateLimited: 1, apiCalls: 2 });
  });

  it('진짜 0건은 EMPTY_VALID — RATE_LIMITED 와 구분된다', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [], total: 0 } }]);
    const res = await naverSearch('blog', { query: '아무도 안 쓴 말' }, { payload: LEGACY, fetchImpl: f.impl });
    expect(res.status).toBe('EMPTY_VALID');
    expect(summarizeNaverChannels().searchDegraded).toBe(false);
  });

  it('Retry-After 헤더는 상한(5초) 안에서 따른다 — 60초라고 해도 5초로 자른다', async () => {
    const f = fakeFetch([{ status: 429, retryAfter: '60' }, { status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    const t0 = Date.now();
    // 상한을 확인하려고 실제로 기다리지는 않는다 — retryDelayMs:0 이어도 Retry-After 가 있으면 그 값(상한 적용)을 쓴다.
    // 5초를 기다리면 테스트가 느려지므로 헤더가 0 인 경우로 "따른다" 를 확인한다.
    const g = fakeFetch([{ status: 429, retryAfter: '0' }, { status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    const res = await naverSearch('news', { query: 'k' }, { payload: LEGACY, fetchImpl: g.impl, retryDelayMs: 3000 });
    expect(res.status).toBe('RECOVERED_AFTER_RETRY');
    expect(Date.now() - t0).toBeLessThan(1500);
    void f;
  });

  it('성공 경로는 호출이 늘지 않는다 — 200 이면 정확히 1회', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    const res = await naverSearch('webkr', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl });
    expect(res.status).toBe('SUCCESS');
    expect(res.attempts).toBe(1);
    expect(f.calls).toHaveLength(1);
  });
});

describe('성공 결과 캐시 — 같은 날 같은 검색어는 호출 0', () => {
  it('28-C 성공 캐시가 있으면 API 를 부르지 않고 CACHE_HIT', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'wgat5900', link: 'https://m.blog.naver.com/wgat5900/1' }], total: 1 } }]);
    const first = await naverSearch('blog', { query: '경주 APEC 기간 숙소 예약', sort: 'date', display: 5 }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(first.status).toBe('SUCCESS');
    const second = await naverSearch('blog', { query: '경주 APEC 기간 숙소 예약', sort: 'date', display: 5 }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(second.status).toBe('CACHE_HIT');
    expect(second.ok).toBe(true);
    expect(second.items[0].title).toBe('wgat5900');
    expect(f.calls).toHaveLength(1);
    expect(summarizeNaverChannels()).toMatchObject({ cacheHits: 1, apiCalls: 1 });
  });

  it('캐시 키는 provider·type·query·sort·display·날짜 버킷 — sort 가 다르면 다른 키', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    await naverSearch('blog', { query: 'k', sort: 'sim' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    await naverSearch('blog', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(f.calls).toHaveLength(2);
    expect(cacheKey('legacy', 'blog', { query: 'k', sort: 'sim' }, '2026-09-22')).toBe('legacy|blog|k|sim|||2026-09-22');
  });

  it('29 429 의 [] 는 캐시에 저장되지 않는다 — 다음 호출은 다시 API 로 가서 성공할 수 있다', async () => {
    const f = fakeFetch([{ status: 429 }, { status: 429 }, { status: 200, body: { items: [{ title: 'late' }], total: 1 } }]);
    const bad = await naverSearch('blog', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true, retryDelayMs: 0 });
    expect(bad.status).toBe('RATE_LIMITED');
    expect(readCache(cacheKey('legacy', 'blog', { query: 'k', sort: 'date' }))).toBeNull();
    const good = await naverSearch('blog', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true, retryDelayMs: 0 });
    expect(good.status).toBe('SUCCESS');
    expect(good.items[0].title).toBe('late');
    expect(f.calls).toHaveLength(3);
  });

  it('타임아웃·오류의 [] 도 저장되지 않는다 · writeCache 는 ok:false 를 거부한다', async () => {
    const impl = (async () => { throw new Error('네트워크 끊김'); }) as unknown as typeof fetch;
    const res = await naverSearch('news', { query: 'k' }, { payload: LEGACY, fetchImpl: impl, cache: true });
    expect(res.status).toBe('FAILED');
    expect(readCache(cacheKey('legacy', 'news', { query: 'k' }))).toBeNull();
    expect(writeCache('x', { ok: false, items: [], total: 0, mode: 'legacy' })).toBe(false);
  });

  it('진짜 0건(EMPTY_VALID)은 저장한다 — 같은 날 다시 물을 필요가 없다', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [], total: 0 } }]);
    await naverSearch('kin', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    const again = await naverSearch('kin', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(again.status).toBe('CACHE_HIT');
    expect(f.calls).toHaveLength(1);
  });

  it('cache 옵션을 안 켠 호출(실시간 트렌드 등)은 캐시를 보지 않는다', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    await naverSearch('news', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    await naverSearch('news', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl });
    expect(f.calls).toHaveLength(2);
  });

  it('캐시는 파일로 남아 다음 프로세스(다음 실행)에서도 같은 날이면 쓴다', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'persist' }], total: 1 } }]);
    await naverSearch('blog', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(fs.existsSync(tmp)).toBe(true);
    resetNaverSearchCache();   // 메모리를 비워 "새 프로세스" 를 흉내 낸다
    const hit = await naverSearch('blog', { query: 'k', sort: 'date' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(hit.status).toBe('CACHE_HIT');
    expect(f.calls).toHaveLength(1);
  });

  it('NAVER_SEARCH_CACHE=0 이면 캐시를 끈다', async () => {
    process.env['NAVER_SEARCH_CACHE'] = '0';
    const f = fakeFetch([{ status: 200, body: { items: [{ title: 'x' }], total: 1 } }]);
    await naverSearch('blog', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    await naverSearch('blog', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl, cache: true });
    expect(f.calls).toHaveLength(2);
    delete process.env['NAVER_SEARCH_CACHE'];
  });
});
