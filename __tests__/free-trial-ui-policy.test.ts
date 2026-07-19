const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('free trial publishing policy UI', () => {
  test('trial entry and quota fallbacks consistently advertise three completed publishes', () => {
    const login = read('electron/ui/login-window.html');
    const script = read('electron/ui/script.js');
    const settings = read('electron/ui/modules/settings.js');
    const legacyScript = read('src/ui/script.js');

    expect(login).toContain('발행 3회 무료체험하기');
    expect(login).not.toContain('매일 1회 무료체험하기');
    expect(script).toContain("var l = (qs.quota && qs.quota.limit) || 3;");
    expect(settings).toContain("const limit = (quotaStatus.quota && quotaStatus.quota.limit) || 3;");
    expect(legacyScript).toContain('const limit = status.quota?.limit || 3;');
    expect(legacyScript).toContain('const limit = quotaStatus.quota?.limit || 3;');
  });

  test('publishing may generate images during trial while standalone generation remains gated', () => {
    const license = read('src/utils/license-tier-manager.ts');
    const dispatcher = read('src/core/imageDispatcher.ts');
    const orchestration = read('src/core/final/orchestration.ts');
    const main = read('electron/main.ts');
    const workshop = read('electron/ui/modules/codex-workshop.js');

    expect(license).toContain('allowFreeTrialPublishing?: boolean');
    expect(license).toContain('if (options.allowFreeTrialPublishing === true)');
    expect(dispatcher).toContain('allowFreeTrialPublishing?: boolean');
    expect(dispatcher).toContain('allowFreeTrialPublishing: extra?.allowFreeTrialPublishing === true');
    expect(orchestration).toContain('checkImageGenAccess({ allowFreeTrialPublishing: true })');
    expect(orchestration).toContain('allowFreeTrialPublishing: true');
    expect(main).toContain('allowFreeTrialPublishing: payload?.publishContext === true');
    expect(workshop).toContain('publishContext: true');
  });

  test('normal posting forwards trial publishing context through Dropshot login readiness checks', () => {
    const main = read('electron/main.ts');
    const script = read('electron/ui/script.js');
    const index = read('electron/ui/index.html');

    expect(main).toContain('type DropshotAccessOptions = { force?: boolean; publishContext?: boolean };');
    expect(main.match(/allowFreeTrialPublishing: options\?\.publishContext === true/g)).toHaveLength(3);
    expect(script).toContain("invoke?.('dropshot:check-login', { force, publishContext })");
    expect(script).toContain("invoke?.('dropshot:verify-ready', { force, publishContext })");
    expect(script).toContain("invoke?.('dropshot:login', { publishContext })");
    expect(index).toContain('window.handleDropshotLogin({ publishContext: true })');
    expect(index).toContain('window.handleDropshotCheckLogin({ publishContext: true })');
  });

  test('standalone image generation and paid-only publishing modes do not inherit trial publishing access', () => {
    const script = read('electron/ui/script.js');
    const index = read('electron/ui/index.html');
    const queue = read('electron/ui/modules/publish-queue.js');
    const internalLinks = read('electron/ui/modules/internal-links.js');

    expect(script).toContain("window.runDropshotLogin = async function ()");
    expect(script).toContain("window.electronAPI?.invoke?.('dropshot:login');");
    expect(index).toContain('window.handleDropshotLogin && window.handleDropshotLogin()');
    expect(queue).toContain('window.verifyDropshotGenerationReady({ force: true })');
    expect(internalLinks).toContain('window.checkDropshotLoginCached({ force: true })');
  });

  test('saved queue entries do not disable detailed settings while single mode is selected', () => {
    const queue = read('electron/ui/modules/publish-queue.js');

    expect(queue).toContain("const queueActive = getCurrentMode() === 'bulk'");
    expect(queue).not.toContain('const queueActive = (STATE.keywords?.length || 0) > 0');
  });

  test('every purchase action opens the pricing page directly', () => {
    const ui = read('electron/ui/modules/ui.js');
    const script = read('electron/ui/script.js');
    const license = read('src/utils/license-tier-manager.ts');

    expect(ui).toContain("const purchaseUrl = 'https://leaderspro.kr/pricing';");
    expect(script).toContain("const DEFAULT_PAYMENT_URL = 'https://leaderspro.kr/pricing';");
    expect(license).toContain("const PAYMENT_URL = 'https://leaderspro.kr/pricing';");
  });
});
