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

const COMMON_CONTEXT_FIELDS = [
  'sourceTitle',
  'sourceUrl',
  'sourceSummary',
  'coreTopic',
  'autoCategory',
  'primaryKeywords',
  'secondaryKeywords',
  'targetReader',
  'readerQuestion',
  'confusingPoint',
  'lossPoint',
  'directInfo',
  'gatedInfo',
  'mustKeepFacts',
  'doNotUse',
  'riskyExpressions',
  'platformAngles',
];

const COMMON_BANNED_PHRASES = [
  '무조건 가능합니다',
  '누구나 가능합니다',
  '100% 보장됩니다',
  '반드시 됩니다',
  '확정입니다',
  '신청만 하면 됩니다',
  '돈이 바로 들어옵니다',
  '치료됩니다',
  '완치됩니다',
  '수익 보장',
  '대박',
  '역대급',
  '안 보면 손해',
  '지금 바로 클릭',
  '아래 링크 클릭',
  '무조건 확인',
  '무조건 저장',
  '무조건 공유',
];

const SAFE_REPLACEMENTS = [
  '조건에 따라 달라질 수 있습니다',
  '개인 상황에 따라 확인이 필요합니다',
  '세부 기준은 확인이 필요합니다',
  '예외사항이 있을 수 있습니다',
  '공식 안내와 함께 확인하는 것이 좋습니다',
  '본문에서 확인 가능한 범위만 정리했습니다',
  '필요한 분들은 참고용으로 확인해보시면 좋겠습니다',
  '보도 또는 공식 입장을 기준으로 확인하는 것이 좋습니다',
  '결과는 운영 방식에 따라 달라질 수 있습니다',
  '정확한 판단은 전문가 또는 공식 안내 확인이 필요합니다',
];

const HARD_CODED_TOPIC_TERMS = [
  '청년내일저축계좌',
  '청년 내일 저축 계좌',
  '월 10만 원',
  '1,440만 원',
  '1,080만 원',
];

const GOVERNMENT_ONLY_TERMS = [
  '소득 기준',
  '가구 기준',
  '신청 기간',
  '준비서류',
  '지원금',
  '신청 방법',
];

