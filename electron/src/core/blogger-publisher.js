const { GoogleAuth } = require('google-auth-library');

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

// Blogger 에러 진단 및 해결 함수
function diagnoseBloggerError(error, onLog) {
  const errorMessage = error.message || error.toString();
  const lowerMessage = errorMessage.toLowerCase();

  let errorType = BLOGGER_ERROR_TYPES.UNKNOWN_ERROR;
  let solution = '';
  let urgent = false;

  // 토큰 만료 에러
  if (lowerMessage.includes('token expired') ||
    lowerMessage.includes('invalid token') ||
    lowerMessage.includes('token has expired')) {
    errorType = BLOGGER_ERROR_TYPES.TOKEN_EXPIRED;
    solution = 'Blogger 설정에서 재인증을 진행해주세요.';
    urgent = true;
  }
  // 할당량 초과 에러
  else if (lowerMessage.includes('quota exceeded') ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests')) {
    errorType = BLOGGER_ERROR_TYPES.QUOTA_EXCEEDED;
    solution = '잠시 후 다시 시도하거나, Blogger API 할당량을 확인해주세요.';
    urgent = false;
  }
  // 네트워크 에러
  else if (lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('connection')) {
    errorType = BLOGGER_ERROR_TYPES.NETWORK_ERROR;
    solution = '인터넷 연결을 확인하고 잠시 후 다시 시도해주세요.';
    urgent = false;
  }
  // 블로그 없음 에러
  else if (lowerMessage.includes('blog not found') ||
    lowerMessage.includes('invalid blog id')) {
    errorType = BLOGGER_ERROR_TYPES.BLOG_NOT_FOUND;
    solution = 'Blogger 설정에서 올바른 블로그 ID를 확인해주세요.';
    urgent = true;
  }
  // 권한 부족 에러
  else if (lowerMessage.includes('permission denied') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('unauthorized')) {
    errorType = BLOGGER_ERROR_TYPES.PERMISSION_DENIED;
    solution = 'Blogger API 권한을 다시 확인해주세요.';
    urgent = true;
  }
  // 잘못된 요청 에러
  else if (lowerMessage.includes('bad request') ||
    lowerMessage.includes('invalid request')) {
    errorType = BLOGGER_ERROR_TYPES.INVALID_REQUEST;
    solution = '요청 데이터를 확인해주세요.';
    urgent = false;
  }

  const logMessage = `❌ Blogger 에러 감지: ${errorType.replace('_', ' ').toUpperCase()}\n💡 해결 방법: ${solution}`;

  if (urgent) {
    logMessage + '\n🚨 긴급: 즉시 조치가 필요합니다!';
  }

  onLog?.(logMessage);

  return { errorType, solution, urgent };
}
const { google } = require('googleapis');
const { Readable } = require('stream');
// const { addAutoCTAs } = require('../content-generators');

// 임시 대체 함수 (content-generators가 없을 경우)
function addAutoCTAs(content, maxCount) {
  // 간단한 CTA 추가 로직 (실제로는 더 복잡한 로직 필요)
  console.log(`[CTA] 임시 CTA 추가: 최대 ${maxCount}개`);
  return content; // 원본 콘텐츠 그대로 반환
}

// 상수 정의 (최적화)
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5분
const BLOGGER_API_QUOTA_HOURLY = 1000; // 테스트용으로 제한 완화
const BLOGGER_API_QUOTA_DAILY = 100;
const MAX_CONTENT_SIZE = 500000; // 500KB로 증가 (이미지 제외 시 Blogger API 허용)
const MAX_TITLE_LENGTH = 140;

// CSS 상수 (중복 제거)
const BLOGGER_CONTAINER_SELECTORS = '.post-body, .post-body .post, .entry-content, .post-content, .post-body-inner, .post-content-inner, .entry-content-inner, .content-inner, .main-content, .article-content, .blog-post-content, .post-content-wrapper, .post-body-container, .post-content-container, .entry-body, .entry-text, .post-text, .post-body-text, .entry-content-text';

const BLOGGER_MAIN_CONTAINER_SELECTORS = '#main, #content, .main, .content, .container, .blog-posts, .blog-post, .post-outer, .post-outer-container, .post, .entry, .entry-wrapper, .post-wrapper, #Blog1, .blog-posts-container, .posts-container, .main-inner, .content-inner, .container-inner';

const MAX_MODE_ARTICLE_SELECTORS = '.max-mode-article, .premium-article, .article-content, .post-body .max-mode-article, .post-body .premium-article, .entry-content .max-mode-article, .entry-content .premium-article, .post-body .article-content, .entry-content .article-content, .post-body .max-mode-article .article-content, .entry-content .max-mode-article .article-content, .post-outer .max-mode-article, .post-outer .premium-article, .blog-post .max-mode-article, .blog-post .premium-article, .article-body .max-mode-article, .article-body .premium-article, .content-section .max-mode-article, .content-section .premium-article';

// 인증 상태 캐시 (성능 최적화)
let authCache = {
  data: null,
  timestamp: 0,
  ttl: AUTH_CACHE_TTL
};

// 환경변수 로드 헬퍼 함수
function loadEnvironmentVariables() {
  try {
    const fs = require('fs');
    const path = require('path');
    const dotenv = require('dotenv');
    const os = require('os');

    // 🔥 여러 경로에서 환경변수 파일 찾기
    const possiblePaths = [];

    // 1. Electron userData 경로
    try {
      const { app } = require('electron');
      possiblePaths.push(path.join(app.getPath('userData'), '.env'));
    } catch (e) {
      // Electron 없음 - CLI 모드
    }

    // 2. 사용자 데이터 디렉토리 (Windows AppData)
    const homeDir = os.homedir();
    if (process.platform === 'win32') {
      possiblePaths.push(path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'blogger-gpt-cli', '.env'));
      possiblePaths.push(path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'lba', '.env'));
    } else {
      possiblePaths.push(path.join(homeDir, '.config', 'blogger-gpt-cli', '.env'));
      possiblePaths.push(path.join(homeDir, '.config', 'lba', '.env'));
    }

    // 3. 현재 작업 디렉토리
    possiblePaths.push(path.join(process.cwd(), '.env'));

    // 첫 번째로 존재하는 파일 사용
    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        console.log('[ENV] 환경변수 파일 로드:', envPath);
        return dotenv.parse(fs.readFileSync(envPath, 'utf8'));
      }
    }

    console.warn('[ENV] 환경변수 파일을 찾을 수 없음');
  } catch (e) {
    console.warn('[ENV] 환경변수 파일 로드 실패:', e.message);
  }
  return {};
}

// 텍스트 길이 계산 헬퍼 함수
function calculateTextLength(htmlStr) {
  let text = htmlStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, '');
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

// 🔥 경쟁 블로그 링크 제거 함수 (트래픽 유출 방지)
function removeCompetitorLinks(htmlStr) {
  // 제거할 경쟁 블로그 도메인 목록
  const competitorDomains = [
    // 네이버 블로그/카페
    'blog.naver.com',
    'cafe.naver.com',
    'm.blog.naver.com',
    'm.cafe.naver.com',
    'post.naver.com',
    // 티스토리
    'tistory.com',
    '.tistory.com',
    // 블로그스팟 (다른 사람 블로그)
    'blogspot.com',
    'blogspot.kr',
    'blogger.com',
    // 워드프레스
    'wordpress.com',
    'wp.com',
    // 다음/카카오
    'blog.daum.net',
    'brunch.co.kr',
    // 기타 블로그 플랫폼
    'velog.io',
    'medium.com',
    'notion.so',
    'notion.site'
  ];

  let result = htmlStr;
  let removedCount = 0;

  // <a> 태그에서 경쟁 블로그 링크 제거 (텍스트는 유지)
  competitorDomains.forEach(domain => {
    // href에 경쟁 도메인이 있는 <a> 태그를 찾아서 텍스트만 남기고 링크 제거
    const regex = new RegExp(
      `<a[^>]*href=["'][^"']*${domain.replace(/\./g, '\\.')}[^"']*["'][^>]*>(.*?)<\\/a>`,
      'gis'
    );
    const matches = result.match(regex);
    if (matches) {
      removedCount += matches.length;
    }
    result = result.replace(regex, '$1');
  });

  // 남아있는 경쟁 블로그 URL도 제거 (텍스트로 된 URL)
  competitorDomains.forEach(domain => {
    const urlRegex = new RegExp(
      `https?://[^\\s<>"']*${domain.replace(/\./g, '\\.')}[^\\s<>"']*`,
      'gi'
    );
    result = result.replace(urlRegex, '');
  });

  if (removedCount > 0) {
    console.log(`[PUBLISH] 🛡️ 경쟁 블로그 링크 ${removedCount}개 제거됨 (트래픽 유출 방지)`);
  }

  return result;
}

