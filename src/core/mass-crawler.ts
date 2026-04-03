/**
 * 대량 크롤링 시스템 - 기존 시스템의 고성능 버전
 * 네이버 API + RSS + Google CSE로 수천 개 데이터 수집
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { downloadMultipleImages } from '../utils/image-downloader';
import { writeSnippetLibrary, readSnippetLibrary } from '../utils/snippet-library';
import { createStealthBrowser, loadPageWithStealth, setupStealthPage, randomDelay } from '../utils/stealth-browser';
import PQueue from 'p-queue';
import pLimit from 'p-limit';

// 성능 모니터링을 위한 유틸리티
class PerformanceMonitor {
  private metrics: Map<string, { startTime: number; endTime?: number; duration?: number }> = new Map();

  startMeasurement(name: string): void {
    this.metrics.set(name, { startTime: Date.now() });
  }

  endMeasurement(name: string, _metadata?: any): void {
    const metric = this.metrics.get(name);
    if (metric) {
      metric.endTime = Date.now();
      metric.duration = metric.endTime - metric.startTime;
      console.log(`[PERFORMANCE] ${name}: ${metric.duration}ms`);
    }
  }

  getMetric(name: string): { duration: number } | undefined {
    const metric = this.metrics.get(name);
    return metric?.duration ? { duration: metric.duration } : undefined;
  }

  printReport(): void {
    console.log('\n📊 성능 리포트:');
    this.metrics.forEach((metric, name) => {
      if (metric.duration) {
        console.log(`  ${name}: ${metric.duration}ms`);
      }
    });
  }
}

// 로거 클래스
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string): void {
    console.log(`[${this.context}] ℹ️ ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.context}] ⚠️ ${message}`);
  }

  error(message: string, error?: any): void {
    console.error(`[${this.context}] ❌ ${message}`, error);
  }

  success(message: string): void {
    console.log(`[${this.context}] ✅ ${message}`);
  }
}

// 타입 정의
export interface MassCrawledItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  author?: string;
  content?: string;
  source: 'naver' | 'rss' | 'cse' | 'manual';
  popularityScore: number;
  fullContent?: {
    html: string;
    text: string;
    images: string[];
    wordCount: number;
  };
  productData?: {
    title: string;
    description: string;
    text: string;
    price?: string;
    images?: string[];
    localImagePaths?: string[]; // 로컬에 저장된 이미지 경로
  };
}

export interface MassCrawlingOptions {
  maxResults?: number;
  sort?: 'sim' | 'date';
  includeViews?: boolean;
  dateRestrict?: string;
  siteSearch?: string;
  enableFullContent?: boolean;
  maxConcurrent?: number;
  manualUrls?: string[]; // 수동 크롤링 링크
  topic?: string; // AI 제목 생성용 주제
  keywords?: string[]; // AI 제목 생성용 키워드
  geminiKey?: string; // AI 제목 생성용 Gemini API 키
}

export interface CrawlingStats {
  totalItems: number;
  naverCount: number;
  rssCount: number;
  cseCount: number;
  fullContentCount: number;
  duplicatesRemoved: number;
  processingTimeMs: number;
}

/**
 * 네이버 API 대량 크롤러
 */
