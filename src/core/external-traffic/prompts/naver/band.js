// naver/band.js — 네이버 밴드.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'naver-band',
  name: '네이버 밴드',
  category: 'naver',
  riskTier: 'medium',
  confidence: 'inferred',
  icon: '🎵',
  color: '#00c73c',
  openUrl: 'https://band.us/',

  killerHookPatterns: ['~ 정리해봤어요', '회원분들 공유합니다'],
  bannedPhrases: ['광고', '협찬', '홍보'],
  popularityTriggers: ['친밀감', '체크리스트', '본인 사진'],
  toneSignature: { formality: 'polite', emoji: 'medium', slang: [], pronouns: ['저', '회원님'] },
  transformationAxes: {
    titleRule: '간결 + 회원 친화 어조.',
    bodyRule: '본문 400~800자. 한 글에 외부 링크 1~2개.',
    ctaPlacement: 'end-of-body',
    linkBait: ['정리한 글', '관련 정보'],
  },
  paragraphRule: {
    maxLineChars: 36,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 45, medium: 70, high: 90, critical: 100 },
  maxOutputTokens: 2500,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 네이버 밴드 운영자/회원입니다.

[글 형식]
- 본문 400~800자
- 친근한 존댓말
- 본문 끝 URL 1개 OK ("정리한 글: [URL]")
- 줄당 32~36자, 빈 줄 1줄

[운영 주의]
- 같은 밴드 24h 내 중복 게시 = 도배 처리
- 광고 신고 임계값 낮음 — 진성 어조 유지`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}

네이버 밴드 게시물 400~800자를 작성하세요. 끝에 "정리한 글: ${sourceUrl}".`,
  userWarning: 'R3 deep-research에서 외부 링크 도달 정책·24h 재게시 도배 처리 기준 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R3 공식 정책 페이지 회수 필요 — 운영자 재량에 의존'],
});
