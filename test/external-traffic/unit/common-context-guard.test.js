'use strict';

const dispatcher = require('../../../src/core/external-traffic');
const {
  analyzeSourceContext,
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
  buildStructuredJsonInstructions,
  scoreCommonReview,
  applyCommonResponseGuard,
  COMMON_BANNED_PHRASES,
} = require('../../../src/core/external-traffic/prompts/_shared/common-context-guard');

const PLATFORMS = [
  'instagram',
  'threads',
  'naver-blog',
  'naver-cafe',
  'x',
  'facebook',
  'kakao-openchat',
  'youtube-shorts',
  'tiktok',
  'pinterest',
];

const TOPIC_CASES = [
  ['2026 청년내일저축계좌 조건과 신청방법', '정부지원금/정책'],
  ['숨은 보험금 조회, 내보험찾아줌으로 확인하는 방법', '보험/금융조회'],
  ['기침할 때 가슴 통증이 생기는 이유와 병원 확인이 필요한 경우', '건강/의학/생활건강'],
  ['연예계 열애·결별 소식이 유독 많아 보이는 이유', '연예/이슈/사건정리'],
  ['네이버 블로그 자동화툴, 초보자가 세팅 전 확인할 점', '블로그 수익화/자동화툴'],
  ['중소기업 소득세 감면, 5년치 환급 가능 여부 확인법', '세금/환급/공제'],
  ['여름철 전기요금 줄이는 생활 습관 정리', '생활정보/꿀팁'],
  ['업무 자동화 프로그램 만들기 전 확인해야 할 점', 'AI도구/프로그램/업무자동화'],
];

describe('common external traffic context guard', () => {
  test.each(TOPIC_CASES)('classifies %s as %s', (sourceTitle, expected) => {
    const context = analyzeSourceContext({
      sourceTitle,
      sourceText: `${sourceTitle} 본문에서 확인 가능한 핵심만 정리합니다.`,
      sourceUrl: 'https://example.com/source',
    });
    expect(context.autoCategory).toBe(expected);
    expect(context.mustKeepFacts.join(' ')).toContain(sourceTitle.split(' ')[0]);
  });

  test.each(PLATFORMS)('%s prompt includes clean common analysis and platform rules', (platformId) => {
    const system = buildPlatformSystemPrompt(platformId);
    const user = buildPlatformUserPrompt(platformId, {
      sourceTitle: '여름철 전기요금 줄이는 생활 습관 정리',
      sourceText: '에어컨 사용 습관과 대기전력 관리를 중심으로 전기요금을 줄이는 방법을 설명합니다.',
      sourceUrl: 'https://example.com/power-saving',
      sourceKeywords: ['전기요금', '생활습관'],
    }, buildStructuredJsonInstructions({
      jsonStart: '<TEST_RESULT_JSON>',
      jsonEnd: '</TEST_RESULT_JSON>',
    }));

    expect(system).toContain('공통 원칙');
    expect(system).toContain('하드코딩');
    expect(user).toContain('공통 문맥 분석');
    expect(user).toContain('자동 분류된 글 유형: 생활정보/꿀팁');
    expect(user).toContain('finalRevision');
    for (const broken of ['�', '諛', '理', '洹', '?먮', '?ㅼ']) {
      expect(`${system}\n${user}`).not.toContain(broken);
    }
  });

  test('common review detects hardcoded policy context in unrelated source', () => {
    const review = scoreCommonReview(
      'facebook',
      '청년내일저축계좌는 월 10만 원만 넣으면 1,440만 원을 받을 수 있습니다.',
      {
        sourceTitle: '기침할 때 가슴 통증이 생기는 이유',
        autoCategory: '건강/의학/생활건강',
        mustKeepFacts: ['기침', '가슴 통증'],
      }
    );
    expect(review.needsRewrite).toBe(true);
    expect(review.violations.join(' ')).toContain('하드코딩');
  });

  test('dispatcher removes common banned click pressure from final formatted copy', () => {
    const raw = `<X_TWITTER_RESULT_JSON>${JSON.stringify({
      context: {
        sourceTitle: '여름철 전기요금 줄이는 생활 습관 정리',
        sourceUrl: 'https://example.com/power-saving',
        autoCategory: '생활정보/꿀팁',
        coreTopic: '전기요금 절약',
      },
      variants: ['A', 'B', 'C'].map((key) => ({
        key,
        label: `${key}안`,
        firstLineCandidates: Array.from({ length: 10 }, (_, idx) => ({ text: `전기요금 후보 ${idx + 1}`, score: 95 - idx })),
        selectedFirstLine: '여름 전기요금은 습관부터 보면 달라질 수 있습니다.',
        firstLineScore: 95,
        critique: { score: 95, notes: '검수 통과' },
        finalRevision: {
          firstLine: '여름 전기요금은 습관부터 보면 달라질 수 있습니다.',
          body: '에어컨 온도, 대기전력, 사용 시간처럼 본문에서 확인 가능한 범위만 짧게 정리했습니다.',
          quotePrompt: '어떤 습관이 제일 효과 있었나요?',
          repostPrompt: '필요한 분들은 참고용으로 저장해도 좋습니다.',
          linkPrompt: '지금 바로 클릭 https://example.com/power-saving',
          hashtags: ['#전기요금'],
        },
      })),
    })}</X_TWITTER_RESULT_JSON>`;
    const out = dispatcher.processResponse('x', raw);
    const flat = dispatcher.flatten(out.formatted);
    expect(flat).toContain('https://example.com/power-saving');
    expect(flat).not.toContain('지금 바로 클릭');
    expect(out.x.variants[0].commonReview).toBeDefined();
  });

  test('common banned phrase list includes required safety phrases', () => {
    expect(COMMON_BANNED_PHRASES).toEqual(expect.arrayContaining([
      '무조건 가능합니다',
      '100% 보장됩니다',
      '지금 바로 클릭',
      '아래 링크 클릭',
      '수익 보장',
    ]));
  });

  // v3.8.337: 해시태그는 sanitize 대상이 아니라 그대로 발행된다.
  //   검사에 넣으면 스스로 고칠 수 없는 위반이 되고, 그 위반이 재생성 루프를 돌려 비용만 태운다.
  test('해시태그의 클리셰 단어는 안전검수 위반으로 잡지 않는다', () => {
    const out = applyCommonResponseGuard('instagram', {
      body: '생활정보 정리했습니다. 자세한 내용은 원문에서 확인해보세요.',
      hashtags: ['#생활정보', '#체크리스트', '#꿀팁', '#원문확인'],
    }, {});
    expect(out.review.violations).toEqual([]);
    // 해시태그 자체는 손상 없이 그대로 유지되어야 한다
    expect(out.formatted.hashtags).toContain('#꿀팁');
  });

  // 실제 차단은 sanitize(본문에서 삭제)가 담당한다 — inspectSafety는 sanitize 이후에 돌기 때문.
  // 그래서 목록에서 빠진 표현은 "경고 없이 그대로 발행"된다(= '지금 바로 클릭' 누락이 위험했던 이유).
  test('본문의 금지 표현은 발행 전에 제거된다', () => {
    const out = applyCommonResponseGuard('instagram', {
      body: '정리했습니다. 지금 바로 클릭 후 확인하세요. 수익 보장 문구도 포함.',
      hashtags: ['#생활정보'],
    }, {});
    expect(out.formatted.body).not.toContain('지금 바로 클릭');
    expect(out.formatted.body).not.toContain('수익 보장');
    expect(out.formatted.body).toContain('정리했습니다');
  });
});
