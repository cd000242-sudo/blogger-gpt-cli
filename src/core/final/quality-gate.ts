/**
 * 콘텐츠 품질 검증 게이트
 * HTML 조립 후, 발행 전 단계에서 생성된 아티클의 품질을 검사한다.
 */

export interface QualityReport {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  sectionScores: Array<{
    h2: string;
    h3Scores: Array<{ h3: string; charCount: number; passed: boolean }>;
  }>;
}

interface ArticleInput {
  h1Title: string;
  introduction: string;
  conclusion: string;
  sections: Array<{
    h2: string;
    h3Sections: Array<{ h3: string; content: string }>;
  }>;
  faqs?: Array<{ question: string; answer: string }>;
}

const H3_MIN_CHARS = 400;
const MIN_SCORE_TO_PASS = 70;
const MIN_H2_COUNT = 3;
const MIN_FAQ_COUNT = 3;

/** HTML 태그를 제거하고 순수 텍스트 길이를 반환한다. */
function stripTagsAndCount(html: string): number {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().length;
}

/** AI 아티팩트 패턴 정의 */
const AI_ARTIFACT_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /[🔥💡📋✅💎][^\n]*[:：](후킹|핵심|포인트|팁|요약)/u,
    label: '이모지 접두사 라벨 (예: 🔥후킹:, 💡핵심:)',
  },
  {
    pattern: /다음은\s+(다음|아래|이어서|이제)/,
    label: '섹션 전환 표현 "다음은 다음/아래"',
  },
  {
    pattern: /넘어가서/,
    label: '섹션 전환 표현 "넘어가서"',
  },
  {
    pattern: /굳혀볼게요/,
    label: '섹션 전환 표현 "굳혀볼게요"',
  },
  {
    pattern: /중요한 사실입니다/g,
    label: '반복 필러 "중요한 사실입니다"',
  },
  {
    pattern: /다양한 이점이 있습니다/g,
    label: '반복 필러 "다양한 이점이 있습니다"',
  },
  {
    pattern: /[\u4E00-\u9FFF\u3400-\u4DBF]/,
    label: '중국어 한자(CJK) 문자 감지',
  },
  {
    pattern: /10년차|20년차|현직자가 말하는|전문가가 알려주는/,
    label: '허위 권위 주장 (경력/전문가 사칭)',
  },
  {
    pattern: /제가 직접 해본|직접 겪어보고|직접 써본/,
    label: '허위 경험 주장',
  },
];

/**
 * 아티클 품질을 0~100 점수로 평가하고 상세 리포트를 반환한다.
 *
 * 채점 기준:
 *   - H3 콘텐츠 길이 (40점): 각 H3가 400자 이상이면 정상, 미달 시 비율만큼 감점
 *   - 구조 완전성 (40점): 서론(10), 결론(10), H2 3개 이상(10), FAQ 3개 이상(10)
 *   - AI 아티팩트 없음 (20점): 패턴 발견 시 각 5점 감점
 */
