const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('image Flow and Dropshot UI regression guard', () => {
  test('image generation tab exposes a manual Flow login status check button', () => {
    const index = read('electron/ui/index.html');
    const script = read('electron/ui/script.js');

    expect(index).toContain('id="batchImageFxStatusCheckBtn"');
    expect(index).toContain('id="batchImageFxQuickLoginWrap"');
    expect(index).toContain('id="batchImageFxQuickLoginBtn"');
    expect(index).toContain('FLOW 로그인하기');
    expect(index).toContain('로그인상태 확인하기');
    expect(index).toContain('window.checkFlowLoginStatusNow');
    expect(script).toContain('window.checkFlowLoginStatusNow = async function');
    expect(script).toContain("document.getElementById('batchImageFxQuickLoginWrap')");
    expect(script).toContain("document.getElementById('batchImageFxQuickLoginBtn')");
    expect(script).toContain('autoLogin !== false');
    expect(script).toContain('autoLogin && !window.__imagefxAutoLoginTried');
  });

  test('platform selection cards keep full platform colors instead of dark overlays', () => {
    const index = read('electron/ui/index.html');

    expect(index).toContain('window.__paintPlatformSelectionCards');
    expect(index).toContain('#fff176');
    expect(index).toContain('#7dd3fc');
    expect(index).toContain('#fed7aa');
    expect(index).toContain('box.style.background = c.gradient');
    expect(index).not.toContain("box.style.background = selected ? c.gradient : 'rgba(15, 23, 42, 0.4)'");
    expect(index).not.toContain("background: rgba(15, 23, 42, 0.4); transition: all 0.2s; opacity: 0.55; position: relative;'");
  });

  test('Dropshot prompt input discovery supports modern editor variants', () => {
    const dropshot = read('src/core/dropshotGenerator.ts');

    expect(dropshot).toContain('const PROMPT_SELECTORS = [');
    expect(dropshot).toContain('[role="textbox"]');
    expect(dropshot).toContain('[data-slate-editor="true"]');
    expect(dropshot).toContain('.ProseMirror');
    expect(dropshot).toContain('Dropshot 프롬프트 입력창을 찾지 못했습니다 (${diagnostics})');
  });

  test('Dropshot login status treats unknown subscription as a warning, not completion', () => {
    const script = read('electron/ui/script.js');
    const queue = read('electron/ui/modules/publish-queue.js');
    const spider = read('electron/ui/modules/internal-links.js');
    const main = read('electron/main.ts');
    const dropshot = read('src/core/dropshotGenerator.ts');

    expect(script).toContain('window.normalizeDropshotLoginStatus = function');
    expect(script).toContain('플랜 확인 필요');
    expect(script).toContain('실행 준비 완료 · 플랜 확인 필요');
    expect(script).not.toContain('로그인 완료 (구독 정보 미확인)');
    expect(script).not.toContain('Dropshot 플랜 API가 응답하지 않았지만 로그인 세션은 확인됐습니다.');
    expect(queue).toContain('getDropshotQueueLoginLabel');
    expect(queue).toContain('플랜 확인 필요');
    expect(spider).toContain('getSpiderDropshotSubscriptionNote');
    expect(spider).toContain('로그인 세션만 확인됨');
    expect(main).toContain('normalizeDropshotIpcStatus');
    expect(main).toContain('플랜 확인 필요');
    expect(dropshot).toContain('subscriptionKnown?: boolean');
    expect(dropshot).toContain('subscriptionLabel?: string');
    expect(dropshot).toContain('플랜 확인 필요');
    expect(queue).not.toContain("r.subscription || 'unknown'");
  });

  test('Dropshot closes the entire browser process safely and skips visible login when already authenticated', () => {
    const dropshot = read('src/core/dropshotGenerator.ts');

    expect(dropshot).toContain('async function closeDropshotContext');
    expect(dropshot).toContain('const browser = typeof context.browser === \'function\' ? context.browser() : null;');
    expect(dropshot).toContain('await browser.close();');
    expect(dropshot).not.toContain('page?.close?.({ runBeforeUnload: false })');
    expect(dropshot).toContain('async function getDropshotSessionInfo');
    expect(dropshot).toContain('const preCheck = await checkDropshotLogin({ force: true })');
    expect(dropshot).toContain('if (preCheck.loggedIn)');
    expect(dropshot).toContain('이미 로그인되어 있습니다.');
    expect(dropshot).toContain('await closeDropshotContext(context)');
    expect(dropshot.match(/await context\.close\(\);/g) || []).toHaveLength(1);
  });

  test('Dropshot visible login detects blank browser content, retries without clearing cookies, and always closes the context', () => {
    const dropshot = read('src/core/dropshotGenerator.ts');

    expect(dropshot).toContain('async function inspectDropshotLoginSurface');
    expect(dropshot).toContain('async function waitForDropshotLoginSurface');
    expect(dropshot).toContain('async function openDropshotLoginSurface');
    expect(dropshot).toContain('Network.clearBrowserCache');
    expect(dropshot).not.toContain("'Network.clearBrowserCookies'");
    expect(dropshot).toContain('await openDropshotLoginSurface(page)');
    expect(dropshot).toContain('finally {\n    if (context) await closeDropshotContext(context);');
  });

  test('Dropshot generation waits long enough and detects modern result image URLs', () => {
    const dropshot = read('src/core/dropshotGenerator.ts');

    expect(dropshot).toContain('const DROPSHOT_RESULT_WAIT_MS = 210_000');
    expect(dropshot).toContain('async function findDropshotResultDataUrl');
    expect(dropshot).toContain("src.startsWith('blob:')");
    expect(dropshot).toContain('img.currentSrc');
    expect(dropshot).toContain("img.getAttribute('srcset')");
    expect(dropshot).toContain('backgroundImage');
    expect(dropshot).toContain('결과 대기 중...');
    expect(dropshot).toContain('결과 감지 진단');
    expect(dropshot).not.toContain('90초 내 결과 이미지 미발견');
    expect(dropshot).not.toContain('while ((Date.now() - startTs) < 85_000)');
  });

  test('Dropshot verifies an actual generation control and never treats prompt autocomplete as generate', () => {
    const dropshot = read('src/core/dropshotGenerator.ts');
    const main = read('electron/main.ts');
    const script = read('electron/ui/script.js');
    const queue = read('electron/ui/modules/publish-queue.js');

    expect(dropshot).toContain('async function resolveDropshotGenerateControl');
    expect(dropshot).toContain('자동완성');
    expect(dropshot).toContain('hasExplicitGenerateIntent');
    expect(dropshot).toContain('자동완성/추천 버튼은 실행하지 않았습니다');
    expect(dropshot).toContain('export async function verifyDropshotGenerationReady');
    expect(dropshot).toContain('const DROPSHOT_GENERATION_START_WAIT_MS');
    expect(dropshot).not.toContain('Enter fallback 실행');
    expect(main).toContain("ipcMain.handle('dropshot:verify-ready'");
    expect(script).toContain('window.verifyDropshotGenerationReady = async function');
    expect(script).toContain('실행 준비 완료');
    expect(queue).toContain('verifyDropshotGenerationReady');
  });

  test('renderer script remains valid JavaScript', () => {
    const script = read('electron/ui/script.js');

    expect(() => acorn.parse(script, {
      ecmaVersion: 'latest',
      sourceType: 'script',
    })).not.toThrow();
  });
});
