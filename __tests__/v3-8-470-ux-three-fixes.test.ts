/**
 * v3.8.470 — 사용자 보고 3건
 *
 *   ① "왜 가끔식 아무버튼누르면 마음대로 워드프레스 연동 모달이 왜자꾸뜨는거니?"
 *   ② "구매하고나면 껏다 켜서 라이선스코드등록하는게아니고 바로 로그인하러가기하면
 *      무료체험 로그아웃되고 기존 로그인된 계정은 기존그대로 로그아웃버튼 놔두면되"
 *   ③ "가끔식 버튼이 안먹혀서 바탕화면 한번클릭하고 다시클릭하면 다시 버튼클릭되거나
 *      필드가 클릭되는데 왜그런거니??"
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const settings = read('electron/ui/modules/settings.js');
const main = read('electron/main.ts');
const preload = read('electron/preload.ts');
const authUtils = read('electron/auth-utils.ts');
const html = read('electron/ui/index.html');

describe('① 설정을 열면 플랫폼이 워드프레스로 튀던 문제', () => {
  /**
   * 원인: resolvePlatformValue() 가 저장값 → env → 설정 유무 순으로 제대로 판정해
   * 놓고는, 바로 아래에서 **blogger·tistory 가 아니면 무조건 wordpress** 로 덮었다.
   * 저장값을 못 읽었거나 비어 있으면 설정을 열 때마다 워드프레스 연동 화면이 떴다.
   */
  it('⭐⭐ 판정 결과를 그대로 쓴다 (덮어쓰지 않는다)', () => {
    expect(settings).toContain('KNOWN_PLATFORMS.includes(resolvedPlatform)');
    expect(settings).toContain('mergedSettings.platform = resolvedPlatform;');
  });

  it('⭐⭐ 예전의 무조건 wordpress 덮어쓰기가 사라졌다', () => {
    const code = settings.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    // "blogger 면 blogger, tistory 면 tistory, 나머지는 전부 wordpress" 형태가 없어야 한다
    expect(code).not.toMatch(/else\s*\{\s*mergedSettings\.platform\s*=\s*'wordpress';/);
  });

  it('⭐ 단서가 하나도 없을 때만 기본값을 쓰고, 화면 선택을 먼저 존중한다', () => {
    expect(settings).toContain("document.querySelector('input[name=\"platform\"]:checked')?.value");
    expect(settings).toContain('플랫폼 단서 없음');
  });
});

describe('② 구매 후 재시작 없이 로그인 화면으로', () => {
  it('⭐⭐ 무료 체험 해제 함수가 있다', () => {
    expect(authUtils).toContain('export function deactivateFreeTrial()');
  });

  it('⭐⭐ 전용 IPC 가 배선돼 있다 (없는 함수를 부르면 조용히 죽는다)', () => {
    expect(main).toContain("ipcMain.handle('auth:exit-free-trial'");
    expect(preload).toContain("exitFreeTrial: () => ipcRenderer.invoke('auth:exit-free-trial')");
    expect(html).toContain('window.__goLoginFromPaywall');
  });

  it('⭐⭐ 유료 계정은 건드리지 않는다 (기존 로그아웃 버튼 그대로)', () => {
    const handler = main.slice(
      main.indexOf("ipcMain.handle('auth:exit-free-trial'"),
      main.indexOf("ipcMain.handle('app-relaunch'"),
    );
    expect(handler).toContain('if (!isFreeTrial())');
    expect(handler).toContain("reason: 'not-free-trial'");
  });

  it('⭐⭐ 페이월에 로그인하러 가기 버튼이 있다', () => {
    const modal = html.slice(
      html.indexOf('function showPaywallModal()'),
      html.indexOf('window.__goLoginFromPaywall = async function'),
    );
    expect(modal).toContain('로그인하러 가기');
  });

  it('⭐ 유료 계정이 눌렀을 때 안내가 나온다', () => {
    expect(html).toContain('무료 체험 상태가 아닙니다');
  });
});

describe('③ 버튼이 한 번에 안 먹히던 문제', () => {
  /**
   * 원인: 발행 중에 보이는 브라우저 창이 열린다 — 쿠팡 상세 수집(실제 Chrome),
   * 네이버 로그인, 쇼핑 크롤, 드롭샷·이미지FX. 그 창이 OS 포커스를 가져간 뒤
   * 닫히면 앱 창은 되찾지 않았다(focus() 호출이 한 곳도 없었다).
   * 그래서 첫 클릭이 창 활성화에 쓰이고 사라진다.
   */
  it('⭐⭐ 포커스 복구 함수가 있다', () => {
    expect(main).toContain('function restoreMainWindowFocus()');
    expect(main).toContain('mainWindow.focus()');
  });

  it('⭐⭐ 발행 경로 세 곳 모두에서 복구한다 (한 곳만 하면 다른 경로에서 재발한다)', () => {
    const calls = main.match(/restoreMainWindowFocus\(\);/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(3);

    for (const handler of ["ipcMain.handle('run-post'", "ipcMain.handle('publish-content'", "ipcMain.handle('run-multi-account-post'"]) {
      const start = main.indexOf(handler);
      expect(start).toBeGreaterThan(-1);
      const body = main.slice(start, main.indexOf('\n});\n', start));
      expect(body).toContain('restoreMainWindowFocus();');
    }
  });

  it('⭐ 최소화해 둔 창을 억지로 띄우지 않는다 (사용자가 일부러 내린 것이다)', () => {
    const fn = main.slice(
      main.indexOf('function restoreMainWindowFocus()'),
      main.indexOf('function restoreMainWindowFocus()') + 600,
    );
    expect(fn).toContain('isMinimized()');
  });

  it('⭐ 창이 없거나 파괴됐어도 터지지 않는다', () => {
    const fn = main.slice(
      main.indexOf('function restoreMainWindowFocus()'),
      main.indexOf('function restoreMainWindowFocus()') + 600,
    );
    expect(fn).toContain('isDestroyed()');
    expect(fn).toContain('catch');
  });
});
