const fs = require('fs');
const path = require('path');

import { braceBlock, blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.711 — 사장님이 실사용 중 잡은 두 가지.
 *
 * ① "추론중인데 중지가안되냐" — regenerate-published-post 가 beginRun() 없이 돌아
 *    cancel-task 가 "진행 중인 작업이 없습니다"로 무시됐다(같은 계열 3번째 사고).
 *    진행 카드에는 중지 손잡이 자체가 없었다.
 * ② "엔진 왜자꾸 기본값이 3.1플래쉬로되있냐" — 티어 카드 클릭이 화면만 바꾸고
 *    저장을 안 해서, 재시작(자동 업데이트 포함)마다 기본값으로 되돌아갔다.
 *    + "앱을 열면 먼저 글생성엔진부터 선택하도록" 시작 게이트 부재.
 */
describe('v3.8.711 중지·엔진 기본값 수리', () => {
  const main = read('electron/main.ts');
  const ui = read('electron/ui/index.html');
  const modal = read('electron/ui/modules/regen-modal.js');
  const settings = read('electron/ui/modules/settings.js');
  const mainModule = read('electron/ui/modules/main.js');

  describe('① 재생성 중지', () => {
    test('재생성이 "도는 작업"으로 등록된다 — 등록 없으면 중지가 무시된다', () => {
      const handler = blockBetween(main, "ipcMain.handle('regenerate-published-post'", "ipcMain.handle('critique");
      expect(handler).toContain('beginRun()');
      expect(handler).toContain('endRun()');
      // 시작이 try 앞, 끝이 finally 안 — 실패해도 등록이 풀려야 다음 중지가 산다
      expect(handler.indexOf('beginRun()')).toBeLessThan(handler.indexOf('const mode ='));
      expect(handler).toMatch(/finally \{[\s\S]*?endRun\(\)/);
    });

    test('사용자 중지는 실패가 아니라 canceled 로 돌아온다', () => {
      const handler = blockBetween(main, "ipcMain.handle('regenerate-published-post'", "ipcMain.handle('critique");
      expect(handler).toContain('canceled: true');
    });

    test('진행 카드에 중지 버튼이 있고 cancel-task 를 부른다', () => {
      expect(modal).toContain('regenTaskStop');
      expect(modal).toContain("invoke?.('cancel-task')");
      expect(modal).toContain('stop: (msg)');   // 중지 상태는 실패와 다른 얼굴
    });

    test('두 호출부 모두 canceled 를 중지로 표시한다', () => {
      for (const file of ['electron/ui/modules/editor.js', 'electron/ui/modules/published-posts.js']) {
        const src = read(file);
        expect(src).toContain('res?.canceled');
        expect(src).toContain('task.stop(');
      }
    });
  });

  describe('② 글 생성 엔진 저장·시작 게이트', () => {
    test('티어 카드를 누르는 순간 저장된다 — [저장] 버튼을 안 거쳐도', () => {
      expect(settings).toContain('export async function persistTextModelChoice');
      expect(settings).toContain('window.persistTextModelChoice = persistTextModelChoice');
      expect(ui).toContain('window.persistTextModelChoice(input.value)');
    });

    test('그 키 하나만 병합 저장한다 — 모달 안 연 상태의 빈 값으로 전체를 덮으면 안 된다', () => {
      const fn = braceBlock(settings, 'export async function persistTextModelChoice');
      expect(fn).toContain('{ ...saved, primaryGeminiTextModel: value }');
      expect(fn).not.toContain('saveSettings(');
    });

    test('앱을 열면 엔진 시작 게이트가 뜬다', () => {
      expect(ui).toContain('function showEngineStartupGate');
      expect(mainModule).toContain('window.showEngineStartupGate()');
    });

    test('게이트 선택지는 실제 라디오에서 읽는다 — 목록 두 벌 금지', () => {
      const gate = braceBlock(ui, 'function showEngineStartupGate');
      expect(gate).toContain('querySelectorAll(\'input[name="primaryGeminiTextModel"]\')');
      expect(gate).toContain('persistTextModelChoice');
      // 에이전트도 고를 수 있다 — 구독 사용자에게는 그쪽이 기본이다
      expect(gate).toContain("setAgentExecutionMode('agent')");
    });

    /*
     * v3.8.712 — 사장님: "UI신경좀 써줄래...?" (스크린샷: 이름·가격이 줄바꿈되고
     * 라디오와 글자가 따로 놀았다). 인라인 style 만 쓰면 내가 안 적은 레이아웃 속성을
     * 전역 CSS 가 가져간다. #id 로 못박은 스타일 블록에 전부 명시해 격리했다.
     * 실측(Playwright, 720px 카드): 13행 전부 nameLines=1 · radioOffset=14 · rowH=42.
     */
    test('게이트 스타일이 전역 CSS 에서 격리돼 있다 — 줄바꿈·정렬 붕괴 재발 방지', () => {
      const gate = braceBlock(ui, 'function showEngineStartupGate');
      expect(gate).toContain("id = 'engineGateStyle'");
      // 레이아웃을 결정하는 속성은 전부 #id 규칙에 적혀 있어야 한다
      expect(gate).toContain('#engineGateOverlay .eg-name');
      expect(gate).toMatch(/\.eg-name \{[^}]*white-space:nowrap/);
      expect(gate).toMatch(/\.eg-name \{[^}]*min-width:0/);
      expect(gate).toMatch(/\.eg-cost \{[^}]*white-space:nowrap/);
      expect(gate).toMatch(/\.eg-opt \{[^}]*justify-content:flex-start/);
      // 2열 그리드는 minmax(0,1fr) 이라야 칸이 내용에 밀려 넘치지 않는다
      expect(gate).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    });
  });
});
