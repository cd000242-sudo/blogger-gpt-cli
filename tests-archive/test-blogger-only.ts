/**
 * 블로그스팟 발행 전용 테스트 스크립트
 * 실제 API 키를 사용하여 Blogger 발행 프로세스를 상세하게 테스트합니다.
 * 
 * 사용법:
 * 1. .env 파일에 필요한 API 키 설정
 * 2. npm run test:blogger 또는 ts-node test-blogger-only.ts
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
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^#=]+)=(.+)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          env[key] = value;
        }
      }
    });
  }
  
  // process.env도 병합
  Object.assign(env, process.env);
  
  return env;
}

// 로그 수집
const logs: string[] = [];

function addLog(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  logs.push(logMessage);
  console.log(logMessage);
}

// 메인 테스트 함수
async function testBloggerPublishing() {
  addLog('🚀 블로그스팟 발행 테스트 시작');
  addLog('='.repeat(60));
  
  const env = loadEnv();
  
  // 필수 환경변수 확인
  const requiredVars = ['GEMINI_KEY', 'BLOG_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
  const missingVars = requiredVars.filter(key => !env[key] || env[key].trim() === '');
  
  if (missingVars.length > 0) {
    addLog(`❌ 필수 환경변수가 설정되지 않았습니다: ${missingVars.join(', ')}`);
    addLog(`   .env 파일을 확인하거나 test-publish-env.example을 참고하세요.`);
    process.exit(1);
  }
  
  addLog(`📋 설정 확인:`);
  addLog(`   - BLOG_ID: ${env.BLOG_ID.substring(0, 20)}...`);
  addLog(`   - CLIENT_ID: ${env.GOOGLE_CLIENT_ID.substring(0, 30)}...`);
  addLog(`   - CLIENT_SECRET: ${env.GOOGLE_CLIENT_SECRET ? '설정됨 (' + env.GOOGLE_CLIENT_SECRET.length + '자)' : '없음'}`);
  addLog(`   - REDIRECT_URI: ${env.REDIRECT_URI || 'http://localhost:3000/oauth2callback'}`);
  addLog('');
  
  // 테스트 1: 임시저장 (Draft)
  addLog('📝 테스트 1: Blogger 임시저장 시도...');
  addLog('-'.repeat(60));
  
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
    ctaMode: 'auto',
    useGoogleSearch: false
  };
  
  try {
    const draftResult = await runPost(draftPayload, (log) => addLog(`   ${log}`));
    
    if (draftResult.ok) {
      addLog(`✅ 임시저장 성공!`);
      addLog(`   - URL: ${draftResult.url || '없음'}`);
      addLog(`   - Post ID: ${(draftResult as any).postId || '없음'}`);
      addLog(`   - 제목: ${draftResult.title || '없음'}`);
    } else {
      addLog(`❌ 임시저장 실패: ${(draftResult as any).error || '알 수 없는 오류'}`);
      addLog(`   상세: ${JSON.stringify(draftResult, null, 2)}`);
    }
  } catch (error: any) {
    addLog(`❌ 예외 발생: ${error.message}`);
    addLog(`   스택: ${error.stack}`);
  }
  
  addLog('');
  
  // 테스트 2: 즉시 발행 (Publish) - 선택적
  if (env.TEST_PUBLISH === 'true') {
    addLog('📝 테스트 2: Blogger 즉시 발행 시도...');
    addLog('-'.repeat(60));
    
    const publishPayload = {
      ...draftPayload,
      topic: `[테스트] Blogger 즉시 발행 - ${new Date().toLocaleString('ko-KR')}`,
      postingMode: 'immediate',
      publishType: 'publish'
    };
    
    try {
      const publishResult = await runPost(publishPayload, (log) => addLog(`   ${log}`));
      
      if (publishResult.ok) {
        addLog(`✅ 즉시 발행 성공!`);
        addLog(`   - URL: ${publishResult.url || '없음'}`);
        addLog(`   - Post ID: ${(publishResult as any).postId || '없음'}`);
        addLog(`   - 제목: ${publishResult.title || '없음'}`);
      } else {
        addLog(`❌ 즉시 발행 실패: ${(publishResult as any).error || '알 수 없는 오류'}`);
        addLog(`   상세: ${JSON.stringify(publishResult, null, 2)}`);
      }
    } catch (error: any) {
      addLog(`❌ 예외 발생: ${error.message}`);
      addLog(`   스택: ${error.stack}`);
    }
    
    addLog('');
  } else {
    addLog('ℹ️ 즉시 발행 테스트는 건너뜁니다. (TEST_PUBLISH=true로 설정하면 실행)');
    addLog('');
  }
  
  // 테스트 3: 예약 발행 (Schedule) - 선택적
  if (env.TEST_SCHEDULE === 'true') {
    addLog('📝 테스트 3: Blogger 예약 발행 시도...');
    addLog('-'.repeat(60));
    
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
    
    addLog(`   예약 시간: ${scheduleDate.toLocaleString('ko-KR')}`);
    
    try {
      const scheduleResult = await runPost(schedulePayload, (log) => addLog(`   ${log}`));
      
      if (scheduleResult.ok) {
        addLog(`✅ 예약 발행 성공!`);
        addLog(`   - URL: ${scheduleResult.url || '없음'}`);
        addLog(`   - Post ID: ${(scheduleResult as any).postId || '없음'}`);
        addLog(`   - 제목: ${scheduleResult.title || '없음'}`);
      } else {
        addLog(`❌ 예약 발행 실패: ${(scheduleResult as any).error || '알 수 없는 오류'}`);
        addLog(`   상세: ${JSON.stringify(scheduleResult, null, 2)}`);
      }
    } catch (error: any) {
      addLog(`❌ 예외 발생: ${error.message}`);
      addLog(`   스택: ${error.stack}`);
    }
    
    addLog('');
  } else {
    addLog('ℹ️ 예약 발행 테스트는 건너뜁니다. (TEST_SCHEDULE=true로 설정하면 실행)');
    addLog('');
  }
  
  // 결과 저장
  const reportPath = path.join(__dirname, 'test-blogger-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    logs: logs
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  addLog(`📄 테스트 리포트 저장: ${reportPath}`);
  addLog('='.repeat(60));
  addLog('✅ 테스트 완료');
}

// 스크립트 실행
if (require.main === module) {
  testBloggerPublishing().catch(error => {
    console.error('❌ 테스트 실행 중 오류 발생:', error);
    process.exit(1);
  });
}

export { testBloggerPublishing };








