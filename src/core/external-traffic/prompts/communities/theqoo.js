'use strict';
// R2 deep-research (2026-06-01) verified — 약관 1차 출처 확보. 30K 포인트는 운영 내규로 추정.

const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'theqoo',
  name: '더쿠',
  icon: '💜',
  color: '#9333ea',
  openUrl: 'https://theqoo.net/',
  riskTier: 'critical',
  confidence: 'verified',

  toneNote: '존댓말 + "ㅎㅎ", "ㅜㅜ" 부드러운 어미. 진성 후기 톤.',
  popularityTriggers: ['감성 후킹', '본인 후기', '비교 정리', '여성 베이스 코드'],
  bandThresholds: { low: 20, medium: 45, high: 70, critical: 88 },
  bannedPhrases: ['홍보', '광고', '협찬', '프로모션'],
  subChannels: [
    { id: 'general', name: '일반 게시판', rule: '진성 후기 톤. 30K 포인트 진입 장벽 (운영 내규).' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: '더쿠 약관 제5조 2항·12조 2항에 회사 재량 임시차단·자격 정지 명시. 외부링크/자기홍보는 약관 본문에 직접 명시 없이 \'공지사항 이용지침\'으로 위임 — 운영진 재량 폭 크다. 30K 포인트 진입 장벽 (운영 내규 추정). 가입 직후 게시 절대 X.',
  operationalNotes: [
    '약관 제10조 1항·12조: 구체 금지행위는 공지사항 이용지침으로 위임',
    '약관 제5조 2항: 회사가 공개 게시물 임시차단·이동·삭제 재량 집행',
    '약관 제12조 2항: 회원자격 제한·정지·상실 재량 집행',
    '약관 제10조 6호: "광고성 정보 지속 전송"은 스팸 차원 제한 (자기홍보 직접 금지 X)',
    '30K 포인트 진입 장벽은 운영 내규로 추정 — 약관 미명시',
  ],
  researchSources: [
    'https://theqoo.net/service',
    'https://theqoo.net/service/2382669428',
  ],
});
