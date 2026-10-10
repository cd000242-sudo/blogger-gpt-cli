/**
 * 🔎 browser-reader — 일반 HTTP 로 못 읽은 페이지를 **실제 브라우저로 다시 열어** 본문을 읽는다. (브라우저 정독 리서치 1단계)
 *
 * ## 왜 필요한가
 * 사장님: "API 보다 인터넷 띄우고 꼼꼼하게 하나하나 서칭".
 * 근거 수집(`naver-grounding`)은 주소를 HTTP 로 한 번 받아 HTML 에서 본문을 뽑는다. 화면을 자바스크립트로 그리는
 * 관공서 사이트는 그렇게 받으면 빈 껍데기라 0~3자만 읽힌다. 브라우저는 스크립트를 돌린 **다 그려진 화면**을 준다.
 *
 * ## 지키는 것
 * - 찾기는 그대로 네이버 검색 API. **검색 결과 페이지는 브라우저로 열지 않는다**(캡차·고객 IP 차단 위험). 여기는 주소를 받아 읽기만 한다.
 * - HTTP 먼저, 모자랄 때만 브라우저(`readWithBrowserFallback`) — 언론사 기사는 HTTP 로도 잘 읽힌다. 전부 열면 시간만 는다.
 * - 브라우저는 **처음 필요할 때** 한 번 띄우고, 탭은 2개까지, 같은 사이트는 한 번에 하나. 쪽당 15초, 편당 총 시간 상한.
 * - 광고·추적 스크립트·이미지·글꼴·동영상은 받지 않는다 — 빠르고, 남의 광고 노출을 만들지 않는다.
 * - 사장님 사이트(광고 달린 자기 사이트)는 열지 않는다 — 같은 IP 무효 트래픽 위험(CLAUDE.md).
 * - **어떤 경우에도 던지지 않는다.** 실패는 사유를 단 결과로 돌려주고, 호출부는 예전처럼 스니펫을 남긴다.
 *
 * 고르는 기준은 HTTP 와 같다 — 그려진 HTML 을 같은 추출기(`documentFromHtml`)에 넣는다.
 */

import { documentFromHtml, type PageFetchOutcome, type FetchFailureReason } from './official-page-body';
import { collectOwnSources, isOwnSource } from './own-source-filter';

