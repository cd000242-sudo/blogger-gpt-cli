/**
 * 제휴 링크 → 상품 정보 추출 (v3.8.395)
 *
 * ── Phase 0 실측 (2026-08-01, 사용자 실제 링크로 확인) ──
 *
 * 토스쇼핑 쉐어링크
 *   toss.im/_m/{code} --302--> toss.shopping/t/{id}?k={uuid}&referrer=affiliate
 *   정적 HTML 에 og:title / og:image / og:description 전부 있음 → **Playwright 불필요**
 *   ⚠️ 가격은 정적·렌더 모두 없음 (본문 419자에 원화 패턴 0). 앱 전용으로 보인다.
 *      → 가격은 "없음" 으로 두고 **절대 추정하지 않는다.**
 *   og:description 에 배송·판매자 정보가 들어온다:
 *      "몽크로스 초강력 바디팬, 다크그레이, 2개, 8월 5일 도착 예정. 베스트 판매자"
 *
 * 네이버 쇼핑 커넥트
 *   naver.me/{code} --307--> brandconnect.naver.com/affiliates/{id}?channelProductNo={no}
 *                   --JS--> smartstore.naver.com/{store}/products/{no}?NaPm=...
 *   브리지 페이지는 0.9KB 빈 셸(Vite SPA) → **Playwright 필수**
 *   ⚠️ 스토어명({store})은 렌더 전에는 알 수 없다. channelProductNo 만으로 URL 을 만들면
 *      로그인 페이지로 튕긴다(실측: nid.naver.com/nidlogin.login 리다이렉트).
 *   렌더 후에는 og:title / og:image / 본문 가격 전부 확보됨. 로그인벽 없음.
 *
 * ⚠️ 링크 변조 금지 — 토스 정책: "제공하지 않은 링크를 임의로 수정하면 계약 해지".
 *   따라서 **본문에 넣는 링크는 사용자가 준 원본**이고, 크롤은 최종 URL 에서만 한다.
 */
import { AffiliateProviderId, getPolicy } from './policies';

export interface AffiliateProduct {
  provider: AffiliateProviderId;
  /** 본문에 넣을 링크 — 사용자가 준 원본 그대로 (절대 변조 금지) */
  originalUrl: string;
  /** 크롤에 사용한 최종 URL (진단용, 본문에는 쓰지 않는다) */
  resolvedUrl: string;
  title: string;
  imageUrl: string;
  description: string;
  /** 확인된 가격만. 모르면 null — 추정하지 않는다 */
  priceKrw: number | null;
  /** 가격을 못 얻은 이유 (UI 안내용) */
  priceNote: string;
}

export interface CrawlOptions {
  timeoutMs?: number;
  // exactOptionalPropertyTypes — 호출부가 undefined 를 그대로 넘길 수 있게 열어둔다
  onLog?: ((msg: string) => void) | undefined;
  /** 테스트 주입용 */
  fetchImpl?: typeof fetch | undefined;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * HTML 엔티티를 실제 문자로 되돌린다.
 * 실측(2026-08-01): 네이버 og:description 이 "&#40;주&#41;쇼마젠시" 로 들어왔다.
 * 이대로 본문에 넣으면 독자에게 "&#40;주&#41;" 가 그대로 보인다.
 */
export function decodeEntities(value: string): string {
  return String(value || '')
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')   // 마지막에 — 먼저 풀면 이중 디코딩이 된다
    .replace(/\s+/g, ' ')
    .trim();
}

export function readMeta(html: string, prop: string): string {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pats = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return '';
}

/** 텍스트에서 원화 금액을 뽑는다. 확신할 수 없으면 null (추정 금지). */
export function extractPriceKrw(text: string): number | null {
  const hits = String(text || '').match(/([0-9][0-9,]{2,})\s*원/g) || [];
  if (hits.length === 0) return null;
  // 가장 큰 값이 아니라 **가장 먼저 나오는 값**을 쓴다.
  //   상품 페이지는 판매가를 앞에, 적립/쿠폰 등 부수 금액을 뒤에 둔다.
  const first = hits[0]!.replace(/[^\d]/g, '');
  const n = Number(first);
  return Number.isFinite(n) && n >= 100 ? n : null;
}

/** 토스 — 정적 fetch 로 충분하다 (실측 확인) */
async function crawlToss(url: string, opts: CrawlOptions): Promise<AffiliateProduct> {
  const doFetch = opts.fetchImpl || fetch;
  const res = await doFetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
  });
  const html = await res.text();
  const resolvedUrl = (res as any).url || url;

  const rawTitle = readMeta(html, 'og:title');
  return {
    provider: 'toss-sharelink',
    originalUrl: url,
    resolvedUrl,
    // "몽크로스 초강력 바디팬, 다크그레이, 2개 | 토스쇼핑" → 사이트명 꼬리 제거
    title: rawTitle.replace(/\s*\|\s*토스쇼핑\s*$/i, '').trim(),
    imageUrl: readMeta(html, 'og:image'),
    description: readMeta(html, 'og:description'),
    priceKrw: null,
    priceNote: '토스쇼핑은 웹 페이지에 가격을 노출하지 않습니다(실측 확인). 가격은 본문에 쓰지 않습니다.',
  };
}

