const llmFallback = require('../src/core/external-traffic/_shared/llm-fallback');

describe('external traffic LLM routing', () => {
  it('maps the GPT-5 nano UI value to OpenAI models, not Gemini', () => {
    expect(llmFallback.inferProviderFromModel('openai-gpt4o-mini')).toBe('openai');
    expect(
      llmFallback.resolveCandidateModels('openai', { primaryGeminiTextModel: 'openai-gpt4o-mini' }, [])
    ).toEqual(['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1-mini']);
    expect(
      llmFallback.resolveCandidateModels('gemini', { primaryGeminiTextModel: 'openai-gpt4o-mini' }, ['gemini-2.5-flash'])
    ).toEqual(['gemini-2.5-flash']);
  });

  it('keeps native GPT-5 model ids inside the OpenAI provider chain', () => {
    expect(
      llmFallback.resolveCandidateModels('openai', { model: 'gpt-5-nano' }, ['gpt-4.1-mini'])
    ).toEqual(['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1-mini']);
  });
});
