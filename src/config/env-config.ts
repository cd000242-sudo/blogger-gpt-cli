/**
 * 환경변수 설정 및 검증
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger';

// .env 파일 로드
dotenv.config();

export interface EnvConfig {
  // 네이버 API
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
  
  // Google API
  GOOGLE_API_KEY: string;
  GOOGLE_CSE_ID: string;
  
  // Redis 설정
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  
  // 크롤링 설정
  CRAWL_TIMEOUT: number;
  CRAWL_CONCURRENCY: number;
  CRAWL_MAX_RESULTS: number;
  
  // Puppeteer 설정
  PUPPETEER_HEADLESS: boolean;
  PUPPETEER_TIMEOUT: number;
  
  // 로깅 설정
  LOG_LEVEL: string;
  LOG_FILE: string;
  
  // 성능 설정
  PERFORMANCE_MONITORING: boolean;
  MEMORY_LIMIT_MB: number;
}

class EnvConfigManager {
  private config: EnvConfig;
  private isValid: boolean = false;

  constructor() {
    this.config = this.loadConfig();
    this.isValid = this.validateConfig();
    
    if (!this.isValid) {
      logger.error('환경변수 설정이 올바르지 않습니다. .env 파일을 확인하세요.');
    } else {
      logger.info('환경변수 설정 완료');
    }
  }

  private loadConfig(): EnvConfig {
    const password = process.env['REDIS_PASSWORD'];
    const config: EnvConfig = {
      // 네이버 API
      NAVER_CLIENT_ID: process.env['NAVER_CLIENT_ID'] || '',
      NAVER_CLIENT_SECRET: process.env['NAVER_CLIENT_SECRET'] || '',
      
      // Google API
      GOOGLE_API_KEY: process.env['GOOGLE_API_KEY'] || '',
      GOOGLE_CSE_ID: process.env['GOOGLE_CSE_ID'] || '',
      
      // Redis 설정
      REDIS_HOST: process.env['REDIS_HOST'] || 'localhost',
      REDIS_PORT: parseInt(process.env['REDIS_PORT'] || '6379'),
      
      // 크롤링 설정
      CRAWL_TIMEOUT: parseInt(process.env['CRAWL_TIMEOUT'] || '30000'),
      CRAWL_CONCURRENCY: parseInt(process.env['CRAWL_CONCURRENCY'] || '50'),
      CRAWL_MAX_RESULTS: parseInt(process.env['CRAWL_MAX_RESULTS'] || '1000'),
      
      // Puppeteer 설정
      PUPPETEER_HEADLESS: process.env['PUPPETEER_HEADLESS'] !== 'false',
      PUPPETEER_TIMEOUT: parseInt(process.env['PUPPETEER_TIMEOUT'] || '30000'),
      
      // 로깅 설정
      LOG_LEVEL: process.env['LOG_LEVEL'] || 'info',
      LOG_FILE: process.env['LOG_FILE'] || 'logs/crawler.log',
      
      // 성능 설정
      PERFORMANCE_MONITORING: process.env['PERFORMANCE_MONITORING'] !== 'false',
      MEMORY_LIMIT_MB: parseInt(process.env['MEMORY_LIMIT_MB'] || '1024')
    };
    if (password) {
      config.REDIS_PASSWORD = password;
    }
    return config;
  }

  private validateConfig(): boolean {
    const errors: string[] = [];

    // 필수 API 키 검증
    if (!this.config.NAVER_CLIENT_ID) {
      errors.push('NAVER_CLIENT_ID가 설정되지 않았습니다.');
    }
    if (!this.config.NAVER_CLIENT_SECRET) {
      errors.push('NAVER_CLIENT_SECRET이 설정되지 않았습니다.');
    }
    if (!this.config.GOOGLE_API_KEY) {
      errors.push('GOOGLE_API_KEY가 설정되지 않았습니다.');
    }
    if (!this.config.GOOGLE_CSE_ID) {
      errors.push('GOOGLE_CSE_ID가 설정되지 않았습니다.');
    }

    // 숫자 값 검증
    if (this.config.REDIS_PORT < 1 || this.config.REDIS_PORT > 65535) {
      errors.push('REDIS_PORT는 1-65535 범위여야 합니다.');
    }
    if (this.config.CRAWL_TIMEOUT < 1000) {
      errors.push('CRAWL_TIMEOUT은 최소 1000ms여야 합니다.');
    }
    if (this.config.CRAWL_CONCURRENCY < 1 || this.config.CRAWL_CONCURRENCY > 100) {
      errors.push('CRAWL_CONCURRENCY는 1-100 범위여야 합니다.');
    }
    if (this.config.CRAWL_MAX_RESULTS < 1) {
      errors.push('CRAWL_MAX_RESULTS는 최소 1이어야 합니다.');
    }

    // 로그 레벨 검증
    const validLogLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLogLevels.includes(this.config.LOG_LEVEL)) {
      errors.push(`LOG_LEVEL은 ${validLogLevels.join(', ')} 중 하나여야 합니다.`);
    }

    if (errors.length > 0) {
      logger.error('환경변수 검증 실패:');
      errors.forEach(error => logger.error(`  - ${error}`));
      return false;
    }

    return true;
  }

  getConfig(): EnvConfig {
    if (!this.isValid) {
      throw new Error('환경변수가 올바르게 설정되지 않았습니다.');
    }
    return { ...this.config };
  }

  isConfigValid(): boolean {
    return this.isValid;
  }

  getApiKeys(): {
    naver: { clientId: string; clientSecret: string };
    google: { apiKey: string; cseId: string };
  } {
    return {
      naver: {
        clientId: this.config.NAVER_CLIENT_ID,
        clientSecret: this.config.NAVER_CLIENT_SECRET
      },
      google: {
        apiKey: this.config.GOOGLE_API_KEY,
        cseId: this.config.GOOGLE_CSE_ID
      }
    };
  }

  getRedisConfig(): {
    host: string;
    port: number;
    password?: string;
  } {
    const result: { host: string; port: number; password?: string } = {
      host: this.config.REDIS_HOST,
      port: this.config.REDIS_PORT
    };
    if (this.config.REDIS_PASSWORD) {
      result.password = this.config.REDIS_PASSWORD;
    }
    return result;
  }

  getCrawlConfig(): {
    timeout: number;
    concurrency: number;
    maxResults: number;
  } {
    return {
      timeout: this.config.CRAWL_TIMEOUT,
      concurrency: this.config.CRAWL_CONCURRENCY,
      maxResults: this.config.CRAWL_MAX_RESULTS
    };
  }

  getPuppeteerConfig(): {
    headless: boolean;
    timeout: number;
  } {
    return {
      headless: this.config.PUPPETEER_HEADLESS,
      timeout: this.config.PUPPETEER_TIMEOUT
    };
  }
}

// 싱글톤 인스턴스
export const envConfig = new EnvConfigManager();

// 편의 함수들
export const getConfig = () => envConfig.getConfig();
export const isConfigValid = () => envConfig.isConfigValid();
export const getApiKeys = () => envConfig.getApiKeys();
export const getRedisConfig = () => envConfig.getRedisConfig();
export const getCrawlConfig = () => envConfig.getCrawlConfig();
export const getPuppeteerConfig = () => envConfig.getPuppeteerConfig();
