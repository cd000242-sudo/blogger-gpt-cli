export type PublishType = 'draft' | 'now' | 'schedule';
/** ───────── ENV / 실행 타입 ───────── */
export type EnvConfig = {
    provider: 'openai' | 'gemini';
    openaiKey?: string;
    geminiKey?: string;
    /** Blogger & OAuth */
    blogId: string;
    googleClientId: string;
    googleClientSecret: string;
    redirectUri: string;
    /** UI에서 문자열로 들어와도 허용, 저장 시 숫자로 보정 */
    minChars?: number | string;
    /** ✅ Google CSE 자동 링크용 자격증명(선택) */
    googleCseKey?: string;
    googleCseCx?: string;
    /** ✅ Pexels 무료 이미지 검색용 API 키 */
    pexelsApiKey?: string;
};
export type PostPayload = EnvConfig & {
    topic: string;
    keywords: string;
    publishType: PublishType;
    scheduleISO?: string;
    thumbnailMode?: 'default' | 'cse' | 'pexels';
    promptMode?: 'default' | 'custom';
    useGoogleSearch?: boolean;
    customPrompt?: string;
    pexelsApiKey?: string;
};
export type RunOk = {
    ok: true;
    logs?: string;
};
export type RunFail = {
    ok: false;
    exitCode?: number;
    logs?: string;
    error?: string;
};
export type RunResult = RunOk | RunFail;
/** 저장된 .env 로드 결과 */
export type GetEnvResult = {
    ok: true;
    data: (Omit<EnvConfig, 'minChars'> & {
        minChars?: number;
    }) | null;
} | {
    ok: false;
    error?: string;
};
/** ───────── 라이선스 타입 ───────── */
export type LicenseData = {
    maxUses: number;
    remaining: number;
    expiresAt: string;
};
/** ───────── 관리자 모드/진행률 이벤트 ───────── */
export type AdminModePayload = {
    enabled: boolean;
};
export type ProgressPayload = {
    p: number;
    label?: string;
};
/** 렌더러에서 사용할 API 모음 */
export type BloggerApi = {
    openLink(href: string): Promise<boolean>;
    saveEnv(env: EnvConfig): Promise<RunResult>;
    getEnv(): Promise<GetEnvResult>;
    setSettingsProtection(protectedMode: boolean): Promise<RunResult>;
    isSettingsProtected(): Promise<{
        ok: boolean;
        protected?: boolean;
    }>;
    validateEnv(): Promise<RunResult>;
    runPost(payload: PostPayload): Promise<RunResult>;
    /** 로그/진행률 구독 */
    onLog(listener: (line: string) => void): () => void;
    onProgress(listener: (payload: ProgressPayload) => void): () => void;
    /** 작업 취소 */
    cancelTask(): void;
    /** 라이선스 */
    subscribeLicense(): void;
    getLicense(): Promise<{
        ok: true;
        data: LicenseData;
    }>;
    activateLicense(args: {
        code: string;
        who?: string;
    }): Promise<{
        ok: true;
        data: LicenseData;
    } | {
        ok: false;
        error?: string;
    }>;
    saveLicense(data: {
        maxUses: number;
        expiresAt: string;
        pin?: string;
    }): Promise<{
        ok: true;
        data: LicenseData;
    } | {
        ok: false;
        error?: string;
    }>;
    onLicenseUpdated(listener: (d: LicenseData) => void): () => void;
    /** ⚠️ onLicenseUpdated와 동시에 쓰지 마세요(구버전 호환용). */
    onLicense?(listener: (d: LicenseData) => void): () => void;
    /** 관리자 */
    adminAuth(pin: string): Promise<{
        ok: true;
    } | {
        ok: false;
        error?: string;
    }>;
    setAdminPin(args: {
        oldPin: string;
        newPin: string;
    }): Promise<{
        ok: true;
    } | {
        ok: false;
        error?: string;
    }>;
    onAdminMode(listener: (enabled: boolean) => void): () => void;
    onAdminShortcut(listener: () => void): () => void;
    /** 워드프레스 카테고리 로드 */
    loadWordPressCategories(args: {
        siteUrl: string;
        username?: string;
        password?: string;
        clientId?: string;
        clientSecret?: string;
        jwtToken?: string;
    }): Promise<{
        ok: true;
        categories: any[];
    } | {
        ok: false;
        error?: string;
    }>;
    /** 워드프레스 카테고리 로드 (별칭) */
    loadWpCategories(args: {
        wpUrl: string;
        wpUsername: string;
        wpPassword: string;
    }): Promise<{
        ok: boolean;
        categories?: Array<{
            id: number;
            name: string;
            count: number;
        }>;
        error?: string;
    }>;
    /** 썸네일 생성 */
    makeThumb(args: {
        topic: string;
        mode?: 'default' | 'cse' | 'pexels';
    }): Promise<{
        ok: true;
        imageUrl: string;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 콘텐츠 품질 분석 */
    analyzeContentQuality(args: {
        content: string;
        topic: string;
        keywords?: string[];
    }): Promise<{
        ok: true;
        result: any;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 스마트 키워드 생성 */
    generateSmartKeywords(args: {
        topic: string;
        baseKeywords?: string[];
    }): Promise<{
        ok: true;
        result: any;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 트렌드 분석 */
    analyzeTrends(args: {
        topic: string;
        keywords?: string[];
    }): Promise<{
        ok: true;
        result: any;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 워드프레스 연결 테스트 */
    testWordPressConnection(args: {
        siteUrl: string;
        username: string;
        password: string;
    }): Promise<{
        ok: boolean;
        message?: string;
        error?: string;
    }>;
    /** 워드프레스 카테고리 가져오기 */
    getWordPressCategories(args: {
        siteUrl: string;
        username: string;
        password: string;
    }): Promise<{
        ok: boolean;
        categories?: Array<{
            id: number;
            name: string;
            count: number;
        }>;
        error?: string;
    }>;
    /** 워드프레스 태그 가져오기 */
    getWordPressTags(args: {
        siteUrl: string;
        username: string;
        password: string;
    }): Promise<{
        ok: boolean;
        tags?: Array<{
            id: number;
            name: string;
            count: number;
        }>;
        error?: string;
    }>;
    /** Google CSE 연결 테스트 */
    testGoogleCseConnection(args: {
        googleCseKey: string;
        googleCseCx: string;
    }): Promise<{
        ok: boolean;
        message?: string;
        error?: string;
    }>;
    /** 외부 브라우저로 URL 열기 */
    openExternal(url: string): Promise<boolean>;
    /** OAuth2 토큰 교환 */
    fetchToken(tokenData: any): Promise<any>;
    /** 블로거 인증 */
    startAuth(payload: any): Promise<{
        success: boolean;
        authUrl?: string;
        error?: string;
    }>;
    handleCallback(args: {
        payload: any;
        code: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    checkAuthStatus(): Promise<{
        authenticated: boolean;
        error?: string;
    }>;
    /** 인증 상태 확인 (메인 프로세스에서 호출용) */
    checkWordPressAuthStatus(): Promise<{
        authenticated: boolean;
        error?: string;
    }>;
    checkBloggerAuthStatus(): Promise<{
        authenticated: boolean;
        error?: string;
    }>;
    /** OAuth2 토큰 교환 */
    exchangeOAuthToken(args: {
        client_id: string;
        client_secret: string;
        code: string;
        redirect_uri: string;
    }): Promise<{
        success: boolean;
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        error?: string;
    }>;
    /** 키워드 마스터 (leadernam 황금키워드) */
    openKeywordMasterWindow(): Promise<{
        ok: boolean;
        error?: string;
    }>;
    findGoldenKeywords(keyword: string): Promise<any[]>;
    stopKeywordDiscovery(keyword: string): Promise<{
        success: boolean;
    }>;
    getTrendingKeywords(source: 'naver' | 'google' | 'youtube'): Promise<any[]>;
    getRealtimeKeywords(options?: {
        platform?: 'zum' | 'google' | 'nate' | 'daum' | 'all';
        limit?: number;
    }): Promise<{
        success: boolean;
        data?: any;
        timestamp?: string;
        error?: string;
    }>;
    checkKeywordRank(data: {
        keyword: string;
        blogUrl: string;
    }): Promise<any>;
    analyzeCompetitors(keyword: string): Promise<any>;
    getSchedules(): Promise<any[]>;
    addSchedule(schedule: {
        name: string;
        time: string;
    }): Promise<any>;
    toggleSchedule(id: string, enabled: boolean): Promise<any>;
    getNotifications(): Promise<any[]>;
    saveNotificationSettings(settings: any): Promise<any>;
    getDashboardStats(): Promise<any>;
    getKeywordGroups(): Promise<any[]>;
    addKeywordGroup(group: {
        name: string;
        color: string;
    }): Promise<any>;
    updateKeywordGroup(id: string, updates: any): Promise<any>;
    deleteKeywordGroup(id: string): Promise<any>;
    getKeywordSchedules(): Promise<any[]>;
    addKeywordSchedule(scheduleData: any): Promise<any>;
    toggleKeywordSchedule(id: string, enabled: boolean): Promise<any>;
    getSNSTrends(platform: 'youtube'): Promise<any[]>;
    huntTimingGold(category?: string): Promise<any[]>;
    getYouTubeVideos(options?: {
        maxResults?: number;
    }): Promise<any[]>;
    /** user-config.json 저장/불러오기 */
    saveUserConfig(config: Record<string, any>): Promise<{
        ok: true;
        logs: string;
    } | {
        ok: false;
        error?: string;
    }>;
    getUserConfig(): Promise<{
        ok: true;
        data: Record<string, any>;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 라이센스 파일 시스템 접근 */
    readLicenseFile(): Promise<{
        ok: true;
        data: any;
    } | {
        ok: false;
        error?: string;
    }>;
    writeLicenseFile(data: any): Promise<{
        ok: true;
    } | {
        ok: false;
        error?: string;
    }>;
    /** 플랫폼 연동 확인 */
    checkPlatformAuth(platform: 'blogger' | 'wordpress'): Promise<{
        authenticated: boolean;
        error?: string;
    }>;
    /** CSE 연동 테스트 */
    testCseConnection(cseKey: string, cseCx: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    /** 블로그스팟 OAuth 인증 시작 */
    startBloggerAuth(): Promise<{
        ok: boolean;
        authUrl?: string;
        error?: string;
    }>;
    /** 블로그스팟 OAuth 코드 처리 */
    handleBloggerCallback(code: string): Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** Blogger OAuth2 인증 */
    bloggerOAuth(oauthData: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    }): Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** 환경설정 저장 */
    saveEnvironmentSettings(settings: Record<string, string>): Promise<{
        ok: boolean;
        error?: string;
    }>;
    /** 환경설정 로드 */
    loadEnvironmentSettings(): Promise<{
        ok: boolean;
        data?: Record<string, string>;
        error?: string;
    }>;
    /** 생성된 콘텐츠 발행 */
    publishContent(payload: any, title: string, content: string, thumbnailUrl: string): Promise<{
        ok: boolean;
        url?: string;
        id?: string;
        error?: string;
    }>;
    /** 백업 관리 */
    createBackup(): Promise<{
        ok: boolean;
        error?: string;
    }>;
    restoreBackup(): Promise<{
        ok: boolean;
        error?: string;
    }>;
    checkBloggerAuthStatus(): Promise<{
        authenticated: boolean;
        error?: string;
        message?: string;
    }>;
    /** AI 이미지 생성 */
    generateAIImage(args: {
        prompt: string;
        type: string;
        size?: string;
    }): Promise<{
        success: boolean;
        imageUrl?: string;
        error?: string;
    }>;
};
declare global {
    interface Window {
        blogger: BloggerApi;
        electronAPI: BloggerApi & {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            isDeveloperMode: () => Promise<boolean>;
            isPackaged: () => Promise<boolean>;
        };
        api: {
            envLoad: () => Promise<GetEnvResult>;
            crawlUrl: (url: string) => Promise<any>;
            transformContent: (args: any) => Promise<any>;
        };
    }
}
