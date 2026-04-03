/**
 * 완전 자동 발행 테스트 스크립트
 * 키워드: 민간 건축물 그린리모델링 이자 지원 창호 교체 최대 3000만원
 * 플랫폼: Blogger (블로그스팟)
 */

const path = require('path');
const fs = require('fs');

// 환경변수 로드
function loadEnvFile() {
    const envPaths = [
        path.join(process.env.APPDATA || '', 'lba', '.env'),
        path.join(__dirname, '.env')
    ];

    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            const env = {};
            content.split('\n').forEach(line => {
                const match = line.match(/^([^#=]+)=(.+)$/);
                if (match) {
                    env[match[1].trim()] = match[2].trim();
                }
            });
            console.log('✅ 환경변수 파일 로드:', envPath);
            console.log('   - 키 개수:', Object.keys(env).length);
            return env;
        }
    }
    console.log('❌ 환경변수 파일을 찾을 수 없습니다.');
    return {};
}

// 토큰 파일 확인
function checkTokenFile() {
    const tokenPaths = [
        path.join(process.env.APPDATA || '', 'lba', 'blogger-token.json')
    ];

    for (const tokenPath of tokenPaths) {
        if (fs.existsSync(tokenPath)) {
            try {
                const content = fs.readFileSync(tokenPath, 'utf-8');
                const token = JSON.parse(content);
                console.log('✅ 토큰 파일 존재:', tokenPath);
                console.log('   - access_token:', token.access_token ? '있음' : '없음');
                console.log('   - refresh_token:', token.refresh_token ? '있음' : '없음');
                if (token.expires_at) {
                    const remaining = token.expires_at - Date.now();
                    if (remaining > 0) {
                        console.log('   - 만료까지:', Math.round(remaining / 60000), '분');
                    } else {
                        console.log('   - ⚠️ 토큰 만료됨 (갱신 필요)');
                    }
                }
                return token;
            } catch (e) {
                console.log('❌ 토큰 파일 파싱 실패:', e.message);
            }
        }
    }
    console.log('❌ 토큰 파일이 없습니다. 앱에서 Blogger 인증이 필요합니다.');
    return null;
}

async function testPublish() {
    console.log('\n🚀 완전 자동 발행 테스트 시작\n');
    console.log('='.repeat(60));

    // 1. 환경변수 확인
    console.log('\n[1/5] 환경변수 확인');
    const env = loadEnvFile();

    const blogId = env.BLOG_ID || env.blogId || env.BLOGGER_BLOG_ID;
    const clientId = env.GOOGLE_CLIENT_ID || env.googleClientId;
    const clientSecret = env.GOOGLE_CLIENT_SECRET || env.googleClientSecret;
    const geminiKey = env.GEMINI_API_KEY || env.geminiKey;

    console.log('   - BLOG_ID:', blogId ? `${blogId.substring(0, 10)}...` : '❌ 없음');
    console.log('   - GOOGLE_CLIENT_ID:', clientId ? `${clientId.substring(0, 20)}...` : '❌ 없음');
    console.log('   - GOOGLE_CLIENT_SECRET:', clientSecret ? `${clientSecret.substring(0, 10)}...` : '❌ 없음');
    console.log('   - GEMINI_API_KEY:', geminiKey ? `${geminiKey.substring(0, 10)}...` : '❌ 없음');

    // 2. 토큰 확인
    console.log('\n[2/5] Blogger 인증 토큰 확인');
    const token = checkTokenFile();

    if (!blogId || !clientId || !clientSecret) {
        console.log('\n❌ 필수 설정이 누락되었습니다.');
        console.log('   앱의 환경설정 탭에서 다음을 설정해주세요:');
        if (!blogId) console.log('   - Blog ID');
        if (!clientId) console.log('   - Google Client ID');
        if (!clientSecret) console.log('   - Google Client Secret');
        return;
    }

    if (!token) {
        console.log('\n❌ Blogger 인증이 필요합니다.');
        console.log('   앱의 환경설정 탭에서 "Blogger OAuth2 인증" 버튼을 클릭해주세요.');
        return;
    }

    // 3. 글 생성
    console.log('\n[3/5] AI 글 생성 중...');
    const keyword = '민간 건축물 그린리모델링 이자 지원 창호 교체 최대 3000만원';
    console.log('   - 키워드:', keyword);

    const { generateUltimateMaxModeArticleFinal } = require('./dist/core/ultimate-final-functions');

    const payload = {
        topic: keyword,
        platform: 'blogspot',
        h2ImageSource: 'nanobananapro',
        skipImages: true,
        fastMode: true
    };

    const onLog = (msg) => console.log('   ', msg);

    const article = await generateUltimateMaxModeArticleFinal(payload, {}, onLog);

    if (!article || !article.html) {
        console.log('\n❌ 글 생성 실패');
        return;
    }

    console.log('\n   ✅ 글 생성 성공!');
    console.log('   - 제목:', article.title);
    console.log('   - HTML 길이:', article.html.length, '자');

    // 4. 실제 발행
    console.log('\n[4/5] Blogger에 발행 중...');

    const { publishToBlogger } = require('./dist/core/blogger-publisher');

    const publishPayload = {
        blogId: blogId,
        googleClientId: clientId,
        googleClientSecret: clientSecret,
        googleAccessToken: token.access_token,
        googleRefreshToken: token.refresh_token
    };

    const publishResult = await publishToBlogger(
        publishPayload,
        article.title,
        article.html,
        article.thumbnail || '',
        onLog,
        'publish',
        null
    );

    // 5. 결과 확인
    console.log('\n[5/5] 발행 결과');
    console.log('='.repeat(60));

    if (publishResult && publishResult.ok) {
        console.log('\n🎉 발행 성공!');
        console.log('   - URL:', publishResult.url || publishResult.postUrl || '(URL 없음)');
        console.log('   - Post ID:', publishResult.postId || publishResult.id || '(ID 없음)');
    } else {
        console.log('\n❌ 발행 실패');
        console.log('   - 오류:', publishResult?.error || '알 수 없는 오류');
        if (publishResult?.needsAuth) {
            console.log('   - 인증 필요: 앱에서 Blogger OAuth2 인증을 다시 진행해주세요.');
        }
    }
}

testPublish().catch(err => {
    console.error('\n❌ 테스트 중 오류 발생:', err.message);
    console.error(err.stack);
});
