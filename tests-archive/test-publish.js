/**
 * Adsense 발행 테스트 — 실제로 블로그스팟에 글을 올리는 스크립트
 * runPost 함수를 호출하여 생성 + 발행을 한번에 처리합니다.
 * postingMode: 'draft' (임시저장)로 발행합니다.
 */
const path = require('path');
const fs = require('fs');

const LOG_FILE = path.join(__dirname, 'test-publish-result.log');
fs.writeFileSync(LOG_FILE, '', 'utf-8');

function log(msg) {
    const line = msg + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
    process.stdout.write(line);
}

async function main() {
    log('== Adsense PUBLISH Test Start ==');
    log('Time: ' + new Date().toLocaleString('ko-KR'));

    // 1. env 로드
    let envData;
    try {
        const { loadEnvFromFile } = require('./electron/src/env');
        envData = loadEnvFromFile();
        log('Gemini key: ' + (envData.geminiKey ? 'SET' : 'MISSING'));
        log('Google Client ID: ' + (envData.googleClientId ? 'SET' : 'MISSING'));
        log('Google Client Secret: ' + (envData.googleClientSecret ? 'SET' : 'MISSING'));
        log('Blog ID: ' + (envData.blogId || 'MISSING'));
        log('Naver ID: ' + (envData.naverClientId ? 'SET' : 'MISSING'));
        log('Google CSE: ' + (envData.googleCseKey ? 'SET' : 'MISSING'));
    } catch (e) {
        log('ENV LOAD ERROR: ' + e.message);
        process.exit(1);
    }

    // 2. 필수 키 검증
    if (!envData.geminiKey) { log('FATAL: No Gemini key'); process.exit(1); }
    if (!envData.googleClientId) { log('FATAL: No Google Client ID'); process.exit(1); }
    if (!envData.googleClientSecret) { log('FATAL: No Google Client Secret'); process.exit(1); }
    if (!envData.blogId) { log('FATAL: No Blog ID'); process.exit(1); }

    // 3. OAuth 토큰 확인
    const tokenPath = path.join(process.env.APPDATA || '', 'lba', 'blogger-token.json');
    if (!fs.existsSync(tokenPath)) {
        log('FATAL: No blogger token at ' + tokenPath);
        log('Please authenticate via the app first (Settings > Blogger OAuth2)');
        process.exit(1);
    }
    log('Blogger token: EXISTS at ' + tokenPath);

    // 4. core 모듈 로드
    let coreIndex;
    try {
        coreIndex = require('./electron/src/core/index');
        log('Core module loaded OK');
    } catch (e) {
        log('CORE MODULE ERROR: ' + e.message);
        process.exit(1);
    }

    // 5. 발행 payload 구성
    const payload = {
        topic: '2025 블로그 수익화 완벽 가이드',
        keywords: ['블로그 수익', '애드센스 승인', '블로그 운영 팁'],
        geminiKey: envData.geminiKey,
        contentMode: 'adsense',
        platform: 'blogger',
        postingMode: 'draft',        // 임시저장 모드로 발행
        thumbnailMode: 'text',       // 텍스트 기반 썸네일
        naverClientId: envData.naverClientId || '',
        naverClientSecret: envData.naverClientSecret || '',
        googleCseKey: envData.googleCseKey || '',
        googleCseCx: envData.googleCseCx || '',
        googleClientId: envData.googleClientId,
        googleClientSecret: envData.googleClientSecret,
        blogId: envData.blogId,
        manualCtas: {},
        adsenseAuthorInfo: {
            name: '블로그 전문가',
            expertise: '블로그 수익화 및 SEO 전문가'
        }
    };

    log('\nPayload:');
    log('  Topic: ' + payload.topic);
    log('  Mode: ' + payload.contentMode);
    log('  Platform: ' + payload.platform);
    log('  PostingMode: ' + payload.postingMode + ' (DRAFT)');
    log('  Blog ID: ' + payload.blogId);

    // 6. runPost 실행 (생성 + 발행)
    log('\nCalling runPost (generate + publish)...');
    const startTime = Date.now();

    try {
        const result = await coreIndex.runPost(
            payload,
            (progressLog) => {
                log('LOG: ' + progressLog);
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('\n== RESULT ==');
        log('Elapsed: ' + elapsed + 's');
        log('OK: ' + result.ok);

        if (result.ok) {
            log('Title: ' + result.title);
            log('URL: ' + (result.url || 'N/A'));
            log('Post ID: ' + (result.postId || 'N/A'));
            log('HTML length: ' + (result.html ? result.html.length : 0));
            log('\nSUCCESS! Post published as DRAFT to Blogspot.');

            // HTML 저장
            if (result.html) {
                const outPath = path.join(__dirname, 'test-publish-output.html');
                fs.writeFileSync(outPath, result.html, 'utf-8');
                log('HTML saved to: ' + outPath);
            }
        } else {
            log('ERROR: ' + (result.error || 'Unknown error'));
            if (result.needsAuth) {
                log('AUTH REQUIRED: Please authenticate via the app first.');
            }
        }
    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('\nPUBLISH FAILED after ' + elapsed + 's');
        log('Error: ' + error.message);
        log('Stack: ' + error.stack);
        process.exit(1);
    }
}

main().catch(e => {
    log('UNHANDLED: ' + e.message);
    process.exit(1);
});
