"use strict";
/**
 * ZUM 실시간 검색어 API 유틸리티
 * Puppeteer를 사용하여 실제 ZUM 메인 페이지를 크롤링
 */
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
exports.getZumRealtimeKeywordsWithPuppeteer = getZumRealtimeKeywordsWithPuppeteer;
/**
 * Puppeteer를 사용하여 ZUM 실시간 검색어 크롤링
 */
function getZumRealtimeKeywordsWithPuppeteer() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var browser, puppeteer, page, zumUrl, keywords, realtimeKeywords, error_1, e_1;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    browser = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, 11, 16]);
                    console.log('[ZUM-REALTIME] ZUM 실시간 검색어 크롤링 시작 (Puppeteer)');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('puppeteer'); })];
                case 2:
                    puppeteer = _a.sent();
                    console.log('[ZUM-REALTIME] 브라우저 실행 중...');
                    return [4 /*yield*/, puppeteer.default.launch({
                            headless: 'new',
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-blink-features=AutomationControlled',
                                '--disable-dev-shm-usage'
                            ]
                        })];
                case 3:
                    browser = _a.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 4:
                    page = _a.sent();
                    // User-Agent 설정
                    return [4 /*yield*/, page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')];
                case 5:
                    // User-Agent 설정
                    _a.sent();
                    // 언어 설정
                    return [4 /*yield*/, page.setExtraHTTPHeaders({
                            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                        })];
                case 6:
                    // 언어 설정
                    _a.sent();
                    zumUrl = 'https://www.zum.com/';
                    console.log('[ZUM-REALTIME] 페이지 로딩 중:', zumUrl);
                    return [4 /*yield*/, page.goto(zumUrl, {
                            waitUntil: 'domcontentloaded', // networkidle2 대신 domcontentloaded로 변경 (더 빠름)
                            timeout: 20000 // 30초 -> 20초로 단축
                        })];
                case 7:
                    _a.sent();
                    // 페이지 로딩 대기 (3초 -> 2초로 단축)
                    return [4 /*yield*/, page.waitForTimeout(2000)];
                case 8:
                    // 페이지 로딩 대기 (3초 -> 2초로 단축)
                    _a.sent();
                    console.log('[ZUM-REALTIME] 페이지 크롤링 중...');
                    return [4 /*yield*/, page.evaluate(function (maxLimit) {
                            var result = [];
                            // 제외할 텍스트 패턴
                            var excludePatterns = [
                                /^더보기$/i,
                                /^전체보기$/i,
                                /^검색$/i,
                                /^ZUM$/i,
                                /^로그인$/i,
                                /^회원가입$/i,
                                /^메일$/i,
                                /^카페$/i,
                                /^블로그$/i,
                                /^뉴스$/i,
                                /^지도$/i,
                                /^쇼핑$/i,
                                /^영화$/i,
                                /^웹툰$/i,
                                /^실시간$/i,
                                /^인기$/i,
                                /^이슈$/i,
                            ];
                            // 실시간 검색어 선택자들 (우선순위 순)
                            var selectors = [
                                // 실시간 검색어 전용 섹션
                                '.realtime_keyword li a',
                                '.realtime_keyword .keyword_item',
                                '.realtime_keyword .keyword',
                                '.realtime_keyword a',
                                '.realtime_keyword span',
                                // 이슈/트렌드 섹션
                                '.issue_keyword li a',
                                '.issue_keyword .keyword_item',
                                '.issue_keyword a',
                                '.trending_keyword li a',
                                '.trending_keyword a',
                                // 순위/랭킹 섹션
                                '.rank_list li a',
                                '.rank_list .keyword',
                                '.keyword_list li a',
                                '.keyword_list .keyword',
                                // ZUM 실시간 검색어 특정 클래스들
                                '.list_hotissue li a',
                                '.list_hotissue .keyword',
                                '.list_issue li a',
                                '.list_issue .keyword',
                                '.rank_cont li a',
                                '.rank_cont .keyword',
                                // 데이터 속성 사용
                                '[data-keyword]',
                                '[data-query]',
                                // 일반적인 선택자들
                                'ol[class*="rank"] li a',
                                'ul[class*="rank"] li a',
                                'ol[class*="keyword"] li a',
                                'ul[class*="keyword"] li a',
                                'ol[class*="issue"] li a',
                                'ul[class*="issue"] li a',
                                'ol[class*="realtime"] li a',
                                'ul[class*="realtime"] li a',
                                // 검색 링크
                                'a[href*="/search?q="]',
                                'a[href*="/search?query="]',
                                'a[href*="/search?keyword="]',
                            ];
                            for (var _i = 0, selectors_1 = selectors; _i < selectors_1.length; _i++) {
                                var selector = selectors_1[_i];
                                if (result.length >= maxLimit)
                                    break;
                                var elements = document.querySelectorAll(selector);
                                if (elements.length === 0)
                                    continue;
                                console.log("[ZUM-REALTIME] \uC120\uD0DD\uC790 \"".concat(selector, "\": ").concat(elements.length, "\uAC1C \uBC1C\uACAC"));
                                elements.forEach(function (el) {
                                    var _a;
                                    if (result.length >= maxLimit)
                                        return;
                                    var keyword = '';
                                    // 우선순위 1: data-keyword 속성
                                    var dataKeyword = el.getAttribute('data-keyword');
                                    if (dataKeyword) {
                                        keyword = dataKeyword.trim();
                                    }
                                    if (!keyword) {
                                        var dataQuery = el.getAttribute('data-query');
                                        if (dataQuery) {
                                            keyword = dataQuery.trim();
                                        }
                                    }
                                    // 우선순위 2: href에서 키워드 추출
                                    if (!keyword && el.tagName === 'A') {
                                        var href = el.href || '';
                                        if (href) {
                                            var hrefMatch = href.match(/[?&](?:q|query|keyword)=([^&]+)/);
                                            if (hrefMatch && hrefMatch[1]) {
                                                try {
                                                    keyword = decodeURIComponent(hrefMatch[1]).trim();
                                                }
                                                catch (e) {
                                                    // 디코딩 실패 무시
                                                }
                                            }
                                        }
                                    }
                                    // 우선순위 3: 텍스트 내용
                                    if (!keyword || keyword.length < 2) {
                                        keyword = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                    }
                                    // 키워드 정제 (순위 번호, 공백, 특수문자 제거)
                                    keyword = keyword
                                        .replace(/^\d+\.?\s*/, '')
                                        .replace(/^\d+위\s*/, '')
                                        .replace(/^▶\s*/, '')
                                        .replace(/^▶/, '')
                                        .replace(/\s+/g, ' ')
                                        .trim();
                                    // 제외 패턴 체크
                                    var shouldExclude = excludePatterns.some(function (pattern) { return pattern.test(keyword); });
                                    // 유효한 키워드 검증
                                    if (keyword &&
                                        keyword.length >= 2 &&
                                        keyword.length < 50 &&
                                        !keyword.includes('http') &&
                                        !keyword.includes('://') &&
                                        !shouldExclude &&
                                        !/^[\d\s\-_]+$/.test(keyword) &&
                                        !keyword.match(/^[a-zA-Z\s]+$/)) {
                                        // 중복 체크
                                        var isDuplicate = result.some(function (item) {
                                            return item.keyword.toLowerCase() === keyword.toLowerCase();
                                        });
                                        if (!isDuplicate) {
                                            result.push({
                                                keyword: keyword,
                                                rank: result.length + 1
                                            });
                                        }
                                    }
                                });
                                if (result.length >= maxLimit)
                                    break;
                            }
                            // 방법 2: 스크립트 태그에서 JSON 데이터 추출
                            if (result.length < maxLimit) {
                                var scripts = document.querySelectorAll('script');
                                scripts.forEach(function (script) {
                                    if (result.length >= maxLimit)
                                        return;
                                    var scriptContent = script.textContent || script.innerHTML || '';
                                    if (scriptContent.length < 100)
                                        return;
                                    // 실시간 검색어 관련 JSON 패턴 검색
                                    var patterns = [
                                        /realtimeKeywords?\s*[:=]\s*(\[.*?\])/,
                                        /searchKeywords?\s*[:=]\s*(\[.*?\])/,
                                        /hotKeywords?\s*[:=]\s*(\[.*?\])/,
                                        /trendingKeywords?\s*[:=]\s*(\[.*?\])/,
                                        /"keyword"\s*:\s*"([^"]+)"/g,
                                        /"query"\s*:\s*"([^"]+)"/g,
                                        /"word"\s*:\s*"([^"]+)"/g,
                                        /"text"\s*:\s*"([^"]+)"/g,
                                        /"title"\s*:\s*"([^"]+)"/g,
                                    ];
                                    for (var _i = 0, patterns_1 = patterns; _i < patterns_1.length; _i++) {
                                        var pattern = patterns_1[_i];
                                        if (result.length >= maxLimit)
                                            break;
                                        if (pattern.global) {
                                            var match = void 0;
                                            var _loop_1 = function () {
                                                var keyword = (match[1] || '').trim();
                                                if (keyword &&
                                                    keyword.length >= 2 &&
                                                    keyword.length < 50 &&
                                                    !keyword.includes('http') &&
                                                    !keyword.includes('더보기') &&
                                                    !keyword.includes('전체보기') &&
                                                    !excludePatterns.some(function (p) { return p.test(keyword); })) {
                                                    var isDuplicate = result.some(function (item) {
                                                        return item.keyword.toLowerCase() === keyword.toLowerCase();
                                                    });
                                                    if (!isDuplicate) {
                                                        result.push({
                                                            keyword: keyword,
                                                            rank: result.length + 1
                                                        });
                                                    }
                                                }
                                            };
                                            while ((match = pattern.exec(scriptContent)) !== null && result.length < maxLimit * 2) {
                                                _loop_1();
                                            }
                                        }
                                        else {
                                            var match = scriptContent.match(pattern);
                                            if (match && match[1]) {
                                                try {
                                                    var data = JSON.parse(match[1]);
                                                    var keywordList = Array.isArray(data) ? data : (data.keywords || data.items || data.list || []);
                                                    if (Array.isArray(keywordList)) {
                                                        keywordList.forEach(function (item) {
                                                            if (result.length >= maxLimit)
                                                                return;
                                                            var keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.query || item.word || '');
                                                            if (keyword && typeof keyword === 'string' && keyword.trim().length >= 2 && keyword.trim().length < 50 &&
                                                                !keyword.includes('http') && !keyword.includes('더보기') && !keyword.includes('전체보기') &&
                                                                !excludePatterns.some(function (p) { return p.test(keyword); })) {
                                                                var isDuplicate = result.some(function (item) {
                                                                    return item.keyword.toLowerCase() === keyword.trim().toLowerCase();
                                                                });
                                                                if (!isDuplicate) {
                                                                    result.push({
                                                                        keyword: keyword.trim(),
                                                                        rank: result.length + 1
                                                                    });
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                catch (e) {
                                                    // 파싱 실패 무시
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                            return result;
                        }, limit)];
                case 9:
                    keywords = _a.sent();
                    console.log("[ZUM-REALTIME] ".concat(keywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                    realtimeKeywords = keywords
                        .slice(0, limit)
                        .map(function (item, index) { return ({
                        rank: index + 1,
                        keyword: item.keyword,
                        source: 'zum',
                        timestamp: new Date().toISOString()
                    }); });
                    console.log("[ZUM-REALTIME] \uC2E4\uC2DC\uAC04 \uAC80\uC0C9\uC5B4 ".concat(realtimeKeywords.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC"));
                    if (realtimeKeywords.length >= 5) {
                        return [2 /*return*/, realtimeKeywords];
                    }
                    throw new Error("\uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uBD80\uC871 (".concat(realtimeKeywords.length, "\uAC1C)"));
                case 10:
                    error_1 = _a.sent();
                    console.error('[ZUM-REALTIME] Puppeteer 크롤링 실패:', error_1.message || error_1);
                    throw error_1;
                case 11:
                    if (!browser) return [3 /*break*/, 15];
                    _a.label = 12;
                case 12:
                    _a.trys.push([12, 14, , 15]);
                    return [4 /*yield*/, browser.close()];
                case 13:
                    _a.sent();
                    console.log('[ZUM-REALTIME] 브라우저 종료 완료');
                    return [3 /*break*/, 15];
                case 14:
                    e_1 = _a.sent();
                    console.warn('[ZUM-REALTIME] 브라우저 종료 오류:', e_1);
                    return [3 /*break*/, 15];
                case 15: return [7 /*endfinally*/];
                case 16: return [2 /*return*/];
            }
        });
    });
}