/** 네이버 — 브리지가 JS 리다이렉트라 렌더가 필요하다 (실측 확인) */
async function crawlNaver(url: string, opts: CrawlOptions): Promise<AffiliateProduct> {
  const { chromium } = require('playwright');
  // v3.8.395: GPU 안전 인자 필수. 이 인자 없이 띄웠다가 사용자 PC 가 하루 3번
  //   블루스크린(0x10E VIDEO_MEMORY_MANAGEMENT_INTERNAL)으로 재부팅됐다.
  //   Intel Iris Xe 드라이버가 2023-06-15 판이라 최신 Chromium 과 충돌한다.
  const { CHROMIUM_GPU_SAFE_ARGS } = require('../../utils/chromium-safe-args');
  const browser = await chromium.launch({ headless: true, args: [...CHROMIUM_GPU_SAFE_ARGS] });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: 'ko-KR',
      viewport: { width: 390, height: 844 },   // 브랜드커넥트는 모바일 전제
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? 45000 })
      .catch(() => { /* SPA 리다이렉트 중일 수 있다 — 아래 대기로 흡수 */ });
    await page.waitForTimeout(9000);   // 브리지 → 스마트스토어 리다이렉트 대기

    const info = await page.evaluate(() => {
      const m = (p: string) => document.querySelector(
        `meta[property="${p}"], meta[name="${p}"]`,
      )?.getAttribute('content') || '';
      return {
        url: location.href,
        title: m('og:title') || document.title,
        image: m('og:image'),
        desc: m('og:description'),
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
      };
    });

    const price = extractPriceKrw(info.text);
    // DOM 에서 읽어도 이중 인코딩된 값이 올 수 있다 (실측: "&#40;주&#41;쇼마젠시")
    const title = decodeEntities(info.title);
    return {
      provider: 'naver-shopping-connect',
      originalUrl: url,
      resolvedUrl: info.url,
      // "상품명 : 스토어명" 형태에서 스토어명 꼬리를 떼되, 제목이 통째로 날아가면 원본을 쓴다
      title: title.replace(/\s*:\s*[^:]{1,40}$/, '').trim() || title,
      imageUrl: info.image,
      description: decodeEntities(info.desc),
      priceKrw: price,
      priceNote: price ? '' : '상품 페이지에서 가격을 확인하지 못했습니다. 본문에 가격을 쓰지 않습니다.',
    };
  } finally {
    await browser.close().catch(() => { /* noop */ });
  }
}

/** 쿠팡은 기존 coupang-partners.ts 가 담당한다 — 여기서 중복 구현하지 않는다. */
export function isSupportedForCrawl(provider: AffiliateProviderId): boolean {
  return provider === 'toss-sharelink' || provider === 'naver-shopping-connect';
}

/**
 * 제휴 링크에서 상품 정보를 얻는다. 실패하면 null — 절대 throw 하지 않는다.
 * (발행을 막지 않는다는 원칙. 상품 정보가 없어도 링크와 고지문만으로 글은 나간다.)
 */
export async function crawlAffiliateLink(
  url: string,
  opts: CrawlOptions = {},
): Promise<AffiliateProduct | null> {
  const clean = String(url || '').trim();
  if (!/^https?:\/\//i.test(clean)) return null;

  // 링크 호스트로 제휴사 판정
  const provider = (['toss-sharelink', 'naver-shopping-connect'] as AffiliateProviderId[])
    .find((id) => getPolicy(id)!.linkHosts.test(clean));
  if (!provider) {
    opts.onLog?.(`   [제휴] 지원하지 않는 링크 — 건너뜀: ${clean.slice(0, 50)}`);
    return null;
  }

  try {
    const t0 = Date.now();
    const product = provider === 'toss-sharelink'
      ? await crawlToss(clean, opts)
      : await crawlNaver(clean, opts);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);

    if (!product.title) {
      opts.onLog?.(`   [제휴] 상품명을 얻지 못했습니다 (${sec}초) — 링크만 사용합니다`);
      return null;
    }
    opts.onLog?.(
      `   [제휴] ${getPolicy(provider)!.label} · "${product.title.slice(0, 30)}"`
      + `${product.priceKrw ? ` · ${product.priceKrw.toLocaleString('ko-KR')}원` : ' · 가격 미확인'} (${sec}초)`,
    );
    return product;
  } catch (error: any) {
    opts.onLog?.(`   [제휴] 상품 조회 실패 — 링크만 사용합니다: ${String(error?.message || error).slice(0, 60)}`);
    return null;
  }
}

/**
 * 여러 링크를 병렬로 처리한다.
 * 네이버는 링크당 9초가 걸리므로 순차로 하면 3개에 27초다. 병렬이 필수다.
 * 동시 실행 수는 제한한다(브라우저 인스턴스가 늘면 메모리가 튄다).
 */
export async function crawlAffiliateLinks(
  urls: string[],
  opts: CrawlOptions & { concurrency?: number } = {},
): Promise<AffiliateProduct[]> {
  const list = (Array.isArray(urls) ? urls : []).map(u => String(u || '').trim()).filter(Boolean);
  if (list.length === 0) return [];
  const limit = Math.max(1, Math.min(opts.concurrency ?? 3, 5));

  const out: AffiliateProduct[] = [];
  for (let i = 0; i < list.length; i += limit) {
    const batch = list.slice(i, i + limit);
    const settled = await Promise.allSettled(batch.map(u => crawlAffiliateLink(u, opts)));
    settled.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) out.push(r.value);
    });
  }
  return out;
}