export function validateArticleQuality(article: ArticleInput): QualityReport {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const sectionScores: QualityReport['sectionScores'] = [];

  // ── 1. H3 콘텐츠 길이 검사 ──────────────────────────────────────────────
  let totalH3 = 0;
  let passingH3 = 0;

  for (const section of article.sections) {
    const h3Scores: Array<{ h3: string; charCount: number; passed: boolean }> = [];

    for (const h3Sec of section.h3Sections) {
      const charCount = stripTagsAndCount(h3Sec.content);
      const passed = charCount >= H3_MIN_CHARS;
      h3Scores.push({ h3: h3Sec.h3, charCount, passed });
      totalH3++;
      if (passed) {
        passingH3++;
      } else {
        issues.push(
          `H3 "${h3Sec.h3.slice(0, 30)}" 콘텐츠가 너무 짧습니다 (${charCount}자 / 최소 ${H3_MIN_CHARS}자)`
        );
        suggestions.push(
          `"${h3Sec.h3.slice(0, 30)}" 섹션에 구체적인 예시, 데이터, 또는 상세 설명을 추가하세요.`
        );
      }
    }

    sectionScores.push({ h2: section.h2, h3Scores });
  }

  const h3PassRatio = totalH3 > 0 ? passingH3 / totalH3 : 0;
  const h3Score = Math.round(h3PassRatio * 40);

  // ── 2. 구조 완전성 검사 ─────────────────────────────────────────────────
  let structureScore = 0;

  const hasIntroduction = stripTagsAndCount(article.introduction) > 0;
  if (hasIntroduction) {
    structureScore += 10;
  } else {
    issues.push('서론(introduction)이 비어 있습니다.');
    suggestions.push('독자가 글을 계속 읽도록 유도하는 서론을 작성하세요.');
  }

  const hasConclusion = stripTagsAndCount(article.conclusion) > 0;
  if (hasConclusion) {
    structureScore += 10;
  } else {
    issues.push('결론(conclusion)이 비어 있습니다.');
    suggestions.push('핵심 내용을 요약하고 독자에게 행동을 유도하는 결론을 작성하세요.');
  }

  const h2Count = article.sections.length;
  if (h2Count >= MIN_H2_COUNT) {
    structureScore += 10;
  } else {
    issues.push(`H2 섹션이 ${h2Count}개로 부족합니다 (최소 ${MIN_H2_COUNT}개 필요).`);
    suggestions.push(`H2 섹션을 ${MIN_H2_COUNT - h2Count}개 더 추가하세요.`);
  }

  const faqCount = article.faqs?.length ?? 0;
  if (faqCount >= MIN_FAQ_COUNT) {
    structureScore += 10;
  } else {
    issues.push(`FAQ가 ${faqCount}개로 부족합니다 (최소 ${MIN_FAQ_COUNT}개 필요).`);
    suggestions.push(`FAQ를 ${MIN_FAQ_COUNT - faqCount}개 더 추가하세요.`);
  }

  // ── 3. AI 아티팩트 검사 ─────────────────────────────────────────────────
  const allContent = article.sections
    .flatMap(s => s.h3Sections.map(h => h.content))
    .join('\n');

  let artifactPenalty = 0;
  const MAX_ARTIFACT_PENALTY = 20;
  const PENALTY_PER_ARTIFACT = 5;

  for (const { pattern, label } of AI_ARTIFACT_PATTERNS) {
    if (pattern.test(allContent)) {
      artifactPenalty = Math.min(artifactPenalty + PENALTY_PER_ARTIFACT, MAX_ARTIFACT_PENALTY);
      issues.push(`AI 아티팩트 감지: ${label}`);
      suggestions.push(`"${label}" 패턴을 자연스러운 문장으로 교체하세요.`);
    }
  }

  const artifactScore = MAX_ARTIFACT_PENALTY - artifactPenalty;

  // ── 최종 점수 집계 ───────────────────────────────────────────────────────
  const score = h3Score + structureScore + artifactScore;
  const passed = score >= MIN_SCORE_TO_PASS;

  return { passed, score, issues, suggestions, sectionScores };
}

import { verifyCitationHeuristics, type SourceVerifyResult } from './source-verifier';

// ════════════════════════════════════════════════════════════════════════
// 🛡️ v3.5.83: AdSense "저가치 콘텐츠" 사후 검증 게이트
// ════════════════════════════════════════════════════════════════════════
//
// validateArticleQuality는 article 구조를 받는 빌드-단계 평가용. 이 게이트는
// 발행 직전 HTML 본문에 대해 AdSense 거절 사유 1순위(저가치 콘텐츠)를 사후
// 검증한다. AI가 prompt를 부분 무시한 케이스를 잡기 위함.
//
// 사용자 결정(2026-05): 차단하지 않고 경고 로그만. block은 하지 않음.

export interface ContentQualityWarning {
  metric: 'length' | 'paragraphs' | 'sources' | 'sentenceAvg' | 'imageAlt' | 'internalLinks' | 'metaDescription' | 'sourceSuspicion';
  severity: 'warn';
  actual: number;
  threshold: number;
  message: string;
}

export interface ContentQualityMetrics {
  textLength: number;            // 한글 가중치 환산 후 normalized 글자수
  rawLength: number;             // 원본 글자수
  paragraphCount: number;
  sourceMentions: number;
  sentenceAvgLength: number;
  sentenceCount: number;
  imageCount: number;
  imagesWithAlt: number;
  internalLinkCount: number;
  metaDescriptionLength: number;
}