const PLATFORM_PROFILES = {
  instagram: {
    name: '인스타그램',
    purpose: '스크롤 멈춤, 저장, 공유, 댓글, 프로필 또는 링크 확인',
    format: '저장형 카드뉴스 캡션',
    tone: '짧고 정돈된 정보형 존댓말',
    avoid: '장문 설명, 링크 강요, 광고문',
    variants: { A: '저장형', B: '공감형', C: '경고형' },
    output: '첫 줄, 본문, 저장 유도, 공유 유도, 댓글 유도, 링크 유도, 해시태그',
  },
  threads: {
    name: 'Threads',
    purpose: '댓글, 공감, 재게시',
    format: '반말 대화체 글',
    tone: '자연스러운 반말',
    avoid: '존댓말 공문체, 블로그식 정보글, 광고문',
    variants: { A: '공감형', B: '논쟁형', C: '정보 티저형' },
    output: '첫 줄, 본문, 댓글 유도, 재게시 유도, 링크 유도, 해시태그 최대 3개',
  },
  'naver-blog': {
    name: '네이버 블로그',
    purpose: '검색 유입, 신뢰 형성, 원문 이동',
    format: '700자에서 1200자 미니 포스팅',
    tone: '신뢰감 있는 존댓말',
    avoid: '반말, 짧은 SNS 문구, 키워드 나열',
    variants: { A: '검색 정리형', B: '경험 공감형', C: '체크리스트형' },
    output: '제목, 도입부, 소제목, 본문, 원문 유도, 댓글 유도, 해시태그',
  },
  'naver-cafe': {
    name: '네이버 카페',
    purpose: '광고 거부감 최소화, 댓글, 자연스러운 링크 확인',
    format: '커뮤니티형 질문 또는 경험공유 글',
    tone: '친근한 존댓말',
    avoid: '처음부터 링크, 블로그 홍보문, 판매글 느낌',
    variants: { A: '질문형', B: '경험 공유형', C: '정보 공유형' },
    output: '제목, 본문, 댓글 유도, 링크 유도',
  },
  x: {
    name: 'X',
    purpose: '첫 문장 멈춤, 답글, 리포스트, 링크 확인',
    format: '280자 이내의 짧고 날카로운 티저',
    tone: '짧은 단정형 또는 문제제기형',
    avoid: '장문 설명, 해시태그 남발, 블로그 요약문',
    variants: { A: '링크 없는 티저형', B: '링크 포함 클릭형', C: '답글 유도형' },
    output: '첫 문장, 본문, 답글 유도, 리포스트 유도, 링크 유도, 해시태그 최대 2개',
  },
  facebook: {
    name: 'Facebook',
    purpose: '공유, 공감, 댓글, 링크 확인',
    format: '생활정보 공유형 글',
    tone: '중장년층도 읽기 편한 차분한 존댓말',
    avoid: '반말, 젊은 밈, 과한 이모지, 짧은 광고문',
    variants: { A: '생활정보 공유형', B: '가족·지인 공유형', C: '주의사항 정리형' },
    output: '첫 문장, 본문, 공유 유도, 댓글 유도, 링크 유도, 해시태그 최대 5개',
  },
  'kakao-openchat': {
    name: '카카오톡 오픈채팅',
    purpose: '부담 없이 읽힘, 필요한 사람만 확인, 링크 확인',
    format: '5줄에서 8줄 단톡방 공지형 글',
    tone: '짧고 친근한 존댓말',
    avoid: '장문, 도배 느낌, 해시태그, 클릭 강요',
    variants: { A: '짧은 공지형', B: '친근한 공유형', C: '긴급 체크형' },
    output: '첫 문장, 본문, 답장 유도, 링크 유도',
  },
  'youtube-shorts': {
    name: '유튜브 쇼츠',
    purpose: '첫 3초 시청 유지, 완시율, 고정댓글 이동',
    format: '30초에서 45초 영상 대본',
    tone: '말로 들었을 때 자연스러운 구어체',
    avoid: '블로그 요약문, 긴 문장, 고정댓글 클릭 강요',
    variants: { A: '정보 압축형', B: '경고·주의형', C: '공감·댓글형' },
    output: '영상 제목, 첫 3초 멘트, 본문 스크립트, 화면 자막, 댓글 유도, 고정댓글, 설명란, 해시태그',
  },
  tiktok: {
    name: '틱톡',
    purpose: '첫 2초 시청 유지, 댓글, 저장, 완시율',
    format: '20초에서 35초 빠른 컷 전환형 대본',
    tone: '빠르고 가벼운 구어체',
    avoid: '딱딱한 설명문, 쇼츠 대본 복붙, 긴 자막',
    variants: { A: '빠른 정보형', B: '공감·댓글형', C: '경고·실수형' },
    output: '영상 제목, 첫 2초 멘트, 본문 스크립트, 컷 전환 자막, 댓글 유도, 저장 유도, 프로필 또는 링크 유도, 해시태그',
  },
  pinterest: {
    name: '핀터레스트',
    purpose: '저장, 이미지 클릭, 블로그 유입',
    format: '검색형 핀 제목, 설명, 이미지 문구',
    tone: '짧고 실용적인 검색형 문장',
    avoid: '대화체, 영상 대본, 긴 홍보문, 클릭 강요',
    variants: { A: '검색 정리형', B: '저장 체크리스트형', C: '이미지 클릭형' },
    output: '핀 제목, 핀 설명, 이미지 문구, 이미지 디자인 방향, 블로그 유도 문장, 키워드 태그',
  },
};

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value) {
  return String(value || '')
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeTags(tags, max = 12) {
  return ensureArray(tags)
    .flatMap((tag) => String(tag || '').split(/\s+/))
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '').replace(/[^\p{L}\p{N}_-]/gu, '')}`)
    .filter((tag) => tag.length > 1)
    .filter((tag, idx, arr) => arr.indexOf(tag) === idx)
    .slice(0, max);
}

function sourceCombined(params = {}) {
  const summary = params.sourceSummary || {};
  return [
    params.sourceTitle,
    params.sourceText,
    params.sourceType,
    Array.isArray(params.sourceKeywords) ? params.sourceKeywords.join(' ') : params.sourceKeywords,
    summary.coreValue,
    Array.isArray(summary.hooks) ? summary.hooks.join(' ') : '',
    Array.isArray(summary.keyPoints) ? summary.keyPoints.join(' ') : '',
    Array.isArray(summary.dataPoints) ? summary.dataPoints.join(' ') : '',
  ].filter(Boolean).join(' ');
}

function includesAny(text, terms) {
  const haystack = String(text || '').toLowerCase();
  return terms.some((term) => haystack.includes(String(term).toLowerCase()));
}

function classifyArticleType(params = {}) {
  const explicit = String(params.sourceType || '').trim();
  if (ARTICLE_TYPES.includes(explicit)) return explicit;
  const text = sourceCombined(params);
  const rules = [
    ['정부지원금/정책', ['지원금', '정책', '복지', '신청', '청년내일', '정부', '대상자']],
    ['세금/환급/공제', ['세금', '환급', '공제', '소득세', '신고', '감면', '연말정산']],
    ['보험/금융조회', ['보험', '금융', '조회', '내보험', '보험금', '청구']],
    ['건강/의학/생활건강', ['건강', '병원', '증상', '통증', '기침', '의학', '치료', '진료']],
    ['부동산/주거/월세', ['부동산', '주거', '월세', '전세', '계약', '보증금', '임대차']],
    ['자동차/교통/세금', ['자동차', '교통', '차량', '보험료', '과태료', '운전']],
    ['블로그 수익화/자동화툴', ['블로그', '수익화', '자동화툴', '애드센스', '포스팅']],
    ['AI도구/프로그램/업무자동화', ['AI', '인공지능', '프로그램', '업무자동화', '자동화 프로그램']],
    ['연예/이슈/사건정리', ['연예', '이슈', '사건', '열애', '결별', '논란']],
    ['스포츠/경기/선수이슈', ['스포츠', '경기', '선수', '리그', '감독']],
    ['생활정보/꿀팁', ['생활', '꿀팁', '전기요금', '습관', '절약', '정리']],
    ['제품/서비스 소개', ['제품', '서비스', '소개', '후기', '가격', '기능']],
  ];
  const matched = rules.find(([, terms]) => includesAny(text, terms));
  return matched ? matched[0] : '기타';
}

function extractKeywords(params = {}, max = 8) {
  const explicit = ensureArray(params.sourceKeywords)
    .flatMap((item) => String(item || '').split(/[,/\s]+/))
    .map((item) => item.trim())
    .filter(Boolean);
  const text = stripHtml(sourceCombined(params))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && word.length <= 18)
    .filter((word) => !/^(그리고|하지만|입니다|합니다|있는|없는|위해|대한|관련|확인|정리)$/.test(word));
  return [...explicit, ...text]
    .filter((word, idx, arr) => arr.indexOf(word) === idx)
    .slice(0, max);
}

function summarizeSource(params = {}) {
  const summary = params.sourceSummary || {};
  const fromSummary = [
    summary.coreValue,
    ...(Array.isArray(summary.keyPoints) ? summary.keyPoints : []),
  ].filter(Boolean).join(' ');
  const body = stripHtml(params.sourceText || '');
  return cleanText(fromSummary || body || params.sourceTitle || '').slice(0, 320);
}

function analyzeSourceContext(params = {}) {
  const category = classifyArticleType(params);
  const keywords = extractKeywords(params, 10);
  const sourceTitle = cleanText(params.sourceTitle || '');
  const sourceUrl = cleanText(params.sourceUrl || '');
  const summary = summarizeSource(params);
  const primary = keywords[0] || sourceTitle.split(/\s+/).slice(0, 3).join(' ') || '핵심 주제';
  const sourceText = sourceCombined(params);
  const isPolicy = ['정부지원금/정책', '세금/환급/공제'].includes(category);
  const isHealth = category === '건강/의학/생활건강';
  const isIssue = category === '연예/이슈/사건정리';
  return {
    sourceTitle,
    sourceUrl,
    sourceSummary: summary,
    coreTopic: primary,
    autoCategory: category,
    primaryKeywords: keywords.slice(0, 4),
    secondaryKeywords: keywords.slice(4, 10),
    targetReader: isPolicy
      ? '조건과 예외를 확인하려는 독자'
      : isHealth
        ? '증상이나 생활 정보를 조심스럽게 확인하려는 독자'
        : isIssue
          ? '사실관계와 맥락을 빠르게 알고 싶은 독자'
          : '핵심만 빠르게 확인하려는 독자',
    readerQuestion: `${primary}에서 지금 가장 먼저 확인해야 할 부분은 무엇인가?`,
    confusingPoint: isPolicy
      ? '대상, 기준, 예외가 섞여 헷갈릴 수 있는 부분'
      : '본문에 나온 사실과 추정이 섞여 보일 수 있는 부분',
    lossPoint: '본문에서 확인 가능한 핵심 기준이나 주의점을 놓치면 다시 찾아봐야 하는 부분',
    directInfo: summary ? [summary] : [sourceTitle],
    gatedInfo: sourceUrl ? ['세부 기준과 원문 맥락은 원문에서 이어서 확인하도록 유도'] : [],
    mustKeepFacts: [sourceTitle, ...keywords.slice(0, 5)].filter(Boolean),
    doNotUse: [
      sourceText.includes('청년내일저축계좌') ? '' : '청년내일저축계좌를 기본 예시처럼 쓰지 말 것',
      '원문에 없는 금액, 기간, 대상자, 효과를 만들지 말 것',
      isHealth ? '진단이나 치료 확정처럼 표현하지 말 것' : '',
    ].filter(Boolean),
    riskyExpressions: [
      '무조건, 누구나, 100% 보장, 확정, 지금 바로 클릭 같은 단정·강요 표현',
      isPolicy ? '확정 지급처럼 보이는 표현' : '',
      isHealth ? '진단·치료·완치처럼 보이는 표현' : '',
    ].filter(Boolean),
    platformAngles: buildPlatformAngles(primary, category),
  };
}

function buildPlatformAngles(primary, category) {
  return {
    instagram: `${primary}를 저장형 체크포인트로 압축`,
    threads: `${primary}에서 독자가 공감하거나 의견을 남길 지점`,
    'naver-blog': `${primary}를 검색자가 이해할 수 있는 미니 포스팅으로 정리`,
    'naver-cafe': `${primary}를 커뮤니티 질문 또는 경험 공유처럼 전환`,
    x: `${primary}의 한 문장 문제제기`,
    facebook: `${primary}를 가족·지인에게 공유하기 쉬운 생활정보로 정리`,
    'kakao-openchat': `${primary}를 단톡방 공지처럼 짧게 안내`,
    'youtube-shorts': `${primary}를 첫 3초 훅과 30초 대본으로 변환`,
    tiktok: `${primary}를 첫 2초 훅과 빠른 컷 자막으로 변환`,
    pinterest: `${primary}를 저장 가능한 핀 제목과 이미지 문구로 변환`,
    category,
  };
}

function formatList(items) {
  const arr = ensureArray(items).filter(Boolean);
  return arr.length ? arr.map((item) => `- ${item}`).join('\n') : '- 없음';
}

function buildContextBlock(params = {}, platformId) {
  const context = analyzeSourceContext(params);
  const profile = PLATFORM_PROFILES[platformId] || { name: platformId };
  return `[공통 문맥 분석]
