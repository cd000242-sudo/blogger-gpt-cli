const puppeteer = require('puppeteer-core');
const path = require('path');
const SS = 'C:/Users/박성현/.gemini/antigravity/brain/48947124-abc0-42ce-b0ae-ee5ee9337d0b';

async function main() {
    try {
        const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
        const pages = await browser.pages();
        console.log(`페이지 수: ${pages.length}`);

        const page = pages[0];
        await new Promise(r => setTimeout(r, 1000));

        // 현재 상태 스크린샷
        await page.screenshot({ path: path.join(SS, 'final_check.png') });
        console.log('📸 최종 상태 스크린샷');

        // 발행 결과 확인
        const result = await page.evaluate(() => {
            const body = document.body.innerText || '';

            // 진행률
            const pctMatch = body.match(/(\d+)%/);

            // 성공/실패
            const hasComplete = body.includes('발행 완료') || body.includes('발행 성공') || body.includes('성공적으로');
            const hasError = body.includes('발행 실패') || body.includes('Error:') || body.includes('에러가');

            // 현재 상태 텍스트
            const statusMatch = body.match(/(글 작성중|AI 콘텐츠 생성 중|발행 준비|발행 완료|발행 실패|고품질 블로그 발행 시작)[^\n]{0,50}/);

            // URL
            const urlMatch = body.match(/https?:\/\/[^\s<>"]+/g);

            return {
                pct: pctMatch ? pctMatch[1] : 'N/A',
                hasComplete, hasError,
                status: statusMatch ? statusMatch[0] : 'N/A',
                urls: urlMatch ? urlMatch.slice(0, 5) : []
            };
        });

        console.log('\n=== 최종 발행 상태 ===');
        console.log(`진행률: ${result.pct}%`);
        console.log(`상태: ${result.status}`);
        console.log(`완료: ${result.hasComplete}`);
        console.log(`에러: ${result.hasError}`);
        if (result.urls.length > 0) {
            console.log(`URLs:`);
            result.urls.forEach(u => console.log(`  - ${u}`));
        }

        browser.disconnect();
    } catch (e) {
        console.error('연결 실패:', e.message);
    }
}
main();
