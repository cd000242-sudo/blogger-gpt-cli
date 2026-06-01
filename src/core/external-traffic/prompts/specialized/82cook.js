'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: '82cook', name: '82쿡', icon: '🍳', color: '#ec4899',
  openUrl: 'https://www.82cook.com/',
  domainNote: '주부·여성 라이프스타일',
  riskTier: 'out-of-scope',
  toneNote: '존댓말 + 주부 어조 ("저", "회원님")',
  popularityTriggers: ['실생활 후기', '가정 살림 비교', '체크리스트'],
  userWarning: '82쿡은 신규 가입 폐쇄 (마케터 회고 — 정확한 폐쇄 시점은 R4 deep-research에서 1차 출처 미확보). 기존 회원만 사용 가능. 본 도구는 비추천 — 결과 그대로 사용 시 위험.',
  operationalNotes: ['R4 deep-research에서 가입 폐쇄 정확 시점·정지 사례 1차 출처 미확보 — 운영자 재량에 의존'],
});
