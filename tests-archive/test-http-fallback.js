/**
 * 🔬 HTTP 전용 크롤링 테스트 — 브라우저 없이 OG/JSON-LD 추출
 * 
 * Playwright 없이 순수 HTTP 요청으로 쇼핑몰 상품 정보 추출
 * 모바일 UA로 시도 (모바일 페이지는 SSR인 경우 많음)
 */
const https = require('https');
const http = require('http');

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function fetchUrl(url, ua, followRedirects = 5) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const opts = {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                'Accept-Encoding': 'identity', // no compression for simplicity
                'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131"',
                'Sec-Ch-Ua-Mobile': ua.includes('Mobile') ? '?1' : '?0',
                'Sec-Ch-Ua-Platform': ua.includes('Android') ? '"Android"' : '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache',
            }
        };

        proto.get(url, opts, (res) => {
            // 리다이렉트 처리
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && followRedirects > 0) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    const u = new URL(url);
                    redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
                }
                console.log(`   ↩️ Redirect [${res.statusCode}] → ${redirectUrl.substring(0, 80)}`);
                resolve(fetchUrl(redirectUrl, ua, followRedirects - 1));
                return;
            }

            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: body,
                    url: url,
                });
            });
        }).on('error', reject);
    });
}

function extractMeta(html) {
    const result = { og: {}, meta: {}, jsonLd: [], title: '' };

    // <title>
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();

    // OG 태그
    const ogRegex = /<meta\s+(?:[^>]*?)property=["']og:(\w+)["']\s+content=["']([^"']*)["'][^>]*>/gi;
    let m;
    while ((m = ogRegex.exec(html)) !== null) result.og[m[1]] = m[2];

    // 반대 순서도 시도 (content가 먼저)
    const ogRegex2 = /<meta\s+content=["']([^"']*)["']\s+(?:[^>]*?)property=["']og:(\w+)["'][^>]*>/gi;
    while ((m = ogRegex2.exec(html)) !== null) result.og[m[2]] = m[1];

    // 일반 meta 태그 (name=description, keywords 등)
    const metaRegex = /<meta\s+(?:[^>]*?)name=["'](\w+)["']\s+content=["']([^"']*)["'][^>]*>/gi;
    while ((m = metaRegex.exec(html)) !== null) result.meta[m[1]] = m[2];

    // JSON-LD
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    while ((m = jsonLdRegex.exec(html)) !== null) {
        try { result.jsonLd.push(JSON.parse(m[1])); } catch { }
    }

    // 이미지 수집 (메타 태그 내 이미지)
    result.images = [];
    const imgMetaRegex = /<meta\s+(?:[^>]*?)(?:property|name)=["'][^"']*image[^"']*["']\s+content=["']([^"']*)["'][^>]*>/gi;
    while ((m = imgMetaRegex.exec(html)) !== null) result.images.push(m[1]);
    const imgMetaRegex2 = /<meta\s+content=["']([^"']*)["']\s+(?:[^>]*?)(?:property|name)=["'][^"']*image[^"']*["'][^>]*>/gi;
    while ((m = imgMetaRegex2.exec(html)) !== null) result.images.push(m[1]);

    return result;
}

async function testSite(name, desktopUrl, mobileUrl) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🔬 [${name}] HTTP 전용 크롤링 테스트`);
    console.log('═'.repeat(60));

    for (const [label, url, ua] of [
        ['📱 모바일', mobileUrl || desktopUrl, MOBILE_UA],
        ['🖥 데스크탑', desktopUrl, DESKTOP_UA],
    ]) {
        console.log(`\n── ${label} ──`);
        console.log(`   URL: ${url.substring(0, 80)}`);

        try {
            const t0 = Date.now();
            const res = await fetchUrl(url, ua);
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

            console.log(`   STATUS: ${res.status}`);
            console.log(`   HTML: ${(res.body.length / 1024).toFixed(0)}KB (${res.body.length}바이트)`);
            console.log(`   소요: ${elapsed}초`);

            if (res.body.length < 100) {
                console.log(`   ❌ 빈 페이지`);
                continue;
            }

            if (res.body.includes('Access Denied') || res.body.includes('access denied')) {
                console.log(`   ❌ Access Denied`);
                continue;
            }

            const meta = extractMeta(res.body);

            console.log(`\n   📰 Title: ${meta.title || '없음'}`);
            console.log(`   🏷 OG tags:`);
            Object.entries(meta.og).forEach(([k, v]) => {
                console.log(`      og:${k}: ${String(v).substring(0, 80)}`);
            });

            if (meta.jsonLd.length > 0) {
                console.log(`\n   📋 JSON-LD (${meta.jsonLd.length}개):`);
                meta.jsonLd.forEach((ld, i) => {
                    console.log(`      ${i + 1}. @type: ${ld['@type'] || '?'}`);
                    if (ld.name) console.log(`         name: ${String(ld.name).substring(0, 60)}`);
                    if (ld.offers) {
                        const price = ld.offers.price || ld.offers.lowPrice || ld.offers.highPrice;
                        console.log(`         price: ${price} ${ld.offers.priceCurrency || ''}`);
                    }
                    if (ld.image) {
                        const imgUrl = typeof ld.image === 'string' ? ld.image : (ld.image[0] || ld.image.url || '');
                        console.log(`         image: ${String(imgUrl).substring(0, 80)}`);
                    }
                });
            }

            if (meta.images.length > 0) {
                console.log(`\n   🖼 메타 이미지 (${meta.images.length}개):`);
                meta.images.forEach((img, i) => console.log(`      ${i + 1}. ${img.substring(0, 100)}`));
            }

            // 성공 판정
            const hasTitle = meta.og.title || meta.title;
            const hasImage = meta.og.image || meta.images.length > 0;
            const hasJsonLd = meta.jsonLd.length > 0;

            console.log(`\n   ── 판정 ──`);
            console.log(`   제목: ${hasTitle ? '✅' : '❌'} ${(meta.og.title || meta.title || '없음').substring(0, 50)}`);
            console.log(`   이미지: ${hasImage ? '✅' : '❌'}`);
            console.log(`   JSON-LD: ${hasJsonLd ? '✅' : '❌'}`);
            console.log(`   ${hasTitle && hasImage ? '✅ 성공!' : '❌ 부족'}`);

        } catch (err) {
            console.log(`   ❌ 에러: ${err.message}`);
        }
    }
}

async function main() {
    console.log('🔬 HTTP 전용 쇼핑 크롤러 테스트');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);

    const arg = process.argv[2] || 'all';

    const sites = {
        coupang: {
            name: '쿠팡',
            desktop: 'https://www.coupang.com/vp/products/8178498750',
            mobile: 'https://m.coupang.com/vm/products/8178498750',
        },
        gmarket: {
            name: 'G마켓',
            desktop: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
            mobile: 'https://mitem.gmarket.co.kr/Item?goodscode=3972981340',
        },
        '11st': {
            name: '11번가',
            desktop: 'https://www.11st.co.kr/products/6836498473',
            mobile: 'https://m.11st.co.kr/products/6836498473',
        },
        temu: {
            name: 'Temu',
            desktop: 'https://www.temu.com/kr/bluetooth-earphones.html',
            mobile: null,
        },
    };

    if (arg === 'all') {
        for (const [key, s] of Object.entries(sites)) {
            await testSite(s.name, s.desktop, s.mobile);
        }
    } else if (sites[arg]) {
        const s = sites[arg];
        await testSite(s.name, s.desktop, s.mobile);
    } else {
        console.log('사용: node test-http-fallback.js [coupang|gmarket|11st|temu|all]');
    }
}

main().catch(err => {
    console.error('🔥 에러:', err);
    process.exit(1);
});
