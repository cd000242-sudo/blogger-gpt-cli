/**
 * v3.8.598 — ① 로그아웃을 로그아웃이라고 말한다 ② 엔진 선택기에서 에이전트를 고른다
 *
 * ## ① 실측 사고
 * 사장님: "에이전트모드로하니까 산출물을 찾지못했다고 오류가나는데요"
 * 작업 폴더(agent-jobs/…-비즈스캔-b88ct)의 result 는 비어 있었고, 세션 기록의
 * 마지막 응답이 "Not logged in · Please run /login" 한 줄이었다.
 * 인증 안내 분기가 전부 `provider === 'codex'` 로 막혀 있어 claude 프로필은
 * 어디에도 안 걸리고 기본 문구로 떨어졌다.
 *
 * ## ② 사장님 지적
 * "AI 모델 드롭다운 배찌에 에이전트는없네요"
 * 상단 배지는 "Claude Code Agent" 로 표시되는데 선택기에서는 고를 수 없었다.
 *
 * 화면 배선은 **id·클래스가 실제로 있는지**가 전부다 — 없는 id 를 읽어도 에러가 안 난다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 로그아웃이면 로그아웃이라고 말한다', () => {
  const mainTs = read('electron/main.ts');
  const mainJs = read('electron/main.js');

  test('provider 를 가리지 않는 인증 분기가 기본 문구보다 먼저 온다', () => {
    for (const [name, src] of [['main.ts', mainTs], ['main.js', mainJs]] as const) {
      const authIdx = src.indexOf('AGENT_AUTH_REQUIRED_RE.test(combined)');
      const fallbackIdx = src.indexOf("return 'Agent 산출물을 찾지 못했습니다.'");
      expect(authIdx).toBeGreaterThan(-1);
      expect(fallbackIdx).toBeGreaterThan(-1);
      // 인증 분기가 뒤에 있으면 영영 도달하지 못한다
      expect(`${name}:${authIdx < fallbackIdx}`).toBe(`${name}:true`);
    }
  });

  test('안내가 재로그인 경로를 알려 준다 (실행본 main.js 포함)', () => {
    for (const src of [mainTs, mainJs]) {
      expect(src).toContain('로그인이 풀렸습니다');
      expect(src).toContain('설정 → Agent 계정');
    }
  });

  test('실제로 온 문장이 그 정규식에 걸린다', () => {
    const AGENT_AUTH_REQUIRED_RE = /not (?:logged in|authenticated)|please (?:log in|login)|login required|authentication required|auth(?:entication)? failed|unauthorized|401|run [`"]?(?:codex login|claude)[`"]?|invalid api key|no api key|oauth token/i;
    expect(AGENT_AUTH_REQUIRED_RE.test('Not logged in · Please run /login')).toBe(true);
  });
});

describe('② 엔진 선택기에서 에이전트를 고를 수 있다', () => {
  const html = read('electron/ui/index.html');
  const workshop = read('electron/ui/modules/codex-workshop.js');

  test('에이전트 카드 두 장이 선택기 안에 있다', () => {
    expect(html).toContain('class="agent-card" data-agent-provider="claude"');
    expect(html).toContain('class="agent-card" data-agent-provider="codex"');
    // 선택기(#textEnginePicker) 안에 있어야 스크립트가 잡는다
    const picker = html.slice(html.indexOf('id="textEnginePicker"'), html.indexOf('function refreshTierUI'));
    expect(picker).toContain('agent-card');
  });

  test('클릭이 부르는 함수가 실제로 window 에 열려 있다 (조용한 미배선 방지)', () => {
    for (const fn of ['setAgentExecutionMode', 'setAgentProvider', 'getAgentExecutionState']) {
      expect(html).toContain(`window.${fn}`);
      expect(workshop).toContain(`window.${fn} =`);
    }
  });

  test('localStorage 를 직접 쓰지 않는다 — 라이선스 게이트를 우회하면 안 된다', () => {
    const picker = html.slice(html.indexOf('id="textEnginePicker"'), html.indexOf('환경설정 모달이 열릴 때마다'));
    expect(picker).not.toContain('localStorage.setItem');
    // 표시용 폴백으로 읽기만 한다
    expect(picker).toContain('localStorage.getItem');
  });

  test('읽는 저장 키가 앱의 다른 곳과 같다', () => {
    const picker = html.slice(html.indexOf('id="textEnginePicker"'), html.indexOf('환경설정 모달이 열릴 때마다'));
    expect(picker).toContain('leadernamExecutionMode');
    expect(picker).toContain('leadernamActiveAgentProvider');
    // script.js 가 배지를 그릴 때 읽는 키와 동일해야 한다
    expect(read('electron/ui/script.js')).toContain('leadernamExecutionMode');
  });

  test('API 모델과 에이전트는 배타적이다', () => {
    const picker = html.slice(html.indexOf('id="textEnginePicker"'), html.indexOf('환경설정 모달이 열릴 때마다'));
    // API 카드를 고르면 에이전트 모드를 끈다
    expect(picker).toContain("window.setAgentExecutionMode('api')");
    // 에이전트를 고르면 켠다
    expect(picker).toContain("window.setAgentExecutionMode('agent')");
  });

  test('함수가 없으면 조용히 넘어가지 않고 알린다', () => {
    const picker = html.slice(html.indexOf('id="textEnginePicker"'), html.indexOf('환경설정 모달이 열릴 때마다'));
    expect(picker).toContain('에이전트 설정을 아직 불러오지 못했습니다');
  });
});
