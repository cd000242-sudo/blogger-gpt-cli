'use strict';

const dispatcher = require('../../../src/core/external-traffic');
const {
  JSON_START,
  JSON_END,
  parseNaverBlogResult,
  buildCopyFromVariant,
} = require('../../../src/core/external-traffic/prompts/naver/naverBlogRewrite');

const URL = 'https://example.com/naver-source';

function sectionBody(label) {
  return `${label}에서는 먼저 원문에서 확인된 기준을 중심으로 살펴보는 것이 좋습니다. 검색자가 바로 알고 싶은 부분은 대상과 확인 순서이지만, 실제 적용 여부는 개인 상황이나 예외 사항에 따라 달라질 수 있습니다. 그래서 본문에서는 핵심 흐름만 정리하고 세부 기준은 원문에서 이어서 확인할 수 있도록 구성했습니다.`;
}

function variant(key, label, title) {
  return {
    key,
    label,
    articleType: '정부지원금/정책',
    primaryKeyword: '청년내일저축계좌',
    secondaryKeywords: ['신청 조건', '확인 방법', '주의사항'],
    titleCandidates: Array.from({ length: 10 }, (_, idx) => ({
      text: `${title} 후보 ${idx + 1}`,
      score: 82 + idx,
    })),
    selectedTitle: title,
    titleScore: 93,
    selectedReason: '검색 의도와 확인 포인트가 함께 들어감',
    intro: '청년내일저축계좌를 검색하는 분들은 조건과 신청 흐름이 어디서 갈리는지 먼저 확인하고 싶으실 텐데요. 이번 글에서는 원문 기준으로 바로 볼 수 있는 부분만 간단히 정리했습니다.',
    sections: [
      { heading: '조건을 먼저 확인해야 하는 이유', body: sectionBody('조건') },
      { heading: '신청 전에 헷갈리기 쉬운 부분', body: sectionBody('신청 전 확인') },
      { heading: '원문에서 이어서 보면 좋은 기준', body: sectionBody('세부 기준') },
    ],
    sourceLead: `세부 기준과 예외사항은 원문 정리글에서 이어서 확인할 수 있습니다: ${URL}`,
    commentPrompt: '확인하다가 헷갈린 부분이 있다면 어떤 조건에서 막혔는지 남겨주세요.',
    hashtags: ['#청년내일저축계좌', '#정부지원금', '#신청조건', '#복지정보', '#체크리스트'],
    expectedClickStrength: '중간',
    critique: { score: 94, notes: '검색형 미니 포스트로 적합' },
    finalRevision: {
      title,
      intro: '청년내일저축계좌를 검색하는 분들은 조건과 신청 흐름이 어디서 갈리는지 먼저 확인하고 싶으실 텐데요. 이번 글에서는 원문 기준으로 바로 볼 수 있는 부분만 간단히 정리했습니다.',
      sections: [
        { heading: '조건을 먼저 확인해야 하는 이유', body: sectionBody('조건') },
        { heading: '신청 전에 헷갈리기 쉬운 부분', body: sectionBody('신청 전 확인') },
        { heading: '원문에서 이어서 보면 좋은 기준', body: sectionBody('세부 기준') },
      ],
      sourceLead: `세부 기준과 예외사항은 원문 정리글에서 이어서 확인할 수 있습니다: ${URL}`,
      commentPrompt: '확인하다가 헷갈린 부분이 있다면 어떤 조건에서 막혔는지 남겨주세요.',
      hashtags: ['#청년내일저축계좌', '#정부지원금', '#신청조건', '#복지정보', '#체크리스트'],
    },
  };
}

