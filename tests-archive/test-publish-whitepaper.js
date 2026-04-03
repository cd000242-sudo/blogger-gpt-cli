const path = require('path');
require('dotenv').config({ path: path.join(process.env.APPDATA, 'blogger-gpt-cli', '.env') });
const { generateMaxModeArticle, publishGeneratedContent } = require('./dist/core/index');

async function testPublish() {
    console.log('--- 백서 스타일 UI 블로그스팟 테스트 발행 시작 ---');

    const keywordValue = '청년내일채움공제 K-패스';
    const titleValue = "3월 2일 개시! '청년내일채움공제' 및 'K-패스' 신규 가입 혜택";
    const payload = {
        provider: 'gemini',
        topic: keywordValue,
        keywords: [{
            keyword: keywordValue,
            title: titleValue
        }],
        titleMode: 'custom',
        useKeywordAsTitle: false,
        platform: 'blogspot',
        publishType: 'publish',
        postingMode: 'immediate',
        contentMode: 'external',
        h2ImageSource: 'nanobananapro',
        h2ImageSections: [1, 2, 3, 4, 5],
        sectionCount: 5,
        openaiKey: process.env.OPENAI_API_KEY,
        blogId: process.env.BLOG_ID,
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
        googleCseKey: process.env.GOOGLE_CSE_KEY,
        googleCseCx: process.env.GOOGLE_CSE_CX,
    };

    const env = {
        contentMode: 'external',
        postingMode: 'immediate'
    };

    try {
        console.log('[LOG] generateMaxModeArticle 호출 중...');
        const result = await generateMaxModeArticle(payload, env, (msg) => console.log(`[진행률] ${msg}`));

        console.log('[LOG] generateMaxModeArticle 완료! 발행 시도 중...');
        const publishResult = await publishGeneratedContent(
            payload,
            result.title || payload.topic,
            result.html || result.content,
            result.thumbnail || result.thumbnailUrl || ''
        );

        console.log('\n--- 발행 완료 ---');
        console.log(JSON.stringify(publishResult, null, 2));
    } catch (error) {
        console.error('발행 실패:', error);
    }
}

testPublish();
