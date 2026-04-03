"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordPressPublisher = void 0;
exports.publishToWordPress = publishToWordPress;
const wordpress_api_1 = require("./wordpress-api");
function wrapSectionsInCards(html) {
    if (!html)
        return html;
    try {
        const headingPattern = /(<h[23][^>]*>)/gi;
        const parts = [];
        let lastIndex = 0;
        let match;
        const headings = [];
        while ((match = headingPattern.exec(html)) !== null) {
            const level = match[0].toLowerCase().startsWith('<h2') ? 2 : 3;
            headings.push({ index: match.index, tag: match[0], level });
        }
        if (headings.length === 0)
            return html;
        const firstHeading = headings[0];
        if (!firstHeading)
            return html;
        const introContent = html.substring(0, firstHeading.index).trim();
        const introWithoutImages = introContent.replace(/<img[^>]*>/gi, '').replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '').trim();
        if (introWithoutImages.length > 0) {
            parts.push(`<div class="wp-intro-card">${introWithoutImages}</div>`);
        }
        for (let i = 0; i < headings.length; i++) {
            const heading = headings[i];
            if (!heading)
                continue;
            const start = heading.index;
            const nextHeading = headings[i + 1];
            const end = nextHeading ? nextHeading.index : html.length;
            const sectionContent = html.substring(start, end).trim();
            const cardClass = heading.level === 3 ? 'wp-section-card wp-card-h3' : 'wp-section-card';
            parts.push(`<div class="${cardClass}">${sectionContent}</div>`);
        }
        return parts.join('\n');
    }
    catch (error) {
        console.warn('[WP-CARD] ⚠️ 카드 래핑 실패, 원본 반환:', error);
        return html;
    }
}
function applyWordPressInlineStyles(html) {
    if (!html)
        return html;
    try {
        html = html
            .replace(/&nbsp;/g, ' ')
            .replace(/☐/g, '');
        html = html
            .replace(/&#9989;/g, '✅')
            .replace(/&#128204;/g, '📌')
            .replace(/&#128640;/g, '🚀')
            .replace(/&#128161;/g, '💡');
        let styledHtml = html;
        styledHtml = styledHtml.replace(/<h2([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            const newStyle = `color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 22px !important; font-weight: 700 !important; margin: 48px 0 20px 0 !important; padding: 16px 20px !important; background: #f0fdfa !important; border-left: 5px solid #0d9488 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 8px 8px 0 !important; line-height: 1.4 !important; letter-spacing: -0.02em !important;`;
            return `<h2${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
        });
        styledHtml = styledHtml.replace(/<h3([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            const newStyle = `color: #1e293b !important; -webkit-text-fill-color: #1e293b !important; font-size: 19px !important; font-weight: 600 !important; margin: 36px 0 16px 0 !important; padding: 12px 16px !important; background: transparent !important; border-left: 4px solid #0891b2 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; line-height: 1.4 !important;`;
            return `<h3${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
        });
        styledHtml = styledHtml.replace(/<h4([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            const newStyle = `color: #334155 !important; font-size: 17px !important; font-weight: 700 !important; margin: 28px 0 12px 0 !important; padding-left: 12px !important; border-left: 3px solid #94a3b8 !important; line-height: 1.4 !important;`;
            return `<h4${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
        });
        styledHtml = styledHtml.replace(/<p([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            const newStyle = `color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 18px !important; line-height: 1.85 !important; margin: 0 0 24px 0 !important; word-break: keep-all !important; letter-spacing: -0.01em !important;`;
            return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
        });
        styledHtml = styledHtml.replace(/<strong([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<strong${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
        });
        styledHtml = styledHtml.replace(/<b([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<b${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
        });
        styledHtml = styledHtml.replace(/<img([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} style="display: block !important; max-width: 100% !important; height: auto !important; margin: 32px auto !important; border-radius: 6px !important;">`;
        });
        styledHtml = styledHtml.replace(/<table([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<table${cleanAttrs ? ' ' + cleanAttrs : ''} style="width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 32px 0 !important; border-radius: 10px !important; overflow: hidden !important; border: 1px solid #e2e8f0 !important;">`;
        });
        styledHtml = styledHtml.replace(/<th([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<th${cleanAttrs ? ' ' + cleanAttrs : ''} style="padding: 14px 16px !important; background: #f1f5f9 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important; text-align: left !important; font-size: 15px !important; border-bottom: 2px solid #e2e8f0 !important;">`;
        });
        styledHtml = styledHtml.replace(/<td([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<td${cleanAttrs ? ' ' + cleanAttrs : ''} style="padding: 12px 16px !important; border-bottom: 1px solid #f1f5f9 !important; color: #334155 !important; font-size: 16px !important; line-height: 1.7 !important;">`;
        });
        styledHtml = styledHtml.replace(/<ul([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<ul${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important;">`;
        });
        styledHtml = styledHtml.replace(/<ol([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<ol${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important;">`;
        });
        styledHtml = styledHtml.replace(/<li([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<li${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 8px 0 !important; line-height: 1.85 !important; font-size: 17px !important; color: #1a1a1a !important;">`;
        });
        styledHtml = styledHtml.replace(/<blockquote([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<blockquote${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 28px 0 !important; padding: 20px 24px !important; background: #f8fafc !important; border-left: 4px solid #94a3b8 !important; border-radius: 0 6px 6px 0 !important; font-style: normal !important; font-size: 17px !important; line-height: 1.85 !important; color: #334155 !important;">`;
        });
        styledHtml = styledHtml.replace(/<a([^>]*)>/gi, (match, attrs) => {
            const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
            return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0891b2 !important; -webkit-text-fill-color: #0891b2 !important; text-decoration: none !important; border-bottom: 1px solid #99f6e4 !important; font-weight: 600 !important;">`;
        });
        styledHtml = wrapSectionsInCards(styledHtml);
        const themeFriendlyCSS = `
<style>
  /* 수익 최적화 WordPress 레이아웃 - Full-Width */
  .wp-styled-content {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 20px 5% !important;
    box-sizing: border-box !important;
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 18px !important;
    line-height: 1.85 !important;
    color: #1a1a1a !important;
    word-break: keep-all !important;
    background: #ffffff !important;
  }
  .wp-styled-content * {
    box-sizing: border-box !important;
  }

  /* 소제목 카드 스타일 */
  .wp-section-card {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 12px !important;
    padding: 28px 32px !important;
    margin: 24px 0 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important;
    position: relative !important;
    overflow: hidden !important;
  }
  /* 카드 상단 컬러바 — 틸 악센트 */
  .wp-section-card::before {
    content: '' !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 3px !important;
    background: linear-gradient(90deg, #0d9488, #0891b2) !important;
    border-radius: 12px 12px 0 0 !important;
  }
  .wp-section-card.wp-card-h3::before {
    background: linear-gradient(90deg, #0891b2, #06b6d4) !important;
  }
  .wp-section-card > h2:first-child,
  .wp-section-card > h3:first-child {
    margin-top: 0.5em !important;
  }
  .wp-section-card > *:last-child {
    margin-bottom: 0 !important;
  }
  .wp-intro-card {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-radius: 12px !important;
    padding: 28px 32px !important;
    margin: 0 0 24px 0 !important;
  }

  /* 모바일 (≤768px) */
  @media screen and (max-width: 768px) {
    .wp-styled-content {
      max-width: 100% !important;
      padding: 0 16px !important;
    }
    .wp-section-card,
    .wp-intro-card {
      padding: 20px 18px !important;
      margin: 16px 0 !important;
      border-radius: 10px !important;
    }
    .wp-styled-content h2 {
      font-size: 19px !important;
      padding: 12px 0 12px 16px !important;
      margin: 36px 0 16px 0 !important;
    }
    .wp-styled-content h3 {
      font-size: 17px !important;
      padding: 10px 0 10px 12px !important;
      margin: 24px 0 12px 0 !important;
    }
    .wp-styled-content p {
      font-size: 16px !important;
      line-height: 1.8 !important;
      margin: 0 0 18px 0 !important;
    }
    .wp-styled-content table {
      display: block !important;
      overflow-x: auto !important;
    }
  }

  /* 소형 화면 (≤375px) */
  @media screen and (max-width: 375px) {
    .wp-styled-content {
      padding: 0 12px !important;
    }
    .wp-styled-content h2 { font-size: 18px !important; }
    .wp-styled-content h3 { font-size: 16px !important; }
    .wp-styled-content p { font-size: 15px !important; line-height: 1.8 !important; }
  }
</style>
`;
        const containerStyle = `max-width: 100% !important; margin: 0 !important; padding: 20px 5% !important; font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; font-size: 18px !important; line-height: 1.85 !important; color: #1a1a1a !important; word-break: keep-all !important;`;
        const wrappedContent = `${themeFriendlyCSS}<div class="wp-styled-content" style="${containerStyle}">${styledHtml}</div>`;
        styledHtml = `<!-- wp:html -->
${wrappedContent}
<!-- /wp:html -->`;
        console.log('[WP-PUBLISH] ✅ 수익 최적화 풀와이드 스킨 적용 (100%/18px/1.85/틸)');
        return styledHtml;
    }
    catch (error) {
        console.warn('[WP-PUBLISH] ⚠️ WordPress 인라인 스타일 적용 실패:', error);
        return html;
    }
}
class WordPressPublisher {
    constructor(config) {
        this.wpApi = new wordpress_api_1.WordPressAPI(config);
    }
    async publish(options) {
        try {
            try {
                const { checkAndIncrement } = require('../utils/usage-quota.js');
                const quota = checkAndIncrement('publish');
                if (!quota.ok) {
                    return { success: false, error: quota.error };
                }
            }
            catch { }
            const stripTagsForCount = (htmlStr) => {
                let text = htmlStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
                text = text.replace(/<[^>]*>/g, '');
                text = text.replace(/\s+/g, ' ').trim();
                return text;
            };
            const textLength = stripTagsForCount(options.content).length;
            const htmlLength = options.content.length;
            const cssMatch = options.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
            const cssLength = cssMatch && cssMatch[1] ? cssMatch[1].length : 0;
            console.log(`[WP-PUBLISH] 텍스트 길이: ${textLength.toLocaleString()}자 (CSS 제외, API 제한 체크용)`);
            console.log(`[WP-PUBLISH] HTML 전체 길이: ${htmlLength.toLocaleString()}자 (CSS 포함)`);
            console.log(`[WP-PUBLISH] CSS 길이: ${cssLength.toLocaleString()}자`);
            const WORDPRESS_TEXT_LIMIT = 50000;
            const WORDPRESS_HTML_LIMIT = 100000;
            if (textLength > WORDPRESS_TEXT_LIMIT) {
                const errorMsg = `⚠️ 순수 텍스트 초과: ${textLength.toLocaleString()}자 (제한: ${WORDPRESS_TEXT_LIMIT.toLocaleString()}자). 본문을 줄여주세요.`;
                console.warn(`[WP-PUBLISH] ${errorMsg}`);
            }
            if (htmlLength > WORDPRESS_HTML_LIMIT) {
                const errorMsg = `⚠️ 전체 HTML 크기 초과: ${htmlLength.toLocaleString()}자 (제한: ${WORDPRESS_HTML_LIMIT.toLocaleString()}자). CSS 압축 또는 본문 축소가 필요합니다.`;
                console.warn(`[WP-PUBLISH] ${errorMsg}`);
                console.warn(`[WP-PUBLISH] CSS 크기: ${cssLength.toLocaleString()}자 (${((cssLength / htmlLength) * 100).toFixed(1)}%)`);
            }
            if (htmlLength > WORDPRESS_HTML_LIMIT * 0.8) {
                const usagePercent = ((htmlLength / WORDPRESS_HTML_LIMIT) * 100).toFixed(1);
                console.warn(`[WP-PUBLISH] ⚠️ 전체 HTML 크기가 제한의 80% 이상입니다. (${usagePercent}% 사용)`);
                console.warn(`[WP-PUBLISH] ⚠️ 현재: 텍스트 ${textLength.toLocaleString()}자, CSS ${cssLength.toLocaleString()}자, 전체 ${htmlLength.toLocaleString()}자`);
            }
            const textUsagePercent = ((textLength / WORDPRESS_TEXT_LIMIT) * 100).toFixed(1);
            const htmlUsagePercent = ((htmlLength / WORDPRESS_HTML_LIMIT) * 100).toFixed(1);
            console.log(`[WP-PUBLISH] 크기 정보: 텍스트 ${textUsagePercent}% 사용, 전체 HTML ${htmlUsagePercent}% 사용`);
            let optimizedContent = options.content;
            const hasStyleTag = options.content.includes('<style');
            const styleTagCount = (options.content.match(/<style[^>]*>/gi) || []).length;
            const hasMaxModeArticle = options.content.includes('max-mode-article') || options.content.includes('premium-article');
            const hasImportantRules = options.content.match(/!\s*important/gi)?.length || 0;
            const cssSize = cssLength;
            console.log(`[WP-PUBLISH] 🔍 [CSS 검증 시작]`);
            console.log(`[WP-PUBLISH]    - Style 태그 존재: ${hasStyleTag ? '✅' : '❌'}`);
            console.log(`[WP-PUBLISH]    - Style 태그 개수: ${styleTagCount}개`);
            console.log(`[WP-PUBLISH]    - max-mode-article 클래스: ${hasMaxModeArticle ? '✅' : '❌'}`);
            console.log(`[WP-PUBLISH]    - !important 규칙: ${hasImportantRules}개`);
            console.log(`[WP-PUBLISH]    - CSS 크기: ${cssSize.toLocaleString()}자`);
            console.log(`[WP-PUBLISH] 🎨 금색 프리미엄 스킨 + 모바일 최적화 적용 중...`);
            optimizedContent = applyWordPressInlineStyles(options.content);
            console.log(`[WP-PUBLISH] ✅ 블로거와 동일한 금색 프리미엄 스킨 적용 완료`);
            console.log('[WP-PUBLISH] 워드프레스 연결 테스트 시작...');
            const isConnected = await this.wpApi.testConnection();
            if (!isConnected) {
                const config = this.wpApi;
                console.error('[WP-PUBLISH] ❌ 연결 실패:', {
                    siteUrl: config.config?.siteUrl || '알 수 없음',
                    hasUsername: !!config.config?.username,
                    hasPassword: !!config.config?.password,
                    hasJwtToken: !!config.config?.jwtToken
                });
                return {
                    success: false,
                    error: '워드프레스 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.\n\n확인 사항:\n1. 워드프레스 사이트 URL이 올바른지 확인\n2. 사용자명과 비밀번호가 정확한지 확인\n3. 워드프레스 REST API가 활성화되어 있는지 확인\n4. 방화벽이나 보안 플러그인이 API 접근을 차단하지 않는지 확인'
                };
            }
            console.log('[WP-PUBLISH] ✅ 연결 성공');
            if (cssLength > 0) {
                console.log(`[WP-PUBLISH] ✅ CSS 발견됨 (${cssLength.toLocaleString()}자) - WordPress 핵 옵션 적용`);
                const wordpressNuclearCSS = `
          /* ========================================
             WORDPRESS 핵 옵션 - 테마/플러그인 CSS 극복
             ======================================== */

          /* 핵 옵션 1: WordPress 컨테이너 완전 오버라이드 */
          .wp-block-post-content .max-mode-article,
          .entry-content .max-mode-article,
          .post-content .max-mode-article,
          .content-area .max-mode-article,
          article .max-mode-article,
          .wp-site-blocks .max-mode-article,
          .wp-block-group .max-mode-article,
          /* Gutenberg 블록 오버라이드 */
          .wp-block-columns .max-mode-article,
          .wp-block-media-text .max-mode-article,
          /* 테마별 컨테이너 오버라이드 */
          .site-content .max-mode-article,
          .main-content .max-mode-article,
          .primary .max-mode-article {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 0px 72px 0px !important;
            box-sizing: border-box !important;
            display: block !important;
            text-align: left !important;
            overflow: visible !important;
            /* WordPress 테마 극복 */
            position: relative !important;
            float: none !important;
            clear: both !important;
          }

          /* 핵 옵션 2: WordPress 텍스트 요소 강제 적용 */
          .wp-block-post-content .max-mode-article h1,
          .wp-block-post-content .max-mode-article h2,
          .wp-block-post-content .max-mode-article h3,
          .wp-block-post-content .max-mode-article h4,
          .wp-block-post-content .max-mode-article h5,
          .wp-block-post-content .max-mode-article h6,
          .wp-block-post-content .max-mode-article p,
          .wp-block-post-content .max-mode-article span,
          .wp-block-post-content .max-mode-article div,
          .wp-block-post-content .max-mode-article li,
          .entry-content .max-mode-article h1,
          .entry-content .max-mode-article h2,
          .entry-content .max-mode-article h3,
          .entry-content .max-mode-article h4,
          .entry-content .max-mode-article h5,
          .entry-content .max-mode-article h6,
          .entry-content .max-mode-article p,
          .entry-content .max-mode-article span,
          .entry-content .max-mode-article div,
          .entry-content .max-mode-article li,
          .post-content .max-mode-article h1,
          .post-content .max-mode-article h2,
          .post-content .max-mode-article h3,
          .post-content .max-mode-article h4,
          .post-content .max-mode-article h5,
          .post-content .max-mode-article h6,
          .post-content .max-mode-article p,
          .post-content .max-mode-article span,
          .post-content .max-mode-article div,
          .post-content .max-mode-article li {
            /* WordPress 텍스트 핵 */
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            color: inherit !important;
            font-family: inherit !important;
            line-height: 1.6 !important;
            margin: inherit !important;
            padding: inherit !important;
            font-size: inherit !important;
            font-weight: inherit !important;
            text-align: inherit !important;
            /* WordPress 테마 극복 */
            -webkit-text-size-adjust: 100% !important;
            -ms-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
          }

          /* 핵 옵션 3: Gutenberg 블록 CSS 오버라이드 */
          .wp-block-group.has-background .max-mode-article,
          .wp-block-cover .max-mode-article,
          .wp-block-media-text .max-mode-article {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 핵 옵션 4: WordPress 플러그인 CSS 극복 */
          .max-mode-article[class*="wp-block"],
          .max-mode-article[class*="elementor"],
          .max-mode-article[class*="vc_"],
          .max-mode-article[class*="av_"] {
            all: revert !important;
            margin: 0 auto !important;
            padding: 0 0px 72px 0px !important;
            max-width: 100% !important;
          }
        `;
                optimizedContent = optimizedContent.replace(/(<style[^>]*>[\s\S]*?<\/style>)/i, (match) => {
                    const nuclearCSS = wordpressNuclearCSS.replace(/^\s+|\s+$/gm, '');
                    return match.replace('</style>', '\n' + nuclearCSS + '\n</style>');
                });
                console.log(`[WP-PUBLISH] 🛡️ WordPress 핵 옵션 적용 완료`);
            }
            else {
                console.log(`[WP-PUBLISH] ⚠️ CSS가 없음 - 기본 텍스트 서식만 적용될 수 있음`);
            }
            let featuredMediaId;
            if (options.featuredImageUrl) {
                console.log(`[WP-PUBLISH] 🖼️ 대표 이미지 업로드 시도: ${options.featuredImageUrl.substring(0, 50)}...`);
                try {
                    const response = await fetch(options.featuredImageUrl);
                    if (!response.ok)
                        throw new Error(`이미지 다운로드 실패: ${response.status}`);
                    const imageBuffer = await response.arrayBuffer();
                    const uploadedMedia = await this.wpApi.uploadMedia(imageBuffer, `${Date.now()}-thumbnail.jpg`, options.title);
                    if (uploadedMedia && uploadedMedia.id) {
                        featuredMediaId = uploadedMedia.id;
                        console.log(`[WP-PUBLISH] ✅ 대표 이미지 업로드 성공 (Media ID: ${featuredMediaId})`);
                    }
                }
                catch (mediaError) {
                    console.error(`[WP-PUBLISH] ❌ 대표 이미지 업로드 실패:`, mediaError.message);
                }
            }
            const finalStatus = options.status === 'draft' ? 'draft' : 'publish';
            console.log(`[WP-PUBLISH] 발행 상태: ${options.status} → ${finalStatus}`);
            const postData = {
                title: options.title,
                content: optimizedContent,
                excerpt: options.excerpt || this.extractExcerpt(options.content),
                status: finalStatus
            };
            if (options.scheduleDate) {
                const sDate = new Date(options.scheduleDate);
                if (!isNaN(sDate.getTime())) {
                    postData.date = sDate.toISOString();
                    console.log(`[WP-PUBLISH] 📅 예약 발행 설정: ${postData.date}`);
                }
            }
            if (featuredMediaId) {
                postData.featured_media = featuredMediaId;
            }
            const cleanTitle = options.title
                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}📌✅🔥💡🚀📊🎯⚡❤️🔍📷🔗🎁💰📅]/gu, '')
                .replace(/\s{2,}/g, ' ')
                .trim() || options.title;
            console.log(`[WP-PUBLISH] 📝 원본 제목: ${options.title}`);
            console.log(`[WP-PUBLISH] 📝 클린 제목: ${cleanTitle}`);
            let tagIds = [];
            try {
                const generatedTags = await this.generateTagsSmart(cleanTitle, options.content, options.geminiKey);
                if (generatedTags.length > 0) {
                    tagIds = await this.resolveTags(generatedTags);
                    console.log(`[WP-PUBLISH] 🏷️ 태그 자동 생성 완료: ${generatedTags.join(', ')} (${tagIds.length}개 등록)`);
                }
            }
            catch (tagErr) {
                console.warn('[WP-PUBLISH] ⚠️ 태그 자동 생성 실패:', tagErr);
            }
            if (tagIds.length > 0) {
                postData.tags = tagIds;
            }
            postData.title = cleanTitle;
            const createdPost = await this.wpApi.createPost(postData);
            if (createdPost.id) {
                const focusKeyword = await this.extractFocusKeywordSmart(cleanTitle, options.content, options.geminiKey);
                const metaDesc = options.metaDescription || await this.generateMetaDescriptionSmart(options.content, options.geminiKey);
                const seoResult = await this.wpApi.updateSeoMeta(createdPost.id, {
                    title: cleanTitle,
                    description: metaDesc,
                    focusKeyword: focusKeyword
                });
                if (seoResult.success) {
                    console.log(`[SEO] ✅ 포스트 ${createdPost.id} Yoast SEO 필드 자동 입력 완료 (키워드: ${focusKeyword}, 메타설명: ${metaDesc.substring(0, 50)}...)`);
                }
            }
            const result = {
                success: true,
                url: `${this.wpApi['config'].siteUrl}/wp-admin/post.php?post=${createdPost.id}&action=edit`
            };
            if (createdPost.id) {
                result.postId = Number(createdPost.id);
            }
            return result;
        }
        catch (error) {
            console.error('워드프레스 포스트 발행 실패:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }
    async publishPost(_options) {
        try {
            const isConnected = await this.wpApi.testConnection();
            if (!isConnected) {
                return {
                    success: false,
                    error: '워드프레스 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.'
                };
            }
            return {
                success: false,
                error: '이 함수는 더 이상 사용되지 않습니다. runPost를 사용하세요.'
            };
        }
        catch (error) {
            console.error('워드프레스 포스트 발행 실패:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
            };
        }
    }
    async resolveCategories(categoryNames) {
        if (categoryNames.length === 0)
            return [];
        const existingCategories = await this.wpApi.getCategories();
        const categoryIds = [];
        for (const categoryName of categoryNames) {
            let category = existingCategories.find(cat => cat.name.toLowerCase() === categoryName.toLowerCase());
            if (!category) {
                try {
                    category = await this.wpApi.createCategory(categoryName);
                }
                catch (error) {
                    console.warn(`카테고리 "${categoryName}" 생성 실패:`, error);
                    continue;
                }
            }
            if (category) {
                categoryIds.push(category.id);
            }
        }
        return categoryIds;
    }
    async resolveTags(tagNames) {
        if (tagNames.length === 0)
            return [];
        const existingTags = await this.wpApi.getTags();
        const tagIds = [];
        for (const tagName of tagNames) {
            let tag = existingTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
            if (!tag) {
                try {
                    tag = await this.wpApi.createTag(tagName);
                }
                catch (error) {
                    console.warn(`태그 "${tagName}" 생성 실패:`, error);
                    continue;
                }
            }
            if (tag) {
                tagIds.push(tag.id);
            }
        }
        return tagIds;
    }
    extractExcerpt(content, maxLength = 160) {
        const textContent = content.replace(/<[^>]*>/g, '');
        const cleanText = textContent.replace(/\s+/g, ' ').trim();
        if (cleanText.length <= maxLength) {
            return cleanText;
        }
        return cleanText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
    }
    async downloadImage(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`이미지 다운로드 실패: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return arrayBuffer;
        }
        catch (error) {
            throw new Error(`이미지 다운로드 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        }
    }
    async publishBatch(posts) {
        const results = [];
        for (let i = 0; i < posts.length; i++) {
            console.log(`포스트 ${i + 1}/${posts.length} 발행 중...`);
            try {
                const post = posts[i];
                if (!post) {
                    results.push({
                        success: false,
                        error: `포스트 ${i + 1} 정보가 없습니다.`
                    });
                    continue;
                }
                const result = await this.publishPost(post);
                results.push(result);
                if (i < posts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            catch (error) {
                results.push({
                    success: false,
                    error: `포스트 ${i + 1} 발행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
                });
            }
        }
        return results;
    }
    async extractFocusKeywordSmart(title, content, apiKey) {
        if (!apiKey || apiKey.length < 10) {
            return this.extractFocusKeywordFallback(title);
        }
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const currentYear = new Date().getFullYear();
            const nextYear = currentYear + 1;
            const prompt = `당신은 한국어 SEO 전문가입니다. 다음 블로그 제목과 본문에서 Yoast SEO '초점 키프레이즈(Focus Keyphrase)'를 추출하세요.

제목: ${title}
본문 요약: ${content.replace(/<[^>]*>/g, '').substring(0, 300)}

🔴 핵심 원칙:
1. 사용자가 Google/네이버에서 실제로 검색할 법한 키워드여야 합니다.
2. 2~4단어의 자연스러운 검색 구문이어야 합니다. (1단어 금지)
3. 장식어(BEST, TOP, 🔥 등), 연도, 숫자 수식은 제외합니다.
4. 제목의 핵심 주제를 정확히 반영해야 합니다.
5. 반드시 결과만 한 줄로 출력하세요.

🟢 좋은 예시:
- "${nextYear}년 노령연금 수급 자격 총정리" → "노령연금 수급 자격"
- "직장인 연말정산 꿀팁 BEST 7" → "직장인 연말정산"
- "무릎 관절 통증 원인과 치료법" → "무릎 관절 통증"

🔴 나쁜 예시 (이렇게 하지 마세요):
- "연금" (너무 짧음)
- "${nextYear}년 노령연금" (연도 포함)
- "BEST 7 꿀팁" (수식어만 추출)`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().replace(/["']/g, '');
        }
        catch (err) {
            console.warn('[SEO] AI 키워드 추출 실패, 폴백 사용:', err);
            return this.extractFocusKeywordFallback(title);
        }
    }
    async generateTagsSmart(title, content, apiKey) {
        const fallbackTags = this.extractTagsFallback(title);
        if (!apiKey || apiKey.length < 10) {
            return fallbackTags;
        }
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const plainText = content.replace(/<[^>]*>/g, '').substring(0, 800);
            const prompt = `다음 블로그 글의 제목과 본문을 분석하여 WordPress 태그를 생성하세요.

제목: ${title}
본문 일부: ${plainText}

🔴 필수 규칙:
1. 5~8개의 태그를 쉼표로 구분하여 출력하세요.
2. # 기호를 절대 붙이지 마세요.
3. 각 태그는 1~3단어의 자연스러운 키워드여야 합니다.
4. 사용자가 실제 검색할 법한 키워드만 포함하세요.
5. 본문의 주제, 카테고리, 관련 키워드를 포함하세요.
6. 결과만 한 줄로 출력하세요.

좋은 예시:
"노령연금, 국민연금, 수급 자격, 연금 신청, 노후 준비, 복지 혜택, 연금 계산"
"연말정산, 소득공제, 세액공제, 직장인 절세, 의료비 공제, 교육비 공제"`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();
            const tags = text
                .replace(/^["']|["']$/g, '')
                .split(',')
                .map((t) => t.trim().replace(/^#/, '').replace(/["']/g, '').trim())
                .filter((t) => t.length > 0 && t.length <= 20);
            if (tags.length >= 3) {
                console.log(`[WP-TAGS] ✅ AI 태그 생성: ${tags.join(', ')}`);
                return tags;
            }
            return fallbackTags;
        }
        catch (err) {
            console.warn('[WP-TAGS] ⚠️ AI 태그 생성 실패, 폴백 사용:', err);
            return fallbackTags;
        }
    }
    extractTagsFallback(title) {
        if (!title)
            return [];
        const clean = title
            .replace(/[!?|,.\-\[\](){}'"]/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        const words = clean.split(' ').filter(w => w.length >= 2);
        return words.slice(0, 8);
    }
    extractFocusKeywordFallback(title) {
        if (!title)
            return '블로그 포스트';
        const clean = title.split('!')[0] || title;
        const clean2 = clean.split('?')[0] || clean;
        const clean3 = clean2.split('|')[0] || clean2;
        const clean4 = clean3.split('-')[0] || clean3;
        return clean4.trim().substring(0, 30);
    }
    async generateMetaDescriptionSmart(content, apiKey) {
        const plainText = content.replace(/<[^>]*>/g, '').substring(0, 1000);
        if (!apiKey || apiKey.length < 10) {
            return plainText.substring(0, 155).trim();
        }
        try {
            const { GoogleGenerativeAI } = require('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = `당신은 Google SERP CTR 전문가입니다. 다음 블로그 본문을 바탕으로 검색 결과에서 클릭률을 극대화하는 '메타 설명(Meta Description)'을 작성하세요.

본문 일부: ${plainText}

🔴 필수 조건:
1. 정확히 140~155자 (공백 포함). 이 범위를 벗어나면 실패입니다.
2. 첫 문장에서 핵심 정보를 즉시 전달하세요 (두괄식).
3. 구체적인 숫자, 날짜, 금액을 포함하세요 (예: "최대 300만원", "3가지 방법").
4. 마지막에 행동 유도 문구를 넣으세요 (예: "지금 확인하세요", "놓치지 마세요").
5. 이모지, 특수문자, 따옴표 금지.
6. 결과만 한 줄로 출력하세요.

🟢 좋은 예시:
"2026년 노령연금 수급 자격과 신청 방법을 한눈에 정리했습니다. 월 최대 32만원까지 받을 수 있는 조건과 필요 서류를 지금 바로 확인하세요."
"직장인 연말정산 환급금을 최대로 늘릴 수 있는 7가지 공제 항목을 전문 세무사가 쉽게 설명합니다. 놓치면 손해보는 핵심 정보를 확인하세요."`;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text().trim().replace(/["']/g, '');
        }
        catch (err) {
            return plainText.substring(0, 155).trim();
        }
    }
    generateMetaDescriptionFallback(content, limit = 155) {
        try {
            let cleanContent = content
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const combinedSentence = cleanContent.replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?');
            const sentences = combinedSentence.split(/[.!?]/);
            for (const sentence of sentences) {
                if (sentence.trim().length >= 20 && sentence.trim().length <= limit) {
                    return sentence.trim();
                }
            }
            let description = cleanContent.substring(0, limit).trim();
            const lastSpaceIndex = description.lastIndexOf(' ');
            if (lastSpaceIndex > limit * 0.8) {
                description = description.substring(0, lastSpaceIndex);
            }
            return description + '...';
        }
        catch (error) {
            console.error('메타 설명 생성 실패:', error);
            return content.substring(0, 100);
        }
    }
}
exports.WordPressPublisher = WordPressPublisher;
async function publishToWordPress(options, onLog) {
    try {
        onLog?.('[WP] WordPress 발행 시작...');
        const wpApi = new wordpress_api_1.WordPressAPI({
            siteUrl: options.siteUrl,
            username: options.username,
            password: options.password
        });
        onLog?.('[WP] WordPress 연결 확인 중...');
        const isConnected = await wpApi.testConnection();
        if (!isConnected) {
            throw new Error('WordPress 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.');
        }
        onLog?.('✅ WordPress 연결 확인 완료');
        console.log(`[WP-PUBLISH] 받은 status: "${options.status}"`);
        let postStatus = options.status === 'schedule' ? 'future' : (options.status === 'draft' ? 'draft' : 'publish');
        console.log(`[WP-PUBLISH] 최종 postStatus: "${postStatus}"`);
        let postDate;
        if (options.status === 'schedule' && options.scheduleDate) {
            const scheduleDate = typeof options.scheduleDate === 'string' ? new Date(options.scheduleDate) : options.scheduleDate;
            if (!isNaN(scheduleDate.getTime())) {
                postDate = scheduleDate.toISOString();
                onLog?.(`📅 예약 발행 시간: ${scheduleDate.toLocaleString('ko-KR')}`);
            }
            else {
                onLog?.('⚠️ 예약 시간이 유효하지 않습니다. 즉시 발행합니다.');
                postStatus = 'publish';
            }
        }
        let featuredMediaId;
        let uploadedThumbnailUrl;
        if (options.thumbnailUrl) {
            try {
                onLog?.('[WP] 썸네일 업로드 중...');
                if (options.thumbnailUrl.startsWith('data:image')) {
                    const base64Match = options.thumbnailUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
                    if (base64Match && base64Match[2]) {
                        const imageType = base64Match[1] || 'png';
                        const base64Data = base64Match[2];
                        let arrayBuffer;
                        if (typeof Buffer !== 'undefined') {
                            const buffer = Buffer.from(base64Data, 'base64');
                            arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                        }
                        else {
                            const binaryString = atob(base64Data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            arrayBuffer = bytes.buffer;
                        }
                        const filename = `thumbnail-${Date.now()}.${imageType}`;
                        console.log(`[WP-THUMBNAIL] 썸네일 업로드 시작: ${filename}`);
                        const uploadedMedia = await wpApi.uploadMedia(arrayBuffer, filename, options.title);
                        if (uploadedMedia && uploadedMedia.id) {
                            featuredMediaId = uploadedMedia.id;
                            uploadedThumbnailUrl = uploadedMedia.source_url;
                            console.log(`[WP-THUMBNAIL] ✅ 썸네일 업로드 성공: ID ${featuredMediaId}, URL: ${uploadedThumbnailUrl}`);
                            onLog?.(`✅ 썸네일 업로드 완료 (ID: ${featuredMediaId})`);
                        }
                        else {
                            console.warn(`[WP-THUMBNAIL] ⚠️ 썸네일 업로드 응답에 ID가 없음:`, uploadedMedia);
                            onLog?.(`⚠️ 썸네일 업로드 응답에 ID가 없습니다`);
                        }
                    }
                    else {
                        console.warn(`[WP-THUMBNAIL] ⚠️ data:image URL 파싱 실패`);
                        onLog?.(`⚠️ 썸네일 URL 형식이 올바르지 않습니다`);
                    }
                }
                else {
                    try {
                        console.log(`[WP-THUMBNAIL] 외부 URL 썸네일 다운로드 시작: ${options.thumbnailUrl.substring(0, 100)}`);
                        const imageResponse = await fetch(options.thumbnailUrl);
                        if (imageResponse.ok) {
                            console.log(`[WP-THUMBNAIL] 다운로드 성공, 업로드 중...`);
                            const imageBlob = await imageResponse.blob();
                            const arrayBuffer = await imageBlob.arrayBuffer();
                            const urlPath = new URL(options.thumbnailUrl).pathname;
                            const extension = urlPath.split('.').pop() || 'jpg';
                            const filename = `thumbnail-${Date.now()}.${extension}`;
                            const uploadedMedia = await wpApi.uploadMedia(arrayBuffer, filename, options.title);
                            if (uploadedMedia && uploadedMedia.id) {
                                featuredMediaId = uploadedMedia.id;
                                uploadedThumbnailUrl = uploadedMedia.source_url;
                                console.log(`[WP-THUMBNAIL] ✅ 외부 URL 썸네일 업로드 성공: ID ${featuredMediaId}`);
                                onLog?.(`✅ 썸네일 업로드 완료 (ID: ${featuredMediaId})`);
                            }
                            else {
                                console.warn(`[WP-THUMBNAIL] ⚠️ 업로드 응답에 ID가 없음`);
                                onLog?.(`⚠️ 썸네일 업로드 응답에 ID가 없습니다`);
                            }
                        }
                        else {
                            console.error(`[WP-THUMBNAIL] ❌ 외부 URL 다운로드 실패: ${imageResponse.status}`);
                            onLog?.(`⚠️ 외부 썸네일 다운로드 실패: HTTP ${imageResponse.status}`);
                        }
                    }
                    catch (fetchError) {
                        console.error(`[WP-THUMBNAIL] ❌ 외부 URL 처리 오류:`, fetchError);
                        onLog?.(`⚠️ 외부 썸네일 다운로드 실패: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
                    }
                }
            }
            catch (thumbnailError) {
                onLog?.(`⚠️ 썸네일 업로드 실패: ${thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError)}`);
            }
        }
        let tagIds = [];
        if (options.tags && options.tags.length > 0) {
            try {
                onLog?.('[WP] 태그 처리 중...');
                const existingTags = await wpApi.getTags();
                const tagNameToId = new Map();
                existingTags.forEach(tag => {
                    tagNameToId.set(tag.name.toLowerCase(), tag.id);
                });
                for (const tagName of options.tags) {
                    const normalizedName = tagName.trim().replace(/^#/, '');
                    if (!normalizedName)
                        continue;
                    const lowerName = normalizedName.toLowerCase();
                    if (tagNameToId.has(lowerName)) {
                        tagIds.push(tagNameToId.get(lowerName));
                    }
                    else {
                        try {
                            const newTag = await wpApi.createTag(normalizedName);
                            if (newTag && newTag.id) {
                                tagIds.push(newTag.id);
                                tagNameToId.set(lowerName, newTag.id);
                                onLog?.(`✅ 태그 생성: ${normalizedName}`);
                            }
                        }
                        catch (tagError) {
                            onLog?.(`⚠️ 태그 생성 실패 (${normalizedName}): ${tagError instanceof Error ? tagError.message : String(tagError)}`);
                        }
                    }
                }
                if (tagIds.length > 0) {
                    onLog?.(`✅ 태그 설정 완료 (${tagIds.length}개)`);
                }
            }
            catch (tagError) {
                onLog?.(`⚠️ 태그 처리 실패: ${tagError instanceof Error ? tagError.message : String(tagError)}`);
            }
        }
        let contentToStyle = options.content;
        onLog?.('[WP] WordPress 스킨 적용 중...');
        const styledContent = applyWordPressInlineStyles(contentToStyle);
        onLog?.('✅ WordPress 클린 모던 스킨 적용 완료');
        onLog?.('[WP] 포스트 생성 중...');
        const postData = {
            title: options.title,
            content: styledContent,
            status: postStatus,
            categories: options.categories || [],
            tags: tagIds
        };
        console.log(`[WP-PUBLISH] 📦 생성된 PostData Status: "${postData.status}"`);
        console.log(`[WP-PUBLISH]    - 원본 options.status: "${options.status}"`);
        console.log(`[WP-PUBLISH]    - 계산된 postStatus: "${postStatus}"`);
        if (featuredMediaId) {
            postData.featured_media = featuredMediaId;
            console.log(`[WP-PUBLISH] ✅ Featured Media 설정: ID ${featuredMediaId}`);
            onLog?.(`✅ 썸네일 설정 완료 (Featured Media ID: ${featuredMediaId})`);
        }
        else if (options.thumbnailUrl) {
            console.warn(`[WP-PUBLISH] ⚠️ 썸네일 URL은 있지만 Featured Media ID가 없음 (업로드 실패 가능성)`);
            onLog?.(`⚠️ 썸네일 업로드에 실패하여 포스트에 썸네일이 설정되지 않았습니다`);
        }
        else {
            console.log(`[WP-PUBLISH] 썸네일 URL이 제공되지 않음`);
        }
        if (postDate) {
            postData.date = postDate;
        }
        const post = await wpApi.createPost(postData);
        if (post && post.id) {
            const postUrl = `${options.siteUrl}/wp-admin/post.php?post=${post.id}&action=edit`;
            onLog?.(`✅ WordPress 포스트 생성 완료: ${postUrl}`);
            if (options.focusKeyword || options.metaDescription) {
                try {
                    onLog?.('[WP] Yoast SEO 필드 설정 중...');
                    const publisher = new WordPressPublisher({
                        siteUrl: options.siteUrl,
                        username: options.username,
                        password: options.password
                    });
                    const extractFocusKeyword = publisher.extractFocusKeyword?.bind(publisher);
                    const generateMetaDescription = publisher.generateMetaDescription?.bind(publisher);
                    const getFocusKeyword = extractFocusKeyword
                        ? (title) => extractFocusKeyword(title, '')
                        : (title) => {
                            const words = title
                                .replace(/[0-9년월일]/g, ' ')
                                .replace(/[^\w가-힣\s]/g, ' ')
                                .split(/\s+/)
                                .filter(w => w.length > 1);
                            if (words.length === 0)
                                return title.substring(0, 50);
                            const longestWord = words.reduce((a, b) => a.length > b.length ? a : b);
                            return longestWord.length > 2 ? longestWord : words[0] || title.substring(0, 50);
                        };
                    const getMetaDescription = generateMetaDescription
                        ? (content) => generateMetaDescription(content, 155)
                        : (content) => {
                            const text = content
                                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                                .replace(/<[^>]*>/g, ' ')
                                .replace(/\s+/g, ' ')
                                .trim();
                            if (text.length <= 155)
                                return text;
                            const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
                            let description = '';
                            for (const sentence of sentences) {
                                if ((description + sentence).length <= 155) {
                                    description += sentence;
                                }
                                else {
                                    break;
                                }
                            }
                            return description || text.substring(0, 152) + '...';
                        };
                    const finalFocusKeyword = options.focusKeyword || getFocusKeyword(options.title);
                    const finalMetaDescription = options.metaDescription || getMetaDescription(options.content);
                    const seoResult = await wpApi.updateSeoMeta(post.id, {
                        title: options.title,
                        description: finalMetaDescription,
                        focusKeyword: finalFocusKeyword
                    });
                    if (seoResult.success) {
                        onLog?.(`✅ Yoast SEO 필드 설정 완료 (초점 키프레이즈: ${finalFocusKeyword})`);
                    }
                    else {
                        onLog?.('⚠️ Yoast SEO 필드 설정 실패 (SEO 플러그인이 없을 수 있습니다)');
                    }
                }
                catch (seoError) {
                    onLog?.(`⚠️ Yoast SEO 필드 설정 실패: ${seoError instanceof Error ? seoError.message : String(seoError)}`);
                }
            }
            const thumbnailUrl = uploadedThumbnailUrl || options.thumbnailUrl || undefined;
            console.log(`[WP-PUBLISH] 최종 반환: URL ${postUrl}, ID ${post.id}, 썸네일 ${thumbnailUrl || '없음'}`);
            return {
                ok: true,
                url: postUrl,
                id: post.id,
                ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {})
            };
        }
        else {
            throw new Error('포스트 생성 응답이 올바르지 않습니다.');
        }
    }
    catch (error) {
        onLog?.(`❌ WordPress 발행 실패: ${error.message}`);
        return {
            ok: false,
            error: error.message
        };
    }
}
//# sourceMappingURL=wordpress-publisher.js.map