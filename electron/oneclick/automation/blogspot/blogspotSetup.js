"use strict";
// electron/oneclick/automation/blogspot/blogspotSetup.ts
// Blogspot 원클릭 세팅 오케스트레이터
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBlogspotSetup = runBlogspotSetup;
const browser_1 = require("../../utils/browser");
const createBlog_1 = require("./steps/createBlog");
const optimizeSettings_1 = require("./steps/optimizeSettings");
const metaGaAds_1 = require("./steps/metaGaAds");
const faviconUpload_1 = require("./steps/faviconUpload");
const applySkinCSS_1 = require("./steps/applySkinCSS");
const searchConsole_1 = require("./steps/searchConsole");
/**
 * Blogspot 원클릭 세팅 메인 함수.
 * Step 0(로그인)~Step 7(완료)까지 순차 실행한다.
 *
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
async function runBlogspotSetup(state, adminUrl, blogspotConfig, waitForLogin) {
    const { browser, page } = await (0, browser_1.launchBrowser)();
    state.browser = browser;
    state.page = page;
    const config = blogspotConfig || {};
    console.log('[ONECLICK-BLOGSPOT] 📋 설정 데이터:', JSON.stringify(config, null, 2));
    try {
        // ─── Step 0: Google 로그인 ───
        state.currentStep = 0;
        state.stepStatus = 'running';
        state.message = 'Blogger 관리자 페이지로 이동 중...';
        await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        state.stepStatus = 'waiting-login';
        state.message = '에드센스 계정과 동일한 Google 계정으로 로그인해주세요';
        const loggedIn = await waitForLogin(state.platform);
        if (state.cancelled)
            return;
        if (!loggedIn) {
            // 🛡️ 로그인 타임아웃(5분 초과) 시 이후 단계로 넘어가지 않고 중단
            // (이전에는 반환값을 체크하지 않아 미로그인 상태로 createBlog가 실행되는 회귀 존재)
            state.error = '로그인 대기 시간이 초과되어 세팅을 중단합니다. 다시 시도해 주세요.';
            state.stepStatus = 'error';
            return;
        }
        state.currentStep = 0;
        state.stepStatus = 'done';
        state.message = '로그인 완료';
        await (0, browser_1.sleep)(2000);
        // ─── Step 1: 블로그 만들기 ───
        const blogId = await (0, createBlog_1.createBlog)(state, page, config);
        if (state.cancelled)
            return;
        // ─── Step 2: 설정 자동 최적화 (13개 항목) ───
        await (0, optimizeSettings_1.optimizeSettings)(state, page, blogId, config);
        if (state.cancelled)
            return;
        // ─── Step 3: 메타태그 · GA · ads.txt ───
        await (0, metaGaAds_1.setupMetaGaAds)(state, page, blogId, config);
        if (state.cancelled)
            return;
        // ─── Step 4: 파비콘 업로드 ───
        await (0, faviconUpload_1.uploadFavicon)(state, page, config);
        if (state.cancelled)
            return;
        // ─── Step 5: 클라우드 스킨 CSS 적용 ───
        await (0, applySkinCSS_1.applySkinCSS)(state, page, blogId);
        if (state.cancelled)
            return;
        // ─── Step 6: 구글 서치 콘솔 연동 ───
        await (0, searchConsole_1.setupSearchConsole)(state, page, blogId, config);
        if (state.cancelled)
            return;
        // ─── Step 7: 완료 ───
        state.currentStep = 7;
        state.stepStatus = 'done';
        state.message = '🎉 블로그스팟 세팅이 모두 완료되었습니다!';
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
