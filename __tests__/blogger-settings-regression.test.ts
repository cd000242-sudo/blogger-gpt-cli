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

    /**
     * v3.8.548 — 앵커 현행화. **지키려는 것은 그대로다.**
     *
     * 원래 사고(v3.8.304): platform 이 비면 무조건 WordPress 로 정하고 그것을
     * 저장까지 해서, Blogger 로 쓰던 사용자의 선택이 뒤집혔다.
     * 그때 진짜 해결책은 상수를 'blogger' 로 바꾼 것이 아니라
     * **증거를 보고 정하는 순서(resolvePlatformValue)를 만든 것**이었다.
     *
     * 사장님 지시로 "단서가 하나도 없을 때의 기본값"만 WordPress 로 바꿨다.
     * 그래서 이제 상수가 아니라 **순서와 증거 분기**를 고정한다 —
     * 이쪽이 원래 사고를 실제로 막는 조건이다.
     */
    expect(settings).toContain("if (savedRaw) return normalizePlatformValue(savedRaw, fallback)");   // ① 저장값 최우선
    expect(settings).toContain("if (envRaw) return normalizePlatformValue(envRaw, fallback)");       // ② 그다음 .env
    expect(settings).toContain("if (hasBloggerSettings(saved) || hasBloggerSettings(env)) return 'blogger'"); // ③ Blogger 연동값이 있으면 Blogger
    expect(settings).toContain("await storage.set('bloggerSettings', settings, true)");
    expect(settings).toContain("'BLOG_ID', 'BLOGGER_ID', 'GOOGLE_BLOG_ID', 'BLOGGER_BLOG_ID'");
    expect(settings).toContain("'GOOGLE_CLIENT_ID', 'BLOGGER_CLIENT_ID'");
    expect(settings).toContain("'GOOGLE_CLIENT_SECRET', 'BLOGGER_CLIENT_SECRET'");

    // Blogger 판정이 fallback 보다 **먼저** 나와야 한다 (순서가 뒤집히면 사고 재발)
    //   ⚠️ 파일 전체에서 'return fallback;' 을 찾으면 normalizePlatformValue 의 것이 먼저 걸린다.
    //      resolvePlatformValue 본문으로 범위를 좁힌다.
    const fnStart = settings.indexOf('function resolvePlatformValue');
    const fnEnd = settings.indexOf('async function loadEnvSettingsForRecovery', fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const resolveFn = settings.slice(fnStart, fnEnd);
    const bloggerIdx = resolveFn.indexOf('hasBloggerSettings(saved) || hasBloggerSettings(env)');
    const fallbackIdx = resolveFn.indexOf('return fallback;');
    expect(bloggerIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(bloggerIdx);
  });

  test('legacy UI script never stamps a clueless default over a Blogger setup', () => {
    const legacy = read('electron/ui/script.js');

    // v3.8.548: 상수 하나를 못 박는 대신 **증거 분기**를 고정한다.
    //   Blogger 연동값이 있으면 blogger — 이것이 v3.8.304 사고를 막는 조건이다.
    expect(legacy).toContain("settings.platform = hasBloggerCreds ? 'blogger' : 'wordpress';");
    expect(legacy).toContain("const rawPlatform = savedSettings.platform || 'blogger';");
    expect(legacy).toContain("return 'blogger';\n}");

    // ⭐ 단서 없이 고른 기본값을 저장소에 굳히면 안 된다 —
    //    굳는 순간 '사용자가 고른 값'이 되어 이후 .env·연동 판정이 전부 무력해진다.
    expect(legacy).toContain('if (hasBloggerCreds) {');
    expect(legacy).toContain('(!savedSettingsData || !savedSettingsData.platform) && hasPlatformEvidence');
    expect(legacy).not.toContain("const rawPlatform = savedSettings.platform || 'wordpress';");
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
