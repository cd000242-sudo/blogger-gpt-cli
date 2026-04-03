/**
 * 크롤링 함수 모음
 * - 네이버, RSS, 티스토리, 워드프레스, 뉴스, 카페
 * - 쇼핑 URL 감지 및 처리
 * - 단일 URL 크롤링, 전체 콘텐츠 크롤링, 폴백 시스템
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { loadEnvFromFile } from '../../env';
import { MassCrawlingSystem, MassCrawledItem } from '../mass-crawler';
import { getShoppingCrawler } from './image-helpers';
import { FINAL_CONFIG, FinalCrawledPost } from './types';

// ============================================
// 🛒 쇼핑 URL 관련 함수
// ============================================

/**
 * 🛒 네이버 쇼핑 URL 감지
 */
export function isNaverShoppingUrl(url: string): boolean {
  return url.includes('smartstore.naver.com') ||
    url.includes('brand.naver.com') ||
    url.includes('brandconnect.naver.com') ||
    url.includes('shopping.naver.com') ||
    url.includes('naver.me');
}

/**
 * 🛒 URL에서 쇼핑몰 정보 추출
 */
export function extractShopInfoFromUrl(url: string): { storeName: string; productId: string; platform: string } {
  let storeName = '';
  let productId = '';
  let platform = '네이버 스마트스토어';

  // 스마트스토어 URL 패턴: https://smartstore.naver.com/{storeName}/products/{productId}
  const smartStoreMatch = url.match(/smartstore\.naver\.com\/([^\/]+)\/products\/(\d+)/);
  if (smartStoreMatch && smartStoreMatch[1] && smartStoreMatch[2]) {
    storeName = smartStoreMatch[1];
    productId = smartStoreMatch[2];
    platform = '네이버 스마트스토어';
  }

  // 브랜드스토어 URL
  const brandMatch = url.match(/brand\.naver\.com\/([^\/]+)/);
  if (brandMatch && brandMatch[1]) {
    storeName = brandMatch[1];
    platform = '네이버 브랜드스토어';
  }

  // 브랜드커넥트 제휴 URL
  const brandConnectMatch = url.match(/brandconnect\.naver\.com/);
  if (brandConnectMatch) {
    platform = '네이버 브랜드커넥트';
  }

  // 상품번호 추출 (다양한 패턴)
  if (!productId) {
    const patterns = [
      /channelProductNo=(\d+)/,
      /products\/(\d+)/,
      /productId=(\d+)/,
      /nvMid=(\d+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        productId = match[1];
        break;
      }
    }
  }

  return { storeName, productId, platform };
}

/**
 * 🛒 스토어명을 사람이 읽기 좋은 형태로 변환
 */
export function formatStoreName(storeName: string): string {
  const storeNameMap: { [key: string]: string } = {
    'bodyfriend': '바디프랜드',
    'mychew': '마이츄',
    'samsung': '삼성',
    'lg': 'LG',
    'apple': '애플',
    'coupang': '쿠팡',
    'naver': '네이버',
  };

  const lowerName = storeName.toLowerCase();
  if (storeNameMap[lowerName]) {
    return storeNameMap[lowerName];
  }

  // CamelCase나 snake_case를 공백으로 분리
  return storeName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ');
}

/**
 * 🛒 네이버 쇼핑 URL에서 상품 정보 추출 (Puppeteer 강화 + 스마트 폴백)
 */
