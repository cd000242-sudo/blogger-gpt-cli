/**
 * 통합 환경변수 관리자
 * 모든 환경변수 로드 로직을 하나로 통합하여 중복 제거
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface UnifiedEnvConfig {
  // AI API Keys
  openaiApiKey: string;
  geminiApiKey: string;
  claudeApiKey: string;
  
  // Naver API Keys
  naverClientId: string;
  naverClientSecret: string;
  
  // Google API Keys
  googleApiKey: string;
  googleCseId: string;
  googleClientId: string;
  googleClientSecret: string;
  
  // Blog Settings
  blogId: string;
  wordpressSiteUrl: string;
  wordpressUsername: string;
  wordpressPassword: string;
  
  // Image API Keys
  pexelsApiKey: string;
  
  // App Settings
  minChars: number;
  platform: string;
  massCrawlingEnabled: boolean;
  maxConcurrentRequests: number;
  maxResultsPerSource: number;
  enableFullContentCrawling: boolean;
  
  // Performance Settings
  crawlingTimeout: number;
  rssFeedTimeout: number;
  naverApiTimeout: number;
  cseApiTimeout: number;
  
  // Cache Settings
  enableCaching: boolean;
  cacheExpirySeconds: number;
  cacheMaxSize: number;
  
  // Puppeteer Settings
  puppeteerHeadless: boolean;
  puppeteerTimeout: number;
  
  // Logging Settings
  logLevel: string;
  logFile: string;
  enablePerformanceMonitoring: boolean;
  enableDetailedLogging: boolean;
  
  // Performance Settings
  performanceMonitoring: boolean;
  memoryLimitMb: number;
}

export class UnifiedEnvManager {
  private static instance: UnifiedEnvManager;
  private config: UnifiedEnvConfig | null = null;
  private configPath: string;
  
  private constructor() {
    // 사용자 데이터 폴더에 .env 파일 저장
    this.configPath = path.join(app.getPath('userData'), '.env');
  }
  
  static getInstance(): UnifiedEnvManager {
    if (!UnifiedEnvManager.instance) {
      UnifiedEnvManager.instance = new UnifiedEnvManager();
    }
    return UnifiedEnvManager.instance;
  }
  
  /**
   * 환경변수 로드 (통합 버전)
   */
  async loadConfig(): Promise<UnifiedEnvConfig> {
    if (this.config) {
      return this.config;
    }
    
    try {
      console.log('[ENV] 통합 환경변수 로드 시작');
      
      // 1. 기본값 설정
      const defaultConfig: UnifiedEnvConfig = {
        openaiApiKey: '',
        geminiApiKey: '',
        claudeApiKey: '',
        naverClientId: '',
        naverClientSecret: '',
        googleApiKey: '',
        googleCseId: '',
        googleClientId: '',
        googleClientSecret: '',
        blogId: '',
        wordpressSiteUrl: '',
        wordpressUsername: '',
        wordpressPassword: '',
        pexelsApiKey: '',
        minChars: 2000,
        platform: 'wordpress',
        massCrawlingEnabled: true,
        maxConcurrentRequests: 20,
        maxResultsPerSource: 1000,
        enableFullContentCrawling: true,
        crawlingTimeout: 30000,
        rssFeedTimeout: 10000,
        naverApiTimeout: 10000,
        cseApiTimeout: 10000,
        enableCaching: true,
        cacheExpirySeconds: 3600,
        cacheMaxSize: 1000,
        puppeteerHeadless: true,
        puppeteerTimeout: 30000,
        logLevel: 'info',
        logFile: 'logs/crawler.log',
        enablePerformanceMonitoring: true,
        enableDetailedLogging: true,
        performanceMonitoring: true,
        memoryLimitMb: 1024
      };
      
      // 2. .env 파일에서 로드
      let fileConfig: Partial<UnifiedEnvConfig> = {};
      if (fs.existsSync(this.configPath)) {
        try {
          const envContent = fs.readFileSync(this.configPath, 'utf8');
          fileConfig = this.parseEnvFile(envContent);
          console.log('[ENV] .env 파일에서 로드 완료');
        } catch (error) {
          console.warn('[ENV] .env 파일 읽기 실패:', error);
        }
      } else {
        console.log('[ENV] .env 파일이 없음, 기본 템플릿 생성');
        await this.createDefaultEnvFile();
      }
      
      // 3. process.env에서 로드
      const processConfig: Partial<UnifiedEnvConfig> = {
        openaiApiKey: process.env['OPENAI_API_KEY'] || '',
        geminiApiKey: process.env['GEMINI_API_KEY'] || '',
        claudeApiKey: process.env['CLAUDE_API_KEY'] || '',
        naverClientId: process.env['NAVER_CLIENT_ID'] || '',
        naverClientSecret: process.env['NAVER_CLIENT_SECRET'] || '',
        googleApiKey: process.env['GOOGLE_API_KEY'] || '',
        googleCseId: process.env['GOOGLE_CSE_ID'] || '',
        googleClientId: process.env['GOOGLE_CLIENT_ID'] || '',
        googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] || '',
        blogId: process.env['BLOG_ID'] || '',
        wordpressSiteUrl: process.env['WORDPRESS_SITE_URL'] || '',
        wordpressUsername: process.env['WORDPRESS_USERNAME'] || '',
        wordpressPassword: process.env['WORDPRESS_PASSWORD'] || '',
        pexelsApiKey: process.env['PEXELS_API_KEY'] || '',
        minChars: parseInt(process.env['MIN_CHARS'] || '2000'),
        platform: (process.env['PLATFORM'] || 'wordpress') as 'blogger' | 'wordpress',
        massCrawlingEnabled: process.env['MASS_CRAWLING_ENABLED'] !== 'false',
        maxConcurrentRequests: parseInt(process.env['MAX_CONCURRENT_REQUESTS'] || '20'),
        maxResultsPerSource: parseInt(process.env['MAX_RESULTS_PER_SOURCE'] || '1000'),
        enableFullContentCrawling: process.env['ENABLE_FULL_CONTENT_CRAWLING'] !== 'false',
        crawlingTimeout: parseInt(process.env['CRAWLING_TIMEOUT'] || '30000'),
        rssFeedTimeout: parseInt(process.env['RSS_FEED_TIMEOUT'] || '10000'),
        naverApiTimeout: parseInt(process.env['NAVER_API_TIMEOUT'] || '10000'),
        cseApiTimeout: parseInt(process.env['CSE_API_TIMEOUT'] || '10000'),
        enableCaching: process.env['ENABLE_CACHING'] !== 'false',
        cacheExpirySeconds: parseInt(process.env['CACHE_EXPIRY_SECONDS'] || '3600'),
        cacheMaxSize: parseInt(process.env['CACHE_MAX_SIZE'] || '1000'),
        puppeteerHeadless: process.env['PUPPETEER_HEADLESS'] !== 'false',
        puppeteerTimeout: parseInt(process.env['PUPPETEER_TIMEOUT'] || '30000'),
        logLevel: process.env['LOG_LEVEL'] || 'info',
        logFile: process.env['LOG_FILE'] || 'logs/crawler.log',
        enablePerformanceMonitoring: process.env['ENABLE_PERFORMANCE_MONITORING'] !== 'false',
        enableDetailedLogging: process.env['ENABLE_DETAILED_LOGGING'] !== 'false',
        performanceMonitoring: process.env['PERFORMANCE_MONITORING'] !== 'false',
        memoryLimitMb: parseInt(process.env['MEMORY_LIMIT_MB'] || '1024')
      };
      
      // 4. 우선순위: 파일 > process.env > 기본값
      this.config = {
        ...defaultConfig,
        ...processConfig,
        ...fileConfig
      };
      
      console.log('[ENV] 통합 환경변수 로드 완료');
      return this.config;
      
    } catch (error) {
      console.error('[ENV] 환경변수 로드 실패:', error);
      throw error;
    }
  }
  
  /**
   * .env 파일 파싱
   */
  private parseEnvFile(content: string): Partial<UnifiedEnvConfig> {
    const config: Partial<UnifiedEnvConfig> = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          
          // 키 매핑
          switch (key.trim()) {
            case 'OPENAI_API_KEY':
              config.openaiApiKey = value;
              break;
            case 'GEMINI_API_KEY':
              config.geminiApiKey = value;
              break;
            case 'CLAUDE_API_KEY':
              config.claudeApiKey = value;
              break;
            case 'NAVER_CLIENT_ID':
              config.naverClientId = value;
              break;
            case 'NAVER_CLIENT_SECRET':
              config.naverClientSecret = value;
              break;
            case 'GOOGLE_API_KEY':
              config.googleApiKey = value;
              break;
            case 'GOOGLE_CSE_ID':
              config.googleCseId = value;
              break;
            case 'GOOGLE_CLIENT_ID':
              config.googleClientId = value;
              break;
            case 'GOOGLE_CLIENT_SECRET':
              config.googleClientSecret = value;
              break;
            case 'BLOG_ID':
              config.blogId = value;
              break;
            case 'WORDPRESS_SITE_URL':
              config.wordpressSiteUrl = value;
              break;
            case 'WORDPRESS_USERNAME':
              config.wordpressUsername = value;
              break;
            case 'WORDPRESS_PASSWORD':
              config.wordpressPassword = value;
              break;
            case 'PEXELS_API_KEY':
              config.pexelsApiKey = value;
              break;
            case 'MIN_CHARS':
              config.minChars = parseInt(value) || 2000;
              break;
            case 'PLATFORM':
              config.platform = value;
              break;
            case 'MASS_CRAWLING_ENABLED':
              config.massCrawlingEnabled = value.toLowerCase() !== 'false';
              break;
            case 'MAX_CONCURRENT_REQUESTS':
              config.maxConcurrentRequests = parseInt(value) || 20;
              break;
            case 'MAX_RESULTS_PER_SOURCE':
              config.maxResultsPerSource = parseInt(value) || 1000;
              break;
            case 'ENABLE_FULL_CONTENT_CRAWLING':
              config.enableFullContentCrawling = value.toLowerCase() !== 'false';
              break;
            case 'CRAWLING_TIMEOUT':
              config.crawlingTimeout = parseInt(value) || 30000;
              break;
            case 'RSS_FEED_TIMEOUT':
              config.rssFeedTimeout = parseInt(value) || 10000;
              break;
            case 'NAVER_API_TIMEOUT':
              config.naverApiTimeout = parseInt(value) || 10000;
              break;
            case 'CSE_API_TIMEOUT':
              config.cseApiTimeout = parseInt(value) || 10000;
              break;
            case 'ENABLE_CACHING':
              config.enableCaching = value.toLowerCase() !== 'false';
              break;
            case 'CACHE_EXPIRY_SECONDS':
              config.cacheExpirySeconds = parseInt(value) || 3600;
              break;
            case 'CACHE_MAX_SIZE':
              config.cacheMaxSize = parseInt(value) || 1000;
              break;
            case 'PUPPETEER_HEADLESS':
              config.puppeteerHeadless = value.toLowerCase() !== 'false';
              break;
            case 'PUPPETEER_TIMEOUT':
              config.puppeteerTimeout = parseInt(value) || 30000;
              break;
            case 'LOG_LEVEL':
              config.logLevel = value;
              break;
            case 'LOG_FILE':
              config.logFile = value;
              break;
            case 'ENABLE_PERFORMANCE_MONITORING':
              config.enablePerformanceMonitoring = value.toLowerCase() !== 'false';
              break;
            case 'ENABLE_DETAILED_LOGGING':
              config.enableDetailedLogging = value.toLowerCase() !== 'false';
              break;
            case 'PERFORMANCE_MONITORING':
              config.performanceMonitoring = value.toLowerCase() !== 'false';
              break;
            case 'MEMORY_LIMIT_MB':
              config.memoryLimitMb = parseInt(value) || 1024;
              break;
          }
        }
      }
    }
    
    return config;
  }
  
  /**
   * 기본 .env 파일 생성
   */
  private async createDefaultEnvFile(): Promise<void> {
    const defaultContent = `# LEADERNAM Orbit 환경 설정

# AI API Keys
OPENAI_API_KEY=
GEMINI_API_KEY=
CLAUDE_API_KEY=

# Naver API Keys
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=

# Google API Keys
GOOGLE_API_KEY=
GOOGLE_CSE_ID=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Blog Settings
BLOG_ID=
WORDPRESS_SITE_URL=
WORDPRESS_USERNAME=
WORDPRESS_PASSWORD=

# Image API Keys
PEXELS_API_KEY=

# App Settings
MIN_CHARS=2000
PLATFORM=wordpress
MASS_CRAWLING_ENABLED=true
MAX_CONCURRENT_REQUESTS=20
MAX_RESULTS_PER_SOURCE=1000
ENABLE_FULL_CONTENT_CRAWLING=true

# Performance Settings
CRAWLING_TIMEOUT=30000
RSS_FEED_TIMEOUT=10000
NAVER_API_TIMEOUT=10000
CSE_API_TIMEOUT=10000

# Cache Settings
ENABLE_CACHING=true
CACHE_EXPIRY_SECONDS=3600
CACHE_MAX_SIZE=1000

# Puppeteer Settings
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=30000

# Logging Settings
LOG_LEVEL=info
LOG_FILE=logs/crawler.log
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_DETAILED_LOGGING=true

# Performance Settings
PERFORMANCE_MONITORING=true
MEMORY_LIMIT_MB=1024
`;
    
    try {
      fs.writeFileSync(this.configPath, defaultContent, 'utf8');
      console.log('[ENV] 기본 .env 파일 생성 완료');
    } catch (error) {
      console.error('[ENV] 기본 .env 파일 생성 실패:', error);
    }
  }
  
  /**
   * 설정 저장 (검증 포함)
   */
  async saveConfig(config: Partial<UnifiedEnvConfig>): Promise<{ success: boolean; error?: string; errors?: Array<{ field: string; message: string; fixHint: string }> }> {
    try {
      // 환경설정 검증
      const { EnvValidator } = await import('../utils/env-validator');
      const validation = EnvValidator.validateEnvConfig(config as any);
      
      if (!validation.isValid) {
        const errorMessage = EnvValidator.formatErrors(validation.errors);
        return {
          success: false,
          error: errorMessage,
          errors: validation.errors
        };
      }

      if (!this.config) {
        await this.loadConfig();
      }
      
      // 기존 설정과 병합
      this.config = { ...this.config!, ...config };
      
      // .env 파일로 저장
      const envContent = this.generateEnvContent(this.config);
      fs.writeFileSync(this.configPath, envContent, 'utf8');
      
      console.log('[ENV] 설정 저장 완료');
      return { success: true };
    } catch (error: any) {
      console.error('[ENV] 설정 저장 실패:', error);
      
      // 파일 시스템 오류 처리
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: '❌ 파일 쓰기 권한이 없습니다.\n\n💡 해결 방법: 관리자 권한으로 실행하거나 파일 권한을 확인해주세요.'
        };
      }
      
      if (error.code === 'ENOENT') {
        return {
          success: false,
          error: '❌ 설정 파일 경로를 찾을 수 없습니다.\n\n💡 해결 방법: 앱을 재시작해주세요.'
        };
      }
      
      return {
        success: false,
        error: `❌ 설정 저장 중 오류가 발생했습니다.\n\n💡 오류 내용: ${error.message || String(error)}`
      };
    }
  }
  
  /**
   * .env 파일 내용 생성
   */
  private generateEnvContent(config: UnifiedEnvConfig): string {
  return `# LEADERNAM Orbit 환경 설정

# AI API Keys
OPENAI_API_KEY=${config.openaiApiKey}
GEMINI_API_KEY=${config.geminiApiKey}
CLAUDE_API_KEY=${config.claudeApiKey}

# Naver API Keys
NAVER_CLIENT_ID=${config.naverClientId}
NAVER_CLIENT_SECRET=${config.naverClientSecret}

# Google API Keys
GOOGLE_API_KEY=${config.googleApiKey}
GOOGLE_CSE_ID=${config.googleCseId}
GOOGLE_CLIENT_ID=${config.googleClientId}
GOOGLE_CLIENT_SECRET=${config.googleClientSecret}

# Blog Settings
BLOG_ID=${config.blogId}
WORDPRESS_SITE_URL=${config.wordpressSiteUrl}
WORDPRESS_USERNAME=${config.wordpressUsername}
WORDPRESS_PASSWORD=${config.wordpressPassword}

# Image API Keys
PEXELS_API_KEY=${config.pexelsApiKey}

# App Settings
MIN_CHARS=${config.minChars}
PLATFORM=${config.platform}
MASS_CRAWLING_ENABLED=${config.massCrawlingEnabled}
MAX_CONCURRENT_REQUESTS=${config.maxConcurrentRequests}
MAX_RESULTS_PER_SOURCE=${config.maxResultsPerSource}
ENABLE_FULL_CONTENT_CRAWLING=${config.enableFullContentCrawling}

# Performance Settings
CRAWLING_TIMEOUT=${config.crawlingTimeout}
RSS_FEED_TIMEOUT=${config.rssFeedTimeout}
NAVER_API_TIMEOUT=${config.naverApiTimeout}
CSE_API_TIMEOUT=${config.cseApiTimeout}

# Cache Settings
ENABLE_CACHING=${config.enableCaching}
CACHE_EXPIRY_SECONDS=${config.cacheExpirySeconds}
CACHE_MAX_SIZE=${config.cacheMaxSize}

# Puppeteer Settings
PUPPETEER_HEADLESS=${config.puppeteerHeadless}
PUPPETEER_TIMEOUT=${config.puppeteerTimeout}

# Logging Settings
LOG_LEVEL=${config.logLevel}
LOG_FILE=${config.logFile}
ENABLE_PERFORMANCE_MONITORING=${config.enablePerformanceMonitoring}
ENABLE_DETAILED_LOGGING=${config.enableDetailedLogging}

# Performance Settings
PERFORMANCE_MONITORING=${config.performanceMonitoring}
MEMORY_LIMIT_MB=${config.memoryLimitMb}
`;
  }
  
  /**
   * 설정 가져오기
   */
  getConfig(): UnifiedEnvConfig | null {
    return this.config;
  }
  
  /**
   * 특정 키 값 가져오기
   */
  getValue<K extends keyof UnifiedEnvConfig>(key: K): UnifiedEnvConfig[K] | undefined {
    return this.config?.[key];
  }
  
  /**
   * 설정 초기화
   */
  reset(): void {
    this.config = null;
  }
}
