/**
 * 🚀 블로그스팟 독립 실행 발행 스크립트
 * 콘텐츠 생성 + Blogger API 발행을 Electron UI 없이 실행
 */
const path = require('path');

// 프로젝트 루트 설정
process.chdir(path.resolve(__dirname));

async function main() {
    console.log('🚀 블로그스팟 독립 발행 시작...\n');

    // 1. 환경변수 로드
    const { loadEnvFromFile } = require('./src/env');
    const env = loadEnvFromFile();

    if (!env.geminiKey) {
        console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
        process.exit(1);
    }

    console.log('✅ 환경변수 로드 완료');
    console.log(`   - Gemini API Key: ${env.geminiKey ? '설정됨' : '없음'}`);
    console.log(`   - Blog ID: ${env.blogId || '없음'}`);
    console.log(`   - Blogger Client ID: ${env.bloggerClientId ? '설정됨' : '없음'}`);

    // 2. 콘텐츠 생성
    const { generateUltimateMaxModeArticleFinal } = require('./src/core/ultimate-final-functions');

    const keyword = '2026 신규 제품화 ALL-In-One 팩 하드웨어 스타트업 시제품 제조 1억 지원';
    console.log(`\n📝 키워드: "${keyword}"`);
    console.log('⏳ AI 콘텐츠 생성 중... (약 30~60초 소요)\n');

    const onLog = (msg) => console.log(`  ${msg}`);

    try {
        const result = await generateUltimateMaxModeArticleFinal(
            {
                topic: keyword,
                platform: 'blogspot',
                skipImages: false,
                fastMode: true,
            },
            env,
            onLog
        );

        console.log('\n✅ 콘텐츠 생성 완료!');
        console.log(`   - 제목: ${result.title}`);
        console.log(`   - HTML 길이: ${result.html.length}자`);
        console.log(`   - 라벨: ${result.labels?.join(', ')}`);
        console.log(`   - 썸네일: ${result.thumbnail ? '있음' : '없음'}`);

        // 3. Blogger에 발행
        console.log('\n📤 Blogger에 발행 중...\n');

        const { publishToBlogger } = require('./src/core/blogger-publisher.js');

        const payload = {
            blogId: env.blogId,
            bloggerAccessToken: env.bloggerAccessToken,
            bloggerRefreshToken: env.bloggerRefreshToken,
            bloggerClientId: env.bloggerClientId,
            bloggerClientSecret: env.bloggerClientSecret
        };

        const publishResult = await publishToBlogger(
            payload,
            result.title,
            result.html,
            result.thumbnail || '',
            onLog,
            'publish',  // postingStatus
            null         // scheduleDate
        );

        if (publishResult.ok) {
            console.log('\n🎉 발행 성공!');
            console.log(`   - URL: ${publishResult.postUrl || publishResult.url}`);
            console.log(`   - Post ID: ${publishResult.postId}`);
        } else {
            console.error('\n❌ 발행 실패:', publishResult.error);
        }

    } catch (error) {
        console.error('\n❌ 오류 발생:', error.message);
        console.error(error.stack);
    }
}

main().catch(console.error);
