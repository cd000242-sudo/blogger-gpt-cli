// src/core/external-traffic/prompts/sns/instagram.js
// 인스타그램 외부유입 전용: 문맥 추론형 저장 카드뉴스 캡션 A/B/C 생성.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
const {
  buildInstagramContext,
  buildContextPromptBlock,
  ARTICLE_TYPES,
} = require('./instagramContextAnalyzer');
const { buildHookInstructionBlock } = require('./instagramHookEngine');
const { buildCritiqueInstructionBlock } = require('./instagramCritique');
const {
  buildStructuredOutputInstructions,
  parseInstagramResult,
  buildFormattedFromInstagramResult,
} = require('./instagramRewrite');
const {
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
  buildStructuredJsonInstructions,
} = require('../_shared/common-context-guard');

const INSTAGRAM_BANNED_PHRASES = [
  '제 블로그',
  '방문해주세요',
  '더 자세한 내용은 아래 링크',
  '구독 부탁드려요',
  '안녕하세요 글쓴이입니다',
  '좋아요 눌러주세요',
  '댓글 부탁드려요',
  '친구 태그해주세요',
  '공유 부탁드려요',
  '무조건 가능',
  '누구나 가능',
  '100% 보장',
  '반드시 됩니다',
  '확정입니다',
  '신청만 하면 됩니다',
  '치료됩니다',
  '완치됩니다',
  '수익 보장',
  '클릭 강요',
];

