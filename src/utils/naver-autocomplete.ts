/**
 * 네이버 검색 자동완성 및 연관 검색어 크롤링
 * 네이버 검색 페이지에서 실제 사용자가 검색하는 연관 검색어 추출
 */

export interface NaverApiConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * 네이버 검색 자동완성 키워드 추출 (실제 검색 패턴 기반)
 */
export async function getNaverAutocompleteKeywords(
  baseKeyword: string,
  config: NaverApiConfig
): Promise<string[]> {
  const keywords = new Set<string>();

  try {
    // 방법 1: 네이버 검색 API의 연관 검색어 추출
    // 네이버 블로그 검색 결과에서 제목 패턴 분석
    const apiUrl = 'https://openapi.naver.com/v1/search/blog.json';
    const headers = {
      'X-Naver-Client-Id': config.clientId,
      'X-Naver-Client-Secret': config.clientSecret
    };

    const params = new URLSearchParams({
      query: baseKeyword,
      display: '100',
      sort: 'sim' // 정확도순 (실제 검색 패턴 반영)
    });

    const response = await fetch(`${apiUrl}?${params}`, {
      method: 'GET',
      headers: headers
    });

    if (response.ok) {
      const data = await response.json();
      const items = data.items || [];

      // 제목에서 실제 검색 패턴 추출 + 연상 키워드 추출
      items.forEach((item: any) => {
        const title = (item.title || '').replace(/<[^>]*>/g, '').trim();
        const description = (item.description || '').replace(/<[^>]*>/g, '').trim();
        const fullText = `${title} ${description}`;

        // 키워드가 포함된 제목 전체를 키워드로 간주 (실제 검색 패턴)
        if (title.includes(baseKeyword) && title.length <= 30) {
          keywords.add(title);
        }

        // 설명에서도 의미 있는 구문 추출
        if (description.includes(baseKeyword)) {
          const sentences = description.split(/[.|!?。！？]/);
          sentences.forEach((sentence: string) => {
            const trimmed = sentence.trim();
            if (trimmed.includes(baseKeyword) && trimmed.length >= baseKeyword.length && trimmed.length <= 40) {
              keywords.add(trimmed);
            }
          });
        }

        // 연상 키워드 추출: 키워드와 함께 언급되는 사건명, 장소명, 관련 용어 등
        // 패턴 1: "XXX사건", "XXX사고", "XXX살인사건" 등 긴 구문 추출
        const incidentPatterns = [
          /([가-힣]{2,20}(?:연쇄살인사건|살인사건|연쇄살인|범죄|살인|사건|사고))/g,
          /([가-힣]{2,20}(?:사건|사고))/g,
          /([가-힣]{2,15}(?:사건|사고))/g
        ];

        incidentPatterns.forEach(pattern => {
          try {
            const matches = fullText.matchAll(pattern);
            for (const match of matches) {
              if (match[1] && match[1].length >= 3 && match[1].length <= 30) {
                const keyword = match[1].trim();
                // 키워드와 함께 언급되는 경우만 추가 (키워드가 제목/설명에 있으면)
                if (fullText.includes(baseKeyword) && keyword.length > baseKeyword.length) {
                  keywords.add(keyword);
                }
              }
            }
          } catch (e) {
            // 패턴 오류 무시
          }
        });

        // 패턴 2: 키워드 앞뒤로 나오는 긴 명사 구문 추출 (3-6개 단어)
        if (fullText.includes(baseKeyword)) {
          const words = fullText.split(/[\s|,，、·\[\]()【】「」<>]+/).filter(w => w.trim().length > 0);
          const keywordIndex = words.findIndex((w: string) => w.includes(baseKeyword));

          if (keywordIndex >= 0) {
            // 키워드 앞에서 긴 구문 추출 (최대 5개 단어)
            for (let len = 3; len <= 6 && keywordIndex - len >= 0; len++) {
              const phraseWords = words.slice(keywordIndex - len, keywordIndex);
              if (phraseWords.length >= 3) {
                const phrase = phraseWords.join(' ').trim();
                if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                  keywords.add(phrase);
                }
              }
            }

            // 키워드 뒤에서 긴 구문 추출 (최대 5개 단어)
            for (let len = 3; len <= 6 && keywordIndex + len < words.length; len++) {
              const phraseWords = words.slice(keywordIndex + 1, keywordIndex + 1 + len);
              if (phraseWords.length >= 3) {
                const phrase = phraseWords.join(' ').trim();
                if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                  keywords.add(phrase);
                }
              }
            }

            // 키워드 앞뒤 모두 포함한 긴 구문 추출
            for (let before = 1; before <= 3; before++) {
              for (let after = 1; after <= 3; after++) {
                if (keywordIndex - before >= 0 && keywordIndex + after < words.length) {
                  const phraseWords = words.slice(keywordIndex - before, keywordIndex + after + 1);
                  if (phraseWords.length >= 3) {
                    const phrase = phraseWords.join(' ').trim();
                    if (phrase.length >= 6 && phrase.length <= 30 && /^[가-힣\s]+$/.test(phrase)) {
                      keywords.add(phrase);
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    // 방법 2: 실제 네이버 검색 페이지 크롤링하여 연관 검색어 및 스마트블록 추출
    try {
      const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(baseKeyword)}`;

      const htmlResponse = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      if (htmlResponse.ok) {
        const html = await htmlResponse.text();

        // 스마트블록에서 연관키워드 추출 (네이버 스마트블록 패턴)
        // 스마트블록은 다양한 패턴으로 표시될 수 있음
        const smartBlockPatterns = [
          // 스마트블록 내부의 키워드 패턴
          /<div[^>]*class="[^"]*smart_block[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          /<section[^>]*class="[^"]*smart_block[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
          /<div[^>]*data-module="[^"]*SmartBlock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
          // 연관 검색어 패턴 (스마트블록 포함)
          /<a[^>]*class="[^"]*related_srch[^"]*"[^>]*>([^<]+)<\/a>/g,
          /<span[^>]*class="[^"]*related_keyword[^"]*"[^>]*>([^<]+)<\/span>/g,
          /<button[^>]*class="[^"]*related_srch[^"]*"[^>]*>([^<]+)<\/button>/g,
          // 스마트블록 내부 링크
          /<a[^>]*href="[^"]*query=([^"&]+)[^"]*"[^>]*>([^<]+)<\/a>/g,
          // data-keyword 속성
          /data-keyword="([^"]+)"/g,
          /data-query="([^"]+)"/g,
          // 일반 키워드 패턴
          /keyword[^>]*>([^<]+)</g
        ];

        // 스마트블록 HTML 추출 후 내부 키워드 파싱
        const smartBlockMatches = html.match(/<div[^>]*class="[^"]*smart_block[^"]*"[^>]*>([\s\S]*?)<\/div>/gi) ||
          html.match(/<section[^>]*class="[^"]*smart_block[^"]*"[^>]*>([\s\S]*?)<\/section>/gi) ||
          html.match(/<div[^>]*data-module="[^"]*SmartBlock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);

        if (smartBlockMatches && smartBlockMatches.length > 0) {
          console.log(`[NAVER-AUTOCOMPLETE] 스마트블록 발견: ${smartBlockMatches.length}개`);
          smartBlockMatches.forEach((block: string) => {
            // 스마트블록 내부에서 키워드 추출
            smartBlockPatterns.slice(3).forEach(pattern => {
              let match;
              while ((match = pattern.exec(block)) !== null) {
                const keyword = decodeURIComponent((match[1] || match[2] || '').trim());
                if (keyword && keyword.length >= 2 && keyword.length <= 30) {
                  keywords.add(keyword);
                }
              }
            });
          });
        }

        // 일반 연관 검색어 패턴 추출 (스마트블록 외부)
        const relatedPatterns = [
          /<a[^>]*class="[^"]*related_srch[^"]*"[^>]*>([^<]+)<\/a>/g,
          /<span[^>]*class="[^"]*related_keyword[^"]*"[^>]*>([^<]+)<\/span>/g,
          /data-keyword="([^"]+)"/g,
          /keyword[^>]*>([^<]+)</g
        ];

        relatedPatterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(html)) !== null) {
            const keyword = (match[1] || match[2] || '').trim();
            if (keyword && keyword.length >= 2 && keyword.length <= 30) {
              try {
                // URL 디코딩
                const decodedKeyword = decodeURIComponent(keyword);
                keywords.add(decodedKeyword);
              } catch {
                keywords.add(keyword);
              }
            }
          }
        });

        console.log(`[NAVER-AUTOCOMPLETE] 스마트블록 및 연관 검색어 추출 완료: ${keywords.size}개`);
      }
    } catch (htmlErr) {
      console.warn('[NAVER-AUTOCOMPLETE] HTML 크롤링 실패, API 결과만 사용:', htmlErr);
    }

    return Array.from(keywords).slice(0, 50);
  } catch (error: any) {
    console.error('[NAVER-AUTOCOMPLETE] 연관 검색어 추출 실패:', error);
    return [];
  }
}

// ─────────────────────────────────────────────
// 경량 자동완성 함수 (재귀 확장용)
// ─────────────────────────────────────────────

/**
 * 네이버 자동완성 API에서 순수 키워드만 추출 (재귀 확장용, 경량)
 * HTML 파싱 없이 자동완성 API만 호출하여 빠르고 안정적
 */
export async function fetchNaverAutocomplete(keyword: string): Promise<string[]> {
  try {
    const acUrl = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}&con=1&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8`;
    const resp = await fetch(acUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.items || [];
    const suggestions: string[] = [];

    for (const group of items) {
      if (Array.isArray(group)) {
        for (const item of group) {
          if (Array.isArray(item) && item[0]) {
            const kw = String(item[0]).trim();
            if (kw.length >= 2 && kw.length <= 40 && kw !== keyword) {
              suggestions.push(kw);
            }
          }
        }
      }
    }

    return suggestions;
  } catch {
    return [];
  }
}

/**
 * 구글 자동완성 API에서 키워드 추출 (AdSense/SEO용)
 */
export async function fetchGoogleAutocomplete(keyword: string): Promise<string[]> {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=ko&q=${encodeURIComponent(keyword)}`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    const suggestions = data?.[1] || [];
    return suggestions
      .filter((s: any) => typeof s === 'string' && s.length >= 2 && s.length <= 40 && s !== keyword)
      .map((s: string) => s.trim());
  } catch {
    return [];
  }
}