export class NaverMassCrawler {
  private clientId: string;
  private clientSecret: string;
  private requestQueue: PQueue;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.requestQueue = new PQueue({
      concurrency: 20, // 동시 20개 요청 (50 -> 20으로 감소, 서버 부하 방지)
      interval: 1000,
      intervalCap: 20
    });
  }

  /**
   * 네이버 API 대량 크롤링 (개선된 버전)
   */
  async crawlMassive(
    keyword: string,
    options: MassCrawlingOptions = {}
  ): Promise<MassCrawledItem[]> {
    const {
      maxResults = 5000, // 기본값 대폭 증가
      sort = 'sim',
      includeViews = true
    } = options;

    console.log(`[NAVER-MASS] 🚀 대량 크롤링 시작: "${keyword}" (목표: ${maxResults}개)`);

    const results: MassCrawledItem[] = [];
    const batchSize = 100; // API 최대
    const totalPages = Math.ceil(maxResults / batchSize);

    // 병렬 페이지 요청 (개선된 에러 처리) - 배치 처리로 변경 (너무 많은 동시 요청 방지)
    const batchSizePages = 5; // 한 번에 5개 페이지씩 처리

    console.log(`[NAVER-MASS] 📊 ${totalPages}개 페이지 배치 처리 시작... (배치 크기: ${batchSizePages}개)`);

    for (let batchStart = 0; batchStart < totalPages; batchStart += batchSizePages) {
      const batchEnd = Math.min(batchStart + batchSizePages, totalPages);
      const batchPromises: Promise<MassCrawledItem[]>[] = [];

      for (let page = batchStart; page < batchEnd; page++) {
        const start = page * batchSize + 1;
        batchPromises.push(
          this.requestQueue.add(async (): Promise<MassCrawledItem[]> => {
            try {
              return await this.fetchPage(keyword, start, batchSize, sort);
            } catch (error) {
              console.error(`[NAVER-MASS] 페이지 ${page + 1} 요청 실패:`, error);
              return [];
            }
          }) as Promise<MassCrawledItem[]>
        );
      }

      console.log(`[NAVER-MASS] 📦 배치 ${Math.floor(batchStart / batchSizePages) + 1} 처리 중... (${batchStart + 1}-${batchEnd}/${totalPages})`);

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, batchIndex) => {
        const pageIndex = batchStart + batchIndex;
        if (result.status === 'fulfilled') {
          results.push(...result.value);
          console.log(`[NAVER-MASS] ✅ 페이지 ${pageIndex + 1}/${totalPages} 완료: ${result.value.length}개`);
        } else {
          console.error(`[NAVER-MASS] ❌ 페이지 ${pageIndex + 1} 실패:`, result.reason);
        }
      });

      // 배치 간 짧은 지연 (서버 부하 방지)
      if (batchEnd < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
      }
    }

    // 조회수 기반 정렬 (옵션)
    if (includeViews && sort === 'sim') {
      const sortedResults = await this.sortByPopularity(results);
      console.log(`[NAVER-MASS] 📈 인기도 기반 정렬 완료`);
      return sortedResults;
    }

    console.log(`[NAVER-MASS] ✅ 대량 크롤링 완료: ${results.length}개 수집`);
    return results;
  }

  /**
   * 단일 페이지 요청 (개선된 에러 처리)
   */
  private async fetchPage(
    keyword: string,
    start: number,
    display: number,
    sort: string
  ): Promise<MassCrawledItem[]> {
    const maxRetries = 3;
    let lastError: any;
    const requestStartTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 🔧 네이버 블로그 대신 웹 검색 사용 (뉴스, 카페, 공식사이트 등 포함)
        const url = 'https://openapi.naver.com/v1/search/webkr.json';
        const params = {
          query: keyword,
          display: Math.min(display, 100), // API 제한
          start: start,
          sort: sort
        };

        console.log(`[NAVER-MASS-DEBUG] 🔄 페이지 요청 시도 ${attempt}/${maxRetries}`);
        console.log(`[NAVER-MASS-DEBUG]    URL: ${url}`);
        console.log(`[NAVER-MASS-DEBUG]    파라미터:`, params);
        console.log(`[NAVER-MASS-DEBUG]    클라이언트 ID: ${this.clientId.substring(0, 8)}...`);

        const requestTime = Date.now();
        const response = await axios.get(url, {
          params: params,
          headers: {
            'X-Naver-Client-Id': this.clientId,
            'X-Naver-Client-Secret': this.clientSecret,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000, // 30초
          validateStatus: (status) => status < 500 // 5xx 에러만 재시도
        });

        const responseTime = Date.now() - requestTime;
        console.log(`[NAVER-MASS-DEBUG] ✅ 응답 수신 (${responseTime}ms)`);
        console.log(`[NAVER-MASS-DEBUG]    상태 코드: ${response.status}`);
        console.log(`[NAVER-MASS-DEBUG]    응답 헤더:`, Object.keys(response.headers));
        console.log(`[NAVER-MASS-DEBUG]    데이터 항목 수: ${response.data?.items?.length || 0}`);

        if (!response.data.items) {
          console.log(`[NAVER-MASS] 페이지 ${start}에서 결과 없음`);
          return [];
        }

        // 🔧 웹 검색 결과 필터링: 네이버 블로그 제외, 다른 사이트 우선
        const items = response.data.items
          .filter((item: any) => {
            const link = item.link || '';
            // 네이버 블로그 완전 제외
            if (link.includes('blog.naver.com') || link.includes('post.naver.com') || link.includes('m.blog.naver.com')) {
              return false;
            }
            // 모든 결과 허용 (네이버 블로그만 제외)
            return true;
          })
          .map((item: any) => {
            const link = item.link || '';
            // 우선 사이트 점수 부여 (뉴스, 카페, 공식사이트, 티스토리, 워드프레스, 블로그스팟, 디시인사이드)
            const prioritySites = [
              'news.naver.com', 'cafe.naver.com', 'dcinside.com',
              'tistory.com', 'wordpress.com', 'blogspot.com',
              '.go.kr', '.or.kr', '.co.kr', '.gov.kr'
            ];
            const isPrioritySite = prioritySites.some(site => link.includes(site));
            const baseScore = this.calculateInitialScore(item);
            // 우선 사이트는 점수 2배 가중치
            const popularityScore = isPrioritySite ? baseScore * 2 : baseScore;

            return {
              title: this.cleanText(item.title),
              description: this.cleanText(item.description),
              link: item.link,
              pubDate: item.pubdate || new Date().toISOString(),
              author: item.bloggername || '',
              source: 'naver' as const,
              popularityScore: popularityScore
            };
          })
          // 우선 사이트를 먼저 정렬
          .sort((a: MassCrawledItem, b: MassCrawledItem) => b.popularityScore - a.popularityScore);

        console.log(`[NAVER-MASS] 페이지 ${start} 성공: ${items.length}개 항목`);
        return items;

      } catch (error: any) {
        const errorTime = Date.now() - requestStartTime;
        lastError = error;

        console.error(`[NAVER-MASS-DEBUG] ❌ 에러 발생 (${errorTime}ms)`);
        console.error(`[NAVER-MASS-DEBUG]    에러 이름: ${error?.name || 'Unknown'}`);
        console.error(`[NAVER-MASS-DEBUG]    에러 메시지: ${error?.message || 'N/A'}`);
        console.error(`[NAVER-MASS-DEBUG]    에러 코드: ${error?.code || 'N/A'}`);
        console.error(`[NAVER-MASS-DEBUG]    HTTP 상태: ${error?.response?.status || 'N/A'}`);
        console.error(`[NAVER-MASS-DEBUG]    요청 URL: ${error?.config?.url || 'N/A'}`);
        console.error(`[NAVER-MASS-DEBUG]    타임아웃 여부: ${error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') ? 'YES' : 'NO'}`);

        if (error.response?.status === 429) {
          // Rate limit - 더 오래 기다림 (지수 백오프)
          const waitTime = Math.min(attempt * 3000, 10000); // 최대 10초
          console.log(`[NAVER-MASS] Rate limit 감지, ${waitTime}ms 대기...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else if (error.response?.status === 400) {
          // 잘못된 요청 - 재시도하지 않음
          console.error(`[NAVER-MASS] 잘못된 요청 (400): ${error.response.data?.errorMessage || error.message}`);
          break;
        } else if (error.response?.status === 401) {
          // 인증 실패 - 재시도하지 않음
          console.error(`[NAVER-MASS] 인증 실패 (401): API 키를 확인하세요`);
          break;
        } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          // 타임아웃 에러 - 재시도 시간 단축
          const waitTime = Math.min(attempt * 1500, 5000); // 최대 5초
          console.error(`[NAVER-MASS-DEBUG] ⏱️ 타임아웃 발생! ${waitTime}ms 후 재시도...`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        } else {
          // 기타 에러 - 재시도 시간 단축
          const waitTime = Math.min(attempt * 1000, 3000); // 최대 3초
          console.log(`[NAVER-MASS] 페이지 ${start} 시도 ${attempt}/${maxRetries} 실패, ${waitTime}ms 후 재시도: ${error.message}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
    }

    const totalTime = Date.now() - requestStartTime;
    console.error(`[NAVER-MASS-DEBUG] ❌ 페이지 ${start} 최종 실패 (총 ${totalTime}ms):`, lastError?.message);
    console.error(`[NAVER-MASS-DEBUG]    최종 에러 스택:`, lastError?.stack || 'N/A');
    return [];
  }

  /**
   * 조회수 추정 로직 (블로그 인덱스 분석)
   */
  private async sortByPopularity(results: MassCrawledItem[]): Promise<MassCrawledItem[]> {
    console.log(`[NAVER-MASS] 📊 인기도 분석 시작...`);

    const analyzed = await Promise.all(
      results.map(async (item) => {
        const popularity = await this.estimatePopularity(item);
        return { ...item, popularityScore: popularity };
      })
    );

    return analyzed.sort((a, b) => b.popularityScore - a.popularityScore);
  }

  /**
   * 인기도 점수 계산
   */
  private async estimatePopularity(item: MassCrawledItem): Promise<number> {
    let score = 0;

    // 최신성 (2025년 10월 기준)
    const pubDate = new Date(item.pubDate);
    const now = new Date('2025-10-27');
    const daysOld = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld < 7) score += 100;
    else if (daysOld < 30) score += 50;
    else if (daysOld < 90) score += 20;

    // 제목 길이 (자세한 글)
    score += item.title.length / 10;

    // 설명 길이 (풍부한 내용)
    score += item.description.length / 50;

    // 제목에 인기 키워드 포함 여부
    const popularKeywords = ['방법', '추천', '비교', '후기', '가격', '할인', '무료', '최신', '2025'];
    popularKeywords.forEach(keyword => {
      if (item.title.includes(keyword)) score += 10;
    });

    return score;
  }

  /**
   * 초기 점수 계산
   */
  private calculateInitialScore(item: any): number {
    let score = 0;

    // 제목 길이
    score += item.title.length / 10;

    // 설명 길이
    score += item.description.length / 50;

    return score;
  }

  /**
   * 텍스트 정리
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim();
  }

  /**
   * 실제 블로그 본문 크롤링 (Puppeteer)
   */
  async fetchFullContent(url: string): Promise<MassCrawledItem['fullContent'] | null> {
    let browser: any = null;
    try {
      // 타임아웃 제어를 위한 AbortController
      const timeoutId = setTimeout(() => {
        if (browser) {
          console.warn(`[NAVER-MASS] ⚠️ 본문 크롤링 타임아웃 (${url.substring(0, 50)}...)`);
        }
      }, 15000); // 15초 타임아웃 (더 빠른 실패)

      // Puppeteer는 별도 설치 필요
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();

      // 타임아웃 단축 및 domcontentloaded로 변경 (더 빠름)
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // networkidle0 대신 domcontentloaded 사용
        timeout: 15000 // 30초 -> 15초로 단축
      });

      // 네이버 블로그 구조에 맞춰 추출
      const content = await page.evaluate(() => {
        const mainContent =
          document.querySelector('.se-main-container') ||
          document.querySelector('#postViewArea') ||
          document.querySelector('.post-view') ||
          document.querySelector('.post-content');

        return {
          html: (mainContent as HTMLElement)?.innerHTML || '',
          text: (mainContent as HTMLElement)?.innerText || '',
          images: Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src && !src.includes('data:')),
          wordCount: (mainContent as HTMLElement)?.innerText.length || 0
        };
      });

      clearTimeout(timeoutId);
      await browser.close();
      browser = null;
      return content;
    } catch (error: any) {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          // 브라우저 종료 실패 무시
        }
      }

      // 타임아웃 에러는 조용히 처리 (너무 많은 로그 방지)
      if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
        console.warn(`[NAVER-MASS] ⚠️ 본문 크롤링 타임아웃: ${url.substring(0, 50)}...`);
      } else {
        console.error(`[NAVER-MASS] ❌ 전체 본문 크롤링 실패: ${url}`, error?.message || error);
      }
      return null;
    }
  }

  /**
   * 제품 상세페이지 감지
   */
  private detectProductPage($: any, url: string): boolean {
    // URL 패턴으로 제품 페이지 감지
    const productUrlPatterns = [
      /\/product\//i,
      /\/item\//i,
      /\/goods\//i,
      /\/detail\//i,
      /\/p\//i,
      /\/shop\//i,
      /\/store\//i,
      /\/mall\//i,
      /\/shopping\//i
    ];

    if (productUrlPatterns.some(pattern => pattern.test(url))) {
      return true;
    }

    // 메타 태그로 제품 페이지 감지
    const ogType = $('meta[property="og:type"]').attr('content') || '';
    if (ogType === 'product' || ogType.includes('product')) {
      return true;
    }

    // JSON-LD 스키마로 제품 페이지 감지
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonLd = JSON.parse($(jsonLdScripts[i]).html() || '{}');
        if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
          return true;
        }
        if (Array.isArray(jsonLd['@graph'])) {
          const hasProduct = jsonLd['@graph'].some((item: any) =>
            item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
          );
          if (hasProduct) return true;
        }
      } catch (e) {
        // JSON 파싱 실패 무시
      }
    }

    // 제품 관련 메타 태그 존재 여부
    const hasProductMeta =
      $('meta[property="product:price:amount"]').length > 0 ||
      $('meta[property="product:price:currency"]').length > 0 ||
      $('meta[property="og:product"]').length > 0 ||
      $('[itemtype*="Product"]').length > 0;

    if (hasProductMeta) {
      return true;
    }

    return false;
  }

  /**
   * 제품 상세페이지 데이터 추출
   */
  private extractProductData($: any, url: string): { title: string; description: string; text: string; price?: string; images?: string[] } | null {
    try {
      const productData: { title: string; description: string; text: string; price?: string; images?: string[] } = {
        title: '',
        description: '',
        text: ''
      };

      // 1. JSON-LD 스키마에서 제품 정보 추출
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLd = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          let product: any = null;

          if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
            product = jsonLd;
          } else if (Array.isArray(jsonLd['@graph'])) {
            product = jsonLd['@graph'].find((item: any) =>
              item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
            );
          }

          if (product) {
            productData.title = product.name || productData.title;
            productData.description = product.description || productData.description;
            productData.text = product.description || productData.text;

            // 가격 정보
            if (product.offers) {
              const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              if (offers.price) {
                productData.price = `${offers.price}${offers.priceCurrency || ''}`;
              }
            }

            // 이미지 정보
            if (product.image) {
              const images = Array.isArray(product.image) ? product.image : [product.image];
              productData.images = images.map((img: any) =>
                typeof img === 'string' ? img : (img.url || img)
              ).filter((img: any) => img);
            }
          }
        } catch (e) {
          // JSON 파싱 실패 무시
        }
      }

      // 2. Open Graph 메타 태그에서 제품 정보 추출
      if (!productData.title) {
        productData.title =
          $('meta[property="og:title"]').attr('content') ||
          $('meta[property="product:title"]').attr('content') ||
          '';
      }

      if (!productData.description) {
        productData.description =
          $('meta[property="og:description"]').attr('content') ||
          $('meta[property="product:description"]').attr('content') ||
          $('meta[name="description"]').attr('content') ||
          '';
      }

      // 가격 정보 (Open Graph)
      if (!productData.price) {
        const priceAmount = $('meta[property="product:price:amount"]').attr('content');
        const priceCurrency = $('meta[property="product:price:currency"]').attr('content') || '원';
        if (priceAmount) {
          productData.price = `${priceAmount}${priceCurrency}`;
        }
      }

      // 이미지 정보 (Open Graph)
      if (!productData.images || productData.images.length === 0) {
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
          productData.images = [ogImage];
        }
      }

      // 3. HTML 구조에서 제품 정보 추출 (폴백)
      if (!productData.title) {
        productData.title =
          $('h1.product-title').text() ||
          $('h1[itemprop="name"]').text() ||
          $('.product-name').text() ||
          $('title').text() ||
          $('h1').first().text() ||
          '';
      }

      if (!productData.description) {
        productData.description =
          $('.product-description').text() ||
          $('[itemprop="description"]').text() ||
          $('meta[name="description"]').attr('content') ||
          '';
      }

      if (!productData.text) {
        productData.text =
          $('.product-detail').text() ||
          $('.product-info').text() ||
          $('[itemprop="description"]').text() ||
          productData.description ||
          '';
      }

      // 가격 정보 (HTML)
      if (!productData.price) {
        productData.price =
          $('.product-price').text() ||
          $('[itemprop="price"]').text() ||
          $('.price').first().text() ||
          '';
      }

      // 이미지 정보 (HTML)
      if (!productData.images || productData.images.length === 0) {
        const images: string[] = [];
        $('img.product-image, img[itemprop="image"], .product-image img').each((_: any, img: any) => {
          const src = $(img).attr('src') || $(img).attr('data-src');
          if (src && !src.includes('data:') && !images.includes(src)) {
            images.push(src);
          }
        });
        if (images.length > 0) {
          productData.images = images;
        }
      }

      // 최소한 제목이나 설명이 있어야 유효한 제품 데이터로 간주
      if (productData.title || productData.description) {
        return productData;
      }

      return null;
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 제품 데이터 추출 실패 (${url}):`, error?.message || error);
      return null;
    }
  }

  /**
   * 제품 상세페이지 전용 크롤링 (Puppeteer 사용)
   */
  private async crawlProductDetailPage(
    url: string,
    manualItems: MassCrawledItem[],
    topic?: string,
    keywords?: string[],
    geminiKey?: string
  ): Promise<void> {
    let browser: any = null;
    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 제품 정보 추출
      const productData = await page.evaluate(() => {
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el ? (el.textContent || '').trim() : '';
        };

        const getAttr = (selector: string, attr: string) => {
          const el = document.querySelector(selector);
          return el ? (el.getAttribute(attr) || '') : '';
        };

        // JSON-LD 파싱
        let jsonLdProduct: any = null;
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of Array.from(jsonLdScripts)) {
          try {
            const jsonLd = JSON.parse(script.textContent || '{}');
            if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
              jsonLdProduct = jsonLd;
              break;
            }
            if (Array.isArray(jsonLd['@graph'])) {
              const product = jsonLd['@graph'].find((item: any) =>
                item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
              );
              if (product) {
                jsonLdProduct = product;
                break;
              }
            }
          } catch (e) {
            // JSON 파싱 실패 무시
          }
        }

        const title =
          jsonLdProduct?.name ||
          getAttr('meta[property="og:title"]', 'content') ||
          getAttr('meta[property="product:title"]', 'content') ||
          getText('h1.product-title') ||
          getText('h1[itemprop="name"]') ||
          getText('.product-name') ||
          getText('h1') ||
          getText('title') ||
          '';

        const description =
          jsonLdProduct?.description ||
          getAttr('meta[property="og:description"]', 'content') ||
          getAttr('meta[property="product:description"]', 'content') ||
          getAttr('meta[name="description"]', 'content') ||
          getText('.product-description') ||
          getText('[itemprop="description"]') ||
          '';

        const text =
          description ||
          getText('.product-detail') ||
          getText('.product-info') ||
          getText('[itemprop="description"]') ||
          '';

        const price =
          jsonLdProduct?.offers?.price ||
          getAttr('meta[property="product:price:amount"]', 'content') ||
          getText('.product-price') ||
          getText('[itemprop="price"]') ||
          getText('.price') ||
          '';

        const images: string[] = [];
        if (jsonLdProduct?.image) {
          const imgArray = Array.isArray(jsonLdProduct.image) ? jsonLdProduct.image : [jsonLdProduct.image];
          imgArray.forEach((img: any) => {
            const imgUrl = typeof img === 'string' ? img : (img.url || img);
            if (imgUrl && !imgUrl.includes('data:')) {
              images.push(imgUrl);
            }
          });
        }

        if (images.length === 0) {
          const ogImage = getAttr('meta[property="og:image"]', 'content');
          if (ogImage) images.push(ogImage);
        }

        if (images.length === 0) {
          document.querySelectorAll('img.product-image, img[itemprop="image"], .product-image img').forEach((img) => {
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src && !src.includes('data:') && !images.includes(src)) {
              images.push(src);
            }
          });
        }

        return { title, description, text, price, images };
      });

      if (productData && (productData.title || productData.description)) {
        manualItems.push({
          title: productData.title || '제품 상세페이지',
          description: productData.description || productData.text || '',
          link: url,
          pubDate: new Date().toISOString(),
          source: 'manual',
          popularityScore: 1000,
          productData: {
            title: productData.title,
            description: productData.description,
            text: productData.text,
            price: productData.price,
            images: productData.images
          }
        });
        console.log(`[MASS-CRAWLER] ✅ 제품 상세페이지 크롤링 완료 (Puppeteer): ${url}`);
      }
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 제품 상세페이지 크롤링 실패 (${url}):`, error?.message || error);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          // 브라우저 종료 실패 무시
        }
      }
    }
  }

  /**
   * 소제목 분석 결과를 이미지 프롬프트에 자동 포함하여 라이브러리에 저장
   */
  private async saveImagePromptWithSubtopic(
    topic: string,
    keywords: string[],
    subtopic: string,
    imagePath: string,
    description: string
  ): Promise<void> {
    try {
      const library = await readSnippetLibrary();

      // 소제목 분석을 위한 프롬프트 생성
      const imagePrompt = `High-quality product photography of ${subtopic}, ${description.substring(0, 100)}. Professional lighting, clean background, Korean market style, ${keywords.slice(0, 3).join(', ')}`;

      const newSnippet = {
        id: `affiliate-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        type: 'imagePrompt' as const,
        prompt: imagePrompt,
        style: 'product',
        sectionIds: [],
        tone: 'professional',
        tags: ['제휴마케팅', '제품', subtopic, ...keywords.slice(0, 3)],
        description: `${subtopic} - ${description.substring(0, 50)}`,
        category: topic,
        usageCount: 0,
      };

      library.imagePrompts.push(newSnippet);
      await writeSnippetLibrary(library);

      console.log(`[MASS-CRAWLER] ✅ 이미지 프롬프트 라이브러리에 저장 완료: ${subtopic}`);
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 이미지 프롬프트 저장 실패:`, error?.message || error);
    }
  }
}

