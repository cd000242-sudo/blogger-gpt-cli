// 이미지 생성 테스트 파일
import * as dotenv from 'dotenv';
import * as path from 'path';
import { makeSmartThumbnail } from './src/thumbnail';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '.env') });

interface TestResult {
  success: boolean;
  message: string;
  dataUrl?: string;
  type?: string;
  error?: string;
}

async function testThumbnailGeneration(): Promise<TestResult> {
  console.log('🖼️ 이미지 생성 테스트 시작...\n');

  const testTitle = '2025 AI 마케팅 전략 TOP 5';
  const testTopic = 'AI 마케팅 전략';

  // 환경 변수 확인
  const pexelsApiKey = process.env['PEXELS_API_KEY'] || '';
  const openaiApiKey = process.env['OPENAI_API_KEY'] || process.env['DALLE_API_KEY'] || '';
  const googleCseKey = process.env['GOOGLE_CSE_KEY'] || '';
  const googleCseCx = process.env['GOOGLE_CSE_CX'] || '';

  console.log('📋 환경 변수 확인:');
  console.log(`  - PEXELS_API_KEY: ${pexelsApiKey ? '✅ 있음' : '❌ 없음'}`);
  console.log(`  - OPENAI_API_KEY: ${openaiApiKey ? '✅ 있음' : '❌ 없음'}`);
  console.log(`  - GOOGLE_CSE_KEY: ${googleCseKey ? '✅ 있음' : '❌ 없음'}`);
  console.log(`  - GOOGLE_CSE_CX: ${googleCseCx ? '✅ 있음' : '❌ 없음'}\n`);

  // Pexels 옵션
  const pexelsOptions = pexelsApiKey ? {
    apiKey: pexelsApiKey,
    width: 1200,
    height: 630
  } : undefined;

  // DALL-E 옵션
  const dalleOptions = openaiApiKey ? {
    apiKey: openaiApiKey,
    width: 1200,
    height: 630,
    quality: 'standard' as const,
    style: 'natural' as const
  } : undefined;

  // CSE 옵션
  const cseOptions = (googleCseKey && googleCseCx) ? {
    apiKey: googleCseKey,
    cx: googleCseCx,
    width: 1200,
    height: 630
  } : undefined;

  console.log('🔍 테스트 설정:');
  console.log(`  - 제목: "${testTitle}"`);
  console.log(`  - 주제: "${testTopic}"`);
  console.log(`  - Pexels: ${pexelsOptions ? '✅ 사용' : '❌ 사용 안 함'}`);
  console.log(`  - DALL-E: ${dalleOptions ? '✅ 사용' : '❌ 사용 안 함'}`);
  console.log(`  - Google CSE: ${cseOptions ? '✅ 사용' : '❌ 사용 안 함'}\n`);

  try {
    console.log('🚀 이미지 생성 시작...\n');
    
    const result = await makeSmartThumbnail(
      testTitle,
      testTopic,
      {}, // SVG 옵션 (사용 안 함)
      pexelsOptions,
      cseOptions,
      dalleOptions
    );

    if (result.ok) {
      const dataUrlLength = result.dataUrl?.length || 0;
      const dataUrlPreview = result.dataUrl?.substring(0, 50) || '';
      
      console.log('✅ 이미지 생성 성공!');
      console.log(`  - 타입: ${result.type}`);
      console.log(`  - 데이터 URL 길이: ${dataUrlLength}자`);
      console.log(`  - 데이터 URL 미리보기: ${dataUrlPreview}...`);
      console.log(`  - Base64 데이터: ${dataUrlLength > 1000 ? '✅ 유효한 이미지 데이터' : '⚠️ 데이터가 너무 짧음'}\n`);

      return {
        success: true,
        message: `이미지 생성 성공 (${result.type})`,
        dataUrl: result.dataUrl,
        type: result.type
      };
    } else {
      console.log('❌ 이미지 생성 실패');
      console.log(`  - 오류: ${result.error}\n`);

      return {
        success: false,
        message: '이미지 생성 실패',
        error: result.error
      };
    }
  } catch (error: any) {
    console.log('❌ 이미지 생성 중 예외 발생');
    console.log(`  - 오류: ${error.message || error}\n`);

    return {
      success: false,
      message: '이미지 생성 중 예외 발생',
      error: error.message || String(error)
    };
  }
}

async function testAllThumbnailModes(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🖼️ 이미지 생성 종합 테스트');
  console.log('='.repeat(60));
  console.log('');

  const result = await testThumbnailGeneration();

  console.log('='.repeat(60));
  console.log('📊 테스트 결과 요약');
  console.log('='.repeat(60));
  console.log(`결과: ${result.success ? '✅ 성공' : '❌ 실패'}`);
  console.log(`메시지: ${result.message}`);
  if (result.type) {
    console.log(`이미지 타입: ${result.type}`);
  }
  if (result.error) {
    console.log(`오류: ${result.error}`);
  }
  if (result.dataUrl) {
    console.log(`데이터 URL 길이: ${result.dataUrl.length}자`);
    console.log(`데이터 URL 형식: ${result.dataUrl.substring(0, 30)}...`);
  }
  console.log('='.repeat(60));

  if (!result.success) {
    console.log('\n💡 해결 방법:');
    console.log('1. .env 파일에 API 키가 올바르게 설정되어 있는지 확인');
    console.log('2. PEXELS_API_KEY 또는 OPENAI_API_KEY 중 하나는 필수');
    console.log('3. API 키가 유효한지 확인 (만료되지 않았는지)');
    console.log('4. 네트워크 연결 확인');
    process.exit(1);
  } else {
    console.log('\n✅ 모든 테스트 통과!');
    process.exit(0);
  }
}

// 테스트 실행
testAllThumbnailModes().catch(error => {
  console.error('❌ 테스트 실행 중 오류:', error);
  process.exit(1);
});

