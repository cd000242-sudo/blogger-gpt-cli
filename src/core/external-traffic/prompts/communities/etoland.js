'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'etoland',
  name: '이토랜드',
  icon: '🏞️',
  color: '#0891b2',
  openUrl: 'https://www.etoland.co.kr/',
  riskTier: 'high',
  toneNote: '반말 + 부드러운 어미',
  popularityTriggers: ['진성 후기', '본인 경험', '비교 표'],
  subChannels: [
    { id: 'free', name: '자유 게시판', rule: '진성 후기.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: 'R2 deep-research 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R2 공식 정책 자료 미확보 — 운영자 재량에 의존'],
});