/**
 * RSS 대량 크롤러 (수백개 피드)
 */
export class MassRSSCrawler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _parser: any;
  private feedSources: string[];

  constructor() {
    // RSS 파서 초기화
    this.feedSources = this.loadFeedSources();
  }

  /**
   * 주요 RSS 피드 목록 로드 (100개 이상)
   */
  private loadFeedSources(): string[] {
    return [
      // 🔧 네이버 웹 검색 RSS (블로그 제외, 뉴스/카페/공식사이트 우선)
      'https://search.naver.com/search.naver?where=rss&query={keyword}&sort=1', // 정확도순 (상위 노출)
      'https://search.naver.com/search.naver?where=rss&query={keyword}&sm=tab_jum&sort=1',

      // 🔧 티스토리 RSS (키워드 검색)
      'https://www.tistory.com/rss/search/{keyword}',

      // 🔧 워드프레스 RSS (키워드 검색)
      'https://wordpress.com/search/{keyword}/feed/',

      // 🔧 블로그스팟 RSS (키워드 검색)
      'https://www.google.com/search?q=site:blogspot.com+{keyword}&tbm=blg&output=rss',

      // 🔧 디시인사이드 RSS (키워드 검색)
      'https://search.dcinside.com/rss/{keyword}',

      // 🔧 네이버 뉴스 RSS (키워드 검색, 최신순)
      'https://news.naver.com/main/search/searchRss.naver?query={keyword}&sort=1',
      'https://news.naver.com/main/search/searchRss.naver?query={keyword}&where=news&sort=1',

      // 🔧 네이버 블로그 RSS 제거 (다른 사이트 우선)
      // 'https://search.naver.com/search.naver?where=post&query={keyword}&sm=tab_jum&sort=1', // 제거됨

      // 🔧 네이버 카페 RSS (키워드 검색)
      'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050146&search.searchBy=0&search.query={keyword}',
      'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050147&search.searchBy=0&search.query={keyword}',
      'https://cafe.naver.com/ArticleSearchList.nhn?search.clubid=10050148&search.searchBy=0&search.query={keyword}',

      // 🔧 네이버 뉴스 섹션별 RSS (최신 뉴스, 키워드 필터링은 나중에)
      'https://news.naver.com/main/rss/section.naver?sid=100', // 정치
      'https://news.naver.com/main/rss/section.naver?sid=101', // 경제
      'https://news.naver.com/main/rss/section.naver?sid=102', // 사회
      'https://news.naver.com/main/rss/section.naver?sid=103', // 생활/문화
      'https://news.naver.com/main/rss/section.naver?sid=104', // 세계
      'https://news.naver.com/main/rss/section.naver?sid=105', // IT/과학
      'https://news.naver.com/main/rss/section.naver?sid=106', // 연예
      'https://news.naver.com/main/rss/section.naver?sid=107', // 스포츠

      // 🔧 주요 언론사 RSS (최신 뉴스)
      'https://www.chosun.com/arc/outboundfeeds/rss/',
      'https://www.joongang.co.kr/rss/home.xml',
      'https://www.hani.co.kr/rss/',
      'https://www.donga.com/rss/',
      'https://www.mk.co.kr/rss/',
      'https://www.seoul.co.kr/rss/',
      'https://www.khan.co.kr/rss/',
      'https://www.ytn.co.kr/rss/',
      'https://www.sbs.co.kr/rss/',
      'https://www.kbs.co.kr/rss/',
      'https://www.mbc.co.kr/rss/',
      'https://www.newsis.com/rss/',
      'https://www.newstomato.com/rss/',
      'https://www.news1.kr/rss/',
      'https://www.edaily.co.kr/rss/',
      'https://www.fnnews.com/rss/',
      'https://www.asiae.co.kr/rss/',
      'https://www.etoday.co.kr/rss/',
      'https://www.zdnet.co.kr/rss/',
      'https://www.it.co.kr/rss/',

      // 🔧 전문 블로그 플랫폼 (키워드 기반)
      'https://medium.com/feed/tag/{keyword}',
      'https://brunch.co.kr/rss/search?q={keyword}',
      'https://velog.io/rss/tag/{keyword}',

      // 🔧 쇼핑몰 RSS (상품 정보)
      'https://shopping.naver.com/rss/search.naver?query={keyword}',

      // 🔧 Google News RSS (한국어)
      'https://news.google.com/rss/search?q={keyword}+when:1y&hl=ko&gl=KR&ceid=KR:ko',

      // 🔧 추가 RSS 소스 (최신 뉴스)
      'https://www.yonhapnews.co.kr/rss/',
      'https://www.mt.co.kr/rss/',
      'https://www.ajunews.com/rss/',
      'https://www.inews24.com/rss/',
      'https://www.ohmynews.com/rss/',
      'https://www.pressian.com/rss/',
      'https://www.huffingtonpost.kr/rss/',
      'https://www.bbc.com/korean/rss.xml',
      'https://www.voakorea.com/rss',

      // 총 50개 이상의 RSS 소스
    ];
  }

  /**
   * 모든 RSS 피드에서 대량 크롤링
   */
  async crawlAll(
    keyword: string,
    maxResults: number = 10000 // RSS 기본값 대폭 증가
  ): Promise<MassCrawledItem[]> {
    console.log(`[RSS-MASS] 🚀 RSS 대량 크롤링 시작: "${keyword}" (목표: ${maxResults}개)`);

    // 키워드로 모든 피드 URL 생성
    const feedUrls = this.feedSources.map(url =>
      url.replace('{keyword}', encodeURIComponent(keyword))
    );

    console.log(`[RSS-MASS] 📊 ${feedUrls.length}개 RSS 피드 병렬 크롤링...`);

    // 병렬 크롤링 (동시 100개)
    const limiter = pLimit(100);
    const promises = feedUrls.map(url =>
      limiter(() => this.fetchFeed(url).catch(_e => []))
    );

    const results = await Promise.all(promises);
    const allItems = results.flat();

    console.log(`[RSS-MASS] 📦 원본 수집: ${allItems.length}개`);

    // 🔧 키워드 필터링 완화 (더 많은 결과 수집)
    const keywordLower = keyword.toLowerCase();
    const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 1); // 키워드를 단어로 분리

    const filtered = allItems.filter(item => {
      const titleLower = item.title.toLowerCase();
      const descLower = (item.description || '').toLowerCase();
      const combined = `${titleLower} ${descLower}`;

      // 전체 키워드 포함 또는 키워드 단어 중 하나라도 포함하면 통과
      return combined.includes(keywordLower) ||
        keywordWords.some(word => combined.includes(word));
    });

    console.log(`[RSS-MASS] 🔍 키워드 필터링: ${filtered.length}개 (원본: ${allItems.length}개)`);

    // 중복 제거 (URL 기준)
    const unique = this.deduplicateByUrl(filtered);

    console.log(`[RSS-MASS] 🗑️ 중복 제거: ${unique.length}개 (제거: ${filtered.length - unique.length}개)`);

    // 🔧 상위 노출 글 우선 정렬 (인기도 점수 + 최신성)
    const sorted = unique.sort((a, b) => {
      // 인기도 점수가 높은 순서 우선
      if (Math.abs(b.popularityScore - a.popularityScore) > 50) {
        return b.popularityScore - a.popularityScore;
      }
      // 인기도가 비슷하면 최신순
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    });

    const finalResults = sorted.slice(0, maxResults);
    console.log(`[RSS-MASS] ✅ RSS 크롤링 완료: ${finalResults.length}개`);

    return finalResults;
  }

  /**
   * 단일 RSS 피드 크롤링
   */
  private async fetchFeed(url: string): Promise<MassCrawledItem[]> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // 🔧 개선된 RSS 파싱 (RSS 2.0, Atom, 다양한 형식 지원)
      const xmlText = response.data;
      const items: MassCrawledItem[] = [];

      // XML 텍스트에서 직접 파싱 (cheerio보다 더 정확)
      // RSS 2.0 형식: <item>...</item>
      const rssItemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
      // Atom 형식: <entry>...</entry>
      const atomEntryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

      const allMatches = [...rssItemMatches, ...atomEntryMatches];

      for (const match of allMatches) {
        // 제목 추출 (다양한 형식 지원)
        const titleMatch = match.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();

        // 링크 추출 (다양한 형식 지원)
        const linkMatch = match.match(/<link[^>]*>(.*?)<\/link>|<link[^>]*href=["'](.*?)["'][^>]*\/>|<link[^>]*href=["'](.*?)["'][^>]*>/i);
        const link = (linkMatch?.[1] || linkMatch?.[2] || linkMatch?.[3] || '').trim();

        // 설명 추출
        const descMatch = match.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>|<content[^>]*type=["']html["'][^>]*><!\[CDATA\[(.*?)\]\]><\/content>|<content[^>]*type=["']html["'][^>]*>(.*?)<\/content>|<summary>(.*?)<\/summary>/i);
        const description = (descMatch?.[1] || descMatch?.[2] || descMatch?.[3] || descMatch?.[4] || descMatch?.[5] || '').trim();

        // 발행일 추출
        const pubDateMatch = match.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>|<dc:date>(.*?)<\/dc:date>|<updated>(.*?)<\/updated>/i);
        const pubDate = (pubDateMatch?.[1] || pubDateMatch?.[2] || pubDateMatch?.[3] || pubDateMatch?.[4] || new Date().toISOString()).trim();

        // 작성자 추출
        const authorMatch = match.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>|<dc:creator>(.*?)<\/dc:creator>|<author>(.*?)<\/author>/i);
        const author = (authorMatch?.[1] || authorMatch?.[2] || authorMatch?.[3] || '').trim();

        if (title && link && title.length >= 3) {
          items.push({
            title: this.cleanText(title),
            description: this.cleanText(description),
            link,
            pubDate: pubDate || new Date().toISOString(),
            author,
            source: 'rss',
            popularityScore: this.calculateRSSScore(title, description, pubDate)
          });
        }
      }

      // 🔧 cheerio로도 추가 파싱 시도 (fallback)
      if (items.length === 0) {
        try {
          const $ = cheerio.load(xmlText, { xmlMode: true });
          $('item, entry').each((_i, el) => {
            const $el = $(el);
            const title = $el.find('title').text().trim();
            const link = $el.find('link').text().trim() || $el.find('link').attr('href') || '';
            const description = $el.find('description, content, summary').text().trim();
            const pubDate = $el.find('pubDate, published, updated').text().trim();

            if (title && link && title.length >= 3) {
              items.push({
                title: this.cleanText(title),
                description: this.cleanText(description),
                link,
                pubDate: pubDate || new Date().toISOString(),
                author: '',
                source: 'rss',
                popularityScore: this.calculateRSSScore(title, description, pubDate)
              });
            }
          });
        } catch (cheerioError) {
          console.error(`[RSS-MASS] Cheerio 파싱 실패: ${url}`, cheerioError);
        }
      }

      return items;
    } catch (error) {
      console.error(`[RSS-MASS] 피드 크롤링 실패: ${url}`, error);
      return [];
    }
  }

  /**
   * RSS 아이템 점수 계산 (상위 노출 우선)
   */
  private calculateRSSScore(title: string, description: string, pubDate: string): number {
    let score = 0;

    // 🔧 상위 노출 지표 가중치 증가
    // 제목 길이 (적절한 길이의 제목이 상위 노출 가능성 높음)
    if (title.length >= 20 && title.length <= 60) score += 30;

    // 인기 키워드 포함 (상위 노출 키워드)
    const topKeywords = ['방법', '추천', '비교', '후기', '가격', '할인', '무료', '최신', '2025', '완벽', '가이드', '꿀팁', '비밀', '노하우'];
    topKeywords.forEach(keyword => {
      if (title.includes(keyword)) score += 25;
      if (description?.includes(keyword)) score += 15;
    });

    // 설명 길이 (충분한 설명이 있는 글이 상위 노출 가능성 높음)
    if (description && description.length >= 100) score += 20;

    // 최신성 (최근 1개월 내 글이 상위 노출 가능성 높음)

    // 최신성
    if (pubDate) {
      const pubDateObj = new Date(pubDate);
      const now = new Date();
      const daysOld = (now.getTime() - pubDateObj.getTime()) / (1000 * 60 * 60 * 24);

      if (daysOld < 1) score += 100;
      else if (daysOld < 7) score += 50;
      else if (daysOld < 30) score += 20;
    }

    // 제목과 설명 길이
    score += title.length / 10;
    score += description.length / 50;

    return score;
  }

  /**
   * URL 기준 중복 제거
   */
  private deduplicateByUrl(items: MassCrawledItem[]): MassCrawledItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  }

  /**
   * 텍스트 정리
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim();
  }
}

/**
 * Google CSE 대량 크롤러
 */
