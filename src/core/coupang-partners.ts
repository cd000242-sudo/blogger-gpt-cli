/**
 * 쿠팡 파트너스 오픈 API 클라이언트
 *
 * 공식 문서: https://developers.coupangcorp.com/hc/ko/articles/360033693373
 *
 * 인증: HMAC-SHA256 서명
 * - 메시지: `{signedDate} {METHOD} {path}{query}`
 * - 서명일자 포맷: `YYMMDDTHHmmssZ` (UTC)
 * - Authorization: `CEA algorithm=HmacSHA256, access-key={AK}, signed-date={DATE}, signature={SIG}`
 *
 * 지원 엔드포인트:
 * - 상품 검색: POST /v2/providers/affiliate_open_api/apis/openapi/v1/products/search
 * - 딥링크 생성: POST /v2/providers/affiliate_open_api/apis/openapi/v1/deeplink
 */

import axios from 'axios';
import * as crypto from 'crypto';

const HOST = 'https://api-gateway.coupang.com';

export interface CoupangProduct {
  productId: string;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  keyword?: string;
  rank?: number;
  isRocket?: boolean;
  isFreeShipping?: boolean;
  categoryName?: string;
}

export interface CoupangDeeplink {
  originalUrl: string;
  shortenUrl: string;
  landingUrl: string;
}

/**
 * HMAC-SHA256 서명 생성
 */
function generateHmacSignature(
  method: string,
  urlPath: string,
  secretKey: string,
  accessKey: string
): { authorization: string; signedDate: string } {
  // UTC 시간을 YYMMDDTHHmmssZ 포맷으로
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const signedDate = `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;

  // path와 query 분리
  const [path, query = ''] = urlPath.split('?');
  const message = `${signedDate}${method}${path}${query}`;

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${signedDate}, signature=${signature}`;

  return { authorization, signedDate };
}

/**
 * 쿠팡 파트너스 상품 검색
 *
 * 키워드로 상품을 검색해서 실제 상품명, 가격, 이미지, 평점, 제휴링크를 반환
 * 쇼핑 모드에서 할루시네이션을 방지하기 위한 핵심 데이터 소스
 */