/** @type {import('../../_shared/types').ChannelPrompt & { processStructuredResponse?: Function }} */
const INSTAGRAM = {
  id: 'instagram',
  name: '인스타그램',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '📷',
  color: '#e1306c',
  openUrl: 'https://www.instagram.com/',

  killerHookPatterns: [
    '착각 깨기형',
    '손해 회피형',
    '자기 상황 대입형',
    '반전형',
    '체크리스트형',
    '논란/궁금증형',
  ],
  bannedPhrases: INSTAGRAM_BANNED_PHRASES,
  popularityTriggers: [
    '스크롤 멈춤',
    '저장',
    '공유',
    '댓글',
    '프로필 또는 링크 클릭',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'medium',
    slang: [],
    pronouns: ['저', '우리'],
  },
  transformationAxes: {
    titleRule: '첫 줄 후보 10개 생성 후 점수화하고, 최종 첫 줄은 90점 이상을 목표로 한다.',
    bodyRule: '원문 문맥에 맞춘 A/B/C 3안. 한 문장 20~35자 중심, 핵심 정보 3~5개만 노출.',
    ctaPlacement: 'profile',
    linkBait: [
      '자세한 기준은 원문에서 확인',
      '프로필 링크에서 전체 정리 확인',
      '세부 조건은 링크에서 확인',
    ],
  },
  paragraphRule: {
    maxLineChars: 35,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    emojiBetweenParagraphs: false,
    hashtagSeparated: true,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 10000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 인스타그램 외부유입 캡션을 만드는 시니어 프롬프트 엔지니어다.

이번 작업 범위는 인스타그램 외부유입 글 생성만이다.
다른 플랫폼(Threads, 네이버 블로그, 네이버 카페, X, Facebook, 카카오톡, 유튜브 쇼츠, 틱톡, 핀터레스트)의 문체나 규칙을 섞지 않는다.

[핵심 원칙]
- 특정 주제 전용 문장을 하드코딩하지 않는다.
- 원문 제목, 본문/요약, URL, 키워드, 글 유형을 먼저 분석한다.
- 원문이 지원금이면 지원금 문맥, 보험이면 보험금/조회/청구 문맥, 세금이면 환급/공제/신고 문맥, 건강이면 증상/주의 문맥처럼 자동 추론한다.
- 원문에 없는 금액, 조건, 기간, 대상자, 효과를 만들지 않는다.
- 예시 문장은 참고 패턴일 뿐 실제 출력에 그대로 쓰지 않는다.

[인스타그램 행동 우선순위]
1. 스크롤 멈춤
2. 저장
3. 공유
4. 댓글
5. 프로필 또는 링크 클릭

[글 유형]
${ARTICLE_TYPES.map((type) => `- ${type}`).join('\n')}

[A/B/C 생성]
- A안: 저장형 정보글. 원문에서 저장할 체크리스트를 추출한다.
- B안: 공감형 글. 독자의 현실 상황을 먼저 건드린다.
- C안: 경고형 글. 놓치기 쉬운 부분을 안전하게 강조한다.

[본문 규칙]
- 한 문장은 20자~35자 중심.
- 한 문단은 1~2줄 중심.
- 카드뉴스 캡션처럼 짧게 줄바꿈.
- 핵심 정보는 3~5개만 노출.
- 모든 정보를 다 알려주지 말고 링크 클릭 이유를 남긴다.
- 광고 느낌보다 정보 공유 느낌.
- 이모지는 최대 3개.
- 해시태그는 8~12개.
- 해시태그는 원문 주제에 맞게 자동 생성.
- 본문에 외부 URL을 직접 넣지 않는다. 프로필/링크 확인 문장으로만 유도한다.`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle, sourceText, sourceKeywords, sourceType }) => {
    const context = buildInstagramContext({
      sourceSummary,
      sourceUrl,
      sourceTitle,
      sourceText,
      sourceKeywords,
      sourceType,
    });
    return `${buildContextPromptBlock(context)}

${buildHookInstructionBlock(context.articleType)}

${buildCritiqueInstructionBlock()}

[생성 지시]
1. 먼저 context 객체에 원문 문맥 분석 항목을 모두 채워라.
2. articleType은 원문에 가장 가까운 유형으로 자동 분류하라.
3. A/B/C 각 안마다 첫 줄 후보 10개를 만들고 점수화하라.
4. 각 안마다 최고 점수 첫 줄 1개만 selectedFirstLine에 사용하라.
5. 첫 줄 점수가 85점 미만이면 후보를 다시 만든다는 전제로 90점 이상 문장을 selectedFirstLine에 넣어라.
6. 자체 비평 점수가 85점 미만이면 finalRevision에서 다시 개선하라.
7. finalRevision에는 사용자가 복사해서 바로 올릴 최종 게시문 구성요소만 넣어라.
8. 출력은 반드시 JSON 태그 형식을 지켜라.

${buildStructuredOutputInstructions()}`;
  },

  processStructuredResponse(rawText) {
    const instagram = parseInstagramResult(rawText);
    if (!instagram) return null;
    const formatted = buildFormattedFromInstagramResult(instagram);
    return {
      formatted,
      extra: { instagram },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, INSTAGRAM);
  },

  userWarning: null,
  operationalNotes: [
    '인스타그램은 본문 URL 클릭이 어렵기 때문에 프로필/링크 확인 문장으로 유도합니다.',
    '복사본에는 점수, 후보, 비평을 제외하고 최종 개선안만 포함합니다.',
    '원문에 없는 금액·기간·대상자·효과는 생성하지 않도록 프롬프트와 파서에서 제한합니다.',
  ],
  researchSources: [
    'https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works',
    'https://transparency.meta.com/features/approach-to-ranking/content-distribution-guidelines/engagement-bait',
  ],
  lastVerified: '2026-06-03',
};

function buildInstagramOutputInstructions() {
  return buildStructuredJsonInstructions({
    jsonStart: '<INSTAGRAM_RESULT_JSON>',
    jsonEnd: '</INSTAGRAM_RESULT_JSON>',
    variantLabels: { A: '저장형', B: '공감형', C: '경고형' },
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    finalRevision: {
      firstLine: '최종 첫 줄',
      body: '최종 본문',
      savePrompt: '저장 유도 문장',
      sharePrompt: '공유 유도 문장',
      commentPrompt: '댓글 유도 문장',
      linkPrompt: '프로필 또는 링크 확인 유도 문장',
      hashtags: ['#키워드'],
    },
  });
}

INSTAGRAM.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('instagram'),
  userCustomRule
);
INSTAGRAM.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'instagram',
  { ...params, platformId: 'instagram' },
  buildInstagramOutputInstructions()
);

module.exports = INSTAGRAM;