export class GoogleCSEMassCrawler {
  private apiKey: string;
  private cseId: string;

  constructor(apiKey: string, cseId: string) {
    this.apiKey = apiKey;
    this.cseId = cseId;
  }

  /**
   * Google CSE 대량 검색
   */
  async search(
    keyword: string,
    options: MassCrawlingOptions = {}
  ): Promise<MassCrawledItem[]> {
    const {
      maxResults = 100,
      dateRestrict = 'y1', // 최근 1년
      // 🔧 네이버 블로그 제외, 다른 사이트 우선
      siteSearch = '-blog.naver.com (tistory.com OR *.co.kr OR *.go.kr OR *.or.kr OR dcinside.com OR wordpress.com OR blogspot.com OR news.naver.com OR cafe.naver.com)'
    } = options;

    console.log(`[CSE-MASS] 🚀 Google CSE 크롤링 시작: "${keyword}" (목표: ${maxResults}개)`);

    const results: MassCrawledItem[] = [];
    const perPage = 10; // CSE 제한
    const pages = Math.ceil(maxResults / perPage);

    // Rate Limiter import
    const { safeCSERequest } = await import('../utils/google-cse-rate-limiter');

    for (let i = 0; i < pages; i++) {
      const start = i * perPage + 1;
      try {
        const cacheKey = `mass-cse:${keyword}:${start}`;
        const response = await safeCSERequest<{ items?: any[] }>(
          `${keyword} (page ${start})`,
          async () => {
            const res = await axios.get(
              'https://www.googleapis.com/customsearch/v1',
              {
                params: {
                  key: this.apiKey,
                  cx: this.cseId,
                  q: keyword,
                  start,
                  num: perPage,
                  dateRestrict,
                  siteSearch,
                  lr: 'lang_ko'
                },
                timeout: 10000
              }
            );
            return res.data;
          },
          { useCache: true, cacheKey, priority: 'low' }
        );

        if (response.items) {
          const items = response.items.map((item: any) => ({
            title: this.cleanText(item.title),
            description: this.cleanText(item.snippet),
            link: item.link,
            pubDate: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString(),
            source: 'cse' as const,
            popularityScore: this.calculateCSEScore(item)
          }));

          results.push(...items);
          console.log(`[CSE-MASS] 📊 페이지 ${i + 1}/${pages} 완료: ${items.length}개`);
        }
      } catch (error: any) {
        // Rate Limit 오류인 경우 중단
        if (error?.message?.includes('Rate Limit') || error?.message?.includes('할당량')) {
          console.warn(`[CSE-MASS] 할당량 초과로 중단: ${error.message}`);
          break;
        }
        console.error(`[CSE-MASS] 페이지 ${i + 1} 실패:`, error);
        break;
      }
    }

    console.log(`[CSE-MASS] ✅ CSE 크롤링 완료: ${results.length}개`);
    return results;
  }

