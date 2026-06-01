'use strict';
// R4 deep-research (2026-06-01) verified — 첫 3초 룰 1차 다수 출처.
// FYP 4대 신호·15~30초 최적 길이는 refuted — 공개 1차 자료 부재.

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'tiktok',
  name: '틱톡 스크립트',
  category: 'video',
  riskTier: 'low',
  confidence: 'verified',
  icon: '🎵',
  color: '#ff0050',
  openUrl: 'https://www.tiktok.com/upload',

  // R4 verified: 첫 3초 hook 결정적 — 70~85% retention 영상 2.2배 조회 (Influx 2026).
  killerHookPatterns: [
    '~ 인 사람만 봐 (3초 hook)',
    '2초 안에 멈춰 ~',
    '잠깐 ~ 이거 봐봐',
    '진짜 ~ 모르는 사람 많아',
    '~ 한 사람만 ~ 됨',
    'POV: ~',
    '나만 ~ 모르고 있었음?',
  ],
  bannedPhrases: [
    '구독 부탁',
    '좋아요 부탁',
    '안녕하세요',
  ],
  popularityTriggers: [
    '3초 룰 — TikTok 본사 공식화',
    '70~85% retention 영상 = 2.2배 조회수 (Influx 2026)',
    '84.3% 바이럴 영상이 3초 내 심리적 트리거',
    '트렌딩 음악',
    '프로필 링크 클릭 자막',
  ],
  toneSignature: { formality: 'casual', emoji: 'minimal', slang: [], pronouns: ['나', '저'] },
  transformationAxes: {
    titleRule: '없음 — 캡션 50~150자',
    bodyRule: '스크립트 — 첫 3초 hook 결정적. 길이 sweet-spot은 검증 데이터 부족.',
    ctaPlacement: 'profile',
    linkBait: ['프로필 링크 클릭'],
  },
  paragraphRule: {
    splitOutput: ['script', 'caption', 'hashtags'],
    paragraphBreak: 'double',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 900,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`당신은 한국 틱톡 크리에이터입니다 (2025~2026 검증).

[글 형식 — 헤더 필수]
Script:
[Hook 2~3초 — 70~85% retention 영상이 2.2배 조회 (Influx 2026 검증) + Body + "프로필 링크 클릭" 자막]

Caption:
[50~150자]

Hashtags:
[메인 1 + 중간 3~5 + 트렌딩 1~2]

[R4 검증 핵심]
- TikTok 본사가 공식화한 3초 룰 — 3초 retention <50%면 500 조회 이하 throttle
- 84.3% 바이럴 영상이 3초 내 심리적 트리거 사용
- 길이 sweet-spot은 공개 1차 자료 부재 — 15~30초 통념은 refuted`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본: "${sourceTitle}"
URL (프로필 링크 안내): ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}

틱톡 3영역(Script/Caption/Hashtags)을 작성하세요. 첫 3초 hook이 결정적.`,
  operationalNotes: [
    '3초 룰 TikTok 본사 공식화',
    '70~85% retention 영상 = 2.2배 조회수',
    '3초 이후 retention <50% → 500 조회 이하 throttle',
    'FYP 4대 신호·15~30초 최적 길이 통념은 refuted (공개 1차 자료 부재)',
  ],
  researchSources: [
    'https://www.influx-lab.com/blog/tiktok-followers-views-guide-2026',
    'https://blog.hootsuite.com/tiktok-algorithm',
    'https://opus.pro/blog/tiktok-hook-formulas',
  ],
});
