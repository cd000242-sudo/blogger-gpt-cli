'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'orbi', name: '오르비', icon: '📚', color: '#7c3aed',
  openUrl: 'https://orbi.kr/',
  domainNote: '입시·수능 학생 커뮤니티',
  toneNote: '존댓말 + 학생 어조 (선배·동기 호칭)',
  popularityTriggers: ['실제 성적표', '공부 루틴', '비교 정리'],
});
