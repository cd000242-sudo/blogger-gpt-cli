"use strict";
// electron/oneclick/automation/blogspot/steps/applySkinCSS.ts
// Step 5: 리더남 클라우드 스킨 CSS 적용
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySkinCSS = applySkinCSS;
const browser_1 = require("../../../utils/browser");
const skinLoader_1 = require("../../../utils/skinLoader");
/**
 * Blogger 테마 HTML 에디터에서 <b:skin> 섹션에 클라우드 스킨 CSS를 삽입한다.
 */
async function applySkinCSS(state, page, blogId) {
    state.currentStep = 5;
    state.stepStatus = 'running';
    state.message = '테마 HTML 편집 페이지로 이동 중...';
    try {
        if (blogId) {
            await page.goto(`https://www.blogger.com/blog/theme/edit/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        else {
            const themeLink = await page.locator('a:has-text("테마"), a:has-text("Theme")').first();
            if (await themeLink.isVisible({ timeout: 5000 })) {
                await themeLink.click();
                await (0, browser_1.sleep)(2000);
                const editHtmlBtn = await page.locator('button:has-text("HTML 편집"), button:has-text("Edit HTML")').first();
                if (await editHtmlBtn.isVisible({ timeout: 3000 })) {
                    await editHtmlBtn.click();
                }
            }
        }
        await (0, browser_1.sleep)(3000);
        const skinCSS = (0, skinLoader_1.loadSkinCSS)('blogspot');
        if (skinCSS) {
            state.message = '클라우드 스킨 CSS 자동 적용 중...';
            try {
                const editor = await page.locator('.CodeMirror, textarea, [contenteditable]').first();
                if (await editor.isVisible({ timeout: 5000 })) {
                    await page.evaluate((css) => {
                        const cm = document.querySelector('.CodeMirror')?.CodeMirror;
                        if (cm) {
                            const currentContent = cm.getValue();
                            const marker = '/* === LEADERNAM CLOUD SKIN START === */';
                            if (!currentContent.includes(marker)) {
                                const insertPoint = currentContent.indexOf(']]></b:skin>');
                                if (insertPoint > -1) {
                                    const newContent = currentContent.slice(0, insertPoint) +
                                        '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' +
                                        currentContent.slice(insertPoint);
                                    cm.setValue(newContent);
                                }
                            }
                        }
                    }, skinCSS);
                    await (0, browser_1.sleep)(1000);
                    try {
                        const saveThemeBtn = await page.locator('button[aria-label*="저장"], button[aria-label*="Save"], button:has-text("💾")').first();
                        if (await saveThemeBtn.isVisible({ timeout: 3000 })) {
                            await saveThemeBtn.click();
                            await (0, browser_1.sleep)(2000);
                        }
                    }
                    catch { /* 수동 저장 필요 */ }
                    state.message = '✅ 클라우드 스킨 CSS 적용 완료!';
                }
                else {
                    state.message = '코드 에디터를 찾지 못함 (수동 적용 필요)';
                }
            }
            catch {
                state.message = '테마 편집 페이지에서 수동으로 CSS를 적용해주세요';
            }
        }
        else {
            state.message = '스킨 CSS 파일 없음 — 건너뜁니다';
        }
    }
    catch (e) {
        console.error('[ONECLICK-BLOGSPOT] 스킨 적용 오류:', e);
        state.message = '스킨 적용 실패 (수동 적용 필요)';
    }
    state.stepStatus = 'done';
    await (0, browser_1.sleep)(1000);
}
