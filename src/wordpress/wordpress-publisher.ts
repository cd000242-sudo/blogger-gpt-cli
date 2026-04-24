import { WordPressAPI, WordPressConfig, WordPressPost } from './wordpress-api';
import { Provider } from '../core/index';
import { callGeminiWithRetry } from '../core/final/gemini-engine';
// wp-agent-pipeline는 더 이상 사용하지 않음 (unused import 제거)

// 🃏 소제목별 카드 래핑 함수
function wrapSectionsInCards(html: string): string {
  if (!html) return html;

  try {
    // H2 또는 H3 태그 위치를 찾아 섹션 분할
    const headingPattern = /(<h[23][^>]*>)/gi;
    const parts: string[] = [];
    let lastIndex = 0;
    let match;

    // 모든 h2/h3 위치 수집
    const headings: { index: number; tag: string; level: number }[] = [];
    while ((match = headingPattern.exec(html)) !== null) {
      const level = match[0].toLowerCase().startsWith('<h2') ? 2 : 3;
      headings.push({ index: match.index, tag: match[0], level });
    }

    // 소제목이 없으면 원본 그대로 반환
    if (headings.length === 0) return html;

    // 첫 번째 소제목 이전 내용 (도입부)
    const firstHeading = headings[0];
    if (!firstHeading) return html;
    const introContent = html.substring(0, firstHeading.index).trim();
    // 🔥 도입부에서 이미지 태그 제거 (featured image와 중복 방지)
    const introWithoutImages = introContent.replace(/<img[^>]*>/gi, '').replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '').trim();
    if (introWithoutImages.length > 0) {
      parts.push(`<div class="wp-intro-card">${introWithoutImages}</div>`);
    }

    // 각 소제목 섹션을 카드로 래핑
    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      if (!heading) continue;
      const start = heading.index;
      const nextHeading = headings[i + 1];
      const end = nextHeading ? nextHeading.index : html.length;
      const sectionContent = html.substring(start, end).trim();
      const cardClass = heading.level === 3 ? 'wp-section-card wp-card-h3' : 'wp-section-card';
      parts.push(`<div class="${cardClass}">${sectionContent}</div>`);
    }

    return parts.join('\n');
  } catch (error) {
    console.warn('[WP-CARD] ⚠️ 카드 래핑 실패, 원본 반환:', error);
    return html;
  }
}

