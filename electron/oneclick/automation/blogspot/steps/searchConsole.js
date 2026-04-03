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
                state.message = '서치 콘솔이 이미 연동되어 있거나 수동 확인 필요';
            }
        }
        else {
            state.message = '서치 콘솔 섹션을 찾지 못함 (수동 연결 필요)';
        }
    }
    catch (e) {
        console.error('[ONECLICK-BLOGSPOT] 서치 콘솔 연동 오류:', e);
        state.message = '서치 콘솔 연동 실패 (수동 설정 필요)';
    }
    state.stepStatus = 'done';
    await (0, browser_1.sleep)(1000);
}
