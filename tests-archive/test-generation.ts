import { loadEnvFromFile } from './src/env';
import { generateMaxModeArticle } from './src/core/index';
import type { RunOnePostPayload } from './src/core/index';
import * as fs from 'fs';
import * as path from 'path';

async function testArticleGeneration() {
  console.log('='.repeat(80));
  console.log('📝 글 생성 테스트 시작 (10회 반복)');
  console.log('='.repeat(80));
  
  // 환경설정에서 API 키 로드
  const env = loadEnvFromFile();
  const geminiKey = env['geminiKey'] || env['GEMINI_API_KEY'] || process.env['GEMINI_API_KEY'] || '';
  const openaiKey = env['openaiKey'] || env['OPENAI_API_KEY'] || process.env['OPENAI_API_KEY'] || '';
  const naverClientId = env['naverClientId'] || env['NAVER_CLIENT_ID'] || process.env['NAVER_CLIENT_ID'] || '';
  const naverClientSecret = env['naverClientSecret'] || env['NAVER_CLIENT_SECRET'] || process.env['NAVER_CLIENT_SECRET'] || '';
  const googleCseKey = env['googleCseKey'] || env['GOOGLE_CSE_KEY'] || env['googleApiKey'] || process.env['GOOGLE_CSE_KEY'] || process.env['GOOGLE_API_KEY'] || '';
  const googleCseCx = env['googleCseCx'] || env['GOOGLE_CSE_CX'] || env['googleCseId'] || process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || '';
  
  console.log('\n🔑 API 키 상태:');
  console.log(`  - Gemini: ${geminiKey ? '✅ 설정됨 (' + geminiKey.substring(0, 10) + '...)' : '❌ 미설정'}`);
  console.log(`  - OpenAI: ${openaiKey ? '✅ 설정됨 (' + openaiKey.substring(0, 10) + '...)' : '❌ 미설정'}`);
  console.log(`  - Naver Client ID: ${naverClientId ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - Naver Client Secret: ${naverClientSecret ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - Google CSE Key: ${googleCseKey ? '✅ 설정됨' : '❌ 미설정'}`);
  console.log(`  - Google CSE CX: ${googleCseCx ? '✅ 설정됨' : '❌ 미설정'}`);
  
  if (!geminiKey) {
    console.error('\n❌ Gemini API 키가 설정되지 않았습니다. 테스트를 중단합니다.');
    return;
  }
  
  const testTopic = '2026년 연말정산 미리보기';
  const testKeywords = ['연말정산', '2026년', '절세', '공제', '환급'];
  
  const results: Array<{
    testNumber: number;
    success: boolean;
    title?: string;
    htmlLength?: number;
    textLength?: number;
    cssLength?: number;
    error?: string;
    duration?: number;
    filepath?: string;
    publishedUrl?: string;
  }> = [];
  
  for (let i = 1; i <= 10; i++) {
    console.log('\n' + '='.repeat(80));
    console.log(`🧪 테스트 ${i}/10 시작`);
    console.log('='.repeat(80));
    
    const startTime = Date.now();
    
    try {
      const payload: RunOnePostPayload = {
        topic: testTopic,
        keywords: testKeywords,
        minChars: 3000,
        provider: 'gemini',
        geminiKey: geminiKey,
        openaiKey: openaiKey,
        platform: 'blogger',
        contentMode: 'external',
        naverClientId: naverClientId,
        naverClientSecret: naverClientSecret,
        googleCseKey: googleCseKey,
        googleCseCx: googleCseCx
      };
      
      const envConfig = {
        geminiApiKey: geminiKey,
        openaiApiKey: openaiKey,
        naverClientId: naverClientId,
        naverClientSecret: naverClientSecret,
        googleApiKey: googleCseKey,
        googleCseId: googleCseCx
      };
      
      const onLog = (message: string) => {
        if (message.includes('[CSS-OPTIMIZE]') || message.includes('[FINAL-POST-PROCESS]') || message.includes('✅') || message.includes('❌')) {
          console.log(`  ${message}`);
        }
      };
      
      const result = await generateMaxModeArticle(payload, envConfig, onLog);
      
      const duration = Date.now() - startTime;
      
      // HTML 분석
      const htmlLength = result.html.length;
      const cssMatch = result.html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      const cssLength = cssMatch && cssMatch[1] ? cssMatch[1].length : 0;
      
      // 순수 텍스트 길이 계산
      let textOnly = result.html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      textOnly = textOnly.replace(/<[^>]*>/g, '');
      textOnly = textOnly.replace(/\s+/g, ' ').trim();
      const textLength = textOnly.length;
      
      // HTML 파일로 저장
      const outputDir = path.join(process.cwd(), 'test-output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `test-${i}-${Date.now()}.html`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, result.html, 'utf-8');
      
      // 실제 Blogger 발행 시도 (환경설정에 발행 정보가 있는 경우)
      let publishedUrl: string | null = null;
      const blogId = env['blogId'] || env['BLOG_ID'] || process.env['BLOG_ID'] || '';
      const googleClientId = env['googleClientId'] || env['GOOGLE_CLIENT_ID'] || process.env['GOOGLE_CLIENT_ID'] || '';
      const googleClientSecret = env['googleClientSecret'] || env['GOOGLE_CLIENT_SECRET'] || process.env['GOOGLE_CLIENT_SECRET'] || '';
      
      if (blogId && googleClientId && googleClientSecret) {
        try {
          console.log(`  - Blogger 발행 시도 중...`);
          const { postToBlogger } = await import('./src/cli');
          const publishResult = await postToBlogger(
            {
              title: result.title,
              html: result.html,
              thumbnailUrl: result.thumbnail || ''
            },
            undefined, // publishedIso (즉시 발행)
            result.labels || [],
            true, // allowComments
            true  // isDraft (초안으로 저장)
          );
          
          if (publishResult && publishResult.url) {
            publishedUrl = publishResult.url;
            console.log(`  - ✅ Blogger 초안 저장 완료: ${publishedUrl}`);
          } else if (publishResult && publishResult.id) {
            publishedUrl = `https://www.blogger.com/blogger.g?blogID=${blogId}#editor/target=post;postID=${publishResult.id}`;
            console.log(`  - ✅ Blogger 초안 저장 완료 (ID: ${publishResult.id})`);
          }
        } catch (publishError) {
          const errorMsg = publishError instanceof Error ? publishError.message : String(publishError);
          console.log(`  - ⚠️ Blogger 발행 실패 (무시): ${errorMsg.substring(0, 100)}`);
        }
      } else {
        console.log(`  - ℹ️ Blogger 발행 정보 없음 (초안만 저장)`);
      }
      
      const resultData: typeof results[0] = {
        testNumber: i,
        success: true,
        title: result.title,
        htmlLength,
        textLength,
        cssLength,
        duration,
        filepath: filepath
      };
      if (publishedUrl) {
        resultData.publishedUrl = publishedUrl;
      }
      results.push(resultData);
      
      console.log(`\n✅ 테스트 ${i}/10 성공`);
      console.log(`  - 제목: ${result.title}`);
      console.log(`  - HTML 길이: ${htmlLength.toLocaleString()}자`);
      console.log(`  - 텍스트 길이: ${textLength.toLocaleString()}자`);
      console.log(`  - CSS 길이: ${cssLength.toLocaleString()}자`);
      console.log(`  - 소요 시간: ${(duration / 1000).toFixed(1)}초`);
      console.log(`  - CSS 최적화: ${cssLength <= 15000 ? '✅ 목표 달성' : '⚠️ 목표 초과'}`);
      console.log(`  - 저장 경로: ${filepath}`);
      if (publishedUrl) {
        console.log(`  - 발행 URL: ${publishedUrl}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      results.push({
        testNumber: i,
        success: false,
        error: errorMessage,
        duration
      });
      
      console.error(`\n❌ 테스트 ${i}/10 실패`);
      console.error(`  - 오류: ${errorMessage}`);
      console.error(`  - 소요 시간: ${(duration / 1000).toFixed(1)}초`);
    }
    
    // 다음 테스트 전 대기 (API 할당량 방지)
    if (i < 10) {
      console.log('\n⏳ 다음 테스트 전 3초 대기...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // 최종 결과 요약
  console.log('\n' + '='.repeat(80));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(80));
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log(`\n✅ 성공: ${successCount}/10 (${(successCount / 10 * 100).toFixed(1)}%)`);
  console.log(`❌ 실패: ${failureCount}/10 (${(failureCount / 10 * 100).toFixed(1)}%)`);
  
  if (successCount > 0) {
    const successfulResults = results.filter(r => r.success);
    const avgHtmlLength = successfulResults.reduce((sum, r) => sum + (r.htmlLength || 0), 0) / successfulResults.length;
    const avgTextLength = successfulResults.reduce((sum, r) => sum + (r.textLength || 0), 0) / successfulResults.length;
    const avgCssLength = successfulResults.reduce((sum, r) => sum + (r.cssLength || 0), 0) / successfulResults.length;
    const avgDuration = successfulResults.reduce((sum, r) => sum + (r.duration || 0), 0) / successfulResults.length;
    const cssOptimizedCount = successfulResults.filter(r => (r.cssLength || 0) <= 15000).length;
    
    console.log(`\n📈 평균 통계:`);
    console.log(`  - HTML 길이: ${avgHtmlLength.toLocaleString()}자`);
    console.log(`  - 텍스트 길이: ${avgTextLength.toLocaleString()}자`);
    console.log(`  - CSS 길이: ${avgCssLength.toLocaleString()}자`);
    console.log(`  - 소요 시간: ${(avgDuration / 1000).toFixed(1)}초`);
    console.log(`  - CSS 최적화 달성: ${cssOptimizedCount}/${successCount}회 (${(cssOptimizedCount / successCount * 100).toFixed(1)}%)`);
    
    console.log(`\n📋 상세 결과:`);
    successfulResults.forEach(r => {
      console.log(`  ${r.testNumber}. ${r.title}`);
      console.log(`     - HTML: ${r.htmlLength?.toLocaleString()}자, CSS: ${r.cssLength?.toLocaleString()}자, ${((r.duration || 0) / 1000).toFixed(1)}초`);
      console.log(`     - 파일: ${r.filepath}`);
      if (r.publishedUrl) {
        console.log(`     - 발행 URL: ${r.publishedUrl}`);
      }
    });
    
    const publishedCount = successfulResults.filter(r => r.publishedUrl).length;
    console.log(`\n📁 생성된 HTML 파일 위치: ${path.join(process.cwd(), 'test-output')}`);
    console.log(`   브라우저에서 열어서 실제 결과물을 확인하세요!`);
    if (publishedCount > 0) {
      console.log(`\n🌐 Blogger 발행 완료: ${publishedCount}/${successCount}개`);
      console.log(`   Blogger 관리자 페이지에서 초안을 확인하고 발행하세요!`);
    }
  }
  
  if (failureCount > 0) {
    console.log(`\n❌ 실패한 테스트:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ${r.testNumber}. ${r.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 테스트 완료');
  console.log('='.repeat(80));
}

// 테스트 실행
testArticleGeneration().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});

