/**
 * 🔥 실시간 트렌드 연동 시스템
 * - 네이버 급상승 검색어
 * - 구글 트렌드
 * - 연관 키워드 추출
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

// ============================================
// 🔧 인터페이스 정의
// ============================================

export interface TrendKeyword {
  keyword: string;
  rank: number;
  source: 'naver' | 'google' | 'datalab';
  change?: 'up' | 'down' | 'new' | 'same';
  relatedKeywords?: string[];
}

export interface TrendAnalysis {
  mainKeyword: string;
  trendingKeywords: TrendKeyword[];
  relatedKeywords: string[];
  suggestedH2Topics: string[];
  trendScore: number; // 0-100
}

// ============================================
// 🔍 네이버 실시간 검색어 (데이터랩 기반)
// ============================================

/**
 * 네이버 급상승 검색어 가져오기 (시그널 페이지 사용)
 */
export async function getNaverTrendingKeywords(): Promise<TrendKeyword[]> {
  try {
    // 네이버 시그널 트렌드 페이지 사용 (더 안정적)
    const response = await axios.get('https://search.naver.com/search.naver', {
      params: {
        where: 'nexearch',
        sm: 'top_hty',
        fbm: '0',
        ie: 'utf8',
        query: '급상승 검색어'
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.naver.com/',
      },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const keywords: TrendKeyword[] = [];

    // 네이버 메인 검색 결과에서 연관 검색어 파싱
    $('a.keyword').each((idx, el) => {
      if (idx >= 20) return;
      const keyword = $(el).text().trim();
      if (keyword) {
        keywords.push({
          keyword,
          rank: idx + 1,
          source: 'naver',
          change: 'same',
        });
      }
    });

    // 대안: 네이버 쇼핑 인기검색어
    if (keywords.length === 0) {
      try {
        const shoppingResponse = await axios.get('https://search.shopping.naver.com/search/all', {
          params: { query: '인기상품' },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 5000,
        });
        const $shop = cheerio.load(shoppingResponse.data);
        $shop('.basicList_link__JLQJf, .product_link__TrAac').each((idx, el) => {
          if (idx >= 10) return;
          const text = $shop(el).text().trim().split(' ')[0];
          if (text && text.length > 1) {
            keywords.push({
              keyword: text,
              rank: idx + 1,
              source: 'naver',
              change: 'same',
            });
          }
        });
      } catch {
        // 무시
      }
    }

    console.log(`[트렌드] 네이버 급상승 검색어 ${keywords.length}개 수집`);
    return keywords;
  } catch (error: any) {
    // 에러 로그 간소화
    console.warn('[트렌드] 네이버 급상승 검색어 수집 실패 (무시됨)');
    return [];
  }
}

/**
 * 네이버 연관 검색어 가져오기
 */
export async function getNaverRelatedKeywords(keyword: string): Promise<string[]> {
  try {
    const response = await axios.get(`https://ac.search.naver.com/nx/ac`, {
      params: {
        q: keyword,
        con: 1,
        frm: 'nv',
        ans: 2,
        r_format: 'json',
        r_enc: 'UTF-8',
        r_unicode: 0,
        t_koreng: 1,
        run: 2,
        rev: 4,
        q_enc: 'UTF-8',
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://search.naver.com/',
      },
      timeout: 5000,
    });

    const items = response.data?.items || [];
    const related: string[] = [];
    
    for (const group of items) {
      if (Array.isArray(group)) {
        for (const item of group) {
          if (Array.isArray(item) && item[0]) {
            related.push(item[0]);
          }
        }
      }
    }

    console.log(`[트렌드] "${keyword}" 연관 검색어 ${related.length}개 수집`);
    return related.slice(0, 10);
  } catch (error) {
    console.warn('[트렌드] 연관 검색어 수집 실패:', error);
    return [];
  }
}

// ============================================
// 🔍 구글 트렌드 (무료 API)
// ============================================

/**
 * 구글 트렌드에서 관련 검색어 가져오기
 */
export async function getGoogleTrendingKeywords(keyword: string): Promise<TrendKeyword[]> {
  try {
    // 구글 자동완성 API 사용 (무료)
    const response = await axios.get(`https://suggestqueries.google.com/complete/search`, {
      params: {
        client: 'firefox',
        q: keyword,
        hl: 'ko',
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      timeout: 5000,
    });

    const suggestions = response.data[1] || [];
    const keywords: TrendKeyword[] = suggestions.slice(0, 10).map((kw: string, idx: number) => ({
      keyword: kw,
      rank: idx + 1,
      source: 'google' as const,
    }));

    console.log(`[트렌드] 구글 연관 검색어 ${keywords.length}개 수집`);
    return keywords;
  } catch (error) {
    console.warn('[트렌드] 구글 트렌드 수집 실패:', error);
    return [];
  }
}

// ============================================
// 🎯 트렌드 분석 통합
// ============================================

/**
 * 키워드의 트렌드 점수 계산 (0-100)
 */
function calculateTrendScore(
  naverTrends: TrendKeyword[],
  googleTrends: TrendKeyword[],
  keyword: string
): number {
  let score = 50; // 기본 점수
  
  // 네이버 급상승에 있으면 +30
  const naverMatch = naverTrends.find(t => 
    t.keyword.includes(keyword) || keyword.includes(t.keyword)
  );
  if (naverMatch) {
    score += Math.max(30 - naverMatch.rank, 10);
    if (naverMatch.change === 'up' || naverMatch.change === 'new') {
      score += 10;
    }
  }
  
  // 구글 연관 검색어에 있으면 +20
  const googleMatch = googleTrends.find(t => 
    t.keyword.includes(keyword) || keyword.includes(t.keyword)
  );
  if (googleMatch) {
    score += Math.max(20 - googleMatch.rank * 2, 5);
  }
  
  return Math.min(100, Math.max(0, score));
}

/**
 * 트렌드 기반 H2 주제 생성
 */
function generateTrendBasedH2Topics(
  keyword: string,
  relatedKeywords: string[],
  trendingKeywords: TrendKeyword[]
): string[] {
  const topics: string[] = [];
  
  // 1. 트렌딩 키워드 기반 주제
  for (const trend of trendingKeywords.slice(0, 3)) {
    if (trend.keyword !== keyword) {
      topics.push(`${keyword}와 ${trend.keyword}의 관계`);
    }
  }
  
  // 2. 연관 검색어 기반 주제
  for (const related of relatedKeywords.slice(0, 5)) {
    if (related.includes('방법')) {
      topics.push(related);
    } else if (related.includes('가격') || related.includes('비용')) {
      topics.push(`${keyword} 가격 비교`);
    } else if (related.includes('후기') || related.includes('리뷰')) {
      topics.push(`${keyword} 실제 후기`);
    } else {
      topics.push(`${related} 완벽 가이드`);
    }
  }
  
  // 3. 기본 주제 (트렌드가 없을 때)
  if (topics.length < 3) {
    topics.push(`${keyword} 최신 트렌드 2025`);
    topics.push(`${keyword} 초보자 가이드`);
    topics.push(`${keyword} 전문가 팁`);
  }
  
  // 중복 제거 및 상위 5개 반환
  return [...new Set(topics)].slice(0, 5);
}

/**
 * 🔥 메인 함수: 키워드 트렌드 분석
 */
export async function analyzeTrends(keyword: string): Promise<TrendAnalysis> {
  console.log(`[트렌드] "${keyword}" 트렌드 분석 시작...`);
  
  // 병렬로 데이터 수집
  const [naverTrends, googleTrends, naverRelated] = await Promise.all([
    getNaverTrendingKeywords(),
    getGoogleTrendingKeywords(keyword),
    getNaverRelatedKeywords(keyword),
  ]);
  
  // 트렌드 점수 계산
  const trendScore = calculateTrendScore(naverTrends, googleTrends, keyword);
  
  // 모든 트렌딩 키워드 통합
  const allTrending = [...naverTrends, ...googleTrends];
  
  // 연관 키워드 통합
  const allRelated = [
    ...naverRelated,
    ...googleTrends.map(t => t.keyword),
  ];
  const uniqueRelated = [...new Set(allRelated)].slice(0, 15);
  
  // H2 주제 생성
  const suggestedH2Topics = generateTrendBasedH2Topics(keyword, uniqueRelated, allTrending);
  
  const analysis: TrendAnalysis = {
    mainKeyword: keyword,
    trendingKeywords: allTrending.slice(0, 20),
    relatedKeywords: uniqueRelated,
    suggestedH2Topics,
    trendScore,
  };
  
  console.log(`[트렌드] 분석 완료: 트렌드 점수 ${trendScore}/100, 연관 키워드 ${uniqueRelated.length}개`);
  
  return analysis;
}

/**
 * 트렌드 키워드를 프롬프트에 포함시킬 문자열 생성
 */
export function getTrendPromptAddition(analysis: TrendAnalysis): string {
  if (analysis.trendScore < 30 && analysis.relatedKeywords.length === 0) {
    return '';
  }
  
  let prompt = '\n🔥 **실시간 트렌드 정보**:\n';
  
  if (analysis.trendScore >= 70) {
    prompt += `📈 이 키워드는 현재 **급상승 중** (트렌드 점수: ${analysis.trendScore}/100)\n`;
  } else if (analysis.trendScore >= 50) {
    prompt += `📊 이 키워드는 현재 **관심 증가 중** (트렌드 점수: ${analysis.trendScore}/100)\n`;
  }
  
  if (analysis.relatedKeywords.length > 0) {
    prompt += `\n🔍 **사람들이 함께 검색하는 키워드**:\n`;
    prompt += analysis.relatedKeywords.slice(0, 8).map(k => `- ${k}`).join('\n');
    prompt += '\n\n위 연관 키워드를 본문에 자연스럽게 포함하세요.\n';
  }
  
  if (analysis.suggestedH2Topics.length > 0) {
    prompt += `\n💡 **추천 H2 주제**:\n`;
    prompt += analysis.suggestedH2Topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
    prompt += '\n';
  }
  
  return prompt;
}

