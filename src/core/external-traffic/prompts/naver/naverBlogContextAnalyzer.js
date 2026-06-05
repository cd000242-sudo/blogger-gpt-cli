'use strict';

const ARTICLE_TYPES = [
  '정부지원금/정책',
  '세금/환급/공제',
  '보험/금융조회',
  '건강/의학/생활건강',
  '부동산/주거/월세',
  '자동차/교통/벌금',
  '블로그 수익화/자동화툴',
  'AI도구/프로그램/업무자동화',
  '연예/이슈/사건정리',
  '스포츠 경기/선수 이슈',
  '생활정보/꿀팁',
  '제품/서비스 소개',
  '기타',
];

const TYPE_RULES = [
  ['정부지원금/정책', /(지원금|정책|신청|복지|청년|계좌|장려금|보조금|정부|공고)/],
  ['세금/환급/공제', /(세금|환급|공제|소득세|부가세|추징|탈세|신고|국세청)/],
  ['보험/금융조회', /(보험|금융|대출|청구|조회|계좌|카드|이자|은행)/],
  ['건강/의학/생활건강', /(건강|증상|병원|의학|치료|예방|통증|영양|검사)/],
  ['부동산/주거/월세', /(부동산|주거|월세|전세|청약|임대|아파트|집값)/],
  ['자동차/교통/벌금', /(자동차|교통|벌금|과태료|운전|차량|면허|주차)/],
  ['블로그 수익화/자동화툴', /(블로그|애드센스|수익|자동화|포스팅|워드프레스|블로그스팟)/],
  ['AI도구/프로그램/업무자동화', /(AI|인공지능|프로그램|툴|자동화|업무|소프트웨어|앱)/i],
  ['연예/이슈/사건정리', /(연예|배우|가수|사건|논란|이슈|결별|열애|보도)/],
  ['스포츠 경기/선수 이슈', /(스포츠|경기|선수|야구|축구|농구|감독|리그)/],
  ['생활정보/꿀팁', /(생활|꿀팁|방법|정리|확인|주의|체크|준비)/],
  ['제품/서비스 소개', /(제품|서비스|리뷰|사용법|가격|구매|추천|비교)/],
];

function buildNaverBlogContext({
  sourceSummary,
  sourceUrl,
  sourceTitle,
  sourceText,
  sourceKeywords,
  sourceType,
}) {
  const title = String(sourceTitle || '').trim();
  const text = String(sourceText || '').replace(/\s+/g, ' ').trim();
  const summary = sourceSummary || {};
  const keywordPool = normalizeKeywords([
    ...(Array.isArray(sourceKeywords) ? sourceKeywords : []),
    ...(Array.isArray(summary.keywords) ? summary.keywords : []),
    ...extractKeywordCandidates(title),
    ...extractKeywordCandidates(summary.coreValue || ''),
    ...extractKeywordCandidates(text),
  ]);
  const articleType = inferArticleType({
    title,
    text,
    keywords: keywordPool,
    sourceType,
  });
  const primaryKeyword = keywordPool[0] || title.split(/\s+/).slice(0, 3).join(' ') || articleType;
  const secondaryKeywords = keywordPool
    .filter((kw) => kw !== primaryKeyword)
    .slice(0, 5);
  const searchTerms = buildSearchTerms(primaryKeyword, secondaryKeywords, articleType);
  const keyPoints = Array.isArray(summary.keyPoints) && summary.keyPoints.length
    ? summary.keyPoints
    : splitSentences(text).slice(0, 5);
  const dataPoints = Array.isArray(summary.dataPoints) ? summary.dataPoints : [];

  return {
    sourceTitle: title,
    sourceUrl: String(sourceUrl || '').trim(),
    coreTopic: String(summary.coreValue || keyPoints[0] || title).slice(0, 160),
    articleType,
    primaryKeyword,
    secondaryKeywords,
    searchTerms,
    targetReader: inferTargetReader(articleType, primaryKeyword),
    readerQuestion: inferReaderQuestion(articleType, primaryKeyword),
    confusingPoint: inferConfusingPoint(articleType),
    directInfo: keyPoints.slice(0, 3),
    gatedInfo: buildGatedInfo(articleType),
    explanationPoints: keyPoints.slice(0, 5),
    mustKeepFacts: normalizeFacts([...keyPoints, ...dataPoints]).slice(0, 8),
    doNotUse: buildDoNotUse(articleType),
    riskyExpressions: buildRiskyExpressions(articleType),
  };
}

