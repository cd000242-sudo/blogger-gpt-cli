"use strict";
// electron/oneclick/automation/blogspot/blogspotSetup.ts
// Blogspot 원클릭 세팅 오케스트레이터
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBlogspotSetup = runBlogspotSetup;
const browser_1 = require("../../utils/browser");
const createBlog_1 = require("./steps/createBlog");
const optimizeSettings_1 = require("./steps/optimizeSettings");
const applySkinCSS_1 = require("./steps/applySkinCSS");
const persistence_1 = require("../../state/persistence");
const bloggerSmartNavigator_1 = require("./bloggerSmartNavigator");
const SETUP_LOGIN_TIMEOUT_MS = 15 * 60 * 1000;
const LOGIN_POLL_MS = 1500;
async function ensureBloggerHomeSmart(state, page, reason = 'Blogger 화면 확인') {
    const landing = await (0, bloggerSmartNavigator_1.ensureBloggerLanding)(state, page, reason);
    if (landing.scan.kind.startsWith('blogger-')) {
        state.message = `${reason}: ${landing.scan.evidence.join(' / ') || landing.scan.url}`;
        return true;
    }
    state.message = `${reason}: Blogger 화면 검증 실패 - 현재 ${landing.scan.kind} / ${landing.scan.url || 'URL 없음'}`;
    return false;
}
async function ensureBloggerHome(state, page, reason = 'Blogger 화면으로 이동') {
    try {
        const url = page.url();
        const parsed = new URL(url);
        const isBlogger = /(^|\.)blogger\.com/i.test(parsed.hostname);
        if (isBlogger)
            return;
        state.message = `${reason} 중... Google 도움말/계정 화면이 열렸다면 앱이 자동으로 Blogger로 되돌립니다.`;
        await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        try {
            await page.waitForLoadState?.('networkidle', { timeout: 8000 });
        }
        catch { /* Blogger는 계속 통신할 수 있어 허용 */ }
        await (0, browser_1.sleep)(2500);
    }
    catch {
        // 다음 단계에서 다시 Blogger URL로 직접 이동하므로 여기서는 막지 않는다.
    }
}
async function waitForBloggerLoginOrReady(state, page, waitForLogin) {
    const manual = waitForLogin(state.platform, SETUP_LOGIN_TIMEOUT_MS);
    const auto = (async () => {
        const deadline = Date.now() + SETUP_LOGIN_TIMEOUT_MS;
        while (Date.now() < deadline) {
            if (state.cancelled)
                return false;
            try {
                const url = page.url();
                const parsed = new URL(url);
                const isGoogleLogin = /accounts\.google\.com|signin|ServiceLogin/i.test(url);
                const isBlogger = /(^|\.)blogger\.com/i.test(parsed.hostname);
                if (isBlogger && !isGoogleLogin) {
                    const landing = await (0, bloggerSmartNavigator_1.ensureBloggerLanding)(state, page, 'Blogger 로그인 완료 화면을 검증합니다');
                    if (landing.scan.kind.startsWith('blogger-') && landing.scan.evidence.length > 0) {
                        state.message = `Blogger 로그인 검증 완료: ${landing.scan.evidence.join(' / ')}`;
                        return true;
                    }
                }
                const isGoogleHelpOrAccount = /(^|\.)support\.google\.com$|(^|\.)myaccount\.google\.com$/i.test(parsed.hostname);
                if (isGoogleHelpOrAccount) {
                    const looksSignedIn = await page.evaluate(() => {
                        const text = document.body?.innerText || '';
                        return Boolean(document.querySelector('[aria-label*="Google 계정"], [aria-label*="Google Account"], a[href*="myaccount.google.com"]')
                            || /Google 계정|Google Account/.test(text));
                    }).catch(() => false);
                    if (looksSignedIn) {
                        await ensureBloggerHomeSmart(state, page, 'Google 로그인 확인 후 Blogger 화면으로 자동 복귀');
                        continue;
                    }
                }
                const landing = await (0, bloggerSmartNavigator_1.ensureBloggerLanding)(state, page, 'Blogger 화면 구조를 검증합니다');
                if (landing.scan.kind.startsWith('blogger-') && landing.scan.evidence.length > 0) {
                    state.message = `Blogger 화면 검증 완료: ${landing.scan.evidence.join(' / ')}`;
                    return true;
                }
            }
            catch {
                // User may still be inside the Google login flow.
            }
            await (0, browser_1.sleep)(LOGIN_POLL_MS);
        }
        return false;
    })();
    return Promise.race([manual, auto]);
}
/**
 * Blogspot 원클릭 세팅 메인 함수.
 * 발행에 필수인 OAuth/Blog ID는 앱 연동 플로우에서 처리한다.
 * 이 플로우는 블로그 생성/기초 설정만 순차 실행한다.
 *
 * waitForLogin은 외부에서 주입받아 IPC 기반 로그인 대기를 수행한다.
 */
