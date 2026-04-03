"use strict";
/**
 * 네이버 검색광고 키워드 도구 API
 * 정확한 PC/모바일 검색량 조회
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
exports.getNaverSearchAdKeywordVolume = getNaverSearchAdKeywordVolume;
var crypto_1 = require("crypto");
function generateSignature(method, uri, timestamp, // 밀리초 단위 문자열
secretKey) {
    // 네이버 검색광고 API 서명 생성 방식
    // ✅ 정확한 방법:
    // message = f"{timestamp}.{method}.{uri}"
    // signature = base64.b64encode(
    //   hmac.new(secret_key.encode('utf-8'), 
    //            message.encode('utf-8'), 
    //            hashlib.sha256).digest()
    // ).decode('utf-8')
    //
    // 핵심:
    // 1. 메시지 형식: "{timestamp}.{HTTP_METHOD}.{URI}" (점으로 구분)
    // 2. Timestamp: 밀리초 단위 (문자열)
    // 3. URI: 쿼리 파라미터 제외한 경로만 (예: "/keywordstool")
    // 4. Secret Key: base64 디코딩하지 않고 그대로 UTF-8로 사용
    // 5. HMAC 결과: base64로 인코딩 (hex 아님!)
    // 6. POST 요청: body hash 포함하지 않음 (GET과 동일한 방식)
    // 메시지 생성: {timestamp}.{HTTP_METHOD}.{URI}
    // 네이버 검색광고 API는 GET/POST 모두 동일한 방식으로 서명 생성
    // body hash는 포함하지 않음
    var message = "".concat(timestamp, ".").concat(method.toUpperCase(), ".").concat(uri);
    // digest()가 이미 Buffer를 반환하므로 바로 base64로 변환
    return (0, crypto_1.createHmac)('sha256', secretKey)
        .update(message, 'utf8')
        .digest('base64');
}
// generateAltSignature 함수는 더 이상 필요 없음 (올바른 서명 방식으로 통일)
function getNaverSearchAdKeywordVolume(config, keywords) {
    return __awaiter(this, void 0, void 0, function () {
        var customerId, parts, extracted, extracted, results, _loop_1, _i, keywords_1, keyword;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!config.accessLicense || !config.secretKey) {
                        throw new Error('네이버 검색광고 API 인증 정보가 필요합니다');
                    }
                    if (config.customerId && typeof config.customerId === 'string' && config.customerId.trim() !== '') {
                        customerId = config.customerId.trim();
                    }
                    else {
                        parts = config.accessLicense.split(':');
                        if (parts.length > 1 && parts[0] && typeof parts[0] === 'string' && parts[0].trim() !== '') {
                            customerId = parts[0].trim(); // "CUSTOMER_ID:ACCESS_LICENSE" 형식
                        }
                        else {
                            extracted = config.accessLicense.substring(0, Math.min(10, config.accessLicense.length));
                            customerId = extracted;
                            console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F customerId\uAC00 \uBA85\uC2DC\uC801\uC73C\uB85C \uC124\uC815\uB418\uC9C0 \uC54A\uC544 accessLicense\uC5D0\uC11C \uCD94\uCD9C: \"".concat(customerId, "\". \uC815\uD655\uD55C customerId\uB97C \uC124\uC815\uD558\uC138\uC694."));
                        }
                    }
                    // customerId가 확실히 string임을 보장 (최종 안전장치)
                    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
                        extracted = config.accessLicense.substring(0, Math.min(10, config.accessLicense.length));
                        customerId = extracted;
                        console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F customerId\uAC00 \uBE44\uC5B4\uC788\uC5B4 accessLicense\uC5D0\uC11C \uCD94\uCD9C: \"".concat(customerId, "\""));
                    }
                    // 첫 번째 키워드의 경우 customerId 로깅 (디버깅용)
                    if (keywords.length > 0 && keywords[0]) {
                        console.log("[NAVER-SEARCHAD] customerId \uC0AC\uC6A9: \"".concat(customerId, "\" (accessLicense: ").concat(config.accessLicense.substring(0, 20), "...)"));
                    }
                    results = [];
                    _loop_1 = function (keyword) {
                        var cleanKeyword, originalKeyword, apiUrl, uri, method, timestamp, processedKeyword, params, signature, controller_1, timeoutId, response, headers, fullUrl, fetchErr_1, errorText, errorBuffer, textErr_1, bufferErr_1, clonedResponse, contentType, contentLength, cloneErr_1, errorJson, isFirstKeyword, headerObj_1, paramsObj, hintKeywordValue, encodedKeyword, isUrlEncodingCorrect, alternativeSuccess, alternativeParams1, alternativeTimestamp1, alternativeSignature1, alternativeHeaders1, alternativeUrl1, alternativeController1_1, alternativeTimeoutId1, alternativeResponse1, alternativeError_1, retryAfter, retryDelay, retryCount, maxRetries, retrySuccess, _loop_2, state_1, finalErrorText, data, jsonError_1, keywordList, getBlogSearchFallback, envManager, envConfig, fallbackConfig, fallbackResult, fallbackError_1, decodeHtmlEntities_1, normalizedOriginalKeyword_1, normalizedProcessedKeyword_1, keywordData, foundKeywordRaw, foundKeyword, extractedKeyword, pcVolume, pcVolumeValue, mobileVolume, mobileVolumeValue, totalVolumeField, finalPcVolume, finalMobileVolume, finalTotalVolumeField, finalTotalVolume, baseDelay, keywordIndex, delay_1, error_1, errorMessage, isFirstKeyword;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    cleanKeyword = keyword.trim();
                                    originalKeyword = cleanKeyword;
                                    _e.label = 1;
                                case 1:
                                    _e.trys.push([1, 43, , 44]);
                                    apiUrl = 'https://api.searchad.naver.com/keywordstool';
                                    uri = '/keywordstool';
                                    method = 'GET';
                                    timestamp = String(Date.now());
                                    processedKeyword = cleanKeyword
                                        .replace(/['"]/g, '') // 작은따옴표, 큰따옴표 제거
                                        .replace(/[&<>]/g, '') // HTML 특수문자 제거
                                        .replace(/[^\w\s가-힣]/g, '') // 영문, 숫자, 한글, 공백만 허용 (특수문자 모두 제거)
                                        .trim() // 앞뒤 공백 제거
                                        .replace(/\s+/g, ' ');
                                    // 키워드가 비어있으면 원본 그대로 사용
                                    if (!processedKeyword || processedKeyword.length === 0) {
                                        processedKeyword = cleanKeyword.trim();
                                    }
                                    // 네이버 검색광고 API 키워드 길이 제한 확인 (일반적으로 100자 이하, 실제로는 더 짧을 수 있음)
                                    // 15자 제한이 있었던 것으로 보이므로 보수적으로 15자로 제한
                                    if (processedKeyword.length > 15) {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uD0A4\uC6CC\uB4DC \uAE38\uC774 \uCD08\uACFC (").concat(processedKeyword.length, "\uC790), 15\uC790\uB85C \uC81C\uD55C"));
                                        processedKeyword = processedKeyword.substring(0, 15).trim();
                                    }
                                    params = new URLSearchParams();
                                    // hintKeywords를 배열 형태로 전달 (JSON 문자열)
                                    // 예: hintKeywords=["키워드1","키워드2"] 또는 hintKeywords=키워드1,키워드2
                                    // 네이버 API는 쉼표로 구분된 문자열도 받을 수 있음
                                    params.append('hintKeywords', processedKeyword);
                                    params.append('showDetail', '1');
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\": hintKeywords \uC0AC\uC6A9 (\uB744\uC5B4\uC4F0\uAE30 ").concat(processedKeyword.includes(' ') ? '포함' : '없음', ")"));
                                    }
                                    // 첫 번째 키워드의 경우 요청 정보 로깅
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" API \uC694\uCCAD \uC815\uBCF4:"), {
                                            url: apiUrl,
                                            uri: uri,
                                            method: method,
                                            timestamp: timestamp,
                                            params: params.toString(),
                                            keyword: processedKeyword,
                                            keywordEncoded: encodeURIComponent(processedKeyword),
                                            keywordWithPlus: processedKeyword.replace(/\s+/g, '+'),
                                            'params.toString()': params.toString(),
                                            'URLSearchParams keys': Array.from(params.keys()),
                                            'URLSearchParams values': Array.from(params.values())
                                        });
                                    }
                                    signature = generateSignature(method, uri, timestamp, config.secretKey);
                                    controller_1 = new AbortController();
                                    timeoutId = setTimeout(function () { return controller_1.abort(); }, 60000);
                                    response = void 0;
                                    _e.label = 2;
                                case 2:
                                    _e.trys.push([2, 4, , 5]);
                                    headers = {
                                        'X-Timestamp': timestamp,
                                        'X-API-KEY': config.accessLicense,
                                        'X-Signature': signature,
                                        'X-Customer': customerId // 필수 헤더
                                        // Content-Type은 GET 요청에서 제거 (쿼리 파라미터로 전송하므로)
                                    };
                                    // 첫 번째 키워드의 경우 헤더 정보 상세 로깅 (디버깅용)
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC694\uCCAD \uD5E4\uB354:"), {
                                            'X-Timestamp': timestamp,
                                            'X-API-KEY': config.accessLicense.substring(0, 20) + '...',
                                            'X-Signature': signature.substring(0, 20) + '...',
                                            'X-Customer': customerId,
                                            'customerId_length': customerId.length,
                                            'accessLicense_prefix': config.accessLicense.substring(0, 15),
                                            'headers_count': Object.keys(headers).length,
                                            'all_headers': Object.keys(headers)
                                        });
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uCFFC\uB9AC \uD30C\uB77C\uBBF8\uD130:"), params.toString());
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC804\uCCB4 URL:"), "".concat(apiUrl, "?").concat(params.toString()));
                                    }
                                    fullUrl = "".concat(apiUrl, "?").concat(params.toString());
                                    return [4 /*yield*/, fetch(fullUrl, {
                                            method: method,
                                            headers: headers,
                                            signal: controller_1.signal
                                        })];
                                case 3:
                                    response = _e.sent();
                                    clearTimeout(timeoutId);
                                    return [3 /*break*/, 5];
                                case 4:
                                    fetchErr_1 = _e.sent();
                                    clearTimeout(timeoutId);
                                    if (fetchErr_1.name === 'AbortError') {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uD0C0\uC784\uC544\uC6C3 (AbortError) - 0 \uBC18\uD658"));
                                        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                        return [2 /*return*/, "continue"];
                                    }
                                    throw fetchErr_1;
                                case 5:
                                    if (!!response.ok) return [3 /*break*/, 28];
                                    errorText = '';
                                    errorBuffer = null;
                                    _e.label = 6;
                                case 6:
                                    _e.trys.push([6, 8, , 13]);
                                    return [4 /*yield*/, response.text()];
                                case 7:
                                    // 먼저 text로 읽기 시도
                                    errorText = _e.sent();
                                    return [3 /*break*/, 13];
                                case 8:
                                    textErr_1 = _e.sent();
                                    _e.label = 9;
                                case 9:
                                    _e.trys.push([9, 11, , 12]);
                                    return [4 /*yield*/, response.clone().arrayBuffer()];
                                case 10:
                                    // text 실패 시 arrayBuffer로 읽기
                                    errorBuffer = _e.sent();
                                    errorText = Buffer.from(errorBuffer).toString('utf-8');
                                    return [3 /*break*/, 12];
                                case 11:
                                    bufferErr_1 = _e.sent();
                                    errorText = 'Response body 읽기 실패';
                                    return [3 /*break*/, 12];
                                case 12: return [3 /*break*/, 13];
                                case 13:
                                    if (!(!errorText || errorText.trim() === '')) return [3 /*break*/, 17];
                                    _e.label = 14;
                                case 14:
                                    _e.trys.push([14, 16, , 17]);
                                    clonedResponse = response.clone();
                                    return [4 /*yield*/, clonedResponse.text()];
                                case 15:
                                    errorText = _e.sent();
                                    if (!errorText || errorText.trim() === '') {
                                        contentType = response.headers.get('content-type') || '';
                                        contentLength = response.headers.get('content-length') || '0';
                                        errorText = "[\uBE48 \uC751\uB2F5 \uBCF8\uBB38] Content-Type: ".concat(contentType, ", Content-Length: ").concat(contentLength);
                                    }
                                    return [3 /*break*/, 17];
                                case 16:
                                    cloneErr_1 = _e.sent();
                                    errorText = '응답 본문 읽기 실패 (클론도 실패)';
                                    return [3 /*break*/, 17];
                                case 17:
                                    errorJson = {};
                                    try {
                                        if (errorText && errorText.trim() !== '' && !errorText.startsWith('[')) {
                                            errorJson = JSON.parse(errorText);
                                        }
                                    }
                                    catch (_f) { }
                                    isFirstKeyword = keywords.indexOf(keyword) === 0;
                                    if (isFirstKeyword) {
                                        headerObj_1 = {};
                                        try {
                                            response.headers.forEach(function (value, key) {
                                                headerObj_1[key] = value;
                                            });
                                        }
                                        catch (_g) { }
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" API \uD638\uCD9C \uC2E4\uD328:"), {
                                            status: response.status,
                                            statusText: response.statusText,
                                            errorText: errorText.substring(0, 1000),
                                            errorTextLength: errorText.length,
                                            errorJson: errorJson,
                                            headers: headerObj_1,
                                            url: "".concat(apiUrl, "?").concat(params.toString()),
                                            keyword: keyword,
                                            keywordEncoded: encodeURIComponent(keyword),
                                            paramsString: params.toString()
                                        });
                                    }
                                    else {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" API \uD638\uCD9C \uC2E4\uD328: ").concat(response.status, " ").concat(response.statusText));
                                    }
                                    if (!(response.status === 400)) return [3 /*break*/, 22];
                                    paramsObj = Object.fromEntries(params.entries());
                                    hintKeywordValue = paramsObj['hintKeyword'] || paramsObj['hintKeywords'] || '';
                                    encodedKeyword = encodeURIComponent(processedKeyword);
                                    isUrlEncodingCorrect = hintKeywordValue === processedKeyword || decodeURIComponent(hintKeywordValue) === processedKeyword;
                                    // 400 에러 시 대안 파라미터로 재시도 (여러 방법 시도)
                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" 400 \uC5D0\uB7EC - \uB300\uC548 \uD30C\uB77C\uBBF8\uD130\uB85C \uC7AC\uC2DC\uB3C4 \uC2DC\uB3C4"));
                                    alternativeSuccess = false;
                                    _e.label = 18;
                                case 18:
                                    _e.trys.push([18, 20, , 21]);
                                    alternativeParams1 = new URLSearchParams();
                                    alternativeParams1.append('hintKeywords', processedKeyword);
                                    alternativeParams1.append('showDetail', '1');
                                    alternativeTimestamp1 = String(Date.now());
                                    alternativeSignature1 = generateSignature(method, uri, alternativeTimestamp1, config.secretKey);
                                    alternativeHeaders1 = {
                                        'X-Timestamp': alternativeTimestamp1,
                                        'X-API-KEY': config.accessLicense,
                                        'X-Signature': alternativeSignature1,
                                        'X-Customer': customerId
                                    };
                                    alternativeUrl1 = "".concat(apiUrl, "?").concat(alternativeParams1.toString());
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uB300\uC548 1: hintKeywords (\uBCF5\uC218\uD615) \uC7AC\uC2DC\uB3C4"));
                                    }
                                    alternativeController1_1 = new AbortController();
                                    alternativeTimeoutId1 = setTimeout(function () { return alternativeController1_1.abort(); }, 30000);
                                    return [4 /*yield*/, fetch(alternativeUrl1, {
                                            method: method,
                                            headers: alternativeHeaders1,
                                            signal: alternativeController1_1.signal
                                        })];
                                case 19:
                                    alternativeResponse1 = _e.sent();
                                    clearTimeout(alternativeTimeoutId1);
                                    if (alternativeResponse1.ok) {
                                        console.log("[NAVER-SEARCHAD] \u2705 \"".concat(keyword, "\" \uB300\uC548 \uD30C\uB77C\uBBF8\uD130(query)\uB85C \uC131\uACF5"));
                                        response = alternativeResponse1;
                                        alternativeSuccess = true;
                                    }
                                    else {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uB300\uC548 \uD30C\uB77C\uBBF8\uD130(query)\uB3C4 \uC2E4\uD328: ").concat(alternativeResponse1.status));
                                    }
                                    return [3 /*break*/, 21];
                                case 20:
                                    alternativeError_1 = _e.sent();
                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uB300\uC548 \uD30C\uB77C\uBBF8\uD130 \uC7AC\uC2DC\uB3C4 \uC911 \uC5D0\uB7EC:"), alternativeError_1.message);
                                    return [3 /*break*/, 21];
                                case 21:
                                    // 대안 파라미터로 성공했다면 여기서 계속 진행 (400 에러 처리 건너뛰기)
                                    if (alternativeSuccess) {
                                        // response가 업데이트되었으므로 원래 로직으로 계속 진행
                                    }
                                    else {
                                        // 모든 대안 파라미터 시도 실패 - 400 에러 처리 계속 진행
                                    }
                                    // 대안 파라미터로 성공했다면 response가 업데이트되어 response.ok가 true
                                    // 대안 파라미터도 실패했다면 response.status가 여전히 400
                                    if (!alternativeSuccess && response.status === 400) {
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" 400 \uC5D0\uB7EC \uC0C1\uC138:"), {
                                            errorText: errorText,
                                            errorJson: errorJson,
                                            url: "".concat(apiUrl, "?").concat(params.toString()),
                                            keyword: keyword,
                                            keywordLength: keyword.length,
                                            hasSpecialChars: /[^\w\s가-힣]/.test(keyword),
                                            keywordEncoded: encodeURIComponent(keyword),
                                            processedKeyword: processedKeyword,
                                            hintKeywordValue: hintKeywordValue,
                                            paramsString: params.toString()
                                        });
                                        if (isFirstKeyword) {
                                            console.error("[NAVER-SEARCHAD] \uD5E4\uB354 \uD655\uC778:", {
                                                hasApiKey: !!config.accessLicense,
                                                hasSecretKey: !!config.secretKey,
                                                hasSignature: !!signature,
                                                hasTimestamp: !!timestamp,
                                                hasCustomerId: !!customerId,
                                                customerIdValue: customerId,
                                                customerIdLength: (customerId === null || customerId === void 0 ? void 0 : customerId.length) || 0,
                                                accessLicenseLength: ((_a = config.accessLicense) === null || _a === void 0 ? void 0 : _a.length) || 0,
                                                secretKeyLength: ((_b = config.secretKey) === null || _b === void 0 ? void 0 : _b.length) || 0,
                                                signatureLength: (signature === null || signature === void 0 ? void 0 : signature.length) || 0,
                                                timestamp: timestamp,
                                                uri: uri,
                                                method: method,
                                                params: params.toString()
                                            });
                                            // 400 에러의 가능한 원인들 (정확한 진단)
                                            console.error("[NAVER-SEARCHAD] 400 \uC5D0\uB7EC \uAC00\uB2A5\uD55C \uC6D0\uC778:", {
                                                '1. 키워드 특수문자 문제': keyword.includes("'") || keyword.includes('"') || keyword.includes('&'),
                                                '2. 키워드 길이 문제': keyword.length > 100,
                                                '3. 파라미터 형식 문제': !params.toString().includes('hintKeyword') && !params.toString().includes('hintKeywords'),
                                                '4. 인증 정보 문제': !config.accessLicense || !config.secretKey || !customerId,
                                                '5. 서명 문제': !signature || signature.length < 20,
                                                '6. URL 인코딩 문제': !isUrlEncodingCorrect, // 실제 인코딩 상태 확인
                                                '7. hintKeyword/hintKeywords 값': hintKeywordValue,
                                                '8. processedKeyword': processedKeyword,
                                                '9. 인코딩 일치 여부': isUrlEncodingCorrect,
                                                '10. 띄어쓰기 포함': processedKeyword.includes(' '),
                                                '11. 사용된 파라미터': 'hintKeywords (복수형)'
                                            });
                                        }
                                        // 400 에러는 모든 시도 실패 시 0 반환
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" 400 \uC5D0\uB7EC: \uBAA8\uB4E0 \uC2DC\uB3C4 \uC2E4\uD328"));
                                        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                        return [2 /*return*/, "continue"];
                                    }
                                    _e.label = 22;
                                case 22:
                                    if (!(response.status === 429)) return [3 /*break*/, 26];
                                    retryAfter = response.headers.get('Retry-After') || '60';
                                    retryDelay = parseInt(retryAfter, 10) * 1000 || 60000;
                                    retryCount = 0;
                                    maxRetries = 5;
                                    retrySuccess = false;
                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" 429 Rate Limit \uAC10\uC9C0"));
                                    console.warn("[NAVER-SEARCHAD] \u2192 \uC7AC\uC2DC\uB3C4 \uC804\uB7B5: \uCD5C\uB300 ".concat(maxRetries, "\uD68C, \uCD08\uAE30 \uB300\uAE30 ").concat(retryAfter, "\uCD08"));
                                    _loop_2 = function () {
                                        var currentDelay, retryTimestamp, retrySignature, retryHeaders, retryFullUrl, retryController_1, retryTimeoutId, retryResponse, newRetryAfter, retryErr_1;
                                        return __generator(this, function (_h) {
                                            switch (_h.label) {
                                                case 0:
                                                    currentDelay = retryDelay + (retryCount * 30000);
                                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" 429 Rate Limit: ").concat(Math.floor(currentDelay / 1000), "\uCD08 \uB300\uAE30 \uD6C4 \uC7AC\uC2DC\uB3C4 ").concat(retryCount + 1, "/").concat(maxRetries, "..."));
                                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, currentDelay); })];
                                                case 1:
                                                    _h.sent();
                                                    retryCount++;
                                                    _h.label = 2;
                                                case 2:
                                                    _h.trys.push([2, 4, , 5]);
                                                    retryTimestamp = String(Date.now());
                                                    retrySignature = generateSignature(method, uri, retryTimestamp, config.secretKey);
                                                    retryHeaders = {
                                                        'X-Timestamp': retryTimestamp,
                                                        'X-API-KEY': config.accessLicense,
                                                        'X-Signature': retrySignature,
                                                        'X-Customer': customerId
                                                    };
                                                    retryFullUrl = "".concat(apiUrl, "?").concat(params.toString());
                                                    retryController_1 = new AbortController();
                                                    retryTimeoutId = setTimeout(function () { return retryController_1.abort(); }, 30000);
                                                    return [4 /*yield*/, fetch(retryFullUrl, {
                                                            method: method,
                                                            headers: retryHeaders,
                                                            signal: retryController_1.signal
                                                        })];
                                                case 3:
                                                    retryResponse = _h.sent();
                                                    clearTimeout(retryTimeoutId);
                                                    if (retryResponse.ok) {
                                                        // 성공 시 원래 로직으로 돌아감
                                                        response = retryResponse;
                                                        retrySuccess = true;
                                                        console.log("[NAVER-SEARCHAD] \u2705 \"".concat(keyword, "\" 429 \uC7AC\uC2DC\uB3C4 \uC131\uACF5 (").concat(retryCount, "\uBC88\uC9F8 \uC2DC\uB3C4)"));
                                                        return [2 /*return*/, "break"];
                                                    }
                                                    else if (retryResponse.status === 429) {
                                                        newRetryAfter = retryResponse.headers.get('Retry-After');
                                                        if (newRetryAfter) {
                                                            retryDelay = parseInt(newRetryAfter, 10) * 1000;
                                                            console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(maxRetries, ": \uC5EC\uC804\uD788 Rate Limit (\uC0C8\uB85C\uC6B4 \uB300\uAE30 \uC2DC\uAC04: ").concat(newRetryAfter, "\uCD08)"));
                                                        }
                                                        else {
                                                            console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(maxRetries, ": \uC5EC\uC804\uD788 Rate Limit"));
                                                        }
                                                        return [2 /*return*/, "continue"];
                                                    }
                                                    else {
                                                        // 다른 에러면 실패 처리
                                                        response = retryResponse;
                                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(maxRetries, ": \uB2E4\uB978 \uC5D0\uB7EC \uBC1C\uC0DD (").concat(retryResponse.status, ")"));
                                                        return [2 /*return*/, "break"];
                                                    }
                                                    return [3 /*break*/, 5];
                                                case 4:
                                                    retryErr_1 = _h.sent();
                                                    if (retryErr_1.name === 'AbortError') {
                                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(maxRetries, ": \uD0C0\uC784\uC544\uC6C3"));
                                                        if (retryCount >= maxRetries) {
                                                            results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                                            return [2 /*return*/, "continue"];
                                                        }
                                                        return [2 /*return*/, "continue"];
                                                    }
                                                    console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC7AC\uC2DC\uB3C4 ").concat(retryCount, "/").concat(maxRetries, ": \uC608\uC678 \uBC1C\uC0DD:"), retryErr_1.message);
                                                    if (retryCount >= maxRetries) {
                                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" 429 Rate Limit: \uCD5C\uB300 \uC7AC\uC2DC\uB3C4 \uD6C4 \uC2E4\uD328"));
                                                        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                                        return [2 /*return*/, "continue"];
                                                    }
                                                    return [3 /*break*/, 5];
                                                case 5: return [2 /*return*/];
                                            }
                                        });
                                    };
                                    _e.label = 23;
                                case 23:
                                    if (!(retryCount < maxRetries && !retrySuccess)) return [3 /*break*/, 25];
                                    return [5 /*yield**/, _loop_2()];
                                case 24:
                                    state_1 = _e.sent();
                                    if (state_1 === "break")
                                        return [3 /*break*/, 25];
                                    return [3 /*break*/, 23];
                                case 25:
                                    // 최대 재시도 후에도 실패하면 0 반환
                                    if (!retrySuccess && retryCount >= maxRetries) {
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" 429 Rate Limit: \uCD5C\uB300 \uC7AC\uC2DC\uB3C4(").concat(maxRetries, "\uD68C) \uD6C4 \uC2E4\uD328"));
                                        console.error("[NAVER-SEARCHAD] \u2192 \uB124\uC774\uBC84 \uAC80\uC0C9\uAD11\uACE0 API \uC694\uCCAD \uD55C\uB3C4 \uCD08\uACFC. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uAC70\uB098 API \uC0AC\uC6A9\uB7C9\uC744 \uD655\uC778\uD558\uC138\uC694.");
                                        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                        return [2 /*return*/, "continue"];
                                    }
                                    _e.label = 26;
                                case 26:
                                    // 403 에러 처리 (Invalid Signature 또는 Auth Failed)
                                    // 네이버 검색광고 API는 서명 인증이 매우 까다로워서 실패할 수 있음
                                    // 이 경우 조용히 실패하고 블로그 검색 API로 fallback
                                    if (response.status === 403) {
                                        if (keywords.indexOf(keyword) === 0) {
                                            console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" 403 \uC778\uC99D \uC2E4\uD328:"), {
                                                errorType: errorJson.type,
                                                errorTitle: errorJson.title,
                                                errorDetail: errorJson.detail,
                                                customerId: customerId,
                                                customerIdLength: customerId.length,
                                                accessLicensePrefix: config.accessLicense.substring(0, 15),
                                                signaturePrefix: signature.substring(0, 20)
                                            });
                                            console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" 403 \uC5D0\uB7EC - \uBE14\uB85C\uADF8 \uAC80\uC0C9 API\uB85C fallback \uC608\uC815"));
                                        }
                                        // 서명 재시도는 하지 않고 바로 실패 처리 (시간 낭비 방지)
                                        results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (!!response.ok) return [3 /*break*/, 28];
                                    return [4 /*yield*/, response.text().catch(function () { return 'Unknown error'; })];
                                case 27:
                                    finalErrorText = _e.sent();
                                    if (isFirstKeyword) {
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uCD5C\uC885 \uC2E4\uD328 (\uBAA8\uB4E0 \uC7AC\uC2DC\uB3C4 \uD6C4): ").concat(response.status), finalErrorText.substring(0, 300));
                                    }
                                    results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                    return [2 /*return*/, "continue"];
                                case 28:
                                    data = void 0;
                                    _e.label = 29;
                                case 29:
                                    _e.trys.push([29, 31, , 32]);
                                    return [4 /*yield*/, response.json()];
                                case 30:
                                    data = _e.sent();
                                    return [3 /*break*/, 32];
                                case 31:
                                    jsonError_1 = _e.sent();
                                    console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" JSON \uD30C\uC2F1 \uC2E4\uD328:"), jsonError_1.message);
                                    results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                    return [2 /*return*/, "continue"];
                                case 32:
                                    // 디버깅: API 응답 구조 확인 (첫 번째 키워드만 상세 로깅)
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" API \uC751\uB2F5 \uC804\uCCB4 \uAD6C\uC870:"), JSON.stringify(data, null, 2));
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" API \uC751\uB2F5 \uD0A4 \uBAA9\uB85D:"), Object.keys(data || {}));
                                        // 응답 구조 분석
                                        if (data && typeof data === 'object') {
                                            console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uC751\uB2F5 \uAD6C\uC870 \uBD84\uC11D:"), {
                                                hasKeywordList: !!data.keywordList,
                                                hasRelKeywordList: !!data.relKeywordList,
                                                hasResult: !!data.result,
                                                hasData: !!data.data,
                                                hasBody: !!data.body,
                                                hasResponse: !!data.response,
                                                isArray: Array.isArray(data),
                                                keys: Object.keys(data)
                                            });
                                        }
                                    }
                                    keywordList = [];
                                    // 1. keywordList (기본)
                                    if (data.keywordList && Array.isArray(data.keywordList)) {
                                        keywordList = data.keywordList;
                                    }
                                    // 2. relKeywordList (관련 키워드 리스트)
                                    else if (data.relKeywordList && Array.isArray(data.relKeywordList)) {
                                        keywordList = data.relKeywordList;
                                    }
                                    // 3. result.keywordList
                                    else if (data.result && data.result.keywordList && Array.isArray(data.result.keywordList)) {
                                        keywordList = data.result.keywordList;
                                    }
                                    // 4. result.relKeywordList
                                    else if (data.result && data.result.relKeywordList && Array.isArray(data.result.relKeywordList)) {
                                        keywordList = data.result.relKeywordList;
                                    }
                                    // 5. data (배열)
                                    else if (data.data && Array.isArray(data.data)) {
                                        keywordList = data.data;
                                    }
                                    // 6. userKeyword (단일 키워드 정보)
                                    else if (data.userKeyword) {
                                        keywordList = [data.userKeyword];
                                    }
                                    // 7. userKeywordList (사용자 키워드 리스트)
                                    else if (data.userKeywordList && Array.isArray(data.userKeywordList)) {
                                        keywordList = data.userKeywordList;
                                    }
                                    // 8. 직접 배열
                                    else if (Array.isArray(data)) {
                                        keywordList = data;
                                    }
                                    // 9. body.keywordList
                                    else if (data.body && data.body.keywordList && Array.isArray(data.body.keywordList)) {
                                        keywordList = data.body.keywordList;
                                    }
                                    // 10. body.relKeywordList
                                    else if (data.body && data.body.relKeywordList && Array.isArray(data.body.relKeywordList)) {
                                        keywordList = data.body.relKeywordList;
                                    }
                                    // 11. response.keywordList
                                    else if (data.response && data.response.keywordList && Array.isArray(data.response.keywordList)) {
                                        keywordList = data.response.keywordList;
                                    }
                                    // 12. response.data (배열)
                                    else if (data.response && data.response.data && Array.isArray(data.response.data)) {
                                        keywordList = data.response.data;
                                    }
                                    // 13. 직접 키워드 정보 (keywordList가 없지만 키워드 정보가 직접 있는 경우)
                                    else if (data.relKeyword || data.keyword || data.query) {
                                        keywordList = [data];
                                    }
                                    // 디버깅: 추출된 keywordList 확인
                                    if (keywords.indexOf(keyword) === 0) {
                                        console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uCD94\uCD9C\uB41C keywordList \uAC1C\uC218: ").concat(keywordList.length));
                                        if (keywordList.length > 0) {
                                            console.log("[NAVER-SEARCHAD] \uCCAB \uBC88\uC9F8 \uD56D\uBAA9 \uAD6C\uC870:", JSON.stringify(keywordList[0], null, 2).substring(0, 500));
                                        }
                                    }
                                    if (!(!keywordList || keywordList.length === 0)) return [3 /*break*/, 40];
                                    console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F \"".concat(keyword, "\": keywordList \uC5C6\uC74C \uB610\uB294 \uBE44\uC5B4\uC788\uC74C"));
                                    console.log("[NAVER-SEARCHAD] \uC751\uB2F5 \uC804\uCCB4 \uB370\uC774\uD130:", JSON.stringify(data, null, 2));
                                    console.log("[NAVER-SEARCHAD] \uC751\uB2F5 \uD0A4 \uBAA9\uB85D:", Object.keys(data || {}));
                                    // 즉시 블로그 검색 API로 폴백 시도
                                    console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uAC80\uC0C9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C (\uBE48 \uBC30\uC5F4) - \uBE14\uB85C\uADF8 \uAC80\uC0C9 API\uB85C \uC989\uC2DC \uD3F4\uBC31"));
                                    _e.label = 33;
                                case 33:
                                    _e.trys.push([33, 38, , 39]);
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/naver-datalab-api'); })];
                                case 34:
                                    getBlogSearchFallback = (_e.sent()).getBlogSearchFallback;
                                    return [4 /*yield*/, Promise.resolve().then(function () { return require('../utils/environment-manager'); })];
                                case 35:
                                    envManager = (_e.sent()).EnvironmentManager.getInstance();
                                    envConfig = envManager.getConfig();
                                    fallbackConfig = {
                                        clientId: envConfig.naverClientId || '',
                                        clientSecret: envConfig.naverClientSecret || ''
                                    };
                                    if (!(fallbackConfig.clientId && fallbackConfig.clientSecret)) return [3 /*break*/, 37];
                                    return [4 /*yield*/, getBlogSearchFallback(fallbackConfig, originalKeyword)];
                                case 36:
                                    fallbackResult = _e.sent();
                                    if (fallbackResult && (fallbackResult.pcSearchVolume > 0 || fallbackResult.mobileSearchVolume > 0)) {
                                        console.log("[NAVER-SEARCHAD] \u2705 \"".concat(keyword, "\": \uBE14\uB85C\uADF8 \uAC80\uC0C9 API \uD3F4\uBC31 \uC131\uACF5"));
                                        results.push({
                                            keyword: originalKeyword,
                                            pcSearchVolume: fallbackResult.pcSearchVolume,
                                            mobileSearchVolume: fallbackResult.mobileSearchVolume,
                                            totalSearchVolume: fallbackResult.pcSearchVolume + fallbackResult.mobileSearchVolume
                                        });
                                        return [2 /*return*/, "continue"];
                                    }
                                    _e.label = 37;
                                case 37: return [3 /*break*/, 39];
                                case 38:
                                    fallbackError_1 = _e.sent();
                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uBE14\uB85C\uADF8 \uAC80\uC0C9 API \uD3F4\uBC31 \uC2E4\uD328:"), fallbackError_1.message);
                                    return [3 /*break*/, 39];
                                case 39:
                                    // 폴백도 실패하면 0 반환
                                    console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uAC80\uC0C9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C (\uBE48 \uBC30\uC5F4)"));
                                    results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                    return [2 /*return*/, "continue"];
                                case 40:
                                    if (keywordList && keywordList.length > 0) {
                                        decodeHtmlEntities_1 = function (str) {
                                            if (!str || typeof str !== 'string')
                                                return str;
                                            return str
                                                .replace(/&quot;/g, '"')
                                                .replace(/&amp;/g, '&')
                                                .replace(/&lt;/g, '<')
                                                .replace(/&gt;/g, '>')
                                                .replace(/&#39;/g, "'")
                                                .replace(/&apos;/g, "'")
                                                .replace(/&nbsp;/g, ' ')
                                                .trim();
                                        };
                                        normalizedOriginalKeyword_1 = decodeHtmlEntities_1(originalKeyword.trim().toLowerCase());
                                        normalizedProcessedKeyword_1 = processedKeyword.toLowerCase();
                                        keywordData = keywordList.find(function (item) {
                                            var relKeyword = decodeHtmlEntities_1(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
                                            var normalizedRelKeyword = relKeyword.toLowerCase();
                                            // 정확히 일치 (띄어쓰기 포함)
                                            return normalizedRelKeyword === normalizedOriginalKeyword_1;
                                        });
                                        // 2순위: 처리된 키워드(특수문자 제거)와 일치하는 결과 찾기
                                        if (!keywordData) {
                                            keywordData = keywordList.find(function (item) {
                                                var relKeyword = decodeHtmlEntities_1(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
                                                var normalizedRelKeyword = relKeyword.toLowerCase();
                                                return normalizedRelKeyword === normalizedProcessedKeyword_1;
                                            });
                                        }
                                        // 3순위: 부분 일치
                                        if (!keywordData) {
                                            keywordData = keywordList.find(function (item) {
                                                var relKeyword = decodeHtmlEntities_1(item.relKeyword || item.keyword || item.query || item.hintKeyword || '');
                                                var normalizedRelKeyword = relKeyword.toLowerCase();
                                                // 부분 일치 체크
                                                return normalizedRelKeyword.includes(normalizedOriginalKeyword_1) ||
                                                    normalizedOriginalKeyword_1.includes(normalizedRelKeyword);
                                            });
                                        }
                                        // 4순위: 첫 번째 결과 사용
                                        if (!keywordData) {
                                            keywordData = keywordList[0];
                                            foundKeywordRaw = (keywordData === null || keywordData === void 0 ? void 0 : keywordData.relKeyword) || (keywordData === null || keywordData === void 0 ? void 0 : keywordData.keyword) || (keywordData === null || keywordData === void 0 ? void 0 : keywordData.query) || (keywordData === null || keywordData === void 0 ? void 0 : keywordData.hintKeyword) || 'N/A';
                                            foundKeyword = decodeHtmlEntities_1(foundKeywordRaw);
                                            console.log("[NAVER-SEARCHAD] \"".concat(originalKeyword, "\": \uC815\uD655\uD55C \uB9E4\uCE6D \uC2E4\uD328, \uCCAB \uBC88\uC9F8 \uACB0\uACFC \uC0AC\uC6A9: ").concat(foundKeyword));
                                            // 첫 번째 키워드와 검색 키워드가 완전히 다르면 경고
                                            if (keywords.indexOf(keyword) === 0) {
                                                if (foundKeyword.toLowerCase() !== normalizedOriginalKeyword_1) {
                                                    console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F \uAC80\uC0C9 \uD0A4\uC6CC\uB4DC \"".concat(originalKeyword, "\"\uC640 \uC751\uB2F5 \uD0A4\uC6CC\uB4DC \"").concat(foundKeyword, "\"\uAC00 \uB2E4\uB985\uB2C8\uB2E4."));
                                                }
                                            }
                                        }
                                        extractedKeyword = originalKeyword;
                                        pcVolume = null;
                                        if (keywordData.monthlyPcQcCnt !== undefined && keywordData.monthlyPcQcCnt !== null) {
                                            pcVolume = keywordData.monthlyPcQcCnt;
                                        }
                                        else if (keywordData.pcQcCnt !== undefined && keywordData.pcQcCnt !== null) {
                                            pcVolume = keywordData.pcQcCnt;
                                        }
                                        else if (keywordData.pcSearchVolume !== undefined && keywordData.pcSearchVolume !== null) {
                                            pcVolume = keywordData.pcSearchVolume;
                                        }
                                        else if (keywordData.pcVolume !== undefined && keywordData.pcVolume !== null) {
                                            pcVolume = keywordData.pcVolume;
                                        }
                                        else if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null) {
                                            // 전체 검색량이 있으면 50%를 PC로 추정
                                            pcVolume = Math.floor(Number(keywordData.monthlyQcCnt) * 0.5);
                                        }
                                        pcVolumeValue = pcVolume !== null ? (typeof pcVolume === 'string' ? parseInt(pcVolume.replace(/[^0-9]/g, ''), 10) || 0 : Number(pcVolume) || 0) : 0;
                                        mobileVolume = null;
                                        if (keywordData.monthlyMobileQcCnt !== undefined && keywordData.monthlyMobileQcCnt !== null) {
                                            mobileVolume = keywordData.monthlyMobileQcCnt;
                                        }
                                        else if (keywordData.mobileQcCnt !== undefined && keywordData.mobileQcCnt !== null) {
                                            mobileVolume = keywordData.mobileQcCnt;
                                        }
                                        else if (keywordData.mobileSearchVolume !== undefined && keywordData.mobileSearchVolume !== null) {
                                            mobileVolume = keywordData.mobileSearchVolume;
                                        }
                                        else if (keywordData.mobileVolume !== undefined && keywordData.mobileVolume !== null) {
                                            mobileVolume = keywordData.mobileVolume;
                                        }
                                        else if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null && pcVolumeValue === 0) {
                                            // PC 검색량이 없고 전체 검색량만 있으면 50%를 모바일로 추정
                                            mobileVolume = Math.floor(Number(keywordData.monthlyQcCnt) * 0.5);
                                        }
                                        mobileVolumeValue = mobileVolume !== null ? (typeof mobileVolume === 'string' ? parseInt(mobileVolume.replace(/[^0-9]/g, ''), 10) || 0 : Number(mobileVolume) || 0) : 0;
                                        totalVolumeField = null;
                                        if (keywordData.monthlyQcCnt !== undefined && keywordData.monthlyQcCnt !== null) {
                                            totalVolumeField = keywordData.monthlyQcCnt;
                                        }
                                        else if (keywordData.totalQcCnt !== undefined && keywordData.totalQcCnt !== null) {
                                            totalVolumeField = keywordData.totalQcCnt;
                                        }
                                        else if (keywordData.totalSearchVolume !== undefined && keywordData.totalSearchVolume !== null) {
                                            totalVolumeField = keywordData.totalSearchVolume;
                                        }
                                        else if (keywordData.totalVolume !== undefined && keywordData.totalVolume !== null) {
                                            totalVolumeField = keywordData.totalVolume;
                                        }
                                        else if (keywordData.qcCnt !== undefined && keywordData.qcCnt !== null) {
                                            totalVolumeField = keywordData.qcCnt;
                                        }
                                        else if (keywordData.searchVolume !== undefined && keywordData.searchVolume !== null) {
                                            totalVolumeField = keywordData.searchVolume;
                                        }
                                        else if (keywordData.monthlyPcQcCnt !== undefined && keywordData.monthlyMobileQcCnt !== undefined) {
                                            // PC와 모바일 검색량을 합산 (우선순위 높음)
                                            totalVolumeField = (Number(keywordData.monthlyPcQcCnt) || 0) + (Number(keywordData.monthlyMobileQcCnt) || 0);
                                        }
                                        finalPcVolume = pcVolumeValue;
                                        finalMobileVolume = mobileVolumeValue;
                                        finalTotalVolumeField = totalVolumeField !== null ? (typeof totalVolumeField === 'string' ? parseInt(totalVolumeField.replace(/[^0-9]/g, ''), 10) || 0 : Number(totalVolumeField) || 0) : 0;
                                        finalTotalVolume = finalTotalVolumeField > 0 ? finalTotalVolumeField : (finalPcVolume + finalMobileVolume);
                                        // 디버깅: 검색량 추출 과정 확인
                                        if (keywords.indexOf(keyword) === 0) {
                                            console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uAC80\uC0C9\uB7C9 \uCD94\uCD9C:"), {
                                                pcVolume: finalPcVolume,
                                                mobileVolume: finalMobileVolume,
                                                totalVolumeField: finalTotalVolumeField,
                                                finalTotalVolume: finalTotalVolume,
                                                rawData: {
                                                    monthlyPcQcCnt: keywordData.monthlyPcQcCnt,
                                                    monthlyMobileQcCnt: keywordData.monthlyMobileQcCnt,
                                                    monthlyQcCnt: keywordData.monthlyQcCnt,
                                                    totalQcCnt: keywordData.totalQcCnt,
                                                    pcQcCnt: keywordData.pcQcCnt,
                                                    mobileQcCnt: keywordData.mobileQcCnt,
                                                    totalSearchVolume: keywordData.totalSearchVolume,
                                                    pcSearchVolume: keywordData.pcSearchVolume,
                                                    mobileSearchVolume: keywordData.mobileSearchVolume
                                                },
                                                keywordDataKeys: Object.keys(keywordData || {})
                                            });
                                        }
                                        if (finalTotalVolume > 0) {
                                            console.log("[NAVER-SEARCHAD] \u2705 \"".concat(keyword, "\": PC=").concat(finalPcVolume, ", \uBAA8\uBC14\uC77C=").concat(finalMobileVolume, ", \uCD1D=").concat(finalTotalVolume));
                                            results.push({
                                                keyword: extractedKeyword, // HTML 엔티티 디코딩된 키워드 사용
                                                pcSearchVolume: finalPcVolume,
                                                mobileSearchVolume: finalMobileVolume,
                                                totalSearchVolume: finalTotalVolume,
                                                competition: keywordData.competition || keywordData.competitionLevel,
                                                monthlyPcQcCnt: finalPcVolume,
                                                monthlyMobileQcCnt: finalMobileVolume
                                            });
                                        }
                                        else {
                                            console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F \uAC80\uC0C9\uAD11\uACE0 API \"".concat(keyword, "\": \uAC80\uC0C9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C (0 \uBC18\uD658) - \uC751\uB2F5 \uD0A4\uC6CC\uB4DC: ").concat(extractedKeyword));
                                            results.push({
                                                keyword: extractedKeyword, // HTML 엔티티 디코딩된 키워드 사용
                                                pcSearchVolume: 0,
                                                mobileSearchVolume: 0,
                                                totalSearchVolume: 0
                                            });
                                        }
                                    }
                                    else {
                                        // keywordList가 없거나 비어있을 때
                                        // 첫 번째 키워드의 경우 상세 로깅
                                        if (keywords.indexOf(keyword) === 0) {
                                            console.warn("[NAVER-SEARCHAD] \u26A0\uFE0F \"".concat(keyword, "\": keywordList \uC5C6\uC74C \uB610\uB294 \uBE44\uC5B4\uC788\uC74C"));
                                            console.log("[NAVER-SEARCHAD] \uC751\uB2F5 \uC804\uCCB4 \uB370\uC774\uD130:", JSON.stringify(data, null, 2));
                                            console.log("[NAVER-SEARCHAD] \uC751\uB2F5 \uD0A4 \uBAA9\uB85D:", Object.keys(data || {}));
                                            // 응답에 hintKeywords 관련 데이터가 있는지 확인
                                            if (data.hintKeywords) {
                                                console.log("[NAVER-SEARCHAD] hintKeywords \uBC1C\uACAC:", data.hintKeywords);
                                            }
                                            if (data.query) {
                                                console.log("[NAVER-SEARCHAD] query \uBC1C\uACAC:", data.query);
                                            }
                                            if (data.keyword) {
                                                console.log("[NAVER-SEARCHAD] keyword \uBC1C\uACAC:", data.keyword);
                                            }
                                        }
                                        // keywordList가 빈 배열이면 검색량이 실제로 0인 것
                                        if (data.keywordList && Array.isArray(data.keywordList) && data.keywordList.length === 0) {
                                            if (keywords.indexOf(keyword) === 0) {
                                                console.log("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uAC80\uC0C9\uB7C9 \uB370\uC774\uD130 \uC5C6\uC74C (\uBE48 \uBC30\uC5F4)"));
                                            }
                                        }
                                        // 검색량이 없어도 0으로 반환 (에러 아님) - 원본 키워드 사용
                                        results.push({
                                            keyword: originalKeyword,
                                            pcSearchVolume: 0,
                                            mobileSearchVolume: 0,
                                            totalSearchVolume: 0
                                        });
                                    }
                                    baseDelay = 2000;
                                    keywordIndex = keywords.indexOf(keyword);
                                    delay_1 = baseDelay + (keywordIndex * 500);
                                    if (!(keywordIndex < keywords.length - 1)) return [3 /*break*/, 42];
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, delay_1); })];
                                case 41:
                                    _e.sent();
                                    _e.label = 42;
                                case 42: return [3 /*break*/, 44];
                                case 43:
                                    error_1 = _e.sent();
                                    errorMessage = (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || String(error_1 || '');
                                    isFirstKeyword = keywords.indexOf(keyword) === 0;
                                    if (isFirstKeyword) {
                                        console.error("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uCC98\uB9AC \uC911 \uC608\uC678 \uBC1C\uC0DD:"), {
                                            message: errorMessage,
                                            stack: (_c = error_1.stack) === null || _c === void 0 ? void 0 : _c.substring(0, 500),
                                            name: error_1.name,
                                            code: error_1.code,
                                            cause: error_1.cause
                                        });
                                    }
                                    else {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\" \uCC98\uB9AC \uC911 \uC608\uC678: ").concat(errorMessage));
                                    }
                                    // 429 에러는 재시도가 이미 시도되었으므로 조용히 처리
                                    if (errorMessage.includes('429') || errorMessage.includes('Rate Limit') || errorMessage.includes('Too Many Requests')) {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": Rate Limit \uC5D0\uB7EC - 0 \uBC18\uD658"));
                                    }
                                    else if (errorMessage.includes('타임아웃') || errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uD0C0\uC784\uC544\uC6C3 \uC5D0\uB7EC - 0 \uBC18\uD658"));
                                    }
                                    else {
                                        console.warn("[NAVER-SEARCHAD] \"".concat(keyword, "\": \uC608\uC678 \uBC1C\uC0DD - 0 \uBC18\uD658 (").concat(errorMessage, ")"));
                                    }
                                    // 원본 키워드 사용하여 결과 반환
                                    results.push({ keyword: originalKeyword, pcSearchVolume: 0, mobileSearchVolume: 0, totalSearchVolume: 0 });
                                    return [3 /*break*/, 44];
                                case 44: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, keywords_1 = keywords;
                    _d.label = 1;
                case 1:
                    if (!(_i < keywords_1.length)) return [3 /*break*/, 4];
                    keyword = keywords_1[_i];
                    return [5 /*yield**/, _loop_1(keyword)];
                case 2:
                    _d.sent();
                    _d.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, results];
            }
        });
    });
}
