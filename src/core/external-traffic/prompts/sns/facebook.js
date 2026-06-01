// src/core/external-traffic/prompts/sns/facebook.js
// Facebook — 개인/그룹 2변형. Meta engagement bait 페널티 명시 반영.
// R1 deep-research (2026-06-01) 결과 반영 — confidence: verified.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const FACEBOOK = {
  id: 'facebook',
  name: 'Facebook',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '👥',
  color: '#1877f2',
  openUrl: 'https://www.facebook.com/',

  killerHookPatterns: [
    '오늘 ~ 한 일',
    '~ 인 분들께 도움이 됐으면',
    '진짜 ~ 한 사람 손',
    '제가 ~ 해본 결과',
    '~ 알고 계신 분 있으세요?',
    '~ 정리해봤어요',
    '경험상 ~ 더라고요',
    '~ 한 이야기 공유',
  ],
  // R1 검증: Meta 'engagement bait' Transparency Center 공식 명시 페널티.
  bannedPhrases: [
    '이거 광고 아니에요',
    '제발 봐주세요',
    '좋아요 눌러주세요',  // Meta engagement bait
    '댓글 부탁드려요',     // Meta engagement bait
    '친구 태그해주세요',   // Meta engagement bait
    '공유 부탁드려요',     // Meta engagement bait
    '리액션 부탁드려요',   // Meta engagement bait
  ],
  popularityTriggers: [
    '스토리텔링',
    '경험 공유',
    '체크리스트',
    '비교 정리',
    '본인 후기 사진',
    'specific call to action (engagement bait 예외)',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'medium',
    slang: [],
    pronouns: ['저', '저희'],
  },
  transformationAxes: {
    titleRule: '첫 문장 = 개인 경험 또는 공감 유도.',
    bodyRule: '본문 500~1,500자, 빈 줄로 호흡 분리. 진성 톤 (광고 어투 페널티).',
    ctaPlacement: 'inline',
    linkBait: [
      '전체 정리는 여기:',
      '자세한 내용 정리해뒀어요:',
      '제 글 정리:',
    ],
  },
  paragraphRule: {
    maxLineChars: 40,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    splitOutput: ['personal', 'group-comment'],
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 1500,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 Facebook 사용자입니다 (2025~2026 알고리즘 검증).

[글 형식 — 두 변형 출력]
[개인 계정] 500~1,500자
  - 친근한 존댓말 + 본인 경험 분위기
  - 본문 끝에 URL 직접 박기 OK
  - 줄당 35~40자, 문단 사이 빈 줄 1줄

[그룹 댓글] 미끼 글 + 별도 댓글 링크
  - 본문은 미끼만 (URL 없이 300~500자)
  - 댓글에 박을 한 줄 + URL

[금지 — Meta engagement bait 공식 페널티 (Transparency Center)]
- "좋아요 눌러주세요" / "댓글 부탁드려요" / "친구 태그해주세요" / "공유 부탁드려요"
- 명확한 call-to-action 목적 없는 engagement 요청 = distribution demotion
- 'specific call to action' 예외만 인정 (실제 행동 유도 — 예: "응급키트 신청은 댓글로")

[2025 추세]
- Facebook engagement +11% 증가 (5.6%) — 텍스트 콘텐츠 회복
- Page는 외부 링크 도달 감소 → 댓글 링크 권장
- 개인 계정은 본문 URL OK

[출력 형식 — 반드시 두 헤더 사용]
[개인 계정]
[본문...]

[그룹 댓글]
[미끼 본문...]
댓글:
[한 줄 + URL]`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}

Facebook 2변형을 작성하세요. "[개인 계정]" 헤더 + 본문 500~1,500자 + URL, "[그룹 댓글]" 헤더 + 미끼 본문 (URL X) + 댓글 한 줄. engagement bait 카피 절대 금지.`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, FACEBOOK);
  },

  userWarning: null,
  operationalNotes: [
    'Page는 외부 링크 도달 감소 → 댓글 링크 권장',
    '개인 계정은 본문 URL OK',
    '동일 그룹 24h 내 재게시 시 도배 처리',
    '2025 engagement +11% (5.6%) — 텍스트 회복',
    'Meta engagement bait 공식 페널티 (2017-12 발효 이후 유지)',
  ],
  researchSources: [
    'https://transparency.meta.com/features/approach-to-ranking/content-distribution-guidelines/engagement-bait',
    'https://hashmeta.com/insights/facebook-algorithm-changes-2025',
    'https://buffer.com/resources/state-of-social-media-engagement-2026/',
  ],
  lastVerified: '2026-06-01',
};

module.exports = FACEBOOK;
