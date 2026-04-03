/**
 * 🧪 Gemini API 직접 연결 테스트 + 내부 일관성 모드 검증
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadEnvFromFile } = require('./dist/env');
const fs = require('fs');

async function main() {
    const env = loadEnvFromFile();
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY가 없습니다!');
        process.exit(1);
    }

    console.log(`✅ Gemini API Key: ${apiKey.substring(0, 10)}...`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // 모델 목록 순서대로 시도
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    for (const modelName of models) {
        console.log(`\n🤖 ${modelName} 시도 중...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await Promise.race([
                model.generateContent('한국어로 "안녕하세요"를 포함한 짧은 문장 하나만 출력하세요.'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 15000))
            ]);
            const text = result.response.text();
            console.log(`✅ ${modelName} 성공: "${text.trim().substring(0, 100)}"`);

            // 성공한 모델로 내부 일관성 모드 시뮬레이션
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🔥 ${modelName}로 내부 일관성 모드 본문 생성 테스트...`);

            const { INTERNAL_CONSISTENCY_SECTIONS } = require('./dist/core/max-mode-structure');
            const keyword = '재택근무 생산성 높이는 법';
            const h2Titles = INTERNAL_CONSISTENCY_SECTIONS.map(sec => sec.title);

            console.log('📋 H2 섹션 (INTERNAL_CONSISTENCY_SECTIONS):');
            h2Titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

            const sectionPrompt = `
키워드: "${keyword}"
아래 H2 소제목에 맞는 시리즈형 블로그 글의 서론(200자)과 첫 번째 섹션의 H3 소제목 2개를 생성해주세요.

H2 소제목:
${h2Titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

📺 시리즈형 글 규칙:
- "~해요", "~거든요" 친근한 말투
- 시리즈 맥락 제공 ("이번 시리즈에서는...")
- 한국어로 작성

JSON 형식으로만 출력:
{"introduction": "서론 텍스트", "firstSectionH3s": ["H3-1", "H3-2"]}
`;

            const sectionResult = await Promise.race([
                model.generateContent(sectionPrompt),
                new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 30000))
            ]);
            const sectionText = sectionResult.response.text();
            console.log(`\n📝 생성 결과 (${sectionText.length}자):`);
            console.log(sectionText.substring(0, 500));

            // JSON 파싱 시도
            try {
                const jsonMatch = sectionText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log(`\n✅ JSON 파싱 성공!`);
                    console.log(`   서론: "${(parsed.introduction || '').substring(0, 100)}..."`);
                    console.log(`   H3: ${JSON.stringify(parsed.firstSectionH3s)}`);
                }
            } catch (e) {
                console.log('⚠️ JSON 파싱 실패 (하지만 텍스트 생성은 성공)');
            }

            console.log(`\n${'='.repeat(50)}`);
            console.log('🎉 Gemini API 연결 + 내부 일관성 모드 구조 확인 완료!');
            console.log('👉 앱에서 "내부 일관성" 모드로 블로그스팟 발행 가능합니다.');
            process.exit(0);

        } catch (err) {
            console.log(`⚠️ ${modelName} 실패: ${err.message}`);
            continue;
        }
    }

    console.error('❌ 모든 Gemini 모델 실패');
    process.exit(1);
}

main();
