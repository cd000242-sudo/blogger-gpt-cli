'use strict';
// R4 deep-research (2026-06-01) verified — Kakao 공식 투명성 리포트 (H1 2025 약 55.5만 계정 제재).

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

module.exports = makeChannel({
  id: 'kakao-openchat',
  name: '카카오톡 오픈채팅',
  category: 'messenger',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '💬',
  color: '#fee500',
  openUrl: 'https://open.kakao.com/',

  bannedPhrases: ['홍보', '광고', '제 블로그', '링크 클릭'],
  popularityTriggers: ['한 줄 후킹', '본인 자산 큐레이션', '본인 운영 방 회원 대상'],
  toneSignature: { formality: 'mixed', emoji: 'medium', slang: [], pronouns: ['저', '여러분'] },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'none',
    maxLines: 2,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 70, high: 90, critical: 100 },
  maxOutputTokens: 200,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(`당신은 한국 카카오톡 오픈채팅 운영자입니다 (2025~2026 검증).

[글 형식]
- 1~2줄 (60~120자)
- 본인 운영 방 외 사용 절대 금지
- 끝에 👉 [URL]

[R4 검증 — Kakao 공식 투명성 리포트]
- H1 2025 약 55.5만 계정 제재 (오픈채팅 포함 도배·홍보·스팸 사유)
- 다른 사람 방에 무단 공유 = 강퇴 + 운영자 신고
- 같은 방 1일 1회 권장
- 운영자 재량 강함 — 방 분위기 깨면 즉시 강퇴`, userCustomRule),

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => `원본: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${sourceSummary.coreValue}

카톡 오픈채팅 1~2줄 (60~120자)을 작성하세요. 본인 운영 방 대상. 끝에 "👉 ${sourceUrl}".`,
  userWarning: 'Kakao 공식 H1 2025 약 55.5만 계정 제재 (오픈채팅 도배/홍보/스팸 사유). 본인 운영 방 외 사용 = 즉시 강퇴 + 운영자 신고. 무단 공유 절대 금지.',
  operationalNotes: [
    'H1 2025 약 55.5만 계정 제재 (Kakao 공식 투명성 리포트)',
    '본인 운영 방 외 사용 금지',
    '같은 방 1일 1회 권장',
    '운영자 재량 강함',
  ],
  researchSources: [
    'https://www.kakaocorp.com/page/responsible/responsible_5_2025_h1',
  ],
});
