// src/core/external-traffic/_shared/viral-dna.js
// v3.8.263: 7원칙 통합 viral DNA (한 축 치우치지 않음)
//
// 지금까지 누적된 7가지 원칙 동시 만족:
//   1. STOP — 첫 줄 손가락 멈춤 (viral 패턴 stacking)
//   2. HOLD — 본문 끝까지 (의심점/구체/비-동그란수/자연링크)
//   3. AWARENESS — 청중 인지도 평가 후 패턴 선택
//   4. FACT — 모든 사실 원문에서만 (조작 ZERO)
//   5. NATURAL — 출처 명시 X, 자기 정보처럼 (link bait 어조 X)
//   6. EMOTION — 1인칭 감정 (의심/궁금/검증욕구)
//   7. NO AD — 50+ 클리셰 차단

'use strict';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 핵심 철학 — 7가지가 동시에 작동
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 진짜 10K+ viral 글:
//   - 첫 줄: 손가락 멈춤 (STOP) + 자연스러움 (NATURAL) + 사실 기반 (FACT)
//   - 본문: 끝까지 읽힘 (HOLD) + 1인칭 감정 (EMOTION) + 광고티 ZERO (NO AD)
//   - 전체: 청중 인지도 맞춤 (AWARENESS)
//
// 한 축만 강하면 = 광고/낚시/추측/공문/AI글 → 절대 viral 안 됨
// 7축 모두 자연스럽게 녹아야 진짜 viral

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. viral 패턴 8가지 — 모두 사실 조작 ZERO + 자연스러움 유지
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_PATTERNS = {
  fact_doubt: {
    key: '사실의심',
    desc: '원문 핵심 수치를 1인칭 의심으로',
    example: '청년미래적금 3년에 2,200 만든다고 하는데, 진짜 이만큼 차이 나는 게 맞나?',
    hint: '원문 수치 그대로 + "진짜?" / "이게 맞아?" / "솔직히 의심됨"',
    awarenessLevel: 'both', // unaware/aware 둘 다 작동
  },
  comparison_natural: {
    key: '비교자연',
    desc: '익숙한 기준과 비교 (자기 사고처럼 자연스럽게)',
    example: '청년미래 3년에 2,200. 일반 적금 4%로 같은 기간이면 1,400 정도?',
    hint: '원문 + 상식 수준 비교 기준. 작성자가 직접 계산하는 양 자연스럽게',
    awarenessLevel: 'both',
  },
  condition_unease: {
    key: '조건불편',
    desc: '원문 조건의 까다로움을 자연스럽게 짚기',
    example: '연소득 5천 이하 청년 한정인데, 자동이체 끊기면 전액 회수 조건도 있더라',
    hint: '원문 조건 그대로 + 솔직한 불편함 표현. "원문에 안 적힘" 같은 link bait X',
    awarenessLevel: 'both',
  },
  unknown_check: {
    key: '인지점검',
    desc: '"들어본 사람?" 식 자기 점검 유도 (aware 청중 핵심)',
    example: '청년미래적금 들어본 사람? 청년도약이랑 헷갈리는 사람도 많은 듯',
    hint: '단순 인지차이만. 인물 추측 X, 통계 추측 X',
    awarenessLevel: 'aware',
  },
  timeline_anchor: {
    key: '시점고정',
    desc: '원문 시점 첫 줄에 박기 (자연스럽게)',
    example: '2026년부터 시행되는 청년미래적금. 조건이 좀 특이한데',
    hint: '원문 시점만 사용. "어제 발표" 같은 시점 조작 X',
    awarenessLevel: 'both',
  },
  inner_tension: {
    key: '내부긴장',
    desc: '원문 내 혜택 vs 리스크 동시 노출',
    example: '3년 자동이체 끊기면 전액 회수. 근데 만기 2,200은 일반 적금 대비 크다',
    hint: '원문에 있는 양면을 한 문장에 동시 노출',
    awarenessLevel: 'both',
  },
  detail_quiet: {
    key: '디테일조용',
    desc: '원문 디테일을 "알아두면 좋은 거" 톤으로 (aware 청중 클릭 유도)',
    example: '연소득 5천 이하인데, 이거 세전인지 세후인지가 의외로 중요',
    hint: '원문에 있는 디테일만. 조용한 톤으로 자기 점검 유도',
    awarenessLevel: 'aware',
  },
  range_scope: {
    key: '범위제시',
    desc: '원문 다룬 범위 자연스럽게 제시 (광고 X)',
    example: '청년미래적금 - 신청 조건, 매칭 비율, 만기 세금, 중도해지 페널티 4가지',
    hint: '원문 범위만 나열. "총정리" / "완벽 가이드" 같은 광고 표현 X',
    awarenessLevel: 'unaware',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 절대 금지 표현 — 7원칙 위반 ALL 차단
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const UNIVERSAL_BANNED_PHRASES = [
  // 광고 클리셰 (NO AD 원칙)
  '버린 셈', '손해 본 셈', '버린거나 마찬가지',
  '이거 모르고', '이거 모르면', '모르면 손해',
  '한 줄기 빛', '구원', '꿀팁', '비법', '꿀팁니다',
  // 클릭베이트 (NO AD)
  '놀라운', '충격', '대박', '믿기지 않는', '레전드', '미쳤다',
  '역대급', '끝판왕', '완벽 가이드', '총정리', 'A to Z',
  // 스팸 신호 (NO AD)
  '꼭 알려줘', '꼭 공유', '꼭 알려주세요', '꼭 봐주세요',
  '참고해봐', '참고하세요', '확인해보세요', '클릭하세요',
  '지금 바로', '놓치지 마세요', '서둘러',
  // AI 흔적 (NO AD)
  '처음엔 나도 믿기 힘들었는데', '진짜면 이잖아',
  '오늘은 ~에 대해 알아보겠습니다', '흔히 알려진 대로',
  '많은 분들이', '많은 사람들이',
  // 공문 어조 (NO AD)
  '본인 케이스에 해당되는지', '확인해보시기 바랍니다',
  '확인하시기 바랍니다', '부탁드립니다',
  // 생각 없는 댓글 유도 (NO AD)
  '혹시 너희 중에도', '다들 어떻게 생각해', '여러분 안녕하세요',
  '여러분은 어떻게', '댓글로 알려주세요',
  // 마케터 정형 카피 (NO AD + FACT)
  '월 N만원 × N년', '× 3년 + 정부 매칭', '정부가 매칭해서',
  // ━━━━ FACT 원칙 위반 — 사실 조작 차단 ━━━━
  // 가짜 인물
  '친구 누나가', '친구 형이', '친구 동생이',
  '회사 동료 N명', 'N명 중 N명',
  '은행 다니는 친구가', '인사담당자 친구가',
  '카톡으로 알려줬다', '카톡으로 받았다',
  '인증글 봤다', '통장 스샷', '인증 받았다',
  // 시점 조작
  '어제 발표', '오늘 발표', '이번 주 발표', '이번 달 발표',
  // 작성자 본인 신원 추측
  '28살', '29살', '30살', '31살', '32살', '33살', '34살', '35살',
  '월 N만 받는 직장인', '연봉 N',
  '결혼 1년차', '신혼', '워킹맘', '워킹대디',
  '대기업 다니는', '중소기업 다니는',
  // 추측성 세대/계급 비교
  '우리 부모 세대는', '부모 세대는 못', '아는 사람만 부자',
  '아는 사람만 누리는', '정부가 적극 홍보 안 하는',
  '대기업만 아는', '공무원만 아는',
  // ━━━━ NATURAL 원칙 위반 — link bait 어조 차단 ━━━━
  '원문 보니까', '원문 기준', '원문에 따르면',
  '원문에 정리', '원문에도 명확히 안 적힘',
  '글에 정리해놨음', '글에 정리해뒀음', '자세한 건 여기',
  '여기 정리해둔', '정확한 비율은 글에', '정확한 매칭은 글에',
  '자세한 내용은 링크', '여기서 확인',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 본문 흐름 — 7원칙 통합 (사실 + 자연 + 의심 + 광고티 X)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_BODY_FLOW = `
[v3.8.264 통합 본문 흐름 — 7원칙 + aware 클릭 trigger]

순서:
1. **첫 줄** (STOP + FACT + NATURAL)
   - viral 패턴 1~2개 stacking
   - 원문 사실 활용 (조작 X)
   - 자기 정보인 양 자연스러움 (출처 명시 X)

2. **본문 1단락** (FACT + NATURAL)
   - 원문 핵심 사실 진술 (수치/조건/시점)
   - 자연 어조: "~한대" / "~라는데" / "~한다고"

3. **본문 2단락** (HOLD + EMOTION + **aware click trigger**)
   - 작성자 1인칭 반응 (의심/궁금/검증욕구)
   - **★ 디테일 hint 1**: 케이스별 다른 부분 짚기
     예: "이거 세전인지 세후인지 케이스마다 다른 듯"
     예: "본인 적금 이율에 따라 차액 다르긴 함"
   - aware 청중: "내 케이스는?" 호기심 → 클릭 동력

4. **본문 3단락** (HOLD + FACT + **aware click trigger**)
   - 원문 리스크/조건 솔직히 짚기
   - **★ 디테일 hint 2**: 시점/조건별 정밀 정보 부재 짚기
     예: "시점별로 페널티가 좀 다름"
     예: "1년 후 해지랑 만기 직전 해지가 같진 않은 듯"
   - "여기 정리해놨음" 같은 link bait NO
   - "복잡하긴 한데 봐야 할 부분 있음" 같은 자연스러운 인정 OK

5. **마지막** (HOLD + NATURAL)
   - 의견 갈리는 질문 또는 자연스러운 호기심
   - 강요 X, "다들 어떻게 생각해" 같은 클리셰 X

6. **링크** (NATURAL)
   - URL 단독 (가장 자연)
   - 또는 "→ URL" / 화살표만
   - "원문: URL" / "자세한 건 여기" / "글에 정리" 모두 X

[v3.8.264 — aware 청중 click trigger 핵심 원칙]
본문에 "디테일 hint"를 2개 자연스럽게 심어라:
  - 케이스별 차이 ("연봉/이율/시점/세전세후 따라 다름")
  - 정밀 정보 부재 인정 ("시점별로 좀 다름", "케이스마다 차이")
이게 link bait 어조 없이 aware 청중 클릭 trigger.

❌ link bait (NO): "정확한 비율은 글에 정리해놨음"
✅ 자연 hint (YES): "본인 적금 이율에 따라 차액 좀 다름"

→ aware 청중: "내 적금 이율 대비는?" → 자연스럽게 URL 클릭
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. system prompt 삽입 블록 — 7원칙 통합
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildViralDnaBlock({ platformName = '플랫폼', requireAllPatternsDistinct = true }) {
  const patternListText = Object.entries(VIRAL_PATTERNS).map(([k, p], i) => {
    return `  ${i + 1}) **${p.key}** (${p.awarenessLevel}): ${p.desc}\n     예: "${p.example}"\n     팁: ${p.hint}`;
  }).join('\n');

  return `
[v3.8.263 — 10K+ viral의 7원칙 통합 (한 축으로 치우치지 말 것)]

★ 7가지 원칙이 동시에 만족되어야 진짜 viral:
  1. STOP — 첫 줄에 손가락 멈춤 (viral 패턴 stacking)
  2. HOLD — 본문 끝까지 읽힘 (의심점/구체/비-동그란수/자연링크)
  3. AWARENESS — 청중 인지도 평가 후 패턴 선택
  4. FACT — 모든 사실 원문에서만 (조작 ZERO)
  5. NATURAL — 출처 명시 X, 자기 정보처럼 (link bait 어조 X)
  6. EMOTION — 1인칭 감정 (의심/궁금/검증욕구)
  7. NO AD — 클리셰 차단

한 축만 강하면 광고/낚시/추측/공문/AI글 → viral 실패.

[청중 인지도 먼저 평가 (AWARENESS)]
context.audienceAwareness 명시:
  - **unaware**: 처음 듣는 사람 다수 (틈새 주제)
  - **aware**: 들어본 사람 다수 (트렌딩 주제)
  - **mixed**: 양쪽 모두 (정부 정책/적금/부동산/IT 트렌드는 거의 mixed)

[viral 패턴 8가지 — 모두 7원칙 만족]
${patternListText}

[패턴 stacking 규칙]
- unaware 청중: 패턴 1,2,3,5,6,8 위주, 1~2개 stacking
- aware 청중: 패턴 4,7 위주, 또는 1+4 / 2+7 stacking
- mixed 청중: aware 1 + unaware 1 강제 stacking (양쪽 모두 잡기)
${requireAllPatternsDistinct ? '\nA/B/C는 stacking 조합 서로 다르게.' : ''}

[v3.8.263 — 절대 금지 표현 (${platformName} 출력 즉시 실패)]
${UNIVERSAL_BANNED_PHRASES.map((p) => `  - "${p}"`).join('\n')}

[수치 작성 규칙 (FACT)]
- 원문 수치 그대로 사용 (정밀화/변형 X)
- 원문 "2,200만원" → 그대로 "2,200만원"
- 비교용 계산값은 OK ("일반 적금 4%로 부으면 1,400 정도")
- "월 N × N년 = N" 정형 광고 카피 형식 X
- 수치 옆에 출처 명시 X (NATURAL 원칙)

${VIRAL_BODY_FLOW}

[본문 emotion intensity (EMOTION)]
다음 1인칭 감정 중 최소 1개를 본문에 자연스럽게:
  - **의심/검증욕구**: "솔직히 이만큼 차이 진짜 가능한지 의심됨"
  - **비교욕구**: "일반 적금이랑 비교하면 차이가 크긴 함"
  - **궁금증**: "조건이 까다로워서 다 되는지 봐야 함"
  - **솔직한 불편**: "자동이체 끊기면 전액 회수라 좀 깐깐함"
중립/객관/안내 어조 = 광고. 작성자 1인칭만 (익명 인물의 감정 추측 X).

[Hold Power 4요소 (HOLD)]
1) 의심점/리스크 명시 (원문에 명시된 것만)
2) 작성자 1인칭 반응 (감정/생각)
3) 비교/계산 자연스럽게 (조작 X)
4) 링크 자연 통합 (URL 단독 권장)

