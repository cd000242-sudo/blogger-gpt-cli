'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'dotax',
  name: '도탁스',
  icon: '🎲',
  color: '#7c3aed',
  openUrl: 'https://www.dotax.co.kr/',
  riskTier: 'high',
  toneNote: '반말 + 게이머/도탁스 코드',
  popularityTriggers: ['게임 도메인 지식', '본인 플레이', '비교 표'],
  subChannels: [
    { id: 'free', name: '자유 게시판', rule: '진성 후기.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: 'R2 deep-research 약관·정지 사례 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['R2 공식 정책 자료 미확보 — 게임 갤러리 비틱 규정 일반 적용 권장'],
});
