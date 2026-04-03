/**
 * 🔬 네이버 쇼핑 API로 쿠팡/G마켓/11번가 상품 정보 가져오기
 * 
 * 핵심 발상: 한국 쇼핑몰들은 네이버 쇼핑에 상품을 등록하므로
 * 네이버 쇼핑 검색 API로 상품 제목만 알면 정보를 가져올 수 있다!
 * 
 * 또는: 쿠팡 상품 ID로 직접 네이버 쇼핑에서 검색
 */
const https = require('https');
const fs = require('fs');

function httpGet(url, headers = {}) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : require('http');
        proto.get(url, {
            headers: {
                'Accept-Encoding': 'identity',
                ...headers
            }
        }, (res) => {
            // 리다이렉트
            if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
                let loc = res.headers.location;
                if (loc.startsWith('/')) {
                    const u = new URL(url);
                    loc = `${u.protocol}//${u.host}${loc}`;
                }
                resolve(httpGet(loc, headers));
                return;
            }
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        }).on('error', reject);
    });
}

// ── 네이버 쇼핑 검색 결과에서 상품 정보 추출 ──
async function searchNaverShopping(keyword) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔍 네이버 쇼핑 검색: "${keyword}"`);
    console.log('═'.repeat(60));

    // 네이버 쇼핑 모바일 검색 (SSR이므로 HTML에 데이터 포함)
    const url = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&cat_id=&frm=NVSHATC`;

    const res = await httpGet(url, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://www.naver.com/',
    });

    console.log(`  Status: ${res.status}, HTML: ${(res.body.length / 1024).toFixed(0)}KB`);

    // __NEXT_DATA__ 파싱 (Next.js SSR 데이터)
    const nextDataMatch = res.body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
        try {
            const data = JSON.parse(nextDataMatch[1]);
            console.log('  ✅ __NEXT_DATA__ 발견!');

            // 상품 목록 탐색
            const products = deepFind(data, 'products') || deepFind(data, 'items') || [];
            console.log(`  📦 상품 수: ${products.length}`);

            if (products.length > 0) {
                products.slice(0, 5).forEach((p, i) => {
                    console.log(`\n  [${i + 1}] ${p.productTitle || p.title || p.name || '?'}`);
                    console.log(`      가격: ${p.price || p.lowPrice || '?'}원`);
                    console.log(`      쇼핑몰: ${p.mallName || p.shopName || '?'}`);
                    console.log(`      이미지: ${(p.imageUrl || p.image || '?').substring(0, 70)}`);
                    console.log(`      링크: ${(p.productUrl || p.mallProductUrl || p.crUrl || '?').substring(0, 70)}`);
                    if (p.reviewCount) console.log(`      리뷰: ${p.reviewCount}`);
                    if (p.scoreInfo) console.log(`      평점: ${p.scoreInfo}`);
                });

                return products;
            }

            // 다른 경로 탐색
            const pageProps = data.props?.pageProps;
            if (pageProps) {
                console.log(`  pageProps keys: ${Object.keys(pageProps).join(', ')}`);

                // initialState 확인
                if (pageProps.initialState) {
                    const state = pageProps.initialState;
                    console.log(`  initialState keys: ${Object.keys(state).join(', ')}`);

                    // products 탐색
                    for (const [key, val] of Object.entries(state)) {
                        if (val && typeof val === 'object' && val.products) {
                            console.log(`  ✅ state.${key}.products 발견! (${val.products.length}개)`);
                            val.products.slice(0, 3).forEach((p, i) => {
                                console.log(`    [${i + 1}] ${JSON.stringify(p).substring(0, 100)}`);
                            });
                        }
                    }
                }
            }

        } catch (e) {
            console.log(`  ⚠️ JSON 파싱 실패: ${e.message}`);
        }
    } else {
        console.log('  ❌ __NEXT_DATA__ 없음');

        // 직접 HTML에서 상품 정보 추출 시도
        const titleMatch = res.body.match(/class="[^"]*product[^"]*title[^"]*"[^>]*>([^<]+)</gi);
        if (titleMatch) {
            console.log(`  HTML에서 상품 타이틀 ${titleMatch.length}개 발견`);
        }
    }

    // HTML 저장 (디버깅용)
    fs.writeFileSync('naver-shopping-result.html', res.body, 'utf8');
    console.log('  📁 HTML 저장: naver-shopping-result.html');

    return [];
}

