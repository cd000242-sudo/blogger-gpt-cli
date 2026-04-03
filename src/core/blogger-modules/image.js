/**
 * Blogger Publisher - Image Module
 * 이미지 업로드 및 처리를 담당하는 모듈
 */

const { Readable } = require('stream');
const { logDetailedError } = require('./error-handler');

/**
 * Data URL 썸네일 업로드 (Base64 이미지)
 * @param {Object} bloggerClient - Blogger API 클라이언트
 * @param {string} blogId - 블로그 ID
 * @param {string} dataUrl - Data URL (data:image/...)
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Promise<string|null>} - 업로드된 이미지 URL 또는 null
 */
async function uploadDataUrlThumbnail(bloggerClient, blogId, dataUrl, onLog) {
  // blogId 검증
  if (!blogId || typeof blogId === 'undefined' || blogId === null) {
    onLog?.('⚠️ uploadDataUrlThumbnail: blogId가 정의되지 않았습니다.');
    return null;
  }
  
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }
  
  // bloggerClient 검증
  if (!bloggerClient) {
    onLog?.('⚠️ uploadDataUrlThumbnail: bloggerClient가 정의되지 않았습니다.');
    return null;
  }
  
  // media.insert 메서드 존재 확인
  if (!bloggerClient.media || typeof bloggerClient.media.insert !== 'function') {
    onLog?.('⚠️ uploadDataUrlThumbnail: bloggerClient.media.insert 메서드를 사용할 수 없습니다. Blogger API v3에는 media.insert가 없을 수 있습니다.');
    return null;
  }
  
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const base64Data = match[2];

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const stream = Readable.from(buffer);
    
    // blogId를 명시적으로 문자열로 변환
    const blogIdString = String(blogId).trim();
    if (!blogIdString) {
      onLog?.('⚠️ uploadDataUrlThumbnail: blogId가 비어있습니다.');
      return null;
    }

    console.log(`[IMAGE] [이미지 업로드] data:image 썸네일 업로드 시작...`);
    console.log(`[IMAGE]    - MIME 타입: ${mimeType}`);
    console.log(`[IMAGE]    - 이미지 크기: ${(buffer.length / 1024).toFixed(2)}KB`);
    console.log(`[IMAGE]    - Blog ID: ${blogIdString}`);
    
    const uploadResponse = await bloggerClient.media.insert({
      blogId: blogIdString,
      resource: {
        kind: 'blogger#media'
      },
      media: {
        mimeType,
        body: stream
      }
    });

    const uploadedUrl = uploadResponse?.data?.url || uploadResponse?.data?.imageUrl || uploadResponse?.data?.selfLink || null;
    if (uploadedUrl) {
      console.log(`[IMAGE] ✅ [이미지 업로드] 썸네일 업로드 성공: ${uploadedUrl.substring(0, 100)}...`);
      onLog?.('🖼️ 썸네일 이미지를 Blogger에 업로드했습니다.');
    } else {
      console.error(`[IMAGE] ❌ [이미지 업로드] 썸네일 업로드 응답에 URL이 없습니다.`);
      console.error(`[IMAGE]    - 응답 데이터:`, uploadResponse?.data ? JSON.stringify(uploadResponse.data).substring(0, 200) : '없음');
      onLog?.('⚠️ 썸네일 업로드 응답에 URL이 없습니다. 데이터 URL을 그대로 사용합니다.');
    }
    return uploadedUrl;
  } catch (error) {
    logDetailedError('IMAGE', error, {
      'Blog ID': blogIdString,
      'MIME 타입': mimeType
    });
    onLog?.(`⚠️ 썸네일 업로드 실패: ${error?.message || error}`);
    return null;
  }
}

/**
 * 외부 이미지 업로드 (URL -> Blogger 재호스팅)
 * @param {Object} bloggerClient - Blogger API 클라이언트
 * @param {string} blogId - 블로그 ID
 * @param {string} imageUrl - 외부 이미지 URL
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Promise<string|null>} - 업로드된 이미지 URL 또는 null
 */
