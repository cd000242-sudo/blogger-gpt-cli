/**
 * 🧪 쇼핑 크롤러 Playwright 실전 테스트
 * 
 * 각 플랫폼(쿠팡, G마켓, 11번가, Temu)을 순차적으로 테스트
 * - 크롤링 성공 여부
 * - 상품 정보 추출 (제목, 가격, 배송 등)
 * - 이미지 수집 품질 (로고/불필요 이미지 필터링, 리뷰 이미지 포함)
 */

const path = require('path');

// TypeScript 컴파일 없이 직접 실행하기 위해 ts-node 등록
require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: {
        module: 'commonjs',
        esModuleInterop: true
    }
});

const { crawlProductSnapshot } = require('./src/crawlers/parser-registry');

// 테스트할 URL 목록
const TEST_URLS = [
    {
        platform: '쿠팡',
        url: 'https://www.coupang.com/vp/products/8178498750',
        parserId: 'coupang',
    },
    {
        platform: 'G마켓',
        url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
        parserId: 'gmarket-auction',
    },
    {
        platform: '11번가',
        url: 'https://www.11st.co.kr/products/6836498473',
        parserId: '11st',
    },
    {
        platform: 'Temu',
        url: 'https://www.temu.com/kr/bluetooth-earphones.html',
        parserId: 'temu',
    },
];

// ──────── 이미지 URL 품질 분석 ────────

/** 불필요한 이미지인지 판별 */
function isJunkImage(url) {
    const lower = url.toLowerCase();

    const JUNK_PATTERNS = [
        // 로고/아이콘/배너
        'logo', 'icon', 'favicon', 'banner', 'sprite', 'badge',
        // 광고/추적
        'ad_img', 'tracking', 'pixel', 'beacon', 'analytics',
        // UI 요소
        'button', 'arrow', 'close', 'nav_', 'menu', 'tab_',
        'loading', 'spinner', 'placeholder',
        // 작은 이미지 (1x1, spacer 등)
        'spacer', '1x1', 'blank', 'transparent',
        // 쇼핑몰 공통 UI
        'rating_star', 'star_', 'heart_', 'wish',
        'cart_', 'delivery_icon', 'ship_', 'coupon_icon',
        'guarantee', 'certificate', 'trust', 'seal',
        // SNS 아이콘
        'facebook', 'twitter', 'instagram', 'kakao_icon', 'naver_icon',
        'share_', 'sns_',
        // 결제/pg
        'payment', 'pg_', 'card_icon',
    ];

    // 패턴 매칭
    for (const pat of JUNK_PATTERNS) {
        if (lower.includes(pat)) return true;
    }

    // 아주 작은 이미지 (크기가 URL에 인코딩된 경우)
    const sizeMatch = lower.match(/[_x](\d+)[x_](\d+)\./);
    if (sizeMatch) {
        const w = parseInt(sizeMatch[1]), h = parseInt(sizeMatch[2]);
        if (w < 100 || h < 100) return true;
    }

    // data URI는 보통 작은 인라인 이미지
    if (lower.startsWith('data:image') && lower.length < 500) return true;

    // SVG 파일 (보통 아이콘)
    if (lower.endsWith('.svg')) return true;

    // GIF (보통 추적 픽셀이나 로딩 이미지)
    // 단, 리뷰 이미지 GIF는 크기가 클 수 있어 예외
    if (lower.endsWith('.gif') && !lower.includes('review')) return true;

    return false;
}

/** 리뷰 이미지인지 판별 */
function isReviewImage(url) {
    const lower = url.toLowerCase();
    return lower.includes('review') ||
        lower.includes('comment') ||
        lower.includes('user_') ||
        lower.includes('buyreview') ||
        lower.includes('sdp-review');
}

