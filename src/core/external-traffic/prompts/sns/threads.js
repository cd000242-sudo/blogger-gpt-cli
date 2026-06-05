// src/core/external-traffic/prompts/sns/threads.js
// Threads external-traffic generation: comment-first A/B/C posts with JSON recovery.

'use strict';

const { assessRiskMultiAxis } = require('../../_shared/risk-assess');
const { appendUserNoteSafely } = require('../../_shared/sanitize');
const {
  buildInstagramContext,
  buildContextPromptBlock,
  ARTICLE_TYPES,
} = require('./instagramContextAnalyzer');
const {
  buildStructuredOutputInstructions,
  parseThreadsResult,
  buildFormattedFromThreadsResult,
} = require('./threadsRewrite');
const {
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
  buildStructuredJsonInstructions,
} = require('../_shared/common-context-guard');

const THREADS_BANNED_PHRASES = [
  '자세한 내용은 링크에서 확인해보세요',
  '자세한 내용은 링크 확인',
  '확인해보시기 바랍니다',
  '확인하시기 바랍니다',
  '부탁드립니다',
  '지금 바로 클릭',
  '무조건',
  '100% 보장',
  '좋아요 눌러주세요',
  '댓글 부탁드려요',
  '리포스트 부탁드려요',
  '할인',
  '판매중',
];

