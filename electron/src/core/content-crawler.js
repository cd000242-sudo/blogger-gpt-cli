"use strict";
// src/core/content-crawler.ts
// 본문 내용 크롤링 및 AI 믹싱 시스템 (대량 크롤링 업그레이드)
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function (t) {
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
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
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
exports.ContentCrawler = void 0;
exports.crawlAndMixContent = crawlAndMixContent;
var generative_ai_1 = require("@google/generative-ai");
var openai_1 = require("openai");
var p_limit_1 = require("p-limit");
var mass_crawler_1 = require("./mass-crawler");
var ContentCrawler = /** @class */ (function () {
    function ContentCrawler(openaiKey, geminiKey) {
        if (openaiKey) {
            this.openai = new openai_1.default({ apiKey: openaiKey });
        }
        if (geminiKey) {
            this.gemini = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        }
    }
    /**
     * 대량 크롤링 시스템 초기화
     */
    ContentCrawler.prototype.initializeMassCrawler = function (naverClientId, naverClientSecret, googleApiKey, googleCseId) {
        this.massCrawler = new mass_crawler_1.MassCrawlingSystem(naverClientId, naverClientSecret, googleApiKey, googleCseId);
    };
    /**
     * 대량 크롤링 실행 (새로운 메서드)
     */
    ContentCrawler.prototype.crawlMassive = function (topic_1, keywords_1) {
        return __awaiter(this, arguments, void 0, function (topic, keywords, options) {
            var _a, items, stats, contents, ctas;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.massCrawler) {
                            throw new Error('대량 크롤링 시스템이 초기화되지 않았습니다. initializeMassCrawler()를 먼저 호출하세요.');
                        }
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDE80 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(topic, "\""));
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDD11 \uD0A4\uC6CC\uB4DC: ".concat(keywords.join(', ')));
                        return [4 /*yield*/, this.massCrawler.crawlAll(topic, __assign({ maxResults: 2000, enableFullContent: true, maxConcurrent: 20 }, options))];
                    case 1:
                        _a = _b.sent(), items = _a.items, stats = _a.stats;
                        contents = items.map(function (item) {
                            var _a;
                            return ({
                                title: item.title,
                                content: ((_a = item.fullContent) === null || _a === void 0 ? void 0 : _a.text) || item.description,
                                source: item.source,
                                platform: _this.mapSourceToPlatform(item.source),
                                relevance: Math.min(item.popularityScore / 10, 10), // 0-10 스케일로 변환
                                url: item.link,
                                publishDate: item.pubDate,
                                extractedData: _this.extractDataFromText(item.description)
                            });
                        });
                        return [4 /*yield*/, this.generateSmartCTAs(topic, keywords, contents)];
                    case 2:
                        ctas = _b.sent();
                        logMassCrawler('info', "[MASS-CRAWLER] \u2705 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(contents.length, "\uAC1C \uAE00, ").concat(ctas.length, "\uAC1C CTA"));
                        return [2 /*return*/, { contents: contents, ctas: ctas, stats: stats }];
                }
            });
        });
    };
    /**
     * 향상된 대량 크롤링 (여러 키워드 동시 처리)
     */
    ContentCrawler.prototype.crawlMassiveMultiKeyword = function (topic_1, keywords_1) {
        return __awaiter(this, arguments, void 0, function (topic, keywords, options) {
            var _a, _b, keywordConcurrency, rawOptions, sharedOptions, manualUrls, keywordLimiter, keywordTasks, startTime, results, endTime, duration, allItems, totalStats, uniqueItems, contents, analysis, ctas;
            var _this = this;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.massCrawler) {
                            throw new Error('대량 크롤링 시스템이 초기화되지 않았습니다.');
                        }
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDE80 \uB2E4\uC911 \uD0A4\uC6CC\uB4DC \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC791: \"".concat(topic, "\""));
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDD11 \uD0A4\uC6CC\uB4DC: ".concat(keywords.join(', ')));
                        _a = options, _b = _a.keywordConcurrency, keywordConcurrency = _b === void 0 ? Math.min(3, Math.max(1, keywords.length)) : _b, rawOptions = __rest(_a, ["keywordConcurrency"]);
                        sharedOptions = __assign({}, rawOptions);
                        manualUrls = rawOptions.manualUrls;
                        delete sharedOptions.manualUrls;
                        keywordLimiter = (0, p_limit_1.default)(Math.max(1, keywordConcurrency));
                        keywordTasks = keywords.map(function (keyword, index) {
                            return keywordLimiter(function () {
                                return __awaiter(_this, void 0, void 0, function () {
                                    var label, keywordStartTime, crawlOptions, result, keywordDuration, error_1, keywordDuration, errorMsg, detailParts, baseMessage;
                                    var _a, _b;
                                    return __generator(this, function (_c) {
                                        switch (_c.label) {
                                            case 0:
                                                label = "[".concat(index + 1, "/").concat(keywords.length, "]");
                                                logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDD11 ".concat(label, " \uD0A4\uC6CC\uB4DC \uD06C\uB864\uB9C1 \uC2DC\uC791: \"").concat(keyword, "\""));
                                                keywordStartTime = Date.now();
                                                crawlOptions = __assign(__assign(__assign({}, sharedOptions), { maxResults: Math.floor((sharedOptions.maxResults || 2000) / Math.max(1, keywords.length)) }), (index === 0 && manualUrls ? { manualUrls: manualUrls } : {}));
                                                _c.label = 1;
                                            case 1:
                                                _c.trys.push([1, 3, , 4]);
                                                return [4 /*yield*/, this.massCrawler.crawlAll(keyword, crawlOptions)];
                                            case 2:
                                                result = _c.sent();
                                                keywordDuration = Date.now() - keywordStartTime;
                                                logMassCrawler('info', "[MASS-CRAWLER] \u2705 ".concat(label, " \"").concat(keyword, "\" \uC644\uB8CC ").concat(result.items.length, "\uAC1C (").concat((keywordDuration / 1000).toFixed(2), "\uCD08)"));
                                                return [2 /*return*/, { index: index, keyword: keyword, result: result }];
                                            case 3:
                                                error_1 = _c.sent();
                                                keywordDuration = Date.now() - keywordStartTime;
                                                errorMsg = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1);
                                                detailParts = [
                                                    (error_1 === null || error_1 === void 0 ? void 0 : error_1.name) && "type=".concat(error_1.name),
                                                    (error_1 === null || error_1 === void 0 ? void 0 : error_1.code) && "code=".concat(error_1.code),
                                                    ((_a = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _a === void 0 ? void 0 : _a.status) && "status=".concat(error_1.response.status),
                                                    ((_b = error_1 === null || error_1 === void 0 ? void 0 : error_1.response) === null || _b === void 0 ? void 0 : _b.statusText) && "statusText=".concat(error_1.response.statusText)
                                                ]
                                                    .filter(Boolean)
                                                    .join(', ');
                                                baseMessage = "[MASS-CRAWLER] \u274C ".concat(label, " \"").concat(keyword, "\" \uC2E4\uD328 (").concat((keywordDuration / 1000).toFixed(2), "\uCD08): ").concat(errorMsg).concat(detailParts ? " (".concat(detailParts, ")") : '');
                                                logMassCrawler('error', baseMessage);
                                                if (error_1 === null || error_1 === void 0 ? void 0 : error_1.stack) {
                                                    logMassCrawler('error', "[MASS-CRAWLER] \u274C ".concat(label, " \"").concat(keyword, "\" \uC2A4\uD0DD: ").concat(error_1.stack));
                                                }
                                                throw error_1;
                                            case 4: return [2 /*return*/];
                                        }
                                    });
                                });
                            });
                        });
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDD04 ".concat(keywords.length, "\uAC1C \uD0A4\uC6CC\uB4DC \uBCD1\uB82C \uD06C\uB864\uB9C1 \uC2DC\uC791... (\uB3D9\uC2DC ").concat(Math.max(1, keywordConcurrency), "\uAC1C)"));
                        startTime = Date.now();
                        return [4 /*yield*/, Promise.allSettled(keywordTasks)];
                    case 1:
                        results = _c.sent();
                        endTime = Date.now();
                        duration = endTime - startTime;
                        logMassCrawler('info', "[MASS-CRAWLER] \u23F1\uFE0F \uC804\uCCB4 \uD06C\uB864\uB9C1 \uC2DC\uAC04: ".concat(duration, "ms (").concat((duration / 1000).toFixed(2), "\uCD08)"));
                        allItems = [];
                        totalStats = { totalItems: 0, naverCount: 0, rssCount: 0, cseCount: 0 };
                        // 🔧 크롤링 순서 보장: 키워드 순서대로 결과 처리
                        results.forEach(function (result) {
                            if (result.status === 'fulfilled') {
                                allItems.push.apply(allItems, result.value.result.items);
                                totalStats.totalItems += result.value.result.stats.totalItems;
                                totalStats.naverCount += result.value.result.stats.naverCount;
                                totalStats.rssCount += result.value.result.stats.rssCount;
                                totalStats.cseCount += result.value.result.stats.cseCount;
                            }
                            else {
                                // 이미 위에서 상세 로그를 출력했으므로 여기서는 생략
                            }
                        });
                        uniqueItems = this.deduplicateAndSort(allItems);
                        logMassCrawler('info', "[MASS-CRAWLER] \uD83D\uDDD1\uFE0F \uC911\uBCF5 \uC81C\uAC70: ".concat(allItems.length - uniqueItems.length, "\uAC1C \uC81C\uAC70"));
                        contents = uniqueItems.map(function (item) {
                            var _a;
                            return ({
                                title: item.title,
                                content: ((_a = item.fullContent) === null || _a === void 0 ? void 0 : _a.text) || item.description,
                                source: item.source,
                                platform: _this.mapSourceToPlatform(item.source),
                                relevance: Math.min(item.popularityScore / 10, 10),
                                url: item.link,
                                publishDate: item.pubDate,
                                extractedData: _this.extractDataFromText(item.description)
                            });
                        });
                        analysis = this.analyzeContent(contents, keywords);
                        return [4 /*yield*/, this.generateSmartCTAs(topic, keywords, contents)];
                    case 2:
                        ctas = _c.sent();
                        logMassCrawler('info', "[MASS-CRAWLER] \u2705 \uB2E4\uC911 \uD0A4\uC6CC\uB4DC \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(contents.length, "\uAC1C \uAE00, ").concat(ctas.length, "\uAC1C CTA"));
                        return [2 /*return*/, { contents: contents, ctas: ctas, stats: totalStats, analysis: analysis }];
                }
            });
        });
    };
    /**
     * 콘텐츠 분석
     */
    ContentCrawler.prototype.analyzeContent = function (contents, keywords) {
        // 키워드 빈도 분석
        var keywordFrequency = new Map();
        var contentQuality = [];
        contents.forEach(function (content) {
            // 키워드 추출 및 빈도 계산
            var words = (content.title + ' ' + content.content)
                .toLowerCase()
                .replace(/[^\w\s가-힣]/g, ' ')
                .split(/\s+/)
                .filter(function (word) { return word.length > 1; });
            words.forEach(function (word) {
                keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
            });
            // 콘텐츠 품질 점수
            var factors = [];
            var score = content.relevance * 10;
            if (content.title.length > 50) {
                score += 10;
                factors.push('긴 제목');
            }
            if (content.content && content.content.length > 500) {
                score += 15;
                factors.push('상세한 내용');
            }
            if (content.extractedData && Object.keys(content.extractedData).length > 0) {
                score += 20;
                factors.push('구조화된 데이터');
            }
            contentQuality.push({
                url: content.url,
                score: score,
                factors: factors
            });
        });
        // 상위 키워드 추출
        var topKeywords = Array.from(keywordFrequency.entries())
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 20)
            .map(function (_a) {
                var keyword = _a[0], frequency = _a[1];
                return ({ keyword: keyword, frequency: frequency });
            });
        // 트렌딩 토픽 추출
        var trendingTopics = topKeywords
            .filter(function (k) { return k.frequency > 2 && !keywords.includes(k.keyword); })
            .map(function (k) { return k.keyword; })
            .slice(0, 10);
        return {
            topKeywords: topKeywords,
            contentQuality: contentQuality.sort(function (a, b) { return b.score - a.score; }).slice(0, 20),
            trendingTopics: trendingTopics
        };
    };
    /**
     * 중복 제거 및 정렬
     */
    ContentCrawler.prototype.deduplicateAndSort = function (items) {
        var seen = new Set();
        var unique = items.filter(function (item) {
            if (seen.has(item.link))
                return false;
            seen.add(item.link);
            return true;
        });
        return unique.sort(function (a, b) { return b.popularityScore - a.popularityScore; });
    };
    /**
     * 스마트 CTA 생성
     */
    ContentCrawler.prototype.generateSmartCTAs = function (topic, keywords, contents) {
        return __awaiter(this, void 0, void 0, function () {
            var ctas, models, model, lastError, _i, models_1, modelName, prompt_1, result, error_2, errorMsg, isRateLimit, fallbackModels, _a, fallbackModels_1, fallbackModelName, fallbackModel, fallbackError_1, response, text, aiCTAs, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ctas = [];
                        // 기본 CTA들
                        ctas.push.apply(ctas, this.generateDefaultCTAs(topic, keywords));
                        if (!(this.gemini && contents.length > 0)) return [3 /*break*/, 16];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 15, , 16]);
                        models = ['gemini-2.0-flash', 'gemini-2.0-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp'];
                        model = null;
                        lastError = null;
                        for (_i = 0, models_1 = models; _i < models_1.length; _i++) {
                            modelName = models_1[_i];
                            try {
                                model = this.gemini.getGenerativeModel({ model: modelName });
                                break; // 성공하면 중단
                            }
                            catch (error) {
                                lastError = error;
                                continue; // 다음 모델 시도
                            }
                        }
                        if (!model) {
                            throw lastError || new Error('사용 가능한 Gemini 모델이 없습니다.');
                        }
                        prompt_1 = "\n\uB2E4\uC74C \uCF58\uD150\uCE20\uB97C \uBD84\uC11D\uD558\uC5EC \uD6A8\uACFC\uC801\uC778 CTA(\uD589\uB3D9 \uC720\uB3C4)\uB97C \uC0DD\uC131\uD574\uC8FC\uC138\uC694:\n\n\uC8FC\uC81C: ".concat(topic, "\n\uD0A4\uC6CC\uB4DC: ").concat(keywords.join(', '), "\n\uCF58\uD150\uCE20 \uC0D8\uD50C:\n").concat(contents.slice(0, 5).map(function (c) { return "- ".concat(c.title, ": ").concat(c.content.substring(0, 200), "..."); }).join('\n'), "\n\n\uB2E4\uC74C \uD615\uC2DD\uC73C\uB85C 3\uAC1C\uC758 CTA\uB97C \uC0DD\uC131\uD574\uC8FC\uC138\uC694:\n1. \uBC84\uD2BC\uD615 CTA (\uD074\uB9AD \uC720\uB3C4)\n2. \uB9C1\uD06C\uD615 CTA (\uC815\uBCF4 \uC81C\uACF5)\n3. \uBC30\uB108\uD615 CTA (\uAD00\uC2EC \uC720\uB3C4)\n\n\uAC01 CTA\uB294 \uB2E4\uC74C \uC815\uBCF4\uB97C \uD3EC\uD568\uD574\uC57C \uD569\uB2C8\uB2E4:\n- text: CTA \uD14D\uC2A4\uD2B8\n- type: button/link/banner\n- context: \uC0AC\uC6A9 \uB9E5\uB77D\n- hook: \uD6C4\uD0B9 \uBA58\uD2B8\n- relevance: \uAD00\uB828\uC131 \uC810\uC218 (1-10)\n");
                        result = void 0;
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 13]);
                        return [4 /*yield*/, model.generateContent(prompt_1)];
                    case 3:
                        result = _b.sent();
                        return [3 /*break*/, 13];
                    case 4:
                        error_2 = _b.sent();
                        errorMsg = String((error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || error_2 || '');
                        isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
                        if (!isRateLimit) return [3 /*break*/, 11];
                        fallbackModels = ['gemini-2.0-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp'];
                        _a = 0, fallbackModels_1 = fallbackModels;
                        _b.label = 5;
                    case 5:
                        if (!(_a < fallbackModels_1.length)) return [3 /*break*/, 10];
                        fallbackModelName = fallbackModels_1[_a];
                        _b.label = 6;
                    case 6:
                        _b.trys.push([6, 8, , 9]);
                        fallbackModel = this.gemini.getGenerativeModel({ model: fallbackModelName });
                        return [4 /*yield*/, fallbackModel.generateContent(prompt_1)];
                    case 7:
                        result = _b.sent();
                        console.log("[CTA] \uD560\uB2F9\uB7C9 \uCD08\uACFC\uB85C \uD3F4\uBC31 \uBAA8\uB378 ".concat(fallbackModelName, " \uC0AC\uC6A9"));
                        return [3 /*break*/, 10];
                    case 8:
                        fallbackError_1 = _b.sent();
                        return [3 /*break*/, 9];
                    case 9:
                        _a++;
                        return [3 /*break*/, 5];
                    case 10:
                        if (!result) {
                            throw error_2; // 모든 폴백 실패 시 원래 오류 throw
                        }
                        return [3 /*break*/, 12];
                    case 11: throw error_2; // 할당량 초과가 아닌 오류는 즉시 throw
                    case 12: return [3 /*break*/, 13];
                    case 13: return [4 /*yield*/, result.response];
                    case 14:
                        response = _b.sent();
                        text = response.text();
                        aiCTAs = this.parseAIResponse(text);
                        ctas.push.apply(ctas, aiCTAs);
                        return [3 /*break*/, 16];
                    case 15:
                        error_3 = _b.sent();
                        console.error('[CTA] AI CTA 생성 실패:', error_3);
                        return [3 /*break*/, 16];
                    case 16: return [2 /*return*/, ctas.slice(0, 10)]; // 최대 10개로 제한
                }
            });
        });
    };
    /**
     * AI 응답 파싱
     */
    ContentCrawler.prototype.parseAIResponse = function (text) {
        var ctas = [];
        try {
            // 간단한 파싱 로직 (실제로는 더 정교한 파싱 필요)
            var lines = text.split('\n').filter(function (line) { return line.trim(); });
            lines.forEach(function (line) {
                if (line.includes('CTA') || line.includes('버튼') || line.includes('링크')) {
                    var match = line.match(/(\d+)\.\s*(.+)/);
                    if (match && match[2]) {
                        ctas.push({
                            text: match[2],
                            url: '#',
                            type: 'button',
                            context: 'ai-generated',
                            hook: match[2],
                            source: 'ai',
                            relevance: 5
                        });
                    }
                }
            });
        }
        catch (error) {
            console.error('[CTA] AI 응답 파싱 실패:', error);
        }
        return ctas;
    };
    /**
     * 소스 타입을 플랫폼 타입으로 매핑
     */
    ContentCrawler.prototype.mapSourceToPlatform = function (source) {
        switch (source) {
            case 'naver': return 'naver';
            case 'rss': return 'rss';
            case 'cse': return 'cse';
            case 'manual': return 'naver'; // 수동 링크는 네이버로 분류
            default: return 'rss';
        }
    };
    /**
     * 기본 CTA 생성
     */
    ContentCrawler.prototype.generateDefaultCTAs = function (topic, keywords) {
        return [
            {
                text: "".concat(topic, " \uB354 \uC54C\uC544\uBCF4\uAE30"),
                url: '#',
                type: 'button',
                context: 'default',
                source: 'default',
                relevance: 3
            },
            {
                text: "".concat(keywords[0] || '관련', " \uC815\uBCF4 \uD655\uC778"),
                url: '#',
                type: 'link',
                context: 'default',
                source: 'default',
                relevance: 2
            }
        ];
    };
    /**
     * 텍스트에서 날짜, 숫자, 금액, 퍼센트 등의 정보 추출
     */
    ContentCrawler.prototype.extractDataFromText = function (text) {
        var extractedData = {
            dates: [],
            numbers: [],
            prices: [],
            percentages: []
        };
        // 1. 날짜 추출 (다양한 형식)
        var datePatterns = [
            /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g, // 2024년 10월 20일
            /\d{4}-\d{2}-\d{2}/g, // 2024-10-20
            /\d{4}\.\d{2}\.\d{2}/g, // 2024.10.20
            /\d{1,2}\/\d{1,2}\/\d{4}/g, // 10/20/2024
            /\d{1,2}월\s*\d{1,2}일/g, // 10월 20일
            /\d{4}년\s*\d{1,2}월/g // 2024년 10월
        ];
        datePatterns.forEach(function (pattern) {
            var _a;
            var matches = text.match(pattern);
            if (matches) {
                (_a = extractedData.dates).push.apply(_a, matches);
            }
        });
        // 2. 금액/가격 추출
        var pricePatterns = [
            /\d{1,3}(?:,\d{3})*원/g, // 10,000원
            /\d+만\s*원/g, // 100만원
            /\d+억\s*원/g, // 10억원
            /\d+천\s*원/g, // 5천원
            /\$\d{1,3}(?:,\d{3})*/g, // $1,000
            /\d+달러/g, // 100달러
            /\d+유로/g, // 100유로
            /\d{1,3}(?:,\d{3})*\s*원/g // 10,000 원
        ];
        pricePatterns.forEach(function (pattern) {
            var _a;
            var matches = text.match(pattern);
            if (matches) {
                (_a = extractedData.prices).push.apply(_a, matches);
            }
        });
        // 3. 퍼센트 추출
        var percentagePatterns = [
            /\d+(?:\.\d+)?%/g, // 10.5%
            /\d+퍼센트/g, // 10퍼센트
            /\d+\.?\d*\s*%/g // 10 %
        ];
        percentagePatterns.forEach(function (pattern) {
            var _a;
            var matches = text.match(pattern);
            if (matches) {
                (_a = extractedData.percentages).push.apply(_a, matches);
            }
        });
        // 4. 주요 숫자 추출 (단위 포함)
        var numberPatterns = [
            /\d{1,3}(?:,\d{3})+/g, // 1,000,000
            /\d+만/g, // 100만
            /\d+억/g, // 10억
            /\d+천/g, // 5천
            /\d+개/g, // 100개
            /\d+명/g, // 1000명
            /\d+회/g, // 5회
            /\d+년/g, // 2024년
            /\d+시간/g, // 24시간
            /\d+일/g // 30일
        ];
        numberPatterns.forEach(function (pattern) {
            var _a;
            var matches = text.match(pattern);
            if (matches) {
                (_a = extractedData.numbers).push.apply(_a, matches);
            }
        });
        // 중복 제거
        extractedData.dates = __spreadArray([], new Set(extractedData.dates), true);
        extractedData.numbers = __spreadArray([], new Set(extractedData.numbers), true);
        extractedData.prices = __spreadArray([], new Set(extractedData.prices), true);
        extractedData.percentages = __spreadArray([], new Set(extractedData.percentages), true);
        return extractedData;
    };
    /**
     * 1단계: 네이버 API로 블로그 글 크롤링
     */
    ContentCrawler.prototype.crawlFromNaverAPI = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, _a, maxResults, naverClientId, naverClientSecret, searchQuery, encodedQuery, apiUrl, controller_1, timeoutId, requestStartTime, response, requestTime, data, contents, _i, _b, item, blogContent, error_4, error_5, requestTime, error_6;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords, _a = config.maxResults, maxResults = _a === void 0 ? 5 : _a, naverClientId = config.naverClientId, naverClientSecret = config.naverClientSecret;
                        if (!naverClientId || !naverClientSecret) {
                            console.log('[NAVER] 네이버 API 키가 없어서 건너뛰기');
                            console.log("[NAVER DEBUG] naverClientId: ".concat(naverClientId ? '있음' : '없음', ", naverClientSecret: ").concat(naverClientSecret ? '있음' : '없음'));
                            return [2 /*return*/, []];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 13, , 14]);
                        console.log("[NAVER] \"".concat(topic, "\" \uB124\uC774\uBC84 \uBE14\uB85C\uADF8 \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
                        searchQuery = "".concat(topic, " ").concat(keywords.join(' '));
                        encodedQuery = encodeURIComponent(searchQuery);
                        apiUrl = "https://openapi.naver.com/v1/search/blog.json?query=".concat(encodedQuery, "&display=").concat(maxResults, "&sort=sim");
                        controller_1 = new AbortController();
                        timeoutId = setTimeout(function () { return controller_1.abort(); }, 30000);
                        console.log("[NAVER-DEBUG] \uD83D\uDD04 \uB124\uC774\uBC84 API \uC694\uCCAD \uC2DC\uC791");
                        console.log("[NAVER-DEBUG]    URL: ".concat(apiUrl.substring(0, 100), "..."));
                        console.log("[NAVER-DEBUG]    \uD0A4\uC6CC\uB4DC: \"".concat(topic, "\" ").concat(keywords.join(', ')));
                        console.log("[NAVER-DEBUG]    \uD0C0\uC784\uC544\uC6C3: 30\uCD08");
                        requestStartTime = Date.now();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 11, , 12]);
                        return [4 /*yield*/, fetch(apiUrl, {
                            signal: controller_1.signal,
                            headers: {
                                'X-Naver-Client-Id': naverClientId,
                                'X-Naver-Client-Secret': naverClientSecret
                            }
                        })];
                    case 3:
                        response = _c.sent();
                        clearTimeout(timeoutId);
                        requestTime = Date.now() - requestStartTime;
                        console.log("[NAVER-DEBUG] \u2705 \uC751\uB2F5 \uC218\uC2E0 (".concat(requestTime, "ms)"));
                        console.log("[NAVER-DEBUG]    \uC0C1\uD0DC \uCF54\uB4DC: ".concat(response.status));
                        console.log("[NAVER-DEBUG]    \uC0C1\uD0DC \uD14D\uC2A4\uD2B8: ".concat(response.statusText));
                        if (!response.ok) {
                            console.error("[NAVER-DEBUG] \u274C API \uD638\uCD9C \uC2E4\uD328: ".concat(response.status, " ").concat(response.statusText));
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, response.json()];
                    case 4:
                        data = _c.sent();
                        contents = [];
                        _i = 0, _b = data.items || [];
                        _c.label = 5;
                    case 5:
                        if (!(_i < _b.length)) return [3 /*break*/, 10];
                        item = _b[_i];
                        _c.label = 6;
                    case 6:
                        _c.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, this.crawlNaverBlogContent(item.link, topic, keywords)];
                    case 7:
                        blogContent = _c.sent();
                        if (blogContent) {
                            contents.push(blogContent);
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        error_4 = _c.sent();
                        console.log("[NAVER] \uBE14\uB85C\uADF8 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(item.link));
                        return [3 /*break*/, 9];
                    case 9:
                        _i++;
                        return [3 /*break*/, 5];
                    case 10:
                        console.log("[NAVER] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(contents.length, "\uAC1C \uAE00 \uC218\uC9D1"));
                        return [2 /*return*/, contents];
                    case 11:
                        error_5 = _c.sent();
                        clearTimeout(timeoutId);
                        requestTime = Date.now() - requestStartTime;
                        console.error("[NAVER-DEBUG] \u274C \uC5D0\uB7EC \uBC1C\uC0DD (".concat(requestTime, "ms)"));
                        console.error("[NAVER-DEBUG]    \uC5D0\uB7EC \uC774\uB984: ".concat((error_5 === null || error_5 === void 0 ? void 0 : error_5.name) || 'Unknown'));
                        console.error("[NAVER-DEBUG]    \uC5D0\uB7EC \uBA54\uC2DC\uC9C0: ".concat((error_5 === null || error_5 === void 0 ? void 0 : error_5.message) || 'N/A'));
                        console.error("[NAVER-DEBUG]    \uD0C0\uC784\uC544\uC6C3 \uC5EC\uBD80: ".concat(error_5.name === 'AbortError' ? 'YES' : 'NO'));
                        console.error("[NAVER-DEBUG]    \uC5D0\uB7EC \uC2A4\uD0DD:", (error_5 === null || error_5 === void 0 ? void 0 : error_5.stack) || 'N/A');
                        if (error_5.name === 'AbortError') {
                            console.error('[NAVER] 네이버 API 타임아웃 (30초 초과)');
                        }
                        else {
                            console.error('[NAVER] 네이버 API 크롤링 실패:', error_5.message || error_5);
                        }
                        return [2 /*return*/, []];
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        error_6 = _c.sent();
                        console.error('[NAVER] 네이버 API 크롤링 실패:', error_6);
                        return [2 /*return*/, []];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 네이버 블로그 내용 크롤링 (우회 방법들)
     */
    ContentCrawler.prototype.crawlNaverBlogContent = function (url, topic, keywords) {
        return __awaiter(this, void 0, void 0, function () {
            var controller_2, timeoutId, response, html, fetchError_1, error_7;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        controller_2 = new AbortController();
                        timeoutId = setTimeout(function () { return controller_2.abort(); }, 20000);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch(url, {
                            signal: controller_2.signal,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1'
                            }
                        })];
                    case 2:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.tryProxyFetch(url)];
                    case 3:
                        // 방법 2: 프록시 서버를 통한 우회 시도
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP ".concat(response.status));
                        }
                        _a.label = 4;
                    case 4:
                        clearTimeout(timeoutId);
                        return [4 /*yield*/, response.text()];
                    case 5:
                        html = _a.sent();
                        return [2 /*return*/, this.extractContentFromHTML(html, url, 'naver', topic, keywords)];
                    case 6:
                        fetchError_1 = _a.sent();
                        clearTimeout(timeoutId);
                        if (fetchError_1.name === 'AbortError') {
                            console.log("[NAVER] \uD0C0\uC784\uC544\uC6C3: ".concat(url));
                        }
                        else {
                            console.log("[NAVER] \uC6B0\uD68C \uD06C\uB864\uB9C1\uB3C4 \uC2E4\uD328: ".concat(url));
                        }
                        return [2 /*return*/, null];
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_7 = _a.sent();
                        console.log("[NAVER] \uC6B0\uD68C \uD06C\uB864\uB9C1\uB3C4 \uC2E4\uD328: ".concat(url));
                        return [2 /*return*/, null];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 프록시를 통한 우회 시도
     */
    ContentCrawler.prototype.tryProxyFetch = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var proxyServices, _i, proxyServices_1, proxyUrl, response, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        proxyServices = [
                            "https://cors-anywhere.herokuapp.com/".concat(url),
                            "https://api.allorigins.win/raw?url=".concat(encodeURIComponent(url)),
                            "https://thingproxy.freeboard.io/fetch/".concat(url)
                        ];
                        _i = 0, proxyServices_1 = proxyServices;
                        _a.label = 1;
                    case 1:
                        if (!(_i < proxyServices_1.length)) return [3 /*break*/, 6];
                        proxyUrl = proxyServices_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, fetch(proxyUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })];
                    case 3:
                        response = _a.sent();
                        if (response.ok) {
                            return [2 /*return*/, response];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_8 = _a.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: throw new Error('모든 프록시 서비스 실패');
                }
            });
        });
    };
    /**
     * 2단계: RSS 피드에서 내용 크롤링
     */
    ContentCrawler.prototype.crawlFromRSS = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, rssFeeds, contents, _loop_1, this_1, _i, rssFeeds_1, feedUrl, state_1, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        console.log("[RSS] \"".concat(topic, "\" RSS \uD53C\uB4DC \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
                        rssFeeds = [
                            // 네이버 관련
                            "https://search.naver.com/search.naver?where=rss&query=".concat(encodeURIComponent(topic)),
                            "https://blog.naver.com/rss/search.naver?query=".concat(encodeURIComponent(topic)),
                            "https://section.blog.naver.com/rss/Search.naver?keyword=".concat(encodeURIComponent(topic)),
                            // 티스토리 (Tistory)
                            "https://www.tistory.com/rss/search/".concat(encodeURIComponent(topic)),
                            // 브런치 (Brunch) - 네이버 글쓰기 플랫폼
                            "https://brunch.co.kr/rss/search/".concat(encodeURIComponent(topic)),
                            // 벨로그 (Velog) - 개발자 블로그
                            "https://velog.io/rss/search?q=".concat(encodeURIComponent(topic)),
                            // Google News RSS
                            "https://news.google.com/rss/search?q=".concat(encodeURIComponent(topic), "&hl=ko&gl=KR&ceid=KR:ko"),
                            // 네이버 뉴스 RSS
                            "https://news.naver.com/main/rss/search.naver?query=".concat(encodeURIComponent(topic)),
                            // 다음 뉴스 RSS
                            "https://media.daum.net/rss/search/".concat(encodeURIComponent(topic)),
                            // 미디엄 (Medium) - 글로벌 플랫폼
                            "https://medium.com/feed/tag/".concat(encodeURIComponent(topic))
                        ];
                        contents = [];
                        _loop_1 = function (feedUrl) {
                            var controller_3, timeoutId, response, xmlText, rssContents, error_10;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _b.trys.push([0, 3, , 4]);
                                        controller_3 = new AbortController();
                                        timeoutId = setTimeout(function () { return controller_3.abort(); }, 30000);
                                        return [4 /*yield*/, fetch(feedUrl, {
                                            signal: controller_3.signal,
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                                            }
                                        })];
                                    case 1:
                                        response = _b.sent();
                                        clearTimeout(timeoutId);
                                        if (!response.ok) {
                                            console.log("[RSS] \uD53C\uB4DC \uC751\uB2F5 \uC2E4\uD328 (".concat(response.status, "): ").concat(feedUrl));
                                            return [2 /*return*/, "continue"];
                                        }
                                        return [4 /*yield*/, response.text()];
                                    case 2:
                                        xmlText = _b.sent();
                                        // 빈 응답 체크
                                        if (!xmlText || xmlText.trim().length === 0) {
                                            console.log("[RSS] \uBE48 \uC751\uB2F5: ".concat(feedUrl));
                                            return [2 /*return*/, "continue"];
                                        }
                                        rssContents = this_1.parseRSSContent(xmlText, topic, keywords);
                                        if (rssContents.length > 0) {
                                            contents.push.apply(contents, rssContents);
                                            console.log("[RSS] \u2705 ".concat(feedUrl, "\uC5D0\uC11C ").concat(rssContents.length, "\uAC1C \uC218\uC9D1"));
                                        }
                                        // 너무 많은 콘텐츠 수집 시 중단 (메모리 절약)
                                        if (contents.length >= 20) {
                                            console.log("[RSS] \uCDA9\uBD84\uD55C \uCF58\uD150\uCE20 \uC218\uC9D1 (".concat(contents.length, "\uAC1C), \uD06C\uB864\uB9C1 \uC911\uB2E8"));
                                            return [2 /*return*/, "break"];
                                        }
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_10 = _b.sent();
                                        if (error_10.name === 'AbortError') {
                                            console.log("[RSS] \uD0C0\uC784\uC544\uC6C3: ".concat(feedUrl));
                                        }
                                        else {
                                            console.log("[RSS] \uD53C\uB4DC \uD06C\uB864\uB9C1 \uC2E4\uD328 (".concat(error_10.message, "): ").concat(feedUrl));
                                        }
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _i = 0, rssFeeds_1 = rssFeeds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < rssFeeds_1.length)) return [3 /*break*/, 5];
                        feedUrl = rssFeeds_1[_i];
                        return [5 /*yield**/, _loop_1(feedUrl)];
                    case 3:
                        state_1 = _a.sent();
                        if (state_1 === "break")
                            return [3 /*break*/, 5];
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5:
                        console.log("[RSS] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(contents.length, "\uAC1C \uAE00 \uC218\uC9D1"));
                        return [2 /*return*/, contents];
                    case 6:
                        error_9 = _a.sent();
                        console.error('[RSS] RSS 크롤링 실패:', error_9);
                        return [2 /*return*/, []];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * RSS XML 파싱 (개선 버전)
     */
    ContentCrawler.prototype.parseRSSContent = function (xmlText, topic, keywords) {
        var contents = [];
        try {
            // <item> 태그 외에 <entry> 태그도 지원 (Atom 피드)
            var itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) ||
                xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];
            for (var _i = 0, itemMatches_1 = itemMatches; _i < itemMatches_1.length; _i++) {
                var item = itemMatches_1[_i];
                // 제목 추출 (다양한 형식 지원)
                var titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
                var title = ((titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[1]) || (titleMatch === null || titleMatch === void 0 ? void 0 : titleMatch[2]) || '').trim();
                // 링크 추출
                var linkMatch = item.match(/<link[^>]*>(.*?)<\/link>|<link[^>]*href=["'](.*?)["'][^>]*\/>/i);
                var link = ((linkMatch === null || linkMatch === void 0 ? void 0 : linkMatch[1]) || (linkMatch === null || linkMatch === void 0 ? void 0 : linkMatch[2]) || '').trim();
                // 설명/내용 추출 (description, content, summary 등)
                var descriptionMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i) ||
                    item.match(/<content><!\[CDATA\[(.*?)\]\]><\/content>|<content[^>]*>(.*?)<\/content>/i) ||
                    item.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>|<summary>(.*?)<\/summary>/i);
                var description = ((descriptionMatch === null || descriptionMatch === void 0 ? void 0 : descriptionMatch[1]) || (descriptionMatch === null || descriptionMatch === void 0 ? void 0 : descriptionMatch[2]) || '').trim();
                // 발행 날짜 추출
                var pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>|<dc:date>(.*?)<\/dc:date>/i);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                var _publishDate = ((pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[1]) || (pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[2]) || (pubDateMatch === null || pubDateMatch === void 0 ? void 0 : pubDateMatch[3]) || '').trim();
                // 유효성 검사
                if (!title || !link || title.length < 5) {
                    continue;
                }
                // HTML 태그 및 특수문자 정리
                var cleanTitle = this.cleanHTMLContent(title);
                var cleanDescription = this.cleanHTMLContent(description);
                // 관련성 확인
                if (this.isRelevantContent(cleanTitle + ' ' + cleanDescription, topic, keywords)) {
                    var fullText = "".concat(cleanTitle, " ").concat(cleanDescription);
                    var extracted = this.extractDataFromText(fullText);
                    contents.push({
                        title: cleanTitle,
                        content: cleanDescription,
                        source: link,
                        platform: 'rss',
                        relevance: this.calculateRelevance(cleanTitle + ' ' + cleanDescription, topic, keywords),
                        url: link,
                        extractedData: {
                            dates: extracted.dates,
                            numbers: extracted.numbers,
                            prices: extracted.prices,
                            percentages: extracted.percentages
                        }
                    });
                }
            }
            // 관련성 순으로 정렬
            contents.sort(function (a, b) { return b.relevance - a.relevance; });
        }
        catch (error) {
            console.error('[RSS] XML 파싱 오류:', error);
        }
        return contents;
    };
    /**
     * 3단계: Google CSE로 워드프레스/티스토리/블로그스팟 크롤링
     */
    ContentCrawler.prototype.crawlFromCSE = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, _a, maxResults, googleCseKey, googleCseCx, searchQueries, contents, safeCSERequest, _loop_2, this_2, _i, searchQueries_1, query, error_11;
            var _this = this;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords, _a = config.maxResults, maxResults = _a === void 0 ? 10 : _a, googleCseKey = config.googleCseKey, googleCseCx = config.googleCseCx;
                        if (!googleCseKey || !googleCseCx) {
                            console.log('[CSE] Google CSE 키가 없어서 건너뛰기');
                            return [2 /*return*/, []];
                        }
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 7, , 8]);
                        console.log("[CSE] \"".concat(topic, "\" CSE \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
                        searchQueries = [
                            "".concat(topic, " site:wordpress.com OR site:tistory.com OR site:blogspot.com"),
                            "".concat(topic, " ").concat(keywords.join(' '), " site:*.wordpress.com OR site:*.tistory.com OR site:*.blogspot.com")
                        ];
                        contents = [];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/google-cse-rate-limiter'); })];
                    case 2:
                        safeCSERequest = (_d.sent()).safeCSERequest;
                        _loop_2 = function (query) {
                            var data, _e, _f, item, blogContent, error_12, error_13;
                            return __generator(this, function (_g) {
                                switch (_g.label) {
                                    case 0:
                                        _g.trys.push([0, 8, , 9]);
                                        return [4 /*yield*/, safeCSERequest(query, function () {
                                            return __awaiter(_this, void 0, void 0, function () {
                                                var searchUrl, controller, timeoutId, response, error_14;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            searchUrl = "https://www.googleapis.com/customsearch/v1?key=".concat(googleCseKey, "&cx=").concat(googleCseCx, "&q=").concat(encodeURIComponent(query), "&num=").concat(maxResults);
                                                            controller = new AbortController();
                                                            timeoutId = setTimeout(function () { return controller.abort(); }, 30000);
                                                            _a.label = 1;
                                                        case 1:
                                                            _a.trys.push([1, 4, , 5]);
                                                            return [4 /*yield*/, fetch(searchUrl, {
                                                                signal: controller.signal
                                                            })];
                                                        case 2:
                                                            response = _a.sent();
                                                            clearTimeout(timeoutId);
                                                            if (!response.ok) {
                                                                throw new Error("HTTP ".concat(response.status));
                                                            }
                                                            return [4 /*yield*/, response.json()];
                                                        case 3: return [2 /*return*/, _a.sent()];
                                                        case 4:
                                                            error_14 = _a.sent();
                                                            clearTimeout(timeoutId);
                                                            if (error_14.name === 'AbortError') {
                                                                throw new Error('타임아웃');
                                                            }
                                                            throw error_14;
                                                        case 5: return [2 /*return*/];
                                                    }
                                                });
                                            });
                                        }, { useCache: true, priority: 'low' })];
                                    case 1:
                                        data = _g.sent();
                                        if (!(data === null || data === void 0 ? void 0 : data.items))
                                            return [2 /*return*/, "continue"];
                                        _e = 0, _f = data.items;
                                        _g.label = 2;
                                    case 2:
                                        if (!(_e < _f.length)) return [3 /*break*/, 7];
                                        item = _f[_e];
                                        _g.label = 3;
                                    case 3:
                                        _g.trys.push([3, 5, , 6]);
                                        return [4 /*yield*/, this_2.crawlBlogContent(item.link, topic, keywords)];
                                    case 4:
                                        blogContent = _g.sent();
                                        if (blogContent) {
                                            contents.push(blogContent);
                                        }
                                        return [3 /*break*/, 6];
                                    case 5:
                                        error_12 = _g.sent();
                                        console.log("[CSE] \uBE14\uB85C\uADF8 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(item.link));
                                        return [3 /*break*/, 6];
                                    case 6:
                                        _e++;
                                        return [3 /*break*/, 2];
                                    case 7: return [3 /*break*/, 9];
                                    case 8:
                                        error_13 = _g.sent();
                                        // Rate Limiter가 429 오류를 처리하므로 여기서는 로그만 남김
                                        if (((_b = error_13.message) === null || _b === void 0 ? void 0 : _b.includes('Rate Limit')) || ((_c = error_13.message) === null || _c === void 0 ? void 0 : _c.includes('할당량'))) {
                                            console.warn("[CSE] ".concat(error_13.message, ": ").concat(query));
                                        }
                                        else {
                                            console.log("[CSE] \uAC80\uC0C9 \uC2E4\uD328: ".concat(error_13.message || error_13));
                                        }
                                        return [2 /*return*/, "continue"];
                                    case 9: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _i = 0, searchQueries_1 = searchQueries;
                        _d.label = 3;
                    case 3:
                        if (!(_i < searchQueries_1.length)) return [3 /*break*/, 6];
                        query = searchQueries_1[_i];
                        return [5 /*yield**/, _loop_2(query)];
                    case 4:
                        _d.sent();
                        _d.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6:
                        console.log("[CSE] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(contents.length, "\uAC1C \uAE00 \uC218\uC9D1"));
                        return [2 /*return*/, contents];
                    case 7:
                        error_11 = _d.sent();
                        console.error('[CSE] CSE 크롤링 실패:', error_11);
                        return [2 /*return*/, []];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 개별 블로그 내용 크롤링
     */
    ContentCrawler.prototype.crawlBlogContent = function (url, topic, keywords) {
        return __awaiter(this, void 0, void 0, function () {
            var controller_4, timeoutId, response, html, platform, error_15;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        controller_4 = new AbortController();
                        timeoutId = setTimeout(function () { return controller_4.abort(); }, 20000);
                        return [4 /*yield*/, fetch(url, {
                            signal: controller_4.signal,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        clearTimeout(timeoutId);
                        if (!response.ok)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        html = _a.sent();
                        platform = this.detectPlatform(url);
                        return [2 /*return*/, this.extractContentFromHTML(html, url, platform, topic, keywords)];
                    case 3:
                        error_15 = _a.sent();
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * HTML에서 내용 추출
     */
    ContentCrawler.prototype.extractContentFromHTML = function (html, url, platform, topic, keywords) {
        try {
            // 제목 추출
            var titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            var title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';
            // 본문 내용 추출 (플랫폼별 최적화)
            var content = '';
            if (platform === 'naver') {
                // 네이버 블로그 특화 추출
                var contentMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                    html.match(/<div[^>]*id="postViewArea"[^>]*>([\s\S]*?)<\/div>/i);
                if (contentMatch && contentMatch[1]) {
                    content = contentMatch[1];
                }
            }
            else {
                // 일반적인 블로그 추출
                var contentSelectors = [
                    /<article[^>]*>([\s\S]*?)<\/article>/i,
                    /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
                    /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
                    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
                ];
                for (var _i = 0, contentSelectors_1 = contentSelectors; _i < contentSelectors_1.length; _i++) {
                    var selector = contentSelectors_1[_i];
                    var match = html.match(selector);
                    if (match && match[1]) {
                        content = match[1];
                        break;
                    }
                }
            }
            // HTML 태그 제거 및 텍스트 정리
            content = this.cleanHTMLContent(content);
            if (!title || !content || content.length < 100) {
                return null;
            }
            // 날짜, 숫자, 금액, 퍼센트 추출
            var fullText = "".concat(title, " ").concat(content);
            var extracted = this.extractDataFromText(fullText);
            return {
                title: title,
                content: content,
                source: url,
                platform: platform,
                relevance: this.calculateRelevance(title + ' ' + content, topic, keywords),
                url: url,
                extractedData: {
                    dates: extracted.dates,
                    numbers: extracted.numbers,
                    prices: extracted.prices,
                    percentages: extracted.percentages
                }
            };
        }
        catch (error) {
            return null;
        }
    };
    /**
     * HTML 내용 정리
     */
    ContentCrawler.prototype.cleanHTMLContent = function (html) {
        return html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 스크립트 제거
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 스타일 제거
            .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
    };
    /**
     * 플랫폼 감지
     */
    ContentCrawler.prototype.detectPlatform = function (url) {
        if (url.includes('naver.com'))
            return 'naver';
        if (url.includes('tistory.com'))
            return 'tistory';
        if (url.includes('brunch.co.kr'))
            return 'brunch';
        if (url.includes('velog.io'))
            return 'velog';
        if (url.includes('medium.com'))
            return 'medium';
        if (url.includes('news.google.com'))
            return 'google-news';
        if (url.includes('media.daum.net'))
            return 'daum-news';
        if (url.includes('blogspot.com'))
            return 'blogspot';
        if (url.includes('wordpress.com'))
            return 'wordpress';
        return 'unknown';
    };
    /**
     * 내용 관련성 확인
     */
    ContentCrawler.prototype.isRelevantContent = function (text, topic, keywords) {
        var lowerText = text.toLowerCase();
        var lowerTopic = topic.toLowerCase();
        // 주제나 키워드와 관련이 있는지 확인
        var hasTopicKeyword = keywords.some(function (keyword) {
            return lowerText.includes(keyword.toLowerCase());
        });
        var hasTopicWord = lowerText.includes(lowerTopic) ||
            lowerTopic.includes(lowerText);
        return hasTopicKeyword || hasTopicWord;
    };
    /**
     * 관련도 계산
     */
    ContentCrawler.prototype.calculateRelevance = function (text, topic, keywords) {
        var relevance = 0;
        var lowerText = text.toLowerCase();
        // 키워드 매칭 점수
        keywords.forEach(function (keyword) {
            if (lowerText.includes(keyword.toLowerCase())) {
                relevance += 2;
            }
        });
        // 주제 단어 매칭 점수
        var topicWords = topic.toLowerCase().split(' ');
        topicWords.forEach(function (word) {
            if (lowerText.includes(word)) {
                relevance += 1;
            }
        });
        return relevance;
    };
    /**
     * CTA 크롤링
     */
    ContentCrawler.prototype.crawlCTAFromContent = function (contents) {
        return __awaiter(this, void 0, void 0, function () {
            var ctas, _i, contents_1, content, response, html, extractedCTAs, error_16;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ctas = [];
                        _i = 0, contents_1 = contents;
                        _a.label = 1;
                    case 1:
                        if (!(_i < contents_1.length)) return [3 /*break*/, 7];
                        content = contents_1[_i];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 5, , 6]);
                        return [4 /*yield*/, fetch(content.url)];
                    case 3:
                        response = _a.sent();
                        if (!response.ok)
                            return [3 /*break*/, 6];
                        return [4 /*yield*/, response.text()];
                    case 4:
                        html = _a.sent();
                        extractedCTAs = this.extractCTAsFromHTML(html, content.url);
                        ctas.push.apply(ctas, extractedCTAs);
                        return [3 /*break*/, 6];
                    case 5:
                        error_16 = _a.sent();
                        console.log("[CTA] CTA \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(content.url));
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 1];
                    case 7: return [2 /*return*/, ctas];
                }
            });
        });
    };
    /**
     * HTML에서 CTA 추출 (강화 버전: 외부 링크 + 후킹 멘트)
     */
    ContentCrawler.prototype.extractCTAsFromHTML = function (html, sourceUrl) {
        var _a, _b, _c;
        var ctas = [];
        // HTML을 더 쉽게 파싱하기 위해 전처리
        var cleanHtml = html.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        // 링크 CTA 추출 (외부 링크 우선) - 더 강화된 패턴
        var linkMatches = cleanHtml.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi);
        for (var _i = 0, linkMatches_1 = linkMatches; _i < linkMatches_1.length; _i++) {
            var match = linkMatches_1[_i];
            var url = match[1];
            var text = (_a = match[2]) === null || _a === void 0 ? void 0 : _a.trim();
            if (!url || !text)
                continue;
            // CTA 같은 텍스트만 필터링
            if (!this.isCTAText(text))
                continue;
            // 외부 링크 여부 확인
            var isExternal = this.isExternalUrl(url, sourceUrl);
            // 후킹 멘트 추출 (CTA 앞뒤 100자)
            var matchIndex = cleanHtml.indexOf(match[0]);
            var beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
            var afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);
            var hook = this.extractHookingMessage(beforeText, afterText, text);
            var cta = {
                text: text,
                url: this.normalizeUrl(url, sourceUrl),
                type: 'link',
                context: 'link',
                source: sourceUrl,
                relevance: isExternal ? 8 : 5, // 외부 링크는 점수 높게
                isExternal: isExternal
            };
            if (hook) {
                cta.hook = hook;
            }
            ctas.push(cta);
        }
        // 버튼 CTA 추출
        var buttonMatches = cleanHtml.matchAll(/<button[^>]*>([^<]+)<\/button>/gi);
        var divMatches = cleanHtml.matchAll(/<div[^>]*class="[^"]*btn[^"]*"[^>]*>([^<]+)<\/div>/gi);
        for (var _d = 0, buttonMatches_1 = buttonMatches; _d < buttonMatches_1.length; _d++) {
            var match = buttonMatches_1[_d];
            var text = (_b = match[1]) === null || _b === void 0 ? void 0 : _b.trim();
            if (!text)
                continue;
            if (!this.isCTAText(text))
                continue;
            // 버튼 주변 텍스트에서 링크 찾기
            var matchIndex = cleanHtml.indexOf(match[0]);
            var surroundingHtml = cleanHtml.substring(Math.max(0, matchIndex - 200), matchIndex + 200);
            var urlMatch = surroundingHtml.match(/href="([^"]*)"/i);
            var url = urlMatch && urlMatch[1] ? this.normalizeUrl(urlMatch[1], sourceUrl) : sourceUrl;
            var isExternal = urlMatch && urlMatch[1] ? this.isExternalUrl(urlMatch[1], sourceUrl) : false;
            // 후킹 멘트 추출
            var beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
            var afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);
            var hook = this.extractHookingMessage(beforeText, afterText, text);
            var cta = {
                text: text,
                url: url,
                type: 'button',
                context: 'button',
                source: sourceUrl,
                relevance: isExternal ? 8 : 6,
                isExternal: isExternal
            };
            if (hook) {
                cta.hook = hook;
            }
            ctas.push(cta);
        }
        // div CTA 추출
        for (var _e = 0, divMatches_1 = divMatches; _e < divMatches_1.length; _e++) {
            var match = divMatches_1[_e];
            var text = (_c = match[1]) === null || _c === void 0 ? void 0 : _c.trim();
            if (!text)
                continue;
            if (!this.isCTAText(text))
                continue;
            // div 주변 텍스트에서 링크 찾기
            var matchIndex = cleanHtml.indexOf(match[0]);
            var surroundingHtml = cleanHtml.substring(Math.max(0, matchIndex - 200), matchIndex + 200);
            var urlMatch = surroundingHtml.match(/href="([^"]*)"/i);
            var url = urlMatch && urlMatch[1] ? this.normalizeUrl(urlMatch[1], sourceUrl) : sourceUrl;
            var isExternal = urlMatch && urlMatch[1] ? this.isExternalUrl(urlMatch[1], sourceUrl) : false;
            // 후킹 멘트 추출
            var beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
            var afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);
            var hook = this.extractHookingMessage(beforeText, afterText, text);
            var cta = {
                text: text,
                url: url,
                type: 'button',
                context: 'div',
                source: sourceUrl,
                relevance: isExternal ? 7 : 5,
                isExternal: isExternal
            };
            if (hook) {
                cta.hook = hook;
            }
            ctas.push(cta);
        }
        // 중복 제거 및 관련성 높은 순으로 정렬
        var uniqueCTAs = this.deduplicateCTAs(ctas);
        return uniqueCTAs.sort(function (a, b) { return b.relevance - a.relevance; });
    };
    /**
     * 외부 URL 여부 확인
     */
    ContentCrawler.prototype.isExternalUrl = function (url, sourceUrl) {
        try {
            // 상대 경로는 내부 링크
            if (!url.startsWith('http'))
                return false;
            var urlDomain = new URL(url).hostname;
            var sourceDomain = new URL(sourceUrl).hostname;
            return urlDomain !== sourceDomain;
        }
        catch (_a) {
            return false;
        }
    };
    /**
     * URL 정규화
     */
    ContentCrawler.prototype.normalizeUrl = function (url, baseUrl) {
        try {
            if (url.startsWith('http'))
                return url;
            return new URL(url, baseUrl).href;
        }
        catch (_a) {
            return url;
        }
    };
    /**
     * 후킹 멘트 추출
     */
    ContentCrawler.prototype.extractHookingMessage = function (beforeText, afterText, _ctaText) {
        // HTML 태그 제거
        var cleanBefore = beforeText.replace(/<[^>]*>/g, ' ').trim();
        var cleanAfter = afterText.replace(/<[^>]*>/g, ' ').trim();
        // 후킹 키워드 찾기
        var hookKeywords = [
            '지금', '바로', '완전', '무료', '할인', '혜택', '특별', '최대', '최고',
            '놓치지', '서둘러', '한정', '이벤트', '프로모션', '독점',
            '확인', '알아보', '자세히', '더보기'
        ];
        // 앞뒤 텍스트에서 후킹 메시지 찾기
        var sentences = (cleanBefore + ' ' + cleanAfter).split(/[.!?。！？]/).filter(function (s) { return s.length > 5; });
        var _loop_3 = function (sentence) {
            var hasHookKeyword = hookKeywords.some(function (keyword) { return sentence.includes(keyword); });
            if (hasHookKeyword && sentence.length < 100) {
                return { value: sentence.trim() };
            }
        };
        for (var _i = 0, sentences_1 = sentences; _i < sentences_1.length; _i++) {
            var sentence = sentences_1[_i];
            var state_2 = _loop_3(sentence);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        return undefined;
    };
    /**
     * CTA 중복 제거
     */
    ContentCrawler.prototype.deduplicateCTAs = function (ctas) {
        var seen = new Map();
        for (var _i = 0, ctas_1 = ctas; _i < ctas_1.length; _i++) {
            var cta = ctas_1[_i];
            var key = "".concat(cta.text.toLowerCase(), "-").concat(cta.url);
            var existing = seen.get(key);
            // 동일한 CTA가 있으면 더 좋은 것만 보존
            if (!existing || cta.relevance > existing.relevance) {
                seen.set(key, cta);
            }
        }
        return Array.from(seen.values());
    };
    /**
     * CTA 텍스트인지 확인
     */
    ContentCrawler.prototype.isCTAText = function (text) {
        var ctaKeywords = [
            '지금', '바로', '확인', '보기', '이동', '가기', '신청', '구매', '다운로드',
            '무료', '할인', '혜택', '이벤트', '참여', '등록', '가입', '시작',
            'click', 'buy', 'download', 'free', 'now', 'here'
        ];
        var lowerText = text.toLowerCase();
        return ctaKeywords.some(function (keyword) { return lowerText.includes(keyword); }) && text.length < 50;
    };
    /**
     * AI로 크롤링한 내용을 믹싱해서 새로운 글 생성
     */
    ContentCrawler.prototype.generateMixedContent = function (topic_1, keywords_1, contents_2, ctas_2, section_1, contentMode_1) {
        return __awaiter(this, arguments, void 0, function (topic, keywords, contents, ctas, section, contentMode, provider) {
            var prompt_2, response, completion, models, model, lastError, _i, models_2, modelName, result, error_17, errorMsg, isRateLimit, error_18;
            var _a, _b;
            if (provider === void 0) { provider = 'gemini'; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 11, , 12]);
                        console.log("[AI MIXER] ".concat(section.title, " \uC139\uC158 \uB0B4\uC6A9 \uBBF9\uC2F1 \uC2DC\uC791..."));
                        prompt_2 = this.buildContentMixingPrompt(topic, keywords, contents, ctas, section, contentMode);
                        response = void 0;
                        if (!(provider === 'openai' && this.openai)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.openai.chat.completions.create({
                            model: 'gpt-4',
                            messages: [{ role: 'user', content: prompt_2 }],
                            temperature: 0.7
                        })];
                    case 1:
                        completion = _c.sent();
                        response = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(provider === 'gemini' && this.gemini)) return [3 /*break*/, 9];
                        models = ['gemini-2.0-flash', 'gemini-2.0-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash-thinking-exp'];
                        model = null;
                        lastError = null;
                        _i = 0, models_2 = models;
                        _c.label = 3;
                    case 3:
                        if (!(_i < models_2.length)) return [3 /*break*/, 8];
                        modelName = models_2[_i];
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 6, , 7]);
                        model = this.gemini.getGenerativeModel({ model: modelName });
                        return [4 /*yield*/, model.generateContent(prompt_2)];
                    case 5:
                        result = _c.sent();
                        response = result.response.text();
                        return [3 /*break*/, 8]; // 성공하면 중단
                    case 6:
                        error_17 = _c.sent();
                        errorMsg = String((error_17 === null || error_17 === void 0 ? void 0 : error_17.message) || error_17 || '');
                        isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
                        if (isRateLimit && models.indexOf(modelName) < models.length - 1) {
                            lastError = error_17;
                            return [3 /*break*/, 7]; // 할당량 초과 시 다음 모델 시도
                        }
                        throw error_17; // 다른 오류는 즉시 throw
                    case 7:
                        _i++;
                        return [3 /*break*/, 3];
                    case 8:
                        if (!response) {
                            throw lastError || new Error('사용 가능한 Gemini 모델이 없습니다.');
                        }
                        return [3 /*break*/, 10];
                    case 9: throw new Error('AI 모델이 설정되지 않았습니다.');
                    case 10:
                        console.log("[AI MIXER] ".concat(section.title, " \uC139\uC158 \uB0B4\uC6A9 \uBBF9\uC2F1 \uC644\uB8CC"));
                        return [2 /*return*/, response];
                    case 11:
                        error_18 = _c.sent();
                        console.error('[AI MIXER] 내용 믹싱 실패:', error_18);
                        throw error_18;
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 내용 믹싱 프롬프트 작성
     */
    ContentCrawler.prototype.buildContentMixingPrompt = function (topic, keywords, contents, ctas, section, contentMode) {
        var topContents = contents.slice(0, 5);
        var topCTAs = ctas.slice(0, 3);
        return "\uB2F9\uC2E0\uC740 \uC804\uBB38 \uBE14\uB85C\uADF8 \uC791\uAC00\uC785\uB2C8\uB2E4.\n\n\uD83D\uDCDD **\uC791\uC131 \uC8FC\uC81C**: \"".concat(topic, "\"\n\uD83D\uDD11 **\uD575\uC2EC \uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n\uD83D\uDCCB **\uC139\uC158**: ").concat(section.title, " (").concat(section.description, ")\n\uD83C\uDFAF **\uCF58\uD150\uCE20 \uBAA8\uB4DC**: ").concat(contentMode, "\n\n\uD83D\uDCCA **\uCC38\uACE0 \uC790\uB8CC (\uD06C\uB864\uB9C1\uD55C \uC2E4\uC81C \uBE14\uB85C\uADF8 \uAE00\uB4E4)**:\n").concat(topContents.map(function (content, i) { return "\n".concat(i + 1, ". **\uC81C\uBAA9**: ").concat(content.title, "\n   **\uB0B4\uC6A9**: ").concat(content.content.substring(0, 500), "...\n   **\uCD9C\uCC98**: ").concat(content.platform, "\n"); }).join('\n'), "\n\n\uD83D\uDD17 **\uCC38\uACE0 CTA (\uD06C\uB864\uB9C1\uD55C \uC2E4\uC81C CTA\uB4E4)**:\n").concat(topCTAs.map(function (cta, i) { return "\n".concat(i + 1, ". **\uD14D\uC2A4\uD2B8**: ").concat(cta.text, "\n   **URL**: ").concat(cta.url, "\n   **\uD0C0\uC785**: ").concat(cta.type, "\n"); }).join('\n'), "\n\n\uD83C\uDFAF **\uBAA9\uD45C**: \uC704 \uCC38\uACE0 \uC790\uB8CC\uB4E4\uC744 \uBC14\uD0D5\uC73C\uB85C \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uAD00\uC810\uC758 \uACE0\uD488\uC9C8 \uCF58\uD150\uCE20\uB97C \uC791\uC131\uD558\uC138\uC694.\n\n\u2705 **\uC694\uAD6C\uC0AC\uD56D**:\n1. \uCC38\uACE0 \uC790\uB8CC\uC758 \uC815\uBCF4\uB97C \uD65C\uC6A9\uD558\uB418 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uD45C\uD604\uC73C\uB85C \uC791\uC131\n2. ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uCDA9\uBD84\uD55C \uBD84\uB7C9\n3. \uB3C5\uCC3D\uC801\uC774\uACE0 \uCC28\uBCC4\uD654\uB41C \uB0B4\uC6A9\n4. \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC \uD3EC\uD568\n5. \"\uC65C\"\uBCF4\uB2E4\uB294 \"\uC5B4\uB5BB\uAC8C\"\uC5D0 60% \uBE44\uC911\uC744 \uB454 \uC2E4\uC6A9\uC801 \uC815\uBCF4 \uC81C\uACF5\n6. \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC778 \uBC29\uBC95\uACFC \uD301 \uC911\uC2EC\n7. \uCC38\uACE0 CTA\uC758 \uC2A4\uD0C0\uC77C\uC744 \uCC38\uACE0\uD574\uC11C \uC801\uC808\uD55C \uD589\uB3D9 \uC720\uB3C4 \uD3EC\uD568\n\n\u274C **\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D**:\n- \uCC38\uACE0 \uC790\uB8CC\uB97C \uADF8\uB300\uB85C \uBCF5\uC0AC\uD558\uC9C0 \uB9D0 \uAC83\n- \uC911\uAC04\uC5D0 \uACB0\uB860\uC774\uB098 \uB9C8\uBB34\uB9AC \uBB38\uAD6C \uC0AC\uC6A9 \uAE08\uC9C0\n- \uCF54\uB4DC\uB098 \uD568\uC218\uBA85\uC774 \uC11E\uC5EC\uC11C \uB098\uC624\uB294 \uAC83\n- \uACFC\uB3C4\uD55C \uD0A4\uC6CC\uB4DC \uC0BD\uC785\n\n\u2705 **\uCD9C\uB825 \uD615\uC2DD**:\nWordPress HTML \uBE14\uB85D \uD615\uC2DD\uC73C\uB85C \uC791\uC131\uD558\uC138\uC694:\n```html\n<!-- wp:html -->\n<div class=\"max-mode-section ").concat(section.id, "\" id=\"section-").concat(section.id, "\">\n  <h2>").concat(section.title, "</h2>\n  <div class=\"content\">\n    <!-- \uC5EC\uAE30\uC5D0 ").concat(section.minChars, "\uC790 \uC774\uC0C1\uC758 \uACE0\uD488\uC9C8 \uCF58\uD150\uCE20 \uC791\uC131 -->\n  </div>\n</div>\n<!-- /wp:html -->\n```\n\n\uD83D\uDCA1 **\uC791\uC131 \uAC00\uC774\uB4DC**:\n1. \uCC38\uACE0 \uC790\uB8CC\uC758 \uD575\uC2EC \uC815\uBCF4\uB97C \uD30C\uC545\uD558\uACE0 \uC0C8\uB85C\uC6B4 \uAC01\uB3C4\uB85C \uC7AC\uD574\uC11D\n2. \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB044\uB294 \uB3C4\uC785\uC73C\uB85C \uC2DC\uC791\n3. \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5\n4. \uC2E4\uC81C \uC0AC\uB840\uB098 \uACBD\uD5D8\uB2F4 \uD3EC\uD568\n5. \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uD301 \uC81C\uACF5\n6. \uC790\uC5F0\uC2A4\uB7EC\uC6B4 CTA \uD3EC\uD568\n\n\uC774\uC81C \"").concat(section.title, "\" \uC139\uC158\uC758 \uB0B4\uC6A9\uC744 \uCC38\uACE0 \uC790\uB8CC\uB97C \uBC14\uD0D5\uC73C\uB85C \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uAD00\uC810\uC5D0\uC11C \uC791\uC131\uD574\uC8FC\uC138\uC694.");
    };
    return ContentCrawler;
}());
exports.ContentCrawler = ContentCrawler;
var massCrawlerLogState = { signature: '' };
function logMassCrawler(level, message) {
    var args = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        args[_i - 2] = arguments[_i];
    }
    var signature = "".concat(level, "|").concat(message);
    if (massCrawlerLogState.signature === signature) {
        return;
    }
    massCrawlerLogState.signature = signature;
    switch (level) {
        case 'warn':
            console.warn.apply(console, __spreadArray([message], args, false));
            break;
        case 'error':
            console.error.apply(console, __spreadArray([message], args, false));
            break;
        default:
            console.log.apply(console, __spreadArray([message], args, false));
            break;
    }
}
/**
 * 통합 콘텐츠 크롤링 및 믹싱 함수
 * 폴백 순서: 네이버 API → RSS → CSE → 기본 데이터
 */
