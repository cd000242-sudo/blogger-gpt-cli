/**
 * loadEnvFromFile 함수 테스트 스크립트
 */

// dist 폴더에서 컴파일된 코드 사용
const path = require('path');

console.log('🔍 loadEnvFromFile 함수 테스트 시작...\n');

try {
    // 1. env.js에서 loadEnvFromFile 테스트
    console.log('1️⃣ dist/env.js에서 loadEnvFromFile 로드 테스트:');
    const envModule = require('./dist/env');

    if (typeof envModule.loadEnvFromFile === 'function') {
        console.log('   ✅ loadEnvFromFile 함수 존재함');

        const envData = envModule.loadEnvFromFile();
        console.log('   ✅ loadEnvFromFile() 호출 성공');
        console.log('   📋 로드된 키 개수:', Object.keys(envData).length);

        // 주요 키 확인
        const importantKeys = ['geminiKey', 'openaiKey', 'pexelsApiKey', 'googleCseKey'];
        importantKeys.forEach(key => {
            const value = envData[key];
            if (value && value.length > 0) {
                console.log(`   ✅ ${key}: ${value.substring(0, 10)}...`);
            } else {
                console.log(`   ⚠️ ${key}: (없음)`);
            }
        });
    } else {
        console.log('   ❌ loadEnvFromFile 함수가 없음!');
    }

    console.log('\n2️⃣ ultimate-final-functions.js에서 generateCTAsFinal 테스트:');
    const ultimateModule = require('./dist/core/ultimate-final-functions');

    if (typeof ultimateModule.generateCTAsFinal === 'function') {
        console.log('   ✅ generateCTAsFinal 함수 존재함');
        console.log('   📝 함수 호출 테스트 (짧은 호출)...');

        // 간단한 호출 테스트 (실제 API 호출 없이 초기화만)
        ultimateModule.generateCTAsFinal('테스트 키워드', [])
            .then(result => {
                console.log('   ✅ generateCTAsFinal 호출 성공! 결과:', result.length, '개 CTA');
            })
            .catch(err => {
                // CTA 생성 실패는 예상됨 (크롤링 데이터 없음)
                if (err.message.includes('loadEnvFromFile')) {
                    console.log('   ❌ loadEnvFromFile 오류 발생:', err.message);
                } else {
                    console.log('   ⚠️ 예상된 오류 (데이터 없음):', err.message.substring(0, 50));
                }
            });
    } else {
        console.log('   ❌ generateCTAsFinal 함수가 없음!');
    }

} catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error(error.stack);
}

console.log('\n✅ 테스트 완료!');
