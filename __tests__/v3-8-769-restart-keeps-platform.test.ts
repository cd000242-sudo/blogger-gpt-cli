/**
 * v3.8.769 - Restarting Orbit must not flip the publish platform back to Blogger.
 *
 * Field report (2026-11-10, 3 restarts): platform WordPress -> Blogger after every restart.
 * Evidence:
 *   - %APPDATA%/lba/.env holds BOTH `platform=blogger` (stale lowercase twin written by an old
 *     version) and `PLATFORM=wordpress` (what save-env updates today).
 *   - electron/ui/script.js startup merged the RAW .env map over the saved settings
 *     ({ ...savedSettings, ...envResult.data }) and wrote it back to localStorage, so the stale
 *     lowercase `platform` replaced the user's saved choice on every launch.
 *   - settings.js resolvePlatformValue also looked at lowercase `platform` before `PLATFORM`.
 *   - main.ts save-env never touched the lowercase twin, so it stayed stale forever.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const acorn = require('acorn');
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** Pull named top-level function declarations out of a renderer file and run them in a sandbox. */
function load(file: string, names: string[], sourceType: 'script' | 'module'): Record<string, any> {
  const source = read(file);
  const body = acorn.parse(source, { ecmaVersion: 'latest', sourceType }).body;
  const code = names.map((name) => {
    const node = body.map((n: any) => n.declaration || n).find((n: any) => n.id?.name === name);
    if (!node) throw new Error(`Missing production function: ${name} in ${file}`);
    return source.slice(node.start, node.end);
  }).join('\n');
  const context: any = {};
  vm.createContext(context);
  vm.runInContext(`${code}\nthis.__out = { ${names.join(', ')} };`, context);
  return context.__out;
}

// The user's real .env shape: stale lowercase twin + current uppercase key
const STALE_ENV = { platform: 'blogger', PLATFORM: 'wordpress', wordpressSiteUrl: 'https://example.com' };

describe('script.js - .env merged over saved settings', () => {
  const { mergeEnvOverSavedSettings } = load('electron/ui/script.js', ['mergeEnvOverSavedSettings'], 'script');

  test('the platform the user saved wins over a stale lowercase .env twin', () => {
    const merged = mergeEnvOverSavedSettings({ platform: 'wordpress', thumbnailType: 'gptimage2' }, STALE_ENV);
    expect(merged.platform).toBe('wordpress');
  });

  test('a saved Blogger choice is also kept (the rule is "saved first", not "WordPress first")', () => {
    const merged = mergeEnvOverSavedSettings({ platform: 'blogger' }, { PLATFORM: 'wordpress' });
    expect(merged.platform).toBe('blogger');
  });

  test('with no saved platform, the canonical PLATFORM key decides - not the stale twin', () => {
    expect(mergeEnvOverSavedSettings({}, STALE_ENV).platform).toBe('wordpress');
  });

  test('with no platform anywhere, none is invented', () => {
    expect(mergeEnvOverSavedSettings({ a: 1 }, { b: 2 }).platform).toBeUndefined();
  });

  test('credentials still follow the .env (that part of the merge is unchanged)', () => {
    const merged = mergeEnvOverSavedSettings({ wordpressPassword: 'old', platform: 'wordpress' }, { wordpressPassword: 'new' });
    expect(merged.wordpressPassword).toBe('new');
  });

  test('inputs are not mutated', () => {
    const saved = { platform: 'wordpress' };
    const env = { ...STALE_ENV };
    mergeEnvOverSavedSettings(saved, env);
    expect(saved).toEqual({ platform: 'wordpress' });
    expect(env).toEqual(STALE_ENV);
  });

  test('startup uses the helper instead of spreading the raw .env over the saved settings', () => {
    const legacy = read('electron/ui/script.js');
    expect(legacy).toContain('mergeEnvOverSavedSettings(savedSettings, envResult.data)');
    expect(legacy).not.toContain('{ ...savedSettings, ...envResult.data }');
  });
});

describe('settings.js - resolving the platform from .env', () => {
  const fns = load('electron/ui/modules/settings.js',
    ['normalizePlatformValue', 'pickSettingValue', 'hasBloggerSettings', 'hasWordPressSettings', 'resolvePlatformValue'],
    'module');

  test('canonical PLATFORM beats the stale lowercase twin', () => {
    expect(fns.resolvePlatformValue({}, STALE_ENV, 'wordpress')).toBe('wordpress');
    expect(fns.resolvePlatformValue({}, { platform: 'blogger', PLATFORM: 'tistory' }, 'wordpress')).toBe('tistory');
  });

  test('a lone lowercase platform (old .env without PLATFORM) is still honoured', () => {
    expect(fns.resolvePlatformValue({}, { platform: 'blogger' }, 'wordpress')).toBe('blogger');
  });

  test('the saved value still comes first', () => {
    expect(fns.resolvePlatformValue({ platform: 'tistory' }, STALE_ENV, 'wordpress')).toBe('tistory');
  });
});

describe('main.ts save-env - the stale twin is healed', () => {
  const main = read('electron/main.ts');
  const handler = main.slice(main.indexOf("ipcMain.handle('save-env'"));
  const body = handler.slice(0, handler.indexOf("ipcMain.handle(", 10));

  test('after writing PLATFORM, a lowercase platform key is kept in sync', () => {
    expect(body).toMatch(/envMap\.has\('platform'\)/);
    expect(body).toMatch(/envMap\.set\('platform',\s*envMap\.get\('PLATFORM'\)/);
  });
});