/* ── 주입 가능한 브라우저 모양(Playwright 의 필요한 부분만). 테스트는 가짜를 넣는다 ── */
export interface ResponseLike { status(): number; headers(): Record<string, string> }
export interface FrameLike { content(): Promise<string> }
export interface PageLike {
  goto(url: string, opts?: Record<string, unknown>): Promise<ResponseLike | null>;
  waitForLoadState(state: string, opts?: Record<string, unknown>): Promise<void>;
  content(): Promise<string>;
  frames?(): FrameLike[];
  close(): Promise<void>;
}
export interface RouteLike {
  request(): { url(): string; resourceType(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
}
export interface ContextLike {
  route(pattern: string, handler: (route: RouteLike) => unknown): Promise<void>;
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}
export interface BrowserLike {
  newContext(opts?: Record<string, unknown>): Promise<ContextLike>;
  close(): Promise<void>;
}

export interface BrowserReaderOptions {
  /** 브라우저 띄우기. 비우면 Playwright(전용 Chromium → Edge → Chrome) */
  launch?: () => Promise<BrowserLike>;
  /** 쪽당 시간 제한 */
  perPageTimeoutMs?: number;
  /** 편당 총 시간 상한(처음 읽기 시작한 때부터). 넘으면 더 열지 않는다 */
  totalBudgetMs?: number;
  /** 동시에 여는 탭 수 */
  maxConcurrent?: number;
  /** 열지 않을 자기 사이트. 비우면 설정(WORDPRESS_SITE_URL·EXCLUDE_SOURCE_DOMAINS) + leadernam.com */
  ownSources?: string[];
  now?: () => number;
  onLog?: (message: string) => void;
}

export interface BrowserReadStats {
  launched: boolean;
  /** 브라우저를 못 띄운 이유(띄웠거나 아직 안 띄웠으면 null) */
  unavailable: string | null;
  /** 브라우저로 연 쪽 수 */
  opened: number;
  /** 그중 본문을 얻은 쪽 수 */
  ok: number;
  /** 총 시간 상한 때문에 안 연 쪽 수 */
  skippedForBudget: number;
  /** 자기 사이트라 안 연 쪽 수 */
  blocked: number;
  /** 처음 읽기 시작해서 지금까지(ms) */
  elapsedMs: number;
}

export interface BrowserReader {
  read(url: string, maxChars: number): Promise<PageFetchOutcome>;
  close(): Promise<void>;
  stats(): BrowserReadStats;
}

export const DEFAULT_PER_PAGE_TIMEOUT_MS = 15_000;
/** 편당 4분 — 계획서 D안. 넘으면 거기까지 읽은 것만 쓰고 글쓰기로 넘어간다 */
export const DEFAULT_TOTAL_BUDGET_MS = 240_000;
export const DEFAULT_MAX_CONCURRENT = 2;
/** 그려지기를 더 기다리는 시간(네트워크가 잠잠해질 때까지, 쪽당 남은 시간 안에서) */
const SETTLE_MS = 4_000;
/** 본문이 안쪽 틀(iframe)에 있을 때 들여다볼 틀 수 */
const MAX_FRAMES = 3;
/** 광고 달린 자기 사이트 — 설정이 비어 있어도 항상 막는다 */
const ALWAYS_OWN = ['leadernam.com'];

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
/** 광고·추적 호스트(접미사로 맞춘다). 본문과 무관하고, 열면 남의 광고 노출이 된다 */
const AD_HOST_SUFFIXES = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagmanager.com', 'googletagservices.com',
  'google-analytics.com', 'adservice.google.com', 'amazon-adsystem.com', 'adnxs.com', 'criteo.com', 'criteo.net',
  'taboola.com', 'outbrain.com', 'scorecardresearch.com', 'facebook.net', 'dable.io', 'mediacategory.com',
  'realclick.co.kr', 'adop.cc', 'wcs.naver.net', 'adcr.naver.com', 'veta.naver.com', 'ad.daum.net', 'kakaoad.com',
];

const hostOf = (url: string): string => (String(url || '').match(/^https?:\/\/([^/?#]+)/i)?.[1] || '').toLowerCase().replace(/:\d+$/, '');

/** 이 요청을 막는가 — 이미지·동영상·글꼴, 광고·추적 호스트 */
export function shouldBlockRequest(url: string, resourceType: string): boolean {
  if (BLOCKED_RESOURCE_TYPES.has(String(resourceType || ''))) return true;
  const host = hostOf(url);
  return !!host && AD_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

/**
 * 스위치(1단계: 숨김 스위치, 기본 꺼짐). 환경변수 BROWSER_READ=1 또는 payload.browserRead === true.
 * API 경로(orchestration)와 에이전트 모드(electron/main)가 **같은 함수**로 정한다 — 한쪽만 켜지는 조용한 미배선을 막는다.
 */
export function browserReadEnabled(env: Record<string, string | undefined> | undefined, payload: unknown): boolean {
  return env?.['BROWSER_READ'] === '1' || (payload as { browserRead?: unknown } | undefined)?.browserRead === true;
}

/** HTTP 결과를 보고 브라우저로 다시 열지. 열어도 결과가 같을 실패(첨부·잘못된 주소·HTML 아님·404 류)는 열지 않는다 */
const RETRY_REASONS = new Set<FetchFailureReason>(['EXTRACT_FAIL', 'EMPTY_BODY', 'BLOCKED', 'NETWORK', 'TIMEOUT', 'UNKNOWN']);
export function needsBrowser(outcome: PageFetchOutcome): boolean {
  if (outcome.doc) return false;
  return !!outcome.failure && RETRY_REASONS.has(outcome.failure.reason);
}

/** 기본 브라우저 — 이미 있는 폴백(전용 Chromium → Edge → Chrome → 설치)을 그대로 쓴다 */
async function launchDefault(onLog?: (m: string) => void): Promise<BrowserLike> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require('playwright');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { launchChromiumWithSystemFallback } = require('../../utils/playwright-browser-installer');
  return launchChromiumWithSystemFallback(chromium, { headless: true }, onLog);
}

type Timed<T> = { ok: true; value: T } | { ok: false };
/** p 가 ms 안에 끝나면 그 값, 아니면 { ok: false }. p 의 실패는 그대로 던진다 */
function within<T>(p: Promise<T>, ms: number): Promise<Timed<T>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve({ ok: false }), Math.max(1, ms));
    p.then((value) => { clearTimeout(timer); resolve({ ok: true, value }); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

export function createBrowserReader(options: BrowserReaderOptions = {}): BrowserReader {
  const perPage = options.perPageTimeoutMs ?? DEFAULT_PER_PAGE_TIMEOUT_MS;
  const total = options.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS;
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? DEFAULT_MAX_CONCURRENT);
  const own = options.ownSources ?? [...collectOwnSources(process.env as Record<string, string>), ...ALWAYS_OWN];
  const now = options.now ?? (() => Date.now());
  const launch = options.launch ?? (() => launchDefault(options.onLog));

  const st: BrowserReadStats = { launched: false, unavailable: null, opened: 0, ok: 0, skippedForBudget: 0, blocked: 0, elapsedMs: 0 };
  let startedAt: number | null = null;
  let closed = false;
  let starting: Promise<ContextLike | null> | null = null;
  let browser: BrowserLike | null = null;
  let context: ContextLike | null = null;

  const remaining = (): number => (startedAt === null ? total : total - (now() - startedAt));

  /** 처음 필요할 때 한 번만 띄운다. 못 띄우면 다시 시도하지 않는다(편마다 실패를 되풀이하지 않게) */
  const ensureContext = (): Promise<ContextLike | null> => {
    if (starting) return starting;
    starting = (async () => {
      try {
        const pending = launch();
        const launched = await within(pending, remaining());
        if (!launched.ok) {
          // 늦게라도 뜨면 바로 닫는다 — 아무도 안 쓰는 브라우저가 남지 않게
          pending.then((late) => late.close().catch(() => undefined), () => undefined);
          st.unavailable = '브라우저 띄우기가 총 시간 안에 끝나지 않음';
          return null;
        }
        browser = launched.value;
        if (closed) { await browser.close().catch(() => undefined); return null; }
        st.launched = true;
        context = await browser.newContext({ locale: 'ko-KR', acceptDownloads: false, javaScriptEnabled: true });
        await context.route('**/*', (route: RouteLike) => {
          const req = route.request();
          const url = req.url();
          // 자기 사이트로 넘겨지는(리다이렉트) 요청도 막는다
          return (shouldBlockRequest(url, req.resourceType()) || isOwnSource(url, own)) ? route.abort().catch(() => undefined) : route.continue().catch(() => undefined);
        });
        return context;
      } catch (e: unknown) {
        st.unavailable = String((e as { message?: string })?.message || e).slice(0, 160);
        options.onLog?.(`[리서치] 브라우저를 띄우지 못해 예전 방식(HTTP)으로 읽습니다: ${st.unavailable}`);
        return null;
      }
    })();
    return starting;
  };

  /* ── 동시 탭 수와 사이트별 한 번에 하나 ── */
  let active = 0;
  const waiters: Array<() => void> = [];
  const acquire = async (): Promise<void> => {
    if (active < maxConcurrent) { active += 1; return; }
    await new Promise<void>((resolve) => waiters.push(resolve));   // 자리는 release 가 그대로 넘겨준다
  };
  const release = (): void => {
    const next = waiters.shift();
    if (next) next(); else active -= 1;
  };
  const hostTail = new Map<string, Promise<void>>();

  const fail = (reason: FetchFailureReason, detail?: string, status?: number): PageFetchOutcome => ({
    doc: null, failure: { reason, ...(detail ? { detail } : {}), ...(status ? { status } : {}) }, attemptedAt: new Date().toISOString(),
  });

  const openAndRead = async (ctx: ContextLike, url: string, maxChars: number): Promise<PageFetchOutcome> => {
    const attemptedAt = new Date().toISOString();
    const limit = Math.min(perPage, remaining());
    if (limit <= 0) { st.skippedForBudget += 1; return fail('TIMEOUT', `총 시간 상한 ${Math.round(total / 1000)}초를 넘어 열지 않음`); }
    let page: PageLike | null = null;
    st.opened += 1;
    try {
      const deadline = now() + limit;
      const left = () => Math.max(1, deadline - now());
      const opened = await within(ctx.newPage(), left());
      if (!opened.ok) return fail('TIMEOUT', `${limit}ms`);
      page = opened.value;
      const nav = await within(page.goto(url, { waitUntil: 'domcontentloaded', timeout: left() }), left());
      if (!nav.ok) return fail('TIMEOUT', `${limit}ms`);
      const res = nav.value;
      if (res) {
        const status = res.status();
        if (status >= 400) return fail(status === 403 || status === 429 ? 'BLOCKED' : 'HTTP_STATUS', `HTTP ${status}`, status);
        const type = String(res.headers()['content-type'] || '');
        if (type && !/text\/html|application\/xhtml/i.test(type)) return fail('UNSUPPORTED_CONTENT', type.slice(0, 60));
      }
      // 그려지기를 조금 더 기다린다 — 안 잠잠해져도 지금까지 그려진 화면으로 읽는다
      await within(page.waitForLoadState('networkidle', { timeout: Math.min(SETTLE_MS, left()) }).catch(() => undefined), Math.min(SETTLE_MS, left()));
      const html = await within(page.content(), left());
      if (!html.ok) return fail('TIMEOUT', `${limit}ms`);
      let parsed = documentFromHtml(html.value, maxChars);
      if (!parsed.doc && typeof page.frames === 'function') {
        // 본문이 안쪽 틀(iframe)에 있는 기관 게시판 — 첫 틀은 바깥 화면 자신이다
        for (const frame of page.frames().slice(1, 1 + MAX_FRAMES)) {
          const inner = await within(frame.content().catch(() => ''), left());
          if (!inner.ok || !inner.value) continue;
          const tried = documentFromHtml(inner.value, maxChars);
          if (tried.doc) { parsed = tried; break; }
        }
      }
      if (parsed.doc) st.ok += 1;
      return { ...parsed, attemptedAt };
    } catch (e: unknown) {
      const msg = String((e as { message?: string })?.message || e).slice(0, 120);
      if (/timeout/i.test(msg)) return fail('TIMEOUT', msg);
      if (/download/i.test(msg)) return fail('UNSUPPORTED_CONTENT', msg);
      if (/ERR_(NAME|CONNECTION|CERT|SSL|INTERNET|ADDRESS)/i.test(msg)) return fail('NETWORK', msg);
      return fail('UNKNOWN', msg);
    } finally {
      if (page) await within(page.close().catch(() => undefined), 3_000);
    }
  };

  return {
    async read(url: string, maxChars: number): Promise<PageFetchOutcome> {
      const target = String(url || '').trim();
      if (!/^https?:\/\//i.test(target)) return fail('INVALID_URL');
      if (isOwnSource(target, own)) { st.blocked += 1; return fail('BLOCKED', '자기 사이트 — 브라우저로 열지 않음(무효 트래픽 방지)'); }
      if (closed) return fail('UNKNOWN', '브라우저 읽기가 이미 끝남');
      if (startedAt === null) startedAt = now();
      if (remaining() <= 0) { st.skippedForBudget += 1; return fail('TIMEOUT', `총 시간 상한 ${Math.round(total / 1000)}초를 넘어 열지 않음`); }

      const ctx = await ensureContext();
      if (!ctx) return fail('UNKNOWN', `브라우저 없음: ${st.unavailable || '알 수 없음'}`);

      const host = hostOf(target);
      const prev = hostTail.get(host) || Promise.resolve();
      let done: () => void = () => undefined;
      const mine = new Promise<void>((resolve) => { done = resolve; });
      hostTail.set(host, prev.then(() => mine));
      await prev;
      await acquire();
      try {
        return await openAndRead(ctx, target, maxChars);
      } finally {
        release();
        done();
      }
    },
    async close(): Promise<void> {
      closed = true;
      if (startedAt !== null) st.elapsedMs = now() - startedAt;
      // 띄우는 중이면 끝나기를 잠깐 기다렸다 닫는다(뜨는 중에 닫혀 남는 브라우저가 없게)
      if (starting) await within(starting.catch(() => null), 5_000).catch(() => undefined);
      const ctx = context as ContextLike | null;
      const b = browser as BrowserLike | null;
      context = null; browser = null;
      if (ctx) await within(ctx.close().catch(() => undefined), 5_000);
      if (b) await within(b.close().catch(() => undefined), 5_000);
    },
    stats(): BrowserReadStats {
      return { ...st, elapsedMs: startedAt === null ? 0 : (closed ? st.elapsedMs : now() - startedAt) };
    },
  };
}

/**
 * HTTP 먼저, 모자라면 브라우저. **어느 경우에도 HTTP 결과보다 나빠지지 않는다** —
 * 브라우저가 본문을 못 얻으면 HTTP 의 결과(실패 사유 포함)를 그대로 돌려준다.
 */
export async function readWithBrowserFallback(
  url: string,
  maxChars: number,
  http: (url: string, maxChars: number) => Promise<PageFetchOutcome>,
  reader: BrowserReader,
): Promise<PageFetchOutcome & { via: 'http' | 'browser' }> {
  const first = await http(url, maxChars);
  if (!needsBrowser(first)) return { ...first, via: 'http' };
  const second = await reader.read(url, maxChars);
  return second.doc ? { ...second, via: 'browser' } : { ...first, via: 'http' };
}

/** 로그·보고용 한 줄 */
export function describeBrowserRead(s: BrowserReadStats & { rescued?: number }): string {
  if (!s.launched) return s.unavailable ? `브라우저 정독: 브라우저를 못 띄워 예전 방식으로 읽음(${s.unavailable})` : '브라우저 정독: HTTP 로 다 읽혀 브라우저를 안 띄움';
  const parts = [`브라우저로 ${s.opened}쪽 열어 ${s.ok}쪽 본문 확보`];
  if (typeof s.rescued === 'number') parts.push(`근거에 들어간 것 ${s.rescued}쪽`);
  if (s.skippedForBudget) parts.push(`시간 상한으로 안 연 것 ${s.skippedForBudget}쪽`);
  if (s.blocked) parts.push(`자기 사이트라 안 연 것 ${s.blocked}쪽`);
  parts.push(`${Math.round(s.elapsedMs / 1000)}초`);
  return `브라우저 정독: ${parts.join(' · ')}`;
}
