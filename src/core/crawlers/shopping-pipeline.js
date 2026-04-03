"use strict";
/**
 * 🛒 쇼핑 크롤러 → 콘텐츠 파이프라인 커넥터
 *
 * 역할:
 *   1. 쇼핑 URL 감지 (모든 플랫폼)
 *   2. Playwright 기반 크롤링 → ProductDetailSnapshot
 *   3. snapshot → ResearchDatum[] + FinalCrawledPost 변환
 *   4. 수집 이미지 URL 배열 반환
 */
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
exports.isShoppingUrl = isShoppingUrl;
exports.detectShoppingPlatform = detectShoppingPlatform;
exports.extractShoppingProductInfo = extractShoppingProductInfo;
const parser_registry_1 = require("./parser-registry");
const snapshot_converter_1 = require("./snapshot-converter");
/* ─── 쇼핑 URL 감지 ─── */
const SHOPPING_PATTERNS = [
    // 네이버 쇼핑
    { test: /smartstore\.naver\.com/i, name: '네이버 스마트스토어' },
    { test: /brand\.naver\.com/i, name: '네이버 브랜드스토어' },
    { test: /brandconnect\.naver\.com/i, name: '네이버 브랜드커넥트' },
    { test: /shopping\.naver\.com/i, name: '네이버 쇼핑' },
    // 쿠팡
    { test: /coupang\.com/i, name: '쿠팡' },
    // G마켓 / 옥션
    { test: /gmarket\.co\.kr/i, name: 'G마켓' },
    { test: /auction\.co\.kr/i, name: '옥션' },
    // 11번가
    { test: /11st\.co\.kr/i, name: '11번가' },
    // Temu
    { test: /temu\.com/i, name: 'Temu' },
    // AliExpress
    { test: /aliexpress\./i, name: 'AliExpress' },
    { test: /ali(cd)?n\./i, name: 'AliExpress CDN' },
    // 기타 (미래 확장)
    { test: /wemakeprice\.com/i, name: '위메프' },
    { test: /tmon\.co\.kr/i, name: '티몬' },
];
/**
 * 주어진 URL이 지원되는 쇼핑 플랫폼인지 확인
 */
function isShoppingUrl(url) {
    return SHOPPING_PATTERNS.some((p) => p.test.test(url));
}
/**
 * 쇼핑 플랫폼 이름 반환 (감지 실패 시 null)
 */
function detectShoppingPlatform(url) {
    const found = SHOPPING_PATTERNS.find((p) => p.test.test(url));
    return found ? found.name : null;
}
/* ─── 메인 파이프라인: URL → ShoppingCrawlResult ─── */
/**
 * Playwright 기반 쇼핑 URL 크롤링 → 콘텐츠 생성용 데이터로 변환
 *
 * @param url 쇼핑 상품 페이지 URL
 * @param onLog 진행상황 콜백
 * @returns ShoppingCrawlResult | null
 */
