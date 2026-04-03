"use strict";
/**
 * 네이버 크롤링 우회 시스템
 * - User-Agent 로테이션
 * - 딜레이 및 Rate Limiting
 * - 헤더 위장
 * - 프록시 지원 (선택사항)
 * - 네이버 검색 API 지원
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.crawlNaverSearch = crawlNaverSearch;
exports.crawlNaverBlogPost = crawlNaverBlogPost;
exports.crawlNaverImages = crawlNaverImages;
exports.crawlNaverNews = crawlNaverNews;
exports.searchNaverWithApi = searchNaverWithApi;
exports.searchNaverBlogWithApi = searchNaverBlogWithApi;
exports.searchNaverNewsWithApi = searchNaverNewsWithApi;
exports.searchNaverWebWithApi = searchNaverWebWithApi;
// 실제 브라우저처럼 보이는 User-Agent 리스트
var USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];
// 랜덤 User-Agent 선택
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0];
}
// 딜레이 함수
function delay(ms) {
    return new Promise(function (resolve) { return setTimeout(resolve, ms); });
}
// 네이버 검색 결과 크롤링
function crawlNaverSearch(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var _a, timeout, _b, retries, _c, delayMs, searchUrl, attempt, headers, response, html, results, error_1;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.timeout, timeout = _a === void 0 ? 15000 : _a, _b = options.retries, retries = _b === void 0 ? 3 : _b, _c = options.delayMs, delayMs = _c === void 0 ? 3000 : _c;
                    searchUrl = "https://search.naver.com/search.naver?where=post&query=".concat(encodeURIComponent(query), "&sm=tab_jum");
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 13];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 8, , 12]);
                    console.log("[NAVER] \uAC80\uC0C9 \uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ": \"").concat(query, "\""));
                    headers = {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept-Encoding': 'gzip, deflate, br',
                        'Connection': 'keep-alive',
                        'Upgrade-Insecure-Requests': '1',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-User': '?1',
                        'Cache-Control': 'max-age=0',
                        'Referer': 'https://www.naver.com/',
                        'DNT': '1',
                        'Sec-GPC': '1'
                    };
                    // 더 긴 타임아웃과 재시도 간격
                    return [4 /*yield*/, delay(delayMs * attempt)];
                case 3:
                    // 더 긴 타임아웃과 재시도 간격
                    _d.sent(); // 재시도할 때마다 더 오래 기다림
                    return [4 /*yield*/, fetch(searchUrl, {
                            method: 'GET',
                            headers: headers,
                            // @ts-ignore - Node.js 환경에서 signal 사용
                            signal: AbortSignal.timeout(timeout)
                        })];
                case 4:
                    response = _d.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 5:
                    html = _d.sent();
                    // HTML이 너무 짧으면 차단된 것으로 간주
                    if (html.length < 1000) {
                        throw new Error('응답이 너무 짧습니다 (차단 가능성)');
                    }
                    results = parseNaverSearchResults(html);
                    if (results.length > 0) {
                        console.log("[NAVER] \u2705 ".concat(results.length, "\uAC1C\uC758 \uAC80\uC0C9 \uACB0\uACFC \uC218\uC9D1 \uC131\uACF5"));
                        return [2 /*return*/, results];
                    }
                    console.log("[NAVER] \u26A0\uFE0F \uAC80\uC0C9 \uACB0\uACFC \uC5C6\uC74C (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ")"));
                    if (!(attempt < retries)) return [3 /*break*/, 7];
                    return [4 /*yield*/, delay(delayMs)];
                case 6:
                    _d.sent();
                    _d.label = 7;
                case 7: return [3 /*break*/, 12];
                case 8:
                    error_1 = _d.sent();
                    console.error("[NAVER] \u274C \uD06C\uB864\uB9C1 \uC2E4\uD328 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, "): ").concat(error_1.message));
                    if (!(attempt < retries)) return [3 /*break*/, 10];
                    return [4 /*yield*/, delay(delayMs * attempt)];
                case 9:
                    _d.sent(); // 지수 백오프
                    return [3 /*break*/, 11];
                case 10: throw new Error("\uB124\uC774\uBC84 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(error_1.message));
                case 11: return [3 /*break*/, 12];
                case 12:
                    attempt++;
                    return [3 /*break*/, 1];
                case 13: return [2 /*return*/, []];
            }
        });
    });
}
// 네이버 블로그 글 크롤링
function crawlNaverBlogPost(blogUrl_1) {
    return __awaiter(this, arguments, void 0, function (blogUrl, options) {
        var _a, timeout, _b, retries, _c, delayMs, attempt, headers, response, html, content, error_2;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.timeout, timeout = _a === void 0 ? 10000 : _a, _b = options.retries, retries = _b === void 0 ? 3 : _b, _c = options.delayMs, delayMs = _c === void 0 ? 2000 : _c;
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 12];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 7, , 11]);
                    console.log("[NAVER-BLOG] \uBE14\uB85C\uADF8 \uD06C\uB864\uB9C1 \uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ": ").concat(blogUrl));
                    headers = {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'ko-KR,ko;q=0.9',
                        'Referer': 'https://www.naver.com/',
                        'Connection': 'keep-alive'
                    };
                    return [4 /*yield*/, fetch(blogUrl, {
                            method: 'GET',
                            headers: headers,
                            // @ts-ignore
                            signal: AbortSignal.timeout(timeout)
                        })];
                case 3:
                    response = _d.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 4:
                    html = _d.sent();
                    content = extractNaverBlogContent(html);
                    if (content && content.length > 100) {
                        console.log("[NAVER-BLOG] \u2705 \uBE14\uB85C\uADF8 \uB0B4\uC6A9 \uCD94\uCD9C \uC131\uACF5 (".concat(content.length, "\uC790)"));
                        return [2 /*return*/, content];
                    }
                    console.log("[NAVER-BLOG] \u26A0\uFE0F \uBE14\uB85C\uADF8 \uB0B4\uC6A9 \uCD94\uCD9C \uC2E4\uD328 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ")"));
                    if (!(attempt < retries)) return [3 /*break*/, 6];
                    return [4 /*yield*/, delay(delayMs)];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: return [3 /*break*/, 11];
                case 7:
                    error_2 = _d.sent();
                    console.error("[NAVER-BLOG] \u274C \uD06C\uB864\uB9C1 \uC2E4\uD328 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, "): ").concat(error_2.message));
                    if (!(attempt < retries)) return [3 /*break*/, 9];
                    return [4 /*yield*/, delay(delayMs * attempt)];
                case 8:
                    _d.sent();
                    return [3 /*break*/, 10];
                case 9: throw new Error("\uB124\uC774\uBC84 \uBE14\uB85C\uADF8 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(error_2.message));
                case 10: return [3 /*break*/, 11];
                case 11:
                    attempt++;
                    return [3 /*break*/, 1];
                case 12: return [2 /*return*/, ''];
            }
        });
    });
}
// HTML에서 네이버 검색 결과 파싱
function parseNaverSearchResults(html) {
    var _a, _b, _c;
    var results = [];
    try {
        // 네이버 통합검색 결과 파싱 (VIEW 영역)
        var viewPattern = /<a[^>]*class="[^"]*title_link[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        var match = void 0;
        while ((match = viewPattern.exec(html)) !== null && results.length < 10) {
            var url = match[1];
            var title = (_a = match[2]) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '').trim();
            if (url && title) {
                results.push({
                    title: title,
                    url: url,
                    description: ''
                });
            }
        }
        // 블로그 검색 결과 파싱
        var blogPattern = /<a[^>]*class="[^"]*api_txt_lines[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
        var _loop_1 = function () {
            var url = match[1];
            var title = (_b = match[2]) === null || _b === void 0 ? void 0 : _b.replace(/<[^>]*>/g, '').trim();
            if (url && title && !results.some(function (r) { return r.url === url; })) {
                results.push({
                    title: title,
                    url: url,
                    description: ''
                });
            }
        };
        while ((match = blogPattern.exec(html)) !== null && results.length < 10) {
            _loop_1();
        }
        // 일반 검색 결과 파싱 (백업)
        var generalPattern = /<div[^>]*class="[^"]*total_tit[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        var _loop_2 = function () {
            var url = match[1];
            var title = (_c = match[2]) === null || _c === void 0 ? void 0 : _c.replace(/<[^>]*>/g, '').trim();
            if (url && title && !results.some(function (r) { return r.url === url; })) {
                results.push({
                    title: title,
                    url: url,
                    description: ''
                });
            }
        };
        while ((match = generalPattern.exec(html)) !== null && results.length < 10) {
            _loop_2();
        }
    }
    catch (error) {
        console.error("[NAVER] \uD30C\uC2F1 \uC624\uB958: ".concat(error.message));
    }
    return results;
}
// 네이버 블로그 본문 추출
function extractNaverBlogContent(html) {
    try {
        // iframe 방식 블로그 (구형)
        var content = '';
        // se-main-container 클래스 (신형 스마트에디터)
        var seMainPattern = /<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
        var seMainMatch = html.match(seMainPattern);
        if (seMainMatch && seMainMatch[1]) {
            content = seMainMatch[1];
        }
        // post-view 클래스 (구형)
        if (!content) {
            var postViewPattern = /<div[^>]*class="[^"]*post-view[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
            var postViewMatch = html.match(postViewPattern);
            if (postViewMatch && postViewMatch[1]) {
                content = postViewMatch[1];
            }
        }
        // HTML 태그 제거 및 텍스트만 추출
        if (content) {
            // script, style 태그 제거
            content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
            content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
            // HTML 태그 제거
            content = content.replace(/<[^>]*>/g, ' ');
            // HTML 엔티티 디코딩
            content = content.replace(/&nbsp;/g, ' ');
            content = content.replace(/&lt;/g, '<');
            content = content.replace(/&gt;/g, '>');
            content = content.replace(/&amp;/g, '&');
            content = content.replace(/&quot;/g, '"');
            // 연속된 공백 제거
            content = content.replace(/\s+/g, ' ').trim();
            return content;
        }
    }
    catch (error) {
        console.error("[NAVER] \uBCF8\uBB38 \uCD94\uCD9C \uC624\uB958: ".concat(error.message));
    }
    return '';
}
// 네이버 이미지 검색
function crawlNaverImages(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var _a, timeout, _b, retries, _c, delayMs, imageUrl, attempt, headers, response, html, imageUrls, error_3;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.timeout, timeout = _a === void 0 ? 10000 : _a, _b = options.retries, retries = _b === void 0 ? 3 : _b, _c = options.delayMs, delayMs = _c === void 0 ? 2000 : _c;
                    imageUrl = "https://search.naver.com/search.naver?where=image&query=".concat(encodeURIComponent(query));
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 11];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 7, , 10]);
                    console.log("[NAVER-IMAGE] \uC774\uBBF8\uC9C0 \uAC80\uC0C9 \uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ": \"").concat(query, "\""));
                    headers = {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'ko-KR,ko;q=0.9',
                        'Referer': 'https://www.naver.com/'
                    };
                    return [4 /*yield*/, fetch(imageUrl, {
                            method: 'GET',
                            headers: headers,
                            // @ts-ignore
                            signal: AbortSignal.timeout(timeout)
                        })];
                case 3:
                    response = _d.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 4:
                    html = _d.sent();
                    imageUrls = extractNaverImageUrls(html);
                    if (imageUrls.length > 0) {
                        console.log("[NAVER-IMAGE] \u2705 ".concat(imageUrls.length, "\uAC1C\uC758 \uC774\uBBF8\uC9C0 URL \uC218\uC9D1 \uC131\uACF5"));
                        return [2 /*return*/, imageUrls];
                    }
                    console.log("[NAVER-IMAGE] \u26A0\uFE0F \uC774\uBBF8\uC9C0 \uC5C6\uC74C (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ")"));
                    if (!(attempt < retries)) return [3 /*break*/, 6];
                    return [4 /*yield*/, delay(delayMs)];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: return [3 /*break*/, 10];
                case 7:
                    error_3 = _d.sent();
                    console.error("[NAVER-IMAGE] \u274C \uD06C\uB864\uB9C1 \uC2E4\uD328 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, "): ").concat(error_3.message));
                    if (!(attempt < retries)) return [3 /*break*/, 9];
                    return [4 /*yield*/, delay(delayMs * attempt)];
                case 8:
                    _d.sent();
                    _d.label = 9;
                case 9: return [3 /*break*/, 10];
                case 10:
                    attempt++;
                    return [3 /*break*/, 1];
                case 11: return [2 /*return*/, []];
            }
        });
    });
}
// HTML에서 네이버 이미지 URL 추출
function extractNaverImageUrls(html) {
    var imageUrls = [];
    try {
        // 네이버 이미지 검색 결과에서 이미지 URL 추출
        var imgPattern = /<img[^>]*src="([^"]*)"[^>]*>/gi;
        var match = void 0;
        while ((match = imgPattern.exec(html)) !== null && imageUrls.length < 20) {
            var url = match[1];
            // 유효한 이미지 URL만 수집
            if (url && url.startsWith('http') && !url.includes('logo') && !url.includes('icon')) {
                imageUrls.push(url);
            }
        }
        // data-src 속성도 확인 (lazy loading)
        var dataSrcPattern = /<img[^>]*data-src="([^"]*)"[^>]*>/gi;
        while ((match = dataSrcPattern.exec(html)) !== null && imageUrls.length < 20) {
            var url = match[1];
            if (url && url.startsWith('http') && !imageUrls.includes(url)) {
                imageUrls.push(url);
            }
        }
    }
    catch (error) {
        console.error("[NAVER-IMAGE] \uD30C\uC2F1 \uC624\uB958: ".concat(error.message));
    }
    return imageUrls;
}
// 네이버 뉴스 크롤링
function crawlNaverNews(query_1) {
    return __awaiter(this, arguments, void 0, function (query, options) {
        var _a, timeout, _b, retries, _c, delayMs, newsUrl, attempt, headers, response, html, searchResults, newsResults, error_4;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.timeout, timeout = _a === void 0 ? 10000 : _a, _b = options.retries, retries = _b === void 0 ? 3 : _b, _c = options.delayMs, delayMs = _c === void 0 ? 2000 : _c;
                    newsUrl = "https://search.naver.com/search.naver?where=news&query=".concat(encodeURIComponent(query));
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 12];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 7, , 11]);
                    console.log("[NAVER-NEWS] \uB274\uC2A4 \uAC80\uC0C9 \uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ": \"").concat(query, "\""));
                    headers = {
                        'User-Agent': getRandomUserAgent(),
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'ko-KR,ko;q=0.9',
                        'Referer': 'https://www.naver.com/'
                    };
                    return [4 /*yield*/, fetch(newsUrl, {
                            method: 'GET',
                            headers: headers,
                            // @ts-ignore
                            signal: AbortSignal.timeout(timeout)
                        })];
                case 3:
                    response = _d.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status, ": ").concat(response.statusText));
                    }
                    return [4 /*yield*/, response.text()];
                case 4:
                    html = _d.sent();
                    searchResults = parseNaverSearchResults(html);
                    newsResults = searchResults.map(function (result) { return (__assign(__assign({}, result), { date: '' })); });
                    if (newsResults.length > 0) {
                        console.log("[NAVER-NEWS] \u2705 ".concat(newsResults.length, "\uAC1C\uC758 \uB274\uC2A4 \uC218\uC9D1 \uC131\uACF5"));
                        return [2 /*return*/, newsResults];
                    }
                    console.log("[NAVER-NEWS] \u26A0\uFE0F \uB274\uC2A4 \uC5C6\uC74C (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, ")"));
                    if (!(attempt < retries)) return [3 /*break*/, 6];
                    return [4 /*yield*/, delay(delayMs)];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: return [3 /*break*/, 11];
                case 7:
                    error_4 = _d.sent();
                    console.error("[NAVER-NEWS] \uB274\uC2A4 \uAC80\uC0C9 \uC624\uB958 (\uC2DC\uB3C4 ".concat(attempt, "/").concat(retries, "): ").concat(error_4.message));
                    if (!(attempt < retries)) return [3 /*break*/, 9];
                    return [4 /*yield*/, delay(delayMs)];
                case 8:
                    _d.sent();
                    return [3 /*break*/, 10];
                case 9: throw error_4;
                case 10: return [3 /*break*/, 11];
                case 11:
                    attempt++;
                    return [3 /*break*/, 1];
                case 12: return [2 /*return*/, []];
            }
        });
    });
}
// 네이버 검색 API를 사용한 검색 (공식 API)
function searchNaverWithApi(query_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (query, credentials, searchType, options) {
        var _a, timeout, _b, retries, _c, delayMs, customerId, secretKey, attempt, apiUrl, params, headers, response, errorText, data, results, error_5;
        if (searchType === void 0) { searchType = 'blog'; }
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.timeout, timeout = _a === void 0 ? 10000 : _a, _b = options.retries, retries = _b === void 0 ? 3 : _b, _c = options.delayMs, delayMs = _c === void 0 ? 1000 : _c;
                    customerId = credentials.customerId, secretKey = credentials.secretKey;
                    if (!customerId || !secretKey) {
                        throw new Error('네이버 API 인증 정보가 필요합니다 (Customer ID, Secret Key)');
                    }
                    attempt = 1;
                    _d.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 15];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 10, , 14]);
                    console.log("[NAVER-API] ".concat(searchType, " \uAC80\uC0C9 \uC2DC\uB3C4 ").concat(attempt, "/").concat(retries, ": \"").concat(query, "\""));
                    apiUrl = "https://openapi.naver.com/v1/search/".concat(searchType, ".json");
                    params = new URLSearchParams({
                        query: query,
                        display: '10', // 최대 10개 결과
                        start: '1',
                        sort: 'sim' // 정확도순
                    });
                    headers = {
                        'X-Naver-Client-Id': customerId,
                        'X-Naver-Client-Secret': secretKey,
                        'Content-Type': 'application/json'
                    };
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            method: 'GET',
                            headers: headers,
                            // @ts-ignore
                            signal: AbortSignal.timeout(timeout)
                        })];
                case 3:
                    response = _d.sent();
                    if (!!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, response.text()];
                case 4:
                    errorText = _d.sent();
                    throw new Error("\uB124\uC774\uBC84 API \uC624\uB958 ".concat(response.status, ": ").concat(errorText));
                case 5: return [4 /*yield*/, response.json()];
                case 6:
                    data = _d.sent();
                    if (!(!data.items || data.items.length === 0)) return [3 /*break*/, 9];
                    console.log("[NAVER-API] \u26A0\uFE0F ".concat(searchType, " \uAC80\uC0C9 \uACB0\uACFC \uC5C6\uC74C (\uC2DC\uB3C4 ").concat(attempt, "/").concat(retries, ")"));
                    if (!(attempt < retries)) return [3 /*break*/, 8];
                    return [4 /*yield*/, delay(delayMs)];
                case 7:
                    _d.sent();
                    return [3 /*break*/, 14];
                case 8: return [2 /*return*/, []];
                case 9:
                    results = data.items.map(function (item) {
                        var _a, _b;
                        return ({
                            title: ((_a = item.title) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '')) || '', // HTML 태그 제거
                            link: item.link || '',
                            description: ((_b = item.description) === null || _b === void 0 ? void 0 : _b.replace(/<[^>]*>/g, '')) || '',
                            bloggername: item.bloggername || '',
                            bloggerlink: item.bloggerlink || '',
                            postdate: item.postdate || ''
                        });
                    });
                    console.log("[NAVER-API] \u2705 ".concat(searchType, " \uAC80\uC0C9 \uACB0\uACFC ").concat(results.length, "\uAC1C \uC218\uC9D1 \uC131\uACF5"));
                    return [2 /*return*/, results];
                case 10:
                    error_5 = _d.sent();
                    console.error("[NAVER-API] ".concat(searchType, " \uAC80\uC0C9 \uC624\uB958 (\uC2DC\uB3C4 ").concat(attempt, "/").concat(retries, "): ").concat(error_5.message));
                    if (!(attempt < retries)) return [3 /*break*/, 12];
                    return [4 /*yield*/, delay(delayMs)];
                case 11:
                    _d.sent();
                    return [3 /*break*/, 13];
                case 12: throw error_5;
                case 13: return [3 /*break*/, 14];
                case 14:
                    attempt++;
                    return [3 /*break*/, 1];
                case 15: return [2 /*return*/, []];
            }
        });
    });
}
// 네이버 검색 API를 사용한 블로그 검색
function searchNaverBlogWithApi(query_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (query, credentials, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, searchNaverWithApi(query, credentials, 'blog', options)];
        });
    });
}
// 네이버 검색 API를 사용한 뉴스 검색
function searchNaverNewsWithApi(query_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (query, credentials, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, searchNaverWithApi(query, credentials, 'news', options)];
        });
    });
}
// 네이버 검색 API를 사용한 웹 검색
function searchNaverWebWithApi(query_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (query, credentials, options) {
        if (options === void 0) { options = {}; }
        return __generator(this, function (_a) {
            return [2 /*return*/, searchNaverWithApi(query, credentials, 'webkr', options)];
        });
    });
}
