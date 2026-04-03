"use strict";
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
exports.makeAutoThumbnail = makeAutoThumbnail;
exports.makeCSEThumbnail = makeCSEThumbnail;
exports.makePexelsThumbnail = makePexelsThumbnail;
exports.makeDalleThumbnail = makeDalleThumbnail;
exports.makeSmartThumbnail = makeSmartThumbnail;
// src/thumbnail.ts
var path = require("node:path");
var fs = require("node:fs/promises");
var sharp_1 = require("sharp");
// 성능 최적화: 텍스트 이스케이프 캐시
var escapeCache = new Map();
function esc(s) {
    if (s === void 0) { s = ''; }
    if (escapeCache.has(s)) {
        return escapeCache.get(s);
    }
    var escaped = String(s).replace(/[&<>"']/g, function (m) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]);
    });
    escapeCache.set(s, escaped);
    return escaped;
}
// 제목 길이에 따라 폰트 크기 자동 조절 (글자수에 맞게 꽉 채우기)
function calculateFontSize(title) {
    var length = title.length;
    if (length <= 8)
        return 90; // 매우 짧은 제목: 매우 큰 폰트 (꽉 채움)
    if (length <= 15)
        return 76; // 짧은 제목: 큰 폰트
    if (length <= 22)
        return 64; // 보통 제목: 중간 큰 폰트
    if (length <= 30)
        return 54; // 긴 제목: 중간 폰트
    if (length <= 38)
        return 46; // 매우 긴 제목: 작은 폰트
    return 38; // 초장문 제목: 매우 작은 폰트
}
// 제목을 간단명료하게 핵심만 추출
function extractKeyPhrase(title) {
    // 불필요한 단어 제거 (더 공격적으로)
    var removeWords = [
        '방법', '가이드', '정보', '소개', '알아보기', '확인', '총정리', '완벽', '최신',
        '2024', '2025', '2026', '완전', '정복', '마스터', '꿀팁', '모음', '대공개',
        '총망라', '총정리', '한눈에', '바로', '지금', '오늘', '이번', '최고', '베스트'
    ];
    var simplified = title;
    removeWords.forEach(function (word) {
        simplified = simplified.replace(new RegExp(word, 'g'), '');
    });
    // 공백 정리
    simplified = simplified.trim().replace(/\s+/g, ' ');
    // 최대 25자로 제한 (더 짧게)
    if (simplified.length > 25) {
        simplified = simplified.substring(0, 22) + '...';
    }
    // 너무 짧으면 원본 제목 일부 사용
    if (simplified.length < 5) {
        simplified = title.substring(0, Math.min(25, title.length));
    }
    return simplified;
}
function wrapTitle(title, maxLen, maxLines) {
    if (maxLen === void 0) { maxLen = 18; }
    if (maxLines === void 0) { maxLines = 3; }
    // 간단명료한 핵심만 추출
    var keyPhrase = extractKeyPhrase(title);
    var words = keyPhrase.trim().split(/\s+/);
    var lines = [];
    var cur = '';
    for (var _i = 0, words_1 = words; _i < words_1.length; _i++) {
        var w = words_1[_i];
        var tryLine = cur ? cur + ' ' + w : w;
        if (tryLine.length <= maxLen)
            cur = tryLine;
        else {
            lines.push(cur);
            cur = w;
        }
        if (lines.length >= maxLines)
            break;
    }
    if (cur && lines.length < maxLines)
        lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
        // 말줄임표
        var lastLine = lines[lines.length - 1];
        if (lastLine) {
            lines[lines.length - 1] = lastLine.replace(/.{0,3}$/, '') + '…';
        }
    }
    return lines;
}
function makeAutoThumbnail(title_1) {
    return __awaiter(this, arguments, void 0, function (title, opt) {
        var width, height, outDir, fontSize, titleLines, tags, svg, png, file, base64String, dataUrl;
        var _a, _b, _c, _d, _e;
        if (opt === void 0) { opt = {}; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    width = (_a = opt.width) !== null && _a !== void 0 ? _a : 800;
                    height = (_b = opt.height) !== null && _b !== void 0 ? _b : 420;
                    outDir = (_c = opt.outDir) !== null && _c !== void 0 ? _c : process.cwd();
                    fontSize = calculateFontSize(title);
                    titleLines = wrapTitle(title, 18, (_d = opt.titleMaxLines) !== null && _d !== void 0 ? _d : 3);
                    tags = ((_e = opt.tags) !== null && _e !== void 0 ? _e : []).filter(Boolean).slice(0, 6);
                    svg = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg width=\"".concat(width, "\" height=\"").concat(height, "\" viewBox=\"0 0 ").concat(width, " ").concat(height, "\" xmlns=\"http://www.w3.org/2000/svg\">\n  <defs>\n    <!-- \uC8FC\uD669\uC0C9 \uADF8\uB77C\uB514\uC5B8\uD2B8 \uBC30\uACBD -->\n    <linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">\n      <stop offset=\"0%\"  stop-color=\"#fff7ed\"/>\n      <stop offset=\"45%\" stop-color=\"#fed7aa\"/>\n      <stop offset=\"100%\" stop-color=\"#fdba74\"/>\n    </linearGradient>\n    <!-- \uC8FC\uD669\uC0C9 \uD14C\uB450\uB9AC \uADF8\uB77C\uB514\uC5B8\uD2B8 -->\n    <linearGradient id=\"border\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">\n      <stop offset=\"0%\" stop-color=\"#f97316\"/>\n      <stop offset=\"50%\" stop-color=\"#ea580c\"/>\n      <stop offset=\"100%\" stop-color=\"#dc2626\"/>\n    </linearGradient>\n    <!-- \uD14D\uC2A4\uD2B8 \uADF8\uB9BC\uC790 -->\n    <filter id=\"textShadow\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\">\n      <feDropShadow dx=\"0\" dy=\"4\" stdDeviation=\"8\" flood-color=\"#000000\" flood-opacity=\"0.3\"/>\n    </filter>\n    <style><![CDATA[\n      .title { \n        font-family: \"Noto Sans KR\", \"Apple SD Gothic Neo\", \"Malgun Gothic\", sans-serif;\n        font-weight: 900; \n        fill: #1a1a1a; \n        text-anchor: middle;\n        dominant-baseline: middle;\n        filter: url(#textShadow);\n      }\n      .chip  { \n        font-family: \"Noto Sans KR\", sans-serif;\n        font-weight: 700; \n        fill: #ffffff; \n        text-anchor: middle;\n        dominant-baseline: middle;\n      }\n      .brand { \n        font-family: \"Noto Sans KR\", sans-serif; \n        fill: #7c2d12; \n        font-weight: 700; \n        text-anchor: middle;\n        dominant-baseline: middle;\n      }\n    ]]></style>\n  </defs>\n\n  <!-- \uC8FC\uD669\uC0C9 \uBC30\uACBD -->\n  <rect x=\"0\" y=\"0\" width=\"").concat(width, "\" height=\"").concat(height, "\" fill=\"url(#bg)\" rx=\"24\" ry=\"24\"/>\n  \n  <!-- \uC8FC\uD669\uC0C9 \uD14C\uB450\uB9AC -->\n  <rect x=\"8\" y=\"8\" width=\"").concat(width - 16, "\" height=\"").concat(height - 16, "\" fill=\"none\" stroke=\"url(#border)\" stroke-width=\"12\" rx=\"20\" ry=\"20\"/>\n  \n  <!-- \uC81C\uBAA9 (\uAC00\uC6B4\uB370 \uC815\uB82C, \uC790\uB3D9 \uC870\uC808 \uD3F0\uD2B8) -->\n  <g transform=\"translate(").concat(width / 2, ", ").concat(height / 2 - (titleLines.length - 1) * (fontSize / 2), ")\">\n    ").concat(titleLines.map(function (line, i) {
                        return "<text class=\"title\" x=\"0\" y=\"".concat(i * fontSize, "\" font-size=\"").concat(fontSize, "\" text-anchor=\"middle\" dominant-baseline=\"middle\">").concat(esc(line), "</text>");
                    }).join('\n'), "\n  </g>\n\n  <!-- chips -->\n  <g transform=\"translate(80, ").concat(height - 90, ")\">\n    ").concat(tags.map(function (t, i) {
                        var x = i * 180;
                        return "\n        <g transform=\"translate(".concat(x, ",0)\">\n          <rect x=\"0\" y=\"-40\" rx=\"18\" ry=\"18\" width=\"160\" height=\"48\"\n                fill=\"#ffffff\" opacity=\"0.85\" stroke=\"#e6eefc\"/>\n          <text class=\"chip\" x=\"80\" y=\"-9\" font-size=\"28\" text-anchor=\"middle\">").concat(esc(t), "</text>\n        </g>");
                    }).join(''), "\n  </g>\n\n  <!-- brand -->\n  ").concat(opt.brand ? "<text class=\"brand\" x=\"80\" y=\"".concat(height - 24, "\" font-size=\"22\">").concat(esc(opt.brand), "</text>") : '', "\n\n</svg>");
                    return [4 /*yield*/, (0, sharp_1.default)(Buffer.from(svg))
                            .png({
                            compressionLevel: 9,
                            quality: 85, // 품질 최적화
                            progressive: true, // 점진적 로딩
                            adaptiveFiltering: true // 적응형 필터링
                        })
                            .toBuffer()];
                case 1:
                    png = _f.sent();
                    file = path.join(outDir, "thumb-".concat(Date.now(), ".png"));
                    return [4 /*yield*/, fs.mkdir(outDir, { recursive: true })];
                case 2:
                    _f.sent();
                    return [4 /*yield*/, fs.writeFile(file, png)];
                case 3:
                    _f.sent();
                    base64String = png.toString('base64');
                    dataUrl = "data:image/png;base64,".concat(base64String);
                    // 데이터 크기 로깅 (디버깅용)
                    console.log("[THUMBNAIL] SVG \uC378\uB124\uC77C \uD06C\uAE30: ".concat(Math.round(base64String.length / 1024), "KB"));
                    // 너무 큰 경우 경고
                    if (base64String.length > 500000) { // 500KB 이상
                        console.warn('[THUMBNAIL] 썸네일 데이터가 큽니다:', Math.round(base64String.length / 1024) + 'KB');
                    }
                    return [2 /*return*/, { ok: true, path: file, dataUrl: dataUrl }];
            }
        });
    });
}
// CSE 썸네일 생성 함수
function makeCSEThumbnail(title, topic, options) {
    return __awaiter(this, void 0, void 0, function () {
        var searchQuery_1, safeCSERequest, cacheKey, data, item, imageUrl, imageResponse, imageBuffer, base64, dataUrl, error_1;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 5, , 6]);
                    searchQuery_1 = "".concat(topic, " ").concat(title).replace(/[^\w\s가-힣]/g, ' ').trim();
                    return [4 /*yield*/, Promise.resolve().then(function () { return require('./utils/google-cse-rate-limiter'); })];
                case 1:
                    safeCSERequest = (_b.sent()).safeCSERequest;
                    cacheKey = "thumbnail-cse:".concat(searchQuery_1);
                    return [4 /*yield*/, safeCSERequest(searchQuery_1, function () { return __awaiter(_this, void 0, void 0, function () {
                            var response, errorData;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, fetch("https://www.googleapis.com/customsearch/v1?key=".concat(options.apiKey, "&cx=").concat(options.cx, "&q=").concat(encodeURIComponent(searchQuery_1), "&searchType=image&num=").concat(options.num || 1, "&safe=").concat(options.safe || 'active', "&imgSize=large&imgType=photo"), {
                                            method: 'GET',
                                        })];
                                    case 1:
                                        response = _b.sent();
                                        if (!!response.ok) return [3 /*break*/, 3];
                                        return [4 /*yield*/, response.json().catch(function () { return ({}); })];
                                    case 2:
                                        errorData = _b.sent();
                                        throw new Error("CSE API \uC624\uB958: ".concat(((_a = errorData === null || errorData === void 0 ? void 0 : errorData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error'));
                                    case 3: return [4 /*yield*/, response.json()];
                                    case 4: return [2 /*return*/, _b.sent()];
                                }
                            });
                        }); }, { useCache: true, cacheKey: cacheKey, priority: 'low' })];
                case 2:
                    data = _b.sent();
                    item = (_a = data === null || data === void 0 ? void 0 : data.items) === null || _a === void 0 ? void 0 : _a[0];
                    if (!item) {
                        return [2 /*return*/, { ok: false, error: 'CSE에서 적절한 이미지를 찾지 못했습니다' }];
                    }
                    imageUrl = item.link;
                    if (!imageUrl) {
                        return [2 /*return*/, { ok: false, error: 'CSE 이미지 URL을 받지 못했습니다' }];
                    }
                    return [4 /*yield*/, fetch(imageUrl)];
                case 3:
                    imageResponse = _b.sent();
                    return [4 /*yield*/, imageResponse.arrayBuffer()];
                case 4:
                    imageBuffer = _b.sent();
                    base64 = Buffer.from(imageBuffer).toString('base64');
                    dataUrl = "data:image/jpeg;base64,".concat(base64);
                    return [2 /*return*/, { ok: true, dataUrl: dataUrl }];
                case 5:
                    error_1 = _b.sent();
                    return [2 /*return*/, { ok: false, error: error_1.message || 'CSE 썸네일 생성 오류' }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// Pexels 썸네일 생성 함수
function makePexelsThumbnail(title, topic, options) {
    return __awaiter(this, void 0, void 0, function () {
        var searchQuery, response, errorData, data, photo, imageUrl, imageResponse, imageBuffer, base64, dataUrl, error_2;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 7, , 8]);
                    searchQuery = "".concat(topic, " ").concat(title).replace(/[^\w\s가-힣]/g, ' ').trim();
                    return [4 /*yield*/, fetch("https://api.pexels.com/v1/search?query=".concat(encodeURIComponent(searchQuery), "&per_page=1&orientation=").concat(options.orientation || 'landscape', "&size=").concat(options.size || 'large'), {
                            method: 'GET',
                            headers: {
                                'Authorization': options.apiKey,
                            },
                        })];
                case 1:
                    response = _f.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.json()];
                case 2:
                    errorData = _f.sent();
                    return [2 /*return*/, { ok: false, error: "Pexels API \uC624\uB958: ".concat(errorData.error || 'Unknown error') }];
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    data = _f.sent();
                    photo = (_a = data.photos) === null || _a === void 0 ? void 0 : _a[0];
                    if (!photo) {
                        return [2 /*return*/, { ok: false, error: 'Pexels에서 적절한 이미지를 찾지 못했습니다' }];
                    }
                    imageUrl = ((_b = photo.src) === null || _b === void 0 ? void 0 : _b.large) || ((_c = photo.src) === null || _c === void 0 ? void 0 : _c.medium) || ((_d = photo.src) === null || _d === void 0 ? void 0 : _d.small) || ((_e = photo.src) === null || _e === void 0 ? void 0 : _e.original);
                    if (!imageUrl) {
                        return [2 /*return*/, { ok: false, error: 'Pexels 이미지 URL을 받지 못했습니다' }];
                    }
                    return [4 /*yield*/, fetch(imageUrl)];
                case 5:
                    imageResponse = _f.sent();
                    return [4 /*yield*/, imageResponse.arrayBuffer()];
                case 6:
                    imageBuffer = _f.sent();
                    base64 = Buffer.from(imageBuffer).toString('base64');
                    dataUrl = "data:image/jpeg;base64,".concat(base64);
                    return [2 /*return*/, { ok: true, dataUrl: dataUrl }];
                case 7:
                    error_2 = _f.sent();
                    return [2 /*return*/, { ok: false, error: error_2.message || 'Pexels 썸네일 생성 오류' }];
                case 8: return [2 /*return*/];
            }
        });
    });
}
// DALL-E 썸네일 생성 함수
function makeDalleThumbnail(title, topic, options) {
    return __awaiter(this, void 0, void 0, function () {
        var prompt_1, response, errorData, data, imageData, dataUrl, error_3;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 5, , 6]);
                    prompt_1 = "Create a high-quality, professional image for a blog post about \"".concat(topic, "\". The image should be: ").concat(title, ". Style: modern, clean, engaging, suitable for web content. Dimensions: ").concat(options.width || 1200, "x").concat(options.height || 630, ".");
                    return [4 /*yield*/, fetch('https://api.openai.com/v1/images/generations', {
                            method: 'POST',
                            headers: {
                                'Authorization': "Bearer ".concat(options.apiKey),
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                model: 'dall-e-3',
                                prompt: prompt_1,
                                n: 1,
                                size: "".concat(options.width || 1200, "x").concat(options.height || 630),
                                quality: options.quality || 'standard',
                                style: options.style || 'natural',
                                response_format: 'b64_json'
                            }),
                        })];
                case 1:
                    response = _d.sent();
                    if (!!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, response.json()];
                case 2:
                    errorData = _d.sent();
                    return [2 /*return*/, { ok: false, error: "DALL-E API \uC624\uB958: ".concat(((_a = errorData.error) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error') }];
                case 3: return [4 /*yield*/, response.json()];
                case 4:
                    data = _d.sent();
                    imageData = (_c = (_b = data.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.b64_json;
                    if (!imageData) {
                        return [2 /*return*/, { ok: false, error: 'DALL-E에서 이미지를 생성하지 못했습니다' }];
                    }
                    dataUrl = "data:image/png;base64,".concat(imageData);
                    return [2 /*return*/, { ok: true, dataUrl: dataUrl }];
                case 5:
                    error_3 = _d.sent();
                    return [2 /*return*/, { ok: false, error: error_3.message || 'DALL-E 썸네일 생성 오류' }];
                case 6: return [2 /*return*/];
            }
        });
    });
}
// 실제 이미지 API를 우선적으로 사용하는 통합 함수 (SVG는 마지막 fallback)
function makeSmartThumbnail(title_1, topic_1) {
    return __awaiter(this, arguments, void 0, function (title, topic, _svgOptions, pexelsOptions, _cseOptions, dalleOptions) {
        var envApiKeys, dalleKey, dalleResult, error_4, pexelsKey, pexelsResult, error_5;
        if (_svgOptions === void 0) { _svgOptions = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    envApiKeys = {
                        openai: process.env['OPENAI_API_KEY'],
                        pexels: process.env['PEXELS_API_KEY'],
                        cse: process.env['GOOGLE_CSE_API_KEY'],
                        cseId: process.env['GOOGLE_CSE_ID']
                    };
                    dalleKey = (dalleOptions === null || dalleOptions === void 0 ? void 0 : dalleOptions.apiKey) || envApiKeys.openai;
                    if (!dalleKey) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, makeDalleThumbnail(title, topic, {
                            apiKey: dalleKey,
                            width: (dalleOptions === null || dalleOptions === void 0 ? void 0 : dalleOptions.width) || 1200,
                            height: (dalleOptions === null || dalleOptions === void 0 ? void 0 : dalleOptions.height) || 630,
                            quality: (dalleOptions === null || dalleOptions === void 0 ? void 0 : dalleOptions.quality) || 'standard',
                            style: (dalleOptions === null || dalleOptions === void 0 ? void 0 : dalleOptions.style) || 'natural'
                        })];
                case 2:
                    dalleResult = _a.sent();
                    if (dalleResult.ok) {
                        console.log('[THUMBNAIL] DALL-E 이미지 생성 성공');
                        return [2 /*return*/, __assign(__assign({}, dalleResult), { type: 'dalle' })];
                    }
                    console.warn('[THUMBNAIL] DALL-E 실패, Pexels로 대체:', dalleResult.ok === false ? dalleResult.error : 'Unknown error');
                    return [3 /*break*/, 4];
                case 3:
                    error_4 = _a.sent();
                    console.warn('[THUMBNAIL] DALL-E 오류, Pexels로 대체:', error_4);
                    return [3 /*break*/, 4];
                case 4:
                    pexelsKey = (pexelsOptions === null || pexelsOptions === void 0 ? void 0 : pexelsOptions.apiKey) || envApiKeys.pexels;
                    if (!pexelsKey) return [3 /*break*/, 8];
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    return [4 /*yield*/, makePexelsThumbnail(title, topic, {
                            apiKey: pexelsKey,
                            width: (pexelsOptions === null || pexelsOptions === void 0 ? void 0 : pexelsOptions.width) || 1200,
                            height: (pexelsOptions === null || pexelsOptions === void 0 ? void 0 : pexelsOptions.height) || 630,
                            orientation: (pexelsOptions === null || pexelsOptions === void 0 ? void 0 : pexelsOptions.orientation) || 'landscape',
                            size: (pexelsOptions === null || pexelsOptions === void 0 ? void 0 : pexelsOptions.size) || 'large'
                        })];
                case 6:
                    pexelsResult = _a.sent();
                    if (pexelsResult.ok) {
                        console.log('[THUMBNAIL] Pexels 이미지 검색 성공');
                        return [2 /*return*/, __assign(__assign({}, pexelsResult), { type: 'pexels' })];
                    }
                    console.warn('[THUMBNAIL] Pexels 실패, Google CSE로 대체:', pexelsResult.ok === false ? pexelsResult.error : 'Unknown error');
                    return [3 /*break*/, 8];
                case 7:
                    error_5 = _a.sent();
                    console.warn('[THUMBNAIL] Pexels 오류, Google CSE로 대체:', error_5);
                    return [3 /*break*/, 8];
                case 8:
                    // 3. 모든 실제 이미지 API 실패 시 오류 반환 (SVG는 실제 이미지가 아니므로 사용하지 않음)
                    console.error('[THUMBNAIL] 모든 실제 이미지 API 실패 - 실제 이미지 생성 불가');
                    return [2 /*return*/, { ok: false, error: '모든 실제 이미지 API가 실패했습니다. API 키를 확인해주세요.' }];
            }
        });
    });
}
