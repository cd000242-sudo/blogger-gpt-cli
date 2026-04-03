// src/core/content-crawler.ts
// 본문 내용 크롤링 및 AI 믹싱 시스템 (대량 크롤링 업그레이드)

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { MassCrawlingSystem, MassCrawledItem, MassCrawlingOptions } from './mass-crawler';

export interface CrawledContent {
  title: string;
  content: string;
  source: string;
  platform: 'naver' | 'tistory' | 'blogspot' | 'wordpress' | 'rss' | 'cse' | 'brunch' | 'velog' | 'medium' | 'google-news' | 'daum-news';
  relevance: number;
  url: string;
  publishDate?: string;
  extractedData?: {
    dates?: string[];      // 추출된 날짜 정보
    numbers?: string[];    // 추출된 숫자 정보
    prices?: string[];     // 추출된 가격/금액 정보
    percentages?: string[]; // 추출된 퍼센트 정보
  };
}

export interface CrawledCTA {
  text: string;
  url: string;
  type: 'button' | 'link' | 'banner';
  context: string;
  hook?: string; // 후킹 멘트
  source: string;
  relevance: number;
  isExternal?: boolean; // 외부 링크 여부
}

export interface ContentCrawlerConfig {
  topic: string;
  keywords: string[];
  maxResults: number;
  naverClientId?: string;
  naverClientSecret?: string;
  googleCseKey?: string;
  googleCseCx?: string;
}

export class ContentCrawler {
  private openai?: OpenAI;
  private gemini?: GoogleGenerativeAI;
  private massCrawler?: MassCrawlingSystem;

  constructor(openaiKey?: string, geminiKey?: string) {
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (geminiKey) {
      this.gemini = new GoogleGenerativeAI(geminiKey);
    }
  }

  /**
   * 대량 크롤링 시스템 초기화
   */
  initializeMassCrawler(
    naverClientId?: string,
    naverClientSecret?: string,
    googleApiKey?: string,
    googleCseId?: string
  ): void {
    this.massCrawler = new MassCrawlingSystem(
      naverClientId,
      naverClientSecret,
      googleApiKey,
      googleCseId
    );
  }

  /**
   * 대량 크롤링 실행 (새로운 메서드)
   */
  async crawlMassive(
    topic: string,
    keywords: string[],
    options: MassCrawlingOptions = {}
  ): Promise<{
    contents: CrawledContent[];
    ctas: CrawledCTA[];
    stats: any;
  }> {
    if (!this.massCrawler) {
      throw new Error('대량 크롤링 시스템이 초기화되지 않았습니다. initializeMassCrawler()를 먼저 호출하세요.');
    }

    logMassCrawler('info', `[MASS-CRAWLER] 🚀 대량 크롤링 시작: "${topic}"`);
    logMassCrawler('info', `[MASS-CRAWLER] 🔑 키워드: ${keywords.join(', ')}`);

    // 대량 크롤링 실행
    const { items, stats } = await this.massCrawler.crawlAll(topic, {
      maxResults: 2000,
      enableFullContent: true,
      maxConcurrent: 20,
      ...options
    });

    // MassCrawledItem을 CrawledContent로 변환
    const contents: CrawledContent[] = items.map(item => ({
      title: item.title,
      content: item.fullContent?.text || item.description,
      source: item.source,
      platform: this.mapSourceToPlatform(item.source),
      relevance: Math.min(item.popularityScore / 10, 10), // 0-10 스케일로 변환
      url: item.link,
      publishDate: item.pubDate,
      extractedData: this.extractDataFromText(item.description)
    }));

    // AI 기반 CTA 생성
    const ctas = await this.generateSmartCTAs(topic, keywords, contents);

    logMassCrawler('info', `[MASS-CRAWLER] ✅ 대량 크롤링 완료: ${contents.length}개 글, ${ctas.length}개 CTA`);

    return { contents, ctas, stats };
  }