- 원문 제목: ${context.sourceTitle || '(제목 없음)'}
- 원문 URL: ${context.sourceUrl || '(URL 없음)'}
- 원문 핵심 요약: ${context.sourceSummary || '(본문 요약 없음)'}
- 원문 핵심 주제: ${context.coreTopic}
- 자동 분류된 글 유형: ${context.autoCategory}
- 핵심 키워드: ${context.primaryKeywords.join(', ') || '없음'}
- 보조 키워드: ${context.secondaryKeywords.join(', ') || '없음'}
- 대상 독자: ${context.targetReader}
- 독자가 가장 궁금해할 질문: ${context.readerQuestion}
- 독자가 가장 헷갈릴 부분: ${context.confusingPoint}
- 독자가 놓치면 손해라고 느낄 부분: ${context.lossPoint}
- 바로 공개해도 되는 정보:
${formatList(context.directInfo)}
- 원문으로 유도해야 할 세부 정보:
${formatList(context.gatedInfo)}
- 반드시 지켜야 할 사실:
${formatList(context.mustKeepFacts)}
- 절대 쓰면 안 되는 내용:
${formatList(context.doNotUse)}
- 과장하면 위험한 표현:
${formatList(context.riskyExpressions)}
- ${profile.name} 추천 유입각: ${context.platformAngles[platformId] || context.coreTopic}`;
}

function buildSourceInputBlock(params = {}, platformId) {
  const body = stripHtml(params.sourceText || '').slice(0, 7000);
  const keywords = Array.isArray(params.sourceKeywords)
    ? params.sourceKeywords.join(', ')
    : String(params.sourceKeywords || '');
  return `${buildContextBlock(params, platformId)}

