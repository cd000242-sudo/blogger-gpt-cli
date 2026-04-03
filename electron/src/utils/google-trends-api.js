"use strict";
/**
 * Google Trends API 유틸리티
 * Puppeteer를 사용하여 실제 Google Trends 페이지를 크롤링
 * 공식 API가 없으므로 웹 크롤링 방식 활용
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleTrendKeywords = getGoogleTrendKeywords;
/**
 * Google CSE를 사용하여 Google Trends 인기 검색어 가져오기 (우선순위 1)
 */
function getGoogleTrendKeywordsWithCSE() {
    return __awaiter(this, void 0, void 0, function () {
        var loadEnvFromFile, env, googleCseKey, googleCseCx, trendingQueries, allKeywords_1, keywordSet_1, _i, _a, query, searchUrl, response, data, cseError_1, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 10, , 11]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../env'); })];
                case 1:
                    loadEnvFromFile = (_b.sent()).loadEnvFromFile;
                    env = loadEnvFromFile();
                    googleCseKey = env['googleCseKey'] || env['GOOGLE_CSE_KEY'] || process.env['GOOGLE_CSE_KEY'];
                    googleCseCx = env['googleCseCx'] || env['GOOGLE_CSE_CX'] || env['googleCseId'] || env['GOOGLE_CSE_ID'] || process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'];
                    if (!googleCseKey || !googleCseCx) {
                        console.log('[GOOGLE-TRENDS] Google CSE 키가 설정되지 않음, Puppeteer로 전환');
                        return [2 /*return*/, null];
                    }
                    console.log('[GOOGLE-TRENDS] Google CSE를 사용하여 트렌드 키워드 검색 시작');
                    trendingQueries = [
                        '인기 검색어',
                        '트렌드 검색어',
                        '실시간 검색어',
                        '오늘의 검색어',
                        '인기 키워드'
                    ];
                    allKeywords_1 = [];
                    keywordSet_1 = new Set();
                    _i = 0, _a = trendingQueries.slice(0, 3);
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 9];
                    query = _a[_i];
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, 7, , 8]);
                    searchUrl = "https://www.googleapis.com/customsearch/v1?key=".concat(googleCseKey, "&cx=").concat(googleCseCx, "&q=").concat(encodeURIComponent(query), "&num=10&lr=lang_ko&cr=countryKR");
                    return [4 /*yield*/, fetch(searchUrl)];
                case 4:
                    response = _b.sent();
                    return [4 /*yield*/, response.json()];
                case 5:
                    data = _b.sent();
                    if (data.items && data.items.length > 0) {
                        data.items.forEach(function (item) {
                            // 제목에서 키워드 추출
                            var title = (item.title || '').replace(/<[^>]*>/g, '').trim();
                            var snippet = (item.snippet || '').replace(/<[^>]*>/g, '').trim();
                            // 제목과 스니펫에서 키워드 추출 (한글 위주, 2-15자)
                            var extractKeywords = function (text) {
                                var keywords = [];
                                // 한글 단어 추출 (2-15자)
                                var koreanMatches = text.match(/[가-힣]{2,15}/g);
                                if (koreanMatches) {
                                    keywords.push.apply(keywords, koreanMatches);
                                }
                                return keywords;
                            };
                            var titleKeywords = extractKeywords(title);
                            var snippetKeywords = extractKeywords(snippet);
                            var combinedKeywords = __spreadArray(__spreadArray([], titleKeywords, true), snippetKeywords, true);
                            combinedKeywords.forEach(function (keyword) {
                                // 유효성 검증
                                if (keyword.length >= 2 &&
                                    keyword.length <= 15 &&
                                    !keyword.includes('검색') &&
                                    !keyword.includes('인기') &&
                                    !keyword.includes('트렌드') &&
                                    !keyword.includes('실시간') &&
                                    !keyword.includes('키워드') &&
                                    !keyword.includes('오늘의') &&
                                    !keywordSet_1.has(keyword)) {
                                    keywordSet_1.add(keyword);
                                    allKeywords_1.push({
                                        rank: allKeywords_1.length + 1,
                                        keyword: keyword,
                                        changeRate: 100 - (allKeywords_1.length * 5),
                                        category: '일반'
                                    });
                                }
                            });
                            if (allKeywords_1.length >= 10)
                                return;
                        });
                    }
                    if (allKeywords_1.length >= 10)
                        return [3 /*break*/, 9];
                    // API 호출 제한 고려
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 200); })];
                case 6:
                    // API 호출 제한 고려
                    _b.sent();
                    return [3 /*break*/, 8];
                case 7:
                    cseError_1 = _b.sent();
                    console.warn("[GOOGLE-TRENDS] CSE \uCFFC\uB9AC \"".concat(query, "\" \uC2E4\uD328:"), cseError_1.message);
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 2];
                case 9:
                    if (allKeywords_1.length > 0) {
                        console.log("[GOOGLE-TRENDS] Google CSE\uC5D0\uC11C ".concat(allKeywords_1.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC131\uACF5"));
                        return [2 /*return*/, allKeywords_1.slice(0, 10)];
                    }
                    return [2 /*return*/, null];
                case 10:
                    error_1 = _b.sent();
                    console.warn('[GOOGLE-TRENDS] Google CSE 실패:', error_1.message);
                    return [2 /*return*/, null];
                case 11: return [2 /*return*/];
            }
        });
    });
}
/**
 * Puppeteer를 사용하여 Google Trends 인기 검색어 크롤링 (Fallback)
 */
