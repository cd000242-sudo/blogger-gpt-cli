// test-publish-blogspot.ts
// 블로그스팟 실제 발행 테스트

import { generateMaxModeArticle, publishGeneratedContent } from './src/core/index';
import { EnvironmentManager } from './src/utils/environment-manager';

// 환경변수 관리자 사용
const envManager = EnvironmentManager.getInstance();
const envConfig = envManager.getConfig();

// 로그 콜백
function onLog(message: string) {
  console.log(`[LOG] ${message}`);
}

// 메인 테스트 함수
async function testPublishToBlogspot() {
  console.log('='.repeat(60));
  console.log('📝 블로그스팟 실제 발행 테스트');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // 1. 발행 설정
    const testConfig = {
      provider: 'gemini' as const,
      geminiKey: envConfig.geminiApiKey || '',
      topic: '인스타그램 스토리 알림 끄기',
      keywords: ['인스타그램', '스토리', '알림', '끄기'],
      minChars: 2000,
      contentMode: 'external',
      platform: 'blogspot',  // 블로그스팟으로 발행
      postingMode: 'publish',  // 즉시 발행
      naverClientId: envConfig.naverClientId || '',
      naverClientSecret: envConfig.naverClientSecret || '',
      googleCseKey: envConfig.googleApiKey || '',
      googleCseCx: envConfig.googleCseId || '',
      // 🎨 이미지 생성 (나노바나나프로)
      skipImages: false,      // 이미지 생성 활성화
      fastMode: false,        // 전체 모드
      h2ImageSource: 'nanobananapro',  // Nano Banana Pro 이미지
      // CTA 활성화
      enableCTA: true,
      // 경쟁 블로그 링크 제거 (내부에서 자동 처리됨)
    };

    console.log('\n📋 발행 설정:');
    console.log(`- 주제: ${testConfig.topic}`);
    console.log(`- 플랫폼: ${testConfig.platform}`);
    console.log(`- 발행 모드: ${testConfig.postingMode}`);
    console.log(`- 이미지 소스: ${testConfig.h2ImageSource} (Pollinations 100% 성공)`);
    console.log(`- Gemini API: ${testConfig.geminiKey ? '✅ 설정됨' : '❌ 없음'}`);

    // 2. 글 생성
    console.log('\n🚀 글 생성 시작...');
    
    const env = {
      contentMode: testConfig.contentMode || 'external',
      postingMode: 'immediate',
    };

    const article = await generateMaxModeArticle(testConfig, env, onLog);
    
    const generateTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ 글 생성 완료! (${generateTime}초)`);
    console.log(`- 제목: ${article.title}`);
    console.log(`- HTML 길이: ${article.html.length}자`);
    console.log(`- 썸네일: ${article.thumbnail ? '있음' : '없음'}`);
    console.log(`- 라벨: ${article.labels?.join(', ') || '없음'}`);
    
    // 3. 이미지 확인
    const imageCount = (article.html.match(/<img[^>]*>/gi) || []).length;
    console.log(`\n🖼️ 이미지 분석:`);
    console.log(`- 이미지 개수: ${imageCount}개`);
    
    // 4. 블로그스팟에 발행
    console.log('\n📤 블로그스팟에 발행 중...');
    
    const publishResult = await publishGeneratedContent(
      testConfig,
      article.title,
      article.html,
      article.thumbnail
    );
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // 5. 결과 출력
    console.log('\n' + '='.repeat(60));
    if (publishResult.ok) {
      console.log('✅ 발행 성공!');
      console.log('='.repeat(60));
      console.log(`\n📋 발행 결과:`);
      console.log(`- 게시물 URL: ${publishResult.url || '확인 필요'}`);
      console.log(`- 게시물 ID: ${publishResult.postId || publishResult.id || '확인 필요'}`);
      console.log(`- 총 소요 시간: ${totalTime}초`);
      console.log(`- 이미지 개수: ${imageCount}개`);
      console.log('\n🔗 블로그에서 확인하세요!');
      console.log('='.repeat(60));
      process.exit(0);
    } else {
      console.log('❌ 발행 실패!');
      console.log('='.repeat(60));
      console.log(`- 에러: ${publishResult.error || '알 수 없는 오류'}`);
      if (publishResult.needsAuth) {
        console.log('⚠️ 인증이 필요합니다. 앱에서 블로거 로그인을 해주세요.');
      }
      console.log('='.repeat(60));
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ 테스트 중 오류 발생:');
    console.error('='.repeat(60));
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

// 타임아웃 설정 (5분 - 이미지 생성 포함)
const TIMEOUT = 300000; // 300초 (5분)

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error(`테스트 타임아웃: ${TIMEOUT / 1000}초를 초과했습니다.`));
  }, TIMEOUT);
});

// 테스트 실행
Promise.race([testPublishToBlogspot(), timeoutPromise])
  .catch((error) => {
    console.error('\n❌ 테스트 실패:', error.message);
    process.exit(1);
  });