// HTML 특수 문자 이스케이프 함수 (텍스트 컨텐츠만 처리)
function escapeHtmlSpecialChars(htmlStr) {
  // HTML 태그와 CSS는 그대로 두고, 텍스트 컨텐츠만 처리
  return htmlStr
    .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;') // & 기호만 (HTML 엔티티는 유지)
    // 이모지 및 특수 기호들을 HTML 엔티티로 변환
    .replace(/📊/g, '&#128202;')
    .replace(/📈/g, '&#128200;')
    .replace(/📉/g, '&#128201;')
    .replace(/🥧/g, '&#129383;')
    .replace(/📖/g, '&#128214;')
    .replace(/💬/g, '&#128172;')
    .replace(/🔗/g, '&#128279;')
    .replace(/✅/g, '&#9989;')
    .replace(/🔄/g, '&#128257;')
    .replace(/🎯/g, '&#127919;')
    .replace(/🚀/g, '&#128640;')
    .replace(/📱/g, '&#128241;')
    .replace(/🎨/g, '&#127912;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚙️/g, '&#9881;')
    .replace(/💡/g, '&#128161;')
    .replace(/⭐/g, '&#11088;')
    .replace(/🎉/g, '&#127881;')
    .replace(/📝/g, '&#128221;')
    .replace(/🖼️/g, '&#128444;')
    .replace(/🔗/g, '&#128279;')
    .replace(/📅/g, '&#128197;')
    .replace(/🆔/g, '&#127358;')
    .replace(/📄/g, '&#128196;')
    .replace(/📏/g, '&#128207;')
    .replace(/⏱️/g, '&#9203;')
    .replace(/🔑/g, '&#128273;')
    .replace(/🔐/g, '&#128274;')
    .replace(/📤/g, '&#128228;')
    .replace(/🖼️/g, '&#128444;')
    .replace(/📝/g, '&#128221;')
    .replace(/🏷️/g, '&#127991;')
    .replace(/📊/g, '&#128202;')
    .replace(/📈/g, '&#128200;')
    .replace(/📉/g, '&#128201;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚠️/g, '&#9888;')
    .replace(/❌/g, '&#10060;')
    .replace(/✅/g, '&#9989;')
    .replace(/🔄/g, '&#128257;')
    .replace(/🚀/g, '&#128640;')
    .replace(/🎯/g, '&#127919;')
    .replace(/📱/g, '&#128241;')
    .replace(/🎨/g, '&#127912;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚙️/g, '&#9881;')
    .replace(/💡/g, '&#128161;')
    .replace(/⭐/g, '&#11088;')
    .replace(/🎉/g, '&#127881;')
    .replace(/💾/g, '&#128190;')
    .replace(/📊/g, '&#128202;')
    .replace(/📈/g, '&#128200;')
    .replace(/📉/g, '&#128201;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚠️/g, '&#9888;')
    .replace(/❌/g, '&#10060;')
    .replace(/✅/g, '&#9989;')
    .replace(/🔄/g, '&#128257;')
    .replace(/🚀/g, '&#128640;')
    .replace(/🎯/g, '&#127919;')
    .replace(/📱/g, '&#128241;')
    .replace(/🎨/g, '&#127912;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚙️/g, '&#9881;')
    .replace(/💡/g, '&#128161;')
    .replace(/⭐/g, '&#11088;')
    .replace(/🎉/g, '&#127881;')
    .replace(/💾/g, '&#128190;')
    .replace(/📊/g, '&#128202;')
    .replace(/📈/g, '&#128200;')
    .replace(/📉/g, '&#128201;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚠️/g, '&#9888;')
    .replace(/❌/g, '&#10060;')
    .replace(/✅/g, '&#9989;')
    .replace(/🔄/g, '&#128257;')
    .replace(/🚀/g, '&#128640;')
    .replace(/🎯/g, '&#127919;')
    .replace(/📱/g, '&#128241;')
    .replace(/🎨/g, '&#127912;')
    .replace(/📐/g, '&#128208;')
    .replace(/🔧/g, '&#128295;')
    .replace(/⚙️/g, '&#9881;')
    .replace(/💡/g, '&#128161;')
    .replace(/⭐/g, '&#11088;')
    .replace(/🎉/g, '&#127881;')
    .replace(/💾/g, '&#128190;');
}

// 🔥 클린 모던 스킨 - 눈 편안한 색상 + 각진 디자인 (테마 CSS 오버라이드)
function applyInlineStyles(html) {
  if (!html) return html;

  try {
    // HTML 엔티티 정리 및 이모지 복원
    html = html
      .replace(/&nbsp;/g, ' ')
      .replace(/☐/g, '');
    html = html
      .replace(/&#9989;/g, '✅')
      .replace(/&#128204;/g, '📌')
      .replace(/&#128640;/g, '🚀')
      .replace(/&#128161;/g, '💡');

    let styledHtml = html;

    // ── ** 볼드 마크다운 마커 → <strong> 변환 ──
    styledHtml = styledHtml.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // ── 수익 최적화 통일 디자인 시스템 ──
    // 색상: 틸 #0d9488 (H2), 시안 #0891b2 (H3/링크)
    // 타이포: 18px / 1.85 / #1a1a1a / Noto Sans KR
    // 구조: 680px 폭 → 60~70자/줄 / 48px 섹션 간격
    const tagPatternsWithAttrs = {
      'h1': `<h1 style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 28px !important; font-weight: 800 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 0 0 32px 0 !important; padding: 24px 0 !important; line-height: 1.3 !important; letter-spacing: -0.03em !important; text-align: left !important; border-bottom: 3px solid #6366f1 !important;"`,
      'h2': `<h2 style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 22px !important; font-weight: 700 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 48px 0 20px 0 !important; padding: 16px 20px !important; background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%) !important; border-left: 5px solid #6366f1 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 12px 12px 0 !important; line-height: 1.4 !important; letter-spacing: -0.02em !important;"`,
      'h3': `<h3 style="color: #1e293b !important; -webkit-text-fill-color: #1e293b !important; font-size: 19px !important; font-weight: 600 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 36px 0 16px 0 !important; padding: 12px 16px !important; background: transparent !important; border-left: 4px solid #818cf8 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; line-height: 1.4 !important;"`,
      // 🛡️ h2 태그가 이미 style을 가지고 있으면 보존 (ultimate-final-functions에서 오는 인라인 style)

      'h4': `<h4 style="color: #334155 !important; -webkit-text-fill-color: #334155 !important; font-size: 17px !important; font-weight: 700 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 28px 0 12px 0 !important; padding-left: 12px !important; border-left: 3px solid #94a3b8 !important; line-height: 1.4 !important;"`,
      'p': `<p style="color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 18px !important; line-height: 1.85 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 0 0 24px 0 !important; word-break: keep-all !important; letter-spacing: -0.01em !important;"`,
      'ul': `<ul style="display: block !important; visibility: visible !important; opacity: 1 !important; color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important; list-style-type: disc !important;"`,
      'ol': `<ol style="display: block !important; visibility: visible !important; opacity: 1 !important; color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important; list-style-type: decimal !important;"`,
      'li': `<li style="display: list-item !important; visibility: visible !important; opacity: 1 !important; color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; margin: 8px 0 !important; padding: 2px 0 !important; line-height: 1.85 !important; font-size: 17px !important;"`,
      'table': `<table style="display: table !important; visibility: visible !important; opacity: 1 !important; width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 32px 0 !important; border-radius: 10px !important; overflow: hidden !important; border: 1px solid #e2e8f0 !important;"`,
      'thead': `<thead style="display: table-header-group !important; visibility: visible !important;"`,
      'tbody': `<tbody style="display: table-row-group !important; visibility: visible !important;"`,
      'tr': `<tr style="display: table-row !important; visibility: visible !important; opacity: 1 !important;"`,
      'th': `<th style="display: table-cell !important; visibility: visible !important; opacity: 1 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; padding: 14px 16px !important; background: #f1f5f9 !important; font-weight: 700 !important; text-align: left !important; font-size: 15px !important; border-bottom: 2px solid #e2e8f0 !important;"`,
      'td': `<td style="display: table-cell !important; visibility: visible !important; opacity: 1 !important; color: #334155 !important; -webkit-text-fill-color: #334155 !important; padding: 12px 16px !important; border-bottom: 1px solid #f1f5f9 !important; text-align: left !important; font-size: 16px !important; line-height: 1.7 !important;"`,
      'strong': `<strong style="display: inline !important; visibility: visible !important; opacity: 1 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;"`,
      'b': `<b style="display: inline !important; visibility: visible !important; opacity: 1 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;"`,
      'em': `<em style="display: inline !important; visibility: visible !important; opacity: 1 !important; font-style: italic !important;"`,
      'i': `<i style="display: inline !important; visibility: visible !important; opacity: 1 !important; font-style: italic !important;"`,
      'span': `<span style="display: inline !important; visibility: visible !important; opacity: 1 !important;"`,
      'a': `<a style="display: inline !important; visibility: visible !important; opacity: 1 !important; color: #0891b2 !important; -webkit-text-fill-color: #0891b2 !important; text-decoration: none !important; border-bottom: 1px solid #99f6e4 !important; font-weight: 600 !important;"`,
      'div': `<div style="display: block !important; visibility: visible !important; opacity: 1 !important;"`,
      'blockquote': `<blockquote style="display: block !important; visibility: visible !important; opacity: 1 !important; color: #334155 !important; -webkit-text-fill-color: #334155 !important; margin: 28px 0 !important; padding: 20px 24px !important; background: #f8fafc !important; border-left: 4px solid #94a3b8 !important; border-radius: 0 6px 6px 0 !important; font-style: normal !important; font-size: 17px !important; line-height: 1.85 !important;"`
    };

    // 각 태그에 대해 속성이 있는 경우도 매칭
    for (const [tagName, styledStart] of Object.entries(tagPatternsWithAttrs)) {
      const simpleTagRegex = new RegExp(`<${tagName}>`, 'gi');
      styledHtml = styledHtml.replace(simpleTagRegex, styledStart + '>');

      const tagWithAttrsRegex = new RegExp(`<${tagName}\\s+([^>]*)>`, 'gi');
      styledHtml = styledHtml.replace(tagWithAttrsRegex, (match, attrs) => {
        // 🛡️ H2에 이미 background가 포함된 inline style이 있으면 보존 (premium skin용)
        if (tagName === 'h2' && attrs.includes('background:')) {
          return match; // 원본 유지
        }
        // 🛡️ TOC/CTA 등 특수 컴포넌트 보존 — display:flex/inline-block 레이아웃 보호
        const preservedClasses = ['toc-btn', 'toc-number', 'toc-grid', 'cta-btn', 'cta-box', 'cta-microcopy', 'gradient-frame', 'white-paper'];
        if (preservedClasses.some(cls => attrs.includes(cls))) {
          return match; // 원본 유지 — 이미 정교한 인라인 스타일이 있음
        }
        // 🛡️ display:flex 또는 display:inline-block이 이미 있으면 보존
        if (attrs.includes('display:flex') || attrs.includes('display: flex') || attrs.includes('display:inline-block') || attrs.includes('display: inline-block')) {
          return match; // 레이아웃 관련 display가 이미 설정된 요소 보존
        }
        const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
        return styledStart + (cleanAttrs ? ' ' + cleanAttrs : '') + '>';
      });
    }

    // 이미지 특별 처리
    styledHtml = styledHtml.replace(/<img\s+([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<img style="display: block !important; visibility: visible !important; opacity: 1 !important; max-width: 100% !important; height: auto !important; margin: 32px auto !important; border-radius: 6px !important;" ${cleanAttrs}>`;
    });

    // 수익 최적화 모바일 반응형 CSS + 전체 너비 레이아웃
    const mobileOptimizedCSS = `
      <style>
        /* ===== 사이드바 숨기고 전체 너비 확장 ===== */
        #sidebar-wrapper { display: none !important; }
        #content-wrapper, .container.row-x1, #outer-wrapper {
          max-width: 100% !important; width: 100% !important; padding: 0 !important;
        }
        #main-wrapper, .theiaStickySidebar, #main, #Blog1,
        .blog-posts.hfeed.item-post-wrap, .blog-post.hentry.item-post,
        .item-post-inner, .entry-content-wrap {
          max-width: 100% !important; width: 100% !important; flex: 1 1 100% !important;
        }
        .post-body { max-width: 100% !important; width: 100% !important; padding: 0 !important; }

        /* 완전 풀와이드 레이아웃 — 빈 공간 제로 */
        .blogger-gpt-content.max-mode-article {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
          padding: 20px 5% !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
        }
        
        /* 부모 컨테이너 확장 */
        .post-body, .entry-content, .post-content,
        .Blog .post-body, .hentry .post-body,
        .post-outer .post-body, .blog-posts .post-body,
        article .post-body, .post .post-body {
          width: 100% !important;
          max-width: 100% !important;
          padding: 0 !important;
          margin: 0 !important;
          box-sizing: border-box !important;
        }

        /* 이미지 꽉차게 */
        .post-body img, .blogger-gpt-content img {
          max-width: 100% !important; width: 100% !important;
          height: auto !important; border-radius: 12px !important;
          margin: 24px 0 !important; display: block !important;
        }
        .separator, .tr-caption-container {
          max-width: 100% !important; width: 100% !important; text-align: center !important;
        }
        .separator img, .tr-caption-container img {
          max-width: 100% !important; width: 100% !important; height: auto !important;
        }
        
        /* 모바일 (≤768px) */
        @media screen and (max-width: 768px) {
          .post-body { padding: 0 !important; margin: 0 !important; }
          .item-post-inner { padding: 0 !important; }
          .entry-content-wrap { padding: 0 !important; margin: 0 !important; }
          .blogger-gpt-content.max-mode-article {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          
          .blogger-gpt-content h1 {
            font-size: 22px !important;
            padding: 16px 0 !important;
            margin: 0 0 20px 0 !important;
          }
          
          .blogger-gpt-content h2 {
            font-size: 19px !important;
            padding: 12px 0 12px 16px !important;
            margin: 36px 0 16px 0 !important;
          }
          
          .blogger-gpt-content h3 {
            font-size: 17px !important;
            padding: 10px 0 10px 12px !important;
            margin: 24px 0 12px 0 !important;
          }
          
          .blogger-gpt-content p {
            font-size: 16px !important;
            line-height: 1.8 !important;
            margin: 0 0 18px 0 !important;
          }
          
          .blogger-gpt-content img {
            margin: 24px 0 !important;
            border-radius: 4px !important;
          }
          
          .blogger-gpt-content table {
            display: block !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            margin: 24px 0 !important;
          }
          
          .blogger-gpt-content blockquote {
            margin: 20px 0 !important;
            padding: 16px 18px !important;
          }
          
          .blogger-gpt-content ul,
          .blogger-gpt-content ol {
            padding: 16px 16px 16px 32px !important;
          }
        }
        
        /* 소형 화면 (≤375px) */
        @media screen and (max-width: 375px) {
          .blogger-gpt-content.max-mode-article {
            padding: 0 !important;
          }
          
          .blogger-gpt-content h2 { font-size: 18px !important; }
          .blogger-gpt-content h3 { font-size: 16px !important; }
          .blogger-gpt-content p {
            font-size: 15px !important;
            line-height: 1.8 !important;
          }
        }
      </style>
    `;

    // 컨테이너 스타일 — 100% 폭 풀와이드 + 수익 최적화 타이포
    const containerStyle = `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: 20px 5% !important;
      background: #ffffff !important;
      color: #1a1a1a !important;
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 18px !important;
      line-height: 1.85 !important;
      -webkit-text-fill-color: #1a1a1a !important;
      text-shadow: none !important;
      filter: none !important;
      transform: none !important;
      height: auto !important;
      overflow: visible !important;
      box-sizing: border-box !important;
      word-break: keep-all !important;
    `.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

    // 래퍼 div + 모바일 최적화 CSS
    styledHtml = `${mobileOptimizedCSS}<div class="blogger-gpt-content max-mode-article" style="${containerStyle}">${styledHtml}</div>`;

    console.log('[PUBLISH] ✅ 풀와이드 인라인 스타일 적용 (100%/18px/1.85)');
    return styledHtml;
  } catch (error) {
    console.warn('[PUBLISH] ⚠️ 인라인 스타일 적용 실패:', error.message);
    return html;
  }
}

function generateBloggerLayoutCSS() {
  // 수익 최적화 통일 CSS — applyInlineStyles()와 동기화
  return `
    /* ========================================
       BLOGGER-GPT 수익 최적화 스킨 v4.0
       680px / 18px / 1.85 / 틸 악센트
       ======================================== */

    /* 컨테이너 - 680px 가독성 최적 폭 */
    .blogger-gpt-content {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      width: 100% !important;
      max-width: 680px !important;
      margin: 0 auto !important;
      padding: 32px 24px !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      color: #1a1a1a !important;
      -webkit-text-fill-color: #1a1a1a !important;
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 18px !important;
      line-height: 1.85 !important;
      word-break: keep-all !important;
    }

    /* H1 */
    .blogger-gpt-content h1 {
      display: block !important;
      visibility: visible !important;
      color: #0f172a !important;
      -webkit-text-fill-color: #0f172a !important;
      font-size: 28px !important;
      font-weight: 800 !important;
      margin: 0 0 32px 0 !important;
      padding: 24px 0 !important;
      line-height: 1.3 !important;
      border-bottom: 3px solid #6366f1 !important;
    }

    /* H2 - 48px 섹션 간격 (광고 착지점) — Indigo 프리미엄 */
    .blogger-gpt-content h2 {
      display: block !important;
      visibility: visible !important;
      color: #0f172a !important;
      -webkit-text-fill-color: #0f172a !important;
      font-size: 22px !important;
      font-weight: 700 !important;
      margin: 48px 0 20px 0 !important;
      padding: 16px 20px !important;
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%) !important;
      border-left: 5px solid #6366f1 !important;
      border-radius: 0 12px 12px 0 !important;
      line-height: 1.4 !important;
    }

    /* H3 */
    .blogger-gpt-content h3 {
      display: block !important;
      visibility: visible !important;
      color: #1e293b !important;
      -webkit-text-fill-color: #1e293b !important;
      font-size: 19px !important;
      font-weight: 600 !important;
      margin: 36px 0 16px 0 !important;
      padding: 12px 16px !important;
      border-left: 4px solid #0891b2 !important;
      line-height: 1.4 !important;
    }

    /* 본문 - 18px / 1.85 가독성 최적 */
    .blogger-gpt-content p {
      display: block !important;
      visibility: visible !important;
      color: #1a1a1a !important;
      -webkit-text-fill-color: #1a1a1a !important;
      font-size: 18px !important;
      line-height: 1.85 !important;
      margin: 0 0 24px 0 !important;
      word-break: keep-all !important;
    }

    /* 리스트 */
    .blogger-gpt-content ul,
    .blogger-gpt-content ol {
      display: block !important;
      visibility: visible !important;
      color: #1a1a1a !important;
      -webkit-text-fill-color: #1a1a1a !important;
      margin: 20px 0 !important;
      padding: 20px 20px 20px 40px !important;
      background: #fafafa !important;
      border-left: 3px solid #e2e8f0 !important;
      border-radius: 0 6px 6px 0 !important;
    }

    .blogger-gpt-content ul { list-style-type: disc !important; }
    .blogger-gpt-content ol { list-style-type: decimal !important; }

    .blogger-gpt-content li {
      display: list-item !important;
      visibility: visible !important;
      color: #1a1a1a !important;
      -webkit-text-fill-color: #1a1a1a !important;
      margin: 8px 0 !important;
      line-height: 1.85 !important;
      font-size: 17px !important;
    }

    /* 테이블 */
    .blogger-gpt-content table {
      display: table !important;
      visibility: visible !important;
      width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      margin: 32px 0 !important;
      border-radius: 10px !important;
      overflow: hidden !important;
      border: 1px solid #e2e8f0 !important;
    }

    .blogger-gpt-content th {
      display: table-cell !important;
      visibility: visible !important;
      color: #0f172a !important;
      -webkit-text-fill-color: #0f172a !important;
      padding: 14px 16px !important;
      background: #f1f5f9 !important;
      font-weight: 700 !important;
      text-align: left !important;
      font-size: 15px !important;
      border-bottom: 2px solid #e2e8f0 !important;
    }

    .blogger-gpt-content td {
      display: table-cell !important;
      visibility: visible !important;
      color: #334155 !important;
      -webkit-text-fill-color: #334155 !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid #f1f5f9 !important;
      font-size: 16px !important;
      line-height: 1.7 !important;
    }

    /* 인용구 */
    .blogger-gpt-content blockquote {
      display: block !important;
      visibility: visible !important;
      color: #334155 !important;
      -webkit-text-fill-color: #334155 !important;
      margin: 28px 0 !important;
      padding: 20px 24px !important;
      background: #f8fafc !important;
      border-left: 4px solid #94a3b8 !important;
      border-radius: 0 6px 6px 0 !important;
      font-size: 17px !important;
      line-height: 1.85 !important;
    }

    /* 강조 */
    .blogger-gpt-content strong,
    .blogger-gpt-content b {
      display: inline !important;
      visibility: visible !important;
      color: #0f172a !important;
      -webkit-text-fill-color: #0f172a !important;
      font-weight: 700 !important;
    }

    .blogger-gpt-content em,
    .blogger-gpt-content i {
      display: inline !important;
      visibility: visible !important;
      font-style: italic !important;
    }

    /* 링크 */
    .blogger-gpt-content a {
      display: inline !important;
      visibility: visible !important;
      color: #0891b2 !important;
      -webkit-text-fill-color: #0891b2 !important;
      text-decoration: none !important;
      border-bottom: 1px solid #99f6e4 !important;
      font-weight: 600 !important;
    }

    /* 이미지 */
    .blogger-gpt-content img {
      max-width: 100% !important;
      height: auto !important;
      display: block !important;
      margin: 32px auto !important;
      border-radius: 6px !important;
    }

    /* 반응형 */
    @media (max-width: 768px) {
      .blogger-gpt-content {
        max-width: 100% !important;
        padding: 0 16px !important;
      }
      .blogger-gpt-content h2 { font-size: 19px !important; }
      .blogger-gpt-content h3 { font-size: 17px !important; }
      .blogger-gpt-content p { font-size: 16px !important; line-height: 1.8 !important; }
      .blogger-gpt-content table {
        display: block !important;
        overflow-x: auto !important;
      }
    }
  `;
}

// 이전 복잡한 CSS 함수 - 사용하지 않음
function generateBloggerLayoutCSS_LEGACY_UNUSED() {
  return `
    /* LEGACY - 사용하지 않음 */
    .premium-typography p {
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 1.1rem;
      line-height: 1.8;
      color: #333;
      margin-bottom: 1.5rem;
    }

    /* 독보적 CTA 디자인 시스템 */
    .premium-cta-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 15px;
      padding: 16px 32px;
      font-size: 1.1rem;
      font-weight: 600;
      color: white;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
      position: relative;
      overflow: hidden;
    }

    .premium-cta-primary::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .premium-cta-primary:hover::before {
      left: 100%;
    }

    .premium-cta-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
    }

    /* 독보적 시각화 시스템 */
    .premium-chart-container {
      background: linear-gradient(145deg, #ffffff 0%, #f8f9ff 100%);
      border-radius: 16px;
      padding: 30px;
      margin: 30px 0;
      box-shadow:
        0 10px 30px rgba(0,0,0,0.1),
        inset 0 1px 0 rgba(255,255,255,0.8);
      position: relative;
    }

    .premium-chart-container::before {
      content: '📊 프리미엄 데이터 시각화';
      position: absolute;
      top: -12px;
      left: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    /* 독보적 테이블 디자인 */
    .premium-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 25px rgba(0,0,0,0.1);
      margin: 20px 0;
    }

    .premium-table th {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      font-weight: 600;
      font-size: 1rem;
      text-align: left;
      border: none;
    }

    .premium-table td {
      padding: 16px;
      border-bottom: 1px solid #e5e7eb;
      background: white;
      transition: background-color 0.2s;
    }

    .premium-table tr:hover td {
      background: #f8f9ff;
    }

    /* 독보적 체크리스트 */
    .premium-checklist {
      background: linear-gradient(145deg, #f0f9ff 0%, #e0f2fe 100%);
      border: 2px solid #0ea5e9;
      border-radius: 16px;
      padding: 30px;
      margin: 30px 0;
      position: relative;
    }

    .premium-checklist::before {
      content: '✅ 스마트 체크리스트';
      position: absolute;
      top: -12px;
      left: 20px;
      background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .premium-checklist-item {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid rgba(14, 165, 233, 0.2);
      transition: all 0.2s;
    }

    .premium-checklist-item:hover {
      background: rgba(14, 165, 233, 0.05);
      border-radius: 8px;
      padding-left: 12px;
      margin-left: -12px;
      margin-right: -12px;
    }

    .premium-checklist-item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin-right: 16px;
      accent-color: #0ea5e9;
    }

    /* 핵 옵션 1: 모든 Blogger 컨테이너 완전 오버라이드 - 극한 우선순위 */
    html body .post-outer .post-body,
    html body .post-outer .entry-content,
    html body .post-outer .post-content,
    html body .blog-posts .post-outer .post,
    html body .blog-posts .post-outer .entry,
    html body div.post-outer div.post-body,
    html body div.post-outer div.entry-content,
    html body div.blog-post div.post-body,
    html body div.blog-post div.entry-content,
    .post-body, .entry-content, .post-content,
    .post-outer, .blog-post, .article-body, .content-section,
    .main, .content, .wrapper, .container, .row, .col, .column,
    /* 추가 핵 옵션: Blogger 실제 DOM 구조 */
    #Blog1 .post-outer .post-body,
    #Blog1 .post-outer .entry-content,
    .blog-posts .post-outer .post-body,
    .blog-posts .post-outer .entry-content,
    .post-outer-container .post-body,
    .post-outer-container .entry-content,
    /* 모든 가능한 컨테이너 강제 오버라이드 */
    * .post-body, * .entry-content, * .post-content,
    div.post-body, div.entry-content, div.post-content {
      max-width: 100% !important;
      width: 100% !important;
      min-width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      /* 추가 핵: Blogger CSS 우선순위 극복 */
      display: block !important;
      position: relative !important;
      float: none !important;
      clear: both !important;
    }

/* 핵 옵션 2: 콘텐츠 영역 완전 강제 - 텍스트 표시 핵 */
.post-body .max-mode-article,
.post-body .premium-article,
.post-body .article-content,
.entry-content .max-mode-article,
.entry-content .premium-article,
.entry-content .article-content,
.post-content .max-mode-article,
.post-content .premium-article,
.post-content .article-content,
.post-outer .post-body .max-mode-article,
.post-outer .post-body .premium-article,
.post-outer .post-body .article-content,
.blog-post .post-body .max-mode-article,
.blog-post .post-body .premium-article,
.blog-post .post-body .article-content,
.article-body .max-mode-article,
.article-body .premium-article,
.article-body .article-content,
.content-section .max-mode-article,
.content-section .premium-article,
.content-section .article-content,
.max-mode-article, .premium-article, .article-content,
/* 추가 핵: Blogger 텍스트 표시 강제 */
* .max-mode-article, * .premium-article, * .article-content,
div.max-mode-article, div.premium-article, div.article-content {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 0px 72px 0px !important;
  box-sizing: border-box !important;
  display: block !important;
  text-align: left !important;
  overflow: visible !important;
  float: none !important;
  clear: both !important;
  /* 텍스트 표시 핵 */
  visibility: visible !important;
  opacity: 1 !important;
  color: inherit !important;
  font-family: inherit !important;
  line-height: inherit !important;
}

/* 핵 옵션 3: ID 기반 고 우선순위 오버라이드 */
#Blog1 .post-body,
#Blog1 .entry-content,
#Blog1 .post-content,
#Blog1 .max-mode-article,
#Blog1 .premium-article,
#Blog1 .article-content,
div[role="main"] .post-body,
div[role="main"] .entry-content,
div[role="main"] .post-content,
div[role="main"] .max-mode-article,
div[role="main"] .premium-article,
div[role="main"] .article-content {
  max-width: 100% !important;
  width: 100% !important;
  margin: 0 !important;
  padding: 0 0px 72px 0px !important;
  box-sizing: border-box !important;
  overflow: visible !important;
}

/* 핵 옵션 4: 모든 하위 div 요소 강제 */
.post-body div, .entry-content div, .post-content div,
.post-outer div, .blog-post div, .article-body div, .content-section div,
.max-mode-article div, .premium-article div, .article-content div {
  max-width: 100% !important;
  width: 100% !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  box-sizing: border-box !important;
  overflow: visible !important;
}

/* 핵 옵션 4.5: 타이포그래피 핵 - 텍스트 크기와 문단 정리 강제 */
.post-body .max-mode-article h1, .post-body .max-mode-article h2,
.post-body .max-mode-article h3, .post-body .max-mode-article h4,
.post-body .max-mode-article h5, .post-body .max-mode-article h6,
.post-body .max-mode-article p, .post-body .max-mode-article span,
.post-body .max-mode-article div, .post-body .max-mode-article li,
.entry-content .max-mode-article h1, .entry-content .max-mode-article h2,
.entry-content .max-mode-article h3, .entry-content .max-mode-article h4,
.entry-content .max-mode-article h5, .entry-content .max-mode-article h6,
.entry-content .max-mode-article p, .entry-content .max-mode-article span,
.entry-content .max-mode-article div, .entry-content .max-mode-article li,
.post-content .max-mode-article h1, .post-content .max-mode-article h2,
.post-content .max-mode-article h3, .post-content .max-mode-article h4,
.post-content .max-mode-article h5, .post-content .max-mode-article h6,
.post-content .max-mode-article p, .post-content .max-mode-article span,
.post-content .max-mode-article div, .post-content .max-mode-article li,
.max-mode-article h1, .max-mode-article h2, .max-mode-article h3,
.max-mode-article h4, .max-mode-article h5, .max-mode-article h6,
.max-mode-article p, .max-mode-article span, .max-mode-article div,
.max-mode-article li, .premium-article h1, .premium-article h2,
.premium-article h3, .premium-article h4, .premium-article h5,
.premium-article h6, .premium-article p, .premium-article span,
.premium-article div, .premium-article li, .article-content h1,
.article-content h2, .article-content h3, .article-content h4,
.article-content h5, .article-content h6, .article-content p,
.article-content span, .article-content div, .article-content li,
/* 추가 핵: Blogger 텍스트 요소 강제 */
* .max-mode-article h1, * .max-mode-article h2, * .max-mode-article h3,
* .max-mode-article p, * .max-mode-article span, * .max-mode-article div,
* .premium-article h1, * .premium-article h2, * .premium-article h3,
* .premium-article p, * .premium-article span, * .premium-article div,
* .article-content h1, * .article-content h2, * .article-content h3,
* .article-content p, * .article-content span, * .article-content div {
  /* 텍스트 표시 핵 */
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  color: inherit !important;
  font-family: inherit !important;
  line-height: 1.6 !important;
  margin: inherit !important;
  padding: inherit !important;
  /* Blogger 텍스트 크기 핵 */
  font-size: inherit !important;
  font-weight: inherit !important;
  text-align: inherit !important;
  /* 추가 핵: Blogger 오버라이드 방지 */
  -webkit-text-size-adjust: 100% !important;
  -ms-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
}

/* 핵 옵션 5: 미디어 쿼리별 완전 오버라이드 */
@media (min-width: 1200px) {
  html body .post-outer .post-body,
  html body .post-outer .entry-content,
  html body .post-outer .post-content,
  .post-body, .entry-content, .post-content {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .max-mode-article, .premium-article, .article-content {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 0px 72px 0px !important;
    margin: 0 auto !important;
    overflow: visible !important;
  }
}

@media (min-width: 768px) and (max-width: 1199px) {
  html body .post-outer .post-body,
  html body .post-outer .entry-content,
  html body .post-outer .post-content,
  .post-body, .entry-content, .post-content {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .max-mode-article, .premium-article, .article-content {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 0px 72px 0px !important;
    margin: 0 auto !important;
    overflow: visible !important;
  }
}

@media (max-width: 767px) {
  html body .post-outer .post-body,
  html body .post-outer .entry-content,
  html body .post-outer .post-content,
  .post-body, .entry-content, .post-content {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .max-mode-article, .premium-article, .article-content {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 0px 72px 0px !important;
    margin: 0 auto !important;
    overflow: visible !important;
  }

    /* ========================================
       독보적 반응형 시스템 & 다크모드 지원
       ======================================== */

    /* 모바일 최적화 */
    @media (max-width: 768px) {
      .premium-content-wrapper {
        padding: 20px;
        margin: 10px 0;
        border-radius: 12px;
      }

      .premium-typography h1 {
        font-size: 2rem;
      }

      .premium-typography h2 {
        font-size: 1.5rem;
        padding-left: 15px;
      }

      .premium-cta-primary {
        padding: 14px 24px;
        font-size: 1rem;
      }

      .premium-chart-container {
        padding: 20px;
        margin: 20px 0;
      }

      .premium-checklist {
        padding: 20px;
        margin: 20px 0;
      }
    }

    /* 태블릿 최적화 */
    @media (min-width: 769px) and (max-width: 1024px) {
      .premium-content-wrapper {
        padding: 30px;
        margin: 15px 0;
      }

      .premium-typography h1 {
        font-size: 2.2rem;
      }

      .premium-typography h2 {
        font-size: 1.8rem;
      }
    }

    /* 독보적 다크모드 지원 (사용자 선택적) */
    @media (prefers-color-scheme: dark) {
      .premium-content-wrapper {
        background: linear-gradient(145deg, #1a1a1a 0%, #2a2a2a 100%);
        border-image: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #f5576c) 1;
      }

      .premium-typography p {
        color: #e5e5e5;
      }

      .premium-typography h2 {
        color: #ffffff;
      }

      .premium-table td {
        background: #2a2a2a;
        color: #e5e5e5;
        border-bottom-color: #404040;
      }

      .premium-table tr:hover td {
        background: #333333;
      }

      .premium-checklist {
        background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
        border-color: #0ea5e9;
      }
    }

    /* 독보적 애니메이션 시스템 */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideInLeft {
      from {
        opacity: 0;
        transform: translateX(-30px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .premium-content-wrapper {
      animation: fadeInUp 0.8s ease-out;
    }

    .premium-typography h2 {
      animation: slideInLeft 0.6s ease-out;
    }

    /* 독보적 인터랙션 효과 */
    .premium-cta-primary:active {
      transform: translateY(0);
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }

    /* 독보적 포커스 상태 */
    .premium-cta-primary:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
    }
  }`;
}

// 블로그스팟 인증 상태 확인 함수 (캐싱 최적화)
async function checkBloggerAuthStatus() {
  try {
    const now = Date.now();
    if (authCache.data && (now - authCache.timestamp) < authCache.ttl) {
      console.log('[AUTH] 캐시된 인증 상태 사용');
      return authCache.data;
    }

    if (typeof window !== 'undefined' && window.blogger) {
      const checkAuth = window.blogger.checkBloggerAuthStatus || window.blogger.checkBloggerAuth;
      if (checkAuth) {
        const result = await checkAuth();
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    }

    const fs = require('fs');
    const path = require('path');
    let tokenPath;
    try {
      const { app } = require('electron');
      tokenPath = path.join(app.getPath('userData'), 'blogger-token.json');
      console.log('[AUTH] 토큰 파일 경로 (Electron):', tokenPath);
    } catch (e) {
      let userDataPath;
      if (process.platform === 'win32') {
        userDataPath = path.join(process.env.APPDATA || process.env.USERPROFILE || '', 'lba');
      } else if (process.platform === 'darwin') {
        userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'blogger-gpt-cli');
      } else {
        userDataPath = path.join(process.env.HOME || process.env.XDG_CONFIG_HOME || '', '.config', 'blogger-gpt-cli');
      }
      tokenPath = path.join(userDataPath, 'blogger-token.json');
      console.log('[AUTH] 토큰 파일 경로 (Node.js):', tokenPath);
    }

    if (!fs.existsSync(tokenPath)) {
      console.log('[AUTH] 토큰 파일이 존재하지 않습니다:', tokenPath);
      const result = { authenticated: false, error: '토큰 파일이 없습니다. 환경설정에서 Blogger OAuth2 인증을 진행해주세요.' };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }

    let tokenData;
    try {
      const tokenFileContent = fs.readFileSync(tokenPath, 'utf8');
      if (!tokenFileContent || tokenFileContent.trim().length === 0) {
        throw new Error('토큰 파일이 비어있습니다.');
      }
      const trimmed = tokenFileContent.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        throw new Error(`토큰 파일이 유효한 JSON 형식이 아닙니다. 시작 문자: "${trimmed.substring(0, 10)}"`);
      }
      tokenData = JSON.parse(tokenFileContent);
    } catch (parseError) {
      const errorMsg = parseError?.message || String(parseError || '알 수 없는 오류');
      console.error('[AUTH] 토큰 파일 파싱 오류:', errorMsg);
      if (errorMsg.includes('Unexpected token')) {
        console.error('[AUTH] 토큰 파일이 손상되었습니다. 환경설정에서 인증을 다시 진행해주세요.');
        const result = {
          authenticated: false,
          error: '토큰 파일이 손상되었습니다. 환경설정에서 인증을 다시 진행해주세요.'
        };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
      const result = { authenticated: false, error: `토큰 파일 파싱 실패: ${errorMsg}` };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }

    if (!tokenData.access_token) {
      const result = { authenticated: false, error: '액세스 토큰이 없습니다.' };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }

    // 토큰 만료 시간 확인 (expires_at 필드 확인)
    if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
      // 토큰이 만료되었지만 refresh_token이 있으면 갱신 가능
      if (tokenData.refresh_token) {
        console.log('[AUTH] 토큰 만료되었지만 refresh_token이 있어 갱신 가능');
        const result = { authenticated: true, tokenData, needsRefresh: true };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else {
        const result = { authenticated: false, error: '토큰이 만료되었습니다. 재인증이 필요합니다.' };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    }

    // 토큰 만료 시간 확인 (파일 수정 시간 기준으로 빠른 체크)
    const tokenModifiedTime = fs.statSync(tokenPath).mtimeMs;
    const tokenAge = now - tokenModifiedTime;

    // 토큰이 최근에 생성/갱신되었고 만료되지 않았을 가능성이 높으면 유효성 검증 생략 (성능 최적화)
    if (tokenAge < 3600000) { // 1시간 이내
      // 빠른 검증: 토큰이 있으면 유효하다고 가정 (실제 API 호출 생략)
      const result = { authenticated: true, tokenData };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }

    // 오래된 토큰은 실제 검증 수행
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃

      const response = await fetch('https://www.googleapis.com/blogger/v3/users/self', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = { authenticated: true, tokenData };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else if (response.status === 401) {
        const result = { authenticated: false, error: '토큰이 만료되었습니다.' };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      } else {
        const result = { authenticated: false, error: `API 호출 실패 (${response.status})` };
        authCache.data = result;
        authCache.timestamp = now;
        return result;
      }
    } catch (apiError) {
      // 네트워크 오류나 타임아웃 시 캐시 무효화하지 않고 기존 토큰 사용
      if (apiError.name === 'AbortError') {
        console.log('[AUTH] 토큰 검증 타임아웃, 캐시된 상태 사용');
        return authCache.data || { authenticated: true, tokenData }; // 캐시가 있으면 사용, 없으면 토큰이 있으니 유효하다고 가정
      }
      console.error('토큰 유효성 검증 실패:', apiError);
      const result = { authenticated: false, error: '토큰 유효성 검증 실패' };
      authCache.data = result;
      authCache.timestamp = now;
      return result;
    }

  } catch (error) {
    console.error('checkBloggerAuthStatus 오류:', error);
    const result = { authenticated: false, error: error?.message || '인증 상태 확인 실패' };
    authCache.data = result;
    authCache.timestamp = Date.now();
    return result;
  }
}

// 인증 캐시 무효화 함수 (토큰 갱신 시 사용)
function clearAuthCache() {
  authCache.data = null;
  authCache.timestamp = 0;
}

/**
 * Blogger API를 사용하여 블로그 포스트를 발행하는 함수
 */
async function uploadDataUrlThumbnail(bloggerClient, blogId, dataUrl, onLog) {
  // blogId 검증 (undefined 체크 포함)
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

    console.log(`[PUBLISH] [이미지 업로드] data:image 썸네일 업로드 시작...`);
    console.log(`[PUBLISH]    - MIME 타입: ${mimeType}`);
    console.log(`[PUBLISH]    - 이미지 크기: ${(buffer.length / 1024).toFixed(2)}KB`);
    console.log(`[PUBLISH]    - Blog ID: ${blogIdString}`);

    const uploadResponse = await bloggerClient.media.insert({
      blogId: blogIdString, // 명시적으로 지정하여 오타 방지
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
      console.log(`[PUBLISH] ✅ [이미지 업로드] 썸네일 업로드 성공: ${uploadedUrl.substring(0, 100)}...`);
      onLog?.('🖼️ 썸네일 이미지를 Blogger에 업로드했습니다.');
    } else {
      console.error(`[PUBLISH] ❌ [이미지 업로드] 썸네일 업로드 응답에 URL이 없습니다.`);
      console.error(`[PUBLISH]    - 응답 데이터:`, uploadResponse?.data ? JSON.stringify(uploadResponse.data).substring(0, 200) : '없음');
      onLog?.('⚠️ 썸네일 업로드 응답에 URL이 없습니다. 데이터 URL을 그대로 사용합니다.');
    }
    return uploadedUrl;
  } catch (error) {
    const errorMessage = error?.message || String(error);
    const errorCode = error?.code || error?.status || 'N/A';
    const errorResponse = error?.response?.data ? JSON.stringify(error.response.data).substring(0, 300) : '없음';

    console.error(`[PUBLISH] ❌ [이미지 업로드] 썸네일 업로드 실패:`);
    console.error(`[PUBLISH]    - 오류 메시지: ${errorMessage}`);
    console.error(`[PUBLISH]    - 오류 코드: ${errorCode}`);
    console.error(`[PUBLISH]    - 응답 데이터: ${errorResponse}`);
    console.error(`[PUBLISH]    - Blog ID: ${blogIdString}`);
    console.error(`[PUBLISH]    - MIME 타입: ${mimeType}`);

    onLog?.(`⚠️ 썸네일 업로드 실패: ${errorMessage} (코드: ${errorCode})`);
    return null;
  }
}

async function uploadExternalImage(bloggerClient, blogId, imageUrl, onLog) {
  try {
    if (!imageUrl || /^data:/i.test(imageUrl)) {
      console.log(`[PUBLISH] [외부 이미지] 업로드 건너뜀: data:image 또는 URL 없음`);
      return null;
    }

    console.log(`[PUBLISH] [외부 이미지] 외부 이미지 업로드 시작: ${imageUrl.substring(0, 100)}...`);

    // bloggerClient 검증
    if (!bloggerClient) {
      console.error(`[PUBLISH] ❌ [외부 이미지] bloggerClient가 정의되지 않았습니다.`);
      onLog?.('⚠️ uploadExternalImage: bloggerClient가 정의되지 않았습니다.');
      return null;
    }

    // media.insert 메서드 존재 확인 - 없으면 원본 URL 그대로 사용 (Blogger는 외부 이미지 URL 허용)
    if (!bloggerClient.media || typeof bloggerClient.media.insert !== 'function') {
      console.log(`[PUBLISH] ℹ️ Blogger API에 media.insert 없음 → 외부 URL 직접 사용: ${imageUrl.substring(0, 60)}...`);
      return imageUrl; // 🔥 null 대신 원본 URL 반환
    }

    console.log(`[PUBLISH] [외부 이미지] 이미지 다운로드 시도: ${imageUrl.substring(0, 100)}...`);
    const res = await fetch(imageUrl, { method: 'GET' });
    if (!res.ok) {
      console.error(`[PUBLISH] ❌ [외부 이미지] 이미지 다운로드 실패: HTTP ${res.status} ${res.statusText}`);
      console.error(`[PUBLISH]    - URL: ${imageUrl.substring(0, 150)}`);
      onLog?.(`⚠️ 외부 이미지 다운로드 실패: ${res.status}`);
      return null;
    }
    console.log(`[PUBLISH] ✅ [외부 이미지] 이미지 다운로드 성공: ${res.headers.get('content-type') || '알 수 없음'}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { Readable } = require('stream');
    const stream = Readable.from(buffer);
    const blogIdString = String(blogId).trim();
    console.log(`[PUBLISH] [외부 이미지] Blogger 업로드 시작 (크기: ${(buffer.length / 1024).toFixed(2)}KB, 타입: ${contentType})`);
    const uploadResponse = await bloggerClient.media.insert({
      blogId: blogIdString,
      resource: { kind: 'blogger#media' },
      media: { mimeType: contentType, body: stream }
    });
    const uploadedUrl = uploadResponse?.data?.url || uploadResponse?.data?.imageUrl || uploadResponse?.data?.selfLink || null;
    if (uploadedUrl) {
      console.log(`[PUBLISH] ✅ [외부 이미지] 재호스팅 성공: ${uploadedUrl.substring(0, 100)}...`);
      onLog?.('🖼️ 외부 이미지를 Blogger에 재호스팅했습니다.');
    } else {
      console.error(`[PUBLISH] ❌ [외부 이미지] 업로드 응답에 URL이 없습니다.`);
      console.error(`[PUBLISH]    - 응답 데이터:`, uploadResponse?.data ? JSON.stringify(uploadResponse.data).substring(0, 200) : '없음');
    }
    return uploadedUrl;
  } catch (e) {
    const errorMessage = e?.message || String(e);
    const errorCode = e?.code || e?.status || 'N/A';
    const errorResponse = e?.response?.data ? JSON.stringify(e.response.data).substring(0, 300) : '없음';

    console.error(`[PUBLISH] ❌ [외부 이미지] 재호스팅 실패:`);
    console.error(`[PUBLISH]    - 오류 메시지: ${errorMessage}`);
    console.error(`[PUBLISH]    - 오류 코드: ${errorCode}`);
    console.error(`[PUBLISH]    - 응답 데이터: ${errorResponse}`);
    console.error(`[PUBLISH]    - 원본 URL: ${imageUrl.substring(0, 150)}`);

    onLog?.(`⚠️ 외부 이미지 재호스팅 실패: ${errorMessage} (코드: ${errorCode})`);
    return null;
  }
}

async function publishToBlogger(payload, title, html, thumbnailUrl, onLog, postingStatus = 'publish', scheduleDate = null) {
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
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    const errorMsg = '제목이 비어있습니다. 제목을 입력해주세요.';
    onLog?.(`❌ ${errorMsg}`);
    return {
      ok: false,
      error: errorMsg
    };
  }

  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    const errorMsg = '콘텐츠가 비어있습니다. 콘텐츠를 입력해주세요.';
    onLog?.(`❌ ${errorMsg}`);
    return {
      ok: false,
      error: errorMsg
    };
  }


  const textLength = calculateTextLength(html).length;
  const htmlLength = html?.length || 0;
  const cssMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const cssLength = cssMatch && cssMatch[1] ? cssMatch[1].length : 0;

  // postingStatus를 로그에 기록
  console.log(`[PUBLISH] publishToBlogger 함수 호출됨`);
  console.log(`[PUBLISH] postingStatus: ${postingStatus}, scheduleDate: ${scheduleDate ? scheduleDate.toISOString() : 'null'}`);
  console.log(`[PUBLISH] title: ${title}`);
  console.log(`[PUBLISH] 텍스트 길이: ${textLength}자 (CSS 제외)`);
  console.log(`[PUBLISH] HTML 길이: ${htmlLength}자 (전체)`);
  console.log(`[PUBLISH] CSS 길이: ${cssLength}자`);
  onLog?.(`[PUBLISH] publishToBlogger 함수 호출됨`);
  onLog?.(`[PUBLISH] postingStatus: ${postingStatus}`);
  onLog?.(`[PUBLISH] 제목: ${title}`);
  onLog?.(`[PUBLISH] 텍스트 길이: ${textLength.toLocaleString()}자 (CSS 제외, API 제한 체크용)`);
  onLog?.(`[PUBLISH] HTML 전체 길이: ${htmlLength.toLocaleString()}자 (CSS 포함)`);

  // Blogger API 제한 체크 (이중 체크)
  const BLOGGER_TEXT_LIMIT = 50000; // 순수 텍스트 기준 제한
  const BLOGGER_HTML_LIMIT = 100000; // 전체 HTML 크기 제한 (안전 마진 포함, 실제는 더 클 수 있음)

  // 1. 순수 텍스트 체크
  if (textLength > BLOGGER_TEXT_LIMIT) {
    const errorMsg = `⚠️ 순수 텍스트 초과: ${textLength.toLocaleString()}자 (제한: ${BLOGGER_TEXT_LIMIT.toLocaleString()}자). 본문을 줄여주세요.`;
    onLog?.(errorMsg);
    console.warn(`[PUBLISH] ${errorMsg}`);
  }

  // 2. 전체 HTML 크기 체크 (CSS 포함)
  if (htmlLength > BLOGGER_HTML_LIMIT) {
    const errorMsg = `⚠️ 전체 HTML 크기 초과: ${htmlLength.toLocaleString()}자 (제한: ${BLOGGER_HTML_LIMIT.toLocaleString()}자). CSS 압축 또는 본문 축소가 필요합니다.`;
    onLog?.(errorMsg);
    console.warn(`[PUBLISH] ${errorMsg}`);
    onLog?.(`[PUBLISH] CSS 크기: ${cssLength.toLocaleString()}자 (${((cssLength / htmlLength) * 100).toFixed(1)}%)`);
  }

  // 3. 경고 레벨 체크 (80% 이상 사용 시)
  if (htmlLength > BLOGGER_HTML_LIMIT * 0.8) {
    const usagePercent = ((htmlLength / BLOGGER_HTML_LIMIT) * 100).toFixed(1);
    onLog?.(`⚠️ 전체 HTML 크기가 제한의 80% 이상입니다. (${usagePercent}% 사용)`);
    onLog?.(`⚠️ 현재: 텍스트 ${textLength.toLocaleString()}자, CSS ${cssLength.toLocaleString()}자, 전체 ${htmlLength.toLocaleString()}자`);
  }

  // 4. 쇼핑몰 크롤링 주의사항 경고
  if (html.includes('쇼핑') || html.includes('커넥트') || html.includes('크롤링')) {
    onLog?.(`⚠️ 주의사항: 다른 쇼핑몰부터 완성 수동크롤링에 주의하세요. 쇼핑커넥트는 보안이 강하여 실패할 수 있습니다.`);
  }

  // 5. 안전 정보 표시
  const textUsagePercent = ((textLength / BLOGGER_TEXT_LIMIT) * 100).toFixed(1);
  const htmlUsagePercent = ((htmlLength / BLOGGER_HTML_LIMIT) * 100).toFixed(1);
  onLog?.(`[PUBLISH] 크기 정보: 텍스트 ${textUsagePercent}% 사용, 전체 HTML ${htmlUsagePercent}% 사용`);

  // blogId와 body를 try 블록 밖에서 선언하여 catch 블록에서도 접근 가능하도록 함
  let blogId = '';
  let clientId = '';
  let clientSecret = '';
  let body = null;
  let isDraftMode = false;
  let isScheduleMode = false;

  function loadEnvFromFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      let userDataPath;

      // Electron이 사용 가능한지 확인
      try {
        const electronApp = require('electron');
        if (electronApp && electronApp.app) {
          userDataPath = electronApp.app.getPath('userData');
        } else {
          throw new Error('Electron app not available');
        }
      } catch (e) {
        // Electron이 없으면 직접 경로 계산
        if (process.platform === 'win32') {
          userDataPath = path.join(process.env.APPDATA || process.env.USERPROFILE || '', 'lba');
        } else if (process.platform === 'darwin') {
          userDataPath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'blogger-gpt-cli');
        } else {
          userDataPath = path.join(process.env.HOME || process.env.XDG_CONFIG_HOME || '', '.config', 'blogger-gpt-cli');
        }
      }

      const envPath = path.join(userDataPath, '.env');

      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const envVars = {};
        envContent.split('\n').forEach(line => {
          const match = line.match(/^([^#=]+)=(.+)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            envVars[key] = value;
          }
        });
        console.log('[PUBLISH] .env 파일에서 환경변수 로드 완료');
        return envVars;
      }
    } catch (error) {
      console.warn('[PUBLISH] .env 파일 로드 실패:', error?.message || error);
    }
    return {};
  }

  try {
    onLog?.('🔐 Blogger API 인증 중...');

    // 먼저 인증 상태 확인
    console.log('[PUBLISH] 인증 상태 확인 시작...');
    const authStatus = await checkBloggerAuthStatus();
    console.log('[PUBLISH] 인증 상태:', authStatus);

    // 인증 상태에 따른 상세 처리
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

    // 토큰 만료 임박 경고 (1시간 이내 만료 예정)
    if (authStatus.tokenData?.expires_at) {
      const expiresIn = authStatus.tokenData.expires_at - Date.now();
      const oneHour = 60 * 60 * 1000; // 1시간
      const thirtyMinutes = 30 * 60 * 1000; // 30분

      if (expiresIn > 0) {
        if (expiresIn < thirtyMinutes) {
          // 30분 이내 만료: 긴급 알림
          onLog?.(`🚨 긴급: Blogger 인증이 ${Math.round(expiresIn / 60000)}분 후 만료됩니다!`);
          // 메인 프로세스에 알림 전송
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.send('blogger-auth-expiring-soon', {
              minutesLeft: Math.round(expiresIn / 60000),
              expiresAt: new Date(authStatus.tokenData.expires_at)
            });
          }
        } else if (expiresIn < oneHour) {
          // 1시간 이내 만료: 경고
          onLog?.(`⚠️ Blogger 인증이 ${Math.round(expiresIn / 60000)}분 후 만료됩니다. 자동 갱신을 시도합니다.`);
        }
      } else {
        // 이미 만료됨: 즉시 알림
        onLog?.(`❌ Blogger 인증이 만료되었습니다! 재인증이 필요합니다.`);
        if (typeof window !== 'undefined' && window.electronAPI) {
          window.electronAPI.send('blogger-auth-expired', {
            expiredAt: new Date(authStatus.tokenData.expires_at)
          });
        }
      }
    }

    // 토큰 갱신이 필요한 경우 자동 갱신 시도
    if (authStatus.needsRefresh) {
      onLog?.('🔄 토큰이 만료되었습니다. 자동 갱신을 시도합니다...');
    } else {
      onLog?.('✅ 블로그스팟 인증 확인됨');
    }

    // payload에서 먼저 읽고, 없으면 환경변수에서 읽기
    const envVars = loadEnvironmentVariables();

    // 🔥 키 이름 호환성: camelCase와 UPPER_CASE 모두 지원
    clientId = String(
      payload.googleClientId ||
      envVars.GOOGLE_CLIENT_ID ||
      envVars.googleClientId ||  // camelCase 지원
      envVars.google_client_id || // snake_case 지원
      process.env.GOOGLE_CLIENT_ID ||
      ''
    ).trim();

    clientSecret = String(
      payload.googleClientSecret ||
      envVars.GOOGLE_CLIENT_SECRET ||
      envVars.googleClientSecret ||  // camelCase 지원
      envVars.google_client_secret || // snake_case 지원
      process.env.GOOGLE_CLIENT_SECRET ||
      ''
    ).trim();

    // 🔥 키 이름 호환성: 다양한 형식 지원
    blogId = String(
      payload.blogId ||
      envVars.BLOGGER_BLOG_ID ||  // 블로그스팟 ID (우선순위 1)
      envVars.bloggerBlogId ||    // camelCase
      envVars.GOOGLE_BLOG_ID ||   // Google Blog ID (우선순위 2)
      envVars.googleBlogId ||     // camelCase
      envVars.BLOG_ID ||          // 일반 BLOG_ID (우선순위 3)
      envVars.blogId ||           // camelCase
      process.env.BLOGGER_BLOG_ID ||
      process.env.GOOGLE_BLOG_ID ||
      process.env.BLOG_ID ||
      ''
    ).trim();

    // 환경변수에서 로드된 값 로깅
    if (!payload.googleClientId && (envVars.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)) {
      console.log('[PUBLISH] ✅ 환경변수에서 GOOGLE_CLIENT_ID 로드됨');
      onLog?.('[PUBLISH] ✅ 환경변수에서 GOOGLE_CLIENT_ID 로드됨');
    }
    if (!payload.googleClientSecret && (envVars.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)) {
      console.log('[PUBLISH] ✅ 환경변수에서 GOOGLE_CLIENT_SECRET 로드됨');
      onLog?.('[PUBLISH] ✅ 환경변수에서 GOOGLE_CLIENT_SECRET 로드됨');
    }
    if (!payload.blogId && (envVars.BLOGGER_BLOG_ID || envVars.GOOGLE_BLOG_ID || envVars.BLOG_ID || process.env.BLOGGER_BLOG_ID || process.env.GOOGLE_BLOG_ID || process.env.BLOG_ID)) {
      console.log('[PUBLISH] ✅ 환경변수에서 BLOG_ID 로드됨:', blogId);
      onLog?.(`[PUBLISH] ✅ 환경변수에서 BLOG_ID 로드됨: ${blogId}`);
    }

    if (!clientId || !clientSecret) {
      console.error('[PUBLISH] ❌ Google OAuth2 Client 정보 누락');
      console.error('[PUBLISH] clientId:', clientId ? '있음' : '없음');
      console.error('[PUBLISH] clientSecret:', clientSecret ? '있음' : '없음');
      onLog?.('❌ Google OAuth2 Client 정보가 설정되지 않았습니다.');
      onLog?.('⚠️ 해결 방법:');
      onLog?.('   1. 환경설정 탭으로 이동');
      onLog?.('   2. Google Client ID와 Client Secret 입력');
      onLog?.('   3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성 필요');
      return {
        ok: false,
        error: 'Google OAuth2 Client ID/Secret이 누락되었습니다. 환경 설정에서 값을 입력해주세요.'
      };
    }

    if (!blogId) {
      console.error('[PUBLISH] ❌ Blogger Blog ID 누락');
      onLog?.('❌ Blogger Blog ID가 설정되지 않았습니다.');
      onLog?.('⚠️ 해결 방법:');
      onLog?.('   1. 블로그스팟 블로그 URL 확인 (예: https://example.blogspot.com)');
      onLog?.('   2. 블로그 설정 > 기본 설정에서 블로그 ID 확인');
      onLog?.('   3. 환경설정 탭에서 Blog ID 입력 (숫자로만 구성)');
      return {
        ok: false,
        error: 'Blogger Blog ID가 비어 있습니다. 환경 설정에서 Blog ID를 입력해주세요.'
      };
    }

    console.log('[PUBLISH] ✅ 필수 설정 확인 완료');
    console.log('[PUBLISH] Blog ID:', blogId);
    console.log('[PUBLISH] Client ID:', clientId ? `${clientId.substring(0, 20)}...` : '없음');

    // OAuth2 클라이언트 설정
    const { OAuth2Client } = require('google-auth-library');
    // 🔥 로컬 서버 기반 redirect_uri (OOB deprecated 대응)
    const oauth2Client = new OAuth2Client(
      clientId,
      clientSecret,
      'http://127.0.0.1:58392/callback'
    );

    // 🔥 payload에서 전달된 토큰 우선 사용, 없으면 저장된 토큰 사용
    let accessToken = payload.googleAccessToken || authStatus.tokenData?.access_token;
    let refreshToken = payload.googleRefreshToken || authStatus.tokenData?.refresh_token;

    console.log(`[PUBLISH] 토큰 소스: payload=${!!payload.googleRefreshToken}, authStatus=${!!authStatus.tokenData?.refresh_token}`);

    // 토큰이 없거나 만료되었고 갱신이 필요한 경우
    if (!accessToken || authStatus.needsRefresh) {
      try {
        const fs = require('fs');
        const path = require('path');

        // 🔥 Electron 또는 Node.js 환경 모두 지원
        let tokenPath;
        try {
          const { app } = require('electron');
          tokenPath = path.join(app.getPath('userData'), 'blogger-token.json');
        } catch {
          // Node.js 환경 (테스트 스크립트 등) - 앱 실제 경로 사용
          tokenPath = path.join(process.env.APPDATA || '', 'lba', 'blogger-token.json');
        }
        console.log(`[PUBLISH] 토큰 파일 경로: ${tokenPath}`);

        if (fs.existsSync(tokenPath)) {
          let savedTokens;
          try {
            const tokenFileContent = fs.readFileSync(tokenPath, 'utf8');
            if (!tokenFileContent || tokenFileContent.trim().length === 0) {
              throw new Error('토큰 파일이 비어있습니다.');
            }
            // JSON 파싱 전에 내용 확인
            const trimmed = tokenFileContent.trim();
            if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
              throw new Error(`토큰 파일이 유효한 JSON 형식이 아닙니다.`);
            }
            savedTokens = JSON.parse(tokenFileContent);
          } catch (parseError) {
            const errorMsg = parseError?.message || String(parseError || '알 수 없는 오류');
            onLog?.(`⚠️ 토큰 파일 파싱 실패: ${errorMsg}`);
            onLog?.('⚠️ 저장된 토큰 파일이 손상되었습니다. 환경설정에서 인증을 다시 진행해주세요.');
            // "Unexpected token" 오류인 경우 특별 처리
            if (errorMsg.includes('Unexpected token')) {
              return {
                ok: false,
                error: '토큰 파일이 손상되었습니다. 환경설정에서 인증을 다시 진행해주세요.',
                needsAuth: true
              };
            }
            return {
              ok: false,
              error: `토큰 파일 파싱 실패: ${errorMsg}. 환경설정에서 인증을 다시 진행해주세요.`,
              needsAuth: true
            };
          }

          // 토큰이 만료되었고 refresh_token이 있으면 갱신 시도
          if (savedTokens.expires_at && Date.now() > savedTokens.expires_at && savedTokens.refresh_token) {
            const expiredTime = Date.now() - savedTokens.expires_at;
            const expiredMinutes = Math.round(expiredTime / 60000);
            console.log(`[PUBLISH] [토큰 갱신] 토큰이 만료되었습니다. 갱신 시도...`);
            console.log(`[PUBLISH]    - 만료 시간: ${expiredMinutes}분 전`);
            console.log(`[PUBLISH]    - refresh_token 존재: ${!!savedTokens.refresh_token}`);
            onLog?.('🔄 토큰 갱신 중...');
            try {
              // 🔥 Electron 또는 Node.js 환경 모두 지원
              let envPath;
              try {
                const { app } = require('electron');
                envPath = path.join(app.getPath('userData'), '.env');
              } catch {
                envPath = path.join(process.env.APPDATA || '', 'lba', '.env');
              }
              const envContent = fs.readFileSync(envPath, 'utf8');
              const parseEnvFile = (content) => {
                const vars = {};
                content.split('\n').forEach(line => {
                  const match = line.match(/^([^#=]+)=(.+)$/);
                  if (match) vars[match[1].trim()] = match[2].trim();
                });
                return vars;
              };
              const envVars = parseEnvFile(envContent);

              // 🔥 payload에서 전달된 값 우선 사용, 없으면 .env에서 읽음
              const refreshClientId = clientId || envVars.GOOGLE_CLIENT_ID;
              const refreshClientSecret = clientSecret || envVars.GOOGLE_CLIENT_SECRET;

              console.log(`[PUBLISH] [토큰 갱신] 사용할 client_id: ${refreshClientId?.substring(0, 20)}...`);

              const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                  client_id: refreshClientId,
                  client_secret: refreshClientSecret,
                  refresh_token: savedTokens.refresh_token,
                  grant_type: 'refresh_token'
                })
              });

              if (refreshResponse.ok) {
                let newTokenData;
                try {
                  const responseText = await refreshResponse.text();
                  if (!responseText || responseText.trim().length === 0) {
                    throw new Error('토큰 갱신 응답이 비어있습니다.');
                  }
                  // JSON 파싱 전에 내용 확인
                  const trimmed = responseText.trim();
                  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
                    throw new Error(`토큰 갱신 응답이 유효한 JSON 형식이 아닙니다. 응답: ${trimmed.substring(0, 100)}`);
                  }
                  newTokenData = JSON.parse(responseText);

                  // 오류 응답 확인 (successful 응답도 error 필드를 포함할 수 있음)
                  if (newTokenData.error) {
                    const errorType = typeof newTokenData.error === 'string' ? newTokenData.error :
                      (newTokenData.error.error || newTokenData.error.type || 'unknown');

                    // invalid_grant 오류는 refresh_token이 유효하지 않다는 의미
                    if (errorType === 'invalid_grant' || errorType.toLowerCase().includes('invalid_grant')) {
                      const errorMsg = newTokenData.error_description || newTokenData.error.message || '토큰이 만료되었거나 유효하지 않습니다.';
                      onLog?.(`❌ 토큰 갱신 실패: ${errorMsg} (${errorType})`);
                      // invalid_grant 오류 발생 시 기존 토큰 사용 중단하고 인증 재진행 요구
                      throw new Error(`토큰 갱신 실패: ${errorMsg}. 환경설정에서 인증을 다시 진행해주세요.`);
                    }

                    // 기타 오류도 처리
                    const errorMsg = newTokenData.error_description || newTokenData.error.message || '토큰 갱신 실패';
                    throw new Error(`토큰 갱신 오류: ${errorMsg} (${errorType})`);
                  }
                } catch (parseError) {
                  const errorMsg = parseError?.message || String(parseError || '알 수 없는 오류');

                  // invalid_grant 오류인 경우 즉시 인증 재진행 요구
                  if (errorMsg.includes('invalid_grant') || errorMsg.toLowerCase().includes('invalid grant')) {
                    onLog?.(`❌ 토큰 갱신 실패: ${errorMsg}`);
                    throw new Error(`토큰이 만료되었거나 유효하지 않습니다. 환경설정에서 인증을 다시 진행해주세요.`);
                  }

                  onLog?.(`⚠️ 토큰 갱신 응답 파싱 실패: ${errorMsg}`);
                  onLog?.('⚠️ 토큰 갱신 실패, 기존 토큰 사용');
                  accessToken = savedTokens.access_token;
                  refreshToken = savedTokens.refresh_token;
                  // 파싱 오류가 발생해도 계속 진행 (invalid_grant가 아닌 경우만)
                  newTokenData = null; // 명시적으로 null 설정
                }

                if (newTokenData && newTokenData.access_token) {
                  const updatedTokenData = {
                    ...savedTokens,
                    ...newTokenData,
                    expires_at: Date.now() + (newTokenData.expires_in * 1000)
                  };
                  fs.writeFileSync(tokenPath, JSON.stringify(updatedTokenData, null, 2), 'utf8');
                  accessToken = updatedTokenData.access_token;
                  refreshToken = updatedTokenData.refresh_token || savedTokens.refresh_token;
                  const newExpiresIn = Math.round(newTokenData.expires_in / 60);
                  console.log(`[PUBLISH] ✅ [토큰 갱신] 토큰 갱신 성공`);
                  console.log(`[PUBLISH]    - 새 토큰 만료 시간: ${newExpiresIn}분 후`);
                  onLog?.('✅ 토큰 갱신 완료');
                } else {
                  console.error(`[PUBLISH] ❌ [토큰 갱신] 토큰 갱신 응답에 access_token이 없습니다.`);
                  console.error(`[PUBLISH]    - 응답 데이터:`, newTokenData ? JSON.stringify(newTokenData).substring(0, 200) : '없음');
                  onLog?.('⚠️ 토큰 갱신 응답에 access_token이 없습니다. 기존 토큰 사용');
                  accessToken = savedTokens.access_token;
                  refreshToken = savedTokens.refresh_token;
                }
              } else {
                // HTTP 오류 응답 처리
                const httpStatus = refreshResponse.status;
                console.error(`[PUBLISH] ❌ [토큰 갱신] HTTP 오류 응답: ${httpStatus}`);
                let errorMessage = `HTTP ${httpStatus} 오류`;
                try {
                  const errorText = await refreshResponse.text();
                  console.error(`[PUBLISH]    - 오류 응답 본문: ${errorText.substring(0, 300)}`);
                  if (errorText) {
                    try {
                      const errorData = JSON.parse(errorText);
                      const errorType = errorData.error || (typeof errorData === 'string' ? errorData : 'unknown');
                      console.error(`[PUBLISH]    - 오류 타입: ${errorType}`);

                      // invalid_grant 오류 확인
                      if (errorType === 'invalid_grant' || errorType.toLowerCase().includes('invalid_grant')) {
                        errorMessage = errorData.error_description || errorData.error?.message || '토큰이 만료되었거나 유효하지 않습니다.';
                        onLog?.(`❌ 토큰 갱신 실패: ${errorMessage} (${errorType})`);
                        // invalid_grant 오류 발생 시 인증 재진행 요구
                        throw new Error(`토큰 갱신 실패: ${errorMessage}. 환경설정에서 인증을 다시 진행해주세요.`);
                      }

                      errorMessage = errorData.error_description || errorData.error?.message || errorMessage;
                    } catch {
                      // JSON 파싱 실패 시 원본 텍스트 사용
                      if (errorText.toLowerCase().includes('invalid_grant') || errorText.toLowerCase().includes('invalid grant')) {
                        onLog?.(`❌ 토큰 갱신 실패: ${errorText}`);
                        throw new Error(`토큰이 만료되었거나 유효하지 않습니다. 환경설정에서 인증을 다시 진행해주세요.`);
                      }
                      errorMessage = errorText.substring(0, 200);
                    }
                  }
                } catch (textError) {
                  // 이미 throw된 invalid_grant 오류는 다시 throw
                  if (textError.message && (textError.message.includes('invalid_grant') || textError.message.includes('인증을 다시 진행'))) {
                    throw textError;
                  }
                  // 기타 오류는 로그만 남기고 계속 진행
                  onLog?.(`⚠️ 토큰 갱신 오류 응답 파싱 실패: ${textError.message}`);
                }

                onLog?.(`⚠️ 토큰 갱신 실패 (HTTP ${refreshResponse.status}): ${errorMessage}`);

                // invalid_grant가 아닌 경우에만 기존 토큰 사용
                if (!errorMessage.toLowerCase().includes('invalid_grant') && !errorMessage.toLowerCase().includes('invalid grant')) {
                  onLog?.('⚠️ 기존 토큰 사용 시도');
                  accessToken = savedTokens.access_token;
                  refreshToken = savedTokens.refresh_token;
                } else {
                  // invalid_grant인 경우 인증 재진행 요구
                  throw new Error(`토큰 갱신 실패: ${errorMessage}. 환경설정에서 인증을 다시 진행해주세요.`);
                }
              }
            } catch (refreshError) {
              const errorMsg = refreshError?.message || String(refreshError || '알 수 없는 오류');

              // invalid_grant 오류 또는 인증 재진행이 필요한 오류인 경우
              if (errorMsg.includes('invalid_grant') ||
                errorMsg.includes('invalid grant') ||
                errorMsg.includes('인증을 다시 진행') ||
                errorMsg.toLowerCase().includes('token expired') ||
                errorMsg.toLowerCase().includes('invalid token')) {
                onLog?.(`❌ 토큰 갱신 실패: ${errorMsg}`);
                // 이 함수에서는 에러를 throw하지 않고 상위로 전달할 수 있도록 처리
                // 하지만 현재 구조상 반환값으로 처리해야 하므로 accessToken을 null로 설정
                accessToken = null;
                refreshToken = null;
                onLog?.('❌ 토큰이 유효하지 않습니다. 환경설정에서 인증을 다시 진행해주세요.');
              } else {
                // 기타 오류는 기존 토큰 사용 시도
                onLog?.(`⚠️ 토큰 갱신 오류: ${errorMsg}`);
                onLog?.('⚠️ 기존 토큰 사용 시도');
                accessToken = savedTokens.access_token;
                refreshToken = savedTokens.refresh_token;
              }
            }
          } else {
            accessToken = savedTokens.access_token;
            refreshToken = savedTokens.refresh_token;
            onLog?.('✅ 저장된 토큰을 불러왔습니다.');
          }
        } else {
          onLog?.('⚠️ 저장된 토큰 파일이 없습니다.');
        }
      } catch (e) {
        onLog?.(`⚠️ 토큰 읽기 실패: ${e.message}`);
      }
    }

    if (!accessToken) {
      // invalid_grant 오류로 인해 토큰이 null로 설정된 경우 더 명확한 메시지 제공
      const needsReauth = refreshToken === null; // invalid_grant 오류로 인해 null로 설정된 경우
      const errorMessage = needsReauth
        ? '토큰이 만료되었거나 유효하지 않습니다 (invalid_grant). 환경설정에서 "Blogger OAuth2 인증" 버튼을 클릭하여 인증을 다시 진행해주세요.'
        : 'Google OAuth2 인증 토큰을 찾을 수 없습니다. 환경설정에서 인증을 다시 완료해주세요.';

      onLog?.(`❌ ${errorMessage}`);

      return {
        ok: false,
        error: errorMessage,
        needsAuth: true
      };
    }

    // 액세스 토큰 설정
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    // 토큰 만료 시 자동 갱신 시도
    try {
      await oauth2Client.getAccessToken();
    } catch (tokenError) {
      onLog?.('⚠️ 토큰 갱신 시도 중...');

      if (refreshToken) {
        try {
          const { google } = require('googleapis');
          const newTokens = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(newTokens.credentials);
          onLog?.('✅ 토큰 갱신 성공');
        } catch (refreshError) {
          const errorMsg = refreshError?.message || String(refreshError || '알 수 없는 오류');
          const errorCode = refreshError?.code || '';
          const errorResponse = refreshError?.response || refreshError?.response?.data || {};

          // invalid_grant 오류 감지
          const isInvalidGrant =
            errorMsg.toLowerCase().includes('invalid_grant') ||
            errorMsg.toLowerCase().includes('invalid grant') ||
            errorCode === 'invalid_grant' ||
            errorResponse.error === 'invalid_grant' ||
            (typeof errorResponse === 'string' && errorResponse.toLowerCase().includes('invalid_grant'));

          const finalErrorMessage = isInvalidGrant
            ? `토큰이 만료되었거나 유효하지 않습니다 (invalid_grant). 환경설정에서 "Blogger OAuth2 인증" 버튼을 클릭하여 인증을 다시 진행해주세요. 오류 상세: ${errorMsg}`
            : `토큰이 만료되었습니다. 환경설정에서 다시 인증해주세요. 오류 상세: ${errorMsg}`;

          onLog?.(`❌ 토큰 갱신 실패: ${errorMsg}`);
          if (isInvalidGrant) {
            onLog?.('❌ invalid_grant 오류 감지: 토큰 갱신 불가능. 인증 재진행이 필요합니다.');
          }

          return {
            ok: false,
            error: finalErrorMessage,
            needsAuth: true
          };
        }
      } else {
        onLog?.('❌ 리프레시 토큰이 없습니다.');
        return {
          ok: false,
          error: '토큰이 만료되었습니다. 환경설정에서 다시 인증해주세요.',
          needsAuth: true
        };
      }
    }

    // Blogger API 클라이언트 생성
    const blogger = google.blogger({ version: 'v3', auth: oauth2Client });

    onLog?.('📝 블로그 포스트 작성 중...');

    const labelSource = (() => {
      // generatedLabels가 있으면 우선 사용 (이미 buildGeneratedLabels에서 처리됨)
      if (Array.isArray(payload.generatedLabels) && payload.generatedLabels.length > 0) {
        // generatedLabels는 이미 단어 단위로 분리되지 않은 상태
        return payload.generatedLabels;
      }
      if (Array.isArray(payload.labels) && payload.labels.length > 0) {
        return payload.labels;
      }
      if (typeof payload.labels === 'string' && payload.labels.trim().length > 0) {
        // 쉼표로만 구분 (단어 단위 분리 안 함)
        return payload.labels.split(',').map((label) => label.trim()).filter(Boolean);
      }
      return [];
    })();

    const labelSet = new Set();
    const pushLabel = (value) => {
      if (!value) return;

      // Blogger API labels 제한사항:
      // - 특수문자 제거: 콜론(:), 물음표(?), 앰퍼샌드(&), 해시(#), 따옴표("), 세미콜론(;), 쉼표(,)
      // - 특수문자를 공백으로 대체하거나 제거
      // - 해시태그(#) 제거하고 평문으로만 저장 (쉼표로 구분)
      let sanitized = String(value)
        .replace(/[:?&#";,]/g, ' ') // 특수문자를 공백으로 대체 (# 포함)
        .replace(/\s+/g, ' ') // 연속 공백을 하나로
        .trim(); // 앞뒤 공백 제거

      // 빈 문자열이거나 너무 짧거나 긴 경우 제외
      if (!sanitized || sanitized.length < 2 || sanitized.length > 40) return;

      // 공백으로 시작하거나 끝나는 경우 제외
      if (sanitized.startsWith(' ') || sanitized.endsWith(' ')) return;

      labelSet.add(sanitized);
    };

    if (labelSource.length > 0) {
      labelSource.forEach(pushLabel);
    } else {
      // topic은 단어 단위로 분리하지 않고 전체를 하나의 라벨로만 사용
      if (payload.topic) {
        pushLabel(payload.topic);
      }
      // keywords는 쉼표로 구분된 값만 사용 (단어 단위 분리 안 함)
      if (payload.keywords) {
        const keywords = Array.isArray(payload.keywords)
          ? payload.keywords
          : payload.keywords.split(',').map(k => k.trim()).filter(Boolean);
        keywords.forEach(kw => {
          // 객체인 경우 keyword 속성 추출, 아니면 문자열 그대로 사용
          if (typeof kw === 'object' && kw !== null) {
            if (kw.keyword) pushLabel(kw.keyword);
            if (kw.title) pushLabel(kw.title);
          } else if (typeof kw === 'string') {
            pushLabel(kw);
          }
        });
      }
    }

    // 최대 10개로 제한 (Blogger API 제한 고려)
    // 각 label을 정제: 최대 100자, 특수문자 제거, 공백 정리
    // Blogger API는 label에 특수문자나 긴 문자열을 허용하지 않을 수 있음
    // 🔧 해시태그(#) 제거하고 평문으로만 저장 (쉼표로 구분)
    const cleanedLabels = Array.from(labelSet).map(label => {
      if (typeof label !== 'string') return String(label || '').trim();
      // 최대 100자로 제한 (더 보수적으로)
      let cleaned = label.trim().substring(0, 100);
      // 연속된 공백을 하나로
      cleaned = cleaned.replace(/\s+/g, ' ');
      // 특수문자 제거 (한글, 영문, 숫자, 공백만 허용) - 해시태그(#) 포함 제거
      cleaned = cleaned.replace(/[^\w\s가-힣]/g, '');
      // 앞뒤 공백 제거
      cleaned = cleaned.trim();
      return cleaned;
    }).filter(label => label.length > 0 && label.length <= 100);

    // 최대 5개로 제한 (10개일 때 invalid argument 오류 발생 확인됨)
    const beforeLimitCount = cleanedLabels.length;
    const uniqueLabels = Array.from(new Set(cleanedLabels)).slice(0, 5);
    const removedLabels = beforeLimitCount > 5 ? cleanedLabels.slice(5) : [];

    console.log(`[PUBLISH] 🏷️ [라벨 처리] 정제 완료:`);
    console.log(`[PUBLISH]    - 원본 라벨 수: ${labelSource.length > 0 ? labelSource.length : (payload.topic ? 1 : 0) + (payload.keywords ? (Array.isArray(payload.keywords) ? payload.keywords.length : payload.keywords.split(',').length) : 0)}`);
    console.log(`[PUBLISH]    - 정제 후 라벨 수: ${cleanedLabels.length}개`);
    console.log(`[PUBLISH]    - 최종 라벨 수: ${uniqueLabels.length}개 (제한: 5개)`);
    if (removedLabels.length > 0) {
      console.log(`[PUBLISH]    - 제거된 라벨 (${removedLabels.length}개): ${removedLabels.join(', ')}`);
    }
    if (cleanedLabels.length !== uniqueLabels.length) {
      const duplicateCount = cleanedLabels.length - new Set(cleanedLabels).size;
      if (duplicateCount > 0) {
        console.log(`[PUBLISH]    - 중복 제거: ${duplicateCount}개`);
      }
    }
    console.log(`[PUBLISH]    - 최종 라벨 목록:`, JSON.stringify(uniqueLabels, null, 2));
    onLog?.(`🏷️ 자동 생성된 해시태그 (${uniqueLabels.length}개): ${uniqueLabels.join(', ')}`);

    // 🔧 postingStatus 값 확인 및 정제
    // immediate, publish, live, now 모두 즉시 발행으로 처리
    let cleanPostingStatus = String(postingStatus || 'publish').toLowerCase().trim();

    // immediate, now → publish 변환
    if (cleanPostingStatus === 'immediate' || cleanPostingStatus === 'now' || cleanPostingStatus === 'live') {
      console.log(`[PUBLISH] postingStatus "${cleanPostingStatus}"를 "publish"로 변환`);
      cleanPostingStatus = 'publish';
    }

    isDraftMode = cleanPostingStatus === 'draft';
    isScheduleMode = cleanPostingStatus === 'schedule';
    const finalStatus = (isDraftMode || isScheduleMode) ? 'DRAFT' : 'LIVE';

    console.log(`[PUBLISH] 원본 postingStatus: "${postingStatus}"`);
    console.log(`[PUBLISH] 정제된 postingStatus: "${cleanPostingStatus}"`);
    console.log(`[PUBLISH] 최종 status 필드: "${finalStatus}"`);
    onLog?.(`[DEBUG] postingStatus: "${postingStatus}" → "${cleanPostingStatus}" → "${finalStatus}"`);

    // 블로그 포스트 데이터 준비
    // blogId가 정의되어 있는지 확인
    if (!blogId || typeof blogId === 'undefined') {
      const errorMsg = 'Blog ID가 정의되지 않았습니다. 환경 설정을 확인해주세요.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    // postData는 이제 사용하지 않음 (cleanRequestBody로 직접 구성)
    // 기존 postData 코드는 제거하고 cleanRequestBody만 사용

    let processedThumbnailUrl = thumbnailUrl;

    console.log(`[PUBLISH] [썸네일 초기화] 입력 thumbnailUrl: ${thumbnailUrl ? '있음' : '없음'}`);
    if (thumbnailUrl) {
      console.log(`[PUBLISH] [썸네일 초기화] 타입: ${typeof thumbnailUrl}`);
      console.log(`[PUBLISH] [썸네일 초기화] 길이: ${thumbnailUrl.length}자`);
      console.log(`[PUBLISH] [썸네일 초기화] 시작: ${thumbnailUrl.substring(0, 50)}`);
    }

    if (typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:image')) {
      console.log(`[PUBLISH] data:image URL 썸네일 감지, Blogger 업로드 시작...`);
      onLog?.(`[PUBLISH] 썸네일 업로드 중... (data:image)`);
      const uploadedUrl = await uploadDataUrlThumbnail(blogger, blogId, thumbnailUrl, onLog);
      if (uploadedUrl) {
        processedThumbnailUrl = uploadedUrl;
        console.log(`[PUBLISH] ✅ 썸네일 업로드 성공: ${processedThumbnailUrl.substring(0, 100)}...`);
        onLog?.(`✅ 썸네일 업로드 성공`);
      } else {
        console.warn(`[PUBLISH] ❌ 썸네일 업로드 실패, null 반환됨`);
        console.warn(`[PUBLISH] ⚠️ 썸네일 업로드에 실패하여 썸네일 없이 진행합니다`);
        onLog?.(`⚠️ 썸네일 업로드에 실패하여 썸네일 없이 진행합니다`);
        processedThumbnailUrl = null; // 명시적으로 null로 설정
      }
    } else if (typeof thumbnailUrl === 'string' && thumbnailUrl.trim()) {
      console.log(`[PUBLISH] 외부 URL 썸네일 사용: ${thumbnailUrl.substring(0, 100)}...`);
      processedThumbnailUrl = thumbnailUrl;
    } else {
      console.log(`[PUBLISH] 썸네일 없음`);
      processedThumbnailUrl = null;
    }

    console.log(`[PUBLISH] [썸네일 최종] processedThumbnailUrl: ${processedThumbnailUrl ? '설정됨' : 'null'}`);

    // 🔧 최종 요청 데이터 확인 및 로그
    console.log(`[PUBLISH] [Blog ID 검증] Blog ID 확인 중...`);
    console.log(`[PUBLISH]    - Blog ID: "${blogId}"`);
    console.log(`[PUBLISH]    - 길이: ${blogId.length}자`);
    console.log(`[PUBLISH]    - 타입: ${typeof blogId}`);

    // Blog ID 유효성 검증 (숫자만 포함되어야 함)
    if (!blogId || typeof blogId !== 'string' || blogId.trim().length === 0) {
      const errorMsg = `Blog ID가 비어있습니다. 환경 설정을 확인해주세요.`;
      console.error(`[PUBLISH] ❌ [Blog ID 검증] ${errorMsg}`);
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    if (!/^\d+$/.test(blogId)) {
      const errorMsg = `Blog ID가 올바른 형식이 아닙니다. Blog ID는 숫자만 포함해야 합니다. 현재 값: "${blogId}"`;
      console.error(`[PUBLISH] ❌ [Blog ID 검증] ${errorMsg}`);
      console.error(`[PUBLISH]    - 허용되지 않는 문자: ${blogId.replace(/\d/g, '').split('').join(', ') || '없음'}`);
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    console.log(`[PUBLISH] ✅ [Blog ID 검증] Blog ID 형식이 올바릅니다.`);

    // requestBody 구성 - Blogger API v3 스펙에 맞게 구성
    // 중요: replies 필드는 Blogger API v3에서 지원하지 않거나 다른 형식이 필요함
    // replies 필드를 제거하여 400 오류 방지

    // ⚠️ 중요: CSS 보호 및 HTML 크기 제한 (CSS는 절대 잘리지 않도록)
    // 1. CSS 추출 (style 태그 내용)
    let cssContent = '';
    let htmlWithoutCss = html;
    const styleTagMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (styleTagMatch) {
      cssContent = styleTagMatch[0]; // <style>...</style> 전체
      htmlWithoutCss = html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, ''); // CSS 제거한 HTML
      console.log(`[PUBLISH] ✅ CSS 스타일 발견 (${cssContent.length}자)`);
      onLog?.(`[PUBLISH] ✅ CSS 스타일 포함됨 (${cssContent.length}자)`);
    } else {
      console.log(`[PUBLISH] ⚠️ CSS 스타일이 없습니다. 기본 스타일을 자동 추가합니다.`);
      onLog?.(`[PUBLISH] ⚠️ CSS 스타일이 HTML에 포함되어 있지 않아 기본 스타일을 추가합니다.`);

      // 기본 CSS 추가 (generateMaxModeArticle의 cloudSkinCSS와 동일한 스타일)
      cssContent = `<style>${generateBloggerLayoutCSS()}
.max-mode-article h2 {
  font-size: 1.7rem !important;
  margin: 40px 0 22px 0;
  padding: 18px 24px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(236, 253, 245, 0.45) 100%) !important;
  color: #064e3b !important;
  border-radius: 20px;
  font-weight: 800;
  box-shadow: 0 20px 42px rgba(16, 185, 129, 0.18);
  border: 1px solid rgba(16, 185, 129, 0.32) !important;
}
.max-mode-article h3 {
  font-size: 1.35rem !important;
  margin: 26px 0 16px 0;
  padding: 14px 20px;
  background: linear-gradient(135deg, rgba(254, 202, 202, 0.4) 0%, rgba(254, 242, 242, 0.85) 100%) !important;
  border-radius: 16px;
  color: #b91c1c !important;
  font-weight: 700;
  box-shadow: 0 14px 32px rgba(248, 113, 113, 0.2);
  border: 1px solid rgba(248, 113, 113, 0.4) !important;
}
.max-mode-article p {
  color: #1f2937;
  line-height: 1.95;
  font-size: 1.25rem !important; /* 20px - 어르신도 돋보기 없이 읽기 좋은 크기 */
  margin: 0 0 20px 0;
  word-break: keep-all;
}
</style>`;
      console.log(`[PUBLISH] ✅ 기본 CSS 스타일을 자동 추가했습니다 (${cssContent.length}자)`);
      console.log(`[PUBLISH] 📐 [레이아웃 확장] 최대 너비: 2000px, 좌우 패딩: 20px (데스크톱) - 최대한 꽉차게`);
      console.log(`[PUBLISH] 📐 [CSS 디버그] 추가된 Blogger 테마 셀렉터: .post-outer, .blog-post, .article-body, .content-section`);
      onLog?.(`✅ 레이아웃 확장 CSS 적용: 최대 너비 2000px, 좌우 패딩 20px (데스크톱) - 최대한 꽉차게`);
    }
    // 🔧 테마 오버라이드 차단을 위한 강제 리셋/스코프 (본문을 이미지 카드처럼 보이게 하는 스타일 무력화)
    // ⚠️ SUPREME AI SKIN 적용: 세계 최고 수준 디자인
    // 🎨 H2 강조 색상 랜덤 팔레트 (매 발행마다 다른 프리미엄 색상)
    const LBA_H2_PALETTES = [
      { accent: '#e11d48', bg: 'rgba(225,29,72,0.10)' },   // 로즈 골드
      { accent: '#059669', bg: 'rgba(5,150,105,0.10)' },    // 에메랄드
      { accent: '#d97706', bg: 'rgba(217,119,6,0.10)' },    // 앰버
      { accent: '#7c3aed', bg: 'rgba(124,58,237,0.10)' },   // 바이올렛
      { accent: '#0284c7', bg: 'rgba(2,132,199,0.10)' },    // 스카이
      { accent: '#c026d3', bg: 'rgba(192,38,211,0.10)' },   // 퓨시아
      { accent: '#0d9488', bg: 'rgba(13,148,136,0.10)' },   // 티얼
      { accent: '#ea580c', bg: 'rgba(234,88,12,0.10)' },    // 코랄
      { accent: '#4f46e5', bg: 'rgba(79,70,229,0.10)' },    // 라벤더
      { accent: '#0891b2', bg: 'rgba(8,145,178,0.10)' },    // 민트
    ];
    const h2Palette = LBA_H2_PALETTES[Math.floor(Math.random() * LBA_H2_PALETTES.length)];
    console.log(`[PUBLISH] 🎨 H2 랜덤 컬러: ${h2Palette.accent}`);
    const resetCss = `
<style>
/* SUPREME AI SKIN - 독보적인 프리미엄 디자인 */
.max-mode-article{ --lba-h2-accent:${h2Palette.accent}; --lba-h2-bg:${h2Palette.bg}; }
.supreme-ai-skin{ --lba-h2-accent:${h2Palette.accent}; --lba-h2-bg:${h2Palette.bg}; }
/* ========================================
   Blogger 레이아웃 컨테이너 확장 - 모든 테마 호환 최강 오버라이드
   ========================================
   ⚠️ 모든 Blogger 테마에서 작동하는 범용 레이아웃 오버라이드
   ⚠️ VTrick 테마 포함 모든 컨테이너를 강제 오버라이드
   ======================================== */

/* UNIVERSAL BLOGGER THEME OVERRIDES - 모든 Blogger 테마 호환 */
/* 단계 1: 모든 Blogger 컨테이너의 기본 제한 제거 */
*,
*::before,
*::after {
  box-sizing: border-box !important;
}

/* 단계 2: 모든 가능한 Blogger 메인 컨테이너 강제 확장 */
html body #outer-wrapper,
html body #content-wrapper,
html body #main-wrapper,
html body #footer-wrapper,
html body #header-wrapper,
html body .outer-wrapper,
html body .content-wrapper,
html body .main-wrapper,
html body .footer-wrapper,
html body .header-wrapper {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 단계 3: 모든 Blogger 콘텐츠 컨테이너 */
html body #main,
html body #content,
html body .main,
html body .content,
html body .container,
html body .blog-posts,
html body .blog-post,
html body .post-outer,
html body #Blog1,
html body .blog-posts-container,
html body .posts-container,
html body .main-inner,
html body .content-inner,
html body .container-inner,
/* 모든 변형 포함 */
html body [id*="main"],
html body [id*="content"],
html body [class*="main"],
html body [class*="content"],
html body [class*="container"] {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
}

/* 단계 4: 모든 Blogger 포스트 본문 컨테이너 */
html body .post-body,
html body .entry-content,
html body .post-content,
html body .post-body-inner,
html body .post-content-inner,
html body .entry-content-inner,
html body .content-inner,
html body .main-content,
html body .article-content,
html body .blog-post-content,
html body .post-content-wrapper,
html body .post-body-container,
html body .post-content-container,
html body .entry-body,
html body .entry-text,
html body .post-text,
html body .post-body-text,
html body .entry-content-text,
/* 모든 변형 포함 */
html body [class*="post-body"],
html body [class*="entry-content"],
html body [class*="post-content"],
html body [class*="article-content"] {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
}

/* VTrick 테마의 가변 너비 변수들 강제 오버라이드 */
html body .container,
html body .row-x1,
html body .content-section,
html body .main-inner,
html body .content-inner {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
}

/* 모든 가능한 Blogger 포스트 본문 컨테이너 - 최강 오버라이드 */
.post-body, .post-body .post, .entry-content, .post-content,
.post-body-inner, .post-content-inner, .entry-content-inner,
.content-inner, .main-content, .article-content,
.blog-post-content, .post-content-wrapper,
.post-body-container, .post-content-container,
.entry-body, .entry-text, .post-text,
.post-body-text, .entry-content-text,
/* 추가적인 Blogger 셀렉터들 */
.post-body .post-body, .entry-content .entry-content,
.post-content .post-content, .article-content .article-content,
/* VTrick 특정 셀렉터들 */
.content-section .post-body,
.content-section .entry-content,
.main-inner .post-body,
.main-inner .entry-content {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}
/* Blogger 메인 컨테이너 및 레이아웃 구조 - 최강 오버라이드 */
#main, #content, .main, .content, .container,
.blog-posts, .blog-post, .post-outer, .post-outer-container,
.post, .entry, .entry-wrapper, .post-wrapper,
#Blog1, .blog-posts-container, .posts-container,
.main-inner, .content-inner, .container-inner,
/* 추가적인 컨테이너 셀렉터들 */
.main-wrapper, .content-wrapper, .blog-wrapper,
.post-container, .entry-container, .article-container,
/* VTrick 특정 컨테이너들 */
.content-section, .main-content, .article-body,
.blog-posts-wrap, .index-post-wrap {
  max-width: 100% !important;
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
}
/* 콘텐츠 영역 확장 - 모든 가능한 셀렉터 - 최강 오버라이드 */
.post-body .max-mode-article, .max-mode-article, .premium-article,
.post-body .premium-article, .article-content,
.post-body .post-content, .post-content,
.entry-content .max-mode-article, .entry-content .premium-article,
.post-body .article-content, .entry-content .article-content,
.post-body .max-mode-article .article-content,
.entry-content .max-mode-article .article-content,
/* 추가적인 콘텐츠 셀렉터들 */
.supreme-ai-skin, .post-body .supreme-ai-skin,
.entry-content .supreme-ai-skin, .max-mode-article .supreme-ai-skin,
/* VTrick 특정 콘텐츠 셀렉터들 */
.content-section .max-mode-article,
.content-section .supreme-ai-skin,
.main-inner .max-mode-article,
.main-inner .supreme-ai-skin {
  max-width: 100% !important; /* 전체 너비 사용으로 변경 */
  width: 100% !important;
  min-width: 100% !important;
  margin: 0 !important; /* 중앙 정렬 제거 */
  padding: 0 !important; /* 패딩 제거 - Blogger의 기본 마진 제거 */
  box-sizing: border-box !important;
}
/* 모든 미디어 쿼리 오버라이드 - 데스크톱 */
@media (min-width: 1200px) {
  /* Blogger의 모든 컨테이너 요소들 강제 오버라이드 */
  .post-body, .entry-content, .post-content, .post-outer, .blog-post,
  .article-body, .content-section, .main, .content, .wrapper,
  .container, .row, .col, .column, .layout, .page, .site-content,
  /* 사이드바 관련 요소들 - 모든 테마 호환 */
  .sidebar, .sidebar-wrapper, .widget-area, .secondary,
  .side-column, .right-sidebar, .left-sidebar,
  /* 추가 범용 사이드바 셀렉터들 */
  [class*="sidebar"], [class*="widget"], [id*="sidebar"],
  [class*="secondary"], [class*="side-"] {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    display: none !important; /* 사이드바 완전히 숨기기 */
  }

  /* 범용 콘텐츠 영역 - 모든 Blogger 테마 호환 */
  .post-body .max-mode-article, .max-mode-article, .premium-article,
  .post-body .premium-article, .article-content,
  .post-outer .max-mode-article, .post-outer .premium-article,
  .blog-post .max-mode-article, .blog-post .premium-article,
  .article-body .max-mode-article, .article-body .premium-article,
  .content-section .max-mode-article, .content-section .premium-article,
  /* 모든 변형 포함 - 범용 호환성 */
  [class*="max-mode-article"], [class*="premium-article"],
  [class*="article-content"], [class*="post-content"],
  /* 모든 하위 div 요소들 범용 오버라이드 */
  .post-body div, .entry-content div, .post-content div,
  .post-outer div, .blog-post div, .article-body div,
  .content-section div, .main-inner div, .container div,
  /* 모든 div 변형 포함 */
  [class*="post"] div, [class*="entry"] div, [class*="content"] div,
  [class*="article"] div, [class*="blog"] div {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 20px 32px 20px !important; /* 범용 최소 패딩 */
    margin: 0 auto !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }
}
/* 태블릿 */
@media (min-width: 768px) and (max-width: 1199px) {
  /* Blogger의 모든 컨테이너 요소들 강제 오버라이드 */
  .post-body, .entry-content, .post-content, .post-outer, .blog-post,
  .article-body, .content-section, .main, .content, .wrapper,
  .container, .row, .col, .column, .layout, .page, .site-content,
  /* 사이드바 관련 요소들 - 모든 테마 호환 */
  .sidebar, .sidebar-wrapper, .widget-area, .secondary,
  .side-column, .right-sidebar, .left-sidebar,
  /* 추가 범용 사이드바 셀렉터들 */
  [class*="sidebar"], [class*="widget"], [id*="sidebar"],
  [class*="secondary"], [class*="side-"] {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    display: none !important; /* 사이드바 완전히 숨기기 */
  }

  .post-body .max-mode-article, .max-mode-article, .premium-article,
  .post-body .premium-article, .article-content,
  .post-outer .max-mode-article, .post-outer .premium-article,
  .blog-post .max-mode-article, .blog-post .premium-article,
  .article-body .max-mode-article, .article-body .premium-article,
  .content-section .max-mode-article, .content-section .premium-article,
  /* 모든 변형 포함 - 범용 호환성 */
  [class*="max-mode-article"], [class*="premium-article"],
  [class*="article-content"], [class*="post-content"],
  /* 모든 하위 요소들 범용 오버라이드 */
  .post-body div, .entry-content div, .post-content div,
  .post-outer div, .blog-post div, .article-body div,
  .content-section div, .main-inner div, .container div,
  /* 모든 div 변형 포함 */
  [class*="post"] div, [class*="entry"] div, [class*="content"] div,
  [class*="article"] div, [class*="blog"] div {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 15px 32px 15px !important; /* 범용 태블릿 패딩 */
    margin: 0 auto !important;
    box-sizing: border-box !important;
  }
}
/* 모바일 */
@media (max-width: 767px) {
  /* Blogger의 모든 컨테이너 요소들 강제 오버라이드 */
  .post-body, .entry-content, .post-content, .post-outer, .blog-post,
  .article-body, .content-section, .main, .content, .wrapper,
  .container, .row, .col, .column, .layout, .page, .site-content,
  /* 사이드바 관련 요소들 - 모든 테마 호환 */
  .sidebar, .sidebar-wrapper, .widget-area, .secondary,
  .side-column, .right-sidebar, .left-sidebar,
  /* 추가 범용 사이드바 셀렉터들 */
  [class*="sidebar"], [class*="widget"], [id*="sidebar"],
  [class*="secondary"], [class*="side-"] {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    display: none !important; /* 사이드바 완전히 숨기기 */
  }

  .post-body .max-mode-article, .max-mode-article, .premium-article,
  .post-body .premium-article, .article-content,
  .post-outer .max-mode-article, .post-outer .premium-article,
  .blog-post .max-mode-article, .blog-post .premium-article,
  .article-body .max-mode-article, .article-body .premium-article,
  .content-section .max-mode-article, .content-section .premium-article,
  /* 모든 변형 포함 - 범용 호환성 */
  [class*="max-mode-article"], [class*="premium-article"],
  [class*="article-content"], [class*="post-content"],
  /* 모든 하위 요소들 범용 오버라이드 */
  .post-body div, .entry-content div, .post-content div,
  .post-outer div, .blog-post div, .article-body div,
  .content-section div, .main-inner div, .container div,
  /* 모든 div 변형 포함 */
  [class*="post"] div, [class*="entry"] div, [class*="content"] div,
  [class*="article"] div, [class*="blog"] div {
    max-width: 100% !important;
    width: 100% !important;
    padding: 0 10px 32px 10px !important; /* 범용 모바일 패딩 */
    margin: 0 auto !important;
    box-sizing: border-box !important;
  }
}
/* SUPREME AI SKIN이 없을 때만 기본 스타일 적용 */
.post-body .max-mode-article:not(.supreme-ai-skin) h1,
.post-body .max-mode-article:not(.supreme-ai-skin) h2,
.post-body .max-mode-article:not(.supreme-ai-skin) h3,
.max-mode-article:not(.supreme-ai-skin) h1,
.max-mode-article:not(.supreme-ai-skin) h2,
.max-mode-article:not(.supreme-ai-skin) h3,
.premium-article:not(.supreme-ai-skin) h1,
.premium-article:not(.supreme-ai-skin) h2,
.premium-article:not(.supreme-ai-skin) h3 {
  background: none !important; background-image: none !important; border: none !important; box-shadow: none !important;
  padding: 0.3em 0 !important; margin: 28px 0 16px 0 !important; color: #111827 !important;
  border-radius: 0 !important; display: block !important; filter: none !important;
}
/* SUPREME AI SKIN이 있을 때는 스킨의 색상 변수 사용, 없을 때만 기본값 */
.post-body .max-mode-article:not(.supreme-ai-skin) h2,
.max-mode-article:not(.supreme-ai-skin) h2,
.premium-article:not(.supreme-ai-skin) h2{
  border: 2px solid var(--lba-h2-accent) !important;
  background-color: var(--lba-h2-bg) !important;
  border-radius: 14px !important;
  padding: 14px 18px !important;
}
/* GODLIKE SUPREME AI H2 스타일 - 와 대박이다 개쩐다! */
.post-body .max-mode-article h2,
.max-mode-article h2,
.premium-article h2,
.article-content h2,
.supreme-ai-skin h2,
.blogger-skin h2,
.wp-skin h2 {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 237, 78, 0.15) 25%, rgba(147, 51, 234, 0.1) 50%, rgba(59, 130, 246, 0.08) 75%, rgba(255, 215, 0, 0.15) 100%) !important;
  border: 4px solid transparent !important;
  border-image: linear-gradient(45deg, #ffd700, #ffed4e, #a855f7, #3b82f6) 1 !important;
  border-radius: 20px !important;
  padding: 30px 40px !important;
  margin: 60px 0 40px 0 !important;
  color: #1a1a1a !important;
  font-size: 2.8rem !important;
  font-weight: 900 !important;
  text-align: center !important;
  position: relative !important;
  box-shadow:
    0 12px 35px rgba(255, 215, 0, 0.3),
    0 0 80px rgba(147, 51, 234, 0.15),
    inset 0 2px 0 rgba(255, 255, 255, 0.3) !important;
  text-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
  letter-spacing: -0.5px !important;
  text-transform: uppercase !important;
}

.post-body .max-mode-article h2::before,
.max-mode-article h2::before,
.premium-article h2::before,
.article-content h2::before,
.supreme-ai-skin h2::before,
.blogger-skin h2::before,
.wp-skin h2::before {
  content: "💎 " !important;
  position: absolute !important;
  left: 20px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  font-size: 2rem !important;
  animation: diamondSparkle 2s ease-in-out infinite !important;
}

.post-body .max-mode-article h2::after,
.max-mode-article h2::after,
.premium-article h2::after,
.article-content h2::after,
.supreme-ai-skin h2::after,
.blogger-skin h2::after,
.wp-skin h2::after {
  content: " 👑" !important;
  position: absolute !important;
  right: 20px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  font-size: 2rem !important;
  animation: crownGlow 2s ease-in-out infinite alternate !important;
}

@keyframes diamondSparkle {
  0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.8; }
  50% { transform: translateY(-50%) scale(1.2); opacity: 1; }
}

@keyframes crownGlow {
  0%, 100% { transform: translateY(-50%) scale(1); opacity: 0.8; }
  50% { transform: translateY(-50%) scale(1.1); opacity: 1; }
}

/* SUPREME AI SKIN - GODLIKE 프리미엄 컨테이너 (와 대박이다 개쩐다!) */
.post-body .supreme-ai-skin,
.supreme-ai-skin,
.post-body .blogger-skin,
.blogger-skin,
.post-body .wp-skin,
.wp-skin {
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(255, 237, 78, 0.08) 25%, rgba(147, 51, 234, 0.06) 50%, rgba(255, 215, 0, 0.05) 75%, rgba(59, 130, 246, 0.04) 100%) !important;
  border: 3px solid transparent !important;
  border-image: linear-gradient(45deg, #ffd700, #ffed4e, #a855f7, #3b82f6, #ffd700) 1 !important;
  border-radius: 32px !important;
  padding: 60px !important;
  margin: 50px 0 !important;
  position: relative !important;
  overflow: hidden !important;
  box-shadow:
    0 20px 60px rgba(255, 215, 0, 0.2),
    0 0 100px rgba(147, 51, 234, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
}

.post-body .supreme-ai-skin::before,
.supreme-ai-skin::before,
.post-body .blogger-skin::before,
.blogger-skin::before,
.post-body .wp-skin::before,
.wp-skin::before {
  content: "👑 GODLIKE SUPREME AI 👑" !important;
  position: absolute !important;
  top: 20px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  background: linear-gradient(90deg, #ffd700 0%, #ffed4e 20%, #a855f7 40%, #3b82f6 60%, #ffd700 80%, #ffed4e 100%) !important;
  background-size: 300% 100% !important;
  animation: godlikeShine 4s ease-in-out infinite !important;
  color: #000 !important;
  padding: 16px 40px !important;
  border-radius: 30px !important;
  font-size: 16px !important;
  font-weight: 900 !important;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.5) !important;
  border: 3px solid rgba(255, 255, 255, 0.4) !important;
  letter-spacing: 1px !important;
}

@keyframes godlikeShine {
  0%, 100% { background-position: 0% 50%; }
  25% { background-position: 100% 50%; }
  50% { background-position: 200% 50%; }
  75% { background-position: 300% 50%; }
}

/* GODLIKE 다중 테두리 애니메이션 */
.post-body .supreme-ai-skin::after,
.supreme-ai-skin::after,
.post-body .blogger-skin::after,
.blogger-skin::after,
.post-body .wp-skin::after,
.wp-skin::after {
  content: "" !important;
  position: absolute !important;
  top: -3px !important;
  left: -3px !important;
  right: -3px !important;
  bottom: -3px !important;
  background: linear-gradient(45deg, #ffd700, #ffed4e, #a855f7, #3b82f6, #10b981, #ffd700) !important;
  border-radius: 35px !important;
  z-index: -1 !important;
  animation: godlikeBorderRotate 6s linear infinite !important;
  opacity: 0.8 !important;
}

@keyframes godlikeBorderRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* GODLIKE 입체 효과 */
.post-body .supreme-ai-skin,
.supreme-ai-skin,
.post-body .blogger-skin,
.blogger-skin,
.post-body .wp-skin,
.wp-skin {
  transform: perspective(1000px) rotateX(2deg) !important;
  transition: transform 0.3s ease !important;
}

.post-body .supreme-ai-skin:hover,
.supreme-ai-skin:hover,
.post-body .blogger-skin:hover,
.blogger-skin:hover,
.post-body .wp-skin:hover,
.wp-skin:hover {
  transform: perspective(1000px) rotateX(0deg) !important;
}
/* 일부 테마가 제목에 장식 요소를 넣는 경우 제거 */
.post-body .max-mode-article h1::before,
.post-body .max-mode-article h1::after,
.post-body .max-mode-article h2::before,
.post-body .max-mode-article h2::after,
.post-body .max-mode-article h3::before,
.post-body .max-mode-article h3::after,
.max-mode-article h1::before, .max-mode-article h1::after,
.max-mode-article h2::before, .max-mode-article h2::after,
.max-mode-article h3::before, .max-mode-article h3::after {
  content: none !important; background: none !important; box-shadow: none !important; border: none !important;
}
.post-body .max-mode-article img, .max-mode-article img, .premium-article img {
  max-width: 100% !important; height: auto !important; display: block !important; margin: 16px auto !important;
}
.post-body .max-mode-article table, .max-mode-article table {
  width: 100% !important; border-collapse: collapse !important;
  margin: 20px 0 !important;
}
/* 표 스타일: 기본 스타일은 index.ts에서 정의, 여기서는 가독성만 보장 */
/* 플랫폼 스킨이 없을 때만 기본 텍스트 색상 강제 */
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) table th,
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) table td,
.max-mode-article:not(.blogger-skin):not(.wp-skin) table th,
.max-mode-article:not(.blogger-skin):not(.wp-skin) table td {
  color: #000000 !important;
}
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) table th,
.max-mode-article:not(.blogger-skin):not(.wp-skin) table th {
  background-color: #f3f4f6 !important;
  font-weight: 700 !important;
}
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) table tr:nth-child(odd) td,
.max-mode-article:not(.blogger-skin):not(.wp-skin) table tr:nth-child(odd) td {
  background-color: #f9fafb !important;
}
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) table tr:nth-child(even) td,
.max-mode-article:not(.blogger-skin):not(.wp-skin) table tr:nth-child(even) td {
  background-color: #ffffff !important;
}
/* 플랫폼 스킨이 있을 때는 스킨의 표 스타일 유지, 다만 텍스트 가독성만 보장 */
.post-body .blogger-skin table th,
.post-body .blogger-skin table td,
.blogger-skin table th,
.blogger-skin table td,
.post-body .wp-skin table th,
.post-body .wp-skin table td,
.wp-skin table th,
.wp-skin table td {
  color: var(--lba-ink, #000000) !important;
}
/* 플랫폼 스킨이 없을 때만 기본 텍스트 스타일 */
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) p, 
.max-mode-article:not(.blogger-skin):not(.wp-skin) p { 
  line-height: 1.78 !important; 
  font-size: 1.05rem !important; 
  color: #111827 !important; 
}
/* 카드형 섀도/배경을 전역으로 제거(본문 스코프 내) - 스킨과 충돌하지 않도록 */
.post-body .max-mode-article:not(.blogger-skin):not(.wp-skin) * {
  background-image: none !important;
}
/* SUPREME AI SKIN - 독보적인 텍스트 크기 및 문단 정리 (최대 가독성) */
/* 모든 상황에서 초대형 텍스트 크기 강제 적용 - Blogger 테마 완전 무시 */
.post-body .max-mode-article p,
.max-mode-article p,
.post-body .max-mode-article li,
.max-mode-article li,
.premium-article p,
.premium-article li,
.article-content p,
.article-content li,
.supreme-ai-skin p,
.supreme-ai-skin li,
.blogger-skin p,
.blogger-skin li,
.wp-skin p,
.wp-skin li,
.blogger-hologram-skin p,
.blogger-hologram-skin li {
  font-size: 1.75rem !important; /* 28px - 초대형 가독성 */
  line-height: 2.4 !important; /* 넓은 라인 높이 */
  margin-bottom: 2rem !important; /* 넓은 문단 간격 */
  text-align: justify !important; /* 양쪽 정렬 */
  word-break: keep-all !important; /* 단어 단위 줄바꿈 */
  overflow-wrap: break-word !important; /* 긴 단어 자동 줄바꿈 */
  color: #1a1a1a !important; /* 검은색 텍스트 */
  font-weight: 400 !important; /* 일반 굵기 */
  letter-spacing: 0.03em !important; /* 넓은 자간 */
  text-indent: 0 !important; /* 들여쓰기 제거 */
}
</style>`;
    // 🔥 resetCss 비활성화 - 복잡한 CSS가 글을 숨기는 원인
    // cssContent += resetCss;
    console.log(`[PUBLISH] ⚠️ 리셋 CSS 비활성화됨 (인라인 스타일만 사용)`);
    console.log(`[PUBLISH] 📐 [레이아웃 확장] 리셋 CSS 포함 - 모든 Blogger 컨테이너 오버라이드 적용`);
    console.log(`[PUBLISH] 📐 [레이아웃 확장] 최대 너비: 100%, 좌우 패딩: 0px (데스크톱), 0px (태블릿), 0px (모바일) - 완전히 꽉차게!`);
    console.log(`[PUBLISH] 📐 [CSS 디버그] 추가된 Blogger 테마 셀렉터: .post-outer, .blog-post, .article-body, .content-section`);
    onLog?.(`✅ 레이아웃 확장 CSS 적용: 최대 너비 100%, 좌우 패딩 0px (데스크톱) - 완전히 꽉차게!`);

    // 2. HTML 크기 제한 (CSS 제외한 본문만 제한)
    const maxContentSize = 800000; // 🔧 Blogger 실제 제한 확인 후 확대 (약 1MB까지 지원)
    let finalContent = htmlWithoutCss;
    const originalLength = finalContent ? finalContent.length : 0;

    if (finalContent && finalContent.length > maxContentSize) {
      const truncatedLength = maxContentSize;
      const removedLength = originalLength - truncatedLength;
      const removedPercent = ((removedLength / originalLength) * 100).toFixed(1);

      console.log(`[PUBLISH] ⚠️ [콘텐츠 잘림] content가 너무 큽니다:`);
      console.log(`[PUBLISH]    - 원본 길이: ${originalLength.toLocaleString()}자`);
      console.log(`[PUBLISH]    - 제한 길이: ${truncatedLength.toLocaleString()}자`);
      console.log(`[PUBLISH]    - 잘린 길이: ${removedLength.toLocaleString()}자 (${removedPercent}%)`);

      // 잘린 부분의 샘플 확인 (잘린 위치 근처의 텍스트)
      const sampleStart = Math.max(0, truncatedLength - 200);
      const sampleEnd = Math.min(originalLength, truncatedLength + 200);
      const sampleText = finalContent.substring(sampleStart, sampleEnd).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`[PUBLISH]    - 잘린 위치 근처 샘플: "...${sampleText.substring(Math.max(0, sampleText.length - 100))}"`);

      // HTML 태그 중간에 잘리지 않도록 마지막 닫는 태그를 찾아서 그 전까지 자르기
      let truncated = finalContent.substring(0, maxContentSize);
      const beforeTagFix = truncated.length;

      // 마지막 열린 태그를 찾아서 닫기
      const lastOpenTag = truncated.lastIndexOf('<');
      const lastCloseTag = truncated.lastIndexOf('>');
      if (lastOpenTag > lastCloseTag) {
        // 열린 태그가 닫히지 않았으면 그 전까지 자르기
        truncated = truncated.substring(0, lastOpenTag);
        console.log(`[PUBLISH]    - 열린 태그 보호: ${beforeTagFix}자 → ${truncated.length}자 (${beforeTagFix - truncated.length}자 추가 제거)`);
      }

      // 마지막 닫히지 않은 태그들 닫기 (간단한 처리)
      const openDivs = (truncated.match(/<div[^>]*>/gi) || []).length;
      const closeDivs = (truncated.match(/<\/div>/gi) || []).length;
      const openPs = (truncated.match(/<p[^>]*>/gi) || []).length;
      const closePs = (truncated.match(/<\/p>/gi) || []).length;
      const unclosedDivs = openDivs - closeDivs;
      const unclosedPs = openPs - closePs;

      if (unclosedDivs > 0 || unclosedPs > 0) {
        console.log(`[PUBLISH]    - 닫히지 않은 태그 발견: <div> ${unclosedDivs}개, <p> ${unclosedPs}개 (자동 닫기)`);
      }

      for (let i = 0; i < unclosedDivs; i++) {
        truncated += '</div>';
      }
      for (let i = 0; i < unclosedPs; i++) {
        truncated += '</p>';
      }

      finalContent = truncated + '\n\n<!-- 콘텐츠가 일부 잘렸습니다 -->';
      console.log(`[PUBLISH]    - 최종 길이: ${finalContent.length.toLocaleString()}자`);
      onLog?.(`[PUBLISH] ⚠️ [콘텐츠 잘림] content가 너무 커서 ${removedLength.toLocaleString()}자 (${removedPercent}%)가 잘렸습니다. 원본: ${originalLength.toLocaleString()}자 → 최종: ${finalContent.length.toLocaleString()}자`);
    } else {
      console.log(`[PUBLISH] ✅ [콘텐츠 크기] 정상 범위 내 (${originalLength.toLocaleString()}자 / 제한: ${maxContentSize.toLocaleString()}자)`);
    }

    // 🔧 Blogger의 jump break(더보기) 토큰 제거 (본문 중간 잘림 방지)
    try {
      finalContent = finalContent
        .replace(/<!--\s*more\s*-->/gi, '')
        .replace(/<(span|div)[^>]*id=[\"']?more[\"']?[^>]*>(.*?)<\/\1>/gi, '$2');
    } catch (e) { /* 무시 */ }

    // 🔥 썸네일은 SVG만 사용 - 첫 번째 이미지를 썸네일로 사용하지 않음
    // 외부 이미지 재호스팅 비활성화 (이미지는 freeimage.host에 이미 업로드됨)

    // ⚠️ CSS는 아래 최종 HTML 조립 단계에서 separator 뒤에 배치됨 (중복 삽입 방지)
    // 이전에 여기서 finalContent = cssContent + finalContent 를 했지만,
    // 이렇게 하면 CSS가 separator 이미지보다 앞에 와서 Blogger 대시보드 썸네일이 안 나옴
    // CSS 삽입은 아래 finalHtmlContent 조립에서만 수행
    if (!cssContent) {
      // CSS가 없으면 경고 (하지만 계속 진행)
      console.warn(`[PUBLISH] ⚠️ CSS 스타일이 없어서 스타일이 적용되지 않을 수 있습니다.`);
      onLog?.(`[PUBLISH] ⚠️ CSS 스타일이 없어서 스타일이 적용되지 않을 수 있습니다.`);
    }

    // ⚠️ 최종 HTML 조립 (더 안전한 Blogger HTML 구조)
    let finalHtmlContent = '';

    // Blogger에서 HTML을 제대로 렌더링하기 위한 안전한 구조 + Schema.org BlogPosting Microdata
    const safeTitle = (title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const publishDateISO = new Date().toISOString();
    finalHtmlContent = `<!-- Blogger HTML Content Start -->
<div itemscope itemtype="https://schema.org/BlogPosting">
<meta itemprop="headline" content="${safeTitle}">
<meta itemprop="datePublished" content="${publishDateISO}">
<meta itemprop="dateModified" content="${publishDateISO}">
`;

    // 1. CSS는 안전하게 포함
    // ⚠️ 썸네일 separator는 CSS 앞에 위치해야 Blogger 대시보드에서 인식됨
    // thumbnailHtml은 나중에 separatorSlot 위치에 삽입됨
    const separatorSlotMarker = '<!-- THUMBNAIL_SEPARATOR_SLOT -->';
    finalHtmlContent += separatorSlotMarker + '\n';
    if (cssContent) {
      finalHtmlContent += cssContent + '\n';
    }

    // 2. 썸네일 추가 (더 간단한 구조 + 디버깅 강화)
    // 🛡️ 중복 방지: 콘텐츠에 이미 separator 썸네일이 있으면 스킵
    // ⚠️ bgpt-thumbnail-box는 Blogger 대시보드가 인식하지 못하므로 separator로 변환 필요
    const hasSeparatorAlready = htmlWithoutCss && htmlWithoutCss.includes('class="separator"');
    if (hasSeparatorAlready) {
      // 🔥 기존 separator를 본문에서 추출하여 CSS 앞(마커 위치)에 배치
      // Blogger 대시보드는 HTML의 첫 번째 <img>를 찾아 썸네일로 사용하므로
      // separator가 <style> 뒤에 있으면 인식 못함 → 앞으로 이동 필수
      const separatorMatch = htmlWithoutCss.match(/<div[^>]*class="separator"[^>]*>[\s\S]*?<\/div>/i);
      if (separatorMatch) {
        const existingSeparator = separatorMatch[0];
        // 본문에서 첫 번째 separator 제거 (CSS 앞에 이동할 것이므로)
        htmlWithoutCss = htmlWithoutCss.replace(existingSeparator, '');
        // 마커를 기존 separator로 교체 (CSS 앞에 배치)
        finalHtmlContent = finalHtmlContent.replace(separatorSlotMarker, existingSeparator);
        console.log(`[PUBLISH] ✅ [썸네일] 기존 separator를 CSS 앞으로 이동 (${existingSeparator.length}자)`);
        onLog?.(`[PUBLISH] ✅ 기존 separator 이미지를 CSS 앞으로 이동 (Blogger 대시보드 썸네일 인식을 위해)`);
      } else {
        console.log(`[PUBLISH] ⚠️ [썸네일] separator 클래스는 있지만 완전한 separator 태그를 찾지 못함. 스킵.`);
      }
    } else {
      console.log(`[PUBLISH] [썸네일 확인] processedThumbnailUrl: ${processedThumbnailUrl ? '있음' : '없음'}`);

      // 썸네일 URL 유효성 검증
      let isValidThumbnailUrl = false;
      if (processedThumbnailUrl) {
        // data:image는 이미 업로드되었으므로 유효
        if (processedThumbnailUrl.startsWith('data:image')) {
          isValidThumbnailUrl = true;
        }
        // Blogger 업로드 URL 검증
        else if (processedThumbnailUrl.includes('googleusercontent.com') ||
          processedThumbnailUrl.includes('blogger.com') ||
          processedThumbnailUrl.includes('blogspot.com')) {
          isValidThumbnailUrl = true;
        }
        // HTTP/HTTPS URL 검증
        else if (processedThumbnailUrl.startsWith('http://') || processedThumbnailUrl.startsWith('https://')) {
          isValidThumbnailUrl = true;
        }

        console.log(`[PUBLISH] [썸네일 검증] URL 유효성: ${isValidThumbnailUrl ? '유효' : '무효'}`);
      }

      if (processedThumbnailUrl && isValidThumbnailUrl) {
        console.log(`[PUBLISH] [썸네일 상세] URL: ${processedThumbnailUrl.substring(0, 150)}...`);
        console.log(`[PUBLISH] [썸네일 상세] 길이: ${processedThumbnailUrl.length}자`);

        // 🔥 bgpt-thumbnail-box가 있으면 제거 (separator 구조로 대체하기 위해)
        // depth-aware 제거: 중첩 div에도 안전 (indexOf 기반 — SVG data URL 안전)
        if (htmlWithoutCss.includes('bgpt-thumbnail-box')) {
          const tbMatch = htmlWithoutCss.match(/<div[^>]*class="[^"]*bgpt-thumbnail-box[^"]*"[^>]*/i);
          if (tbMatch) {
            const tbStart = htmlWithoutCss.indexOf(tbMatch[0]);
            if (tbStart !== -1) {
              // 여는 태그의 '>' 찾기
              let scanPos = tbStart + tbMatch[0].length;
              while (scanPos < htmlWithoutCss.length && htmlWithoutCss[scanPos] !== '>') scanPos++;
              scanPos++; // '>' 건너뛰기

              // depth 추적: <div 과 </div> 태그만 카운트
              let depth = 1;
              while (scanPos < htmlWithoutCss.length && depth > 0) {
                const nextOpen = htmlWithoutCss.indexOf('<div', scanPos);
                const nextClose = htmlWithoutCss.indexOf('</div>', scanPos);

                if (nextClose === -1) break; // 닫는 태그 없으면 중단

                if (nextOpen !== -1 && nextOpen < nextClose) {
                  // <div 뒤 문자 확인 (태그인지 텍스트인지 구분: <divider> 오탐 방지)
                  const charAfterDiv = htmlWithoutCss[nextOpen + 4];
                  if (charAfterDiv === ' ' || charAfterDiv === '>' || charAfterDiv === '\t' || charAfterDiv === '\n' || charAfterDiv === '\r' || charAfterDiv === '/') {
                    depth++;
                  }
                  scanPos = nextOpen + 4;
                } else {
                  depth--;
                  if (depth === 0) {
                    htmlWithoutCss = htmlWithoutCss.substring(0, tbStart) + htmlWithoutCss.substring(nextClose + 6);
                  } else {
                    scanPos = nextClose + 6;
                  }
                }
              }
            }
          }
          console.log(`[PUBLISH] ✅ bgpt-thumbnail-box 제거 → separator 구조로 교체 예정`);
        }

        // 🔥 Blogger 피드 대표이미지 인식을 위한 separator 구조 사용 (항상 추가)
        const thumbnailHtml = `
<div class="separator" style="clear: both; text-align: center; margin: 0 0 32px 0;">
  <a href="${processedThumbnailUrl}" style="margin-left: 1em; margin-right: 1em;">
    <img border="0" data-original-height="630" data-original-width="1200" src="${processedThumbnailUrl}" alt="${title || '썸네일 이미지'}" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);" />
  </a>
</div>`;

        finalHtmlContent = finalHtmlContent.replace(separatorSlotMarker, thumbnailHtml);
        console.log(`[PUBLISH] ✅ 썸네일 HTML 추가됨 (separator 구조, CSS 앞에 배치, ${thumbnailHtml.length}자)`);
        onLog?.(`[PUBLISH] ✅ 썸네일 추가 완료 (separator 구조, CSS 앞에 배치)`);
      } else {
        console.log(`[PUBLISH] ℹ️ 유효한 썸네일 없음 - 기본 이미지 추가`);

        // 기본 썸네일 이미지 추가 (실제 제목 표시)
        // 제목을 SVG용으로 안전하게 처리 (특수문자, HTML 엔티티, 이모지 제거)
        const safeTitle = (title || '새 글')
          // 모든 이모지 제거 (이모지 유니코드 범위)
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/[\u{2600}-\u{26FF}]/gu, '')
          .replace(/[\u{2700}-\u{27BF}]/gu, '')
          .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
          .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
          .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
          .replace(/[\uD800-\uDFFF]/g, '') // 서로게이트 쌍 제거
          .replace(/[🚨🔥💰✅❌⚠️📌📊💡🎯]/g, '') // 일반적인 이모지 직접 제거
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .trim()
          .substring(0, 40); // 40자 제한

        // 제목 줄바꿈 처리 (20자 단위)
        const titleLines = [];
        for (let i = 0; i < safeTitle.length; i += 20) {
          titleLines.push(safeTitle.substring(i, i + 20));
        }

        // SVG에서 tspan으로 여러 줄 렌더링
        const titleTspans = titleLines.map((line, idx) => {
          const yOffset = 315 + (idx - (titleLines.length - 1) / 2) * 70;
          return `<tspan x="600" y="${yOffset}">${line}</tspan>`;
        }).join('');

        const defaultThumbnailHtml = `<div style="margin: 0 0 20px 0; text-align: center;">
  <img src="data:image/svg+xml;base64,${Buffer.from(`
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="orangeBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#ea580c;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1" />
    </linearGradient>
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="2" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="#f5f5f5"/>
  <rect x="50" y="50" width="1100" height="530" fill="#ffffff" stroke="url(#orangeBorder)" stroke-width="8" rx="16" ry="16"/>
  <text font-family="'Noto Sans KR', 'Malgun Gothic', sans-serif"
        font-size="55" font-weight="900"
        text-anchor="middle" fill="#1a1a1a"
        filter="url(#textShadow)" letter-spacing="-1">
    ${titleTspans}
  </text>
</svg>`).toString('base64')}"
       alt="${safeTitle}" style="max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
</div>`;

        finalHtmlContent = finalHtmlContent.replace(separatorSlotMarker, defaultThumbnailHtml);
        console.log(`[PUBLISH] ✅ 기본 썸네일 추가됨 (CSS 앞에 배치)`);
        onLog?.(`[PUBLISH] ✅ 기본 썸네일 이미지 추가 (CSS 앞에 배치)`);
      }
    } // hasThumbnailAlready guard end

    // 🧹 마커가 남아있으면 제거 (이미 separator가 있어서 스킵된 경우)
    finalHtmlContent = finalHtmlContent.replace(separatorSlotMarker + '\n', '');

    // 3. 본문 추가 (CSS 제거된 본문 사용)
    // HTML 태그 중간에 잘리지 않도록 처리
    const htmlWithoutCssLength = htmlWithoutCss ? htmlWithoutCss.length : 0;
    if (htmlWithoutCssLength > maxContentSize) {
      const truncatedLength = maxContentSize;
      const removedLength = htmlWithoutCssLength - truncatedLength;
      const removedPercent = ((removedLength / htmlWithoutCssLength) * 100).toFixed(1);

      console.log(`[PUBLISH] ⚠️ [본문 잘림] htmlWithoutCss가 너무 큽니다:`);
      console.log(`[PUBLISH]    - 원본 길이: ${htmlWithoutCssLength.toLocaleString()}자`);
      console.log(`[PUBLISH]    - 제한 길이: ${truncatedLength.toLocaleString()}자`);
      console.log(`[PUBLISH]    - 잘린 길이: ${removedLength.toLocaleString()}자 (${removedPercent}%)`);

      let truncated = htmlWithoutCss.substring(0, maxContentSize);
      const beforeTagFix = truncated.length;

      // 마지막 열린 태그를 찾아서 닫기
      const lastOpenTag = truncated.lastIndexOf('<');
      const lastCloseTag = truncated.lastIndexOf('>');
      if (lastOpenTag > lastCloseTag) {
        truncated = truncated.substring(0, lastOpenTag);
        console.log(`[PUBLISH]    - 열린 태그 보호: ${beforeTagFix}자 → ${truncated.length}자`);
      }

      // 마지막 닫히지 않은 태그들 닫기
      const openDivs = (truncated.match(/<div[^>]*>/gi) || []).length;
      const closeDivs = (truncated.match(/<\/div>/gi) || []).length;
      const openPs = (truncated.match(/<p[^>]*>/gi) || []).length;
      const closePs = (truncated.match(/<\/p>/gi) || []).length;
      const unclosedDivs = openDivs - closeDivs;
      const unclosedPs = openPs - closePs;

      if (unclosedDivs > 0 || unclosedPs > 0) {
        console.log(`[PUBLISH]    - 닫히지 않은 태그: <div> ${unclosedDivs}개, <p> ${unclosedPs}개`);
      }

      for (let i = 0; i < unclosedDivs; i++) {
        truncated += '</div>';
      }
      for (let i = 0; i < unclosedPs; i++) {
        truncated += '</p>';
      }

      finalHtmlContent += truncated + '\n\n<!-- 콘텐츠가 일부 잘렸습니다 -->';
      onLog?.(`[PUBLISH] ⚠️ [본문 잘림] ${removedLength.toLocaleString()}자 (${removedPercent}%)가 잘렸습니다. 원본: ${htmlWithoutCssLength.toLocaleString()}자`);
    } else {
      finalHtmlContent += htmlWithoutCss;
      console.log(`[PUBLISH] ✅ [본문 크기] 정상 범위 내 (${htmlWithoutCssLength.toLocaleString()}자 / 제한: ${maxContentSize.toLocaleString()}자)`);
    }

    // SUPREME AI SKIN 클래스 추가
    finalHtmlContent = finalHtmlContent.replace(
      /<div[^>]*class="[^"]*max-mode-article[^"]*"[^>]*>/,
      (match) => match.replace('max-mode-article', 'max-mode-article supreme-ai-skin')
    );

    // 만약 max-mode-article 클래스가 없다면 추가
    if (!finalHtmlContent.includes('supreme-ai-skin')) {
      finalHtmlContent = finalHtmlContent.replace(
        /(<div[^>]*>)/,
        '$1<div class="supreme-ai-skin">'
      );
    }

    // HTML 구조 닫기
    finalHtmlContent += `
</div>
<!-- Blogger HTML Content End -->`;

    // 4. 최종 검증: CSS 포함 여부 및 Blogger 적용 가능성 확인
    const hasStyleTag = finalHtmlContent.includes('<style');
    const styleTagCount = (finalHtmlContent.match(/<style[^>]*>/gi) || []).length;
    const hasMaxModeArticle = finalHtmlContent.includes('max-mode-article') || finalHtmlContent.includes('premium-article');
    const hasImportantRules = finalHtmlContent.includes('!important');
    const cssSize = cssContent ? cssContent.length : 0;

    console.log(`[PUBLISH] 🔍 [CSS 상세 검증 시작]`);
    console.log(`[PUBLISH]    - Style 태그 존재: ${hasStyleTag ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - Style 태그 개수: ${styleTagCount}개`);
    console.log(`[PUBLISH]    - max-mode-article 클래스: ${hasMaxModeArticle ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - !important 규칙: ${hasImportantRules ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - CSS 크기: ${cssSize.toLocaleString()}자`);
    console.log(`[PUBLISH]    - 핵 옵션 포함: ${finalHtmlContent.includes('핵 옵션') ? '✅' : '❌'}`);

    if (!hasStyleTag && cssContent) {
      console.error(`[PUBLISH] ❌ [CSS 검증] 최종 HTML에 CSS가 포함되지 않았습니다! 강제 추가합니다.`);
      onLog?.(`[PUBLISH] ❌ 긴급: CSS가 누락되어 강제 추가했습니다. Blogger에서 스타일이 적용되지 않을 수 있습니다.`);
      finalHtmlContent = cssContent + '\n' + finalHtmlContent;
      console.log(`[PUBLISH] ✅ CSS를 강제로 추가했습니다.`);
    } else if (hasStyleTag) {
      if (styleTagCount > 1) {
        console.warn(`[PUBLISH] ⚠️ [CSS 중복] <style> 태그가 ${styleTagCount}개 발견되었습니다. 중복 가능성이 있습니다.`);
        onLog?.(`[PUBLISH] ⚠️ CSS 스타일 태그가 ${styleTagCount}개 발견되었습니다.`);
      }

      // Blogger 적용 가능성 추가 검증
      if (!hasMaxModeArticle) {
        console.warn(`[PUBLISH] ⚠️ [CSS 검증] max-mode-article 클래스가 발견되지 않았습니다. 인라인 스타일로 전환합니다.`);
        onLog?.(`[PUBLISH] ⚠️ 콘텐츠 클래스 누락으로 인라인 스타일 적용 (CSS 실패 대비)`);
        finalHtmlContent = applyInlineStyles(finalHtmlContent);
      }

      if (!hasImportantRules) {
        console.warn(`[PUBLISH] ⚠️ [CSS 검증] !important 규칙이 부족합니다. Blogger의 기본 CSS가 우선 적용될 수 있습니다.`);
        onLog?.(`[PUBLISH] ⚠️ CSS 우선순위 낮음: Blogger 템플릿의 기본 스타일이 적용될 수 있습니다.`);
        // !important 부족 시에도 인라인 스타일 적용 고려
        if (!hasMaxModeArticle) {
          finalHtmlContent = applyInlineStyles(finalHtmlContent);
        }
      }

      console.log(`[PUBLISH] ✅ [CSS 검증] 최종 HTML에 CSS 스타일이 포함되어 있습니다. (${styleTagCount}개)`);
      onLog?.(`[PUBLISH] ✅ 최종 HTML 검증 완료: CSS 스타일 포함됨`);

      if (hasMaxModeArticle && hasImportantRules && cssSize > 10000) {
        onLog?.(`[PUBLISH] 🎯 Blogger CSS 적용 가능성이 높습니다 (클래스+우선순위+크기 모두 양호)`);
      } else {
        onLog?.(`[PUBLISH] ⚠️ Blogger CSS 적용이 불안정할 수 있습니다. 템플릿 설정을 확인해주세요.`);
      }
    }

    // 🛡️ [안전 최우선] HTML 태그 검증 - 자동 수정 없음 (텍스트 손상 방지)
    const tagWarnings = [];
    const selfClosingTags = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
    const commonTags = ['div', 'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'a', 'img', 'strong', 'em', 'b', 'i'];

    // 🛡️ 경쟁 블로그 링크 제거 (트래픽 유출 방지)
    finalHtmlContent = removeCompetitorLinks(finalHtmlContent);

    // 🎯 [안전 최우선] JavaScript 코드 제거 - 텍스트 콘텐츠 절대 손상 방지
    console.log('[PUBLISH] JavaScript 코드 제거 전 HTML 길이:', finalHtmlContent.length);
    const beforeJsRemoval = finalHtmlContent.length;

    // ✅ 전략 1: 완전한 <script> 태그만 제거 (내용 포함)
    const scriptTagCount = (finalHtmlContent.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []).length;
    finalHtmlContent = finalHtmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    console.log(`[PUBLISH] 🗑️ <script> 태그 ${scriptTagCount}개 제거됨`);

    // ✅ 전략 2: HTML 태그 내 이벤트 핸들러만 제거 (매우 보수적으로)
    let eventHandlerRemoved = 0;
    finalHtmlContent = finalHtmlContent.replace(/<[^>]+>/gi, (tagMatch) => {
      // 태그 내부에서만 이벤트 핸들러 제거
      const originalTag = tagMatch;
      const cleanedTag = tagMatch
        .replace(/\s+on\w+="[^"]*"/gi, () => { eventHandlerRemoved++; return ''; }) // onclick="..." 제거
        .replace(/\s+on\w+='[^']*'/gi, () => { eventHandlerRemoved++; return ''; }); // onclick='...' 제거

      return cleanedTag;
    });
    console.log(`[PUBLISH] 🗑️ 이벤트 핸들러 ${eventHandlerRemoved}개 제거됨`);

    // ✅ 전략 3: CSS 내 JavaScript 코드만 제거 (드문 경우)
    finalHtmlContent = finalHtmlContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
      if (cssContent.includes('javascript:') || cssContent.includes('vbscript:')) {
        console.log('[PUBLISH] ⚠️ CSS 내 JavaScript 코드 발견, 정리 중...');
        const cleanCss = cssContent
          .replace(/javascript:[^;}]*/gi, '')
          .replace(/vbscript:[^;}]*/gi, '')
          .replace(/behavior:[^;}]*/gi, '');
        return `<style>${cleanCss}</style>`;
      }
      return match;
    });

    const jsRemovedLength = beforeJsRemoval - finalHtmlContent.length;
    if (jsRemovedLength > 0) {
      console.log(`[PUBLISH] 🔧 JavaScript 코드 ${jsRemovedLength}자 제거됨`);
    }
    console.log('[PUBLISH] JavaScript 코드 제거 후 HTML 길이:', finalHtmlContent.length);

    // 1. 제어 문자 제거 (인코딩 문제 해결)
    const beforeControlCharCleanup = finalHtmlContent.length;
    // 인코딩 문제 해결: 이모지만 HTML 엔티티로 변환
    finalHtmlContent = finalHtmlContent
      .replace(/📊/g, '&#128202;')
      .replace(/📈/g, '&#128200;')
      .replace(/📉/g, '&#128201;')
      .replace(/🥧/g, '&#129383;')
      .replace(/📖/g, '&#128214;')
      .replace(/💬/g, '&#128172;')
      .replace(/🔗/g, '&#128279;')
      .replace(/✅/g, '&#9989;')
      .replace(/🔄/g, '&#128257;')
      .replace(/🎯/g, '&#127919;')
      .replace(/🚀/g, '&#128640;')
      .replace(/📱/g, '&#128241;')
      .replace(/🎨/g, '&#127912;')
      .replace(/📐/g, '&#128208;')
      .replace(/🔧/g, '&#128295;')
      .replace(/⚙️/g, '&#9881;')
      .replace(/💡/g, '&#128161;')
      .replace(/⭐/g, '&#11088;')
      .replace(/🎉/g, '&#127881;')
      .replace(/💾/g, '&#128190;')
      .replace(/📝/g, '&#128221;')
      .replace(/🖼️/g, '&#128444;')
      .replace(/📅/g, '&#128197;')
      .replace(/🆔/g, '&#127358;')
      .replace(/📄/g, '&#128196;')
      .replace(/📏/g, '&#128207;')
      .replace(/⏱️/g, '&#9203;')
      .replace(/🔑/g, '&#128273;')
      .replace(/🔐/g, '&#128274;')
      .replace(/📤/g, '&#128228;')
      .replace(/🏷️/g, '&#127991;')
      .replace(/⚠️/g, '&#9888;')
      .replace(/❌/g, '&#10060;')
      .replace(/🎯/g, '&#127919;')
      .replace(/📱/g, '&#128241;')
      .replace(/🎨/g, '&#127912;')
      .replace(/📐/g, '&#128208;')
      .replace(/🔧/g, '&#128295;')
      .replace(/⚙️/g, '&#9881;')
      .replace(/💡/g, '&#128161;')
      .replace(/⭐/g, '&#11088;')
      .replace(/🎉/g, '&#127881;')
      .replace(/💾/g, '&#128190;');

    // 제어 문자 제거 (더 안전하게 - 필수적인 것만)
    const controlCharsBefore = finalHtmlContent.length;
    finalHtmlContent = finalHtmlContent
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // NULL, BELL, VTAB 등 문제되는 제어 문자만 제거
      .replace(/\x7F/g, ''); // DEL 문자 제거

    const removedControlChars = controlCharsBefore - finalHtmlContent.length;
    if (removedControlChars > 0) {
      console.log(`[PUBLISH] 🔧 [인코딩 수정] 제어 문자 ${removedControlChars}개 제거됨`);
      onLog?.(`[PUBLISH] 🔧 제어 문자 ${removedControlChars}개 제거됨`);
    }

    // 2. HTML 구조 검증 및 정리 (JavaScript 파싱 오류 방지)
    try {
      console.log('[PUBLISH] HTML 구조 검증 시작...');

      // 먼저 콘텐츠 샘플 로깅 (디버깅용)
      console.log('[PUBLISH] HTML 콘텐츠 샘플 (처음 500자):', finalHtmlContent.substring(0, 500));
      console.log('[PUBLISH] HTML 콘텐츠 샘플 (마지막 500자):', finalHtmlContent.substring(Math.max(0, finalHtmlContent.length - 500)));

      // HTML에서 잠재적으로 문제가 될 수 있는 패턴 제거
      const originalLength = finalHtmlContent.length;
      // HTML 정리 (더 안전하게 - 최소한만 수정)
      finalHtmlContent = finalHtmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // script 태그 제거
        .replace(/<[^>]*javascript:[^>]*>/gi, (match) => match.replace(/javascript:[^>]*/, '')) // JavaScript 프로토콜만 제거
        .replace(/<!--[\s\S]*?-->/gi, (match) => {
          // 주석에서 JavaScript 코드 제거
          if (match.includes('javascript:') || match.includes('function') || match.includes('var ')) {
            console.log('[PUBLISH] JavaScript 코드 포함된 주석 제거');
            return '';
          }
          return match;
        }); // 주석 처리 완료

      // ⚠️ 주의: 아래 JavaScript 코드 제거는 HTML 태그 내에서만 수행
      // 텍스트 콘텐츠는 절대 건드리지 않음

      const removedLength = originalLength - finalHtmlContent.length;
      if (removedLength > 0) {
        console.log(`[PUBLISH] 🔧 JavaScript 코드 패턴 ${removedLength}자 제거됨`);
      }

      console.log('[PUBLISH] ✅ HTML 구조 검증 및 정리 완료');
    } catch (htmlError) {
      console.error('[PUBLISH] HTML 정리 중 오류:', htmlError);
      // HTML 정리 실패 시 기본적인 정리만 수행
      finalHtmlContent = finalHtmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    }

    // 🔥 인라인 스타일 강제 주입 - Blogger 템플릿 CSS 무시
    // 모든 텍스트 요소에 인라인 스타일을 추가하여 무조건 보이도록 함
    // ⚠️ responsiveLayoutCSS 제거됨 — Blogger가 <div> 내부의 <style> 태그를 strip하여
    //    CSS 텍스트가 본문에 노출되는 버그 수정 (applyInlineStyles()의 CSS가 이미 충분)
    console.log('[PUBLISH] 🔥 인라인 스타일 강제 주입 시작...');

    // p 태그에 인라인 스타일 추가 (더 넓은 줄간격, 큰 글자)
    finalHtmlContent = finalHtmlContent.replace(/<p(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; color: #1a1a1a !important; font-size: 18px !important; line-height: 2 !important; display: block !important; visibility: visible !important; opacity: 1 !important; word-break: keep-all !important;"`);
      }
      return `<p${attrs || ''} style="color: #1a1a1a !important; font-size: 18px !important; line-height: 2 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin-bottom: 20px !important; word-break: keep-all !important;">`;
    });

    // h2 태그에 인라인 스타일 추가 (더 넓은 패딩, 큰 마진)
    finalHtmlContent = finalHtmlContent.replace(/<h2(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; color: #991b1b !important; font-size: 26px !important; font-weight: 700 !important; display: block !important; visibility: visible !important; opacity: 1 !important;"`);
      }
      return `<h2${attrs || ''} style="color: #991b1b !important; font-size: 26px !important; font-weight: 700 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 40px 0 20px 0 !important; padding: 18px 22px !important; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%) !important; border-left: 5px solid #ef4444 !important; border-radius: 0 16px 16px 0 !important; line-height: 1.4 !important;">`;
    });

    // h3 태그에 인라인 스타일 추가 (더 넓은 패딩)
    finalHtmlContent = finalHtmlContent.replace(/<h3(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; color: #1e293b !important; font-size: 21px !important; font-weight: 600 !important; display: block !important; visibility: visible !important; opacity: 1 !important;"`);
      }
      return `<h3${attrs || ''} style="color: #1e293b !important; font-size: 21px !important; font-weight: 600 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 32px 0 16px 0 !important; padding: 14px 18px !important; background: #f8fafc !important; border-left: 4px solid #10b981 !important; border-radius: 0 12px 12px 0 !important; line-height: 1.4 !important;">`;
    });

    // h1 태그에 인라인 스타일 추가 (더 큰 사이즈)
    finalHtmlContent = finalHtmlContent.replace(/<h1(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; color: #0f172a !important; font-size: 34px !important; font-weight: 800 !important; display: block !important; visibility: visible !important; opacity: 1 !important;"`);
      }
      return `<h1${attrs || ''} style="color: #0f172a !important; font-size: 34px !important; font-weight: 800 !important; display: block !important; visibility: visible !important; opacity: 1 !important; margin: 0 0 32px 0 !important; line-height: 1.3 !important;">`;
    });

    // li 태그에 인라인 스타일 추가 (더 넓은 간격)
    finalHtmlContent = finalHtmlContent.replace(/<li(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; color: #1a1a1a !important; font-size: 17px !important; display: list-item !important; visibility: visible !important; opacity: 1 !important;"`);
      }
      return `<li${attrs || ''} style="color: #1a1a1a !important; font-size: 17px !important; line-height: 1.9 !important; display: list-item !important; visibility: visible !important; opacity: 1 !important; margin-bottom: 12px !important;">`;
    });

    // ul, ol 태그 스타일 (넓은 패딩)
    finalHtmlContent = finalHtmlContent.replace(/<(ul|ol)(\s[^>]*)?>/gi, (match, tag, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; padding-left: 24px !important; margin: 20px 0 !important;"`);
      }
      return `<${tag}${attrs || ''} style="padding-left: 24px !important; margin: 20px 0 !important;">`;
    });

    // div에도 기본 스타일 추가 (콘텐츠 컨테이너용 - 전체 너비)
    finalHtmlContent = finalHtmlContent.replace(/<div(\s[^>]*class\s*=\s*["'][^"']*(?:content|article|section|container)[^"']*["'][^>]*)?>/gi, (match, attrs) => {
      if (!attrs) return match;
      const existingStyle = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; display: block !important; visibility: visible !important; opacity: 1 !important; max-width: 100% !important; width: 100% !important;"`);
      }
      return match.replace('>', ' style="display: block !important; visibility: visible !important; opacity: 1 !important; max-width: 100% !important; width: 100% !important;">');
    });

    // strong 태그 스타일
    finalHtmlContent = finalHtmlContent.replace(/<strong(\s[^>]*)?>/gi, (match, attrs) => {
      return `<strong${attrs || ''} style="color: #0f172a !important; font-weight: 700 !important; display: inline !important; visibility: visible !important;">`;
    });

    // span 태그 스타일 (텍스트가 숨겨지지 않도록)
    finalHtmlContent = finalHtmlContent.replace(/<span(\s[^>]*)?>/gi, (match, attrs) => {
      const existingStyle = attrs && attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      if (existingStyle) {
        return match.replace(existingStyle[0], `style="${existingStyle[1]}; display: inline !important; visibility: visible !important; opacity: 1 !important;"`);
      }
      return `<span${attrs || ''} style="display: inline !important; visibility: visible !important; opacity: 1 !important;">`;
    });

    console.log('[PUBLISH] ✅ 인라인 스타일 강제 주입 완료 (넓은 레이아웃 적용)');

    // 2. CSS 중복 제거 (여러 style 태그를 하나로 통합)
    const styleTagMatches = finalHtmlContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    if (styleTagMatches.length > 1) {
      console.log(`[PUBLISH] 🔧 [CSS 중복 수정] <style> 태그 ${styleTagMatches.length}개를 1개로 통합 중...`);
      const allCssContent = styleTagMatches.map(match => {
        const cssMatch = match.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        return cssMatch ? cssMatch[1].trim() : '';
      }).filter(Boolean).join('\n\n');

      // 모든 style 태그 제거
      finalHtmlContent = finalHtmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      // 통합된 CSS를 맨 앞에 추가
      if (allCssContent) {
        finalHtmlContent = `<style>\n${allCssContent}\n</style>\n${finalHtmlContent}`;
        console.log(`[PUBLISH] ✅ [CSS 중복 수정] ${styleTagMatches.length}개 style 태그를 1개로 통합 완료`);
        onLog?.(`[PUBLISH] ✅ CSS 중복 제거 완료: ${styleTagMatches.length}개 → 1개`);
      }
    }

    // 3. HTML 태그 불일치 검증 (안전 모드 - 자동 수정 없음)
    commonTags.forEach(tag => {
      const openTags = (finalHtmlContent.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length;
      const closeTags = (finalHtmlContent.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      const diff = openTags - closeTags;

      if (openTags !== closeTags && !selfClosingTags.has(tag.toLowerCase())) {
        tagWarnings.push({ tag, open: openTags, close: closeTags, diff });

        // 🚫 자동 수정하지 않음 (텍스트 손상 위험)
        if (diff > 0) {
          console.warn(`[PUBLISH] ⚠️ [태그 불일치] <${tag}> 태그: 열림 ${openTags}개, 닫힘 ${closeTags}개 (${diff}개 부족)`);
          console.warn(`[PUBLISH] 💡 해결 방법: HTML 구조를 확인하고 적절한 닫기 태그를 추가하세요`);
          onLog?.(`[PUBLISH] ⚠️ <${tag}> 태그 불일치 감지됨 (${diff}개 부족) - 수동 확인 필요`);
        } else if (diff < 0) {
          console.warn(`[PUBLISH] ⚠️ [태그 불일치] <${tag}> 태그: 열림 ${openTags}개, 닫힘 ${closeTags}개 (${Math.abs(diff)}개 과도)`);
          console.warn(`[PUBLISH] 💡 해결 방법: 과도한 닫기 태그를 제거하세요`);
          onLog?.(`[PUBLISH] ⚠️ <${tag}> 태그 불일치 감지됨 (${Math.abs(diff)}개 과도) - 수동 확인 필요`);
        }
      }
    });

    // 4. 특수 태그 처리 (img, br 등 자동 닫기 태그)
    // img 태그가 닫히지 않은 경우 자동으로 닫기
    const imgTags = (finalHtmlContent.match(/<img[^>]*>/gi) || []).length;
    const imgCloseTags = (finalHtmlContent.match(/<\/img>/gi) || []).length;
    if (imgTags > 0 && imgCloseTags === 0) {
      // img 태그는 자동 닫기 태그이므로 정상 (닫기 태그가 없어도 됨)
      console.log(`[PUBLISH] ✅ [IMG 태그] ${imgTags}개 img 태그 (자동 닫기 태그, 정상)`);
    }

    // 5. 최종 검증
    const finalTagMismatches = [];
    commonTags.forEach(tag => {
      if (selfClosingTags.has(tag.toLowerCase())) return;
      const openTags = (finalHtmlContent.match(new RegExp(`<${tag}[^>]*>`, 'gi')) || []).length;
      const closeTags = (finalHtmlContent.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
      if (openTags !== closeTags) {
        finalTagMismatches.push({ tag, open: openTags, close: closeTags, diff: openTags - closeTags });
      }
    });

    if (finalTagMismatches.length > 0) {
      console.warn(`[PUBLISH] ⚠️ [HTML 태그 불일치] 수정 후에도 ${finalTagMismatches.length}개 태그에서 불일치 발견:`);
      finalTagMismatches.forEach(({ tag, open, close, diff }) => {
        const status = diff > 0 ? '닫히지 않음' : '과도하게 닫힘';
        console.warn(`[PUBLISH]    - <${tag}>: 열림 ${open}개, 닫힘 ${close}개 (차이: ${Math.abs(diff)}개, ${status})`);
      });
      onLog?.(`[PUBLISH] ⚠️ HTML 태그 불일치가 ${finalTagMismatches.length}개 남아있습니다.`);
    } else {
      if (tagWarnings.length > 0) {
        console.warn(`[PUBLISH] ⚠️ [HTML 태그 검증] ${tagWarnings.length}개 태그 구조 문제가 발견되었습니다.`);
        console.warn(`[PUBLISH] 💡 HTML 구조를 수동으로 검토하여 태그를 올바르게 닫아주세요.`);
        onLog?.(`[PUBLISH] ⚠️ ${tagWarnings.length}개 HTML 태그 구조 문제 발견`);
      } else {
        console.log(`[PUBLISH] ✅ [HTML 태그 검증] 모든 태그가 올바르게 구조화되어 있습니다.`);
        onLog?.(`[PUBLISH] ✅ HTML 태그 구조 검증 완료`);
      }
    }

    // CTA 자동생성 적용 (콘텐츠에 맞는 관련 사이트 링크 추가)
    // TypeScript 모듈 임포트 문제로 임시 주석 처리됨
    /*
    try {
      console.log('[PUBLISH] [CTA 자동생성] 콘텐츠 분석 및 CTA 추가 시작...');
      finalHtmlContent = addAutoCTAs(finalHtmlContent, 3); // 최대 3개 CTA 추가
      console.log('[PUBLISH] [CTA 자동생성] CTA 추가 완료');
    } catch (ctaError) {
      console.warn('[PUBLISH] [CTA 자동생성] CTA 추가 중 오류 발생:', ctaError.message);
      // CTA 추가 실패 시 원본 콘텐츠 사용
    }
    */

    // ============================================
    // 🔥 수익 최적화: FAQ 섹션 + 이전글 배너
    // ============================================

    // === 1. FAQ 섹션 자동 생성 (H2에서 Q&A 추출, FAQPage schema 포함) ===
    // 🛡️ 중복 방지: 콘텐츠 생성 단계에서 이미 FAQ가 포함된 경우 스킵
    const hasFaqAlready = /자주\s*묻는\s*질문|FAQ/i.test(finalHtmlContent);
    if (hasFaqAlready) {
      console.log(`[PUBLISH] ✅ [FAQ] 콘텐츠에 이미 FAQ 섹션이 포함되어 있습니다. 중복 생성 스킵.`);
    } else {
      try {
        const faqPairs = [];
        const h2Regex = /<h2[^>]*>(.*?)<\/h2>([\s\S]*?)(?=<h2|$)/gi;
        let faqMatch;
        while ((faqMatch = h2Regex.exec(finalHtmlContent)) && faqPairs.length < 5) {
          const question = faqMatch[1].replace(/<[^>]+>/g, '').trim();
          const sectionContent = faqMatch[2];
          const pMatch = sectionContent.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (pMatch) {
            const answer = pMatch[1].replace(/<[^>]+>/g, '').trim();
            if (question.length > 5 && answer.length > 20) {
              faqPairs.push({ q: question, a: answer });
            }
          }
        }

        if (faqPairs.length >= 2) {
          let faqHtml = `\n<div class="rv-faq-section" itemscope itemtype="https://schema.org/FAQPage" style="margin:48px 0;padding:32px;background:linear-gradient(135deg,#f0f9ff 0%,#e8f4fd 100%);border-radius:16px;border-left:5px solid #3b82f6;">\n  <h2 style="font-size:24px;font-weight:800;color:#1e3a5f;margin-bottom:24px;">❓ 자주 묻는 질문</h2>`;
          for (const faq of faqPairs) {
            const safeQ = faq.q.replace(/"/g, '&quot;');
            const safeA = faq.a.replace(/"/g, '&quot;');
            faqHtml += `\n  <div itemscope itemprop="mainEntity" itemtype="https://schema.org/Question" style="margin-bottom:20px;padding:20px;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">\n    <h3 itemprop="name" style="font-size:19px;font-weight:700;color:#1e293b;margin-bottom:10px;">Q. ${safeQ}</h3>\n    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">\n      <p itemprop="text" style="font-size:17px;color:#475569;line-height:1.8;margin:0;">A. ${safeA}</p>\n    </div>\n  </div>`;
          }
          faqHtml += `\n</div>`;
          finalHtmlContent += faqHtml;
          console.log(`[PUBLISH] ✅ [FAQ] ${faqPairs.length}개 FAQ 항목 생성 완료`);
        } else {
          console.log(`[PUBLISH] ⚠️ [FAQ] H2에서 추출된 Q&A가 부족합니다 (${faqPairs.length}개). FAQ 섹션 생략.`);
        }
      } catch (faqError) {
        console.warn('[PUBLISH] ⚠️ [FAQ] FAQ 생성 중 오류 (무시):', faqError.message);
      }
    }

    // === 2. 이전글 배너 (blogger.posts.list 활용) ===
    try {
      console.log('[PUBLISH] [이전글] 이전글 배너 생성 시작...');
      const prevPostList = await blogger.posts.list({
        blogId: blogId,
        maxResults: 1,
        orderBy: 'published',
        status: 'live'
      });
      const prevPost = prevPostList?.data?.items?.[0];
      if (prevPost && prevPost.url && prevPost.title) {
        const safePrevTitle = prevPost.title.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const bannerHtml = `\n<div class="rv-prev-post" style="margin:48px 0;padding:24px 28px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:16px;box-shadow:0 8px 24px rgba(102,126,234,0.25);">\n  <a href="${prevPost.url}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:16px;text-decoration:none;color:white;">\n    <span style="font-size:32px;flex-shrink:0;">📖</span>\n    <div style="flex:1;">\n      <p style="font-size:13px;opacity:0.85;margin:0 0 6px 0;font-weight:600;">👈 이전 글 보기</p>\n      <p style="font-size:18px;font-weight:700;margin:0;line-height:1.4;">${safePrevTitle}</p>\n    </div>\n    <span style="font-size:24px;flex-shrink:0;">→</span>\n  </a>\n</div>`;
        finalHtmlContent += bannerHtml;
        console.log(`[PUBLISH] ✅ [이전글] 배너 추가 완료: ${prevPost.title}`);
      } else {
        console.log('[PUBLISH] ⚠️ [이전글] 이전 발행글이 없습니다. 배너 생략.');
      }
    } catch (prevError) {
      console.warn('[PUBLISH] ⚠️ [이전글] 배너 생성 실패 (무시):', prevError.message);
    }

    // 🔥 [NUCLEAR] 최종 separator 삽입 - Blogger 대시보드 썸네일 인식 보장
    // Blogger API는 <style> 태그를 Schema.org 래퍼보다 앞으로 이동시킴
    // 따라서 separator는 모든 것 앞에 (최상위에) 위치해야 함
    // 작동하는 기존 글들은 separator가 LINE 1이고 <style>이 그 뒤에 있음
    {
      const firstImgIdx = finalHtmlContent.indexOf('<img');
      const firstStyleIdx = finalHtmlContent.indexOf('<style');

      if (firstStyleIdx >= 0 && (firstImgIdx < 0 || firstImgIdx > firstStyleIdx)) {
        // <img>가 없거나 <style>보다 뒤에 있음 → 썸네일 인식 불가
        console.log(`[PUBLISH] 🔥 [NUCLEAR] <img> 위치(${firstImgIdx}) > <style> 위치(${firstStyleIdx}) → separator 최상위 삽입 시작`);

        // 콘텐츠에서 첫 번째 img의 src를 추출
        const imgSrcMatch = finalHtmlContent.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
        if (imgSrcMatch) {
          const imgSrc = imgSrcMatch[1];
          // data:image/svg는 Blogger가 썸네일로 인식 못할 수 있으므로 http URL 우선
          const isValidUrl = imgSrc.startsWith('http://') || imgSrc.startsWith('https://');

          if (isValidUrl) {
            const nuclearSeparator = `<div class="separator" style="clear: both; text-align: center;"><a href="${imgSrc}" style="display: block; padding: 1em 0; text-align: center;"><img border="0" data-original-height="630" data-original-width="1200" src="${imgSrc}" alt="${(title || '').replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;"/></a></div>\n`;
            finalHtmlContent = nuclearSeparator + finalHtmlContent;
            console.log(`[PUBLISH] ✅ [NUCLEAR] separator를 HTML 최상위에 삽입 완료 (${nuclearSeparator.length}자)`);

            // 🔥 중복 제거: NUCLEAR로 최상위에 삽입했으므로, 본문 내 기존 separator 제거
            // NUCLEAR separator 직후부터 동일 imgSrc를 가진 두 번째 separator를 찾아 제거
            const searchStart = nuclearSeparator.length;
            const dupMarker = `class="separator"`;
            let dupPos = finalHtmlContent.indexOf(dupMarker, searchStart);
            while (dupPos > -1) {
              // 이 separator의 시작 (<div) 찾기
              const divStart = finalHtmlContent.lastIndexOf('<div', dupPos);
              if (divStart > -1) {
                // 이 separator의 끝 (</div>) 찾기
                const divEnd = finalHtmlContent.indexOf('</div>', dupPos);
                if (divEnd > -1) {
                  const sepBlock = finalHtmlContent.substring(divStart, divEnd + 6);
                  // 동일한 이미지 URL이 포함된 separator인지 확인
                  if (sepBlock.includes(imgSrc)) {
                    finalHtmlContent = finalHtmlContent.substring(0, divStart) + finalHtmlContent.substring(divEnd + 6);
                    console.log(`[PUBLISH] ✅ [NUCLEAR] 본문 내 중복 separator 제거 완료 (위치: ${divStart}, 길이: ${sepBlock.length}자)`);
                    break; // 하나만 제거
                  }
                }
              }
              dupPos = finalHtmlContent.indexOf(dupMarker, dupPos + dupMarker.length);
            }
            onLog?.(`[PUBLISH] ✅ 썸네일 separator를 최상위에 삽입 (Blogger 대시보드 인식용)`);
          } else {
            console.log(`[PUBLISH] ⚠️ [NUCLEAR] 첫 이미지가 외부 URL이 아님 (${imgSrc.substring(0, 50)}...) → 기본 SVG 사용`);
          }
        }
      } else {
        console.log(`[PUBLISH] ✅ [NUCLEAR] <img>(${firstImgIdx})가 이미 <style>(${firstStyleIdx})보다 앞에 있음 → 추가 삽입 불필요`);
      }
    }

    // body 객체 생성 (안전한 HTML 콘텐츠)
    body = {
      kind: 'blogger#post',
      blog: { id: blogId },
      title: title,
      content: finalHtmlContent.trim()
    };

    // 최종 HTML 검증
    console.log(`[PUBLISH] [최종 HTML 검증] 검증 시작...`);
    // 최종 HTML 콘텐츠 검증 (Blogger API 전송 전 필수)
    console.log('[PUBLISH] [최종 검증] HTML 콘텐츠 검증 시작...');

    // HTML 길이 검증
    const finalContentLength = finalHtmlContent.length;
    if (finalContentLength === 0) {
      console.error('[PUBLISH] ❌ 최종 HTML 콘텐츠가 비어있습니다');
      return {
        ok: false,
        error: 'HTML 콘텐츠 생성에 실패했습니다. 콘텐츠가 비어있습니다.'
      };
    }

    // HTML 구조 검증
    const hasBasicHtml = finalHtmlContent.includes('<div>') || finalHtmlContent.includes('<p>') || finalHtmlContent.includes('<h');
    if (!hasBasicHtml) {
      console.error('[PUBLISH] ❌ HTML에 기본 구조가 없습니다');
      return {
        ok: false,
        error: 'HTML 콘텐츠에 기본 구조가 없습니다. 콘텐츠 생성을 다시 시도해주세요.'
      };
    }

    // JavaScript 코드 잔존 검증
    const hasJavaScript = finalHtmlContent.includes('<script') ||
      finalHtmlContent.includes('javascript:') ||
      finalHtmlContent.includes('onclick') ||
      finalHtmlContent.includes('onload');
    if (hasJavaScript) {
      console.warn('[PUBLISH] ⚠️ HTML에 JavaScript 코드가 아직 남아있습니다. 추가 정리 수행...');
      finalHtmlContent = finalHtmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/javascript:[^"'\s]*/gi, '')
        .replace(/onclick\s*=\s*["'][^"']*["']/gi, '')
        .replace(/onload\s*=\s*["'][^"']*["']/gi, '');
      console.log('[PUBLISH] ✅ 잔존 JavaScript 코드 정리 완료');
    }

    // HTML 엔티티 검증 (태그 파괴 버그 수정: <img>, <a>, <span> 등 모든 태그 보존)
    // 주의: 이전 코드는 모든 < > 를 &lt; &gt;로 변환 후 div/p/h1-6만 복원하여
    // img, a, span, table, style 등 대부분의 HTML 태그가 파괴되었음
    // 수정: 잘못된 & 문자만 안전하게 수정 (HTML 태그는 건드리지 않음)
    finalHtmlContent = finalHtmlContent
      .replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;'); // 잘못된 & 문자만 수정

    console.log('[PUBLISH] ✅ 최종 HTML 검증 및 정리 완료');

    const hasTitle = body.title && body.title.trim().length > 0;
    const hasContent = body.content && body.content.trim().length > 0;
    const hasBlogId = body.blog && body.blog.id;
    const imageCount = (finalHtmlContent.match(/<img[^>]*>/gi) || []).length;
    const linkCount = (finalHtmlContent.match(/<a[^>]*href=["'][^"']+["']/gi) || []).length;
    const tableCount = (finalHtmlContent.match(/<table[^>]*>/gi) || []).length;
    const listCount = (finalHtmlContent.match(/<(ul|ol)[^>]*>/gi) || []).length;

    console.log(`[PUBLISH]    - HTML 길이: ${finalContentLength.toLocaleString()}자`);
    console.log(`[PUBLISH]    - 제목 존재: ${hasTitle ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - 콘텐츠 존재: ${hasContent ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - Blog ID 존재: ${hasBlogId ? '✅' : '❌'}`);
    console.log(`[PUBLISH]    - 이미지 수: ${imageCount}개`);
    console.log(`[PUBLISH]    - 링크 수: ${linkCount}개`);
    console.log(`[PUBLISH]    - 표 수: ${tableCount}개`);
    console.log(`[PUBLISH]    - 리스트 수: ${listCount}개`);

    // 표 검증 및 자동 수정
    if (tableCount > 0) {
      const tableRows = (finalHtmlContent.match(/<tr[^>]*>/gi) || []).length;
      const tableCells = (finalHtmlContent.match(/<(td|th)[^>]*>/gi) || []).length;
      const closedRows = (finalHtmlContent.match(/<\/tr>/gi) || []).length;
      const closedCells = (finalHtmlContent.match(/<\/(td|th)>/gi) || []).length;

      const rowDiff = tableRows - closedRows;
      const cellDiff = tableCells - closedCells;

      if (tableRows !== closedRows || tableCells !== closedCells) {
        console.warn(`[PUBLISH] ⚠️ [표 검증] 표 태그 불일치 발견:`);
        console.warn(`[PUBLISH]    - <tr>: 열림 ${tableRows}개, 닫힘 ${closedRows}개`);
        console.warn(`[PUBLISH]    - <td>/<th>: 열림 ${tableCells}개, 닫힘 ${closedCells}개`);

        // 자동 수정 시도
        if (rowDiff > 0) {
          console.log(`[PUBLISH] 🔧 [표 수정] <tr> 태그 ${rowDiff}개가 닫히지 않아 자동으로 닫는 중...`);
          for (let i = 0; i < rowDiff; i++) {
            finalHtmlContent += '</tr>';
          }
          onLog?.(`[PUBLISH] 🔧 <tr> 태그 ${rowDiff}개 자동으로 닫힘`);
        } else if (rowDiff < 0) {
          console.log(`[PUBLISH] 🔧 [표 수정] <tr> 태그가 ${Math.abs(rowDiff)}개 과도하게 닫혀 자동으로 제거 중...`);
          let removed = 0;
          finalHtmlContent = finalHtmlContent.replace(/<\/tr>/gi, (match) => {
            if (removed < Math.abs(rowDiff)) {
              removed++;
              return '';
            }
            return match;
          });
          onLog?.(`[PUBLISH] 🔧 <tr> 태그 ${Math.abs(rowDiff)}개 과도한 닫기 태그 제거됨`);
        }

        if (cellDiff > 0) {
          console.log(`[PUBLISH] 🔧 [표 수정] <td>/<th> 태그 ${cellDiff}개가 닫히지 않아 자동으로 닫는 중...`);
          for (let i = 0; i < cellDiff; i++) {
            finalHtmlContent += '</td>';
          }
          onLog?.(`[PUBLISH] 🔧 <td>/<th> 태그 ${cellDiff}개 자동으로 닫힘`);
        } else if (cellDiff < 0) {
          console.log(`[PUBLISH] 🔧 [표 수정] <td>/<th> 태그가 ${Math.abs(cellDiff)}개 과도하게 닫혀 자동으로 제거 중...`);
          let removed = 0;
          finalHtmlContent = finalHtmlContent.replace(/<\/(td|th)>/gi, (match) => {
            if (removed < Math.abs(cellDiff)) {
              removed++;
              return '';
            }
            return match;
          });
          onLog?.(`[PUBLISH] 🔧 <td>/<th> 태그 ${Math.abs(cellDiff)}개 과도한 닫기 태그 제거됨`);
        }

        // 수정 후 재검증
        const finalTableRows = (finalHtmlContent.match(/<tr[^>]*>/gi) || []).length;
        const finalTableCells = (finalHtmlContent.match(/<(td|th)[^>]*>/gi) || []).length;
        const finalClosedRows = (finalHtmlContent.match(/<\/tr>/gi) || []).length;
        const finalClosedCells = (finalHtmlContent.match(/<\/(td|th)>/gi) || []).length;

        if (finalTableRows === finalClosedRows && finalTableCells === finalClosedCells) {
          console.log(`[PUBLISH] ✅ [표 수정] 표 태그 불일치를 모두 수정했습니다.`);
          onLog?.(`[PUBLISH] ✅ 표 태그 불일치 수정 완료`);
        } else {
          console.warn(`[PUBLISH] ⚠️ [표 검증] 수정 후에도 불일치 남음: <tr> ${finalTableRows}/${finalClosedRows}, <td>/<th> ${finalTableCells}/${finalClosedCells}`);
        }
      } else {
        console.log(`[PUBLISH] ✅ [표 검증] 모든 표 태그가 올바르게 닫혔습니다.`);
      }
    }

    // 리스트 검증
    if (listCount > 0) {
      const listItems = (finalHtmlContent.match(/<li[^>]*>/gi) || []).length;
      const closedListItems = (finalHtmlContent.match(/<\/li>/gi) || []).length;

      if (listItems !== closedListItems) {
        console.warn(`[PUBLISH] ⚠️ [리스트 검증] 리스트 태그 불일치 발견:`);
        console.warn(`[PUBLISH]    - <li>: 열림 ${listItems}개, 닫힘 ${closedListItems}개`);
      } else {
        console.log(`[PUBLISH] ✅ [리스트 검증] 모든 리스트 태그가 올바르게 닫혔습니다.`);
      }
    }

    // 링크 검증
    if (linkCount > 0) {
      const brokenLinks = [];
      const linkMatches = finalHtmlContent.match(/<a[^>]*href=["']([^"']+)["']/gi) || [];
      linkMatches.forEach(linkMatch => {
        const hrefMatch = linkMatch.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1];
          // 상대 경로나 잘못된 URL 체크
          if (href.startsWith('javascript:') || (href.startsWith('mailto:') && !href.includes('@'))) {
            brokenLinks.push(href);
          } else if (href.startsWith('http') && !/^https?:\/\//i.test(href)) {
            brokenLinks.push(href);
          }
        }
      });

      if (brokenLinks.length > 0) {
        console.warn(`[PUBLISH] ⚠️ [링크 검증] 문제가 있는 링크 ${brokenLinks.length}개 발견:`);
        brokenLinks.slice(0, 5).forEach((link, idx) => {
          console.warn(`[PUBLISH]    - ${idx + 1}. ${link.substring(0, 100)}`);
        });
      } else {
        console.log(`[PUBLISH] ✅ [링크 검증] 모든 링크가 올바른 형식입니다.`);
      }
    }

    if (!hasTitle || !hasContent || !hasBlogId) {
      console.error(`[PUBLISH] ❌ [최종 HTML 검증] 필수 요소 누락:`);
      if (!hasTitle) console.error(`[PUBLISH]    - 제목 없음`);
      if (!hasContent) console.error(`[PUBLISH]    - 콘텐츠 없음`);
      if (!hasBlogId) console.error(`[PUBLISH]    - Blog ID 없음`);
    } else {
      console.log(`[PUBLISH] ✅ [최종 HTML 검증] 모든 필수 요소가 존재합니다.`);
    }

    // labels는 배열이 있고 요소가 있을 때만 추가 (빈 배열은 제외)
    if (Array.isArray(uniqueLabels) && uniqueLabels.length > 0) {
      const validLabels = uniqueLabels.filter(label =>
        typeof label === 'string' &&
        label.trim().length > 0 &&
        label.trim().length <= 100
      );
      if (validLabels.length > 0) {
        body.labels = validLabels;
        console.log(`[PUBLISH] ✅ labels 추가됨: ${validLabels.length}개`);
      } else {
        console.log(`[PUBLISH] ⚠️ 유효한 labels가 없어서 제외됨`);
      }
    }

    // 🖼️ 썸네일 이미지 추가 (Blogger 대시보드 목록에 썸네일 표시용)
    if (processedThumbnailUrl) {
      body.images = [{ url: processedThumbnailUrl }];
      console.log(`[PUBLISH] ✅ 썸네일 이미지 추가됨: ${processedThumbnailUrl.substring(0, 80)}...`);
      onLog?.(`[PUBLISH] ✅ 대시보드 썸네일 이미지 설정됨`);
    }

    // published 필드 - src/cli.ts와 동일: publishedIso가 있을 때만 추가
    if (isScheduleMode && scheduleDate) {
      console.log(`[PUBLISH] [예약 발행] 예약 발행 모드 활성화`);
      let publishedIso = null;
      let scheduleDateObj = null;

      if (scheduleDate instanceof Date) {
        scheduleDateObj = scheduleDate;
        publishedIso = scheduleDate.toISOString();
      } else if (typeof scheduleDate === 'string') {
        scheduleDateObj = new Date(scheduleDate);
        if (!isNaN(scheduleDateObj.getTime())) {
          publishedIso = scheduleDateObj.toISOString();
        }
      }

      if (scheduleDateObj) {
        const now = new Date();
        const timeDiff = scheduleDateObj.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (isNaN(scheduleDateObj.getTime())) {
          console.error(`[PUBLISH] ❌ [예약 발행] 유효하지 않은 날짜입니다: ${scheduleDate}`);
          onLog?.(`⚠️ 예약 시간이 유효하지 않습니다. 즉시 발행합니다.`);
        } else if (timeDiff < 0) {
          console.warn(`[PUBLISH] ⚠️ [예약 발행] 과거 날짜입니다. 즉시 발행합니다.`);
          console.warn(`[PUBLISH]    - 지정된 시간: ${scheduleDateObj.toLocaleString('ko-KR')}`);
          console.warn(`[PUBLISH]    - 현재 시간: ${now.toLocaleString('ko-KR')}`);
          console.warn(`[PUBLISH]    - 차이: ${Math.abs(hoursDiff).toFixed(1)}시간 전`);
          onLog?.(`⚠️ 예약 시간이 과거입니다. 즉시 발행합니다.`);
        } else {
          console.log(`[PUBLISH] ✅ [예약 발행] 예약 시간 설정 완료`);
          console.log(`[PUBLISH]    - 예약 시간: ${scheduleDateObj.toLocaleString('ko-KR')}`);
          console.log(`[PUBLISH]    - 현재 시간: ${now.toLocaleString('ko-KR')}`);
          console.log(`[PUBLISH]    - 남은 시간: ${hoursDiff.toFixed(1)}시간 후`);
          if (publishedIso) {
            body.published = publishedIso;
            console.log(`[PUBLISH]    - ISO 형식: ${publishedIso}`);
          }
        }
      } else {
        console.warn(`[PUBLISH] ⚠️ [예약 발행] scheduleDate를 파싱할 수 없습니다: ${scheduleDate}`);
      }
    }

    console.log(`[PUBLISH] 요청 본문 준비 완료`);
    console.log(`[PUBLISH] 요청 본문 크기: ${JSON.stringify(body).length}`);
    console.log(`[PUBLISH] Blog ID: "${blogId}"`);
    console.log(`[PUBLISH] isDraft: ${isDraftMode || isScheduleMode || false}`);
    console.log(`[PUBLISH] requestBody 구조:`, {
      kind: body.kind,
      blog: body.blog,
      title: body.title ? body.title.substring(0, 50) + (body.title.length > 50 ? '...' : '') : '없음',
      contentLength: body.content ? body.content.length : 0,
      labelsCount: body.labels ? body.labels.length : 0,
      // replies 필드 제거됨 (Blogger API v3에서 지원하지 않음)
      hasPublished: !!body.published
    });

    // 최종 검증: body 객체가 올바른 형식인지 확인 (400 오류 방지)
    // title과 content는 이미 함수 시작 부분에서 검증했지만, 이중 체크
    if (body.title == null || typeof body.title !== 'string' || body.title.trim().length === 0) {
      const errorMsg = '제목이 비어있거나 올바르지 않습니다.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    if (body.content == null || typeof body.content !== 'string' || body.content.trim().length === 0) {
      const errorMsg = '콘텐츠가 비어있거나 올바르지 않습니다.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    // 제목 정제 (Blogger API가 허용하지 않는 문자 제거/변환)
    // 제목에서 줄바꿈, 탭을 공백으로 변환하고, HTML 특수문자 이스케이프
    let cleanedTitle = body.title
      .replace(/\r\n/g, ' ')  // Windows 줄바꿈
      .replace(/\n/g, ' ')    // Unix 줄바꿈
      .replace(/\r/g, ' ')    // Mac 줄바꿈
      .replace(/\t/g, ' ')    // 탭
      .replace(/\s+/g, ' ')  // 연속 공백을 하나로
      .trim();

    // HTML 특수문자 제거 (Blogger API가 제목에서 HTML 특수문자를 허용하지 않을 수 있음)
    // 실제 테스트 결과: < > & 문자가 있으면 400 오류 발생
    // 따라서 특수문자를 공백으로 대체
    if (/[<>&]/.test(cleanedTitle)) {
      console.log(`[PUBLISH] ⚠️ 제목에 HTML 특수문자 발견, 정제 중...`);
      const beforeClean = cleanedTitle;
      cleanedTitle = cleanedTitle
        .replace(/</g, ' ')  // < 제거
        .replace(/>/g, ' ')  // > 제거
        .replace(/&/g, ' ')  // & 제거 (단, &amp; 같은 엔티티는 이미 처리됨)
        .replace(/\s+/g, ' ')  // 연속 공백을 하나로
        .trim();
      console.log(`[PUBLISH] 제목 정제: "${beforeClean.substring(0, 50)}..." → "${cleanedTitle.substring(0, 50)}..."`);
    }

    // 정제된 제목이 비어있으면 오류
    if (!cleanedTitle || cleanedTitle.length === 0) {
      const errorMsg = '제목이 특수문자 제거 후 비어있습니다. 다른 제목을 사용해주세요.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    // 정제된 제목으로 교체
    body.title = cleanedTitle;

    // 제목 길이 제한 (Blogger API 제한 고려)
    const MAX_TITLE_LENGTH = 500; // 보수적으로 500자로 제한
    const originalTitleLength = body.title.length;
    if (body.title.length > MAX_TITLE_LENGTH) {
      const truncatedTitle = body.title.substring(0, MAX_TITLE_LENGTH);
      const removedLength = originalTitleLength - MAX_TITLE_LENGTH;
      const removedPercent = ((removedLength / originalTitleLength) * 100).toFixed(1);

      console.log(`[PUBLISH] ⚠️ [제목 길이 제한] 제목이 ${MAX_TITLE_LENGTH}자를 초과하여 잘렸습니다:`);
      console.log(`[PUBLISH]    - 원본 길이: ${originalTitleLength}자`);
      console.log(`[PUBLISH]    - 제한 길이: ${MAX_TITLE_LENGTH}자`);
      console.log(`[PUBLISH]    - 잘린 길이: ${removedLength}자 (${removedPercent}%)`);
      console.log(`[PUBLISH]    - 원본 제목: "${body.title}"`);
      console.log(`[PUBLISH]    - 잘린 제목: "${truncatedTitle}..."`);

      body.title = truncatedTitle;
      onLog?.(`⚠️ 제목이 ${MAX_TITLE_LENGTH}자를 초과하여 ${removedLength}자 (${removedPercent}%)가 잘렸습니다.`);
    } else {
      console.log(`[PUBLISH] ✅ [제목 길이] 정상 범위 내 (${originalTitleLength}자 / 제한: ${MAX_TITLE_LENGTH}자)`);
    }

    // 콘텐츠 크기 확인 및 제한 (Blogger API 제한: 약 200KB)
    const contentLength = body.content ? body.content.length : 0;
    let contentSizeBytes = 0;
    let encodingIssues = [];

    try {
      const encoder = new TextEncoder();
      contentSizeBytes = body.content ? encoder.encode(body.content).length : 0;
    } catch (encodingError) {
      console.error(`[PUBLISH] ❌ [인코딩] TextEncoder 인코딩 실패:`, encodingError?.message || encodingError);
      encodingIssues.push(`TextEncoder 인코딩 실패: ${encodingError?.message || '알 수 없는 오류'}`);
      // 폴백: 문자열 길이 * 3 (최악의 경우 UTF-8 3바이트)
      contentSizeBytes = contentLength * 3;
    }

    const contentSizeKB = Math.round(contentSizeBytes / 1024);

    // 인코딩 문제 감지
    if (body.content) {
      // 이모지 감지
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu;
      const emojiMatches = body.content.match(emojiRegex);
      if (emojiMatches && emojiMatches.length > 0) {
        const uniqueEmojis = [...new Set(emojiMatches)];
        console.log(`[PUBLISH] ℹ️ [인코딩] 이모지 ${emojiMatches.length}개 발견 (고유: ${uniqueEmojis.length}개)`);
        if (uniqueEmojis.length <= 10) {
          console.log(`[PUBLISH]    - 이모지 목록: ${uniqueEmojis.join(' ')}`);
        }
      }

      // 특수 문자 감지 (제어 문자, 비표준 문자)
      const controlChars = body.content.match(/[\x00-\x1F\x7F-\x9F]/g);
      if (controlChars && controlChars.length > 0) {
        console.warn(`[PUBLISH] ⚠️ [인코딩] 제어 문자 ${controlChars.length}개 발견`);
        encodingIssues.push(`제어 문자 ${controlChars.length}개`);
      }

      // 잘못된 HTML 엔티티 감지
      const invalidEntities = body.content.match(/&[^#\w]+;/g);
      if (invalidEntities && invalidEntities.length > 0) {
        const uniqueInvalid = [...new Set(invalidEntities)];
        console.warn(`[PUBLISH] ⚠️ [인코딩] 잘못된 HTML 엔티티 ${invalidEntities.length}개 발견 (고유: ${uniqueInvalid.length}개)`);
        if (uniqueInvalid.length <= 5) {
          console.warn(`[PUBLISH]    - 잘못된 엔티티: ${uniqueInvalid.join(', ')}`);
        }
        encodingIssues.push(`잘못된 HTML 엔티티 ${invalidEntities.length}개`);
      }

      // UTF-8 인코딩 검증
      try {
        const testBytes = new TextEncoder().encode(body.content);
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(testBytes);
        if (decoded !== body.content) {
          console.warn(`[PUBLISH] ⚠️ [인코딩] UTF-8 인코딩/디코딩 불일치 감지`);
          encodingIssues.push('UTF-8 인코딩/디코딩 불일치');
        }
      } catch (utf8Error) {
        console.error(`[PUBLISH] ❌ [인코딩] UTF-8 디코딩 실패:`, utf8Error?.message || utf8Error);
        encodingIssues.push(`UTF-8 디코딩 실패: ${utf8Error?.message || '알 수 없는 오류'}`);
      }
    }

    if (encodingIssues.length > 0) {
      console.warn(`[PUBLISH] ⚠️ [인코딩] 인코딩 문제 ${encodingIssues.length}개 발견:`);
      encodingIssues.forEach((issue, idx) => {
        console.warn(`[PUBLISH]    - ${idx + 1}. ${issue}`);
      });
      onLog?.(`[PUBLISH] ⚠️ 인코딩 문제가 ${encodingIssues.length}개 발견되었습니다.`);
    } else {
      console.log(`[PUBLISH] ✅ [인코딩] 인코딩 검증 통과`);
    }

    // HTML 태그 제거한 실제 텍스트 길이 측정
    const textOnly = body.content ? body.content.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim() : '';
    const textOnlyLength = textOnly.length;

    console.log(`[PUBLISH] 콘텐츠 크기 분석:`);
    console.log(`[PUBLISH]   - 문자열 길이 (문자 수): ${contentLength}자`);
    console.log(`[PUBLISH]   - 바이트 크기: ${contentSizeBytes} bytes (${contentSizeKB}KB)`);
    console.log(`[PUBLISH]   - 실제 텍스트 길이 (HTML 태그 제외): ${textOnlyLength}자`);
    onLog?.(`[PUBLISH] 콘텐츠 크기: ${contentSizeKB}KB (문자열: ${contentLength}자, 실제 텍스트: ${textOnlyLength}자)`);

    // Blogger API 제한: 증가 (500KB - 이미지 Base64 제외 시)
    const MAX_CONTENT_SIZE = 500000; // 500KB
    if (contentSizeBytes > MAX_CONTENT_SIZE) {
      // 🔥 자동 트리밍: 콘텐츠가 너무 크면 자동으로 줄임
      console.log(`[PUBLISH] ⚠️ 콘텐츠 크기 초과 (${contentSizeKB}KB), 자동 트리밍 시도...`);
      onLog?.(`⚠️ 콘텐츠 크기 초과 (${contentSizeKB}KB), 자동 트리밍 중...`);

      // HTML 섹션 기준으로 마지막 섹션부터 제거
      const sections = content.split(/<h[23][^>]*>/gi);
      if (sections.length > 3) {
        // 마지막 2-3개 섹션 제거
        const trimmedSections = sections.slice(0, Math.max(3, sections.length - 2));
        content = trimmedSections.join('');
        const newSize = new TextEncoder().encode(content).length;
        console.log(`[PUBLISH] ✅ 트리밍 완료: ${Math.round(newSize / 1024)}KB`);
        onLog?.(`✅ 자동 트리밍 완료: ${Math.round(newSize / 1024)}KB`);
      }

      // 여전히 크면 에러
      const finalSize = new TextEncoder().encode(content).length;
      if (finalSize > MAX_CONTENT_SIZE) {
        const errorMsg = `콘텐츠 크기가 너무 큽니다: ${Math.round(finalSize / 1024)}KB (제한: ${Math.round(MAX_CONTENT_SIZE / 1024)}KB). 콘텐츠를 줄여주세요.`;
        console.error(`[PUBLISH] ❌ ${errorMsg}`);
        onLog?.(`❌ ${errorMsg}`);
        return {
          ok: false,
          error: errorMsg
        };
      }
    }

    // body 객체의 필수 필드 확인
    if (!body.blog || !body.blog.id) {
      const errorMsg = 'Blog ID가 requestBody에 올바르게 포함되지 않았습니다.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    // labels가 배열인지 확인 (빈 배열은 허용, undefined/null도 허용)
    if (body.labels != null && !Array.isArray(body.labels)) {
      const errorMsg = 'labels가 배열 형식이 아닙니다.';
      onLog?.(`❌ ${errorMsg}`);
      return {
        ok: false,
        error: errorMsg
      };
    }

    try {
      // src/cli.ts의 작동하는 코드와 완전히 동일한 방식으로 API 호출
      // isDraft: draft 모드일 때만 true, 스케줄 모드나 즉시 발행 모드일 때는 false
      const isDraft = isDraftMode && !isScheduleMode;

      // 기존 body 객체를 그대로 사용 (이미 작동하는 코드와 동일한 구조로 구성됨)
      // requestBody 로그 출력 (안전하게 처리)
      try {
        const requestBodyStr = JSON.stringify(body, null, 2);
        console.log(`[PUBLISH] 🔍 실제 전송될 requestBody 전체:`, requestBodyStr.substring(0, 1000) + (requestBodyStr.length > 1000 ? '... (생략)' : ''));
        onLog?.(`[PUBLISH] 🔍 실제 전송될 requestBody 전체 (일부):\n${requestBodyStr.substring(0, 2000)}${requestBodyStr.length > 2000 ? '... (생략)' : ''}`);
      } catch (jsonError) {
        console.error(`[PUBLISH] ⚠️ requestBody JSON 변환 오류:`, jsonError);
        console.log(`[PUBLISH] 🔍 requestBody 키:`, Object.keys(body || {}));
        onLog?.(`[PUBLISH] ⚠️ requestBody JSON 변환 오류: ${jsonError?.message || String(jsonError)}`);
      }
      onLog?.(`[PUBLISH] 🔍 blogId: "${blogId}" (타입: ${typeof blogId})`);
      onLog?.(`[PUBLISH] 🔍 isDraft: ${isDraft} (타입: ${typeof isDraft})`);

      // replies 필드 명시적 제거 (혹시 다른 곳에서 추가되었을 수 있음)
      if (body && body.replies !== undefined) {
        console.log(`[PUBLISH] ⚠️ body 객체에 replies 필드가 발견됨 - 제거합니다`);
        delete body.replies;
      }

      // 최종 body 객체 확인
      const finalBodyKeys = body ? Object.keys(body) : [];
      console.log(`[PUBLISH] 🔍 최종 전송될 body 키: ${finalBodyKeys.join(', ')}`);
      if (finalBodyKeys.includes('replies')) {
        console.error(`[PUBLISH] ❌ 경고: body 객체에 여전히 replies 필드가 있습니다!`);
        delete body.replies;
      }

      // 🔍 최종 body 객체 전체 구조 로깅 (디버깅용)
      console.log(`[PUBLISH] 🔍 최종 body 객체 구조:`);
      console.log(`  - kind: ${body?.kind || '없음'}`);
      console.log(`  - blog.id: ${body?.blog?.id || '없음'} (타입: ${typeof body?.blog?.id})`);
      console.log(`  - title: ${body?.title ? body.title.substring(0, 50) + '...' : '없음'}`);
      console.log(`  - content 길이: ${body?.content?.length || 0}자`);
      console.log(`  - labels: ${body?.labels ? JSON.stringify(body.labels) : '없음'}`);
      console.log(`  - published: ${body?.published || '없음'}`);
      console.log(`  - replies: ${body?.replies !== undefined ? '⚠️ 있음!' : '없음 ✅'}`);

      // 🔍 requestBody 직렬화 테스트 (오류 확인용)
      let requestBodyStr = '직렬화 실패';
      try {
        requestBodyStr = JSON.stringify(body, null, 2);
        console.log(`[PUBLISH] 🔍 requestBody JSON 직렬화 성공 (길이: ${requestBodyStr.length}자)`);
      } catch (jsonError) {
        console.error(`[PUBLISH] ❌ requestBody JSON 직렬화 실패:`, jsonError);
        onLog?.(`[PUBLISH] ❌ requestBody JSON 직렬화 실패: ${jsonError?.message || String(jsonError)}`);
      }

      // 작동하는 코드와 정확히 동일한 API 호출
      // 작동하는 코드: const res = await blogger.posts.insert({ blogId: blogId, isDraft, requestBody: body });

      // 🔥 [긴급 수정] API 호출 전 강제 인라인 스타일 적용 (Blogger vtrick 테마 등 완전 무시)
      // 테마 CSS가 콘텐츠를 숨기는 문제 해결
      if (body.content) {
        console.log('[PUBLISH] 🔥 [긴급] 강제 인라인 스타일 적용 시작 (테마 CSS 무시)');
        onLog?.('[PUBLISH] 🔥 강제 인라인 스타일 적용 중... (테마 호환성 강화)');
        body.content = applyInlineStyles(body.content);
        console.log('[PUBLISH] ✅ [긴급] 강제 인라인 스타일 적용 완료');
      }

      // 🔧 최종 검증: body 객체를 깊은 복사하여 순수한 객체로 만들기
      // 이렇게 하면 숨겨진 속성이나 getter/setter가 제거됨
      const cleanBody = JSON.parse(JSON.stringify(body));

      let response;
      const maxRetries = 3;
      let retryCount = 0;
      let lastError = null;

      while (retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            const delay = Math.min(retryCount * 1000, 3000);
            console.log(`[PUBLISH] [API 재시도] ${delay}ms 후 재시도 중... (시도 ${retryCount + 1}/${maxRetries})`);
            onLog?.(`[PUBLISH] ⚠️ API 호출 재시도 중... (${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          console.log(`[PUBLISH] 🚀 [API 호출] Blogger API 호출 시작${retryCount > 0 ? ` (재시도 ${retryCount})` : ''}`);
          console.log(`[PUBLISH]    - blogId: "${blogId}"`);
          console.log(`[PUBLISH]    - isDraft: ${isDraft}`);
          console.log(`[PUBLISH]    - 제목: "${cleanBody.title}"`);
          console.log(`[PUBLISH]    - 콘텐츠 크기: ${cleanBody.content?.length || 0}자`);
          console.log(`[PUBLISH]    - 라벨 수: ${cleanBody.labels?.length || 0}개`);

          const startTime = Date.now();
          onLog?.('🚀 Blogger API 호출 중...');

          // API 호출 전 최종 콘텐츠 검증
          if (!cleanBody.content || typeof cleanBody.content !== 'string') {
            console.error('[PUBLISH] ❌ requestBody.content가 유효하지 않습니다:', typeof cleanBody.content);
            throw new Error('콘텐츠가 올바르지 않습니다. 다시 시도해주세요.');
          }

          // 콘텐츠 길이 및 기본 검증
          console.log(`[PUBLISH] API 전송 콘텐츠 길이: ${cleanBody.content.length}자`);
          console.log(`[PUBLISH] API 전송 콘텐츠 샘플: ${cleanBody.content.substring(0, 200)}...`);

          // HTML 콘텐츠에서 잠재적 문제 패턴 검출 및 정리
          const contentIssues = [];
          let contentModified = false;

          if (cleanBody.content.includes('Unexpected identifier')) {
            contentIssues.push('JavaScript 파싱 오류 패턴');
            cleanBody.content = cleanBody.content.replace(/Unexpected\s+identifier[^<]*/gi, '');
            contentModified = true;
          }

          if (cleanBody.content.includes('<script')) {
            contentIssues.push('Script 태그');
            cleanBody.content = cleanBody.content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
            contentModified = true;
          }

          if (cleanBody.content.includes('javascript:')) {
            contentIssues.push('JavaScript 프로토콜');
            cleanBody.content = cleanBody.content.replace(/javascript:[^"'\s]*/gi, '');
            contentModified = true;
          }

          if (cleanBody.content.includes('function(')) {
            contentIssues.push('JavaScript 함수');
            cleanBody.content = cleanBody.content.replace(/function\s*\([^)]*\)\s*{[^}]*}/gi, '');
            contentModified = true;
          }

          // 추가적인 JavaScript 패턴 검증 및 제거
          const jsPatterns = [
            { pattern: /var\s+\w+\s*=/gi, name: 'var 선언' },
            { pattern: /let\s+\w+\s*=/gi, name: 'let 선언' },
            { pattern: /const\s+\w+\s*=/gi, name: 'const 선언' },
            { pattern: /if\s*\([^)]*\)\s*{[^}]*}/gi, name: 'if 문' },
            { pattern: /for\s*\([^)]*\)\s*{[^}]*}/gi, name: 'for 문' },
            { pattern: /while\s*\([^)]*\)\s*{[^}]*}/gi, name: 'while 문' },
            { pattern: /console\.\w+\([^)]*\)/gi, name: 'console 문' },
            { pattern: /window\.\w+/gi, name: 'window 참조' },
            { pattern: /document\.\w+/gi, name: 'document 참조' },
            { pattern: /typeof\s+\w+/gi, name: 'typeof 연산자' },
            { pattern: /\bundefined\b/gi, name: 'undefined' },
            { pattern: /\bnull\b/gi, name: 'null' },
            { pattern: /=>/gi, name: '화살표 함수' },
            { pattern: /\|\|/gi, name: 'OR 연산자' },
            { pattern: /&&/gi, name: 'AND 연산자' },
            { pattern: /===/gi, name: '엄격한 동등 연산자' },
            { pattern: /!==/gi, name: '엄격한 부등 연산자' },
            { pattern: />=/gi, name: '크거나 같음 연산자' },
            { pattern: /<=/gi, name: '작거나 같음 연산자' },
            { pattern: /\btrue\b/gi, name: 'true' },
            { pattern: /\bfalse\b/gi, name: 'false' },
            { pattern: /return\s+/gi, name: 'return 문' },
            { pattern: /throw\s+/gi, name: 'throw 문' },
            { pattern: /new\s+\w+/gi, name: 'new 연산자' },
            { pattern: /this\./gi, name: 'this 참조' },
            { pattern: /class\s+\w+/gi, name: 'class 선언' },
            { pattern: /extends\s+\w+/gi, name: 'extends' },
            { pattern: /import\s+/gi, name: 'import 문' },
            { pattern: /export\s+/gi, name: 'export 문' },
            { pattern: /async\s+function/gi, name: 'async function' },
            { pattern: /await\s+/gi, name: 'await' },
            { pattern: /Promise\./gi, name: 'Promise 메서드' },
            { pattern: /catch\s*\([^)]*\)/gi, name: 'catch 블록' }
          ];

          for (const { pattern, name } of jsPatterns) {
            if (pattern.test(cleanBody.content)) {
              contentIssues.push(name);
              cleanBody.content = cleanBody.content.replace(pattern, '');
              contentModified = true;
            }
          }

          if (contentIssues.length > 0) {
            console.warn(`[PUBLISH] ⚠️ 콘텐츠에 문제가 있는 패턴 발견 및 정리:`, contentIssues);
            console.log(`[PUBLISH] 콘텐츠 정리 ${contentModified ? '완료' : '필요 없음'}`);
          }

          // 🔥 [DEBUG] API 호출 전 최종 확인 로그
          console.log(`[PUBLISH] 🚀 Blogger API 호출 직전 최종 상태 확인:`);
          console.log(`[PUBLISH]    - isDraft 파라미터: ${isDraft} (타입: ${typeof isDraft})`);
          console.log(`[PUBLISH]    - requestBody.status: ${cleanBody.status}`);
          console.log(`[PUBLISH]    - requestBody.published: ${cleanBody.published || '없음'}`);
          console.log(`[PUBLISH]    - title: ${cleanBody.title}`);
          onLog?.(`[DEBUG] 발행 요청: isDraft=${isDraft}, status=${cleanBody.status}`);

          response = await blogger.posts.insert({
            blogId: blogId,
            isDraft: isDraft,
            requestBody: cleanBody
          });

          const duration = Date.now() - startTime;
          console.log(`[PUBLISH] ✅ [API 호출] API 호출 성공 (소요 시간: ${duration}ms)`);
          break; // 성공 시 루프 종료

        } catch (apiError) {
          retryCount++;
          lastError = apiError;

          // 에러 정보 추출
          const errorCode = apiError?.code || apiError?.response?.status || 'UNKNOWN';
          const errorMessage = apiError?.message || 'API 호출 실패';

          // JavaScript 파싱 오류 특별 처리
          if (errorMessage.includes('Unexpected identifier') || errorMessage.includes('h2')) {
            console.error('[PUBLISH] ❌ JavaScript 파싱 오류 감지 - 콘텐츠 문제');
            console.error('[PUBLISH] 오류 메시지:', errorMessage);
            console.error('[PUBLISH] 콘텐츠 샘플:', cleanBody.content?.substring(0, 200) + '...');

            // 재시도하지 않고 즉시 실패 반환
            return {
              ok: false,
              error: '콘텐츠에 JavaScript 코드나 잘못된 HTML 구조가 포함되어 있습니다. 콘텐츠 생성을 다시 시도해주세요.'
            };
          }

          const isNetworkError = /ECONNRESET|socket hang up|ETIMEDOUT|ESOCKETTIMEDOUT|EAI_AGAIN|ENETUNREACH|fetch failed|network|connection|timeout/i.test(errorMessage);
          const isRateLimit = /429|rate.*limit|quota|RESOURCE_EXHAUSTED|exceeded.*quota/i.test(errorMessage) || errorCode === 429;

          console.error(`[PUBLISH] ❌ [API 호출] API 호출 실패 (시도 ${retryCount}/${maxRetries}):`);
          console.error(`[PUBLISH]    - 오류 코드: ${errorCode}`);
          console.error(`[PUBLISH]    - 오류 메시지: ${errorMessage}`);
          console.error(`[PUBLISH]    - 네트워크 오류: ${isNetworkError ? '✅' : '❌'}`);
          console.error(`[PUBLISH]    - 할당량 초과: ${isRateLimit ? '✅' : '❌'}`);

          if (apiError?.response?.data) {
            const responseData = typeof apiError.response.data === 'string'
              ? apiError.response.data.substring(0, 300)
              : JSON.stringify(apiError.response.data).substring(0, 300);
            console.error(`[PUBLISH]    - 응답 데이터: ${responseData}`);
          }

          // 재시도 가능한 오류인지 확인
          const shouldRetry = (isNetworkError || isRateLimit) && retryCount < maxRetries;

          if (!shouldRetry) {
            console.error(`[PUBLISH] ❌ [API 호출] 재시도 불가능한 오류이거나 최대 재시도 횟수 초과`);
            if (retryCount >= maxRetries) {
              console.error(`[PUBLISH]    - 최대 재시도 횟수(${maxRetries})에 도달했습니다.`);
            } else {
              console.error(`[PUBLISH]    - 재시도 불가능한 오류 유형입니다.`);
            }
            break;
          }

          if (isRateLimit) {
            const delay = Math.min(retryCount * 2000, 5000);
            console.log(`[PUBLISH] ⚠️ [API 재시도] 할당량 초과로 인한 재시도 (${delay}ms 대기)`);
            onLog?.(`[PUBLISH] ⚠️ API 할당량 초과, ${delay}ms 후 재시도...`);
          } else if (isNetworkError) {
            const delay = Math.min(retryCount * 1000, 3000);
            console.log(`[PUBLISH] ⚠️ [API 재시도] 네트워크 오류로 인한 재시도 (${delay}ms 대기)`);
            onLog?.(`[PUBLISH] ⚠️ 네트워크 오류, ${delay}ms 후 재시도...`);
          }
        }
      }

      // 모든 재시도 실패 시
      if (!response && lastError) {
        const apiError = lastError;
        const finalErrorCode = apiError?.code || apiError?.response?.status || 'UNKNOWN';
        const finalErrorMessage = apiError?.message || 'API 호출 실패';

        console.error(`[PUBLISH] ❌ [API 호출] 최종 실패 - 모든 재시도 소진 (총 ${retryCount}회 시도)`);
        console.error(`[PUBLISH]    - 최종 오류 코드: ${finalErrorCode}`);
        console.error(`[PUBLISH]    - 최종 오류 메시지: ${finalErrorMessage}`);

        if (apiError?.response?.data) {
          const responseData = typeof apiError.response.data === 'string'
            ? apiError.response.data.substring(0, 500)
            : JSON.stringify(apiError.response.data, null, 2).substring(0, 500);
          console.error(`[PUBLISH]    - 최종 응답 데이터: ${responseData}`);
        }

        onLog?.(`[PUBLISH] ❌ API 호출 최종 실패 (${retryCount}회 시도 후)`);

        // googleapis 라이브러리의 에러는 이미 구조화되어 있으므로 그대로 전달
        throw apiError;
      }

      if (response && response.data) {
        // URL 추출 (여러 필드에서 시도)
        let postUrl = response.data.url || response.data.selfLink || null;

        // URL이 없으면 id로부터 구성 시도
        if (!postUrl && response.data.id) {
          // Blogger 포스트 URL 형식: https://blogname.blogspot.com/YYYY/MM/post-id.html
          // 또는: https://blogname.blogspot.com/YYYY/MM/post-id.html
          // blogId로 블로그 정보를 가져와서 URL 구성
          try {
            const blogInfo = await bloggerClient.blogs.get({ blogId: blogIdString });
            if (blogInfo?.data?.url) {
              const postId = response.data.id;
              // 포스트 ID에서 URL 추출 시도
              postUrl = `${blogInfo.data.url.replace(/\/$/, '')}/p/${postId}.html`;
            }
          } catch (e) {
            console.warn('[PUBLISH] 블로그 정보 가져오기 실패, URL 구성 건너뜀:', e);
          }
        }

        const postStatus = response.data.status || 'UNKNOWN';
        const postId = response.data.id;

        console.log(`[PUBLISH] 응답 데이터 status: "${postStatus}"`);
        console.log(`[PUBLISH] 응답 데이터 id: "${postId}"`);
        console.log(`[PUBLISH] 응답 데이터 url: "${postUrl || '없음'}"`);
        console.log(`[PUBLISH] 응답 데이터 전체:`, JSON.stringify({
          id: response.data.id,
          title: response.data.title?.substring(0, 50),
          status: response.data.status,
          url: response.data.url,
          selfLink: response.data.selfLink,
          published: response.data.published,
          updated: response.data.updated
        }, null, 2));

        onLog?.(`✅ Blogger 포스트 발행 성공`);
        onLog?.(`[DEBUG] 응답 status: "${postStatus}"`);
        onLog?.(`[DEBUG] 포스트 ID: "${postId || '없음'}"`);
        onLog?.(`[DEBUG] 포스트 URL: "${postUrl || '없음'}"`);

        // URL이 없어도 발행은 성공한 것으로 간주 (draft 모드일 수 있음)
        return {
          ok: true,
          url: postUrl || undefined,
          postId: postId,
          id: postId, // 호환성을 위해 id도 추가
          title: response.data.title,
          thumbnail: processedThumbnailUrl || '',
          published: response.data.published,
          status: postStatus
        };
      } else {
        throw new Error('Blogger API 응답이 올바르지 않습니다');
      }
    } catch (innerError) {
      // 내부 try-catch에서 발생한 오류를 외부 catch로 전달
      // 에러 객체를 그대로 전달 (JSON 파싱 시도하지 않음)
      throw innerError;
    }
  } catch (error) {
    // 오류 메시지를 안전하게 처리 (JSON 파싱 오류 방지)
    let errorMessage = '알 수 없는 오류';
    let needsAuth = false;

    // 에러 객체를 안전하게 처리 (JSON.stringify 사용하지 않음)
    try {
      // 에러가 문자열인 경우
      if (typeof error === 'string') {
        errorMessage = error;
      }
      // 에러가 객체인 경우
      else if (error && typeof error === 'object') {
        // 1. message 속성이 있는 경우 (일반적인 Error 객체) - 가장 먼저 확인
        if ('message' in error) {
          const msg = error.message;
          if (typeof msg === 'string' && msg.length > 0) {
            errorMessage = msg;
          }
        }

        // 2. code나 status가 있는 경우 (googleapis 에러)
        if ('code' in error && error.code) {
          errorMessage = `API 오류 (코드: ${error.code})`;
        } else if ('status' in error && error.status) {
          errorMessage = `HTTP ${error.status} 오류`;
        }

        // 3. response.data가 있는 경우 (API 에러 응답) - 안전하게 처리
        if ('response' in error && error.response && typeof error.response === 'object') {
          const response = error.response;

          // response.status 확인
          if ('status' in response && response.status) {
            errorMessage = `HTTP ${response.status} 오류`;
          }

          // response.data 처리 (매우 안전하게)
          if ('data' in response && response.data !== null && response.data !== undefined) {
            try {
              // data가 이미 문자열인 경우
              if (typeof response.data === 'string') {
                // JSON 형식인지 확인 (안전하게)
                const trimmed = response.data.trim();
                if (trimmed.length > 0) {
                  // HTML 응답인지 확인 (에러 페이지일 수 있음)
                  if (trimmed.toLowerCase().startsWith('<!doctype') || trimmed.toLowerCase().startsWith('<html')) {
                    errorMessage = 'API가 HTML 응답을 반환했습니다. 인증이 필요할 수 있습니다.';
                    needsAuth = true;
                  } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                      const parsed = JSON.parse(response.data);
                      if (parsed && typeof parsed === 'object') {
                        // parsed.error가 문자열인 경우도 확인
                        if (parsed.error && typeof parsed.error === 'string') {
                          errorMessage = parsed.error;
                          if (parsed.error.toLowerCase().includes('unauthorized') || parsed.error.toLowerCase().includes('auth') || parsed.error.toLowerCase().includes('token') || parsed.error.toLowerCase().includes('invalid_grant')) {
                            needsAuth = true;
                          }
                        } else {
                          const errorObj = parsed.error || parsed;
                          if (errorObj && typeof errorObj === 'object') {
                            errorMessage = errorObj.message || errorObj.reason || errorObj.error_description || 'API 응답 오류';
                            // 에러 코드에 따라 needsAuth 설정
                            if (errorObj.reason === 'authError' || errorObj.error === 'invalid_grant' || errorObj.error === 'unauthorized') {
                              needsAuth = true;
                            }
                            // error_description도 확인
                            if (errorObj.error_description && typeof errorObj.error_description === 'string') {
                              const desc = errorObj.error_description.toLowerCase();
                              if (desc.includes('unauthorized') || desc.includes('auth') || desc.includes('token') || desc.includes('invalid')) {
                                needsAuth = true;
                              }
                            }
                          } else if (typeof errorObj === 'string') {
                            errorMessage = errorObj;
                            // 문자열이 "unauthorized" 또는 "auth" 관련이면 needsAuth 설정
                            if (errorObj.toLowerCase().includes('unauthorized') || errorObj.toLowerCase().includes('auth') || errorObj.toLowerCase().includes('token')) {
                              needsAuth = true;
                            }
                          }
                        }
                      }
                    } catch (parseErr) {
                      // JSON 파싱 실패 - 에러 메시지에서 "Unexpected token"이 포함되어 있으면 특별 처리
                      const parseErrMsg = parseErr?.message || String(parseErr || '');
                      if (parseErrMsg.includes('Unexpected token')) {
                        console.error('[PUBLISH] ❌ response.data JSON 파싱 실패 (Unexpected token):', parseErrMsg);
                        console.error('[PUBLISH] ❌ response.data 내용 (처음 500자):', response.data.substring(0, 500));
                        errorMessage = 'API 응답 파싱 오류가 발생했습니다. 인증이 필요할 수 있습니다.';
                        needsAuth = true;
                      } else {
                        // 다른 파싱 오류
                        errorMessage = response.data.substring(0, 200).replace(/\n/g, ' ');
                      }
                    }
                  } else {
                    // JSON이 아닌 문자열
                    errorMessage = response.data.substring(0, 200).replace(/\n/g, ' ');
                  }
                }
              }
              // data가 객체인 경우 - 직접 접근만 (JSON.stringify 사용하지 않음)
              else if (typeof response.data === 'object') {
                // 직접 속성 접근만 사용
                const errorObj = response.data.error || response.data;
                if (errorObj) {
                  if (typeof errorObj === 'object') {
                    errorMessage = errorObj.message || errorObj.reason || errorObj.error_description || 'API 응답 오류';
                  } else if (typeof errorObj === 'string') {
                    errorMessage = errorObj;
                  }
                }
              }
            } catch (dataErr) {
              // response.data 처리 실패
              errorMessage = 'API 응답 처리 실패';
            }
          }
        }

        // needsAuth 플래그 확인
        if ('needsAuth' in error && error.needsAuth === true) {
          needsAuth = true;
        }
      }
      // 그 외의 경우
      else {
        errorMessage = String(error || '알 수 없는 오류');
      }

      // JSON 파싱 오류 메시지인 경우 특별 처리
      if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON')) {
        // 원본 에러에서 더 자세한 정보 추출 (JSON.stringify 사용하지 않음)
        console.error('[PUBLISH] ❌ JSON 파싱 오류 감지:', errorMessage);
        console.error('[PUBLISH] ❌ 원본 에러 타입:', typeof error);
        console.error('[PUBLISH] ❌ 원본 에러 키:', error && typeof error === 'object' ? Object.keys(error) : 'N/A');

        if (error && typeof error === 'object') {
          // 에러 스택 확인
          if ('stack' in error && typeof error.stack === 'string') {
            console.error('[PUBLISH] ❌ 에러 스택 (처음 500자):', error.stack.substring(0, 500));
          }

          // response.data가 문자열인 경우 내용 확인
          if ('response' in error && error.response && typeof error.response === 'object') {
            if ('data' in error.response && typeof error.response.data === 'string') {
              console.error('[PUBLISH] ❌ response.data (문자열, 처음 500자):', error.response.data.substring(0, 500));
            }
          }

          if ('code' in error) {
            errorMessage = `API 오류 (코드: ${error.code})`;
            if (error.code === 401 || error.code === 403) {
              needsAuth = true;
            }
          } else if ('status' in error) {
            errorMessage = `HTTP ${error.status} 오류`;
            if (error.status === 401 || error.status === 403) {
              needsAuth = true;
            }
          } else if ('response' in error && error.response && typeof error.response === 'object') {
            if ('status' in error.response) {
              errorMessage = `HTTP ${error.response.status} 오류`;
              if (error.response.status === 401 || error.response.status === 403) {
                needsAuth = true;
              }
            } else {
              errorMessage = 'API 응답 파싱 오류가 발생했습니다. 토큰 파일이 손상되었을 수 있습니다. 환경설정에서 인증을 다시 진행해주세요.';
              needsAuth = true; // JSON 파싱 오류는 인증 문제일 가능성이 높음
            }
          } else {
            // 에러 메시지가 "Unexpected token"인 경우, 토큰 파일 문제일 가능성이 높음
            errorMessage = '토큰 파일 파싱 오류가 발생했습니다. 환경설정에서 인증을 다시 진행해주세요.';
            needsAuth = true; // JSON 파싱 오류는 인증 문제일 가능성이 높음
          }
        } else {
          errorMessage = 'JSON 파싱 오류가 발생했습니다. 환경설정에서 인증을 다시 진행해주세요.';
          needsAuth = true;
        }
      }

      // 에러 메시지 길이 제한 (너무 긴 메시지는 잘라냄)
      if (errorMessage.length > 500) {
        errorMessage = errorMessage.substring(0, 500) + '...';
      }
    } catch (e) {
      // 최종 안전망
      errorMessage = '오류 메시지 처리 실패';
      console.error('[PUBLISH] 에러 처리 중 예외 발생:', e);
    }

    console.error('[PUBLISH] ❌ 최종 에러:', errorMessage);

    // Blogger 에러 진단 및 해결
    const diagnosis = diagnoseBloggerError(error, onLog);
    onLog?.(`❌ Blogger 발행 실패: ${errorMessage}`);

    // 긴급 에러인 경우 사용자에게 즉시 조치 안내
    if (diagnosis.urgent) {
      onLog?.('');
      onLog?.('🚨 긴급 조치가 필요합니다!');
      onLog?.(`💡 ${diagnosis.solution}`);
      onLog?.('   환경설정 탭에서 Blogger 인증을 확인해주세요.');
    }

    // blogId가 없으면 payload에서 다시 시도
    if (!blogId && payload && payload.blogId) {
      blogId = String(payload.blogId || '').trim();
    }

    // invalid_grant 오류 확인 (우선 처리)
    const isInvalidGrant =
      errorMessage.toLowerCase().includes('invalid_grant') ||
      errorMessage.toLowerCase().includes('invalid grant') ||
      (error && typeof error === 'object' && 'response' in error && error.response &&
        typeof error.response === 'object' && 'data' in error.response &&
        typeof error.response.data === 'object' &&
        (error.response.data.error === 'invalid_grant' ||
          (error.response.data.error && typeof error.response.data.error === 'object' &&
            error.response.data.error.type === 'invalid_grant')));

    if (isInvalidGrant) {
      onLog?.('');
      onLog?.('⚠️ 토큰이 만료되었습니다. 다음 단계를 따라주세요:');
      onLog?.('   1. 환경설정 탭으로 이동');
      onLog?.('   2. "Blogger OAuth2 인증" 버튼 클릭');
      onLog?.('   3. Google 계정으로 로그인');
      onLog?.('   4. 생성된 코드를 복사하여 입력');
      return {
        ok: false,
        error: '토큰이 만료되었거나 유효하지 않습니다 (invalid_grant). 환경설정에서 "Blogger OAuth2 인증" 버튼을 클릭하여 인증을 다시 진행해주세요.',
        needsAuth: true
      };
    }

    // 인증 오류인 경우
    if (needsAuth || errorMessage.includes('authentication') || errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
      onLog?.('');
      onLog?.('⚠️ 인증이 필요합니다. 다음 단계를 따라주세요:');
      onLog?.('   1. 환경설정 탭에서 Google Client ID/Secret 확인');
      onLog?.('   2. "Blogger OAuth2 인증" 버튼 클릭');
      onLog?.('   3. Google 계정으로 로그인 및 권한 승인');
      return {
        ok: false,
        error: 'Blogger 인증이 필요합니다. Google OAuth2 설정을 확인해주세요.',
        needsAuth: true
      };
    }

    // 권한 오류인 경우
    if (errorMessage.includes('permission') || errorMessage.includes('forbidden') || errorMessage.includes('403')) {
      onLog?.('');
      onLog?.('⚠️ 권한이 부족합니다. 다음 사항을 확인해주세요:');
      onLog?.('   1. Blog ID가 올바른지 확인 (숫자로만 구성)');
      onLog?.('   2. 해당 블로그에 대한 쓰기 권한이 있는지 확인');
      onLog?.('   3. Google 계정이 블로그 소유자 또는 작성자인지 확인');
      return {
        ok: false,
        error: 'Blogger 권한이 부족합니다. 블로그 ID와 권한을 확인해주세요.',
        needsPermission: true
      };
    }

    // API 할당량(quota) 오류 처리
    if (errorMessage.toLowerCase().includes('resource has been exhausted') ||
      errorMessage.toLowerCase().includes('quota') ||
      error?.code === 429 ||
      (error?.response && error.response.status === 429)) {
      const quotaErrorMsg = 'Google Blogger API 일일 할당량을 초과했습니다. 내일 다시 시도하거나 Google Cloud Console에서 할당량을 늘려주세요.';
      onLog?.(`❌ ${quotaErrorMsg}`);
      return {
        ok: false,
        error: quotaErrorMsg,
        quotaExceeded: true
      };
    }

    if (errorMessage.toLowerCase().includes('invalid argument') || error?.status === 400 || error?.code === 400) {
      console.log('[PUBLISH] ❌ 400 에러 (잘못된 요청) 감지');
      onLog?.('');
      onLog?.('⚠️ 잘못된 요청입니다. 다음 사항을 확인해주세요:');

      // error.response.data를 안전하게 추출 (JSON 파싱 오류 방지)
      let errorResponse = {};
      let errorDetails = {};
      let errorErrors = [];
      let detailedError = errorMessage;

      try {
        if (error && typeof error === 'object' && 'response' in error) {
          const response = error.response;
          if (response && typeof response === 'object') {
            // response.data가 문자열인 경우 파싱 시도
            if ('data' in response && response.data !== null && response.data !== undefined) {
              if (typeof response.data === 'string') {
                try {
                  errorResponse = JSON.parse(response.data);
                } catch {
                  errorResponse = { raw: response.data.substring(0, 200) };
                }
              } else if (typeof response.data === 'object') {
                errorResponse = response.data;
              }
            } else {
              errorResponse = response;
            }
          }
        }

        errorDetails = errorResponse.error || errorResponse;
        errorErrors = errorDetails.errors || errorResponse.errors || [];
        detailedError = errorDetails.message || errorDetails.error_description || errorDetails.reason || errorMessage;

        // 안전하게 JSON 변환 시도 (각각 try-catch로 감싸기)
        try {
          console.log(`[PUBLISH] ❌ [DEBUG] errorDetails:`, JSON.stringify(errorDetails, null, 2));
        } catch (e) {
          console.log(`[PUBLISH] ❌ [DEBUG] errorDetails (직접):`, errorDetails);
        }

        try {
          console.log(`[PUBLISH] ❌ [DEBUG] errorResponse:`, JSON.stringify(errorResponse, null, 2));
        } catch (e) {
          console.log(`[PUBLISH] ❌ [DEBUG] errorResponse (직접):`, errorResponse);
        }

        console.log(`[PUBLISH] ❌ [DEBUG] errorErrors 배열 (직접):`, errorErrors);

        try {
          console.log(`[PUBLISH] ❌ [DEBUG] errorErrors 배열 (JSON):`, JSON.stringify(errorErrors, null, 2));
        } catch (e) {
          console.log(`[PUBLISH] ❌ [DEBUG] errorErrors 배열 (문자열):`, String(errorErrors));
        }

        try {
          onLog?.(`[PUBLISH] ❌ [DEBUG] errorDetails:\n${JSON.stringify(errorDetails, null, 2)}`);
        } catch (e) {
          onLog?.(`[PUBLISH] ❌ [DEBUG] errorDetails (직접): ${String(errorDetails)}`);
        }

        try {
          onLog?.(`[PUBLISH] ❌ [DEBUG] errorErrors 배열:\n${JSON.stringify(errorErrors, null, 2)}`);
        } catch (e) {
          onLog?.(`[PUBLISH] ❌ [DEBUG] errorErrors 배열 (직접): ${String(errorErrors)}`);
        }
      } catch (parseError) {
        console.error(`[PUBLISH] ❌ 에러 응답 파싱 실패:`, parseError);
        onLog?.(`[PUBLISH] ❌ 에러 응답 파싱 실패: ${parseError?.message || String(parseError)}`);
      }

      const problematicFields = errorErrors.map((e) => {
        try {
          return {
            domain: e?.domain || '',
            reason: e?.reason || '',
            message: e?.message || '',
            locationType: e?.locationType || '',
            location: e?.location || ''
          };
        } catch {
          return { domain: '', reason: '', message: '', locationType: '', location: '' };
        }
      });

      // 문제가 있는 필드 상세 로그 출력 (안전하게)
      try {
        console.log(`[PUBLISH] ❌ [DEBUG] 문제가 있는 필드:`, problematicFields);
      } catch (e) {
        console.log(`[PUBLISH] ❌ [DEBUG] 문제가 있는 필드 (직접):`, String(problematicFields));
      }

      try {
        onLog?.(`[PUBLISH] ❌ [DEBUG] 문제가 있는 필드:\n${JSON.stringify(problematicFields, null, 2)}`);
      } catch (e) {
        onLog?.(`[PUBLISH] ❌ [DEBUG] 문제가 있는 필드 (직접): ${String(problematicFields)}`);
      }

      const blogIdDisplay = blogId || (payload?.blogId ? String(payload.blogId).trim() : '설정되지 않음');

      // 실제 전송된 데이터 로그 (디버깅용) - JSON.stringify 사용하지 않음
      let requestBodyFullStr = '없음';
      try {
        if (body) {
          // JSON.stringify 대신 간단한 문자열 변환
          requestBodyFullStr = `kind: ${body.kind || '없음'}, blog.id: ${body.blog?.id || '없음'}, title: ${body.title ? body.title.substring(0, 50) : '없음'}`;
        }
      } catch (e) {
        requestBodyFullStr = '직렬화 실패';
      }

      const sentDataInfo = {
        blogId: blogIdDisplay,
        isDraft: isDraftMode || isScheduleMode || false,
        requestBodyKeys: body ? Object.keys(body) : [],
        requestBodyFull: requestBodyFullStr,
        requestBodySample: body ? {
          kind: body.kind,
          blog: body.blog,
          title: body.title ? body.title.substring(0, 50) : '없음',
          contentLength: body.content ? body.content.length : 0,
          contentSizeBytes: body.content ? new TextEncoder().encode(body.content).length : 0,
          hasLabels: !!body.labels,
          labelsCount: body.labels?.length || 0,
          labels: body.labels,
          // replies 필드 제거됨 (Blogger API v3에서 지원하지 않음)
          hasPublished: !!body.published,
          published: body.published
        } : null
      };

      // 에러 로깅 (JSON.stringify 사용하지 않음 - 이것이 문제의 원인!)
      console.error('[PUBLISH] ❌ Invalid Argument 오류 상세:');
      console.error('  message:', errorMessage);
      console.error('  code:', error?.code || '없음');
      console.error('  status:', error?.status || '없음');
      console.error('  blogId:', blogIdDisplay);
      console.error('  requestBodyKeys:', sentDataInfo.requestBodyKeys.join(', ') || '없음');

      // onLog로도 전달 (JSON.stringify 사용하지 않음)
      onLog?.(`❌ [DEBUG] 오류 상세:`);
      onLog?.(`  메시지: ${errorMessage}`);
      onLog?.(`  코드: ${error?.code || '없음'}`);
      onLog?.(`  상태: ${error?.status || '없음'}`);
      onLog?.(`  Blog ID: ${blogIdDisplay}`);
      onLog?.(`  requestBody 키: ${sentDataInfo.requestBodyKeys.join(', ') || '없음'}`);

      if (problematicFields.length > 0) {
        try {
          problematicFields.forEach((field, idx) => {
            onLog?.(`  문제 필드 ${idx + 1}: ${field.domain || ''} - ${field.reason || ''} - ${field.message || ''}`);
          });
        } catch (e) {
          onLog?.(`  문제 필드: 파싱 실패`);
        }
      }

      // 오류 메시지를 안전하게 처리 (JSON 파싱 오류 방지)
      let safeDetailedError = String(detailedError || '알 수 없는 오류');
      try {
        // 에러 메시지 길이 제한 (너무 긴 메시지는 잘라냄)
        if (safeDetailedError.length > 300) {
          safeDetailedError = safeDetailedError.substring(0, 300) + '...';
        }
        // 콜론이나 특수문자로 인한 문제 방지 (제거하지 않고 그대로 사용)
      } catch (e) {
        safeDetailedError = '오류 메시지 처리 실패';
      }

      // 에러 메시지 구성 (안전하게)
      const errorParts = [
        'Blogger 요청에 잘못된 인자가 포함되었습니다.',
        '',
        `오류 상세: ${safeDetailedError}`,
        `오류 코드: ${error?.code || 'N/A'}`,
        `Blog ID: "${blogIdDisplay}"`,
        `전송된 requestBody 필드: ${sentDataInfo.requestBodyKeys.join(', ') || '없음'}`,
        '',
        '환경 설정에서 Blog ID와 다른 설정 값을 다시 확인해주세요.',
        '상세 정보는 콘솔 로그를 확인해주세요.'
      ];

      return {
        ok: false,
        error: errorParts.join('\n'),
        needsAuth: needsAuth
      };
    }

    return {
      ok: false,
      error: errorMessage,
      needsAuth: needsAuth
    };
  }
}

/**
 * Blogger 인증 URL 생성 함수
 */
function getBloggerAuthUrl(payload) {
  try {
    if (!payload) {
      return null;
    }

    const clientId = String(payload.googleClientId || '').trim();

    if (!clientId) {
      return null;
    }

    // 🔥 로컬 서버 기반 OAuth (OOB deprecated 대응)
    // Google Cloud Console에서 "데스크톱 앱" 유형으로 생성하면 loopback IP 자동 허용
    const redirectUri = 'http://127.0.0.1:58392/callback';
    const scope = 'https://www.googleapis.com/auth/blogger';

    // 최신 OAuth2 v2 엔드포인트 사용
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return authUrl;
  } catch (error) {
    console.error('[AUTH] 인증 URL 생성 오류:', error);
    return null;
  }
}

/**
 * Blogger 블로그 정보 가져오기
 */
async function getBloggerInfo(payload, onLog) {
  try {
    if (!payload) {
      return {
        ok: false,
        error: 'payload가 제공되지 않았습니다.'
      };
    }

    const blogId = String(payload.blogId || '').trim();
    const clientId = String(payload.googleClientId || '').trim();
    const clientSecret = String(payload.googleClientSecret || '').trim();

    if (!blogId) {
      return {
        ok: false,
        error: 'Blog ID가 설정되지 않았습니다.'
      };
    }

    if (!clientId || !clientSecret) {
      return {
        ok: false,
        error: 'Google OAuth2 Client ID/Secret이 설정되지 않았습니다.'
      };
    }

    const auth = new GoogleAuth({
      credentials: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: payload.googleRefreshToken || null
      },
      scopes: ['https://www.googleapis.com/auth/blogger']
    });

    const blogger = google.blogger({ version: 'v3', auth });

    onLog?.('📋 Blogger 블로그 정보 조회 중...');

    const response = await blogger.blogs.get({
      blogId: blogId
    });

    if (response.data) {
      return {
        ok: true,
        blog: {
          id: response.data.id,
          name: response.data.name,
          url: response.data.url,
          description: response.data.description
        }
      };
    } else {
      throw new Error('블로그 정보를 가져올 수 없습니다');
    }
  } catch (error) {
    const errorMessage = error?.message || String(error);
    onLog?.(`❌ Blogger 정보 조회 실패: ${errorMessage}`);
    return {
      ok: false,
      error: errorMessage
    };
  }
}

module.exports = {
  publishToBlogger,
  getBloggerAuthUrl,
  getBloggerInfo,
  checkBloggerAuthStatus,
  clearAuthCache
};



