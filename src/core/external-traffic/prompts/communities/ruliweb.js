'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'ruliweb',
  name: '루리웹',
  icon: '🎮',
  color: '#0ea5e9',
  openUrl: 'https://www.ruliweb.com/',
  riskTier: 'critical',
  toneNote: '존댓말 + 게이머/오타쿠 코드',
  popularityTriggers: ['게임/애니 도메인 지식', '실측 데이터', '본인 플레이 후기'],
  bannedPhrases: ['유료 홍보'],
  subChannels: [
    { id: 'general', name: '일반 게시판', rule: '진성 후기.' },
    { id: 'gaming', name: '게임 게시판', rule: '도메인 지식 필수.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: '루리웹은 유료 홍보 게시 영구정지 사례 (한국 마케터 회고). 비유료도 자기 글 인용은 신고 위험. R2 deep-research 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['한국 침투바이럴 산업이 루리웹을 정식 카테고리로 판매 (i-boss 검증)', 'R2 공식 약관 1차 출처 미확보'],
  researchSources: ['https://brunch.co.kr/@sparrowmill/110'],
});
