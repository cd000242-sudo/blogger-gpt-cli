/**
 * Blogger Publisher - Style Module v5.0
 * CSS 생성 및 인라인 스타일 적용 — AdSense + Engagement 최적화
 * ★ 이 파일이 Blogger CSS의 유일한 소스 (Single Source of Truth)
 */

/**
 * 인라인 스타일 적용 헬퍼 함수 (CSS 완전 실패 시 대비)
 * @param {string} html - HTML 문자열
 * @returns {string} - 인라인 스타일이 적용된 HTML
 */
function normalizeBloggerTables(html) {
  if (!html) return html;

  const emptyCellContent = [
    '&nbsp;',
    '&#160;',
    '\\s',
    '<br\\s*\\/?>',
    '<p\\b[^>]*>\\s*<\\/p>',
    '<span\\b[^>]*>\\s*<\\/span>',
    '<strong\\b[^>]*>\\s*<\\/strong>',
    '<b\\b[^>]*>\\s*<\\/b>'
  ].join('|');
  const emptyTableRow = new RegExp(
    `<tr\\b[^>]*>\\s*(?:<t[hd]\\b[^>]*>\\s*(?:${emptyCellContent})*\\s*<\\/t[hd]>\\s*)+<\\/tr>\\s*`,
    'gi'
  );

  return html
    .replace(/<caption\b[^>]*>\s*(?:&nbsp;|&#160;|\s|<br\s*\/?>)*\s*<\/caption>/gi, '')
    .replace(emptyTableRow, '')
    .replace(/<thead\b[^>]*>\s*<\/thead>/gi, '')
    .replace(/<tbody\b[^>]*>\s*<\/tbody>/gi, '');
}

const BGPT_TABLE_SCROLL_STYLE = [
  'display: block',
  'width: 100%',
  'max-width: 100%',
  'box-sizing: border-box',
  'overflow: visible',
  'margin: 22px 0',
  'padding: 0',
  'background: transparent',
  'border: 0',
  'border-radius: 0'
].join('; ');

function addClassToAttrs(attrs, className) {
  const source = String(attrs || '').trim();
  const classPattern = new RegExp(`\\b${className}\\b`);
  if (classPattern.test(source)) return source;
  if (/\bclass\s*=/i.test(source)) {
    return source.replace(/\bclass\s*=\s*(["'])(.*?)\1/i, (_match, quote, classes) => (
      `class=${quote}${classes} ${className}${quote}`
    ));
  }
  return `${source ? source + ' ' : ''}class="${className}"`;
}

function escapeTableLabel(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripTableLabel(value) {
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

function addTableCellLabels(tableHtml) {
  const headers = Array.from(String(tableHtml || '').matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi))
    .map(match => stripTableLabel(match[1] || ''));
  if (!headers.length) return tableHtml;

  return String(tableHtml || '').replace(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi, (rowHtml) => {
    if (!/<td\b/i.test(rowHtml)) return rowHtml;
    let cellIndex = 0;
    return rowHtml.replace(/<td\b([^>]*)>/gi, (match, attrs = '') => {
      if (/\sdata-label\s*=/i.test(attrs)) {
        cellIndex++;
        return match;
      }
      const label = escapeTableLabel(headers[cellIndex] || '');
      cellIndex++;
      return `<td${attrs || ''} data-label="${label}">`;
    });
  });
}

function wrapBloggerTables(html) {
  if (!html || !/<table\b/i.test(html)) return html;

  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (tableHtml) => {
    if (/\bbgpt-mobile-table\b/i.test(tableHtml)) return tableHtml;
    const tableWithLabels = addTableCellLabels(tableHtml);
    const table = tableWithLabels.replace(/<table\b([^>]*)>/i, (_match, attrs = '') => (
      `<table ${addClassToAttrs(attrs, 'bgpt-mobile-table')}>`
    ));
    return `<div class="bgpt-table-scroll" data-bgpt-table-scroll="true" style="${BGPT_TABLE_SCROLL_STYLE}">${table}</div>`;
  });
}

function applyInlineStyles(html) {
  if (!html) return html;

  try {
    const inlineStyleMap = {
      'h1': 'color: #0f172a !important; font-size: 28px !important; font-weight: 800 !important; margin: 0 0 32px 0 !important; padding: 24px 0 !important; line-height: 1.3 !important; border-bottom: 3px solid #6366f1 !important;',
      'h2': 'color: #0f172a !important; font-size: 22px !important; font-weight: 700 !important; margin: 64px 0 20px 0 !important; padding: 16px 20px !important; background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%) !important; border-left: 5px solid #6366f1 !important; border-radius: 0 12px 12px 0 !important; line-height: 1.4 !important;',
      'h3': 'color: #1e293b !important; font-size: 19px !important; font-weight: 600 !important; margin: 36px 0 16px 0 !important; padding: 12px 16px !important; border-left: 4px solid #818cf8 !important; line-height: 1.4 !important;',
      'p': 'color: #1a1a1a !important; font-size: 16px !important; line-height: 1.72 !important; margin: 0 0 16px 0 !important; word-break: keep-all !important; overflow-wrap: break-word !important; letter-spacing: 0 !important;',
      'ul': 'margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important;',
      'ol': 'margin: 20px 0 !important; padding: 20px 20px 20px 40px !important; background: #fafafa !important; border-left: 3px solid #e2e8f0 !important; border-radius: 0 6px 6px 0 !important;',
      'li': 'margin: 7px 0 !important; line-height: 1.72 !important; font-size: 15.5px !important; color: #1a1a1a !important; overflow-wrap: break-word !important;',
      'table': 'width: 100% !important; min-width: 0 !important; max-width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; margin: 0 !important; border-radius: 10px !important; overflow: hidden !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important; table-layout: fixed !important; box-sizing: border-box !important;',
      'th': 'min-width: 0 !important; padding: 10px 12px !important; background: #f1f5f9 !important; font-weight: 700 !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; border-bottom: 2px solid #cbd5e1 !important; font-size: 13px !important; line-height: 1.45 !important; white-space: normal !important; word-break: keep-all !important; overflow-wrap: break-word !important;',
      'td': 'min-width: 0 !important; padding: 10px 12px !important; border: 1px solid #dbe4ee !important; color: #334155 !important; font-size: 13px !important; line-height: 1.45 !important; white-space: normal !important; word-break: keep-all !important; overflow-wrap: break-word !important;',
      'blockquote': 'margin: 28px 0 !important; padding: 20px 24px !important; background: #f8fafc !important; border-left: 4px solid #94a3b8 !important; border-radius: 0 6px 6px 0 !important; color: #334155 !important;',
    };

    let styledHtml = normalizeBloggerTables(html);
    for (const [tagName, styles] of Object.entries(inlineStyleMap)) {
      // 이미 style 속성이 있는 태그는 건너뛰기 (Gemini가 생성한 인라인 스타일 보존)
      const regex = new RegExp(`<${tagName}(\\s*>)`, 'gi');
      styledHtml = styledHtml.replace(regex, `<${tagName} style="${styles}"$1`);
    }
    styledHtml = wrapBloggerTables(styledHtml);

    console.log('[STYLE] ✅ 수익 최적화 인라인 스타일 적용 (720px/clamp/1.72) - 기존 스타일 보존');
    return styledHtml;
  } catch (error) {
    console.warn('[STYLE] ⚠️ 인라인 스타일 적용 실패:', error.message);
    return html;
  }
}

/**
 * Blogger 레이아웃 CSS 생성 (프리미엄 디자인 시스템 v5.0)
 * AdSense 자동 광고 최적화 + 행동 유발 CSS + 접근성
 * @returns {string} - 완성된 CSS 문자열
 */
function generateBloggerLayoutCSS() {
  return `
    /* ========================================
       BLOGGER-GPT 수익 최적화 스킨 v5.0
       720px / mobile clamp / 1.72 / 틸 악센트
       AdSense + Engagement + 접근성
       ======================================== */

    /* === 기본 레이아웃 === */
    .blogger-gpt-content {
      width: 100% !important;
      max-width: 760px !important;
      margin: 0 auto !important;
      padding: 30px 18px !important;
      background: #ffffff !important;
      color: #1a1a1a !important;
      font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 16px !important;
      line-height: 1.72 !important;
      word-break: keep-all !important;
      counter-reset: section !important;
    }

    /* === H2 — Indigo Premium Skin === */
    .blogger-gpt-content h2 {
      margin: 60px 0 24px 0 !important;
      padding: 16px 20px !important;
      border-left: 5px solid #6366f1 !important;
      background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%) !important;
      font-weight: 800 !important;
      font-size: 1.45rem !important;
      line-height: 1.5 !important;
      letter-spacing: -0.02em !important;
      border-radius: 0 12px 12px 0 !important;
      border-top: none !important;
      border-right: none !important;
      border-bottom: none !important;
      color: #0f172a !important;
      counter-increment: section !important;
      position: relative !important;
    }

    .blogger-gpt-content h2::before {
      content: counter(section, decimal-leading-zero) !important;
      position: absolute !important;
      right: 16px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      font-size: 32px !important;
      font-weight: 900 !important;
      color: rgba(99, 102, 241, 0.12) !important;
      line-height: 1 !important;
      pointer-events: none !important;
    }

    /* === H3 — 1-BILLION-POINT QUALITY === */
    .blogger-gpt-content h3 {
      font-size: 1.25rem !important;
      font-weight: 700 !important;
      color: #1a1a1a !important;
      margin: 40px 0 16px 0 !important;
      padding-bottom: 8px !important;
      border-bottom: 2px solid #eaeaea !important;
      letter-spacing: -0.01em !important;
    }

    /* === P — 1-BILLION-POINT QUALITY === */
    .blogger-gpt-content p {
      line-height: 1.72 !important;
      margin-bottom: 16px !important;
      font-size: 16px !important;
      color: #2c2c2c !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
      letter-spacing: 0 !important;
      font-weight: 400 !important;
    }

    .blogger-gpt-content strong,
    .blogger-gpt-content b {
      color: #0f172a !important;
      font-weight: 700 !important;
    }

    .blogger-gpt-content a {
      color: #4f46e5 !important;
      text-decoration: none !important;
      border-bottom: 1px solid #c7d2fe !important;
      transition: color 0.2s ease, border-color 0.2s ease !important;
    }

    .blogger-gpt-content a:hover {
      color: #6366f1 !important;
      border-bottom-color: #6366f1 !important;
    }

    .blogger-gpt-content a.cta-responsive-button,
    .blogger-gpt-content a.cta-btn,
    .blogger-gpt-content a[class*="button"],
    .blogger-gpt-content a[class*="btn"] {
      display: inline-block !important;
      border-bottom: none !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      text-decoration: none !important;
    }

    .blogger-gpt-content a.toc-nav-item {
      display: block !important;
      border-bottom: none !important;
      text-decoration: none !important;
    }

    .blogger-gpt-content blockquote {
      margin: 28px 0 !important;
      padding: 20px 24px !important;
      background: #F8FAFC !important;
      border-left: 4px solid #3B82F6 !important;
      border-radius: 0 8px 8px 0 !important;
      font-style: normal !important;
      color: #334155 !important;
    }

    /* === 이미지 — 하단 마진 48px (AdSense 여백) === */
    .blogger-gpt-content img {
      max-width: 100% !important;
      height: auto !important;
      margin: 32px auto 48px auto !important;
      border-radius: 6px !important;
      display: block !important;
    }

    /* 부모 컨테이너 확장 */
    .post-body, .entry-content, .post-content {
      max-width: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .max-mode-article {
      max-width: 720px !important;
      margin: 0 auto !important;
    }

    /* === 테이블 — 1-BILLION-POINT QUALITY === */
    .blogger-gpt-content table {
      width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 !important;
      margin: 32px 0 !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      border: 1px solid #cbd5e1 !important;
      background: #ffffff !important;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05) !important;
      table-layout: fixed !important;
      box-sizing: border-box !important;
    }

    .blogger-gpt-content .bgpt-table-scroll {
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

    .blogger-gpt-content .bgpt-table-scroll table,
    .blogger-gpt-content table.bgpt-mobile-table {
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100% !important;
      margin: 0 !important;
      table-layout: fixed !important;
      box-sizing: border-box !important;
    }

    .blogger-gpt-content .bgpt-table-scroll::-webkit-scrollbar {
      height: 7px !important;
    }

    .blogger-gpt-content .bgpt-table-scroll::-webkit-scrollbar-thumb {
      background: #cbd5e1 !important;
      border-radius: 999px !important;
    }

    .blogger-gpt-content thead tr {
      background: #F1F5F9 !important;
    }

    .blogger-gpt-content th {
      color: #334155 !important;
      font-weight: 700 !important;
      text-align: center !important;
      min-width: 92px !important;
      padding: 10px 12px !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
      border: 1px solid #cbd5e1 !important;
      border-bottom: 2px solid #cbd5e1 !important;
      white-space: normal !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
    }

    .blogger-gpt-content td {
      min-width: 92px !important;
      padding: 10px 12px !important;
      border: 1px solid #dbe4ee !important;
      color: #475569 !important;
      text-align: center !important;
      font-size: 13px !important;
      line-height: 1.45 !important;
      white-space: normal !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
      transition: background 0.2s ease !important;
    }

    .blogger-gpt-content tbody tr {
      background: #ffffff !important;
    }

    .blogger-gpt-content tbody tr:nth-child(even) {
      background: #F8FAFC !important;
    }

    .blogger-gpt-content tbody tr:hover td {
      background: #F1F5F9 !important;
    }

    /* === AdSense 자동 광고 여백 === */
    .ad-safe-zone {
      margin: 40px 0 !important;
      clear: both !important;
      min-height: 1px !important;
    }

    .section-divider {
      border: none !important;
      height: 2px !important;
      background: linear-gradient(90deg, transparent 0%, #6366f1 20%, #d4a800 50%, #6366f1 80%, transparent 100%) !important;
      margin: 48px 0 !important;
      position: relative !important;
    }

    .section-divider::after {
      content: "▼" !important;
      position: absolute !important;
      left: 50% !important;
      bottom: -20px !important;
      transform: translateX(-50%) !important;
      color: #6366f1 !important;
      font-size: 12px !important;
      animation: fadeFloat 2s ease-in-out infinite !important;
    }

    /* === Engagement: 핵심 하이라이트 박스 === */
    .key-insight {
      margin: 32px 0 !important;
      padding: 24px 28px !important;
      background: linear-gradient(135deg, #fffbf0 0%, #fef9f0 100%) !important;
      border-left: 5px solid #d4a800 !important;
      border-radius: 0 12px 12px 0 !important;
      font-size: 17px !important;
      line-height: 1.8 !important;
      color: #1a1a1a !important;
      position: relative !important;
    }

    .key-insight::before {
      content: "💡 핵심" !important;
      display: inline-block !important;
      font-size: 13px !important;
      font-weight: 800 !important;
      color: #d4a800 !important;
      background: rgba(212, 168, 0, 0.1) !important;
      padding: 2px 10px !important;
      border-radius: 4px !important;
      margin-bottom: 8px !important;
    }

    /* === Engagement: 섹션 프리뷰 박스 === */
    .section-preview {
      margin: 0 0 28px 0 !important;
      padding: 16px 20px !important;
      background: #f0f4ff !important;
      border-radius: 8px !important;
      font-size: 15px !important;
      color: #475569 !important;
      border: 1px dashed #c7d2fe !important;
      line-height: 1.7 !important;
    }

    /* === Engagement: 읽기 시간 표시 === */
    .reading-time {
      display: inline-block !important;
      margin: 0 0 32px 0 !important;
      padding: 6px 16px !important;
      background: #f0f4ff !important;
      color: #6366f1 !important;
      border-radius: 20px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      border: 1px solid #c7d2fe !important;
    }

    /* === CTA 버튼 === */
    .cta-responsive-box {
      padding: 45px 40px !important;
      border-radius: 18px !important;
      text-align: center !important;
      margin: 50px auto !important;
      max-width: 95% !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 0 20px rgba(212, 168, 0, 0.3) !important;
    }

    .cta-responsive-text {
      font-size: 28px !important;
      font-weight: 900 !important;
      margin-bottom: 25px !important;
      line-height: 1.6 !important;
    }

    .cta-responsive-button {
      color: #ffffff !important;
      padding: 22px 50px !important;
      text-decoration: none !important;
      font-weight: 900 !important;
      border-radius: 50px !important;
      display: inline-block !important;
      margin-top: 20px !important;
      font-size: 22px !important;
      transition: all 0.3s ease !important;
      box-shadow: 0 8px 30px rgba(220,38,38,0.4) !important;
      letter-spacing: 0.5px !important;
    }

    .cta-responsive-button:hover {
      transform: translateY(-3px) scale(1.02) !important;
      box-shadow: 0 12px 40px rgba(220,38,38,0.5) !important;
    }

    /* === TOC 내비게이션 아이템 (onmouseover 대체) === */
    .toc-nav-item:hover {
      transform: translateY(-3px) !important;
      box-shadow: 0 12px 35px rgba(255,255,255,0.3) !important;
    }

    /* === Animations (Single Source — 여기서만 선언) === */
    @keyframes fadeFloat {
      0%, 100% { opacity: 0.4; transform: translateX(-50%) translateY(0); }
      50% { opacity: 1; transform: translateX(-50%) translateY(4px); }
    }

    @keyframes ctaPulse {
      0%, 100% { box-shadow: 0 8px 30px rgba(220,38,38,0.4); }
      50% { box-shadow: 0 8px 40px rgba(220,38,38,0.6), 0 0 20px rgba(220,38,38,0.3); }
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }

    /* === 반응형 === */
    @media (max-width: 768px) {
      html, body {
        overflow-x: hidden !important;
        -webkit-text-size-adjust: 100% !important;
        text-size-adjust: 100% !important;
      }
      #content-wrapper, #main-wrapper, #outer-wrapper,
      .content-wrapper, .main-wrapper, .outer-wrapper,
      .container, .container.row-x1, .row, .col, .column,
      .post-outer, .blog-post, .item-post-inner,
      .post-body, .entry-content, .post-content {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
      }
      .blogger-gpt-content {
        width: 100vw !important;
        max-width: 100vw !important;
        min-width: 0 !important;
        padding: 18px 10px 52px !important;
        margin-left: calc(50% - 50vw) !important;
        margin-right: calc(50% - 50vw) !important;
      }
      .blogger-gpt-content h2 { font-size: 19px !important; margin: 42px 0 14px 0 !important; }
      .blogger-gpt-content h2::before { font-size: 22px !important; }
      .blogger-gpt-content p {
        font-size: 16px !important;
        line-height: 1.72 !important;
        margin-bottom: 15px !important;
        letter-spacing: 0 !important;
        overflow-wrap: break-word !important;
      }
      .blogger-gpt-content table { font-size: 14px !important; }
      .blogger-gpt-content .bgpt-table-scroll {
        width: 100% !important;
        max-width: 100% !important;
        margin: 22px 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
      }
      .blogger-gpt-content .bgpt-table-scroll table,
      .blogger-gpt-content table.bgpt-mobile-table,
      .blogger-gpt-content .bgpt-table-scroll tbody,
      .blogger-gpt-content table.bgpt-mobile-table tbody,
      .blogger-gpt-content .bgpt-table-scroll tr,
      .blogger-gpt-content table.bgpt-mobile-table tr,
      .blogger-gpt-content .bgpt-table-scroll td,
      .blogger-gpt-content table.bgpt-mobile-table td {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      .blogger-gpt-content .bgpt-table-scroll thead,
      .blogger-gpt-content table.bgpt-mobile-table thead {
        display: none !important;
      }
      .blogger-gpt-content .bgpt-table-scroll table,
      .blogger-gpt-content table.bgpt-mobile-table {
        border: 0 !important;
        border-radius: 0 !important;
        overflow: visible !important;
        background: transparent !important;
      }
      .blogger-gpt-content .bgpt-table-scroll tr,
      .blogger-gpt-content table.bgpt-mobile-table tr {
        margin: 0 0 12px !important;
        border: 1px solid #dbe4ee !important;
        border-radius: 12px !important;
        background: #ffffff !important;
        overflow: hidden !important;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.05) !important;
      }
      .blogger-gpt-content .bgpt-table-scroll td,
      .blogger-gpt-content table.bgpt-mobile-table td {
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
      .blogger-gpt-content .bgpt-table-scroll td:last-child,
      .blogger-gpt-content table.bgpt-mobile-table td:last-child {
        border-bottom: 0 !important;
      }
      .blogger-gpt-content .bgpt-table-scroll td::before,
      .blogger-gpt-content table.bgpt-mobile-table td::before {
        content: attr(data-label) !important;
        display: block !important;
        margin: 0 0 5px 0 !important;
        color: #0f766e !important;
        -webkit-text-fill-color: #0f766e !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        line-height: 1.35 !important;
      }
      .blogger-gpt-content .bgpt-table-scroll td[data-label=""]::before,
      .blogger-gpt-content table.bgpt-mobile-table td[data-label=""]::before {
        display: none !important;
      }
      .cta-responsive-box { padding: 30px 20px !important; margin: 35px auto !important; }
      .cta-responsive-text { font-size: 22px !important; }
      .cta-responsive-button { padding: 16px 32px !important; font-size: 19px !important; width: 85% !important; }
      .key-insight { padding: 20px !important; }
      .section-divider { margin: 36px 0 !important; }
    }

    @media (max-width: 375px) {
      .blogger-gpt-content { padding: 16px 8px 48px !important; }
      .blogger-gpt-content h2 { font-size: 17px !important; padding: 12px 16px !important; }
      .blogger-gpt-content h2::before { display: none !important; }
      .blogger-gpt-content p { font-size: 15.5px !important; line-height: 1.7 !important; }
    }

    /* === 접근성: 모션 감소 === */
    @media (prefers-reduced-motion: reduce) {
      .section-divider::after { animation: none !important; }
      .cta-responsive-button { transition: none !important; animation: none !important; }
      .cta-responsive-button:hover { transform: none !important; }
      .blogger-gpt-content a { transition: none !important; }
      .blogger-gpt-content td { transition: none !important; }
    }
  `;
}

/**
 * AdSense 자동 광고 여백 삽입
 * 매 2번째 H2 앞에 ad-safe-zone + section-divider 삽입
 * @param {string} html - HTML 문자열
 * @returns {string} - 광고 여백이 삽입된 HTML
 */
function insertAdBreathingSpace(html, contentMode) {
  if (!html) return html;

  // 애드센스 승인 모드 → 광고 여백 삽입 스킵 (MFA 신호 방지)
  if (contentMode === 'adsense') {
    console.log('[STYLE] ⏩ 애드센스 모드 — ad-safe-zone 삽입 스킵');
    return html;
  }

  try {
    let h2Count = 0;
    let adCount = 0;
    const maxAds = 3;

    const result = html.replace(/<h2[\s>]/gi, (match) => {
      h2Count++;
      // 첫 H2는 건너뛰고, 매 2번째 H2 앞에 광고 여백 삽입
      if (h2Count > 1 && h2Count % 2 === 0 && adCount < maxAds) {
        adCount++;
        return `<hr class="section-divider"><div class="ad-safe-zone"></div>${match}`;
      }
      return match;
    });

    console.log(`[STYLE] ✅ AdSense 호흡 공간 ${adCount}개 삽입 (H2 ${h2Count}개 중)`);
    return result;
  } catch (error) {
    console.warn('[STYLE] ⚠️ 광고 여백 삽입 실패:', error.message);
    return html;
  }
}

/**
 * Schema.org microdata 래퍼 (Blogger SEO — <script> 없이)
 * @param {string} html - HTML 본문
 * @param {object} meta - { title, author, datePublished }
 * @returns {string} - microdata가 적용된 HTML
 */
function wrapWithMicrodata(html, meta = {}) {
  const author = meta.author || '블로거';
  const date = meta.datePublished || new Date().toISOString().split('T')[0];
  const title = meta.title || '';

  return `<article itemscope itemtype="https://schema.org/BlogPosting">
<meta itemprop="headline" content="${title.replace(/"/g, '&quot;')}">
<meta itemprop="datePublished" content="${date}">
<span itemprop="author" itemscope itemtype="https://schema.org/Person">
  <meta itemprop="name" content="${author}">
</span>
<div itemprop="articleBody">
${html}
</div>
</article>`;
}

/**
 * 읽기 시간 계산 + HTML 삽입
 * @param {string} html - HTML 본문
 * @returns {string} - 읽기 시간 뱃지가 추가된 HTML
 */
function insertReadingTime(html) {
  if (!html) return html;

  try {
    // HTML 태그 제거 후 순수 텍스트 길이
    const textOnly = html.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
    const charCount = textOnly.length;
    const minutes = Math.max(1, Math.round(charCount / 500)); // 한국어 약 500자/분

    const badge = `<div class="reading-time">📖 약 ${minutes}분 소요</div>`;

    // 첫 번째 블록 요소 앞에 삽입
    if (html.match(/<(h[1-6]|p|div)[\s>]/i)) {
      return html.replace(/(<(?:h[1-6]|p|div)[\s>])/i, `${badge}$1`);
    }

    return badge + html;
  } catch (error) {
    return html;
  }
}

/**
 * CSS 압축 (공백 및 주석 제거)
 * @param {string} css - 원본 CSS
 * @returns {string} - 압축된 CSS
 */
function compressCSS(css) {
  if (!css) return '';

  try {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '') // 주석 제거
      .replace(/\s+/g, ' ') // 연속 공백을 하나로
      .replace(/\s*([{}:;,])\s*/g, '$1') // 특수문자 주변 공백 제거
      .replace(/;}/g, '}') // 마지막 세미콜론 제거
      .trim();
  } catch (error) {
    console.warn('[STYLE] CSS 압축 실패:', error.message);
    return css;
  }
}

/**
 * CSS를 HTML에 주입
 * @param {string} html - HTML 문자열
 * @param {string} css - CSS 문자열
 * @returns {string} - CSS가 포함된 HTML
 */
function injectCSS(html, css) {
  if (!css) return html;

  const styleTag = `<style type="text/css">\n${css}\n</style>`;

  // <head> 태그가 있으면 그 안에 삽입
  if (html.includes('<head>')) {
    return html.replace('</head>', `${styleTag}\n</head>`);
  }

  // <body> 태그가 있으면 그 앞에 삽입
  if (html.includes('<body>')) {
    return html.replace('<body>', `${styleTag}\n<body>`);
  }

  // 둘 다 없으면 맨 앞에 삽입
  return `${styleTag}\n${html}`;
}

module.exports = {
  applyInlineStyles,
  generateBloggerLayoutCSS,
  normalizeBloggerTables,
  wrapBloggerTables,
  compressCSS,
  injectCSS,
  insertAdBreathingSpace,
  wrapWithMicrodata,
  insertReadingTime
};
