/**
 * 748 — Claude 5 계열은 `temperature` 를 받지 않는다.
 *
 * 사장님 신고: "클로드 오푸스5랑 페이블 API는 발행이 안 되는 버그가 있네요."
 * 실측(2026-09-22, 모델별 1회): opus-5 · fable-5-1 · fable-5 · sonnet-5 → HTTP 400 "`temperature` is deprecated for this model.",
 * haiku-4-5 → 통과. temperature 를 늘 실어 보내던 탓에 **Claude 5 계열은 한 번도 호출되지 못했다.**
 */
import * as fs from 'fs';
import * as path from 'path';
import { claudeAcceptsTemperature, resolveClaudeMaxTokens, resolveLlmMaxTokens } from '../src/core/llm/llm-caller';

describe('claudeAcceptsTemperature', () => {
  it('Claude 5 계열은 false — 실측으로 400 이 확인된 모델들', () => {
    for (const m of ['claude-opus-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-sonnet-5']) {
      expect(claudeAcceptsTemperature(m)).toBe(false);
    }
  });

  it('Haiku 4.5 와 예전 세대는 true — 지금 동작을 바꾸지 않는다', () => {
    expect(claudeAcceptsTemperature('claude-haiku-4-5-20251001')).toBe(true);
    expect(claudeAcceptsTemperature('claude-3-5-sonnet-20241022')).toBe(true);
  });

  it('모르는 새 모델은 안 보내는 쪽(false) — 보내면 호출 자체가 막힌다', () => {
    expect(claudeAcceptsTemperature('claude-opus-6')).toBe(false);
    expect(claudeAcceptsTemperature('')).toBe(false);
  });
});

/**
 * 748 — 추론 모델은 thinking 토큰이 출력 예산을 함께 쓴다.
 * live Run 1 실패: "Unterminated string in JSON at position 9158" (응답 9,158자에서 잘림).
 * 같은 프롬프트 실측: thinking 7,577 + 본문 8,564 = 16,141 토큰 — 기본 상한 16,384 에 아슬아슬했다.
 */
describe('resolveClaudeMaxTokens', () => {
  const saved = process.env['LLM_MAX_OUTPUT_TOKENS'];
  afterEach(() => { if (saved === undefined) delete process.env['LLM_MAX_OUTPUT_TOKENS']; else process.env['LLM_MAX_OUTPUT_TOKENS'] = saved; });

  it('추론 모델(Claude 5 계열)은 기본 상한보다 넉넉히 받는다', () => {
    delete process.env['LLM_MAX_OUTPUT_TOKENS'];
    for (const m of ['claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5']) {
      expect(resolveClaudeMaxTokens(m)).toBeGreaterThan(resolveLlmMaxTokens());
      // 실측 16,141 토큰을 넉넉히 넘겨야 한다 — 생각을 조금 더 해도 안 잘리게
      expect(resolveClaudeMaxTokens(m)).toBeGreaterThanOrEqual(24000);
    }
  });

  it('Haiku 등 비추론 모델은 예전 상한 그대로', () => {
    delete process.env['LLM_MAX_OUTPUT_TOKENS'];
    expect(resolveClaudeMaxTokens('claude-haiku-4-5-20251001')).toBe(resolveLlmMaxTokens());
  });

  it('사람이 LLM_MAX_OUTPUT_TOKENS 를 정했으면 그 값을 그대로 쓴다', () => {
    process.env['LLM_MAX_OUTPUT_TOKENS'] = '8000';
    expect(resolveClaudeMaxTokens('claude-opus-5')).toBe(8000);
    expect(resolveClaudeMaxTokens('claude-haiku-4-5-20251001')).toBe(8000);
  });
});

describe('요청 본문 배선', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'llm', 'llm-caller.ts'), 'utf8');

  it('claude buildBody 는 허용 모델에만 temperature 를 싣는다', () => {
    expect(src).toContain('...(claudeAcceptsTemperature(model) ? { temperature: getGenerationTemperature(prompt) } : {})');
  });

  it('claude buildBody 의 출력 상한은 모델별로 정해진다 (thinking 예산)', () => {
    expect(src).toContain('max_tokens: resolveClaudeMaxTokens(model)');
  });

  it('400 "deprecated" 를 만나면 그 파라미터만 빼고 재시도한다 (재시도 횟수를 쓰지 않는다)', () => {
    expect(src).toMatch(/droppedParams\.add\(param\.toLowerCase\(\)\)/);
    expect(src).toContain('for (const p of droppedParams) delete requestBody[p];');
    // attempt 를 되돌려 같은 시도로 다시 부른다 — JSON 모드 폴백과 같은 방식
    const block = src.slice(src.indexOf('droppedParams.add'), src.indexOf('droppedParams.add') + 400);
    expect(block).toContain('attempt -= 1;');
  });
});
