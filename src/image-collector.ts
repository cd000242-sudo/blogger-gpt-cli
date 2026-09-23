/**
 * 반자동 모드 이미지 수집 — 제목·소제목으로 네이버 이미지/쇼핑을 검색하거나 쇼핑몰 URL 에서 상품 이미지를 뽑아
 * userData/collected-images/날짜_키워드 폴더에 저장한다. (electron/main.ts 의 collect-images-* · get-image-folders ·
 * get-folder-images · delete-image-folder 핸들러가 부른다)
 *
 * 2026-09-23 원본 복원: 이 파일은 저장소에 한 번도 없었고 4월 3일 빌드 산출물(dist/image-collector.js)만 남아 있었다.
 * 6월에 맥 빌드를 살리려고 그 산출물을 커밋해 왔다. 여기 코드는 그 산출물을 그대로 되살린 것이라
 * 빌드하면 출시본과 같은 dist/image-collector.js 가 나온다. 동작을 바꾸려면 이 파일을 고친다.
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

export interface CollectedImage {
  url: string;
  title: string;
  source: 'naver-image' | 'naver-shopping' | 'shopping-crawl' | 'coupang' | 'gmarket' | '11st';
  keyword: string;
  localPath?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  relevanceScore?: number | undefined;
}

export interface ImageCollectionResult {
  ok: boolean;
  images: CollectedImage[];
  folderPath: string;
  error?: string;
}

export interface SubtopicImageMatch {
  subtopic: string;
  images: CollectedImage[];
  selectedImage?: CollectedImage | undefined;
}

/** 수집 이미지 저장 위치 — Electron 밖(테스트·CLI)에서는 APPDATA/HOME 아래 */
function getImageStoragePath(): string {
  let basePath: string;
  try {
    basePath = app.getPath('userData');
  } catch {
    basePath = process.env['APPDATA'] || process.env['HOME'] || '.';
    basePath = path.join(basePath, 'blogger-gpt-cli');
  }
  const imagePath = path.join(basePath, 'collected-images');
  if (!fs.existsSync(imagePath)) {
    fs.mkdirSync(imagePath, { recursive: true });
  }
  return imagePath;
}

/** 날짜_키워드 폴더 (파일명에 못 쓰는 글자는 _, 키워드는 50자까지) */
function createKeywordFolder(keyword: string): string {
  const basePath = getImageStoragePath();
  const sanitizedKeyword = keyword.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `${timestamp}_${sanitizedKeyword}`;
  const folderPath = path.join(basePath, folderName);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}

/** 이미지 한 장을 받아 저장한다. 확장자는 응답 형식을 따른다. 실패하면 null */
async function downloadImage(url: string, folderPath: string, filename: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://search.naver.com/'
      }
    });
    const contentType = (response.headers['content-type'] as string) || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('gif')) ext = '.gif';
    else if (contentType.includes('webp')) ext = '.webp';
    const sanitizedFilename = filename.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
    const filePath = path.join(folderPath, `${sanitizedFilename}${ext}`);
    fs.writeFileSync(filePath, response.data);
    console.log(`[IMAGE-COLLECTOR] ✅ 저장: ${filePath}`);
    return filePath;
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 다운로드 실패: ${url}`, error.message);
    return null;
  }
}

/** 네이버 이미지 검색 API. 실패하면 빈 목록 */
export async function searchNaverImages(
  keyword: string,
  clientId: string,
  clientSecret: string,
  options: {
    display?: number;
    filter?: 'all' | 'large' | 'medium' | 'small';
    sort?: 'sim' | 'date';
  } = {}
): Promise<CollectedImage[]> {
  const { display = 20, filter = 'large', sort = 'sim' } = options;
  try {
    console.log(`[IMAGE-COLLECTOR] 🔍 네이버 이미지 검색: ${keyword}`);
    const response = await axios.get('https://openapi.naver.com/v1/search/image', {
      params: {
        query: keyword,
        display,
        filter,
        sort
      },
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      timeout: 10000
    });
    const items = response.data.items || [];
    console.log(`[IMAGE-COLLECTOR] ✅ ${items.length}개 이미지 발견`);
    return items.map((item: any, index: number) => ({
      url: item.link,
      title: item.title?.replace(/<[^>]*>/g, '') || `이미지_${index + 1}`,
      source: 'naver-image',
      keyword,
      width: item.sizewidth ? parseInt(item.sizewidth) : undefined,
      height: item.sizeheight ? parseInt(item.sizeheight) : undefined
    }));
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 네이버 이미지 검색 실패:`, error.message);
    return [];
  }
}

