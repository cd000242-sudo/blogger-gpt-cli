/**
 * 네이버 블로그 스마트블록 추출 및 분석
 * 네이버 블로그의 구조화된 콘텐츠 블록을 추출하여 키워드 분석에 활용
 */

export interface NaverApiConfig {
  clientId: string;
  clientSecret: string;
}

export interface SmartBlock {
  type: string; // 블록 타입 (예: 'text', 'image', 'video', 'table', 'quote' 등)
  content: string; // 블록 내용
  keywords: string[]; // 추출된 키워드
  order: number; // 블록 순서
}

/**
 * 네이버 블로그 URL에서 스마트블록 추출 (보안 우회 및 안정성 개선)
 */
export async function extractSmartBlocksFromNaverBlog(
  blogUrl: string,
  config: NaverApiConfig
): Promise<SmartBlock[]> {
  try {
    // 타임아웃 설정 (15초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      // 실제 브라우저처럼 보이는 헤더 설정 (보안 우회)
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Referer': 'https://www.naver.com/'
      };

      const response = await fetch(blogUrl, {
        signal: controller.signal,
        headers: headers,
        redirect: 'follow',
        // @ts-ignore - Node.js 환경에서 지원
        timeout: 15000
      } as any);

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 403, 429 등의 보안 응답은 조용히 처리
        if (response.status === 403 || response.status === 429) {
          console.warn(`[NAVER-SMART-BLOCK] 블로그 접근 제한 (${response.status}): ${blogUrl.substring(0, 50)}...`);
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      
      // 빈 HTML 체크
      if (!html || html.trim().length < 100) {
        console.warn('[NAVER-SMART-BLOCK] 빈 HTML 응답');
        return [];
      }

      const blocks = parseSmartBlocks(html);
      
      // 스마트블록이 추출되지 않은 경우, 기본 텍스트 블록 생성
      if (blocks.length === 0) {
        console.warn('[NAVER-SMART-BLOCK] 스마트블록 추출 실패, 기본 텍스트 블록 생성 시도');
        // HTML에서 기본 텍스트 추출 시도
        const fallbackContent = extractTextContent(html);
        if (fallbackContent && fallbackContent.length > 50) {
          return [{
            type: 'text',
            content: fallbackContent.substring(0, 500), // 최대 500자
            keywords: extractKeywords(fallbackContent),
            order: 0
          }];
        }
      }

      return blocks;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn('[NAVER-SMART-BLOCK] 타임아웃 발생');
      } else if (fetchError.message?.includes('403') || fetchError.message?.includes('429')) {
        console.warn('[NAVER-SMART-BLOCK] 접근 제한 (403/429)');
      } else {
        console.warn('[NAVER-SMART-BLOCK] 크롤링 실패:', fetchError.message || String(fetchError));
      }
      return [];
    }
  } catch (error: any) {
    console.warn('[NAVER-SMART-BLOCK] 스마트블록 추출 실패:', error?.message || String(error));
    return [];
  }
}

/**
 * HTML에서 스마트블록 파싱
 */
function parseSmartBlocks(html: string): SmartBlock[] {
  const blocks: SmartBlock[] = [];
  let order = 0;

  try {
    // 방법 1: se-module 클래스로 스마트블록 찾기
    const seModulePattern = /<div[^>]*class="[^"]*se-module[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    
    while ((match = seModulePattern.exec(html)) !== null && match[1]) {
      const blockHtml = match[1];
      const blockType = detectBlockType(blockHtml);
      const content = extractTextContent(blockHtml);
      const keywords = extractKeywords(content);
      
      if (content && content.trim().length > 0) {
        blocks.push({
          type: blockType,
          content: content,
          keywords: keywords,
          order: order++
        });
      }
    }

    // 방법 2: se-component 클래스로 스마트블록 찾기
    const seComponentPattern = /<div[^>]*class="[^"]*se-component[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let componentMatch;
    
    while ((componentMatch = seComponentPattern.exec(html)) !== null && componentMatch[1]) {
      const blockHtml = componentMatch[1];
      const blockType = detectBlockType(blockHtml);
      const content = extractTextContent(blockHtml);
      const keywords = extractKeywords(content);
      
      if (content && content.trim().length > 0 && !blocks.some(b => b.content === content)) {
        blocks.push({
          type: blockType,
          content: content,
          keywords: keywords,
          order: order++
        });
      }
    }

    // 방법 3: se-section 클래스로 섹션 단위 블록 찾기
    const seSectionPattern = /<div[^>]*class="[^"]*se-section[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let sectionMatch;
    
    while ((sectionMatch = seSectionPattern.exec(html)) !== null && sectionMatch[1]) {
      const blockHtml = sectionMatch[1];
      const blockType = detectBlockType(blockHtml);
      const content = extractTextContent(blockHtml);
      const keywords = extractKeywords(content);
      
      if (content && content.trim().length > 10 && !blocks.some(b => b.content === content)) {
        blocks.push({
          type: blockType,
          content: content,
          keywords: keywords,
          order: order++
        });
      }
    }

    console.log(`[NAVER-SMART-BLOCK] 스마트블록 ${blocks.length}개 추출 완료`);
    return blocks;
  } catch (error: any) {
    console.error('[NAVER-SMART-BLOCK] 스마트블록 파싱 실패:', error);
    return [];
  }
}

