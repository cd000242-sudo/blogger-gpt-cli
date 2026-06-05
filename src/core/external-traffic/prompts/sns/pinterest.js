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
  marker: 'PINTEREST',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'searchIntent',
    'saveReason',
    'keywordFocus',
  ],
  variantLabels: {
    A: '검색요약형',
    B: '저장 체크리스트형',
    C: '이미지 클릭형',
  },
  candidateFields: [
    {
      key: 'titleCandidates',
      selectedKey: 'pinTitle',
      scoreKey: 'titleScore',
      label: '핀 제목 후보',
    },
  ],
  copyFields: [
    { key: 'pinTitle' },
    { key: 'pinDescription', appendSourceUrl: true },
    { key: 'imageTextLines', numbered: true },
    { key: 'imageDesignDirection' },
    { key: 'blogLead', appendSourceUrl: true },
    { key: 'keywordTags', style: 'inline', max: 10 },
  ],
  formattedParts: [
    { key: 'pinTitle', fields: ['pinTitle'] },
    { key: 'description', fields: [{ key: 'pinDescription', appendSourceUrl: true }], appendSourceUrl: false },
    { key: 'boardSuggestion', fields: ['boardSuggestion'] },
    { key: 'imagePrompt', fields: ['imageDesignDirection', { key: 'imageTextLines', numbered: true }] },
  ],
  arrayFields: ['imageTextLines', 'keywordTags'],
  appendSourceUrl: false,
  copyMin: 180,
  copyMax: 900,
  keywordTagMax: 10,
  looseWindow: 3600,
});

/** @type {import('../../_shared/types').ChannelPrompt & { processStructuredResponse?: Function }} */
const PINTEREST = {
  id: 'pinterest',
  name: 'Pinterest',
  category: 'sns',
  riskTier: 'low',
  confidence: 'verified',
  icon: 'P',
  color: '#e60023',
  openUrl: 'https://www.pinterest.com/pin-builder/',

  killerHookPatterns: [
    '한눈에 보는 체크리스트',
    '저장해두고 확인할 정리',
    '검색할 때 바로 쓰는 요약',
  ],
  bannedPhrases: [
    '키워드 키워드 키워드',
    '광고 클릭',
    '무조건 구매',
    '100% 보장',
  ],
  popularityTriggers: [
    '검색 키워드',
    '저장 유도',
    '체크리스트',
    '2:3 이미지 문구',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['사용자'],
  },
  transformationAxes: {
    titleRule: '검색어가 자연스럽게 들어간 100자 이내 핀 제목을 만든다.',
    bodyRule: '150~350자 설명, 이미지 문구 5줄, 저장할 이유를 분명히 한다.',
    ctaPlacement: 'none',
    linkBait: [],
  },
  paragraphRule: {
    maxLineChars: 34,
    paragraphBreak: 'single',
    splitOutput: ['pinTitle', 'description', 'boardSuggestion', 'imagePrompt'],
    hashtagSeparated: false,
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 8000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 Pinterest 외부유입 핀 문구를 만드는 검색/저장형 콘텐츠 에디터입니다.

[Pinterest 핵심]
- SNS 홍보문이 아니라 검색되고 저장되는 핀 콘텐츠여야 합니다.
- 우선순위는 검색 키워드 > 저장 가치 > 이미지 클릭 > 블로그 이동입니다.
- pinDescription은 150~350자 안에서 자연스럽게 씁니다.
- 이미지 텍스트는 5줄로 짧고 명확하게 만듭니다.
- 키워드 stuffing과 과장 광고 표현은 금지합니다.
- 원문에 없는 금액, 날짜, 조건, 효과, 대상자를 만들지 않습니다.

[A/B/C 역할]
- A: 검색요약형. 검색어와 핵심 요약을 중심으로 씁니다.
- B: 저장 체크리스트형. 나중에 다시 볼 이유를 강조합니다.
- C: 이미지 클릭형. 이미지 문구와 제목의 클릭 이유를 선명하게 만듭니다.

[복사본 규칙]
- finalRevision에는 pinTitle, pinDescription, imageTextLines, imageDesignDirection, blogLead, keywordTags만 넣습니다.
- 후보와 점수, critique는 UI용이며 복사본에 넣지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[Pinterest 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황, searchIntent를 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 titleCandidates 10개를 만들고 점수를 매긴 뒤 pinTitle을 고르세요.
4. finalRevision.pinDescription에는 원문 URL "${params.sourceUrl}"을 자연스럽게 포함하세요.
5. finalRevision.imageTextLines는 정확히 5줄로 만드세요.
6. finalRevision.keywordTags는 5~10개만 사용하고 반복 키워드를 금지하세요.`,

  processStructuredResponse(rawText) {
    const pinterest = structured.parseResult(rawText);
    if (!pinterest) return null;
    const formatted = structured.buildFormattedFromResult(pinterest);
    return {
      formatted,
      extra: { pinterest },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, PINTEREST);
  },

  userWarning: null,
  operationalNotes: [
    'Pinterest는 저장과 검색 의도가 중요합니다.',
    '2:3 이미지에 들어갈 짧은 문구 5줄을 함께 생성합니다.',
  ],
  researchSources: [
    'https://policy.pinterest.com/en/community-guidelines',
  ],
  lastVerified: '2026-06-03',
};

PINTEREST.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('pinterest'),
  userCustomRule
);
PINTEREST.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'pinterest',
  { ...params, platformId: 'pinterest' },
  structured.buildStructuredOutputInstructions()
);

module.exports = PINTEREST;
