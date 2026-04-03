/**
 * 에드센스 모드 CTA 차단 검증 — 미리보기 전용 (발행 안함)
 */
const path = require('path');
const { runPost } = require('./src/core/index.js');

async function main() {
    console.log('🏆 에드센스 모드 — 미리보기 전용 테스트');
    console.log('   CTA 완전 차단 여부 검증\n');

    const payload = {
        topic: '2026년 봄철 건강관리 완벽 가이드',
        keywords: ['봄철건강', '알레르기예방', '면역력강화'],
        contentMode: 'adsense',
        platform: 'preview',  // 미리보기 전용 (발행 안함!)
        previewOnly: true,
        imageGeneration: true,
        imageProvider: 'gemini',
        thumbnailGeneration: true,
        labels: ['봄철건강', '건강관리'],
    };

    const article = await runPost(payload, (msg) => {
        console.log(`  [앱] ${msg}`);
    });

    if (!article || !article.ok) {
        console.error('❌ 콘텐츠 생성 실패:', article?.error);
        process.exit(1);
    }

    const html = article.html;
    const bodyOnly = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const textContent = bodyOnly.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    console.log('\n═══════════ 에드센스 검증 ═══════════');
    console.log(`📏 텍스트: ${textContent.length}자`);
    console.log(`📏 HTML: ${html.length}자`);

    // CTA 검증
    const ctaBtnCount = (bodyOnly.match(/cta-btn/g) || []).length;
    const ctaBoxCount = (bodyOnly.match(/cta-box/g) || []).length;
    const ctaBannerCount = (bodyOnly.match(/cta-banner/g) || []).length;
    const rvCtaCount = (bodyOnly.match(/rv-cta/g) || []).length;

    console.log(`\n🔍 CTA 요소 검지:`);
    console.log(`  cta-btn: ${ctaBtnCount}개 ${ctaBtnCount === 0 ? '✅' : '❌'}`);
    console.log(`  cta-box: ${ctaBoxCount}개 ${ctaBoxCount === 0 ? '✅' : '❌'}`);
    console.log(`  cta-banner: ${ctaBannerCount}개 ${ctaBannerCount === 0 ? '✅' : '❌'}`);
    console.log(`  rv-cta: ${rvCtaCount}개 ${rvCtaCount === 0 ? '✅' : '❌'}`);

    const totalCta = ctaBtnCount + ctaBoxCount + ctaBannerCount + rvCtaCount;
    console.log(`\n${totalCta === 0 ? '✅ CTA 완전 차단 확인!' : `❌ CTA ${totalCta}개 발견 — 수정 필요`}`);

    // H2 검증
    const h2Count = (bodyOnly.match(/<h2/gi) || []).length;
    console.log(`  H2: ${h2Count}개 ${h2Count >= 5 ? '✅' : '❌'}`);

    // 미리보기 저장
    const fs = require('fs');
    const previewPath = path.join(__dirname, 'test-real-adsense-preview.html');
    fs.writeFileSync(previewPath, html, 'utf-8');
    console.log(`\n📋 미리보기: ${previewPath}`);
}

main().catch(e => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
