/**
 * 748 Claude live — provider 허용 목록.
 *
 * 사장님 지시: "OpenAI API 호출은 0이어야 한다. OpenAI fallback 도 금지한다."
 * 로그로 세는 대신 **코드로 보증한다** — 허용 밖 provider 는 네트워크에 닿기 전에 던진다.
 * 제품 기본(환경변수 없음)에서는 아무것도 막지 않는다.
 */
import { assertLiveLlmAllowed } from '../src/core/llm/llm-caller';

const saved = { allow: process.env['LLM_PROVIDER_ALLOWLIST'], noLive: process.env['NO_LIVE_LLM'] };
afterEach(() => {
  if (saved.allow === undefined) delete process.env['LLM_PROVIDER_ALLOWLIST']; else process.env['LLM_PROVIDER_ALLOWLIST'] = saved.allow;
  if (saved.noLive === undefined) delete process.env['NO_LIVE_LLM']; else process.env['NO_LIVE_LLM'] = saved.noLive;
});

describe('LLM_PROVIDER_ALLOWLIST', () => {
  it('환경변수가 없으면(제품 기본) 아무것도 막지 않는다', () => {
    delete process.env['LLM_PROVIDER_ALLOWLIST'];
    delete process.env['NO_LIVE_LLM'];
    expect(() => assertLiveLlmAllowed('callLLM/openai')).not.toThrow();
    expect(() => assertLiveLlmAllowed('callLLM/claude')).not.toThrow();
  });

  it('claude 만 허용하면 openai 호출은 던지고 claude 는 지나간다', () => {
    delete process.env['NO_LIVE_LLM'];
    process.env['LLM_PROVIDER_ALLOWLIST'] = 'claude';
    expect(() => assertLiveLlmAllowed('callLLM/openai')).toThrow(/LLM_PROVIDER_ALLOWLIST=claude.*openai/);
    expect(() => assertLiveLlmAllowed('callLLM/perplexity')).toThrow(/perplexity/);
    expect(() => assertLiveLlmAllowed('callLLM/claude')).not.toThrow();
  });

  it('쉼표로 여럿 허용 · 공백은 무시', () => {
    delete process.env['NO_LIVE_LLM'];
    process.env['LLM_PROVIDER_ALLOWLIST'] = 'claude, perplexity';
    expect(() => assertLiveLlmAllowed('callLLM/claude')).not.toThrow();
    expect(() => assertLiveLlmAllowed('callLLM/perplexity')).not.toThrow();
    expect(() => assertLiveLlmAllowed('callLLM/openai')).toThrow();
  });

  it('NO_LIVE_LLM=1 이 먼저다 — 허용 목록에 있어도 막는다', () => {
    process.env['NO_LIVE_LLM'] = '1';
    process.env['LLM_PROVIDER_ALLOWLIST'] = 'claude';
    expect(() => assertLiveLlmAllowed('callLLM/claude')).toThrow(/NO_LIVE_LLM/);
  });
});
