'use strict';
const { makeSpecialized } = require('./_specialized-base');
module.exports = makeSpecialized({
  id: 'quasarzone', name: '퀘이사존', icon: '💻', color: '#1e293b',
  openUrl: 'https://quasarzone.com/',
  domainNote: 'IT 하드웨어 (CPU·GPU·메인보드) 전문',
  toneNote: '반말 + 벤치마크 수치·모델명 정확',
  popularityTriggers: ['벤치마크', '실측 전력·온도', '가격대비 성능'],
});
