const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/**
 * 시작 표시부터 다음 표시 직전까지 떼어 온다.
 * 고정 길이 slice 는 규칙이 몇 줄 밀리기만 해도 조용히 헛것을 검사한다.
 * (중괄호 짝맞추기는 여기선 못 쓴다 — 핸들러 매개변수의 타입 리터럴이 먼저 걸린다.)
 */
function blockBetween(source: string, startMarker: string, endMarker: string): string {
  const from = source.indexOf(startMarker);
  if (from === -1) throw new Error('시작 표시를 못 찾음: ' + startMarker);
  const to = source.indexOf(endMarker, from + startMarker.length);
  return to === -1 ? source.slice(from) : source.slice(from, to);
}

/** auth:free-trial 핸들러 본문 — 다음 ipcMain.handle 직전까지. */
function freeTrialHandler(main: string): string {
  return blockBetween(main, "ipcMain.handle('auth:free-trial'", 'ipcMain.handle(\'quota:getStatus\'');
}

/*
 * v3.8.627 — 기존 체험자가 "인증하기 버튼이 어디 있냐" 고 묻던 구멍.
 *
 * 재입장(저장된 닉네임·폰번호)은 모달을 건너뛰고 곧장 활성화를 부르므로
 * authCode 가 빈 값으로 나간다. v3.8.625 에서 서버가 문자 인증을 켜자
 * 서버는 "[인증하기]를 다시 눌러 인증번호를 받아주세요" 로 거절했는데,
 * 화면은 경고창만 띄우고 모달을 열지 않았다 — 서버가 누르라는 버튼이
 * 화면에 아예 없었다. 처음 체험하는 사람은 NEED_INFO 로 모달이 열려
 * 멀쩡했고, 기존 체험자만 통째로 막혔다.
 */
