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
  /**
   * v3.8.438 — 실제 구매자 후기.
   *
   * 사용자 지적(2026-08-03): "링크 타고가니까 리뷰 1330개나 있는데 뭐가없다는건지"
   * 맞는 지적이었다. 토스는 상품 페이지에 **schema.org JSON-LD** 로 후기를 그대로
   * 심어놓는데(aggregateRating + review[]), 우리는 og 메타 3개만 읽고 있었다.
   * 후기가 없다고 판단해 "상품군 일반 관심사"로 글을 쓰니 뻔한 글이 나왔다.
   */
  reviews?: Array<{ author: string; rating: number | null; body: string }>;
  /** 전체 후기 수 (페이지에 표시된 값) */
  reviewCount?: number | undefined;
  /** 평균 평점 */
  ratingValue?: number | undefined;
  /**
   * v3.8.431 — 상세정보(인포그래픽) 이미지 주소들. 토스/네이버 전용.
   *
   * 한국 쇼핑몰 상세페이지는 글자 없는 **이미지 몇 장**인 경우가 많다.
   * 그 안에 스펙·크기·사용법이 다 들어 있는데 지금까지는 og:image 한 장만
   * 가져와서 그 정보를 통째로 버렸다. 여기 모아두면 vision 으로 읽어
   * 본문에 반영하고, 소제목에 어울리는 사진으로 배치할 수 있다.
   *
   * ⚠️ best-effort 다. 못 모아도 발행은 그대로 진행된다.
   */
  detailImageUrls?: string[];
}

/**
 * 상세 이미지 후보에서 명백한 비-상품 이미지를 걸러낸다.
 *
 * ⚠️ v3.8.441 — **확장자로 거르지 않는다.** 특히 .gif 를 막지 말 것.
 *   사용자 판단: "제품을 사용하는 gif라면 분명 큰도움이 되니까".
 *   실측(토스 연탄불고기)에서 수집한 15장 중 6장이 GIF 였고, 그중 상당수가
 *   조리·사용 장면이다. 정지컷보다 구매 판단에 도움이 된다.
 *   상품이 안 찍힌 GIF 는 vision 의 hasProduct 판정이 걸러내므로
 *   여기서 확장자로 미리 자를 이유가 없다.
 */
const NON_PRODUCT_IMAGE = /icon|logo|sprite|badge|button|btn_|banner|blank|dot|arrow|star|bg_|_bg|placeholder|avatar|profile/i;

/**
 * 🚫 v3.8.439 — **구매자가 올린 리뷰 사진은 쓰지 않는다.**
 *
 * 사용자 지적(2026-08-03): "상세이미지가 없으면 리뷰이미지를 들고오게끔 했구나..??
 *   근데 이렇게하면 중복문서나 저작권에 위험하지않을까"
 *
 * 맞는 지적이다. 실측으로 확인했다 — 토스 상품 페이지에서 수집한 6장 중 3장이
 * `shopping.toss.im/product.review/…` 경로, 즉 **구매자가 직접 찍어 올린 사진**이었다.
 *
 * 왜 쓰면 안 되나:
 *   1) 저작권 — 그 사진의 권리는 촬영한 구매자에게 있다. 판매자도 제휴사도
 *      제3자에게 재배포할 권한을 주지 못한다. 제휴 계약은 '링크·상품정보' 사용
 *      허락이지 '구매자 사진' 사용 허락이 아니다.
 *   2) 중복 문서 — 같은 리뷰 사진이 여러 제휴 블로그에 동시에 퍼지면
 *      검색엔진이 중복 이미지로 본다. 우리가 피하려는 바로 그 신호다.
 *
 * 판매자가 올린 상세컷(live/temp, detail 등)은 상품 소개용으로 제공된 것이라
 * 성격이 다르다 — 그건 그대로 쓴다.
 */
const REVIEW_IMAGE_PATH = /product\.review|\/review[s]?[\/_-]|user[_-]?photo|buyer[_-]?image/i;

