const fs = require('fs');
const path = require('path');

console.log('🧹 Node.js로 파일 정리 시작...');

// 디렉토리 삭제 함수 (재귀적)
function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        removeDir(filePath); // 재귀적으로 하위 디렉토리 삭제
      } else {
        fs.unlinkSync(filePath); // 파일 삭제
      }
    });
    
    fs.rmdirSync(dirPath); // 빈 디렉토리 삭제
    console.log(`✅ 삭제됨: ${dirPath}`);
  }
}

// 파일 삭제 함수
function removeFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✅ 삭제됨: ${filePath}`);
  }
}

// 정리할 항목들
const itemsToClean = [
  'dist',
  'release',
  '.tsbuildinfo'
];

// 정리 실행
itemsToClean.forEach(item => {
  if (fs.existsSync(item)) {
    const stat = fs.statSync(item);
    if (stat.isDirectory()) {
      removeDir(item);
    } else {
      removeFile(item);
    }
  }
});

console.log('🎉 파일 정리 완료!');

