/**
 * 라이선스 통합 검증 스크립트
 * 
 * 클라이언트 코드가 올바르게 구현되었는지 검증합니다.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 라이선스 통합 검증 시작...\n');

let allPassed = true;

// 1. license-validator.ts 확인
console.log('1️⃣ license-validator.ts 확인...');
const validatorPath = path.join(__dirname, 'src', 'utils', 'license-validator.ts');
if (fs.existsSync(validatorPath)) {
  const content = fs.readFileSync(validatorPath, 'utf8');
  
  const checks = {
    'getServerTime 함수 존재': content.includes('async function getServerTime'),
    'Google Apps Script URL 형식 지원': content.includes('script.google.com') && content.includes('?path=time'),
    '일반 서버 URL 형식 지원': content.includes('/time'),
    '서버 시간 캐싱': content.includes('SERVER_TIME_CACHE_TTL'),
    '타임아웃 처리': content.includes('timeout: 3000'),
    'validateLicenseStrict 함수 존재': content.includes('validateLicenseStrict'),
    '시스템 시간 조작 감지': content.includes('timeDiff') && content.includes('localTime < serverTime'),
  };
  
  Object.entries(checks).forEach(([check, passed]) => {
    if (passed) {
      console.log(`   ✅ ${check}`);
    } else {
      console.log(`   ❌ ${check}`);
      allPassed = false;
    }
  });
} else {
  console.log('   ❌ 파일이 없습니다!');
  allPassed = false;
}

// 2. electron/main.ts 확인
console.log('\n2️⃣ electron/main.ts 확인...');
const mainPath = path.join(__dirname, 'electron', 'main.ts');
if (fs.existsSync(mainPath)) {
  const content = fs.readFileSync(mainPath, 'utf8');
  
  const checks = {
    'validateLicenseStrict 사용': content.includes('validateLicenseStrict'),
    'license-status-new 핸들러': content.includes('license-status-new'),
    '서버 시간 반환': content.includes('serverTime'),
    '시간 차이 반환': content.includes('timeDiff'),
  };
  
  Object.entries(checks).forEach(([check, passed]) => {
    if (passed) {
      console.log(`   ✅ ${check}`);
    } else {
      console.log(`   ❌ ${check}`);
      allPassed = false;
    }
  });
} else {
  console.log('   ❌ 파일이 없습니다!');
  allPassed = false;
}

// 3. UI script.js 확인
console.log('\n3️⃣ electron/ui/script.js 확인...');
const scriptPath = path.join(__dirname, 'electron', 'ui', 'script.js');
if (fs.existsSync(scriptPath)) {
  const content = fs.readFileSync(scriptPath, 'utf8');
  
  const checks = {
    '주기적 만료 체크 (1분)': content.includes('60 * 1000') && content.includes('license-status-new'),
    'UI 차단 함수': content.includes('blockUIForInvalidLicense'),
    '만료 감지 시 차단': content.includes('status.valid === false'),
  };
  
  Object.entries(checks).forEach(([check, passed]) => {
    if (passed) {
      console.log(`   ✅ ${check}`);
    } else {
      console.log(`   ❌ ${check}`);
      allPassed = false;
    }
  });
} else {
  console.log('   ❌ 파일이 없습니다!');
  allPassed = false;
}

// 4. 빌드된 파일 확인
console.log('\n4️⃣ 빌드된 파일 확인...');
const distValidatorPath = path.join(__dirname, 'dist', 'src', 'utils', 'license-validator.js');
if (fs.existsSync(distValidatorPath)) {
  console.log('   ✅ license-validator.js 빌드됨');
} else {
  console.log('   ⚠️  license-validator.js 빌드되지 않음 (빌드 필요)');
}

// 5. 테스트 스크립트 확인
console.log('\n5️⃣ 테스트 스크립트 확인...');
const testScriptPath = path.join(__dirname, 'test-server-time-api.js');
if (fs.existsSync(testScriptPath)) {
  console.log('   ✅ test-server-time-api.js 존재');
} else {
  console.log('   ⚠️  test-server-time-api.js 없음');
}

// 최종 결과
console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('✅ 모든 검증 통과!');
  console.log('\n📝 다음 단계:');
  console.log('   1. Google Apps Script에 doGet 함수 추가 확인');
  console.log('   2. 웹 앱으로 배포 확인');
  console.log('   3. .env 파일에 LICENSE_SERVER_URL 설정');
  console.log('   4. 앱 재시작 후 테스트');
} else {
  console.log('❌ 일부 검증 실패');
  console.log('   위의 실패 항목을 확인하세요.');
}
console.log('='.repeat(50));

process.exit(allPassed ? 0 : 1);






