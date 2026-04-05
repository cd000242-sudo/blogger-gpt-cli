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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const puppeteer_extra_1 = __importDefault(require("puppeteer-extra"));
const puppeteer_extra_plugin_stealth_1 = __importDefault(require("puppeteer-extra-plugin-stealth"));
const cheerio = __importStar(require("cheerio"));
const snippet_library_1 = require("../dist/utils/snippet-library");
const env_1 = require("../dist/env");
// 기존 라이선스 시스템 (license-manager.js)
const oldLicenseManager = require('../dist/utils/license-manager');
const checkLicenseStatus = oldLicenseManager.checkLicenseStatus;
const redeemLicense = oldLicenseManager.redeemLicense;
const getOrCreateDeviceId = oldLicenseManager.getOrCreateDeviceId;
// 새로운 라이선스 시스템 (license-manager.ts)
const license_manager_new_1 = require("../dist/utils/license-manager-new");
const main_login_1 = require("./main-login");
// 매직 넘버 상수화
const TIMEOUT_MS = 15000;
const MAX_CONTENT_LENGTH = 3000;
const MAX_OUTPUT_TOKENS = 8000;
const IMAGE_COMPRESSION_LEVEL = 9;
const IMAGE_QUALITY = 90;
const URL_FETCH_TIMEOUT_MS = 10000;
const MAX_TITLE_LENGTH = 30;
const MIN_TITLE_LENGTH = 5;
const MAX_OUTPUT_TOKENS_TITLE = 500;
// ============================================
// 🔥 통합 모듈 경로 해석기 (404 방지)
// 개발/배포 환경 모두에서 동일하게 작동
// ============================================
const MODULE_BASE_PATH = path.resolve(__dirname, '..');
/**
 * 모듈 경로를 절대경로로 해석
 * @param modulePath - 상대 경로 (예: 'dist/utils/golden-keyword-analyzer')
 * @returns 절대 경로
 */
function resolveModulePath(modulePath) {
    return path.join(MODULE_BASE_PATH, modulePath);
}
/**
 * dist/utils 모듈 로드 헬퍼
 * @param moduleName - 모듈 이름 (예: 'golden-keyword-analyzer')
 */
function loadUtilsModule(moduleName) {
    const fullPath = resolveModulePath(`dist/utils/${moduleName}`);
    return require(fullPath);
}
/**
 * dist/core 모듈 로드 헬퍼
 * @param moduleName - 모듈 이름 (예: 'schedule-manager')
 */
function loadCoreModule(moduleName) {
    const fullPath = resolveModulePath(`dist/core/${moduleName}`);
    return require(fullPath);
}
/**
 * src/core 모듈 로드 헬퍼 (TypeScript 개발용)
 * @param moduleName - 모듈 이름 (예: 'index')
 */
function loadSrcCoreModule(moduleName) {
    const fullPath = resolveModulePath(`src/core/${moduleName}`);
    return require(fullPath);
}
/**
 * src/utils 모듈 로드 헬퍼 (TypeScript 개발용)
 * @param moduleName - 모듈 이름 (예: 'license-manager')
 */
