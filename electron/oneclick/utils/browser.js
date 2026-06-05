"use strict";
// electron/oneclick/utils/browser.ts
// Playwright 브라우저 런치 + sleep 유틸
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBrowserReadiness = checkBrowserReadiness;
exports.launchBrowser = launchBrowser;
exports.sleep = sleep;
exports.waitForPageStable = waitForPageStable;
exports.waitForVisible = waitForVisible;
exports.clickAndWait = clickAndWait;
const DEFAULT_CONFIG = {
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};
const PLAYWRIGHT_INSTALL_TIMEOUT_MS = 10 * 60 * 1000;
let chromiumInstallPromise = null;
function isMissingPlaywrightBrowserError(error) {
    const message = error instanceof Error ? error.message : String(error || '');
    return /Executable doesn't exist/i.test(message) && /playwright install/i.test(message);
}
function requirePlaywright() {
    try {
        return require('playwright');
    }
    catch {
        try {
            return require('playwright-core');
        }
        catch {
            throw new Error('Playwright is not available. Reinstall the app or run npm install playwright.');
        }
    }
}
function getLaunchArgs() {
    return [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
    ];
}
function getLaunchCandidates() {
    return [
        { label: 'Google Chrome', options: { channel: 'chrome' } },
        { label: 'Microsoft Edge', options: { channel: 'msedge' } },
        { label: 'Playwright Chromium', options: {} },
    ];
}
function resolveAsarUnpackedPath(filePath) {
    return filePath.includes('app.asar')
        ? filePath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
        : filePath;
}
function getPlaywrightCliPath() {
    try {
        const fs = require('fs');
        const path = require('path');
        const pkgPath = require.resolve('playwright/package.json');
        const cliPath = path.join(path.dirname(pkgPath), 'cli.js');
        const unpackedPath = resolveAsarUnpackedPath(cliPath);
        return fs.existsSync(unpackedPath) ? unpackedPath : cliPath;
    }
    catch {
        return null;
    }
}
function getInstallEnv(extra = {}) {
    return {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_GC: '1',
        ...extra,
    };
}
function runInstallCommand(command) {
    return new Promise((resolve) => {
        const { spawn } = require('child_process');
        let child = null;
        let output = '';
        let settled = false;
        let timer = null;
        const append = (chunk) => {
            output = `${output}${chunk.toString()}`;
            if (output.length > 5000)
                output = output.slice(-5000);
        };
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            if (timer)
                clearTimeout(timer);
            resolve(result);
        };
        try {
            child = spawn(command.command, command.args, {
                env: command.env,
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        }
        catch (error) {
            finish({ ok: false, detail: error instanceof Error ? error.message : String(error || '') });
            return;
        }
        timer = setTimeout(() => {
            try {
                child?.kill();
            }
            catch { /* ignore */ }
            finish({ ok: false, detail: 'Chromium 자동 설치가 시간 초과되었습니다.' });
        }, PLAYWRIGHT_INSTALL_TIMEOUT_MS);
        child.stdout?.on('data', append);
        child.stderr?.on('data', append);
        child.on('error', (error) => {
            finish({ ok: false, detail: error.message });
        });
        child.on('close', (code) => {
            if (code === 0) {
                finish({ ok: true, detail: 'Chromium 자동 설치 완료' });
            }
            else {
                finish({ ok: false, detail: output.trim() || `Playwright install exited with code ${code}` });
            }
        });
    });
}
async function installPlaywrightChromium() {
    const cliPath = getPlaywrightCliPath();
    const commands = [];
    if (cliPath) {
        commands.push({
            label: '앱 내 Playwright CLI',
            command: process.execPath,
            args: [cliPath, 'install', 'chromium'],
            env: getInstallEnv(process.versions?.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
        });
        commands.push({
            label: 'Node Playwright CLI',
            command: process.platform === 'win32' ? 'node.exe' : 'node',
            args: [cliPath, 'install', 'chromium'],
            env: getInstallEnv(),
        });
    }
    commands.push({
        label: 'npx Playwright installer',
        command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
        args: ['playwright', 'install', 'chromium'],
        env: getInstallEnv(),
    });
    let lastDetail = cliPath ? '' : 'Playwright CLI를 찾을 수 없습니다.';
    for (const command of commands) {
        const result = await runInstallCommand(command);
        if (result.ok) {
            return { ok: true, detail: `${command.label}: ${result.detail}` };
        }
        lastDetail = `${command.label}: ${result.detail}`;
    }
    return {
        ok: false,
        detail: lastDetail || 'Chromium 자동 설치를 완료하지 못했습니다.',
    };
}
function ensurePlaywrightChromiumInstalled() {
    if (!chromiumInstallPromise) {
        chromiumInstallPromise = installPlaywrightChromium().finally(() => {
            chromiumInstallPromise = null;
        });
    }
    return chromiumInstallPromise;
}
function getBrowserFixMessage() {
    return '인터넷 연결을 확인한 뒤 다시 누르세요. 계속 실패하면 Google Chrome 또는 Microsoft Edge를 설치하거나 앱 설치 폴더에서 npx playwright install chromium 명령을 1회 실행하세요.';
}
/**
 * Playwright Chromium 브라우저를 headful 모드로 실행한다.
 * Playwright는 런타임 동적 로딩 — 설치 여부를 여기서 검증한다.
 */
async function checkBrowserReadiness(autoInstall = true) {
    let pw;
    try {
        pw = requirePlaywright();
    }
    catch (error) {
        return {
            ok: false,
            detail: error instanceof Error ? error.message : String(error || ''),
            fix: 'Reinstall the app, then try one-click setup again.',
        };
    }
    let lastError = null;
    let installAttempted = false;
    for (const candidate of getLaunchCandidates()) {
        try {
            const browser = await pw.chromium.launch({
                headless: true,
                args: getLaunchArgs(),
                ...candidate.options,
            });
            await browser.close();
            return {
                ok: true,
                browser: candidate.label,
                detail: `${candidate.label} launch check passed`,
            };
        }
        catch (error) {
            lastError = error;
            if (autoInstall &&
                candidate.label === 'Playwright Chromium' &&
                !installAttempted &&
                isMissingPlaywrightBrowserError(error)) {
                installAttempted = true;
                const installResult = await ensurePlaywrightChromiumInstalled();
                if (installResult.ok) {
                    try {
                        const browser = await pw.chromium.launch({
                            headless: true,
                            args: getLaunchArgs(),
                            ...candidate.options,
                        });
                        await browser.close();
                        return {
                            ok: true,
                            browser: candidate.label,
                            detail: `${candidate.label} installed and launch check passed`,
                        };
                    }
                    catch (retryError) {
                        lastError = retryError;
                    }
                }
                else {
                    lastError = new Error(`${error instanceof Error ? error.message : String(error)}\n\nAuto install failed: ${installResult.detail}`);
                }
            }
        }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError || '');
    return {
        ok: false,
        detail,
        fix: getBrowserFixMessage(),
    };
}
async function launchBrowser(config) {
    let pw;
    try {
        pw = requirePlaywright();
    }
    catch (error) {
        throw new Error(`Playwright를 실행할 수 없습니다. 앱을 다시 설치한 뒤 실행해주세요.\n상세 오류: ${error instanceof Error ? error.message : String(error || '')}`);
    }
    const viewport = config?.viewport ?? DEFAULT_CONFIG.viewport;
    const userAgent = config?.userAgent ?? DEFAULT_CONFIG.userAgent;
    const onStatus = typeof config?.onStatus === 'function' ? config.onStatus : undefined;
    let browser = null;
    let lastError = null;
    let installAttempted = false;
    for (const candidate of getLaunchCandidates()) {
        try {
            browser = await pw.chromium.launch({
                headless: false,
                args: getLaunchArgs(),
                ...candidate.options,
            });
            console.log(`[ONECLICK-BROWSER] ${candidate.label} 실행 성공`);
            break;
        }
        catch (error) {
            lastError = error;
            console.warn(`[ONECLICK-BROWSER] ${candidate.label} 실행 실패:`, error instanceof Error ? error.message : error);
            if (candidate.label === 'Playwright Chromium' &&
                !installAttempted &&
                isMissingPlaywrightBrowserError(error)) {
                installAttempted = true;
                console.log('[ONECLICK-BROWSER] Playwright Chromium 누락 감지 → 자동 설치 시도');
                onStatus?.('자동화 브라우저 구성요소를 설치하는 중입니다. 첫 실행은 인터넷 상태에 따라 몇 분 걸릴 수 있습니다.');
                const installResult = await ensurePlaywrightChromiumInstalled();
                console.log(`[ONECLICK-BROWSER] ${installResult.detail}`);
                if (installResult.ok) {
                    onStatus?.('자동화 브라우저 설치가 완료되었습니다. 브라우저를 여는 중입니다...');
                    try {
                        browser = await pw.chromium.launch({
                            headless: false,
                            args: getLaunchArgs(),
                            ...candidate.options,
                        });
                        console.log('[ONECLICK-BROWSER] Playwright Chromium 자동 설치 후 실행 성공');
                        break;
                    }
                    catch (retryError) {
                        lastError = retryError;
                        console.warn('[ONECLICK-BROWSER] Playwright Chromium 자동 설치 후 실행 실패:', retryError instanceof Error ? retryError.message : retryError);
                    }
                }
                else {
                    lastError = new Error(`${error instanceof Error ? error.message : String(error)}\n\n자동 설치 실패: ${installResult.detail}`);
                }
            }
        }
    }
    if (!browser) {
        const detail = lastError instanceof Error ? lastError.message : String(lastError || '');
        throw new Error([
            '원클릭 세팅용 브라우저를 실행할 수 없습니다.',
            '',
            '해결 방법:',
            `1. ${getBrowserFixMessage()}`,
            '2. 회사/공용 PC에서 보안 프로그램이 다운로드를 막는 경우, 네트워크 제한을 풀고 다시 시도하세요.',
            '',
            `상세 오류: ${detail}`,
        ].join('\n'));
    }
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
