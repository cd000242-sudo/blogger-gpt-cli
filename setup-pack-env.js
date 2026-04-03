#!/usr/bin/env node

/**
 * Pack 빌드 시 자동 환경설정 파일 생성
 * 배포용 기본 환경설정을 자동으로 설정합니다.
 */

const fs = require('fs');
const path = require('path');

function setupPackEnvironment() {
  console.log('🔧 Pack 빌드용 환경설정 자동 설정 시작...');

  try {
    // dist 디렉토리가 있는지 확인
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      console.log('❌ dist 디렉토리가 존재하지 않습니다. 먼저 npm run build를 실행하세요.');
      return;
    }

    // 기본 환경설정 파일 생성
    const defaultEnv = `# Pack 빌드용 기본 환경설정
# 이 파일은 배포 시 자동으로 생성되었습니다.

# 기본 AI 모델 설정 (배포용 기본값)
GEMINI_API_KEY=demo_key_for_pack_build
OPENAI_API_KEY=demo_key_for_pack_build

# 기본 네이버 API 설정 (배포용 기본값)
NAVER_CLIENT_ID=demo_client_id_for_pack_build
NAVER_CLIENT_SECRET=demo_client_secret_for_pack_build

# 기본 Google API 설정 (배포용 기본값)
GOOGLE_API_KEY=demo_google_key_for_pack_build
GOOGLE_CSE_ID=demo_cse_id_for_pack_build

# 기본 플랫폼 설정
PLATFORM=wordpress

# 기본 크롤링 설정
MASS_CRAWLING_ENABLED=false
MAX_CONCURRENT_REQUESTS=5
MAX_RESULTS_PER_SOURCE=100

# 기본 타임아웃 설정
CRAWLING_TIMEOUT=15000
RSS_FEED_TIMEOUT=5000
NAVER_API_TIMEOUT=5000
CSE_API_TIMEOUT=5000

# 캐시 설정 (배포용 최소화)
ENABLE_CACHING=false
CACHE_EXPIRY_SECONDS=1800
CACHE_MAX_SIZE=100

# Puppeteer 설정
PUPPETEER_HEADLESS=true
PUPPETEER_TIMEOUT=15000

# 로깅 설정 (배포용 최소화)
LOG_LEVEL=warn
ENABLE_PERFORMANCE_MONITORING=false
ENABLE_DETAILED_LOGGING=false

# 성능 설정
PERFORMANCE_MONITORING=false
MEMORY_LIMIT_MB=512

# LEWORD API 키 (배포용 기본값)
LEWORD_API_KEY=demo_leword_key_for_pack_build
`;

    // dist 디렉토리에 .env 파일 생성
    const envPath = path.join(distDir, '.env');
    fs.writeFileSync(envPath, defaultEnv, 'utf8');

    console.log('✅ Pack 빌드용 환경설정 파일 생성 완료:', envPath);
    console.log('📋 생성된 설정 내용:');
    console.log('   - 기본 AI API 키 설정됨');
    console.log('   - 기본 네이버/구글 API 설정됨');
    console.log('   - LEWORD API 키 설정됨');
    console.log('   - 크롤링 및 성능 설정 최적화됨');
    console.log('   - 캐시 및 로깅 최소화됨');
    console.log('');
    console.log('⚠️  주의: 이 설정은 배포용 기본값입니다.');
    console.log('   실제 사용 시 각 API 키를 실제 값으로 교체하세요.');

  } catch (error) {
    console.error('❌ Pack 환경설정 생성 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  setupPackEnvironment();
}

module.exports = { setupPackEnvironment };