async function extractShoppingProductInfo(url, onLog) {
    const platform = detectShoppingPlatform(url);
    if (!platform)
        return null;
    onLog?.(`[SHOPPING-PIPE] 🛒 ${platform} 상품 크롤링 시작: ${url.substring(0, 60)}...`);
    try {
        /* 1. Playwright 기반 크롤링 */
        const { snapshot } = await (0, parser_registry_1.crawlProductSnapshot)(url, {
            timeoutMs: 20000,
            headless: false, // 🖥 크롬 창 보이게 (네이버 크롤링처럼)
        });
        onLog?.(`[SHOPPING-PIPE] ✅ 크롤링 성공: "${snapshot.title.substring(0, 40)}..." (이미지 ${snapshot.images.length}개)`);
        /* 2. 스냅샷 → ResearchDatum 변환 (프롬프트용) */
        const researchData = (0, snapshot_converter_1.snapshotToResearch)(snapshot);
        /* 3. 리서치 데이터를 하나의 content 문자열로 합성 */
        const content = buildContentFromSnapshot(snapshot, researchData);
        /* 4. H2 소제목 구성 */
        const subheadings = buildSubheadings(snapshot, platform);
        /* 5. 결과 반환 */
        return {
            post: {
                title: snapshot.title,
                url: snapshot.officialUrl || snapshot.rawUrl || url,
                content,
                subheadings,
                source: 'external',
            },
            productImages: snapshot.images,
            snapshot,
        };
    }
    catch (error) {
        onLog?.(`[SHOPPING-PIPE] ⚠️ Playwright 크롤링 실패: ${error.message}`);
        /* HTTP 폴백: OG 태그 최소 추출 */
        try {
            onLog?.(`[SHOPPING-PIPE] 📡 HTTP 폴백 시도...`);
            const { default: axios } = await Promise.resolve().then(() => __importStar(require('axios')));
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    Accept: 'text/html',
                },
                timeout: 10000,
                maxRedirects: 5,
            });
            const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
            const $ = cheerio.load(response.data);
            const title = $('meta[property="og:title"]').attr('content')?.trim() ||
                $('title').text().trim() ||
                `${platform} 상품`;
            const description = $('meta[property="og:description"]').attr('content')?.trim() ||
                $('meta[name="description"]').attr('content')?.trim() ||
                '';
            const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
            const images = [];
            if (ogImage)
                images.push(ogImage);
            onLog?.(`[SHOPPING-PIPE] ✅ HTTP 폴백 성공: "${title.substring(0, 40)}..."`);
            return {
                post: {
                    title,
                    url,
                    content: description || `${platform}에서 판매 중인 인기 상품입니다.`,
                    subheadings: ['상품 소개', '구매 가이드', '실사용 후기', '구매 전 체크리스트', '총평'],
                    source: 'external',
                },
                productImages: images,
                snapshot: {
                    title,
                    features: [],
                    specs: {},
                    reviews: [],
                    images,
                    officialUrl: url,
                    sourceDomain: platform,
                    capturedAt: new Date().toISOString(),
                    rawUrl: url,
                    description,
                },
            };
        }
        catch (httpError) {
            onLog?.(`[SHOPPING-PIPE] ❌ HTTP 폴백도 실패: ${httpError.message}`);
            return null;
        }
    }
}
/* ─── 내부 헬퍼 ─── */
function buildContentFromSnapshot(snapshot, _researchData) {
    const lines = [];
    // 제품 개요
    lines.push(`오늘 소개해드릴 상품은 "${snapshot.title}"입니다.`);
    if (snapshot.description) {
        lines.push(snapshot.description);
    }
    // 가격 정보
    if (snapshot.price) {
        let priceLine = `현재 판매 가격은 ${snapshot.price.current.toLocaleString()}${snapshot.price.currency === 'KRW' ? '원' : ` ${snapshot.price.currency}`}`;
        if (snapshot.price.original) {
            priceLine += ` (정가 ${snapshot.price.original.toLocaleString()}원)`;
        }
        if (snapshot.discount) {
            priceLine += `, ${snapshot.discount} 할인 중`;
        }
        priceLine += '입니다.';
        lines.push(priceLine);
    }
    // 평점
    if (snapshot.rating) {
        let ratingLine = `구매자 평점 ${snapshot.rating}점`;
        if (snapshot.reviewCount) {
            ratingLine += ` (${snapshot.reviewCount.toLocaleString()}개 리뷰)`;
        }
        ratingLine += '으로 높은 만족도를 보여주고 있습니다.';
        lines.push(ratingLine);
    }
    // 배송 정보
    if (snapshot.delivery) {
        lines.push(`배송 정보: ${snapshot.delivery}`);
    }
    // 판매자 정보
    if (snapshot.seller) {
        lines.push(`판매자: ${snapshot.seller}`);
    }
    // 주요 특징
    if (snapshot.features.length > 0) {
        lines.push('\n주요 특징:');
        snapshot.features.slice(0, 5).forEach((f) => {
            let featureLine = `• ${f.heading}: ${f.body}`;
            if (f.benefit)
                featureLine += ` (${f.benefit})`;
            lines.push(featureLine);
        });
    }
    // 스펙
    const specEntries = Object.entries(snapshot.specs);
    if (specEntries.length > 0) {
        lines.push('\n제품 스펙:');
        specEntries.slice(0, 8).forEach(([key, val]) => {
            lines.push(`• ${key}: ${val}`);
        });
    }
    // 리뷰 발췌
    if (snapshot.reviews.length > 0) {
        lines.push('\n실제 사용자 후기:');
        snapshot.reviews.slice(0, 3).forEach((r) => {
            let reviewLine = `"${r.quote}"`;
            if (r.rating)
                reviewLine += ` (★${r.rating})`;
            lines.push(reviewLine);
        });
    }
    return lines.join('\n');
}
function buildSubheadings(snapshot, platform) {
    const subheadings = [];
    // 기본 구성
    subheadings.push(`${snapshot.title.substring(0, 20)} 상품 소개`);
    subheadings.push('핵심 특징 분석');
    if (snapshot.reviews.length > 0) {
        subheadings.push('실제 사용 후기');
    }
    else {
        subheadings.push('사용 만족도 분석');
    }
    subheadings.push('구매 전 체크리스트');
    subheadings.push('추천 대상 및 총평');
    return subheadings;
}