  /**
   * CSE 아이템 점수 계산
   */
  private calculateCSEScore(item: any): number {
    let score = 0;

    // 제목 길이
    score += item.title.length / 10;

    // 설명 길이
    score += item.snippet.length / 50;

    // 검색 순위 (낮을수록 높은 점수)
    if (item.index !== undefined) {
      score += (100 - item.index) * 2;
    }

    return score;
  }

  /**
   * 텍스트 정리
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // HTML 태그 제거
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .trim();
  }
}

/**
 * 통합 대량 크롤링 시스템
 */
export class MassCrawlingSystem {
  private naverCrawler?: NaverMassCrawler;
  private rssCrawler: MassRSSCrawler;
  private cseCrawler?: GoogleCSEMassCrawler;
  private performanceMonitor: PerformanceMonitor;
  private logger: Logger;

  constructor(
    naverClientId?: string,
    naverClientSecret?: string,
    googleApiKey?: string,
    googleCseId?: string
  ) {
    this.performanceMonitor = new PerformanceMonitor();
    this.logger = new Logger('MassCrawlingSystem');

    if (naverClientId && naverClientSecret) {
      this.naverCrawler = new NaverMassCrawler(naverClientId, naverClientSecret);
      this.logger.info('네이버 크롤러 초기화 완료');
    }

    this.rssCrawler = new MassRSSCrawler();
    this.logger.info('RSS 크롤러 초기화 완료');

    if (googleApiKey && googleCseId) {
      this.cseCrawler = new GoogleCSEMassCrawler(googleApiKey, googleCseId);
      this.logger.info('Google CSE 크롤러 초기화 완료');
    }

    this.logger.success('대량 크롤링 시스템 초기화 완료');
  }

  /**
   * 통합 대량 크롤링 실행
   */
  async crawlAll(
    keyword: string,
    options: MassCrawlingOptions = {}
  ): Promise<{
    items: MassCrawledItem[];
    stats: CrawlingStats;
  }> {
    this.performanceMonitor.startMeasurement('total-crawl');
    const startTime = Date.now();

    const {
      maxResults = 10000, // 통합 시스템 기본값 대폭 증가
      enableFullContent = false,
      maxConcurrent = 20,
      manualUrls = [] // 수동 크롤링 링크
    } = options;

    this.logger.info(`통합 대량 크롤링 시작: "${keyword}"`);
    this.logger.info(`목표: ${maxResults}개, 전체 본문: ${enableFullContent ? 'ON' : 'OFF'}`);
    if (manualUrls && manualUrls.length > 0) {
      this.logger.info(`📋 수동 크롤링 링크 ${manualUrls.length}개 감지됨`);
      console.log(`[MASS-CRAWLER] 📋 수동 크롤링 링크:`, manualUrls);
    }

    let allItems: MassCrawledItem[] = [];
    let naverCount = 0;
    let rssCount = 0;
    let cseCount = 0;

    // 수동 크롤링 링크 우선 처리
    if (manualUrls && manualUrls.length > 0 && this.naverCrawler) {
      console.log(`[MASS-CRAWLER] 🔗 수동 크롤링 링크 처리 시작...`);
      try {
        const manualItems: MassCrawledItem[] = [];
        const { topic, keywords = [], geminiKey } = options;

        // 병렬 크롤링 (동시 3개, 서버 부하 제한)
        const crawlLimit = pLimit(3);
        const crawlResults = await Promise.allSettled(
          manualUrls.filter(url => url && url.trim()).map(url => crawlLimit(async () => {
          try {
            console.log(`[MASS-CRAWLER] 🔗 수동 링크 크롤링: ${url}`);

            let crawledTitle = '';
            let crawledDescription = '';
            let crawledText = '';

            // Puppeteer로 전체 본문 크롤링 시도
            if (enableFullContent) {
              const fullContent = await this.naverCrawler!.fetchFullContent(url);
              if (fullContent) {
                crawledText = fullContent.text || '';
                crawledTitle = (crawledText.length > 0 ? crawledText.substring(0, 100) : '') || '';
                crawledDescription = (crawledText.length > 0 ? crawledText.substring(0, 300) : '') || '';

                manualItems.push({
                  title: crawledTitle || '수동 크롤링 콘텐츠',
                  description: crawledDescription,
                  link: url,
                  pubDate: new Date().toISOString(),
                  source: 'manual',
                  popularityScore: 1000, // 수동 링크는 최우선순위
                  fullContent: {
                    html: fullContent.html || '',
                    text: crawledText,
                    images: fullContent.images || [],
                    wordCount: fullContent.wordCount || 0
                  }
                });
                console.log(`[MASS-CRAWLER] ✅ 수동 링크 크롤링 완료: ${url} (${fullContent.wordCount}자)`);
              } else {
                // fetchFullContent 실패 시 제품 상세페이지 전용 크롤링 시도
                await this.crawlProductDetailPage(url, manualItems, topic, keywords, geminiKey);
              }
            } else {
              // 간단한 크롤링 (제목과 기본 정보만)
              try {
                const response = await axios.get(url, {
                  timeout: 10000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  }
                });
                const $ = cheerio.load(response.data);

                // 제품 상세페이지 감지 및 파싱 시도
                const isProductPage = this.detectProductPage($, url);
                if (isProductPage) {
                  const productData = this.extractProductData($, url);
                  if (productData) {
                    crawledTitle = productData.title || ($('title').text() || $('h1').first().text() || '').trim();
                    crawledDescription = productData.description || ($('meta[name="description"]').attr('content') || '');
                    crawledText = productData.text || crawledDescription;

                    // 제품 이미지 다운로드 및 로컬 저장
                    let savedImagePaths: string[] = [];
                    if (productData.images && productData.images.length > 0) {
                      try {
                        console.log(`[MASS-CRAWLER] 📥 제품 이미지 다운로드 시작: ${productData.images.length}개`);
                        const downloadResults = await downloadMultipleImages(productData.images, {
                          folderName: 'affiliate-products',
                          topic: topic || crawledTitle,
                          subtopic: crawledTitle,
                          maxImages: 5 // 최대 5개만 저장
                        });

                        savedImagePaths = downloadResults
                          .filter(r => r.success && r.localPath)
                          .map(r => r.localPath!);

                        console.log(`[MASS-CRAWLER] ✅ 이미지 다운로드 완료: ${savedImagePaths.length}개 저장됨`);

                        // 소제목 분석 결과를 이미지 프롬프트에 자동 포함
                        if (savedImagePaths.length > 0 && topic && keywords && keywords.length > 0 && crawledTitle && crawledTitle.length > 0) {
                          await this.saveImagePromptWithSubtopic(
                            topic,
                            keywords,
                            crawledTitle,
                            savedImagePaths[0]!, // 첫 번째 이미지 경로
                            productData.description || crawledDescription || ''
                          );
                        }
                      } catch (imageError: any) {
                        console.warn(`[MASS-CRAWLER] ⚠️ 이미지 다운로드 실패:`, imageError?.message || imageError);
                      }
                    }

                    manualItems.push({
                      title: crawledTitle || '수동 크롤링 콘텐츠',
                      description: crawledDescription,
                      link: url,
                      pubDate: new Date().toISOString(),
                      source: 'manual',
                      popularityScore: 1000,
                      productData: {
                        ...productData,
                        localImagePaths: savedImagePaths // 로컬 이미지 경로 추가
                      }
                    });
                    console.log(`[MASS-CRAWLER] ✅ 제품 상세페이지 정보 수집 완료: ${url}`);
                  } else {
                    // 제품 페이지 감지되었지만 파싱 실패 - 일반 크롤링으로 폴백
                    crawledTitle = ($('title').text() || $('h1').first().text() || '').trim();
                    const metaDesc = $('meta[name="description"]').attr('content') || '';
                    const firstP = $('p').first().text() || '';
                    crawledDescription = (metaDesc || (firstP.length > 0 ? firstP.substring(0, 300) : '')).trim();
                    crawledText = firstP || metaDesc || '';

                    manualItems.push({
                      title: crawledTitle || '수동 크롤링 콘텐츠',
                      description: crawledDescription,
                      link: url,
                      pubDate: new Date().toISOString(),
                      source: 'manual',
                      popularityScore: 1000
                    });
                    console.log(`[MASS-CRAWLER] ✅ 수동 링크 기본 정보 수집 완료: ${url}`);
                  }
                } else {
                  // 일반 페이지 크롤링
                  crawledTitle = ($('title').text() || $('h1').first().text() || '').trim();
                  const metaDesc = $('meta[name="description"]').attr('content') || '';
                  const firstP = $('p').first().text() || '';
                  crawledDescription = (metaDesc || (firstP.length > 0 ? firstP.substring(0, 300) : '')).trim();
                  crawledText = firstP || metaDesc || '';

                  manualItems.push({
                    title: crawledTitle || '수동 크롤링 콘텐츠',
                    description: crawledDescription,
                    link: url,
                    pubDate: new Date().toISOString(),
                    source: 'manual',
                    popularityScore: 1000
                  });
                  console.log(`[MASS-CRAWLER] ✅ 수동 링크 기본 정보 수집 완료: ${url}`);
                }
              } catch (fetchError: any) {
                console.warn(`[MASS-CRAWLER] ⚠️ 수동 링크 기본 크롤링 실패 (${url}):`, fetchError?.message || fetchError);
              }
            }

            // AI 제목 생성 (크롤링 성공했고, topic/keywords/geminiKey가 있을 때)
            if (manualItems.length > 0 && topic && keywords.length > 0 && geminiKey) {
              const lastItem = manualItems[manualItems.length - 1];
              if (lastItem) {
                try {
                  // generateSEOTitle 함수는 index.ts 내부 함수이므로 직접 호출 불가
                  // 대신 간단한 AI 제목 생성 로직 사용
                  const { GoogleGenerativeAI } = await import('@google/generative-ai');
                  const genAI = new GoogleGenerativeAI(geminiKey);
                  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

                  const prompt = `다음 정보를 바탕으로 SEO에 최적화되고 클릭을 유발하는 제목을 생성해주세요.

주제: ${topic}
키워드: ${keywords.join(', ')}
크롤링된 내용: ${crawledText ? crawledText.substring(0, 500) : crawledTitle}

제목 생성 요구사항:
- SEO에 최적화된 제목 (40-70자)
- 클릭 유도력이 높은 제목
- 핵심 키워드를 자연스럽게 포함
- 호기심을 자극하면서 썸네일 텍스트에 과하지 않게

제목만 출력해주세요 (HTML 태그 없이):`;

                  const result = await model.generateContent(prompt);
                  const response = result.response;
                  const aiTitle = response.text().trim();

                  if (aiTitle && aiTitle.length > 0) {
                    lastItem.title = aiTitle;
                    console.log(`[MASS-CRAWLER] ✨ AI 제목 생성 완료: ${aiTitle}`);
                  }
                } catch (aiError: any) {
                  console.warn(`[MASS-CRAWLER] ⚠️ AI 제목 생성 실패, 크롤링 제목 사용:`, aiError?.message || aiError);
                }
              }
            }
          } catch (error: any) {
            console.error(`[MASS-CRAWLER] ❌ 수동 링크 크롤링 실패 (${url}):`, error?.message || error);
          }
        }))
        );

        if (manualItems.length > 0) {
          allItems.push(...manualItems);
          console.log(`[MASS-CRAWLER] ✅ 수동 크롤링 완료: ${manualItems.length}개 항목 추가`);
          this.logger.success(`수동 크롤링: ${manualItems.length}개`);
        }
      } catch (error: any) {
        console.error(`[MASS-CRAWLER] ❌ 수동 크롤링 처리 오류:`, error?.message || error);
      }
    }

