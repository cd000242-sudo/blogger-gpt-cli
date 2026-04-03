"use strict";
/**
 * 복지로 일간 인기 키워드 API 유틸리티
 * Puppeteer를 사용하여 복지로 검색 페이지에서 인기 키워드 크롤링
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
exports.getBokjiroRealtimeKeywordsWithPuppeteer = getBokjiroRealtimeKeywordsWithPuppeteer;
/**
 * Puppeteer를 사용하여 복지로 일간 인기 키워드 크롤링
 */
function getBokjiroRealtimeKeywordsWithPuppeteer() {
    return __awaiter(this, arguments, void 0, function (limit) {
        var browser, puppeteer, page, bokjiroUrl, e_1, keywords, debugInfo, realtimeKeywords, error_1, e_2;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    browser = null;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 16, 17, 22]);
                    console.log('[BOKJIRO-REALTIME] 복지로 일간 인기 키워드 크롤링 시작 (Puppeteer)');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('puppeteer'); })];
                case 2:
                    puppeteer = _a.sent();
                    console.log('[BOKJIRO-REALTIME] 브라우저 실행 중...');
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
                    bokjiroUrl = 'https://www.bokjiro.go.kr/ssis-tbu/twatzzza/intgSearch/moveTWZZ02000M.do';
                    console.log('[BOKJIRO-REALTIME] 페이지 로딩 중:', bokjiroUrl);
                    return [4 /*yield*/, page.goto(bokjiroUrl, {
                            waitUntil: 'domcontentloaded', // networkidle2 대신 domcontentloaded로 변경 (더 빠름)
                            timeout: 20000 // 30초 -> 20초로 단축
                        })];
                case 7:
                    _a.sent();
                    // 페이지 로딩 대기 (5초 -> 2초로 단축)
                    return [4 /*yield*/, page.waitForTimeout(2000)];
                case 8:
                    // 페이지 로딩 대기 (5초 -> 2초로 단축)
                    _a.sent();
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, page.waitForSelector('.rankmenu .keyword', { timeout: 5000 })];
                case 10:
                    _a.sent();
                    console.log('[BOKJIRO-REALTIME] rankmenu.keyword 요소 발견');
                    return [3 /*break*/, 12];
                case 11:
                    e_1 = _a.sent();
                    console.log('[BOKJIRO-REALTIME] rankmenu.keyword 대기 실패 (계속 진행)');
                    return [3 /*break*/, 12];
                case 12:
                    console.log('[BOKJIRO-REALTIME] 페이지 크롤링 중...');
                    return [4 /*yield*/, page.evaluate(function (maxLimit) {
                            var result = [];
                            // 모든 .rankmenu 요소 찾기
                            var rankMenus = document.querySelectorAll('.rankmenu');
                            console.log("[BOKJIRO-REALTIME] rankmenu ".concat(rankMenus.length, "\uAC1C \uBC1C\uACAC"));
                            rankMenus.forEach(function (rankMenu, menuIndex) {
                                if (result.length >= maxLimit)
                                    return;
                                // rankmenu 내의 .keyword 요소 찾기
                                var keywordElements = rankMenu.querySelectorAll('.keyword');
                                console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "]\uC5D0 keyword ").concat(keywordElements.length, "\uAC1C \uBC1C\uACAC"));
                                keywordElements.forEach(function (keywordEl, kwIndex) {
                                    var _a, _b;
                                    if (result.length >= maxLimit)
                                        return;
                                    // 여러 방법으로 텍스트 추출 시도
                                    var keywordText = '';
                                    // 방법 1: .cl-text에서 추출
                                    var clText = keywordEl.querySelector('.cl-text');
                                    if (clText) {
                                        keywordText = ((_a = clText.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || '';
                                        if (keywordText) {
                                            console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] cl-text: \"").concat(keywordText, "\""));
                                        }
                                    }
                                    // 방법 2: 직접 텍스트 노드에서 추출
                                    if (!keywordText || keywordText.length < 2) {
                                        var directText = Array.from(keywordEl.childNodes)
                                            .filter(function (node) { return node.nodeType === Node.TEXT_NODE; })
                                            .map(function (node) { var _a; return (_a = node.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
                                            .join(' ')
                                            .trim();
                                        if (directText && directText.length >= 2) {
                                            keywordText = directText;
                                            console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] \uC9C1\uC811\uD14D\uC2A4\uD2B8: \"").concat(keywordText, "\""));
                                        }
                                    }
                                    // 방법 3: 전체 텍스트에서 추출
                                    if (!keywordText || keywordText.length < 2) {
                                        var fullText = ((_b = keywordEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || '';
                                        if (fullText && fullText.length >= 2) {
                                            keywordText = fullText;
                                            console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] \uC804\uCCB4\uD14D\uC2A4\uD2B8: \"").concat(keywordText, "\""));
                                        }
                                    }
                                    // 방법 4: innerHTML에서 추출 (최후의 수단)
                                    if (!keywordText || keywordText.length < 2) {
                                        var innerHTML = keywordEl.innerHTML;
                                        // HTML 태그 제거
                                        var textFromHTML = innerHTML.replace(/<[^>]*>/g, '').trim();
                                        if (textFromHTML && textFromHTML.length >= 2) {
                                            keywordText = textFromHTML;
                                            console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] innerHTML: \"").concat(keywordText, "\""));
                                        }
                                    }
                                    // 키워드 정제
                                    if (keywordText) {
                                        keywordText = keywordText
                                            .replace(/^\d+\.?\s*/, '')
                                            .replace(/^\d+위\s*/, '')
                                            .replace(/^상승\s*/, '')
                                            .replace(/^하락\s*/, '')
                                            .replace(/^신규\s*/, '')
                                            .replace(/^▶\s*/, '')
                                            .replace(/^▶/, '')
                                            .replace(/\s+/g, ' ')
                                            .trim();
                                    }
                                    // 기본 필터링
                                    if (!keywordText || keywordText.length < 2 || keywordText.length > 30) {
                                        if (keywordText) {
                                            console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] \uAE38\uC774 \uD544\uD130\uB9C1: \"").concat(keywordText, "\" (\uAE38\uC774: ").concat(keywordText.length, ")"));
                                        }
                                        return;
                                    }
                                    // 숫자만 있는 경우 제외
                                    if (/^\d+$/.test(keywordText)) {
                                        console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] \uC22B\uC790\uB9CC: \"").concat(keywordText, "\""));
                                        return;
                                    }
                                    // 한글이 하나라도 있어야 함
                                    if (!/[가-힣]/.test(keywordText)) {
                                        console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] \uD55C\uAE00 \uC5C6\uC74C: \"").concat(keywordText, "\""));
                                        return;
                                    }
                                    // UI 요소 제외
                                    var uiKeywords = ['통합검색', '로그인', '로그아웃', '본문', '공동인증서', '검색어', '순위', '데이터랩'];
                                    if (uiKeywords.includes(keywordText)) {
                                        console.log("[BOKJIRO-REALTIME] rankmenu[".concat(menuIndex, "] keyword[").concat(kwIndex, "] UI \uC694\uC18C: \"").concat(keywordText, "\""));
                                        return;
                                    }
                                    // 중복 체크
                                    var isDuplicate = result.some(function (item) {
                                        return item.keyword.toLowerCase() === keywordText.toLowerCase();
                                    });
                                    if (!isDuplicate) {
                                        // 순위는 결과 배열 길이 + 1
                                        result.push({
                                            keyword: keywordText,
                                            rank: result.length + 1
                                        });
                                        console.log("[BOKJIRO-REALTIME] \u2705 \uD0A4\uC6CC\uB4DC \uBC1C\uACAC (".concat(result.length, "\uC704): \"").concat(keywordText, "\""));
                                    }
                                    else {
                                        console.log("[BOKJIRO-REALTIME] \uC911\uBCF5 \uC81C\uC678: \"".concat(keywordText, "\""));
                                    }
                                });
                            });
                            console.log("[BOKJIRO-REALTIME] \uCD5C\uC885 \uACB0\uACFC: ".concat(result.length, "\uAC1C \uD0A4\uC6CC\uB4DC"));
                            return result;
                        }, limit)];
                case 13:
                    keywords = _a.sent();
                    console.log("[BOKJIRO-REALTIME] ".concat(keywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBC1C\uACAC"));
                    if (!(keywords.length === 0)) return [3 /*break*/, 15];
                    return [4 /*yield*/, page.evaluate(function () {
                            var _a;
                            var rankMenus = document.querySelectorAll('.rankmenu');
                            var firstRankMenu = rankMenus[0];
                            var firstKeyword = firstRankMenu === null || firstRankMenu === void 0 ? void 0 : firstRankMenu.querySelector('.keyword');
                            return {
                                rankmenuCount: rankMenus.length,
                                firstRankMenuExists: !!firstRankMenu,
                                firstKeywordExists: !!firstKeyword,
                                firstKeywordHTML: firstKeyword ? firstKeyword.innerHTML.substring(0, 200) : 'N/A',
                                firstKeywordText: firstKeyword ? firstKeyword.textContent : 'N/A',
                                firstKeywordClText: ((_a = firstKeyword === null || firstKeyword === void 0 ? void 0 : firstKeyword.querySelector('.cl-text')) === null || _a === void 0 ? void 0 : _a.textContent) || 'N/A'
                            };
                        })];
                case 14:
                    debugInfo = _a.sent();
                    console.error('[BOKJIRO-REALTIME] 키워드 추출 실패 - 디버그 정보:', JSON.stringify(debugInfo, null, 2));
                    throw new Error("\uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uBD80\uC871: 0\uAC1C (\uB514\uBC84\uADF8: rankmenu=".concat(debugInfo.rankmenuCount, ", firstKeyword=").concat(debugInfo.firstKeywordExists, ")"));
                case 15:
                    realtimeKeywords = keywords
                        .slice(0, limit)
                        .map(function (item, index) { return ({
                        rank: index + 1,
                        keyword: item.keyword,
                        source: 'bokjiro',
                        timestamp: new Date().toISOString()
                    }); });
                    console.log("[BOKJIRO-REALTIME] \uC77C\uAC04 \uC778\uAE30 \uD0A4\uC6CC\uB4DC ".concat(realtimeKeywords.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC"));
                    // 1개 이상이면 반환
                    if (realtimeKeywords.length > 0) {
                        return [2 /*return*/, realtimeKeywords];
                    }
                    // 0개일 경우에만 에러 발생
                    throw new Error("\uD0A4\uC6CC\uB4DC \uC218\uC9D1 \uBD80\uC871: 0\uAC1C");
                case 16:
                    error_1 = _a.sent();
                    console.error('[BOKJIRO-REALTIME] Puppeteer 크롤링 실패:', error_1.message || error_1);
                    throw error_1;
                case 17:
                    if (!browser) return [3 /*break*/, 21];
                    _a.label = 18;
                case 18:
                    _a.trys.push([18, 20, , 21]);
                    return [4 /*yield*/, browser.close()];
                case 19:
                    _a.sent();
                    console.log('[BOKJIRO-REALTIME] 브라우저 종료 완료');
                    return [3 /*break*/, 21];
                case 20:
                    e_2 = _a.sent();
                    console.warn('[BOKJIRO-REALTIME] 브라우저 종료 오류:', e_2);
                    return [3 /*break*/, 21];
                case 21: return [7 /*endfinally*/];
                case 22: return [2 /*return*/];
            }
        });
    });
}
