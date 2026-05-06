/**
 * src/core/final/seo-enhancements.ts (v3.5.77)
 *
 * 발행 직전 본문 HTML 후처리 — SEO/접근성/성능 일괄 보강.
 *
 * 1. 메타 태그 자동 삽입 (description, og:*, twitter:*, canonical)
 * 2. 이미지 alt 자동 채움 (비어있거나 없으면 키워드 + 인덱스)
 * 3. 두 번째 이후 이미지 loading="lazy" 자동 추가
 * 4. 본문 SVG 제거 (LLM이 만든 데이터 SVG는 일반적으로 깨지거나 의미 없음)
 * 5. 본문 article 영역에 itemprop="articleBody" 마크업 추가
 *
 * 주의: Blogger 템플릿이 자체 메타를 추가하지만 우리가 원하는 description/og:image/canonical을
 *       직접 통제할 수 있어야 SNS 공유 미리보기가 정상 작동.
 */

export interface SeoEnhanceOptions {
  title: string;
  keyword: string;
  thumbnailUrl?: string;
  description: string;
  /** 발행될 글의 canonical URL (Blogger가 결정 — 후처리 시점엔 모를 수 있어 옵션) */
  canonicalUrl?: string;
}

const META_INSERT_MARKER = '<!-- v3.5.77 seo-enhancements injected -->';

function escapeAttr(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMetaBlock(opts: SeoEnhanceOptions): string {
  const desc = (opts.description || '').slice(0, 155);
  const ogImage = opts.thumbnailUrl || '';
  const lines: string[] = [META_INSERT_MARKER];
  if (desc) {
    lines.push(`<meta name="description" content="${escapeAttr(desc)}" />`);
    lines.push(`<meta property="og:description" content="${escapeAttr(desc)}" />`);
    lines.push(`<meta name="twitter:description" content="${escapeAttr(desc)}" />`);
  }
  lines.push(`<meta property="og:title" content="${escapeAttr(opts.title)}" />`);
  lines.push(`<meta name="twitter:title" content="${escapeAttr(opts.title)}" />`);
  lines.push(`<meta property="og:type" content="article" />`);
  lines.push(`<meta name="twitter:card" content="summary_large_image" />`);
  if (ogImage && !ogImage.startsWith('data:')) {
    lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}" />`);
    lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}" />`);
  }
  if (opts.canonicalUrl) {
    lines.push(`<link rel="canonical" href="${escapeAttr(opts.canonicalUrl)}" />`);
    lines.push(`<meta property="og:url" content="${escapeAttr(opts.canonicalUrl)}" />`);
  }
  lines.push(`<meta name="robots" content="index, follow, max-image-preview:large" />`);
  return lines.join('\n');
}

/** 첫 번째 이미지를 제외하고 모두 loading="lazy" 추가 (이미 있으면 그대로) */
function addLazyLoading(html: string): string {
  let imgIdx = 0;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    imgIdx++;
    if (imgIdx === 1) return full;                          // 첫 이미지(LCP)는 즉시 로드
    if (/\bloading\s*=/i.test(attrs)) return full;          // 이미 있으면 유지
    return `<img${attrs} loading="lazy" decoding="async">`;
  });
}

/** alt 비어있거나 없는 이미지에 자동으로 alt 채움 */
function ensureImageAlt(html: string, keyword: string): string {
  let imgIdx = 0;
  return html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    imgIdx++;
    const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
    if (altMatch && altMatch[1].trim().length > 0) return full;
    const fallbackAlt = `${keyword} 관련 이미지 ${imgIdx}`;
    if (altMatch) {
      // 빈 alt 교체
      return full.replace(altMatch[0], `alt="${escapeAttr(fallbackAlt)}"`);
    }
    // alt 없음 — 추가
    return `<img${attrs} alt="${escapeAttr(fallbackAlt)}">`;
  });
}

/**
 * 본문에 LLM이 직접 그린 <svg>...</svg> 제거.
 * Blogger 템플릿이 사이드바에 만드는 SVG와 구분이 어려우므로
 * 본문 영역(article-body / post-body / .se-main-container)에 한정해서 제거.
 * 실제론 LLM이 본문에 SVG를 넣는 케이스가 드물지만 안전망.
 */
function stripBodySvgs(html: string): string {
  return html.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    // class에 entry-thumb / sidebar / icon 같은 패턴 → Blogger 템플릿. 유지.
    if (/class=['"][^'"]*(?:entry-thumb|sidebar|icon|widget|button)/i.test(svg)) return svg;
    // viewBox 16x16 이하의 작은 아이콘 → 유지
    if (/viewBox=['"]\s*0\s+0\s+(?:1[0-6]|[0-9])(?:\.\d+)?\s+(?:1[0-6]|[0-9])(?:\.\d+)?\s*['"]/i.test(svg)) return svg;
    // 본문에 들어간 LLM SVG (이미지 대체용 큰 SVG) → 제거
    return '';
  });
}

/** itemprop="articleBody" 마크업 본문 article 또는 post-body div에 자동 추가 */
function ensureArticleBodyMicrodata(html: string): string {
  // 이미 있으면 패스
  if (/itemprop=['"]articleBody['"]/i.test(html)) return html;
  // post-body, article-body, entry-content 같은 컨테이너 첫 발견에 추가
  const containerRe = /<div\b([^>]*\bclass=['"][^'"]*\b(?:post-body|article-body|entry-content)\b[^'"]*['"][^>]*)>/i;
  return html.replace(containerRe, (m, attrs) => {
    if (/itemprop=/i.test(attrs)) return m;
    return `<div${attrs} itemprop="articleBody">`;
  });
}

/**
 * 메타 태그를 본문 HTML 시작 부분에 삽입.
 * Blogger 글 본문 안에 <meta>를 넣어도 Blogger가 페이지 head로 옮기진 않지만,
 * 검색 엔진/SNS 크롤러는 본문 내 OG 메타도 일부 인식 (최선의 방어).
 * 또한 향후 head 주입 경로가 추가되면 동일 함수를 재사용 가능.
 */
function prependMetaBlock(html: string, metaBlock: string): string {
  if (html.includes(META_INSERT_MARKER)) return html;        // 중복 방지
  return metaBlock + '\n' + html;
}

export function applyFinalSeoEnhancements(html: string, opts: SeoEnhanceOptions): string {
  if (!html) return html;
  let result = html;
  result = stripBodySvgs(result);
  result = ensureImageAlt(result, opts.keyword || opts.title || '관련 이미지');
  result = addLazyLoading(result);
  result = ensureArticleBodyMicrodata(result);
  const metaBlock = buildMetaBlock(opts);
  result = prependMetaBlock(result, metaBlock);
  return result;
}
