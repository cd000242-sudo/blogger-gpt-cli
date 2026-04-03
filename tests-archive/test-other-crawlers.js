/**
 * G마켓 + 11번가 + Temu 개별 테스트
 * 쿠팡은 Access Denied로 별도 처리 필요
 */
const path = require('path');
require('ts-node').register({
    transpileOnly: true,
    project: path.join(__dirname, 'tsconfig.json'),
    compilerOptions: { module: 'commonjs', esModuleInterop: true }
});

const { crawlProductSnapshot } = require('./src/crawlers/parser-registry');

const TESTS = [
    { name: 'G마켓', url: 'https://item.gmarket.co.kr/Item?goodscode=3972981340' },
    { name: '11번가', url: 'https://www.11st.co.kr/products/6836498473' },
    { name: 'Temu', url: 'https://www.temu.com/kr/bluetooth-earphones.html' },
];

async function testOne(name, url) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 [${name}] 크롤링 테스트`);
    console.log(`   URL: ${url}`);
    console.log('='.repeat(60));

    const t0 = Date.now();
    try {
        const { snapshot, crawlResult } = await crawlProductSnapshot(url, {
            timeoutMs: 30000,
            enableImages: true
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        console.log(`⏱  소요: ${elapsed}초, HTML: ${(crawlResult.html.length / 1024).toFixed(0)}KB`);

        // 기본 정보
        console.log(`\n📦 제목: ${snapshot.title}`);
        console.log(`   설명: ${(snapshot.description || '없음').substring(0, 80)}`);
        if (snapshot.price) {
            console.log(`   가격: ${snapshot.price.current?.toLocaleString()} ${snapshot.price.currency || 'KRW'}`);
            if (snapshot.price.original) console.log(`   정가: ${snapshot.price.original?.toLocaleString()}`);
        }
        if (snapshot.discount) console.log(`   할인: ${snapshot.discount}`);
        if (snapshot.delivery) console.log(`   배송: ${snapshot.delivery}`);
        if (snapshot.seller) console.log(`   판매자: ${snapshot.seller}`);
        if (snapshot.rating) console.log(`   평점: ${snapshot.rating}`);
        if (snapshot.reviewCount) console.log(`   리뷰수: ${snapshot.reviewCount}`);
        if (snapshot.categories?.length) console.log(`   카테고리: ${snapshot.categories.join(' > ')}`);

        // 특징
        console.log(`\n📋 특징 (${snapshot.features.length}개):`);
        snapshot.features.slice(0, 3).forEach((f, i) => {
            console.log(`   ${i + 1}. [${f.heading}] ${f.body.substring(0, 60)}`);
        });

        // 스펙
        const specEntries = Object.entries(snapshot.specs || {});
        if (specEntries.length > 0) {
            console.log(`\n📐 스펙 (${specEntries.length}개):`);
            specEntries.slice(0, 4).forEach(([k, v]) => console.log(`   ${k}: ${v}`));
        }

        // 리뷰
        console.log(`\n💬 리뷰 (${snapshot.reviews.length}개):`);
        snapshot.reviews.slice(0, 2).forEach((r, i) => {
            console.log(`   ${i + 1}. "${r.quote.substring(0, 60)}" (★${r.rating || '?'})`);
        });

        // 이미지 — 핵심!
        console.log(`\n🖼  이미지 수집 (${snapshot.images.length}개):`);
        snapshot.images.forEach((img, i) => {
            // 분류
            const lower = img.toLowerCase();
            let tag = '[기타]';
            if (/logo|icon|favicon|badge|sprite|arrow|button|close|nav_|menu|tab_|loading|spinner|star|heart|wish|cart|ship|coupon|guarantee|seal|payment|pg_|card_icon|facebook|twitter|instagram|kakao|naver|share|sns_|spacer|1x1|blank|transparent/i.test(lower)) {
                tag = '[🗑쓰레기]';
            } else if (/review|comment|user_|buyreview|sdp-review/i.test(lower)) {
                tag = '[📸리뷰]';
            } else if (/product|goods|item|thumbnail|detail|\/pd\/|\/pds\/|\/prd\//i.test(lower)) {
                tag = '[🛍상품]';
            }

            // 작은 이미지 감지
            const sizeMatch = lower.match(/[_x](\d+)[x_](\d+)\./);
            if (sizeMatch && (parseInt(sizeMatch[1]) < 100 || parseInt(sizeMatch[2]) < 100)) {
                tag = '[🗑작은]';
            }
            if (lower.endsWith('.svg') || lower.endsWith('.gif')) {
                tag = '[🗑SVG/GIF]';
            }

            console.log(`   ${i + 1}. ${tag} ${img.substring(0, 120)}${img.length > 120 ? '...' : ''}`);
        });

        // 요약
        const junkCount = snapshot.images.filter(img => {
            const l = img.toLowerCase();
            return /logo|icon|favicon|badge|sprite|arrow|button|close|loading|spinner|star|heart|share|sns|spacer|1x1|blank|transparent/i.test(l)
                || l.endsWith('.svg') || l.endsWith('.gif');
        }).length;

        console.log(`\n📊 [${name}] 요약:`);
        console.log(`   제목: ${snapshot.title && snapshot.title !== '제목 없음' ? '✅' : '❌'}`);
        console.log(`   가격: ${snapshot.price ? '✅' : '⚠️ 없음'}`);
        console.log(`   이미지: ${snapshot.images.length}개 (쓰레기 ${junkCount}개)`);
        console.log(`   리뷰: ${snapshot.reviews.length}개`);
        console.log(`   특징: ${snapshot.features.length}개`);

        return { name, ok: true, title: snapshot.title, images: snapshot.images.length, junk: junkCount, elapsed };
    } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        console.log(`\n❌ [${name}] 실패 (${elapsed}초): ${err.message}`);
        return { name, ok: false, error: err.message, elapsed };
    }
}

async function main() {
    console.log('🚀 쇼핑 크롤러 개별 테스트');
    console.log(`   시간: ${new Date().toLocaleString('ko-KR')}`);

    const results = [];
    for (const t of TESTS) {
        const r = await testOne(t.name, t.url);
        results.push(r);
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n\n${'='.repeat(60)}`);
    console.log('📊 최종 요약');
    console.log('='.repeat(60));
    results.forEach(r => {
        if (r.ok) {
            console.log(`  ✅ ${r.name}: "${r.title?.substring(0, 40)}" (이미지 ${r.images}개, 쓰레기 ${r.junk}개, ${r.elapsed}초)`);
        } else {
            console.log(`  ❌ ${r.name}: ${r.error} (${r.elapsed}초)`);
        }
    });

    process.exit(0);
}

main();
