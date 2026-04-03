"use strict";
/**
 * 키워드 검증 유틸리티
 * 네이버 API를 통해 키워드의 실제 검색량, 문서수, 유효성을 검증
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
exports.validateKeyword = validateKeyword;
exports.validateKeywords = validateKeywords;
var naver_datalab_api_1 = require("./naver-datalab-api");
var naver_crawler_1 = require("../naver-crawler");
var environment_manager_1 = require("./environment-manager");
/**
 * 키워드 검증
 */
function validateKeyword(keyword) {
    return __awaiter(this, void 0, void 0, function () {
        var envManager, env, clientId, clientSecret, searchVolume, volumeData, e_1, documentCount, blogResults, apiUrl, params, response, data, e_2, e_3, validationScore, validated, reason, volumeScore, competitionScore, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 15, , 16]);
                    envManager = environment_manager_1.EnvironmentManager.getInstance();
                    env = envManager.getConfig();
                    clientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
                    clientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';
                    if (!clientId || !clientSecret) {
                        return [2 /*return*/, {
                                keyword: keyword,
                                searchVolume: 0,
                                documentCount: 0,
                                validated: false,
                                validationScore: 0,
                                reason: '네이버 API 키 없음'
                            }];
                    }
                    searchVolume = 0;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, naver_datalab_api_1.getNaverKeywordSearchVolumeSeparate)({
                            clientId: clientId,
                            clientSecret: clientSecret
                        }, [keyword])];
                case 2:
                    volumeData = _a.sent();
                    if (volumeData && volumeData.length > 0 && volumeData[0]) {
                        // pcSearchVolume + mobileSearchVolume 합산
                        searchVolume = (volumeData[0].pcSearchVolume || 0) + (volumeData[0].mobileSearchVolume || 0);
                    }
                    return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.warn("[KEYWORD-VALIDATOR] \uAC80\uC0C9\uB7C9 \uC870\uD68C \uC2E4\uD328 (".concat(keyword, "):"), e_1);
                    return [3 /*break*/, 4];
                case 4:
                    documentCount = 0;
                    _a.label = 5;
                case 5:
                    _a.trys.push([5, 13, , 14]);
                    return [4 /*yield*/, (0, naver_crawler_1.searchNaverWithApi)(keyword, { customerId: clientId, secretKey: clientSecret }, 'blog', { timeout: 5000, retries: 1 })];
                case 6:
                    blogResults = _a.sent();
                    // 첫 페이지 결과로 문서수 추정 (정확한 문서수는 total 필드에 있지만 간접 추정)
                    if (blogResults && blogResults.length > 0) {
                        // 검색 API 응답에서 total 가져오기 (간접 추정)
                        documentCount = blogResults.length > 0 ? 100 : 0; // 최소 100개로 추정
                    }
                    _a.label = 7;
                case 7:
                    _a.trys.push([7, 11, , 12]);
                    apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                    params = new URLSearchParams({
                        query: keyword,
                        display: '1',
                        start: '1',
                        sort: 'sim'
                    });
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            headers: {
                                'X-Naver-Client-Id': clientId,
                                'X-Naver-Client-Secret': clientSecret
                            }
                        })];
                case 8:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 10];
                    return [4 /*yield*/, response.json()];
                case 9:
                    data = _a.sent();
                    documentCount = parseInt(data.total || '0');
                    _a.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    e_2 = _a.sent();
                    return [3 /*break*/, 12];
                case 12: return [3 /*break*/, 14];
                case 13:
                    e_3 = _a.sent();
                    console.warn("[KEYWORD-VALIDATOR] \uBB38\uC11C\uC218 \uC870\uD68C \uC2E4\uD328 (".concat(keyword, "):"), e_3);
                    return [3 /*break*/, 14];
                case 14:
                    validationScore = 0;
                    validated = false;
                    reason = '';
                    if (searchVolume > 0 && documentCount > 0) {
                        // 검색량과 문서수가 모두 있으면 유효한 키워드
                        validated = true;
                        volumeScore = Math.min(100, (searchVolume / 100) * 10);
                        competitionScore = documentCount < 100 ? 100 :
                            documentCount < 500 ? 80 :
                                documentCount < 1000 ? 60 : 40;
                        validationScore = Math.round((volumeScore * 0.6) + (competitionScore * 0.4));
                        reason = '검증 완료';
                    }
                    else if (documentCount > 0) {
                        // 문서수만 있어도 유효한 키워드 (검색량은 추정 불가일 수 있음)
                        validated = true;
                        validationScore = 60;
                        reason = '문서 존재 확인 (검색량 미확인)';
                    }
                    else {
                        validated = false;
                        validationScore = 0;
                        reason = '검색 결과 없음';
                    }
                    return [2 /*return*/, {
                            keyword: keyword,
                            searchVolume: searchVolume,
                            documentCount: documentCount,
                            validated: validated,
                            validationScore: validationScore,
                            reason: reason
                        }];
                case 15:
                    error_1 = _a.sent();
                    console.warn("[KEYWORD-VALIDATOR] \uD0A4\uC6CC\uB4DC \uAC80\uC99D \uC2E4\uD328 (".concat(keyword, "):"), error_1.message);
                    return [2 /*return*/, {
                            keyword: keyword,
                            searchVolume: 0,
                            documentCount: 0,
                            validated: false,
                            validationScore: 0,
                            reason: error_1.message || '검증 실패'
                        }];
                case 16: return [2 /*return*/];
            }
        });
    });
}
/**
 * 키워드 목록 일괄 검증
 */
function validateKeywords(keywords_1) {
    return __awaiter(this, arguments, void 0, function (keywords, maxConcurrent) {
        var results, i, batch, batchResults, _i, batchResults_1, result;
        var _a;
        if (maxConcurrent === void 0) { maxConcurrent = 5; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    results = [];
                    i = 0;
                    _b.label = 1;
                case 1:
                    if (!(i < keywords.length)) return [3 /*break*/, 4];
                    batch = keywords.slice(i, i + maxConcurrent);
                    return [4 /*yield*/, Promise.allSettled(batch.map(function (keyword) { return validateKeyword(keyword); }))];
                case 2:
                    batchResults = _b.sent();
                    for (_i = 0, batchResults_1 = batchResults; _i < batchResults_1.length; _i++) {
                        result = batchResults_1[_i];
                        if (result.status === 'fulfilled') {
                            results.push(result.value);
                        }
                        else {
                            results.push({
                                keyword: batch[Math.min(batchResults.indexOf(result), batch.length - 1)] || '',
                                searchVolume: 0,
                                documentCount: 0,
                                validated: false,
                                validationScore: 0,
                                reason: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || '검증 실패'
                            });
                        }
                    }
                    _b.label = 3;
                case 3:
                    i += maxConcurrent;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
