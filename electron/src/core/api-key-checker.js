"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkApiKeys = checkApiKeys;
exports.getApiKeySummary = getApiKeySummary;
var openai_1 = require("openai");
var generative_ai_1 = require("@google/generative-ai");
function checkApiKeys(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var status, openai, error_1, genAI, model, error_2, response, error_3, testUrl, response, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    status = {
                        openai: { valid: false },
                        gemini: { valid: false },
                        naver: { valid: false },
                        googleCse: { valid: false }
                    };
                    if (!payload.openaiKey) return [3 /*break*/, 5];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    openai = new openai_1.default({ apiKey: payload.openaiKey });
                    return [4 /*yield*/, openai.models.list()];
                case 2:
                    _a.sent();
                    status.openai = {
                        valid: true,
                        model: 'gpt-4o-mini'
                    };
                    console.log('✅ OpenAI API 키 유효함');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    status.openai = {
                        valid: false,
                        error: error_1.message || 'OpenAI API 키가 유효하지 않습니다.'
                    };
                    console.log('❌ OpenAI API 키 오류:', error_1.message);
                    return [3 /*break*/, 4];
                case 4: return [3 /*break*/, 6];
                case 5:
                    status.openai = {
                        valid: false,
                        error: 'OpenAI API 키가 설정되지 않았습니다.'
                    };
                    console.log('⚠️ OpenAI API 키 미설정');
                    _a.label = 6;
                case 6:
                    if (!payload.geminiKey) return [3 /*break*/, 11];
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 9, , 10]);
                    genAI = new generative_ai_1.GoogleGenerativeAI(payload.geminiKey);
                    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    // 간단한 테스트 요청
                    return [4 /*yield*/, model.generateContent('테스트')];
                case 8:
                    // 간단한 테스트 요청
                    _a.sent();
                    status.gemini = {
                        valid: true,
                        model: 'gemini-2.5-flash'
                    };
                    console.log('✅ Gemini API 키 유효함');
                    return [3 /*break*/, 10];
                case 9:
                    error_2 = _a.sent();
                    status.gemini = {
                        valid: false,
                        error: error_2.message || 'Gemini API 키가 유효하지 않습니다.'
                    };
                    console.log('❌ Gemini API 키 오류:', error_2.message);
                    return [3 /*break*/, 10];
                case 10: return [3 /*break*/, 12];
                case 11:
                    status.gemini = {
                        valid: false,
                        error: 'Gemini API 키가 설정되지 않았습니다.'
                    };
                    console.log('⚠️ Gemini API 키 미설정');
                    _a.label = 12;
                case 12:
                    if (!(payload.naverClientId && payload.naverClientSecret)) return [3 /*break*/, 17];
                    _a.label = 13;
                case 13:
                    _a.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, fetch('https://openapi.naver.com/v1/search/news.json?query=테스트&display=1', {
                        headers: {
                            'X-Naver-Client-Id': payload.naverClientId,
                            'X-Naver-Client-Secret': payload.naverClientSecret
                        }
                    })];
                case 14:
                    response = _a.sent();
                    if (response.ok) {
                        status.naver = { valid: true };
                        console.log('✅ 네이버 API 키 유효함');
                    }
                    else {
                        status.naver = {
                            valid: false,
                            error: "\uB124\uC774\uBC84 API \uC624\uB958 (".concat(response.status, ")")
                        };
                        console.log('❌ 네이버 API 오류:', response.status);
                    }
                    return [3 /*break*/, 16];
                case 15:
                    error_3 = _a.sent();
                    status.naver = {
                        valid: false,
                        error: error_3.message || '네이버 API 키가 유효하지 않습니다.'
                    };
                    console.log('❌ 네이버 API 키 오류:', error_3.message);
                    return [3 /*break*/, 16];
                case 16: return [3 /*break*/, 18];
                case 17:
                    status.naver = {
                        valid: false,
                        error: '네이버 API 키가 설정되지 않았습니다.'
                    };
                    console.log('⚠️ 네이버 API 키 미설정');
                    _a.label = 18;
                case 18:
                    if (!(payload.googleCseKey && payload.googleCseCx)) return [3 /*break*/, 23];
                    _a.label = 19;
                case 19:
                    _a.trys.push([19, 21, , 22]);
                    testUrl = "https://www.googleapis.com/customsearch/v1?key=".concat(payload.googleCseKey, "&cx=").concat(payload.googleCseCx, "&q=\uD14C\uC2A4\uD2B8");
                    return [4 /*yield*/, fetch(testUrl)];
                case 20:
                    response = _a.sent();
                    if (response.ok) {
                        status.googleCse = { valid: true };
                        console.log('✅ Google CSE API 키 유효함');
                    }
                    else {
                        status.googleCse = {
                            valid: false,
                            error: "Google CSE API \uC624\uB958 (".concat(response.status, ")")
                        };
                        console.log('❌ Google CSE API 오류:', response.status);
                    }
                    return [3 /*break*/, 22];
                case 21:
                    error_4 = _a.sent();
                    status.googleCse = {
                        valid: false,
                        error: error_4.message || 'Google CSE API 키가 유효하지 않습니다.'
                    };
                    console.log('❌ Google CSE API 키 오류:', error_4.message);
                    return [3 /*break*/, 22];
                case 22: return [3 /*break*/, 24];
                case 23:
                    status.googleCse = {
                        valid: false,
                        error: 'Google CSE API 키가 설정되지 않았습니다.'
                    };
                    console.log('⚠️ Google CSE API 키 미설정');
                    _a.label = 24;
                case 24: return [2 /*return*/, status];
            }
        });
    });
}
function getApiKeySummary(status) {
    var summary = [];
    if (status.openai.valid) {
        summary.push("\u2705 OpenAI: ".concat(status.openai.model));
    }
    else {
        summary.push("\u274C OpenAI: ".concat(status.openai.error));
    }
    if (status.gemini.valid) {
        summary.push("\u2705 Gemini: ".concat(status.gemini.model));
    }
    else {
        summary.push("\u274C Gemini: ".concat(status.gemini.error));
    }
    if (status.naver.valid) {
        summary.push('✅ 네이버 API');
    }
    else {
        summary.push("\u274C \uB124\uC774\uBC84 API: ".concat(status.naver.error));
    }
    if (status.googleCse.valid) {
        summary.push('✅ Google CSE');
    }
    else {
        summary.push("\u274C Google CSE: ".concat(status.googleCse.error));
    }
    return summary.join('\n');
}
