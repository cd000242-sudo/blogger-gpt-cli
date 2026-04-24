"use strict";
// electron/oneclick/automation/blogspot/steps/searchConsole.ts
// Step 6: 구글 서치 콘솔 자동 연동
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSearchConsole = setupSearchConsole;
const browser_1 = require("../../../utils/browser");
const selectors_1 = require("../../../config/selectors");
/**
 * Blogger 설정 페이지에서 Google Search Console 연동을 수행한다.
 */
async function setupSearchConsole(state, page, blogId, config) {
    state.currentStep = 6;
    state.stepStatus = 'running';
    state.message = '구글 서치 콘솔 자동 연동 중...';
    try {
        if (blogId) {
            await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await (0, browser_1.waitForPageStable)(page, 2000);
        }
        const gscSection = await page.locator(selectors_1.BLOGGER_SELECTORS.gscSection).first();
        if (await gscSection.isVisible({ timeout: 5000 })) {
            await gscSection.click();
            await (0, browser_1.sleep)(2000);
            const domainInput = await page.locator(selectors_1.BLOGGER_SELECTORS.domainInput).first();
            if (await domainInput.isVisible({ timeout: 3000 })) {
                const blogUrl = config.blogAddress ? `https://${config.blogAddress}.blogspot.com` : '';
                if (blogUrl) {
                    await domainInput.fill(blogUrl);
                    await (0, browser_1.sleep)(1000);
                }
            }
            const verifyBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.verifyBtn).first();
            if (await verifyBtn.isVisible({ timeout: 3000 })) {
                await verifyBtn.click();
                await (0, browser_1.sleep)(3000);
                state.message = '✅ 구글 서치 콘솔 연동 완료!';
            }
            else {
                state.message = '이미 연동되어 있을 수 있습니다 — search.google.com/search-console 에서 해당 블로그 URL이 속성에 표시되는지 확인하세요';
            }
        }
        else {
            state.message = '서치 콘솔 섹션 미발견 — Blogger 설정 → "검색 환경설정" → "Google Search Console" 섹션을 직접 클릭해 연결하세요';
        }
    }
    catch (e) {
        console.error('[ONECLICK-BLOGSPOT] 서치 콘솔 연동 오류:', e);
        state.message = '서치 콘솔 자동 연동 실패 — Blogger 설정 → 검색 환경설정 → Google Search Console에서 직접 연결해 주세요';
    }
    state.stepStatus = 'done';
    await (0, browser_1.sleep)(1000);
}
