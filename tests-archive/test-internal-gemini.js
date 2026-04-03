/**
 * 🧪 내부 일관성 모드 Gemini 테스트 — AI_PROVIDER=gemini 강제
 */

// 🔥 환경 변수 강제 설정 — OpenAI 사용 안 함
process.env.AI_PROVIDER = 'gemini';
process.env.OPENAI_API_KEY = '';  // OpenAI 시도 방지

const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');
const { loadEnvFromFile } = require('./dist/env');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('🔥 내부 일관성(시리즈) 모드 — Gemini 전용 테스트');
    console.log('='.repeat(50));

    const env = loadEnvFromFile();
    // OpenAI 키 제거하여 Gemini만 사용하도록 강제
    env.OPENAI_API_KEY = '';
    env.AI_PROVIDER = 'gemini';

    console.log(`✅ GEMINI_API_KEY: ${env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`✅ AI_PROVIDER: gemini (강제)`);

    const payload = {
        keyword: '재택근무 생산성 높이는 법',
        platform: 'blogspot',
        contentMode: 'internal',  // 🔥 핵심: 내부 일관성 모드
        useKeywordAsTitle: false,
        keywordFront: false,
        sectionCount: 5,
        manualUrls: [],
        manualCtas: [],
        imageOption: 'none',
    };

    console.log(`\n📋 키워드: "${payload.keyword}"`);
    console.log(`📋 contentMode: ${payload.contentMode}`);
    console.log('');

    // 타임아웃 설정 (3분)
    const timeout = setTimeout(() => {
        console.error('\n⏰ 타임아웃 (3분). 테스트 종료.');
        process.exit(1);
    }, 180000);

    try {
        const result = await generateUltimateMaxModeArticleFinal(payload, env, (log) => {
            console.log(log);
        });

        clearTimeout(timeout);

        console.log('\n' + '='.repeat(50));
        console.log('✅ 생성 완료!');
        console.log(`📌 제목: ${result.title}`);
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

        // H2 섹션 분석
        const h2Matches = result.html.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
        console.log('\n📊 H2 섹션:');
        h2Matches.forEach((h2, i) => {
            const text = h2.replace(/<[^>]*>/g, '').trim();
            console.log(`  ${i + 1}. ${text}`);
        });

        // 시리즈 구조 키워드 체크
        const seriesKeywords = ['시리즈', '도입', '핵심 지식', '심화', '오늘의 핵심', '다음 편'];
        const found = seriesKeywords.filter(kw => result.html.includes(kw));
        console.log(`\n🎯 시리즈 구조 키워드 ${found.length}/${seriesKeywords.length}개 발견: ${found.join(', ')}`);

    } catch (err) {
        clearTimeout(timeout);
        console.error('❌ 에러:', err.message || err);
        process.exit(1);
    }
}

main();
