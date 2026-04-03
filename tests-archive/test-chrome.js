/**
 * 🔬 System Chrome 테스트 — channel: 'chrome' 으로 실제 크롬 사용
 * 
 * Playwright의 번들 Chromium 대신 시스템에 설치된 실제 Chrome을 사용
 * TLS fingerprint가 실제 Chrome과 동일해서 CDN 차단 우회 가능
 */
const path = require('path');
const fs = require('fs');

async function testWithRealChrome(name, url) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`🔬 [${name}] System Chrome 테스트`);
    console.log(`   URL: ${url}`);

    const pw = require('playwright');

    let browser;
    try {
        // 시스템 Chrome 사용!
        browser = await pw.chromium.launch({
            headless: false,
            channel: 'chrome',  // 🔑 실제 Chrome 사용 — TLS fingerprint 우회
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
            ]
        });

        console.log(`   ✅ Chrome 시작됨`);
    } catch (err) {
        console.log(`   ❌ Chrome 시작 실패: ${err.message}`);
        console.log(`   💡 시스템에 Chrome이 설치되어 있어야 합니다.`);
        return;
    }

    const ctx = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 900 },
        locale: 'ko-KR',
        timezoneId: 'Asia/Seoul',
        extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
        }
    });

    // WebDriver 숨기기
    await ctx.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await ctx.newPage();

    try {
        console.log(`   ▶ 페이지 이동...`);

        const resp = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        });

        console.log(`   📡 Status: ${resp?.status()}`);

        // 콘텐츠 대기
        console.log(`   ⏳ 콘텐츠 렌더링 대기 (최대 10초)...`);
        try {
            await page.waitForFunction(
                () => (document.body?.innerText || '').length > 100 || document.querySelectorAll('img').length > 3,
                { timeout: 10000 }
            );
            console.log(`   ✅ 콘텐츠 감지됨!`);
        } catch {
            console.log(`   ⏳ 10초 타임아웃 — 현재 상태로 진행`);
        }

        // 추가 대기
        await page.waitForTimeout(3000);

        const html = await page.content();
        console.log(`   📄 HTML: ${(html.length / 1024).toFixed(0)}KB (${html.length}바이트)`);
        console.log(`   🔗 URL: ${page.url()}`);

        const title = await page.title();
        console.log(`   📰 Title: ${title}`);

        // 스크린샷
        const ssPath = path.join(__dirname, `chrome-${name}.png`);
        await page.screenshot({ path: ssPath });
        console.log(`   📸 스크린샷: ${ssPath}`);

        // HTML 저장
        const htmlPath = path.join(__dirname, `chrome-${name}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`   💾 HTML 저장: ${htmlPath}`);

        // 간단한 DOM 분석
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);

        console.log(`\n   🔍 DOM 분석:`);
        console.log(`   h1: ${$('h1').length}개`);
        console.log(`   img: ${$('img').length}개`);
        console.log(`   [class*=price]: ${$('[class*="price"]').length}개`);
        console.log(`   JSON-LD: ${$('script[type="application/ld+json"]').length}개`);
        console.log(`   OG title: ${$('meta[property="og:title"]').attr('content') || '없음'}`);
        console.log(`   OG image: ${$('meta[property="og:image"]').attr('content')?.substring(0, 80) || '없음'}`);

        // 이미지 URL 추출
        const imgs = [];
        $('img').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || '';
            if (src.startsWith('http') || src.startsWith('//')) imgs.push(src);
        });
        console.log(`\n   🖼 이미지 ${imgs.length}개:`);
        imgs.slice(0, 10).forEach((img, i) => console.log(`      ${i + 1}. ${img.substring(0, 100)}`));

        const success = html.length > 5000;
        console.log(`\n   ${success ? '✅ 성공!' : '❌ 실패'} — HTML ${(html.length / 1024).toFixed(0)}KB`);

    } catch (err) {
        console.log(`   ❌ 에러: ${err.message}`);
        try {
            const ssPath = path.join(__dirname, `chrome-${name}-error.png`);
            await page.screenshot({ path: ssPath });
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

    if (arg === 'all') {
        for (const [key, url] of Object.entries(urls)) {
            await testWithRealChrome(key, url);
            await new Promise(r => setTimeout(r, 3000));
        }
    } else if (urls[arg]) {
        await testWithRealChrome(arg, urls[arg]);
    } else {
        console.log('사용: node test-chrome.js [coupang|gmarket|11st|temu|all]');
    }

    process.exit(0);
}

main();
