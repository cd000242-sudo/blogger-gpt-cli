const fs = require('fs');
const path = require('path');
const pricing = require('../src/core/llm/pricing.js');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('GPT model routing regression guard', () => {
  test('current GPT-5.6 model IDs resolve to OpenAI tiers', () => {
    expect(pricing.findTier('gpt-5.6-luna')?.provider).toBe('openai');
    expect(pricing.findTier('gpt-5.6-terra')?.provider).toBe('openai');
    expect(pricing.findTier('gpt-5.6-sol')?.provider).toBe('openai');
    expect(pricing.deriveProvider('gpt-5.6-luna')).toBe('openai');
  });

  test('legacy GPT radio values keep resolving to the current OpenAI tier', () => {
    expect(pricing.findTier('openai-gpt4o-mini')?.modelId).toBe('gpt-5.6-luna');
    expect(pricing.findTier('openai-gpt41')?.modelId).toBe('gpt-5.6-terra');
    expect(pricing.findTier('openai-gpt4o')?.modelId).toBe('gpt-5.6-sol');
  });

  test('posting engine badge shows the routed GPT-5.6 tier instead of legacy GPT labels', () => {
    const script = read('electron/ui/script.js');

    expect(script).toContain("'openai-gpt4o-mini': { label: 'OpenAI GPT-5.6 Luna'");
    expect(script).toContain("'openai-gpt41': { label: 'OpenAI GPT-5.6 Terra'");
    expect(script).toContain("'openai-gpt4o': { label: 'OpenAI GPT-5.6 Sol'");
    expect(script).toContain("'gpt-5.6-terra': { label: 'OpenAI GPT-5.6 Terra'");
    expect(script).not.toContain("'openai-gpt41': { label: 'OpenAI GPT-4.1'");
  });

  test('posting payload keeps GPT radio values in the OpenAI provider', () => {
    const posting = read('electron/ui/modules/posting.js');
    const settings = read('electron/ui/modules/settings.js');

    expect(posting).toContain("v.startsWith('openai-') || v.startsWith('gpt-')");
    expect(posting).toContain("provider === 'openai' && (radioValue.startsWith('openai-') || radioValue.startsWith('gpt-')");
    expect(settings).toContain("m.startsWith('openai-') || m.startsWith('gpt-')");
  });

  test('final orchestration does not remap native GPT IDs back to Gemini defaults', () => {
    const orchestration = read('src/core/final/orchestration.ts');

    expect(orchestration).toContain("payload.provider === 'openai' && (modelValue.startsWith('openai-') || modelValue.startsWith('gpt-')");
    expect(orchestration).toContain("process.env['PRIMARY_TEXT_MODEL'] = finalModel!");
  });
});
