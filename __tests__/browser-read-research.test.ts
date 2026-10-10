/**
 * 브라우저 정독 리서치 1단계 — 찾기는 네이버 API 그대로, **못 읽은 주소만** 실제 브라우저로 다시 연다.
 *
 * 브라우저는 가짜를 주입한다(테스트가 실제 Chromium·인터넷을 타면 안 된다).
 * 계획서: docs/browser-read-research-plan.md
 */
import {
  createBrowserReader,
  needsBrowser,
  readWithBrowserFallback,
  shouldBlockRequest,
  type BrowserLike,
} from '../src/core/crawlers/browser-reader';
import { browserReadEnabled } from '../src/core/crawlers/browser-reader';
import { documentFromHtml, type PageFetchOutcome } from '../src/core/crawlers/official-page-body';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const readSrc = (p: string): string => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
import { fetchGrounding } from '../src/core/final/naver-grounding';

/** 기관 포털 꼴의 렌더 결과 — `#contents` 안에 본문이 충분히 있다 */
const renderedHtml = (label: string) => `<html><head><title>${label}</title></head><body>
  <div id="header">주메뉴 바로가기</div>
  <div id="contents"><h3>${label} 안내</h3><p>${`${label} 지원 대상은 만 19세 이상 34세 이하 청년이며 월 최대 20만원을 12개월 동안 지원합니다. 신청 기간은 3월 2일부터 3월 16일까지입니다. `.repeat(6)}</p></div>
</body></html>`;
/** 자바스크립트로 그리는 관공서 사이트를 HTTP 로 받았을 때 — 빈 껍데기 */
const emptyShellHtml = '<html><body><div id="app"></div><script src="/main.js"></script>' + ' '.repeat(300) + '</body></html>';

interface FakeLog { routes: number; opened: string[]; closedPages: number; contextsClosed: number; browserClosed: number; launches: number }

function fakeBrowser(pages: Record<string, { html?: string; contentType?: string; status?: number; hang?: boolean; throws?: string; frames?: string[] }>, log: FakeLog, hold?: { active: number; max: number }): BrowserLike {
  return {
    async newContext() {
      return {
        async route(_pattern: string, _handler: unknown) { log.routes += 1; },
        async newPage() {
          let current = '';
          return {
            async goto(url: string) {
              log.opened.push(url);
              current = url;
              if (hold) { hold.active += 1; hold.max = Math.max(hold.max, hold.active); }
              const spec = pages[url];
              try {
                await new Promise((r) => setTimeout(r, 5));
                if (!spec) throw new Error('net::ERR_NAME_NOT_RESOLVED');
                if (spec.throws) throw new Error(spec.throws);
                if (spec.hang) await new Promise(() => { /* 영원히 안 끝난다 */ });
                return { status: () => spec.status ?? 200, headers: () => ({ 'content-type': spec.contentType ?? 'text/html; charset=utf-8' }) };
              } finally {
                if (hold) hold.active -= 1;
              }
            },
            async waitForLoadState() { /* 즉시 */ },
            async content() { return pages[current]?.html ?? ''; },
            frames() {
              const fr = pages[current]?.frames || [];
              return [{ content: async () => pages[current]?.html ?? '' }, ...fr.map((h) => ({ content: async () => h }))];
            },
            async close() { log.closedPages += 1; },
          };
        },
        async close() { log.contextsClosed += 1; },
      };
    },
    async close() { log.browserClosed += 1; },
  } as unknown as BrowserLike;
}
const newLog = (): FakeLog => ({ routes: 0, opened: [], closedPages: 0, contextsClosed: 0, browserClosed: 0, launches: 0 });
const launcherOf = (b: BrowserLike, log: FakeLog) => async () => { log.launches += 1; return b; };