function crawlAndMixContent(topic_1, keywords_1) {
    return __awaiter(this, arguments, void 0, function (topic, keywords, options) {
        var openaiKey, geminiKey, naverClientId, naverClientSecret, googleCseKey, googleCseCx, _a, enableMassCrawling, _b, manualCrawlUrls, crawler, allContents, ctas, massResult, error_19, crawlPromises, crawlTimeoutPromise, crawlResults, error_20, sortedContents, error_21;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    openaiKey = options.openaiKey, geminiKey = options.geminiKey, naverClientId = options.naverClientId, naverClientSecret = options.naverClientSecret, googleCseKey = options.googleCseKey, googleCseCx = options.googleCseCx, _a = options.enableMassCrawling, enableMassCrawling = _a === void 0 ? true : _a, _b = options.manualCrawlUrls, manualCrawlUrls = _b === void 0 ? [] // 수동 크롤링 링크
                        : _b;
                    crawler = new ContentCrawler(openaiKey, geminiKey);
                    allContents = [];
                    ctas = [];
                    console.log("[CRAWLER] \uD83D\uDCCB \uD06C\uB864\uB9C1 \uC2DC\uC791: ".concat(enableMassCrawling ? '대량 크롤링' : '기존 크롤링', " \uBAA8\uB4DC"));
                    if (!(enableMassCrawling && naverClientId && naverClientSecret)) return [3 /*break*/, 4];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    console.log("[CRAWLER] \uD83D\uDE80 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2DC\uC2A4\uD15C \uCD08\uAE30\uD654...");
                    console.log("[CRAWLER] \uD83D\uDD11 API \uD0A4 \uD655\uC778: Naver=".concat(!!naverClientId && !!naverClientSecret, ", Google CSE=").concat(!!googleCseKey && !!googleCseCx));
                    crawler.initializeMassCrawler(naverClientId, naverClientSecret, googleCseKey || undefined, googleCseCx || undefined);
                    return [4 /*yield*/, crawler.crawlMassiveMultiKeyword(topic, keywords, {
                        maxResults: 2000,
                        enableFullContent: true,
                        maxConcurrent: 20,
                        manualUrls: manualCrawlUrls || [] // 수동 크롤링 링크 전달
                    })];
                case 2:
                    massResult = _c.sent();
                    allContents = massResult.contents;
                    ctas = massResult.ctas;
                    console.log("[CRAWLER] \u2705 \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(allContents.length, "\uAC1C \uAE00, ").concat(ctas.length, "\uAC1C CTA"));
                    console.log("[CRAWLER] \uD83D\uDCCA \uD1B5\uACC4:", massResult.stats);
                    console.log("[CRAWLER] \uD83D\uDD0D \uBD84\uC11D \uACB0\uACFC:", massResult.analysis);
                    // 크롤링 결과 상세 검증
                    if (allContents.length > 0) {
                        console.log("[CRAWLER] \uD83D\uDCCB \uC2E4\uC81C \uD06C\uB864\uB9C1\uB41C \uCF58\uD150\uCE20 \uC0D8\uD50C (\uC0C1\uC704 5\uAC1C):");
                        allContents.slice(0, 5).forEach(function (content, index) {
                            console.log("[CRAWLER] ".concat(index + 1, ". \uC81C\uBAA9: ").concat(content.title));
                            console.log("[CRAWLER]    URL: ".concat(content.url));
                            console.log("[CRAWLER]    \uAD00\uB828\uC131: ".concat(content.relevance, "/10"));
                            console.log("[CRAWLER]    \uCD9C\uCC98: ".concat(content.source));
                        });
                    }
                    if (ctas.length > 0) {
                        console.log("[CRAWLER] \uD83D\uDD17 \uC2E4\uC81C \uD06C\uB864\uB9C1\uB41C CTA \uC0D8\uD50C (\uC0C1\uC704 5\uAC1C):");
                        ctas.slice(0, 5).forEach(function (cta, index) {
                            console.log("[CRAWLER] ".concat(index + 1, ". \uD14D\uC2A4\uD2B8: ").concat(cta.text));
                            console.log("[CRAWLER]    \uD6C4\uD0B9\uBA58\uD2B8: ".concat(cta.hook));
                            console.log("[CRAWLER]    URL: ".concat(cta.url));
                            console.log("[CRAWLER]    \uC678\uBD80\uB9C1\uD06C: ".concat(cta.isExternal ? 'YES' : 'NO'));
                        });
                    }
                    if (allContents.length === 0 && ctas.length === 0) {
                        console.log("[CRAWLER] \u26A0\uFE0F \uB300\uB7C9 \uD06C\uB864\uB9C1\uC5D0\uC11C \uC2E4\uC81C \uB370\uC774\uD130\uB97C \uC218\uC9D1\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
                        console.log("[CRAWLER] \uD83D\uDD27 \uB124\uC774\uBC84 API \uD0A4\uC640 \uAD6C\uAE00 CSE \uC124\uC815\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.");
                    }
                    return [2 /*return*/, { contents: allContents, ctas: ctas }];
                case 3:
                    error_19 = _c.sent();
                    console.error("[CRAWLER] \u274C \uB300\uB7C9 \uD06C\uB864\uB9C1 \uC2E4\uD328, \uAE30\uC874 \uBC29\uC2DD\uC73C\uB85C \uD3F4\uBC31:", error_19);
                    return [3 /*break*/, 4];
                case 4:
                    // 기존 크롤링 방식 (폴백)
                    console.log("[CRAWLER] \uD83D\uDCCB \uAE30\uC874 \uD06C\uB864\uB9C1 \uBCD1\uB82C \uCC98\uB9AC \uC2DC\uC791: \uB124\uC774\uBC84 API + RSS + CSE \uB3D9\uC2DC \uC2E4\uD589");
                    crawlPromises = [
                        // 네이버 API 크롤링 (API 키가 있을 때만 실행)
                        (naverClientId && naverClientSecret) ? crawler.crawlFromNaverAPI({
                            topic: topic,
                            keywords: keywords,
                            maxResults: 50, // 성능 최적화: 100 -> 50으로 감소
                            naverClientId: naverClientId,
                            naverClientSecret: naverClientSecret
                        }).catch(function (error) {
                            console.log("[CRAWLER] \u274C \uB124\uC774\uBC84 API \uC2E4\uD328: ".concat(error));
                            return [];
                        }) : Promise.resolve([]),
                        // RSS 크롤링 (항상 실행 가능)
                        crawler.crawlFromRSS({
                            topic: topic,
                            keywords: keywords,
                            maxResults: 50 // 성능 최적화: 80 -> 50으로 감소
                        }).catch(function (error) {
                            console.log("[CRAWLER] \u274C RSS \uC2E4\uD328: ".concat(error));
                            return [];
                        }),
                        // CSE 크롤링 (API 키가 있을 때만 실행)
                        (googleCseKey && googleCseCx) ? crawler.crawlFromCSE({
                            topic: topic,
                            keywords: keywords,
                            maxResults: 30, // 성능 최적화: 50 -> 30으로 감소
                            googleCseKey: googleCseKey,
                            googleCseCx: googleCseCx
                        }).catch(function (error) {
                            console.log("[CRAWLER] \u274C CSE \uC2E4\uD328: ".concat(error));
                            return [];
                        }) : Promise.resolve([])
                    ];
                    crawlTimeoutPromise = new Promise(function (_, reject) {
                        setTimeout(function () {
                            reject(new Error('크롤링 전체 시간 초과: 45초를 초과했습니다.'));
                        }, 45 * 1000); // 45초 (성능 최적화)
                    });
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, Promise.race([
                        Promise.all(crawlPromises),
                        crawlTimeoutPromise
                    ])];
                case 6:
                    crawlResults = _c.sent();
                    // 결과 병합
                    crawlResults.forEach(function (contents, index) {
                        if (contents && contents.length > 0) {
                            allContents.push.apply(allContents, contents);
                            var source = index === 0 ? '네이버 API' : index === 1 ? 'RSS' : 'CSE';
                            console.log("[CRAWLER] \u2705 ".concat(source, " \uC131\uACF5: ").concat(contents.length, "\uAC1C \uAE00 \uC218\uC9D1"));
                        }
                    });
                    console.log("[CRAWLER] \u2705 \uBCD1\uB82C \uD06C\uB864\uB9C1 \uC644\uB8CC: \uCD1D ".concat(allContents.length, "\uAC1C \uAE00 \uC218\uC9D1"));
                    return [3 /*break*/, 8];
                case 7:
                    error_20 = _c.sent();
                    console.log("[CRAWLER] \u274C \uD06C\uB864\uB9C1 \uC804\uCCB4 \uC2E4\uD328: ".concat(error_20, ", \uAE30\uBCF8 \uB370\uC774\uD130 \uC0AC\uC6A9"));
                    allContents = [];
                    return [3 /*break*/, 8];
                case 8:
                    // 🛡️ 4단계: 기본 데이터 (최종 폴백)
                    if (allContents.length === 0) {
                        console.log("[CRAWLER] \uD83D\uDEE1\uFE0F 4\uB2E8\uACC4: \uBAA8\uB4E0 \uD06C\uB864\uB9C1 \uC2E4\uD328, \uAE30\uBCF8 \uB370\uC774\uD130 \uC0DD\uC131...");
                        allContents = generateDefaultContents(topic, keywords);
                    }
                    sortedContents = allContents
                        .sort(function (a, b) { return b.relevance - a.relevance; })
                        .slice(0, 20);
                    if (!(sortedContents.length > 0)) return [3 /*break*/, 13];
                    _c.label = 9;
                case 9:
                    _c.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, crawler.crawlCTAFromContent(sortedContents)];
                case 10:
                    ctas = _c.sent();
                    console.log("[CRAWLER] \u2705 CTA \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(ctas.length, "\uAC1C CTA \uC218\uC9D1"));
                    return [3 /*break*/, 12];
                case 11:
                    error_21 = _c.sent();
                    console.log("[CRAWLER] \u26A0\uFE0F CTA \uD06C\uB864\uB9C1 \uC2E4\uD328, \uAE30\uBCF8 CTA \uC0AC\uC6A9: ".concat(error_21));
                    ctas = generateDefaultCTAs(topic, keywords);
                    return [3 /*break*/, 12];
                case 12: return [3 /*break*/, 14];
                case 13:
                    console.log("[CRAWLER] \uD83D\uDEE1\uFE0F \uAE30\uBCF8 CTA \uC0DD\uC131...");
                    ctas = generateDefaultCTAs(topic, keywords);
                    _c.label = 14;
                case 14:
                    console.log("[CRAWLER] \uD83C\uDFAF \uCD5C\uC885 \uACB0\uACFC: ".concat(sortedContents.length, "\uAC1C \uAE00, ").concat(ctas.length, "\uAC1C CTA"));
                    return [2 /*return*/, { contents: sortedContents, ctas: ctas }];
            }
        });
    });
}
/**
 * 기본 콘텐츠 생성 (모든 크롤링 실패 시)
 */
