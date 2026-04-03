/**
 * 🔬 puppeteer-extra + StealthPlugin으로 네이버 쇼핑 크롤링
 * 
 * 전략: 쿠팡 상품을 직접 크롤링할 수 없으므로
 * 네이버 쇼핑 검색에서 쿠팡 상품 정보를 가져온다!
 * 
 * 네이버 쇼핑은 쿠팡/G마켓/11번가 상품을 모두 인덱싱하고 있음
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function crawlNaverShopping(keyword) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 네이버 쇼핑 크롤링 (puppeteer-extra): "${keyword}"`);
    console.log('═'.repeat(60));

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
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

        const url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&sort=rel`;
        console.log(`  URL: ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

        // 렌더링 대기
        console.log('  ⏳ 렌더링 대기...');
        await page.waitForTimeout(3000);

        // 상품 목록이 나타날 때까지 대기
        try {
            await page.waitForSelector('[class*="product"]', { timeout: 10000 });
            console.log('  ✅ 상품 목록 감지!');
        } catch {
            console.log('  ⚠️ 상품 셀렉터 타임아웃, 현재 상태로 진행');
        }

        // 스크린샷
        await page.screenshot({ path: 'naver-shopping-pptr.png', fullPage: false });
        console.log('  📸 스크린샷: naver-shopping-pptr.png');

        // __NEXT_DATA__ 추출
        const nextData = await page.evaluate(() => {
            const el = document.getElementById('__NEXT_DATA__');
            return el ? el.textContent : null;
        });

        if (nextData) {
            console.log('  ✅ __NEXT_DATA__ 발견!');
            try {
                const data = JSON.parse(nextData);
                fs.writeFileSync('naver-shopping-data.json', JSON.stringify(data, null, 2), 'utf8');
                console.log('  📁 저장: naver-shopping-data.json');

                // 상품 데이터 탐색
                const products = findProducts(data);
                if (products.length > 0) {
                    console.log(`  📦 상품 ${products.length}개 발견!`);
                    products.slice(0, 5).forEach((p, i) => {
                        const title = p.productTitle || p.title || p.name || '?';
                        console.log(`\n  [${i + 1}] ${title}`);
                        console.log(`      💰 가격: ${p.price || p.lowPrice || '?'}원`);
                        console.log(`      🏪 쇼핑몰: ${p.mallName || p.shopName || '?'}`);
                        console.log(`      🖼 이미지: ${(p.imageUrl || p.image || '?').substring(0, 70)}`);
                        console.log(`      🔗 링크: ${(p.mallProductUrl || p.productUrl || '?').substring(0, 70)}`);
                        if (p.reviewCount) console.log(`      📝 리뷰: ${p.reviewCount}`);
                        if (p.scoreInfo) console.log(`      ⭐ 평점: ${p.scoreInfo}`);
                    });

                    return products;
                } else {
                    // pageProps 내부 탐색
                    const pageProps = data.props?.pageProps;
                    if (pageProps) {
                        console.log(`  pageProps keys: ${Object.keys(pageProps).join(', ')}`);

                        // 모든 키를 순회하며 상품 배열 찾기
                        const allProducts = findAllProducts(pageProps);
                        if (allProducts.length > 0) {
                            console.log(`  📦 깊은 탐색으로 상품 ${allProducts.length}개 발견!`);
                            allProducts.slice(0, 5).forEach((p, i) => {
                                console.log(`  [${i + 1}] ${JSON.stringify(p).substring(0, 150)}`);
                            });
                            return allProducts;
                        }
                    }
                }
            } catch (e) {
                console.log(`  ⚠️ JSON 파싱 실패: ${e.message}`);
            }
        } else {
            console.log('  ❌ __NEXT_DATA__ 없음');
        }

        // 직접 DOM에서 추출
        console.log('\n  🔧 DOM 직접 추출 시도...');
        const domProducts = await page.evaluate(() => {
            const items = [];

            // 상품 카드 셀렉터들
            const cards = document.querySelectorAll('[class*="product_item"], [class*="basicList_item"], li[class*="item"]');

            cards.forEach((card, i) => {
                if (i >= 10) return;

                const titleEl = card.querySelector('[class*="title"], [class*="name"], a[title]');
                const priceEl = card.querySelector('[class*="price"] em, [class*="price"] span, [class*="num"]');
                const imgEl = card.querySelector('img');
                const linkEl = card.querySelector('a[href*="shopping"]') || card.querySelector('a');
                const mallEl = card.querySelector('[class*="mall"], [class*="store"]');

                if (titleEl) {
                    items.push({
                        title: (titleEl.getAttribute('title') || titleEl.textContent || '').trim().substring(0, 100),
                        price: (priceEl?.textContent || '').trim(),
                        image: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                        link: linkEl?.href || '',
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
                console.log(`      💰 ${p.price} / 🏪 ${p.mall}`);
                console.log(`      🖼 ${p.image.substring(0, 60)}`);
            });
            return domProducts;
        }

        // HTML 저장 (디버깅)
        const html = await page.content();
        fs.writeFileSync('naver-shopping-pptr.html', html, 'utf8');
        console.log(`  📁 HTML 저장 (${(html.length / 1024).toFixed(0)}KB): naver-shopping-pptr.html`);

        return [];

    } finally {
        await browser.close();
    }
}

function findProducts(obj, depth = 0) {
    if (depth > 15 || !obj || typeof obj !== 'object') return [];

    for (const key of ['products', 'items', 'productList']) {
        if (Array.isArray(obj[key]) && obj[key].length > 0 && obj[key][0]?.productTitle) {
            return obj[key];
        }
    }

    for (const val of Object.values(obj)) {
        const found = findProducts(val, depth + 1);
        if (found.length > 0) return found;
    }

    return [];
}

function findAllProducts(obj, depth = 0) {
    if (depth > 15 || !obj || typeof obj !== 'object') return [];

    // 어떤 배열이든 상품처럼 보이면 반환
    for (const [key, val] of Object.entries(obj)) {
        if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object') {
            const first = val[0];
            if (first.productTitle || first.title || first.mallName || first.price || first.imageUrl) {
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
    console.log('🔬 puppeteer-extra 네이버 쇼핑 크롤링 테스트');
    console.log(`  시간: ${new Date().toLocaleString('ko-KR')}`);

    const products = await crawlNaverShopping('블루투스 이어폰');

    if (products.length > 0) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log('🎉 성공! 네이버 쇼핑에서 상품 정보를 가져올 수 있습니다!');
        console.log('이 방법으로 쿠팡/G마켓/11번가 상품 정보를 우회 수집 가능!');
        console.log('═'.repeat(60));
    } else {
        console.log('\n❌ 네이버 쇼핑에서도 상품 추출 실패');
    }
}

main().catch(err => {
    console.error('🔥:', err.message);
    process.exit(1);
});
