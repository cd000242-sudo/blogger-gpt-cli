/**
 * v3.8.733 — 사장님이 한 번에 세 가지를 짚었다.
 *
 *   ① "로그인되어있는데 이렇게뜨네요"
 *      실측: `codex login status` 는 auth.json 이 **있는지**만 본다. 서버가 세션을
 *      끊어도 `Logged in using ChatGPT` + 종료코드 0 을 준다. 그래서 환경설정은
 *      "로그인 완료"라 적어 놓고 연속발행은 첫 글에서 401 로 죽었다.
 *      2026-09-17 실측: 앱 계정 3개 전부 revoked(3.5~3.8초) / 터미널 계정 live(0.5초).
 *
 *   ② "연속발행에는 지피티 이미지 2.5 안넣었네요"
 *      라벨 표(QUEUE_LABELS.thumb)에는 2.5 가 있었는데 **고르는 칸**에만 없었다.
 *
 *   ③ "제미나이 cli도 넣을수있게해주시구요"
 *      제미나이는 v3.8.608/612 에 이미 들어갔는데, 렌더러·메인 여러 곳이
 *      `=== 'claude' ? 'claude' : 'codex'` 로 접어 고르면 코덱스로 둔갑했다.
 *      거미줄(internal-links)·외부유입은 그 값이 payload 에 실려 **실제로 코덱스가 돌았다**.
 */
import * as fs from 'fs';
import * as path from 'path';

const read = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');

const queue = read('electron', 'ui', 'modules', 'publish-queue.js');
const workshop = read('electron', 'ui', 'modules', 'codex-workshop.js');
const internalLinks = read('electron', 'ui', 'modules', 'internal-links.js');
const externalTraffic = read('electron', 'ui', 'modules', 'external-traffic.js');
const posting = read('electron', 'ui', 'modules', 'posting.js');
const mainTs = read('electron', 'main.ts');
const mainJs = read('electron', 'main.js');

describe('② 연속발행에서 GPT 이미지 2.5 를 고를 수 있다', () => {
  const engines = ['gptimage25flare', 'gptimage25sunburst'];

  it('⭐ 일괄편집 썸네일 · 소제목, 카드별 썸네일 · 소제목 네 칸 모두에 있다', () => {
    for (const engine of engines) {
      // 네 개의 select 에 각각 한 번씩 = 4회
      const hits = queue.split(`value="${engine}"`).length - 1;
      expect(hits).toBe(4);
    }
  });

  it('⭐ 카드별 칸은 이미 고른 값을 selected 로 되살린다 (고르면 되돌아가지 않는다)', () => {
    for (const engine of engines) {
      expect(queue).toContain(`item.thumb === '${engine}' ? 'selected' : ''`);
      expect(queue).toContain(`item.h2ImageSource === '${engine}' ? 'selected' : ''`);
    }
  });

  it('⭐ 큐 카드 라벨 표에도 이름이 있다 (영문 값이 그대로 뜨지 않게)', () => {
    expect(queue).toContain('gptimage25flare:');
    expect(queue).toContain('gptimage25sunburst:');
  });

  it('⭐ 2.5 도 느린 엔진으로 잡혀 발행 간격 바닥값을 받는다', () => {
    const slowPattern = queue.match(/if \(\/\((?:.*?)\)\/i\.test\(raw\)\) return 'slow';/);
    expect(slowPattern).not.toBeNull();
    expect(slowPattern![0]).toContain('gptimage');
  });
});

describe('③ 제미나이를 코덱스로 접지 않는다', () => {
  const collapsed = /=== *'claude' *\? *'claude' *: *'codex'/;

  /** 주석은 뺀다 — 이 실수를 설명한 주석까지 걸리면 검사기가 제 그림자를 잡는다 */
  const codeOnly = (source: string) => source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

  it('⭐ 검사기 자체가 동작한다 — 접는 패턴을 실제로 잡는다', () => {
    expect(codeOnly("const p = raw === 'claude' ? 'claude' : 'codex';")).toMatch(collapsed);
    expect(codeOnly("// 예전엔 === 'claude' ? 'claude' : 'codex' 였다")).not.toMatch(collapsed);
  });

  it.each([
    ['publish-queue.js', queue],
    ['internal-links.js', internalLinks],
    ['external-traffic.js', externalTraffic],
    ['posting.js', posting],
  ])('⭐ %s 에 접는 패턴이 남아 있지 않다', (_name, source) => {
    expect(codeOnly(source)).not.toMatch(collapsed);
  });

  it('⭐ main.ts 도 payload 의 제공자를 표로 정규화한다 (거미줄 · 외부유입)', () => {
    expect(mainTs).toContain('normalizeAgentProvider((payload as any).agentProvider)');
    expect(mainTs).toContain('findAgentProfile(undefined, normalizeAgentProvider(payload.agentProvider))');
    expect(mainTs).not.toMatch(/\(payload as any\)\.agentProvider === 'claude'/);
  });

  it('⭐ 거미줄이 IPC 로 보내는 값에 gemini 가 살아 있다', () => {
    expect(internalLinks).toContain("['codex', 'claude', 'gemini'].includes(String(agentProvider || '').toLowerCase())");
  });

  it('⭐ 큐가 제공자 이름을 표에서 찾는다 (제미나이가 "Codex" 로 불리지 않게)', () => {
    expect(queue).toContain("gemini: 'Gemini CLI'");
    expect(queue).toContain('QUEUE_AGENT_LABELS[provider]');
  });

  it('⭐ 에이전트 진행 모달도 제미나이를 제 이름으로 부른다', () => {
    expect(posting).toContain("gemini: 'Gemini CLI'");
  });
});

