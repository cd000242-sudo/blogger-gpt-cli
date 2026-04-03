/**
 * 블로그스팟 글 생성 테스트 스크립트
 * 키워드: 민간 건축물 그린리모델링 이자 지원 (창호 교체 최대 3000만원)
 */

const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
const fs = require('fs');
const path = require('path');

const keyword = '민간 건축물 그린리모델링 이자 지원 창호 교체 최대 3000만원';

console.log('🚀 블로그스팟 글 생성 테스트 시작');
console.log('📝 키워드:', keyword);
console.log('🎯 플랫폼: blogspot\n');

const payload = {
    topic: keyword,
    platform: 'blogspot',
    h2ImageSource: 'nanobananapro',
    skipImages: true,  // 이미지 생성 스킵 (빠른 테스트)
    fastMode: true
};

const env = {};

// 로그 콜백
const onLog = (msg) => {
    console.log(msg);
};

// 글 생성 실행
generateUltimateMaxModeArticleFinal(payload, env, onLog)
    .then(result => {
        console.log('\n✅ 글 생성 성공!');
        console.log('📌 제목:', result.title);
        console.log('🏷️ 태그:', result.labels.join(', '));
        console.log('📄 HTML 길이:', result.html.length, '자');

        // 결과를 파일로 저장
        const outputPath = path.join(__dirname, 'test-output.html');
        fs.writeFileSync(outputPath, result.html, 'utf-8');
        console.log('\n📁 결과 저장됨:', outputPath);
    })
    .catch(err => {
        console.error('\n❌ 글 생성 실패:', err.message);
        console.error(err.stack);
    });
