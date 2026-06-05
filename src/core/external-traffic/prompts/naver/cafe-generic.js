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
  marker: 'NAVER_CAFE',
  contextFields: [
    'sourceTitle',
    'sourceUrl',
    'autoCategory',
    'coreTopic',
    'targetReader',
    'readerSituation',
    'commentAngle',
    'linkReason',
    'adRiskLevel',
  ],
  variantLabels: {
    A: '질문형',
    B: '경험공유형',
    C: '정보공유형',
  },
  candidateFields: [
    {
      key: 'titleCandidates',
      selectedKey: 'selectedTitle',
      scoreKey: 'titleScore',
      label: '카페 제목 후보',
    },
  ],
  copyFields: [
    { key: 'title' },
    { key: 'body' },
    { key: 'commentPrompt' },
    { key: 'linkPrompt' },
    { key: 'hashtags', style: 'inline', max: 3 },
  ],
  arrayFields: ['hashtags'],
  appendSourceUrl: true,
  copyMin: 400,
  copyMax: 900,
  hashtagMax: 3,
  looseWindow: 3600,
});

module.exports = makeChannel({
  id: 'naver-cafe',
  name: '네이버 카페',
  category: 'naver',
  riskTier: 'medium',
  confidence: 'inferred',
  icon: 'N',
  color: '#03c75a',
  openUrl: 'https://section.cafe.naver.com/',

  killerHookPatterns: [
    '이거 저만 헷갈리나요?',
    '최근에 정리하다가 알게 된 내용 공유해요',
    '같은 상황인 분들 참고해보세요',
  ],
  bannedPhrases: [
    '제 블로그',
    '방문해주세요',
    '광고 아닙니다',
    '협찬 아닙니다',
    '지금 바로 클릭',
    '무조건',
    '100% 보장',
  ],
  popularityTriggers: [
    '카페 회원 질문',
    '경험 공유',
    '댓글 유도',
    '자연스러운 참고 링크',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '회원님들'],
  },
  transformationAxes: {
    titleRule: '질문형, 경험 공유형, 정보 공유형 제목 후보를 각각 만들고 광고 냄새를 낮춘다.',
    bodyRule: '400~900자. 카페 회원이 직접 공유하는 글처럼 쓰되 원문에 없는 사실은 만들지 않는다.',
    ctaPlacement: 'end-of-body',
    linkBait: ['정리된 원문도 같이 남겨둘게요'],
  },
  paragraphRule: {
    maxLineChars: 46,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 9000,

  buildSystemPrompt: (subChannel, userCustomRule) => appendUserNoteSafely(
    buildPlatformSystemPrompt('naver-cafe'),
    userCustomRule
  ),

  buildUserPrompt: (params) => buildPlatformUserPrompt(
    'naver-cafe',
    { ...params, platformId: 'naver-cafe' },
    structured.buildStructuredOutputInstructions()
  ),

  processStructuredResponse(rawText) {
    const naverCafe = structured.parseResult(rawText);
    if (!naverCafe) return null;
    const formatted = structured.buildFormattedFromResult(naverCafe);
    return {
      formatted,
      extra: { naverCafe },
    };
  },

  userWarning: '카페별 운영 규정이 다르므로 최종 게시 전 직접 확인이 필요합니다.',
  operationalNotes: [
    '동일 글을 여러 카페에 반복 게시하면 제재 가능성이 높습니다.',
    '링크는 마지막에 한 번만 자연스럽게 넣습니다.',
    '질문/경험 공유형으로 광고 냄새를 낮춥니다.',
  ],
  researchSources: [
    'https://section.cafe.naver.com/help/',
  ],
  lastVerified: '2026-06-03',
});
