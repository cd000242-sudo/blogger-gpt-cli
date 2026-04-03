/**
 * 네이버 크롤링 우회 시스템
 * - User-Agent 로테이션
 * - 딜레이 및 Rate Limiting
 * - 헤더 위장
 * - 프록시 지원 (선택사항)
 * - 네이버 검색 API 지원
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as https from 'https';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as http from 'http';

export interface NaverCrawlOptions {
  useProxy?: boolean;
  proxyUrl?: string;
  timeout?: number;
  retries?: number;
  delayMs?: number;
}

export interface NaverApiCredentials {
  customerId: string;
  secretKey: string;
}

export interface NaverSearchResult {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  bloggerlink?: string;
  postdate?: string;
}

// 실제 브라우저처럼 보이는 User-Agent 리스트
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

// 랜덤 User-Agent 선택
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0]!;
}

// 딜레이 함수
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 네이버 검색 결과 크롤링
export async function crawlNaverSearch(
  query: string,
  options: NaverCrawlOptions = {}
): Promise<{ title: string; url: string; description: string }[]> {
  const {
    timeout = 15000,
    retries = 3,
    delayMs = 3000
  } = options;

  // 네이버 블로그 전용 검색 URL 사용 (더 안정적)
  const searchUrl = `https://search.naver.com/search.naver?where=post&query=${encodeURIComponent(query)}&sm=tab_jum`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NAVER] 검색 시도 ${attempt}/${retries}: "${query}"`);

      // 더 실제적인 브라우저 헤더 설정
      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'Referer': 'https://www.naver.com/',
        'DNT': '1',
        'Sec-GPC': '1'
      };

      // 더 긴 타임아웃과 재시도 간격
      await delay(delayMs * attempt); // 재시도할 때마다 더 오래 기다림

      // fetch로 HTML 가져오기
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: headers,
        // @ts-ignore - Node.js 환경에서 signal 사용
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // HTML이 너무 짧으면 차단된 것으로 간주
      if (html.length < 1000) {
        throw new Error('응답이 너무 짧습니다 (차단 가능성)');
      }

      // HTML 파싱 (정규식 사용 - 간단한 버전)
      const results = parseNaverSearchResults(html);

      if (results.length > 0) {
        console.log(`[NAVER] ✅ ${results.length}개의 검색 결과 수집 성공`);
        return results;
      }

      console.log(`[NAVER] ⚠️ 검색 결과 없음 (시도 ${attempt}/${retries})`);

      // 재시도 전 딜레이
      if (attempt < retries) {
        await delay(delayMs);
      }

    } catch (error: any) {
      console.error(`[NAVER] ❌ 크롤링 실패 (시도 ${attempt}/${retries}): ${error.message}`);

      if (attempt < retries) {
        await delay(delayMs * attempt); // 지수 백오프
      } else {
        throw new Error(`네이버 크롤링 실패: ${error.message}`);
      }
    }
  }

  return [];
}

// 네이버 블로그 글 크롤링
export async function crawlNaverBlogPost(
  blogUrl: string,
  options: NaverCrawlOptions = {}
): Promise<string> {
  const {
    timeout = 10000,
    retries = 3,
    delayMs = 2000
  } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NAVER-BLOG] 블로그 크롤링 시도 ${attempt}/${retries}: ${blogUrl}`);

      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.naver.com/',
        'Connection': 'keep-alive'
      };

      const response = await fetch(blogUrl, {
        method: 'GET',
        headers: headers,
        // @ts-ignore
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 블로그 본문 추출
      const content = extractNaverBlogContent(html);

      if (content && content.length > 100) {
        console.log(`[NAVER-BLOG] ✅ 블로그 내용 추출 성공 (${content.length}자)`);
        return content;
      }

      console.log(`[NAVER-BLOG] ⚠️ 블로그 내용 추출 실패 (시도 ${attempt}/${retries})`);

      if (attempt < retries) {
        await delay(delayMs);
      }

    } catch (error: any) {
      console.error(`[NAVER-BLOG] ❌ 크롤링 실패 (시도 ${attempt}/${retries}): ${error.message}`);

      if (attempt < retries) {
        await delay(delayMs * attempt);
      } else {
        throw new Error(`네이버 블로그 크롤링 실패: ${error.message}`);
      }
    }
  }

  return '';
}

// HTML에서 네이버 검색 결과 파싱
function parseNaverSearchResults(html: string): { title: string; url: string; description: string }[] {
  const results: { title: string; url: string; description: string }[] = [];

  try {
    // 네이버 통합검색 결과 파싱 (VIEW 영역)
    const viewPattern = /<a[^>]*class="[^"]*title_link[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = viewPattern.exec(html)) !== null && results.length < 10) {
      const url = match[1];
      const title = match[2]?.replace(/<[^>]*>/g, '').trim();

      if (url && title) {
        results.push({
          title: title,
          url: url,
          description: ''
        });
      }
    }

    // 블로그 검색 결과 파싱
    const blogPattern = /<a[^>]*class="[^"]*api_txt_lines[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    
    while ((match = blogPattern.exec(html)) !== null && results.length < 10) {
      const url = match[1];
      const title = match[2]?.replace(/<[^>]*>/g, '').trim();

      if (url && title && !results.some(r => r.url === url)) {
        results.push({
          title: title,
          url: url,
          description: ''
        });
      }
    }

    // 일반 검색 결과 파싱 (백업)
    const generalPattern = /<div[^>]*class="[^"]*total_tit[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    
    while ((match = generalPattern.exec(html)) !== null && results.length < 10) {
      const url = match[1];
      const title = match[2]?.replace(/<[^>]*>/g, '').trim();

      if (url && title && !results.some(r => r.url === url)) {
        results.push({
          title: title,
          url: url,
          description: ''
        });
      }
    }

  } catch (error: any) {
    console.error(`[NAVER] 파싱 오류: ${error.message}`);
  }

  return results;
}

// 네이버 블로그 본문 추출
function extractNaverBlogContent(html: string): string {
  try {
    // iframe 방식 블로그 (구형)
    let content = '';

    // se-main-container 클래스 (신형 스마트에디터)
    const seMainPattern = /<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
    const seMainMatch = html.match(seMainPattern);
    if (seMainMatch && seMainMatch[1]) {
      content = seMainMatch[1];
    }

    // post-view 클래스 (구형)
    if (!content) {
      const postViewPattern = /<div[^>]*class="[^"]*post-view[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
      const postViewMatch = html.match(postViewPattern);
      if (postViewMatch && postViewMatch[1]) {
        content = postViewMatch[1];
      }
    }

    // HTML 태그 제거 및 텍스트만 추출
    if (content) {
      // script, style 태그 제거
      content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
      
      // HTML 태그 제거
      content = content.replace(/<[^>]*>/g, ' ');
      
      // HTML 엔티티 디코딩
      content = content.replace(/&nbsp;/g, ' ');
      content = content.replace(/&lt;/g, '<');
      content = content.replace(/&gt;/g, '>');
      content = content.replace(/&amp;/g, '&');
      content = content.replace(/&quot;/g, '"');
      
      // 연속된 공백 제거
      content = content.replace(/\s+/g, ' ').trim();
      
      return content;
    }

  } catch (error: any) {
    console.error(`[NAVER] 본문 추출 오류: ${error.message}`);
  }

  return '';
}

// 네이버 이미지 검색
export async function crawlNaverImages(
  query: string,
  options: NaverCrawlOptions = {}
): Promise<string[]> {
  const {
    timeout = 10000,
    retries = 3,
    delayMs = 2000
  } = options;

  const imageUrl = `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(query)}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NAVER-IMAGE] 이미지 검색 시도 ${attempt}/${retries}: "${query}"`);

      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.naver.com/'
      };

      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: headers,
        // @ts-ignore
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 이미지 URL 추출
      const imageUrls = extractNaverImageUrls(html);

      if (imageUrls.length > 0) {
        console.log(`[NAVER-IMAGE] ✅ ${imageUrls.length}개의 이미지 URL 수집 성공`);
        return imageUrls;
      }

      console.log(`[NAVER-IMAGE] ⚠️ 이미지 없음 (시도 ${attempt}/${retries})`);

      if (attempt < retries) {
        await delay(delayMs);
      }

    } catch (error: any) {
      console.error(`[NAVER-IMAGE] ❌ 크롤링 실패 (시도 ${attempt}/${retries}): ${error.message}`);

      if (attempt < retries) {
        await delay(delayMs * attempt);
      }
    }
  }

  return [];
}

// HTML에서 네이버 이미지 URL 추출
function extractNaverImageUrls(html: string): string[] {
  const imageUrls: string[] = [];

  try {
    // 네이버 이미지 검색 결과에서 이미지 URL 추출
    const imgPattern = /<img[^>]*src="([^"]*)"[^>]*>/gi;
    let match;

    while ((match = imgPattern.exec(html)) !== null && imageUrls.length < 20) {
      const url = match[1];

      // 유효한 이미지 URL만 수집
      if (url && url.startsWith('http') && !url.includes('logo') && !url.includes('icon')) {
        imageUrls.push(url);
      }
    }

    // data-src 속성도 확인 (lazy loading)
    const dataSrcPattern = /<img[^>]*data-src="([^"]*)"[^>]*>/gi;
    
    while ((match = dataSrcPattern.exec(html)) !== null && imageUrls.length < 20) {
      const url = match[1];

      if (url && url.startsWith('http') && !imageUrls.includes(url)) {
        imageUrls.push(url);
      }
    }

  } catch (error: any) {
    console.error(`[NAVER-IMAGE] 파싱 오류: ${error.message}`);
  }

  return imageUrls;
}

// 네이버 뉴스 크롤링
export async function crawlNaverNews(
  query: string,
  options: NaverCrawlOptions = {}
): Promise<{ title: string; url: string; description: string; date: string }[]> {
  const {
    timeout = 10000,
    retries = 3,
    delayMs = 2000
  } = options;

  const newsUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NAVER-NEWS] 뉴스 검색 시도 ${attempt}/${retries}: "${query}"`);

      const headers = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.naver.com/'
      };

      const response = await fetch(newsUrl, {
        method: 'GET',
        headers: headers,
        // @ts-ignore
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // 뉴스 결과 파싱
      const searchResults = parseNaverSearchResults(html);
      const newsResults = searchResults.map(result => ({ ...result, date: '' }));

      if (newsResults.length > 0) {
        console.log(`[NAVER-NEWS] ✅ ${newsResults.length}개의 뉴스 수집 성공`);
        return newsResults;
      }

      console.log(`[NAVER-NEWS] ⚠️ 뉴스 없음 (시도 ${attempt}/${retries})`);

      if (attempt < retries) {
        await delay(delayMs);
      }
    } catch (error: any) {
      console.error(`[NAVER-NEWS] 뉴스 검색 오류 (시도 ${attempt}/${retries}): ${error.message}`);
      
      if (attempt < retries) {
        await delay(delayMs);
      } else {
        throw error;
      }
    }
  }

  return [];
}

// 네이버 검색 API를 사용한 검색 (공식 API)
export async function searchNaverWithApi(
  query: string,
  credentials: NaverApiCredentials,
  searchType: 'blog' | 'news' | 'webkr' = 'blog',
  options: NaverCrawlOptions = {}
): Promise<NaverSearchResult[]> {
  const {
    timeout = 10000,
    retries = 3,
    delayMs = 1000
  } = options;

  const { customerId, secretKey } = credentials;

  if (!customerId || !secretKey) {
    const errorMessage = `❌ 네이버 검색 API 키가 설정되지 않았습니다!

💡 해결 방법:
1. 설정 탭에서 네이버 API 키를 입력해주세요
2. Customer ID와 Secret Key가 모두 필요합니다
3. 네이버 개발자 센터(https://developers.naver.com)에서 발급받으세요

⚠️ API 키 없이는 네이버 검색 API를 사용할 수 없습니다.`;
    throw new Error(errorMessage);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[NAVER-API] ${searchType} 검색 시도 ${attempt}/${retries}: "${query}"`);

      // 네이버 검색 API URL
      const apiUrl = `https://openapi.naver.com/v1/search/${searchType}.json`;
      
      const params = new URLSearchParams({
        query: query,
        display: '10', // 최대 10개 결과
        start: '1',
        sort: 'sim' // 정확도순
      });

      const headers = {
        'X-Naver-Client-Id': customerId,
        'X-Naver-Client-Secret': secretKey,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`${apiUrl}?${params}`, {
        method: 'GET',
        headers: headers,
        // @ts-ignore
        signal: AbortSignal.timeout(timeout)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // 🔧 개선된 오류 처리: 사용자 친화적 메시지 + 크레딧 충전 안내
        if (response.status === 401 || response.status === 403) {
          const errorMessage = `❌ 네이버 검색 API 키 인증 실패! (${response.status})

💡 해결 방법:
1. 네이버 개발자 센터(https://developers.naver.com)에서 API 키 확인
2. Customer ID와 Secret Key가 정확한지 확인
3. 검색 API 사용 권한이 활성화되어 있는지 확인
4. API 키가 만료되지 않았는지 확인

⚠️ API 키가 유효하지 않거나
크레딧이 부족할 수 있습니다.
크레딧을 충전한 후 다시 시도해주세요.`;
          console.error(`[NAVER-API] ${errorMessage}`);
          throw new Error(errorMessage);
        }

        if (response.status === 429) {
          const errorMessage = `❌ 네이버 검색 API 할당량 초과! (429)

💡 해결 방법:
1. 잠시 후 다시 시도하세요 (1분 대기 권장)
2. 네이버 개발자 센터에서 사용량 확인
3. 필요시 유료 플랜으로 업그레이드

⚠️ 무료 할당량을 초과했습니다.
크레딧을 충전하거나 유료 플랜을 사용하세요.`;
          console.error(`[NAVER-API] ${errorMessage}`);
          throw new Error(errorMessage);
        }

        if (response.status === 500) {
          const errorMessage = `❌ 네이버 검색 서버 오류가 발생했습니다. (500)

💡 해결 방법:
1. 잠시 후 다시 시도해주세요
2. 네이버 개발자 센터 상태 페이지 확인
3. 문제가 지속되면 네이버 고객센터에 문의`;
          console.error(`[NAVER-API] ${errorMessage}`);
          throw new Error(errorMessage);
        }

        throw new Error(`네이버 검색 API 오류 ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.items || data.items.length === 0) {
        console.log(`[NAVER-API] ⚠️ ${searchType} 검색 결과 없음 (시도 ${attempt}/${retries})`);
        
        if (attempt < retries) {
          await delay(delayMs);
          continue;
        }
        return [];
      }

      // 결과 변환
      const results: NaverSearchResult[] = data.items.map((item: any) => ({
        title: item.title?.replace(/<[^>]*>/g, '') || '', // HTML 태그 제거
        link: item.link || '',
        description: item.description?.replace(/<[^>]*>/g, '') || '',
        bloggername: item.bloggername || '',
        bloggerlink: item.bloggerlink || '',
        postdate: item.postdate || ''
      }));

      console.log(`[NAVER-API] ✅ ${searchType} 검색 결과 ${results.length}개 수집 성공`);
      return results;

    } catch (error: any) {
      const errorMsg = error?.message || String(error || '').toLowerCase();
      console.error(`[NAVER-API] ${searchType} 검색 오류 (시도 ${attempt}/${retries}): ${errorMsg}`);
      
      // 🔧 개선된 오류 처리: catch 블록에서도 명확한 오류 메시지 제공
      if (errorMsg.includes('401') || errorMsg.includes('인증')) {
        const errorMessage = `❌ 네이버 검색 API 키 인증 실패! (401)

💡 해결 방법:
1. 네이버 개발자 센터(https://developers.naver.com)에서 API 키 확인
2. Customer ID와 Secret Key가 정확한지 확인
3. 검색 API 사용 권한이 활성화되어 있는지 확인

⚠️ API 키가 유효하지 않거나
크레딧이 부족할 수 있습니다.
크레딧을 충전한 후 다시 시도해주세요.`;
        if (attempt >= retries) {
          throw new Error(errorMessage);
        }
      } else if (errorMsg.includes('403') || errorMsg.includes('권한')) {
        const errorMessage = `❌ 네이버 검색 API 접근 거부! (403)

💡 해결 방법:
1. 네이버 개발자 센터에서 API 사용 권한 확인
2. 검색 API 서비스가 활성화되어 있는지 확인
3. API 키에 올바른 권한이 부여되어 있는지 확인

⚠️ API 사용 권한이 없거나
크레딧이 부족할 수 있습니다.
크레딧을 충전한 후 다시 시도해주세요.`;
        if (attempt >= retries) {
          throw new Error(errorMessage);
        }
      } else if (errorMsg.includes('429') || errorMsg.includes('할당량') || errorMsg.includes('한도')) {
        const errorMessage = `❌ 네이버 검색 API 할당량 초과! (429)

💡 해결 방법:
1. 잠시 후 다시 시도하세요 (1분 대기 권장)
2. 네이버 개발자 센터에서 사용량 확인
3. 필요시 유료 플랜으로 업그레이드

⚠️ 무료 할당량을 초과했습니다.
크레딧을 충전하거나 유료 플랜을 사용하세요.`;
        if (attempt >= retries) {
          throw new Error(errorMessage);
        }
      }
      
      if (attempt < retries) {
        await delay(delayMs);
      } else {
        throw error;
      }
    }
  }

  return [];
}

// 네이버 검색 API를 사용한 블로그 검색
export async function searchNaverBlogWithApi(
  query: string,
  credentials: NaverApiCredentials,
  options: NaverCrawlOptions = {}
): Promise<NaverSearchResult[]> {
  return searchNaverWithApi(query, credentials, 'blog', options);
}

// 네이버 검색 API를 사용한 뉴스 검색
export async function searchNaverNewsWithApi(
  query: string,
  credentials: NaverApiCredentials,
  options: NaverCrawlOptions = {}
): Promise<NaverSearchResult[]> {
  return searchNaverWithApi(query, credentials, 'news', options);
}

// 네이버 검색 API를 사용한 웹 검색
export async function searchNaverWebWithApi(
  query: string,
  credentials: NaverApiCredentials,
  options: NaverCrawlOptions = {}
): Promise<NaverSearchResult[]> {
  return searchNaverWithApi(query, credentials, 'webkr', options);
}

