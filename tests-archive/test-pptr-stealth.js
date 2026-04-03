/**
 * 🔬 puppeteer-extra + StealthPlugin 직접 테스트
 * 
 * shopping-crawler.js 클래스 사용하지 않고 직접 puppeteer-extra 사용
 * 쿠팡, G마켓, 11번가 테스트
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// Stealth 플러그인 적용
puppeteer.use(StealthPlugin());

const URLS = {
    coupang: { name: '쿠팡', url: 'https://www.coupang.com/vp/products/8178498750' },
    gmarket: { name: 'G마켓', url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340' },
    '11st': { name: '11번가', url: 'https://www.11st.co.kr/products/6836498473' },
};

async function testSite(key, config) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔬 [${config.name}] puppeteer-extra + StealthPlugin 테스트`);
    console.log(`   URL: ${config.url}`);
    console.log('═'.repeat(60));

    const t0 = Date.now();

    const browser = await puppeteer.launch({
        headless: false,  // 🖥 크롬 창 보이게!
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--window-size=1280,900',
            '--lang=ko-KR,ko',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();

    try {
        // UA 설정
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );

        // 뷰포트
        await page.setViewport({ width: 1280, height: 900 });

        // 추가 헤더
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
        });

        console.log(`   ▶ 페이지 이동 중...`);

        // 페이지 이동
        const response = await page.goto(config.url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
        });

        console.log(`   📡 Status: ${response?.status()}`);

        // 콘텐츠 렌더링 대기
        console.log(`   ⏳ 렌더링 대기...`);
        await page.waitForTimeout(3000);

        // 추가 대기 (networkidle 시뮬레이션)
        try {
            await page.waitForFunction(
                () => (document.body?.innerText || '').length > 200,
                { timeout: 10000 }
            );
            console.log(`   ✅ 콘텐츠 감지!`);
        } catch {
            console.log(`   ⏳ 10초 타임아웃 — 현재 상태로 진행`);
        }

        // 스크린샷
        const ssPath = path.join(__dirname, `pptr-${key}.png`);
        await page.screenshot({ path: ssPath, fullPage: false });
        console.log(`   📸 스크린샷: ${ssPath}`);

        // HTML 추출
        const html = await page.content();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        console.log(`   📄 HTML: ${(html.length / 1024).toFixed(0)}KB (${html.length}바이트)`);
        console.log(`   ⏱  소요: ${elapsed}초`);

        // HTML 파일 저장
        const htmlPath = path.join(__dirname, `pptr-${key}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');

        // Access Denied 체크
        if (html.includes('Access Denied')) {
            console.log(`   ❌ [${config.name}] Access Denied — 여전히 차단됨`);
            return { name: config.name, ok: false, reason: 'Access Denied', elapsed };
        }

        // 빈 페이지 체크
        if (html.length < 500) {
            console.log(`   ❌ [${config.name}] 빈 페이지`);
            return { name: config.name, ok: false, reason: 'Empty', elapsed };
        }

        // 페이지 제목
        const title = await page.title();
        console.log(`   📰 Title: ${title}`);

        // 상품 정보 추출 시도
        const productInfo = await page.evaluate(() => {
            // OG 태그
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
            const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
            const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';

            // 상품명 (다양한 셀렉터)
            const h1 = document.querySelector('h1')?.textContent?.trim() || '';
            const h2 = document.querySelector('h2')?.textContent?.trim() || '';
            const prodTitle = document.querySelector('.prod-buy-header__title')?.textContent?.trim() ||
                document.querySelector('h1.title')?.textContent?.trim() ||
                document.querySelector('.product_name')?.textContent?.trim() || '';

            // 가격
            const price = document.querySelector('.total-price strong')?.textContent?.trim() ||
                document.querySelector('.prod-price .value')?.textContent?.trim() ||
                document.querySelector('.price strong')?.textContent?.trim() || '';

            // 이미지 수
            const imgCount = document.querySelectorAll('img').length;

            return { ogTitle, ogImage, ogDesc, h1, h2, prodTitle, price, imgCount };
        });

        console.log(`\n   ── 상품 정보 ──`);
        console.log(`   OG Title: ${productInfo.ogTitle || '없음'}`);
        console.log(`   OG Image: ${(productInfo.ogImage || '없음').substring(0, 80)}`);
        console.log(`   OG Desc:  ${(productInfo.ogDesc || '없음').substring(0, 80)}`);
        console.log(`   h1: ${productInfo.h1 || '없음'}`);
        console.log(`   상품명: ${productInfo.prodTitle || '없음'}`);
        console.log(`   가격: ${productInfo.price || '없음'}`);
        console.log(`   이미지: ${productInfo.imgCount}개`);

        const success = html.length > 5000 && !html.includes('Access Denied');
        console.log(`\n   ${success ? '✅ 성공!' : '❌ 실패'}`);

        return { name: config.name, ok: success, title: productInfo.ogTitle || title, elapsed };

    } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`   ❌ 에러 (${elapsed}초): ${err.message}`);

        try {
            const ssPath = path.join(__dirname, `pptr-${key}-error.png`);
            await page.screenshot({ path: ssPath });
        } catch { }

        return { name: config.name, ok: false, error: err.message, elapsed };
    } finally {
        await browser.close();
    }
}

async function main() {
    const arg = process.argv[2] || 'coupang';

    console.log('🔬 puppeteer-extra + StealthPlugin 쇼핑 크롤러 테스트');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`   대상: ${arg}`);

    if (arg === 'all') {
        const results = [];
        for (const [key, config] of Object.entries(URLS)) {
            const r = await testSite(key, config);
            results.push(r);
            await new Promise(r => setTimeout(r, 3000));
        }
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 전체 결과');
        console.log('═'.repeat(60));
        results.forEach(r => {
            console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}: ${r.ok ? r.title : (r.reason || r.error)} (${r.elapsed}초)`);
        });
    } else if (URLS[arg]) {
        await testSite(arg, URLS[arg]);
    } else {
        console.log('사용: node test-pptr-stealth.js [coupang|gmarket|11st|all]');
    }

    process.exit(0);
}

main().catch(err => {
    console.error('🔥:', err);
    process.exit(1);
});
