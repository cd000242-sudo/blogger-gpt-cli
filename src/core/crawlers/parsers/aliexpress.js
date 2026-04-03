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
exports.parseAliExpress = parseAliExpress;
const cheerio = __importStar(require("cheerio"));
function parseAliExpress(html, pageUrl) {
    const runParams = extractRunParams(html);
    const $ = cheerio.load(html);
    const title = runParams?.titleModule?.subject ||
        $('meta[property="og:title"]').attr('content') ||
        $('title').text().trim() ||
        '제목 없음';
    const description = runParams?.descriptionModule?.description ||
        $('meta[name="description"]').attr('content') ||
        undefined;
    const price = extractPrice(runParams);
    const specs = extractSpecs(runParams);
    const features = extractFeatures(runParams, specs);
    const reviews = extractReviews(runParams);
    const images = extractImages(runParams, pageUrl, $);
    const officialUrl = runParams?.productModule?.productUrl ||
        $('link[rel="canonical"]').attr('href') ||
        pageUrl;
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
    if (description) {
        snapshot.description = description;
    }
    if (price) {
        snapshot.price = price;
    }
    return snapshot;
}
function extractRunParams(html) {
    const match = html.match(/window\.runParams\s*=\s*({.+?});\s*<\/script>/s);
    if (!match)
        return null;
    const payload = match[1];
    if (!payload)
        return null;
    try {
        return JSON.parse(payload);
    }
    catch {
        return null;
    }
}
function extractPrice(runParams) {
    if (!runParams?.priceModule)
        return undefined;
    const module = runParams.priceModule;
    const currency = module.minSalePrice?.currency || module.originalPrice?.currency || 'USD';
    const current = normalizeNumber(module.minSalePrice?.value ?? module.minSalePrice);
    const original = normalizeNumber(module.originalPrice?.value ?? module.originalPrice);
    if (!current)
        return undefined;
    const priceInfo = {
        current,
        currency
    };
    if (original && original > current) {
        priceInfo.original = original;
    }
    return priceInfo;
}
function extractSpecs(runParams) {
    const specs = {};
    const props = runParams?.specsModule?.props || runParams?.specsModule?.specs;
    if (Array.isArray(props)) {
        props.forEach((spec) => {
            const key = spec.attrName || spec.attrNameLocal;
            const value = spec.attrValue || spec.attrValueLocal;
            if (key && value) {
                specs[key.trim()] = Array.isArray(value) ? value.join(', ') : String(value).trim();
            }
        });
    }
    const attrList = runParams?.specsModule?.productPropInfoList;
    if (Array.isArray(attrList)) {
        attrList.forEach((item) => {
            const key = item.attrName || item.attrNameLocal;
            const value = item.attrValue || item.attrValueLocal;
            if (key && value) {
                specs[key.trim()] = Array.isArray(value) ? value.join(', ') : String(value).trim();
            }
        });
    }
    return specs;
}
function extractFeatures(runParams, specs) {
    const features = [];
    const subject = runParams?.titleModule?.subject;
    if (typeof subject === 'string' && subject.trim().length > 0) {
        subject
            .split(/[·\|]/)
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 3)
            .forEach((title) => {
            const feature = {
                heading: title,
                body: title
            };
            const benefit = inferBenefit(title);
            if (benefit) {
                feature.benefit = benefit;
            }
            features.push(feature);
        });
    }
    const sellingPoints = runParams?.descriptionModule?.bulletPoints;
    if (Array.isArray(sellingPoints)) {
        sellingPoints.filter(Boolean).slice(0, 5).forEach((text) => {
            const feature = {
                heading: text.slice(0, 40),
                body: text
            };
            const benefit = inferBenefit(text);
            if (benefit) {
                feature.benefit = benefit;
            }
            features.push(feature);
        });
    }
    // 스펙에서 중요한 항목 추려서 특징으로 승격
    const importantSpecs = ['Material', 'Power', 'Capacity', 'Battery', 'Dimensions'];
    importantSpecs.forEach((key) => {
        const matchingKey = Object.keys(specs).find((k) => k.toLowerCase().includes(key.toLowerCase()));
        if (matchingKey) {
            const value = specs[matchingKey];
            const feature = {
                heading: `${matchingKey}`,
                body: `${matchingKey}: ${value}`
            };
            const benefit = inferBenefit(value);
            if (benefit) {
                feature.benefit = benefit;
            }
            features.push(feature);
        }
    });
    return dedupeFeatures(features).slice(0, 10);
}
function inferBenefit(text) {
    if (!text)
        return undefined;
    const lower = text.toLowerCase();
    if (/(portable|compact|lightweight|휴대)/i.test(lower))
        return '휴대성';
    if (/(powerful|strong|강력|고출력)/i.test(lower))
        return '성능 강조';
    if (/(comfortable|ergonomic|편안|인체공학)/i.test(lower))
        return '사용 편의성';
    if (/(durable|stainless|내구)/i.test(lower))
        return '내구성';
    if (/(quiet|silent|저소음)/i.test(lower))
        return '저소음';
    return undefined;
}
function dedupeFeatures(features) {
    const seen = new Set();
    return features.filter((feature) => {
        const key = `${feature.heading}|${feature.body}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return Boolean(feature.body);
    });
}
function extractReviews(runParams) {
    const reviews = [];
    const feedbackList = runParams?.feedbackModule?.feedBackList;
    if (Array.isArray(feedbackList)) {
        feedbackList.slice(0, 5).forEach((item) => {
            const quote = item.comments?.[0]?.buyerReview || item.simpleSkuReview || item.feedbackDate;
            if (!quote)
                return;
            const rating = normalizeNumber(item.reviewStar);
            const review = {
                quote: quote.trim(),
                source: 'AliExpress'
            };
            if (typeof rating === 'number' && !Number.isNaN(rating)) {
                review.rating = rating;
            }
            reviews.push(review);
        });
    }
    return reviews;
}
function extractImages(runParams, pageUrl, $) {
    const urls = new Set();
    const imageModule = runParams?.imageModule;
    if (imageModule?.imagePathList) {
        imageModule.imagePathList.forEach((item) => {
            try {
                urls.add(new URL(item, pageUrl).toString());
            }
            catch {
                // ignore
            }
        });
    }
    $('img').each((_idx, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (!src)
            return;
        if (!/\.(jpe?g|png|webp)$/i.test(src))
            return;
        try {
            urls.add(new URL(src, pageUrl).toString());
        }
        catch {
            // ignore
        }
    });
    return Array.from(urls);
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
