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
exports.crawlProductSnapshot = crawlProductSnapshot;
exports.registerProductParser = registerProductParser;
const cheerio = __importStar(require("cheerio"));
const playwright_runner_1 = require("./playwright-runner");
const naver_shopping_1 = require("./parsers/naver-shopping");
const aliexpress_1 = require("./parsers/aliexpress");
const coupang_1 = require("./parsers/coupang");
const gmarket_auction_1 = require("./parsers/gmarket-auction");
const _11st_1 = require("./parsers/11st");
const temu_1 = require("./parsers/temu");
const registeredParsers = [];
async function crawlProductSnapshot(url, options = {}) {
    const parser = resolveParser(url, options.forceParserId);
    if (!parser) {
        throw new Error('지원되지 않는 상세페이지 도메인입니다.');
    }
    const crawlResult = await (0, playwright_runner_1.fetchPage)(url, options);
    const snapshot = parser.parse(crawlResult.html, url);
    return { snapshot, crawlResult };
}
function registerProductParser(parser) {
    const existingIndex = registeredParsers.findIndex((item) => item.id === parser.id);
    if (existingIndex >= 0) {
        registeredParsers.splice(existingIndex, 1, parser);
    }
    else {
        registeredParsers.push(parser);
    }
}
function resolveParser(url, forcedId) {
    const hostname = safeHostname(url);
    if (forcedId) {
        const parser = registeredParsers.find((item) => item.id === forcedId);
        return parser ?? null;
    }
    const matched = registeredParsers.find((parser) => parser.match(hostname)) ?? registeredParsers.find((p) => p.id === 'generic');
    return matched ?? null;
}
function safeHostname(value) {
    try {
        return new URL(value).hostname;
    }
    catch {
        return '';
    }
}
// ── Default parsers ──
registerProductParser({
    id: 'naver-shopping-connect',
    match: (hostname) => /naver\.com$/i.test(hostname) && hostname.includes('shopping'),
    parse: naver_shopping_1.parseNaverShoppingConnect
});
registerProductParser({
    id: 'aliexpress',
    match: (hostname) => /aliexpress\./i.test(hostname) || /ali(cd)?n/i.test(hostname),
    parse: aliexpress_1.parseAliExpress
});
registerProductParser({
    id: 'coupang',
    match: (hostname) => /coupang\.com$/i.test(hostname),
    parse: coupang_1.parseCoupang
});
registerProductParser({
    id: 'gmarket-auction',
    match: (hostname) => /gmarket\.co\.kr$/i.test(hostname) || /auction\.co\.kr$/i.test(hostname),
    parse: gmarket_auction_1.parseGmarketAuction
});
registerProductParser({
    id: '11st',
    match: (hostname) => /11st\.co\.kr$/i.test(hostname),
    parse: _11st_1.parse11st
});
registerProductParser({
    id: 'temu',
    match: (hostname) => /temu\.com$/i.test(hostname),
    parse: temu_1.parseTemu
});
registerProductParser({
    id: 'generic',
    match: () => true,
    parse: parseGenericProductDetail
});
function parseGenericProductDetail(html, pageUrl) {
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') ||
        $('h1, h2').first().text().trim() ||
        $('title').text().trim() ||
        '제목 없음';
    const description = $('meta[name="description"]').attr('content') ||
        $('p').first().text().trim() ||
        undefined;
    const images = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (!src)
            return;
        if (!/\.(jpe?g|png|webp)$/i.test(src))
            return;
        try {
            images.push(new URL(src, pageUrl).toString());
        }
        catch {
            // ignore
        }
    });
    const snapshot = {
        title,
        features: [],
        specs: {},
        reviews: [],
        images,
        officialUrl: $('link[rel="canonical"]').attr('href') || pageUrl,
        sourceDomain: safeHostname(pageUrl) || 'unknown-host',
        capturedAt: new Date().toISOString(),
        rawUrl: pageUrl
    };
    if (description) {
        snapshot.description = description;
    }
    return snapshot;
}