// WordPress 수익 최적화 스킨 v5.0 - Full-Width/18px/1.85/틸 통일 + !important
function applyWordPressInlineStyles(html: string): string {
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

    // ── 수익 최적화 통일 디자인 시스템 ──
    // 색상: 틸 #0d9488 (H2), 시안 #0891b2 (H3/링크)
    // 타이포: 18px / 1.85 / #1a1a1a / Noto Sans KR
    // 구조: 680px 폭 → 60~70자/줄 / 48px 섹션 간격
    // !important 필수 — WP 테마 오버라이드 방지

    // H2 - 틸 악센트
    styledHtml = styledHtml.replace(/<h2([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      const newStyle = `color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 22px !important; font-weight: 700 !important; margin: 48px 0 20px 0 !important; padding: 16px 20px !important; background: #f0fdfa !important; border-left: 5px solid #0d9488 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 8px 8px 0 !important; line-height: 1.4 !important; letter-spacing: -0.02em !important;`;
      return `<h2${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // H3 - 시안 악센트
    styledHtml = styledHtml.replace(/<h3([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      const newStyle = `color: #1e293b !important; -webkit-text-fill-color: #1e293b !important; font-size: 19px !important; font-weight: 600 !important; margin: 36px 0 16px 0 !important; padding: 12px 16px !important; background: transparent !important; border-left: 4px solid #0891b2 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; line-height: 1.4 !important;`;
      return `<h3${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // H4
    styledHtml = styledHtml.replace(/<h4([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      const newStyle = `color: #334155 !important; font-size: 17px !important; font-weight: 700 !important; margin: 28px 0 12px 0 !important; padding-left: 12px !important; border-left: 3px solid #94a3b8 !important; line-height: 1.4 !important;`;
      return `<h4${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // P - 수익 최적화 가독성
    styledHtml = styledHtml.replace(/<p([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      const newStyle = `color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 18px !important; line-height: 1.85 !important; margin: 0 0 24px 0 !important; word-break: keep-all !important; letter-spacing: -0.01em !important;`;
      return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // Strong/B
    styledHtml = styledHtml.replace(/<strong([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<strong${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
    });

    styledHtml = styledHtml.replace(/<b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<b${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
    });

    // 이미지
    styledHtml = styledHtml.replace(/<img([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} style="display: block !important; max-width: 100% !important; height: auto !important; margin: 32px auto !important; border-radius: 6px !important;">`;
    });

    // 테이블 — 🔥 모바일 반응형 + min-width 금지 + word-break (AdSense 광고 주입 방지 위해 class 보존)
    styledHtml = styledHtml.replace(/<table([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<table${cleanAttrs ? ' ' + cleanAttrs : ''} style="width: 100% !important; max-width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 32px 0 !important; border-radius: 10px !important; overflow: hidden !important; border: 1px solid #e2e8f0 !important; table-layout: auto !important;">`;
    });

    styledHtml = styledHtml.replace(/<th([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<th${cleanAttrs ? ' ' + cleanAttrs : ''} style="padding: 14px 16px !important; background: #f1f5f9 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important; text-align: left !important; font-size: 15px !important; border-bottom: 2px solid #e2e8f0 !important; word-break: break-word !important; overflow-wrap: break-word !important;">`;
    });

    styledHtml = styledHtml.replace(/<td([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<td${cleanAttrs ? ' ' + cleanAttrs : ''} style="padding: 12px 16px !important; border-bottom: 1px solid #f1f5f9 !important; color: #334155 !important; font-size: 16px !important; line-height: 1.7 !important; word-break: break-word !important; overflow-wrap: break-word !important;">`;
    });

    // 리스트
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

    // 인용구
    styledHtml = styledHtml.replace(/<blockquote([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<blockquote${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 28px 0 !important; padding: 20px 24px !important; background: #f8fafc !important; border-left: 4px solid #94a3b8 !important; border-radius: 0 6px 6px 0 !important; font-style: normal !important; font-size: 17px !important; line-height: 1.85 !important; color: #334155 !important;">`;
    });

    // 링크 - 시안 악센트
    styledHtml = styledHtml.replace(/<a([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0891b2 !important; -webkit-text-fill-color: #0891b2 !important; text-decoration: none !important; border-bottom: 1px solid #99f6e4 !important; font-weight: 600 !important;">`;
    });

    // 소제목별 카드 래핑
    styledHtml = wrapSectionsInCards(styledHtml);

    // 수익 최적화 CSS — 통일 디자인
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
      width: 100% !important;
      max-width: 100% !important;
      font-size: 14px !important;
      table-layout: auto !important;
    }
    .wp-styled-content table th {
      padding: 10px 10px !important;
      font-size: 12px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    .wp-styled-content table td {
      padding: 10px 10px !important;
      font-size: 13px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    /* 🛡️ AdSense Ad-Safe Zone — 표/CTA 내부 광고 주입 차단 */
    .wp-styled-content .ad-safe-zone,
    .wp-styled-content .table-wrapper {
      isolation: isolate !important;
      contain: layout style !important;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch !important;
    }
    .wp-styled-content img {
      max-width: 100% !important;
      height: auto !important;
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
    .wp-styled-content table {
      font-size: 12px !important;
    }
    .wp-styled-content table th,
    .wp-styled-content table td {
      padding: 8px 6px !important;
      font-size: 11px !important;
    }
  }

  /* 🛡️ AdSense Ad-Safe Zone — 데스크탑/모바일 공통 */
  .wp-styled-content .ad-safe-zone,
  .wp-styled-content .table-wrapper {
    position: relative !important;
    isolation: isolate !important;
    contain: layout style !important;
  }
  .wp-styled-content .ad-safe-zone[data-ad-region="no-ad"] {
    /* AdSense 크롤러 시그널: 이 블록 내부에는 광고 삽입 불가 */
  }
</style>
`;

    // 컨테이너 스타일
    const containerStyle = `max-width: 100% !important; margin: 0 !important; padding: 20px 5% !important; font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; font-size: 18px !important; line-height: 1.85 !important; color: #1a1a1a !important; word-break: keep-all !important;`;

    const wrappedContent = `${themeFriendlyCSS}<div class="wp-styled-content" style="${containerStyle}">${styledHtml}</div>`;

    // Gutenberg HTML 블록
    styledHtml = `<!-- wp:html -->
${wrappedContent}
<!-- /wp:html -->`;

    console.log('[WP-PUBLISH] ✅ 수익 최적화 풀와이드 스킨 적용 (100%/18px/1.85/틸)');
    return styledHtml;
  } catch (error) {
    console.warn('[WP-PUBLISH] ⚠️ WordPress 인라인 스타일 적용 실패:', error);
    return html;
  }
}

export interface WordPressPublishOptions {
  config: WordPressConfig;
  provider: Provider;
  openaiKey?: string;
  geminiKey?: string;
  topic: string;
  keywords: string | string[];
  minChars?: number;
  model?: string;
  categories?: string[];
  tags?: string[];
  status?: 'publish' | 'draft' | 'private' | 'pending';
  featuredImageUrl?: string;
  excerpt?: string;
  scheduleDate?: string; // ISO string
  // WordPress 전용 메타데이터
  metaDescription?: string;
  featuredImageAlt?: string;
  internalLinks?: string[];
  socialShareText?: string;
}

export interface PublishResult {
  success: boolean;
  postId?: number;
  postUrl?: string;
  error?: string;
  generatedContent?: string;
}

export class WordPressPublisher {
  private wpApi: WordPressAPI;

  constructor(config: WordPressConfig) {
    this.wpApi = new WordPressAPI(config);
  }

  // 새로운 간소화된 publish 메서드
  async publish(options: {
    title: string;
    content: string;
    featuredImageUrl?: string; // 🔥 대표 이미지 URL 추가
    excerpt?: string;
    metaDescription?: string;
    featuredImageAlt?: string;
    internalLinks?: string[];
    socialShareText?: string;
    status?: 'publish' | 'draft';
    scheduleDate?: string;
    geminiKey?: string; // AI 기능을 위한 키 추가
    categories?: string[]; // 🔥 사용자가 선택한 카테고리 (이름 또는 ID)
    preGeneratedTags?: string[]; // 🔥 오케스트레이션이 생성한 태그 (이게 있으면 AI 태그 생성 건너뜀)
  }): Promise<{ success: boolean; url?: string; postId?: number; error?: string }> {
    try {
      // 호출 쿼ота 체크 (시간당 10, 일일 100)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { checkAndIncrement } = require('../utils/usage-quota.js');
        const quota = checkAndIncrement('publish');
        if (!quota.ok) {
          return { success: false, error: quota.error };
        }
      } catch { }
      // 순수 텍스트 글자수 계산 (CSS 및 HTML 태그 제외)
      const stripTagsForCount = (htmlStr: string): string => {
        // <style> 태그와 그 내용 제거 (CSS 제외)
        let text = htmlStr.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        // 나머지 HTML 태그 제거
        text = text.replace(/<[^>]*>/g, '');
        // 연속된 공백을 하나로
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

      // WordPress API 제한 체크 (이중 체크)
      const WORDPRESS_TEXT_LIMIT = 50000; // 순수 텍스트 기준 제한
      const WORDPRESS_HTML_LIMIT = 100000; // 전체 HTML 크기 제한 (안전 마진 포함)

      // 1. 순수 텍스트 체크
      if (textLength > WORDPRESS_TEXT_LIMIT) {
        const errorMsg = `⚠️ 순수 텍스트 초과: ${textLength.toLocaleString()}자 (제한: ${WORDPRESS_TEXT_LIMIT.toLocaleString()}자). 본문을 줄여주세요.`;
        console.warn(`[WP-PUBLISH] ${errorMsg}`);
      }

      // 2. 전체 HTML 크기 체크 (CSS 포함)
      if (htmlLength > WORDPRESS_HTML_LIMIT) {
        const errorMsg = `⚠️ 전체 HTML 크기 초과: ${htmlLength.toLocaleString()}자 (제한: ${WORDPRESS_HTML_LIMIT.toLocaleString()}자). CSS 압축 또는 본문 축소가 필요합니다.`;
        console.warn(`[WP-PUBLISH] ${errorMsg}`);
        console.warn(`[WP-PUBLISH] CSS 크기: ${cssLength.toLocaleString()}자 (${((cssLength / htmlLength) * 100).toFixed(1)}%)`);
      }

      // 3. 경고 레벨 체크 (80% 이상 사용 시)
      if (htmlLength > WORDPRESS_HTML_LIMIT * 0.8) {
        const usagePercent = ((htmlLength / WORDPRESS_HTML_LIMIT) * 100).toFixed(1);
        console.warn(`[WP-PUBLISH] ⚠️ 전체 HTML 크기가 제한의 80% 이상입니다. (${usagePercent}% 사용)`);
        console.warn(`[WP-PUBLISH] ⚠️ 현재: 텍스트 ${textLength.toLocaleString()}자, CSS ${cssLength.toLocaleString()}자, 전체 ${htmlLength.toLocaleString()}자`);
      }

      // 4. 안전 정보 표시
      const textUsagePercent = ((textLength / WORDPRESS_TEXT_LIMIT) * 100).toFixed(1);
      const htmlUsagePercent = ((htmlLength / WORDPRESS_HTML_LIMIT) * 100).toFixed(1);
      console.log(`[WP-PUBLISH] 크기 정보: 텍스트 ${textUsagePercent}% 사용, 전체 HTML ${htmlUsagePercent}% 사용`);

      // WordPress CSS 적용 최적화
      let optimizedContent = options.content;

      // WordPress CSS 적용 검증
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

      // 🔥 항상 금색 프리미엄 스킨 + 모바일 최적화 인라인 스타일 적용
      // 워드프레스 테마와 관계없이 일관된 스타일 보장
      console.log(`[WP-PUBLISH] 🎨 금색 프리미엄 스킨 + 모바일 최적화 적용 중...`);
      optimizedContent = applyWordPressInlineStyles(options.content);
      console.log(`[WP-PUBLISH] ✅ 블로거와 동일한 금색 프리미엄 스킨 적용 완료`);

      console.log('[WP-PUBLISH] 워드프레스 연결 테스트 시작...');
      const isConnected = await this.wpApi.testConnection();
      if (!isConnected) {
        const config = this.wpApi as any;
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

      // 1. CSS가 있는 경우 WordPress 핵 옵션 적용
      if (cssLength > 0) {
        console.log(`[WP-PUBLISH] ✅ CSS 발견됨 (${cssLength.toLocaleString()}자) - WordPress 핵 옵션 적용`);

        // WordPress 핵 옵션: 모든 WordPress 테마/플러그인 CSS 오버라이드
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

        // 기존 CSS에 WordPress 핵 옵션 추가
        optimizedContent = optimizedContent.replace(
          /(<style[^>]*>[\s\S]*?<\/style>)/i,
          (match) => {
            const nuclearCSS = wordpressNuclearCSS.replace(/^\s+|\s+$/gm, '');
            return match.replace('</style>', '\n' + nuclearCSS + '\n</style>');
          }
        );

        console.log(`[WP-PUBLISH] 🛡️ WordPress 핵 옵션 적용 완료`);
      } else {
        console.log(`[WP-PUBLISH] ⚠️ CSS가 없음 - 기본 텍스트 서식만 적용될 수 있음`);
      }

      // 🔥 이미 applyWordPressInlineStyles에서 <!-- wp:html --> 블록으로 감싸졌으므로
      // 여기서는 추가 래핑 없이 그대로 사용
      // (이중 래핑 시 WordPress가 "클래식" 블록으로 잘못 파싱함)

      // 썸네일 처리 (대표 이미지 설정)
      let featuredMediaId: number | undefined;
      if (options.featuredImageUrl) {
        console.log(`[WP-PUBLISH] 🖼️ 대표 이미지 업로드 시도: ${options.featuredImageUrl.substring(0, 50)}...`);
        try {
          // URL에서 이미지 데이터 (ArrayBuffer) 가져오기
          const response = await fetch(options.featuredImageUrl);
          if (!response.ok) throw new Error(`이미지 다운로드 실패: ${response.status}`);
          const imageBuffer = await response.arrayBuffer();

          const uploadedMedia = await this.wpApi.uploadMedia(imageBuffer, `${Date.now()}-thumbnail.jpg`, options.title);
          if (uploadedMedia && uploadedMedia.id) {
            featuredMediaId = uploadedMedia.id;
            console.log(`[WP-PUBLISH] ✅ 대표 이미지 업로드 성공 (Media ID: ${featuredMediaId})`);
          }
        } catch (mediaError: any) {
          console.error(`[WP-PUBLISH] ❌ 대표 이미지 업로드 실패:`, mediaError.message);
          // 썸네일 업로드 실패해도 포스트 발행은 계속 진행
        }
      }

      // 포스트 데이터 준비 - options.status 사용
      // 🔥 예약 발행: status를 'future'로 설정해야 WordPress가 예약 발행으로 처리
      let finalStatus: 'publish' | 'draft' | 'future';
      if (options.status === 'draft') {
        finalStatus = 'draft';
      } else if (options.scheduleDate) {
        const sDate = new Date(options.scheduleDate);
        finalStatus = !isNaN(sDate.getTime()) && sDate.getTime() > Date.now() ? 'future' : 'publish';
      } else {
        finalStatus = 'publish';
      }
      console.log(`[WP-PUBLISH] 발행 상태: ${options.status} → ${finalStatus}`);

      const postData: WordPressPost = {
        title: options.title,
        content: optimizedContent,
        excerpt: options.excerpt || this.extractExcerpt(options.content),
        status: finalStatus as 'publish' | 'draft' | 'private' | 'pending'
      };

      // 🔥 예약 발행 처리 (date 필드 추가)
      if (options.scheduleDate) {
        const sDate = new Date(options.scheduleDate);
        if (!isNaN(sDate.getTime())) {
          postData.date = sDate.toISOString();
          console.log(`[WP-PUBLISH] 📅 예약 발행 설정: ${postData.date} (status=${finalStatus})`);
        }
      }

      // 대표 이미지가 있으면 추가
      if (featuredMediaId) {
        (postData as any).featured_media = featuredMediaId;
      }

      // 🔥 제목에서 이모지 제거 (SEO 최적화: Google은 이모지가 포함된 제목을 비선호)
      const cleanTitle = options.title
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}📌✅🔥💡🚀📊🎯⚡❤️🔍📷🔗🎁💰📅]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim() || options.title; // 🛡️ 빈 문자열 방지: 이모지만으로 구성된 제목일 경우 원본 사용
      console.log(`[WP-PUBLISH] 📝 원본 제목: ${options.title}`);
      console.log(`[WP-PUBLISH] 📝 클린 제목: ${cleanTitle}`);

      // 🔥 태그: 오케스트레이션이 미리 생성한 것이 있으면 그것 사용, 없으면 Gemini AI로 생성
      let tagIds: number[] = [];
      try {
        let generatedTags: string[];
        if (options.preGeneratedTags && options.preGeneratedTags.length > 0) {
          generatedTags = options.preGeneratedTags;
          console.log(`[WP-PUBLISH] 🏷️ 오케스트레이션 태그 재사용: ${generatedTags.join(', ')}`);
        } else {
          generatedTags = await this.generateTagsSmart(cleanTitle, options.content, options.geminiKey);
        }
        if (generatedTags.length > 0) {
          tagIds = await this.resolveTags(generatedTags);
          console.log(`[WP-PUBLISH] 🏷️ 태그 등록 완료: ${generatedTags.join(', ')} (${tagIds.length}개 등록)`);
        }
      } catch (tagErr) {
        console.warn('[WP-PUBLISH] ⚠️ 태그 자동 생성 실패:', tagErr);
      }

      // 포스트 데이터에 태그 추가
      if (tagIds.length > 0) {
        (postData as any).tags = tagIds;
      }

      // 🔥 카테고리: 사용자가 선택한 카테고리를 포스트에 적용
      if (options.categories && options.categories.length > 0) {
        try {
          // 숫자 ID 문자열과 이름을 구분
          const numericIds: number[] = [];
          const names: string[] = [];
          options.categories.forEach(c => {
            const n = Number(c);
            if (Number.isFinite(n) && String(n) === String(c).trim()) {
              numericIds.push(n);
            } else {
              names.push(String(c).trim());
            }
          });
          let catIds = [...numericIds];
          if (names.length > 0) {
            const resolved = await this.resolveCategories(names);
            catIds = [...catIds, ...resolved];
          }
          if (catIds.length > 0) {
            (postData as any).categories = catIds;
            console.log(`[WP-PUBLISH] 📂 카테고리 ${catIds.length}개 적용: ${catIds.join(', ')}`);
          }
        } catch (catErr: any) {
          console.warn('[WP-PUBLISH] ⚠️ 카테고리 처리 실패:', catErr.message);
        }
      }

      // 포스트 생성 (클린 제목 사용)
      (postData as any).title = cleanTitle;
      const createdPost = await this.wpApi.createPost(postData);

      // SEO 메타데이터 자동 처리 (초점 키프레이즈, 메타설명 등)
      if (createdPost.id) {
        // AI 기능 활용 (Gemini API 키가 있는 경우)
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

      const result: { success: boolean; url?: string; postId?: number; error?: string } = {
        success: true,
        url: `${this.wpApi['config'].siteUrl}/wp-admin/post.php?post=${createdPost.id}&action=edit`
      };

      if (createdPost.id) {
        result.postId = Number(createdPost.id);
      }

      return result;

    } catch (error) {
      console.error('워드프레스 포스트 발행 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      };
    }
  }

  async publishPost(_options: WordPressPublishOptions): Promise<PublishResult> {
    try {
      // 1. 연결 테스트
      const isConnected = await this.wpApi.testConnection();
      if (!isConnected) {
        return {
          success: false,
          error: '워드프레스 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.'
        };
      }

      // 2. AI로 콘텐츠 생성
      // 이 함수는 더 이상 사용되지 않습니다.
      // runPost를 통해 콘텐츠를 생성하세요.
      return {
        success: false,
        error: '이 함수는 더 이상 사용되지 않습니다. runPost를 사용하세요.'
      };

    } catch (error) {
      console.error('워드프레스 포스트 발행 실패:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async resolveCategories(categoryNames: string[]): Promise<number[]> {
    if (categoryNames.length === 0) return [];

    const existingCategories = await this.wpApi.getCategories();
    const categoryIds: number[] = [];

    for (const categoryName of categoryNames) {
      let category = existingCategories.find(cat =>
        cat.name.toLowerCase() === categoryName.toLowerCase()
      );

      if (!category) {
        // 카테고리가 없으면 생성
        try {
          category = await this.wpApi.createCategory(categoryName);
        } catch (error) {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async resolveTags(tagNames: string[]): Promise<number[]> {
    if (tagNames.length === 0) return [];

    const existingTags = await this.wpApi.getTags();
    const tagIds: number[] = [];

    for (const tagName of tagNames) {
      let tag = existingTags.find(t =>
        t.name.toLowerCase() === tagName.toLowerCase()
      );

      if (!tag) {
        // 태그가 없으면 생성
        try {
          tag = await this.wpApi.createTag(tagName);
        } catch (error) {
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

  private extractExcerpt(content: string, maxLength: number = 160): string {
    // HTML 태그 제거
    const textContent = content.replace(/<[^>]*>/g, '');

    // 공백 정리
    const cleanText = textContent.replace(/\s+/g, ' ').trim();

    if (cleanText.length <= maxLength) {
      return cleanText;
    }

    return cleanText.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async downloadImage(imageUrl: string): Promise<ArrayBuffer> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`이미지 다운로드 실패: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } catch (error) {
      throw new Error(`이미지 다운로드 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }

  // 배치 발행 (엑셀 파일에서 여러 포스트 발행)
  async publishBatch(posts: WordPressPublishOptions[]): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

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

        // API 제한을 고려한 딜레이
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        results.push({
          success: false,
          error: `포스트 ${i + 1} 발행 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
        });
      }
    }

    return results;
  }

  // 초점 키프레이즈 스마트 추출 (AI 활용)
  // 🔥 apiKey 가드 제거: callGeminiWithRetry가 내부적으로 선택된 엔진의 키를 해결함
  private async extractFocusKeywordSmart(title: string, content: string, _apiKey?: string): Promise<string> {
    try {
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

      return (await callGeminiWithRetry(prompt)).trim().replace(/["']/g, '');
    } catch (err) {
      console.warn('[SEO] AI 키워드 추출 실패, 폴백 사용:', err);
      return this.extractFocusKeywordFallback(title);
    }
  }

  // 🔥 태그 자동 생성 (Gemini AI 활용)
  // 🔥 apiKey 가드 제거: 디스패처가 선택된 엔진 키 내부 해결
  private async generateTagsSmart(title: string, content: string, _apiKey?: string): Promise<string[]> {
    // 폴백: 제목에서 키워드 추출
    const fallbackTags = this.extractTagsFallback(title);

    try {
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

      const text = (await callGeminiWithRetry(prompt)).trim();

      // 쉼표 구분된 태그 파싱 (따옴표 제거 포함)
      const tags = text
        .replace(/^["']|["']$/g, '') // 🛡️ AI가 전체를 따옴표로 감쌀 경우 제거
        .split(',')
        .map((t: string) => t.trim().replace(/^#/, '').replace(/["']/g, '').trim())
        .filter((t: string) => t.length > 0 && t.length <= 20);

      if (tags.length >= 3) {
        console.log(`[WP-TAGS] ✅ AI 태그 생성: ${tags.join(', ')}`);
        return tags;
      }

      return fallbackTags;
    } catch (err) {
      console.warn('[WP-TAGS] ⚠️ AI 태그 생성 실패, 폴백 사용:', err);
      return fallbackTags;
    }
  }

  // 태그 폴백 추출 (제목에서 키워드 분리)
  private extractTagsFallback(title: string): string[] {
    if (!title) return [];
    const clean = title
      .replace(/[!?|,.\-\[\](){}'"]/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // 2글자 이상인 단어만 추출
    const words = clean.split(' ').filter(w => w.length >= 2);
    return words.slice(0, 8);
  }

  // 폴백 키워드 추출
  private extractFocusKeywordFallback(title: string): string {
    if (!title) return '블로그 포스트';
    const clean = title.split('!')[0] || title;
    const clean2 = clean.split('?')[0] || clean;
    const clean3 = clean2.split('|')[0] || clean2;
    const clean4 = clean3.split('-')[0] || clean3;
    return clean4.trim().substring(0, 30);
  }

  // 메타 설명 스마트 생성 (AI 활용)
  // 🔥 apiKey 가드 제거: 디스패처가 선택된 엔진 키 내부 해결
  private async generateMetaDescriptionSmart(content: string, _apiKey?: string): Promise<string> {
    const plainText = content.replace(/<[^>]*>/g, '').substring(0, 1000);

    try {
      // 🔥 제목도 함께 전달하여 더 정확한 메타 디스크립션 생성
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

      return (await callGeminiWithRetry(prompt)).trim().replace(/["']/g, '');
    } catch (err) {
      return plainText.substring(0, 155).trim();
    }
  }
  // 메타 설명 생성 함수 (폴백용)
  private generateMetaDescriptionFallback(content: string, limit: number = 155): string {
    try {
      // HTML 태그 제거
      let cleanContent = content
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // 첫 번째 문단이나 문장 추출 (150자 이내)
      const combinedSentence = cleanContent.replace(/。/g, '.').replace(/！/g, '!').replace(/？/g, '?');
      const sentences = combinedSentence.split(/[.!?]/);

      for (const sentence of sentences) {
        if (sentence.trim().length >= 20 && sentence.trim().length <= limit) {
          return sentence.trim();
        }
      }

      // 적절한 길이의 문장이 없으면 컨텐츠 앞부분을 자름
      let description = cleanContent.substring(0, limit).trim();

      // 단어 중간에서 자르지 않도록 마지막 공백에서 자름
      const lastSpaceIndex = description.lastIndexOf(' ');
      if (lastSpaceIndex > limit * 0.8) { // 80% 이상 지점에서 공백이 있으면
        description = description.substring(0, lastSpaceIndex);
      }

      return description + '...';
    } catch (error) {
      console.error('메타 설명 생성 실패:', error);
      return content.substring(0, 100);
    }
  }
}

/**
 * WordPress 발행 헬퍼 함수 (간편한 인터페이스)
 */
export async function publishToWordPress(
  options: {
    title: string;
    content: string;
    status?: 'publish' | 'draft' | 'schedule';
    categories?: number[];
    tags?: string[]; // 🔧 태그 배열 추가
    siteUrl: string;
    username: string;
    password: string;
    scheduleDate?: Date | string; // 예약 발행 날짜
    thumbnailUrl?: string; // 🔧 썸네일 URL (data:image 또는 외부 URL)
    focusKeyword?: string; // 🔧 Yoast SEO 초점 키프레이즈
    metaDescription?: string; // 🔧 Yoast SEO 메타설명
    // 🤖 에이전트 팀 파이프라인
    useAgentPipeline?: boolean; // true → 2-step AI 개선 파이프라인
    geminiKey?: string; // Gemini API 키 (에이전트 파이프라인용)
    agentTopic?: string; // 에이전트 파이프라인 주제
    agentKeywords?: string; // 에이전트 파이프라인 키워드
  },
  onLog?: (s: string) => void
): Promise<{ ok: boolean; url?: string; id?: number; error?: string; thumbnail?: string }> {
  try {
    onLog?.('[WP] WordPress 발행 시작...');

    // WordPress API 클라이언트 생성
    const wpApi = new WordPressAPI({
      siteUrl: options.siteUrl,
      username: options.username,
      password: options.password
    });

    // 연결 테스트
    onLog?.('[WP] WordPress 연결 확인 중...');
    const isConnected = await wpApi.testConnection();
    if (!isConnected) {
      throw new Error('WordPress 사이트에 연결할 수 없습니다. URL과 인증 정보를 확인해주세요.');
    }
    onLog?.('✅ WordPress 연결 확인 완료');

    // 🔥 예약 발행 처리 - 기본값을 'publish'로 변경
    console.log(`[WP-PUBLISH] 받은 status: "${options.status}"`);
    let postStatus: 'publish' | 'draft' | 'future' = options.status === 'schedule' ? 'future' : (options.status === 'draft' ? 'draft' : 'publish');
    console.log(`[WP-PUBLISH] 최종 postStatus: "${postStatus}"`);
    let postDate: string | undefined;

    if (options.status === 'schedule' && options.scheduleDate) {
      const scheduleDate = typeof options.scheduleDate === 'string' ? new Date(options.scheduleDate) : options.scheduleDate;
      if (!isNaN(scheduleDate.getTime())) {
        // WordPress는 ISO 8601 형식의 날짜를 요구 (예: "2024-12-25T10:00:00")
        postDate = scheduleDate.toISOString();
        onLog?.(`📅 예약 발행 시간: ${scheduleDate.toLocaleString('ko-KR')}`);
      } else {
        onLog?.('⚠️ 예약 시간이 유효하지 않습니다. 즉시 발행합니다.');
        postStatus = 'publish';
      }
    }

    // 썸네일 처리 (featured image)
    let featuredMediaId: number | undefined;
    let uploadedThumbnailUrl: string | undefined;
    if (options.thumbnailUrl) {
      try {
        onLog?.('[WP] 썸네일 업로드 중...');

        // data:image URL인 경우 base64 디코딩
        if (options.thumbnailUrl.startsWith('data:image')) {
          const base64Match = options.thumbnailUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
          if (base64Match && base64Match[2]) {
            const imageType = base64Match[1] || 'png';
            const base64Data = base64Match[2];

            // base64를 ArrayBuffer로 변환 (Node.js 환경 호환)
            let arrayBuffer: ArrayBuffer;
            if (typeof Buffer !== 'undefined') {
              // Node.js 환경
              const buffer = Buffer.from(base64Data, 'base64');
              arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            } else {
              // 브라우저 환경
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              arrayBuffer = bytes.buffer;
            }

            // 미디어 업로드
            const filename = `thumbnail-${Date.now()}.${imageType}`;
            console.log(`[WP-THUMBNAIL] 썸네일 업로드 시작: ${filename}`);
            const uploadedMedia = await wpApi.uploadMedia(arrayBuffer, filename, options.title);

            if (uploadedMedia && uploadedMedia.id) {
              featuredMediaId = uploadedMedia.id;
              uploadedThumbnailUrl = uploadedMedia.source_url;
              console.log(`[WP-THUMBNAIL] ✅ 썸네일 업로드 성공: ID ${featuredMediaId}, URL: ${uploadedThumbnailUrl}`);
              onLog?.(`✅ 썸네일 업로드 완료 (ID: ${featuredMediaId})`);
            } else {
              console.warn(`[WP-THUMBNAIL] ⚠️ 썸네일 업로드 응답에 ID가 없음:`, uploadedMedia);
              onLog?.(`⚠️ 썸네일 업로드 응답에 ID가 없습니다`);
            }
          } else {
            console.warn(`[WP-THUMBNAIL] ⚠️ data:image URL 파싱 실패`);
            onLog?.(`⚠️ 썸네일 URL 형식이 올바르지 않습니다`);
          }
        } else {
          // 외부 URL인 경우 직접 다운로드 후 업로드
          try {
            console.log(`[WP-THUMBNAIL] 외부 URL 썸네일 다운로드 시작: ${options.thumbnailUrl.substring(0, 100)}`);
            const imageResponse = await fetch(options.thumbnailUrl);
            if (imageResponse.ok) {
              console.log(`[WP-THUMBNAIL] 다운로드 성공, 업로드 중...`);
              const imageBlob = await imageResponse.blob();
              const arrayBuffer = await imageBlob.arrayBuffer();

              // 파일 확장자 추출
              const urlPath = new URL(options.thumbnailUrl).pathname;
              const extension = urlPath.split('.').pop() || 'jpg';
              const filename = `thumbnail-${Date.now()}.${extension}`;

              const uploadedMedia = await wpApi.uploadMedia(arrayBuffer, filename, options.title);

              if (uploadedMedia && uploadedMedia.id) {
                featuredMediaId = uploadedMedia.id;
                uploadedThumbnailUrl = uploadedMedia.source_url;
                console.log(`[WP-THUMBNAIL] ✅ 외부 URL 썸네일 업로드 성공: ID ${featuredMediaId}`);
                onLog?.(`✅ 썸네일 업로드 완료 (ID: ${featuredMediaId})`);
              } else {
                console.warn(`[WP-THUMBNAIL] ⚠️ 업로드 응답에 ID가 없음`);
                onLog?.(`⚠️ 썸네일 업로드 응답에 ID가 없습니다`);
              }
            } else {
              console.error(`[WP-THUMBNAIL] ❌ 외부 URL 다운로드 실패: ${imageResponse.status}`);
              onLog?.(`⚠️ 외부 썸네일 다운로드 실패: HTTP ${imageResponse.status}`);
            }
          } catch (fetchError) {
            console.error(`[WP-THUMBNAIL] ❌ 외부 URL 처리 오류:`, fetchError);
            onLog?.(`⚠️ 외부 썸네일 다운로드 실패: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
          }
        }
      } catch (thumbnailError) {
        onLog?.(`⚠️ 썸네일 업로드 실패: ${thumbnailError instanceof Error ? thumbnailError.message : String(thumbnailError)}`);
        // 썸네일 업로드 실패해도 포스트는 계속 발행
      }
    }

    // 태그 처리 (태그 이름 배열을 태그 ID 배열로 변환)
    let tagIds: number[] = [];
    if (options.tags && options.tags.length > 0) {
      try {
        onLog?.('[WP] 태그 처리 중...');
        const existingTags = await wpApi.getTags();
        const tagNameToId = new Map<string, number>();

        // 기존 태그 매핑
        existingTags.forEach(tag => {
          tagNameToId.set(tag.name.toLowerCase(), tag.id);
        });

        // 태그 생성 또는 ID 가져오기
        for (const tagName of options.tags) {
          const normalizedName = tagName.trim().replace(/^#/, ''); // 해시태그 제거
          if (!normalizedName) continue;

          const lowerName = normalizedName.toLowerCase();
          if (tagNameToId.has(lowerName)) {
            tagIds.push(tagNameToId.get(lowerName)!);
          } else {
            try {
              const newTag = await wpApi.createTag(normalizedName);
              if (newTag && newTag.id) {
                tagIds.push(newTag.id);
                tagNameToId.set(lowerName, newTag.id);
                onLog?.(`✅ 태그 생성: ${normalizedName}`);
              }
            } catch (tagError) {
              onLog?.(`⚠️ 태그 생성 실패 (${normalizedName}): ${tagError instanceof Error ? tagError.message : String(tagError)}`);
            }
          }
        }

        if (tagIds.length > 0) {
          onLog?.(`✅ 태그 설정 완료 (${tagIds.length}개)`);
        }
      } catch (tagError) {
        onLog?.(`⚠️ 태그 처리 실패: ${tagError instanceof Error ? tagError.message : String(tagError)}`);
        // 태그 처리 실패해도 포스트는 계속 발행
      }
    }

    // 에이전트 팀 파이프라인은 더 이상 사용하지 않음
    let contentToStyle = options.content;

    // 🔥 WordPress 인라인 스타일 적용
    onLog?.('[WP] WordPress 스킨 적용 중...');
    const styledContent = applyWordPressInlineStyles(contentToStyle);
    onLog?.('✅ WordPress 클린 모던 스킨 적용 완료');

    // 포스트 생성
    onLog?.('[WP] 포스트 생성 중...');
    const postData: any = {
      title: options.title,
      content: styledContent, // 🔥 스타일 적용된 콘텐츠
      status: postStatus,
      categories: options.categories || [],
      tags: tagIds // 🔧 태그 ID 배열 추가
    };

    console.log(`[WP-PUBLISH] 📦 생성된 PostData Status: "${postData.status}"`);
    console.log(`[WP-PUBLISH]    - 원본 options.status: "${options.status}"`);
    console.log(`[WP-PUBLISH]    - 계산된 postStatus: "${postStatus}"`);

    // 썸네일 설정 (featured_media)
    if (featuredMediaId) {
      postData.featured_media = featuredMediaId;
      console.log(`[WP-PUBLISH] ✅ Featured Media 설정: ID ${featuredMediaId}`);
      onLog?.(`✅ 썸네일 설정 완료 (Featured Media ID: ${featuredMediaId})`);
    } else if (options.thumbnailUrl) {
      console.warn(`[WP-PUBLISH] ⚠️ 썸네일 URL은 있지만 Featured Media ID가 없음 (업로드 실패 가능성)`);
      onLog?.(`⚠️ 썸네일 업로드에 실패하여 포스트에 썸네일이 설정되지 않았습니다`);
    } else {
      console.log(`[WP-PUBLISH] 썸네일 URL이 제공되지 않음`);
    }

    // 예약 발행인 경우 date 필드 추가
    if (postDate) {
      postData.date = postDate;
    }

    const post = await wpApi.createPost(postData);

    if (post && post.id) {
      const postUrl = `${options.siteUrl}/wp-admin/post.php?post=${post.id}&action=edit`;
      onLog?.(`✅ WordPress 포스트 생성 완료: ${postUrl}`);

      // 🔧 Yoast SEO 필드 자동 설정 (초점 키프레이즈, 메타설명)
      // WordPressPublisher 클래스의 메서드 재사용 (중복 제거)
      if (options.focusKeyword || options.metaDescription) {
        try {
          onLog?.('[WP] Yoast SEO 필드 설정 중...');

          // WordPressPublisher 인스턴스 생성하여 메서드 재사용
          const publisher = new WordPressPublisher({
            siteUrl: options.siteUrl,
            username: options.username,
            password: options.password
          });

          // private 메서드 접근을 위한 타입 단언 (중복 제거)
          const extractFocusKeyword = (publisher as any).extractFocusKeyword?.bind(publisher);
          const generateMetaDescription = (publisher as any).generateMetaDescription?.bind(publisher);

          // 폴백 함수 (메서드 접근 실패 시)
          const getFocusKeyword = extractFocusKeyword
            ? (title: string) => extractFocusKeyword(title, '')
            : (title: string) => {
              const words = title
                .replace(/[0-9년월일]/g, ' ')
                .replace(/[^\w가-힣\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 1);

              if (words.length === 0) return title.substring(0, 50);

              const longestWord = words.reduce((a, b) => a.length > b.length ? a : b);
              return longestWord.length > 2 ? longestWord : words[0] || title.substring(0, 50);
            };

          const getMetaDescription = generateMetaDescription
            ? (content: string) => generateMetaDescription(content, 155)
            : (content: string) => {
              const text = content
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

              if (text.length <= 155) return text;

              const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
              let description = '';
              for (const sentence of sentences) {
                if ((description + sentence).length <= 155) {
                  description += sentence;
                } else {
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
          } else {
            onLog?.('⚠️ Yoast SEO 필드 설정 실패 (SEO 플러그인이 없을 수 있습니다)');
          }
        } catch (seoError) {
          onLog?.(`⚠️ Yoast SEO 필드 설정 실패: ${seoError instanceof Error ? seoError.message : String(seoError)}`);
          // SEO 필드 설정 실패해도 포스트는 정상 발행
        }
      }

      // 썸네일 URL 반환 (업로드된 미디어 URL 또는 원본 URL)
      const thumbnailUrl = uploadedThumbnailUrl || options.thumbnailUrl || undefined;
      console.log(`[WP-PUBLISH] 최종 반환: URL ${postUrl}, ID ${post.id}, 썸네일 ${thumbnailUrl || '없음'}`);

      return {
        ok: true,
        url: postUrl,
        id: post.id,
        ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {})
      };
    } else {
      throw new Error('포스트 생성 응답이 올바르지 않습니다.');
    }

  } catch (error: any) {
    onLog?.(`❌ WordPress 발행 실패: ${error.message}`);
    return {
      ok: false,
      error: error.message
    };
  }
}
