#!/usr/bin/env node

/**
 * 환경변수 설정 도우미 스크립트
 * API 키를 안전하게 설정할 수 있도록 도와줍니다.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

async function setupEnvironment() {
  console.log('🔧 환경변수 설정 도우미');
  console.log('='.repeat(50));
  console.log('API 키를 설정하여 자동으로 로드되도록 합니다.\n');

  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), 'env.example');

  // 기존 .env 파일이 있는지 확인
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️ .env 파일이 이미 존재합니다. 덮어쓰시겠습니까? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ 설정을 취소했습니다.');
      rl.close();
      return;
    }
  }

  console.log('\n📝 API 키를 입력해주세요 (건너뛰려면 Enter):\n');

  // OpenAI API 키
  const openaiKey = await question('🤖 OpenAI API 키: ');
  
  // Gemini API 키
  const geminiKey = await question('🧠 Google Gemini API 키: ');
  
  // 네이버 API 키
  console.log('\n🌐 네이버 API 설정 (대량 크롤링용):');
  const naverClientId = await question('   네이버 클라이언트 ID: ');
  const naverClientSecret = await question('   네이버 클라이언트 시크릿: ');
  
  // Google API 키
  console.log('\n🔍 Google API 설정 (대량 크롤링용):');
  const googleApiKey = await question('   Google API 키: ');
  const googleCseId = await question('   Google CSE ID: ');

  // 환경변수 파일 생성
  const envContent = `# 환경변수 설정 파일
# ${new Date().toISOString()}에 생성됨

# OpenAI API 키
OPENAI_API_KEY=${openaiKey || 'your_openai_api_key_here'}

# Google Gemini API 키
GEMINI_API_KEY=${geminiKey || 'your_gemini_api_key_here'}

# 네이버 API 설정 (대량 크롤링용)
NAVER_CLIENT_ID=${naverClientId || 'your_naver_client_id_here'}
NAVER_CLIENT_SECRET=${naverClientSecret || 'your_naver_client_secret_here'}

# Google API 설정 (대량 크롤링용)
GOOGLE_API_KEY=${googleApiKey || 'your_google_api_key_here'}
GOOGLE_CSE_ID=${googleCseId || 'your_google_cse_id_here'}

# 대량 크롤링 설정
MASS_CRAWLING_ENABLED=true
MAX_CONCURRENT_REQUESTS=20
MAX_RESULTS_PER_SOURCE=1000
ENABLE_FULL_CONTENT_CRAWLING=true

# 성능 최적화 설정
CRAWLING_TIMEOUT=30000
RSS_FEED_TIMEOUT=10000
NAVER_API_TIMEOUT=10000
CSE_API_TIMEOUT=10000

# 캐시 설정
ENABLE_CACHING=true
CACHE_EXPIRY_SECONDS=3600
CACHE_MAX_SIZE=1000

# 로깅 설정
LOG_LEVEL=info
LOG_FILE=logs/crawler.log
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_DETAILED_LOGGING=true

# 성능 설정
PERFORMANCE_MONITORING=true
MEMORY_LIMIT_MB=1024
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env 파일이 성공적으로 생성되었습니다!');
    console.log(`📁 위치: ${envPath}`);
    
    // 설정된 키 개수 확인
    const setKeys = [];
    if (openaiKey) setKeys.push('OpenAI');
    if (geminiKey) setKeys.push('Gemini');
    if (naverClientId) setKeys.push('네이버');
    if (googleApiKey) setKeys.push('Google CSE');
    
    if (setKeys.length > 0) {
      console.log(`🔑 설정된 API 키: ${setKeys.join(', ')}`);
    } else {
      console.log('⚠️ API 키가 설정되지 않았습니다. 나중에 .env 파일을 직접 편집하세요.');
    }
    
    console.log('\n🚀 이제 앱을 실행하면 환경변수에서 자동으로 API 키를 로드합니다!');
    
  } catch (error) {
    console.error('❌ .env 파일 생성 실패:', error);
  }

  rl.close();
}

// 스크립트 실행
setupEnvironment().catch(console.error);






