/**
 * CDN 최적화 래퍼를 풀어 **같은 파일인지 비교할 수 있는 형태**로 만든다.
 *
 * 실측: 토스는 원본과 래핑본을 섞어 쓴다.
 *   og:image  → https://shopping.toss.im/live/temp/6b083d0c….png
 *   본문 img  → https://resources-fe.toss.im/image-optimize/width=800,quality=75/https%3A%2F%2Fshopping.toss.im%2F…
 * 문자열만 비교하면 **같은 사진인데 다른 것으로 보여** 썸네일이 본문 1번에 또 나왔다
 * (사용자 보고: "썸네일 이미지 1번이미지로 그대로 사용하는 버그").
 */
export function canonicalImageKey(url: string): string {
  let u = String(url || '').trim();
  if (!u) return '';
  // /image-optimize/…/https%3A%2F%2F… 처럼 원본이 인코딩돼 붙어 있으면 풀어낸다
  const enc = u.match(/https?%3A%2F%2F.+$/i);
  if (enc) {
    try { u = decodeURIComponent(enc[0]); } catch { /* 실패하면 원본 문자열 유지 */ }
  }
  return u.split('?')[0]!.replace(/^https?:\/\//i, '').toLowerCase();
}

/** vision 비용을 묶어두기 위한 상한 — 수집 단계에서부터 자른다 */
export const MAX_DETAIL_IMAGES = 15;

/**
 * 이만큼은 있어야 소제목마다 **다른** 사진을 깔 수 있다 (v3.8.440).
 *
 * 쇼핑모드는 소제목이 8개로 고정이고(ui: MODE_FIXED_SECTIONS.shopping) 썸네일이
 * 1장을 더 쓴다. 그래서 9장이다. 판매자 사진이 이보다 적을 때만 리뷰 사진으로
 * 모자란 만큼 채운다 — 넘치게 가져오지 않는 건 저작권 노출을 줄이기 위해서다.
 * (vision 분석은 어차피 MAX_VISION_IMAGES=12 장에서 끊기므로 비용 상한 안이다.)
 */
export const MIN_DETAIL_IMAGES = 9;

/**
 * 구매자 리뷰 사진만 따로 뽑는다 (부족할 때 보충용, v3.8.440).
 *
 * ⚠️ 저작권상 1순위가 아니다. 판매자 상세컷이 모자랄 때만 쓰며, 필요한 만큼만
 *    가져온다. 사용자가 위험을 인지하고 "부족하면 쓰라"고 판단한 경로다.
 */
export function extractReviewImageUrls(rawHtml: string, excludeUrls: string[] = []): string[] {
  const html = unescapeStreamedHtml(rawHtml);   // 상세컷과 같은 이유로 사본에서 찾는다
  const out: string[] = [];
  const seen = new Set<string>(excludeUrls.map((u) => canonicalImageKey(u)).filter(Boolean));
  const re = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = String(m[1] || '').trim();
    if (!raw || raw.startsWith('data:')) continue;
    const abs = raw.startsWith('//') ? `https:${raw}` : raw;
    if (!/^https?:\/\//i.test(abs)) continue;
    const key = canonicalImageKey(abs);
    if (!key || seen.has(key)) continue;
    if (NON_PRODUCT_IMAGE.test(key)) continue;
    if (!REVIEW_IMAGE_PATH.test(key)) continue;   // 리뷰 사진만 고른다
    seen.add(key);
    out.push(abs);
    if (out.length >= MAX_DETAIL_IMAGES) break;
  }
  return out;
}

/**
 * 🔑 v3.8.440 — **판매자 상세 HTML 은 이스케이프된 채로 스트림 안에 들어 있다.**
 *
 * 실측(2026-08-04, https://toss.im/_m/bMxjrwji):
 *   페이지의 진짜 `<img>` 태그는 3개뿐이다(토스 로고 · 대표사진 · 리뷰사진 1장).
 *   그런데 판매자 상세컷 14장은 Next.js 스트리밍 청크 안에 이렇게 들어 있다 —
 *     self.__next_f.push([1,"<img src=\"https://shopping.toss.im/…jpg\" />…"])
 *   `<` 가 `<` 로 쓰여 있어서 `<img …>` 정규식이 **한 장도 못 찾았다.**
 *   그래서 "상세 이미지 0장 → 리뷰 사진으로 보충"이라는 엉뚱한 결과가 나왔다.
 *
 * 여기서 `<` `>` `\"` `\/` 를 되돌려 그 안의 상세 HTML 이 보이게 만든다.
 * 원본 HTML 은 건드리지 않고 **검색용 사본**만 만든다.
 */
export function unescapeStreamedHtml(html: string): string {
  return String(html || '')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/');
}

/**
 * HTML 문자열에서 상세 이미지 후보를 뽑는다 (토스용, best-effort).
 * 실제 페이지로 검증이 필요하다 — 셀렉터가 아니라 휴리스틱이다.
 */
export function extractDetailImageUrls(rawHtml: string, excludeUrl?: string): string[] {
  // 스트리밍 청크 안의 상세 HTML 까지 함께 본다 (위 unescapeStreamedHtml 주석 참고)
  const html = unescapeStreamedHtml(rawHtml);
  const out: string[] = [];
  const seen = new Set<string>();
  // v3.8.439: 래핑된 주소와 원본 주소가 섞여 오므로 **정규화한 키**로 비교한다.
  //   그래야 og:image(원본 주소)와 본문 img(CDN 래핑)가 같은 파일임을 알아본다.
  const excludeKey = canonicalImageKey(excludeUrl || '');
  const re = /<img[^>]+(?:src|data-src|data-original)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = String(m[1] || '').trim();
    if (!raw || raw.startsWith('data:')) continue;          // 인라인 아이콘류
    const abs = raw.startsWith('//') ? `https:${raw}` : raw;
    if (!/^https?:\/\//i.test(abs)) continue;
    const key = canonicalImageKey(abs);
    if (!key || seen.has(key)) continue;
    if (excludeKey && key === excludeKey) continue;         // 대표 이미지는 이미 따로 쓴다
    if (NON_PRODUCT_IMAGE.test(key)) continue;
    // 🚫 구매자 리뷰 사진은 제외한다 (저작권 + 중복 문서). 위 REVIEW_IMAGE_PATH 주석 참고.
    if (REVIEW_IMAGE_PATH.test(key)) continue;
    seen.add(key);
    out.push(abs);
    if (out.length >= MAX_DETAIL_IMAGES) break;
  }
  return out;
}

export interface CrawlOptions {
  timeoutMs?: number;
  // exactOptionalPropertyTypes — 호출부가 undefined 를 그대로 넘길 수 있게 열어둔다
  onLog?: ((msg: string) => void) | undefined;
  /** 테스트 주입용 */
  fetchImpl?: typeof fetch | undefined;
  /**
   * v3.8.430 — 사용자가 UI에서 고른 제휴사. 있으면 링크로 추측하지 않는다.
   * 단, 넘어온 값이 이 링크의 호스트와 실제로 맞을 때만 쓴다 — 낡은/잘못된 값이
   * 넘어와도 엉뚱한 제휴사로 크롤하지 않게 하는 안전장치다.
   */
  expectedProvider?: AffiliateProviderId | undefined;
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

/**
 * 상품 페이지의 **schema.org 구조화 데이터**에서 후기를 뽑는다 (v3.8.438).
 *
 * ## 왜 이렇게 하나
 * 실측(2026-08-03, 토스 상품 페이지): 후기가 JSON-LD 로 정적 HTML 에 그대로 있다.
 *   "aggregateRating":{"ratingValue":4.7,"reviewCount":1331},
 *   "review":[{"author":{"name":"박*숙"},"reviewRating":{"ratingValue":5},
 *              "reviewBody":"포장이 넘 잘돼 왔어요\n배송도 빠르고요…"}, …]
 * 브라우저를 띄울 필요도, 별도 API 도 필요 없다. 이미 받아온 HTML 안에 있다.
 *
 * ## 왜 JSON.parse 를 안 쓰나
 * 이 데이터는 Next.js 스트리밍 청크(self.__next_f) 안에 **이스케이프된 채로** 박혀
 * 있어서 통째로 파싱할 수 있는 온전한 JSON 이 아니다. 그래서 필요한 필드만
 * 정규식으로 집어낸다 — 깨진 조각이 섞여도 나머지는 건진다.
 *
 * 실패해도 발행을 막지 않는다. 못 뽑으면 예전처럼 후기 없이 진행한다.
 */
export function extractSchemaReviews(html: string): {
  reviews: Array<{ author: string; rating: number | null; body: string }>;
  reviewCount?: number | undefined;
  ratingValue?: number | undefined;
} {
  const src = String(html || '');
  const out: Array<{ author: string; rating: number | null; body: string }> = [];

  // 이스케이프(\" )와 일반(") 두 표기를 모두 받는다
  const agg = src.match(/"aggregateRating"\s*:\s*\{[^}]*?"ratingValue"\s*:\s*"?([0-9.]+)"?[^}]*?"reviewCount"\s*:\s*"?(\d+)"?/)
    || src.match(/\\"aggregateRating\\"\s*:\s*\{[^}]*?\\"ratingValue\\"\s*:\s*\\?"?([0-9.]+)\\?"?[^}]*?\\"reviewCount\\"\s*:\s*\\?"?(\d+)/);

  // reviewBody 와 그 앞의 author/rating 을 함께 집는다
  const re = /"author"\s*:\s*\{[^}]*?"name"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?\}\s*,\s*"reviewRating"\s*:\s*\{[^}]*?"ratingValue"\s*:\s*"?([0-9.]+)"?[^}]*?\}\s*,\s*"reviewBody"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(src)) !== null && out.length < 40) {
    const unescape = (s: string) => String(s || '')
      .replace(/\\n/g, '\n').replace(/\\t/g, ' ')
      .replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      .replace(/\s+\n/g, '\n').trim();
    const body = unescape(m[3] || '');
    if (body.length < 5) continue;
    const key = body.slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    const r = Number(m[2]);
    out.push({
      author: unescape(m[1] || ''),
      rating: Number.isFinite(r) ? r : null,
      body,
    });
  }

  const result: {
    reviews: Array<{ author: string; rating: number | null; body: string }>;
    reviewCount?: number | undefined;
    ratingValue?: number | undefined;
  } = { reviews: out };
  if (agg) {
    const rv = Number(agg[1]);
    const rc = Number(agg[2]);
    if (Number.isFinite(rv)) result.ratingValue = rv;
    if (Number.isFinite(rc)) result.reviewCount = rc;
  }
  return result;
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
  const ogImage = readMeta(html, 'og:image');
  // v3.8.431: 이미 손에 있는 HTML 에서 상세 이미지도 같이 건진다 (추가 요청 0회)
  /**
   * 🖼️ v3.8.440 — 수집 우선순위: **판매자 상세컷 → (부족하면) 리뷰 사진 → 공란**
   *
   * 사용자 지시: "상세정보의 이미지먼저 수집해주고 … 부족하다면 리뷰이미지를
   *   들고오도록 수정해줘 만약 그래도 부족하다면 공란으로 놔둬 이미지를
   *   편집할수있으니까 따로넣으면되"
   *
   * v3.8.439 에서 저작권 우려로 리뷰 사진을 전면 차단했는데, 그러면 쓸 사진이
   * 2장까지 줄어든다. 사용자가 위험을 인지한 상태에서 **부족할 때만** 쓰기로
   * 판단했으므로 그 순서를 그대로 구현한다.
   *   · 판매자 상세컷: 상품 소개용으로 제공된 것 — 1순위
   *   · 리뷰 사진: 구매자 저작물 — 모자랄 때만 채움 (여전히 최소한으로)
   *   · 그래도 모자라면 억지로 채우지 않는다. 편집기에서 직접 넣으면 된다.
   */
  const sellerImages = extractDetailImageUrls(html, ogImage);
  let detailImageUrls = sellerImages;
  if (sellerImages.length < MIN_DETAIL_IMAGES) {
    const reviewPhotos = extractReviewImageUrls(html, [ogImage, ...sellerImages]);
    if (reviewPhotos.length) {
      const need = MIN_DETAIL_IMAGES - sellerImages.length;
      detailImageUrls = [...sellerImages, ...reviewPhotos.slice(0, need)];
      opts.onLog?.(`   [제휴] 판매자 사진이 ${sellerImages.length}장뿐이라 리뷰 사진 `
        + `${Math.min(need, reviewPhotos.length)}장을 보충합니다`);
    }
  }
  if (detailImageUrls.length) {
    opts.onLog?.(`   [제휴] 상세 이미지 ${detailImageUrls.length}장 확보`
      + (detailImageUrls.length > sellerImages.length ? ` (판매자 ${sellerImages.length} + 리뷰 ${detailImageUrls.length - sellerImages.length})` : ''));
  } else {
    opts.onLog?.('   [제휴] 쓸 만한 상품 사진을 찾지 못했습니다 — 이미지는 비워둡니다(편집기에서 추가 가능)');
  }
  // v3.8.438: 후기도 같은 HTML 에서 뽑는다 (추가 요청 0회)
  const schema = extractSchemaReviews(html);
  if (schema.reviews.length) {
    opts.onLog?.(`   [제휴] 실제 후기 ${schema.reviews.length}건 확보`
      + (schema.reviewCount ? ` (전체 ${schema.reviewCount.toLocaleString('ko-KR')}건`
        + (schema.ratingValue ? ` · 평점 ${schema.ratingValue}` : '') + ')' : ''));
  }
  return {
    provider: 'toss-sharelink',
    originalUrl: url,
    resolvedUrl,
    // "몽크로스 초강력 바디팬, 다크그레이, 2개 | 토스쇼핑" → 사이트명 꼬리 제거
    title: rawTitle.replace(/\s*\|\s*토스쇼핑\s*$/i, '').trim(),
    imageUrl: ogImage,
    description: readMeta(html, 'og:description'),
    priceKrw: null,
    priceNote: '토스쇼핑은 웹 페이지에 가격을 노출하지 않습니다(실측 확인). 가격은 본문에 쓰지 않습니다.',
    detailImageUrls,
    reviews: schema.reviews,
    reviewCount: schema.reviewCount,
    ratingValue: schema.ratingValue,
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

    const info = await page.evaluate((maxImgs: number) => {
      const m = (p: string) => document.querySelector(
        `meta[property="${p}"], meta[name="${p}"]`,
      )?.getAttribute('content') || '';
      /**
       * v3.8.431 — 상세정보 이미지 수집.
       *   .se-main-container 는 스마트에디터 ONE 이 렌더한 상세 영역이다(네이버 공통).
       *   지연 로딩이 흔해 data-src/data-original 도 함께 본다.
       *   렌더된 폭이 300px 미만이면 아이콘·구분선으로 보고 버린다.
       *   ⚠️ 실제 스마트스토어 페이지로 검증이 필요한 휴리스틱이다.
       */
      const detail: string[] = [];
      const seen = new Set<string>();
      const nodes = document.querySelectorAll(
        '.se-main-container img, .detail_content img, #INTRODUCE img, .product_detail img',
      );
      nodes.forEach((el) => {
        if (detail.length >= maxImgs) return;
        const img = el as HTMLImageElement;
        const src = img.getAttribute('src') || img.getAttribute('data-src')
          || img.getAttribute('data-original') || '';
        if (!src || src.startsWith('data:')) return;
        const abs = src.startsWith('//') ? `https:${src}` : src;
        if (!/^https?:\/\//i.test(abs)) return;
        const bare = abs.split('?')[0]!;
        if (seen.has(bare)) return;
        // 렌더된 크기를 알 수 있으면 작은 건 버린다 (아이콘·구분선)
        const w = img.naturalWidth || img.width || 0;
        if (w > 0 && w < 300) return;
        seen.add(bare);
        detail.push(abs);
      });
      return {
        url: location.href,
        title: m('og:title') || document.title,
        image: m('og:image'),
        desc: m('og:description'),
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
        detail,
      };
    }, MAX_DETAIL_IMAGES);
    if (info.detail?.length) {
      opts.onLog?.(`   [제휴] 상세 이미지 ${info.detail.length}장 확보`);
    }

    const price = extractPriceKrw(info.text);
    // DOM 에서 읽어도 이중 인코딩된 값이 올 수 있다 (실측: "&#40;주&#41;쇼마젠시")
    const title = decodeEntities(info.title);

    /**
     * v3.8.438 — 네이버도 후기를 뽑는다.
     *
     * 토스와 같은 이유다(사용자 지적: "리뷰 1330개나 있는데 뭐가없다는건지").
     * 스마트스토어도 schema.org JSON-LD 를 심는 경우가 많으므로 **렌더된 HTML**
     * 전체를 받아 같은 파서에 넣는다. 구조가 다르면 빈 배열이 나올 뿐 발행은 그대로 진행된다.
     * ⚠️ 네이버 페이지 구조는 실측 검증이 더 필요하다 — 로그의 "실제 후기 N건 확보"로 확인할 것.
     */
    let schema: ReturnType<typeof extractSchemaReviews> = { reviews: [] };
    try {
      const rendered = await page.content();
      schema = extractSchemaReviews(rendered);
      if (schema.reviews.length) {
        opts.onLog?.(`   [제휴] 실제 후기 ${schema.reviews.length}건 확보`
          + (schema.reviewCount ? ` (전체 ${schema.reviewCount.toLocaleString('ko-KR')}건`
            + (schema.ratingValue ? ` · 평점 ${schema.ratingValue}` : '') + ')' : ''));
      } else {
        opts.onLog?.('   [제휴] 이 페이지에서는 후기를 찾지 못했습니다 (후기 없이 진행)');
      }
    } catch { /* 후기를 못 얻어도 발행은 계속된다 */ }

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
      detailImageUrls: info.detail || [],
      reviews: schema.reviews,
      reviewCount: schema.reviewCount,
      ratingValue: schema.ratingValue,
    };
  } finally {
    await browser.close().catch(() => { /* noop */ });
  }
}

