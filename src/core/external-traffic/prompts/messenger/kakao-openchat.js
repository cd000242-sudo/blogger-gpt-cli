'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
const {
  createStructuredPlatformProcessor,
  buildSourceInputBlock,
} = require('../_shared/structured-platform-rewrite');
const {
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
} = require('../_shared/common-context-guard');

const structured = createStructuredPlatformProcessor({
  marker: 'KAKAO_OPENCHAT',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'entryReason',
    'adRiskLevel',
  ],
  variantLabels: {
    A: '간단 공지형',
    B: '친근 공유형',
    C: '급한 확인형',
  },
  candidateFields: [
    {
      key: 'firstLineCandidates',
      selectedKey: 'selectedFirstLine',
      scoreKey: 'firstLineScore',
      label: '첫 줄 후보',
    },
  ],
  copyFields: [
    { key: 'firstLine' },
    { key: 'body' },
    { key: 'entryPrompt' },
    { key: 'linkPrompt', appendSourceUrl: true },
  ],
  appendSourceUrl: false,
  copyMin: 80,
  copyMax: 450,
  looseWindow: 2400,
});

const KAKAO_OPENCHAT = makeChannel({
  id: 'kakao-openchat',
  name: '카카오톡 오픈채팅',
  category: 'messenger',
  riskTier: 'medium',
  confidence: 'verified',
  icon: 'K',
  color: '#fee500',
  openUrl: 'https://open.kakao.com/',

  bannedPhrases: [
    '홍보',
    '광고',
    '제 블로그',
    '지금 바로 클릭',
    '무조건',
    '100% 보장',
  ],
  popularityTriggers: [
    '짧은 공지',
    '방 분위기 유지',
    '마지막 줄 링크',
    '과한 홍보 억제',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'minimal',
    slang: [],
    pronouns: ['여러분', '방장'],
  },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'none',
    maxLines: 8,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 70, high: 90, critical: 100 },
  maxOutputTokens: 6000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 카카오톡 오픈채팅에 올릴 짧은 외부유입 공지를 만드는 에디터입니다.

[카카오 오픈채팅 핵심]
- 긴 설명글이 아니라 5~8줄의 짧은 공지입니다.
- 방 분위기를 해치지 않는 자연스러운 공유 톤이어야 합니다.
- 해시태그는 사용하지 않습니다.
- 링크는 첫 줄이나 중간이 아니라 마지막 줄에만 둡니다.
- 홍보, 광고, 반복 공유 느낌이 나면 실패입니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자를 만들지 않습니다.

[A/B/C 역할]
- A: 간단 공지형. 핵심만 짧게 안내합니다.
- B: 친근 공유형. 방 사람들에게 알려주는 톤으로 씁니다.
- C: 급한 확인형. 놓치기 쉬운 확인 포인트를 강조합니다.

[복사본 규칙]
- finalRevision에는 firstLine, body, entryPrompt, linkPrompt만 넣습니다.
- 후보/점수/critique는 복사본에 넣지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[카카오 오픈채팅 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황, adRiskLevel을 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 firstLineCandidates 10개를 만들고 점수를 매긴 뒤 selectedFirstLine을 고르세요.
4. finalRevision은 전체 5~8줄 안에 들어오게 구성하세요.
5. finalRevision.linkPrompt 마지막 줄에 원문 URL "${params.sourceUrl}"을 포함하세요.
6. 해시태그와 과한 클릭 유도 문구는 쓰지 마세요.`,

  processStructuredResponse(rawText) {
    const kakaoOpenChat = structured.parseResult(rawText);
    if (!kakaoOpenChat) return null;
    const formatted = structured.buildFormattedFromResult(kakaoOpenChat);
    return {
      formatted,
      extra: { kakaoOpenChat },
    };
  },

  userWarning: '오픈채팅방 운영 규정에 따라 홍보성 공유가 제한될 수 있습니다.',
  operationalNotes: [
    '5~8줄로 짧게 유지합니다.',
    '링크는 마지막 줄에만 둡니다.',
    '해시태그는 사용하지 않습니다.',
  ],
  researchSources: [
    'https://www.kakaocorp.com/page/responsible/responsible_5_2025_h1',
  ],
  lastVerified: '2026-06-03',
});

KAKAO_OPENCHAT.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('kakao-openchat'),
  userCustomRule
);
KAKAO_OPENCHAT.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'kakao-openchat',
  { ...params, platformId: 'kakao-openchat' },
  structured.buildStructuredOutputInstructions()
);

module.exports = KAKAO_OPENCHAT;
