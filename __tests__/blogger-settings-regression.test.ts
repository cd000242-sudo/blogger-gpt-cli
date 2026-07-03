const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('Blogger settings regression guard', () => {
  test('settings module recovers Blogger platform and aliases from saved env values', () => {
    const settings = read('electron/ui/modules/settings.js');

    expect(() => acorn.parse(settings, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    })).not.toThrow();

    expect(settings).toContain("function normalizePlatformValue(value, fallback = 'blogger')");
    expect(settings).toContain("settings.platform = resolvePlatformValue(settings, envSettings, 'blogger')");
    expect(settings).toContain("await storage.set('bloggerSettings', settings, true)");
    expect(settings).toContain("'BLOG_ID', 'BLOGGER_ID', 'GOOGLE_BLOG_ID', 'BLOGGER_BLOG_ID'");
    expect(settings).toContain("'GOOGLE_CLIENT_ID', 'BLOGGER_CLIENT_ID'");
    expect(settings).toContain("'GOOGLE_CLIENT_SECRET', 'BLOGGER_CLIENT_SECRET'");
    expect(settings).toContain("platform: document.querySelector('input[name=\"platform\"]:checked')?.value || 'blogger'");
    expect(settings).not.toContain("platform: document.querySelector('input[name=\"platform\"]:checked')?.value || 'wordpress'");
  });

  test('legacy UI script no longer overwrites missing platform with WordPress', () => {
    const legacy = read('electron/ui/script.js');

    expect(legacy).toContain("settings.platform = 'blogger';");
    expect(legacy).toContain("const rawPlatform = savedSettings.platform || 'blogger';");
    expect(legacy).toContain("return 'blogger';\n}");
    expect(legacy).toContain("platform: document.querySelector('input[name=\"platform\"]:checked')?.value || 'blogger'");
    expect(legacy).not.toContain("const rawPlatform = savedSettings.platform || 'wordpress';");
    expect(legacy).not.toContain("플랫폼 기본값 설정: wordpress");
  });

  test('one-click setup exposes saved Blogger Blog ID and surfaces failed status responses', () => {
    const oneclick = read('electron/ui/modules/oneclick-setup.js');

    expect(() => acorn.parse(oneclick, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    })).not.toThrow();

    expect(oneclick).toContain('async function getSavedBloggerBlogId()');
    expect(oneclick).toContain("const creds = await getStoredBloggerOAuthSettings()");
    expect(oneclick).toContain("document.getElementById('bs-existing-id')");
    expect(oneclick).toContain('if (status.ok === false)');
    expect(oneclick).toContain("setSetupFailed(platformId, errorMessage)");
  });
});
