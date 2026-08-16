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

  test('settings modal still loads the deferred agent UI (now without blocking display)', () => {
    /**
     * v3.8.506: 모달이 에이전트 모듈 로드를 기다렸다가 떠서 "환경설정이 오래
     * 렌더링된다"(사장님 보고). 이제 표시가 먼저, 로드는 병렬이다.
     * 이 테스트의 원래 의도(에이전트 구역이 반드시 로드된다)는 그대로 지킨다 —
     * openSettingsModal 이 resolve 하기 전에 allSettled 로 기다리기 때문.
     */
    const main = read('electron/ui/modules/main.js');
    const ui = read('electron/ui/modules/ui.js');

    expect(main).toContain('window.ensureAgentModeSettingsReady = async () =>');
    expect(main).toContain("document.getElementById('agentModeSettingsSection')");
    const fn = ui.slice(ui.indexOf('export async function openSettingsModal'), ui.indexOf('export function closeSettingsModal'));
    expect(fn).toContain('ensureAgentModeSettingsReady');   // 여전히 부른다
    expect(fn).toContain('Promise.allSettled');             // resolve 전에 기다린다
    // 표시가 로드보다 앞 — 이게 이번 수정의 핵심이다
    expect(fn.indexOf("modal.style.display = 'flex'"))
      .toBeLessThan(fn.indexOf('ensureAgentModeSettingsReady'));
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
