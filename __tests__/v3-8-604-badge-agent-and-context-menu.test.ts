/**
 * v3.8.604 — ① 배지 드롭다운에 에이전트 ② 오른쪽 클릭 복사·붙여넣기
 *
 * 사장님:
 *   "배찌에 AI 모델에는 에이전트가 왜없냐고 선택할수있게 드롭다운을 추가해주고 배선해줘야할꺼아냐..."
 *   "그리고 필드에 우측마우스 클릭하면 복사 붙혀넣기도가능하게해줘"
 *
 * 드롭다운 자체는 이미 있었다(header-badges.js). 에이전트만 목록에 없어서
 * 배지는 "Claude Code Agent" 라고 표시하면서 정작 고를 수는 없었다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 배지 드롭다운에서 에이전트를 고른다', () => {
  const badges = read('electron/ui/modules/header-badges.js');

  test('에이전트 두 개가 목록에 들어간다', () => {
    expect(badges).toContain('data-hb-agent');
    expect(badges).toContain('Claude Code Agent');
    expect(badges).toContain('Codex Agent');
  });

  test('localStorage 를 직접 쓰지 않는다 — 라이선스 게이트를 우회하면 안 된다', () => {
    expect(badges).toContain('window.setAgentExecutionMode');
    expect(badges).toContain('window.setAgentProvider');
    expect(badges).not.toContain("localStorage.setItem('leadernamExecutionMode'");
  });

  test('부르는 함수가 실제로 열려 있다 (조용한 미배선 방지)', () => {
    const workshop = read('electron/ui/modules/codex-workshop.js');
    expect(workshop).toContain('window.setAgentExecutionMode =');
    expect(workshop).toContain('window.setAgentProvider =');
  });

  test('API 모델을 고르면 에이전트 모드를 끈다 — 둘은 배타적이다', () => {
    expect(badges).toContain("window.setAgentExecutionMode('api')");
  });

  test('지금 무엇이 켜져 있는지 표시된다', () => {
    // 에이전트 모드면 해당 에이전트에, 아니면 고른 API 모델에 선택 표시
    expect(badges).toMatch(/agentMode && a\.id === agentProvider \? ' sel' : ''/);
    expect(badges).toMatch(/!agentMode && r\.value === cur \? ' sel' : ''/);
  });

  test('함수가 없으면 조용히 넘어가지 않고 알린다', () => {
    expect(badges).toContain('에이전트 설정을 아직 불러오지 못했습니다');
  });
});

describe('② 입력칸에서 오른쪽 클릭이 동작한다', () => {
  const main = read('electron/main.ts');
  const login = read('electron/main-login.ts');

  test('메인 창에 컨텍스트 메뉴를 붙인다', () => {
    expect(main).toContain('function attachContextMenu');
    expect(main).toContain('attachContextMenu(mainWindow.webContents)');
  });

  test('라이선스 키를 넣는 로그인 창에도 붙인다', () => {
    expect(login).toContain("webContents.on('context-menu'");
    expect(login).toContain('붙여넣기');
  });

  test('입력칸이면 잘라내기·복사·붙여넣기·전체 선택이 나온다', () => {
    for (const role of ['cut', 'copy', 'paste', 'selectAll']) {
      expect(main).toContain(`role: '${role}'`);
    }
  });

  test('선택한 글자가 없으면 잘라내기·복사는 비활성이다', () => {
    expect(main).toContain('enabled: hasSelection');
  });

  test('빈 메뉴는 띄우지 않는다', () => {
    expect(main).toMatch(/items\.length === 0\) return;/);
  });
});
