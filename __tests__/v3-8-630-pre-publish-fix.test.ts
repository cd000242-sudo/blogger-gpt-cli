const fs = require('fs');
const path = require('path');

import { inspectBeforePublish, pickSections, fixBeforePublish, MAX_SECTIONS } from '../src/core/final/pre-publish-fix';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.630 — 발행 전 자가 수정.
 *
 * 사장님: "애초에 비평이나 개선을 하려고 버튼을 누르면 개선할게없을정도로
 *         글이 발행되어야한다고" / "api와 에이전트 둘다 LLM보다 훨씬 양질의 글을 줘야되"
 *
 * 지금까지 게이트는 알리기만 했다. auto-repair 가 기계적인 것을 고쳤고,
 * 여기서는 판단이 필요한 것을 AI 가 **문제 구간만** 다시 쓴다.
 *
 * 지켜야 할 것 셋:
 *   · 찾은 게 없으면 AI 를 안 부른다 (비용 0)
 *   · 결함이 많아도 호출은 상한까지만 (비용이 결함 수에 비례하면 안 된다)
 *   · 고치다 실패하면 원본 그대로 나간다 (발행을 막지 않는다)
 */
describe('v3.8.630 발행 전 자가 수정', () => {
  const 위험한글 = '<h2>사건 정리</h2><p>A씨가 7억 원을 횡령했다. 사기죄가 적용됐다.</p>'
    + '<h2>이후 상황</h2><p>상황이 바뀐 것으로 보인다. 최초 폭로 이후의 일이다.</p>';

  describe('코드가 먼저 찾는다 — AI 호출 0회', () => {
    test('문장을 고쳐서 해결되는 것은 AI 에게 맡긴다', () => {
      const kinds = inspectBeforePublish({ title: '성과급 파업 가능한지', html: 위험한글 })
        .fixable.map((f) => f.kind);
      expect(kinds).toContain('asserted-crime');
      expect(kinds).toContain('legal-overreach');
    });

    /**
     * 근거 조항·금액 성격은 **사람이 확인해야** 한다.
     * AI 에게 맡기면 모르는 조항을 지어내 채운다 — 그게 할루시네이션이다.
     */
    test('사람이 확인해야 하는 것은 AI 에게 안 맡긴다', () => {
      const 제도글 = '<h2>기준</h2><p>고용노동부 지침에 따르면 대상이 아닙니다. 판례도 같은 취지입니다.</p>';
      const r = inspectBeforePublish({ title: '기준', html: 제도글 });
      expect(r.advisory.map((f) => f.kind)).toContain('no-legal-basis');
      expect(r.fixable.map((f) => f.kind)).not.toContain('no-legal-basis');
    });

    test('제도 글이 아니면 근거 조항을 요구하지 않는다', () => {
      // 위험한글에는 "법·지침·판례" 같은 말이 없다 — 조항을 요구할 글이 아니다
      const r = inspectBeforePublish({ title: '성과급 파업 가능한지', html: 위험한글 });
      expect([...r.fixable, ...r.advisory].map((f) => f.kind)).not.toContain('no-legal-basis');
    });

    test('깨끗한 글에서는 아무것도 안 찾는다', () => {
      const 좋은글 = '<h2>기준</h2><p>노동조합법 제2조에 따라 판단합니다. 산식이 출발점입니다.</p>';
      expect(inspectBeforePublish({ title: '판단 기준', html: 좋은글 }).fixable).toHaveLength(0);
    });

    test('제목이 물었는데 답이 없으면 도입부를 고치라고 한다', () => {
      const 답없음 = '<h2>서류 정리</h2><p>파일명을 통일하고 명의별로 나눠 보관하세요. 등본을 준비합니다.</p>';
      const r = inspectBeforePublish({ title: '사업소득 있으면 가능한지', html: 답없음 });
      const 항목 = r.fixable.find((f) => f.kind === 'title-unanswered');
      expect(항목).toBeTruthy();
      // 답은 첫 화면에 있어야 하므로 도입부(0번)를 고친다
      expect(항목!.sectionIndex).toBe(0);
    });
  });

  describe('비용이 결함 수에 비례하지 않는다', () => {
    test('고칠 구간에 상한이 있다', () => {
      const 많음 = Array.from({ length: 9 }, (_, i) => ({
        kind: 'asserted-crime', title: 't', evidence: 'e', sectionIndex: i,
      }));
      expect(pickSections(많음, 9)).toHaveLength(MAX_SECTIONS);
    });

    test('결함이 몰린 구간부터 고른다', () => {
      const findings = [
        { kind: 'asserted-crime', title: 't', evidence: 'e', sectionIndex: 3 },
        { kind: 'asserted-crime', title: 't', evidence: 'e', sectionIndex: 3 },
        { kind: 'asserted-crime', title: 't', evidence: 'e', sectionIndex: 1 },
      ];
      expect(pickSections(findings, 5)[0]).toBe(3);
    });

    test('구간 번호가 없으면 도입부로 본다 — 버리지 않는다', () => {
      const findings = [{ kind: 'asserted-crime', title: 't', evidence: 'e', sectionIndex: -1 }];
      expect(pickSections(findings, 3)).toEqual([0]);
    });
  });

  describe('고칠 게 없으면 AI 를 안 부른다', () => {
    test('호출 0회로 끝난다', async () => {
      const 좋은글 = '<h2>기준</h2><p>노동조합법 제2조에 따라 판단합니다. 산식이 출발점입니다.</p>';
      let called = 0;
      const out = await fixBeforePublish(
        { title: '판단 기준', html: 좋은글 },
        async () => { called += 1; return ''; },
      );
      expect(called).toBe(0);
      expect(out.calls).toBe(0);
      expect(out.revised).toBe(0);
      expect(out.html).toBe(좋은글);
    });
  });

  describe('망가뜨리지 않는다', () => {
    test('모델이 쓸모없는 답을 주면 원본을 유지한다', async () => {
      const out = await fixBeforePublish(
        { title: '성과급 파업 가능한지', html: 위험한글 },
        async () => '음... 잘 모르겠습니다',
      );
      expect(out.revised).toBe(0);
      expect(out.html).toBe(위험한글);
      expect(out.notes.join(' ')).toContain('원본 유지');
    });

    test('모델 호출이 터져도 발행을 막지 않는다', async () => {
      const out = await fixBeforePublish(
        { title: '성과급 파업 가능한지', html: 위험한글 },
        async () => { throw new Error('네트워크 끊김'); },
      );
      expect(out.html).toBe(위험한글);
      expect(out.notes.join(' ')).toContain('건너뜀');
    });

    test('호출 횟수를 알려준다 — 비용을 확인할 수 있어야 한다', async () => {
      const out = await fixBeforePublish(
        { title: '성과급 파업 가능한지', html: 위험한글 },
        async () => '짧음',
      );
      expect(out.calls).toBeGreaterThan(0);
      expect(out.calls).toBeLessThanOrEqual(MAX_SECTIONS);
    });
  });

  describe('두 경로 모두에 걸려 있다', () => {
    test('API 경로가 발행 직전에 부른다', () => {
      const orch = read('src/core/final/orchestration.ts');
      expect(orch).toContain('fixBeforePublish');
      // 기계 수정이 먼저, 그다음 AI 재작성 — 순서가 뒤집히면 헛일을 시킨다
      const 기계 = orch.indexOf('autoRepairBeforePublish(html)');
      const AI = orch.indexOf('fixBeforePublish');
      expect(기계).toBeGreaterThan(-1);
      expect(기계).toBeLessThan(AI);
    });

    /** 에이전트는 orchestration 을 안 탄다 — 따로 배선해야 한다 */
    test('에이전트 경로도 부르고, 같은 CLI 로 고친다', () => {
      const main = read('electron/main.ts');
      expect(main).toContain('fixBeforePublish');

      // 고정 길이 slice 를 쓰지 않는다 — 코드가 몇 줄만 밀려도 헛것을 검사한다
      const from = main.indexOf('const { fixBeforePublish }');
      const to = main.indexOf("} catch (preflightErr)", from);
      expect(from).toBeGreaterThan(-1);
      expect(to).toBeGreaterThan(from);
      const block = main.slice(from, to);

      // 유료 API 를 끼워 넣으면 에이전트 모드를 고른 뜻을 뒤집는다
      expect(block).toContain('runAgentTextTask');
      expect(block).not.toContain('callGeminiWithRetry');
    });
  });
});
