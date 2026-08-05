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
   * v3.8.453 내부 플래그 — 저장된 네이버 로그인 세션으로 재시도 중인가.
   * 직접 넘기지 말 것. crawlNaver 가 로그인/연령확인 화면을 만났을 때만 세운다.
   */
  _naverSession?: boolean | undefined;
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
  /**
   * 🔍 v3.8.444 — 눈으로 확인하고 싶을 때 브라우저를 띄운다.
   *   ORBIT_CRAWL_HEADFUL=1        → 창을 보이게 (기본은 headless)
   *   ORBIT_CRAWL_SLOWMO=<밀리초>  → 동작을 늦춰 하나씩 보이게
   * 발행 경로는 건드리지 않는다. 값이 없으면 예전과 완전히 동일하게 돈다.
   */
  const headful = String(process.env['ORBIT_CRAWL_HEADFUL'] || '') === '1';
  const slowMo = Number(process.env['ORBIT_CRAWL_SLOWMO'] || 0) || 0;
  const browser = await chromium.launch({
    headless: !headful,
    args: [...CHROMIUM_GPU_SAFE_ARGS],
    ...(slowMo > 0 ? { slowMo } : {}),
  });
  try {
    const ctx = await browser.newContext({
      userAgent: UA,
      locale: 'ko-KR',
      /**
       * 🖥️ v3.8.444 — **데스크톱 뷰포트로 바꾼다.**
       *
       * 실측(2026-08-04, 같은 상품 · 같은 대기시간):
       *   모바일 390px  : img[alt^="추가이미지"]  0개
       *   데스크톱 1440px: img[alt^="추가이미지"] 10개
       * 대표 갤러리(추가이미지)는 데스크톱 마크업에만 그 앵커로 나온다.
       * 모바일에서도 캐러셀은 있지만 alt 가 없어 추천상품·판촉배너와 구분이 안 된다.
       * 예전 주석("브랜드커넥트는 모바일 전제")은 리다이렉트 얘기였고, 실제로는
       * 데스크톱에서도 브리지가 정상 동작한다(가격·제목·상세·후기 모두 확인).
       */
      viewport: { width: 1440, height: 900 },
      /**
       * 🔐 v3.8.453 — 성인인증 재시도일 때만 저장된 로그인 세션을 싣는다.
       * 일반 크롤은 계속 비로그인이다(계정 노출 최소화 — naver-session.ts 주석 참고).
       */
      ...(opts._naverSession && require('./naver-session').hasNaverSession()
        ? { storageState: require('./naver-session').getNaverSessionPath() }
        : {}),
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: opts.timeoutMs ?? 45000 })
      .catch(() => { /* SPA 리다이렉트 중일 수 있다 — 아래 대기로 흡수 */ });
    await page.waitForTimeout(9000);   // 브리지 → 스마트스토어 리다이렉트 대기

    /**
     * 📜 v3.8.443 — **스크롤하지 않으면 상세 이미지는 영원히 0장이다.**
     *
     * 실측(2026-08-04, naver.me/xiLWsfo5 → brand.naver.com/krups/…):
     *   스크롤 전 : .se-main-container img 31개 — 그중 **src 가 채워진 것 0개**
     *   스크롤 후 : 31개 중 src 가 채워진 것 확보
     * 셀렉터는 처음부터 맞았다. 네이버가 지연 로딩(lazy load)을 쓰기 때문에
     * 화면에 들어오기 전에는 img 에 주소가 안 붙는다. 9초를 기다려도 소용없다 —
     * 시간이 아니라 **뷰포트 진입**이 조건이기 때문이다.
     * 그래서 "상세 이미지 0장"이 나왔고, 그러면 v3.8.442 의 실사진 우선 정책도
     * 네이버에서는 발동하지 못한다(사진이 없으니 AI 생성으로 떨어진다).
     *
     * 끝까지 훑되, 더 이상 새로 로드되는 게 없으면 일찍 끊는다(시간 낭비 방지).
     */
    /**
     * 🔽 v3.8.443 — **"상세정보 펼쳐보기"를 누르지 않으면 사진의 90%가 잠겨 있다.**
     *
     * 실측(2026-08-04, brand.naver.com/krups/…):
     *   그냥 스크롤만  : .se-main-container img 31개 중 src 채워진 것 **3개**
     *   펼치기 누른 뒤 : 31개 중 **31개** (문서 높이 20,926px)
     * 스마트스토어는 상세 영역을 접어 두고 버튼을 눌러야 나머지를 붙인다.
     * 접힌 부분은 스크롤해도 뷰포트에 들어오지 않으니 지연 로딩도 안 걸린다.
     */
    for (const label of ['상세정보 펼쳐보기', '상품정보 펼쳐보기']) {
      try {
        const btn = page.locator(`text=${label}`).first();
        if (await btn.count() > 0) {
          await btn.click({ timeout: 3000 });
          await page.waitForTimeout(1200);
          opts.onLog?.(`   [제휴] 상세정보를 펼쳤습니다 ("${label}")`);
          break;
        }
      } catch { /* 버튼이 없거나 못 눌러도 아래 스크롤로 최대한 건진다 */ }
    }

    try {
      await page.evaluate(async () => {
        const loaded = () => {
          let n = 0;
          document.querySelectorAll('.se-main-container img').forEach((el) => {
            const s = el.getAttribute('src') || el.getAttribute('data-src')
              || el.getAttribute('data-original') || '';
            if (s && !s.startsWith('data:')) n += 1;
          });
          return n;
        };
        let same = 0;
        let prev = loaded();
        for (let i = 0; i < 40; i += 1) {
          window.scrollBy(0, Math.round(window.innerHeight * 0.9));
          await new Promise((r) => setTimeout(r, 320));
          const now = loaded();
          // 바닥에 닿았고 새로 뜬 것도 없으면 두 번 더 확인하고 끝낸다
          const atBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 40);
          same = (now === prev && atBottom) ? same + 1 : 0;
          prev = now;
          if (same >= 3) break;
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);   // 마지막으로 뜬 이미지들이 붙을 시간
    } catch { /* 스크롤에 실패해도 나머지 수집은 계속한다 */ }

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
      /**
       * 🖼️ v3.8.444 — **대표 갤러리("추가이미지")를 함께 가져온다.**
       *
       * 사용자 제보로 위치를 특정했다:
       *   <li><a …><img src="…?type=f40" alt="추가이미지0"></a></li>
       * 지금까지는 .se-main-container(상세설명)만 봐서 이 갤러리를 통째로
       * 버리고 있었다. 실측 결과 og:image 1장만 쓰고 나머지 2장을 버렸다.
       *
       * 갤러리 사진이 **본문 1번에 가장 좋다** — 배경 정리된 순수 제품컷이라서다.
       * 상세컷은 글자가 잔뜩 박힌 세로 인포그래픽인 경우가 많다.
       *
       * 앵커는 `alt="추가이미지N"` 을 쓴다. 클래스명은 난독화된 무작위 10자라
       * 배포마다 바뀌지만 이 alt 는 의미 기반이라 안정적이다.
       *
       * ⚠️ src 는 40px 짜리 썸네일(`?type=f40`)이다. **쿼리를 떼야 원본**이 온다.
       *    실측: 원본 1254px(1.1MB) / ?type=f40 → 40px(1KB) / ?type=w800 → 404.
       */
      const bareUrl = (u: string) => String(u || '').split('?')[0] || '';
      const gallery: string[] = [];
      const gseen = new Set<string>();
      document.querySelectorAll('img[alt^="추가이미지"]').forEach((el) => {
        if (gallery.length >= maxImgs) return;
        const raw = el.getAttribute('data-src') || el.getAttribute('src') || '';
        if (!raw || raw.startsWith('data:')) return;
        const abs = bareUrl(raw.startsWith('//') ? `https:${raw}` : raw);
        if (!/^https?:\/\//i.test(abs)) return;
        /**
         * 쿼리를 뗀 뒤 **파일명이 남는 것만** 쓴다.
         * 실측: 갤러리에 동영상이 섞이면 `phinf.pstatic.net/dthumb/?src=…` 형태라
         *   쿼리를 떼면 `…/dthumb/` 만 남아 본문에 깨진 이미지로 나온다.
         */
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(abs)) return;
        if (gseen.has(abs)) return;
        gseen.add(abs);
        gallery.push(abs);
      });

      /**
       * 📷 v3.8.444 — 포토리뷰 사진 (판매자 사진이 모자랄 때만 쓰는 폴백).
       *
       * 사용자 제보: "리뷰이미지는 여기에 엄청많아"
       *   <li><a data-shp-contents-type="review" data-shp-contents-grp="event" …>
       *       <img src="…checkout.phinf…" alt="포토리뷰 첨부 파일 대표이미지">
       *
       * 🚫 **이벤트 배너를 반드시 걸러낸다.** 사용자 지적:
       *   "제품사진이나 gif인데 이런 이벤트 텍스트가 있으면 누가봐도
       *    아 그냥 대충 퍼왔네 이소리할것같은데"
       * 맞는 지적이다. "포토리뷰 Npay 5,000원" 같은 판촉 그래픽이 본문에 깔리면
       * 글 전체가 싸구려로 보인다. 다행히 마크업이 구분해 준다 —
       * data-shp-contents-grp="event" 가 붙은 것은 이벤트 콘텐츠다.
       * alt/파일명에 판촉 단어가 있는 것도 함께 뺀다(이중 방어).
       */
      const reviewPhotos: string[] = [];
      const rseen = new Set<string>();
      /**
       * 판촉 그래픽 판별어. 실측으로 확인한 실제 alt 들이 근거다 —
       *   "N페이, 이벤트 참여하면 포인트 적립!"
       *   "[가전Mega 빅세일] KRUPS 커피머신☕최대 ~ 29%"
       *   "4천9백원 웰컴 선물이 왔어요! 멤버십만 누리는 추가 적립까지"
       * 세일·할인율 배너도 잡아야 해서 세일/할인/최대 N% 를 함께 넣는다.
       */
      const PROMO = /이벤트|쿠폰|적립|혜택|증정|당첨|응모|세일|할인|특가|사은품|멤버십|웰컴|선물|pay\s*\d|최대\s*~?\s*\d+\s*%|\d+\s*%\s*(할인|세일)?/i;
      document.querySelectorAll('img[src*="checkout.phinf"], img[data-src*="checkout.phinf"]').forEach((el) => {
        if (reviewPhotos.length >= maxImgs) return;
        const holder = el.closest('[data-shp-contents-grp]');
        if (holder?.getAttribute('data-shp-contents-grp') === 'event') return;   // 판촉 배너
        const alt = el.getAttribute('alt') || '';
        if (PROMO.test(alt)) return;
        const raw = el.getAttribute('data-src') || el.getAttribute('src') || '';
        if (!raw || raw.startsWith('data:')) return;
        const abs = bareUrl(raw.startsWith('//') ? `https:${raw}` : raw);
        if (!/^https?:\/\//i.test(abs)) return;
        if (PROMO.test(abs)) return;
        if (rseen.has(abs)) return;
        rseen.add(abs);
        reviewPhotos.push(abs);
      });

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
      /**
       * 💬 v3.8.443 — 네이버 후기는 **DOM 에서** 긁는다.
       *
       * 실측(2026-08-04): 스마트스토어 JSON-LD 에는 review 도 aggregateRating 도
       *   없다(len 607, review:false, agg:false). 토스와 달리 구조화 데이터가
       *   아예 안 실린다. 그래서 extractSchemaReviews 로는 늘 0건이었다.
       *
       * 클래스명은 난독화된 무작위 10자라 배포마다 바뀐다 — 하드코딩하면
       * 며칠 만에 깨진다. 대신 **구조로** 찾는다:
       *   구매자 리뷰 사진은 checkout.phinf 도메인에서 온다. 그 사진이 들어 있는
       *   영역이 곧 리뷰 목록이므로, 그 조상 아래의 '잎 텍스트'만 모은다.
       *   사진이 없는 상품이면 "리뷰/구매평" 제목을 앵커로 쓴다.
       */
      const reviews: string[] = [];
      try {
        const anchorImg = document.querySelector('img[src*="checkout.phinf"]');
        let scope: Element | null = null;
        if (anchorImg) {
          scope = anchorImg;
          for (let i = 0; i < 8 && scope?.parentElement; i += 1) scope = scope.parentElement;
        }
        if (!scope) {
          const heads: Element[] = [];
          document.querySelectorAll('h2,h3,h4,strong,span').forEach((el) => {
            if (/^(리뷰|구매평|쇼핑몰\s*리뷰)/.test((el.textContent || '').trim())) heads.push(el);
          });
          scope = heads[0]?.parentElement?.parentElement || null;
        }
        const seenText = new Set<string>();
        (scope || document.body).querySelectorAll('span,p,div').forEach((el) => {
          if (reviews.length >= 12) return;
          if (el.children.length > 0) return;          // 잎 노드만
          const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (t.length < 20 || t.length > 400) return;
          if (!/[가-힣]/.test(t)) return;
          // 가격·배송 안내·버튼 문구 같은 UI 텍스트 배제
          if (/^(총|배송|무료배송|적립|쿠폰|할인|구매하기|장바구니|옵션|수량)/.test(t)) return;
          if (/원$|개$|%$/.test(t)) return;
          if (seenText.has(t)) return;
          seenText.add(t);
          reviews.push(t);
        });
      } catch { /* 후기를 못 얻어도 나머지는 그대로 반환한다 */ }

      /**
       * v3.8.443 — 전체 후기 **건수**를 탭 문구에서 읽는다.
       *   실측: 탭이 "상세정보 / 리뷰 10 / Q&A 14 / 판매자정보" 형태다.
       * 이 숫자가 있어야 본문에서 후기 규모를 말할 수 있다(v3.8.441 지시 참고).
       * 못 읽으면 0 을 반환하고, 그러면 본문은 규모를 언급하지 않는다.
       */
      let reviewTotal = 0;
      try {
        const tab = (document.body.innerText || '').replace(/\s+/g, ' ');
        const mm = tab.match(/리뷰\s*([\d,]{1,12})/);
        if (mm && mm[1]) {
          const n = Number(mm[1].replace(/,/g, ''));
          if (Number.isFinite(n) && n > 0) reviewTotal = n;
        }
      } catch { /* 못 읽으면 규모를 안 쓴다 */ }

      return {
        url: location.href,
        title: m('og:title') || document.title,
        image: m('og:image'),
        desc: m('og:description'),
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000),
        detail,
        gallery,
        reviewPhotos,
        reviews,
        reviewTotal,
      };
    }, MAX_DETAIL_IMAGES);
    /**
     * 🖼️ v3.8.444 — 토스와 **같은 우선순위**로 모은다.
     *   ① 대표 갤러리("추가이미지") — 배경 정리된 순수 제품컷. 본문 1번에 가장 좋다.
     *   ② 상세설명 이미지(.se-main-container)
     *   ③ 그래도 모자라면 포토리뷰 사진 (이벤트 배너는 위 evaluate 에서 이미 제외)
     *   ④ 그래도 모자라면 그냥 비워 둔다 — 편집기에서 넣으면 된다.
     * 대표 갤러리 첫 장은 보통 og:image(썸네일)와 같은 파일이라 여기서 겹쳐도
     * orchestration 의 정규화 키 중복 제거가 걸러낸다.
     */
    const naverGallery = ((info as any).gallery || []) as string[];
    /**
     * v3.8.444 — 대표 갤러리 1번은 보통 og:image(썸네일)와 **같은 파일**이다.
     * 실측 시연에서 "2번은 1번과 같은 파일"로 잡혔다. 썸네일은 따로 쓰이므로
     * 여기서 빼야 본문 첫 사진이 썸네일과 겹치지 않는다.
     * 문자열이 아니라 정규화 키로 비교한다 — 같은 파일인데 주소 형태가 다를 수 있다.
     */
    const thumbKey = canonicalImageKey(info.image || '');
    const sellerShots = [...naverGallery, ...(info.detail || [])]
      .filter((u) => u && canonicalImageKey(u) !== thumbKey)
      .filter((u, i, arr) => arr.indexOf(u) === i);
    let naverDetail = sellerShots;
    if (sellerShots.length < MIN_DETAIL_IMAGES) {
      const pool = ((info as any).reviewPhotos || []) as string[];
      const extra = pool.filter((u) => !sellerShots.includes(u))
        .slice(0, MIN_DETAIL_IMAGES - sellerShots.length);
      if (extra.length > 0) {
        naverDetail = [...sellerShots, ...extra];
        opts.onLog?.(`   [제휴] 판매자 사진이 ${sellerShots.length}장뿐이라 포토리뷰 ${extra.length}장을 보충합니다`);
      }
    }
    if (naverDetail.length) {
      opts.onLog?.(`   [제휴] 상세 이미지 ${naverDetail.length}장 확보`
        + (naverGallery.length ? ` (대표 갤러리 ${naverGallery.length} + 상세 ${(info.detail || []).length}` : ' (상세')
        + (naverDetail.length > sellerShots.length ? ` + 리뷰 ${naverDetail.length - sellerShots.length}` : '') + ')');
    } else {
      opts.onLog?.('   [제휴] 쓸 만한 상품 사진을 찾지 못했습니다 — 이미지는 비워둡니다(편집기에서 추가 가능)');
    }

    const price = extractPriceKrw(info.text);
    // DOM 에서 읽어도 이중 인코딩된 값이 올 수 있다 (실측: "&#40;주&#41;쇼마젠시")
    const title = decodeEntities(info.title);

    /**
     * 🚨 v3.8.450 — **로그인 페이지를 상품으로 착각하지 않는다.**
     *
     * 사용자 실측(2026-08-04): 네이버 링크로 발행했더니 로그가 이랬다 —
     *   🛒 링크 상품 확인: "NAVER 로그인"
     *   ✅ 제목 완료: "NAVER 로그인, 보안 설정 없이 써도 될까"
     * 즉 크롤이 로그인 리다이렉트를 받았는데 그걸 상품명으로 받아들여
     * **엉뚱한 글을 그대로 써버렸다.** 이미지도 0장이라 뒤이어 발행까지 깨졌다.
     *
     * 잘못된 입력은 조용히 진행하는 것보다 **분명히 멈추고 알리는 편**이 낫다 —
     * 글 한 편의 생성 비용을 버리고 사용자는 원인을 모른 채 이상한 글을 얻는다.
     * (품질 때문에 막는 게 아니라, 상품 정보가 아예 없는 경우다.)
     */
    const loginish = /로그인|login|sign\s?in/i;
    const isLoginPage = loginish.test(title)
      || /nid\.naver\.com|\/login|accounts\.google/i.test(String(info.url || ''));
    if (isLoginPage) {
      /**
       * 실측(2026-08-04, naver.me/GT42MEXe → makkaejoo_market): 주류 상품이라
       * 브랜드커넥트 링크도, 리다이렉트에 담긴 스마트스토어 원본 주소도 모두
       * "네이버 서비스 이용을 위해 연령확인이 필요해요" 로 막힌다.
       * 법으로 요구되는 연령확인이므로 **우회하지 않는다.** 대신 원인을 정확히
       * 알려서 사용자가 다음에 뭘 할지 알게 한다("로그인 화면"만으로는 알 수 없다).
       */
      /**
       * 🔐 v3.8.453 — 저장된 네이버 로그인 세션이 있으면 **1회 재시도**한다.
       *
       * 사용자 판단: "수동입력을 하면 자동화툴을 쓰는 이유가 없자나 술이나
       *   와인같은거 다루는사람들한테는 꼭필요해".
       * 연령확인은 인증된 계정으로 로그인하면 통과된다 — 우회가 아니라
       * 인증을 실제로 통과하는 것이다. 세션은 이 재시도에만 쓴다.
       */
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const naverSession = require('./naver-session');
      if (!opts._naverSession && naverSession.hasNaverSession()) {
        opts.onLog?.('   [제휴] 🔐 로그인/연령확인 화면 감지 — 저장된 네이버 로그인으로 다시 시도합니다');
        await browser.close().catch(() => { /* noop */ });
        return crawlNaver(url, { ...opts, _naverSession: true });
      }

      const ageGated = /연령\s*확인|성인\s*인증|미성년|19세/i.test(String(info.text || ''));
      if (ageGated) {
        if (opts._naverSession) {
          throw new Error(
            '로그인했지만 연령확인을 통과하지 못했습니다.\n'
            + '· 네이버 계정의 성인인증(실명확인) 상태를 확인해 주세요.\n'
            + '· 인증을 마친 뒤 설정에서 "네이버 로그인"을 다시 해 주세요.',
          );
        }
        /**
         * 🔔 v3.8.458 — 세션이 없으면 **로그인 창을 지금 띄운다** (앱 실행당 1회).
         * 사용자 실측: "와인인데 왜 네이버로그인이 안뜨나요??" — 막힌 그 순간에
         * 창이 떠야 쓸모가 있다. 로그인하면 즉시 세션으로 재시도한다.
         * 안 하고 닫으면(또는 5분 초과) 기존 안내 오류로 이어진다 — 발행은 계속된다.
         */
        if (!naverSession.hasNaverSession() && naverSession.tryClaimLoginPrompt()) {
          /**
           * 🔞 v3.8.463 — **상품 주소를 넘긴다.**
           *
           * 사용자 지적: "로그인만하고 끝내는게아니고 성인인증을 해야되 … 정상적으로
           * 상품창이뜨면 그때 크롤링이 들어가야되". 상품 주소로 창을 열면 네이버가
           * 로그인 → 연령확인 → 상품 페이지까지 데려다 주고, 그 상품 화면이 실제로
           * 뜬 것을 확인한 뒤에야 수집을 시작한다.
           */
          opts.onLog?.('   [제휴] 🔔 성인인증 상품 감지 — 네이버 창을 엽니다. 로그인 후 성인인증까지 마치시면 자동으로 수집합니다 (최대 10분)');
          await browser.close().catch(() => { /* 로그인 창과 겹치지 않게 먼저 닫는다 */ });
          const login = await naverSession.openNaverLoginWindow(
            (m: string) => opts.onLog?.(`   ${m}`),
            url,
          ).catch(() => ({ ok: false, loggedIn: false, verified: false }));

          if (login.ok && login.verified) {
            opts.onLog?.('   [제휴] ✅ 성인인증 완료 — 상품 정보를 수집합니다');
            return crawlNaver(url, { ...opts, _naverSession: true });
          }
          if (login.ok && login.loggedIn) {
            // 로그인은 됐지만 연령확인이 안 끝났다. 세션은 저장됐으니 한 번은 시도해 본다.
            opts.onLog?.('   [제휴] 로그인은 됐지만 연령확인이 확인되지 않았습니다 — 저장된 세션으로 한 번 시도합니다');
            return crawlNaver(url, { ...opts, _naverSession: true });
          }
          opts.onLog?.('   [제휴] 로그인이 확인되지 않아 상품 정보 없이 진행합니다');
        }
        throw new Error(
          '성인인증이 필요한 상품이라 정보를 읽지 못했습니다(주류·성인용품 등).\n'
          + '· 설정 → API 연동의 "네이버 로그인" 버튼으로 성인인증된 계정에 로그인해 두면 자동 수집됩니다.\n'
          + '· 로그인 없이 발행하시려면 상품명·가격·사진을 직접 넣어 주세요. 제휴 링크는 그대로 동작합니다.',
        );
      }
      if (opts._naverSession) {
        throw new Error(
          '저장된 네이버 로그인이 만료된 것 같습니다.\n'
          + '· 설정에서 "네이버 로그인"을 다시 해 주세요.',
        );
      }
      throw new Error(
        '네이버가 로그인 화면을 돌려줬습니다. 상품 정보를 읽지 못했습니다.\n'
        + '· 링크를 브라우저에서 열어 정상 상품 페이지인지 확인해 주세요.\n'
        + '· 단축 링크(naver.me)가 만료됐다면 상품 페이지에서 다시 복사해 주세요.',
      );
    }

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
    } catch { /* 후기를 못 얻어도 발행은 계속된다 */ }

    /**
     * v3.8.443 — JSON-LD 가 비면 **DOM 에서 긁어온 후기**로 채운다.
     *
     * 실측: 스마트스토어는 JSON-LD 에 후기를 아예 안 싣는다(위 evaluate 주석 참고).
     * 그래서 v3.8.438 이후로도 네이버는 계속 "후기 0건"이었고, 그러면 글이
     * 후기 없는 상품 경로(스펙 위주)를 타 실제 구매평이 통째로 버려졌다.
     * DOM 에서 뽑은 것은 별점·작성자를 못 얻으므로 본문만 채운다 — 그걸로 충분하다
     * (프롬프트가 쓰는 건 "사람들이 무엇을 어떻게 말하는가"이지 별점 숫자가 아니다).
     */
    if (schema.reviews.length === 0 && Array.isArray((info as any).reviews)) {
      const domReviews = ((info as any).reviews as string[])
        .map((b) => String(b || '').trim())
        .filter((b) => b.length >= 20);
      if (domReviews.length > 0) {
        const total = Number((info as any).reviewTotal || 0);
        schema = {
          ...schema,
          reviews: domReviews.map((body) => ({ author: '', rating: null, body })),
          // 탭에서 읽은 전체 건수가 있으면 함께 넘긴다 (본문이 규모를 말할 근거)
          ...(total > 0 ? { reviewCount: total } : {}),
        };
      }
    }

    if (schema.reviews.length) {
      opts.onLog?.(`   [제휴] 실제 후기 ${schema.reviews.length}건 확보`
        + (schema.reviewCount ? ` (전체 ${schema.reviewCount.toLocaleString('ko-KR')}건`
          + (schema.ratingValue ? ` · 평점 ${schema.ratingValue}` : '') + ')' : ''));
    } else {
      opts.onLog?.('   [제휴] 이 페이지에서는 후기를 찾지 못했습니다 (후기 없이 진행)');
    }

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
      detailImageUrls: naverDetail,
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