export async function extractNaverShoppingInfo(url: string): Promise<FinalCrawledPost | null> {
  console.log(`[쇼핑크롤링] 🛒 네이버 쇼핑 URL 처리: ${url.substring(0, 50)}...`);

  // 🔥 1차: 원본 URL에서 정보 추출 시도
  let { storeName, productId, platform } = extractShopInfoFromUrl(url);
  let readableStoreName = formatStoreName(storeName);
  let finalUrl = url;

  // 🔥 2차: naver.me 단축 URL인 경우 리다이렉트 따라가서 정보 추출
  if (url.includes('naver.me') && !productId) {
    console.log(`[쇼핑크롤링] 🔗 단축 URL 리다이렉트 확인...`);
    try {
      const redirectResponse = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
        maxRedirects: 5,
      });
      finalUrl = redirectResponse.request?.res?.responseUrl || url;
      console.log(`[쇼핑크롤링] ✅ 리다이렉트 URL: ${finalUrl.substring(0, 60)}...`);

      // 리다이렉트된 URL에서 정보 재추출
      const redirectedInfo = extractShopInfoFromUrl(finalUrl);
      if (redirectedInfo.productId) {
        productId = redirectedInfo.productId;
        platform = redirectedInfo.platform;
        if (redirectedInfo.storeName) {
          storeName = redirectedInfo.storeName;
          readableStoreName = formatStoreName(storeName);
        }
      }
    } catch (e: any) {
      console.log(`[쇼핑크롤링] ⚠️ 리다이렉트 실패: ${e.message}`);
    }
  }

  console.log(`[쇼핑크롤링] 📊 URL 분석:`);
  console.log(`   🏪 스토어: ${readableStoreName || '알 수 없음'}`);
  console.log(`   🔢 상품번호: ${productId || '없음'}`);
  console.log(`   🌐 플랫폼: ${platform}`);

  try {
    // 🔥 1단계: Puppeteer 기반 ShoppingCrawler 시도
    console.log('[쇼핑크롤링] 🚀 Puppeteer Stealth 모드 크롤링 시작...');
    const crawler = await getShoppingCrawler();

    if (crawler) {
      try {
        const productInfo = await crawler.crawlProduct(url);

        // 크롤링 성공 & 유효한 데이터인 경우
        if (productInfo && productInfo.title &&
          !productInfo.title.includes('확인 중') &&
          !productInfo.title.includes('에러')) {
          console.log(`[쇼핑크롤링] ✅ Puppeteer 크롤링 성공!`);

          const reviewContent = generateShoppingReviewContent(productInfo);
          await crawler.close();

          return {
            title: productInfo.title,
            url: productInfo.url || url,
            content: reviewContent,
            subheadings: [
              '상품 기본 정보',
              '실제 사용 후기',
              '장점과 단점',
              '구매 전 확인사항',
              '추천 대상 및 총평',
            ],
            source: 'external' as const,
          };
        }

        await crawler.close();
      } catch (puppeteerError: any) {
        console.warn(`[쇼핑크롤링] ⚠️ Puppeteer 실패: ${puppeteerError.message}`);
        if (crawler) await crawler.close().catch(() => { });
      }
    }

    // 🔥 2단계: HTTP 요청으로 OG 태그 추출 시도
    console.log('[쇼핑크롤링] 📡 HTTP 크롤링 시도...');

    let finalUrl2 = url;
    let title = '';
    let description = '';

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      finalUrl2 = response.request?.res?.responseUrl || url;
      const $ = cheerio.load(response.data);
      title = $('meta[property="og:title"]').attr('content') || '';
      description = $('meta[property="og:description"]').attr('content') || '';

      // 유효한 제목인지 확인
      if (title && title.length > 5 && !title.includes('에러') && !title.includes('브랜드 커넥트')) {
        console.log(`[쇼핑크롤링] ✅ OG 태그 추출 성공: "${title.substring(0, 30)}..."`);
      } else {
        title = ''; // 무효한 제목은 비움
      }
    } catch (httpError: any) {
      console.warn(`[쇼핑크롤링] ⚠️ HTTP 요청 실패: ${httpError.message}`);
    }

    // 🔥 3단계: 스마트 폴백 - URL 정보 기반 콘텐츠 생성
    console.log('[쇼핑크롤링] 💡 스마트 폴백: URL 정보 기반 콘텐츠 생성');

    // 제목 생성
    if (!title) {
      if (readableStoreName && productId) {
        title = `${readableStoreName} 인기 상품 솔직 리뷰 (상품번호: ${productId})`;
      } else if (readableStoreName) {
        title = `${readableStoreName} 베스트 상품 추천 가이드`;
      } else if (productId) {
        title = `${platform} 인기 상품 리뷰 (${productId})`;
      } else {
        title = `${platform} 인기 상품 추천 가이드`;
      }
    }

    // 콘텐츠 생성
    const content = generateSmartShoppingContent(readableStoreName, productId, platform, description);

    console.log(`[쇼핑크롤링] ✅ 콘텐츠 생성 완료: "${title.substring(0, 40)}..."`);

    return {
      title: title,
      url: finalUrl2,
      content: content,
      subheadings: [
        `${readableStoreName || '브랜드'} 소개`,
        '인기 상품 분석',
        '구매 전 체크리스트',
        '가격 및 혜택 비교',
        '구매 추천 및 총평',
      ],
      source: 'external' as const,
    };

  } catch (error: any) {
    console.log(`[쇼핑크롤링] ⚠️ 처리 실패: ${error.message}`);
    // 폴백: 기본 상품 정보 반환
    return {
      title: '네이버 스마트스토어 인기 상품 추천',
      url: url,
      content: '네이버 스마트스토어에서 인기 있는 상품들을 소개합니다.',
      subheadings: ['상품 소개', '구매 가이드', '후기', '최저가'],
      source: 'external' as const,
    };
  }
}

