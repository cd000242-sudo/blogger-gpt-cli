const fs = require('fs');
const path = require('path');

export {};

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.626 — 유료 라이선스 휴대폰 본인인증.
 *
 * 비밀번호를 잊은 고객을 되살릴 수단이 없었다. 휴대폰이 그 수단이고, 번호는 계정에
 * 붙어 있어야 쓸모가 있다. 사장님 결정: 유료는 강제하지 않는다([나중에 하기]),
 * 무료체험은 필수. 한 번 인증하면 다시 묻지 않는다(서버 phoneVerified).
 */
describe('v3.8.626 paid license phone verification', () => {
  test('login response phoneVerified is persisted with the license', () => {
    const manager = read('src/utils/license-manager-new.ts');

    expect(manager).toContain('phoneVerified?: boolean');
    expect(manager).toContain('data.phoneVerified === true');
    expect(manager).toContain('markPhoneVerified()');
    expect(manager).toContain('isPhoneVerified()');
  });

  test('IPC asks the server with the login session, never an admin token', () => {
    const main = read('electron/main.ts');

    expect(main).toContain("ipcMain.handle('license:phoneStatus'");
    expect(main).toContain("ipcMain.handle('license:phoneRequestCode'");
    expect(main).toContain("ipcMain.handle('license:phoneConfirm'");
    expect(main).toContain("'license-phone-request-code'");
    expect(main).toContain("'license-phone-confirm'");
    expect(main).toContain('sessionToken');
    expect(main).not.toContain('adminToken');
  });

  test('the modal offers 나중에 하기 and every login path passes through finishLogin', () => {
    const login = read('electron/ui/login-window.html');

    expect(login).toContain('id="phoneVerifyBackdrop"');
    expect(login).toContain('나중에 하기');
    expect(login).toContain('async function finishLogin()');
    expect(login).toContain("invoke('license:phoneStatus')");
    expect(login).toContain("invoke('license:phoneRequestCode'");
    expect(login).toContain("invoke('license:phoneConfirm'");
    // finishLogin 안의 정상 호출 1개만 남아야 한다.
    expect(login.match(/invoke\('login-success-signal'\)/g)?.length).toBe(1);
    expect(login.match(/finishLogin\(\)/g)?.length).toBeGreaterThanOrEqual(5);
  });

  test('package version is 3.8.626', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.version).toBe('3.8.626');
  });
});