/** 네이버 쇼핑 검색 API — 검색 순위가 곧 점수(100, 98, 96 …). 실패하면 빈 목록 */
export async function searchNaverShopping(
  keyword: string,
  clientId: string,
  clientSecret: string,
  options: {
    display?: number;
    sort?: 'sim' | 'date' | 'asc' | 'dsc';
  } = {}
): Promise<CollectedImage[]> {
  const { display = 20, sort = 'sim' } = options;
  try {
    console.log(`[IMAGE-COLLECTOR] 🛒 네이버 쇼핑 검색: ${keyword}`);
    const response = await axios.get('https://openapi.naver.com/v1/search/shop', {
      params: {
        query: keyword,
        display,
        sort
      },
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      },
      timeout: 10000
    });
    const items = response.data.items || [];
    console.log(`[IMAGE-COLLECTOR] ✅ ${items.length}개 상품 발견`);
    return items.map((item: any, index: number) => ({
      url: item.image,
      title: item.title?.replace(/<[^>]*>/g, '') || `상품_${index + 1}`,
      source: 'naver-shopping',
      keyword,
      relevanceScore: 100 - index * 2
    }));
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 네이버 쇼핑 검색 실패:`, error.message);
    return [];
  }
}

/**
 * 쇼핑몰 상품 페이지에서 이미지를 뽑는다. og:image 를 대표로 맨 앞에 두고,
 * 아이콘·로고·배너·100px 미만·중복·이미지 확장자 없는 주소는 뺀다. 실패하면 빈 목록
 */
export async function crawlShoppingUrl(url: string): Promise<CollectedImage[]> {
  try {
    console.log(`[IMAGE-COLLECTOR] 🌐 쇼핑몰 크롤링: ${url}`);
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    const $ = cheerio.load(response.data);
    const images: CollectedImage[] = [];
    const seenUrls = new Set<string>();

    let source: CollectedImage['source'] = 'shopping-crawl';
    if (url.includes('coupang.com')) source = 'coupang';
    else if (url.includes('gmarket.co.kr')) source = 'gmarket';
    else if (url.includes('11st.co.kr')) source = '11st';

    // "상품명 - 쇼핑몰 | 부제" → 상품명
    let productTitle = $('title').text().trim() || '상품';
    const parts1 = productTitle.split('-');
    const parts2 = (parts1[0] || productTitle).split('|');
    productTitle = (parts2[0] || productTitle).trim();

    const imageSelectors = [
      'img[src*="product"]',
      'img[src*="goods"]',
      'img[src*="item"]',
      '.product-image img',
      '.goods-image img',
      '.item-image img',
      '.thumbnail img',
      '.prod-image img',
      '.prod-image__item img',
      '[data-image-source]',
      '.box__item-img img',
      '.box__image img',
      '.c_product_img img',
      '.img_full img',
      '#productImage img',
      '.detail-image img',
      '.main-image img',
      '[class*="product"] img',
      '[class*="goods"] img'
    ];

    imageSelectors.forEach(selector => {
      $(selector).each((_, el) => {
        let imgUrl = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
        if (!imgUrl) return;

        if (imgUrl.startsWith('//')) {
          imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/')) {
          const urlObj = new URL(url);
          imgUrl = urlObj.origin + imgUrl;
        }

        if (!imgUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) return;
        if (imgUrl.includes('icon') || imgUrl.includes('logo') || imgUrl.includes('banner')) return;
        if (seenUrls.has(imgUrl)) return;

        const width = parseInt($(el).attr('width') || '0');
        const height = parseInt($(el).attr('height') || '0');
        if (width > 0 && width < 100) return;
        if (height > 0 && height < 100) return;

        seenUrls.add(imgUrl);
        const imgData: CollectedImage = {
          url: imgUrl,
          title: $(el).attr('alt') || productTitle,
          source,
          keyword: productTitle
        };
        if (width > 0) imgData.width = width;
        if (height > 0) imgData.height = height;
        images.push(imgData);
      });
    });

    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage && !seenUrls.has(ogImage)) {
      images.unshift({
        url: ogImage,
        title: productTitle + ' (대표)',
        source,
        keyword: productTitle,
        relevanceScore: 100
      });
    }

    console.log(`[IMAGE-COLLECTOR] ✅ ${images.length}개 이미지 추출`);
    return images;
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 쇼핑몰 크롤링 실패:`, error.message);
    return [];
  }
}

