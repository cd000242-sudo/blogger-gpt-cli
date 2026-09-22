/**
 * v3.8.613 — ① API 경로에서 스킨이 벗겨지던 것 ② 실행 모드 배지
 *
 * 사장님:
 *   "에이전트로 글발행한스킨과 API로 글발행한 스킨이 다르네요"
 *   "배찌를 하나더 만들어서 에이전트모드랑 API모드 둘중하나 선택할수있게해주고
 *    에이전트를 선택하면 에이전트만 보여주고 API면 API만보여줘
 *    특히 에이전트는 연결됫는지 확인먼저하고 연동이안되어있다면 환경설정을 열어줘"
 *
 * 실측(발행글 5451, API 경로): 「먹과 놋쇠」의 핵심이 통째로 없었다 —
 *   Gowun Batang 0 · @import 0 · .bgpt-content h2 0 · tabular-nums 0
 * 퍼블리셔가 본문의 <style> 을 전부 지우고 자기 CSS 로 갈아끼우기 때문이었다.
 * 에이전트 경로는 그 함수를 건너뛰므로(bgpt-wp-ready 가드) 스킨이 살아남았다 — 그래서 달랐다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const publisher = read('src/wordpress/wordpress-publisher.ts');
const badges = read('electron/ui/modules/header-badges.js');
const html = read('electron/ui/index.html');

/**
 * v3.8.749 — 요구("API 글도 에이전트 글과 같은 스킨")는 그대로, 방법이 바뀌었다.
 * 예전: 스킨을 지웠다가 퍼블리셔 CSS 뒤에 되살렸다. 그런데 퍼블리셔가 h2·p·th… 에 박은 인라인 style 과
 * 접은 클래스(점수 0,4,0)가 여전히 스킨을 이겨, 실측(5814)에서 제목이 퍼블리셔 디자인으로 그려졌다.
 * 이제: 스킨을 실은 글은 퍼블리셔가 본문 정리만 하고 모양은 손대지 않는다 — 에이전트 글과 같은 길이다.
 */
describe('① API 글도 스킨이 벗겨지지 않는다', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { generateCSSFinal } = require('../src/core/final/html');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { applyWordPressInlineStyles } = require('../src/wordpress/wordpress-publisher');
  const skin: string = generateCSSFinal('wordpress', 'external');
  const out: string = applyWordPressInlineStyles(`${skin}<div class="bgpt-content"><h2>제목</h2><p>본문</p></div>`);

  test('스킨 <style> 이 한 글자도 안 바뀌고 그대로 실린다', () => {
    const blocks = out.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
    expect(blocks).toEqual([skin.trim()]);
  });

  test('스킨을 이기는 덧칠(인라인 style·접은 클래스)을 하지 않는다', () => {
    expect(out).not.toMatch(/<(h2|p)\b[^>]*\sstyle=/i);
    expect(out).not.toMatch(/\bbgpt-s\d+\b/);
  });

  test('스킨 없는 글의 낡은 style 은 여전히 걷어낸다 — 안 지우면 퍼블리셔 CSS 와 충돌한다', () => {
    expect(publisher).toMatch(/styledHtml = styledHtml\.replace\(\/<style/);
  });
});

describe('② 실행 모드 배지', () => {
  test('배지가 화면에 있다', () => {
    expect(html).toContain('id="executionModeStatus"');
    expect(html).toContain('실행:');
  });

  test('배지가 배선돼 있다 (조용한 미배선 방지)', () => {
    expect(badges).toContain("document.getElementById('executionModeStatus')");
    expect(badges).toContain('wireBadge(execBadge, buildExecutionModePop)');
  });

  test('두 모드를 고를 수 있다', () => {
    expect(badges).toContain('data-hb-exec="api"');
    expect(badges).toContain('data-hb-exec="agent"');
  });

  test('없는 배지에 조용히 붙지 않는다', () => {
    expect(badges).toContain('executionModeStatus 배지를 찾지 못했습니다');
  });
});

/**
 * v3.8.749 — 요구는 그대로, 검사는 **동작**을 본다.
 *
 * 예전 검사는 "확인(if (!ready))이 모드 변경보다 소스에서 앞에 있는가" 만 봤다. 그런데 그 확인은 모드가 아직 api 일 때
 * 불려 늘 skipped(통과)를 돌려줬다 — **한 번도 막은 적이 없는데 검사는 통과**했다(검사기가 고장 난 경우).
 * 그 순서가 배지를 느리게 만든 원인이기도 했다(사장님: "에이전트 선택하면 바로 바뀌어야 되는데 너무 느린데").
 * 이제: 바로 바꿔 그리고 → 모드를 바꾼 뒤의 진짜 확인 결과로 → 로그인이 안 됐으면 api 로 되돌리고 안내한다.
 */
describe('에이전트를 고르면 연결부터 확인한다', () => {
  const workshop = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ui', 'modules', 'codex-workshop.js'), 'utf8');
  const loginFail = badges.slice(badges.indexOf("c.id === 'agent'"), badges.indexOf('function buildModelPop'));

  test('연결 확인 결과로 판단한다 — 모드를 바꾼 뒤의 진짜 확인(로그인 항목 id "agent")', () => {
    expect(workshop).toContain('return verifyAgentExecutionReadiness({ showStatus: false });');
    expect(badges).toContain('readiness = await pending');
    expect(badges).toContain("readiness.checks.find((c) => c && c.id === 'agent')");
  });

  test('연결이 안 됐으면 환경설정을 연다', () => {
    expect(loginFail).toContain('window.openSettingsModal');
    expect(loginFail).toContain('Agent 계정에서 로그인한 뒤');
  });

  test('연결 안 된 채로 에이전트 모드에 남지 않는다 — 발행할 때야 실패하면 늦다', () => {
    // 로그인 실패 분기 안에서 api 로 되돌린다
    expect(loginFail).toMatch(/loginCheck\.ready === false[\s\S]*window\.setAgentExecutionMode\('api'\)/);
  });
});

describe('고른 모드의 목록만 보여준다', () => {
  test('에이전트 모드면 에이전트만', () => {
    expect(badges).toMatch(/pop\.innerHTML = agentMode[\s\S]{0,200}에이전트 — 구독으로 실행/);
  });

  test('API 모드면 API 모델만', () => {
    expect(badges).toMatch(/: `<div class="hb-t">글 생성 AI 모델/);
  });

  test('반대편으로 가는 길을 알려준다', () => {
    expect(badges).toContain("왼쪽 '실행' 배지에서 API 키 모드를 고르세요");
    expect(badges).toContain("왼쪽 '실행' 배지에서 에이전트 모드를 고르세요");
  });

  test('모드가 바뀌면 실행 배지도 따라온다', () => {
    expect((badges.match(/renderExecutionModeBadge\(\)/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
