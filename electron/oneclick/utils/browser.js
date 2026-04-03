"use strict";
// electron/oneclick/utils/browser.ts
// Playwright 브라우저 런치 + sleep 유틸
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchBrowser = launchBrowser;
exports.sleep = sleep;
exports.waitForPageStable = waitForPageStable;
exports.waitForVisible = waitForVisible;
exports.clickAndWait = clickAndWait;
const DEFAULT_CONFIG = {
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
/**
 * Playwright Chromium 브라우저를 headful 모드로 실행한다.
 * Playwright는 런타임 동적 로딩 — 설치 여부를 여기서 검증한다.
 */
async function launchBrowser(config) {
    let pw;
    try {
        pw = require('playwright');
    }
    catch {
        try {
            pw = require('playwright-core');
        }
        catch {
            throw new Error('Playwright를 실행할 수 없습니다. npm install playwright 를 실행하세요.');
        }
    }
    const viewport = config?.viewport ?? DEFAULT_CONFIG.viewport;
    const userAgent = config?.userAgent ?? DEFAULT_CONFIG.userAgent;
    const browser = await pw.chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
        ],
    });
    const context = await browser.newContext({ viewport, userAgent });
    const page = await context.newPage();
    return { browser, page };
}
/** 지정 밀리초 동안 대기 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * 페이지 이동 후 안정화 대기.
 * networkidle 대기를 시도하고, 실패하면 fallback sleep을 실행한다.
 */
async function waitForPageStable(page, fallbackMs = 2000) {
    try {
        await page.waitForLoadState('networkidle', { timeout: fallbackMs + 3000 });
    }
    catch {
        // networkidle 타임아웃 시 fallback sleep
        await sleep(fallbackMs);
    }
}
/**
 * 셀렉터가 보일 때까지 대기.
 * 타임아웃 시 false를 반환하며 예외를 던지지 않는다.
 */
async function waitForVisible(page, selector, timeout = 5000) {
    try {
        const el = await page.locator(selector).first();
        await el.waitFor({ state: 'visible', timeout });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * 요소를 찾아서 클릭하고, 지정 셀렉터가 나타날 때까지 대기한다.
 * 클릭 후 sleep 대신 사용한다.
 */
async function clickAndWait(page, clickSelector, waitSelector, timeout = 5000) {
    try {
        const btn = await page.locator(clickSelector).first();
        if (await btn.isVisible({ timeout: 3000 })) {
            await btn.click();
            if (waitSelector) {
                return await waitForVisible(page, waitSelector, timeout);
            }
            return true;
        }
        return false;
    }
    catch {
        return false;
    }
}
