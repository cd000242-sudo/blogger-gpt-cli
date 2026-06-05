'use strict';

const FORBIDDEN_PHRASES = [
  '무조건 가능',
  '누구나 가능',
  '100% 보장',
  '반드시 됩니다',
  '확정입니다',
  '신청만 하면 됩니다',
  '치료됩니다',
  '완치됩니다',
  '수익 보장',
  '클릭 강요',
  '좋아요 눌러주세요',
  '댓글 부탁드려요',
  '친구 태그해주세요',
  '공유 부탁드려요',
];

const SAFETY_REPLACEMENTS = [
  '조건에 따라 달라질 수 있습니다',
  '개인 상황에 따라 확인이 필요합니다',
  '세부 기준은 확인이 필요합니다',
  '예외사항이 있을 수 있습니다',
  '본문에서 확인 가능한 범위만 정리했습니다',
  '자세한 기준은 원문에서 확인할 수 있습니다',
];

function scoreFirstLineLocally(firstLine, context) {
  const text = String(firstLine || '').trim();
  if (!text) return 0;
  let score = 55;
  if (text.length >= 12 && text.length <= 38) score += 10;
  if (/[?]/.test(text) || /(확인|체크|놓치|헷갈|먼저|기준|이유|정리)/.test(text)) score += 10;
  if (context && context.articleType && text.includes(String(context.articleType).split('/')[0])) score += 5;
  if (FORBIDDEN_PHRASES.some((phrase) => text.includes(phrase))) score -= 25;
  if (/무조건|100%|반드시|확정|완치|수익 보장/.test(text)) score -= 20;
  if (/클릭|방문|좋아요|댓글 부탁|공유 부탁/.test(text)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function scoreVariantLocally(variant) {
  if (!variant) return 0;
  let score = 55;
  const finalRevision = variant.finalRevision || {};
  const joined = [
    finalRevision.firstLine || variant.selectedFirstLine,
    finalRevision.body || variant.body,
    finalRevision.savePrompt || variant.savePrompt,
    finalRevision.sharePrompt || variant.sharePrompt,
    finalRevision.commentPrompt || variant.commentPrompt,
    finalRevision.linkPrompt || variant.linkPrompt,
    Array.isArray(finalRevision.hashtags || variant.hashtags) ? (finalRevision.hashtags || variant.hashtags).join(' ') : '',
  ].join('\n');
  if ((variant.firstLineScore || 0) >= 90) score += 10;
  if (/(저장|체크|나중|필요할 때)/.test(joined)) score += 8;
  if (/(공유|가족|지인|비슷한)/.test(joined)) score += 6;
  if (/(댓글|경험|어떤 부분|헷갈)/.test(joined)) score += 6;
  if (/(프로필|링크|원문|자세한)/.test(joined)) score += 6;
  if (FORBIDDEN_PHRASES.some((phrase) => joined.includes(phrase))) score -= 25;
  if (/무조건|100%|반드시|확정|완치|수익 보장/.test(joined)) score -= 20;
  return Math.max(0, Math.min(100, score));
}

function buildCritiqueInstructionBlock() {
  return `[안전장치와 자체 비평]
모든 안은 원문에 없는 고유명사, 금액, 조건, 기간, 대상자, 효과를 만들지 않는다.
아래 표현은 쓰지 않는다:
${FORBIDDEN_PHRASES.map((phrase) => `- ${phrase}`).join('\n')}

필요하면 아래처럼 완화해서 쓴다:
${SAFETY_REPLACEMENTS.map((phrase) => `- ${phrase}`).join('\n')}

첫 줄 점수는 100점 만점으로 평가한다.
- 3초 안에 멈추게 하는가: 30점
- 독자가 자기 상황을 떠올리는가: 20점
- 저장/공유 가능성이 있는가: 15점
- 원문 내용과 정확히 맞는가: 15점
- 과장/허위/공포 조장이 없는가: 10점
- 흔한 문장이 아닌가: 10점

자체 비평 점수는 100점 만점으로 평가한다.
- 첫 줄이 스크롤을 멈추게 하는가: 15점
- 원문 문맥에 맞게 작성되었는가: 15점
- 저장할 만한 요소가 있는가: 15점
- 공유하고 싶은 문장이 있는가: 10점
- 독자 상황을 정확히 찌르는가: 15점
- 링크 클릭 이유가 자연스러운가: 10점
- 광고 냄새가 적은가: 10점
- 원문에 없는 허위/과장이 없는가: 10점

85점 미만이면 finalRevision에서 반드시 다시 작성한다.
90점 이상이면 최종 개선안으로 표시한다.
95점 이상이면 추천 배지를 표시한다.`;
}

module.exports = {
  FORBIDDEN_PHRASES,
  SAFETY_REPLACEMENTS,
  scoreFirstLineLocally,
  scoreVariantLocally,
  buildCritiqueInstructionBlock,
};
