/**
 * v3.8.553~555 — 네이버 API HUB 전면 배선 + 구글 CSE 제거
 *
 * ## 왜 이 테스트인가
 * v3.8.526 에 단일 창구(naver-search-client)를 만들어 놓고도 **키 점검만** 그걸 썼다.
 * 실제 글 생성은 openapi.naver.com 을 직접 불러서, HUB 키를 넣어도 옛 API 로 나갔고
 * 기존 키가 만료되면 자동 토스도 못 하고 멈추는 상태였다 — 2릴리스 동안 아무도 몰랐다.
 *
 * 그래서 "창구가 잘 만들어졌나"가 아니라 **"앱이 창구를 실제로 쓰나"** 를 고정한다.
 * 그리고 문자열 일치만으로는 버그가 통과하므로, 토스 동작은 **가짜 fetch 를 주입해
 * 실제로 실행**해서 확인한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  naverSearch, naverDatalabSearch, resetNaverModeMemo, getNaverModeMemo,
  buildNaverSearchUrl, naverAuthHeaders, TERMINATED_SEARCH_TYPES, describeNaverFailure,
} from '../src/core/naver-search-client';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

/** 응답을 미리 정해두고, 어떤 URL 로 나갔는지 기록하는 가짜 fetch */
function fakeFetch(plan: Array<{ status: number; body?: any }>) {
  const calls: string[] = [];
  const headers: Array<Record<string, string>> = [];
  let i = 0;
  const impl = (async (url: any, init: any) => {
    calls.push(String(url));
    headers.push((init?.headers || {}) as Record<string, string>);
    const step = plan[Math.min(i, plan.length - 1)]!;
    i += 1;
    return {
      ok: step.status >= 200 && step.status < 300,
      status: step.status,
      json: async () => step.body ?? { items: [], total: 0 },
      text: async () => '',
    } as any;
  }) as unknown as typeof fetch;
  return { impl, calls, headers };
}

const HUB = { naverApiHubKeyId: 'hub-id', naverApiHubKey: 'hub-secret' };
const LEGACY = { naverClientId: 'legacy-id', naverClientSecret: 'legacy-secret' };

beforeEach(() => resetNaverModeMemo());

// ══════════════════════════════════════════════════════════
describe('① 실측 규격 — 도메인만 바꾸면 안 된다', () => {
  it('HUB 는 경로도 헤더도 다르다', () => {
    const url = buildNaverSearchUrl('blog', { query: '테스트' },
      { mode: 'hub', keyId: 'a', keySecret: 'b' });
    expect(url).toContain('https://naverapihub.apigw.ntruss.com/search/v1/blog');
    // ⚠️ naveropenapi 는 다른 게이트웨이다 — 여기로 새면 404
    expect(url).not.toContain('naveropenapi');

    const h = naverAuthHeaders({ mode: 'hub', keyId: 'a', keySecret: 'b' });
    expect(h['X-NCP-APIGW-API-KEY-ID']).toBe('a');
    expect(h['X-NCP-APIGW-API-KEY']).toBe('b');
    expect(h['X-Naver-Client-Id']).toBeUndefined();
  });

  it('기존 키는 옛 경로·옛 헤더 그대로', () => {
    const url = buildNaverSearchUrl('blog', { query: '테스트' },
      { mode: 'legacy', keyId: 'a', keySecret: 'b' });
    expect(url).toContain('https://openapi.naver.com/v1/search/blog.json');
    const h = naverAuthHeaders({ mode: 'legacy', keyId: 'a', keySecret: 'b' });
    expect(h['X-Naver-Client-Id']).toBe('a');
  });

  it('종료된 API(쇼핑·책·전문자료)를 목록으로 못박는다 — 2026-07-31 종료, 대체 없음', () => {
    expect([...TERMINATED_SEARCH_TYPES]).toEqual(['shop', 'book', 'doc']);
  });
});

