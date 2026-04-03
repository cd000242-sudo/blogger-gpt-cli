"use strict";
/**
 * 대량 크롤링 시스템 - 기존 시스템의 고성능 버전
 * 네이버 API + RSS + Google CSE로 수천 개 데이터 수집
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
exports.MassCrawlingSystem = exports.GoogleCSEMassCrawler = exports.MassRSSCrawler = exports.NaverMassCrawler = void 0;
var axios_1 = require("axios");
var cheerio = require("cheerio");
var p_queue_1 = require("p-queue");
var p_limit_1 = require("p-limit");
// 성능 모니터링을 위한 유틸리티
var PerformanceMonitor = /** @class */ (function () {
    function PerformanceMonitor() {
        this.metrics = new Map();
    }
    PerformanceMonitor.prototype.startMeasurement = function (name) {
        this.metrics.set(name, { startTime: Date.now() });
    };
    PerformanceMonitor.prototype.endMeasurement = function (name, _metadata) {
        var metric = this.metrics.get(name);
        if (metric) {
            metric.endTime = Date.now();
            metric.duration = metric.endTime - metric.startTime;
            console.log("[PERFORMANCE] ".concat(name, ": ").concat(metric.duration, "ms"));
        }
    };
    PerformanceMonitor.prototype.getMetric = function (name) {
        var metric = this.metrics.get(name);
        return (metric === null || metric === void 0 ? void 0 : metric.duration) ? { duration: metric.duration } : undefined;
    };
    PerformanceMonitor.prototype.printReport = function () {
        console.log('\n📊 성능 리포트:');
        this.metrics.forEach(function (metric, name) {
            if (metric.duration) {
                console.log("  ".concat(name, ": ").concat(metric.duration, "ms"));
            }
        });
    };
    return PerformanceMonitor;
}());
// 로거 클래스
var Logger = /** @class */ (function () {
    function Logger(context) {
        this.context = context;
    }
    Logger.prototype.info = function (message) {
        console.log("[".concat(this.context, "] \u2139\uFE0F ").concat(message));
    };
    Logger.prototype.warn = function (message) {
        console.warn("[".concat(this.context, "] \u26A0\uFE0F ").concat(message));
    };
    Logger.prototype.error = function (message, error) {
        console.error("[".concat(this.context, "] \u274C ").concat(message), error);
    };
    Logger.prototype.success = function (message) {
        console.log("[".concat(this.context, "] \u2705 ").concat(message));
    };
    return Logger;
}());
/**
 * 네이버 API 대량 크롤러
 */