/**
 * 🛒 쇼핑 리뷰 콘텐츠 생성 (상세 정보 기반)
 */
export function generateShoppingReviewContent(productInfo: any): string {
  const { title, price, originalPrice, discount, rating, reviewCount, description, shopType } = productInfo;

  // 에러 페이지인 경우 기본 콘텐츠 반환
  if (title?.includes('에러') || title?.includes('확인 중')) {
    return generateFallbackShoppingContent(shopType);
  }

  let content = `오늘 소개해드릴 상품은 "${title || '이 상품'}"입니다. `;

  if (price) {
    content += `현재 판매 가격은 ${price}`;
    if (originalPrice) content += ` (정가 ${originalPrice})`;
    if (discount) content += `, ${discount} 할인 중`;
    content += '입니다. ';
  }

  if (rating) {
    content += `구매자 평점은 ${rating}점`;
    if (reviewCount) content += ` (${reviewCount}개 리뷰)`;
    content += '으로 높은 만족도를 보여주고 있습니다. ';
  }

  content += `\n\n이 상품의 특징과 장단점을 꼼꼼히 분석해보았습니다. `;
  content += `${shopType || '온라인 쇼핑몰'}에서 판매 중이며, 빠른 배송과 품질 보증을 제공합니다. `;

  if (description) {
    content += `\n\n상품 상세: ${description.substring(0, 300)}`;
  }

  content += `\n\n실제 사용자들의 후기를 종합해보면, 가격 대비 만족도가 높고 품질도 기대 이상이라는 평가가 많습니다. `;
  content += `다만 개인의 취향에 따라 다를 수 있으니 상세 스펙을 확인하시기 바랍니다.`;

  return content;
}

/**
 * 🛒 폴백 쇼핑 콘텐츠 생성 (크롤링 실패 시)
 */
export function generateFallbackShoppingContent(shopType?: string): string {
  const platform = shopType || '네이버 쇼핑';
  return `${platform}에서 판매 중인 인기 상품입니다.

이 상품은 많은 구매자들에게 좋은 평가를 받고 있으며, 가격 대비 품질이 우수하다는 후기가 많습니다.

구매 전 확인사항:
- 배송 기간 및 배송비
- 반품/교환 정책
- A/S 보증 기간
- 실제 사용자 리뷰

최저가 구매를 원하신다면 여러 쇼핑몰의 가격을 비교해보시는 것을 추천드립니다.`;
}

/**
 * 🛒 스마트 쇼핑 콘텐츠 생성 (URL 정보 기반)
 */
export function generateSmartShoppingContent(storeName: string, productId: string, platform: string, description?: string): string {
  let content = '';

  if (storeName) {
    content += `${storeName}에서 판매하는 인기 상품을 소개합니다. `;
    content += `${storeName}은 ${platform}에서 높은 평점과 많은 판매량을 자랑하는 믿을 수 있는 판매자입니다.\n\n`;
  } else {
    content += `${platform}에서 인기 있는 상품을 소개합니다. `;
    content += `많은 구매자들에게 좋은 평가를 받고 있는 상품입니다.\n\n`;
  }

  if (description) {
    content += `${description}\n\n`;
  }

  if (productId) {
    content += `상품번호 ${productId}번으로 네이버 쇼핑에서 검색하시면 더 자세한 정보와 최저가를 확인하실 수 있습니다.\n\n`;
  }

  content += `이 상품을 구매하기 전 확인해야 할 사항들:\n`;
  content += `- 상세 스펙 및 구성품 확인\n`;
  content += `- 배송 기간 및 배송비 (무료배송 여부)\n`;
  content += `- 반품/교환 정책 및 A/S 보증 기간\n`;
  content += `- 실제 구매자 리뷰 및 평점\n`;
  content += `- 타 쇼핑몰과의 가격 비교\n\n`;

  content += `실제 사용자들의 후기를 종합해보면, 가격 대비 만족도가 높고 품질도 기대 이상이라는 평가가 많습니다. `;
  content += `다만 개인의 취향과 필요에 따라 다를 수 있으니 상세 스펙을 꼼꼼히 확인하시기 바랍니다.\n\n`;

  content += `구매 팁:\n`;
  content += `- 정기 세일 기간을 활용하면 더 저렴하게 구매할 수 있습니다\n`;
  content += `- 네이버페이 결제 시 추가 포인트 적립 혜택이 있는 경우가 많습니다\n`;
  content += `- 리뷰 작성 시 포인트 리워드를 받을 수 있습니다\n`;

  return content;
}

/**
 * 🛒 기본 쇼핑 콘텐츠 생성 (제한된 정보 기반)
 */
