"use strict";
/**
 * 네이버 데이터랩 API 클라이언트
 * 공식 API를 사용하여 키워드 트렌드 데이터를 안전하게 수집합니다.
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
exports.getNaverTrendKeywords = getNaverTrendKeywords;
exports.getNaverRankingKeywords = getNaverRankingKeywords;
exports.getBlogSearchFallback = getBlogSearchFallback;
exports.getNaverKeywordSearchVolumeSeparate = getNaverKeywordSearchVolumeSeparate;
exports.getNaverKeywordSearchVolume = getNaverKeywordSearchVolume;
exports.getNaverRelatedKeywords = getNaverRelatedKeywords;
exports.getDateToday = getDateToday;
exports.getDateDaysAgo = getDateDaysAgo;
/**
 * 네이버 데이터랩 API를 사용하여 키워드 트렌드 조회
 * https://developers.naver.com/docs/serviceapi/datalab/search/search.md
 */
function getNaverTrendKeywords(config_1) {
    return __awaiter(this, arguments, void 0, function (config, options) {
        var _a, keywords, _b, startDate, _c, endDate, _d, timeUnit, _e, device, _f, ages, gender, apiUrl, requestBody, headers, response, errorText, data, trendKeywords, rank, _i, _g, result, keyword, keywordData, latestData, previousData, changeRate, diff, error_1, errorMsg, isRealNetworkError;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    _a = options.keywords, keywords = _a === void 0 ? [] : _a, _b = options.startDate, startDate = _b === void 0 ? getDateDaysAgo(30) : _b, _c = options.endDate, endDate = _c === void 0 ? getDateToday() : _c, _d = options.timeUnit, timeUnit = _d === void 0 ? 'date' : _d, _e = options.device, device = _e === void 0 ? 'pc' : _e, _f = options.ages, ages = _f === void 0 ? [] : _f, gender = options.gender;
                    if (!config.clientId || !config.clientSecret) {
                        throw new Error('네이버 API 인증 정보가 필요합니다 (Client ID, Client Secret)');
                    }
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 6, , 7]);
                    apiUrl = 'https://openapi.naver.com/v1/datalab/search';
                    requestBody = {
                        startDate: startDate,
                        endDate: endDate,
                        timeUnit: timeUnit,
                        keywordGroups: keywords.map(function (keyword) { return ({
                            groupName: keyword,
                            keywords: [keyword]
                        }); }),
                        device: device
                    };
                    if (ages.length > 0) {
                        requestBody.ages = ages;
                    }
                    if (gender) {
                        requestBody.gender = gender;
                    }
                    headers = {
                        'X-Naver-Client-Id': config.clientId,
                        'X-Naver-Client-Secret': config.clientSecret,
                        'Content-Type': 'application/json'
                    };
                    console.log('[NAVER-DATALAB] 트렌드 키워드 조회 요청:', { keywords: keywords, startDate: startDate, endDate: endDate });
                    return [4 /*yield*/, fetch(apiUrl, {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(requestBody)
                        })];
                case 2:
                    response = _h.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _h.sent();
                    throw new Error("\uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9 API \uC624\uB958 ".concat(response.status, ": ").concat(errorText));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = _h.sent();
                    if (!data.results || data.results.length === 0) {
                        console.log('[NAVER-DATALAB] 트렌드 데이터 없음');
                        return [2 /*return*/, []];
                    }
                    trendKeywords = [];
                    rank = 1;
                    for (_i = 0, _g = data.results; _i < _g.length; _i++) {
                        result = _g[_i];
                        keyword = '';
                        // 방법 1: title (groupName) 사용
                        if (result.title) {
                            keyword = result.title;
                        }
                        // 방법 2: keyword 배열의 첫 번째 키워드 사용
                        else if (result.keyword && Array.isArray(result.keyword) && result.keyword.length > 0) {
                            keyword = result.keyword[0];
                        }
                        // 방법 3: keywordGroup 사용 (하위 호환성)
                        else if (result.keywordGroup && Array.isArray(result.keywordGroup) && result.keywordGroup.length > 0) {
                            keyword = result.keywordGroup[0];
                        }
                        // 방법 4: groupName 사용
                        else if (result.groupName) {
                            keyword = result.groupName;
                        }
                        // 키워드가 없거나 유효하지 않으면 스킵
                        if (!keyword || keyword.trim().length === 0 || keyword.toLowerCase().includes('search') || keyword.includes('검색')) {
                            console.warn('[NAVER-DATALAB] 유효하지 않은 키워드 스킵:', keyword);
                            continue;
                        }
                        keywordData = result.data || [];
                        latestData = keywordData.length > 0 ? keywordData[keywordData.length - 1] : null;
                        previousData = keywordData.length > 1 ? keywordData[keywordData.length - 2] : null;
                        changeRate = 0;
                        if (latestData && previousData) {
                            diff = latestData.ratio - previousData.ratio;
                            changeRate = previousData.ratio > 0 ? (diff / previousData.ratio) * 100 : 0;
                        }
                        trendKeywords.push({
                            rank: rank++,
                            keyword: keyword.trim(),
                            changeRate: Math.round(changeRate * 10) / 10,
                            category: '일반',
                            searchVolume: (latestData === null || latestData === void 0 ? void 0 : latestData.ratio) || 0
                        });
                    }
                    // 변화율 기준 정렬 (내림차순)
                    trendKeywords.sort(function (a, b) { return b.changeRate - a.changeRate; });
                    console.log("[NAVER-DATALAB] \uD2B8\uB80C\uB4DC \uD0A4\uC6CC\uB4DC ".concat(trendKeywords.length, "\uAC1C \uC218\uC9D1 \uC644\uB8CC"));
                    return [2 /*return*/, trendKeywords];
                case 6:
                    error_1 = _h.sent();
                    console.error('[NAVER-DATALAB] API 호출 실패:', error_1);
                    // 에러 타입별 처리
                    if (error_1 instanceof TypeError && error_1.message.includes('fetch')) {
                        console.error('[NAVER-DATALAB] 네트워크 오류 또는 fetch API를 사용할 수 없습니다');
                        errorMsg = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1 || '').toLowerCase();
                        isRealNetworkError = errorMsg.includes('failed to fetch') ||
                            errorMsg.includes('networkerror') ||
                            errorMsg.includes('network request failed') ||
                            errorMsg.includes('err_network') ||
                            errorMsg.includes('enotfound') ||
                            errorMsg.includes('econnrefused') ||
                            errorMsg.includes('etimedout') ||
                            errorMsg.includes('econnreset');
                        if (isRealNetworkError) {
                            throw new Error('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.');
                        }
                        else {
                            // 네트워크 오류가 아닌 경우 원래 오류 메시지 사용
                            throw error_1;
                        }
                    }
                    if (error_1.message && error_1.message.includes('401')) {
                        throw new Error('네이버 API 인증 정보가 올바르지 않습니다. Client ID와 Client Secret을 확인해주세요.');
                    }
                    if (error_1.message && error_1.message.includes('403')) {
                        throw new Error('네이버 API 접근이 거부되었습니다. API 사용 권한을 확인해주세요.');
                    }
                    if (error_1.message && error_1.message.includes('429')) {
                        throw new Error('네이버 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
                    }
                    // 기타 에러는 원래 에러 메시지 유지
                    throw new Error("\uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9 API \uC624\uB958: ".concat(error_1.message || '알 수 없는 오류'));
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * 네이버 검색 API를 사용하여 인기 검색어 조회
 * https://developers.naver.com/docs/serviceapi/search/rank/rank.md
 */
function getNaverRankingKeywords(config) {
    return __awaiter(this, void 0, void 0, function () {
        var apiUrl, popularKeywords, results, i, keyword, params, headers, totalSearchVolume, pcResponse, pcData, error_2, mobileParams, mobileResponse, mobileData, error_3, pcResponse, pcData, popularity, error_4, error_5, errorMsg, isRealNetworkError;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!config.clientId || !config.clientSecret) {
                        throw new Error('네이버 API 인증 정보가 필요합니다');
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 24, , 25]);
                    apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                    popularKeywords = [
                        '블로그 수익화', '부업 추천', '온라인 수입', 'AI 글쓰기', '자동화 도구',
                        '디지털 노마드', '유튜브 수익', '사이드 프로젝트', '온라인 강의', '프리랜서'
                    ];
                    results = [];
                    i = 0;
                    _a.label = 2;
                case 2:
                    if (!(i < Math.min(popularKeywords.length, 10))) return [3 /*break*/, 23];
                    keyword = popularKeywords[i];
                    if (!keyword)
                        return [3 /*break*/, 22];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 21, , 22]);
                    params = new URLSearchParams();
                    params.append('query', keyword);
                    params.append('display', '1');
                    params.append('sort', 'sim');
                    headers = {
                        'X-Naver-Client-Id': config.clientId,
                        'X-Naver-Client-Secret': config.clientSecret
                    };
                    totalSearchVolume = 0;
                    _a.label = 4;
                case 4:
                    _a.trys.push([4, 8, , 9]);
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            method: 'GET',
                            headers: headers
                        })];
                case 5:
                    pcResponse = _a.sent();
                    if (!pcResponse.ok) return [3 /*break*/, 7];
                    return [4 /*yield*/, pcResponse.json()];
                case 6:
                    pcData = _a.sent();
                    totalSearchVolume += parseInt(pcData.total || '0');
                    _a.label = 7;
                case 7: return [3 /*break*/, 9];
                case 8:
                    error_2 = _a.sent();
                    console.warn("[NAVER-RANK] PC \uAC80\uC0C9\uB7C9 \uC870\uD68C \uC2E4\uD328 (".concat(keyword, "):"), error_2);
                    return [3 /*break*/, 9];
                case 9:
                    mobileParams = new URLSearchParams();
                    if (keyword) {
                        mobileParams.append('query', keyword);
                        mobileParams.append('display', '1');
                        mobileParams.append('sort', 'sim');
                    }
                    _a.label = 10;
                case 10:
                    _a.trys.push([10, 14, , 18]);
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(mobileParams), {
                            method: 'GET',
                            headers: headers
                        })];
                case 11:
                    mobileResponse = _a.sent();
                    if (!mobileResponse.ok) return [3 /*break*/, 13];
                    return [4 /*yield*/, mobileResponse.json()];
                case 12:
                    mobileData = _a.sent();
                    totalSearchVolume += parseInt(mobileData.total || '0');
                    _a.label = 13;
                case 13: return [3 /*break*/, 18];
                case 14:
                    error_3 = _a.sent();
                    console.warn("[NAVER-RANK] \uBAA8\uBC14\uC77C \uAC80\uC0C9\uB7C9 \uC870\uD68C \uC2E4\uD328 (".concat(keyword, "):"), error_3);
                    if (!(totalSearchVolume === 0)) return [3 /*break*/, 17];
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            method: 'GET',
                            headers: headers
                        })];
                case 15:
                    pcResponse = _a.sent();
                    if (!pcResponse.ok) return [3 /*break*/, 17];
                    return [4 /*yield*/, pcResponse.json()];
                case 16:
                    pcData = _a.sent();
                    totalSearchVolume = parseInt(pcData.total || '0');
                    _a.label = 17;
                case 17: return [3 /*break*/, 18];
                case 18:
                    if (!(totalSearchVolume > 0)) return [3 /*break*/, 20];
                    popularity = Math.min(totalSearchVolume / 1000, 100);
                    if (keyword) {
                        results.push({
                            rank: i + 1,
                            keyword: keyword,
                            changeRate: popularity,
                            category: '인기',
                            searchVolume: totalSearchVolume || 0 // PC+모바일 합산
                        });
                    }
                    // API 호출 제한 고려 (1초 대기)
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 19:
                    // API 호출 제한 고려 (1초 대기)
                    _a.sent();
                    _a.label = 20;
                case 20: return [3 /*break*/, 22];
                case 21:
                    error_4 = _a.sent();
                    console.error("[NAVER-RANK] \uD0A4\uC6CC\uB4DC \"".concat(keyword, "\" \uC870\uD68C \uC2E4\uD328:"), error_4);
                    return [3 /*break*/, 22];
                case 22:
                    i++;
                    return [3 /*break*/, 2];
                case 23: return [2 /*return*/, results.sort(function (a, b) { return b.searchVolume - a.searchVolume; })];
                case 24:
                    error_5 = _a.sent();
                    console.error('[NAVER-RANK] API 호출 실패:', error_5);
                    // 에러 타입별 처리
                    if (error_5 instanceof TypeError && error_5.message.includes('fetch')) {
                        console.error('[NAVER-RANK] 네트워크 오류 또는 fetch API를 사용할 수 없습니다');
                        errorMsg = (error_5 === null || error_5 === void 0 ? void 0 : error_5.message) || String(error_5 || '').toLowerCase();
                        isRealNetworkError = errorMsg.includes('failed to fetch') ||
                            errorMsg.includes('networkerror') ||
                            errorMsg.includes('network request failed') ||
                            errorMsg.includes('err_network') ||
                            errorMsg.includes('enotfound') ||
                            errorMsg.includes('econnrefused') ||
                            errorMsg.includes('etimedout') ||
                            errorMsg.includes('econnreset');
                        if (isRealNetworkError) {
                            throw new Error('네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해주세요.');
                        }
                        else {
                            // 네트워크 오류가 아닌 경우 원래 오류 메시지 사용
                            throw error_5;
                        }
                    }
                    if (error_5.message && error_5.message.includes('401')) {
                        throw new Error('네이버 API 인증 정보가 올바르지 않습니다. Client ID와 Client Secret을 확인해주세요.');
                    }
                    if (error_5.message && error_5.message.includes('403')) {
                        throw new Error('네이버 API 접근이 거부되었습니다. API 사용 권한을 확인해주세요.');
                    }
                    if (error_5.message && error_5.message.includes('429')) {
                        throw new Error('네이버 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
                    }
                    // 기타 에러는 원래 에러 메시지 유지
                    throw new Error("\uB124\uC774\uBC84 \uB7AD\uD0B9 API \uC624\uB958: ".concat(error_5.message || '알 수 없는 오류'));
                case 25: return [2 /*return*/];
            }
        });
    });
}
/**
 * 네이버 블로그 검색 API 폴백 함수 (검색광고 API 실패 시 사용)
 * 띄어쓰기 포함 키워드나 400 에러 발생 시 사용
 * ⚠️ export 추가: 다른 모듈에서도 사용 가능하도록
 */