/**
 * 쿠팡 — 상품 크롤은 기존 coupang-partners.ts 가 담당한다(중복 구현하지 않는다).
 * v3.8.398: 사용자가 제휴 링크 칸에 쿠팡 링크를 붙여넣는 실측이 있었다.
 *   지원 목록에 없어 **조용히 무시**됐다. 이제 위임해서 처리한다.
 */
async function crawlCoupang(url: string, opts: CrawlOptions): Promise<AffiliateProduct> {
  const { crawlCoupangProductFromUrl } = require('../coupang-partners');
  const p = await crawlCoupangProductFromUrl(url);
  return {
    provider: 'coupang',
    originalUrl: url,
    resolvedUrl: p?.productUrl || url,
    title: String(p?.productName || '').trim(),
    imageUrl: String(p?.productImage || ''),
    description: [p?.isRocket ? '로켓배송' : '', p?.isFreeShipping ? '무료배송' : '']
      .filter(Boolean).join(' · '),
    // isPriceKnown 이 false 면 크롤이 가격을 확신하지 못한 것 — 추정하지 않는다
    priceKrw: (p?.isPriceKnown && Number(p?.productPrice) > 0) ? Number(p.productPrice) : null,
    priceNote: (p?.isPriceKnown && Number(p?.productPrice) > 0)
      ? ''
      : '쿠팡 상품 페이지에서 가격을 확인하지 못했습니다. 본문에 가격을 쓰지 않습니다.',
  };
}

