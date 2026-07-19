import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('header shortcut and stable single-click navigation', () => {
  test('golden keyword shortcut opens the Leaders Pro site through the Electron external browser API', () => {
    const index = read('electron/ui/index.html');
    const script = read('electron/ui/script.js');

    expect(index).toContain('id="goldenKeywordShortcut"');
    expect(index).toContain('type="button" class="golden-keyword-shortcut"');
    expect(index).toContain('황금키워드 보러가기');
    expect(script).toContain("const GOLDEN_KEYWORD_URL = 'https://leaderspro.kr/';");
    expect(script).toContain('window.electronAPI.openExternal(GOLDEN_KEYWORD_URL)');
    expect(script).toContain('goldenKeywordOpenLocked');
  });

  test('placeholder links and implicit submit buttons cannot jump the app to the top', () => {
    const script = read('electron/ui/script.js');
    const sidebar = read('electron/ui/modules/sidebar.js');

    expect(script).toContain("document.querySelectorAll('button:not([type])')");
    expect(script).toContain("target?.closest('a[href=\"#\"], a[href=\"\"]')");
    expect(script).toContain('if (placeholderLink) event.preventDefault();');
    expect(script).toContain("if (target && !target.hasAttribute('onclick'))");
    expect(script).toContain('if (this.initialized) return;');
    expect(sidebar).toContain("el.type = 'button';");
    expect(sidebar).toContain('event.preventDefault();');
    expect(sidebar).toContain('event.stopPropagation();');
  });
});
