/**
 * 🧪 쇼핑 크롤러 개별 테스트 (크롬 창 보이게)
 * 
 * 사용법: node test-crawler-visible.js [platform]
 * platform: coupang | gmarket | 11st | temu | all
 */
const path = require('path');
const fs = require('fs');

require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: { module: 'commonjs', esModuleInterop: true }
});

const { crawlProductSnapshot } = require('./src/crawlers/parser-registry');

const PLATFORMS = {
    coupang: {
        name: '쿠팡',
        url: 'https://www.coupang.com/vp/products/8178498750',
    },
    gmarket: {
        name: 'G마켓',
        url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340',
    },
    '11st': {
        name: '11번가',
        url: 'https://www.11st.co.kr/products/6836498473',
    },
    temu: {
        name: 'Temu',
        url: 'https://www.temu.com/kr/bluetooth-earphones.html',
    },
};

// ── 이미지 필터링 로직 ──

const JUNK_PATTERNS = [
    'logo', 'icon', 'favicon', 'banner', 'sprite', 'badge',
    'ad_img', 'tracking', 'pixel', 'beacon', 'analytics',
    'button', 'arrow', 'close', 'nav_', 'menu_', 'tab_',
    'loading', 'spinner', 'placeholder',
    'spacer', '1x1', 'blank', 'transparent',
    'rating_star', 'star_', 'heart_', 'wish_',
    'cart_', 'delivery_icon', 'ship_', 'coupon_icon',
    'guarantee', 'certificate', 'trust', 'seal_',
    'facebook', 'twitter', 'instagram', 'kakao_icon', 'naver_icon',
    'share_', 'sns_',
    'payment', 'pg_', 'card_icon',
];