function buildContextPromptBlock(context) {
  return `[네이버 블로그 문맥 분석]
- 원문 제목: ${context.sourceTitle}
- 원문 URL: ${context.sourceUrl}
- 원문 핵심 주제: ${context.coreTopic}
- 자동 분류 글 유형: ${context.articleType}
- 핵심 키워드: ${context.primaryKeyword}
- 보조 키워드: ${context.secondaryKeywords.join(', ') || '(없음)'}
- 검색자가 입력할 만한 검색어: ${context.searchTerms.join(', ') || '(없음)'}
- 예상 독자: ${context.targetReader}
- 검색자가 궁금해할 질문: ${context.readerQuestion}
- 검색자가 헷갈릴 부분: ${context.confusingPoint}
- 본문에서 바로 제공할 정보: ${context.directInfo.join(' / ') || '(원문에서 추출 필요)'}
- 원문으로 자연스럽게 유도할 정보: ${context.gatedInfo.join(' / ')}
- 설명 포인트: ${context.explanationPoints.join(' / ') || '(원문에서 추출 필요)'}
- 반드시 지켜야 할 사실: ${context.mustKeepFacts.join(' / ') || '(원문 기준 유지)'}
- 쓰면 안 되는 내용: ${context.doNotUse.join(' / ')}
- 과장 위험 표현: ${context.riskyExpressions.join(' / ')}`;
}

function inferArticleType({ title, text, keywords, sourceType }) {
  const haystack = `${sourceType || ''} ${title || ''} ${keywords.join(' ')} ${text || ''}`;
  for (const [type, re] of TYPE_RULES) {
    if (re.test(haystack)) return type;
  }
  return '기타';
}

