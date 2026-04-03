#!/usr/bin/env node

/**
 * 환경변수 설정 및 네이버 API 연동 확인 CLI
 * 사용법: node setup-env.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}
async function setupEnvironment() {
  console.log('🚀 환경변수 설정 및 네이버 API 연동 확인');
  console.log('='.repeat(60));

  const envManager = EnvironmentManager.getInstance();
  
  // 현재 설정 상태 확인
  console.log('\n📋 현재 설정 상태:');
  envManager.printConfigStatus();

  // 설정 업데이트 여부 확인
  const updateConfig = await question('\n설정을 업데이트하시겠습니까? (y/n): ');
  
  if (updateConfig.toLowerCase() === 'y') {
    console.log('\n🔧 환경변수 설정 시작...');
    
    // OpenAI API 키
    const openaiKey = await question('OpenAI API 키 (선택사항): ');
    if (openaiKey.trim()) {
      envManager.saveConfig({ openaiApiKey: openaiKey.trim() });
    }

    // Gemini API 키
    const geminiKey = await question('Google Gemini API 키 (선택사항): ');
    if (geminiKey.trim()) {
      envManager.saveConfig({ geminiApiKey: geminiKey.trim() });
    }

    // 네이버 API 키
    const naverClientId = await question('네이버 Client ID (필수): ');
    const naverClientSecret = await question('네이버 Client Secret (필수): ');
    
    if (naverClientId.trim() && naverClientSecret.trim()) {
      envManager.saveConfig({ 
        naverClientId: naverClientId.trim(),
        naverClientSecret: naverClientSecret.trim()
      });
    }

    // Google CSE API 키
    const googleApiKey = await question('Google API 키 (선택사항): ');
    const googleCseId = await question('Google CSE ID (선택사항): ');
    
    if (googleApiKey.trim() && googleCseId.trim()) {
      envManager.saveConfig({ 
        googleApiKey: googleApiKey.trim(),
        googleCseId: googleCseId.trim()
      });
    }

    // 크롤링 설정
    const maxConcurrent = await question('최대 동시 요청 수 (기본값: 30): ');
    if (maxConcurrent.trim()) {
      envManager.saveConfig({ 
        maxConcurrentRequests: parseInt(maxConcurrent.trim()) || 30
      });
    }

    const maxResults = await question('소스별 최대 결과 수 (기본값: 1000): ');
    if (maxResults.trim()) {
      envManager.saveConfig({ 
        maxResultsPerSource: parseInt(maxResults.trim()) || 1000
      });
    }

    console.log('\n✅ 설정 저장 완료!');
  }

  // 네이버 API 연결 테스트
  console.log('\n🌐 네이버 API 연결 테스트...');
  const naverTest = await testNaverApiConnection();
  
  if (naverTest.success) {
    console.log(`✅ 네이버 API 연결 성공!`);
    console.log(`   - 메시지: ${naverTest.message}`);
    if (naverTest.data) {
      console.log(`   - 총 결과: ${naverTest.data.totalResults}개`);
      console.log(`   - 수신 항목: ${naverTest.data.itemsCount}개`);
      console.log(`   - 샘플 제목: ${naverTest.data.sampleTitle}`);
    }
  } else {
    console.log(`❌ 네이버 API 연결 실패: ${naverTest.message}`);
    console.log('\n🔧 해결 방법:');
    console.log('1. 네이버 개발자 센터(https://developers.naver.com/)에서 애플리케이션 등록');
    console.log('2. 검색 API 사용 설정');
    console.log('3. Client ID와 Client Secret 확인');
    console.log('4. 다시 설정 실행');
  }

  // 대량 크롤링 시스템 테스트
  if (naverTest.success) {
    console.log('\n🚀 대량 크롤링 시스템 테스트...');
    const crawlingTest = await testMassCrawlingSystem();
    
    if (crawlingTest.success) {
      console.log(`✅ 대량 크롤링 시스템 테스트 성공!`);
      console.log(`   - 메시지: ${crawlingTest.message}`);
      if (crawlingTest.results) {
        console.log(`   - 네이버: ${crawlingTest.results.naverCount}개`);
        console.log(`   - RSS: ${crawlingTest.results.rssCount}개`);
        console.log(`   - CSE: ${crawlingTest.results.cseCount}개`);
        console.log(`   - 처리 시간: ${crawlingTest.results.processingTimeMs}ms`);
      }
    } else {
      console.log(`❌ 대량 크롤링 시스템 테스트 실패: ${crawlingTest.message}`);
    }
  }

  // 전체 시스템 진단
  console.log('\n🔍 전체 시스템 진단...');
  await diagnoseSystem();

  console.log('\n🎉 설정 완료!');
  console.log('이제 앱을 실행하면 자동으로 대량 크롤링 시스템이 활성화됩니다.');
  
  rl.close();
}

// 에러 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 처리되지 않은 Promise 거부:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 처리되지 않은 예외:', error);
  process.exit(1);
});

// 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  setupEnvironment().catch(console.error);
}