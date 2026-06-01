'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'dogdrip',
  name: '개드립',
  icon: '🐶',
  color: '#10b981',
  openUrl: 'https://www.dogdrip.net/',
  riskTier: 'high',
  toneNote: '반말 + 유머 코드',
  popularityTriggers: ['유머 + 정보 결합', '짧은 후킹', '본인 경험'],
  subChannels: [
    { id: 'free', name: '자유', rule: '진성 후기.' },
    { id: 'humor', name: '유머', rule: '짧은 후킹.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: 'R2 deep-research 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R2 공식 정책 자료 미확보 — 운영자 재량에 의존'],
});
