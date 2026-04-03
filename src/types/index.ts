/**
 * 블로그 자동화 시스템의 핵심 타입 정의
 */

// 크롤링 관련 타입
export interface CrawledItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author?: string;
  content?: string;
  source: 'naver' | 'rss' | 'cse';
  popularityScore?: number;
  fullContent?: {
    html: string;
    text: string;
    images: string[];
    wordCount: number;
  };
}

export interface CrawlingOptions {
  maxResults?: number;
  sort?: 'sim' | 'date';
  includeViews?: boolean;
  dateRestrict?: string;
  siteSearch?: string;
}

// AI 생성 관련 타입
export interface TitleData {
  titles: Array<{
    title: string;
    reason: string;
  }>;
  bestTitle: string;
  seoKeywords: string[];
}

export interface ContentStructure {
  structure: Array<{
    h2: string;
    searchVolume: number;
    subsections: Array<{
      h3: string;
      searchIntent: 'informational' | 'transactional' | 'navigational';
      h4List: string[];
    }>;
  }>;
  totalSections: number;
  estimatedWordCount: number;
}

export interface CTAData {
  ctas: Array<{
    hookingMent: string;
    buttonText: string;
    link: string;
    linkDescription: string;
    position: 'middle' | 'end';
    styling: {
      align: 'center';
      buttonColor: string;
      emphasis: 'bold' | 'italic' | 'normal';
    };
  }>;
}

// 최종 결과 타입
export interface BlogPost {
  html: string;
  title: string;
  metadata: {
    keyword: string;
    crawledSources: number;
    generatedAt: string;
    wordCount: number;
    seoKeywords: string[];
  };
  wordCount: number;
  structure: ContentStructure;
  ctas: CTAData['ctas'];
}

// 파이프라인 옵션
export interface PipelineOptions {
  targetWordCount?: number;
  includeImages?: boolean;
  includeCTA?: boolean;
  maxRetries?: number;
  similarityThreshold?: number;
}

// 크롤러 인터페이스
export interface Crawler {
  crawl(keyword: string, options?: CrawlingOptions): Promise<CrawledItem[]>;
}

// 생성기 인터페이스
export interface Generator<T> {
  generate(input: any): Promise<T>;
}

// 유틸리티 타입
export interface SimilarityResult {
  similarity: number;
  isDuplicate: boolean;
}

export interface PopularityMetrics {
  recency: number;
  titleLength: number;
  descriptionLength: number;
  totalScore: number;
}

// 설정 타입
export interface AppConfig {
  naver: {
    clientId: string;
    clientSecret: string;
  };
  google: {
    apiKey: string;
    cseId: string;
  };
  ai: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
  };
  redis?: {
    url: string;
  };
  crawling: {
    maxConcurrentRequests: number;
    requestDelayMs: number;
    cacheTtlSeconds: number;
  };
  generation: {
    defaultWordCount: number;
    maxRetryAttempts: number;
    similarityThreshold: number;
  };
  output: {
    outputDir: string;
    includeMetadata: boolean;
    generateHtml: boolean;
  };
}

// 에러 타입
export class CrawlingError extends Error {
  constructor(message: string, public source: string) {
    super(message);
    this.name = 'CrawlingError';
  }
}

export class GenerationError extends Error {
  constructor(message: string, public step: string) {
    super(message);
    this.name = 'GenerationError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
