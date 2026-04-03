/**
 * 🔬 네이버 쇼핑 재시도 (일시적 제한 해제 후)
 * 
 * 단일 요청만 보내서 IP 제한 안 걸리게!
 * 재시도 + 대기 로직 포함
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function sleep(ms) {
    console.log(`  ⏳ ${(ms / 1000).toFixed(0)}초 대기...`);
    return new Promise(r => setTimeout(r, ms));
}

async function crawlNaverShopping(keyword, retries = 3) {
    console.log(`\n🔍 네이버 쇼핑 검색: "${keyword}"`);

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,900',
            '--lang=ko-KR,ko',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();

    try {
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1280, height: 900 });

        // 먼저 네이버 메인에 방문 (자연스러운 세션 시작)
        console.log('  🏠 네이버 메인 방문...');
        await page.goto('https://www.naver.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(2000);

        // 네이버 쇼핑으로 이동
        const url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel`;
        console.log(`  🔗 쇼핑 검색: ${url}`);

        for (let attempt = 1; attempt <= retries; attempt++) {
            console.log(`\n  ── 시도 ${attempt}/${retries} ──`);

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(3000);

            // 일시적 제한 체크
            const html = await page.content();
            if (html.includes('일시적으로 제한')) {
                console.log('  ⚠️ 일시적 제한 감지 — 대기 후 재시도');
                if (attempt < retries) {
                    await sleep(15000); // 15초 대기
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
                    await sleep(3000);

                    const html2 = await page.content();
                    if (!html2.includes('일시적으로 제한')) {
                        console.log('  ✅ 제한 해제! 계속 진행');
                    } else {
                        console.log('  ❌ 아직 제한 중...');
                        continue;
                    }
                } else {
                    console.log('  ❌ 모든 재시도 실패');
                    break;
                }
            }

            // 상품 목록 대기
            try {
                await page.waitForSelector('[class*="product"]', { timeout: 8000 });
                console.log('  ✅ 상품 목록 감지!');
            } catch {
                console.log('  ⚠️ 상품 셀렉터 대기 실패, DOM 추출 시도');
            }

            await page.screenshot({ path: 'naver-shopping-retry.png', fullPage: false });

            // __NEXT_DATA__ 추출
            const nextData = await page.evaluate(() => {
                const el = document.getElementById('__NEXT_DATA__');
                return el ? el.textContent : null;
            });

            if (nextData) {
                try {
                    const data = JSON.parse(nextData);
                    fs.writeFileSync('naver-shopping-data.json', JSON.stringify(data, null, 2), 'utf8');
                    console.log('  ✅ __NEXT_DATA__ 저장: naver-shopping-data.json');

                    const products = findAllProducts(data);
                    if (products.length > 0) {
                        console.log(`  🎉 상품 ${products.length}개 발견!`);
                        products.slice(0, 5).forEach((p, i) => {
                            const title = p.productTitle || p.title || p.name || '?';
                            console.log(`\n  [${i + 1}] ${title}`);
                            console.log(`      💰 ${p.price || p.lowPrice || '?'}원 | 🏪 ${p.mallName || '?'}`);
                            console.log(`      🖼 ${(p.imageUrl || p.image || '?').substring(0, 70)}`);
                        });
                        return products;
                    }
                } catch (e) {
                    console.log(`  ⚠️ JSON 파싱 실패: ${e.message}`);
                }
            }

            // DOM 직접 추출
            const domProducts = await page.evaluate(() => {
                const items = [];
                // 네이버 쇼핑 상품 카드 다양한 셀렉터
                const cards = document.querySelectorAll(
                    '[class*="product_item"], [class*="basicList_item"], [class*="cell_inner"]'
                );

                cards.forEach((card, i) => {
                    if (i >= 10) return;
                    const titleEl = card.querySelector('[class*="title"] a, [class*="name"], a[title]');
                    const priceEl = card.querySelector('[class*="price"] em, [class*="price"] strong, [class*="num"]');
                    const imgEl = card.querySelector('img[src*="shopping"], img[data-src*="shopping"], img');
                    const mallEl = card.querySelector('[class*="mall"], [class*="store"], [class*="brand"]');

                    const title = (titleEl?.getAttribute('title') || titleEl?.textContent || '').trim();
                    if (title && title.length > 2) {
                        items.push({
                            title: title.substring(0, 100),
                            price: (priceEl?.textContent || '').replace(/[^0-9,]/g, '').trim(),
                            image: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                            mall: (mallEl?.textContent || '').trim(),
                        });
                    }
                });
                return items;
            });

            if (domProducts.length > 0) {
                console.log(`  ✅ DOM에서 상품 ${domProducts.length}개 추출!`);
                domProducts.forEach((p, i) => {
                    console.log(`  [${i + 1}] ${p.title}`);
                    console.log(`      💰 ${p.price}원 | 🏪 ${p.mall}`);
                });
                return domProducts;
            }

            // HTML 저장 (디버깅)
            const finalHtml = await page.content();
            fs.writeFileSync('naver-shopping-retry.html', finalHtml, 'utf8');
            console.log(`  📁 HTML 저장 (${(finalHtml.length / 1024).toFixed(0)}KB)`);

            if (attempt < retries) {
                console.log('  재시도를 위해 30초 대기...');
                await sleep(30000);
            }
        }

        return [];

    } finally {
        await browser.close();
    }
}

function findAllProducts(obj, depth = 0) {
    if (depth > 15 || !obj || typeof obj !== 'object') return [];

    for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object') {
            const first = val[0];
            if (first.productTitle || first.title || first.mallName || first.imageUrl || first.lowPrice) {
                return val;
            }
        }
    }

    for (const val of Object.values(obj)) {
        const found = findAllProducts(val, depth + 1);
        if (found.length > 0) return found;
    }
    return [];
}

async function main() {
    console.log('🔬 네이버 쇼핑 재시도 테스트 (일시적 제한 해제 후)');
    console.log(`  시간: ${new Date().toLocaleString('ko-KR')}`);

    const products = await crawlNaverShopping('블루투스 이어폰');

    if (products.length > 0) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`🎉 성공! ${products.length}개 상품 정보 획득!`);
        console.log('═'.repeat(60));
    } else {
        console.log('\n❌ 실패 — IP 제한이 아직 안 풀렸을 수 있음. 몇 분 후 재시도');
    }
}

main().catch(err => {
    console.error('🔥:', err.message);
    process.exit(1);
});
