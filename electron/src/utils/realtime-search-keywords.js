"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getZumRealtimeKeywords = getZumRealtimeKeywords;
exports.getGoogleRealtimeKeywords = getGoogleRealtimeKeywords;
exports.getNateRealtimeKeywords = getNateRealtimeKeywords;
exports.getDaumRealtimeKeywords = getDaumRealtimeKeywords;
exports.getNaverRealtimeKeywords = getNaverRealtimeKeywords;
exports.getBokjiroRealtimeKeywords = getBokjiroRealtimeKeywords;
exports.getAllRealtimeKeywords = getAllRealtimeKeywords;
// 실시간 검색어 크롤링 유틸리티
var axios_1 = require("axios");
var cheerio = require("cheerio");
/**
 * ZUM 실시간 검색어 크롤링
 */
function getZumRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var MAX_RETRIES, RETRY_DELAY, _loop_1, attempt, state_1;
        var _a, _b, _c;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    MAX_RETRIES = 3;
                    RETRY_DELAY = 1000;
                    _loop_1 = function (attempt) {
                        var keywords_1, urls, response, _e, urls_1, url, err_1, fullHtml, realtimeMatch, $_1, scriptTags, selectors, tempKeywords, _f, selectors_1, selector, elements, idx, el, keyword, href, hrefMatch, decoded, uniqueKeywords, error_1;
                        return __generator(this, function (_g) {
                            switch (_g.label) {
                                case 0:
                                    _g.trys.push([0, 9, , 12]);
                                    console.log("[ZUM-REALTIME] ========== ZUM \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 \uC218\uC9D1 \uC2DC\uC791 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, ") =========="));
                                    keywords_1 = [];
                                    console.log('[ZUM-REALTIME] ZUM 메인 페이지에서 실시간 검색어 크롤링');
                                    urls = [
                                        'https://www.zum.com/',
                                        'https://zum.com/',
                                        'https://m.zum.com/'
                                    ];
                                    response = void 0;
                                    _e = 0, urls_1 = urls;
                                    _g.label = 1;
                                case 1:
                                    if (!(_e < urls_1.length)) return [3 /*break*/, 6];
                                    url = urls_1[_e];
                                    _g.label = 2;
                                case 2:
                                    _g.trys.push([2, 4, , 5]);
                                    console.log("[ZUM-REALTIME] HTML \uD398\uC774\uC9C0 \uC694\uCCAD: ".concat(url));
                                    return [4 /*yield*/, axios_1.default.get(url, {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                                'Referer': 'https://www.zum.com/',
                                                'Accept-Encoding': 'gzip, deflate, br',
                                                'Connection': 'keep-alive',
                                                'Upgrade-Insecure-Requests': '1'
                                            },
                                            timeout: 20000,
                                            validateStatus: function (status) { return status < 500; },
                                            maxRedirects: 5
                                        })];
                                case 3:
                                    response = _g.sent();
                                    console.log("[ZUM-REALTIME] HTML \uC751\uB2F5: ".concat(url, " - \uC0C1\uD0DC: ").concat(response.status, ", \uAE38\uC774: ").concat(((_a = response.data) === null || _a === void 0 ? void 0 : _a.length) || 0, " bytes"));
                                    if (response.status === 200 && response.data) {
                                        return [3 /*break*/, 6];
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    err_1 = _g.sent();
                                    console.warn("[ZUM-REALTIME] HTML \uC694\uCCAD \uC2E4\uD328 (".concat(url, "):"), {
                                        message: err_1 === null || err_1 === void 0 ? void 0 : err_1.message,
                                        status: (_b = err_1 === null || err_1 === void 0 ? void 0 : err_1.response) === null || _b === void 0 ? void 0 : _b.status,
                                        code: err_1 === null || err_1 === void 0 ? void 0 : err_1.code
                                    });
                                    return [3 /*break*/, 5];
                                case 5:
                                    _e++;
                                    return [3 /*break*/, 1];
                                case 6:
                                    if (response && response.data) {
                                        fullHtml = response.data;
                                        console.log("[ZUM-REALTIME] HTML \uD30C\uC2F1 \uC2DC\uC791, HTML \uAE38\uC774: ".concat((fullHtml === null || fullHtml === void 0 ? void 0 : fullHtml.length) || 0));
                                        realtimeMatch = fullHtml.match(/실시간[\s\S]{0,500}/i);
                                        console.log("[ZUM-REALTIME] \"\uC2E4\uC2DC\uAC04\" \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(realtimeMatch ? '있음' : '없음'));
                                        // 디버깅: 실제 매칭된 내용 출력
                                        if (realtimeMatch) {
                                            console.log("[ZUM-REALTIME] \uC2E4\uC2DC\uAC04 \uC139\uC158 \uC0D8\uD50C:", realtimeMatch[0].substring(0, 200));
                                        }
                                        $_1 = cheerio.load(fullHtml);
                                        // 방법 1: JSON 데이터 추출 (스크립트 태그에서)
                                        console.log('[ZUM-REALTIME] 방법 1: 스크립트 태그에서 JSON 데이터 추출');
                                        scriptTags = $_1('script');
                                        console.log("[ZUM-REALTIME] \uBC1C\uACAC\uB41C \uC2A4\uD06C\uB9BD\uD2B8 \uD0DC\uADF8: ".concat(scriptTags.length, "\uAC1C"));
                                        $_1('script').each(function (_i, scriptEl) {
                                            if (keywords_1.length >= limit)
                                                return;
                                            var scriptContent = $_1(scriptEl).html() || '';
                                            if (scriptContent.length < 50)
                                                return; // 너무 짧은 스크립트는 스킵
                                            // ZUM JSON 패턴들 (더 많은 패턴 추가)
                                            var jsonPatterns = [
                                                /window\.zum\s*=\s*JSON\.parse\(['"]([^'"]+)['"]\)/,
                                                /guideQuery\s*[:=]\s*(\{[^}]+\})/s,
                                                /realtimeKeywords\s*[:=]\s*(\[[^\]]+\])/s,
                                                /issueKeywords\s*[:=]\s*(\[[^\]]+\])/s,
                                                /trendKeywords\s*[:=]\s*(\[[^\]]+\])/s,
                                                /"keyword"\s*:\s*"([^"]+)"/g,
                                                /"query"\s*:\s*"([^"]+)"/g,
                                                /"title"\s*:\s*"([^"]+)"/g,
                                                /"text"\s*:\s*"([^"]+)"/g,
                                                /"word"\s*:\s*"([^"]+)"/g,
                                                /"name"\s*:\s*"([^"]+)"/g
                                            ];
                                            for (var _a = 0, jsonPatterns_1 = jsonPatterns; _a < jsonPatterns_1.length; _a++) {
                                                var pattern = jsonPatterns_1[_a];
                                                if (keywords_1.length >= limit)
                                                    break;
                                                var match = void 0;
                                                var _loop_2 = function () {
                                                    var jsonStr = match[1];
                                                    if (!jsonStr)
                                                        return "continue";
                                                    try {
                                                        // JSON 문자열인 경우 파싱
                                                        if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
                                                            var data = JSON.parse(jsonStr);
                                                            if (Array.isArray(data)) {
                                                                data.forEach(function (item) {
                                                                    if (keywords_1.length >= limit)
                                                                        return;
                                                                    var keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.query || item.word || item.name || '');
                                                                    if (keyword && keyword.length > 1 && keyword.length < 50 &&
                                                                        !keyword.includes('http') &&
                                                                        !keyword.includes('🔥') &&
                                                                        !keyword.includes('뉴스') &&
                                                                        !keyword.includes('문서') &&
                                                                        !keyword.includes('검색') &&
                                                                        !keyword.includes('더보기') &&
                                                                        !/^[a-zA-Z\s]+$/.test(keyword)) {
                                                                        keywords_1.push({
                                                                            rank: keywords_1.length + 1,
                                                                            keyword: keyword.trim(),
                                                                            source: 'zum',
                                                                            timestamp: new Date().toISOString()
                                                                        });
                                                                        console.log("[ZUM-REALTIME] JSON\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                                    }
                                                                });
                                                            }
                                                            else if (data.keywords || data.items || data.list || data.data) {
                                                                var keywordList = data.keywords || data.items || data.list || data.data || [];
                                                                keywordList.forEach(function (item) {
                                                                    if (keywords_1.length >= limit)
                                                                        return;
                                                                    var keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.query || item.word || item.name || '');
                                                                    if (keyword && keyword.length > 1 && keyword.length < 50 &&
                                                                        !keyword.includes('http') &&
                                                                        !keyword.includes('🔥') &&
                                                                        !keyword.includes('뉴스') &&
                                                                        !keyword.includes('문서') &&
                                                                        !keyword.includes('검색') &&
                                                                        !keyword.includes('더보기') &&
                                                                        !/^[a-zA-Z\s]+$/.test(keyword)) {
                                                                        keywords_1.push({
                                                                            rank: keywords_1.length + 1,
                                                                            keyword: keyword.trim(),
                                                                            source: 'zum',
                                                                            timestamp: new Date().toISOString()
                                                                        });
                                                                        console.log("[ZUM-REALTIME] JSON\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                                    }
                                                                });
                                                            }
                                                        }
                                                        else {
                                                            // 단순 문자열인 경우
                                                            var keyword_1 = jsonStr.trim();
                                                            if (keyword_1 && keyword_1.length > 1 && keyword_1.length < 50 &&
                                                                !keyword_1.includes('http') &&
                                                                !keyword_1.includes('🔥') &&
                                                                !keyword_1.includes('뉴스') &&
                                                                !keyword_1.includes('문서') &&
                                                                !keyword_1.includes('검색') &&
                                                                !keyword_1.includes('더보기') &&
                                                                !/^[a-zA-Z\s]+$/.test(keyword_1)) {
                                                                if (!keywords_1.some(function (k) { return k.keyword === keyword_1; })) {
                                                                    keywords_1.push({
                                                                        rank: keywords_1.length + 1,
                                                                        keyword: keyword_1,
                                                                        source: 'zum',
                                                                        timestamp: new Date().toISOString()
                                                                    });
                                                                    console.log("[ZUM-REALTIME] \uD328\uD134\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword_1));
                                                                }
                                                            }
                                                        }
                                                    }
                                                    catch (parseError) {
                                                        // 파싱 실패 무시
                                                    }
                                                };
                                                while ((match = pattern.exec(scriptContent)) !== null && keywords_1.length < limit) {
                                                    _loop_2();
                                                }
                                            }
                                        });
                                        console.log("[ZUM-REALTIME] JSON \uD30C\uC2F1 \uD6C4 \uD0A4\uC6CC\uB4DC \uAC1C\uC218: ".concat(keywords_1.length));
                                        // 방법 2: HTML DOM 파싱 (실시간 검색어 섹션 찾기)
                                        if (keywords_1.length < limit) {
                                            console.log('[ZUM-REALTIME] HTML DOM 파싱 시도');
                                            selectors = [
                                                'a[href*="/search?q="]',
                                                'a[href*="/search?query="]',
                                                'a[href*="search"]',
                                                '.realtime_keyword a',
                                                '.keyword_list a',
                                                '.rank_list a',
                                                '.issue_keyword a',
                                                'li[class*="rank"] a',
                                                'li[class*="keyword"] a',
                                                'li[class*="issue"] a',
                                                '[class*="realtime"] a',
                                                '[class*="issue"] a',
                                                'ol li a',
                                                'ul li a',
                                                'div[class*="keyword"] a',
                                                'div[class*="rank"] a',
                                                'div[class*="issue"] a'
                                            ];
                                            tempKeywords = new Set();
                                            for (_f = 0, selectors_1 = selectors; _f < selectors_1.length; _f++) {
                                                selector = selectors_1[_f];
                                                if (tempKeywords.size >= limit)
                                                    break;
                                                elements = $_1(selector);
                                                console.log("[ZUM-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                                for (idx = 0; idx < elements.length && tempKeywords.size < limit * 2; idx++) {
                                                    el = elements.eq(idx);
                                                    keyword = el.text().trim();
                                                    href = el.attr('href') || '';
                                                    if (href) {
                                                        hrefMatch = href.match(/[?&](?:q|query|keyword)=([^&]+)/);
                                                        if (hrefMatch && hrefMatch[1]) {
                                                            try {
                                                                decoded = decodeURIComponent(hrefMatch[1]).trim();
                                                                if (decoded && decoded.length > 1) {
                                                                    keyword = decoded;
                                                                }
                                                            }
                                                            catch (e) {
                                                                // 디코딩 실패 무시
                                                            }
                                                        }
                                                    }
                                                    // data 속성에서 키워드 추출
                                                    if (!keyword || keyword.length < 2) {
                                                        keyword = el.attr('data-keyword') || el.attr('data-query') || el.attr('data-text') || '';
                                                    }
                                                    // 키워드 정제
                                                    keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
                                                    if (keyword &&
                                                        keyword.length >= 2 &&
                                                        keyword.length < 50 &&
                                                        !keyword.includes('http') &&
                                                        !keyword.includes('://') &&
                                                        !keyword.includes('🔥') &&
                                                        !keyword.includes('뉴스') &&
                                                        !keyword.includes('문서') &&
                                                        !keyword.includes('검색') &&
                                                        !keyword.includes('더보기') &&
                                                        !keyword.includes('전체보기') &&
                                                        !keyword.match(/^(제목|내용|링크|URL|이미지|사진|영상|동영상|비디오)$/i) &&
                                                        !/^[a-zA-Z\s]+$/.test(keyword)) {
                                                        tempKeywords.add(keyword);
                                                        console.log("[ZUM-REALTIME] HTML\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                    }
                                                }
                                                if (tempKeywords.size >= 5) {
                                                    console.log("[ZUM-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(tempKeywords.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                                    break;
                                                }
                                            }
                                            // Set에서 키워드 추가
                                            Array.from(tempKeywords).slice(0, limit).forEach(function (keyword, idx) {
                                                if (!keywords_1.some(function (k) { return k.keyword === keyword; })) {
                                                    keywords_1.push({
                                                        rank: keywords_1.length + 1,
                                                        keyword: keyword,
                                                        source: 'zum',
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                            });
                                        }
                                        // 키워드 수집 성공 시 즉시 반환
                                        if (keywords_1.length >= 5) {
                                            console.log("[ZUM-REALTIME] \u2705 \uC218\uC9D1 \uC644\uB8CC: ".concat(keywords_1.length, "\uAC1C \uD0A4\uC6CC\uB4DC (\uC2DC\uB3C4 ").concat(attempt, "/").concat(MAX_RETRIES, ")"));
                                            uniqueKeywords = Array.from(new Map(keywords_1.map(function (k) { return [k.keyword, k]; })).values());
                                            return [2 /*return*/, { value: uniqueKeywords.slice(0, limit) }];
                                        }
                                        console.warn("[ZUM-REALTIME] \u26A0\uFE0F \uD0A4\uC6CC\uB4DC \uBD80\uC871: ".concat(keywords_1.length, "\uAC1C\uB9CC \uC218\uC9D1\uB428"));
                                    }
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 8];
                                    console.log("[ZUM-REALTIME] ".concat(RETRY_DELAY, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 7:
                                    _g.sent();
                                    _g.label = 8;
                                case 8: return [3 /*break*/, 12];
                                case 9:
                                    error_1 = _g.sent();
                                    console.error("[ZUM-REALTIME] \u274C \uC2DC\uB3C4 ".concat(attempt, " \uC2E4\uD328:"), {
                                        message: error_1 === null || error_1 === void 0 ? void 0 : error_1.message,
                                        status: (_c = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _c === void 0 ? void 0 : _c.status,
                                        code: error_1 === null || error_1 === void 0 ? void 0 : error_1.code
                                    });
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 11];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 10:
                                    _g.sent();
                                    _g.label = 11;
                                case 11: return [3 /*break*/, 12];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= MAX_RETRIES)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _d.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _d.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    console.warn('[ZUM-REALTIME] 모든 재시도 실패, 빈 배열 반환');
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * Google 실시간 검색어 (Google Trends 활용)
 */
function getGoogleRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var MAX_RETRIES, RETRY_DELAY, _loop_3, attempt, state_2;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MAX_RETRIES = 3;
                    RETRY_DELAY = 1000;
                    _loop_3 = function (attempt) {
                        var keywords_2, rssUrls, _loop_4, _b, rssUrls_1, rssUrl, state_3, rssError_1, response, html, $_2, tempKeywords_1, tableBody, rows, i, row, keywordEl, keyword, selectors, _c, selectors_2, selector, elements, idx, el, keyword, href, hrefMatch, scriptCount, apiError_1, error_2;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    _d.trys.push([0, 14, , 17]);
                                    console.log("[GOOGLE-REALTIME] ========== Google \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 \uC218\uC9D1 \uC2DC\uC791 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, ") =========="));
                                    keywords_2 = [];
                                    // 방법 1: Google Trends RSS 피드 시도 (우선순위 1 - 일일 트렌드 순위대로 10개)
                                    console.log('[GOOGLE-REALTIME] 방법 1: Google Trends RSS 피드 시도 (일일 트렌드 10개)');
                                    _d.label = 1;
                                case 1:
                                    _d.trys.push([1, 6, , 7]);
                                    rssUrls = [
                                        'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR&hl=ko',
                                        'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR'
                                    ];
                                    _loop_4 = function (rssUrl) {
                                        var rssResponse, rssContent, $rss_1, rssError_2;
                                        return __generator(this, function (_e) {
                                            switch (_e.label) {
                                                case 0:
                                                    _e.trys.push([0, 2, , 3]);
                                                    console.log("[GOOGLE-REALTIME] RSS \uD53C\uB4DC \uC694\uCCAD: ".concat(rssUrl));
                                                    return [4 /*yield*/, axios_1.default.get(rssUrl, {
                                                            headers: {
                                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                                                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                                                            },
                                                            timeout: 10000
                                                        })];
                                                case 1:
                                                    rssResponse = _e.sent();
                                                    if (rssResponse.status === 200 && rssResponse.data) {
                                                        rssContent = rssResponse.data;
                                                        $rss_1 = cheerio.load(rssContent, { xmlMode: true });
                                                        // 순서대로 최대 10개만 가져오기 (필터링 없이)
                                                        $rss_1('item title').each(function (_i, el) {
                                                            if (keywords_2.length >= Math.min(limit, 10))
                                                                return; // 최대 10개
                                                            var title = $rss_1(el).text().trim();
                                                            // 기본적인 검증만 (너무 짧거나 URL 등은 제외)
                                                            if (title &&
                                                                title.length >= 2 &&
                                                                !title.includes('http') &&
                                                                !title.includes('google') &&
                                                                !title.match(/^[\d\s\-_]+$/)) {
                                                                keywords_2.push({
                                                                    rank: keywords_2.length + 1,
                                                                    keyword: title,
                                                                    source: 'google',
                                                                    timestamp: new Date().toISOString()
                                                                });
                                                                console.log("[GOOGLE-REALTIME] RSS\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(keywords_2.length, "\uBC88\uC9F8): ").concat(title));
                                                            }
                                                        });
                                                        if (keywords_2.length >= Math.min(limit, 10)) {
                                                            console.log("[GOOGLE-REALTIME] \u2705 RSS \uD53C\uB4DC\uC5D0\uC11C ".concat(keywords_2.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (\uC77C\uC77C \uD2B8\uB80C\uB4DC \uC21C\uC704\uB300\uB85C)"));
                                                            return [2 /*return*/, { value: keywords_2.slice(0, Math.min(limit, 10)) }];
                                                        }
                                                    }
                                                    return [3 /*break*/, 3];
                                                case 2:
                                                    rssError_2 = _e.sent();
                                                    console.warn("[GOOGLE-REALTIME] RSS \uD53C\uB4DC \uC2E4\uD328 (".concat(rssUrl, "):"), rssError_2.message);
                                                    return [3 /*break*/, 3];
                                                case 3: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _b = 0, rssUrls_1 = rssUrls;
                                    _d.label = 2;
                                case 2:
                                    if (!(_b < rssUrls_1.length)) return [3 /*break*/, 5];
                                    rssUrl = rssUrls_1[_b];
                                    return [5 /*yield**/, _loop_4(rssUrl)];
                                case 3:
                                    state_3 = _d.sent();
                                    if (typeof state_3 === "object")
                                        return [2 /*return*/, state_3];
                                    _d.label = 4;
                                case 4:
                                    _b++;
                                    return [3 /*break*/, 2];
                                case 5: return [3 /*break*/, 7];
                                case 6:
                                    rssError_1 = _d.sent();
                                    console.warn('[GOOGLE-REALTIME] RSS 피드 전체 실패:', rssError_1.message);
                                    return [3 /*break*/, 7];
                                case 7:
                                    if (!(keywords_2.length < Math.min(limit, 10))) return [3 /*break*/, 11];
                                    _d.label = 8;
                                case 8:
                                    _d.trys.push([8, 10, , 11]);
                                    console.log('[GOOGLE-REALTIME] 방법 2: Google Trends 일일 트렌드 HTML 크롤링');
                                    return [4 /*yield*/, axios_1.default.get('https://trends.google.co.kr/trendingsearches/daily?geo=KR&hl=ko', {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                                'Referer': 'https://trends.google.co.kr/'
                                            },
                                            timeout: 15000,
                                            validateStatus: function (status) { return status < 500; }
                                        })];
                                case 9:
                                    response = _d.sent();
                                    console.log("[GOOGLE-REALTIME] HTML \uC751\uB2F5 \uC0C1\uD0DC: ".concat(response.status));
                                    if (response.status === 200 && response.data) {
                                        html = response.data;
                                        $_2 = cheerio.load(html);
                                        tempKeywords_1 = new Set();
                                        tableBody = $_2('tbody[jsname="cC57zf"]');
                                        if (tableBody.length > 0) {
                                            console.log("[GOOGLE-REALTIME] \uD14C\uC774\uBE14 tbody \uBC1C\uACAC, \uD589 \uCC3E\uB294 \uC911...");
                                            rows = tableBody.find('tr[data-row-id]');
                                            for (i = 0; i < rows.length && tempKeywords_1.size < Math.min(limit, 10); i++) {
                                                row = rows.eq(i);
                                                keywordEl = row.find('.mZ3RIc').first();
                                                if (keywordEl.length > 0) {
                                                    keyword = keywordEl.text().trim();
                                                    // 기본적인 검증만 (필터링 최소화 - 일일 트렌드 그대로 가져오기)
                                                    if (keyword &&
                                                        keyword.length >= 2 &&
                                                        !keyword.includes('http') &&
                                                        !keyword.includes('google') &&
                                                        !keyword.includes('trends') &&
                                                        !/^[\d\s\-_]+$/.test(keyword)) {
                                                        tempKeywords_1.add(keyword);
                                                        console.log("[GOOGLE-REALTIME] \uD14C\uC774\uBE14\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(tempKeywords_1.size, "\uBC88\uC9F8): ").concat(keyword));
                                                    }
                                                }
                                            }
                                            if (tempKeywords_1.size >= Math.min(limit, 10)) {
                                                console.log("[GOOGLE-REALTIME] \u2705 \uD14C\uC774\uBE14 \uAD6C\uC870\uC5D0\uC11C ".concat(tempKeywords_1.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                            }
                                        }
                                        // 방법 2: 대체 선택자들 시도 (방법 1이 실패한 경우)
                                        if (tempKeywords_1.size < Math.min(limit, 10)) {
                                            console.log("[GOOGLE-REALTIME] \uB300\uCCB4 \uC120\uD0DD\uC790 \uC2DC\uB3C4 \uC911...");
                                            selectors = [
                                                '.mZ3RIc', // 직접 키워드 클래스
                                                'a[href*="/trends/explore?q="]',
                                                'a[href*="/trends?q="]',
                                                '.trending-item-title',
                                                '.trending-item',
                                                '[data-trend]',
                                                '[data-term]', // data-term 속성
                                                '.md-list-item-text'
                                            ];
                                            for (_c = 0, selectors_2 = selectors; _c < selectors_2.length; _c++) {
                                                selector = selectors_2[_c];
                                                if (tempKeywords_1.size >= Math.min(limit, 10))
                                                    break;
                                                elements = $_2(selector);
                                                console.log("[GOOGLE-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                                for (idx = 0; idx < elements.length && tempKeywords_1.size < Math.min(limit, 10); idx++) {
                                                    el = elements.eq(idx);
                                                    keyword = el.text().trim();
                                                    href = el.attr('href') || '';
                                                    if (href) {
                                                        hrefMatch = href.match(/[?&]q=([^&]+)/);
                                                        if (hrefMatch && hrefMatch[1]) {
                                                            try {
                                                                keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                            }
                                                            catch (e) {
                                                                // 디코딩 실패 무시
                                                            }
                                                        }
                                                    }
                                                    // data 속성에서 키워드 추출
                                                    if (!keyword || keyword.length < 2) {
                                                        keyword = el.attr('data-trend') || el.attr('data-keyword') || el.attr('data-term') || '';
                                                    }
                                                    // 기본적인 검증만 (필터링 최소화 - 일일 트렌드 그대로 가져오기)
                                                    if (keyword &&
                                                        keyword.length >= 2 &&
                                                        !keyword.includes('http') &&
                                                        !keyword.includes('google') &&
                                                        !keyword.includes('trends') &&
                                                        !/^[\d\s\-_]+$/.test(keyword)) {
                                                        tempKeywords_1.add(keyword);
                                                        console.log("[GOOGLE-REALTIME] \uB300\uCCB4 \uC120\uD0DD\uC790\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                    }
                                                }
                                                if (tempKeywords_1.size >= Math.min(limit, 10)) {
                                                    console.log("[GOOGLE-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(tempKeywords_1.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                                    break;
                                                }
                                            }
                                        }
                                        // 스크립트 태그에서 JSON 데이터 추출 시도
                                        if (tempKeywords_1.size < 5) {
                                            console.log('[GOOGLE-REALTIME] 스크립트 태그에서 JSON 데이터 추출 시도');
                                            scriptCount = $_2('script').length;
                                            console.log("[GOOGLE-REALTIME] \uBC1C\uACAC\uB41C \uC2A4\uD06C\uB9BD\uD2B8 \uD0DC\uADF8: ".concat(scriptCount, "\uAC1C"));
                                            $_2('script').each(function (_i, scriptEl) {
                                                if (tempKeywords_1.size >= limit * 2)
                                                    return;
                                                var scriptContent = $_2(scriptEl).html() || '';
                                                // JSON 데이터에서 키워드 추출 (더 많은 패턴)
                                                var jsonPatterns = [
                                                    /trendingSearches\s*[:=]\s*(\[.*?\])/s,
                                                    /trendingSearchesDays\s*[:=]\s*(\[.*?\])/s,
                                                    /"query"\s*:\s*"([^"]+)"/g,
                                                    /"keyword"\s*:\s*"([^"]+)"/g,
                                                    /"title"\s*:\s*"([^"]+)"/g,
                                                    /"topic"\s*:\s*"([^"]+)"/g,
                                                    /"searchTerm"\s*:\s*"([^"]+)"/g,
                                                    /"formattedValue"\s*:\s*"([^"]+)"/g
                                                ];
                                                for (var _a = 0, jsonPatterns_2 = jsonPatterns; _a < jsonPatterns_2.length; _a++) {
                                                    var pattern = jsonPatterns_2[_a];
                                                    var match = void 0;
                                                    while ((match = pattern.exec(scriptContent)) !== null && tempKeywords_1.size < limit * 2) {
                                                        var keyword = (match[2] || match[1] || '').trim();
                                                        // 기본적인 검증만 (필터링 최소화)
                                                        if (keyword &&
                                                            keyword.length >= 2 &&
                                                            !keyword.includes('http') &&
                                                            !keyword.includes('google') &&
                                                            !keyword.includes('trends') &&
                                                            !keyword.match(/^[\d\s\-_]+$/) &&
                                                            !keyword.match(/^[a-zA-Z\s]+$/)) {
                                                            tempKeywords_1.add(keyword);
                                                            console.log("[GOOGLE-REALTIME] \uC2A4\uD06C\uB9BD\uD2B8\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                        }
                                                    }
                                                }
                                            });
                                            console.log("[GOOGLE-REALTIME] \uC2A4\uD06C\uB9BD\uD2B8 \uD30C\uC2F1 \uD6C4 \uD0A4\uC6CC\uB4DC \uAC1C\uC218: ".concat(tempKeywords_1.size));
                                        }
                                        if (tempKeywords_1.size > 0) {
                                            console.log("[GOOGLE-REALTIME] \uCD1D ".concat(tempKeywords_1.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                            // 최대 10개만 순서대로 가져오기
                                            Array.from(tempKeywords_1).slice(0, Math.min(limit, 10)).forEach(function (keyword, idx) {
                                                keywords_2.push({
                                                    rank: idx + 1,
                                                    keyword: keyword,
                                                    source: 'google',
                                                    timestamp: new Date().toISOString()
                                                });
                                            });
                                            if (keywords_2.length >= Math.min(limit, 10)) {
                                                console.log("[GOOGLE-REALTIME] \u2705 \uC218\uC9D1 \uC644\uB8CC: ".concat(keywords_2.length, "\uAC1C (\uC77C\uC77C \uD2B8\uB80C\uB4DC \uC21C\uC704\uB300\uB85C)"));
                                                console.log("[GOOGLE-REALTIME] \uC0D8\uD50C:", keywords_2.slice(0, 3).map(function (k) { return k.keyword; }));
                                                return [2 /*return*/, { value: keywords_2.slice(0, Math.min(limit, 10)) }];
                                            }
                                        }
                                    }
                                    return [3 /*break*/, 11];
                                case 10:
                                    apiError_1 = _d.sent();
                                    console.error("[GOOGLE-REALTIME] HTML \uD06C\uB864\uB9C1 \uC5D0\uB7EC:", apiError_1.message);
                                    return [3 /*break*/, 11];
                                case 11:
                                    if (!(keywords_2.length < Math.min(limit, 10) && attempt < MAX_RETRIES)) return [3 /*break*/, 13];
                                    console.log("[GOOGLE-REALTIME] ".concat(RETRY_DELAY, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 12:
                                    _d.sent();
                                    _d.label = 13;
                                case 13: return [3 /*break*/, 17];
                                case 14:
                                    error_2 = _d.sent();
                                    console.error("[GOOGLE-REALTIME] \uC2DC\uB3C4 ".concat(attempt, " \uC2E4\uD328:"), error_2.message);
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 16];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 15:
                                    _d.sent();
                                    _d.label = 16;
                                case 16: return [3 /*break*/, 17];
                                case 17: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= MAX_RETRIES)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_3(attempt)];
                case 2:
                    state_2 = _a.sent();
                    if (typeof state_2 === "object")
                        return [2 /*return*/, state_2.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    console.warn('[GOOGLE-REALTIME] 모든 재시도 실패, 빈 배열 반환');
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * 네이트 실시간 검색어 크롤링
 */
function getNateRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var MAX_RETRIES, RETRY_DELAY, _loop_5, attempt, state_4;
        var _a, _b, _c;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    MAX_RETRIES = 3;
                    RETRY_DELAY = 1000;
                    _loop_5 = function (attempt) {
                        var keywords_3, urls, response, lastError, _e, urls_2, url, err_2, $_3, nateKeywordList, nateSelectors, _f, nateSelectors_1, selector, elements, selectors, _g, selectors_3, selector, rankElements, _loop_6, index, allLinks, _loop_7, index, error_3;
                        return __generator(this, function (_h) {
                            switch (_h.label) {
                                case 0:
                                    _h.trys.push([0, 9, , 12]);
                                    console.log("[NATE-REALTIME] ========== \uB124\uC774\uD2B8 \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 \uC218\uC9D1 \uC2DC\uC791 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, ") =========="));
                                    keywords_3 = [];
                                    urls = [
                                        'https://m.nate.com/',
                                        'https://www.nate.com/'
                                    ];
                                    response = void 0;
                                    lastError = void 0;
                                    _e = 0, urls_2 = urls;
                                    _h.label = 1;
                                case 1:
                                    if (!(_e < urls_2.length)) return [3 /*break*/, 6];
                                    url = urls_2[_e];
                                    _h.label = 2;
                                case 2:
                                    _h.trys.push([2, 4, , 5]);
                                    console.log("[NATE-REALTIME] HTML \uD398\uC774\uC9C0 \uC694\uCCAD: ".concat(url));
                                    return [4 /*yield*/, axios_1.default.get(url, {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                                'Accept-Encoding': 'gzip, deflate, br',
                                                'Connection': 'keep-alive',
                                                'Upgrade-Insecure-Requests': '1'
                                            },
                                            timeout: 15000,
                                            validateStatus: function (status) { return status < 500; },
                                            maxRedirects: 3
                                        })];
                                case 3:
                                    response = _h.sent();
                                    if (response.status === 200 && response.data) {
                                        console.log("[NATE-REALTIME] HTML \uC751\uB2F5: ".concat(url, " - \uC0C1\uD0DC: ").concat(response.status, ", \uAE38\uC774: ").concat(((_a = response.data) === null || _a === void 0 ? void 0 : _a.length) || 0, " bytes"));
                                        return [3 /*break*/, 6];
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    err_2 = _h.sent();
                                    lastError = err_2;
                                    console.warn("[NATE-REALTIME] HTML \uC694\uCCAD \uC2E4\uD328 (".concat(url, "):"), err_2 === null || err_2 === void 0 ? void 0 : err_2.message);
                                    return [3 /*break*/, 5];
                                case 5:
                                    _e++;
                                    return [3 /*break*/, 1];
                                case 6:
                                    if (!response || !response.data) {
                                        throw lastError || new Error('모든 Nate URL 실패');
                                    }
                                    $_3 = cheerio.load(response.data);
                                    nateKeywordList = $_3('#olLiveIssueKeyword, ol.isKeywordList');
                                    if (nateKeywordList.length > 0 && keywords_3.length < limit) {
                                        console.log('[NATE-REALTIME] 네이트 실시간 검색어 리스트 발견');
                                        nateKeywordList.find('li').each(function (index, li) {
                                            if (keywords_3.length >= limit) {
                                                return false; // Cheerio 반복 중단
                                            }
                                            var $li = $_3(li);
                                            var keywordText = '';
                                            // 우선순위 1: .txt_rank 클래스에서 텍스트 추출 (가장 정확)
                                            var txtRank = $li.find('.txt_rank').first();
                                            if (txtRank.length > 0) {
                                                keywordText = txtRank.text().trim();
                                            }
                                            // 우선순위 2: <a> 태그의 onclick 속성에서 키워드 추출
                                            if (!keywordText || keywordText.length < 2) {
                                                var $a = $li.find('a').first();
                                                var onclick_1 = $a.attr('onclick') || '';
                                                var onclickMatch = onclick_1.match(/clickSearchKeyword\(['"]([^'"]+)['"]/);
                                                if (onclickMatch && onclickMatch[1]) {
                                                    keywordText = onclickMatch[1].trim();
                                                }
                                            }
                                            // 우선순위 3: <a> 태그의 href에서 키워드 추출
                                            if (!keywordText || keywordText.length < 2) {
                                                var $a = $li.find('a').first();
                                                var href = $a.attr('href') || '';
                                                if (href) {
                                                    var hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
                                                    if (hrefMatch && hrefMatch[1]) {
                                                        try {
                                                            keywordText = decodeURIComponent(hrefMatch[1]).trim();
                                                        }
                                                        catch (e) {
                                                            // 디코딩 실패 무시
                                                        }
                                                    }
                                                }
                                            }
                                            // 우선순위 4: <a> 태그의 직접 텍스트
                                            if (!keywordText || keywordText.length < 2) {
                                                var $a = $li.find('a').first();
                                                keywordText = $a.text().trim();
                                            }
                                            // 순위 번호 제거 (num_rank는 제외하고 키워드만)
                                            keywordText = keywordText
                                                .replace(/^\d+\.?\s*/, '')
                                                .replace(/^\d+위\s*/, '')
                                                .replace(/^(new|하락|상승)\s*\d*\s*/i, '') // "new", "하락", "상승" 제거
                                                .replace(/\s+/g, ' ')
                                                .trim();
                                            // 광고 텍스트 필터링
                                            if (!keywordText || keywordText.length === 0 ||
                                                keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') ||
                                                keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
                                                return true; // continue
                                            }
                                            // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
                                            if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
                                                !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate|new|하락|상승)$/i) &&
                                                !keywords_3.find(function (k) { return k.keyword === keywordText; })) {
                                                keywords_3.push({
                                                    rank: keywords_3.length + 1,
                                                    keyword: keywordText,
                                                    source: 'nate',
                                                    timestamp: new Date().toISOString()
                                                });
                                                console.log("[NATE-REALTIME] \uB124\uC774\uD2B8 \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(keywords_3.length, "\uBC88\uC9F8): ").concat(keywordText));
                                            }
                                            return; // 명시적 반환
                                        });
                                        if (keywords_3.length >= limit) {
                                            console.log("[NATE-REALTIME] \u2705 \uB124\uC774\uD2B8 \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 \uB9AC\uC2A4\uD2B8\uC5D0\uC11C ".concat(keywords_3.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uC131\uACF5"));
                                            return [2 /*return*/, { value: keywords_3.slice(0, limit) }];
                                        }
                                    }
                                    nateSelectors = [
                                        '#olLiveIssueKeyword li a',
                                        'ol.isKeywordList li a',
                                        '#olLiveIssueKeyword .txt_rank',
                                        'ol.isKeywordList .txt_rank',
                                        '.isKeywordList li a',
                                        '.isKeywordList .txt_rank',
                                    ];
                                    for (_f = 0, nateSelectors_1 = nateSelectors; _f < nateSelectors_1.length; _f++) {
                                        selector = nateSelectors_1[_f];
                                        if (keywords_3.length >= limit)
                                            break;
                                        elements = $_3(selector);
                                        if (elements.length === 0)
                                            continue;
                                        console.log("[NATE-REALTIME] \uB124\uC774\uD2B8 \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                        elements.each(function (index, element) {
                                            if (keywords_3.length >= limit) {
                                                return false; // Cheerio 반복 중단
                                            }
                                            var keywordText = '';
                                            var $el = $_3(element);
                                            // 우선순위 1: txt_rank 클래스에서 텍스트 추출 (가장 정확)
                                            var txtRank = $el.find('.txt_rank').first();
                                            if (txtRank.length > 0) {
                                                keywordText = txtRank.text().trim();
                                            }
                                            // 우선순위 2: onclick 속성에서 키워드 추출
                                            if (!keywordText || keywordText.length < 2) {
                                                var onclick_2 = $el.attr('onclick') || '';
                                                var onclickMatch = onclick_2.match(/clickSearchKeyword\(['"]([^'"]+)['"]/);
                                                if (onclickMatch && onclickMatch[1]) {
                                                    keywordText = onclickMatch[1].trim();
                                                }
                                            }
                                            // 우선순위 3: href에서 키워드 추출
                                            if (!keywordText || keywordText.length < 2) {
                                                var href = $el.attr('href') || '';
                                                if (href) {
                                                    var hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
                                                    if (hrefMatch && hrefMatch[1]) {
                                                        try {
                                                            keywordText = decodeURIComponent(hrefMatch[1]).trim();
                                                        }
                                                        catch (e) {
                                                            // 디코딩 실패 무시
                                                        }
                                                    }
                                                }
                                            }
                                            // 우선순위 4: 요소의 직접 텍스트
                                            if (!keywordText || keywordText.length < 2) {
                                                keywordText = $el.text().trim();
                                            }
                                            // 순위 번호 제거
                                            keywordText = keywordText
                                                .replace(/^\d+\.?\s*/, '')
                                                .replace(/^\d+위\s*/, '')
                                                .replace(/^(new|하락|상승)\s*\d*\s*/i, '')
                                                .replace(/\s+/g, ' ')
                                                .trim();
                                            // 광고 텍스트 필터링
                                            if (!keywordText || keywordText.length === 0 ||
                                                keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') ||
                                                keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
                                                return; // continue
                                            }
                                            // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
                                            if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
                                                !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate|new|하락|상승)$/i) &&
                                                !keywords_3.find(function (k) { return k.keyword === keywordText; })) {
                                                keywords_3.push({
                                                    rank: keywords_3.length + 1,
                                                    keyword: keywordText,
                                                    source: 'nate',
                                                    timestamp: new Date().toISOString()
                                                });
                                                console.log("[NATE-REALTIME] \uB124\uC774\uD2B8 \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(keywords_3.length, "\uBC88\uC9F8): ").concat(keywordText));
                                            }
                                            return; // 명시적 반환
                                        });
                                        if (keywords_3.length >= limit) {
                                            console.log("[NATE-REALTIME] \u2705 \uB124\uC774\uD2B8 \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(keywords_3.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uC131\uACF5"));
                                            break;
                                        }
                                    }
                                    selectors = [
                                        'ol.realtime li a',
                                        'ul.realtime li a',
                                        '.rank_list li a',
                                        '.ranking_list li a',
                                        '.issue_keyword li a',
                                        '.keyword_rank li a',
                                        '.trending li a',
                                        'ol li a[href*="search"]',
                                        'ul li a[href*="search"]',
                                    ];
                                    for (_g = 0, selectors_3 = selectors; _g < selectors_3.length; _g++) {
                                        selector = selectors_3[_g];
                                        if (keywords_3.length >= limit)
                                            break;
                                        rankElements = $_3(selector);
                                        console.log("[NATE-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(rankElements.length, "\uAC1C \uC694\uC18C \uBC1C\uACAC"));
                                        _loop_6 = function (index) {
                                            var element = rankElements[index];
                                            var keywordText = '';
                                            // href에서 키워드 추출 (우선순위 1)
                                            var href = $_3(element).attr('href') || '';
                                            if (href) {
                                                var hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
                                                if (hrefMatch && hrefMatch[1]) {
                                                    try {
                                                        keywordText = decodeURIComponent(hrefMatch[1]).trim();
                                                    }
                                                    catch (e) {
                                                        // 디코딩 실패 무시
                                                    }
                                                }
                                            }
                                            // href에서 못 찾은 경우 텍스트 사용 (우선순위 2)
                                            // 전체 요소의 텍스트를 가져오도록 수정 (자식 요소 포함, 순서대로)
                                            if (!keywordText || keywordText.length < 2) {
                                                // 직접 DOM 노드의 텍스트를 가져오기 (순서대로)
                                                keywordText = $_3(element).text().trim();
                                                // 만약 텍스트가 짧거나 순서가 이상하면, 모든 자식 요소의 텍스트를 순서대로 합치기
                                                if (!keywordText || keywordText.length < 2) {
                                                    var fullText_1 = '';
                                                    $_3(element).contents().each(function (_idx, node) {
                                                        if (node.type === 'text') {
                                                            fullText_1 += $_3(node).text().trim() + ' ';
                                                        }
                                                        else if (node.type === 'tag') {
                                                            var childText = $_3(node).text().trim();
                                                            if (childText) {
                                                                fullText_1 += childText + ' ';
                                                            }
                                                        }
                                                    });
                                                    keywordText = fullText_1.trim();
                                                }
                                                // 여전히 없으면 일반적인 방법 시도
                                                if (!keywordText || keywordText.length < 2) {
                                                    keywordText = $_3(element).text().trim() ||
                                                        $_3(element).find('a, span, strong, em, div').first().text().trim() ||
                                                        $_3(element).attr('title') ||
                                                        $_3(element).attr('aria-label') ||
                                                        $_3(element).attr('data-text') || '';
                                                }
                                            }
                                            // 광고 텍스트 필터링
                                            if (!keywordText || keywordText.length === 0 ||
                                                keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') ||
                                                keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
                                                return "continue";
                                            }
                                            // 여러 줄 텍스트는 첫 줄만 사용하되, 공백으로 연결된 텍스트는 유지
                                            var cleanText = ((_b = keywordText.split('\n')[0]) === null || _b === void 0 ? void 0 : _b.trim()) || keywordText.trim();
                                            // 순위 번호만 제거하고, 키워드 텍스트는 유지 (중간의 숫자나 "위"는 제거하지 않음)
                                            keywordText = cleanText
                                                .replace(/^\d+\.?\s*/, '') // 앞의 순위 번호만 제거
                                                .replace(/^\d+위\s*/, '') // 앞의 "1위 " 같은 것만 제거
                                                .replace(/\s+/g, ' ') // 공백 정리
                                                .trim();
                                            // 키워드가 너무 짧으면 (1-2자) 다음 요소로 넘어가기
                                            if (keywordText.length < 2) {
                                                return "continue";
                                            }
                                            // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
                                            if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
                                                !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate)$/i) &&
                                                !keywords_3.find(function (k) { return k.keyword === keywordText; })) {
                                                keywords_3.push({
                                                    keyword: keywordText,
                                                    rank: keywords_3.length + 1,
                                                    source: 'nate',
                                                    timestamp: new Date().toISOString()
                                                });
                                            }
                                        };
                                        for (index = 0; index < rankElements.length && keywords_3.length < limit; index++) {
                                            _loop_6(index);
                                        }
                                        if (keywords_3.length >= 5) {
                                            console.log("[NATE-REALTIME] \u2705 \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(keywords_3.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uC131\uACF5"));
                                            break;
                                        }
                                    }
                                    // 더 일반적인 패턴 시도
                                    if (keywords_3.length < limit) {
                                        allLinks = $_3('a[href*="/search"], a[href*="keyword"], a[href*="issue"], a[href*="trend"]');
                                        console.log("[NATE-REALTIME] \uC804\uCCB4 \uB9C1\uD06C ".concat(allLinks.length, "\uAC1C \uBC1C\uACAC"));
                                        _loop_7 = function (index) {
                                            var element = allLinks[index];
                                            var text = $_3(element).text().trim();
                                            // href에서도 키워드 추출
                                            var href = $_3(element).attr('href') || '';
                                            var hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
                                            if (hrefMatch && hrefMatch[1]) {
                                                try {
                                                    text = decodeURIComponent(hrefMatch[1]).trim();
                                                }
                                                catch (e) {
                                                    // 디코딩 실패 무시
                                                }
                                            }
                                            if (text && text.length >= 2 && text.length < 50 && !text.includes('http') &&
                                                !text.match(/^\d+$/) && !text.match(/^(검색|더보기|전체보기|이슈|네이트|nate)$/i)) {
                                                if (!keywords_3.find(function (k) { return k.keyword === text; })) {
                                                    keywords_3.push({
                                                        keyword: text,
                                                        rank: keywords_3.length + 1,
                                                        source: 'nate',
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                            }
                                        };
                                        for (index = 0; index < allLinks.length && keywords_3.length < limit; index++) {
                                            _loop_7(index);
                                        }
                                    }
                                    // 키워드 수집 성공 시 즉시 반환
                                    if (keywords_3.length >= 5) {
                                        console.log("[NATE-REALTIME] \u2705 \uC218\uC9D1 \uC644\uB8CC: ".concat(keywords_3.length, "\uAC1C \uD0A4\uC6CC\uB4DC (\uC2DC\uB3C4 ").concat(attempt, "/").concat(MAX_RETRIES, ")"));
                                        return [2 /*return*/, { value: keywords_3.slice(0, limit) }];
                                    }
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 8];
                                    console.warn("[NATE-REALTIME] \u26A0\uFE0F \uD0A4\uC6CC\uB4DC \uBD80\uC871 (".concat(keywords_3.length, "\uAC1C), ").concat(RETRY_DELAY, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY * attempt); })];
                                case 7:
                                    _h.sent();
                                    return [2 /*return*/, "continue"];
                                case 8:
                                    // 마지막 시도에서도 부족하면 수집된 것이라도 반환
                                    if (keywords_3.length > 0) {
                                        console.log("[NATE-REALTIME] \u26A0\uFE0F \uC218\uC9D1 \uC644\uB8CC (\uBD80\uC871): ".concat(keywords_3.length, "\uAC1C \uD0A4\uC6CC\uB4DC"));
                                        return [2 /*return*/, { value: keywords_3.slice(0, limit) }];
                                    }
                                    return [2 /*return*/, { value: [] }];
                                case 9:
                                    error_3 = _h.sent();
                                    console.error("[NATE-REALTIME] \u26A0\uFE0F \uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, " \uC2E4\uD328:"), error_3 === null || error_3 === void 0 ? void 0 : error_3.message);
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 11];
                                    console.warn("[NATE-REALTIME] ".concat(RETRY_DELAY * attempt, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY * attempt); })];
                                case 10:
                                    _h.sent();
                                    return [2 /*return*/, "continue"];
                                case 11:
                                    // 모든 시도 실패
                                    console.error('[NATE-REALTIME] ========== 모든 시도 실패 ==========');
                                    console.error('[NATE-REALTIME] 에러 타입:', (_c = error_3 === null || error_3 === void 0 ? void 0 : error_3.constructor) === null || _c === void 0 ? void 0 : _c.name);
                                    console.error('[NATE-REALTIME] 에러 메시지:', error_3 === null || error_3 === void 0 ? void 0 : error_3.message);
                                    if (error_3 === null || error_3 === void 0 ? void 0 : error_3.response) {
                                        console.error('[NATE-REALTIME] HTTP 상태:', error_3.response.status, error_3.response.statusText);
                                    }
                                    return [3 /*break*/, 12];
                                case 12: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= MAX_RETRIES)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_5(attempt)];
                case 2:
                    state_4 = _d.sent();
                    if (typeof state_4 === "object")
                        return [2 /*return*/, state_4.value];
                    _d.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    console.warn('[NATE-REALTIME] 모든 재시도 실패, 빈 배열 반환');
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * 다음 실시간 검색어 크롤링
 */
function getDaumRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var MAX_RETRIES, RETRY_DELAY, _loop_8, attempt, state_5;
        var _a, _b;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    MAX_RETRIES = 3;
                    RETRY_DELAY = 1000;
                    _loop_8 = function (attempt) {
                        var keywords_4, apiUrls, _d, apiUrls_1, apiUrl, apiResponse, data, keywordList, apiError_2, response, html, briefingMatch, pattern, match, rank, keyword, trendMatch, pattern, match, uniqueKeywords, keyword, rank, $_4, tempKeywords_2, selectors, _e, selectors_4, selector, elements, idx, el, keyword, href, hrefMatch, wordCount, isLikelyTitle, isTitleAttribute, isNewsTitle, htmlError_1, error_4;
                        return __generator(this, function (_f) {
                            switch (_f.label) {
                                case 0:
                                    _f.trys.push([0, 13, , 16]);
                                    console.log("[DAUM-REALTIME] ========== \uB2E4\uC74C \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 \uC218\uC9D1 \uC2DC\uC791 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, ") =========="));
                                    keywords_4 = [];
                                    apiUrls = [
                                        'https://m.daum.net/api/realtime/keyword',
                                        'https://www.daum.net/api/realtime/keyword',
                                    ];
                                    console.log('[DAUM-REALTIME] 방법 1: API 직접 호출');
                                    _d = 0, apiUrls_1 = apiUrls;
                                    _f.label = 1;
                                case 1:
                                    if (!(_d < apiUrls_1.length)) return [3 /*break*/, 6];
                                    apiUrl = apiUrls_1[_d];
                                    _f.label = 2;
                                case 2:
                                    _f.trys.push([2, 4, , 5]);
                                    console.log("[DAUM-REALTIME] API \uD638\uCD9C: ".concat(apiUrl));
                                    return [4 /*yield*/, axios_1.default.get(apiUrl, {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                                'Accept': 'application/json, */*',
                                                'Accept-Language': 'ko-KR,ko;q=0.9',
                                                'Referer': 'https://www.daum.net/'
                                            },
                                            timeout: 10000,
                                            validateStatus: function (status) { return status < 500; }
                                        })];
                                case 3:
                                    apiResponse = _f.sent();
                                    console.log("[DAUM-REALTIME] \uC751\uB2F5: ".concat(apiUrl, ", \uC0C1\uD0DC: ").concat(apiResponse.status));
                                    if (apiResponse.data) {
                                        data = apiResponse.data;
                                        console.log("[DAUM-REALTIME] \uC751\uB2F5 \uD0A4:", Object.keys(data));
                                        keywordList = data.data ||
                                            data.keywords ||
                                            data.items ||
                                            data.list ||
                                            (Array.isArray(data) ? data : []);
                                        console.log("[DAUM-REALTIME] \uD0A4\uC6CC\uB4DC \uAC1C\uC218: ".concat(Array.isArray(keywordList) ? keywordList.length : 0));
                                        if (Array.isArray(keywordList) && keywordList.length > 0) {
                                            keywordList.slice(0, limit).forEach(function (item, idx) {
                                                // title은 제목이므로 제외하고, keyword/word/text/query만 사용
                                                var keyword = item.keyword ||
                                                    item.word ||
                                                    item.text ||
                                                    item.query;
                                                // title 필드가 있으면 무시 (제목이 키워드로 들어가는 것 방지)
                                                // String(item)으로 변환하는 것도 제거 (제목이 문자열로 변환될 수 있음)
                                                if (!keyword && item.title) {
                                                    return; // title만 있으면 스킵
                                                }
                                                if (keyword && typeof keyword === 'string' && keyword.trim().length >= 2) {
                                                    var trimmedKeyword = keyword.trim();
                                                    // 제목처럼 보이는 긴 텍스트 필터링 (50자 이상이고 공백이 많으면 제목일 가능성)
                                                    if (trimmedKeyword.length > 50 && trimmedKeyword.split(/\s+/).length > 8) {
                                                        console.log("[DAUM-REALTIME] \uC81C\uBAA9\uCC98\uB7FC \uBCF4\uC774\uB294 \uD14D\uC2A4\uD2B8 \uC81C\uC678: ".concat(trimmedKeyword.substring(0, 30), "..."));
                                                        return;
                                                    }
                                                    keywords_4.push({
                                                        rank: idx + 1,
                                                        keyword: trimmedKeyword,
                                                        source: 'daum',
                                                        timestamp: new Date().toISOString()
                                                    });
                                                }
                                            });
                                            if (keywords_4.length >= 5) {
                                                console.log("[DAUM-REALTIME] \u2705 API \uC131\uACF5: ".concat(keywords_4.length, "\uAC1C"));
                                                console.log("[DAUM-REALTIME] \uC0D8\uD50C:", keywords_4.slice(0, 3).map(function (k) { return k.keyword; }));
                                                return [2 /*return*/, { value: keywords_4.slice(0, limit) }];
                                            }
                                        }
                                    }
                                    return [3 /*break*/, 5];
                                case 4:
                                    apiError_2 = _f.sent();
                                    console.warn("[DAUM-REALTIME] API \uC2E4\uD328 (".concat(apiUrl, "):"), apiError_2.message);
                                    return [3 /*break*/, 5];
                                case 5:
                                    _d++;
                                    return [3 /*break*/, 1];
                                case 6:
                                    if (!(keywords_4.length === 0)) return [3 /*break*/, 10];
                                    console.log('[DAUM-REALTIME] 방법 2: HTML 페이지 파싱 (정규식 기반)');
                                    _f.label = 7;
                                case 7:
                                    _f.trys.push([7, 9, , 10]);
                                    return [4 /*yield*/, axios_1.default.get('https://www.daum.net/', {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                                'Accept-Language': 'ko-KR,ko;q=0.9',
                                                'Accept-Encoding': 'gzip, deflate, br',
                                                'Connection': 'keep-alive'
                                            },
                                            timeout: 10000
                                        })];
                                case 8:
                                    response = _f.sent();
                                    html = response.data;
                                    console.log("[DAUM-REALTIME] HTML \uBC1B\uC74C: ".concat(html.length, " bytes"));
                                    // 방법 2-1: list_briefing_wrap (브리핑 영역) - 우선순위 1
                                    console.log('[DAUM-REALTIME] 방법 2-1: list_briefing 영역 검색');
                                    briefingMatch = html.match(/<div[^>]*class="list_briefing_wrap"[^>]*>([\s\S]*?)<\/div>/i);
                                    if (briefingMatch) {
                                        console.log('[DAUM-REALTIME] list_briefing 영역 발견');
                                        pattern = /<em[^>]*class="txt_briefing"[^>]*>([^<]+)<\/em>/gi;
                                        match = void 0;
                                        rank = 1;
                                        while ((match = pattern.exec(briefingMatch[1])) !== null && rank <= limit) {
                                            keyword = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
                                            if (keyword && keyword.length >= 2 && keyword.length < 100) {
                                                keywords_4.push({
                                                    rank: rank,
                                                    keyword: keyword,
                                                    source: 'daum',
                                                    timestamp: new Date().toISOString()
                                                });
                                                console.log("[DAUM-REALTIME] \uBC1C\uACAC: ".concat(rank, "\uC704 - ").concat(keyword));
                                                rank++;
                                            }
                                        }
                                    }
                                    // 방법 2-2: list_trend_wrap (트렌드 영역) - 방법 2-1 실패 시
                                    if (keywords_4.length === 0) {
                                        console.log('[DAUM-REALTIME] 방법 2-2: list_trend 영역 검색');
                                        trendMatch = html.match(/<div[^>]*class="list_trend_wrap"[^>]*>([\s\S]*?)<\/div>/i);
                                        if (trendMatch) {
                                            console.log('[DAUM-REALTIME] list_trend 영역 발견');
                                            pattern = /<strong[^>]*class="txt_keyword[^"]*"[^>]*>([^<]+)<\/strong>/gi;
                                            match = void 0;
                                            uniqueKeywords = new Set();
                                            while ((match = pattern.exec(trendMatch[1])) !== null) {
                                                keyword = (_b = match[1]) === null || _b === void 0 ? void 0 : _b.trim();
                                                // 중복 제거 (같은 키워드가 여러 번 나타남)
                                                if (keyword &&
                                                    keyword.length >= 2 &&
                                                    keyword.length < 100 &&
                                                    !uniqueKeywords.has(keyword)) {
                                                    uniqueKeywords.add(keyword);
                                                    rank = uniqueKeywords.size;
                                                    keywords_4.push({
                                                        rank: rank,
                                                        keyword: keyword,
                                                        source: 'daum',
                                                        timestamp: new Date().toISOString()
                                                    });
                                                    console.log("[DAUM-REALTIME] \uBC1C\uACAC: ".concat(rank, "\uC704 - ").concat(keyword));
                                                    if (uniqueKeywords.size >= limit) {
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    // 방법 2-3: Cheerio를 사용한 DOM 파싱 (폴백)
                                    if (keywords_4.length === 0) {
                                        console.log('[DAUM-REALTIME] 방법 2-3: Cheerio DOM 파싱 (폴백)');
                                        $_4 = cheerio.load(html);
                                        tempKeywords_2 = new Set();
                                        selectors = [
                                            '.link_issue',
                                            '.issue_keyword a',
                                            '.rank_list a',
                                            '.keyword_list a',
                                            '.realtime_keyword a',
                                            'li[class*="rank"] a',
                                            'li[class*="keyword"] a',
                                            'li[class*="issue"] a',
                                            'li[class*="realtime"] a',
                                            '[class*="realtime"] a',
                                            '[class*="issue"] a',
                                            '[class*="keyword"] a',
                                            '[data-keyword]',
                                            'a[href*="/search?q="]',
                                            'a[href*="/search?query="]',
                                            'a[href*="/search?keyword="]',
                                            'ol li a[href*="search"]',
                                            'ul li a[href*="search"]',
                                            '[id*="rank"] li a',
                                            '[id*="keyword"] li a',
                                            '[id*="issue"] li a'
                                        ];
                                        for (_e = 0, selectors_4 = selectors; _e < selectors_4.length; _e++) {
                                            selector = selectors_4[_e];
                                            if (tempKeywords_2.size >= limit)
                                                break;
                                            elements = $_4(selector);
                                            console.log("[DAUM-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                            for (idx = 0; idx < elements.length && tempKeywords_2.size < limit * 2; idx++) {
                                                el = elements.eq(idx);
                                                keyword = el.text().trim();
                                                // data-keyword 속성에서 추출
                                                if (!keyword) {
                                                    keyword = el.attr('data-keyword') || '';
                                                }
                                                href = el.attr('href') || '';
                                                if (href) {
                                                    hrefMatch = href.match(/[?&]q=([^&]+)/);
                                                    if (hrefMatch && hrefMatch[1]) {
                                                        try {
                                                            keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                        }
                                                        catch (e) {
                                                            // 디코딩 실패 무시
                                                        }
                                                    }
                                                }
                                                // 키워드 정제
                                                keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
                                                wordCount = keyword.split(/\s+/).length;
                                                isLikelyTitle = keyword.length > 50 && wordCount > 8;
                                                isTitleAttribute = el.attr('title') && el.attr('title') === keyword;
                                                isNewsTitle = el.closest('[class*="news"], [class*="article"], [class*="title"]').length > 0;
                                                if (keyword &&
                                                    keyword.length >= 2 &&
                                                    keyword.length < 50 &&
                                                    !isLikelyTitle &&
                                                    !isTitleAttribute &&
                                                    !isNewsTitle &&
                                                    !keyword.includes('http') &&
                                                    !keyword.includes('://') &&
                                                    !keyword.includes('더보기') &&
                                                    !keyword.includes('전체보기') &&
                                                    !keyword.includes('검색') &&
                                                    !keyword.match(/^(제목|내용|링크|URL|이미지|사진|영상|동영상|비디오)$/i) &&
                                                    !/^[\d\s\-_]+$/.test(keyword)) {
                                                    tempKeywords_2.add(keyword);
                                                    console.log("[DAUM-REALTIME] HTML\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                }
                                            }
                                            if (tempKeywords_2.size >= 5) {
                                                console.log("[DAUM-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(tempKeywords_2.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                                break;
                                            }
                                        }
                                        // 방법 2-2: 스크립트 태그에서 JSON 데이터 추출
                                        if (tempKeywords_2.size < 5) {
                                            $_4('script').each(function (_i, scriptEl) {
                                                if (tempKeywords_2.size >= limit)
                                                    return;
                                                var scriptContent = $_4(scriptEl).html() || '';
                                                // TIARA 데이터 패턴
                                                var patterns = [
                                                    /TIARA[\s\S]*?keyword["']\s*:\s*["']([^"']+)["']/gi,
                                                    /"keyword"\s*:\s*"([^"]+)"/g,
                                                    /"query"\s*:\s*"([^"]+)"/g,
                                                    /data-keyword=["']([^"']+)["']/gi
                                                ];
                                                for (var _a = 0, patterns_1 = patterns; _a < patterns_1.length; _a++) {
                                                    var pattern = patterns_1[_a];
                                                    var match = void 0;
                                                    while ((match = pattern.exec(scriptContent)) !== null && tempKeywords_2.size < limit * 2) {
                                                        var keyword = (match[1] || '').trim();
                                                        if (keyword &&
                                                            keyword.length >= 2 &&
                                                            keyword.length < 50 &&
                                                            !keyword.includes('http') &&
                                                            !keyword.includes('더보기') &&
                                                            !keyword.includes('전체보기')) {
                                                            tempKeywords_2.add(keyword);
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                        if (tempKeywords_2.size > 0) {
                                            console.log("[DAUM-REALTIME] \uCD1D ".concat(tempKeywords_2.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                            Array.from(tempKeywords_2).slice(0, limit).forEach(function (keyword, idx) {
                                                keywords_4.push({
                                                    rank: idx + 1,
                                                    keyword: keyword,
                                                    source: 'daum',
                                                    timestamp: new Date().toISOString()
                                                });
                                            });
                                        }
                                    }
                                    return [3 /*break*/, 10];
                                case 9:
                                    htmlError_1 = _f.sent();
                                    console.error("[DAUM-REALTIME] HTML \uD30C\uC2F1 \uC2E4\uD328:", htmlError_1.message);
                                    return [3 /*break*/, 10];
                                case 10:
                                    // 키워드 수집 성공 시 반환
                                    if (keywords_4.length >= 5) {
                                        console.log("[DAUM-REALTIME] \u2705 \uC218\uC9D1 \uC644\uB8CC: ".concat(keywords_4.length, "\uAC1C"));
                                        return [2 /*return*/, { value: keywords_4.slice(0, limit) }];
                                    }
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 12];
                                    console.log("[DAUM-REALTIME] ".concat(RETRY_DELAY, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 11:
                                    _f.sent();
                                    _f.label = 12;
                                case 12: return [3 /*break*/, 16];
                                case 13:
                                    error_4 = _f.sent();
                                    console.error("[DAUM-REALTIME] \uC2DC\uB3C4 ".concat(attempt, " \uC2E4\uD328:"), error_4.message);
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 15];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 14:
                                    _f.sent();
                                    _f.label = 15;
                                case 15: return [3 /*break*/, 16];
                                case 16: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _c.label = 1;
                case 1:
                    if (!(attempt <= MAX_RETRIES)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_8(attempt)];
                case 2:
                    state_5 = _c.sent();
                    if (typeof state_5 === "object")
                        return [2 /*return*/, state_5.value];
                    _c.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    console.warn('[DAUM-REALTIME] 모든 재시도 실패, 빈 배열 반환');
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * 네이버 실시간 검색어 크롤링 (제거됨 - 작동하지 않음)
 */
function getNaverRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            // 네이버 실시간 검색어는 작동하지 않으므로 빈 배열 반환
            return [2 /*return*/, []];
        });
    });
}
/**
 * 복지로 검색 순위 크롤링
 * 복지로(bokjiro.go.kr) 사이트에서 인기 검색 키워드 수집
 */
function getBokjiroRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var MAX_RETRIES, RETRY_DELAY, _loop_9, attempt, state_6;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    MAX_RETRIES = 3;
                    RETRY_DELAY = 1000;
                    _loop_9 = function (attempt) {
                        var keywords_5, url, response, html, $_5, tempKeywords_3, popularSelectors, _b, popularSelectors_1, selector, elements, idx, el, keyword, href, queryMatch, searchLinks, idx, el, href, text, queryMatch, scriptCount, htmlError_2, error_5;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 7, , 10]);
                                    console.log("[BOKJIRO-REALTIME] ========== \uBCF5\uC9C0\uB85C \uAC80\uC0C9 \uC21C\uC704 \uC218\uC9D1 \uC2DC\uC791 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(MAX_RETRIES, ") =========="));
                                    keywords_5 = [];
                                    url = 'https://www.bokjiro.go.kr/ssis-tbu/twatzzza/intgSearch/moveTWZZ02000M.do';
                                    _c.label = 1;
                                case 1:
                                    _c.trys.push([1, 3, , 4]);
                                    console.log("[BOKJIRO-REALTIME] HTML \uD398\uC774\uC9C0 \uC694\uCCAD: ".concat(url));
                                    return [4 /*yield*/, axios_1.default.get(url, {
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                                                'Accept-Language': 'ko-KR,ko;q=0.9',
                                                'Referer': 'https://www.bokjiro.go.kr/'
                                            },
                                            timeout: 10000,
                                            validateStatus: function (status) { return status < 500; }
                                        })];
                                case 2:
                                    response = _c.sent();
                                    console.log("[BOKJIRO-REALTIME] \uC751\uB2F5: ".concat(url, ", \uC0C1\uD0DC: ").concat(response.status));
                                    if (response.data) {
                                        html = response.data;
                                        console.log("[BOKJIRO-REALTIME] HTML \uBC1B\uC74C: ".concat(html.length, " bytes"));
                                        $_5 = cheerio.load(html);
                                        tempKeywords_3 = new Set();
                                        popularSelectors = [
                                            '.popular_srch_list li a',
                                            '.srch_ranking li a',
                                            '.rank_list li a',
                                            '.keyword_list li a',
                                            '.popular-list li a',
                                            'ul.popular-list li a',
                                            'ol.popular-list li a',
                                            'ul[class*="popular"] li a',
                                            'ol[class*="popular"] li a',
                                            'ul[class*="rank"] li a',
                                            'ol[class*="rank"] li a',
                                            'div[class*="인기"] a',
                                            'div[class*="검색"] a',
                                            'section[class*="인기"] a',
                                            'section[class*="검색"] a',
                                            'div[class*="rank"] a',
                                            'div[class*="keyword"] a',
                                            'li[class*="rank"] a',
                                            'li[class*="keyword"] a',
                                            'li[class*="popular"] a',
                                            'a[href*="search"]',
                                            'a[href*="query"]',
                                            'a[href*="keyword"]'
                                        ];
                                        for (_b = 0, popularSelectors_1 = popularSelectors; _b < popularSelectors_1.length; _b++) {
                                            selector = popularSelectors_1[_b];
                                            if (tempKeywords_3.size >= limit)
                                                break;
                                            elements = $_5(selector);
                                            console.log("[BOKJIRO-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                            for (idx = 0; idx < elements.length && tempKeywords_3.size < limit * 2; idx++) {
                                                el = elements.eq(idx);
                                                keyword = el.text().trim();
                                                href = el.attr('href') || '';
                                                if (href) {
                                                    queryMatch = href.match(/[?&](?:q|query|keyword|search|searchKeyword)=([^&]+)/);
                                                    if (queryMatch && queryMatch[1]) {
                                                        try {
                                                            keyword = decodeURIComponent(queryMatch[1]).trim();
                                                        }
                                                        catch (e) {
                                                            // 디코딩 실패 무시
                                                        }
                                                    }
                                                }
                                                // data 속성에서 키워드 추출
                                                if (!keyword || keyword.length < 2) {
                                                    keyword = el.attr('data-keyword') || el.attr('data-query') || el.attr('data-text') || '';
                                                }
                                                // 순위 번호 제거 및 정제
                                                keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
                                                if (keyword &&
                                                    keyword.length >= 2 &&
                                                    keyword.length < 50 &&
                                                    !keyword.includes('http') &&
                                                    !keyword.includes('://') &&
                                                    !/^[\d\s\-_]+$/.test(keyword) &&
                                                    !keyword.match(/^(제\d+호|제\d+조|제\d+항|검색|더보기|전체보기|복지로|bokjiro|제목|내용|링크|URL)$/i)) {
                                                    tempKeywords_3.add(keyword);
                                                    console.log("[BOKJIRO-REALTIME] HTML\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                }
                                            }
                                            if (tempKeywords_3.size >= 5) {
                                                console.log("[BOKJIRO-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\"\uC5D0\uC11C ").concat(tempKeywords_3.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                                break;
                                            }
                                        }
                                        // 방법 2: 검색 관련 링크에서 키워드 추출
                                        if (tempKeywords_3.size < limit) {
                                            searchLinks = $_5('a[href*="search"], a[href*="query"], a[href*="keyword"], a[href*="q="]');
                                            console.log("[BOKJIRO-REALTIME] \uAC80\uC0C9 \uB9C1\uD06C ".concat(searchLinks.length, "\uAC1C \uBC1C\uACAC"));
                                            for (idx = 0; idx < searchLinks.length && tempKeywords_3.size < limit * 2; idx++) {
                                                el = searchLinks.eq(idx);
                                                href = el.attr('href') || '';
                                                text = el.text().trim();
                                                queryMatch = href.match(/[?&](?:q|query|keyword|search|searchKeyword)=([^&]+)/);
                                                if (queryMatch && queryMatch[1]) {
                                                    try {
                                                        text = decodeURIComponent(queryMatch[1]).trim();
                                                    }
                                                    catch (e) {
                                                        // 디코딩 실패 무시
                                                    }
                                                }
                                                // 순위 번호 제거 및 정제
                                                text = text.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
                                                if (text &&
                                                    text.length >= 2 &&
                                                    text.length < 50 &&
                                                    !text.includes('http') &&
                                                    !text.includes('://') &&
                                                    !/^[\d\s\-_]+$/.test(text) &&
                                                    !text.match(/^(제\d+호|제\d+조|제\d+항|검색|더보기|전체보기|복지로|bokjiro|제목|내용|링크|URL)$/i)) {
                                                    tempKeywords_3.add(text);
                                                    console.log("[BOKJIRO-REALTIME] \uAC80\uC0C9 \uB9C1\uD06C\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(text));
                                                }
                                            }
                                        }
                                        // 방법 3: 스크립트 태그에서 JSON 데이터 추출
                                        if (tempKeywords_3.size < limit) {
                                            console.log('[BOKJIRO-REALTIME] 방법 3: 스크립트 태그에서 JSON 데이터 추출');
                                            scriptCount = $_5('script').length;
                                            console.log("[BOKJIRO-REALTIME] \uBC1C\uACAC\uB41C \uC2A4\uD06C\uB9BD\uD2B8 \uD0DC\uADF8: ".concat(scriptCount, "\uAC1C"));
                                            $_5('script').each(function (_i, scriptEl) {
                                                if (tempKeywords_3.size >= limit)
                                                    return;
                                                var scriptContent = $_5(scriptEl).html() || '';
                                                if (scriptContent.length < 50)
                                                    return; // 너무 짧은 스크립트는 스킵
                                                // 더 많은 JSON 패턴 추가
                                                var jsonPatterns = [
                                                    /popularKeywords?\s*[:=]\s*(\[.*?\])/,
                                                    /hotKeywords?\s*[:=]\s*(\[.*?\])/,
                                                    /trendingKeywords?\s*[:=]\s*(\[.*?\])/,
                                                    /keywordList\s*[:=]\s*(\[.*?\])/,
                                                    /searchKeywords?\s*[:=]\s*(\[.*?\])/,
                                                    /"keyword"\s*:\s*"([^"]+)"/g,
                                                    /"word"\s*:\s*"([^"]+)"/g,
                                                    /"text"\s*:\s*"([^"]+)"/g,
                                                    /"title"\s*:\s*"([^"]+)"/g,
                                                    /"name"\s*:\s*"([^"]+)"/g
                                                ];
                                                for (var _a = 0, jsonPatterns_3 = jsonPatterns; _a < jsonPatterns_3.length; _a++) {
                                                    var pattern = jsonPatterns_3[_a];
                                                    if (tempKeywords_3.size >= limit)
                                                        break;
                                                    var match = void 0;
                                                    while ((match = pattern.exec(scriptContent)) !== null && tempKeywords_3.size < limit * 2) {
                                                        var keyword = (match[2] || match[1] || '').trim();
                                                        if (keyword && typeof keyword === 'string' && keyword.length >= 2 && keyword.length <= 50 &&
                                                            !keyword.includes('http') &&
                                                            !keyword.match(/^(제\d+호|제\d+조|제\d+항|검색|더보기|전체보기|복지로|bokjiro)$/i) &&
                                                            !/^[\d\s\-_]+$/.test(keyword)) {
                                                            tempKeywords_3.add(keyword);
                                                            console.log("[BOKJIRO-REALTIME] \uC2A4\uD06C\uB9BD\uD2B8\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                        }
                                                    }
                                                    // JSON 배열 파싱 시도
                                                    var arrayMatch = scriptContent.match(/(popularKeywords?|hotKeywords?|trendingKeywords?|keywordList|searchKeywords?)\s*[:=]\s*(\[.*?\])/);
                                                    if (arrayMatch && arrayMatch[2]) {
                                                        try {
                                                            var data = JSON.parse(arrayMatch[2]);
                                                            if (Array.isArray(data)) {
                                                                for (var _b = 0, data_1 = data; _b < data_1.length; _b++) {
                                                                    var item = data_1[_b];
                                                                    if (tempKeywords_3.size >= limit)
                                                                        break;
                                                                    var keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.word || item.name || '');
                                                                    if (keyword && typeof keyword === 'string' && keyword.length >= 2 && keyword.length <= 50 &&
                                                                        !keyword.includes('http') &&
                                                                        !keyword.match(/^(제\d+호|제\d+조|제\d+항|검색|더보기|전체보기|복지로|bokjiro)$/i) &&
                                                                        !/^[\d\s\-_]+$/.test(keyword)) {
                                                                        tempKeywords_3.add(keyword.trim());
                                                                        console.log("[BOKJIRO-REALTIME] JSON \uBC30\uC5F4\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        catch (e) {
                                                            // JSON 파싱 실패 무시
                                                        }
                                                    }
                                                }
                                            });
                                            console.log("[BOKJIRO-REALTIME] \uC2A4\uD06C\uB9BD\uD2B8 \uD30C\uC2F1 \uD6C4 \uD0A4\uC6CC\uB4DC \uAC1C\uC218: ".concat(tempKeywords_3.size));
                                        }
                                        if (tempKeywords_3.size > 0) {
                                            console.log("[BOKJIRO-REALTIME] \uCD1D ".concat(tempKeywords_3.size, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                                            Array.from(tempKeywords_3).slice(0, limit).forEach(function (keyword, idx) {
                                                keywords_5.push({
                                                    rank: idx + 1,
                                                    keyword: keyword,
                                                    source: 'bokjiro',
                                                    timestamp: new Date().toISOString()
                                                });
                                            });
                                            if (keywords_5.length >= 5) {
                                                console.log("[BOKJIRO-REALTIME] \u2705 \uC218\uC9D1 \uC644\uB8CC: ".concat(keywords_5.length, "\uAC1C"));
                                                console.log("[BOKJIRO-REALTIME] \uC0D8\uD50C:", keywords_5.slice(0, 3).map(function (k) { return k.keyword; }));
                                                return [2 /*return*/, { value: keywords_5.slice(0, limit) }];
                                            }
                                        }
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    htmlError_2 = _c.sent();
                                    console.warn("[BOKJIRO-REALTIME] HTML \uD30C\uC2F1 \uC2E4\uD328:", htmlError_2.message);
                                    return [3 /*break*/, 4];
                                case 4:
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 6];
                                    console.log("[BOKJIRO-REALTIME] ".concat(RETRY_DELAY, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 5:
                                    _c.sent();
                                    _c.label = 6;
                                case 6: return [3 /*break*/, 10];
                                case 7:
                                    error_5 = _c.sent();
                                    console.error("[BOKJIRO-REALTIME] \uC2DC\uB3C4 ".concat(attempt, " \uC2E4\uD328:"), error_5.message);
                                    if (!(attempt < MAX_RETRIES)) return [3 /*break*/, 9];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, RETRY_DELAY); })];
                                case 8:
                                    _c.sent();
                                    _c.label = 9;
                                case 9: return [3 /*break*/, 10];
                                case 10: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= MAX_RETRIES)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_9(attempt)];
                case 2:
                    state_6 = _a.sent();
                    if (typeof state_6 === "object")
                        return [2 /*return*/, state_6.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4:
                    console.warn('[BOKJIRO-REALTIME] 모든 재시도 실패, 빈 배열 반환');
                    return [2 /*return*/, []];
            }
        });
    });
}
/**
 * 모든 플랫폼의 실시간 검색어 통합 조회
 */