var NaverMassCrawler = /** @class */ (function () {
    function NaverMassCrawler(clientId, clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.requestQueue = new p_queue_1.default({
            concurrency: 20, // 동시 20개 요청 (50 -> 20으로 감소, 서버 부하 방지)
            interval: 1000,
            intervalCap: 20
        });
    }
    /**
     * 네이버 API 대량 크롤링 (개선된 버전)
     */
    NaverMassCrawler.prototype.crawlMassive = function (keyword_1) {
        return __awaiter(this, arguments, void 0, function (keyword, options) {
            var _a, maxResults, _b, sort, _c, includeViews, results, batchSize, totalPages, batchSizePages, _loop_1, this_1, batchStart, sortedResults;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = options.maxResults, maxResults = _a === void 0 ? 5000 : _a, _b = options.sort, sort = _b === void 0 ? 'sim' : _b, _c = options.includeViews, includeViews = _c === void 0 ? true : _c;
                        console.log("[NAVER-MASS] \uD83D\uDE80 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(keyword, "\" (\uBAA9\uD45C: ").concat(maxResults, "\uAC1C)"));
                        results = [];
                        batchSize = 100;
                        totalPages = Math.ceil(maxResults / batchSize);
                        batchSizePages = 5;
                        console.log("[NAVER-MASS] \uD83D\uDCCA ".concat(totalPages, "\uAC1C \uD398\uC774\uC9C0 \uBC30\uCE58 \uCC98\uB9AC \uC2DC\uC791... (\uBC30\uCE58 \uD06C\uAE30: ").concat(batchSizePages, "\uAC1C)"));
                        _loop_1 = function (batchStart) {
                            var batchEnd, batchPromises, _loop_2, page, batchResults;
                            return __generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        batchEnd = Math.min(batchStart + batchSizePages, totalPages);
                                        batchPromises = [];
                                        _loop_2 = function (page) {
                                            var start = page * batchSize + 1;
                                            batchPromises.push(this_1.requestQueue.add(function () { return __awaiter(_this, void 0, void 0, function () {
                                                var error_1;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            _a.trys.push([0, 2, , 3]);
                                                            return [4 /*yield*/, this.fetchPage(keyword, start, batchSize, sort)];
                                                        case 1: return [2 /*return*/, _a.sent()];
                                                        case 2:
                                                            error_1 = _a.sent();
                                                            console.error("[NAVER-MASS] \uD398\uC774\uC9C0 ".concat(page + 1, " \uC694\uCCAD \uC2E4\uD328:"), error_1);
                                                            return [2 /*return*/, []];
                                                        case 3: return [2 /*return*/];
                                                    }
                                                });
                                            }); }));
                                        };
                                        for (page = batchStart; page < batchEnd; page++) {
                                            _loop_2(page);
                                        }
                                        console.log("[NAVER-MASS] \uD83D\uDCE6 \uBC30\uCE58 ".concat(Math.floor(batchStart / batchSizePages) + 1, " \uCC98\uB9AC \uC911... (").concat(batchStart + 1, "-").concat(batchEnd, "/").concat(totalPages, ")"));
                                        return [4 /*yield*/, Promise.allSettled(batchPromises)];
                                    case 1:
                                        batchResults = _f.sent();
                                        batchResults.forEach(function (result, batchIndex) {
                                            var pageIndex = batchStart + batchIndex;
                                            if (result.status === 'fulfilled') {
                                                results.push.apply(results, result.value);
                                                console.log("[NAVER-MASS] \u2705 \uD398\uC774\uC9C0 ".concat(pageIndex + 1, "/").concat(totalPages, " \uC644\uB8CC: ").concat(result.value.length, "\uAC1C"));
                                            }
                                            else {
                                                console.error("[NAVER-MASS] \u274C \uD398\uC774\uC9C0 ".concat(pageIndex + 1, " \uC2E4\uD328:"), result.reason);
                                            }
                                        });
                                        if (!(batchEnd < totalPages)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                                    case 2:
                                        _f.sent(); // 0.5초 대기
                                        _f.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        batchStart = 0;
                        _d.label = 1;
                    case 1:
                        if (!(batchStart < totalPages)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(batchStart)];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3:
                        batchStart += batchSizePages;
                        return [3 /*break*/, 1];
                    case 4:
                        if (!(includeViews && sort === 'sim')) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.sortByPopularity(results)];
                    case 5:
                        sortedResults = _d.sent();
                        console.log("[NAVER-MASS] \uD83D\uDCC8 \uC778\uAE30\uB3C4 \uAE30\uBC18 \uC815\uB82C \uC644\uB8CC");
                        return [2 /*return*/, sortedResults];
                    case 6:
                        console.log("[NAVER-MASS] \u2705 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(results.length, "\uAC1C \uC218\uC9D1"));
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * 단일 페이지 요청 (개선된 에러 처리)
     */
    NaverMassCrawler.prototype.fetchPage = function (keyword, start, display, sort) {
        return __awaiter(this, void 0, void 0, function () {
            var maxRetries, lastError, requestStartTime, _loop_3, this_2, attempt, state_1, totalTime;
            var _this = this;
            var _a, _b, _c, _d, _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        maxRetries = 3;
                        requestStartTime = Date.now();
                        _loop_3 = function (attempt) {
                            var url, params, requestTime, response, responseTime, items, error_2, errorTime, waitTime_1, waitTime_2, waitTime_3;
                            return __generator(this, function (_o) {
                                switch (_o.label) {
                                    case 0:
                                        _o.trys.push([0, 2, , 12]);
                                        url = 'https://openapi.naver.com/v1/search/blog.json';
                                        params = {
                                            query: keyword,
                                            display: Math.min(display, 100), // API 제한
                                            start: start,
                                            sort: sort
                                        };
                                        console.log("[NAVER-MASS-DEBUG] \uD83D\uDD04 \uD398\uC774\uC9C0 \uC694\uCCAD \uC2DC\uB3C4 ".concat(attempt, "/").concat(maxRetries));
                                        console.log("[NAVER-MASS-DEBUG]    URL: ".concat(url));
                                        console.log("[NAVER-MASS-DEBUG]    \uD30C\uB77C\uBBF8\uD130:", params);
                                        console.log("[NAVER-MASS-DEBUG]    \uD074\uB77C\uC774\uC5B8\uD2B8 ID: ".concat(this_2.clientId.substring(0, 8), "..."));
                                        requestTime = Date.now();
                                        return [4 /*yield*/, axios_1.default.get(url, {
                                                params: params,
                                                headers: {
                                                    'X-Naver-Client-Id': this_2.clientId,
                                                    'X-Naver-Client-Secret': this_2.clientSecret,
                                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                                },
                                                timeout: 30000, // 30초
                                                validateStatus: function (status) { return status < 500; } // 5xx 에러만 재시도
                                            })];
                                    case 1:
                                        response = _o.sent();
                                        responseTime = Date.now() - requestTime;
                                        console.log("[NAVER-MASS-DEBUG] \u2705 \uC751\uB2F5 \uC218\uC2E0 (".concat(responseTime, "ms)"));
                                        console.log("[NAVER-MASS-DEBUG]    \uC0C1\uD0DC \uCF54\uB4DC: ".concat(response.status));
                                        console.log("[NAVER-MASS-DEBUG]    \uC751\uB2F5 \uD5E4\uB354:", Object.keys(response.headers));
                                        console.log("[NAVER-MASS-DEBUG]    \uB370\uC774\uD130 \uD56D\uBAA9 \uC218: ".concat(((_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.items) === null || _b === void 0 ? void 0 : _b.length) || 0));
                                        if (!response.data.items) {
                                            console.log("[NAVER-MASS] \uD398\uC774\uC9C0 ".concat(start, "\uC5D0\uC11C \uACB0\uACFC \uC5C6\uC74C"));
                                            return [2 /*return*/, { value: [] }];
                                        }
                                        items = response.data.items.map(function (item) { return ({
                                            title: _this.cleanText(item.title),
                                            description: _this.cleanText(item.description),
                                            link: item.link,
                                            pubDate: item.postdate,
                                            author: item.bloggername,
                                            source: 'naver',
                                            popularityScore: _this.calculateInitialScore(item)
                                        }); });
                                        console.log("[NAVER-MASS] \uD398\uC774\uC9C0 ".concat(start, " \uC131\uACF5: ").concat(items.length, "\uAC1C \uD56D\uBAA9"));
                                        return [2 /*return*/, { value: items }];
                                    case 2:
                                        error_2 = _o.sent();
                                        errorTime = Date.now() - requestStartTime;
                                        lastError = error_2;
                                        console.error("[NAVER-MASS-DEBUG] \u274C \uC5D0\uB7EC \uBC1C\uC0DD (".concat(errorTime, "ms)"));
                                        console.error("[NAVER-MASS-DEBUG]    \uC5D0\uB7EC \uC774\uB984: ".concat((error_2 === null || error_2 === void 0 ? void 0 : error_2.name) || 'Unknown'));
                                        console.error("[NAVER-MASS-DEBUG]    \uC5D0\uB7EC \uBA54\uC2DC\uC9C0: ".concat((error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || 'N/A'));
                                        console.error("[NAVER-MASS-DEBUG]    \uC5D0\uB7EC \uCF54\uB4DC: ".concat((error_2 === null || error_2 === void 0 ? void 0 : error_2.code) || 'N/A'));
                                        console.error("[NAVER-MASS-DEBUG]    HTTP \uC0C1\uD0DC: ".concat(((_c = error_2 === null || error_2 === void 0 ? void 0 : error_2.response) === null || _c === void 0 ? void 0 : _c.status) || 'N/A'));
                                        console.error("[NAVER-MASS-DEBUG]    \uC694\uCCAD URL: ".concat(((_d = error_2 === null || error_2 === void 0 ? void 0 : error_2.config) === null || _d === void 0 ? void 0 : _d.url) || 'N/A'));
                                        console.error("[NAVER-MASS-DEBUG]    \uD0C0\uC784\uC544\uC6C3 \uC5EC\uBD80: ".concat((error_2 === null || error_2 === void 0 ? void 0 : error_2.code) === 'ECONNABORTED' || ((_f = error_2 === null || error_2 === void 0 ? void 0 : error_2.message) === null || _f === void 0 ? void 0 : _f.includes('timeout')) ? 'YES' : 'NO'));
                                        if (!(((_g = error_2.response) === null || _g === void 0 ? void 0 : _g.status) === 429)) return [3 /*break*/, 4];
                                        waitTime_1 = Math.min(attempt * 3000, 10000);
                                        console.log("[NAVER-MASS] Rate limit \uAC10\uC9C0, ".concat(waitTime_1, "ms \uB300\uAE30..."));
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_1); })];
                                    case 3:
                                        _o.sent();
                                        return [3 /*break*/, 11];
                                    case 4:
                                        if (!(((_h = error_2.response) === null || _h === void 0 ? void 0 : _h.status) === 400)) return [3 /*break*/, 5];
                                        // 잘못된 요청 - 재시도하지 않음
                                        console.error("[NAVER-MASS] \uC798\uBABB\uB41C \uC694\uCCAD (400): ".concat(((_j = error_2.response.data) === null || _j === void 0 ? void 0 : _j.errorMessage) || error_2.message));
                                        return [2 /*return*/, "break"];
                                    case 5:
                                        if (!(((_k = error_2.response) === null || _k === void 0 ? void 0 : _k.status) === 401)) return [3 /*break*/, 6];
                                        // 인증 실패 - 재시도하지 않음
                                        console.error("[NAVER-MASS] \uC778\uC99D \uC2E4\uD328 (401): API \uD0A4\uB97C \uD655\uC778\uD558\uC138\uC694");
                                        return [2 /*return*/, "break"];
                                    case 6:
                                        if (!(error_2.code === 'ECONNABORTED' || ((_l = error_2.message) === null || _l === void 0 ? void 0 : _l.includes('timeout')))) return [3 /*break*/, 9];
                                        waitTime_2 = Math.min(attempt * 1500, 5000);
                                        console.error("[NAVER-MASS-DEBUG] \u23F1\uFE0F \uD0C0\uC784\uC544\uC6C3 \uBC1C\uC0DD! ".concat(waitTime_2, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                        if (!(attempt < maxRetries)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_2); })];
                                    case 7:
                                        _o.sent();
                                        _o.label = 8;
                                    case 8: return [3 /*break*/, 11];
                                    case 9:
                                        waitTime_3 = Math.min(attempt * 1000, 3000);
                                        console.log("[NAVER-MASS] \uD398\uC774\uC9C0 ".concat(start, " \uC2DC\uB3C4 ").concat(attempt, "/").concat(maxRetries, " \uC2E4\uD328, ").concat(waitTime_3, "ms \uD6C4 \uC7AC\uC2DC\uB3C4: ").concat(error_2.message));
                                        if (!(attempt < maxRetries)) return [3 /*break*/, 11];
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, waitTime_3); })];
                                    case 10:
                                        _o.sent();
                                        _o.label = 11;
                                    case 11: return [3 /*break*/, 12];
                                    case 12: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        attempt = 1;
                        _m.label = 1;
                    case 1:
                        if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_3(attempt)];
                    case 2:
                        state_1 = _m.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        if (state_1 === "break")
                            return [3 /*break*/, 4];
                        _m.label = 3;
                    case 3:
                        attempt++;
                        return [3 /*break*/, 1];
                    case 4:
                        totalTime = Date.now() - requestStartTime;
                        console.error("[NAVER-MASS-DEBUG] \u274C \uD398\uC774\uC9C0 ".concat(start, " \uCD5C\uC885 \uC2E4\uD328 (\uCD1D ").concat(totalTime, "ms):"), lastError === null || lastError === void 0 ? void 0 : lastError.message);
                        console.error("[NAVER-MASS-DEBUG]    \uCD5C\uC885 \uC5D0\uB7EC \uC2A4\uD0DD:", (lastError === null || lastError === void 0 ? void 0 : lastError.stack) || 'N/A');
                        return [2 /*return*/, []];
                }
            });
        });
    };
    /**
     * 조회수 추정 로직 (블로그 인덱스 분석)
     */
    NaverMassCrawler.prototype.sortByPopularity = function (results) {
        return __awaiter(this, void 0, void 0, function () {
            var analyzed;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("[NAVER-MASS] \uD83D\uDCCA \uC778\uAE30\uB3C4 \uBD84\uC11D \uC2DC\uC791...");
                        return [4 /*yield*/, Promise.all(results.map(function (item) { return __awaiter(_this, void 0, void 0, function () {
                                var popularity;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.estimatePopularity(item)];
                                        case 1:
                                            popularity = _a.sent();
                                            return [2 /*return*/, __assign(__assign({}, item), { popularityScore: popularity })];
                                    }
                                });
                            }); }))];
                    case 1:
                        analyzed = _a.sent();
                        return [2 /*return*/, analyzed.sort(function (a, b) { return b.popularityScore - a.popularityScore; })];
                }
            });
        });
    };
    /**
     * 인기도 점수 계산
     */
    NaverMassCrawler.prototype.estimatePopularity = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var score, pubDate, now, daysOld, popularKeywords;
            return __generator(this, function (_a) {
                score = 0;
                pubDate = new Date(item.pubDate);
                now = new Date('2025-10-27');
                daysOld = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysOld < 7)
                    score += 100;
                else if (daysOld < 30)
                    score += 50;
                else if (daysOld < 90)
                    score += 20;
                // 제목 길이 (자세한 글)
                score += item.title.length / 10;
                // 설명 길이 (풍부한 내용)
                score += item.description.length / 50;
                popularKeywords = ['방법', '추천', '비교', '후기', '가격', '할인', '무료', '최신', '2025'];
                popularKeywords.forEach(function (keyword) {
                    if (item.title.includes(keyword))
                        score += 10;
                });
                return [2 /*return*/, score];
            });
        });
    };
    /**
     * 초기 점수 계산
     */
    NaverMassCrawler.prototype.calculateInitialScore = function (item) {
        var score = 0;
        // 제목 길이
        score += item.title.length / 10;
        // 설명 길이
        score += item.description.length / 50;
        return score;
    };
    /**
     * 텍스트 정리
     */
    NaverMassCrawler.prototype.cleanText = function (text) {
        return text
            .replace(/<[^>]*>/g, '') // HTML 태그 제거
            .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .trim();
    };
    /**
     * 실제 블로그 본문 크롤링 (Puppeteer)
     */
    NaverMassCrawler.prototype.fetchFullContent = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var browser, timeoutId, puppeteer, page, content, error_3, closeError_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        browser = null;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 13]);
                        timeoutId = setTimeout(function () {
                            if (browser) {
                                console.warn("[NAVER-MASS] \u26A0\uFE0F \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uD0C0\uC784\uC544\uC6C3 (".concat(url.substring(0, 50), "...)"));
                            }
                        }, 15000);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('puppeteer'); })];
                    case 2:
                        puppeteer = _b.sent();
                        return [4 /*yield*/, puppeteer.launch({
                                headless: 'new',
                                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
                            })];
                    case 3:
                        browser = _b.sent();
                        return [4 /*yield*/, browser.newPage()];
                    case 4:
                        page = _b.sent();
                        // 타임아웃 단축 및 domcontentloaded로 변경 (더 빠름)
                        return [4 /*yield*/, page.goto(url, {
                                waitUntil: 'domcontentloaded', // networkidle0 대신 domcontentloaded 사용
                                timeout: 15000 // 30초 -> 15초로 단축
                            })];
                    case 5:
                        // 타임아웃 단축 및 domcontentloaded로 변경 (더 빠름)
                        _b.sent();
                        return [4 /*yield*/, page.evaluate(function () {
                                var mainContent = document.querySelector('.se-main-container') ||
                                    document.querySelector('#postViewArea') ||
                                    document.querySelector('.post-view') ||
                                    document.querySelector('.post-content');
                                return {
                                    html: (mainContent === null || mainContent === void 0 ? void 0 : mainContent.innerHTML) || '',
                                    text: (mainContent === null || mainContent === void 0 ? void 0 : mainContent.innerText) || '',
                                    images: Array.from(document.querySelectorAll('img'))
                                        .map(function (img) { return img.src; })
                                        .filter(function (src) { return src && !src.includes('data:'); }),
                                    wordCount: (mainContent === null || mainContent === void 0 ? void 0 : mainContent.innerText.length) || 0
                                };
                            })];
                    case 6:
                        content = _b.sent();
                        clearTimeout(timeoutId);
                        return [4 /*yield*/, browser.close()];
                    case 7:
                        _b.sent();
                        browser = null;
                        return [2 /*return*/, content];
                    case 8:
                        error_3 = _b.sent();
                        if (!browser) return [3 /*break*/, 12];
                        _b.label = 9;
                    case 9:
                        _b.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, browser.close()];
                    case 10:
                        _b.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        closeError_1 = _b.sent();
                        return [3 /*break*/, 12];
                    case 12:
                        // 타임아웃 에러는 조용히 처리 (너무 많은 로그 방지)
                        if ((error_3 === null || error_3 === void 0 ? void 0 : error_3.name) === 'TimeoutError' || ((_a = error_3 === null || error_3 === void 0 ? void 0 : error_3.message) === null || _a === void 0 ? void 0 : _a.includes('timeout'))) {
                            console.warn("[NAVER-MASS] \u26A0\uFE0F \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uD0C0\uC784\uC544\uC6C3: ".concat(url.substring(0, 50), "..."));
                        }
                        else {
                            console.error("[NAVER-MASS] \u274C \uC804\uCCB4 \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(url), (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || error_3);
                        }
                        return [2 /*return*/, null];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    return NaverMassCrawler;
}());
exports.NaverMassCrawler = NaverMassCrawler;
/**
 * RSS 대량 크롤러 (수백개 피드)
 */