export function generateBasicShoppingContent(title: string, description: string, price: string, productId: string): string {
  let content = `"${title}" 상품에 대한 상세 리뷰입니다. `;

  if (price) {
    content += `판매 가격은 ${price}원입니다. `;
  }

  if (description) {
    content += `\n\n${description} `;
  }

  if (productId) {
    content += `\n\n상품번호 ${productId}번으로 네이버 쇼핑에서 검색하시면 더 자세한 정보를 확인할 수 있습니다. `;
  }

  content += `\n\n이 상품을 구매하기 전 확인해야 할 사항들과 실제 구매자들의 솔직한 후기를 정리했습니다. `;
  content += `가격, 품질, 배송, A/S 등 다양한 측면에서 분석해보았으니 구매 결정에 참고하시기 바랍니다.`;

  return content;
}

// ============================================
// 🔍 크롤링 함수
// ============================================

/**
 * 🔗 단일 URL 빠른 크롤링 (URL 기반 콘텐츠 생성용)
 */
export async function crawlSingleUrlFast(url: string): Promise<FinalCrawledPost | null> {
  try {
    console.log(`[URL크롤링] 🔍 시작: ${url.substring(0, 60)}...`);
    const startTime = Date.now();

    // 🛒 쇼핑 URL 감지 → Playwright 기반 크롤링 (쿠팡, G마켓, 옥션, 11번가, Temu 등)
    try {
      const { isShoppingUrl: checkShopping, extractShoppingProductInfo } = await import('../../crawlers/shopping-pipeline');
      if (checkShopping(url)) {
        console.log(`[URL크롤링] 🛒 쇼핑 URL 감지 — Playwright 크롤러 사용`);
        const shoppingResult = await extractShoppingProductInfo(url);
        if (shoppingResult) {
          return {
            title: shoppingResult.post.title,
            url: shoppingResult.post.url,
            content: shoppingResult.post.content,
            subheadings: shoppingResult.post.subheadings || [],
            source: 'external',
          };
        }
      }
    } catch (shopErr: any) {
      console.log(`[URL크롤링] ⚠️ 쇼핑 파이프라인 로드 실패 (기존 방식 폴백): ${shopErr.message}`);
    }

    // 🛒 네이버 쇼핑 URL 특별 처리 (기존 Puppeteer 폴백)
    if (isNaverShoppingUrl(url)) {
      return await extractNaverShoppingInfo(url);
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: 10000, // 10초 타임아웃 (속도 최적화)
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);

    // 불필요한 요소 제거 (더 공격적으로)
    $('script, style, nav, header, footer, aside, .ads, .advertisement, .sidebar, .comment, .comments, [class*="ad-"], [id*="ad-"], .related, .recommend, .banner, .popup, noscript, iframe').remove();

    // 🔥 제목 추출 (다양한 뉴스사이트 지원)
    let title = '';
    const titleSelectors = [
      // 뉴스 포털 특화
      'h1', '#article_title', '.article_tit', '.news_title', '.tit_view',
      // OG 태그
      'meta[property="og:title"]',
      // 일반 뉴스
      'h1.title', 'h1.entry-title', 'h1.post-title', 'h1.article-title',
      '.title h1', 'article h1', '.content h1', 'title'
    ];

    for (const sel of titleSelectors) {
      if (sel.includes('meta')) {
        const found = $(sel).attr('content');
        if (found && found.length > 5 && found.length < 200) {
          // 사이트명 제거 (: 또는 - 뒤 부분)
          const parts = found.split(' : ');
          const firstPart = parts[0] || found;
          const subParts = firstPart.split(' - ');
          title = (subParts[0] || firstPart).trim();
          break;
        }
      } else {
        const found = $(sel).first().text().trim();
        if (found && found.length > 5 && found.length < 200) {
          title = found;
          break;
        }
      }
    }

    // 🔥 본문 추출 (다양한 뉴스사이트 지원)
    let content = '';
    const contentSelectors = [
      // 뉴스 포털 특화
      '.article_body', '.news_content', '#article_content', '.article_txt',
      '[itemprop="articleBody"]', '.news_view', '.view_txt',
      // 일반 뉴스
      'article', '.article-body', '.article-content', '.post-content',
      '.entry-content', '.content', '.post-body', '.article',
      '#content', 'main', '.main-content'
    ];

    for (const sel of contentSelectors) {
      const found = $(sel).first();
      if (found.length) {
        const text = found.text().trim().replace(/\s+/g, ' ');
        if (text.length > 100) {
          content = text;
          break;
        }
      }
    }

    // 본문이 짧으면 body에서 추출
    if (content.length < 300) {
      const bodyText = $('body').text().trim().replace(/\s+/g, ' ');
      if (bodyText.length > content.length) {
        content = bodyText;
      }
    }

    // 최대 길이 제한
    content = content.substring(0, 12000);

    // 소제목 추출
    const subheadings: string[] = [];
    $('h2, h3, strong').each((_i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 3 && text.length < 100 && !text.includes('광고') && !text.includes('추천')) {
        subheadings.push(text);
      }
    });

    const duration = Date.now() - startTime;
    console.log(`[URL크롤링] ✅ 완료 (${duration}ms): 제목="${title.substring(0, 35)}...", 본문=${content.length}자`);

    if (!title && content.length < 100) {
      console.log('[URL크롤링] ⚠️ 콘텐츠 부족');
      return null;
    }

    return {
      title: title || '제목 없음',
      url,
      content,
      subheadings: subheadings.slice(0, 15),
      source: 'external' as const,
    };

  } catch (error: any) {
    console.error(`[URL크롤링] ❌ 실패: ${url}`, error.message);
    return null;
  }
}

