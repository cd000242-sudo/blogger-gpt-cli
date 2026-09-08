/**
 * v3.8.707 — 로그인 창에서 업데이트가 **설치되지 않고 앱만 꺼지던** 사고
 *
 * 사장님: "지금 자동업데이트가 안되고 로그인인증창에서 자꾸 꺼지는데?"
 *
 * ## 실측으로 잡은 원인 (2026-09-08)
 * update-downloaded 가 **인증창을 닫았다.** 인증 단계에서는 그 창이 유일한 창이라
 * main.ts 의 `window-all-closed → app.quit()` 이 곧바로 돌고, 2초 뒤에 걸어 둔
 * `quitAndInstall` 은 영영 오지 않는다. Electron 으로 재현: 마지막 창을 닫으면
 * 1초 안에 프로세스가 끝나고 2초 타이머는 찍히지 않았다(scratchpad/quit-race).
 *
 * v3.8.701 까지는 autoInstallOnAppQuit=true 라 그 "그냥 꺼짐" 이 우연히 설치를
 * 대신했다(force-run 없이 → "다시 안 뜬다" 불만의 뿌리). v3.8.702 가 그 옵션을 끄자
 * 아무것도 남지 않았다: 다운로드 → 창 꺼짐 → 끝. 켤 때마다 되풀이.
 *
 * ## 고친 것
 * ① 인증창을 닫지 않는다 — 설치 중 모달을 보여 주고, 종료는 quitAndInstall 이 한다.
 * ② 마지막 창이 닫혀도 다운로드된 업데이트가 있으면 **설치부터** 한다(main.ts).
 * ③ 같은 버전을 10분 안에 또 깔려 하면(권한 확인창에서 '아니오' 등) 조용히 되풀이하지
 *    않고 [지금 재시작]/[나중에] 로 묻는다 — updater-attempt.ts.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readAttempt, recordAttempt, clearAttempt, isRepeatAttempt, RETRY_WINDOW_MS } from '../electron/updater-attempt';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('③ 되풀이 감지 — updater-attempt', () => {
  let dir = '';
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lba-attempt-')); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  test('기록이 없으면 null', () => {
    expect(readAttempt(dir)).toBeNull();
  });

  test('⭐ 같은 버전을 다시 기록하면 횟수가 오른다, 다른 버전이면 1부터', () => {
    const a = recordAttempt(dir, '3.8.707', 1000);
    expect(a).toEqual({ version: '3.8.707', at: 1000, count: 1 });
    const b = recordAttempt(dir, '3.8.707', 2000);
    expect(b).toEqual({ version: '3.8.707', at: 2000, count: 2 });
    expect(readAttempt(dir)).toEqual(b);
    const c = recordAttempt(dir, '3.8.708', 3000);
    expect(c.count).toBe(1);
  });

  test('⭐ 10분 안의 같은 버전만 되풀이로 본다', () => {
    const prev = { version: '3.8.707', at: 100_000, count: 1 };
    expect(isRepeatAttempt(prev, '3.8.707', 100_000 + RETRY_WINDOW_MS - 1)).toBe(true);
    expect(isRepeatAttempt(prev, '3.8.707', 100_000 + RETRY_WINDOW_MS)).toBe(false);
    expect(isRepeatAttempt(prev, '3.8.708', 100_001)).toBe(false);
    expect(isRepeatAttempt(null, '3.8.707', 100_001)).toBe(false);
  });

  test('지우면 없어진다 · 깨진 파일은 null', () => {
    recordAttempt(dir, '3.8.707', 1);
    clearAttempt(dir);
    expect(readAttempt(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, 'update-attempt.json'), '{not json');
    expect(readAttempt(dir)).toBeNull();
  });

  test('기록은 새 객체다 — 인자를 바꾸지 않는다', () => {
    const prev = recordAttempt(dir, '3.8.707', 1);
    const next = recordAttempt(dir, '3.8.707', 2);
    expect(prev.count).toBe(1);
    expect(next).not.toBe(prev);
  });
});

describe('① 인증창을 닫지 않는다 (updater.ts)', () => {
  const updater = read('electron/updater.ts');
  const downloaded = updater.slice(
    updater.indexOf("updater.on('update-downloaded'"),
    updater.indexOf("updater.on('error'"),
  );

  test('⭐ update-downloaded 안에 loginWindowRef.close() 가 없다', () => {
    expect(downloaded).not.toContain('loginWindowRef.close()');
  });

  test('⭐ 설치는 한 함수로 모인다 — installDownloadedUpdateNow', () => {
    expect(updater).toContain('export function installDownloadedUpdateNow(');
    expect(downloaded).toContain('installDownloadedUpdateNow(');
    // 감시자·설치·기록이 그 함수 안에 있다
    const fn = updater.slice(
      updater.indexOf('export function installDownloadedUpdateNow('),
      updater.indexOf('/** 초기화 (앱 시작 시 호출) */'),
    );
    expect(fn).toContain('scheduleRelaunchWatchdog()');
    expect(fn).toContain('quitAndInstall(true, true)');
    expect(fn).toContain('recordAttempt(');
  });

  test('⭐ 되풀이면 조용히 다시 깔지 않고 묻는다', () => {
    expect(downloaded).toContain('isRepeatAttempt(');
    expect(downloaded).toContain('askThenInstall(');
  });

  test('설치가 끝난 버전의 기록은 시작 때 지운다', () => {
    const init = updater.slice(
      updater.indexOf('export function initAutoUpdaterEarly('),
      updater.indexOf("updater.on('checking-for-update'"),
    );
    expect(init).toContain('clearAttempt(');
  });
});

describe('② 마지막 창이 닫혀도 설치부터 한다 (main.ts)', () => {
  // 주석에도 app.quit() 이 나온다 — 주석을 걷어내고 실제 코드 순서만 본다
  const main = read('electron/main.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const block = main.slice(
    main.indexOf("app.on('window-all-closed'"),
    main.indexOf("app.on('will-quit'"),
  );

  test('⭐ app.quit() 앞에서 installDownloadedUpdateNow 를 먼저 본다', () => {
    expect(block).toContain("installDownloadedUpdateNow('마지막 창이 닫힘')");
    expect(block.indexOf('installDownloadedUpdateNow')).toBeLessThan(block.indexOf('app.quit();'));
  });
});

describe('④ 두 화면의 안내문이 실제 순서를 말한다', () => {
  test('인증창: 설치 중 · 권한 확인창 안내', () => {
    const html = read('electron/ui/login-window.html');
    const block = html.slice(html.indexOf("data.type === 'downloaded'"), html.indexOf("data.type === 'downloaded'") + 900);
    expect(block).toContain('권한 확인창');
  });

  test('메인 화면: "설치 화면이 열립니다" 라는 옛 문구가 없다', () => {
    const html = read('electron/ui/index.html');
    const block = html.slice(html.indexOf("data.type === 'downloaded'"), html.indexOf("data.type === 'downloaded'") + 1200);
    expect(block).not.toContain('설치 화면이 열립니다');
    expect(block).toContain('권한 확인창');
  });
});