describe('v3.8.627 기존 체험자 재입장 — 인증번호가 필요하면 길을 열어 준다', () => {
  test('메인이 "인증번호가 필요하다"는 거절을 NEED_CODE 로 구분해 알린다', () => {
    const block = freeTrialHandler(read('electron/main.ts'));

    expect(block).toContain("code: 'NEED_CODE'");
    // 서버가 구조화된 신호를 주면 그걸 먼저 믿는다
    expect(block).toContain('result.smsRequired === true');
    expect(block).toContain('result.needCode === true');
    // 아직 문구로만 알려주는 서버도 있으므로 마지막 수단으로 본문을 본다
    expect(block).toMatch(/\/인증번호\|인증\\s\*코드\//);
  });

  test('NEED_CODE 에는 저장된 닉네임·폰번호가 함께 실린다 — 화면이 다시 물어보지 않게', () => {
    const block = freeTrialHandler(read('electron/main.ts'));
    const needCode = block.slice(block.indexOf("code: 'NEED_CODE'"));

    expect(needCode).toContain('nickname,');
    expect(needCode).toContain('phone,');
  });

  test('인증번호와 무관한 실패는 NEED_CODE 로 둔갑하지 않는다', () => {
    const block = freeTrialHandler(read('electron/main.ts'));

    // 조건을 통과하지 못한 거절은 예전처럼 메시지만 돌려준다
    expect(block).toContain("return { ok: false, message: serverMessage || '체험 등록에 실패했습니다.' };");
  });

  test('실제 서버 문구가 NEED_CODE 판정에 걸린다', () => {
    // 사장님이 받은 그 문구 그대로
    const 서버문구 = '인증번호가 올바르지 않거나 만료되었습니다. [인증하기]를 다시 눌러 인증번호를 받아주세요.';
    expect(/인증번호|인증\s*코드/.test(서버문구)).toBe(true);

    // 관계없는 실패는 안 걸려야 한다
    expect(/인증번호|인증\s*코드/.test('이미 사용 중인 기기입니다.')).toBe(false);
    expect(/인증번호|인증\s*코드/.test('체험 등록에 실패했습니다.')).toBe(false);
  });

  test('화면이 NEED_CODE 를 받으면 모달을 연다 — 경고창으로 끝내지 않는다', () => {
    const html = read('electron/ui/login-window.html');
    const fn = blockBetween(html, 'async function startFreeTrial()', 'async function trialVerify()');

    expect(fn).toContain("result.code === 'NEED_CODE'");
    const needCode = fn.slice(fn.indexOf("result.code === 'NEED_CODE'"));
    const alertAt = fn.indexOf('alert(');
    const needCodeAt = fn.indexOf("result.code === 'NEED_CODE'");
    // 경고창보다 먼저 처리하고 빠져나가야 한다
    expect(needCodeAt).toBeLessThan(alertAt);
    expect(needCode).toContain('openTrialModalPrefilled(');
    expect(needCode).toContain('return;');
  });

  test('NEED_CODE 는 서버가 준 닉네임·폰번호를 그대로 모달로 넘긴다', () => {
    const html = read('electron/ui/login-window.html');
    const fn = blockBetween(html, 'async function startFreeTrial()', 'async function trialVerify()');
    const needCode = fn.slice(fn.indexOf("result.code === 'NEED_CODE'"));

    expect(needCode).toContain('openTrialModalPrefilled(result.nickname, result.phone');
  });

  test('모달에 값을 채우고 자격확인까지 대신 눌러 준다', () => {
    const html = read('electron/ui/login-window.html');
    const fn = blockBetween(html, 'function openTrialModalPrefilled(', 'async function openVerifyForExisting()');

    expect(fn).toContain("getElementById('trialNickname')");
    expect(fn).toContain("getElementById('trialPhone')");
    // 자격확인이 통과해야 [📩 인증번호 받기] 가 나타난다
    expect(fn).toContain('trialVerify()');
    // 값이 온전할 때만 대신 누른다 — 빈 값으로 서버를 부르면 헛발질이다
    expect(fn).toMatch(/length >= 2/);
    expect(fn).toMatch(/\^01\[0-9\]\{8,9\}\$/);
  });

  test('[본인인증하기] 버튼이 화면에 있고 실제 함수에 연결돼 있다', () => {
    const html = read('electron/ui/login-window.html');

    expect(html).toContain('id="trialVerifyEntryBtn"');
    expect(html).toContain('onclick="openVerifyForExisting()"');
    // 없는 함수를 부르면 아무 일도 안 일어나고 조용히 죽는다 — 실물이 있어야 한다
    expect(html).toContain('async function openVerifyForExisting()');
  });

  test('버튼과 자동 복구가 같은 길을 쓴다 — 한쪽만 고쳐지는 일이 없게', () => {
    const html = read('electron/ui/login-window.html');

    expect(html).toContain('function openTrialModalPrefilled(');
    // 두 진입점이 모두 그 함수를 부른다
    const 부른횟수 = (html.match(/openTrialModalPrefilled\(/g) || []).length;
    expect(부른횟수).toBeGreaterThanOrEqual(3); // 선언 1 + 호출 2
  });

  test('저장된 체험 정보를 돌려주는 IPC 가 있고, 비밀은 내보내지 않는다', () => {
    const main = read('electron/main.ts');
    const handler = blockBetween(main, "ipcMain.handle('auth:trial-stored-info'", "ipcMain.handle('auth:free-trial'");

    expect(handler).toContain('loadTrialState');
    expect(handler).toContain('hasInfo');
    // 화면을 채울 값만 나간다 — 인증번호·라이선스는 나가지 않는다
    expect(handler).not.toMatch(/authCode|licenseKey|password/);
  });

  test('저장된 값이 온전할 때만 hasInfo 가 참이다 — 빈 값으로 서버를 부르지 않게', () => {
    const main = read('electron/main.ts');
    const handler = blockBetween(main, "ipcMain.handle('auth:trial-stored-info'", "ipcMain.handle('auth:free-trial'");

    expect(handler).toMatch(/nickname\.length >= 2/);
    expect(handler).toMatch(/\^01\[0-9\]\{8,9\}\$/);
  });

  test('눌러야 할 버튼이 화면에 실제로 있다 — id 가 살아 있어야 흐름이 이어진다', () => {
    const html = read('electron/ui/login-window.html');

    for (const id of ['trialNickname', 'trialPhone', 'trialVerifyBtn', 'trialSendCodeBtn', 'trialAuthCode', 'trialCompleteBtn']) {
      expect(html).toContain('id="' + id + '"');
    }
    // [인증하기] 가 smsRequired 를 보고 [인증번호 받기] 를 드러내는 연결이 살아 있어야 한다
    expect(html).toContain("result.smsRequired === true");
    expect(html).toContain("getElementById('trialSendCodeBtn')");
  });
});