describe('언제 브라우저로 다시 여는가 (needsBrowser)', () => {
  const at = new Date().toISOString();
  test('본문 추출 실패·빈 응답·차단(403)·망 오류·시간초과면 다시 연다', () => {
    for (const reason of ['EXTRACT_FAIL', 'EMPTY_BODY', 'BLOCKED', 'NETWORK', 'TIMEOUT', 'UNKNOWN'] as const) {
      expect(needsBrowser({ doc: null, failure: { reason }, attemptedAt: at })).toBe(true);
    }
  });
  test('첨부파일 주소·잘못된 주소·HTML 아닌 응답·404 는 다시 열지 않는다(브라우저로 열어도 같다)', () => {
    for (const reason of ['FILE_URL', 'INVALID_URL', 'UNSUPPORTED_CONTENT', 'HTTP_STATUS'] as const) {
      expect(needsBrowser({ doc: null, failure: { reason }, attemptedAt: at })).toBe(false);
    }
  });
  test('HTTP 로 본문을 충분히 읽었으면 브라우저를 띄우지 않는다', () => {
    expect(needsBrowser({ doc: { text: '가'.repeat(900), publishedAt: null, rawLength: 2000, fullText: '가'.repeat(2000), truncatedAt: null }, attemptedAt: at })).toBe(false);
  });
});

describe('요청 차단 (shouldBlockRequest)', () => {
  test('이미지·동영상·글꼴은 받지 않는다', () => {
    expect(shouldBlockRequest('https://www.gov.kr/a.png', 'image')).toBe(true);
    expect(shouldBlockRequest('https://www.gov.kr/a.mp4', 'media')).toBe(true);
    expect(shouldBlockRequest('https://www.gov.kr/a.woff2', 'font')).toBe(true);
  });
  test('광고·추적 스크립트는 받지 않는다 — 광고 노출을 만들지 않는다', () => {
    for (const u of [
      'https://securepubads.g.doubleclick.net/tag/js/gpt.js',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'https://www.googletagmanager.com/gtag/js?id=G-1',
      'https://www.google-analytics.com/analytics.js',
      'https://static.dable.io/dist/plugin.min.js',
      'https://wcs.naver.net/wcslog.js',
    ]) expect(shouldBlockRequest(u, 'script')).toBe(true);
  });
  test('본문 문서·본문을 그리는 스크립트는 받는다', () => {
    expect(shouldBlockRequest('https://www.bokjiro.go.kr/ssis-tbu/index.do', 'document')).toBe(false);
    expect(shouldBlockRequest('https://www.bokjiro.go.kr/js/app.js', 'script')).toBe(false);
    expect(shouldBlockRequest('https://www.fsc.go.kr/api/list.json', 'xhr')).toBe(false);
  });
});

