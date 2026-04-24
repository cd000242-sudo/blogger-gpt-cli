/**
 * 쿠팡 상품 URL 크롤러 검증
 *
 * 실행:
 *   npx tsx scripts/verify-coupang-crawler.ts [url]
 *
 * 인수 없으면 기본 샘플 URL 사용 (쿠팡이 URL 구조를 자주 바꾸므로 실패할 수도 있음 — 그건 크롤러 정확도 이슈)
 */

import { crawlCoupangProductFromUrl, crawlCoupangProductsFromUrls } from '../src/core/coupang-partners';

const SAMPLE_URLS = [
  // 공개된 쿠팡 상품 URL (데모용 — 실제 상품은 변경될 수 있음)
  'https://www.coupang.com/vp/products/7695099324?itemId=20440637841&vendorItemId=87529636175',
];

async function main() {
  const userUrl = process.argv[2];
  const urls = userUrl ? [userUrl] : SAMPLE_URLS;

  console.log(`\n🧪 쿠팡 URL 크롤러 테스트\n`);
  console.log(`📋 대상 URL (${urls.length}개):`);
  urls.forEach((u, i) => console.log(`   ${i + 1}. ${u}`));

  // 단일 URL 테스트
  console.log('\n[1] 단일 URL 크롤링 (crawlCoupangProductFromUrl)');
  try {
    const product = await crawlCoupangProductFromUrl(urls[0]!);
    console.log(`   ✅ 성공`);
    console.log(`      productId: ${product.productId || '(없음)'}`);
    console.log(`      productName: ${product.productName}`);
    console.log(`      productPrice: ${product.productPrice.toLocaleString()}원 ${product.isPriceKnown ? '✓' : '(미확인)'}`);
    console.log(`      productImage: ${product.productImage.slice(0, 70)}...`);
    console.log(`      productUrl: ${product.productUrl.slice(0, 70)}...`);
    console.log(`      isRocket: ${product.isRocket}`);
    console.log(`      isFreeShipping: ${product.isFreeShipping}`);

    // 검증 체크
    const checks = [
      { label: 'productName 존재', pass: product.productName.length > 0 },
      { label: 'productImage URL 존재', pass: /^https?:\/\//i.test(product.productImage) },
      { label: 'productUrl = 입력 URL 유지 (제휴 수익 귀속)', pass: product.productUrl === urls[0] },
    ];
    console.log();
    checks.forEach(c => console.log(`   ${c.pass ? '✅' : '❌'} ${c.label}`));
    const allPass = checks.every(c => c.pass);
    if (!allPass) {
      console.log('\n❌ 필수 검증 실패');
      process.exit(1);
    }
  } catch (err: any) {
    console.log(`   ❌ 실패: ${err.message}`);
    console.log(`   💡 쿠팡은 봇 감지가 엄격하므로 차단됐을 가능성. Playwright 폴백도 실패한 경우 쿠팡이 캡차 띄웠을 수 있음.`);
    process.exit(1);
  }

  // 병렬 배치 테스트 (1개만 넘겼더라도 flow 확인)
  console.log('\n[2] 배치 크롤링 (crawlCoupangProductsFromUrls)');
  const batchResults = await crawlCoupangProductsFromUrls(urls, (msg) => console.log(`   ${msg}`));
  console.log(`\n   결과: ${batchResults.length}/${urls.length} 성공`);

  // 비-쿠팡 URL 거부 확인
  console.log('\n[3] 비-쿠팡 URL 거부');
  try {
    await crawlCoupangProductFromUrl('https://www.example.com/product/123');
    console.log('   ❌ 비-쿠팡 URL 을 거부하지 않음!');
    process.exit(1);
  } catch (err: any) {
    if (err.message.includes('쿠팡 URL 형식이 아닙니다')) {
      console.log(`   ✅ 정상 거부: ${err.message}`);
    } else {
      console.log(`   ⚠️ 거부되긴 했으나 다른 이유: ${err.message}`);
    }
  }

  console.log('\n🎉 크롤러 기본 동작 확인 완료');
}

main().catch(err => {
  console.error('❌ 테스트 실행 중 예외:', err);
  process.exit(1);
});