describe('Naver Blog structured response', () => {
  test('dispatcher returns A/B/C mini posts without exposing JSON', () => {
    const raw = `${JSON_START}
${JSON.stringify({
  context: {
    sourceTitle: '2026 청년내일저축계좌 조건 정리',
    coreTopic: '청년내일저축계좌 조건과 신청 전 확인사항',
    articleType: '정부지원금/정책',
    primaryKeyword: '청년내일저축계좌',
    secondaryKeywords: ['신청 조건', '복지 정보', '확인 방법'],
    searchTerms: ['청년내일저축계좌 조건', '청년내일저축계좌 신청방법'],
    targetReader: '지원 대상 여부를 확인하려는 청년',
    readerQuestion: '대상과 신청 조건은 어디서 확인하면 좋을까요?',
  },
  variants: [
    variant('A', '검색 정리형', '청년내일저축계좌 조건과 신청 전 확인방법 정리'),
    variant('B', '경험 공감형', '청년내일저축계좌 알아보다가 헷갈리는 조건 정리'),
    variant('C', '체크리스트형', '청년내일저축계좌 신청 전 체크할 기준 5가지'),
  ],
})}
${JSON_END}`;

    const out = dispatcher.processResponse('naver-blog', raw);
    expect(out.naverBlog.variants).toHaveLength(3);
    expect(out.naverBlog.variants[0].titleCandidates).toHaveLength(10);
    expect(out.formatted.body.length).toBeGreaterThanOrEqual(700);
    expect(out.formatted.body.length).toBeLessThanOrEqual(1200);
    expect(out.formatted.body).toContain(URL);
    expect(out.formatted.body).not.toContain(JSON_START);
    expect(out.formatted.body).not.toContain('"context"');
    expect(out.formatted.body).not.toMatch(/자세한 내용은 링크|아래 링크 클릭|지금 바로 확인/);
    expect(out.formatted.hashtags.length).toBeGreaterThanOrEqual(5);
    expect(out.formatted.hashtags.length).toBeLessThanOrEqual(8);
    expect(out.lengthViolations).toEqual([]);
  });

  test('loose malformed JSON can recover final revision', () => {
    const raw = `${JSON_START}
{
  "context": {
    "articleType": "보험/금융조회",
    "primaryKeyword": "숨은 보험금 조회",
    "secondaryKeywords": ["조회 방법", "청구 기준"]
  },
  "variants": [
    {
      "key": "A",
      "label": "검색 정리형",
      "selectedTitle": "숨은 보험금 조회 전 확인할 기준 정리",
      "titleScore": 91,
      "finalRevision": {
        "title": "숨은 보험금 조회 전 확인할 기준 정리",
        "intro": "숨은 보험금 조회는 공식 경로와 본인 확인 절차를 먼저 보는 것이 좋습니다.",
        "sourceLead": "세부 조회 순서는 원문에서 이어서 확인할 수 있습니다: ${URL}",
        "commentPrompt": "조회 과정에서 헷갈린 부분이 있다면 남겨주세요.",
        "hashtags": ["#숨은보험금", "#보험조회", "#금융정보", "#청구기준", "#확인방법"]
      }
    },
    {
      "key": "B",
      "label": "경험 공감형",
      "finalRevision": {
        "title": "숨은 보험금 찾을 때 막히는 부분 정리",
        "intro": "조회 버튼보다 먼저 봐야 하는 건 공식 경로와 본인 확인입니다.",
        "sourceLead": "${URL}",
        "commentPrompt": "어느 단계가 가장 헷갈렸나요?"
      }
    },
    {
      "key": "C",
      "label": "체크리스트형",
      "finalRevision": {
        "title": "숨은 보험금 조회 전 체크리스트",
        "intro": "조회 전에는 공식 경로, 본인 인증, 청구 가능성을 차례로 보는 것이 좋습니다.",
        "sourceLead": "${URL}",
        "commentPrompt": "확인 전 궁금한 점을 남겨주세요."
      }
    }
  ]
${JSON_END}`;

    const parsed = parseNaverBlogResult(raw);
    expect(parsed.variants).toHaveLength(3);
    const copy = buildCopyFromVariant(parsed.variants[0]);
    expect(copy).toContain('숨은 보험금 조회 전 확인할 기준 정리');
    expect(copy).toContain(URL);
    expect(copy).not.toContain(JSON_START);
  });
});
