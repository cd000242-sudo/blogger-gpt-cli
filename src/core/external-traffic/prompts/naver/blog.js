// src/core/external-traffic/prompts/naver/blog.js
// Naver Blog external-traffic generation: search-intent mini posts with A/B/C output.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
const {
  ARTICLE_TYPES,
  buildNaverBlogContext,
  buildContextPromptBlock,
} = require('./naverBlogContextAnalyzer');
const { buildTitleInstructionBlock } = require('./naverBlogTitleEngine');
const { buildCritiqueInstructionBlock } = require('./naverBlogCritique');
const {
  buildStructuredOutputInstructions,
  parseNaverBlogResult,
  buildFormattedFromNaverBlogResult,
} = require('./naverBlogRewrite');
const {
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
  buildStructuredJsonInstructions,
} = require('../_shared/common-context-guard');

const NAVER_BLOG_BANNED_PHRASES = [
  '자세한 내용은 링크 확인',
  '자세한 내용은 아래 링크',
  '아래 링크 클릭',
  '지금 바로 확인',
  '본문 보러가기',
  '무조건',
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
const NAVER_BLOG = {
  id: 'naver-blog',
  name: '네이버 블로그',
  category: 'naver',
  riskTier: 'low',
  confidence: 'verified',
  icon: 'N',
  color: '#03c75a',
  openUrl: 'https://blog.naver.com/',

  killerHookPatterns: [
    '핵심 키워드 조건과 확인방법 정리',
    '핵심 키워드에서 자주 헷갈리는 부분',
    '핵심 키워드 확인 전 체크할 부분',
    '처음 알아볼 때 막히는 이유',
    '기준과 예외사항을 함께 보는 방법',
  ],
  bannedPhrases: NAVER_BLOG_BANNED_PHRASES,
  popularityTriggers: [
    '검색 의도에 맞는 제목',
    '700~1200자 미니 포스트',
    '존댓말 정보글',
    '제목 후보 10개 평가',
    '원문으로 자연스럽게 이어지는 세부 기준',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '우리'],
  },
  transformationAxes: {
    titleRule: '검색 의도, 핵심 키워드, 구체적 확인 포인트가 들어간 제목을 10개 만든 뒤 선택한다.',
    bodyRule: 'SNS 홍보문이 아니라 700~1200자 검색형 미니 포스트로 쓴다.',
    ctaPlacement: 'separate-block',
    linkBait: [
      '세부 기준은 원문에서 이어서 확인할 수 있습니다',
      '전체 흐름은 원문 정리글을 참고해도 좋습니다',
      '상황별 예외는 원문에서 함께 체크해보시면 좋습니다',
    ],
  },
  paragraphRule: {
    maxLineChars: 60,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    hashtagSeparated: true,
    ctaSection: 'separate-block',
  },
  bandThresholds: { low: 50, medium: 75, high: 90, critical: 100 },
  maxOutputTokens: 12000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 네이버 블로그 외부유입 글을 만드는 전문 에디터다.

이번 작업 범위는 네이버 블로그 글 생성만이다.
Instagram, Threads, 네이버 카페, X, Facebook, 카카오톡, 유튜브 쇼츠, 틱톡, 핀터레스트 문체를 따라 하지 않는다.

[네이버 블로그 핵심]
- 네이버 블로그는 SNS 반응형 글이 아니라 검색형 미니 포스트다.
- 목표 우선순위: 검색 의도 적합성 > 제목 클릭률 > 신뢰감 있는 정보 제공 > 체류 후 원문 이동 > 댓글/공감.
- 글은 700~1200자 안팎의 미니 포스트로 작성한다.
- 존댓말 정보글을 사용하고, Threads식 반말이나 인스타식 카드뉴스 캡션은 금지한다.
- 제목은 검색형이면서 클릭 이유가 있어야 한다.
- 원문에 없는 금액, 기간, 조건, 대상자, 효과를 만들지 않는다.
- 모든 정보를 다 풀지 말고, 세부 기준/예외사항/체크리스트는 원문으로 자연스럽게 이어지게 한다.
- "자세한 내용은 링크 확인", "아래 링크 클릭", "지금 바로 확인" 같은 광고형 CTA는 금지한다.
- 해시태그는 원문 주제에 맞게 5~8개만 사용한다.

[가능한 글 유형]
${ARTICLE_TYPES.map((type) => `- ${type}`).join('\n')}

[A/B/C 역할]
- A안 검색 정리형: 검색자가 필요한 정보를 빠르게 이해하게 만든다.
- B안 경험 공감형: 검색자가 헷갈릴 만한 부분을 자연스럽게 짚는다. 실제 경험을 꾸며내지 않는다.
- C안 체크리스트형: 저장하거나 다시 볼 만한 확인 포인트 3~5개를 포함한다.

[본문 구조]
- 제목 1개
- 도입부 1개
- 소제목 2~3개
- 핵심 정리 문단
- 원문 유도 문단
- 댓글 유도 문장 1개
- 해시태그 5~8개

[안전 장치]
- 조건에 따라 달라질 수 있습니다.
- 개인 상황에 따라 확인이 필요합니다.
- 원문 기준으로 확인 가능한 범위만 정리했습니다.
- 예외사항이 있을 수 있습니다.
- 보도/공식 입장 기준으로 확인하는 것이 좋습니다.`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({
    sourceSummary,
    sourceUrl,
    sourceTitle,
    sourceText,
    sourceKeywords,
    sourceType,
  }) => {
    const context = buildNaverBlogContext({
      sourceSummary,
      sourceUrl,
      sourceTitle,
      sourceText,
      sourceKeywords,
      sourceType,
    });
    return `${buildContextPromptBlock(context)}

${buildTitleInstructionBlock()}

${buildCritiqueInstructionBlock()}

[생성 지시]
1. 위 context를 기준으로 네이버 블로그 검색형 미니 포스트를 만든다.
2. articleType, primaryKeyword, secondaryKeywords, searchTerms를 JSON context에 채운다.
3. A/B/C 3개를 모두 생성한다.
4. 각 A/B/C마다 제목 후보 10개를 만들고 점수화한 뒤 최고 점수 제목을 selectedTitle로 고른다.
5. selectedTitle 점수가 85점 미만이면 제목 후보를 다시 만들었다고 가정하고 90점 이상 제목을 넣는다.
6. 각 안의 최종 글은 700~1200자 안팎으로 만든다.
7. sourceLead에는 반드시 원문 URL "${sourceUrl}"을 포함하되, 광고형 클릭 유도 문장으로 쓰지 않는다.
8. finalRevision에는 사용자가 복사해서 바로 게시할 최종 글 구성요소만 담는다.
9. 출력은 반드시 JSON 태그 형식만 지킨다.

${buildStructuredOutputInstructions()}`;
  },

  processStructuredResponse(rawText) {
    const naverBlog = parseNaverBlogResult(rawText);
    if (!naverBlog) return null;
    const formatted = buildFormattedFromNaverBlogResult(naverBlog);
    return {
      formatted,
      extra: { naverBlog },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, NAVER_BLOG);
  },

  userWarning: null,
  operationalNotes: [
    '네이버 블로그는 SNS 홍보문이 아니라 검색형 미니 포스트로 생성한다.',
    '제목 후보 10개와 점수는 UI 검토용이며 최종 복사문에는 포함하지 않는다.',
    '세부 기준과 예외사항은 원문으로 자연스럽게 이어지게 한다.',
  ],
  researchSources: [
    'https://www.twinword.co.kr/blog/naver-seo-d-i-a/',
    'https://onfunnels.com/%EB%84%A4%EC%9D%B4%EB%B2%84-%EA%B2%80%EC%83%89%EC%97%94%EC%A7%84%EC%B5%9C%EC%A0%81%ED%99%94-seo/',
    'https://www.ascentkorea.com/naver_seo_strategies_2/',
  ],
  lastVerified: '2026-06-03',
};

function buildNaverBlogOutputInstructions() {
  return buildStructuredJsonInstructions({
    jsonStart: '<NAVER_BLOG_RESULT_JSON>',
    jsonEnd: '</NAVER_BLOG_RESULT_JSON>',
    variantLabels: { A: '검색 정리형', B: '경험 공감형', C: '체크리스트형' },
    candidateKey: 'titleCandidates',
    selectedKey: 'selectedTitle',
    scoreKey: 'titleScore',
    finalRevision: {
      title: '최종 제목',
      intro: '최종 도입부',
      sections: [
        { heading: '소제목 1', body: '본문 문단 1' },
        { heading: '소제목 2', body: '본문 문단 2' },
        { heading: '소제목 3', body: '본문 문단 3' },
      ],
      sourceLead: '원문 유도 문장',
      commentPrompt: '댓글 유도 문장',
      hashtags: ['#키워드'],
    },
  });
}

NAVER_BLOG.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('naver-blog'),
  userCustomRule
);
NAVER_BLOG.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'naver-blog',
  { ...params, platformId: 'naver-blog' },
  buildNaverBlogOutputInstructions()
);

module.exports = NAVER_BLOG;
