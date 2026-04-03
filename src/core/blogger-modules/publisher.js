/**
 * Blogger Publisher - Main Publisher Module
 * Blogger API를 사용하여 블로그 포스트를 발행하는 메인 모듈
 */

const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const { OAUTH_CONFIG } = require('./constants');
const {
  checkBloggerAuthStatus,
  clearAuthCache,
  refreshAccessToken,
  saveTokenData
} = require('./auth');
const {
  validateTitle,
  validateHtml,
  validateContentSize,
  preprocessContent,
  determinePostingStatus,
  processLabels
} = require('./content');
const {
  uploadDataUrlThumbnail,
  uploadExternalImage,
  processImagesInHtml
} = require('./image');
const {
  generateBloggerLayoutCSS,
  applyInlineStyles,
  compressCSS,
  injectCSS,
  insertAdBreathingSpace
} = require('./style');
const {
  loadEnvironmentVariables,
  escapeHtmlSpecialChars,
  getTokenFilePath,
  safeJsonParse,
  parseEnvFile
} = require('./utils');
const { diagnoseBloggerError, logDetailedError } = require('./error-handler');

/**
 * Blogger에 블로그 포스트 발행
 * @param {Object} payload - {blogId, googleClientId, googleClientSecret, labels?}
 * @param {string} title - 포스트 제목
 * @param {string} html - 포스트 HTML 콘텐츠
 * @param {string} thumbnailUrl - 썸네일 이미지 URL
 * @param {Function} onLog - 로그 콜백 함수
 * @param {string} postingStatus - 발행 상태 ('publish', 'draft', 'scheduled')
 * @param {Date} scheduleDate - 예약 날짜 (scheduled일 경우)
 * @returns {Promise<Object>} - {ok, postUrl?, postId?, error?, needsAuth?}
 */
