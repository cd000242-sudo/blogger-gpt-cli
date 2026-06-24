'use strict';
const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'telegram-channel',
  name: '텔레그램 채널',
  category: 'messenger',
  riskTier: 'low',
  confidence: 'inferred',
  icon: '✈️',
  color: '#0088cc',
  openUrl: 'https://web.telegram.org/',

  bannedPhrases: [],
  popularityTriggers: ['핵심 한 줄', '체크리스트'],
  toneSignature: { formality: 'mixed', emoji: 'medium', slang: [], pronouns: ['저', '여러분'] },
  paragraphRule: {
    maxLineChars: 60,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    maxLines: 12,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 55, medium: 80, high: 95, critical: 100 },
  maxOutputTokens: 2000,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`당신은 한국 텔레그램 채널 운영자입니다.

[글 형식]
- 본문 200~500자
- 마크다운 사용 OK (*굵게*, _기울임_)
- 본문 끝 [URL]

[원칙]
- 본인 채널 구독자 대상이므로 톤은 자유롭게
- URL preview를 위해 본문 마지막에 URL 박기`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}

텔레그램 채널 메시지 200~500자를 작성하세요. 끝에 ${sourceUrl}.`,
  userWarning: 'R4 deep-research에서 텔레그램 채널 운영 패턴·외부 링크 도달 1차 출처 미확보 — confidence: inferred. 본인 채널 구독자 보유자만 사용 권장.',
  operationalNotes: ['R4 공식 정책·운영 패턴 1차 출처 미확보'],
});
