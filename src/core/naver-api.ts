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

export async function searchNaverShopping(
  query: string,
  display = 20
): Promise<NaverShoppingResult[]> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[네이버 쇼핑 API] Client ID/Secret이 설정되지 않았습니다.');
    return [];
  }

  try {
    const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
      params: {
        query,
        display: Math.min(display, 100), // 최대 100개
        sort: 'sim' // sim: 정확도순, date: 날짜순, asc: 가격오름차순, dsc: 가격내림차순
      },
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    console.log(`[네이버 쇼핑 API] "${query}" 검색 결과: ${response.data.items?.length || 0}개`);

    return response.data.items.map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
      link: item.link,
      image: item.image,
      lprice: item.lprice,
      hprice: item.hprice || item.lprice,
      mallName: item.mallName,
      productId: item.productId,
      productType: item.productType,
      brand: item.brand || '',
      maker: item.maker || '',
      category1: item.category1 || '',
      category2: item.category2 || '',
      category3: item.category3 || '',
      category4: item.category4 || ''
    }));
  } catch (error: any) {
    console.error('[네이버 쇼핑 API] 에러:', error?.message || error);
    return [];
  }
}

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
    
    // 네이버 쇼핑 API로 검색
    const results = await searchNaverShopping(keyword, 5);
    const product = results[0];
    
    if (product) {
      return {
        title: product.title,
        price: `${parseInt(product.lprice).toLocaleString()}원`,
        description: `${product.brand ? product.brand + ' ' : ''}${product.title} - ${product.category1} > ${product.category2} > ${product.category3}`,
        category: `${product.category1} > ${product.category2} > ${product.category3}`.replace(/ > $/g, ''),
        mallName: product.mallName
      };
    }
    
    return null;
  } catch (error: any) {
    console.error('[스마트스토어 정보 추출] 에러:', error?.message || error);
    return null;
  }
}

