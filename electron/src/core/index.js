"use strict";
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
exports.generateWithOpenAI = generateWithOpenAI;
exports.generateWithGemini = generateWithGemini;
exports.generateWordPressContent = generateWordPressContent;
exports.generatePreviewContent = generatePreviewContent;
exports.generateBloggerContent = generateBloggerContent;
exports.generateGptsModeArticle = generateGptsModeArticle;
exports.generateCustomModeArticle = generateCustomModeArticle;
exports.generateMaxModeArticle = generateMaxModeArticle;
exports.runPost = runPost;
exports.publishGeneratedContent = publishGeneratedContent;
var openai_1 = require("openai");
var generative_ai_1 = require("@google/generative-ai");
var fs_1 = require("fs");
var path = require("path");
var crypto_1 = require("crypto");
var prompt_1 = require("./prompt");
var competitor_analyzer_1 = require("./competitor-analyzer");
var content_quality_scorer_1 = require("./content-quality-scorer");
var smart_keyword_generator_1 = require("./smart-keyword-generator");
var content_variation_generator_1 = require("./content-variation-generator");
var api_key_checker_1 = require("./api-key-checker");
var max_mode_structure_1 = require("./max-mode-structure");
var subtopic_crawler_1 = require("./subtopic-crawler");
var content_crawler_1 = require("./content-crawler");
var inspection_utils_1 = require("./inspection-utils");
// 성능 최적화: 캐시된 인스턴스들
var modelCache = new Map();
var clientCache = new Map();
var translationCache = new Map();
var keywordCache = new Map();
var IMAGE_DOWNLOAD_DIR = path.join(process.cwd(), 'downloads', 'h2-images');
function detectTargetYear(topic, keywords) {
    var candidates = [];
    var yearRegex = /\b(19\d{2}|20\d{2}|21\d{2})\b/g;
    var addMatches = function (value) {
        if (!value)
            return;
        var items = Array.isArray(value) ? value : [value];
        for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
            var item = items_1[_i];
            if (!item)
                continue;
            var matches = String(item).match(yearRegex);
            if (matches) {
                for (var _a = 0, matches_1 = matches; _a < matches_1.length; _a++) {
                    var match = matches_1[_a];
                    var year = parseInt(match, 10);
                    if (!Number.isNaN(year) && year >= 1900 && year <= 2125) {
                        candidates.push(year);
                    }
                }
            }
        }
    };
    addMatches(topic);
    addMatches(keywords);
    if (candidates.length === 0) {
        return null;
    }
    return Math.max.apply(Math, candidates);
}
/* ---------------------------------------------
 * 안전한 API 호출 헬퍼 (재시도 로직 포함)
 * --------------------------------------------- */
