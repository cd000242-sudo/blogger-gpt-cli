/**
 * v3.8.606 — 에이전트 글에도 같은 스킨
 *
 * 사장님: "응 에이전트 글도 같은 스킨 입혀줘"
 *
 * 실측(발행글 5445, 에이전트 모드): <style> 0개 · bgpt-content 없음 · 인라인 167개.
 * 에이전트는 orchestration 을 타지 않아 스킨이 실릴 자리가 아예 없었다.
 */
import { applyOrbitSkinToAgentHtml } from '../src/core/final/agent-skin';
import { generateCSSFinal } from '../src/core/final/html';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

/** 에이전트가 실제로 돌려주는 모양 */
const AGENT_HTML = '<article class="bgpt-wp-ready bgpt-codex-workshop">\n<h2>청년미래적금 소급될까</h2>\n<p>내용입니다.</p>\n</article>';

describe('클래스를 더한다 (교체가 아니라)', () => {
  const out = applyOrbitSkinToAgentHtml(AGENT_HTML, '<style>.bgpt-content{color:#000}</style>');

  test('bgpt-content 가 붙는다 — 스킨 선택자가 이걸로 시작한다', () => {
    expect(out.applied).toBe(true);
    expect(out.html).toContain('bgpt-content');
  });

  test('기존 클래스를 지우지 않는다 — 퍼블리셔가 그걸 보고 있다', () => {
    expect(out.html).toContain('bgpt-wp-ready');
    expect(out.html).toContain('bgpt-codex-workshop');
  });

  test('스킨 CSS 가 본문 앞에 실린다', () => {
    expect(out.html.indexOf('<style>')).toBeLessThan(out.html.indexOf('<article'));
  });

  test('본문은 그대로다', () => {
    expect(out.html).toContain('청년미래적금 소급될까');
    expect(out.html).toContain('내용입니다.');
  });
});

describe('두 번 입히지 않는다', () => {
  test('이미 입혀진 글은 그대로 돌려준다 — 다시 생성으로 여러 번 지날 수 있다', () => {
    const once = applyOrbitSkinToAgentHtml(AGENT_HTML, '<style>x</style>');
    const twice = applyOrbitSkinToAgentHtml(once.html, '<style>x</style>');
    expect(twice.applied).toBe(false);
    expect(twice.html).toBe(once.html);
    expect((twice.html.match(/bgpt-content/g) || []).length).toBe(1);
  });
});

describe('모양이 달라도 깨지지 않는다', () => {
  test('클래스가 없는 바깥 태그', () => {
    const out = applyOrbitSkinToAgentHtml('<article>\n<p>글</p>\n</article>', '<style>x</style>');
    expect(out.html).toContain('class="bgpt-content"');
  });

  test('바깥 태그가 아예 없으면 감싸 준다', () => {
    const out = applyOrbitSkinToAgentHtml('<h2>제목</h2><p>글</p>', '<style>x</style>');
    expect(out.html).toContain('<div class="bgpt-content">');
    expect(out.html).toContain('<h2>제목</h2>');
  });

  test('빈 본문은 손대지 않는다', () => {
    expect(applyOrbitSkinToAgentHtml('', '<style>x</style>').applied).toBe(false);
  });

  test('CSS 가 없어도 클래스는 붙인다', () => {
    const out = applyOrbitSkinToAgentHtml(AGENT_HTML, '');
    expect(out.applied).toBe(true);
    expect(out.html).toContain('bgpt-content');
  });
});

describe('진짜 스킨과 맞물린다', () => {
  test('실제 generateCSSFinal 을 넣으면 먹과 놋쇠가 실린다', () => {
    const out = applyOrbitSkinToAgentHtml(AGENT_HTML, generateCSSFinal('wordpress'));
    expect(out.html).toContain('Gowun Batang');
    expect(out.html).toContain('#0C453F');
    // 이 선택자가 실제로 에이전트 본문에 걸린다
    expect(out.html).toMatch(/\.bgpt-content h2/);
    expect(out.html).toMatch(/class="[^"]*bgpt-content/);
  });
});

describe('발행 경로에 실제로 배선됐다 (조용한 미배선 방지)', () => {
  const main = read('electron/main.ts');

  test('에이전트 결과에 스킨을 입히는 호출이 있다', () => {
    expect(main).toContain('applyOrbitSkinToAgentHtml');
    expect(main).toContain("require('../dist/core/final/agent-skin')");
  });

  test('실패해도 발행을 막지 않는다', () => {
    expect(main).toMatch(/\[AGENT-SKIN\] 스킵/);
  });
});
