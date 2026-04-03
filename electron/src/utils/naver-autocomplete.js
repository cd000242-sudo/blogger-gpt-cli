"use strict";
/**
 * 네이버 검색 자동완성 및 연관 검색어 크롤링
 * 네이버 검색 페이지에서 실제 사용자가 검색하는 연관 검색어 추출
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
exports.getNaverAutocompleteKeywords = getNaverAutocompleteKeywords;
/**
 * 네이버 검색 자동완성 키워드 추출 (실제 검색 패턴 기반)
 */
function getNaverAutocompleteKeywords(baseKeyword, config) {
    return __awaiter(this, void 0, void 0, function () {
        var keywords, apiUrl, headers, params, response, data, items, searchUrl, htmlResponse, html_1, relatedPatterns, htmlErr_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    keywords = new Set();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 11]);
                    apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                    headers = {
                        'X-Naver-Client-Id': config.clientId,
                        'X-Naver-Client-Secret': config.clientSecret
                    };
                    params = new URLSearchParams({
                        query: baseKeyword,
                        display: '100',
                        sort: 'sim' // 정확도순 (실제 검색 패턴 반영)
                    });
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            method: 'GET',
                            headers: headers
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    items = data.items || [];
                    // 제목에서 실제 검색 패턴 추출 + 연상 키워드 추출
                    items.forEach(function (item) {
                        var title = (item.title || '').replace(/<[^>]*>/g, '').trim();
                        var description = (item.description || '').replace(/<[^>]*>/g, '').trim();
                        var fullText = "".concat(title, " ").concat(description);
                        // 키워드가 포함된 제목 전체를 키워드로 간주 (실제 검색 패턴)
                        if (title.includes(baseKeyword) && title.length <= 30) {
                            keywords.add(title);
                        }
                        // 설명에서도 의미 있는 구문 추출
                        if (description.includes(baseKeyword)) {
                            var sentences = description.split(/[.|!?。！？]/);
                            sentences.forEach(function (sentence) {
                                var trimmed = sentence.trim();
                                if (trimmed.includes(baseKeyword) && trimmed.length >= baseKeyword.length && trimmed.length <= 40) {
                                    keywords.add(trimmed);
                                }
                            });
                        }
                        // 연상 키워드 추출: 키워드와 함께 언급되는 사건명, 장소명, 관련 용어 등
                        // 패턴 1: "XXX사건", "XXX사고", "XXX살인사건" 등 긴 구문 추출
                        var incidentPatterns = [
                            /([가-힣]{2,20}(?:연쇄살인사건|살인사건|연쇄살인|범죄|살인|사건|사고))/g,
                            /([가-힣]{2,20}(?:사건|사고))/g,
                            /([가-힣]{2,15}(?:사건|사고))/g
                        ];
                        incidentPatterns.forEach(function (pattern) {
                            try {
                                var matches = fullText.matchAll(pattern);
                                for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
                                    var match = matches_1[_i];
                                    if (match[1] && match[1].length >= 3 && match[1].length <= 30) {
                                        var keyword = match[1].trim();
                                        // 키워드와 함께 언급되는 경우만 추가 (키워드가 제목/설명에 있으면)
                                        if (fullText.includes(baseKeyword) && keyword.length > baseKeyword.length) {
                                            keywords.add(keyword);
                                        }
                                    }
                                }
                            }
                            catch (e) {
                                // 패턴 오류 무시
                            }
                        });
                        // 패턴 2: 키워드 앞뒤로 나오는 긴 명사 구문 추출 (3-6개 단어)
                        if (fullText.includes(baseKeyword)) {
                            var words = fullText.split(/[\s|,，、·\[\]()【】「」<>]+/).filter(function (w) { return w.trim().length > 0; });
                            var keywordIndex = words.findIndex(function (w) { return w.includes(baseKeyword); });
                            if (keywordIndex >= 0) {
                                // 키워드 앞에서 긴 구문 추출 (최대 5개 단어)
                                for (var len = 3; len <= 6 && keywordIndex - len >= 0; len++) {
                                    var phraseWords = words.slice(keywordIndex - len, keywordIndex);
                                    if (phraseWords.length >= 3) {
                                        var phrase = phraseWords.join(' ').trim();
                                        if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                                            keywords.add(phrase);
                                        }
                                    }
                                }
                                // 키워드 뒤에서 긴 구문 추출 (최대 5개 단어)
                                for (var len = 3; len <= 6 && keywordIndex + len < words.length; len++) {
                                    var phraseWords = words.slice(keywordIndex + 1, keywordIndex + 1 + len);
                                    if (phraseWords.length >= 3) {
                                        var phrase = phraseWords.join(' ').trim();
                                        if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                                            keywords.add(phrase);
                                        }
                                    }
                                }
                                // 키워드 앞뒤 모두 포함한 긴 구문 추출
                                for (var before = 1; before <= 3; before++) {
                                    for (var after = 1; after <= 3; after++) {
                                        if (keywordIndex - before >= 0 && keywordIndex + after < words.length) {
                                            var phraseWords = words.slice(keywordIndex - before, keywordIndex + after + 1);
                                            if (phraseWords.length >= 3) {
                                                var phrase = phraseWords.join(' ').trim();
                                                if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                                                    keywords.add(phrase);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 8, , 9]);
                    searchUrl = "https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=".concat(encodeURIComponent(baseKeyword));
                    return [4 /*yield*/, fetch(searchUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })];
                case 5:
                    htmlResponse = _a.sent();
                    if (!htmlResponse.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, htmlResponse.text()];
                case 6:
                    html_1 = _a.sent();
                    relatedPatterns = [
                        /<a[^>]*class="[^"]*related_srch[^"]*"[^>]*>([^<]+)<\/a>/g,
                        /<span[^>]*class="[^"]*related_keyword[^"]*"[^>]*>([^<]+)<\/span>/g,
                        /data-keyword="([^"]+)"/g,
                        /keyword[^>]*>([^<]+)</g
                    ];
                    relatedPatterns.forEach(function (pattern) {
                        var _a;
                        var match;
                        while ((match = pattern.exec(html_1)) !== null) {
                            var keyword = (_a = match[1]) === null || _a === void 0 ? void 0 : _a.trim();
                            if (keyword && keyword.includes(baseKeyword) && keyword.length <= 30) {
                                keywords.add(keyword);
                            }
                        }
                    });
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    htmlErr_1 = _a.sent();
                    console.warn('[NAVER-AUTOCOMPLETE] HTML 크롤링 실패, API 결과만 사용:', htmlErr_1);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/, Array.from(keywords).slice(0, 50)];
                case 10:
                    error_1 = _a.sent();
                    console.error('[NAVER-AUTOCOMPLETE] 연관 검색어 추출 실패:', error_1);
                    return [2 /*return*/, []];
                case 11: return [2 /*return*/];
            }
        });
    });
}