describe('① codex 로그인 점검이 파일이 아니라 서버에 묻는다', () => {
  it('⭐ 2단계 프로브가 둘 다 있다 — 공짜 HTTP 조회 + CLI 실행', () => {
    expect(mainTs).toContain('function probeCodexSessionLive');
    expect(mainTs).toContain('function runCodexExecProbe');
  });

  it('⭐ access_token 이 만료면 HTTP 로 단정하지 않고 CLI 에게 갱신을 시킨다', () => {
    // 사장님 계정 셋이 전부 이 경우였다 — 1단계만 있으면 통째로 놓친다
    expect(mainTs).toContain('if (stored.expiresAt <= Date.now()) return runCodexExecProbe(profile);');
  });

  it('⭐ 조회 주소에 client_version 이 붙어 있다 (없으면 400 이라 판정이 안 선다)', () => {
    expect(mainTs).toContain('/backend-api/codex/models?client_version=');
  });

  it('⭐ 프로브가 refresh 를 돌리지 않는다 (1회용이라 돌리면 CLI 토큰이 죽는다)', () => {
    expect(mainTs).not.toContain('grant_type=refresh_token');
    expect(mainTs).not.toContain('/oauth/token');
  });

  it('⭐ 실행 프로브는 stdin 을 막는다 — 안 막으면 입력을 기다리다 25초 통째로 timeout 이다', () => {
    const block = mainTs.slice(mainTs.indexOf('function runCodexExecProbe'));
    expect(block.slice(0, 2600)).toContain("stdio: ['ignore', 'pipe', 'pipe']");
  });

  it('⭐ 한도 초과를 인증 만료로 오판하지 않는다', () => {
    const block = mainTs.slice(mainTs.indexOf('function runCodexExecProbe'), mainTs.indexOf('async function probeCodexSessionLive'));
    expect(block).toContain("CODEX_OUT_OF_CREDITS_RE.test(output)");
    expect(block).toContain("return done('live')");
  });

  it('⭐ 프로브 결과가 실제 판정에 실린다 (계산만 하고 안 쓰면 그대로 조용한 실패다)', () => {
    expect(mainTs).toContain("const authRequired = cliSaysAuthRequired || sessionProbe === 'revoked';");
  });

  it('⭐ 서버가 거절한 경우와 로그인 기록이 없는 경우를 다르게 말해준다', () => {
    expect(mainTs).toContain('서버가 세션을 거절했습니다');
  });

  it('⭐ 빌드 산출물에도 실려 있다 — 앱이 실제로 실행하는 건 main.js 다', () => {
    expect(mainJs).toContain('runCodexExecProbe');
    expect(mainJs).toContain('probeCodexSessionLive');
  });
});

describe('① 이 PC 로그인 가져오기 — 버튼과 핸들러가 맞물린다', () => {
  it('⭐ 메인에 채널이 있고 빌드에도 실렸다', () => {
    expect(mainTs).toContain("ipcMain.handle('agent-mode:import-system-login'");
    expect(mainJs).toContain('agent-mode:import-system-login');
  });

  it('⭐ 렌더러 버튼이 같은 채널을 부른다 (id 가 어긋나면 조용히 아무 일도 안 난다)', () => {
    expect(workshop).toContain('data-agent-import-system=');
    expect(workshop).toContain("api?.invoke?.('agent-mode:import-system-login'");
    expect(workshop).toContain("detail.querySelectorAll('[data-agent-import-system]')");
  });

  it('⭐ 제미나이에는 버튼을 달지 않는다 — 인증을 파일 한 곳에 두지 않아 복사가 안 된다(실측 0.51.0)', () => {
    expect(workshop).toContain("${provider === 'gemini' ? '' :");
  });

  it('⭐ 가져온 뒤 바로 서버에 확인한다 — 죽은 걸 가져와 놓고 준비됐다고 하면 안 된다', () => {
    const block = mainTs.slice(mainTs.indexOf("ipcMain.handle('agent-mode:import-system-login'"));
    expect(block.slice(0, 4000)).toContain('await verifyAgentLoginSession(profile)');
  });

  it('⭐ 원본은 건드리지 않고 복사만 한다', () => {
    const block = mainTs.slice(mainTs.indexOf("ipcMain.handle('agent-mode:import-system-login'"));
    const body = block.slice(0, 4000);
    expect(body).toContain('fs.copyFileSync(');
    expect(body).not.toContain('fs.renameSync(');
    expect(body).not.toContain('fs.rmSync(');
  });
});
