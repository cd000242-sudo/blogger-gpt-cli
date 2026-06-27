// communities/_community-base.js — 한국 커뮤니티 공통 base 템플릿.
// 채널별 파일은 차이점만 spec으로 합성.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
// v3.8.265: 커뮤니티 채널들도 viral DNA + UNIVERSAL_BANNED_PHRASES 통합
const { UNIVERSAL_BANNED_PHRASES, buildViralDnaBlock } = require('../../_shared/viral-dna');

const COMMON_BANNED = [
  '제 블로그',
  '방문해주세요',
  '구독 부탁',
  '안녕하세요 글쓴이입니다',
  '정보 공유 차원에서',
  '더 자세한 내용은',
  '협찬 아닙니다',
  '광고 아닙니다',
  // v3.8.265: viral DNA 50+개 차단어 자동 통합
  ...UNIVERSAL_BANNED_PHRASES,
];

/**
 * @param {Object} spec
 * @returns {import('../../_shared/types').ChannelPrompt}
 */
function makeCommunity(spec) {
  return makeChannel({
    category: 'community',
    riskTier: spec.riskTier || 'high',
    confidence: 'inferred',
    bannedPhrases: COMMON_BANNED.concat(spec.bannedPhrases || []),
    popularityTriggers: spec.popularityTriggers || ['반전 정보', '실측 데이터', '비교 표', '논쟁 유도'],
    paragraphRule: {
      maxLineChars: spec.maxLineChars || 'no-limit',
      paragraphBreak: 'double',
      emptyLineMaxConsecutive: 1,
      ctaSection: 'natural-citation',
    },
    bandThresholds: spec.bandThresholds || { low: 25, medium: 50, high: 75, critical: 90 },
    maxOutputTokens: spec.maxOutputTokens || 1800,

    buildSystemPrompt: (subChannel, userCustomRule) => {
      // v3.8.265: viral DNA 블록 자동 주입 (7원칙 + 디테일 hint + FACT 강제)
      const viralDnaBlock = buildViralDnaBlock({ platformName: spec.name, requireAllPatternsDistinct: true });
      const base = `당신은 한국 ${spec.name} 회원입니다 (3~5년차 익명 회원).

[글 형식]
- 본문 600~1,200자
- 어조: ${spec.toneNote || '익명·반말 또는 부드러운 존댓말'}
- 정보 70% + 의견 30%
- 본문 끝 1줄만 "출처: [URL]" 형태 — 그 외 링크 X

[금기 — 즉시 신고/정지 트리거]
- 자기 홍보 어투 ("제 블로그", "방문해주세요" 등)
- 흔한 위장 표현 ("정보 공유 차원에서" 등) — 이미 들통난 패턴
- "안녕하세요 글쓴이입니다" 같은 자수
- 본문에 외부 URL 다수

[추천 받는 패턴]
${(spec.popularityTriggers || []).map((t) => `- ${t}`).join('\n')}
${viralDnaBlock}
${spec.subChannelNote ? `[서브 게시판/갤러리]\n${spec.subChannelNote}\n` : ''}
${spec.extraRules || ''}`;
      return appendUserNoteSafely(base, userCustomRule);
    },

    buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle, subChannel, userCustomRule }) => {
      const subNote = subChannel && spec.subChannels
        ? (spec.subChannels.find((s) => s.id === subChannel) || {}).rule || ''
        : '';
      return `원본 글: "${sourceTitle}"
URL (본문 끝 1줄에만 사용): ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}
- 데이터: ${sourceSummary.dataPoints.join(', ')}

${subNote ? `[서브 채널 특이사항]\n${subNote}\n` : ''}
위 정보를 바탕으로 ${spec.name}에 어울리는 글 1편을 작성하세요 (600~1,200자). 본문 끝에 "출처: ${sourceUrl}" 1줄만.`;
    },

    userWarning: spec.userWarning || `${spec.name}은(는) 자기 홍보 게시 위험이 매우 높습니다.\n운영 노하우 부족하면 본 도구 결과를 그대로 게시하지 마세요.`,
    operationalNotes: spec.operationalNotes || [
      '같은 게시판/갤러리에 같은 글 = 도배 정지',
      '여러 게시판에 같은 글 = 즉시 정지',
      '계정 연차 6개월+ 권장',
    ],
    researchSources: spec.researchSources || [],
    lastVerified: '2026-06-01',
    ...spec,
  });
}

module.exports = { makeCommunity, COMMON_BANNED };
