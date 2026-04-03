const { analyzeContentTopics, recommendCTAs, addAutoCTAs } = require('./src/content-generators.ts');

// 다양한 주제별 테스트 콘텐츠
const testContents = [
  {
    title: '크리스마스 선물 준비하기',
    content: `
<h1>크리스마스 선물 준비하기</h1>
<h2>크리스마스 선물 추천</h2>
<p>크리스마스에 줄 선물을 추천합니다. 쇼핑몰에서 다양한 선물을 볼 수 있어요.</p>
<h2>크리스마스 여행 계획</h2>
<p>크리스마스 여행지 추천과 예약 방법을 안내합니다.</p>
<h2>크리스마스 음식 레시피</h2>
<p>크리스마스 파티 음식 만드는 법을 알려드립니다.</p>
`
  },
  {
    title: '여행 계획 세우기',
    content: `
<h1>여행 계획 세우기</h1>
<h2>항공권 예매 방법</h2>
<p>비행기 티켓을 싸게 예매하는 방법을 알아보세요.</p>
<h2>숙박 예약 팁</h2>
<p>호텔과 모텔 예약 시 주의사항과 추천 사이트를 소개합니다.</p>
<h2>렌터카 이용하기</h2>
<p>여행지에서 차를 빌리는 방법과 유의사항.</p>
`
  },
  {
    title: '쇼핑 가이드',
    content: `
<h1>최고의 쇼핑 경험</h1>
<h2>온라인 쇼핑몰 추천</h2>
<p>쿠팡, 네이버 쇼핑 등 인기 쇼핑몰을 비교해보세요.</p>
<h2>가격 비교하기</h2>
<p>다나와에서 최저가 상품을 찾는 방법을 알려드립니다.</p>
<h2>배송 서비스</h2>
<p>빠른 배송을 제공하는 서비스들을 소개합니다.</p>
`
  },
  {
    title: '건강 관리 방법',
    content: `
<h1>건강한 생활을 위해</h1>
<h2>병원 예약하기</h2>
<p>병원 진료 예약 방법과 유의사항을 알아보세요.</p>
<h2>피트니스 시작하기</h2>
<p>헬스장 등록과 운동 방법 안내.</p>
<h2>다이어트 식단</h2>
<p>건강한 식단으로 체중 감량하는 방법.</p>
`
  },
  {
    title: '프로그래밍 공부하기',
    content: `
<h1>프로그래밍 입문 가이드</h1>
<h2>온라인 강의 추천</h2>
<p>인프런과 패스트캠퍼스에서 좋은 강의를 들을 수 있어요.</p>
<h2>코딩 테스트 준비</h2>
<p>프로그래밍 면접을 위한 코딩 테스트 준비 방법.</p>
<h2>개발 도구</h2>
<p>필요한 개발 환경과 도구들을 소개합니다.</p>
`
  }
];

console.log('🎯 범용 CTA 자동생성 시스템 테스트\n');

testContents.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 테스트 케이스 ${index + 1}: ${testCase.title}`);
  console.log(`${'='.repeat(60)}\n`);

  // 콘텐츠 분석
  const analysis = analyzeContentTopics(testCase.content);
  console.log('🔍 콘텐츠 분석 결과:');
  console.log(`   주제: ${analysis.mainTopic}`);
  console.log(`   소제목: ${analysis.subTopics.slice(0, 3).join(', ')}`);
  console.log(`   키워드: ${analysis.keywords.slice(0, 5).join(', ')}\n`);

  // CTA 추천
  const recommendations = recommendCTAs(analysis);
  console.log('🎯 CTA 추천 결과:');
  recommendations.slice(0, 5).forEach((rec: any, i: number) => {
    console.log(`   ${i+1}. ${rec.query} (${rec.intent}) - 우선순위: ${rec.priority}`);
  });

  // CTA 적용된 콘텐츠 생성
  const contentWithCTA = addAutoCTAs(testCase.content);
  const ctaCount = (contentWithCTA.match(/<section class="ln-cta"/g) || []).length;

  console.log(`\n✅ 최종 결과: ${ctaCount}개의 CTA 자동 추가됨`);

  // CTA 미리보기 (첫 번째 CTA만)
  const firstCTAStart = contentWithCTA.indexOf('<section class="ln-cta"');
  if (firstCTAStart !== -1) {
    const firstCTAEnd = contentWithCTA.indexOf('</section>', firstCTAStart) + 10;
    const firstCTA = contentWithCTA.substring(firstCTAStart, firstCTAEnd);
    console.log('\n📋 첫 번째 CTA 미리보기:');
    console.log(firstCTA.replace(/<[^>]+>/g, '').trim().split('\n').slice(0, 3).join('\n'));
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log('🎉 범용 CTA 자동생성 시스템 테스트 완료!');
console.log(`${'='.repeat(60)}\n`);
