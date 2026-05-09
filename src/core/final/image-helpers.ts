/**
 * 이미지 호스팅 업로드 및 쇼핑 크롤러 동적 임포트
 *
 * 폴백 체인 (순서대로 시도):
 *  1. Cloudinary   — 사용자 env키 있으면 최우선 (25GB/월, 영구, CDN)
 *  2. ImgBB        — 공유 키 fallback, 32MB 한도, 영구 보존
 *  3. ImgHippo     — 무료 무제한 표방, API key 불필요
 *  4. freeimage.host — 공유 키, 가끔 불안정
 *  5. Catbox.moe   — 200MB, 익명 업로드, hotlink OK (상업적 사용 불가 주의)
 *  6. 0x0.st       — 30일~1년 자동 만료 (크기 의존), 임시 폴백
 *  모두 실패 → null 반환 (호출부가 base64 그대로 사용 → Blogger 400 위험)
 */

import axios from 'axios';

// ─── 업로더 내부 헬퍼 ────────────────────────────────────────────────────────

/** base64 문자열을 Buffer로 변환하여 바이트 크기 확인 */
function base64ByteSize(base64Only: string): number {
  return Math.ceil(base64Only.length * 0.75);
}

/** 1. Cloudinary (사용자 자체 키 — env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET) */
async function tryCloudinary(base64Data: string): Promise<string | null> {
  const cloudName = process.env['CLOUDINARY_CLOUD_NAME'];
  const uploadPreset = process.env['CLOUDINARY_UPLOAD_PRESET'];
  if (!cloudName || !uploadPreset) return null;

  try {
    const formData = new URLSearchParams();
    formData.append('file', base64Data);          // data:image/... 포함 그대로
    formData.append('upload_preset', uploadPreset);

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 40000
      }
    );

    if (response.data?.secure_url) {
      console.log(`[CLOUDINARY] ✅ 업로드 성공: ${response.data.secure_url.substring(0, 60)}...`);
      return response.data.secure_url;
    }
  } catch (error: any) {
    console.warn(`[CLOUDINARY] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

/** 2. ImgBB (사용자 env키 우선, 없으면 공유 키 폴백) */
async function tryImgBB(base64Only: string, name?: string): Promise<string | null> {
  const apiKey = process.env['IMGBB_API_KEY'] || 'c90ff2f6127c1c1f53a91a2a8f9a7b9f';
  // 32 MB 한도 체크
  if (base64ByteSize(base64Only) > 32 * 1024 * 1024) {
    console.warn('[IMGBB] ⚠️ 파일 크기 32MB 초과 → 건너뜀');
    return null;
  }

  try {
    const formData = new URLSearchParams();
    formData.append('image', base64Only);
    if (name) formData.append('name', name);

    const response = await axios.post(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    );

    if (response.data?.success && response.data?.data?.url) {
      console.log(`[IMGBB] ✅ 업로드 성공: ${response.data.data.url.substring(0, 60)}...`);
      return response.data.data.url;
    }
  } catch (error: any) {
    console.warn(`[IMGBB] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

/** 3. ImgHippo (무료, API key 필요, env: IMGHIPPO_API_KEY) */
async function tryImgHippo(base64Only: string, name?: string): Promise<string | null> {
  const apiKey = process.env['IMGHIPPO_API_KEY'];
  if (!apiKey) return null;

  try {
    // ImgHippo는 multipart/form-data로 base64 문자열 전송
    const formData = new URLSearchParams();
    formData.append('api_key', apiKey);
    formData.append('file', base64Only);
    if (name) formData.append('title', name);

    const response = await axios.post(
      'https://api.imghippo.com/v1/upload',
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      }
    );

    const url = response.data?.data?.view_url || response.data?.data?.url;
    if (url) {
      console.log(`[IMGHIPPO] ✅ 업로드 성공: ${url.substring(0, 60)}...`);
      return url;
    }
  } catch (error: any) {
    console.warn(`[IMGHIPPO] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

/** 4. freeimage.host (공유 키, 불안정 가능) */
async function tryFreeImageHost(base64Only: string): Promise<string | null> {
  try {
    const formData = new URLSearchParams();
    formData.append('source', base64Only);
    formData.append('type', 'base64');
    formData.append('action', 'upload');
    formData.append('format', 'json');

    const response = await axios.post(
      'https://freeimage.host/api/1/upload?key=6d207e02198a847aa98d0a2a901485a5',
      formData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000
      }
    );

    if (response.data?.image?.url) {
      console.log(`[FREEIMAGE] ✅ 업로드 성공: ${response.data.image.url.substring(0, 60)}...`);
      return response.data.image.url;
    }
  } catch (error: any) {
    console.warn(`[FREEIMAGE] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

/** 5. Catbox.moe (익명, hotlink OK, 200MB 한도, 상업적 사용 불가) */
async function tryCatbox(base64Only: string, mimeType: string): Promise<string | null> {
  try {
    // Catbox는 파일 바이너리 업로드 → base64 → Buffer 변환
    const buffer = Buffer.from(base64Only, 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `image_${Date.now()}.${ext}`;

    // FormData (multipart) 구성 — axios에서 직접 사용
    const { default: FormData } = await import('form-data');
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', buffer, { filename, contentType: mimeType });

    const response = await axios.post('https://catbox.moe/user/api.php', form, {
      headers: form.getHeaders(),
      timeout: 35000,
      maxBodyLength: 200 * 1024 * 1024
    });

    if (response.data && typeof response.data === 'string' && response.data.startsWith('https://')) {
      const url = response.data.trim();
      console.log(`[CATBOX] ✅ 업로드 성공: ${url.substring(0, 60)}...`);
      return url;
    }
  } catch (error: any) {
    console.warn(`[CATBOX] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

/** 6. 0x0.st (임시 보존 30일~1년, 최후 폴백) */
async function try0x0(base64Only: string, mimeType: string): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64Only, 'base64');
    const ext = mimeType.split('/')[1] || 'png';
    const filename = `image_${Date.now()}.${ext}`;

    const { default: FormData } = await import('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: mimeType });

    const response = await axios.post('https://0x0.st', form, {
      headers: form.getHeaders(),
      timeout: 30000
    });

    if (response.data && typeof response.data === 'string' && response.data.startsWith('https://')) {
      const url = response.data.trim();
      console.warn(`[0X0] ⚠️ 임시 URL (30일~1년 후 만료): ${url.substring(0, 60)}...`);
      return url;
    }
  } catch (error: any) {
    console.warn(`[0X0] ⚠️ 실패: ${error.message}`);
  }
  return null;
}

// ─── 공개 API ────────────────────────────────────────────────────────────────

/**
 * Base64 이미지를 외부 이미지 호스팅에 업로드하여 HTTPS URL을 반환.
 * 6단계 폴백 체인을 순서대로 시도한다.
 * 모두 실패하면 null 반환 → 호출부에서 base64 그대로 사용은 Blogger 400 원인이 됨.
 *
 * 환경 변수 (선택):
 *   CLOUDINARY_CLOUD_NAME    — Cloudinary cloud name
 *   CLOUDINARY_UPLOAD_PRESET — Cloudinary unsigned upload preset
 *   IMGBB_API_KEY            — 개인 ImgBB 키 (공유 키 대신 사용)
 *   IMGHIPPO_API_KEY         — ImgHippo API 키
 */
export async function uploadBase64ToImageHost(base64Data: string, name?: string): Promise<string | null> {
  // MIME 타입 추출 (없으면 image/png 기본값)
  const mimeMatch = base64Data.match(/^data:(image\/[a-z+]+);base64,/);
  const mimeType = mimeMatch?.[1] ?? 'image/png';
  const base64Only = base64Data.replace(/^data:image\/[a-z+]+;base64,/, '');

  // 1. Cloudinary (사용자 env키)
  const cloudinaryUrl = await tryCloudinary(base64Data);
  if (cloudinaryUrl) return cloudinaryUrl;

  // 2. ImgBB
  const imgbbUrl = await tryImgBB(base64Only, name);
  if (imgbbUrl) return imgbbUrl;

  // 3. ImgHippo (env키 있을 때)
  const imghippoUrl = await tryImgHippo(base64Only, name);
  if (imghippoUrl) return imghippoUrl;

  // 4. freeimage.host
  const freeimageUrl = await tryFreeImageHost(base64Only);
  if (freeimageUrl) return freeimageUrl;

  // 5. Catbox.moe
  const catboxUrl = await tryCatbox(base64Only, mimeType);
  if (catboxUrl) return catboxUrl;

  // 6. 0x0.st (임시 보존, 최후 수단)
  const x0Url = await try0x0(base64Only, mimeType);
  if (x0Url) return x0Url;

  console.error('[IMAGE-HOST] ❌ 모든 호스팅 실패 — base64 그대로 반환 시 Blogger 400 발생 위험');
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
