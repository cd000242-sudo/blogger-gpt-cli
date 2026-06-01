'use strict';
const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

function makeSpecialized(spec) {
  return makeChannel({
    category: 'community',
    riskTier: spec.riskTier || 'high',
    confidence: 'inferred',
    icon: spec.icon,
    color: spec.color,
    openUrl: spec.openUrl,
    bannedPhrases: ['제 블로그', '방문해주세요', '구독 부탁', '홍보'].concat(spec.bannedPhrases || []),
    popularityTriggers: spec.popularityTriggers || ['도메인 전문성', '실측 데이터'],
    toneSignature: spec.toneSignature || { formality: 'casual', emoji: 'minimal', slang: [], pronouns: [] },
    paragraphRule: {
      maxLineChars: 'no-limit',
      paragraphBreak: 'double',
      emptyLineMaxConsecutive: 1,
      ctaSection: 'natural-citation',
    },
    bandThresholds: { low: 30, medium: 55, high: 80, critical: 95 },
    maxOutputTokens: 1600,
    operationalNotes: spec.operationalNotes || ['R4 deep-research 약관·정지 사례 1차 출처 미확보 — 운영자 재량에 의존'],
    userWarning: spec.userWarning || 'R4 deep-research에서 약관·정지 사례 1차 출처 미확보 — confidence: inferred. 도메인 전문성·진성 어조 필수.',

    buildSystemPrompt: (subChannel, userCustomRule) => {
      const base = `당신은 ${spec.name} 회원입니다 (${spec.domainNote || '전문 도메인'}).

[글 형식]
- 본문 500~1,200자
- 어조: ${spec.toneNote || '반말 + 도메인 전문 용어'}
- ${spec.domainNote || '도메인 전문성'} 노출 필수
- 본문 끝 1줄만 "출처: [URL]"
- 자기 홍보 어투 금지`;
      return appendUserNoteSafely(base, userCustomRule);
    },
    buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 데이터: ${sourceSummary.dataPoints.join(', ')}

${spec.name}에 어울리는 글 1편을 작성하세요 (500~1,200자). 본문 끝에 "출처: ${sourceUrl}".`,
    ...spec,
    id: spec.id,
    name: spec.name,
  });
}

module.exports = { makeSpecialized };
