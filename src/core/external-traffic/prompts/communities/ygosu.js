'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'ygosu',
  name: '와이고수',
  icon: '🎯',
  color: '#ea580c',
  openUrl: 'https://www.ygosu.com/',
  riskTier: 'high',
  toneNote: '반말 + 자유 분위기',
  popularityTriggers: ['반전', '본인 후기', '논쟁'],
  subChannels: [
    { id: 'free', name: '자유 게시판', rule: '진성 후기.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: 'R2 deep-research 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R2 공식 정책 자료 미확보 — 운영자 재량에 의존'],
});
