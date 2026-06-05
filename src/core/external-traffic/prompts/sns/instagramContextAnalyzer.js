'use strict';

const ARTICLE_TYPES = [
  '정부지원금/정책',
  '세금/환급/공제',
  '보험/금융조회',
  '건강/의학/생활건강',
  '부동산/주거/월세',
  '자동차/교통/세금',
  '블로그 수익화/자동화툴',
  'AI도구/프로그램/업무자동화',
  '연예/이슈/사건정리',
  '스포츠/경기/선수이슈',
  '생활정보/꿀팁',
  '제품/서비스 소개',
  '기타',
];

const TYPE_RULES = [
  {
    type: '정부지원금/정책',
    keywords: ['지원금', '정책', '신청', '자격', '대상', '복지', '계좌', '정부', '보조금', '급여', '수당'],
    variables: ['대상 조건', '신청 전 확인할 기준', '놓치기 쉬운 제한사항', '신청 전 체크 요소'],
  },
  {
    type: '세금/환급/공제',
    keywords: ['세금', '환급', '공제', '소득세', '부가세', '종합소득세', '신고', '감면', '연말정산'],
    variables: ['환급 가능성', '신고/조회 시기', '놓치기 쉬운 공제', '확인해야 할 서류나 조건'],
  },
  {
    type: '보험/금융조회',
    keywords: ['보험', '보험금', '내보험', '금융', '조회', '청구', '숨은 돈', '환급금', '계좌', '인증'],
    variables: ['숨은 금액 가능성', '조회 방법', '청구 전 확인사항', '본인 인증/공식 경로 주의'],
  },
  {
    type: '건강/의학/생활건강',
    keywords: ['건강', '증상', '병원', '통증', '기침', '질환', '예방', '치료', '완치', '약', '의학'],
    variables: ['증상', '원인 가능성', '병원 확인 필요성', '위험 신호', '생활 관리 포인트'],
  },
  {
    type: '부동산/주거/월세',
    keywords: ['부동산', '주거', '월세', '전세', '임대', '청약', '대출', '보증금', '계약'],
    variables: ['계약 전 확인할 조건', '비용 확인 포인트', '놓치기 쉬운 제한사항', '서류/절차 체크 요소'],
  },
  {
    type: '자동차/교통/세금',
    keywords: ['자동차', '차량', '교통', '운전', '과태료', '자동차세', '보험료', '면허', '정비'],
    variables: ['확인해야 할 대상', '비용/세금 포인트', '처리 절차', '놓치기 쉬운 주의사항'],
  },
  {
    type: '블로그 수익화/자동화툴',
    keywords: ['블로그', '수익', '애드센스', '자동화', '포스팅', '네이버 블로그', '워드프레스', '블로그스팟'],
    variables: ['시간 절약', '반복 작업 감소', '초보자가 막히는 부분', '수익화 전 확인할 요소', '사용 전 주의할 점'],
  },
  {
    type: 'AI도구/프로그램/업무자동화',
    keywords: ['ai', '챗gpt', 'chatgpt', '프로그램', '업무자동화', '툴', '자동화', '생성형', '프롬프트'],
    variables: ['사용 목적', '시간 절약 포인트', '도입 전 확인할 조건', '결과 검수 포인트'],
  },
  {
    type: '연예/이슈/사건정리',
    keywords: ['연예', '이슈', '논란', '사건', '반응', '화제', '입장', '논쟁', '의혹', '해명'],
    variables: ['왜 화제가 됐는지', '대중 반응', '논란 포인트', '사실 확인 포인트', '오해하기 쉬운 부분'],
  },
  {
    type: '스포츠/경기/선수이슈',
    keywords: ['스포츠', '경기', '선수', '야구', '축구', '농구', '배구', '감독', '이적', '순위'],
    variables: ['경기/선수 핵심 이슈', '팬 반응 포인트', '결과 확인 포인트', '놓치기 쉬운 맥락'],
  },
  {
    type: '생활정보/꿀팁',
    keywords: ['생활정보', '꿀팁', '방법', '정리', '확인', '주의사항', '체크리스트', '절약', '실생활'],
    variables: ['지금 확인해야 할 이유', '실생활에서 놓치기 쉬운 부분', '저장할 만한 체크리스트', '주변에 공유할 대상'],
  },
  {
    type: '제품/서비스 소개',
    keywords: ['제품', '서비스', '후기', '가격', '기능', '비교', '추천', '구매', '리뷰'],
    variables: ['사용 전 확인 포인트', '비교 요소', '주의할 점', '구매/사용 판단 기준'],
  },
];

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(params) {
  const title = String(params.sourceTitle || '').trim();
  const sourceText = stripHtml(params.sourceText || '');
  const summary = params.sourceSummary || {};
  const summaryText = [
    summary.coreValue,
    Array.isArray(summary.hooks) ? summary.hooks.join(' ') : '',
    Array.isArray(summary.keyPoints) ? summary.keyPoints.join(' ') : '',
    Array.isArray(summary.keywords) ? summary.keywords.join(' ') : '',
    Array.isArray(params.sourceKeywords) ? params.sourceKeywords.join(' ') : String(params.sourceKeywords || ''),
  ].filter(Boolean).join(' ');
  return {
    title,
    sourceText: sourceText.slice(0, 4000),
    all: `${title} ${sourceText} ${summaryText}`.toLowerCase(),
  };
}