function getAllRealtimeKeywords() {
    return __awaiter(this, arguments, void 0, function (limitPerPlatform) {
        var _a, zum, google, nate, daum, naver, bokjiro, _b;
        if (limitPerPlatform === void 0) { limitPerPlatform = 20; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Promise.allSettled([
                            getZumRealtimeKeywords(limitPerPlatform).catch(function () { return []; }),
                            getGoogleRealtimeKeywords(limitPerPlatform).catch(function () { return []; }),
                            getNateRealtimeKeywords(limitPerPlatform).catch(function () { return []; }),
                            getDaumRealtimeKeywords(limitPerPlatform).catch(function () { return []; }),
                            getNaverRealtimeKeywords(limitPerPlatform).catch(function () { return []; }),
                            // 복지로는 Puppeteer 버전을 사용하므로 여기서는 빈 배열 반환 (핸들러에서 별도 처리)
                            Promise.resolve([])
                        ])];
                case 1:
                    _a = _c.sent(), zum = _a[0], google = _a[1], nate = _a[2], daum = _a[3], naver = _a[4], bokjiro = _a[5];
                    return [2 /*return*/, {
                            zum: (zum.status === 'fulfilled' ? zum.value : []),
                            google: (google.status === 'fulfilled' ? google.value : []),
                            nate: (nate.status === 'fulfilled' ? nate.value : []),
                            daum: (daum.status === 'fulfilled' ? daum.value : []),
                            naver: (naver.status === 'fulfilled' ? naver.value : []),
                            bokjiro: (bokjiro.status === 'fulfilled' ? bokjiro.value : []),
                            timestamp: new Date().toISOString()
                        }];
                case 2:
                    _b = _c.sent();
                    // 에러가 발생해도 빈 배열 반환 (부분 실패 허용, 로그 제거)
                    return [2 /*return*/, {
                            zum: [],
                            google: [],
                            nate: [],
                            daum: [],
                            naver: [],
                            bokjiro: [],
                            timestamp: new Date().toISOString()
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
