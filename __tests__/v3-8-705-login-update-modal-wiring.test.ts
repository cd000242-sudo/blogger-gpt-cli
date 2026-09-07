/**
 * v3.8.705 — 로그인 인증창의 업데이트 모달이 **한 번도 뜨지 않던** 이유
 *
 * 사장님: "로그인 인증창 모달안뜨는데..? 새로운버전 감지뜨면서 업데이트 바
 *          애니메이션뜨고 다올라가면 재시작되게끔해달라니까 뭐가잘안되니?"
 *
 * ## 원인
 * 로그인 창은 `if (ipcApi.on) { ... }` 로 감싼 뒤 `ipcApi.on('auto-update-event', ...)`
 * 를 불렀다. 그런데 preload 가 내주는 이름은 `on` 이 아니라 **`onAutoUpdate`** 다.
 * 가드가 **항상 거짓**이라 모달·진행바 코드가 통째로 죽어 있었다.
 * 오류도 안 난다 — 조용히 없는 기능이었다(오늘만 여러 번 반복된 유형).
 *
 * ## 이 테스트가 지키는 것
 * "창이 부르는 이름"과 "preload 가 내주는 이름"이 어긋나면 실패한다.
 * 코드가 있느냐가 아니라 **연결됐느냐**를 본다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');
const loginHtmlRaw = read('electron/ui/login-window.html');
/**
 * 주석을 걷어낸 **실행되는 코드**만 본다.
 * 처음 이 테스트를 돌렸을 때 걸린 것이 사고 설명 주석이었다 —
 * 검사기가 설명을 코드로 착각하면 통과·실패 모두 믿을 수 없다.
 */
const loginHtml = loginHtmlRaw.replace(/\/\*[\s\S]*?\*\//g, '');
const preloadSrc = read('electron/preload.ts');

/** preload 가 렌더러에 실제로 내주는 최상위 키들 */
const exposedNames = new Set(
  (preloadSrc.match(/^\s{2}([A-Za-z_$][\w$]*)\s*:/gm) || []).map((m) => m.trim().replace(/\s*:$/, '')),
);

describe('① 로그인 창은 preload 에 실제로 있는 이름만 부른다', () => {
  test('⭐ 업데이트 구독 이름이 preload 에 존재한다', () => {
    // 이번 사고의 핵심 — onAutoUpdate 가 진짜 이름이다
    expect(exposedNames.has('onAutoUpdate')).toBe(true);
    expect(loginHtml).toContain('ipcApi.onAutoUpdate');
  });

  test('⭐ 없는 `on` 하나에만 기대지 않는다', () => {
    // 예전 코드: if (ipcApi.on) { ... }  → 항상 거짓이라 블록 전체가 죽었다
    expect(loginHtml).not.toMatch(/if\s*\(\s*ipcApi\.on\s*\)/);
    expect(loginHtml).toContain('typeof ipcApi.onAutoUpdate === \'function\'');
  });

  test('⭐ 어느 쪽도 없으면 조용히 넘기지 않고 알린다', () => {
    expect(loginHtml).toContain('업데이트 알림을 받을 통로가 없습니다');
  });
});

describe('② 감지 → 진행바 → 재시작 세 단계가 모두 배선돼 있다', () => {
  const handler = loginHtml.slice(
    loginHtml.indexOf('subscribeAutoUpdate(function(data)'),
    loginHtml.indexOf('subscribeAutoUpdate(function(data)') + 2000,
  );

  test('⭐ 구독 함수가 실제로 호출된다', () => {
    expect(loginHtml).toContain('subscribeAutoUpdate(function(data)');
    expect(handler.length).toBeGreaterThan(100);
  });

  test.each([['available'], ['progress'], ['downloaded']])('⭐ %s 상태를 처리한다', (type) => {
    expect(handler).toContain(`data.type === '${type}'`);
  });

  test('⭐ 진행바가 애니메이션으로 찬다 — transform 을 쓴다', () => {
    // width 대신 transform 이라야 레이아웃을 다시 재지 않고 부드럽게 움직인다
    expect(handler).toContain('upBar.style.transform');
    expect(handler).toContain('scaleX(1)');
  });

  test('⭐ 다 차면 자동으로 다시 열린다고 알린다 — 마법사를 열지 않는다', () => {
    expect(handler).toContain('자동으로 다시 열립니다');
    expect(handler).not.toContain('설치 화면이 열립니다');
  });
});

describe('③ 보내는 쪽이 로그인 창을 빼먹지 않는다', () => {
  const updater = read('electron/updater.ts');

  test('⭐ 세 상태 모두 전체 창에 방송된다', () => {
    for (const type of ['available', 'progress', 'downloaded']) {
      expect(updater).toContain(`'auto-update-event', { type: '${type}'`);
    }
    expect(updater).toContain('BrowserWindow.getAllWindows().forEach');
  });

  test('⭐ 업데이트 도중에 인증창이 뒤늦게 떠도 알린다', () => {
    expect(updater).toContain('isUpdateInProgress && loginWindowRef');
  });
});
