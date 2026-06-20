import { WordPressAPI, WordPressConfig, WordPressPost } from './wordpress-api';
import { Provider } from '../core/index';
import { callGeminiWithRetry } from '../core/final/gemini-engine';
import { waitForTextProviderTurn } from '../core/llm/provider-throttle';
// wp-agent-pipeline는 더 이상 사용하지 않음 (unused import 제거)

// 🃏 소제목별 카드 래핑 함수
// v3.8.26: 거미줄 미리보기 = 발행 일치를 위해 export
export function wrapSectionsInCards(html: string): string {
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
// v3.8.26: 거미줄에서도 동일 스킨 적용 가능하도록 export
const BROKEN_TEXT_PATTERN = /\uFFFD|&#(?:65533|xfffd);|%EF%BF%BD/gi;
const WP_INFO_BOX_STYLES: Record<string, string> = {
  'data-box': 'margin:24px 0 !important;padding:24px 28px !important;background:#dbeafe !important;border-left:5px solid #2563eb !important;border-radius:0 12px 12px 0 !important;box-sizing:border-box !important;display:block !important;visibility:visible !important;color:#111827 !important;-webkit-text-fill-color:#111827 !important;',
  'highlight': 'margin:20px 0 !important;padding:20px 24px !important;background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%) !important;border-left:5px solid #f59e0b !important;border-radius:0 12px 12px 0 !important;box-sizing:border-box !important;display:block !important;',
  'warning': 'margin:20px 0 !important;padding:20px 24px !important;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%) !important;border-left:5px solid #ef4444 !important;border-radius:0 12px 12px 0 !important;box-sizing:border-box !important;display:block !important;',
  'success': 'margin:20px 0 !important;padding:20px 24px !important;background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%) !important;border-left:5px solid #16a34a !important;border-radius:0 12px 12px 0 !important;box-sizing:border-box !important;display:block !important;',
  'checklist': 'margin:20px 0 !important;padding:20px 24px !important;background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%) !important;border:1px solid #bae6fd !important;border-radius:12px !important;box-sizing:border-box !important;display:block !important;',
  'quote': 'margin:20px 0 !important;padding:18px 22px !important;background:#f8fafc !important;border-left:5px solid #0d9488 !important;border-radius:0 10px 10px 0 !important;box-sizing:border-box !important;display:block !important;'
};
const WP_TABLE_SCROLL_STYLE = [
  'display: block',
  'width: 100%',
  'max-width: 100%',
  'box-sizing: border-box',
  'overflow: visible',
  'margin: 20px 0',
  'padding: 0',
  'background: transparent',
  'border: 0',
  'border-radius: 0'
].join('; ');

function inlineWordPressInfoBoxStyles(html: string): string {
  return String(html || '').replace(/<div\b([^>]*)>/gi, (match, attrs = '') => {
    const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
    const className = classMatch?.[2] || '';
    const boxKey = Object.keys(WP_INFO_BOX_STYLES).find(key => new RegExp(`(?:^|\\s)${key}(?:\\s|$)`, 'i').test(className));
    if (!boxKey) return match;
    const cleanAttrs = attrs.replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, '').trim();
    return `<div${cleanAttrs ? ' ' + cleanAttrs : ''} style="${WP_INFO_BOX_STYLES[boxKey]}">`;
  });
}

function addClassToAttrs(attrs: string, classToAdd: string): string {
  const currentAttrs = String(attrs || '');
  const classMatch = currentAttrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!classMatch) return `${currentAttrs.trim()} class="${classToAdd}"`.trim();

  const classes = (classMatch[2] || '').split(/\s+/).filter(Boolean);
  if (!classes.includes(classToAdd)) classes.push(classToAdd);

  return currentAttrs
    .replace(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i, (_m, quote) => ` class=${quote}${classes.join(' ')}${quote}`)
    .trim();
}

function escapeWpAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripWpTags(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function addTableCellLabels(tableHtml: string): string {
  const headers = Array.from(tableHtml.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi))
    .map(match => stripWpTags(match[1] || ''));
  if (!headers.length) return tableHtml;

  return tableHtml.replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (rowHtml) => {
    if (!/<td\b/i.test(rowHtml)) return rowHtml;
    let cellIndex = 0;
    return rowHtml.replace(/<td\b([^>]*)>/gi, (match, attrs = '') => {
      if (/\sdata-label\s*=/i.test(attrs)) {
        cellIndex++;
        return match;
      }
      const label = escapeWpAttr(headers[cellIndex] || '');
      cellIndex++;
      return `<td${attrs || ''} data-label="${label}">`;
    });
  });
}

function wrapWordPressTables(html: string): string {
  if (!html || !/<table\b/i.test(html)) return html;

  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    if (/\bwp-mobile-table\b/i.test(tableHtml) || /\bwp-table-scroll\b/i.test(tableHtml)) return tableHtml;
    const tableWithLabels = addTableCellLabels(tableHtml);
    const table = tableWithLabels.replace(/<table\b([^>]*)>/i, (_match, attrs = '') => {
      const nextAttrs = addClassToAttrs(attrs, 'wp-mobile-table');
      return `<table ${nextAttrs}>`;
    });
    return `<div class="wp-table-scroll" data-wp-table-scroll="true" style="${WP_TABLE_SCROLL_STYLE}">${table}</div>`;
  });
}

function readCssCustomProperty(html: string, name: string, fallback: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(`${escapedName}\\s*:\\s*([^;]+);`, 'i'));
  return (match?.[1] || fallback).trim();
}

