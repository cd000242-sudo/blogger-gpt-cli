/**
 * 네이버 블로그 분석기 테스트 스크립트
 * 실제 네이버 블로그 URL로 테스트하여 정확성 검증
 */

import { BlogAnalyzer, NaverBlogSearchAPI, DateProcessor } from './src/utils/naver-blog-analyzer';
import { EnvironmentManager } from './src/utils/environment-manager';
import * as fs from 'fs';
import * as path from 'path';

// 테스트용 샘플 블로그 URL들 (실제 네이버 블로그)
const TEST_KEYWORDS = [
  '연말정산',
  '주식투자',
  '맛집추천',
  '여행',
  '블로그',
];

const TEST_BLOG_URLS = [
  'https://blog.naver.com/sample1', // 실제 테스트용 URL로 교체 필요
  'https://blog.naver.com/sample2',
];

interface TestResult {
  keyword: string;
  success: boolean;
  blogsAnalyzed: number;
  blogsWithDates: number;
  blogsWithStats: number;
  dateAccuracy: number; // 작성일 정확도 (%)
  statsAccuracy: number; // 통계 정확도 (%)
  errors: string[];
  details: Array<{
    title: string;
    url: string;
    postDate: string | null;
    postDateFromAPI: string | null;
    dateMatch: boolean;
    blogIndex: number | null;
    visitors: number | null;
    statsCollected: boolean;
  }>;
}

/**
 * 테스트 실행
 */