/**
 * 소제목마다 이미지 점수를 매겨 상위 5장과 1장(선택)을 고른다.
 * 기본 점수(없으면 50) + 제목에 소제목 단어 20 · 검색어에 15 · 가로 800↑ 10 · 세로 600↑ 10 · 네이버쇼핑/쿠팡 5
 */
export function matchImagesToSubtopics(subtopics: string[], images: CollectedImage[]): SubtopicImageMatch[] {
  console.log(`[IMAGE-COLLECTOR] 🎯 ${subtopics.length}개 소제목에 이미지 매칭 중...`);
  return subtopics.map(subtopic => {
    const keywords = subtopic
      .replace(/[^가-힣a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(k => k.length >= 2);

    const scoredImages = images.map(img => {
      let score = img.relevanceScore || 50;
      keywords.forEach(keyword => {
        if (img.title.includes(keyword)) score += 20;
        if (img.keyword.includes(keyword)) score += 15;
      });
      if (img.width && img.width >= 800) score += 10;
      if (img.height && img.height >= 600) score += 10;
      if (img.source === 'naver-shopping') score += 5;
      if (img.source === 'coupang') score += 5;
      return { ...img, relevanceScore: score };
    });

    scoredImages.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    const top5 = scoredImages.slice(0, 5);
    const firstImage = scoredImages[0];
    const result: SubtopicImageMatch = {
      subtopic,
      images: top5,
      selectedImage: firstImage
    };
    return result;
  });
}

/** 제목·쇼핑·소제목(앞 5개)으로 검색해 소제목마다 한 장씩 고르고, 원하면 폴더에 저장한다 */
export async function collectImagesByTitle(
  title: string,
  subtopics: string[],
  naverClientId: string,
  naverClientSecret: string,
  options: {
    saveToFolder?: boolean;
    maxImagesPerSubtopic?: number;
    includeShoppingImages?: boolean;
  } = {}
): Promise<ImageCollectionResult> {
  const { saveToFolder = true, maxImagesPerSubtopic = 3, includeShoppingImages = true } = options;
  console.log(`[IMAGE-COLLECTOR] 🚀 AI 이미지 자동 수집 시작: ${title}`);
  console.log(`[IMAGE-COLLECTOR] 📋 소제목 ${subtopics.length}개`);

  const allImages: CollectedImage[] = [];
  const folderPath = saveToFolder ? createKeywordFolder(title) : '';

  try {
    const mainImages = await searchNaverImages(title, naverClientId, naverClientSecret, {
      display: 30,
      filter: 'large'
    });
    allImages.push(...mainImages);

    if (includeShoppingImages) {
      const shoppingImages = await searchNaverShopping(title, naverClientId, naverClientSecret, {
        display: 20
      });
      allImages.push(...shoppingImages);
    }

    for (const subtopic of subtopics.slice(0, 5)) {
      const cleanSubtopic = subtopic.replace(/^\d+\.\s*/, '').replace(/[?!]/g, '');
      const subtopicImages = await searchNaverImages(cleanSubtopic, naverClientId, naverClientSecret, {
        display: 10,
        filter: 'large'
      });
      subtopicImages.forEach(img => {
        img.keyword = cleanSubtopic;
      });
      allImages.push(...subtopicImages);
      // 네이버 API 속도 제한 여유
      await new Promise(r => setTimeout(r, 200));
    }

    const uniqueImages = allImages.filter((img, index, self) => index === self.findIndex(i => i.url === img.url));
    console.log(`[IMAGE-COLLECTOR] 📸 총 ${uniqueImages.length}개 고유 이미지 수집`);

    const matches = matchImagesToSubtopics(subtopics, uniqueImages);

    if (saveToFolder && folderPath) {
      console.log(`[IMAGE-COLLECTOR] 💾 이미지 저장 시작: ${folderPath}`);
      let downloadCount = 0;
      for (const match of matches) {
        const imagesToSave = match.images.slice(0, maxImagesPerSubtopic);
        for (let i = 0; i < imagesToSave.length; i++) {
          const img = imagesToSave[i];
          if (!img) continue;
          const filename = `${match.subtopic.substring(0, 30)}_${i + 1}`;
          const localPath = await downloadImage(img.url, folderPath, filename);
          if (localPath) {
            img.localPath = localPath;
            downloadCount++;
          }
        }
      }
      console.log(`[IMAGE-COLLECTOR] ✅ ${downloadCount}개 이미지 저장 완료`);
    }

    const selectedImages = matches
      .filter((m): m is SubtopicImageMatch & { selectedImage: CollectedImage } => m.selectedImage !== undefined)
      .map(m => m.selectedImage);

    return {
      ok: true,
      images: selectedImages,
      folderPath
    };
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 수집 실패:`, error.message);
    return {
      ok: false,
      images: [],
      folderPath,
      error: error.message
    };
  }
}

/** 쇼핑몰 URL 의 상품 이미지를 모아(최대 maxImages 장) 소제목에 맞추고, 원하면 폴더에 저장한다 */
export async function collectImagesFromShoppingUrl(
  shoppingUrl: string,
  subtopics: string[],
  options: {
    saveToFolder?: boolean;
    maxImages?: number;
  } = {}
): Promise<ImageCollectionResult> {
  const { saveToFolder = true, maxImages = 20 } = options;
  console.log(`[IMAGE-COLLECTOR] 🛍️ 쇼핑몰 URL 이미지 수집: ${shoppingUrl}`);

  try {
    const crawledImages = await crawlShoppingUrl(shoppingUrl);
    if (crawledImages.length === 0) {
      return {
        ok: false,
        images: [],
        folderPath: '',
        error: '이미지를 찾을 수 없습니다'
      };
    }

    const selectedImages = crawledImages.slice(0, maxImages);
    const matches = matchImagesToSubtopics(subtopics, selectedImages);

    let folderPath = '';
    if (saveToFolder) {
      const productName = selectedImages[0]?.title || '상품이미지';
      folderPath = createKeywordFolder(productName);
      console.log(`[IMAGE-COLLECTOR] 💾 이미지 저장: ${folderPath}`);
      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        if (!img) continue;
        const filename = `상품_${i + 1}_${img.title.substring(0, 20)}`;
        const localPath = await downloadImage(img.url, folderPath, filename);
        if (localPath) {
          img.localPath = localPath;
        }
      }
    }

    const matchedImages = matches
      .filter((m): m is SubtopicImageMatch & { selectedImage: CollectedImage } => m.selectedImage !== undefined)
      .map(m => m.selectedImage);

    return {
      ok: true,
      images: matchedImages.length > 0 ? matchedImages : selectedImages,
      folderPath
    };
  } catch (error: any) {
    console.error(`[IMAGE-COLLECTOR] ❌ 쇼핑몰 수집 실패:`, error.message);
    return {
      ok: false,
      images: [],
      folderPath: '',
      error: error.message
    };
  }
}

/** 수집 폴더 목록 — 최신 이름순, 이미지 파일 수 포함 */
export function getImageFolders(): { name: string; path: string; imageCount: number }[] {
  const basePath = getImageStoragePath();
  try {
    const folders = fs.readdirSync(basePath)
      .filter(f => fs.statSync(path.join(basePath, f)).isDirectory())
      .map(f => {
        const folderPath = path.join(basePath, f);
        const images = fs.readdirSync(folderPath)
          .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i));
        return {
          name: f,
          path: folderPath,
          imageCount: images.length
        };
      })
      .sort((a, b) => b.name.localeCompare(a.name));
    return folders;
  } catch {
    return [];
  }
}

/** 폴더 안 이미지 파일 목록 (못 읽으면 빈 목록) */
export function getImagesFromFolder(folderPath: string): { path: string; name: string }[] {
  try {
    const images = fs.readdirSync(folderPath)
      .filter(file => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      .map(file => ({
        path: path.join(folderPath, file),
        name: file
      }));
    return images;
  } catch {
    return [];
  }
}

/** 폴더를 지운다. 지웠으면 true, 없거나 실패하면 false */
export function deleteImageFolder(folderPath: string): boolean {
  try {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
