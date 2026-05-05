/**
 * 검색 의도 분류기 — 키워드 휴리스틱 기반
 *
 * AI 호출 없이 키워드 패턴만으로 정보형/탐색형/거래형을 판정.
 * 의도에 맞는 H2 아키타입 세트를 반환하여 모드별 글 구조를 차별화.
 *
 * 🔥 YMYL (Your Money Your Life) 카테고리 추가: 고CPC 키워드 감지 시
 *    E-E-A-T 강화 프롬프트를 주입해 AdSense 수익을 극대화한다.
 */

export type SearchIntent = 'informational' | 'investigational' | 'transactional';

/** YMYL 카테고리 — 고CPC + 규제/면책 필요 */
export type YmylCategory =
  | 'finance'     // 금융 — 최고 CPC (5,000~15,000원)
  | 'insurance'   // 보험 — 최고 CPC (5,000~20,000원)
  | 'medical'     // 의료/건강 — 고CPC (2,000~8,000원) + 면책 강제
  | 'legal'       // 법률 — 고CPC (3,000~10,000원) + 면책 강제
  | 'realestate'  // 부동산 — 고CPC (2,000~8,000원)
  | 'tax'         // 세금 — 고CPC (2,000~6,000원)
  | 'career'      // 자격증/취업 — 중CPC (800~3,000원)
  | null;         // YMYL 아님

interface IntentRule {
  intent: SearchIntent;
  patterns: RegExp[];
  weight: number;
}

interface YmylRule {
  category: NonNullable<YmylCategory>;
  patterns: RegExp[];
  weight: number;
  /** 예상 CPC 구간 (원) */
  cpcRange: [number, number];
}

// ═══════════════════════════════════════════════════════
// 🏦 YMYL 패턴 — 한국 시장 특화 키워드
// ═══════════════════════════════════════════════════════
const YMYL_RULES: YmylRule[] = [
  {
    category: 'finance',
    patterns: [
      /(주식|주가|증권|코스피|코스닥|나스닥|다우|상장|배당|공모주|ipo)/i,
      /(펀드|etf|리츠|reit|채권|파생|선물|옵션)/i,
      /(대출|담보대출|신용대출|전세대출|주담대|주택담보|마이너스통장|사채)/i,
      /(예금|적금|정기예금|자유적금|isa|파킹통장|cma)/i,
      /(투자|재테크|자산관리|포트폴리오|자산운용)/i,
      /(연금|퇴직연금|국민연금|개인연금|연금저축|irp|노후)/i,
      /(금리|이자|기준금리|고정금리|변동금리|cd금리)/i,
      /(신용점수|신용등급|신용카드|체크카드|리볼빙|할부)/i,
      /(환율|외환|달러|엔화|유로|환전)/i,
      /(가상화폐|코인|비트코인|이더리움|암호화폐|블록체인 투자)/i,
    ],
    weight: 5,
    cpcRange: [5000, 15000],
  },
  {
    category: 'insurance',
    patterns: [
      /(보험|실비|실손|암보험|종신보험|정기보험|변액보험|연금보험)/i,
      /(자동차보험|다이렉트보험|운전자보험|여행자보험)/i,
      /(태아보험|어린이보험|치아보험|간병보험)/i,
      /(보장|특약|납입|보험료|해지환급금|청구)/i,
      /(손해보험|생명보험|화재보험|배상책임)/i,
    ],
    weight: 5,
    cpcRange: [5000, 20000],
  },
  {
    category: 'medical',
    patterns: [
      /(증상|통증|진단|치료|수술|처방|약|복용)/i,
      /(질환|질병|암|당뇨|고혈압|고지혈증|갑상선|관절염|디스크)/i,
      /(비만|다이어트|건강검진|건강식품|영양제|비타민|프로바이오틱스)/i,
      /(우울증|불안장애|공황장애|수면장애|불면증|adhd)/i,
      /(임신|출산|산후|불임|난임|시험관|산부인과)/i,
      /(치과|임플란트|교정|스케일링|충치|치주염|크라운)/i,
      /(탈모|모발이식|두피|피부과|여드름|주름|보톡스|필러)/i,
      /(정형외과|신경외과|한의원|한방|침|뜸)/i,
      /(코로나|독감|감기|폐렴|백신|접종)/i,
    ],
    weight: 4,
    cpcRange: [2000, 8000],
  },
  {
    category: 'legal',
    patterns: [
      /(변호사|법무|소송|재판|고소|고발|합의|조정)/i,
      /(이혼|양육권|재산분할|위자료|친권)/i,
      /(상속|증여|유언|유류분|상속세|증여세)/i,
      // 임대차는 "분쟁/소송/명도/계약해지" 같은 법적 맥락일 때만 legal로 분류
      /(임대차\s*분쟁|명도\s*소송|임대차\s*계약\s*해지|전세\s*사기|보증금\s*반환\s*소송)/i,
      /(손해배상|위자료|과실|책임|불법행위)/i,
      /(형사|민사|행정|헌법소원|가처분)/i,
      /(파산|회생|면책|개인회생|워크아웃)/i,
      /(노동법|부당해고|퇴직금|임금체불|산재)/i,
    ],
    weight: 4,
    cpcRange: [3000, 10000],
  },
  {
    category: 'realestate',
    patterns: [
      /(아파트|빌라|오피스텔|주택|단독주택|다세대|원룸|투룸)/i,
      /(분양|청약|재개발|재건축|입주|전매)/i,
      /(매매|전세|월세|전월세|반전세|임대|보증금|전세금|월세\s*보증금)/i,
      /(등기|등기부|권리|근저당)/i,  // "담보" 제거 — finance의 "담보대출"과 충돌 방지
      /(공시가격|실거래가|시세|감정가)/i,
      /(디딤돌|보금자리|ltv|dti|dsr)/i,  // "주택담보" 제거 — finance로 우선 분류
      /(재산세|종부세|양도세|취득세)/i,
    ],
    weight: 4,
    cpcRange: [2000, 8000],
  },
  {
    category: 'tax',
    patterns: [
      /(세금|소득세|종합소득세|종소세|법인세|부가세|부가가치세)/i,
      /(연말정산|원천징수|세액공제|소득공제|비과세)/i,
      /(홈택스|국세청|세무사|세무서)/i,
      /(양도세|증여세|상속세|재산세|종부세|취득세)/i,
      /(사업자등록|간이과세|일반과세|면세|개인사업자)/i,
    ],
    weight: 4,
    cpcRange: [2000, 6000],
  },
  {
    category: 'career',
    patterns: [
      /(자격증|시험|공무원|9급|7급|토익|토플|텝스|오픽)/i,
      /(취업|이직|연봉|면접|자소서|이력서|포트폴리오)/i,
      /(mba|편입|대학원|유학|어학연수)/i,
      /(창업|프랜차이즈|부업|투잡|재택근무)/i,
      /(국가지원|고용지원|실업급여|내일배움카드)/i,
    ],
    weight: 3,
    cpcRange: [800, 3000],
  },
];

