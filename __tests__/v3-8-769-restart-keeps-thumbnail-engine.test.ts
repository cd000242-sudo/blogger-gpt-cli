/**
 * v3.8.769 - Restarting Orbit must not flip the thumbnail engine back to nanobanana2.
 *
 * Field report (2026-11-10, 3 restarts): thumbnail gptimage2 -> nanobanana2 after every restart
 * (the sub-heading engine, which has remember/restore since v3.8.411, stayed).
 * Root cause, in electron/ui/script.js:
 *   1. Nothing saved the thumbnail choice. Only the sub-heading select had remember/restore.
 *   2. Startup stamped `bloggerSettings.thumbnailType = 'nanobanana2'` whenever it was missing, and
 *      loadSettings() writes that stamped value into the select on every launch. That also defeated the
 *      v3.8.766 new-install default (the HTML select starts on codex-image).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const acorn = require('acorn');
const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const NAMES = ['THUMB_ENGINE_KEY', 'rememberThumbnailType', 'restoreThumbnailType', 'handleThumbnailTypeChange'];

function loadFromScript(globals: Record<string, any>): Record<string, any> {
  const source = read('electron/ui/script.js');
  const body = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }).body;
  const code = NAMES.map((name) => {
    const node = body.find((n: any) => n.id?.name === name || n.declarations?.[0]?.id?.name === name);
    if (!node) throw new Error(`Missing production code: ${name}`);
    return source.slice(node.start, node.end);
  }).join('\n');
  vm.createContext(globals);
  vm.runInContext(`${code}\nthis.__out = { ${NAMES.join(', ')} };`, globals);
  return globals['__out'];
}

/** A fake renderer: persistent storage plus a thumbnail <select> that starts on the HTML default. */
function renderer(store: Map<string, string>, options = ['codex-image', 'nanobanana2', 'gptimage2', 'none'], disabled: string[] = []) {
  const select: any = {
    value: 'codex-image',
    options: options.map((value) => ({ value, disabled: disabled.includes(value) })),
  };
  const win: any = {};
  const globals: any = {
    console: { log: () => undefined, warn: () => undefined },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
    },
    document: { getElementById: (id: string) => (id === 'thumbnailType' ? select : null) },
    window: win,
  };
  const fns = loadFromScript(globals);
  return { fns, select, win };
}

describe('thumbnail engine is remembered across restarts', () => {
  test('a choice made in the select survives a restart', () => {
    const store = new Map<string, string>();
    const first = renderer(store);
    first.select.value = 'gptimage2';
    first.fns.handleThumbnailTypeChange('gptimage2');

    const afterRestart = renderer(store);            // fresh select = HTML default (codex-image)
    expect(afterRestart.select.value).toBe('codex-image');
    afterRestart.fns.restoreThumbnailType();
    expect(afterRestart.select.value).toBe('gptimage2');
  });

  test('nothing saved: the HTML default (codex-image, v3.8.766) is left alone', () => {
    const { fns, select } = renderer(new Map());
    fns.restoreThumbnailType();
    expect(select.value).toBe('codex-image');
  });

  test('a saved engine that no longer exists in the list is ignored', () => {
    const store = new Map([['leadernamThumbnailType', 'retired-engine']]);
    const { fns, select } = renderer(store);
    fns.restoreThumbnailType();
    expect(select.value).toBe('codex-image');
  });

  test('a saved engine that is now disabled is ignored', () => {
    const store = new Map([['leadernamThumbnailType', 'gptimage2']]);
    const { fns, select } = renderer(store, undefined, ['gptimage2']);
    fns.restoreThumbnailType();
    expect(select.value).toBe('codex-image');
  });

  test('the forced "none" from image-placement sync is not saved as the user choice', () => {
    const store = new Map([['leadernamThumbnailType', 'gptimage2']]);
    const { fns, win } = renderer(store);
    win.__syncingImagePlacementMode = true;
    fns.handleThumbnailTypeChange('none');
    expect(store.get('leadernamThumbnailType')).toBe('gptimage2');
  });

  test('restoring notifies the same change handler as a manual pick (notices, login cards)', () => {
    const store = new Map([['leadernamThumbnailType', 'gptimage2']]);
    const { fns, win } = renderer(store);
    const refresh = jest.fn();
    win.refreshEngineLoginCards = refresh;
    fns.restoreThumbnailType();
    expect(refresh).toHaveBeenCalled();
  });
});

describe('source locks', () => {
  const legacy = read('electron/ui/script.js');

  test('startup no longer stamps nanobanana2 over a missing thumbnail setting', () => {
    expect(legacy).not.toContain("settings.thumbnailType = 'nanobanana2'");
  });

  test('loadSettings re-applies the remembered engine after it writes saved values into the form', () => {
    const start = legacy.indexOf('async function loadSettings()');
    const end = legacy.indexOf('function toggleCollapsible', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(legacy.slice(start, end)).toContain('restoreThumbnailType()');
  });

  test('the module startup restores it next to the sub-heading engine', () => {
    const main = read('electron/ui/modules/main.js');
    expect(main).toContain('window.restoreThumbnailType()');
  });

  test('new installs still start on the Codex image engine', () => {
    const html = read('electron/ui/index.html');
    const select = html.slice(html.indexOf('<select id="thumbnailType"'), html.indexOf('</select>', html.indexOf('<select id="thumbnailType"')));
    expect(select).toContain('<option value="codex-image" selected>');
  });
});
