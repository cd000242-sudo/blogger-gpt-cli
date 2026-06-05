'use strict';

const {
  classifyArticleType,
  buildInstagramContext,
} = require('../../../src/core/external-traffic/prompts/sns/instagramContextAnalyzer');
const {
  parseInstagramResult,
  buildCopyFromVariant,
  JSON_START,
  JSON_END,
} = require('../../../src/core/external-traffic/prompts/sns/instagramRewrite');
const dispatcher = require('../../../src/core/external-traffic');

describe('Instagram context analyzer', () => {
  const cases = [
    ['2026 청년내일저축계좌 조건과 신청방법', '정부지원금/정책'],
    ['숨은 보험금 조회, 내보험찾아줌으로 확인하는 방법', '보험/금융조회'],
    ['중소기업 소득세 감면, 5년치 환급 가능 여부 확인법', '세금/환급/공제'],
    ['기침할 때 가슴 통증이 생기는 이유와 병원 확인이 필요한 경우', '건강/의학/생활건강'],
    ['네이버 블로그 자동화툴, 초보자가 세팅 전 확인할 점', '블로그 수익화/자동화툴'],
  ];

  test.each(cases)('%s → %s', (title, expected) => {
    expect(classifyArticleType({ sourceTitle: title })).toBe(expected);
  });

  test('특정 지원금 예시가 보험 글 문맥에 섞이지 않는다', () => {
    const context = buildInstagramContext({
      sourceTitle: '숨은 보험금 조회, 내보험찾아줌으로 확인하는 방법',
      sourceText: '본인 인증 후 공식 조회 경로에서 숨은 보험금을 확인하는 절차를 다룹니다.',
      sourceUrl: 'https://example.com/insurance',
    });
    expect(context.articleType).toBe('보험/금융조회');
    expect(context.variableHints.join(' ')).toContain('청구');
    expect(context.variableHints.join(' ')).not.toContain('소득 기준');
    expect(context.variableHints.join(' ')).not.toContain('가구 기준');
  });
});

describe('Instagram structured result parser', () => {
  function makeVariant(key, label, score) {
    return {
      key,
      label,
      tone: `${label} 톤`,
      articleType: '생활정보/꿀팁',
      targetReader: '확인할 정보를 저장해두고 싶은 독자',
      goal: '저장과 링크 확인',
      hookEngine: '체크리스트형',
      firstLineCandidates: Array.from({ length: 10 }, (_, i) => ({
        text: `${label} 첫 줄 후보 ${i + 1}`,
        score: score - (i % 4),
      })),
      selectedFirstLine: `${label} 선택 첫 줄`,
      firstLineScore: score,
      selectedReason: '원문 문맥과 저장 욕구가 맞음',
      body: '본문에서 확인 가능한 내용만 짧게 정리합니다.',
      savePrompt: '나중에 확인하려면 저장해두세요.',
      sharePrompt: '비슷한 상황의 지인에게 공유해보세요.',
      commentPrompt: '가장 헷갈리는 부분을 댓글로 남겨보세요.',
      linkPrompt: '세부 기준은 프로필 링크에서 확인할 수 있습니다.',
      hashtags: ['#생활정보', '#체크리스트', '#정보정리', '#저장각', '#실생활팁', '#확인필수', '#꿀팁', '#원문확인'],
      expectedClickStrength: '높음',
      critique: { score, notes: '안전 표현 유지', breakdown: { hook: 15, context: 15, save: 15, share: 10, reader: 15, link: 10, lowAd: 10, truth: 10 } },
      finalRevision: {
        firstLine: `${label} 최종 첫 줄`,
        body: '최종 본문입니다.\n확인 가능한 내용만 담았습니다.',
        savePrompt: '필요할 때 보려고 저장해두세요.',
        sharePrompt: '비슷한 상황의 지인에게 공유해보세요.',
        commentPrompt: '어떤 부분이 가장 헷갈리나요?',
        linkPrompt: '자세한 기준은 프로필 링크에서 확인하세요.',
        hashtags: ['#생활정보', '#체크리스트', '#정보정리', '#저장각', '#실생활팁', '#확인필수', '#꿀팁', '#원문확인'],
      },
    };
  }

  test('A/B/C 3안과 최종 복사본을 분리한다', () => {
    const raw = `${JSON_START}
${JSON.stringify({
  context: {
    sourceTitle: '생활정보 테스트',
    coreTopic: '확인할 생활정보',
    articleType: '생활정보/꿀팁',
  },
  variants: [
    makeVariant('A', '저장형', 96),
    makeVariant('B', '공감형', 93),
    makeVariant('C', '경고형', 91),
  ],
})}
${JSON_END}`;
    const parsed = parseInstagramResult(raw);
    expect(parsed.variants).toHaveLength(3);
    expect(parsed.variants[0].firstLineCandidates).toHaveLength(10);
    expect(parsed.variants[0].recommended).toBe(true);

    const copy = buildCopyFromVariant(parsed.variants[0]);
    expect(copy).toContain('최종 첫 줄');
    expect(copy).toContain('#생활정보');
    expect(copy).not.toContain('첫 줄 후보');
    expect(copy).not.toContain('선택 이유');
    expect(copy).not.toContain('자체 비평');
  });

  test('dispatcher가 구조화된 인스타그램 응답을 UI용 메타로 보존한다', () => {
    const raw = `${JSON_START}${JSON.stringify({
      context: { articleType: '생활정보/꿀팁', sourceTitle: '테스트' },
      variants: [makeVariant('A', '저장형', 96), makeVariant('B', '공감형', 93), makeVariant('C', '경고형', 91)],
    })}${JSON_END}`;
    const out = dispatcher.processResponse('instagram', raw);
    expect(out.instagram.variants).toHaveLength(3);
    expect(out.formatted.body).toContain('최종 본문');
    expect(out.formatted.hashtags.length).toBeGreaterThanOrEqual(8);
    expect(out.lengthViolations).toEqual([]);
  });

  test('malformed Instagram JSON with raw line breaks is recovered as final copy only', () => {
    const raw = `${JSON_START}
{
  "context": {
    "sourceTitle": "Tax guide",
    "coreTopic": "Tax mistake checklist",
    "articleType": "tax"
  },
  "variants": [
    {
      "key": "A",
      "label": "save",
      "selectedFirstLine": "This tax mistake
can cost you later.",
      "finalRevision": {
        "firstLine": "This tax mistake
can cost you later.",
        "body": "Check this before filing.
It is a simple checklist for readers.",
        "savePrompt": "Save this for later.",
        "sharePrompt": "Share it with someone who files taxes.",
        "commentPrompt": "Comment with your question.",
        "linkPrompt": "Check the full guide from the profile link.",
        "hashtags": []
      }
    }
  ]
}
${JSON_END}`;
    const out = dispatcher.processResponse('instagram', raw);
    expect(out.instagram.variants).toHaveLength(1);
    expect(out.formatted.body).toContain('This tax mistake');
    expect(out.formatted.body).not.toContain('INSTAGRAM_RESULT_JSON');
    expect(out.formatted.body).not.toContain('finalRevision');
    expect(out.formatted.hashtags.length).toBeGreaterThanOrEqual(8);
    expect(out.lengthViolations.join(' ')).toContain('A/B/C');
  });
});