async function uploadExternalImage(bloggerClient, blogId, imageUrl, onLog) {
  try {
    if (!imageUrl || /^data:/i.test(imageUrl)) {
      console.log(`[IMAGE] [외부 이미지] 업로드 건너뜀: data:image 또는 URL 없음`);
      return null;
    }
    
    console.log(`[IMAGE] [외부 이미지] 외부 이미지 업로드 시작: ${imageUrl.substring(0, 100)}...`);
    
    // bloggerClient 검증
    if (!bloggerClient) {
      console.error(`[IMAGE] ❌ [외부 이미지] bloggerClient가 정의되지 않았습니다.`);
      onLog?.('⚠️ uploadExternalImage: bloggerClient가 정의되지 않았습니다.');
      return null;
    }
    
    // media.insert 메서드 존재 확인
    if (!bloggerClient.media || typeof bloggerClient.media.insert !== 'function') {
      console.log(`[PUBLISH] ℹ️ Blogger API에 media.insert 없음 → 외부 URL 직접 사용`);
      return imageUrl; // 🔥 null 대신 원본 URL 반환
    }
    
    console.log(`[IMAGE] [외부 이미지] 이미지 다운로드 시도: ${imageUrl.substring(0, 100)}...`);
    const res = await fetch(imageUrl, { method: 'GET' });
    if (!res.ok) {
      console.error(`[IMAGE] ❌ [외부 이미지] 이미지 다운로드 실패: HTTP ${res.status} ${res.statusText}`);
      console.error(`[IMAGE]    - URL: ${imageUrl.substring(0, 150)}`);
      onLog?.(`⚠️ 외부 이미지 다운로드 실패: ${res.status}`);
      return null;
    }
    
    console.log(`[IMAGE] ✅ [외부 이미지] 이미지 다운로드 성공: ${res.headers.get('content-type') || '알 수 없음'}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);
    const blogIdString = String(blogId).trim();
    
    console.log(`[IMAGE] [외부 이미지] Blogger 업로드 시작 (크기: ${(buffer.length / 1024).toFixed(2)}KB, 타입: ${contentType})`);
    const uploadResponse = await bloggerClient.media.insert({
      blogId: blogIdString,
      resource: { kind: 'blogger#media' },
      media: { mimeType: contentType, body: stream }
    });
    
    const uploadedUrl = uploadResponse?.data?.url || uploadResponse?.data?.imageUrl || uploadResponse?.data?.selfLink || null;
    if (uploadedUrl) {
      console.log(`[IMAGE] ✅ [외부 이미지] 재호스팅 성공: ${uploadedUrl.substring(0, 100)}...`);
      onLog?.('🖼️ 외부 이미지를 Blogger에 재호스팅했습니다.');
    } else {
      console.error(`[IMAGE] ❌ [외부 이미지] 업로드 응답에 URL이 없습니다.`);
      console.error(`[IMAGE]    - 응답 데이터:`, uploadResponse?.data ? JSON.stringify(uploadResponse.data).substring(0, 200) : '없음');
    }
    return uploadedUrl;
  } catch (e) {
    logDetailedError('IMAGE', e, {
      '원본 URL': imageUrl.substring(0, 150)
    });
    onLog?.(`⚠️ 외부 이미지 재호스팅 실패: ${e?.message || e}`);
    return null;
  }
}

/**
 * HTML 내의 이미지 URL 처리 (재호스팅)
 * @param {string} html - HTML 문자열
 * @param {Object} bloggerClient - Blogger API 클라이언트
 * @param {string} blogId - 블로그 ID
 * @param {Function} onLog - 로그 콜백 함수
 * @returns {Promise<string>} - 처리된 HTML
 */
async function processImagesInHtml(html, bloggerClient, blogId, onLog) {
  if (!html) return html;
  
  try {
    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    const matches = [...html.matchAll(imgRegex)];
    
    if (matches.length === 0) {
      console.log('[IMAGE] HTML에 이미지가 없습니다.');
      return html;
    }
    
    console.log(`[IMAGE] HTML에서 ${matches.length}개의 이미지 발견`);
    let processedHtml = html;
    
    for (const match of matches) {
      const originalUrl = match[1];
      
      // 이미 Blogger에 호스팅된 이미지는 건너뛰기
      if (originalUrl.includes('blogger.googleusercontent.com') || 
          originalUrl.includes('blogspot.com')) {
        continue;
      }
      
      // data: URL 처리
      if (originalUrl.startsWith('data:')) {
        const newUrl = await uploadDataUrlThumbnail(bloggerClient, blogId, originalUrl, onLog);
        if (newUrl) {
          processedHtml = processedHtml.replace(originalUrl, newUrl);
        }
      }
      // 외부 URL 처리
      else if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
        const newUrl = await uploadExternalImage(bloggerClient, blogId, originalUrl, onLog);
        if (newUrl) {
          processedHtml = processedHtml.replace(originalUrl, newUrl);
        }
      }
    }
    
    return processedHtml;
  } catch (error) {
    console.error('[IMAGE] HTML 이미지 처리 중 오류:', error);
    return html;
  }
}

module.exports = {
  uploadDataUrlThumbnail,
  uploadExternalImage,
  processImagesInHtml
};





