'use strict';
// R2 deep-research 결과: 공개 자료 빈약 — 약관·정지 사례·포텐 패턴 1차 출처 미확보.
// confidence 'inferred' 유지. 한국 침투바이럴 산업이 FM을 정식 카테고리로 운영함은 verified.

const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'fmkorea',
  name: 'FM코리아',
  icon: '⚽',
  color: '#1e3a8a',
  openUrl: 'https://www.fmkorea.com/',
  riskTier: 'high',
  confidence: 'inferred',
  toneNote: '반말 + 표준어. "ㅇㅈ", "ㄹㅇ" 자음 약어 OK',
  popularityTriggers: ['포텐 트리거 (조회 10만+)', '리스트 1-2-3', '비교 표'],
  bannedPhrases: ['개추', '추천 좀', '협찬', '리뷰 부탁'],
  subChannelNote: '- 정치 게시판: 어조 첨예, 진영 코드\n- 유머 게시판: 짧은 후킹 + 반전\n- 일반/취미 게시판: 정보 70%\n- 블루아카이브 게시판: 비틱 규정 명문화 (2026-03 갱신)',
  subChannels: [
    { id: 'humor', name: '유머 게시판', rule: '짧은 후킹 + 반전.' },
    { id: 'politics', name: '정치 게시판', rule: '진영 코드 주의.' },
    { id: 'general', name: '일반/취미', rule: '정보 70%.' },
    { id: 'game', name: '게임 게시판 (블루아카 등)', rule: '비틱 명문화 — 자랑글 차단.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: 'FM코리아는 자기 홍보 정지 사례 다수 (한국 마케터 회고 — 디테일은 영업비밀). 포텐 글 패턴 학습 권장. R2 deep-research에서 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: [
    '한국 침투바이럴 산업이 FM을 \'에펨\' 카테고리로 정식 판매 (i-boss 검증)',
    '블루아카이브 등 게임 게시판 비틱 규정 명문화 (FM 9573525656 공지)',
    'R2 라운드 공식 약관·정지 사례 1차 출처 미확보 — 외부 신뢰 검증 한계',
  ],
  researchSources: [
    'https://www.fmkorea.com/9573525656',
    'https://brunch.co.kr/@sparrowmill/110',
  ],
});
