/**
 * 네이버 검색 API 통합
 * 
 * 네이버 개발자 센터: https://developers.naver.com/apps/#/register
 * 
 * 필수 환경변수:
 * - NAVER_CLIENT_ID
 * - NAVER_CLIENT_SECRET
 */

import axios from 'axios';

// 네이버 개발자 센터에서 발급
// https://developers.naver.com/apps/#/register
const NAVER_CLIENT_ID = process.env['NAVER_CLIENT_ID'] || '';
const NAVER_CLIENT_SECRET = process.env['NAVER_CLIENT_SECRET'] || '';

export interface NaverSearchResult {
  title: string;
  link: string;
  description: string;
}

/**
 * 네이버 블로그 검색 API
 */
export async function searchNaverBlog(
  query: string,
  display = 10
): Promise<NaverSearchResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[네이버 블로그 API] Client ID/Secret이 설정되지 않았습니다.');
    return [];
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
      params: {
        query,
        display: Math.min(display, 100), // 10~100
        sort: 'sim' // sim: 정확도순, date: 날짜순
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    return response.data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, '')
    }));
  } catch (error: any) {
    console.error('[네이버 블로그 API] 에러:', error?.message || error);
    return [];
  }
}

/**
 * 네이버 뉴스 검색 API
 */
export async function searchNaverNews(
  query: string,
  display = 10
): Promise<NaverSearchResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[네이버 뉴스 API] Client ID/Secret이 설정되지 않았습니다.');
    return [];
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/news.json', {
      params: {
        query,
        display: Math.min(display, 100),
        sort: 'date' // date: 최신순, sim: 정확도순
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    return response.data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      link: item.originallink || item.link,
      description: item.description.replace(/<[^>]*>/g, '')
    }));
  } catch (error: any) {
    console.error('[네이버 뉴스 API] 에러:', error?.message || error);
    return [];
  }
}

/**
 * 네이버 카페 검색 API
 */
export async function searchNaverCafe(
  query: string,
  display = 10
): Promise<NaverSearchResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[네이버 카페 API] Client ID/Secret이 설정되지 않았습니다.');
    return [];
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/cafearticle.json', {
      params: {
        query,
        display: Math.min(display, 100),
        sort: 'sim'
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    return response.data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      link: item.link,
      description: item.description.replace(/<[^>]*>/g, '')
    }));
  } catch (error: any) {
    console.error('[네이버 카페 API] 에러:', error?.message || error);
    return [];
  }
}

/**
 * 🛒 네이버 쇼핑 검색 API (스마트스토어 포함)
 */
export interface NaverShoppingResult {
  title: string;
  link: string;
  image: string;
  lprice: string;  // 최저가
  hprice: string;  // 최고가
  mallName: string; // 쇼핑몰 이름 (스마트스토어 포함)
  productId: string;
  productType: string; // 1: 일반상품, 2: 일반상품(중고), 3: 일반상품(단종), 4: 중고상품, 5: 중고상품(단종), 6: 카탈로그
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

/**
 * v3.8.525 — 네이버 쇼핑 검색 API(shop.json)는 2026-07-31 완전 종료됐다.
 * 실측(2026-08-18): 404 SE05 "존재하지 않는 검색 api". 공식 대체 API 없음.
 * 호출하는 곳이 없어 그대로 지운다 — 남겨두면 누군가 다시 배선해 조용히 빈 배열을 받는다.
 * 쇼핑 모드는 원래 브라우저 크롤링(search.shopping.naver.com)이라 이 종료와 무관하다.
 */

/**
 * 🛒 스마트스토어/브랜드스토어 상품 정보 가져오기
 * 네이버 쇼핑 API를 활용하여 상품 정보 추출
 */
export async function getSmartStoreProductInfo(productUrl: string): Promise<{
  title: string;
  price: string;
  description: string;
  category: string;
  mallName: string;
} | null> {
  try {
    // URL에서 상품 키워드 추출
    const urlParts = productUrl.split('/');
    let keyword = '';
    
    // 스마트스토어 URL 분석
    if (productUrl.includes('smartstore.naver.com') || productUrl.includes('brand.naver.com')) {
      // 스토어 이름 추출
      const storeMatch = productUrl.match(/(?:smartstore|brand)\.naver\.com\/([^\/]+)/);
      if (storeMatch && storeMatch[1]) {
        keyword = storeMatch[1].replace(/_/g, ' ');
      }
    }
    
    if (!keyword) {
      // URL의 마지막 부분에서 키워드 추출 시도
      keyword = decodeURIComponent(urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2] || '');
    }
    
    /**
     * v3.8.525 — 이 경로는 네이버 쇼핑 검색 API 로만 값을 얻었는데 그 API 가
     * 2026-07-31 종료됐다(실측 404, 대체 없음). 그래서 더는 정보를 얻을 수 없다.
     * 상품 정보는 브라우저로 직접 수집하는 shopping-crawler 가 담당한다 —
     * 종료된 API 를 계속 두드리며 빈 값을 돌려주는 것보다 없다고 답하는 게 정직하다.
     */
    void keyword;
    return null;
  } catch (error: any) {
    console.error('[스마트스토어 정보 추출] 에러:', error?.message || error);
    return null;
  }
}

