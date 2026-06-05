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
  marker: 'X_TWITTER',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'quoteAngle',
    'linkReason',
  ],
  variantLabels: {
    A: '무링크 본문형',
    B: '링크 클릭형',
    C: '인용/댓글 유도형',
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
    { key: 'quotePrompt' },
    { key: 'repostPrompt' },
    { key: 'linkPrompt', appendSourceUrl: true },
    { key: 'hashtags', style: 'inline', max: 2 },
  ],
  formattedParts: [
    {
      key: 'tweet1',
      fields: ['firstLine', 'body', 'quotePrompt', 'repostPrompt', { key: 'hashtags', style: 'inline', max: 2 }],
      stripUrls: true,
    },
    {
      key: 'tweet2',
      fields: [{ key: 'linkPrompt', appendSourceUrl: true }],
      appendSourceUrl: true,
    },
  ],
  arrayFields: ['hashtags'],
  appendSourceUrl: false,
  copyMin: 80,
  copyMax: 560,
  hashtagMax: 2,
  looseWindow: 2600,
});

/** @type {import('../../_shared/types').ChannelPrompt & { processStructuredResponse?: Function }} */
const X = {
  id: 'x',
  name: 'X (트위터)',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: 'X',
  color: '#1da1f2',
  openUrl: 'https://x.com/compose/post',

  killerHookPatterns: [
    '이거 모르는 사람 많더라',
    '결론부터 말하면',
    '진짜 헷갈리는 지점은 이거',
    '댓글로 갈릴 만한 포인트',
  ],
  bannedPhrases: [
    '블로그 방문',
    '구독 부탁',
    '지금 바로 클릭',
    '무조건',
    '100% 보장',
    '세일',
  ],
  popularityTriggers: [
    '첫 문장 정지력',
    '인용/댓글 유도',
    '리포스트할 만한 한 줄',
    '링크는 답글 또는 마지막 줄',
  ],
  toneSignature: {
    formality: 'mixed',
    emoji: 'minimal',
    slang: ['진짜', '근데', '솔직히'],
    pronouns: ['나', '우리'],
  },
  transformationAxes: {
    titleRule: '첫 문장은 링크보다 관점, 반전, 질문을 우선한다.',
    bodyRule: '한 트윗은 280자 안에 들어오게 쓰고 과장된 홍보 표현을 피한다.',
    ctaPlacement: 'reply',
    linkBait: ['원문 링크는 답글에', '전체 정리는 여기'],
  },
  paragraphRule: {
    maxLineChars: 'no-limit',
    paragraphBreak: 'single',
    emptyLineMaxConsecutive: 1,
    splitOutput: ['tweet1', 'tweet2'],
    ctaSection: 'first-comment',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 7000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 X(트위터) 외부유입 글을 만드는 짧은 글 에디터입니다.

[X 핵심]
- 짧고 선명해야 하며, 블로그 홍보문처럼 쓰면 실패입니다.
- 우선순위는 첫 문장 정지력 > 인용/댓글 > 리포스트 > 링크 클릭입니다.
- 각 트윗은 가능하면 280자 이내로 유지합니다.
- 해시태그는 0~2개만 사용하고 대부분 생략해도 됩니다.
- 원문에 없는 사실, 금액, 날짜, 조건, 효과를 만들지 않습니다.

[A/B/C 역할]
- A: 무링크 본문형. 본문 트윗에는 URL을 넣지 않고, linkPrompt로 답글 링크를 둡니다.
- B: 링크 클릭형. 짧은 이유와 함께 링크를 자연스럽게 둡니다.
- C: 인용/댓글 유도형. 의견이 갈릴 만한 질문이나 관점을 제시합니다.

[복사본 규칙]
- finalRevision에는 게시할 문장만 넣습니다.
- 후보 10개, 점수, critique는 UI 검토용입니다.
- JSON 밖 설명문은 절대 출력하지 않습니다.`;
    return appendUserNoteSafely(`${base}\n\n${structured.buildStructuredOutputInstructions()}`, userCustomRule);
  },

  buildUserPrompt: (params) => `${buildSourceInputBlock(params)}

[X 생성 지시]
1. context에 자동분류, 핵심주제, 예상독자, 독자상황을 채우세요.
2. A/B/C 3개를 모두 생성하세요.
3. 각 안마다 firstLineCandidates 10개를 만들고 점수를 매긴 뒤 selectedFirstLine을 고르세요.
4. finalRevision.firstLine/body/quotePrompt/repostPrompt/linkPrompt/hashtags만 최종 복사 요소로 채우세요.
5. finalRevision.linkPrompt에는 원문 URL "${params.sourceUrl}"을 포함하세요.
6. A안의 본문 문장에는 URL을 넣지 말고 링크는 linkPrompt에만 둡니다.`,

  processStructuredResponse(rawText) {
    const x = structured.parseResult(rawText);
    if (!x) return null;
    const formatted = structured.buildFormattedFromResult(x);
    return {
      formatted,
      extra: { x },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, X);
  },

  userWarning: null,
  operationalNotes: [
    '본문 트윗과 링크 답글을 분리하면 홍보 냄새와 도달 리스크를 줄일 수 있습니다.',
    '해시태그는 0~2개만 사용합니다.',
  ],
  researchSources: [
    'https://help.x.com/',
  ],
  lastVerified: '2026-06-03',
};

X.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('x'),
  userCustomRule
);
X.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'x',
  { ...params, platformId: 'x' },
  structured.buildStructuredOutputInstructions()
);

module.exports = X;