function classifyArticleType(params) {
  const explicit = String(params.sourceType || '').trim();
  if (ARTICLE_TYPES.includes(explicit)) return explicit;

  const normalized = normalizeText(params);
  let best = { type: '기타', score: 0 };
  for (const rule of TYPE_RULES) {
    const score = rule.keywords.reduce((sum, keyword) => {
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = normalized.all.match(new RegExp(escaped, 'gi'));
      return sum + (matches ? matches.length : 0);
    }, 0);
    if (score > best.score) best = { type: rule.type, score };
  }
  return best.score > 0 ? best.type : '기타';
}

function getTypeGuidance(type) {
  const rule = TYPE_RULES.find((item) => item.type === type);
  return rule ? rule.variables : ['원문에서 확인 가능한 핵심 포인트', '독자가 헷갈릴 수 있는 부분', '저장할 만한 체크 요소', '링크에서 더 확인할 정보'];
}

function extractKeywords(params) {
  const normalized = normalizeText(params);
  const seeds = `${normalized.title} ${normalized.sourceText}`
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && w.length <= 20);
  const stop = new Set(['그리고', '하지만', '때문에', '입니다', '합니다', '있는', '없는', '방법', '정리', '확인']);
  const counts = new Map();
  for (const word of seeds) {
    if (stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
}

function buildInstagramContext(params) {
  const normalized = normalizeText(params);
  const type = classifyArticleType(params);
  const keywords = extractKeywords(params);
  const variables = getTypeGuidance(type);
  const hasBody = normalized.sourceText.length > 80;

  return {
    sourceTitle: normalized.title,
    sourceText: normalized.sourceText,
    sourceUrl: params.sourceUrl || '',
    articleType: type,
    sourceKeywords: keywords,
    contextConfidence: hasBody ? '본문 일부 기반' : '제목/요약 기반',
    variableHints: variables,
    missingBodyWarning: hasBody ? '' : '원문 본문이 충분하지 않으면 제목과 요약에서 확인 가능한 범위만 사용해야 합니다.',
  };
}

function buildContextPromptBlock(context) {
  return `[원문 문맥 분석 입력]
- 원문 제목: ${context.sourceTitle}
- 원문 URL: ${context.sourceUrl}
- 자동 분류 후보: ${context.articleType}
- 분석 신뢰도: ${context.contextConfidence}
- 추출 키워드: ${context.sourceKeywords.join(', ') || '없음'}
- 유형별 확인 변수: ${context.variableHints.join(' / ')}
- 원문 본문/요약:
${context.sourceText || '(본문 없음. 제목과 URL, 요약에서 확인 가능한 범위만 사용)'}
${context.missingBodyWarning ? `\n- 주의: ${context.missingBodyWarning}` : ''}`;
}

module.exports = {
  ARTICLE_TYPES,
  TYPE_RULES,
  stripHtml,
  classifyArticleType,
  getTypeGuidance,
  extractKeywords,
  buildInstagramContext,
  buildContextPromptBlock,
};
