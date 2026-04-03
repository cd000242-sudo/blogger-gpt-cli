// 실시간 검색어 크롤링 유틸리티
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RealtimeKeyword {
  keyword: string;
  rank: number;
  source: 'zum' | 'google' | 'nate' | 'daum' | 'naver' | 'bokjiro' | 'youtube';
  timestamp: string;
  change?: 'up' | 'down' | 'new' | 'stable';
  previousRank?: number;
  searchVolume?: number;
  changeRate?: number;
}

/**
 * ZUM 실시간 검색어 크롤링
 */
export async function getZumRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[ZUM-REALTIME] ========== ZUM 실시간 검색어 수집 시작 (시도 ${attempt}/${MAX_RETRIES}) ==========`);
      const keywords: RealtimeKeyword[] = [];
      
      console.log('[ZUM-REALTIME] ZUM 메인 페이지에서 실시간 검색어 크롤링');
      const urls = [
        'https://www.zum.com/',
        'https://zum.com/',
        'https://m.zum.com/'
      ];
      
      let response;
      for (const url of urls) {
        try {
          console.log(`[ZUM-REALTIME] HTML 페이지 요청: ${url}`);
          response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              'Referer': 'https://www.zum.com/',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            timeout: 20000,
            validateStatus: (status) => status < 500,
            maxRedirects: 5
          });
          
          console.log(`[ZUM-REALTIME] HTML 응답: ${url} - 상태: ${response.status}, 길이: ${response.data?.length || 0} bytes`);
          
          if (response.status === 200 && response.data) {
            break;
          }
        } catch (err: any) {
          console.warn(`[ZUM-REALTIME] HTML 요청 실패 (${url}):`, {
            message: err?.message,
            status: err?.response?.status,
            code: err?.code
          });
        }
      }
    
      if (response && response.data) {
        const fullHtml = response.data;
        console.log(`[ZUM-REALTIME] HTML 파싱 시작, HTML 길이: ${fullHtml?.length || 0}`);
        
        // 실시간 검색어 관련 키워드 확인
        const realtimeMatch = fullHtml.match(/실시간[\s\S]{0,500}/i);
        console.log(`[ZUM-REALTIME] "실시간" 키워드 발견: ${realtimeMatch ? '있음' : '없음'}`);
        
        // 디버깅: 실제 매칭된 내용 출력
        if (realtimeMatch) {
          console.log(`[ZUM-REALTIME] 실시간 섹션 샘플:`, realtimeMatch[0].substring(0, 200));
        }
        
        // Cheerio로 DOM 파싱
        const $ = cheerio.load(fullHtml);
        
        // 방법 1: JSON 데이터 추출 (스크립트 태그에서)
        console.log('[ZUM-REALTIME] 방법 1: 스크립트 태그에서 JSON 데이터 추출');
        const scriptTags = $('script');
        console.log(`[ZUM-REALTIME] 발견된 스크립트 태그: ${scriptTags.length}개`);
        
        $('script').each((_i, scriptEl) => {
          if (keywords.length >= limit) return;
          
          const scriptContent = $(scriptEl).html() || '';
          if (scriptContent.length < 50) return; // 너무 짧은 스크립트는 스킵
          
          // ZUM JSON 패턴들 (더 많은 패턴 추가)
          const jsonPatterns = [
            /window\.zum\s*=\s*JSON\.parse\(['"]([^'"]+)['"]\)/,
            /guideQuery\s*[:=]\s*(\{[^}]+\})/s,
            /realtimeKeywords\s*[:=]\s*(\[[^\]]+\])/s,
            /issueKeywords\s*[:=]\s*(\[[^\]]+\])/s,
            /trendKeywords\s*[:=]\s*(\[[^\]]+\])/s,
            /"keyword"\s*:\s*"([^"]+)"/g,
            /"query"\s*:\s*"([^"]+)"/g,
            /"title"\s*:\s*"([^"]+)"/g,
            /"text"\s*:\s*"([^"]+)"/g,
            /"word"\s*:\s*"([^"]+)"/g,
            /"name"\s*:\s*"([^"]+)"/g
          ];
          
          for (const pattern of jsonPatterns) {
            if (keywords.length >= limit) break;
            
            let match;
            while ((match = pattern.exec(scriptContent)) !== null && keywords.length < limit) {
              const jsonStr = match[1];
              if (!jsonStr) continue;
              
              try {
                // JSON 문자열인 경우 파싱
                if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
                  const data = JSON.parse(jsonStr);
                  if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                      if (keywords.length >= limit) return;
                      const keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.query || item.word || item.name || '');
                      if (keyword && keyword.length > 1 && keyword.length < 50 &&
                          !keyword.includes('http') &&
                          !keyword.includes('🔥') &&
                          !keyword.includes('뉴스') &&
                          !keyword.includes('문서') &&
                          !keyword.includes('검색') &&
                          !keyword.includes('더보기') &&
                          !/^[a-zA-Z\s]+$/.test(keyword)) {
                        keywords.push({
                          rank: keywords.length + 1,
                          keyword: keyword.trim(),
                          source: 'zum',
                          timestamp: new Date().toISOString()
                        });
                        console.log(`[ZUM-REALTIME] JSON에서 키워드 발견: ${keyword}`);
                      }
                    });
                  } else if (data.keywords || data.items || data.list || data.data) {
                    const keywordList = data.keywords || data.items || data.list || data.data || [];
                    keywordList.forEach((item: any) => {
                      if (keywords.length >= limit) return;
                      const keyword = typeof item === 'string' ? item : (item.keyword || item.text || item.title || item.query || item.word || item.name || '');
                      if (keyword && keyword.length > 1 && keyword.length < 50 &&
                          !keyword.includes('http') &&
                          !keyword.includes('🔥') &&
                          !keyword.includes('뉴스') &&
                          !keyword.includes('문서') &&
                          !keyword.includes('검색') &&
                          !keyword.includes('더보기') &&
                          !/^[a-zA-Z\s]+$/.test(keyword)) {
                        keywords.push({
                          rank: keywords.length + 1,
                          keyword: keyword.trim(),
                          source: 'zum',
                          timestamp: new Date().toISOString()
                        });
                        console.log(`[ZUM-REALTIME] JSON에서 키워드 발견: ${keyword}`);
                      }
                    });
                  }
                } else {
                  // 단순 문자열인 경우
                  const keyword = jsonStr.trim();
                  if (keyword && keyword.length > 1 && keyword.length < 50 &&
                      !keyword.includes('http') &&
                      !keyword.includes('🔥') &&
                      !keyword.includes('뉴스') &&
                      !keyword.includes('문서') &&
                      !keyword.includes('검색') &&
                      !keyword.includes('더보기') &&
                      !/^[a-zA-Z\s]+$/.test(keyword)) {
                    if (!keywords.some(k => k.keyword === keyword)) {
                      keywords.push({
                        rank: keywords.length + 1,
                        keyword: keyword,
                        source: 'zum',
                        timestamp: new Date().toISOString()
                      });
                      console.log(`[ZUM-REALTIME] 패턴에서 키워드 발견: ${keyword}`);
                    }
                  }
                }
              } catch (parseError) {
                // 파싱 실패 무시
              }
            }
          }
        });
        
        console.log(`[ZUM-REALTIME] JSON 파싱 후 키워드 개수: ${keywords.length}`);
        
        // 방법 2: HTML DOM 파싱 (실시간 검색어 섹션 찾기)
        if (keywords.length < limit) {
          console.log('[ZUM-REALTIME] HTML DOM 파싱 시도');
          
          const selectors = [
            'a[href*="/search?q="]',
            'a[href*="/search?query="]',
            'a[href*="search"]',
            '.realtime_keyword a',
            '.keyword_list a',
            '.rank_list a',
            '.issue_keyword a',
            'li[class*="rank"] a',
            'li[class*="keyword"] a',
            'li[class*="issue"] a',
            '[class*="realtime"] a',
            '[class*="issue"] a',
            'ol li a',
            'ul li a',
            'div[class*="keyword"] a',
            'div[class*="rank"] a',
            'div[class*="issue"] a'
          ];
          
          const tempKeywords = new Set<string>();
          
          for (const selector of selectors) {
            if (tempKeywords.size >= limit) break;
            
            const elements = $(selector);
            console.log(`[ZUM-REALTIME] 선택자 "${selector}": ${elements.length}개 발견`);
            
            for (let idx = 0; idx < elements.length && tempKeywords.size < limit * 2; idx++) {
              const el = elements.eq(idx);
              let keyword = el.text().trim();
              
              // href에서 키워드 추출 (우선순위 높음)
              const href = el.attr('href') || '';
              if (href) {
                const hrefMatch = href.match(/[?&](?:q|query|keyword)=([^&]+)/);
                if (hrefMatch && hrefMatch[1]) {
                  try {
                    const decoded = decodeURIComponent(hrefMatch[1]).trim();
                    if (decoded && decoded.length > 1) {
                      keyword = decoded;
                    }
                  } catch (e) {
                    // 디코딩 실패 무시
                  }
                }
              }
              
              // data 속성에서 키워드 추출
              if (!keyword || keyword.length < 2) {
                keyword = el.attr('data-keyword') || el.attr('data-query') || el.attr('data-text') || '';
              }
              
              // 키워드 정제
              keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
              
              if (keyword && 
                  keyword.length >= 2 && 
                  keyword.length < 50 &&
                  !keyword.includes('http') &&
                  !keyword.includes('://') &&
                  !keyword.includes('🔥') &&
                  !keyword.includes('뉴스') &&
                  !keyword.includes('문서') &&
                  !keyword.includes('검색') &&
                  !keyword.includes('더보기') &&
                  !keyword.includes('전체보기') &&
                  !keyword.match(/^(제목|내용|링크|URL|이미지|사진|영상|동영상|비디오)$/i) &&
                  !/^[a-zA-Z\s]+$/.test(keyword)) {
                tempKeywords.add(keyword);
                console.log(`[ZUM-REALTIME] HTML에서 키워드 발견: ${keyword}`);
              }
            }
            
            if (tempKeywords.size >= 5) {
              console.log(`[ZUM-REALTIME] 선택자 "${selector}"에서 ${tempKeywords.size}개 키워드 발견`);
              break;
            }
          }
          
          // Set에서 키워드 추가
          Array.from(tempKeywords).slice(0, limit).forEach((keyword, idx) => {
            if (!keywords.some(k => k.keyword === keyword)) {
              keywords.push({
                rank: keywords.length + 1,
                keyword: keyword,
                source: 'zum',
                timestamp: new Date().toISOString()
              });
            }
          });
        }
        
        // 키워드 수집 성공 시 즉시 반환
        if (keywords.length >= 5) {
          console.log(`[ZUM-REALTIME] ✅ 수집 완료: ${keywords.length}개 키워드 (시도 ${attempt}/${MAX_RETRIES})`);
          
          // 중복 제거
          const uniqueKeywords = Array.from(
            new Map(keywords.map(k => [k.keyword, k])).values()
          );
          
          return uniqueKeywords.slice(0, limit);
        }
        
        console.warn(`[ZUM-REALTIME] ⚠️ 키워드 부족: ${keywords.length}개만 수집됨`);
      }
      
      // 재시도
      if (attempt < MAX_RETRIES) {
        console.log(`[ZUM-REALTIME] ${RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
      
    } catch (error: any) {
      console.error(`[ZUM-REALTIME] ❌ 시도 ${attempt} 실패:`, {
        message: error?.message,
        status: error?.response?.status,
        code: error?.code
      });
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  console.warn('[ZUM-REALTIME] 모든 재시도 실패, 빈 배열 반환');
  return [];
}