[원문 입력]
- 제목: ${params.sourceTitle || ''}
- URL: ${params.sourceUrl || ''}
- 사전 글 유형: ${params.sourceType || '자동 분류 필요'}
- 원문 키워드: ${keywords || '없음'}
- 본문 또는 발췌:
${body || '(본문 없음. 제목, URL, 요약에서 확인 가능한 범위만 사용)'}`;
}

function buildPlatformSystemPrompt(platformId) {
  const profile = PLATFORM_PROFILES[platformId] || PLATFORM_PROFILES.instagram;
  const variants = Object.entries(profile.variants)
    .map(([key, label]) => `- ${key}안: ${label}`)
    .join('\n');
  return `당신은 ${profile.name} 외부유입 콘텐츠를 만드는 프롬프트 엔지니어입니다.

이번 작업은 같은 글을 복사 변환하는 일이 아닙니다.
원문 제목, 본문, URL, 키워드를 먼저 분석한 뒤 ${profile.name} 사용자의 소비 방식에 맞는 완전히 다른 유입 콘텐츠를 만듭니다.

[${profile.name} 역할]
- 목적: ${profile.purpose}
- 형태: ${profile.format}
- 말투: ${profile.tone}
- 금지: ${profile.avoid}

[A/B/C 구조]
${variants}

