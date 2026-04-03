"use strict";
// electron/oneclick/automation/wordpressSetup.ts
// WordPress 원클릭 세팅
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWordPressSetup = runWordPressSetup;
const browser_1 = require("../utils/browser");
const skinLoader_1 = require("../utils/skinLoader");
/**
 * WordPress 원클릭 세팅 메인 함수.
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
async function runWordPressSetup(state, adminUrl, waitForLogin) {
    const { browser, page } = await (0, browser_1.launchBrowser)();
    state.browser = browser;
    state.page = page;
    try {
        // Step 0: 로그인
        state.currentStep = 0;
        state.stepStatus = 'running';
        state.message = 'WP 관리자 페이지로 이동 중...';
        const loginUrl = adminUrl.replace(/\/wp-admin\/?$/, '') + '/wp-login.php';
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        state.stepStatus = 'waiting-login';
        state.message = '워드프레스 관리자 계정으로 로그인해주세요';
        const loggedIn = await waitForLogin(state.platform);
        if (state.cancelled)
            return;
        state.currentStep = 0;
        state.stepStatus = 'done';
        state.message = '로그인 완료';
        await (0, browser_1.sleep)(1500);
        // Step 1: 테마 CSS 적용
        state.currentStep = 1;
        state.stepStatus = 'running';
        state.message = '추가 CSS 페이지로 이동 중...';
        try {
            const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
            await page.goto(`${baseUrl}/wp-admin/customize.php`, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await (0, browser_1.sleep)(3000);
            // "추가 CSS" 패널 클릭 시도
            try {
                const cssPanel = await page.locator('[id*="custom_css"], li:has-text("추가 CSS"), li:has-text("Additional CSS")').first();
                if (await cssPanel.isVisible({ timeout: 5000 })) {
                    await cssPanel.click();
                    await (0, browser_1.sleep)(2000);
                }
            }
            catch { /* 패널을 찾지 못함 */ }
            const skinCSS = (0, skinLoader_1.loadSkinCSS)('wordpress');
            if (skinCSS) {
                try {
                    const textarea = await page.locator('textarea.wp-editor-area, textarea[id*="custom-css"], .CodeMirror').first();
                    if (await textarea.isVisible({ timeout: 5000 })) {
                        // CodeMirror 에디터에 CSS 삽입
                        await page.evaluate((css) => {
                            const cm = document.querySelector('.CodeMirror')?.CodeMirror;
                            if (cm) {
                                const current = cm.getValue();
                                const marker = '/* === LEADERNAM CLOUD SKIN === */';
                                if (!current.includes(marker)) {
                                    cm.setValue(current + '\n\n' + marker + '\n' + css);
                                }
                            }
                        }, skinCSS);
                        state.message = 'CSS 적용 완료! "발행" 버튼을 눌러주세요.';
                    }
                }
                catch {
                    state.message = '커스터마이저를 열었습니다. "추가 CSS" 메뉴에서 수동으로 붙여넣기 해주세요.';
                }
            }
        }
        catch {
            state.message = '커스터마이저 페이지에서 수동으로 CSS를 적용해주세요.';
        }
        state.stepStatus = 'done';
        if (state.cancelled)
            return;
        // Step 2: 플러그인 설치
        state.currentStep = 2;
        state.stepStatus = 'running';
        state.message = '필수 플러그인 확인 중...';
        try {
            const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
            await page.goto(`${baseUrl}/wp-admin/plugin-install.php`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await (0, browser_1.sleep)(2000);
            state.message = '플러그인 페이지를 열었습니다. Classic Editor, Yoast SEO 설치를 권장합니다.';
        }
        catch {
            state.message = '플러그인 페이지로 이동했습니다.';
        }
        state.stepStatus = 'done';
        if (state.cancelled)
            return;
        // Step 3: 고유주소 설정
        state.currentStep = 3;
        state.stepStatus = 'running';
        state.message = '고유주소(퍼머링크) 설정 중...';
        try {
            const baseUrl = adminUrl.replace(/\/wp-admin\/?$/, '');
            await page.goto(`${baseUrl}/wp-admin/options-permalink.php`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await (0, browser_1.sleep)(2000);
            // "글 이름" 옵션 선택 시도
            try {
                const postNameRadio = await page.locator('input[value="/%postname%/"], input[name="selection"][value*="postname"]').first();
                if (await postNameRadio.isVisible({ timeout: 3000 })) {
                    await postNameRadio.click();
                    state.message = 'SEO 최적화 고유주소 설정 완료 (/%postname%/)';
                    // 저장 버튼 클릭
                    const saveBtn = await page.locator('#submit, input[type="submit"]').first();
                    if (await saveBtn.isVisible({ timeout: 3000 })) {
                        await saveBtn.click();
                        await (0, browser_1.sleep)(2000);
                    }
                }
            }
            catch {
                state.message = '고유주소 페이지를 열었습니다. "글 이름" 옵션을 선택해주세요.';
            }
        }
        catch {
            state.message = '고유주소 설정 페이지 확인 완료';
        }
        state.stepStatus = 'done';
        if (state.cancelled)
            return;
        // Step 4: 네이버 서치어드바이저 안내
        state.currentStep = 4;
        state.stepStatus = 'running';
        state.message = '네이버 서치어드바이저 등록 안내...';
        await (0, browser_1.sleep)(1000);
        state.message = '네이버 서치어드바이저에서 사이트를 등록해주세요';
        state.stepStatus = 'done';
        if (state.cancelled)
            return;
        // Step 5: 구글 서치 콘솔 안내
        state.currentStep = 5;
        state.stepStatus = 'running';
        state.message = '구글 서치 콘솔 등록 안내...';
        await (0, browser_1.sleep)(1000);
        state.message = '구글 서치 콘솔에서 사이트를 등록해주세요';
        state.stepStatus = 'done';
        state.completed = true;
    }
    catch (e) {
        state.error = e instanceof Error ? e.message : String(e);
        state.stepStatus = 'error';
    }
    finally {
        try {
            await browser?.close();
        }
        catch { /* ignore */ }
        state.browser = null;
        state.page = null;
    }
}
