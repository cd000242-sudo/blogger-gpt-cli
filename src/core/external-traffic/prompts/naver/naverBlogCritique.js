'use strict';

const { scoreTitleLocally } = require('./naverBlogTitleEngine');

function buildCritiqueInstructionBlock() {
  return `[네이버 블로그 자체 비평]
각 A/B/C 안을 100점 만점으로 평가한다.

평가 기준:
- 제목이 검색 의도와 맞는가: 15
- 제목이 클릭할 만큼 구체적인가: 15
- 원문 문맥에 맞게 작성했는가: 15
- 본문이 700~1200자 미니 포스트로 충분한가: 10
- 존댓말 정보글 구조를 갖췄는가: 10
- 키워드가 자연스럽게 포함됐는가: 10
- 원문 클릭 이유가 자연스러운가: 10
- 광고 느낌이 적은가: 5
- 원문에 없는 허위/과장이 없는가: 10

85점 미만이면 같은 안을 다시 개선한다.
90점 이상을 최종 개선안으로 표시한다.
95점 이상이면 추천 배지를 표시할 수 있게 recommended를 true로 둔다.`;
}

function scoreVariantLocally(variant, context) {
  const copy = buildPlainCopy(variant);
  let score = 50;
  score += Math.min(20, Math.round(scoreTitleLocally(variant.selectedTitle, context) / 5));
  if (copy.length >= 700 && copy.length <= 1200) score += 14;
  if (/(입니다|합니다|습니다|좋습니다|있습니다)/.test(copy)) score += 8;
  if (/(자세한 내용은 링크|지금 바로|클릭하세요|보러가기)/.test(copy)) score -= 18;
  if (/(무조건|100%|반드시 됩니다|확정입니다|보장)/.test(copy)) score -= 20;
  if (/https?:\/\//.test(copy)) score += 6;
  if ((variant.titleCandidates || []).length >= 10) score += 6;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildPlainCopy(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  const sections = Array.isArray(finalRevision.sections) ? finalRevision.sections : [];
  return [
    finalRevision.title || variant.selectedTitle,
    finalRevision.intro || variant.intro,
    ...sections.flatMap((section) => [section.heading, section.body]),
    finalRevision.sourceLead || variant.sourceLead,
    finalRevision.commentPrompt || variant.commentPrompt,
    ...(finalRevision.hashtags || variant.hashtags || []),
  ].filter(Boolean).join('\n\n');
}

module.exports = {
  buildCritiqueInstructionBlock,
  scoreVariantLocally,
};