async function runTests() {
  console.log('🧪 네이버 블로그 분석기 테스트 시작\n');
  console.log('='.repeat(80));

  // 환경 변수에서 API 키 로드
  const envManager = EnvironmentManager.getInstance();
  const config = envManager.getConfig();
  
  const naverClientId = config.naverClientId || process.env['NAVER_CLIENT_ID'];
  const naverClientSecret = config.naverClientSecret || process.env['NAVER_CLIENT_SECRET'];

  if (!naverClientId || !naverClientSecret) {
    console.error('❌ 네이버 API 키가 설정되지 않았습니다!');
    console.log('환경 변수 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 설정하거나');
    console.log('환경 설정에서 네이버 API 키를 입력하세요.');
    process.exit(1);
  }

  console.log(`✅ 네이버 API 키 확인됨: ${naverClientId.substring(0, 8)}...`);
  console.log('');

  const analyzer = new BlogAnalyzer({
    clientId: naverClientId,
    clientSecret: naverClientSecret
  });

  const results: TestResult[] = [];

  // 각 키워드에 대해 테스트
  for (const keyword of TEST_KEYWORDS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 키워드 테스트: "${keyword}"`);
    console.log('='.repeat(80));

    try {
      // 블로그 분석 실행
      const analysis = await analyzer.analyze(keyword, 10, true);

      const testResult: TestResult = {
        keyword,
        success: true,
        blogsAnalyzed: analysis.analyzedBlogs.length,
        blogsWithDates: 0,
        blogsWithStats: 0,
        dateAccuracy: 0,
        statsAccuracy: 0,
        errors: [],
        details: []
      };

      console.log(`\n📊 분석 결과:`);
      console.log(`   - 총 검색 결과: ${analysis.totalResults.toLocaleString()}개`);
      console.log(`   - 분석한 블로그: ${analysis.analyzedBlogs.length}개`);
      console.log(`   - 통계 수집 성공률: ${analysis.statsSuccessRate.toFixed(1)}%`);

      // 각 블로그 상세 분석
      for (const blog of analysis.analyzedBlogs) {
        console.log(`\n   [${blog.rank}] ${blog.title}`);
        console.log(`      🔗 ${blog.link}`);
        console.log(`      📅 작성일: ${blog.postDateFormatted} (${blog.timeAgo})`);
        console.log(`      ⏱️  경과: ${blog.daysAgo}일 전 / ${blog.hoursAgo}시간 전`);

        // 작성일 검증
        const hasDate = blog.postDate && blog.postDateFormatted;
        if (hasDate) {
          testResult.blogsWithDates++;
          
          // 작성일 정확성 검증
          const now = new Date();
          const daysDiff = Math.floor((now.getTime() - blog.postDate.getTime()) / (1000 * 60 * 60 * 24));
          const dateAccuracy = Math.abs(daysDiff - blog.daysAgo) <= 1; // 1일 오차 허용
          
          if (!dateAccuracy) {
            testResult.errors.push(`작성일 불일치: ${blog.title} - 계산: ${daysDiff}일, 실제: ${blog.daysAgo}일`);
            console.log(`      ⚠️  작성일 검증 실패: 계산값 ${daysDiff}일 vs 실제 ${blog.daysAgo}일`);
          } else {
            console.log(`      ✅ 작성일 검증 성공`);
          }
        } else {
          testResult.errors.push(`작성일 없음: ${blog.title}`);
          console.log(`      ❌ 작성일 없음`);
        }

        // 통계 검증
        if (blog.statsCollected && blog.stats) {
          testResult.blogsWithStats++;
          console.log(`      📈 블로그 통계:`);
          
          if (blog.stats.blogIndex) {
            console.log(`         - 블로그 지수: ${blog.stats.blogIndex.toLocaleString()}`);
          }
          if (blog.stats.visitors) {
            console.log(`         - 일일 방문자: ${blog.stats.visitors.toLocaleString()}명`);
          }
          if (blog.stats.totalVisitors) {
            console.log(`         - 누적 방문자: ${blog.stats.totalVisitors.toLocaleString()}명`);
          }
          if (blog.stats.totalPosts) {
            console.log(`         - 총 포스트: ${blog.stats.totalPosts.toLocaleString()}개`);
          }
          if (blog.stats.follower) {
            console.log(`         - 이웃/구독자: ${blog.stats.follower.toLocaleString()}명`);
          }

          // 통계 값 검증
          if (blog.stats.blogIndex && blog.stats.blogIndex > 0) {
            console.log(`         ✅ 블로그 지수 수집 성공`);
          } else {
            testResult.errors.push(`블로그 지수 없음: ${blog.title}`);
            console.log(`         ⚠️  블로그 지수 없음`);
          }
        } else {
          console.log(`      ⚠️  통계 수집 실패`);
          testResult.errors.push(`통계 수집 실패: ${blog.title}`);
        }

        testResult.details.push({
          title: blog.title,
          url: blog.link,
          postDate: blog.postDateFormatted,
          postDateFromAPI: blog.postDate ? blog.postDate.toISOString() : null,
          dateMatch: hasDate ? Math.abs(Math.floor((new Date().getTime() - blog.postDate.getTime()) / (1000 * 60 * 60 * 24)) - blog.daysAgo) <= 1 : false,
          blogIndex: blog.stats?.blogIndex || null,
          visitors: blog.stats?.visitors || null,
          statsCollected: blog.statsCollected
        });
      }

      // 정확도 계산
      if (testResult.blogsAnalyzed > 0) {
        testResult.dateAccuracy = (testResult.blogsWithDates / testResult.blogsAnalyzed) * 100;
        testResult.statsAccuracy = (testResult.blogsWithStats / testResult.blogsAnalyzed) * 100;
      }

      results.push(testResult);

      // API 호출 간격 조절
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.error(`\n❌ 키워드 "${keyword}" 테스트 실패:`, error.message);
      results.push({
        keyword,
        success: false,
        blogsAnalyzed: 0,
        blogsWithDates: 0,
        blogsWithStats: 0,
        dateAccuracy: 0,
        statsAccuracy: 0,
        errors: [error.message || String(error)],
        details: []
      });
    }
  }

  // 최종 결과 출력
  console.log(`\n\n${'='.repeat(80)}`);
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(80));

  let totalBlogs = 0;
  let totalWithDates = 0;
  let totalWithStats = 0;
  let totalDateAccuracy = 0;
  let totalStatsAccuracy = 0;
  let totalErrors: string[] = [];

  results.forEach(result => {
    console.log(`\n키워드: "${result.keyword}"`);
    console.log(`  ✅ 성공: ${result.success ? '예' : '아니오'}`);
    console.log(`  📝 분석한 블로그: ${result.blogsAnalyzed}개`);
    console.log(`  📅 작성일 수집: ${result.blogsWithDates}개 (${result.dateAccuracy.toFixed(1)}%)`);
    console.log(`  📈 통계 수집: ${result.blogsWithStats}개 (${result.statsAccuracy.toFixed(1)}%)`);
    
    if (result.errors.length > 0) {
      console.log(`  ⚠️  오류: ${result.errors.length}개`);
      result.errors.forEach(err => console.log(`     - ${err}`));
    }

    totalBlogs += result.blogsAnalyzed;
    totalWithDates += result.blogsWithDates;
    totalWithStats += result.blogsWithStats;
    totalDateAccuracy += result.dateAccuracy;
    totalStatsAccuracy += result.statsAccuracy;
    totalErrors.push(...result.errors);
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 전체 통계');
  console.log('='.repeat(80));
  console.log(`총 분석한 블로그: ${totalBlogs}개`);
  console.log(`작성일 수집률: ${totalBlogs > 0 ? ((totalWithDates / totalBlogs) * 100).toFixed(1) : 0}%`);
  console.log(`통계 수집률: ${totalBlogs > 0 ? ((totalWithStats / totalBlogs) * 100).toFixed(1) : 0}%`);
  console.log(`평균 작성일 정확도: ${(totalDateAccuracy / results.length).toFixed(1)}%`);
  console.log(`평균 통계 정확도: ${(totalStatsAccuracy / results.length).toFixed(1)}%`);
  console.log(`총 오류: ${totalErrors.length}개`);

  // 결과를 JSON 파일로 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(process.cwd(), `test-results-${timestamp}.json`);
  
  fs.writeFileSync(resultFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalBlogs,
      totalWithDates,
      totalWithStats,
      dateAccuracy: totalBlogs > 0 ? ((totalWithDates / totalBlogs) * 100) : 0,
      statsAccuracy: totalBlogs > 0 ? ((totalWithStats / totalBlogs) * 100) : 0,
      totalErrors: totalErrors.length
    },
    results
  }, null, 2), 'utf-8');

  console.log(`\n💾 결과가 저장되었습니다: ${resultFile}`);

  // 오류가 있으면 상세 리포트 출력
  if (totalErrors.length > 0) {
    console.log(`\n⚠️  발견된 문제점:`);
    totalErrors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }

  console.log('\n✅ 테스트 완료!\n');
}

// 스크립트 실행
runTests().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});