function safeGenerateContent(model_1, prompt_2, config_1) {
    return __awaiter(this, arguments, void 0, function (model, prompt, config, context, genAI // 할당량 초과 시 다른 모델 시도용
    ) {
        var lastError, maxRetries, fallbackModels, currentModelIndex, _loop_1, attempt, state_1;
        var _a, _b, _c, _d, _e, _f;
        if (context === void 0) { context = 'API'; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    maxRetries = 3;
                    fallbackModels = [
                        'gemini-2.0-flash',
                        'gemini-2.0-flash-preview',
                        'gemini-2.5-flash',
                        'gemini-2.0-flash-thinking-exp'
                    ];
                    currentModelIndex = 0;
                    _loop_1 = function (attempt) {
                        var result, error_1, errorMsg, isConnectionError, isRateLimit, fallbackModelName, fallbackModel, result, fallbackError_1, shouldRetry, delay_1;
                        return __generator(this, function (_h) {
                            switch (_h.label) {
                                case 0:
                                    _h.trys.push([0, 2, , 9]);
                                    return [4 /*yield*/, model.generateContent({
                                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                                        generationConfig: {
                                            temperature: (_a = config === null || config === void 0 ? void 0 : config.temperature) !== null && _a !== void 0 ? _a : 0.7,
                                            topP: (_b = config === null || config === void 0 ? void 0 : config.topP) !== null && _b !== void 0 ? _b : 0.95,
                                            maxOutputTokens: (_c = config === null || config === void 0 ? void 0 : config.maxOutputTokens) !== null && _c !== void 0 ? _c : 12000,
                                        },
                                    })];
                                case 1:
                                    result = _h.sent();
                                    return [2 /*return*/, { value: result.response.text().trim() }];
                                case 2:
                                    error_1 = _h.sent();
                                    lastError = error_1;
                                    errorMsg = String((error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || error_1 || '알 수 없는 오류');
                                    isConnectionError = /ECONNRESET|socket hang up|ETIMEDOUT|ESOCKETTIMEDOUT|EAI_AGAIN|ENETUNREACH|fetch failed|network|connection/i.test(errorMsg);
                                    isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
                                    if (!(isRateLimit && genAI && currentModelIndex < fallbackModels.length)) return [3 /*break*/, 6];
                                    fallbackModelName = fallbackModels[currentModelIndex];
                                    console.log("\u26A0\uFE0F [".concat(context, "] \uD560\uB2F9\uB7C9 \uCD08\uACFC \uAC10\uC9C0, \uD3F4\uBC31 \uBAA8\uB378\uB85C \uC804\uD658: ").concat(fallbackModelName));
                                    _h.label = 3;
                                case 3:
                                    _h.trys.push([3, 5, , 6]);
                                    fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
                                    return [4 /*yield*/, fallbackModel.generateContent({
                                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                                        generationConfig: {
                                            temperature: (_d = config === null || config === void 0 ? void 0 : config.temperature) !== null && _d !== void 0 ? _d : 0.7,
                                            topP: (_e = config === null || config === void 0 ? void 0 : config.topP) !== null && _e !== void 0 ? _e : 0.95,
                                            maxOutputTokens: (_f = config === null || config === void 0 ? void 0 : config.maxOutputTokens) !== null && _f !== void 0 ? _f : 12000,
                                        },
                                    })];
                                case 4:
                                    result = _h.sent();
                                    console.log("\u2705 [".concat(context, "] \uD3F4\uBC31 \uBAA8\uB378 ").concat(fallbackModelName, " \uC131\uACF5"));
                                    return [2 /*return*/, { value: result.response.text().trim() }];
                                case 5:
                                    fallbackError_1 = _h.sent();
                                    console.log("\u26A0\uFE0F [".concat(context, "] \uD3F4\uBC31 \uBAA8\uB378 ").concat(fallbackModelName, " \uC2E4\uD328, \uB2E4\uC74C \uBAA8\uB378 \uC2DC\uB3C4..."));
                                    currentModelIndex++;
                                    if (currentModelIndex < fallbackModels.length) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    return [3 /*break*/, 6];
                                case 6:
                                    shouldRetry = (isConnectionError || isRateLimit) && attempt < maxRetries;
                                    if (!shouldRetry) return [3 /*break*/, 8];
                                    delay_1 = isRateLimit ? attempt * 5000 : attempt * 1000;
                                    console.log("\u26A0\uFE0F [".concat(context, "] API \uD638\uCD9C \uC2E4\uD328 (\uC2DC\uB3C4 ").concat(attempt, "/").concat(maxRetries, "). ").concat(delay_1, "ms \uD6C4 \uC7AC\uC2DC\uB3C4..."));
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                case 7:
                                    _h.sent();
                                    return [2 /*return*/, "continue"];
                                case 8:
                                    // 재시도 불가능한 경우 또는 최대 재시도 횟수 초과
                                    console.error("\u274C [".concat(context, "] API \uD638\uCD9C \uCD5C\uC885 \uC2E4\uD328 (\uC2DC\uB3C4 ").concat(attempt, "/").concat(maxRetries, "):"), errorMsg);
                                    throw error_1;
                                case 9: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _g.label = 1;
                case 1:
                    if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _g.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _g.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: throw lastError || new Error('API 호출 실패');
            }
        });
    });
}
/* ---------------------------------------------
 * AI 모델 폴백 시스템
 * --------------------------------------------- */
function getAvailableGeminiModel(genAI_1) {
    return __awaiter(this, arguments, void 0, function (genAI, context) {
        var cacheKey, cached, availableModels, _i, availableModels_1, modelName, model, result;
        if (context === void 0) { context = 'AI'; }
        return __generator(this, function (_a) {
            cacheKey = "".concat(context, "_gemini_model");
            // 캐시에서 모델 확인
            if (modelCache.has(cacheKey)) {
                cached = modelCache.get(cacheKey);
                console.log("\u2705 ".concat(context, " \uBAA8\uB378 \uCE90\uC2DC \uC0AC\uC6A9: ").concat(cached.modelName));
                return [2 /*return*/, cached];
            }
            availableModels = [
                'gemini-2.5-flash',
                'gemini-3-flash',
                'gemini-2.5-flash-lite',
                'gemini-2.5-flash-preview-09-2025' // 대체 모델
            ];
            for (_i = 0, availableModels_1 = availableModels; _i < availableModels_1.length; _i++) {
                modelName = availableModels_1[_i];
                try {
                    model = genAI.getGenerativeModel({ model: modelName });
                    result = { model: model, modelName: modelName };
                    // 성공한 모델을 캐시에 저장
                    modelCache.set(cacheKey, result);
                    console.log("\u2705 ".concat(context, " \uBAA8\uB378 \uC120\uD0DD: ").concat(modelName));
                    return [2 /*return*/, result];
                }
                catch (error) {
                    console.log("\u26A0\uFE0F ".concat(modelName, " \uBAA8\uB378 \uC0AC\uC6A9 \uBD88\uAC00, \uB2E4\uC74C \uBAA8\uB378 \uC2DC\uB3C4 \uC911..."));
                    continue;
                }
            }
            throw new Error('사용 가능한 AI 모델이 없습니다. API 키를 확인해주세요.');
        });
    });
}
/* ---------------------------------------------
 * 유틸: 모델이 전체 HTML을 내놔도 fragment만 추출
 * --------------------------------------------- */
// 성능 최적화: 정규식 캐시
var regexCache = new Map();
function getCachedRegex(pattern, flags) {
    if (flags === void 0) { flags = 'i'; }
    var key = "".concat(pattern, "_").concat(flags);
    if (!regexCache.has(key)) {
        regexCache.set(key, new RegExp(pattern, flags));
    }
    return regexCache.get(key);
}
function stripToFragment(s) {
    if (!s)
        return '';
    var txt = String(s).trim();
    // 1) 우리가 요구한 스타일/랩퍼가 함께 온 경우 그대로 추출
    var styleRegex = getCachedRegex('<style[\\s\\S]*?</style>');
    var wrapRegex = getCachedRegex('<div[^>]*class=["\'][^"\']*\\bwrap\\b[^"\']*["\'][\\s\\S]*?</div>');
    var style = txt.match(styleRegex);
    var wrap = txt.match(wrapRegex);
    if (style && wrap)
        return "".concat(style[0], "\n").concat(wrap[0]);
    // 2) body 안쪽만 존재하면 body만 추출
    var bodyRegex = getCachedRegex('<body[^>]*>([\\s\\S]*?)</body>');
    var body = txt.match(bodyRegex);
    if (body && body[1])
        return body[1].trim();
    // 3) section이나 main 같은 컨테이너가 있으면 우선 추출
    var containerRegex = getCachedRegex('<(main|section)[^>]*>[\\s\\S]*?</\\1>');
    var container = txt.match(containerRegex);
    if (container)
        return container[0].trim();
    // 4) 그냥 통째로 반환
    return txt;
}
// RunOnePostPayload 타입은 아래에서 interface로 정의됨
/* ---------------------------------------------
 * OpenAI
 * --------------------------------------------- */
function generateWithOpenAI(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var keywordsCSV, prompt, client, model, res, text;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    keywordsCSV = Array.isArray(opts.keywords)
                        ? opts.keywords.join(', ')
                        : ((_a = opts.keywords) !== null && _a !== void 0 ? _a : '');
                    prompt = (0, prompt_1.buildContentPrompt)({
                        topic: opts.topic,
                        keywordsCSV: keywordsCSV,
                        minChars: (_b = opts.minChars) !== null && _b !== void 0 ? _b : 3000,
                    });
                    client = clientCache.get(opts.apiKey);
                    if (!client) {
                        client = new openai_1.default({ apiKey: opts.apiKey });
                        clientCache.set(opts.apiKey, client);
                    }
                    model = opts.model || 'gpt-4o-mini';
                    return [4 /*yield*/, client.chat.completions.create({
                        model: model,
                        temperature: 0.7,
                        max_tokens: 6000, // 긴 본문 대응
                        messages: [
                            {
                                role: 'system',
                                content: '너는 한국어 SEO 전문 에디터다. 지침을 엄격히 준수하고, 외부 리소스 없이 HTML fragment만 출력한다.',
                            },
                            { role: 'user', content: prompt },
                        ],
                    })];
                case 1:
                    res = _f.sent();
                    text = (((_e = (_d = (_c = res.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || '').toString();
                    return [2 /*return*/, stripToFragment(text)];
            }
        });
    });
}
/* ---------------------------------------------
 * Gemini
 * --------------------------------------------- */
// src/core/index.ts 내 기존 generateWithGemini를 이 버전으로 교체
function generateWithGemini(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var GoogleGenerativeAI, min, sessions, perTarget, keywordsCSV, competitorAnalyzer, qualityScorer, keywordGenerator, variationGenerator, competitorAnalysis, keywordStrategy, enhancedPrompt, genAI, model, modelInfo, visibleLen, strip, ask, parts, baseStyle, i, p, piece, st, guard, need, extendPrompt, more, _a, toc, ctaSection, tagsPrompt, tags, _b, list, styleSafe, html, qualityAnalysis;
        var _this = this;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        return __generator(this, function (_v) {
            switch (_v.label) {
                case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/generative-ai'); })];
                case 1:
                    GoogleGenerativeAI = (_v.sent()).GoogleGenerativeAI;
                    min = (_c = opts.minChars) !== null && _c !== void 0 ? _c : 10000;
                    sessions = 7;
                    perTarget = Math.max(1600, Math.floor(min / sessions));
                    keywordsCSV = Array.isArray(opts.keywords) ? opts.keywords.join(', ') : ((_d = opts.keywords) !== null && _d !== void 0 ? _d : '');
                    competitorAnalyzer = new competitor_analyzer_1.CompetitorAnalyzer();
                    qualityScorer = new content_quality_scorer_1.ContentQualityScorer();
                    keywordGenerator = new smart_keyword_generator_1.SmartKeywordGenerator();
                    variationGenerator = new content_variation_generator_1.ContentVariationGenerator();
                    // 1. 경쟁사 분석
                    console.log('🔍 경쟁사 분석 중...');
                    return [4 /*yield*/, competitorAnalyzer.analyzeCompetitors(opts.topic, Array.isArray(opts.keywords) ? opts.keywords : [opts.keywords || ''])];
                case 2:
                    competitorAnalysis = _v.sent();
                    // 2. 스마트 키워드 생성
                    console.log('🎯 스마트 키워드 생성 중...');
                    return [4 /*yield*/, keywordGenerator.generateSmartKeywords(opts.topic, Array.isArray(opts.keywords) ? opts.keywords : [opts.keywords || ''])];
                case 3:
                    keywordStrategy = _v.sent();
                    // 3. 콘텐츠 변형 생성
                    console.log('🔄 콘텐츠 변형 생성 중...');
                    return [4 /*yield*/, variationGenerator.generateVariations(opts.topic, Array.isArray(opts.keywords) ? opts.keywords : [opts.keywords || ''])];
                case 4:
                    _v.sent();
                    enhancedPrompt = (0, prompt_1.buildContentPrompt)({
                        topic: opts.topic,
                        keywordsCSV: ((_e = keywordStrategy.combinations[0]) === null || _e === void 0 ? void 0 : _e.primary) + ', ' + keywordsCSV,
                        minChars: min
                    });
                    genAI = new GoogleGenerativeAI(opts.apiKey);
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, '메인 콘텐츠 생성')];
                case 5:
                    modelInfo = _v.sent();
                    model = genAI.getGenerativeModel({
                        model: modelInfo.modelName,
                        systemInstruction: enhancedPrompt,
                    });
                    visibleLen = function (html) {
                        return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, '').length;
                    };
                    strip = function (s) {
                        var style = s.match(/<style[\s\S]*?<\/style>/i);
                        var wrap = s.match(/<div[^>]*class=["'][^"']*\bwrap\b[^"']*["'][\s\S]*?<\/div>/i);
                        if (style && wrap)
                            return "".concat(style[0], "\n").concat(wrap[0]);
                        return s.trim();
                    };
                    ask = function (text_1) {
                        var args_1 = [];
                        for (var _i = 1; _i < arguments.length; _i++) {
                            args_1[_i - 1] = arguments[_i];
                        }
                        return __awaiter(_this, __spreadArray([text_1], args_1, true), void 0, function (text, max) {
                            if (max === void 0) { max = 12000; }
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, safeGenerateContent(model, text, { maxOutputTokens: max, temperature: 0.7, topP: 0.95 }, '회차 콘텐츠 생성')];
                                    case 1:
                                        // safeGenerateContent 헬퍼 함수 사용 (재시도 로직 포함)
                                        return [2 /*return*/, _a.sent()];
                                }
                            });
                        });
                    };
                    parts = [];
                    baseStyle = '';
                    i = 1;
                    _v.label = 6;
                case 6:
                    if (!(i <= sessions)) return [3 /*break*/, 12];
                    p = "\n**".concat(i, "/").concat(sessions, "\uD68C\uCC28 \uC560\uB4DC\uC13C\uC2A4 \uC2B9\uC778\uC6A9 \uB3C5\uCC3D\uC801 \uCF58\uD150\uCE20 \uC791\uC131**\n\n[\uC8FC\uC81C] ").concat(opts.topic, "\n[\uD0A4\uC6CC\uB4DC] ").concat(keywordsCSV, "\n[\uBAA9\uD45C] \uACF5\uBC31 \uC81C\uC678 ").concat(perTarget, "\uC790 \uC774\uC0C1 (\uBD80\uC871\uD558\uBA74 \uD655\uC7A5)\n\n[\uB3C5\uCC3D\uC801 \uCF58\uD150\uCE20 \uC791\uC131\uBC95]\n1. **\uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC811\uADFC**: \uAE30\uC874 \uAE00\uB4E4\uACFC 1%\uB3C4 \uC720\uC0AC\uD558\uC9C0 \uC54A\uC740 \uB3C5\uCC3D\uC801 \uC811\uADFC\uBC95\n2. **\uACE0\uC720\uD55C \uC2A4\uD1A0\uB9AC\uD154\uB9C1**: \uB9E4\uB825\uC801\uC774\uACE0 \uB3C5\uD2B9\uD55C \uC2A4\uD1A0\uB9AC\uB85C \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB04C\uAE30\n3. **\uCC28\uBCC4\uD654\uB41C \uC778\uC0AC\uC774\uD2B8**: \uB2E4\uB978 \uAE00\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uB294 \uB3C5\uD2B9\uD558\uACE0 \uAE4A\uC774 \uC788\uB294 \uD1B5\uCC30\uB825\n4. **\uD601\uC2E0\uC801 \uAD6C\uC870**: \uD45C\uC900\uC801\uC774\uC9C0 \uC54A\uC740 \uB3C5\uCC3D\uC801\uC774\uACE0 \uCC3D\uC758\uC801\uC778 \uCF58\uD150\uCE20 \uAD6C\uC131\n5. **\uD2B9\uBCC4\uD55C \uAC00\uCE58**: \uB3C5\uC790\uC5D0\uAC8C \uB2E4\uB978 \uAE00\uC5D0\uC11C\uB294 \uC5BB\uC744 \uC218 \uC5C6\uB294 \uD2B9\uBCC4\uD55C \uAC00\uCE58\uC640 \uC815\uBCF4\n\n[\uC560\uB4DC\uC13C\uC2A4 \uCE5C\uD654\uC801 \uC694\uC18C]\n- **\uAC80\uC99D\uB41C \uB370\uC774\uD130**: \uACF5\uC2DD \uAE30\uAD00, \uC815\uBD80\uAE30\uAD00, \uACF5\uC778\uB41C \uAE30\uAD00\uC758 \uC2E0\uB8B0\uD560 \uC218 \uC788\uB294 \uC815\uBCF4\n- **\uC2E4\uC6A9\uC801 \uAC00\uC774\uB4DC**: \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC815\uBCF4\n- **\uC804\uBB38\uC801 \uBD84\uC11D**: \uD574\uB2F9 \uBD84\uC57C\uC5D0 \uB300\uD55C \uAE4A\uC774 \uC788\uB294 \uC9C0\uC2DD\uACFC \uC804\uBB38\uC131\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uB0B4\uC6A9\n- **\uC2DC\uAC01\uC801 \uC694\uC18C**: \uD45C, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uC778\uD3EC\uADF8\uB798\uD53D\uC73C\uB85C \uBCF5\uC7A1\uD55C \uC815\uBCF4\uB97C \uAD6C\uC870\uD654\n- **\uC2A4\uD1A0\uB9AC\uD154\uB9C1**: \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB04C \uC218 \uC788\uB294 \uB9E4\uB825\uC801\uC778 \uC2A4\uD1A0\uB9AC\uC640 \uC0AC\uB840\n\n[\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D]\n- **Q&A \uD615\uC2DD \uC0AC\uC6A9 \uAE08\uC9C0**: \uC9C8\uBB38\uACFC \uB2F5\uBCC0 \uD615\uC2DD\uC740 \uC808\uB300 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC74C\n- **\uD15C\uD50C\uB9BF\uC2DD \uAD6C\uC870 \uAE08\uC9C0**: \uD45C\uC900\uC801\uC774\uAC70\uB098 \uBED4\uD55C \uAD6C\uC870 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uC911\uBCF5\uB41C \uB0B4\uC6A9 \uAE08\uC9C0**: \uAC19\uC740 \uB0B4\uC6A9\uC744 \uBC18\uBCF5\uD558\uAC70\uB098 \uC720\uC0AC\uD55C \uD45C\uD604 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uC77C\uBC18\uC801\uC778 \uD45C\uD604 \uAE08\uC9C0**: \"\uBA87 \uAC00\uC9C0 \uD575\uC2EC \uC8FC\uC758\uC0AC\uD56D\uC774 \uC788\uC5B4\uC694\" \uB4F1 \uBED4\uD55C \uD45C\uD604 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uB3D9\uC77C\uD55C \uB2F5\uBCC0 \uAE08\uC9C0**: \uB2E4\uB978 \uC8FC\uC81C\uB77C\uB3C4 \uAC19\uC740 \uB2F5\uBCC0\uC744 \uC81C\uACF5\uD558\uB294 \uAC83 \uC808\uB300 \uAE08\uC9C0\n- **\uCD94\uCE21\uC131 \uD45C\uD604 \uAE08\uC9C0**: \"~\uC77C \uAC83 \uAC19\uC2B5\uB2C8\uB2E4\", \"~\uB77C\uACE0 \uD569\uB2C8\uB2E4\" \uB4F1 \uBD88\uD655\uC2E4\uD55C \uD45C\uD604 \uAE08\uC9C0\n- **\uAC80\uC99D\uB418\uC9C0 \uC54A\uC740 \uB370\uC774\uD130 \uAE08\uC9C0**: \uD655\uC2E4\uD558\uC9C0 \uC54A\uC740 \uD1B5\uACC4\uB098 \uC218\uCE58 \uC0AC\uC6A9 \uAE08\uC9C0\n\n[\uC791\uC131 \uC694\uAD6C\uC0AC\uD56D]\n- \"\uBB38\uC81C\uC81C\uAE30/\uACF5\uAC10/\uD574\uACB0\uCC45/\uC774\uC810/\uD589\uB3D9\uC720\uB3C4\" \uC0C1\uC704 \uC81C\uBAA9\uC740 \uC228\uAE40 \uCC98\uB9AC\n- \uAC80\uC99D\uB41C \uC0AC\uC2E4\uACFC \uACF5\uC2DD \uC808\uCC28\uB9CC\uC744 \uC815\uD655\uD558\uAC8C \uC124\uBA85\n- \uB370\uC774\uD130/\uADDC\uC815/\uC6A9\uC5B4\uB294 \uC815\uD655\uD788, \uAD70\uB354\uB354\uAE30/\uC911\uBCF5 \uAE08\uC9C0\n- \uC694\uC57D/\uD55C\uC904\uC815\uB9AC/\uD575\uC2EC\uC815\uB9AC, \uD504\uB86C\uD504\uD2B8/\uC9C0\uCE68 \uC5B8\uAE09 \uAE08\uC9C0\n- <div class=\"wrap\"> \uB0B4\uBD80\uC5D0 \uBC14\uB85C \uBD99\uC77C HTML \uC870\uAC01\uB9CC \uCD9C\uB825\n- \uC911\uBCF5\uBB38\uC11C, \uC720\uC0AC\uBB38\uC11C, \uD2B9\uC0C9\uC5C6\uB294 \uAE00\uC5D0 \uC808\uB300 \uAC78\uB9AC\uC9C0 \uC54A\uB294 \uB3C5\uCC3D\uC801\uC774\uACE0 \uACE0\uC720\uD55C \uCF58\uD150\uCE20\uB85C \uC791\uC131\n").trim();
                    return [4 /*yield*/, ask(p, 12000)];
                case 7:
                    piece = _v.sent();
                    piece = strip(piece);
                    // 스타일이 붙어온다면 첫 회차에서만 회수
                    if (i === 1) {
                        st = piece.match(/<style[\s\S]*?<\/style>/i);
                        if (st) {
                            baseStyle = st[0];
                            piece = piece.replace(st[0], '').trim();
                        }
                    }
                    guard = 2;
                    _v.label = 8;
                case 8:
                    if (!(visibleLen(piece) < perTarget && guard-- > 0)) return [3 /*break*/, 10];
                    need = Math.max(500, perTarget - visibleLen(piece));
                    extendPrompt = "\n\uC544\uB798 \uD68C\uCC28 \uBCF8\uBB38\uC744 **\uC560\uB4DC\uC13C\uC2A4 \uC2B9\uC778\uC6A9 \uB3C5\uCC3D\uC801 \uCF58\uD150\uCE20**\uB85C **".concat(need, "\uC790 \uC774\uC0C1** \uB354 \uC790\uC138\uD788 \uD655\uC7A5\uD558\uC138\uC694.\n\n[\uB3C5\uCC3D\uC801 \uD655\uC7A5 \uAE30\uBC95]\n1. **\uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC815\uBCF4 \uCD94\uAC00**: \uAE30\uC874 \uAE00\uB4E4\uACFC 1%\uB3C4 \uC720\uC0AC\uD558\uC9C0 \uC54A\uC740 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC815\uBCF4\n2. **\uACE0\uC720\uD55C \uC2A4\uD1A0\uB9AC\uD154\uB9C1**: \uB9E4\uB825\uC801\uC774\uACE0 \uB3C5\uD2B9\uD55C \uC2A4\uD1A0\uB9AC\uC640 \uC0AC\uB840 \uCD94\uAC00\n3. **\uCC28\uBCC4\uD654\uB41C \uC778\uC0AC\uC774\uD2B8**: \uB2E4\uB978 \uAE00\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uB294 \uB3C5\uD2B9\uD558\uACE0 \uAE4A\uC774 \uC788\uB294 \uD1B5\uCC30\uB825\n4. **\uD601\uC2E0\uC801 \uAD6C\uC870**: \uD45C\uC900\uC801\uC774\uC9C0 \uC54A\uC740 \uB3C5\uCC3D\uC801\uC774\uACE0 \uCC3D\uC758\uC801\uC778 \uCF58\uD150\uCE20 \uAD6C\uC131\n5. **\uD2B9\uBCC4\uD55C \uAC00\uCE58**: \uB3C5\uC790\uC5D0\uAC8C \uB2E4\uB978 \uAE00\uC5D0\uC11C\uB294 \uC5BB\uC744 \uC218 \uC5C6\uB294 \uD2B9\uBCC4\uD55C \uAC00\uCE58\uC640 \uC815\uBCF4\n\n[\uC560\uB4DC\uC13C\uC2A4 \uCE5C\uD654\uC801 \uD655\uC7A5]\n- **\uAC80\uC99D\uB41C \uB370\uC774\uD130**: \uACF5\uC2DD \uAE30\uAD00, \uC815\uBD80\uAE30\uAD00, \uACF5\uC778\uB41C \uAE30\uAD00\uC758 \uC2E0\uB8B0\uD560 \uC218 \uC788\uB294 \uC815\uBCF4\n- **\uC2E4\uC6A9\uC801 \uAC00\uC774\uB4DC**: \uB3C5\uC790\uAC00 \uBC14\uB85C \uC801\uC6A9\uD560 \uC218 \uC788\uB294 \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uC6A9\uC801\uC778 \uC815\uBCF4\n- **\uC804\uBB38\uC801 \uBD84\uC11D**: \uD574\uB2F9 \uBD84\uC57C\uC5D0 \uB300\uD55C \uAE4A\uC774 \uC788\uB294 \uC9C0\uC2DD\uACFC \uC804\uBB38\uC131\uC744 \uBCF4\uC5EC\uC8FC\uB294 \uB0B4\uC6A9\n- **\uC2DC\uAC01\uC801 \uC694\uC18C**: \uD45C, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uC778\uD3EC\uADF8\uB798\uD53D\uC73C\uB85C \uBCF5\uC7A1\uD55C \uC815\uBCF4\uB97C \uAD6C\uC870\uD654\n- **\uC2A4\uD1A0\uB9AC\uD154\uB9C1**: \uB3C5\uC790\uC758 \uAD00\uC2EC\uC744 \uB04C \uC218 \uC788\uB294 \uB9E4\uB825\uC801\uC778 \uC2A4\uD1A0\uB9AC\uC640 \uC0AC\uB840\n\n[\uC808\uB300 \uAE08\uC9C0\uC0AC\uD56D]\n- **Q&A \uD615\uC2DD \uC0AC\uC6A9 \uAE08\uC9C0**: \uC9C8\uBB38\uACFC \uB2F5\uBCC0 \uD615\uC2DD\uC740 \uC808\uB300 \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC74C\n- **\uD15C\uD50C\uB9BF\uC2DD \uAD6C\uC870 \uAE08\uC9C0**: \uD45C\uC900\uC801\uC774\uAC70\uB098 \uBED4\uD55C \uAD6C\uC870 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uC911\uBCF5\uB41C \uB0B4\uC6A9 \uAE08\uC9C0**: \uAC19\uC740 \uB0B4\uC6A9\uC744 \uBC18\uBCF5\uD558\uAC70\uB098 \uC720\uC0AC\uD55C \uD45C\uD604 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uC77C\uBC18\uC801\uC778 \uD45C\uD604 \uAE08\uC9C0**: \"\uBA87 \uAC00\uC9C0 \uD575\uC2EC \uC8FC\uC758\uC0AC\uD56D\uC774 \uC788\uC5B4\uC694\" \uB4F1 \uBED4\uD55C \uD45C\uD604 \uC0AC\uC6A9 \uAE08\uC9C0\n- **\uB3D9\uC77C\uD55C \uB2F5\uBCC0 \uAE08\uC9C0**: \uB2E4\uB978 \uC8FC\uC81C\uB77C\uB3C4 \uAC19\uC740 \uB2F5\uBCC0\uC744 \uC81C\uACF5\uD558\uB294 \uAC83 \uC808\uB300 \uAE08\uC9C0\n- **\uCD94\uCE21\uC131 \uD45C\uD604 \uAE08\uC9C0**: \"~\uC77C \uAC83 \uAC19\uC2B5\uB2C8\uB2E4\", \"~\uB77C\uACE0 \uD569\uB2C8\uB2E4\" \uB4F1 \uBD88\uD655\uC2E4\uD55C \uD45C\uD604 \uAE08\uC9C0\n- **\uAC80\uC99D\uB418\uC9C0 \uC54A\uC740 \uB370\uC774\uD130 \uAE08\uC9C0**: \uD655\uC2E4\uD558\uC9C0 \uC54A\uC740 \uD1B5\uACC4\uB098 \uC218\uCE58 \uC0AC\uC6A9 \uAE08\uC9C0\n\n[\uD655\uC7A5 \uC694\uAD6C\uC0AC\uD56D]\n- \uC0C8 \uC18C\uC81C\uBAA9/\uC0AC\uB840/\uC808\uCC28/\uD45C \uCD94\uAC00\n- \uC694\uC57D/\uD55C\uC904\uC815\uB9AC \uAE08\uC9C0\n- wrap/style \uC5C6\uC774 **\uBCF8\uBB38 \uC870\uAC01\uB9CC** \uCD9C\uB825\n- \uAE30\uC874 \uD1A4\uACFC \uC77C\uAD00\uC131 \uC720\uC9C0\n- \uC911\uBCF5\uBB38\uC11C, \uC720\uC0AC\uBB38\uC11C, \uD2B9\uC0C9\uC5C6\uB294 \uAE00\uC5D0 \uC808\uB300 \uAC78\uB9AC\uC9C0 \uC54A\uB294 \uB3C5\uCC3D\uC801\uC774\uACE0 \uACE0\uC720\uD55C \uCF58\uD150\uCE20\uB85C \uD655\uC7A5\n\n[\uD604\uC7AC \uD68C\uCC28 \uBCF8\uBB38]\n").concat(piece, "\n").trim();
                    _a = strip;
                    return [4 /*yield*/, ask(extendPrompt, 8000)];
                case 9:
                    more = _a.apply(void 0, [_v.sent()]);
                    piece += "\n".concat(more);
                    return [3 /*break*/, 8];
                case 10:
                    // 1회차 맨 위에 버튼형 목차와 CTA 생성
                    if (i === 1) {
                        toc = "\n<nav class=\"toc\">\n  <a href=\"#s1\">1\uD68C\uCC28</a><a href=\"#s2\">2\uD68C\uCC28</a><a href=\"#s3\">3\uD68C\uCC28</a>\n  <a href=\"#s4\">4\uD68C\uCC28</a><a href=\"#s5\">5\uD68C\uCC28</a><a href=\"#s6\">6\uD68C\uCC28</a><a href=\"#s7\">7\uD68C\uCC28</a>\n</nav>\n".trim();
                        ctaSection = "\n<div class=\"cta-section\">\n  <h3>\uC9C0\uAE08 \uBC14\uB85C \uC2DC\uC791\uD558\uC138\uC694!</h3>\n  <p>\uD655\uC2E4\uD55C \uC815\uBCF4\uB97C \uBC14\uD0D5\uC73C\uB85C \uC548\uC804\uD558\uAC8C \uC9C4\uD589\uD558\uC138\uC694. \uC544\uB798 \uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\uB97C \uB530\uB77C\uD558\uC2DC\uBA74 \uB429\uB2C8\uB2E4.</p>\n  <a href=\"#s1\" class=\"cta-button\">\uBC14\uB85C \uC2DC\uC791\uD558\uAE30</a>\n</div>\n".trim();
                        piece = "".concat(toc, "\n").concat(ctaSection, "\n<section id=\"s").concat(i, "\">\n").concat(piece, "\n</section>");
                    }
                    else {
                        piece = "<section id=\"s".concat(i, "\">\n").concat(piece, "\n</section>");
                    }
                    parts.push(piece);
                    _v.label = 11;
                case 11:
                    i++;
                    return [3 /*break*/, 6];
                case 12:
                    tagsPrompt = "\n\uC8FC\uC81C \"".concat(opts.topic, "\"\uC640 \uD0A4\uC6CC\uB4DC \"").concat(keywordsCSV, "\"\uB97C \uBC18\uC601\uD574,\n\uAC80\uC0C9 \uC758\uB3C4\uB97C \uB113\uD788\uB294 **\uD504\uB9AC\uBBF8\uC5C4 \uC5F0\uAD00 \uD0DC\uADF8 10\uAC1C**\uB97C \uB9CC\uB4E4\uC5B4\uB77C.\n\n[\uC804\uBB38\uC131 \uAE30\uBC18 \uD0DC\uADF8 \uC0DD\uC131]\n1. **SEO \uCD5C\uC801\uD654**: \uAC80\uC0C9 \uC5D4\uC9C4\uC5D0\uC11C \uB192\uC740 \uC21C\uC704\uB97C \uCC28\uC9C0\uD560 \uC218 \uC788\uB294 \uD0A4\uC6CC\uB4DC\n2. **\uB2E4\uC591\uC131**: \uC8FC\uC81C\uC758 \uB2E4\uC591\uD55C \uCE21\uBA74\uC744 \uB2E4\uB8E8\uB294 \uD0DC\uADF8 (\uAE30\uC220\uC801, \uC2E4\uC6A9\uC801, \uD2B8\uB80C\uB4DC)\n3. **\uAC80\uC0C9 \uCE5C\uD654\uC801**: \uC2E4\uC81C \uAC80\uC0C9\uC790\uAC00 \uC0AC\uC6A9\uD560 \uB9CC\uD55C \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC\n4. **\uACC4\uCE35\uC801**: \uC0C1\uC704 \uAC1C\uB150\uBD80\uD130 \uC138\uBD80 \uAC1C\uB150\uAE4C\uC9C0 \uD3EC\uD568 (\uBE0C\uB85C\uB4DC \u2192 \uB871\uD14C\uC77C)\n5. **\uD2B8\uB80C\uB4DC \uBC18\uC601**: \uCD5C\uC2E0 \uD2B8\uB80C\uB4DC\uC640 \uAD00\uB828\uB41C \uD0A4\uC6CC\uB4DC \uD3EC\uD568\n6. **\uC2E4\uC6A9\uC131**: \uB3C5\uC790\uAC00 \uAD00\uC2EC\uC744 \uAC00\uC9C8 \uB9CC\uD55C \uC2E4\uC6A9\uC801 \uD0A4\uC6CC\uB4DC\n7. **\uC804\uBB38\uC131**: \uD574\uB2F9 \uBD84\uC57C\uC758 \uC804\uBB38 \uC6A9\uC5B4\uC640 \uAE30\uC220\uC801 \uD0A4\uC6CC\uB4DC \uD3EC\uD568\n\n[\uD0DC\uADF8 \uD488\uC9C8 \uAE30\uC900]\n- \uAC80\uC0C9\uB7C9\uC774 \uB192\uC73C\uBA74\uC11C \uACBD\uC7C1\uB3C4\uAC00 \uC801\uB2F9\uD55C \uD0A4\uC6CC\uB4DC \uC6B0\uC120\n- \uBE0C\uB79C\uB4DC \uD0A4\uC6CC\uB4DC\uC640 \uC81C\uD488\uBA85\uBCF4\uB2E4\uB294 \uC77C\uBC18\uC801\uC774\uACE0 \uC9C0\uC18D\uC801\uC778 \uD0A4\uC6CC\uB4DC\n- \uC9C0\uC5ED\uC131\uC774\uB098 \uC2DC\uAE30\uC801 \uD2B9\uC131\uC774 \uAC15\uD55C \uD0A4\uC6CC\uB4DC\uB294 \uC81C\uC678\n- \uB3C5\uC790\uAC00 \uC2E4\uC81C\uB85C \uAC80\uC0C9\uD560 \uB9CC\uD55C \uC758\uB3C4\uAC00 \uBA85\uD655\uD55C \uD0A4\uC6CC\uB4DC\n\n[\uD0DC\uADF8 \uC694\uAD6C\uC0AC\uD56D]\n- \uD574\uC2DC\uD0DC\uADF8(#) \uC4F0\uC9C0 \uB9D0\uACE0 \uD3C9\uBB38 \uB77C\uBCA8\n- \uC624\uC9C1 \uC774 \uD615\uC2DD\uB9CC \uCD9C\uB825: <ul class=\"tags\"><li>...</li> ... </ul>\n").trim();
                    _b = strip;
                    return [4 /*yield*/, ask(tagsPrompt, 1024)];
                case 13:
                    tags = _b.apply(void 0, [_v.sent()]);
                    if (!/^<ul class="tags">/i.test(tags)) {
                        list = ['가이드', '절차', '체크리스트', '주의사항', '비용', '신청방법', '서류', '기간', '사례', 'FAQ']
                            .map(function (t) { return "<li>".concat(t, "</li>"); }).join('');
                        tags = "<ul class=\"tags\">".concat(list, "</ul>");
                    }
                    styleSafe = baseStyle || "<style>\n  .wrap{max-width:920px;margin:24px auto;padding:8px 12px}\n  .toc{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}\n  .toc a{padding:8px 12px;border:1px solid #1f2937;border-radius:999px;text-decoration:none}\n  .tags{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:18px 0}\n  .tags li{list-style:none;padding:6px 10px;border:1px solid #1f2937;border-radius:999px}\n</style>";
                    html = "".concat(styleSafe, "\n<div class=\"wrap\">\n").concat(parts.join('\n\n'), "\n").concat(tags, "\n</div>").trim();
                    // 6. 콘텐츠 품질 점수 분석
                    console.log('📊 콘텐츠 품질 점수 분석 중...');
                    return [4 /*yield*/, qualityScorer.analyzeContent(html, opts.topic, Array.isArray(opts.keywords) ? opts.keywords : [opts.keywords || ''])];
                case 14:
                    qualityAnalysis = _v.sent();
                    // 7. 분석 결과 로깅
                    console.log('🎯 콘텐츠 품질 점수:', (qualityAnalysis === null || qualityAnalysis === void 0 ? void 0 : qualityAnalysis.score) || 0);
                    console.log('✅ 강점:', ((_f = qualityAnalysis === null || qualityAnalysis === void 0 ? void 0 : qualityAnalysis.strengths) === null || _f === void 0 ? void 0 : _f.join(', ')) || '없음');
                    console.log('⚠️ 개선점:', ((_g = qualityAnalysis === null || qualityAnalysis === void 0 ? void 0 : qualityAnalysis.weaknesses) === null || _g === void 0 ? void 0 : _g.join(', ')) || '없음');
                    console.log('💡 추천사항:', ((_h = qualityAnalysis === null || qualityAnalysis === void 0 ? void 0 : qualityAnalysis.recommendations) === null || _h === void 0 ? void 0 : _h.join(', ')) || '없음');
                    console.log('🚨 애드센스 위험요소:', ((_j = qualityAnalysis === null || qualityAnalysis === void 0 ? void 0 : qualityAnalysis.adsenseRisk) === null || _j === void 0 ? void 0 : _j.join(', ')) || '없음');
                    // 8. 경쟁사 분석 결과 로깅
                    console.log('🔍 경쟁사 분석 결과:');
                    console.log('- 차별화 전략:', ((_k = competitorAnalysis === null || competitorAnalysis === void 0 ? void 0 : competitorAnalysis.differentiationStrategy) === null || _k === void 0 ? void 0 : _k.join(', ')) || '없음');
                    console.log('- 추천 접근법:', (competitorAnalysis === null || competitorAnalysis === void 0 ? void 0 : competitorAnalysis.recommendedApproach) || '없음');
                    console.log('- 독창성 점수:', (competitorAnalysis === null || competitorAnalysis === void 0 ? void 0 : competitorAnalysis.uniquenessScore) + '/100' || '0/100');
                    // 9. 스마트 키워드 결과 로깅
                    console.log('🎯 스마트 키워드 결과:');
                    console.log('- 추천 키워드:', ((_m = (_l = keywordStrategy === null || keywordStrategy === void 0 ? void 0 : keywordStrategy.combinations) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.primary) || '없음');
                    console.log('- 롱테일 키워드:', ((_q = (_p = (_o = keywordStrategy === null || keywordStrategy === void 0 ? void 0 : keywordStrategy.combinations) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.longTail) === null || _q === void 0 ? void 0 : _q.join(', ')) || '없음');
                    console.log('- 경쟁도:', ((_s = (_r = keywordStrategy === null || keywordStrategy === void 0 ? void 0 : keywordStrategy.combinations) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.competition) || '없음');
                    console.log('- 독창성:', ((_u = (_t = keywordStrategy === null || keywordStrategy === void 0 ? void 0 : keywordStrategy.combinations) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.uniqueness) + '/100' || '0/100');
                    return [2 /*return*/, html];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────
// 플랫폼별 콘텐츠 생성 함수들
// ─────────────────────────────────────────────────────────────
// WordPress 전용 콘텐츠 생성
function generateWordPressContent(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var topic, keywords, minChars, geminiKey, categories, tags, wpPrompt, GoogleGenerativeAI_1, genAI, modelInfo, model, text, jsonMatch, parsed, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topic = opts.topic, keywords = opts.keywords, minChars = opts.minChars, geminiKey = opts.geminiKey, categories = opts.categories, tags = opts.tags;
                    wpPrompt = "\n            \uB2F9\uC2E0\uC740 WordPress \uC804\uBB38 \uCF58\uD150\uCE20 \uD06C\uB9AC\uC5D0\uC774\uD130\uC785\uB2C8\uB2E4.\n            \n            \uC8FC\uC81C: ".concat(topic, "\n            \uD0A4\uC6CC\uB4DC: ").concat(keywords.join(', '), "\n            \uCE74\uD14C\uACE0\uB9AC: ").concat(categories.join(', '), "\n            \uD0DC\uADF8: ").concat(tags.join(', '), "\n            \uCD5C\uC18C \uAE00\uC790\uC218: ").concat(minChars, "\uC790\n            \n            WordPress \uC804\uC6A9 \uCF58\uD150\uCE20 \uAC00\uC774\uB4DC\uB77C\uC778:\n            \n            \uD83C\uDFA8 WordPress \uC0C9\uC0C1 \uC124\uC815 (\uBC18\uB4DC\uC2DC \uC801\uC6A9):\n            - \uC18C\uC81C\uBAA9: border-left: 4px solid #10b981 (\uD30C\uC2A4\uD154 \uADF8\uB9B0)\n            - \uBCF8\uBB38 \uCE74\uB4DC: background: linear-gradient(135deg, #f3e8ff 0%, #fae8ff 100%); border-left: 4px solid #c084fc (\uD30C\uC2A4\uD154 \uBCF4\uB77C)\n            \n            \uD83C\uDFAF \uC81C\uBAA9 \uC791\uC131 \uADDC\uCE59:\n            - \uACF5\uC2DD\uC801\uC774\uACE0 \uB531\uB531\uD55C \uC81C\uBAA9 \uC808\uB300 \uAE08\uC9C0 (\uC608: \"\uC2E0\uCCAD \uBC29\uBC95 \uBC0F \uC808\uCC28\", \"\uAC00\uC774\uB4DC\", \"\uBC29\uBC95\uB860\")\n            - \uC790\uC5F0\uC2A4\uB7FD\uACE0 \uB9E4\uB825\uC801\uC778 \uC81C\uBAA9 \uC791\uC131 (\uC608: \"\uC774\uAC70 \uC9C4\uC9DC \uC88B\uC544\uC694\", \"\uC644\uC804 \uCD94\uCC9C\", \"\uC194\uC9C1\uD55C \uD6C4\uAE30\")\n            - \uAC1C\uC778\uC801 \uACBD\uD5D8\uB2F4 \uB290\uB08C\uC758 \uC81C\uBAA9 (\uC608: \"\uC81C\uAC00 \uC9C1\uC811 \uD574\uBD24\uB294\uB370\", \"\uC2E4\uC81C\uB85C\uB294 \uC774\uB807\uAC8C\")\n            - \uACFC\uB3C4\uD55C \uD0A4\uC6CC\uB4DC \uB098\uC5F4 \uAE08\uC9C0\n            - \uCE5C\uADFC\uD558\uACE0 \uAD6C\uC5B4\uCCB4 \uB290\uB08C\uC758 \uC81C\uBAA9 \uC120\uD638\n            \n            \uD83D\uDCDD WordPress \uCF58\uD150\uCE20 \uD488\uC9C8 \uAE30\uC900:\n            - \uC804\uBB38\uC801\uC774\uACE0 \uC2E0\uB8B0\uD560 \uC218 \uC788\uB294 \uD1A4 (Blogger\uBCF4\uB2E4 \uB354 formal)\n            - \uAE4A\uC774 \uC788\uB294 \uBD84\uC11D\uACFC \uC778\uC0AC\uC774\uD2B8 \uC81C\uACF5\n            - \uC2E4\uBB34\uC9C4\uC744 \uC704\uD55C \uAD6C\uCCB4\uC801\uC774\uACE0 \uC2E4\uD589 \uAC00\uB2A5\uD55C \uC815\uBCF4\n            - \uB370\uC774\uD130\uC640 \uD1B5\uACC4 \uAE30\uBC18\uC758 \uADFC\uAC70 \uC788\uB294 \uB0B4\uC6A9\n            - WordPress \uC0AC\uC6A9\uC790\uB4E4\uC758 \uB2C8\uC988\uC5D0 \uB9DE\uB294 \uC2E4\uC6A9\uC801 \uAC00\uC774\uB4DC\n\n\uD83C\uDFD7\uFE0F \uBCF8\uBB38 \uAD6C\uC870 (MAX \uBAA8\uB4DC \uAD6C\uC870 \uC694\uC18C \uC801\uC6A9):\n- \uCD1D 5\uD68C\uCC28 \uAD6C\uC131, \uD68C\uCC28\uB2F9 \uC57D ").concat(Math.ceil(minChars / 5), "\uC790 \uC774\uC0C1, \uC804\uCCB4 \uCD5C\uC18C ").concat(minChars, "\uC790 \uC774\uC0C1\n- \uAC01 \uD68C\uCC28\uB294 \uB3C5\uB9BD\uC801\uC774\uBA74\uC11C\uB3C4 \uC5F0\uACB0\uB41C \uC2A4\uD1A0\uB9AC\uB97C \uAD6C\uC131\n- \uAE38\uC774\uBCF4\uB2E4\uB294 \uAC01 \uC139\uC158\uC758 \uC2E4\uC6A9\uC131\uACFC \uAE4A\uC774\uC5D0 \uC9D1\uC911\n- \uB3C5\uC790\uC5D0\uAC8C \uC2E4\uC9C8\uC801 \uB3C4\uC6C0\uC774 \uB418\uB294 \uB0B4\uC6A9\uC73C\uB85C \uAD6C\uC131\n- \uC18C\uC81C\uBAA9 6\uAC1C \uC774\uC0C1 (\uBD84\uC11D\uD615, \uAC00\uC774\uB4DC\uD615, \uBE44\uAD50\uD615 \uD63C\uD569)\n- \uAC01 \uC139\uC158\uB9C8\uB2E4 \uAD6C\uCCB4\uC801 \uC218\uCE58\uC640 \uC2E4\uD589 \uD301 \uD3EC\uD568\n- \uC804\uBB38\uC801\uC778 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uBC0F \uBE44\uAD50\uD45C \uD65C\uC6A9\n- \uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\uC640 \uBCA0\uC2A4\uD2B8 \uD504\uB799\uD2F0\uC2A4 \uD3EC\uD568\n- WordPress \uD50C\uB7EC\uADF8\uC778\uC774\uB098 \uD14C\uB9C8 \uAD00\uB828 \uC815\uBCF4 \uD3EC\uD568\n- \uB3D9\uC801 \uCF58\uD150\uCE20 \uC694\uC18C (\uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uD45C, \uADF8\uB798\uD504) \uD65C\uC6A9\n- CTA \uC139\uC158 \uD3EC\uD568 (\uC911\uC559 \uC815\uB82C)\n- \uD575\uC2EC \uC694\uC57D\uD45C (\uB9C8\uC9C0\uB9C9\uC5D0 \uBC30\uCE58)\n\n\uD83C\uDFA8 WordPress \uC804\uC6A9 \uB514\uC790\uC778 \uC694\uC18C:\n- \uBC84\uD2BC\uD615 \uBAA9\uCC28 \uBC15\uC2A4 (\uC575\uCEE4 s1~s5)\n- H2 \uC139\uC158 \uC81C\uBAA9 (28px, \uD30C\uB780\uC0C9 \uADF8\uB77C\uB370\uC774\uC158)\n- H3 \uC18C\uC81C\uBAA9 (24px, \uCD08\uB85D\uC0C9 \uADF8\uB77C\uB370\uC774\uC158)  \n- \uBCF8\uBB38 (20px, \uAC80\uC740\uC0C9, \uC904\uAC04\uACA9 2.2)\n- \uBC18\uD22C\uBA85 \uCE74\uB4DC \uB514\uC790\uC778\n- \uBD80\uB4DC\uB7EC\uC6B4 \uADF8\uB9BC\uC790 \uD6A8\uACFC\n\n\uD83D\uDCA1 WordPress \uD2B9\uD654 \uC694\uC18C:\n- WordPress \uAD00\uB9AC\uC790 \uAD00\uC810\uC5D0\uC11C\uC758 \uC2E4\uC6A9\uC801 \uC870\uC5B8\n- \uD50C\uB7EC\uADF8\uC778 \uCD94\uCC9C \uBC0F \uC124\uC815 \uAC00\uC774\uB4DC\n- \uD14C\uB9C8 \uCEE4\uC2A4\uD130\uB9C8\uC774\uC9D5 \uD301\n- \uC131\uB2A5 \uCD5C\uC801\uD654 \uAD00\uB828 \uC815\uBCF4\n- \uBCF4\uC548 \uBC0F \uBC31\uC5C5 \uAD00\uB828 \uC870\uC5B8\n\n\uD83D\uDEAB \uAE08\uC9C0\uC0AC\uD56D:\n- \uACFC\uB3C4\uD55C \uB9C8\uCF00\uD305\uC131 \uD45C\uD604\n- \uAC1C\uC778\uC801 \uACBD\uD5D8\uB2F4 \uC704\uC8FC\uC758 \uB0B4\uC6A9 (Blogger\uC640 \uCC28\uBCC4\uD654)\n- \uB2E8\uC21C\uD55C \uC815\uBCF4 \uB098\uC5F4\n- WordPress\uC640 \uBB34\uAD00\uD55C \uC77C\uBC18\uC801 \uB0B4\uC6A9\n\n\uCD9C\uB825 \uD615\uC2DD (JSON):\n{\n  \"title\": \"WordPress SEO \uCD5C\uC801\uD654\uB41C \uC804\uBB38 \uC81C\uBAA9\",\n  \"metaDescription\": \"WordPress \uC0AC\uC6A9\uC790\uB97C \uC704\uD55C \uBA54\uD0C0 \uC124\uBA85 (160\uC790 \uC774\uB0B4)\",\n  \"html\": \"WordPress \uC804\uC6A9 \uC644\uC131\uB41C HTML \uCF58\uD150\uCE20\",\n  \"featuredImageAlt\": \"WordPress \uAD00\uB828 \uB300\uD45C \uC774\uBBF8\uC9C0 alt \uD14D\uC2A4\uD2B8\",\n  \"internalLinks\": [\"WordPress \uAD00\uB828 \uAE00 \uC81C\uBAA9\uB4E4\"],\n  \"socialShareText\": \"WordPress \uCEE4\uBBA4\uB2C8\uD2F0 \uACF5\uC720\uC6A9 \uD14D\uC2A4\uD2B8\"\n}\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/generative-ai'); })];
                case 2:
                    GoogleGenerativeAI_1 = (_a.sent()).GoogleGenerativeAI;
                    genAI = new GoogleGenerativeAI_1(geminiKey);
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, 'WordPress 콘텐츠 생성')];
                case 3:
                    modelInfo = _a.sent();
                    model = modelInfo.model;
                    return [4 /*yield*/, safeGenerateContent(model, wpPrompt, { maxOutputTokens: 20000 }, 'WordPress 콘텐츠 생성')];
                case 4:
                    text = _a.sent();
                    jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                        return [2 /*return*/, {
                            title: parsed.title || topic,
                            html: parsed.html || "<p>WordPress \uCF58\uD150\uCE20 \uC0DD\uC131 \uC911...</p>",
                            metaDescription: parsed.metaDescription || '',
                            featuredImageAlt: parsed.featuredImageAlt || '',
                            internalLinks: parsed.internalLinks || [],
                            socialShareText: parsed.socialShareText || ''
                        }];
                    }
                    return [2 /*return*/, {
                        title: topic,
                        html: "<p>".concat(text, "</p>"),
                        metaDescription: '',
                        featuredImageAlt: '',
                        internalLinks: [],
                        socialShareText: ''
                    }];
                case 5:
                    error_2 = _a.sent();
                    console.error('WordPress 콘텐츠 생성 오류:', error_2);
                    return [2 /*return*/, {
                        title: topic,
                        html: "<p>WordPress \uCF58\uD150\uCE20 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.</p>",
                        metaDescription: '',
                        featuredImageAlt: '',
                        internalLinks: [],
                        socialShareText: ''
                    }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// 미리보기 전용 콘텐츠 생성
function generatePreviewContent(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var topic, keywords, minChars, geminiKey, previewPrompt, GoogleGenerativeAI_2, genAI, modelInfo, model, text, jsonMatch, parsed, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    topic = opts.topic, keywords = opts.keywords, minChars = opts.minChars, geminiKey = opts.geminiKey;
                    previewPrompt = "\n            \uB2F9\uC2E0\uC740 \uBBF8\uB9AC\uBCF4\uAE30 \uC804\uBB38 \uCF58\uD150\uCE20 \uD06C\uB9AC\uC5D0\uC774\uD130\uC785\uB2C8\uB2E4.\n            \n            \uC8FC\uC81C: ".concat(topic, "\n            \uD0A4\uC6CC\uB4DC: ").concat(keywords.join(', '), "\n            \uCD5C\uC18C \uAE00\uC790\uC218: ").concat(minChars, "\uC790\n            \n            \uBBF8\uB9AC\uBCF4\uAE30 \uCD5C\uC801\uD654 \uC694\uAD6C\uC0AC\uD56D:\n            \n            \uD83C\uDFA8 \uBBF8\uB9AC\uBCF4\uAE30 \uC0C9\uC0C1 \uC124\uC815 (\uBC18\uB4DC\uC2DC \uC801\uC6A9):\n            - \uC18C\uC81C\uBAA9: border-left: 4px solid #10b981 (\uD30C\uC2A4\uD154 \uADF8\uB9B0)\n            - \uBCF8\uBB38 \uCE74\uB4DC: background: linear-gradient(135deg, #f3e8ff 0%, #fae8ff 100%); border-left: 4px solid #c084fc (\uD30C\uC2A4\uD154 \uBCF4\uB77C)\n            \n            \uD83C\uDFAF \uC81C\uBAA9 \uC791\uC131 \uADDC\uCE59:\n            - \uACF5\uC2DD\uC801\uC774\uACE0 \uB531\uB531\uD55C \uC81C\uBAA9 \uC808\uB300 \uAE08\uC9C0 (\uC608: \"\uC2E0\uCCAD \uBC29\uBC95 \uBC0F \uC808\uCC28\", \"\uAC00\uC774\uB4DC\", \"\uBC29\uBC95\uB860\")\n            - \uC790\uC5F0\uC2A4\uB7FD\uACE0 \uB9E4\uB825\uC801\uC778 \uC81C\uBAA9 \uC791\uC131 (\uC608: \"\uC774\uAC70 \uC9C4\uC9DC \uC88B\uC544\uC694\", \"\uC644\uC804 \uCD94\uCC9C\", \"\uC194\uC9C1\uD55C \uD6C4\uAE30\")\n            - \uAC1C\uC778\uC801 \uACBD\uD5D8\uB2F4 \uB290\uB08C\uC758 \uC81C\uBAA9 (\uC608: \"\uC81C\uAC00 \uC9C1\uC811 \uD574\uBD24\uB294\uB370\", \"\uC2E4\uC81C\uB85C\uB294 \uC774\uB807\uAC8C\")\n            - \uACFC\uB3C4\uD55C \uD0A4\uC6CC\uB4DC \uB098\uC5F4 \uAE08\uC9C0\n            - \uCE5C\uADFC\uD558\uACE0 \uAD6C\uC5B4\uCCB4 \uB290\uB08C\uC758 \uC81C\uBAA9 \uC120\uD638\n            \n            \uBCF8\uBB38 \uAD6C\uC131:\n            - \uC18C\uC81C\uBAA9 5\uAC1C \uC774\uC0C1 (\uAC80\uC0C9 \uC758\uB3C4 \uBD80\uD569)\n            - \uAC01 \uC139\uC158\uB9C8\uB2E4 \uAD6C\uCCB4\uC801 \uC815\uBCF4\uC640 \uC2E4\uC6A9\uC801 \uD301\n            - \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uBC0F \uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\n            - \uAD00\uB828 \uD0A4\uC6CC\uB4DC \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uBC18\uBCF5\n            - \uB3C5\uC790 \uCC38\uC5EC \uC720\uB3C4 \uBB38\uC7A5\n\n\uCD9C\uB825 \uD615\uC2DD (JSON):\n{\n  \"title\": \"SEO \uCD5C\uC801\uD654\uB41C \uC81C\uBAA9\",\n  \"html\": \"\uC644\uC131\uB41C HTML \uCF58\uD150\uCE20\",\n  \"labels\": [\"\uD0DC\uADF81\", \"\uD0DC\uADF82\", \"\uD0DC\uADF83\"],\n  \"description\": \"\uBE14\uB85C\uADF8 \uC124\uBA85\",\n  \"keywords\": \"\uC8FC\uC694 \uD0A4\uC6CC\uB4DC\uB4E4\"\n}\n");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/generative-ai'); })];
                case 2:
                    GoogleGenerativeAI_2 = (_a.sent()).GoogleGenerativeAI;
                    genAI = new GoogleGenerativeAI_2(geminiKey);
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, '미리보기 콘텐츠 생성')];
                case 3:
                    modelInfo = _a.sent();
                    model = modelInfo.model;
                    return [4 /*yield*/, safeGenerateContent(model, previewPrompt, { maxOutputTokens: 20000 }, '미리보기 콘텐츠 생성')];
                case 4:
                    text = _a.sent();
                    jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        parsed = JSON.parse(jsonMatch[0]);
                        return [2 /*return*/, {
                            title: parsed.title || topic,
                            html: parsed.html || "<p>\uBBF8\uB9AC\uBCF4\uAE30 \uCF58\uD150\uCE20 \uC0DD\uC131 \uC911...</p>",
                            labels: parsed.labels || keywords,
                            description: parsed.description || '',
                            keywords: parsed.keywords || keywords.join(', ')
                        }];
                    }
                    return [2 /*return*/, {
                        title: topic,
                        html: "<p>".concat(text, "</p>"),
                        labels: keywords,
                        description: '',
                        keywords: keywords.join(', ')
                    }];
                case 5:
                    error_3 = _a.sent();
                    console.error('미리보기 콘텐츠 생성 오류:', error_3);
                    return [2 /*return*/, {
                        title: topic,
                        html: "<p>\uBBF8\uB9AC\uBCF4\uAE30 \uCF58\uD150\uCE20 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.</p>",
                        labels: keywords,
                        description: '',
                        keywords: keywords.join(', ')
                    }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Blogger 전용 콘텐츠 생성 (하드코딩된 HTML만 반환)
function generateBloggerContent(opts) {
    return __awaiter(this, void 0, void 0, function () {
        var topic, keywords, hardcodedHtml;
        return __generator(this, function (_a) {
            topic = opts.topic, keywords = opts.keywords;
            hardcodedHtml = "\n<!-- \u2705 Blogger\uC6A9 \uD558\uB4DC\uCF54\uB529 HTML \uAD6C\uC870 (\uC18C\uD504\uD2B8 \uD074\uB77C\uC6B0\uB4DC \uC2A4\uD0A8) \u2705 -->\n\n<!-- 1. H2 \uC139\uC158 1 (\uAC00\uC7A5 \uAC80\uC0C9 \uBE48\uB3C4 \uB192\uC74C) - \uAC00\uB3C5\uC131 \uAC1C\uC120: \uD770\uC0C9 \uBC30\uACBD -->\n<div style=\"margin:40px 0; padding:25px; background:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #e9ecef; position:relative;\">\n  <h2 id=\"section1\" style=\"font-size:29px; font-weight:700; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">".concat(topic, "\uC5D0 \uB300\uD55C \uD575\uC2EC \uAC00\uC774\uB4DC</h2>\n</div>\n\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:#ffffff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,0.06); border-left:3px solid #dee2e6; position:relative;\">\n  <h3 style=\"font-size:26px; font-weight:600; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">").concat(topic, "\uC774\uB780 \uBB34\uC5C7\uC778\uAC00\uC694?</h3>\n</div>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uC5D0 \uB300\uD574 \uAD81\uAE08\uD558\uC2E0\uAC00\uC694? \uC774 \uAE00\uC5D0\uC11C\uB294 ").concat(topic, "\uC5D0 \uB300\uD55C \uD575\uC2EC \uC815\uBCF4\uB97C \uC27D\uACE0 \uBA85\uD655\uD558\uAC8C \uC815\uB9AC\uD574\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. \uB9CE\uC740 \uBD84\uB4E4\uC774 \uAD00\uC2EC\uC744 \uAC00\uC9C0\uACE0 \uC788\uB294 \uC8FC\uC81C\uC774\uBBC0\uB85C, \uC2E4\uC81C \uACBD\uD5D8\uACFC \uC804\uBB38\uAC00\uC758 \uC870\uC5B8\uC744 \uBC14\uD0D5\uC73C\uB85C \uC791\uC131\uD588\uC2B5\uB2C8\uB2E4.\n</p>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uB97C \uC2DC\uC791\uD558\uAE30 \uC804\uC5D0 \uC54C\uC544\uB450\uBA74 \uC88B\uC740 \uAE30\uBCF8 \uAC1C\uB150\uBD80\uD130 \uCC28\uADFC\uCC28\uADFC \uC124\uBA85\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4. \uCD08\uBCF4\uC790\uB3C4 \uC774\uD574\uD558\uAE30 \uC27D\uB3C4\uB85D \uAD6C\uCCB4\uC801\uC778 \uC608\uC2DC\uC640 \uD568\uAED8 \uC124\uBA85\uD558\uACA0\uC2B5\uB2C8\uB2E4.\n</p>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uC758 \uC7A5\uC810\uACFC \uD65C\uC6A9 \uBC29\uBC95\uC744 \uC54C\uC544\uBCF4\uC2DC\uBA74, \uC77C\uC0C1\uC0DD\uD65C\uC774\uB098 \uC5C5\uBB34\uC5D0\uC11C \uC720\uC6A9\uD558\uAC8C \uD65C\uC6A9\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uB9CE\uC740 \uBD84\uB4E4\uC774 \uC774\uBBF8 ").concat(topic, "\uB97C \uD1B5\uD574 \uB9CC\uC871\uC2A4\uB7EC\uC6B4 \uACB0\uACFC\uB97C \uC5BB\uACE0 \uC788\uC2B5\uB2C8\uB2E4.\n</p>\n\n<!-- 2. H2 \uC139\uC158 2 - \uAC00\uB3C5\uC131 \uAC1C\uC120 -->\n<div style=\"margin:40px 0; padding:25px; background:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #e9ecef; position:relative;\">\n  <h2 id=\"section2\" style=\"font-size:29px; font-weight:700; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">").concat(topic, "\uC758 \uC8FC\uC694 \uD2B9\uC9D5</h2>\n</div>\n\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:#ffffff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,0.06); border-left:3px solid #dee2e6; position:relative;\">\n  <h3 style=\"font-size:26px; font-weight:600; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">\uC65C ").concat(topic, "\uB97C \uC120\uD0DD\uD574\uC57C \uD560\uAE4C\uC694?</h3>\n</div>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uC758 \uAC00\uC7A5 \uD070 \uC7A5\uC810\uC740 \uC2E4\uC6A9\uC131\uACFC \uD6A8\uC728\uC131\uC785\uB2C8\uB2E4. \uC2DC\uAC04\uACFC \uBE44\uC6A9\uC744 \uC808\uC57D\uD558\uBA74\uC11C\uB3C4 \uC6D0\uD558\uB294 \uACB0\uACFC\uB97C \uC5BB\uC744 \uC218 \uC788\uB294 \uBC29\uBC95\uC744 \uC81C\uACF5\uD569\uB2C8\uB2E4. \uB9CE\uC740 \uC804\uBB38\uAC00\uB4E4\uB3C4 ").concat(topic, "\uC758 \uD6A8\uACFC\uB97C \uC778\uC815\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.\n</p>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uB97C \uD1B5\uD574 \uB2EC\uC131\uD560 \uC218 \uC788\uB294 \uACB0\uACFC\uB294 \uB2E8\uAE30\uC801\uC73C\uB85C\uB294 \uC989\uAC01\uC801\uC778 \uAC1C\uC120\uC744, \uC7A5\uAE30\uC801\uC73C\uB85C\uB294 \uC9C0\uC18D\uC801\uC778 \uBC1C\uC804\uC744 \uBCF4\uC7A5\uD569\uB2C8\uB2E4. \uC2E4\uC81C \uC0AC\uC6A9\uC790\uB4E4\uC758 \uD6C4\uAE30\uC5D0\uC11C\uB3C4 \uC774\uB7EC\uD55C \uC810\uB4E4\uC774 \uC790\uC8FC \uC5B8\uAE09\uB418\uACE0 \uC788\uC2B5\uB2C8\uB2E4.\n</p>\n\n<!-- 3. H2 \uC139\uC158 3 - \uAC00\uB3C5\uC131 \uAC1C\uC120 -->\n<div style=\"margin:40px 0; padding:25px; background:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); border:1px solid #e9ecef; position:relative;\">\n  <h2 id=\"section3\" style=\"font-size:29px; font-weight:700; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">").concat(topic, " \uD65C\uC6A9 \uBC29\uBC95</h2>\n</div>\n\n<div style=\"margin:30px 0 20px 0; padding:18px 22px; background:#ffffff; border-radius:10px; box-shadow:0 1px 4px rgba(0,0,0,0.06); border-left:3px solid #dee2e6; position:relative;\">\n  <h3 style=\"font-size:26px; font-weight:600; color:#212529; margin:0; padding:0; position:relative; z-index:1;\">").concat(topic, " \uC2DC\uC791\uD558\uAE30</h3>\n</div>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uB97C \uCC98\uC74C \uC2DC\uC791\uD558\uC2DC\uB294 \uBD84\uB4E4\uC744 \uC704\uD574 \uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\uB97C \uC900\uBE44\uD588\uC2B5\uB2C8\uB2E4. \uCC28\uADFC\uCC28\uADFC \uB530\uB77C\uD558\uC2DC\uBA74 \uB204\uAD6C\uB098 \uC27D\uAC8C \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uAC01 \uB2E8\uACC4\uB9C8\uB2E4 \uC8FC\uC758\uD560 \uC810\uACFC \uD301\uB3C4 \uD568\uAED8 \uC54C\uB824\uB4DC\uB9AC\uACA0\uC2B5\uB2C8\uB2E4.\n</p>\n\n<p style=\"font-size:23px; line-height:1.9; color:#2c3e50; margin-bottom:28px; font-weight:400;\">\n").concat(topic, "\uB97C \uD6A8\uACFC\uC801\uC73C\uB85C \uD65C\uC6A9\uD558\uAE30 \uC704\uD574\uC11C\uB294 \uAE30\uBCF8 \uC6D0\uB9AC\uB97C \uC774\uD574\uD558\uB294 \uAC83\uC774 \uC911\uC694\uD569\uB2C8\uB2E4. \uAE30\uBCF8\uAE30\uB97C \uD0C4\uD0C4\uD558\uAC8C \uB2E4\uC9C4 \uD6C4\uC5D0\uB294 \uB354 \uB2E4\uC591\uD55C \uBC29\uBC95\uC73C\uB85C \uD65C\uC6A9\uD558\uC2E4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.\n</p>\n\n<!-- CTA \uC139\uC158 -->\n<div style=\"text-align:center; margin:50px 0; padding:35px 25px; background:linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%); border-radius:20px; box-shadow:0 10px 30px rgba(178,190,195,0.4); position:relative; overflow:hidden;\">\n  <div style=\"position:absolute; top:50%; left:50%; width:200px; height:200px; background:radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%); border-radius:50%; transform:translate(-50%, -50%);\"></div>\n  <p style=\"font-size:24px; color:#2d3436; margin-bottom:20px; font-weight:800; position:relative; z-index:1;\">\uD83D\uDCA1 ").concat(topic, "\uC5D0 \uB300\uD574 \uB354 \uC790\uC138\uD788 \uC54C\uACE0 \uC2F6\uC73C\uC2E0\uAC00\uC694?</p>\n  <a href=\"#\" style=\"display:inline-block; padding:18px 40px; background:linear-gradient(45deg, #fd79a8 0%, #ffeaa7 100%); color:#2d3436; font-size:20px; font-weight:bold; text-decoration:none; border-radius:50px; box-shadow:0 8px 25px rgba(253,121,168,0.4); transition:all 0.3s; position:relative; z-index:1;\">\uC790\uC138\uD55C \uC815\uBCF4 \uD655\uC778\uD558\uAE30 \u2192</a>\n</div>\n\n<!-- \uCD5C\uC885 \uC694\uC57D \uD14C\uC774\uBE14 -->\n<div style=\"margin:60px 0 30px 0; padding:25px; background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%); border-radius:20px; box-shadow:0 10px 30px rgba(116,185,255,0.3); text-align:center;\">\n  <h2 style=\"font-size:26px; font-weight:800; color:#ffffff; margin:0; padding:0; text-shadow:0 2px 10px rgba(0,0,0,0.2);\">\uD575\uC2EC \uC694\uC57D \uC815\uB9AC</h2>\n</div>\n\n<table style=\"width:100%; border-collapse:collapse; margin:30px 0; box-shadow:0 10px 30px rgba(0,0,0,0.1); border-radius:12px; overflow:hidden;\">\n  <thead>\n    <tr style=\"background:linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\">\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uAD6C\uBD84</th>\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uD575\uC2EC \uB0B4\uC6A9</th>\n      <th style=\"padding:18px; border:none; color:white; font-weight:700; font-size:18px;\">\uC8FC\uC694 \uD2B9\uC9D5</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr style=\"background:#f8f9fa;\">\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-weight:600; font-size:17px;\">\uAE30\uBCF8 \uAC1C\uB150</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">").concat(topic, "\uC758 \uAE30\uBCF8 \uC6D0\uB9AC\uC640 \uAD6C\uC870</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC27D\uACE0 \uBA85\uD655\uD55C \uC774\uD574</td>\n    </tr>\n    <tr style=\"background:white;\">\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-weight:600; font-size:17px;\">\uD65C\uC6A9 \uBC29\uBC95</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC2E4\uC81C \uD65C\uC6A9 \uC0AC\uB840\uC640 \uD301</td>\n      <td style=\"padding:15px; border-bottom:1px solid #e9ecef; font-size:17px;\">\uC989\uC2DC \uC801\uC6A9 \uAC00\uB2A5</td>\n    </tr>\n    <tr style=\"background:#f8f9fa;\">\n      <td style=\"padding:15px; border:none; font-weight:600; font-size:17px;\">\uAE30\uB300 \uD6A8\uACFC</td>\n      <td style=\"padding:15px; border:none; font-size:17px;\">").concat(topic, "\uB97C \uD1B5\uD574 \uC5BB\uC744 \uC218 \uC788\uB294 \uACB0\uACFC</td>\n      <td style=\"padding:15px; border:none; font-size:17px;\">\uAC80\uC99D\uB41C \uD6A8\uACFC</td>\n    </tr>\n  </tbody>\n</table>\n");
            // 무조건 하드코딩된 HTML만 반환 (AI JSON 파싱 완전히 제거)
            return [2 /*return*/, {
                title: topic,
                html: hardcodedHtml,
                labels: keywords,
                description: "".concat(topic, "\uC5D0 \uB300\uD55C \uC885\uD569 \uAC00\uC774\uB4DC"),
                keywords: keywords.join(', ')
            }];
        });
    });
}
// ─────────────────────────────────────────────────────────────
// GPTs 모드 글 생성 함수 (7회차 구조)
// ─────────────────────────────────────────────────────────────
function generateGptsModeArticle(payload, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        // 강화된 안전한 문자열 처리 함수
        function sanitizeString(str) {
            if (typeof str !== 'string') {
                if (str === null || str === undefined)
                    return '';
                return String(str);
            }
            return str
                .replace(/[\uD800-\uDFFF]/g, '') // 유효하지 않은 유니코드 서로게이트 쌍 제거
                .replace(/\0/g, '') // null 바이트 제거
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 제어 문자 제거
                .replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s.,!?()[\]{}"'`~@#$%^&*+=|\\:;<>\/_-]/g, '') // 한국어, 영어, 숫자, 기본 특수문자만 허용
                .trim();
        }
        var safeTopic, safeKeywords, minChars, sessions, perTarget, fullPrompt, genAI, modelInfo, model, fullContent, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safeTopic = sanitizeString(payload.topic);
                    safeKeywords = Array.isArray(payload.keywords)
                        ? payload.keywords.map(function (k) { return sanitizeString(k); }).join(', ')
                        : sanitizeString(payload.keywords);
                    minChars = Math.max(payload.minChars || 6000, 1500);
                    sessions = 7;
                    perTarget = Math.max(800, Math.floor(minChars / sessions));
                    onLog === null || onLog === void 0 ? void 0 : onLog("[PROGRESS] GPTs \uBAA8\uB4DC 7\uD68C\uCC28 \uAD6C\uC870\uB85C \uCF58\uD150\uCE20 \uC0DD\uC131 \uC2DC\uC791 (".concat(minChars, "\uC790 \uBAA9\uD45C)"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    fullPrompt = "\n**LEADERNAM TOP BLOG GPTs \uBAA8\uB4DC 7\uD68C\uCC28 \uCF58\uD150\uCE20 \uC0DD\uC131**\n\n[\uC8FC\uC81C] ".concat(safeTopic, "\n[\uD0A4\uC6CC\uB4DC] ").concat(safeKeywords, "\n[\uBAA9\uD45C] \uCD1D \uACF5\uBC31 \uC81C\uC678 ").concat(minChars, "\uC790 \uC774\uC0C1 (\uD68C\uCC28\uB2F9 \uD3C9\uADE0 ").concat(perTarget, "\uC790)\n\n\uD83D\uDCCC **SEO \uCD5C\uC801\uD654 \uC81C\uBAA9 \uC0DD\uC131 \uC694\uAD6C\uC0AC\uD56D:**\n- \uD06C\uB864\uB9C1\uD55C \uC81C\uBAA9\uC744 \uAE30\uBC18\uC73C\uB85C SEO\uC5D0 \uCD5C\uC801\uD654\uB41C \uC81C\uBAA9 \uC0DD\uC131\n- \uC0C1\uC704 \uB178\uCD9C \uAC00\uB2A5\uD55C \uD0A4\uC6CC\uB4DC \uD3EC\uD568\n- \uD074\uB9AD \uC720\uB3C4\uB825\uC774 \uB192\uC740 \uC81C\uBAA9 \uAD6C\uC870\n- 40-70\uC790 \uB0B4\uC678\uC758 \uC801\uC808\uD55C \uAE38\uC774\n- \uAC80\uC0C9 \uC758\uB3C4\uC5D0 \uB9DE\uB294 \uC81C\uBAA9 \uC791\uC131\n\n\uD83D\uDD12 **\uBC18\uB4DC\uC2DC \uC9C0\uCF1C\uC57C \uD560 \uCD9C\uB825 \uD615\uC2DD:**\n- \uBB34\uC870\uAC74 HTML \uCF54\uB4DC\uBE14\uB7ED\uC73C\uB85C\uB9CC \uCD9C\uB825 (```html \uC0AC\uC6A9)\n- \uB2E4\uB978 \uD615\uC2DD \uC808\uB300 \uAE08\uC9C0\n- 7\uAC1C \uD68C\uCC28\uB97C \uBAA8\uB450 \uD3EC\uD568\uD55C \uC644\uC804\uD55C HTML \uBB38\uC11C\n\n\uD83D\uDCCC **GPTs \uBAA8\uB4DC \uAD6C\uC870 (\uB9AC\uB354\uB0A8 \uC2A4\uD0C0\uC77C):**\n1. **1\uD68C\uCC28**: <h1> SEO \uCD5C\uC801\uD654 \uC81C\uBAA9 \u2192 \uC694\uC57D\uBB38 \u2192 \uBAA9\uCC28 \uBC84\uD2BC 7\uAC1C \u2192 \uBCF8\uBB38 \u2192 CTA\n2. **2\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA\n3. **3\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA\n4. **4\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA\n5. **5\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA\n6. **6\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA\n7. **7\uD68C\uCC28**: \uD68C\uCC28 \uC81C\uBAA9 \u2192 \uBCF8\uBB38 \u2192 CTA \u2192 FAQ \uC139\uC158 \u2192 \uD575\uC2EC\uC694\uC57D\uD45C\n\n\uD83D\uDCCC **\uBAA9\uCC28 \uBC84\uD2BC \uC2A4\uD0C0\uC77C (1\uD68C\uCC28\uC5D0 \uD544\uC218):**\n```html\n<div class=\"table-of-contents\">\n  <button class=\"menu-box-btn\">1\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">2\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">3\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">4\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">5\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">6\uD68C\uCC28</button>\n  <button class=\"menu-box-btn\">7\uD68C\uCC28</button>\n</div>\n```\n\n\uD83D\uDCCC **\uC2A4\uD0C0\uC77C \uAC00\uC774\uB4DC:**\n- \uAC01 \uD68C\uCC28 \uCEE8\uD14C\uC774\uB108: `<div class=\"section-card\">` (CSS \uD074\uB798\uC2A4 \uC0AC\uC6A9)\n- \uD3F0\uD2B8: `'Pretendard', 'Noto Sans KR', sans-serif`\n- \uBCF8\uBB38 \uD06C\uAE30: `20px`, \uC904\uAC04\uACA9: `1.8`\n- H1: \uCD5C\uC18C 32px, H2: \uCD5C\uC18C 28px, H3: \uCD5C\uC18C 24px\n- \uC81C\uBAA9\uC5D0 \uC774\uBAA8\uC9C0 \uCD94\uAC00 (`1\uFE0F\u20E3`, `\uD83D\uDCCC` \uB4F1)\n\n\uD83D\uDCCC **\uD06C\uB864\uB9C1 \uAE30\uBC18 \uCF58\uD150\uCE20 \uC0DD\uC131:**\n- \uD06C\uB864\uB9C1\uD55C \uC18C\uC81C\uBAA9\uC744 \uAE30\uBC18\uC73C\uB85C \uAC80\uC0C9 \uC21C\uC704\uBCC4 \uC18C\uC81C\uBAA9 \uC0DD\uC131\n- \uC0AC\uB78C\uB4E4\uC774 \uAC00\uC7A5 \uB9CE\uC774 \uAC80\uC0C9\uD558\uB294 \uD0A4\uC6CC\uB4DC \uC21C\uC704\uBCC4\uB85C \uC18C\uC81C\uBAA9 \uAD6C\uC131\n- \uC791\uC740 \uC18C\uC81C\uBAA9\uC740 \uBA54\uC778 \uC18C\uC81C\uBAA9 \uAE30\uBC18\uC73C\uB85C \uAC80\uC0C9\uB7C9 \uB192\uC740 \uB0B4\uC6A9\uC73C\uB85C AI \uC0DD\uC131\n- \uD06C\uB864\uB9C1\uD55C \uBCF8\uBB38\uC744 \uCD94\uCD9C\uD558\uC5EC \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uB0B4\uC6A9\uC73C\uB85C \uC7AC\uC791\uC131\n- \uC911\uBCF5 \uBB38\uC11C\uB098 \uC720\uC0AC \uBB38\uC11C\uC5D0 \uAC78\uB9AC\uC9C0 \uC54A\uB3C4\uB85D \uB3C5\uCC3D\uC801 \uB0B4\uC6A9 \uC791\uC131\n\n\uD83D\uDCCC **\uCF58\uD150\uCE20 \uC694\uAD6C\uC0AC\uD56D:**\n- \uD575\uC2EC \uD0A4\uC6CC\uB4DC \uCD5C\uC18C 30\uD68C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uBC18\uBCF5\n- E-E-A-T \uC6D0\uCE59 \uAE30\uBC18 \uC2E0\uB8B0\uB3C4 \uC788\uB294 \uC815\uBCF4\n- \uB3C5\uCC3D\uC801\uC774\uACE0 \uCC28\uBCC4\uD654\uB41C \uC811\uADFC\uBC95\n- \uC2E4\uC6A9\uC801\uC774\uACE0 \uAD6C\uCCB4\uC801\uC778 \uC815\uBCF4 \uC81C\uACF5\n- FAQ \uC139\uC158\uC5D0\uB294 \u2753 \uC774\uBAA8\uC9C0 \uD3EC\uD568 (10\uAC1C \uD56D\uBAA9 \uC81C\uD55C)\n- \uB9AC\uB354\uB0A8 \uC2A4\uD0C0\uC77C\uC758 \uCE5C\uADFC\uD558\uACE0 \uC2E4\uC6A9\uC801\uC778 \uD1A4\n- \"\uC65C\"\uBCF4\uB2E4\uB294 \"\uC5B4\uB5BB\uAC8C\"\uC5D0 60% \uBE44\uC911\uC744 \uB454 \uC2E4\uC6A9\uC801 \uC815\uBCF4\n\n\uD83D\uDCCC **CTA \uBC0F \uC678\uBD80\uB9C1\uD06C \uC0DD\uC131:**\n- \uD06C\uB864\uB9C1\uC744 \uAE30\uBC18\uC73C\uB85C CTA \uC0DD\uC131\n- \uC218\uB3D9 CTA \uC678 \uBC18\uB4DC\uC2DC \uC678\uBD80\uB9C1\uD06C \uB3D9\uC801 \uC0DD\uC131\n- \uD6C4\uD0B9 \uBA58\uD2B8\uC640 \uD568\uAED8 CENTER \uC815\uB82C\uB85C \uBC30\uCE58\n- `<div class=\"cta-container\">` \uCEE8\uD14C\uC774\uB108 \uC0AC\uC6A9\n- `.onnuri-btn` \uD074\uB798\uC2A4 \uC801\uC6A9\n- `target=\"_blank\"` \uC18D\uC131 \uC0AC\uC6A9 \uAE08\uC9C0\n- \uD074\uB9AD \uC720\uB3C4\uB825\uC774 \uB192\uC740 \uD6C4\uD0B9 \uBA58\uD2B8 \uD3EC\uD568\n\n\uD83D\uDCCC **\uD575\uC2EC\uC694\uC57D\uD45C (7\uD68C\uCC28 \uB9C8\uC9C0\uB9C9):**\n- 4x4 \uB610\uB294 5x5 \uD14C\uC774\uBE14 \uAD6C\uC870\uB85C \uB3D9\uC801 \uC0DD\uC131\n- \uD575\uC2EC \uB0B4\uC6A9\uC744 \uC9E7\uACE0 \uC815\uD655\uD558\uAC8C \uC694\uC57D\n- \uC0C1\uD669\uC5D0 \uB9DE\uB294 \uAD00\uB828 \uB9C1\uD06C \uD3EC\uD568\n- \uBCF8\uBB38\uC758 \uD575\uC2EC \uB0B4\uC6A9\uC744 \uC815\uD655\uD558\uAC8C \uBC18\uC601\n- \uB3C5\uC790\uAC00 \uBE60\uB974\uAC8C \uD30C\uC545\uD560 \uC218 \uC788\uB294 \uAD6C\uC870\n\n\uD83D\uDCCC **\uB3D9\uC801 \uCF58\uD150\uCE20 \uC0DD\uC131:**\n- \uC0C1\uD669\uC5D0 \uB9DE\uAC8C \uADF8\uB798\uD504, \uCCB4\uD06C\uB9AC\uC2A4\uD2B8, \uD45C\uB97C \uB3D9\uC801\uC73C\uB85C \uC0DD\uC131\n- \uAC01 \uC139\uC158\uC758 \uB0B4\uC6A9\uC5D0 \uB530\uB77C \uC801\uC808\uD55C \uC2DC\uAC01\uC801 \uC694\uC18C \uD3EC\uD568\n- \uCCB4\uD06C\uB9AC\uC2A4\uD2B8: \uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\uB098 \uD655\uC778\uC0AC\uD56D\n- \uD45C: \uBE44\uAD50 \uC815\uBCF4\uB098 \uC815\uB9AC\uB41C \uB370\uC774\uD130\n- \uADF8\uB798\uD504: \uC9C4\uD589\uB960\uC774\uB098 \uB2E8\uACC4\uBCC4 \uACFC\uC815\n\n\uD83D\uDCCC **\uD3F0\uD2B8 \uD06C\uAE30 \uBC0F \uBB38\uB2E8 \uAD6C\uC870:**\n- \uBCF8\uBB38 \uD14D\uC2A4\uD2B8: \uCD5C\uC18C 20px (\uC5B4\uB974\uC2E0\uB4E4\uB3C4 \uC798 \uC77D\uC744 \uC218 \uC788\uB294 \uD06C\uAE30)\n- H1: \uCD5C\uC18C 32px, H2: \uCD5C\uC18C 28px, H3: \uCD5C\uC18C 24px\n- 3-4\uBB38\uB2E8\uC73C\uB85C \uB098\uB204\uC5B4 \uAC00\uB3C5\uC131 \uADF9\uB300\uD654\n- \uAC01 \uBB38\uB2E8\uC740 \uBA85\uD655\uD55C \uC8FC\uC81C\uB97C \uAC00\uC838\uC57C \uD568\n- \uC904\uAC04\uACA9 1.8\uB85C \uC124\uC815\uD558\uC5EC \uC77D\uAE30 \uD3B8\uD558\uAC8C \uAD6C\uC131\n\n**\uC9C0\uAE08 \uBC14\uB85C \uB9AC\uB354\uB0A8 \uC2A4\uD0C0\uC77C\uC758 \uC804\uCCB4 7\uD68C\uCC28 HTML \uCF58\uD150\uCE20\uB97C \uD55C \uBC88\uC5D0 \uC0DD\uC131\uD574\uC8FC\uC138\uC694!**").trim();
                    genAI = new generative_ai_1.GoogleGenerativeAI(payload.geminiKey || '');
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, 'GPTs 모드')];
                case 2:
                    modelInfo = _a.sent();
                    model = genAI.getGenerativeModel({
                        model: modelInfo.modelName,
                        systemInstruction: fullPrompt,
                    });
                    return [4 /*yield*/, safeGenerateContent(model, fullPrompt, { maxOutputTokens: 25000 }, 'GPTs 모드', genAI)];
                case 3:
                    fullContent = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] GPTs 모드 7회차 콘텐츠 생성 완료');
                    return [2 /*return*/, stripToFragment(fullContent)];
                case 4:
                    error_4 = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u274C GPTs \uBAA8\uB4DC \uC0DD\uC131 \uC624\uB958: ".concat(error_4));
                    throw error_4;
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────
// 커스텀 모드 글 생성 함수 (기본 Gemini 프롬프트)
// ─────────────────────────────────────────────────────────────
function generateCustomModeArticle(payload, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        // 강화된 안전한 문자열 처리 함수
        function sanitizeString(str) {
            if (typeof str !== 'string') {
                if (str === null || str === undefined)
                    return '';
                return String(str);
            }
            return str
                .replace(/[\uD800-\uDFFF]/g, '') // 유효하지 않은 유니코드 서로게이트 쌍 제거
                .replace(/\0/g, '') // null 바이트 제거
                .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // 제어 문자 제거
                .replace(/[^\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s.,!?()[\]{}"'`~@#$%^&*+=|\\:;<>\/_-]/g, '') // 한국어, 영어, 숫자, 기본 특수문자만 허용
                .trim();
        }
        var safeTopic, safeKeywords, minChars, customPrompt, genAI, modelInfo, model, content, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safeTopic = sanitizeString(payload.topic);
                    safeKeywords = Array.isArray(payload.keywords)
                        ? payload.keywords.map(function (k) { return sanitizeString(k); }).join(', ')
                        : sanitizeString(payload.keywords);
                    minChars = Math.max(payload.minChars || 6000, 1500);
                    onLog === null || onLog === void 0 ? void 0 : onLog("[PROGRESS] \uCEE4\uC2A4\uD140 \uBAA8\uB4DC\uB85C \uCF58\uD150\uCE20 \uC0DD\uC131 \uC2DC\uC791 (".concat(minChars, "\uC790 \uBAA9\uD45C)"));
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    customPrompt = "\n\uB2F9\uC2E0\uC740 \uC804\uBB38 \uBE14\uB85C\uADF8 \uC791\uAC00\uC785\uB2C8\uB2E4. \uB2E4\uC74C \uC8FC\uC81C\uC5D0 \uB300\uD574 \uACE0\uD488\uC9C8\uC758 \uBE14\uB85C\uADF8 \uD3EC\uC2A4\uD2B8\uB97C \uC791\uC131\uD574\uC8FC\uC138\uC694.\n\n\uC8FC\uC81C: ".concat(safeTopic, "\n\uD0A4\uC6CC\uB4DC: ").concat(safeKeywords, "\n\uCD5C\uC18C \uAE00\uC790 \uC218: ").concat(minChars, "\uC790 \uC774\uC0C1\n\n\uC694\uAD6C\uC0AC\uD56D:\n- SEO \uCD5C\uC801\uD654\uB41C \uC81C\uBAA9\uACFC \uB0B4\uC6A9\n- \uB3C5\uC790\uC5D0\uAC8C \uC720\uC6A9\uD55C \uC815\uBCF4 \uC81C\uACF5\n- \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD0A4\uC6CC\uB4DC \uBC30\uCE58\n- HTML \uD615\uC2DD\uC73C\uB85C \uCD9C\uB825\n- \uAD6C\uC870\uD654\uB41C \uB0B4\uC6A9 (\uC81C\uBAA9, \uC18C\uC81C\uBAA9, \uBCF8\uBB38, \uACB0\uB860)\n\nHTML \uD615\uC2DD\uC73C\uB85C \uC791\uC131\uD574\uC8FC\uC138\uC694.");
                    genAI = new generative_ai_1.GoogleGenerativeAI(payload.geminiKey || '');
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, '커스텀 모드')];
                case 2:
                    modelInfo = _a.sent();
                    model = genAI.getGenerativeModel({
                        model: modelInfo.modelName,
                    });
                    return [4 /*yield*/, safeGenerateContent(model, customPrompt, { maxOutputTokens: 15000 }, '커스텀 모드', genAI)];
                case 3:
                    content = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 커스텀 모드 콘텐츠 생성 완료');
                    return [2 /*return*/, stripToFragment(content)];
                case 4:
                    error_5 = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u274C \uCEE4\uC2A4\uD140 \uBAA8\uB4DC \uC0DD\uC131 \uC624\uB958: ".concat(error_5));
                    throw error_5;
                case 5: return [2 /*return*/];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────
// MAX 모드 글 생성 함수 (기존 5개 섹션 구조)
// ─────────────────────────────────────────────────────────────
var environment_manager_1 = require("../utils/environment-manager");
// 환경변수 관리자 초기화
var envManager = environment_manager_1.EnvironmentManager.getInstance();
function generateMaxModeArticle(payload, env, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        // await diagnoseSystem();
        // 강화된 안전한 문자열 처리 함수 (메모리 최적화)
        function sanitizeString(str) {
            if (typeof str !== 'string') {
                if (str === null || str === undefined)
                    return '';
                return String(str);
            }
            // 메모리 효율적인 정리 (단계별 처리)
            var result = str.trim();
            // 1단계: 기본 정리
            if (result.length === 0)
                return '';
            // 2단계: 위험한 문자만 제거 (정규식 최소화)
            result = result
                .replace(/[\uD800-\uDFFF]/g, '') // 유효하지 않은 유니코드 서로게이트 쌍 제거
                .replace(/\0/g, '') // null 바이트 제거
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ''); // 제어 문자 제거 (공백, 탭, 줄바꿈 제외)
            // 3단계: 길이 제한 (메모리 보호)
            if (result.length > 10000) {
                result = result.substring(0, 10000) + '...';
            }
            return result;
        }
        // 해시태그 자동 생성 (현재 사용하지 않음)
        // const generateHashtags = (topic: string, keywords: string[], subtopics: string[]): string[] => { ... };
        /**
         * 크롤링 기반 SEO 최적화된 제목 생성
         */
        function generateSEOTitle(topic_1, keywords_1, _provider_1, _openaiKey_1, geminiKey_1) {
            return __awaiter(this, arguments, void 0, function (topic, keywords, _provider, // Gemini만 사용
                _openaiKey, // OpenAI 사용하지 않음
                geminiKey, crawledContents, targetYear) {
                var now, currentYear, currentMonth, topicLower, keywordsLower, hasPreview, currentDateStr, fallbackTitle, prompt_2, GoogleGenerativeAI_3, genAI_1, modelInfo_1, model_1, text, extractedTitle, boringPatterns, _i, boringPatterns_1, _a, pattern, replacement, firstTitleMatch, lines, extractedLines, firstLine, titleMatch, words, error_11, now, currentYear, currentMonth, currentDateStr;
                if (crawledContents === void 0) { crawledContents = []; }
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            _b.trys.push([0, 4, , 5]);
                            now = new Date();
                            currentYear = now.getFullYear();
                            currentMonth = now.getMonth() + 1;
                            topicLower = safeTopic.toLowerCase();
                            keywordsLower = keywordArray.map(function (k) { return k.toLowerCase(); }).join(' ');
                            hasPreview = topicLower.includes('미리보기') || keywordsLower.includes('미리보기');
                            if (hasPreview) {
                                // 연말(11-12월): 다음 년도 기준
                                if (currentMonth >= 11) {
                                    currentYear = currentYear + 1;
                                }
                                // 연초(1-3월): 발행날짜 기준 (현재 년도 유지)
                                else if (currentMonth <= 3) {
                                    // currentYear는 그대로 유지
                                }
                                // 중간(4-10월): 연말이 가까우면 다음 년도, 아니면 현재 년도
                                else {
                                    // 10월이면 다음 년도, 그 외는 현재 년도
                                    if (currentMonth >= 10) {
                                        currentYear = currentYear + 1;
                                    }
                                    // 4-9월은 현재 년도 유지 (다음 년도 미리보기는 아직 이르므로)
                                }
                            }
                            if (targetYear && Math.abs(targetYear - currentYear) <= 5) {
                                currentYear = targetYear;
                            }
                            currentDateStr = "".concat(currentYear, "\uB144 ").concat(currentMonth, "\uC6D4");
                            if (!geminiKey) {
                                fallbackTitle = "".concat(topic, " ").concat(currentYear, "\uB144 \uCD5C\uC2E0 \uC804\uB7B5 - ").concat(currentMonth, "\uC6D4 \uC5C5\uB370\uC774\uD2B8");
                                return [2 /*return*/, fallbackTitle === topic ? "".concat(topic, " ").concat(currentYear, "\uB144 \uC804\uB7B5 \uCD1D\uC815\uB9AC") : fallbackTitle];
                            }
                            prompt_2 = "\n\uB2E4\uC74C \uC8FC\uC81C\uC640 \uD0A4\uC6CC\uB4DC\uB97C \uBC14\uD0D5\uC73C\uB85C SEO\uC5D0 \uCD5C\uC801\uD654\uB418\uACE0 \uD074\uB9AD\uC744 \uC720\uBC1C\uD558\uB294 \uC81C\uBAA9\uC744 \uC0DD\uC131\uD574\uC8FC\uC138\uC694.\n\n\uC8FC\uC81C: ".concat(topic, "\n\uD0A4\uC6CC\uB4DC: ").concat(keywords.join(', '), "\n\uD604\uC7AC \uB0A0\uC9DC: ").concat(currentDateStr, " (\uD3EC\uC2A4\uD305 \uBC1C\uD589 \uAE30\uC900 \uB0A0\uC9DC)\n").concat(targetYear ? "\uD0C0\uAE43 \uC5F0\uB3C4: ".concat(targetYear, "\uB144 (\uC81C\uBAA9\uC5D0\uC11C\uB3C4 ").concat(targetYear, "\uB144 \uAE30\uC900\uC744 \uAC15\uC870)") : '', "\n\n").concat(crawledContents.length > 0 ? "\n\u3010\uD06C\uB864\uB9C1\uB41C \uC2E4\uC81C \uC81C\uBAA9\uB4E4 (SEO \uBD84\uC11D\uC6A9)\u3011\n".concat(crawledContents.slice(0, 10).map(function (content) { return "- ".concat(content.title); }).join('\n'), "\n\n\u26A0\uFE0F **\uC911\uC694**: \uC704 \uD06C\uB864\uB9C1\uB41C \uC81C\uBAA9\uB4E4\uC744 \uBD84\uC11D\uD558\uC5EC \uD074\uB9AD\uB960\uC774 \uB192\uC740 \uD328\uD134\uC744 \uD30C\uC545\uD558\uB418, \uC808\uB300 \uBCF5\uC0AC\uD558\uC9C0 \uB9D0\uACE0 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC81C\uBAA9\uC744 \uC0DD\uC131\uD558\uC138\uC694!\n") : '', "\n\n\uD83D\uDCCC **SEO \uCD5C\uC801\uD654 \uC81C\uBAA9 \uC0DD\uC131 \uC694\uAD6C\uC0AC\uD56D (\uB9E4\uC6B0 \uC911\uC694):**\n- \uD06C\uB864\uB9C1\uD55C \uC81C\uBAA9\uC744 \uBD84\uC11D\uD558\uC5EC \uD074\uB9AD\uB960\uC774 \uB192\uC740 \uD328\uD134 \uD30C\uC545 \uD6C4 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC81C\uBAA9 \uC0DD\uC131\n- **\uD575\uC2EC \uD0A4\uC6CC\uB4DC\uB97C \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568** (\uAC80\uC0C9 \uC5D4\uC9C4 \uCD5C\uC801\uD654)\n- **\uD074\uB9AD\uB960\uC774 \uB192\uC740 \uAC15\uB825\uD55C \uC81C\uBAA9** \uC0DD\uC131 (\uB178\uCD9C \u2192 \uD074\uB9AD \uC804\uD658 \uCD5C\uB300\uD654)\n- \uAC19\uC740 \uD0A4\uC6CC\uB4DC\uB85C \uC0DD\uC131\uD574\uB3C4 \uB9E4\uBC88 \uB2E4\uB974\uAC8C \uB098\uC640\uC57C \uD568\n- \uC911\uBCF5 \uBB38\uC11C\uB098 \uC720\uC0AC \uBB38\uC11C\uC5D0 \uAC78\uB9AC\uC9C0 \uC54A\uB3C4\uB85D \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC81C\uBAA9\n\n\uD83D\uDD25 **\uD074\uB9AD\uB960 \uD3ED\uBC1C \uC81C\uBAA9 \uD328\uD134 (\uBC18\uB4DC\uC2DC \uD65C\uC6A9):**\n1. **\uC22B\uC790 + \uAD6C\uCCB4\uC801 \uD61C\uD0DD**: \"TOP 5\", \"3\uBD84 \uB9CC\uC5D0\", \"7\uAC00\uC9C0 \uBC29\uBC95\", \"10\uAC1C \uD301\"\n2. **\uC9C8\uBB38 + \uC989\uC2DC \uD574\uACB0**: \"\uC5B4\uB5BB\uAC8C \uD560\uAE4C?\", \"\uC65C \uC548 \uB420\uAE4C?\", \"\uC5B4\uB514\uC11C \uCC3E\uC744\uAE4C?\"\n3. **\uAE34\uAE09\uC131 + \uB193\uCE58\uBA74 \uC548 \uB418\uB294**: \"\uC9C0\uAE08 \uBC14\uB85C\", \"\uB193\uCE58\uBA74 \uD6C4\uD68C\", \"\uC774\uBC88 \uC8FC\uB9CC\"\n4. **\uBE44\uAD50 + \uCD94\uCC9C**: \"\uBE44\uAD50 \uBD84\uC11D\", \"\uC5B4\uB5A4 \uAC8C \uCD5C\uACE0?\", \"\uCD94\uCC9C TOP 3\"\n5. **\uAC00\uC774\uB4DC + \uB2E8\uACC4**: \"3\uBD84 \uB9CC\uC5D0\", \"\uB2E8\uACC4\uBCC4 \uAC00\uC774\uB4DC\", \"\uCD08\uBCF4\uC790\uB3C4 OK\"\n6. **\uACBD\uD5D8 + \uD6C4\uAE30**: \"\uB098\uB3C4 \uBC1B\uC558\uB2E4\", \"\uC131\uACF5 \uD6C4\uAE30\", \"\uC2E4\uC81C \uACBD\uD5D8\uB2F4\"\n7. **\uC804\uBB38\uAC00 + \uB178\uD558\uC6B0**: \"\uC804\uBB38\uAC00 \uCD94\uCC9C\", \"\uACE0\uC218\uB9CC \uC544\uB294\", \"\uC170\uD504\uAC00 \uC54C\uB824\uC8FC\uB294\"\n\n\uD83D\uDCCA **SEO \uCD5C\uC801\uD654 \uC804\uB7B5:**\n- **\uC8FC\uC694 \uD0A4\uC6CC\uB4DC\uB97C \uC81C\uBAA9 \uC55E\uBD80\uBD84\uC5D0 \uBC30\uCE58** (\uAC80\uC0C9 \uC5D4\uC9C4\uC774 \uC911\uC694\uD558\uAC8C \uC778\uC2DD)\n- **LSI \uD0A4\uC6CC\uB4DC \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uD3EC\uD568** (\uAD00\uB828 \uAC80\uC0C9\uC5B4)\n- **\uAC80\uC0C9 \uC758\uB3C4 \uBC18\uC601** (\uC815\uBCF4\uC131, \uD2B8\uB79C\uC7AD\uC158, \uB124\uBE44\uAC8C\uC774\uC158)\n- **\uBAA8\uBC14\uC77C \uCD5C\uC801\uD654** (15-25\uC790 \uC774\uB0B4\uB85C \uC9E7\uACE0 \uAC15\uB82C\uD558\uAC8C)\n\n\uD83C\uDFAF **\uD074\uB9AD \uC720\uB3C4 \uAC15\uD654 \uC694\uC18C (\uBC18\uB4DC\uC2DC \uD3EC\uD568):**\n- **\uD638\uAE30\uC2EC \uC720\uBC1C**: \"\uBE44\uBC00\", \"\uC228\uACA8\uC9C4\", \"\uBAA8\uB974\uB294\", \"\uC54C\uB824\uC9C0\uC9C0 \uC54A\uC740\"\n- **\uC2E4\uC6A9\uC131 \uAC15\uC870**: \"\uC2E4\uC81C\", \"\uAC80\uC99D\uB41C\", \"\uD6A8\uACFC\uC801\uC778\", \"\uBC14\uB85C \uC801\uC6A9 \uAC00\uB2A5\"\n- **\uAE34\uAE09\uC131/\uD2B9\uBCC4\uD568**: \"\uC9C0\uAE08\", \"\uBC14\uB85C\", \"\uB193\uCE58\uBA74 \uC548 \uB418\uB294\", \"\uD55C\uC815\"\n- **\uAD8C\uC704\uC131/\uC2E0\uB8B0\uC131**: \"\uC804\uBB38\uAC00\", \"\uACF5\uC2DD\", \"\uC778\uC99D\", \"\uAC80\uC99D\"\n- **\uAD6C\uCCB4\uC801 \uD61C\uD0DD**: \"\uD658\uAE09\uAE08\", \"\uC808\uC57D\", \"\uD61C\uD0DD\", \"\uD560\uC778\", \"\uBB34\uB8CC\"\n- **\uAC10\uC815\uC801 \uC5B4\uD544**: \"\uC644\uBCBD\uD55C\", \"\uCD5C\uACE0\uC758\", \"\uD655\uC2E4\uD55C\", \"\uB180\uB77C\uC6B4\"\n\n\u26A0\uFE0F **\uC81C\uBAA9 \uAE38\uC774 \uBC0F \uAD6C\uC870 (\uC911\uC694)**:\n- \uC81C\uBAA9\uC740 **15-25\uC790 \uC774\uB0B4**\uB85C \uC791\uC131 (\uC378\uB124\uC77C \uD14D\uC2A4\uD2B8 \uCD5C\uC801\uD654)\n- **\uD575\uC2EC \uD0A4\uC6CC\uB4DC\uB97C \uC55E\uBD80\uBD84\uC5D0 \uBC30\uCE58** (SEO \uCD5C\uC801\uD654)\n- **\uC22B\uC790\uB098 \uAD6C\uCCB4\uC801 \uD61C\uD0DD \uD3EC\uD568** (\uD074\uB9AD\uB960 \uD5A5\uC0C1)\n- \uB0A0\uC9DC\uB294 \uC0DD\uB7B5 \uAC00\uB2A5\uD558\uC9C0\uB9CC, \"2025\uB144\" \uAC19\uC740 \uCD5C\uC2E0\uC131\uC740 \uD3EC\uD568 \uAC00\uB2A5\n- \uBD88\uD544\uC694\uD55C \uC218\uC2DD\uC5B4\uB294 \uC81C\uAC70\uD558\uB418, \uD074\uB9AD \uC720\uB3C4 \uC694\uC18C\uB294 \uC720\uC9C0\n\n\uD83D\uDEAB **\uAE08\uC9C0 \uD45C\uD604 (\uC808\uB300 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694):**\n- \"\uC644\uBCBD \uAC00\uC774\uB4DC\", \"\uC644\uC804 \uC815\uB9AC\", \"\uCD1D\uC815\uB9AC\", \"\uBAA8\uB4E0 \uAC83\" (\uBED4\uD558\uACE0 \uD074\uB9AD\uB960 \uC800\uC870)\n- \"\uBC29\uBC95\", \"\uD301\", \"\uC815\uBCF4\" \uB2E8\uB3C5 \uC0AC\uC6A9 (\uB108\uBB34 \uC77C\uBC18\uC801)\n- \"\uCD08\uBCF4\uC790\uB97C \uC704\uD55C\", \"\uC774\uB807\uAC8C \uD558\uBA74\" (\uACFC\uB3C4\uD558\uAC8C \uC77C\uBC18\uC801)\n- \uB300\uC2E0 \uAD6C\uCCB4\uC801 \uC22B\uC790, \uC9C8\uBB38, \uAE34\uAE09\uC131, \uACBD\uD5D8, \uC804\uBB38\uC131 \uB4F1\uC744 \uD65C\uC6A9\uD558\uC138\uC694!\n\n\u26A0\uFE0F **\uCD9C\uB825 \uD615\uC2DD (\uB9E4\uC6B0 \uC911\uC694)**:\n- \uBC18\uB4DC\uC2DC **\uB2E8 \uD558\uB098\uC758 \uC81C\uBAA9\uB9CC** \uCD9C\uB825\uD558\uC138\uC694\n- \uC5EC\uB7EC \uC81C\uBAA9\uC744 \uB098\uC5F4\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uC81C\uBAA9\uB9CC \uCD9C\uB825\uD558\uACE0 \uB2E4\uB978 \uC124\uBA85\uC774\uB098 \uBC88\uD638\uB294 \uD3EC\uD568\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uB9C8\uD06C\uB2E4\uC6B4 \uD615\uC2DD(**\uBCFC\uB4DC**)\uC744 \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694\n- \"\uC9C0\uAE08 \uCC38\uC5EC\uD558\uC138\uC694\", \"\uBC14\uB85C \uD655\uC778\uD558\uAE30\" \uAC19\uC740 CTA \uBB38\uAD6C\uB294 \uD3EC\uD568\uD558\uC9C0 \uB9C8\uC138\uC694\n- \uC81C\uBAA9\uC740 **15-25\uC790 \uC774\uB0B4**\uB85C \uC791\uC131\uD558\uC138\uC694 (\uCD5C\uB300\uD55C \uC9E7\uAC8C)\n\n\uD83D\uDCA1 **\uC81C\uBAA9 \uC0DD\uC131 \uC608\uC2DC (\uCC38\uACE0\uC6A9, \uC808\uB300 \uBCF5\uC0AC \uAE08\uC9C0):**\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C TOP 5 \uBC29\uBC95 (2025\uB144 \uCD5C\uC2E0)\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uC5B4\uB5BB\uAC8C \uD560\uAE4C? \uAD81\uAE08\uD55C \uBAA8\uB4E0 \uAC83\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C 3\uBD84 \uB9CC\uC5D0 \uB05D\uB0B4\uAE30 | \uB2E8\uACC4\uBCC4 \uC815\uB9AC\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uBE44\uAD50 \uBD84\uC11D | \uC5B4\uB5A4 \uAC8C \uCD5C\uACE0\uC77C\uAE4C?\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uB193\uCE58\uBA74 \uD6C4\uD68C! \uD575\uC2EC \uB178\uD558\uC6B0 \uACF5\uAC1C\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uB098\uB3C4 \uBC1B\uC558\uB2E4! \uC131\uACF5 \uD6C4\uAE30 \uACF5\uAC1C\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uC804\uBB38\uAC00 \uCD94\uCC9C | \uACE0\uC218\uB9CC \uC544\uB294 \uBE44\uBC95\"\n- \"\uC2F1\uC5B4\uAC8C\uC7784 \uD22C\uD45C \uC9C0\uAE08 \uBC14\uB85C \uD655\uC778! \uC228\uACA8\uC9C4 \uC815\uBCF4\"\n\n\u26A0\uFE0F **\uC911\uC694**: \uC704 \uC608\uC2DC\uB294 \uCC38\uACE0\uC6A9\uC785\uB2C8\uB2E4. \uC808\uB300 \uBCF5\uC0AC\uD558\uC9C0 \uB9D0\uACE0 \uC644\uC804\uD788 \uC0C8\uB85C\uC6B4 \uC81C\uBAA9\uC744 \uC0DD\uC131\uD558\uC138\uC694!\n\n\uD83D\uDEAB **\uC808\uB300 \uD53C\uD574\uC57C \uD560 \uBED4\uD55C \uD45C\uD604 (\uD074\uB9AD\uB960 \uC800\uC870):**\n- \"\uC644\uBCBD \uAC00\uC774\uB4DC\", \"\uC644\uC804 \uC815\uB9AC\", \"\uCD1D\uC815\uB9AC\" (\uB108\uBB34 \uBED4\uD568)\n- \"\uBC29\uBC95\", \"\uD301\", \"\uC815\uBCF4\" (\uC77C\uBC18\uC801 \uB2E8\uC5B4)\n- \"\uAD81\uAE08\uD55C \uBAA8\uB4E0 \uAC83\", \"\uBAA8\uB4E0 \uAC83\" (\uACFC\uB3C4\uD558\uAC8C \uD3EC\uAD04\uC801)\n- \"\uCD08\uBCF4\uC790\uB97C \uC704\uD55C\" (\uB108\uBB34 \uC77C\uBC18\uC801)\n\n\u2705 **\uB300\uC2E0 \uC0AC\uC6A9\uD560 \uAC15\uB825\uD55C \uD45C\uD604:**\n- \"TOP 5\", \"3\uBD84 \uB9CC\uC5D0\", \"7\uAC00\uC9C0 \uBC29\uBC95\" (\uAD6C\uCCB4\uC801 \uC22B\uC790)\n- \"\uC5B4\uB5BB\uAC8C \uD560\uAE4C?\", \"\uC65C \uC548 \uB420\uAE4C?\" (\uC9C8\uBB38 \uD615\uC2DD)\n- \"\uC9C0\uAE08 \uBC14\uB85C\", \"\uB193\uCE58\uBA74 \uD6C4\uD68C\" (\uAE34\uAE09\uC131)\n- \"\uB098\uB3C4 \uBC1B\uC558\uB2E4\", \"\uC131\uACF5 \uD6C4\uAE30\" (\uACBD\uD5D8 \uACF5\uC720)\n- \"\uC804\uBB38\uAC00 \uCD94\uCC9C\", \"\uACE0\uC218\uB9CC \uC544\uB294\" (\uAD8C\uC704\uC131)\n\n\uC81C\uBAA9\uB9CC \uCD9C\uB825\uD574\uC8FC\uC138\uC694 (\uC124\uBA85\uC774\uB098 \uBD80\uAC00 \uC124\uBA85, CTA \uBB38\uAD6C \uC5C6\uC774).\n");
                            return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/generative-ai'); })];
                        case 1:
                            GoogleGenerativeAI_3 = (_b.sent()).GoogleGenerativeAI;
                            genAI_1 = new GoogleGenerativeAI_3(geminiKey);
                            return [4 /*yield*/, getAvailableGeminiModel(genAI_1, 'SEO 제목 생성')];
                        case 2:
                            modelInfo_1 = _b.sent();
                            model_1 = modelInfo_1.model;
                            return [4 /*yield*/, safeGenerateContent(model_1, prompt_2, { maxOutputTokens: 5000 }, '제목 생성', genAI_1)];
                        case 3:
                            text = _b.sent();
                            extractedTitle = text.trim();
                            // 🔧 불필요한 문구 제거 (CTA, 설명 등)
                            extractedTitle = extractedTitle
                                .replace(/지금\s*참여하세요/gi, '')
                                .replace(/바로\s*확인하기/gi, '')
                                .replace(/지금\s*바로/gi, '')
                                .replace(/지금\s*시작하세요/gi, '')
                                .replace(/바로\s*시작하세요/gi, '')
                                .replace(/,\s*지금\s*참여하세요/gi, '')
                                .replace(/,\s*바로\s*확인하기/gi, '')
                                .replace(/,\s*지금\s*바로/gi, '')
                                .trim();
                            boringPatterns = [
                                { pattern: /완벽\s*가이드/gi, replacement: '' },
                                { pattern: /완전\s*정리/gi, replacement: '' },
                                { pattern: /총정리/gi, replacement: '' },
                                { pattern: /모든\s*것/gi, replacement: '' },
                                { pattern: /,\s*완벽\s*가이드/gi, replacement: '' },
                                { pattern: /,\s*완전\s*정리/gi, replacement: '' },
                                { pattern: /\s*완벽\s*가이드$/gi, replacement: '' },
                                { pattern: /\s*완전\s*정리$/gi, replacement: '' },
                            ];
                            for (_i = 0, boringPatterns_1 = boringPatterns; _i < boringPatterns_1.length; _i++) {
                                _a = boringPatterns_1[_i], pattern = _a.pattern, replacement = _a.replacement;
                                extractedTitle = extractedTitle.replace(pattern, replacement);
                            }
                            extractedTitle = extractedTitle.trim();
                            // 여러 제목이 있는 경우 (예: "* **제목1** * **제목2**" 형태)
                            if (extractedTitle.includes('* **') && extractedTitle.split('* **').length > 2) {
                                firstTitleMatch = extractedTitle.match(/\*\s*\*\*([^*]+)\*\*/);
                                if (firstTitleMatch && firstTitleMatch[1]) {
                                    extractedTitle = firstTitleMatch[1].trim();
                                }
                                else {
                                    lines = extractedTitle.split('\n').filter(function (line) { return line.trim().length > 0; });
                                    if (lines.length > 0 && lines[0]) {
                                        extractedTitle = lines[0].trim();
                                    }
                                }
                            }
                            // 마크다운 제거
                            extractedTitle = extractedTitle
                                .replace(/^\*\s*\*\*|\*\*$/g, '')
                                .replace(/^\*\s*|\s*\*$/g, '')
                                .replace(/\*\*/g, '')
                                .replace(/^\*|\*$/g, '')
                                .trim();
                            extractedLines = extractedTitle.split('\n').filter(function (line) { return line.trim().length > 0; });
                            if (extractedLines.length > 0 && extractedLines[0]) {
                                firstLine = extractedLines[0].trim();
                                titleMatch = firstLine.match(/^[^,\.!?]+/);
                                if (titleMatch && titleMatch[0]) {
                                    extractedTitle = titleMatch[0].trim();
                                }
                                else if (firstLine.length > 0) {
                                    extractedTitle = firstLine;
                                }
                            }
                            // 번호 제거 (예: "1. 제목" -> "제목")
                            extractedTitle = extractedTitle.replace(/^\d+\.\s*/, '').trim();
                            // 🔧 제목 길이 제한 (25자로 더 짧게)
                            if (extractedTitle.length > 25) {
                                words = extractedTitle.substring(0, 25).split(/\s+/);
                                if (words.length > 1) {
                                    words.pop(); // 마지막 단어 제거
                                    extractedTitle = words.join(' ').trim();
                                }
                                else {
                                    extractedTitle = extractedTitle.substring(0, 22) + '...';
                                }
                            }
                            // 🔧 최종 검증: 제목이 비어있거나 너무 짧으면 폴백
                            if (extractedTitle.length < 3) {
                                extractedTitle = topic;
                            }
                            return [2 /*return*/, extractedTitle.length > 0 ? extractedTitle : "".concat(topic, " \uC644\uBCBD \uAC00\uC774\uB4DC - ").concat(currentDateStr, " \uCD5C\uC2E0 \uC815\uBCF4")];
                        case 4:
                            error_11 = _b.sent();
                            console.error('[SEO TITLE] 제목 생성 실패:', error_11);
                            now = new Date();
                            currentYear = now.getFullYear();
                            currentMonth = now.getMonth() + 1;
                            currentDateStr = "".concat(currentYear, "\uB144 ").concat(currentMonth, "\uC6D4");
                            return [2 /*return*/, "".concat(topic, " \uC644\uBCBD \uAC00\uC774\uB4DC - ").concat(currentDateStr, " \uCD5C\uC2E0 \uC815\uBCF4")];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        }
        var safeTopic, safeKeywords, provider, geminiKey, _a, contentMode, _b, manualCtas, googleCseKey, googleCseCx, h2Images, thumbnailMode, sectionImageMode, openaiKey, keywordArray, baseKeywords, relatedKeywords, yearMatch, words, getSectionsForMode, sectionConfigs, contentType, envConfig, e_1, loadEnvFromFile, envData, fallbackError_2, mergedPayload, apiKeyStatus, apiKeySummary, validKeys, GoogleGenerativeAI, finalGeminiKey, genAI, modelInfo, model, detectedTargetYear, crawledContents, crawledCTAs, crawledTitles, titlePrompt, titleRaw, title, firstTitleMatch, lines, titleLines, firstLine, optimalSubtopic, subtopicOptions, error_6, thumbnailUrl, seoTitle, crawlOptions, canCrawl, _c, seoTitleResult, crawlResult, yearForTitle, _d, getValidNaverLinks, getValidLinksForMultipleKeywords, searchKeywords, validLinks, additionalLinks, seenUrls, _i, additionalLinks_1, link, naverCTAs_1, error_7, filterOfficialCTAs, originalCtaCount, improvedSeoTitle, error_8, finalThumbnailMode, makeSmartThumbnail, pexelsOptions, cseOptions, dalleOptions, thumbResult, thumbnailHtml, thumbnailHtml, error_9, sections, sectionPromises, sectionSettled, sectionResults, h2ImagePromises, h2ImagesObj_1, h2ImageResults, _e, h2ImageMap, seenSubtitles, seenContent, deduplicatedSections, i, sectionContent, h2Matches, _f, h2Matches_1, h2Match, h2Text, textContent, isDuplicate, _g, seenContent_1, seenText, similarity, i, sectionTitle, subtopic, shouldGenerateInspectionReport, inspectionReport, error_10, isWordPress, isAdsenseMode, articleClass, contentClass, finalTitle, tableOfContents, coreSummaryTable, thumbnailContainer, contentHtml, generateDisclaimer, disclaimerHtml, cloudSkinCSS, premiumGradientCSS, adsenseCleanCSS, selectedCSS, fullHtml;
        var _this = this;
        var _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    // 시스템 진단 실행 (임시로 비활성화)
                    console.log('🔍 시스템 진단 시작...');
                    safeTopic = sanitizeString(payload.topic);
                    safeKeywords = Array.isArray(payload.keywords)
                        ? payload.keywords.map(sanitizeString).filter(Boolean)
                        : sanitizeString(payload.keywords).split(',').map(function (k) { return sanitizeString(k); }).filter(Boolean);
                    provider = 'gemini';
                    geminiKey = payload.geminiKey, _a = payload.contentMode, contentMode = _a === void 0 ? 'external' : _a, _b = payload.manualCtas, manualCtas = _b === void 0 ? {} : _b, googleCseKey = payload.googleCseKey, googleCseCx = payload.googleCseCx, h2Images = payload.h2Images, thumbnailMode = payload.thumbnailMode, sectionImageMode = payload.sectionImageMode;
                    openaiKey = undefined;
                    console.log("\uD83D\uDCDD \uC8FC\uC81C: ".concat(safeTopic, " | \uBAA8\uB4DC: ").concat(contentMode));
                    keywordArray = [];
                    if (safeKeywords && safeKeywords.length > 0) {
                        keywordArray = safeKeywords;
                        console.log("\uD83D\uDD11 \uC0AC\uC6A9\uC790 \uC785\uB825 \uD0A4\uC6CC\uB4DC: ".concat(keywordArray.join(', ')));
                    }
                    else {
                        // 주제에서 자동 키워드 추출
                        console.log('🔍 주제에서 키워드 자동 추출 중...');
                        baseKeywords = [safeTopic];
                        relatedKeywords = [];
                        yearMatch = safeTopic.match(/(\d{4})/);
                        if (yearMatch && yearMatch[1]) {
                            relatedKeywords.push(yearMatch[1], "".concat(yearMatch[1], "\uB144"));
                        }
                        words = safeTopic.split(/[\s,]+/).filter(function (word) { return word.length > 1; });
                        relatedKeywords.push.apply(relatedKeywords, words);
                        // 중복 제거 및 정제
                        keywordArray = __spreadArray(__spreadArray([], baseKeywords, true), relatedKeywords, true).map(function (k) { return k.trim(); })
                            .filter(function (k) { return k.length > 0; })
                            .filter(function (k, i, arr) { return arr.indexOf(k) === i; }) // 중복 제거
                            .slice(0, 10); // 최대 10개로 제한
                        console.log("\uD83D\uDD0D \uCD94\uCD9C\uB41C \uD0A4\uC6CC\uB4DC: ".concat(keywordArray.join(', ')));
                    }
                    getSectionsForMode = function (mode) {
                        var sections = max_mode_structure_1.CONTENT_MODE_SECTIONS_MAP[mode];
                        if (sections) {
                            return sections;
                        }
                        // 기본값은 SEO 최적화 모드 (기존 맥스 모드)
                        return max_mode_structure_1.MAX_MODE_SECTIONS;
                    };
                    sectionConfigs = getSectionsForMode(env.contentMode || 'external');
                    contentType = env.contentMode === 'spiderwebbing' ? '일관성/거미줄치기 전문' :
                        env.contentMode === 'adsense' ? '애드센스 승인 전문' :
                            env.contentMode === 'paraphrasing' ? '페러프레이징 전문' :
                                env.contentMode === 'internal' ? '내부 링크 최적화' :
                                    env.contentMode === 'shopping' ? '쇼핑/구매유도 모드' : 'SEO 최적화';
                    console.log("\uD83D\uDCCB \uCF58\uD150\uCE20 \uD0C0\uC785: ".concat(contentType, " | \uC139\uC158 \uC218: ").concat(sectionConfigs.length, "\uAC1C"));
                    // API 키 상태 확인 (환경변수 포함)
                    console.log('🔑 API 키 상태 확인 중...');
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 0% - 시스템 초기화 중');
                    envConfig = null;
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 2, , 7]);
                    envConfig = envManager.getConfig();
                    return [3 /*break*/, 7];
                case 2:
                    e_1 = _j.sent();
                    console.warn('[ENV] envManager.getConfig() 실패, fallback으로 loadEnvFromFile() 시도:', e_1);
                    _j.label = 3;
                case 3:
                    _j.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../env'); })];
                case 4:
                    loadEnvFromFile = (_j.sent()).loadEnvFromFile;
                    envData = loadEnvFromFile();
                    envConfig = {
                        openaiApiKey: envData['openaiKey'] || '',
                        geminiApiKey: envData['geminiKey'] || '',
                        naverClientId: envData['naverClientId'] || '',
                        naverClientSecret: envData['naverClientSecret'] || '',
                        googleApiKey: envData['googleCseKey'] || '',
                        googleCseId: envData['googleCseCx'] || ''
                    };
                    return [3 /*break*/, 6];
                case 5:
                    fallbackError_2 = _j.sent();
                    console.warn('[ENV] loadEnvFromFile() fallback도 실패, 빈 객체 사용:', fallbackError_2);
                    envConfig = {
                        openaiApiKey: '',
                        geminiApiKey: '',
                        naverClientId: '',
                        naverClientSecret: '',
                        googleApiKey: '',
                        googleCseId: ''
                    };
                    return [3 /*break*/, 6];
                case 6: return [3 /*break*/, 7];
                case 7:
                    mergedPayload = __assign(__assign({}, payload), { openaiKey: payload.openaiKey || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.openaiApiKey) || '', geminiKey: payload.geminiKey || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.geminiApiKey) || '', naverClientId: payload.naverClientId || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.naverClientId) || '', naverClientSecret: payload.naverClientSecret || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.naverClientSecret) || '', googleCseKey: payload.googleCseKey || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.googleApiKey) || '', googleCseCx: payload.googleCseCx || (envConfig === null || envConfig === void 0 ? void 0 : envConfig.googleCseId) || '' });
                    return [4 /*yield*/, (0, api_key_checker_1.checkApiKeys)(mergedPayload)];
                case 8:
                    apiKeyStatus = _j.sent();
                    apiKeySummary = (0, api_key_checker_1.getApiKeySummary)(apiKeyStatus);
                    console.log('📊 API 키 상태 요약:');
                    console.log(apiKeySummary);
                    validKeys = Object.values(apiKeyStatus).filter(function (status) { return status.valid; }).length;
                    if (validKeys === 0) {
                        console.log('⚠️ 모든 API 키가 유효하지 않습니다. 기본 모드로 진행합니다.');
                    }
                    else {
                        console.log('✅ API 키 상태 양호합니다.');
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('@google/generative-ai'); })];
                case 9:
                    GoogleGenerativeAI = (_j.sent()).GoogleGenerativeAI;
                    finalGeminiKey = geminiKey || envConfig.geminiApiKey || '';
                    genAI = new GoogleGenerativeAI(finalGeminiKey);
                    return [4 /*yield*/, getAvailableGeminiModel(genAI, '메인 콘텐츠 생성')];
                case 10:
                    modelInfo = _j.sent();
                    model = modelInfo.model;
                    detectedTargetYear = detectTargetYear(safeTopic, keywordArray);
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 5% - 제목 생성 중');
                    // 1. 제목 생성
                    console.log('✨ 제목 생성 중...');
                    crawledContents = [];
                    crawledCTAs = [];
                    crawledTitles = crawledContents.map(function (content) { return content.title; }).filter(function (title) { return title; });
                    titlePrompt = (0, max_mode_structure_1.buildMaxModeTitlePrompt)(contentMode, safeTopic, keywordArray);
                    return [4 /*yield*/, safeGenerateContent(model, titlePrompt, { maxOutputTokens: 500 }, '제목 생성', genAI)];
                case 11:
                    titleRaw = _j.sent();
                    title = titleRaw.trim();
                    // 여러 제목이 있는 경우 (예: "* **제목1** * **제목2**" 형태)
                    if (title.includes('* **') && title.split('* **').length > 2) {
                        firstTitleMatch = title.match(/\*\s*\*\*([^*]+)\*\*/);
                        if (firstTitleMatch && firstTitleMatch[1]) {
                            title = firstTitleMatch[1].trim();
                        }
                        else {
                            lines = title.split('\n').filter(function (line) { return line.trim().length > 0; });
                            if (lines.length > 0 && lines[0]) {
                                title = lines[0].trim();
                                // 마크다운 제거
                                title = title.replace(/^\*\s*\*\*|\*\*$/g, '').replace(/^\*\s*|\s*\*$/g, '').trim();
                            }
                        }
                    }
                    // 마크다운 제거
                    title = title.replace(/^\*\s*\*\*|\*\*$/g, '').replace(/^\*\s*|\s*\*$/g, '').trim();
                    titleLines = title.split('\n');
                    if (titleLines.length > 0 && titleLines[0]) {
                        firstLine = titleLines[0].trim();
                        if (firstLine.length > 0) {
                            title = firstLine;
                        }
                    }
                    // 🔧 제목 길이 제한 (25자, 더 짧고 강렬하게)
                    if (title.length > 25) {
                        title = title.substring(0, 22) + '...';
                    }
                    console.log("\u2705 \uC81C\uBAA9: ".concat(title));
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 10% - 제목 생성 완료');
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 15% - 소제목 구조 설계 중');
                    // 2. 크롤링 + AI로 최적화된 소제목 5개 생성
                    console.log('🔍 소제목 분석 중...');
                    optimalSubtopic = [];
                    _j.label = 12;
                case 12:
                    _j.trys.push([12, 14, , 15]);
                    console.log('🔎 키워드 기반 소제목 수집 중...');
                    subtopicOptions = {
                        geminiKey: geminiKey,
                        provider: 'gemini',
                        naverClientId: payload.naverClientId,
                        naverClientSecret: payload.naverClientSecret,
                        googleCseKey: googleCseKey,
                        googleCseCx: googleCseCx,
                        crawledContents: crawledContents
                    };
                    return [4 /*yield*/, (0, subtopic_crawler_1.generateOptimalSubtopic)(safeTopic, keywordArray, subtopicOptions)];
                case 13:
                    optimalSubtopic = _j.sent();
                    console.log("\u2705 \uC18C\uC81C\uBAA9 \uC0DD\uC131 \uC644\uB8CC: ".concat(optimalSubtopic.length, "\uAC1C"));
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 20% - 소제목 생성 완료');
                    return [3 /*break*/, 15];
                case 14:
                    error_6 = _j.sent();
                    console.log('[CONTENT] 소제목 크롤링 실패, 기본 소제목 사용:', error_6);
                    optimalSubtopic = [
                        "".concat(safeTopic, "\uC758 \uAE30\uBCF8 \uAC1C\uB150\uACFC \uC774\uD574"),
                        "".concat(safeTopic, "\uC758 \uC8FC\uC694 \uD2B9\uC9D5\uACFC \uC7A5\uC810"),
                        "".concat(safeTopic, "\uC758 \uD65C\uC6A9 \uBC29\uBC95\uACFC \uC0AC\uB840"),
                        "".concat(safeTopic, "\uC758 \uC8FC\uC758\uC0AC\uD56D\uACFC \uD55C\uACC4"),
                        "".concat(safeTopic, "\uC758 \uBBF8\uB798 \uC804\uB9DD\uACFC \uBC1C\uC804 \uBC29\uD5A5")
                    ];
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 20% - 기본 소제목 사용');
                    return [3 /*break*/, 15];
                case 15:
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 25% - 외부 정보 수집 중');
                    // 3-4. 썸네일 생성과 크롤링 병렬 처리 (성능 최적화)
                    console.log('🖼️ 썸네일 생성 및 크롤링 병렬 처리 시작...');
                    thumbnailUrl = '';
                    seoTitle = '';
                    crawlOptions = {
                        // 🔧 openaiKey 제거 (OpenAI는 글 생성에 사용하지 않음, DALL-E용으로만 사용)
                        geminiKey: mergedPayload.geminiKey,
                        provider: 'gemini', // 🔧 항상 Gemini만 사용
                        naverClientId: mergedPayload.naverClientId,
                        naverClientSecret: mergedPayload.naverClientSecret,
                        googleCseKey: mergedPayload.googleCseKey,
                        googleCseCx: mergedPayload.googleCseCx,
                        enableMassCrawling: envConfig.massCrawlingEnabled !== false,
                        manualCrawlUrls: payload.manualCrawlUrls || []
                    };
                    canCrawl = apiKeyStatus.naver.valid || apiKeyStatus.googleCse.valid;
                    return [4 /*yield*/, Promise.allSettled([
                        // SEO 제목 생성
                        generateSEOTitle(safeTopic, keywordArray, 'gemini', undefined, geminiKey, [], detectedTargetYear),
                        // 크롤링
                        canCrawl ? (0, content_crawler_1.crawlAndMixContent)(safeTopic, keywordArray, __assign(__assign({}, crawlOptions), { provider: 'gemini' })).catch(function (err) {
                            console.log('[CONTENT] 크롤링 실패, 기본 모드로 진행:', err);
                            return { contents: [], ctas: [] };
                        }) : Promise.resolve({ contents: [], ctas: [] })
                    ])];
                case 16:
                    _c = _j.sent(), seoTitleResult = _c[0], crawlResult = _c[1];
                    // SEO 제목 결과 처리
                    if (seoTitleResult.status === 'fulfilled') {
                        seoTitle = seoTitleResult.value;
                        console.log("\uD83D\uDCDD SEO \uC81C\uBAA9: ".concat(seoTitle));
                    }
                    else {
                        seoTitle = safeTopic; // 폴백
                        console.log("\u26A0\uFE0F SEO \uC81C\uBAA9 \uC0DD\uC131 \uC2E4\uD328, \uC8FC\uC81C \uC0AC\uC6A9: ".concat(seoTitle));
                    }
                    if (seoTitle.trim() === safeTopic.trim()) {
                        yearForTitle = detectedTargetYear && detectedTargetYear >= 1900 ? detectedTargetYear : new Date().getFullYear();
                        seoTitle = "".concat(safeTopic, " ").concat(yearForTitle, "\uB144 \uD575\uC2EC \uC804\uB7B5 \uCD1D\uC815\uB9AC");
                        console.log("\u2139\uFE0F SEO \uC81C\uBAA9\uC774 \uC8FC\uC81C\uC640 \uB3D9\uC77C\uD558\uC5EC \uBCF4\uC815: ".concat(seoTitle));
                    }
                    // 크롤링 결과 처리
                    if (crawlResult.status === 'fulfilled') {
                        crawledContents = crawlResult.value.contents || [];
                        crawledCTAs = crawlResult.value.ctas || [];
                        console.log("\u2705 \uD06C\uB864\uB9C1 \uC644\uB8CC: ".concat(crawledContents.length, "\uAC1C \uAE00, ").concat(crawledCTAs.length, "\uAC1C CTA"));
                        onLog === null || onLog === void 0 ? void 0 : onLog('✅ [4/8] 크롤링 완료: 콘텐츠 ' + crawledContents.length + '개, CTA ' + crawledCTAs.length + '개 (50%)');
                    }
                    else {
                        crawledContents = [];
                        crawledCTAs = [];
                        console.log('[CONTENT] 크롤링 실패, 기본 모드로 진행');
                        onLog === null || onLog === void 0 ? void 0 : onLog('⚠️ [4/8] 크롤링 실패, 기본 모드로 진행 (50%)');
                    }
                    if (!(apiKeyStatus.naver.valid && mergedPayload.naverClientId && mergedPayload.naverClientSecret)) return [3 /*break*/, 23];
                    _j.label = 17;
                case 17:
                    _j.trys.push([17, 22, , 23]);
                    console.log('[NAVER-SEARCH] 네이버 검색 API로 유효한 CTA 링크 검색 시작...');
                    onLog === null || onLog === void 0 ? void 0 : onLog('🔍 [4.5/8] 네이버 검색으로 유효한 링크 검색 중... (52%)');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/naver-search-validator'); })];
                case 18:
                    _d = _j.sent(), getValidNaverLinks = _d.getValidNaverLinks, getValidLinksForMultipleKeywords = _d.getValidLinksForMultipleKeywords;
                    searchKeywords = __spreadArray(__spreadArray([
                        safeTopic
                    ], keywordArray.slice(0, 3), true), [
                        "".concat(safeTopic, " ").concat(keywordArray[0] || '').trim() // 조합 키워드
                    ], false).filter(function (k) { return k && k.length > 0; });
                    return [4 /*yield*/, getValidNaverLinks(searchKeywords[0] || safeTopic, {
                        clientId: mergedPayload.naverClientId,
                        clientSecret: mergedPayload.naverClientSecret
                    }, {
                        maxResults: 5,
                        validateLinks: true
                    })];
                case 19:
                    validLinks = _j.sent();
                    if (!(validLinks.length < 3 && searchKeywords.length > 1)) return [3 /*break*/, 21];
                    return [4 /*yield*/, getValidLinksForMultipleKeywords(searchKeywords.slice(1, 3), {
                        clientId: mergedPayload.naverClientId,
                        clientSecret: mergedPayload.naverClientSecret
                    }, {
                        maxResultsPerKeyword: 3,
                        maxTotalResults: 5,
                        validateLinks: true
                    })];
                case 20:
                    additionalLinks = _j.sent();
                    seenUrls = new Set(validLinks.map(function (link) { return link.url; }));
                    for (_i = 0, additionalLinks_1 = additionalLinks; _i < additionalLinks_1.length; _i++) {
                        link = additionalLinks_1[_i];
                        if (!seenUrls.has(link.url)) {
                            seenUrls.add(link.url);
                            validLinks.push(link);
                            if (validLinks.length >= 5)
                                break;
                        }
                    }
                    _j.label = 21;
                case 21:
                    if (validLinks.length > 0) {
                        console.log("[NAVER-SEARCH] \u2705 \uC720\uD6A8\uD55C \uB9C1\uD06C ".concat(validLinks.length, "\uAC1C \uBC1C\uACAC"));
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 [4.5/8] \uC720\uD6A8\uD55C \uB9C1\uD06C ".concat(validLinks.length, "\uAC1C \uBC1C\uACAC (52%)"));
                        naverCTAs_1 = validLinks.map(function (link, index) {
                            return ({
                                text: link.title || "".concat(safeTopic, " \uC815\uBCF4 \uD655\uC778"),
                                url: link.url,
                                type: 'button',
                                context: link.description || '',
                                hook: "\uD83D\uDCA1 ".concat(link.title || safeTopic, "\uC5D0 \uB300\uD55C \uB354 \uC790\uC138\uD55C \uC815\uBCF4\uAC00 \uD544\uC694\uD558\uC2E0\uAC00\uC694?"),
                                source: 'naver-search',
                                relevance: 10 - index, // 순위가 높을수록 관련성 높음
                                isExternal: true
                            });
                        });
                        // 기존 CTA와 병합 (네이버 검색 결과 우선)
                        crawledCTAs = __spreadArray(__spreadArray([], naverCTAs_1, true), crawledCTAs.filter(function (cta) {
                            // 중복 제거 (URL 기준)
                            return !naverCTAs_1.some(function (naverCta) { return naverCta.url === cta.url; });
                        }), true);
                        console.log("[NAVER-SEARCH] \uCD5C\uC885 CTA ".concat(crawledCTAs.length, "\uAC1C (\uB124\uC774\uBC84 \uAC80\uC0C9 ").concat(naverCTAs_1.length, "\uAC1C \uD3EC\uD568)"));
                    }
                    else {
                        console.log('[NAVER-SEARCH] ⚠️ 유효한 링크를 찾을 수 없습니다.');
                    }
                    return [3 /*break*/, 23];
                case 22:
                    error_7 = _j.sent();
                    console.error('[NAVER-SEARCH] 네이버 검색 실패:', error_7.message);
                    return [3 /*break*/, 23];
                case 23: return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/url-validator'); })];
                case 24:
                    filterOfficialCTAs = (_j.sent()).filterOfficialCTAs;
                    originalCtaCount = crawledCTAs.length;
                    crawledCTAs = filterOfficialCTAs(crawledCTAs);
                    if (originalCtaCount > crawledCTAs.length) {
                        console.log("[URL-FILTER] CTA ".concat(originalCtaCount, "\uAC1C \u2192 ").concat(crawledCTAs.length, "\uAC1C (\uBE44\uACF5\uC2DD \uC0AC\uC774\uD2B8 \uC81C\uAC70)"));
                    }
                    if (!(crawledContents.length > 0)) return [3 /*break*/, 28];
                    _j.label = 25;
                case 25:
                    _j.trys.push([25, 27, , 28]);
                    return [4 /*yield*/, generateSEOTitle(safeTopic, keywordArray, 'gemini', undefined, geminiKey, crawledContents, detectedTargetYear)];
                case 26:
                    improvedSeoTitle = _j.sent();
                    if (improvedSeoTitle && improvedSeoTitle.length > 0) {
                        seoTitle = improvedSeoTitle;
                        console.log("\uD83D\uDCDD \uAC1C\uC120\uB41C SEO \uC81C\uBAA9: ".concat(seoTitle));
                    }
                    return [3 /*break*/, 28];
                case 27:
                    error_8 = _j.sent();
                    console.log('⚠️ SEO 제목 개선 실패, 기존 제목 사용:', error_8);
                    return [3 /*break*/, 28];
                case 28:
                    _j.trys.push([28, 34, , 35]);
                    finalThumbnailMode = thumbnailMode || (env === null || env === void 0 ? void 0 : env.thumbnailMode) || 'text';
                    console.log("\uD83D\uDDBC\uFE0F \uC378\uB124\uC77C \uBAA8\uB4DC: ".concat(finalThumbnailMode));
                    if (!(finalThumbnailMode === 'none')) return [3 /*break*/, 29];
                    console.log('⏭️ 썸네일 생성을 건너뜁니다.');
                    thumbnailUrl = '';
                    onLog === null || onLog === void 0 ? void 0 : onLog('⏭️ [3/8] 썸네일 생성 건너뜀 (35%)');
                    return [3 /*break*/, 33];
                case 29:
                    if (!(finalThumbnailMode === 'dalle' || finalThumbnailMode === 'pexels' || finalThumbnailMode === 'cse')) return [3 /*break*/, 32];
                    onLog === null || onLog === void 0 ? void 0 : onLog('🖼️ [3/8] 실제 이미지 생성 중... (35%)');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../thumbnail'); })];
                case 30:
                    makeSmartThumbnail = (_j.sent()).makeSmartThumbnail;
                    pexelsOptions = finalThumbnailMode === 'pexels' && payload.pexelsApiKey
                        ? { apiKey: payload.pexelsApiKey }
                        : undefined;
                    cseOptions = finalThumbnailMode === 'cse' && googleCseKey && googleCseCx
                        ? { apiKey: googleCseKey, cx: googleCseCx }
                        : undefined;
                    dalleOptions = finalThumbnailMode === 'dalle' && (payload.dalleApiKey || payload.openaiKey)
                        ? { apiKey: payload.dalleApiKey || payload.openaiKey || '' }
                        : undefined;
                    return [4 /*yield*/, makeSmartThumbnail(seoTitle, safeTopic, {}, pexelsOptions, cseOptions, dalleOptions)];
                case 31:
                    thumbResult = _j.sent();
                    if (thumbResult.ok) {
                        thumbnailUrl = thumbResult.dataUrl;
                        console.log("\u2705 \uC378\uB124\uC77C \uC0DD\uC131 \uC644\uB8CC (".concat(thumbResult.type, ")"));
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 [3/8] \uC378\uB124\uC77C \uC0DD\uC131 \uC644\uB8CC: ".concat(thumbResult.type, " \uC774\uBBF8\uC9C0 (35%)"));
                    }
                    else {
                        console.log("\u274C ".concat(finalThumbnailMode, " \uC378\uB124\uC77C \uC0DD\uC131 \uC2E4\uD328, \uD14D\uC2A4\uD2B8 \uC378\uB124\uC77C\uB85C \uB300\uCCB4"));
                        thumbnailHtml = generateTextThumbnail(seoTitle, safeTopic);
                        thumbnailUrl = "data:image/svg+xml;base64,".concat(Buffer.from(thumbnailHtml).toString('base64'));
                        onLog === null || onLog === void 0 ? void 0 : onLog('⚠️ [3/8] 텍스트 썸네일 사용 (35%)');
                    }
                    return [3 /*break*/, 33];
                case 32:
                    thumbnailHtml = generateTextThumbnail(seoTitle, safeTopic);
                    thumbnailUrl = "data:image/svg+xml;base64,".concat(Buffer.from(thumbnailHtml).toString('base64'));
                    console.log('✅ 썸네일 생성 완료 (SVG 텍스트)');
                    onLog === null || onLog === void 0 ? void 0 : onLog('✅ [3/8] 썸네일 생성 완료: SVG 텍스트 썸네일 (35%)');
                    _j.label = 33;
                case 33: return [3 /*break*/, 35];
                case 34:
                    error_9 = _j.sent();
                    console.log('❌ 썸네일 생성 실패, 기본 썸네일 사용:', error_9);
                    onLog === null || onLog === void 0 ? void 0 : onLog('⚠️ [3/8] 기본 썸네일 사용 (35%)');
                    thumbnailUrl = '';
                    return [3 /*break*/, 35];
                case 35:
                    // 크롤링 결과 상세 로깅
                    if (crawledContents.length > 0) {
                        console.log('[CRAWLER] 📊 수집된 콘텐츠 샘플:');
                        crawledContents.slice(0, 3).forEach(function (content, index) {
                            console.log("[CRAWLER] ".concat(index + 1, ". ").concat(content.title, " (").concat(content.url, ")"));
                        });
                    }
                    if (crawledCTAs.length > 0) {
                        console.log('[CRAWLER] 🔗 수집된 CTA 샘플:');
                        crawledCTAs.slice(0, 3).forEach(function (cta, index) {
                            console.log("[CRAWLER] ".concat(index + 1, ". ").concat(cta.text, " - ").concat(cta.hook, " (").concat(cta.url, ")"));
                        });
                    }
                    if (crawledContents.length === 0 && crawledCTAs.length === 0 && canCrawl) {
                        console.log('[CRAWLER] ⚠️ 실제 크롤링 데이터가 없습니다. API 키 설정을 확인해주세요.');
                        onLog === null || onLog === void 0 ? void 0 : onLog('[WARNING] 실제 크롤링 데이터가 없습니다. API 키 설정을 확인해주세요.');
                    }
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 30% - 썸네일 생성 완료');
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 40% - AI 콘텐츠 생성 시작');
                    // 5. 각 섹션별 콘텐츠 생성
                    console.log("\uD83D\uDCDD ".concat(sectionConfigs.length, "\uAC1C \uC139\uC158 \uBCD1\uB82C \uC0DD\uC131 \uC2DC\uC791..."));
                    sections = [];
                    sectionPromises = sectionConfigs.map(function (section, i) {
                        return __awaiter(_this, void 0, void 0, function () {
                            var subtopic, manualCta, sectionCTAs, relevantCTA, dynamicCta, finalCta, sectionPrompt, sectionContent, needsH2Image, h2ImagesObj, sectionError_1, fallbackContent;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        subtopic = optimalSubtopic[i] || section.title;
                                        _a.label = 1;
                                    case 1:
                                        _a.trys.push([1, 3, , 4]);
                                        console.log("\uD83D\uDCDD ".concat(section.title, " \uC139\uC158 \uC0DD\uC131 \uC911... (").concat(i + 1, "/").concat(sectionConfigs.length, ")"));
                                        onLog === null || onLog === void 0 ? void 0 : onLog('📝 [5/8] "' + section.title + '" 섹션 생성 중... (' + (i + 1) + '/' + sectionConfigs.length + ') (60%)');
                                        manualCta = manualCtas[i];
                                        sectionCTAs = crawledCTAs || [];
                                        relevantCTA = sectionCTAs
                                            .filter(function (cta) { return cta.isExternal && cta.relevance > 5; })
                                            .sort(function (a, b) { return b.relevance - a.relevance; })
                                            .find(function (cta) {
                                                return cta.text.toLowerCase().includes(subtopic.toLowerCase()) ||
                                                    cta.text.toLowerCase().includes(keywordArray.join(' ').toLowerCase()) ||
                                                    cta.context.toLowerCase().includes(subtopic.toLowerCase());
                                            }) || sectionCTAs
                                                .filter(function (cta) { return cta.isExternal && cta.relevance > 5; })
                                                .sort(function (a, b) { return b.relevance - a.relevance; })[0];
                                        dynamicCta = relevantCTA ? {
                                            url: relevantCTA.url,
                                            text: relevantCTA.text,
                                            hook: relevantCTA.hook || "\uD83D\uDCA1 ".concat(subtopic, "\uC5D0 \uB300\uD55C \uB354 \uC790\uC138\uD55C \uC815\uBCF4\uAC00 \uD544\uC694\uD558\uC2E0\uAC00\uC694?")
                                        } : null;
                                        finalCta = dynamicCta || manualCta;
                                        sectionPrompt = void 0;
                                        if (env.contentMode === 'spiderwebbing' || env.contentMode === 'adsense' || env.contentMode === 'paraphrasing') {
                                            sectionPrompt = (0, max_mode_structure_1.buildContentModePrompt)(safeTopic, section, subtopic, env.contentMode, finalCta, payload.platform, payload.toneStyle, undefined, undefined, undefined, payload.adsenseAuthorInfo);
                                        }
                                        else {
                                            sectionPrompt = (0, max_mode_structure_1.buildMaxModePromptWithSubtopic)(contentMode, safeTopic, keywordArray, section, subtopic, finalCta, crawledContents, {}, payload.platform, payload.toneStyle, detectedTargetYear);
                                        }
                                        return [4 /*yield*/, safeGenerateContent(model, sectionPrompt, { maxOutputTokens: 8000 }, "\uC139\uC158 ".concat(i + 1, " \uC0DD\uC131"), genAI)];
                                    case 2:
                                        sectionContent = _a.sent();
                                        needsH2Image = false;
                                        if (h2Images && typeof h2Images === 'object' && !Array.isArray(h2Images) && 'sections' in h2Images) {
                                            h2ImagesObj = h2Images;
                                            if (Array.isArray(h2ImagesObj.sections)) {
                                                needsH2Image = h2ImagesObj.sections.includes(i + 1);
                                            }
                                        }
                                        console.log("\u2705 ".concat(section.title, " \uC139\uC158 \uC644\uB8CC (").concat(sectionContent.length, "\uC790)"));
                                        onLog === null || onLog === void 0 ? void 0 : onLog('✅ [5/8] "' + section.title + '" 섹션 완료: ' + sectionContent.length + '자 (' + (i + 1) + '/' + sectionConfigs.length + ') (65%)');
                                        return [2 /*return*/, {
                                            index: i,
                                            content: sectionContent,
                                            success: true,
                                            needsH2Image: needsH2Image,
                                            sectionTitle: section.title
                                        }];
                                    case 3:
                                        sectionError_1 = _a.sent();
                                        console.error("[SECTION ERROR] ".concat(section.title, " \uC139\uC158 \uC0DD\uC131 \uC2E4\uD328:"), sectionError_1);
                                        fallbackContent = "<h2>".concat(section.title, "</h2><p>").concat(subtopic, "\uC5D0 \uB300\uD55C \uB0B4\uC6A9\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.</p>");
                                        return [2 /*return*/, { index: i, content: fallbackContent, success: false }];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        });
                    });
                    // Promise.allSettled 사용 (안전)
                    return [4 /*yield*/, Promise.allSettled(sectionPromises)];
                case 36:
                    sectionSettled = _j.sent();
                    sectionResults = sectionSettled.map(function (result, i) {
                        if (result.status === 'fulfilled') {
                            return result.value;
                        }
                        console.error("❌ [SECTION-".concat(i + 1, "] \uC0DD\uC131 \uC2E4\uD328:"), result.reason);
                        onLog === null || onLog === void 0 ? void 0 : onLog("❌ [SECTION-".concat(i + 1, "] \uC0DD\uC131 \uC2E4\uD328, \uD3EC\uBCA8\uD06C \uC0DD\uC131"));
                        var sectionConfig = sectionConfigs && sectionConfigs[i];
                        var sectionTitle = (sectionConfig === null || sectionConfig === void 0 ? void 0 : sectionConfig.title) || "섹션 ".concat(i + 1);
                        var subtopic = optimalSubtopic && optimalSubtopic[i] ? optimalSubtopic[i] : safeTopic;
                        return {
                            index: i,
                            content: "<div style=\"margin:40px 0; padding:18px 24px; background:linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(236, 253, 245, 0.45) 100%); border-radius:20px;\"><h2 id=\"s".concat(i + 1, "\">").concat(sectionTitle, "</h2></div><p>").concat(subtopic, "\uC5D0 \uB300\uD55C \uC911\uC694\uD55C \uC815\uBCF4\uB97C \uC81C\uACF5\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.</p>"),
                            success: false
                        };
                    });
                    h2ImagePromises = [];
                    if (h2Images && typeof h2Images === 'object' && !Array.isArray(h2Images) && 'sections' in h2Images && 'source' in h2Images) {
                        h2ImagesObj_1 = h2Images;
                        sectionResults
                            .filter(function (result) { return result.needsH2Image; })
                            .forEach(function (result) {
                                h2ImagePromises.push(generateH2Image(result.sectionTitle, h2ImagesObj_1.source, payload)
                                    .then(function (url) { return ({ index: result.index, url: url || '' }); })
                                    .catch(function () { return ({ index: result.index, url: '' }); }));
                            });
                    }
                    if (!(h2ImagePromises.length > 0)) return [3 /*break*/, 38];
                    return [4 /*yield*/, Promise.all(h2ImagePromises)];
                case 37:
                    _e = _j.sent();
                    return [3 /*break*/, 39];
                case 38:
                    _e = [];
                    _j.label = 39;
                case 39:
                    h2ImageResults = _e;
                    h2ImageMap = new Map(h2ImageResults.map(function (r) { return [r.index, r.url]; }));
                    // 🔧 결과를 순서대로 정렬하고 H2 이미지 삽입 (크롤링 순서 보장)
                    sectionResults
                        .sort(function (a, b) { return a.index - b.index; })
                        .forEach(function (result) {
                            var _a;
                            var finalContent = result.content;
                            // 섹션 콘텐츠가 비어있거나 너무 짧으면 경고
                            if (!finalContent || finalContent.trim().length < 50) {
                                console.warn("\u26A0\uFE0F [SECTION] ".concat(result.index + 1, "\uBC88 \uC139\uC158 \uCF58\uD150\uCE20\uAC00 \uBE44\uC5B4\uC788\uAC70\uB098 \uB108\uBB34 \uC9E7\uC2B5\uB2C8\uB2E4 (").concat((finalContent === null || finalContent === void 0 ? void 0 : finalContent.length) || 0, "\uC790)"));
                                onLog === null || onLog === void 0 ? void 0 : onLog("\u26A0\uFE0F \uC139\uC158 ".concat(result.index + 1, " \uCF58\uD150\uCE20\uAC00 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4. \uAE30\uBCF8 \uCF58\uD150\uCE20\uB85C \uB300\uCCB4\uD569\uB2C8\uB2E4."));
                                var sectionTitle = ((_a = sectionConfigs[result.index]) === null || _a === void 0 ? void 0 : _a.title) || "\uC139\uC158 ".concat(result.index + 1);
                                var subtopic = optimalSubtopic[result.index] || safeTopic;
                                finalContent = "<h2>".concat(sectionTitle, "</h2><p>").concat(subtopic, "\uC5D0 \uB300\uD55C \uC0C1\uC138\uD55C \uB0B4\uC6A9\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uACE7 \uC5C5\uB370\uC774\uD2B8\uB420 \uC608\uC815\uC785\uB2C8\uB2E4.</p>");
                            }
                            // H2 이미지 삽입
                            if (result.needsH2Image && h2ImageMap.has(result.index)) {
                                var h2ImageUrl = h2ImageMap.get(result.index);
                                if (h2ImageUrl) {
                                    console.log("\uD83D\uDDBC\uFE0F [H2 IMAGE] ".concat(result.index + 1, "\uBC88 \uC139\uC158\uC5D0 H2 \uC804\uC6A9 \uC774\uBBF8\uC9C0 \uCD94\uAC00 \uC911..."));
                                    // 🔧 이미지 카드 제거, 단순 이미지만 삽입, 관련 이미지 문구 숨김
                                    finalContent = finalContent.replace(/<h2[^>]*>([^<]+)<\/h2>/i, "<img src=\"".concat(h2ImageUrl, "\" alt=\"").concat(result.sectionTitle, "\" style=\"max-width: 100%; height: auto; border-radius: 8px; margin: 20px 0; display: block;\">\n            <h2 id=\"s").concat(result.index + 1, "\" style=\"font-size: 30px; font-weight: 800; color: #0f172a; margin: 52px 0 24px 0; padding: 0 0 12px 0; border-bottom: 4px solid #0ea5e9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\">$1</h2>"));
                                    console.log("\u2705 [H2 IMAGE] ".concat(result.index + 1, "\uBC88 \uC139\uC158 H2 \uC804\uC6A9 \uC774\uBBF8\uC9C0 \uCD94\uAC00 \uC644\uB8CC"));
                                }
                            }
                            // 🔧 섹션 H2에 ID 추가 (핵심 요약표 링크용)
                            // 첫 번째 H2 태그에 id="s${index+1}" 추가 (없는 경우만)
                            if (finalContent && typeof finalContent === 'string') {
                                // 이미 id가 있는지 확인
                                var hasSectionId = finalContent.match(/<h2[^>]*id=["']s\d+["']/i);
                                if (!hasSectionId) {
                                    // 첫 번째 H2에 id 추가
                                    finalContent = finalContent.replace(/(<h2)([^>]*>)/i, "$1 id=\"s".concat(result.index + 1, "\"$2"));
                                }
                            }
                            sections.push(finalContent);
                            if (!result.success) {
                                console.error("\u274C [SECTION] ".concat(result.index + 1, "\uBC88 \uC139\uC158 \uC0DD\uC131 \uC2E4\uD328"));
                                onLog === null || onLog === void 0 ? void 0 : onLog("\u274C \uC139\uC158 ".concat(result.index + 1, " \uC0DD\uC131 \uC2E4\uD328, \uAE30\uBCF8 \uCF58\uD150\uCE20 \uC0AC\uC6A9"));
                            }
                        });
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 50% - 섹션 생성 완료');
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 60% - 콘텐츠 품질 검사 중');
                    // 🔧 콘텐츠 중복 제거: 소제목(H2) 및 본문 내용 중복 검사 및 제거
                    console.log('[CONTENT-DEDUP] 콘텐츠 중복 검사 시작...');
                    seenSubtitles = new Set();
                    seenContent = new Set();
                    deduplicatedSections = [];
                    for (i = 0; i < sections.length; i++) {
                        sectionContent = sections[i] || '';
                        h2Matches = sectionContent.match(/<h2[^>]*>([^<]+)<\/h2>/gi);
                        if (h2Matches && h2Matches.length > 0) {
                            for (_f = 0, h2Matches_1 = h2Matches; _f < h2Matches_1.length; _f++) {
                                h2Match = h2Matches_1[_f];
                                h2Text = h2Match.replace(/<[^>]*>/g, '').trim().toLowerCase();
                                // 중복된 소제목 제거
                                if (seenSubtitles.has(h2Text)) {
                                    console.log("[CONTENT-DEDUP] \uC911\uBCF5\uB41C \uC18C\uC81C\uBAA9 \uC81C\uAC70: \"".concat(h2Text, "\""));
                                    sectionContent = sectionContent.replace(h2Match, ''); // 중복된 H2 제거
                                }
                                else {
                                    seenSubtitles.add(h2Text);
                                }
                            }
                        }
                        textContent = sectionContent
                            .replace(/<[^>]*>/g, ' ') // HTML 태그 제거
                            .replace(/\s+/g, ' ') // 공백 정규화
                            .trim()
                            .toLowerCase()
                            .substring(0, 200);
                        if (textContent.length > 50) { // 최소 50자 이상인 경우만 검사
                            isDuplicate = false;
                            for (_g = 0, seenContent_1 = seenContent; _g < seenContent_1.length; _g++) {
                                seenText = seenContent_1[_g];
                                similarity = calculateSimilarity(textContent, seenText);
                                if (similarity > 0.8) {
                                    console.log("[CONTENT-DEDUP] \uC911\uBCF5\uB41C \uB0B4\uC6A9 \uAC10\uC9C0 (\uC720\uC0AC\uB3C4: ".concat((similarity * 100).toFixed(1), "%): \"").concat(textContent.substring(0, 50), "...\""));
                                    isDuplicate = true;
                                    break;
                                }
                            }
                            if (!isDuplicate) {
                                seenContent.add(textContent);
                                deduplicatedSections.push(sectionContent);
                            }
                            else {
                                console.log("[CONTENT-DEDUP] \uC139\uC158 ".concat(i + 1, " \uC81C\uAC70\uB428 (\uC911\uBCF5 \uB0B4\uC6A9)"));
                                onLog === null || onLog === void 0 ? void 0 : onLog("\u26A0\uFE0F \uC139\uC158 ".concat(i + 1, " \uC81C\uAC70\uB428 (\uC911\uBCF5 \uB0B4\uC6A9)"));
                            }
                        }
                        else {
                            // 짧은 내용은 그대로 추가
                            deduplicatedSections.push(sectionContent);
                        }
                    }
                    // 중복 제거된 섹션으로 교체
                    if (deduplicatedSections.length < sections.length) {
                        console.log("[CONTENT-DEDUP] \uC911\uBCF5 \uC81C\uAC70 \uC644\uB8CC: ".concat(sections.length, "\uAC1C \u2192 ").concat(deduplicatedSections.length, "\uAC1C (").concat(sections.length - deduplicatedSections.length, "\uAC1C \uC81C\uAC70)"));
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 [5.5/8] \uC911\uBCF5 \uC81C\uAC70 \uC644\uB8CC: ".concat(sections.length - deduplicatedSections.length, "\uAC1C \uC139\uC158 \uC81C\uAC70 (67%)"));
                        sections = deduplicatedSections;
                    }
                    else {
                        console.log('[CONTENT-DEDUP] 중복된 내용이 없습니다.');
                    }
                    // 🔧 섹션이 비어있으면 경고
                    if (sections.length === 0) {
                        console.error('❌ [SECTION] 모든 섹션 생성 실패! 기본 콘텐츠로 대체합니다.');
                        onLog === null || onLog === void 0 ? void 0 : onLog('❌ 모든 섹션 생성 실패! 기본 콘텐츠로 대체합니다.');
                        for (i = 0; i < sectionConfigs.length; i++) {
                            sectionTitle = ((_h = sectionConfigs[i]) === null || _h === void 0 ? void 0 : _h.title) || "\uC139\uC158 ".concat(i + 1);
                            subtopic = optimalSubtopic[i] || safeTopic;
                            sections.push("<h2>".concat(sectionTitle, "</h2><p>").concat(subtopic, "\uC5D0 \uB300\uD55C \uC0C1\uC138\uD55C \uB0B4\uC6A9\uC744 \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4.</p>"));
                        }
                    }
                    shouldGenerateInspectionReport = payload.inspectionReport || Boolean(payload.inspectionReportPath);
                    if (!shouldGenerateInspectionReport) return [3 /*break*/, 46];
                    _j.label = 40;
                case 40:
                    _j.trys.push([40, 45, , 46]);
                    inspectionReport = (0, inspection_utils_1.buildInspectionReport)(safeTopic, sections, optimalSubtopic);
                    if (!(inspectionReport.sections.length > 0)) return [3 /*break*/, 43];
                    console.log("\uD83D\uDD75\uFE0F [INSPECTION] \uBCF4\uACE0\uC11C \uC0DD\uC131 \uC644\uB8CC: \uC139\uC158 ".concat(inspectionReport.summary.totalSections, "\uAC1C, \uD329\uD2B8 \uCCB4\uD06C ").concat(inspectionReport.summary.totalFactChecks, "\uAC74"));
                    onLog === null || onLog === void 0 ? void 0 : onLog("\uD83D\uDD75\uFE0F \uC0D8\uD50C \uAC80\uC218 \uBCF4\uACE0\uC11C \uC0DD\uC131: \uCD1D ".concat(inspectionReport.summary.totalSections, "\uAC1C \uC139\uC158, \uD329\uD2B8 \uCCB4\uD06C ").concat(inspectionReport.summary.totalFactChecks, "\uAC74"));
                    if (!payload.inspectionReportPath) return [3 /*break*/, 42];
                    return [4 /*yield*/, (0, inspection_utils_1.writeInspectionReportToFile)(inspectionReport, payload.inspectionReportPath)];
                case 41:
                    _j.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("\uD83D\uDDC2\uFE0F \uAC80\uC218 \uBCF4\uACE0\uC11C \uC800\uC7A5: ".concat(payload.inspectionReportPath));
                    _j.label = 42;
                case 42: return [3 /*break*/, 44];
                case 43:
                    console.log('🕵️ [INSPECTION] 보고서에 기록할 섹션이 없어 생성을 건너뜁니다.');
                    _j.label = 44;
                case 44: return [3 /*break*/, 46];
                case 45:
                    error_10 = _j.sent();
                    console.log('❌ [INSPECTION] 보고서 생성 실패:', error_10.message);
                    onLog === null || onLog === void 0 ? void 0 : onLog('❌ 샘플 검수 보고서 생성 실패');
                    return [3 /*break*/, 46];
                case 46:
                    // 6. 전체 HTML 조합
                    console.log('🔧 최종 HTML 조합 중...');
                    onLog === null || onLog === void 0 ? void 0 : onLog('🔧 [6/8] 최종 HTML 조합 중... (70%)');
                    isWordPress = payload.platform === 'wordpress';
                    isAdsenseMode = contentMode === 'adsense';
                    articleClass = isAdsenseMode ? 'post-body entry-content' : (isWordPress ? 'premium-article' : 'max-mode-article');
                    contentClass = isWordPress ? 'premium-content' : 'article-content';
                    finalTitle = seoTitle || safeTopic;
                    tableOfContents = isWordPress ? generateTableOfContentsLocal(optimalSubtopic, true) : '';
                    coreSummaryTable = generateCoreSummaryTableLocal(safeTopic, keywordArray, optimalSubtopic, sections);
                    thumbnailContainer = thumbnailUrl ? "\n    <div class=\"thumbnail-container\">\n      <img src=\"".concat(thumbnailUrl, "\" alt=\"").concat(finalTitle, "\" class=\"main-thumbnail\">\n    </div>\n  ") : '';
                    contentHtml = "\n    <div class=\"".concat(articleClass, "\">\n      ").concat(thumbnailContainer, "\n      <div class=\"").concat(contentClass, "\">\n        <div style=\"background: #ffffff; border-radius: 16px; padding: 40px; margin: 20px 0; box-shadow: 0 2px 12px rgba(0,0,0,0.08); border: 1px solid #e9ecef;\">\n          ").concat(tableOfContents, "\n          ").concat(sections.join('\n\n'), "\n          ").concat(coreSummaryTable, "\n        </div>\n      </div>\n    </div>\n  ");
                    // 🔧 h3 제목 및 모든 콘텐츠에서 &#10022; 문자 제거 (HTML 엔티티 및 텍스트 모두)
                    // 🔧 CTA 버튼과 모든 위치에서 &#10022; 제거
                    // 🔧 "핵심 내용 X 관련 이미지" 같은 문구 숨김 처리
                    contentHtml = contentHtml
                        .replace(/&#10022;/g, '')
                        .replace(/&amp;#10022;/g, '')
                        .replace(/&[#]?10022;/gi, '')
                        .replace(/&amp;#10022;/g, '') // 이중 인코딩된 경우
                        .replace(/\u2726/g, '') // Unicode 문자도 제거
                        .replace(/\u0026#10022;/g, '') // 다른 형태의 인코딩
                        .replace(/\*\*/g, '')
                        // 이미지 관련 문구 제거
                        .replace(/핵심\s*내용\s*\d*\s*관련\s*이미지/gi, '')
                        .replace(/📸\s*[^<]*관련\s*이미지/gi, '')
                        .replace(/<p[^>]*>.*?핵심\s*내용.*?관련\s*이미지.*?<\/p>/gi, '')
                        .replace(/<p[^>]*>.*?📸.*?관련\s*이미지.*?<\/p>/gi, '');
                    generateDisclaimer = function () {
                        return "\n<div class=\"disclaimer-section\" style=\"margin-top: 40px; padding: 25px; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 8px;\">\n  <h4 style=\"color: #007bff; margin-bottom: 18px; font-size: 1.4rem !important;\">\u26A0\uFE0F \uBA74\uCC45\uC0AC\uD56D</h4>\n  <p style=\"color: #666; line-height: 1.8; margin: 0; font-size: 1.15rem !important;\">\n    \uBCF8 \uAE00\uC740 \uC815\uBCF4 \uC81C\uACF5 \uBAA9\uC801\uC73C\uB85C \uC791\uC131\uB418\uC5C8\uC73C\uBA70, \uCD5C\uC2E0 \uC815\uBCF4\uB294 \uACF5\uC2DD \uC18C\uC2A4\uC5D0\uC11C \uD655\uC778\uD558\uC2DC\uAE30 \uBC14\uB78D\uB2C8\uB2E4. \n    \uC791\uC131\uC790\uC758 \uAC1C\uC778\uC801\uC778 \uC758\uACAC\uC774 \uD3EC\uD568\uB420 \uC218 \uC788\uC73C\uBA70, \uD22C\uC790\uB098 \uC911\uC694\uD55C \uACB0\uC815\uC744 \uB0B4\uB9AC\uAE30 \uC804\uC5D0\uB294 \uC804\uBB38\uAC00\uC640 \uC0C1\uB2F4\uD558\uC2DC\uAE30 \uBC14\uB78D\uB2C8\uB2E4. \n    \uC815\uBCF4\uC758 \uC815\uD655\uC131\uC774\uB098 \uC644\uC804\uC131\uC744 \uBCF4\uC7A5\uD558\uC9C0 \uC54A\uC73C\uBA70, \uBCF8 \uAE00\uC758 \uB0B4\uC6A9\uC73C\uB85C \uC778\uD55C \uC190\uC2E4\uC774\uB098 \uD53C\uD574\uC5D0 \uB300\uD574 \uCC45\uC784\uC9C0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.\n  </p>\n</div>";
                    };
                    disclaimerHtml = generateDisclaimer();
                    cloudSkinCSS = "<style>\n/* ===================================\n   \uC18C\uD504\uD2B8 \uD074\uB77C\uC6B0\uB4DC \uC2A4\uD0A8 - \uCD5C\uC801\uD654 \uBC84\uC804\n   \uBE14\uB85C\uADF8\uC2A4\uD31F \uC790\uB3D9 \uAE00\uC4F0\uAE30 \uC804\uC6A9\n   =================================== */\n\n/* \uB8E8\uD2B8 \uBCC0\uC218 */\n:root {\n  --cloud-primary: #74b9ff;\n  --cloud-secondary: #a29bfe;\n  --cloud-accent: #fd79a8;\n  --cloud-yellow: #ffeaa7;\n  --cloud-gray: #dfe6e9;\n  --bg-white: rgba(255, 255, 255, 0.85);\n  --bg-white-solid: rgba(255, 255, 255, 0.95);\n  --text-primary: #333;\n  --text-secondary: #555;\n  --text-muted: #666;\n  --border-white: rgba(255, 255, 255, 0.95);\n}\n\n/* \uC804\uCCB4 \uCEE8\uD14C\uC774\uB108 */\n.max-mode-article {\n  max-width: 900px;\n  margin: 0 auto;\n  background: linear-gradient(135deg, #ffeaa7 0%, #dfe6e9 50%, #74b9ff 100%);\n  border-radius: 30px;\n  padding: 50px;\n  box-shadow: 0 20px 60px rgba(223, 230, 233, 0.5);\n}\n\n/* ========================================\n   1. \uC378\uB124\uC77C (\uD56D\uC0C1 \uC790\uB3D9 \uC124\uC815) - \uBBFC\uD2B8 \uD14C\uB450\uB9AC \uC2A4\uD0C0\uC77C\n   ======================================== */\n.thumbnail-container {\n  position: relative;\n  border-radius: 22px;\n  overflow: hidden;\n  margin: -46px -46px 38px -46px;\n  min-height: 260px;\n  max-height: 420px;\n  box-shadow: 0 20px 50px rgba(15, 118, 110, 0.25);\n  background: #f8fafc;\n}\n\n.main-thumbnail {\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  display: block;\n}\n\n/* \uC378\uB124\uC77C \uC704 \uC81C\uBAA9 \uC624\uBC84\uB808\uC774 \uC81C\uAC70 (\uC790\uB3D9 \uC378\uB124\uC77C\uC5D0 \uD14D\uC2A4\uD2B8 \uD3EC\uD568\uB418\uBBC0\uB85C) */\n.thumbnail-overlay {\n  display: none;\n}\n\n.thumbnail-title {\n  display: none;\n}\n\n/* \uBA54\uC778 \uC81C\uBAA9 (\uC378\uB124\uC77C \uBC14\uB85C \uC544\uB798) */\n.max-mode-article > h1:first-of-type,\n.max-mode-article > h1.main-title {\n  font-size: 3.2rem;\n  margin: 0 0 40px 0;\n  padding: 45px;\n  background: var(--bg-white-solid);\n  backdrop-filter: blur(30px);\n  border-radius: 25px;\n  border: 3px solid var(--border-white);\n  box-shadow: 0 10px 40px rgba(223, 230, 233, 0.4);\n  background-image: linear-gradient(135deg, #74b9ff 0%, #a29bfe 50%, #fd79a8 100%);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  background-clip: text;\n  line-height: 1.15;\n  font-weight: 800;\n  letter-spacing: -1px;\n  text-align: center;\n}\n\n/* \uC378\uB124\uC77C\uC774 \uC788\uC744 \uB54C \uCCAB h1\uC740 \uC81C\uBAA9\uC6A9 */\n.thumbnail-container ~ h1:first-of-type {\n  display: block;\n}\n\n/* ========================================\n   2. \uBC84\uD2BC\uD615 \uBAA9\uCC28 (\uC6CC\uB4DC\uD504\uB808\uC2A4 \uC804\uC6A9)\n   ======================================== */\n.table-of-contents {\n  background: var(--bg-white-solid);\n  backdrop-filter: blur(20px);\n  border: 3px solid var(--border-white);\n  border-radius: 25px;\n  padding: 40px;\n  margin: 40px 0 50px 0;\n  box-shadow: 0 15px 45px rgba(116, 185, 255, 0.2);\n}\n\n.table-of-contents h2 {\n  font-size: 1.6rem;\n  margin: 0 0 30px 0;\n  background: linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  background-clip: text;\n  font-weight: 700;\n  text-align: center;\n  padding-bottom: 20px;\n  border-bottom: 3px solid rgba(116, 185, 255, 0.2);\n}\n\n.table-of-contents ul {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 15px;\n}\n\n.table-of-contents li {\n  margin: 0;\n}\n\n.table-of-contents a {\n  display: block;\n  padding: 18px 25px;\n  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(116, 185, 255, 0.1) 100%);\n  border-radius: 15px;\n  color: var(--text-primary);\n  text-decoration: none;\n  font-weight: 600;\n  font-size: 1.05rem;\n  border: 2px solid rgba(116, 185, 255, 0.2);\n  transition: all 0.3s ease;\n  text-align: center;\n}\n\n.table-of-contents a:hover {\n  background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(116, 185, 255, 0.2) 100%);\n  transform: translateY(-5px);\n  box-shadow: 0 10px 25px rgba(116, 185, 255, 0.25);\n  border-color: #74b9ff;\n}\n\n/* ========================================\n   3. H2 \uC139\uC158 (\uCD1D 5\uAC1C) - \uAC00\uB3C5\uC131 \uAC1C\uC120: \uD770\uC0C9 \uBC30\uACBD, \uC5B4\uB450\uC6B4 \uAE00\uC790\n   ======================================== */\n.max-mode-article > h2,\nh2.main-section-title,\n.max-mode-article h2 {\n  font-size: 1.85rem !important;\n  margin: 52px 0 24px 0;\n  padding: 0 0 12px 0;\n  background: transparent !important;\n  color: #0f172a !important;\n  border-radius: 0;\n  text-align: left;\n  font-weight: 800;\n  box-shadow: none !important;\n  border: none !important;\n  border-bottom: 4px solid #0ea5e9 !important;\n  letter-spacing: -0.02em;\n  line-height: 1.3;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* h2 \uC7A5\uC2DD \uC694\uC18C \uC81C\uAC70 (\uAC00\uB3C5\uC131 \uAC1C\uC120) */\n.max-mode-article > h2::before,\nh2.main-section-title::before,\n.max-mode-article h2::before {\n  display: none !important;\n}\n\n.max-mode-article > h2::after,\nh2.main-section-title::after,\n.max-mode-article h2::after {\n  display: none !important;\n}\n\n/* \uCCAB \uBC88\uC9F8 H2\uB294 \uC0C1\uB2E8 \uC5EC\uBC31 \uC904\uC784 */\n.max-mode-article > h2:first-of-type {\n  margin-top: 0;\n}\n\n/* ========================================\n   4. H3 \uC18C\uC81C\uBAA9 (\uC784\uC758 \uAC1C\uC218) - \uAC00\uB3C5\uC131 \uAC1C\uC120: \uD770\uC0C9 \uBC30\uACBD, \uC5B4\uB450\uC6B4 \uAE00\uC790\n   ======================================== */\n.max-mode-article h3 {\n  font-size: 1.6rem !important;\n  margin: 36px 0 18px 0;\n  padding: 0 0 0 18px;\n  background: transparent !important;\n  border-radius: 0;\n  position: relative;\n  color: #134e4a !important;\n  font-weight: 700;\n  transition: none;\n  box-shadow: none !important;\n  border: none !important;\n  border-left: 4px solid #38bdf8 !important;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  line-height: 1.32;\n}\n\n/* h3 \uC7A5\uC2DD \uC694\uC18C \uC81C\uAC70 (\uAC00\uB3C5\uC131 \uAC1C\uC120) */\n.max-mode-article h3::before {\n  display: none !important;\n}\n\n.max-mode-article h3::after {\n  display: none !important;\n}\n\n.max-mode-article h3:hover {\n  transform: none;\n  box-shadow: none !important;\n  border-left-color: #0ea5e9 !important;\n  background: transparent !important;\n  color: #0f172a !important;\n}\n\n/* ========================================\n   5. \uBCF8\uBB38 \uCEE8\uD150\uCE20 - \uD14D\uC2A4\uD2B8 \uD06C\uAE30 3px \uC99D\uAC00\n   ======================================== */\n.max-mode-article p {\n  color: #1f2937;\n  line-height: 1.9;\n  font-size: 1.375rem !important;\n  margin: 0 0 24px 0;\n  padding: 0;\n}\n\n.max-mode-article ul,\n.max-mode-article ol {\n  color: #1f2937;\n  line-height: 1.85;\n  font-size: 1.375rem;\n  margin: 18px 0 24px 0;\n  padding-left: 30px;\n}\n\n.max-mode-article li {\n  margin-bottom: 12px;\n  padding-left: 8px;\n}\n\n.max-mode-article strong,\n.max-mode-article b {\n  color: var(--text-primary);\n  font-weight: 700;\n}\n\n/* ========================================\n   6. \uD45C/\uD14C\uC774\uBE14 \uC2A4\uD0C0\uC77C\n   ======================================== */\n.max-mode-article table {\n  width: 100%;\n  border-collapse: collapse;\n  margin: 30px 0;\n  background: #ffffff;\n  border-radius: 18px;\n  overflow: hidden;\n  border: 1px solid #dbeafe;\n}\n\n.max-mode-article thead {\n  background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%);\n}\n\n.max-mode-article th {\n  padding: 18px 22px;\n  text-align: left;\n  color: #ffffff;\n  font-weight: 700;\n  font-size: 1.375rem;\n  border-bottom: 1px solid rgba(255, 255, 255, 0.25);\n}\n\n.max-mode-article td {\n  padding: 18px 22px;\n  color: #1f2937;\n  font-size: 1.375rem;\n  border-bottom: 1px solid #e2e8f0;\n}\n\n.max-mode-article tbody tr:last-child td {\n  border-bottom: none;\n}\n\n.max-mode-article tbody tr {\n  transition: background-color 0.2s ease;\n}\n\n.max-mode-article tbody tr:hover {\n  background: rgba(14, 165, 233, 0.08);\n}\n\n/* \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uC2A4\uD0C0\uC77C */\n.max-mode-article .checklist-table td:first-child {\n  font-weight: 700;\n  color: var(--cloud-primary);\n  width: 30%;\n}\n\n.max-mode-article .checklist-table td:first-child::before {\n  content: \"\u2713 \";\n  color: var(--cloud-accent);\n  font-size: 1.3rem;\n  margin-right: 8px;\n}\n\n/* ========================================\n   7. CTA \uBC84\uD2BC (\uC790\uB3D9 \uC0DD\uC131)\n   ======================================== */\n.cta-button,\n.auto-cta,\na.cta-link {\n  display: inline-block;\n  margin: 45px 0;\n  padding: 18px 40px;\n  background: linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\n  color: white !important;\n  text-decoration: none !important;\n  font-size: 1.2rem !important;\n  font-weight: 700;\n  border-radius: 25px;\n  box-shadow: 0 10px 30px rgba(116, 185, 255, 0.4);\n  transition: all 0.4s ease;\n  text-align: center;\n  border: none;\n  cursor: pointer;\n  max-width: 280px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.cta-button:hover,\n.auto-cta:hover,\na.cta-link:hover {\n  transform: translateY(-5px) scale(1.03);\n  box-shadow: 0 15px 40px rgba(116, 185, 255, 0.5);\n  background: linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%);\n}\n\n/* CTA \uCEE8\uD14C\uC774\uB108 (\uC911\uC559 \uC815\uB82C\uC6A9) */\n.cta-container {\n  text-align: center;\n  margin: 40px 0;\n}\n\n/* ========================================\n   8. \uC804\uCCB4 \uD575\uC2EC \uC694\uC57D\uD45C (4x4 \uB610\uB294 5x5)\n   ======================================== */\n.final-summary,\n.summary-section {\n  margin: 60px 0 0 0;\n  padding: 40px 32px;\n  background: #f8fafc;\n  border-radius: 22px;\n  border: 1px solid #e2e8f0;\n  box-shadow: none;\n}\n\n.final-summary h2,\n.summary-section h2 {\n  font-size: 1.8rem;\n  margin: 0 0 32px 0;\n  padding: 0 0 12px 0;\n  background: transparent;\n  -webkit-background-clip: unset;\n  -webkit-text-fill-color: inherit;\n  background-clip: unset;\n  font-weight: 800;\n  text-align: left;\n  border-bottom: 3px solid #0ea5e9;\n}\n\n/* 4x4 \uADF8\uB9AC\uB4DC */\n.summary-grid-4x4 {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: 20px;\n}\n\n/* 5x5 \uADF8\uB9AC\uB4DC */\n.summary-grid-5x5 {\n  display: grid;\n  grid-template-columns: repeat(5, 1fr);\n  gap: 18px;\n}\n\n/* \uAE30\uBCF8 \uC694\uC57D \uADF8\uB9AC\uB4DC (\uC790\uB3D9 \uC870\uC808) */\n.summary-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 20px;\n}\n\n/* \uC694\uC57D \uC544\uC774\uD15C */\n.summary-item {\n  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(116, 185, 255, 0.12) 100%);\n  backdrop-filter: blur(10px);\n  border: 3px solid rgba(255, 255, 255, 0.9);\n  border-radius: 18px;\n  padding: 25px;\n  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);\n  box-shadow: 0 6px 20px rgba(116, 185, 255, 0.15);\n  min-height: 150px;\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n}\n\n.summary-item:hover {\n  transform: translateY(-10px) rotate(1deg);\n  box-shadow: 0 20px 50px rgba(116, 185, 255, 0.3);\n  background: linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(116, 185, 255, 0.2) 100%);\n  border-color: #74b9ff;\n}\n\n.summary-item-title {\n  font-weight: 700;\n  background: linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  background-clip: text;\n  margin: 0 0 12px 0;\n  font-size: 1.15rem;\n}\n\n.summary-item-content {\n  color: var(--text-muted);\n  margin: 0 0 15px 0;\n  line-height: 1.7;\n  font-size: 0.95rem;\n  flex-grow: 1;\n}\n\n.summary-item-link {\n  display: inline-flex;\n  align-items: center;\n  padding: 10px 18px;\n  background: linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);\n  color: white !important;\n  text-decoration: none !important;\n  font-size: 0.9rem;\n  font-weight: 600;\n  border-radius: 15px;\n  transition: all 0.3s ease;\n  box-shadow: 0 4px 15px rgba(116, 185, 255, 0.3);\n  align-self: flex-start;\n}\n\n.summary-item-link:hover {\n  transform: scale(1.05);\n  box-shadow: 0 6px 20px rgba(116, 185, 255, 0.5);\n  background: linear-gradient(135deg, #a29bfe 0%, #fd79a8 100%);\n}\n\n/* ========================================\n   9. \uBC18\uC751\uD615 \uB514\uC790\uC778\n   ======================================== */\n@media (max-width: 768px) {\n  .max-mode-article {\n    padding: 30px 20px;\n    border-radius: 20px;\n  }\n\n  .thumbnail-container {\n    margin: -30px -20px 30px -20px;\n    height: 250px;\n    border-radius: 20px;\n  }\n\n  .thumbnail-title,\n  .max-mode-article > h1:first-child {\n    font-size: 2rem;\n    padding: 30px;\n  }\n\n  .thumbnail-overlay {\n    padding: 30px;\n  }\n\n  .table-of-contents {\n    padding: 30px 25px;\n  }\n\n  .table-of-contents ul {\n    grid-template-columns: 1fr;\n  }\n\n  .max-mode-article > h2,\n  h2.main-section-title {\n    font-size: 1.8rem;\n    padding: 30px 25px;\n  }\n\n  .max-mode-article h3 {\n    font-size: 1.65rem !important; /* 3px \uC99D\uAC00 \uBC18\uC601 */\n    padding: 18px 22px;\n  }\n\n  .max-mode-article p {\n    font-size: 1.25rem !important; /* 3px \uC99D\uAC00: 20px -> 23px */\n  }\n  \n  .max-mode-article > h2,\n  h2.main-section-title,\n  .max-mode-article h2 {\n    font-size: 1.8rem !important; /* \uBAA8\uBC14\uC77C\uC5D0\uC11C\uB3C4 3px \uC99D\uAC00 \uBC18\uC601 */\n  }\n\n  .max-mode-article table {\n    font-size: 0.95rem;\n  }\n\n  .max-mode-article th,\n  .max-mode-article td {\n    padding: 12px 15px;\n  }\n\n  .cta-button,\n  .auto-cta,\n  a.cta-link {\n    padding: 12px 24px;\n    font-size: 0.9rem;\n    max-width: 200px;\n  }\n\n  .final-summary,\n  .summary-section {\n    padding: 35px 25px;\n  }\n\n  /* \uBAA8\uBC14\uC77C\uC5D0\uC11C\uB294 2\uC5F4\uB85C */\n  .summary-grid-4x4,\n  .summary-grid-5x5 {\n    grid-template-columns: repeat(2, 1fr);\n    gap: 15px;\n  }\n\n  .summary-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .summary-item {\n    padding: 20px;\n    min-height: 130px;\n  }\n\n  .summary-item-title {\n    font-size: 1.05rem;\n  }\n\n  .summary-item-content {\n    font-size: 0.9rem;\n  }\n}\n\n/* ========================================\n   10. \uCD94\uAC00 \uC720\uD2F8\uB9AC\uD2F0\n   ======================================== */\n/* \uAC15\uC870 \uBC15\uC2A4 */\n.highlight-box,\n.info-box {\n  padding: 25px 30px;\n  margin: 30px 0;\n  background: linear-gradient(135deg, rgba(116, 185, 255, 0.15) 0%, rgba(162, 155, 254, 0.1) 100%);\n  border-left: 5px solid var(--cloud-primary);\n  border-radius: 15px;\n  box-shadow: 0 5px 20px rgba(116, 185, 255, 0.1);\n}\n\n.highlight-box p:last-child,\n.info-box p:last-child {\n  margin-bottom: 0;\n}\n\n/* \uC774\uBBF8\uC9C0 \uC2A4\uD0C0\uC77C */\n.max-mode-article img {\n  max-width: 100%;\n  height: auto;\n  border-radius: 20px;\n  margin: 25px 0;\n  box-shadow: 0 10px 35px rgba(116, 185, 255, 0.2);\n  border: 3px solid rgba(255, 255, 255, 0.8);\n}\n\n/* \uC778\uC6A9\uAD6C */\n.max-mode-article blockquote {\n  margin: 30px 0;\n  padding: 25px 35px;\n  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(254, 214, 227, 0.3) 100%);\n  border-left: 5px solid var(--cloud-accent);\n  border-radius: 15px;\n  font-style: italic;\n  color: var(--text-secondary);\n  box-shadow: 0 5px 20px rgba(253, 121, 168, 0.15);\n}\n\n/* \uCF54\uB4DC \uBE14\uB85D */\n.max-mode-article code {\n  background: rgba(116, 185, 255, 0.1);\n  padding: 3px 8px;\n  border-radius: 6px;\n  font-size: 0.95em;\n  color: var(--cloud-primary);\n  font-family: 'Courier New', monospace;\n}\n\n.max-mode-article pre {\n  background: rgba(116, 185, 255, 0.08);\n  padding: 20px;\n  border-radius: 15px;\n  overflow-x: auto;\n  margin: 25px 0;\n  border: 2px solid rgba(116, 185, 255, 0.2);\n}\n\n.max-mode-article pre code {\n  background: transparent;\n  padding: 0;\n}\n</style>";
                    premiumGradientCSS = "\n<style>\n/* ===================================\n   \uD504\uB9AC\uBBF8\uC5C4 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uAE00\uB798\uC2A4\uBAA8\uD53C\uC998 \uC2A4\uD0A8\n   \uD654\uB824\uD558\uACE0 \uAE54\uB054\uD55C \uB7ED\uC154\uB9AC \uD14C\uB9C8\n   =================================== */\n\n/* \uB8E8\uD2B8 \uBCC0\uC218 */\n:root {\n  --premium-primary: #667eea;\n  --premium-secondary: #764ba2;\n  --premium-accent: #f093fb;\n  --premium-gold: #ffd700;\n  --premium-silver: #c0c0c0;\n  --premium-white: rgba(255, 255, 255, 0.95);\n  --premium-glass: rgba(255, 255, 255, 0.1);\n  --text-dark: #1a1a1a;\n  --text-light: #ffffff;\n  --shadow-premium: 0 20px 40px rgba(0, 0, 0, 0.1);\n}\n\n/* \uC804\uCCB4 \uCEE8\uD14C\uC774\uB108 */\n.premium-article {\n  max-width: 1000px;\n  margin: 0 auto;\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);\n  border-radius: 40px;\n  padding: 60px;\n  box-shadow: var(--shadow-premium);\n  position: relative;\n  overflow: hidden;\n}\n\n.premium-article::before {\n  content: '';\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  background: linear-gradient(45deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);\n  border-radius: 40px;\n  pointer-events: none;\n}\n\n/* \uB0B4\uBD80 \uCEE8\uD150\uCE20 \uB798\uD37C */\n.premium-article > * {\n  background: var(--premium-white);\n  backdrop-filter: blur(20px);\n  border-radius: 30px;\n  padding: 50px;\n  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);\n  border: 2px solid rgba(255, 255, 255, 0.2);\n  margin-bottom: 40px;\n  position: relative;\n  z-index: 1;\n}\n\n/* \uD504\uB9AC\uBBF8\uC5C4 \uCF58\uD150\uCE20 */\n.premium-content {\n  background: var(--premium-white);\n  backdrop-filter: blur(20px);\n  border-radius: 30px;\n  padding: 50px;\n  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);\n  border: 2px solid rgba(255, 255, 255, 0.2);\n  margin-bottom: 40px;\n  position: relative;\n  z-index: 1;\n}\n\n/* \uC139\uC158 \uCE74\uB4DC */\n.premium-section {\n  margin: 60px 0;\n  background: var(--premium-white) !important;\n  backdrop-filter: blur(25px);\n  border-radius: 30px !important;\n  padding: 60px !important;\n  border: 2px solid rgba(255, 255, 255, 0.3) !important;\n  box-shadow: 0 20px 50px rgba(102, 126, 234, 0.15) !important;\n  position: relative;\n  overflow: hidden;\n}\n\n.premium-section::before {\n  content: '';\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  height: 4px;\n  background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);\n}\n\n/* \uC139\uC158 \uBCF8\uBB38 */\n.premium-body {\n  color: #000000 !important;\n  line-height: 2.3;\n  font-size: 20px !important;\n  margin-bottom: 40px;\n}\n\n/* H2 \uC81C\uBAA9 \uC2A4\uD0C0\uC77C */\n.premium-body h2 {\n  font-size: 32px !important;\n  color: #ffffff !important;\n  margin: 50px 0 28px 0;\n  font-weight: 900;\n  background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 25%, #8b5cf6 50%, #ec4899 75%, #f59e0b 100%);\n  padding: 30px 42px;\n  border-radius: 26px;\n  box-shadow: \n    0 22px 65px rgba(30, 58, 138, 0.38),\n    0 10px 30px rgba(139, 92, 246, 0.32),\n    inset 0 3px 10px rgba(255, 255, 255, 0.22);\n  text-align: left;\n  position: relative;\n  overflow: hidden;\n  border: 4px solid rgba(255, 255, 255, 0.45);\n  transform: perspective(1200px) rotateX(1deg);\n  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);\n  letter-spacing: -0.3px;\n  text-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);\n}\n\n.premium-body h2:hover {\n  transform: perspective(1200px) rotateX(0deg) translateY(-6px) scale(1.025);\n  box-shadow: \n    0 28px 75px rgba(30, 58, 138, 0.48),\n    0 14px 40px rgba(139, 92, 246, 0.42),\n    inset 0 3px 12px rgba(255, 255, 255, 0.3);\n  border-color: rgba(255, 255, 255, 0.65);\n}\n\n.premium-body h2::before {\n  content: '';\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  height: 5px;\n  background: linear-gradient(90deg, #ffd700 0%, #ff6b6b 20%, #4ecdc4 40%, #45b7d1 60%, #96ceb4 80%, #ffd700 100%);\n  background-size: 200% 100%;\n  animation: shimmer 4s ease-in-out infinite;\n  box-shadow: 0 3px 12px rgba(255, 215, 0, 0.7);\n}\n\n.premium-body h2::after {\n  content: '';\n  position: absolute;\n  top: 50%;\n  right: 28px;\n  width: 90px;\n  height: 90px;\n  background: radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%);\n  border-radius: 50%;\n  transform: translateY(-50%);\n  opacity: 0.85;\n  filter: blur(12px);\n  animation: pulse 3s ease-in-out infinite;\n}\n\n@keyframes shimmer {\n  0% { background-position: -200% center; }\n  100% { background-position: 200% center; }\n}\n\n@keyframes pulse {\n  0%, 100% { \n    opacity: 0.75;\n    transform: translateY(-50%) scale(1);\n  }\n  50% { \n    opacity: 1;\n    transform: translateY(-50%) scale(1.12);\n  }\n}\n\n/* H3 \uC81C\uBAA9 \uC2A4\uD0C0\uC77C (\uB208\uC5D0 \uB35C \uB744\uAC8C, \uBC15\uC2A4 \uD6A8\uACFC \uC81C\uAC70) */\n.premium-body h3 {\n  font-size: 22px !important;\n  color: #333333 !important;\n  margin: 30px 0 15px 0;\n  font-weight: 600;\n  background: transparent !important;\n  padding: 12px 0;\n  border-radius: 0;\n  box-shadow: none !important;\n  text-align: left;\n  position: relative;\n  overflow: visible;\n  border: none !important;\n  border-bottom: 2px solid #e9ecef !important;\n  transform: none;\n  transition: none;\n  letter-spacing: -0.1px;\n  text-shadow: none;\n}\n\n.premium-body h3:hover {\n  transform: none;\n  box-shadow: none !important;\n  border-color: #dee2e6 !important;\n}\n\n/* h3 \uB0B4\uBD80 \uBC15\uC2A4 \uD6A8\uACFC \uC81C\uAC70 (::before, ::after \uC228\uAE40) */\n.premium-body h3::before {\n  display: none !important;\n}\n\n.premium-body h3::after {\n  display: none !important;\n}\n\n/* &#10022; \uBB38\uC790 \uC228\uAE40 \uCC98\uB9AC */\n.premium-body h3::after {\n  content: none !important;\n}\n\n/* &#10022; \uBB38\uC790 \uC228\uAE40 \uCC98\uB9AC (CSS\uB85C\uB294 \uC81C\uAC70 \uBD88\uAC00, JavaScript\uC5D0\uC11C \uCC98\uB9AC) */\n\n.premium-body p {\n  color: #000000 !important;\n  line-height: 2.3;\n  margin-bottom: 28px !important;\n  text-shadow: none;\n  font-weight: 500;\n  font-size: 23px !important; /* 3px \uC99D\uAC00: 20px -> 23px */\n  text-align: justify;\n  word-spacing: 0.1em;\n}\n\n.premium-body p:not(:last-child) {\n  margin-bottom: 28px !important;\n}\n\n.premium-body p:last-child {\n  margin-bottom: 0 !important;\n}\n\n/* \uBA54\uC778 \uC81C\uBAA9 */\n.premium-section-title {\n  font-size: 32px !important;\n  margin-bottom: 40px !important;\n  color: #1a1a1a !important;\n  font-weight: 900 !important;\n  letter-spacing: -1px !important;\n  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n  -webkit-background-clip: text;\n  -webkit-text-fill-color: transparent;\n  background-clip: text;\n}\n\n/* CTA \uC911\uC559 \uC815\uB82C \uC2A4\uD0C0\uC77C */\n.cta-section, .auto-cta, .premium-cta {\n  text-align: center !important;\n  margin: 40px 0 !important;\n  padding: 30px !important;\n  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;\n  border-radius: 15px !important;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;\n}\n\n.cta-button, .premium-cta-button {\n  display: inline-block !important;\n  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;\n  color: white !important;\n  padding: 14px 32px !important;\n  border-radius: 25px !important;\n  text-decoration: none !important;\n  font-weight: 700 !important;\n  font-size: 15px !important;\n  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3) !important;\n  transition: transform 0.2s !important;\n  max-width: 260px !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n  white-space: nowrap !important;\n}\n\n.cta-button:hover, .premium-cta-button:hover {\n  transform: translateY(-2px) !important;\n  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;\n}\n\n.cta-hook {\n  font-size: 18px !important;\n  color: #2c3e50 !important;\n  margin-bottom: 15px !important;\n  font-weight: 600 !important;\n}\n\n/* \uBC18\uC751\uD615 \uB514\uC790\uC778 */\n@media (max-width: 768px) {\n  .premium-article {\n    padding: 40px 25px;\n  }\n\n  .premium-article > * {\n    padding: 30px;\n  }\n\n  .premium-section {\n    padding: 40px !important;\n  }\n\n  .premium-section-title {\n    font-size: 2.2rem;\n  }\n}\n</style>";
                    adsenseCleanCSS = "<style>/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n   \uC560\uB4DC\uC13C\uC2A4 \uC2B9\uC778 \uC804\uC6A9 CSS \u2014 Clean Mode\n   CTA, \uBC30\uB108, \uC560\uB2C8\uBA54\uC774\uC158 \uC804\uBD80 \uC81C\uAC70\n   \uCF58\uD150\uCE20 \uAC00\uB3C5\uC131\uACFC \uC804\uBB38\uC131\uC5D0 \uC9D1\uC911\n   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */\n\n/* \uBCF8\uBB38 \uAE30\uBCF8 */\n.post-body, .entry-content {\n  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;\n  font-size: 16.5px;\n  line-height: 1.85;\n  color: #1a1a1a;\n  word-break: keep-all;\n  overflow-wrap: break-word;\n}\n\n/* \uC81C\uBAA9 \uAD6C\uC870 */\n.post-body h2, .entry-content h2 {\n  font-size: 24px;\n  font-weight: 700;\n  color: #111827;\n  margin: 48px 0 20px;\n  padding-bottom: 12px;\n  border-bottom: 2px solid #e5e7eb;\n  line-height: 1.4;\n}\n\n.post-body h3, .entry-content h3 {\n  font-size: 20px;\n  font-weight: 600;\n  color: #1f2937;\n  margin: 36px 0 16px;\n  padding-left: 14px;\n  border-left: 4px solid #3b82f6;\n  line-height: 1.4;\n}\n\n/* \uBB38\uB2E8 */\n.post-body p, .entry-content p {\n  margin: 0 0 18px;\n  text-align: justify;\n}\n\n/* \uC778\uC6A9 \uBE14\uB85D */\n.post-body blockquote, .entry-content blockquote {\n  margin: 24px 0;\n  padding: 20px 24px;\n  background-color: #f9fafb;\n  border-left: 4px solid #6b7280;\n  border-radius: 0 8px 8px 0;\n  font-style: normal;\n  color: #374151;\n}\n\n/* \uB9AC\uC2A4\uD2B8 */\n.post-body ul, .post-body ol,\n.entry-content ul, .entry-content ol {\n  margin: 16px 0;\n  padding-left: 24px;\n}\n\n.post-body li, .entry-content li {\n  margin-bottom: 8px;\n  line-height: 1.7;\n}\n\n/* \uBE44\uAD50 \uBD84\uC11D \uD45C */\n.post-body table, .entry-content table {\n  width: 100%;\n  border-collapse: collapse;\n  margin: 24px 0;\n  font-size: 15px;\n}\n\n.post-body th, .entry-content th {\n  background-color: #f3f4f6;\n  color: #111827;\n  font-weight: 600;\n  padding: 14px 16px;\n  text-align: left;\n  border: 1px solid #d1d5db;\n}\n\n.post-body td, .entry-content td {\n  padding: 12px 16px;\n  border: 1px solid #e5e7eb;\n  vertical-align: top;\n}\n\n.post-body tr:nth-child(even) td,\n.entry-content tr:nth-child(even) td {\n  background-color: #f9fafb;\n}\n\n/* FAQ \uC139\uC158 */\n.faq-item {\n  margin-bottom: 16px;\n  padding: 16px 20px;\n  background: #f9fafb;\n  border-radius: 8px;\n  border: 1px solid #e5e7eb;\n}\n\n.faq-item h3 {\n  font-size: 17px;\n  font-weight: 600;\n  color: #1f2937;\n  margin: 0 0 8px;\n  padding-left: 0;\n  border-left: none;\n}\n\n.faq-item p {\n  margin: 0;\n  color: #4b5563;\n  font-size: 15px;\n}\n\n/* \uC791\uC131\uC790 \uC815\uBCF4 */\n.author-info {\n  display: flex;\n  align-items: center;\n  gap: 16px;\n  padding: 20px;\n  background: #f0f9ff;\n  border-radius: 12px;\n  margin-bottom: 32px;\n  border: 1px solid #bae6fd;\n}\n\n.author-info img {\n  width: 56px;\n  height: 56px;\n  border-radius: 50%;\n  object-fit: cover;\n}\n\n/* \uD575\uC2EC \uC815\uBCF4 \uBC15\uC2A4 */\n.info-box {\n  margin: 24px 0;\n  padding: 20px 24px;\n  background: #eff6ff;\n  border-radius: 10px;\n  border: 1px solid #bfdbfe;\n}\n\n.info-box p {\n  margin: 4px 0;\n}\n\n/* \uC774\uBBF8\uC9C0 */\n.post-body img, .entry-content img {\n  max-width: 100%;\n  height: auto;\n  border-radius: 8px;\n  margin: 20px 0;\n}\n\n/* \uB9C1\uD06C */\n.post-body a, .entry-content a {\n  color: #2563eb;\n  text-decoration: none;\n  border-bottom: 1px solid transparent;\n  transition: border-color 0.2s;\n}\n\n.post-body a:hover, .entry-content a:hover {\n  border-bottom-color: #2563eb;\n}\n\n/* \u2550\u2550\u2550 \uBAA8\uBC14\uC77C \uBC18\uC751\uD615 \u2550\u2550\u2550 */\n@media (max-width: 768px) {\n  .post-body, .entry-content {\n    font-size: 15.5px;\n    line-height: 1.75;\n  }\n\n  .post-body h2, .entry-content h2 {\n    font-size: 21px;\n    margin: 36px 0 16px;\n  }\n\n  .post-body h3, .entry-content h3 {\n    font-size: 18px;\n    margin: 28px 0 12px;\n  }\n\n  .post-body table, .entry-content table {\n    font-size: 13.5px;\n  }\n\n  .post-body th, .post-body td,\n  .entry-content th, .entry-content td {\n    padding: 10px 12px;\n  }\n\n  .author-info {\n    flex-direction: column;\n    text-align: center;\n  }\n}\n\n/* \u2550\u2550\u2550 CTA/\uBC30\uB108/\uAD11\uACE0 \uAD00\uB828 CSS \uAC15\uC81C \uC81C\uAC70 \u2550\u2550\u2550 */\n.cta-btn, .cta-banner, .cta-box, .cta-wrapper,\n.ad-safe-zone, .ad-placeholder, .ad-container,\n.revenue-box, .affiliate-link, .sponsored-box {\n  display: none !important;\n}\n\n/* \uD384\uC2A4/\uBC14\uC6B4\uC2A4/\uC2A4\uD540 \uC560\uB2C8\uBA54\uC774\uC158 \uAC15\uC81C \uBE44\uD65C\uC131\uD654 */\n@keyframes ctaPulse { from {} to {} }\n@keyframes premiumPulse { from {} to {} }\n@keyframes bounce { from {} to {} }\n@keyframes spin { from {} to {} }\n@keyframes slideIn { from {} to {} }\n@keyframes fadeInUp { from {} to {} }\n@keyframes fadeFloat { from {} to {} }</style>";
                    selectedCSS = isAdsenseMode ? adsenseCleanCSS : (isWordPress ? premiumGradientCSS : cloudSkinCSS);
                    fullHtml = "".concat(selectedCSS, "<div class=\"").concat(articleClass, "\">\n  ").concat(contentHtml, "\n  ").concat(disclaimerHtml, "\n</div>").trim();
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 70% - HTML 구조 생성 중');
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 80% - 최종 검토 및 최적화');
                    console.log("\u2705 \uC804\uCCB4 \uAE00 \uC0DD\uC131 \uC644\uB8CC (".concat(fullHtml.length, "\uC790)"));
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 90% - 글 생성 완료');
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 \uCD5C\uC885 \uC81C\uBAA9: ".concat(seoTitle));
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 \uCD5C\uC885 \uAE00\uC790\uC218: ".concat(fullHtml.length, "\uC790"));
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PROGRESS] 100% - 모든 작업 완료');
                    return [2 /*return*/, { html: fullHtml, title: seoTitle }];
            }
        });
    });
}
// 텍스트 썸네일 생성 함수 (이미지 예시대로: 흰색 카드, 주황색 테두리, 검은색 텍스트)
function generateTextThumbnail(title, topic) {
    // 🔧 제목 정제: CTA 문구 제거 및 길이 제한
    var cleanTitle = title.trim();
    // 불필요한 문구 제거 (CTA, 설명 등)
    cleanTitle = cleanTitle
        .replace(/,\s*지금\s*참여하세요/gi, '')
        .replace(/,\s*바로\s*확인하기/gi, '')
        .replace(/,\s*지금\s*바로/gi, '')
        .replace(/지금\s*참여하세요/gi, '')
        .replace(/바로\s*확인하기/gi, '')
        .replace(/지금\s*바로/gi, '')
        .trim();
    // 쉼표나 마침표 이후의 문구 제거
    var titleMatch = cleanTitle.match(/^[^,\.!?]+/);
    if (titleMatch && titleMatch[0]) {
        cleanTitle = titleMatch[0].trim();
    }
    // 제목을 20자 이내로 제한 (썸네일 텍스트가 잘 보이도록)
    if (cleanTitle.length > 20) {
        // 자연스러운 위치에서 자르기 (공백 기준)
        var words = cleanTitle.substring(0, 20).split(/\s+/);
        if (words.length > 1) {
            words.pop(); // 마지막 단어 제거
            cleanTitle = words.join(' ').trim();
        }
        else {
            cleanTitle = cleanTitle.substring(0, 17) + '...';
        }
    }
    // 제목이 비어있거나 너무 짧으면 topic 사용
    if (cleanTitle.length < 3) {
        cleanTitle = topic.length > 20 ? topic.substring(0, 17) + '...' : topic;
    }
    // 폰트 크기 계산 (제목 길이에 따라 조정)
    var titleLength = cleanTitle.length;
    var titleFontSize = 90;
    if (titleLength > 15) {
        titleFontSize = Math.max(70, 1200 / titleLength);
    }
    else if (titleLength > 10) {
        titleFontSize = 80;
    }
    else {
        titleFontSize = 90;
    }
    // 텍스트 이스케이프 함수
    var escapeXml = function (str) {
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };
    return "\n<svg width=\"1200\" height=\"630\" xmlns=\"http://www.w3.org/2000/svg\">\n  <defs>\n    <!-- \uC8FC\uD669\uC0C9 \uD14C\uB450\uB9AC -->\n    <linearGradient id=\"orangeBorder\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" style=\"stop-color:#f97316;stop-opacity:1\" />\n      <stop offset=\"50%\" style=\"stop-color:#ea580c;stop-opacity:1\" />\n      <stop offset=\"100%\" style=\"stop-color:#dc2626;stop-opacity:1\" />\n    </linearGradient>\n    <!-- \uD14D\uC2A4\uD2B8 \uADF8\uB9BC\uC790 -->\n    <filter id=\"textShadow\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\">\n      <feDropShadow dx=\"2\" dy=\"2\" stdDeviation=\"4\" flood-color=\"#000000\" flood-opacity=\"0.15\"/>\n    </filter>\n  </defs>\n  \n  <!-- \uD68C\uC0C9 \uBC30\uACBD -->\n  <rect width=\"1200\" height=\"630\" fill=\"#f5f5f5\"/>\n  \n  <!-- \uD770\uC0C9 \uCE74\uB4DC (\uC8FC\uD669\uC0C9 \uD14C\uB450\uB9AC \uD3EC\uD568) -->\n  <rect x=\"150\" y=\"90\" width=\"900\" height=\"450\" fill=\"#ffffff\" stroke=\"url(#orangeBorder)\" stroke-width=\"8\" rx=\"16\" ry=\"16\"/>\n  \n  <!-- \uCE74\uB4DC \uB0B4\uBD80 \uADF8\uB9BC\uC790 \uD6A8\uACFC -->\n  <rect x=\"150\" y=\"90\" width=\"900\" height=\"450\" fill=\"none\" stroke=\"rgba(0,0,0,0.1)\" stroke-width=\"1\" rx=\"16\" ry=\"16\"/>\n  \n  <!-- \uC81C\uBAA9 \uD14D\uC2A4\uD2B8 (\uAC80\uC740\uC0C9, \uC911\uC559 \uC815\uB82C) -->\n  <text x=\"600\" y=\"315\" font-family=\"'Noto Sans KR', 'Malgun Gothic', sans-serif\" \n        font-size=\"".concat(titleFontSize, "\" font-weight=\"900\" \n        text-anchor=\"middle\" fill=\"#1a1a1a\" dominant-baseline=\"middle\" \n        filter=\"url(#textShadow)\" letter-spacing=\"-1\">\n    ").concat(escapeXml(cleanTitle), "\n  </text>\n</svg>");
}
// 🔧 텍스트 유사도 계산 함수 (중복 검사용)
function calculateSimilarity(str1, str2) {
    if (str1 === str2)
        return 1.0;
    if (str1.length === 0 || str2.length === 0)
        return 0.0;
    // 간단한 레벤슈타인 거리 기반 유사도 계산
    var longer = str1.length > str2.length ? str1 : str2;
    var shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0)
        return 1.0;
    var distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
}
// 🔧 레벤슈타인 거리 계산 함수
function levenshteinDistance(str1, str2) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var matrix = [];
    for (var i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (var j = 0; j <= str1.length; j++) {
        if (matrix[0]) {
            matrix[0][j] = j;
        }
    }
    for (var i = 1; i <= str2.length; i++) {
        for (var j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(((_b = (_a = matrix[i - 1]) === null || _a === void 0 ? void 0 : _a[j - 1]) !== null && _b !== void 0 ? _b : Infinity) + 1, // substitution
                    ((_d = (_c = matrix[i]) === null || _c === void 0 ? void 0 : _c[j - 1]) !== null && _d !== void 0 ? _d : Infinity) + 1, // insertion
                    ((_f = (_e = matrix[i - 1]) === null || _e === void 0 ? void 0 : _e[j]) !== null && _f !== void 0 ? _f : Infinity) + 1 // deletion
                );
            }
        }
    }
    return (_h = (_g = matrix[str2.length]) === null || _g === void 0 ? void 0 : _g[str1.length]) !== null && _h !== void 0 ? _h : 0;
}
var KOREAN_STOPWORDS = [
    '소개', '가이드', '방법', '정리', '핵심', '필수', '체크리스트', '전략', '팁', '사례', '활용', '이점',
    '노하우', '비밀', '계획', '준비', '확인', '완벽', '최종', '총정리', '기초', '기본', '개요', '이해',
    '활용법', '선택', '가치', '중요성', '단계', '포인트', '전문가', '상세', '요약', '분석', '해설'
];
function sanitizeToken(token) {
    return token
        .replace(/[\p{P}\p{S}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function splitToCandidateTokens(text) {
    return sanitizeToken(text)
        .split(/\s+/)
        .map(function (t) { return t.trim(); })
        .filter(function (t) { return t.length > 1; });
}
function isKoreanStopword(token) {
    return KOREAN_STOPWORDS.includes(token);
}
function collectPayloadKeywords(payload) {
    var collected = [];
    if (Array.isArray(payload.keywords)) {
        payload.keywords.forEach(function (k) {
            if (typeof k === 'string') {
                collected.push.apply(collected, splitToCandidateTokens(k));
            }
        });
    }
    else if (typeof payload.keywords === 'string') {
        collected.push.apply(collected, splitToCandidateTokens(payload.keywords));
    }
    return collected;
}
function extractSectionKeywords(sectionTitle, payload) {
    var cacheKey = "".concat(sectionTitle, "::").concat(Array.isArray(payload.keywords) ? payload.keywords.join('|') : payload.keywords || '');
    if (keywordCache.has(cacheKey)) {
        return keywordCache.get(cacheKey);
    }
    var candidates = new Set();
    splitToCandidateTokens(sectionTitle).forEach(function (token) {
        if (!isKoreanStopword(token)) {
            candidates.add(token);
        }
    });
    collectPayloadKeywords(payload).forEach(function (token) {
        if (!isKoreanStopword(token)) {
            candidates.add(token);
        }
    });
    var result = Array.from(candidates)
        .filter(Boolean)
        .slice(0, 6);
    keywordCache.set(cacheKey, result);
    return result;
}
function isLikelyEnglish(text) {
    if (!text)
        return false;
    return /^[\p{ASCII}]+$/u.test(text);
}
function translateKeywordToEnglish(keyword) {
    return __awaiter(this, void 0, void 0, function () {
        var trimmed, url, response, data, translated, error_12;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    trimmed = keyword.trim();
                    if (!trimmed)
                        return [2 /*return*/, ''];
                    if (isLikelyEnglish(trimmed))
                        return [2 /*return*/, trimmed];
                    if (translationCache.has(trimmed)) {
                        return [2 /*return*/, translationCache.get(trimmed)];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, , 5]);
                    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=".concat(encodeURIComponent(trimmed));
                    return [4 /*yield*/, fetch(url)];
                case 2:
                    response = _c.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _c.sent();
                    translated = (((_b = (_a = data === null || data === void 0 ? void 0 : data[0]) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b[0]) || '').toString().trim();
                    if (translated) {
                        translationCache.set(trimmed, translated);
                        return [2 /*return*/, translated];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_12 = _c.sent();
                    console.log("\u26A0\uFE0F [H2 IMAGE] \uD0A4\uC6CC\uB4DC \uBC88\uC5ED \uC2E4\uD328 (".concat(trimmed, "):"), error_12.message);
                    return [3 /*break*/, 5];
                case 5:
                    translationCache.set(trimmed, trimmed);
                    return [2 /*return*/, trimmed];
            }
        });
    });
}
function translateKeywordsToEnglish(keywords) {
    return __awaiter(this, void 0, void 0, function () {
        var translations;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!keywords || keywords.length === 0)
                        return [2 /*return*/, []];
                    return [4 /*yield*/, Promise.all(keywords.map(translateKeywordToEnglish))];
                case 1:
                    translations = _a.sent();
                    return [2 /*return*/, translations
                        .map(function (t) { return t.trim(); })
                        .filter(Boolean)
                        .map(function (t) { return t.replace(/["']/g, ''); })];
            }
        });
    });
}
function slugifyForFile(text) {
    if (!text)
        return 'image';
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 80) || 'image';
}
function ensureImageDirectory() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.promises.mkdir(IMAGE_DOWNLOAD_DIR, { recursive: true })];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    _a = _b.sent();
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function downloadImageLocally(imageUrl, prefix) {
    return __awaiter(this, void 0, void 0, function () {
        var response, arrayBuffer, buffer, parsedUrl, extMatch, extension, unique, fileName, filePath, error_13;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!imageUrl)
                        return [2 /*return*/, null];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    return [4 /*yield*/, ensureImageDirectory()];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, fetch(imageUrl)];
                case 3:
                    response = _a.sent();
                    if (!response.ok)
                        throw new Error("HTTP ".concat(response.status));
                    return [4 /*yield*/, response.arrayBuffer()];
                case 4:
                    arrayBuffer = _a.sent();
                    buffer = Buffer.from(arrayBuffer);
                    parsedUrl = new URL(imageUrl);
                    extMatch = parsedUrl.pathname.match(/\.(jpg|jpeg|png|webp)$/i);
                    extension = extMatch ? extMatch[0] : '.jpg';
                    unique = (0, crypto_1.randomBytes)(8).toString('hex');
                    fileName = "".concat(prefix, "-").concat(unique).concat(extension);
                    filePath = path.join(IMAGE_DOWNLOAD_DIR, fileName);
                    return [4 /*yield*/, fs_1.promises.writeFile(filePath, buffer)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, filePath];
                case 6:
                    error_13 = _a.sent();
                    console.log("\u26A0\uFE0F [H2 IMAGE] \uC774\uBBF8\uC9C0 \uB2E4\uC6B4\uB85C\uB4DC \uC2E4\uD328 (".concat(imageUrl, "):"), error_13.message);
                    return [2 /*return*/, null];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function buildDallePrompt(keywords, fallbackTitle) {
    var subject = keywords.length > 0 ? keywords.join(', ') : fallbackTitle;
    return "High quality professional photo of ".concat(subject, ", 4K, commercial use, clean background");
}
function buildSearchQuery(keywords, fallbackTitle) {
    var joined = keywords.join(' ').trim();
    return joined || fallbackTitle;
}
// H2 이미지 생성 함수
function generateH2Image(sectionTitle, source, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var coreKeywords, englishKeywords, fallbackTitle, promptKeywords, dallePrompt, searchQuery_1, topicEn, _a, apiKey, openai, enhancedPrompt, response, savedPath, error_14, pexelsUrl, savedPath, pexelsUrl, savedPath, safeCSERequest, cacheKey, data, savedPath, error_15, apiKey, openai, response, dalleUrl, savedPath, error_16, pexelsUrl, savedPath, safeCSERequest, cacheKey, data, savedPath, error_17, error_18;
        var _this = this;
        var _b, _c, _d, _e, _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    _j.trys.push([0, 44, , 45]);
                    console.log("\uD83D\uDDBC\uFE0F [H2 IMAGE] ".concat(source, " \uC18C\uC2A4\uB85C \uC774\uBBF8\uC9C0 \uC0DD\uC131: ").concat(sectionTitle));
                    coreKeywords = extractSectionKeywords(sectionTitle, payload);
                    return [4 /*yield*/, translateKeywordsToEnglish(coreKeywords)];
                case 1:
                    englishKeywords = _j.sent();
                    if (coreKeywords.length) {
                        console.log("\uD83D\uDDBC\uFE0F [H2 IMAGE] \uD575\uC2EC \uD0A4\uC6CC\uB4DC: ".concat(coreKeywords.join(', ')));
                    }
                    if (englishKeywords.length) {
                        console.log("\uD83D\uDDBC\uFE0F [H2 IMAGE] \uC601\uC5B4 \uD0A4\uC6CC\uB4DC: ".concat(englishKeywords.join(', ')));
                    }
                    fallbackTitle = sectionTitle.replace(/<[^>]*>/g, '').trim();
                    promptKeywords = englishKeywords.length > 0 ? englishKeywords : coreKeywords;
                    dallePrompt = buildDallePrompt(promptKeywords, fallbackTitle);
                    searchQuery_1 = buildSearchQuery(promptKeywords, fallbackTitle);
                    if (!payload.topic) return [3 /*break*/, 3];
                    return [4 /*yield*/, translateKeywordToEnglish(payload.topic)];
                case 2:
                    topicEn = _j.sent();
                    if (topicEn && !searchQuery_1.toLowerCase().includes(topicEn.toLowerCase())) {
                        searchQuery_1 = "".concat(searchQuery_1, " ").concat(topicEn).trim();
                    }
                    _j.label = 3;
                case 3:
                    _a = source;
                    switch (_a) {
                        case 'dalle': return [3 /*break*/, 4];
                        case 'pexels': return [3 /*break*/, 14];
                        case 'cse': return [3 /*break*/, 18];
                    }
                    return [3 /*break*/, 26];
                case 4:
                    if (!(payload.dalleApiKey || payload.openaiKey)) return [3 /*break*/, 10];
                    apiKey = payload.dalleApiKey || payload.openaiKey;
                    openai = new openai_1.default({ apiKey: apiKey });
                    enhancedPrompt = dallePrompt;
                    _j.label = 5;
                case 5:
                    _j.trys.push([5, 9, , 10]);
                    return [4 /*yield*/, openai.images.generate({
                        model: "dall-e-3",
                        prompt: enhancedPrompt,
                        size: "1024x1024",
                        quality: "standard",
                        n: 1,
                    })];
                case 6:
                    response = _j.sent();
                    if (!(response.data && response.data[0] && response.data[0].url)) return [3 /*break*/, 8];
                    console.log("\u2705 [H2 IMAGE] DALL-E \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC131\uACF5: ".concat(response.data[0].url));
                    return [4 /*yield*/, downloadImageLocally(response.data[0].url, "dalle-".concat(slugifyForFile(fallbackTitle)))];
                case 7:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, response.data[0].url];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_14 = _j.sent();
                    console.log("\u274C [H2 IMAGE] DALL-E \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC2E4\uD328:", error_14);
                    return [3 /*break*/, 10];
                case 10:
                    if (!payload.pexelsApiKey) return [3 /*break*/, 13];
                    return [4 /*yield*/, fetchPexelsImage(searchQuery_1, payload.pexelsApiKey)];
                case 11:
                    pexelsUrl = _j.sent();
                    if (!pexelsUrl) return [3 /*break*/, 13];
                    return [4 /*yield*/, downloadImageLocally(pexelsUrl, "pexels-".concat(slugifyForFile(fallbackTitle)))];
                case 12:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, pexelsUrl];
                case 13: return [3 /*break*/, 43];
                case 14:
                    if (!payload.pexelsApiKey) return [3 /*break*/, 17];
                    return [4 /*yield*/, fetchPexelsImage(searchQuery_1, payload.pexelsApiKey)];
                case 15:
                    pexelsUrl = _j.sent();
                    if (!pexelsUrl) return [3 /*break*/, 17];
                    return [4 /*yield*/, downloadImageLocally(pexelsUrl, "pexels-".concat(slugifyForFile(fallbackTitle)))];
                case 16:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, pexelsUrl];
                case 17: return [3 /*break*/, 43];
                case 18:
                    if (!(payload.googleCseKey && payload.googleCseCx)) return [3 /*break*/, 25];
                    _j.label = 19;
                case 19:
                    _j.trys.push([19, 24, , 25]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/google-cse-rate-limiter'); })];
                case 20:
                    safeCSERequest = (_j.sent()).safeCSERequest;
                    cacheKey = "h2-image:".concat(searchQuery_1);
                    return [4 /*yield*/, safeCSERequest(searchQuery_1, function () {
                        return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch("https://www.googleapis.com/customsearch/v1?key=".concat(payload.googleCseKey, "&cx=").concat(payload.googleCseCx, "&q=").concat(encodeURIComponent(searchQuery_1), "&searchType=image&num=1"))];
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
                    }, { useCache: true, cacheKey: cacheKey, priority: 'low' })];
                case 21:
                    data = _j.sent();
                    if (!((data === null || data === void 0 ? void 0 : data.items) && data.items.length > 0 && data.items[0] && data.items[0].link)) return [3 /*break*/, 23];
                    return [4 /*yield*/, downloadImageLocally(data.items[0].link, "cse-".concat(slugifyForFile(fallbackTitle)))];
                case 22:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, data.items[0].link];
                case 23: return [3 /*break*/, 25];
                case 24:
                    error_15 = _j.sent();
                    // Rate Limit 오류는 조용히 처리
                    if (!((_b = error_15 === null || error_15 === void 0 ? void 0 : error_15.message) === null || _b === void 0 ? void 0 : _b.includes('Rate Limit')) && !((_c = error_15 === null || error_15 === void 0 ? void 0 : error_15.message) === null || _c === void 0 ? void 0 : _c.includes('할당량'))) {
                        console.log("\u274C [H2 IMAGE] CSE \uC774\uBBF8\uC9C0 \uAC80\uC0C9 \uC2E4\uD328: ".concat(error_15.message));
                    }
                    return [3 /*break*/, 25];
                case 25: return [3 /*break*/, 43];
                case 26:
                    if (!(payload.dalleApiKey || payload.openaiKey)) return [3 /*break*/, 32];
                    apiKey = payload.dalleApiKey || payload.openaiKey;
                    openai = new openai_1.default({ apiKey: apiKey });
                    _j.label = 27;
                case 27:
                    _j.trys.push([27, 31, , 32]);
                    return [4 /*yield*/, openai.images.generate({
                        model: "dall-e-3",
                        prompt: dallePrompt,
                        size: "1024x1024",
                        quality: "standard",
                        n: 1,
                    })];
                case 28:
                    response = _j.sent();
                    dalleUrl = (_e = (_d = response.data) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.url;
                    if (!dalleUrl) return [3 /*break*/, 30];
                    console.log("\u2705 [H2 IMAGE] DALL-E \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC131\uACF5: ".concat(dalleUrl));
                    return [4 /*yield*/, downloadImageLocally(dalleUrl, "dalle-".concat(slugifyForFile(fallbackTitle)))];
                case 29:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, dalleUrl];
                case 30: return [3 /*break*/, 32];
                case 31:
                    error_16 = _j.sent();
                    console.log("\u274C [H2 IMAGE] DALL-E \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC2E4\uD328:", error_16);
                    return [3 /*break*/, 32];
                case 32:
                    if (!payload.pexelsApiKey) return [3 /*break*/, 35];
                    return [4 /*yield*/, fetchPexelsImage(searchQuery_1, payload.pexelsApiKey)];
                case 33:
                    pexelsUrl = _j.sent();
                    if (!pexelsUrl) return [3 /*break*/, 35];
                    return [4 /*yield*/, downloadImageLocally(pexelsUrl, "pexels-".concat(slugifyForFile(fallbackTitle)))];
                case 34:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, pexelsUrl];
                case 35:
                    if (!(payload.googleCseKey && payload.googleCseCx)) return [3 /*break*/, 42];
                    _j.label = 36;
                case 36:
                    _j.trys.push([36, 41, , 42]);
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/google-cse-rate-limiter'); })];
                case 37:
                    safeCSERequest = (_j.sent()).safeCSERequest;
                    cacheKey = "h2-image:".concat(searchQuery_1);
                    return [4 /*yield*/, safeCSERequest(searchQuery_1, function () {
                        return __awaiter(_this, void 0, void 0, function () {
                            var response;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, fetch("https://www.googleapis.com/customsearch/v1?key=".concat(payload.googleCseKey, "&cx=").concat(payload.googleCseCx, "&q=").concat(encodeURIComponent(searchQuery_1), "&searchType=image&num=1"))];
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
                    }, { useCache: true, cacheKey: cacheKey, priority: 'low' })];
                case 38:
                    data = _j.sent();
                    if (!((data === null || data === void 0 ? void 0 : data.items) && data.items.length > 0 && ((_f = data.items[0]) === null || _f === void 0 ? void 0 : _f.link))) return [3 /*break*/, 40];
                    return [4 /*yield*/, downloadImageLocally(data.items[0].link, "cse-".concat(slugifyForFile(fallbackTitle)))];
                case 39:
                    savedPath = _j.sent();
                    if (savedPath) {
                        console.log("\uD83D\uDCBE [H2 IMAGE] \uB85C\uCEEC \uC800\uC7A5 \uACBD\uB85C: ".concat(savedPath));
                    }
                    return [2 /*return*/, data.items[0].link];
                case 40: return [3 /*break*/, 42];
                case 41:
                    error_17 = _j.sent();
                    if (!((_g = error_17 === null || error_17 === void 0 ? void 0 : error_17.message) === null || _g === void 0 ? void 0 : _g.includes('Rate Limit')) && !((_h = error_17 === null || error_17 === void 0 ? void 0 : error_17.message) === null || _h === void 0 ? void 0 : _h.includes('할당량'))) {
                        console.log("\u274C [H2 IMAGE] CSE \uC774\uBBF8\uC9C0 \uAC80\uC0C9 \uC2E4\uD328: ".concat(error_17.message));
                    }
                    return [3 /*break*/, 42];
                case 42: return [3 /*break*/, 43];
                case 43: return [2 /*return*/, ''];
                case 44:
                    error_18 = _j.sent();
                    console.log("\u274C [H2 IMAGE] ".concat(source, " \uC774\uBBF8\uC9C0 \uC0DD\uC131 \uC2E4\uD328:"), error_18);
                    return [2 /*return*/, ''];
                case 45: return [2 /*return*/];
            }
        });
    });
}
function fetchPexelsImage(searchQuery, apiKey) {
    return __awaiter(this, void 0, void 0, function () {
        var response, data, selected, src, url, error_19;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!searchQuery.trim())
                        return [2 /*return*/, null];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, fetch("https://api.pexels.com/v1/search?query=".concat(encodeURIComponent(searchQuery), "&per_page=5&orientation=landscape"), {
                        headers: { 'Authorization': apiKey }
                    })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("HTTP ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    if (data.photos && data.photos.length > 0) {
                        selected = data.photos[0];
                        src = selected === null || selected === void 0 ? void 0 : selected.src;
                        url = (src === null || src === void 0 ? void 0 : src.landscape) || (src === null || src === void 0 ? void 0 : src.large2x) || (src === null || src === void 0 ? void 0 : src.large) || (src === null || src === void 0 ? void 0 : src.medium) || (src === null || src === void 0 ? void 0 : src.original) || '';
                        return [2 /*return*/, url || null];
                    }
                    return [3 /*break*/, 5];
                case 4:
                    error_19 = _a.sent();
                    console.log("\u274C [H2 IMAGE] Pexels \uC774\uBBF8\uC9C0 \uAC80\uC0C9 \uC2E4\uD328:", error_19.message);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/, null];
            }
        });
    });
}
// 목차 생성 함수
function generateTableOfContentsLocal(sections, isWordPress) {
    if (isWordPress === void 0) { isWordPress = false; }
    if (!sections || sections.length === 0)
        return '';
    var items = sections.map(function (section, index) {
        var anchor = "section-".concat(index + 1);
        return "<li><a href=\"#".concat(anchor, "\">").concat(section, "</a></li>");
    }).join('\n');
    return "<div class=\"table-of-contents\">\n  <h2>\uBAA9\uCC28</h2>\n  <ul>\n    ".concat(items, "\n  </ul>\n</div>");
}
// 핵심 요약표 생성 함수 (관련링크 포함)
function generateCoreSummaryTableLocal(topic, keywords, sectionTitles, sectionContents) {
    if (!sectionTitles || sectionTitles.length === 0)
        return '';
    var normalizeText = function (html) {
        if (!html)
            return '';
        return html
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };
    var extractSummary = function (text) {
        if (!text)
            return '핵심 정보를 준비 중입니다.';
        var sentenceMatch = text.match(/[^.!?。]*?(다\.|요\.|습니다\.|이다\.|[.!?。])/);
        var summary = sentenceMatch ? sentenceMatch[0] : text.slice(0, 120);
        summary = summary.replace(/\*\*/g, '').trim();
        if (summary.length > 140) {
            summary = summary.slice(0, 137).trimEnd() + '...';
        }
        return summary || '핵심 정보를 준비 중입니다.';
    };
    var rows = sectionTitles.map(function (section, index) {
        // 실제 섹션 ID 매칭: s1, s2, s3... 형식 사용
        var sectionId = "s".concat(index + 1);
        var relatedLink = "#".concat(sectionId);
        var rawContent = sectionContents[index] || '';
        var textContent = normalizeText(rawContent);
        var summary = extractSummary(textContent);
        // 외부 링크로 바로가기 (새 창에서 열림)
        return "<tr>\n      <td>".concat(index + 1, "</td>\n      <td>").concat(section, "</td>\n      <td>").concat(summary, "</td>\n      <td><a href=\"").concat(relatedLink, "\" onclick=\"document.querySelector('h2[id=\\'").concat(sectionId, "\\']')?.scrollIntoView({behavior:'smooth',block:'start'}); return false;\" style=\"color: #74b9ff; text-decoration: none; font-weight: 600; cursor: pointer;\">\uC790\uC138\uD788 \uBCF4\uAE30 \u2192</a></td>\n    </tr>");
    }).join('\n');
    return "<div class=\"final-summary\">\n  <h2>\uD575\uC2EC \uC694\uC57D</h2>\n  <table>\n    <thead>\n      <tr>\n        <th>\uBC88\uD638</th>\n        <th>\uD56D\uBAA9</th>\n        <th>\uB0B4\uC6A9</th>\n        <th>\uAD00\uB828\uB9C1\uD06C</th>\n      </tr>\n    </thead>\n    <tbody>\n      ".concat(rows, "\n    </tbody>\n  </table>\n</div>");
}
// runPost 함수 추가 (기본 구현)
function runPost(payload, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        var isPreviewOnly, env, article, html, generatedTitle, platform, publishResult, publishToWordPress, categories, wpCats, catIds, wpResult, error_20;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 8, , 9]);
                    onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] 포스팅 시작...');
                    isPreviewOnly = payload.previewOnly === true || payload.platform === 'preview';
                    if (isPreviewOnly) {
                        onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] 미리보기 모드 - 발행하지 않음');
                    }
                    env = {
                        contentMode: payload.contentMode || 'external',
                        postingMode: payload.postingMode || 'immediate'
                    };
                    return [4 /*yield*/, generateMaxModeArticle(payload, env, onLog)];
                case 1:
                    article = _a.sent();
                    html = (article === null || article === void 0 ? void 0 : article.html) || '';
                    generatedTitle = (article === null || article === void 0 ? void 0 : article.title) || payload.topic;
                    onLog === null || onLog === void 0 ? void 0 : onLog("[RUNPOST] \uC0DD\uC131\uB41C \uC81C\uBAA9: ".concat(generatedTitle));
                    // 미리보기 모드면 HTML만 반환
                    if (isPreviewOnly) {
                        onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] 미리보기 생성 완료');
                        return [2 /*return*/, {
                            ok: true,
                            html: html,
                            title: generatedTitle,
                            preview: true
                        }];
                    }
                    // 실제 발행 모드 - 플랫폼별 발행 처리
                    onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] 실제 발행 시작...');
                    platform = payload.platform || 'wordpress';
                    onLog === null || onLog === void 0 ? void 0 : onLog("[RUNPOST] \uD50C\uB7AB\uD3FC: ".concat(platform));
                    if (!(platform === 'blogger')) return [3 /*break*/, 3];
                    // Blogger 발행
                    onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] Blogger 발행 시작...');
                    return [4 /*yield*/, publishGeneratedContent(payload, generatedTitle, html, payload.customThumbnail || undefined, onLog)];
                case 2:
                    publishResult = _a.sent();
                    if (publishResult.ok) {
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 Blogger \uBC1C\uD589 \uC644\uB8CC: ".concat(publishResult.url));
                        return [2 /*return*/, {
                            ok: true,
                            html: html,
                            title: generatedTitle,
                            url: publishResult.url,
                            postId: publishResult.id
                        }];
                    }
                    else {
                        throw new Error(publishResult.error || 'Blogger 발행 실패');
                    }
                    return [3 /*break*/, 7];
                case 3:
                    if (!(platform === 'wordpress')) return [3 /*break*/, 6];
                    // WordPress 발행
                    onLog === null || onLog === void 0 ? void 0 : onLog('[RUNPOST] WordPress 발행 시작...');
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../wordpress/wordpress-publisher'); })];
                case 4:
                    publishToWordPress = (_a.sent()).publishToWordPress;
                    categories = [];
                    wpCats = payload.wordpressCategories;
                    if (wpCats && typeof wpCats === 'string') {
                        catIds = wpCats.split(',').map(function (c) { return parseInt(c.trim()); }).filter(function (n) { return !isNaN(n); });
                        categories.push.apply(categories, catIds);
                    }
                    return [4 /*yield*/, publishToWordPress({
                        title: generatedTitle,
                        content: html,
                        status: payload.postingMode === 'draft' ? 'draft' : 'publish',
                        categories: categories,
                        siteUrl: payload.wordpressSiteUrl || '',
                        username: payload.wordpressUsername || '',
                        password: payload.wordpressPassword || ''
                    }, onLog)];
                case 5:
                    wpResult = _a.sent();
                    if (wpResult.ok) {
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u2705 WordPress \uBC1C\uD589 \uC644\uB8CC: ".concat(wpResult.url));
                        return [2 /*return*/, {
                            ok: true,
                            html: html,
                            title: generatedTitle,
                            url: wpResult.url,
                            postId: wpResult.id
                        }];
                    }
                    else {
                        throw new Error(wpResult.error || 'WordPress 발행 실패');
                    }
                    return [3 /*break*/, 7];
                case 6: throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uD50C\uB7AB\uD3FC: ".concat(platform));
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_20 = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("[RUNPOST] \uC624\uB958: ".concat(error_20.message));
                    return [2 /*return*/, {
                        ok: false,
                        error: error_20.message
                    }];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * 생성된 콘텐츠를 Blogger에 발행하는 함수
 */