    // 🔥 1차: 네이버 검색 API 크롤링 (활성화)
    if (this.naverCrawler) {
      console.log(`[MASS-CRAWLER-DEBUG] 🔄 네이버 API 크롤링 시작...`);
      const naverStartTime = Date.now();
      this.performanceMonitor.startMeasurement('naver-crawl');
      try {
        const naverTarget = Math.floor(maxResults * 0.5);
        console.log(`[MASS-CRAWLER-DEBUG]    목표 항목: ${naverTarget}개`);
        const naverResults = await this.naverCrawler.crawlMassive(keyword, {
          maxResults: naverTarget,
          sort: 'sim',
          includeViews: true
        });
        naverCount = naverResults.length;
        allItems.push(...naverResults);
        const naverDuration = Date.now() - naverStartTime;
        this.performanceMonitor.endMeasurement('naver-crawl', { items: naverCount });
        console.log(`[MASS-CRAWLER-DEBUG] ✅ 네이버 완료 (${(naverDuration / 1000).toFixed(2)}초): ${naverCount}개`);
        console.log(`[MassCrawlingSystem] ℹ️ 네이버 API 크롤링 완료: ${naverCount}개 추출`);
        this.logger.success(`네이버: ${naverCount}개`);
      } catch (error: any) {
        const naverDuration = Date.now() - naverStartTime;
        this.performanceMonitor.endMeasurement('naver-crawl');
        console.error(`[MASS-CRAWLER-DEBUG] ❌ 네이버 실패 (${(naverDuration / 1000).toFixed(2)}초):`);
        console.error(`[MASS-CRAWLER-DEBUG]    에러 메시지: ${error?.message || String(error)}`);
        this.logger.error('네이버 실패:', error);
      }
    } else {
      console.log(`[MASS-CRAWLER-DEBUG] ⚠️ 네이버 크롤러가 초기화되지 않음 (API 키 확인 필요)`);
    }

    // 2차: RSS (대량 병렬)
    console.log(`[MASS-CRAWLER-DEBUG] 🔄 RSS 크롤링 시작...`);
    const rssStartTime = Date.now();
    this.performanceMonitor.startMeasurement('rss-crawl');
    try {
      const rssTarget = Math.floor(maxResults * 0.3);
      console.log(`[MASS-CRAWLER-DEBUG]    목표 항목: ${rssTarget}개`);
      const rssResults = await this.rssCrawler.crawlAll(
        keyword,
        rssTarget
      );
      rssCount = rssResults.length;
      allItems.push(...rssResults);
      const rssDuration = Date.now() - rssStartTime;
      this.performanceMonitor.endMeasurement('rss-crawl', { items: rssCount });
      console.log(`[MASS-CRAWLER-DEBUG] ✅ RSS 완료 (${(rssDuration / 1000).toFixed(2)}초): ${rssCount}개`);
      console.log(`[MassCrawlingSystem] ℹ️ RSS 크롤링 완료: ${rssCount}개 추출`);
      this.logger.success(`RSS: ${rssCount}개`);
    } catch (error: any) {
      const rssDuration = Date.now() - rssStartTime;
      this.performanceMonitor.endMeasurement('rss-crawl');
      console.error(`[MASS-CRAWLER-DEBUG] ❌ RSS 실패 (${(rssDuration / 1000).toFixed(2)}초):`);
      console.error(`[MASS-CRAWLER-DEBUG]    에러 타입: ${error?.name || 'Unknown'}`);
      console.error(`[MASS-CRAWLER-DEBUG]    에러 메시지: ${error?.message || String(error)}`);
      console.error(`[MASS-CRAWLER-DEBUG]    에러 코드: ${error?.code || 'N/A'}`);
      console.error(`[MASS-CRAWLER-DEBUG]    에러 스택:`, error?.stack || 'N/A');
      this.logger.error('RSS 실패:', error);
    }

    // 3차: CSE (보완)
    if (this.cseCrawler && allItems.length < maxResults * 0.8) {
      console.log(`[MASS-CRAWLER-DEBUG] 🔄 CSE 크롤링 시작...`);
      const cseStartTime = Date.now();
      this.performanceMonitor.startMeasurement('cse-crawl');
      try {
        const cseTarget = Math.floor(maxResults * 0.2);
        console.log(`[MASS-CRAWLER-DEBUG]    목표 항목: ${cseTarget}개`);
        const cseResults = await this.cseCrawler.search(
          keyword,
          { maxResults: cseTarget }
        );
        cseCount = cseResults.length;
        allItems.push(...cseResults);
        const cseDuration = Date.now() - cseStartTime;
        this.performanceMonitor.endMeasurement('cse-crawl', { items: cseCount });
        console.log(`[MASS-CRAWLER-DEBUG] ✅ CSE 완료 (${(cseDuration / 1000).toFixed(2)}초): ${cseCount}개`);
        console.log(`[MassCrawlingSystem] ℹ️ Google CSE 크롤링 완료: ${cseCount}개 추출`);
        this.logger.success(`CSE: ${cseCount}개`);
      } catch (error: any) {
        const cseDuration = Date.now() - cseStartTime;
        this.performanceMonitor.endMeasurement('cse-crawl');
        console.error(`[MASS-CRAWLER-DEBUG] ❌ CSE 실패 (${(cseDuration / 1000).toFixed(2)}초):`);
        console.error(`[MASS-CRAWLER-DEBUG]    에러 타입: ${error?.name || 'Unknown'}`);
        console.error(`[MASS-CRAWLER-DEBUG]    에러 메시지: ${error?.message || String(error)}`);
        console.error(`[MASS-CRAWLER-DEBUG]    에러 코드: ${error?.code || 'N/A'}`);
        console.error(`[MASS-CRAWLER-DEBUG]    에러 스택:`, error?.stack || 'N/A');
        this.logger.error('CSE 실패:', error);
      }
    } else {
      if (!this.cseCrawler) {
        console.log(`[MASS-CRAWLER-DEBUG] ⚠️ CSE 크롤러가 초기화되지 않음`);
      } else {
        console.log(`[MASS-CRAWLER-DEBUG] ⚠️ CSE 건너뜀 (이미 충분한 데이터: ${allItems.length}/${maxResults * 0.8})`);
      }
    }

