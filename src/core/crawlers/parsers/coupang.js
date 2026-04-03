"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCoupang = parseCoupang;
const cheerio = __importStar(require("cheerio"));
function parseCoupang(html, pageUrl) {
    const $ = cheerio.load(html);
    const ld = extractJsonLdProduct($);
    /* ── 제목 ── */
    const title = ld?.name ||
        $('h2.prod-buy-header__title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().trim() ||
        '제목 없음';
    /* ── 설명 ── */
    const description = ld?.description ||
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
    const officialUrl = $('link[rel="canonical"]').attr('href') || pageUrl;
    const snapshot = {
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
    if (description)
        snapshot.description = description;
    if (price)
        snapshot.price = price;
    if (delivery)
        snapshot.delivery = delivery;
    if (seller)
        snapshot.seller = seller;
    if (typeof rating === 'number')
        snapshot.rating = rating;
    if (typeof reviewCount === 'number')
        snapshot.reviewCount = reviewCount;
    if (discount)
        snapshot.discount = discount;
    if (categories.length)
        snapshot.categories = categories;
    return snapshot;
}
/* ────────── JSON-LD 추출 ────────── */
function extractJsonLdProduct($) {
    let product = null;
    $('script[type="application/ld+json"]').each((_i, el) => {
        if (product)
            return;
        try {
            const data = JSON.parse($(el).html() || '');
            if (data?.['@type'] === 'Product') {
                product = data;
            }
            else if (Array.isArray(data)) {
                const found = data.find((item) => item?.['@type'] === 'Product');
                if (found)
                    product = found;
            }
        }
        catch {
            /* ignore parse errors */
        }
    });
    return product;
}
/* ────────── 가격 ────────── */
function extractPrice($, ld) {
    // JSON-LD 우선
    if (ld?.offers) {
        const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const current = normalizeNumber(offer?.price);
        if (current) {
            const priceInfo = {
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
function extractDiscount($) {
    const discountEl = $('.prod-sale-rate').first().text().trim() ||
        $('.discount-rate').first().text().trim();
    const match = discountEl.match(/(\d+)\s*%/);
    return match ? `${match[1]}%` : undefined;
}
/* ────────── 배송 ────────── */
function extractDelivery($) {
    const rocketBadge = $('img[alt*="로켓"], .badge--rocket, .delivery-type').first();
    if (rocketBadge.length) {
        const alt = rocketBadge.attr('alt') || rocketBadge.text().trim();
        if (/로켓배송/i.test(alt))
            return '로켓배송';
        if (/로켓와우/i.test(alt))
            return '로켓와우';
        if (/로켓직구/i.test(alt))
            return '로켓직구';
        if (/로켓프레시/i.test(alt))
            return '로켓프레시';
        return alt || '일반배송';
    }
    const deliveryInfo = $('.prod-shipping-fee-message, .delivery-info').first().text().trim();
    if (deliveryInfo)
        return deliveryInfo;
    return undefined;
}
/* ────────── 판매자 ────────── */
function extractSeller($, ld) {
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name) {
        return ld.offers.seller.name;
    }
    return ($('a.prod-sale-vendor-name').first().text().trim() ||
        $('.seller-name').first().text().trim() ||
        undefined);
}
/* ────────── 평점 & 리뷰 수 ────────── */
function extractRatingMeta($, ld) {
    let rating;
    let reviewCount;
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
    const result = {};
    if (rating !== undefined)
        result.rating = rating;
    if (reviewCount !== undefined)
        result.reviewCount = reviewCount;
    return result;
}
/* ────────── 특징 ────────── */
function extractFeatures($) {
    const features = [];
    // 쿠팡 상품 특징 / 요약 섹션
    $('.prod-description__item, .prod-attr__item').each((_i, el) => {
        const heading = $(el).find('.prod-attr__key, strong').first().text().trim();
        const body = $(el).find('.prod-attr__value').text().trim() ||
            $(el).text().trim();
        if (!heading && !body)
            return;
        const feature = {
            heading: heading || body.slice(0, 40),
            body
        };
        const benefit = inferBenefit(body);
        if (benefit)
            feature.benefit = benefit;
        features.push(feature);
    });
    // 상품 요약 불릿 포인트
    if (!features.length) {
        $('ul.prod-detail-bullet li, .product-item-summary li').each((_i, el) => {
            const text = $(el).text().trim();
            if (!text || text.length < 5)
                return;
            const feature = {
                heading: text.slice(0, 40),
                body: text
            };
            const benefit = inferBenefit(text);
            if (benefit)
                feature.benefit = benefit;
            features.push(feature);
        });
    }
    return dedupeFeatures(features).slice(0, 10);
}
/* ────────── 스펙 ────────── */
function extractSpecs($) {
    const specs = {};
    // 쿠팡 상품 스펙 테이블
    $('.prod-spec-table tr, .prod-delivery-return-policy-table tr').each((_i, el) => {
        const key = $(el).find('th, .table-th').text().trim();
        const value = $(el).find('td, .table-td').text().trim();
        if (key && value) {
            specs[key] = value;
        }
    });
    // definition list 폴백
    if (!Object.keys(specs).length) {
        $('dl.prod-spec dt').each((_i, el) => {
            const key = $(el).text().trim();
            const value = $(el).next('dd').text().trim();
            if (key && value)
                specs[key] = value;
        });
    }
    return specs;
}
/* ────────── 리뷰 ────────── */
function extractReviews($) {
    const reviews = [];
    $('.sdp-review__article__list__review__content, ' +
        '.js_reviewArticleContent, ' +
        '.review-content').each((_i, el) => {
        const quote = $(el).text().trim();
        if (!quote || quote.length < 10)
            return;
        const ratingEl = $(el).closest('.sdp-review__article__list__review')
            .find('.sdp-review__article__list__review__star, .rating-star-num');
        const ratingValue = normalizeNumber(ratingEl.text());
        const review = {
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
function extractImages($, pageUrl, ld) {
    const urls = new Set();
    // JSON-LD 이미지
    if (ld?.image) {
        const ldImages = Array.isArray(ld.image) ? ld.image : [ld.image];
        ldImages.forEach((src) => {
            try {
                urls.add(new URL(src, pageUrl).toString());
            }
            catch { /* ignore */ }
        });
    }
    // OG 이미지
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
        try {
            urls.add(new URL(ogImage, pageUrl).toString());
        }
        catch { /* ignore */ }
    }
    // DOM 이미지 (쿠팡 상품 이미지 영역)
    $('img.prod-image__detail, .prod-image img, .subType-IMAGE img').each((_i, el) => {
        const src = $(el).attr('data-img-src') || $(el).attr('src') || $(el).attr('data-src');
        if (!src)
            return;
        if (src.includes('sprite') || src.includes('icon') || src.includes('logo'))
            return;
        try {
            urls.add(new URL(src, pageUrl).toString());
        }
        catch { /* ignore */ }
    });
    return Array.from(urls);
}
/* ────────── 카테고리 ────────── */
function extractCategories($, ld) {
    // JSON-LD
    if (ld?.category) {
        return ld.category.split(/>|\//).map((s) => s.trim()).filter(Boolean);
    }
    // 쿠팡 breadcrumb
    const cats = [];
    $('.prod-breadcrumb-item a, .breadcrumb a').each((_i, el) => {
        const text = $(el).text().trim();
        if (text && text !== '홈')
            cats.push(text);
    });
    return cats;
}
/* ────────── Utilities ────────── */
function inferBenefit(text) {
    if (!text)
        return undefined;
    const lower = text.toLowerCase();
    if (/(로켓|빠른|당일|새벽|무료배송)/i.test(lower))
        return '빠른 배송';
    if (/(강력|고성능|파워|고출력)/i.test(lower))
        return '성능 강조';
    if (/(편리|간편|원터치|자동)/i.test(lower))
        return '사용 편의성';
    if (/(내구|튼튼|스테인리스|강화)/i.test(lower))
        return '내구성';
    if (/(조용|저소음|무소음)/i.test(lower))
        return '저소음';
    if (/(할인|특가|세일|최저가)/i.test(lower))
        return '가격 경쟁력';
    if (/(친환경|유기농|무첨가)/i.test(lower))
        return '친환경';
    return undefined;
}
function dedupeFeatures(features) {
    const seen = new Set();
    return features.filter((f) => {
        const key = `${f.heading}|${f.body}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return Boolean(f.body);
    });
}
function normalizeNumber(value) {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const digits = value.replace(/[^0-9.]/g, '');
        if (digits) {
            const parsed = parseFloat(digits);
            return Number.isFinite(parsed) ? parsed : undefined;
        }
    }
    return undefined;
}
function safeHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'unknown-host';
    }
}
