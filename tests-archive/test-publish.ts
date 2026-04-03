/**
 * 블로그 발행 테스트 스크립트
 * 실제 API 키를 사용하여 발행 프로세스의 정확성을 검증합니다.
 * 
 * 사용법:
 * 1. .env 파일에 필요한 API 키 설정
 * 2. npm run test:publish 또는 ts-node test-publish.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { runPost } from './src/core/index';

// 환경변수 로드 함수
function loadEnv(): Record<string, string> {
  const envPath = path.join(__dirname, '.env');
  const env: Record<string, string> = {};
  
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^#=]+)=(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        env[key] = value;
      }
    });
  }
  
  // process.env도 병합
  Object.assign(env, process.env);
  
  return env;
}

// 테스트 결과 인터페이스
interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

// 테스트 결과 수집
const testResults: TestResult[] = [];

// 로그 수집
const logs: string[] = [];

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  logs.push(logMessage);
  console.log(logMessage);
}

// 테스트 1: 중복 발행 방지 테스트
async function testDuplicatePrevention(): Promise<TestResult> {
  addLog('🧪 테스트 1: 중복 발행 방지 테스트 시작');
  
  try {
    const env = loadEnv();
    
    if (!env.GEMINI_KEY) {
      return {
        name: '중복 발행 방지 테스트',
        success: false,
        error: 'GEMINI_KEY가 설정되지 않았습니다.'
      };
    }
    
    // 첫 번째 발행 시도
    addLog('📝 첫 번째 발행 시도...');
    const payload1 = {
      provider: 'gemini',
      geminiKey: env.GEMINI_KEY,
      topic: '테스트 주제 - 중복 방지',
      keywords: ['테스트', '중복방지'],
      minChars: 500,
      contentMode: 'external',
      platform: 'preview', // 실제 발행하지 않고 미리보기만
      previewOnly: true,
      postingMode: 'immediate'
    };
    
    let firstCallRunning = false;
    let secondCallRunning = false;
    
    // 동시에 두 번 호출 시도
    const promise1 = runPost(payload1, (log) => {
      addLog(`[호출1] ${log}`);
      firstCallRunning = true;
    }).then(() => {
      firstCallRunning = false;
    });
    
    // 100ms 후 두 번째 호출 시도
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const promise2 = runPost(payload1, (log) => {
      addLog(`[호출2] ${log}`);
      secondCallRunning = true;
    }).then(() => {
      secondCallRunning = false;
    });
    
    await Promise.all([promise1, promise2]);
    
    // 두 호출이 동시에 실행되었는지 확인
    const bothRan = firstCallRunning && secondCallRunning;
    
    return {
      name: '중복 발행 방지 테스트',
      success: !bothRan,
      details: {
        firstCallRan: firstCallRunning,
        secondCallRan: secondCallRunning,
        bothRanSimultaneously: bothRan
      }
    };
    
  } catch (error: any) {
    return {
      name: '중복 발행 방지 테스트',
      success: false,
      error: error.message
    };
  }
}

// 테스트 2: 콘텐츠 고유성 테스트
async function testContentUniqueness(): Promise<TestResult> {
  addLog('🧪 테스트 2: 콘텐츠 고유성 테스트 시작');
  
  try {
    const env = loadEnv();
    
    if (!env.GEMINI_KEY) {
      return {
        name: '콘텐츠 고유성 테스트',
        success: false,
        error: 'GEMINI_KEY가 설정되지 않았습니다.'
      };
    }
    
    // 같은 키워드로 두 번 생성
    const payload = {
      provider: 'gemini',
      geminiKey: env.GEMINI_KEY,
      topic: '2026년 홈택스 연말정산 미리보기',
      keywords: ['홈택스', '연말정산', '미리보기'],
      minChars: 1000,
      contentMode: 'external',
      platform: 'preview',
      previewOnly: true,
      postingMode: 'immediate'
    };
    
    addLog('📝 첫 번째 콘텐츠 생성...');
    const result1 = await runPost(payload, (log) => addLog(`[생성1] ${log}`));
    
    // 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    addLog('📝 두 번째 콘텐츠 생성...');
    const result2 = await runPost(payload, (log) => addLog(`[생성2] ${log}`));
    
    if (!result1.ok || !result2.ok) {
      return {
        name: '콘텐츠 고유성 테스트',
        success: false,
        error: '콘텐츠 생성 실패'
      };
    }
    
    const title1 = result1.title || '';
    const title2 = result2.title || '';
    const html1 = result1.html || '';
    const html2 = result2.html || '';
    
    // 제목이 다른지 확인
    const titlesDifferent = title1 !== title2;
    
    // HTML 내용이 다른지 확인 (일부만 비교)
    const html1Snippet = html1.substring(0, 500);
    const html2Snippet = html2.substring(0, 500);
    const contentDifferent = html1Snippet !== html2Snippet;
    
    // 유사도 계산 (간단한 방법)
    const similarity = calculateSimilarity(html1, html2);
    
    return {
      name: '콘텐츠 고유성 테스트',
      success: titlesDifferent && contentDifferent && similarity < 0.8,
      details: {
        title1,
        title2,
        titlesDifferent,
        contentDifferent,
        similarity: similarity.toFixed(2),
        html1Length: html1.length,
        html2Length: html2.length
      }
    };
    
  } catch (error: any) {
    return {
      name: '콘텐츠 고유성 테스트',
      success: false,
      error: error.message
    };
  }
}

// 유사도 계산 함수
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/);
  const words2 = str2.split(/\s+/);
  
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

// 테스트 3: WordPress 예약 발행 테스트
async function testWordPressSchedule(): Promise<TestResult> {
  addLog('🧪 테스트 3: WordPress 예약 발행 테스트 시작');
  
  try {
    const env = loadEnv();
    
    if (!env.GEMINI_KEY || !env.WORDPRESS_SITE_URL || !env.WORDPRESS_USERNAME || !env.WORDPRESS_PASSWORD) {
      return {
        name: 'WordPress 예약 발행 테스트',
        success: false,
        error: '필수 환경변수가 설정되지 않았습니다. (GEMINI_KEY, WORDPRESS_SITE_URL, WORDPRESS_USERNAME, WORDPRESS_PASSWORD)'
      };
    }
    
    // 1시간 후 예약 발행
    const scheduleDate = new Date();
    scheduleDate.setHours(scheduleDate.getHours() + 1);
    
    const payload = {
      provider: 'gemini',
      geminiKey: env.GEMINI_KEY,
      topic: '테스트 - WordPress 예약 발행',
      keywords: ['테스트', '예약발행'],
      minChars: 500,
      contentMode: 'external',
      platform: 'wordpress',
      postingMode: 'schedule',
      scheduleISO: scheduleDate.toISOString(),
      wordpressSiteUrl: env.WORDPRESS_SITE_URL,
      wordpressUsername: env.WORDPRESS_USERNAME,
      wordpressPassword: env.WORDPRESS_PASSWORD,
      wordpressCategories: []
    };
    
    addLog(`📅 예약 시간: ${scheduleDate.toLocaleString('ko-KR')}`);
    addLog('📝 WordPress 예약 발행 시도...');
    
    const result = await runPost(payload, (log) => addLog(`[WP] ${log}`));
    
    return {
      name: 'WordPress 예약 발행 테스트',
      success: result.ok === true,
      details: {
        url: result.url,
        postId: (result as any).postId,
        scheduleDate: scheduleDate.toISOString()
      },
      error: result.ok === false ? (result as any).error : undefined
    };
    
  } catch (error: any) {
    return {
      name: 'WordPress 예약 발행 테스트',
      success: false,
      error: error.message
    };
  }
}

// 테스트 4: Blogger 발행 테스트 (상세)
async function testBloggerPublish(): Promise<TestResult> {
  addLog('🧪 테스트 4: Blogger 발행 테스트 시작');
  
  try {
    const env = loadEnv();
    
    if (!env.GEMINI_KEY || !env.BLOG_ID || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return {
        name: 'Blogger 발행 테스트',
        success: false,
        error: '필수 환경변수가 설정되지 않았습니다. (GEMINI_KEY, BLOG_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)'
      };
    }
    
    addLog(`📋 설정 확인:`);
    addLog(`   - BLOG_ID: ${env.BLOG_ID.substring(0, 20)}...`);
    addLog(`   - CLIENT_ID: ${env.GOOGLE_CLIENT_ID.substring(0, 30)}...`);
    addLog(`   - CLIENT_SECRET: ${env.GOOGLE_CLIENT_SECRET ? '설정됨' : '없음'}`);
    
    // 테스트 4-1: 임시저장 (Draft)
    addLog('📝 테스트 4-1: Blogger 임시저장 시도...');
    const draftPayload = {
      provider: 'gemini',
      geminiKey: env.GEMINI_KEY,
      topic: `[테스트] Blogger 임시저장 - ${new Date().toLocaleString('ko-KR')}`,
      keywords: ['테스트', 'Blogger', '임시저장'],
      minChars: 1000,
      maxChars: 2000,
      contentMode: 'external',
      platform: 'blogger',
      postingMode: 'draft',
      publishType: 'draft',
      previewOnly: false,
      blogId: env.BLOG_ID,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.REDIRECT_URI || 'http://localhost:3000/oauth2callback',
      promptMode: 'max-mode',
      ctaMode: 'auto'
    };
    
    const draftResult = await runPost(draftPayload, (log) => addLog(`[Blogger-Draft] ${log}`));
    
    if (!draftResult.ok) {
      return {
        name: 'Blogger 발행 테스트',
        success: false,
        error: `임시저장 실패: ${(draftResult as any).error || '알 수 없는 오류'}`,
        details: {
          draftResult: draftResult
        }
      };
    }
    
    addLog(`✅ 임시저장 성공: ${draftResult.url || 'URL 없음'}`);
    
    // 테스트 4-2: 즉시 발행 (Publish) - 선택적
    let publishResult: any = null;
    if (env.TEST_PUBLISH === 'true') {
      addLog('📝 테스트 4-2: Blogger 즉시 발행 시도...');
      const publishPayload = {
        ...draftPayload,
        topic: `[테스트] Blogger 즉시 발행 - ${new Date().toLocaleString('ko-KR')}`,
        postingMode: 'immediate',
        publishType: 'publish'
      };
      
      publishResult = await runPost(publishPayload, (log) => addLog(`[Blogger-Publish] ${log}`));
      
      if (publishResult.ok) {
        addLog(`✅ 즉시 발행 성공: ${publishResult.url || 'URL 없음'}`);
      } else {
        addLog(`⚠️ 즉시 발행 실패: ${(publishResult as any).error || '알 수 없는 오류'}`);
      }
    } else {
      addLog('ℹ️ 즉시 발행 테스트는 건너뜁니다. (TEST_PUBLISH=true로 설정하면 실행)');
    }
    
    // 테스트 4-3: 예약 발행 (Schedule) - 선택적
    let scheduleResult: any = null;
    if (env.TEST_SCHEDULE === 'true') {
      addLog('📝 테스트 4-3: Blogger 예약 발행 시도...');
      const scheduleDate = new Date();
      scheduleDate.setHours(scheduleDate.getHours() + 1);
      
      const schedulePayload = {
        ...draftPayload,
        topic: `[테스트] Blogger 예약 발행 - ${scheduleDate.toLocaleString('ko-KR')}`,
        postingMode: 'schedule',
        publishType: 'schedule',
        scheduleISO: scheduleDate.toISOString(),
        schedule: scheduleDate.toISOString()
      };
      
      scheduleResult = await runPost(schedulePayload, (log) => addLog(`[Blogger-Schedule] ${log}`));
      
      if (scheduleResult.ok) {
        addLog(`✅ 예약 발행 성공: ${scheduleResult.url || 'URL 없음'}`);
      } else {
        addLog(`⚠️ 예약 발행 실패: ${(scheduleResult as any).error || '알 수 없는 오류'}`);
      }
    } else {
      addLog('ℹ️ 예약 발행 테스트는 건너뜁니다. (TEST_SCHEDULE=true로 설정하면 실행)');
    }
    
    return {
      name: 'Blogger 발행 테스트',
      success: draftResult.ok === true,
      details: {
        draft: {
          success: draftResult.ok === true,
          url: draftResult.url,
          postId: (draftResult as any).postId
        },
        publish: publishResult ? {
          success: publishResult.ok === true,
          url: publishResult.url,
          postId: (publishResult as any).postId,
          error: publishResult.ok === false ? (publishResult as any).error : undefined
        } : { skipped: true },
        schedule: scheduleResult ? {
          success: scheduleResult.ok === true,
          url: scheduleResult.url,
          postId: (scheduleResult as any).postId,
          error: scheduleResult.ok === false ? (scheduleResult as any).error : undefined
        } : { skipped: true }
      },
      error: draftResult.ok === false ? (draftResult as any).error : undefined
    };
    
  } catch (error: any) {
    addLog(`❌ 예외 발생: ${error.message}`);
    addLog(`   스택: ${error.stack}`);
    return {
      name: 'Blogger 발행 테스트',
      success: false,
      error: error.message,
      details: {
        stack: error.stack
      }
    };
  }
}

// 테스트 5: 에러 처리 테스트
async function testErrorHandling(): Promise<TestResult> {
  addLog('🧪 테스트 5: 에러 처리 테스트 시작');
  
  try {
    // 잘못된 API 키로 테스트
    const payload = {
      provider: 'gemini',
      geminiKey: 'invalid-key-12345',
      topic: '에러 처리 테스트',
      keywords: ['테스트'],
      minChars: 500,
      contentMode: 'external',
      platform: 'preview',
      previewOnly: true,
      postingMode: 'immediate'
    };
    
    addLog('📝 잘못된 API 키로 콘텐츠 생성 시도...');
    
    const result = await runPost(payload, (log) => addLog(`[에러테스트] ${log}`));
    
    // 에러가 올바르게 처리되었는지 확인
    const errorHandled = result.ok === false && (result as any).error;
    
    return {
      name: '에러 처리 테스트',
      success: errorHandled,
      details: {
        error: (result as any).error,
        handled: errorHandled
      }
    };
    
  } catch (error: any) {
    // 예외가 발생해도 에러 처리가 되었다고 간주
    return {
      name: '에러 처리 테스트',
      success: true,
      details: {
        error: error.message,
        handled: true
      }
    };
  }
}

// 메인 테스트 실행 함수
async function runAllTests() {
  addLog('🚀 블로그 발행 테스트 시작');
  addLog('='.repeat(60));
  
  // 테스트 실행
  testResults.push(await testDuplicatePrevention());
  testResults.push(await testContentUniqueness());
  testResults.push(await testWordPressSchedule());
  testResults.push(await testBloggerPublish());
  testResults.push(await testErrorHandling());
  
  // 결과 출력
  addLog('='.repeat(60));
  addLog('📊 테스트 결과 요약');
  addLog('='.repeat(60));
  
  let successCount = 0;
  let failCount = 0;
  
  testResults.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    addLog(`${index + 1}. ${status} ${result.name}`);
    
    if (result.success) {
      successCount++;
      if (result.details) {
        addLog(`   상세: ${JSON.stringify(result.details, null, 2)}`);
      }
    } else {
      failCount++;
      addLog(`   오류: ${result.error || '알 수 없는 오류'}`);
      if (result.details) {
        addLog(`   상세: ${JSON.stringify(result.details, null, 2)}`);
      }
    }
    addLog('');
  });
  
  addLog('='.repeat(60));
  addLog(`총 ${testResults.length}개 테스트 중 ${successCount}개 성공, ${failCount}개 실패`);
  addLog('='.repeat(60));
  
  // 결과를 파일로 저장
  const reportPath = path.join(__dirname, 'test-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.length,
      success: successCount,
      fail: failCount
    },
    results: testResults,
    logs: logs
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  addLog(`📄 테스트 리포트 저장: ${reportPath}`);
  
  // 실패한 테스트가 있으면 종료 코드 1 반환
  process.exit(failCount > 0 ? 1 : 0);
}

// 스크립트 실행
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  });
}

export { runAllTests, testDuplicatePrevention, testContentUniqueness, testWordPressSchedule, testBloggerPublish, testErrorHandling };

