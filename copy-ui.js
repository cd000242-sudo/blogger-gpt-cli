const fs = require('fs');
const path = require('path');

// 디렉토리 생성
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 파일 복사 (UTF-8 유지, 에러 처리 강화)
function copyFile(src, dest) {
  try {
    const content = fs.readFileSync(src, 'utf8');
    ensureDir(path.dirname(dest));
    fs.writeFileSync(dest, content, 'utf8');
    console.log(`복사: ${src} -> ${dest}`);
  } catch (error) {
    console.error(`복사 실패: ${src} -> ${dest}`, error.message);
    throw error;
  }
}

// 디렉토리 복사 (에러 처리 강화)
function copyDir(src, dest) {
  try {
    ensureDir(dest);
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        // 텍스트 파일은 UTF-8로, 바이너리는 그대로 복사
        // .ts 소스 파일은 제외 (빌드 출력 디렉토리에는 컴파일된 .js만 있어야 함)
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.ts') {
          // .ts 소스 파일은 복사하지 않음 (컴파일된 .js만 사용)
          continue;
        }
        if (['.html', '.css', '.js', '.json', '.md', '.txt'].includes(ext)) {
          copyFile(srcPath, destPath);
        } else {
          try {
            fs.copyFileSync(srcPath, destPath);
            console.log(`바이너리 복사: ${srcPath} -> ${destPath}`);
          } catch (error) {
            console.error(`바이너리 복사 실패: ${srcPath} -> ${destPath}`, error.message);
          }
        }
      }
    }
  } catch (error) {
    console.error(`디렉토리 복사 실패: ${src} -> ${dest}`, error.message);
    throw error;
  }
}

// UI 파일 복사 (전체 프로세스 에러 처리)
try {
  console.log('UI 파일 복사 시작...');
  
  // electron/ui에서 UI 파일 복사
  console.log('electron/ui에서 UI 파일 복사...');
  copyDir('electron/ui', 'dist/ui');

  // 중요: TypeScript 빌드 결과인 preload.js를 electron/ui로 복사
  console.log('컴파일된 preload.js 복사...');
  if (fs.existsSync('electron/preload.js')) {
    copyFile('electron/preload.js', 'electron/ui/preload.js');
    console.log('✅ electron/preload.js -> electron/ui/preload.js 복사 완료');
  }
  
  // dist/ui로도 복사
  if (fs.existsSync('electron/preload.js')) {
    copyFile('electron/preload.js', 'dist/ui/preload.js');
    console.log('✅ electron/preload.js -> dist/ui/preload.js 복사 완료');
  }

  // blogger-publisher.js 파일 복사
  console.log('blogger-publisher.js 파일 복사...');
  if (fs.existsSync('src/core/blogger-publisher.js')) {
    copyFile('src/core/blogger-publisher.js', 'dist/src/core/blogger-publisher.js');
  } else {
    console.log('blogger-publisher.js 파일이 존재하지 않습니다. 건너뜁니다.');
  }

  console.log('UI 파일 복사 완료!');
} catch (error) {
  console.error('UI 파일 복사 중 오류 발생:', error.message);
  process.exit(1);
}



