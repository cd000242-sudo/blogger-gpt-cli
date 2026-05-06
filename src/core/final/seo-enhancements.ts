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
 * v3.5.78: stripBodySvgs 비활성화.
 *   class 매칭만으로는 사용자 의도 SVG(CTA 화살표·표 아이콘·글머리 기호 등)와
 *   LLM 데이터 SVG를 구분할 수 없어 무차별 삭제 위험. 안전망 자체를 제거.
 *   실제로 LLM이 본문에 SVG를 넣는 케이스는 거의 없음.
 */
function stripBodySvgs(html: string): string {
  return html;
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
 * v3.5.78: prependMetaBlock 비활성화.
 *   Blogger API에 본문으로 보낸 <meta>는 head로 이동하지 않음.
 *   최악의 경우: HTML 엔티티 인코딩되어 평문 텍스트로 본문에 노출 ("<meta name=...>" 그대로 보임)
 *   차악의 경우: 본문 첫 자식이 메타 태그라 :first-child CSS 셀렉터 마진 깨짐
 *   SEO 메타는 Blogger 템플릿 편집 또는 Custom HTML 위젯으로 처리해야 함.
 *
 *   buildMetaBlock 함수는 향후 진짜 head 주입 경로가 생길 때 재사용 가능하므로 코드는 보존.
 */
export function applyFinalSeoEnhancements(html: string, opts: SeoEnhanceOptions): string {
  if (!html) return html;
  let result = html;
  // v3.5.78: stripBodySvgs / prependMetaBlock 호출 제거 — 구조 깨짐 위험
  result = ensureImageAlt(result, opts.keyword || opts.title || '관련 이미지');
  result = addLazyLoading(result);
  result = ensureArticleBodyMicrodata(result);
  // 향후 buildMetaBlock 재사용 시 head 주입 경로에서 사용 — 현재는 호출 안 함
  void buildMetaBlock;
  return result;
}
