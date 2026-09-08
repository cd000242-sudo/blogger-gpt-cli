/**
 * v3.8.692 — 로그인 인증창의 [🔁 최신 버전으로 재시작]
 *
 * 사장님: "자동업데이트가 안되면 로그인인증창에 제일 최신버전으로 재시작하기 버튼생성하고
 *          누르면 자동 업데이트하고 재시작되게하면되지않니"
 *
 * ## 버튼만 달면 같은 벽에 부딪힌다 — 그게 이 릴리스의 요점이다
 * 기존 `updater:install` 은 `quitAndInstall()` 을 **인자 없이** 불렀다 → isSilent=false →
 * NSIS **설치 마법사**가 뜨고 사람이 클릭해야 끝난다.
 *
 * 게다가 이 앱은 `oneClick:false · allowToChangeInstallationDirectory:true` 라
 * 마법사 기본 설치 위치가 지금 앱이 있는 곳과 다르다. 2026-09-07 실측:
 *   앱 실제 위치   C:\Program Files\Blog Automation Premium\LEADERNAM Orbit\  (v3.8.687)
 *   마법사 기본값  %LOCALAPPDATA%\Programs\LEADERNAM Orbit\                   ← **빈 폴더로 남아 있었다**
 * 그래서 "설치했다는데 앱은 그대로"가 됐다.
 *
 * 이 버튼은 `quitAndInstall(true, true)` 로 간다 —
 *   isSilent=true        → /S 조용한 설치. 레지스트리에 기억된 **기존 설치 위치**로 들어간다.
 *   isForceRunAfter=true → 설치 후 자동 재시작.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const updater = read('electron/updater.ts');
const login = read('electron/ui/login-window.html');

describe('① 백엔드 — 조용히 설치하고 다시 띄운다', () => {
  const handler = updater.slice(updater.indexOf("ipcMain.handle('updater:restart-to-latest'"));

  test('⭐ 채널이 있다', () => {
    expect(updater).toContain("ipcMain.handle('updater:restart-to-latest'");
  });

  test('⭐ quitAndInstall(true, true) — 마법사를 띄우지 않고 기존 위치에 깐다', () => {
    // v3.8.707: 설치는 installDownloadedUpdateNow 한 곳으로 모였고, 그 안이 (true, true) 다
    expect(handler.slice(0, 3000)).toContain('installDownloadedUpdateNow(');
    const fn = updater.slice(updater.indexOf('export function installDownloadedUpdateNow('), updater.indexOf('async function askThenInstall('));
    expect(fn).toContain('quitAndInstall(true, true)');
  });

  test('⭐ 이미 최신이면 설치하지 않고 그렇다고 알려 준다 (조용히 끝내지 않는다)', () => {
    const head = handler.slice(0, 3000);
    expect(head).toContain('upToDate: true');
    expect(head.indexOf('upToDate: true')).toBeLessThan(head.indexOf('installDownloadedUpdateNow('));
  });

  test('⭐ 내려받기를 기다린다 — 안 기다리고 설치하면 아무 일도 안 일어난다', () => {
    const head = handler.slice(0, 3000);
    expect(head).toContain("updater.once('update-downloaded'");
    expect(head).toContain('downloadUpdate()');
  });

  test('⭐ 무한정 기다리지 않는다 — 고장과 구별되지 않으면 안 된다', () => {
    expect(handler.slice(0, 3000)).toContain('5 * 60 * 1000');
  });

  test('실패해도 예외를 던지지 않고 이유를 돌려준다 (로그인 창이 멈추면 안 된다)', () => {
    expect(handler.slice(0, 3000)).toContain('ok: false');
  });

  test('개발 모드에서는 못 쓴다고 말한다', () => {
    expect(handler.slice(0, 600)).toContain('개발 모드');
  });
});

describe('② 로그인 창 — 버튼과 결과 표시', () => {
  test('⭐ 버튼이 실제로 있다 (없는 id 에 거는 실수를 막는다)', () => {
    expect(login).toContain('id="loginUpdateNowBtn"');
    expect(login).toContain('최신 버전으로 재시작');
  });

  test('⭐ 그 버튼이 새 채널을 부른다 — 옛 채널(마법사)로 가면 안 된다', () => {
    expect(login).toContain("invoke('updater:restart-to-latest')");
  });

  test('⭐ 세 갈래를 모두 화면에 적는다 — 눌렀는데 말이 없으면 고장과 같다', () => {
    const script = login.slice(login.indexOf("getElementById('loginUpdateNowBtn')"));
    expect(script.slice(0, 2600)).toContain('이미 최신 버전입니다');
    expect(script.slice(0, 2600)).toContain('설치하고 다시 시작합니다');
    expect(script.slice(0, 2600)).toContain('업데이트하지 못했습니다');
  });

  test('설치가 시작되면 버튼을 되살리지 않는다 — 곧 앱이 꺼진다', () => {
    const script = login.slice(login.indexOf("getElementById('loginUpdateNowBtn')"));
    const body = script.slice(0, 2600);
    expect(body.indexOf('설치하고 다시 시작합니다')).toBeLessThan(body.indexOf('return;   // 버튼을 되살리지 않는다'));
  });

  test('결과를 적을 자리가 있다', () => {
    expect(login).toContain('id="loginUpdateNowMsg"');
  });
});

describe('③ 왜 필요했는지가 설정에 남아 있다', () => {
  const pkg = JSON.parse(read('package.json'));

  test('⭐ NSIS 가 조용한 설치가 아니다 — 이 버튼이 필요한 이유', () => {
    // 이 값이 true 로 바뀌면 자동 경로도 조용해지므로 이 테스트가 알려 준다
    expect(pkg.build.nsis.oneClick).toBe(false);
    expect(pkg.build.nsis.allowToChangeInstallationDirectory).toBe(true);
  });

  test('자동 경로도 마법사를 띄우지 않는다 (v3.8.694 사장님 결정 · v3.8.707 한 함수로)', () => {
    // v3.7.6 의 "마법사 그대로" 는 v3.8.694 에서 사장님이 뒤집었다("자동으로 업데이트가 되면 마법사가 뜰필요없고").
    // 마법사는 기본 설치 위치가 어긋나 엉뚱한 곳에 깔린 전례가 있어 어느 경로에서도 쓰지 않는다.
    const code = updater.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('quitAndInstall(false, true)');
    expect(code).not.toMatch(/updater\.quitAndInstall\(\)/);
  });
});
