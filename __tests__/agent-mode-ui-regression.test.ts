const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('agent mode settings UI regression guard', () => {
  test('codex workshop remains a valid browser module', () => {
    const workshop = read('electron/ui/modules/codex-workshop.js');

    expect(() => acorn.parse(workshop, {
      ecmaVersion: 'latest',
      sourceType: 'module',
    })).not.toThrow();
    expect(workshop).toContain('선택 계정 로그인');
    expect(workshop).toContain('상태 새로고침');
  });

  test('settings modal waits for the deferred agent UI', () => {
    const main = read('electron/ui/modules/main.js');
    const ui = read('electron/ui/modules/ui.js');

    expect(main).toContain('window.ensureAgentModeSettingsReady = async () =>');
    expect(main).toContain("document.getElementById('agentModeSettingsSection')");
    expect(ui).toContain('await window.ensureAgentModeSettingsReady()');
  });

  test('agent mode selector and provider tabs remain available', () => {
    const workshop = read('electron/ui/modules/codex-workshop.js');

    expect(workshop).toContain('id="executionModeApiBtn"');
    expect(workshop).toContain('id="executionModeAgentBtn"');
    expect(workshop).toContain('id="agentProviderTabCodex"');
    expect(workshop).toContain('id="agentProviderTabClaude"');
    expect(workshop).toContain('data-agent-add-account=');
    expect(workshop).toContain('로그인 계정 추가하기');
    expect(workshop).toContain('await startAgentLogin(selectedProvider, profile.id)');
    expect(workshop).toContain('export function ensureAgentModeSettingsSection()');
  });
});
