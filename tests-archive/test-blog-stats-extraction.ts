/**
 * 네이버 블로그 통계 추출 테스트 (실제 HTML 구조 확인)
 */

import { BlogStatsCrawler } from './src/utils/naver-blog-analyzer';
import * as fs from 'fs';
import * as path from 'path';

async function testBlogStatsExtraction() {
  console.log('🔍 네이버 블로그 통계 추출 테스트 시작\n');

  // 실제 네이버 블로그 URL 테스트 (테스트용)
  const testUrls = [
    'https://blog.naver.com/mission49',  // 연말정산 블로그
    'https://blog.naver.com/choibrian',  // 개인 사업자 블로그
    'https://blog.naver.com/kdjmoney',   // 홈택스 블로그
  ];

  const crawler = new BlogStatsCrawler();

  for (const url of testUrls) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`테스트 URL: ${url}`);
    console.log('='.repeat(80));

    try {
      const stats = await crawler.fetchBlogStats(url);
      
      if (stats) {
        console.log('✅ 통계 추출 성공!');
        console.log('  블로그 지수:', stats.blogIndex || '없음');
        console.log('  일일 방문자:', stats.visitors || '없음');
        console.log('  누적 방문자:', stats.totalVisitors || '없음');
        console.log('  총 포스트:', stats.totalPosts || '없음');
        console.log('  이웃/구독자:', stats.follower || '없음');
      } else {
        console.log('❌ 통계 추출 실패');
      }
    } catch (error: any) {
      console.error('❌ 오류:', error.message);
    }

    // API 호출 간격 조절
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ 테스트 완료!\n');
}

// 스크립트 실행
testBlogStatsExtraction().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});







