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
exports.parseTemu = parseTemu;
const cheerio = __importStar(require("cheerio"));
function parseTemu(html, pageUrl) {
    const $ = cheerio.load(html);
    const initialData = extractInitialData(html);
    const ld = extractJsonLd($);
    const title = initialData?.store?.goods?.goodsName ||
        ld?.name ||
        $('meta[property="og:title"]').attr('content')?.trim() ||
        $('h1, .goods-title, [class*="ProductTitle"]').first().text().trim() ||
        $('title').text().trim() || '제목 없음';
    const description = initialData?.store?.goods?.goodsDesc ||
        ld?.description ||
        $('meta[name="description"]').attr('content')?.trim() ||
        undefined;
    const price = extractPrice($, ld, initialData);
    const discount = extractDiscount($, initialData);
    const delivery = extractDelivery($);
    const seller = extractSeller($, ld, initialData);
    const { rating, reviewCount } = extractRatingMeta($, ld, initialData);
    const features = extractFeatures($, initialData);
    const specs = extractSpecs($, initialData);
    const reviews = extractReviews($, initialData);
    const images = extractImages($, pageUrl, ld, initialData);
    const categories = extractCategories($, ld, initialData);
    const snapshot = {
        title, features, specs, reviews, images,
        officialUrl: $('link[rel="canonical"]').attr('href') || pageUrl,
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
/* ────────── __INITIAL_DATA__ 추출 ────────── */
function extractInitialData(html) {
    // Temu 패턴 1: window.__INITIAL_DATA__
    const patterns = [
        /window\.__INITIAL_DATA__\s*=\s*({.+?});?\s*<\/script>/s,
        /window\.rawData\s*=\s*({.+?});?\s*<\/script>/s,
        /__NEXT_DATA__.*?({.+?})\s*<\/script>/s
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) {
            try {
                return JSON.parse(match[1]);
            }
            catch { /* continue */ }
        }
    }
    return null;
}
function extractJsonLd($) {
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
                const f = data.find((d) => d?.['@type'] === 'Product');
                if (f)
                    product = f;
            }
        }
        catch { /* ignore */ }
    });
    return product;
}
/* ────────── 가격 ────────── */
function extractPrice($, ld, data) {
    // initialData 우선
    const goodsPrice = data?.store?.goods?.salePrice || data?.store?.goods?.minPrice;
    if (goodsPrice) {
        const current = norm(goodsPrice);
        if (current) {
            const original = norm(data?.store?.goods?.originalPrice || data?.store?.goods?.marketPrice);
            const info = { current, currency: 'USD' };
            if (original && original > current)
                info.original = original;
            return info;
        }
    }
    // JSON-LD
    if (ld?.offers) {
        const o = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const c = norm(o?.price);
        if (c)
            return { current: c, currency: o?.priceCurrency || 'USD' };
    }
    // DOM 폴백
    for (const sel of ['.goods-price .price, [class*="SalePrice"]', 'meta[property="product:price:amount"]']) {
        const t = sel.startsWith('meta') ? $(sel).attr('content') : $(sel).first().text();
        const v = norm(t);
        if (v)
            return { current: v, currency: 'USD' };
    }
    return undefined;
}
/* ────────── 할인율 ────────── */
function extractDiscount($, data) {
    const discountRate = data?.store?.goods?.discount;
    if (discountRate)
        return typeof discountRate === 'number' ? `${discountRate}%` : String(discountRate);
    const m = ($('[class*="Discount"], .goods-discount').first().text().trim()).match(/(\d+)\s*%/);
    return m ? `${m[1]}%` : undefined;
}
/* ────────── 배송 ────────── */
function extractDelivery($) {
    const t = $('[class*="Delivery"], [class*="shipping"], .delivery-info').first().text().trim();
    if (t)
        return t;
    if ($('img[alt*="Free shipping"], [class*="FreeShipping"]').length)
        return 'Free Shipping';
    return undefined;
}
/* ────────── 판매자 ────────── */
function extractSeller($, ld, data) {
    if (data?.store?.goods?.shopName)
        return data.store.goods.shopName;
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name)
        return ld.offers.seller.name;
    return $('[class*="SellerName"], .shop-name').first().text().trim() || undefined;
}
/* ────────── 평점 & 리뷰 수 ────────── */
function extractRatingMeta($, ld, data) {
    let rating = norm(data?.store?.goods?.avgRating);
    let reviewCount = norm(data?.store?.goods?.reviewCount || data?.store?.goods?.totalReviews);
    if (!rating && ld?.aggregateRating)
        rating = norm(ld.aggregateRating.ratingValue);
    if (!reviewCount && ld?.aggregateRating)
        reviewCount = norm(ld.aggregateRating.reviewCount);
    if (!rating)
        rating = norm($('[class*="Rating"] .score, .star-score .num').first().text());
    if (!reviewCount)
        reviewCount = norm($('[class*="ReviewCount"], .review-count').first().text());
    const result = {};
    if (rating !== undefined)
        result.rating = rating;
    if (reviewCount !== undefined)
        result.reviewCount = reviewCount;
    return result;
}
/* ────────── 특징 ────────── */
function extractFeatures($, data) {
    const features = [];
    // initialData 셀링포인트
    const points = data?.store?.goods?.sellingPoints;
    if (Array.isArray(points)) {
        points.slice(0, 6).forEach((p) => {
            const text = typeof p === 'string' ? p : p?.text || p?.title;
            if (!text)
                return;
            const f = { heading: text.slice(0, 40), body: text };
            const b = inferBenefit(text);
            if (b)
                f.benefit = b;
            features.push(f);
        });
    }
    // DOM 폴백
    if (!features.length) {
        $('[class*="ProductFeature"] li, .goods-feature li, [class*="Highlight"]').each((_i, el) => {
            const t = $(el).text().trim();
            if (!t || t.length < 5)
                return;
            features.push({ heading: t.slice(0, 40), body: t });
        });
    }
    return dedupe(features).slice(0, 10);
}
/* ────────── 스펙 ────────── */
function extractSpecs($, data) {
    const specs = {};
    // initialData 속성
    const attrs = data?.store?.goods?.attributes || data?.store?.goods?.specs;
    if (Array.isArray(attrs)) {
        attrs.forEach((a) => {
            const k = a.attrName || a.name || a.key;
            const v = a.attrValue || a.value || a.val;
            if (k && v)
                specs[String(k).trim()] = String(v).trim();
        });
    }
    // DOM 폴백
    if (!Object.keys(specs).length) {
        $('[class*="Spec"] table tr, .goods-spec table tr').each((_i, el) => {
            const k = $(el).find('th, td:first-child').text().trim();
            const v = $(el).find('td:last-child').text().trim();
            if (k && v && k !== v)
                specs[k] = v;
        });
    }
    return specs;
}
/* ────────── 리뷰 ────────── */
function extractReviews($, data) {
    const reviews = [];
    // initialData 리뷰
    const reviewList = data?.store?.goods?.reviews || data?.store?.review?.reviewList;
    if (Array.isArray(reviewList)) {
        reviewList.slice(0, 5).forEach((r) => {
            const quote = r.content || r.comment || r.text;
            if (!quote)
                return;
            const rv = {
                quote: quote.length > 200 ? quote.slice(0, 200) + '…' : quote,
                source: 'Temu'
            };
            const ratingVal = norm(r.rating || r.star);
            if (typeof ratingVal === 'number')
                rv.rating = ratingVal;
            reviews.push(rv);
        });
    }
    // DOM 폴백
    if (!reviews.length) {
        $('[class*="ReviewContent"], .review-text').each((_i, el) => {
            const q = $(el).text().trim();
            if (!q || q.length < 10)
                return;
            reviews.push({ quote: q.length > 200 ? q.slice(0, 200) + '…' : q, source: 'Temu' });
        });
    }
    return reviews.slice(0, 5);
}
/* ────────── 이미지 ────────── */
function extractImages($, pageUrl, ld, data) {
    const urls = new Set();
    // initialData 이미지
    const imgList = data?.store?.goods?.images || data?.store?.goods?.galleryImages;
    if (Array.isArray(imgList)) {
        imgList.forEach((img) => {
            const src = typeof img === 'string' ? img : img?.url || img?.src;
            if (src)
                try {
                    urls.add(new URL(src, pageUrl).toString());
                }
                catch { /* */ }
        });
    }
    // JSON-LD
    if (ld?.image) {
        (Array.isArray(ld.image) ? ld.image : [ld.image]).forEach(s => {
            try {
                urls.add(new URL(s, pageUrl).toString());
            }
            catch { /* */ }
        });
    }
    // OG image
    const og = $('meta[property="og:image"]').attr('content');
    if (og)
        try {
            urls.add(new URL(og, pageUrl).toString());
        }
        catch { /* */ }
    // DOM
    $('[class*="GalleryImage"] img, .goods-gallery img').each((_i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (!src || src.includes('icon') || src.includes('sprite'))
            return;
        try {
            urls.add(new URL(src, pageUrl).toString());
        }
        catch { /* */ }
    });
    return Array.from(urls);
}
/* ────────── 카테고리 ────────── */
function extractCategories($, ld, data) {
    const catPath = data?.store?.goods?.categoryPath;
    if (typeof catPath === 'string')
        return catPath.split(/>|\//).map(s => s.trim()).filter(Boolean);
    if (Array.isArray(catPath))
        return catPath.map((c) => typeof c === 'string' ? c : c?.name).filter(Boolean);
    if (ld?.category)
        return ld.category.split(/>|\//).map(s => s.trim()).filter(Boolean);
    const cats = [];
    $('[class*="Breadcrumb"] a, .breadcrumb a').each((_i, el) => {
        const t = $(el).text().trim();
        if (t && t !== 'Home')
            cats.push(t);
    });
    return cats;
}
/* ────────── Utilities ────────── */
function inferBenefit(text) {
    if (!text)
        return undefined;
    if (/(free shipping|무료배송|fast delivery)/i.test(text))
        return '빠른 배송';
    if (/(powerful|strong|고성능)/i.test(text))
        return '성능 강조';
    if (/(easy|convenient|portable|편리)/i.test(text))
        return '사용 편의성';
    if (/(durable|sturdy|내구)/i.test(text))
        return '내구성';
    if (/(discount|sale|할인|off)/i.test(text))
        return '가격 경쟁력';
    return undefined;
}
function dedupe(features) {
    const seen = new Set();
    return features.filter(f => {
        const k = `${f.heading}|${f.body}`;
        if (seen.has(k))
            return false;
        seen.add(k);
        return Boolean(f.body);
    });
}
function norm(v) {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string') {
        const d = v.replace(/[^0-9.]/g, '');
        if (d) {
            const p = parseFloat(d);
            return Number.isFinite(p) ? p : undefined;
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
