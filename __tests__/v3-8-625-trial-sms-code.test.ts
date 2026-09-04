const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.625 — 무료체험 문자 본인인증.
 *
 * 3.8.543~3.8.624 는 화면에 인증번호 칸이 있어도 열리지 않았다: 메인이 서버 응답에서
 * smsRequired/codeSent 를 떼고 넘겼고, 인증번호를 **보내달라는 호출 자체가 없었다**.
 * 그래서 서버가 문자 인증을 켠 뒤로 Orbit 체험 등록이 통째로 거부됐다.
 * 리더 앱과 같은 2단계 — [인증하기](자격확인) → [인증번호 받기](발송) → 6자리 → [인증완료].
 */
describe('v3.8.625 free-trial phone verification', () => {
  test('trial-verify passes the server 인증 요구 flags through to the window', () => {
    const main = read('electron/main.ts');

    expect(main).toContain("smsRequired: result.smsRequired === true");
    expect(main).toContain("phoneVerified: result.phoneVerified === true");
    expect(main).toContain("codeSent: result.codeSent === true");
  });

  test('a request-code IPC actually asks the server to send the SMS', () => {
    const main = read('electron/main.ts');

    expect(main).toContain("ipcMain.handle('auth:trial-request-code'");
    expect(main).toContain("action: 'trial-request-code'");
    // 닉네임을 빠뜨리면 서버의 '한 번호 한 이름' 검사가 발송 단계에서 새어 문자비만 나간다.
    expect(main).toMatch(/action: 'trial-request-code',[^)]*nickname/);
  });

  test('trial calls wait long enough for a cold GAS + Solapi round trip', () => {
    const main = read('electron/main.ts');

    // 실측: 콜드 스타트 13~38초. 10초면 문자는 나가는데 앱만 먼저 끊긴다.
    expect(main).toContain('const TRIAL_GAS_TIMEOUT_MS = 30000;');
    expect(main).toContain('setTimeout(() => controller.abort(), TRIAL_GAS_TIMEOUT_MS)');
  });

  test('the modal offers 인증번호 받기 when the server requires a code, and gates 인증완료 on it', () => {
    const login = read('electron/ui/login-window.html');

    expect(login).toContain('id="trialSendCodeBtn"');
    expect(login).toContain('onclick="trialSendCode()"');
    expect(login).toContain("invoke('auth:trial-request-code'");
    // 서버가 요구할 때만 노출 — 문자를 끄면 예전처럼 버튼째 사라진다.
    expect(login).toContain('result.smsRequired === true');
    expect(login).toContain("if (trialCodeRequired && !/^\\d{6}$/.test(authCode))");
  });

  test('package version is at least 3.8.625 — the version the server gate opens for', () => {
    const [major, minor, patch] = JSON.parse(read('package.json')).version.split('.').map(Number);
    const rank = major * 1_000_000 + minor * 1_000 + patch;
    expect(rank).toBeGreaterThanOrEqual(3 * 1_000_000 + 8 * 1_000 + 625);
  });
});
