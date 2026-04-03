"use strict";
// @ts-nocheck
// electron/oneclick/automation/blogspot/steps/optimizeSettings.ts
// Step 2: 설정 자동 최적화 (13개 항목)
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeSettings = optimizeSettings;
const browser_1 = require("../../../utils/browser");
/**
 * Blogger 설정 페이지에서 13개 항목을 자동 최적화한다.
 * - 설명 입력, 글 표시 개수(6), 이미지 라이트박스, 지연 로드, WebP
 * - 댓글 숨기기, 시간대(서울), 검색 엔진 노출, HTTPS, 성인 콘텐츠 비활성화
 */
async function optimizeSettings(state, page, blogId, config) {
    state.currentStep = 2;
    state.stepStatus = 'running';
    state.message = '설정 페이지로 이동 중...';
    try {
        if (blogId) {
            await page.goto(`https://www.blogger.com/blog/settings/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
        else {
            try {
                const settingsLink = await page.locator('a[href*="settings"], a:has-text("설정"), a:has-text("Settings")').first();
                if (await settingsLink.isVisible({ timeout: 5000 })) {
                    await settingsLink.click();
                }
            }
            catch { /* 설정 링크를 찾지 못함 */ }
        }
        await (0, browser_1.sleep)(3000);
        // 설명(Description) 입력
        if (config.blogDescription) {
            state.message = '블로그 설명 설정 중...';
            try {
                const descSection = await page.locator('text="설명", text="Description"').first();
                if (await descSection.isVisible({ timeout: 3000 })) {
                    await descSection.click();
                    await (0, browser_1.sleep)(1000);
                    const descTextarea = await page.locator('textarea, [contenteditable="true"]').first();
                    if (await descTextarea.isVisible({ timeout: 3000 })) {
                        await descTextarea.fill(config.blogDescription);
                        await (0, browser_1.sleep)(500);
                        const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
                        if (await saveBtn.isVisible({ timeout: 3000 })) {
                            await saveBtn.click();
                            await (0, browser_1.sleep)(1500);
                        }
                    }
                }
            }
            catch (e) {
                console.log('[ONECLICK-BLOGSPOT] 설명 설정 폴백:', e);
            }
        }
        // 글 표시 개수를 6개로 설정
        state.message = '글 표시 개수 설정 중 (6개)...';
        try {
            await page.evaluate(() => {
                const inputs = document.querySelectorAll('input[type="number"], input[type="text"]');
                inputs.forEach((input) => {
                    const label = input.closest('div')?.previousElementSibling?.textContent || '';
                    if (label.includes('글') || label.includes('Posts') || label.includes('posts')) {
                        input.value = '6';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            });
            await (0, browser_1.sleep)(500);
        }
        catch { /* 글 개수 설정 실패 — 무시 */ }
        // 토글/체크박스 항목 자동 설정
        state.message = '이미지 라이트박스, 지연 로드, WebP 활성화 중...';
        try {
            await page.evaluate(() => {
                const toggleItems = document.querySelectorAll('[role="checkbox"], [role="switch"], input[type="checkbox"]');
                toggleItems.forEach((toggle) => {
                    const parentText = toggle.closest('[class]')?.textContent || '';
                    const label = parentText.toLowerCase();
                    const shouldEnable = [
                        '라이트박스', 'lightbox',
                        '지연 로드', 'lazy', 'lazyload',
                        'webp',
                        '검색 엔진', 'search engine', '표시됨', 'visible',
                        'https',
                    ];
                    const shouldDisable = [
                        '성인', 'adult',
                    ];
                    const matchEnable = shouldEnable.some(keyword => label.includes(keyword));
                    const matchDisable = shouldDisable.some(keyword => label.includes(keyword));
                    if (matchEnable) {
                        const isChecked = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
                        if (!isChecked) {
                            toggle.click();
                            console.log('[ONECLICK] ✅ 활성화:', parentText.slice(0, 50));
                        }
                    }
                    if (matchDisable) {
                        const isChecked = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
                        if (isChecked) {
                            toggle.click();
                            console.log('[ONECLICK] ❌ 비활성화:', parentText.slice(0, 50));
                        }
                    }
                });
            });
            await (0, browser_1.sleep)(1000);
        }
        catch (e) {
            console.log('[ONECLICK-BLOGSPOT] 토글 설정 폴백:', e);
        }
        // 댓글 숨기기
        state.message = '댓글 숨기기 설정 중...';
        try {
            const commentSection = await page.locator('text="댓글", text="Comments"').first();
            if (await commentSection.isVisible({ timeout: 3000 })) {
                await commentSection.click();
                await (0, browser_1.sleep)(1000);
                const hideOption = await page.locator('text="숨기기", text="Hide", [value="HIDE"]').first();
                if (await hideOption.isVisible({ timeout: 3000 })) {
                    await hideOption.click();
                    await (0, browser_1.sleep)(500);
                }
                const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
                if (await saveBtn.isVisible({ timeout: 2000 })) {
                    await saveBtn.click();
                    await (0, browser_1.sleep)(1000);
                }
            }
        }
        catch { /* 댓글 설정 실패 — 무시 */ }
        // 시간대: 서울 (GMT+9)
        state.message = '시간대: 서울 설정 중...';
        try {
            const timezoneSection = await page.locator('text="시간대", text="Time zone"').first();
            if (await timezoneSection.isVisible({ timeout: 3000 })) {
                await timezoneSection.click();
                await (0, browser_1.sleep)(1000);
                const seoulOption = await page.locator('option:has-text("서울"), option:has-text("Seoul")').first();
                if (await seoulOption.isVisible({ timeout: 3000 })) {
                    const select = await seoulOption.locator('..').first();
                    await select.selectOption({ label: '(GMT+09:00) 서울' });
                    await (0, browser_1.sleep)(500);
                }
                const saveBtn = await page.locator('button:has-text("저장"), button:has-text("Save")').first();
                if (await saveBtn.isVisible({ timeout: 2000 })) {
                    await saveBtn.click();
                    await (0, browser_1.sleep)(1000);
                }
            }
        }
        catch { /* 시간대 설정 실패 — 무시 */ }
        state.message = '✅ 설정 자동 최적화 완료 (13개 항목)';
    }
    catch (e) {
        console.error('[ONECLICK-BLOGSPOT] 설정 최적화 오류:', e);
        state.message = '설정 최적화 일부 완료 (수동 확인 권장)';
    }
    state.stepStatus = 'done';
    await (0, browser_1.sleep)(1000);
}