function readCssRuleValue(html: string, selector: string, property: string, fallback: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(html || '').match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?${escapedProperty}\\s*:\\s*([^;!]+)`, 'i'));
  return (match?.[1] || fallback).trim();
}

function getClassNameFromAttrs(attrs: string): string {
  return String(attrs || '').match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || '';
}

function stripInlineStyle(attrs: string): string {
  return String(attrs || '').replace(/\sstyle\s*=\s*(["'])[\s\S]*?\1/gi, '').trim();
}

function openTagWithStyle(tag: string, attrs: string, style: string): string {
  const cleanAttrs = stripInlineStyle(attrs);
  return `<${tag}${cleanAttrs ? ' ' + cleanAttrs : ''} style="${style}">`;
}

function hasClass(className: string, pattern: RegExp): boolean {
  return pattern.test(` ${className || ''} `);
}

function markWordPressInfoBoxChildren(html: string): string {
  return String(html || '').replace(/(<div\b(?=[^>]*\bclass\s*=\s*(["'])(?=[^"']*\b(?:data-box|highlight|warning|success|checklist|quote)\b)[^"']*\2)[^>]*>)([\s\S]*?)(<\/div>)/gi, (_match, openTag, _quote, inner, closeTag) => {
    let markedInner = String(inner || '')
      .replace(/<h([3-5])\b([^>]*)>/i, (_headingMatch, level, attrs = '') => {
        const nextAttrs = addClassToAttrs(attrs, 'wp-info-box-title');
        return `<h${level}${nextAttrs ? ' ' + nextAttrs : ''}>`;
      })
      .replace(/<p\b([^>]*)>/gi, (_pMatch, attrs = '') => {
        const nextAttrs = addClassToAttrs(attrs, 'wp-info-box-text');
        return `<p${nextAttrs ? ' ' + nextAttrs : ''}>`;
      })
      .replace(/<a\b([^>]*)>/gi, (_aMatch, attrs = '') => {
        const nextAttrs = addClassToAttrs(attrs, 'wp-info-box-link');
        return `<a${nextAttrs ? ' ' + nextAttrs : ''}>`;
      });

    return `${openTag}${markedInner}${closeTag}`;
  });
}

function repairBrokenText(label: string, value?: string | null): string {
  if (!value) return value || '';
  const matches = value.match(BROKEN_TEXT_PATTERN);
  if (!matches || matches.length === 0) return value;

  const marker = '(?:\\uFFFD|&#(?:65533|xfffd);|%EF%BF%BD)+';
  const mk = (source: string, flags = 'gi') => new RegExp(source.replace(/\[BAD\]/g, marker), flags);
  let repaired = value
    .replace(mk('청년내[BAD]저축계좌', 'g'), '청년내일저축계좌')
    .replace(mk('청년내[BAD]저축', 'g'), '청년내일저축')
    .replace(mk('폭넓[BAD]'), '폭넓게')
    .replace(mk('답니[BAD]'), '답니다')
    .replace(mk('합니[BAD]'), '합니다')
    .replace(mk('됩니[BAD]'), '됩니다')
    .replace(mk('입니[BAD]'), '입니다')
    .replace(mk('습니[BAD]'), '습니다')
    .replace(mk('([가-힣])니[BAD]'), '$1니다')
    .replace(BROKEN_TEXT_PATTERN, '')
    .replace(/\s{2,}/g, ' ');

  if (/<[^>]+>/.test(value)) {
    repaired = repaired.replace(/>\s+</g, '><');
  } else {
    repaired = repaired.trim();
  }

  console.warn(`[TEXT-REPAIR] ${label}: repaired ${matches.length} broken replacement marker(s) before publish.`);
  return repaired;
}

function repairPublishInputBrokenText<T extends {
  title?: string;
  content?: string;
  excerpt?: string;
  metaDescription?: string;
  featuredImageAlt?: string;
  focusKeyword?: string;
  preGeneratedTags?: string[];
  tags?: string[];
  categories?: Array<string | number>;
}>(options: T): T {
  if (options.title) options.title = repairBrokenText('제목', options.title);
  if (options.content) options.content = repairBrokenText('본문', options.content);
  if (options.excerpt) options.excerpt = repairBrokenText('요약문', options.excerpt);
  if (options.metaDescription) options.metaDescription = repairBrokenText('메타설명', options.metaDescription);
  if (options.featuredImageAlt) options.featuredImageAlt = repairBrokenText('대표 이미지 대체텍스트', options.featuredImageAlt);
  if (options.focusKeyword) options.focusKeyword = repairBrokenText('초점 키프레이즈', options.focusKeyword);
  if (options.preGeneratedTags) {
    options.preGeneratedTags = options.preGeneratedTags.map((tag, index) => repairBrokenText(`사전 생성 태그 ${index + 1}`, tag));
  }
  if (options.tags) {
    options.tags = options.tags.map((tag, index) => repairBrokenText(`태그 ${index + 1}`, tag));
  }
  if (options.categories) {
    options.categories = options.categories.map((category, index) =>
      typeof category === 'string' ? repairBrokenText(`카테고리 ${index + 1}`, category) : category
    );
  }
  return options;
}

// v3.8.88: 본문 사전 정리 (사용자 보고: 티빙 글 4건)
//   - 본문 첫 H1이 글 제목과 중복 → 제거
//   - "...안내하는 썸네일 이미지" 같은 캡션 텍스트 라인 → 제거
//   - 금액·기간·날짜·% 자동 <strong> 하이라이트 (이미 강조된 단락은 skip)
function preCleanupWordPressBody(html: string): string {
  let cleaned = html;
  // v3.8.110: 모든 H1 제거 (WP 자체 글 제목과 중복 — 첫 H1만이 아닌 본문 중간/article 내부 H1도)
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');

  const captionPatterns = [
    /<p[^>]*>\s*\[?(?:이미지|사진|썸네일|섬네일|illustration|image|figure)\s*[:：][\s\S]{1,200}?\]?\s*<\/p>/gi,
    /<p[^>]*>\s*[가-힣\w\s,·]{2,80}?(?:안내하는|보여주는|설명하는|나타내는|표현하는|묘사하는)\s*(?:썸네일|섬네일|이미지|사진|figure)\s*(?:입니다|이미지|사진)?\s*\.?\s*<\/p>/gi,
    /<p[^>]*>\s*&lt;[^&]{1,100}?(?:이미지|썸네일|섬네일|사진)[^&]*?&gt;\s*<\/p>/gi,
    /<p[^>]*>\s*<em[^>]*>\s*[\[(]?(?:이미지|사진|썸네일)[\s\S]{1,150}?[\])]?\s*<\/em>\s*<\/p>/gi,
  ];
  for (const pat of captionPatterns) cleaned = cleaned.replace(pat, '');

  const highlightInsideText = (text: string): string => {
    return text
      .replace(/(\d{1,3}(?:,\d{3})*\s*(?:만원|원|억|달러|USD))(?![^<]*>)/g, '<strong>$1</strong>')
      .replace(/(\d{1,3}(?:\.\d+)?\s*%)(?![^<]*>)/g, '<strong>$1</strong>')
      .replace(/((?:최대\s*|약\s*)?\d{1,3}\s*(?:년|개월|일|시간|분))(?![^<]*>)/g, '<strong>$1</strong>')
      .replace(/(20\d{2}년\s*\d{1,2}월\s*\d{1,2}일)(?![^<]*>)/g, '<strong>$1</strong>');
  };
  cleaned = cleaned.replace(/<(p|li)([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, inner) => {
    if (/<strong\b|<b\b/i.test(inner)) return match;
    const enhanced = highlightInsideText(inner);
    return `<${tag}${attrs}>${enhanced}</${tag}>`;
  });
  return cleaned;
}

export function applyWordPressInlineStyles(html: string): string {
  if (!html) return html;
  if (/\bdata-bgpt-wp-ready\s*=\s*["']true["']|\bbgpt-wp-ready\b/i.test(html)) return html;
  html = repairBrokenText('본문', html);

  try {
    // v3.8.88: 사전 정리
    html = preCleanupWordPressBody(html);

    // HTML 엔티티 정리 및 이모지 복원
    html = html
      .replace(/&nbsp;/g, ' ')
      .replace(/☐/g, '');
    html = html
      .replace(/&#9989;/g, '✅')
      .replace(/&#128204;/g, '📌')
      .replace(/&#128640;/g, '🚀')
      .replace(/&#128161;/g, '💡');

    let styledHtml = markWordPressInfoBoxChildren(inlineWordPressInfoBoxStyles(html));
    const usesFinalPreviewSkin = /\b(?:bgpt-content|gradient-frame|white-paper)\b/i.test(styledHtml);
    const previewPrimary = readCssCustomProperty(styledHtml, '--rv-primary', '#059669');
    const previewPrimaryLight = readCssCustomProperty(styledHtml, '--rv-primary-light', '#d1fae5');
    const previewCtaBg = readCssCustomProperty(styledHtml, '--rv-cta-bg', 'linear-gradient(135deg,#e0f2fe 0%,#dbeafe 100%)');
    const previewCtaBorder = readCssCustomProperty(styledHtml, '--rv-cta-border', '#93c5fd');
    const previewCtaBadgeBg = readCssCustomProperty(styledHtml, '--rv-cta-badge-bg', '#eff6ff');
    const previewCtaNote = readCssCustomProperty(styledHtml, '--rv-cta-note', '#0369a1');
    const previewCtaButtonStart = readCssCustomProperty(styledHtml, '--rv-cta-button-start', '#0891b2');
    const previewCtaButtonEnd = readCssCustomProperty(styledHtml, '--rv-cta-button-end', '#0284c7');
    const previewCtaShadow = readCssCustomProperty(styledHtml, '--rv-cta-shadow', 'rgba(2,132,199,0.24)');
    const previewHeading1 = readCssRuleValue(styledHtml, '.white-paper h1.post-title', 'color', '#064e3b');
    const previewH2Border = readCssRuleValue(styledHtml, '.white-paper h2', 'border-left', `6px solid ${previewPrimary}`);
    const previewGradientBg = readCssRuleValue(styledHtml, '.gradient-frame', 'background', 'linear-gradient(135deg, #f0fdf4 0%, #d1fae5 100%)');

    if (usesFinalPreviewSkin) {
      styledHtml = styledHtml.replace(/<div\b([^>]*)>/gi, (match, attrs = '') => {
        const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
        const className = classMatch?.[2] || '';
        const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
        if (/\bbgpt-content\b/i.test(className)) {
          const style = `width:100%;max-width:100%;box-sizing:border-box;color:#1e293b;-webkit-text-fill-color:initial;word-break:keep-all;overflow:visible;`;
          return `<div${cleanAttrs ? ' ' + cleanAttrs : ''} style="${style}">`;
        }
        if (/\bgradient-frame\b/i.test(className)) {
          const style = `width:100%;max-width:100%;background:${previewGradientBg};border-radius:18px;padding:4px;box-sizing:border-box;font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0 auto 42px auto;display:block;overflow:visible;`;
          return `<div${cleanAttrs ? ' ' + cleanAttrs : ''} style="${style}">`;
        }
        if (/\bwhite-paper\b/i.test(className)) {
          const style = `background-color:#ffffff;border-radius:16px;padding:44px 34px;color:#1e293b;line-height:1.78;box-sizing:border-box;width:100%;-webkit-font-smoothing:antialiased;overflow:visible;`;
          return `<div${cleanAttrs ? ' ' + cleanAttrs : ''} style="${style}">`;
        }
        return match;
      });
    }

    // ── 수익 최적화 통일 디자인 시스템 ──
    // 색상: 틸 #0d9488 (H2), 시안 #0891b2 (H3/링크)
    // 타이포: 18px / 1.85 / #1a1a1a / Noto Sans KR
    // 구조: 680px 폭 → 60~70자/줄 / 48px 섹션 간격
    // !important 필수 — WP 테마 오버라이드 방지

    // v3.8.78 (Agent A+B 2026 권장): 타이포 계층 재정립
    //   - H2 24px / H3 20px / P 17px (Material Design 3 CJK + 한국 GeneratePress 표준)
    //   - line-height 1.8 (CJK 권장 1.7-1.85 중앙값)
    //   - letter-spacing -0.01em (한국어 가독성)

    // v3.8.83: 전체 +2px 가독성 강화 (사용자 요청)
    // H2 - 틸 악센트, 26px (was 24px)
    styledHtml = styledHtml.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');

    styledHtml = styledHtml.replace(/<(div|section|aside|figure|figcaption|span)\b([^>]*)>/gi, (match, tag, attrs = '') => {
      const className = getClassNameFromAttrs(attrs);
      let style = '';

      if (tag.toLowerCase() === 'figure' && hasClass(className, /\bsection-image\b/i)) {
        style = 'width:100% !important;max-width:100% !important;margin:32px 0 40px 0 !important;padding:0 !important;box-sizing:border-box !important;display:block !important;';
      } else if (tag.toLowerCase() === 'figcaption') {
        style = 'text-align:center !important;font-size:13px !important;color:#64748b !important;-webkit-text-fill-color:#64748b !important;margin-top:10px !important;font-style:italic !important;line-height:1.5 !important;';
      } else if (hasClass(className, /\b(?:section-image-frame|bgpt-thumbnail-box)\b/i)) {
        style = 'width:100% !important;max-width:100% !important;aspect-ratio:16 / 9 !important;margin:0 !important;padding:0 !important;overflow:hidden !important;border-radius:10px !important;background:#f8fafc !important;box-sizing:border-box !important;display:block !important;';
      } else if (hasClass(className, /\b(?:ad-safe-zone|table-wrapper)\b/i)) {
        style = 'width:100% !important;max-width:100% !important;overflow:visible !important;margin:24px 0 !important;padding:0 !important;position:relative !important;isolation:isolate !important;contain:none !important;box-sizing:border-box !important;';
      } else if (hasClass(className, /\bsummary-container\b/i)) {
        style = `width:100% !important;max-width:100% !important;padding:0 !important;margin:28px 0 !important;background:transparent !important;border:0 !important;border-radius:0 !important;box-sizing:border-box !important;overflow:visible !important;`;
      } else if (hasClass(className, /\btoc-grid-container\b/i)) {
        style = 'margin:32px 0 !important;padding:0 !important;background:transparent !important;border-radius:0 !important;border:0 !important;box-sizing:border-box !important;width:100% !important;max-width:100% !important;overflow:visible !important;';
      } else if (hasClass(className, /\btoc-grid\b/i)) {
        style = 'display:flex !important;flex-direction:column !important;gap:8px !important;width:100% !important;box-sizing:border-box !important;';
      } else if (hasClass(className, /\btoc-number\b/i)) {
        style = `display:inline-flex !important;align-items:center !important;justify-content:center !important;width:26px !important;height:26px !important;min-width:26px !important;background:${previewPrimaryLight} !important;color:${previewPrimary} !important;-webkit-text-fill-color:${previewPrimary} !important;border-radius:999px !important;font-size:13px !important;font-weight:800 !important;flex-shrink:0 !important;line-height:1 !important;`;
      } else if (hasClass(className, /\bcta-box\b/i)) {
        style = `width:100% !important;max-width:100% !important;margin:32px auto !important;padding:18px 12px !important;display:flex !important;flex-direction:column !important;align-items:center !important;gap:12px !important;text-align:center !important;background:${previewCtaBg} !important;border:1px solid ${previewCtaBorder} !important;border-radius:10px !important;box-shadow:none !important;box-sizing:border-box !important;`;
      } else if (hasClass(className, /\bcta-badge\b/i)) {
        style = `display:inline-flex !important;align-items:center !important;justify-content:center !important;margin:0 !important;padding:5px 12px !important;background:${previewCtaBadgeBg} !important;color:${previewCtaNote} !important;-webkit-text-fill-color:${previewCtaNote} !important;border:1px solid ${previewCtaBorder} !important;border-radius:999px !important;font-size:12px !important;font-weight:800 !important;line-height:1.2 !important;`;
      } else if (hasClass(className, /\bcta-action-stack\b/i)) {
        style = 'display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;gap:8px !important;width:100% !important;max-width:100% !important;margin:0 auto !important;text-align:center !important;box-sizing:border-box !important;';
      } else if (hasClass(className, /\bcta-microcopy\b/i)) {
        style = `display:block !important;width:100% !important;margin:0 !important;color:${previewCtaNote} !important;-webkit-text-fill-color:${previewCtaNote} !important;font-size:12px !important;font-weight:600 !important;line-height:1.5 !important;opacity:.86 !important;text-align:center !important;`;
      } else if (hasClass(className, /\b(?:tldr-answer-box|eeat-meta-box|freshness-meta|wp-intro-card)\b/i)) {
        style = 'width:100% !important;max-width:100% !important;margin:24px 0 !important;padding:22px 24px !important;background:#f8fafc !important;border:1px solid #e2e8f0 !important;border-radius:12px !important;box-sizing:border-box !important;color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;';
      } else if (hasClass(className, /\bwp-section-card\b/i)) {
        style = 'width:100% !important;max-width:100% !important;margin:24px 0 !important;padding:28px 32px !important;background:#ffffff !important;border:1px solid #e2e8f0 !important;border-radius:12px !important;box-sizing:border-box !important;box-shadow:0 1px 3px rgba(0,0,0,0.04) !important;';
      } else if (hasClass(className, /\brv-share\b/i)) {
        style = 'margin:36px 0 16px !important;padding:20px 0 !important;border-top:1px solid #e2e8f0 !important;text-align:center !important;box-sizing:border-box !important;';
      } else if (hasClass(className, /\brv-share-label\b/i)) {
        style = 'font-size:13px !important;font-weight:600 !important;color:#64748b !important;-webkit-text-fill-color:#64748b !important;margin-bottom:12px !important;';
      } else if (hasClass(className, /\bdisclaimer\b/i)) {
        style = 'font-size:13px !important;color:#64748b !important;-webkit-text-fill-color:#64748b !important;background:#f8fafc !important;padding:20px !important;border-radius:12px !important;margin:32px 0 16px !important;line-height:1.7 !important;border:1px solid #e2e8f0 !important;box-sizing:border-box !important;';
      }

      return style ? openTagWithStyle(tag, attrs, style) : match;
    });

    styledHtml = styledHtml.replace(/<h1\b([^>]*)>/gi, (match, attrs) => {
      if (!usesFinalPreviewSkin) return match;
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      const style = `font-size: 32px !important; font-weight: 900 !important; color: ${previewHeading1} !important; -webkit-text-fill-color: ${previewHeading1} !important; margin: 0 0 24px 0 !important; line-height: 1.4 !important; word-break: keep-all !important;`;
      return `<h1${cleanAttrs ? ' ' + cleanAttrs : ''} style="${style}">`;
    });

    styledHtml = styledHtml.replace(/<h2\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (usesFinalPreviewSkin) {
        const previewH2Style = `color: ${previewPrimary} !important; -webkit-text-fill-color: ${previewPrimary} !important; font-size: 26px !important; font-weight: 800 !important; margin: 60px 0 25px 0 !important; padding: 0 0 0 18px !important; background: transparent !important; border-left: ${previewH2Border} !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; line-height: 1.4 !important; word-break: keep-all !important;`;
        return `<h2${cleanAttrs ? ' ' + cleanAttrs : ''} style="${previewH2Style}">`;
      }
      const newStyle = `color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 26px !important; font-weight: 800 !important; margin: 56px 0 24px 0 !important; padding: 18px 22px !important; background: #f0fdfa !important; border-left: 5px solid #0d9488 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 10px 10px 0 !important; line-height: 1.4 !important; letter-spacing: -0.02em !important;`;
      return `<h2${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // H3 - 시안 악센트, 22px (was 20px) — 단 sw-toc-header 클래스는 inline style 보존 (목차 핀 정렬)
    styledHtml = styledHtml.replace(/<h3\b([^>]*)>/gi, (match, attrs) => {
      // v3.8.83: 목차 H3는 inline style 그대로 유지 (📌 핀이 같은 줄에 표시되도록)
      if (/class\s*=\s*["'][^"']*sw-toc-header/i.test(attrs || '')) return match;
      const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
      const className = classMatch?.[2] || '';
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (/\bwp-info-box-title\b/i.test(className)) {
        const infoBoxTitleStyle = `color: #111827 !important; -webkit-text-fill-color: #111827 !important; font-size: 24px !important; font-weight: 800 !important; margin: 0 0 22px 0 !important; padding: 0 !important; border: 0 !important; line-height: 1.45 !important; letter-spacing: -0.01em !important; display: block !important; background: transparent !important;`;
        return `<h3${cleanAttrs ? ' ' + cleanAttrs : ''} style="${infoBoxTitleStyle}">`;
      }
      if (usesFinalPreviewSkin) {
        const previewH3Style = `font-size: 21px !important; font-weight: 700 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; margin: 30px 0 12px 0 !important; padding: 0 !important; letter-spacing: -0.01em !important; line-height: 1.45 !important; background: transparent !important; border: 0 !important; border-radius: 0 !important;`;
        return `<h3${cleanAttrs ? ' ' + cleanAttrs : ''} style="${previewH3Style}">`;
      }
      const newStyle = `color: #1e293b !important; -webkit-text-fill-color: #1e293b !important; font-size: 22px !important; font-weight: 700 !important; margin: 30px 0 12px 0 !important; padding: 10px 16px !important; background: transparent !important; border-left: 4px solid #0891b2 !important; border-top: none !important; border-right: none !important; border-bottom: none !important; border-radius: 0 !important; line-height: 1.4 !important;`;
      return `<h3${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // H4 — 20px (was 18px)
    styledHtml = styledHtml.replace(/<h4\b([^>]*)>/gi, (match, attrs) => {
      const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
      const className = classMatch?.[2] || '';
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (/\bwp-info-box-title\b/i.test(className)) {
        const infoBoxTitleStyle = `color: #111827 !important; -webkit-text-fill-color: #111827 !important; font-size: 24px !important; font-weight: 800 !important; margin: 0 0 22px 0 !important; padding: 0 !important; border: 0 !important; line-height: 1.45 !important; letter-spacing: -0.01em !important; display: block !important;`;
        return `<h4${cleanAttrs ? ' ' + cleanAttrs : ''} style="${infoBoxTitleStyle}">`;
      }
      const newStyle = `color: #334155 !important; font-size: 20px !important; font-weight: 700 !important; margin: 30px 0 14px 0 !important; padding-left: 14px !important; border-left: 3px solid #94a3b8 !important; line-height: 1.4 !important;`;
      return `<h4${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // P — 19px (was 17px) / line-height 1.8 (한국어 CJK 권장)
    styledHtml = styledHtml.replace(/<p\b([^>]*)>/gi, (match, attrs) => {
      const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
      const className = classMatch?.[2] || '';
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (/\b(?:cta-hook|cta-responsive-text)\b/i.test(className)) {
        const ctaHookStyle = `margin: 0 !important; color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-size: 16px !important; font-weight: 700 !important; line-height: 1.55 !important; word-break: keep-all !important; max-width: 92% !important;`;
        return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${ctaHookStyle}">`;
      }
      if (/\bwp-info-box-text\b/i.test(className)) {
        const infoBoxTextStyle = `color: #111827 !important; -webkit-text-fill-color: #111827 !important; font-size: 22px !important; line-height: 1.65 !important; margin: 0 0 14px 0 !important; word-break: keep-all !important; letter-spacing: -0.01em !important;`;
        return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${infoBoxTextStyle}">`;
      }
      if (usesFinalPreviewSkin) {
        const previewPStyle = `color: #1e293b !important; -webkit-text-fill-color: #1e293b !important; font-size: 16px !important; line-height: 1.72 !important; margin: 0 0 16px 0 !important; word-break: keep-all !important; overflow-wrap: break-word !important; letter-spacing: 0 !important;`;
        return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${previewPStyle}">`;
      }
      if (/\barticle-p\b/i.test(className)) {
        const articleStyle = `color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 16px !important; line-height: 1.72 !important; margin: 0 0 16px 0 !important; word-break: keep-all !important; overflow-wrap: break-word !important; letter-spacing: 0 !important;`;
        return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${articleStyle}">`;
      }
      const newStyle = `color: #1a1a1a !important; -webkit-text-fill-color: #1a1a1a !important; font-size: 16px !important; line-height: 1.72 !important; margin: 0 0 16px 0 !important; word-break: keep-all !important; overflow-wrap: break-word !important; letter-spacing: 0 !important;`;
      return `<p${cleanAttrs ? ' ' + cleanAttrs : ''} style="${newStyle}">`;
    });

    // Strong/B
    styledHtml = styledHtml.replace(/<strong\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (usesFinalPreviewSkin) {
        return `<strong${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: ${previewPrimary} !important; -webkit-text-fill-color: ${previewPrimary} !important; font-weight: 700 !important; background: linear-gradient(180deg, transparent 60%, ${previewPrimaryLight} 40%) !important;">`;
      }
      return `<strong${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
    });

    styledHtml = styledHtml.replace(/<b\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (usesFinalPreviewSkin) {
        return `<b${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: ${previewPrimary} !important; -webkit-text-fill-color: ${previewPrimary} !important; font-weight: 700 !important; background: linear-gradient(180deg, transparent 60%, ${previewPrimaryLight} 40%) !important;">`;
      }
      return `<b${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0f172a !important; -webkit-text-fill-color: #0f172a !important; font-weight: 700 !important;">`;
    });

    // 이미지
    styledHtml = styledHtml.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
      const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
      const className = classMatch?.[2] || '';
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (/\b(?:emoji|wp-smiley)\b/i.test(className)) {
        return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} style="display: inline-block !important; width: 1.1em !important; max-width: 1.1em !important; height: 1.1em !important; aspect-ratio: auto !important; object-fit: contain !important; margin: 0 0.35em 0 0 !important; border-radius: 0 !important; vertical-align: -0.15em !important;">`;
      }
      return `<img${cleanAttrs ? ' ' + cleanAttrs : ''} style="display: block !important; width: 100% !important; max-width: 100% !important; aspect-ratio: 16 / 9 !important; height: auto !important; object-fit: cover !important; margin: 32px auto !important; border-radius: 8px !important;">`;
    });

    // 테이블 — 🔥 모바일 반응형 + min-width 금지 + word-break (AdSense 광고 주입 방지 위해 class 보존)
    styledHtml = styledHtml.replace(/<table\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<table${cleanAttrs ? ' ' + cleanAttrs : ''} style="width:100% !important;min-width:0 !important;max-width:100% !important;border-collapse:separate !important;border-spacing:0 !important;margin:0 !important;border-radius:10px !important;overflow:hidden !important;border:1px solid #dbe4ee !important;background:#ffffff !important;table-layout:fixed !important;box-sizing:border-box !important;">`;
    });

    // v3.8.83: TH 17px (was 15px), TD 18px (was 16px) — +2px 가독성 강화
    styledHtml = styledHtml.replace(/<th\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<th${cleanAttrs ? ' ' + cleanAttrs : ''} style="min-width:0 !important;padding:10px 12px !important;background:#f1f5f9 !important;color:#0f172a !important;-webkit-text-fill-color:#0f172a !important;font-weight:700 !important;text-align:left !important;font-size:13px !important;line-height:1.45 !important;border:1px solid #cbd5e1 !important;border-bottom:2px solid #cbd5e1 !important;white-space:normal !important;word-break:keep-all !important;overflow-wrap:break-word !important;">`;
    });

    styledHtml = styledHtml.replace(/<td\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<td${cleanAttrs ? ' ' + cleanAttrs : ''} style="min-width:0 !important;padding:10px 12px !important;border:1px solid #dbe4ee !important;color:#334155 !important;font-size:13px !important;line-height:1.45 !important;white-space:normal !important;word-break:keep-all !important;overflow-wrap:break-word !important;">`;
    });
    styledHtml = wrapWordPressTables(styledHtml);

    // 리스트
    styledHtml = styledHtml.replace(/<ul\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<ul${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 18px 0 !important; padding: 18px 20px 18px 30px !important; background: #fafafa !important; border-left: 3px solid #dbe4ee !important; border-radius: 0 6px 6px 0 !important; list-style-position: outside !important;">`;
    });

    styledHtml = styledHtml.replace(/<ol\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<ol${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 18px 0 !important; padding: 18px 20px 18px 30px !important; background: #fafafa !important; border-left: 3px solid #dbe4ee !important; border-radius: 0 6px 6px 0 !important; list-style-position: outside !important;">`;
    });

    // v3.8.83: LI 16→18px (+2px 가독성 강화), line-height 1.8 (CJK)
    styledHtml = styledHtml.replace(/<li\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<li${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 0 0 10px 0 !important; padding-left: 4px !important; line-height: 1.72 !important; font-size: 15.5px !important; color: #1a1a1a !important; letter-spacing: 0 !important; overflow-wrap: break-word !important;">`;
    });

    // 인용구
    styledHtml = styledHtml.replace(/<blockquote\b([^>]*)>/gi, (match, attrs) => {
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      return `<blockquote${cleanAttrs ? ' ' + cleanAttrs : ''} style="margin: 28px 0 !important; padding: 20px 24px !important; background: #f8fafc !important; border-left: 4px solid #94a3b8 !important; border-radius: 0 6px 6px 0 !important; font-style: normal !important; font-size: 15.5px !important; line-height: 1.72 !important; color: #334155 !important;">`;
    });

    // 링크 - 시안 악센트
    styledHtml = styledHtml.replace(/<a\b([^>]*)>/gi, (match, attrs = '') => {
      const styleMatch = attrs.match(/\sstyle\s*=\s*(["'])([\s\S]*?)\1/i);
      const classMatch = attrs.match(/\sclass\s*=\s*(["'])([\s\S]*?)\1/i);
      const existingStyle = styleMatch?.[2] || '';
      const className = classMatch?.[2] || '';
      if (/\bwp-info-box-link\b/i.test(className)) {
        const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
        return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #dc2626 !important; -webkit-text-fill-color: #dc2626 !important; text-decoration: underline !important; border-bottom: 0 !important; font-weight: 700 !important;">`;
      }
      if (/\btoc-btn\b/i.test(className)) {
        const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
        const tocStyle = `background:#ffffff !important;border:1px solid #e2e8f0 !important;padding:14px 16px !important;border-radius:10px !important;text-align:left !important;font-weight:700 !important;color:#475569 !important;-webkit-text-fill-color:#475569 !important;text-decoration:none !important;display:flex !important;align-items:center !important;gap:10px !important;width:100% !important;box-sizing:border-box !important;box-shadow:0 2px 4px rgba(0,0,0,0.02) !important;line-height:1.45 !important;`;
        return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="${tocStyle}">`;
      }
      if (/\b(?:cta-btn|cta-responsive-button|button|btn|sw-btn|toc-nav-item)\b/i.test(className) || /\srole\s*=\s*(["'])button\1/i.test(attrs)) {
        const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
        const buttonStyle = `display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:220px !important;max-width:100% !important;min-height:48px !important;margin:2px auto 0 !important;padding:14px 28px !important;background:linear-gradient(135deg,${previewCtaButtonStart} 0%,${previewCtaButtonEnd} 100%) !important;color:#ffffff !important;-webkit-text-fill-color:#ffffff !important;border:0 !important;border-radius:8px !important;text-decoration:none !important;border-bottom:0 !important;font-size:16px !important;font-weight:800 !important;line-height:1.35 !important;box-shadow:0 8px 18px ${previewCtaShadow} !important;box-sizing:border-box !important;white-space:normal !important;word-break:keep-all !important;`;
        return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="${buttonStyle}">`;
      }
      const looksLikeButton = /\b(?:cta|button|btn|sw-btn|toc-nav-item)\b/i.test(className)
        || /(?:background(?:-color)?\s*:|border-radius\s*:|padding\s*:|display\s*:\s*(?:inline-)?block|box-shadow\s*:)/i.test(existingStyle);
      if (looksLikeButton) return match;
      const cleanAttrs = attrs.replace(/style\s*=\s*["'][^"']*["']/gi, '').trim();
      if (usesFinalPreviewSkin) {
        return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: ${previewPrimary} !important; -webkit-text-fill-color: ${previewPrimary} !important; text-decoration: underline !important; border-bottom: 0 !important; font-weight: 700 !important;">`;
      }
      return `<a${cleanAttrs ? ' ' + cleanAttrs : ''} style="color: #0891b2 !important; -webkit-text-fill-color: #0891b2 !important; text-decoration: none !important; border-bottom: 1px solid #99f6e4 !important; font-weight: 600 !important;">`;
    });

    // v3.8.37: 거미줄 통합글(sw-cornerstone)은 카드 래핑 skip — 미리보기 디자인 보존.
    //   기존엔 모든 WP 발행물에 wp-section-card 자동 wrap → 거미줄 sw-cornerstone HTML도
    //   카드로 분할되어 미리보기와 실제 발행이 달라졌음.
    //   sw-cornerstone 또는 max-mode-article 클래스 감지 시 wrap skip.
    //   inline style 보강(p/h2/a 등) + CSS 주입은 그대로 유지 (WP 테마 무관 표시 보장).
    if (!/\b(sw-cornerstone|max-mode-article|bgpt-content|gradient-frame|white-paper)\b/.test(styledHtml)) {
      styledHtml = wrapSectionsInCards(styledHtml);
    } else {
      console.log('[WP-PUBLISH] sw-cornerstone/max-mode-article 감지 → 카드 래핑 skip (미리보기 디자인 보존)');
    }

    // 수익 최적화 CSS — 통일 디자인
    const themeFriendlyCSS = `
<style>
  /* 수익 최적화 WordPress 레이아웃 v3.8.78 (2026 모바일 가독성 + AdSense 권장)
     - max-width 720px (60-70자/줄, GeneratePress 표준)
     - font 17px / line-height 1.8 (CJK 권장)
     - Pretendard 우선 (HTTP Archive 2024 한국 최다 사용) → Noto Sans KR → 시스템 폴백 */
  .wp-styled-content {
    max-width: 760px !important;
    margin: 0 auto !important;
    padding: 20px 18px !important;
    box-sizing: border-box !important;
    font-family: 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
    font-size: 16px !important;
    line-height: 1.72 !important;
    color: #1a1a1a !important;
    word-break: keep-all !important;
    background: #ffffff !important;
    letter-spacing: 0 !important;
  }
  /* v3.8.78: 도입부 카드 P 정렬 — 첫 P margin-top 0, 마지막 P margin-bottom 0 */
  .wp-intro-card > p:first-child { margin-top: 0 !important; }
  .wp-intro-card > p:last-child { margin-bottom: 0 !important; }
  /* v3.8.78: 광고 전후 단락 margin 제거 (광고 공백 누적 차단) */
  .wp-styled-content ins.adsbygoogle + p,
  .wp-styled-content p + ins.adsbygoogle,
  .wp-styled-content .adsbygoogle + p,
  .wp-styled-content p:has(+ .adsbygoogle) { margin-top: 8px !important; margin-bottom: 8px !important; }
  /* v3.8.83: TL;DR 박스 안 ul/li가 회색 sub-box로 분리 보이던 문제 차단 — 노란 박스 한 덩어리로 통합 */
  .wp-styled-content .tldr-answer-box ul,
  .wp-styled-content .tldr-answer-box ol {
    background: transparent !important;
    border: none !important;
    border-left: none !important;
    border-radius: 0 !important;
    padding: 0 0 0 20px !important;
    margin: 0 !important;
  }
  .wp-styled-content .tldr-answer-box li {
    background: transparent !important;
    color: #1e293b !important;
    font-size: 16px !important;
    line-height: 1.8 !important;
  }
  .wp-styled-content .tldr-answer-box li::marker { color: #b45309 !important; }
  .wp-styled-content .tldr-answer-box p { color: #0f172a !important; }

  /* v3.8.78: TL;DR / E-E-A-T / CTA 박스 내부 광고 차단 */
  .wp-styled-content .tldr-answer-box ins,
  .wp-styled-content .tldr-answer-box .adsbygoogle,
  .wp-styled-content .eeat-meta-box ins,
  .wp-styled-content .eeat-meta-box .adsbygoogle,
  .wp-styled-content .freshness-meta ins,
  .wp-styled-content .freshness-meta .adsbygoogle,
  .wp-styled-content [class*="cta"] ins,
  .wp-styled-content [class*="cta"] .adsbygoogle {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important; height: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
  }
  .wp-styled-content * {
    box-sizing: border-box !important;
  }

  /* WordPress info boxes: keep prompt class boxes visible after real publishing. */
  .wp-styled-content .data-box,
  .wp-styled-content .highlight,
  .wp-styled-content .warning,
  .wp-styled-content .success,
  .wp-styled-content .checklist,
  .wp-styled-content .quote {
    width: 100% !important;
    max-width: 100% !important;
    margin: 24px 0 !important;
    padding: 24px 28px !important;
    box-sizing: border-box !important;
    display: block !important;
    visibility: visible !important;
    word-break: keep-all !important;
  }
  .wp-styled-content .data-box {
    background: #dbeafe !important;
    border-left: 5px solid #2563eb !important;
    border-radius: 0 12px 12px 0 !important;
    color: #111827 !important;
  }
  .wp-styled-content .wp-info-box-title {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 24px !important;
    font-weight: 800 !important;
    margin: 0 0 22px 0 !important;
    padding: 0 !important;
    border: 0 !important;
    line-height: 1.45 !important;
  }
  .wp-styled-content .wp-info-box-text {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    font-size: 22px !important;
    line-height: 1.65 !important;
    margin: 0 0 14px 0 !important;
  }
  .wp-styled-content .wp-info-box-link {
    color: #dc2626 !important;
    -webkit-text-fill-color: #dc2626 !important;
    text-decoration: underline !important;
    border-bottom: 0 !important;
    font-weight: 700 !important;
  }
  .wp-styled-content img.emoji,
  .wp-styled-content img.wp-smiley {
    display: inline-block !important;
    width: 1.1em !important;
    max-width: 1.1em !important;
    height: 1.1em !important;
    aspect-ratio: auto !important;
    object-fit: contain !important;
    margin: 0 0.35em 0 0 !important;
    border-radius: 0 !important;
    vertical-align: -0.15em !important;
  }

  /* WordPress CTA: keep hook/button close and force real clickable button styling. */
  .wp-styled-content .cta-box,
  .wp-styled-content .cta-responsive-box {
    width: 100% !important;
    max-width: 100% !important;
    margin: 32px auto !important;
    padding: 26px 24px !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 12px !important;
    text-align: center !important;
    background: linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%) !important;
    border: 1px solid #93c5fd !important;
    border-radius: 10px !important;
    box-shadow: none !important;
  }
  .wp-styled-content .cta-box p,
  .wp-styled-content .cta-box .cta-hook,
  .wp-styled-content .cta-responsive-box p,
  .wp-styled-content .cta-responsive-text {
    margin: 0 !important;
    color: #0f172a !important;
    -webkit-text-fill-color: #0f172a !important;
    font-size: 16px !important;
    font-weight: 700 !important;
    line-height: 1.55 !important;
    word-break: keep-all !important;
    max-width: 92% !important;
  }
  .wp-styled-content .cta-box .cta-badge {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 5px 12px !important;
    background: #eff6ff !important;
    color: #0369a1 !important;
    -webkit-text-fill-color: #0369a1 !important;
    border: 1px solid #bae6fd !important;
    border-radius: 999px !important;
    font-size: 12px !important;
    font-weight: 800 !important;
    line-height: 1.2 !important;
  }
  .wp-styled-content .cta-box .cta-microcopy {
    display: block !important;
    margin: 0 !important;
    color: #0369a1 !important;
    -webkit-text-fill-color: #0369a1 !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    line-height: 1.5 !important;
    opacity: .86 !important;
  }
  .wp-styled-content .cta-box a,
  .wp-styled-content .cta-responsive-box a,
  .wp-styled-content a.cta-btn,
  .wp-styled-content a.cta-responsive-button,
  .wp-styled-content [class*="cta"] a[role="button"] {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 220px !important;
    max-width: 100% !important;
    min-height: 48px !important;
    margin: 2px auto 0 !important;
    padding: 14px 28px !important;
    background: linear-gradient(135deg, #0891b2 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
    border: 0 !important;
    border-radius: 8px !important;
    text-decoration: none !important;
    border-bottom: 0 !important;
    font-size: 16px !important;
    font-weight: 800 !important;
    line-height: 1.35 !important;
    box-shadow: 0 8px 18px rgba(2,132,199,0.28) !important;
    box-sizing: border-box !important;
    white-space: normal !important;
    word-break: keep-all !important;
  }

  /* WordPress 이미지: 항상 본문 폭 100% + 16:9 와이드 프레임 */
  .wp-styled-content figure.section-image {
    width: 100% !important;
    max-width: 100% !important;
    margin: 32px 0 40px 0 !important;
    padding: 0 !important;
  }
  .wp-styled-content .bgpt-thumbnail-box,
  .wp-styled-content .section-image-frame {
    width: 100% !important;
    max-width: 100% !important;
    aspect-ratio: 16 / 9 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    border-radius: 10px !important;
    background: #f8fafc !important;
  }
  .wp-styled-content .bgpt-thumbnail-box img,
  .wp-styled-content .section-image-frame img {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    aspect-ratio: 16 / 9 !important;
    object-fit: cover !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }
  .wp-styled-content figure.section-image > img {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    aspect-ratio: 16 / 9 !important;
    object-fit: cover !important;
    margin: 0 !important;
    border-radius: 10px !important;
  }
  .wp-styled-content figure.section-image figcaption {
    margin-top: 10px !important;
  }

  .wp-styled-content .wp-table-scroll {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: visible !important;
    margin: 22px 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  .wp-styled-content .wp-table-scroll table,
  .wp-styled-content table.wp-mobile-table {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    table-layout: fixed !important;
  }
  .wp-styled-content .wp-table-scroll::-webkit-scrollbar {
    height: 7px !important;
  }
  .wp-styled-content .wp-table-scroll::-webkit-scrollbar-thumb {
    background: #cbd5e1 !important;
    border-radius: 999px !important;
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
    padding: 24px 28px !important;
    margin: 0 0 28px 0 !important;
  }
  /* v3.8.78: CTA 박스 모바일 48px 터치 타깃 + 풀폭 버튼 (WCAG 2.5.5) */
  @media screen and (max-width: 768px) {
    .wp-styled-content [class*="cta"] a,
    .wp-styled-content a[style*="background:linear-gradient(135deg,#ef4444"],
    .wp-styled-content a[style*="background-color:#ef4444"] {
      display: block !important;
      width: 100% !important;
      min-height: 48px !important;
      padding: 16px 20px !important;
      font-size: 16px !important;
      box-sizing: border-box !important;
    }
  }

  /* 모바일 (≤768px) */
  @media screen and (max-width: 768px) {
    .wp-styled-content {
      width: 100vw !important;
      max-width: 100vw !important;
      min-width: 0 !important;
      padding: 18px 10px 52px !important;
      margin-left: calc(50% - 50vw) !important;
      margin-right: calc(50% - 50vw) !important;
    }
    .wp-styled-content .bgpt-content,
    .wp-styled-content .gradient-frame,
    .wp-styled-content .white-paper {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
    }
    .wp-styled-content .bgpt-content {
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .wp-styled-content .gradient-frame {
      border-radius: 0 !important;
      padding: 0 !important;
      margin: 18px 0 28px !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    .wp-styled-content .white-paper {
      border-radius: 0 !important;
      padding: 20px 6px 44px !important;
      background: #ffffff !important;
      border: 0 !important;
      box-shadow: none !important;
    }
    .wp-section-card,
    .wp-intro-card {
      padding: 0 !important;
      margin: 24px 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    .wp-section-card::before {
      display: none !important;
    }
    .wp-styled-content .data-box,
    .wp-styled-content .highlight,
    .wp-styled-content .warning,
    .wp-styled-content .success,
    .wp-styled-content .checklist,
    .wp-styled-content .quote,
    .wp-styled-content .cta-box,
    .wp-styled-content .cta-responsive-box {
      max-width: 100% !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding: 14px 12px !important;
      border-radius: 10px !important;
      box-sizing: border-box !important;
    }
    .wp-styled-content .wp-info-box-title {
      font-size: 18px !important;
      line-height: 1.45 !important;
      margin-bottom: 12px !important;
    }
    .wp-styled-content .wp-info-box-text {
      font-size: 16px !important;
      line-height: 1.75 !important;
    }
    /* v3.8.83 모바일 (≤768px): 데스크탑 +2px 반영 */
    .wp-styled-content h2 {
      font-size: 24px !important;
      padding: 14px 18px !important;
      margin: 40px 0 18px 0 !important;
    }
    .wp-styled-content h3 {
      font-size: 21px !important;
      padding: 10px 14px !important;
      margin: 28px 0 14px 0 !important;
    }
    .wp-styled-content p {
      font-size: 16px !important;
      line-height: 1.72 !important;
      margin: 0 0 15px 0 !important;
      letter-spacing: 0 !important;
      overflow-wrap: break-word !important;
    }
    .wp-styled-content li {
      font-size: 15.5px !important;
    }
    .wp-styled-content table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      font-size: 14px !important;
      table-layout: fixed !important;
    }
    .wp-styled-content .wp-table-scroll {
      width: 100% !important;
      max-width: 100% !important;
      margin: 22px 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
    }
    .wp-styled-content .wp-table-scroll table,
    .wp-styled-content table.wp-mobile-table,
    .wp-styled-content .wp-table-scroll tbody,
    .wp-styled-content table.wp-mobile-table tbody,
    .wp-styled-content .wp-table-scroll tr,
    .wp-styled-content table.wp-mobile-table tr,
    .wp-styled-content .wp-table-scroll td,
    .wp-styled-content table.wp-mobile-table td {
      display: block !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .wp-styled-content .wp-table-scroll thead,
    .wp-styled-content table.wp-mobile-table thead {
      display: none !important;
    }
    .wp-styled-content .wp-table-scroll table,
    .wp-styled-content table.wp-mobile-table {
      border: 0 !important;
      border-radius: 0 !important;
      overflow: visible !important;
      background: transparent !important;
    }
    .wp-styled-content .wp-table-scroll tr,
    .wp-styled-content table.wp-mobile-table tr {
      margin: 0 0 12px 0 !important;
      border: 1px solid #dbe4ee !important;
      border-radius: 12px !important;
      background: #ffffff !important;
      overflow: hidden !important;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05) !important;
    }
    .wp-styled-content .wp-table-scroll td,
    .wp-styled-content table.wp-mobile-table td {
      min-width: 0 !important;
      padding: 12px 14px !important;
      border: 0 !important;
      border-bottom: 1px solid #edf2f7 !important;
      color: #334155 !important;
      font-size: 14px !important;
      line-height: 1.55 !important;
      white-space: normal !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
      text-align: left !important;
    }
    .wp-styled-content .wp-table-scroll td:last-child,
    .wp-styled-content table.wp-mobile-table td:last-child {
      border-bottom: 0 !important;
    }
    .wp-styled-content .wp-table-scroll td::before,
    .wp-styled-content table.wp-mobile-table td::before {
      content: attr(data-label) !important;
      display: block !important;
      margin: 0 0 5px 0 !important;
      color: #0f766e !important;
      -webkit-text-fill-color: #0f766e !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1.35 !important;
    }
    .wp-styled-content .wp-table-scroll td[data-label=""]::before,
    .wp-styled-content table.wp-mobile-table td[data-label=""]::before {
      display: none !important;
    }
    /* 🛡️ AdSense Ad-Safe Zone — 표/CTA 내부 광고 주입 차단 */
    .wp-styled-content .ad-safe-zone,
    .wp-styled-content .table-wrapper {
      isolation: isolate !important;
      contain: none !important;
      overflow: visible !important;
    }
    .wp-styled-content img {
      width: 100% !important;
      max-width: 100% !important;
      aspect-ratio: 16 / 9 !important;
      object-fit: cover !important;
    }
  }

  /* 소형 화면 (≤375px) */
  @media screen and (max-width: 375px) {
    .wp-styled-content {
      padding: 16px 8px 48px !important;
    }
    .wp-styled-content h2 { font-size: 18px !important; }
    .wp-styled-content h3 { font-size: 16px !important; }
    .wp-styled-content p { font-size: 15.5px !important; line-height: 1.7 !important; }
    .wp-styled-content .white-paper { padding: 18px 4px 42px !important; }
    .wp-section-card,
    .wp-intro-card {
      padding-left: 0 !important;
      padding-right: 0 !important;
    }
    .wp-styled-content .data-box,
    .wp-styled-content .highlight,
    .wp-styled-content .warning,
    .wp-styled-content .success,
    .wp-styled-content .checklist,
    .wp-styled-content .quote,
    .wp-styled-content .cta-box,
    .wp-styled-content .cta-responsive-box {
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    .wp-styled-content .wp-table-scroll {
      width: 100% !important;
      max-width: 100% !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
    }
    .wp-styled-content .wp-table-scroll td,
    .wp-styled-content table.wp-mobile-table td {
      padding: 11px 12px !important;
      font-size: 13.5px !important;
    }
  }

  /* 🛡️ AdSense Ad-Safe Zone — 데스크탑/모바일 공통 */
  .wp-styled-content .ad-safe-zone,
  .wp-styled-content .table-wrapper {
    position: relative !important;
    isolation: isolate !important;
    contain: none !important;
    overflow: visible !important;
  }
  .wp-styled-content .ad-safe-zone[data-ad-region="no-ad"] {
    /* AdSense 크롤러 시그널: 이 블록 내부에는 광고 삽입 불가 */
  }

  /* v3.7.9 fix — summary-table 컬럼 강제 고정.
     문제: WP 테마/KSES가 inline width를 통과시켜도 table-layout:auto면
     긴 셀이 wrapper 밖으로 튀어나가 우측 오버플로우 발생. fixed로 강제. */
  .wp-styled-content .summary-table {
    table-layout: fixed !important;
  }
  .wp-styled-content .summary-table th:first-child,
  .wp-styled-content .summary-table td:first-child {
    width: 35% !important;
  }
  .wp-styled-content .summary-table th:nth-child(2),
  .wp-styled-content .summary-table td:nth-child(2) {
    width: 65% !important;
  }
  .wp-styled-content .summary-table th,
  .wp-styled-content .summary-table td {
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
    white-space: normal !important;
  }

  /* v3.7.18 fix — 요약표 셀 광고 강제 차단.
     문제: 워드프레스 자동 광고/테마 광고 슬롯이 표 td 안에 광고 iframe·ins·div를
     삽입하면 셀이 광고 폭에 맞춰 늘어나고 실제 텍스트는 우측 좁은 공간에 세로로 흘러내림.
     해결: 셀 안에 들어온 광고성 element를 시각적·물리적으로 0 크기로 강제. */
  .wp-styled-content .summary-table td ins,
  .wp-styled-content .summary-table td iframe,
  .wp-styled-content .summary-table td .adsbygoogle,
  .wp-styled-content .summary-table td [class*="adsbygoogle"],
  .wp-styled-content .summary-table td [class*="ad-container"],
  .wp-styled-content .summary-table td [class*="adsense"],
  .wp-styled-content .summary-table td [class*="advertisement"],
  .wp-styled-content .summary-table td [class*="googleads"],
  .wp-styled-content .summary-table td [class*="google_ads"],
  .wp-styled-content .summary-table td [id*="adsense"],
  .wp-styled-content .summary-table td [id*="google_ads"],
  .wp-styled-content .summary-table td [id*="advertisement"],
  .wp-styled-content .summary-table td [data-ad],
  .wp-styled-content .summary-table td [data-ad-slot],
  .wp-styled-content .summary-table td [data-ad-client],
  .wp-styled-content .summary-table td script {
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    max-width: 0 !important;
    max-height: 0 !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow: hidden !important;
    position: absolute !important;
    left: -9999px !important;
    top: -9999px !important;
    pointer-events: none !important;
  }
  /* 표 cell 자체의 폭 강제 — 광고가 어떻게든 들어와도 셀이 늘어나지 않도록 */
  .wp-styled-content .summary-table {
    contain: layout style !important;
  }
  .wp-styled-content .summary-table td {
    max-width: 65% !important;
    contain: layout !important;
  }
  .wp-styled-content .summary-table td:first-child {
    max-width: 35% !important;
  }
  @media screen and (max-width: 768px) {
    .wp-styled-content .summary-container {
      padding: 0 !important;
      margin: 26px 0 !important;
      background: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    .wp-styled-content .summary-table,
    .wp-styled-content .summary-table tbody,
    .wp-styled-content .summary-table tr,
    .wp-styled-content .summary-table td {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      box-sizing: border-box !important;
      contain: none !important;
    }
    .wp-styled-content .summary-table {
      table-layout: fixed !important;
      border: 0 !important;
      border-radius: 0 !important;
      overflow: visible !important;
      background: transparent !important;
    }
    .wp-styled-content .summary-table thead {
      display: none !important;
    }
    .wp-styled-content .summary-table tr {
      margin: 0 0 12px 0 !important;
      border: 1px solid #dbe4ee !important;
      border-radius: 12px !important;
      background: #ffffff !important;
      overflow: hidden !important;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05) !important;
    }
    .wp-styled-content .summary-table td,
    .wp-styled-content .summary-table td:first-child,
    .wp-styled-content .summary-table td:nth-child(2) {
      width: 100% !important;
      max-width: 100% !important;
      padding: 12px 14px !important;
      border: 0 !important;
      border-bottom: 1px solid #edf2f7 !important;
      font-size: 14px !important;
      line-height: 1.55 !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
    }
    .wp-styled-content .summary-table td:last-child {
      border-bottom: 0 !important;
    }
    .wp-styled-content .summary-table td::before {
      content: attr(data-label) !important;
      display: block !important;
      margin: 0 0 5px 0 !important;
      color: #0f766e !important;
      -webkit-text-fill-color: #0f766e !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      line-height: 1.35 !important;
    }
    .wp-styled-content .summary-table td[data-label=""]::before {
      display: none !important;
    }
  }
</style>
`;

    // v3.8.83: 사용자 요청 후처리
    // (a) 표 위 빈 캡션/빈 첫 행 제거 — LLM이 가끔 표 위에 빈 분홍 배경 줄을 만듦
    styledHtml = styledHtml.replace(/<caption\b[^>]*>\s*<\/caption>/gi, '');
    styledHtml = styledHtml
      .replace(/(<table\b[^>]*>\s*<thead\b[^>]*>\s*)<tr\b[^>]*>\s*(?:<t[hd]\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/t[hd]>\s*)+<\/tr>\s*/gi, '$1')
      .replace(/(<table\b[^>]*>\s*(?:<tbody\b[^>]*>\s*)?)<tr\b[^>]*>\s*(?:<t[hd]\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/t[hd]>\s*)+<\/tr>\s*/gi, '$1')
      .replace(/<thead\b[^>]*>\s*<\/thead>/gi, '');
    // (a-2) 본문 중간의 빈 문단/연속 줄바꿈/빈 스페이서 제거 — WordPress 자동 공백 과다 방지
    styledHtml = styledHtml
      .replace(/<p\b[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*\s*<\/p>/gi, '')
      .replace(/<div\b[^>]*(?:height\s*:|min-height\s*:|clear\s*:|margin\s*:)[^>]*>\s*(?:&nbsp;|\s|<br\s*\/?>)*<\/div>/gi, '')
      .replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br>')
      .replace(/(<\/(?:p|div|h[1-6]|ul|ol|table|figure)>)\s*(?:<br\s*\/?>\s*)+/gi, '$1')
      .replace(/(?:<br\s*\/?>\s*)+(?=<(?:p|div|h[1-6]|ul|ol|table|figure)\b)/gi, '');
    // (b) CTA 버튼 텍스트 끝 "보기 🔥" / " 🔥" 정리 — 단순 박스 버튼만
    styledHtml = styledHtml.replace(/(<a\b[^>]*>)([^<]*?)\s*🔥\s*(<\/a>)/gi, '$1$2$3');
    // (c) CTA 위/아래에 있는 "보기 🔥" / "더보기 🔥" 단독 p/span 라인 제거
    styledHtml = styledHtml.replace(/<(p|span|div)[^>]*>\s*(?:보기|더보기|자세히\s*보기|상세\s*보기)\s*🔥?\s*<\/\1>/gi, '');
    styledHtml = styledHtml.replace(/(<\/(?:div|aside)>)\s*(?:보기|더보기|자세히\s*보기|상세\s*보기)\s*🔥/gi, '$1');

    // 컨테이너 스타일
    const containerStyle = usesFinalPreviewSkin
      ? `max-width: 100%; width: 100%; margin: 0; padding: 0; box-sizing: border-box; font-family: 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; word-break: keep-all; background: transparent; letter-spacing: 0;`
      : `max-width: 760px; margin: 0 auto; padding: 20px 18px; box-sizing: border-box; font-family: 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 16px; line-height: 1.72; color: #1a1a1a; word-break: keep-all; background: #ffffff; letter-spacing: 0;`;

    const wrappedContent = `${themeFriendlyCSS}<div class="wp-styled-content bgpt-wp-ready" data-bgpt-wp-ready="true" style="${containerStyle}">${styledHtml}</div>`;

    // Gutenberg HTML 블록
    styledHtml = `<!-- wp:html -->
${wrappedContent}
<!-- /wp:html -->`;

    console.log('[WP-PUBLISH] WordPress mobile-friendly styles applied (100vw/clamp/1.72/table-scroll)');
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

      repairPublishInputBrokenText(options);

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

      // v3.8.94: featuredImageUrl 누락/실패 시 본문 첫 img를 자동 추출 (사용자 보고: 농어촌 글 썸네일 비어 보임)
      const resolveFeaturedUrl = (): string => {
        if (options.featuredImageUrl) return options.featuredImageUrl;
        const m = String(optimizedContent || '').match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        const candidate = m?.[1]?.trim() || '';
        if (candidate && /^https?:\/\//i.test(candidate)) {
          console.log(`[WP-PUBLISH] 🖼️ featuredImageUrl 누락 — 본문 첫 img를 대표로 채택: ${candidate.slice(0, 60)}...`);
          return candidate;
        }
        return '';
      };
      const featuredSrc = resolveFeaturedUrl();

      if (featuredSrc) {
        console.log(`[WP-PUBLISH] 🖼️ 대표 이미지 업로드 시도: ${featuredSrc.substring(0, 50)}...`);
        try {
          const response = await fetch(featuredSrc);
          if (!response.ok) throw new Error(`이미지 다운로드 실패: ${response.status}`);
          const imageBuffer = await response.arrayBuffer();

          const uploadedMedia = await this.wpApi.uploadMedia(imageBuffer, `${Date.now()}-thumbnail.jpg`, options.title);
          if (uploadedMedia && uploadedMedia.id) {
            featuredMediaId = uploadedMedia.id;
            console.log(`[WP-PUBLISH] ✅ 대표 이미지 업로드 성공 (Media ID: ${featuredMediaId})`);
          }
        } catch (mediaError: any) {
          console.error(`[WP-PUBLISH] ❌ 대표 이미지 업로드 실패:`, mediaError.message);
        }
      } else {
        console.log(`[WP-PUBLISH] ⚠️ 대표 이미지 후보 없음 (featuredImageUrl + 본문 첫 img 모두 비어있음)`);
      }

      // v3.8.94: 본문 sanitizer — src 빈/data:image(<200자, 즉 placeholder)/javascript: img 제거
      optimizedContent = optimizedContent
        .replace(/<img\b[^>]*\bsrc=["']\s*["'][^>]*>/gi, '')
        .replace(/<img\b[^>]*\bsrc=["']javascript:[^"']*["'][^>]*>/gi, '')
        .replace(/<img\b[^>]*\bsrc=["']data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{0,200}["'][^>]*>/gi, '')
        .replace(/<figure[^>]*>\s*(?:<a[^>]*>)?\s*(?:<\/a>)?\s*<\/figure>/gi, '');

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
      // v3.8.68 (Phase 2 작업 7): 사용자 선택 없으면 AI가 기존 카테고리 분석 → 자동 매칭
      if ((!options.categories || options.categories.length === 0) && options.geminiKey) {
        try {
          const existingCats = await this.wpApi.getCategories();
          const catNames = existingCats.slice(0, 60).map(c => c.name).filter(Boolean);
          if (catNames.length > 0) {
            const plainBody = (options.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const aiCatPrompt = `다음 블로그 글의 내용을 분석하여 가장 적합한 카테고리 1개를 정확히 선택하세요.

【글 제목】 ${options.title}
【본문 첫 500자】 ${plainBody.substring(0, 500)}
【선택 가능한 카테고리 목록】
${catNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}

엄격 출력 규칙:
- 위 목록 중 가장 적합한 카테고리 이름 1개만 출력 (정확히 일치)
- 설명·번호·따옴표·마크다운 X
- 출력 예: "금융/저축"`;
            try {
              const { GoogleGenerativeAI: GGA_C } = require('@google/generative-ai');
              const catGenAI = new GGA_C(options.geminiKey);
              const catModel = catGenAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
              await waitForTextProviderTurn('gemini', 'wordpress/category-match');
              const catResult = await catModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: aiCatPrompt }] }],
                generationConfig: { maxOutputTokens: 100, temperature: 0.2 },
              });
              let aiCat = ((await catResult.response).text() || '').trim().replace(/^["'`]+|["'`]+$/g, '').split('\n')[0]!.trim();
              if (aiCat && catNames.includes(aiCat)) {
                const resolved = await this.resolveCategories([aiCat]);
                if (resolved.length > 0) {
                  (postData as any).categories = resolved;
                  console.log(`[WP-PUBLISH] 🤖 AI 카테고리 자동 매칭: "${aiCat}" (ID ${resolved.join(',')})`);
                }
              }
            } catch (aiCatErr: any) {
              console.warn('[WP-PUBLISH] AI 카테고리 매칭 실패:', aiCatErr?.message);
            }
          }
        } catch (autoErr: any) {
          console.warn('[WP-PUBLISH] 카테고리 자동 매칭 흐름 실패:', autoErr?.message);
        }
      }
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
      (postData as any).title = repairBrokenText('WordPress 발행 제목', (postData as any).title);
      postData.content = repairBrokenText('WordPress 발행 본문', postData.content);
      if (postData.excerpt) postData.excerpt = repairBrokenText('WordPress 발행 요약문', postData.excerpt);
      const createdPost = await this.wpApi.createPost(postData);

      // SEO 메타데이터 자동 처리 (초점 키프레이즈, 메타설명 등)
      if (createdPost.id) {
        // AI 기능 활용 (Gemini API 키가 있는 경우)
        const focusKeyword = repairBrokenText('SEO 초점 키프레이즈', await this.extractFocusKeywordSmart(cleanTitle, options.content, options.geminiKey));
        const metaDesc = repairBrokenText('SEO 메타설명', options.metaDescription || await this.generateMetaDescriptionSmart(options.content, options.geminiKey));

        const seoResult = await this.wpApi.updateSeoMeta(createdPost.id, {
          title: cleanTitle,
          description: metaDesc,
          focusKeyword: focusKeyword
        });

        if (seoResult.success) {
          console.log(`[SEO] ✅ 포스트 ${createdPost.id} Yoast SEO 필드 자동 입력 완료 (키워드: ${focusKeyword}, 메타설명: ${metaDesc.substring(0, 50)}...)`);
        }
      }

      // v3.8.30: WordPress API 응답의 link 필드(정확한 공개 글 URL) 우선 사용.
      //   기존엔 항상 wp-admin 편집 URL 반환 → 거미줄·외부유입·발행 글 목록 모두 글편집 화면으로.
      //   Pretty Permalinks 설정 사이트에서는 ?p=N도 404 → link만 정확.
      //   link 없거나 비정상이면 ?p=N 폴백.
      const wpSiteUrl = this.wpApi['config'].siteUrl;
      const apiLink = (createdPost as any).link;
      const publicUrl = (typeof apiLink === 'string' && /^https?:\/\//i.test(apiLink) && !/\/wp-admin\//i.test(apiLink))
        ? apiLink
        : `${wpSiteUrl}/?p=${createdPost.id}`;
      const result: { success: boolean; url?: string; postId?: number; error?: string } = {
        success: true,
        url: publicUrl,
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
    // 🛡️ v3.5.83: <style>/<script>/HTML 주석 블록은 태그뿐 아니라 내부 텍스트까지 통째로 제거
    //   기존: /<[^>]*>/g 만 적용 → <style> 태그만 사라지고 CSS 코드/주석이 발췌로 노출되던 버그
    const stripped = content
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // HTML 태그 제거
    const textContent = stripped.replace(/<[^>]*>/g, '');

    // HTML 엔티티 디코딩 (간이) + 공백 정리
    const decoded = textContent
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    const cleanText = decoded.replace(/\s+/g, ' ').trim();

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
    repairPublishInputBrokenText(options);

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

    postData.title = repairBrokenText('WordPress 발행 제목', postData.title);
    postData.content = repairBrokenText('WordPress 발행 본문', postData.content);
    const post = await wpApi.createPost(postData);

    if (post && post.id) {
      // v3.8.30: API 응답의 link 필드(공개 글 URL) 우선 사용. Pretty Permalinks 사이트에선 ?p=N도 404.
      const apiLink2 = (post as any).link;
      const postUrl = (typeof apiLink2 === 'string' && /^https?:\/\//i.test(apiLink2) && !/\/wp-admin\//i.test(apiLink2))
        ? apiLink2
        : `${options.siteUrl}/?p=${post.id}`;
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

          const finalFocusKeyword = repairBrokenText('SEO 초점 키프레이즈', options.focusKeyword || getFocusKeyword(options.title));
          const finalMetaDescription = repairBrokenText('SEO 메타설명', options.metaDescription || getMetaDescription(options.content));

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
