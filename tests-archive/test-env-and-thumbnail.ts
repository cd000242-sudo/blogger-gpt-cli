// 환경변수 로딩 및 이미지 생성 종합 테스트
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '.env') });

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, success: boolean, message: string, details?: any) {
  results.push({ name, success, message, details });
  console.log(`${success ? '✅' : '❌'} ${name}: ${message}`);
  if (details) {
    console.log(`   상세:`, details);
  }
}

async function testEnvLoading(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('📋 테스트 1: 환경변수 로딩');
  console.log('='.repeat(60));

  // 1. 프로젝트 루트 .env 파일 확인
  const projectRootEnv = path.join(process.cwd(), '.env');
  const hasProjectEnv = fs.existsSync(projectRootEnv);
  addResult(
    '프로젝트 루트 .env 파일 존재',
    hasProjectEnv,
    hasProjectEnv ? `파일 경로: ${projectRootEnv}` : '파일이 없습니다'
  );

  if (hasProjectEnv) {
    try {
      const raw = fs.readFileSync(projectRootEnv, 'utf-8');
      const lines = raw.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
      const keys: string[] = [];
      lines.forEach(line => {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (match && match[1]) keys.push(match[1]);
      });
      addResult(
        '프로젝트 루트 .env 파일 파싱',
        true,
        `${keys.length}개 키 발견`,
        { keys: keys.slice(0, 10) }
      );
    } catch (e: any) {
      addResult('프로젝트 루트 .env 파일 파싱', false, e.message);
    }
  }

  // 2. loadEnvFromFile() 테스트
  try {
    const { loadEnvFromFile } = await import('./src/env');
    const envData = loadEnvFromFile();
    const keyCount = Object.keys(envData).length;
    addResult(
      'loadEnvFromFile() 실행',
      true,
      `${keyCount}개 키 로드됨`,
      {
        hasGemini: !!(envData['geminiKey'] || envData['GEMINI_KEY'] || envData['GEMINI_API_KEY']),
        hasOpenAI: !!(envData['openaiKey'] || envData['OPENAI_API_KEY'] || envData['DALLE_API_KEY']),
        hasPexels: !!(envData['pexelsApiKey'] || envData['PEXELS_API_KEY']),
        hasDalle: !!(envData['dalleApiKey'] || envData['DALLE_API_KEY'] || envData['openaiKey']),
        hasGoogleCse: !!(envData['googleCseKey'] || envData['GOOGLE_CSE_KEY'] || envData['GOOGLE_CSE_API_KEY'])
      }
    );
  } catch (e: any) {
    addResult('loadEnvFromFile() 실행', false, e.message);
  }

  // 3. EnvironmentManager 테스트
  try {
    const { EnvironmentManager } = await import('./src/utils/environment-manager');
    const envManager = EnvironmentManager.getInstance();
    const config = envManager.getConfig();
    addResult(
      'EnvironmentManager.getConfig() 실행',
      true,
      '설정 로드 성공',
      {
        hasGemini: !!config.geminiApiKey,
        hasOpenAI: !!config.openaiApiKey,
        hasPexels: !!config.pexelsApiKey,
        hasDalle: !!config.dalleApiKey,
        hasGoogleCse: !!config.googleApiKey || !!config.googleCseKey
      }
    );
  } catch (e: any) {
    addResult('EnvironmentManager.getConfig() 실행', false, e.message);
  }

  // 4. process.env 직접 확인
  const envVars = {
    GEMINI_KEY: process.env['GEMINI_KEY'] || process.env['GEMINI_API_KEY'] || '',
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'] || process.env['DALLE_API_KEY'] || '',
    PEXELS_API_KEY: process.env['PEXELS_API_KEY'] || '',
    GOOGLE_CSE_KEY: process.env['GOOGLE_CSE_KEY'] || process.env['GOOGLE_CSE_API_KEY'] || '',
    GOOGLE_CSE_CX: process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || ''
  };

  addResult(
    'process.env 직접 확인',
    true,
    '환경변수 확인 완료',
    {
      hasGemini: !!envVars.GEMINI_KEY,
      hasOpenAI: !!envVars.OPENAI_API_KEY,
      hasPexels: !!envVars.PEXELS_API_KEY,
      hasGoogleCse: !!envVars.GOOGLE_CSE_KEY && !!envVars.GOOGLE_CSE_CX
    }
  );
}

