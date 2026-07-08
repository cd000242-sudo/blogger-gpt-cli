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

  test('renderer script remains valid JavaScript', () => {
    const script = read('electron/ui/script.js');

    expect(() => acorn.parse(script, {
      ecmaVersion: 'latest',
      sourceType: 'script',
    })).not.toThrow();
  });
});