/** 메인 상품 이미지인지 판별 */
function isMainProductImage(url) {
    const lower = url.toLowerCase();
    return lower.includes('product') ||
        lower.includes('goods') ||
        lower.includes('item') ||
        lower.includes('thumbnail') ||
        lower.includes('detail') ||
        /\/pd\/|\/pds\/|\/prd\//i.test(lower);
}

// ──────── 메인 테스트 로직 ────────

async function testSinglePlatform(testCase) {
    const { platform, url, parserId } = testCase;

    console.log('\n' + '═'.repeat(70));
    console.log(`🧪 [${platform}] 크롤링 테스트`);
    console.log(`   URL: ${url}`);
    console.log('═'.repeat(70));

    const startTime = Date.now();

    try {
        const { snapshot, crawlResult } = await crawlProductSnapshot(url, {
            timeoutMs: 30000,
            enableImages: true,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏱️  크롤링 소요시간: ${elapsed}초`);
        console.log(`📄 HTML 크기: ${(crawlResult.html.length / 1024).toFixed(1)}KB`);

        // ── 기본 정보 ──
        console.log('\n📦 기본 정보:');
        console.log(`   제목: ${snapshot.title}`);
        console.log(`   설명: ${(snapshot.description || '없음').substring(0, 100)}`);

        if (snapshot.price) {
            console.log(`   가격: ${snapshot.price.current?.toLocaleString()}${snapshot.price.currency === 'KRW' ? '원' : ' ' + snapshot.price.currency}`);
            if (snapshot.price.original) {
                console.log(`   정가: ${snapshot.price.original?.toLocaleString()}원`);
            }
        } else {
            console.log('   가격: 추출 실패 ⚠️');
        }

        if (snapshot.discount) console.log(`   할인: ${snapshot.discount}`);
        if (snapshot.delivery) console.log(`   배송: ${snapshot.delivery}`);
        if (snapshot.seller) console.log(`   판매자: ${snapshot.seller}`);
        if (snapshot.rating) console.log(`   평점: ${snapshot.rating}`);
        if (snapshot.reviewCount) console.log(`   리뷰: ${snapshot.reviewCount}개`);
        if (snapshot.categories?.length) console.log(`   카테고리: ${snapshot.categories.join(' > ')}`);

        // ── 특징 ──
        console.log(`\n📋 특징 (${snapshot.features.length}개):`);
        snapshot.features.slice(0, 3).forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.heading}: ${f.body.substring(0, 60)}${f.body.length > 60 ? '...' : ''}`);
        });

        // ── 스펙 ──
        const specEntries = Object.entries(snapshot.specs);
        console.log(`\n📐 스펙 (${specEntries.length}개):`);
        specEntries.slice(0, 5).forEach(([k, v]) => {
            console.log(`   ${k}: ${v}`);
        });

        // ── 리뷰 ──
        console.log(`\n💬 리뷰 (${snapshot.reviews.length}개):`);
        snapshot.reviews.slice(0, 2).forEach((r, i) => {
            console.log(`   ${i + 1}. "${r.quote.substring(0, 80)}${r.quote.length > 80 ? '...' : ''}" ${r.rating ? `(★${r.rating})` : ''}`);
        });

        // ── 이미지 분석 (핵심!) ──
        console.log(`\n🖼️  이미지 분석 (원본 ${snapshot.images.length}개):`);

        let productImages = 0, reviewImages = 0, junkImages = 0, otherImages = 0;
        const cleanImages = [];
        const junkList = [];
        const reviewList = [];

        snapshot.images.forEach((img) => {
            if (isJunkImage(img)) {
                junkImages++;
                junkList.push(img);
            } else if (isReviewImage(img)) {
                reviewImages++;
                reviewList.push(img);
                cleanImages.push(img); // 리뷰 이미지는 포함
            } else if (isMainProductImage(img)) {
                productImages++;
                cleanImages.push(img);
            } else {
                otherImages++;
                cleanImages.push(img);
            }
        });

        console.log(`   ✅ 상품 이미지: ${productImages}개`);
        console.log(`   📸 리뷰 이미지: ${reviewImages}개`);
        console.log(`   🗑️  불필요 이미지: ${junkImages}개`);
        console.log(`   ❓ 기타 이미지: ${otherImages}개`);
        console.log(`   📦 최종 유효 이미지: ${cleanImages.length}개`);

        // 유효 이미지 URL 출력
        console.log('\n   📸 유효 이미지 URL:');
        cleanImages.slice(0, 8).forEach((img, i) => {
            const tag = isReviewImage(img) ? '[리뷰]' : isMainProductImage(img) ? '[상품]' : '[기타]';
            console.log(`     ${i + 1}. ${tag} ${img.substring(0, 100)}${img.length > 100 ? '...' : ''}`);
        });

        // 제거된 이미지 (디버깅)
        if (junkList.length > 0) {
            console.log('\n   🗑️  필터링된 이미지:');
            junkList.slice(0, 5).forEach((img, i) => {
                console.log(`     ${i + 1}. ${img.substring(0, 100)}${img.length > 100 ? '...' : ''}`);
            });
        }

        // ── 결과 요약 ──
        const hasTitle = snapshot.title && snapshot.title !== '제목 없음';
        const hasImages = cleanImages.length > 0;
        const hasPrice = !!snapshot.price;

        console.log(`\n📊 [${platform}] 결과 요약:`);
        console.log(`   제목: ${hasTitle ? '✅' : '❌'}`);
        console.log(`   가격: ${hasPrice ? '✅' : '⚠️'}`);
        console.log(`   이미지: ${hasImages ? '✅' : '❌'} (${cleanImages.length}개)`);
        console.log(`   리뷰: ${snapshot.reviews.length > 0 ? '✅' : '⚠️'} (${snapshot.reviews.length}개)`);
        console.log(`   특징: ${snapshot.features.length > 0 ? '✅' : '⚠️'} (${snapshot.features.length}개)`);

        return {
            platform,
            success: true,
            title: snapshot.title,
            imageStats: { total: snapshot.images.length, clean: cleanImages.length, junk: junkImages, review: reviewImages },
            elapsed
        };

    } catch (error) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n❌ [${platform}] 크롤링 실패! (${elapsed}초)`);
        console.log(`   에러: ${error.message}`);
        console.log(`   스택: ${error.stack?.split('\n').slice(0, 3).join('\n   ')}`);

        return {
            platform,
            success: false,
            error: error.message,
            elapsed
        };
    }
}

// ──────── 실행 ────────

async function main() {
    console.log('🚀 쇼핑 크롤러 Playwright 실전 테스트 시작');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`   테스트 대상: ${TEST_URLS.map(t => t.platform).join(', ')}`);

    const results = [];

    for (const testCase of TEST_URLS) {
        try {
            const result = await testSinglePlatform(testCase);
            results.push(result);
        } catch (err) {
            results.push({ platform: testCase.platform, success: false, error: err.message });
        }

        // 다음 테스트 전 잠시 대기 (봇 감지 방지)
        await new Promise(r => setTimeout(r, 2000));
    }

    // 최종 결과 요약
    console.log('\n\n' + '═'.repeat(70));
    console.log('📊 최종 결과 요약');
    console.log('═'.repeat(70));

    results.forEach(r => {
        if (r.success) {
            console.log(`  ✅ ${r.platform}: "${r.title?.substring(0, 40)}..." (이미지: ${r.imageStats?.clean}/${r.imageStats?.total}개 유효, ${r.elapsed}초)`);
        } else {
            console.log(`  ❌ ${r.platform}: ${r.error} (${r.elapsed || '?'}초)`);
        }
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`\n  총 결과: ${successCount}/${results.length} 성공`);

    process.exit(0);
}

main().catch(err => {
    console.error('🔥 테스트 실행 실패:', err);
    process.exit(1);
});
