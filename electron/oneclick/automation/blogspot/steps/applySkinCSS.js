"use strict";
// electron/oneclick/automation/blogspot/steps/applySkinCSS.ts
// Step 5: 리더남 클라우드 스킨 CSS 적용
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySkinCSS = applySkinCSS;
const browser_1 = require("../../../utils/browser");
const skinLoader_1 = require("../../../utils/skinLoader");
const selectors_1 = require("../../../config/selectors");
/**
 * Blogger 테마 HTML 에디터에서 <b:skin> 섹션에 클라우드 스킨 CSS를 삽입한다.
 */
async function applySkinCSS(state, page, blogId) {
    state.currentStep = 5;
    state.stepStatus = 'running';
    state.message = '테마 HTML 편집 페이지로 이동 중...';
    try {
        if (blogId) {
            // 2026-04: /blog/theme/edit/ → /blog/themes/edit/ (Blogger URL 변경)
            await page.goto(`https://www.blogger.com/blog/themes/edit/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
        else {
            // blogId 없으면 사이드바 → 테마 → 추가 작업 → HTML 편집
            const themeLink = await page.locator(selectors_1.BLOGGER_SELECTORS.themeLink).first();
            if (await themeLink.isVisible({ timeout: 5000 })) {
                await themeLink.click();
                await (0, browser_1.sleep)(3000);
                // 2026-04: 드롭다운 메뉴에서 HTML 편집 접근
                const moreBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.themeMoreActions).first();
                if (await moreBtn.isVisible({ timeout: 3000 })) {
                    await moreBtn.click();
                    await (0, browser_1.sleep)(1000);
                }
                const editHtmlBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.editHtmlBtn).first();
                if (await editHtmlBtn.isVisible({ timeout: 3000 })) {
                    await editHtmlBtn.click();
                    await (0, browser_1.sleep)(3000);
                }
            }
        }
        await (0, browser_1.sleep)(3000);
        const skinCSS = (0, skinLoader_1.loadSkinCSS)('blogspot');
        if (skinCSS) {
            state.message = '클라우드 스킨 CSS 자동 적용 중...';
            try {
                const editor = await page.locator(selectors_1.BLOGGER_SELECTORS.codeEditor).first();
                if (await editor.isVisible({ timeout: 5000 })) {
                    await page.evaluate((css) => {
                        // 2026-04: CodeMirror → 대안 에디터도 지원
                        const marker = '/* === LEADERNAM CLOUD SKIN START === */';
                        // 방법 1: CodeMirror (기존)
                        const cm = document.querySelector('.CodeMirror')?.CodeMirror;
                        if (cm) {
                            const content = cm.getValue();
                            if (!content.includes(marker)) {
                                const insertPoint = content.indexOf(']]></b:skin>');
                                if (insertPoint > -1) {
                                    cm.setValue(content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint));
                                }
                            }
                            return;
                        }
                        // 방법 2: Ace Editor
                        const ace = document.querySelector('.ace_editor')?.env?.editor;
                        if (ace) {
                            const content = ace.getValue();
                            if (!content.includes(marker)) {
                                const insertPoint = content.indexOf(']]></b:skin>');
                                if (insertPoint > -1) {
                                    ace.setValue(content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint));
                                }
                            }
                            return;
                        }
                        // 방법 3: textarea 직접
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                            const content = textarea.value;
                            if (!content.includes(marker)) {
                                const insertPoint = content.indexOf(']]></b:skin>');
                                if (insertPoint > -1) {
                                    textarea.value = content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint);
                                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                            }
                            return;
                        }
                        // 방법 4: contenteditable
                        const editable = document.querySelector('[contenteditable="true"], [role="textbox"]');
                        if (editable) {
                            const content = editable.textContent || '';
                            if (!content.includes(marker)) {
                                const insertPoint = content.indexOf(']]></b:skin>');
                                if (insertPoint > -1) {
                                    editable.textContent = content.slice(0, insertPoint) + '\n' + marker + '\n' + css + '\n/* === LEADERNAM CLOUD SKIN END === */\n' + content.slice(insertPoint);
                                }
                            }
                        }
                    }, skinCSS);
                    await (0, browser_1.sleep)(1000);
                    try {
                        const saveThemeBtn = await page.locator(selectors_1.BLOGGER_SELECTORS.saveThemeBtn).first();
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
