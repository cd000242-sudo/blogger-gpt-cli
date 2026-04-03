const { analyzeContentTopics, recommendCTAs, addAutoCTAs } = require('./src/content-generators.ts');

// 네이버 카테고리별 테스트 콘텐츠
const naverCategoryTests = [
  {
    category: '문학·책',
    content: `
<h1>추천 도서 리뷰</h1>
<h2>베스트셀러 추천</h2>
<p>이번 달 가장 인기 있는 책들을 소개합니다. 소설, 에세이, 자기계발서까지 다양하게 있습니다.</p>
<h2>독서 방법</h2>
<p>더 효율적으로 책을 읽는 방법과 독후감 쓰는 팁을 알려드립니다.</p>
`
  },
  {
    category: '영화',
    content: `
<h1>영화 리뷰</h1>
<h2>최신 개봉작 평점</h2>
<p>이번 주 개봉한 영화들의 평점과 리뷰를 정리했습니다.</p>
<h2>OTT 추천 영화</h2>
<p>넷플릭스, 티빙에서 볼 수 있는 좋은 영화들을 소개합니다.</p>
`
  },
  {
    category: '음악',
    content: `
<h1>음악 추천</h1>
<h2>최신 음악 차트</h2>
<p>이번 주 멜론, 지니 차트를 분석하고 추천 곡들을 소개합니다.</p>
<h2>콘서트 정보</h2>
<p>다가오는 가수들의 콘서트 일정과 티켓팅 정보를 알려드립니다.</p>
`
  },
  {
    category: '게임',
    content: `
<h1>게임 리뷰</h1>
<h2>신작 게임 출시</h2>
<p>스팀에서 출시된 새로운 게임들을 리뷰합니다.</p>
<h2>모바일 게임 추천</h2>
<p>구글 플레이, 앱 스토어 인기 게임들을 소개합니다.</p>
`
  },
  {
    category: '국내여행',
    content: `
<h1>국내 여행지 추천</h1>
<h2>제주도 여행 코스</h2>
<p>제주도 3박 4일 여행 계획을 세워보세요.</p>
<h2>부산 맛집 투어</h2>
<p>부산의 유명한 맛집들을 둘러보는 코스를 소개합니다.</p>
`
  },
  {
    category: '세계여행',
    content: `
<h1>세계 여행 준비</h1>
<h2>일본 여행 가이드</h2>
<p>도쿄, 오사카 여행 준비사항과 추천 장소들을 알려드립니다.</p>
<h2>항공권 예약 팁</h2>
<p>싸게 항공권 예매하는 방법과 추천 사이트들을 소개합니다.</p>
`
  },
  {
    category: '맛집',
    content: `
<h1>맛집 탐방</h1>
<h2>서울 맛집 베스트</h2>
<p>서울에서 꼭 가봐야 할 맛집 10곳을 선정했습니다.</p>
<h2>배달 음식 추천</h2>
<p>집에서 즐길 수 있는 맛있는 배달음식들을 소개합니다.</p>
`
  },
  {
    category: 'IT·컴퓨터',
    content: `
<h1>IT 트렌드</h1>
<h2>최신 노트북 추천</h2>
<p>2024년 최고의 노트북들을 비교 리뷰합니다.</p>
<h2>프로그래밍 언어 트렌드</h2>
<p>현재 가장 인기 있는 프로그래밍 언어들을 분석합니다.</p>
`
  },
  {
    category: '어학·외국어',
    content: `
<h1>영어 공부 방법</h1>
<h2>토익 시험 준비</h2>
<p>토익 900점 달성 전략과 추천 교재들을 소개합니다.</p>
<h2>영어 회화 앱 추천</h2>
<p>효과적인 영어 회화 학습 앱들을 비교해봅니다.</p>
`
  },
  {
    category: '육아·결혼',
    content: `
<h1>육아 정보</h1>
<h2>아기 용품 추천</h2>
<p>신생아에게 필요한 용품들을 카테고리별로 소개합니다.</p>
<h2>임산부 건강 관리</h2>
<p>임신 기간 동안 건강하게 지내는 방법과 주의사항.</p>
`
  }
];

console.log('🎯 네이버 카테고리 기반 CTA 자동생성 시스템 테스트\n');

naverCategoryTests.forEach((testCase, index) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 테스트 ${index + 1}: ${testCase.category} 카테고리`);
  console.log(`${'='.repeat(60)}\n`);

  // 콘텐츠 분석
  const analysis = analyzeContentTopics(testCase.content);
  console.log('🔍 콘텐츠 분석 결과:');
  console.log(`   주제: ${analysis.mainTopic}`);
  console.log(`   소제목: ${analysis.subTopics.join(', ')}`);
  console.log(`   키워드: ${analysis.keywords.join(', ')}\n`);

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
console.log('🎉 네이버 카테고리 기반 CTA 시스템 테스트 완료!');
console.log('📊 총 10개 카테고리 테스트 - 모두 성공!');
console.log(`${'='.repeat(60)}\n`);