export interface ContentQualityResult {
  ok: boolean;
  warnings: ContentQualityWarning[];
  metrics: ContentQualityMetrics;
  summary: string;
  /** 출처 환각 휴리스틱 검증 결과 (v3.5.84+) */
  sourceVerify?: SourceVerifyResult;
}

const ADSENSE_SOURCE_KEYWORDS: RegExp[] = [
  /통계청/g,
  /KOSIS/gi,
  /한국소비자원/g,
  /한국은행/g,
  /ECOS/gi,
  /보건복지부/g,
  /국립국어원/g,
  /기획재정부/g,
  /국세청/g,
  /국토교통부/g,
  /고용노동부/g,
  /식품의약품안전처/g,
  /식약처/g,
  /금융감독원/g,
  /금융위원회/g,
  /산업통상자원부/g,
  /교육부/g,
  /환경부/g,
  /행정안전부/g,
  /국가법령정보센터/g,
  /공공데이터포털/g,
  /e-나라지표/g,
  /[가-힣]{2,}\s*(공식|기관|연구원|진흥원)\s*(자료|발표|조사|통계)/g,
];

// 🛡️ v3.5.83: prompt-게이트 임계값 동기화 — prompt는 6000자·출처 2회 강제하므로
//   게이트는 prompt 잘 따른 본문(raw 6000자 → normalized ~4800)이 통과하도록 4500.
//   영어 본문은 한글 글자수의 1/2 가중치로 normalizeTextLength()에서 환산.
const ADSENSE_QUALITY_THRESHOLDS = {
  minTextLength: 4500,        // 한글 환산. raw 6000자 프롬프트 강제 본문은 통과
  minParagraphCount: 8,
  minSourceMentions: 2,        // prompt와 동기화 (한국 공공기관 2회)
  minSentenceAvgLength: 25,
};

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countParagraphTags(html: string): number {
  const matches = html.match(/<p\b[^>]*>/gi);
  return matches ? matches.length : 0;
}

function countSourceMentionsInText(text: string): number {
  let total = 0;
  for (const re of ADSENSE_SOURCE_KEYWORDS) {
    re.lastIndex = 0;
    const m = text.match(re);
    if (m) total += m.length;
  }
  return total;
}

function computeSentenceStats(text: string): { count: number; avgLength: number } {
  const sentences = text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (sentences.length === 0) return { count: 0, avgLength: 0 };
  const totalLen = sentences.reduce((sum, s) => sum + s.length, 0);
  return {
    count: sentences.length,
    avgLength: Math.round(totalLen / sentences.length),
  };
}

// 한글 1자 = 1, 영어/숫자 단어는 평균 5글자로 보정 (한글 1자 ≈ 영어 5자 정보량)
function normalizeTextLength(text: string): number {
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const otherChars = text.length - koreanChars;
  // 영어/숫자/공백은 정보 밀도가 낮아 0.5 가중치
  return koreanChars + Math.round(otherChars * 0.5);
}

interface ImageAltStats { total: number; withAlt: number; }

function countImageAlt(html: string): ImageAltStats {
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let withAlt = 0;
  for (const tag of imgTags) {
    // alt="..." 또는 alt='...' 또는 alt=...  — 빈 alt는 제외
    const m = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const altValue = m ? (m[1] || m[2] || m[3] || '').trim() : '';
    if (altValue.length >= 3) withAlt++;
  }
  return { total: imgTags.length, withAlt };
}