/**
 * 차단·오류 페이지의 제목인가.
 *
 * 실측(2026-08-01) — `https://link.coupang.com/a/...` 는 상품 페이지로 정상 리다이렉트되지만
 * 쿠팡이 서버 요청과 헤드리스 브라우저 모두에 403 을 준다. 그때 받은 HTML 의 <title> 이
 * "Access Denied" 였고, 크롤러는 그것을 상품명으로 반환했다.
 *
 * 상품명은 못 얻어도 괜찮다(링크와 고지문만으로 글은 나간다).
 * 하지만 **틀린 상품명은 독자를 속인다.** 확실하지 않으면 버린다.
 */
export function isBlockedPageTitle(title: string): boolean {
  const t = String(title || '').trim();
  if (!t) return true;
  if (t.length < 3) return true;
  return /^(access denied|forbidden|error|not found|bad request|service unavailable)\b/i.test(t)
    || /^(403|404|500|502|503)\b/.test(t)
    || /just a moment|attention required|are you a robot|robot check|security check/i.test(t)
    || /페이지를 찾을 수 없|접근이 거부|일시적인 오류|잘못된 요청|서비스 점검/.test(t);
}

/**
 * 쿠팡 단축링크(link.coupang.com/a/…)가 가리키는 productId 를 얻는다.
 *
 * 왜 필요한가 — 실측(2026-08-01):
 *   쿠팡은 상품 페이지 조회를 403 으로 막는다. 오픈 API 에도 "URL → 상품" 조회가 없다.
 *   하지만 **리다이렉트는 인증 없이 따라갈 수 있다.** 302 Location 에 /vp/products/{id} 가 그대로 들어있다.
 *   이 id 만 얻으면, 이미 받아둔 쿠팡 API 검색 결과에서 같은 id 를 찾아
 *   공식 상품명·가격·대표이미지를 붙일 수 있다(추측이 아니라 쿠팡이 준 값이다).
 *
 * 실패해도 절대 throw 하지 않는다 — 발행을 막지 않는다.
 */
