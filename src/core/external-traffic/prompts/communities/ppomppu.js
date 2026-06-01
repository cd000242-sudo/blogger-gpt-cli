'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'ppomppu',
  name: '뽐뿌',
  icon: '🛒',
  color: '#dc2626',
  openUrl: 'https://www.ppomppu.co.kr/',
  riskTier: 'high',
  toneNote: '존댓말 + 회원 친화',
  popularityTriggers: ['실제 구매 후기', '가격 비교', '체크리스트'],
  subChannels: [
    { id: 'free', name: '자유 게시판', rule: '진성 후기.' },
    { id: 'humor', name: '유머', rule: '짧은 후킹.' },
    { id: 'ppomppu', name: '뽐뿌 (쇼핑)', rule: '실측 가격·후기.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: '뽐뿌 자기 홍보 정지 사례 있음 (한국 마케터 회고 — 영업비밀로 디테일 비공개). 진성 후기 톤 필수. R2 deep-research에서 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['한국 침투바이럴 산업이 뽐뿌를 정식 카테고리로 판매 (i-boss 검증)', 'R2 공식 약관·정지 사례 1차 출처 미확보'],
  researchSources: ['https://brunch.co.kr/@sparrowmill/110'],
});
