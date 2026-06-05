'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
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
  marker: 'FACEBOOK',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'shareReason',
    'commentAngle',
    'linkReason',
  ],
  variantLabels: {
    A: '생활정보 공유형',
    B: '가족/지인 공유형',
    C: '주의사항 정리형',
  },
  candidateFields: [
    {
      key: 'firstLineCandidates',
      selectedKey: 'selectedFirstLine',
      scoreKey: 'firstLineScore',
      label: '첫 문장 후보',
    },
  ],
  copyFields: [
    { key: 'firstLine' },
    { key: 'body' },
    { key: 'sharePrompt' },
    { key: 'commentPrompt' },
    { key: 'linkPrompt', appendSourceUrl: true },
    { key: 'hashtags', style: 'inline', max: 5 },
  ],
  formattedParts: [
    {
      key: 'personal',
      fields: ['firstLine', 'body', 'sharePrompt', 'commentPrompt', { key: 'linkPrompt', appendSourceUrl: true }, { key: 'hashtags', style: 'inline', max: 5 }],
      appendSourceUrl: false,
    },
    {
      key: 'group-comment',
      fields: ['firstLine', 'commentPrompt', { key: 'linkPrompt', appendSourceUrl: true }],
      appendSourceUrl: false,
    },
  ],
  arrayFields: ['hashtags'],
  appendSourceUrl: false,
  copyMin: 500,
  copyMax: 1200,
  hashtagMax: 5,
  looseWindow: 3600,
});

/** @type {import('../../_shared/types').ChannelPrompt & { processStructuredResponse?: Function }} */
const FACEBOOK = {
  id: 'facebook',
  name: 'Facebook',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: 'f',
  color: '#1877f2',
  openUrl: 'https://www.facebook.com/',

  killerHookPatterns: [
    '주변에 이런 상황이면 참고하면 좋겠어요',
    '저도 정리하다가 헷갈렸던 부분인데요',
    '가족한테 공유하려고 정리해봤어요',
  ],
  bannedPhrases: [
    '좋아요 눌러주세요',
    '댓글 부탁드려요',
    '공유 부탁드려요',
    '친구 태그해주세요',
    '지금 바로 클릭',
    '100% 보장',
  ],
  popularityTriggers: [
    '생활정보 공유',
    '지인에게 전달할 만한 맥락',
    '주의사항 정리',
    '자연스러운 댓글 질문',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '우리'],
  },
  transformationAxes: {
    titleRule: '첫 문장은 생활 맥락과 공유 이유를 먼저 보여준다.',
    bodyRule: '500~1000자. 지인에게 설명하듯 쉽게 쓰고 참여 강요 문구를 피한다.',
    ctaPlacement: 'inline',
    linkBait: ['정리된 원문도 함께 남깁니다'],
  },
  paragraphRule: {
    maxLineChars: 48,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    splitOutput: ['personal', 'group-comment'],
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 9000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 Facebook 외부유입 글을 만드는 생활정보 공유 에디터입니다.

[Facebook 핵심]
- 짧은 광고 문구가 아니라 가족, 지인, 커뮤니티에 공유하는 생활정보 글이어야 합니다.
- 500~1000자 안에서 쉬운 단어와 자연스러운 존댓말을 사용합니다.
- 좋아요/댓글/공유를 직접 강요하는 engagement bait 문구는 금지합니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자를 만들지 않습니다.

[A/B/C 역할]
- A: 생활정보 공유형. 실생활에서 바로 확인할 이유를 줍니다.
- B: 가족/지인 공유형. 주변 사람에게 전달하는 톤으로 씁니다.
- C: 주의사항 정리형. 놓치기 쉬운 기준과 확인 포인트를 정리합니다.

[복사본 규칙]
- finalRevision에는 최종 게시글 요소만 넣습니다.
- 후보 10개, 점수, critique는 UI에서만 보여주고 복사본에는 포함하지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[Facebook 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황을 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 firstLineCandidates 10개를 만들고 점수를 매긴 뒤 selectedFirstLine을 고르세요.
4. finalRevision.firstLine/body/sharePrompt/commentPrompt/linkPrompt/hashtags만 최종 복사 요소로 채우세요.
5. finalRevision.linkPrompt에는 원문 URL "${params.sourceUrl}"을 자연스럽게 포함하세요.
6. 댓글/공유를 강요하지 말고 자연스러운 질문형으로 마무리하세요.`,

  processStructuredResponse(rawText) {
    const facebook = structured.parseResult(rawText);
    if (!facebook) return null;
    const formatted = structured.buildFormattedFromResult(facebook);
    return {
      formatted,
      extra: { facebook },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, FACEBOOK);
  },

  userWarning: null,
  operationalNotes: [
    'Meta engagement bait 표현은 피합니다.',
    '개인 계정 톤과 그룹 댓글 톤을 모두 만들 수 있게 parts를 유지합니다.',
  ],
  researchSources: [
    'https://transparency.meta.com/features/approach-to-ranking/content-distribution-guidelines/engagement-bait',
  ],
  lastVerified: '2026-06-03',
};

FACEBOOK.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('facebook'),
  userCustomRule
);
FACEBOOK.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'facebook',
  { ...params, platformId: 'facebook' },
  structured.buildStructuredOutputInstructions()
);

module.exports = FACEBOOK;
