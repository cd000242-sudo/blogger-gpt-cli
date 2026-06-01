'use strict';
// R2 deep-research (2026-06-01) verified — 약관 + 개념글 + 대형갤 제목 패턴 1차 출처 확보.

const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'dcinside',
  name: '디시인사이드',
  icon: '🎮',
  color: '#7d8a99',
  openUrl: 'https://www.dcinside.com/',
  riskTier: 'critical',
  confidence: 'verified',

  toneNote: '반말, "ㄹㅇ", "ㅁㅊ", "ㅇㅈ" 자음 약어. 명시적 추천 유도 ("개추 ㄱㄱ") 시 비추 폭탄.',

  // R2 verified: 디시 대형갤 개념글 제목 정형 패턴 (실시간베스트 1차 관찰, 10년+ 안정).
  killerHookPatterns: [
    '... 어그로 (말줄임표 도배)',
    '~.jpg (사진 첨부 어그로)',
    '실시간 ~ 정리',
    '~ 근황 ㅗㅜㅑ',
    '~ 대참사',
    '~ 뭐냐?',
    'ㄹㅇ ~ 인 거임?',
    '~ 한 사람 손',
    '갤주 ~ 알려줌',
    '솔직히 ~ 이거 모르면 ㅁㅊ',
  ],
  // R2 verified: 명시적 추천 유도 / 흔한 마케팅 카피 / 자랑글 패턴.
  bannedPhrases: [
    '개추 ㄱㄱ',           // 명시적 추천 유도 → 비추 폭탄 (디시 문화)
    '개추 부탁',
    '추천 좀',
    '정보 공유 차원에서', // 흔한 위장 — 운영진 학습됨
    '자랑',                 // 비틱 = 게임 갤러리 명시 정지
    '뽑기 결과',           // 게임 갤 자랑 차단 패턴
    '리뷰 부탁',
    '협찬',
  ],
  popularityTriggers: [
    '반전 정보 (망한 메이저갤 추천 10+조작 가능)',
    '실측 데이터',
    '비교 표 (.jpg 첨부)',
    '논쟁 유도',
    '관전 가치 (정치/연예/주식)',
  ],
  subChannelNote: '- 메인 갤러리: 추천 10+ 컷, IP당 1추천. 망한 메이저갤은 댓글 10 조작으로 진입 가능.\n- 마이너 갤러리: 매니저 컷 변동. 갤주 문화 동조 필수.\n- 인기 갤러리 (주식/연예/AI): 실시간 분위기 추적.\n- 게임 갤러리: 비틱 규정 명문화 (마비노기·블루아카·퍼디 등) — 자랑글 차단.',
  subChannels: [
    { id: 'main', name: '메인 활성 갤러리', rule: '추천 10+ 컷, IP당 1추천. 논쟁 유도 강화.' },
    { id: 'minor', name: '마이너 갤러리', rule: '매니저 컷 변동. 갤주 문화 동조.' },
    { id: 'hobby', name: '취미 갤러리', rule: '전문성·사진 필수.' },
    { id: 'game', name: '게임 갤러리 (블루아카·마비노기 등)', rule: '비틱 명문화 — 자랑글 절대 차단.' },
    { id: 'other', name: '기타 (직접 입력)', rule: '사용자 입력 합성.' },
  ],
  userWarning: '디시인사이드 약관 제12조 1항 8호 "광고/판촉물" 위반 시 임시차단→삭제→영구정지 3단계 제재. IP당 1추천 구조라 IP 차단 시 회복 어려움. 운영 노하우(5년+ 활동·고정닉) 없으면 사용 금지.',
  operationalNotes: [
    '약관 제12조 1항 8호: 광고/판촉물 게재 시 임시차단→삭제→정지',
    '게임 갤 비틱 규정 명문화 (마비노기·블루아카 등 2026-03 갱신)',
    '"개추 ㄱㄱ" 명시 추천 유도는 괘씸하다고 비추 폭탄',
    '망한 메이저갤은 추천 10~20+댓글 10 조작으로 개념글 진입 가능 (디시 갤러리 내부 노하우)',
    '대형갤 제목 정형: "...", ".jpg", "실시간", "근황", "ㅗㅜㅑ", "대참사"',
  ],
  researchSources: [
    'https://nstatic.dcinside.com/dc/m/policy/policy.html',
    'https://nstatic.dcinside.com/company/rules/service_policy.html',
    'https://namu.wiki/w/%EA%B0%9C%EB%85%90%EA%B8%80',
    'https://gall.dcinside.com/dcbest/3181',
  ],
});
