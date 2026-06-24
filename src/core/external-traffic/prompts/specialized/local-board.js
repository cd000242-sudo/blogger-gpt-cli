// src/core/external-traffic/prompts/specialized/local-board.js
// v3.8.128: 지역 자유게시판 — makeChannel 직접 호출 (makeSpecialized의 1600 토큰 + 본문 500-1200자 기본값 회피).

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

const LOCAL_BOARD_BANNED = [
  '제 블로그', '방문해주세요', '구독 부탁', '홍보',
  '바로 클릭', '지금 신청', '100% 보장', '무조건',
  '~을(를) 추천합니다', '광고', '협찬',
  '여러분', '안녕하세요 이웃님들', '안녕하세요 주민 여러분',
  '[동네이름]', '[지역명]', '[아파트명]', '동네이름', '지역명',
];

module.exports = makeChannel({
  id: 'local-board',
  name: '지역 자유게시판',
  category: 'community',
  riskTier: 'medium',
  confidence: 'inferred',
  icon: '🏘️',
  color: '#f59e0b',
  openUrl: '',

  killerHookPatterns: [
    '저희 동네는 어떻게 하시나요? 혹시 저만 헷갈렸나요?',
    '오늘 우연히 알게 된 건데 주민분들도 아시는지 궁금해서요',
    '저랑 비슷한 상황이신 분 계신가요? 어제 진짜 답답한 일이 있어서요',
    '여기 사시는 분들 중에 혹시 이거 해보신 분 있을까요?',
    '동네 단톡방에서 얘기 나오던데 정확한 정보 아시는 분 계세요?',
  ],
  bannedPhrases: LOCAL_BOARD_BANNED,
  popularityTriggers: [
    '동네 주민 실제 경험담',
    '근처 사시는 분 공감 질문',
    '자녀·가족 관련 실용 정보',
    '집·전세·관리비·세금처럼 모두가 신경 쓰는 주제',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '저희', '저희 동네'],
  },
  paragraphRule: {
    maxLineChars: 50,
    paragraphBreak: 'double',
    emptyLineMaxConsecutive: 1,
    ctaSection: 'end-of-body',
  },
  bandThresholds: { low: 40, medium: 65, high: 85, critical: 100 },
  maxOutputTokens: 3000,

  buildSystemPrompt: (subChannel, userCustomRule) => {
    const base = `당신은 한국 동네 자유게시판(네이버 카페 지역방, 맘카페, 부동산 카페, 아파트 입주민 카페)에 글을 쓰는 진짜 주민입니다.

[글 형식 — 반드시 지키세요]
- 본문 200~400자 (이보다 길면 광고 의심 받음 — 무조건 압축)
- 어조: 존댓말 + 일상 동네 톤 (예: "저희 동네", "여기 사시는 분들", "혹시 저만 그런가요?")
- 첫 줄: 동네 질문형 / 경험 공유형 / 정보 공유형 중 하나로 자연스럽게 시작
- 마지막 1~2줄: "혹시 도움 되실까 해서 정리한 글 같이 봤어요 → [URL]" 같은 자연스러운 링크 1개만

[절대 금지]
- "[동네이름]", "[지역명]", "[아파트명]" 같은 placeholder/대괄호 표기 — 모르면 그냥 "저희 동네"로 쓸 것
- "여러분", "안녕하세요 주민 여러분", "안녕하세요 이웃님들" 같은 단체 인사
- 광고/판매/홍보 어휘 ("추천합니다", "100% 보장", "바로 클릭")
- 블로그 요약문 톤, 외래어/전문용어 남발, 해시태그
- 첫 줄부터 링크
- 본문에서 모든 정보 다 풀기 (링크 클릭 이유가 사라짐 — 정확한 자격·신청법·금액 등은 본문에서 빼고 링크에서만 확인 가능하게)

[미끼·티저 전략 (필수)]
본문 끝 cliffhanger 1개 반드시 사용:
- "조건이 좀 까다로워서 본인 케이스가 해당되는지는 직접 확인해야 해요."
- "신청 방법이 생각보다 까다로워서 정리된 글 참고했어요."
- "혹시 본인이 해당되는지 궁금하면 자가진단표가 있어요."
- "정확한 금액은 케이스마다 다르니까 한번 확인해보세요."

[A/B/C 변형]
A안 동네 질문형: "이거 어떻게 하시나요? 저만 헷갈렸나요?"
B안 경험 공유형: "어제 진짜 이런 일이… 저랑 비슷한 분 계신가요?"
C안 정보 공유형: "혹시 이거 아세요? 우연히 알게 됐는데 공유합니다."

[출력 형식 — 반드시 지키세요]
3개 변형을 다음 형식으로 모두 출력하세요. JSON, 코드블록, 부가 설명은 절대 쓰지 마세요.

===A안 (동네 질문형)===
(본문 200~400자, 마지막 줄에 출처 URL)

===B안 (경험 공유형)===
(본문 200~400자, 마지막 줄에 출처 URL)

===C안 (정보 공유형)===
(본문 200~400자, 마지막 줄에 출처 URL)`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => {
    const summary = sourceSummary || {};
    const core = summary.coreValue || '';
    const points = Array.isArray(summary.keyPoints) ? summary.keyPoints.join(', ') : '';
    const data = Array.isArray(summary.dataPoints) ? summary.dataPoints.join(', ') : '';
    return `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${core}
- 주요 포인트: ${points}
- 수치/데이터: ${data}

지역 자유게시판에 올릴 A/B/C 3안을 모두 작성하세요. 각 200~400자, 본문 끝에 자연스럽게 ${sourceUrl} 1개씩만 넣으세요. "[동네이름]" 같은 placeholder 절대 사용하지 마세요 — 동네 이름 모르면 "저희 동네"로만 쓰세요.`;
  },

  userWarning: '지역 자유게시판은 운영자 재량으로 광고/홍보 게시글이 즉시 삭제·정지될 수 있습니다. "광고 같은 글" 신고 받으면 강퇴 가능 — 반드시 자연스러운 주민 톤으로 작성하고, 처음 가입한 카페면 며칠 활동 후 게시 권장.',
  operationalNotes: [
    '카페·게시판 운영 규칙은 운영자마다 다름 — 처음 가입한 곳은 며칠 활동 후 작성',
    '광고 같은 글 신고 받으면 즉시 차단 — 첫 줄부터 광고 티 나면 즉시 삭제됨',
    '맘카페·부동산 카페는 신뢰가 핵심 — 본인 경험담처럼 작성',
    '동네 이름 모르면 "저희 동네" 같은 표현 사용 (placeholder 금지)',
  ],
});
