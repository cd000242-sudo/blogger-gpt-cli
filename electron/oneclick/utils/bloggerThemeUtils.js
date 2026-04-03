"use strict";
// electron/oneclick/utils/bloggerThemeUtils.ts
// Blogger 테마 HTML 편집 유틸
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertMetaTagToBloggerTheme = insertMetaTagToBloggerTheme;
const browser_1 = require("./browser");
/**
 * Blogger 테마 <head> 영역에 메타태그를 자동 삽입한다.
 * CodeMirror 에디터를 직접 조작하여 HTML을 수정한다.
 */
async function insertMetaTagToBloggerTheme(page, metaTag, blogId, label) {
    try {
        console.log(`[ONECLICK] 📌 Blogger 테마에 ${label} 메타태그 삽입 시도...`);
        // 테마 HTML 편집 페이지로 이동
        if (blogId) {
            await page.goto(`https://www.blogger.com/blog/theme/edit/${blogId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        }
        else {
            await page.goto('https://www.blogger.com/', {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
            });
            await (0, browser_1.sleep)(2000);
            // 사이드바에서 테마 클릭
            const themeLink = await page.$('a:has-text("테마"), a:has-text("Theme")');
            if (themeLink) {
                await themeLink.click();
                await (0, browser_1.sleep)(2000);
            }
            // HTML 편집 버튼
            const editHtmlBtn = await page.$('button:has-text("HTML 편집"), button:has-text("Edit HTML")');
            if (editHtmlBtn) {
                await editHtmlBtn.click();
                await (0, browser_1.sleep)(2000);
            }
        }
        await (0, browser_1.sleep)(3000);
        // CodeMirror 에디터에 메타태그 삽입 (<head> 바로 아래)
        const inserted = await page.evaluate((tag) => {
            const cm = document.querySelector('.CodeMirror')?.CodeMirror;
            if (!cm)
                return false;
            const currentContent = cm.getValue();
            // 이미 동일한 메타태그가 있으면 건너뛰기
            if (currentContent.includes(tag.trim()))
                return true;
            // <head> 바로 아래에 삽입
            const headMatch = currentContent.match(/<head[^>]*>/i);
            if (headMatch) {
                const insertPos = currentContent.indexOf(headMatch[0]) + headMatch[0].length;
                const newContent = currentContent.slice(0, insertPos) +
                    '\n' +
                    tag.trim() +
                    '\n' +
                    currentContent.slice(insertPos);
                cm.setValue(newContent);
                return true;
            }
            return false;
        }, metaTag);
        if (inserted) {
            // 저장 버튼 클릭
            await (0, browser_1.sleep)(1000);
            const saveBtn = await page.$('button[aria-label*="저장"], button[aria-label*="Save"], button:has-text("💾")');
            if (saveBtn) {
                try {
                    if (await saveBtn.isVisible({ timeout: 3000 })) {
                        await saveBtn.click();
                        await (0, browser_1.sleep)(3000);
                    }
                }
                catch {
                    /* 수동 저장 필요 */
                }
            }
            console.log(`[ONECLICK] ✅ ${label} 메타태그 삽입 완료`);
            return true;
        }
        console.log(`[ONECLICK] ⚠️ ${label} ���타태그 삽입 실패 — <head> 태그를 찾지 못함`);
        return false;
    }
    catch (e) {
        console.error(`[ONECLICK] ❌ ${label} 메타태그 삽입 오류:`, e);
        return false;
    }
}
