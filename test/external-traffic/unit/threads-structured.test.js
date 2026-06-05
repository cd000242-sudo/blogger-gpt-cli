'use strict';

const dispatcher = require('../../../src/core/external-traffic');
const {
  JSON_START,
  JSON_END,
  parseThreadsResult,
  buildCopyFromVariant,
} = require('../../../src/core/external-traffic/prompts/sns/threadsRewrite');

function variant(key, label, firstLine, body, url) {
  return {
    key,
    label,
    tone: '친구에게 툭 말하는 반말',
    goal: `${label} 목표`,
    hookEngine: '질문형 훅',
    firstLineCandidates: Array.from({ length: 10 }, (_, idx) => ({
      text: `${firstLine} 후보 ${idx + 1}`,
      score: 80 + idx,
    })),
    selectedFirstLine: firstLine,
    firstLineScore: 91,
    selectedReason: '댓글로 이어지기 쉬움',
    body,
    commentPrompt: '다들 이런 경우 어떻게 봄?',
    sharePrompt: '주변에 헷갈리는 사람 있으면 같이 봐도 좋음',
    linkPrompt: `원문은 여기: ${url}`,
    critique: { score: 92, notes: 'Threads 톤 유지' },
    finalRevision: {
      firstLine,
      body,
      commentPrompt: '다들 이런 경우 어떻게 봄?',
      sharePrompt: '주변에 헷갈리는 사람 있으면 같이 봐도 좋음',
      linkPrompt: `원문은 여기: ${url}`,
    },
  };
}

describe('Threads structured response', () => {
  const url = 'https://example.com/source';

  test('dispatcher returns A/B/C variants and formatted copy only', () => {
    const raw = `${JSON_START}
${JSON.stringify({
  context: {
    sourceTitle: '세금 추징과 탈세 차이',
    coreTopic: '세금 추징과 탈세의 실무 차이',
    articleType: '세금/환급/공제',
    targetReader: '세금 신고가 헷갈리는 개인 사업자',
    readerSituation: '추징과 탈세의 경계가 애매해서 불안한 상황',
  },
  variants: [
    variant('A', '댓글형', '나만 추징이랑 탈세 헷갈렸나?', '기준이 애매하면 괜히 겁부터 나잖아. 근데 둘은 출발점이 좀 다름.', url),
    variant('B', '공감형', '세금 얘기만 나오면 괜히 불안한 사람 있음?', '특히 신고 끝난 뒤에 뭐 하나 빠졌나 싶을 때가 제일 찝찝함.', url),
    variant('C', '공유형', '주변에 사업자 있으면 이 기준은 같이 봐야 함', '추징은 실수 정정에 가까운 경우가 있고, 탈세는 의도성이 핵심으로 갈릴 수 있음.', url),
  ],
})}
${JSON_END}`;

    const out = dispatcher.processResponse('threads', raw);
    expect(out.threads.variants).toHaveLength(3);
    expect(out.formatted.body).toContain(url);
    expect(out.formatted.body).not.toContain(JSON_START);
    expect(out.formatted.body).not.toContain('"context"');
    expect(out.formatted.body).not.toMatch(/자세한 내용은 링크|확인해보시기 바랍니다|부탁드립니다/);
  });

  test('loose malformed JSON is recovered into final copy', () => {
    const raw = `${JSON_START}
{
  "context": {
    "coreTopic": "세금 추징과 탈세",
    "articleType": "세금/환급/공제",
    "targetReader": "프리랜서",
    "readerSituation": "신고 기준이 애매한 상황"
  },
  "variants": [
    {
      "key": "A",
      "label": "댓글형",
      "selectedFirstLine": "나만 이 기준 헷갈렸나?",
      "finalRevision": {
        "firstLine": "나만 이 기준 헷갈렸나?",
        "body": "신고하다 보면 실수인지 문제인지 경계가 애매할 때가 있잖아",
        "commentPrompt": "다들 이런 건 어디까지 확인함?",
        "linkPrompt": "원문은 여기: ${url}"
      }
    },
    {
      "key": "B",
      "label": "공감형",
      "finalRevision": {
        "firstLine": "세금 신고 끝나고도 찝찝한 사람 있음?",
        "body": "숫자 하나 빠뜨린 것 같으면 괜히 며칠씩 신경 쓰임",
        "commentPrompt": "이럴 때 다들 다시 확인해?",
        "linkPrompt": "${url}"
      }
    },
    {
      "key": "C",
      "label": "공유형",
      "finalRevision": {
        "firstLine": "프리랜서 주변에 있으면 이건 같이 봐야 함",
        "body": "추징이랑 탈세는 단어 느낌보다 기준 차이를 봐야 하더라",
        "commentPrompt": "헷갈리는 사람 많을 듯",
        "linkPrompt": "${url}"
      }
    }
  ]
${JSON_END}`;

    const parsed = parseThreadsResult(raw);
    expect(parsed.variants).toHaveLength(3);
    const copy = buildCopyFromVariant(parsed.variants[0]);
    expect(copy).toContain('나만 이 기준 헷갈렸나?');
    expect(copy).toContain(url);
    expect(copy).not.toContain(JSON_START);
  });
});
