/**
 * 🔬 사용자의 실제 Chrome 브라우저에 연결하여 크롤링
 * 
 * 핵심 아이디어:
 * 유저의 Chrome은 쿠팡에 정상 접속 가능함 (쿠키, 세션, 인증 다 있음)
 * Chrome을 디버깅 포트로 열고, puppeteer로 연결하면 
 * 실제 사용자 세션으로 크롤링 가능!
 * 
 * 사용법:
 * 1. 먼저 Chrome을 디버깅 모드로 시작:
 *    chrome.exe --remote-debugging-port=9222
 * 2. 이 스크립트 실행
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function main() {
    const arg = process.argv[2] || 'coupang';

    const urls = {
        coupang: 'https://www.coupang.com/vp/products/8178498750',
        gmarket: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
        '11st': 'https://www.11st.co.kr/products/6836498473',
        naver: 'https://search.shopping.naver.com/search/all?query=%EB%B8%94%EB%A3%A8%ED%88%AC%EC%8A%A4+%EC%9D%B4%EC%96%B4%ED%8F%B0&sort=rel',
    };

    const url = urls[arg] || arg;

    console.log(`🔬 실제 Chrome 연결 크롤링 테스트`);
    console.log(`   대상: ${arg}`);
    console.log(`   URL: ${url}`);
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);

    // Chrome 디버깅 포트에 연결 시도
    let browser;
    try {
        console.log('\n  🔌 Chrome 디버깅 포트(9222)에 연결 시도...');
        browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222',
            defaultViewport: null,
        });
        console.log('  ✅ Chrome 연결 성공!');
    } catch (err) {
        console.log(`  ❌ Chrome 연결 실패: ${err.message}`);
        console.log('\n  📋 사용법:');
        console.log('  1. 현재 Chrome을 모두 닫기');
        console.log('  2. 명령 프롬프트(CMD)에서 아래 명령 실행:');
        console.log('');
        console.log('     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
        console.log('');
        console.log('  3. Chrome이 열리면, 이 스크립트를 다시 실행');
        console.log('     node test-real-chrome.js coupang');
        process.exit(1);
    }

    // 새 탭 열기
    const page = await browser.newPage();

    try {
        console.log(`\n  🔗 페이지 이동: ${url.substring(0, 60)}...`);
        const t0 = Date.now();

        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });

        console.log(`  📡 Status: ${response?.status()}`);

        // 렌더링 대기
        console.log('  ⏳ 렌더링 대기 (5초)...');
        await new Promise(r => setTimeout(r, 5000));

        // 스크린샷
        await page.screenshot({ path: `real-chrome-${arg}.png`, fullPage: false });
        console.log(`  📸 스크린샷: real-chrome-${arg}.png`);

        // HTML 크기
        const html = await page.content();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`  📄 HTML: ${(html.length / 1024).toFixed(0)}KB (${html.length}바이트)`);
        console.log(`  ⏱  소요: ${elapsed}초`);

        // Access Denied 체크
        if (html.includes('Access Denied')) {
            console.log('  ❌ Access Denied');
        } else if (html.length < 500) {
            console.log('  ❌ 빈 페이지');
        } else {
            // 상품 정보 추출
            const info = await page.evaluate(() => {
                const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
                const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
                const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
                const h1 = document.querySelector('h1')?.textContent?.trim();
                const h2 = document.querySelector('h2')?.textContent?.trim();
                const title = document.title;

                // 쿠팡 전용
                const prodTitle = document.querySelector('.prod-buy-header__title')?.textContent?.trim();
                const price = document.querySelector('.total-price strong')?.textContent?.trim() ||
                    document.querySelector('.prod-price .value')?.textContent?.trim();
                const prodImg = document.querySelector('.prod-image img')?.src;

                // 이미지 수
                const imgCount = document.querySelectorAll('img').length;

                return { ogTitle, ogImage, ogDesc, h1, h2, title, prodTitle, price, prodImg, imgCount };
            });

            console.log(`\n  ── 추출 결과 ──`);
            console.log(`  📰 Title: ${info.title || '없음'}`);
            console.log(`  📦 H1: ${info.h1 || '없음'}`);
            console.log(`  📦 상품명: ${info.prodTitle || info.ogTitle || '없음'}`);
            console.log(`  💰 가격: ${info.price || '없음'}`);
            console.log(`  🖼 이미지: ${info.imgCount}개`);
            console.log(`  🖼 대표: ${(info.prodImg || info.ogImage || '없음').substring(0, 70)}`);
            console.log(`  📝 설명: ${(info.ogDesc || '없음').substring(0, 60)}`);

            const success = !!(info.prodTitle || info.ogTitle || (info.h1 && info.h1.length > 5));
            console.log(`\n  ${success ? '🎉 성공! 상품 정보 추출 완료!' : '⚠️ 상품 정보 불완전'}`);

            // HTML 저장
            fs.writeFileSync(`real-chrome-${arg}.html`, html, 'utf8');
            console.log(`  📁 HTML 저장: real-chrome-${arg}.html`);
        }

    } catch (err) {
        console.log(`  ❌ 에러: ${err.message}`);
    } finally {
        await page.close();
        // browser.disconnect()는 하지 않음 — 유저의 Chrome이니까!
        browser.disconnect();
        console.log('\n  🔌 Chrome 연결 해제 (브라우저는 유지)');
    }
}

main().catch(err => {
    console.error('🔥:', err.message);
    process.exit(1);
});
