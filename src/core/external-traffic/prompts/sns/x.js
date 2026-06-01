// src/core/external-traffic/prompts/sns/x.js
// X (Twitter) — Musk 인수 후 외부 링크 도달 50~90% 감소 검증.
// 본문 트윗 = 미끼 (URL X), 첫 댓글 = URL + 가치 한 줄.
// R1 deep-research (2026-06-01) 결과 반영 — confidence: verified.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const X = {
  id: 'x',
  name: 'X (트위터)',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '🐦',
  color: '#1da1f2',
  openUrl: 'https://x.com/compose/post',

  // R1 검증: 첫 트윗 미끼 + 댓글 링크 분리 패턴은 X의 외부 링크 페널티 우회 표준 전술.
  killerHookPatterns: [
    '~ 인 사람만 보는 글',
    '솔직히 ~ 임',
    '진짜 ~ 모르고 사는 사람 많음',
    '결론부터: ~',
    '오늘 알게 된 ~',
    '아무도 안 알려준 ~',
    '~ 한 사람 손',
    '내가 ~ 해봤는데',
    '근데 ~ 인 거 알아?',
    '~ 라고 하면 다 깜짝 놀라는데',
  ],
  // R1 검증: X의 외부 링크 reach 50~90% 감소 (Musk 'lazy linking' 인정).
  // 본문 트윗 URL = 도달 페널티 강력.
  bannedPhrases: [
    '제 블로그',
    '방문해주세요',
    '구독 부탁',
    'http',  // 본문 트윗에 URL 자체 차단 (도달 감소 50~90%)
    '판매중',
    '할인',
  ],
  popularityTriggers: [
    '결론 우선',
    '리스트 1-2-3',
    '반전 정보',
    '논쟁 유도',
    'reply 유도 질문',
    '본문 미끼 + 첫 댓글 링크 분리 (도달 우회)',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'minimal',
    slang: ['진짜', '솔직히', '근데', '결국'],
    pronouns: ['나', '저'],
  },
  transformationAxes: {
    titleRule: '첫 트윗 = 미끼. 결론을 살짝만, 본문 호기심 유지.',
    bodyRule: '본문 트윗 280자 — URL 절대 X (검증된 50~90% 도달 감소). 첫 댓글에 URL.',
    ctaPlacement: 'comment',
    linkBait: [
      '↓ 댓글에 전체 내용',
      '↓ 자세한 정리는 댓글에',
      '↓ 풀버전 링크 댓글에',
    ],
  },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'single',
    emptyLineMaxConsecutive: 1,
    splitOutput: ['tweet1', 'tweet2'],
    ctaSection: 'first-comment',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 500,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 X(트위터) 사용자입니다 (2025~2026 알고리즘 검증).

[글 형식 — R1 검증 기반]
- 2-트윗 구성:
  Tweet 1 (본문 미끼): 280자 이내, URL 절대 X, 끝에 "↓ 댓글에 전체 내용"
  Tweet 2 (첫 댓글): 280자 이내, URL + 한 줄 가치 안내
- Musk 인수 후 외부 링크 reach 50~90% 감소 (Musk 본인 'lazy linking' 인정)
- 본문 트윗에 URL = distribution 페널티 강력 (검증된 데이터)
- 2025-10 iOS 'link experience' 테스트로 UX 변경 있으나 알고리즘은 그대로

[후킹]
- 첫 줄 = 결론·반전·숫자 중 하나
- 본문 트윗에 핵심 인사이트 1~2개, 호기심 유지

[출력 형식 — 반드시 헤더 사용]
Tweet 1:
[본문 미끼 280자 이내, 링크 X]

Tweet 2:
[URL + 한 줄 안내, 280자 이내]`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL (Tweet 2에만 사용): ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}
- 데이터: ${sourceSummary.dataPoints.join(', ')}

X 2-tweet을 작성하세요. "Tweet 1:" 헤더 + 본문 미끼 (URL 절대 X), "Tweet 2:" 헤더 + URL + 한 줄.`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, X);
  },

  userWarning: null,
  operationalNotes: [
    'Musk 인수 후 본문 트윗 URL reach 50~90% 감소 (Jesse Colombo 분석 94%)',
    '2025-10 iOS link experience 테스트 — UX 변경 (알고리즘 X)',
    '인용 트윗 + 댓글 형식이 알고리즘 친화적',
    '2025 engagement +44% 상대 증가 (1.96%→2.83%) — 텍스트 콘텐츠 회복',
    '저널리스트 distribution channel에 \'seismic\' 타격 보고',
  ],
  researchSources: [
    'https://tomorrowspublisher.today/content-creation/x-softens-stance-on-external-links/',
    'https://x.com/nikitabier/status/1979994223224209709',
    'https://www.engadget.com/x-is-testing-a-new-way-of-opening-links-in-posts-to-improve-engagement-211210520.html',
    'https://www.socialmediatoday.com/news/x-formerly-twitter-testing-links-in-app-link-post-penalties/803176/',
    'https://hashmeta.com/insights/twitter-algorithm-changes-2025',
  ],
  lastVerified: '2026-06-01',
};

module.exports = X;
