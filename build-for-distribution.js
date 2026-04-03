const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 배포용 빌드 시작...');

// 1. 기존 빌드 파일들 정리
console.log('📁 기존 빌드 파일 정리 중...');
if (fs.existsSync('dist')) {
  removeDir('dist');
}

// 디렉토리 삭제 함수 (재귀적)
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        removeDir(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    
    fs.rmdirSync(dirPath);
    console.log(`✅ 삭제됨: ${dirPath}`);
  }
}

// 2. 일반 빌드 실행
console.log('🔨 일반 빌드 실행 중...');
execSync('npm run build', { stdio: 'inherit' });

// 3. 민감한 파일들 제거
console.log('🔒 민감한 파일들 제거 중...');
const sensitiveFiles = [
  'dist/user-config.json',
  'dist/token.json',
  'dist/.env',
  'dist/.env.local'
];

sensitiveFiles.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`❌ 제거됨: ${file}`);
  }
});

// 4. 백업 폴더들 제거
console.log('🗑️ 백업 폴더들 제거 중...');
const backupFolders = [
  'backup_20251007_234045',
  'backup_20251008_003644', 
  'backup_20251008_021055',
  'src_backup_20251008_123543'
];

backupFolders.forEach(folder => {
  if (fs.existsSync(folder)) {
    removeDir(folder);
  }
});

// 5. 임시 썸네일 파일들 제거
console.log('🖼️ 임시 썸네일 파일들 제거 중...');
const thumbFiles = fs.readdirSync('.').filter(file => 
  file.startsWith('thumb-') && (file.endsWith('.png') || file.endsWith('.html'))
);

thumbFiles.forEach(file => {
  fs.unlinkSync(file);
  console.log(`❌ 제거됨: ${file}`);
});

// 6. 템플릿 파일 복사
console.log('📋 템플릿 파일 복사 중...');
if (fs.existsSync('user-config.template.json')) {
  fs.copyFileSync('user-config.template.json', 'dist/user-config.template.json');
  console.log('✅ 복사됨: user-config.template.json');
}

// 7. README 파일 생성
console.log('📖 README 파일 생성 중...');
const readmeContent = `# Blogger GPT CLI

## 설치 및 설정

1. 애플리케이션을 실행하세요
2. 환경 설정 탭에서 다음 정보를 입력하세요:
   - API 키들 (OpenAI, Claude, Gemini, Pexels 등)
   - Google Custom Search Engine 설정
   - WordPress 연결 정보 (선택사항)

## 사용법

1. **포스팅 작성**: 키워드를 입력하고 포스팅을 생성하세요
2. **썸네일 생성**: 텍스트 기반 썸네일이나 이미지 변환을 사용하세요
3. **달력**: 작업 기록을 확인하고 관리하세요

## 주의사항

- API 키는 안전하게 보관하세요
- 정기적으로 백업을 수행하세요
- 사용 전에 모든 설정을 확인하세요

## 지원

문제가 발생하면 개발자에게 문의하세요.
`;

fs.writeFileSync('dist/README.md', readmeContent, 'utf8');
console.log('✅ 생성됨: README.md');

console.log('🎉 배포용 빌드 완료!');
console.log('📦 dist/ 폴더의 내용을 패키징하여 배포하세요.');
