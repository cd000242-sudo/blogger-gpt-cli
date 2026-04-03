"use strict";
// electron/oneclick/utils/browser.ts
// Playwright 브라우저 런치 + sleep 유틸
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchBrowser = launchBrowser;
exports.sleep = sleep;
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
