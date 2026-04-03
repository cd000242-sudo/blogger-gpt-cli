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
exports.parseNaverShoppingConnect = parseNaverShoppingConnect;
const cheerio = __importStar(require("cheerio"));
function parseNaverShoppingConnect(html, pageUrl) {
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') ||
        $('h2[class*="ProductTitle"], h1[class*="ProductTitle"]').first().text().trim() ||
        $('title').text().trim() ||
        '제목 없음';
    const description = $('meta[name="description"]').attr('content') ||
        $('.product_summary, .summary_text').first().text().trim() ||
        undefined;
    const price = extractPrice($);
    const features = extractFeatures($);
    const specs = extractSpecs($);
    const reviews = extractReviews($);
    const images = extractImages($, pageUrl);
    const officialUrl = $('a[data-nclick*="prd.buy"], a[data-event="purchase"]').attr('href') ||
        $('link[rel="canonical"]').attr('href') ||
        pageUrl;
    const snapshot = {
        title,
        features,
        specs,
        reviews,
        images,
        sourceDomain: safeHostname(pageUrl),
        capturedAt: new Date().toISOString(),
        rawUrl: pageUrl
    };
    if (description) {
        snapshot.description = description;
    }
    if (price) {
        snapshot.price = price;
    }
    if (officialUrl) {
        snapshot.officialUrl = officialUrl;
    }
    return snapshot;
}
function extractPrice($) {
    const priceCandidates = [
        $('.price_num .num').first().text(),
        $('.price_now, .price_current').first().text(),
        $('meta[property="product:price:amount"]').attr('content')
    ];
    for (const candidate of priceCandidates) {
        const digits = (candidate || '').replace(/[^0-9]/g, '');
        if (digits) {
            return {
                current: Number(digits),
                currency: inferCurrency($)
            };
        }
    }
    return undefined;
}
function inferCurrency($) {
    const currency = $('meta[property="product:price:currency"]').attr('content') ||
        $('span[class*="currency"]').first().text().trim();
    if (!currency)
        return 'KRW';
    if (/원|KRW/i.test(currency))
        return 'KRW';
    if (/USD/i.test(currency))
        return 'USD';
    return currency;
}
function extractFeatures($) {
    const features = [];
    $('.feature_list li, .product_feature li').each((_idx, el) => {
        const heading = $(el).find('.feature_title, .feature-name').text().trim() ||
            $(el).find('strong').first().text().trim();
        const body = $(el).find('.feature_desc, .feature-description').text().trim() ||
            $(el).text().trim();
        if (!heading && !body)
            return;
        const feature = {
            heading: heading || body?.slice(0, 32) || '특징',
            body
        };
        const benefit = inferBenefit(body);
        if (benefit) {
            feature.benefit = benefit;
        }
        features.push(feature);
    });
    if (!features.length) {
        $('.product_detail_box h4').each((_idx, el) => {
            const heading = $(el).text().trim();
            const body = $(el).nextUntil('h4').text().trim();
            if (heading || body) {
                const feature = {
                    heading: heading || '상세 설명',
                    body
                };
                const benefit = inferBenefit(body);
                if (benefit) {
                    feature.benefit = benefit;
                }
                features.push(feature);
            }
        });
    }
    return features.slice(0, 10);
}
function inferBenefit(body) {
    if (!body)
        return undefined;
    const phrases = [
        { test: /(강력|고성능|파워)/, label: '성능 강조' },
        { test: /(컴팩트|슬림|휴대)/, label: '휴대성' },
        { test: /(조용|저소음)/, label: '저소음' },
        { test: /(내구|튼튼|고급)/, label: '내구성' },
        { test: /(간편|쉬운|원터치)/, label: '사용 편의성' }
    ];
    const matched = phrases.find((item) => item.test.test(body));
    return matched?.label;
}
function extractSpecs($) {
    const specs = {};
    $('.spec_table tr, table[class*="spec"] tr').each((_idx, el) => {
        const key = $(el).find('th, .spec_name').text().trim();
        const value = $(el).find('td, .spec_desc').text().trim();
        if (key && value) {
            specs[key] = value;
        }
    });
    if (!Object.keys(specs).length) {
        // fallback: definition list
        $('.spec_list dt').each((_idx, el) => {
            const key = $(el).text().trim();
            const value = $(el).next('dd').text().trim();
            if (key && value) {
                specs[key] = value;
            }
        });
    }
    return specs;
}
function extractReviews($) {
    const reviews = [];
    $('.review_card, .review_list .item').each((_idx, el) => {
        const quote = $(el).find('.review_text, .text').text().trim() ||
            $(el).find('p').first().text().trim();
        if (!quote)
            return;
        const ratingText = $(el).find('.review_rating, .star_score .score').text().trim() ||
            $(el).find('[class*="rating"]').attr('data-rating') ||
            '';
        const ratingValue = parseFloat(ratingText.replace(/[^0-9.]/g, ''));
        const review = {
            quote,
            source: '네이버 쇼핑'
        };
        if (!Number.isNaN(ratingValue)) {
            review.rating = ratingValue;
        }
        reviews.push(review);
    });
    return reviews.slice(0, 5);
}
function extractImages($, pageUrl) {
    const host = safeHostname(pageUrl);
    const trimmedHost = host.replace(/^www\./, '');
    const images = new Set();
    $('img').each((_idx, el) => {
        const src = $(el).attr('data-src') || $(el).attr('src') || '';
        if (!src)
            return;
        if (!/\.(jpe?g|png|webp|gif)$/i.test(src))
            return;
        if (src.includes('sprite') || src.includes('icon'))
            return;
        images.add(new URL(src, pageUrl).toString());
    });
    // 일부 페이지는 background-image로 썸네일 제공
    $('[style*="background-image"]').each((_idx, el) => {
        const style = $(el).attr('style') || '';
        const match = style.match(/url\(["']?(.*?)["']?\)/);
        if (match?.[1]) {
            const url = new URL(match[1], pageUrl).toString();
            images.add(url);
        }
    });
    // 네이버 쇼핑 CDN 의심 시 호스트 검증 (안정성을 위해)
    return Array.from(images).filter((img) => {
        try {
            const url = new URL(img);
            const candidate = url.hostname.replace(/^www\./, '');
            return candidate === trimmedHost || candidate.endsWith(`.${trimmedHost}`) || candidate.includes('naver');
        }
        catch {
            return false;
        }
    });
}
function safeHostname(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return 'unknown-host';
    }
}
