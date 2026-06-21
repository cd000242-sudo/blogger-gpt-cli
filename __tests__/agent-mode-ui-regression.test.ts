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

  test('agent mode keeps image generation on the app API dispatcher', () => {
    const workshop = read('electron/ui/modules/codex-workshop.js');
    const posting = read('electron/ui/modules/posting.js');
    const main = read('electron/main.ts');

    expect(workshop).toContain('Codex는 글만 생성합니다. 실제 이미지는 선택한 앱 이미지 엔진/API로 별도 생성합니다.');
    expect(workshop).toContain('이미지는 Orbit 이미지 엔진/API로 생성합니다.');
    expect(workshop).toContain('removeAgentSuppliedImages');
    expect(workshop).not.toContain('Codex GPT-Image-2로');
    expect(workshop).not.toContain('dispatcher skip');

    expect(posting).not.toContain('imageManagedBy');
    expect(posting).not.toContain('agentImageManaged');

    expect(main).toContain('Agent는 텍스트 글만 생성합니다.');
    expect(main).toContain('실제 썸네일/본문 이미지는 Agent 실행 후 Orbit 앱의 이미지 엔진/API가 생성합니다.');
    expect(main).toContain('image_gen, pollinations.ai, 외부 이미지 URL');
    expect(main).not.toContain('result/images/thumbnail.png');
    expect(main).not.toContain('diagnostic.txt');
  });

  test('flow labels disclose Google AI Plus or Pro subscription requirement', () => {
    const index = read('electron/ui/index.html');
    const script = read('electron/ui/script.js');

    expect(index).toContain('Flow 무료 사용은 Google AI Plus/Pro 구독 계정 로그인이 필요합니다.');
    expect(index).toContain('Flow (Google AI Plus/Pro 구독 시 무료');
    expect(script).toContain('Flow 무료 사용은 Google AI Plus/Pro 구독 계정 기준');
  });
});
