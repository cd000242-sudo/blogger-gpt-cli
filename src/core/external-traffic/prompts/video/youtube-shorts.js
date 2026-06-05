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
  marker: 'YOUTUBE_SHORTS',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'videoAngle',
    'commentAngle',
  ],
  variantLabels: {
    A: '정보 요약형',
    B: '주의/경고형',
    C: '공감/댓글형',
  },
  candidateFields: [
    {
      key: 'first3SecCandidates',
      selectedKey: 'first3SecHook',
      scoreKey: 'hookScore',
      label: '첫 3초 훅 후보',
    },
  ],
  copyFields: [
    { key: 'videoTitle' },
    { key: 'first3SecHook' },
    { key: 'bodyScript' },
    { key: 'onScreenCaptions', numbered: true },
    { key: 'commentPrompt' },
    { key: 'pinnedComment', appendSourceUrl: true },
    { key: 'description', appendSourceUrl: true },
    { key: 'hashtags', style: 'inline', max: 5 },
  ],
  formattedParts: [
    {
      key: 'script',
      fields: ['videoTitle', 'first3SecHook', 'bodyScript', { key: 'onScreenCaptions', numbered: true }, 'commentPrompt'],
    },
    {
      key: 'description',
      fields: [{ key: 'description', appendSourceUrl: true }, { key: 'hashtags', style: 'inline', max: 5 }],
    },
    {
      key: 'pinnedComment',
      fields: [{ key: 'pinnedComment', appendSourceUrl: true }],
    },
  ],
  arrayFields: ['onScreenCaptions', 'hashtags'],
  appendSourceUrl: false,
  copyMin: 300,
  copyMax: 1600,
  hashtagMax: 5,
  looseWindow: 4200,
});

const YOUTUBE_SHORTS = makeChannel({
  id: 'youtube-shorts',
  name: '유튜브 쇼츠 스크립트',
  category: 'video',
  riskTier: 'low',
  confidence: 'verified',
  icon: '▶',
  color: '#ff0000',
  openUrl: 'https://studio.youtube.com/',

  killerHookPatterns: [
    '3초 안에 멈추게 하는 질문',
    '결론부터 보여주는 반전',
    '놓치기 쉬운 기준',
  ],
  bannedPhrases: [
    '구독 부탁',
    '좋아요 부탁',
    '무조건',
    '100% 보장',
    '지금 바로 클릭',
  ],
  popularityTriggers: [
    '첫 3초 훅',
    '짧은 화면 자막',
    '고정댓글 링크',
    '댓글 질문',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'minimal',
    slang: [],
    pronouns: ['여러분'],
  },
  transformationAxes: {
    titleRule: '영상 제목과 첫 3초 훅을 분리해서 만든다.',
    bodyRule: '30~45초 쇼츠 스크립트, 화면 자막 5~8개, 고정댓글 링크를 포함한다.',
    ctaPlacement: 'pinned-comment',
    linkBait: ['고정댓글에 원문 링크'],
  },
  paragraphRule: {
    splitOutput: ['script', 'description', 'pinnedComment'],
    paragraphBreak: 'double',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 9000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 유튜브 쇼츠 외부유입 스크립트를 만드는 숏폼 에디터입니다.

[유튜브 쇼츠 핵심]
- 30~45초 분량의 영상 스크립트를 만듭니다.
- 첫 3초 훅이 가장 중요합니다.
- 화면 자막은 5~8개로 짧게 나눕니다.
- 링크는 description 또는 pinnedComment에 자연스럽게 둡니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자를 만들지 않습니다.

[A/B/C 역할]
- A: 정보 요약형. 핵심 정보를 빠르게 정리합니다.
- B: 주의/경고형. 놓치기 쉬운 부분을 안전하게 강조합니다.
- C: 공감/댓글형. 댓글이 달릴 질문과 상황을 만듭니다.

[복사본 규칙]
- finalRevision에는 videoTitle, first3SecHook, bodyScript, onScreenCaptions, commentPrompt, pinnedComment, description, hashtags만 넣습니다.
- 후보/점수/critique는 복사본에 넣지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[유튜브 쇼츠 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황, videoAngle을 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 first3SecCandidates 10개를 만들고 점수를 매긴 뒤 first3SecHook을 고르세요.
4. finalRevision.bodyScript는 30~45초 분량으로 구성하세요.
5. finalRevision.onScreenCaptions는 5~8개로 만드세요.
6. finalRevision.pinnedComment 또는 description에 원문 URL "${params.sourceUrl}"을 포함하세요.
7. hashtags는 3~5개만 사용하세요.`,

  processStructuredResponse(rawText) {
    const youtubeShorts = structured.parseResult(rawText);
    if (!youtubeShorts) return null;
    const formatted = structured.buildFormattedFromResult(youtubeShorts);
    return {
      formatted,
      extra: { youtubeShorts },
    };
  },

  operationalNotes: [
    '첫 3초 훅 후보 10개를 점수화합니다.',
    '고정댓글 또는 설명란에 원문 링크를 둡니다.',
  ],
  researchSources: [
    'https://support.google.com/youtube/',
  ],
  lastVerified: '2026-06-03',
});

YOUTUBE_SHORTS.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('youtube-shorts'),
  userCustomRule
);
YOUTUBE_SHORTS.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'youtube-shorts',
  { ...params, platformId: 'youtube-shorts' },
  structured.buildStructuredOutputInstructions()
);

module.exports = YOUTUBE_SHORTS;
