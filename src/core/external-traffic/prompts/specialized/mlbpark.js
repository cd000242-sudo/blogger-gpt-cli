'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'mlbpark', name: 'MLBPARK', icon: '⚾', color: '#1e40af',
  openUrl: 'https://mlbpark.donga.com/',
  domainNote: '야구 (KBO·MLB) 팬덤 5년차',
  toneNote: '반말 + 야구 용어 (KBO 구단명·선수 등)',
  popularityTriggers: ['실측 스탯', '비교 표', '경기 후기'],
});