/**
 * Google 실시간 검색어 (Google Trends 활용)
 */
export async function getGoogleRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[GOOGLE-REALTIME] ========== Google 실시간 검색어 수집 시작 (시도 ${attempt}/${MAX_RETRIES}) ==========`);
      const keywords: RealtimeKeyword[] = [];
      
      // 방법 1: Google Trends RSS 피드 시도 (우선순위 1 - 일일 트렌드 순위대로 10개)
      console.log('[GOOGLE-REALTIME] 방법 1: Google Trends RSS 피드 시도 (일일 트렌드 10개)');
      try {
        const rssUrls = [
          'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR&hl=ko',
          'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KR'
        ];
        
        for (const rssUrl of rssUrls) {
          try {
            console.log(`[GOOGLE-REALTIME] RSS 피드 요청: ${rssUrl}`);
            const rssResponse = await axios.get(rssUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
              },
              timeout: 10000
            });
            
            if (rssResponse.status === 200 && rssResponse.data) {
              const rssContent = rssResponse.data;
              const $rss = cheerio.load(rssContent, { xmlMode: true });
              
              // 순서대로 최대 10개만 가져오기 (필터링 없이)
              $rss('item title').each((_i, el) => {
                if (keywords.length >= Math.min(limit, 10)) return; // 최대 10개
                const title = $rss(el).text().trim();
                
                // 기본적인 검증만 (너무 짧거나 URL 등은 제외)
                if (title && 
                    title.length >= 2 && 
                    !title.includes('http') && 
                    !title.includes('google') &&
                    !title.match(/^[\d\s\-_]+$/)) {
                  keywords.push({
                    rank: keywords.length + 1,
                    keyword: title,
                    source: 'google',
                    timestamp: new Date().toISOString()
                  });
                  console.log(`[GOOGLE-REALTIME] RSS에서 키워드 발견 (${keywords.length}번째): ${title}`);
                }
              });
              
              if (keywords.length >= Math.min(limit, 10)) {
                console.log(`[GOOGLE-REALTIME] ✅ RSS 피드에서 ${keywords.length}개 키워드 발견 (일일 트렌드 순위대로)`);
                return keywords.slice(0, Math.min(limit, 10)); // 최대 10개 반환
              }
            }
          } catch (rssError: any) {
            console.warn(`[GOOGLE-REALTIME] RSS 피드 실패 (${rssUrl}):`, rssError.message);
          }
        }
      } catch (rssError: any) {
        console.warn('[GOOGLE-REALTIME] RSS 피드 전체 실패:', rssError.message);
      }
      
      // 방법 2: Google Trends 일일 트렌드 HTML 페이지 크롤링 (RSS 실패 시)
      if (keywords.length < Math.min(limit, 10)) {
        try {
          console.log('[GOOGLE-REALTIME] 방법 2: Google Trends 일일 트렌드 HTML 크롤링');
          const response = await axios.get('https://trends.google.co.kr/trendingsearches/daily?geo=KR&hl=ko', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://trends.google.co.kr/'
          },
          timeout: 15000,
          validateStatus: (status) => status < 500
        });
        
        console.log(`[GOOGLE-REALTIME] HTML 응답 상태: ${response.status}`);
        
        if (response.status === 200 && response.data) {
          const html = response.data;
          const $ = cheerio.load(html);
          
            // Google Trends 페이지에서 키워드 추출 (제공된 HTML 구조에 맞춤)
            // 우선순위 1: tbody[jsname="cC57zf"] 내의 tr[data-row-id]에서 .mZ3RIc 추출
            const tempKeywords = new Set<string>();
            
            // 방법 1: 테이블 구조에서 직접 추출 (Google Trends 실제 구조)
            const tableBody = $('tbody[jsname="cC57zf"]');
            if (tableBody.length > 0) {
              console.log(`[GOOGLE-REALTIME] 테이블 tbody 발견, 행 찾는 중...`);
              
              const rows = tableBody.find('tr[data-row-id]');
              for (let i = 0; i < rows.length && tempKeywords.size < Math.min(limit, 10); i++) {
                const row = rows.eq(i);
                // .mZ3RIc 클래스에서 키워드 추출 (제공된 HTML 구조)
                const keywordEl = row.find('.mZ3RIc').first();
                
                if (keywordEl.length > 0) {
                  let keyword = keywordEl.text().trim();
                  
                  // 기본적인 검증만 (필터링 최소화 - 일일 트렌드 그대로 가져오기)
                  if (keyword && 
                      keyword.length >= 2 && 
                      !keyword.includes('http') &&
                      !keyword.includes('google') &&
                      !keyword.includes('trends') &&
                      !/^[\d\s\-_]+$/.test(keyword)) {
                    tempKeywords.add(keyword);
                    console.log(`[GOOGLE-REALTIME] 테이블에서 키워드 발견 (${tempKeywords.size}번째): ${keyword}`);
                  }
                }
              }
              
              if (tempKeywords.size >= Math.min(limit, 10)) {
                console.log(`[GOOGLE-REALTIME] ✅ 테이블 구조에서 ${tempKeywords.size}개 키워드 발견`);
              }
            }
            
            // 방법 2: 대체 선택자들 시도 (방법 1이 실패한 경우)
            if (tempKeywords.size < Math.min(limit, 10)) {
              console.log(`[GOOGLE-REALTIME] 대체 선택자 시도 중...`);
              const selectors = [
                '.mZ3RIc', // 직접 키워드 클래스
                'a[href*="/trends/explore?q="]',
                'a[href*="/trends?q="]',
                '.trending-item-title',
                '.trending-item',
                '[data-trend]',
                '[data-term]', // data-term 속성
                '.md-list-item-text'
              ];
              
              for (const selector of selectors) {
                if (tempKeywords.size >= Math.min(limit, 10)) break;
                
                const elements = $(selector);
                console.log(`[GOOGLE-REALTIME] 선택자 "${selector}": ${elements.length}개 발견`);
                
                for (let idx = 0; idx < elements.length && tempKeywords.size < Math.min(limit, 10); idx++) {
                  const el = elements.eq(idx);
                  let keyword = el.text().trim();
                  
                  // href에서 키워드 추출 시도
                  const href = el.attr('href') || '';
                  if (href) {
                    const hrefMatch = href.match(/[?&]q=([^&]+)/);
                    if (hrefMatch && hrefMatch[1]) {
                      try {
                        keyword = decodeURIComponent(hrefMatch[1]).trim();
                      } catch (e) {
                        // 디코딩 실패 무시
                      }
                    }
                  }
                  
                  // data 속성에서 키워드 추출
                  if (!keyword || keyword.length < 2) {
                    keyword = el.attr('data-trend') || el.attr('data-keyword') || el.attr('data-term') || '';
                  }
                  
                  // 기본적인 검증만 (필터링 최소화 - 일일 트렌드 그대로 가져오기)
                  if (keyword && 
                      keyword.length >= 2 && 
                      !keyword.includes('http') &&
                      !keyword.includes('google') &&
                      !keyword.includes('trends') &&
                      !/^[\d\s\-_]+$/.test(keyword)) {
                    tempKeywords.add(keyword);
                    console.log(`[GOOGLE-REALTIME] 대체 선택자에서 키워드 발견: ${keyword}`);
                  }
                }
                
                if (tempKeywords.size >= Math.min(limit, 10)) {
                  console.log(`[GOOGLE-REALTIME] 선택자 "${selector}"에서 ${tempKeywords.size}개 키워드 발견`);
                  break;
                }
              }
            }
            
            // 스크립트 태그에서 JSON 데이터 추출 시도
            if (tempKeywords.size < 5) {
              console.log('[GOOGLE-REALTIME] 스크립트 태그에서 JSON 데이터 추출 시도');
              const scriptCount = $('script').length;
              console.log(`[GOOGLE-REALTIME] 발견된 스크립트 태그: ${scriptCount}개`);
              
              $('script').each((_i, scriptEl) => {
                if (tempKeywords.size >= limit * 2) return;
                
                const scriptContent = $(scriptEl).html() || '';
                
                // JSON 데이터에서 키워드 추출 (더 많은 패턴)
                const jsonPatterns = [
                  /trendingSearches\s*[:=]\s*(\[.*?\])/s,
                  /trendingSearchesDays\s*[:=]\s*(\[.*?\])/s,
                  /"query"\s*:\s*"([^"]+)"/g,
                  /"keyword"\s*:\s*"([^"]+)"/g,
                  /"title"\s*:\s*"([^"]+)"/g,
                  /"topic"\s*:\s*"([^"]+)"/g,
                  /"searchTerm"\s*:\s*"([^"]+)"/g,
                  /"formattedValue"\s*:\s*"([^"]+)"/g
                ];
                
                for (const pattern of jsonPatterns) {
                  let match;
                  while ((match = pattern.exec(scriptContent)) !== null && tempKeywords.size < limit * 2) {
                    const keyword = (match[2] || match[1] || '').trim();
                    
                    // 기본적인 검증만 (필터링 최소화)
                    if (keyword && 
                        keyword.length >= 2 && 
                        !keyword.includes('http') &&
                        !keyword.includes('google') &&
                        !keyword.includes('trends') &&
                        !keyword.match(/^[\d\s\-_]+$/) &&
                        !keyword.match(/^[a-zA-Z\s]+$/)) {
                      tempKeywords.add(keyword);
                      console.log(`[GOOGLE-REALTIME] 스크립트에서 키워드 발견: ${keyword}`);
                    }
                  }
                }
              });
              
              console.log(`[GOOGLE-REALTIME] 스크립트 파싱 후 키워드 개수: ${tempKeywords.size}`);
            }
            
            
            if (tempKeywords.size > 0) {
              console.log(`[GOOGLE-REALTIME] 총 ${tempKeywords.size}개 키워드 발견`);
              
              // 최대 10개만 순서대로 가져오기
              Array.from(tempKeywords).slice(0, Math.min(limit, 10)).forEach((keyword, idx) => {
                keywords.push({
                  rank: idx + 1,
                  keyword: keyword,
                  source: 'google',
                  timestamp: new Date().toISOString()
                });
              });
              
              if (keywords.length >= Math.min(limit, 10)) {
                console.log(`[GOOGLE-REALTIME] ✅ 수집 완료: ${keywords.length}개 (일일 트렌드 순위대로)`);
                console.log(`[GOOGLE-REALTIME] 샘플:`, keywords.slice(0, 3).map(k => k.keyword));
                return keywords.slice(0, Math.min(limit, 10)); // 최대 10개 반환
              }
            }
          }
        } catch (apiError: any) {
          console.error(`[GOOGLE-REALTIME] HTML 크롤링 에러:`, apiError.message);
        }
      }
      
      // 재시도
      if (keywords.length < Math.min(limit, 10) && attempt < MAX_RETRIES) {
        console.log(`[GOOGLE-REALTIME] ${RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
      
    } catch (error: any) {
      console.error(`[GOOGLE-REALTIME] 시도 ${attempt} 실패:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  console.warn('[GOOGLE-REALTIME] 모든 재시도 실패, 빈 배열 반환');
  return [];
}

/**
 * 네이트 실시간 검색어 크롤링
 */
export async function getNateRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[NATE-REALTIME] ========== 네이트 실시간 검색어 수집 시작 (시도 ${attempt}/${MAX_RETRIES}) ==========`);
      const keywords: RealtimeKeyword[] = [];
      
      // Nate 실시간 검색어 전용 페이지 시도
      const urls = [
        'https://m.nate.com/',
        'https://www.nate.com/'
      ];
      
      let response;
      let lastError;
      for (const url of urls) {
        try {
          console.log(`[NATE-REALTIME] HTML 페이지 요청: ${url}`);
          response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1'
            },
            timeout: 15000,
            validateStatus: (status) => status < 500,
            maxRedirects: 3
          });
          if (response.status === 200 && response.data) {
            console.log(`[NATE-REALTIME] HTML 응답: ${url} - 상태: ${response.status}, 길이: ${response.data?.length || 0} bytes`);
            break;
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`[NATE-REALTIME] HTML 요청 실패 (${url}):`, err?.message);
        }
      }
      
      if (!response || !response.data) {
        throw lastError || new Error('모든 Nate URL 실패');
      }

      const $ = cheerio.load(response.data);
      
      // 네이트 실시간 검색어 구조: <ol class="isKeywordList" id="olLiveIssueKeyword">
      // 우선순위 1: #olLiveIssueKeyword 또는 ol.isKeywordList에서 직접 추출
      const nateKeywordList = $('#olLiveIssueKeyword, ol.isKeywordList');
      
      if (nateKeywordList.length > 0 && keywords.length < limit) {
        console.log('[NATE-REALTIME] 네이트 실시간 검색어 리스트 발견');
        
        nateKeywordList.find('li').each((index, li) => {
          if (keywords.length >= limit) {
            return false; // Cheerio 반복 중단
          }
          
          const $li = $(li);
          let keywordText: string = '';
          
          // 우선순위 1: .txt_rank 클래스에서 텍스트 추출 (가장 정확)
          const txtRank = $li.find('.txt_rank').first();
          if (txtRank.length > 0) {
            keywordText = txtRank.text().trim();
          }
          
          // 우선순위 2: <a> 태그의 onclick 속성에서 키워드 추출
          if (!keywordText || keywordText.length < 2) {
            const $a = $li.find('a').first();
            const onclick = $a.attr('onclick') || '';
            const onclickMatch = onclick.match(/clickSearchKeyword\(['"]([^'"]+)['"]/);
            if (onclickMatch && onclickMatch[1]) {
              keywordText = onclickMatch[1].trim();
            }
          }
          
          // 우선순위 3: <a> 태그의 href에서 키워드 추출
          if (!keywordText || keywordText.length < 2) {
            const $a = $li.find('a').first();
            const href = $a.attr('href') || '';
            if (href) {
              const hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
              if (hrefMatch && hrefMatch[1]) {
                try {
                  keywordText = decodeURIComponent(hrefMatch[1]).trim();
                } catch (e) {
                  // 디코딩 실패 무시
                }
              }
            }
          }
          
          // 우선순위 4: <a> 태그의 직접 텍스트
          if (!keywordText || keywordText.length < 2) {
            const $a = $li.find('a').first();
            keywordText = $a.text().trim();
          }
          
          // 순위 번호 제거 (num_rank는 제외하고 키워드만)
          keywordText = keywordText
            .replace(/^\d+\.?\s*/, '')
            .replace(/^\d+위\s*/, '')
            .replace(/^(new|하락|상승)\s*\d*\s*/i, '') // "new", "하락", "상승" 제거
            .replace(/\s+/g, ' ')
            .trim();
          
          // 광고 텍스트 필터링
          if (!keywordText || keywordText.length === 0 || 
              keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') || 
              keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
            return true; // continue
          }
          
          // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
          if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
              !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate|new|하락|상승)$/i) &&
              !keywords.find(k => k.keyword === keywordText)) {
            
            keywords.push({
              rank: keywords.length + 1,
              keyword: keywordText,
              source: 'nate',
              timestamp: new Date().toISOString()
            });
            
            console.log(`[NATE-REALTIME] 네이트 키워드 발견 (${keywords.length}번째): ${keywordText}`);
          }
          
          return; // 명시적 반환
        });
        
        if (keywords.length >= limit) {
          console.log(`[NATE-REALTIME] ✅ 네이트 실시간 검색어 리스트에서 ${keywords.length}개 키워드 수집 성공`);
          return keywords.slice(0, limit);
        }
      }
      
      // 우선순위 2: 네이트 선택자들로 폴백
      const nateSelectors = [
        '#olLiveIssueKeyword li a',
        'ol.isKeywordList li a',
        '#olLiveIssueKeyword .txt_rank',
        'ol.isKeywordList .txt_rank',
        '.isKeywordList li a',
        '.isKeywordList .txt_rank',
      ];
      
      for (const selector of nateSelectors) {
        if (keywords.length >= limit) break;
        
        const elements = $(selector);
        if (elements.length === 0) continue;
        
        console.log(`[NATE-REALTIME] 네이트 선택자 "${selector}": ${elements.length}개 발견`);
        
        elements.each((index, element) => {
          if (keywords.length >= limit) {
            return false; // Cheerio 반복 중단
          }
          
          let keywordText: string = '';
          const $el = $(element);
          
          // 우선순위 1: txt_rank 클래스에서 텍스트 추출 (가장 정확)
          const txtRank = $el.find('.txt_rank').first();
          if (txtRank.length > 0) {
            keywordText = txtRank.text().trim();
          }
          
          // 우선순위 2: onclick 속성에서 키워드 추출
          if (!keywordText || keywordText.length < 2) {
            const onclick = $el.attr('onclick') || '';
            const onclickMatch = onclick.match(/clickSearchKeyword\(['"]([^'"]+)['"]/);
            if (onclickMatch && onclickMatch[1]) {
              keywordText = onclickMatch[1].trim();
            }
          }
          
          // 우선순위 3: href에서 키워드 추출
          if (!keywordText || keywordText.length < 2) {
            const href = $el.attr('href') || '';
            if (href) {
              const hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
              if (hrefMatch && hrefMatch[1]) {
                try {
                  keywordText = decodeURIComponent(hrefMatch[1]).trim();
                } catch (e) {
                  // 디코딩 실패 무시
                }
              }
            }
          }
          
          // 우선순위 4: 요소의 직접 텍스트
          if (!keywordText || keywordText.length < 2) {
            keywordText = $el.text().trim();
          }
          
          // 순위 번호 제거
          keywordText = keywordText
            .replace(/^\d+\.?\s*/, '')
            .replace(/^\d+위\s*/, '')
            .replace(/^(new|하락|상승)\s*\d*\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // 광고 텍스트 필터링
          if (!keywordText || keywordText.length === 0 || 
              keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') || 
              keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
            return; // continue
          }
          
          // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
          if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
              !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate|new|하락|상승)$/i) &&
              !keywords.find(k => k.keyword === keywordText)) {
            
            keywords.push({
              rank: keywords.length + 1,
              keyword: keywordText,
              source: 'nate',
              timestamp: new Date().toISOString()
            });
            
            console.log(`[NATE-REALTIME] 네이트 키워드 발견 (${keywords.length}번째): ${keywordText}`);
          }
          
          return; // 명시적 반환
        });
        
        if (keywords.length >= limit) {
          console.log(`[NATE-REALTIME] ✅ 네이트 선택자 "${selector}"에서 ${keywords.length}개 키워드 수집 성공`);
          break;
        }
      }
      
      // 우선순위 3: 일반적인 네이트 선택자들 (기존 로직)
      const selectors = [
        'ol.realtime li a',
        'ul.realtime li a',
        '.rank_list li a',
        '.ranking_list li a',
        '.issue_keyword li a',
        '.keyword_rank li a',
        '.trending li a',
        'ol li a[href*="search"]',
        'ul li a[href*="search"]',
      ];
      
      for (const selector of selectors) {
        if (keywords.length >= limit) break;
        
        const rankElements = $(selector);
        console.log(`[NATE-REALTIME] 선택자 "${selector}": ${rankElements.length}개 요소 발견`);
        
        for (let index = 0; index < rankElements.length && keywords.length < limit; index++) {
          const element = rankElements[index];
          let keywordText: string = '';
          
          // href에서 키워드 추출 (우선순위 1)
          const href = $(element).attr('href') || '';
          if (href) {
            const hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
            if (hrefMatch && hrefMatch[1]) {
              try {
                keywordText = decodeURIComponent(hrefMatch[1]).trim();
              } catch (e) {
                // 디코딩 실패 무시
              }
            }
          }
          
          // href에서 못 찾은 경우 텍스트 사용 (우선순위 2)
          // 전체 요소의 텍스트를 가져오도록 수정 (자식 요소 포함, 순서대로)
          if (!keywordText || keywordText.length < 2) {
            // 직접 DOM 노드의 텍스트를 가져오기 (순서대로)
            keywordText = $(element).text().trim();
            
            // 만약 텍스트가 짧거나 순서가 이상하면, 모든 자식 요소의 텍스트를 순서대로 합치기
            if (!keywordText || keywordText.length < 2) {
              let fullText = '';
              $(element).contents().each((_idx, node) => {
                if (node.type === 'text') {
                  fullText += $(node).text().trim() + ' ';
                } else if (node.type === 'tag') {
                  const childText = $(node).text().trim();
                  if (childText) {
                    fullText += childText + ' ';
                  }
                }
              });
              keywordText = fullText.trim();
            }
            
            // 여전히 없으면 일반적인 방법 시도
            if (!keywordText || keywordText.length < 2) {
              keywordText = $(element).text().trim() || 
                           $(element).find('a, span, strong, em, div').first().text().trim() ||
                           $(element).attr('title') || 
                           $(element).attr('aria-label') || 
                           $(element).attr('data-text') || '';
            }
          }
          
          // 광고 텍스트 필터링
          if (!keywordText || keywordText.length === 0 || 
              keywordText.includes('브랜드별') || keywordText.includes('시공비') || keywordText.includes('후원기관') || 
              keywordText.includes('어린이에게') || keywordText.includes('딱 오늘까지만')) {
            continue;
          }
          
          // 여러 줄 텍스트는 첫 줄만 사용하되, 공백으로 연결된 텍스트는 유지
          const cleanText = keywordText.split('\n')[0]?.trim() || keywordText.trim();
          // 순위 번호만 제거하고, 키워드 텍스트는 유지 (중간의 숫자나 "위"는 제거하지 않음)
          keywordText = cleanText
            .replace(/^\d+\.?\s*/, '') // 앞의 순위 번호만 제거
            .replace(/^\d+위\s*/, '') // 앞의 "1위 " 같은 것만 제거
            .replace(/\s+/g, ' ') // 공백 정리
            .trim();
          
          // 키워드가 너무 짧으면 (1-2자) 다음 요소로 넘어가기
          if (keywordText.length < 2) {
            continue;
          }
          
          // 키워드 길이 제한을 50자로 늘림 (긴 키워드도 수집)
          if (keywordText.length >= 2 && keywordText.length < 50 && !keywordText.includes('http') &&
              !keywordText.match(/^\d+$/) && !keywordText.match(/^(검색|더보기|전체보기|이슈|네이트|nate)$/i) &&
              !keywords.find(k => k.keyword === keywordText)) {
            keywords.push({
              keyword: keywordText,
              rank: keywords.length + 1,
              source: 'nate',
              timestamp: new Date().toISOString()
            });
          }
        }
        
        if (keywords.length >= 5) {
          console.log(`[NATE-REALTIME] ✅ 선택자 "${selector}"에서 ${keywords.length}개 키워드 수집 성공`);
          break;
        }
      }

      // 더 일반적인 패턴 시도
      if (keywords.length < limit) {
        const allLinks = $('a[href*="/search"], a[href*="keyword"], a[href*="issue"], a[href*="trend"]');
        console.log(`[NATE-REALTIME] 전체 링크 ${allLinks.length}개 발견`);
        
        for (let index = 0; index < allLinks.length && keywords.length < limit; index++) {
          const element = allLinks[index];
          let text = $(element).text().trim();
          
          // href에서도 키워드 추출
          const href = $(element).attr('href') || '';
          const hrefMatch = href.match(/[?&](?:q|query|keyword|search)=([^&]+)/);
          if (hrefMatch && hrefMatch[1]) {
            try {
              text = decodeURIComponent(hrefMatch[1]).trim();
            } catch (e) {
              // 디코딩 실패 무시
            }
          }
          
          if (text && text.length >= 2 && text.length < 50 && !text.includes('http') && 
              !text.match(/^\d+$/) && !text.match(/^(검색|더보기|전체보기|이슈|네이트|nate)$/i)) {
            if (!keywords.find(k => k.keyword === text)) {
              keywords.push({
                keyword: text,
                rank: keywords.length + 1,
                source: 'nate',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      // 키워드 수집 성공 시 즉시 반환
      if (keywords.length >= 5) {
        console.log(`[NATE-REALTIME] ✅ 수집 완료: ${keywords.length}개 키워드 (시도 ${attempt}/${MAX_RETRIES})`);
        return keywords.slice(0, limit);
      }
      
      // 키워드가 부족하면 다음 시도
      if (attempt < MAX_RETRIES) {
        console.warn(`[NATE-REALTIME] ⚠️ 키워드 부족 (${keywords.length}개), ${RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        continue;
      }
      
      // 마지막 시도에서도 부족하면 수집된 것이라도 반환
      if (keywords.length > 0) {
        console.log(`[NATE-REALTIME] ⚠️ 수집 완료 (부족): ${keywords.length}개 키워드`);
        return keywords.slice(0, limit);
      }
      
      // 키워드가 전혀 없으면 빈 배열 반환
      return [];
      
    } catch (error: any) {
      console.error(`[NATE-REALTIME] ⚠️ 시도 ${attempt}/${MAX_RETRIES} 실패:`, error?.message);
      
      if (attempt < MAX_RETRIES) {
        console.warn(`[NATE-REALTIME] ${RETRY_DELAY * attempt}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        continue;
      }
      
      // 모든 시도 실패
      console.error('[NATE-REALTIME] ========== 모든 시도 실패 ==========');
      console.error('[NATE-REALTIME] 에러 타입:', error?.constructor?.name);
      console.error('[NATE-REALTIME] 에러 메시지:', error?.message);
      if (error?.response) {
        console.error('[NATE-REALTIME] HTTP 상태:', error.response.status, error.response.statusText);
      }
    }
  }
  
  console.warn('[NATE-REALTIME] 모든 재시도 실패, 빈 배열 반환');
  return [];
}

/**
 * 다음 실시간 검색어 크롤링
 */
export async function getDaumRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[DAUM-REALTIME] ========== 다음 실시간 검색어 수집 시작 (시도 ${attempt}/${MAX_RETRIES}) ==========`);
      const keywords: RealtimeKeyword[] = [];
      
      // 방법 1: 다음 실시간 검색어 API
      const apiUrls = [
        'https://m.daum.net/api/realtime/keyword',
        'https://www.daum.net/api/realtime/keyword',
      ];
      
      console.log('[DAUM-REALTIME] 방법 1: API 직접 호출');
      for (const apiUrl of apiUrls) {
        try {
          console.log(`[DAUM-REALTIME] API 호출: ${apiUrl}`);
          const apiResponse = await axios.get(apiUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, */*',
              'Accept-Language': 'ko-KR,ko;q=0.9',
              'Referer': 'https://www.daum.net/'
            },
            timeout: 10000,
            validateStatus: (status) => status < 500
          });
        
          console.log(`[DAUM-REALTIME] 응답: ${apiUrl}, 상태: ${apiResponse.status}`);
          
          if (apiResponse.data) {
            const data = apiResponse.data;
            console.log(`[DAUM-REALTIME] 응답 키:`, Object.keys(data));
            
            const keywordList = data.data || 
                               data.keywords || 
                               data.items || 
                               data.list ||
                               (Array.isArray(data) ? data : []);
            
            console.log(`[DAUM-REALTIME] 키워드 개수: ${Array.isArray(keywordList) ? keywordList.length : 0}`);
            
            if (Array.isArray(keywordList) && keywordList.length > 0) {
              keywordList.slice(0, limit).forEach((item: any, idx: number) => {
                // title은 제목이므로 제외하고, keyword/word/text/query만 사용
                const keyword = item.keyword || 
                               item.word || 
                               item.text || 
                               item.query;
                
                // title 필드가 있으면 무시 (제목이 키워드로 들어가는 것 방지)
                // String(item)으로 변환하는 것도 제거 (제목이 문자열로 변환될 수 있음)
                if (!keyword && item.title) {
                  return; // title만 있으면 스킵
                }
                
                if (keyword && typeof keyword === 'string' && keyword.trim().length >= 2) {
                  const trimmedKeyword = keyword.trim();
                  // 제목처럼 보이는 긴 텍스트 필터링 (50자 이상이고 공백이 많으면 제목일 가능성)
                  if (trimmedKeyword.length > 50 && trimmedKeyword.split(/\s+/).length > 8) {
                    console.log(`[DAUM-REALTIME] 제목처럼 보이는 텍스트 제외: ${trimmedKeyword.substring(0, 30)}...`);
                    return;
                  }
                  
                  keywords.push({
                    rank: idx + 1,
                    keyword: trimmedKeyword,
                    source: 'daum',
                    timestamp: new Date().toISOString()
                  });
                }
              });
              
              if (keywords.length >= 5) {
                console.log(`[DAUM-REALTIME] ✅ API 성공: ${keywords.length}개`);
                console.log(`[DAUM-REALTIME] 샘플:`, keywords.slice(0, 3).map(k => k.keyword));
                return keywords.slice(0, limit);
              }
            }
          }
        } catch (apiError: any) {
          console.warn(`[DAUM-REALTIME] API 실패 (${apiUrl}):`, apiError.message);
        }
      }
      
      // 방법 2: HTML 페이지에서 추출 (정규식 기반)
      if (keywords.length === 0) {
        console.log('[DAUM-REALTIME] 방법 2: HTML 페이지 파싱 (정규식 기반)');
        
        try {
          const response = await axios.get('https://www.daum.net/', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'ko-KR,ko;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive'
            },
            timeout: 10000
          });
          
          const html = response.data;
          console.log(`[DAUM-REALTIME] HTML 받음: ${html.length} bytes`);
          
          // 방법 2-1: list_briefing_wrap (브리핑 영역) - 우선순위 1
          console.log('[DAUM-REALTIME] 방법 2-1: list_briefing 영역 검색');
          const briefingMatch = html.match(/<div[^>]*class="list_briefing_wrap"[^>]*>([\s\S]*?)<\/div>/i);
          
          if (briefingMatch) {
            console.log('[DAUM-REALTIME] list_briefing 영역 발견');
            const pattern = /<em[^>]*class="txt_briefing"[^>]*>([^<]+)<\/em>/gi;
            let match;
            let rank = 1;
            
            while ((match = pattern.exec(briefingMatch[1])) !== null && rank <= limit) {
              const keyword = match[1]?.trim();
              if (keyword && keyword.length >= 2 && keyword.length < 100) {
                keywords.push({
                  rank: rank,
                  keyword: keyword,
                  source: 'daum',
                  timestamp: new Date().toISOString()
                });
                console.log(`[DAUM-REALTIME] 발견: ${rank}위 - ${keyword}`);
                rank++;
              }
            }
          }
          
          // 방법 2-2: list_trend_wrap (트렌드 영역) - 방법 2-1 실패 시
          if (keywords.length === 0) {
            console.log('[DAUM-REALTIME] 방법 2-2: list_trend 영역 검색');
            const trendMatch = html.match(/<div[^>]*class="list_trend_wrap"[^>]*>([\s\S]*?)<\/div>/i);
            
            if (trendMatch) {
              console.log('[DAUM-REALTIME] list_trend 영역 발견');
              const pattern = /<strong[^>]*class="txt_keyword[^"]*"[^>]*>([^<]+)<\/strong>/gi;
              let match;
              const uniqueKeywords = new Set<string>();
              
              while ((match = pattern.exec(trendMatch[1])) !== null) {
                const keyword = match[1]?.trim();
                
                // 중복 제거 (같은 키워드가 여러 번 나타남)
                if (keyword && 
                    keyword.length >= 2 && 
                    keyword.length < 100 &&
                    !uniqueKeywords.has(keyword)) {
                  
                  uniqueKeywords.add(keyword);
                  const rank = uniqueKeywords.size;
                  
                  keywords.push({
                    rank: rank,
                    keyword: keyword,
                    source: 'daum',
                    timestamp: new Date().toISOString()
                  });
                  
                  console.log(`[DAUM-REALTIME] 발견: ${rank}위 - ${keyword}`);
                  
                  if (uniqueKeywords.size >= limit) {
                    break;
                  }
                }
              }
            }
          }
          
          // 방법 2-3: Cheerio를 사용한 DOM 파싱 (폴백)
          if (keywords.length === 0) {
            console.log('[DAUM-REALTIME] 방법 2-3: Cheerio DOM 파싱 (폴백)');
            const $ = cheerio.load(html);
            const tempKeywords = new Set<string>();
          
          // 방법 2-1: DOM 선택자로 실시간 검색어 찾기 (더 많은 선택자 추가)
          const selectors = [
            '.link_issue',
            '.issue_keyword a',
            '.rank_list a',
            '.keyword_list a',
            '.realtime_keyword a',
            'li[class*="rank"] a',
            'li[class*="keyword"] a',
            'li[class*="issue"] a',
            'li[class*="realtime"] a',
            '[class*="realtime"] a',
            '[class*="issue"] a',
            '[class*="keyword"] a',
            '[data-keyword]',
            'a[href*="/search?q="]',
            'a[href*="/search?query="]',
            'a[href*="/search?keyword="]',
            'ol li a[href*="search"]',
            'ul li a[href*="search"]',
            '[id*="rank"] li a',
            '[id*="keyword"] li a',
            '[id*="issue"] li a'
          ];
          
          for (const selector of selectors) {
            if (tempKeywords.size >= limit) break;
            
            const elements = $(selector);
            console.log(`[DAUM-REALTIME] 선택자 "${selector}": ${elements.length}개 발견`);
            
            for (let idx = 0; idx < elements.length && tempKeywords.size < limit * 2; idx++) {
              const el = elements.eq(idx);
              let keyword = el.text().trim();
              
              // data-keyword 속성에서 추출
              if (!keyword) {
                keyword = el.attr('data-keyword') || '';
              }
              
              // href에서 키워드 추출
              const href = el.attr('href') || '';
              if (href) {
                const hrefMatch = href.match(/[?&]q=([^&]+)/);
                if (hrefMatch && hrefMatch[1]) {
                  try {
                    keyword = decodeURIComponent(hrefMatch[1]).trim();
                  } catch (e) {
                    // 디코딩 실패 무시
                  }
                }
              }
              
              // 키워드 정제
              keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위\s*/, '').trim();
              
              // 제목처럼 보이는 긴 텍스트 필터링
              const wordCount = keyword.split(/\s+/).length;
              const isLikelyTitle = keyword.length > 50 && wordCount > 8;
              
              // 제목 관련 속성 제외
              const isTitleAttribute = el.attr('title') && el.attr('title') === keyword;
              const isNewsTitle = el.closest('[class*="news"], [class*="article"], [class*="title"]').length > 0;
              
              if (keyword && 
                  keyword.length >= 2 && 
                  keyword.length < 50 &&
                  !isLikelyTitle &&
                  !isTitleAttribute &&
                  !isNewsTitle &&
                  !keyword.includes('http') &&
                  !keyword.includes('://') &&
                  !keyword.includes('더보기') &&
                  !keyword.includes('전체보기') &&
                  !keyword.includes('검색') &&
                  !keyword.match(/^(제목|내용|링크|URL|이미지|사진|영상|동영상|비디오)$/i) &&
                  !/^[\d\s\-_]+$/.test(keyword)) {
                tempKeywords.add(keyword);
                console.log(`[DAUM-REALTIME] HTML에서 키워드 발견: ${keyword}`);
              }
            }
            
            if (tempKeywords.size >= 5) {
              console.log(`[DAUM-REALTIME] 선택자 "${selector}"에서 ${tempKeywords.size}개 키워드 발견`);
              break;
            }
          }
          
          // 방법 2-2: 스크립트 태그에서 JSON 데이터 추출
          if (tempKeywords.size < 5) {
            $('script').each((_i, scriptEl) => {
              if (tempKeywords.size >= limit) return;
              
              const scriptContent = $(scriptEl).html() || '';
              
              // TIARA 데이터 패턴
              const patterns = [
                /TIARA[\s\S]*?keyword["']\s*:\s*["']([^"']+)["']/gi,
                /"keyword"\s*:\s*"([^"]+)"/g,
                /"query"\s*:\s*"([^"]+)"/g,
                /data-keyword=["']([^"']+)["']/gi
              ];
              
              for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(scriptContent)) !== null && tempKeywords.size < limit * 2) {
                  const keyword = (match[1] || '').trim();
                  if (keyword && 
                      keyword.length >= 2 && 
                      keyword.length < 50 &&
                      !keyword.includes('http') &&
                      !keyword.includes('더보기') &&
                      !keyword.includes('전체보기')) {
                    tempKeywords.add(keyword);
                  }
                }
              }
            });
          }
          
            if (tempKeywords.size > 0) {
              console.log(`[DAUM-REALTIME] 총 ${tempKeywords.size}개 키워드 발견`);
              
              Array.from(tempKeywords).slice(0, limit).forEach((keyword, idx) => {
                keywords.push({
                  rank: idx + 1,
                  keyword: keyword,
                  source: 'daum',
                  timestamp: new Date().toISOString()
                });
              });
            }
          }
          
        } catch (htmlError: any) {
          console.error(`[DAUM-REALTIME] HTML 파싱 실패:`, htmlError.message);
        }
      }
      
      // 키워드 수집 성공 시 반환
      if (keywords.length >= 5) {
        console.log(`[DAUM-REALTIME] ✅ 수집 완료: ${keywords.length}개`);
        return keywords.slice(0, limit);
      }
      
      // 재시도
      if (attempt < MAX_RETRIES) {
        console.log(`[DAUM-REALTIME] ${RETRY_DELAY}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
      
    } catch (error: any) {
      console.error(`[DAUM-REALTIME] 시도 ${attempt} 실패:`, error.message);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  console.warn('[DAUM-REALTIME] 모든 재시도 실패, 빈 배열 반환');
  return [];
}

/**
 * 네이버 실시간 검색어 크롤링 (제거됨 - 작동하지 않음)
 */
export async function getNaverRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  // 네이버 실시간 검색어는 작동하지 않으므로 빈 배열 반환
  return [];
}

/**
 * 복지로 인기 검색어
 * 복지로 사이트의 인기 검색 키워드를 크롤링합니다.
 */
export async function getBokjiroRealtimeKeywords(limit: number = 20): Promise<RealtimeKeyword[]> {
  try {
    console.log('[BOKJIRO-REALTIME] ========== 복지로 인기 검색어 수집 시작 ==========');
    
    const url = 'https://www.bokjiro.go.kr/ssis-tbu/index.do';
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.bokjiro.go.kr/'
      },
      timeout: 10000
    });
    
    if (response.data) {
      const $ = cheerio.load(response.data);
      const keywords: RealtimeKeyword[] = [];
      
      // 복지로 인기 검색어 추출 (다양한 선택자 시도)
      const selectors = [
        '.popular_keyword li a',
        '.search_keyword li a',
        'ul.keyword_list li a',
        'div.popular_search li a',
        'div[class*="keyword"] li a',
        'div[class*="popular"] li a'
      ];
      
      for (const selector of selectors) {
        const elements = $(selector);
        
        elements.each((idx, el) => {
          if (keywords.length >= limit) return;
          
          let keyword = $(el).text().trim();
          keyword = keyword.replace(/^\d+\.?\s*/, '').replace(/^\d+위?\s*/, '').trim();
          
          if (keyword && keyword.length >= 2 && keyword.length < 50 && !keyword.includes('http')) {
            keywords.push({
              rank: keywords.length + 1,
              keyword: keyword,
              source: 'bokjiro',
              timestamp: new Date().toISOString()
            });
          }
        });
        
        if (keywords.length >= 5) break;
      }
      
      if (keywords.length > 0) {
        console.log(`[BOKJIRO-REALTIME] ✅ 수집 완료: ${keywords.length}개`);
        return keywords.slice(0, limit);
      }
    }
  } catch (error: any) {
    console.error('[BOKJIRO-REALTIME] 크롤링 실패:', error.message);
  }
  
  // 크롤링 실패 시 ZUM 데이터 대체
  console.log('[BOKJIRO-REALTIME] ZUM 데이터로 대체');
  try {
    const zumKeywords = await getZumRealtimeKeywords(limit);
    if (zumKeywords && zumKeywords.length > 0) {
      return zumKeywords.map((kw, idx) => ({
        ...kw,
        source: 'bokjiro',
        rank: idx + 1
      }));
    }
  } catch (e) {
    console.error('[BOKJIRO-REALTIME] ZUM 대체 실패');
  }
  
  return [];
}