function generateDefaultContents(topic, keywords) {
    return [
        {
            title: "".concat(topic, "\uC5D0 \uB300\uD55C \uAE30\uBCF8 \uC815\uBCF4"),
            content: "".concat(topic, "\uC740 \uB9CE\uC740 \uC0AC\uB78C\uB4E4\uC774 \uAD00\uC2EC\uC744 \uAC00\uC9C0\uACE0 \uC788\uB294 \uC8FC\uC81C\uC785\uB2C8\uB2E4. \uC774 \uAE00\uC5D0\uC11C\uB294 ").concat(keywords.join(', '), " \uB4F1\uC5D0 \uB300\uD574 \uC54C\uC544\uBCF4\uACA0\uC2B5\uB2C8\uB2E4."),
            source: 'default',
            platform: 'rss',
            relevance: 5,
            url: '#'
        },
        {
            title: "".concat(topic, "\uC758 \uC911\uC694\uC131\uACFC \uAC00\uCE58"),
            content: "".concat(topic, "\uC740 \uD604\uB300 \uC0AC\uD68C\uC5D0\uC11C \uC911\uC694\uD55C \uC5ED\uD560\uC744 \uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4. \uD2B9\uD788 ").concat(keywords[0] || '관련 분야', "\uC5D0\uC11C \uADF8 \uC911\uC694\uC131\uC774 \uB354\uC6B1 \uBD80\uAC01\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4."),
            source: 'default',
            platform: 'rss',
            relevance: 4,
            url: '#'
        }
    ];
}
/**
 * 기본 CTA 생성 (모든 크롤링 실패 시)
 */
function generateDefaultCTAs(_topic, _keywords) {
    return [
        {
            text: '더 알아보기',
            url: '#',
            type: 'button',
            context: 'default',
            source: 'default',
            relevance: 3
        },
        {
            text: '관련 정보 확인',
            url: '#',
            type: 'link',
            context: 'default',
            source: 'default',
            relevance: 2
        }
    ];
}