export async function crawlTistory(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    // 구글 검색: site:tistory.com
    const url = `https://www.google.com/search?q=site:tistory.com+${encodeURIComponent(keyword)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('a').each((_i, elem) => {
      if (posts.length >= FINAL_CONFIG.TISTORY_MAX) return;

      const href = $(elem).attr('href') || '';
      if (href.includes('tistory.com') && !href.includes('google')) {
        const title = $(elem).text().trim();
        if (title && title.length > 5) {
          posts.push({
            title,
            url: href,
            content: '',
            subheadings: [],
            source: 'tistory',
          });
        }
      }
    });
  } catch (error) {
    console.error('[크롤링] 티스토리 실패');
  }

  return posts;
}

export async function crawlWordPress(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    // 구글 검색: site:wordpress.com
    const url = `https://www.google.com/search?q=site:wordpress.com+${encodeURIComponent(keyword)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('a').each((_i, elem) => {
      if (posts.length >= FINAL_CONFIG.WORDPRESS_MAX) return;

      const href = $(elem).attr('href') || '';
      if (href.includes('wordpress') && !href.includes('google')) {
        const title = $(elem).text().trim();
        if (title && title.length > 5) {
          posts.push({
            title,
            url: href,
            content: '',
            subheadings: [],
            source: 'wordpress',
          });
        }
      }
    });
  } catch (error) {
    console.error('[크롤링] 워드프레스 실패');
  }

  return posts;
}

