const fs = require('fs');

const filePath = 'src/core/index.ts';

console.log('🔧 Final fix: Removing broken code...');

// 파일 읽기
let content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log(`Total lines: ${lines.length}`);

if (lines.length < 1488) {
  console.log(`❌ File is shorter than expected (${lines.length} lines)`);
  process.exit(1);
}

// 61줄부터 1487줄까지 삭제
// 1-60줄 유지 (인덱스 0-59)
// 1488줄 이후 유지 (인덱스 1487부터)

const keepLines = [
  ...lines.slice(0, 60),  // 0-59
  '',                     // 빈 줄
  ...lines.slice(1487)   // 1487부터 끝까지
];

const newContent = keepLines.join('\n');

// 백업
const backupPath = filePath + '.backup-final-fix';
fs.writeFileSync(backupPath, content, 'utf-8');
console.log(`✅ Backup: ${backupPath}`);

// 저장
fs.writeFileSync(filePath, newContent, 'utf-8');

console.log(`✅ Fixed!`);
console.log(`   Removed: ${lines.length - keepLines.length} lines (61-1487)`);
console.log(`   Old: ${lines.length} lines`);
console.log(`   New: ${keepLines.length} lines`);

// 검증
const detectCount = newContent.split('\n').filter(l => l.trim().startsWith('function detectTargetYear')).length;
console.log(`   detectTargetYear functions: ${detectCount} (should be 1)`);

if (detectCount === 1) {
  console.log('✅ Success: Only 1 detectTargetYear function found');
} else {
  console.log(`⚠️  Warning: Found ${detectCount} detectTargetYear functions`);
}













