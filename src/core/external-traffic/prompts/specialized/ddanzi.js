'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'ddanzi', name: '딴지일보', icon: '🗞️', color: '#b45309',
  openUrl: 'https://www.ddanzi.com/',
  domainNote: '시사·정치 풍자 커뮤니티',
  toneNote: '풍자체 + 시사 코드',
  popularityTriggers: ['풍자', '시사 인사이트', '비교 정리'],
});
