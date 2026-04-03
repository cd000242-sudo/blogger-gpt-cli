import * as cheerio from 'cheerio';
import {
    ProductDetailSnapshot,
    ProductFeature,
    ProductReviewSnippet,
    ProductPriceInfo
} from '../types';

type CheerioRoot = ReturnType<typeof cheerio.load>;
type CheerioElement = cheerio.Element;

/* ─────────────────────────────────────────────
 * 쿠팡(Coupang) 제품 상세페이지 파서
 *
 * 추출 우선순위:
 *   1. JSON-LD  <script type="application/ld+json">  (@type: Product)
 *   2. Open Graph / meta 태그
 *   3. DOM 셀렉터 (쿠팡 고유 클래스)
 * ───────────────────────────────────────────── */

interface JsonLdProduct {
    name?: string;
    description?: string;
    image?: string | string[];
    brand?: { name?: string };
    offers?: {
        price?: number | string;
        priceCurrency?: string;
        availability?: string;
        seller?: { name?: string };
    } | Array<{
        price?: number | string;
        priceCurrency?: string;
    }>;
    aggregateRating?: {
        ratingValue?: number | string;
        reviewCount?: number | string;
        bestRating?: number | string;
    };
    category?: string;
}

export function parseCoupang(html: string, pageUrl: string): ProductDetailSnapshot {
    const $ = cheerio.load(html);
    const ld = extractJsonLdProduct($);

    /* ── 제목 ── */
    const title =
        ld?.name ||
        $('h2.prod-buy-header__title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().trim() ||
        '제목 없음';

    /* ── 설명 ── */
    const description =
        ld?.description ||
        $('meta[name="description"]').attr('content')?.trim() ||
        $('meta[property="og:description"]').attr('content')?.trim() ||
        undefined;

    /* ── 가격 ── */
    const price = extractPrice($, ld);

    /* ── 할인율 ── */
    const discount = extractDiscount($);

    /* ── 배송 정보 ── */
    const delivery = extractDelivery($);

    /* ── 판매자 ── */
    const seller = extractSeller($, ld);

    /* ── 평점 & 리뷰 수 ── */
    const { rating, reviewCount } = extractRatingMeta($, ld);

    /* ── 특징 ── */
    const features = extractFeatures($);

    /* ── 스펙 ── */
    const specs = extractSpecs($);

    /* ── 리뷰 ── */
    const reviews = extractReviews($);

    /* ── 이미지 ── */
    const images = extractImages($, pageUrl, ld);

    /* ── 카테고리 ── */
    const categories = extractCategories($, ld);

    /* ── 공식 URL ── */
    const officialUrl =
        $('link[rel="canonical"]').attr('href') || pageUrl;

    const snapshot: ProductDetailSnapshot = {
        title,
        features,
        specs,
        reviews,
        images,
        officialUrl,
        sourceDomain: safeHostname(pageUrl),
        capturedAt: new Date().toISOString(),
        rawUrl: pageUrl
    };

    if (description) snapshot.description = description;
    if (price) snapshot.price = price;
    if (delivery) snapshot.delivery = delivery;
    if (seller) snapshot.seller = seller;
    if (typeof rating === 'number') snapshot.rating = rating;
    if (typeof reviewCount === 'number') snapshot.reviewCount = reviewCount;
    if (discount) snapshot.discount = discount;
    if (categories.length) snapshot.categories = categories;

    return snapshot;
}

/* ────────── JSON-LD 추출 ────────── */

function extractJsonLdProduct($: CheerioRoot): JsonLdProduct | null {
    let product: JsonLdProduct | null = null;

    $('script[type="application/ld+json"]').each((_i: number, el: CheerioElement) => {
        if (product) return;
        try {
            const data = JSON.parse($(el).html() || '');
            if (data?.['@type'] === 'Product') {
                product = data;
            } else if (Array.isArray(data)) {
                const found = data.find((item: any) => item?.['@type'] === 'Product');
                if (found) product = found;
            }
        } catch {
            /* ignore parse errors */
        }
    });

    return product;
}

/* ────────── 가격 ────────── */

function extractPrice($: CheerioRoot, ld: JsonLdProduct | null): ProductPriceInfo | undefined {
    // JSON-LD 우선
    if (ld?.offers) {
        const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const current = normalizeNumber(offer?.price);
        if (current) {
            const priceInfo: ProductPriceInfo = {
                current,
                currency: offer?.priceCurrency || 'KRW'
            };
            return priceInfo;
        }
    }

    // DOM 폴백
    const selectors = [
        '.total-price strong',
        '.prod-sale-price .total-price',
        '.prod-price .total-price',
        'meta[property="product:price:amount"]'
    ];

    for (const sel of selectors) {
        const text = sel.startsWith('meta')
            ? $(sel).attr('content')
            : $(sel).first().text();
        const value = normalizeNumber(text);
        if (value) {
            return { current: value, currency: 'KRW' };
        }
    }

    return undefined;
}

/* ────────── 할인율 ────────── */

function extractDiscount($: CheerioRoot): string | undefined {
    const discountEl =
        $('.prod-sale-rate').first().text().trim() ||
        $('.discount-rate').first().text().trim();
    const match = discountEl.match(/(\d+)\s*%/);
    return match ? `${match[1]}%` : undefined;
}

/* ────────── 배송 ────────── */

function extractDelivery($: CheerioRoot): string | undefined {
    const rocketBadge = $('img[alt*="로켓"], .badge--rocket, .delivery-type').first();
    if (rocketBadge.length) {
        const alt = rocketBadge.attr('alt') || rocketBadge.text().trim();
        if (/로켓배송/i.test(alt)) return '로켓배송';
        if (/로켓와우/i.test(alt)) return '로켓와우';
        if (/로켓직구/i.test(alt)) return '로켓직구';
        if (/로켓프레시/i.test(alt)) return '로켓프레시';
        return alt || '일반배송';
    }

    const deliveryInfo = $('.prod-shipping-fee-message, .delivery-info').first().text().trim();
    if (deliveryInfo) return deliveryInfo;

    return undefined;
}

/* ────────── 판매자 ────────── */

function extractSeller($: CheerioRoot, ld: JsonLdProduct | null): string | undefined {
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name) {
        return ld.offers.seller.name;
    }
    return (
        $('a.prod-sale-vendor-name').first().text().trim() ||
        $('.seller-name').first().text().trim() ||
        undefined
    );
}