/**
 * 블록 타입 감지
 */
function detectBlockType(html: string): string {
  const htmlLower = html.toLowerCase();
  
  if (htmlLower.includes('se-image') || htmlLower.includes('se-imageText')) {
    return 'image';
  }
  if (htmlLower.includes('se-video') || htmlLower.includes('video')) {
    return 'video';
  }
  if (htmlLower.includes('table') || htmlLower.includes('<table')) {
    return 'table';
  }
  if (htmlLower.includes('quote') || htmlLower.includes('인용')) {
    return 'quote';
  }
  if (htmlLower.includes('list') || htmlLower.includes('<ul') || htmlLower.includes('<ol')) {
    return 'list';
  }
  if (htmlLower.includes('heading') || htmlLower.includes('<h1') || htmlLower.includes('<h2')) {
    return 'heading';
  }
  
  return 'text';
}

/**
 * HTML에서 텍스트 내용 추출
 */
function extractTextContent(html: string): string {
  // script, style 태그 제거
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
  
  // HTML 태그 제거
  text = text.replace(/<[^>]*>/g, ' ');
  
  // HTML 엔티티 디코딩
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  
  // 연속된 공백 제거
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * 텍스트에서 키워드 추출
 */
function extractKeywords(text: string): string[] {
  const keywords = new Set<string>();
  
  // 한글 명사 추출 (2-10자)
  const koreanNounPattern = /[가-힣]{2,10}/g;
  const matches = text.match(koreanNounPattern);
  
  if (matches) {
    matches.forEach(match => {
      if (match.length >= 2 && match.length <= 10) {
        // 불용어 필터링 (확장)
        const stopWords = [
          // 조사/부사
          '것', '수', '그', '이', '그것', '이것', '저것', '때', '경우', '중', '것이', '것을', '것을', '것도', '것만', '것이다', '것이라고', '것이며', '것으로', '것이다',
          '처음', '처음엔', '처음에', '처음부터', '처음으로', '처음부터', '처음에는',
          '나중', '나중에', '나중엔', '나중에는',
          '그래서', '그런데', '그러나', '그리고', '그런', '그럼', '그렇다면',
          '이제', '이미', '이미지', '이미지가', '이미지를',
          '다시', '다시는', '다시는', '다시는',
          '또한', '또', '또한', '또한',
          '하지만', '하지만', '하지만', '하지만',
          '그러면', '그러면', '그러면', '그러면',
          '그래도', '그래도', '그래도', '그래도',
          '그런가', '그런가', '그런가', '그런가',
          '그렇다면', '그렇다면', '그렇다면', '그렇다면',
          '그래서', '그래서', '그래서', '그래서',
          '그런데', '그런데', '그런데', '그런데',
          '그리고', '그리고', '그리고', '그리고',
          '그런', '그런', '그런', '그런',
          '그럼', '그럼', '그럼', '그럼',
          '그렇다면', '그렇다면', '그렇다면', '그렇다면',
          // 일반적인 부사/조사
          '있다', '없다', '된다', '된다', '된다', '된다',
          '하는', '하는', '하는', '하는',
          '하는데', '하는데', '하는데', '하는데',
          '하지만', '하지만', '하지만', '하지만',
          '하지만', '하지만', '하지만', '하지만',
          '하지만', '하지만', '하지만', '하지만',
          '하지만', '하지만', '하지만', '하지만',
          // 의미 없는 단어
          '이런', '저런', '그런', '어떤', '무엇', '누구', '언제', '어디', '어떻게', '왜',
          '이렇게', '저렇게', '그렇게', '어떻게', '무엇을', '누구를', '언제를', '어디를',
          '이것', '저것', '그것', '무엇', '누구', '언제', '어디',
          '이런', '저런', '그런', '어떤', '무엇', '누구', '언제', '어디',
          // 검색 의도가 없는 일반 단어
          '때문', '때문에', '때문이다', '때문이다',
          '위해', '위해서', '위해서', '위해서',
          '대해', '대해서', '대해서', '대해서',
          '관해', '관해서', '관해서', '관해서',
          '관련', '관련하여', '관련하여', '관련하여',
          '통해', '통해서', '통해서', '통해서',
          '통한', '통한', '통한', '통한',
          '통해', '통해서', '통해서', '통해서',
          '통한', '통한', '통한', '통한',
          // 최소 길이 체크 (2자 이하 제외)
        ];
        
        // 의미 있는 키워드만 허용 (최소 3자 이상, 또는 명사 패턴)
        const isMeaningful = match.length >= 3 && 
          !stopWords.includes(match) &&
          !match.match(/^(처음|나중|그래서|그런데|그리고|하지만|그러면|그래도|그런가|그렇다면)/) &&
          !match.match(/(때문|위해|대해|관해|관련|통해|통한)$/);
        
        if (isMeaningful) {
          keywords.add(match);
        }
      }
    });
  }
  
    // 연속된 명사구 추출 (2-3개 단어 조합) - 의미 있는 구문만
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const meaninglessWords = ['처음', '처음엔', '처음에', '나중', '나중에', '그래서', '그런데', '그리고', '하지만', '그러면', '그래도', '이제', '이미', '다시', '또한', '또', '이런', '저런', '그런', '어떤', '무엇', '누구', '언제', '어디', '때문', '위해', '대해', '관해', '관련', '통해', '통한'];
    
    for (let i = 0; i < words.length - 1; i++) {
      const phrase = `${words[i]} ${words[i + 1]}`.trim();
      // 의미 있는 구문만 허용 (불용어 포함 안 함, 최소 4자)
      if (phrase.length >= 4 && phrase.length <= 20 && 
          /^[가-힣\s]+$/.test(phrase) &&
          !meaninglessWords.some(w => phrase.includes(w))) {
        keywords.add(phrase);
      }
    }
    
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`.trim();
      // 의미 있는 구문만 허용 (불용어 포함 안 함, 최소 6자)
      if (phrase.length >= 6 && phrase.length <= 30 && 
          /^[가-힣\s]+$/.test(phrase) &&
          !meaninglessWords.some(w => phrase.includes(w))) {
        keywords.add(phrase);
      }
    }
  
  return Array.from(keywords).slice(0, 20); // 최대 20개
}

/**
 * 네이버 블로그 검색 API 응답에서 키워드 추출 (안전한 방법)
 */
function extractKeywordsFromApiItems(items: any[], baseKeyword: string): Map<string, number> {
  const keywordFrequency = new Map<string, number>();
  
  items.forEach((item: any) => {
    const title = (item.title || '').replace(/<[^>]*>/g, '').trim();
    const description = (item.description || '').replace(/<[^>]*>/g, '').trim();
    const fullText = `${title} ${description}`;
    
    // 제목과 설명에서 키워드 추출
    const keywords = extractKeywords(fullText);
    keywords.forEach(kw => {
      if (kw && kw.length >= 2 && kw !== baseKeyword) {
        keywordFrequency.set(kw, (keywordFrequency.get(kw) || 0) + 1);
      }
    });
  });
  
  return keywordFrequency;
}

/**
 * 네이버 블로그 검색 결과에서 스마트블록과 연관키워드 분석 (보안 개선 버전)
 */
export async function analyzeNaverBlogSmartBlocks(
  keyword: string,
  config: NaverApiConfig,
  maxResults: number = 10
): Promise<{
  smartBlocks: SmartBlock[];
  relatedKeywords: string[];
  topKeywords: Array<{ keyword: string; frequency: number }>;
}> {
  try {
    // 1. 네이버 블로그 검색 API (공식 API 사용 - 안전함)
    const apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
    const params = new URLSearchParams({
      query: keyword,
      display: String(Math.min(maxResults, 100)), // 최대 100개
      sort: 'sim'
    });

    const response = await fetch(`${apiUrl}?${params}`, {
      headers: {
        'X-Naver-Client-Id': config.clientId,
        'X-Naver-Client-Secret': config.clientSecret
      }
    });

    if (!response.ok) {
      console.warn(`[NAVER-SMART-BLOCK] API 호출 실패: ${response.status}`);
      return {
        smartBlocks: [],
        relatedKeywords: [],
        topKeywords: []
      };
    }

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) {
      console.warn('[NAVER-SMART-BLOCK] 검색 결과 없음');
      return {
        smartBlocks: [],
        relatedKeywords: [],
        topKeywords: []
      };
    }

    // 2. API 응답에서 바로 키워드 추출 (안전하고 빠름)
    const keywordFrequency = extractKeywordsFromApiItems(items, keyword);

    // 3. 실제 블로그 크롤링 시도 (선택적, 실패해도 계속 진행)
    const allSmartBlocks: SmartBlock[] = [];
    const crawledUrls = new Set<string>();
    let crawlSuccessCount = 0;
    let crawlFailCount = 0;

    // 상위 3개만 크롤링 시도 (시간과 보안 고려)
    const itemsToCrawl = items.slice(0, 3);
    
    for (const item of itemsToCrawl) {
      try {
        const blogUrl = item.link;
        
        // 중복 URL 방지
        if (crawledUrls.has(blogUrl)) continue;
        crawledUrls.add(blogUrl);

        // 각 블로그 크롤링 시도 (타임아웃 및 보안 처리 포함)
        const blocks = await Promise.race([
          extractSmartBlocksFromNaverBlog(blogUrl, config),
          new Promise<SmartBlock[]>((resolve) => {
            setTimeout(() => resolve([]), 15000); // 15초 타임아웃
          })
        ]);

        if (blocks && blocks.length > 0) {
          allSmartBlocks.push(...blocks);
          crawlSuccessCount++;
          
          // 크롤링한 블록에서 키워드 추가
          blocks.forEach(block => {
            block.keywords.forEach(kw => {
              if (kw && kw.length >= 2 && kw !== keyword) {
                keywordFrequency.set(kw, (keywordFrequency.get(kw) || 0) + 1);
              }
            });
          });
        } else {
          crawlFailCount++;
        }
        
        // API 호출 간격 조절 (보안을 위해 1초씩 대기)
        if (itemsToCrawl.indexOf(item) < itemsToCrawl.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        crawlFailCount++;
        console.warn(`[NAVER-SMART-BLOCK] 블로그 크롤링 실패: ${item.link?.substring(0, 50)}...`);
        // 실패해도 계속 진행
      }
    }

    // 4. 상위 키워드 추출
    const topKeywords = Array.from(keywordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30) // 최대 30개
      .map(([keyword, frequency]) => ({ keyword, frequency }));

    // 5. 연관키워드 생성 (의미 있는 키워드만 필터링)
    // - 크롤링 성공 시: 빈도 2회 이상
    // - 크롤링 실패 시: 빈도 1회 이상 (API 응답만으로도 충분)
    const minFrequency = crawlSuccessCount > 0 ? 2 : 1;
    const meaninglessPatterns = [
      /^처음/, /^나중/, /^그래서/, /^그런데/, /^그리고/, /^하지만/, /^그러면/, /^그래도/,
      /때문/, /위해/, /대해/, /관해/, /관련/, /통해/, /통한/,
      /^이런/, /^저런/, /^그런/, /^어떤/, /^무엇/, /^누구/, /^언제/, /^어디/,
      /^이제/, /^이미/, /^다시/, /^또한/, /^또$/
    ];
    
    const relatedKeywords = topKeywords
      .filter(item => {
        // 빈도 체크
        if (item.frequency < minFrequency) return false;
        
        // 의미 없는 패턴 제외
        if (meaninglessPatterns.some(pattern => pattern.test(item.keyword))) return false;
        
        // 최소 길이 체크 (3자 이상)
        if (item.keyword.length < 3) return false;
        
        // 검색 의도가 있는 키워드만 (명사 위주)
        return true;
      })
      .map(item => item.keyword)
      .slice(0, 20); // 최대 20개

    console.log(`[NAVER-SMART-BLOCK] 분석 완료: API 항목 ${items.length}개, 크롤링 성공 ${crawlSuccessCount}개, 실패 ${crawlFailCount}개, 스마트블록 ${allSmartBlocks.length}개, 연관키워드 ${relatedKeywords.length}개`);

    return {
      smartBlocks: allSmartBlocks,
      relatedKeywords: relatedKeywords,
      topKeywords: topKeywords
    };
  } catch (error: any) {
    console.error('[NAVER-SMART-BLOCK] 분석 실패:', error?.message || String(error));
    return {
      smartBlocks: [],
      relatedKeywords: [],
      topKeywords: []
    };
  }
}