async function testThumbnailGeneration(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🖼️ 테스트 2: 이미지 생성');
  console.log('='.repeat(60));

  const testTitle = '2025 AI 마케팅 전략 TOP 5';
  const testTopic = 'AI 마케팅 전략';

  // 환경변수에서 API 키 확인
  const pexelsApiKey = process.env['PEXELS_API_KEY'] || '';
  const openaiApiKey = process.env['OPENAI_API_KEY'] || process.env['DALLE_API_KEY'] || '';
  const googleCseKey = process.env['GOOGLE_CSE_KEY'] || process.env['GOOGLE_CSE_API_KEY'] || '';
  const googleCseCx = process.env['GOOGLE_CSE_CX'] || process.env['GOOGLE_CSE_ID'] || '';

  console.log('\n📋 API 키 상태:');
  console.log(`  - PEXELS_API_KEY: ${pexelsApiKey ? `✅ 있음 (${pexelsApiKey.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`  - OPENAI_API_KEY: ${openaiApiKey ? `✅ 있음 (${openaiApiKey.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`  - GOOGLE_CSE_KEY: ${googleCseKey ? `✅ 있음 (${googleCseKey.substring(0, 10)}...)` : '❌ 없음'}`);
  console.log(`  - GOOGLE_CSE_CX: ${googleCseCx ? `✅ 있음 (${googleCseCx.substring(0, 10)}...)` : '❌ 없음'}`);

  // Pexels 테스트
  if (pexelsApiKey) {
    try {
      console.log('\n🔍 Pexels 이미지 생성 테스트...');
      const { makePexelsThumbnail } = await import('./src/thumbnail');
      const result = await makePexelsThumbnail(testTitle, testTopic, {
        apiKey: pexelsApiKey,
        width: 1200,
        height: 630
      });
      if (result.ok) {
        addResult('Pexels 이미지 생성', true, `성공 (데이터 길이: ${result.dataUrl.length}자)`);
      } else {
        addResult('Pexels 이미지 생성', false, result.error || '알 수 없는 오류');
      }
    } catch (e: any) {
      addResult('Pexels 이미지 생성', false, e.message || String(e));
    }
  } else {
    addResult('Pexels 이미지 생성', false, 'PEXELS_API_KEY가 없습니다', { skipped: true });
  }

  // DALL-E 테스트
  if (openaiApiKey) {
    try {
      console.log('\n🔍 DALL-E 이미지 생성 테스트...');
      const { makeDalleThumbnail } = await import('./src/thumbnail');
      const result = await makeDalleThumbnail(testTitle, testTopic, {
        apiKey: openaiApiKey,
        width: 1200,
        height: 630,
        quality: 'standard',
        style: 'natural'
      });
      if (result.ok) {
        addResult('DALL-E 이미지 생성', true, `성공 (데이터 길이: ${result.dataUrl.length}자)`);
      } else {
        addResult('DALL-E 이미지 생성', false, result.error || '알 수 없는 오류');
      }
    } catch (e: any) {
      addResult('DALL-E 이미지 생성', false, e.message || String(e));
    }
  } else {
    addResult('DALL-E 이미지 생성', false, 'OPENAI_API_KEY가 없습니다', { skipped: true });
  }

  // makeSmartThumbnail 통합 테스트
  try {
    console.log('\n🔍 makeSmartThumbnail 통합 테스트...');
    const { makeSmartThumbnail } = await import('./src/thumbnail');
    
    const pexelsOptions = pexelsApiKey ? { apiKey: pexelsApiKey, width: 1200, height: 630 } : undefined;
    const dalleOptions = openaiApiKey ? { apiKey: openaiApiKey, width: 1200, height: 630, quality: 'standard' as const, style: 'natural' as const } : undefined;
    const cseOptions = (googleCseKey && googleCseCx) ? { apiKey: googleCseKey, cx: googleCseCx, width: 1200, height: 630 } : undefined;

    const result = await makeSmartThumbnail(
      testTitle,
      testTopic,
      {},
      pexelsOptions,
      cseOptions,
      dalleOptions
    );

    if (result.ok) {
      addResult('makeSmartThumbnail 통합', true, `성공 (타입: ${result.type}, 데이터 길이: ${result.dataUrl.length}자)`);
    } else {
      addResult('makeSmartThumbnail 통합', false, result.error || '알 수 없는 오류');
    }
  } catch (e: any) {
    addResult('makeSmartThumbnail 통합', false, e.message || String(e));
  }
}

async function testFullPostingFlow(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 테스트 3: 전체 포스팅 플로우 (환경변수 포함)');
  console.log('='.repeat(60));

  try {
    // 환경변수 로드
    const { loadEnvFromFile } = await import('./src/env');
    const envData = loadEnvFromFile();
    
    // 필수 환경변수 확인 (여러 키 이름 형식 지원)
    const geminiKey = (envData['geminiKey'] || envData['GEMINI_KEY'] || envData['GEMINI_API_KEY'] || 
      process.env['GEMINI_KEY'] || process.env['GEMINI_API_KEY'] || '') as string;
    const blogId = (envData['blogId'] || envData['BLOG_ID'] || envData['GOOGLE_BLOG_ID'] || 
      process.env['BLOG_ID'] || process.env['GOOGLE_BLOG_ID'] || '') as string;
    const googleClientId = (envData['googleClientId'] || envData['GOOGLE_CLIENT_ID'] || 
      process.env['GOOGLE_CLIENT_ID'] || '') as string;
    const googleClientSecret = (envData['googleClientSecret'] || envData['GOOGLE_CLIENT_SECRET'] || 
      process.env['GOOGLE_CLIENT_SECRET'] || '') as string;
    const pexelsApiKey = (envData['pexelsApiKey'] || envData['PEXELS_API_KEY'] || 
      process.env['PEXELS_API_KEY'] || '') as string;
    const dalleApiKey = (envData['dalleApiKey'] || envData['openaiKey'] || envData['OPENAI_API_KEY'] || envData['DALLE_API_KEY'] || 
      process.env['OPENAI_API_KEY'] || process.env['DALLE_API_KEY'] || '') as string;

    console.log('\n📋 필수 환경변수 확인:');
    console.log(`  - GEMINI_KEY: ${geminiKey ? `✅ 있음 (${geminiKey.length > 10 ? geminiKey.substring(0, 10) + '...' : geminiKey})` : '❌ 없음'}`);
    console.log(`  - BLOG_ID: ${blogId ? `✅ 있음 (${blogId.length > 10 ? blogId.substring(0, 10) + '...' : blogId})` : '❌ 없음'}`);
    console.log(`  - GOOGLE_CLIENT_ID: ${googleClientId ? `✅ 있음 (${googleClientId.length > 10 ? googleClientId.substring(0, 10) + '...' : googleClientId})` : '❌ 없음'}`);
    console.log(`  - GOOGLE_CLIENT_SECRET: ${googleClientSecret ? `✅ 있음 (${googleClientSecret.length > 10 ? googleClientSecret.substring(0, 10) + '...' : googleClientSecret})` : '❌ 없음'}`);
    console.log(`  - PEXELS_API_KEY: ${pexelsApiKey ? `✅ 있음 (${pexelsApiKey.length > 10 ? pexelsApiKey.substring(0, 10) + '...' : pexelsApiKey})` : '❌ 없음'}`);
    console.log(`  - DALLE_API_KEY: ${dalleApiKey ? `✅ 있음 (${dalleApiKey.length > 10 ? dalleApiKey.substring(0, 10) + '...' : dalleApiKey})` : '❌ 없음'}`);

    if (!geminiKey) {
      addResult('필수 환경변수 확인', false, 'GEMINI_KEY가 없습니다');
      return;
    }

    // 간단한 포스팅 테스트 (미리보기 모드)
    console.log('\n🔍 포스팅 생성 테스트 (미리보기 모드)...');
    const { runPost } = await import('./src/core/index');
    
    const testPayload: any = {
      topic: 'AI 마케팅 전략',
      keywords: ['AI 마케팅 전략', '2025년 AI 마케팅'],
      provider: 'gemini',
      platform: 'preview',
      previewOnly: true,
      geminiKey: geminiKey,
      thumbnailMode: pexelsApiKey ? 'pexels' : dalleApiKey ? 'dalle' : 'text',
      promptMode: 'max-mode',
      useGoogleSearch: false,
      ctaMode: 'auto',
      contentMode: 'external',
      minChars: 2000
    };
    
    // API 키는 값이 있을 때만 추가
    if (pexelsApiKey) {
      testPayload.pexelsApiKey = pexelsApiKey;
    }
    if (dalleApiKey) {
      testPayload.dalleApiKey = dalleApiKey;
    }

    let progressLogs: string[] = [];
    const onLog = (message: string) => {
      progressLogs.push(message);
      if (message.includes('[PROGRESS]') || message.includes('[THUMBNAIL]') || message.includes('[ENV]')) {
        console.log(`  ${message}`);
      }
    };

    const result = await runPost(testPayload, onLog);

    if (result && (result.ok || result.success)) {
      const hasTitle = !!result.title;
      const hasContent = !!(result.html || result.content);
      const hasThumbnail = !!result.thumbnail;
      
      addResult('포스팅 생성', true, '성공', {
        hasTitle,
        hasContent,
        hasThumbnail,
        titleLength: result.title?.length || 0,
        contentLength: (result.html || result.content || '').length,
        thumbnailLength: result.thumbnail?.length || 0
      });

      // 썸네일 생성 여부 확인
      if (hasThumbnail) {
        addResult('썸네일 생성', true, '썸네일이 생성되었습니다', {
          thumbnailType: result.thumbnail?.substring(0, 30) || 'unknown'
        });
      } else {
        addResult('썸네일 생성', false, '썸네일이 생성되지 않았습니다', {
          thumbnailMode: testPayload.thumbnailMode,
          hasPexelsKey: !!pexelsApiKey,
          hasDalleKey: !!dalleApiKey
        });
      }
    } else {
      addResult('포스팅 생성', false, result?.error || '알 수 없는 오류', {
        result: result
      });
    }
  } catch (e: any) {
    addResult('포스팅 생성', false, e.message || String(e), {
      stack: e.stack
    });
  }
}

async function runAllTests(): Promise<void> {
  console.log('🧪 환경변수 로딩 및 이미지 생성 종합 테스트');
  console.log('='.repeat(60));
  console.log('');

  try {
    await testEnvLoading();
    await testThumbnailGeneration();
    await testFullPostingFlow();

    // 최종 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('📊 테스트 결과 요약');
    console.log('='.repeat(60));

    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\n총 테스트: ${total}개`);
    console.log(`✅ 성공: ${passed}개`);
    console.log(`❌ 실패: ${failed}개`);
    console.log(`성공률: ${((passed / total) * 100).toFixed(1)}%`);

    console.log('\n📋 상세 결과:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.name}`);
      console.log(`   결과: ${result.success ? '✅ 성공' : '❌ 실패'}`);
      console.log(`   메시지: ${result.message}`);
      if (result.details) {
        console.log(`   상세:`, JSON.stringify(result.details, null, 2));
      }
    });

    if (failed > 0) {
      console.log('\n💡 실패한 테스트 해결 방법:');
      const failedTests = results.filter(r => !r.success);
      failedTests.forEach(test => {
        console.log(`\n❌ ${test.name}:`);
        console.log(`   문제: ${test.message}`);
        if (test.name.includes('환경변수') || test.name.includes('API 키')) {
          console.log('   해결: .env 파일에 해당 API 키를 추가하세요');
        } else if (test.name.includes('이미지')) {
          console.log('   해결: PEXELS_API_KEY 또는 OPENAI_API_KEY를 확인하세요');
        }
      });
      process.exit(1);
    } else {
      console.log('\n✅ 모든 테스트 통과!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ 테스트 실행 중 오류:', error);
    process.exit(1);
  }
}

// 테스트 실행
runAllTests();

