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

describe('① 스킨을 지웠다가 되살린다', () => {
  test('우리 스킨만 골라 보관한다', () => {
    expect(publisher).toContain('const keptSkinBlocks');
    expect(publisher).toMatch(/\/\\\.bgpt-content\\b\/\.test\(inner\)|\.bgpt-content\\b\/\.test/);
  });

  test('퍼블리셔 CSS 뒤에 다시 싣는다 — 나중 규칙이 이겨야 스킨이 산다', () => {
    expect(publisher).toContain('const skinCSS = keptSkinBlocks.join');
    const wrap = publisher.slice(publisher.indexOf('const wrappedContent'));
    expect(wrap).toMatch(/\$\{themeFriendlyCSS\}\$\{foldedCSS\}\$\{skinCSS\}/);
  });

  test('여전히 낡은 style 은 걷어낸다 — 안 지우면 퍼블리셔 CSS 와 충돌한다', () => {
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

describe('에이전트를 고르면 연결부터 확인한다', () => {
  test('연결 확인을 먼저 부른다', () => {
    expect(badges).toContain('window.verifyAgentExecutionReadiness');
  });

  test('연결이 안 됐으면 환경설정을 연다', () => {
    const block = badges.slice(badges.indexOf('if (!ready)'));
    expect(block).toContain('window.openSettingsModal');
    expect(block).toContain('Agent 계정에서 로그인한 뒤');
  });

  test('연결 안 된 채로 모드를 바꾸지 않는다 — 발행할 때야 실패하면 늦다', () => {
    const guard = badges.indexOf('if (!ready)');
    const setMode = badges.indexOf("window.setAgentExecutionMode('agent')");
    expect(guard).toBeGreaterThan(-1);
    expect(setMode).toBeGreaterThan(guard);   // 확인 뒤에만 모드가 바뀐다
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