[자가 검증 — 7원칙 통합 점수]
critique.factCheck (100점 만점, 100이어야 통과)
critique.viralStrength (≥70 통과)
critique.emotionalIntensity (≥60 통과)
critique.holdStrength (≥70 통과)
critique.naturalness (≥70 통과 — link bait 어조 X 검증)
critique.adFreeScore (≥80 통과 — 클리셰 0 검증)
critique.awarenessMatch (audienceAwareness에 맞는 패턴인지 0/1)

[마지막 자가 체크 8가지 — 모두 YES여야 통과]
1. 모든 사실이 원문에서 나왔는가? (FACT)
2. 꾸며낸 인물/통계/사례 있는가? NO여야 함
3. 작성자 본인 신원(나이/직업/소득) 추측했는가? NO여야 함
4. "원문 보니까" 같은 link bait 어조 있는가? NO여야 함
5. 첫 줄에서 멈춘 후 끝까지 읽히는가? YES여야 함
6. 이미 들어본 사람도 "내가 모르는 게 있나?" 자기 점검하는가? YES여야 함
7. **★ 본문에 디테일 hint 2개 이상 자연스럽게 심었는가? (aware 클릭 trigger)** YES여야 함
   예: "케이스마다 다른 듯", "본인 이율에 따라", "시점별로 다름"