describe('브라우저 읽기 (createBrowserReader)', () => {
  test('렌더된 화면에서 기존 추출기로 본문을 뽑는다 — 발췌는 maxChars, 장부용 보존 본문은 따로', async () => {
    const log = newLog();
    const url = 'https://www.example.go.kr/policy/1';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { html: renderedHtml('청년월세') } }, log), log), ownSources: [] });
    const out = await reader.read(url, 300);
    await reader.close();
    expect(out.doc).not.toBeNull();
    expect(out.doc!.text.length).toBeLessThanOrEqual(300);
    expect(out.doc!.fullText!.length).toBeGreaterThan(300);
    expect(out.doc!.text).toContain('청년월세');
    expect(log.routes).toBe(1);           // 요청 차단기를 단다
    expect(log.closedPages).toBe(1);      // 쪽은 읽고 바로 닫는다
  });

  test('본문을 못 읽으면 실패 사유를 남긴다(던지지 않는다)', async () => {
    const log = newLog();
    const url = 'https://www.example.go.kr/empty';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { html: emptyShellHtml } }, log), log), ownSources: [] });
    const out = await reader.read(url, 900);
    await reader.close();
    expect(out.doc).toBeNull();
    expect(out.failure?.reason).toBe('EXTRACT_FAIL');
  });

  test('본문이 안쪽 틀(iframe)에 있으면 틀 안에서 찾는다', async () => {
    const log = newLog();
    const url = 'https://www.example.go.kr/framed';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { html: emptyShellHtml, frames: [renderedHtml('틀안본문')] } }, log), log), ownSources: [] });
    const out = await reader.read(url, 900);
    await reader.close();
    expect(out.doc?.text).toContain('틀안본문');
  });

  test('HTML 이 아닌 응답(PDF 등)·4xx 는 실패로 남긴다', async () => {
    const log = newLog();
    const pdf = 'https://www.example.go.kr/view?id=1';
    const gone = 'https://www.example.go.kr/gone';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [pdf]: { contentType: 'application/pdf' }, [gone]: { status: 404 } }, log), log), ownSources: [] });
    expect((await reader.read(pdf, 900)).failure?.reason).toBe('UNSUPPORTED_CONTENT');
    const g = await reader.read(gone, 900);
    expect(g.failure).toMatchObject({ reason: 'HTTP_STATUS', status: 404 });
    await reader.close();
  });

  test('브라우저는 처음 필요할 때 한 번만 띄우고, close 하면 닫는다', async () => {
    const log = newLog();
    const a = 'https://www.example.go.kr/a';
    const b = 'https://www.example.go.kr/b';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [a]: { html: renderedHtml('가') }, [b]: { html: renderedHtml('나') } }, log), log), ownSources: [] });
    expect(log.launches).toBe(0);                        // 만들기만 해서는 안 띄운다
    await Promise.all([reader.read(a, 900), reader.read(b, 900)]);
    expect(log.launches).toBe(1);
    await reader.close();
    expect(log.browserClosed).toBe(1);
    expect(log.contextsClosed).toBe(1);
    expect(reader.stats()).toMatchObject({ launched: true, opened: 2, ok: 2 });
  });

  test('한 번도 안 읽었으면 close 해도 브라우저를 띄우지 않는다', async () => {
    const log = newLog();
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({}, log), log), ownSources: [] });
    await reader.close();
    expect(log.launches).toBe(0);
  });

  test('사장님 사이트(광고 달린 자기 사이트)는 열지 않는다 — 무효 트래픽 방지', async () => {
    const log = newLog();
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({}, log), log) });
    const out = await reader.read('https://leadernam.com/some-post', 900);
    await reader.close();
    expect(out.failure).toMatchObject({ reason: 'BLOCKED' });
    expect(log.opened).toEqual([]);
    expect(log.launches).toBe(0);
  });

  test('설정의 자기 사이트 목록(EXCLUDE_SOURCE_DOMAINS 꼴)도 열지 않는다', async () => {
    const log = newLog();
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({}, log), log), ownSources: ['myblog.tistory.com'] });
    expect((await reader.read('https://myblog.tistory.com/12', 900)).failure?.reason).toBe('BLOCKED');
    expect(log.opened).toEqual([]);
    await reader.close();
  });

  test('쪽당 시간 제한 — 안 끝나는 쪽은 포기하고 TIMEOUT 으로 남긴다', async () => {
    const log = newLog();
    const url = 'https://www.slow.go.kr/hang';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { hang: true } }, log), log), ownSources: [], perPageTimeoutMs: 40 });
    const out = await reader.read(url, 900);
    await reader.close();
    expect(out.failure?.reason).toBe('TIMEOUT');
    expect(log.closedPages).toBe(1);   // 시간초과여도 쪽은 닫는다
  });

  test('편당 총 시간 상한 — 넘으면 더 열지 않고 TIMEOUT(총 시간) 으로 남긴다', async () => {
    const log = newLog();
    let clock = 0;
    const a = 'https://www.example.go.kr/a';
    const b = 'https://www.example.go.kr/b';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [a]: { html: renderedHtml('가') }, [b]: { html: renderedHtml('나') } }, log), log), ownSources: [], totalBudgetMs: 1000, now: () => clock });
    expect((await reader.read(a, 900)).doc).not.toBeNull();
    clock = 1500;
    const late = await reader.read(b, 900);
    await reader.close();
    expect(late.failure?.reason).toBe('TIMEOUT');
    expect(late.failure?.detail).toContain('총 시간');
    expect(log.opened).toEqual([a]);
    expect(reader.stats().skippedForBudget).toBe(1);
  });

  test('동시에 여는 탭은 최대 2개, 같은 사이트는 한 번에 하나', async () => {
    const log = newLog();
    const hold = { active: 0, max: 0 };
    const urls = ['https://a.go.kr/1', 'https://b.go.kr/1', 'https://c.go.kr/1', 'https://d.go.kr/1'];
    const pages = Object.fromEntries(urls.map((u) => [u, { html: renderedHtml(u) }]));
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser(pages, log, hold), log), ownSources: [] });
    await Promise.all(urls.map((u) => reader.read(u, 900)));
    expect(hold.max).toBe(2);

    const sameHold = { active: 0, max: 0 };
    const same = ['https://same.go.kr/1', 'https://same.go.kr/2', 'https://same.go.kr/3'];
    const reader2 = createBrowserReader({ launch: launcherOf(fakeBrowser(Object.fromEntries(same.map((u) => [u, { html: renderedHtml(u) }])), newLog(), sameHold), log), ownSources: [] });
    await Promise.all(same.map((u) => reader2.read(u, 900)));
    expect(sameHold.max).toBe(1);
    await reader.close();
    await reader2.close();
  });

  test('브라우저가 아예 안 뜨는 PC — 실패로 남기고 다시 띄우려 하지 않는다', async () => {
    let tries = 0;
    const reader = createBrowserReader({ launch: async () => { tries += 1; throw new Error("Executable doesn't exist"); }, ownSources: [] });
    const a = await reader.read('https://www.example.go.kr/a', 900);
    const b = await reader.read('https://www.example.go.kr/b', 900);
    await reader.close();
    expect(a.doc).toBeNull();
    expect(b.doc).toBeNull();
    expect(tries).toBe(1);
    expect(reader.stats().unavailable).toContain('Executable');
  });
});

