/**
 * test-real-adsense.js
 * 실제 앱 파이프라인과 100% 동일한 에드센스 모드 테스트
 * 
 * 흐름: runPost() → generateUltimateMaxModeArticlePuppeteer() 
 *       → AI 7섹션 생성 + 나노바나나2 이미지 → publishToBlogger()
 */

const path = require('path');

// ── 실제 앱 모듈 직접 로드 ──
const {
    runPost,
    publishGeneratedContent
} = require('./src/core/index.js');

async function main() {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🏆 에드센스 모드 — 실제 앱 파이프라인 테스트');
    console.log('   runPost() → AI 7섹션 생성 → 나노바나나2 이미지');
    console.log('   → Clean CSS → Blogger 발행');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

    const startTime = Date.now();

    // ── 실제 앱과 동일한 payload 구성 ──
    const payload = {
        // 주제
        topic: '2026년 봄철 건강관리 완벽 가이드',
        keywords: ['봄철건강', '알레르기예방', '면역력강화', '봄나물효능', '환절기건강'],

        // 에드센스 모드 활성화 (핵심!)
        contentMode: 'adsense',

        // 발행 설정
        platform: 'blogspot',
        postingMode: 'draft',  // 임시보관

        // 이미지 생성 설정 (나노바나나2 사용)
        imageGeneration: true,
        imageProvider: 'gemini',    // 나노바나나2 = gemini-3.1-flash-image-preview
        thumbnailGeneration: true,

        // 라벨
        labels: ['봄철건강', '건강관리', '알레르기', '면역력', '봄나물'],
    };

    // ── 1단계: AI 콘텐츠 생성 (실제 앱과 동일) ──
    console.log('📝 1단계: AI 콘텐츠 생성 시작 (실제 runPost 함수 호출)');
    console.log('   → contentMode: adsense (7섹션 구조)');
    console.log('   → 최소 6,000자 이상 목표');
    console.log('   → E-E-A-T 강화 + AI탐지 방지');
    console.log('');

    let article;
    try {
        article = await runPost(payload, (msg) => {
            console.log(`  [앱] ${msg}`);
        });

        if (!article || !article.ok) {
            console.error('❌ 콘텐츠 생성 실패:', article?.error || '알 수 없는 오류');
            process.exit(1);
        }

        const elapsed1 = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('');
        console.log(`✅ 콘텐츠 생성 완료! (${elapsed1}초)`);
        console.log(`   📝 제목: ${article.title}`);
        console.log(`   📊 HTML 크기: ${Math.round(article.html.length / 1024)}KB`);
        console.log(`   🏷️ 라벨: ${(article.labels || []).join(', ')}`);
        console.log(`   📸 썸네일: ${article.thumbnail ? '있음' : '없음'}`);

        // 글자수 체크 (태그 제거 후)
        const textOnly = article.html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        console.log(`   📏 순수 텍스트: ${textOnly.length}자`);
        console.log('');

    } catch (e) {
        console.error('❌ 콘텐츠 생성 중 예외:', e.message);
        console.error(e.stack);
        process.exit(1);
    }

    // ── 2단계: 에드센스 정합성 체크 ──
    console.log('🔍 2단계: 에드센스 정합성 체크');
    console.log('─'.repeat(50));

    const html = article.html;
    const bodyOnly = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    const textContent = bodyOnly.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

    const checks = [
        { name: 'Clean CSS 적용', pass: html.includes('에드센스') || html.includes('Pretendard') || html.includes('pretendard') },
        { name: 'CTA 클래스 없음', pass: !bodyOnly.match(/cta-btn|cta-box|cta-banner|cta-wrapper/) },
        { name: 'ad-safe-zone 없음', pass: !bodyOnly.includes('ad-safe-zone') },
        { name: '애니메이션 없음', pass: !bodyOnly.match(/ctaPulse|premiumPulse|bounce|fadeFloat/) },
        { name: `글자수 3000자+ (현재: ${textContent.length}자)`, pass: textContent.length >= 3000 },
        { name: `글자수 6000자+ (현재: ${textContent.length}자)`, pass: textContent.length >= 6000 },
        { name: 'H2 태그 5개+', pass: (bodyOnly.match(/<h2/gi) || []).length >= 5 },
        { name: 'table 존재', pass: (bodyOnly.match(/<table/gi) || []).length >= 1 },
        { name: 'FAQ 존재', pass: bodyOnly.toLowerCase().includes('faq') || bodyOnly.includes('자주 묻는') },
        { name: '이미지 포함', pass: (bodyOnly.match(/<img\s/gi) || []).length >= 1 },
    ];

    let allPass = true;
    for (const c of checks) {
        console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}`);
        if (!c.pass) allPass = false;
    }
    console.log('─'.repeat(50));
    console.log(allPass ? '✅ 모든 체크 통과!\n' : '⚠️ 일부 체크 실패 (확인 필요)\n');

    // ── 3단계: Blogger 발행 (실제 앱과 동일) ──
    console.log('🚀 3단계: Blogger 발행 (실제 publishGeneratedContent 함수 호출)');
    console.log('   → contentMode: adsense → Clean CSS 자동 적용');
    console.log('   → CTA/광고 요소 자동 제거');
    console.log('   → 임시보관(Draft)으로 저장');
    console.log('');

    try {
        const publishResult = await publishGeneratedContent(
            payload,
            article.title,
            article.html,
            article.thumbnail || ''
        );

        const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (publishResult.ok) {
            console.log('');
            console.log('═══════════════════════════════════════════════════');
            console.log('✅ 전체 파이프라인 성공!');
            console.log('═══════════════════════════════════════════════════');
            console.log(`📝 제목: ${article.title}`);
            console.log(`🏷️ 라벨: ${(article.labels || payload.labels).join(', ')}`);
            console.log(`📏 글자수: ${textContent.length}자`);
            console.log(`🖼️ 이미지: ${(bodyOnly.match(/<img\s/gi) || []).length}개`);
            console.log(`📸 썸네일: ${article.thumbnail ? '설정됨' : '미설정'}`);
            console.log(`🎨 CSS: AdSense Clean Mode`);
            console.log(`📄 Post ID: ${publishResult.postId || publishResult.id}`);
            console.log(`🔗 URL: ${publishResult.url || '(임시보관)'}`);
            console.log(`⏱️ 총 소요시간: ${totalElapsed}초`);
            console.log(`📊 HTML 크기: ${Math.round(html.length / 1024)}KB`);
            console.log('═══════════════════════════════════════════════════');
        } else {
            console.error(`❌ 발행 실패: ${publishResult.error}`);
            if (publishResult.needsAuth) {
                console.error('⚠️ 인증이 필요합니다. 앱에서 Blogger OAuth 인증을 해주세요.');
            }
        }
    } catch (e) {
        console.error('❌ 발행 중 예외:', e.message);
    }

    // ── 미리보기 HTML 저장 ──
    const fs = require('fs');
    const previewPath = path.join(__dirname, 'test-real-adsense-preview.html');
    fs.writeFileSync(previewPath, article.html, 'utf-8');
    console.log(`\n📋 미리보기 저장: ${previewPath}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
