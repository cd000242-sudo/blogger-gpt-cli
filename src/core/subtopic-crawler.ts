// src/core/subtopic-crawler.ts
// 소제목 크롤링 및 AI 생성 기능

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// 유틸리티 함수
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface CrawledSubtopic {
  title: string;
  frequency: number;
  source: string;
  relevance: number;
}

export interface SubtopicCrawlerConfig {
  topic: string;
  keywords: string[];
  maxResults: number;
  naverClientId?: string;
  naverClientSecret?: string;
  googleCseKey?: string;
  googleCseCx?: string;
}

export class SubtopicCrawler {
  private openai?: OpenAI;
  private gemini?: GoogleGenerativeAI;

  constructor(openaiKey?: string, geminiKey?: string) {
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }
  }

  /**
   * 네이버 API를 사용해서 소제목 크롤링
   */
  async crawlSubtopicFromNaver(
    config: SubtopicCrawlerConfig
  ): Promise<CrawledSubtopic[]> {
    const { topic, keywords, maxResults = 5, naverClientId, naverClientSecret } = config;
    
    if (!naverClientId || !naverClientSecret) {
      console.log('[NAVER SUBTITLE] 네이버 API 키가 없어서 건너뛰기');
      console.log(`[NAVER SUBTITLE DEBUG] naverClientId: ${naverClientId ? '있음' : '없음'}, naverClientSecret: ${naverClientSecret ? '있음' : '없음'}`);
      return [];
    }

    try {
      console.log(`[NAVER SUBTITLE] "${topic}" 네이버 블로그 소제목 크롤링 시작...`);
      
      const searchQuery = `${topic} ${keywords.join(' ')}`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const apiUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodedQuery}&display=${maxResults}&sort=sim`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-Naver-Client-Id': naverClientId,
          'X-Naver-Client-Secret': naverClientSecret
        }
      });

      if (!response.ok) {
        console.log(`[NAVER SUBTITLE] API 호출 실패: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const subtopics: CrawledSubtopic[] = [];

      for (const item of data.items || []) {
        try {
          // 네이버 블로그에서 소제목 추출
          const blogSubtopic = await this.crawlNaverBlogSubtopic(item.link, topic, keywords);
          if (blogSubtopic.length > 0) {
            subtopics.push(...blogSubtopic);
          }
        } catch (error) {
          console.log(`[NAVER SUBTITLE] 블로그 소제목 크롤링 실패: ${item.link}`);
        }
      }

      console.log(`[NAVER SUBTITLE] 크롤링 완료: ${subtopics.length}개 소제목 수집`);
      return subtopics.slice(0, 10);

    } catch (error) {
      console.error('[NAVER SUBTITLE] 네이버 API 크롤링 실패:', error);
      return [];
    }
  }

  /**
   * RSS 피드에서 소제목 크롤링
   */
  async crawlSubtopicFromRSS(
    config: SubtopicCrawlerConfig
  ): Promise<CrawledSubtopic[]> {
    const { topic, keywords } = config;
    
    try {
      console.log(`[RSS SUBTITLE] "${topic}" RSS 피드 소제목 크롤링 시작...`);
      
      // 다양한 블로그 플랫폼 RSS 피드 URL들
      const rssFeeds = [
        // 네이버 관련
        `https://search.naver.com/search.naver?where=rss&query=${encodeURIComponent(topic)}`,
        `https://blog.naver.com/rss/search.naver?query=${encodeURIComponent(topic)}`,
        `https://section.blog.naver.com/rss/Search.naver?keyword=${encodeURIComponent(topic)}`,
        
        // 티스토리 (Tistory)
        `https://www.tistory.com/rss/search/${encodeURIComponent(topic)}`,
        
        // 브런치 (Brunch) - 네이버 글쓰기 플랫폼
        `https://brunch.co.kr/rss/search/${encodeURIComponent(topic)}`,
        
        // 벨로그 (Velog) - 개발자 블로그
        `https://velog.io/rss/search?q=${encodeURIComponent(topic)}`,
        
        // Google News RSS
        `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=ko&gl=KR&ceid=KR:ko`,
        
        // 네이버 뉴스 RSS
        `https://news.naver.com/main/rss/search.naver?query=${encodeURIComponent(topic)}`,
        
        // 다음 뉴스 RSS
        `https://media.daum.net/rss/search/${encodeURIComponent(topic)}`,
        
        // 미디엄 (Medium) - 글로벌 플랫폼
        `https://medium.com/feed/tag/${encodeURIComponent(topic)}`
      ];

      const subtopics: CrawledSubtopic[] = [];

      for (const feedUrl of rssFeeds) {
        try {
          const response = await fetch(feedUrl);
          if (!response.ok) continue;

          const xmlText = await response.text();
          const rssSubtopic = this.parseRSSSubtopic(xmlText, topic, keywords);
          subtopics.push(...rssSubtopic);
        } catch (error) {
          console.log(`[RSS SUBTITLE] 피드 소제목 크롤링 실패: ${feedUrl}`);
        }
      }

      console.log(`[RSS SUBTITLE] 크롤링 완료: ${subtopics.length}개 소제목 수집`);
      return subtopics.slice(0, 10);

    } catch (error) {
      console.error('[RSS SUBTITLE] RSS 크롤링 실패:', error);
      return [];
    }
  }

  /**
   * Google CSE를 사용해서 주제 관련 검색 결과에서 소제목 크롤링
   */
  async crawlSubtopicFromGoogle(
    config: SubtopicCrawlerConfig
  ): Promise<CrawledSubtopic[]> {
    const { topic, keywords, maxResults = 20, googleCseKey, googleCseCx } = config;
    
    if (!googleCseKey || !googleCseCx) {
      console.log('[CRAWLER] Google CSE 키가 없어서 기본 소제목 생성');
      return this.generateDefaultSubtopic(topic, keywords);
    }

    try {
      console.log(`[CRAWLER] "${topic}" 관련 소제목 크롤링 시작...`);
      
      const searchQuery = `${topic} ${keywords.join(' ')}`;
      
      // Rate Limiter import 및 사용
      const { safeCSERequest } = await import('../utils/google-cse-rate-limiter');
      
      const data = await safeCSERequest<{ items?: any[] }>(
        searchQuery,
        async () => {
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleCseKey}&cx=${googleCseCx}&q=${encodeURIComponent(searchQuery)}&num=${maxResults}`;
          const response = await fetch(searchUrl);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          return await response.json() as { items?: any[] };
        },
        { useCache: true, priority: 'normal' }
      );
      
      if (!data?.items || data.items.length === 0) {
        console.log('[CRAWLER] 검색 결과가 없어서 기본 소제목 생성');
        return this.generateDefaultSubtopic(topic, keywords);
      }

      // 검색 결과에서 소제목 추출
      const subtopics: CrawledSubtopic[] = [];
      
      for (const item of data.items) {
        try {
          // 각 검색 결과 페이지 크롤링
          const pageSubtopic = await this.crawlPageSubtopic(item.link, topic, keywords);
          subtopics.push(...pageSubtopic);
        } catch (error) {
          console.log(`[CRAWLER] 페이지 크롤링 실패: ${item.link}`);
        }
      }

      // 빈도수 기반으로 정렬하고 상위 5개 선택
      const rankedSubtopic = this.rankSubtopicByFrequency(subtopics);
      
      console.log(`[CRAWLER] 크롤링 완료: ${rankedSubtopic.length}개 소제목 추출`);
      return rankedSubtopic.slice(0, 5);
      
    } catch (error) {
      console.error('[CRAWLER] Google CSE 크롤링 실패:', error);
      return this.generateDefaultSubtopic(topic, keywords);
    }
  }

  /**
   * 개별 페이지에서 소제목 추출
   */
  private async crawlPageSubtopic(
    url: string, 
    topic: string, 
    keywords: string[]
  ): Promise<CrawledSubtopic[]> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) return [];
      
      const html = await response.text();
      const subtopics: CrawledSubtopic[] = [];
      
      // H2, H3 태그에서 소제목 추출
      const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
      const h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
      
      [...h2Matches, ...h3Matches].forEach(match => {
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (this.isRelevantSubtopic(text, topic, keywords)) {
          subtopics.push({
            title: text,
            frequency: 1,
            source: url,
            relevance: this.calculateRelevance(text, topic, keywords)
          });
        }
      });
      
      return subtopics;
    } catch (error) {
      return [];
    }
  }

  /**
   * 소제목이 주제와 관련이 있는지 확인
   */
  private isRelevantSubtopic(text: string, topic: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    const lowerTopic = topic.toLowerCase();
    
    // 너무 짧거나 긴 제목 제외
    if (text.length < 5 || text.length > 100) return false;
    
    // 주제나 키워드와 관련이 있는지 확인
    const hasTopicKeyword = keywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
    
    const hasTopicWord = lowerText.includes(lowerTopic) || 
                        lowerTopic.includes(lowerText);
    
    return hasTopicKeyword || hasTopicWord;
  }

  /**
   * 소제목의 관련도 계산
   */
  private calculateRelevance(text: string, topic: string, keywords: string[]): number {
    let relevance = 0;
    const lowerText = text.toLowerCase();
    
    // 키워드 매칭 점수
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        relevance += 2;
      }
    });
    
    // 주제 단어 매칭 점수
    const topicWords = topic.toLowerCase().split(' ');
    topicWords.forEach(word => {
      if (lowerText.includes(word)) {
        relevance += 1;
      }
    });
    
    return relevance;
  }

  /**
   * 빈도수 기반으로 소제목 순위 매기기
   */
  private rankSubtopicByFrequency(subtopics: CrawledSubtopic[]): CrawledSubtopic[] {
    const frequencyMap = new Map<string, CrawledSubtopic>();
    
    subtopics.forEach(subtopic => {
      const normalized = subtopic.title.toLowerCase().trim();
      const existing = frequencyMap.get(normalized);
      
      if (existing) {
        existing.frequency += subtopic.frequency;
        existing.relevance = Math.max(existing.relevance, subtopic.relevance);
      } else {
        frequencyMap.set(normalized, { ...subtopic });
      }
    });
    
    return Array.from(frequencyMap.values())
      .sort((a, b) => {
        // 빈도수 우선, 그 다음 관련도
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        return b.relevance - a.relevance;
      });
  }

  /**
   * 네이버 블로그에서 소제목 크롤링
   */
  private async crawlNaverBlogSubtopic(url: string, topic: string, keywords: string[]): Promise<CrawledSubtopic[]> {
    try {
      // 네이버 블로그 우회 크롤링
      let response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      if (!response.ok) {
        // 프록시 서버를 통한 우회 시도
        response = await this.tryProxyFetchSubtopic(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      const html = await response.text();
      return this.extractSubtopicFromHTML(html, url, topic, keywords);

    } catch (error) {
      console.log(`[NAVER SUBTITLE] 우회 크롤링도 실패: ${url}`);
      return [];
    }
  }

  /**
   * 프록시를 통한 우회 시도 (소제목용)
   */
  private async tryProxyFetchSubtopic(url: string): Promise<Response> {
    // 여러 프록시 서비스 시도
    const proxyServices = [
      `https://cors-anywhere.herokuapp.com/${url}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://thingproxy.freeboard.io/fetch/${url}`
    ];

    for (const proxyUrl of proxyServices) {
      try {
        const response = await fetch(proxyUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        if (response.ok) {
          return response;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('모든 프록시 서비스 실패');
  }

  /**
   * RSS XML에서 소제목 파싱
   */
  private parseRSSSubtopic(xmlText: string, topic: string, keywords: string[]): CrawledSubtopic[] {
    const subtopics: CrawledSubtopic[] = [];
    
    try {
      // 간단한 XML 파싱 (정규식 사용)
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
      
      for (const item of itemMatches) {
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const linkMatch = item.match(/<link>(.*?)<\/link>/i);
        
        if (titleMatch && linkMatch) {
          const title = titleMatch[1] || titleMatch[2] || '';
          const link = linkMatch[1] || '';
          
          if (this.isRelevantSubtopic(title, topic, keywords)) {
            subtopics.push({
              title: title.trim(),
              frequency: 1,
              source: link,
              relevance: this.calculateRelevance(title, topic, keywords)
            });
          }
        }
      }
    } catch (error) {
      console.error('[RSS SUBTITLE] XML 파싱 오류:', error);
    }
    
    return subtopics;
  }

  /**
   * HTML에서 소제목 추출
   */
  private extractSubtopicFromHTML(html: string, url: string, topic: string, keywords: string[]): CrawledSubtopic[] {
    const subtopics: CrawledSubtopic[] = [];
    
    try {
      // H2, H3 태그에서 소제목 추출
      const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
      const h3Matches = html.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
      
      [...h2Matches, ...h3Matches].forEach(match => {
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (this.isRelevantSubtopic(text, topic, keywords)) {
          subtopics.push({
            title: text,
            frequency: 1,
            source: url,
            relevance: this.calculateRelevance(text, topic, keywords)
          });
        }
      });
      
    } catch (error) {
      console.error('[SUBTITLE] HTML 파싱 오류:', error);
    }
    
    return subtopics;
  }

  /**
   * 기본 소제목 생성 (크롤링 실패 시)
   */
  private generateDefaultSubtopic(topic: string, _keywords: string[]): CrawledSubtopic[] {
    const defaultSubtopic = [
      `${topic}의 기본 개념과 이해`,
      `${topic}의 주요 특징과 장점`,
      `${topic}의 활용 방법과 사례`,
      `${topic}의 주의사항과 한계`,
      `${topic}의 미래 전망과 발전 방향`
    ];
    
    return defaultSubtopic.map((title, index) => ({
      title,
      frequency: 1,
      source: 'default',
      relevance: 5 - index
    }));
  }

  /**
   * AI를 사용해서 크롤링한 데이터를 바탕으로 완전히 새로운 소제목 생성
   */
  async generateAISubtopic(
    topic: string,
    keywords: string[],
    crawledData: CrawledSubtopic[],
    provider: 'openai' | 'gemini' = 'gemini',
    targetYear?: number | null
  ): Promise<string[]> {
    try {
      console.log('[AI GENERATOR] 크롤링 데이터 기반 AI 소제목 생성 시작...');
      
      const prompt = this.buildAISubtopicPrompt(topic, keywords, crawledData, targetYear);
      
      let response: string | undefined;
      if (provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        });
        response = completion.choices[0]?.message?.content || '';
      } else if (provider === 'gemini' && this.gemini) {
        // Gemini 2.0 이상 모델 사용 (할당량 초과 시 폴백)
        const models = ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];
        let model = null;
        let lastError = null;
        
        for (const modelName of models) {
          try {
            model = this.gemini.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            response = result.response.text();
            break; // 성공하면 중단
          } catch (error: any) {
            const errorMsg = String(error?.message || error || '');
            const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
            if (isRateLimit && models.indexOf(modelName) < models.length - 1) {
              lastError = error;
              continue; // 할당량 초과 시 다음 모델 시도
            }
            throw error; // 다른 오류는 즉시 throw
          }
        }
        
        if (!response) {
          throw lastError || new Error('사용 가능한 Gemini 모델이 없습니다.');
        }
      } else {
        throw new Error('AI 모델이 설정되지 않았습니다.');
      }
      
      // AI 응답에서 소제목 5개 추출
      const subtopic = this.extractSubtopicFromResponse(response);
      
      console.log(`[AI GENERATOR] AI 소제목 생성 완료: ${subtopic.length}개`);
      return subtopic;
      
    } catch (error) {
      console.error('[AI GENERATOR] AI 소제목 생성 실패:', error);
      // 실패 시 크롤링 데이터에서 상위 5개 반환
      return crawledData.slice(0, 5).map(item => item.title);
    }
  }

  /**
   * AI 소제목 생성 프롬프트 작성
   */
  private buildAISubtopicPrompt(
    topic: string, 
    keywords: string[], 
    crawledData: CrawledSubtopic[],
    targetYear?: number | null
  ): string {
    // 빈도수와 관련성을 기준으로 정렬
    const sortedData = crawledData
      .sort((a, b) => {
        // 1순위: 빈도수 높은 순
        if (b.frequency !== a.frequency) {
          return b.frequency - a.frequency;
        }
        // 2순위: 관련성 높은 순
        return b.relevance - a.relevance;
      })
      .slice(0, 10);
    
    const topSubtopic = sortedData.map(item => item.title);
    const frequencyData = sortedData.map(item => `빈도수: ${item.frequency}, 관련성: ${item.relevance}`);
    
    // 🔧 연도 정보 추가 (targetYear가 없으면 현재 연도 사용, 2026년이 되면 자동으로 2026년 인식)
    const now = new Date();
    const currentYear = targetYear || now.getFullYear();
    
    // 주제 타입 감지 (일정표, 표, 스케줄 관련)
    const isScheduleContent = topic.includes('일정') || topic.includes('스케줄') || topic.includes('표') || 
                             topic.includes('schedule') || topic.includes('table') || topic.includes('time');
    
    const contentType = isScheduleContent ? '일정표/표 형태 콘텐츠' : '일반 블로그 콘텐츠';
    const contentGuidance = isScheduleContent ? 
      '일정표나 표 형태의 정보를 다루는 주제입니다. 체계적이고 정확한 정보 전달에 중점을 두세요.' : 
      '일반적인 블로그 글 형태로 작성하세요.';
    
    return `당신은 블로그 콘텐츠 전문가입니다.

📝 **주제**: "${topic}" (${contentType})
🔑 **키워드**: ${keywords.join(', ')}
${targetYear ? `📅 **타깃 연도**: ${targetYear}년 (소제목에 반드시 ${targetYear}년 포함)` : `📅 **현재 연도**: ${currentYear}년 (소제목에 반드시 ${currentYear}년 포함)`}

📊 **크롤링된 소제목 데이터 (빈도수 순)**:
${topSubtopic.map((title, i) => `${i + 1}. ${title} (${frequencyData[i]})`).join('\n')}

🎯 **목표**: 위 크롤링 데이터를 기반으로 순위별로 5개의 소제목을 생성하세요.

✅ **요구사항**:
1. 정확히 5개의 소제목만 생성
2. **⚠️ 매우 중요: 각 소제목에 반드시 "${targetYear || currentYear}년"을 포함하세요!** (예: "${targetYear || currentYear}년 난방비 지원금")
3. **⚠️ 매우 중요: 크롤링된 데이터를 참고하되 완전히 새로운 표현으로 재작성하세요!**
   - 크롤링한 제목을 그대로 복사하지 마세요!
   - 단어 순서를 바꾸고, 다른 표현으로 완전히 새롭게 작성하세요!
   - 예: "2026년 홈택스 연말정산 미리보기 보는법" → "2026년 연말정산 미리보기 홈택스 확인 방법"
4. 순서는 빈도수 순서를 유지하되 **완전히 다른 표현으로** 변경
5. 각 소제목은 15-30자 내외 (짧고 간결하게)
6. 키워드를 자연스럽게 포함
7. ${contentGuidance}

❌ **금지사항**:
- ⚠️ **절대 금지**: 소제목 뒤에 출처(예: "- 브런치", "- 위기브", "- 네이버", "- 카드/한컷" 등)를 붙이지 마세요!
- ⚠️ **절대 금지**: 소제목 뒤에 "가이드", "완벽 정리", "총정리" 등 추가하지 말 것
- ⚠️ **절대 금지**: 원본 크롤링 데이터를 그대로 복사하지 말 것
- ⚠️ **절대 금지**: 크롤링한 제목을 그대로 사용하지 말고 완전히 새로운 표현으로 재작성하세요!
- 너무 길거나 복잡한 제목 금지

📋 **출력 형식**:
소제목:
1. [첫 번째 소제목 (최고 빈도, 살짝 변형)]
2. [두 번째 소제목 (두 번째 빈도, 살짝 변형)]
3. [세 번째 소제목 (세 번째 빈도, 살짝 변형)]
4. [네 번째 소제목 (네 번째 빈도, 살짝 변형)]
5. [다섯 번째 소제목 (다섯 번째 빈도, 살짝 변형)]

⚠️ **최종 확인**:
- 소제목 뒤에 출처를 붙이지 마세요!
- 크롤링한 제목을 그대로 사용하지 말고 완전히 새로운 표현으로 재작성하세요!

이제 "${topic}"에 대한 크롤링 기반 순위별 소제목 5개를 **완전히 새로운 표현으로 재작성**하여 생성해주세요.`;
  }

  /**
   * AI 응답에서 소제목 추출
   */
  private extractSubtopicFromResponse(response: string): string[] {
    const lines = response.split('\n');
    const subtopic: string[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match && match[1]) {
        const title = match[1].trim();
        if (title.length >= 5 && title.length <= 100) {
          subtopic.push(title);
        }
      }
    });
    
    return subtopic.slice(0, 5); // 최대 5개만 반환
  }

  /**
   * 소제목을 기반으로 작은 소제목(H3) 생성
   */
  async generateSmallSubtopic(
    mainSubtopic: string,
    topic: string,
    keywords: string[],
    provider: 'openai' | 'gemini' = 'gemini'
  ): Promise<string[]> {
    try {
      console.log(`[SMALL SUBTITLE] "${mainSubtopic}"에 대한 작은 소제목 생성 시작...`);
      
      const prompt = this.buildSmallSubtopicPrompt(mainSubtopic, topic, keywords);
      
      let response: string | undefined;
      if (provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        });
        response = completion.choices[0]?.message?.content || '';
      } else if (provider === 'gemini' && this.gemini) {
        // Gemini 2.0 이상 모델 사용 (할당량 초과 시 폴백)
        const models = ['gemini-3-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];
        let model = null;
        let lastError = null;
        
        for (const modelName of models) {
          try {
            model = this.gemini.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            response = result.response.text();
            break; // 성공하면 중단
          } catch (error: any) {
            const errorMsg = String(error?.message || error || '');
            const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);
            if (isRateLimit && models.indexOf(modelName) < models.length - 1) {
              lastError = error;
              continue; // 할당량 초과 시 다음 모델 시도
            }
            throw error; // 다른 오류는 즉시 throw
          }
        }
        
        if (!response) {
          throw lastError || new Error('사용 가능한 Gemini 모델이 없습니다.');
        }
      } else {
        throw new Error('AI 모델이 설정되지 않았습니다.');
      }
      
      // AI 응답에서 작은 소제목 3-4개 추출
      const smallSubtopic = this.extractSmallSubtopicFromResponse(response);
      
      console.log(`[SMALL SUBTITLE] 작은 소제목 생성 완료: ${smallSubtopic.length}개`);
      return smallSubtopic;
      
    } catch (error) {
      console.error('[SMALL SUBTITLE] 작은 소제목 생성 실패:', error);
      // 실패 시 기본 작은 소제목 반환
      return [
        `${mainSubtopic}의 핵심 포인트`,
        `${mainSubtopic}의 주요 특징`,
        `${mainSubtopic}의 실용적 활용법`,
        `${mainSubtopic}의 주의사항`
      ].slice(0, 3);
    }
  }

  /**
   * 작은 소제목 생성 프롬프트 작성
   */
  private buildSmallSubtopicPrompt(
    mainSubtopic: string,
    topic: string,
    keywords: string[]
  ): string {
    return `당신은 블로그 콘텐츠 전문가입니다.

📝 **메인 소제목**: "${mainSubtopic}"
📝 **전체 주제**: "${topic}"
🔑 **키워드**: ${keywords.join(', ')}

🎯 **목표**: "${mainSubtopic}"에 대한 사람들이 가장 많이 검색할 만한 작은 소제목(H3) 3-4개를 생성하세요.

✅ **요구사항**:
1. 정확히 3-4개의 작은 소제목만 생성
2. 사람들이 실제로 검색할 만한 구체적인 내용
3. 각 작은 소제목은 10-20자 내외 (짧고 간결하게)
4. 키워드를 자연스럽게 포함
5. 검색 의도에 맞는 실용적인 제목
6. 중복되지 않는 다양한 관점의 제목

📋 **출력 형식**:
작은 소제목:
1. [첫 번째 작은 소제목]
2. [두 번째 작은 소제목]
3. [세 번째 작은 소제목]
4. [네 번째 작은 소제목]

이제 "${mainSubtopic}"에 대한 검색 빈도 높은 작은 소제목 3-4개를 생성해주세요.`;
  }

  /**
   * 작은 소제목 응답에서 추출
   */
  private extractSmallSubtopicFromResponse(response: string): string[] {
    const lines = response.split('\n');
    const smallSubtopic: string[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match && match[1]) {
        smallSubtopic.push(match[1].trim());
      }
    });
    
    return smallSubtopic;
  }
}

