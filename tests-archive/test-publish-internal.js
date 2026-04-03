/**
 * 🔥 내부 일관성 모드 — 직접 Gemini 호출 + Blogger 발행
 * 
 * callGeminiWithGrounding 우회 → gemini-2.5-flash 직접 호출
 * generateUltimateMaxModeArticleFinal 대신 직접 HTML 생성 후 발행
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { loadEnvFromFile } = require('./dist/env');
const { INTERNAL_CONSISTENCY_SECTIONS } = require('./dist/core/max-mode-structure');
const { generateCSSFinal } = require('./dist/core/ultimate-final-functions');
const fs = require('fs');

async function main() {
    console.log('🔥 내부 일관성 모드 — Gemini 직접 호출 + Blogger 발행');
    console.log('='.repeat(60));

    const env = loadEnvFromFile();
    const apiKey = env.GEMINI_API_KEY || env.geminiKey;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY가 없습니다!');
        process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const keyword = '재택근무 생산성 높이는 법';

    console.log(`✅ Gemini API Key: ${apiKey.substring(0, 10)}...`);
    console.log(`📋 키워드: "${keyword}"`);
    console.log(`📋 contentMode: internal`);

    // === 1단계: H1 제목 생성 ===
    console.log('\n📝 1단계: H1 제목 생성...');
    const titleResult = await callWithTimeout(
        model.generateContent(`한국어 블로그 제목 생성. 키워드: "${keyword}". 이모지 1개 포함, 25~45자. 제목만 출력.`),
        15000
    );
    const title = titleResult.response.text().trim().split('\n')[0].replace(/["'*]/g, '');
    console.log(`✅ 제목: ${title}`);

    // === 2단계: H2 구조 (INTERNAL_CONSISTENCY_SECTIONS) ===
    const h2Titles = INTERNAL_CONSISTENCY_SECTIONS.map(s => s.title);
    console.log(`\n📝 2단계: 시리즈 구조 H2 (${h2Titles.length}개):`);
    h2Titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

    // === 3단계: 각 H2별 본문 생성 (시리즈형 프롬프트) ===
    console.log('\n📝 3단계: 각 섹션 본문 생성...');
    const sections = [];

    for (let i = 0; i < h2Titles.length; i++) {
        const h2 = h2Titles[i];
        console.log(`  🤖 H2 ${i + 1}/${h2Titles.length}: "${h2}" 생성 중...`);

        const sectionPrompt = `
키워드: "${keyword}"
시리즈형 블로그 글 — 이번 섹션: "${h2}"

📌 규칙:
- "~해요", "~거든요" 친근한 말투
- 시리즈 맥락 유지 ("이번 시리즈에서는...")
- H3 소제목 2~3개 생성
- 각 H3당 300자 이상 작성
- HTML 형식으로 출력 (<h3>, <p>, <ul>, <li> 등)
- 한국어로만 작성
- <h2> 태그는 포함하지 마세요

출력: HTML만 (설명 없이)
`;

        try {
            const sectionResult = await callWithTimeout(
                model.generateContent(sectionPrompt),
                30000
            );
            const sectionHtml = sectionResult.response.text()
                .replace(/```html\n?/g, '')
                .replace(/```\n?/g, '')
                .trim();
            sections.push({ h2, html: sectionHtml });
            console.log(`  ✅ ${sectionHtml.length}자 생성`);
        } catch (err) {
            console.log(`  ⚠️ 생성 실패, 기본 콘텐츠 사용`);
            sections.push({ h2, html: `<h3>${h2} 핵심 정리</h3><p>${keyword}에 대한 ${h2} 내용을 정리해드릴게요.</p>` });
        }

        // API 호출 간격
        await new Promise(r => setTimeout(r, 500));
    }

    // === 4단계: HTML 조립 ===
    console.log('\n📝 4단계: 최종 HTML 조립...');

    let css = '';
    try {
        css = generateCSSFinal('blogspot', 'internal');
    } catch (e) {
        css = '<style>.bgpt-content { font-family: "Noto Sans KR", sans-serif; }</style>';
    }

    const bodyHtml = sections.map(sec => `
    <h2>${sec.h2}</h2>
    ${sec.html}
  `).join('\n');

    const fullHtml = `
${css}
<div class="bgpt-content max-mode-article">
  <h1>${title}</h1>
  ${bodyHtml}
  <div style="margin-top:40px;padding:20px;background:#f8f9fa;border-radius:8px;">
    <p style="font-size:14px;color:#666;">📌 이 글은 시리즈의 일부입니다. 다음 편도 기대해주세요!</p>
  </div>
</div>
  `.trim();

    console.log(`✅ 총 HTML: ${fullHtml.length}자`);

    // HTML 파일 저장
    fs.writeFileSync('./test-internal-consistency-output.html',
        `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${title}</title></head>` +
        `<body style="max-width:800px;margin:0 auto;padding:20px;">${fullHtml}</body></html>`,
        'utf-8');
    console.log('💾 HTML 저장');

    // === 5단계: Blogger 발행 ===
    console.log('\n' + '='.repeat(60));
    console.log('📤 5단계: Blogger 발행...');

    try {
        const { publishToBlogger } = require('./dist/core/blogger-publisher.js');

        const payload = {
            bloggerAccessToken: env.bloggerAccessToken || env.BLOGGER_ACCESS_TOKEN || '',
            bloggerRefreshToken: env.bloggerRefreshToken || env.BLOGGER_REFRESH_TOKEN || '',
            blogId: env.blogId || env.BLOG_ID || env.bloggerBlogId || '',
            bloggerClientId: env.bloggerClientId || env.BLOGGER_CLIENT_ID || '',
            bloggerClientSecret: env.bloggerClientSecret || env.BLOGGER_CLIENT_SECRET || '',
            generatedLabels: ['재택근무', '생산성', '시리즈'],
        };

        console.log(`   blogId: ${payload.blogId ? payload.blogId.substring(0, 6) + '...' : '❌ 없음'}`);
        console.log(`   accessToken: ${payload.bloggerAccessToken ? '✅ 있음' : '❌ 없음'}`);
        console.log(`   refreshToken: ${payload.bloggerRefreshToken ? '✅ 있음' : '❌ 없음'}`);

        if (!payload.blogId) {
            console.log('\n⚠️ blogId가 없어 발행할 수 없습니다.');
            console.log('💡 앱에서 Blogger 인증을 완료한 후 다시 시도하세요.');
            console.log('\n✅ 하지만! HTML 콘텐츠 생성은 성공했습니다!');
            console.log('   → test-internal-consistency-output.html 파일 확인');
            process.exit(0);
        }

        const result = await publishToBlogger(
            payload,
            title,
            fullHtml,
            '',       // thumbnail
            (msg) => console.log(msg),
            'publish',
            null
        );

        if (result.ok) {
            console.log('\n🎉🎉🎉 발행 성공! 🎉🎉🎉');
            console.log(`📌 Post URL: ${result.postUrl || result.url}`);
            console.log(`📌 Post ID: ${result.postId}`);
        } else {
            console.log('\n❌ 발행 실패:', result.error);
            if (result.needsAuth) {
                console.log('🔑 앱에서 Blogger 재인증이 필요합니다.');
            }
        }
    } catch (err) {
        console.error('\n❌ Blogger 발행 에러:', err.message);
        console.log('\n✅ 하지만 내부 일관성 모드 콘텐츠 생성은 성공!');
        console.log('   → test-internal-consistency-output.html 확인');
    }
}

function callWithTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${ms}ms 타임아웃`)), ms))
    ]);
}

main().catch(err => {
    console.error('❌ 전체 에러:', err);
    process.exit(1);
});