export async function resolveCoupangProductId(
  url: string,
  opts: { fetchImpl?: typeof fetch | undefined; maxHops?: number } = {},
): Promise<string> {
  const doFetch = opts.fetchImpl || fetch;
  let cur = String(url || '').trim();
  if (!/^https?:\/\//i.test(cur)) return '';

  try {
    for (let i = 0; i < (opts.maxHops ?? 5); i += 1) {
      const direct = cur.match(/\/vp\/products\/(\d+)/);
      if (direct?.[1]) return direct[1];

      const res = await doFetch(cur, {
        redirect: 'manual',
        headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
        signal: AbortSignal.timeout(15000),
      });
      const loc = res.headers.get('location');
      if (!loc) break;
      cur = loc.startsWith('http') ? loc : new URL(loc, cur).href;
    }
    return (cur.match(/\/vp\/products\/(\d+)/) || [])[1] || '';
  } catch {
    return '';
  }
}

export function isSupportedForCrawl(provider: AffiliateProviderId): boolean {
  return provider === 'toss-sharelink'
    || provider === 'naver-shopping-connect'
    || provider === 'coupang';
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

  // 링크 호스트로 제휴사 판정 (쿠팡 포함 — 사용자가 실제로 붙여넣는다)
  //   v3.8.430: 사용자가 고른 제휴사가 이 링크와 실제로 맞으면 그걸 쓴다(추측 생략).
  //   맞지 않으면 무시하고 기존 자동판별로 넘어간다 — 잘못된 태그로 오크롤하지 않는다.
  const provider = (opts.expectedProvider && getPolicy(opts.expectedProvider)?.linkHosts.test(clean)
    ? opts.expectedProvider
    : undefined)
    || (['toss-sharelink', 'naver-shopping-connect', 'coupang'] as AffiliateProviderId[])
      .find((id) => getPolicy(id)!.linkHosts.test(clean));
  if (!provider) {
    opts.onLog?.(`   [제휴] 지원하지 않는 링크 — 건너뜀: ${clean.slice(0, 50)}`);
    return null;
  }

  try {
    const t0 = Date.now();
    const product = provider === 'toss-sharelink' ? await crawlToss(clean, opts)
      : provider === 'coupang' ? await crawlCoupang(clean, opts)
        : await crawlNaver(clean, opts);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);

    if (!product.title) {
      opts.onLog?.(`   [제휴] 상품명을 얻지 못했습니다 (${sec}초) — 링크만 사용합니다`);
      return null;
    }
    // v3.8.400 — 실측(2026-08-01): 쿠팡이 403 을 주면 오류 페이지의 <title>("Access Denied")이
    //   그대로 상품명이 됐다. 그 이름이 프롬프트·상품카드·본문에 실려 나갔다.
    //   차단 페이지를 상품으로 받아들이면 안 된다. 링크와 고지문만 남기고 상품 정보는 버린다.
    if (isBlockedPageTitle(product.title)) {
      opts.onLog?.(
        `   [제휴] ⛔ ${getPolicy(provider)!.label}가 접근을 차단했습니다 ("${product.title.slice(0, 30)}") — `
        + '상품 정보 없이 링크만 사용합니다. 상품명·가격·사진은 본문에 넣지 않습니다.',
      );
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
