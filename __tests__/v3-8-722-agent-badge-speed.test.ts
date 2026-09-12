/**
 * 배지 전환이 느리고 앱이 무겁던 문제 (v3.8.722)
 *
 * 사장님: "배지 에이전트로 선택했는데 너무 느리게 바뀌고 앱이 전체적으로 렉도 좀 있고 무거워진 느낌인데..."
 *
 * ## 두 가지가 따로 있었다
 *
 * ① **배지 전환이 느린 것** — CLI 감지가 한 번의 클릭에서 세 번 돌았다.
 *    실측(사장님 PC): codex 179ms · claude 88ms · **gemini 3,055ms**.
 *    병렬로 돌려도 가장 느린 하나가 전체를 잡으니 한 번에 ≈3.1초, 세 번이면 ≈9초.
 *
 * ② **앱 전체가 무거운 것** — 앱이 켜지는 순간부터 **1초마다** 패널 두 개의 innerHTML 을
 *    통째로 다시 만들고 있었다. 멈추는 코드가 없어 환경설정을 한 번도 안 열어도 계속 돌았다.
 *    게다가 그 패널에는 초 단위로 변하는 값이 없다(사용량 창은 시간 단위).
 */
import * as fs from 'fs';
import * as path from 'path';
import { blockBetween } from './helpers/source-block';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const main = read('electron/main.ts');
const workshop = read('electron/ui/modules/codex-workshop.js');

describe('① CLI 감지를 기억한다 (gemini 하나가 3초를 먹는다)', () => {
  it('⭐⭐ 감지에 캐시를 씌웠다', () => {
    expect(main).toContain('detectAgentBinariesCached');
    expect(main).toContain('AGENT_BINARY_CACHE_TTL_MS');
  });

  it('⭐⭐ 상태 조회가 캐시를 통해서만 감지한다 (직접 호출이 남아 있으면 무효다)', () => {
    const handler = main.slice(
      main.indexOf("ipcMain.handle('agent-mode:get-status'"),
      main.indexOf("ipcMain.handle('agent-mode:list-profiles'"),
    );
    expect(handler).toContain('detectAgentBinariesCached');
    expect(handler).not.toContain('providerIds.map((id) => detectAgentBinary(');
  });

  it('⭐⭐ 설치·로그인 뒤에는 기억을 버린다 (안 버리면 설치하고도 "미설치" 로 보인다)', () => {
    /**
     * braceBlock 은 쓸 수 없다 — 표식 뒤 첫 `{` 가 매개변수 타입(`{ provider?: string }`)이라
     * 함수 본문이 아니라 그 조각을 돌려준다. 핸들러 첫 줄부터 첫 작업까지를 경계로 잡는다.
     */
    for (const channel of ['agent-mode:install-tool', 'agent-mode:start-login']) {
      const head = blockBetween(
        main,
        `ipcMain.handle('${channel}'`,
        'const access = await getAgentModeAccessStatus();',
      );
      expect(head).toContain('invalidateAgentBinaryCache()');
    }
  });
});

describe('② 같은 클릭에서 상태를 두 번 받지 않는다', () => {
  it('⭐⭐ 로그인 확인이 상태를 강제로 다시 받지 않는다', () => {
    const fn = workshop.slice(
      workshop.indexOf('async function verifyActiveAgentLogin'),
      workshop.indexOf('async function refreshAgentSettingsAndVerify'),
    );
    expect(fn).toContain('loadAgentModeStatus(!state.agentStatus)');
    // 주석에 옛 호출이 설명으로 적혀 있으므로 **코드 줄만** 본다
    const codeLines = fn
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\*|\/\/)/.test(line));
    expect(codeLines.join('\n')).not.toContain('loadAgentModeStatus(true)');
  });
});

describe('③ 안 보이는 화면을 1초마다 다시 그리지 않는다', () => {
  it('⭐⭐ 주기가 1초가 아니다', () => {
    expect(workshop).toContain('USAGE_TIMER_INTERVAL_MS = 5000');
    expect(workshop).not.toMatch(/setInterval\(renderUsagePanels, 1000\)/);
  });

  it('⭐⭐ 화면에 보일 때만 그린다', () => {
    expect(workshop).toContain('function usagePanelsVisible');
    const timer = workshop.slice(
      workshop.indexOf('function startUsageTimer'),
      workshop.indexOf('function setSettingsStatus'),
    );
    expect(timer).toContain('if (!usagePanelsVisible()) return;');
  });

  it('⭐⭐ 내용이 같으면 DOM 을 건드리지 않는다', () => {
    expect(workshop).toContain('function writeIfChanged');
    // 두 패널 모두 그 함수를 거쳐야 한다 — 한쪽만 고치면 절반은 계속 갈아엎는다
    expect(workshop).toContain('writeIfChanged(target, cards.map(');
    expect(workshop).toContain('writeIfChanged(detail, `');
    expect(workshop).not.toMatch(/target\.innerHTML = cards\.map\(/);
    expect(workshop).not.toMatch(/detail\.innerHTML = `/);
  });
});