8. 평균 조회수 1만+ 목표라면 그대로 쓰겠는가? YES여야 함
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. schema 필드 — 7원칙 점수 통합
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_VARIANT_FIELDS = `      "viralPatternStack": ["사실의심 | 비교자연 | 조건불편 | 인지점검 | 시점고정 | 내부긴장 | 디테일조용 | 범위제시 중 1~2개 — audienceAwareness에 맞춰"],
      "approach": "전략 한 줄 (7원칙 통합 — STOP/HOLD/FACT/NATURAL/EMOTION/AWARENESS/NO AD)",
      "firstLineCandidates": ["7원칙 통합 첫 줄 후보1", "후보2", "후보3"],
      "selectedFirstLine": "위 3개 중 7원칙 모두 자연스럽게 녹은 선택",`;

const VIRAL_CRITIQUE_FIELDS = `      "critique": {
        "score": 90,
        "factCheck": 100,
        "factCheckNotes": "모든 사실(수치/인물/사례/시점)이 원문에서 나왔는지 확인",
        "viralStrength": 75,
        "emotionalIntensity": 70,
        "holdStrength": 75,
        "naturalness": 75,
        "adFreeScore": 85,
        "awarenessMatch": 1,
        "awareClickTriggers": ["디테일 hint 1 — 케이스별 차이 표현", "디테일 hint 2 — 정밀 정보 부재 자연 인정"],
        "notes": "7원칙 + aware click trigger 종합 평가",
        "mustImprove": "발견한 약점 1개"
      },`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. A/B/C 패턴 매핑 — 청중별 + 7원칙 통합
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ABC_VIRAL_MAPPING = `
[A/B/C 패턴 stack 매핑 — v3.8.263 청중별 + 7원칙]

★ unaware (낯선 주제):
- A안: **사실의심 + 비교자연**
- B안: **시점고정 + 범위제시**
- C안: **내부긴장 + 조건불편**

★ aware (트렌딩 주제):
- A안: **인지점검 + 디테일조용**
- B안: **사실의심 + 비교자연**
- C안: **조건불편 + 내부긴장**

★ mixed (양쪽 모두):
- A안: **인지점검 + 사실의심** (aware 시작 + 모두 잡기)
- B안: **시점고정 + 비교자연** (자연스러운 진입)
- C안: **조건불편 + 내부긴장** (의심 자극)

A/B/C는 stack 조합 서로 다르게. 7원칙 모두 통과.
`;

// 동그란 큰 수 단독 사용 감지 (post-process 검증용)
const ROUND_NUMBER_PATTERNS = [
  /\b2,?200만원\b/, /\b1,?000만원\b/, /\b2,?000만원\b/,
  /\b3,?000만원\b/, /\b5,?000만원\b/, /\b1,?500만원\b/,
];

module.exports = {
  VIRAL_PATTERNS,
  UNIVERSAL_BANNED_PHRASES,
  ROUND_NUMBER_PATTERNS,
  VIRAL_BODY_FLOW,
  VIRAL_VARIANT_FIELDS,
  VIRAL_CRITIQUE_FIELDS,
  ABC_VIRAL_MAPPING,
  buildViralDnaBlock,
};
