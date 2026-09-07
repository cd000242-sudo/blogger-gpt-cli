/**
 * v3.8.697 — 업데이트가 끝나면 **앱이 다시 켜진다**
 *
 * 사장님: "새버전감지 모달뜨면서 업데이트 되고 꺼지자나?
 *          그럼 다시 켜지도록해줘야지 꺼지고 끝이네"
 *
 * ## 실측으로 갈라 본 것 (2026-09-07)
 * v3.8.694 의 조용한 설치는 **성공했다** — 설치본이 3.8.687 → 3.8.696 으로 바뀌었고
 * 마법사도 뜨지 않았다(설치 폴더·asar 버전 실측). 남은 문제는 하나였다:
 * `quitAndInstall(true, true)` 의 두 번째 인자 `isForceRunAfter` 가 일을 하지 않아
 * **앱이 꺼진 채로 끝났다.**
 *
 * electron-updater 에 더 기대지 않고 밖에서 지켜보는 감시자를 띄운다.
 * 앱은 곧 죽으므로 detached 여야 하고(안 그러면 같이 죽는다),
 * `--force-run` 이 어쩌다 동작한 기기에서 두 번 켜지지 않도록 먼저 프로세스를 확인한다.
 *
 * PowerShell 스크립트 자체는 실측으로 확인했다:
 *   프로세스명 "LEADERNAM Orbit" · 떠 있을 때 ALREADY-UP · 없을 때 WOULD-START
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const updater = read('electron/updater.ts');

/** 함수 본문만 떼어 본다 — 파일 전체를 훑으면 엉뚱한 곳에 걸린다 */
function watchdogBody(): string {
  const start = updater.indexOf('function scheduleRelaunchWatchdog');
  const end = updater.indexOf('/** 프로그레스 창 생성 */');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return updater.slice(start, end);
}

describe('① 감시자가 앱을 다시 띄운다', () => {
  const fn = watchdogBody();

  test('⭐ 앱이 죽어도 살아남는다 (detached)', () => {
    // detached 가 아니면 부모(앱)와 함께 죽어서 아무 일도 일어나지 않는다
    expect(fn).toContain('detached: true');
    expect(fn).toContain('child.unref()');
  });

  test('⭐ 두 번 켜지지 않는다 — 먼저 떠 있는지 본다', () => {
    // --force-run 이 어쩌다 동작한 기기에서 창이 두 개 뜨면 안 된다
    expect(fn).toContain('Get-Process -Name');
    expect(fn.indexOf('Get-Process -Name')).toBeLessThan(fn.indexOf('Start-Process -FilePath'));
  });

  test('⭐ 한 번만 시도하지 않는다 — 설치 중에는 exe 가 잠겨 있다', () => {
    expect(fn).toContain('Start-Sleep -Seconds 12');   // 설치기가 파일을 바꿔 끼울 시간
    expect(fn).toContain('$i -lt 30');                 // 되풀이
    expect(fn).toContain('catch { Start-Sleep -Seconds 4 }');
  });

  test('⭐ 프로세스 이름을 exe 이름에서 뽑는다 (실측: "LEADERNAM Orbit")', () => {
    expect(fn).toContain("replace(/\\.exe$/i, '')");
    expect(fn).toContain('process.execPath');
  });

  test('작은따옴표를 이스케이프한다 — 경로에 따옴표가 있으면 스크립트가 깨진다', () => {
    expect(fn).toContain(`replace(/'/g, "''")`);
  });

  test('윈도우·패키징된 앱에서만 돈다', () => {
    expect(fn).toContain("process.platform !== 'win32'");
    expect(fn).toContain('!app.isPackaged');
  });

  test('감시자를 못 띄워도 설치는 계속한다 — 최악이라도 손으로 켜면 된다', () => {
    expect(fn).toContain('catch (e: any)');
    expect(fn).toContain('재시작 감시자 등록 실패');
  });
});

describe('② 두 설치 경로 모두에 붙어 있다', () => {
  test('⭐ 자동 경로(다운로드 완료 → 설치)', () => {
    const auto = updater.slice(updater.indexOf("updater.on('update-downloaded'"));
    const head = auto.slice(0, auto.indexOf("updater.on('error'"));
    expect(head).toContain('scheduleRelaunchWatchdog()');
    expect(head.indexOf('scheduleRelaunchWatchdog()')).toBeLessThan(head.indexOf('quitAndInstall(true, true)'));
  });

  test('⭐ 수동 경로(로그인창 [최신 버전으로 재시작])', () => {
    const manual = updater.slice(updater.indexOf("ipcMain.handle('updater:restart-to-latest'"));
    expect(manual).toContain('scheduleRelaunchWatchdog()');
    expect(manual.indexOf('scheduleRelaunchWatchdog()')).toBeLessThan(manual.indexOf('quitAndInstall(true, true)'));
  });

  test('설치 전에 등록한다 — 앱이 죽은 뒤에는 아무것도 띄울 수 없다', () => {
    // 두 경로 모두 quitAndInstall 보다 앞서야 한다 (위 두 테스트가 순서를 본다)
    // 정의 줄(`function scheduleRelaunchWatchdog(): void`)은 빼고 **호출**만 센다
    /**
     * v3.8.702 에서 호출부가 셋이 됐다 — **설치를 거는 자리마다 하나씩** 붙어야 한다:
     *   ① 자동 경로의 조용한 설치
     *   ② 그게 안 먹혔을 때 [지금 재시작] 을 고른 경우
     *   ③ 로그인창의 수동 버튼
     * 숫자를 박아 두는 대신 "설치를 거는 곳보다 적지 않다"를 본다 —
     * 빠뜨리면 그 경로만 앱이 안 돌아온다.
     */
    // 주석에도 quitAndInstall 이 나온다 — 주석을 걷어내고 **실제 호출**만 본다
    const code = updater.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const sites = [...code.matchAll(/updater\.quitAndInstall\(/g)].map((m) => m.index || 0);
    expect(sites.length).toBeGreaterThanOrEqual(3);

    // 설치를 거는 자리마다 바로 앞에 감시자가 있어야 한다 — 빠뜨리면 그 경로만 앱이 안 돌아온다
    const missing = sites.filter((at) => !code.slice(Math.max(0, at - 700), at).includes('scheduleRelaunchWatchdog()'));
    expect(missing).toEqual([]);
  });
});

describe('③ 조용한 설치는 그대로 유지한다 (v3.8.694 가 고친 것)', () => {
  test('조용한 설치를 먼저 걸고, 안 되면 마법사로 물러선다', () => {
    const auto = updater.slice(updater.indexOf("updater.on('update-downloaded'"));
    const head = auto.slice(0, auto.indexOf("updater.on('error'"));
    expect(head.indexOf('quitAndInstall(true, true)')).toBeLessThan(head.indexOf('quitAndInstall(false, true)'));
  });
});
