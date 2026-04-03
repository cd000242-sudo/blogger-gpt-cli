/**
 * test-adsense-pipeline.js
 * 실제 AI 파이프라인을 호출하여 애드센스 모드 콘텐츠 생성을 테스트합니다.
 * - 7개 섹션 모두 생성되는지 확인
 * - 총 글자 수가 6,300-7,500자 이상인지 검증
 * - H2 태그 구조 확인
 */

const path = require('path');
const fs = require('fs');

// .env 로드
function getUserDataPath() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || process.env.USERPROFILE || '', 'blogger-gpt-cli');
    } else if (process.platform === 'darwin') {
        return path.join(process.env.HOME || '', 'Library', 'Application Support', 'blogger-gpt-cli');
    } else {
        return path.join(process.env.HOME || process.env.XDG_CONFIG_HOME || '', '.config', 'blogger-gpt-cli');
    }
}

function loadEnv() {
    const envPath = path.join(getUserDataPath(), '.env');
    if (fs.existsSync(envPath)) {
        console.log(`[ENV] userData .env 사용: ${envPath}`);
        return parseEnvFile(fs.readFileSync(envPath, 'utf-8'));
    }
    const rootEnv = path.join(__dirname, '.env');
    if (fs.existsSync(rootEnv)) {
        console.log(`[ENV] 프로젝트 루트 .env 사용: ${rootEnv}`);
        return parseEnvFile(fs.readFileSync(rootEnv, 'utf-8'));
    }
    throw new Error('.env 파일을 찾을 수 없습니다');
}

function parseEnvFile(content) {
    const vars = {};
    content.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) vars[match[1].trim()] = match[2].trim();
    });
    return vars;
}

// HTML에서 순수 텍스트 추출
function extractPureText(html) {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function main() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🧪 AdSense 모드 파이프라인 실제 테스트');
    console.log('   (generateMaxModeArticle 호출)');
    console.log('═══════════════════════════════════════════════════\n');

    const startTime = Date.now();

    // 환경변수 로드
    const envVars = loadEnv();
    const geminiKey = envVars.GEMINI_API_KEY || envVars.geminiKey || '';

    if (!geminiKey) {
        console.error('❌ GEMINI_API_KEY가 .env에 설정되지 않았습니다.');
        process.exit(1);
    }
    console.log('✅ Gemini API Key 확인됨\n');

    // generateMaxModeArticle 직접 호출
    const { generateMaxModeArticle } = require('./electron/src/core/index');

    const payload = {
        topic: '2026년 건강한 아침 루틴 완벽 가이드',
        keywords: ['아침 루틴', '건강 습관', '모닝 루틴', '생산성 향상'],
        contentMode: 'adsense',
        geminiKey: geminiKey,
        platform: 'blogger',
        thumbnailMode: 'text',
        h2Images: null,
        previewOnly: true,  // 발행하지 않음
        manualCtas: {},
        naverClientId: envVars.NAVER_CLIENT_ID || '',
        naverClientSecret: envVars.NAVER_CLIENT_SECRET || '',
    };

    const env = {
        contentMode: 'adsense',
        postingMode: 'immediate'
    };

    const logs = [];
    const onLog = (msg) => {
        const ts = ((Date.now() - startTime) / 1000).toFixed(1);
        const logLine = `[${ts}s] ${msg}`;
        logs.push(logLine);
        console.log(logLine);
    };

    console.log('📝 콘텐츠 생성 시작...');
    console.log(`   주제: ${payload.topic}`);
    console.log(`   키워드: ${payload.keywords.join(', ')}`);
    console.log(`   모드: adsense\n`);

    try {
        const article = await generateMaxModeArticle(payload, env, onLog);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n⏱️ 생성 소요시간: ${elapsed}s\n`);

        if (!article || !article.html) {
            console.error('❌ article.html이 비어있습니다!');
            process.exit(1);
        }

        const html = article.html;
        const title = article.title || '(제목 없음)';

        // 분석
        const pureText = extractPureText(html);
        const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
        const h3Matches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];
        const pMatches = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
        const tableMatches = html.match(/<table[^>]*>/gi) || [];
        const imgMatches = html.match(/<img\s/gi) || [];
        const faqMatches = html.match(/faq-item/gi) || [];

        console.log('═══════════════════════════════════════════════════');
        console.log('📊 생성 결과 분석');
        console.log('═══════════════════════════════════════════════════');
        console.log(`📝 제목: ${title}`);
        console.log(`📏 HTML 길이: ${html.length.toLocaleString()}자`);
        console.log(`📏 순수 텍스트 길이: ${pureText.length.toLocaleString()}자`);
        console.log(`📑 H2 태그: ${h2Matches.length}개`);
        console.log(`📑 H3 태그: ${h3Matches.length}개`);
        console.log(`📄 P 태그: ${pMatches.length}개`);
        console.log(`📊 테이블: ${tableMatches.length}개`);
        console.log(`🖼️ 이미지: ${imgMatches.length}개`);
        console.log(`❓ FAQ: ${faqMatches.length}개`);

        // H2 제목 목록
        console.log('\n📋 H2 섹션 목록:');
        h2Matches.forEach((h2, i) => {
            const text = h2.replace(/<[^>]+>/g, '').trim();
            console.log(`  ${i + 1}. ${text}`);
        });

        // 검증
        console.log('\n═══════════════════════════════════════════════════');
        console.log('✅ 검증 결과');
        console.log('═══════════════════════════════════════════════════');

        const checks = [
            { name: 'H2 태그 7개 이상', pass: h2Matches.length >= 7, detail: `${h2Matches.length}개` },
            { name: '순수 텍스트 6,300자 이상', pass: pureText.length >= 6300, detail: `${pureText.length.toLocaleString()}자` },
            { name: '순수 텍스트 15,000자 이하', pass: pureText.length <= 15000, detail: `${pureText.length.toLocaleString()}자` },
            { name: 'P 태그 15개 이상', pass: pMatches.length >= 15, detail: `${pMatches.length}개` },
            { name: '테이블 1개 이상', pass: tableMatches.length >= 1, detail: `${tableMatches.length}개` },
            { name: 'FAQ 3개 이상', pass: faqMatches.length >= 3, detail: `${faqMatches.length}개` },
            { name: 'H3 태그 5개 이상', pass: h3Matches.length >= 5, detail: `${h3Matches.length}개` },
        ];

        let allPassed = true;
        for (const c of checks) {
            const icon = c.pass ? '✅' : '❌';
            console.log(`  ${icon} ${c.name}: ${c.detail}`);
            if (!c.pass) allPassed = false;
        }

        console.log('\n═══════════════════════════════════════════════════');
        if (allPassed) {
            console.log('🎉 모든 검증 통과! 파이프라인이 정상 작동합니다.');
        } else {
            console.log('⚠️ 일부 검증 실패. 파이프라인 확인 필요.');
        }
        console.log('═══════════════════════════════════════════════════');

        // 결과 HTML 파일로 저장
        const outputPath = path.join(__dirname, 'test-adsense-output.html');
        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`\n💾 생성된 HTML 저장: ${outputPath}`);

    } catch (error) {
        console.error('\n❌ 파이프라인 오류:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
