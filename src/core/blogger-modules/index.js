/**
 * Blogger Publisher - Main Entry Point
 * 모듈화된 Blogger 퍼블리셔의 통합 진입점
 * 
 * 모듈 구조:
 * - constants.js: 상수 및 설정값
 * - error-handler.js: 에러 처리 및 진단
 * - utils.js: 공통 유틸리티 함수
 * - auth.js: OAuth2 인증 및 토큰 관리
 * - style.js: CSS 생성 및 스타일 처리
 * - image.js: 이미지 업로드 및 재호스팅
 * - content.js: 콘텐츠 검증 및 처리
 * - publisher.js: 메인 발행 로직
 */

// 메인 기능 (외부 노출)
const { publishToBlogger } = require('./publisher');
const { 
  checkBloggerAuthStatus, 
  clearAuthCache, 
  getBloggerAuthUrl, 
  getBloggerInfo 
} = require('./auth');

// 유틸리티 함수 (선택적 노출)
const { 
  loadEnvironmentVariables,
  calculateTextLength,
  escapeHtmlSpecialChars,
  getUserDataPath,
  getTokenFilePath
} = require('./utils');

// 콘텐츠 처리 함수 (선택적 노출)
const { 
  validateTitle,
  validateHtml,
  validateContentSize,
  analyzeContentSize
} = require('./content');

// 스타일 함수 (선택적 노출)
const { 
  generateBloggerLayoutCSS,
  applyInlineStyles,
  compressCSS
} = require('./style');

// 이미지 처리 함수 (선택적 노출)
const { 
  uploadDataUrlThumbnail,
  uploadExternalImage,
  processImagesInHtml
} = require('./image');

// 에러 처리 함수 (선택적 노출)
const { 
  diagnoseBloggerError,
  formatErrorDetails,
  logDetailedError
} = require('./error-handler');

// 상수 (선택적 노출)
const { 
  BLOGGER_ERROR_TYPES,
  BLOGGER_TEXT_LIMIT,
  BLOGGER_HTML_LIMIT,
  MAX_TITLE_LENGTH,
  AUTH_CACHE_TTL
} = require('./constants');

/**
 * 메인 API (외부에서 사용하는 핵심 기능)
 */
module.exports = {
  // 핵심 발행 기능
  publishToBlogger,
  
  // 인증 관련
  checkBloggerAuthStatus,
  clearAuthCache,
  getBloggerAuthUrl,
  getBloggerInfo,
  
  // 유틸리티 (선택적)
  loadEnvironmentVariables,
  calculateTextLength,
  escapeHtmlSpecialChars,
  getUserDataPath,
  getTokenFilePath,
  
  // 콘텐츠 검증 (선택적)
  validateTitle,
  validateHtml,
  validateContentSize,
  analyzeContentSize,
  
  // 스타일 처리 (선택적)
  generateBloggerLayoutCSS,
  applyInlineStyles,
  compressCSS,
  
  // 이미지 처리 (선택적)
  uploadDataUrlThumbnail,
  uploadExternalImage,
  processImagesInHtml,
  
  // 에러 처리 (선택적)
  diagnoseBloggerError,
  formatErrorDetails,
  logDetailedError,
  
  // 상수 (선택적)
  BLOGGER_ERROR_TYPES,
  BLOGGER_TEXT_LIMIT,
  BLOGGER_HTML_LIMIT,
  MAX_TITLE_LENGTH,
  AUTH_CACHE_TTL
};

/**
 * 사용 예시:
 * 
 * const { publishToBlogger, checkBloggerAuthStatus } = require('./blogger-modules');
 * 
 * // 인증 확인
 * const authStatus = await checkBloggerAuthStatus();
 * if (!authStatus.authenticated) {
 *   console.error('인증이 필요합니다:', authStatus.error);
 *   return;
 * }
 * 
 * // 포스트 발행
 * const result = await publishToBlogger(
 *   payload,
 *   '포스트 제목',
 *   '<h1>포스트 내용</h1>',
 *   'https://example.com/image.jpg',
 *   (msg) => console.log(msg),
 *   'publish',
 *   null
 * );
 * 
 * if (result.ok) {
 *   console.log('발행 성공:', result.postUrl);
 * } else {
 *   console.error('발행 실패:', result.error);
 * }
 */




