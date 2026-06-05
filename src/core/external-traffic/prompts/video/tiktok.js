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
  marker: 'TIKTOK',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'videoAngle',
    'saveReason',
  ],
  variantLabels: {
    A: '빠른 정보형',
    B: '공감/댓글형',
    C: '실수/주의형',
  },
  candidateFields: [
    {
      key: 'first2SecCandidates',
      selectedKey: 'first2SecHook',
      scoreKey: 'hookScore',
      label: '첫 2초 훅 후보',
    },
  ],
  copyFields: [
    { key: 'videoTitle' },
    { key: 'first2SecHook' },
    { key: 'bodyScript' },
    { key: 'cutCaptions', numbered: true },
    { key: 'commentPrompt' },
    { key: 'savePrompt' },
    { key: 'profileLinkPrompt', appendSourceUrl: true },
    { key: 'hashtags', style: 'inline', max: 6 },
  ],
  formattedParts: [
    {
      key: 'script',
      fields: ['first2SecHook', 'bodyScript', { key: 'cutCaptions', numbered: true }, 'commentPrompt'],
    },
    {
      key: 'caption',
      fields: ['videoTitle', 'savePrompt', { key: 'profileLinkPrompt', appendSourceUrl: true }],
    },
    {
      key: 'hashtags',
      fields: [{ key: 'hashtags', style: 'inline', max: 6 }],
    },
  ],
  arrayFields: ['cutCaptions', 'hashtags'],
  appendSourceUrl: false,
  copyMin: 220,
  copyMax: 1300,
  hashtagMax: 6,
  looseWindow: 3800,
});

const TIKTOK = makeChannel({
  id: 'tiktok',
  name: '틱톡 스크립트',
  category: 'video',
  riskTier: 'low',
  confidence: 'verified',
  icon: '♪',
  color: '#ff0050',
  openUrl: 'https://www.tiktok.com/upload',

  killerHookPatterns: [
    '2초 안에 멈추는 한 줄',
    '이거 모르면 놓치기 쉬움',
    '저장해두고 볼 포인트',
  ],
  bannedPhrases: [
    '구독 부탁',
    '좋아요 부탁',
    '무조건',
    '100% 보장',
    '지금 바로 클릭',
  ],
  popularityTriggers: [
    '첫 2초 훅',
    '빠른 컷 자막',
    '댓글 질문',
    '저장 유도',
    '프로필 링크 안내',
  ],
  toneSignature: {
    formality: 'casual',
    emoji: 'minimal',
    slang: ['진짜', '근데'],
    pronouns: ['나', '우리'],
  },
  transformationAxes: {
    titleRule: '틱톡 캡션보다 첫 2초 훅과 저장 이유를 먼저 설계한다.',
    bodyRule: '20~35초 스크립트, 컷 자막 6~10개, 프로필 링크 안내를 포함한다.',
    ctaPlacement: 'profile',
    linkBait: ['프로필 링크에서 원문 확인'],
  },
  paragraphRule: {
    splitOutput: ['script', 'caption', 'hashtags'],
    paragraphBreak: 'double',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 8500,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 틱톡 외부유입 스크립트를 만드는 숏폼 에디터입니다.

[틱톡 핵심]
- 유튜브 쇼츠보다 더 빠르고 가볍게 씁니다.
- 20~35초 분량이며 첫 2초 훅이 가장 중요합니다.
- 컷 자막은 6~10개로 짧게 나눕니다.
- 링크는 직접 클릭 CTA가 아니라 프로필 링크 안내로 자연스럽게 둡니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자를 만들지 않습니다.

[A/B/C 역할]
- A: 빠른 정보형. 핵심만 빠르게 알려줍니다.
- B: 공감/댓글형. 댓글이 달릴 상황과 질문을 만듭니다.
- C: 실수/주의형. 놓치기 쉬운 실수를 경고합니다.

[복사본 규칙]
- finalRevision에는 videoTitle, first2SecHook, bodyScript, cutCaptions, commentPrompt, savePrompt, profileLinkPrompt, hashtags만 넣습니다.
- 후보/점수/critique는 복사본에 넣지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[틱톡 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황, videoAngle을 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 first2SecCandidates 10개를 만들고 점수를 매긴 뒤 first2SecHook을 고르세요.
4. finalRevision.bodyScript는 20~35초 분량으로 구성하세요.
5. finalRevision.cutCaptions는 6~10개로 만드세요.
6. finalRevision.profileLinkPrompt에는 원문 URL "${params.sourceUrl}"을 참고 링크로 포함하세요.
7. hashtags는 3~6개만 사용하세요.`,

  processStructuredResponse(rawText) {
    const tiktok = structured.parseResult(rawText);
    if (!tiktok) return null;
    const formatted = structured.buildFormattedFromResult(tiktok);
    return {
      formatted,
      extra: { tiktok },
    };
  },

  operationalNotes: [
    '첫 2초 훅 후보 10개를 점수화합니다.',
    '프로필 링크 안내 문구로 자연스럽게 외부유입을 만듭니다.',
  ],
  researchSources: [
    'https://support.tiktok.com/',
  ],
  lastVerified: '2026-06-03',
});

TIKTOK.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('tiktok'),
  userCustomRule
);
TIKTOK.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'tiktok',
  { ...params, platformId: 'tiktok' },
  structured.buildStructuredOutputInstructions()
);

module.exports = TIKTOK;