// ══════════════════════════════════════════════════════════
describe('② 자동 토스 — 가짜 fetch 로 실제 실행해서 본다', () => {
  it('HUB 를 먼저 쓴다 (새 발급분이 정답이다)', async () => {
    const f = fakeFetch([{ status: 200, body: { items: [{ link: 'x' }], total: 7 } }]);
    const res = await naverSearch('blog', { query: 'k' },
      { payload: { ...HUB, ...LEGACY }, fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('hub');
    expect(res.total).toBe(7);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toContain('naverapihub.apigw.ntruss.com');
  });

  it('⭐ HUB 가 인증에서 막히면 그 자리에서 기존 키로 넘어간다', async () => {
    const f = fakeFetch([
      { status: 401 },                                        // HUB 거절
      { status: 200, body: { items: [{ link: 'y' }], total: 3 } }, // 기존 키 성공
    ]);
    const res = await naverSearch('blog', { query: 'k' },
      { payload: { ...HUB, ...LEGACY }, fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('legacy');
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0]).toContain('naverapihub');
    expect(f.calls[1]).toContain('openapi.naver.com');
  });

  it('⭐ 기존 키가 만료되면(403) HUB 로 넘어간다 — 유예 종료 대비', async () => {
    const f = fakeFetch([
      { status: 403 },
      { status: 200, body: { items: [], total: 1 } },
    ]);
    const res = await naverSearch('blog', { query: 'k' },
      { payload: { ...HUB, ...LEGACY }, preferMode: 'legacy', fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('hub');
    expect(f.calls[1]).toContain('naverapihub');
  });

  it('살아 있는 쪽을 기억해 다음부터 곧바로 그쪽으로 간다', async () => {
    const f1 = fakeFetch([{ status: 404 }, { status: 200, body: { items: [], total: 0 } }]);
    await naverSearch('blog', { query: 'k' }, { payload: { ...HUB, ...LEGACY }, fetchImpl: f1.impl });
    expect(getNaverModeMemo()).toBe('legacy');

    const f2 = fakeFetch([{ status: 200, body: { items: [], total: 0 } }]);
    await naverSearch('blog', { query: 'k' }, { payload: { ...HUB, ...LEGACY }, fetchImpl: f2.impl });
    expect(f2.calls).toHaveLength(1);                 // 죽은 키를 다시 안 두드린다
    expect(f2.calls[0]).toContain('openapi.naver.com');
  });

  it('⭐ 429(한도 초과)는 토스하지 않는다 — 다른 키로 가도 같다', async () => {
    const f = fakeFetch([{ status: 429 }]);
    const res = await naverSearch('blog', { query: 'k' },
      { payload: { ...HUB, ...LEGACY }, fetchImpl: f.impl });
    expect(res.ok).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(res.error).toMatch(/429|한도|서비스/);
  });

  it('⭐ 네트워크 오류에도 토스하지 않는다 — 멀쩡한 키를 의심하게 된다', async () => {
    const impl = (async () => { throw new Error('네트워크 끊김'); }) as unknown as typeof fetch;
    const res = await naverSearch('blog', { query: 'k' },
      { payload: { ...HUB, ...LEGACY }, fetchImpl: impl });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('네트워크');
  });

  it('키가 한 벌뿐이면 한 번만 시도하고 처방을 준다', async () => {
    const f = fakeFetch([{ status: 401 }]);
    const res = await naverSearch('blog', { query: 'k' }, { payload: LEGACY, fetchImpl: f.impl });
    expect(f.calls).toHaveLength(1);
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('데이터랩도 같은 토스를 탄다', async () => {
    const f = fakeFetch([
      { status: 401 },
      { status: 200, body: { results: [{ title: 'k', data: [{ ratio: 10 }] }] } },
    ]);
    const res = await naverDatalabSearch({ startDate: '2026-01-01' },
      { payload: { ...HUB, ...LEGACY }, fetchImpl: f.impl });
    expect(res.ok).toBe(true);
    expect(res.mode).toBe('legacy');
    expect(f.calls[0]).toContain('search-trend/v1/search');
    expect(f.calls[1]).toContain('openapi.naver.com/v1/datalab/search');
  });

  it('상태코드를 처방으로 번역한다 (숫자만 보여주면 사장님이 못 고친다)', () => {
    expect(describeNaverFailure(401, 'hub')).toBeTruthy();
    expect(describeNaverFailure(404, 'legacy')).toBeTruthy();
    expect(describeNaverFailure(429, 'hub')).toMatch(/서비스|한도|429/);
  });
});

// ══════════════════════════════════════════════════════════
describe('③ 앱이 창구를 실제로 쓴다 (2릴리스 동안 안 쓰던 그 사고 방지)', () => {
  const LIVE_FILES = [
    'src/core/content-crawler.ts',
    'src/core/naver-api.ts',
    'src/core/mass-crawler.ts',
    'src/core/perplexityFactCheck.ts',
    'src/core/keyword-demand.ts',
    'src/core/keyword-narrowing.ts',
    'src/core/naver-datalab.ts',
    'src/core/subtopic-crawler.ts',
    'src/naver-crawler.ts',
    'src/utils/naver-datalab-api.ts',
    'src/utils/blog-index-via-datalab.ts',
    'src/main/ipc/realtime-trends.ts',
    'src/main/ipc/content-crawling.ts',
    'src/main/ipc/keyword-discovery.ts',
  ];

  it('⭐ 라이브 경로가 openapi.naver.com 을 직접 부르지 않는다', () => {
    const offenders = LIVE_FILES.filter((f) => {
      const src = read(f);
      // 주석에 적힌 설명은 제외하고, 실제 코드에 URL 이 있는지 본다
      return src.split('\n').some((line) => line.includes('openapi.naver.com')
        && !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    });
    expect(offenders).toEqual([]);
  });

  it('⭐ 그 파일들이 전부 창구를 import 한다', () => {
    const missing = LIVE_FILES.filter((f) => !read(f).includes('naver-search-client'));
    expect(missing).toEqual([]);
  });

  it('종료된 API 를 부르는 코드가 없다 (shop/book/doc)', () => {
    const hits = LIVE_FILES.filter((f) => /search\/(shop|book|doc)\b/.test(read(f)));
    expect(hits).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════
describe('④ 구글 CSE 제거 — 흔적이 남으면 다시 배선된다', () => {
  const CSE_FILES = [
    'src/core/final/orchestration.ts',
    'src/core/content-crawler.ts',
    'src/core/subtopic-crawler.ts',
    'src/core/mass-crawler.ts',
    'src/core/final/generation.ts',
    'src/core/final/official-sources.ts',
    'src/core/api-key-checker.ts',
    'src/thumbnail.ts',
    'src/utils/google-trends-api.ts',
    'src/main/ipc/keyword-discovery.ts',
    'electron/main.ts',
  ];

  it('⭐ CSE HTTP 호출이 한 곳도 남지 않았다', () => {
    const offenders = CSE_FILES.filter((f) => read(f).includes('googleapis.com/customsearch'));
    expect(offenders).toEqual([]);
  });

  it('CSE 전용 함수·클래스가 삭제됐다', () => {
    expect(read('src/core/content-crawler.ts')).not.toContain('async crawlFromCSE');
    expect(read('src/core/mass-crawler.ts')).not.toContain('class GoogleCSEMassCrawler');
    expect(read('src/thumbnail.ts')).not.toContain('export async function makeCSEThumbnail');
    expect(read('src/core/final/official-sources.ts')).not.toContain('export async function collectOfficialSources');
  });

  it('⭐ 기관 근거는 네이버 웹문서가 맡는다 (기능이 사라지면 안 된다)', () => {
    const orch = read('src/core/final/orchestration.ts');
    expect(orch).toContain('buildOfficialSourcesFromWeb(crawledPosts as any)');
    expect(orch).toContain("if (contentMode !== 'shopping') {");
  });

  it('⭐ CTA 주소 찾기도 네이버 웹문서로 계속 돈다', () => {
    const gen = read('src/core/final/generation.ts');
    expect(gen).toContain("naverSearch('webkr'");
  });

  it('화면에서도 CSE 칸·점검을 걷어냈다 (칸만 남으면 눌러도 무동작이 된다)', () => {
    const html = read('electron/ui/index.html');
    expect(html).not.toContain('id="googleCseKey"');
    expect(html).not.toContain('id="googleCseCx"');
    expect(read('electron/ui/modules/settings.js')).not.toContain('export async function checkCseConnection');
    expect(read('electron/main.ts')).not.toContain("ipcMain.handle('test-google-cse-connection'");
  });
});