[공통 원칙]
- 특정 주제, 특히 청년내일저축계좌를 기본값처럼 하드코딩하지 않습니다.
- 지원금 전용 구조를 보험, 건강, 이슈, 자동화툴 등 다른 글에 섞지 않습니다.
- 원문에 없는 금액, 기간, 대상자, 조건, 효과를 만들지 않습니다.
- 플랫폼별 말투를 섞지 않습니다.
- 클릭을 강요하지 않습니다.
- 과장, 허위, 단정 표현을 쓰지 않습니다.
- 생성 후 스스로 비평하고 최종 개선안을 다시 작성합니다.
- finalRevision에는 사용자가 실제 플랫폼에 붙여넣을 최종 콘텐츠만 넣습니다.

[공통 금지 표현]
${formatList(COMMON_BANNED_PHRASES)}

[권장 대체 표현]
${formatList(SAFE_REPLACEMENTS)}

[공통 최종 검수 100점]
- 원문 문맥 정확도: 20점
- 플랫폼 말투와 구조 적합도: 20점
- 첫 문장 또는 첫 훅 강도: 15점
- 자연스러운 CTA: 10점
- 광고 냄새 최소화: 10점
- 원문에 없는 허위·과장 없음: 15점
- 하드코딩 흔적 없음: 10점

플랫폼별 점수 또는 공통 최종 검수 점수가 85점 미만이면 finalRevision에서 재작성합니다.
하드코딩 흔적, 원문에 없는 사실, 플랫폼 말투 혼용이 있으면 점수와 관계없이 재작성합니다.`;
}

function buildPlatformUserPrompt(platformId, params = {}, structuredInstructions = '') {
  const profile = PLATFORM_PROFILES[platformId] || PLATFORM_PROFILES.instagram;
  return `${buildSourceInputBlock(params, platformId)}

[${profile.name} 생성 지시]
1. 위 공통 문맥 분석을 기준으로 context를 채웁니다.
2. 자동 분류 결과를 반영하되, 분류명에 맞춘 고정 문장을 반복하지 않습니다.
3. ${profile.name}의 목적, 형태, 말투, 금지사항을 우선합니다.
4. A/B/C 3안을 모두 만듭니다.
5. 각 안마다 후보 10개와 점수를 만들고, 최종 후보 1개만 선택합니다.
6. 자체 비평과 공통 최종 검수 점수를 기록합니다.
7. finalRevision에는 ${profile.output}만 넣습니다.
8. finalRevision에는 점수, 후보, 선택 이유, 분석 메모, JSON 설명, 개발자용 정보를 절대 넣지 않습니다.
9. 원문 URL "${params.sourceUrl || ''}"은 플랫폼에 맞는 자연스러운 유도 문장에만 포함합니다.
10. 출력은 지정된 JSON 태그 형식만 사용합니다.

