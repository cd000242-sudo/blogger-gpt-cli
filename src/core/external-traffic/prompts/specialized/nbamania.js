'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'nbamania', name: 'NBA매니아', icon: '🏀', color: '#dc2626',
  openUrl: 'https://www.nbamania.com/',
  domainNote: 'NBA·농구 팬덤 5년차',
  toneNote: '반말 + NBA 팀·선수명 영문 자연 사용',
  popularityTriggers: ['실측 스탯', '경기 분석', '비교'],
});
