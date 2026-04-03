// test-publish-wordpress.ts
// 워드프레스 실제 발행 테스트

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
async function testPublishToWordPress() {
  console.log('='.repeat(60));
  console.log('📝 워드프레스 실제 발행 테스트');
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
      platform: 'wordpress',  // 워드프레스로 발행
      postingMode: 'publish',  // 즉시 발행
      naverClientId: envConfig.naverClientId || '',
      naverClientSecret: envConfig.naverClientSecret || '',
      googleCseKey: envConfig.googleApiKey || '',
      googleCseCx: envConfig.googleCseId || '',
      // 🎨 이미지 스킵 (빠른 테스트)
      skipImages: true,
      fastMode: false,
      h2ImageSource: 'stability',
      // CTA 활성화
      enableCTA: true,
    };

    console.log('\n📋 발행 설정:');
    console.log(`- 주제: ${testConfig.topic}`);
    console.log(`- 플랫폼: ${testConfig.platform}`);
    console.log(`- 모드: ${testConfig.postingMode}`);

    // 2. 글 생성
    console.log('\n🚀 글 생성 시작...\n');
    const result = await generateMaxModeArticle(testConfig, onLog);

    if (!result || !result.html) {
      throw new Error('글 생성 실패: 결과가 없습니다');
    }

    console.log('\n✅ 글 생성 완료!');
    console.log(`- HTML 길이: ${result.html.length}자`);
    console.log(`- 제목: ${result.title}`);

    // 3. 워드프레스 발행
    console.log('\n🚀 워드프레스 발행 시작...');
    
    // 워드프레스 설정 확인 - .env 파일 직접 읽기
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.env['APPDATA'] || '', 'blogger-gpt-cli', '.env');
    let wpUrl = '', wpUsername = '', wpPassword = '';
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        if (line.startsWith('WORDPRESS_SITE_URL=')) {
          wpUrl = line.split('=')[1]?.trim().replace(/"/g, '') || '';
        } else if (line.startsWith('WORDPRESS_USERNAME=')) {
          wpUsername = line.split('=')[1]?.trim().replace(/"/g, '') || '';
        } else if (line.startsWith('WORDPRESS_PASSWORD=')) {
          wpPassword = line.split('=').slice(1).join('=')?.trim().replace(/"/g, '') || '';
        }
      }
      console.log('[ENV] 워드프레스 설정 로드:', { wpUrl, wpUsername, hasPassword: !!wpPassword });
    }
    
    if (!wpUrl || !wpUsername || !wpPassword) {
      console.log('\n⚠️ 워드프레스 설정이 없습니다.');
      console.log('- wordpressUrl:', wpUrl ? '✅' : '❌');
      console.log('- wordpressUsername:', wpUsername ? '✅' : '❌');
      console.log('- wordpressAppPassword:', wpPassword ? '✅' : '❌');
      console.log('\n📄 HTML 미리보기 (처음 2000자):');
      console.log(result.html.substring(0, 2000));
      return;
    }
    
    const publishResult = await publishGeneratedContent(
      {
        platform: 'wordpress',
        wordpressSiteUrl: wpUrl,
        WORDPRESS_SITE_URL: wpUrl,
        wordpressUsername: wpUsername,
        WORDPRESS_USERNAME: wpUsername,
        wordpressAppPassword: wpPassword,
        WORDPRESS_PASSWORD: wpPassword,
        labels: result.labels || ['테스트'],
      },
      result.title || '테스트 포스트',
      result.html,
      ''
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    if (publishResult && publishResult.ok) {
      console.log('✅ 발행 성공!');
      console.log('='.repeat(60));
      console.log(`\n📋 발행 결과:`);
      console.log(`- 게시물 URL: ${publishResult.url}`);
      console.log(`- 게시물 ID: ${publishResult.postId}`);
      console.log(`- 총 소요 시간: ${duration}초`);
    } else {
      console.log('❌ 발행 실패');
      console.log('='.repeat(60));
      console.log(`- 오류: ${publishResult?.error || '알 수 없는 오류'}`);
    }

  } catch (error: any) {
    console.error('\n❌ 테스트 실패:', error.message);
    console.error(error.stack);
  }
}

// 실행
testPublishToWordPress();