function classifyImage(url) {
    const lower = url.toLowerCase();

    // SVG/GIF = 보통 아이콘이나 추적 픽셀
    if (lower.endsWith('.svg')) return 'junk-svg';
    if (lower.endsWith('.gif') && !lower.includes('review')) return 'junk-gif';

    // 작은 이미지 감지
    const sizeMatch = lower.match(/[_x](\d+)[x_](\d+)\./);
    if (sizeMatch && (parseInt(sizeMatch[1]) < 100 || parseInt(sizeMatch[2]) < 100)) return 'junk-small';

    // data URI 작은 이미지
    if (lower.startsWith('data:image') && lower.length < 500) return 'junk-datauri';

    // 패턴 매칭
    for (const pat of JUNK_PATTERNS) {
        if (lower.includes(pat)) return `junk-${pat}`;
    }

    // 리뷰 이미지
    if (/review|comment|user_|buyreview|sdp-review/i.test(lower)) return 'review';

    // 상품 이미지
    if (/product|goods|item|thumbnail|detail|\/pd\/|\/pds\/|\/prd\//i.test(lower)) return 'product';

    return 'other';
}

// ── 테스트 실행 ──

async function testPlatform(key) {
    const config = PLATFORMS[key];
    if (!config) {
        console.log(`❌ 알 수 없는 플랫폼: ${key}`);
        console.log(`   사용 가능: ${Object.keys(PLATFORMS).join(', ')}`);
        return null;
    }

    const log = [];
    const print = (msg) => { console.log(msg); log.push(msg); };

    print(`\n${'═'.repeat(60)}`);
    print(`🧪 [${config.name}] 크롤링 테스트 (크롬 창 보임)`);
    print(`   URL: ${config.url}`);
    print(`${'═'.repeat(60)}`);

    const t0 = Date.now();

    try {
        const { snapshot, crawlResult } = await crawlProductSnapshot(config.url, {
            timeoutMs: 30000,
            headless: false,       // 🖥 크롬 창 보이게!
            enableImages: true,    // 이미지 로딩 허용
        });

        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        print(`\n⏱  소요시간: ${elapsed}초`);
        print(`📄 HTML 크기: ${(crawlResult.html.length / 1024).toFixed(0)}KB`);

        // 기본 정보
        print(`\n── 📦 기본 정보 ──`);
        print(`제목: ${snapshot.title}`);
        print(`설명: ${(snapshot.description || '없음').substring(0, 120)}`);

        if (snapshot.price) {
            let priceStr = `가격: ${snapshot.price.current?.toLocaleString()} ${snapshot.price.currency || 'KRW'}`;
            if (snapshot.price.original) priceStr += ` (정가: ${snapshot.price.original.toLocaleString()})`;
            print(priceStr);
        } else {
            print('가격: ⚠️ 추출 실패');
        }

        if (snapshot.discount) print(`할인: ${snapshot.discount}`);
        if (snapshot.delivery) print(`배송: ${snapshot.delivery}`);
        if (snapshot.seller) print(`판매자: ${snapshot.seller}`);
        if (snapshot.rating) print(`평점: ★${snapshot.rating}`);
        if (snapshot.reviewCount) print(`리뷰수: ${snapshot.reviewCount}개`);
        if (snapshot.categories?.length) print(`카테고리: ${snapshot.categories.join(' > ')}`);

        // 특징
        print(`\n── 📋 특징 (${snapshot.features.length}개) ──`);
        snapshot.features.slice(0, 5).forEach((f, i) => {
            print(`  ${i + 1}. [${f.heading}] ${f.body.substring(0, 80)}`);
        });

        // 스펙
        const specEntries = Object.entries(snapshot.specs || {});
        if (specEntries.length) {
            print(`\n── 📐 스펙 (${specEntries.length}개) ──`);
            specEntries.slice(0, 5).forEach(([k, v]) => print(`  ${k}: ${v}`));
        }

        // 리뷰
        print(`\n── 💬 리뷰 (${snapshot.reviews.length}개) ──`);
        snapshot.reviews.slice(0, 3).forEach((r, i) => {
            print(`  ${i + 1}. "${r.quote.substring(0, 80)}" ${r.rating ? `(★${r.rating})` : ''}`);
        });

        // 🖼 이미지 분석 (핵심!)
        print(`\n── 🖼 이미지 분석 (총 ${snapshot.images.length}개) ──`);

        let productCount = 0, reviewCount = 0, junkCount = 0, otherCount = 0;
        const cleanImages = [];

        snapshot.images.forEach((img, i) => {
            const cls = classifyImage(img);
            let tag = '';

            if (cls.startsWith('junk')) {
                junkCount++;
                tag = `🗑️ [${cls}]`;
            } else if (cls === 'review') {
                reviewCount++;
                cleanImages.push(img);
                tag = '📸 [리뷰]';
            } else if (cls === 'product') {
                productCount++;
                cleanImages.push(img);
                tag = '🛍️ [상품]';
            } else {
                otherCount++;
                cleanImages.push(img);
                tag = '❓ [기타]';
            }

            print(`  ${(i + 1).toString().padStart(2)}. ${tag} ${img.substring(0, 110)}${img.length > 110 ? '...' : ''}`);
        });

        // 이미지 요약
        print(`\n── 📊 이미지 요약 ──`);
        print(`  🛍️  상품 이미지: ${productCount}개`);
        print(`  📸 리뷰 이미지: ${reviewCount}개`);
        print(`  🗑️  불필요(제거): ${junkCount}개`);
        print(`  ❓ 기타:        ${otherCount}개`);
        print(`  ✅ 최종 유효:   ${cleanImages.length}개`);

        // 결과 판정
        const hasTitle = snapshot.title && snapshot.title !== '제목 없음' && !snapshot.title.includes('Access Denied');
        const hasPrice = !!snapshot.price;
        const hasImages = cleanImages.length > 0;

        print(`\n── ✅ [${config.name}] 최종 판정 ──`);
        print(`  제목: ${hasTitle ? '✅ OK' : '❌ FAIL'}`);
        print(`  가격: ${hasPrice ? '✅ OK' : '⚠️ 없음'}`);
        print(`  이미지: ${hasImages ? `✅ ${cleanImages.length}개` : '❌ 없음'}`);
        print(`  리뷰: ${snapshot.reviews.length > 0 ? `✅ ${snapshot.reviews.length}개` : '⚠️ 없음'}`);
        print(`  특징: ${snapshot.features.length > 0 ? `✅ ${snapshot.features.length}개` : '⚠️ 없음'}`);

        // 결과 파일 저장
        const resultFile = path.join(__dirname, `test-result-${key}.txt`);
        fs.writeFileSync(resultFile, log.join('\n'), 'utf8');
        print(`\n📄 결과 저장: ${resultFile}`);

        return {
            name: config.name,
            ok: true,
            title: snapshot.title,
            hasTitle, hasPrice, hasImages,
            images: { total: snapshot.images.length, clean: cleanImages.length, junk: junkCount, review: reviewCount, product: productCount },
            reviews: snapshot.reviews.length,
        };

    } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        print(`\n❌ [${config.name}] 크롤링 실패! (${elapsed}초)`);
        print(`   에러: ${err.message}`);
        print(`   스택: ${err.stack?.split('\n').slice(0, 4).join('\n   ')}`);

        return { name: config.name, ok: false, error: err.message };
    }
}

async function main() {
    const arg = process.argv[2] || 'all';

    console.log('🚀 쇼핑 크롤러 Playwright 테스트 (크롬 창 보임)');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);
    console.log(`   대상: ${arg}`);

    const results = [];

    if (arg === 'all') {
        for (const key of Object.keys(PLATFORMS)) {
            const r = await testPlatform(key);
            if (r) results.push(r);
            // 다음 테스트 전 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } else {
        const r = await testPlatform(arg);
        if (r) results.push(r);
    }

    if (results.length > 1) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log('📊 전체 테스트 요약');
        console.log('═'.repeat(60));
        results.forEach(r => {
            if (r.ok) {
                console.log(`  ✅ ${r.name}: "${r.title?.substring(0, 35)}" (이미지 ${r.images?.clean}/${r.images?.total}유효)`);
            } else {
                console.log(`  ❌ ${r.name}: ${r.error}`);
            }
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error('🔥 테스트 실행 에러:', err);
    process.exit(1);
});