// JS `\b` 는 한글에서 작동하지 않으므로 한글 패턴은 단순 inclusion 으로 매칭
const INTENT_RULES: IntentRule[] = [
  // 거래형 — 구매 직전 단계
  {
    intent: 'transactional',
    patterns: [
      /(구매|구입|사기|살까|주문)/,
      /(가격|최저가|할인|쿠폰|특가|세일)/,
      /(무료배송|공짜|배송비)/,
      /(쿠팡|네이버쇼핑|11번가|G마켓|위메프)/i,
    ],
    weight: 3,
  },
  // 탐색형 — 비교/선택 단계
  {
    intent: 'investigational',
    patterns: [
      /(vs|비교|차이)/i,
      /(추천|순위|랭킹|베스트|best|top|탑\s|탑$)/i,
      /(어떤게|어느게|뭐가|어떤것)/,
      /(좋은|괜찮은|인기)/,
      /(리뷰|후기|평가)/,
    ],
    weight: 2,
  },
  // 정보형 — 학습/이해 단계
  {
    intent: 'informational',
    patterns: [
      /(방법|하는법|하는\s*법|how\s*to)/i,
      /(이란|뜻|의미|정의|개념)/,
      /(왜\s|왜$|이유|원인)/,
      /(가이드|튜토리얼|기초|입문)/,
      /(설명|알아보기|이해하기)/,
    ],
    weight: 2,
  },
];

/**
 * 키워드에서 검색 의도 추론
 * 매칭이 없으면 informational 기본값
 */
export function classifyIntent(keyword: string): SearchIntent {
  if (!keyword) return 'informational';
  const k = keyword.toLowerCase();

  const scores: Record<SearchIntent, number> = {
    informational: 0,
    investigational: 0,
    transactional: 0,
  };

  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(k)) {
        scores[rule.intent] += rule.weight;
      }
    }
  }

  // 최고 점수 의도 반환 (동점이면 transactional > investigational > informational 우선)
  const max = Math.max(scores.transactional, scores.investigational, scores.informational);
  if (max === 0) return 'informational';
  if (scores.transactional === max) return 'transactional';
  if (scores.investigational === max) return 'investigational';
  return 'informational';
}

