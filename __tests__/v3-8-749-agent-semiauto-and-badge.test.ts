/**
 * v3.8.749 — 에이전트 모드 두 버그 (사장님 실사용 보고 2026-09-23)
 *
 * ① "에이전트로 선택하고 반자동 발행을 했는데" → OpenAI 429(크레딧 0) 로 죽었다.
 *    콘솔: generatePreview (preview.js:184) ← startSemiAutoPublish (preview.js:285), model=gpt-5.6-terra
 *    원인: 정상 발행(posting.js runPosting)은 leadernamExecutionMode==='agent' 면 runAgentJobFromPosting 으로 보내는데,
 *          반자동(generatePreview)은 이 값을 **아예 안 보고** 무조건 window.blogger.runPost(API 경로)를 불렀다.
 *          payload 조립 경로가 여러 개라 한 곳에만 배선된 전형적인 조용한 미배선이다.
 *
 * ② "배지랑 엔진은 에이전트 선택하면 바로 바뀌어야 되는데 바뀌는 속도가 너무 느린데"
 *    원인: setExecutionMode 가 상태를 저장(saveExecutionPrefs)하기 **전에** 느린 CLI 감지(loadAgentModeStatus(true))를 기다렸다.
 *          배지는 저장된 값(localStorage)을 읽으므로 그동안 옛 값(api)을 보여 줬다.
 *          배지 쪽의 선행 연결 확인은 모드가 아직 api 라 즉시 skipped 를 돌려주는 사실상 빈 호출이었다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { braceBlock } from './helpers/source-block';

const ROOT = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const preview = read('electron/ui/modules/preview.js');
const badges = read('electron/ui/modules/header-badges.js');
const workshop = read('electron/ui/modules/codex-workshop.js');

describe('① 반자동 발행도 에이전트 모드를 따른다', () => {
  const gen = braceBlock(preview, 'export async function generatePreview()');

  it('generatePreview 가 실행 모드(leadernamExecutionMode)를 읽는다', () => {
    expect(gen).toContain("localStorage.getItem('leadernamExecutionMode')");
  });

  it('에이전트 모드면 runAgentJobFromPosting 으로 생성한다 (API runPost 가 아니라)', () => {
    const agentAt = gen.indexOf('window.runAgentJobFromPosting(payload)');
    const apiAt = gen.indexOf('window.blogger.runPost(payload)');
    expect(agentAt).toBeGreaterThan(-1);
    expect(apiAt).toBeGreaterThan(-1);
    // 두 호출은 한 분기의 양쪽이어야 한다 — 에이전트 분기가 API 호출보다 먼저 판정된다
    expect(gen).toMatch(/executionMode === 'agent'[\s\S]*runAgentJobFromPosting\(payload\)[\s\S]*else[\s\S]*window\.blogger\.runPost\(payload\)/);
  });

  it('에이전트가 남긴 payload 표시(codexWorkshop 등)를 일반 payload 로 덮어쓰지 않는다', () => {
    // applyCodexResult 가 넣는 { provider:'codex-workshop', codexWorkshop:true, previewOnly:true } 를 지켜야
    // 나중에 편집기에서 발행할 때 에이전트 글로 다뤄진다
    expect(gen).toMatch(/generatedContent\.payload = result\.agentMode \? \(appState\.generatedContent\.payload \|\| payload\) : payload/);
  });

  it('에이전트 결과도 같은 뒤처리(플랫폼용 HTML 정리·미리보기 표시)를 탄다 — 결과를 같은 모양으로 맞춘다', () => {
    expect(gen).toMatch(/agentMode: true/);
    expect(gen).toContain("invoke('prepare-publish-content'");
  });
});

describe('② 에이전트를 고르면 배지·엔진이 바로 바뀐다', () => {
  const setMode = braceBlock(workshop, 'async function setExecutionMode(mode)');

  it('상태를 먼저 저장하고(saveExecutionPrefs) 그다음에 느린 CLI 감지를 기다린다', () => {
    const saveAt = setMode.indexOf('saveExecutionPrefs()');
    const slowAt = setMode.indexOf('await loadAgentModeStatus(true)');
    expect(saveAt).toBeGreaterThan(-1);
    expect(slowAt).toBeGreaterThan(-1);
    expect(saveAt).toBeLessThan(slowAt);
  });

  it('라이선스 게이트는 그대로 — 막히면 api 로 되돌리고 알린다', () => {
    expect(setMode).toContain('isMaxAgentAllowed(status)');
    expect(setMode).toMatch(/alert\(agentBlockedMessage\(status\)\)[\s\S]*state\.executionMode = 'api'/);
  });

  it('배지는 느린 확인을 먼저 기다리지 않는다 — 모드를 바꾸고 곧바로 다시 그린다', () => {
    const agentBranch = badges.slice(badges.indexOf("data-hb-exec"), badges.indexOf('function buildModelPop'));
    const setAt = agentBranch.indexOf("window.setAgentExecutionMode('agent')");
    // 이름이 아니라 **호출**을 찾는다 — 설명 주석에 함수 이름이 남아 있어도 코드가 부르지 않으면 된다
    const verifyCall = agentBranch.match(/verifyAgentExecutionReadiness\s*\??\.?\s*\(/);
    const verifyAt = verifyCall ? agentBranch.indexOf(verifyCall[0]) : -1;
    expect(setAt).toBeGreaterThan(-1);
    // 선행 연결 확인(verify)이 모드 변경보다 앞에 있으면 안 된다
    expect(verifyAt === -1 || verifyAt > setAt).toBe(true);
    // 바꾸자마자 한 번, 게이트 결과가 나온 뒤 한 번 더 그린다(되돌림 반영)
    const after = agentBranch.slice(setAt);
    expect((after.match(/renderExecutionModeBadge\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