export async function searchCoupangProducts(
  keyword: string,
  accessKey: string,
  secretKey: string,
  limit: number = 10
): Promise<CoupangProduct[]> {
  if (!accessKey || !secretKey) {
    throw new Error('쿠팡 파트너스 API 키가 설정되지 않았습니다.');
  }

  const encodedKeyword = encodeURIComponent(keyword);
  const urlPath = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?keyword=${encodedKeyword}&limit=${limit}`;

  const { authorization } = generateHmacSignature('GET', urlPath, secretKey, accessKey);

  try {
    const response = await axios.get(`${HOST}${urlPath}`, {
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json;charset=UTF-8',
      },
      timeout: 10000,
    });

    const data = response.data?.data;
    if (!data || !Array.isArray(data.productData)) {
      console.log('[COUPANG-API] ⚠️ 검색 결과 없음 또는 응답 형식 오류');
      return [];
    }

    return data.productData.map((item: any, idx: number) => ({
      productId: String(item.productId || ''),
      productName: String(item.productName || ''),
      productPrice: Number(item.productPrice || 0),
      productImage: String(item.productImage || ''),
      productUrl: String(item.productUrl || ''),
      keyword: item.keyword || keyword,
      rank: idx + 1,
      isRocket: Boolean(item.isRocket),
      isFreeShipping: Boolean(item.isFreeShipping),
      categoryName: String(item.categoryName || ''),
    }));
  } catch (err: any) {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`[COUPANG-API] ❌ 상품 검색 실패 (status: ${status}):`, body || err.message);

    // 권한/자격 관련 에러를 사용자 친화적으로
    if (status === 401 || status === 403) {
      throw new Error('쿠팡 파트너스 API 인증 실패. ACCESS_KEY/SECRET_KEY를 확인하세요. (오픈 API는 실적 조건 충족 후 발급됩니다)');
    }
    throw new Error(`쿠팡 파트너스 API 호출 실패: ${err.message}`);
  }
}

/**
 * 쿠팡 파트너스 딥링크 생성
 *
 * 일반 쿠팡 상품 URL을 제휴 링크로 변환
 * 사용자가 직접 상품 URL을 입력했을 때 수익화 링크로 자동 변환
 */
export async function createCoupangDeeplink(
  urls: string[],
  accessKey: string,
  secretKey: string
): Promise<CoupangDeeplink[]> {
  if (!accessKey || !secretKey) {
    throw new Error('쿠팡 파트너스 API 키가 설정되지 않았습니다.');
  }
  if (!urls || urls.length === 0) return [];

  const urlPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  const { authorization } = generateHmacSignature('POST', urlPath, secretKey, accessKey);

  try {
    const response = await axios.post(
      `${HOST}${urlPath}`,
      { coupangUrls: urls },
      {
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json;charset=UTF-8',
        },
        timeout: 10000,
      }
    );

    const data = response.data?.data;
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      originalUrl: String(item.originalUrl || ''),
      shortenUrl: String(item.shortenUrl || ''),
      landingUrl: String(item.landingUrl || ''),
    }));
  } catch (err: any) {
    const status = err.response?.status;
    console.error(`[COUPANG-API] ❌ 딥링크 생성 실패 (status: ${status}):`, err.message);
    if (status === 401 || status === 403) {
      throw new Error('쿠팡 파트너스 API 인증 실패. API 키를 확인하세요.');
    }
    throw new Error(`쿠팡 딥링크 생성 실패: ${err.message}`);
  }
}

/**
 * 상품 데이터를 프롬프트용 Markdown으로 포맷팅
 * AI가 할루시네이션 없이 실제 상품 정보를 사용하도록
 */
export function formatProductsForPrompt(products: CoupangProduct[]): string {
  if (!products || products.length === 0) return '';

  const lines = products.map((p, i) => {
    const price = p.productPrice > 0 ? `${p.productPrice.toLocaleString()}원` : '가격 문의';
    const rocket = p.isRocket ? ' [로켓배송]' : '';
    const freeShip = p.isFreeShipping ? ' [무료배송]' : '';
    return `${i + 1}. **${p.productName}**
   - 가격: ${price}${rocket}${freeShip}
   - 카테고리: ${p.categoryName || '미분류'}
   - 이미지: ${p.productImage}
   - 제휴링크: ${p.productUrl}`;
  });

  return `\n===== 쿠팡 파트너스 실제 상품 데이터 =====\n${lines.join('\n\n')}\n=====\n\n⚠️ 위 상품 정보(상품명, 가격, 이미지 URL, 제휴링크)는 실제 데이터입니다. 비교표/스펙 카드 작성 시 반드시 위 정보를 그대로 사용하고, 없는 제품을 만들어내지 마세요.\n`;
}

/**
 * 쿠팡 상품 데이터를 최종 HTML 블록으로 렌더링 — 실제 제휴링크를 포함한 추천 상품 카드
 * AI가 본문에 링크를 안 붙여도 이 블록이 무조건 최종 HTML에 들어가므로 수익 누수 방지
 */
export function renderCoupangProductBlock(products: CoupangProduct[]): string {
  if (!products || products.length === 0) return '';
  const top = products.slice(0, 6);
  const cards = top.map((p, i) => {
    const price = p.productPrice > 0 ? `${p.productPrice.toLocaleString()}원` : '가격 확인';
    const badges: string[] = [];
    if (p.isRocket) badges.push('<span style="background:#0074E4;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;margin-right:6px;">로켓배송</span>');
    if (p.isFreeShipping) badges.push('<span style="background:#00C73C;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;">무료배송</span>');
    const badgeHtml = badges.length > 0 ? `<div style="margin:8px 0;">${badges.join('')}</div>` : '';
    const safeName = (p.productName || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const safeUrl = (p.productUrl || '').replace(/"/g, '&quot;');
    const safeImg = (p.productImage || '').replace(/"/g, '&quot;');
    return `
<div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px;background:#fff;display:flex;gap:16px;align-items:flex-start;">
  <a href="${safeUrl}" target="_blank" rel="nofollow sponsored noopener" style="flex-shrink:0;">
    <img src="${safeImg}" alt="${safeName}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;display:block;" loading="lazy" />
  </a>
  <div style="flex:1;min-width:0;">
    <div style="font-size:13px;color:#9ca3af;margin-bottom:4px;">추천 ${i + 1}위</div>
    <a href="${safeUrl}" target="_blank" rel="nofollow sponsored noopener" style="font-size:16px;font-weight:700;color:#111827;text-decoration:none;line-height:1.4;display:block;margin-bottom:8px;">${safeName}</a>
    ${badgeHtml}
    <div style="font-size:20px;font-weight:800;color:#ef4444;margin:8px 0;">${price}</div>
    <a href="${safeUrl}" target="_blank" rel="nofollow sponsored noopener" style="display:inline-block;background:#ff6b35;color:#fff;font-size:14px;font-weight:700;padding:10px 20px;border-radius:8px;text-decoration:none;">쿠팡에서 가격 확인 →</a>
  </div>
</div>`;
  }).join('');

  return `
<div class="coupang-product-showcase" style="margin:48px 0;padding:24px;background:#f9fafb;border-radius:16px;">
  <h2 style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;padding:0;border:none;">🛒 추천 상품 한눈에 보기</h2>
  <p style="font-size:13px;color:#6b7280;margin:0 0 20px;">아래 상품은 쿠팡 파트너스 활동의 일환으로, 일정액의 수수료를 제공받습니다.</p>
  ${cards}
</div>
`;
}

// ═══════════════════════════════════════════════════════════════════
// 🔗 수동 URL 기반 상품 크롤러 (API 키 없이도 사용 가능)
// ═══════════════════════════════════════════════════════════════════
// 쿠팡 파트너스 API 키 발급 조건(누적 매출 15만원)을 충족하기 전에도
// 사용자가 대시보드에서 수동 생성한 딥링크를 그대로 활용할 수 있도록 지원.
//
// 흐름:
//   1) URL 입력 (일반 상품 URL / link.coupang.com / coupa.ng 단축링크 가능)
//   2) redirect 따라가며 실제 상품 페이지 HTML 획득
//   3) og:meta + JSON-LD + DOM 정규식으로 상품 정보 추출
//   4) CoupangProduct 형식으로 반환 (productUrl 은 사용자 입력 원본 유지)
// ═══════════════════════════════════════════════════════════════════

const COUPANG_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function isCoupangUrl(url: string): boolean {
  return /^https?:\/\/([\w.-]+\.)?(coupang\.com|coupa\.ng)\//i.test(url);
}

function extractProductIdFromUrl(url: string): string {
  const m = url.match(/\/products\/(\d+)/) || url.match(/productId=(\d+)/);
  return m ? m[1]! : '';
}

function extractPriceFromHtml(html: string): number {
  // 1) JSON-LD 먼저 시도 (제일 신뢰도 높음)
  const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatches) {
    for (const raw of jsonLdMatches) {
      const inner = raw.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      try {
        const obj = JSON.parse(inner);
        const offers = Array.isArray(obj) ? obj.flatMap((o: any) => o.offers || []) : (obj.offers || []);
        const offersArr = Array.isArray(offers) ? offers : [offers];
        for (const o of offersArr) {
          const p = Number(o?.price ?? o?.lowPrice ?? o?.highPrice ?? 0);
          if (p > 0) return Math.round(p);
        }
      } catch { /* 다음 블록 시도 */ }
    }
  }

  // 2) DOM 정규식 폴백
  const patterns = [
    /"salePrice"\s*:\s*(\d+)/,
    /"productPrice"\s*:\s*(\d+)/,
    /"price"\s*:\s*"?(\d[\d,]*)/,
    /class="[^"]*total-price[^"]*"[^>]*>[\s\S]*?<strong>([\d,]+)/i,
    /class="[^"]*prod-price[^"]*"[^>]*>[\s\S]*?([\d,]+)\s*원/i,
    /class="[^"]*price-value[^"]*"[^>]*>\s*([\d,]+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) {
      const num = Number(m[1].replace(/,/g, ''));
      if (num > 0 && num < 100_000_000) return num;
    }
  }
  return 0;
}

function extractMetaFromHtml(html: string, property: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  if (m) return m[1]!;
  // content 가 먼저 오는 경우도 대응
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i');
  const m2 = html.match(re2);
  return m2 ? m2[1]! : '';
}

function extractRocketFromHtml(html: string): boolean {
  return /로켓배송|rocket-?shipping|badge-rocket|data-rocket="true"/i.test(html);
}

function extractFreeShippingFromHtml(html: string): boolean {
  return /무료배송|free[-_ ]?shipping/i.test(html);
}

/**
 * 쿠팡 상품 페이지에서 상품 정보 추출
 * - 1단계: axios + UA 위장으로 HTML 가져오기
 * - 2단계: 데이터 부족하면 Playwright 로 폴백 (JS 렌더 후 재파싱)
 * - 가격을 못 얻으면 isPriceKnown=false 로 반환 (할루시 방지 가드 작동)
 */
export async function crawlCoupangProductFromUrl(inputUrl: string): Promise<CoupangProduct & { isPriceKnown: boolean }> {
  if (!inputUrl || !isCoupangUrl(inputUrl)) {
    throw new Error(`쿠팡 URL 형식이 아닙니다: ${inputUrl}`);
  }

  // 1단계 — 정적 HTML 파싱
  let html = '';
  let finalUrl = inputUrl;
  try {
    const res = await axios.get(inputUrl, {
      headers: {
        'User-Agent': COUPANG_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 12000,
      maxRedirects: 5,
      validateStatus: s => s >= 200 && s < 400,
    });
    html = String(res.data || '');
    finalUrl = String(res.request?.res?.responseUrl || inputUrl);
  } catch (err: any) {
    console.log(`[COUPANG-CRAWL] ⚠️ 정적 요청 실패 (${err.message?.slice(0, 60)}) → Playwright 폴백`);
  }

  // 1단계 파싱
  let title = extractMetaFromHtml(html, 'og:title') || extractMetaFromHtml(html, 'twitter:title');
  let image = extractMetaFromHtml(html, 'og:image') || extractMetaFromHtml(html, 'twitter:image');
  let price = extractPriceFromHtml(html);
  let isRocket = extractRocketFromHtml(html);
  let isFreeShipping = extractFreeShippingFromHtml(html);

  // 2단계 — 데이터 부족 시 Playwright 폴백
  const needFallback = !title || !image || price === 0;
  if (needFallback) {
    try {
      console.log(`[COUPANG-CRAWL] 🎭 Playwright 폴백 시도 (title:${!!title} img:${!!image} price:${price})`);
      const { chromium } = await import('playwright') as any;
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      });
      try {
        const ctx = await browser.newContext({
          userAgent: COUPANG_UA,
          viewport: { width: 1280, height: 900 },
          locale: 'ko-KR',
        });
        const page = await ctx.newPage();
        await page.goto(inputUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        // 가격이 JS 렌더 후 나타나는 경우 짧게 대기
        try {
          await page.waitForSelector('meta[property="og:title"], .total-price, .prod-price, .prod-price-amount', { timeout: 8000 });
        } catch { /* 타임아웃 무시, 현재 HTML로 계속 진행 */ }
        const rendered = await page.content();
        html = rendered;
        finalUrl = page.url();
        title = title || extractMetaFromHtml(rendered, 'og:title') || (await page.title().catch(() => ''));
        image = image || extractMetaFromHtml(rendered, 'og:image');
        if (price === 0) price = extractPriceFromHtml(rendered);
        isRocket = isRocket || extractRocketFromHtml(rendered);
        isFreeShipping = isFreeShipping || extractFreeShippingFromHtml(rendered);
      } finally {
        await browser.close().catch(() => {});
      }
    } catch (pwErr: any) {
      console.log(`[COUPANG-CRAWL] ⚠️ Playwright 폴백 실패: ${pwErr.message?.slice(0, 80)}`);
    }
  }

  // 제목·이미지 둘 다 없으면 실패 — throw
  if (!title) {
    throw new Error(`상품 정보 추출 실패: 제목을 찾을 수 없습니다 (${inputUrl})`);
  }

  const productId = extractProductIdFromUrl(finalUrl) || extractProductIdFromUrl(inputUrl);

  return {
    productId,
    productName: title.replace(/\s*\|\s*쿠팡.*$/i, '').trim(),
    productPrice: price,
    productImage: image,
    productUrl: inputUrl,  // 🔑 중요: 사용자 입력 URL(제휴 딥링크) 그대로 유지 — 수익 귀속
    keyword: '',
    rank: 0,
    isRocket,
    isFreeShipping,
    categoryName: '',
    isPriceKnown: price > 0,
  };
}

/**
 * 여러 URL 을 병렬 크롤링. 실패한 URL 은 경고 로그만 남기고 건너뜀.
 */
export async function crawlCoupangProductsFromUrls(urls: string[], onLog?: (msg: string) => void): Promise<CoupangProduct[]> {
  if (!urls || urls.length === 0) return [];
  const validUrls = urls.filter(u => u && typeof u === 'string' && isCoupangUrl(u));
  if (validUrls.length === 0) {
    onLog?.('⚠️ 유효한 쿠팡 URL 이 하나도 없습니다.');
    return [];
  }
  onLog?.(`🛒 쿠팡 URL ${validUrls.length}개 크롤링 시작...`);
  const results = await Promise.allSettled(validUrls.map(u => crawlCoupangProductFromUrl(u)));
  const products: CoupangProduct[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const { isPriceKnown, ...product } = r.value;
      product.rank = i + 1;
      products.push(product);
      onLog?.(`   ✅ [${i + 1}] ${product.productName.slice(0, 40)}... ${isPriceKnown ? `(${product.productPrice.toLocaleString()}원)` : '(가격 미확인)'}`);
    } else {
      onLog?.(`   ⚠️ [${i + 1}] 실패: ${(r.reason?.message || '').slice(0, 80)}`);
    }
  });
  onLog?.(`✅ 수동 URL 크롤링 완료: ${products.length}/${validUrls.length}개 성공`);
  return products;
}