/**
 * 의도별 H2 아키타입 — generateH2TitlesFinal 의 프롬프트 가이드로 주입
 */
export function getIntentH2Archetypes(intent: SearchIntent): {
  label: string;
  archetypes: string[];
  guideline: string;
} {
  switch (intent) {
    case 'transactional':
      return {
        label: '거래형 (구매 직전)',
        archetypes: [
          '[제품명] 어디서 사야 가장 저렴할까',
          '[제품명] 구매 전 반드시 확인할 5가지',
          '실사용자 후기로 본 [제품명] 장단점',
          '[제품명] 가격대별 추천 모델 비교',
          '[제품명] 구매 시 흔한 실수와 회피법',
        ],
        guideline: '독자는 이미 구매를 결심함. 망설임을 줄이고 신뢰를 주는 정보 위주. 비교/리뷰/구매팁 중심.',
      };
    case 'investigational':
      return {
        label: '탐색형 (비교/선택)',
        archetypes: [
          '[A] vs [B] 핵심 차이 한눈에',
          '나에게 맞는 [주제] 고르는 법',
          '[주제] 추천 순위 TOP 5',
          '전문가가 말하는 [주제] 선택 기준',
          '실제 사용자 만족도 비교',
        ],
        guideline: '독자는 옵션을 좁히는 중. 명확한 비교표/장단점/사용 시나리오별 추천이 핵심.',
      };
    case 'informational':
    default:
      return {
        label: '정보형 (학습/이해)',
        archetypes: [
          '[주제]란 무엇인가 — 핵심 개념 정리',
          '[주제]가 작동하는 원리',
          '[주제]를 시작하기 전 꼭 알아야 할 것',
          '단계별 [주제] 입문 가이드',
          '자주 묻는 질문과 흔한 오해',
        ],
        guideline: '독자는 처음 배우는 단계. 정의 → 원리 → 적용 순서로 차근차근. 비유와 예시 중요.',
      };
  }
}

/**
 * 모드 프롬프트에 주입할 의도 가이드 블록
 */
export function buildIntentPromptBlock(keyword: string): string {
  const intent = classifyIntent(keyword);
  const guide = getIntentH2Archetypes(intent);
  const ymyl = classifyYmyl(keyword);
  const ymylBlock = ymyl ? buildYmylPromptBlock(ymyl, keyword) : '';
  return `
🎯 **검색 의도 분석 결과**: ${guide.label}
📌 가이드라인: ${guide.guideline}
📋 권장 H2 아키타입 (참고용):
${guide.archetypes.map((a, i) => `  ${i + 1}. ${a}`).join('\n')}
${ymylBlock}`;
}

// ═══════════════════════════════════════════════════════
// 🏦 YMYL 분류 및 프롬프트 빌더
// ═══════════════════════════════════════════════════════

/**
 * 키워드가 YMYL 카테고리인지 판정. 가장 강하게 매칭된 카테고리 반환.
 * 매칭 없으면 null.
 */
export function classifyYmyl(keyword: string): YmylCategory {
  if (!keyword) return null;
  const k = keyword.toLowerCase();

  let bestCategory: NonNullable<YmylCategory> | null = null;
  let bestScore = 0;

  for (const rule of YMYL_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(k)) score += rule.weight;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = rule.category;
    }
  }

  return bestCategory;
}

/**
 * YMYL 카테고리의 예상 CPC 범위 조회
 */
export function getYmylCpcRange(category: YmylCategory): [number, number] | null {
  if (!category) return null;
  const rule = YMYL_RULES.find(r => r.category === category);
  return rule ? rule.cpcRange : null;
}

/**
 * YMYL 카테고리별 E-E-A-T 강화 + 면책 + 데이터 소스 가이드
 * AdSense 고수익을 위한 품질 신호 강제 주입
 */
