'use strict';

const HOOK_ENGINES = [
  {
    id: 'misconception',
    label: '착각 깨기형',
    purpose: '독자가 잘못 알고 있을 만한 기준이나 판단을 흔든다.',
  },
  {
    id: 'loss_avoidance',
    label: '손해 회피형',
    purpose: '확인하지 않으면 놓칠 수 있다는 감정을 만든다.',
  },
  {
    id: 'self_projection',
    label: '자기 상황 대입형',
    purpose: '독자가 자기 상황을 바로 떠올리게 만든다.',
  },
  {
    id: 'reversal',
    label: '반전형',
    purpose: '일반적인 기대와 다른 관점으로 멈추게 한다.',
  },
  {
    id: 'checklist',
    label: '체크리스트형',
    purpose: '저장 욕구를 자극한다.',
  },
  {
    id: 'curiosity_issue',
    label: '논란/궁금증형',
    purpose: '이슈성 글에서 궁금증과 의견 반응을 만든다.',
  },
];

const TYPE_ENGINE_HINTS = {
  '정부지원금/정책': ['loss_avoidance', 'checklist', 'reversal'],
  '세금/환급/공제': ['loss_avoidance', 'checklist', 'self_projection'],
  '보험/금융조회': ['loss_avoidance', 'self_projection', 'checklist'],
  '건강/의학/생활건강': ['self_projection', 'checklist', 'loss_avoidance'],
  '부동산/주거/월세': ['checklist', 'loss_avoidance', 'reversal'],
  '자동차/교통/세금': ['loss_avoidance', 'checklist', 'self_projection'],
  '블로그 수익화/자동화툴': ['reversal', 'checklist', 'self_projection'],
  'AI도구/프로그램/업무자동화': ['reversal', 'checklist', 'self_projection'],
  '연예/이슈/사건정리': ['curiosity_issue', 'reversal', 'misconception'],
  '스포츠/경기/선수이슈': ['curiosity_issue', 'reversal', 'self_projection'],
  '생활정보/꿀팁': ['checklist', 'self_projection', 'loss_avoidance'],
  '제품/서비스 소개': ['misconception', 'checklist', 'reversal'],
  '기타': ['checklist', 'self_projection', 'reversal'],
};

function getRecommendedHookEngines(articleType) {
  const ids = TYPE_ENGINE_HINTS[articleType] || TYPE_ENGINE_HINTS['기타'];
  return ids.map((id) => HOOK_ENGINES.find((engine) => engine.id === id)).filter(Boolean);
}

function buildHookInstructionBlock(articleType) {
  const recommended = getRecommendedHookEngines(articleType);
  return `[후킹 엔진 선택]
아래 6개 중 A/B/C 각 안에 가장 자연스러운 엔진을 선택하라.
예시 문장은 복사하지 말고 원문 문맥에 맞춰 새로 작성하라.

${HOOK_ENGINES.map((engine, idx) => `${idx + 1}. ${engine.label}: ${engine.purpose}`).join('\n')}

이 글 유형(${articleType})에서 우선 검토할 엔진:
${recommended.map((engine) => `- ${engine.label}: ${engine.purpose}`).join('\n')}`;
}

module.exports = {
  HOOK_ENGINES,
  TYPE_ENGINE_HINTS,
  getRecommendedHookEngines,
  buildHookInstructionBlock,
};