/** @type {import('../../_shared/types').ChannelPrompt & { processStructuredResponse?: Function }} */
const THREADS = {
  id: 'threads',
  name: 'Threads',
  category: 'sns',
  riskTier: 'medium',
  confidence: 'verified',
  icon: 'Th',
  color: '#000000',
  openUrl: 'https://www.threads.com/',

  killerHookPatterns: [
    '나만 이거 헷갈렸나?',
    '솔직히 이 부분 놓치는 사람 많음',
    '이거 알고 나면 기준이 좀 달라짐',
    '근데 여기서 제일 애매한 게 있음',
    '이건 저장보다 댓글이 먼저 달릴 주제임',
    '다들 이럴 때 어떻게 함?',
    '이거 그냥 넘어가면 나중에 피곤해짐',
    '헷갈리는 기준만 딱 정리하면 이거임',
    '주변에 이 케이스 있으면 같이 봐야 함',
    '결론부터 말하면 여기서 갈림',
  ],
  bannedPhrases: THREADS_BANNED_PHRASES,
  popularityTriggers: [
    '댓글로 의견이 갈리는 질문',
    '독자의 실제 상황을 먼저 건드리는 공감',
    '저장보다 공유하고 싶은 체크 포인트',
    '링크 클릭보다 대화가 먼저 생기는 첫 줄',
    '광고처럼 보이지 않는 개인 메모 톤',
  ],
  toneSignature: {
    formality: 'casual',
    emoji: 'minimal',
    slang: ['솔직히', '근데', '나만', '다들', '이거'],
    pronouns: ['나', '우리'],
  },
  transformationAxes: {
    titleRule: '첫 줄은 질문, 반전, 공감, 논쟁 중 하나로 만든다. 링크/클릭을 첫 줄에 넣지 않는다.',
    bodyRule: '블로그 요약문이 아니라 Threads 대화 시작문으로 쓴다. 짧은 문장, 가벼운 반말, 댓글 유도 우선.',
    ctaPlacement: 'inline',
    linkBait: [
      '원문은 여기',
      '정리글은 여기',
      '기준 확인용 링크',
      '전체 글',
    ],
  },
  paragraphRule: {
    maxLineChars: 34,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    maxLines: 16,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 9000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 Threads 외부유입 글을 만드는 전문 에디터다.

이번 작업 범위는 Threads 글 생성만이다.
Instagram, 네이버 블로그, 네이버 카페, X, Facebook, 블로그스팟, 워드프레스 문체를 따라 하지 않는다.

[Threads 핵심]
- 목표 우선순위: 댓글 > 공감 > 공유 > 링크 클릭.
- 블로그 요약문, 공손한 안내문, 홍보문처럼 쓰지 않는다.
- 친구에게 툭 말하듯 자연스러운 반말/혼잣말 톤으로 쓴다.
- "확인해보시기 바랍니다", "자세한 내용은 링크", "부탁드립니다", "지금 바로 클릭" 같은 문구는 금지한다.
- 원문에 없는 금액, 제도, 조건, 날짜, 대상, 효과를 만들지 않는다.
- 특정 예시를 하드코딩하지 말고 원문 맥락에서 자동 추출한다.
- 해시태그는 쓰지 않는다.
- 링크는 글 끝에 자연스럽게 1개만 둔다. CTA 박스처럼 꾸미지 않는다.

[분석 순서]
1. 원문 제목, 본문/요약, URL, 키워드, 글 유형을 먼저 분석한다.
2. articleType을 아래 유형 중 가장 가까운 것으로 자동 분류한다.
3. 예상 독자와 독자가 처한 상황을 추정한다.
4. 댓글이 달릴 질문, 공감 포인트, 공유 이유를 만든다.
5. A/B/C 각 variant마다 첫 줄 후보 10개를 만들고 점수화한다.
6. 후보/점수/비평은 JSON 내부 검토용이다. 최종 게시문에는 포함하지 않는다.

[글 유형]
${ARTICLE_TYPES.map((type) => `- ${type}`).join('\n')}

[A/B/C 역할]
- A안 댓글형: 사람마다 의견이 갈릴 질문으로 시작한다.
- B안 공감형: 독자의 현실적인 답답함이나 헷갈림을 먼저 건드린다.
- C안 공유형: 주변 사람에게 알려주고 싶은 체크 포인트로 만든다.

[최종 글 규칙]
- 최종 글은 URL 포함 500자 이내.
- 첫 줄은 14~46자 권장.
- 문장마다 너무 친절하게 설명하지 말고 여백을 둔다.
- "이거 나만 헷갈렸나?", "근데", "솔직히", "다들" 같은 대화형 표현은 자연스러울 때만 쓴다.
- 링크는 마지막에 URL 단독 또는 "원문은 여기: URL"처럼 짧게 둔다.
- 댓글 유도는 강요하지 말고 실제로 궁금한 질문처럼 둔다.`;
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

[Threads 생성 지시]
원문 URL: ${sourceUrl}

1. 위 context를 Threads 기준으로 다시 해석하라.
2. 자동분류, 핵심주제, 예상독자, 독자상황을 context에 채워라.
3. A/B/C 3개를 모두 생성하라.
4. 각 A/B/C마다 첫 줄 후보 10개를 만들고 점수를 매긴 뒤, 최고 점수 하나를 selectedFirstLine으로 골라라.
5. finalRevision은 사용자가 복사해서 바로 게시할 최종 글만 담아라.
6. 링크는 finalRevision.linkPrompt에 반드시 "${sourceUrl}"을 포함해 자연스럽게 넣어라.
7. 원문에 없는 예시, 금액, 제도명, 조건을 만들지 마라.
8. 출력은 반드시 JSON 태그 형식만 지켜라.

${buildStructuredOutputInstructions()}`;
  },

  processStructuredResponse(rawText) {
    const threads = parseThreadsResult(rawText);
    if (!threads) return null;
    const formatted = buildFormattedFromThreadsResult(threads);
    return {
      formatted,
      extra: { threads },
    };
  },

  assessRisk(response) {
    return assessRiskMultiAxis(response, THREADS);
  },

  userWarning: null,
  operationalNotes: [
    'Threads는 링크 클릭보다 댓글/공감/공유 신호가 먼저다.',
    '최종 복사문에는 후보, 점수, 비평, JSON 설명을 넣지 않는다.',
    '해시태그와 홍보형 CTA는 사용하지 않는다.',
  ],
  researchSources: [
    'https://buffer.com/resources/threads-comments-engagement/',
    'https://buffer.com/resources/replying-to-comments-boosts-engagement/',
    'https://socialmediatoday.com/news/meta-says-link-posts-ranked-properly-threads-reach/750126/',
    'https://www.threads.com/@mosseri/post/DCpQG0hz0m8',
  ],
  lastVerified: '2026-06-03',
};

function buildThreadsOutputInstructions() {
  return buildStructuredJsonInstructions({
    jsonStart: '<THREADS_RESULT_JSON>',
    jsonEnd: '</THREADS_RESULT_JSON>',
    variantLabels: { A: '공감형', B: '논쟁형', C: '정보 티저형' },
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    finalRevision: {
      firstLine: '최종 첫 줄',
      body: '최종 본문',
      commentPrompt: '댓글 유도 문장',
      sharePrompt: '재게시 유도 문장',
      linkPrompt: '자연스러운 링크 유도 문장',
    },
  });
}

THREADS.buildSystemPrompt = (subChannel, userCustomRule) => appendUserNoteSafely(
  buildPlatformSystemPrompt('threads'),
  userCustomRule
);
THREADS.buildUserPrompt = (params) => buildPlatformUserPrompt(
  'threads',
  { ...params, platformId: 'threads' },
  buildThreadsOutputInstructions()
);

module.exports = THREADS;
