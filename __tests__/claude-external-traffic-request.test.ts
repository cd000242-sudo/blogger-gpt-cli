jest.mock('../src/env', () => ({ loadEnvFromFile: () => ({ ANTHROPIC_WORKSPACE_ID: 'wrkspc_testworkspace123' }) }));

const { callClaude, callLLMWithFallback } = require('../src/core/external-traffic/_shared/llm-fallback');

describe('external traffic Claude request contract', () => {
  let fetchMock: jest.SpyInstance;
  const key = 'test-key-that-is-long-enough';
  beforeEach(() => { fetchMock = jest.spyOn(global, 'fetch'); });
  afterEach(() => { fetchMock.mockRestore(); });

  test('legacy Fable calls Sonnet 5.5 with workspace and no sampling parameters, preserving thinking-first text', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ content: [
      { type: 'thinking', thinking: 'private reasoning' },
      { type: 'text', text: '수정된 본문' },
    ] }) });
    const result = await callClaude({ model: 'claude-fable-5', user: '본문 작성', temperature: 0.5 }, key);
    expect(result).toMatchObject({ provider: 'claude', model: 'claude-sonnet-5-5', text: '수정된 본문' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(request.headers).toMatchObject({ 'x-api-key': key, 'anthropic-workspace-id': 'wrkspc_testworkspace123' });
    const body = JSON.parse(request.body);
    expect(body.model).toBe('claude-sonnet-5-5');
    for (const field of ['temperature', 'top_p', 'top_k']) expect(body).not.toHaveProperty(field);
  });

  test('workspace permission failure stops both model and vendor fallback without further paid calls', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'Workspace not found' } }) });
    await expect(callLLMWithFallback({ model: 'claude-sonnet', user: '본문 작성' }, { claude: key, perplexity: key }))
      .rejects.toThrow('CLAUDE_WORKSPACE_ERROR');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('ordinary model availability error can fall back to current Haiku', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Model not available' } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ content: [{ type: 'text', text: '본문' }] }) });
    expect(await callClaude({ model: 'claude-sonnet', user: '본문 작성' }, key))
      .toMatchObject({ model: 'claude-haiku-5-5', text: '본문' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