var MassRSSCrawler = /** @class */ (function () {
    function MassRSSCrawler() {
        // RSS 파서 초기화
        this.feedSources = this.loadFeedSources();
    }
    /**
     * 주요 RSS 피드 목록 로드 (100개 이상)
     */
    MassRSSCrawler.prototype.loadFeedSources = function () {
        return [
            // 🔧 네이버 검색 RSS (키워드 기반, 상위 노출 우선)
            'https://search.naver.com/search.naver?where=rss&query={keyword}&sort=1', // 정확도순 (상위 노출)
            'https://search.naver.com/search.naver?where=rss&query={keyword}&sm=tab_jum&sort=1',
            // 🔧 네이버 뉴스 RSS (키워드 검색, 최신순)
            'https://news.naver.com/main/search/searchRss.naver?query={keyword}&sort=1',
            'https://news.naver.com/main/search/searchRss.naver?query={keyword}&where=news&sort=1',
            // 🔧 네이버 블로그 RSS (키워드 검색, 정확도순)
            'https://search.naver.com/search.naver?where=post&query={keyword}&sm=tab_jum&sort=1',
            // 🔧 네이버 카페 RSS (키워드 검색)
            'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050146&search.searchBy=0&search.query={keyword}',
            'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050147&search.searchBy=0&search.query={keyword}',
            'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050148&search.searchBy=0&search.query={keyword}',
            // 🔧 네이버 뉴스 섹션별 RSS (최신 뉴스, 키워드 필터링은 나중에)
            'https://news.naver.com/main/rss/section.naver?sid=100', // 정치
            'https://news.naver.com/main/rss/section.naver?sid=101', // 경제
            'https://news.naver.com/main/rss/section.naver?sid=102', // 사회
            'https://news.naver.com/main/rss/section.naver?sid=103', // 생활/문화
            'https://news.naver.com/main/rss/section.naver?sid=104', // 세계
            'https://news.naver.com/main/rss/section.naver?sid=105', // IT/과학
            'https://news.naver.com/main/rss/section.naver?sid=106', // 연예
            'https://news.naver.com/main/rss/section.naver?sid=107', // 스포츠
            // 🔧 주요 언론사 RSS (최신 뉴스)
            'https://www.chosun.com/arc/outboundfeeds/rss/',
            'https://www.joongang.co.kr/rss/home.xml',
            'https://www.hani.co.kr/rss/',
            'https://www.donga.com/rss/',
            'https://www.mk.co.kr/rss/',
            'https://www.seoul.co.kr/rss/',
            'https://www.khan.co.kr/rss/',
            'https://www.ytn.co.kr/rss/',
            'https://www.sbs.co.kr/rss/',
            'https://www.kbs.co.kr/rss/',
            'https://www.mbc.co.kr/rss/',
            'https://www.newsis.com/rss/',
            'https://www.newstomato.com/rss/',
            'https://www.news1.kr/rss/',
            'https://www.edaily.co.kr/rss/',
            'https://www.fnnews.com/rss/',
            'https://www.asiae.co.kr/rss/',
            'https://www.etoday.co.kr/rss/',
            'https://www.zdnet.co.kr/rss/',
            'https://www.it.co.kr/rss/',
            // 🔧 전문 블로그 플랫폼 (키워드 기반)
            'https://medium.com/feed/tag/{keyword}',
            'https://brunch.co.kr/rss/search?q={keyword}',
            'https://velog.io/rss/tag/{keyword}',
            // 🔧 쇼핑몰 RSS (상품 정보)
            'https://shopping.naver.com/rss/search.naver?query={keyword}',
            // 🔧 Google News RSS (한국어)
            'https://news.google.com/rss/search?q={keyword}+when:1y&hl=ko&gl=KR&ceid=KR:ko',
            // 🔧 추가 RSS 소스 (최신 뉴스)
            'https://www.yonhapnews.co.kr/rss/',
            'https://www.mt.co.kr/rss/',
            'https://www.ajunews.com/rss/',
            'https://www.inews24.com/rss/',
            'https://www.ohmynews.com/rss/',
            'https://www.pressian.com/rss/',
            'https://www.huffingtonpost.kr/rss/',
            'https://www.bbc.com/korean/rss.xml',
            'https://www.voakorea.com/rss',
            // 총 50개 이상의 RSS 소스
        ];
    };
    /**
     * 모든 RSS 피드에서 대량 크롤링
     */
    MassRSSCrawler.prototype.crawlAll = function (keyword_1) {
        return __awaiter(this, arguments, void 0, function (keyword, maxResults // RSS 기본값 대폭 증가
        ) {
            var feedUrls, limiter, promises, results, allItems, keywordLower, keywordWords, filtered, unique, sorted, finalResults;
            var _this = this;
            if (maxResults === void 0) { maxResults = 10000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("[RSS-MASS] \uD83D\uDE80 RSS \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(keyword, "\" (\uBAA9\uD45C: ").concat(maxResults, "\uAC1C)"));
                        feedUrls = this.feedSources.map(function (url) {
                            return url.replace('{keyword}', encodeURIComponent(keyword));
                        });
                        console.log("[RSS-MASS] \uD83D\uDCCA ".concat(feedUrls.length, "\uAC1C RSS \uD53C\uB4DC \uBCD1\uB82C \uD06C\uB864\uB9C1..."));
                        limiter = (0, p_limit_1.default)(100);
                        promises = feedUrls.map(function (url) {
                            return limiter(function () { return _this.fetchFeed(url).catch(function (_e) { return []; }); });
                        });
                        return [4 /*yield*/, Promise.all(promises)];
                    case 1:
                        results = _a.sent();
                        allItems = results.flat();
                        console.log("[RSS-MASS] \uD83D\uDCE6 \uC6D0\uBCF8 \uC218\uC9D1: ".concat(allItems.length, "\uAC1C"));
                        keywordLower = keyword.toLowerCase();
                        keywordWords = keywordLower.split(/\s+/).filter(function (w) { return w.length > 1; });
                        filtered = allItems.filter(function (item) {
                            var titleLower = item.title.toLowerCase();
                            var descLower = (item.description || '').toLowerCase();
                            var combined = "".concat(titleLower, " ").concat(descLower);
                            // 전체 키워드 포함 또는 키워드 단어 중 하나라도 포함하면 통과
                            return combined.includes(keywordLower) ||
                                keywordWords.some(function (word) { return combined.includes(word); });
                        });
                        console.log("[RSS-MASS] \uD83D\uDD0D \uD0A4\uC6CC\uB4DC \uD544\uD130\uB9C1: ".concat(filtered.length, "\uAC1C (\uC6D0\uBCF8: ").concat(allItems.length, "\uAC1C)"));
                        unique = this.deduplicateByUrl(filtered);
                        console.log("[RSS-MASS] \uD83D\uDDD1\uFE0F \uC911\uBCF5 \uC81C\uAC70: ".concat(unique.length, "\uAC1C (\uC81C\uAC70: ").concat(filtered.length - unique.length, "\uAC1C)"));
                        sorted = unique.sort(function (a, b) {
                            // 인기도 점수가 높은 순서 우선
                            if (Math.abs(b.popularityScore - a.popularityScore) > 50) {
                                return b.popularityScore - a.popularityScore;
                            }
                            // 인기도가 비슷하면 최신순
                            return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
                        });
                        finalResults = sorted.slice(0, maxResults);
                        console.log("[RSS-MASS] \u2705 RSS \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(finalResults.length, "\uAC1C"));
                        return [2 /*return*/, finalResults];
                }
            });
        });
    };
    /**
     * 단일 RSS 피드 크롤링
     */
    MassRSSCrawler.prototype.fetchFeed = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var response, xmlText, items_1, rssItemMatches, atomEntryMatches, allMatches, _a, allMatches_1, match, titleMatch, title, linkMatch, link, descMatch, description, pubDateMatch, pubDate, authorMatch, author, $_1, error_4;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, axios_1.default.get(url, {
                                timeout: 10000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            })];
                    case 1:
                        response = _b.sent();
                        xmlText = response.data;
                        items_1 = [];
                        rssItemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
                        atomEntryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
                        allMatches = __spreadArray(__spreadArray([], rssItemMatches, true), atomEntryMatches, true);
                        for (_a = 0, allMatches_1 = allMatches; _a < allMatches_1.length; _a++) {
                            match = allMatches_1[_a];
                            titleMatch = match.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
                            title = ((titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[1]) || (titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[2]) || '').trim();
                            linkMatch = match.match(/<link[^>]*>(.*?)<\/link>|<link[^>]*href=["'](.*?)["'][^>]*\/>|<link[^>]*href=["'](.*?)["'][^>]*>/i);
                            link = ((linkMatch === null || linkMatch === void 0 ? void 0 : linkMatch[1]) || (linkMatch === null || linkMatch === void 0 ? void 0 : linkMatch[2]) || (linkMatch === null || linkMatch === void 0 ? void 0 : linkMatch[3]) || '').trim();
                            descMatch = match.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>|<content[^>]*type=["']html["'][^>]*><!\[CDATA\[(.*?)\]\]><\/content>|<content[^>]*type=["']html["'][^>]*>(.*?)<\/content>|<summary>(.*?)<\/summary>/i);
                            description = ((descMatch === null || descMatch === void 0 ? void 0 : descMatch[1]) || (descMatch === null || descMatch === void 0 ? void 0 : descMatch[2]) || (descMatch === null || descMatch === void 0 ? void 0 : descMatch[3]) || (descMatch === null || descMatch === void 0 ? void 0 : descMatch[4]) || (descMatch === null || descMatch === void 0 ? void 0 : descMatch[5]) || '').trim();
                            pubDateMatch = match.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>|<dc:date>(.*?)<\/dc:date>|<updated>(.*?)<\/updated>/i);
                            pubDate = ((pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[1]) || (pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[2]) || (pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[3]) || (pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[4]) || new Date().toISOString()).trim();
                            authorMatch = match.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>|<dc:creator>(.*?)<\/dc:creator>|<author>(.*?)<\/author>/i);
                            author = ((authorMatch === null || authorMatch === void 0 ? void 0 : authorMatch[1]) || (authorMatch === null || authorMatch === void 0 ? void 0 : authorMatch[2]) || (authorMatch === null || authorMatch === void 0 ? void 0 : authorMatch[3]) || '').trim();
                            if (title && link && title.length >= 3) {
                                items_1.push({
                                    title: this.cleanText(title),
                                    description: this.cleanText(description),
                                    link: link,
                                    pubDate: pubDate || new Date().toISOString(),
                                    author: author,
                                    source: 'rss',
                                    popularityScore: this.calculateRSSScore(title, description, pubDate)
                                });
                            }
                        }
                        // 🔧 cheerio로도 추가 파싱 시도 (fallback)
                        if (items_1.length === 0) {
                            try {
                                $_1 = cheerio.load(xmlText, { xmlMode: true });
                                $_1('item, entry').each(function (_i, el) {
                                    var $el = $_1(el);
                                    var title = $el.find('title').text().trim();
                                    var link = $el.find('link').text().trim() || $el.find('link').attr('href') || '';
                                    var description = $el.find('description, content, summary').text().trim();
                                    var pubDate = $el.find('pubDate, published, updated').text().trim();
                                    if (title && link && title.length >= 3) {
                                        items_1.push({
                                            title: _this.cleanText(title),
                                            description: _this.cleanText(description),
                                            link: link,
                                            pubDate: pubDate || new Date().toISOString(),
                                            author: '',
                                            source: 'rss',
                                            popularityScore: _this.calculateRSSScore(title, description, pubDate)
                                        });
                                    }
                                });
                            }
                            catch (cheerioError) {
                                console.error("[RSS-MASS] Cheerio \uD30C\uC2F1 \uC2E4\uD328: ".concat(url), cheerioError);
                            }
                        }
                        return [2 /*return*/, items_1];
                    case 2:
                        error_4 = _b.sent();
                        console.error("[RSS-MASS] \uD53C\uB4DC \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(url), error_4);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * RSS 아이템 점수 계산 (상위 노출 우선)
     */
    MassRSSCrawler.prototype.calculateRSSScore = function (title, description, pubDate) {
        var score = 0;
        // 🔧 상위 노출 지표 가중치 증가
        // 제목 길이 (적절한 길이의 제목이 상위 노출 가능성 높음)
        if (title.length >= 20 && title.length <= 60)
            score += 30;
        // 인기 키워드 포함 (상위 노출 키워드)
        var topKeywords = ['방법', '추천', '비교', '후기', '가격', '할인', '무료', '최신', '2025', '완벽', '가이드', '꿀팁', '비밀', '노하우'];
        topKeywords.forEach(function (keyword) {
            if (title.includes(keyword))
                score += 25;
            if (description === null || description === void 0 ? void 0 : description.includes(keyword))
                score += 15;
        });
        // 설명 길이 (충분한 설명이 있는 글이 상위 노출 가능성 높음)
        if (description && description.length >= 100)
            score += 20;
        // 최신성 (최근 1개월 내 글이 상위 노출 가능성 높음)
        // 최신성
        if (pubDate) {
            var pubDateObj = new Date(pubDate);
            var now = new Date();
            var daysOld = (now.getTime() - pubDateObj.getTime()) / (1000 * 60 * 60 * 24);
            if (daysOld < 1)
                score += 100;
            else if (daysOld < 7)
                score += 50;
            else if (daysOld < 30)
                score += 20;
        }
        // 제목과 설명 길이
        score += title.length / 10;
        score += description.length / 50;
        return score;
    };
    /**
     * URL 기준 중복 제거
     */
    MassRSSCrawler.prototype.deduplicateByUrl = function (items) {
        var seen = new Set();
        return items.filter(function (item) {
            if (seen.has(item.link))
                return false;
            seen.add(item.link);
            return true;
        });
    };
    /**
     * 텍스트 정리
     */
    MassRSSCrawler.prototype.cleanText = function (text) {
        return text
            .replace(/<[^>]*>/g, '') // HTML 태그 제거
            .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .trim();
    };
    return MassRSSCrawler;
}());
exports.MassRSSCrawler = MassRSSCrawler;
/**
 * Google CSE 대량 크롤러
 */
