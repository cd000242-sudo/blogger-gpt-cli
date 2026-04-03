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
exports.loadEnvFromFile = loadEnvFromFile;
exports.saveEnv = saveEnv;
// src/env.ts
var fs = require("node:fs");
var fsp = require("node:fs/promises");
var path = require("node:path");
var APP_DIR_NAME = 'blogger-gpt-cli';
/* ───────────────── userData path ───────────────── */
function getUserDataDir() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        var app = require('electron').app;
        if (app && typeof app.getPath === 'function') {
            var p_1 = app.getPath('userData');
            fs.mkdirSync(p_1, { recursive: true });
            return p_1;
        }
    }
    catch ( /* no electron */_a) { /* no electron */ }
    var base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
    var p = path.join(base, APP_DIR_NAME);
    fs.mkdirSync(p, { recursive: true });
    return p;
}
function envPath() { return path.join(getUserDataDir(), '.env'); }
/* ───────────────── .env parse/stringify ───────────────── */
function parseDotEnv(str) {
    var out = {};
    if (!str)
        return out;
    // JSON 형식인지 확인
    if (str.trim().startsWith('{')) {
        try {
            var jsonData = JSON.parse(str);
            // JSON에서 apiKeys 섹션 추출
            if (jsonData.apiKeys) {
                var apiKeys = jsonData.apiKeys;
                // 환경 변수 이름으로 매핑 (양쪽 형식 모두 지원)
                if (apiKeys['gemini'] || apiKeys['geminiKey']) {
                    out['GEMINI_API_KEY'] = apiKeys['gemini'] || apiKeys['geminiKey'];
                    out['geminiKey'] = apiKeys['gemini'] || apiKeys['geminiKey'];
                }
                if (apiKeys['naverClientId'] || apiKeys['naver_client_id']) {
                    out['NAVER_CLIENT_ID'] = apiKeys['naverClientId'] || apiKeys['naver_client_id'];
                    out['naverClientId'] = apiKeys['naverClientId'] || apiKeys['naver_client_id'];
                }
                if (apiKeys['naverClientSecret'] || apiKeys['naver_client_secret']) {
                    out['NAVER_CLIENT_SECRET'] = apiKeys['naverClientSecret'] || apiKeys['naver_client_secret'];
                    out['naverClientSecret'] = apiKeys['naverClientSecret'] || apiKeys['naver_client_secret'];
                }
                if (apiKeys['googleClientId'] || apiKeys['google_client_id']) {
                    out['GOOGLE_CLIENT_ID'] = apiKeys['googleClientId'] || apiKeys['google_client_id'];
                    out['googleClientId'] = apiKeys['googleClientId'] || apiKeys['google_client_id'];
                }
                if (apiKeys['googleClientSecret'] || apiKeys['google_client_secret']) {
                    out['GOOGLE_CLIENT_SECRET'] = apiKeys['googleClientSecret'] || apiKeys['google_client_secret'];
                    out['googleClientSecret'] = apiKeys['googleClientSecret'] || apiKeys['google_client_secret'];
                }
                if (apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key']) {
                    out['YOUTUBE_API_KEY'] = apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key'];
                    out['youtubeApiKey'] = apiKeys['youtubeApiKey'] || apiKeys['youtube_api_key'];
                }
                if (apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license']) {
                    out['NAVER_SEARCH_AD_ACCESS_LICENSE'] = apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license'];
                    out['naverSearchAdAccessLicense'] = apiKeys['naverSearchAdAccessLicense'] || apiKeys['naver_search_ad_access_license'];
                }
                if (apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key']) {
                    out['NAVER_SEARCH_AD_SECRET_KEY'] = apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key'];
                    out['naverSearchAdSecretKey'] = apiKeys['naverSearchAdSecretKey'] || apiKeys['naver_search_ad_secret_key'];
                }
                // 모든 apiKeys 항목을 그대로도 저장
                for (var _i = 0, _a = Object.entries(apiKeys); _i < _a.length; _i++) {
                    var _b = _a[_i], key = _b[0], value = _b[1];
                    if (typeof value === 'string' && value.trim()) {
                        out[key] = value;
                        // 대문자 키도 추가
                        var upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
                        if (!out[upperKey]) {
                            out[upperKey] = value;
                        }
                    }
                }
            }
            // JSON 전체를 환경 변수로도 매핑 (직접 저장된 경우)
            for (var _c = 0, _d = Object.entries(jsonData); _c < _d.length; _c++) {
                var _e = _d[_c], key = _e[0], value = _e[1];
                if (key === 'apiKeys')
                    continue; // apiKeys는 이미 처리됨
                if (typeof value === 'string' && value.trim()) {
                    // 원래 키 그대로 저장
                    out[key] = value;
                    // 대문자 키도 추가
                    var upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
                    if (!out[upperKey]) {
                        out[upperKey] = value;
                    }
                }
            }
            return out;
        }
        catch (e) {
            console.warn('[ENV] JSON 파싱 실패, 일반 형식으로 시도:', e);
        }
    }
    // 일반 KEY=VALUE 형식 파싱
    for (var _f = 0, _g = str.split(/\r?\n/); _f < _g.length; _f++) {
        var raw = _g[_f];
        var line = (raw || '').trim();
        if (!line || line.startsWith('#'))
            continue;
        var m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m || !m[1])
            continue;
        var k = m[1];
        var v = (m[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
            v = v.slice(1, -1);
        v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
        out[k] = v;
    }
    return out;
}
function stringifyDotEnv(obj) {
    var lines = [];
    for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
        var _b = _a[_i], k = _b[0], v = _b[1];
        if (v === undefined || v === null || v === '')
            continue; // 빈값은 저장 생략
        var s = String(v);
        var needsQuote = /[\s#"'=]/.test(s);
        lines.push("".concat(k, "=").concat(needsQuote ? JSON.stringify(s) : s));
    }
    return (lines.join('\n') + '\n');
}
/* ───────────────── 키 매핑(ENV <-> UI) ─────────────────
   왼쪽은 .env의 대문자 키, 오른쪽은 UI/코어에서 쓰는 camelCase 키
----------------------------------------------------------------- */
var MAP = {
    AI_PROVIDER: 'provider',
    OPENAI_API_KEY: 'openaiKey',
    GEMINI_API_KEY: 'geminiKey',
    CLAUDE_API_KEY: 'claudeKey',
    PEXELS_API_KEY: 'pexelsApiKey',
    // ✅ Google CSE (자동 링크/이미지용)
    GOOGLE_CSE_KEY: 'googleCseKey',
    GOOGLE_CSE_CX: 'googleCseCx',
    GOOGLE_CSE_ID: 'googleCseCx', // CSE ID와 CX는 같은 값
    GOOGLE_CSE_API_KEY: 'googleCseKey', // CSE API Key와 Key는 같은 값
    // Blogger/Google OAuth
    GOOGLE_BLOG_ID: 'blogId',
    BLOGGER_BLOG_ID: 'blogId', // 두 가지 키명 모두 지원
    GOOGLE_CLIENT_ID: 'googleClientId',
    GOOGLE_CLIENT_SECRET: 'googleClientSecret',
    GOOGLE_REDIRECT_URI: 'redirectUri',
    // WordPress 설정
    WORDPRESS_SITE_URL: 'wordpressSiteUrl',
    WORDPRESS_USERNAME: 'wordpressUsername',
    WORDPRESS_PASSWORD: 'wordpressPassword',
    WORDPRESS_STATUS: 'wordpressStatus',
    WORDPRESS_CATEGORIES: 'wordpressCategories',
    WORDPRESS_TAGS: 'wordpressTags',
    // 기타 옵션
    MIN_CHARS: 'minChars',
    // (선택) 신선도 옵션 등 기존 것 유지
    NAVER_CUSTOMER_ID: 'naverCustomerId',
    NAVER_SECRET_KEY: 'naverSecretKey',
    NAVER_CLIENT_ID: 'naverClientId',
    NAVER_CLIENT_SECRET: 'naverClientSecret',
    NAVER_SEARCH_AD_ACCESS_LICENSE: 'naverSearchAdAccessLicense',
    NAVER_SEARCH_AD_SECRET_KEY: 'naverSearchAdSecretKey',
    YOUTUBE_API_KEY: 'youtubeApiKey',
    REQUIRE_FRESH: 'requireFresh',
    STRICT_FRESH: 'strictFresh',
    FRESH_MAX_AGE_DAYS: 'freshMaxAgeDays',
    HTTPS_PROXY: 'httpsProxy',
    HTTP_PROXY: 'httpProxy',
    // ✅ 썸네일/이미지 자동 생성 옵션
    AUTO_THUMB: 'autoThumb', // 'true' | 'false'
    THUMB_WIDTH: 'thumbWidth', // number
    THUMB_HEIGHT: 'thumbHeight', // number
    THUMB_INSERT_MODE: 'thumbInsertMode', // 'dataurl' | 'none'
    BRAND_TEXT: 'brandText', // string
    // ── 새로 추가: 사진형 썸네일 제어
    THUMB_MODE: 'thumbMode', // 'text' | 'photo'
    THUMB_TEXT_ALIGN: 'thumbTextAlign', // 'left' | 'center'
    THUMB_TEXT_FIT: 'thumbTextFit', // 'none' | 'shrink'
    THUMB_MAX_LINES: 'thumbMaxLines', // number
    THUMB_OVERLAY: 'thumbOverlay', // 0.0 ~ 0.9
    THUMB_PAD: 'thumbPad', // number(px)
    THUMB_SUBTITLE: 'thumbSubtitle', // string (선택)
    // ── 새로 추가: 이미지 검색 제어
    IMAGE_SOURCE: 'imageSource', // 'cse' | 'unsplash' | 'none'
    IMAGE_SAFESEARCH: 'imageSafeSearch', // boolean
};
// .env에 저장/읽을 키 목록
var KNOWN_KEYS = Object.keys(MAP);
/* ───────────────── 로드: .env -> UI형 객체 ───────────────── */
function loadEnvFromFile() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    // 1) 파일 읽기
    var fileEnv = {};
    try {
        var raw = fs.readFileSync(envPath(), 'utf-8');
        fileEnv = parseDotEnv(raw);
    }
    catch ( /* 없으면 무시 */_q) { /* 없으면 무시 */ }
    // 2) 파일에 없으면 process.env 보강 (대문자 키 우선, camelCase도 시도)
    var mergedUpper = {};
    // 먼저 fileEnv에 있는 모든 키를 mergedUpper에 저장 (원래 키 + 변환된 키 모두)
    for (var _i = 0, _r = Object.entries(fileEnv); _i < _r.length; _i++) {
        var _s = _r[_i], fileKey = _s[0], fileValue = _s[1];
        if (fileValue && typeof fileValue === 'string' && fileValue.trim()) {
            // 원래 키 그대로 저장
            mergedUpper[fileKey] = fileValue;
            // camelCase를 대문자 언더스코어로 변환 (naverClientId -> NAVER_CLIENT_ID)
            var upperKey = fileKey.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
            if (upperKey && !mergedUpper[upperKey]) {
                mergedUpper[upperKey] = fileValue;
            }
            // 대문자 키도 추가
            var directUpperKey = fileKey.toUpperCase();
            if (directUpperKey !== fileKey && !mergedUpper[directUpperKey]) {
                mergedUpper[directUpperKey] = fileValue;
            }
        }
    }
    // KNOWN_KEYS에 대해 매핑된 값 찾기 (fileEnv에 없으면 process.env에서)
    for (var _t = 0, KNOWN_KEYS_1 = KNOWN_KEYS; _t < KNOWN_KEYS_1.length; _t++) {
        var k = KNOWN_KEYS_1[_t];
        if (!mergedUpper[k]) {
            var camelKey = MAP[k];
            if (camelKey) {
                // fileEnv에서 대문자 키, camelCase 키 모두 시도
                mergedUpper[k] = (_b = (_a = fileEnv[k]) !== null && _a !== void 0 ? _a : fileEnv[camelKey]) !== null && _b !== void 0 ? _b : ((_d = (_c = process.env[k]) !== null && _c !== void 0 ? _c : process.env[camelKey]) !== null && _d !== void 0 ? _d : '');
            }
            else {
                mergedUpper[k] = (_f = (_e = fileEnv[k]) !== null && _e !== void 0 ? _e : process.env[k]) !== null && _f !== void 0 ? _f : '';
            }
        }
    }
    // 3) camelCase로 변환
    var out = {};
    for (var _u = 0, _v = Object.entries(MAP); _u < _v.length; _u++) {
        var _w = _v[_u], UP = _w[0], camel = _w[1];
        // mergedUpper에서 대문자 키로 찾고, 없으면 camelCase 키로 직접 찾기
        out[camel] = (_h = (_g = mergedUpper[UP]) !== null && _g !== void 0 ? _g : mergedUpper[camel]) !== null && _h !== void 0 ? _h : '';
    }
    // 추가: mergedUpper에 있지만 MAP에 없는 camelCase 키들도 그대로 추가 (원래 키 유지)
    for (var _x = 0, _y = Object.entries(mergedUpper); _x < _y.length; _x++) {
        var _z = _y[_x], key = _z[0], value = _z[1];
        if (value && typeof value === 'string' && value.trim()) {
            // camelCase 형식의 키인 경우 (소문자로 시작)
            if (/^[a-z]/.test(key)) {
                // 이미 MAP에 매핑된 키가 아닌 경우에만 추가
                if (!Object.values(MAP).includes(key)) {
                    out[key] = value;
                }
            }
        }
    }
    // 4) 기본값 보정
    if (!out['provider'])
        out['provider'] = 'openai';
    if (!out['redirectUri'])
        out['redirectUri'] = 'http://localhost:8765/';
    // 숫자형 보정 도우미
    var toNum = function (v) {
        if (v === undefined || v === null || v === '')
            return undefined;
        var n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    var toFloat = function (v) {
        var n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    var toBool = function (v) { return (String(v).toLowerCase() === 'true'); };
    // 숫자/불리언 기본값
    out['minChars'] = (_j = toNum(out['minChars'])) !== null && _j !== void 0 ? _j : 3000;
    out['thumbWidth'] = (_k = toNum(out['thumbWidth'])) !== null && _k !== void 0 ? _k : 1200;
    out['thumbHeight'] = (_l = toNum(out['thumbHeight'])) !== null && _l !== void 0 ? _l : 630;
    out['thumbMaxLines'] = (_m = toNum(out['thumbMaxLines'])) !== null && _m !== void 0 ? _m : 3;
    out['thumbOverlay'] = (_o = toFloat(out['thumbOverlay'])) !== null && _o !== void 0 ? _o : 0.6;
    out['thumbPad'] = (_p = toNum(out['thumbPad'])) !== null && _p !== void 0 ? _p : 80;
    out['autoThumb'] = out['autoThumb'] === '' ? true : toBool(out['autoThumb']);
    out['imageSafeSearch'] = out['imageSafeSearch'] === '' ? true : toBool(out['imageSafeSearch']);
    // 문자열 기본값
    if (!out['thumbInsertMode'])
        out['thumbInsertMode'] = 'dataurl';
    if (!out['thumbMode'])
        out['thumbMode'] = 'text'; // 'text' | 'photo'
    if (!out['thumbTextAlign'])
        out['thumbTextAlign'] = 'center'; // 가운데 정렬 기본
    if (!out['thumbTextFit'])
        out['thumbTextFit'] = 'shrink'; // 공간 맞춰 자동 축소
    if (!out['imageSource'])
        out['imageSource'] = 'cse'; // 이미지 검색 기본: CSE
    if (!out['thumbSubtitle'])
        out['thumbSubtitle'] = ''; // 선택
    // WordPress 배열 필드 처리
    if (out['wordpressCategories'] && typeof out['wordpressCategories'] === 'string') {
        out['wordpressCategories'] = out['wordpressCategories'].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    if (out['wordpressTags'] && typeof out['wordpressTags'] === 'string') {
        out['wordpressTags'] = out['wordpressTags'].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    // WordPress 기본값
    if (!out['wordpressStatus'])
        out['wordpressStatus'] = 'draft';
    return out;
}
/* ───────────────── 저장: UI형 -> .env ───────────────── */
function saveEnv(data) {
    return __awaiter(this, void 0, void 0, function () {
        var curUpperRaw, nextUpper, _i, _a, _b, UP, camel, v, numericKeys, floatKeys, booleanKeys, n, n, text, p, e_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 3, , 4]);
                    curUpperRaw = parseDotEnv(fs.existsSync(envPath()) ? fs.readFileSync(envPath(), 'utf-8') : '');
                    nextUpper = __assign({}, curUpperRaw);
                    // camelCase -> UPPER 변환해서 반영
                    for (_i = 0, _a = Object.entries(MAP); _i < _a.length; _i++) {
                        _b = _a[_i], UP = _b[0], camel = _b[1];
                        if (camel in (data || {})) {
                            v = data[camel];
                            if (v === undefined || v === null || v === '') {
                                // 비우면 .env에서 제거
                                delete nextUpper[UP];
                            }
                            else {
                                numericKeys = new Set([
                                    'MIN_CHARS',
                                    'THUMB_WIDTH',
                                    'THUMB_HEIGHT',
                                    'FRESH_MAX_AGE_DAYS',
                                    'THUMB_MAX_LINES',
                                    'THUMB_PAD',
                                ]);
                                floatKeys = new Set([
                                    'THUMB_OVERLAY',
                                ]);
                                booleanKeys = new Set([
                                    'AUTO_THUMB',
                                    'REQUIRE_FRESH',
                                    'STRICT_FRESH',
                                    'IMAGE_SAFESEARCH',
                                ]);
                                if (numericKeys.has(UP)) {
                                    n = Number(v);
                                    if (Number.isFinite(n))
                                        nextUpper[UP] = String(n);
                                }
                                else if (floatKeys.has(UP)) {
                                    n = Number(v);
                                    if (Number.isFinite(n))
                                        nextUpper[UP] = String(n);
                                }
                                else if (booleanKeys.has(UP)) {
                                    nextUpper[UP] = String(!!(v === true || String(v).toLowerCase() === 'true'));
                                }
                                else {
                                    // WordPress 배열 필드는 콤마로 구분된 문자열로 저장
                                    if (UP === 'WORDPRESS_CATEGORIES' || UP === 'WORDPRESS_TAGS') {
                                        if (Array.isArray(v)) {
                                            nextUpper[UP] = v.join(', ');
                                        }
                                        else {
                                            nextUpper[UP] = String(v);
                                        }
                                    }
                                    else {
                                        nextUpper[UP] = String(v);
                                    }
                                }
                            }
                        }
                    }
                    // 기본값이 필요한 필드 보정(없으면 추가)
                    if (!nextUpper['AI_PROVIDER'])
                        nextUpper['AI_PROVIDER'] = 'openai';
                    if (!nextUpper['GOOGLE_REDIRECT_URI'])
                        nextUpper['GOOGLE_REDIRECT_URI'] = 'http://localhost:8765/';
                    if (!nextUpper['MIN_CHARS'])
                        nextUpper['MIN_CHARS'] = '3000';
                    // 썸네일/이미지 기본
                    if (!nextUpper['AUTO_THUMB'])
                        nextUpper['AUTO_THUMB'] = 'true';
                    if (!nextUpper['THUMB_WIDTH'])
                        nextUpper['THUMB_WIDTH'] = '1200';
                    if (!nextUpper['THUMB_HEIGHT'])
                        nextUpper['THUMB_HEIGHT'] = '630';
                    if (!nextUpper['THUMB_INSERT_MODE'])
                        nextUpper['THUMB_INSERT_MODE'] = 'dataurl';
                    if (!nextUpper['THUMB_MODE'])
                        nextUpper['THUMB_MODE'] = 'text';
                    if (!nextUpper['THUMB_TEXT_ALIGN'])
                        nextUpper['THUMB_TEXT_ALIGN'] = 'center';
                    if (!nextUpper['THUMB_TEXT_FIT'])
                        nextUpper['THUMB_TEXT_FIT'] = 'shrink';
                    if (!nextUpper['THUMB_MAX_LINES'])
                        nextUpper['THUMB_MAX_LINES'] = '3';
                    if (!nextUpper['THUMB_OVERLAY'])
                        nextUpper['THUMB_OVERLAY'] = '0.6';
                    if (!nextUpper['THUMB_PAD'])
                        nextUpper['THUMB_PAD'] = '80';
                    if (!nextUpper['IMAGE_SOURCE'])
                        nextUpper['IMAGE_SOURCE'] = 'cse';
                    if (!nextUpper['IMAGE_SAFESEARCH'])
                        nextUpper['IMAGE_SAFESEARCH'] = 'true';
                    text = stringifyDotEnv(nextUpper);
                    p = envPath();
                    return [4 /*yield*/, fsp.mkdir(path.dirname(p), { recursive: true })];
                case 1:
                    _c.sent();
                    return [4 /*yield*/, fsp.writeFile(p, text, 'utf-8')];
                case 2:
                    _c.sent();
                    return [2 /*return*/, { ok: true, logs: ".env saved at ".concat(p) }];
                case 3:
                    e_1 = _c.sent();
                    return [2 /*return*/, { ok: false, exitCode: 1, error: (e_1 === null || e_1 === void 0 ? void 0 : e_1.message) || String(e_1) }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
