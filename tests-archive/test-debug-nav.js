/**
 * 🔬 직접 Playwright 디버깅 — 리다이렉트 체인 + 실제 페이지 상태 확인
 * 
 * Stealth 패치 없이 순수 Playwright로 각 사이트의 동작 트레이싱
 */
const path = require('path');
const fs = require('fs');

async function debugSite(name, url) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🔬 [${name}] 직접 디버깅`);
    console.log(`   URL: ${url}`);

    const pw = require('playwright');
    const browser = await pw.chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--no-sandbox',
        ]
    });

    const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
        }
    });

    // WebDriver 숨기기
    await ctx.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        if (!window.chrome) window.chrome = { runtime: {} };
    });

    const page = await ctx.newPage();

    // 모든 응답 로깅 (리다이렉트 추적용)
    const navLog = [];
    page.on('response', res => {
        if (res.request().resourceType() === 'document') {
            navLog.push({
                url: res.url(),
                status: res.status(),
                headers: res.headers(),
            });
        }
    });

    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
            console.log(`   🔄 Main Frame navigated to: ${frame.url()}`);
        }
    });

    page.on('load', () => {
        console.log(`   📄 Page load event fired. URL: ${page.url()}`);
    });

    try {
        console.log(`   ▶ goto 시작...`);

        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        });

        console.log(`   📡 Response status: ${response?.status()}`);
        console.log(`   🔗 Current URL: ${page.url()}`);

        // 즉시 HTML 크기 확인
        const html1 = await page.content();
        console.log(`   📄 즉시 HTML: ${html1.length}바이트`);

        // 5초 대기
        console.log(`   ⏳ 5초 대기...`);
        await page.waitForTimeout(5000);

        const html2 = await page.content();
        console.log(`   📄 5초 후 HTML: ${html2.length}바이트`);
        console.log(`   🔗 5초 후 URL: ${page.url()}`);

        // 스크린샷
        const ssPath = path.join(__dirname, `debug-${name}.png`);
        await page.screenshot({ path: ssPath });
        console.log(`   📸 스크린샷: ${ssPath}`);

        // title 확인
        const title = await page.title();
        console.log(`   📰 Title: ${title}`);

        // 추가 10초 대기 (완전 로딩)
        console.log(`   ⏳ 추가 10초 대기...`);
        await page.waitForTimeout(10000);

        const html3 = await page.content();
        console.log(`   📄 15초 후 HTML: ${html3.length}바이트`);
        console.log(`   🔗 15초 후 URL: ${page.url()}`);

        // 페이지 제목
        const title2 = await page.title();
        console.log(`   📰 Title: ${title2}`);

        // 최종 스크린샷
        const ssPath2 = path.join(__dirname, `debug-${name}-final.png`);
        await page.screenshot({ path: ssPath2 });
        console.log(`   📸 최종 스크린샷: ${ssPath2}`);

        // HTML 저장
        const htmlPath = path.join(__dirname, `debug-${name}.html`);
        fs.writeFileSync(htmlPath, html3, 'utf8');
        console.log(`   💾 HTML 저장: ${htmlPath}`);

        // 네비게이션 로그
        console.log(`\n   📋 Response 로그 (${navLog.length}개):`);
        navLog.forEach((n, i) => {
            console.log(`      ${i + 1}. [${n.status}] ${n.url.substring(0, 80)}`);
        });

    } catch (err) {
        console.log(`   ❌ 에러: ${err.message}`);

        // 에러 상태에서도 스크린샷
        try {
            const ssPath = path.join(__dirname, `debug-${name}-error.png`);
            await page.screenshot({ path: ssPath });
            console.log(`   📸 에러 스크린샷: ${ssPath}`);
        } catch { }
    } finally {
        await ctx.close();
        await browser.close();
    }
}

async function main() {
    const arg = process.argv[2] || 'gmarket';

    const urls = {
        coupang: 'https://www.coupang.com/vp/products/8178498750',
        gmarket: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
        '11st': 'https://www.11st.co.kr/products/6836498473',
        temu: 'https://www.temu.com/kr/bluetooth-earphones.html',
    };

    if (urls[arg]) {
        await debugSite(arg, urls[arg]);
    } else {
        console.log('사용: node test-debug-nav.js [coupang|gmarket|11st|temu]');
    }

    process.exit(0);
}

main();
