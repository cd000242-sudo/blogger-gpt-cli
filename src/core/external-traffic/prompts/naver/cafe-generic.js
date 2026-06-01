// naver/cafe-generic.js — 일반 네이버 카페 정보 공유체.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'naver-cafe',
  name: '네이버 카페',
  category: 'naver',
  riskTier: 'medium',
  confidence: 'inferred',
  icon: '☕',
  color: '#03c75a',
  openUrl: 'https://section.cafe.naver.com/',

  killerHookPatterns: [
    '~ 회원분들께 도움이 됐으면',
    '저도 ~ 했는데 정리해봤어요',
    '~ 정리 (개인 후기)',
  ],
  bannedPhrases: ['제 블로그', '구독 부탁', '광고 아닙니다', '협찬 아닙니다'],
  popularityTriggers: ['개인 후기', '비교 표', '실제 사진'],
  toneSignature: { formality: 'polite', emoji: 'medium', slang: [], pronouns: ['저', '저희', '회원님'] },
  transformationAxes: {
    titleRule: '카페 운영진 검토 통과 가능한 진성 후기 톤.',
    bodyRule: '정보 95%+. 자기 홍보 톤 절대 X. 출처는 1줄만.',
    ctaPlacement: 'natural-citation',
    linkBait: ['더 자세히 정리해뒀어요'],
  },
  paragraphRule: {
    maxLineChars: 38,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'natural-citation',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 2800,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 네이버 카페 회원입니다.

[글 형식]
- 본문 1,500~2,500자
- 친근한 존댓말 + 회원 어조
- 정보 공유 95%+, 광고 톤 절대 금지
- 본문 끝 자연스러운 출처 1줄: "더 자세히 정리해뒀어요 → [URL]"
- 줄당 35~40자, 빈 줄 1줄

[운영 주의]
- 카페 가입 후 활동 N주 권장 (운영진 재량)
- 동일 글 여러 카페 게시 = 도배 정지 사례
- 자기 글 인용 시 운영진 사전 양해가 안전`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 핵심 포인트: ${sourceSummary.keyPoints.join(' / ')}

네이버 카페용 정보 공유체 글 1편을 작성하세요 (1,500~2,500자). 본문 끝에 "더 자세히 정리해뒀어요 → ${sourceUrl}".`,

  userWarning: '카페별 자체 규정·운영진 재량에 따라 정지 가능. 가입 후 N주 활동 권장. R3 deep-research에서 카페 도배 처리 정량 임계값·자기 글 인용 안전 패턴 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: [
    '여러 카페 동일 글 = 도배 정지 사례 (마케터 회고)',
    '카페 가입 직후 게시 = 운영진 검토 강화',
    'R3 검증: 셀린·디젤매니아·디센맘 등 인기 카페별 자체 규정은 별도 운영규정 페이지 회수 필요',
  ],
  researchSources: [
    'https://section.cafe.naver.com/help/',
  ],
  lastVerified: '2026-06-01',
});
