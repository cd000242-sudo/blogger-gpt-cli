// 내부 일관성 모드 테스트 (이미지 스킵, 글 생성만)
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions.js');
const { loadEnvFromFile } = require('./dist/env.js');
const fs = require('fs');
const path = require('path');

async function testConsistencyMode() {
    console.log('');
    console.log('============================================');
    console.log('   🕸️ 내부 일관성 모드 테스트');
    console.log('============================================');
    console.log('');

    const env = loadEnvFromFile();

    const payload = {
        topic: '홈카페 원두 선택 가이드',
        platform: 'wordpress',
        contentMode: 'internal',    // 🕸️ 내부 일관성 모드!
        skipImages: true,           // 이미지 스킵 (글 구조만 확인)
        fastMode: true,
    };

    const logs = [];
    const onLog = (msg) => {
        console.log('[LOG]', msg);
        logs.push(msg);
    };

    const startTime = Date.now();

    try {
        console.log('🚀 콘텐츠 생성 시작...');
        console.log('   키워드:', payload.topic);
        console.log('   모드: 내부 일관성 (internal)');
        console.log('   이미지: 스킵');
        console.log('');

        const result = await generateUltimateMaxModeArticleFinal(payload, env, onLog);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('');
        console.log('============================================');
        console.log('   ✅ 생성 완료!');
        console.log('============================================');
        console.log('   제목:', result.title);
        console.log('   HTML 길이:', result.html.length, '자');
        console.log('   소요 시간:', duration, '초');
        console.log('   태그:', (result.labels || []).join(', '));
        console.log('');

        // HTML 파일로 저장 (브라우저에서 확인용)
        const outputPath = path.join(__dirname, 'test-consistency-output.html');
        const fullHtml = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.title}</title>
</head>
<body style="margin:0;padding:40px 20px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div class="bgpt-content" style="max-width:800px;margin:0 auto;">
    ${result.html}
  </div>
</body>
</html>`;
        fs.writeFileSync(outputPath, fullHtml, 'utf-8');
        console.log('📄 HTML 저장:', outputPath);
        console.log('');

        // H2 제목들 추출해서 보여주기
        const h2Regex = /<h2[^>]*>(.*?)<\/h2>/gi;
        let match;
        const h2s = [];
        while ((match = h2Regex.exec(result.html)) !== null) {
            h2s.push(match[1].replace(/<[^>]+>/g, '').trim());
        }

        console.log('📋 H2 소제목 구조:');
        h2s.forEach((h2, i) => {
            console.log(`   ${i + 1}. ${h2}`);
        });
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ 오류:', error.message);
        if (error.stack) {
            console.error('스택:', error.stack.split('\n').slice(0, 5).join('\n'));
        }
    }
}

testConsistencyMode();
