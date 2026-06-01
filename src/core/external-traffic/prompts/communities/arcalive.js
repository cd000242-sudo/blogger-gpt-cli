'use strict';
const { makeCommunity } = require('./_community-base');

module.exports = makeCommunity({
  id: 'arcalive',
  name: '아카라이브',
  icon: '🌈',
  color: '#f59e0b',
  openUrl: 'https://arca.live/',
  riskTier: 'low',
  toneNote: '반말 + 채널별 어조 (홍보 채널은 마케팅 어투 허용)',
  popularityTriggers: ['컨텐츠 가치', '비교 표', '체크리스트'],
  bandThresholds: { low: 55, medium: 80, high: 92, critical: 100 },
  subChannels: [
    { id: 'b-hongbo', name: '/b/hongbo (자기 홍보 채널)', rule: '자기 홍보 명시 허용.' },
    { id: 'general', name: '일반 채널', rule: '진성 후기 또는 정보 공유.' },
    { id: 'other', name: '기타', rule: '사용자 입력 합성.' },
  ],
  userWarning: '아카라이브는 /b/hongbo 같은 자기 홍보 채널이 있어 상대적으로 안전. 다른 채널은 일반 커뮤니티 수준. R2 deep-research 채널별 규정·문화 1차 출처 미확보 — confidence: inferred.',
  operationalNotes: ['한국 침투바이럴 산업이 아카라이브를 정식 카테고리로 판매 (i-boss 검증)', '/b/hongbo 외 채널 규정은 채널별 매니저 재량'],
  researchSources: ['https://brunch.co.kr/@sparrowmill/110'],
});
