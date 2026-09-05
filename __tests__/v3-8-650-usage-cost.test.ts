const fs = require('fs');
const path = require('path');

import { estimateCost, describeCost, resetUsage, readUsage } from '../src/core/llm/usage-cost';
import { blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.650 — 한 편에 얼마 들었나.
 *
 * 사장님: "한편당 얼마니 10편하면 5달러면 충분해?"
 *
 * 답할 수가 없었다. provider 응답에 usage 가 오는데 그냥 버리고 있었다.
 * 실측해 보니 편당 $0.166~0.182 (약 230~250원) 였다.
 *
 * 사장님이 곧바로 짚었다: "아까 10편했는데 9달러에서 지금 5.5달러까지썻던데?"
 * 그건 내가 하루에 서른 번 넘게 돌린 탓이었지만, **실패한 호출을 안 세고 있던 것도** 맞다.
 * 요청은 이미 나갔으니 입력 토큰은 썼는데 장부에는 없었다.
 */
describe('v3.8.650 편당 비용', () => {
  beforeEach(() => resetUsage());

  describe('센다', () => {
    test('장부를 비우고 시작한다 — 앞 글 비용이 묻어가면 안 된다', () => {
      (globalThis as any).__llmUsage = { calls: 9, failedCalls: 0, input: 1, output: 1, byModel: {} };
      resetUsage();
      expect(readUsage().calls).toBe(0);
    });

    test('공식 단가로 계산한다', () => {
      (globalThis as any).__llmUsage = {
        calls: 6, failedCalls: 0, input: 100_000, output: 10_000,
        byModel: { 'openai/gpt-5.6-terra': { calls: 6, input: 100_000, output: 10_000 } },
      };
      // gpt-5.6-terra: 입력 $2 / 출력 $12 per 1M → 0.2 + 0.12
      expect(estimateCost().usd).toBeCloseTo(0.32, 3);
    });

    /** 실패해도 요청은 나갔다 — 안 세면 편당 비용이 실제보다 싸 보인다 */
    test('실패한 호출도 장부에 남는다', () => {
      (globalThis as any).__llmUsage = {
        calls: 2, failedCalls: 3, input: 10_000, output: 500,
        byModel: { 'openai/gpt-5.6-terra': { calls: 2, input: 10_000, output: 500 } },
      };
      expect(estimateCost().failedCalls).toBe(3);
      expect(describeCost()).toContain('실패 3회');
    });
  });

  describe('모르는 것은 모른다고 한다', () => {
    /** pricing.ts 규칙: 확인된 모델만 단가를 채운다. 없는 단가를 지어내지 않는다 */
    test('단가를 모르는 모델이 섞이면 "이상" 이라고 말한다', () => {
      (globalThis as any).__llmUsage = {
        calls: 2, failedCalls: 0, input: 1000, output: 100,
        byModel: {
          'openai/gpt-5.6-terra': { calls: 1, input: 1000, output: 100 },
          'gemini/없는모델-9': { calls: 1, input: 500, output: 50 },
        },
      };
      const c = estimateCost();
      expect(c.unpriced).toContain('gemini/없는모델-9');
      expect(describeCost(c)).toContain('이상');
      expect(describeCost(c)).toContain('단가 미확인');
    });

    test('호출이 없으면 빈 문자열 — 없는 비용을 말하지 않는다', () => {
      expect(describeCost(estimateCost())).toBe('');
    });
  });

  describe('발행 경로에 배선돼 있다', () => {
    const orch = read('src/core/final/orchestration.ts');
    const caller = read('src/core/llm/llm-caller.ts');

    test('글마다 장부를 비운다', () => {
      expect(orch).toContain("require('../llm/usage-cost').resetUsage()");
    });

    test('응답의 usage 를 모은다', () => {
      expect(caller).toContain('__llmUsage');
      expect(caller).toContain('prompt_tokens');
    });

    test('실패한 호출도 센다', () => {
      const fail = blockBetween(caller, 'failedCalls = (g.__llmUsage.failedCalls || 0) + 1', 'const errorMsg');
      expect(fail).toContain('g.__llmUsage.input +=');
    });

    test('비용을 로그와 장부에 남긴다', () => {
      expect(orch).toContain('[COST]');
      expect(orch).toContain('이 글 비용');
      expect(orch).toContain('costUsd');
      expect(read('src/core/final/publish-ledger.ts')).toContain('costUsd?: number');
    });
  });
});
