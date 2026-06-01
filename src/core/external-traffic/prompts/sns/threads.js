// src/core/external-traffic/prompts/sns/threads.js
// Threads — 500자 한도, 첫 1~2줄 후킹, 댓글 답변으로 +42% engagement.
// R1 deep-research (2026-06-01) 결과 반영 — confidence: verified.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const THREADS = {
  id: 'threads',
  name: 'Threads',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '🧵',
  color: '#000000',
  openUrl: 'https://www.threads.com/',

  // R1 검증: 첫 1~2줄 후킹이 모바일 가독성 'more' 잘림 전에 curiosity/tension 생성 필수.
  killerHookPatterns: [
    '~ 한 사람만 좋아요',
    '솔직히 ~ 인 사람?',
    '나만 ~ 라고 생각함?',
    '~ 했더니 ~ 됐다',
    '결론부터: ~',
    '아직 ~ 하는 사람 있음?',
    '진짜 ~ 모르는 사람 많은 듯',
    '~ 잘 모르겠어서 정리해봤어요',
    '오늘 알게 된 ~ 한 가지',
    '~ 인데 다들 어떻게 함?',
  ],
  // R1 검증: Meta engagement bait penalty + 셀링 카피보다 정보·브랜딩 우세.
  bannedPhrases: [
    '제 블로그',
    '방문해주세요',
    '더 자세한 내용은',
    '구독해주세요',
    '좋아요 눌러주세요',  // Meta engagement bait
    '댓글 부탁드려요',     // Meta engagement bait
    '리포스트 부탁드려요', // Meta engagement bait
    '판매중',              // 셀링 카피 페널티 (Buffer 분석)
    '할인',                // 명시적 셀링 표현 (도달 감소)
  ],
  // R1 검증: 댓글 답변이 전 플랫폼 최고 +42% engagement (Buffer 128K Threads 포스트 분석).
  popularityTriggers: [
    '질문으로 끝내기 (댓글 유도)',
    '논쟁 유도 (의견 양분)',
    '본인 경험 1줄',
    '인사이트 압축 1줄',
    '댓글 답변 +42% engagement',
    '키워드 검색 후 진정성 댓글 10개/일',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'minimal',
    slang: ['진짜', '솔직히', '근데', '결국'],
    pronouns: ['저', '나'],
  },
  transformationAxes: {
    titleRule: '첫 1~2줄 = 질문 또는 반전. 모바일 \'more\' 잘림 전에 후킹 완성.',
    bodyRule: '500자 이내. 짧은 punchy 문장 + 줄바꿈으로 가독성. 정보·브랜딩 톤이 셀링보다 우세.',
    ctaPlacement: 'inline',
    linkBait: [
      '전체 글:',
      '풀버전:',
      '정리:',
      '자세히는:',
    ],
  },
  paragraphRule: {
    maxLineChars: 28,
    paragraphBreak: 'single',
    emptyLineMaxConsecutive: 0,
    maxLines: 14,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 500,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 Threads 사용자입니다 (2025~2026 알고리즘 검증).

[글 형식 — R1 검증 기반]
- 500자 이내 (한도)
- 첫 1~2줄 = 질문/반전/도발적 1줄 (모바일 'more' 잘림 전에 hook 완성 필수)
- 짧은 punchy 문장 + 과감한 줄바꿈 (Mosseri/Buffer 권장)
- 빈 줄 0개 (single break — 호흡만 \n)
- 인라인 링크 1개 (Mosseri 2025-06: "한 달 이상 링크가 훨씬 잘 작동 중" 공식 확인)

[Threads 핵심 KPI — R1 검증]
- 팔로워 수가 KPI 아님. 포스트별 조회수·인게이지먼트.
- 알고리즘이 슬롯머신처럼 비팔로워에도 분배.
- 댓글 답변 시 +42% engagement (전 플랫폼 최고치, Buffer 128K 포스트 분석)
- 정보·브랜딩 톤이 셀링 카피보다 우세 (광고 피로감)

[CTA]
- 본문 끝 1줄 "전체 글: [URL]"
- 자기 홍보 어투 금지 — 정보 공유 톤 유지

[금지 — Meta engagement bait 페널티]
- "좋아요 눌러주세요" / "댓글 부탁드려요" / "리포스트 부탁드려요"
- 명시적 셀링 표현 ("할인", "판매중") = distribution demotion`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}

Threads 게시물 1개를 500자 이내로 작성하세요. 첫 1~2줄 = 질문 또는 반전 (모바일 'more' 잘림 전 hook 완성). 짧은 punchy 문장 + 과감한 줄바꿈. 본문 = 핵심 인사이트 1~2개. 정보·브랜딩 톤 (셀링 X). 끝에 "전체 글: ${sourceUrl}".`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, THREADS);
  },

  userWarning: null,
  operationalNotes: [
    '인스타와 다르게 텍스트 우선 — 영상·이미지 없어도 도달',
    '인라인 링크 5개 이상이면 도달 감소',
    '댓글 답변 시 +42% engagement (Buffer 검증)',
    '자기 포스트 1개당 키워드 검색 진정성 댓글 10개 권장 전략',
    '2025 engagement -18% 추세 (4.4%→3.6%) — 답글·댓글이 회복 핵심',
  ],
  researchSources: [
    'https://buffer.com/resources/threads-comments-engagement/',
    'https://buffer.com/resources/replying-to-comments-boosts-engagement/',
    'https://miraflow.ai/blog/threads-algorithm-2026-how-to-grow-meta-text-platform',
    'https://socialmediatoday.com/news/meta-says-link-posts-ranked-properly-threads-reach/750126/',
    'https://www.threads.com/@mosseri/post/DCpQG0hz0m8',
  ],
  lastVerified: '2026-06-01',
};

module.exports = THREADS;