var GoogleCSEMassCrawler = /** @class */ (function () {
    function GoogleCSEMassCrawler(apiKey, cseId) {
        this.apiKey = apiKey;
        this.cseId = cseId;
    }
    /**
     * Google CSE 대량 검색
     */
    GoogleCSEMassCrawler.prototype.search = function (keyword_1) {
        return __awaiter(this, arguments, void 0, function (keyword, options) {
            var _a, maxResults, _b, dateRestrict, _c, siteSearch, results, perPage, pages, safeCSERequest, _loop_4, i, state_2;
            var _this = this;
            var _d, _f;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _a = options.maxResults, maxResults = _a === void 0 ? 100 : _a, _b = options.dateRestrict, dateRestrict = _b === void 0 ? 'y1' : _b, _c = options.siteSearch, siteSearch = _c === void 0 ? 'blog.naver.com OR tistory.com OR *.co.kr' : _c;
                        console.log("[CSE-MASS] \uD83D\uDE80 Google CSE \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(keyword, "\" (\uBAA9\uD45C: ").concat(maxResults, "\uAC1C)"));
                        results = [];
                        perPage = 10;
                        pages = Math.ceil(maxResults / perPage);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/google-cse-rate-limiter'); })];
                    case 1:
                        safeCSERequest = (_g.sent()).safeCSERequest;
                        _loop_4 = function (i) {
                            var start, cacheKey, response, items, error_5;
                            return __generator(this, function (_h) {
                                switch (_h.label) {
                                    case 0:
                                        start = i * perPage + 1;
                                        _h.label = 1;
                                    case 1:
                                        _h.trys.push([1, 3, , 4]);
                                        cacheKey = "mass-cse:".concat(keyword, ":").concat(start);
                                        return [4 /*yield*/, safeCSERequest("".concat(keyword, " (page ").concat(start, ")"), function () { return __awaiter(_this, void 0, void 0, function () {
                                                var res;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, axios_1.default.get('https://www.googleapis.com/customsearch/v1', {
                                                                params: {
                                                                    key: this.apiKey,
                                                                    cx: this.cseId,
                                                                    q: keyword,
                                                                    start: start,
                                                                    num: perPage,
                                                                    dateRestrict: dateRestrict,
                                                                    siteSearch: siteSearch,
                                                                    lr: 'lang_ko'
                                                                },
                                                                timeout: 10000
                                                            })];
                                                        case 1:
                                                            res = _a.sent();
                                                            return [2 /*return*/, res.data];
                                                    }
                                                });
                                            }); }, { useCache: true, cacheKey: cacheKey, priority: 'low' })];
                                    case 2:
                                        response = _h.sent();
                                        if (response.items) {
                                            items = response.items.map(function (item) {
                                                var _a, _b, _c;
                                                return ({
                                                    title: _this.cleanText(item.title),
                                                    description: _this.cleanText(item.snippet),
                                                    link: item.link,
                                                    pubDate: ((_c = (_b = (_a = item.pagemap) === null || _a === void 0 ? void 0 : _a.metatags) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c['article:published_time']) || new Date().toISOString(),
                                                    source: 'cse',
                                                    popularityScore: _this.calculateCSEScore(item)
                                                });
                                            });
                                            results.push.apply(results, items);
                                            console.log("[CSE-MASS] \uD83D\uDCCA \uD398\uC774\uC9C0 ".concat(i + 1, "/").concat(pages, " \uC644\uB8CC: ").concat(items.length, "\uAC1C"));
                                        }
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_5 = _h.sent();
                                        // Rate Limit 오류인 경우 중단
                                        if (((_d = error_5 === null || error_5 === void 0 ? void 0 : error_5.message) === null || _d === void 0 ? void 0 : _d.includes('Rate Limit')) || ((_f = error_5 === null || error_5 === void 0 ? void 0 : error_5.message) === null || _f === void 0 ? void 0 : _f.includes('할당량'))) {
                                            console.warn("[CSE-MASS] \uD560\uB2F9\uB7C9 \uCD08\uACFC\uB85C \uC911\uB2E8: ".concat(error_5.message));
                                            return [2 /*return*/, "break"];
                                        }
                                        console.error("[CSE-MASS] \uD398\uC774\uC9C0 ".concat(i + 1, " \uC2E4\uD328:"), error_5);
                                        return [2 /*return*/, "break"];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _g.label = 2;
                    case 2:
                        if (!(i < pages)) return [3 /*break*/, 5];
                        return [5 /*yield**/, _loop_4(i)];
                    case 3:
                        state_2 = _g.sent();
                        if (state_2 === "break")
                            return [3 /*break*/, 5];
                        _g.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 2];
                    case 5:
                        console.log("[CSE-MASS] \u2705 CSE \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(results.length, "\uAC1C"));
                        return [2 /*return*/, results];
                }
            });
        });
    };
    /**
     * CSE 아이템 점수 계산
     */
    GoogleCSEMassCrawler.prototype.calculateCSEScore = function (item) {
        var score = 0;
        // 제목 길이
        score += item.title.length / 10;
        // 설명 길이
        score += item.snippet.length / 50;
        // 검색 순위 (낮을수록 높은 점수)
        if (item.index !== undefined) {
            score += (100 - item.index) * 2;
        }
        return score;
    };
    /**
     * 텍스트 정리
     */
    GoogleCSEMassCrawler.prototype.cleanText = function (text) {
        return text
            .replace(/<[^>]*>/g, '') // HTML 태그 제거
            .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .trim();
    };
    return GoogleCSEMassCrawler;
}());
exports.GoogleCSEMassCrawler = GoogleCSEMassCrawler;
/**
 * 통합 대량 크롤링 시스템
 */