  /**
   * 향상된 대량 크롤링 (여러 키워드 동시 처리)
   */
  async crawlMassiveMultiKeyword(
    topic: string,
    keywords: string[],
    options: MassCrawlingOptions & { keywordConcurrency?: number } = {}
  ): Promise<{
    contents: CrawledContent[];
    ctas: CrawledCTA[];
    stats: any;
    analysis: {
      topKeywords: Array<{ keyword: string; frequency: number }>;
      contentQuality: Array<{ url: string; score: number; factors: string[] }>;
      trendingTopics: string[];
    };
  }> {
    if (!this.massCrawler) {
      throw new Error('대량 크롤링 시스템이 초기화되지 않았습니다.');
    }

    logMassCrawler('info', `[MASS-CRAWLER] 🚀 다중 키워드 대량 크롤링 시작: "${topic}"`);
    logMassCrawler('info', `[MASS-CRAWLER] 🔑 키워드: ${keywords.join(', ')}`);

    const {
      keywordConcurrency = Math.min(5, Math.max(2, keywords.length)), // 동시 처리 수 증가 (3 -> 5)
      ...rawOptions
    } = options as MassCrawlingOptions & { keywordConcurrency?: number };

    const sharedOptions: MassCrawlingOptions = { ...rawOptions };
    const manualUrls = rawOptions.manualUrls;
    const geminiKey = (rawOptions as any).geminiKey;
    delete (sharedOptions as any).manualUrls;

    const keywordLimiter = pLimit(Math.max(1, keywordConcurrency));

    const keywordTasks = keywords.map((keyword, index) =>
      keywordLimiter(async () => {
        const label = `[${index + 1}/${keywords.length}]`;
        logMassCrawler('info', `[MASS-CRAWLER] 🔑 ${label} 키워드 크롤링 시작: "${keyword}"`);
        const keywordStartTime = Date.now();

        const crawlOptions: MassCrawlingOptions = {
          ...sharedOptions,
          maxResults: Math.floor((sharedOptions.maxResults || 2000) / Math.max(1, keywords.length)),
          ...(index === 0 && manualUrls ? { manualUrls } : {}),
          topic: topic, // AI 제목 생성용
          keywords: keywords, // AI 제목 생성용
          ...(geminiKey ? { geminiKey } : {}) // AI 제목 생성용
        };

        try {
          const result = await this.massCrawler!.crawlAll(keyword, crawlOptions);
          const keywordDuration = Date.now() - keywordStartTime;
          logMassCrawler(
            'info',
            `[MASS-CRAWLER] ✅ ${label} "${keyword}" 완료 ${result.items.length}개 (${(keywordDuration / 1000).toFixed(2)}초)`
          );
          return { index, keyword, result };
        } catch (error: any) {
          const keywordDuration = Date.now() - keywordStartTime;
          const errorMsg = error?.message || String(error);
          const detailParts = [
            error?.name && `type=${error.name}`,
            error?.code && `code=${error.code}`,
            error?.response?.status && `status=${error.response.status}`,
            error?.response?.statusText && `statusText=${error.response.statusText}`
          ]
            .filter(Boolean)
            .join(', ');
          const baseMessage = `[MASS-CRAWLER] ❌ ${label} "${keyword}" 실패 (${(keywordDuration / 1000).toFixed(2)}초): ${errorMsg}${detailParts ? ` (${detailParts})` : ''
            }`;
          logMassCrawler('error', baseMessage);
          if (error?.stack) {
            logMassCrawler('error', `[MASS-CRAWLER] ❌ ${label} "${keyword}" 스택: ${error.stack}`);
          }
          throw error;
        }
      })
    );

    logMassCrawler(
      'info',
      `[MASS-CRAWLER] 🔄 ${keywords.length}개 키워드 병렬 크롤링 시작... (동시 ${Math.max(1, keywordConcurrency)}개)`
    );
    const startTime = Date.now();

    const results = await Promise.allSettled(keywordTasks);
    const endTime = Date.now();
    const duration = endTime - startTime;
    logMassCrawler('info', `[MASS-CRAWLER] ⏱️ 전체 크롤링 시간: ${duration}ms (${(duration / 1000).toFixed(2)}초)`);

    let allItems: MassCrawledItem[] = [];
    const totalStats: any = { totalItems: 0, naverCount: 0, rssCount: 0, cseCount: 0 };

    // 🔧 크롤링 순서 보장: 키워드 순서대로 결과 처리
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.result.items);
        totalStats.totalItems += result.value.result.stats.totalItems;
        totalStats.naverCount += result.value.result.stats.naverCount;
        totalStats.rssCount += result.value.result.stats.rssCount;
        totalStats.cseCount += result.value.result.stats.cseCount;
      } else {
        // 이미 위에서 상세 로그를 출력했으므로 여기서는 생략
      }
    });

    // 중복 제거 및 정렬
    const uniqueItems = this.deduplicateAndSort(allItems);
    logMassCrawler('info', `[MASS-CRAWLER] 🗑️ 중복 제거: ${allItems.length - uniqueItems.length}개 제거`);

    // 변환
    const contents: CrawledContent[] = uniqueItems.map(item => ({
      title: item.title,
      content: item.fullContent?.text || item.description,
      source: item.source,
      platform: this.mapSourceToPlatform(item.source),
      relevance: Math.min(item.popularityScore / 10, 10),
      url: item.link,
      publishDate: item.pubDate,
      extractedData: this.extractDataFromText(item.description)
    }));

    // 콘텐츠 분석
    const analysis = this.analyzeContent(contents, keywords);

    // AI 기반 CTA 생성
    const ctas = await this.generateSmartCTAs(topic, keywords, contents);

    logMassCrawler('info', `[MASS-CRAWLER] ✅ 다중 키워드 크롤링 완료: ${contents.length}개 글, ${ctas.length}개 CTA`);

    return { contents, ctas, stats: totalStats, analysis };
  }

  /**
   * 콘텐츠 분석
   */
  private analyzeContent(contents: CrawledContent[], keywords: string[]): {
    topKeywords: Array<{ keyword: string; frequency: number }>;
    contentQuality: Array<{ url: string; score: number; factors: string[] }>;
    trendingTopics: string[];
  } {
    // 키워드 빈도 분석
    const keywordFrequency = new Map<string, number>();
    const contentQuality: Array<{ url: string; score: number; factors: string[] }> = [];

    contents.forEach(content => {
      // 키워드 추출 및 빈도 계산
      const words = (content.title + ' ' + content.content)
        .toLowerCase()
        .replace(/[^\w\s가-힣]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1);

      words.forEach(word => {
        keywordFrequency.set(word, (keywordFrequency.get(word) || 0) + 1);
      });

      // 콘텐츠 품질 점수
      const factors: string[] = [];
      let score = content.relevance * 10;

      if (content.title.length > 50) {
        score += 10;
        factors.push('긴 제목');
      }
      if (content.content && content.content.length > 500) {
        score += 15;
        factors.push('상세한 내용');
      }
      if (content.extractedData && Object.keys(content.extractedData).length > 0) {
        score += 20;
        factors.push('구조화된 데이터');
      }

      contentQuality.push({
        url: content.url,
        score,
        factors
      });
    });

    // 상위 키워드 추출
    const topKeywords = Array.from(keywordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, frequency]) => ({ keyword, frequency }));

    // 트렌딩 토픽 추출
    const trendingTopics = topKeywords
      .filter(k => k.frequency > 2 && !keywords.includes(k.keyword))
      .map(k => k.keyword)
      .slice(0, 10);

    return {
      topKeywords,
      contentQuality: contentQuality.sort((a, b) => b.score - a.score).slice(0, 20),
      trendingTopics
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

    return unique.sort((a, b) => b.popularityScore - a.popularityScore);
  }

  /**
   * 스마트 CTA 생성
   */
  private async generateSmartCTAs(
    topic: string,
    keywords: string[],
    contents: CrawledContent[]
  ): Promise<CrawledCTA[]> {
    const ctas: CrawledCTA[] = [];

    // 기본 CTA들
    ctas.push(...this.generateDefaultCTAs(topic, keywords));

    // AI 기반 CTA 생성 (Gemini 사용)
    if (this.gemini && contents.length > 0) {
      try {
        // Gemini 2.0 이상 모델 사용 (할당량 초과 시 폴백)
        const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
        let model = null;
        let lastError = null;

        for (const modelName of models) {
          try {
            model = this.gemini.getGenerativeModel({ model: modelName });
            break; // 성공하면 중단
          } catch (error) {
            lastError = error;
            continue; // 다음 모델 시도
          }
        }

        if (!model) {
          throw lastError || new Error('사용 가능한 Gemini 모델이 없습니다.');
        }

        const prompt = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 **CTA 끝판왕 시스템 - 크롤링 기반 동적 CTA 생성** 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【최종 목표: 크롤링된 콘텐츠에서 최적의 공식 링크 추출 + 동적 CTA 생성】

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 **주제 및 키워드 정보** 📋
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**주제**: ${topic}
**키워드**: ${keywords.join(', ')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 **크롤링된 콘텐츠 분석** 🔍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${contents.slice(0, 10).map((c, i) => `
**${i + 1}. ${c.title}**
   - 🔗 URL: ${c.url || 'N/A'}
   - 📄 내용: ${c.content.substring(0, 300)}...
   - 🏷️ 플랫폼: ${c.platform || 'unknown'}
   - ⭐ 관련성: ${c.relevance || 'N/A'}/10
`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 **CTA 끝판왕 생성 전략** 🎯
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🔥 1단계: 공식 사이트 우선 추출 (최우선)**
✅ **크롤링된 콘텐츠에서 공식 사이트 URL 우선 추출**:
   - 정부/공공기관 사이트 (gov.kr, go.kr, or.kr)
   - 대기업 공식 사이트 (회사명.com, 회사명.co.kr)
   - 공식 협회/단체 사이트
   - 공식 교육기관 사이트 (ac.kr, edu.kr)

**🔥 2단계: 뉴스 사이트 허용 (신뢰도 높음)**
✅ **뉴스 링크도 CTA로 사용 가능**:
   - news.naver.com, news.daum.net
   - 언론사 공식 뉴스 (조선일보, 중앙일보, 한겨레 등)
   - 공식 보도자료 링크

**🔥 3단계: 소셜 미디어 공식 계정 (주제에 적합할 때)**
✅ **인스타그램/페이스북 공식 계정**:
   - 주제와 관련된 공식 인스타그램 계정
   - 공식 페이스북 페이지
   - 공식 유튜브 채널

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 **CTA 생성 필수 요소** 📝
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

각 CTA는 반드시 다음 정보를 포함해야 합니다:

1. **url** (필수):
   - 실제 작동하는 URL만 사용
   - 크롤링된 콘텐츠에서 추출한 URL 우선
   - 공식 사이트/뉴스/인스타그램만 허용
   - 예: "https://www.gov.kr", "https://news.naver.com/...", "https://www.instagram.com/..."

2. **text** (필수):
   - 버튼에 표시될 명확한 텍스트
   - 주제와 직접 연관된 문구
   - 예: "${topic} 공식 사이트", "${topic} 최신 뉴스 확인", "${topic} 공식 인스타그램"

3. **hook** (필수):
   - 클릭을 유도하는 후킹 멘트
   - 주제와 완벽하게 연관된 내용
   - 예: "💡 ${topic}에 대한 더 자세한 정보가 필요하신가요?"
   - 예: "📰 ${topic} 관련 최신 뉴스와 정보를 확인하세요."
   - 예: "🌐 ${topic} 공식 사이트에서 정확한 정보를 확인하세요."

4. **context** (필수):
   - CTA의 사용 맥락 명시
   - 예: "공식 사이트", "최신 뉴스", "인스타그램", "공식 자료"

5. **relevance** (필수):
   - 주제와의 관련성 점수 (1-10)
   - 공식 사이트: 9-10점
   - 뉴스 링크: 8-9점
   - 소셜 미디어: 7-8점

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ **절대 금지 사항** ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**🚨 절대 생성하지 마세요**:
- ❌ 블로그 링크 (티스토리, 네이버 블로그, 다음 블로그, 브런치, 벨로그, 미디엄)
- ❌ 카페 링크 (네이버 카페, 다음 카페)
- ❌ 에러 페이지나 404 페이지
- ❌ 광고성 링크
- ❌ 출처 불명 사이트
- ❌ 개인 블로그나 개인 사이트
- ❌ 쇼핑몰 링크 (주제와 직접 관련 없을 때)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 **생성할 CTA 유형 및 우선순위** 🎨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**최대 5개의 CTA를 생성하세요 (우선순위 순서)**:

1. **공식 사이트 CTA** (1-2개, 최우선):
   - 크롤링된 콘텐츠에서 공식 사이트 URL 추출
   - 정부/공공기관, 대기업, 공식 협회 사이트
   - relevance: 9-10점

2. **뉴스 링크 CTA** (1개):
   - 크롤링된 콘텐츠에서 뉴스 링크 추출
   - 공식 언론사 뉴스 기사
   - relevance: 8-9점

3. **인스타그램/페이스북 CTA** (1개, 주제에 적합할 때만):
   - 주제와 관련된 공식 소셜 미디어 계정
   - relevance: 7-8점

4. **기타 관련 공식 사이트** (1개):
   - 주제와 관련된 다른 공식 사이트
   - relevance: 7-9점

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 **응답 형식 (JSON)** 📤
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

반드시 다음 JSON 형식으로 응답하세요:

\`\`\`json
[
  {
    "url": "https://www.gov.kr",
    "text": "${topic} 공식 사이트",
    "hook": "💡 ${topic}에 대한 더 자세한 정보가 필요하신가요?",
    "context": "공식 사이트",
    "relevance": 10
  },
  {
    "url": "https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(topic)}",
    "text": "${topic} 최신 뉴스 확인",
    "hook": "📰 ${topic} 관련 최신 뉴스와 정보를 확인하세요.",
    "context": "최신 뉴스",
    "relevance": 9
  }
]
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ **최종 체크리스트** ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**생성 전 확인**:
□ 크롤링된 콘텐츠에서 공식 사이트 URL을 찾았는가?
□ 모든 URL이 실제 작동하는지 확인했는가?
□ 블로그/카페 링크는 제외했는가?
□ 후킹 멘트가 주제와 연관되어 있는가?
□ 관련성 점수가 적절한가?
□ JSON 형식이 올바른가?

**🏆 최종 목표: 크롤링된 콘텐츠에서 최적의 공식 링크를 추출하여 동적 CTA 생성! 🏆**
`;

        // 할당량 초과 시 폴백 모델로 재시도
        let result;
        try {
          result = await model.generateContent(prompt);
        } catch (error: any) {
          const errorMsg = String(error?.message || error || '');
          const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMsg);

          if (isRateLimit) {
            // 폴백 모델 시도
            const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];
            for (const fallbackModelName of fallbackModels) {
              try {
                const fallbackModel = this.gemini.getGenerativeModel({ model: fallbackModelName });
                result = await fallbackModel.generateContent(prompt);
                console.log(`[CTA] 할당량 초과로 폴백 모델 ${fallbackModelName} 사용`);
                break;
              } catch (fallbackError) {
                continue;
              }
            }
            if (!result) {
              throw error; // 모든 폴백 실패 시 원래 오류 throw
            }
          } else {
            throw error; // 할당량 초과가 아닌 오류는 즉시 throw
          }
        }

        const response = await result.response;
        const text = response.text();

        // AI 응답 파싱하여 CTA 생성
        const aiCTAs = this.parseAIResponse(text);
        ctas.push(...aiCTAs);

      } catch (error) {
        console.error('[CTA] AI CTA 생성 실패:', error);
      }
    }

    return ctas.slice(0, 10); // 최대 10개로 제한
  }

  /**
   * AI 응답 파싱 (JSON 형식 지원 + URL 추출)
   */
  private parseAIResponse(text: string): CrawledCTA[] {
    const ctas: CrawledCTA[] = [];

    try {
      // JSON 형식 파싱 시도
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(jsonStr);

          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item.url && item.text) {
                // 블로그/카페 링크 필터링
                const url = item.url.toLowerCase();
                const isBlocked = /(tistory|blog|naver\.com\/blog|cafe|daum\.net\/cafe|brunch|velog|medium)/.test(url);

                if (!isBlocked && url.startsWith('http')) {
                  ctas.push({
                    url: item.url,
                    text: item.text,
                    hook: item.hook || `💡 ${item.text} 👇`,
                    context: item.context || 'ai-generated',
                    type: item.type || 'button',
                    source: 'ai',
                    relevance: item.relevance || 7
                  });
                }
              }
            });

            if (ctas.length > 0) {
              return ctas;
            }
          }
        } catch (jsonError) {
          console.warn('[CTA] JSON 파싱 실패, 텍스트 파싱으로 폴백:', jsonError);
        }
      }

      // 텍스트 형식 파싱 (폴백) - URL 추출
      const lines = text.split('\n').filter(line => line.trim());

      lines.forEach(line => {
        // URL 추출 시도
        const urlMatch = line.match(/https?:\/\/[^\s\)]+/);
        if (urlMatch) {
          const url = urlMatch[0];
          const isBlocked = /(tistory|blog|naver\.com\/blog|cafe|daum\.net\/cafe|brunch|velog|medium)/.test(url.toLowerCase());

          if (!isBlocked) {
            const textMatch = line.match(/text[:\s]+["']?([^"'\n]+)["']?/i) || line.match(/["']([^"']+)["']/);
            const hookMatch = line.match(/hook[:\s]+["']?([^"'\n]+)["']?/i);

            ctas.push({
              url: url,
              text: (textMatch && textMatch[1]) ? textMatch[1] : '더 알아보기',
              hook: (hookMatch && hookMatch[1]) ? hookMatch[1] : `💡 더 자세한 정보를 확인하세요. 👇`,
              context: 'ai-generated',
              type: 'button',
              source: 'ai',
              relevance: 7
            });
          }
        } else if (line.includes('CTA') || line.includes('버튼') || line.includes('링크')) {
          // URL이 없는 경우 기본 CTA 생성 (폴백)
          const match = line.match(/(\d+)\.\s*(.+)/);
          if (match && match[2]) {
            // 크롤링된 콘텐츠에서 URL 찾기 시도
            const contentUrl = this.findUrlInContents(match[2]);
            if (contentUrl && contentUrl.startsWith('http')) {
              ctas.push({
                url: contentUrl,
                text: match[2],
                hook: `💡 ${match[2]} 👇`,
                context: 'ai-generated',
                type: 'button',
                source: 'ai',
                relevance: 5
              });
            }
          }
        }
      });
    } catch (error) {
      console.error('[CTA] AI 응답 파싱 실패:', error);
    }

    return ctas;
  }

  /**
   * 크롤링된 콘텐츠에서 URL 찾기
   */
  private findUrlInContents(text: string): string | null {
    // 이 메서드는 나중에 구현 (크롤링된 contents에서 매칭되는 URL 찾기)
    return null;
  }

  /**
   * 소스 타입을 플랫폼 타입으로 매핑
   */
  private mapSourceToPlatform(source: 'naver' | 'rss' | 'cse' | 'manual'): CrawledContent['platform'] {
    switch (source) {
      case 'naver': return 'naver';
      case 'rss': return 'rss';
      case 'cse': return 'cse';
      case 'manual': return 'naver'; // 수동 링크는 네이버로 분류
      default: return 'rss';
    }
  }

  /**
   * 기본 CTA 생성
   */
  private generateDefaultCTAs(topic: string, keywords: string[]): CrawledCTA[] {
    return [
      {
        text: `${topic} 더 알아보기`,
        url: '#',
        type: 'button',
        context: 'default',
        source: 'default',
        relevance: 3
      },
      {
        text: `${keywords[0] || '관련'} 정보 확인`,
        url: '#',
        type: 'link',
        context: 'default',
        source: 'default',
        relevance: 2
      }
    ];
  }

  /**
   * 텍스트에서 날짜, 숫자, 금액, 퍼센트 등의 정보 추출
   */
  private extractDataFromText(text: string): {
    dates: string[];
    numbers: string[];
    prices: string[];
    percentages: string[];
  } {
    const extractedData = {
      dates: [] as string[],
      numbers: [] as string[],
      prices: [] as string[],
      percentages: [] as string[]
    };

    // 1. 날짜 추출 (다양한 형식)
    const datePatterns = [
      /\d{4}년\s*\d{1,2}월\s*\d{1,2}일/g,          // 2024년 10월 20일
      /\d{4}-\d{2}-\d{2}/g,                          // 2024-10-20
      /\d{4}\.\d{2}\.\d{2}/g,                        // 2024.10.20
      /\d{1,2}\/\d{1,2}\/\d{4}/g,                    // 10/20/2024
      /\d{1,2}월\s*\d{1,2}일/g,                      // 10월 20일
      /\d{4}년\s*\d{1,2}월/g                         // 2024년 10월
    ];

    datePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        extractedData.dates.push(...matches);
      }
    });

    // 2. 금액/가격 추출
    const pricePatterns = [
      /\d{1,3}(?:,\d{3})*원/g,                       // 10,000원
      /\d+만\s*원/g,                                  // 100만원
      /\d+억\s*원/g,                                  // 10억원
      /\d+천\s*원/g,                                  // 5천원
      /\$\d{1,3}(?:,\d{3})*/g,                       // $1,000
      /\d+달러/g,                                     // 100달러
      /\d+유로/g,                                     // 100유로
      /\d{1,3}(?:,\d{3})*\s*원/g                     // 10,000 원
    ];

    pricePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        extractedData.prices.push(...matches);
      }
    });

    // 3. 퍼센트 추출
    const percentagePatterns = [
      /\d+(?:\.\d+)?%/g,                             // 10.5%
      /\d+퍼센트/g,                                   // 10퍼센트
      /\d+\.?\d*\s*%/g                               // 10 %
    ];

    percentagePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        extractedData.percentages.push(...matches);
      }
    });

    // 4. 주요 숫자 추출 (단위 포함)
    const numberPatterns = [
      /\d{1,3}(?:,\d{3})+/g,                         // 1,000,000
      /\d+만/g,                                       // 100만
      /\d+억/g,                                       // 10억
      /\d+천/g,                                       // 5천
      /\d+개/g,                                       // 100개
      /\d+명/g,                                       // 1000명
      /\d+회/g,                                       // 5회
      /\d+년/g,                                       // 2024년
      /\d+시간/g,                                     // 24시간
      /\d+일/g                                        // 30일
    ];

    numberPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        extractedData.numbers.push(...matches);
      }
    });

    // 중복 제거
    extractedData.dates = [...new Set(extractedData.dates)];
    extractedData.numbers = [...new Set(extractedData.numbers)];
    extractedData.prices = [...new Set(extractedData.prices)];
    extractedData.percentages = [...new Set(extractedData.percentages)];

    return extractedData;
  }

  /**
   * 1단계: 네이버 API로 블로그 글 크롤링
   */
  async crawlFromNaverAPI(config: ContentCrawlerConfig): Promise<CrawledContent[]> {
    const { topic, keywords, maxResults = 5, naverClientId, naverClientSecret } = config;

    if (!naverClientId || !naverClientSecret) {
      console.log('[NAVER] 네이버 API 키가 없어서 건너뛰기');
      console.log(`[NAVER DEBUG] naverClientId: ${naverClientId ? '있음' : '없음'}, naverClientSecret: ${naverClientSecret ? '있음' : '없음'}`);
      return [];
    }

    try {
      console.log(`[NAVER] "${topic}" 네이버 블로그 크롤링 시작...`);

      const searchQuery = `${topic} ${keywords.join(' ')}`;
      const encodedQuery = encodeURIComponent(searchQuery);
      const apiUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodedQuery}&display=${maxResults}&sort=sim`;

      // 타임아웃 설정 (15초로 단축 - 성능 최적화)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      console.log(`[NAVER-DEBUG] 🔄 네이버 API 요청 시작`);
      console.log(`[NAVER-DEBUG]    URL: ${apiUrl.substring(0, 100)}...`);
      console.log(`[NAVER-DEBUG]    키워드: "${topic}" ${keywords.join(', ')}`);
      console.log(`[NAVER-DEBUG]    타임아웃: 15초`);

      const requestStartTime = Date.now();

      try {
        const response = await fetch(apiUrl, {
          signal: controller.signal,
          headers: {
            'X-Naver-Client-Id': naverClientId,
            'X-Naver-Client-Secret': naverClientSecret
          }
        });

        clearTimeout(timeoutId);
        const requestTime = Date.now() - requestStartTime;

        console.log(`[NAVER-DEBUG] ✅ 응답 수신 (${requestTime}ms)`);
        console.log(`[NAVER-DEBUG]    상태 코드: ${response.status}`);
        console.log(`[NAVER-DEBUG]    상태 텍스트: ${response.statusText}`);

        if (!response.ok) {
          console.error(`[NAVER-DEBUG] ❌ API 호출 실패: ${response.status} ${response.statusText}`);

          // 사용자 친화적인 오류 메시지
          if (response.status === 401 || response.status === 403) {
            throw new Error(`❌ 네이버 API 키 인증 실패!\n\n💡 해결 방법:\n1. 네이버 개발자 센터(https://developers.naver.com)에서 API 키를 확인하세요\n2. Client ID와 Client Secret이 정확한지 확인하세요\n3. API 사용 권한이 활성화되어 있는지 확인하세요\n\n⚠️ API 키가 유효하지 않거나 크레딧이 부족할 수 있습니다.\n크레딧을 충전한 후 다시 시도해주세요.`);
          } else if (response.status === 429) {
            throw new Error(`❌ 네이버 API 호출 한도 초과!\n\n💡 해결 방법:\n1. 잠시 후 다시 시도하세요 (1분 대기 권장)\n2. 네이버 개발자 센터에서 사용량을 확인하세요\n3. 필요시 크레딧을 충전하세요\n\n⚠️ 일일 호출 한도를 초과했습니다.`);
          } else if (response.status === 500) {
            throw new Error(`❌ 네이버 API 서버 오류!\n\n💡 해결 방법:\n1. 잠시 후 다시 시도하세요\n2. 네이버 API 서버가 일시적으로 불안정할 수 있습니다\n\n⚠️ 네이버 측 문제이므로 기다려주세요.`);
          }

          return [];
        }

        const data = await response.json();
        const contents: CrawledContent[] = [];

        for (const item of data.items || []) {
          try {
            // 네이버 블로그 내용 크롤링 (우회 방법들 시도)
            const blogContent = await this.crawlNaverBlogContent(item.link, topic, keywords);
            if (blogContent) {
              contents.push(blogContent);
            }
          } catch (error) {
            console.log(`[NAVER] 블로그 크롤링 실패: ${item.link}`);
          }
        }

        console.log(`[NAVER] 크롤링 완료: ${contents.length}개 글 수집`);
        return contents;

      } catch (error: any) {
        clearTimeout(timeoutId);
        const requestTime = Date.now() - requestStartTime;

        console.error(`[NAVER-DEBUG] ❌ 에러 발생 (${requestTime}ms)`);
        console.error(`[NAVER-DEBUG]    에러 이름: ${error?.name || 'Unknown'}`);
        console.error(`[NAVER-DEBUG]    에러 메시지: ${error?.message || 'N/A'}`);
        console.error(`[NAVER-DEBUG]    타임아웃 여부: ${error.name === 'AbortError' ? 'YES' : 'NO'}`);
        console.error(`[NAVER-DEBUG]    에러 스택:`, error?.stack || 'N/A');

        if (error.name === 'AbortError') {
          console.error('[NAVER] 네이버 API 타임아웃 (30초 초과)');
        } else {
          console.error('[NAVER] 네이버 API 크롤링 실패:', error.message || error);
        }
        return [];
      }
    } catch (error) {
      console.error('[NAVER] 네이버 API 크롤링 실패:', error);
      return [];
    }
  }

  /**
   * 네이버 블로그 내용 크롤링 (우회 방법들)
   */
  private async crawlNaverBlogContent(url: string, topic: string, keywords: string[]): Promise<CrawledContent | null> {
    try {
      // 타임아웃 설정 (10초로 단축 - 성능 최적화)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        // 방법 1: 일반적인 fetch 시도
        let response = await fetch(url, {
          signal: controller.signal,
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
          // 방법 2: 프록시 서버를 통한 우회 시도
          response = await this.tryProxyFetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
        }

        clearTimeout(timeoutId);

        const html = await response.text();
        return this.extractContentFromHTML(html, url, 'naver', topic, keywords);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log(`[NAVER] 타임아웃: ${url}`);
        } else {
          console.log(`[NAVER] 우회 크롤링도 실패: ${url}`);
        }
        return null;
      }
    } catch (error) {
      console.log(`[NAVER] 우회 크롤링도 실패: ${url}`);
      return null;
    }
  }

  /**
   * 프록시를 통한 우회 시도
   */
  private async tryProxyFetch(url: string): Promise<Response> {
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
   * 2단계: RSS 피드에서 내용 크롤링
   */
  async crawlFromRSS(config: ContentCrawlerConfig): Promise<CrawledContent[]> {
    const { topic, keywords } = config;

    try {
      console.log(`[RSS] "${topic}" RSS 피드 크롤링 시작...`);

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

      const contents: CrawledContent[] = [];

      for (const feedUrl of rssFeeds) {
        try {
          // 타임아웃 설정 (15초로 단축 - 성능 최적화)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await fetch(feedUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            console.log(`[RSS] 피드 응답 실패 (${response.status}): ${feedUrl}`);
            continue;
          }

          const xmlText = await response.text();

          // 빈 응답 체크
          if (!xmlText || xmlText.trim().length === 0) {
            console.log(`[RSS] 빈 응답: ${feedUrl}`);
            continue;
          }

          const rssContents = this.parseRSSContent(xmlText, topic, keywords);

          if (rssContents.length > 0) {
            contents.push(...rssContents);
            console.log(`[RSS] ✅ ${feedUrl}에서 ${rssContents.length}개 수집`);
          }

          // 너무 많은 콘텐츠 수집 시 중단 (메모리 절약)
          if (contents.length >= 20) {
            console.log(`[RSS] 충분한 콘텐츠 수집 (${contents.length}개), 크롤링 중단`);
            break;
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.log(`[RSS] 타임아웃: ${feedUrl}`);
          } else {
            console.log(`[RSS] 피드 크롤링 실패 (${error.message}): ${feedUrl}`);
          }
        }
      }

      console.log(`[RSS] 크롤링 완료: ${contents.length}개 글 수집`);
      return contents;

    } catch (error) {
      console.error('[RSS] RSS 크롤링 실패:', error);
      return [];
    }
  }

  /**
   * RSS XML 파싱 (개선 버전)
   */
  private parseRSSContent(xmlText: string, topic: string, keywords: string[]): CrawledContent[] {
    const contents: CrawledContent[] = [];

    try {
      // <item> 태그 외에 <entry> 태그도 지원 (Atom 피드)
      const itemMatches = xmlText.match(/<item>[\s\S]*?<\/item>/gi) ||
        xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

      for (const item of itemMatches) {
        // 제목 추출 (다양한 형식 지원)
        const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
        const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();

        // 링크 추출
        const linkMatch = item.match(/<link[^>]*>(.*?)<\/link>|<link[^>]*href=["'](.*?)["'][^>]*\/>/i);
        const link = (linkMatch?.[1] || linkMatch?.[2] || '').trim();

        // 설명/내용 추출 (description, content, summary 등)
        const descriptionMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i) ||
          item.match(/<content><!\[CDATA\[(.*?)\]\]><\/content>|<content[^>]*>(.*?)<\/content>/i) ||
          item.match(/<summary><!\[CDATA\[(.*?)\]\]><\/summary>|<summary>(.*?)<\/summary>/i);
        const description = (descriptionMatch?.[1] || descriptionMatch?.[2] || '').trim();

        // 발행 날짜 추출
        const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>|<published>(.*?)<\/published>|<dc:date>(.*?)<\/dc:date>/i);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _publishDate = (pubDateMatch?.[1] || pubDateMatch?.[2] || pubDateMatch?.[3] || '').trim();

        // 유효성 검사
        if (!title || !link || title.length < 5) {
          continue;
        }

        // HTML 태그 및 특수문자 정리
        const cleanTitle = this.cleanHTMLContent(title);
        const cleanDescription = this.cleanHTMLContent(description);

        // 관련성 확인
        if (this.isRelevantContent(cleanTitle + ' ' + cleanDescription, topic, keywords)) {
          const fullText = `${cleanTitle} ${cleanDescription}`;
          const extracted = this.extractDataFromText(fullText);

          contents.push({
            title: cleanTitle,
            content: cleanDescription,
            source: link,
            platform: 'rss',
            relevance: this.calculateRelevance(cleanTitle + ' ' + cleanDescription, topic, keywords),
            url: link,
            extractedData: {
              dates: extracted.dates,
              numbers: extracted.numbers,
              prices: extracted.prices,
              percentages: extracted.percentages
            }
          });
        }
      }

      // 관련성 순으로 정렬
      contents.sort((a, b) => b.relevance - a.relevance);

    } catch (error) {
      console.error('[RSS] XML 파싱 오류:', error);
    }

    return contents;
  }

  /**
   * 3단계: Google CSE로 워드프레스/티스토리/블로그스팟 크롤링
   */
  async crawlFromCSE(config: ContentCrawlerConfig): Promise<CrawledContent[]> {
    const { topic, keywords, maxResults = 10, googleCseKey, googleCseCx } = config;

    if (!googleCseKey || !googleCseCx) {
      console.log('[CSE] Google CSE 키가 없어서 건너뛰기');
      return [];
    }

    try {
      console.log(`[CSE] "${topic}" CSE 크롤링 시작...`);

      // 워드프레스, 티스토리, 블로그스팟 사이트 검색
      const searchQueries = [
        `${topic} site:wordpress.com OR site:tistory.com OR site:blogspot.com`,
        `${topic} ${keywords.join(' ')} site:*.wordpress.com OR site:*.tistory.com OR site:*.blogspot.com`
      ];

      const contents: CrawledContent[] = [];

      // Rate Limiter import
      const { safeCSERequest } = await import('../utils/google-cse-rate-limiter');

      for (const query of searchQueries) {
        try {
          // Rate Limiter를 통한 안전한 요청 (낮은 우선순위로 비동기 처리)
          const data = await safeCSERequest<{ items?: any[] }>(
            query,
            async () => {
              const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleCseKey}&cx=${googleCseCx}&q=${encodeURIComponent(query)}&num=${maxResults}`;

              // 타임아웃 설정 (15초로 단축 - 성능 최적화)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);

              try {
                const response = await fetch(searchUrl, {
                  signal: controller.signal
                });
                clearTimeout(timeoutId);

                if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
                }

                return await response.json() as { items?: any[] };
              } catch (error: any) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                  throw new Error('타임아웃');
                }
                throw error;
              }
            },
            { useCache: true, priority: 'low' }
          );

          if (!data?.items) continue;

          for (const item of data.items) {
            try {
              const blogContent = await this.crawlBlogContent(item.link, topic, keywords);
              if (blogContent) {
                contents.push(blogContent);
              }
            } catch (error) {
              console.log(`[CSE] 블로그 크롤링 실패: ${item.link}`);
            }
          }
        } catch (error: any) {
          // Rate Limiter가 429 오류를 처리하므로 여기서는 로그만 남김
          if (error.message?.includes('Rate Limit') || error.message?.includes('할당량')) {
            console.warn(`[CSE] ${error.message}: ${query}`);
          } else {
            console.log(`[CSE] 검색 실패: ${error.message || error}`);
          }
          continue;
        }
      }

      console.log(`[CSE] 크롤링 완료: ${contents.length}개 글 수집`);
      return contents;

    } catch (error) {
      console.error('[CSE] CSE 크롤링 실패:', error);
      return [];
    }
  }

  /**
   * 개별 블로그 내용 크롤링
   */
  private async crawlBlogContent(url: string, topic: string, keywords: string[]): Promise<CrawledContent | null> {
    try {
      // 타임아웃 설정 (10초로 단축 - 성능 최적화)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const html = await response.text();
      const platform = this.detectPlatform(url);

      return this.extractContentFromHTML(html, url, platform, topic, keywords);

    } catch (error) {
      return null;
    }
  }

  /**
   * HTML에서 내용 추출
   */
  private extractContentFromHTML(
    html: string,
    url: string,
    platform: string,
    topic: string,
    keywords: string[]
  ): CrawledContent | null {
    try {
      // 제목 추출
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : '';

      // 본문 내용 추출 (플랫폼별 최적화)
      let content = '';

      if (platform === 'naver') {
        // 네이버 블로그 특화 추출
        const contentMatch = html.match(/<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
          html.match(/<div[^>]*id="postViewArea"[^>]*>([\s\S]*?)<\/div>/i);
        if (contentMatch && contentMatch[1]) {
          content = contentMatch[1];
        }
      } else {
        // 일반적인 블로그 추출
        const contentSelectors = [
          /<article[^>]*>([\s\S]*?)<\/article>/i,
          /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
          /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
        ];

        for (const selector of contentSelectors) {
          const match = html.match(selector);
          if (match && match[1]) {
            content = match[1];
            break;
          }
        }
      }

      // HTML 태그 제거 및 텍스트 정리
      content = this.cleanHTMLContent(content);

      if (!title || !content || content.length < 100) {
        return null;
      }

      // 날짜, 숫자, 금액, 퍼센트 추출
      const fullText = `${title} ${content}`;
      const extracted = this.extractDataFromText(fullText);

      return {
        title,
        content,
        source: url,
        platform: platform as any,
        relevance: this.calculateRelevance(title + ' ' + content, topic, keywords),
        url,
        extractedData: {
          dates: extracted.dates,
          numbers: extracted.numbers,
          prices: extracted.prices,
          percentages: extracted.percentages
        }
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * HTML 내용 정리
   */
  private cleanHTMLContent(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // 스크립트 제거
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // 스타일 제거
      .replace(/<[^>]+>/g, ' ') // HTML 태그 제거
      .replace(/\s+/g, ' ') // 공백 정리
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * 플랫폼 감지
   */
  private detectPlatform(url: string): string {
    if (url.includes('naver.com')) return 'naver';
    if (url.includes('tistory.com')) return 'tistory';
    if (url.includes('brunch.co.kr')) return 'brunch';
    if (url.includes('velog.io')) return 'velog';
    if (url.includes('medium.com')) return 'medium';
    if (url.includes('news.google.com')) return 'google-news';
    if (url.includes('media.daum.net')) return 'daum-news';
    if (url.includes('blogspot.com')) return 'blogspot';
    if (url.includes('wordpress.com')) return 'wordpress';
    return 'unknown';
  }

  /**
   * 내용 관련성 확인
   */
  private isRelevantContent(text: string, topic: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    const lowerTopic = topic.toLowerCase();

    // 주제나 키워드와 관련이 있는지 확인
    const hasTopicKeyword = keywords.some(keyword =>
      lowerText.includes(keyword.toLowerCase())
    );

    const hasTopicWord = lowerText.includes(lowerTopic) ||
      lowerTopic.includes(lowerText);

    return hasTopicKeyword || hasTopicWord;
  }

  /**
   * 관련도 계산
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
   * CTA 크롤링
   */
  async crawlCTAFromContent(contents: CrawledContent[]): Promise<CrawledCTA[]> {
    const ctas: CrawledCTA[] = [];

    for (const content of contents) {
      try {
        const response = await fetch(content.url);
        if (!response.ok) continue;

        const html = await response.text();
        const extractedCTAs = this.extractCTAsFromHTML(html, content.url);
        ctas.push(...extractedCTAs);
      } catch (error) {
        console.log(`[CTA] CTA 크롤링 실패: ${content.url}`);
      }
    }

    return ctas;
  }

  /**
   * HTML에서 CTA 추출 (강화 버전: 외부 링크 + 후킹 멘트)
   */
  private extractCTAsFromHTML(html: string, sourceUrl: string): CrawledCTA[] {
    const ctas: CrawledCTA[] = [];

    // HTML을 더 쉽게 파싱하기 위해 전처리
    const cleanHtml = html.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    // 링크 CTA 추출 (외부 링크 우선) - 더 강화된 패턴
    const linkMatches = cleanHtml.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi);

    for (const match of linkMatches) {
      const url = match[1];
      const text = match[2]?.trim();

      if (!url || !text) continue;

      // CTA 같은 텍스트만 필터링
      if (!this.isCTAText(text)) continue;

      // 외부 링크 여부 확인
      const isExternal = this.isExternalUrl(url, sourceUrl);

      // 후킹 멘트 추출 (CTA 앞뒤 100자)
      const matchIndex = cleanHtml.indexOf(match[0]);
      const beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
      const afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);

      const hook = this.extractHookingMessage(beforeText, afterText, text);

      const cta: CrawledCTA = {
        text,
        url: this.normalizeUrl(url, sourceUrl),
        type: 'link',
        context: 'link',
        source: sourceUrl,
        relevance: isExternal ? 8 : 5, // 외부 링크는 점수 높게
        isExternal
      };
      if (hook) {
        cta.hook = hook;
      }
      ctas.push(cta);
    }

    // 버튼 CTA 추출
    const buttonMatches = cleanHtml.matchAll(/<button[^>]*>([^<]+)<\/button>/gi);
    const divMatches = cleanHtml.matchAll(/<div[^>]*class="[^"]*btn[^"]*"[^>]*>([^<]+)<\/div>/gi);

    for (const match of buttonMatches) {
      const text = match[1]?.trim();

      if (!text) continue;
      if (!this.isCTAText(text)) continue;

      // 버튼 주변 텍스트에서 링크 찾기
      const matchIndex = cleanHtml.indexOf(match[0]);
      const surroundingHtml = cleanHtml.substring(Math.max(0, matchIndex - 200), matchIndex + 200);
      const urlMatch = surroundingHtml.match(/href="([^"]*)"/i);

      const url = urlMatch && urlMatch[1] ? this.normalizeUrl(urlMatch[1], sourceUrl) : sourceUrl;
      const isExternal = urlMatch && urlMatch[1] ? this.isExternalUrl(urlMatch[1], sourceUrl) : false;

      // 후킹 멘트 추출
      const beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
      const afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);
      const hook = this.extractHookingMessage(beforeText, afterText, text);

      const cta: CrawledCTA = {
        text,
        url,
        type: 'button',
        context: 'button',
        source: sourceUrl,
        relevance: isExternal ? 8 : 6,
        isExternal
      };
      if (hook) {
        cta.hook = hook;
      }
      ctas.push(cta);
    }

    // div CTA 추출
    for (const match of divMatches) {
      const text = match[1]?.trim();

      if (!text) continue;
      if (!this.isCTAText(text)) continue;

      // div 주변 텍스트에서 링크 찾기
      const matchIndex = cleanHtml.indexOf(match[0]);
      const surroundingHtml = cleanHtml.substring(Math.max(0, matchIndex - 200), matchIndex + 200);
      const urlMatch = surroundingHtml.match(/href="([^"]*)"/i);

      const url = urlMatch && urlMatch[1] ? this.normalizeUrl(urlMatch[1], sourceUrl) : sourceUrl;
      const isExternal = urlMatch && urlMatch[1] ? this.isExternalUrl(urlMatch[1], sourceUrl) : false;

      // 후킹 멘트 추출
      const beforeText = cleanHtml.substring(Math.max(0, matchIndex - 100), matchIndex);
      const afterText = cleanHtml.substring(matchIndex + match[0].length, matchIndex + match[0].length + 100);
      const hook = this.extractHookingMessage(beforeText, afterText, text);

      const cta: CrawledCTA = {
        text,
        url,
        type: 'button',
        context: 'div',
        source: sourceUrl,
        relevance: isExternal ? 7 : 5,
        isExternal
      };
      if (hook) {
        cta.hook = hook;
      }
      ctas.push(cta);
    }

    // 중복 제거 및 관련성 높은 순으로 정렬
    const uniqueCTAs = this.deduplicateCTAs(ctas);
    return uniqueCTAs.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * 외부 URL 여부 확인
   */
  private isExternalUrl(url: string, sourceUrl: string): boolean {
    try {
      // 상대 경로는 내부 링크
      if (!url.startsWith('http')) return false;

      const urlDomain = new URL(url).hostname;
      const sourceDomain = new URL(sourceUrl).hostname;

      return urlDomain !== sourceDomain;
    } catch {
      return false;
    }
  }

  /**
   * URL 정규화
   */
  private normalizeUrl(url: string, baseUrl: string): string {
    try {
      if (url.startsWith('http')) return url;
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }

  /**
   * 후킹 멘트 추출
   */
  private extractHookingMessage(beforeText: string, afterText: string, _ctaText: string): string | undefined {
    // HTML 태그 제거
    const cleanBefore = beforeText.replace(/<[^>]*>/g, ' ').trim();
    const cleanAfter = afterText.replace(/<[^>]*>/g, ' ').trim();

    // 후킹 키워드 찾기
    const hookKeywords = [
      '지금', '바로', '완전', '무료', '할인', '혜택', '특별', '최대', '최고',
      '놓치지', '서둘러', '한정', '이벤트', '프로모션', '독점',
      '확인', '알아보', '자세히', '더보기'
    ];

    // 앞뒤 텍스트에서 후킹 메시지 찾기
    const sentences = (cleanBefore + ' ' + cleanAfter).split(/[.!?。！？]/).filter(s => s.length > 5);

    for (const sentence of sentences) {
      const hasHookKeyword = hookKeywords.some(keyword => sentence.includes(keyword));
      if (hasHookKeyword && sentence.length < 100) {
        return sentence.trim();
      }
    }

    return undefined;
  }

  /**
   * CTA 중복 제거
   */
  private deduplicateCTAs(ctas: CrawledCTA[]): CrawledCTA[] {
    const seen = new Map<string, CrawledCTA>();

    for (const cta of ctas) {
      const key = `${cta.text.toLowerCase()}-${cta.url}`;
      const existing = seen.get(key);

      // 동일한 CTA가 있으면 더 좋은 것만 보존
      if (!existing || cta.relevance > existing.relevance) {
        seen.set(key, cta);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * CTA 텍스트인지 확인
   */
  private isCTAText(text: string): boolean {
    const ctaKeywords = [
      '지금', '바로', '확인', '보기', '이동', '가기', '신청', '구매', '다운로드',
      '무료', '할인', '혜택', '이벤트', '참여', '등록', '가입', '시작',
      'click', 'buy', 'download', 'free', 'now', 'here'
    ];

    const lowerText = text.toLowerCase();
    return ctaKeywords.some(keyword => lowerText.includes(keyword)) && text.length < 50;
  }

  /**
   * AI로 크롤링한 내용을 믹싱해서 새로운 글 생성
   */
  async generateMixedContent(
    topic: string,
    keywords: string[],
    contents: CrawledContent[],
    ctas: CrawledCTA[],
    section: any,
    contentMode: string,
    provider: 'openai' | 'gemini' = 'gemini'
  ): Promise<string> {
    try {
      console.log(`[AI MIXER] ${section.title} 섹션 내용 믹싱 시작...`);

      const prompt = this.buildContentMixingPrompt(topic, keywords, contents, ctas, section, contentMode);

      let response: string | undefined;
      if (provider === 'openai' && this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-5.4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        });
        response = completion.choices[0]?.message?.content || '';
      } else if (provider === 'gemini' && this.gemini) {
        // Gemini 2.0 이상 모델 사용 (할당량 초과 시 폴백)
        const models = ['gemini-2.5-flash', 'gemini-2.5-pro'];
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

      console.log(`[AI MIXER] ${section.title} 섹션 내용 믹싱 완료`);
      return response;

    } catch (error) {
      console.error('[AI MIXER] 내용 믹싱 실패:', error);
      throw error;
    }
  }

  /**
   * 내용 믹싱 프롬프트 작성
   */
  private buildContentMixingPrompt(
    topic: string,
    keywords: string[],
    contents: CrawledContent[],
    ctas: CrawledCTA[],
    section: any,
    contentMode: string
  ): string {
    const topContents = contents.slice(0, 5);
    const topCTAs = ctas.slice(0, 3);

    return `당신은 전문 블로그 작가입니다.

📝 **작성 주제**: "${topic}"
🔑 **핵심 키워드**: ${keywords.join(', ')}
📋 **섹션**: ${section.title} (${section.description})
🎯 **콘텐츠 모드**: ${contentMode}

📊 **참고 자료 (크롤링한 실제 블로그 글들)**:
${topContents.map((content, i) => `
${i + 1}. **제목**: ${content.title}
   **내용**: ${content.content.substring(0, 500)}...
   **출처**: ${content.platform}
`).join('\n')}

🔗 **참고 CTA (크롤링한 실제 CTA들)**:
${topCTAs.map((cta, i) => `
${i + 1}. **텍스트**: ${cta.text}
   **URL**: ${cta.url}
   **타입**: ${cta.type}
`).join('\n')}

🎯 **목표**: 위 참고 자료들을 바탕으로 완전히 새로운 관점의 고품질 콘텐츠를 작성하세요.

✅ **요구사항**:
1. 참고 자료의 정보를 활용하되 완전히 새로운 표현으로 작성
2. ${section.minChars}자 이상의 충분한 분량
3. 독창적이고 차별화된 내용
4. 자연스러운 키워드 포함
5. "왜"보다는 "어떻게"에 60% 비중을 둔 실용적 정보 제공
6. 독자가 바로 적용할 수 있는 구체적인 방법과 팁 중심
7. 참고 CTA의 스타일을 참고해서 적절한 행동 유도 포함

❌ **절대 금지사항**:
- 참고 자료를 그대로 복사하지 말 것
- 중간에 결론이나 마무리 문구 사용 금지
- 코드나 함수명이 섞여서 나오는 것
- 과도한 키워드 삽입

✅ **출력 형식**:
WordPress HTML 블록 형식으로 작성하세요:
\`\`\`html
<!-- wp:html -->
<div class="max-mode-section ${section.id}" id="section-${section.id}">
  <h2>${section.title}</h2>
  <div class="content">
    <!-- 여기에 ${section.minChars}자 이상의 고품질 콘텐츠 작성 -->
  </div>
</div>
<!-- /wp:html -->
\`\`\`

💡 **작성 가이드**:
1. 참고 자료의 핵심 정보를 파악하고 새로운 각도로 재해석
2. 독자의 관심을 끄는 도입으로 시작
3. 구체적이고 실용적인 정보 제공
4. 실제 사례나 경험담 포함
5. 독자가 바로 적용할 수 있는 팁 제공
6. 자연스러운 CTA 포함

이제 "${section.title}" 섹션의 내용을 참고 자료를 바탕으로 완전히 새로운 관점에서 작성해주세요.`;
  }
}

type MassCrawlerLogLevel = 'info' | 'warn' | 'error';
const massCrawlerLogState: { signature: string } = { signature: '' };

function logMassCrawler(level: MassCrawlerLogLevel, message: string, ...args: any[]): void {
  const signature = `${level}|${message}`;
  if (massCrawlerLogState.signature === signature) {
    return;
  }
  massCrawlerLogState.signature = signature;
  switch (level) {
    case 'warn':
      console.warn(message, ...args);
      break;
    case 'error':
      console.error(message, ...args);
      break;
    default:
      console.log(message, ...args);
      break;
  }
}

/**
 * 통합 콘텐츠 크롤링 및 믹싱 함수
 * 폴백 순서: 네이버 API → RSS → CSE → 기본 데이터
 */
export async function crawlAndMixContent(
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
    enableMassCrawling?: boolean; // 새로운 옵션
    manualCrawlUrls?: string[]; // 수동 크롤링 링크
  } = {}
): Promise<{ contents: CrawledContent[], ctas: CrawledCTA[] }> {
  const {
    openaiKey,
    geminiKey,
    naverClientId,
    naverClientSecret,
    googleCseKey,
    googleCseCx,
    enableMassCrawling = true, // 기본값 true
    manualCrawlUrls = [] // 수동 크롤링 링크
  } = options;

  const crawler = new ContentCrawler(openaiKey, geminiKey);
  let allContents: CrawledContent[] = [];
  let ctas: CrawledCTA[] = [];

  console.log(`[CRAWLER] 📋 크롤링 시작: ${enableMassCrawling ? '대량 크롤링' : '기존 크롤링'} 모드`);

  // 대량 크롤링 시도 (새로운 기능)
  if (enableMassCrawling && naverClientId && naverClientSecret) {
    try {
      console.log(`[CRAWLER] 🚀 대량 크롤링 시스템 초기화...`);
      console.log(`[CRAWLER] 🔑 API 키 확인: Naver=${!!naverClientId && !!naverClientSecret}, Google CSE=${!!googleCseKey && !!googleCseCx}`);
      crawler.initializeMassCrawler(
        naverClientId,
        naverClientSecret,
        googleCseKey || undefined,
        googleCseCx || undefined
      );

      // 다중 키워드 대량 크롤링 사용
      const crawlOptions: any = {
        maxResults: 2000,
        enableFullContent: true,
        maxConcurrent: 20,
        manualUrls: manualCrawlUrls || [], // 수동 크롤링 링크 전달
        topic: topic, // AI 제목 생성용
        keywords: keywords // AI 제목 생성용
      };
      if (geminiKey) {
        crawlOptions.geminiKey = geminiKey; // AI 제목 생성용
      }
      const massResult = await crawler.crawlMassiveMultiKeyword(topic, keywords, crawlOptions);

      allContents = massResult.contents;
      ctas = massResult.ctas;

      console.log(`[CRAWLER] ✅ 대량 크롤링 완료: ${allContents.length}개 글, ${ctas.length}개 CTA`);
      console.log(`[CRAWLER] 📊 통계:`, massResult.stats);
      console.log(`[CRAWLER] 🔍 분석 결과:`, massResult.analysis);

      // 크롤링 결과 상세 검증
      if (allContents.length > 0) {
        console.log(`[CRAWLER] 📋 실제 크롤링된 콘텐츠 샘플 (상위 5개):`);
        allContents.slice(0, 5).forEach((content, index) => {
          console.log(`[CRAWLER] ${index + 1}. 제목: ${content.title}`);
          console.log(`[CRAWLER]    URL: ${content.url}`);
          console.log(`[CRAWLER]    관련성: ${content.relevance}/10`);
          console.log(`[CRAWLER]    출처: ${content.source}`);
        });
      }

      if (ctas.length > 0) {
        console.log(`[CRAWLER] 🔗 실제 크롤링된 CTA 샘플 (상위 5개):`);
        ctas.slice(0, 5).forEach((cta, index) => {
          console.log(`[CRAWLER] ${index + 1}. 텍스트: ${cta.text}`);
          console.log(`[CRAWLER]    후킹멘트: ${cta.hook}`);
          console.log(`[CRAWLER]    URL: ${cta.url}`);
          console.log(`[CRAWLER]    외부링크: ${cta.isExternal ? 'YES' : 'NO'}`);
        });
      }

      if (allContents.length === 0 && ctas.length === 0) {
        console.log(`[CRAWLER] ⚠️ 대량 크롤링에서 실제 데이터를 수집하지 못했습니다.`);
        console.log(`[CRAWLER] 🔧 네이버 API 키와 구글 CSE 설정을 확인해주세요.`);
      }

      return { contents: allContents, ctas };
    } catch (error) {
      console.error(`[CRAWLER] ❌ 대량 크롤링 실패, 기존 방식으로 폴백:`, error);
    }
  }

  // 기존 크롤링 방식 (폴백)
  console.log(`[CRAWLER] 📋 기존 크롤링 병렬 처리 시작: 네이버 API + RSS + CSE 동시 실행`);

  // 병렬 크롤링 실행 (타임아웃 포함) - 성능 최적화: 타임아웃 단축
  const crawlPromises = [
    // 네이버 API 크롤링 (API 키가 있을 때만 실행)
    (naverClientId && naverClientSecret) ? crawler.crawlFromNaverAPI({
      topic,
      keywords,
      maxResults: 50, // 성능 최적화: 100 -> 50으로 감소
      naverClientId,
      naverClientSecret
    }).catch(error => {
      console.log(`[CRAWLER] ❌ 네이버 API 실패: ${error}`);
      return [];
    }) : Promise.resolve([]),

    // RSS 크롤링 (항상 실행 가능)
    crawler.crawlFromRSS({
      topic,
      keywords,
      maxResults: 50 // 성능 최적화: 80 -> 50으로 감소
    }).catch(error => {
      console.log(`[CRAWLER] ❌ RSS 실패: ${error}`);
      return [];
    }),

    // CSE 크롤링 (API 키가 있을 때만 실행)
    (googleCseKey && googleCseCx) ? crawler.crawlFromCSE({
      topic,
      keywords,
      maxResults: 30, // 성능 최적화: 50 -> 30으로 감소
      googleCseKey,
      googleCseCx
    }).catch(error => {
      console.log(`[CRAWLER] ❌ CSE 실패: ${error}`);
      return [];
    }) : Promise.resolve([])
  ];

  // 모든 크롤링 병렬 실행 (최대 45초 대기 - 성능 최적화: 1분 이내)
  const crawlTimeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('크롤링 전체 시간 초과: 45초를 초과했습니다.'));
    }, 45 * 1000); // 45초 (성능 최적화)
  });

  try {
    const crawlResults = await Promise.race([
      Promise.all(crawlPromises),
      crawlTimeoutPromise
    ]);

    // 결과 병합
    crawlResults.forEach((contents, index) => {
      if (contents && contents.length > 0) {
        allContents.push(...contents);
        const source = index === 0 ? '네이버 API' : index === 1 ? 'RSS' : 'CSE';
        console.log(`[CRAWLER] ✅ ${source} 성공: ${contents.length}개 글 수집`);
      }
    });

    console.log(`[CRAWLER] ✅ 병렬 크롤링 완료: 총 ${allContents.length}개 글 수집`);

  } catch (error) {
    console.log(`[CRAWLER] ❌ 크롤링 전체 실패: ${error}, 기본 데이터 사용`);
    allContents = [];
  }

  // 🛡️ 4단계: 기본 데이터 (최종 폴백)
  if (allContents.length === 0) {
    console.log(`[CRAWLER] 🛡️ 4단계: 모든 크롤링 실패, 기본 데이터 생성...`);
    allContents = generateDefaultContents(topic, keywords);
  }

  // 관련도 순으로 정렬하고 상위 20개 선택 (더 많은 데이터 활용)
  const sortedContents = allContents
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 20);

  // CTA 크롤링 (크롤링된 내용이 있을 때만)
  if (sortedContents.length > 0) {
    try {
      ctas = await crawler.crawlCTAFromContent(sortedContents);
      console.log(`[CRAWLER] ✅ CTA 크롤링 완료: ${ctas.length}개 CTA 수집`);
    } catch (error) {
      console.log(`[CRAWLER] ⚠️ CTA 크롤링 실패, 기본 CTA 사용: ${error}`);
      ctas = generateDefaultCTAs(topic, keywords);
    }
  } else {
    console.log(`[CRAWLER] 🛡️ 기본 CTA 생성...`);
    ctas = generateDefaultCTAs(topic, keywords);
  }

  console.log(`[CRAWLER] 🎯 최종 결과: ${sortedContents.length}개 글, ${ctas.length}개 CTA`);

  return { contents: sortedContents, ctas };
}