${structuredInstructions}`;
}

function buildStructuredJsonInstructions(options = {}) {
  const candidateKey = options.candidateKey || 'firstLineCandidates';
  const selectedKey = options.selectedKey || 'selectedFirstLine';
  const scoreKey = options.scoreKey || 'firstLineScore';
  const finalRevision = options.finalRevision || {
    firstLine: '최종 첫 문장',
    body: '최종 본문',
    linkPrompt: '최종 링크 유도',
  };
  const variantLabels = options.variantLabels || { A: 'A안', B: 'B안', C: 'C안' };
  const variantNotes = Object.entries(variantLabels)
    .map(([key, label]) => `- ${key}: ${label}`)
    .join('\n');
  const context = {
    sourceTitle: '원문 제목',
    sourceUrl: '원문 URL',
    autoCategory: '자동 분류된 글 유형',
    coreTopic: '원문 핵심 주제',
    targetReader: '대상 독자',
    readerSituation: '독자 상황',
    readerQuestion: '독자가 가장 궁금해할 질문',
    confusingPoint: '독자가 헷갈릴 부분',
    lossPoint: '놓치면 손해라고 느낄 부분',
    mustKeepFacts: ['원문에서 확인된 사실'],
    doNotUse: ['원문에 없어서 쓰면 안 되는 내용'],
    riskyExpressions: ['과장하면 위험한 표현'],
  };
  const example = {
    context,
    variants: [
      {
        key: 'A',
        label: variantLabels.A || 'A안',
        tone: '플랫폼에 맞춘 톤',
        goal: '이 안의 목표',
        [candidateKey]: Array.from({ length: 10 }, (_, idx) => ({
          text: `${idx + 1}번 후보`,
          score: 90 - idx,
        })),
        [selectedKey]: '선택한 최종 후보',
        [scoreKey]: 90,
        selectedReason: '선택 이유',
        critique: {
          score: 90,
          notes: '자체 비평과 개선 메모',
          breakdown: {
            platformFit: 20,
            hook: 20,
            truth: 20,
            lowAd: 20,
            action: 20,
          },
        },
        commonReview: {
          score: 90,
          notes: '공통 최종 검수 결과',
        },
        finalRevision,
      },
    ],
  };
  return `[출력 형식]
반드시 아래 XML 태그 사이에 JSON만 출력합니다.
Markdown 코드블록, 설명문, 후보 해설, 사과문은 출력하지 않습니다.

${options.jsonStart}
${JSON.stringify(example, null, 2)}
${options.jsonEnd}