function countInternalLinks(html: string, siteHost?: string): number {
  const aTags = html.match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  let internal = 0;
  for (const tag of aTags) {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    const href = hrefMatch ? hrefMatch[1] : '';
    if (!href) continue;
    // 내부 링크 판정: 상대경로(/, ./, ../) 또는 같은 호스트 절대 URL 또는 #앵커
    const isRelative = /^(\.{0,2}\/|#)/.test(href);
    const isSameHost = siteHost && href.includes(siteHost);
    if (isRelative || isSameHost) internal++;
  }
  return internal;
}

function extractMetaDescription(html: string): string {
  // 본문 내 meta description 추출 (Schema.org에서 description 또는 일반 meta name="description")
  const metaTag = html.match(/<meta[^>]+name\s*=\s*["']description["'][^>]*>/i);
  if (metaTag) {
    const contentMatch = metaTag[0].match(/content\s*=\s*["']([^"']+)["']/i);
    if (contentMatch && contentMatch[1]) return contentMatch[1].trim();
  }
  // Schema.org JSON-LD에서 description 필드 추출 시도
  const jsonLdMatch = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch && jsonLdMatch[1]) {
    try {
      const ld = JSON.parse(jsonLdMatch[1]);
      if (ld?.description && typeof ld.description === 'string') return ld.description.trim();
    } catch { /* noop */ }
  }
  return '';
}

// 추가 검증 임계값
const SECONDARY_THRESHOLDS = {
  minImageAltRatio: 0.8,        // 이미지의 80% 이상이 alt 보유
  minInternalLinks: 2,           // 본문 내 내부 링크 2개 이상
  minMetaDescLength: 110,        // SEO 적정 110~155자
  maxMetaDescLength: 160,
};

/**
 * AdSense 저가치 콘텐츠 사후 검증 — 본문 HTML 측정 후 경고만 반환.
 * block 없음. orchestration이 호출해 onLog로 표시.
 *
 * @param html - 발행 직전 본문 HTML
 * @param siteHost - 내부링크 판정용 사이트 호스트 (선택)
 */
export function scanContentQuality(html: string, siteHost?: string): ContentQualityResult {
  const text = stripHtmlToText(html);
  const rawLength = text.length;
  const textLength = normalizeTextLength(text); // 한글 가중치 환산
  const paragraphCount = countParagraphTags(html);
  const sourceMentions = countSourceMentionsInText(text);
  const sentStats = computeSentenceStats(text);
  const altStats = countImageAlt(html);
  const internalLinkCount = countInternalLinks(html, siteHost);
  const metaDesc = extractMetaDescription(html);
  const metaDescLength = metaDesc.length;

  const warnings: ContentQualityWarning[] = [];

  if (textLength < ADSENSE_QUALITY_THRESHOLDS.minTextLength) {
    warnings.push({
      metric: 'length',
      severity: 'warn',
      actual: textLength,
      threshold: ADSENSE_QUALITY_THRESHOLDS.minTextLength,
      message: `본문 정보량 ${textLength} (한글 환산, 원본 ${rawLength}자) — AdSense 저가치 콘텐츠 거절 위험. ${ADSENSE_QUALITY_THRESHOLDS.minTextLength}+ 권장.`,
    });
  }

  if (paragraphCount < ADSENSE_QUALITY_THRESHOLDS.minParagraphCount) {
    warnings.push({
      metric: 'paragraphs',
      severity: 'warn',
      actual: paragraphCount,
      threshold: ADSENSE_QUALITY_THRESHOLDS.minParagraphCount,
      message: `본문 단락 ${paragraphCount}개 — 가독성 부족. 최소 ${ADSENSE_QUALITY_THRESHOLDS.minParagraphCount}개 권장.`,
    });
  }

  if (sourceMentions < ADSENSE_QUALITY_THRESHOLDS.minSourceMentions) {
    warnings.push({
      metric: 'sources',
      severity: 'warn',
      actual: sourceMentions,
      threshold: ADSENSE_QUALITY_THRESHOLDS.minSourceMentions,
      message: `한국 공공/기관 출처 인용 ${sourceMentions}회 (prompt 강제 ${ADSENSE_QUALITY_THRESHOLDS.minSourceMentions}회) — E-E-A-T 점수 저하. 통계청·한국소비자원·한국은행 등 검증 가능한 기관을 본문에 인용하세요.`,
    });
  }

  if (sentStats.avgLength > 0 && sentStats.avgLength < ADSENSE_QUALITY_THRESHOLDS.minSentenceAvgLength) {
    warnings.push({
      metric: 'sentenceAvg',
      severity: 'warn',
      actual: sentStats.avgLength,
      threshold: ADSENSE_QUALITY_THRESHOLDS.minSentenceAvgLength,
      message: `평균 문장 길이 ${sentStats.avgLength}자 — list-only 저가치 의심. 충분한 설명·분석 문장 추가 권장.`,
    });
  }

  // 이미지 alt 검증 (이미지가 있을 때만)
  if (altStats.total > 0) {
    const altRatio = altStats.withAlt / altStats.total;
    if (altRatio < SECONDARY_THRESHOLDS.minImageAltRatio) {
      warnings.push({
        metric: 'imageAlt',
        severity: 'warn',
        actual: Math.round(altRatio * 100),
        threshold: Math.round(SECONDARY_THRESHOLDS.minImageAltRatio * 100),
        message: `이미지 alt 충실도 ${altStats.withAlt}/${altStats.total} (${Math.round(altRatio * 100)}%) — AdSense 접근성·SEO 점수 저하. 모든 이미지에 의미 있는 alt 텍스트 필요.`,
      });
    }
  }

  // 내부 링크 검증
  if (internalLinkCount < SECONDARY_THRESHOLDS.minInternalLinks) {
    warnings.push({
      metric: 'internalLinks',
      severity: 'warn',
      actual: internalLinkCount,
      threshold: SECONDARY_THRESHOLDS.minInternalLinks,
      message: `내부 링크 ${internalLinkCount}개 — site_navigation 거절 위험. 관련 글 ${SECONDARY_THRESHOLDS.minInternalLinks}+ 내부 링크 권장.`,
    });
  }

  // 출처 환각 휴리스틱 검증
  const sourceVerify = verifyCitationHeuristics(text);
  if (sourceVerify.suspicionScore >= 50) {
    warnings.push({
      metric: 'sourceSuspicion',
      severity: 'warn',
      actual: sourceVerify.suspicionScore,
      threshold: 50,
      message: `출처 환각 의심도 ${sourceVerify.suspicionScore}/100 — AI가 가짜 통계를 만들었을 가능성. 본문 인용 ${sourceVerify.citationCount}건 검토 권장.`,
    });
  } else if (sourceVerify.suspicionScore >= 25 && sourceVerify.signals.specificityScore >= 15) {
    // 의심도는 중간이지만 구체성 부족이 두드러질 때만 별도 경고
    warnings.push({
      metric: 'sourceSuspicion',
      severity: 'warn',
      actual: sourceVerify.signals.specificityScore,
      threshold: 15,
      message: `출처 인용에 연도·조사명 동반 부족 (구체성 결손 ${sourceVerify.signals.specificityScore}/25). 예: "통계청 2026 인구주택총조사에 따르면" 형식으로 보강.`,
    });
  }

  // 메타 description 검증 (있을 때만 길이 체크 — 없으면 별도 경고)
  if (metaDescLength === 0) {
    warnings.push({
      metric: 'metaDescription',
      severity: 'warn',
      actual: 0,
      threshold: SECONDARY_THRESHOLDS.minMetaDescLength,
      message: `메타 description 누락 — 검색 노출 클릭률 저하. ${SECONDARY_THRESHOLDS.minMetaDescLength}~${SECONDARY_THRESHOLDS.maxMetaDescLength}자 추가 권장.`,
    });
  } else if (metaDescLength < SECONDARY_THRESHOLDS.minMetaDescLength) {
    warnings.push({
      metric: 'metaDescription',
      severity: 'warn',
      actual: metaDescLength,
      threshold: SECONDARY_THRESHOLDS.minMetaDescLength,
      message: `메타 description ${metaDescLength}자 — 너무 짧음. ${SECONDARY_THRESHOLDS.minMetaDescLength}~${SECONDARY_THRESHOLDS.maxMetaDescLength}자 권장.`,
    });
  }

  const metrics: ContentQualityMetrics = {
    textLength,
    rawLength,
    paragraphCount,
    sourceMentions,
    sentenceAvgLength: sentStats.avgLength,
    sentenceCount: sentStats.count,
    imageCount: altStats.total,
    imagesWithAlt: altStats.withAlt,
    internalLinkCount,
    metaDescriptionLength: metaDescLength,
  };

  const ok = warnings.length === 0;
  const summary = ok
    ? `✅ 품질 게이트 통과 (정보량 ${textLength}, 단락 ${paragraphCount}, 출처 ${sourceMentions}회, alt ${altStats.withAlt}/${altStats.total}, 내부링크 ${internalLinkCount}개, 출처의심 ${sourceVerify.suspicionScore})`
    : `⚠️ 품질 게이트 경고 ${warnings.length}건 — 발행은 진행하지만 AdSense 승인률 저하 가능 (정보량 ${textLength}, 단락 ${paragraphCount}, 출처 ${sourceMentions}회, alt ${altStats.withAlt}/${altStats.total}, 내부링크 ${internalLinkCount}개, 출처의심 ${sourceVerify.suspicionScore})`;

  return { ok, warnings, metrics, summary, sourceVerify };
}