var MassCrawlingSystem = /** @class */ (function () {
    function MassCrawlingSystem(naverClientId, naverClientSecret, googleApiKey, googleCseId) {
        this.performanceMonitor = new PerformanceMonitor();
        this.logger = new Logger('MassCrawlingSystem');
        if (naverClientId && naverClientSecret) {
            this.naverCrawler = new NaverMassCrawler(naverClientId, naverClientSecret);
            this.logger.info('네이버 크롤러 초기화 완료');
        }
        this.rssCrawler = new MassRSSCrawler();
        this.logger.info('RSS 크롤러 초기화 완료');
        if (googleApiKey && googleCseId) {
            this.cseCrawler = new GoogleCSEMassCrawler(googleApiKey, googleCseId);
            this.logger.info('Google CSE 크롤러 초기화 완료');
        }
        this.logger.success('대량 크롤링 시스템 초기화 완료');
    }
    /**
     * 통합 대량 크롤링 실행
     */
    MassCrawlingSystem.prototype.crawlAll = function (keyword_1) {
        return __awaiter(this, arguments, void 0, function (keyword, options) {
            var startTime, _a, maxResults, _b, enableFullContent, _c, maxConcurrent, _d, manualUrls, allItems, naverCount, rssCount, cseCount, manualItems, _f, manualUrls_1, url, fullContent, text, response, $, title, metaDesc, firstP, description, fetchError_1, error_6, error_7, naverStartTime, naverTarget, naverResults, naverDuration, error_8, naverDuration, rssStartTime, rssTarget, rssResults, rssDuration, error_9, rssDuration, cseStartTime, cseTarget, cseResults, cseDuration, error_10, cseDuration, uniqueItems, duplicatesRemoved, fullContentCount, fullContentLimit, topItems_1, limiter_1, results, failedCount, processingTime, stats;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        this.performanceMonitor.startMeasurement('total-crawl');
                        startTime = Date.now();
                        _a = options.maxResults, maxResults = _a === void 0 ? 10000 : _a, _b = options.enableFullContent, enableFullContent = _b === void 0 ? false : _b, _c = options.maxConcurrent, maxConcurrent = _c === void 0 ? 20 : _c, _d = options.manualUrls, manualUrls = _d === void 0 ? [] // 수동 크롤링 링크
                         : _d;
                        this.logger.info("\uD1B5\uD569 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(keyword, "\""));
                        this.logger.info("\uBAA9\uD45C: ".concat(maxResults, "\uAC1C, \uC804\uCCB4 \uBCF8\uBB38: ").concat(enableFullContent ? 'ON' : 'OFF'));
                        if (manualUrls && manualUrls.length > 0) {
                            this.logger.info("\uD83D\uDCCB \uC218\uB3D9 \uD06C\uB864\uB9C1 \uB9C1\uD06C ".concat(manualUrls.length, "\uAC1C \uAC10\uC9C0\uB428"));
                            console.log("[MASS-CRAWLER] \uD83D\uDCCB \uC218\uB3D9 \uD06C\uB864\uB9C1 \uB9C1\uD06C:", manualUrls);
                        }
                        allItems = [];
                        naverCount = 0;
                        rssCount = 0;
                        cseCount = 0;
                        if (!(manualUrls && manualUrls.length > 0 && this.naverCrawler)) return [3 /*break*/, 13];
                        console.log("[MASS-CRAWLER] \uD83D\uDD17 \uC218\uB3D9 \uD06C\uB864\uB9C1 \uB9C1\uD06C \uCC98\uB9AC \uC2DC\uC791...");
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 12, , 13]);
                        manualItems = [];
                        _f = 0, manualUrls_1 = manualUrls;
                        _g.label = 2;
                    case 2:
                        if (!(_f < manualUrls_1.length)) return [3 /*break*/, 11];
                        url = manualUrls_1[_f];
                        _g.label = 3;
                    case 3:
                        _g.trys.push([3, 9, , 10]);
                        if (!url || !url.trim())
                            return [3 /*break*/, 10];
                        console.log("[MASS-CRAWLER] \uD83D\uDD17 \uC218\uB3D9 \uB9C1\uD06C \uD06C\uB864\uB9C1: ".concat(url));
                        if (!enableFullContent) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.naverCrawler.fetchFullContent(url)];
                    case 4:
                        fullContent = _g.sent();
                        if (fullContent) {
                            text = fullContent.text || '';
                            manualItems.push({
                                title: (text.length > 0 ? text.substring(0, 100) : '수동 크롤링 콘텐츠') || '수동 크롤링 콘텐츠',
                                description: (text.length > 0 ? text.substring(0, 300) : '') || '',
                                link: url,
                                pubDate: new Date().toISOString(),
                                source: 'manual',
                                popularityScore: 1000, // 수동 링크는 최우선순위
                                fullContent: {
                                    html: fullContent.html || '',
                                    text: text,
                                    images: fullContent.images || [],
                                    wordCount: fullContent.wordCount || 0
                                }
                            });
                            console.log("[MASS-CRAWLER] \u2705 \uC218\uB3D9 \uB9C1\uD06C \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(url, " (").concat(fullContent.wordCount, "\uC790)"));
                        }
                        return [3 /*break*/, 8];
                    case 5:
                        _g.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, axios_1.default.get(url, {
                                timeout: 10000,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                }
                            })];
                    case 6:
                        response = _g.sent();
                        $ = cheerio.load(response.data);
                        title = ($('title').text() || $('h1').first().text() || '수동 크롤링 콘텐츠').trim();
                        metaDesc = $('meta[name="description"]').attr('content') || '';
                        firstP = $('p').first().text() || '';
                        description = (metaDesc || (firstP.length > 0 ? firstP.substring(0, 300) : '')).trim();
                        manualItems.push({
                            title: title,
                            description: description,
                            link: url,
                            pubDate: new Date().toISOString(),
                            source: 'manual',
                            popularityScore: 1000 // 수동 링크는 최우선순위
                        });
                        console.log("[MASS-CRAWLER] \u2705 \uC218\uB3D9 \uB9C1\uD06C \uAE30\uBCF8 \uC815\uBCF4 \uC218\uC9D1 \uC644\uB8CC: ".concat(url));
                        return [3 /*break*/, 8];
                    case 7:
                        fetchError_1 = _g.sent();
                        console.warn("[MASS-CRAWLER] \u26A0\uFE0F \uC218\uB3D9 \uB9C1\uD06C \uAE30\uBCF8 \uD06C\uB864\uB9C1 \uC2E4\uD328 (".concat(url, "):"), (fetchError_1 === null || fetchError_1 === void 0 ? void 0 : fetchError_1.message) || fetchError_1);
                        return [3 /*break*/, 8];
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_6 = _g.sent();
                        console.error("[MASS-CRAWLER] \u274C \uC218\uB3D9 \uB9C1\uD06C \uD06C\uB864\uB9C1 \uC2E4\uD328 (".concat(url, "):"), (error_6 === null || error_6 === void 0 ? void 0 : error_6.message) || error_6);
                        return [3 /*break*/, 10];
                    case 10:
                        _f++;
                        return [3 /*break*/, 2];
                    case 11:
                        if (manualItems.length > 0) {
                            allItems.push.apply(allItems, manualItems);
                            console.log("[MASS-CRAWLER] \u2705 \uC218\uB3D9 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(manualItems.length, "\uAC1C \uD56D\uBAA9 \uCD94\uAC00"));
                            this.logger.success("\uC218\uB3D9 \uD06C\uB864\uB9C1: ".concat(manualItems.length, "\uAC1C"));
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        error_7 = _g.sent();
                        console.error("[MASS-CRAWLER] \u274C \uC218\uB3D9 \uD06C\uB864\uB9C1 \uCC98\uB9AC \uC624\uB958:", (error_7 === null || error_7 === void 0 ? void 0 : error_7.message) || error_7);
                        return [3 /*break*/, 13];
                    case 13:
                        if (!this.naverCrawler) return [3 /*break*/, 18];
                        console.log("[MASS-CRAWLER-DEBUG] \uD83D\uDD04 \uB124\uC774\uBC84 API \uD06C\uB864\uB9C1 \uC2DC\uC791...");
                        naverStartTime = Date.now();
                        this.performanceMonitor.startMeasurement('naver-crawl');
                        _g.label = 14;
                    case 14:
                        _g.trys.push([14, 16, , 17]);
                        naverTarget = Math.floor(maxResults * 0.5);
                        console.log("[MASS-CRAWLER-DEBUG]    \uBAA9\uD45C \uD56D\uBAA9: ".concat(naverTarget, "\uAC1C"));
                        return [4 /*yield*/, this.naverCrawler.crawlMassive(keyword, { maxResults: naverTarget, includeViews: true })];
                    case 15:
                        naverResults = _g.sent();
                        naverCount = naverResults.length;
                        allItems.push.apply(allItems, naverResults);
                        naverDuration = Date.now() - naverStartTime;
                        this.performanceMonitor.endMeasurement('naver-crawl', { items: naverCount });
                        console.log("[MASS-CRAWLER-DEBUG] \u2705 \uB124\uC774\uBC84 API \uC644\uB8CC (".concat((naverDuration / 1000).toFixed(2), "\uCD08): ").concat(naverCount, "\uAC1C"));
                        console.log("[MassCrawlingSystem] \u2139\uFE0F \uB124\uC774\uBC84 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(naverCount, "\uAC1C \uCD94\uCD9C"));
                        this.logger.success("\uB124\uC774\uBC84 API: ".concat(naverCount, "\uAC1C"));
                        return [3 /*break*/, 17];
                    case 16:
                        error_8 = _g.sent();
                        naverDuration = Date.now() - naverStartTime;
                        this.performanceMonitor.endMeasurement('naver-crawl');
                        console.error("[MASS-CRAWLER-DEBUG] \u274C \uB124\uC774\uBC84 API \uC2E4\uD328 (".concat((naverDuration / 1000).toFixed(2), "\uCD08):"));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uD0C0\uC785: ".concat((error_8 === null || error_8 === void 0 ? void 0 : error_8.name) || 'Unknown'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uBA54\uC2DC\uC9C0: ".concat((error_8 === null || error_8 === void 0 ? void 0 : error_8.message) || String(error_8)));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uCF54\uB4DC: ".concat((error_8 === null || error_8 === void 0 ? void 0 : error_8.code) || 'N/A'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uC2A4\uD0DD:", (error_8 === null || error_8 === void 0 ? void 0 : error_8.stack) || 'N/A');
                        this.logger.error('네이버 API 실패:', error_8);
                        return [3 /*break*/, 17];
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        console.log("[MASS-CRAWLER-DEBUG] \u26A0\uFE0F \uB124\uC774\uBC84 \uD06C\uB864\uB7EC\uAC00 \uCD08\uAE30\uD654\uB418\uC9C0 \uC54A\uC74C");
                        _g.label = 19;
                    case 19:
                        // 2차: RSS (대량 병렬)
                        console.log("[MASS-CRAWLER-DEBUG] \uD83D\uDD04 RSS \uD06C\uB864\uB9C1 \uC2DC\uC791...");
                        rssStartTime = Date.now();
                        this.performanceMonitor.startMeasurement('rss-crawl');
                        _g.label = 20;
                    case 20:
                        _g.trys.push([20, 22, , 23]);
                        rssTarget = Math.floor(maxResults * 0.3);
                        console.log("[MASS-CRAWLER-DEBUG]    \uBAA9\uD45C \uD56D\uBAA9: ".concat(rssTarget, "\uAC1C"));
                        return [4 /*yield*/, this.rssCrawler.crawlAll(keyword, rssTarget)];
                    case 21:
                        rssResults = _g.sent();
                        rssCount = rssResults.length;
                        allItems.push.apply(allItems, rssResults);
                        rssDuration = Date.now() - rssStartTime;
                        this.performanceMonitor.endMeasurement('rss-crawl', { items: rssCount });
                        console.log("[MASS-CRAWLER-DEBUG] \u2705 RSS \uC644\uB8CC (".concat((rssDuration / 1000).toFixed(2), "\uCD08): ").concat(rssCount, "\uAC1C"));
                        console.log("[MassCrawlingSystem] \u2139\uFE0F RSS \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(rssCount, "\uAC1C \uCD94\uCD9C"));
                        this.logger.success("RSS: ".concat(rssCount, "\uAC1C"));
                        return [3 /*break*/, 23];
                    case 22:
                        error_9 = _g.sent();
                        rssDuration = Date.now() - rssStartTime;
                        this.performanceMonitor.endMeasurement('rss-crawl');
                        console.error("[MASS-CRAWLER-DEBUG] \u274C RSS \uC2E4\uD328 (".concat((rssDuration / 1000).toFixed(2), "\uCD08):"));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uD0C0\uC785: ".concat((error_9 === null || error_9 === void 0 ? void 0 : error_9.name) || 'Unknown'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uBA54\uC2DC\uC9C0: ".concat((error_9 === null || error_9 === void 0 ? void 0 : error_9.message) || String(error_9)));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uCF54\uB4DC: ".concat((error_9 === null || error_9 === void 0 ? void 0 : error_9.code) || 'N/A'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uC2A4\uD0DD:", (error_9 === null || error_9 === void 0 ? void 0 : error_9.stack) || 'N/A');
                        this.logger.error('RSS 실패:', error_9);
                        return [3 /*break*/, 23];
                    case 23:
                        if (!(this.cseCrawler && allItems.length < maxResults * 0.8)) return [3 /*break*/, 28];
                        console.log("[MASS-CRAWLER-DEBUG] \uD83D\uDD04 CSE \uD06C\uB864\uB9C1 \uC2DC\uC791...");
                        cseStartTime = Date.now();
                        this.performanceMonitor.startMeasurement('cse-crawl');
                        _g.label = 24;
                    case 24:
                        _g.trys.push([24, 26, , 27]);
                        cseTarget = Math.floor(maxResults * 0.2);
                        console.log("[MASS-CRAWLER-DEBUG]    \uBAA9\uD45C \uD56D\uBAA9: ".concat(cseTarget, "\uAC1C"));
                        return [4 /*yield*/, this.cseCrawler.search(keyword, { maxResults: cseTarget })];
                    case 25:
                        cseResults = _g.sent();
                        cseCount = cseResults.length;
                        allItems.push.apply(allItems, cseResults);
                        cseDuration = Date.now() - cseStartTime;
                        this.performanceMonitor.endMeasurement('cse-crawl', { items: cseCount });
                        console.log("[MASS-CRAWLER-DEBUG] \u2705 CSE \uC644\uB8CC (".concat((cseDuration / 1000).toFixed(2), "\uCD08): ").concat(cseCount, "\uAC1C"));
                        console.log("[MassCrawlingSystem] \u2139\uFE0F Google CSE \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(cseCount, "\uAC1C \uCD94\uCD9C"));
                        this.logger.success("CSE: ".concat(cseCount, "\uAC1C"));
                        return [3 /*break*/, 27];
                    case 26:
                        error_10 = _g.sent();
                        cseDuration = Date.now() - cseStartTime;
                        this.performanceMonitor.endMeasurement('cse-crawl');
                        console.error("[MASS-CRAWLER-DEBUG] \u274C CSE \uC2E4\uD328 (".concat((cseDuration / 1000).toFixed(2), "\uCD08):"));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uD0C0\uC785: ".concat((error_10 === null || error_10 === void 0 ? void 0 : error_10.name) || 'Unknown'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uBA54\uC2DC\uC9C0: ".concat((error_10 === null || error_10 === void 0 ? void 0 : error_10.message) || String(error_10)));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uCF54\uB4DC: ".concat((error_10 === null || error_10 === void 0 ? void 0 : error_10.code) || 'N/A'));
                        console.error("[MASS-CRAWLER-DEBUG]    \uC5D0\uB7EC \uC2A4\uD0DD:", (error_10 === null || error_10 === void 0 ? void 0 : error_10.stack) || 'N/A');
                        this.logger.error('CSE 실패:', error_10);
                        return [3 /*break*/, 27];
                    case 27: return [3 /*break*/, 29];
                    case 28:
                        if (!this.cseCrawler) {
                            console.log("[MASS-CRAWLER-DEBUG] \u26A0\uFE0F CSE \uD06C\uB864\uB7EC\uAC00 \uCD08\uAE30\uD654\uB418\uC9C0 \uC54A\uC74C");
                        }
                        else {
                            console.log("[MASS-CRAWLER-DEBUG] \u26A0\uFE0F CSE \uAC74\uB108\uB700 (\uC774\uBBF8 \uCDA9\uBD84\uD55C \uB370\uC774\uD130: ".concat(allItems.length, "/").concat(maxResults * 0.8, ")"));
                        }
                        _g.label = 29;
                    case 29:
                        // 중복 제거 및 정렬
                        this.performanceMonitor.startMeasurement('deduplication');
                        uniqueItems = this.deduplicateAndSort(allItems);
                        duplicatesRemoved = allItems.length - uniqueItems.length;
                        this.performanceMonitor.endMeasurement('deduplication', {
                            original: allItems.length,
                            unique: uniqueItems.length,
                            removed: duplicatesRemoved
                        });
                        this.logger.info("\uC911\uBCF5 \uC81C\uAC70: ".concat(duplicatesRemoved, "\uAC1C \uC81C\uAC70"));
                        this.logger.info("\uCD5C\uC885 \uC218\uC9D1: ".concat(uniqueItems.length, "\uAC1C"));
                        fullContentCount = 0;
                        if (!(enableFullContent && this.naverCrawler)) return [3 /*break*/, 31];
                        this.performanceMonitor.startMeasurement('full-content-crawl');
                        this.logger.info('전체 본문 크롤링 시작...');
                        fullContentLimit = Math.min(10, maxConcurrent);
                        topItems_1 = uniqueItems.slice(0, fullContentLimit);
                        limiter_1 = (0, p_limit_1.default)(Math.min(3, maxConcurrent));
                        console.log("[MassCrawlingSystem] \uD83D\uDCC4 \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uC2DC\uC791: ".concat(topItems_1.length, "\uAC1C \uD56D\uBAA9"));
                        return [4 /*yield*/, Promise.allSettled(topItems_1.map(function (item, index) {
                                return limiter_1(function () { return __awaiter(_this, void 0, void 0, function () {
                                    var fullContent, itemIndex, progress, error_11;
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0:
                                                _a.trys.push([0, 3, , 4]);
                                                if (!(item.source === 'naver' && this.naverCrawler)) return [3 /*break*/, 2];
                                                console.log("[MassCrawlingSystem] \uD83D\uDCC4 \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uC911 (".concat(index + 1, "/").concat(topItems_1.length, "): ").concat(item.link.substring(0, 50), "..."));
                                                return [4 /*yield*/, this.naverCrawler.fetchFullContent(item.link)];
                                            case 1:
                                                fullContent = _a.sent();
                                                if (fullContent) {
                                                    itemIndex = uniqueItems.findIndex(function (i) { return i.link === item.link; });
                                                    if (itemIndex !== -1 && uniqueItems[itemIndex]) {
                                                        uniqueItems[itemIndex].fullContent = fullContent;
                                                        fullContentCount++;
                                                        progress = Math.round((fullContentCount / topItems_1.length) * 100);
                                                        console.log("[MassCrawlingSystem] \u2139\uFE0F \uBCF8\uBB38 ".concat(fullContentCount, "/").concat(topItems_1.length, " \uC644\uB8CC (").concat(progress, "%)"));
                                                        this.logger.info("\uBCF8\uBB38 ".concat(fullContentCount, "/").concat(topItems_1.length, " \uC644\uB8CC"));
                                                    }
                                                }
                                                _a.label = 2;
                                            case 2: return [3 /*break*/, 4];
                                            case 3:
                                                error_11 = _a.sent();
                                                console.warn("[MassCrawlingSystem] \u26A0\uFE0F \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uC2E4\uD328 (".concat(index + 1, "/").concat(topItems_1.length, "):"), (error_11 === null || error_11 === void 0 ? void 0 : error_11.message) || error_11);
                                                return [3 /*break*/, 4];
                                            case 4: return [2 /*return*/];
                                        }
                                    });
                                }); });
                            }))];
                    case 30:
                        results = _g.sent();
                        failedCount = results.filter(function (r) { return r.status === 'rejected'; }).length;
                        if (failedCount > 0) {
                            console.warn("[MassCrawlingSystem] \u26A0\uFE0F \uBCF8\uBB38 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(failedCount, "/").concat(topItems_1.length, "\uAC1C"));
                        }
                        this.performanceMonitor.endMeasurement('full-content-crawl', { items: fullContentCount });
                        _g.label = 31;
                    case 31:
                        this.performanceMonitor.endMeasurement('total-crawl', {
                            totalItems: uniqueItems.length,
                            naverCount: naverCount,
                            rssCount: rssCount,
                            cseCount: cseCount,
                            fullContentCount: fullContentCount
                        });
                        processingTime = Date.now() - startTime;
                        stats = {
                            totalItems: uniqueItems.length,
                            naverCount: naverCount,
                            rssCount: rssCount,
                            cseCount: cseCount,
                            fullContentCount: fullContentCount,
                            duplicatesRemoved: duplicatesRemoved,
                            processingTimeMs: processingTime
                        };
                        console.log("[MASS-CRAWLER-DEBUG] \uD83D\uDCCA \uCD5C\uC885 \uD1B5\uACC4:");
                        console.log("[MASS-CRAWLER-DEBUG]    \uCD1D \uCC98\uB9AC \uC2DC\uAC04: ".concat((processingTime / 1000).toFixed(2), "\uCD08"));
                        console.log("[MASS-CRAWLER-DEBUG]    \uCD1D \uD56D\uBAA9 \uC218: ".concat(uniqueItems.length, "\uAC1C"));
                        console.log("[MASS-CRAWLER-DEBUG]    \uB124\uC774\uBC84: ".concat(naverCount, "\uAC1C"));
                        console.log("[MASS-CRAWLER-DEBUG]    RSS: ".concat(rssCount, "\uAC1C"));
                        console.log("[MASS-CRAWLER-DEBUG]    CSE: ".concat(cseCount, "\uAC1C"));
                        console.log("[MASS-CRAWLER-DEBUG]    \uC911\uBCF5 \uC81C\uAC70: ".concat(duplicatesRemoved, "\uAC1C"));
                        console.log("[MASS-CRAWLER-DEBUG]    \uC804\uCCB4 \uBCF8\uBB38: ".concat(fullContentCount, "\uAC1C"));
                        this.logger.success('통합 크롤링 완료!');
                        this.logger.info("\uD1B5\uACC4: ".concat(JSON.stringify(stats)));
                        this.performanceMonitor.printReport();
                        return [2 /*return*/, {
                                items: uniqueItems.slice(0, maxResults),
                                stats: stats
                            }];
                }
            });
        });
    };
    /**
     * 중복 제거 및 정렬
     */
    MassCrawlingSystem.prototype.deduplicateAndSort = function (items) {
        var seen = new Set();
        var unique = items.filter(function (item) {
            if (seen.has(item.link))
                return false;
            seen.add(item.link);
            return true;
        });
        return unique.sort(function (a, b) {
            // 인기도 점수 기반 정렬
            return b.popularityScore - a.popularityScore;
        });
    };
    return MassCrawlingSystem;
}());
exports.MassCrawlingSystem = MassCrawlingSystem;
