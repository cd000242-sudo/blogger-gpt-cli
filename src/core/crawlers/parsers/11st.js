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
exports.parse11st = parse11st;
const cheerio = __importStar(require("cheerio"));
function parse11st(html, pageUrl) {
    const $ = cheerio.load(html);
    const ld = extractJsonLd($);
    const title = ld?.name
        || $('h1.title, .c_product_info_title h1, #productName').first().text().trim()
        || $('meta[property="og:title"]').attr('content')?.trim()
        || $('title').text().trim() || '제목 없음';
    const description = ld?.description
        || $('meta[name="description"]').attr('content')?.trim()
        || undefined;
    const price = extractPrice($, ld);
    const discount = extractDiscount($);
    const delivery = extractDelivery($);
    const seller = extractSeller($, ld);
    const { rating, reviewCount } = extractRatingMeta($, ld);
    const features = extractFeatures($);
    const specs = extractSpecs($);
    const reviews = extractReviews($);
    const images = extractImages($, pageUrl, ld);
    const categories = extractCategories($, ld);
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
function extractPrice($, ld) {
    if (ld?.offers) {
        const o = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const c = norm(o?.price);
        if (c)
            return { current: c, currency: o?.priceCurrency || 'KRW' };
    }
    for (const sel of ['.price_detail .value', '.final_price .price', '.sale_price', 'meta[property="product:price:amount"]']) {
        const t = sel.startsWith('meta') ? $(sel).attr('content') : $(sel).first().text();
        const v = norm(t);
        if (v)
            return { current: v, currency: 'KRW' };
    }
    return undefined;
}
function extractDiscount($) {
    const m = ($('.sale_rate, .discount_rate, .c_product_price .per').first().text().trim()).match(/(\d+)\s*%/);
    return m ? `${m[1]}%` : undefined;
}
function extractDelivery($) {
    if ($('img[alt*="슈퍼배송"], .c_product_badge_superdelivery').length)
        return '슈퍼배송';
    const t = $('.delivery_info .txt, .c_product_delivery .delivery_type').first().text().trim();
    if (t)
        return t;
    if ($('img[alt*="무료배송"], .free_delivery').length)
        return '무료배송';
    return undefined;
}
function extractSeller($, ld) {
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name)
        return ld.offers.seller.name;
    return $('.seller_name a, .c_product_seller .name').first().text().trim() || undefined;
}
function extractRatingMeta($, ld) {
    let rating = ld?.aggregateRating ? norm(ld.aggregateRating.ratingValue) : undefined;
    let reviewCount = ld?.aggregateRating ? norm(ld.aggregateRating.reviewCount) : undefined;
    if (!rating)
        rating = norm($('.c_product_grade .grade, .star_score .num').first().text());
    if (!reviewCount)
        reviewCount = norm($('.c_product_grade .count, .review_num .num').first().text());
    const result = {};
    if (rating !== undefined)
        result.rating = rating;
    if (reviewCount !== undefined)
        result.reviewCount = reviewCount;
    return result;
}
function extractFeatures($) {
    const features = [];
    $('.product_detail_info li, .c_product_summary li, .benefit_list li').each((_i, el) => {
        const t = $(el).text().trim();
        if (!t || t.length < 5)
            return;
        const f = { heading: t.slice(0, 40), body: t };
        const b = inferBenefit(t);
        if (b)
            f.benefit = b;
        features.push(f);
    });
    return dedupe(features).slice(0, 10);
}
function extractSpecs($) {
    const specs = {};
    $('.product_detail_info table tr, .c_product_info_detail table tr, .tbl_box tr').each((_i, el) => {
        const k = $(el).find('th').text().trim();
        const v = $(el).find('td').text().trim();
        if (k && v)
            specs[k] = v;
    });
    if (!Object.keys(specs).length) {
        $('.info_detail dl dt').each((_i, el) => {
            const k = $(el).text().trim();
            const v = $(el).next('dd').text().trim();
            if (k && v)
                specs[k] = v;
        });
    }
    return specs;
}
function extractReviews($) {
    const reviews = [];
    $('.review_list .review_content, .c_product_review .review_text, .review_item .txt').each((_i, el) => {
        const q = $(el).text().trim();
        if (!q || q.length < 10)
            return;
        const r = { quote: q.length > 200 ? q.slice(0, 200) + '…' : q, source: '11번가' };
        const rv = norm($(el).closest('.review_item').find('.star_score .num, .grade').text());
        if (typeof rv === 'number')
            r.rating = rv;
        reviews.push(r);
    });
    return reviews.slice(0, 5);
}
function extractImages($, pageUrl, ld) {
    const urls = new Set();
    if (ld?.image) {
        (Array.isArray(ld.image) ? ld.image : [ld.image]).forEach(s => {
            try {
                urls.add(new URL(s, pageUrl).toString());
            }
            catch { /* */ }
        });
    }
    const og = $('meta[property="og:image"]').attr('content');
    if (og)
        try {
            urls.add(new URL(og, pageUrl).toString());
        }
        catch { /* */ }
    $('.product_img img, .c_product_photo img, #productImg img, .photo_view img').each((_i, el) => {
        const s = $(el).attr('src') || $(el).attr('data-src');
        if (!s || s.includes('sprite') || s.includes('icon'))
            return;
        try {
            urls.add(new URL(s, pageUrl).toString());
        }
        catch { /* */ }
    });
    return Array.from(urls);
}
function extractCategories($, ld) {
    if (ld?.category)
        return ld.category.split(/>|\//).map(s => s.trim()).filter(Boolean);
    const cats = [];
    $('.category a, .breadcrumb a, .c_product_breadcrumb a').each((_i, el) => {
        const t = $(el).text().trim();
        if (t && t !== '홈')
            cats.push(t);
    });
    return cats;
}
function inferBenefit(text) {
    if (!text)
        return undefined;
    if (/(슈퍼배송|무료배송|빠른|당일)/i.test(text))
        return '빠른 배송';
    if (/(강력|고성능|파워)/i.test(text))
        return '성능 강조';
    if (/(편리|간편|원터치)/i.test(text))
        return '사용 편의성';
    if (/(내구|튼튼|고급)/i.test(text))
        return '내구성';
    if (/(할인|특가|세일)/i.test(text))
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
