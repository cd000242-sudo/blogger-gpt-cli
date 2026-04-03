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
