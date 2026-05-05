/**
 * 페러프레이징 유사도 검증기
 *
 * 문자 단위 trigram Jaccard 유사도로 원문과 리라이트 결과의 표현 차이를 측정.
 * 한국어 형태소 분석기 없이도 동작 — 의존성 없음.
 *
 * 임계값 40% 초과 시 "원문과 너무 비슷함" 으로 판정.
 */

/**
 * HTML 태그 제거 + 공백 정규화 후 순수 텍스트 추출
 */
function stripToText(html: string): string {
  return (html || '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * 문자 trigram 집합 추출
 */
function trigramSet(text: string): Set<string> {
  const s = new Set<string>();
  if (text.length < 3) return s;
  for (let i = 0; i <= text.length - 3; i++) {
    s.add(text.slice(i, i + 3));
  }
  return s;
}

/**
 * Jaccard 유사도 계산 (0.0 ~ 1.0)
 */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface SimilarityReport {
  similarity: number;       // 0.0 ~ 1.0
  threshold: number;        // 임계값 (기본 0.4)
  pass: boolean;            // similarity <= threshold
  sourceLength: number;
  rewriteLength: number;
  message: string;
}

/**
 * 원문과 리라이트 결과의 trigram Jaccard 유사도를 계산
 *
 * @param sourceHtml 원문 HTML 또는 텍스트
 * @param rewriteHtml 리라이트 HTML 또는 텍스트
 * @param threshold 통과 임계값 (기본 0.4 — 40% 초과 시 fail)
 */
export function checkParaphrasingSimilarity(
  sourceHtml: string,
  rewriteHtml: string,
  threshold: number = 0.4
): SimilarityReport {
  const sourceText = stripToText(sourceHtml);
  const rewriteText = stripToText(rewriteHtml);

  const sourceGrams = trigramSet(sourceText);
  const rewriteGrams = trigramSet(rewriteText);
  const similarity = jaccard(sourceGrams, rewriteGrams);
  const pass = similarity <= threshold;

  const pct = (similarity * 100).toFixed(1);
  const message = pass
    ? `✅ 유사도 ${pct}% — 임계값 ${(threshold * 100).toFixed(0)}% 이하 통과`
    : `⚠️ 유사도 ${pct}% — 임계값 ${(threshold * 100).toFixed(0)}% 초과. 원문과 너무 비슷함 (Scaled Content 리스크)`;

  return {
    similarity,
    threshold,
    pass,
    sourceLength: sourceText.length,
    rewriteLength: rewriteText.length,
    message,
  };
}
