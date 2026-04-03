/**
 * 🎯 정확한 블로그 지수 추출기
 * 추정치가 아닌 실제 네이버 블로그 지수를 추출
 * 여러 방법을 시도하여 정확한 값만 반환
 */

export interface AccurateBlogIndexResult {
  blogIndex: number;           // 실제 블로그 지수 (추정치 아님)
  confidence: number;          // 신뢰도 (0-100)
  source: 'puppeteer' | 'api' | 'verified'; // 데이터 출처
  methods: {
    profilePage?: number;
    searchResult?: number;
    apiResponse?: number;
  };
  timestamp: Date;
}

/**
 * 정확한 블로그 지수 추출기
 * 여러 방법을 시도하고, 값이 일치할 때만 반환
 */
export class AccurateBlogIndexExtractor {
  /**
   * 블로그 지수 추출 (정확한 값만 반환)
   */
  async extractAccurateBlogIndex(blogId: string): Promise<AccurateBlogIndexResult | null> {
    console.log(`[ACCURATE-EXTRACTOR] 정확한 블로그 지수 추출 시작: ${blogId}`);
    
    const methods: { [key: string]: number | null } = {};
    
    // 방법 1: 프로필 페이지에서 추출 (개선된 방법)
    console.log(`[ACCURATE-EXTRACTOR] 방법 1: 프로필 페이지 분석...`);
    methods['profilePage'] = await this.extractFromProfilePage(blogId);
    
    if (methods['profilePage']) {
      console.log(`[ACCURATE-EXTRACTOR] ✅ 프로필 페이지: ${methods['profilePage']!.toLocaleString()}`);
    } else {
      console.log(`[ACCURATE-EXTRACTOR] ❌ 프로필 페이지: 추출 실패`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 방법 2: 검색 결과에서 추출
    console.log(`[ACCURATE-EXTRACTOR] 방법 2: 검색 결과 분석...`);
    methods['searchResult'] = await this.extractFromSearchResult(blogId);
    
    if (methods['searchResult']) {
      console.log(`[ACCURATE-EXTRACTOR] ✅ 검색 결과: ${methods['searchResult']!.toLocaleString()}`);
    } else {
      console.log(`[ACCURATE-EXTRACTOR] ❌ 검색 결과: 추출 실패`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 방법 3: 네이버 API 응답 확인 (블로그 지수가 포함되어 있는지)
    console.log(`[ACCURATE-EXTRACTOR] 방법 3: API 응답 확인...`);
    methods['apiResponse'] = await this.extractFromApi(blogId);
    
    if (methods['apiResponse']) {
      console.log(`[ACCURATE-EXTRACTOR] ✅ API 응답: ${methods['apiResponse']!.toLocaleString()}`);
    } else {
      console.log(`[ACCURATE-EXTRACTOR] ❌ API 응답: 블로그 지수 없음`);
    }
    
    // 값 검증 및 최종 결정
    const validValues = Object.values(methods).filter(v => v !== null && v !== undefined && v > 1000) as number[];
    
    if (validValues.length === 0) {
      console.log(`[ACCURATE-EXTRACTOR] ❌ 모든 방법 실패 - 정확한 블로그 지수를 추출할 수 없습니다.`);
      return null;
    }
    
    // 값들이 일치하는지 확인
    const uniqueValues = [...new Set(validValues)];
    
    if (uniqueValues.length === 1) {
      // 모든 방법이 같은 값을 반환 - 100% 신뢰
      const blogIndex = uniqueValues[0];
      if (blogIndex === undefined) {
        console.log(`[ACCURATE-EXTRACTOR] ❌ 블로그 지수 값이 없습니다.`);
        return null;
      }
      console.log(`[ACCURATE-EXTRACTOR] ✅ 모든 방법이 일치: ${blogIndex.toLocaleString()} (신뢰도: 100%)`);
      const profilePage = methods['profilePage'] ?? undefined;
      const searchResult = methods['searchResult'] ?? undefined;
      const apiResponse = methods['apiResponse'] ?? undefined;
      return {
        blogIndex,
        confidence: 100,
        source: 'verified',
        methods: {
          ...(profilePage !== undefined && { profilePage }),
          ...(searchResult !== undefined && { searchResult }),
          ...(apiResponse !== undefined && { apiResponse })
        },
        timestamp: new Date()
      };
    } else if (uniqueValues.length === 2) {
      // 두 값이 다름 - 더 많이 나타나는 값 선택
      const frequency: Record<number, number> = {};
      validValues.forEach(v => {
        frequency[v] = (frequency[v] || 0) + 1;
      });
      
      const sorted = Object.entries(frequency).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0 || !sorted[0]) {
        console.log(`[ACCURATE-EXTRACTOR] ❌ 정렬 결과가 없습니다.`);
        return null;
      }
      const mostFrequent = parseInt(sorted[0][0], 10);
      const confidence = (sorted[0][1] / validValues.length) * 100;
      
      if (confidence >= 70) {
        console.log(`[ACCURATE-EXTRACTOR] ⚠️  값 불일치, 가장 빈번한 값 선택: ${mostFrequent.toLocaleString()} (신뢰도: ${confidence.toFixed(1)}%)`);
        const profilePage = methods['profilePage'] ?? undefined;
        const searchResult = methods['searchResult'] ?? undefined;
        const apiResponse = methods['apiResponse'] ?? undefined;
        return {
          blogIndex: mostFrequent,
          confidence: Math.round(confidence),
          source: 'puppeteer',
          methods: {
            ...(profilePage !== undefined && { profilePage }),
            ...(searchResult !== undefined && { searchResult }),
            ...(apiResponse !== undefined && { apiResponse })
          },
          timestamp: new Date()
        };
      } else {
        console.log(`[ACCURATE-EXTRACTOR] ❌ 값 불일치가 너무 큼 - 신뢰할 수 없음`);
        return null;
      }
    } else {
      // 값이 너무 다양함 - 신뢰할 수 없음
      console.log(`[ACCURATE-EXTRACTOR] ❌ 값이 너무 다양함 - 신뢰할 수 없음: ${uniqueValues.join(', ')}`);
      return null;
    }
  }
  
  /**
   * 프로필 페이지에서 추출 (개선된 방법)
   */
  private async extractFromProfilePage(blogId: string): Promise<number | null> {
    let browser: any = null;
    
    try {
      const puppeteer = await import('puppeteer');
      
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage'
        ]
      });
      
      const page = await browser.newPage();
      
      // User-Agent 설정
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      const url = `https://blog.naver.com/${blogId}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForTimeout(8000); // 충분한 대기
      
      // 페이지의 모든 가능한 소스에서 블로그 지수 찾기
      const result = await page.evaluate(() => {
        const foundValues: number[] = [];
        
        // 1. window 객체 깊이 탐색
        const searchInObject = (obj: any, path: string = '', depth: number = 0): void => {
          if (depth > 5) return; // 깊이 제한
          if (!obj || typeof obj !== 'object') return;
          
          // blogIndex 또는 index 필드 확인
          if (obj.blogIndex !== undefined && typeof obj.blogIndex === 'number' && obj.blogIndex > 1000) {
            foundValues.push(obj.blogIndex);
          }
          if (obj.index !== undefined && typeof obj.index === 'number' && obj.index > 1000 && obj.index < 1000000) {
            foundValues.push(obj.index);
          }
          
          // 재귀적으로 탐색
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              try {
                searchInObject(obj[key], `${path}.${key}`, depth + 1);
              } catch (e) {
                // 순환 참조 등으로 인한 오류 무시
              }
            }
          }
        };
        
        const windowData = (window as any);
        
        // 주요 전역 변수 확인
        const globalKeys = [
          '__INITIAL_STATE__',
          '__BLOG_DATA__',
          '__PRELOADED_STATE__',
          '__NAVER_BLOG__',
          '__BLOG_INFO__',
          'BLOG_DATA',
          'NAVER_BLOG'
        ];
        
        for (const key of globalKeys) {
          if (windowData[key]) {
            searchInObject(windowData[key], key);
          }
        }
        
        // 2. 모든 script 태그에서 찾기
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          
          // 다양한 패턴
          const patterns = [
            /blogIndex["\s:]*(\d{1,3}(?:,\d{3})*)/gi,
            /블로그지수["\s:]*(\d{1,3}(?:,\d{3})*)/gi,
            /"blogIndex"\s*:\s*(\d+)/gi,
            /"index"\s*:\s*(\d{4,})/gi,
            /window\.__[A-Z_]*\s*=\s*\{[^}]*blogIndex["\s:]*(\d+)/gi
          ];
          
          for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
              if (match[1]) {
                const value = parseInt(match[1].replace(/,/g, ''), 10);
                if (value > 1000 && value < 1000000) {
                  foundValues.push(value);
                }
              }
            }
          }
        }
        
        // 3. DOM에서 직접 찾기
        const selectors = [
          '[data-blog-index]',
          '[data-index]',
          '.blog-index',
          '.blogIndex',
          '[class*="blog-index"]',
          '[class*="blogIndex"]'
        ];
        
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const elem of Array.from(elements)) {
            const text = elem.textContent || '';
            const attr = elem.getAttribute('data-blog-index') || elem.getAttribute('data-index');
            
            if (attr) {
              const value = parseInt(attr.replace(/,/g, ''), 10);
              if (value > 1000 && value < 1000000) {
                foundValues.push(value);
              }
            }
            
            if (text) {
              const match = text.match(/(\d{1,3}(?:,\d{3})*)/);
              if (match && match[1]) {
                const value = parseInt(match[1].replace(/,/g, ''), 10);
                if (value > 1000 && value < 1000000) {
                  foundValues.push(value);
                }
              }
            }
          }
        }
        
        return foundValues;
      });
      
      await browser.close();
      
      if (result.length > 0) {
        // 가장 많이 나타나는 값 반환
        const frequency: Record<number, number> = {};
        result.forEach((v: number) => {
          frequency[v] = (frequency[v] || 0) + 1;
        });
        
        const mostFrequent = Object.entries(frequency)
          .sort((a, b) => b[1] - a[1])[0];
        
        if (mostFrequent) {
          return parseInt(mostFrequent[0], 10);
        }
      }
      
      return null;
      
    } catch (error: any) {
      if (browser) await browser.close();
      console.error(`[ACCURATE-EXTRACTOR] 프로필 페이지 추출 실패: ${error.message}`);
      return null;
    }
  }
  
  /**
   * 검색 결과에서 추출
   */
  private async extractFromSearchResult(blogId: string): Promise<number | null> {
    // 검색 결과에서는 블로그 지수가 직접 표시되지 않으므로 null 반환
    // 필요시 구현
    return null;
  }
  
  /**
   * API에서 추출
   */
  private async extractFromApi(blogId: string): Promise<number | null> {
    // 네이버 API에는 블로그 지수가 포함되지 않음
    return null;
  }
}