function publishGeneratedContent(payload, title, content, thumbnailUrl, onLog) {
    return __awaiter(this, void 0, void 0, function () {
        var rawPostingMode, postingMode, postingStatus, scheduleDate, scheduleISO, publishToBlogger, result, error_21;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    onLog === null || onLog === void 0 ? void 0 : onLog('[PUBLISH] 발행 시작...');
                    rawPostingMode = (payload === null || payload === void 0 ? void 0 : payload.postingMode) || 'immediate';
                    postingMode = String(rawPostingMode).toLowerCase().trim();
                    console.log("[PUBLISH] \uC6D0\uBCF8 postingMode: \"".concat(rawPostingMode, "\""));
                    console.log("[PUBLISH] \uC815\uC81C\uB41C postingMode: \"".concat(postingMode, "\""));
                    onLog === null || onLog === void 0 ? void 0 : onLog("[DEBUG] postingMode: \"".concat(rawPostingMode, "\" \u2192 \"").concat(postingMode, "\""));
                    postingStatus = 'publish';
                    scheduleDate = null;
                    if (postingMode === 'draft' || postingMode === '임시발행' || postingMode === '임시저장') {
                        postingStatus = 'draft';
                        console.log("[PUBLISH] \u2705 \uC784\uC2DC\uC800\uC7A5 \uBAA8\uB4DC\uB85C \uC124\uC815\uB428 (postingStatus: ".concat(postingStatus, ")"));
                        onLog === null || onLog === void 0 ? void 0 : onLog("\uD83D\uDCDD \uBC1C\uD589 \uBAA8\uB4DC: \uC784\uC2DC\uC800\uC7A5 (DRAFT)");
                    }
                    else if (postingMode === 'schedule') {
                        scheduleISO = (payload === null || payload === void 0 ? void 0 : payload.scheduleISO) || (payload === null || payload === void 0 ? void 0 : payload.schedule);
                        if (scheduleISO) {
                            scheduleDate = new Date(scheduleISO);
                            if (isNaN(scheduleDate.getTime())) {
                                onLog === null || onLog === void 0 ? void 0 : onLog('⚠️ 예약 시간이 유효하지 않습니다. 즉시 발행합니다.');
                                postingStatus = 'publish';
                            }
                            else {
                                postingStatus = 'draft'; // 예약 발행은 draft로 시작하되 published 필드 설정
                                onLog === null || onLog === void 0 ? void 0 : onLog("\uD83D\uDCC5 \uC608\uC57D \uBC1C\uD589: ".concat(scheduleDate.toLocaleString('ko-KR')));
                            }
                        }
                        else {
                            onLog === null || onLog === void 0 ? void 0 : onLog('⚠️ 예약 시간이 지정되지 않았습니다. 즉시 발행합니다.');
                            postingStatus = 'publish';
                        }
                    }
                    else {
                        // immediate 모드
                        postingStatus = 'publish';
                        onLog === null || onLog === void 0 ? void 0 : onLog("\uD83D\uDCDD \uBC1C\uD589 \uBAA8\uB4DC: \uC989\uC2DC\uBC1C\uD589");
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./blogger-publisher'); })];
                case 1:
                    publishToBlogger = (_a.sent()).publishToBlogger;
                    // 🔧 최종 postingStatus 확인 및 로그
                    console.log("[PUBLISH] \uCD5C\uC885 postingStatus: \"".concat(postingStatus, "\""));
                    onLog === null || onLog === void 0 ? void 0 : onLog("[DEBUG] \uCD5C\uC885 postingStatus: \"".concat(postingStatus, "\""));
                    return [4 /*yield*/, publishToBlogger(payload, title, content, thumbnailUrl, onLog, postingStatus, scheduleDate)];
                case 2:
                    result = _a.sent();
                    if (result.ok) {
                        onLog === null || onLog === void 0 ? void 0 : onLog('✅ 발행 완료');
                        return [2 /*return*/, {
                            ok: true,
                            url: result.url,
                            id: result.id
                        }];
                    }
                    else {
                        onLog === null || onLog === void 0 ? void 0 : onLog("\u274C \uBC1C\uD589 \uC2E4\uD328: ".concat(result.error));
                        return [2 /*return*/, {
                            ok: false,
                            error: result.error
                        }];
                    }
                    return [3 /*break*/, 4];
                case 3:
                    error_21 = _a.sent();
                    onLog === null || onLog === void 0 ? void 0 : onLog("\u274C \uBC1C\uD589 \uC624\uB958: ".concat(error_21.message));
                    return [2 /*return*/, {
                        ok: false,
                        error: error_21.message
                    }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
