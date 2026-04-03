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
 * 11번가(11ST) 제품 상세페이지 파서
 * ───────────────────────────────────────────── */

interface JsonLdProduct {
    name?: string;
    description?: string;
    image?: string | string[];
    offers?: {
        price?: number | string;
        priceCurrency?: string;
        seller?: { name?: string };
    } | Array<{ price?: number | string; priceCurrency?: string }>;
    aggregateRating?: { ratingValue?: number | string; reviewCount?: number | string };
    category?: string;
}

export function parse11st(html: string, pageUrl: string): ProductDetailSnapshot {
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

    const snapshot: ProductDetailSnapshot = {
        title, features, specs, reviews, images,
        officialUrl: $('link[rel="canonical"]').attr('href') || pageUrl,
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

function extractJsonLd($: CheerioRoot): JsonLdProduct | null {
    let product: JsonLdProduct | null = null;
    $('script[type="application/ld+json"]').each((_i: number, el: CheerioElement) => {
        if (product) return;
        try {
            const data = JSON.parse($(el).html() || '');
            if (data?.['@type'] === 'Product') { product = data; }
            else if (Array.isArray(data)) {
                const f = data.find((d: any) => d?.['@type'] === 'Product');
                if (f) product = f;
            }
        } catch { /* ignore */ }
    });
    return product;
}

function extractPrice($: CheerioRoot, ld: JsonLdProduct | null): ProductPriceInfo | undefined {
    if (ld?.offers) {
        const o = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
        const c = norm(o?.price);
        if (c) return { current: c, currency: o?.priceCurrency || 'KRW' };
    }
    for (const sel of ['.price_detail .value', '.final_price .price', '.sale_price', 'meta[property="product:price:amount"]']) {
        const t = sel.startsWith('meta') ? $(sel).attr('content') : $(sel).first().text();
        const v = norm(t);
        if (v) return { current: v, currency: 'KRW' };
    }
    return undefined;
}

function extractDiscount($: CheerioRoot): string | undefined {
    const m = ($('.sale_rate, .discount_rate, .c_product_price .per').first().text().trim()).match(/(\d+)\s*%/);
    return m ? `${m[1]}%` : undefined;
}

function extractDelivery($: CheerioRoot): string | undefined {
    if ($('img[alt*="슈퍼배송"], .c_product_badge_superdelivery').length) return '슈퍼배송';
    const t = $('.delivery_info .txt, .c_product_delivery .delivery_type').first().text().trim();
    if (t) return t;
    if ($('img[alt*="무료배송"], .free_delivery').length) return '무료배송';
    return undefined;
}

function extractSeller($: CheerioRoot, ld: JsonLdProduct | null): string | undefined {
    if (ld?.offers && !Array.isArray(ld.offers) && ld.offers.seller?.name) return ld.offers.seller.name;
    return $('.seller_name a, .c_product_seller .name').first().text().trim() || undefined;
}

function extractRatingMeta($: CheerioRoot, ld: JsonLdProduct | null) {
    let rating = ld?.aggregateRating ? norm(ld.aggregateRating.ratingValue) : undefined;
    let reviewCount = ld?.aggregateRating ? norm(ld.aggregateRating.reviewCount) : undefined;
    if (!rating) rating = norm($('.c_product_grade .grade, .star_score .num').first().text());
    if (!reviewCount) reviewCount = norm($('.c_product_grade .count, .review_num .num').first().text());
    const result: { rating?: number; reviewCount?: number } = {};
    if (rating !== undefined) result.rating = rating;
    if (reviewCount !== undefined) result.reviewCount = reviewCount;
    return result;
}

function extractFeatures($: CheerioRoot): ProductFeature[] {
    const features: ProductFeature[] = [];
    $('.product_detail_info li, .c_product_summary li, .benefit_list li').each((_i: number, el: CheerioElement) => {
        const t = $(el).text().trim();
        if (!t || t.length < 5) return;
        const f: ProductFeature = { heading: t.slice(0, 40), body: t };
        const b = inferBenefit(t);
        if (b) f.benefit = b;
        features.push(f);
    });
    return dedupe(features).slice(0, 10);
}

function extractSpecs($: CheerioRoot): Record<string, string> {
    const specs: Record<string, string> = {};
    $('.product_detail_info table tr, .c_product_info_detail table tr, .tbl_box tr').each((_i: number, el: CheerioElement) => {
        const k = $(el).find('th').text().trim();
        const v = $(el).find('td').text().trim();
        if (k && v) specs[k] = v;
    });
    if (!Object.keys(specs).length) {
        $('.info_detail dl dt').each((_i: number, el: CheerioElement) => {
            const k = $(el).text().trim();
            const v = $(el).next('dd').text().trim();
            if (k && v) specs[k] = v;
        });
    }
    return specs;
}

function extractReviews($: CheerioRoot): ProductReviewSnippet[] {
    const reviews: ProductReviewSnippet[] = [];
    $('.review_list .review_content, .c_product_review .review_text, .review_item .txt').each((_i: number, el: CheerioElement) => {
        const q = $(el).text().trim();
        if (!q || q.length < 10) return;
        const r: ProductReviewSnippet = { quote: q.length > 200 ? q.slice(0, 200) + '…' : q, source: '11번가' };
        const rv = norm($(el).closest('.review_item').find('.star_score .num, .grade').text());
        if (typeof rv === 'number') r.rating = rv;
        reviews.push(r);
    });
    return reviews.slice(0, 5);
}

function extractImages($: CheerioRoot, pageUrl: string, ld: JsonLdProduct | null): string[] {
    const urls = new Set<string>();
    if (ld?.image) {
        (Array.isArray(ld.image) ? ld.image : [ld.image]).forEach(s => {
            try { urls.add(new URL(s, pageUrl).toString()); } catch { /* */ }
        });
    }
    const og = $('meta[property="og:image"]').attr('content');
    if (og) try { urls.add(new URL(og, pageUrl).toString()); } catch { /* */ }
    $('.product_img img, .c_product_photo img, #productImg img, .photo_view img').each((_i: number, el: CheerioElement) => {
        const s = $(el).attr('src') || $(el).attr('data-src');
        if (!s || s.includes('sprite') || s.includes('icon')) return;
        try { urls.add(new URL(s, pageUrl).toString()); } catch { /* */ }
    });
    return Array.from(urls);
}

function extractCategories($: CheerioRoot, ld: JsonLdProduct | null): string[] {
    if (ld?.category) return ld.category.split(/>|\//).map(s => s.trim()).filter(Boolean);
    const cats: string[] = [];
    $('.category a, .breadcrumb a, .c_product_breadcrumb a').each((_i: number, el: CheerioElement) => {
        const t = $(el).text().trim();
        if (t && t !== '홈') cats.push(t);
    });
    return cats;
}

function inferBenefit(text?: string): string | undefined {
    if (!text) return undefined;
    if (/(슈퍼배송|무료배송|빠른|당일)/i.test(text)) return '빠른 배송';
    if (/(강력|고성능|파워)/i.test(text)) return '성능 강조';
    if (/(편리|간편|원터치)/i.test(text)) return '사용 편의성';
    if (/(내구|튼튼|고급)/i.test(text)) return '내구성';
    if (/(할인|특가|세일)/i.test(text)) return '가격 경쟁력';
    return undefined;
}

function dedupe(features: ProductFeature[]): ProductFeature[] {
    const seen = new Set<string>();
    return features.filter(f => {
        const k = `${f.heading}|${f.body}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return Boolean(f.body);
    });
}

function norm(v: any): number | undefined {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const d = v.replace(/[^0-9.]/g, '');
        if (d) { const p = parseFloat(d); return Number.isFinite(p) ? p : undefined; }
    }
    return undefined;
}

function safeHostname(url: string): string {
    try { return new URL(url).hostname; } catch { return 'unknown-host'; }
}
