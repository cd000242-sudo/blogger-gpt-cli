/**
 * 🔬 기존 Puppeteer+Stealth 쇼핑 크롤러 테스트
 * 
 * shopping-crawler.js의 ShoppingCrawler 클래스 직접 테스트
 * puppeteer-extra + StealthPlugin 사용
 */
const path = require('path');
const ShoppingCrawler = require('./src/utils/shopping-crawler');

async function main() {
    const arg = process.argv[2] || 'coupang';

    const urls = {
        coupang: 'https://www.coupang.com/vp/products/8178498750',
        gmarket: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
        '11st': 'https://www.11st.co.kr/products/6836498473',
    };

    if (!urls[arg]) {
        console.log('사용: node test-puppeteer-stealth.js [coupang|gmarket|11st]');
        process.exit(1);
    }

    console.log(`🔬 Puppeteer+Stealth 크롤링 테스트`);
    console.log(`   대상: ${arg}`);
    console.log(`   URL: ${urls[arg]}`);
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);

    const crawler = new ShoppingCrawler();

    try {
        const t0 = Date.now();
        const result = await crawler.crawlProduct(urls[arg]);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        console.log(`\n${'═'.repeat(50)}`);
        console.log(`📊 결과 (${elapsed}초):`);
        console.log('═'.repeat(50));

        if (result) {
            console.log(`📦 상품명: ${result.title || '없음'}`);
            console.log(`💰 가격: ${result.price || '없음'}`);
            console.log(`🏷 할인: ${result.discount || '없음'}`);
            console.log(`⭐ 평점: ${result.rating || '없음'}`);
            console.log(`📝 리뷰: ${result.reviewCount || '없음'}`);
            console.log(`🖼 이미지: ${result.image || '없음'}`);
            console.log(`📄 설명: ${(result.description || '없음').substring(0, 100)}`);
            console.log(`🏪 쇼핑몰: ${result.shopType}`);
            console.log(`🔗 URL: ${result.url}`);

            const success = !!(result.title && result.title !== '상품명 확인 중');
            console.log(`\n${success ? '✅ 성공!' : '❌ 실패 — 상품명 없음'}`);
        } else {
            console.log('❌ 결과 없음 (null)');
        }

    } catch (err) {
        console.error(`\n❌ 에러: ${err.message}`);
        console.error(err.stack);
    } finally {
        if (crawler.browser) {
            await crawler.browser.close();
        }
        process.exit(0);
    }
}

main();
