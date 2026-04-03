/**
 * NanoBananaPro 썸네일 생성 테스트 스크립트
 * userData/.env에서 Gemini API 키를 로드하여 텍스트 오버레이 포함 썸네일 생성
 */

const path = require('path');
const fs = require('fs');

// .env 파일에서 API 키 로드
function loadApiKey() {
    const envFilePath = path.join(
        process.env.APPDATA || '',
        'blogger-gpt-cli',
        '.env'
    );

    console.log(`📁 .env 파일 경로: ${envFilePath}`);

    if (!fs.existsSync(envFilePath)) {
        console.error('❌ .env 파일이 존재하지 않습니다.');
        return null;
    }

    const content = fs.readFileSync(envFilePath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const eqIdx = trimmed.indexOf('=');
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim();

        // process.env에 설정
        process.env[key] = val;

        if (key === 'GEMINI_API_KEY' || key === 'GOOGLE_AI_API_KEY') {
            console.log(`🔑 ${key} 로드 성공: ${val.substring(0, 15)}...`);
        }
    }

    return process.env['GEMINI_API_KEY'] || process.env['GOOGLE_AI_API_KEY'] || null;
}

async function main() {
    console.log('==============================================');
    console.log('🍌 NanoBananaPro 썸네일 생성 테스트');
    console.log('==============================================\n');

    // API 키 로드
    const apiKey = loadApiKey();
    if (!apiKey) {
        console.error('❌ Gemini API 키를 찾을 수 없습니다.');
        process.exit(1);
    }

    // thumbnail.js 모듈 로드
    const thumbnailModule = require('./src/core/thumbnail.js');
    const { makeNanoBananaProThumbnail } = thumbnailModule;

    if (!makeNanoBananaProThumbnail) {
        console.error('❌ makeNanoBananaProThumbnail 함수를 찾을 수 없습니다.');
        process.exit(1);
    }

    // 출력 디렉토리 생성
    const outDir = path.join(__dirname, 'test-thumbnails');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    // 테스트 제목과 토픽
    const testTitle = '2026년 최신 블로그 SEO 전략 완벽 가이드';
    const testTopic = '블로그 SEO 최적화';

    console.log('\n📝 테스트 설정:');
    console.log(`   제목: ${testTitle}`);
    console.log(`   토픽: ${testTopic}`);
    console.log(`   출력: ${outDir}\n`);

    // === 테스트 1: 텍스트 오버레이 포함 썸네일 ===
    console.log('🎨 테스트 1: 텍스트 오버레이 포함 썸네일...');
    console.log('───────────────────────────────────');

    try {
        const result1 = await makeNanoBananaProThumbnail(testTitle, testTopic, {
            apiKey: apiKey,
            isThumbnail: true,
            aspectRatio: '16:9',
        });

        if (result1.ok && result1.dataUrl) {
            const saved = saveImage(result1.dataUrl, outDir, 'nano-thumbnail-text');
            if (saved) {
                console.log(`✅ 텍스트 썸네일 저장: ${saved}`);
            }
        } else {
            console.log(`❌ 실패: ${result1.error || '알 수 없는 오류'}`);
        }
    } catch (error) {
        console.error(`❌ 에러:`, error.message);
    }

    console.log('');

    // === 테스트 2: 소제목 이미지 (텍스트 없음) ===
    console.log('🖼️  테스트 2: 소제목 이미지 (텍스트 없음)...');
    console.log('───────────────────────────────────');

    try {
        const result2 = await makeNanoBananaProThumbnail('키워드 리서치의 중요성', testTopic, {
            apiKey: apiKey,
            isThumbnail: false,
            aspectRatio: '16:9',
        });

        if (result2.ok && result2.dataUrl) {
            const saved = saveImage(result2.dataUrl, outDir, 'nano-subtopic');
            if (saved) {
                console.log(`✅ 소제목 이미지 저장: ${saved}`);
            }
        } else {
            console.log(`❌ 실패: ${result2.error || '알 수 없는 오류'}`);
        }
    } catch (error) {
        console.error(`❌ 에러:`, error.message);
    }

    console.log('\n==============================================');
    console.log('🍌 테스트 완료!');
    console.log(`📁 결과: ${outDir}`);
    console.log('==============================================');
}

function saveImage(dataUrl, outDir, prefix) {
    const base64Match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (base64Match) {
        const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
        const buffer = Buffer.from(base64Match[2], 'base64');
        const filePath = path.join(outDir, `${prefix}.${ext}`);
        fs.writeFileSync(filePath, buffer);
        console.log(`   📏 크기: ${(buffer.length / 1024).toFixed(1)}KB`);
        return filePath;
    } else if (dataUrl.startsWith('http')) {
        console.log(`   🔗 URL: ${dataUrl.substring(0, 80)}...`);
        return dataUrl;
    }
    return null;
}

main().catch(err => {
    console.error('💥 테스트 실패:', err);
    process.exit(1);
});