[필수 규칙]
- variants는 A/B/C 3개를 모두 만듭니다.
${variantNotes}
- 각 variant의 ${candidateKey}는 반드시 10개이며 text와 score를 포함합니다.
- ${selectedKey}에는 후보 중 최종 선택한 1개만 넣습니다.
- finalRevision에는 사용자가 복사해서 바로 게시할 최종 콘텐츠만 넣습니다.
- 점수, 후보, 선택 이유, 분석 메모, critique, commonReview는 finalRevision 안에 넣지 않습니다.
- 원문에 없는 금액, 기간, 조건, 대상자, 효과를 만들지 않습니다.
- 특정 테스트 예시나 청년내일저축계좌 문맥을 기본값처럼 반복하지 않습니다.
- 플랫폼 말투가 섞이면 finalRevision에서 다시 작성합니다.
- 공통 금지 표현이나 클릭 강요 표현이 있으면 finalRevision에서 제거합니다.`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeFinalText(value) {
  let text = cleanText(value);
  for (const phrase of COMMON_BANNED_PHRASES) {
    text = text.replace(new RegExp(escapeRegExp(phrase), 'gi'), '');
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function flattenFinalRevision(variant) {
  const finalRevision = variant && variant.finalRevision || {};
  const chunks = [];
  for (const value of Object.values(finalRevision)) {
    if (Array.isArray(value)) {
      chunks.push(value.map((item) => {
        if (item && typeof item === 'object') return Object.values(item).join(' ');
        return item;
      }).join(' '));
    } else if (value && typeof value === 'object') {
      chunks.push(Object.values(value).join(' '));
    } else {
      chunks.push(value);
    }
  }
  return cleanText(chunks.filter(Boolean).join('\n'));
}

function inspectPlatformMix(platformId, text) {
  const lines = cleanText(text).split('\n').filter(Boolean);
  const violations = [];
  if (platformId === 'threads' && /(습니다|합니다|하세요|바랍니다|확인하시기 바랍니다)/.test(text)) {
    violations.push('Threads에 존댓말 공문체가 섞였습니다.');
  }
  if (platformId === 'naver-blog' && cleanText(text).length < 500) {
    violations.push('네이버 블로그 결과가 SNS 문구처럼 너무 짧습니다.');
  }
  if (platformId === 'naver-cafe' && /^(https?:\/\/|링크|블로그|원문)/i.test(lines[0] || '')) {
    violations.push('네이버 카페 글이 처음부터 링크 또는 홍보문처럼 보입니다.');
  }
  if (platformId === 'x' && cleanText(text).length > 560) {
    violations.push('X 결과가 장문 설명처럼 길어졌습니다.');
  }
  if (platformId === 'facebook' && /(ㅋㅋ|ㄹㅇ|개꿀|쩐다|너무 좋음|봤어\?|했어\?)/.test(text)) {
    violations.push('Facebook 결과에 젊은 밈 또는 반말이 섞였습니다.');
  }
  if (platformId === 'kakao-openchat' && lines.length > 8) {
    violations.push('카카오톡 오픈채팅 결과가 8줄을 넘었습니다.');
  }
  if (platformId === 'youtube-shorts' && cleanText(text).length > 800 && !/(첫 3초|멘트|자막|고정댓글|스크립트|대본|#)/.test(text)) {
    violations.push('유튜브 쇼츠 결과가 영상 대본 구조로 보이지 않습니다.');
  }
  if (platformId === 'tiktok' && cleanText(text).length > 1300) {
    violations.push('틱톡 결과가 쇼츠처럼 길고 무거워졌습니다.');
  }
  if (platformId === 'pinterest' && /(댓글|재게시|고정댓글|영상|대본)/.test(text)) {
    violations.push('핀터레스트 결과에 SNS 또는 영상 문법이 섞였습니다.');
  }
  if (platformId === 'instagram' && !/(저장|체크|카드|댓글|공유|프로필|링크|#)/.test(text)) {
    violations.push('인스타그램 결과가 저장형 카드뉴스 캡션처럼 보이지 않습니다.');
  }
  return violations;
}

function inspectHardcoding(platformId, text, context = {}) {
  const combined = [
    context.sourceTitle,
    context.sourceSummary,
    context.coreTopic,
    ...(ensureArray(context.mustKeepFacts)),
  ].join(' ');
  const violations = [];
  if (!includesAny(combined, HARD_CODED_TOPIC_TERMS) && includesAny(text, HARD_CODED_TOPIC_TERMS)) {
    violations.push('청년내일저축계좌 예시가 다른 주제에 하드코딩처럼 섞였습니다.');
  }
  const category = context.autoCategory || context.articleType || '';
  if (!/정부지원금|정책|세금|환급|공제/.test(category) && includesAny(text, GOVERNMENT_ONLY_TERMS)) {
    violations.push('지원금·신청 전용 문맥이 다른 글 유형에 섞였습니다.');
  }
  return violations;
}

function inspectSafety(text) {
  const violations = [];
  for (const phrase of COMMON_BANNED_PHRASES) {
    if (text.includes(phrase)) violations.push(`금지 표현 포함: ${phrase}`);
  }
  if (/(완치|치료됩니다|진단됩니다)/.test(text)) violations.push('건강 정보를 진단 또는 치료 확정처럼 표현했습니다.');
  if (/(수익\s*보장|월\s*\d+\s*만원\s*보장)/.test(text)) violations.push('수익 보장처럼 보이는 표현이 있습니다.');
  return violations;
}

function scoreCommonReview(platformId, text, context = {}) {
  const safety = inspectSafety(text);
  const hardcoding = inspectHardcoding(platformId, text, context);
  const platformMix = inspectPlatformMix(platformId, text);
  const violations = [...safety, ...hardcoding, ...platformMix];
  const clean = cleanText(text);
  const breakdown = {
    context: 20,
    platformFit: 20,
    hook: 15,
    cta: 10,
    lowAd: 10,
    truth: 15,
    noHardcoding: 10,
  };
  if (!clean) {
    breakdown.context = 0;
    breakdown.platformFit = 0;
  }
  if (platformMix.length) breakdown.platformFit = Math.max(0, breakdown.platformFit - 12);
  if (!clean.split('\n').find((line) => line.trim().length >= 8)) breakdown.hook = 5;
  if (!/(http|링크|원문|프로필|고정댓글|본문|자세한|정리)/.test(clean)) breakdown.cta = 7;
  if (/(클릭|방문|구매|신청)/.test(clean)) breakdown.lowAd = Math.max(0, breakdown.lowAd - 3);
  if (safety.length) breakdown.truth = Math.max(0, breakdown.truth - 10);
  if (hardcoding.length) breakdown.noHardcoding = 0;
  const score = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return {
    score,
    breakdown,
    violations,
    needsRewrite: score < 85 || violations.length > 0,
    recommended: score >= 95 && violations.length === 0,
    badge: score >= 95 && violations.length === 0 ? '추천' : score >= 90 ? '최종 개선안' : '개선 필요',
  };
}

function applyCommonReviewToResult(platformId, result) {
  if (!result || !Array.isArray(result.variants)) return result;
  const context = result.context || {};
  result.variants = result.variants.map((variant) => {
    const copy = flattenFinalRevision(variant);
    const commonReview = scoreCommonReview(platformId, copy, context);
    const currentCritique = variant.critique && typeof variant.critique === 'object'
      ? variant.critique
      : {};
    const currentScore = Number(currentCritique.score) || Number(variant.score) || commonReview.score;
    return {
      ...variant,
      commonReview,
      critique: {
        ...currentCritique,
        score: Math.min(currentScore, commonReview.score),
        commonScore: commonReview.score,
        commonBreakdown: commonReview.breakdown,
        commonViolations: commonReview.violations,
        notes: currentCritique.notes || (commonReview.needsRewrite ? '공통 최종 검수에서 개선 필요 항목이 감지되었습니다.' : '공통 최종 검수를 통과했습니다.'),
      },
      passed: commonReview.score >= 85 && !commonReview.violations.length,
      recommended: !!variant.recommended || commonReview.recommended,
      needsRewrite: commonReview.needsRewrite,
    };
  });
  return result;
}

function sanitizeFormattedOutput(formatted) {
  if (!formatted || typeof formatted !== 'object') return formatted;
  const next = { ...formatted };
  if (typeof next.body === 'string') next.body = sanitizeFinalText(next.body);
  if (Array.isArray(next.hashtags)) next.hashtags = normalizeTags(next.hashtags, 12);
  if (next.parts && typeof next.parts === 'object') {
    next.parts = Object.fromEntries(
      Object.entries(next.parts).map(([key, value]) => [
        key,
        typeof value === 'string' ? sanitizeFinalText(value) : value,
      ])
    );
  }
  return next;
}

const EXTRA_KEY_BY_PLATFORM = {
  instagram: 'instagram',
  threads: 'threads',
  'naver-blog': 'naverBlog',
  'naver-cafe': 'naverCafe',
  x: 'x',
  facebook: 'facebook',
  'kakao-openchat': 'kakaoOpenChat',
  'youtube-shorts': 'youtubeShorts',
  tiktok: 'tiktok',
  pinterest: 'pinterest',
};

function applyCommonResponseGuard(platformId, formatted, extra = {}) {
  const extraKey = EXTRA_KEY_BY_PLATFORM[platformId];
  const nextExtra = { ...extra };
  if (extraKey && nextExtra[extraKey]) {
    nextExtra[extraKey] = applyCommonReviewToResult(platformId, nextExtra[extraKey]);
  }
  const nextFormatted = sanitizeFormattedOutput(formatted);
  const flat = [
    nextFormatted && nextFormatted.body,
    nextFormatted && nextFormatted.hashtags && nextFormatted.hashtags.join(' '),
    nextFormatted && nextFormatted.parts && Object.values(nextFormatted.parts).join('\n'),
  ].filter(Boolean).join('\n');
  const context = extraKey && nextExtra[extraKey] ? nextExtra[extraKey].context : {};
  const review = scoreCommonReview(platformId, flat, context || {});
  return {
    formatted: nextFormatted,
    extra: nextExtra,
    review,
  };
}

module.exports = {
  ARTICLE_TYPES,
  COMMON_CONTEXT_FIELDS,
  COMMON_BANNED_PHRASES,
  SAFE_REPLACEMENTS,
  PLATFORM_PROFILES,
  analyzeSourceContext,
  buildContextBlock,
  buildSourceInputBlock,
  buildPlatformSystemPrompt,
  buildPlatformUserPrompt,
  buildStructuredJsonInstructions,
  sanitizeFinalText,
  scoreCommonReview,
  applyCommonReviewToResult,
  applyCommonResponseGuard,
  cleanText,
  stripHtml,
  normalizeTags,
};
