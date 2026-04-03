/**
 * 이미지 호스팅 업로드 및 쇼핑 크롤러 동적 임포트
 */

import axios from 'axios';

// 🔥 Base64 이미지를 이미지 호스팅에 업로드하여 URL로 변환
export async function uploadBase64ToImageHost(base64Data: string, name?: string): Promise<string | null> {
  // data:image/... 접두어 제거
  const base64Only = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  // 1️⃣ freeimage.host 시도 (API 키 불필요, 안정적)
  try {
    const formData = new URLSearchParams();
    formData.append('source', base64Only);
    formData.append('type', 'base64');
    formData.append('action', 'upload');
    formData.append('format', 'json');

    const response = await axios.post(
      'https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5', // 공개 키
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    );

    if (response.data?.image?.url) {
      console.log(`[FREEIMAGE] ✅ 업로드 성공: ${response.data.image.url.substring(0, 50)}...`);
      return response.data.image.url;
    }
  } catch (error: any) {
    console.warn(`[FREEIMAGE] ⚠️ 실패: ${error.message}`);
  }

  // 2️⃣ imgBB 폴백
  try {
    const formData = new URLSearchParams();
    formData.append('image', base64Only);
    if (name) formData.append('name', name);

    const response = await axios.post(
      'https://api.imgbb.com/1/upload?key=c90ff2f6127c1c1f53a91a2a8f9a7b9f',
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    );

    if (response.data?.success && response.data?.data?.url) {
      console.log(`[IMGBB] ✅ 업로드 성공: ${response.data.data.url.substring(0, 50)}...`);
      return response.data.data.url;
    }
  } catch (error: any) {
    console.warn(`[IMGBB] ⚠️ 실패: ${error.message}`);
  }

  return null;
}

// 🛒 쇼핑 크롤러 동적 임포트 (Puppeteer 기반)
let ShoppingCrawlerClass: any = null;
export async function getShoppingCrawler() {
  if (!ShoppingCrawlerClass) {
    // 여러 경로 시도
    const possiblePaths = [
      '../utils/shopping-crawler',
      '../../utils/shopping-crawler',
      './utils/shopping-crawler',
      '../../src/utils/shopping-crawler',
    ];

    for (const path of possiblePaths) {
      try {
        const module = require(path);
        ShoppingCrawlerClass = module.ShoppingCrawler;
        console.log(`[SHOPPING] ✅ ShoppingCrawler 로드 성공: ${path}`);
        break;
      } catch (e) {
        continue;
      }
    }

    if (!ShoppingCrawlerClass) {
      console.warn('[SHOPPING] ⚠️ ShoppingCrawler 로드 실패 (스마트 폴백 사용)');
      return null;
    }
  }
  return new ShoppingCrawlerClass();
}
