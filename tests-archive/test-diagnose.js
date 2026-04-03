/**
 * 🔬 쇼핑 크롤러 진단 테스트
 * 
 * 각 사이트의 실제 HTML을 파일로 저장하여 문제점 분석
 * headless: false로 크롬 창 보이게 실행
 */
const path = require('path');
const fs = require('fs');

require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: { module: 'commonjs', esModuleInterop: true }
});

async function diagnose(name, url) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🔬 [${name}] 진단 시작`);
    console.log(`   URL: ${url}`);

    const t0 = Date.now();
    let browser;

    try {
        const pw = require('playwright');

        browser = await pw.chromium.launch({
            headless: false,  // 크롬 창 보이게!
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 900 },
            locale: 'ko-KR',
            timezoneId: 'Asia/Seoul',
        });

        const page = await context.newPage();

        // 네트워크 응답 추적
        const responses = [];
        page.on('response', res => {
            responses.push({ url: res.url().substring(0, 100), status: res.status() });
        });

        console.log(`   ▶ 페이지 이동 중...`);

        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });
        } catch (gotoErr) {
            console.log(`   ⚠️ goto 타임아웃, 현재 페이지 상태로 진행: ${gotoErr.message}`);
        }

        // 추가 대기 (JS 렌더링 시간)
        await page.waitForTimeout(3000);

        // 스크린샷 저장
        const screenshotPath = path.join(__dirname, `diag-${name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`   📸 스크린샷: ${screenshotPath}`);

        // HTML 저장
        const html = await page.content();
        const htmlPath = path.join(__dirname, `diag-${name}.html`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`   📄 HTML 저장: ${htmlPath} (${(html.length / 1024).toFixed(0)}KB)`);

        // 페이지 URL 확인 (리다이렉트 감지)
        const finalUrl = page.url();
        console.log(`   🔗 최종 URL: ${finalUrl}`);
        if (finalUrl !== url) {
            console.log(`   ⚠️ 리다이렉트 감지! 원본: ${url}`);
        }

        // 페이지 제목
        const title = await page.title();
        console.log(`   📰 페이지 제목: ${title}`);

        // 주요 요소 존재 확인
        const checks = {
            'h1': await page.$$('h1').then(els => els.length),
            'h2': await page.$$('h2').then(els => els.length),
            'img': await page.$$('img').then(els => els.length),
            'product title area': await page.$$('[class*="prod"], [class*="product"], [class*="item"]').then(els => els.length),
            'price area': await page.$$('[class*="price"], [class*="cost"]').then(els => els.length),
            'review': await page.$$('[class*="review"], [class*="comment"]').then(els => els.length),
            'JSON-LD': await page.$$('script[type="application/ld+json"]').then(els => els.length),
            'OG title': await page.$$('meta[property="og:title"]').then(els => els.length),
            'OG image': await page.$$('meta[property="og:image"]').then(els => els.length),
        };

        console.log(`\n   🔍 DOM 요소 확인:`);
        Object.entries(checks).forEach(([name, count]) => {
            console.log(`      ${count > 0 ? '✅' : '❌'} ${name}: ${count}개`);
        });

        // 이미지 URL 수집
        const imageUrls = await page.$$eval('img', imgs =>
            imgs.map(img => ({
                src: img.src || img.dataset.src || img.dataset.imgSrc || '',
                alt: img.alt || '',
                width: img.naturalWidth || img.width || 0,
                height: img.naturalHeight || img.height || 0,
                classes: img.className || '',
            })).filter(i => i.src && i.src.startsWith('http'))
        );

        console.log(`\n   🖼 이미지 ${imageUrls.length}개 발견:`);
        imageUrls.forEach((img, i) => {
            const sizeStr = img.width && img.height ? ` (${img.width}x${img.height})` : '';
            const altStr = img.alt ? ` [${img.alt.substring(0, 30)}]` : '';
            console.log(`      ${i + 1}. ${img.src.substring(0, 100)}${sizeStr}${altStr}`);
        });

        // JSON-LD 확인
        const jsonLd = await page.$$eval('script[type="application/ld+json"]', scripts =>
            scripts.map(s => {
                try { return JSON.parse(s.textContent || ''); }
                catch { return null; }
            }).filter(Boolean)
        );

        if (jsonLd.length > 0) {
            console.log(`\n   📋 JSON-LD 데이터:`);
            jsonLd.forEach((ld, i) => {
                console.log(`      ${i + 1}. @type: ${ld['@type']} | name: ${(ld.name || '없음').substring(0, 50)}`);
                if (ld.image) {
                    const imgs = Array.isArray(ld.image) ? ld.image : [ld.image];
                    imgs.slice(0, 3).forEach(img => console.log(`         img: ${img.substring(0, 80)}`));
                }
            });
        }

        // OG 메타 태그 확인
        const ogData = await page.$$eval('meta[property^="og:"]', metas =>
            metas.map(m => ({ property: m.getAttribute('property'), content: (m.getAttribute('content') || '').substring(0, 100) }))
        );

        if (ogData.length > 0) {
            console.log(`\n   🏷 OG 태그:`);
            ogData.forEach(og => console.log(`      ${og.property}: ${og.content}`));
        }

        // 네트워크 응답 요약 (실패 건)
        const failedResponses = responses.filter(r => r.status >= 400);
        if (failedResponses.length > 0) {
            console.log(`\n   ⚠️ 실패 응답 ${failedResponses.length}개:`);
            failedResponses.slice(0, 5).forEach(r => console.log(`      ${r.status}: ${r.url}`));
        }

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`\n   ⏱ 소요: ${elapsed}초`);
        console.log(`   ✅ [${name}] 진단 완료`);

        await context.close();

    } catch (err) {
        console.log(`   ❌ [${name}] 진단 실패: ${err.message}`);
    } finally {
        if (browser) await browser.close();
    }
}

async function main() {
    const arg = process.argv[2] || 'all';

    const tests = {
        coupang: { name: 'coupang', url: 'https://www.coupang.com/vp/products/8178498750' },
        gmarket: { name: 'gmarket', url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340' },
        '11st': { name: '11st', url: 'https://www.11st.co.kr/products/6836498473' },
        temu: { name: 'temu', url: 'https://www.temu.com/kr/bluetooth-earphones.html' },
    };

    console.log('🔬 쇼핑 크롤러 진단 도구');
    console.log(`   대상: ${arg}`);

    if (arg === 'all') {
        for (const [key, config] of Object.entries(tests)) {
            await diagnose(config.name, config.url);
            await new Promise(r => setTimeout(r, 2000));
        }
    } else if (tests[arg]) {
        await diagnose(tests[arg].name, tests[arg].url);
    } else {
        console.log(`❌ 알 수 없는 플랫폼: ${arg}`);
        console.log(`   사용: node test-diagnose.js [coupang|gmarket|11st|temu|all]`);
    }

    process.exit(0);
}

main();
