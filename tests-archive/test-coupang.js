/**
 * 쿠팡 단일 테스트
 */
const path = require('path');
require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: { module: 'commonjs', esModuleInterop: true }
});

const { crawlProductSnapshot } = require('./src/crawlers/parser-registry');

async function main() {
    console.log('=== 쿠팡 크롤링 테스트 ===');
    const url = 'https://www.coupang.com/vp/products/8178498750';

    try {
        const { snapshot } = await crawlProductSnapshot(url, { timeoutMs: 30000 });

        console.log('\n--- 기본정보 ---');
        console.log('제목:', snapshot.title);
        console.log('설명:', (snapshot.description || '없음').substring(0, 100));
        console.log('가격:', snapshot.price ? `${snapshot.price.current?.toLocaleString()}원` : '없음');
        console.log('배송:', snapshot.delivery || '없음');
        console.log('평점:', snapshot.rating || '없음');
        console.log('리뷰수:', snapshot.reviewCount || '없음');

        console.log('\n--- 특징 ---');
        snapshot.features.slice(0, 3).forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.heading}: ${f.body.substring(0, 50)}`);
        });

        console.log('\n--- 이미지 (총', snapshot.images.length, '개) ---');
        snapshot.images.forEach((img, i) => {
            console.log(`  ${i + 1}. ${img.substring(0, 120)}`);
        });

        console.log('\n--- 리뷰 ---');
        snapshot.reviews.slice(0, 3).forEach((r, i) => {
            console.log(`  ${i + 1}. "${r.quote.substring(0, 60)}" (★${r.rating || '?'})`);
        });

        console.log('\n=== 결과 ===');
        console.log('제목:', snapshot.title ? 'OK' : 'FAIL');
        console.log('가격:', snapshot.price ? 'OK' : 'FAIL');
        console.log('이미지:', snapshot.images.length, '개');
        console.log('리뷰:', snapshot.reviews.length, '개');

    } catch (err) {
        console.error('에러:', err.message);
        console.error(err.stack?.split('\n').slice(0, 5).join('\n'));
    }

    process.exit(0);
}

main();