    // 중복 제거 및 정렬
    this.performanceMonitor.startMeasurement('deduplication');
    let uniqueItems = this.deduplicateAndSort(allItems);
    const duplicatesRemoved = allItems.length - uniqueItems.length;
    this.performanceMonitor.endMeasurement('deduplication', {
      original: allItems.length,
      unique: uniqueItems.length,
      removed: duplicatesRemoved
    });

    this.logger.info(`중복 제거: ${duplicatesRemoved}개 제거`);
    this.logger.info(`최종 수집: ${uniqueItems.length}개`);

    // 🔧 결과가 부족하면 마지막에 네이버 블로그 폴백 허용
    const minRequiredResults = Math.floor(maxResults * 0.3); // 최소 30% 이상 필요
    if (uniqueItems.length < minRequiredResults && this.naverCrawler) {
      console.log(`[MASS-CRAWLER] ⚠️ 결과 부족 (${uniqueItems.length}/${minRequiredResults}), 네이버 블로그 폴백 시작...`);
      this.logger.warn(`결과 부족, 네이버 블로그 폴백 시작: ${uniqueItems.length}/${minRequiredResults}`);

      try {
        const fallbackTarget = minRequiredResults - uniqueItems.length;
        console.log(`[MASS-CRAWLER] 🔄 네이버 블로그 폴백 크롤링: ${fallbackTarget}개 목표`);

        // 네이버 블로그 검색 API 사용 (폴백용)
        const blogUrl = 'https://openapi.naver.com/v1/search/blog.json';
        const blogParams = {
          query: keyword,
          display: Math.min(100, fallbackTarget),
          start: 1,
          sort: 'sim'
        };

        const blogResponse = await axios.get(blogUrl, {
          params: blogParams,
          headers: {
            'X-Naver-Client-Id': (this.naverCrawler as any).clientId,
            'X-Naver-Client-Secret': (this.naverCrawler as any).clientSecret,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        });

        if (blogResponse.data?.items) {
          // 텍스트 정리 유틸리티 함수
          const cleanText = (text: string): string => {
            return text
              .replace(/<[^>]*>/g, '') // HTML 태그 제거
              .replace(/&[a-zA-Z0-9#]+;/g, ' ') // HTML 엔티티 제거
              .replace(/\s+/g, ' ') // 공백 정리
              .trim();
          };

          const blogItems: MassCrawledItem[] = blogResponse.data.items
            .map((item: any) => ({
              title: cleanText(item.title),
              description: cleanText(item.description),
              link: item.link,
              pubDate: item.postdate || new Date().toISOString(),
              author: item.bloggername || '',
              source: 'naver' as const,
              popularityScore: 1 // 폴백이므로 낮은 점수
            }));

          // 기존 항목과 중복 제거
          const existingUrls = new Set(uniqueItems.map(item => item.link));
          const newBlogItems = blogItems.filter(item => !existingUrls.has(item.link));

          if (newBlogItems.length > 0) {
            uniqueItems.push(...newBlogItems);
            naverCount += newBlogItems.length;
            console.log(`[MASS-CRAWLER] ✅ 네이버 블로그 폴백 완료: ${newBlogItems.length}개 추가`);
            this.logger.success(`네이버 블로그 폴백: ${newBlogItems.length}개 추가`);
          }
        }
      } catch (error: any) {
        console.warn(`[MASS-CRAWLER] ⚠️ 네이버 블로그 폴백 실패:`, error?.message || error);
        this.logger.warn(`네이버 블로그 폴백 실패: ${error?.message || String(error)}`);
      }
    }

    // 전체 본문 크롤링 (옵션)
    let fullContentCount = 0;
    if (enableFullContent && this.naverCrawler) {
      this.performanceMonitor.startMeasurement('full-content-crawl');
      this.logger.info('전체 본문 크롤링 시작...');

      // 본문 크롤링 개수 제한 (너무 많은 크롤링 방지)
      const fullContentLimit = Math.min(10, maxConcurrent); // 최대 10개로 제한
      const topItems = uniqueItems.slice(0, fullContentLimit);
      const limiter = pLimit(Math.min(3, maxConcurrent)); // 동시성 3개로 제한 (너무 많은 브라우저 방지)

      console.log(`[MassCrawlingSystem] 📄 본문 크롤링 시작: ${topItems.length}개 항목`);

      // Promise.allSettled 사용 (일부 실패해도 계속 진행)
      const results = await Promise.allSettled(
        topItems.map((item, index) =>
          limiter(async () => {
            try {
              if (item.source === 'naver' && this.naverCrawler) {
                console.log(`[MassCrawlingSystem] 📄 본문 크롤링 중 (${index + 1}/${topItems.length}): ${item.link.substring(0, 50)}...`);
                const fullContent = await this.naverCrawler.fetchFullContent(item.link);
                if (fullContent) {
                  const itemIndex = uniqueItems.findIndex(i => i.link === item.link);
                  if (itemIndex !== -1 && uniqueItems[itemIndex]) {
                    uniqueItems[itemIndex]!.fullContent = fullContent;
                    fullContentCount++;
                    const progress = Math.round((fullContentCount / topItems.length) * 100);
                    console.log(`[MassCrawlingSystem] ℹ️ 본문 ${fullContentCount}/${topItems.length} 완료 (${progress}%)`);
                    this.logger.info(`본문 ${fullContentCount}/${topItems.length} 완료`);
                  }
                }
              }
            } catch (error: any) {
              console.warn(`[MassCrawlingSystem] ⚠️ 본문 크롤링 실패 (${index + 1}/${topItems.length}):`, error?.message || error);
              // 실패해도 계속 진행
            }
          })
        )
      );

      // 실패한 항목 수 확인
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.warn(`[MassCrawlingSystem] ⚠️ 본문 크롤링 실패: ${failedCount}/${topItems.length}개`);
      }

      this.performanceMonitor.endMeasurement('full-content-crawl', { items: fullContentCount });
    }

    this.performanceMonitor.endMeasurement('total-crawl', {
      totalItems: uniqueItems.length,
      naverCount,
      rssCount,
      cseCount,
      fullContentCount
    });

    const processingTime = Date.now() - startTime;
    const stats: CrawlingStats = {
      totalItems: uniqueItems.length,
      naverCount,
      rssCount,
      cseCount,
      fullContentCount,
      duplicatesRemoved,
      processingTimeMs: processingTime
    };

    console.log(`[MASS-CRAWLER-DEBUG] 📊 최종 통계:`);
    console.log(`[MASS-CRAWLER-DEBUG]    총 처리 시간: ${(processingTime / 1000).toFixed(2)}초`);
    console.log(`[MASS-CRAWLER-DEBUG]    총 항목 수: ${uniqueItems.length}개`);
    console.log(`[MASS-CRAWLER-DEBUG]    네이버: ${naverCount}개`);
    console.log(`[MASS-CRAWLER-DEBUG]    RSS: ${rssCount}개`);
    console.log(`[MASS-CRAWLER-DEBUG]    CSE: ${cseCount}개`);
    console.log(`[MASS-CRAWLER-DEBUG]    중복 제거: ${duplicatesRemoved}개`);
    console.log(`[MASS-CRAWLER-DEBUG]    전체 본문: ${fullContentCount}개`);

    this.logger.success('통합 크롤링 완료!');
    this.logger.info(`통계: ${JSON.stringify(stats)}`);
    this.performanceMonitor.printReport();

    return {
      items: uniqueItems.slice(0, maxResults),
      stats
    };
  }

  /**
   * 중복 제거 및 정렬
   */
  private deduplicateAndSort(items: MassCrawledItem[]): MassCrawledItem[] {
    const seen = new Set<string>();
    const unique = items.filter(item => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });

    return unique.sort((a, b) => {
      // 인기도 점수 기반 정렬
      return b.popularityScore - a.popularityScore;
    });
  }

  /**
   * 제품 상세페이지 감지
   */
  private detectProductPage($: any, url: string): boolean {
    // URL 패턴으로 제품 페이지 감지
    const productUrlPatterns = [
      /\/product\//i,
      /\/item\//i,
      /\/goods\//i,
      /\/detail\//i,
      /\/p\//i,
      /\/shop\//i,
      /\/store\//i,
      /\/mall\//i,
      /\/shopping\//i
    ];

    if (productUrlPatterns.some(pattern => pattern.test(url))) {
      return true;
    }

    // 메타 태그로 제품 페이지 감지
    const ogType = $('meta[property="og:type"]').attr('content') || '';
    if (ogType === 'product' || ogType.includes('product')) {
      return true;
    }

    // JSON-LD 스키마로 제품 페이지 감지
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < jsonLdScripts.length; i++) {
      try {
        const jsonLd = JSON.parse($(jsonLdScripts[i]).html() || '{}');
        if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
          return true;
        }
        if (Array.isArray(jsonLd['@graph'])) {
          const hasProduct = jsonLd['@graph'].some((item: any) =>
            item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
          );
          if (hasProduct) return true;
        }
      } catch (e) {
        // JSON 파싱 실패 무시
      }
    }

