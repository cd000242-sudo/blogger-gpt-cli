"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automateZumWebmaster = automateZumWebmaster;
const selectors_1 = require("../../config/selectors");
async function automateZumWebmaster(state, page, blogUrl) {
    const results = {};
    // 1) ZUM 웹마스터도구 열기
    state.message = 'ZUM 웹마스터도구 로딩 중...';
    await page.goto('https://webmaster.zum.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    // 2) 로그인 확인
    const loginBtnZum = await page.$(selectors_1.ZUM_SELECTORS.loginBtnKo) || await page.$(selectors_1.ZUM_SELECTORS.loginBtnClass) || await page.$(selectors_1.ZUM_SELECTORS.loginBtnSign);
    if (loginBtnZum) {
        await loginBtnZum.click();
        await page.waitForTimeout(2000);
        state.stepStatus = 'waiting-login';
        state.message = '🔐 ZUM 계정으로 로그인해주세요...';
        await page.waitForURL((url) => {
            const u = typeof url === 'string' ? url : url.toString();
            return u.includes('webmaster.zum.com') && !u.includes('login') && !u.includes('auth');
        }, { timeout: 300000 });
        state.stepStatus = 'running';
        state.message = '로그인 완료!';
        await page.waitForTimeout(3000);
    }
    if (state.cancelled)
        return;
    // 3) 사이트 등록
    state.message = '사이트 등록 중...';
    try {
        const siteInput = await page.$(selectors_1.ZUM_SELECTORS.siteInputUrl) || await page.$(selectors_1.ZUM_SELECTORS.siteInputType) || await page.$(selectors_1.ZUM_SELECTORS.siteInputText);
        if (siteInput) {
            await siteInput.fill(blogUrl);
            await page.waitForTimeout(500);
            const addBtn = await page.$(selectors_1.ZUM_SELECTORS.registerBtn) || await page.$(selectors_1.ZUM_SELECTORS.addBtn) || await page.$(selectors_1.ZUM_SELECTORS.submitBtn);
            if (addBtn) {
                await addBtn.click();
                await page.waitForTimeout(5000);
            }
            results['사이트 등록'] = true;
        }
        else {
            results['사이트 등록'] = false;
        }
    }
    catch {
        results['사이트 등록'] = false;
    }
    if (state.cancelled)
        return;
    // 4) RSS 등록
    state.message = 'RSS 피드 등록 중...';
    try {
        // RSS 메뉴 탐색
        const rssLink = await page.$(selectors_1.ZUM_SELECTORS.rssLink) || await page.$(selectors_1.ZUM_SELECTORS.rssLinkHref);
        if (rssLink) {
            await rssLink.click();
            await page.waitForTimeout(3000);
        }
        const rssInput = await page.$(selectors_1.ZUM_SELECTORS.rssInput) || await page.$(selectors_1.ZUM_SELECTORS.rssInputPlaceholder);
        if (rssInput) {
            let rssUrl = blogUrl.endsWith('/') ? blogUrl : blogUrl + '/';
            if (blogUrl.includes('tistory.com')) {
                rssUrl += 'rss';
            }
            else if (blogUrl.includes('blogspot.com')) {
                rssUrl += 'feeds/posts/default?alt=rss';
            }
            else {
                rssUrl += 'feed';
            }
            await rssInput.fill(rssUrl);
            await page.waitForTimeout(500);
            const submitBtn = await page.$(selectors_1.ZUM_SELECTORS.rssRegisterBtn) || await page.$(selectors_1.ZUM_SELECTORS.rssConfirmBtn) || await page.$(selectors_1.ZUM_SELECTORS.rssSubmitBtn);
            if (submitBtn) {
                await submitBtn.click();
                await page.waitForTimeout(3000);
            }
            results['RSS 등록'] = true;
        }
        else {
            results['RSS 등록'] = false;
        }
    }
    catch {
        results['RSS 등록'] = false;
    }
    if (state.cancelled)
        return;
    // 5) 수집 요청
    state.message = '수집 요청 중...';
    try {
        const reqLink = await page.$(selectors_1.ZUM_SELECTORS.crawlLink) || await page.$(selectors_1.ZUM_SELECTORS.crawlLinkHref) || await page.$(selectors_1.ZUM_SELECTORS.crawlLinkHref2);
        if (reqLink) {
            await reqLink.click();
            await page.waitForTimeout(3000);
        }
        const reqInput = await page.$(selectors_1.ZUM_SELECTORS.reqInput);
        if (reqInput) {
            await reqInput.fill(blogUrl);
            await page.waitForTimeout(500);
            const reqBtn = await page.$(selectors_1.ZUM_SELECTORS.reqBtn) || await page.$(selectors_1.ZUM_SELECTORS.reqBtnFallback) || await page.$(selectors_1.ZUM_SELECTORS.reqBtnSubmit);
            if (reqBtn) {
                await reqBtn.click();
                await page.waitForTimeout(3000);
            }
            results['수집 요청'] = true;
        }
        else {
            results['수집 요청'] = false;
        }
    }
    catch {
        results['수집 요청'] = false;
    }
    state.results = results;
}
