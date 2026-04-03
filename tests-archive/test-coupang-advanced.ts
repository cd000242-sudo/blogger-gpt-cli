import { CoupangCrawler } from './src/core/coupang-crawler';

/**
 * AdvancedAutomator 기반 쿠팡 하이파이델리티 크롤링 테스트
 * 봇 탐지를 회피하기 위해 AdsPower 프로필과 ghost-cursor를 사용합니다.
 */
async function runTest() {
  const profileId = process.env.ADSPOWER_PROFILE_ID || 'your-profile-id'; // AdsPower 프로필 ID를 여기에 입력하세요 (또는 환경변수 사용)
  
  // 크롤링 대상 URL
  const TARGET_URL = 'https://link.coupang.com/a/d3lVwh';
  
  console.log(`🚀 Advanced Coupang Crawler 가동 시작...`);
  console.log(`📌 사용할 프로필 ID: ${profileId}`);
  console.log(`📦 크롤링 대상: ${TARGET_URL}`);
  
  const crawler = new CoupangCrawler(TARGET_URL);
  
  try {
    const result = await crawler.executeCrawl(profileId);
    
    if (result) {
      console.log('\n' + '='.repeat(60));
      console.log('🎉 Advanced 크롤링 성공적으로 완료!');
      console.log('='.repeat(60));
      console.log(`📦 상품명: ${result.title}`);
      console.log(`💰 가격: ${result.price}`);
      console.log(`⭐ 평점: ${result.rating} (${result.ratingCount})`);
      console.log(`🚚 배송: ${result.delivery}`);
      console.log(`🖼️ 총 수집 이미지: ${result.images.length}장`);
      console.log(`💾 다운로드된 이미지: ${result.downloadedImages.length}장`);
      console.log('='.repeat(60));
    }
  } catch (err: any) {
    console.error('\n❌ 크롤링 실패:', err.message);
  }
}

// 스크립트 실행
runTest();
