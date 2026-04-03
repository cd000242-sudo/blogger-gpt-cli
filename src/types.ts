// src/types.ts
// 타입 정의 파일

export type Provider = 'openai' | 'gemini' | 'claude' | 'combined' | 'smart' | 'gpt';
export type PublishType = 'draft' | 'now' | 'schedule';
export type ContentType = 'general' | 'naver-seo';
export type Platform = 'blogger' | 'wordpress' | 'preview';
export type PostPlatform = 'wordpress' | 'blogspot';
export type ContentMode = 'external' | 'internal' | 'shopping' | 'adsense' | 'paraphrasing'; // 콘텐츠 모드: 단일 외부링크 vs 내부링크 거미줄치기 vs 쇼핑/구매유도 vs 애드센스 최적화 vs 페러프레이징 (1개 글 완전 새롭게)

export type EnvConfig = {
  provider: Provider;
  openaiKey?: string;
  geminiKey?: string;
  claudeKey?: string;
  pexelsApiKey?: string;
  platform?: Platform;
  // Blogger 설정
  blogId: string;
  googleClientId: string;
  googleClientSecret: string;
  redirectUri: string;
  // WordPress 설정
  wordpressSiteUrl?: string;
  wordpressAuthType?: 'appPassword' | 'oauth' | 'jwt';
  // Application Password 방식
  wordpressUsername?: string;
  wordpressPassword?: string;
  // OAuth 2.0 방식
  wordpressClientId?: string;
  wordpressClientSecret?: string;
  wordpressRedirectUri?: string;
  // JWT 방식
  wordpressJWTToken?: string;
  // 공통 설정
  wordpressCategories?: string[];
  wordpressTags?: string[];
  wordpressStatus?: 'publish' | 'draft' | 'private' | 'pending';
  // 공통 설정
  siteName?: string;
  authorName?: string;
  authorTitle?: string;
  authorExperience?: string;
  authorProfileUrl?: string;
  sitePolicyUrl?: string;
  naverApiKey?: string;
  naverCustomerId?: string;  // 네이버 검색 API Customer ID
  naverSecretKey?: string;   // 네이버 검색 API Secret Key
  googleCseKey?: string;
  googleCseCx?: string;
  linksPosition?: 'top' | 'bottom' | 'both';
  stickyTopRibbon?: boolean;
  thumbWidth?: number;
  thumbHeight?: number;
  brandText?: string;
  thumbInsertMode?: 'auto' | 'none';
  autoThumb?: boolean;
  thumbFromCSE?: boolean;
  thumbnailMode?: 'default' | 'cse' | 'pexels' | 'dalle' | 'text' | 'none';
};

export type OfficialLink = {
  title: string;
  url: string;
  site?: string;
};

export type CustomCta = {
  url: string;
  title?: string;
  description?: string;
};

export type KeywordData = {
  keyword: string;
  title?: string;
  scheduleTime?: string | null;
  thumbnailType?: string;
  imageType?: string;
};

export type BulkScheduleSettings = {
  mode: 'none' | 'interval' | 'custom';
  firstScheduleTime?: string | null;
  intervalMinutes?: number;
};

export type ContentStructure = 'default' | 'high-traffic';

export type PostPayload = EnvConfig & {
  topic: string;
  keywords: string | string[] | KeywordData[]; // 단일 키워드, 키워드 배열, 또는 키워드 데이터 배열 지원
  publishType: PublishType;
  scheduleISO?: string;
  schedule?: string; // YYYY-MM-DD HH:MM 형식의 예약 시간
  minChars: number;
  maxChars?: number;
  sectionCount?: number; // 소제목 개수
  authorNickname?: string; // 작성자 닉네임
  // 이미지 설정
  imageMode?: 'thumbnail' | 'full';
  thumbnailUrl?: string;
  thumbnailMode?: 'default' | 'cse' | 'pexels' | 'dalle' | 'text' | 'none';
  // 플랫폼 설정 (스킨 적용용)
  postPlatform?: PostPlatform;
  sectionImageMode?: 'default' | 'cse' | 'pexels' | 'dalle' | 'none';
  // CTA 설정
  ctaMode?: 'none' | 'auto' | 'custom';
  customCtaUrl?: string;
  customCtaText?: string;
  contentType?: ContentType;
  targetPlatform?: 'naver' | 'google';
  excerpt?: string;
  // 프롬프트 설정
  promptMode?: 'default' | 'custom';
  customPrompt?: string;
  // 글 구조 설정
  contentStructure?: ContentStructure; // 기본 구조 또는 조회수 높은 구조
  // 검색 설정
  useGoogleSearch?: boolean;
  // WordPress 설정
  wordpressCategory?: string;
  wordpressStatus?: string;
  officialLinks?: OfficialLink[];
  // 커스텀 CTA 설정
  customCta?: CustomCta | null;
  customCtas?: CustomCta[]; // 다중 CTA 지원
  // 대량 포스팅 예약 설정
  bulkScheduleSettings?: BulkScheduleSettings;
  // 미리보기 전용 모드 (발행하지 않음)
  previewOnly?: boolean;
  // 콘텐츠 모드 (외부링크 vs 내부링크)
  contentMode?: ContentMode;
  // 수동 크롤링 링크 (쿠팡, 쇼핑 등 제품 링크)
  manualCrawlUrls?: string[];
  // 🎨 하이브리드 AI 설정
  titleAI?: string; // 제목 생성 AI 모델
  summaryAI?: string; // 요약표 생성 AI 모델
  // 🔄 페러프레이징 모드
  paraphraseUrl?: string; // 페러프레이징할 원본 글 URL
};

export type RunOk = { 
  ok: true; 
  logs?: string; 
  url?: string; 
  id?: string;
  title?: string;
  content?: string; // 생성된 HTML 콘텐츠 (미리보기용)
  html?: string; // 생성된 HTML 콘텐츠 (미리보기용, content와 동일)
  thumbnailUrl?: string; // 썸네일 URL (미리보기용)
  // 배치 처리 결과용
  successCount?: number;
  failCount?: number;
  results?: any[];
  bulkResults?: RunResult[]; // 대량 포스팅 결과
};
export type RunFail = { ok: false; exitCode: number; logs?: string; error?: string; title?: string };
export type RunResult = RunOk | RunFail;
export type LogSink = (line: string) => void;

export interface QualityMetrics {
  readabilityScore: number;
  valueScore: number;
  originalityScore: number;
  expertiseScore: number;
  uniquenessScore: number;
  independenceScore: number;
  overallScore: number;
  issues: string[];
}

export interface ThumbTheme {
  primary: string;
  secondary: string;
  accent: string;
}

export interface FoundLink {
  title: string;
  url: string;
  snippet: string;
}

export interface WordPressConfig {
  siteUrl: string;
  // OAuth 2.0 방식
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  // Application Password 방식 (기존)
  username?: string;
  password?: string; // Application Password
  // JWT 방식
  jwtToken?: string;
  apiVersion?: string;
  // 카테고리 설정 추가
  categories?: string[];
  tags?: string[];
  status?: string;
}
