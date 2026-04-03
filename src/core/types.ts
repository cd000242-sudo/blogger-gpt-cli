/* ---------------------------------------------
 * 타입 정의
 * --------------------------------------------- */

export interface RunOnePostPayload {
  topic: string;
  keywords: string | string[];
  minChars?: number;
  provider?: 'openai' | 'gemini';
  openaiKey?: string;
  geminiKey?: string;
  contentMode?: string;
  manualCtas?: Record<string, { url: string; text: string; hook?: string }>;
  platform?: 'blogger' | 'wordpress' | 'preview';
  googleCseKey?: string;
  googleCseCx?: string;
  naverClientId?: string;      // 네이버 API 키워드 발굴 및 크롤링용
  naverClientSecret?: string;  // 네이버 API 키워드 발굴 및 크롤링용
  previewOnly?: boolean;        // 미리보기 전용 모드
  customThumbnail?: string;     // 사용자 지정 썸네일 URL
  postingMode?: string;         // 발행 모드 (immediate, draft, schedule)
  wordpressCategories?: string; // WordPress 카테고리 (쉼표 구분)
  wordpressSiteUrl?: string;    // WordPress 사이트 URL
  wordpressUsername?: string;   // WordPress 사용자명
  wordpressPassword?: string;   // WordPress 비밀번호
  blogId?: string;              // Blogger 블로그 ID
  googleClientId?: string;      // Google OAuth Client ID
  googleClientSecret?: string;  // Google OAuth Client Secret
  toneStyle?: string;
  draftContent?: string;
  h2Images?: {
    source: string;
    sections: number[];
    totalSections?: number;
  };
  productImages?: string[];   // 크롤러에서 수집한 상품 이미지 URL 배열
  h2ImageSource?: string;     // 'nanobananapro' | 'crawled' | 'crawled-ai-nanobananapro' | 'crawled-ai-nanobanana2'
}

export interface MaxModeSection {
  id: string;
  title: string;
  description: string;
  minChars: number;
  role: string;
  contentFocus: string;
  requiredElements: string[];
}

export interface ContentModeConfig {
  name: string;
  description: string;
  tone: string;
  ctaStrategy: string;
}

export interface GeneratedContent {
  title: string;
  html: string;
  metaDescription?: string;
  featuredImageAlt?: string;
  internalLinks?: string[];
  socialShareText?: string;
  labels?: string[];
  description?: string;
  keywords?: string;
}

export type ResearchSource =
  | 'crawl'
  | 'naver-search'
  | 'search-ad'
  | 'ai-fallback'
  | 'manual';

export type CtaRole = 'information' | 'application' | 'support';

export interface ResearchDatum {
  id: string;
  title: string;
  summary: string;
  content: string;
  url?: string;
  source: ResearchSource;
  platform?: string;
  capturedAt?: string;
  confidence: number;
  metadata?: Record<string, any>;
}
