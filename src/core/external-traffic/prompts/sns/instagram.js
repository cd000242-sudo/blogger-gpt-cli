// src/core/external-traffic/prompts/sns/instagram.js
// 한국 인스타그램 — 캡션 + 해시태그 분리, 후킹 강.
// R1 deep-research (2026-06-01) 결과 반영 — confidence: verified.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

/** @type {import('../../_shared/types').ChannelPrompt} */
const INSTAGRAM = {
  id: 'instagram',
  name: '인스타그램',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '📷',
  color: '#e1306c',
  openUrl: 'https://www.instagram.com/',

  // R1 검증: 인스타 5가지 Feed 인터랙션 + send-driven reach.
  killerHookPatterns: [
    '아무도 안 알려준 ~ 3가지',
    '내가 ~ 했더니 일어난 일',
    '솔직히 ~ 이거 모르면 손해',
    '이거 저장해두세요 — ~ 정리 끝',
    '~ 알면 5초 만에 해결되는 거',
    '진짜 ~ 만 ~ 한 사람 손',
    '~ 인 사람만 보세요',
    '오늘 알게 된 ~ 충격 사실',
    '~ 안 하면 ~ 되는 이유',
    '제가 ~ 으로 ~ 한 방법',
  ],
  // R1 검증: Meta 공식 'engagement bait' (투표·공유·댓글·태그 강요) distribution penalty.
  // + 자기 홍보 어투 + 외부 SNS 링크.
  bannedPhrases: [
    '제 블로그',
    '방문해주세요',
    '더 자세한 내용은 아래 링크',
    '구독 부탁드려요',
    '안녕하세요 글쓴이입니다',
    '좋아요 눌러주세요',  // engagement bait (Meta 공식 페널티)
    '댓글 부탁드려요',     // engagement bait
    '친구 태그해주세요',   // engagement bait
    '공유 부탁드려요',     // engagement bait
  ],
  // R1 검증: send/save가 비팔로워(unconnected) 도달의 핵심 신호.
  popularityTriggers: [
    'send 유도 (친구에게 공유)',
    'save 유도 (저장해두세요)',
    '비교 표 카드뉴스',
    'before-after 카드뉴스',
    '체크리스트',
    '리스트형 1-2-3 구조',
    '댓글 답변으로 +21% engagement',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'medium',
    slang: ['요즘', '진짜', '레전드', '미쳤다'],
    pronouns: ['저', '우리'],
  },
  transformationAxes: {
    titleRule: '첫 줄 = 3초 안에 스크롤 멈추게. 결핍·반전·숫자 활용.',
    bodyRule: '정보 70% + 호기심 30%. 줄당 22자, 빈 줄 1줄 + ✨. send/save 유도 카피 포함.',
    ctaPlacement: 'profile',
    linkBait: [
      '👉 프로필 링크 클릭 ✨',
      '🔗 풀버전은 프로필에',
      '💌 자세한 정리는 프로필 링크',
      '📌 저장해두면 두고두고 활용',
      '🤝 친구에게 공유하면 좋은 정보',
    ],
  },
  paragraphRule: {
    maxLineChars: 22,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    emojiBetweenParagraphs: true,
    hashtagSeparated: true,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 1400,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 인스타그램 마케터입니다 (2025~2026 알고리즘 검증).

[글 형식 — R1 검증 기반]
- 캡션 본문 1,200~2,000자 (상한 2,200자)
- 줄당 20~22자 권장 — 모바일 가독성 우선
- 문단 사이 빈 줄 1개만 (연속 빈 줄은 압축됨)
- 문단 사이에 ✨ 같은 분리 이모지 1개

[후킹 원칙 — Instagram 5가지 Feed 인터랙션 활용]
- 첫 줄은 3초 안에 스크롤 멈추게 — 결핍·반전·숫자
- 인스타 랭킹 핵심: watch time, likes, sends, comments, 프로필 탭 (Mosseri 2025 공식)
- sends가 비팔로워 도달의 핵심 → 친구에게 공유 유도
- saves가 evergreen reach의 핵심 → "저장해두세요" 자연 포함

[CTA]
- 본문 링크 클릭 불가 → "👉 프로필 링크 클릭 ✨"로 유도
- CTA는 본문 끝 1줄만

[해시태그 — 2024-12 정책 변경 반영]
- 5개 권장 (Instagram 공식 상한 정책 도입)
- Mosseri 공식: "해시태그는 reach 끌어올리지 않고 토픽 신호 역할만"
- 본문에서 빈 줄 2개 띄우고 마지막에 묶어 표기
- 메인 1 + 중간 2 + 롱테일 2 정도면 충분

[금지 — Meta 공식 engagement bait 페널티 (Transparency Center)]
- "좋아요 눌러주세요" / "댓글 부탁드려요" / "친구 태그해주세요" / "공유 부탁드려요"
- 명확한 call-to-action 목적 없는 engagement 요청 = distribution demotion
- "제 블로그", "방문해주세요" 같은 자기 홍보 마케팅 어투
- 자극·낚시·과장 카피
- 본문에 외부 URL (도달 감소)`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본 글: "${sourceTitle}"
URL (프로필 링크 안내용, 본문에 박지 말 것): ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}
- 핵심 포인트: ${sourceSummary.keyPoints.join(' / ')}
- 데이터: ${sourceSummary.dataPoints.join(', ')}

위 정보로 인스타그램 캡션을 작성하세요. 첫 줄은 결핍·반전·숫자 중 하나로 후킹. 본문은 정보 70% + 호기심 30%. send/save 유도 자연 삽입. 본문 끝에 "👉 프로필 링크 클릭 ✨" 1줄. 본문 빈 줄 2개 띄우고 해시태그 5개 (메인+중간+롱테일).`,

  assessRisk(response) {
    return assessRiskMultiAxis(response, INSTAGRAM);
  },

  userWarning: null,
  operationalNotes: [
    '본문 외부 URL은 도달 30~50% 감소 (검증)',
    '동일 캡션 24h 내 재게시 시 도달 감소',
    '해시태그 5개 상한 (2024-12 정책)',
    '2025 engagement -26% 추세 — send/save 유도가 도달 회복 핵심',
    'Reels는 도달 +36%, Carousel은 engagement +12% (Buffer 52M 포스트)',
  ],
  researchSources: [
    'https://buffer.com/resources/instagram-algorithms/',
    'https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works',
    'https://blog.hootsuite.com/social-media-algorithm/',
    'https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/',
    'https://transparency.meta.com/features/approach-to-ranking/content-distribution-guidelines/engagement-bait',
  ],
  lastVerified: '2026-06-01',
};

module.exports = INSTAGRAM;
