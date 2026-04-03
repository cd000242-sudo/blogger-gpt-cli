/**
 * Blogger Publishing Diagnostic Script
 * 블로그스팟 발행 심층 진단
 */

const path = require('path');

// 환경변수 로드
const envPath = path.join(__dirname, 'dist', 'env.js');
let loadEnvFromFile;
try {
    const envModule = require(envPath);
    loadEnvFromFile = envModule.loadEnvFromFile;
} catch (e) {
    console.error('❌ env.js 로드 실패:', e.message);
    process.exit(1);
}

async function diagnose() {
    console.log('='.repeat(60));
    console.log('🔍 블로그스팟 발행 심층 진단');
    console.log('='.repeat(60));

    // 1. 환경변수 확인
    console.log('\n📋 Step 1: 환경변수 확인');
    let env;
    try {
        env = loadEnvFromFile();
        console.log('  ✅ loadEnvFromFile() 정상 로드');
        console.log('  전체 키 목록:', Object.keys(env).join(', '));
    } catch (e) {
        console.error('  ❌ loadEnvFromFile() 실패:', e.message);
        return;
    }

    // 2. Google OAuth2 설정 확인
    console.log('\n📋 Step 2: Google OAuth2 설정 확인');
    const clientIdKeys = ['googleClientId', 'GOOGLE_CLIENT_ID', 'google_client_id'];
    const clientSecretKeys = ['googleClientSecret', 'GOOGLE_CLIENT_SECRET', 'google_client_secret'];
    const blogIdKeys = ['blogId', 'BLOGGER_BLOG_ID', 'GOOGLE_BLOG_ID', 'BLOG_ID', 'blogger_blog_id'];

    let foundClientId = '';
    let foundClientSecret = '';
    let foundBlogId = '';

    for (const key of clientIdKeys) {
        if (env[key]) { foundClientId = env[key]; console.log(`  ✅ Client ID 발견: key="${key}", value="${String(foundClientId).substring(0, 20)}..."`); break; }
    }
    if (!foundClientId) console.log('  ❌ Client ID 없음. 확인한 키:', clientIdKeys.join(', '));

    for (const key of clientSecretKeys) {
        if (env[key]) { foundClientSecret = env[key]; console.log(`  ✅ Client Secret 발견: key="${key}", length=${String(foundClientSecret).length}`); break; }
    }
    if (!foundClientSecret) console.log('  ❌ Client Secret 없음. 확인한 키:', clientSecretKeys.join(', '));

    for (const key of blogIdKeys) {
        if (env[key]) { foundBlogId = env[key]; console.log(`  ✅ Blog ID 발견: key="${key}", value="${foundBlogId}"`); break; }
    }
    if (!foundBlogId) console.log('  ❌ Blog ID 없음. 확인한 키:', blogIdKeys.join(', '));

    // 3. 블로거 모듈 확인
    console.log('\n📋 Step 3: 블로거 모듈 확인');

    // auth 모듈 검증
    try {
        const authModule = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'auth.js'));
        console.log('  ✅ auth.js 로드 성공');
        console.log('  함수 목록:', Object.keys(authModule).join(', '));

        // checkBloggerAuthStatus 실행
        console.log('\n📋 Step 4: 인증 상태 확인');
        const authStatus = await authModule.checkBloggerAuthStatus();
        console.log('  인증 상태:', JSON.stringify(authStatus, null, 2));

        if (authStatus.authenticated) {
            console.log('  ✅ 인증됨!');
            if (authStatus.tokenData) {
                console.log('  토큰 타입:', authStatus.tokenData.token_type);
                console.log('  access_token 길이:', authStatus.tokenData.access_token?.length || 0);
                console.log('  refresh_token 길이:', authStatus.tokenData.refresh_token?.length || 0);

                if (authStatus.tokenData.expires_at) {
                    const expiresIn = authStatus.tokenData.expires_at - Date.now();
                    console.log(`  토큰 만료까지: ${Math.round(expiresIn / 60000)}분`);
                    if (expiresIn <= 0) console.log('  ⚠️ 토큰 만료됨! 갱신 필요');
                }
            }
        } else {
            console.log('  ❌ 인증 안됨:', authStatus.error);
        }
    } catch (e) {
        console.error('  ❌ auth.js 로드 실패:', e.message);
        console.error('  스택:', e.stack);
    }

    // 4. loadEnvironmentVariables (blogger-modules/utils) 확인
    console.log('\n📋 Step 5: blogger-modules/utils.loadEnvironmentVariables 확인');
    try {
        const utilsModule = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'utils.js'));
        console.log('  ✅ utils.js 로드 성공');
        const bloggerEnv = utilsModule.loadEnvironmentVariables();
        console.log('  loadEnvironmentVariables 결과:');
        for (const [key, value] of Object.entries(bloggerEnv)) {
            const val = String(value);
            if (val.length > 20) {
                console.log(`    ${key}: "${val.substring(0, 20)}..." (${val.length}자)`);
            } else {
                console.log(`    ${key}: "${val}"`);
            }
        }
    } catch (e) {
        console.error('  ❌ utils.js 로드 실패:', e.message);
    }

    // 5. 토큰 파일 확인
    console.log('\n📋 Step 6: 토큰 파일 확인');
    try {
        const fs = require('fs');
        const utilsModule = require(path.join(__dirname, 'src', 'core', 'blogger-modules', 'utils.js'));
        const tokenPath = utilsModule.getTokenFilePath();
        console.log('  토큰 파일 경로:', tokenPath);
        if (fs.existsSync(tokenPath)) {
            const tokenContent = fs.readFileSync(tokenPath, 'utf-8');
            const tokenData = JSON.parse(tokenContent);
            console.log('  ✅ 토큰 파일 존재');
            console.log('  토큰 키:', Object.keys(tokenData).join(', '));
            console.log('  access_token 길이:', tokenData.access_token?.length || 0);
            console.log('  refresh_token 길이:', tokenData.refresh_token?.length || 0);
        } else {
            console.log('  ❌ 토큰 파일 없음!');
        }
    } catch (e) {
        console.error('  ❌ 토큰 파일 확인 실패:', e.message);
    }

    // 6. 최종 진단 결과
    console.log('\n' + '='.repeat(60));
    console.log('📊 최종 진단 결과');
    console.log('='.repeat(60));

    const issues = [];
    if (!foundClientId) issues.push('❌ Google Client ID 누락');
    if (!foundClientSecret) issues.push('❌ Google Client Secret 누락');
    if (!foundBlogId) issues.push('❌ Blogger Blog ID 누락');

    if (issues.length === 0) {
        console.log('  ✅ 설정 이상 없음. OAuth 인증 상태만 확인 필요.');
    } else {
        console.log('  발견된 문제:');
        issues.forEach(i => console.log(`    ${i}`));
    }
}

diagnose().catch(e => {
    console.error('진단 스크립트 오류:', e);
});
