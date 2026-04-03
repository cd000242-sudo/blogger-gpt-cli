/**
 * 쿠팡 상품 이미지 수집 - 메타태그(og:image) 방식
 * 소셜 미디어 크롤러 UA를 사용하여 og:image 수집
 * (카카오톡/페이스북 링크 미리보기와 동일한 원리)
 */
const https = require('https');
const http = require('http');

const TARGET_URL = 'https://www.coupang.com/vp/products/6612769947?itemId=15001842989';

// 여러 소셜 크롤러 UA로 시도
const CRAWLERS = [
  { name: 'KakaoTalk', ua: 'facebookexternalhit/1.1; kakaotalk-scrap' },
  { name: 'Facebook', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
  { name: 'Twitter', ua: 'Twitterbot/1.0' },
  { name: 'Telegram', ua: 'TelegramBot (like TwitterBot)' },
  { name: 'Googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'Slack', ua: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' },
  { name: 'Line', ua: 'Line/2.0' },
  { name: 'Curl', ua: 'curl/7.88.1' },
];

function fetchWithUA(url, userAgent) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    };

    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.request(options, (res) => {
      // 리다이렉트 처리
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http') 
          ? res.headers.location 
          : `https://${urlObj.hostname}${res.headers.location}`;
        fetchWithUA(redirectUrl, userAgent).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, html: data }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function extractMetaTags(html) {
  const result = {
    title: '',
    description: '',
    image: '',
    images: [],
    price: '',
    brand: '',
  };

  // og:title
  const titleMatch = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]*?)"/i) 
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="og:title"/i);
  if (titleMatch) result.title = titleMatch[1];

  // og:description
  const descMatch = html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="og:description"/i);
  if (descMatch) result.description = descMatch[1];

  // og:image (모든 인스턴스)
  const imageRegex = /<meta\s+(?:property|name)="og:image(?::url)?"\s+content="([^"]*?)"/gi;
  const imageRegex2 = /<meta\s+content="([^"]*?)"\s+(?:property|name)="og:image(?::url)?"/gi;
  let match;
  while ((match = imageRegex.exec(html)) !== null) {
    result.images.push(match[1]);
  }
  while ((match = imageRegex2.exec(html)) !== null) {
    if (!result.images.includes(match[1])) {
      result.images.push(match[1]);
    }
  }
  if (result.images.length > 0) result.image = result.images[0];

  // product:price
  const priceMatch = html.match(/<meta\s+(?:property|name)="product:price:amount"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="product:price:amount"/i);
  if (priceMatch) result.price = priceMatch[1];

  // product:brand
  const brandMatch = html.match(/<meta\s+(?:property|name)="product:brand"\s+content="([^"]*?)"/i)
    || html.match(/<meta\s+content="([^"]*?)"\s+(?:property|name)="product:brand"/i);
  if (brandMatch) result.brand = brandMatch[1];

  // <title> 태그 폴백
  if (!result.title) {
    const titleTagMatch = html.match(/<title>([^<]*?)<\/title>/i);
    if (titleTagMatch) result.title = titleTagMatch[1];
  }

  // HTML 내 이미지 태그에서 추가 수집
  const imgRegex = /<img[^>]+src="(https?:\/\/[^"]*(?:thumbnail|product|goods|item)[^"]*?)"/gi;
  while ((match = imgRegex.exec(html)) !== null) {
    if (!result.images.includes(match[1]) && !match[1].includes('icon') && !match[1].includes('logo')) {
      result.images.push(match[1]);
    }
  }

  return result;
}

async function main() {
  console.log('🔍 쿠팡 상품 메타태그 수집 테스트');
  console.log(`📦 URL: ${TARGET_URL}`);
  console.log('='.repeat(60));

  for (const crawler of CRAWLERS) {
    console.log(`\n🤖 [${crawler.name}] 시도 중...`);
    try {
      const { status, html } = await fetchWithUA(TARGET_URL, crawler.ua);
      console.log(`   HTTP ${status} | HTML 크기: ${html.length}자`);

      if (status === 200 && html.length > 500) {
        const meta = extractMetaTags(html);
        
        if (meta.title || meta.image) {
          console.log(`   ✅ 성공!`);
          console.log(`   📦 상품명: ${meta.title}`);
          console.log(`   💰 가격: ${meta.price}`);
          console.log(`   🏷️ 브랜드: ${meta.brand}`);
          console.log(`   📝 설명: ${meta.description?.substring(0, 80)}...`);
          console.log(`   🖼️ 이미지 ${meta.images.length}개:`);
          meta.images.forEach((img, i) => {
            console.log(`      [${i + 1}] ${img}`);
          });
        } else {
          console.log(`   ⚠️ 메타태그 없음 (봇 차단 또는 빈 페이지)`);
          // HTML 일부 출력 (디버깅)
          console.log(`   📄 HTML 미리보기: ${html.substring(0, 200).replace(/\n/g, ' ')}...`);
        }
      } else {
        console.log(`   ❌ 응답 실패 (status: ${status}, size: ${html.length})`);
        if (html.length < 500) {
          console.log(`   📄 응답 내용: ${html.substring(0, 300)}`);
        }
      }
    } catch (err) {
      console.log(`   ❌ 오류: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('테스트 완료!');
}

main().catch(console.error);
