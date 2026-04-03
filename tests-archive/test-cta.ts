const { analyzeContentTopics, recommendCTAs, addAutoCTAs } = require('./src/content-generators');

// 테스트용 크리스마스 콘텐츠
const testContent = `
<h1>크리스마스 선물 준비하기</h1>
<h2>크리스마스 선물 추천</h2>
<p>크리스마스에 줄 선물을 추천합니다.</p>
<h2>크리스마스 여행 계획</h2>
<p>크리스마스 여행지 추천과 예약 방법을 안내합니다.</p>
<h2>크리스마스 음식 레시피</h2>
<p>크리스마스 파티 음식 만드는 법을 알려드립니다.</p>
`;

console.log('=== 콘텐츠 분석 결과 ===');
const analysis = analyzeContentTopics(testContent);
console.log('주제:', analysis.mainTopic);
console.log('소제목:', analysis.subTopics);
console.log('키워드:', analysis.keywords);

console.log('\n=== CTA 추천 결과 ===');
const recommendations = recommendCTAs(analysis);
recommendations.forEach((rec: any, i: number) => {
  console.log(`${i+1}. ${rec.query} (${rec.intent}) - 우선순위: ${rec.priority}`);
});

console.log('\n=== CTA 추가된 콘텐츠 ===');
const contentWithCTA = addAutoCTAs(testContent, 3);
console.log(contentWithCTA.substring(contentWithCTA.length - 800)); // 끝부분만 출력
