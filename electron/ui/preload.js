"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// electron/preload.ts
const electron_1 = require("electron");
/** ───────── 공통 유틸 ───────── */
function toNumberOrUndefined(v) {
    if (v === undefined || v === null || v === '')
        return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}
/** ───────── IPC 구현 ───────── */
const api = {
    openLink: (href) => electron_1.ipcRenderer.invoke('open-link', href),
    // 저장 시 minChars를 숫자로 보정해서 main으로 전달
    // (googleCseKey/googleCseCx 포함되어 그대로 전달됨)
    saveEnv: (env) => {
        const minChars = toNumberOrUndefined(env.minChars);
        return electron_1.ipcRenderer.invoke('save-env', { ...env, minChars });
    },
    getEnv: () => electron_1.ipcRenderer.invoke('get-env'),
    setSettingsProtection: (protectedMode) => electron_1.ipcRenderer.invoke('set-settings-protection', protectedMode),
    isSettingsProtected: () => electron_1.ipcRenderer.invoke('is-settings-protected'),
    validateEnv: () => electron_1.ipcRenderer.invoke('validate-env'),
    runPost: (p) => electron_1.ipcRenderer.invoke('run-post', p),
    // 🔥 반자동 완벽 끝판왕 추가
    runSemiAutoPost: (p) => {
        console.log('[PRELOAD] 🔥 runSemiAutoPost 호출');
        return electron_1.ipcRenderer.invoke('run-semi-auto-post', p).then(result => {
            console.log('[PRELOAD] ✅ 반자동 생성 완료');
            return result;
        }).catch((error) => {
            console.error('[PRELOAD] ❌ 반자동 오류:', error);
            return { ok: false, error: error.message };
        });
    },
    // 🖼️ 썸네일 생성
    generateThumbnail: (options) => {
        console.log('[PRELOAD] 썸네일 생성 요청');
        return electron_1.ipcRenderer.invoke('generate-thumbnail', options).then(result => {
            return result;
        }).catch((error) => {
            return { ok: false, error: error.message };
        });
    },
    onLog: (listener) => {
        const handler = (_e, line) => { try {
            listener(line);
        }
        catch { } };
        electron_1.ipcRenderer.on('log-line', handler);
        return () => electron_1.ipcRenderer.off('log-line', handler);
    },
    // 블로그스팟 인증 상태 확인
    checkBloggerAuthStatus: () => electron_1.ipcRenderer.invoke('blogger-check-auth-status'),
    // OAuth2 토큰 교환
    exchangeOAuthToken: (args) => electron_1.ipcRenderer.invoke('exchange-oauth-token', args),
    // 진행률(막대바) 구독
    onProgress: (listener) => {
        const handler = (_e, payload) => {
            try {
                listener(payload);
            }
            catch { }
        };
        electron_1.ipcRenderer.on('run-progress', handler);
        return () => electron_1.ipcRenderer.off('run-progress', handler);
    },
    // 작업 취소
    cancelTask: () => electron_1.ipcRenderer.send('cancel-task'),
    // 라이선스
    subscribeLicense: () => electron_1.ipcRenderer.send('license:subscribe'),
    getLicense: () => electron_1.ipcRenderer.invoke('get-license'),
    activateLicense: (args) => electron_1.ipcRenderer.invoke('activate-license', args),
    saveLicense: (data) => electron_1.ipcRenderer.invoke('save-license', data),
    onLicenseUpdated: (listener) => {
        const handler = (_e, d) => { try {
            listener(d);
        }
        catch { } };
        electron_1.ipcRenderer.on('license-updated', handler);
        return () => electron_1.ipcRenderer.off('license-updated', handler);
    },
    // 로그아웃
    logout: () => electron_1.ipcRenderer.invoke('license-logout'),
    // ✅ alias (구버전 호환) — 둘 중 하나만 사용
    onLicense: (listener) => {
        const handler = (_e, d) => { try {
            listener(d);
        }
        catch { } };
        electron_1.ipcRenderer.on('license-updated', handler);
        return () => electron_1.ipcRenderer.off('license-updated', handler);
    },
    // ── 관리자 모드 ──
    adminAuth: (pin) => electron_1.ipcRenderer.invoke('admin-auth', pin),
    setAdminPin: (args) => electron_1.ipcRenderer.invoke('set-admin-pin', args),
    onAdminMode: (listener) => {
        const handler = (_e, payload) => {
            try {
                listener(!!payload?.enabled);
            }
            catch { }
        };
        electron_1.ipcRenderer.on('admin-mode', handler);
        return () => electron_1.ipcRenderer.off('admin-mode', handler);
    },
    onAdminShortcut: (listener) => {
        const handler = () => {
            try {
                listener();
            }
            catch { }
        };
        electron_1.ipcRenderer.on('admin-shortcut', handler);
        return () => electron_1.ipcRenderer.off('admin-shortcut', handler);
    },
    // ── 워드프레스 카테고리 로드 ──
    loadWordPressCategories: (args) => electron_1.ipcRenderer.invoke('load-wordpress-categories', args),
    loadWpCategories: (args) => electron_1.ipcRenderer.invoke('loadWpCategories', args),
    // ── 썸네일 생성 ──
    makeThumb: (payload) => electron_1.ipcRenderer.invoke('make-thumb', payload),
    // ── 콘텐츠 품질 분석 ──
    analyzeContentQuality: (args) => electron_1.ipcRenderer.invoke('analyze-content-quality', args),
    // ── 스마트 키워드 생성 ──
    generateSmartKeywords: (args) => electron_1.ipcRenderer.invoke('generate-smart-keywords', args),
    // ── CTA 클릭 로깅 ──
    logCtaClick: (payload) => electron_1.ipcRenderer.invoke('log-cta-click', payload),
    getSnippetLibrary: () => electron_1.ipcRenderer.invoke('get-snippet-library'),
    saveSnippetLibrary: (library) => electron_1.ipcRenderer.invoke('save-snippet-library', library),
    // ── 트렌드 분석 ──
    analyzeTrends: (args) => electron_1.ipcRenderer.invoke('analyze-trends', args),
    // ── 워드프레스 연결 테스트 ──
    testWordPressConnection: (args) => electron_1.ipcRenderer.invoke('test-wordpress-connection', args),
    getWordPressCategories: (args) => electron_1.ipcRenderer.invoke('get-wordpress-categories', args),
    getWordPressTags: (args) => electron_1.ipcRenderer.invoke('get-wordpress-tags', args),
    // ── 블로거 인증 ──
    startAuth: (payload) => electron_1.ipcRenderer.invoke('blogger-start-auth', payload),
    handleCallback: (args) => electron_1.ipcRenderer.invoke('blogger-handle-callback', args),
    checkAuthStatus: () => electron_1.ipcRenderer.invoke('blogger-check-auth-status'),
    // ── 인증 상태 확인 (메인 프로세스에서 호출용) ──
    checkWordPressAuthStatus: () => electron_1.ipcRenderer.invoke('wordpress-check-auth-status'),
    // ── Google CSE 연동 확인 ──
    testGoogleCseConnection: (args) => electron_1.ipcRenderer.invoke('test-google-cse-connection', args),
    // ── user-config.json 저장/불러오기 ──
    saveUserConfig: (config) => electron_1.ipcRenderer.invoke('save-user-config', config),
    getUserConfig: () => electron_1.ipcRenderer.invoke('get-user-config'),
    // ── 외부 브라우저로 링크 열기 ──
    openExternal: (url) => electron_1.ipcRenderer.invoke('open-external', url),
    // ── OAuth2 토큰 교환 ──
    fetchToken: (tokenData) => electron_1.ipcRenderer.invoke('fetch-token', tokenData),
    // ── 라이센스 파일 시스템 접근 ──
    readLicenseFile: () => electron_1.ipcRenderer.invoke('read-license-file'),
    writeLicenseFile: (data) => electron_1.ipcRenderer.invoke('write-license-file', data),
    // ── 플랫폼 연동 확인 ──
    checkPlatformAuth: (platform) => electron_1.ipcRenderer.invoke('check-platform-auth', platform),
    // ── 세션 관리 (중복 로그인 방지) ──
    sessionValidate: () => electron_1.ipcRenderer.invoke('session-validate'),
    sessionStartValidation: () => electron_1.ipcRenderer.invoke('session-start-validation'),
    sessionStopValidation: () => electron_1.ipcRenderer.invoke('session-stop-validation'),
    onSessionExpired: (callback) => {
        const handler = (_e, data) => {
            try {
                callback(data);
            }
            catch { }
        };
        electron_1.ipcRenderer.on('session-expired', handler);
        return () => electron_1.ipcRenderer.off('session-expired', handler);
    },
    testCseConnection: (cseKey, cseCx) => electron_1.ipcRenderer.invoke('test-cse-connection', { cseKey, cseCx }),
    // ── 블로그스팟 OAuth ──
    startBloggerAuth: (payload) => electron_1.ipcRenderer.invoke('blogger-start-auth', payload),
    handleBloggerCallback: (code) => electron_1.ipcRenderer.invoke('blogger-handle-callback', { code }),
    /** Blogger OAuth2 인증 */
    bloggerOAuth: (oauthData) => electron_1.ipcRenderer.invoke('blogger:oauth', oauthData),
    // 🔥 블로그스팟 인증 완료 이벤트 리스너
    onBloggerAuthComplete: (callback) => {
        electron_1.ipcRenderer.on('blogger-auth-complete', (_event, result) => callback(result));
    },
    saveEnvironmentSettings: (settings) => electron_1.ipcRenderer.invoke('save-environment-settings', settings),
    loadEnvironmentSettings: () => electron_1.ipcRenderer.invoke('load-environment-settings'),
    // ── 워드프레스 연동 ──
    // ── 생성된 콘텐츠 발행 ──
    publishContent: (payload, title, content, thumbnailUrl) => electron_1.ipcRenderer.invoke('publish-content', { payload, title, content, thumbnailUrl }),
    // ── 백업 관리 ──
    createBackup: () => electron_1.ipcRenderer.invoke('create-backup'),
    restoreBackup: () => electron_1.ipcRenderer.invoke('restore-backup'),
    // ── AI 이미지 생성 ──
    generateAIImage: (args) => electron_1.ipcRenderer.invoke('generate-ai-image', args),
    crawlProductSnapshot: (args) => electron_1.ipcRenderer.invoke('crawl-product-snapshot', args),
    // 이미지 라이브러리 관련 코드 제거됨
    saveImageAsPng: (payload) => electron_1.ipcRenderer.invoke('save-image-as-png', payload),
    // ── 키워드 마스터 ──
    openKeywordMasterWindow: () => electron_1.ipcRenderer.invoke('open-keyword-master-window'),
    findGoldenKeywords: (keyword, options) => electron_1.ipcRenderer.invoke('find-golden-keywords', keyword, options),
    stopKeywordDiscovery: (keyword) => electron_1.ipcRenderer.invoke('stop-keyword-discovery', keyword),
    getTrendingKeywords: (source) => electron_1.ipcRenderer.invoke('get-trending-keywords', source),
    getRealtimeKeywords: (options) => electron_1.ipcRenderer.invoke('get-realtime-keywords', options),
    checkKeywordRank: (data) => electron_1.ipcRenderer.invoke('check-keyword-rank', data),
    analyzeCompetitors: (keyword) => electron_1.ipcRenderer.invoke('analyze-competitors', keyword),
    analyzeFastByDate: (keyword, maxResults) => electron_1.ipcRenderer.invoke('analyze-fast-by-date', keyword, maxResults),
    getSchedules: () => electron_1.ipcRenderer.invoke('get-schedules'),
    addSchedule: (schedule) => electron_1.ipcRenderer.invoke('add-schedule', schedule),
    toggleSchedule: (id, enabled) => electron_1.ipcRenderer.invoke('toggle-schedule', id, enabled),
    deleteSchedule: (id) => electron_1.ipcRenderer.invoke('delete-schedule', id),
    getScheduleStatus: () => electron_1.ipcRenderer.invoke('get-schedule-status'),
    startScheduleMonitoring: () => electron_1.ipcRenderer.invoke('start-schedule-monitoring'),
    stopScheduleMonitoring: () => electron_1.ipcRenderer.invoke('stop-schedule-monitoring'),
    cleanupSchedules: (daysToKeep) => electron_1.ipcRenderer.invoke('cleanup-schedules', daysToKeep),
    getNotifications: () => electron_1.ipcRenderer.invoke('get-notifications'),
    saveNotificationSettings: (settings) => electron_1.ipcRenderer.invoke('save-notification-settings', settings),
    getDashboardStats: () => electron_1.ipcRenderer.invoke('get-dashboard-stats'),
    getKeywordGroups: () => electron_1.ipcRenderer.invoke('get-keyword-groups'),
    addKeywordGroup: (group) => electron_1.ipcRenderer.invoke('add-keyword-group', group),
    updateKeywordGroup: (id, updates) => electron_1.ipcRenderer.invoke('update-keyword-group', id, updates),
    deleteKeywordGroup: (id) => electron_1.ipcRenderer.invoke('delete-keyword-group', id),
    getKeywordSchedules: () => electron_1.ipcRenderer.invoke('get-keyword-schedules'),
    addKeywordSchedule: (scheduleData) => electron_1.ipcRenderer.invoke('add-keyword-schedule', scheduleData),
    toggleKeywordSchedule: (id, enabled) => electron_1.ipcRenderer.invoke('toggle-keyword-schedule', id, enabled),
    getSNSTrends: (platform) => electron_1.ipcRenderer.invoke('get-sns-trends', platform),
    huntTimingGold: (category) => electron_1.ipcRenderer.invoke('hunt-timing-gold', category),
    getYouTubeVideos: (options) => electron_1.ipcRenderer.invoke('get-youtube-videos', options),
    getGoogleTrendKeywords: () => electron_1.ipcRenderer.invoke('get-google-trend-keywords'),
    // 블로그 지수 조회
    extractBlogIndex: (blogIdOrUrl, options) => electron_1.ipcRenderer.invoke('extract-blog-index', blogIdOrUrl, options),
    // 스마트 블록 연관 키워드 분석
    analyzeSmartBlockKeywords: (keyword, maxResults) => electron_1.ipcRenderer.invoke('analyze-smart-block-keywords', keyword, maxResults),
    // 이미지 프롬프트 생성 (CSP 우회를 위해 main process에서 처리)
    generateImagePrompts: (args) => electron_1.ipcRenderer.invoke('generate-image-prompts', args),
    // 🖼️ AI 이미지 자동 수집
    collectImagesByTitle: (args) => {
        console.log('[PRELOAD] 🖼️ 제목 기반 이미지 수집 요청');
        return electron_1.ipcRenderer.invoke('collect-images-by-title', args);
    },
    collectImagesFromUrl: (args) => {
        console.log('[PRELOAD] 🛍️ 쇼핑몰 URL 이미지 수집 요청');
        return electron_1.ipcRenderer.invoke('collect-images-from-url', args);
    },
    getImageFolders: () => electron_1.ipcRenderer.invoke('get-image-folders'),
    getFolderImages: (folderPath) => electron_1.ipcRenderer.invoke('get-folder-images', folderPath),
    deleteImageFolder: (folderPath) => electron_1.ipcRenderer.invoke('delete-image-folder', folderPath),
    // 🔥 Blogger OAuth 인증 (환경설정에서 직접 인증)
    authenticateBlogger: (args) => {
        console.log('[PRELOAD] 🔐 Blogger OAuth 인증 요청');
        return electron_1.ipcRenderer.invoke('authenticate-blogger', args);
    },
    // 🔥 다중 계정 발행
    runMultiAccountPost: (args) => {
        console.log('[PRELOAD] 🚀 다중 계정 발행 요청:', args.platform, args.keyword);
        return electron_1.ipcRenderer.invoke('run-multi-account-post', args);
    },
    // 🛡️ AdsPower 연동
    adspowerCheckStatus: () => electron_1.ipcRenderer.invoke('adspower:check-status'),
    adspowerListProfiles: () => electron_1.ipcRenderer.invoke('adspower:list-profiles'),
    adspowerStartProfile: (profileId) => electron_1.ipcRenderer.invoke('adspower:start-profile', profileId),
    adspowerStopProfile: (profileId) => electron_1.ipcRenderer.invoke('adspower:stop-profile', profileId),
    // 🔐 ImageFX Google 로그인
    imagefxCheckLogin: () => electron_1.ipcRenderer.invoke('imagefx:check-login'),
    imagefxLogin: () => electron_1.ipcRenderer.invoke('imagefx:login'),
    // ── 쿼터 관리 ──
    getQuotaStatus: () => electron_1.ipcRenderer.invoke('quota:getStatus'),
};
// Electron API (개발자 모드 체크 포함)
const electronApi = {
    ...api,
    // IPC 직접 호출 메서드 (모든 IPC 핸들러 호출 가능)
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
    // 개발자 모드 확인
    isDeveloperMode: () => electron_1.ipcRenderer.invoke('is-developer-mode'),
    // 패키징 여부 확인
    isPackaged: async () => {
        try {
            return await electron_1.ipcRenderer.invoke('is-packaged');
        }
        catch {
            return false; // 기본값: 개발 모드로 간주
        }
    },
};
electron_1.contextBridge.exposeInMainWorld('blogger', api);
electron_1.contextBridge.exposeInMainWorld('electron', electronApi);
// 메인 프로세스에서 호출하는 함수들을 위한 별칭 (isPackaged 및 invoke 포함)
const electronApiForWindow = {
    ...api,
    ...electronApi, // invoke, isDeveloperMode, isPackaged 포함
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronApiForWindow);
// 콘텐츠 변형을 위한 추가 API
electron_1.contextBridge.exposeInMainWorld('api', {
    envLoad: () => electron_1.ipcRenderer.invoke('get-env'),
    crawlUrl: (url) => electron_1.ipcRenderer.invoke('crawl-url', url),
    transformContent: (args) => electron_1.ipcRenderer.invoke('transform-content', args),
});
