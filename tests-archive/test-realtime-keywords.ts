/**
 * 실시간 이슈 검색어 수집 테스트 스크립트
 */

import { getDaumRealtimeKeywordsWithPuppeteer } from './src/utils/daum-realtime-api';

async function testRealtimeKeywords() {
  console.log('='.repeat(60));
  console.log('실시간 이슈 검색어 수집 테스트 시작');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('📡 Daum 실시간 검색어 수집 중...');
    console.log('   (이 작업은 몇 초 정도 소요될 수 있습니다)');
    console.log('');
    
    const keywords = await getDaumRealtimeKeywordsWithPuppeteer(20);
    
    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ 수집 완료: 총 ${keywords.length}개 키워드`);
    console.log('='.repeat(60));
    console.log('');
    
    if (keywords.length === 0) {
      console.log('⚠️ 수집된 키워드가 없습니다.');
      console.log('   - Daum 페이지 구조가 변경되었을 수 있습니다.');
      console.log('   - 네트워크 문제일 수 있습니다.');
      console.log('   - Puppeteer 브라우저 실행 문제일 수 있습니다.');
      return;
    }
    
    console.log('📋 수집된 실시간 이슈 검색어:');
    console.log('');
    
    keywords.forEach((item, index) => {
      console.log(`  ${String(index + 1).padStart(2, ' ')}. [${item.rank}위] ${item.keyword}`);
    });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('📊 통계:');
    console.log(`   - 총 키워드 수: ${keywords.length}개`);
    if (keywords.length > 0) {
      const avgLength = Math.round(keywords.reduce((sum, k) => sum + k.keyword.length, 0) / keywords.length);
      const maxKeyword = keywords.reduce((max, k) => k.keyword.length > max.keyword.length ? k : max, keywords[0]);
      const minKeyword = keywords.reduce((min, k) => k.keyword.length < min.keyword.length ? k : min, keywords[0]);
      console.log(`   - 평균 키워드 길이: ${avgLength}자`);
      console.log(`   - 최장 키워드: "${maxKeyword.keyword}" (${maxKeyword.keyword.length}자)`);
      console.log(`   - 최단 키워드: "${minKeyword.keyword}" (${minKeyword.keyword.length}자)`);
    }
    console.log('='.repeat(60));
    
    // 키워드 샘플 분석
    if (keywords.length > 0) {
      console.log('');
      console.log('🔍 키워드 샘플 분석 (상위 5개):');
      console.log('');
      const sampleKeywords = keywords.slice(0, 5);
      sampleKeywords.forEach((item, index) => {
        console.log(`  샘플 ${index + 1}: "${item.keyword}"`);
        console.log(`    - 순위: ${item.rank}위`);
        console.log(`    - 길이: ${item.keyword.length}자`);
        console.log(`    - 단어 수: ${item.keyword.split(/\s+/).length}개`);
        console.log('');
      });
    }
    
  } catch (error: any) {
    console.error('');
    console.error('❌ 오류 발생:');
    console.error(error?.message || error);
    console.error('');
    if (error?.stack) {
      console.error('스택 트레이스:');
      console.error(error.stack);
    }
  }
}

// 스크립트 실행
testRealtimeKeywords()
  .then(() => {
    console.log('');
    console.log('✅ 테스트 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });









