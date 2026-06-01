'use strict';
// R4 deep-research (2026-06-01) verified — 첫 1~3초 hook + 완주율 + explore-and-exploit 1차 다수 출처.

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'youtube-shorts',
  name: '유튜브 쇼츠 스크립트',
  category: 'video',
  riskTier: 'low',
  confidence: 'verified',
  icon: '🎬',
  color: '#ff0000',
  openUrl: 'https://studio.youtube.com/',

  // R4 verified: 첫 3초 hook 결정적 (Shortimize: 50~60% 시청자 3초 내 이탈).
  killerHookPatterns: [
    '~ 모르고 사는 사람? (3초 hook)',
    '3초 안에 ~',
    '결론부터: ~',
    '잠깐 — 이거 보세요',
    '~ 인 사람은 이거 알아야 합니다',
    '진짜 ~ 모르면 손해 (3초 attention)',
    '~ 인 줄 알았는데 알고보니',
    'POV: ~',
  ],
  bannedPhrases: [
    '구독 부탁',                    // 일반 마케팅 카피
    '좋아요 부탁',                  // 도달 페널티
    '안녕하세요 OOO 입니다',      // 3초 hook 낭비
    '오늘은 ~ 에 대해 알려드릴게요', // 도입부 느림 — swipe-away 트리거
  ],
  popularityTriggers: [
    '첫 3초 retention 70~85% (Influx: 2.2배 조회수)',
    '완주율 80~90% (Shortimize: 20초 90% > 60초 70%)',
    '반복 재생 유도 (반전 결말)',
    '단순한 흐름 + 대조적 결말',
    '50~60초 sweet-spot (OpusClip: sub-10s 대비 22배 조회)',
  ],
  toneSignature: { formality: 'mixed', emoji: 'minimal', slang: [], pronouns: ['저', '여러분'] },
  transformationAxes: {
    titleRule: '제목 ≤60자, 첫 3초 호기심 자극',
    bodyRule: '스크립트 30~60초 (50~60초 sweet-spot) + 더보기 + 고정 댓글 URL',
    ctaPlacement: 'inline',
    linkBait: ['더보기에 전체 글 링크', '고정 댓글 확인', '전체 영상에서 확인하세요'],
  },
  paragraphRule: {
    splitOutput: ['script', 'description', 'pinnedComment'],
    paragraphBreak: 'double',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 1500,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`당신은 한국 유튜브 쇼츠 크리에이터입니다 (2025~2026 알고리즘 검증).

[글 형식 — 헤더 필수]
Script:
[Hook 3초 — 50~60% 이탈 방지 결정적 + Body 25~45초 + CTA 5초]

Description:
[≤500자, 끝에 🔗 전체 글: URL — 모바일 클릭 불가 정책 반영, 복사 안내]

Pinned Comment:
[≤280자, URL — 고정 댓글 1~3% 전환률 검증 (subscribr 데이터)]

[R4 검증 핵심 — 2025~2026 알고리즘]
- 첫 1~3초 hook이 가장 결정적 (50~60% 시청자 3초 내 이탈)
- 완주율 80~90% 영상이 70% 영상 압도 (Shortimize: 20초 90% > 60초 70%)
- 반복 재생률이 추가 노출 유도
- 2025-03-31 explore-and-exploit 프레임워크 도입 — early swipe-away가 결정적
- 50~60초 sweet-spot (OpusClip 5,400 쇼츠: sub-10s 대비 22배 조회)
- 2023-08~ 모바일 URL 클릭 불가 — 복사 안내 필수
- 그래도 쇼츠→롱폼 CTR ~4.5%, 고정 댓글 1~3% 전환 (가장 효과적 우회)`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}
- 후킹 후보: ${sourceSummary.hooks.join(' / ')}

쇼츠 3영역(Script/Description/Pinned Comment)을 작성하세요. 첫 3초 hook 결정적. 50~60초 sweet-spot.`,
  operationalNotes: [
    '첫 1~3초 hook 결정적: 50~60% 시청자 3초 내 이탈 (Shortimize)',
    '완주율 80~90% 영상이 70% 영상 압도',
    '50~60초 sweet-spot — sub-10s 대비 22배 조회 (OpusClip 5,400 쇼츠)',
    '2025-03-31 explore-and-exploit 프레임워크 — early swipe-away 결정적',
    '2023-08~ 쇼츠 모바일 URL 클릭 불가 — 복사 안내',
    '쇼츠→롱폼 CTR ~4.5%, 고정 댓글 1~3% 전환',
  ],
  researchSources: [
    'https://shortimize.com/blog/how-does-youtube-shorts-algorithm-work',
    'https://opus.pro/blog/youtube-shorts-hook-formulas',
    'https://blog.hootsuite.com/youtube-algorithm/',
    'https://vidiq.com/blog/post/youtube-shorts-algorithm/',
    'https://support.google.com/youtube/answer/13748639',
    'https://brunch.co.kr/@4cbcb40265ad427/337',
  ],
});