function normalizeKeywords(values) {
  const stop = new Set([
    '그리고', '하지만', '입니다', '합니다', '있는', '없는', '확인', '정리', '방법', '기준',
    '본문', '원문', '내용', '대한', '관련', '경우', '부분', '오늘',
  ]);
  return values
    .flatMap((value) => String(value || '').split(/[,#\s]+/))
    .map((kw) => kw.trim())
    .filter((kw) => kw.length >= 2 && kw.length <= 18 && !stop.has(kw))
    .filter((kw, idx, arr) => arr.indexOf(kw) === idx)
    .slice(0, 12);
}

function extractKeywordCandidates(text) {
  return String(text || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 18)
    .slice(0, 20);
}

function splitSentences(text) {
  return String(text || '')
    .split(/[.!?\n。！？]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .slice(0, 8);
}

function buildSearchTerms(primaryKeyword, secondaryKeywords, articleType) {
  const suffixes = typeSuffixes(articleType);
  const terms = [
    primaryKeyword,
    ...suffixes.map((suffix) => `${primaryKeyword} ${suffix}`),
    ...secondaryKeywords.slice(0, 3).map((kw) => `${primaryKeyword} ${kw}`),
  ];
  return terms
    .map((term) => term.trim())
    .filter(Boolean)
    .filter((term, idx, arr) => arr.indexOf(term) === idx)
    .slice(0, 8);
}

function typeSuffixes(articleType) {
  if (articleType === '정부지원금/정책') return ['조건', '신청방법', '대상 확인'];
  if (articleType === '세금/환급/공제') return ['신고 기준', '조회 방법', '주의사항'];
  if (articleType === '보험/금융조회') return ['조회 방법', '청구 기준', '확인 순서'];
  if (articleType === '건강/의학/생활건강') return ['증상', '병원 확인', '주의사항'];
  if (articleType === '연예/이슈/사건정리') return ['이슈 정리', '핵심 쟁점', '사람들 반응'];
  if (articleType === '블로그 수익화/자동화툴') return ['초보 설정', '주의사항', '사용법'];
  return ['정리', '확인 방법', '주의사항'];
}

function inferTargetReader(articleType, primaryKeyword) {
  const byType = {
    '정부지원금/정책': `${primaryKeyword} 대상이나 신청 조건을 확인하려는 사람`,
    '세금/환급/공제': `${primaryKeyword} 기준과 신고 여부가 헷갈리는 사람`,
    '보험/금융조회': `${primaryKeyword} 조회나 청구 가능성을 확인하려는 사람`,
    '건강/의학/생활건강': `${primaryKeyword} 증상이나 확인 시점이 궁금한 사람`,
    '연예/이슈/사건정리': `${primaryKeyword} 이슈의 핵심만 빠르게 알고 싶은 사람`,
    '블로그 수익화/자동화툴': `${primaryKeyword}를 처음 설정하거나 비교하는 초보자`,
  };
  return byType[articleType] || `${primaryKeyword} 정보를 검색해서 정리해보고 싶은 사람`;
}

function inferReaderQuestion(articleType, primaryKeyword) {
  if (articleType === '정부지원금/정책') return `${primaryKeyword} 대상과 신청 방법은 어떻게 확인하면 좋을까요?`;
  if (articleType === '세금/환급/공제') return `${primaryKeyword} 기준은 어디서부터 확인해야 할까요?`;
  if (articleType === '보험/금융조회') return `${primaryKeyword} 조회나 청구 전 어떤 부분을 봐야 할까요?`;
  if (articleType === '건강/의학/생활건강') return `${primaryKeyword}는 언제 병원 확인이 필요할까요?`;
  return `${primaryKeyword}에서 먼저 확인할 부분은 무엇일까요?`;
}

function inferConfusingPoint(articleType) {
  if (articleType === '정부지원금/정책') return '대상, 기간, 필요 서류가 상황별로 달라질 수 있는 부분';
  if (articleType === '세금/환급/공제') return '개인 상황에 따라 신고 기준과 예외가 달라지는 부분';
  if (articleType === '보험/금융조회') return '가입 조건, 청구 가능성, 공식 경로 확인이 필요한 부분';
  if (articleType === '건강/의학/생활건강') return '증상만으로 단정하기 어렵고 진료 확인이 필요한 부분';
  return '원문 기준과 예외 사항을 함께 봐야 하는 부분';
}

function buildGatedInfo(articleType) {
  if (articleType === '정부지원금/정책') return ['세부 기준', '예외 사항', '실제 확인 순서'];
  if (articleType === '세금/환급/공제') return ['상황별 기준', '신고 전 체크리스트', '주의해야 할 예외'];
  if (articleType === '건강/의학/생활건강') return ['확인 시점', '주의 증상', '전문가 상담이 필요한 경우'];
  return ['자세한 기준', '체크리스트', '전체 흐름'];
}

function normalizeFacts(values) {
  return values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter((value) => value.length >= 8)
    .filter((value, idx, arr) => arr.indexOf(value) === idx);
}

function buildDoNotUse(articleType) {
  const common = ['원문에 없는 금액', '원문에 없는 기간', '원문에 없는 대상자', '무조건 가능하다는 표현'];
  if (articleType === '건강/의학/생활건강') return [...common, '진단처럼 보이는 단정', '치료 보장 표현'];
  if (articleType === '연예/이슈/사건정리') return [...common, '확인되지 않은 사생활 추측', '인물 비난'];
  if (articleType === '블로그 수익화/자동화툴') return [...common, '수익 보장 표현'];
  return common;
}

function buildRiskyExpressions(articleType) {
  const common = ['100% 보장', '무조건 가능', '반드시 됩니다', '지금 바로 클릭'];
  if (articleType === '건강/의학/생활건강') return [...common, '치료됩니다', '완치됩니다'];
  if (articleType === '세금/환급/공제') return [...common, '환급 확정', '신고만 하면 됩니다'];
  return common;
}

module.exports = {
  ARTICLE_TYPES,
  buildNaverBlogContext,
  buildContextPromptBlock,
  inferArticleType,
};
