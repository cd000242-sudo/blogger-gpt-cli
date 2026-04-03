/**
 * 🔬 쇼핑 크롤러 Stealth 진단 테스트
 * 
 * playwright-runner.ts의 stealth 패치를 통해 크롤링
 * 크롬 창 보이게 실행 (headless: false)
 * 
 * 사용법: node test-stealth-diag.js [coupang|gmarket|11st|temu|all]
 */
const path = require('path');
const fs = require('fs');

require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: { module: 'commonjs', esModuleInterop: true }
});

// ── stealth 패치가 적용된 runner 사용 ──
const { fetchPage } = require('./src/crawlers/playwright-runner');

const url_require = require; // cheerio를 위한 alias

const PLATFORMS = {
    coupang: { name: '쿠팡', url: 'https://www.coupang.com/vp/products/8178498750' },
    gmarket: { name: 'G마켓', url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340' },
    '11st': { name: '11번가', url: 'https://www.11st.co.kr/products/6836498473' },
    temu: { name: 'Temu', url: 'https://www.temu.com/kr/bluetooth-earphones.html' },
};

async function diagnose(key, config) {
    const log = [];
    const print = (msg) => { console.log(msg); log.push(msg); };

    print(`\n${'═'.repeat(60)}`);
    print(`🔬 [${config.name}] Stealth 크롤링 진단`);
    print(`   URL: ${config.url}`);
    print('═'.repeat(60));

    const t0 = Date.now();

    try {
        // ── stealth 패치된 fetchPage 사용! ──
        const result = await fetchPage(config.url, {
            timeoutMs: 25000,
            headless: false,     // 🖥 크롬 창 보이게!
            enableImages: true,  // 이미지 로딩 허용
        });

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        print(`\n⏱  소요: ${elapsed}초`);
        print(`📄 HTML: ${(result.html.length / 1024).toFixed(0)}KB`);

        // HTML 파일 저장
        const htmlPath = path.join(__dirname, `diag-stealth-${key}.html`);
        fs.writeFileSync(htmlPath, result.html, 'utf8');
        print(`💾 HTML 저장: ${htmlPath}`);

        // cheerio로 DOM 분석
        const cheerio = url_require('cheerio');
        const $ = cheerio.load(result.html);

        // 페이지 제목
        const title = $('title').text().trim();
        print(`\n📰 제목: ${title}`);

        // Access Denied 감지
        if (title.includes('Access Denied') || result.html.includes('Access Denied')) {
            print(`❌ [${config.name}] Access Denied — CDN 레벨 차단`);
            return { name: config.name, ok: false, reason: 'CDN Access Denied', elapsed };
        }

        // 빈 페이지 감지
        if (result.html.length < 1000) {
            print(`❌ [${config.name}] 빈 페이지 — HTML ${result.html.length}바이트`);
            return { name: config.name, ok: false, reason: 'Empty page', elapsed };
        }

        // OG 메타태그
        const ogTitle = $('meta[property="og:title"]').attr('content') || '';
        const ogDesc = $('meta[property="og:description"]').attr('content') || '';
        const ogImage = $('meta[property="og:image"]').attr('content') || '';

        print(`\n── 🏷 OG 태그 ──`);
        print(`  title: ${ogTitle || '없음'}`);
        print(`  desc:  ${(ogDesc || '없음').substring(0, 80)}`);
        print(`  image: ${ogImage || '없음'}`);

        // JSON-LD 데이터
        const jsonLdScripts = $('script[type="application/ld+json"]');
        if (jsonLdScripts.length > 0) {
            print(`\n── 📋 JSON-LD (${jsonLdScripts.length}개) ──`);
            jsonLdScripts.each((i, el) => {
                try {
                    const data = JSON.parse($(el).text());
                    print(`  ${i + 1}. @type: ${data['@type'] || '?'} | name: ${(data.name || '없음').substring(0, 50)}`);
                    if (data.offers) {
                        const price = data.offers.price || data.offers.lowPrice;
                        print(`     가격: ${price} ${data.offers.priceCurrency || ''}`);
                    }
                } catch { }
            });
        }

        // DOM 요소 체크
        print(`\n── 🔍 DOM 요소 ──`);
        const checks = {
            'h1': $('h1').length,
            'h2': $('h2').length,
            'img': $('img').length,
            '[class*=product]': $('[class*="product"], [class*="prod"]').length,
            '[class*=price]': $('[class*="price"], [class*="cost"]').length,
            '[class*=review]': $('[class*="review"]').length,
        };
        Object.entries(checks).forEach(([name, count]) => {
            print(`  ${count > 0 ? '✅' : '❌'} ${name}: ${count}개`);
        });

        // 이미지 수집
        const images = [];
        $('img').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-img-src') || '';
            if (src && (src.startsWith('http') || src.startsWith('//'))) {
                const fullSrc = src.startsWith('//') ? `https:${src}` : src;
                images.push({
                    src: fullSrc,
                    alt: $(el).attr('alt') || '',
                    classes: $(el).attr('class') || '',
                });
            }
        });

        print(`\n── 🖼 이미지 (${images.length}개) ──`);
        images.slice(0, 15).forEach((img, i) => {
            const altStr = img.alt ? ` [${img.alt.substring(0, 25)}]` : '';
            print(`  ${(i + 1).toString().padStart(2)}. ${img.src.substring(0, 100)}${altStr}`);
        });
        if (images.length > 15) print(`  ... 외 ${images.length - 15}개`);

        // 네트워크 응답 분석
        const failedRes = result.resources.filter(r => r.status && r.status >= 400);
        if (failedRes.length > 0) {
            print(`\n── ⚠️ 실패 응답 (${failedRes.length}개) ──`);
            failedRes.slice(0, 5).forEach(r => print(`  ${r.status}: ${r.url.substring(0, 80)}`));
        }

        // 성공 판정
        const hasContent = result.html.length > 10000;
        const hasTitle = ogTitle || title;
        const hasImages = images.length > 3;

        print(`\n── ✅ [${config.name}] 판정 ──`);
        print(`  콘텐츠: ${hasContent ? '✅ OK' : '❌ 부족'} (${(result.html.length / 1024).toFixed(0)}KB)`);
        print(`  제목:   ${hasTitle ? '✅ OK' : '❌ 없음'}`);
        print(`  이미지: ${hasImages ? '✅ OK' : '❌ 부족'} (${images.length}개)`);

        // 결과 저장
        const resultPath = path.join(__dirname, `diag-stealth-${key}.txt`);
        fs.writeFileSync(resultPath, log.join('\n'), 'utf8');
        print(`📄 결과 저장: ${resultPath}`);

        return { name: config.name, ok: hasContent && !!hasTitle, title: ogTitle || title, images: images.length, elapsed };

    } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        print(`\n❌ [${config.name}] 실패 (${elapsed}초): ${err.message}`);
        return { name: config.name, ok: false, error: err.message, elapsed };
    }
}

async function main() {
    const arg = process.argv[2] || 'all';

    console.log('🔬 Stealth 쇼핑 크롤러 진단');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`   대상: ${arg}`);

    const results = [];

    if (arg === 'all') {
        for (const [key, config] of Object.entries(PLATFORMS)) {
            const r = await diagnose(key, config);
            results.push(r);
            await new Promise(r => setTimeout(r, 3000));
        }
    } else if (PLATFORMS[arg]) {
        const r = await diagnose(arg, PLATFORMS[arg]);
        results.push(r);
    } else {
        console.log(`❌ 알 수 없는 플랫폼: ${arg}`);
        console.log(`   사용: node test-stealth-diag.js [coupang|gmarket|11st|temu|all]`);
        process.exit(1);
    }

    if (results.length > 1) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 전체 결과');
        console.log('═'.repeat(60));
        results.forEach(r => {
            if (r.ok) {
                console.log(`  ✅ ${r.name}: "${(r.title || '').substring(0, 35)}" (이미지 ${r.images}개, ${r.elapsed}초)`);
            } else {
                console.log(`  ❌ ${r.name}: ${r.reason || r.error || '실패'} (${r.elapsed}초)`);
            }
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error('🔥 에러:', err);
    process.exit(1);
});
