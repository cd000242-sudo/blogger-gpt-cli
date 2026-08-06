/**
 * v3.8.465 — 이미지 홀수/짝수 선택이 무시되던 문제
 *
 * 사용자 지적: "이미지 홀수 짝수 선택해도 홀수면 짝수 스킵, 짝수면 홀수 스킵이
 * 이뤄지지 않네요".
 *
 * 원인: 배치 모드를 정하는 `||` 사슬의 첫 항이 **항상 값을 갖고 있었다.**
 *   getAgentImageSettingsMode() 는 에이전트 모드가 아니어도 저장값이 없으면
 *   기본값 'all' 을 담아 돌려준다. 그 값이 늘 truthy 라서 사슬이 거기서 끊겼고,
 *   사용자가 실제로 고른 #h2ImageMode 드롭다운까지 한 번도 도달하지 못했다.
 *   → 홀수/짝수를 골라도 언제나 'all' 로 발행됐다.
 *
 * 백엔드(orchestration)는 처음부터 정상이었다. 값이 거기까지 안 갔을 뿐이다.
 * 이 앱에서 다섯 번 반복된 "조용한 미배선" 패턴이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const posting = fs.readFileSync(path.join(root, 'electron/ui/modules/posting.js'), 'utf-8');
const orchestration = fs.readFileSync(path.join(root, 'src/core/final/orchestration.ts'), 'utf-8');

/** posting.js 의 진짜 코드를 떼어내 돌린다 (복사본을 검사하면 의미가 없다) */
function buildResolver() {
  const normalizeSrc = posting.slice(
    posting.indexOf('function normalizeImagePolicy('),
    posting.indexOf('function getH2ImageSettingsFromDOM('),
  );
  const chainStart = posting.indexOf('  const agentPolicy = agentImageMode?.isAgentMode');
  const chainEnd = posting.indexOf(');', posting.indexOf('const selectedPolicy = normalizeImagePolicy(')) + 2;
  const chainSrc = posting.slice(chainStart, chainEnd);
  expect(chainStart).toBeGreaterThan(-1);
  expect(chainSrc).toContain('selectedPolicy');

  // eslint-disable-next-line no-eval
  return eval(`(function (agentImageMode, document) {
    ${normalizeSrc}
    ${chainSrc}
    return { selectedPolicy, legacy: toLegacyH2ImageMode(selectedPolicy) };
  })`) as (agentImageMode: unknown, document: unknown) => { selectedPolicy: string; legacy: string };
}

/** 지정한 id/셀렉터만 값을 갖는 가짜 DOM */
function fakeDom(byId: Record<string, string>, bySelector: Record<string, string> = {}) {
  return {
    getElementById: (id: string) => (byId[id] !== undefined ? { value: byId[id] } : null),
    querySelector: (sel: string) => (bySelector[sel] !== undefined ? { value: bySelector[sel] } : null),
  };
}

describe('① 사용자가 고른 값이 실제로 쓰인다', () => {
  const resolve = buildResolver();

  /** 에이전트 모드가 아닐 때도 항상 오는 객체 — 이게 사슬을 끊고 있었다 */
  const NON_AGENT = { isAgentMode: false, imagePolicy: 'all', policy: 'all' };

  it('⭐⭐ 홀수를 고르면 홀수로 간다 (예전에는 all 로 덮였다)', () => {
    const r = resolve(NON_AGENT, fakeDom({ h2ImageMode: 'odd' }));
    expect(r.selectedPolicy).toBe('odd-only');
    expect(r.legacy).toBe('odd');
  });

  it('⭐⭐ 짝수를 고르면 짝수로 간다', () => {
    const r = resolve(NON_AGENT, fakeDom({ h2ImageMode: 'even' }));
    expect(r.selectedPolicy).toBe('even-only');
    expect(r.legacy).toBe('even');
  });

  it('⭐ 썸네일만·이미지없음도 그대로 전달된다', () => {
    expect(resolve(NON_AGENT, fakeDom({ h2ImageMode: 'thumbnail-only' })).legacy).toBe('thumbnail-only');
    expect(resolve(NON_AGENT, fakeDom({ h2ImageMode: 'none' })).legacy).toBe('none');
  });

  it('⭐⭐ 에이전트 모드일 때는 에이전트 설정이 이긴다', () => {
    const agent = { isAgentMode: true, imagePolicy: 'even-only', policy: 'even-only' };
    const r = resolve(agent, fakeDom({ h2ImageMode: 'odd' }));
    expect(r.legacy).toBe('even');
  });

  it('⭐ 아무것도 안 고르면 전체다', () => {
    expect(resolve(NON_AGENT, fakeDom({})).selectedPolicy).toBe('all');
    expect(resolve(null, fakeDom({})).selectedPolicy).toBe('all');
  });

  it('⭐ 거미줄 패널의 라디오(swImagePolicy)가 있으면 그게 우선이다', () => {
    const r = resolve(NON_AGENT, fakeDom({ h2ImageMode: 'all' }, { 'input[name="swImagePolicy"]:checked': 'odd-only' }));
    expect(r.legacy).toBe('odd');
  });
});

describe('② 소스에 잘못된 사슬이 되살아나지 않는다', () => {
  it('⭐⭐ 에이전트 설정은 isAgentMode 로 감싸져 있다', () => {
    expect(posting).toContain('const agentPolicy = agentImageMode?.isAgentMode');
    // 예전 사슬(무조건 에이전트 값 우선)이 남아 있으면 안 된다
    expect(posting).not.toMatch(/normalizeImagePolicy\(\s*\n?\s*agentImageMode\?\.imagePolicy/);
  });
});

describe('③ 백엔드는 홀수/짝수를 그대로 계산한다', () => {
  it('⭐⭐ odd → 1,3,5 / even → 2,4 로 섹션을 고른다', () => {
    expect(orchestration).toContain("if (h2ImageMode === 'odd')");
    expect(orchestration).toContain('.filter(n => n % 2 === 1)');
    expect(orchestration).toContain("} else if (h2ImageMode === 'even')");
    expect(orchestration).toContain('.filter(n => n % 2 === 0)');
  });

  it('⭐⭐ 고르지 않은 섹션은 이미지를 만들지 않는다', () => {
    expect(orchestration).toContain('if (!effectiveSelectedH2Sections.includes(h2Number)) return');
  });

  it('⭐ odd-only/even-only 표기도 같은 값으로 받아들인다', () => {
    expect(orchestration).toContain("rawPlacementMode === 'odd-only'");
    expect(orchestration).toContain("rawPlacementMode === 'even-only'");
  });
});
