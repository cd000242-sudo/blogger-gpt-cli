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
exports.parseGmarketAuction = parseGmarketAuction;
const cheerio = __importStar(require("cheerio"));
function parseGmarketAuction(html, pageUrl) {
    const $ = cheerio.load(html);
    const ld = extractJsonLdProduct($);
    const isAuction = /auction\.co\.kr/i.test(pageUrl);
    const platformName = isAuction ? '옥션' : 'G마켓';
    /* ── 제목 ── */
    const title = ld?.name ||
        $('.itemtit, .item-title h1, h1.title').first().text().trim() ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('title').text().trim() ||
        '제목 없음';
    /* ── 설명 ── */
    const description = ld?.description ||
        $('meta[name="description"]').attr('content')?.trim() ||
        undefined;
    /* ── 가격 ── */
    const price = extractPrice($, ld);
    /* ── 할인율 ── */
    const discount = extractDiscount($);
    /* ── 배송 ── */
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
    const reviews = extractReviews($, platformName);
    /* ── 이미지 ── */
    const images = extractImages($, pageUrl, ld);
    /* ── 카테고리 ── */
    const categories = extractCategories($, ld);
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
/* ────────── JSON-LD ────────── */
function extractJsonLdProduct($) {
    let product = null;
    $('script[type="application/ld+json"]').each((_i, el) => {
        if (product)
            return;
        try {
            const data = JSON.parse($(el).html() || '');
            if (data?.['@type'] === 'Product') {
                product = data;
                return;
            }
            if (Array.isArray(data)) {
                const found = data.find((item) => item?.['@type'] === 'Product');
                if (found)
                    product = found;
            }
        }
        catch { /* ignore */ }
    });
    return product;
}
/* ────────── 가격 ────────── */
function extractPrice($, ld) {
    if (ld?.offers) {
        const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const current = normalizeNumber(offer?.price);
        if (current)
            return { current, currency: offer?.priceCurrency || 'KRW' };
    }
    const selectors = [
        '.price_real strong, .price_real',
        '.sale_price .price',
        '.item-price .price',
        '.price_total .price_num',
        'meta[property="product:price:amount"]'
    ];
    for (const sel of selectors) {
        const text = sel.startsWith('meta') ? $(sel).attr('content') : $(sel).first().text();
        const value = normalizeNumber(text);
        if (value)
            return { current: value, currency: 'KRW' };
    }
    return undefined;
}
/* ────────── 할인율 ────────── */
function extractDiscount($) {
    const discountText = $('.rate_sale, .price_off .off, .discount-rate').first().text().trim();
    const match = discountText.match(/(\d+)\s*%/);
    return match ? `${match[1]}%` : undefined;
}
/* ────────── 배송 ── */
function extractDelivery($) {
    const deliveryText = $('.delivery_type, .delivery-info, .ship_fee').first().text().trim();
    if (deliveryText)
        return deliveryText;
    if ($('img[alt*="무료배송"], .badge-free-shipping').length)
        return '무료배송';
    return undefined;
}
/* ────────── 판매자 ────────── */
function extractSeller($, ld) {
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name) {
        return ld.offers.seller.name;
    }
    return ($('.seller-info .seller_name, .seller_name a').first().text().trim() ||
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
        rating = normalizeNumber($('.item_score .num, .star-score .score, .point_area .num').first().text());
    }
    if (!reviewCount) {
        reviewCount = normalizeNumber($('.satisfaction_count, .review_count').first().text());
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
    // G마켓/옥션 상품 부가정보
    $('.item_detail_info li, .detail_cont li, .prd_detail_info li').each((_i, el) => {
        const text = $(el).text().trim();
        if (!text || text.length < 5)
            return;
        const heading = text.slice(0, 40);
        const feature = { heading, body: text };
        const benefit = inferBenefit(text);
        if (benefit)
            feature.benefit = benefit;
        features.push(feature);
    });
    // 옵션/타이틀에서 특징 분리
    if (!features.length) {
        const titleText = $('h1, .itemtit').first().text().trim();
        if (titleText) {
            titleText.split(/[\/\|,]/).map((s) => s.trim()).filter((s) => s.length > 3)
                .slice(0, 5).forEach((chunk) => {
                features.push({
                    heading: chunk.slice(0, 40),
                    body: chunk
                });
            });
        }
    }
    return dedupeFeatures(features).slice(0, 10);
}
/* ────────── 스펙 ────────── */
function extractSpecs($) {
    const specs = {};
    // 상품 정보 테이블
    $('.item_info table tr, .detail_view_tbl tr, .tbl_item_info tr').each((_i, el) => {
        const key = $(el).find('th, .info_tit').text().trim();
        const value = $(el).find('td, .info_desc').text().trim();
        if (key && value)
            specs[key] = value;
    });
    // dt/dd 폴백
    if (!Object.keys(specs).length) {
        $('.item_info dl dt, .prd_detail dt').each((_i, el) => {
            const key = $(el).text().trim();
            const value = $(el).next('dd').text().trim();
            if (key && value)
                specs[key] = value;
        });
    }
    return specs;
}
/* ────────── 리뷰 ────────── */
function extractReviews($, platform) {
    const reviews = [];
    $('.review_list .review_content, ' +
        '.review_data .review_text, ' +
        '.sdp-review__article__list__review__content').each((_i, el) => {
        const quote = $(el).text().trim();
        if (!quote || quote.length < 10)
            return;
        const ratingEl = $(el).closest('.review_item, .review_data').find('.point_area .num, .star_score');
        const ratingValue = normalizeNumber(ratingEl.text());
        const review = {
            quote: quote.length > 200 ? quote.slice(0, 200) + '…' : quote,
            source: platform
        };
        if (typeof ratingValue === 'number')
            review.rating = ratingValue;
        reviews.push(review);
    });
    return reviews.slice(0, 5);
}
/* ────────── 이미지 ────────── */
function extractImages($, pageUrl, ld) {
    const urls = new Set();
    if (ld?.image) {
        const ldImages = Array.isArray(ld.image) ? ld.image : [ld.image];
        ldImages.forEach((src) => {
            try {
                urls.add(new URL(src, pageUrl).toString());
            }
            catch { /* ignore */ }
        });
    }
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
        try {
            urls.add(new URL(ogImage, pageUrl).toString());
        }
        catch { /* ignore */ }
    }
    $('.thumb-gallery img, ' +
        '.item-image img, ' +
        '.viewer_img img, ' +
        '#mainImg, ' +
        '.img_photo_bigger img').each((_i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
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
    if (ld?.category) {
        return ld.category.split(/>|\//).map((s) => s.trim()).filter(Boolean);
    }
    const cats = [];
    $('.location-navi a, .breadcrumb a, .location a').each((_i, el) => {
        const text = $(el).text().trim();
        if (text && text !== '홈' && text !== 'HOME')
            cats.push(text);
    });
    return cats;
}
/* ────────── Utilities ────────── */
function inferBenefit(text) {
    if (!text)
        return undefined;
    const lower = text.toLowerCase();
    if (/(무료배송|빠른배송|당일|새벽)/i.test(lower))
        return '빠른 배송';
    if (/(강력|고성능|파워)/i.test(lower))
        return '성능 강조';
    if (/(편리|간편|원터치)/i.test(lower))
        return '사용 편의성';
    if (/(내구|튼튼|고급)/i.test(lower))
        return '내구성';
    if (/(조용|저소음)/i.test(lower))
        return '저소음';
    if (/(할인|특가|세일)/i.test(lower))
        return '가격 경쟁력';
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
