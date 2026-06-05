'use strict';

const dispatcher = require('../../../src/core/external-traffic');

const SOURCE_URL = 'https://example.com/source-post';

function candidates(prefix) {
  return Array.from({ length: 10 }, (_, idx) => ({
    text: `${prefix} 후보 ${idx + 1}`,
    score: 96 - idx,
  }));
}

function repeatSentence(sentence, count) {
  return Array.from({ length: count }, () => sentence).join(' ');
}

const PLATFORM_CASES = {
  'naver-cafe': {
    marker: 'NAVER_CAFE',
    extra: 'naverCafe',
    candidateKey: 'titleCandidates',
    selectedKey: 'selectedTitle',
    scoreKey: 'titleScore',
    expectedFormat: 'body',
    topic: '전세 계약 전 체크리스트',
    finalRevision: {
      title: '전세 계약 전에 이 부분 확인하신 분 계신가요?',
      body: repeatSentence('전세 계약을 앞두고 있다면 보증금, 등기부등본, 특약 문구를 먼저 확인하는 것이 좋습니다.', 7),
      commentPrompt: '혹시 계약 전에 가장 헷갈렸던 부분이 있으셨나요?',
      linkPrompt: `제가 참고한 정리글도 같이 남겨둘게요. ${SOURCE_URL}`,
      hashtags: ['#전세계약', '#체크리스트'],
    },
  },
  x: {
    marker: 'X_TWITTER',
    extra: 'x',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    expectedFormat: 'parts',
    expectedParts: ['tweet1', 'tweet2'],
    topic: '세금 신고 기준',
    finalRevision: {
      firstLine: '세금 신고에서 제일 헷갈리는 건 금액보다 기준입니다.',
      body: '먼저 신고 대상, 기간, 예외를 나눠서 보면 훨씬 덜 헷갈립니다.',
      quotePrompt: '이 기준은 사람마다 의견이 갈릴 수 있어요.',
      repostPrompt: '필요한 분은 저장해두세요.',
      linkPrompt: `전체 정리 ${SOURCE_URL}`,
      hashtags: ['#세금'],
    },
  },
  facebook: {
    marker: 'FACEBOOK',
    extra: 'facebook',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    expectedFormat: 'parts',
    expectedParts: ['personal', 'group-comment'],
    topic: '가족 건강검진 준비',
    finalRevision: {
      firstLine: '가족 건강검진 준비 중이면 이 부분을 먼저 보면 좋겠습니다.',
      body: repeatSentence('검진 항목, 예약 일정, 준비물은 병원과 대상자 상황에 따라 달라질 수 있어서 미리 확인하는 편이 안전합니다.', 5),
      sharePrompt: '가족에게 공유하기 전에 본인 상황에 맞는지 같이 확인해보면 좋겠습니다.',
      commentPrompt: '검진 준비하면서 헷갈렸던 부분이 있으셨나요?',
      linkPrompt: `정리된 원문 ${SOURCE_URL}`,
      hashtags: ['#건강검진', '#생활정보'],
    },
  },
  'kakao-openchat': {
    marker: 'KAKAO_OPENCHAT',
    extra: 'kakaoOpenChat',
    candidateKey: 'firstLineCandidates',
    selectedKey: 'selectedFirstLine',
    scoreKey: 'firstLineScore',
    expectedFormat: 'body',
    topic: '청약 일정 확인',
    finalRevision: {
      firstLine: '잠깐 공유드려요.',
      body: '청약 일정 확인할 때 대상과 접수 기간을 먼저 보면 좋습니다.\n예외 조건은 사람마다 다를 수 있어요.',
      entryPrompt: '필요한 분만 가볍게 확인해보세요.',
      linkPrompt: `원문 ${SOURCE_URL}`,
    },
  },
  'youtube-shorts': {
    marker: 'YOUTUBE_SHORTS',
    extra: 'youtubeShorts',
    candidateKey: 'first3SecCandidates',
    selectedKey: 'first3SecHook',
    scoreKey: 'hookScore',
    expectedFormat: 'parts',
    expectedParts: ['script', 'description', 'pinnedComment'],
    topic: '자동차 보험료 비교',
    finalRevision: {
      videoTitle: '자동차 보험료 비교 전 확인할 3가지',
      first3SecHook: '보험료 비교 전에 이것부터 보세요.',
      bodyScript: '첫째, 보장 범위를 확인합니다. 둘째, 자기부담금 기준을 봅니다. 셋째, 갱신 조건을 원문에서 다시 확인합니다.',
      onScreenCaptions: ['보장 범위', '자기부담금', '갱신 조건', '원문 확인', '저장'],
      commentPrompt: '여러분은 어떤 기준이 제일 헷갈리셨나요?',
      pinnedComment: `정리글 ${SOURCE_URL}`,
      description: `자세한 기준은 ${SOURCE_URL} 에서 확인할 수 있습니다.`,
      hashtags: ['#자동차보험', '#보험료', '#쇼츠'],
    },
  },
  tiktok: {
    marker: 'TIKTOK',
    extra: 'tiktok',
    candidateKey: 'first2SecCandidates',
    selectedKey: 'first2SecHook',
    scoreKey: 'hookScore',
    expectedFormat: 'parts',
    expectedParts: ['script', 'caption', 'hashtags'],
    topic: 'AI 도구 사용법',
    finalRevision: {
      videoTitle: 'AI 도구 쓰기 전 체크할 것',
      first2SecHook: '잠깐, 이거 먼저 확인하세요.',
      bodyScript: 'AI 도구는 목적, 입력 자료, 결과 검토 기준을 먼저 정하면 훨씬 안정적으로 쓸 수 있습니다.',
      cutCaptions: ['목적', '입력', '검토', '저장', '원문', '확인'],
      commentPrompt: '어떤 작업에 AI를 제일 많이 쓰시나요?',
      savePrompt: '필요하면 저장해두세요.',
      profileLinkPrompt: `참고 링크 ${SOURCE_URL}`,
      hashtags: ['#AI도구', '#업무자동화', '#틱톡'],
    },
  },
  pinterest: {
    marker: 'PINTEREST',
    extra: 'pinterest',
    candidateKey: 'titleCandidates',
    selectedKey: 'pinTitle',
    scoreKey: 'titleScore',
    expectedFormat: 'parts',
    expectedParts: ['pinTitle', 'description', 'boardSuggestion', 'imagePrompt'],
    topic: '여행 준비물 리스트',
    finalRevision: {
      pinTitle: '여행 준비물 체크리스트 한눈에 보기',
      pinDescription: `여행 전 빠뜨리기 쉬운 준비물을 한눈에 정리했습니다. 상세 정리는 ${SOURCE_URL} 에서 확인할 수 있습니다.`,
      imageTextLines: ['여권', '충전기', '상비약', '예약 확인', '저장'],
      imageDesignDirection: '2:3 비율의 깔끔한 체크리스트 카드',
      blogLead: `전체 준비물 정리는 ${SOURCE_URL} 에 있습니다.`,
      keywordTags: ['#여행준비물', '#체크리스트'],
      boardSuggestion: '여행 준비 보드',
    },
  },
};