function getBlogSearchFallback(config, keyword) {
    return __awaiter(this, void 0, void 0, function () {
        var apiUrl, params, response, data, total, estimatedSearchVolume, pcVolume, mobileVolume, error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                    params = new URLSearchParams({
                        query: keyword,
                        display: '1', // 1개만 조회 (total 필드 확인용)
                        sort: 'sim'
                    });
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params.toString()), {
                            headers: {
                                'X-Naver-Client-Id': config.clientId,
                                'X-Naver-Client-Secret': config.clientSecret
                            }
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    data = _a.sent();
                    total = parseInt(data.total || '0', 10);
                    estimatedSearchVolume = Math.floor(total * 0.3);
                    pcVolume = Math.floor(estimatedSearchVolume * 0.2);
                    mobileVolume = Math.floor(estimatedSearchVolume * 0.8);
                    console.log("[NAVER-VOLUME] \uBE14\uB85C\uADF8 \uAC80\uC0C9 API \uD3F4\uBC31 \"".concat(keyword, "\": \uBB38\uC11C\uC218=").concat(total, ", \uCD94\uC815 \uAC80\uC0C9\uB7C9=PC ").concat(pcVolume, ", \uBAA8\uBC14\uC77C ").concat(mobileVolume));
                    return [2 /*return*/, {
                            keyword: keyword,
                            pcSearchVolume: pcVolume,
                            mobileSearchVolume: mobileVolume
                        }];
                case 3:
                    error_6 = _a.sent();
                    console.error("[NAVER-VOLUME] \uBE14\uB85C\uADF8 \uAC80\uC0C9 API \uD3F4\uBC31 \uC2E4\uD328:", error_6);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * 네이버 블로그 검색 API를 사용하여 키워드별 검색량 조회 (PC/모바일 분리)
 * 검색량: 검색광고 API (띄어쓰기 제거 버전)
 * 문서수: 네이버 블로그 검색 API (원본 키워드)
 */
function getNaverKeywordSearchVolumeSeparate(config, keywords) {
    return __awaiter(this, void 0, void 0, function () {
        var results, _loop_1, _i, keywords_1, keyword;
        var _this = this;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!config.clientId || !config.clientSecret) {
                        throw new Error('네이버 API 인증 정보가 필요합니다');
                    }
                    results = [];
                    _loop_1 = function (keyword) {
                        var originalKeyword_1, processedKeyword_1, pcVolume, mobileVolume, documentCount, _d, searchVolumeResult, documentCountResult, errorMessage, error_7, errorMessage;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    _e.trys.push([0, 3, , 4]);
                                    originalKeyword_1 = keyword;
                                    processedKeyword_1 = originalKeyword_1.replace(/\s+/g, '');
                                    pcVolume = 0;
                                    mobileVolume = 0;
                                    documentCount = 0;
                                    return [4 /*yield*/, Promise.allSettled([
                                            // 1. 검색량: 검색광고 API (띄어쓰기 제거 버전)
                                            (function () { return __awaiter(_this, void 0, void 0, function () {
                                                var getNaverSearchAdKeywordVolume, envManager, envConfig, customerId, parts, firstPart, finalCustomerId, searchAdConfig, timeoutPromise, searchAdResults, result, pcVol, mobileVol;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require('./naver-searchad-api'); })];
                                                        case 1:
                                                            getNaverSearchAdKeywordVolume = (_a.sent()).getNaverSearchAdKeywordVolume;
                                                            return [4 /*yield*/, Promise.resolve().then(function () { return require('./environment-manager'); })];
                                                        case 2:
                                                            envManager = (_a.sent()).EnvironmentManager.getInstance();
                                                            envConfig = envManager.getConfig();
                                                            if (!envConfig.naverSearchAdAccessLicense || !envConfig.naverSearchAdSecretKey) {
                                                                throw new Error("\uAC80\uC0C9\uAD11\uACE0 API \uC778\uC99D \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4. Access License\uC640 Secret Key\uB97C \uC124\uC815\uD574\uC8FC\uC138\uC694.");
                                                            }
                                                            customerId = envConfig.naverSearchAdCustomerId;
                                                            if (!customerId || customerId.trim() === '') {
                                                                parts = envConfig.naverSearchAdAccessLicense.split(':');
                                                                firstPart = parts[0];
                                                                if (parts.length > 1 && firstPart && firstPart.trim() !== '') {
                                                                    customerId = firstPart;
                                                                }
                                                                else {
                                                                    customerId = envConfig.naverSearchAdAccessLicense.substring(0, 10);
                                                                    console.warn("[NAVER-VOLUME] \u26A0\uFE0F customerId\uAC00 \uBA85\uC2DC\uC801\uC73C\uB85C \uC124\uC815\uB418\uC9C0 \uC54A\uC544 accessLicense\uC5D0\uC11C \uCD94\uCD9C: \"".concat(customerId, "\". \uC815\uD655\uD55C customerId(\uC608: 3992868)\uB97C NAVER_SEARCH_AD_CUSTOMER_ID \uD658\uACBD \uBCC0\uC218\uC5D0 \uC124\uC815\uD558\uC138\uC694."));
                                                                }
                                                            }
                                                            finalCustomerId = (customerId && customerId.trim() !== '') ? customerId.trim() : undefined;
                                                            searchAdConfig = {
                                                                accessLicense: envConfig.naverSearchAdAccessLicense,
                                                                secretKey: envConfig.naverSearchAdSecretKey
                                                            };
                                                            if (finalCustomerId) {
                                                                searchAdConfig.customerId = finalCustomerId;
                                                            }
                                                            timeoutPromise = new Promise(function (_, reject) {
                                                                return setTimeout(function () { return reject(new Error('검색광고 API 타임아웃 (60초 초과)')); }, 60000);
                                                            });
                                                            return [4 /*yield*/, Promise.race([
                                                                    getNaverSearchAdKeywordVolume(searchAdConfig, [processedKeyword_1]),
                                                                    timeoutPromise
                                                                ])];
                                                        case 3:
                                                            searchAdResults = _a.sent();
                                                            if (searchAdResults && searchAdResults.length > 0 && searchAdResults[0]) {
                                                                result = searchAdResults[0];
                                                                pcVol = result.pcSearchVolume || 0;
                                                                mobileVol = result.mobileSearchVolume || 0;
                                                                if (pcVol > 0 || mobileVol > 0) {
                                                                    console.log("[NAVER-VOLUME] \u2705 \uAC80\uC0C9\uAD11\uACE0 API \"".concat(processedKeyword_1, "\" (\uC6D0\uBCF8: \"").concat(originalKeyword_1, "\"): PC=").concat(pcVol, ", \uBAA8\uBC14\uC77C=").concat(mobileVol));
                                                                    return [2 /*return*/, { pcVolume: pcVol, mobileVolume: mobileVol }];
                                                                }
                                                            }
                                                            return [2 /*return*/, { pcVolume: 0, mobileVolume: 0 }];
                                                    }
                                                });
                                            }); })(),
                                            // 2. 문서수: 네이버 블로그 검색 API (원본 키워드)
                                            (function () { return __awaiter(_this, void 0, void 0, function () {
                                                var apiUrl, params, response, data, total;
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                                                            params = new URLSearchParams({
                                                                query: originalKeyword_1, // 원본 키워드 사용
                                                                display: '1', // 1개만 조회 (total 필드 확인용)
                                                                sort: 'sim'
                                                            });
                                                            return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params.toString()), {
                                                                    headers: {
                                                                        'X-Naver-Client-Id': config.clientId,
                                                                        'X-Naver-Client-Secret': config.clientSecret
                                                                    }
                                                                })];
                                                        case 1:
                                                            response = _a.sent();
                                                            if (!response.ok) {
                                                                return [2 /*return*/, 0];
                                                            }
                                                            return [4 /*yield*/, response.json()];
                                                        case 2:
                                                            data = _a.sent();
                                                            total = parseInt(data.total || '0', 10);
                                                            console.log("[NAVER-VOLUME] \u2705 \uBE14\uB85C\uADF8 \uAC80\uC0C9 API \"".concat(originalKeyword_1, "\": \uBB38\uC11C\uC218=").concat(total));
                                                            return [2 /*return*/, total];
                                                    }
                                                });
                                            }); })()
                                        ])];
                                case 1:
                                    _d = _e.sent(), searchVolumeResult = _d[0], documentCountResult = _d[1];
                                    // 검색량 결과 처리
                                    if (searchVolumeResult.status === 'fulfilled') {
                                        pcVolume = searchVolumeResult.value.pcVolume;
                                        mobileVolume = searchVolumeResult.value.mobileVolume;
                                    }
                                    else {
                                        errorMessage = ((_a = searchVolumeResult.reason) === null || _a === void 0 ? void 0 : _a.message) || String(searchVolumeResult.reason || '');
                                        console.warn("[NAVER-VOLUME] \u26A0\uFE0F \"".concat(originalKeyword_1, "\" \uAC80\uC0C9\uB7C9 \uC870\uD68C \uC2E4\uD328: ").concat(errorMessage));
                                    }
                                    // 문서수 결과 처리
                                    if (documentCountResult.status === 'fulfilled') {
                                        documentCount = documentCountResult.value;
                                    }
                                    else {
                                        console.warn("[NAVER-VOLUME] \u26A0\uFE0F \"".concat(originalKeyword_1, "\" \uBB38\uC11C\uC218 \uC870\uD68C \uC2E4\uD328: ").concat(((_b = documentCountResult.reason) === null || _b === void 0 ? void 0 : _b.message) || String(documentCountResult.reason || '')));
                                    }
                                    // 결과 추가
                                    results.push({
                                        keyword: originalKeyword_1, // 원본 키워드 유지
                                        pcSearchVolume: pcVolume,
                                        mobileSearchVolume: mobileVolume,
                                        documentCount: documentCount
                                    });
                                    // API 호출 간격 조절 (500ms)
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 500); })];
                                case 2:
                                    // API 호출 간격 조절 (500ms)
                                    _e.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    error_7 = _e.sent();
                                    errorMessage = (error_7 === null || error_7 === void 0 ? void 0 : error_7.message) || String(error_7 || '');
                                    console.error("[NAVER-VOLUME] \u274C \uD0A4\uC6CC\uB4DC \"".concat(keyword, "\" \uCC98\uB9AC \uC2E4\uD328:"), errorMessage);
                                    // 에러 발생 시에도 기본값 반환
                                    results.push({
                                        keyword: keyword,
                                        pcSearchVolume: 0,
                                        mobileSearchVolume: 0,
                                        documentCount: 0
                                    });
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, keywords_1 = keywords;
                    _c.label = 1;
                case 1:
                    if (!(_i < keywords_1.length)) return [3 /*break*/, 4];
                    keyword = keywords_1[_i];
                    return [5 /*yield**/, _loop_1(keyword)];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
