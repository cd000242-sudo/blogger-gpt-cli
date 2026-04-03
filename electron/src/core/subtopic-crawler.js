"use strict";
// src/core/subtopic-crawler.ts
// 소제목 크롤링 및 AI 생성 기능
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
exports.SubtopicCrawler = void 0;
exports.generateOptimalSubtopic = generateOptimalSubtopic;
var generative_ai_1 = require("@google/generative-ai");
var openai_1 = require("openai");
var SubtopicCrawler = /** @class */ (function () {
    function SubtopicCrawler(openaiKey, geminiKey) {
        if (openaiKey) {
            this.openai = new openai_1.default({ apiKey: openaiKey });
        }
        if (geminiKey) {
            this.gemini = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        }
    }
    /**
     * 네이버 API를 사용해서 소제목 크롤링
     */
    SubtopicCrawler.prototype.crawlSubtopicFromNaver = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, _a, maxResults, naverClientId, naverClientSecret, searchQuery, encodedQuery, apiUrl, response, data, subtopics, _i, _b, item, blogSubtopic, error_1, error_2;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords, _a = config.maxResults, maxResults = _a === void 0 ? 5 : _a, naverClientId = config.naverClientId, naverClientSecret = config.naverClientSecret;
                        if (!naverClientId || !naverClientSecret) {
                            console.log('[NAVER SUBTITLE] 네이버 API 키가 없어서 건너뛰기');
                            console.log("[NAVER SUBTITLE DEBUG] naverClientId: ".concat(naverClientId ? '있음' : '없음', ", naverClientSecret: ").concat(naverClientSecret ? '있음' : '없음'));
                            return [2 /*return*/, []];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 10, , 11]);
                        console.log("[NAVER SUBTITLE] \"".concat(topic, "\" \uB124\uC774\uBC84 \uBE14\uB85C\uADF8 \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
                        searchQuery = "".concat(topic, " ").concat(keywords.join(' '));
                        encodedQuery = encodeURIComponent(searchQuery);
                        apiUrl = "https://openapi.naver.com/v1/search/blog.json?query=".concat(encodedQuery, "&display=").concat(maxResults, "&sort=sim");
                        return [4 /*yield*/, fetch(apiUrl, {
                            headers: {
                                'X-Naver-Client-Id': naverClientId,
                                'X-Naver-Client-Secret': naverClientSecret
                            }
                        })];
                    case 2:
                        response = _c.sent();
                        if (!response.ok) {
                            console.log("[NAVER SUBTITLE] API \uD638\uCD9C \uC2E4\uD328: ".concat(response.status));
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _c.sent();
                        subtopics = [];
                        _i = 0, _b = data.items || [];
                        _c.label = 4;
                    case 4:
                        if (!(_i < _b.length)) return [3 /*break*/, 9];
                        item = _b[_i];
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.crawlNaverBlogSubtopic(item.link, topic, keywords)];
                    case 6:
                        blogSubtopic = _c.sent();
                        if (blogSubtopic.length > 0) {
                            subtopics.push.apply(subtopics, blogSubtopic);
                        }
                        return [3 /*break*/, 8];
                    case 7:
                        error_1 = _c.sent();
                        console.log("[NAVER SUBTITLE] \uBE14\uB85C\uADF8 \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(item.link));
                        return [3 /*break*/, 8];
                    case 8:
                        _i++;
                        return [3 /*break*/, 4];
                    case 9:
                        console.log("[NAVER SUBTITLE] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(subtopics.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC218\uC9D1"));
                        return [2 /*return*/, subtopics.slice(0, 10)];
                    case 10:
                        error_2 = _c.sent();
                        console.error('[NAVER SUBTITLE] 네이버 API 크롤링 실패:', error_2);
                        return [2 /*return*/, []];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * RSS 피드에서 소제목 크롤링
     */
    SubtopicCrawler.prototype.crawlSubtopicFromRSS = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, rssFeeds, subtopics, _i, rssFeeds_1, feedUrl, response, xmlText, rssSubtopic, error_3, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 9, , 10]);
                        console.log("[RSS SUBTITLE] \"".concat(topic, "\" RSS \uD53C\uB4DC \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
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
                        subtopics = [];
                        _i = 0, rssFeeds_1 = rssFeeds;
                        _a.label = 2;
                    case 2:
                        if (!(_i < rssFeeds_1.length)) return [3 /*break*/, 8];
                        feedUrl = rssFeeds_1[_i];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, fetch(feedUrl)];
                    case 4:
                        response = _a.sent();
                        if (!response.ok)
                            return [3 /*break*/, 7];
                        return [4 /*yield*/, response.text()];
                    case 5:
                        xmlText = _a.sent();
                        rssSubtopic = this.parseRSSSubtopic(xmlText, topic, keywords);
                        subtopics.push.apply(subtopics, rssSubtopic);
                        return [3 /*break*/, 7];
                    case 6:
                        error_3 = _a.sent();
                        console.log("[RSS SUBTITLE] \uD53C\uB4DC \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(feedUrl));
                        return [3 /*break*/, 7];
                    case 7:
                        _i++;
                        return [3 /*break*/, 2];
                    case 8:
                        console.log("[RSS SUBTITLE] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(subtopics.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC218\uC9D1"));
                        return [2 /*return*/, subtopics.slice(0, 10)];
                    case 9:
                        error_4 = _a.sent();
                        console.error('[RSS SUBTITLE] RSS 크롤링 실패:', error_4);
                        return [2 /*return*/, []];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Google CSE를 사용해서 주제 관련 검색 결과에서 소제목 크롤링
     */
    SubtopicCrawler.prototype.crawlSubtopicFromGoogle = function (config) {
        return __awaiter(this, void 0, void 0, function () {
            var topic, keywords, _a, maxResults, googleCseKey, googleCseCx, searchQuery_1, safeCSERequest, data, subtopics, _i, _b, item, pageSubtopic, error_5, rankedSubtopic, error_6;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        topic = config.topic, keywords = config.keywords, _a = config.maxResults, maxResults = _a === void 0 ? 20 : _a, googleCseKey = config.googleCseKey, googleCseCx = config.googleCseCx;
                        if (!googleCseKey || !googleCseCx) {
                            console.log('[CRAWLER] Google CSE 키가 없어서 기본 소제목 생성');
                            return [2 /*return*/, this.generateDefaultSubtopic(topic, keywords)];
                        }
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 10, , 11]);
                        console.log("[CRAWLER] \"".concat(topic, "\" \uAD00\uB828 \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uC791..."));
                        searchQuery_1 = "".concat(topic, " ").concat(keywords.join(' '));
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/google-cse-rate-limiter'); })];
                    case 2:
                        safeCSERequest = (_c.sent()).safeCSERequest;
                        return [4 /*yield*/, safeCSERequest(searchQuery_1, function () {
                            return __awaiter(_this, void 0, void 0, function () {
                                var searchUrl, response;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            searchUrl = "https://www.googleapis.com/customsearch/v1?key=".concat(googleCseKey, "&cx=").concat(googleCseCx, "&q=").concat(encodeURIComponent(searchQuery_1), "&num=").concat(maxResults);
                                            return [4 /*yield*/, fetch(searchUrl)];
                                        case 1:
                                            response = _a.sent();
                                            if (!response.ok) {
                                                throw new Error("HTTP ".concat(response.status));
                                            }
                                            return [4 /*yield*/, response.json()];
                                        case 2: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            });
                        }, { useCache: true, priority: 'normal' })];
                    case 3:
                        data = _c.sent();
                        if (!(data === null || data === void 0 ? void 0 : data.items) || data.items.length === 0) {
                            console.log('[CRAWLER] 검색 결과가 없어서 기본 소제목 생성');
                            return [2 /*return*/, this.generateDefaultSubtopic(topic, keywords)];
                        }
                        subtopics = [];
                        _i = 0, _b = data.items;
                        _c.label = 4;
                    case 4:
                        if (!(_i < _b.length)) return [3 /*break*/, 9];
                        item = _b[_i];
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 7, , 8]);
                        return [4 /*yield*/, this.crawlPageSubtopic(item.link, topic, keywords)];
                    case 6:
                        pageSubtopic = _c.sent();
                        subtopics.push.apply(subtopics, pageSubtopic);
                        return [3 /*break*/, 8];
                    case 7:
                        error_5 = _c.sent();
                        console.log("[CRAWLER] \uD398\uC774\uC9C0 \uD06C\uB864\uB9C1 \uC2E4\uD328: ".concat(item.link));
                        return [3 /*break*/, 8];
                    case 8:
                        _i++;
                        return [3 /*break*/, 4];
                    case 9:
                        rankedSubtopic = this.rankSubtopicByFrequency(subtopics);
                        console.log("[CRAWLER] \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(rankedSubtopic.length, "\uAC1C \uC18C\uC81C\uBAA9 \uCD94\uCD9C"));
                        return [2 /*return*/, rankedSubtopic.slice(0, 5)];
                    case 10:
                        error_6 = _c.sent();
                        console.error('[CRAWLER] Google CSE 크롤링 실패:', error_6);
                        return [2 /*return*/, this.generateDefaultSubtopic(topic, keywords)];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 개별 페이지에서 소제목 추출
     */
    SubtopicCrawler.prototype.crawlPageSubtopic = function (url, topic, keywords) {
        return __awaiter(this, void 0, void 0, function () {
            var response, html, subtopics_1, h2Matches, h3Matches, error_7;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, fetch(url, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        html = _a.sent();
                        subtopics_1 = [];
                        h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
                        h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
                        __spreadArray(__spreadArray([], h2Matches, true), h3Matches, true).forEach(function (match) {
                            var text = match.replace(/<[^>]+>/g, '').trim();
                            if (_this.isRelevantSubtopic(text, topic, keywords)) {
                                subtopics_1.push({
                                    title: text,
                                    frequency: 1,
                                    source: url,
                                    relevance: _this.calculateRelevance(text, topic, keywords)
                                });
                            }
                        });
                        return [2 /*return*/, subtopics_1];
                    case 3:
                        error_7 = _a.sent();
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 소제목이 주제와 관련이 있는지 확인
     */
    SubtopicCrawler.prototype.isRelevantSubtopic = function (text, topic, keywords) {
        var lowerText = text.toLowerCase();
        var lowerTopic = topic.toLowerCase();
        // 너무 짧거나 긴 제목 제외
        if (text.length < 5 || text.length > 100)
            return false;
        // 주제나 키워드와 관련이 있는지 확인
        var hasTopicKeyword = keywords.some(function (keyword) {
            return lowerText.includes(keyword.toLowerCase());
        });
        var hasTopicWord = lowerText.includes(lowerTopic) ||
            lowerTopic.includes(lowerText);
        return hasTopicKeyword || hasTopicWord;
    };
    /**
     * 소제목의 관련도 계산
     */
    SubtopicCrawler.prototype.calculateRelevance = function (text, topic, keywords) {
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
     * 빈도수 기반으로 소제목 순위 매기기
     */
    SubtopicCrawler.prototype.rankSubtopicByFrequency = function (subtopics) {
        var frequencyMap = new Map();
        subtopics.forEach(function (subtopic) {
            var normalized = subtopic.title.toLowerCase().trim();
            var existing = frequencyMap.get(normalized);
            if (existing) {
                existing.frequency += subtopic.frequency;
                existing.relevance = Math.max(existing.relevance, subtopic.relevance);
            }
            else {
                frequencyMap.set(normalized, __assign({}, subtopic));
            }
        });
        return Array.from(frequencyMap.values())
            .sort(function (a, b) {
                // 빈도수 우선, 그 다음 관련도
                if (b.frequency !== a.frequency) {
                    return b.frequency - a.frequency;
                }
                return b.relevance - a.relevance;
            });
    };
    /**
     * 네이버 블로그에서 소제목 크롤링
     */
    SubtopicCrawler.prototype.crawlNaverBlogSubtopic = function (url, topic, keywords) {
        return __awaiter(this, void 0, void 0, function () {
            var response, html, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fetch(url, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                                'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
                                'Accept-Encoding': 'gzip, deflate, br',
                                'Connection': 'keep-alive',
                                'Upgrade-Insecure-Requests': '1'
                            }
                        })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.tryProxyFetchSubtopic(url)];
                    case 2:
                        // 프록시 서버를 통한 우회 시도
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("HTTP ".concat(response.status));
                        }
                        _a.label = 3;
                    case 3: return [4 /*yield*/, response.text()];
                    case 4:
                        html = _a.sent();
                        return [2 /*return*/, this.extractSubtopicFromHTML(html, url, topic, keywords)];
                    case 5:
                        error_8 = _a.sent();
                        console.log("[NAVER SUBTITLE] \uC6B0\uD68C \uD06C\uB864\uB9C1\uB3C4 \uC2E4\uD328: ".concat(url));
                        return [2 /*return*/, []];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 프록시를 통한 우회 시도 (소제목용)
     */
    SubtopicCrawler.prototype.tryProxyFetchSubtopic = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var proxyServices, _i, proxyServices_1, proxyUrl, response, error_9;
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
                        error_9 = _a.sent();
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
     * RSS XML에서 소제목 파싱
     */
    SubtopicCrawler.prototype.parseRSSSubtopic = function (xmlText, topic, keywords) {
        var subtopics = [];
        try {
            // 간단한 XML 파싱 (정규식 사용)
            var itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
            for (var _i = 0, itemMatches_1 = itemMatches; _i < itemMatches_1.length; _i++) {
                var item = itemMatches_1[_i];
                var titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
                var linkMatch = item.match(/<link>(.*?)<\/link>/i);
                if (titleMatch && linkMatch) {
                    var title = titleMatch[1] || titleMatch[2] || '';
                    var link = linkMatch[1] || '';
                    if (this.isRelevantSubtopic(title, topic, keywords)) {
                        subtopics.push({
                            title: title.trim(),
                            frequency: 1,
                            source: link,
                            relevance: this.calculateRelevance(title, topic, keywords)
                        });
                    }
                }
            }
        }
        catch (error) {
            console.error('[RSS SUBTITLE] XML 파싱 오류:', error);
        }
        return subtopics;
    };
    /**
     * HTML에서 소제목 추출
     */
    SubtopicCrawler.prototype.extractSubtopicFromHTML = function (html, url, topic, keywords) {
        var _this = this;
        var subtopics = [];
        try {
            // H2, H3 태그에서 소제목 추출
            var h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
            var h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
            __spreadArray(__spreadArray([], h2Matches, true), h3Matches, true).forEach(function (match) {
                var text = match.replace(/<[^>]+>/g, '').trim();
                if (_this.isRelevantSubtopic(text, topic, keywords)) {
                    subtopics.push({
                        title: text,
                        frequency: 1,
                        source: url,
                        relevance: _this.calculateRelevance(text, topic, keywords)
                    });
                }
            });
        }
        catch (error) {
            console.error('[SUBTITLE] HTML 파싱 오류:', error);
        }
        return subtopics;
    };
    /**
     * 기본 소제목 생성 (크롤링 실패 시)
     */
    SubtopicCrawler.prototype.generateDefaultSubtopic = function (topic, _keywords) {
        var defaultSubtopic = [
            "".concat(topic, "\uC758 \uAE30\uBCF8 \uAC1C\uB150\uACFC \uC774\uD574"),
            "".concat(topic, "\uC758 \uC8FC\uC694 \uD2B9\uC9D5\uACFC \uC7A5\uC810"),
            "".concat(topic, "\uC758 \uD65C\uC6A9 \uBC29\uBC95\uACFC \uC0AC\uB840"),
            "".concat(topic, "\uC758 \uC8FC\uC758\uC0AC\uD56D\uACFC \uD55C\uACC4"),
            "".concat(topic, "\uC758 \uBBF8\uB798 \uC804\uB9DD\uACFC \uBC1C\uC804 \uBC29\uD5A5")
        ];
        return defaultSubtopic.map(function (title, index) {
            return ({
                title: title,
                frequency: 1,
                source: 'default',
                relevance: 5 - index
            });
        });
    };
    /**
     * AI를 사용해서 크롤링한 데이터를 바탕으로 완전히 새로운 소제목 생성
     */
    SubtopicCrawler.prototype.generateAISubtopic = function (topic_1, keywords_1, crawledData_1) {
        return __awaiter(this, arguments, void 0, function (topic, keywords, crawledData, provider) {
            var prompt_1, response, completion, models, model, lastError, _i, models_1, modelName, result, error_10, errorMsg, isRateLimit, subtopic, error_11;
            var _a, _b;
            if (provider === void 0) { provider = 'gemini'; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 11, , 12]);
                        console.log('[AI GENERATOR] 크롤링 데이터 기반 AI 소제목 생성 시작...');
                        prompt_1 = this.buildAISubtopicPrompt(topic, keywords, crawledData);
                        response = void 0;
                        if (!(provider === 'openai' && this.openai)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.openai.chat.completions.create({
                            model: 'gpt-4',
                            messages: [{ role: 'user', content: prompt_1 }],
                            temperature: 0.7
                        })];
                    case 1:
                        completion = _c.sent();
                        response = ((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || '';
                        return [3 /*break*/, 10];
                    case 2:
                        if (!(provider === 'gemini' && this.gemini)) return [3 /*break*/, 9];
                        models = ['gemini-2.5-flash', 'gemini-3-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-preview-09-2025'];
                        model = null;
                        lastError = null;
                        _i = 0, models_1 = models;
                        _c.label = 3;
                    case 3:
                        if (!(_i < models_1.length)) return [3 /*break*/, 8];
                        modelName = models_1[_i];
                        _c.label = 4;
                    case 4:
                        _c.trys.push([4, 6, , 7]);
                        model = this.gemini.getGenerativeModel({ model: modelName });
                        return [4 /*yield*/, model.generateContent(prompt_1)];
                    case 5:
                        result = _c.sent();
                        response = result.response.text();
                        return [3 /*break*/, 8]; // 성공하면 중단
                    case 6:
                        error_10 = _c.sent();
                        errorMsg = String((error_10 === null || error_10 === void 0 ? void 0 : error_10.message) || error_10 || '');
                        isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
                        if (isRateLimit && models.indexOf(modelName) < models.length - 1) {
                            lastError = error_10;
                            return [3 /*break*/, 7]; // 할당량 초과 시 다음 모델 시도
                        }
                        throw error_10; // 다른 오류는 즉시 throw
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
                        subtopic = this.extractSubtopicFromResponse(response);
                        console.log("[AI GENERATOR] AI \uC18C\uC81C\uBAA9 \uC0DD\uC131 \uC644\uB8CC: ".concat(subtopic.length, "\uAC1C"));
                        return [2 /*return*/, subtopic];
                    case 11:
                        error_11 = _c.sent();
                        console.error('[AI GENERATOR] AI 소제목 생성 실패:', error_11);
                        // 실패 시 크롤링 데이터에서 상위 5개 반환
                        return [2 /*return*/, crawledData.slice(0, 5).map(function (item) { return item.title; })];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * AI 소제목 생성 프롬프트 작성
     */
    SubtopicCrawler.prototype.buildAISubtopicPrompt = function (topic, keywords, crawledData) {
        // 빈도수와 관련성을 기준으로 정렬
        var sortedData = crawledData
            .sort(function (a, b) {
                // 1순위: 빈도수 높은 순
                if (b.frequency !== a.frequency) {
                    return b.frequency - a.frequency;
                }
                // 2순위: 관련성 높은 순
                return b.relevance - a.relevance;
            })
            .slice(0, 10);
        var topSubtopic = sortedData.map(function (item) { return item.title; });
        var frequencyData = sortedData.map(function (item) { return "\uBE48\uB3C4\uC218: ".concat(item.frequency, ", \uAD00\uB828\uC131: ").concat(item.relevance); });
        // 주제 타입 감지 (일정표, 표, 스케줄 관련)
        var isScheduleContent = topic.includes('일정') || topic.includes('스케줄') || topic.includes('표') ||
            topic.includes('schedule') || topic.includes('table') || topic.includes('time');
        var contentType = isScheduleContent ? '일정표/표 형태 콘텐츠' : '일반 블로그 콘텐츠';
        var contentGuidance = isScheduleContent ?
            '일정표나 표 형태의 정보를 다루는 주제입니다. 체계적이고 정확한 정보 전달에 중점을 두세요.' :
            '일반적인 블로그 글 형태로 작성하세요.';
        return "\uB2F9\uC2E0\uC740 \uBE14\uB85C\uADF8 \uCF58\uD150\uCE20 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4.\n\n\uD83D\uDCDD **\uC8FC\uC81C**: \"".concat(topic, "\" (").concat(contentType, ")\n\uD83D\uDD11 **\uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n\n\uD83D\uDCCA **\uD06C\uB864\uB9C1\uB41C \uC18C\uC81C\uBAA9 \uB370\uC774\uD130 (\uBE48\uB3C4\uC218 \uC21C)**:\n").concat(topSubtopic.map(function (title, i) { return "".concat(i + 1, ". ").concat(title, " (").concat(frequencyData[i], ")"); }).join('\n'), "\n\n\uD83C\uDFAF **\uBAA9\uD45C**: \uC704 \uD06C\uB864\uB9C1 \uB370\uC774\uD130\uB97C \uAE30\uBC18\uC73C\uB85C \uC21C\uC704\uBCC4\uB85C 5\uAC1C\uC758 \uC18C\uC81C\uBAA9\uC744 \uC0DD\uC131\uD558\uC138\uC694.\n\n\u2705 **\uC694\uAD6C\uC0AC\uD56D**:\n1. \uC815\uD655\uD788 5\uAC1C\uC758 \uC18C\uC81C\uBAA9\uB9CC \uC0DD\uC131\n2. \uD06C\uB864\uB9C1\uB41C \uB370\uC774\uD130\uB97C \uCC38\uACE0\uD558\uB418 **\uC0B4\uC9DD \uBCC0\uD615**\uD558\uC5EC \uC0DD\uC131\n3. \uC21C\uC11C\uB294 \uBE48\uB3C4\uC218 \uC21C\uC11C\uB97C \uC720\uC9C0\uD558\uB418 **\uD45C\uD604\uC744 \uB2E4\uB974\uAC8C** \uBCC0\uACBD\n4. \uAC01 \uC18C\uC81C\uBAA9\uC740 15-30\uC790 \uB0B4\uC678 (\uC9E7\uACE0 \uAC04\uACB0\uD558\uAC8C)\n5. \uD0A4\uC6CC\uB4DC\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568\n6. ").concat(contentGuidance, "\n\n\u274C **\uAE08\uC9C0\uC0AC\uD56D**:\n- \uC18C\uC81C\uBAA9 \uB4A4\uC5D0 \"\uAC00\uC774\uB4DC\", \"\uC644\uBCBD \uC815\uB9AC\", \"\uCD1D\uC815\uB9AC\" \uB4F1 \uCD94\uAC00\uD558\uC9C0 \uB9D0 \uAC83\n- \uC6D0\uBCF8 \uD06C\uB864\uB9C1 \uB370\uC774\uD130\uB97C \uADF8\uB300\uB85C \uBCF5\uC0AC\uD558\uC9C0 \uB9D0 \uAC83\n- \uB108\uBB34 \uAE38\uAC70\uB098 \uBCF5\uC7A1\uD55C \uC81C\uBAA9 \uAE08\uC9C0\n\n\uD83D\uDCCB **\uCD9C\uB825 \uD615\uC2DD**:\n\uC18C\uC81C\uBAA9:\n1. [\uCCAB \uBC88\uC9F8 \uC18C\uC81C\uBAA9 (\uCD5C\uACE0 \uBE48\uB3C4, \uC0B4\uC9DD \uBCC0\uD615)]\n2. [\uB450 \uBC88\uC9F8 \uC18C\uC81C\uBAA9 (\uB450 \uBC88\uC9F8 \uBE48\uB3C4, \uC0B4\uC9DD \uBCC0\uD615)]\n3. [\uC138 \uBC88\uC9F8 \uC18C\uC81C\uBAA9 (\uC138 \uBC88\uC9F8 \uBE48\uB3C4, \uC0B4\uC9DD \uBCC0\uD615)]\n4. [\uB124 \uBC88\uC9F8 \uC18C\uC81C\uBAA9 (\uB124 \uBC88\uC9F8 \uBE48\uB3C4, \uC0B4\uC9DD \uBCC0\uD615)]\n5. [\uB2E4\uC12F \uBC88\uC9F8 \uC18C\uC81C\uBAA9 (\uB2E4\uC12F \uBC88\uC9F8 \uBE48\uB3C4, \uC0B4\uC9DD \uBCC0\uD615)]\n\n\uC774\uC81C \"").concat(topic, "\"\uC5D0 \uB300\uD55C \uD06C\uB864\uB9C1 \uAE30\uBC18 \uC21C\uC704\uBCC4 \uC18C\uC81C\uBAA9 5\uAC1C\uB97C **\uC0B4\uC9DD \uBCC0\uD615**\uD558\uC5EC \uC0DD\uC131\uD574\uC8FC\uC138\uC694.");
    };
    /**
     * AI 응답에서 소제목 추출
     */
    SubtopicCrawler.prototype.extractSubtopicFromResponse = function (response) {
        var lines = response.split('\n');
        var subtopic = [];
        lines.forEach(function (line) {
            var match = line.match(/^\d+\.\s*(.+)$/);
            if (match && match[1]) {
                var title = match[1].trim();
                if (title.length >= 5 && title.length <= 100) {
                    subtopic.push(title);
                }
            }
        });
        return subtopic.slice(0, 5); // 최대 5개만 반환
    };
    /**
     * 소제목을 기반으로 작은 소제목(H3) 생성
     */
    SubtopicCrawler.prototype.generateSmallSubtopic = function (mainSubtopic_1, topic_1, keywords_1) {
        return __awaiter(this, arguments, void 0, function (mainSubtopic, topic, keywords, provider) {
            var prompt_2, response, completion, models, model, lastError, _i, models_2, modelName, result, error_12, errorMsg, isRateLimit, smallSubtopic, error_13;
            var _a, _b;
            if (provider === void 0) { provider = 'gemini'; }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 11, , 12]);
                        console.log("[SMALL SUBTITLE] \"".concat(mainSubtopic, "\"\uC5D0 \uB300\uD55C \uC791\uC740 \uC18C\uC81C\uBAA9 \uC0DD\uC131 \uC2DC\uC791..."));
                        prompt_2 = this.buildSmallSubtopicPrompt(mainSubtopic, topic, keywords);
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
                        error_12 = _c.sent();
                        errorMsg = String((error_12 === null || error_12 === void 0 ? void 0 : error_12.message) || error_12 || '');
                        isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
                        if (isRateLimit && models.indexOf(modelName) < models.length - 1) {
                            lastError = error_12;
                            return [3 /*break*/, 7]; // 할당량 초과 시 다음 모델 시도
                        }
                        throw error_12; // 다른 오류는 즉시 throw
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
                        smallSubtopic = this.extractSmallSubtopicFromResponse(response);
                        console.log("[SMALL SUBTITLE] \uC791\uC740 \uC18C\uC81C\uBAA9 \uC0DD\uC131 \uC644\uB8CC: ".concat(smallSubtopic.length, "\uAC1C"));
                        return [2 /*return*/, smallSubtopic];
                    case 11:
                        error_13 = _c.sent();
                        console.error('[SMALL SUBTITLE] 작은 소제목 생성 실패:', error_13);
                        // 실패 시 기본 작은 소제목 반환
                        return [2 /*return*/, [
                            "".concat(mainSubtopic, "\uC758 \uD575\uC2EC \uD3EC\uC778\uD2B8"),
                            "".concat(mainSubtopic, "\uC758 \uC8FC\uC694 \uD2B9\uC9D5"),
                            "".concat(mainSubtopic, "\uC758 \uC2E4\uC6A9\uC801 \uD65C\uC6A9\uBC95"),
                            "".concat(mainSubtopic, "\uC758 \uC8FC\uC758\uC0AC\uD56D")
                        ].slice(0, 3)];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * 작은 소제목 생성 프롬프트 작성
     */
    SubtopicCrawler.prototype.buildSmallSubtopicPrompt = function (mainSubtopic, topic, keywords) {
        return "\uB2F9\uC2E0\uC740 \uBE14\uB85C\uADF8 \uCF58\uD150\uCE20 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4.\n\n\uD83D\uDCDD **\uBA54\uC778 \uC18C\uC81C\uBAA9**: \"".concat(mainSubtopic, "\"\n\uD83D\uDCDD **\uC804\uCCB4 \uC8FC\uC81C**: \"").concat(topic, "\"\n\uD83D\uDD11 **\uD0A4\uC6CC\uB4DC**: ").concat(keywords.join(', '), "\n\n\uD83C\uDFAF **\uBAA9\uD45C**: \"").concat(mainSubtopic, "\"\uC5D0 \uB300\uD55C \uC0AC\uB78C\uB4E4\uC774 \uAC00\uC7A5 \uB9CE\uC774 \uAC80\uC0C9\uD560 \uB9CC\uD55C \uC791\uC740 \uC18C\uC81C\uBAA9(H3) 3-4\uAC1C\uB97C \uC0DD\uC131\uD558\uC138\uC694.\n\n\u2705 **\uC694\uAD6C\uC0AC\uD56D**:\n1. \uC815\uD655\uD788 3-4\uAC1C\uC758 \uC791\uC740 \uC18C\uC81C\uBAA9\uB9CC \uC0DD\uC131\n2. \uC0AC\uB78C\uB4E4\uC774 \uC2E4\uC81C\uB85C \uAC80\uC0C9\uD560 \uB9CC\uD55C \uAD6C\uCCB4\uC801\uC778 \uB0B4\uC6A9\n3. \uAC01 \uC791\uC740 \uC18C\uC81C\uBAA9\uC740 10-20\uC790 \uB0B4\uC678 (\uC9E7\uACE0 \uAC04\uACB0\uD558\uAC8C)\n4. \uD0A4\uC6CC\uB4DC\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568\n5. \uAC80\uC0C9 \uC758\uB3C4\uC5D0 \uB9DE\uB294 \uC2E4\uC6A9\uC801\uC778 \uC81C\uBAA9\n6. \uC911\uBCF5\uB418\uC9C0 \uC54A\uB294 \uB2E4\uC591\uD55C \uAD00\uC810\uC758 \uC81C\uBAA9\n\n\uD83D\uDCCB **\uCD9C\uB825 \uD615\uC2DD**:\n\uC791\uC740 \uC18C\uC81C\uBAA9:\n1. [\uCCAB \uBC88\uC9F8 \uC791\uC740 \uC18C\uC81C\uBAA9]\n2. [\uB450 \uBC88\uC9F8 \uC791\uC740 \uC18C\uC81C\uBAA9]\n3. [\uC138 \uBC88\uC9F8 \uC791\uC740 \uC18C\uC81C\uBAA9]\n4. [\uB124 \uBC88\uC9F8 \uC791\uC740 \uC18C\uC81C\uBAA9]\n\n\uC774\uC81C \"").concat(mainSubtopic, "\"\uC5D0 \uB300\uD55C \uAC80\uC0C9 \uBE48\uB3C4 \uB192\uC740 \uC791\uC740 \uC18C\uC81C\uBAA9 3-4\uAC1C\uB97C \uC0DD\uC131\uD574\uC8FC\uC138\uC694.");
    };
    /**
     * 작은 소제목 응답에서 추출
     */
    SubtopicCrawler.prototype.extractSmallSubtopicFromResponse = function (response) {
        var lines = response.split('\n');
        var smallSubtopic = [];
        lines.forEach(function (line) {
            var match = line.match(/^\d+\.\s*(.+)$/);
            if (match && match[1]) {
                smallSubtopic.push(match[1].trim());
            }
        });
        return smallSubtopic;
    };
    return SubtopicCrawler;
}());
exports.SubtopicCrawler = SubtopicCrawler;
/**
 * 통합 소제목 생성 함수
 * 폴백 순서: 네이버 API → RSS → CSE → 기본 소제목
 */
function generateOptimalSubtopic(topic_1, keywords_1) {
    return __awaiter(this, arguments, void 0, function (topic, keywords, options) {
        var openaiKey, geminiKey, naverClientId, naverClientSecret, googleCseKey, googleCseCx, _a, provider, _b, crawledContents, crawler, allSubtopic, crawledTitles, naverSubtopic, titles, error_14, rssSubtopic, titles, error_15, cseSubtopic, titles, error_16, subtopicFrequency, subtopicSources, scoredSubtopics, rankedSubtopics, topCrawledSubtopics, aiSubtopic, error_17, topSubtopic;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    openaiKey = options.openaiKey, geminiKey = options.geminiKey, naverClientId = options.naverClientId, naverClientSecret = options.naverClientSecret, googleCseKey = options.googleCseKey, googleCseCx = options.googleCseCx, _a = options.provider, provider = _a === void 0 ? 'gemini' : _a, _b = options.crawledContents, crawledContents = _b === void 0 ? [] : _b;
                    crawler = new SubtopicCrawler(openaiKey, geminiKey);
                    console.log("[SUBTITLE CRAWLER] \uD83D\uDCCB \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uD3F4\uBC31 \uC21C\uC11C \uC2DC\uC791: \uD06C\uB864\uB9C1 \uB370\uC774\uD130 \u2192 \uB124\uC774\uBC84 API \u2192 RSS \u2192 CSE \u2192 \uAE30\uBCF8 \uC18C\uC81C\uBAA9");
                    allSubtopic = [];
                    // 🎯 0단계: 크롤링된 콘텐츠에서 소제목 추출
                    if (crawledContents.length > 0) {
                        console.log("[SUBTITLE CRAWLER] \uD83C\uDFAF 0\uB2E8\uACC4: \uD06C\uB864\uB9C1\uB41C \uCF58\uD150\uCE20\uC5D0\uC11C \uC18C\uC81C\uBAA9 \uCD94\uCD9C \uC911...");
                        crawledTitles = crawledContents.map(function (content) { return content.title; }).filter(function (title) { return title; });
                        if (crawledTitles.length > 0) {
                            allSubtopic.push.apply(allSubtopic, crawledTitles);
                            console.log("[SUBTITLE CRAWLER] \u2705 \uD06C\uB864\uB9C1 \uB370\uC774\uD130\uC5D0\uC11C ".concat(crawledTitles.length, "\uAC1C \uC81C\uBAA9 \uCD94\uCD9C"));
                        }
                    }
                    // 🥇 1단계: 네이버 API 소제목 크롤링
                    console.log("[SUBTITLE CRAWLER] \uD83E\uDD47 1\uB2E8\uACC4: \uB124\uC774\uBC84 API \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uB3C4...");
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, crawler.crawlSubtopicFromNaver(__assign(__assign({ topic: topic, keywords: keywords, maxResults: 5 }, (naverClientId !== undefined && { naverClientId: naverClientId })), (naverClientSecret !== undefined && { naverClientSecret: naverClientSecret })))];
                case 2:
                    naverSubtopic = _c.sent();
                    if (naverSubtopic.length > 0) {
                        titles = naverSubtopic.map(function (item) { return item.title; });
                        allSubtopic.push.apply(allSubtopic, titles);
                        console.log("[SUBTITLE CRAWLER] \u2705 \uB124\uC774\uBC84 API \uC131\uACF5: ".concat(naverSubtopic.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC218\uC9D1"));
                    }
                    else {
                        console.log("[SUBTITLE CRAWLER] \u26A0\uFE0F \uB124\uC774\uBC84 API \uACB0\uACFC \uC5C6\uC74C, \uB2E4\uC74C \uB2E8\uACC4\uB85C...");
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_14 = _c.sent();
                    console.log("[SUBTITLE CRAWLER] \u274C \uB124\uC774\uBC84 API \uC2E4\uD328: ".concat(error_14, ", \uB2E4\uC74C \uB2E8\uACC4\uB85C..."));
                    return [3 /*break*/, 4];
                case 4:
                    // 🥈 2단계: RSS 소제목 크롤링
                    console.log("[SUBTITLE CRAWLER] \uD83E\uDD48 2\uB2E8\uACC4: RSS \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uB3C4...");
                    _c.label = 5;
                case 5:
                    _c.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, crawler.crawlSubtopicFromRSS({
                        topic: topic,
                        keywords: keywords,
                        maxResults: 5
                    })];
                case 6:
                    rssSubtopic = _c.sent();
                    if (rssSubtopic.length > 0) {
                        titles = rssSubtopic.map(function (item) { return item.title; });
                        allSubtopic.push.apply(allSubtopic, titles);
                        console.log("[SUBTITLE CRAWLER] \u2705 RSS \uC131\uACF5: ".concat(rssSubtopic.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC218\uC9D1"));
                    }
                    else {
                        console.log("[SUBTITLE CRAWLER] \u26A0\uFE0F RSS \uACB0\uACFC \uC5C6\uC74C, \uB2E4\uC74C \uB2E8\uACC4\uB85C...");
                    }
                    return [3 /*break*/, 8];
                case 7:
                    error_15 = _c.sent();
                    console.log("[SUBTITLE CRAWLER] \u274C RSS \uC2E4\uD328: ".concat(error_15, ", \uB2E4\uC74C \uB2E8\uACC4\uB85C..."));
                    return [3 /*break*/, 8];
                case 8:
                    // 🥉 3단계: Google CSE 소제목 크롤링
                    console.log("[SUBTITLE CRAWLER] \uD83E\uDD49 3\uB2E8\uACC4: Google CSE \uC18C\uC81C\uBAA9 \uD06C\uB864\uB9C1 \uC2DC\uB3C4...");
                    _c.label = 9;
                case 9:
                    _c.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, crawler.crawlSubtopicFromGoogle(__assign(__assign({ topic: topic, keywords: keywords, maxResults: 10 }, (googleCseKey !== undefined && { googleCseKey: googleCseKey })), (googleCseCx !== undefined && { googleCseCx: googleCseCx })))];
                case 10:
                    cseSubtopic = _c.sent();
                    if (cseSubtopic.length > 0) {
                        titles = cseSubtopic.map(function (item) { return item.title; });
                        allSubtopic.push.apply(allSubtopic, titles);
                        console.log("[SUBTITLE CRAWLER] \u2705 CSE \uC131\uACF5: ".concat(cseSubtopic.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC218\uC9D1"));
                    }
                    else {
                        console.log("[SUBTITLE CRAWLER] \u26A0\uFE0F CSE \uACB0\uACFC \uC5C6\uC74C, \uAE30\uBCF8 \uC18C\uC81C\uBAA9 \uC0AC\uC6A9...");
                    }
                    return [3 /*break*/, 12];
                case 11:
                    error_16 = _c.sent();
                    console.log("[SUBTITLE CRAWLER] \u274C CSE \uC2E4\uD328: ".concat(error_16, ", \uAE30\uBCF8 \uC18C\uC81C\uBAA9 \uC0AC\uC6A9..."));
                    return [3 /*break*/, 12];
                case 12:
                    // 🛡️ 4단계: 기본 소제목 (최종 폴백)
                    if (allSubtopic.length === 0) {
                        console.log("[SUBTITLE CRAWLER] \uD83D\uDEE1\uFE0F 4\uB2E8\uACC4: \uBAA8\uB4E0 \uD06C\uB864\uB9C1 \uC2E4\uD328, \uAE30\uBCF8 \uC18C\uC81C\uBAA9 \uC0DD\uC131...");
                        return [2 /*return*/, generateDefaultSubtopic(topic, keywords)];
                    }
                    // 🎯 5단계: 검색 빈도 기반 소제목 점수 매기기
                    console.log("[SUBTITLE CRAWLER] \uD83C\uDFAF 5\uB2E8\uACC4: \uAC80\uC0C9 \uBE48\uB3C4 \uBD84\uC11D \uC911...");
                    subtopicFrequency = new Map();
                    subtopicSources = new Map();
                    allSubtopic.forEach(function (item) {
                        var normalized = item.toLowerCase().trim();
                        subtopicFrequency.set(normalized, (subtopicFrequency.get(normalized) || 0) + 1);
                        if (!subtopicSources.has(normalized)) {
                            subtopicSources.set(normalized, new Set());
                        }
                        subtopicSources.get(normalized).add(item); // 원본 보존
                    });
                    scoredSubtopics = Array.from(subtopicFrequency.entries()).map(function (_a) {
                        var normalized = _a[0], frequency = _a[1];
                        // 키워드 매칭 점수 계산
                        var keywordScore = keywords.reduce(function (score, keyword) {
                            return normalized.includes(keyword.toLowerCase()) ? score + 2 : score;
                        }, 0);
                        var totalScore = (frequency * 3) + keywordScore;
                        var originalText = Array.from(subtopicSources.get(normalized) || [])[0];
                        return {
                            text: originalText,
                            normalized: normalized,
                            frequency: frequency,
                            keywordScore: keywordScore,
                            totalScore: totalScore
                        };
                    });
                    rankedSubtopics = scoredSubtopics
                        .sort(function (a, b) { return b.totalScore - a.totalScore; })
                        .slice(0, 10);
                    console.log("[SUBTITLE CRAWLER] \uD83D\uDCCA \uAC80\uC0C9 \uBE48\uB3C4 \uBD84\uC11D \uC644\uB8CC (\uC0C1\uC704 5\uAC1C):");
                    rankedSubtopics.slice(0, 5).forEach(function (item, index) {
                        console.log("  ".concat(index + 1, "\uC704: \"").concat(item.text, "\" (\uBE48\uB3C4: ").concat(item.frequency, ", \uC810\uC218: ").concat(item.totalScore, ")"));
                    });
                    // 🎯 6단계: AI로 최종 소제목 5개 생성 (검색 빈도 높은 것 우선)
                    console.log("[SUBTITLE CRAWLER] \uD83C\uDFAF 6\uB2E8\uACC4: \uAC80\uC0C9 \uBE48\uB3C4 \uAE30\uBC18 AI \uC18C\uC81C\uBAA9 \uC0DD\uC131...");
                    _c.label = 13;
                case 13:
                    _c.trys.push([13, 15, , 16]);
                    topCrawledSubtopics = rankedSubtopics
                        .filter(function (item) { return item.text; })
                        .map(function (item) {
                            return ({
                                title: item.text,
                                frequency: item.frequency,
                                source: 'crawled',
                                relevance: item.totalScore
                            });
                        });
                    return [4 /*yield*/, crawler.generateAISubtopic(topic, keywords, topCrawledSubtopics, provider)];
                case 14:
                    aiSubtopic = _c.sent();
                    if (aiSubtopic.length >= 5) {
                        console.log("[SUBTITLE CRAWLER] \u2705 AI \uC0DD\uC131 \uC131\uACF5: ".concat(aiSubtopic.length, "\uAC1C \uC18C\uC81C\uBAA9 \uC0DD\uC131"));
                        return [2 /*return*/, aiSubtopic.slice(0, 5)];
                    }
                    else {
                        console.log("[SUBTITLE CRAWLER] \u26A0\uFE0F AI \uC0DD\uC131 \uBD80\uC871: ".concat(aiSubtopic.length, "\uAC1C\uB9CC \uC0DD\uC131, \uAC80\uC0C9 \uBE48\uB3C4 \uB192\uC740 \uC18C\uC81C\uBAA9 \uC0AC\uC6A9..."));
                        return [2 /*return*/, combineSubtopic(aiSubtopic, topic, keywords)];
                    }
                    return [3 /*break*/, 16];
                case 15:
                    error_17 = _c.sent();
                    console.log("[SUBTITLE CRAWLER] \u274C AI \uC0DD\uC131 \uC2E4\uD328: ".concat(error_17, ", \uAC80\uC0C9 \uBE48\uB3C4 \uB192\uC740 \uC18C\uC81C\uBAA9 \uC0AC\uC6A9..."));
                    topSubtopic = rankedSubtopics
                        .slice(0, 5)
                        .map(function (item) { return item.text; })
                        .filter(function (text) { return text !== undefined; });
                    if (topSubtopic.length >= 5) {
                        console.log("[SUBTITLE CRAWLER] \u2705 \uAC80\uC0C9 \uBE48\uB3C4 \uAE30\uBC18 \uC18C\uC81C\uBAA9 ".concat(topSubtopic.length, "\uAC1C \uC120\uD0DD"));
                        return [2 /*return*/, topSubtopic];
                    }
                    return [2 /*return*/, generateDefaultSubtopic(topic, keywords)];
                case 16: return [2 /*return*/];
            }
        });
    });
}
/**
 * AI 생성 소제목과 기본 소제목 결합
 */
function combineSubtopic(aiSubtopic, topic, keywords) {
    var defaultSubtopic = generateDefaultSubtopic(topic, keywords);
    var combined = __spreadArray([], aiSubtopic, true);
    // 부족한 만큼 기본 소제목으로 채우기
    for (var i = aiSubtopic.length; i < 5; i++) {
        var item = defaultSubtopic[i];
        if (item) {
            combined.push(item);
        }
    }
    return combined.slice(0, 5);
}
/**
 * 기본 소제목 생성 (모든 크롤링 실패 시)
 */
function generateDefaultSubtopic(topic, _keywords) {
    return [
        "".concat(topic, "\uC758 \uAE30\uBCF8 \uAC1C\uB150\uACFC \uC774\uD574"),
        "".concat(topic, "\uC758 \uC8FC\uC694 \uD2B9\uC9D5\uACFC \uC7A5\uC810"),
        "".concat(topic, "\uC758 \uD65C\uC6A9 \uBC29\uBC95\uACFC \uC0AC\uB840"),
        "".concat(topic, "\uC758 \uC8FC\uC758\uC0AC\uD56D\uACFC \uD55C\uACC4"),
        "".concat(topic, "\uC758 \uBBF8\uB798 \uC804\uB9DD\uACFC \uBC1C\uC804 \uBC29\uD5A5")
    ];
}
