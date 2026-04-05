/**
 * 릴리즈 전 체크리스트 — npm run pre-release로 실행
 */
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔍 릴리즈 전 체크리스트\n');

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ${name}: ${e.message}`);
    failed++;
  }
}

// 1. TypeScript 컴파일
check('TypeScript 컴파일 (tsc --noEmit)', () => {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  return true;
});

check('Electron TypeScript', () => {
  execSync('npx tsc -p tsconfig.electron.json --noEmit', { stdio: 'pipe' });
  return true;
});

// 2. 빌드
check('npm run build', () => {
  execSync('npm run build', { stdio: 'pipe' });
  return true;
});

// 3. 테스트
check('Jest 테스트', () => {
  execSync('npx jest --passWithNoTests', { stdio: 'pipe' });
  return true;
});

// 4. 핵심 파일 존재
check('electron/ui/index.html 존재', () => fs.existsSync('electron/ui/index.html'));
check('electron/ui/script.js 존재', () => fs.existsSync('electron/ui/script.js'));
check('electron/auth-utils.js 빌드됨', () => fs.existsSync('electron/auth-utils.js'));
check('electron/quota-manager.js 빌드됨', () => fs.existsSync('electron/quota-manager.js'));

// 5. 버전 확인
check('package.json 버전', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`   버전: ${pkg.version}`);
  return !!pkg.version;
});

// 6. electron-builder 설정
check('electron-builder.yml publish 설정', () => {
  const yml = fs.readFileSync('electron-builder.yml', 'utf8');
  return yml.includes('provider: github');
});

console.log(`\n${'─'.repeat(40)}`);
console.log(`결과: ${passed} 통과, ${failed} 실패`);
if (failed > 0) {
  console.log('\n❌ 릴리즈 불가 — 위 오류를 수정하세요');
  process.exit(1);
} else {
  console.log('\n✅ 릴리즈 준비 완료!');
}