function getGoogleTrendKeywords() {
    return __awaiter(this, void 0, void 0, function () {
        var cseKeywords, browser, puppeteer, page, trendsUrl, tableFound, tableSelectors, _i, tableSelectors_1, selector, e_1, keywords, trendKeywords, error_2, rssUrl, response, xmlText, itemMatches, keywords_1, rssError_1, loadEnvFromFile, env, googleCseKey, googleCseCx, popularQueries, allKeywords_2, _a, _b, query, searchUrl, response, data, cseError_2, cseError_3, e_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, getGoogleTrendKeywordsWithCSE()];
                case 1:
                    cseKeywords = _c.sent();
                    if (cseKeywords && cseKeywords.length > 0) {
                        return [2 /*return*/, cseKeywords];
                    }
                    browser = null;
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 18, 38, 43]);
                    console.log('[GOOGLE-TRENDS] Puppeteer로 Google Trends 크롤링 시작');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('puppeteer'); })];
                case 3:
                    puppeteer = _c.sent();
                    console.log('[GOOGLE-TRENDS] 브라우저 실행 중...');
                    return [4 /*yield*/, puppeteer.default.launch({
                            headless: 'new',
                            args: [
                                '--no-sandbox',
                                '--disable-setuid-sandbox',
                                '--disable-blink-features=AutomationControlled',
                                '--disable-dev-shm-usage'
                            ]
                        })];
                case 4:
                    browser = _c.sent();
                    return [4 /*yield*/, browser.newPage()];
                case 5:
                    page = _c.sent();
                    // User-Agent 설정
                    return [4 /*yield*/, page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')];
                case 6:
                    // User-Agent 설정
                    _c.sent();
                    // 언어 설정
                    return [4 /*yield*/, page.setExtraHTTPHeaders({
                            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                        })];
                case 7:
                    // 언어 설정
                    _c.sent();
                    trendsUrl = 'https://trends.google.co.kr/trendingsearches/daily?geo=KR&hl=ko';
                    console.log('[GOOGLE-TRENDS] 페이지 로딩 중 (일일 트렌드):', trendsUrl);
                    return [4 /*yield*/, page.goto(trendsUrl, {
                            waitUntil: 'networkidle2',
                            timeout: 60000
                        })];
                case 8:
                    _c.sent();
                    // 페이지 로딩 대기 (JavaScript 렌더링 완료까지 - 더 긴 대기)
                    return [4 /*yield*/, page.waitForTimeout(8000)];
                case 9:
                    // 페이지 로딩 대기 (JavaScript 렌더링 완료까지 - 더 긴 대기)
                    _c.sent();
                    tableFound = false;
                    tableSelectors = [
                        'tbody[jsname="cC57zf"]',
                        'tbody',
                        '.mZ3RIc',
                        'table',
                        '[jsname="cC57zf"]'
                    ];
                    _i = 0, tableSelectors_1 = tableSelectors;
                    _c.label = 10;
                case 10:
                    if (!(_i < tableSelectors_1.length)) return [3 /*break*/, 15];
                    selector = tableSelectors_1[_i];
                    _c.label = 11;
                case 11:
                    _c.trys.push([11, 13, , 14]);
                    return [4 /*yield*/, page.waitForSelector(selector, { timeout: 5000 })];
                case 12:
                    _c.sent();
                    console.log("[GOOGLE-TRENDS] \uC120\uD0DD\uC790 \"".concat(selector, "\" \uB85C\uB4DC \uC644\uB8CC"));
                    tableFound = true;
                    return [3 /*break*/, 15];
                case 13:
                    e_1 = _c.sent();
                    console.log("[GOOGLE-TRENDS] \uC120\uD0DD\uC790 \"".concat(selector, "\" \uB85C\uB4DC \uB300\uAE30 \uC2E4\uD328"));
                    return [3 /*break*/, 14];
                case 14:
                    _i++;
                    return [3 /*break*/, 10];
                case 15:
                    if (!tableFound) {
                        console.log('[GOOGLE-TRENDS] 테이블을 찾지 못했지만 계속 진행...');
                    }
                    // 추가 대기 시간 (동적 콘텐츠 로딩)
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 16:
                    // 추가 대기 시간 (동적 콘텐츠 로딩)
                    _c.sent();
                    console.log('[GOOGLE-TRENDS] 페이지 크롤링 중...');
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a, _b, _c, _d;
                            var result = [];
                            console.log('[GOOGLE-TRENDS] 페이지 구조 분석 시작...');
                            // 우선순위 1: tbody[jsname="cC57zf"] 내의 tr[data-row-id]에서 .mZ3RIc 추출
                            var tableBody = document.querySelector('tbody[jsname="cC57zf"]');
                            if (tableBody) {
                                console.log('[GOOGLE-TRENDS] 테이블 tbody 발견');
                                var rows = tableBody.querySelectorAll('tr[data-row-id]');
                                console.log("[GOOGLE-TRENDS] \uD589 ".concat(rows.length, "\uAC1C \uBC1C\uACAC"));
                                var _loop_1 = function (i) {
                                    var row = rows[i];
                                    if (!row)
                                        return "continue";
                                    // 여러 방법으로 키워드 추출 시도
                                    var keyword = '';
                                    // 방법 1: .mZ3RIc 클래스
                                    var keywordEl = row.querySelector('.mZ3RIc');
                                    if (keywordEl) {
                                        keyword = ((_a = keywordEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                    }
                                    // 방법 2: data-term 속성
                                    if (!keyword || keyword.length < 2) {
                                        keyword = row.getAttribute('data-term') || '';
                                    }
                                    // 방법 3: 행 내의 모든 텍스트에서 첫 번째 의미있는 텍스트 추출
                                    if (!keyword || keyword.length < 2) {
                                        var allTexts = row.querySelectorAll('div, span, a');
                                        for (var _f = 0, _g = Array.from(allTexts); _f < _g.length; _f++) {
                                            var textEl = _g[_f];
                                            var text = ((_b = textEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '';
                                            if (text && text.length >= 2 && text.length <= 30 && /[가-힣]/.test(text)) {
                                                keyword = text;
                                                break;
                                            }
                                        }
                                    }
                                    // 기본적인 검증만 (필터링 최소화 - 일일 트렌드 그대로 가져오기)
                                    if (keyword &&
                                        keyword.length >= 2 &&
                                        keyword.length <= 30 &&
                                        !keyword.includes('http') &&
                                        !keyword.includes('google') &&
                                        !keyword.includes('trends') &&
                                        !keyword.includes('검색') &&
                                        !keyword.includes('탐색') &&
                                        !/^[\d\s\-_]+$/.test(keyword)) {
                                        // 중복 체크
                                        var isDuplicate = result.some(function (item) {
                                            return item.keyword.toLowerCase() === keyword.toLowerCase();
                                        });
                                        if (!isDuplicate) {
                                            result.push({
                                                keyword: keyword,
                                                rank: result.length + 1
                                            });
                                            console.log("[GOOGLE-TRENDS] \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(result.length, "\uBC88\uC9F8): ").concat(keyword));
                                        }
                                    }
                                };
                                for (var i = 0; i < rows.length && result.length < 10; i++) {
                                    _loop_1(i);
                                }
                            }
                            else {
                                console.log('[GOOGLE-TRENDS] tbody[jsname="cC57zf"]를 찾지 못함');
                            }
                            // 우선순위 2: .mZ3RIc 클래스 직접 검색 (방법 1이 실패한 경우)
                            if (result.length < 10) {
                                var keywordElements = document.querySelectorAll('.mZ3RIc');
                                console.log("[GOOGLE-TRENDS] .mZ3RIc \uC694\uC18C ".concat(keywordElements.length, "\uAC1C \uBC1C\uACAC"));
                                var _loop_2 = function (i) {
                                    var el = keywordElements[i];
                                    if (!el)
                                        return "continue";
                                    var keyword = ((_c = el.textContent) === null || _c === void 0 ? void 0 : _c.trim()) || '';
                                    if (keyword &&
                                        keyword.length >= 2 &&
                                        keyword.length <= 30 &&
                                        !keyword.includes('http') &&
                                        !keyword.includes('google') &&
                                        !keyword.includes('trends') &&
                                        !keyword.includes('검색') &&
                                        !keyword.includes('탐색') &&
                                        !/^[\d\s\-_]+$/.test(keyword)) {
                                        var isDuplicate = result.some(function (item) {
                                            return item.keyword.toLowerCase() === keyword.toLowerCase();
                                        });
                                        if (!isDuplicate) {
                                            result.push({
                                                keyword: keyword,
                                                rank: result.length + 1
                                            });
                                            console.log("[GOOGLE-TRENDS] .mZ3RIc\uC5D0\uC11C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(keyword));
                                        }
                                    }
                                };
                                for (var i = 0; i < keywordElements.length && result.length < 10; i++) {
                                    _loop_2(i);
                                }
                            }
                            // 우선순위 3: 모든 테이블 행에서 키워드 추출 시도
                            if (result.length < 10) {
                                var allRows = document.querySelectorAll('tr[data-row-id]');
                                console.log("[GOOGLE-TRENDS] \uBAA8\uB4E0 data-row-id \uD589 ".concat(allRows.length, "\uAC1C \uBC1C\uACAC"));
                                for (var i = 0; i < allRows.length && result.length < 10; i++) {
                                    var row = allRows[i];
                                    if (!row)
                                        continue;
                                    // 행 내의 모든 div, span에서 텍스트 추출
                                    var textElements = row.querySelectorAll('div, span');
                                    var _loop_3 = function (textEl) {
                                        if (result.length >= 10)
                                            return "break";
                                        var text = ((_d = textEl.textContent) === null || _d === void 0 ? void 0 : _d.trim()) || '';
                                        if (text &&
                                            text.length >= 2 &&
                                            text.length <= 30 &&
                                            /[가-힣]/.test(text) &&
                                            !text.includes('http') &&
                                            !text.includes('google') &&
                                            !text.includes('trends') &&
                                            !text.includes('검색') &&
                                            !text.includes('탐색') &&
                                            !/^[\d\s\-_]+$/.test(text)) {
                                            var isDuplicate = result.some(function (item) {
                                                return item.keyword.toLowerCase() === text.toLowerCase();
                                            });
                                            if (!isDuplicate) {
                                                result.push({
                                                    keyword: text,
                                                    rank: result.length + 1
                                                });
                                                console.log("[GOOGLE-TRENDS] \uB300\uCCB4 \uBC29\uBC95\uC73C\uB85C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC: ".concat(text));
                                                return "break";
                                            }
                                        }
                                    };
                                    for (var _i = 0, _e = Array.from(textElements); _i < _e.length; _i++) {
                                        var textEl = _e[_i];
                                        var state_1 = _loop_3(textEl);
                                        if (state_1 === "break")
                                            break;
                                    }
                                }
                            }
                            console.log("[GOOGLE-TRENDS] \uCD1D ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC644\uB8CC"));
                            return result;
                        })];
                case 17:
                    keywords = _c.sent();
                    console.log("[GOOGLE-TRENDS] ".concat(keywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                    trendKeywords = keywords
                        .slice(0, 10) // 최대 10개
                        .map(function (item, index) {
                        // 키워드 정제
                        var cleanKeyword = item.keyword
                            .replace(/^\d+\.\s*/, '') // 순위 번호 제거
                            .replace(/\s*-\s*Google\s*Trends.*/i, '') // "- Google Trends" 제거
                            .replace(/\s*\(.*?\)/g, '') // 괄호 내용 제거
                            .replace(/\s*\[.*?\]/g, '') // 대괄호 내용 제거
                            .replace(/\s+/g, ' ') // 공백 정리
                            .trim();
                        // 추가 필터링: "search", "탐색" 등 불필요한 단어 제거
                        if (cleanKeyword.toLowerCase().includes('search') ||
                            cleanKeyword.includes('탐색') ||
                            cleanKeyword.toLowerCase() === 'search' ||
                            cleanKeyword === '탐색' ||
                            cleanKeyword.toLowerCase().includes('search탐색')) {
                            return null;
                        }
                        // 키워드가 비어있거나 너무 짧으면 스킵
                        if (!cleanKeyword || cleanKeyword.length < 2) {
                            return null;
                        }
                        // 너무 긴 키워드는 자르기 (50자 제한)
                        if (cleanKeyword.length > 50) {
                            cleanKeyword = cleanKeyword.substring(0, 50).trim();
                            var lastSpace = cleanKeyword.lastIndexOf(' ');
                            if (lastSpace > 0) {
                                cleanKeyword = cleanKeyword.substring(0, lastSpace);
                            }
                        }
                        return {
                            rank: index + 1,
                            keyword: cleanKeyword,
                            changeRate: 100 - (index * 5), // 순위 기반 변화율 추정
                            category: '일반'
                        };
                    })
                        .filter(function (item) { return item !== null; });
                    console.log("[GOOGLE-TRENDS] \uD2B8\uB80C\uB4DC \uD0A4\uC6CC\uB4DC ".concat(trendKeywords.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC"));
                    if (trendKeywords.length > 0) {
                        return [2 /*return*/, trendKeywords];
                    }
                    // 크롤링 실패 시 RSS 피드 시도
                    console.log('[GOOGLE-TRENDS] 크롤링 결과 없음, RSS 피드 시도...');
                    throw new Error('크롤링 결과 없음, RSS 피드로 전환');
                case 18:
                    error_2 = _c.sent();
                    console.warn('[GOOGLE-TRENDS] 크롤링 실패:', error_2.message || error_2);
                    // Puppeteer 관련 에러 처리
                    if (error_2.message && (error_2.message.includes('puppeteer') || error_2.message.includes('browser'))) {
                        console.warn('[GOOGLE-TRENDS] Puppeteer 초기화 실패, RSS 피드로 전환');
                    }
                    // Fallback 1: RSS 피드 시도
                    console.log('[GOOGLE-TRENDS] RSS 피드로 전환 시도...');
                    _c.label = 19;
                case 19:
                    _c.trys.push([19, 23, , 24]);
                    rssUrl = 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR';
                    return [4 /*yield*/, fetch(rssUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
                            }
                        })];
                case 20:
                    response = _c.sent();
                    if (!response.ok) return [3 /*break*/, 22];
                    return [4 /*yield*/, response.text()];
                case 21:
                    xmlText = _c.sent();
                    itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
                    keywords_1 = [];
                    itemMatches.forEach(function (item, index) {
                        var titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
                        var keyword = ((titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[1]) || (titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[2]) || '').trim();
                        if (keyword && keyword !== 'Google Trends') {
                            keywords_1.push({
                                rank: index + 1,
                                keyword: keyword,
                                changeRate: 100 - (index * 5),
                                category: '일반'
                            });
                        }
                    });
                    if (keywords_1.length > 0) {
                        console.log("[GOOGLE-TRENDS] RSS \uD53C\uB4DC\uC5D0\uC11C ".concat(keywords_1.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC131\uACF5"));
                        return [2 /*return*/, keywords_1.slice(0, 10)];
                    }
                    _c.label = 22;
                case 22: return [3 /*break*/, 24];
                case 23:
                    rssError_1 = _c.sent();
                    console.warn('[GOOGLE-TRENDS] RSS 피드도 실패:', rssError_1);
                    return [3 /*break*/, 24];
                case 24:
                    // Fallback 2: Google CSE 사용 (환경 변수에서 키 로드)
                    console.log('[GOOGLE-TRENDS] Google CSE로 전환 시도...');
                    _c.label = 25;
                case 25:
                    _c.trys.push([25, 36, , 37]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../env'); })];
                case 26:
                    loadEnvFromFile = (_c.sent()).loadEnvFromFile;
                    env = loadEnvFromFile();
                    googleCseKey = env['googleCseKey'] || env['GOOGLE_CSE_KEY'];
                    googleCseCx = env['googleCseCx'] || env['GOOGLE_CSE_CX'];
                    if (!(googleCseKey && googleCseCx)) return [3 /*break*/, 34];
                    console.log('[GOOGLE-TRENDS] Google CSE 키 확인됨, 인기 키워드 검색 시도...');
                    popularQueries = [
                        '인기 검색어',
                        '트렌드 키워드',
                        '실시간 검색어',
                        '인기 블로그 주제',
                        '최신 트렌드'
                    ];
                    allKeywords_2 = [];
                    _a = 0, _b = popularQueries.slice(0, 2);
                    _c.label = 27;
                case 27:
                    if (!(_a < _b.length)) return [3 /*break*/, 33];
                    query = _b[_a];
                    _c.label = 28;
                case 28:
                    _c.trys.push([28, 31, , 32]);
                    searchUrl = "https://www.googleapis.com/customsearch/v1?key=".concat(googleCseKey, "&cx=").concat(googleCseCx, "&q=").concat(encodeURIComponent(query), "&num=10&lr=lang_ko&cr=countryKR");
                    return [4 /*yield*/, fetch(searchUrl)];
                case 29:
                    response = _c.sent();
                    return [4 /*yield*/, response.json()];
                case 30:
                    data = _c.sent();
                    if (data.items && data.items.length > 0) {
                        data.items.forEach(function (item) {
                            // 제목에서 키워드 추출
                            var title = item.title || '';
                            // 제목에서 키워드 추출 (간단한 추출)
                            var extractedKeywords = title
                                .split(/[\s,\-\.]+/)
                                .filter(function (word) { return word.length > 1 && word.length < 20; });
                            extractedKeywords.forEach(function (keyword) {
                                if (!allKeywords_2.some(function (k) { return k.keyword === keyword; }) && keyword.length > 1) {
                                    allKeywords_2.push({
                                        rank: allKeywords_2.length + 1,
                                        keyword: keyword,
                                        changeRate: 100 - (allKeywords_2.length * 5),
                                        category: '일반'
                                    });
                                }
                            });
                            if (allKeywords_2.length >= 10)
                                return;
                        });
                    }
                    if (allKeywords_2.length >= 10)
                        return [3 /*break*/, 33];
                    return [3 /*break*/, 32];
                case 31:
                    cseError_2 = _c.sent();
                    console.warn("[GOOGLE-TRENDS] CSE \uCFFC\uB9AC \"".concat(query, "\" \uC2E4\uD328:"), cseError_2);
                    return [3 /*break*/, 32];
                case 32:
                    _a++;
                    return [3 /*break*/, 27];
                case 33:
                    if (allKeywords_2.length > 0) {
                        console.log("[GOOGLE-TRENDS] Google CSE\uC5D0\uC11C ".concat(allKeywords_2.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uCD94\uCD9C \uC131\uACF5"));
                        return [2 /*return*/, allKeywords_2.slice(0, 10)];
                    }
                    return [3 /*break*/, 35];
                case 34:
                    console.warn('[GOOGLE-TRENDS] Google CSE 키가 설정되지 않았습니다.');
                    _c.label = 35;
                case 35: return [3 /*break*/, 37];
                case 36:
                    cseError_3 = _c.sent();
                    console.warn('[GOOGLE-TRENDS] Google CSE 실패:', cseError_3);
                    return [3 /*break*/, 37];
                case 37:
                    // 모든 방법 실패 시 한국 인기 검색어 반환
                    console.log('[GOOGLE-TRENDS] 모든 방법 실패, 한국 인기 검색어 반환');
                    return [2 /*return*/, [
                            { rank: 1, keyword: '블로그 수익화', changeRate: 120, category: '비즈니스' },
                            { rank: 2, keyword: 'AI 글쓰기 도구', changeRate: 110, category: '기술' },
                            { rank: 3, keyword: '온라인 수입', changeRate: 95, category: '비즈니스' },
                            { rank: 4, keyword: '부업 추천', changeRate: 88, category: '경제' },
                            { rank: 5, keyword: '디지털 노마드', changeRate: 75, category: '라이프스타일' },
                            { rank: 6, keyword: '유튜브 수익', changeRate: 65, category: '미디어' },
                            { rank: 7, keyword: '사이드 프로젝트', changeRate: 55, category: '비즈니스' },
                            { rank: 8, keyword: '온라인 강의', changeRate: 45, category: '교육' },
                            { rank: 9, keyword: '프리랜서', changeRate: 35, category: '직업' },
                            { rank: 10, keyword: '자동화 도구', changeRate: 25, category: '기술' },
                        ]];
                case 38:
                    if (!browser) return [3 /*break*/, 42];
                    _c.label = 39;
                case 39:
                    _c.trys.push([39, 41, , 42]);
                    return [4 /*yield*/, browser.close()];
                case 40:
                    _c.sent();
                    console.log('[GOOGLE-TRENDS] 브라우저 종료 완료');
                    return [3 /*break*/, 42];
                case 41:
                    e_2 = _c.sent();
                    console.warn('[GOOGLE-TRENDS] 브라우저 종료 오류:', e_2);
                    return [3 /*break*/, 42];
                case 42: return [7 /*endfinally*/];
                case 43: return [2 /*return*/];
            }
        });
    });
}
