/**
 * 🔬 쿠팡 우회 접근법 테스트
 * 
 * 접근법 1: 네이버 쇼핑 검색 API로 상품 정보 가져오기
 * 접근법 2: 쿠팡 공유(share) URL 또는 모바일 API
 * 접근법 3: 쿠팡 OpenAPI (Partners)
 * 접근법 4: 쿠팡 OG 크롤러 (카카오톡/SNS 공유 시 사용되는 봇 허용)
 */

const https = require('https');

// ──────────── 접근법 1: 네이버 쇼핑 검색 ────────────
// 네이버 검색 API는 공식적 접근 가능 (OG 태그 제공)
async function testNaverShoppingSearch(keyword) {
    console.log('\n' + '═'.repeat(60));
    console.log('🔍 [접근법 1] 네이버 쇼핑 검색');
    console.log('═'.repeat(60));
    console.log(`   키워드: ${keyword}`);

    // 네이버 쇼핑 모바일 웹 (검색 결과)
    const url = `https://msearch.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&cat_id=&frm=NVSHATC`;

    return new Promise((resolve) => {
        const opts = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'ko-KR,ko;q=0.9',
                'Accept-Encoding': 'identity',
            }
        };

        https.get(url, opts, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`   Status: ${res.statusCode}`);
                console.log(`   HTML: ${(body.length / 1024).toFixed(0)}KB`);

                // JSON 데이터 탐색 (네이버 쇼핑은 SSR 또는 초기 JSON 포함)
                const jsonMatch = body.match(/__NEXT_DATA__[^>]*>({.*?})<\/script/s);
                if (jsonMatch) {
                    try {
                        const data = JSON.parse(jsonMatch[1]);
                        console.log(`   ✅ __NEXT_DATA__ 발견!`);
                        // 상품 목록 찾기
                        const products = findProducts(data);
                        if (products.length > 0) {
                            console.log(`   📦 상품 ${products.length}개 발견:`);
                            products.slice(0, 3).forEach((p, i) => {
                                console.log(`      ${i + 1}. ${p.title || p.name || '?'}`);
                                console.log(`         가격: ${p.price || p.lowPrice || '?'}`);
                                console.log(`         이미지: ${(p.imageUrl || p.image || '?').substring(0, 60)}`);
                            });
                        }
                    } catch (e) {
                        console.log(`   ⚠️ JSON 파싱 실패: ${e.message}`);
                    }
                }

                // OG 태그 확인
                const ogTitle = body.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ||
                    body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/)?.[1];
                if (ogTitle) console.log(`   OG Title: ${ogTitle}`);

                resolve(body.length > 1000);
            });
        }).on('error', (err) => {
            console.log(`   ❌ 에러: ${err.message}`);
            resolve(false);
        });
    });
}

function findProducts(obj, depth = 0) {
    if (depth > 10) return [];
    if (!obj || typeof obj !== 'object') return [];

    // products, items, list 키 탐색
    for (const key of ['products', 'items', 'productList', 'searchResult']) {
        if (Array.isArray(obj[key]) && obj[key].length > 0) {
            return obj[key];
        }
    }

    for (const val of Object.values(obj)) {
        const found = findProducts(val, depth + 1);
        if (found.length > 0) return found;
    }

    return [];
}

// ──────────── 접근법 2: 쿠팡 OG 봇 흉내 ────────────
// 소셜 미디어 공유 시 쿠팡은 OG 메타데이터를 제공해야 하므로
// 카카오톡, 페이스북, 트위터 봇 UA를 사용
async function testCoupangWithSocialBotUA(url) {
    console.log('\n' + '═'.repeat(60));
    console.log('🤖 [접근법 2] 소셜 미디어 봇 UA로 쿠팡 접근');
    console.log('═'.repeat(60));

    const botUAs = [
        { name: 'Kakaotalk', ua: 'Mozilla/5.0 (compatible; Kakao/1.0; +https://devtalk.kakao.com)' },
        { name: 'Facebook', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
        { name: 'Twitter', ua: 'Twitterbot/1.0' },
        { name: 'Telegram', ua: 'TelegramBot (like TwitterBot)' },
        { name: 'Slack', ua: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' },
        { name: 'LinkedIn', ua: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)' },
        { name: 'Naver', ua: 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)' },
        { name: 'Google', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    ];

    for (const bot of botUAs) {
        await new Promise(resolve => {
            const opts = {
                headers: {
                    'User-Agent': bot.ua,
                    'Accept': 'text/html',
                    'Accept-Encoding': 'identity',
                }
            };

            https.get(url, opts, (res) => {
                // 리다이렉트 추적
                if ([301, 302, 303].includes(res.statusCode)) {
                    console.log(`   ${bot.name}: ${res.statusCode} → ${(res.headers.location || '?').substring(0, 60)}`);
                    res.resume();
                    resolve();
                    return;
                }

                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const hasAccessDenied = body.includes('Access Denied');
                    const ogTitle = body.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ||
                        body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/)?.[1];
                    const ogImage = body.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ||
                        body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)?.[1];

                    const status = hasAccessDenied ? '❌ Access Denied' :
                        ogTitle ? `✅ OG Title: ${ogTitle.substring(0, 50)}` :
                            `⚠️ ${res.statusCode} / ${(body.length / 1024).toFixed(0)}KB`;

                    console.log(`   ${bot.name}: ${status}`);
                    if (ogImage) console.log(`       🖼 Image: ${ogImage.substring(0, 60)}`);
                    resolve();
                });
            }).on('error', () => {
                console.log(`   ${bot.name}: ❌ 연결 실패`);
                resolve();
            });
        });
    }
}