/**
 * 모든 플랫폼의 실시간 검색어 통합 조회
 */
export async function getAllRealtimeKeywords(limitPerPlatform: number = 20): Promise<{
  zum: RealtimeKeyword[];
  google: RealtimeKeyword[];
  nate: RealtimeKeyword[];
  daum: RealtimeKeyword[];
  naver: RealtimeKeyword[];
  bokjiro: RealtimeKeyword[];
  timestamp: string;
}> {
  try {
    const [zum, google, nate, daum, naver, bokjiro] = await Promise.allSettled([
      getZumRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[]),
      getGoogleRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[]),
      getNateRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[]),
      getDaumRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[]),
      getNaverRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[]),
      // 일일 인기 검색어 (네이버 데이터랩 크롤링)
      getBokjiroRealtimeKeywords(limitPerPlatform).catch(() => [] as RealtimeKeyword[])
    ]);

    return {
      zum: (zum.status === 'fulfilled' ? zum.value : []) as RealtimeKeyword[],
      google: (google.status === 'fulfilled' ? google.value : []) as RealtimeKeyword[],
      nate: (nate.status === 'fulfilled' ? nate.value : []) as RealtimeKeyword[],
      daum: (daum.status === 'fulfilled' ? daum.value : []) as RealtimeKeyword[],
      naver: (naver.status === 'fulfilled' ? naver.value : []) as RealtimeKeyword[],
      bokjiro: (bokjiro.status === 'fulfilled' ? bokjiro.value : []) as RealtimeKeyword[],
      timestamp: new Date().toISOString()
    };
  } catch {
    // 에러가 발생해도 빈 배열 반환 (부분 실패 허용, 로그 제거)
    return {
      zum: [] as RealtimeKeyword[],
      google: [] as RealtimeKeyword[],
      nate: [] as RealtimeKeyword[],
      daum: [] as RealtimeKeyword[],
      naver: [] as RealtimeKeyword[],
      bokjiro: [] as RealtimeKeyword[],
      timestamp: new Date().toISOString()
    };
  }
}