export async function crawlNews(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    // 🔥 네이버 뉴스 검색 (최신순 정렬)
    const searchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(keyword)}&sort=1`;
    const response = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);
    const newsItems: { title: string; url: string }[] = [];

    // 뉴스 링크 수집
    $('.news_tit').each((_i, elem) => {
      if (newsItems.length >= FINAL_CONFIG.NEWS_MAX) return;

      const title = $(elem).text().trim();
      const url = $(elem).attr('href') || '';

      if (title && url) {
        newsItems.push({ title, url });
      }
    });

    console.log(`📰 [뉴스] ${newsItems.length}개 뉴스 발견, 본문 크롤링 중...`);

    // 🔥 각 뉴스 본문 크롤링 (병렬 처리, 최대 10개)
    const topNews = newsItems.slice(0, 10);
    const crawlPromises = topNews.map(async (item) => {
      try {
        const articleContent = await crawlNewsArticle(item.url);
        return {
          title: item.title,
          url: item.url,
          content: articleContent.content,
          subheadings: articleContent.subheadings,
          source: 'news' as const,
        };
      } catch {
        return {
          title: item.title,
          url: item.url,
          content: '',
          subheadings: [],
          source: 'news' as const,
        };
      }
    });

    const results = await Promise.all(crawlPromises);

    // 본문이 있는 뉴스만 필터링
    const withContent = results.filter(p => p.content.length > 100);
    console.log(`✅ [뉴스] ${withContent.length}개 뉴스 본문 크롤링 완료`);

    posts.push(...withContent);

    // 본문 없는 것도 일단 추가 (제목은 참고용)
    const withoutContent = results.filter(p => p.content.length <= 100);
    posts.push(...withoutContent);

  } catch (error) {
    console.error('[크롤링] 뉴스 검색 실패:', error);
  }

  return posts;
}

// 🔥 뉴스 기사 본문 크롤링 함수
async function crawlNewsArticle(url: string): Promise<{ content: string; subheadings: string[] }> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(response.data);
    let content = '';
    const subheadings: string[] = [];

    // 네이버 뉴스
    if (url.includes('naver.com')) {
      content = $('#dic_area').text() ||
        $('#articeBody').text() ||
        $('.article_body').text() ||
        $('#newsct_article').text() ||
        $('article').text();
    }
    // 연합뉴스
    else if (url.includes('yna.co.kr')) {
      content = $('.article-txt').text() ||
        $('#articleWrap .story-news article').text() ||
        $('.txt-article').text();
    }
    // 조선/중앙/동아 등
    else if (url.includes('chosun.com') || url.includes('joongang.co.kr') || url.includes('donga.com')) {
      content = $('.article-body').text() ||
        $('article').text() ||
        $('.news_body').text();
    }
    // SBS/KBS/MBC
    else if (url.includes('sbs.co.kr') || url.includes('kbs.co.kr') || url.includes('imbc.com')) {
      content = $('.article_body').text() ||
        $('article').text() ||
        $('.text').text();
    }
    // 기타 뉴스
    else {
      content = $('article').text() ||
        $('.article-body').text() ||
        $('.news-content').text() ||
        $('.story-body').text() ||
        $('[itemprop="articleBody"]').text() ||
        $('.post-content').text();
    }

    // 소제목 추출
    $('h2, h3, strong').each((_i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 5 && text.length < 100) {
        subheadings.push(text);
      }
    });

    // 정제
    content = content
      .replace(/\s+/g, ' ')
      .replace(/광고|기자|copyright|저작권|무단전재/gi, '')
      .trim()
      .slice(0, 5000); // 최대 5000자

    return { content, subheadings: subheadings.slice(0, 10) };
  } catch (error) {
    return { content: '', subheadings: [] };
  }
}

export async function crawlCafe(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    // 네이버 카페 검색
    const url = `https://search.naver.com/search.naver?where=article&query=${encodeURIComponent(keyword)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('.title_link').each((_i, elem) => {
      if (posts.length >= FINAL_CONFIG.CAFE_MAX) return;

      const title = $(elem).text().trim();
      const url = $(elem).attr('href') || '';

      if (title && url) {
        posts.push({
          title,
          url,
          content: '',
          subheadings: [],
          source: 'cafe',
        });
      }
    });
  } catch (error) {
    console.error('[크롤링] 카페 실패');
  }

  return posts;
}

export async function crawlNaverFinal(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    const url = `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(keyword)}&sort=1`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    $('.view_wrap').each((_i, elem) => {
      if (posts.length >= FINAL_CONFIG.NAVER_BLOG_MAX) return;

      const titleElem = $(elem).find('.title_link');
      const title = titleElem.text().trim();
      const link = titleElem.attr('href') || '';

      if (title && link) {
        posts.push({
          title,
          url: link,
          content: '',
          subheadings: [],
          viewCount: 100 - posts.length,
          source: 'naver',
        });
      }
    });
  } catch (error) {
    console.error('[크롤링] 네이버 실패');
  }

  return posts;
}

export async function crawlRSSFinal(keyword: string): Promise<FinalCrawledPost[]> {
  const posts: FinalCrawledPost[] = [];

  try {
    const url = `https://search.naver.com/search.naver?where=rss&query=${encodeURIComponent(keyword)}`;
    const response = await axios.get(url, {
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data, { xmlMode: true });

    $('item').each((_i, elem) => {
      if (posts.length >= FINAL_CONFIG.RSS_MAX) return;

      const title = $(elem).find('title').text().trim();
      const link = $(elem).find('link').text().trim();

      if (title && link) {
        posts.push({
          title,
          url: link,
          content: '',
          subheadings: [],
          source: 'rss',
        });
      }
    });
  } catch (error) {
    console.error('[크롤링] RSS 실패');
  }

  return posts;
}

export async function crawlFullContentFinal(post: FinalCrawledPost): Promise<void> {
  try {
    const response = await axios.get(post.url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: FINAL_CONFIG.CRAWL_TIMEOUT,
    });

    const $ = cheerio.load(response.data);

    // 소제목 추출
    $('h2, h3, h4, strong, b').each((_i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 3 && text.length < 100) {
        post.subheadings.push(text);
      }
    });

    // 본문 추출
    let content = '';

    if (post.url.includes('blog.naver.com')) {
      content = $('.se-main-container, .post-view, #postViewArea').text();
    } else if (post.url.includes('tistory.com')) {
      content = $('.article-view, .entry-content').text();
    } else if (post.url.includes('wordpress')) {
      content = $('.entry-content, .post-content').text();
    } else {
      content = $('article, .content, body').text();
    }

    post.content = content.replace(/\s+/g, ' ').trim().slice(0, 5000);

  } catch (error) {
    // 크롤링 실패 시 빈 값
  }
}

