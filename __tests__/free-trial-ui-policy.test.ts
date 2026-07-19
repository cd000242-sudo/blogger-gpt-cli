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

  test('saved queue entries do not disable detailed settings while single mode is selected', () => {
    const queue = read('electron/ui/modules/publish-queue.js');

    expect(queue).toContain("const queueActive = getCurrentMode() === 'bulk'");
    expect(queue).not.toContain('const queueActive = (STATE.keywords?.length || 0) > 0');
  });
});