/**
 * 네이버 블로그 검색 API를 사용하여 키워드별 검색량 조회 (기존 함수 유지)
 */
function getNaverKeywordSearchVolume(config, keywords) {
    return __awaiter(this, void 0, void 0, function () {
        var separateResults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getNaverKeywordSearchVolumeSeparate(config, keywords)];
                case 1:
                    separateResults = _a.sent();
                    return [2 /*return*/, separateResults.map(function (item) { return ({
                            keyword: item.keyword,
                            searchVolume: item.pcSearchVolume + item.mobileSearchVolume
                        }); })];
            }
        });
    });
}
/**
 * 네이버 연관 키워드 수집 (검색 제안, 관련 검색어 활용)
 */
function getNaverRelatedKeywords(baseKeyword_1, config_1) {
    return __awaiter(this, arguments, void 0, function (baseKeyword, config, options) {
        var _a, page, _b, limit, results, apiUrl, headers, params, response, data, items, extractedKeywords_1, keywordCombinations_1, filteredKeywords, uniqueKeywords, rank_1, limit_1, startIdx, endIdx, keywordArray, _i, _c, keyword, categoryKeywords, catKwList, error_8;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!config.clientId || !config.clientSecret) {
                        throw new Error('네이버 API 인증 정보가 필요합니다');
                    }
                    _a = options.page, page = _a === void 0 ? 0 : _a, _b = options.limit, limit = _b === void 0 ? 10 : _b;
                    results = [];
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 5, , 6]);
                    apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
                    headers = {
                        'X-Naver-Client-Id': config.clientId,
                        'X-Naver-Client-Secret': config.clientSecret
                    };
                    params = new URLSearchParams({
                        query: baseKeyword,
                        display: '100',
                        sort: 'sim'
                    });
                    return [4 /*yield*/, fetch("".concat(apiUrl, "?").concat(params), {
                            method: 'GET',
                            headers: headers
                        })];
                case 2:
                    response = _d.sent();
                    if (!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _d.sent();
                    items = data.items || [];
                    extractedKeywords_1 = new Set();
                    items.forEach(function (item) {
                        var _a, _b;
                        var title = ((_a = item.title) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '').trim()) || '';
                        var description = ((_b = item.description) === null || _b === void 0 ? void 0 : _b.replace(/<[^>]*>/g, '').trim()) || '';
                        // 1. 제목에서 입력 키워드를 포함하는 전체 구문 추출 (우선순위 높음)
                        if (title.includes(baseKeyword)) {
                            // 제목을 단어 단위로 분리 (더 정확한 분리)
                            var titleWords_1 = title.split(/[\s|,，、·\[\]()【】「」<>]+/).filter(function (w) { return w.trim().length > 0; });
                            // 입력 키워드를 포함하는 단어의 인덱스 찾기
                            var keywordIndexes_1 = [];
                            titleWords_1.forEach(function (word, idx) {
                                if (word.includes(baseKeyword)) {
                                    keywordIndexes_1.push(idx);
                                }
                            });
                            // 각 키워드 위치에서 주변 단어 추출
                            keywordIndexes_1.forEach(function (keywordIdx) {
                                // 키워드 앞 단어들 (최대 2개)
                                for (var offset = 1; offset <= 2 && keywordIdx - offset >= 0; offset++) {
                                    var beforeWords = titleWords_1.slice(keywordIdx - offset, keywordIdx + 1);
                                    var phrase = beforeWords.join(' ').trim();
                                    if (phrase.length >= baseKeyword.length && phrase.length <= 25) {
                                        extractedKeywords_1.add(phrase);
                                    }
                                }
                                // 키워드 뒤 단어들 (최대 2개)
                                for (var offset = 1; offset <= 2 && keywordIdx + offset < titleWords_1.length; offset++) {
                                    var afterWords = titleWords_1.slice(keywordIdx, keywordIdx + offset + 1);
                                    var phrase = afterWords.join(' ').trim();
                                    if (phrase.length >= baseKeyword.length && phrase.length <= 25) {
                                        extractedKeywords_1.add(phrase);
                                    }
                                }
                                // 키워드 앞뒤 단어들 (앞 1개 + 뒤 1개)
                                if (keywordIdx > 0 && keywordIdx < titleWords_1.length - 1) {
                                    var aroundWords = titleWords_1.slice(keywordIdx - 1, keywordIdx + 2);
                                    var phrase = aroundWords.join(' ').trim();
                                    if (phrase.length >= baseKeyword.length && phrase.length <= 25) {
                                        extractedKeywords_1.add(phrase);
                                    }
                                }
                            });
                            // 제목 전체가 짧으면 그대로 추가 (입력 키워드 포함 시)
                            if (title.length >= baseKeyword.length && title.length <= 30 && title.includes(baseKeyword)) {
                                extractedKeywords_1.add(title.replace(/<[^>]*>/g, '').trim());
                            }
                        }
                        // 2. 설명에서도 입력 키워드를 포함하는 구문 추출
                        if (description.includes(baseKeyword)) {
                            var descSentences = description.split(/[.|!?。！？]/);
                            descSentences.forEach(function (sentence) {
                                if (sentence.includes(baseKeyword)) {
                                    var trimmed = sentence.trim();
                                    if (trimmed.length >= baseKeyword.length && trimmed.length <= 30) {
                                        extractedKeywords_1.add(trimmed);
                                    }
                                }
                            });
                        }
                        // 3. 실제 검색 패턴: "키워드 + 범용적이고 합리적인 검색 조합어" 생성
                        // 키워드 타입별 적절한 조합어만 사용 (사람 이름 등은 가격 제외)
                        var getRelevantSuffixes = function (keyword) {
                            var keywordLower = keyword.toLowerCase();
                            // 사람 이름 감지 (한글 2-4자 패턴, 일반적인 한국 이름)
                            var isPersonName = /^[가-힣]{2,4}$/.test(keyword) &&
                                !keyword.match(/임플란트|치과|치료|수술|병원|의료|건강|약|진료|상담|스마트폰|폰|컴퓨터|노트북|자동차|가전|제품|상품|카페|음식점|맛집|호텔|여행|숙박|학원|교육|강의/);
                            // 사람 이름이면 가격/비용 관련 조합 제외
                            if (isPersonName) {
                                return ['누구', '누구인가', '사건', '사고', '소식', '뉴스', '영화', '작품', '이야기', '인물', '약력', '전기'];
                            }
                            // 의료/건강 관련 키워드 (임플란트, 치료 등)
                            if (keyword.match(/임플란트|치과|치료|수술|병원|의료|건강|약|진료|상담/)) {
                                return ['가격', '비용', '비교', '추천', '정보', '후기', '리뷰', '종류', '방법', '수술', '과정', '부작용'];
                            }
                            // 제품 관련 키워드
                            if (keyword.match(/스마트폰|폰|컴퓨터|노트북|자동차|가전|제품|상품/)) {
                                return ['가격', '비용', '비교', '추천', '리뷰', '후기', '구매', '할인', '이벤트', '순위', '성능', '스펙'];
                            }
                            // 서비스/장소 관련
                            if (keyword.match(/카페|음식점|맛집|호텔|여행|숙박|학원|교육|강의/)) {
                                return ['추천', '정보', '후기', '리뷰', '위치', '가격', '비교', '메뉴', '시설'];
                            }
                            // 일반적인 키워드 (범용적 조합)
                            return ['가격', '비용', '비교', '추천', '정보', '리뷰', '후기', '순위'];
                        };
                        // 말도 안 되는 조합을 제외하기 위한 검증 함수
                        var isValidCombination = function (keyword, suffix) {
                            var combined = "".concat(keyword, " ").concat(suffix).toLowerCase();
                            // 말도 안 되는 조합 패턴 제외
                            var invalidPatterns = [
                                /먹는법|먹는 방법|먹기|먹어|마시는법|마시는 방법|마시기|마셔/, // 음식이 아닌데 먹는법
                                /키우는법|키우는 방법|키우기/, // 사람/제품에 키우기
                                /재배|재배법|재배방법/, // 부적절한 재배 관련
                                /번식|번식법/, // 부적절한 번식 관련
                                /입양|입양법/, // 사람/제품에 입양
                            ];
                            // 키워드가 음식/요리 관련이 아니면 "먹는법" 같은 조합 제외
                            var isFoodRelated = keyword.match(/음식|요리|레시피|맛집|식당|카페|음료|음주|식사/);
                            if (!isFoodRelated && /먹는법|먹는 방법/.test(suffix)) {
                                return false;
                            }
                            // 패턴 검증
                            for (var _i = 0, invalidPatterns_1 = invalidPatterns; _i < invalidPatterns_1.length; _i++) {
                                var pattern = invalidPatterns_1[_i];
                                if (pattern.test(combined)) {
                                    return false;
                                }
                            }
                            return true;
                        };
                        var relevantSuffixes = getRelevantSuffixes(baseKeyword);
                        // 키워드 + 접미사 조합 (검증 후에만 추가)
                        relevantSuffixes.forEach(function (suffix) {
                            if (isValidCombination(baseKeyword, suffix)) {
                                var combined = "".concat(baseKeyword, " ").concat(suffix).trim();
                                if (combined.length >= baseKeyword.length && combined.length <= 25) {
                                    extractedKeywords_1.add(combined);
                                }
                            }
                        });
                    });
                    keywordCombinations_1 = new Set();
                    // 검색 결과 제목들을 분석하여 자주 함께 나오는 단어 추출
                    items.forEach(function (item) {
                        var _a;
                        var title = ((_a = item.title) === null || _a === void 0 ? void 0 : _a.replace(/<[^>]*>/g, '').trim()) || '';
                        if (title.includes(baseKeyword)) {
                            // 키워드 앞뒤로 자주 나오는 단어들 추출
                            var words = title.split(/[\s|,，、·\[\]()【】「」<>]+/).filter(function (w) { return w.trim().length > 0; });
                            // 키워드의 위치 찾기
                            var keywordIndex = words.findIndex(function (w) { return w.includes(baseKeyword); });
                            if (keywordIndex >= 0) {
                                // 키워드 앞 단어들 조합
                                if (keywordIndex > 0) {
                                    var beforeWord = words[keywordIndex - 1];
                                    if (beforeWord && beforeWord.length >= 2 && beforeWord.length <= 10) {
                                        keywordCombinations_1.add("".concat(beforeWord, " ").concat(baseKeyword).trim());
                                    }
                                }
                                // 키워드 뒤 단어들 조합
                                if (keywordIndex < words.length - 1) {
                                    var afterWord = words[keywordIndex + 1];
                                    if (afterWord && afterWord.length >= 2 && afterWord.length <= 10) {
                                        keywordCombinations_1.add("".concat(baseKeyword, " ").concat(afterWord).trim());
                                    }
                                }
                                // 키워드 앞뒤 모두
                                if (keywordIndex > 0 && keywordIndex < words.length - 1) {
                                    var beforeWord = words[keywordIndex - 1];
                                    var afterWord = words[keywordIndex + 1];
                                    if (beforeWord && afterWord && beforeWord.length >= 2 && afterWord.length <= 8 && afterWord.length >= 2 && afterWord.length <= 8) {
                                        keywordCombinations_1.add("".concat(beforeWord, " ").concat(baseKeyword, " ").concat(afterWord).trim());
                                    }
                                }
                            }
                        }
                    });
                    // 추출된 조합들을 extractedKeywords에 추가
                    keywordCombinations_1.forEach(function (comb) {
                        if (comb.length >= baseKeyword.length && comb.length <= 30) {
                            extractedKeywords_1.add(comb);
                        }
                    });
                    filteredKeywords = Array.from(extractedKeywords_1).filter(function (kw) {
                        var trimmed = kw.trim();
                        // 길이 체크 (입력 키워드 길이 이상, 30자 이하)
                        if (trimmed.length < baseKeyword.length || trimmed.length > 30)
                            return false;
                        // 완전히 제외할 패턴 체크
                        var strictExcludePatterns = /^(더보기|클릭|바로가기|이동|보기|더|또|그리고|그런데)$/;
                        if (strictExcludePatterns.test(trimmed))
                            return false;
                        // 말도 안 되는 조합 제외 (입력 키워드가 포함되어 있어도 부적절한 조합 제거)
                        var invalidCombinations = [
                            /먹는법|먹는 방법|먹기|먹어|마시는법|마시는 방법/, // 음식이 아닌데 먹는법
                            /키우는법|키우는 방법|키우기/,
                            /재배|재배법|번식|번식법|입양/,
                        ];
                        // 키워드가 음식 관련이 아니면 "먹는법" 제외
                        var isFoodRelated = baseKeyword.match(/음식|요리|레시피|맛집|식당|카페|음료|음주|식사|과자|음식물/);
                        if (!isFoodRelated) {
                            for (var _i = 0, invalidCombinations_1 = invalidCombinations; _i < invalidCombinations_1.length; _i++) {
                                var pattern = invalidCombinations_1[_i];
                                if (pattern.test(trimmed)) {
                                    return false;
                                }
                            }
                        }
                        // 입력 키워드가 반드시 포함되어야 함 (연관성 보장)
                        if (!trimmed.includes(baseKeyword)) {
                            return false;
                        }
                        // 한글/영문/숫자가 포함되어 있어야 함
                        var hasValidChars = /[가-힣a-zA-Z0-9]+/.test(trimmed);
                        return hasValidChars;
                    });
                    uniqueKeywords = Array.from(new Set(filteredKeywords)).sort(function (a, b) {
                        // 1순위: 입력 키워드 자체가 최우선
                        if (a === baseKeyword)
                            return -1;
                        if (b === baseKeyword)
                            return 1;
                        // 2순위: 입력 키워드로 시작하는 것 우선
                        var aStartsWith = a.startsWith(baseKeyword);
                        var bStartsWith = b.startsWith(baseKeyword);
                        if (aStartsWith && !bStartsWith)
                            return -1;
                        if (!aStartsWith && bStartsWith)
                            return 1;
                        // 3순위: 입력 키워드가 정확히 포함된 것 (부분 일치보다 우선)
                        var aExactMatch = a === baseKeyword || a.split(/\s+/).includes(baseKeyword);
                        var bExactMatch = b === baseKeyword || b.split(/\s+/).includes(baseKeyword);
                        if (aExactMatch && !bExactMatch)
                            return -1;
                        if (!aExactMatch && bExactMatch)
                            return 1;
                        // 4순위: 입력 키워드가 포함된 것
                        var aContains = a.includes(baseKeyword);
                        var bContains = b.includes(baseKeyword);
                        if (aContains && !bContains)
                            return -1;
                        if (!aContains && bContains)
                            return 1;
                        // 5순위: 길이가 짧은 순 (명확한 키워드 우선)
                        if (a.length !== b.length)
                            return a.length - b.length;
                        return a.localeCompare(b);
                    });
                    // 입력 키워드가 결과에 없으면 맨 앞에 추가
                    if (!uniqueKeywords.includes(baseKeyword) && baseKeyword.trim().length > 0) {
                        uniqueKeywords.unshift(baseKeyword);
                    }
                    rank_1 = 1;
                    limit_1 = options.limit || 10;
                    startIdx = (options.page || 0) * limit_1;
                    endIdx = startIdx + limit_1;
                    keywordArray = uniqueKeywords.slice(startIdx, endIdx);
                    for (_i = 0, _c = keywordArray.slice(0, limit_1); _i < _c.length; _i++) {
                        keyword = _c[_i];
                        if (keyword && keyword.trim().length > 0 && rank_1 <= limit_1) {
                            results.push({
                                rank: rank_1++,
                                keyword: keyword.trim(),
                                changeRate: 0,
                                category: options.category || '일반',
                                searchVolume: 0 // 나중에 별도로 조회
                            });
                        }
                    }
                    // 입력 키워드가 없을 때는 더 많이 추출 (카테고리만 선택한 경우)
                    if (!baseKeyword || baseKeyword.trim().length === 0) {
                        categoryKeywords = {
                            '경제': ['경제뉴스', '주식', '부동산', '금융', '투자', '경제지표'],
                            'IT': ['IT뉴스', '테크', '스마트폰', '컴퓨터', '소프트웨어', '하드웨어'],
                            '생활': ['생활정보', '일상', '라이프스타일', '생활팁', '생활꿀팁'],
                            '엔터테인먼트': ['연예', '영화', '드라마', '음악', '예능', '스포츠'],
                            '건강': ['건강정보', '의료', '병원', '약', '운동', '다이어트'],
                            '교육': ['교육정보', '학원', '자격증', '공부', '학습', '온라인강의'],
                            '쇼핑': ['쇼핑몰', '온라인쇼핑', '구매', '할인', '이벤트', '쿠폰'],
                            '음식': ['맛집', '레시피', '요리', '카페', '음식점', '맛집추천'],
                            '여행': ['여행지', '호텔', '숙박', '관광', '해외여행', '국내여행'],
                            '자동차': ['자동차정보', '차량', '전기차', '중고차', '카센터'],
                            '부동산': ['부동산정보', '아파트', '오피스텔', '임대', '매매'],
                            '스포츠': ['스포츠뉴스', '축구', '야구', '농구', '골프', '경기'],
                            '게임': ['게임뉴스', '온라인게임', '모바일게임', '콘솔게임', 'PC게임'],
                            '금융': ['금융정보', '은행', '카드', '대출', '적금', '펀드']
                        };
                        if (options.category) {
                            catKwList = categoryKeywords[options.category];
                            if (catKwList && Array.isArray(catKwList)) {
                                catKwList.forEach(function (catKw) {
                                    if (results.length < limit_1 && !results.some(function (r) { return r.keyword === catKw; })) {
                                        results.push({
                                            rank: rank_1++,
                                            keyword: catKw,
                                            changeRate: 0,
                                            category: options.category || '일반',
                                            searchVolume: 0
                                        });
                                    }
                                });
                            }
                        }
                    }
                    _d.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    error_8 = _d.sent();
                    console.error('[NAVER-RELATED] 연관 키워드 수집 실패:', error_8);
                    throw error_8;
                case 6: return [2 /*return*/, results];
            }
        });
    });
}
// 유틸리티 함수
function getDateToday() {
    var date = new Date();
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return "".concat(year, "-").concat(month, "-").concat(day);
}
function getDateDaysAgo(days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return "".concat(year, "-").concat(month, "-").concat(day);
}
