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

// v3.8.258: 공통 BANNED phrases — viral DNA 모듈에서 universal 리스트 가져와 통합
const { UNIVERSAL_BANNED_PHRASES: VIRAL_DNA_BANNED } = require('../../_shared/viral-dna');
const COMMON_BANNED_PHRASES = [
  // 기존 허위/과장
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
  // v3.8.337: v3.8.258 viral DNA 통합 때 대체 없이 사라졌던 항목 복구.
  //   '아래 링크 클릭'·'클릭하세요'로는 이 표현이 걸리지 않아 스팸성 CTA가 그대로 통과했다.
  '지금 바로 클릭',
  '아래 링크 클릭',
  '무조건 확인',
  '무조건 저장',
  '무조건 공유',
  // v3.8.258: viral DNA universal 차단어 통합 (광고티/클리셰/스팸/AI흔적)
  ...VIRAL_DNA_BANNED,
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

/**
 * v3.8.509 — disclosure(공개율) 채널 분리 + edge(2026-08 실시간 전략).
 * disclosure: 'cluster' = 본문이 원문 핵심 70~80%를 실제로 해결 (미끼 블록 대신 클러스터 블록)
 *             'teaser'  = 정보를 숨겨 클릭을 만드는 미끼 전략 유지
 * edge: 그 채널만의 2026-08 승부처 — 채널마다 서로 달라야 한다 (전부 같으면 차별화 실패).
 */
const PLATFORM_PROFILES = {
  instagram: {
    name: '인스타그램',
    purpose: '스크롤 멈춤, 저장, DM 공유, 댓글, 프로필 또는 링크 확인',
    format: '저장형 카드뉴스 캡션',
    tone: '짧고 정돈된 정보형 존댓말',
    avoid: '장문 설명, 링크 강요, 광고문',
    variants: { A: '저장형', B: '공감형', C: '경고형' },
    output: '첫 줄, 본문, 저장 유도, 공유 유도, 댓글 유도, 링크 유도, 해시태그 3~5개',
    disclosure: 'cluster',
    edge: '2026 도달 순위: DM 공유 > 저장 > 시청시간 > 프로필 클릭 — 좋아요는 후순위다. "친구에게 DM으로 보내고 싶은 한 장 + 저장해두고 싶은 캡션"으로 설계하고, 캡션 첫 줄에 핵심 키워드를 박는다. 해시태그는 3~5개만 (8개 이상은 스팸 신호).',
  },
  threads: {
    name: 'Threads',
    purpose: '댓글, 공감, 재게시',
    format: '반말 대화체 글',
    tone: '자연스러운 반말',
    avoid: '존댓말 공문체, 블로그식 정보글, 광고문',
    variants: { A: '공감형', B: '논쟁형', C: '정보 티저형' },
    /**
     * v3.8.504: "해시태그 최대 3개" 삭제 — 모듈 금지 규칙과 정면충돌하고 있었다.
     * 스레드는 해시태그 나열 문화가 없다. 주제 태그 1개만 다는 방식이고,
     * #을 여러 개 붙이면 그 자체가 광고 신호로 읽힌다.
     */
    output: '첫 줄, 본문, 댓글 유도, 재게시 유도, 링크 유도 (해시태그 금지 — 필요하면 주제 태그 1개만)',
    disclosure: 'teaser',
    edge: '본문 링크는 도달을 깎는다 — 링크는 첫 댓글에. 이미지 1장 첨부 시 도달 +60%. 본문에는 원문에서 꺼낸 실명 사실 1~2개를 박아 "클릭할 이유"를 만든다 (제목 재탕 불인정).',
  },
  'naver-blog': {
    name: '네이버 블로그',
    purpose: '검색 유입 (SEO), 키워드 노출, 원문 신뢰 이동',
    /**
     * v3.8.504: 검색형 채널 표식. 공용 viral 훅(충격 첫줄 45점)을 이 채널엔 넣지 않는다.
     * 검색 유입 글에 낚시 첫줄을 달면 체류시간이 무너지고 C-Rank 에 독이다 —
     * 프로필 스스로 "검색자에게 답하는 정보 전달자"라면서 훅 블록이 반대를 시키고 있었다.
     */
    searchIntent: true,
    format: '1,200~1,700자 SEO 포스팅 — 소제목(H2/H3) 2~3개 + 표 또는 리스트 1개 이상 + 키워드 자연 배치',
    tone: '검색자에게 답하는 정보 전달자 (정중한 존댓말, 정리하는 톤)',
    avoid: '반말, SNS 짧은 문구, 키워드 무리 나열, 댓글 유도 X (검색 결과 클릭이 목표), 일기형 도입부',
    variants: { A: '검색 정리형 (Q&A)', B: '단계별 안내형', C: '체크리스트/표 정리형' },
    output: '제목, 소제목 2~3개, 본문, 해시태그 (댓글 유도 최소화)',
    distinctNote: '★ Blog와 Cafe는 다릅니다. Blog = 검색자에게 정리해주는 정보 글. Cafe = 회원끼리 경험 공유.',
    disclosure: 'cluster',
    edge: '하이퍼클로바X 검색 시대 — 체류 2분 30초를 못 넘기는 얇은 글은 노출 자체가 안 된다. 첫 문단에 검색 질문의 결론부터 말하고, 소제목 구조와 표·리스트로 스캔 가독성을 만든다. 키워드 반복 채우기는 저품질 신호다.',
  },
  'naver-cafe': {
    name: '네이버 카페',
    purpose: '회원 댓글 유도, 광고 거부감 최소화, 자연스러운 정보 공유',
    format: '600~900자 커뮤니티 경험공유 — 일기처럼 자연스러운 흐름이되 정보는 실하게',
    tone: '같은 회원에게 말하듯 친근한 존댓말 (정보 정리 X, 경험 공유 O)',
    avoid: '처음부터 링크, 블로그식 정리 톤, 판매글 느낌, 소제목/표 구조 (X)',
    variants: { A: '질문형 (도와주세요)', B: '본인 경험 공유형', C: '발견 공유형 (얼마 전에 알게 됐는데)' },
    output: '제목 (의문문/감탄문), 본문, 댓글 유도 (필수), 자연스러운 링크',
    distinctNote: '★ Cafe는 Blog와 다릅니다. 정리해주는 톤 X, 같은 회원으로서 묻거나 공유하는 톤 O. 댓글이 핵심 KPI.',
    disclosure: 'cluster',
    edge: '2026년 7월부터 네이버가 광고 카페 퇴출 강경 모드 — cliffhanger·"정리해뒀어요" 유도 패턴이 곧 위장광고 신호로 즉삭·제재된다. 진짜 회원의 경험담처럼 정보를 실하게 풀고, 링크는 끝에 출처 인용으로 1번만.',
  },
  x: {
    name: 'X',
    purpose: '첫 문장 멈춤, 답글, 리포스트, 링크 확인',
    /**
     * v3.8.504: "280자"만 말하면 모델이 한글 280자를 만든다.
     * X 는 한글·한자를 글자당 2로 세므로 실제 한도는 한글 기준 약 140자다 —
     * 넘긴 글은 붙여넣을 때 잘리고, 사용자는 이유를 모른다.
     */
    format: '한글 기준 140자 이내(X는 한글을 글자당 2로 계산, 영문 혼용 시 총 280 무게)의 짧고 날카로운 티저',
    tone: '짧은 단정형 또는 문제제기형',
    avoid: '장문 설명, 해시태그 남발, 블로그 요약문',
    variants: { A: '링크 없는 티저형', B: '링크 포함 클릭형', C: '답글 유도형' },
    output: '첫 문장, 본문, 답글 유도, 리포스트 유도, 링크 유도, 해시태그 최대 2개',
    disclosure: 'teaser',
    edge: '본문 링크는 도달 50~90% 하락 (비프리미엄은 사실상 0) — 링크는 반드시 답글(tweet2)로. 작성자 답글은 좋아요의 150배 가중이라 답글이 달리는 질문형 마무리로 쓰고, 게시 후 첫 30분이 승부처다.',
  },
  facebook: {
    name: 'Facebook',
    purpose: '공유, 공감, 댓글, 링크 확인',
    format: '생활정보 공유형 글 (500~900자, 본문 무링크)',
    tone: '중장년층도 읽기 편한 차분한 존댓말',
    avoid: '반말, 젊은 밈, 과한 이모지, 짧은 광고문, 본문 안 링크',
    variants: { A: '생활정보 공유형', B: '가족·지인 공유형', C: '주의사항 정리형' },
    output: '첫 문장, 본문, 공유 유도, 댓글 유도, 링크 유도 (첫 댓글에 붙일 한 줄), 해시태그 최대 5개',
    disclosure: 'cluster',
    edge: '링크 포스트는 도달 70~80% 하락, 비인증 페이지는 월 2회 링크 제한까지 테스트 중 — 본문은 링크 없이 완결된 생활정보로 쓰고, 링크 유도 문장은 첫 댓글에 붙일 한 줄로 만든다. "가족에게 알려주고 싶은 정보"가 공유 도달의 엔진이다.',
  },
  'kakao-openchat': {
    name: '카카오톡 오픈채팅',
    purpose: '부담 없이 읽힘, 필요한 사람만 확인, 링크 확인',
    format: '5줄에서 8줄 단톡방 공지형 글',
    tone: '짧고 친근한 존댓말',
    avoid: '장문, 도배 느낌, 해시태그, 클릭 강요',
    variants: { A: '짧은 공지형', B: '친근한 공유형', C: '긴급 체크형' },
    output: '첫 문장, 본문, 답장 유도, 링크 유도',
    disclosure: 'cluster',
    edge: '오픈채팅은 도달 알고리즘이 없다 — 방 전원에게 그대로 보인다. 낚시가 필요 없고 역효과만 난다. 이 방 사람들에게 왜 유용한지 한 줄 + 요점 요약 + 링크. 도배 느낌이 나면 강퇴가 리스크의 전부다.',
  },
  'kakao-channel': {
    name: '카카오톡 채널',
    purpose: '친구 추가 구독자에게 푸시 알림, 더보기 버튼 클릭, 외부 URL 유입',
    format: '카드 게시물 (헤드라인 30~40자 + 본문 150~250자 + 더보기 버튼 5~10자)',
    tone: '존댓말 + 짧고 강한 후크형',
    avoid: '여러분 단체 인사, 광고 표현(100% 보장/무조건/바로 클릭), 본문 200자 초과, 헤드라인 40자 초과',
    variants: {
      A: '충격수치형 (헤드라인에 충격 수치 + 본문 짧은 시나리오)',
      B: '자기의심형 (헤드라인에 "나만 몰랐다" 톤 + 본문 비교)',
      C: '손실회피형 (헤드라인에 "이거 안 하면 손해" + 본문 구체 손실액)',
    },
    output: '헤드라인, 본문, 버튼라벨, URL',
    disclosure: 'teaser',
    edge: '내 채널을 친구 추가한 구독자에게 가는 푸시다 — 낚시보다 명확한 혜택 제시가 신뢰를 지킨다. 단, 본문에서 다 풀면 더보기를 안 누른다: "나도 해당되나?" 미해결 질문 1개를 남겨 더보기 클릭을 만든다.',
  },
  'youtube-shorts': {
    name: '유튜브 쇼츠',
    purpose: '첫 3초 시청 유지, 완시율, 고정댓글 이동',
    format: '30초에서 45초 영상 대본',
    tone: '말로 들었을 때 자연스러운 구어체',
    avoid: '블로그 요약문, 긴 문장, 고정댓글 클릭 강요',
    variants: { A: '정보 압축형', B: '경고·주의형', C: '공감·댓글형' },
    output: '영상 제목, 첫 3초 멘트, 본문 스크립트, 화면 자막, 댓글 유도, 고정댓글, 설명란, 해시태그',
    disclosure: 'cluster',
    edge: '완주율 60% 이상이 기본, 80%면 알고리즘이 공격 배포 — 첫 3초에 결론을 선공개하고 핵심 3개를 리듬감 있게, 마지막 문장이 첫 문장으로 되감기는 루프 구조로 재시청을 만든다. 링크는 고정댓글로.',
  },
  tiktok: {
    name: '틱톡',
    purpose: '첫 2초 시청 유지, 댓글, 저장, 완시율',
    format: '20초에서 35초 빠른 컷 전환형 대본',
    tone: '빠르고 가벼운 구어체',
    avoid: '딱딱한 설명문, 쇼츠 대본 복붙, 긴 자막',
    variants: { A: '빠른 정보형', B: '공감·댓글형', C: '경고·실수형' },
    output: '영상 제목, 첫 2초 멘트, 본문 스크립트, 컷 전환 자막, 댓글 유도, 저장 유도, 프로필 또는 링크 유도, 해시태그',
    disclosure: 'cluster',
    edge: '시청 유지율과 재시청이 2026 핵심 신호 — 2~3초마다 컷 전환하고, 한 번에 안 잡히는 디테일 1개를 심어 재시청을 유발한다. 쇼츠 대본 복붙 금지 — 틱톡은 더 빠르고 가볍게 간다.',
  },
  pinterest: {
    name: '핀터레스트',
    purpose: '저장, 이미지 클릭, 블로그 유입',
    format: '검색형 핀 제목, 설명, 이미지 문구',
    tone: '짧고 실용적인 검색형 문장',
    avoid: '대화체, 영상 대본, 긴 홍보문, 클릭 강요',
    variants: { A: '검색 정리형', B: '저장 체크리스트형', C: '이미지 클릭형' },
    output: '핀 제목, 핀 설명, 이미지 문구, 이미지 디자인 방향, 블로그 유도 문장, 키워드 태그',
    disclosure: 'cluster',
    edge: '핀 자체가 외부 직링크다 — 티저·낚시 문구가 구조적으로 무의미하다. 검색 키워드가 풍부한 실속 설명이 저장과 클릭을 동시에 만든다. 핀 제목에 검색어, 설명에 결론과 수치를 넣는다.',
  },
  'local-board': {
    name: '지역 자유게시판',
    purpose: '지역 주민 공감, 댓글, 자연스러운 정보 공유, 링크 확인 (광고 거부감 최소화)',
    format: '실제 동네 주민이 쓴 듯한 200~400자 짧은 게시글',
    tone: '존댓말 + 약간의 사투리/지역색 + 일상 톤 (전혀 광고 같지 않게)',
    avoid: '블로그 요약문, 판매글 느낌, 첫 줄 링크, 해시태그 남발, 외래어/전문용어, "여러분"',
    variants: {
      A: '동네 질문형 (이거 어떻게 하시나요?)',
      B: '경험 공유형 (어제 진짜 이런 일이…)',
      C: '정보 공유형 (혹시 이거 아세요?)'
    },
    output: '제목, 본문, 댓글 유도, 자연스러운 링크 유도',
    disclosure: 'cluster',
    edge: '광고에 지친 이용자들이 2026년 지역 커뮤니티로 이동 중 — 기회 채널이다. 그래서 광고 티에 가장 민감하다: 실제 주민의 말투로 진짜 도움 정보 1개를 먼저 주고, 링크는 "혹시 도움 되실까 해서" 톤으로 1번만.',
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

/**
 * v3.8.504 — 검색형 채널(searchIntent)은 낚시 훅 구간을 걷어낸다.
 *
 * 공용 템플릿은 20개 채널이 함께 쓰므로 본문을 건드리지 않고,
 * 만들어진 문자열에서 해당 구간만 잘라내고 검색형 규칙으로 바꿔 넣는다.
 * 잘라낼 구간을 못 찾으면(템플릿이 바뀌면) 아무것도 안 자른다 —
 * 조용히 엉뚱한 데를 자르는 것보다 낫다. 하네스가 그 경우를 잡는다.
 */
const SEARCH_HOOK_BLOCK = `[검색형 첫 문장 규칙 — 낚시 금지]
이 채널은 스크롤 피드가 아니라 **검색 결과**에서 읽힌다. 충격·경악·FOMO 훅을 쓰지 않는다.
- 첫 문장 = 검색 질문에 대한 결론. 핵심 키워드를 자연스럽게 포함해 결론부터 말한다.
- "나만 몰랐" / "충격" / "경악" / 구체 인물 미끼 첫줄 금지 — 검색 유입 글의 낚시 첫줄은
  이탈률을 올리고 채널 품질 점수를 깎는다.
- 점수 기준(100점): 검색 의도 적합(키워드 포함 결론형 첫 문장) 40점 /
  소제목 구조·가독성 20점 / 원문을 눌러야 할 이유 만들기 20점 / 정중한 정보 톤 유지 20점
- 85점 미만이면 finalRevision에서 재작성한다.
`;

function stripBetween(text, startMarker, endMarker, replacement) {
  const start = text.indexOf(startMarker);
  if (start < 0) return text;
  const end = text.indexOf(endMarker, start);
  if (end < 0) return text;
  return text.slice(0, start) + replacement + text.slice(end);
}

function buildPlatformSystemPrompt(platformId) {
  const profile = PLATFORM_PROFILES[platformId] || PLATFORM_PROFILES.instagram;
  const variants = Object.entries(profile.variants)
    .map(([key, label]) => `- ${key}안: ${label}`)
    .join('\n');
  // v3.8.258: viral DNA 블록 자동 주입 — v3.8.504: 검색형 채널은 제외
  const { buildViralDnaBlock } = require('../../_shared/viral-dna');
  const viralDnaBlock = profile.searchIntent
    ? ''
    : buildViralDnaBlock({ platformName: profile.name, requireAllPatternsDistinct: true });
  return `당신은 ${profile.name} 외부유입 콘텐츠를 만드는 프롬프트 엔지니어입니다.

이번 작업은 같은 글을 복사 변환하는 일이 아닙니다.
원문 제목, 본문, URL, 키워드를 먼저 분석한 뒤 ${profile.name} 사용자의 소비 방식에 맞는 **손가락이 멈추는 viral 콘텐츠**를 만듭니다.

[${profile.name} 역할]
- 목적: ${profile.purpose}
- 형태: ${profile.format}
- 말투: ${profile.tone}
- 금지: ${profile.avoid}
${profile.distinctNote ? `\n[채널 차별화 ★ 필수]\n${profile.distinctNote}\n` : ''}
${profile.edge ? `\n[2026-08 실시간 전략 ★ 이 채널의 승부처 — 다른 채널과 겹치면 실패]\n${profile.edge}\n` : ''}
[A/B/C 구조]
${variants}
${viralDnaBlock}
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

[공통 최종 검수 100점 — v3.8.258 viral 가중]
- 첫 문장/첫 훅 강도 (**스크롤 멈추는 힘**): 45점 ★ 최우선 (35→45)
- viral 패턴 적용도 (5패턴 중 1개 확실히 적용): 15점 ★ 신규
- 원문 문맥 정확도: 10점
- 플랫폼 말투와 구조 적합도: 10점
- 자연스러운 CTA (광고티 0): 10점
- 원문에 없는 허위·과장 없음: 5점
- 클리셰/광고 클리셰 부재: 5점 ★ 신규
- viralStrength 70점 미만이면 자동 재작성 트리거

[🔥 첫 줄 절대 규칙 — 스크롤을 멈추게 하는 힘]

❌ 0점 첫 줄 (절대 금지 — 점수가 아니라 자동 재작성):
- 일반 질문: "~ 아세요?", "~ 꿈만 같지 않나요?", "~ 어떻게 생각하세요?"
- 흔한 정보 진술: "정부가 지원해줍니다", "월 N만원으로 N만원 모을 수 있습니다"
- 평이한 소개: "오늘은 ~에 대해", "안녕하세요 ~ 입니다"
- 광고 티: "놓치면 손해", "지금 바로", "100% 보장"
- 시작 인사: "여러분", "오늘은", "안녕"
- 누구나 아는 사실 (조금만 검색해도 나오는 평범한 내용)

✅ 100점 첫 줄 패턴 (반드시 하나 선택 — "경악스럽거나 신선하거나 누를 수밖에 없는 힘"):

  **패턴 1 — 충격 인물 + 구체 수치 + 짧음 (15~25자)**
  예: "28살 직장인 A씨, 12개월 통장에 1,440만원 꽂혔다."
  예: "중소기업 다니는 친구, 매달 정부에서 30만원씩 받고 있다."

  **패턴 2 — 자기 의심 + FOMO (모두가 하는데 나만?)**
  예: "친구들 카톡방 절반이 이미 신청. 나만 몰랐다."
  예: "옆자리 동기 통장에만 매달 30만원 더 들어온다."

  **패턴 3 — 통념 박살 (상식 정면 반박)**
  예: "적금 금리 4%? 의미 없다. 진짜는 정부 매칭 300%다."
  예: "월급 적은 게 오히려 유리한 적금이 있다."

  **패턴 4 — 비밀/은밀 강조 (10명 중 9명이 모름)**
  예: "은행원도 잘 안 알려주는 정부 적금."
  예: "공무원만 받는 줄 알았다. 사실 다 받을 수 있다."

  **패턴 5 — 부정 가정/손실 회피 (안 하면 진짜 손해)**
  예: "청년인데 이거 안 한 거? 3년 동안 1,200만원 손해."
  예: "이거 모르고 일반 적금 든 사람 = 매년 400만원 버린 셈."

  **패턴 6 — 모순/반전 (예상 뒤집기)**
  예: "월 10만원 넣었는데 통장에 1,440만원 찍혔다."
  예: "적금이 아니라 정부 보조금에 가깝다."

  **패턴 7 — 짧고 강한 단언 (~한다, ~없다)**
  예: "이 적금 안 들면 청년 자격 낭비다."
  예: "재테크 안 해도 된다. 이 적금 하나면 끝."

[첫 줄 작성 7원칙]
1. **30자 이내** (모바일 한 줄에 잡혀야 스크롤 멈춤)
2. **구체적 수치 1개 이상** (1,440만원, 3년, 12개월 등)
3. **첫 단어가 강해야** (숫자, 인물, 충격 명사로 시작)
4. **"여러분/오늘은/안녕" 절대 금지**
5. **마침표·물음표·느낌표로 완결** (인용 가능한 구조)
6. **누구나 아는 정보 금지** ("정부 지원금이다" 같은 평범한 사실)
7. **읽고 "어? 진짜?" 또는 "나만 몰랐나?"가 자동으로 나와야 통과**

[점수 자가 측정 가이드 — 첫 줄 35점]
- 0~10점: 평범한 질문/진술 (재작성 필수)
- 11~20점: 정보 있지만 충격/신선도 부족 (재작성 권장)
- 21~28점: 한 가지 요소 (수치 OR 의심 OR 비밀) (수정 필요)
- 29~35점: 2가지+ 요소 결합 + 30자 이내 + 첫 단어 강함 (통과)

플랫폼별 점수 또는 공통 최종 검수 점수가 85점 미만이면 finalRevision에서 재작성합니다.
첫 줄 점수가 29점 미만이면 다른 모든 점수와 무관하게 자동 재작성합니다.
하드코딩 흔적, 원문에 없는 사실, 플랫폼 말투 혼용이 있으면 점수와 관계없이 재작성합니다.

[🎣 미끼·티저 전략 — 정보를 다 풀지 마라 (절대 규칙)]

본문에서 핵심 답을 다 풀어버리면 독자는 링크를 누를 이유가 사라집니다.
**클릭은 "찝찝함"에서 나옵니다.** "나도 해당되나?", "그래서 얼마인데?", "어떻게 신청하지?"라는 미해결 질문을 본문 끝에 반드시 남겨야 합니다.

✅ 본문에 풀어줄 정보 (directInfo — 호기심 자극용):
- 누가 받는지 대략 (예: "20~34세 청년", "월급 적은 사람")
- 얼마 정도인지 충격 수치 (예: "통장에 1,440만원")
- 왜 지금이 중요한지 한 줄 (예: "올해부터 조건 완화됨")
- 글쓴이의 한 줄 반응 (예: "찾아보다가 진짜 깜짝 놀랐어요")

❌ 본문에서 절대 풀면 안 되는 정보 (gatedInfo — 링크에서만 확인 가능):
- 정확한 신청 조건/자격 기준
- 단계별 신청 방법
- 필요 서류, 신청 사이트 URL
- 받는 정확한 금액/기간 계산
- 예외 사항, 주의점, 거절 사유
- "내 케이스에 해당되는지" 판단 기준 ← 가장 강력한 미끼

✅ 본문 끝 cliffhanger 패턴 (반드시 1개 사용):
- "조건이 좀 까다로워서 본인 케이스가 해당되는지는 직접 확인하셔야 해요."
- "신청 방법이 생각보다 까다로워서 정리해두신 분 글 참고했어요."
- "저는 다 정리해뒀는데 워낙 길어서 일단 링크만 남겨둘게요."
- "혹시 본인이 해당되는지 궁금하시면 자가진단표가 있어요."
- "정확한 금액은 케이스마다 다르니까 한 번 확인해보세요."
- "이 부분이 좀 헷갈리는데 정리된 글이 있어서 같이 봤어요."

✅ 본문 길이 룰 (티저형 채널 상한 — 이보다 짧을수록 미끼 강도↑):
- Threads/X: 280~500자 (1스크롤 안에)
- 카카오톡 채널 카드: 헤드라인 30~40자 + 본문 150~250자

[미끼 자가 검수 — 통과 못 하면 finalRevision 재작성]
1. 본문만 읽고 독자가 모든 답을 얻을 수 있는가? → YES면 실패 (정보 다 풀림)
2. 본문 마지막 1~2줄이 "나도 해당되나?" 의문을 만드는가? → NO면 실패
3. 본문이 상한 글자수를 넘는가? → YES면 실패 (압축 필수)
4. 링크를 가린 채 본문을 읽었을 때 "더 알고 싶다"가 자동으로 나오는가? → NO면 실패
5. CTA가 "혹시 도움 되실까", "정리한 글 있어요" 같은 자연스러운 어조인가? → NO면 실패

[⚠️ 출력 우선순위 — 토큰 절약 절대 규칙]
finalRevision은 모든 검토 필드(critique, breakdown, candidates 10개 등)보다 우선입니다.
출력이 길어질 것 같으면 candidates를 3~5개로 줄이고 critique.breakdown을 생략해서라도 반드시 A/B/C 모두 finalRevision을 끝까지 완성하세요.
context와 variants 검토 필드만 출력하고 finalRevision을 빠뜨리면 사용자가 글을 받지 못합니다.`;
}

/**
 * v3.8.509 — 클러스터 블록. 2026-08 실시간 조사 근거:
 * 네이버 블로그(하이퍼클로바X·체류 2분30초+), 네이버 카페(광고 카페 퇴출 강경),
 * 인스타(DM공유>저장>시청>프로필), 페북(링크 도달 -70~80%), 쇼츠·틱톡(완주율 60~80%).
 * 이 채널들에서 "정보를 숨기는 미끼"는 유입이 아니라 제재·무노출을 만든다 —
 * 본문이 원문 핵심의 70~80%를 실제로 해결해야 알고리즘과 독자가 링크를 밀어준다.
 */
const CLUSTER_BLOCK = `[📚 클러스터 전략 — 본문이 스스로 가치를 증명해야 한다 (절대 규칙)]
이 채널은 얇은 미끼글이 통하지 않는다. 알고리즘(체류시간·저장·완주율)과 운영정책(광고글 제재)이
본문 자체의 가치를 요구한다. 원문 핵심의 70~80%를 본문에서 실제로 해결해준다.

✅ 본문에 반드시 공개 (이게 저장·체류·신뢰를 만든다):
- 핵심 결론과 근거 수치 — 원문의 실명 사실(금액·기간·조건·기준)을 그대로 쓴다
- 대상 판별 기준의 뼈대 (누가 해당되고 누가 아닌지)
- 가장 중요한 주의점 1~2개

🔗 원문으로만 남기는 20~30% (링크 유도는 정확히 여기서만):
- 전체 체크리스트·표·계산 예시 전문
- 케이스별 예외 상황 전체 목록
- 서식·신청 화면 등 본문에 다 못 싣는 자료

✅ 링크 유도 규칙: "다 정리해뒀어요", "링크 확인 필수" 같은 광고 패턴 금지.
"케이스별 예외까지는 여기 다 못 실어서, 표로 정리된 원문을 남겨둔다"처럼
본문이 이미 준 가치의 연장선으로만 잇는다.

✅ 본문 길이 룰 (클러스터형):
- 네이버 블로그: 1,200~1,700자 + 소제목 2~3개 + 표/리스트 1개 이상 (체류 2분 30초 목표)
- 네이버 카페: 600~900자 경험담체 (정리 톤 금지, 경험의 흐름 속에 사실 배치)
- 인스타 캡션: 500~800자 저장형 정리 + 해시태그 3~5개
- 페이스북: 500~900자, 본문 무링크 (링크는 첫 댓글 문장으로)
- 지역 자유게시판: 250~450자 주민 톤
- 쇼츠·틱톡 대본: 완주 설계 — 첫 훅에서 결론 선공개, 핵심 3개, 마지막 문장이 처음과 루프
- 핀터레스트: 검색형 설명 300~500자 (핀 자체가 링크 — 티저 문구 무의미)
- 오픈채팅: 5~8줄 요약 (전원 수신 — 낚시 불필요, 바로 요점)

[클러스터 자가 검수 — 통과 못 하면 finalRevision 재작성]
1. 링크를 가린 채 본문만 읽어도 독자가 핵심 답 3가지를 얻는가? → NO면 실패 (미끼글)
2. 본문에 원문 발췌 실명 사실(수치·기한·조건)이 3개 이상 있는가? → NO면 실패
3. "클릭", "확인 필수", "링크 참고" 같은 광고 냄새 유도 문구가 있는가? → YES면 실패
4. 이 글이 해당 플랫폼 원주민의 글로 보이는가? → NO면 실패
`;

/** 검색형·클러스터형 최종 가공 — buildPlatformSystemPrompt 밖에서 호출부가 감쌀 필요 없게 여기서 끝낸다 */
const _origBuildPlatformSystemPrompt = buildPlatformSystemPrompt;
buildPlatformSystemPrompt = function (platformId) {
  const profile = PLATFORM_PROFILES[platformId] || PLATFORM_PROFILES.instagram;
  let prompt = _origBuildPlatformSystemPrompt(platformId);
  if (profile.searchIntent) {
    prompt = stripBetween(
      prompt,
      '[공통 최종 검수 100점',
      '[🎣 미끼·티저 전략',
      SEARCH_HOOK_BLOCK + '\n',
    );
  }
  // v3.8.509: 클러스터형 채널은 미끼 블록(정보 숨김)을 클러스터 블록(실속 공개)으로 교체.
  // 못 찾으면 아무것도 안 자른다 — 조용히 엉뚱한 데를 자르는 것보다 낫다. 하네스가 잡는다.
  if (profile.disclosure === 'cluster') {
    prompt = stripBetween(
      prompt,
      '[🎣 미끼·티저 전략',
      '[⚠️ 출력 우선순위',
      CLUSTER_BLOCK + '\n',
    );
  }
  return prompt;
};

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

/**
 * @param {object} [options]
 * @param {string} [options.safetyText] 금지 표현 검사에만 쓸 텍스트.
 *   해시태그는 sanitize 대상이 아니라(그대로 발행됨) 검사에 넣으면 스스로 고칠 수 없는 위반이 되고,
 *   그 위반이 재생성 루프(main.ts의 lengthViolations 재시도)를 돌려 비용만 태운다.
 *   그래서 본문만 넘겨 검사하고, 나머지 점수 항목은 해시태그를 포함한 전체 텍스트로 매긴다.
 */
function scoreCommonReview(platformId, text, context = {}, options = {}) {
  const safety = inspectSafety(typeof options.safetyText === 'string' ? options.safetyText : text);
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
  // 금지 표현 검사는 본문/파트만 — 해시태그(#꿀팁 등)는 sanitize가 건드리지 않으므로 위반으로 잡으면 안 된다
  const bodyOnly = [
    nextFormatted && nextFormatted.body,
    nextFormatted && nextFormatted.parts && Object.values(nextFormatted.parts).join('\n'),
  ].filter(Boolean).join('\n');
  const context = extraKey && nextExtra[extraKey] ? nextExtra[extraKey].context : {};
  const review = scoreCommonReview(platformId, flat, context || {}, { safetyText: bodyOnly });
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