// ──────────── 접근법 3: 쿠팡 모바일 앱 API ────────────
async function testCoupangMobileAPI(productId) {
    console.log('\n' + '═'.repeat(60));
    console.log('📱 [접근법 3] 쿠팡 내부 API 엔드포인트');
    console.log('═'.repeat(60));

    const apiUrls = [
        `https://www.coupang.com/vp/products/${productId}`,
        `https://m.coupang.com/vm/products/${productId}`,
        // 카탈로그 API (알려진 엔드포인트들)
        `https://www.coupang.com/vp/goldbox/deals?component=`,
    ];

    for (const url of apiUrls) {
        await new Promise(resolve => {
            const opts = {
                headers: {
                    'User-Agent': 'CoupangMobileApp/6.0.0 (iPhone; iOS 17.0; Scale/3.00)',
                    'Accept': 'application/json, text/html',
                    'Accept-Language': 'ko-KR',
                    'Accept-Encoding': 'identity',
                    'X-Coupang-App-Version': '6.0.0',
                    'X-Coupang-App-OS': 'iPhone',
                }
            };

            https.get(url, opts, (res) => {
                if ([301, 302, 303].includes(res.statusCode)) {
                    console.log(`   ${url.substring(0, 50)}: ${res.statusCode} → ${(res.headers.location || '').substring(0, 50)}`);
                    res.resume();
                    resolve();
                    return;
                }

                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const hasAccessDenied = body.includes('Access Denied');
                    console.log(`   ${url.substring(0, 50)}: ${res.statusCode}, ${(body.length / 1024).toFixed(0)}KB${hasAccessDenied ? ' ❌ AD' : ''}`);

                    // JSON인지 확인
                    try {
                        const json = JSON.parse(body);
                        console.log(`      ✅ JSON 응답! Keys: ${Object.keys(json).join(', ')}`);
                    } catch {
                        // HTML이면 OG 태그 확인
                        const ogTitle = body.match(/og:title[^>]+content="([^"]+)"/)?.[1];
                        if (ogTitle) console.log(`      OG Title: ${ogTitle}`);
                    }
                    resolve();
                });
            }).on('error', () => {
                console.log(`   ${url.substring(0, 50)}: ❌ 연결 실패`);
                resolve();
            });
        });
    }
}

// ──────────── 접근법 4: G마켓/11번가 OG 봇 ────────────
async function testKoreanSitesWithBotUA() {
    console.log('\n' + '═'.repeat(60));
    console.log('🤖 [접근법 4] G마켓/11번가도 봇 UA 테스트');
    console.log('═'.repeat(60));

    const sites = [
        { name: 'G마켓', url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340' },
        { name: '11번가', url: 'https://www.11st.co.kr/products/6836498473' },
    ];

    const botUA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

    for (const site of sites) {
        await new Promise(resolve => {
            https.get(site.url, {
                headers: { 'User-Agent': botUA, 'Accept': 'text/html', 'Accept-Encoding': 'identity' }
            }, (res) => {
                if ([301, 302, 303].includes(res.statusCode)) {
                    console.log(`   ${site.name}: ${res.statusCode} redirect`);
                    res.resume();
                    resolve();
                    return;
                }
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const ogTitle = body.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] ||
                        body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/)?.[1];
                    const ogImage = body.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)?.[1] ||
                        body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)?.[1];
                    const ogDesc = body.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] ||
                        body.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/)?.[1];

                    console.log(`   ${site.name} (${res.statusCode}, ${(body.length / 1024).toFixed(0)}KB):`);
                    console.log(`      Title: ${ogTitle || '없음'}`);
                    console.log(`      Image: ${(ogImage || '없음').substring(0, 60)}`);
                    console.log(`      Desc:  ${(ogDesc || '없음').substring(0, 60)}`);
                    console.log(`      ${ogTitle ? '✅ 성공!' : '❌ 실패'}`);
                    resolve();
                });
            }).on('error', () => {
                console.log(`   ${site.name}: ❌ 에러`);
                resolve();
            });
        });
    }
}

async function main() {
    console.log('🔬 쿠팡 우회 접근법 종합 테스트');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);

    // 접근법 2: 소셜 봇 UA
    await testCoupangWithSocialBotUA('https://www.coupang.com/vp/products/8178498750');

    // 접근법 3: 모바일 API
    await testCoupangMobileAPI('8178498750');

    // 접근법 4: G마켓/11번가 봇 UA
    await testKoreanSitesWithBotUA();

    // 접근법 1: 네이버 쇼핑
    await testNaverShoppingSearch('블루투스 이어폰');

    console.log('\n\n✅ 모든 테스트 완료');
}

main().catch(err => {
    console.error('🔥:', err);
    process.exit(1);
});
