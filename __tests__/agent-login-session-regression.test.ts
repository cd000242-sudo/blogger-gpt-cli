import fs from 'fs';
import path from 'path';

describe('agent login session regression', () => {
  const mainSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'main.ts'), 'utf8');
  const uiSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'modules', 'codex-workshop.js'), 'utf8');

  test('login check supports a real CLI verification path', () => {
    expect(mainSource).toContain('const AGENT_LOGIN_VERIFY_TIMEOUT_MS');
    expect(mainSource).toContain('function buildAgentLoginVerifyCommand');
    expect(mainSource).toContain('async function verifyAgentLoginSession');
    expect(mainSource).toContain("args: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', prompt]");
    expect(mainSource).toContain("args: ['-p', '--permission-mode', 'dontAsk', '--max-turns', '1', '--output-format', 'json', prompt]");
  });

  test('check-login IPC verifies sessions when requested and updates stale profile status', () => {
    expect(mainSource).toContain("ipcMain.handle('agent-mode:check-login'");
    expect(mainSource).toContain('args?.verify && profile');
    expect(mainSource).toContain('const verification = await verifyAgentLoginSession(profile)');
    expect(mainSource).toContain("updateAgentProfileStatus(profile.id, 'needs-login')");
  });

  test('agent publish job refuses to start when live login verification fails', () => {
    expect(mainSource).toContain("ipcMain.handle('agent-mode:run-job'");
    expect(mainSource).toContain('const loginVerification = await verifyAgentLoginSession(profile)');
    expect(mainSource).toContain('if (!loginVerification.ready)');
    expect(mainSource).toContain('authRequired: loginVerification.authRequired');
  });

  test('settings refresh and posting use the verified check path with visible messages', () => {
    expect(uiSource).toContain('function getAgentLoginResultMessage');
    expect(uiSource).toContain('async function refreshAgentSettingsAndVerify');
    expect(uiSource).toContain('verify: options.verify === true');
    expect(uiSource).toContain("button.textContent = '세션 확인 중...'");
    expect(uiSource).toContain("checkAgentLoginStatus(profile.provider, profile.id, { verify: true, showStatus: true })");
    expect(uiSource).toContain('return refreshAgentSettingsAndVerify(state.activeAgentProvider)');
  });
});
