const fs = require('fs');
const path = require('path');

console.log('=== src/ui -> electron/ui 복사 시작 ===\n');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  const content = fs.readFileSync(src);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, content);
  console.log(`✓ 복사: ${src} -> ${dest}`);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

// src/ui -> electron/ui 복사
copyDir('src/ui', 'electron/ui');

// 확인
const indexPath = 'electron/ui/index.html';
const content = fs.readFileSync(indexPath, 'utf8');
console.log(`\n파일 크기: ${(content.length / 1024).toFixed(1)} KB`);
console.log(`한글 확인: ${content.includes('블로거') && content.includes('환경') ? '✓ 정상' : '✗ 문제 있음'}`);

console.log('\n=== 복사 완료! ===');



