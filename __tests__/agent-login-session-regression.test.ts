import fs from 'fs';
import path from 'path';

describe('agent login session regression', () => {
  const mainSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'main.ts'), 'utf8');
  const uiSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'modules', 'codex-workshop.js'), 'utf8');
  const queueSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'modules', 'publish-queue.js'), 'utf8');
  const postingSource = fs.readFileSync(path.join(process.cwd(), 'electron', 'ui', 'modules', 'posting.js'), 'utf8');

  test('login check uses each CLI\'s non-billable status command instead of a model turn', () => {
    expect(mainSource).toContain('const AGENT_LOGIN_VERIFY_TIMEOUT_MS');
    expect(mainSource).toContain('function buildAgentLoginVerifyCommand');
    expect(mainSource).toContain('async function verifyAgentLoginSession');
    expect(mainSource).toContain("args: ['login', 'status']");
    expect(mainSource).toContain("args: ['auth', 'status']");
    expect(mainSource).toContain('function parseAgentLoginStatus');
    expect(mainSource).not.toContain("args: ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', prompt]");
  });

  test('login launcher uses the provider authentication flow rather than a generic browser login page', () => {
    expect(mainSource).toContain("? 'claude auth login'");
    expect(mainSource).toContain("args: ['auth', 'login']");
    expect(mainSource).toContain('const launched = spawnAgentLoginProcess(profile);');
    expect(mainSource).toContain('waitForAgentLoginUrl(launched.child, profile.provider)');
    expect(mainSource).not.toContain('await openAgentLoginInSystemBrowser(fallbackUrl);');
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
    expect(uiSource).toContain("button.textContent = '실제 연동 확인 중...'");
    expect(uiSource).toContain("checkAgentLoginStatus(profile.provider, profile.id, { verify: true, showStatus: true })");
    expect(uiSource).toContain('return refreshAgentSettingsAndVerify(state.activeAgentProvider)');
  });

  test('agent queue verifies the selected profile up front and never silently falls back to API generation', () => {
    expect(uiSource).toContain('window.verifyActiveAgentLogin');
    expect(queueSource).toContain('Agent · 이미지 엔진 · 발행 플랫폼 실제 연동 확인 중');
    expect(queueSource).toContain('await window.verifyAgentExecutionReadiness');
    expect(postingSource).toContain("const wantsAgentGeneration = executionMode === 'agent'");
    expect(postingSource).toContain("if (typeof window.runAgentJobFromPosting !== 'function')");
    expect(postingSource).toContain('if (isQueueRun && wantsAgentGeneration)');
  });

  test('every agent queue item clears the previous generated article before generation', () => {
    expect(queueSource).toContain('appState.generatedContent = null;');
    expect(postingSource).toContain('&& (!appState.generatedContent?.content?.trim() || isQueueRun)');
  });

  test('agent mode exposes a real execution readiness check and blocks publishing when an integration is missing', () => {
    expect(uiSource).toContain('Agent 실행 준비 상태');
    expect(uiSource).toContain('async function verifyAgentExecutionReadiness');
    expect(uiSource).toContain('function openAgentIntegrationFix');
    expect(uiSource).toContain('바로 연동하기');
    expect(uiSource).toContain('실제 연동 새로고침');
    expect(uiSource).toContain('window.verifyAgentExecutionReadiness = verifyAgentExecutionReadiness;');
    expect(queueSource).toContain('verifyQueueAgentExecutionReadiness');
    expect(queueSource).toContain('await window.verifyAgentExecutionReadiness');
    expect(postingSource).toContain('Agent 실행 준비 확인 실패');
    expect(postingSource).toContain('window.verifyAgentExecutionReadiness');
  });
});
