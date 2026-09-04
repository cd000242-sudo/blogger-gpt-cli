const fs = require('fs');
const path = require('path');

import { autoRepairBeforePublish, describeRepairs, repairGluedSentences, repairPersonalFiller } from '../src/core/final/auto-repair';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.629 — 발행 전 자동 수정.
 *
 * 사장님: "애초에 비평이나 개선을 하려고 버튼을 누르면 개선할게없을정도로
 *         글이 발행되어야한다고"
 *
 * 지금까지 모든 게이트가 **알리기만** 했다. structure-guard 도 title-answer-gate 도
 * 로그만 찍고 그대로 발행했다. 그래서 실측한 발행글에 마침표 뒤에 붙은 문장
 * 6건이 그대로 나갔다 — 아무도 안 고쳤기 때문이다.
 *
 * 이 파일은 **뜻을 바꾸지 않고 되돌릴 수 있는 것만** 고친다.
 * 판단이 필요한 것(말투 통일·확정형 표현·구간 반복)은 손대지 않는다.
 */
describe('v3.8.629 발행 전 자동 수정', () => {
  describe('붙은 문장 고치기', () => {
    test('실제로 발행됐던 그 대목을 고친다', () => {
      const 실물 = '<p>산식에 들어갔는지부터 보세요.영업이익 N% 요구라면 자율 협의 영역입니다.</p>';
      const r = repairGluedSentences(실물);
      expect(r.count).toBe(1);
      expect(r.html).toContain('보세요. 영업이익');
    });

    test('소수점을 문장으로 착각해 쪼개지 않는다', () => {
      const r = repairGluedSentences('<p>금리는 3.5퍼센트입니다.</p>');
      expect(r.count).toBe(0);
      expect(r.html).toContain('3.5퍼센트');
    });

    test('날짜도 건드리지 않는다', () => {
      const r = repairGluedSentences('<p>2026.09.04기준으로 바뀝니다.</p>');
      expect(r.count).toBe(0);
      expect(r.html).toContain('2026.09.04기준');
    });

    test('태그 속성값은 건드리지 않는다 — style·href 에 마침표가 흔하다', () => {
      const 원본 = '<p style="font-size:1.5rem" data-x="a.가">본문입니다.다음 문장.</p>';
      const r = repairGluedSentences(원본);
      expect(r.html).toContain('style="font-size:1.5rem"');
      expect(r.html).toContain('data-x="a.가"');
      expect(r.html).toContain('본문입니다. 다음');
    });

    test('이미 공백이 있으면 그대로 둔다', () => {
      const 원본 = '<p>첫 문장입니다. 둘째 문장입니다.</p>';
      expect(repairGluedSentences(원본).count).toBe(0);
    });
  });

  describe('글쓴이 군더더기 떼기', () => {
    test('문장 앞머리의 군더더기를 뗀다', () => {
      const r = repairPersonalFiller('<p>아무튼 정리하면 이렇습니다.</p>');
      expect(r.count).toBe(1);
      expect(r.html).toContain('정리하면 이렇습니다');
      expect(r.html).not.toContain('아무튼');
    });

    test('낱말 안에 우연히 들어간 경우는 안 건드린다', () => {
      // 문장 앞이나 마침표 뒤가 아니면 떼지 않는다
      const r = repairPersonalFiller('<p>그는 아무튼이라는 말을 자주 씁니다.</p>');
      expect(r.html).toContain('아무튼이라는');
    });
  });

  describe('망가뜨리지 않는다', () => {
    test('고칠 것이 없으면 원본 그대로', () => {
      const 원본 = '<p>첫 문장입니다. 둘째 문장입니다.</p>';
      const r = autoRepairBeforePublish(원본);
      expect(r.html).toBe(원본);
      expect(r.repairs).toHaveLength(0);
      expect(describeRepairs(r)).toContain('없었습니다');
    });

    test('빈 입력에도 터지지 않는다', () => {
      expect(autoRepairBeforePublish('').html).toBe('');
      expect(autoRepairBeforePublish('   ').repairs).toHaveLength(0);
    });

    /**
     * 실측 실수: 72자 표본에서 "아무튼" 세 글자를 뗐더니 4% 감소로 되돌려졌다.
     * 정상 동작인데 안전장치가 막은 것이다 — 짧은 글은 몇 글자만 지워도 비율이 크다.
     */
    test('짧은 글에서 몇 글자 지웠다고 되돌리지 않는다', () => {
      const 짧은글 = '<p>아무튼 정리하면 이렇습니다. 금리는 3.5퍼센트입니다.</p>';
      const r = autoRepairBeforePublish(짧은글);
      expect(r.repairs.some((x) => x.kind === 'reverted')).toBe(false);
      expect(r.html).not.toContain('아무튼');
    });

    test('긴 글에서 내용이 확 줄면 되돌린다 — 치환이 문장을 먹은 경우', () => {
      // 되돌림 판정이 실제로 살아 있는지 본다
      const src = read('src/core/final/auto-repair.ts');
      expect(src).toContain('REVERT_MIN_CHARS = 500');
      expect(src).toContain('REVERT_SHRINK = 0.97');
      expect(src).toMatch(/before >= REVERT_MIN_CHARS && after < before \* REVERT_SHRINK/);
    });

    test('무엇을 몇 곳 고쳤는지 말한다 — 조용히 바꾸지 않는다', () => {
      const r = autoRepairBeforePublish('<p>보세요.영업이익이 늘었습니다.아무튼 그렇습니다.</p>');
      const line = describeRepairs(r);
      expect(line).toContain('곳');
      expect(r.repairs.length).toBeGreaterThan(0);
    });
  });

  describe('두 경로 모두에 걸려 있다 — API 와 에이전트', () => {
    test('API 경로(orchestration)가 발행 직전에 부른다', () => {
      const orch = read('src/core/final/orchestration.ts');
      expect(orch).toContain("from './auto-repair'");
      expect(orch).toContain('autoRepairBeforePublish(html)');
      // 빈 블록 검사보다 앞에 와야 한다 — 고친 뒤에 재야 한다
      const 수정 = orch.indexOf('autoRepairBeforePublish(html)');
      const 빈블록 = orch.indexOf('const beforeRepair = findEmptyBlocks(html)');
      expect(수정).toBeGreaterThan(-1);
      expect(수정).toBeLessThan(빈블록);
    });

    /**
     * 에이전트 모드는 orchestration 을 안 탄다(별도 경로).
     * API 쪽에만 넣으면 에이전트 글은 그대로 나간다 — 이 저장소가 여러 번 겪은 함정이다.
     */
    test('에이전트 경로(agent-harness)에도 같은 자를 댄다', () => {
      const harness = read('src/core/final/agent-harness.ts');
      expect(harness).toContain("from './auto-repair'");
      expect(harness).toContain('autoRepairBeforePublish(out)');
    });
  });
});
