/**
 * 네이버 데이터랩 API 통합
 * 
 * 검색어 트렌드, 연관 검색어, 검색량 분석
 * 
 * 필수 환경변수:
 * - NAVER_CLIENT_ID
 * - NAVER_CLIENT_SECRET
 */

import axios from 'axios';

const NAVER_CLIENT_ID = process.env['NAVER_CLIENT_ID'] || '';
const NAVER_CLIENT_SECRET = process.env['NAVER_CLIENT_SECRET'] || '';

export interface KeywordSearchVolume {
  keyword: string;
  avgSearchVolume: number;
}

/**
 * 네이버 데이터랩 API - 검색어 트렌드
 * 
 * ⚠️ 주의: 데이터랩 API는 검색광고 API 키가 필요할 수 있습니다.
 * 일반 네이버 API 키로는 401 에러가 발생할 수 있습니다.
 * 실패 시 graceful하게 처리합니다.
 */
export async function getSearchTrend(
  keywords: string[],
  startDate?: string,
  endDate?: string
): Promise<any> {
  const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
  const defaultEndDate = new Date().toISOString().split('T')[0] || '';
  
  const finalStartDate = startDate || defaultStartDate;
  const finalEndDate = endDate || defaultEndDate;
  
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    // 키가 없으면 조용히 null 반환 (로그 출력 안함)
    return null;
  }

  if (keywords.length === 0) {
    return null;
  }

  try {
    const body = {
      startDate: finalStartDate,
      endDate: finalEndDate,
      timeUnit: 'date',
      keywordGroups: keywords.slice(0, 5).map(keyword => ({
        groupName: keyword,
        keywords: [keyword]
      })),
      device: '', // 전체 디바이스
      ages: [], // 전체 연령
      gender: '' // 전체 성별
    };

    const response = await axios.post(
      'https://openapi.naver.com/v1/datalab/search',
      body,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error: any) {
    // 401 에러는 인증 문제 (검색광고 API 키 필요)
    if (error?.response?.status === 401) {
      // 조용히 실패 처리 (일반 API 키로는 데이터랩 사용 불가)
      return null;
    }
    // 다른 에러만 로그
    console.warn('[데이터랩 API] 에러:', error?.message || error);
    return null;
  }
}

/**
 * 검색량으로 키워드 정렬
 */
export async function sortKeywordsBySearchVolume(
  keywords: string[]
): Promise<KeywordSearchVolume[]> {
  if (keywords.length === 0) {
    return [];
  }

  const trend = await getSearchTrend(keywords);
  
  if (!trend || !trend.results) {
    return keywords.map(keyword => ({ keyword, avgSearchVolume: 0 }));
  }

  return trend.results.map((result: any) => {
    if (!result.data || result.data.length === 0) {
      return {
        keyword: result.title || result.keywordGroup[0]?.groupName || '',
        avgSearchVolume: 0
      };
    }

    const totalRatio = result.data.reduce((sum: number, point: any) => sum + (point.ratio || 0), 0);
    const avgRatio = totalRatio / result.data.length;
    
    return {
      keyword: result.title || result.keywordGroup[0]?.groupName || '',
      avgSearchVolume: avgRatio
    };
  }).sort((a: KeywordSearchVolume, b: KeywordSearchVolume) => b.avgSearchVolume - a.avgSearchVolume);
}

/**
 * 최고 검색량 키워드 선택
 */
export async function selectBestKeyword(keywords: string[]): Promise<string> {
  if (keywords.length === 0) {
    return '';
  }

  const sorted = await sortKeywordsBySearchVolume(keywords);
  return sorted[0]?.keyword || keywords[0] || '';
}