    // 제품 관련 메타 태그 존재 여부
    const hasProductMeta =
      $('meta[property="product:price:amount"]').length > 0 ||
      $('meta[property="product:price:currency"]').length > 0 ||
      $('meta[property="og:product"]').length > 0 ||
      $('[itemtype*="Product"]').length > 0;

    if (hasProductMeta) {
      return true;
    }

    return false;
  }

  /**
   * 제품 상세페이지 데이터 추출
   */
  private extractProductData($: any, url: string): { title: string; description: string; text: string; price?: string; images?: string[] } | null {
    try {
      const productData: { title: string; description: string; text: string; price?: string; images?: string[] } = {
        title: '',
        description: '',
        text: ''
      };

      // 1. JSON-LD 스키마에서 제품 정보 추출
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const jsonLd = JSON.parse($(jsonLdScripts[i]).html() || '{}');
          let product: any = null;

          if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
            product = jsonLd;
          } else if (Array.isArray(jsonLd['@graph'])) {
            product = jsonLd['@graph'].find((item: any) =>
              item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
            );
          }

          if (product) {
            productData.title = product.name || productData.title;
            productData.description = product.description || productData.description;
            productData.text = product.description || productData.text;

            // 가격 정보
            if (product.offers) {
              const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
              if (offers.price) {
                productData.price = `${offers.price}${offers.priceCurrency || ''}`;
              }
            }

            // 이미지 정보
            if (product.image) {
              const images = Array.isArray(product.image) ? product.image : [product.image];
              productData.images = images.map((img: any) =>
                typeof img === 'string' ? img : (img.url || img)
              ).filter((img: any) => img);
            }
          }
        } catch (e) {
          // JSON 파싱 실패 무시
        }
      }

      // 2. Open Graph 메타 태그에서 제품 정보 추출
      if (!productData.title) {
        productData.title =
          $('meta[property="og:title"]').attr('content') ||
          $('meta[property="product:title"]').attr('content') ||
          '';
      }

      if (!productData.description) {
        productData.description =
          $('meta[property="og:description"]').attr('content') ||
          $('meta[property="product:description"]').attr('content') ||
          $('meta[name="description"]').attr('content') ||
          '';
      }

      // 가격 정보 (Open Graph)
      if (!productData.price) {
        const priceAmount = $('meta[property="product:price:amount"]').attr('content');
        const priceCurrency = $('meta[property="product:price:currency"]').attr('content') || '원';
        if (priceAmount) {
          productData.price = `${priceAmount}${priceCurrency}`;
        }
      }

      // 이미지 정보 (Open Graph)
      if (!productData.images || productData.images.length === 0) {
        const ogImage = $('meta[property="og:image"]').attr('content');
        if (ogImage) {
          productData.images = [ogImage];
        }
      }

      // 3. HTML 구조에서 제품 정보 추출 (폴백)
      if (!productData.title) {
        productData.title =
          $('h1.product-title').text() ||
          $('h1[itemprop="name"]').text() ||
          $('.product-name').text() ||
          $('title').text() ||
          $('h1').first().text() ||
          '';
      }

      if (!productData.description) {
        productData.description =
          $('.product-description').text() ||
          $('[itemprop="description"]').text() ||
          $('meta[name="description"]').attr('content') ||
          '';
      }

      if (!productData.text) {
        productData.text =
          $('.product-detail').text() ||
          $('.product-info').text() ||
          $('[itemprop="description"]').text() ||
          productData.description ||
          '';
      }

      // 가격 정보 (HTML)
      if (!productData.price) {
        productData.price =
          $('.product-price').text() ||
          $('[itemprop="price"]').text() ||
          $('.price').first().text() ||
          '';
      }

      // 이미지 정보 (HTML)
      if (!productData.images || productData.images.length === 0) {
        const images: string[] = [];
        $('img.product-image, img[itemprop="image"], .product-image img').each((_: any, img: any) => {
          const src = $(img).attr('src') || $(img).attr('data-src');
          if (src && !src.includes('data:') && !images.includes(src)) {
            images.push(src);
          }
        });
        if (images.length > 0) {
          productData.images = images;
        }
      }

      // 최소한 제목이나 설명이 있어야 유효한 제품 데이터로 간주
      if (productData.title || productData.description) {
        return productData;
      }

      return null;
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 제품 데이터 추출 실패 (${url}):`, error?.message || error);
      return null;
    }
  }

  /**
   * 제품 상세페이지 전용 크롤링 (Puppeteer 사용)
   */
  private async crawlProductDetailPage(
    url: string,
    manualItems: MassCrawledItem[],
    topic?: string,
    keywords?: string[],
    geminiKey?: string
  ): Promise<void> {
    let browser: any = null;
    try {
      const puppeteer = await import('puppeteer');
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const page = await browser.newPage();

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      // 제품 정보 추출
      const productData = await page.evaluate(() => {
        const getText = (selector: string) => {
          const el = document.querySelector(selector);
          return el ? (el.textContent || '').trim() : '';
        };

        const getAttr = (selector: string, attr: string) => {
          const el = document.querySelector(selector);
          return el ? (el.getAttribute(attr) || '') : '';
        };

        // JSON-LD 파싱
        let jsonLdProduct: any = null;
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of Array.from(jsonLdScripts)) {
          try {
            const jsonLd = JSON.parse(script.textContent || '{}');
            if (jsonLd['@type'] === 'Product' || jsonLd['@type'] === 'http://schema.org/Product') {
              jsonLdProduct = jsonLd;
              break;
            }
            if (Array.isArray(jsonLd['@graph'])) {
              const product = jsonLd['@graph'].find((item: any) =>
                item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product'
              );
              if (product) {
                jsonLdProduct = product;
                break;
              }
            }
          } catch (e) {
            // JSON 파싱 실패 무시
          }
        }

        const title =
          jsonLdProduct?.name ||
          getAttr('meta[property="og:title"]', 'content') ||
          getAttr('meta[property="product:title"]', 'content') ||
          getText('h1.product-title') ||
          getText('h1[itemprop="name"]') ||
          getText('.product-name') ||
          getText('h1') ||
          getText('title') ||
          '';

        const description =
          jsonLdProduct?.description ||
          getAttr('meta[property="og:description"]', 'content') ||
          getAttr('meta[property="product:description"]', 'content') ||
          getAttr('meta[name="description"]', 'content') ||
          getText('.product-description') ||
          getText('[itemprop="description"]') ||
          '';

        const text =
          description ||
          getText('.product-detail') ||
          getText('.product-info') ||
          getText('[itemprop="description"]') ||
          '';

        const price =
          jsonLdProduct?.offers?.price ||
          getAttr('meta[property="product:price:amount"]', 'content') ||
          getText('.product-price') ||
          getText('[itemprop="price"]') ||
          getText('.price') ||
          '';

        const images: string[] = [];
        if (jsonLdProduct?.image) {
          const imgArray = Array.isArray(jsonLdProduct.image) ? jsonLdProduct.image : [jsonLdProduct.image];
          imgArray.forEach((img: any) => {
            const imgUrl = typeof img === 'string' ? img : (img.url || img);
            if (imgUrl && !imgUrl.includes('data:')) {
              images.push(imgUrl);
            }
          });
        }

        if (images.length === 0) {
          const ogImage = getAttr('meta[property="og:image"]', 'content');
          if (ogImage) images.push(ogImage);
        }

        if (images.length === 0) {
          document.querySelectorAll('img.product-image, img[itemprop="image"], .product-image img').forEach((img) => {
            const src = img.getAttribute('src') || img.getAttribute('data-src');
            if (src && !src.includes('data:') && !images.includes(src)) {
              images.push(src);
            }
          });
        }

        return { title, description, text, price, images };
      });

      if (productData && (productData.title || productData.description)) {
        manualItems.push({
          title: productData.title || '제품 상세페이지',
          description: productData.description || productData.text || '',
          link: url,
          pubDate: new Date().toISOString(),
          source: 'manual',
          popularityScore: 1000,
          productData: {
            title: productData.title,
            description: productData.description,
            text: productData.text,
            price: productData.price,
            images: productData.images
          }
        });
        console.log(`[MASS-CRAWLER] ✅ 제품 상세페이지 크롤링 완료 (Puppeteer): ${url}`);
      }
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 제품 상세페이지 크롤링 실패 (${url}):`, error?.message || error);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          // 브라우저 종료 실패 무시
        }
      }
    }
  }

  /**
   * 소제목 분석 결과를 이미지 프롬프트에 자동 포함하여 라이브러리에 저장
   */
  private async saveImagePromptWithSubtopic(
    topic: string,
    keywords: string[],
    subtopic: string,
    imagePath: string,
    description: string
  ): Promise<void> {
    try {
      const library = await readSnippetLibrary();

      // 소제목 분석을 위한 프롬프트 생성
      const imagePrompt = `High-quality product photography of ${subtopic}, ${description.substring(0, 100)}. Professional lighting, clean background, Korean market style, ${keywords.slice(0, 3).join(', ')}`;

      const newSnippet = {
        id: `affiliate-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        type: 'imagePrompt' as const,
        prompt: imagePrompt,
        style: 'product',
        sectionIds: [],
        tone: 'professional',
        tags: ['제휴마케팅', '제품', subtopic, ...keywords.slice(0, 3)],
        description: `${subtopic} - ${description.substring(0, 50)}`,
        category: topic,
        usageCount: 0,
      };

      library.imagePrompts.push(newSnippet);
      await writeSnippetLibrary(library);

      console.log(`[MASS-CRAWLER] ✅ 이미지 프롬프트 라이브러리에 저장 완료: ${subtopic}`);
    } catch (error: any) {
      console.warn(`[MASS-CRAWLER] ⚠️ 이미지 프롬프트 저장 실패:`, error?.message || error);
    }
  }
}