export async function crawlAllWithFallback(keyword: string): Promise<FinalCrawledPost[]> {
  console.log('\n🚀 [크롤링] 대량 크롤링 시작...\n');

  const startTime = Date.now();
  let allPosts: FinalCrawledPost[] = [];

  // 🔥 1단계: MassCrawlingSystem 사용 (API 키가 있는 경우)
  try {
    const envData = loadEnvFromFile();

    // 네이버 API 키 (다양한 형식 지원)
    const naverClientId = envData['naverClientId'] || envData['NAVER_CLIENT_ID'] || '';
    const naverClientSecret = envData['naverClientSecret'] || envData['NAVER_CLIENT_SECRET'] || '';

    // Google CSE 키 (다양한 형식 지원)
    const googleCseKey = envData['googleCseKey'] || envData['GOOGLE_CSE_KEY'] || envData['GOOGLE_CSE_API_KEY'] || envData['googleApiKey'] || '';
    const googleCseId = envData['googleCseId'] || envData['GOOGLE_CSE_ID'] || envData['googleCseCx'] || envData['GOOGLE_CSE_CX'] || '';

    console.log('🔑 [API 키 확인]');
    console.log('   - 네이버 Client ID:', naverClientId ? '✅ ' + naverClientId.substring(0, 8) + '...' : '❌ 없음');
    console.log('   - 네이버 Client Secret:', naverClientSecret ? '✅ 있음' : '❌ 없음');
    console.log('   - Google CSE Key:', googleCseKey ? '✅ ' + googleCseKey.substring(0, 10) + '...' : '❌ 없음');
    console.log('   - Google CSE ID:', googleCseId ? '✅ ' + googleCseId.substring(0, 10) + '...' : '❌ 없음');

    if (naverClientId && naverClientSecret) {
      console.log('🔑 [크롤링] 네이버 API 키 발견 - MassCrawlingSystem 사용');

      const massCrawler = new MassCrawlingSystem(
        naverClientId,
        naverClientSecret,
        googleCseKey || undefined,
        googleCseId || undefined
      );

      const massResult = await massCrawler.crawlAll(keyword, {
        maxResults: 100,
        enableFullContent: true,
        maxConcurrent: 10,
      });

      // MassCrawledItem을 FinalCrawledPost로 변환
      allPosts = massResult.items.map((item: MassCrawledItem) => ({
        title: item.title,
        url: item.link,
        content: item.fullContent?.text || item.description || '',
        subheadings: [],
        source: item.source as any,
        viewCount: item.popularityScore,
      }));

      console.log(`✅ [크롤링] MassCrawlingSystem 완료: ${allPosts.length}개`);
      console.log(`   - 네이버: ${massResult.stats.naverCount}`);
      console.log(`   - RSS: ${massResult.stats.rssCount}`);
      console.log(`   - CSE: ${massResult.stats.cseCount}\n`);

      if (allPosts.length >= 5) {
        // 충분한 데이터가 있으면 바로 반환
        const endTime = Date.now();
        console.log(`✅ [크롤링] 완료! (${((endTime - startTime) / 1000).toFixed(1)}초)`);
        console.log(`   - 최종: ${allPosts.length}개\n`);
        return allPosts;
      }
    }
  } catch (massError) {
    console.warn('⚠️ [크롤링] MassCrawlingSystem 실패, 기본 크롤링으로 폴백:', massError);
  }

  // 🔥 2단계: 기본 크롤링 (API 키가 없거나 MassCrawlingSystem 실패 시)
  let retryCount = 0;
  const maxRetries = 3;

  while (allPosts.length < 5 && retryCount < maxRetries) {
    retryCount++;
    console.log(`📡 [크롤링] 기본 크롤링 시도 ${retryCount}/${maxRetries}...`);

    // 모든 소스 동시 크롤링 (타임아웃 처리)
    try {
      const crawlPromises: Promise<FinalCrawledPost[]>[] = [
        crawlNaverFinal(keyword).catch(() => [] as FinalCrawledPost[]),
        crawlRSSFinal(keyword).catch(() => [] as FinalCrawledPost[]),
        crawlTistory(keyword).catch(() => [] as FinalCrawledPost[]),
        crawlWordPress(keyword).catch(() => [] as FinalCrawledPost[]),
        crawlNews(keyword).catch(() => [] as FinalCrawledPost[]),
        crawlCafe(keyword).catch(() => [] as FinalCrawledPost[]),
      ];

      // 전체 타임아웃 30초
      const timeoutPromise = new Promise<FinalCrawledPost[][]>((resolve) => {
        setTimeout(() => resolve([[], [], [], [], [], []]), 30000);
      });

      const results = await Promise.race([Promise.all(crawlPromises), timeoutPromise]);
      const naverPosts = results[0] || [];
      const rssPosts = results[1] || [];
      const tistoryPosts = results[2] || [];
      const wordpressPosts = results[3] || [];
      const newsPosts = results[4] || [];
      const cafePosts = results[5] || [];

      // 🔥 뉴스를 최우선으로! (최신 정보 기반 콘텐츠 생성)
      const newsWithContent = newsPosts.filter(p => p.content.length > 100);
      const newsWithoutContent = newsPosts.filter(p => p.content.length <= 100);

      const basicPosts = [
        ...newsWithContent,     // 1순위: 본문이 있는 뉴스
        ...newsWithoutContent,  // 2순위: 제목만 있는 뉴스
        ...naverPosts,
        ...rssPosts,
        ...tistoryPosts,
        ...wordpressPosts,
        ...cafePosts,
      ];

      // 기존 결과와 병합 (뉴스 우선)
      allPosts = [...basicPosts, ...allPosts];

      console.log(`✅ [크롤링] ${retryCount}차 수집: ${basicPosts.length}개 (총: ${allPosts.length}개)`);
      console.log(`   - 네이버: ${naverPosts.length}`);
      console.log(`   - RSS: ${rssPosts.length}`);
      console.log(`   - 티스토리: ${tistoryPosts.length}`);
      console.log(`   - 워드프레스: ${wordpressPosts.length}`);
      console.log(`   - 뉴스: ${newsPosts.length}`);
      console.log(`   - 카페: ${cafePosts.length}\n`);

    } catch (error) {
      console.error(`❌ [크롤링] ${retryCount}차 실패:`, error);
    }

    // 부족하면 잠시 대기 후 재시도
    if (allPosts.length < 5 && retryCount < maxRetries) {
      console.log(`⏳ [크롤링] 결과 부족 (${allPosts.length}개), 2초 후 재시도...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 🚨 크롤링 완전 실패 - 더 구체적인 오류 메시지
  if (allPosts.length === 0) {
    console.error('\n❌ [크롤링 실패] 모든 크롤링 소스에서 데이터를 수집하지 못했습니다.\n');
    console.error('📌 가능한 원인:');
    console.error('   1. 인터넷 연결 문제');
    console.error('   2. 크롤링 대상 사이트의 일시적 차단');
    console.error('   3. 키워드가 너무 특수하거나 검색 결과가 없음');
    console.error('\n💡 해결 방법:');
    console.error('   1. 인터넷 연결을 확인하세요');
    console.error('   2. 다른 키워드로 시도해 보세요');
    console.error('   3. 잠시 후 다시 시도해 보세요\n');

    // 빈 배열 반환 (상위 함수에서 처리)
    return [];
  }

  // ⚠️ 데이터가 부족하지만 있는 경우 - 경고만 출력하고 계속 진행
  if (allPosts.length < 10) {
    console.warn(`\n⚠️ [경고] 크롤링 데이터가 부족합니다 (${allPosts.length}개). 품질이 다소 낮을 수 있습니다.\n`);
  }

  // 2차: 상위 20개 상세 크롤링
  const topPosts = allPosts
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, FINAL_CONFIG.DETAIL_CRAWL);

  console.log(`📄 [크롤링] 2차 상세: ${topPosts.length}개\n`);

  // 병렬 처리 (5개씩) - 개별 타임아웃
  for (let i = 0; i < topPosts.length; i += FINAL_CONFIG.PARALLEL_LIMIT) {
    const batch = topPosts.slice(i, i + FINAL_CONFIG.PARALLEL_LIMIT);
    await Promise.all(batch.map(post =>
      Promise.race([
        crawlFullContentFinal(post),
        new Promise(resolve => setTimeout(resolve, FINAL_CONFIG.CRAWL_TIMEOUT))
      ])
    ));
  }

  // 콘텐츠가 있는 포스트 필터링 (기준 완화: 50자 이상)
  let crawledPosts = topPosts.filter(p => p.content.length > 50);

  // 콘텐츠가 없어도 제목/URL이 있으면 사용
  if (crawledPosts.length < 5) {
    crawledPosts = topPosts.filter(p => p.title && p.title.length > 3);
  }

  const endTime = Date.now();
  console.log(`✅ [크롤링] 완료! (${((endTime - startTime) / 1000).toFixed(1)}초)`);
  console.log(`   - 최종: ${crawledPosts.length}개\n`);

  return crawledPosts;
}
