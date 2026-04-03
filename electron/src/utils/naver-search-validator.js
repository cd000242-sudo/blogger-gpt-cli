"use strict";
/**
 * 네이버 검색 API를 사용한 실시간 링크 검색 및 유효성 검증
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
exports.searchNaverWithApi = searchNaverWithApi;
exports.validateLink = validateLink;
exports.validateLinks = validateLinks;
exports.getValidNaverLinks = getValidNaverLinks;
exports.getValidLinksForMultipleKeywords = getValidLinksForMultipleKeywords;
/**
 * 네이버 검색 API를 사용하여 키워드로 검색 결과 가져오기
 */
function searchNaverWithApi(keyword_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (keyword, credentials, display) {
        var apiUrl, response, data, error_1;
        if (display === void 0) { display = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    apiUrl = "https://openapi.naver.com/v1/search/webkr.json?query=".concat(encodeURIComponent(keyword), "&display=").concat(display, "&sort=sim");
                    return [4 /*yield*/, fetch(apiUrl, {
                            headers: {
                                'X-Naver-Client-Id': credentials.clientId,
                                'X-Naver-Client-Secret': credentials.clientSecret,
                                'Accept': 'application/json'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        if (response.status === 401) {
                            throw new Error('네이버 API 인증 실패. API 키를 확인해주세요.');
                        }
                        if (response.status === 429) {
                            throw new Error('네이버 API 할당량 초과. 잠시 후 다시 시도해주세요.');
                        }
                        throw new Error("\uB124\uC774\uBC84 \uAC80\uC0C9 API \uC624\uB958: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    if (!data.items || !Array.isArray(data.items)) {
                        return [2 /*return*/, []];
                    }
                    return [2 /*return*/, data.items.map(function (item) {
                            var _a, _b;
                            return ({
                                title: ((_a = item.title) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '')) || '',
                                link: item.link || '',
                                description: ((_b = item.description) === null || _b === void 0 ? void 0 : _b.replace(/<[^>]*>/g, '')) || ''
                            });
                        })];
                case 3:
                    error_1 = _a.sent();
                    console.error("[NAVER-SEARCH] \uAC80\uC0C9 \uC2E4\uD328: ".concat(error_1.message));
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 링크 유효성 검사 (HEAD 요청으로 200-299 상태 코드만 허용)
 */
function validateLink(url_1) {
    return __awaiter(this, arguments, void 0, function (url, timeout) {
        var controller_1, timeoutId, response, statusCode, isValid, error_2;
        if (timeout === void 0) { timeout = 5000; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    controller_1 = new AbortController();
                    timeoutId = setTimeout(function () { return controller_1.abort(); }, timeout);
                    return [4 /*yield*/, fetch(url, {
                            method: 'HEAD',
                            signal: controller_1.signal,
                            redirect: 'follow',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        })];
                case 1:
                    response = _a.sent();
                    clearTimeout(timeoutId);
                    statusCode = response.status;
                    isValid = statusCode >= 200 && statusCode < 300;
                    return [2 /*return*/, {
                            isValid: isValid,
                            statusCode: statusCode
                        }];
                case 2:
                    error_2 = _a.sent();
                    if (error_2.name === 'AbortError') {
                        return [2 /*return*/, {
                                isValid: false,
                                error: '타임아웃'
                            }];
                    }
                    return [2 /*return*/, {
                            isValid: false,
                            error: error_2.message || '알 수 없는 오류'
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * 여러 링크의 유효성을 병렬로 검증
 */
function validateLinks(links_1) {
    return __awaiter(this, arguments, void 0, function (links, maxConcurrent) {
        var results, i, batch, batchResults;
        var _this = this;
        if (maxConcurrent === void 0) { maxConcurrent = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = [];
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < links.length)) return [3 /*break*/, 5];
                    batch = links.slice(i, i + maxConcurrent);
                    return [4 /*yield*/, Promise.all(batch.map(function (link) { return __awaiter(_this, void 0, void 0, function () {
                            var validation;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, validateLink(link.url)];
                                    case 1:
                                        validation = _a.sent();
                                        return [2 /*return*/, __assign(__assign({}, link), { isValid: validation.isValid, statusCode: validation.statusCode, error: validation.error })];
                                }
                            });
                        }); }))];
                case 2:
                    batchResults = _a.sent();
                    results.push.apply(results, batchResults);
                    if (!(i + maxConcurrent < links.length)) return [3 /*break*/, 4];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    i += maxConcurrent;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * 네이버 검색 API로 키워드 검색 후 유효한 링크만 반환
 */
function getValidNaverLinks(keyword_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (keyword, credentials, options) {
        var _a, maxResults, _b, maxConcurrent, _c, shouldValidate, searchResults, validatedLinks, validLinks, error_3;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = options.maxResults, maxResults = _a === void 0 ? 10 : _a, _b = options.maxConcurrent, maxConcurrent = _b === void 0 ? 5 : _b, _c = options.validateLinks, shouldValidate = _c === void 0 ? true : _c;
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, , 7]);
                    console.log("[NAVER-SEARCH] \"".concat(keyword, "\" \uAC80\uC0C9 \uC2DC\uC791 (\uCD5C\uB300 ").concat(maxResults, "\uAC1C)"));
                    return [4 /*yield*/, searchNaverWithApi(keyword, credentials, maxResults * 2)];
                case 2:
                    searchResults = _d.sent();
                    if (searchResults.length === 0) {
                        console.log("[NAVER-SEARCH] \"".concat(keyword, "\"\uC5D0 \uB300\uD55C \uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."));
                        return [2 /*return*/, []];
                    }
                    console.log("[NAVER-SEARCH] \uAC80\uC0C9 \uACB0\uACFC ".concat(searchResults.length, "\uAC1C \uBC1C\uACAC"));
                    if (!shouldValidate) return [3 /*break*/, 4];
                    console.log("[NAVER-SEARCH] \uB9C1\uD06C \uC720\uD6A8\uC131 \uAC80\uC99D \uC911...");
                    return [4 /*yield*/, validateLinks(searchResults.map(function (link) { return ({ url: link.link, title: link.title, description: link.description }); }), maxConcurrent)];
                case 3:
                    validatedLinks = _d.sent();
                    validLinks = validatedLinks.filter(function (link) { return link.isValid; });
                    console.log("[NAVER-SEARCH] \uC720\uD6A8\uD55C \uB9C1\uD06C ".concat(validLinks.length, "\uAC1C / \uC804\uCCB4 ").concat(validatedLinks.length, "\uAC1C"));
                    // 로그 출력
                    validatedLinks.forEach(function (link, index) {
                        if (link.isValid) {
                            console.log("[NAVER-SEARCH] \u2705 ".concat(index + 1, ". ").concat(link.title, " (").concat(link.statusCode || 'N/A', ")"));
                            console.log("[NAVER-SEARCH]    ".concat(link.url));
                        }
                        else {
                            console.log("[NAVER-SEARCH] \u274C ".concat(index + 1, ". ").concat(link.title, " (").concat(link.statusCode || link.error || 'N/A', ")"));
                            console.log("[NAVER-SEARCH]    ".concat(link.url));
                        }
                    });
                    return [2 /*return*/, validLinks.slice(0, maxResults)];
                case 4: 
                // 유효성 검증 없이 반환
                return [2 /*return*/, searchResults.slice(0, maxResults).map(function (link) { return ({
                        url: link.link,
                        title: link.title,
                        description: link.description,
                        isValid: true
                    }); })];
                case 5: return [3 /*break*/, 7];
                case 6:
                    error_3 = _d.sent();
                    console.error("[NAVER-SEARCH] \uC624\uB958: ".concat(error_3.message));
                    throw error_3;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * 여러 키워드로 검색하여 유효한 링크 수집
 */
function getValidLinksForMultipleKeywords(keywords_1, credentials_1) {
    return __awaiter(this, arguments, void 0, function (keywords, credentials, options) {
        var _a, maxResultsPerKeyword, _b, maxTotalResults, _c, shouldValidate, allLinks, seenUrls, _i, keywords_2, keyword, links, _d, links_1, link, error_4;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _a = options.maxResultsPerKeyword, maxResultsPerKeyword = _a === void 0 ? 5 : _a, _b = options.maxTotalResults, maxTotalResults = _b === void 0 ? 10 : _b, _c = options.validateLinks, shouldValidate = _c === void 0 ? true : _c;
                    allLinks = [];
                    seenUrls = new Set();
                    _i = 0, keywords_2 = keywords;
                    _e.label = 1;
                case 1:
                    if (!(_i < keywords_2.length)) return [3 /*break*/, 7];
                    keyword = keywords_2[_i];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, getValidNaverLinks(keyword, credentials, {
                            maxResults: maxResultsPerKeyword,
                            validateLinks: shouldValidate
                        })];
                case 3:
                    links = _e.sent();
                    // 중복 제거
                    for (_d = 0, links_1 = links; _d < links_1.length; _d++) {
                        link = links_1[_d];
                        if (!seenUrls.has(link.url)) {
                            seenUrls.add(link.url);
                            allLinks.push(link);
                            if (allLinks.length >= maxTotalResults) {
                                break;
                            }
                        }
                    }
                    if (allLinks.length >= maxTotalResults) {
                        return [3 /*break*/, 7];
                    }
                    // 키워드 간 딜레이 (Rate Limiting)
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 4:
                    // 키워드 간 딜레이 (Rate Limiting)
                    _e.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_4 = _e.sent();
                    console.error("[NAVER-SEARCH] \"".concat(keyword, "\" \uAC80\uC0C9 \uC2E4\uD328: ").concat(error_4.message));
                    return [3 /*break*/, 6];
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, allLinks.slice(0, maxTotalResults)];
            }
        });
    });
}
