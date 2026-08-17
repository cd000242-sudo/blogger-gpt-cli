/**
 * v3.8.519 — Windows Electron 포커스 버그 3계층 가드 회귀 테스트
 *
 * 증상(사장님 보고): 네이티브 팝업·파일 선택창이 닫힌 뒤 버튼·입력이 먹통.
 * 바탕화면을 클릭해 포커스를 잃었다 되찾으면 정상화 → 입력 라우팅이 어긋난 상태.
 *
 * 이 테스트는 3계층 배선 중 **하나라도 끊기면 터진다**:
 *   ① 렌더러: alert/confirm/prompt 래핑 (원본 반환값 보존 + 50ms 디바운스 재포커스)
 *   ② 메인: window:refocus 핸들러(blur→focus) + 보이지 않을 때 금지 + dialog 래핑
 *   ③ 부트스트랩: index.html 최상단 로드 + preload 브리지 (+ 빌드 산출물 반영)
 *
 * ① 은 문자열 검사가 아니라 **실제로 실행해서** 검증한다.
 * 이 저장소에서 문자열 일치 테스트가 버그를 그대로 통과시킨 전례가 있다.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const GUARD_SRC = 'electron/ui/modules/focus-guard.js';

type FakeEnv = {
  window: any;
  document: any;
  refocusCalls: string[];
  fire: (target: 'window' | 'document', type: string, event?: any) => void;
};

/** focus-guard.js 를 진짜로 실행시키는 최소 렌더러 환경 */
function installGuard(options: { bridge?: boolean; invoke?: boolean } = {}): FakeEnv {
  const { bridge = true, invoke = true } = options;
  const refocusCalls: string[] = [];
  const winListeners: Record<string, Function[]> = {};
  const docListeners: Record<string, Function[]> = {};

  const window: any = {
    alert: (msg: any) => { window.__alertArgs = msg; return undefined; },
    confirm: (msg: any) => { window.__confirmArgs = msg; return window.__confirmReturn; },
    prompt: (msg: any) => { window.__promptArgs = msg; return window.__promptReturn; },
    __confirmReturn: false,
    __promptReturn: null,
    addEventListener: (type: string, fn: Function) => {
      (winListeners[type] = winListeners[type] || []).push(fn);
    },
    setTimeout, clearTimeout,
  };
  if (bridge) window.focusGuard = { refocus: () => { refocusCalls.push('bridge'); } };
  if (invoke) window.electronAPI = { invoke: (ch: string) => { refocusCalls.push('invoke:' + ch); } };

  const document: any = {
    addEventListener: (type: string, fn: Function) => {
      (docListeners[type] = docListeners[type] || []).push(fn);
    },
  };

  const context = vm.createContext({ window, document, setTimeout, clearTimeout, console });
  vm.runInContext(read(GUARD_SRC), context, { filename: 'focus-guard.js' });

  return {
    window, document, refocusCalls,
    fire: (target, type, event = {}) => {
      const bag = target === 'window' ? winListeners : docListeners;
      (bag[type] || []).forEach((fn) => fn(event));
    },
  };
}

const settle = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const fileInput = () => ({ target: { tagName: 'INPUT', type: 'file' } });

describe('① 렌더러 — 팝업 래핑 (실행 검증)', () => {
  it('alert/confirm/prompt 가 실제로 래핑된다', () => {
    const env = installGuard();
    expect(env.window.alert.__focusGuarded).toBe(true);
    expect(env.window.confirm.__focusGuarded).toBe(true);
    expect(env.window.prompt.__focusGuarded).toBe(true);
  });

  it('원본 반환값을 그대로 통과시킨다 — confirm(false) 이 undefined 로 새면 앱이 오동작한다', () => {
    const env = installGuard();
    env.window.__confirmReturn = false;
    expect(env.window.confirm('지울까요?')).toBe(false);   // 거짓값 보존이 핵심
    env.window.__confirmReturn = true;
    expect(env.window.confirm('지울까요?')).toBe(true);
    env.window.__promptReturn = '입력값';
    expect(env.window.prompt('이름?')).toBe('입력값');
    expect(env.window.__confirmArgs).toBe('지울까요?');     // 인자도 그대로 전달
  });

  it('팝업이 닫힌 뒤 재포커스를 요청한다 (브리지 우선)', async () => {
    const env = installGuard();
    env.window.alert('알림');
    expect(env.refocusCalls).toHaveLength(0);  // 디바운스 전에는 아직
    await settle();
    expect(env.refocusCalls).toEqual(['bridge']);
  });

  it('연달아 떠도 50ms 디바운스로 한 번만 요청한다', async () => {
    const env = installGuard();
    env.window.alert('1'); env.window.confirm('2'); env.window.prompt('3');
    await settle();
    expect(env.refocusCalls).toHaveLength(1);
  });

  it('원본이 예외를 던져도 예외는 그대로 나가고 재포커스는 요청된다 (finally)', async () => {
    const env = installGuardThrowing();
    expect(() => env.window.alert('x')).toThrow('원본 폭발');
    await settle();
    expect(env.refocusCalls).toEqual(['bridge']); // 예외 경로에서도 창은 살아난다
  });

  it('브리지가 없으면 범용 invoke 로 폴백한다', async () => {
    const env = installGuard({ bridge: false });
    env.window.alert('알림');
    await settle();
    expect(env.refocusCalls).toEqual(['invoke:window:refocus']);
  });

  it('통로가 하나도 없어도 앱을 멈추지 않는다', async () => {
    const env = installGuard({ bridge: false, invoke: false });
    expect(() => env.window.alert('알림')).not.toThrow();
    await settle();
    expect(env.refocusCalls).toHaveLength(0);
  });
});