/* ────────── 평점 & 리뷰 수 ────────── */

function extractRatingMeta($: CheerioRoot, ld: JsonLdProduct | null): { rating?: number; reviewCount?: number } {
    let rating: number | undefined;
    let reviewCount: number | undefined;

    if (ld?.aggregateRating) {
        rating = normalizeNumber(ld.aggregateRating.ratingValue);
        reviewCount = normalizeNumber(ld.aggregateRating.reviewCount);
    }

    if (!rating) {
        const ratingText = $('.rating-star-num, .star-score .score').first().text().trim();
        rating = normalizeNumber(ratingText);
    }

    if (!reviewCount) {
        const countText = $('.count, .rating-total-count').first().text().trim();
        reviewCount = normalizeNumber(countText);
    }

    const result: { rating?: number; reviewCount?: number } = {};
    if (rating !== undefined) result.rating = rating;
    if (reviewCount !== undefined) result.reviewCount = reviewCount;
    return result;
}

/* ────────── 특징 ────────── */

function extractFeatures($: CheerioRoot): ProductFeature[] {
    const features: ProductFeature[] = [];

    // 쿠팡 상품 특징 / 요약 섹션
    $('.prod-description__item, .prod-attr__item').each((_i: number, el: CheerioElement) => {
        const heading =
            $(el).find('.prod-attr__key, strong').first().text().trim();
        const body =
            $(el).find('.prod-attr__value').text().trim() ||
            $(el).text().trim();
        if (!heading && !body) return;
        const feature: ProductFeature = {
            heading: heading || body.slice(0, 40),
            body
        };
        const benefit = inferBenefit(body);
        if (benefit) feature.benefit = benefit;
        features.push(feature);
    });

    // 상품 요약 불릿 포인트
    if (!features.length) {
        $('ul.prod-detail-bullet li, .product-item-summary li').each((_i: number, el: CheerioElement) => {
            const text = $(el).text().trim();
            if (!text || text.length < 5) return;
            const feature: ProductFeature = {
                heading: text.slice(0, 40),
                body: text
            };
            const benefit = inferBenefit(text);
            if (benefit) feature.benefit = benefit;
            features.push(feature);
        });
    }

    return dedupeFeatures(features).slice(0, 10);
}

/* ────────── 스펙 ────────── */

