/**
 * v3.8.608 — 세 번째 에이전트: Gemini CLI
 *
 * 사장님: "안티그래비티는없네요?" → 실측 결과 안티그래비티는 **IDE 창을 여는 런처**다.
 *   `antigravity-ide chat --help` 의 옵션이 전부 --maximize / --reuse-window / --new-window 로,
 *   창을 띄우고 멈춘다. 결과를 파일로 회수할 길이 없어 발행이 사람 손을 기다리며 선다.
 * 그래서 이미 깔려 있는 Gemini CLI 를 붙인다 (사장님 선택: "1").
 *
 * 실측(2026-08-30, gemini 0.51.0):
 *   -p / --prompt          헤드리스
 *   --approval-mode yolo   도구 승인 자동 (없으면 파일을 못 쓴다)
 *   -o json                결과 JSON
 *   GEMINI_CLI_HOME        프로필 격리 (번들에서 `|| join(os.homedir(), ".gemini")` 확인)
 *
 * ## 이 테스트가 지키는 것
 * 갈래가 `p === 'claude' ? A : B` 꼴이면 **세 번째는 조용히 codex 로 떨어진다** —
 * 골라도 안 바뀌고 에러도 없다. 그 꼴이 다시 생기지 않게 못을 박는다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const main = read('electron/main.ts');
const workshop = read('electron/ui/modules/codex-workshop.js');
const badges = read('electron/ui/modules/header-badges.js');
const script = read('electron/ui/script.js');
const html = read('electron/ui/index.html');

describe('제공자 표가 세 개를 안다', () => {
  test('타입에 gemini 가 있다', () => {
    expect(main).toContain("type AgentModeProvider = 'codex' | 'claude' | 'gemini'");
  });

  test('표에 실행 파일·격리 변수가 있다', () => {
    expect(main).toMatch(/gemini:\s*\{[^}]*binary: 'gemini'/);
    expect(main).toMatch(/gemini:\s*\{[^}]*envVar: 'GEMINI_CLI_HOME'/);
  });

  test('격리 변수를 표에서 찾는다 — 삼항으로 고르지 않는다', () => {
    expect(main).toContain('env[agentProviderInfo(profile.provider).envVar] = profile.profileDir');
    expect(main).not.toContain("provider === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'");
  });

  test('실행 파일도 표에서 찾는다', () => {
    expect(main).toContain('const binaryName = agentProviderInfo(provider).binary');
  });

  test('모르는 값만 codex 로 떨어진다 (gemini 는 살아남는다)', () => {
    expect(main).toContain("return (raw in AGENT_PROVIDERS ? raw : 'codex') as AgentModeProvider");
  });
});

describe('Gemini 실행 인자 — 실측한 플래그 그대로', () => {
  test('헤드리스로 돈다', () => {
    expect(main).toMatch(/geminiArgs\.push\('-p', prompt\)/);
  });

  test('도구 승인을 자동으로 — 이게 없으면 파일을 못 쓴다', () => {
    expect(main).toMatch(/'--approval-mode', 'yolo'/);
  });

  test('결과를 JSON 으로 받는다', () => {
    expect(main).toMatch(/gemini[\s\S]{0,400}'--output-format', 'json'/);
  });

  test('작업 폴더를 작업 범위에 넣는다', () => {
    expect(main).toMatch(/'--include-directories', jobDir/);
  });
});

describe('사람에게 보여줄 이름이 세 번째에서 안 깨진다', () => {
  test('main 에 Claude/Codex 이지선다 라벨이 남아 있지 않다', () => {
    expect(main).not.toMatch(/=== 'codex' \? 'Codex' : 'Claude Code'/);
  });

  test('작업실 UI 에도 이지선다 라벨이 없다', () => {
    expect(workshop).not.toContain("'Claude Code' : 'Codex'");
  });

  test('제공자 정규화가 세 개를 안다', () => {
    expect(workshop).toContain("const AGENT_PROVIDER_IDS = ['codex', 'claude', 'gemini']");
    expect(workshop).not.toContain("provider === 'claude' ? 'claude' : 'codex'");
  });
});

describe('화면에서 고를 수 있다', () => {
  test('배지 드롭다운에 Gemini 가 있다', () => {
    expect(badges).toContain("{ id: 'gemini'");
    expect(badges).toContain('Gemini CLI Agent');
  });

  test('배지 표시가 Gemini 를 안다 — 모르면 Codex 로 보인다', () => {
    expect(script).toContain('gemini:');
    expect(script).toContain('Gemini CLI Agent');
    expect(script).not.toContain("readJsonStorage('leadernamActiveAgentProvider', 'codex') === 'claude' ? 'claude' : 'codex'");
  });

  test('환경설정 엔진 선택기에도 카드가 있다', () => {
    expect(html).toContain('data-agent-provider="gemini"');
  });
});
