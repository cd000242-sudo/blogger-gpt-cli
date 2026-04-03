/**
 * 쿠팡 상품 페이지 크롤러 (Playwright)
 * - 상품명, 가격, 설명, 스펙 수집
 * - 상품 이미지 전체 수집 (10개+)
 * - 블로그 글 생성용 데이터 구조화
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const TARGET_URL = 'https://link.coupang.com/a/d3lVwh';

async function crawlCoupangProduct(url) {
  console.log('🚀 쿠팡 상품 크롤러 시작...');
  console.log(`📦 대상 URL: ${url}`);

  const browser = await chromium.launch({
    headless: false, // 브라우저 창 띄움
    args: [
      '--disable-blink-features=AutomationControlled',
      '--lang=ko-KR',
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ko-KR',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    }
  });

  const page = await context.newPage();

  try {
    // 1️⃣ 페이지 로드
    console.log('\n📄 페이지 로딩 중...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // 2️⃣ 스크롤하여 지연 로딩 이미지 활성화
    console.log('📜 스크롤하여 이미지 로딩...');
    await autoScroll(page);
    await page.waitForTimeout(2000);

    console.log('Final URL:', page.url());
    await page.screenshot({ path: path.join(__dirname, 'coupang-debug.png'), fullPage: true });

    // 3️⃣ 상품 정보 수집
    console.log('\n📋 상품 정보 수집 중...');
    const productInfo = await page.evaluate(() => {
      // 상품명
      const titleEl = document.querySelector('.prod-buy-header__title, h1.title, h2.prod-buy-header__title');
      const title = titleEl ? titleEl.innerText.trim() : '';

      // 가격
      const priceEl = document.querySelector('.total-price strong, .prod-sale-price .total-price strong');
      const price = priceEl ? priceEl.innerText.trim() : '';

      // 원래 가격 (할인 전)
      const origPriceEl = document.querySelector('.origin-price, .prod-origin-price');
      const originalPrice = origPriceEl ? origPriceEl.innerText.trim() : '';

      // 할인율
      const discountEl = document.querySelector('.discount-rate, .prod-discount-rate');
      const discount = discountEl ? discountEl.innerText.trim() : '';

      // 평점
      const ratingEl = document.querySelector('.rating-star-num, .prod-rating__count');
      const ratingCountEl = document.querySelector('.rating-total-count, .prod-review__count');
      const rating = ratingEl ? ratingEl.getAttribute('style')?.match(/width:\s*([\d.]+)%/)?.[1] : '';
      const ratingCount = ratingCountEl ? ratingCountEl.innerText.trim() : '';

      // 배송 정보
      const deliveryEl = document.querySelector('.prod-shipping-fee-message, .delivery-info');
      const delivery = deliveryEl ? deliveryEl.innerText.trim() : '';

      // 상품 설명 (간략)
      const descEls = document.querySelectorAll('.prod-description, .prod-attr-item');
      const description = Array.from(descEls).map(el => el.innerText.trim()).filter(Boolean).join('\n');

      // 상품 속성/스펙
      const specRows = document.querySelectorAll('.prod-attr-item, .prod-buy-header__attribute');
      const specs = Array.from(specRows).map(row => row.innerText.trim()).filter(Boolean);

      return {
        title,
        price,
        originalPrice,
        discount,
        rating: rating ? `${(parseFloat(rating) / 20).toFixed(1)}점` : '',
        ratingCount,
        delivery,
        description,
        specs,
        url: window.location.href
      };
    });

    console.log('✅ 상품 정보 수집 완료:');
    console.log(`   📦 상품명: ${productInfo.title}`);
    console.log(`   💰 가격: ${productInfo.price}`);
    console.log(`   ⭐ 평점: ${productInfo.rating} (${productInfo.ratingCount})`);
    console.log(`   🚚 배송: ${productInfo.delivery}`);

    // 4️⃣ 상품 이미지 수집
    console.log('\n🖼️ 상품 이미지 수집 중...');
    const images = await page.evaluate(() => {
      const imageSet = new Set();

      // 메인 상품 이미지 (썸네일 리스트)
      document.querySelectorAll('.prod-image__item img, .prod-image__detail img, .vendor-item__pic img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy');
        if (src && !src.includes('data:image') && !src.includes('blank')) {
          // 고해상도 URL로 변환
          const hiRes = src.replace(/\/thumbnails\/[^/]+\//, '/').replace(/_[0-9]+x[0-9]+/, '');
          imageSet.add(hiRes);
        }
      });

      // 상품 상세 이미지 (본문 이미지)
      document.querySelectorAll('.product-detail-content-inside img, #productDetail img, .detail-item img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') || img.getAttribute('data-img-src');
        if (src && !src.includes('data:image') && !src.includes('blank') && !src.includes('icon') && !src.includes('logo')) {
          imageSet.add(src);
        }
      });

      // 추가: og:image
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        imageSet.add(ogImage.content);
      }

      return Array.from(imageSet);
    });

    console.log(`✅ 이미지 ${images.length}개 수집 완료:`);
    images.forEach((url, i) => {
      console.log(`   [${i + 1}] ${url.substring(0, 100)}...`);
    });

    // 5️⃣ 이미지 다운로드
    const outputDir = path.join(__dirname, 'coupang-images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`\n💾 이미지 다운로드 중... (${outputDir})`);
    const downloadedImages = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const imgUrl = images[i];
        const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
        const filename = `product_${i + 1}${ext}`;
        const filepath = path.join(outputDir, filename);

        await downloadImage(imgUrl, filepath);
        downloadedImages.push(filepath);
        console.log(`   ✅ [${i + 1}/${images.length}] ${filename} 다운로드 완료`);
      } catch (err) {
        console.log(`   ❌ [${i + 1}/${images.length}] 다운로드 실패: ${err.message}`);
      }
    }

    // 6️⃣ 결과 저장
    const result = {
      ...productInfo,
      images,
      downloadedImages,
      crawledAt: new Date().toISOString()
    };

    const resultPath = path.join(__dirname, 'coupang-product-data.json');
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n📄 상품 데이터 저장: ${resultPath}`);

    // 7️⃣ 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('🎉 쿠팡 상품 크롤링 완료!');
    console.log('='.repeat(60));
    console.log(`📦 상품명: ${productInfo.title}`);
    console.log(`💰 가격: ${productInfo.price}`);
    console.log(`🖼️ 이미지: ${images.length}개 수집, ${downloadedImages.length}개 다운로드`);
    console.log(`📁 이미지 폴더: ${outputDir}`);
    console.log(`📄 데이터 파일: ${resultPath}`);
    console.log('='.repeat(60));

    return result;

  } catch (error) {
    console.error('❌ 크롤링 오류:', error.message);
    // 에러 시 스크린샷 저장
    try {
      await page.screenshot({ path: path.join(__dirname, 'coupang-error.png'), fullPage: true });
      console.log('📸 에러 스크린샷 저장됨: coupang-error.png');
    } catch (e) {}
    throw error;
  } finally {
    await browser.close();
    console.log('\n🔒 브라우저 종료');
  }
}

// 자동 스크롤 (지연 로딩 이미지 활성화)
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          // 다시 맨 위로
          window.scrollTo(0, 0);
          resolve();
        }
      }, 300);
    });
  });
}

// 이미지 다운로드
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const request = protocol.get(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.coupang.com/'
      }
    }, (response) => {
      // 리다이렉트 처리
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(10000, () => { request.destroy(); reject(new Error('Timeout')); });
  });
}

// 실행
crawlCoupangProduct(TARGET_URL).catch(err => {
  console.error('💥 치명적 오류:', err.message);
  process.exit(1);
});
