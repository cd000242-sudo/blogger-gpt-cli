/**
 * 🧪 내부 일관성 모드 구조 검증 (API 호출 없이)
 */
const { INTERNAL_CONSISTENCY_SECTIONS } = require('./dist/core/max-mode-structure');
const fs = require('fs');

console.log('=== 내부 일관성 모드 구조 검증 ===\n');

// 1. INTERNAL_CONSISTENCY_SECTIONS 구조 확인
console.log('📋 INTERNAL_CONSISTENCY_SECTIONS 구조:');
if (!INTERNAL_CONSISTENCY_SECTIONS || !Array.isArray(INTERNAL_CONSISTENCY_SECTIONS)) {
    console.error('❌ INTERNAL_CONSISTENCY_SECTIONS가 없거나 배열이 아님!');
    process.exit(1);
}

INTERNAL_CONSISTENCY_SECTIONS.forEach((sec, i) => {
    console.log(`  ${i + 1}. title: "${sec.title}"`);
    if (sec.h3) console.log(`     h3: ${JSON.stringify(sec.h3)}`);
});

// 2. dist/core/ultimate-final-functions.js 코드 경로 검증
const jsContent = fs.readFileSync('./dist/core/ultimate-final-functions.js', 'utf-8');

const checks = [
    { name: 'INTERNAL_CONSISTENCY_SECTIONS import', pattern: /max-mode-structure/ },
    { name: 'contentMode extraction before H2', pattern: /contentMode.*=.*payload.*\.contentMode.*\|\|.*external/ },
    { name: "contentMode === 'internal' branch", pattern: /contentMode\s*===\s*'internal'/ },
    { name: 'INTERNAL_CONSISTENCY_SECTIONS.map usage', pattern: /INTERNAL_CONSISTENCY_SECTIONS.*\.map/ },
    { name: 'generateAllSectionsFinal with contentMode', pattern: /generateAllSectionsFinal.*contentMode/ },
    { name: '시리즈형 내부 일관성 모드 prompt', pattern: /시리즈형|TV.*에피소드|시리즈 모드/ },
    { name: 'internal palette CSS', pattern: /INTERNAL_PALETTE/ },
];

console.log('\n📊 컴파일된 JS 코드 경로 검증:');
let allPassed = true;
checks.forEach(({ name, pattern }) => {
    const found = pattern.test(jsContent);
    console.log(`  ${found ? '✅' : '❌'} ${name}`);
    if (!found) allPassed = false;
});

// 3. H2 타이틀 시뮬레이션
const keyword = '재택근무 생산성 높이는 법';
const h2Titles = INTERNAL_CONSISTENCY_SECTIONS.map(sec => {
    return sec.title.replace('[주제]', keyword).replace('[소주제]', keyword);
});

console.log('\n📌 시뮬레이션 — contentMode="internal" 시 생성될 H2 타이틀:');
h2Titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

console.log(`\n${'='.repeat(40)}`);
console.log(allPassed ? '✅ 모든 구조 검증 통과!' : '⚠️ 일부 검증 실패 — 위 ❌ 항목 확인');
process.exit(allPassed ? 0 : 1);