/**
 * 기본 콘텐츠 생성 (모든 크롤링 실패 시)
 */
function generateDefaultContents(topic: string, keywords: string[]): CrawledContent[] {
  return [
    {
      title: `${topic}에 대한 기본 정보`,
      content: `${topic}은 많은 사람들이 관심을 가지고 있는 주제입니다. 이 글에서는 ${keywords.join(', ')} 등에 대해 알아보겠습니다.`,
      source: 'default',
      platform: 'rss',
      relevance: 5,
      url: '#'
    },
    {
      title: `${topic}의 중요성과 가치`,
      content: `${topic}은 현대 사회에서 중요한 역할을 하고 있습니다. 특히 ${keywords[0] || '관련 분야'}에서 그 중요성이 더욱 부각되고 있습니다.`,
      source: 'default',
      platform: 'rss',
      relevance: 4,
      url: '#'
    }
  ];
}

/**
 * 기본 CTA 생성 (모든 크롤링 실패 시)
 */
function generateDefaultCTAs(_topic: string, _keywords: string[]): CrawledCTA[] {
  return [
    {
      text: '더 알아보기',
      url: '#',
      type: 'button',
      context: 'default',
      source: 'default',
      relevance: 3
    },
    {
      text: '관련 정보 확인',
      url: '#',
      type: 'link',
      context: 'default',
      source: 'default',
      relevance: 2
    }
  ];
}
