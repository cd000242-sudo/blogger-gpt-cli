"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickEnvValue = pickEnvValue;
exports.loadEnvFromFile = loadEnvFromFile;
exports.saveEnv = saveEnv;
const fs = __importStar(require("node:fs"));
const fsp = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const APP_DIR_NAME = 'blogger-gpt-cli';
function getUserDataDir() {
    try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
            const p = app.getPath('userData');
            fs.mkdirSync(p, { recursive: true });
            return p;
        }
    }
    catch { }
    const base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
    const p = path.join(base, APP_DIR_NAME);
    fs.mkdirSync(p, { recursive: true });
    return p;
}
function envPath() { return path.join(getUserDataDir(), '.env'); }
function parseDotEnv(str) {
    const out = {};
    if (!str)
        return out;
    if (str.trim().startsWith('{')) {
        try {
            const jsonData = JSON.parse(str);
            if (jsonData.apiKeys) {
                const apiKeys = jsonData.apiKeys;
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
                if (apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY']) {
                    out['STABILITY_API_KEY'] = apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY'];
                    out['stabilityApiKey'] = apiKeys['stabilityApiKey'] || apiKeys['stability_api_key'] || apiKeys['STABILITY_API_KEY'];
                }
                if (apiKeys['deepInfraApiKey'] || apiKeys['deepinfraApiKey'] || apiKeys['deepinfra_api_key'] || apiKeys['DEEPINFRA_API_KEY'] || apiKeys['DEEP_INFRA_API_KEY']) {
                    const deepInfraKey = apiKeys['deepInfraApiKey'] || apiKeys['deepinfraApiKey'] || apiKeys['deepinfra_api_key'] || apiKeys['DEEPINFRA_API_KEY'] || apiKeys['DEEP_INFRA_API_KEY'];
                    out['DEEPINFRA_API_KEY'] = deepInfraKey;
                    out['DEEP_INFRA_API_KEY'] = deepInfraKey;
                    out['deepInfraApiKey'] = deepInfraKey;
                }
                if (apiKeys['prodiaApiKey'] || apiKeys['prodia_api_key'] || apiKeys['PRODIA_API_KEY']) {
                    const prodiaKey = apiKeys['prodiaApiKey'] || apiKeys['prodia_api_key'] || apiKeys['PRODIA_API_KEY'];
                    out['PRODIA_API_KEY'] = prodiaKey;
                    out['prodiaApiKey'] = prodiaKey;
                }
                if (apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY']) {
                    out['OPENAI_API_KEY'] = apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY'];
                    out['openaiKey'] = apiKeys['openaiKey'] || apiKeys['openai_api_key'] || apiKeys['OPENAI_API_KEY'];
                }
                if (apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY']) {
                    out['PEXELS_API_KEY'] = apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY'];
                    out['pexelsApiKey'] = apiKeys['pexelsApiKey'] || apiKeys['pexels_api_key'] || apiKeys['PEXELS_API_KEY'];
                }
                for (const [key, value] of Object.entries(apiKeys)) {
                    if (typeof value === 'string' && value.trim()) {
                        out[key] = value;
                        const upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
                        if (!out[upperKey]) {
                            out[upperKey] = value;
                        }
                    }
                }
            }
            for (const [key, value] of Object.entries(jsonData)) {
                if (key === 'apiKeys')
                    continue;
                if (typeof value === 'string' && value.trim()) {
                    out[key] = value;
                    const upperKey = key.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, '');
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
    for (const raw of str.split(/\r?\n/)) {
        const line = (raw || '').trim();
        if (!line || line.startsWith('#'))
            continue;
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m || !m[1])
            continue;
        const k = m[1];
        let v = (m[2] || '').trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
            v = v.slice(1, -1);
        v = v.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
        out[k] = v;
    }
    if (!out['tistoryDefaultVisibility'])
        out['tistoryDefaultVisibility'] = 'private';
    return out;
}
function stringifyDotEnv(obj) {
    const lines = [];
    for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null || (v === '' && k !== 'ANTHROPIC_WORKSPACE_ID'))
            continue;
        const s = String(v);
        const needsQuote = /[\s#"'=]/.test(s);
        lines.push(`${k}=${needsQuote ? JSON.stringify(s) : s}`);
    }
    return (lines.join('\n') + '\n');
}
const MAP = {
    AI_PROVIDER: 'provider',
    OPENAI_API_KEY: 'openaiKey',
    DALLE_API_KEY: 'dalleApiKey',
    GEMINI_API_KEY: 'geminiKey',
    CLAUDE_API_KEY: 'claudeKey',
    ANTHROPIC_WORKSPACE_ID: 'claudeWorkspaceId',
    CLAUDE_WORKSPACE_ID: 'claudeWorkspaceId',
    ANTHROPIC_API_KEY: 'claudeKey',
    PERPLEXITY_API_KEY: 'perplexityKey',
    LEONARDO_API_KEY: 'leonardoKey',
    PEXELS_API_KEY: 'pexelsApiKey',
    STABILITY_API_KEY: 'stabilityApiKey',
    DEEPINFRA_API_KEY: 'deepInfraApiKey',
    DEEP_INFRA_API_KEY: 'deepInfraApiKey',
    PRODIA_API_KEY: 'prodiaApiKey',
    VISIBLE_BROWSER: 'visibleBrowserMode',
    COUPANG_ACCESS_KEY: 'coupangAccessKey',
    COUPANG_SECRET_KEY: 'coupangSecretKey',
    GOOGLE_BLOG_ID: 'blogId',
    BLOGGER_BLOG_ID: 'blogId',
    GOOGLE_CLIENT_ID: 'googleClientId',
    GOOGLE_CLIENT_SECRET: 'googleClientSecret',
    GOOGLE_REDIRECT_URI: 'redirectUri',
    WORDPRESS_SITE_URL: 'wordpressSiteUrl',
    WORDPRESS_USERNAME: 'wordpressUsername',
    WORDPRESS_PASSWORD: 'wordpressPassword',
    WORDPRESS_STATUS: 'wordpressStatus',
    WORDPRESS_CATEGORIES: 'wordpressCategories',
    WORDPRESS_TAGS: 'wordpressTags',
    TISTORY_BLOG_NAME: 'tistoryBlogName',
    TISTORY_BLOG_URL: 'tistoryBlogUrl',
    TISTORY_PROFILE_ID: 'tistoryProfileId',
    TISTORY_DEFAULT_CATEGORY: 'tistoryDefaultCategory',
    TISTORY_DEFAULT_VISIBILITY: 'tistoryDefaultVisibility',
    TISTORY_PROTECTED_PASSWORD: 'tistoryProtectedPassword',
    TISTORY_KAKAO_EMAIL: 'tistoryKakaoEmail',
    KAKAO_EMAIL: 'tistoryKakaoEmail',
    TISTORY_BROWSER_EXECUTABLE_PATH: 'tistoryBrowserExecutablePath',
    MIN_CHARS: 'minChars',
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
    AUTO_THUMB: 'autoThumb',
    THUMB_WIDTH: 'thumbWidth',
    THUMB_HEIGHT: 'thumbHeight',
    THUMB_INSERT_MODE: 'thumbInsertMode',
    BRAND_TEXT: 'brandText',
    THUMB_MODE: 'thumbMode',
    THUMB_TEXT_ALIGN: 'thumbTextAlign',
    THUMB_TEXT_FIT: 'thumbTextFit',
    THUMB_MAX_LINES: 'thumbMaxLines',
    THUMB_OVERLAY: 'thumbOverlay',
    THUMB_PAD: 'thumbPad',
    THUMB_SUBTITLE: 'thumbSubtitle',
    IMAGE_SOURCE: 'imageSource',
    IMAGE_SAFESEARCH: 'imageSafeSearch',
    LICENSE_REDEEM_URL: 'licenseRedeemUrl',
};
const KNOWN_KEYS = Object.keys(MAP);
function pickEnvValue(fileEnv, upperKey, camelKey) {
    const candidates = [
        upperKey,
        camelKey,
        upperKey.replace(/_/g, ''),
        camelKey ? camelKey.toUpperCase() : undefined,
    ].filter((key) => !!key);
    for (const key of candidates) {
        const value = fileEnv[key];
        if (typeof value === 'string' && value.trim())
            return value;
    }
    return undefined;
}
function loadEnvFromFile() {
    let fileEnv = {};
    try {
        const projectRootEnv = path.join(process.cwd(), '.env');
        if (fs.existsSync(projectRootEnv)) {
            const raw = fs.readFileSync(projectRootEnv, 'utf-8');
            const parsed = parseDotEnv(raw);
            fileEnv = { ...fileEnv, ...parsed };
            console.log('[ENV] 프로젝트 루트 .env 파일 로드:', projectRootEnv, '키 개수:', Object.keys(parsed).length);
        }
    }
    catch (e) {
        console.warn('[ENV] 프로젝트 루트 .env 파일 읽기 실패:', e);
    }
    try {
        const userDataEnv = envPath();
        if (fs.existsSync(userDataEnv)) {
            const raw = fs.readFileSync(userDataEnv, 'utf-8');
            const parsed = parseDotEnv(raw);
            fileEnv = { ...fileEnv, ...parsed };
            console.log('[ENV] 사용자 데이터 디렉토리 .env 파일 로드:', userDataEnv, '키 개수:', Object.keys(parsed).length);
        }
    }
    catch (e) {
        console.warn('[ENV] 사용자 데이터 디렉토리 .env 파일 읽기 실패:', e);
    }
    const mergedUpper = {};
    for (const [fileKey, fileValue] of Object.entries(fileEnv)) {
        if (fileValue && typeof fileValue === 'string' && fileValue.trim()) {
            mergedUpper[fileKey] = fileValue;
            const upperKey = fileKey.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
            if (upperKey && !mergedUpper[upperKey]) {
                mergedUpper[upperKey] = fileValue;
            }
            const directUpperKey = fileKey.toUpperCase();
            if (directUpperKey !== fileKey && !mergedUpper[directUpperKey]) {
                mergedUpper[directUpperKey] = fileValue;
            }
        }
    }
    for (const k of KNOWN_KEYS) {
        if (!mergedUpper[k]) {
            const camelKey = MAP[k];
            if (camelKey) {
                mergedUpper[k] = pickEnvValue(fileEnv, k, camelKey) ?? (process.env[k] ?? process.env[camelKey] ?? '');
            }
            else {
                mergedUpper[k] = pickEnvValue(fileEnv, k) ?? process.env[k] ?? '';
            }
        }
    }
    const out = {};
    for (const [UP, camel] of Object.entries(MAP)) {
        const value = mergedUpper[UP] ?? mergedUpper[camel] ?? '';
        if (value && typeof value === 'string' && value.trim()) {
            out[camel] = value;
            out[UP] = value;
        }
        else if (!(camel in out)) {
            out[camel] = '';
        }
    }
    for (const [key, value] of Object.entries(mergedUpper)) {
        if (value && typeof value === 'string' && value.trim()) {
            if (/^[a-z]/.test(key)) {
                if (!Object.values(MAP).includes(key)) {
                    out[key] = value;
                }
            }
            if (/^[A-Z_]/.test(key) && !out[key]) {
                out[key] = value;
            }
        }
    }
    const claudeKeyNames = ['CLAUDE_API_KEY', 'claudeKey', 'claudeApiKey', 'ANTHROPIC_API_KEY'];
    const savedClaudeKey = claudeKeyNames.map(key => fileEnv[key]).find(value => typeof value === 'string' && value.trim());
    if (savedClaudeKey) {
        out['claudeKey'] = savedClaudeKey;
        out['CLAUDE_API_KEY'] = savedClaudeKey;
        out['ANTHROPIC_API_KEY'] = savedClaudeKey;
    }
    const workspaceKeys = ['ANTHROPIC_WORKSPACE_ID', 'CLAUDE_WORKSPACE_ID', 'claudeWorkspaceId'];
    const workspaceField = workspaceKeys.find(key => Object.prototype.hasOwnProperty.call(fileEnv, key));
    if (workspaceField) {
        const workspaceId = String(fileEnv[workspaceField] || '').trim();
        out['claudeWorkspaceId'] = workspaceId;
        out['ANTHROPIC_WORKSPACE_ID'] = workspaceId;
        delete out['CLAUDE_WORKSPACE_ID'];
    }
    if (!out['provider'])
        out['provider'] = 'openai';
    if (!out['redirectUri'])
        out['redirectUri'] = 'http://localhost:8765/';
    const toNum = (v) => {
        if (v === undefined || v === null || v === '')
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    const toFloat = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    const toBool = (v) => (String(v).toLowerCase() === 'true');
    out['minChars'] = toNum(out['minChars']) ?? 3000;
    out['thumbWidth'] = toNum(out['thumbWidth']) ?? 1200;
    out['thumbHeight'] = toNum(out['thumbHeight']) ?? 630;
    out['thumbMaxLines'] = toNum(out['thumbMaxLines']) ?? 3;
    out['thumbOverlay'] = toFloat(out['thumbOverlay']) ?? 0.6;
    out['thumbPad'] = toNum(out['thumbPad']) ?? 80;
    out['autoThumb'] = out['autoThumb'] === '' ? true : toBool(out['autoThumb']);
    out['imageSafeSearch'] = out['imageSafeSearch'] === '' ? true : toBool(out['imageSafeSearch']);
    if (!out['thumbInsertMode'])
        out['thumbInsertMode'] = 'dataurl';
    if (!out['thumbMode'])
        out['thumbMode'] = 'text';
    if (!out['thumbTextAlign'])
        out['thumbTextAlign'] = 'center';
    if (!out['thumbTextFit'])
        out['thumbTextFit'] = 'shrink';
    if (!out['imageSource'])
        out['imageSource'] = 'nanobanana2';
    if (!out['thumbSubtitle'])
        out['thumbSubtitle'] = '';
    if (!out['licenseRedeemUrl']) {
        out['licenseRedeemUrl'] = 'https://script.google.com/macros/s/AKfycbxBOGkjVj4p-6XZ4SEFYKhW3FBmo5gt7Fv6djWhB1TljnDDmx_qlfZ4YdlJNohzIZ8NJw/exec';
    }
    if (out['wordpressCategories'] && typeof out['wordpressCategories'] === 'string') {
        out['wordpressCategories'] = out['wordpressCategories'].split(',').map(s => s.trim()).filter(Boolean);
    }
    if (out['wordpressTags'] && typeof out['wordpressTags'] === 'string') {
        out['wordpressTags'] = out['wordpressTags'].split(',').map(s => s.trim()).filter(Boolean);
    }
    if (!out['wordpressStatus'])
        out['wordpressStatus'] = 'draft';
    return out;
}
async function saveEnv(data) {
    try {
        const curUpperRaw = parseDotEnv(fs.existsSync(envPath()) ? fs.readFileSync(envPath(), 'utf-8') : '');
        const nextUpper = { ...curUpperRaw };
        for (const [UP, camel] of Object.entries(MAP)) {
            if (camel in (data || {})) {
                const v = data[camel];
                if (v === undefined || v === null || v === '') {
                    delete nextUpper[UP];
                }
                else {
                    const numericKeys = new Set([
                        'MIN_CHARS',
                        'THUMB_WIDTH',
                        'THUMB_HEIGHT',
                        'FRESH_MAX_AGE_DAYS',
                        'THUMB_MAX_LINES',
                        'THUMB_PAD',
                    ]);
                    const floatKeys = new Set([
                        'THUMB_OVERLAY',
                    ]);
                    const booleanKeys = new Set([
                        'AUTO_THUMB',
                        'REQUIRE_FRESH',
                        'STRICT_FRESH',
                        'IMAGE_SAFESEARCH',
                    ]);
                    if (numericKeys.has(UP)) {
                        const n = Number(v);
                        if (Number.isFinite(n))
                            nextUpper[UP] = String(n);
                    }
                    else if (floatKeys.has(UP)) {
                        const n = Number(v);
                        if (Number.isFinite(n))
                            nextUpper[UP] = String(n);
                    }
                    else if (booleanKeys.has(UP)) {
                        nextUpper[UP] = String(!!(v === true || String(v).toLowerCase() === 'true'));
                    }
                    else {
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
        if (Object.prototype.hasOwnProperty.call(data || {}, 'claudeWorkspaceId')) {
            const workspaceId = String(data['claudeWorkspaceId'] || '').trim();
            if (workspaceId && !/^wrkspc_[A-Za-z0-9]{8,128}$/.test(workspaceId)) {
                throw new Error('Claude 작업공간 ID 형식이 올바르지 않습니다.');
            }
            delete nextUpper['claudeWorkspaceId'];
            delete nextUpper['CLAUDE_WORKSPACE_ID'];
            nextUpper['ANTHROPIC_WORKSPACE_ID'] = workspaceId;
        }
        if (!nextUpper['AI_PROVIDER'])
            nextUpper['AI_PROVIDER'] = 'openai';
        if (!nextUpper['GOOGLE_REDIRECT_URI'])
            nextUpper['GOOGLE_REDIRECT_URI'] = 'http://localhost:8765/';
        if (!nextUpper['MIN_CHARS'])
            nextUpper['MIN_CHARS'] = '3000';
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
        const text = stringifyDotEnv(nextUpper);
        const p = envPath();
        await fsp.mkdir(path.dirname(p), { recursive: true });
        await fsp.writeFile(p, text, 'utf-8');
        return { ok: true, logs: `.env saved at ${p}` };
    }
    catch (e) {
        return { ok: false, exitCode: 1, error: e?.message || String(e) };
    }
}
//# sourceMappingURL=env.js.map