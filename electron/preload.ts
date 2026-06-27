// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';
import { SnippetLibraryFile } from '../dist/utils/snippet-library';
import { ProductDetailSnapshot } from '../dist/crawlers/types';

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
  googleCseKey?: string; // Google CSE JSON API Key
  googleCseCx?: string;  // Programmable Search Engine ID (cx)
  
  /** ✅ Pexels 무료 이미지 검색용 API 키 */
  pexelsApiKey?: string; // Pexels API Key for free image search
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

export type RunOk   = { ok: true;  logs?: string };
export type RunFail = { ok: false; exitCode?: number; logs?: string; error?: string };
export type RunResult = RunOk | RunFail;

/** 저장된 .env 로드 결과 */
export type GetEnvResult =
  | { ok: true; data: (Omit<EnvConfig, 'minChars'> & { minChars?: number }) | null }
  | { ok: false; error?: string };

/** ───────── 라이선스 타입 ───────── */
export type LicenseData = {
  maxUses: number;
  remaining: number;
  expiresAt: string;
};

/** ───────── 관리자 모드/진행률 이벤트 ───────── */
export type AdminModePayload = { enabled: boolean };
export type ProgressPayload = { p: number; label?: string };

/** 렌더러에서 사용할 API 모음 */
export type BloggerApi = {
  onQuitConfirm?: (listener: () => void) => () => void;
  confirmQuit?: () => Promise<{ ok: boolean }>;
  openLink(href: string): Promise<boolean>;

  saveEnv(env: EnvConfig): Promise<RunResult>;
  getEnv(): Promise<GetEnvResult>;
  setSettingsProtection(protectedMode: boolean): Promise<RunResult>;
  isSettingsProtected(): Promise<{ ok: boolean; protected?: boolean }>;
  validateEnv(): Promise<RunResult>;

  runPost(payload: PostPayload): Promise<RunResult>;
  /** 🔥 반자동 완벽 끝판왕 */
  runSemiAutoPost(payload: any): Promise<any>;

  /** 🖼️ 썸네일 생성 */
  generateThumbnail(options: {
    title: string;
    keyword: string;
    backgroundType?: 'ai' | 'local' | 'url' | 'none';
    backgroundSource?: string;
    opacity?: number;
    blur?: number;
  }): Promise<{ ok: true; dataUrl: string } | { ok: false; error: string }>;

  /** 로그/진행률 구독 */
  onLog(listener: (line: string) => void): () => void;
  onProgress(listener: (payload: ProgressPayload) => void): () => void;
  /** v3.8.44: 거미줄 실시간 이미지 생성 이벤트 */
  onSwImageGenerated?(listener: (payload: { kind: string; label: string; url: string }) => void): () => void;

  /** v3.8.89: 발행 완료 통합 신호 (어느 흐름이든 main에서 단일 송신) */
  onPublishSuccess?(listener: (payload: { url: string; platform: string; platformLabel: string; title?: string; postId?: string }) => void): () => void;

  /** v3.8.113: codex 이미지 실시간 감지 */
  onAgentImageGenerated?(listener: (payload: { url: string; label: string; filename: string }) => void): () => void;

  /** v3.8.115: ChatGPT Plus 한도 도달 알림 */
  onAgentQuotaExceeded?(listener: (payload: { provider: string; message: string; resetUrl: string }) => void): () => void;

  /** 작업 취소 */
  cancelTask(): void;

  /** 라이선스 */
  subscribeLicense(): void; // 구독 시작 신호(중복 브로드캐스트 방지)
  getLicense(): Promise<{ ok: true; data: LicenseData }>;
  activateLicense(args: { code: string; who?: string }): Promise<{ ok: true; data: LicenseData } | { ok: false; error?: string }>;
  saveLicense(data: { maxUses: number; expiresAt: string; pin?: string }): Promise<
    | { ok: true; data: LicenseData }
    | { ok: false; error?: string }
  >;
  getAgentModeStatus?(): Promise<any>;
  listAgentProfiles?(): Promise<any>;
  createAgentProfile?(args: { provider: 'codex' | 'claude'; label?: string; authMode?: 'subscription' | 'api' }): Promise<any>;
  getAgentLoginCommand?(args: { id: string }): Promise<any>;
  installAgentTool?(args: { provider: 'codex' | 'claude' }): Promise<any>;
  startAgentLogin?(args: { id?: string; provider?: 'codex' | 'claude' }): Promise<any>;
  checkAgentLogin?(args: { id?: string; provider?: 'codex' | 'claude' }): Promise<any>;
  runAgentJob?(args: any): Promise<any>;
  onLicenseUpdated(listener: (d: LicenseData) => void): () => void;
  logout(): Promise<{ success: boolean; message?: string }>;

  /** ⚠️ onLicenseUpdated와 동시에 쓰지 마세요(구버전 호환용). */
  onLicense?(listener: (d: LicenseData) => void): () => void;

  /** 관리자 */
  adminAuth(pin: string): Promise<{ ok: true } | { ok: false; error?: string }>;
  setAdminPin(args: { oldPin: string; newPin: string }): Promise<{ ok: true } | { ok: false; error?: string }>;
  onAdminMode(listener: (enabled: boolean) => void): () => void;
  onAdminShortcut(listener: () => void): () => void;

  /** 워드프레스 카테고리 로드 */
  loadWordPressCategories(args: { siteUrl: string; username?: string; password?: string; clientId?: string; clientSecret?: string; jwtToken?: string }): Promise<{ ok: true; categories: any[] } | { ok: false; error?: string }>;
  /** 워드프레스 카테고리 로드 (별칭) */
  loadWpCategories(args: { wpUrl: string; wpUsername: string; wpPassword: string }): Promise<{ ok: boolean; categories?: Array<{ id: number; name: string; count: number }>; error?: string }>;

  /** 썸네일 생성 */
  makeThumb(args: { topic: string; mode?: 'default' | 'cse' | 'pexels' }): Promise<{ ok: true; imageUrl: string } | { ok: false; error?: string }>;

  /** 콘텐츠 품질 분석 */
  analyzeContentQuality(args: { content: string; topic: string; keywords?: string[] }): Promise<{ ok: true; result: any } | { ok: false; error?: string }>;

  /** 스마트 키워드 생성 */
  generateSmartKeywords(args: { topic: string; baseKeywords?: string[] }): Promise<{ ok: true; result: any } | { ok: false; error?: string }>;

  /** CTA 클릭 로깅 */
  logCtaClick(payload: { role: string; url: string; sectionIndex?: number | string; timestamp: string; postId?: string }): Promise<void>;

  /** 스니펫 라이브러리 */
  getSnippetLibrary(): Promise<{ ok: boolean; data?: SnippetLibraryFile; error?: string }>;
  saveSnippetLibrary(library: SnippetLibraryFile): Promise<{ ok: boolean; error?: string }>;

  /** 상세페이지 스냅샷 크롤링 */
  crawlProductSnapshot(args: { url: string; forceParserId?: string }): Promise<{
    ok: boolean;
    data?: ProductDetailSnapshot;
    error?: string;
  }>;

  /** 트렌드 분석 */
  analyzeTrends(args: { topic: string; keywords?: string[] }): Promise<{ ok: true; result: any } | { ok: false; error?: string }>;

  /** 워드프레스 연결 테스트 */
  testWordPressConnection(args: { siteUrl: string; username: string; password: string }): Promise<{ ok: boolean; message?: string; error?: string }>;
  /** 워드프레스 카테고리 가져오기 */
  getWordPressCategories(args: { siteUrl: string; username: string; password: string }): Promise<{ ok: boolean; categories?: Array<{ id: number; name: string; count: number }>; error?: string }>;
  /** 워드프레스 태그 가져오기 */
  getWordPressTags(args: { siteUrl: string; username: string; password: string }): Promise<{ ok: boolean; tags?: Array<{ id: number; name: string; count: number }>; error?: string }>;

  /** Google CSE 연결 테스트 */
  testGoogleCseConnection(args: { googleCseKey: string; googleCseCx: string }): Promise<{ ok: boolean; message?: string; error?: string }>;

  /** 외부 브라우저로 URL 열기 */
  openExternal(url: string): Promise<boolean>;

  /** OAuth2 토큰 교환 */
  fetchToken(tokenData: any): Promise<any>;

  /** 블로거 인증 */
  startAuth(payload: any): Promise<{ success: boolean; authUrl?: string; error?: string }>;
  handleCallback(args: { payload: any; code: string }): Promise<{ success: boolean; error?: string }>;
  checkAuthStatus(): Promise<{ authenticated: boolean; error?: string }>;
  
  /** 인증 상태 확인 (메인 프로세스에서 호출용) */
  checkWordPressAuthStatus(): Promise<{ authenticated: boolean; error?: string }>;
  checkBloggerAuthStatus(): Promise<{ authenticated: boolean; error?: string }>;
  
  /** OAuth2 토큰 교환 */
  exchangeOAuthToken(args: { client_id: string; client_secret: string; code: string; redirect_uri: string }): Promise<{ success: boolean; access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string; error?: string }>;
  
  /** LEWORD 외부 앱 런처 */
  leword: {
    launch(): Promise<{ ok: boolean; action?: 'launched' | 'installed_and_launched'; version?: string; error?: string }>;
    getStatus(): Promise<{ installed: boolean; version?: string; exePath?: string; installedAt?: number }>;
    onProgress(cb: (p: { phase: string; percent: number; message: string }) => void): () => void;
  };

  /** 키워드 마스터 (leadernam 황금키워드) */
  openKeywordMasterWindow(): Promise<{ ok: boolean; error?: string }>;
  findGoldenKeywords(keyword: string): Promise<any[]>;
  stopKeywordDiscovery(keyword: string): Promise<{ success: boolean }>;
  getTrendingKeywords(source: 'naver' | 'google' | 'youtube'): Promise<any[]>;
  getRealtimeKeywords(options?: { platform?: 'zum' | 'google' | 'nate' | 'daum' | 'all', limit?: number }): Promise<{ success: boolean; data?: any; timestamp?: string; error?: string }>;
  checkKeywordRank(data: { keyword: string; blogUrl: string }): Promise<any>;
  analyzeCompetitors(keyword: string): Promise<any>;
  getSchedules(): Promise<{ ok: boolean; schedules: any[]; error?: string }>;
  addSchedule(schedule: any): Promise<{ ok: boolean; schedule?: any; error?: string }>;
  toggleSchedule(id: string, enabled: boolean): Promise<{ ok: boolean; error?: string }>;
  deleteSchedule(id: string): Promise<{ ok: boolean; error?: string }>;
  getScheduleStatus(): Promise<{ ok: boolean; status: any; error?: string }>;
  startScheduleMonitoring(): Promise<{ ok: boolean; error?: string }>;
  stopScheduleMonitoring(): Promise<{ ok: boolean; error?: string }>;
  cleanupSchedules(daysToKeep?: number): Promise<{ ok: boolean; deletedCount?: number; error?: string }>;
  getNotifications(): Promise<any[]>;
  saveNotificationSettings(settings: any): Promise<any>;
  getDashboardStats(): Promise<any>;
  getKeywordGroups(): Promise<any[]>;
  addKeywordGroup(group: { name: string; color: string }): Promise<any>;
  updateKeywordGroup(id: string, updates: any): Promise<any>;
  deleteKeywordGroup(id: string): Promise<any>;
  getKeywordSchedules(): Promise<any[]>;
  addKeywordSchedule(scheduleData: any): Promise<any>;
  toggleKeywordSchedule(id: string, enabled: boolean): Promise<any>;
  getSNSTrends(platform: 'youtube'): Promise<any[]>;
  huntTimingGold(category?: string): Promise<any[]>;
  getGoogleTrendKeywords(): Promise<Array<{ rank: number; keyword: string; changeRate: number; category: string }>>;
  getYouTubeVideos(options?: { maxResults?: number }): Promise<any[]>;

  /** user-config.json 저장/불러오기 */
  saveUserConfig(config: Record<string, any>): Promise<{ ok: true; logs: string } | { ok: false; error?: string }>;
  getUserConfig(): Promise<{ ok: true; data: Record<string, any> } | { ok: false; error?: string }>;

  /** 라이센스 파일 시스템 접근 */
  readLicenseFile(): Promise<{ ok: true; data: any } | { ok: false; error?: string }>;
  writeLicenseFile(data: any): Promise<{ ok: true } | { ok: false; error?: string }>;
  
  /** 플랫폼 연동 확인 */
  checkPlatformAuth(platform: 'blogger' | 'wordpress' | 'tistory'): Promise<{ authenticated: boolean; error?: string }>;
  checkTistorySession(payload?: Record<string, any>): Promise<{ ok: boolean; authenticated: boolean; blogName?: string; blogUrl?: string; writeUrl?: string; error?: string }>;
  loadTistoryCategories(payload?: Record<string, any>): Promise<{ ok: boolean; authenticated: boolean; blogName?: string; blogUrl?: string; categories?: Array<{ id?: string; name: string; label: string }>; selectedCategory?: string; error?: string }>;
  openTistoryLogin(payload?: Record<string, any>): Promise<{ ok: boolean; authenticated: boolean; blogName?: string; blogUrl?: string; writeUrl?: string; error?: string }>;
  
  /** 세션 관리 (중복 로그인 방지) */
  sessionValidate(): Promise<{ valid: boolean; code: string; message: string; loginAt?: number }>;
  sessionStartValidation(): Promise<{ success: boolean; error?: string }>;
  sessionStopValidation(): Promise<{ success: boolean; error?: string }>;
  onSessionExpired(callback: (data: { reason: string }) => void): () => void;
  /** CSE 연동 테스트 */
  testCseConnection(cseKey: string, cseCx: string): Promise<{ success: boolean; error?: string }>;
  /** 블로그스팟 OAuth 인증 시작 */
  startBloggerAuth(payload?: any): Promise<{ ok: boolean; authUrl?: string; redirectUri?: string; error?: string }>;
  /** 블로그스팟 OAuth 코드 처리 */
  handleBloggerCallback(code: string): Promise<{ ok: boolean; error?: string }>;
  /** 🔥 블로그스팟 인증 완료 이벤트 리스너 */
  onBloggerAuthComplete(callback: (result: { ok: boolean; error?: string }) => void): void;
  /** Blogger OAuth2 인증 */
  bloggerOAuth(oauthData: { clientId: string; clientSecret: string; redirectUri: string }): Promise<{ ok: boolean; error?: string }>;
  /** 환경설정 저장 */
  saveEnvironmentSettings(settings: Record<string, string>): Promise<{ ok: boolean; error?: string }>;
  /** 환경설정 로드 */
  loadEnvironmentSettings(): Promise<{ ok: boolean; data?: Record<string, string>; error?: string }>;
  
  /** 생성된 콘텐츠 발행 */
  publishContent(payload: any, title: string, content: string, thumbnailUrl: string): Promise<{ ok: boolean; url?: string; id?: string; error?: string }>;
  
  
  /** 백업 관리 */
  createBackup(): Promise<{ ok: boolean; success?: boolean; backupPath?: string; error?: string }>;
  restoreBackup(): Promise<{ ok: boolean; error?: string }>;
  
  // 블로그스팟 인증 상태 확인
  checkBloggerAuthStatus(): Promise<{ authenticated: boolean; error?: string; message?: string }>;
  
  /** AI 이미지 생성 */
  generateAIImage(args: { prompt: string; type: string; size?: string }): Promise<{ success: boolean; imageUrl?: string; error?: string }>;
  crawlProductSnapshot(args: { url: string; forceParserId?: string }): Promise<{ ok: boolean; data?: any; error?: string }>;

  // 이미지 라이브러리 관련 코드 제거됨
  saveImageAsPng(payload: { imageUrl: string; imageId?: string }): Promise<{ ok: boolean; data?: { filePath: string; dataUrl: string; url: string }; error?: string }>;

  // 블로그 지수 조회
  extractBlogIndex(blogIdOrUrl: string, options?: { fastMode?: boolean; enhanced?: boolean }): Promise<any>;
  
  // 작성일자 기반 빠른 분석
  analyzeFastByDate(keyword: string, maxResults?: number): Promise<any>;
  
  // 스마트 블록 연관 키워드 분석
  analyzeSmartBlockKeywords(keyword: string, maxResults?: number): Promise<any>;

  // 이미지 프롬프트 생성 (CSP 우회를 위해 main process에서 처리)
  generateImagePrompts(args: { sections: Array<{ index: number; title: string }>; topic: string; geminiKey: string; openaiKey?: string; claudeKey?: string }): Promise<{ prompts: Array<{ sectionIndex: number; sectionTitle: string; prompt: string }>; errors: Array<{ sectionIndex: number; sectionTitle: string; error: string }>; successCount: number; totalCount: number }>;

  // 🖼️ AI 이미지 자동 수집
  collectImagesByTitle(args: {
    title: string;
    subtopics: string[];
    naverClientId: string;
    naverClientSecret: string;
    options?: { saveToFolder?: boolean; maxImagesPerSubtopic?: number; includeShoppingImages?: boolean };
  }): Promise<{ ok: boolean; images: any[]; folderPath: string; error?: string }>;
  
  collectImagesFromUrl(args: {
    shoppingUrl: string;
    subtopics: string[];
    options?: { saveToFolder?: boolean; maxImages?: number };
  }): Promise<{ ok: boolean; images: any[]; folderPath: string; error?: string }>;
  
  getImageFolders(): Promise<{ ok: boolean; folders: Array<{ name: string; path: string; imageCount: number }>; error?: string }>;
  getFolderImages(folderPath: string): Promise<{ ok: boolean; images: Array<{ path: string; name: string }>; error?: string }>;
  deleteImageFolder(folderPath: string): Promise<{ ok: boolean; error?: string }>;

  /** 🔥 Blogger OAuth 인증 (환경설정에서 직접 인증) */
  authenticateBlogger(args: { blogId: string; clientId: string; clientSecret: string }): Promise<{ success: boolean; email?: string; blogName?: string; error?: string }>;

  /** 🔥 다중 계정 발행 */
  runMultiAccountPost(args: {
    platform: 'blogger' | 'blogspot' | 'wordpress' | 'tistory';
    keyword: string;
    topic?: string;
    crawlUrl?: string;
    imageSource: string;
    provider?: string;
    generationEngine?: string;
    defaultAiProvider?: string;
    primaryGeminiTextModel?: string;
    toneStyle?: string;
    contentMode?: string;
    titleMode?: string;
    sectionCount?: number;
    ctaMode?: string;
    postingMode?: string;
    publishType?: string;
    scheduleDate?: string;
    thumbnailSource?: string;
    thumbnailType?: string;
    thumbnailMode?: string;
    h2ImageSource?: string;
    h2ImageMode?: string;
    h2Images?: any;
    // Blogger
    blogId?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    // WordPress
    wordpressSiteUrl?: string;
    wordpressUsername?: string;
    wordpressPassword?: string;
    wordpressCategory?: string;
    wordpressCategories?: string;
    // Tistory
    tistoryBlogName?: string;
    tistoryBlogUrl?: string;
    tistoryDefaultCategory?: string;
    tistoryDefaultVisibility?: string;
  }): Promise<{ ok: boolean; url?: string; error?: string }>;

  /** 🛡️ AdsPower 연동 */
  adspowerCheckStatus(): Promise<{ ok: boolean; running?: boolean; version?: string; error?: string }>;
  adspowerListProfiles(): Promise<{ ok: boolean; profiles?: any[]; total?: number; error?: string }>;
  adspowerStartProfile(profileId: string): Promise<{ ok: boolean; wsUrl?: string; error?: string }>;
  adspowerStopProfile(profileId: string): Promise<{ ok: boolean; error?: string }>;
  adspowerCreateProfile(name: string): Promise<{ ok: boolean; profileId?: string; serialNumber?: string; error?: string }>;
  adspowerDeleteProfile(ids: string[]): Promise<{ ok: boolean; error?: string }>;
  adspowerAutoInstall(): Promise<{ ok: boolean; error?: string }>;

  /** 🔐 ImageFX Google 로그인 */
  flowCheckLogin(): Promise<{ loggedIn: boolean; userName?: string; message: string }>;
  flowLogin(): Promise<{ loggedIn: boolean; userName?: string; message: string }>;
  imagefxCheckLogin(): Promise<{ loggedIn: boolean; userName?: string; message: string }>;
  imagefxLogin(): Promise<{ loggedIn: boolean; userName?: string; message: string }>;

  /** 쿼터 상태 조회 */
  getQuotaStatus(): Promise<{ success: boolean; isFree?: boolean; quota?: any; message?: string }>;
  getAppVersion(): Promise<string>;
  onAutoUpdate(listener: (data: any) => void): () => void;
  installUpdate(): Promise<void>;

  /** 블로그 진단 */
  diagnoseBlog(url: string): Promise<any>;
  /** IndexNow 즉시 색인 요청 */
  submitIndexNow(siteUrl: string, urls: string[]): Promise<any>;
  /** URL 이미지 자동 수집 + AI 검증 (cd000242-sudo/naver v2.7.77 이식) */
  crawlUrlImages(payload: {
    url: string;
    postTitle: string;
    mainKeyword: string;
    aiCheckEnabled?: boolean;
    textGenerator?: string;
    threshold?: number;
  }): Promise<any>;
  /** v3.8.176: AdSense 자동 해결 */
  adsenseOpenConsole(payload?: { siteUrl?: string }): Promise<any>;
  adsenseDiagnose(payload: { siteUrl: string }): Promise<any>;
  adsenseCreatePages(payload: { blogId: string; pages: string[]; ownerName?: string; ownerEmail?: string }): Promise<any>;
  adsenseListClickbaitPosts(payload: { blogId: string }): Promise<any>;
  adsenseCleanPostTitles(payload: { blogId: string; postIds: string[]; dryRun?: boolean }): Promise<any>;
  adsenseAnalyzeContentValue(payload: { blogId: string; sampleSize?: number }): Promise<any>;
  adsenseBoostPostValue(payload: { blogId: string; postId: string; dryRun?: boolean }): Promise<any>;
  adsenseBulkCleanupPosts(payload: { blogId: string; action: 'delete' | 'list-only'; threshold?: number; dryRun?: boolean }): Promise<any>;
  adsenseListYearlyPosts(payload: { blogId: string; currentYear?: number }): Promise<any>;
  adsenseRefreshYearlyPost(payload: { blogId: string; postId: string; currentYear?: number; dryRun?: boolean }): Promise<any>;
  adsenseApprovalReadinessCheck(payload: any): Promise<any>;
  adsenseInjectSchemaOrg(payload: any): Promise<any>;
  adsenseCreateAuthorPage(payload: any): Promise<any>;
};