describe('HTTP 먼저, 모자라면 브라우저 (readWithBrowserFallback)', () => {
  const at = new Date().toISOString();
  test('HTTP 가 충분하면 브라우저를 안 쓴다', async () => {
    const log = newLog();
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({}, log), log), ownSources: [] });
    const http = async (): Promise<PageFetchOutcome> => ({ doc: { text: '본문'.repeat(300), publishedAt: null, rawLength: 600 }, attemptedAt: at });
    const out = await readWithBrowserFallback('https://news.example.com/1', 900, http, reader);
    await reader.close();
    expect(out.via).toBe('http');
    expect(log.launches).toBe(0);
  });
  test('HTTP 로 빈 껍데기면 브라우저로 다시 읽어 본문을 얻는다', async () => {
    const log = newLog();
    const url = 'https://www.example.go.kr/spa';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { html: renderedHtml('렌더본문') } }, log), log), ownSources: [] });
    const http = async (): Promise<PageFetchOutcome> => ({ doc: null, failure: { reason: 'EXTRACT_FAIL' }, attemptedAt: at });
    const out = await readWithBrowserFallback(url, 900, http, reader);
    await reader.close();
    expect(out.via).toBe('browser');
    expect(out.doc?.text).toContain('렌더본문');
  });
  test('브라우저도 실패하면 HTTP 의 실패 사유를 그대로 둔다 — 예전보다 나빠지지 않는다', async () => {
    const log = newLog();
    const url = 'https://www.example.go.kr/spa';
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [url]: { html: emptyShellHtml } }, log), log), ownSources: [] });
    const http = async (): Promise<PageFetchOutcome> => ({ doc: null, failure: { reason: 'EXTRACT_FAIL', detail: 'html 300자' }, attemptedAt: at });
    const out = await readWithBrowserFallback(url, 900, http, reader);
    await reader.close();
    expect(out.doc).toBeNull();
    expect(out.via).toBe('http');
    expect(out.failure).toMatchObject({ reason: 'EXTRACT_FAIL', detail: 'html 300자' });
  });
  test('첨부파일 주소는 브라우저로도 열지 않는다', async () => {
    const log = newLog();
    const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({}, log), log), ownSources: [] });
    const http = async (): Promise<PageFetchOutcome> => ({ doc: null, failure: { reason: 'FILE_URL' }, attemptedAt: at });
    const out = await readWithBrowserFallback('https://www.example.go.kr/a.pdf', 900, http, reader);
    await reader.close();
    expect(out.failure?.reason).toBe('FILE_URL');
    expect(log.opened).toEqual([]);
  });
});

