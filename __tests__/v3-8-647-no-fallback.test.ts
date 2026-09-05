const fs = require('fs');
const path = require('path');

import { braceBlock, blockBetween } from './helpers/source-block';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.647 — 폴백 없음. 고른 엔진 하나만.
 *
 * 사장님: "제미나이로하면 제미나이만 지피티로하면 지피티만 클로드만하면 클로드
 *          이런식으로 되게해달라고"
 *         "폴백없어 실패로그띄우면서 충전을 하거나 다른 모델로하라고 안내가나와야정상이야"
 *
 * 조용히 다른 모델로 넘어가면 두 가지를 모르고 지나간다:
 *   ① 키가 죽었다는 사실 (충전이든 재발급이든 손을 써야 하는데 모른다)
 *   ② 고른 모델이 아닌 다른 모델이 글을 썼다는 사실 (품질도 단가도 다르다)
 *
 * 그래서 실패는 실패로 세우고, 판단은 사람이 한다.
 */
describe('v3.8.647 폴백 없음', () => {
  describe('모델 체인이 하나뿐이다', () => {
    const caller = read('src/core/llm/llm-caller.ts');

    test('고른 모델만 쓴다', () => {
      const fn = braceBlock(caller, 'function resolveModelChain(');
      expect(fn).toContain('return [tier.modelId]');
      expect(fn).not.toContain('...tier.fallback');
    });

    /** 고른 게 없을 때 대표 모델 하나를 쓰는 건 기본값이지 폴백이 아니다 */
    test('선택이 없으면 대표 모델 하나만', () => {
      const fn = braceBlock(caller, 'function resolveModelChain(');
      expect(fn).toContain('baseModels.slice(0, 1)');
    });

    /** 일시적 네트워크 오류까지 실패로 볼 이유는 없다 — 재시도는 남긴다 */
    test('같은 모델 재시도는 남아 있다', () => {
      expect(caller).toContain('modelChain');
    });
  });

  describe('Gemini 경로도 마찬가지다', () => {
    const engine = read('src/core/final/gemini-engine.ts');

    test('티어에서 고른 모델 하나만', () => {
      const fn = braceBlock(engine, 'function buildGeminiChain(');
      expect(fn).toContain('[tier.modelId]');
      expect(fn).not.toContain('...tier.fallback');
    });
  });

  describe('실패했을 때 다음 수를 알려 준다', () => {
    const engine = read('src/core/final/gemini-engine.ts');
    const err = blockBetween(engine, 'const nextStep =', 'async function withTimeout');

    test('자동 대체가 없다는 사실을 밝힌다', () => {
      expect(err).toContain('자동 대체 없음');
    });

    test('다른 모델을 고르라고 안내한다', () => {
      expect(err).toContain('다른 AI 모델을 선택');
    });

    test('원인·해결·다음 수가 모두 들어간다', () => {
      expect(err).toContain('원인:');
      expect(err).toContain('해결:');
      expect(err).toContain('다음:');
    });

    /** 유출 차단 키는 충전으로 안 풀린다 — 이 구분이 사라지면 엉뚱한 처방이 나간다 */
    test('충전으로 풀리는 문제와 아닌 문제를 구분한다', () => {
      expect(engine).toContain('결제를 충전해도 이 키로는 호출이 되지 않습니다');
      expect(engine).toContain('[BILLING:');
    });
  });

  describe('엔진을 바꿔치기하지 않는다', () => {
    const orch = read('src/core/final/orchestration.ts');

    /** 로테이션이 사용자 선택을 덮어쓰던 것이 Gemini 가 돌던 진짜 이유였다 */
    test('로테이션은 명시적으로 켤 때만', () => {
      expect(orch).toContain('payload.llmRotation = payload.llmRotation === true;');
    });
  });
});
