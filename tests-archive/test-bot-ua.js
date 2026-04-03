/**
 * 🔬 결과를 JSON 파일로 저장하는 간결한 테스트
 */
const https = require('https');
const fs = require('fs');

function fetch(url, ua) {
    return new Promise((resolve) => {
        https.get(url, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html',
                'Accept-Encoding': 'identity',
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const ogTitle = body.match(/property="og:title"[^>]+content="([^"]+)"/)?.[1] ||
                    body.match(/content="([^"]+)"[^>]+property="og:title"/)?.[1] || null;
                const ogImage = body.match(/property="og:image"[^>]+content="([^"]+)"/)?.[1] ||
                    body.match(/content="([^"]+)"[^>]+property="og:image"/)?.[1] || null;
                const ogDesc = body.match(/property="og:description"[^>]+content="([^"]+)"/)?.[1] ||
                    body.match(/content="([^"]+)"[^>]+property="og:description"/)?.[1] || null;
                const hasAD = body.includes('Access Denied');
                resolve({
                    status: res.statusCode,
                    size: body.length,
                    accessDenied: hasAD,
                    ogTitle,
                    ogImage: ogImage ? ogImage.substring(0, 80) : null,
                    ogDesc: ogDesc ? ogDesc.substring(0, 80) : null,
                    ok: !!(ogTitle && !hasAD),
                });
            });
        }).on('error', (err) => {
            resolve({ error: err.message, ok: false });
        });
    });
}

async function main() {
    const results = {};
    const coupangUrl = 'https://www.coupang.com/vp/products/8178498750';
    const gmarketUrl = 'https://item.gmarket.co.kr/Item?goodscode=3972981340';
    const st11Url = 'https://www.11st.co.kr/products/6836498473';

    // 소셜 봇 UA 테스트 (쿠팡)
    const bots = {
        'Kakaotalk': 'Mozilla/5.0 (compatible; Kakao/1.0; +https://devtalk.kakao.com)',
        'Facebook': 'facebookexternalhit/1.1',
        'Twitter': 'Twitterbot/1.0',
        'Telegram': 'TelegramBot (like TwitterBot)',
        'Slack': 'Slackbot-LinkExpanding 1.0',
        'Naver_Yeti': 'Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)',
        'Googlebot': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    };

    results.coupang_bots = {};
    for (const [name, ua] of Object.entries(bots)) {
        results.coupang_bots[name] = await fetch(coupangUrl, ua);
    }

    // G마켓/11번가 봇 UA (Facebook)
    results.gmarket_facebook = await fetch(gmarketUrl, bots.Facebook);
    results.gmarket_googlebot = await fetch(gmarketUrl, bots.Googlebot);
    results.st11_facebook = await fetch(st11Url, bots.Facebook);
    results.st11_googlebot = await fetch(st11Url, bots.Googlebot);

    // 결과 저장
    fs.writeFileSync('crawl-results.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('DONE: crawl-results.json');
}

main();