describe('HTML → 본문 공통 추출기 (documentFromHtml) — HTTP 와 브라우저가 같은 문을 지난다', () => {
  test('기관 포털 꼴이면 본문, 빈 껍데기면 EXTRACT_FAIL', () => {
    expect(documentFromHtml(renderedHtml('공통'), 900).doc?.text).toContain('공통');
    expect(documentFromHtml(emptyShellHtml, 900).failure?.reason).toBe('EXTRACT_FAIL');
    expect(documentFromHtml('   ', 900).failure?.reason).toBe('EMPTY_BODY');
  });
});

describe('근거 수집(fetchGrounding)에 연결', () => {
  const news = (n: number) => Array.from({ length: n }, (_, i) => ({
    title: `청년 월세 지원 신청 기사 ${i + 1}`, description: '청년 월세 지원 신청 조건과 기간 안내',
    link: `https://news.example.com/a/${i + 1}`, originallink: `https://news.example.com/a/${i + 1}`, pubDate: 'Mon, 28 Sep 2026 09:00:00 +0900',
  }));
  const officials = (n: number) => Array.from({ length: n }, (_, i) => ({
    title: `청년 월세 지원 공식 안내 ${i + 1}`, description: '청년 월세 지원 대상 조건 신청 기간',
    link: `https://www.gov${i + 1}.go.kr/policy/${i + 1}`,
  }));
  const search = (items: Record<string, any[]>) => async (type: string) => ({ ok: true, items: items[type] || [] });
  const body = async (url: string) => `${url} 청년 월세 지원 본문. 지원 대상은 만 19~34세, 신청 기간은 3월 2일부터 3월 16일까지. `.repeat(12);
  const KEY = '청년 월세 지원';

  test('스위치 꺼짐(기본): 본문은 예전처럼 최대 6쪽', async () => {
    const g = await fetchGrounding(KEY, search({ news: news(10), webkr: officials(6), blog: [] }) as any, { mainKeyword: KEY, fetchBody: body });
    expect(g.fetchLog!.filter((f) => f.attempted).length).toBe(6);
    expect(g.fetchLog!.some((f) => 'via' in f)).toBe(false);   // 꺼져 있으면 기록 모양도 예전 그대로
    expect(g.browserRead).toBeUndefined();
  });

  test('스위치 켜짐: 본문 최대 12쪽, 공식기관 페이지가 먼저(최대 4쪽)', async () => {
    const g = await fetchGrounding(KEY, search({ news: news(10), webkr: officials(6), blog: [] }) as any, { mainKeyword: KEY, fetchBody: body, browserRead: { enabled: true } });
    const tried = g.fetchLog!.filter((f) => f.attempted);
    expect(tried.length).toBe(12);
    expect(tried.slice(0, 4).every((f) => /\.go\.kr/.test(f.url))).toBe(true);
  });

  test('스위치 켜짐 + 실제 수집기: HTTP 로 못 읽은 관공서 페이지를 브라우저로 다시 읽어 장부에 넣는다', async () => {
    const pageBody = require('../src/core/crawlers/official-page-body');
    const govUrl = 'https://www.gov1.go.kr/policy/1';
    const spy = jest.spyOn(pageBody, 'fetchPageDocumentDetailed').mockImplementation(async (...args: unknown[]) => {
      const url = String(args[0]);
      if (url === govUrl) return { doc: null, failure: { reason: 'EXTRACT_FAIL', detail: 'html 300자' }, attemptedAt: new Date().toISOString() };
      return { doc: { text: `${url} 청년 월세 지원 기사 본문 `.repeat(20).slice(0, 900), publishedAt: null, rawLength: 2000 }, attemptedAt: new Date().toISOString() };
    });
    try {
      const log = newLog();
      const reader = createBrowserReader({ launch: launcherOf(fakeBrowser({ [govUrl]: { html: renderedHtml('청년 월세 지원') } }, log), log), ownSources: [] });
      const g = await fetchGrounding(KEY, search({ news: news(3), webkr: officials(1), blog: [] }) as any, { mainKeyword: KEY, browserRead: { enabled: true, reader } });
      await reader.close();
      const rec = g.fetchLog!.find((f) => f.url === govUrl)!;
      expect(rec).toMatchObject({ ok: true, reason: 'ok', via: 'browser' });
      expect(g.fetchLog!.filter((f) => f.via === 'http').length).toBe(3);
      expect(log.opened).toEqual([govUrl]);                 // 브라우저는 못 읽은 그 주소만 열었다
      expect(g.items!.some((it) => it.url === govUrl && it.hasBody)).toBe(true);
      expect(g.browserRead).toMatchObject({ enabled: true, launched: true, opened: 1, rescued: 1 });
    } finally {
      spy.mockRestore();
    }
  });

  test('스위치 켜짐인데 브라우저가 안 뜨면: 예전처럼 스니펫으로 끝나고 글쓰기는 계속된다', async () => {
    const pageBody = require('../src/core/crawlers/official-page-body');
    const spy = jest.spyOn(pageBody, 'fetchPageDocumentDetailed').mockImplementation(async () => ({ doc: null, failure: { reason: 'EXTRACT_FAIL' }, attemptedAt: new Date().toISOString() }));
    try {
      const reader = createBrowserReader({ launch: async () => { throw new Error('no browser'); }, ownSources: [] });
      const g = await fetchGrounding(KEY, search({ news: news(2), webkr: officials(1), blog: [] }) as any, { mainKeyword: KEY, browserRead: { enabled: true, reader } });
      await reader.close();
      expect(g.newsCount + g.webCount).toBeGreaterThan(0);   // 스니펫은 남는다
      expect(g.browserRead).toMatchObject({ enabled: true, launched: false, rescued: 0 });
      expect(g.browserRead!.unavailable).toContain('no browser');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('스위치 배선 (1단계는 숨김 스위치 — 기본 꺼짐)', () => {
  test('BROWSER_READ=1 또는 payload.browserRead === true 일 때만 켠다', () => {
    expect(browserReadEnabled({}, {})).toBe(false);
    expect(browserReadEnabled({ BROWSER_READ: '0' }, { browserRead: 'true' })).toBe(false);
    expect(browserReadEnabled({ BROWSER_READ: '1' }, {})).toBe(true);
    expect(browserReadEnabled({}, { browserRead: true })).toBe(true);
    expect(browserReadEnabled({}, undefined)).toBe(false);
  });

  test('API 경로: 첫 근거 수집(fetchGrounding)이 스위치를 넘긴다', () => {
    const src = readSrc('src/core/final/orchestration.ts');
    const line = src.split('\n').find((l: string) => l.includes('const g = await fetchGrounding(keyword,'));
    expect(line).toBeDefined();
    expect(line).toContain('browserRead');
    expect(src).toContain('browserReadEnabled(process.env');
  });

  test('에이전트 모드: main.ts 와 컴파일된 main.js 둘 다 같은 스위치를 넘긴다(에이전트는 orchestration 을 안 거친다)', () => {
    for (const file of ['electron/main.ts', 'electron/main.js']) {
      const src = readSrc(file);
      const line = src.split('\n').find((l: string) => l.includes('await fetchGrounding(agentKeyword'));
      expect(line).toBeDefined();
      expect(line).toContain('browserRead');
      expect(src).toContain("require('../dist/core/crawlers/browser-reader')");
    }
  });
});
