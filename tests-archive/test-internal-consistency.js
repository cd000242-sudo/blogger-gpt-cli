/**
 * 🧪 내부 일관성 모드 테스트 — 실제 발행까지
 */
const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
const { loadEnvFromFile } = require('./dist/env');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔥 내부 일관성(시리즈) 모드 테스트 시작...');

    // 환경 변수 로드
    const env = loadEnvFromFile();
    console.log('✅ 환경 변수 로드 완료');

    const payload = {
        keyword: '재택근무 생산성 높이는 법',
        platform: 'blogspot',
        contentMode: 'internal',  // 🔥 핵심: 내부 일관성 모드
        useKeywordAsTitle: false,
        keywordFront: false,
        sectionCount: 5,
        manualUrls: [],
        manualCtas: [],
        imageOption: 'none',      // 이미지 생성 없이 빠르게 테스트
    };

    console.log(`📋 키워드: "${payload.keyword}"`);
    console.log(`📋 플랫폼: ${payload.platform}`);
    console.log(`📋 콘텐츠 모드: ${payload.contentMode}`);
    console.log('');

    try {
        const result = await generateUltimateMaxModeArticleFinal(payload, env, (log) => {
            console.log(log);
        });

        console.log('\n\n============================');
        console.log('✅ 생성 완료!');
        console.log(`📌 제목: ${result.title}`);
        console.log(`📌 라벨: ${result.labels?.join(', ')}`);
        console.log(`📌 HTML 길이: ${result.html.length}자`);

        // HTML 파일로 저장
        const outputPath = path.join(__dirname, 'test-internal-consistency-output.html');
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
        console.log(`💾 HTML 저장: ${outputPath}`);

        // 📌 시리즈 구조 확인 (H2 제목에 시리즈 키워드가 포함되었는지)
        const h2Matches = result.html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
        console.log('\n📊 H2 섹션 분석:');
        h2Matches.forEach((h2, i) => {
            const text = h2.replace(/<[^>]*>/g, '').trim();
            console.log(`  ${i + 1}. ${text}`);
        });

        // 시리즈 키워드 체크
        const seriesKeywords = ['시리즈', '에피소드', '핵심', '다음 편', '오늘의'];
        const htmlLower = result.html.toLowerCase();
        const foundKeywords = seriesKeywords.filter(kw => htmlLower.includes(kw));
        if (foundKeywords.length > 0) {
            console.log(`\n🎯 시리즈 모드 키워드 발견: ${foundKeywords.join(', ')}`);
        } else {
            console.log('\n⚠️ 시리즈 모드 키워드 미발견 — 일반 모드로 생성된 가능성 있음');
        }

    } catch (err) {
        console.error('❌ 에러 발생:', err);
        process.exit(1);
    }
}

main();