/**
 * 통합 소제목 생성 함수
 * 폴백 순서: 네이버 API → RSS → CSE → 기본 소제목
 */
export async function generateOptimalSubtopic(
  topic: string,
  keywords: string[],
  options: {
    openaiKey?: string;
    geminiKey?: string;
    naverClientId?: string;
    naverClientSecret?: string;
    googleCseKey?: string;
    googleCseCx?: string;
    provider?: 'openai' | 'gemini';
    crawledContents?: any[]; // 크롤링된 콘텐츠 추가
    targetYear?: number | null; // 🔧 타깃 연도 추가
  } = {}
): Promise<string[]> {
  const { openaiKey, geminiKey, naverClientId, naverClientSecret, googleCseKey, googleCseCx, provider = 'gemini', crawledContents = [], targetYear } = options;
  
  const crawler = new SubtopicCrawler(openaiKey, geminiKey);
  
  console.log(`[SUBTITLE CRAWLER] 📋 소제목 크롤링 폴백 순서 시작: 네이버 데이터랩 API → 크롤링 데이터 → 네이버 검색 API → RSS → CSE → 기본 소제목`);
  
  let allSubtopic: string[] = [];
  
  // 🏆 0단계: 네이버 데이터랩 API로 트렌드 키워드 기반 소제목 생성 (최우선)
  if (naverClientId && naverClientSecret) {
    console.log(`[SUBTITLE CRAWLER] 🏆 0단계: 네이버 데이터랩 API로 트렌드 키워드 기반 소제목 생성 중...`);
    try {
      const { getNaverTrendKeywords, getNaverRelatedKeywords } = await import('../utils/naver-datalab-api');
      const datalabConfig = { clientId: naverClientId, clientSecret: naverClientSecret };
      
      // 트렌드 키워드 조회
      const trendKeywords = await getNaverTrendKeywords(datalabConfig, {
        keywords: [topic, ...keywords.slice(0, 3)],
        timeUnit: 'month',
        startDate: getDateDaysAgo(90)
      });
      
      // 연관 키워드 조회
      const relatedKeywords: string[] = [];
      for (const kw of [topic, ...keywords.slice(0, 2)]) {
        try {
          const related = await getNaverRelatedKeywords(kw, datalabConfig, { limit: 3 });
          relatedKeywords.push(...related.map(r => r.keyword));
        } catch (error) {
          console.warn(`[SUBTITLE CRAWLER] 연관 키워드 조회 실패 (${kw}):`, error);
        }
      }
      
      // 트렌드 키워드와 연관 키워드를 소제목 후보로 사용
      const datalabSubtitles = [...trendKeywords.map(t => t.keyword), ...relatedKeywords]
        .filter((kw, idx, arr) => arr.indexOf(kw) === idx) // 중복 제거
        .slice(0, 10);
      
      if (datalabSubtitles.length > 0) {
        allSubtopic.push(...datalabSubtitles);
        console.log(`[SUBTITLE CRAWLER] ✅ 데이터랩 API 성공: ${datalabSubtitles.length}개 소제목 수집`);
      } else {
        console.log(`[SUBTITLE CRAWLER] ⚠️ 데이터랩 API 결과 없음, 다음 단계로...`);
      }
    } catch (error) {
      console.log(`[SUBTITLE CRAWLER] ❌ 데이터랩 API 실패: ${error}, 다음 단계로...`);
    }
  } else {
    console.log(`[SUBTITLE CRAWLER] ⚠️ 데이터랩 API 키 없음, 다음 단계로...`);
  }
  
  // 🎯 1단계: 크롤링된 콘텐츠에서 소제목 추출
  if (crawledContents.length > 0) {
    console.log(`[SUBTITLE CRAWLER] 🎯 1단계: 크롤링된 콘텐츠에서 소제목 추출 중...`);
    const crawledTitles = crawledContents.map(content => content.title).filter(title => title);
    if (crawledTitles.length > 0) {
      allSubtopic.push(...crawledTitles);
      console.log(`[SUBTITLE CRAWLER] ✅ 크롤링 데이터에서 ${crawledTitles.length}개 제목 추출`);
    }
  }
  
  // 🥇 2단계: 네이버 검색 API 소제목 크롤링
  console.log(`[SUBTITLE CRAWLER] 🥇 2단계: 네이버 검색 API 소제목 크롤링 시도...`);
  try {
    const naverSubtopic = await crawler.crawlSubtopicFromNaver({
      topic,
      keywords,
      maxResults: 5,
      ...(naverClientId !== undefined && { naverClientId }),
      ...(naverClientSecret !== undefined && { naverClientSecret })
    });
    
    if (naverSubtopic.length > 0) {
      const titles = naverSubtopic.map(item => item.title);
      allSubtopic.push(...titles);
      console.log(`[SUBTITLE CRAWLER] ✅ 네이버 API 성공: ${naverSubtopic.length}개 소제목 수집`);
    } else {
      console.log(`[SUBTITLE CRAWLER] ⚠️ 네이버 API 결과 없음, 다음 단계로...`);
    }
  } catch (error) {
    console.log(`[SUBTITLE CRAWLER] ❌ 네이버 API 실패: ${error}, 다음 단계로...`);
  }
  
  // 🥈 3단계: RSS 소제목 크롤링
  console.log(`[SUBTITLE CRAWLER] 🥈 3단계: RSS 소제목 크롤링 시도...`);
  try {
    const rssSubtopic = await crawler.crawlSubtopicFromRSS({
      topic,
      keywords,
      maxResults: 5
    });
    
    if (rssSubtopic.length > 0) {
      const titles = rssSubtopic.map(item => item.title);
      allSubtopic.push(...titles);
      console.log(`[SUBTITLE CRAWLER] ✅ RSS 성공: ${rssSubtopic.length}개 소제목 수집`);
    } else {
      console.log(`[SUBTITLE CRAWLER] ⚠️ RSS 결과 없음, 다음 단계로...`);
    }
  } catch (error) {
    console.log(`[SUBTITLE CRAWLER] ❌ RSS 실패: ${error}, 다음 단계로...`);
  }
  
  // 🥉 4단계: Google CSE 소제목 크롤링
  console.log(`[SUBTITLE CRAWLER] 🥉 4단계: Google CSE 소제목 크롤링 시도...`);
  try {
    const cseSubtopic = await crawler.crawlSubtopicFromGoogle({
      topic,
      keywords,
      maxResults: 10,
      ...(googleCseKey !== undefined && { googleCseKey }),
      ...(googleCseCx !== undefined && { googleCseCx })
    });
    
    if (cseSubtopic.length > 0) {
      const titles = cseSubtopic.map(item => item.title);
      allSubtopic.push(...titles);
      console.log(`[SUBTITLE CRAWLER] ✅ CSE 성공: ${cseSubtopic.length}개 소제목 수집`);
    } else {
      console.log(`[SUBTITLE CRAWLER] ⚠️ CSE 결과 없음, 기본 소제목 사용...`);
    }
  } catch (error) {
    console.log(`[SUBTITLE CRAWLER] ❌ CSE 실패: ${error}, 기본 소제목 사용...`);
  }
  
  // 🛡️ 5단계: 기본 소제목 (최종 폴백)
  if (allSubtopic.length === 0) {
    console.log(`[SUBTITLE CRAWLER] 🛡️ 4단계: 모든 크롤링 실패, 기본 소제목 생성...`);
    return generateDefaultSubtopic(topic, keywords, targetYear);
  }
  
  // 🎯 5단계: 검색 빈도 기반 소제목 점수 매기기
  console.log(`[SUBTITLE CRAWLER] 🎯 5단계: 검색 빈도 분석 중...`);
  
  // 소제목별 등장 빈도 계산
  const subtopicFrequency = new Map<string, number>();
  const subtopicSources = new Map<string, Set<string>>();
  
  allSubtopic.forEach(item => {
    const normalized = item.toLowerCase().trim();
    subtopicFrequency.set(normalized, (subtopicFrequency.get(normalized) || 0) + 1);
    
    if (!subtopicSources.has(normalized)) {
      subtopicSources.set(normalized, new Set());
    }
    subtopicSources.get(normalized)!.add(item); // 원본 보존
  });
  
  // 점수 계산: (등장 빈도 * 3) + (키워드 매칭 점수)
  const scoredSubtopics = Array.from(subtopicFrequency.entries()).map(([normalized, frequency]) => {
    // 키워드 매칭 점수 계산
    const keywordScore = keywords.reduce((score, keyword) => {
      return normalized.includes(keyword.toLowerCase()) ? score + 2 : score;
    }, 0);
    
    const totalScore = (frequency * 3) + keywordScore;
    const originalText = Array.from(subtopicSources.get(normalized) || [])[0];
    
    return {
      text: originalText,
      normalized,
      frequency,
      keywordScore,
      totalScore
    };
  });
  
  // 점수 순으로 정렬 (높은 점수 우선)
  const rankedSubtopics = scoredSubtopics
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 10); // 상위 10개 선택
  
  console.log(`[SUBTITLE CRAWLER] 📊 검색 빈도 분석 완료 (상위 5개):`);
  rankedSubtopics.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}위: "${item.text}" (빈도: ${item.frequency}, 점수: ${item.totalScore})`);
  });
  
  // 🎯 6단계: AI로 최종 소제목 5개 생성 (검색 빈도 높은 것 우선)
  console.log(`[SUBTITLE CRAWLER] 🎯 6단계: 검색 빈도 기반 AI 소제목 생성...`);
  try {
    // 점수가 높은 소제목을 CrawledSubtopic 형식으로 변환
    const topCrawledSubtopics: CrawledSubtopic[] = rankedSubtopics
      .filter(item => item.text)
      .map(item => ({
        title: item.text!,
        frequency: item.frequency,
        source: 'crawled',
        relevance: item.totalScore
      }));
    
    const aiSubtopic = await crawler.generateAISubtopic(
      topic,
      keywords,
      topCrawledSubtopics,
      provider,
      targetYear
    );
    
    if (aiSubtopic.length >= 5) {
      console.log(`[SUBTITLE CRAWLER] ✅ AI 생성 성공: ${aiSubtopic.length}개 소제목 생성`);
      return aiSubtopic.slice(0, 5);
    } else {
      console.log(`[SUBTITLE CRAWLER] ⚠️ AI 생성 부족: ${aiSubtopic.length}개만 생성, 검색 빈도 높은 소제목 사용...`);
      return combineSubtopic(aiSubtopic, topic, keywords, targetYear);
    }
  } catch (error) {
    console.log(`[SUBTITLE CRAWLER] ❌ AI 생성 실패: ${error}, 검색 빈도 높은 소제목 사용...`);
    // AI 실패 시 검색 빈도 높은 소제목 직접 사용
    const topSubtopic = rankedSubtopics
      .slice(0, 5)
      .map(item => item.text)
      .filter((text): text is string => text !== undefined);
    if (topSubtopic.length >= 5) {
      console.log(`[SUBTITLE CRAWLER] ✅ 검색 빈도 기반 소제목 ${topSubtopic.length}개 선택`);
      return topSubtopic;
    }
    return generateDefaultSubtopic(topic, keywords, targetYear);
  }
}

/**
 * AI 생성 소제목과 기본 소제목 결합
 */
function combineSubtopic(aiSubtopic: string[], topic: string, keywords: string[], targetYear?: number | null): string[] {
  const defaultSubtopic = generateDefaultSubtopic(topic, keywords, targetYear);
  const combined = [...aiSubtopic];
  
  // 부족한 만큼 기본 소제목으로 채우기
  for (let i = aiSubtopic.length; i < 5; i++) {
    const item = defaultSubtopic[i];
    if (item) {
      combined.push(item);
    }
  }
  
  return combined.slice(0, 5);
}

/**
 * 기본 소제목 생성 (모든 크롤링 실패 시)
 */
function generateDefaultSubtopic(topic: string, _keywords: string[], targetYear?: number | null): string[] {
  // 🔧 연도 정보 추가
  const now = new Date();
  let currentYear = now.getFullYear();
  if (targetYear && Math.abs(targetYear - currentYear) <= 5) {
    currentYear = targetYear;
  }
  
  return [
    `${targetYear || currentYear}년 ${topic}의 기본 개념과 이해`,
    `${targetYear || currentYear}년 ${topic}의 주요 특징과 장점`,
    `${targetYear || currentYear}년 ${topic}의 활용 방법과 사례`,
    `${targetYear || currentYear}년 ${topic}의 주의사항과 한계`,
    `${targetYear || currentYear}년 ${topic}의 미래 전망과 발전 방향`
  ];
}