export function buildYmylPromptBlock(category: NonNullable<YmylCategory>, keyword: string): string {
  const cpcRange = getYmylCpcRange(category);
  const cpcLabel = cpcRange ? `${cpcRange[0].toLocaleString()}~${cpcRange[1].toLocaleString()}원` : '고CPC';

  const categoryGuides: Record<NonNullable<YmylCategory>, { label: string; eeat: string[]; sources: string[]; disclaimer: string; must: string[] }> = {
    finance: {
      label: '💰 금융 (YMYL 최고등급)',
      eeat: [
        '필수: 금융감독원·한국은행·예금보험공사 등 공식 통계 인용',
        '모든 수익률/이자율은 "연 X%, YYYY년 N월 기준" 형식으로 출처 명시',
        '개인 투자 권유 금지 — "참고용", "투자 판단은 본인 책임" 명시',
      ],
      sources: [
        'fss.or.kr (금융감독원)', 'bok.or.kr (한국은행)', 'kdic.or.kr (예금보험공사)',
        'krx.co.kr (한국거래소)', 'nps.or.kr (국민연금)', '각 금융사 상품설명서',
      ],
      disclaimer: '본 글은 정보 제공 목적이며 투자 권유가 아닙니다. 투자 결정은 본인 책임하에 충분히 숙고 후 진행하세요. 모든 금융 상품은 원금 손실 가능성이 있습니다.',
      must: [
        '수익률/이자율 숫자 반드시 "연 X%, YYYY년 기준" 형식',
        '세후 실수령액 계산 예시 포함',
        '위험(원금 손실, 환차손 등) 섹션 필수',
        '금융소비자보호법 관련 정보 언급',
      ],
    },
    insurance: {
      label: '🛡️ 보험 (YMYL 최고등급)',
      eeat: [
        '보험업법·공시 의무 준수 — 특정 상품 추천 금지',
        '보험료/보장 내역은 "N사 기준 YYYY년 공시 상품설명서 참조" 명시',
        '계약 전 알릴 의무, 면책 조항, 해지환급금 구조 설명 필수',
      ],
      sources: [
        'knia.or.kr (생명보험협회)', 'knia.or.kr (손해보험협회)',
        'insu.kdi.re.kr (보험상품비교공시)', 'fss.or.kr (금융감독원)',
      ],
      disclaimer: '본 글은 보험 상품 일반 정보 제공 목적이며, 특정 상품 가입을 권유하지 않습니다. 가입 전 약관·공시·설계사 상담을 통해 본인 상황에 맞는 상품을 선택하세요.',
      must: [
        '보장 한도, 자기부담금, 갱신 주기 명시',
        '해지 시 환급금 구조 설명',
        '계약 전 알릴 의무(고지의무) 강조',
        '비교 시 "공시 기준" 명시',
      ],
    },
    medical: {
      label: '🏥 의료/건강 (YMYL 최고등급)',
      eeat: [
        '필수: 진단·치료는 반드시 의료진 상담 권고',
        '증상 설명은 일반 정보 제공 수준만 — 자가 진단 유도 절대 금지',
        '약·영양제 언급 시 식약처/학술 출처 병기',
      ],
      sources: [
        'kdca.go.kr (질병관리청)', 'mfds.go.kr (식약처)',
        'amc.seoul.kr (서울아산병원 건강정보)', 'health.kr (건강보험심사평가원)',
        'pubmed.ncbi.nlm.nih.gov (PubMed)', '대한○○학회 가이드라인',
      ],
      disclaimer: '본 글은 일반 건강 정보 제공 목적이며 의학적 진단·처방을 대체할 수 없습니다. 증상이 있거나 복용 중인 약이 있다면 반드시 전문의와 상담하세요.',
      must: [
        '"전문의 상담 권고" 문구 본문·결론 2회 이상',
        '증상/부작용 설명 시 출처(학회/질병관리청) 병기',
        '대체의학·민간요법 검증되지 않음 경고',
        '의약품 복용법/용량은 "처방전 지시 따르기" 명시',
      ],
    },
    legal: {
      label: '⚖️ 법률 (YMYL 고등급)',
      eeat: [
        '법령 인용 시 "YYYY년 N월 개정 기준" 명시',
        '사건별 상황 다름 — 일반화 금지, 구체 사건은 변호사 상담 권고',
        '판례 인용 시 사건번호·선고일자 포함',
      ],
      sources: [
        'law.go.kr (국가법령정보센터)', 'klri.re.kr (한국법제연구원)',
        'scourt.go.kr (대법원)', 'moj.go.kr (법무부)', '각 변호사회 공식자료',
      ],
      disclaimer: '본 글은 법률 일반 정보 제공 목적이며 구체 사건의 법률 자문이 아닙니다. 본인의 사안은 반드시 변호사와 상담하세요.',
      must: [
        '법조문 인용 시 "○○법 제○조 (YYYY년 개정)" 명시',
        '사건 유형별 처리 기간·비용 예시 포함',
        '"변호사 상담 권고" 본문·결론 2회 이상',
        '소멸시효, 제소 기간 등 놓치면 안 되는 기한 강조',
      ],
    },
    realestate: {
      label: '🏠 부동산 (YMYL 고등급)',
      eeat: [
        '시세/공시가격은 "국토교통부 실거래가 공개시스템 YYYY년 N월 기준" 명시',
        '세금 계산 예시는 최신 세법 반영 + 본인 상황별 변동 고지',
      ],
      sources: [
        'rt.molit.go.kr (국토교통부 실거래가)', 'realty.daum.net',
        'land.naver.com', 'kab.co.kr (한국감정원)', 'hf.go.kr (주택금융공사)',
      ],
      disclaimer: '부동산 시세·세제는 지역·시점·개인 상황에 따라 크게 달라집니다. 거래 전 공인중개사·세무사 상담을 권장합니다.',
      must: [
        '실거래가는 "YYYY년 N월 N구역 기준" 명시',
        'LTV/DTI/DSR 계산 예시 포함',
        '양도세·취득세는 본인 보유 주택 수에 따라 다름 고지',
        '전세사기 방지 체크리스트 (해당 시)',
      ],
    },
    tax: {
      label: '💵 세금 (YMYL 고등급)',
      eeat: [
        '세율·공제는 "YYYY년 귀속 기준" 반드시 명시',
        '복잡한 사례는 세무사 상담 권고',
      ],
      sources: [
        'hometax.go.kr (홈택스)', 'nts.go.kr (국세청)',
        'law.go.kr (세법 원문)', '국세청 세목별 안내',
      ],
      disclaimer: '세법은 매년 개정되며 본인 상황에 따라 세액이 크게 달라집니다. 정확한 신고는 세무사 또는 홈택스 상담을 이용하세요.',
      must: [
        '세율/공제액 "YYYY년 귀속 기준" 명시',
        '계산 예시 (소득 구간별 실제 세액)',
        '신고 기한/가산세 경고',
        '홈택스 직접 신고 단계 제공',
      ],
    },
    career: {
      label: '📜 자격증/취업 (YMYL 중등급)',
      eeat: [
        '시험 일정·접수 기간은 공식 주관처 기준',
        '합격률·난이도는 공식 통계 인용',
      ],
      sources: [
        'q-net.or.kr (한국산업인력공단)', 'gosi.kr (공무원시험)',
        '각 자격증 주관기관 공식 홈페이지', 'work.go.kr (고용노동부)',
      ],
      disclaimer: '시험 일정·과목·배점은 개편될 수 있습니다. 반드시 공식 주관처에서 최신 정보를 확인하세요.',
      must: [
        '시험일/접수일/합격발표 "YYYY년 기준" 명시',
        '응시자격/학력 요건 정확히 기재',
        '합격률 통계는 공식 출처',
        '수수료/준비물 체크리스트',
      ],
    },
  };

  const g = categoryGuides[category];

  return `

💰💰💰 [YMYL 고CPC 키워드 감지 — ${g.label}] 💰💰💰

📊 **예상 AdSense CPC**: ${cpcLabel} (일반 키워드 대비 5~20배)
🎯 **목표**: Google의 YMYL 품질 기준(E-E-A-T)을 100% 충족하여 수익·노출 극대화

🛡️ **E-E-A-T 강제 규칙** (이 글을 보고 구글이 "신뢰할 수 있다"고 판단하게 만드는 요소):
${g.eeat.map(e => `   ✅ ${e}`).join('\n')}

📚 **필수 참고 출처** (본문에서 최소 2개 이상 언급/인용):
${g.sources.map(s => `   📖 ${s}`).join('\n')}

🔥 **본문 필수 포함 요소**:
${g.must.map(m => `   🎯 ${m}`).join('\n')}

⚠️ **면책 고지 (결론부에 반드시 삽입)**:
"${g.disclaimer}"

🚫 **YMYL 절대 금지**:
   ❌ 근거 없는 수치 ("약 N%" 식 추측 금지)
   ❌ 개인 경험을 일반화하는 단정 ("저는 이렇게 해서 성공했으니 당신도...")
   ❌ 특정 상품/서비스 직접 추천 (비교·정보 제공만)
   ❌ "반드시", "확실히", "무조건" 같은 절대적 표현
   ❌ 전문가 자격 사칭 ("변호사인 제가", "의사 경력 N년" 등)

💡 **고수익 포인트**: YMYL 키워드는 Google이 품질 신호를 엄격하게 평가합니다.
   위 규칙을 100% 지키면 상위 노출 + 고CPC 광고 매칭으로 RPM이 5~20배 높아집니다.
`;
}