function buildRaw(platformId, cfg, malformed = false) {
  const variants = ['A', 'B', 'C'].map((key, idx) => ({
    key,
    label: `${key}안`,
    goal: `${cfg.topic} ${key}안 목적`,
    [cfg.candidateKey]: candidates(`${cfg.topic} ${key}`),
    [cfg.selectedKey]: candidates(`${cfg.topic} ${key}`)[0].text,
    [cfg.scoreKey]: 96,
    selectedReason: '플랫폼 목적과 가장 잘 맞습니다.',
    critique: {
      score: 94 - idx,
      notes: '복사본에는 후보와 점수를 넣지 않았습니다.',
      breakdown: {
        platformFit: 20,
        hook: 19,
        truth: 20,
        lowAd: 18,
        action: 17,
      },
    },
    finalRevision: cfg.finalRevision,
  }));
  const body = JSON.stringify({
    context: {
      sourceTitle: `${cfg.topic} 원문`,
      sourceUrl: SOURCE_URL,
      autoCategory: cfg.topic,
      coreTopic: cfg.topic,
      targetReader: '초보자',
      readerSituation: '기준을 빠르게 확인하려는 상황',
      mustKeepFacts: [cfg.topic],
      doNotUse: ['청년내일저축계좌'],
    },
    variants,
  });
  if (malformed) return `<${cfg.marker}_RESULT_JSON>${body.slice(0, -1)}</${cfg.marker}_RESULT_JSON>`;
  return `<${cfg.marker}_RESULT_JSON>${body}</${cfg.marker}_RESULT_JSON>`;
}

describe('structured external traffic platforms', () => {
  for (const [platformId, cfg] of Object.entries(PLATFORM_CASES)) {
    test(`${platformId} returns A/B/C final-only structured output`, () => {
      const out = dispatcher.processResponse(platformId, buildRaw(platformId, cfg));
      expect(out[cfg.extra]).toBeDefined();
      expect(out[cfg.extra].variants).toHaveLength(3);
      for (const variant of out[cfg.extra].variants) {
        expect(variant[cfg.candidateKey]).toHaveLength(10);
        expect(variant.finalRevision).toBeDefined();
      }

      const flat = dispatcher.flatten(out.formatted);
      expect(flat).toContain(SOURCE_URL);
      expect(flat).not.toContain('RESULT_JSON');
      expect(flat).not.toContain('"context"');
      expect(flat).not.toContain('청년내일저축계좌');
      expect(out.lengthViolations).toEqual([]);

      if (cfg.expectedFormat === 'parts') {
        expect(out.formatted.parts).toBeDefined();
        for (const key of cfg.expectedParts) {
          expect(out.formatted.parts[key]).toBeTruthy();
        }
      } else {
        expect(out.formatted.body).toBeTruthy();
      }
    });
  }

  test('malformed structured JSON recovers final revisions when possible', () => {
    const cfg = PLATFORM_CASES.facebook;
    const out = dispatcher.processResponse('facebook', buildRaw('facebook', cfg, true));
    expect(out.facebook.variants).toHaveLength(3);
    expect(dispatcher.flatten(out.formatted)).toContain(SOURCE_URL);
    expect(dispatcher.flatten(out.formatted)).not.toContain('RESULT_JSON');
  });
});
