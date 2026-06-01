'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'bobaedream', name: '보배드림', icon: '🚗', color: '#0f766e',
  openUrl: 'https://www.bobaedream.co.kr/',
  domainNote: '자동차 (차종·트림·옵션) 전문',
  toneNote: '반말 + 차종/트림 정확 표기 ("아반떼 N 라인 풀옵" 등)',
  popularityTriggers: ['실측 연비·옵션 비교', '차주 후기', '비교 표'],
});