async function publishToBlogger(payload, title, html, thumbnailUrl, onLog, postingStatus = 'publish', scheduleDate = null) {
  // 할당량 체크 (선택적)
  try {
    const { checkAndIncrement } = require('../utils/usage-quota.js');
    const quota = checkAndIncrement('publish');
    if (!quota.ok) {
      onLog?.(`❌ ${quota.error}`);
      return { ok: false, error: quota.error };
    }
  } catch (e) {
    // quota 모듈 실패 시 무시하고 진행
  }

  // 제목 검증
  const titleValidation = validateTitle(title);
  if (!titleValidation.ok) {
    onLog?.(`❌ ${titleValidation.error}`);
    return { ok: false, error: titleValidation.error };
  }

  // HTML 콘텐츠 검증
  const htmlValidation = validateHtml(html);
  if (!htmlValidation.ok) {
    onLog?.(`❌ ${htmlValidation.error}`);
    return { ok: false, error: htmlValidation.error };
  }

  // 콘텐츠 크기 검증 및 경고
  const sizeValidation = validateContentSize(html, onLog);

  // 포스팅 상태 로깅
  console.log(`[PUBLISH] publishToBlogger 함수 호출됨`);
  console.log(`[PUBLISH] postingStatus: ${postingStatus}, scheduleDate: ${scheduleDate ? scheduleDate.toISOString() : 'null'}`);
  console.log(`[PUBLISH] title: ${title}`);
  onLog?.(`[PUBLISH] publishToBlogger 함수 호출됨`);
  onLog?.(`[PUBLISH] postingStatus: ${postingStatus}`);
  onLog?.(`[PUBLISH] 제목: ${title}`);

  let blogId = '';
  let clientId = '';
  let clientSecret = '';

  try {
    onLog?.('🔐 Blogger API 인증 중...');

    // 인증 상태 확인
    console.log('[PUBLISH] 인증 상태 확인 시작...');
    const authStatus = await checkBloggerAuthStatus();
    console.log('[PUBLISH] 인증 상태:', authStatus);

    // 인증 실패 처리
    if (!authStatus.authenticated) {
      const errorMsg = authStatus.error || '인증되지 않았습니다.';
      console.error('[PUBLISH] ❌ 블로그스팟 인증 실패:', errorMsg);
      onLog?.(`❌ 블로그스팟 인증 실패: ${errorMsg}`);
      onLog?.('⚠️ 해결 방법:');
      onLog?.('   1. 환경설정 탭으로 이동');
      onLog?.('   2. "Blogger OAuth2 인증" 버튼 클릭');
      onLog?.('   3. Google 계정으로 로그인 및 권한 승인');
      onLog?.('   4. 생성된 코드를 복사하여 입력');
      return {
        ok: false,
        error: `인증이 필요합니다: ${errorMsg}`,
        needsAuth: true
      };
    }

    console.log('[PUBLISH] ✅ 인증 상태 확인 완료');

    // 토큰 만료 경고
    if (authStatus.tokenData?.expires_at) {
      const expiresIn = authStatus.tokenData.expires_at - Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      const oneHour = 60 * 60 * 1000;

      if (expiresIn > 0 && expiresIn < thirtyMinutes) {
        onLog?.(`🚨 긴급: Blogger 인증이 ${Math.round(expiresIn / 60000)}분 후 만료됩니다!`);
      } else if (expiresIn > 0 && expiresIn < oneHour) {
        onLog?.(`⚠️ Blogger 인증이 ${Math.round(expiresIn / 60000)}분 후 만료됩니다. 자동 갱신을 시도합니다.`);
      } else if (expiresIn <= 0) {
        onLog?.(`❌ Blogger 인증이 만료되었습니다! 재인증이 필요합니다.`);
      }
    }

    // 토큰 갱신 필요 시 처리
    if (authStatus.needsRefresh) {
      onLog?.('🔄 토큰이 만료되었습니다. 자동 갱신을 시도합니다...');
    } else {
      onLog?.('✅ 블로그스팟 인증 확인됨');
    }

    // 환경변수에서 설정 로드
    const envVars = loadEnvironmentVariables();

    clientId = String(
      payload.googleClientId ||
      envVars.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      ''
    ).trim();

    clientSecret = String(
      payload.googleClientSecret ||
      envVars.GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_CLIENT_SECRET ||
      ''
    ).trim();

    blogId = String(
      payload.blogId ||
      envVars.BLOGGER_BLOG_ID ||
      envVars.GOOGLE_BLOG_ID ||
      envVars.BLOG_ID ||
      process.env.BLOGGER_BLOG_ID ||
      process.env.GOOGLE_BLOG_ID ||
      process.env.BLOG_ID ||
      ''
    ).trim();

    // 설정 검증
    if (!clientId || !clientSecret) {
      console.error('[PUBLISH] ❌ Google OAuth2 Client 정보 누락');
      onLog?.('❌ Google OAuth2 Client 정보가 설정되지 않았습니다.');
      onLog?.('⚠️ 해결 방법:');
      onLog?.('   1. 환경설정 탭으로 이동');
      onLog?.('   2. Google Client ID와 Client Secret 입력');
      onLog?.('   3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성 필요');
      return {
        ok: false,
        error: 'Google OAuth2 Client ID/Secret이 누락되었습니다.'
      };
    }

    if (!blogId) {
      console.error('[PUBLISH] ❌ Blogger Blog ID 누락');
      onLog?.('❌ Blogger Blog ID가 설정되지 않았습니다.');
      return {
        ok: false,
        error: 'Blogger Blog ID가 비어 있습니다.'
      };
    }

    console.log('[PUBLISH] ✅ 필수 설정 확인 완료');
    console.log('[PUBLISH] Blog ID:', blogId);

    // OAuth2 클라이언트 설정
    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      OAUTH_CONFIG.REDIRECT_URI
    );

    let accessToken = authStatus.tokenData?.access_token;
    let refreshToken = authStatus.tokenData?.refresh_token;

    // 토큰 갱신 필요 시
    if (!accessToken || authStatus.needsRefresh) {
      if (refreshToken) {
        onLog?.('🔄 액세스 토큰 갱신 중...');
        const refreshResult = await refreshAccessToken(refreshToken, clientId, clientSecret);

        if (refreshResult.ok) {
          accessToken = refreshResult.tokenData.access_token;
          refreshToken = refreshResult.tokenData.refresh_token || refreshToken;

          // 갱신된 토큰 저장
          saveTokenData(refreshResult.tokenData);
          onLog?.('✅ 토큰 갱신 성공');
        } else {
          onLog?.(`❌ 토큰 갱신 실패: ${refreshResult.error}`);
          return {
            ok: false,
            error: '토큰 갱신에 실패했습니다. 재인증이 필요합니다.',
            needsAuth: true
          };
        }
      } else {
        return {
          ok: false,
          error: '리프레시 토큰이 없습니다. 재인증이 필요합니다.',
          needsAuth: true
        };
      }
    }

    // OAuth2 클라이언트에 토큰 설정
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // Blogger API 클라이언트 생성
    const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

    onLog?.('📝 포스트 준비 중...');

    // 콘텐츠 전처리
    let processedHtml = preprocessContent(html);
    processedHtml = escapeHtmlSpecialChars(processedHtml);

    // CSS 생성 및 주입 — 애드센스 모드는 Clean CSS 사용
    let bloggerCSS;
    if (payload.contentMode === 'adsense') {
      try {
        const { generateAdsenseCleanCSS } = require('../../core/content-modes/adsense/adsense-css');
        bloggerCSS = generateAdsenseCleanCSS();
        onLog?.('🛡️ 애드센스 Clean CSS 적용 (CTA/애니메이션 제거)');
      } catch (e) {
        console.warn('[PUBLISH] ⚠️ 애드센스 CSS 로드 실패, 기본 CSS 사용');
        bloggerCSS = generateBloggerLayoutCSS();
      }
    } else {
      bloggerCSS = generateBloggerLayoutCSS();
    }
    const compressedCSS = compressCSS(bloggerCSS);
    processedHtml = injectCSS(processedHtml, compressedCSS);

    // 인라인 스타일 적용 (CSS 실패 대비)
    processedHtml = applyInlineStyles(processedHtml);

    // AdSense 광고 호흡 공간 삽입 (애드센스 모드에서는 자동 스킵)
    processedHtml = insertAdBreathingSpace(processedHtml, payload.contentMode);

    // 이미지 처리 (재호스팅)
    onLog?.('🖼️ 이미지 처리 중...');
    processedHtml = await processImagesInHtml(processedHtml, blogger, blogId, onLog);

    // 썸네일 처리
    let finalThumbnailUrl = thumbnailUrl;
    if (thumbnailUrl) {
      if (thumbnailUrl.startsWith('data:')) {
        onLog?.('🖼️ 썸네일 업로드 중...');
        const uploadedUrl = await uploadDataUrlThumbnail(blogger, blogId, thumbnailUrl, onLog);
        if (uploadedUrl) {
          finalThumbnailUrl = uploadedUrl;
        }
      } else if (!thumbnailUrl.includes('blogger.googleusercontent.com') &&
        !thumbnailUrl.includes('blogspot.com')) {
        onLog?.('🖼️ 외부 썸네일 재호스팅 중...');
        const uploadedUrl = await uploadExternalImage(blogger, blogId, thumbnailUrl, onLog);
        if (uploadedUrl) {
          finalThumbnailUrl = uploadedUrl;
        }
      }
    }

    // 포스팅 상태 결정
    const { status, isDraftMode, isScheduleMode } = determinePostingStatus(postingStatus, scheduleDate);

    // 포스트 body 구성
    const body = {
      kind: 'blogger#post',
      blog: { id: blogId },
      title: title,
      content: processedHtml
    };

    // 레이블 추가
    if (payload.labels) {
      body.labels = processLabels(payload.labels);
    }

    // 이미지 추가
    if (finalThumbnailUrl) {
      body.images = [{
        url: finalThumbnailUrl
      }];
    }

    // 예약 발행 처리
    if (isScheduleMode && scheduleDate) {
      body.published = scheduleDate.toISOString();
      onLog?.(`📅 예약 발행: ${scheduleDate.toLocaleString('ko-KR')}`);
    }

    // 발행 모드 로깅
    if (isDraftMode) {
      onLog?.('📝 임시저장으로 저장 중...');
    } else if (isScheduleMode) {
      onLog?.('📅 예약 발행 설정 중...');
    } else {
      onLog?.('🚀 포스트 발행 중...');
    }

    // Blogger API 호출
    console.log('[PUBLISH] Blogger API 호출 시작...');
    console.log('[PUBLISH] Blog ID:', blogId);
    console.log('[PUBLISH] Status:', status);
    console.log('[PUBLISH] isDraft:', isDraftMode);

    const response = await blogger.posts.insert({
      blogId: blogId,
      resource: body,
      isDraft: isDraftMode
    });

    if (response.data && response.data.url) {
      const postUrl = response.data.url;
      const postId = response.data.id;

      console.log('[PUBLISH] ✅ 발행 성공!');
      console.log('[PUBLISH] Post URL:', postUrl);
      console.log('[PUBLISH] Post ID:', postId);

      if (isDraftMode) {
        onLog?.('✅ 임시저장 완료!');
        onLog?.(`📝 임시저장 ID: ${postId}`);
      } else if (isScheduleMode) {
        onLog?.('✅ 예약 발행 설정 완료!');
        onLog?.(`📅 발행 예정: ${scheduleDate.toLocaleString('ko-KR')}`);
      } else {
        onLog?.('✅ 발행 완료!');
        onLog?.(`🔗 포스트 URL: ${postUrl}`);
      }

      return {
        ok: true,
        postUrl: postUrl,
        postId: postId
      };
    } else {
      throw new Error('Blogger API 응답에 URL이 없습니다.');
    }

  } catch (error) {
    console.error('[PUBLISH] ❌ 발행 실패:', error);

    // 에러 진단
    diagnoseBloggerError(error, onLog);

    // 상세 에러 로깅
    logDetailedError('PUBLISH', error, {
      'Blog ID': blogId,
      '제목': title
    });

    onLog?.(`❌ 발행 실패: ${error?.message || error}`);

    return {
      ok: false,
      error: error?.message || '알 수 없는 오류가 발생했습니다.'
    };
  }
}

module.exports = {
  publishToBlogger
};




