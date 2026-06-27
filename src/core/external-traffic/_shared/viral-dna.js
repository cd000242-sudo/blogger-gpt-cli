// src/core/external-traffic/_shared/viral-dna.js
// v3.8.258: 공통 viral DNA 프레임워크
// 모든 SNS/커뮤니티 채널이 공유하는 viral 패턴 + 클리셰 차단 + 본문 흐름 강제
// 채널별 promptBuilder가 이 모듈의 블록을 import해서 system prompt에 삽입

'use strict';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 5가지 viral 패턴 (모든 채널 공통)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_PATTERNS = {
  mechanism: {
    key: '구체메커니즘',
    desc: '결론 아니라 작동 원리를 숫자로',
    example: '월 70만원 × 3년 + 정부 매칭 800만원 = 2,200만원',
  },
  urgency: {
    key: '시간압박',
    desc: '마감/한정/타이밍 강조',
    example: '12월 31일 전에 신청 안 하면',
  },
  contrarian: {
    key: '모순반전',
    desc: '상식과 반대되는 사실',
    example: '일반 적금 < 정기예금? 이건 반대였음',
  },
  empathy_crisis: {
    key: '공감위기감',
    desc: '구체적 처지 + 후회 가능성',
    example: '28살, 1년 모은 거 1500인데',
  },
  controversy: {
    key: '댓글유발의견갈림',
    desc: '답 없는 의견 질문 (의견 갈림)',
    example: '이거 신청 안 하는 게 손해? 너희라면?',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. 절대 금지 클리셰/광고티 표현 (모든 채널 공통)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const UNIVERSAL_BANNED_PHRASES = [
  // 광고 클리셰
  '버린 셈', '손해 본 셈', '버린거나 마찬가지',
  '이거 모르고', '이거 모르면', '모르면 손해',
  // 소상공인 블로그 클리셰
  '한 줄기 빛', '구원', '꿀팁', '비법', '꿀팁니다',
  // 클릭베이트
  '놀라운', '충격', '대박', '믿기지 않는', '레전드', '미쳤다',
  '역대급', '끝판왕', '완벽 가이드', '총정리', 'A to Z',
  // 스팸/유도 신호
  '꼭 알려줘', '꼭 공유', '꼭 알려주세요', '꼭 봐주세요',
  '참고해봐', '참고하세요', '확인해보세요', '클릭하세요',
  '자세한 내용은 링크', '자세한 건 여기', '여기 정리해둔',
  '지금 바로', '놓치지 마세요', '서둘러',
  // 어색 한국어/AI 흔적
  '처음엔 나도 믿기 힘들었는데', '진짜면 이잖아',
  '오늘은 ~에 대해 알아보겠습니다', '흔히 알려진 대로',
  '많은 분들이', '많은 사람들이',
  // 관청/공문 어조
  '본인 케이스에 해당되는지', '확인해보시기 바랍니다',
  '확인하시기 바랍니다', '부탁드립니다',
  // 생각 없이 붙이는 댓글 유도
  '혹시 너희 중에도', '다들 어떻게 생각해', '여러분 안녕하세요',
  '여러분은 어떻게', '댓글로 알려주세요',
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. 본문 흐름 강제 (메커니즘 → 의심점 → 댓글유발)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_BODY_FLOW = `
[v3.8.258 viral 본문 흐름 — 반드시 이 순서]
1. 첫 줄: viral 패턴 5개 중 1개 (정확히)
2. 본문 1단락: 메커니즘 또는 숫자 (왜 그게 가능한지 작동 원리)
3. 본문 2단락: 의심점/리스크/조건 (반드시 1개 — "근데 이거 진짜?", "조건이 OO인데")
4. 마지막: 의견 갈리는 질문 또는 자연스러운 호기심 유발
5. 링크: 본문에 광고처럼 권유 X, 끝에 URL 단독 또는 "원문: URL"
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. system prompt에 끼울 viral DNA 블록 생성
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildViralDnaBlock({ platformName = '플랫폼', requireAllPatternsDistinct = true }) {
  return `
[v3.8.258 — 손가락이 멈추는 viral DNA 강제]
첫 줄에 다음 5가지 viral 패턴 중 정확히 1개를 반드시 적용한다:
  1) **구체메커니즘**: 결론 아니라 작동 원리를 숫자로 ("${VIRAL_PATTERNS.mechanism.example}")
  2) **시간압박**: 마감/한정/타이밍 ("${VIRAL_PATTERNS.urgency.example}")
  3) **모순반전**: 상식과 반대되는 사실 ("${VIRAL_PATTERNS.contrarian.example}")
  4) **공감위기감**: 구체적 처지 + 후회 가능성 ("${VIRAL_PATTERNS.empathy_crisis.example}")
  5) **댓글유발의견갈림**: 답 없는 의견 질문 ("${VIRAL_PATTERNS.controversy.example}")
${requireAllPatternsDistinct ? '\nA/B/C는 viral 패턴이 서로 달라야 한다. 패턴 중복 금지.' : ''}

[v3.8.258 — 절대 쓰면 안 되는 표현 (${platformName} 출력 즉시 실패)]
${UNIVERSAL_BANNED_PHRASES.map((p) => `  - "${p}"`).join('\n')}

${VIRAL_BODY_FLOW}

[자가 검증]
critique.mustImprove에 위 금지어/클리셰/광고티가 들어갔는지 1개 식별 → finalRevision에서 제거.
critique.viralStrength 점수(0~100)를 명시: 60점 미만이면 다른 패턴으로 재작성.
`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. 채널별 schema에 끼울 viral 필드 정의 (재사용)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const VIRAL_VARIANT_FIELDS = `      "viralPattern": "구체메커니즘 | 시간압박 | 모순반전 | 공감위기감 | 댓글유발의견갈림 (정확히 1개)",
      "approach": "전략 한 줄 (어조 + viral 패턴 활용 방식)",
      "firstLineCandidates": ["viral 패턴 적용 첫 줄 후보1", "후보2", "후보3"],
      "selectedFirstLine": "위 3개 중 가장 강한 선택 (클리셰/광고티 없을 것)",`;

const VIRAL_CRITIQUE_FIELDS = `      "critique": {
        "score": 90,
        "viralStrength": 75,
        "notes": "viral 패턴 강도/클리셰 유무/진정성 한 줄",
        "mustImprove": "초안에서 발견한 클리셰·광고티·약한 훅 1개 명시"
      },`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. A/B/C 역할 + viral 패턴 매핑 (재사용 가능)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ABC_VIRAL_MAPPING = `
[A/B/C 역할 + viral 패턴 매핑]
- A안 → viral 패턴: **댓글유발의견갈림** OR **모순반전**
   첫 줄: 답 없는 의견 질문 또는 상식 뒤집기
- B안 → viral 패턴: **공감위기감** OR **구체메커니즘**
   첫 줄: 구체적 처지 또는 메커니즘 숫자
- C안 → viral 패턴: **시간압박** OR **구체메커니즘**
   첫 줄: 마감/한정 또는 강력한 숫자
A/B/C는 viral 패턴이 서로 달라야 한다.
`;

module.exports = {
  VIRAL_PATTERNS,
  UNIVERSAL_BANNED_PHRASES,
  VIRAL_BODY_FLOW,
  VIRAL_VARIANT_FIELDS,
  VIRAL_CRITIQUE_FIELDS,
  ABC_VIRAL_MAPPING,
  buildViralDnaBlock,
};