/** ───────── 공통 유틸 ───────── */
function toNumberOrUndefined(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** ───────── IPC 구현 ───────── */
const api: BloggerApi = {
  openLink: (href) => ipcRenderer.invoke('open-link', href),

  // 저장 시 minChars를 숫자로 보정해서 main으로 전달
  // (googleCseKey/googleCseCx 포함되어 그대로 전달됨)
  saveEnv: (env) => {
    const minChars = toNumberOrUndefined(env.minChars);
    return ipcRenderer.invoke('save-env', { ...env, minChars });
  },

  getEnv:    () => ipcRenderer.invoke('get-env'),
  setSettingsProtection: (protectedMode: boolean) => ipcRenderer.invoke('set-settings-protection', protectedMode),
  isSettingsProtected: () => ipcRenderer.invoke('is-settings-protected'),
  validateEnv: () => ipcRenderer.invoke('validate-env'),
  runPost:   (p)    => ipcRenderer.invoke('run-post', p),
  
  // 🔥 반자동 완벽 끝판왕 추가
  runSemiAutoPost: (p) => {
    console.log('[PRELOAD] 🔥 runSemiAutoPost 호출');
    return ipcRenderer.invoke('run-semi-auto-post', p).then(result => {
      console.log('[PRELOAD] ✅ 반자동 생성 완료');
      return result;
    }).catch((error: any) => {
      console.error('[PRELOAD] ❌ 반자동 오류:', error);
      return { ok: false, error: error.message };
    });
  },
  
  // 🖼️ 썸네일 생성
  generateThumbnail: (options) => {
    console.log('[PRELOAD] 썸네일 생성 요청');
    return ipcRenderer.invoke('generate-thumbnail', options).then(result => {
      return result;
    }).catch((error: any) => {
      return { ok: false, error: error.message };
    });
  },

  onLog: (listener) => {
    const handler = (_e: unknown, line: string) => { try { listener(line); } catch {} };
    ipcRenderer.on('log-line', handler);
    return () => ipcRenderer.off('log-line', handler);
  },

  // 블로그스팟 인증 상태 확인
  checkBloggerAuthStatus: () => ipcRenderer.invoke('blogger-check-auth-status'),
  
  // OAuth2 토큰 교환
  exchangeOAuthToken: (args) => ipcRenderer.invoke('exchange-oauth-token', args),

  // 진행률(막대바) 구독
  onProgress: (listener) => {
    const handler = (_e: unknown, payload: ProgressPayload) => {
      try { listener(payload); } catch {}
    };
    ipcRenderer.on('run-progress', handler);
    return () => ipcRenderer.off('run-progress', handler);
  },

  // v3.8.44: 거미줄 실시간 이미지 생성 이벤트 구독
  onSwImageGenerated: ((listener: (payload: { kind: string; label: string; url: string }) => void) => {
    const handler = (_e: unknown, payload: any) => { try { listener(payload); } catch {} };
    ipcRenderer.on('sw-image-generated', handler);
    return () => ipcRenderer.off('sw-image-generated', handler);
  }) as any,

  // v3.8.89: 발행 완료 통합 신호 구독
  onPublishSuccess: ((listener: (payload: any) => void) => {
    const handler = (_e: unknown, payload: any) => { try { listener(payload); } catch {} };
    ipcRenderer.on('publish:success', handler);
    return () => ipcRenderer.off('publish:success', handler);
  }) as any,

  // v3.8.113: codex 이미지 실시간 감지
  onAgentImageGenerated: ((listener: (payload: any) => void) => {
    const handler = (_e: unknown, payload: any) => { try { listener(payload); } catch {} };
    ipcRenderer.on('agent-image-generated', handler);
    return () => ipcRenderer.off('agent-image-generated', handler);
  }) as any,

  // v3.8.115: ChatGPT Plus 한도 도달 알림
  onAgentQuotaExceeded: ((listener: (payload: any) => void) => {
    const handler = (_e: unknown, payload: any) => { try { listener(payload); } catch {} };
    ipcRenderer.on('agent-quota-exceeded', handler);
    return () => ipcRenderer.off('agent-quota-exceeded', handler);
  }) as any,

  // 종료 확인
  onQuitConfirm: ((listener: () => void) => {
    const handler = () => { try { listener(); } catch {} };
    ipcRenderer.on('show-quit-confirm', handler);
    return () => ipcRenderer.off('show-quit-confirm', handler);
  }) as any,
  confirmQuit: (() => ipcRenderer.invoke('confirm-quit')) as any,
  
  // 작업 취소
  cancelTask: () => ipcRenderer.send('cancel-task'),

  // 라이선스
  subscribeLicense: () => ipcRenderer.send('license:subscribe'),
  getLicense:  () => ipcRenderer.invoke('get-license'),
  activateLicense: (args) => ipcRenderer.invoke('activate-license', args),
  saveLicense: (data) => ipcRenderer.invoke('save-license', data),
  getAgentModeStatus: () => ipcRenderer.invoke('agent-mode:get-status'),
  listAgentProfiles: () => ipcRenderer.invoke('agent-mode:list-profiles'),
  createAgentProfile: (args) => ipcRenderer.invoke('agent-mode:create-profile', args),
  getAgentLoginCommand: (args) => ipcRenderer.invoke('agent-mode:get-login-command', args),
  installAgentTool: (args) => ipcRenderer.invoke('agent-mode:install-tool', args),
  startAgentLogin: (args) => ipcRenderer.invoke('agent-mode:start-login', args),
  checkAgentLogin: (args) => ipcRenderer.invoke('agent-mode:check-login', args),
  runAgentJob: (args) => ipcRenderer.invoke('agent-mode:run-job', args),

  onLicenseUpdated: (listener) => {
    const handler = (_e: unknown, d: LicenseData) => { try { listener(d); } catch {} };
    ipcRenderer.on('license-updated', handler);
    return () => ipcRenderer.off('license-updated', handler);
  },

  // 로그아웃
  logout: () => ipcRenderer.invoke('license-logout'),

  // ✅ alias (구버전 호환) — 둘 중 하나만 사용
  onLicense: (listener) => {
    const handler = (_e: unknown, d: LicenseData) => { try { listener(d); } catch {} };
    ipcRenderer.on('license-updated', handler);
    return () => ipcRenderer.off('license-updated', handler);
  },

  // ── 관리자 모드 ──
  adminAuth:  (pin: string) => ipcRenderer.invoke('admin-auth', pin),
  setAdminPin:(args) => ipcRenderer.invoke('set-admin-pin', args),

  onAdminMode: (listener) => {
    const handler = (_e: unknown, payload: AdminModePayload) => {
      try { listener(!!payload?.enabled); } catch {}
    };
    ipcRenderer.on('admin-mode', handler);
    return () => ipcRenderer.off('admin-mode', handler);
  },

  onAdminShortcut: (listener) => {
    const handler = () => {
      try { listener(); } catch {}
    };
    ipcRenderer.on('admin-shortcut', handler);
    return () => ipcRenderer.off('admin-shortcut', handler);
  },

  // ── 워드프레스 카테고리 로드 ──
  loadWordPressCategories: (args: { siteUrl: string; username?: string; password?: string; clientId?: string; clientSecret?: string; jwtToken?: string }) => ipcRenderer.invoke('load-wordpress-categories', args),
  loadWpCategories: (args: { wpUrl: string; wpUsername: string; wpPassword: string }) => ipcRenderer.invoke('loadWpCategories', args),

  // ── 썸네일 생성 ──
  makeThumb: (payload: { topic: string; mode?: 'default' | 'cse' | 'pexels' }) => ipcRenderer.invoke('make-thumb', payload),

  // ── 콘텐츠 품질 분석 ──
  analyzeContentQuality: (args) => ipcRenderer.invoke('analyze-content-quality', args),

  // ── 스마트 키워드 생성 ──
  generateSmartKeywords: (args) => ipcRenderer.invoke('generate-smart-keywords', args),

  // ── CTA 클릭 로깅 ──
  logCtaClick: (payload: { role: string; url: string; sectionIndex?: number | string; timestamp: string; postId?: string }) =>
    ipcRenderer.invoke('log-cta-click', payload),

  getSnippetLibrary: () => ipcRenderer.invoke('get-snippet-library'),
  saveSnippetLibrary: (library: SnippetLibraryFile) => ipcRenderer.invoke('save-snippet-library', library),
 
  // ── 트렌드 분석 ──
  analyzeTrends: (args) => ipcRenderer.invoke('analyze-trends', args),

  // ── 워드프레스 연결 테스트 ──
  testWordPressConnection: (args) => ipcRenderer.invoke('test-wordpress-connection', args),
  getWordPressCategories: (args) => ipcRenderer.invoke('get-wordpress-categories', args),
  getWordPressTags: (args) => ipcRenderer.invoke('get-wordpress-tags', args),

  // ── 블로거 인증 ──
  startAuth: (payload) => ipcRenderer.invoke('blogger-start-auth', payload),
  handleCallback: (args) => ipcRenderer.invoke('blogger-handle-callback', args),
  checkAuthStatus: () => ipcRenderer.invoke('blogger-check-auth-status'),
  
  // ── 인증 상태 확인 (메인 프로세스에서 호출용) ──
  checkWordPressAuthStatus: () => ipcRenderer.invoke('wordpress-check-auth-status'),
  
  // ── Google CSE 연동 확인 ──
  testGoogleCseConnection: (args) => ipcRenderer.invoke('test-google-cse-connection', args),

  // ── user-config.json 저장/불러오기 ──
  saveUserConfig: (config) => ipcRenderer.invoke('save-user-config', config),
  getUserConfig: () => ipcRenderer.invoke('get-user-config'),
  
  // ── 외부 브라우저로 링크 열기 ──
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // ── OAuth2 토큰 교환 ──
  fetchToken: (tokenData) => ipcRenderer.invoke('fetch-token', tokenData),
  
  // ── 라이센스 파일 시스템 접근 ──
  readLicenseFile: () => ipcRenderer.invoke('read-license-file'),
  writeLicenseFile: (data) => ipcRenderer.invoke('write-license-file', data),
  
  // ── v3.8.176: AdSense 자동 해결 ──
  adsenseOpenConsole: (payload: any = {}) => ipcRenderer.invoke('adsense:open-console', payload),
  adsenseDiagnose: (payload: any) => ipcRenderer.invoke('adsense:diagnose', payload),
  adsenseCreatePages: (payload: any) => ipcRenderer.invoke('adsense:create-pages', payload),
  adsenseListClickbaitPosts: (payload: any) => ipcRenderer.invoke('adsense:list-clickbait-posts', payload),
  adsenseCleanPostTitles: (payload: any) => ipcRenderer.invoke('adsense:clean-post-titles', payload),
  adsenseAnalyzeContentValue: (payload: any) => ipcRenderer.invoke('adsense:analyze-content-value', payload),
  adsenseBoostPostValue: (payload: any) => ipcRenderer.invoke('adsense:boost-post-value', payload),
  adsenseBulkCleanupPosts: (payload: any) => ipcRenderer.invoke('adsense:bulk-cleanup-posts', payload),
  adsenseListYearlyPosts: (payload: any) => ipcRenderer.invoke('adsense:list-yearly-posts', payload),
  adsenseRefreshYearlyPost: (payload: any) => ipcRenderer.invoke('adsense:refresh-yearly-post', payload),
  adsenseApprovalReadinessCheck: (payload: any) => ipcRenderer.invoke('adsense:approval-readiness-check', payload),
  adsenseInjectSchemaOrg: (payload: any) => ipcRenderer.invoke('adsense:inject-schema-org', payload),
  adsenseCreateAuthorPage: (payload: any) => ipcRenderer.invoke('adsense:create-author-page', payload),

  // ── 플랫폼 연동 확인 ──
  checkPlatformAuth: (platform) => ipcRenderer.invoke('check-platform-auth', platform),
  checkTistorySession: (payload = {}) => ipcRenderer.invoke('tistory-check-session', payload),
  loadTistoryCategories: (payload = {}) => ipcRenderer.invoke('tistory-load-categories', payload),
  openTistoryLogin: (payload = {}) => ipcRenderer.invoke('tistory-open-login', payload),
  
  // ── 세션 관리 (중복 로그인 방지) ──
  sessionValidate: () => ipcRenderer.invoke('session-validate'),
  sessionStartValidation: () => ipcRenderer.invoke('session-start-validation'),
  sessionStopValidation: () => ipcRenderer.invoke('session-stop-validation'),
  onSessionExpired: (callback: (data: { reason: string }) => void) => {
    const handler = (_e: unknown, data: { reason: string }) => {
      try { callback(data); } catch {}
    };
    ipcRenderer.on('session-expired', handler);
    return () => ipcRenderer.off('session-expired', handler);
  },
  testCseConnection: (cseKey, cseCx) => ipcRenderer.invoke('test-cse-connection', { cseKey, cseCx }),
  
  // ── 블로그스팟 OAuth ──
  startBloggerAuth: (payload?: any) => ipcRenderer.invoke('blogger-start-auth', payload),
  handleBloggerCallback: (code) => ipcRenderer.invoke('blogger-handle-callback', { code }),
  /** Blogger OAuth2 인증 */
  bloggerOAuth: (oauthData: { clientId: string; clientSecret: string; redirectUri: string }) => ipcRenderer.invoke('blogger:oauth', oauthData),
  // 🔥 블로그스팟 인증 완료 이벤트 리스너
  onBloggerAuthComplete: (callback: (result: { ok: boolean; error?: string }) => void) => {
    ipcRenderer.on('blogger-auth-complete', (_event, result) => callback(result));
  },
  saveEnvironmentSettings: (settings) => ipcRenderer.invoke('save-environment-settings', settings),
  loadEnvironmentSettings: () => ipcRenderer.invoke('load-environment-settings'),
  
  // ── 워드프레스 연동 ──
  
  // ── 생성된 콘텐츠 발행 ──
  publishContent: (payload, title, content, thumbnailUrl) => ipcRenderer.invoke('publish-content', { payload, title, content, thumbnailUrl }),
  
  
  // ── 백업 관리 ──
  createBackup: () => ipcRenderer.invoke('create-backup') as Promise<{ ok: boolean; success?: boolean; backupPath?: string; error?: string }>,
  restoreBackup: () => ipcRenderer.invoke('restore-backup'),
  
  // ── AI 이미지 생성 ──
  generateAIImage: (args) => ipcRenderer.invoke('generate-ai-image', args),
  crawlProductSnapshot: (args) => ipcRenderer.invoke('crawl-product-snapshot', args),

  // 이미지 라이브러리 관련 코드 제거됨
  saveImageAsPng: (payload) => ipcRenderer.invoke('save-image-as-png', payload),

  // ── LEWORD 외부 앱 런처 ──
  leword: {
    launch: () => ipcRenderer.invoke('leword:launch'),
    getStatus: () => ipcRenderer.invoke('leword:get-status'),
    onProgress: (cb: (p: { phase: string; percent: number; message: string }) => void) => {
      const listener = (_e: any, payload: any) => cb(payload);
      ipcRenderer.on('leword:progress', listener);
      return () => ipcRenderer.removeListener('leword:progress', listener);
    }
  },

  // ── 키워드 마스터 ──
  openKeywordMasterWindow: () => ipcRenderer.invoke('open-keyword-master-window'),
  findGoldenKeywords: (keyword: string, options?: any) => ipcRenderer.invoke('find-golden-keywords', keyword, options),
  stopKeywordDiscovery: (keyword: string) => ipcRenderer.invoke('stop-keyword-discovery', keyword),
  getTrendingKeywords: (source: 'naver' | 'google' | 'youtube') => ipcRenderer.invoke('get-trending-keywords', source),
  getRealtimeKeywords: (options?: { platform?: 'zum' | 'google' | 'nate' | 'daum' | 'all', limit?: number }) => ipcRenderer.invoke('get-realtime-keywords', options),
  checkKeywordRank: (data: { keyword: string; blogUrl: string }) => ipcRenderer.invoke('check-keyword-rank', data),
  analyzeCompetitors: (keyword: string) => ipcRenderer.invoke('analyze-competitors', keyword),
  analyzeFastByDate: (keyword: string, maxResults?: number) => ipcRenderer.invoke('analyze-fast-by-date', keyword, maxResults),
  getSchedules: () => ipcRenderer.invoke('get-schedules'),
  addSchedule: (schedule: any) => ipcRenderer.invoke('add-schedule', schedule),
  toggleSchedule: (id: string, enabled: boolean) => ipcRenderer.invoke('toggle-schedule', id, enabled),
  deleteSchedule: (id: string) => ipcRenderer.invoke('delete-schedule', id),
  getScheduleStatus: () => ipcRenderer.invoke('get-schedule-status'),
  startScheduleMonitoring: () => ipcRenderer.invoke('start-schedule-monitoring'),
  stopScheduleMonitoring: () => ipcRenderer.invoke('stop-schedule-monitoring'),
  cleanupSchedules: (daysToKeep?: number) => ipcRenderer.invoke('cleanup-schedules', daysToKeep),
  getNotifications: () => ipcRenderer.invoke('get-notifications'),
  saveNotificationSettings: (settings: any) => ipcRenderer.invoke('save-notification-settings', settings),
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getKeywordGroups: () => ipcRenderer.invoke('get-keyword-groups'),
  addKeywordGroup: (group: { name: string; color: string }) => ipcRenderer.invoke('add-keyword-group', group),
  updateKeywordGroup: (id: string, updates: any) => ipcRenderer.invoke('update-keyword-group', id, updates),
  deleteKeywordGroup: (id: string) => ipcRenderer.invoke('delete-keyword-group', id),
  getKeywordSchedules: () => ipcRenderer.invoke('get-keyword-schedules'),
  addKeywordSchedule: (scheduleData: any) => ipcRenderer.invoke('add-keyword-schedule', scheduleData),
  toggleKeywordSchedule: (id: string, enabled: boolean) => ipcRenderer.invoke('toggle-keyword-schedule', id, enabled),
  getSNSTrends: (platform: 'youtube') => ipcRenderer.invoke('get-sns-trends', platform),
  huntTimingGold: (category?: string) => ipcRenderer.invoke('hunt-timing-gold', category),
  getYouTubeVideos: (options?: { maxResults?: number }) => ipcRenderer.invoke('get-youtube-videos', options),
  getGoogleTrendKeywords: () => ipcRenderer.invoke('get-google-trend-keywords'),
  
  // 블로그 지수 조회
  extractBlogIndex: (blogIdOrUrl: string, options?: { fastMode?: boolean; enhanced?: boolean }) => ipcRenderer.invoke('extract-blog-index', blogIdOrUrl, options),
  
  // 스마트 블록 연관 키워드 분석
  analyzeSmartBlockKeywords: (keyword: string, maxResults?: number) => ipcRenderer.invoke('analyze-smart-block-keywords', keyword, maxResults),

  // 이미지 프롬프트 생성 (CSP 우회를 위해 main process에서 처리)
  generateImagePrompts: (args: { sections: Array<{ index: number; title: string }>; topic: string; geminiKey: string; openaiKey?: string; claudeKey?: string }) => ipcRenderer.invoke('generate-image-prompts', args),

  // 🖼️ AI 이미지 자동 수집
  collectImagesByTitle: (args) => {
    console.log('[PRELOAD] 🖼️ 제목 기반 이미지 수집 요청');
    return ipcRenderer.invoke('collect-images-by-title', args);
  },
  
  collectImagesFromUrl: (args) => {
    console.log('[PRELOAD] 🛍️ 쇼핑몰 URL 이미지 수집 요청');
    return ipcRenderer.invoke('collect-images-from-url', args);
  },
  
  getImageFolders: () => ipcRenderer.invoke('get-image-folders'),
  getFolderImages: (folderPath) => ipcRenderer.invoke('get-folder-images', folderPath),
  deleteImageFolder: (folderPath) => ipcRenderer.invoke('delete-image-folder', folderPath),

  // 🔥 Blogger OAuth 인증 (환경설정에서 직접 인증)
  authenticateBlogger: (args) => {
    console.log('[PRELOAD] 🔐 Blogger OAuth 인증 요청');
    return ipcRenderer.invoke('authenticate-blogger', args);
  },

  // 🔥 다중 계정 발행
  runMultiAccountPost: (args) => {
    console.log('[PRELOAD] 🚀 다중 계정 발행 요청:', args.platform, args.keyword);
    return ipcRenderer.invoke('run-multi-account-post', args);
  },

  // 🛡️ AdsPower 연동
  adspowerCheckStatus: () => ipcRenderer.invoke('adspower:check-status'),
  adspowerListProfiles: () => ipcRenderer.invoke('adspower:list-profiles'),
  adspowerStartProfile: (profileId: string) => ipcRenderer.invoke('adspower:start-profile', profileId),
  adspowerStopProfile: (profileId: string) => ipcRenderer.invoke('adspower:stop-profile', profileId),
  adspowerCreateProfile: (name: string) => ipcRenderer.invoke('adspower:create-profile', name),
  adspowerDeleteProfile: (ids: string[]) => ipcRenderer.invoke('adspower:delete-profile', ids),
  adspowerAutoInstall: () => ipcRenderer.invoke('adspower:auto-install'),

  // 🔐 ImageFX Google 로그인
  flowCheckLogin: () => ipcRenderer.invoke('flow:check-login'),
  flowLogin: () => ipcRenderer.invoke('flow:login'),
  imagefxCheckLogin: () => ipcRenderer.invoke('imagefx:check-login'),
  imagefxLogin: () => ipcRenderer.invoke('imagefx:login'),

  // ── 쿼터 관리 ──
  getQuotaStatus: () => ipcRenderer.invoke('quota:getStatus'),

  // ── 자동 업데이트 ──
  onAutoUpdate: (listener: (data: any) => void) => {
    const handler = (_e: unknown, data: any) => { try { listener(data); } catch {} };
    ipcRenderer.on('auto-update-event', handler);
    return () => ipcRenderer.off('auto-update-event', handler);
  },
  installUpdate: () => ipcRenderer.invoke('auto-update:install'),

  // ── 앱 정보 ──
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // ── 블로그 진단 & IndexNow ──
  diagnoseBlog: (url: string) => ipcRenderer.invoke('blog:diagnose', url),
  submitIndexNow: (siteUrl: string, urls: string[]) => ipcRenderer.invoke('indexnow:submit', siteUrl, urls),

  // ── URL 이미지 자동 수집 + AI 검증 (cd000242-sudo/naver v2.7.77 이식) ──
  crawlUrlImages: (payload: {
    url: string;
    postTitle: string;
    mainKeyword: string;
    aiCheckEnabled?: boolean;
    textGenerator?: string;
    threshold?: number;
  }) => ipcRenderer.invoke('url-image:crawl-and-collect', payload),
};

// Electron API (개발자 모드 체크 포함)
const electronApi = {
  ...api,
  // IPC 직접 호출 메서드 (모든 IPC 핸들러 호출 가능)
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  // 개발자 모드 확인
  isDeveloperMode: () => ipcRenderer.invoke('is-developer-mode'),
  // 패키징 여부 확인
  isPackaged: async () => {
    try {
      return await ipcRenderer.invoke('is-packaged');
    } catch {
      return false; // 기본값: 개발 모드로 간주
    }
  },
};

contextBridge.exposeInMainWorld('blogger', api);
contextBridge.exposeInMainWorld('electron', electronApi);
// 메인 프로세스에서 호출하는 함수들을 위한 별칭 (isPackaged 및 invoke 포함)
const electronApiForWindow = {
  ...api,
  ...electronApi, // invoke, isDeveloperMode, isPackaged 포함
};
contextBridge.exposeInMainWorld('electronAPI', electronApiForWindow);


// 콘텐츠 변형을 위한 추가 API
contextBridge.exposeInMainWorld('api', {
  envLoad: () => ipcRenderer.invoke('get-env'),
  crawlUrl: (url: string) => ipcRenderer.invoke('crawl-url', url),
  transformContent: (args: any) => ipcRenderer.invoke('transform-content', args),
});

// 전역 선언 (TS에서 안전하게 window.blogger, window.electronAPI 사용)
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