function deepFind(obj, targetKey, depth = 0) {
    if (depth > 15 || !obj || typeof obj !== 'object') return null;

    if (Array.isArray(obj[targetKey]) && obj[targetKey].length > 0) {
        return obj[targetKey];
    }

    for (const val of Object.values(obj)) {
        const found = deepFind(val, targetKey, depth + 1);
        if (found) return found;
    }

    return null;
}

// ── 네이버 쇼핑 개별 상품 API (카탈로그 번호 기반) ──
async function testNaverCatalogAPI(catalogId) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 네이버 쇼핑 카탈로그 API: ${catalogId}`);
    console.log('═'.repeat(60));

    // 네이버 쇼핑 내부 API (비공식)
    const apiUrl = `https://search.shopping.naver.com/api/search/all?query=${catalogId}&sort=rel&pagingIndex=1&pagingSize=5`;

    const res = await httpGet(apiUrl, {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://search.shopping.naver.com/',
    });

    console.log(`  Status: ${res.status}, Body: ${(res.body.length / 1024).toFixed(0)}KB`);

    try {
        const json = JSON.parse(res.body);
        console.log(`  ✅ JSON 응답!`);
        console.log(`  Top keys: ${Object.keys(json).join(', ')}`);

        // 상품 목록 찾기
        const products = deepFind(json, 'products') || deepFind(json, 'items') || [];
        if (products.length > 0) {
            console.log(`  📦 상품 ${products.length}개!`);
            products.slice(0, 3).forEach((p, i) => {
                console.log(`  [${i + 1}] ${p.productTitle || p.title || p.name || '?'}`);
                console.log(`      가격: ${p.price || p.lowPrice || '?'}`);
                console.log(`      쇼핑몰: ${p.mallName || '?'}`);
                console.log(`      이미지: ${(p.imageUrl || '?').substring(0, 70)}`);
            });
        } else {
            // 다른 구조 탐색
            const shoppingResult = json.shoppingResult;
            if (shoppingResult) {
                console.log(`  shoppingResult keys: ${Object.keys(shoppingResult).join(', ')}`);
                const prods = shoppingResult.products || [];
                console.log(`  products: ${prods.length}개`);
                prods.slice(0, 3).forEach((p, i) => {
                    console.log(`  [${i + 1}] ${p.productTitle || p.title || '?'} / ${p.price || '?'}원 / ${p.mallName || '?'}`);
                    console.log(`      img: ${(p.imageUrl || '?').substring(0, 70)}`);
                });
            }
        }

        // 결과 저장
        fs.writeFileSync('naver-api-result.json', JSON.stringify(json, null, 2), 'utf8');
        console.log('  📁 저장: naver-api-result.json');

        return json;
    } catch (e) {
        console.log(`  ❌ JSON 아님: ${res.body.substring(0, 200)}`);
        return null;
    }
}

async function main() {
    console.log('🔬 네이버 쇼핑 API 기반 우회 테스트');
    console.log(`  시간: ${new Date().toLocaleString('ko-KR')}`);

    // 1. 네이버 쇼핑 내부 API로 직접 검색
    await testNaverCatalogAPI('블루투스 이어폰');

    // 2. 네이버 쇼핑 웹 검색
    await searchNaverShopping('블루투스 이어폰 쿠팡');

    console.log('\n✅ 완료');
}

main().catch(err => {
    console.error('🔥:', err);
    process.exit(1);
});