/** 원본 alert 가 던지는 환경 — finally 통과를 확인하기 위한 별도 설치 */
function installGuardThrowing(): FakeEnv {
  const refocusCalls: string[] = [];
  const window: any = {
    alert: () => { throw new Error('원본 폭발'); },
    confirm: () => false,
    prompt: () => null,
    addEventListener: () => {},
    focusGuard: { refocus: () => { refocusCalls.push('bridge'); } },
    setTimeout, clearTimeout,
  };
  const document: any = { addEventListener: () => {} };
  const context = vm.createContext({ window, document, setTimeout, clearTimeout, console });
  vm.runInContext(read(GUARD_SRC), context, { filename: 'focus-guard.js' });
  return { window, document, refocusCalls, fire: () => {} };
}

describe('① 렌더러 — 파일 선택창', () => {
  it('클릭만으로는 재포커스하지 않는다 — 열려 있는 창에서 포커스를 뺏으면 안 된다', async () => {
    const env = installGuard();
    env.fire('document', 'click', fileInput());
    await settle();
    expect(env.refocusCalls).toHaveLength(0);
  });

  it('파일을 고르면(change) 재포커스한다', async () => {
    const env = installGuard();
    env.fire('document', 'click', fileInput());
    env.fire('document', 'change', fileInput());
    await settle();
    expect(env.refocusCalls).toHaveLength(1);
  });

  it('취소해도(창 포커스 복귀) 재포커스한다', async () => {
    const env = installGuard();
    env.fire('document', 'click', fileInput());
    env.fire('window', 'focus');
    await settle();
    expect(env.refocusCalls).toHaveLength(1);
  });

  it('파일창과 무관한 창 포커스 이벤트는 무시한다 (불필요한 blur 금지)', async () => {
    const env = installGuard();
    env.fire('window', 'focus');
    await settle();
    expect(env.refocusCalls).toHaveLength(0);
  });

  it('파일 입력이 아닌 클릭은 반응하지 않는다', async () => {
    const env = installGuard();
    env.fire('document', 'click', { target: { tagName: 'BUTTON', type: 'button' } });
    env.fire('window', 'focus');
    await settle();
    expect(env.refocusCalls).toHaveLength(0);
  });
});

describe('② 메인 — 포커스 리셋 + dialog 래핑', () => {
  const main = read('electron/main.ts');

  it('window:refocus IPC 핸들러가 있다', () => {
    expect(main).toContain("ipcMain.handle('window:refocus'");
  });

  it('blur() 다음 focus() 로 입력 라우팅을 되돌린다', () => {
    const fn = main.slice(main.indexOf('function resetWindowFocus'), main.indexOf('function resetWindowFocus') + 600);
    expect(fn).toContain('win.blur()');
    expect(fn).toContain('win.focus()');
    expect(fn.indexOf('win.blur()')).toBeLessThan(fn.indexOf('win.focus()'));
  });

  it('안 보이거나 최소화면 아무것도 안 한다 — 다른 앱 쓰는 중 포커스 강탈 금지', () => {
    const fn = main.slice(main.indexOf('function resetWindowFocus'), main.indexOf('function resetWindowFocus') + 600);
    expect(fn).toContain('isVisible()');
    expect(fn).toContain('isMinimized()');
    // 가드가 blur 보다 앞에 있어야 의미가 있다
    expect(fn.indexOf('isMinimized()')).toBeLessThan(fn.indexOf('win.blur()'));
  });

  it('dialog 3종을 모듈 레벨에서 감싼다 — 호출부마다 감싸면 새로 늘 때 빠진다', () => {
    const fn = main.slice(main.indexOf('function guardElectronDialogs'), main.indexOf("ipcMain.handle('window:refocus'"));
    expect(fn).toContain("'showOpenDialog'");
    expect(fn).toContain("'showSaveDialog'");
    expect(fn).toContain("'showMessageBox'");
    expect(fn).toContain('resetWindowFocus');
    expect(fn).toContain('finally');            // 실패해도 복구
    expect(fn).toContain('return await original.apply(dialog, args)'); // 반환값 보존
    expect(fn).toContain('__focusGuarded');     // 두 번 감싸지 않는다
  });
});

describe('③ 부트스트랩 — 최상단 로드 + preload 브리지', () => {
  const html = read('electron/ui/index.html');

  it('focus-guard.js 를 다른 스크립트보다 먼저 읽는다', () => {
    const guardIdx = html.indexOf('modules/focus-guard.js');
    expect(guardIdx).toBeGreaterThan(-1);
    // 나중에 로드하면 그 사이에 뜬 팝업이 래핑되지 않는다
    const firstOtherScript = html.indexOf('<script src="./script.js"');
    expect(firstOtherScript).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(firstOtherScript);
    expect(guardIdx).toBeLessThan(html.indexOf('</head>'));
  });

  it('preload 가 focusGuard 브리지를 노출한다 (소스)', () => {
    const preload = read('electron/preload.ts');
    expect(preload).toContain("exposeInMainWorld('focusGuard'");
    expect(preload).toContain("ipcRenderer.invoke('window:refocus')");
  });

  it('빌드 산출물에도 배선이 들어가 있다 — 소스만 고치고 배포하면 무의미하다', () => {
    // electron/preload.js · electron/ui/preload.js 는 실제로 앱이 읽는 산출물이다
    for (const artifact of ['electron/preload.js', 'electron/ui/preload.js']) {
      const built = read(artifact);
      expect(built).toContain("exposeInMainWorld('focusGuard'");
      expect(built).toContain("invoke('window:refocus')");
    }
    // 렌더러 가드는 electron/ui 가 곧 배포본이다 (src/ui 는 미사용)
    expect(fs.existsSync(path.join(__dirname, '..', GUARD_SRC))).toBe(true);
  });
});
