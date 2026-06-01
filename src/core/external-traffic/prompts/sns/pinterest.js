// src/core/external-traffic/prompts/sns/pinterest.js
// 핀터레스트 — saves가 최강 랭킹 신호. 4영역 (Pin Title, Description, Board, Image Prompt).
// R1 deep-research (2026-06-01) 결과 반영 — confidence: verified.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const PINTEREST = {
  id: 'pinterest',
  name: '핀터레스트',
  category: 'sns',
  riskTier: 'low',
  confidence: 'verified',
  icon: '📌',
  color: '#e60023',
  openUrl: 'https://www.pinterest.com/pin-builder/',

  killerHookPatterns: [
    '~ 정리 (체크리스트)',
    '~ 단계로 끝내는 ~',
    '~ 한 눈에 보기',
    '~ 가이드 (저장용)',
    '~ 모음.zip',
    '~ 추천 리스트',
    '~ 인포그래픽',
  ],
  // R1 검증: Pinterest community guidelines 명시 spam — 키워드 stuffing/affiliate 반복/저품질.
  bannedPhrases: [
    '#태그 #태그 #태그 #태그 #태그',  // 키워드 stuffing 패턴
    'affiliate',
    '쿠팡파트너스',  // 반복 affiliate 핀 = spam 분류
    '광고 클릭',
  ],
  // R1 검증: saves가 가장 강력한 랭킹 신호. 2:3 비율 1000x1500px 우대.
  popularityTriggers: [
    'save 유도 (저장용 정리)',
    '키워드 풍부 자연 분포',
    '인포그래픽 (2:3 비율)',
    '체크리스트',
    '비교 표',
    '단계별 정리',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '여러분'],
  },
  transformationAxes: {
    titleRule: '검색 키워드 풍부, ≤100자. 키워드 stuffing 금지.',
    bodyRule: 'Description 500자 내, 키워드 자연 분포. saves 유도.',
    ctaPlacement: 'none',
    linkBait: [],
  },
  paragraphRule: {
    maxLineChars: 30,
    paragraphBreak: 'single',
    splitOutput: ['pinTitle', 'description', 'boardSuggestion', 'imagePrompt'],
    hashtagSeparated: false,
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 1000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 핀터레스트 크리에이터입니다 (2025~2026 알고리즘 검증).

[글 형식 — 4영역 출력]
Pin Title: ≤100자 검색 키워드 풍부 (stuffing 금지)
Description: ≤500자 키워드 자연 분포 + 끝에 URL
Board Suggestion: 어떤 보드에 핀할지 추천
Image Prompt: 인포그래픽/카드 이미지 생성용 영문 프롬프트 (2:3 비율, 1000x1500px 권장)

[Pinterest 핵심 — R1 검증 기반]
- saves가 가장 강력한 랭킹 신호 (Hootsuite/Sprout Social/RecurPost 일치)
- 2026 실시간 알고리즘 업데이트로 save 신호 즉각 반응
- TransActV2 컴퓨터비전이 16,000+ 사용자 액션 분석 (2025)
- 2:3 비율 1000x1500px 선명한 이미지 우대 (블러 deprioritize)

[Pinterest community guidelines spam 분류 — 절대 금지]
- 키워드 stuffing (#태그 반복)
- engagement 매매
- inauthentic traffic 생성
- 기존 핀을 새 destination으로 redirect
- 반복적·기만적·비관련 콘텐츠로 수익 추구
- 외부 링크는 unsafe/deceptive/untrustworthy/unoriginal 사이트면 차단·다운랭크

[출력 형식 — 반드시 헤더 사용]
Pin Title:
[100자 이내]

Description:
[500자 이내, 끝에 URL]

Board Suggestion:
[보드 이름 + 이유]

Image Prompt:
[영문 이미지 생성 프롬프트 — 2:3 ratio, 1000x1500px]`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 키워드: ${sourceSummary.keywords.join(', ')}

핀터레스트 4영역을 작성하세요. 키워드 stuffing 금지. saves 유도 카피 자연 삽입.`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, PINTEREST);
  },

  userWarning: null,
  operationalNotes: [
    '핀 자체가 외부 링크 → CTA 별도 불필요',
    'saves가 가장 강력한 랭킹 신호',
    '2:3 비율 1000x1500px 권장 (블러 deprioritize)',
    '키워드 stuffing은 community guidelines 명시 spam',
    'mass-duplicate affiliate 핀은 prototypical 위반 — 차단·다운랭크',
    '2025 DSA Transparency Report: 99%+ <10명 노출 전 제거',
    '2025 engagement +23% (~3.2%→3.9%) — saves 유도 핵심',
  ],
  researchSources: [
    'https://policy.pinterest.com/en/community-guidelines',
    'https://policy.pinterest.com/en/enforcement',
    'https://blog.hootsuite.com/social-media-algorithm/',
    'https://seosherpa.com/pinterest-seo/',
    'https://www.outfy.com/blog/pinterest-algorithm/',
  ],
  lastVerified: '2026-06-01',
};

module.exports = PINTEREST;