async function runBlogspotSetup(state, adminUrl, blogspotConfig, waitForLogin) {
    const { browser, page } = await (0, browser_1.launchBrowser)();
    state.browser = browser;
    state.page = page;
    const config = blogspotConfig || {};
    console.log('[ONECLICK-BLOGSPOT] 📋 설정 데이터:', JSON.stringify(config, null, 2));
    // Step 단위 재시작 지원 — resumeFromStep이 지정되면 그 step부터 실행
    const resumeFrom = typeof state.resumeFromStep === 'number' ? state.resumeFromStep : 0;
    if (!state.stepResults)
        state.stepResults = [];
    const recordStep = (index, label, ok, message) => {
        if (!state.stepResults)
            state.stepResults = [];
        const existing = state.stepResults.findIndex(r => r.index === index);
        const entry = { index, label, ok, message };
        if (existing >= 0)
            state.stepResults[existing] = entry;
        else
            state.stepResults.push(entry);
        // 🗂️ 각 step 결과마다 체크포인트 저장 (재시작 후 재개 지원)
        try {
            (0, persistence_1.saveCheckpoint)(state, config);
        }
        catch { /* 무시 */ }
    };
    try {
        // ─── Step 0: Google 로그인 ───
        if (resumeFrom <= 0) {
            state.currentStep = 0;
            state.stepStatus = 'running';
            state.message = 'Blogger 관리자 페이지로 이동 중...';
            await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            state.stepStatus = 'waiting-login';
            state.message = '🪟 새로 열린 브라우저 창에서 Google 계정(애드센스와 동일한 계정 권장)으로 로그인한 뒤, 앱 화면의 "✅ 로그인 완료" 버튼을 눌러주세요. (5분 이내, 예상 전체 소요 5~15분)';
            const loggedIn = await waitForBloggerLoginOrReady(state, page, waitForLogin);
            if (state.cancelled)
                return;
            if (!loggedIn) {
                state.error = '로그인 대기 시간이 초과되어 세팅을 중단합니다. 다시 시도해 주세요.';
                state.stepStatus = 'error';
                recordStep(0, 'Google 로그인', false, state.error);
                return;
            }
            const bloggerReady = await ensureBloggerHomeSmart(state, page, '로그인 완료 확인 후 Blogger 화면으로 자동 이동');
            if (!bloggerReady) {
                state.error = state.message || 'Blogger 화면 검증에 실패했습니다. 열린 Chrome 창이 Blogger 대시보드인지 확인한 뒤 다시 시도해 주세요.';
                state.stepStatus = 'error';
                recordStep(0, 'Google 로그인', false, state.error);
                return;
            }
            state.currentStep = 0;
            state.stepStatus = 'done';
            state.message = '로그인 완료';
            recordStep(0, 'Google 로그인', true, '로그인 완료');
            await (0, browser_1.sleep)(2000);
        }
        // ─── Step 1: 블로그 만들기 ───
        let blogId = config.existingBlogId || '';
        if (resumeFrom <= 1) {
            blogId = await (0, createBlog_1.createBlog)(state, page, config);
            if (state.cancelled)
                return;
            recordStep(1, '블로그 확인/생성', !!blogId && state.stepStatus !== 'error', state.message || (blogId ? `blogId=${blogId}` : '실패'));
            if (!blogId || state.stepStatus === 'error') {
                state.error = state.error || state.message || 'Blog ID 확인 실패 — 다음 단계로 진행할 수 없습니다.';
                state.stepStatus = 'error';
                return;
            }
        }
        // ─── Step 2: 기본 설정 자동 최적화 ───
        if (resumeFrom <= 2) {
            await (0, optimizeSettings_1.optimizeSettings)(state, page, blogId, config);
            if (state.cancelled)
                return;
            recordStep(2, '기초 설정 자동 최적화', state.stepStatus !== 'error', state.message);
            if (state.stepStatus === 'error') {
                state.error = state.error || state.message || 'Blogger 설정 화면 검증 또는 자동 최적화에 실패했습니다.';
                return;
            }
        }
        // ─── Step 3: 클라우드 스킨 CSS 적용 ───
        if (resumeFrom <= 3) {
            await (0, applySkinCSS_1.applySkinCSS)(state, page, blogId);
            if (state.cancelled)
                return;
            recordStep(3, '스킨 CSS 적용', state.stepStatus !== 'error', state.message);
            if (state.stepStatus === 'error') {
                state.error = state.error || state.message || 'Blogger 스킨 CSS 적용 검증에 실패했습니다.';
                return;
            }
        }
        // ─── Step 4: 완료 ───
        state.currentStep = 4;
        state.stepStatus = 'done';
        state.message = '🎉 블로그스팟 기초 세팅이 완료되었습니다. 발행은 앱 연동에서 OAuth와 Blog ID를 완료하면 가능합니다.';
        state.completed = true;
        recordStep(4, '완료', true, state.message);
        try {
            (0, persistence_1.clearCheckpoint)(state.platform);
        }
        catch { /* 무시 */ }
    }
    catch (e) {
        state.error = e instanceof Error ? e.message : String(e);
        state.stepStatus = 'error';
        recordStep(state.currentStep ?? -1, `step ${state.currentStep} 예외`, false, state.error);
    }
    finally {
        const closeDelayMs = state.cancelled
            ? 0
            : (state.stepStatus === 'error' || state.error ? 5 * 60 * 1000 : 10 * 60 * 1000);
        setTimeout(async () => {
            try {
                await browser?.close();
            }
            catch { /* ignore */ }
        }, closeDelayMs);
        state.browser = null;
        state.page = null;
    }
}