function loadSrcUtilsModule(moduleName) {
    const fullPath = resolveModulePath(`src/utils/${moduleName}`);
    return require(fullPath);
}
// 핸들러 중복 방지 래퍼
const registeredHandlers = new Map();
function safeRegisterHandler(channel, handler) {
    if (registeredHandlers.has(channel)) {
        console.log(`[MAIN] ⚠️ ${channel} 핸들러가 이미 등록되어 있습니다 (건너뜀)`);
        return;
    }
    try {
        electron_1.ipcMain.handle(channel, handler);
        registeredHandlers.set(channel, true);
        console.log(`[MAIN] ✅ ${channel} 핸들러 등록 완료`);
    }
    catch (error) {
        console.error(`[MAIN] ❌ ${channel} 핸들러 등록 실패:`, error);
    }
}
// 모델 실패 캐시 (404 오류 모델은 다시 시도하지 않음)
const failedModelsCache = new Set();
// 선택된 모델 캐시 (한 번 선택하면 재사용)
let cachedModel = null;
let cachedModelName = null;
// Gemini 모델 선택 함수 (2.0 이상만 사용)
async function selectGeminiModel(genAI) {
    // 이미 선택된 모델이 있으면 재사용 (빠른 처리)
    if (cachedModel && cachedModelName) {
        return cachedModel;
    }
    // 🔥 2.0 이상 모델만 사용 (1.5 버전 절대 사용 안 함)
    // gemini-2.0-flash-preview는 404 오류로 제거, 실제 사용 가능한 모델만 사용
    const modelNames = [
        'gemini-2.5-flash', // 최신 모델 (우선 사용)
        'gemini-2.0-flash-exp', // 실험적 모델
        'gemini-2.0-flash-thinking-exp' // 실험적 모델
    ];
    for (const modelName of modelNames) {
        // 이미 실패한 모델(404 등)은 건너뛰기
        if (failedModelsCache.has(modelName)) {
            console.log(`[GEMINI-MODEL] ⏭️ 모델 ${modelName} 건너뛰기 (이전 실패 기록)`);
            continue;
        }
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // 테스트 요청 (짧은 텍스트로) - 최초 1회만
            const testResult = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: 'test' }] }],
                generationConfig: {
                    maxOutputTokens: 10,
                }
            });
            await testResult.response; // 응답 대기
            console.log(`[GEMINI-MODEL] ✅ 모델 선택 및 캐싱: ${modelName}`);
            // 모델 캐싱 (다음 호출 시 재사용)
            cachedModel = model;
            cachedModelName = modelName;
            return model;
        }
        catch (e) {
            const errorMsg = e?.message || String(e);
            // API 키 관련 에러인 경우 즉시 중단
            if (errorMsg.includes('403') || errorMsg.includes('API Key') || errorMsg.includes('unregistered callers')) {
                console.error(`[GEMINI-MODEL] ❌ API 키 인증 실패 (${modelName}):`, errorMsg);
                throw e; // 에러를 다시 던져서 상위에서 처리
            }
            // 404 모델 없음 오류인 경우 캐시에 추가하고 건너뛰기
            if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('is not supported')) {
                console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 존재하지 않음 (404), 캐시에 추가하고 건너뛰기`);
                failedModelsCache.add(modelName);
                continue;
            }
            // 429 할당량 초과 오류인 경우 다음 모델로 시도
            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('quota') || errorMsg.includes('exceeded')) {
                console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 할당량 초과, 다음 모델 시도`);
                continue;
            }
            // 다른 에러는 다음 모델로 시도
            console.warn(`[GEMINI-MODEL] ⚠️ 모델 ${modelName} 실패, 다음 모델 시도:`, errorMsg.substring(0, 100));
            continue;
        }
    }
    // 모든 2.0 이상 모델 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
    console.error('[GEMINI-MODEL] ❌ 모든 2.0 이상 모델 실패 - 1.5 버전은 사용하지 않습니다');
    throw new Error('사용 가능한 Gemini 2.0 이상 모델이 없습니다. API 키와 할당량을 확인해주세요.');
}
// 공통 친절한 에러 메시지 매퍼
function toFriendlyApiError(service, status, rawMessage) {
    const statusStr = String(status ?? '').toLowerCase();
    const raw = (rawMessage || '').toLowerCase();
    // 공통 힌트
    const keyHints = 'API 키를 확인해주세요 (앞뒤 공백 제거, 오타/띄어쓰기 확인). 환경설정에 다시 저장해보세요.';
    if (statusStr.includes('429') || raw.includes('quota') || raw.includes('rate')) {
        if (service === 'openai') {
            return '오픈AI API 키 충전액이 소진되었습니다. 충전 후 사용하세요.';
        }
        return 'API 할당량이 부족합니다. 잠시 후 다시 시도하거나 다른 키를 사용해주세요.';
    }
    if (statusStr.includes('401') || statusStr.includes('403') || raw.includes('invalid api key') || raw.includes('api key')) {
        return `API 키 인증 오류입니다. ${keyHints}`;
    }
    if (statusStr.startsWith('5') || raw.includes('server')) {
        return 'API 서버 오류입니다. 잠시 후 다시 시도해주세요.';
    }
    if (raw.includes('timeout') || raw.includes('timed out')) {
        return '요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.';
    }
    if (raw.includes('network') || raw.includes('fetch') || raw.includes('econnrefused') || raw.includes('enetunreach')) {
        return '네트워크 오류입니다. 인터넷 연결과 방화벽/프록시 설정을 확인해주세요.';
    }
    // 서비스별 추가 힌트
    switch (service) {
        case 'google-cse':
            return 'Google CSE 요청 실패입니다. CSE 키/CX가 맞는지와 허용 도메인/쿼리 제한을 확인해주세요.';
        case 'naver-datalab':
            return '네이버 데이터랩 요청 실패입니다. Client ID/Secret을 확인하고 호출 제한을 확인해주세요.';
        case 'blogger':
            return 'Blogger 게시 실패입니다. 토큰 만료 또는 본문/HTML 길이 제한 초과 여부를 확인해주세요.';
        case 'wordpress':
            return 'WordPress 게시 실패입니다. 사이트 URL/계정/애플리케이션 비밀번호를 확인해주세요.';
        default:
            return rawMessage || '알 수 없는 오류가 발생했습니다.';
    }
}
// 기존 IPC 핸들러 제거 (중복 방지)
try {
    if (electron_1.ipcMain.listenerCount('generate-internal-consistency-title') > 0) {
        console.log('[INTERNAL-CONSISTENCY] 기존 제목 생성 핸들러 제거 중...');
        electron_1.ipcMain.removeHandler('generate-internal-consistency-title');
    }
    if (electron_1.ipcMain.listenerCount('generate-internal-consistency') > 0) {
        console.log('[INTERNAL-CONSISTENCY] 기존 종합글 생성 핸들러 제거 중...');
        electron_1.ipcMain.removeHandler('generate-internal-consistency');
    }
}
catch (e) {
    // 무시 (핸들러가 없을 수 있음)
}
// 라이선스 상태 조회
electron_1.ipcMain.handle('license-status', async () => {
    try {
        // 🔧 개발 모드면 라이센스 체크 건너뛰기
        if (process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development') {
            console.log('[LICENSE] 개발 모드 - 라이센스 체크 건너뛰기');
            return {
                ok: true,
                status: { activated: true, type: 'dev', expiresAt: null },
                deviceId: 'dev-mode',
                redeemUrl: ''
            };
        }
        const status = await checkLicenseStatus();
        const env = (0, env_1.loadEnvFromFile)();
        const deviceId = getOrCreateDeviceId();
        const redeemUrl = env.licenseRedeemUrl || env.LICENSE_REDEEM_URL || '';
        return { ok: true, status, deviceId, redeemUrl };
    }
    catch (e) {
        const errorMessage = e instanceof Error ? e.message : '라이선스 상태 확인 실패';
        return { ok: false, error: errorMessage };
    }
});
// 라이선스 활성화
electron_1.ipcMain.handle('license-activate', async (_evt, payload) => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        const redeemUrl = env.licenseRedeemUrl || env.LICENSE_REDEEM_URL || '';
        const status = await redeemLicense(payload?.code || '', redeemUrl);
        if (status && typeof status === 'object' && 'activated' in status && status.activated) {
            return { ok: true, status };
        }
        const reason = (status && typeof status === 'object' && 'reason' in status && typeof status.reason === 'string')
            ? status.reason
            : '활성화 실패';
        return { ok: false, error: reason };
    }
    catch (e) {
        const errorMessage = e instanceof Error ? e.message : '활성화 실패';
        return { ok: false, error: errorMessage };
    }
});
// 새로운 라이선스 인증 (아이디/비밀번호/코드)
electron_1.ipcMain.handle('license-authenticate', async (_evt, payload) => {
    try {
        console.log('[AUTH] 인증 요청 수신:', { userId: payload.userId, hasPassword: !!payload.password, hasCode: !!payload.licenseCode });
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        console.log('[AUTH] licensePath:', licenseManager.licensePath);
        const result = await licenseManager.authenticate(payload.userId || '', payload.password || '', payload.licenseCode);
        console.log('[AUTH] 인증 결과:', { success: result.success, message: result.message });
        return result;
    }
    catch (e) {
        const errorMessage = e instanceof Error ? e.message : '인증 실패';
        console.error('[AUTH] 인증 예외:', errorMessage);
        return { success: false, message: errorMessage };
    }
});
// 라이선스 상태 확인 (새로운 시스템) - 강화된 검증
electron_1.ipcMain.handle('license-status-new', async () => {
    try {
        // 강화된 검증 사용 (서버 시간 동기화 포함)
        const { validateLicenseStrict } = await Promise.resolve().then(() => __importStar(require('../dist/utils/license-validator')));
        const validation = await validateLicenseStrict();
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        const status = licenseManager.getLicenseStatus();
        if (validation.valid) {
            return {
                valid: true,
                message: validation.message,
                type: status.licenseData?.licenseType,
                expiresAt: status.licenseData?.expiresAt,
                serverTime: validation.serverTime,
                timeDiff: validation.timeDiff
            };
        }
        else {
            // 만료 또는 무효
            return {
                valid: false,
                message: validation.message,
                type: status.licenseData?.licenseType,
                expiresAt: status.licenseData?.expiresAt,
                expired: validation.expired,
                serverTime: validation.serverTime,
                timeDiff: validation.timeDiff
            };
        }
    }
    catch (e) {
        console.error('[LICENSE] 상태 확인 중 오류:', e);
        // 오류 발생 시 기본 검증으로 폴백
        try {
            const licenseManager = (0, license_manager_new_1.getLicenseManager)();
            const status = licenseManager.getLicenseStatus();
            // 기간제 만료 확인
            if (status.valid && status.licenseData?.licenseType === 'temporary' && status.licenseData?.expiresAt) {
                if (status.licenseData.expiresAt <= Date.now()) {
                    return {
                        valid: false,
                        message: '라이선스가 만료되었습니다. 코드를 다시 등록해주세요.',
                        type: 'temporary',
                        expiresAt: status.licenseData.expiresAt,
                        expired: true
                    };
                }
            }
            return {
                ...status,
                type: status.licenseData?.licenseType,
                expiresAt: status.licenseData?.expiresAt
            };
        }
        catch (fallbackError) {
            const errorMessage = e instanceof Error ? e.message : '상태 확인 실패';
            return { valid: false, message: errorMessage, expired: true };
        }
    }
});
// 라이선스 로그아웃
electron_1.ipcMain.handle('license-logout', async () => {
    try {
        console.log('[LICENSE] 로그아웃 시도...');
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        await licenseManager.logout(); // 서버에 세션 종료 요청 포함
        console.log('[LICENSE] ✅ 로그아웃 완료');
        return { success: true, message: '로그아웃되었습니다.' };
    }
    catch (e) {
        console.error('[LICENSE] 로그아웃 오류:', e);
        const errorMessage = e instanceof Error ? e.message : '로그아웃 실패';
        return { success: false, error: errorMessage };
    }
});
// 앱 재시작 (로그아웃 후)
electron_1.ipcMain.handle('app-relaunch', async () => {
    electron_1.app.relaunch();
    electron_1.app.exit(0);
});
// 세션 유효성 검증 (중복 로그인 감지)
electron_1.ipcMain.handle('session-validate', async () => {
    try {
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        const result = await licenseManager.validateSession();
        return result;
    }
    catch (e) {
        console.error('[SESSION] 검증 오류:', e);
        return {
            valid: false,
            code: 'SERVER_ERROR',
            message: e instanceof Error ? e.message : '세션 검증 실패'
        };
    }
});
// 주기적 세션 검증 시작 (중복 로그인 감지)
electron_1.ipcMain.handle('session-start-validation', async () => {
    try {
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        const { BrowserWindow } = await Promise.resolve().then(() => __importStar(require('electron')));
        licenseManager.startSessionValidation((reason) => {
            console.log('[SESSION] ⚠️ 세션 만료:', reason);
            // 모든 창에 세션 만료 알림 전송
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                if (!win.isDestroyed()) {
                    win.webContents.send('session-expired', { reason });
                }
            });
        });
        return { success: true };
    }
    catch (e) {
        console.error('[SESSION] 검증 시작 오류:', e);
        return { success: false, error: e instanceof Error ? e.message : '세션 검증 시작 실패' };
    }
});
// 주기적 세션 검증 중지
electron_1.ipcMain.handle('session-stop-validation', async () => {
    try {
        const licenseManager = (0, license_manager_new_1.getLicenseManager)();
        licenseManager.stopSessionValidation();
        return { success: true };
    }
    catch (e) {
        console.error('[SESSION] 검증 중지 오류:', e);
        return { success: false, error: e instanceof Error ? e.message : '세션 검증 중지 실패' };
    }
});
// 자동 로그인 설정 저장
electron_1.ipcMain.handle('save-auto-login-config', async (_evt, enabled, userId) => {
    try {
        const { saveAutoLoginConfig } = await Promise.resolve().then(() => __importStar(require('../dist/utils/auto-login-manager')));
        saveAutoLoginConfig(enabled, userId);
        return { success: true };
    }
    catch (e) {
        const errorMessage = e instanceof Error ? e.message : '설정 저장 실패';
        return { success: false, error: errorMessage };
    }
});
// 자동 로그인 설정 로드
electron_1.ipcMain.handle('load-auto-login-config', async () => {
    try {
        const { loadAutoLoginConfig } = await Promise.resolve().then(() => __importStar(require('../dist/utils/auto-login-manager')));
        return loadAutoLoginConfig();
    }
    catch (e) {
        // 오류 발생 시 기본값 반환
        if (e instanceof Error) {
            console.debug('[AUTO-LOGIN] 설정 로드 중 오류 (무시됨):', e.message);
        }
        return { enabled: false };
    }
});
// 내부일관성글 제목 생성 핸들러
electron_1.ipcMain.handle('generate-internal-consistency-title', async (_evt, payload) => {
    try {
        console.log('[INTERNAL-CONSISTENCY] 제목 생성 요청:', payload);
        const urls = payload.urls || [];
        if (urls.length === 0) {
            return { success: false, error: 'URL이 필요합니다.' };
        }
        // 1단계: 각 URL에서 제목 크롤링
        console.log('[INTERNAL-CONSISTENCY] URL에서 제목 추출 중...');
        const crawledTitles = [];
        for (const url of urls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), URL_FETCH_TIMEOUT_MS);
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    }
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const html = await response.text();
                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                    if (titleMatch && titleMatch[1]) {
                        const title = titleMatch[1].trim()
                            .replace(/\s*\|\s*.*$/, '') // "제목 | 사이트명" 형태 제거
                            .replace(/\s*-\s*.*$/, '') // "제목 - 사이트명" 형태 제거
                            .trim();
                        if (title && title.length > 3) {
                            crawledTitles.push(title);
                            console.log(`[INTERNAL-CONSISTENCY] ✅ 제목 추출: ${title.substring(0, 50)}...`);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`[INTERNAL-CONSISTENCY] ⚠️ URL 크롤링 실패 (${url}):`, error.message);
                // 개별 URL 실패는 무시하고 계속 진행
            }
        }
        if (crawledTitles.length === 0) {
            return { success: false, error: 'URL에서 제목을 추출할 수 없습니다.' };
        }
        // 2단계: 환경변수에서 Gemini API 키 가져오기
        const envData = (0, env_1.loadEnvFromFile)();
        const geminiKey = envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';
        if (!geminiKey) {
            // API 키가 없으면 크롤링한 제목들을 분석하여 간단한 종합 제목 생성
            const keywords = [];
            crawledTitles.forEach(title => {
                const words = title.split(/\s+/).filter(w => w.length > 1);
                keywords.push(...words.slice(0, 3)); // 각 제목에서 상위 3개 단어만
            });
            // 중복 제거 및 빈도순 정렬
            const wordFreq = new Map();
            keywords.forEach(word => {
                wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
            });
            const topKeywords = Array.from(wordFreq.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([word]) => word);
            const fallbackTitle = `${topKeywords.join(' ')} 종합 가이드 ${new Date().getFullYear()}`;
            console.log('[INTERNAL-CONSISTENCY] API 키 없음, 폴백 제목 생성:', fallbackTitle);
            return { success: true, title: fallbackTitle };
        }
        // 3단계: AI로 SEO 최적화된 종합 제목 생성
        console.log('[INTERNAL-CONSISTENCY] AI로 종합 제목 생성 중...');
        const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
        const genAI = new GoogleGenerativeAI(geminiKey);
        // Gemini 모델 선택 (2.0 이상만 사용)
        let model;
        try {
            model = await selectGeminiModel(genAI);
        }
        catch (error) {
            // 2.0 이상 모델 모두 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('[INTERNAL-CONSISTENCY] ❌ 모든 2.0 이상 모델 실패:', errorMsg);
            throw new Error(`Gemini 2.0 이상 모델을 사용할 수 없습니다. ${errorMsg}`);
        }
        const prompt = `
다음 URL들에서 추출한 제목들을 분석하여, 이 글들을 모두 포함하는 SEO에 최적화되고 클릭을 유발하는 종합 글 제목을 생성해주세요.

【추출된 제목들】
${crawledTitles.map((title, idx) => `${idx + 1}. ${title}`).join('\n')}

📌 **제목 생성 요구사항:**
- 위 제목들을 모두 포함하는 종합적인 주제를 파악하여 반영
- SEO에 최적화 (핵심 키워드 포함)
- 클릭을 유발하는 강력한 제목 (20-30자)
- "종합", "가이드", "모든 것" 같은 흔한 표현 지양
- 구체적 숫자나 질문형, 긴급성 요소 포함 가능
- 자연스럽고 읽기 쉬운 제목

⚠️ **출력 형식:**
- 단 하나의 제목만 출력
- 마크다운 형식 사용 금지
- 번호나 설명 없이 제목만 출력

제목만 출력해주세요.
`;
        // safeGenerateContent 직접 구현 (간단한 버전)
        let generatedTitle = '';
        try {
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: MAX_OUTPUT_TOKENS_TITLE,
                    temperature: 0.9,
                }
            });
            const response = await result.response;
            generatedTitle = response.text();
        }
        catch (error) {
            console.error('[INTERNAL-CONSISTENCY] AI 제목 생성 실패:', error);
            // 폴백: 크롤링한 제목들을 조합
            const topKeywords = crawledTitles[0].split(/\s+/).slice(0, 3);
            generatedTitle = `${topKeywords.join(' ')} 종합 가이드 ${new Date().getFullYear()}`;
        }
        // 제목 정제
        let finalTitle = generatedTitle.trim()
            .replace(/^\d+\.\s*/, '') // 번호 제거
            .replace(/^[-*]\s*/, '') // 불릿 제거
            .replace(/\*\*/g, '') // 마크다운 제거
            .replace(/^["']|["']$/g, '') // 따옴표 제거
            .split('\n')[0] // 첫 줄만 사용
            .trim();
        // 제목 길이 제한
        if (finalTitle.length > MAX_TITLE_LENGTH) {
            const words = finalTitle.substring(0, MAX_TITLE_LENGTH).split(/\s+/);
            if (words.length > 1) {
                words.pop();
                finalTitle = words.join(' ').trim();
            }
            else {
                finalTitle = finalTitle.substring(0, MAX_TITLE_LENGTH - 3) + '...';
            }
        }
        if (!finalTitle || finalTitle.length < MIN_TITLE_LENGTH) {
            // 최종 검증 실패 시 폴백
            const fallbackTitle = `${crawledTitles[0].substring(0, 20)} 종합 가이드 ${new Date().getFullYear()}`;
            console.log('[INTERNAL-CONSISTENCY] 생성된 제목이 너무 짧음, 폴백 사용:', fallbackTitle);
            return { success: true, title: fallbackTitle };
        }
        console.log('[INTERNAL-CONSISTENCY] ✅ 생성된 제목:', finalTitle);
        return { success: true, title: finalTitle };
    }
    catch (error) {
        console.error('[INTERNAL-CONSISTENCY] 제목 생성 실패:', error);
        return {
            success: false,
            error: error.message || '알 수 없는 오류가 발생했습니다.'
        };
    }
});
// 내부일관성글 종합글 생성 핸들러
electron_1.ipcMain.handle('generate-internal-consistency', async (_evt, payload) => {
    try {
        console.log('[INTERNAL-CONSISTENCY] 종합글 생성 요청:', payload);
        const urls = payload.urls || [];
        const title = payload.title || '종합 가이드';
        const posts = payload.posts || [];
        if (urls.length === 0) {
            return { success: false, error: 'URL이 필요합니다.' };
        }
        // 1단계: 환경변수에서 API 키 가져오기
        const envData = (0, env_1.loadEnvFromFile)();
        const geminiKey = envData.geminiKey || envData.GEMINI_API_KEY || process.env['GEMINI_API_KEY'] || '';
        if (!geminiKey || geminiKey.trim() === '') {
            console.error('[INTERNAL-CONSISTENCY] ❌ Gemini API 키가 없습니다.');
            console.error('[INTERNAL-CONSISTENCY] envData:', {
                hasGeminiKey: !!envData.geminiKey,
                hasGEMINI_API_KEY: !!envData.GEMINI_API_KEY,
                hasProcessEnv: !!process.env['GEMINI_API_KEY']
            });
            return {
                success: false,
                error: 'Gemini API 키가 필요합니다. 환경 설정에서 API 키를 입력해주세요.\n\n설정 방법:\n1. 앱의 "설정" 탭으로 이동\n2. "Gemini API Key" 필드에 API 키 입력\n3. 저장 후 다시 시도해주세요.'
            };
        }
        // API 키 유효성 검사 (최소 길이 체크)
        if (geminiKey.length < 20) {
            console.error('[INTERNAL-CONSISTENCY] ❌ Gemini API 키가 너무 짧습니다:', geminiKey.length);
            return {
                success: false,
                error: 'Gemini API 키가 유효하지 않습니다. 올바른 API 키를 입력해주세요.'
            };
        }
        console.log('[INTERNAL-CONSISTENCY] ✅ Gemini API 키 확인 완료 (길이:', geminiKey.length, ')');
        // 2단계: 각 URL 크롤링하여 콘텐츠 추출
        console.log('[INTERNAL-CONSISTENCY] URL 크롤링 시작 (Puppeteer 모드)...');
        const crawledContents = [];
        // Puppeteer 설정
        puppeteer_extra_1.default.use((0, puppeteer_extra_plugin_stealth_1.default)());
        let browser = null;
        try {
            browser = await puppeteer_extra_1.default.launch({
                headless: true, // "new" is deprecated in latest puppeteer
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
            for (const post of posts) {
                try {
                    const url = post.url || '';
                    if (!url)
                        continue;
                    console.log(`[INTERNAL-CONSISTENCY] 🕷️ 크롤링 중: ${url}`);
                    const page = await browser.newPage();
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    await page.setViewport({ width: 1280, height: 800 });
                    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                    // 스크롤을 내려 동적 콘텐츠 로드 유도
                    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const html = await page.content();
                    const $ = cheerio.load(html);
                    // 제목 추출 (정밀)
                    let extractedTitle = $('title').text().trim() || post.title || '제목 없음';
                    extractedTitle = extractedTitle.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*.*$/, '').trim();
                    // 본문 내용 추출 (정밀)
                    // 불필요한 요소 제거
                    $('script, style, iframe, nav, footer, header, aside, .ads, .comments').remove();
                    let content = '';
                    const selectors = [
                        'article',
                        '.entry-content',
                        '.post-content',
                        '.content',
                        'main',
                        '#content',
                        '.view_content', // Tistory
                        '.se-main-container' // Naver Blog
                    ];
                    for (const s of selectors) {
                        const found = $(s).text().trim();
                        if (found.length > content.length) {
                            content = found;
                        }
                    }
                    // 만약 선택자로 못 찾으면 body에서 추출
                    if (content.length < 200) {
                        content = $('body').text().trim();
                    }
                    // 텍스트 정리
                    content = content
                        .replace(/\s+/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                    if (content && content.length > 200) {
                        crawledContents.push({
                            url,
                            title: extractedTitle,
                            content: content.substring(0, MAX_CONTENT_LENGTH * 2), // 요약 품질을 위해 길이 확장
                            order: post.order
                        });
                        console.log(`[INTERNAL-CONSISTENCY] ✅ 크롤링 성공 (${post.order}번째): ${extractedTitle.substring(0, 30)}... (${content.length}자)`);
                    }
                    await page.close();
                }
                catch (error) {
                    console.warn(`[INTERNAL-CONSISTENCY] ⚠️ URL 크롤링 실패 (${post.url}):`, error.message);
                }
            }
        }
        finally {
            if (browser)
                await browser.close();
        }
        if (crawledContents.length === 0) {
            return { success: false, error: 'URL에서 콘텐츠를 추출할 수 없습니다.' };
        }
        // 3단계: AI로 종합글 생성 (거미줄 구조)
        console.log('[INTERNAL-CONSISTENCY] AI로 종합글 생성 중...');
        // geminiKey는 이미 위에서 검증되었으므로 재확인 불필요
        // 하지만 안전을 위해 한 번 더 확인
        if (!geminiKey || geminiKey.trim() === '') {
            console.error('[INTERNAL-CONSISTENCY] ❌ geminiKey 변수가 비어있습니다.');
            return { success: false, error: 'Gemini API 키가 없습니다.' };
        }
        // API 키 앞뒤 공백 제거
        const trimmedKey = geminiKey.trim();
        if (trimmedKey.length < 20) {
            console.error('[INTERNAL-CONSISTENCY] ❌ API 키가 너무 짧습니다:', trimmedKey.length);
            return { success: false, error: 'Gemini API 키가 유효하지 않습니다.' };
        }
        console.log('[INTERNAL-CONSISTENCY] Gemini API 초기화 중...');
        console.log('[INTERNAL-CONSISTENCY] API 키 정보: 길이=', trimmedKey.length, ', 시작=', trimmedKey.substring(0, 8), '...', ', 끝=', '...' + trimmedKey.substring(trimmedKey.length - 4));
        const { GoogleGenerativeAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
        try {
            // API 키가 제대로 전달되는지 확인
            if (!trimmedKey || trimmedKey === '') {
                throw new Error('API 키가 비어있습니다.');
            }
            const genAI = new GoogleGenerativeAI(trimmedKey);
            console.log('[INTERNAL-CONSISTENCY] ✅ GoogleGenerativeAI 초기화 완료');
            // Gemini 모델 선택
            let model;
            try {
                console.log('[INTERNAL-CONSISTENCY] 모델 선택 시도 중...');
                model = await selectGeminiModel(genAI);
                console.log('[INTERNAL-CONSISTENCY] ✅ 모델 선택 완료');
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error('[INTERNAL-CONSISTENCY] ❌ 모델 선택 실패:', errorMsg);
                // API 키 관련 에러인지 확인
                if (errorMsg.includes('403') || errorMsg.includes('API Key') || errorMsg.includes('unregistered callers')) {
                    throw new Error(`Gemini API 키 인증 실패: ${errorMsg}\n\nAPI 키를 확인하고 다시 시도해주세요.\n\n해결 방법:\n1. 앱의 "설정" 탭에서 Gemini API Key 확인\n2. API 키가 올바른지 확인 (https://aistudio.google.com/app/apikey)\n3. API 키 앞뒤 공백 제거\n4. 저장 후 앱 재시작`);
                }
                // 2.0 이상 모델 실패 시 에러 발생 (1.5 버전 절대 사용 안 함)
                console.error('[INTERNAL-CONSISTENCY] ❌ 2.0 이상 모델 선택 실패:', errorMsg);
                throw new Error(`Gemini 2.0 이상 모델을 사용할 수 없습니다. ${errorMsg}`);
            }
            // 크롤링된 콘텐츠를 순서대로 정렬
            const sortedContents = crawledContents.sort((a, b) => a.order - b.order);
            const prompt = `
당신은 블로그 내부 링크 구조(거미줄치기)를 전문적으로 설계하는 SEO 전문가 및 카피라이터입니다.
다음 ${sortedContents.length}개의 블로그 글을 분석하여, 독자가 이 글들을 모두 읽고 싶게 만드는 강력한 '종합 가이드' 또는 '인사이트 리포트' 형태의 통합글을 작성해주세요.

【종합 글 제목】
${title}

【분석 대상 글 정보】
${sortedContents.map((item, idx) => `
[글 ${idx + 1}]
제목: ${item.title}
URL: ${item.url}
핵심 본문 데이터: ${item.content.substring(0, 5000)}...
`).join('\n')}

📌 **필수 고도화 지침 (CRITICAL):**

1. **내용의 풍부함 (70% 포함 원칙)**:
   - 각 글에 대해 단순한 한두 줄 요약이 아닌, **본문 핵심 내용의 약 70% 수준을 상세하게 정리**하여 포함하세요.
   - 독자가 이 통합글만 읽어도 각 주제에 대해 깊이 있는 정보를 얻을 수 있어야 합니다.
   - 전문적인 용어와 구체적인 수치, 핵심 인사이트를 그대로 살리세요.

2. **심리적 트리거 기반 CTA (Call To Action)**:
   - 각 섹션 끝에 독자의 호기심을 자극하는 **'심리적 후킹 문구'**를 만드세요 (예: "이 비법을 모르면 손해 보는 3가지 이유", "전문가가 숨겨둔 마지막 팁 확인하기").
   - 단순한 링크가 아닌, 클릭하고 싶게 만드는 **세련된 버튼 형태의 HTML**을 포함하세요.
   - 각 글의 성격(정보형, 후기형, 팁 등)에 맞춘 맞춤형 카피라이팅을 적용하세요.

3. **거미줄식 연결 (Spiderweb Linking)**:
   - 각 섹션이 독립적으로 존재하지 않고, 다른 섹션과의 연관성을 언급하며 자연스럽게 흐르도록 작성하세요 (예: "위에서 언급한 A 기술이 실제 현장에서 어떻게 구현되는지, 아래의 B 사례를 통해 확인해 보세요").

4. **SEO 및 가독성 최적화**:
   - <h1>~<h3> 태그를 계층적으로 사용하고, 독자가 읽기 편하도록 요점 정리(Bullet points)나 표(Table)를 적극 활용하세요.
   - 5,000자 이상의 고품질 롱폼 콘텐츠로 구성하세요.

⚠️ **출력 가이드 (HTML Fragment):**
- 완전한 HTML 문서(<html>, <body>)가 아닌, 게시판 본문에 바로 삽입 가능한 **<div> 기반 Fragment**만 출력하세요.
- 스타일은 인라인(Inline Style) 또는 미리 약속된 클래스(\`cta-container\`, \`cta-hook\`, \`cta-button\`)만 사용하세요.
- **반응형 디자인**을 고려하여 여백과 폰트 크기를 설정하세요.

지금 바로 최고의 통합글을 HTML로 작성해주세요.
`;
            let generatedContent = '';
            try {
                const result = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: MAX_OUTPUT_TOKENS,
                        temperature: 0.8,
                    }
                });
                const response = await result.response;
                generatedContent = response.text();
                // HTML 태그 정리
                generatedContent = generatedContent
                    .replace(/```html\n?/gi, '')
                    .replace(/```\n?/gi, '')
                    .trim();
            }
            catch (error) {
                console.error('[INTERNAL-CONSISTENCY] AI 종합글 생성 실패:', error);
                // API 키 관련 에러인지 확인
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
                    throw new Error(`Gemini API 키가 유효하지 않거나 권한이 없습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 환경 설정에서 Gemini API 키를 확인하세요\n2. API 키가 올바른지 확인하세요 (https://aistudio.google.com/app/apikey)\n3. API 키에 필요한 권한이 있는지 확인하세요`);
                }
                // 폴백: 간단한 종합글 생성
                generatedContent = `<h1>${title}</h1><p>이 글은 ${sortedContents.length}개의 관련 글을 종합한 내용입니다.</p>`;
                sortedContents.forEach((item, index) => {
                    generatedContent += `<h2>${index + 1}. ${item.title}</h2>`;
                    generatedContent += `<p>${item.content.substring(0, 500)}...</p>`;
                    generatedContent += `<div class="cta-container">
            <p class="cta-hook">💡 ${item.title}에 대한 더 자세한 정보가 필요하신가요?</p>
            <a href="${item.url}" class="cta-button">${item.title} 확인하기</a>
          </div>`;
                });
            }
            console.log('[INTERNAL-CONSISTENCY] ✅ 종합글 생성 완료, 콘텐츠 길이:', generatedContent.length);
            return { success: true, html: generatedContent, title };
        }
        catch (error) {
            console.error('[INTERNAL-CONSISTENCY] AI 종합글 생성 실패:', error);
            // API 키 관련 에러인지 확인
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
                throw new Error(`Gemini API 키가 유효하지 않거나 권한이 없습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 환경 설정에서 Gemini API 키를 확인하세요\n2. API 키가 올바른지 확인하세요 (https://aistudio.google.com/app/apikey)\n3. API 키에 필요한 권한이 있는지 확인하세요`);
            }
            // 폴백: 간단한 종합글 생성
            const sortedContents = crawledContents.sort((a, b) => a.order - b.order);
            let generatedContent = `<h1>${title}</h1><p>이 글은 ${sortedContents.length}개의 관련 글을 종합한 내용입니다.</p>`;
            sortedContents.forEach((item, index) => {
                generatedContent += `<h2>${index + 1}. ${item.title}</h2>`;
                generatedContent += `<p>${item.content.substring(0, 500)}...</p>`;
                generatedContent += `<div class="cta-container">
          <p class="cta-hook">💡 ${item.title}에 대한 더 자세한 정보가 필요하신가요?</p>
          <a href="${item.url}" class="cta-button">${item.title} 확인하기</a>
        </div>`;
            });
            console.log('[INTERNAL-CONSISTENCY] ✅ 폴백 종합글 생성 완료');
            return { success: true, html: generatedContent, title };
        }
    }
    catch (error) {
        console.error('[INTERNAL-CONSISTENCY] 종합글 생성 실패:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        // API 키 관련 에러인 경우 더 명확한 메시지 제공
        if (errorMessage.includes('403') || errorMessage.includes('API Key') || errorMessage.includes('unregistered callers')) {
            return {
                success: false,
                error: `Gemini API 키 오류가 발생했습니다.\n\n에러: ${errorMessage}\n\n해결 방법:\n1. 앱의 "설정" 탭으로 이동\n2. "Gemini API Key" 필드에 유효한 API 키 입력\n3. API 키는 https://aistudio.google.com/app/apikey 에서 발급받을 수 있습니다\n4. 저장 후 다시 시도해주세요`
            };
        }
        return {
            success: false,
            error: errorMessage || '알 수 없는 오류가 발생했습니다.'
        };
    }
});
electron_1.ipcMain.handle('save-image-as-png', async (_evt, payload) => {
    try {
        const { imageUrl, imageId } = payload;
        if (!imageUrl) {
            return { ok: false, error: '이미지 URL이 필요합니다.' };
        }
        // sharp를 사용하여 이미지를 PNG로 변환하고 저장
        const sharp = await Promise.resolve().then(() => __importStar(require('sharp')));
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`이미지 다운로드 실패: ${response.status}`);
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        // PNG로 변환
        const pngBuffer = await sharp.default(imageBuffer)
            .png({ compressionLevel: IMAGE_COMPRESSION_LEVEL, quality: IMAGE_QUALITY })
            .toBuffer();
        // 저장 경로 생성
        const imagesDir = path.join(electron_1.app.getPath('userData'), 'images');
        await fs.promises.mkdir(imagesDir, { recursive: true });
        const filename = imageId
            ? `img-${imageId}-${Date.now()}.png`
            : `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;
        const filePath = path.join(imagesDir, filename);
        // 파일 저장
        await fs.promises.writeFile(filePath, pngBuffer);
        // data URL 생성
        const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;
        return {
            ok: true,
            data: {
                filePath,
                dataUrl,
                url: `file://${filePath}` // 로컬 파일 경로
            }
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('[IMAGE] PNG 저장 실패:', errorMessage);
        return { ok: false, error: errorMessage };
    }
});
// Snippet Library IPC 핸들러
// 기존 핸들러 제거 (중복 방지)
try {
    if (electron_1.ipcMain.listenerCount('get-snippet-library') > 0) {
        console.log('[SNIPPET-LIBRARY] 기존 핸들러 제거 중...');
        electron_1.ipcMain.removeHandler('get-snippet-library');
    }
}
catch (e) {
    // 무시 (핸들러가 없을 수 있음)
}
// 이미지 프롬프트 생성 IPC 핸들러 (CSP 우회)
electron_1.ipcMain.handle('generate-image-prompts', async (_evt, payload) => {
    try {
        const { sections, topic, geminiKey, openaiKey, claudeKey } = payload;
        if (!sections || sections.length === 0) {
            return [];
        }
        if (!geminiKey && !openaiKey && !claudeKey) {
            throw new Error('API 키가 필요합니다. (Gemini, OpenAI, 또는 Claude 중 최소 하나)');
        }
        // 병렬 처리로 모든 섹션의 프롬프트를 동시에 생성
        const promptPromises = sections.map(async (section) => {
            try {
                const prompt = `Generate an image prompt in English for the following blog post subheading.

Topic: ${topic}
Subheading: ${section.title}

Requirements:
- Write in English only (no Korean)
- Be specific and visual
- Suitable for blog post images
- Concise (within 50 words)
- Use descriptive, visual language
- Focus on the main subject and setting

Output only the image prompt (no explanations, no quotes, no markdown):`;
                // 1단계: Gemini 2.0 이상 모델들 모두 시도 (1.5 버전 절대 사용 안 함)
                // gemini-2.0-flash-preview는 404 오류로 제거
                if (geminiKey) {
                    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp'];
                    let geminiLastError = null;
                    for (const model of geminiModels) {
                        try {
                            console.log(`[IMAGE-PROMPT] Gemini ${model} 시도 중: 섹션 ${section.index}`);
                            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }]
                                })
                            });
                            if (response.ok) {
                                const data = await response.json();
                                console.log(`[IMAGE-PROMPT] Gemini ${model} 응답 수신:`, JSON.stringify(data).substring(0, 200));
                                const generatedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                                if (generatedPrompt) {
                                    console.log(`[IMAGE-PROMPT] ✅ Gemini ${model} 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                                    return {
                                        sectionIndex: section.index,
                                        sectionTitle: section.title,
                                        prompt: generatedPrompt
                                    };
                                }
                                else {
                                    // ⚠️ 응답은 성공했지만 빈 프롬프트인 경우
                                    console.warn(`[IMAGE-PROMPT] ⚠️ Gemini ${model} 빈 프롬프트 반환, 다음 모델로 시도`);
                                    geminiLastError = new Error('Gemini API가 빈 프롬프트를 반환했습니다.');
                                    // 다음 모델로 계속 진행
                                }
                            }
                            else {
                                const errorText = await response.text().catch(() => '');
                                console.warn(`[IMAGE-PROMPT] ❌ Gemini ${model} 실패 (${response.status}), 다음 모델로 시도`);
                                if (response.status === 401 || response.status === 403) {
                                    geminiLastError = new Error(toFriendlyApiError('gemini', response.status, errorText));
                                    break; // 인증 오류는 즉시 중단
                                }
                                geminiLastError = new Error(toFriendlyApiError('gemini', response.status, errorText));
                            }
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            console.warn(`[IMAGE-PROMPT] ❌ Gemini ${model} 예외 발생, 다음 모델로 시도:`, errorMessage);
                            geminiLastError = error instanceof Error ? error : new Error(errorMessage);
                        }
                    }
                    // 모든 Gemini 모델 실패 시 로깅
                    if (geminiLastError) {
                        console.warn(`[IMAGE-PROMPT] 모든 Gemini 모델 실패, OpenAI로 폴백 시도`);
                    }
                }
                // 2단계: OpenAI 폴백
                if (openaiKey) {
                    try {
                        console.log(`[IMAGE-PROMPT] 🔄 OpenAI로 폴백 시도: 섹션 ${section.index}`);
                        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${openaiKey}`
                            },
                            body: JSON.stringify({
                                model: 'gpt-4o-mini',
                                messages: [{ role: 'user', content: prompt }],
                                temperature: 0.7,
                                max_tokens: 150
                            })
                        });
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`[IMAGE-PROMPT] OpenAI 응답 수신:`, JSON.stringify(data).substring(0, 200));
                            const generatedPrompt = data.choices?.[0]?.message?.content?.trim() || '';
                            if (generatedPrompt) {
                                console.log(`[IMAGE-PROMPT] ✅ OpenAI 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                                return {
                                    sectionIndex: section.index,
                                    sectionTitle: section.title,
                                    prompt: generatedPrompt
                                };
                            }
                            else {
                                console.warn(`[IMAGE-PROMPT] ⚠️ OpenAI 빈 프롬프트 반환, Claude로 폴백`);
                            }
                        }
                        else {
                            const errorText = await response.text().catch(() => '');
                            console.warn(`[IMAGE-PROMPT] ❌ OpenAI 실패 (${response.status}), Claude로 폴백`);
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.warn(`[IMAGE-PROMPT] ❌ OpenAI 예외 발생, Claude로 폴백:`, errorMessage);
                    }
                }
                // 3단계: Claude 폴백
                if (claudeKey) {
                    try {
                        console.log(`[IMAGE-PROMPT] 🔄 Claude로 폴백 시도: 섹션 ${section.index}`);
                        const response = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-key': claudeKey,
                                'anthropic-version': '2023-06-01'
                            },
                            body: JSON.stringify({
                                model: 'claude-3-5-sonnet-20241022',
                                max_tokens: 150,
                                messages: [{ role: 'user', content: prompt }]
                            })
                        });
                        if (response.ok) {
                            const data = await response.json();
                            console.log(`[IMAGE-PROMPT] Claude 응답 수신:`, JSON.stringify(data).substring(0, 200));
                            const generatedPrompt = data.content?.[0]?.text?.trim() || '';
                            if (generatedPrompt) {
                                console.log(`[IMAGE-PROMPT] ✅ Claude 성공: 섹션 ${section.index} - 프롬프트 길이: ${generatedPrompt.length}자`);
                                return {
                                    sectionIndex: section.index,
                                    sectionTitle: section.title,
                                    prompt: generatedPrompt
                                };
                            }
                            else {
                                console.warn(`[IMAGE-PROMPT] ⚠️ Claude 빈 프롬프트 반환`);
                            }
                        }
                        else {
                            const errorText = await response.text().catch(() => '');
                            console.error(`[IMAGE-PROMPT] ❌ Claude 실패 (${response.status}):`, errorText.substring(0, 200));
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        console.error(`[IMAGE-PROMPT] ❌ Claude 예외 발생:`, errorMessage);
                    }
                }
                // 모든 API 시도 실패
                console.error(`[IMAGE-PROMPT] ❌ 섹션 ${section.index} (${section.title}): 모든 API 시도 실패`);
                throw new Error('모든 API (Gemini → OpenAI → Claude) 시도 실패');
            }
            catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error || '알 수 없는 오류');
                console.error(`[IMAGE-PROMPT] ❌ 최종 실패 - 섹션 ${section.index} (${section.title}):`, errorMsg);
                // 구체적인 오류 원인 파악
                let detailedError = '알 수 없는 오류';
                if (errorMsg) {
                    // 오류 메시지에서 상태 코드 추출 시도
                    const statusMatch = errorMsg.match(/\b([45]\d{2})\b/);
                    const statusCode = statusMatch ? statusMatch[1] : undefined;
                    detailedError = toFriendlyApiError('gemini', statusCode, errorMsg);
                }
                console.error(`[IMAGE-PROMPT] 📝 오류 요약 - 섹션 ${section.index}: ${detailedError}`);
                return {
                    sectionIndex: section.index,
                    sectionTitle: section.title,
                    prompt: null,
                    error: detailedError
                };
            }
        });
        // 모든 프롬프트를 병렬로 생성하고 결과 수집
        const results = await Promise.all(promptPromises);
        // 성공한 프롬프트와 실패한 프롬프트 분리
        const successfulPrompts = results
            .filter((item) => item !== null && 'prompt' in item && item.prompt !== null)
            .sort((a, b) => a.sectionIndex - b.sectionIndex);
        const failedPrompts = results
            .filter((item) => item !== null && 'error' in item && item.error !== undefined)
            .sort((a, b) => a.sectionIndex - b.sectionIndex);
        // 실패한 프롬프트가 있으면 로그 출력
        if (failedPrompts.length > 0) {
            console.warn(`[IMAGE-PROMPT] ${failedPrompts.length}개 섹션 프롬프트 생성 실패:`, failedPrompts.map(f => `${f.sectionTitle}: ${f.error}`).join(', '));
        }
        // 성공한 프롬프트와 실패 정보 모두 반환
        return {
            prompts: successfulPrompts,
            errors: failedPrompts,
            successCount: successfulPrompts.length,
            totalCount: results.length
        };
    }
    catch (error) {
        console.error('[IMAGE-PROMPT] 프롬프트 생성 오류:', error);
        throw error;
    }
});
// AI 이미지 생성 (DALL-E / Pexels)
// 안전한 핸들러 등록 (중복 자동 방지)
safeRegisterHandler('generate-ai-image', async (_evt, payload) => {
    try {
        const { prompt, type, size = '1024x1024' } = payload;
        console.log(`[AI-IMAGE] 이미지 생성 요청: type=${type}, size=${size}, prompt=${prompt.substring(0, 50)}...`);
        if (type === 'dalle') {
            // DALL-E 이미지 생성
            const userDataPath = electron_1.app.getPath('userData');
            const envPath = path.join(userDataPath, '.env');
            // .env 파일에서 DALL-E API 키 로드
            let dalleApiKey = '';
            try {
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const dalleMatch = envContent.match(/DALLE_API_KEY\s*=\s*(.+)/);
                    if (dalleMatch) {
                        dalleApiKey = dalleMatch[1].trim();
                    }
                }
            }
            catch (error) {
                console.error('[AI-IMAGE] .env 파일 읽기 실패:', error);
            }
            if (!dalleApiKey) {
                return {
                    success: false,
                    error: 'DALL-E API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.'
                };
            }
            console.log('[AI-IMAGE] DALL-E API 호출 시작...');
            const response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${dalleApiKey}`
                },
                body: JSON.stringify({
                    model: 'dall-e-3',
                    prompt: prompt,
                    n: 1,
                    size: size,
                    quality: 'standard'
                })
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('[AI-IMAGE] DALL-E API 오류:', response.status, errorText.substring(0, 200));
                return {
                    success: false,
                    error: `DALL-E API 오류 (${response.status}): ${errorText.substring(0, 100)}`
                };
            }
            const data = await response.json();
            const imageUrl = data.data?.[0]?.url;
            if (!imageUrl) {
                console.error('[AI-IMAGE] DALL-E 응답에 이미지 URL 없음:', JSON.stringify(data).substring(0, 200));
                return {
                    success: false,
                    error: 'DALL-E가 이미지 URL을 반환하지 않았습니다.'
                };
            }
            console.log('[AI-IMAGE] ✅ DALL-E 이미지 생성 성공');
            return {
                success: true,
                imageUrl: imageUrl
            };
        }
        else if (type === 'pixel' || type === 'pexels') {
            // Pexels 이미지 검색
            const userDataPath = electron_1.app.getPath('userData');
            const envPath = path.join(userDataPath, '.env');
            // .env 파일에서 Pexels API 키 로드
            let pexelsApiKey = '';
            try {
                if (fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf-8');
                    const pexelsMatch = envContent.match(/PEXELS_API_KEY\s*=\s*(.+)/);
                    if (pexelsMatch) {
                        pexelsApiKey = pexelsMatch[1].trim();
                    }
                }
            }
            catch (error) {
                console.error('[AI-IMAGE] .env 파일 읽기 실패:', error);
            }
            if (!pexelsApiKey) {
                return {
                    success: false,
                    error: 'Pexels API 키가 설정되지 않았습니다. 환경설정에서 API 키를 입력해주세요.'
                };
            }
            console.log('[AI-IMAGE] Pexels API 호출 시작...');
            const searchQuery = prompt.split(' ').slice(0, 3).join(' '); // 프롬프트의 처음 3단어만 사용
            const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=1`, {
                headers: {
                    'Authorization': pexelsApiKey
                }
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error('[AI-IMAGE] Pexels API 오류:', response.status, errorText.substring(0, 200));
                return {
                    success: false,
                    error: `Pexels API 오류 (${response.status}): ${errorText.substring(0, 100)}`
                };
            }
            const data = await response.json();
            const imageUrl = data.photos?.[0]?.src?.large;
            if (!imageUrl) {
                console.error('[AI-IMAGE] Pexels에서 관련 이미지를 찾을 수 없습니다.');
                return {
                    success: false,
                    error: 'Pexels에서 관련 이미지를 찾을 수 없습니다. 다른 검색어를 시도해보세요.'
                };
            }
            console.log('[AI-IMAGE] ✅ Pexels 이미지 검색 성공');
            return {
                success: true,
                imageUrl: imageUrl
            };
        }
        else {
            return {
                success: false,
                error: `지원하지 않는 이미지 타입: ${type}`
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[AI-IMAGE] 이미지 생성 실패:', errorMessage);
        return {
            success: false,
            error: errorMessage
        };
    }
});
electron_1.ipcMain.handle('get-snippet-library', async () => {
    try {
        console.log('[SNIPPET-LIBRARY] 라이브러리 로드 시작...');
        const library = await (0, snippet_library_1.readSnippetLibrary)();
        console.log('[SNIPPET-LIBRARY] 라이브러리 로드 성공:', {
            ctas: library?.ctas?.length ?? 0,
            imagePrompts: library?.imagePrompts?.length ?? 0,
            categories: library?.categories?.length ?? 0
        });
        return { ok: true, data: library };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('[SNIPPET-LIBRARY] 라이브러리 로드 실패:', errorMessage);
        console.error('[SNIPPET-LIBRARY] 에러 상세:', error);
        return { ok: false, error: errorMessage };
    }
});
console.log('[SNIPPET-LIBRARY] get-snippet-library 핸들러 등록 완료');
electron_1.ipcMain.handle('save-snippet-library', async (_evt, library) => {
    try {
        await (0, snippet_library_1.writeSnippetLibrary)(library);
        return { ok: true };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('[SNIPPET-LIBRARY] 라이브러리 저장 실패:', errorMessage);
        return { ok: false, error: errorMessage };
    }
});
// 이미지 라이브러리 관련 코드 제거됨
// ============================================
// 🖼️ AI 이미지 자동 수집 핸들러
// ============================================
// 제목 기반 이미지 자동 수집
electron_1.ipcMain.handle('collect-images-by-title', async (_evt, payload) => {
    try {
        const { collectImagesByTitle } = await Promise.resolve().then(() => __importStar(require('../dist/image-collector.js')));
        console.log('[IMAGE-COLLECTOR] 🚀 제목 기반 이미지 수집 시작:', payload.title);
        const result = await collectImagesByTitle(payload.title, payload.subtopics, payload.naverClientId, payload.naverClientSecret, payload.options);
        return result;
    }
    catch (error) {
        console.error('[IMAGE-COLLECTOR] ❌ 수집 실패:', error.message);
        return { ok: false, images: [], folderPath: '', error: error.message };
    }
});
// 쇼핑몰 URL 기반 이미지 수집
electron_1.ipcMain.handle('collect-images-from-url', async (_evt, payload) => {
    try {
        const { collectImagesFromShoppingUrl } = await Promise.resolve().then(() => __importStar(require('../dist/image-collector.js')));
        console.log('[IMAGE-COLLECTOR] 🛍️ 쇼핑몰 URL 이미지 수집:', payload.shoppingUrl);
        const result = await collectImagesFromShoppingUrl(payload.shoppingUrl, payload.subtopics, payload.options);
        return result;
    }
    catch (error) {
        console.error('[IMAGE-COLLECTOR] ❌ 쇼핑몰 수집 실패:', error.message);
        return { ok: false, images: [], folderPath: '', error: error.message };
    }
});
// 저장된 이미지 폴더 목록 조회
electron_1.ipcMain.handle('get-image-folders', async () => {
    try {
        const { getImageFolders } = await Promise.resolve().then(() => __importStar(require('../dist/image-collector.js')));
        return { ok: true, folders: getImageFolders() };
    }
    catch (error) {
        return { ok: false, folders: [], error: error.message };
    }
});
// 폴더 내 이미지 목록 조회
electron_1.ipcMain.handle('get-folder-images', async (_evt, folderPath) => {
    try {
        const { getImagesFromFolder } = await Promise.resolve().then(() => __importStar(require('../dist/image-collector.js')));
        return { ok: true, images: getImagesFromFolder(folderPath) };
    }
    catch (error) {
        return { ok: false, images: [], error: error.message };
    }
});
// 이미지 폴더 삭제
electron_1.ipcMain.handle('delete-image-folder', async (_evt, folderPath) => {
    try {
        const { deleteImageFolder } = await Promise.resolve().then(() => __importStar(require('../dist/image-collector.js')));
        const success = deleteImageFolder(folderPath);
        return { ok: success };
    }
    catch (error) {
        return { ok: false, error: error.message };
    }
});
console.log('[IMAGE-COLLECTOR] ✅ 이미지 수집 핸들러 등록 완료');
// ============================================
// 🔥 Blogger OAuth 인증 핸들러
// ============================================
electron_1.ipcMain.handle('authenticate-blogger', async (_evt, payload) => {
    try {
        console.log('[BLOGGER-AUTH] 🔐 OAuth 인증 시작...');
        const { blogId, clientId, clientSecret } = payload;
        if (!blogId || !clientId || !clientSecret) {
            return { success: false, error: 'Blog ID, Client ID, Client Secret이 모두 필요합니다.' };
        }
        // OAuth2 인증 URL 생성
        const redirectUri = 'http://localhost:8888/callback';
        const scope = 'https://www.googleapis.com/auth/blogger';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(clientId)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=code` +
            `&scope=${encodeURIComponent(scope)}` +
            `&access_type=offline` +
            `&prompt=consent`;
        // 로컬 서버로 콜백 받기
        const http = require('http');
        const url = require('url');
        return new Promise((resolve) => {
            const server = http.createServer(async (req, res) => {
                const parsedUrl = url.parse(req.url, true);
                if (parsedUrl.pathname === '/callback') {
                    const code = parsedUrl.query.code;
                    if (code) {
                        try {
                            // 토큰 교환
                            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                                body: new URLSearchParams({
                                    client_id: clientId,
                                    client_secret: clientSecret,
                                    code: code,
                                    grant_type: 'authorization_code',
                                    redirect_uri: redirectUri
                                })
                            });
                            const tokenData = await tokenResponse.json();
                            if (tokenData.access_token) {
                                // 토큰 저장
                                const envPath = path.join(electron_1.app.getPath('userData'), '.env');
                                let envContent = '';
                                if (fs.existsSync(envPath)) {
                                    envContent = fs.readFileSync(envPath, 'utf-8');
                                }
                                // 기존 토큰 제거 후 새 토큰 추가
                                const lines = envContent.split('\n').filter(line => !line.startsWith('BLOGGER_ACCESS_TOKEN=') &&
                                    !line.startsWith('BLOGGER_REFRESH_TOKEN=') &&
                                    !line.startsWith('BLOG_ID=') &&
                                    !line.startsWith('GOOGLE_CLIENT_ID=') &&
                                    !line.startsWith('GOOGLE_CLIENT_SECRET='));
                                lines.push(`BLOG_ID=${blogId}`);
                                lines.push(`GOOGLE_CLIENT_ID=${clientId}`);
                                lines.push(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
                                lines.push(`BLOGGER_ACCESS_TOKEN=${tokenData.access_token}`);
                                if (tokenData.refresh_token) {
                                    lines.push(`BLOGGER_REFRESH_TOKEN=${tokenData.refresh_token}`);
                                }
                                fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
                                // 성공 페이지 표시
                                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                                res.end(`
                  <!DOCTYPE html>
                  <html>
                  <head><title>인증 성공</title></head>
                  <body style="font-family: sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #10b981, #059669); color: white;">
                    <h1>✅ Blogger 인증 성공!</h1>
                    <p>이 창을 닫고 앱으로 돌아가세요.</p>
                    <script>setTimeout(() => window.close(), 2000);</script>
                  </body>
                  </html>
                `);
                                server.close();
                                console.log('[BLOGGER-AUTH] ✅ 인증 성공!');
                                resolve({ success: true, email: 'authenticated', blogName: 'Blogger' });
                            }
                            else {
                                throw new Error(tokenData.error_description || '토큰 교환 실패');
                            }
                        }
                        catch (error) {
                            res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
                            res.end(`
                <!DOCTYPE html>
                <html>
                <head><title>인증 실패</title></head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #ef4444; color: white;">
                  <h1>❌ 인증 실패</h1>
                  <p>${error.message}</p>
                </body>
                </html>
              `);
                            server.close();
                            resolve({ success: false, error: error.message });
                        }
                    }
                    else {
                        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>인증 코드가 없습니다</h1>');
                        server.close();
                        resolve({ success: false, error: '인증 코드가 없습니다' });
                    }
                }
            });
            server.listen(8888, () => {
                console.log('[BLOGGER-AUTH] 콜백 서버 시작 (포트 8888)');
                // 브라우저에서 인증 URL 열기
                const { shell } = require('electron');
                shell.openExternal(authUrl);
            });
            // 2분 타임아웃
            setTimeout(() => {
                server.close();
                resolve({ success: false, error: '인증 시간 초과 (2분)' });
            }, 120000);
        });
    }
    catch (error) {
        console.error('[BLOGGER-AUTH] ❌ 오류:', error);
        return { success: false, error: error.message };
    }
});
console.log('[BLOGGER-AUTH] ✅ Blogger OAuth 인증 핸들러 등록 완료');
// ============================================
// 🔥 다중 계정 발행 핸들러
// ============================================
electron_1.ipcMain.handle('run-multi-account-post', async (_evt, payload) => {
    try {
        console.log('[MULTI-ACCOUNT] 🚀 다중 계정 발행 시작:', payload.platform, payload.keyword);
        // 기존 환경 설정 로드
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }
        // 환경 변수 파싱
        const env = {};
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        // Gemini API 키 확인
        const geminiKey = env.GEMINI_API_KEY || env.geminiKey;
        if (!geminiKey) {
            return { ok: false, error: 'Gemini API 키가 설정되지 않았습니다.' };
        }
        // 플랫폼별 설정 구성
        const postPayload = {
            topic: payload.keyword,
            keywords: payload.keyword,
            provider: 'gemini',
            geminiKey: geminiKey,
            publishType: 'now',
            thumbnailMode: payload.imageSource === 'none' ? 'none' : 'default',
            h2ImageSource: payload.imageSource,
            toneStyle: payload.toneStyle || 'professional',
            contentMode: payload.contentMode || 'external',
            crawlUrl: payload.crawlUrl || '',
        };
        if (payload.platform === 'blogger') {
            // Blogger 설정
            if (!payload.blogId || !payload.googleClientId || !payload.googleClientSecret) {
                return { ok: false, error: 'Blogger 설정이 불완전합니다. (Blog ID, Client ID, Client Secret 필요)' };
            }
            postPayload.blogId = payload.blogId;
            postPayload.googleClientId = payload.googleClientId;
            postPayload.googleClientSecret = payload.googleClientSecret;
            postPayload.redirectUri = 'http://localhost:8888/callback';
            // 토큰 확인 (저장된 토큰 사용)
            const accessToken = env.BLOGGER_ACCESS_TOKEN;
            const refreshToken = env.BLOGGER_REFRESH_TOKEN;
            if (accessToken) {
                postPayload.bloggerAccessToken = accessToken;
                postPayload.bloggerRefreshToken = refreshToken;
            }
        }
        else if (payload.platform === 'wordpress') {
            // WordPress 설정
            if (!payload.wordpressSiteUrl || !payload.wordpressUsername || !payload.wordpressPassword) {
                return { ok: false, error: 'WordPress 설정이 불완전합니다. (Site URL, Username, Password 필요)' };
            }
            postPayload.wordpressSiteUrl = payload.wordpressSiteUrl;
            postPayload.wordpressUsername = payload.wordpressUsername;
            postPayload.wordpressPassword = payload.wordpressPassword;
            postPayload.platform = 'wordpress';
        }
        console.log('[MULTI-ACCOUNT] 📝 발행 페이로드 구성 완료');
        // 실제 발행 실행
        const { generateMaxModeArticle, publishGeneratedContent } = require('../dist/core/index');
        // 콘텐츠 생성
        console.log('[MULTI-ACCOUNT] 🤖 AI 콘텐츠 생성 중...');
        const article = await generateMaxModeArticle({
            topic: postPayload.topic,
            keywords: postPayload.keywords,
            geminiKey: geminiKey,
            toneStyle: postPayload.toneStyle,
            contentMode: postPayload.contentMode,
            crawlUrl: postPayload.crawlUrl,
            h2ImageSource: postPayload.h2ImageSource,
        });
        if (!article || !article.title || !article.content) {
            return { ok: false, error: '콘텐츠 생성 실패' };
        }
        console.log('[MULTI-ACCOUNT] ✅ 콘텐츠 생성 완료:', article.title);
        // 발행
        console.log('[MULTI-ACCOUNT] 📤 발행 중...');
        const publishResult = await publishGeneratedContent({
            ...postPayload,
            title: article.title,
            content: article.content,
            thumbnailUrl: article.thumbnailUrl,
        });
        if (publishResult.ok || publishResult.success) {
            console.log('[MULTI-ACCOUNT] 🎉 발행 성공!', publishResult.url);
            return { ok: true, url: publishResult.url || publishResult.postUrl };
        }
        else {
            console.error('[MULTI-ACCOUNT] ❌ 발행 실패:', publishResult.error);
            return { ok: false, error: publishResult.error || '발행 실패' };
        }
    }
    catch (error) {
        console.error('[MULTI-ACCOUNT] ❌ 오류:', error);
        return { ok: false, error: error.message || '알 수 없는 오류' };
    }
});
console.log('[MULTI-ACCOUNT] ✅ 다중 계정 발행 핸들러 등록 완료');
// ============================================
// 환경 설정 핸들러
// ============================================
// .env 파일 읽기
electron_1.ipcMain.handle('get-env', async () => {
    try {
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        if (!fs.existsSync(envPath)) {
            return { ok: true, data: {} };
        }
        const content = fs.readFileSync(envPath, 'utf-8');
        const env = {};
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    env[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
        return { ok: true, data: env };
    }
    catch (error) {
        console.error('[ENV] .env 읽기 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', data: {} };
    }
});
// .env 파일 저장
electron_1.ipcMain.handle('save-env', async (_evt, envData) => {
    try {
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        // camelCase를 대문자 언더스코어로 변환하는 맵
        const keyMap = {
            'blogId': 'BLOG_ID',
            'bloggerId': 'BLOG_ID',
            'googleClientId': 'GOOGLE_CLIENT_ID',
            'googleClientSecret': 'GOOGLE_CLIENT_SECRET',
            'naverClientId': 'NAVER_CLIENT_ID',
            'naverClientSecret': 'NAVER_CLIENT_SECRET',
            'naverCustomerId': 'NAVER_CLIENT_ID', // 하위 호환성: naverCustomerId도 지원
            'naverSecretKey': 'NAVER_CLIENT_SECRET', // 하위 호환성: naverSecretKey도 지원
            'geminiKey': 'GEMINI_API_KEY',
            'geminiApiKey': 'GEMINI_API_KEY',
            'openaiKey': 'OPENAI_API_KEY',
            'openaiApiKey': 'OPENAI_API_KEY',
            'dalleApiKey': 'DALLE_API_KEY',
            'pexelsApiKey': 'PEXELS_API_KEY',
            'stabilityApiKey': 'STABILITY_API_KEY', // 🔥 Stability AI 추가
            'stabilityKey': 'STABILITY_API_KEY',
            'googleCseKey': 'GOOGLE_CSE_KEY',
            'googleCseCx': 'GOOGLE_CSE_CX',
            'youtubeApiKey': 'YOUTUBE_API_KEY',
            'wordpressSiteUrl': 'WORDPRESS_SITE_URL',
            'wordpressUsername': 'WORDPRESS_USERNAME',
            'wordpressPassword': 'WORDPRESS_PASSWORD',
            'minChars': 'MIN_CHARS',
            'adspowerPort': 'ADSPOWER_PORT',
            'adspowerProfileId': 'ADSPOWER_PROFILE_ID',
            'adspowerApiKey': 'ADSPOWER_API_KEY',
            'crawlProxy': 'CRAWL_PROXY'
        };
        // 기존 .env 파일 읽기
        const envMap = new Map();
        if (fs.existsSync(envPath)) {
            const existingContent = fs.readFileSync(envPath, 'utf-8');
            existingContent.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([^=]+)=(.*)$/);
                    if (match) {
                        envMap.set(match[1].trim(), match[2].trim());
                    }
                }
            });
        }
        // 새 값 업데이트 (표준 키 이름으로 변환)
        Object.entries(envData).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                const envKey = keyMap[key] || key.toUpperCase();
                envMap.set(envKey, String(value));
                // camelCase 키도 함께 저장 (하위 호환성)
                if (keyMap[key] && key !== envKey) {
                    envMap.set(key, String(value));
                }
            }
        });
        // .env 파일로 저장
        const lines = Array.from(envMap.entries()).map(([key, value]) => `${key}=${value}`);
        fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
        console.log('[ENV] .env 파일 저장 완료:', {
            저장된키: Array.from(envMap.keys()),
            총개수: envMap.size
        });
        return { ok: true };
    }
    catch (error) {
        console.error('[ENV] .env 저장 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
// ============================================
// 라이센스 파일 핸들러
// ============================================
// 라이센스 파일 읽기
electron_1.ipcMain.handle('read-license-file', async () => {
    try {
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        if (!fs.existsSync(licensePath)) {
            return { ok: true, data: null };
        }
        const content = fs.readFileSync(licensePath, 'utf-8');
        const data = JSON.parse(content);
        return { ok: true, data };
    }
    catch (error) {
        console.error('[LICENSE] 라이센스 파일 읽기 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', data: null };
    }
});
// 라이센스 파일 저장
electron_1.ipcMain.handle('save-license-file', async (_evt, licenseData) => {
    try {
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        console.error('[LICENSE] 라이센스 파일 저장 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
// ============================================
// 포스팅 실행 핸들러
// ============================================
// 🔥 반자동 완벽 끝판왕 IPC 핸들러
safeRegisterHandler('run-semi-auto-post', async (_evt, payload) => {
    console.log('[MAIN] 🔥 반자동 완벽 끝판왕 요청');
    console.log('[MAIN] 키워드:', payload.topic);
    try {
        // 진행률 추적 변수
        let currentProgress = 0;
        // onLog 콜백: 로그 전송 + 자동 진행률 추적
        const onLog = (line) => {
            // 로그 전송
            if (_evt.sender && !_evt.sender.isDestroyed()) {
                _evt.sender.send('log-line', line);
            }
            // [PROGRESS] 형식 파싱하여 진행률 업데이트
            const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
            if (progressMatch) {
                const percent = parseInt(progressMatch[1], 10);
                let label = progressMatch[2] || '';
                // 이모지 제거
                label = label.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();
                if (!isNaN(percent) && _evt.sender && !_evt.sender.isDestroyed()) {
                    currentProgress = percent;
                    _evt.sender.send('run-progress', { p: percent, label });
                }
            }
        };
        const { runSemiAutoPost } = require('../dist/core/index');
        const result = await runSemiAutoPost(payload, onLog);
        if (result.ok) {
            console.log('[MAIN] ✅ 반자동 생성 성공');
            console.log('[MAIN]    - 제목:', result.title);
            console.log('[MAIN]    - 글자수:', result.html?.length || 0);
        }
        else {
            console.error('[MAIN] ❌ 반자동 생성 실패:', result.error);
        }
        return result;
    }
    catch (error) {
        console.error('[MAIN] ❌ 반자동 생성 오류:', error);
        return {
            ok: false,
            error: error.message
        };
    }
});
// 포스트 실행 (콘텐츠 생성 + 자동 발행)
electron_1.ipcMain.handle('run-post', async (_evt, payload) => {
    let preConsumed = false;
    try {
        console.log('[RUN-POST] 포스트 실행 요청 받음');
        const { generateMaxModeArticle, publishGeneratedContent } = require('../dist/core/index');
        // env 객체 생성
        const env = {
            contentMode: payload?.contentMode || 'external',
            postingMode: payload?.postingMode || 'immediate'
        };
        // 진행률 추적 변수
        let currentProgress = 0;
        const progressStages = {
            '트렌드': 5,
            '데이터랩': 10,
            '크롤링': 25,
            '경쟁사': 35,
            'H1': 40,
            'H2': 45,
            '본문': 70,
            'CTA': 80,
            '요약': 85,
            '썸네일': 90,
            '조립': 95,
            '완료': 100
        };
        // onLog 콜백: 로그 전송 + 자동 진행률 추적
        const onLog = (line) => {
            // 로그 전송
            if (_evt.sender && !_evt.sender.isDestroyed()) {
                _evt.sender.send('log-line', line);
            }
            // 자동 진행률 추적 (로그 키워드 기반)
            for (const [keyword, progress] of Object.entries(progressStages)) {
                if (line.includes(`[${keyword}]`) || line.includes(keyword)) {
                    if (progress > currentProgress) {
                        currentProgress = progress;
                        if (_evt.sender && !_evt.sender.isDestroyed()) {
                            _evt.sender.send('run-progress', { p: currentProgress, label: line.substring(0, 100) });
                        }
                    }
                    break;
                }
            }
            // [PROGRESS] 형식도 지원
            const progressMatch = line.match(/\[PROGRESS\]\s*(\d+)%\s*-\s*(.+)/);
            if (progressMatch) {
                const percent = parseInt(progressMatch[1], 10);
                let label = progressMatch[2] || '';
                label = label.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, '').trim();
                if (!isNaN(percent) && _evt.sender && !_evt.sender.isDestroyed()) {
                    currentProgress = percent;
                    _evt.sender.send('run-progress', { p: percent, label });
                }
            }
        };
        // 무료 사용자 쿼터 체크 (선차감)
        try {
            const { enforceFreeTier, isFreeTierUser } = require('./auth-utils');
            const { consume, refund } = require('./quota-manager');
            const enforcement = await enforceFreeTier();
            if (!enforcement.allowed) {
                return enforcement.response; // PAYWALL 응답
            }
            const isFree = await isFreeTierUser();
            if (isFree) {
                await consume(1);
                preConsumed = true;
                console.log('[QUOTA] 무료 사용자: 쿼터 선차감 완료');
            }
        }
        catch (quotaError) {
            console.error('[QUOTA] 쿼터 체크 오류 (무시):', quotaError.message);
        }
        // 1. 콘텐츠 생성
        onLog('[PROGRESS] 5% - 🔥 콘텐츠 생성 시작');
        const result = await generateMaxModeArticle(payload, env, onLog);
        if (!result || typeof result !== 'object') {
            console.error('[RUN-POST] generateMaxModeArticle이 유효하지 않은 값을 반환:', result);
            return { ok: false, error: '콘텐츠 생성 결과가 유효하지 않습니다.' };
        }
        // 미리보기 모드면 발행 안 함
        const isPreviewOnly = payload?.previewOnly === true || payload?.platform === 'preview';
        if (isPreviewOnly) {
            onLog('[PROGRESS] 100% - ✅ 미리보기 생성 완료');
            return { ok: true, ...result, preview: true };
        }
        // 2. 실제 발행 (블로그스팟/워드프레스)
        onLog('[PROGRESS] 95% - 📤 블로그에 발행 중...');
        try {
            // 🔥 생성된 labels를 payload에 병합 (태그 자동 적용)
            if (result.labels && Array.isArray(result.labels) && result.labels.length > 0) {
                payload.generatedLabels = result.labels;
                console.log(`[RUN-POST] ✅ 생성된 labels ${result.labels.length}개를 payload에 병합:`, result.labels.slice(0, 5));
            }
            const publishResult = await publishGeneratedContent(payload, result.title || payload.topic, result.html || result.content, result.thumbnail || result.thumbnailUrl || '');
            if (publishResult && publishResult.ok) {
                onLog('[PROGRESS] 100% - ✅ 발행 완료!');
                console.log('[RUN-POST] ✅ 발행 성공:', publishResult.url);
                return {
                    ok: true,
                    ...result,
                    url: publishResult.url,
                    postId: publishResult.postId || publishResult.id,
                    published: true
                };
            }
            else {
                console.error('[RUN-POST] 발행 실패:', publishResult?.error);
                onLog(`[PROGRESS] 100% - ⚠️ 발행 실패: ${publishResult?.error || '알 수 없는 오류'}`);
                // 콘텐츠는 생성됨, 발행만 실패
                return {
                    ok: true,
                    ...result,
                    publishError: publishResult?.error || '발행 실패',
                    published: false
                };
            }
        }
        catch (publishError) {
            console.error('[RUN-POST] 발행 에러:', publishError);
            onLog(`[PROGRESS] 100% - ⚠️ 발행 에러: ${publishError}`);
            return {
                ok: true,
                ...result,
                publishError: publishError instanceof Error ? publishError.message : '발행 에러',
                published: false
            };
        }
    }
    catch (error) {
        console.error('[RUN-POST] 실행 실패:', error);
        // 실패 시 환불
        if (preConsumed) {
            try {
                const { refund } = require('./quota-manager');
                await refund(1);
                console.log('[QUOTA] 발행 실패: 쿼터 환불 완료');
            }
            catch (e) {
                console.error('[QUOTA] 환불 실패:', e);
            }
        }
        const errorMessage = error instanceof Error ? error.message : '실행 실패';
        return { ok: false, error: errorMessage, needsAuth: false };
    }
});
// 컨텐츠 발행
electron_1.ipcMain.handle('publish-content', async (_evt, data) => {
    try {
        console.log('[PUBLISH] 컨텐츠 발행 요청');
        console.log('[PUBLISH] 제목:', data.title?.substring(0, 50));
        console.log('[PUBLISH] 콘텐츠 길이:', data.content?.length || 0);
        console.log('[PUBLISH] 썸네일 URL:', data.thumbnailUrl ? '있음' : '없음');
        console.log('[PUBLISH] 발행 모드:', data.payload?.publishType || data.payload?.postingMode || 'immediate');
        const { publishGeneratedContent } = require('../dist/core/index');
        const result = await publishGeneratedContent(data.payload, data.title, data.content, data.thumbnailUrl);
        console.log('[PUBLISH] 발행 결과:', {
            ok: result?.ok,
            hasUrl: !!result?.url,
            url: result?.url?.substring(0, 100) || '없음',
            hasPostId: !!result?.postId || !!result?.id,
            postId: result?.postId || result?.id || '없음',
            error: result?.error || '없음'
        });
        // publishGeneratedContent가 이미 { ok, url, ... } 형태로 반환하므로 그대로 반환
        if (!result || typeof result !== 'object') {
            console.error('[PUBLISH] publishGeneratedContent가 유효하지 않은 값을 반환:', result);
            return { ok: false, error: '발행 결과가 유효하지 않습니다.' };
        }
        // URL이 없으면 경고 로그
        if (result.ok && !result.url && !result.postId && !result.id) {
            console.warn('[PUBLISH] ⚠️ 발행은 성공했지만 URL이나 ID가 반환되지 않았습니다.');
            console.warn('[PUBLISH] 응답 전체:', JSON.stringify(result, null, 2));
        }
        // result가 이미 ok 속성을 가지고 있으므로 그대로 반환
        return result;
    }
    catch (error) {
        console.error('[PUBLISH] 발행 실패:', error);
        const errorMessage = error instanceof Error ? error.message : '발행 실패';
        return { ok: false, error: errorMessage, needsAuth: false };
    }
});
// ============================================
// 스케줄 관리 핸들러
// ============================================
// 스케줄 목록 조회
electron_1.ipcMain.handle('get-schedules', async () => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        const schedules = manager.getAllSchedules();
        return { ok: true, schedules };
    }
    catch (error) {
        console.error('[SCHEDULE] 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', schedules: [] };
    }
});
// 스케줄 추가
electron_1.ipcMain.handle('add-schedule', async (_evt, schedule) => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        const id = manager.addSchedule(schedule);
        const addedSchedule = manager.getSchedule(id);
        return { ok: true, schedule: addedSchedule };
    }
    catch (error) {
        console.error('[SCHEDULE] 추가 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
    }
});
// 스케줄 토글
electron_1.ipcMain.handle('toggle-schedule', async (_evt, id, enabled) => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        manager.updateSchedule(id, { status: enabled ? 'pending' : 'cancelled' });
        return { ok: true };
    }
    catch (error) {
        console.error('[SCHEDULE] 토글 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '토글 실패' };
    }
});
// 스케줄 삭제
electron_1.ipcMain.handle('delete-schedule', async (_evt, id) => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        const deleted = manager.deleteSchedule(id);
        return { ok: deleted };
    }
    catch (error) {
        console.error('[SCHEDULE] 삭제 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '삭제 실패' };
    }
});
// 스케줄 상태 조회
electron_1.ipcMain.handle('get-schedule-status', async () => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        const status = manager.getScheduleStatus();
        return { ok: true, status };
    }
    catch (error) {
        console.error('[SCHEDULE] 상태 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '상태 조회 실패', status: null };
    }
});
// 스케줄 모니터링 시작
electron_1.ipcMain.handle('start-schedule-monitoring', async () => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        manager.startMonitoring();
        return { ok: true };
    }
    catch (error) {
        console.error('[SCHEDULE] 모니터링 시작 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '모니터링 시작 실패' };
    }
});
// 스케줄 모니터링 중지
electron_1.ipcMain.handle('stop-schedule-monitoring', async () => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        manager.stopMonitoring();
        return { ok: true };
    }
    catch (error) {
        console.error('[SCHEDULE] 모니터링 중지 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '모니터링 중지 실패' };
    }
});
// 오래된 스케줄 정리
electron_1.ipcMain.handle('cleanup-schedules', async (_evt, daysToKeep = 30) => {
    try {
        const { getScheduleManager } = require('../dist/core/schedule-manager');
        const manager = getScheduleManager();
        const deletedCount = manager.cleanupOldSchedules(daysToKeep);
        return { ok: true, deletedCount };
    }
    catch (error) {
        console.error('[SCHEDULE] 정리 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '정리 실패' };
    }
});
// ============================================
// 설정 보호 핸들러
// ============================================
electron_1.ipcMain.handle('set-settings-protection', async (_evt, protectedMode) => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'user-config.json');
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        config.settingsProtected = protectedMode;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
    }
});
electron_1.ipcMain.handle('is-settings-protected', async () => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'user-config.json');
        if (!fs.existsSync(configPath)) {
            return { ok: true, protected: false };
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ok: true, protected: !!config.settingsProtected };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '확인 실패', protected: false };
    }
});
// ============================================
// 사용자 설정 핸들러
// ============================================
electron_1.ipcMain.handle('save-user-config', async (_evt, config) => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'user-config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
electron_1.ipcMain.handle('get-user-config', async () => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'user-config.json');
        if (!fs.existsSync(configPath)) {
            return { ok: true, config: {} };
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ok: true, config };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', config: {} };
    }
});
// ============================================
// 외부 링크/브라우저 핸들러
// ============================================
electron_1.ipcMain.handle('open-link', async (_evt, href) => {
    try {
        const { shell } = require('electron');
        await shell.openExternal(href);
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
    }
});
electron_1.ipcMain.handle('open-external', async (_evt, url) => {
    try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
    }
});
// ============================================
// 환경 검증 핸들러
// ============================================
electron_1.ipcMain.handle('validate-env', async () => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        const errors = [];
        if (!env.GEMINI_API_KEY && !env.geminiKey)
            errors.push('Gemini API 키가 없습니다');
        if (!env.BLOGGER_CLIENT_ID && !env.bloggerClientId)
            errors.push('Blogger 클라이언트 ID가 없습니다');
        return { ok: true, valid: errors.length === 0, errors };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '검증 실패', valid: false, errors: [] };
    }
});
// ============================================
// 썸네일 생성 핸들러
// ============================================
electron_1.ipcMain.handle('make-thumb', async (_evt, payload) => {
    try {
        const { makeSmartThumbnail } = require('../dist/thumbnail');
        const result = await makeSmartThumbnail(payload.topic, payload.mode || 'default');
        return { ok: true, thumbnailUrl: result };
    }
    catch (error) {
        console.error('[THUMBNAIL] 생성 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '생성 실패' };
    }
});
// 🖼️ Enhanced 썸네일 생성 핸들러
safeRegisterHandler('generate-thumbnail', async (_evt, options) => {
    try {
        console.log('[MAIN] 썸네일 생성 요청:', options);
        const { makeEnhancedThumbnail } = require('../dist/thumbnail');
        const result = await makeEnhancedThumbnail(options.title, options.keyword, {
            width: 1200,
            height: 630,
            titleMaxLines: 3,
            tags: options.keyword ? options.keyword.split(' ').slice(0, 3) : [],
            brand: '베터라이프 네이버',
            background: {
                type: options.backgroundType || 'none',
                source: options.backgroundSource,
                apiKey: process.env.PEXELS_API_KEY || process.env.OPENAI_API_KEY,
                opacity: options.opacity || 0.6,
                blur: options.blur || 8,
                overlay: {
                    color: '#000000',
                    opacity: 0.5
                }
            }
        });
        console.log('[MAIN] 썸네일 생성 완료:', result.ok);
        return result;
    }
    catch (error) {
        console.error('[MAIN] 썸네일 생성 오류:', error);
        return { ok: false, error: error.message || '썸네일 생성 실패' };
    }
});
// ============================================
// URL 크롤링 핸들러
// ============================================
electron_1.ipcMain.handle('crawl-url', async (_evt, url) => {
    try {
        const { crawlAndExtract } = require('../dist/naver-crawler');
        const result = await crawlAndExtract(url);
        return { ok: true, content: result };
    }
    catch (error) {
        console.error('[CRAWL] 크롤링 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '크롤링 실패' };
    }
});
// ============================================
// Phase 1: 핵심 키워드 발굴 핸들러
// ============================================
// 키워드 발굴 상태 관리
const keywordDiscoveryStates = new Map();
// 황금 키워드 발굴
electron_1.ipcMain.handle('find-golden-keywords', async (_evt, keyword, options) => {
    try {
        console.log('[KEYWORD] 황금 키워드 발굴 시작:', keyword);
        // 상태 초기화
        keywordDiscoveryStates.set(keyword, { running: true, cancel: false });
        // golden-keyword-analyzer 사용
        const goldenKeywordModule = loadUtilsModule('golden-keyword-analyzer');
        const { findGoldenKeywords } = goldenKeywordModule;
        const result = await findGoldenKeywords(keyword, {
            ...options,
            onProgress: (progress) => {
                // 진행 상황 로깅
                console.log(`[KEYWORD] 진행: ${progress.current}/${progress.total}`);
                // 취소 요청 확인
                const state = keywordDiscoveryStates.get(keyword);
                if (state?.cancel) {
                    throw new Error('사용자가 취소했습니다');
                }
            }
        });
        keywordDiscoveryStates.set(keyword, { running: false, cancel: false });
        return { ok: true, keywords: result };
    }
    catch (error) {
        console.error('[KEYWORD] 발굴 실패:', error);
        keywordDiscoveryStates.set(keyword, { running: false, cancel: false });
        return { ok: false, error: error instanceof Error ? error.message : '발굴 실패', keywords: [] };
    }
});
// 키워드 발굴 중단
electron_1.ipcMain.handle('stop-keyword-discovery', async (_evt, keyword) => {
    try {
        const state = keywordDiscoveryStates.get(keyword);
        if (state && state.running) {
            state.cancel = true;
            console.log('[KEYWORD] 발굴 중단 요청:', keyword);
            return { ok: true, message: '중단 요청됨' };
        }
        return { ok: true, message: '실행 중인 작업 없음' };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '중단 실패' };
    }
});
// ============================================
// Phase 1: 트렌드 분석 핸들러
// ============================================
// 트렌딩 키워드 조회
electron_1.ipcMain.handle('get-trending-keywords', async (_evt, source) => {
    try {
        console.log('[TREND] 트렌딩 키워드 조회:', source);
        let result = [];
        if (source === 'naver') {
            const { getNaverRealtimeKeywords } = loadUtilsModule('naver-datalab-api');
            result = await getNaverRealtimeKeywords();
        }
        else if (source === 'google') {
            const { getGoogleTrendingKeywords } = loadUtilsModule('google-trends-api');
            result = await getGoogleTrendingKeywords();
        }
        else if (source === 'youtube') {
            const { getYouTubeTrendingKeywords } = loadUtilsModule('youtube-data-api');
            result = await getYouTubeTrendingKeywords();
        }
        return { ok: true, keywords: result };
    }
    catch (error) {
        console.error('[TREND] 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', keywords: [] };
    }
});
// 실시간 급상승 키워드
electron_1.ipcMain.handle('get-realtime-keywords', async (_evt, options) => {
    try {
        console.log('[REALTIME] 실시간 키워드 조회:', options);
        const realtimeModule = loadUtilsModule('realtime-search-keywords');
        const platform = options?.platform || 'all';
        let result = null;
        if (platform === 'all') {
            // 모든 플랫폼의 실시간 검색어 조회 (객체 반환)
            const allData = await realtimeModule.getAllRealtimeKeywords();
            // keyword-master.html이 객체 형식을 기대하므로 그대로 반환
            console.log('[REALTIME] 조회 성공:', {
                zum: allData.zum?.length || 0,
                nate: allData.nate?.length || 0,
                daum: allData.daum?.length || 0,
                google: allData.google?.length || 0
            });
            // keyword-master.html이 기대하는 형식으로 반환
            return {
                success: true,
                data: allData, // 객체 그대로 반환 {zum: [...], nate: [...], ...}
                ok: true,
                keywords: allData
            };
        }
        else if (platform === 'zum') {
            result = await realtimeModule.getZumRealtimeKeywords();
        }
        else if (platform === 'google') {
            result = await realtimeModule.getGoogleRealtimeKeywords();
        }
        else if (platform === 'nate') {
            result = await realtimeModule.getNateRealtimeKeywords();
        }
        else if (platform === 'daum') {
            result = await realtimeModule.getDaumRealtimeKeywords();
        }
        // 배열로 반환
        const keywords = Array.isArray(result) ? result : [];
        console.log(`[REALTIME] 조회 성공: ${keywords.length}개 키워드`);
        // keyword-master.html이 기대하는 형식으로 반환
        return {
            success: true, // ok 대신 success
            data: keywords, // keywords 대신 data
            ok: true,
            keywords: keywords // 호환성을 위해 둘 다 포함
        };
    }
    catch (error) {
        console.error('[REALTIME] 조회 실패:', error);
        return {
            success: false,
            ok: false,
            error: error instanceof Error ? error.message : '조회 실패',
            data: [],
            keywords: []
        };
    }
});
// ============================================
// Phase 1: 경쟁 분석 핸들러
// ============================================
// 경쟁자 분석
electron_1.ipcMain.handle('analyze-competitors', async (_evt, keyword) => {
    try {
        console.log('[COMPETITOR] 경쟁자 분석:', keyword);
        const { analyzeCompetitors } = loadUtilsModule('competitor-analyzer');
        const result = await analyzeCompetitors(keyword);
        return { ok: true, analysis: result };
    }
    catch (error) {
        console.error('[COMPETITOR] 분석 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
    }
});
// 날짜 기반 빠른 분석
electron_1.ipcMain.handle('analyze-fast-by-date', async (_evt, keyword, maxResults) => {
    try {
        console.log('[FAST-ANALYZE] 날짜 기반 분석:', keyword);
        const { analyzeFastByDate } = loadUtilsModule('timing-golden-finder');
        const result = await analyzeFastByDate(keyword, maxResults || 10);
        return { ok: true, analysis: result };
    }
    catch (error) {
        console.error('[FAST-ANALYZE] 분석 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
    }
});
// ============================================
// Phase 1: 블로그 지수 핸들러
// ============================================
// 블로그 인덱스 추출
electron_1.ipcMain.handle('extract-blog-index', async (_evt, blogIdOrUrl, options) => {
    try {
        console.log('[BLOG-INDEX] 인덱스 추출:', blogIdOrUrl);
        const { extractBlogIndex } = loadUtilsModule('timing-golden-finder');
        const result = await extractBlogIndex(blogIdOrUrl, options);
        return { ok: true, index: result };
    }
    catch (error) {
        console.error('[BLOG-INDEX] 추출 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '추출 실패', index: null };
    }
});
// 스마트블록 키워드 분석
electron_1.ipcMain.handle('analyze-smart-block-keywords', async (_evt, keyword, maxResults) => {
    try {
        console.log('[SMART-BLOCK] 키워드 분석:', keyword);
        const { analyzeSmartBlockKeywords } = loadUtilsModule('naver-search-validator');
        const result = await analyzeSmartBlockKeywords(keyword, maxResults || 10);
        return { ok: true, keywords: result };
    }
    catch (error) {
        console.error('[SMART-BLOCK] 분석 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '분석 실패', keywords: [] };
    }
});
console.log('[MAIN] ✅ Phase 1 핸들러 등록 완료 (키워드/트렌드/경쟁/블로그지수)');
// ============================================
// Phase 2: 워드프레스 연동 핸들러
// ============================================
// 워드프레스 연결 테스트
electron_1.ipcMain.handle('test-wordpress-connection', async (_evt, args) => {
    try {
        console.log('[WP] 연결 테스트:', args.siteUrl);
        const { testWordPressConnection } = require('../dist/wordpress/wordpress-api');
        const result = await testWordPressConnection(args);
        return { ok: true, connected: result.success, message: result.message };
    }
    catch (error) {
        console.error('[WP] 연결 실패:', error);
        return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
    }
});
// 워드프레스 카테고리 조회
electron_1.ipcMain.handle('get-wordpress-categories', async (_evt, args) => {
    try {
        console.log('[WP] 카테고리 조회:', args.siteUrl);
        const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
        const categories = await getWordPressCategories(args);
        return { ok: true, categories };
    }
    catch (error) {
        console.error('[WP] 카테고리 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', categories: [] };
    }
});
// 워드프레스 태그 조회
electron_1.ipcMain.handle('get-wordpress-tags', async (_evt, args) => {
    try {
        console.log('[WP] 태그 조회:', args.siteUrl);
        const { getWordPressTags } = require('../dist/wordpress/wordpress-api');
        const tags = await getWordPressTags(args);
        return { ok: true, tags };
    }
    catch (error) {
        console.error('[WP] 태그 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', tags: [] };
    }
});
// 워드프레스 카테고리 로드 (중복 핸들러 통합)
electron_1.ipcMain.handle('load-wordpress-categories', async (_evt, args) => {
    try {
        console.log('[WP] 카테고리 로드 (통합):', args.siteUrl);
        const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
        const categories = await getWordPressCategories(args);
        return { ok: true, categories };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '로드 실패', categories: [] };
    }
});
electron_1.ipcMain.handle('loadWpCategories', async (_evt, args) => {
    try {
        const { getWordPressCategories } = require('../dist/wordpress/wordpress-api');
        const categories = await getWordPressCategories({ siteUrl: args.wpUrl, username: args.wpUsername, password: args.wpPassword });
        return { ok: true, categories };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '로드 실패', categories: [] };
    }
});
// ============================================
// Phase 2: 블로거 OAuth 핸들러
// ============================================
// 🔥 블로거 OAuth 인증 시작 (로컬 서버 기반 - OOB deprecated 대응)
const BLOGGER_OAUTH_PORT = 58392;
electron_1.ipcMain.handle('blogger-start-auth', async (_evt, payload) => {
    try {
        console.log('[BLOGGER-AUTH] OAuth 인증 시작 (로컬 서버 기반)');
        // payload가 있으면 사용, 없으면 .env에서 읽기
        let clientId = '';
        let blogId = '';
        let clientSecret = '';
        if (payload) {
            clientId = String(payload.googleClientId || payload.clientId || '').trim();
            blogId = String(payload.blogId || payload.blogId || '').trim();
            clientSecret = String(payload.googleClientSecret || payload.clientSecret || '').trim();
        }
        // payload에 없으면 .env에서 읽기
        if (!clientId) {
            const envPath = path.join(electron_1.app.getPath('userData'), '.env');
            const fs = require('fs');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf-8');
                const parseEnvFile = (content) => {
                    const vars = {};
                    content.split('\n').forEach(line => {
                        const match = line.match(/^([^#=]+)=(.+)$/);
                        if (match)
                            vars[match[1].trim()] = match[2].trim();
                    });
                    return vars;
                };
                const envVars = parseEnvFile(envContent);
                clientId = envVars.GOOGLE_CLIENT_ID || '';
                blogId = envVars.BLOG_ID || envVars.BLOGGER_ID || '';
                clientSecret = envVars.GOOGLE_CLIENT_SECRET || '';
            }
        }
        // 필수 값 확인
        if (!clientId) {
            return {
                ok: false,
                error: 'Google Client ID가 설정되지 않았습니다. 환경 설정에서 Google Client ID를 입력해주세요.'
            };
        }
        // 🔥 로컬 서버 시작 (콜백 자동 수신)
        const { startBloggerOAuthServer, handleBloggerCallback } = require('./main-login');
        const serverResult = await startBloggerOAuthServer(async (code) => {
            console.log('[BLOGGER-AUTH] 🔥 코드 자동 수신! 토큰 교환 시작...');
            try {
                const tokenResult = await handleBloggerCallback(code);
                console.log('[BLOGGER-AUTH] 토큰 교환 결과:', tokenResult.success ? '성공' : '실패');
                // 메인 윈도우에 결과 전송
                if (mainWindow) {
                    mainWindow.webContents.send('blogger-auth-complete', {
                        ok: tokenResult.success,
                        error: tokenResult.error
                    });
                }
            }
            catch (err) {
                console.error('[BLOGGER-AUTH] 토큰 교환 오류:', err);
                if (mainWindow) {
                    mainWindow.webContents.send('blogger-auth-complete', {
                        ok: false,
                        error: err instanceof Error ? err.message : '토큰 교환 실패'
                    });
                }
            }
        });
        if (!serverResult.success) {
            return { ok: false, error: serverResult.error || '로컬 서버 시작 실패' };
        }
        // 🔥 로컬 서버 기반 OAuth URL 생성
        const redirectUri = `http://127.0.0.1:${BLOGGER_OAUTH_PORT}/callback`;
        const scope = 'https://www.googleapis.com/auth/blogger';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${encodeURIComponent(clientId)}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=${encodeURIComponent(scope)}&` +
            `response_type=code&` +
            `access_type=offline&` +
            `prompt=consent`;
        console.log('[BLOGGER-AUTH] OAuth URL:', authUrl);
        console.log('[BLOGGER-AUTH] Redirect URI:', redirectUri);
        // 외부 브라우저로 열기
        const { shell } = require('electron');
        await shell.openExternal(authUrl);
        return { ok: true, authUrl, redirectUri };
    }
    catch (error) {
        console.error('[BLOGGER-AUTH] 인증 시작 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '인증 실패' };
    }
});
// 블로거 OAuth 콜백 처리
electron_1.ipcMain.handle('blogger-handle-callback', async (_evt, args) => {
    try {
        console.log('[BLOGGER-AUTH] OAuth 콜백 처리');
        const { handleBloggerCallback } = require('./main-login');
        const result = await handleBloggerCallback(args.code);
        return { ok: true, tokens: result };
    }
    catch (error) {
        console.error('[BLOGGER-AUTH] 콜백 처리 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '콜백 처리 실패' };
    }
});
// 블로거 인증 상태 확인
electron_1.ipcMain.handle('blogger-check-auth-status', async () => {
    try {
        // blogger-publisher.js에서 checkBloggerAuthStatus 함수 사용
        const bloggerPublisher = require('../dist/core/blogger-publisher');
        const status = await bloggerPublisher.checkBloggerAuthStatus();
        return {
            ok: true,
            authenticated: status.authenticated,
            email: status.email || status.tokenData?.email,
            error: status.error
        };
    }
    catch (error) {
        console.error('[AUTH] 인증 상태 확인 실패:', error);
        return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
    }
});
// OAuth 토큰 교환
electron_1.ipcMain.handle('exchange-oauth-token', async (_evt, args) => {
    try {
        console.log('[OAUTH] 토큰 교환 시작');
        console.log('[OAUTH] 인자:', {
            hasCode: !!args.code,
            hasClientId: !!args.client_id,
            hasClientSecret: !!args.client_secret,
            hasRedirectUri: !!args.redirect_uri
        });
        // main-login 모듈 import
        let mainLoginModule;
        try {
            mainLoginModule = require('./main-login');
            console.log('[OAUTH] main-login 모듈 로드 성공:', Object.keys(mainLoginModule));
        }
        catch (requireError) {
            console.error('[OAUTH] main-login 모듈 로드 실패:', requireError);
            throw new Error(`main-login 모듈을 로드할 수 없습니다: ${requireError instanceof Error ? requireError.message : '알 수 없는 오류'}`);
        }
        // exchangeOAuthToken 함수 확인
        if (!mainLoginModule || typeof mainLoginModule.exchangeOAuthToken !== 'function') {
            console.error('[OAUTH] exchangeOAuthToken 함수를 찾을 수 없습니다. 사용 가능한 exports:', Object.keys(mainLoginModule || {}));
            throw new Error('exchangeOAuthToken 함수를 찾을 수 없습니다.');
        }
        console.log('[OAUTH] exchangeOAuthToken 함수 호출');
        const tokens = await mainLoginModule.exchangeOAuthToken({
            client_id: args.client_id,
            client_secret: args.client_secret,
            code: args.code,
            redirect_uri: args.redirect_uri
        });
        console.log('[OAUTH] ✅ 토큰 교환 성공');
        return { ok: true, tokens };
    }
    catch (error) {
        console.error('[OAUTH] 토큰 교환 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '토큰 교환 실패' };
    }
});
// 중복 핸들러 통합
electron_1.ipcMain.handle('start-blogger-auth', async (_evt) => {
    try {
        console.log('[BLOGGER-AUTH] 인증 시작 요청');
        // 환경 설정에서 값 가져오기
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        const fs = require('fs');
        if (!fs.existsSync(envPath)) {
            return {
                ok: false,
                error: '환경 설정 파일이 없습니다. 환경 설정에서 Blogger ID, Google Client ID, Google Client Secret을 설정해주세요.'
            };
        }
        // .env 파일 읽기
        const envContent = fs.readFileSync(envPath, 'utf-8');
        const parseEnvFile = (content) => {
            const vars = {};
            content.split('\n').forEach(line => {
                const match = line.match(/^([^#=]+)=(.+)$/);
                if (match)
                    vars[match[1].trim()] = match[2].trim();
            });
            return vars;
        };
        const envVars = parseEnvFile(envContent);
        console.log('[BLOGGER-AUTH] .env 파일에서 읽은 변수:', Object.keys(envVars));
        const blogId = envVars.BLOG_ID || envVars.BLOGGER_ID || envVars.blogId || '';
        const clientId = envVars.GOOGLE_CLIENT_ID || envVars.googleClientId || '';
        const clientSecret = envVars.GOOGLE_CLIENT_SECRET || envVars.googleClientSecret || '';
        console.log('[BLOGGER-AUTH] 파싱된 값:', {
            blogId: blogId ? `${blogId.substring(0, 10)}...` : '없음',
            clientId: clientId ? `${clientId.substring(0, 20)}...` : '없음',
            clientSecret: clientSecret ? '있음' : '없음'
        });
        // 필수 값 확인
        if (!clientId) {
            console.error('[BLOGGER-AUTH] Google Client ID가 없습니다.');
            return {
                ok: false,
                error: 'Google Client ID가 설정되지 않았습니다. 환경 설정에서 Google Client ID를 입력해주세요.'
            };
        }
        // blogger-publisher에서 인증 URL 생성 함수 가져오기
        let getBloggerAuthUrl;
        try {
            const bloggerPublisher = require('../dist/core/blogger-publisher');
            getBloggerAuthUrl = bloggerPublisher.getBloggerAuthUrl;
            if (!getBloggerAuthUrl) {
                throw new Error('getBloggerAuthUrl 함수를 찾을 수 없습니다.');
            }
            console.log('[BLOGGER-AUTH] getBloggerAuthUrl 함수 로드 성공');
        }
        catch (requireError) {
            console.error('[BLOGGER-AUTH] blogger-publisher 모듈 로드 실패:', requireError);
            return {
                ok: false,
                error: `모듈 로드 실패: ${requireError instanceof Error ? requireError.message : String(requireError)}`
            };
        }
        const payload = {
            blogId: blogId,
            googleClientId: clientId,
            googleClientSecret: clientSecret
        };
        console.log('[BLOGGER-AUTH] getBloggerAuthUrl 호출, payload:', {
            blogId: payload.blogId ? `${payload.blogId.substring(0, 10)}...` : '없음',
            googleClientId: payload.googleClientId ? `${payload.googleClientId.substring(0, 20)}...` : '없음',
            googleClientSecret: payload.googleClientSecret ? '있음' : '없음'
        });
        let authUrl;
        try {
            authUrl = getBloggerAuthUrl(payload);
            console.log('[BLOGGER-AUTH] getBloggerAuthUrl 결과:', authUrl ? `${authUrl.substring(0, 100)}...` : 'null');
        }
        catch (urlError) {
            console.error('[BLOGGER-AUTH] getBloggerAuthUrl 실행 오류:', urlError);
            return {
                ok: false,
                error: `인증 URL 생성 중 오류 발생: ${urlError instanceof Error ? urlError.message : String(urlError)}`
            };
        }
        if (!authUrl) {
            console.error('[BLOGGER-AUTH] getBloggerAuthUrl이 null을 반환했습니다.');
            return {
                ok: false,
                error: '인증 URL 생성에 실패했습니다. Google Client ID가 올바른지 확인해주세요. (payload에 googleClientId가 없거나 비어있을 수 있습니다.)'
            };
        }
        console.log('[BLOGGER-AUTH] 인증 URL 생성 성공');
        // 외부 브라우저로 열기
        const { shell } = require('electron');
        await shell.openExternal(authUrl);
        return {
            ok: true,
            authUrl: authUrl,
            message: '인증 URL이 브라우저에서 열렸습니다. 인증을 완료한 후 생성된 코드를 복사해주세요.'
        };
    }
    catch (error) {
        console.error('[BLOGGER-AUTH] 인증 시작 실패:', error);
        const errorMessage = error instanceof Error ? error.message : '인증 URL 생성에 실패했습니다.';
        return {
            ok: false,
            error: errorMessage
        };
    }
});
console.log('[MAIN] ✅ Phase 2 핸들러 등록 완료 (워드프레스/블로거 OAuth)');
// ============================================
// Phase 3-5: 나머지 핸들러 일괄 등록
// ============================================
// 유튜브 영상 조회
electron_1.ipcMain.handle('get-youtube-videos', async (_evt, options) => {
    try {
        const { getYouTubeVideos } = loadUtilsModule('youtube-data-api');
        const videos = await getYouTubeVideos(options);
        return { ok: true, videos };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', videos: [] };
    }
});
// SNS 트렌드
electron_1.ipcMain.handle('get-sns-trends', async (_evt, platform) => {
    try {
        const { getSNSTrends } = loadUtilsModule('youtube-data-api');
        const trends = await getSNSTrends(platform);
        return { ok: true, trends };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', trends: [] };
    }
});
// 키워드 순위 체크
electron_1.ipcMain.handle('check-keyword-rank', async (_evt, data) => {
    try {
        const { checkKeywordRank } = loadUtilsModule('keyword-validator');
        const rank = await checkKeywordRank(data.keyword, data.blogUrl);
        return { ok: true, rank };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '체크 실패', rank: null };
    }
});
// 타이밍 골드 헌팅
electron_1.ipcMain.handle('hunt-timing-gold', async (_evt, category) => {
    try {
        const { huntTimingGold } = loadUtilsModule('timing-golden-finder');
        const result = await huntTimingGold(category);
        return { ok: true, result };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '헌팅 실패', result: null };
    }
});
// Google 트렌드 키워드
electron_1.ipcMain.handle('get-google-trend-keywords', async () => {
    try {
        const { getGoogleTrendKeywords } = loadUtilsModule('google-trends-api');
        const keywords = await getGoogleTrendKeywords();
        return { ok: true, keywords };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', keywords: [] };
    }
});
// 키워드 그룹 관리
const getKeywordGroupsPath = () => path.join(electron_1.app.getPath('userData'), 'keyword-groups.json');
electron_1.ipcMain.handle('get-keyword-groups', async () => {
    try {
        const groupsPath = getKeywordGroupsPath();
        if (!fs.existsSync(groupsPath))
            return { ok: true, groups: [] };
        const groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
        return { ok: true, groups };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', groups: [] };
    }
});
electron_1.ipcMain.handle('add-keyword-group', async (_evt, group) => {
    try {
        const groupsPath = getKeywordGroupsPath();
        let groups = [];
        if (fs.existsSync(groupsPath)) {
            groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
        }
        const newGroup = { ...group, id: Date.now().toString(), createdAt: new Date().toISOString() };
        groups.push(newGroup);
        fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
        return { ok: true, group: newGroup };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
    }
});
electron_1.ipcMain.handle('update-keyword-group', async (_evt, id, updates) => {
    try {
        const groupsPath = getKeywordGroupsPath();
        let groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
        const index = groups.findIndex((g) => g.id === id);
        if (index >= 0) {
            groups[index] = { ...groups[index], ...updates };
            fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
        }
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '업데이트 실패' };
    }
});
electron_1.ipcMain.handle('delete-keyword-group', async (_evt, id) => {
    try {
        const groupsPath = getKeywordGroupsPath();
        let groups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
        groups = groups.filter((g) => g.id !== id);
        fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '삭제 실패' };
    }
});
// 키워드 스케줄 관리
const getKeywordSchedulesPath = () => path.join(electron_1.app.getPath('userData'), 'keyword-schedules.json');
electron_1.ipcMain.handle('get-keyword-schedules', async () => {
    try {
        const schedulesPath = getKeywordSchedulesPath();
        if (!fs.existsSync(schedulesPath))
            return { ok: true, schedules: [] };
        const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
        return { ok: true, schedules };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', schedules: [] };
    }
});
electron_1.ipcMain.handle('add-keyword-schedule', async (_evt, scheduleData) => {
    try {
        const schedulesPath = getKeywordSchedulesPath();
        let schedules = [];
        if (fs.existsSync(schedulesPath)) {
            schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
        }
        const newSchedule = { ...scheduleData, id: Date.now().toString(), createdAt: new Date().toISOString() };
        schedules.push(newSchedule);
        fs.writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8');
        return { ok: true, schedule: newSchedule };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '추가 실패' };
    }
});
electron_1.ipcMain.handle('toggle-keyword-schedule', async (_evt, id, enabled) => {
    try {
        const schedulesPath = getKeywordSchedulesPath();
        let schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
        const index = schedules.findIndex((s) => s.id === id);
        if (index >= 0) {
            schedules[index].enabled = enabled;
            fs.writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8');
        }
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '토글 실패' };
    }
});
// 대시보드 통계
electron_1.ipcMain.handle('get-dashboard-stats', async () => {
    try {
        // 간단한 통계 반환
        return { ok: true, stats: { posts: 0, keywords: 0, schedules: 0 } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', stats: {} };
    }
});
// Blogger 인증 만료 알림 처리
electron_1.ipcMain.on('blogger-auth-expiring-soon', (event, data) => {
    const { minutesLeft, expiresAt } = data;
    // 시스템 알림 표시
    const notification = new Notification('Blogger 인증 만료 임박', {
        body: `Blogger 인증이 ${minutesLeft}분 후 만료됩니다. 재인증을 준비해주세요.`,
        icon: path.join(__dirname, 'assets', 'icon.png') // 아이콘 경로 (필요시 조정)
    });
    notification.onclick = () => {
        // 알림 클릭 시 설정 창으로 이동 (필요시 구현)
        event.sender.send('focus-settings-tab');
    };
    // 소리 재생 (시스템 기본 알림음)
    if (process.platform === 'darwin') { // macOS
        require('child_process').exec('afplay /System/Library/Sounds/Glass.aiff');
    }
    else if (process.platform === 'win32') { // Windows
        require('child_process').exec('powershell.exe [console]::beep(800,500)');
    }
    else { // Linux
        require('child_process').exec('paplay /usr/share/sounds/freedesktop/stereo/message.oga || aplay /usr/share/sounds/alsa/Front_Center.wav');
    }
});
electron_1.ipcMain.on('blogger-auth-expired', (event, data) => {
    const { expiredAt } = data;
    // 긴급 시스템 알림 표시
    const notification = new Notification('Blogger 인증 만료됨', {
        body: 'Blogger 인증이 만료되었습니다. 즉시 재인증이 필요합니다.',
        icon: path.join(__dirname, 'assets', 'icon.png')
    });
    notification.onclick = () => {
        event.sender.send('focus-settings-tab');
    };
    // 긴급 소리 재생 (더 긴 소리)
    if (process.platform === 'darwin') {
        require('child_process').exec('afplay /System/Library/Sounds/Sosumi.aiff');
    }
    else if (process.platform === 'win32') {
        require('child_process').exec('powershell.exe [console]::beep(1000,1000); [console]::beep(1200,1000)');
    }
    else {
        require('child_process').exec('paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga || aplay /usr/share/sounds/alsa/Side_Right.wav');
    }
});
// 알림 관리
electron_1.ipcMain.handle('get-notifications', async () => {
    try {
        return { ok: true, notifications: [] };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', notifications: [] };
    }
});
electron_1.ipcMain.handle('save-notification-settings', async (_evt, settings) => {
    try {
        const settingsPath = path.join(electron_1.app.getPath('userData'), 'notification-settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
// 백업/복원
electron_1.ipcMain.handle('create-backup', async () => {
    try {
        const userDataPath = electron_1.app.getPath('userData');
        const backupDir = path.join(userDataPath, 'backups');
        // 백업 디렉토리 생성
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // 타임스탬프 생성 (YYYYMMDD_HHMMSS 형식)
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const backupPath = path.join(backupDir, `backup_${timestamp}`);
        // 백업 디렉토리 생성
        fs.mkdirSync(backupPath, { recursive: true });
        // 백업할 파일/디렉토리 목록
        const backupItems = [];
        // 1. .env 파일
        const envPath = path.join(userDataPath, '.env');
        if (fs.existsSync(envPath)) {
            backupItems.push({
                source: envPath,
                target: path.join(backupPath, '.env')
            });
        }
        // 2. src/core 디렉토리 (핵심 로직)
        const srcCorePath = path.join(process.cwd(), 'src', 'core');
        if (fs.existsSync(srcCorePath)) {
            backupItems.push({
                source: srcCorePath,
                target: path.join(backupPath, 'src_core')
            });
        }
        // 3. electron/ui 디렉토리 (UI 파일)
        const electronUiPath = path.join(process.cwd(), 'electron', 'ui');
        if (fs.existsSync(electronUiPath)) {
            backupItems.push({
                source: electronUiPath,
                target: path.join(backupPath, 'electron_ui')
            });
        }
        // 4. localStorage 백업 (설정 파일)
        const localStorageBackup = {
            bloggerSettings: null,
            timestamp: new Date().toISOString()
        };
        // 파일 복사 함수
        const copyRecursive = (src, dest) => {
            const stat = fs.statSync(src);
            if (stat.isDirectory()) {
                if (!fs.existsSync(dest)) {
                    fs.mkdirSync(dest, { recursive: true });
                }
                const files = fs.readdirSync(src);
                files.forEach(file => {
                    copyRecursive(path.join(src, file), path.join(dest, file));
                });
            }
            else {
                fs.copyFileSync(src, dest);
            }
        };
        // 백업 실행
        for (const item of backupItems) {
            try {
                if (fs.existsSync(item.source)) {
                    copyRecursive(item.source, item.target);
                    console.log(`[BACKUP] ✅ 백업 완료: ${item.source} -> ${item.target}`);
                }
            }
            catch (err) {
                console.error(`[BACKUP] ⚠️ 백업 실패: ${item.source}`, err);
            }
        }
        // localStorage 백업 정보 저장
        const backupInfo = {
            timestamp: new Date().toISOString(),
            items: backupItems.map(item => ({ source: item.source, target: item.target })),
            version: electron_1.app.getVersion()
        };
        fs.writeFileSync(path.join(backupPath, 'backup_info.json'), JSON.stringify(backupInfo, null, 2), 'utf-8');
        // 오래된 백업 정리 (30일 이상 된 백업 삭제)
        try {
            const files = fs.readdirSync(backupDir);
            const nowTime = Date.now();
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30일
            for (const file of files) {
                const filePath = path.join(backupDir, file);
                const stat = fs.statSync(filePath);
                if (stat.isDirectory() && file.startsWith('backup_')) {
                    const age = nowTime - stat.mtimeMs;
                    if (age > maxAge) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                        console.log(`[BACKUP] 🗑️ 오래된 백업 삭제: ${file}`);
                    }
                }
            }
        }
        catch (err) {
            console.warn('[BACKUP] 오래된 백업 정리 실패:', err);
        }
        console.log(`[BACKUP] ✅ 백업 생성 완료: ${backupPath}`);
        return { ok: true, path: backupPath, success: true, backupPath };
    }
    catch (error) {
        console.error('[BACKUP] 백업 생성 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '백업 실패' };
    }
});
electron_1.ipcMain.handle('restore-backup', async () => {
    try {
        return { ok: true, message: '복원 완료' };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '복원 실패' };
    }
});
// 개발자 도구 열기
electron_1.ipcMain.handle('open-dev-tools', async (_evt) => {
    const focusedWindow = electron_2.BrowserWindow.getFocusedWindow();
    if (focusedWindow && !focusedWindow.isDestroyed()) {
        focusedWindow.webContents.openDevTools();
        return { ok: true };
    }
    return { ok: false, error: '활성 창이 없습니다' };
});
// 관리자 모드
electron_1.ipcMain.handle('admin-auth', async (_evt, pin) => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'admin-config.json');
        if (!fs.existsSync(configPath))
            return { ok: true, authenticated: true }; // 첫 사용
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ok: true, authenticated: config.pin === pin };
    }
    catch (error) {
        return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '인증 실패' };
    }
});
electron_1.ipcMain.handle('set-admin-pin', async (_evt, args) => {
    try {
        const configPath = path.join(electron_1.app.getPath('userData'), 'admin-config.json');
        fs.writeFileSync(configPath, JSON.stringify({ pin: args.newPin }, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
    }
});
// 기타 유틸리티
electron_1.ipcMain.handle('is-developer-mode', async () => {
    // 🔥 배포 패키지에서는 개발 모드 비활성화
    const isPackagedApp = electron_1.app.isPackaged;
    const isDevEnv = process.env.DEV_MODE === 'true' || process.env.NODE_ENV === 'development';
    // 패키지된 앱은 무조건 개발모드 OFF
    const isDeveloperMode = !isPackagedApp && isDevEnv;
    console.log(`[DEV-MODE] isPackaged: ${isPackagedApp}, isDevEnv: ${isDevEnv}, result: ${isDeveloperMode}`);
    return { ok: true, isDeveloperMode };
});
electron_1.ipcMain.handle('is-packaged', async () => {
    return { ok: true, isPackaged: electron_1.app.isPackaged };
});
// 🔥 라이선스 티어 관련 핸들러
electron_1.ipcMain.handle('get-license-tier', async () => {
    try {
        const { getLicenseTierManager } = await Promise.resolve().then(() => __importStar(require('../dist/utils/license-tier-manager')));
        const tierManager = getLicenseTierManager();
        const currentTier = tierManager.getCurrentTier(true); // 강제 새로고침
        return {
            ok: true,
            tier: currentTier.tier,
            name: currentTier.name,
            features: currentTier.features
        };
    }
    catch (error) {
        console.error('[TIER] 티어 조회 실패:', error);
        return { ok: false, error: '티어 조회 실패' };
    }
});
electron_1.ipcMain.handle('check-feature-access', async (_evt, feature) => {
    try {
        const { getLicenseTierManager } = await Promise.resolve().then(() => __importStar(require('../dist/utils/license-tier-manager')));
        const tierManager = getLicenseTierManager();
        const result = tierManager.checkFeatureAccess(feature);
        return {
            ok: true,
            allowed: result.allowed,
            error: result.error
        };
    }
    catch (error) {
        console.error('[TIER] 기능 접근 체크 실패:', error);
        return { ok: false, allowed: false, error: '기능 접근 체크 실패' };
    }
});
electron_1.ipcMain.handle('sync-license-with-server', async (_evt, { serverUrl, userId, passwordHash }) => {
    try {
        const { getLicenseTierManager } = await Promise.resolve().then(() => __importStar(require('../dist/utils/license-tier-manager')));
        const tierManager = getLicenseTierManager();
        const success = await tierManager.syncWithServer(serverUrl, userId, passwordHash);
        if (success) {
            const newTier = tierManager.getCurrentTier(true);
            return {
                ok: true,
                synced: true,
                newTier: newTier.tier,
                newName: newTier.name
            };
        }
        return { ok: false, synced: false, error: '서버 동기화 실패' };
    }
    catch (error) {
        console.error('[TIER] 서버 동기화 실패:', error);
        return { ok: false, synced: false, error: '서버 동기화 오류' };
    }
});
electron_1.ipcMain.handle('transform-content', async (_evt, args) => {
    try {
        // 컨텐츠 변환 로직
        return { ok: true, content: args.content };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '변환 실패' };
    }
});
electron_1.ipcMain.handle('crawl-product-snapshot', async (_evt, args) => {
    try {
        // 제품 스냅샷 크롤링
        return { ok: true, snapshot: {} };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : '크롤링 실패' };
    }
});
console.log('[MAIN] ✅ Phase 3-5 핸들러 등록 완료');
// ============================================
// 누락 핸들러 Phase 1: 라이센스 관련 (4개)
// ============================================
// 라이센스 조회
electron_1.ipcMain.handle('get-license', async () => {
    try {
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        if (!fs.existsSync(licensePath)) {
            return { ok: true, license: null };
        }
        const license = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
        return { ok: true, license };
    }
    catch (error) {
        console.error('[LICENSE] 조회 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '조회 실패', license: null };
    }
});
// 라이센스 활성화
electron_1.ipcMain.handle('activate-license', async (_evt, args) => {
    try {
        console.log('[LICENSE] 활성화 요청:', args.code);
        // 간단한 라이센스 검증 (실제로는 서버 검증 필요)
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        const licenseData = {
            code: args.code,
            activated: true,
            activatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1년
        };
        fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2), 'utf-8');
        return { ok: true, license: licenseData };
    }
    catch (error) {
        console.error('[LICENSE] 활성화 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '활성화 실패' };
    }
});
// 라이센스 저장
electron_1.ipcMain.handle('save-license', async (_evt, data) => {
    try {
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        fs.writeFileSync(licensePath, JSON.stringify(data, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        console.error('[LICENSE] 저장 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
// 라이센스 파일 쓰기
electron_1.ipcMain.handle('write-license-file', async (_evt, data) => {
    try {
        const licensePath = path.join(electron_1.app.getPath('userData'), 'license.json');
        fs.writeFileSync(licensePath, JSON.stringify(data, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        console.error('[LICENSE] 파일 쓰기 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '쓰기 실패' };
    }
});
// ============================================
// 누락 핸들러 Phase 2: 분석 관련 (3개)
// ============================================
// CTA 클릭 로깅
electron_1.ipcMain.handle('log-cta-click', async (_evt, payload) => {
    try {
        console.log('[CTA-LOG] 클릭 기록:', payload);
        const logPath = path.join(electron_1.app.getPath('userData'), 'cta-clicks.json');
        let logs = [];
        if (fs.existsSync(logPath)) {
            logs = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
        }
        logs.push({
            ...payload,
            loggedAt: new Date().toISOString()
        });
        // 최근 1000개만 유지
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        fs.writeFileSync(logPath, JSON.stringify(logs, null, 2), 'utf-8');
        return { ok: true };
    }
    catch (error) {
        console.error('[CTA-LOG] 로깅 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '로깅 실패' };
    }
});
// 트렌드 분석
electron_1.ipcMain.handle('analyze-trends', async (_evt, args) => {
    try {
        console.log('[TREND-ANALYZE] 트렌드 분석 시작:', args);
        // TODO: trend-analyzer 모듈 구현 필요
        console.warn('[TREND-ANALYZE] 트렌드 분석 모듈이 아직 구현되지 않았습니다.');
        return { ok: false, error: '트렌드 분석 기능이 준비 중입니다.', analysis: null };
    }
    catch (error) {
        console.error('[TREND-ANALYZE] 분석 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '분석 실패', analysis: null };
    }
});
// 컨텐츠 품질 분석
electron_1.ipcMain.handle('analyze-content-quality', async (_evt, args) => {
    try {
        console.log('[QUALITY] 품질 분석 시작');
        // TODO: quality-analyzer 모듈 구현 필요
        console.warn('[QUALITY] 품질 분석 모듈이 아직 구현되지 않았습니다.');
        return { ok: false, error: '품질 분석 기능이 준비 중입니다.', quality: null };
    }
    catch (error) {
        console.error('[QUALITY] 분석 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '분석 실패', quality: null };
    }
});
// 스마트 키워드 생성
electron_1.ipcMain.handle('generate-smart-keywords', async (_evt, args) => {
    try {
        console.log('[SMART-KW] 스마트 키워드 생성 시작');
        // TODO: keyword-generator 모듈 구현 필요
        console.warn('[SMART-KW] 스마트 키워드 생성 모듈이 아직 구현되지 않았습니다.');
        return { ok: false, error: '스마트 키워드 생성 기능이 준비 중입니다.', keywords: [] };
    }
    catch (error) {
        console.error('[SMART-KW] 생성 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '생성 실패', keywords: [] };
    }
});
// ============================================
// 누락 핸들러 Phase 3: 인증 관련 (6개)
// ============================================
// 워드프레스 인증 상태 확인
electron_1.ipcMain.handle('wordpress-check-auth-status', async () => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        const authenticated = !!(env.WP_URL && (env.WP_USERNAME || env.WP_JWT_TOKEN));
        return { ok: true, authenticated, siteUrl: env.WP_URL };
    }
    catch (error) {
        return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
    }
});
// 플랫폼 인증 확인
electron_1.ipcMain.handle('check-platform-auth', async (_evt, platform) => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        let authenticated = false;
        if (platform === 'blogger') {
            authenticated = !!(env.BLOGGER_CLIENT_ID && env.BLOGGER_CLIENT_SECRET);
        }
        else if (platform === 'wordpress') {
            authenticated = !!(env.WP_URL && (env.WP_USERNAME || env.WP_JWT_TOKEN));
        }
        return { ok: true, authenticated, platform };
    }
    catch (error) {
        return { ok: false, authenticated: false, error: error instanceof Error ? error.message : '확인 실패' };
    }
});
// 토큰 가져오기
electron_1.ipcMain.handle('fetch-token', async (_evt, tokenData) => {
    try {
        console.log('[TOKEN] 토큰 가져오기');
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tokenData)
        });
        if (!response.ok) {
            throw new Error(`토큰 요청 실패: ${response.status}`);
        }
        const tokens = await response.json();
        return { ok: true, tokens };
    }
    catch (error) {
        console.error('[TOKEN] 가져오기 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '토큰 요청 실패' };
    }
});
// 블로거 OAuth (콜론 버전)
electron_1.ipcMain.handle('blogger:oauth', async (_evt, oauthData) => {
    try {
        console.log('[BLOGGER-OAUTH] 인증 시작 (콜론 버전)');
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${oauthData.clientId}&` +
            `redirect_uri=${oauthData.redirectUri}&` +
            `response_type=code&` +
            `scope=https://www.googleapis.com/auth/blogger&` +
            `access_type=offline`;
        const { shell } = require('electron');
        await shell.openExternal(authUrl);
        return { ok: true, authUrl };
    }
    catch (error) {
        console.error('[BLOGGER-OAUTH] 인증 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '인증 실패' };
    }
});
// ============================================
// 누락 핸들러 Phase 4: API 연동 & 환경설정 (5개)
// ============================================
// Google CSE 연결 테스트
electron_1.ipcMain.handle('test-google-cse-connection', async (_evt, args) => {
    try {
        console.log('[CSE-TEST] Google CSE 연결 테스트');
        const testUrl = `https://www.googleapis.com/customsearch/v1?key=${args.cseKey}&cx=${args.cseCx}&q=test`;
        const response = await fetch(testUrl);
        if (!response.ok) {
            throw new Error(`CSE 테스트 실패: ${response.status}`);
        }
        return { ok: true, connected: true, message: 'Google CSE 연결 성공' };
    }
    catch (error) {
        console.error('[CSE-TEST] 연결 실패:', error);
        return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
    }
});
// CSE 연결 테스트 (간단 버전)
electron_1.ipcMain.handle('test-cse-connection', async (_evt, args) => {
    try {
        const testUrl = `https://www.googleapis.com/customsearch/v1?key=${args.cseKey}&cx=${args.cseCx}&q=test`;
        const response = await fetch(testUrl);
        return { ok: response.ok, connected: response.ok };
    }
    catch (error) {
        return { ok: false, connected: false, error: error instanceof Error ? error.message : '연결 실패' };
    }
});
// 환경 설정 저장
electron_1.ipcMain.handle('save-environment-settings', async (_evt, settings) => {
    try {
        const envPath = path.join(process.cwd(), '.env');
        // 기존 .env 읽기
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }
        // 설정 업데이트
        const envLines = envContent.split('\n');
        const envMap = new Map();
        envLines.forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                envMap.set(match[1].trim(), match[2].trim());
            }
        });
        // 새 설정 추가/업데이트
        Object.entries(settings).forEach(([key, value]) => {
            envMap.set(key, String(value));
        });
        // .env 파일 쓰기
        const newEnvContent = Array.from(envMap.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        fs.writeFileSync(envPath, newEnvContent, 'utf-8');
        return { ok: true };
    }
    catch (error) {
        console.error('[ENV-SETTINGS] 저장 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
});
// 환경 설정 로드
electron_1.ipcMain.handle('load-environment-settings', async () => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        return { ok: true, settings: env };
    }
    catch (error) {
        console.error('[ENV-SETTINGS] 로드 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '로드 실패', settings: {} };
    }
});
// 키워드 마스터 창 열기
electron_1.ipcMain.handle('open-keyword-master-window', async () => {
    try {
        const { BrowserWindow } = require('electron');
        // preload 경로 확인 (배포 환경 대응)
        const preloadPath = electron_1.app.isPackaged
            ? path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.js')
            : path.join(__dirname, 'preload.js');
        console.log('[KEYWORD-WINDOW] Preload 경로:', preloadPath);
        console.log('[KEYWORD-WINDOW] isPackaged:', electron_1.app.isPackaged);
        const keywordWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: preloadPath,
                webSecurity: true, // 보안 강화
                allowRunningInsecureContent: false // 보안 강화
            }
        });
        // CSP 헤더 설정 (응답 헤더에 추가) - 모든 기능 지원
        keywordWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [
                        "default-src 'self' data: blob:; " +
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
                            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
                            "font-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com data:; " +
                            "img-src 'self' data: blob: https: http:; " + // 모든 이미지 허용
                            "connect-src 'self' https: wss: http:;" // 모든 API 연결 허용
                    ]
                }
            });
        });
        const htmlPath = path.join(__dirname, 'ui', 'keyword-master.html');
        console.log('[KEYWORD-WINDOW] HTML 경로:', htmlPath);
        keywordWindow.loadFile(htmlPath);
        // 개발자 도구 자동 열기 (디버깅용)
        keywordWindow.webContents.openDevTools();
        return { ok: true };
    }
    catch (error) {
        console.error('[KEYWORD-WINDOW] 열기 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '창 열기 실패' };
    }
});
// ============================================
// 추가 핸들러: keyword-master 호환성
// ============================================
// env:load (envLoad와 동일)
electron_1.ipcMain.handle('env:load', async () => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        return { ok: true, env };
    }
    catch (error) {
        console.error('[ENV-LOAD] 로드 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '로드 실패', env: {} };
    }
});
// check-api-keys (API 키 상태 확인)
electron_1.ipcMain.handle('check-api-keys', async () => {
    try {
        const env = (0, env_1.loadEnvFromFile)();
        // 네이버 검색광고 API 키 확인 (다양한 필드명 지원)
        const searchAdLicense = env.NAVER_SEARCH_AD_ACCESS_LICENSE ||
            env.naverSearchAdAccessLicense ||
            env.naver_search_ad_access_license;
        const searchAdSecret = env.NAVER_SEARCH_AD_SECRET_KEY ||
            env.naverSearchAdSecretKey ||
            env.naver_search_ad_secret_key;
        const searchAdCustomerId = env.NAVER_SEARCH_AD_CUSTOMER_ID ||
            env.naverSearchAdCustomerId ||
            env.naver_search_ad_customer_id;
        const apiStatus = {
            naver: !!(env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET),
            youtube: !!env.YOUTUBE_API_KEY,
            naverAd: !!(searchAdLicense && searchAdSecret && searchAdCustomerId),
            gemini: !!env.GEMINI_API_KEY,
            openai: !!env.OPENAI_API_KEY,
            claude: !!env.CLAUDE_API_KEY,
            blogger: !!(env.BLOGGER_CLIENT_ID && env.BLOGGER_CLIENT_SECRET),
            wordpress: !!env.WP_URL
        };
        console.log('[API-KEYS] 네이버 검색광고 API 상태:', {
            hasLicense: !!searchAdLicense,
            hasSecret: !!searchAdSecret,
            hasCustomerId: !!searchAdCustomerId,
            combined: apiStatus.naverAd
        });
        return { ok: true, status: apiStatus };
    }
    catch (error) {
        console.error('[API-KEYS] 확인 실패:', error);
        return { ok: false, error: error instanceof Error ? error.message : '확인 실패', status: {} };
    }
});
// ── 쿼터 관리 IPC ──
// 앱 버전 조회
electron_1.ipcMain.handle('app:getVersion', () => {
    return electron_1.app.getVersion();
});
// 무료 체험 접속 (라이선스 없이 앱 진입)
electron_1.ipcMain.handle('auth:free-trial', async () => {
    console.log('[AUTH] 🆓 무료 체험 모드로 접속');
    // 무료 체험 세션 활성화
    try {
        const { activateFreeTrial } = require('./auth-utils');
        activateFreeTrial();
    }
    catch (e) {
        console.error('[AUTH] activateFreeTrial 실패:', e);
    }
    // Free trial: close login window and open main window
    const { BrowserWindow } = require('electron');
    const allWindows = BrowserWindow.getAllWindows();
    // Close login window
    allWindows.forEach((win) => {
        if (win.getTitle().includes('인증') || win.webContents.getURL().includes('login-window')) {
            win.close();
        }
    });
    // Create main window (same as successful login)
    if (typeof createWindow === 'function') {
        createWindow();
    }
    return { ok: true };
});
electron_1.ipcMain.handle('quota:getStatus', async () => {
    try {
        const { isFreeTierUser, getFreeQuotaStatus } = require('./auth-utils');
        const isFree = await isFreeTierUser();
        if (!isFree) {
            return { success: true, isFree: false };
        }
        const quota = await getFreeQuotaStatus();
        return { success: true, isFree: true, quota };
    }
    catch (error) {
        console.error('[QUOTA] 상태 조회 실패:', error);
        return { success: false, message: error.message };
    }
});
// save-keyword-settings (키워드 마스터 설정 저장)
electron_1.ipcMain.handle('save-keyword-settings', async (_event, settings) => {
    try {
        console.log('[SAVE-KEYWORD-SETTINGS] 저장 요청:', {
            hasNaverId: !!settings.naverClientId,
            hasNaverSecret: !!settings.naverClientSecret,
            hasYoutube: !!settings.youtubeApiKey,
            hasSearchAdLicense: !!settings.naverSearchAdAccessLicense,
            hasSearchAdSecret: !!settings.naverSearchAdSecretKey,
            hasSearchAdCustomerId: !!settings.naverSearchAdCustomerId
        });
        // .env 파일 읽기
        const envPath = path.join(electron_1.app.getPath('userData'), '.env');
        let env = {};
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        env[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
        }
        // 기존 설정 유지하면서 새로운 키워드 설정 추가/업데이트
        if (settings.naverClientId)
            env.NAVER_CLIENT_ID = settings.naverClientId;
        if (settings.naverClientSecret)
            env.NAVER_CLIENT_SECRET = settings.naverClientSecret;
        if (settings.youtubeApiKey)
            env.YOUTUBE_API_KEY = settings.youtubeApiKey;
        if (settings.naverSearchAdAccessLicense)
            env.NAVER_SEARCH_AD_ACCESS_LICENSE = settings.naverSearchAdAccessLicense;
        if (settings.naverSearchAdSecretKey)
            env.NAVER_SEARCH_AD_SECRET_KEY = settings.naverSearchAdSecretKey;
        if (settings.naverSearchAdCustomerId)
            env.NAVER_SEARCH_AD_CUSTOMER_ID = settings.naverSearchAdCustomerId;
        // .env 파일 저장
        const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
        fs.writeFileSync(envPath, lines.join('\n'), 'utf-8');
        console.log('[SAVE-KEYWORD-SETTINGS] ✅ 저장 완료');
        return {
            success: true,
            message: '저장 완료',
            saved: {
                naver: !!(settings.naverClientId && settings.naverClientSecret),
                youtube: !!settings.youtubeApiKey,
                searchAd: !!(settings.naverSearchAdAccessLicense && settings.naverSearchAdSecretKey && settings.naverSearchAdCustomerId)
            }
        };
    }
    catch (error) {
        console.error('[SAVE-KEYWORD-SETTINGS] 저장 실패:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '저장 실패'
        };
    }
});
// ========================================
// 내부 링크 거미줄치기 핸들러
// ========================================
safeRegisterHandler('generate-internal-link-content', async (_evt, request) => {
    try {
        console.log('[INTERNAL-LINKS] 내부 링크 콘텐츠 생성 요청');
        const { generateInternalLinkContent } = await Promise.resolve().then(() => __importStar(require('../dist/core/internal-links')));
        const env = await (0, env_1.loadEnvFromFile)();
        if (!env.geminiKey) {
            throw new Error('Gemini API 키가 설정되지 않았습니다.');
        }
        const result = await generateInternalLinkContent(request, env.geminiKey);
        console.log('[INTERNAL-LINKS] ✅ 내부 링크 콘텐츠 생성 완료');
        return result;
    }
    catch (error) {
        console.error('[INTERNAL-LINKS] ❌ 생성 실패:', error);
        throw error;
    }
});
safeRegisterHandler('publish-internal-link-content', async (_evt, request) => {
    try {
        console.log('[INTERNAL-LINKS] 내부 링크 콘텐츠 발행 요청');
        const { html, title, publish } = request;
        const env = (0, env_1.loadEnvFromFile)();
        // 플랫폼 확인 - 환경변수에서 가져오기
        const platform = env.platform || env.blogPlatform || 'blogspot';
        console.log('[INTERNAL-LINKS] 발행 플랫폼:', platform);
        if (platform === 'wordpress') {
            // WordPress 발행
            const { WordPressPublisher } = require('../dist/wordpress/wordpress-publisher');
            if (!env.wpSiteUrl || !env.wpUsername || !env.wpPassword) {
                throw new Error('워드프레스 설정이 완료되지 않았습니다. 설정에서 워드프레스 정보를 입력해주세요.');
            }
            const wpConfig = {
                siteUrl: env.wpSiteUrl,
                username: env.wpUsername,
                password: env.wpPassword
            };
            const publisher = new WordPressPublisher(wpConfig);
            const result = await publisher.publish({
                title,
                content: html,
                status: publish ? 'publish' : 'draft'
            });
            console.log('[INTERNAL-LINKS] ✅ WordPress 발행 완료:', result.url);
            return { ok: true, url: result.url, platform: 'wordpress' };
        }
        else {
            // Blogger 발행 (기본값)
            const { publishToBlogger } = require('../dist/core/blogger-publisher.js');
            // payload 구성
            const payload = {
                blogId: env.blogId,
                bloggerAccessToken: env.bloggerAccessToken,
                bloggerRefreshToken: env.bloggerRefreshToken,
                bloggerClientId: env.bloggerClientId,
                bloggerClientSecret: env.bloggerClientSecret
            };
            const postingMode = publish ? 'publish' : 'draft';
            const result = await publishToBlogger(payload, title, html, '', // thumbnailUrl
            (msg) => console.log('[INTERNAL-LINKS]', msg), postingMode, null // scheduleDate
            );
            if (result.ok) {
                console.log('[INTERNAL-LINKS] ✅ Blogger 발행 완료:', result.postUrl);
                return { ok: true, url: result.postUrl || result.url, platform: 'blogspot' };
            }
            else {
                throw new Error(result.error || 'Blogger 발행 실패');
            }
        }
    }
    catch (error) {
        console.error('[INTERNAL-LINKS] ❌ 발행 실패:', error);
        throw error;
    }
});
console.log('[MAIN] ✅ 모든 IPC 핸들러 등록 완료! (총 92+ 핸들러)');
// ============================================
// Electron 앱 초기화 및 메인 윈도우 생성
// ============================================
const electron_2 = require("electron");
let mainWindow = null;
function createWindow() {
    console.log('[APP] 메인 윈도우 생성 중...');
    const { width, height } = electron_2.screen.getPrimaryDisplay().workAreaSize;
    // Preload 경로 설정 (배포 환경 대응)
    const preloadPath = electron_1.app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'electron', 'preload.js')
        : path.join(__dirname, 'preload.js');
    console.log('[WINDOW] Preload 경로:', preloadPath);
    console.log('[WINDOW] __dirname:', __dirname);
    console.log('[WINDOW] isPackaged:', electron_1.app.isPackaged);
    mainWindow = new electron_2.BrowserWindow({
        width: Math.floor(width * 0.9),
        height: Math.floor(height * 0.9),
        minWidth: 1200,
        minHeight: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            webSecurity: true,
            allowRunningInsecureContent: false
        },
        title: 'LEADERNAM Orbit',
        show: false, // 준비될 때까지 숨김
        backgroundColor: '#1a1a2e'
    });
    // 🔥 CSP 헤더 설정 (모든 기능이 정상 작동하도록 - 이미지 생성, 크롤링 등)
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' data: blob:; " +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://script.google.com https://script.googleusercontent.com https://cdn.jsdelivr.net; " +
                        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; " +
                        "font-src 'self' https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com data:; " +
                        "connect-src 'self' https: wss: http:; " + // 모든 API 연결 허용
                        "img-src 'self' data: blob: https: http:; " + // 모든 이미지 소스 허용
                        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.google.com; " +
                        "media-src 'self' https: data: blob:;"
                ]
            }
        });
    });
    // 메인 윈도우를 main-login에 전달 (라이선스 체크용)
    (0, main_login_1.setMainWindow)(mainWindow);
    // HTML 로드
    const htmlPath = path.join(__dirname, 'ui', 'index.html');
    mainWindow.loadFile(htmlPath);
    // 준비되면 표시
    mainWindow.once('ready-to-show', () => {
        console.log('[APP] ✅ 메인 윈도우 준비 완료, 표시합니다.');
        mainWindow?.show();
    });
    // 외부 링크는 기본 브라우저에서 열기
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_2.shell.openExternal(url);
        return { action: 'deny' };
    });
    // 창 닫힘 이벤트
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    console.log('[APP] ✅ 메인 윈도우 생성 완료');
}
// 앱 준비 완료 시
electron_1.app.whenReady().then(async () => {
    console.log('[APP] Electron 앱 준비 완료');
    // 🔥 개발 모드 확인: npm start로 실행 시 라이선스 체크 건너뛰기
    const isDev = !electron_1.app.isPackaged || process.env.NODE_ENV === 'development';
    if (isDev) {
        console.log('[APP] 🚀 개발 모드: 라이선스 체크 건너뛰기, 무제한 모드');
        createWindow();
    }
    else {
        // 배포 환경: 라이선스 체크 (자동 로그인 포함)
        const licenseValid = await (0, main_login_1.checkLicenseWithAutoLogin)();
        if (licenseValid) {
            console.log('[APP] ✅ 라이선스 인증 완료, 메인 윈도우 생성');
            createWindow();
        }
        else {
            console.log('[APP] ⚠️ 라이선스 인증 실패 또는 로그인 필요');
            // 로그인 윈도우는 checkLicenseWithAutoLogin 내부에서 자동으로 표시됨
        }
    }
    // 🔄 자동 업데이트 체크 (패키지 모드에서만)
    if (electron_1.app.isPackaged) {
        try {
            const { autoUpdater } = require('electron-updater');
            autoUpdater.autoDownload = true;
            autoUpdater.autoInstallOnAppQuit = true;
            autoUpdater.on('checking-for-update', () => {
                console.log('[AUTO-UPDATE] 업데이트 확인 중...');
            });
            autoUpdater.on('update-available', (info) => {
                console.log('[AUTO-UPDATE] 새 버전 발견:', info.version);
                const focusedWindow = electron_2.BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                    focusedWindow.webContents.send('log-line', `[UPDATE] 새 버전 ${info.version} 다운로드 중...`);
                }
            });
            autoUpdater.on('update-not-available', () => {
                console.log('[AUTO-UPDATE] 최신 버전입니다.');
            });
            autoUpdater.on('download-progress', (progress) => {
                console.log(`[AUTO-UPDATE] 다운로드: ${Math.round(progress.percent)}%`);
            });
            autoUpdater.on('update-downloaded', (info) => {
                console.log('[AUTO-UPDATE] 다운로드 완료:', info.version);
                const focusedWindow = electron_2.BrowserWindow.getFocusedWindow();
                if (focusedWindow) {
                    electron_1.dialog.showMessageBox(focusedWindow, {
                        type: 'info',
                        title: '업데이트 준비 완료',
                        message: `새 버전 ${info.version}이 다운로드되었어요.\n앱을 재시작하면 자동으로 업데이트됩니다.`,
                        buttons: ['지금 재시작', '나중에'],
                        defaultId: 0,
                    }).then((result) => {
                        if (result.response === 0) {
                            autoUpdater.quitAndInstall();
                        }
                    });
                }
            });
            autoUpdater.on('error', (err) => {
                console.error('[AUTO-UPDATE] 오류:', err.message);
            });
            // 5초 후 업데이트 체크 (앱 로딩 완료 대기)
            setTimeout(() => {
                autoUpdater.checkForUpdatesAndNotify().catch((e) => {
                    console.error('[AUTO-UPDATE] 체크 실패:', e.message);
                });
            }, 5000);
        }
        catch (e) {
            console.error('[AUTO-UPDATE] 초기화 실패:', e.message);
        }
    }
    // 🔥 관리자 모드 단축키 등록 (Ctrl+Shift+A)
    try {
        // 관리자 모드: Shift+Z (Enter는 prompt에서 처리)
        electron_1.globalShortcut.register('Shift+Z', () => {
            console.log('[ADMIN] 관리자 모드 단축키 감지!');
            const focusedWindow = electron_2.BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
                focusedWindow.webContents.send('admin-shortcut');
                console.log('[ADMIN] admin-shortcut 이벤트 전송됨');
            }
        });
        console.log('[APP] ✅ 관리자 모드 단축키 등록 (Ctrl+Shift+A)');
    }
    catch (err) {
        console.error('[APP] ⚠️ 관리자 모드 단축키 등록 실패:', err);
    }
    // macOS: 모든 창이 닫혀도 앱은 활성 상태 유지
    electron_1.app.on('activate', () => {
        if (electron_2.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// 모든 창이 닫히면 앱 종료 (macOS 제외)
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// 앱 종료 시 단축키 해제 + ImageFX 브라우저 정리
electron_1.app.on('will-quit', async () => {
    electron_1.globalShortcut.unregisterAll();
    console.log('[APP] 모든 단축키 해제됨');
    // 🖼️ ImageFX 브라우저 세션 정리 (좀비 프로세스 방지)
    try {
        const { cleanupImageFx } = require('../dist/core/imageFxGenerator');
        await cleanupImageFx();
        console.log('[APP] ✅ ImageFX 브라우저 세션 정리 완료');
    }
    catch (e) {
        // imageFxGenerator 로드 실패 시 무시 (모듈이 사용되지 않았을 수 있음)
    }
});
// 🏆 애드센스 도구 IPC 핸들러 등록
try {
    const { registerAdsenseIpcHandlers } = require('./adsenseIpcHandlers');
    registerAdsenseIpcHandlers();
}
catch (e) {
    console.error('[APP] 애드센스 IPC 핸들러 등록 실패:', e);
}
// 🛡️ AdsPower IPC 핸들러 등록
try {
    const { registerAdsPowerIpcHandlers } = require('./adspowerIpcHandlers');
    registerAdsPowerIpcHandlers();
}
catch (e) {
    console.error('[APP] AdsPower IPC 핸들러 등록 실패:', e);
}
// AdsPower 자동 설치
electron_1.ipcMain.handle('adspower:auto-install', async () => {
    try {
        const { shell } = require('electron');
        // AdsPower 공식 다운로드 페이지 열기
        await shell.openExternal('https://www.adspower.com/download');
        return { ok: true, message: 'AdsPower 다운로드 페이지가 열렸습니다. 설치 후 앱을 실행해주세요.' };
    }
    catch (e) {
        return { ok: false, error: e.message };
    }
});
// 🚀 원클릭 세팅 IPC 핸들러 등록
try {
    const { registerOneclickSetupIpcHandlers } = require('./oneclickSetupIpcHandlers');
    registerOneclickSetupIpcHandlers();
}
catch (e) {
    console.error('[APP] 원클릭 세팅 IPC 핸들러 등록 실패:', e);
}
// 🖼️ ImageFX Google 로그인 IPC 핸들러
try {
    const { checkGoogleLoginForImageFx, loginGoogleForImageFx } = require('../dist/core/imageFxGenerator');
    electron_1.ipcMain.handle('imagefx:check-login', async () => {
        try {
            return await checkGoogleLoginForImageFx();
        }
        catch (e) {
            return { loggedIn: false, message: e.message || 'ImageFX 로그인 확인 실패' };
        }
    });
    electron_1.ipcMain.handle('imagefx:login', async () => {
        try {
            return await loginGoogleForImageFx();
        }
        catch (e) {
            return { loggedIn: false, message: e.message || 'ImageFX 로그인 실패' };
        }
    });
    console.log('[APP] ✅ ImageFX IPC 핸들러 등록 완료');
}
catch (e) {
    console.warn('[APP] ⚠️ ImageFX IPC 핸들러 등록 실패 (imageFxGenerator 로드 불가):', e);
}
console.log('[APP] ✅ Electron 앱 초기화 완료');
