/**
 * Blogger Publisher - Constants Module
 * 모든 상수와 설정값을 관리하는 모듈
 */

// 인증 관련 상수
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5분
const TOKEN_FILE_NAME = 'blogger-token.json';

// API 할당량 상수
const BLOGGER_API_QUOTA_HOURLY = 1000;
const BLOGGER_API_QUOTA_DAILY = 100;

// 콘텐츠 크기 제한
const MAX_CONTENT_SIZE = 180000; // 180KB
const MAX_TITLE_LENGTH = 140;
const BLOGGER_TEXT_LIMIT = 50000; // 순수 텍스트 기준 제한
const BLOGGER_HTML_LIMIT = 100000; // 전체 HTML 크기 제한

// CSS 셀렉터 상수
const BLOGGER_CONTAINER_SELECTORS = '.post-body, .post-body .post, .entry-content, .post-content, .post-body-inner, .post-content-inner, .entry-content-inner, .content-inner, .main-content, .article-content, .blog-post-content, .post-content-wrapper, .post-body-container, .post-content-container, .entry-body, .entry-text, .post-text, .post-body-text, .entry-content-text';

const BLOGGER_MAIN_CONTAINER_SELECTORS = '#main, #content, .main, .content, .container, .blog-posts, .blog-post, .post-outer, .post-outer-container, .post, .entry, .entry-wrapper, .post-wrapper, #Blog1, .blog-posts-container, .posts-container, .main-inner, .content-inner, .container-inner';

const MAX_MODE_ARTICLE_SELECTORS = '.max-mode-article, .premium-article, .article-content, .post-body .max-mode-article, .post-body .premium-article, .entry-content .max-mode-article, .entry-content .premium-article, .post-body .article-content, .entry-content .article-content, .post-body .max-mode-article .article-content, .entry-content .max-mode-article .article-content, .post-outer .max-mode-article, .post-outer .premium-article, .blog-post .max-mode-article, .blog-post .premium-article, .article-body .max-mode-article, .article-body .premium-article, .content-section .max-mode-article, .content-section .premium-article';

// Blogger 에러 타입 정의
const BLOGGER_ERROR_TYPES = {
  TOKEN_EXPIRED: 'token_expired',
  QUOTA_EXCEEDED: 'quota_exceeded',
  NETWORK_ERROR: 'network_error',
  BLOG_NOT_FOUND: 'blog_not_found',
  PERMISSION_DENIED: 'permission_denied',
  INVALID_REQUEST: 'invalid_request',
  UNKNOWN_ERROR: 'unknown_error'
};

// OAuth2 설정 (🔥 로컬 서버 기반 - OOB deprecated 대응)
const OAUTH_CONFIG = {
  REDIRECT_URI: 'http://127.0.0.1:58392/callback',
  SCOPE: 'https://www.googleapis.com/auth/blogger',
  AUTH_URL_BASE: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  USER_INFO_URL: 'https://www.googleapis.com/blogger/v3/users/self'
};

module.exports = {
  // 인증 상수
  AUTH_CACHE_TTL,
  TOKEN_FILE_NAME,
  
  // API 할당량
  BLOGGER_API_QUOTA_HOURLY,
  BLOGGER_API_QUOTA_DAILY,
  
  // 크기 제한
  MAX_CONTENT_SIZE,
  MAX_TITLE_LENGTH,
  BLOGGER_TEXT_LIMIT,
  BLOGGER_HTML_LIMIT,
  
  // CSS 셀렉터
  BLOGGER_CONTAINER_SELECTORS,
  BLOGGER_MAIN_CONTAINER_SELECTORS,
  MAX_MODE_ARTICLE_SELECTORS,
  
  // 에러 타입
  BLOGGER_ERROR_TYPES,
  
  // OAuth2 설정
  OAUTH_CONFIG
};





