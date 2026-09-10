const fs = require('fs');
const path = require('path');

import { isModernOpenAiModel, applyOpenAiTokenParams } from '../src/core/llm/openai-params';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

/*
 * v3.8.714 — 사장님 화면: "블로그 발행 실패 … Unsupported parameter: 'max_tokens' is not
 * supported with this model. Use 'max_completion_tokens' instead. (model=gpt-6-astra)"
 *
 * 옛 규칙이 `/^gpt-5/` 하나여서 gpt-6-astra 가 옛 모델 취급을 받았다.
 * 실측(2026-09-10, 실제 API 호출):
 *   max_tokens            → 400 "Use 'max_completion_tokens' instead"
 *   max_completion_tokens → 200
 *   temperature 0.45      → 400 "Only the default (1) value is supported"
 *   reasoning_effort      → 200
 */
describe('v3.8.714 OpenAI 파라미터 규칙', () => {
  describe('세대 판정', () => {
    test('새 모델 — 실측으로 확인한 이름들', () => {
      for (const m of ['gpt-6-astra', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5', 'o1', 'o3-mini']) {
        expect(isModernOpenAiModel(m)).toBe(true);
      }
    });

    test('옛 모델 — 지금까지 하던 그대로 둔다', () => {
      for (const m of ['gpt-4o', 'gpt-4.1', 'gpt-4o-mini', 'gpt-3.5-turbo', '']) {
        expect(isModernOpenAiModel(m)).toBe(false);
      }
    });

    /** 새 세대가 나와도 이름만 늘리면 되도록 세대 번호로 판정한다 */
    test('두 자리 세대도 새 모델로 본다', () => {
      expect(isModernOpenAiModel('gpt-10-nova')).toBe(true);
    });
  });

  describe('요청 본문', () => {
    test('새 모델: max_completion_tokens 만 · temperature 는 아예 안 보낸다', () => {
      const body = applyOpenAiTokenParams({ model: 'gpt-6-astra' }, 'gpt-6-astra', 8000, 0.45, { reasoningEffort: 'medium' });
      expect(body.max_completion_tokens).toBe(8000);
      expect(body.max_tokens).toBeUndefined();
      expect(body.temperature).toBeUndefined();   // 400 "Only the default (1) value is supported"
      expect(body.reasoning_effort).toBe('medium');
    });

    test('옛 모델: max_tokens + temperature (기존 동작 유지)', () => {
      const body = applyOpenAiTokenParams({ model: 'gpt-4o' }, 'gpt-4o', 8000, 0.45, { reasoningEffort: 'medium' });
      expect(body.max_tokens).toBe(8000);
      expect(body.temperature).toBe(0.45);
      expect(body.max_completion_tokens).toBeUndefined();
      expect(body.reasoning_effort).toBeUndefined();
    });

    test('이미 들어 있던 옛 파라미터도 걷어낸다', () => {
      const body = applyOpenAiTokenParams(
        { model: 'gpt-6-astra', max_tokens: 100, temperature: 0.2 },
        'gpt-6-astra', 8000, 0.45,
      );
      expect(body.max_tokens).toBeUndefined();
      expect(body.temperature).toBeUndefined();
    });
  });

  /*
   * v3.8.714 — 실패 안내가 없는 모델 이름을 가리켰다.
   * 화면: "해결: 환경 설정에서 Gemini 2.5 Flash 또는 Flash-Lite를 선택해 주세요."
   * 그 이름은 지금 엔진 카드 어디에도 없다(현재는 Gemini 3.1/3.8/3.5, GPT-5.6…).
   * 이름을 코드에 박지 않고 가격표에서 읽는다 — 화면 카드도 같은 표를 읽는다.
   */
  describe('실패 안내는 지금 고를 수 있는 모델을 가리킨다', () => {
    const engine = read('src/core/final/gemini-engine.ts');

    test('없는 모델 이름을 안내 문구로 쓰지 않는다 (주석의 인용은 기록으로 남긴다)', () => {
      expect(engine).not.toMatch(/fix\s*=\s*'환경 설정에서 Gemini 2\.5 Flash/);
      expect(engine).toContain('function suggestPickableModels');
      expect(engine).toContain("require('../llm/pricing')");
    });

    test("'model'·기본 실패 모두 이 안내를 쓴다", () => {
      expect((engine.match(/suggestPickableModels\(provider\)/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    test('가격표가 실제로 지금 이름을 준다 — 실패한 제공자 것은 빼고 권한다', () => {
      const { getPricingTable } = require('../src/core/llm/pricing');
      const rows = getPricingTable();
      const titles = rows.filter((r: any) => r.provider !== 'openai').map((r: any) => r.title);
      expect(titles.length).toBeGreaterThan(0);
      expect(titles.join(' ')).not.toContain('Gemini 2.5 Flash');   // 옛 이름이 표에도 없다
      expect(rows.some((r: any) => r.title === 'Gemini 3.8 Flash')).toBe(true);
    });
  });

  describe('배선 — 규칙이 두 벌로 갈라지지 않는다', () => {
    test('두 호출부 모두 같은 함수를 쓴다', () => {
      for (const file of ['src/core/llm/llm-caller.ts', 'src/core/llm/openai.ts']) {
        const src = read(file);
        expect(src).toContain('applyOpenAiTokenParams');
        // 옛 판정이 남아 있으면 또 갈라진다
        expect(src).not.toMatch(/\/\^gpt-5\/i\.test\(model\)/);
      }
    });
  });
});
