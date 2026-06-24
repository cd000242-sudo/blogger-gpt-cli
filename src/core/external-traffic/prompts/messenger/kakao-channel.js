// src/core/external-traffic/prompts/messenger/kakao-channel.js
// v3.8.129: 카카오톡 채널 (비즈니스 채널) — 친구 추가한 사람에게 발송하는 소식 게시물.
// 헤드라인(40자) + 본문(150~250자) + 더보기 버튼 라벨(10자) → 외부 URL 형태.

'use strict';

const { makeChannel } = require('../_shared/channel-factory');
const { appendUserNoteSafely } = require('../../_shared/sanitize');

const KAKAO_CHANNEL_BANNED = [
  '제 블로그', '방문해주세요', '구독 부탁', '홍보',
  '바로 클릭', '지금 신청', '100% 보장', '무조건',
  '여러분', '안녕하세요 여러분', '~을(를) 추천합니다',
  '광고', '협찬',
];

module.exports = makeChannel({
  id: 'kakao-channel',
  name: '카카오톡 채널',
  category: 'messenger',
  riskTier: 'medium',
  confidence: 'verified',
  icon: '💛',
  color: '#fee500',
  openUrl: 'https://center-pf.kakao.com/',

  killerHookPatterns: [
    '이거 모르고 일반 적금 든 사람 = 매년 400만원 손해',
    '친구 통장에 매달 30만원 더 들어온다',
    '월급 적은 사람이 오히려 유리한 적금이 있다',
    '청년인데 이거 안 한 거? 3년 동안 1,200만원 손해',
    '은행원도 잘 안 알려주는 정부 적금이 있다',
  ],
  bannedPhrases: KAKAO_CHANNEL_BANNED,
  popularityTriggers: [
    '40자 이내 충격 헤드라인',
    '본문 150~250자 짧고 강하게',
    '더보기 버튼 라벨 10자 이내 (행동 유도)',
    '본문에서 정보 다 풀지 말 것 — 클릭으로만 확인',
  ],
  toneSignature: {
    formality: 'polite',
    emoji: 'minimal',
    slang: [],
    pronouns: ['저', '많은 분'],
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
    const base = `당신은 카카오톡 비즈니스 채널 운영자입니다. 친구 추가한 구독자에게 발송하는 "소식(포스트)" 게시물을 작성합니다.

[카카오톡 채널 게시물 구조 — 반드시 지키세요]
- 헤드라인: 30~40자, 카카오톡 알림에 잘리지 않게 강한 후크 1줄
- 본문: 150~250자 (짧을수록 클릭률↑, 길면 스킵됨)
- 더보기 버튼 라벨: 5~10자 (예: "전체 글 보기", "조건 확인", "자가진단", "신청 방법 보기")
- 본문 끝 + 버튼 라벨 다음에 URL 1개만

[1단계: 원문 심층 분석 (글 작성 전 머리에서만)]
1. 원문이 던지는 가장 강한 충격 수치/사실 1개를 찾음
2. 구독자가 "어? 진짜?" 또는 "나도 해당되나?" 반응할 포인트 식별
3. 헤드라인용 후크 1개 결정 (충격 수치 / 자기의심 / 통념 박살 / 비밀 강조 / 손실회피 중 택1)
4. 본문에 풀 미끼 정보 vs 링크에서만 확인할 정보 분리

[2단계: 미끼·티저 (필수)]
✅ 본문에 풀어줄: 누가 대략(20~34세 청년 등), 충격 수치 1개(1,440만원 등), 왜 지금(올해 조건 완화 등)
❌ 본문 금지(링크에서만): 정확한 신청 조건, 단계별 방법, 정확한 금액 계산, "내 케이스 해당 여부"
✅ 본문 마지막 줄: "본인 케이스 해당되는지는 자가진단으로 확인해보세요" 같은 cliffhanger

[3단계: 금지]
- "여러분", "안녕하세요 여러분" 같은 단체 인사 (카톡 알림 톤과 안 맞음)
- "100% 보장", "무조건", "바로 클릭" 같은 광고 어휘 (카카오 채널 가이드 위반 위험)
- 본문 200자 초과 (스크롤 부담)
- 헤드라인 40자 초과 (알림에서 잘림)
- 원문에 없는 금액·조건 만들어내기

[A/B/C 변형]
A안 충격수치형: 헤드라인에 충격 수치 + 본문은 짧은 시나리오
B안 자기의심형: 헤드라인에 "나만 몰랐다" 톤 + 본문은 비교
C안 손실회피형: 헤드라인에 "이거 안 하면 손해" + 본문은 구체 손실액

[출력 형식 — 반드시 지키세요]
JSON, 코드블록, 부가 설명 절대 금지. 아래 형식 3개 출력:

===A안 (충격수치형)===
[헤드라인] (30~40자)
[본문] (150~250자, 마지막 줄에 cliffhanger)
[버튼라벨] (5~10자)
[URL] ${'$'}{원본 URL}

===B안 (자기의심형)===
[헤드라인]
[본문]
[버튼라벨]
[URL] ${'$'}{원본 URL}

===C안 (손실회피형)===
[헤드라인]
[본문]
[버튼라벨]
[URL] ${'$'}{원본 URL}`;
    return appendUserNoteSafely(base, userCustomRule);
  },

  buildUserPrompt: ({ sourceSummary, sourceUrl, sourceTitle }) => {
    const summary = sourceSummary || {};
    const points = Array.isArray(summary.keyPoints) ? summary.keyPoints.join(', ') : '';
    const data = Array.isArray(summary.dataPoints) ? summary.dataPoints.join(', ') : '';
    return `원본 글: "${sourceTitle}"
URL: ${sourceUrl}

[원본 요약]
- 핵심 가치: ${summary.coreValue || ''}
- 주요 포인트: ${points}
- 수치/데이터: ${data}

카카오톡 채널 소식 게시물 A/B/C 3안을 모두 작성하세요. 헤드라인 30~40자, 본문 150~250자, 버튼라벨 5~10자, URL은 ${sourceUrl}.

본문에서 정보 다 풀지 마세요. 구독자가 "나도 해당되나?" 궁금증을 가지고 더보기 버튼을 누르도록 cliffhanger 필수.`;
  },

  userWarning: '카카오톡 채널은 친구 추가한 구독자에게만 발송됩니다. 발송 시 메시지 비용 발생 가능 (무료 발송 한도 후 유료). 카카오 비즈메시지 가이드 위반 시(과장 광고, 허위 정보) 채널 정지 가능 — 본문 내용은 반드시 원문에 근거.',
  operationalNotes: [
    '카카오톡 채널 게시물은 친구 추가한 구독자에게 푸시 알림으로 도달 — 헤드라인이 알림에서 잘리지 않게 40자 이내 필수',
    '본문이 길면 구독자가 "전체 보기" 누르지 않고 스킵 — 150~250자 권장',
    '더보기 버튼 라벨은 행동 유도형 ("자가진단", "신청 방법" 같은 구체 행동)이 클릭률 2~3배',
    '카카오 비즈메시지 발송 가이드: 광고 표현·과장·허위 정보 금지, 위반 시 채널 정지',
    '월간 무료 발송 한도 초과 시 건당 비용 발생 — 발송 빈도 조절 권장',
  ],
});