function extractSpecs($: CheerioRoot): Record<string, string> {
    const specs: Record<string, string> = {};

    // 쿠팡 상품 스펙 테이블
    $('.prod-spec-table tr, .prod-delivery-return-policy-table tr').each(
        (_i: number, el: CheerioElement) => {
            const key = $(el).find('th, .table-th').text().trim();
            const value = $(el).find('td, .table-td').text().trim();
            if (key && value) {
                specs[key] = value;
            }
        }
    );

    // definition list 폴백
    if (!Object.keys(specs).length) {
        $('dl.prod-spec dt').each((_i: number, el: CheerioElement) => {
            const key = $(el).text().trim();
            const value = $(el).next('dd').text().trim();
            if (key && value) specs[key] = value;
        });
    }

    return specs;
}

/* ────────── 리뷰 ────────── */

function extractReviews($: CheerioRoot): ProductReviewSnippet[] {
    const reviews: ProductReviewSnippet[] = [];

    $(
        '.sdp-review__article__list__review__content, ' +
        '.js_reviewArticleContent, ' +
        '.review-content'
    ).each((_i: number, el: CheerioElement) => {
        const quote = $(el).text().trim();
        if (!quote || quote.length < 10) return;

        const ratingEl = $(el).closest('.sdp-review__article__list__review')
            .find('.sdp-review__article__list__review__star, .rating-star-num');
        const ratingValue = normalizeNumber(ratingEl.text());

        const review: ProductReviewSnippet = {
            quote: quote.length > 200 ? quote.slice(0, 200) + '…' : quote,
            source: '쿠팡'
        };
        if (typeof ratingValue === 'number' && !Number.isNaN(ratingValue)) {
            review.rating = ratingValue;
        }
        reviews.push(review);
    });

    return reviews.slice(0, 5);
}

/* ────────── 이미지 ────────── */

function extractImages($: CheerioRoot, pageUrl: string, ld: JsonLdProduct | null): string[] {
    const urls = new Set<string>();

    // JSON-LD 이미지
    if (ld?.image) {
        const ldImages = Array.isArray(ld.image) ? ld.image : [ld.image];
        ldImages.forEach((src) => {
            try { urls.add(new URL(src, pageUrl).toString()); } catch { /* ignore */ }
        });
    }

    // OG 이미지
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
        try { urls.add(new URL(ogImage, pageUrl).toString()); } catch { /* ignore */ }
    }

    // DOM 이미지 (쿠팡 상품 이미지 영역)
    $('img.prod-image__detail, .prod-image img, .subType-IMAGE img').each(
        (_i: number, el: CheerioElement) => {
            const src = $(el).attr('data-img-src') || $(el).attr('src') || $(el).attr('data-src');
            if (!src) return;
            if (src.includes('sprite') || src.includes('icon') || src.includes('logo')) return;
            try { urls.add(new URL(src, pageUrl).toString()); } catch { /* ignore */ }
        }
    );

    return Array.from(urls);
}

/* ────────── 카테고리 ────────── */

function extractCategories($: CheerioRoot, ld: JsonLdProduct | null): string[] {
    // JSON-LD
    if (ld?.category) {
        return ld.category.split(/>|\//).map((s) => s.trim()).filter(Boolean);
    }

    // 쿠팡 breadcrumb
    const cats: string[] = [];
    $('.prod-breadcrumb-item a, .breadcrumb a').each((_i: number, el: CheerioElement) => {
        const text = $(el).text().trim();
        if (text && text !== '홈') cats.push(text);
    });
    return cats;
}

/* ────────── Utilities ────────── */

function inferBenefit(text?: string): string | undefined {
    if (!text) return undefined;
    const lower = text.toLowerCase();
    if (/(로켓|빠른|당일|새벽|무료배송)/i.test(lower)) return '빠른 배송';
    if (/(강력|고성능|파워|고출력)/i.test(lower)) return '성능 강조';
    if (/(편리|간편|원터치|자동)/i.test(lower)) return '사용 편의성';
    if (/(내구|튼튼|스테인리스|강화)/i.test(lower)) return '내구성';
    if (/(조용|저소음|무소음)/i.test(lower)) return '저소음';
    if (/(할인|특가|세일|최저가)/i.test(lower)) return '가격 경쟁력';
    if (/(친환경|유기농|무첨가)/i.test(lower)) return '친환경';
    return undefined;
}

function dedupeFeatures(features: ProductFeature[]): ProductFeature[] {
    const seen = new Set<string>();
    return features.filter((f) => {
        const key = `${f.heading}|${f.body}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return Boolean(f.body);
    });
}

function normalizeNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const digits = value.replace(/[^0-9.]/g, '');
        if (digits) {
            const parsed = parseFloat(digits);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
    }
    return undefined;
}

function safeHostname(url: string): string {
    try { return new URL(url).hostname; } catch { return 'unknown-host'; }
}
