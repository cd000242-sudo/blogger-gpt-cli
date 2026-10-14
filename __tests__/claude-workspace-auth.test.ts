/** All HTTP transports and saved settings are synthetic; no live requests or local keys. */
const postMock = jest.fn();
const requestMock = jest.fn();
const imageGetMock = jest.fn();
const savedSettings: Record<string, unknown> = {};
jest.mock('../src/env', () => ({ loadEnvFromFile: () => savedSettings }));
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { __esModule: true, ...actual, default: { post: postMock }, AxiosError: actual.AxiosError };
});
jest.mock('https', () => ({ request: requestMock, get: imageGetMock }));
jest.mock('../src/core/llm/api-keys', () => ({
  getApiKey: () => 'synthetic-key', getClaudeApiKey: () => 'synthetic-key',
  getOpenAIApiKey: () => 'synthetic-key', getPerplexityApiKey: () => 'synthetic-key',
}));
jest.mock('../src/core/llm/provider-throttle', () => ({
  getTextProviderMaxRetries: () => 3,
  waitAfterProviderBackoff: jest.fn(), waitAfterProviderRateLimit: jest.fn(), waitForTextProviderTurn: jest.fn(),
}));
import { EventEmitter } from 'events';
import { AxiosError } from 'axios';
import { buildClaudeHeaders, isClaudeWorkspaceError, resolveClaudeWorkspaceId } from '../src/core/llm/claude-auth';
import { callLLM, claudeAcceptsTemperature } from '../src/core/llm/llm-caller';
import { analyzeDetailImages } from '../src/core/affiliate/detail-image-vision';
import { callGeminiWithRetry } from '../src/core/final/gemini-engine';
import { filterImagesByRelevance } from '../src/core/url-image-crawler/imageRelevanceScorer';
import { resetVisionBudget } from '../src/core/url-image-crawler/visionBudgetGuard';

const workspace = 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ';
const envNames = ['NO_LIVE_LLM', 'LLM_PROVIDER_ALLOWLIST', 'PRIMARY_TEXT_MODEL', 'claudeWorkspaceId', 'ANTHROPIC_WORKSPACE_ID', 'CLAUDE_WORKSPACE_ID'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
beforeEach(() => {
  for (const name of envNames) delete process.env[name];
  for (const name of Object.keys(savedSettings)) delete savedSettings[name];
  postMock.mockReset(); requestMock.mockReset(); imageGetMock.mockReset();
  postMock.mockResolvedValue({ data: { content: [{ type: 'text', text: '완료' }] } });
});
afterAll(() => {
  for (const name of envNames) {
    if (originalEnv[name] === undefined) delete process.env[name];
    else process.env[name] = originalEnv[name];
  }
});

function httpError(status: number, message: string): AxiosError {
  return new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', undefined, undefined,
    { status, statusText: 'error', headers: {}, config: {} as never, data: { error: { message } } });
}

describe('Claude workspace headers', () => {
  test('workspace-scoped keys keep x-api-key without requiring a workspace', () => {
    expect(buildClaudeHeaders('synthetic-key', { env: {} })).toEqual({
      'x-api-key': 'synthetic-key', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json',
    });
  });
  test.each(['claudeWorkspaceId', 'ANTHROPIC_WORKSPACE_ID', 'CLAUDE_WORKSPACE_ID'])('reads %s alias', name => {
    expect(buildClaudeHeaders('synthetic-key', { env: { [name]: workspace } })['anthropic-workspace-id']).toBe(workspace);
  });
  test('explicit empty workspace and explicit env do not inherit machine settings', () => {
    savedSettings.claudeWorkspaceId = workspace;
    process.env.ANTHROPIC_WORKSPACE_ID = workspace;
    expect(resolveClaudeWorkspaceId({ env: {} })).toBe('');
    expect(resolveClaudeWorkspaceId({ workspaceId: '' })).toBe('');
    expect(resolveClaudeWorkspaceId()).toBe(workspace);
    delete savedSettings.claudeWorkspaceId;
    expect(resolveClaudeWorkspaceId()).toBe(workspace);
  });
  test.each(['org_12345678', 'wrkspc_12345678\r\nInjected: value', 'synthetic-key'])('invalid id is safe and actionable: %s', id => {
    expect(() => buildClaudeHeaders('synthetic-key', { workspaceId: id })).toThrow(/CLAUDE_WORKSPACE_INVALID.*Workspace ID/);
    try { buildClaudeHeaders('synthetic-key', { workspaceId: id }); }
    catch (e: any) { expect(e.message).not.toContain(id); }
  });
  test('persisted explicit clear suppresses stale process workspace', () => {
    savedSettings.ANTHROPIC_WORKSPACE_ID = '';
    process.env.ANTHROPIC_WORKSPACE_ID = workspace;
    expect(resolveClaudeWorkspaceId()).toBe('');
  });
});

describe('Claude transport', () => {
  test.each(['haiku', 'sonnet', 'opus'])('%s 5.5 transmits workspace and omits deprecated sampling', async family => {
    process.env.PRIMARY_TEXT_MODEL = `claude-${family}`;
    savedSettings.claudeWorkspaceId = workspace;
    expect(await callLLM('claude', '테스트')).toBe('완료');
    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body, options] = postMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(body.model).toBe(`claude-${family}-5-5`);
    for (const field of ['temperature', 'top_p', 'top_k']) expect(body).not.toHaveProperty(field);
    expect(options.headers['anthropic-workspace-id']).toBe(workspace);
    expect(options.headers['x-api-key']).toBe('synthetic-key');
  });
  test('legacy Haiku 4.5 still accepts temperature', () => {
    expect(claudeAcceptsTemperature('claude-haiku-4-5-20251001')).toBe(true);
    expect(claudeAcceptsTemperature('claude-haiku-5-5')).toBe(false);
  });
  test.each(['claude-fable', 'claude-fable-5-1', 'claude-fable-5'])('saved removed selection %s sends current Sonnet instead', async selection => {
    process.env.PRIMARY_TEXT_MODEL = selection;
    await callLLM('claude', '테스트');
    expect(postMock.mock.calls[0][1].model).toBe('claude-sonnet-5-5');
  });
  test.each([
    [400, 'anthropic-workspace-id is required when authenticating with an identity-linked API key'],
    [400, 'Invalid anthropic-workspace-id header'],
    [404, "Workspace 'wrkspc_12345678' not found."],
  ])('HTTP %i workspace failure stops retries and model fallback', async (status, message) => {
    process.env.PRIMARY_TEXT_MODEL = 'claude-opus';
    postMock.mockRejectedValue(httpError(status as number, message as string));
    let failure: any;
    try { await callLLM('claude', '테스트'); } catch (error) { failure = error; }
    expect(failure.message).toContain('Claude Workspace ID');
    expect(failure.message).toContain('CLAUDE_WORKSPACE_ERROR');
    expect(isClaudeWorkspaceError(failure)).toBe(true);
    expect(postMock).toHaveBeenCalledTimes(1);
  });
  test('invalid configured workspace never reaches HTTP', async () => {
    savedSettings.claudeWorkspaceId = 'not-a-workspace';
    await expect(callLLM('claude', '테스트')).rejects.toThrow(/CLAUDE_WORKSPACE_ERROR/);
    expect(postMock).not.toHaveBeenCalled();
  });
  test('real API key rejection remains an authentication error', async () => {
    postMock.mockRejectedValue(httpError(401, 'API key is invalid.'));
    await expect(callLLM('claude', '테스트')).rejects.toThrow(/키가 만료되었거나/);
    expect(postMock).toHaveBeenCalledTimes(1);
  });
  test('outer generation dispatcher retains workspace guidance without retrying', async () => {
    process.env.PRIMARY_TEXT_MODEL = 'claude-opus';
    postMock.mockRejectedValue(httpError(400, 'anthropic-workspace-id is required'));
    await expect(callGeminiWithRetry('테스트', 5)).rejects.toThrow(/CLAUDE_WORKSPACE_ERROR.*Claude/s);
    expect(postMock).toHaveBeenCalledTimes(1);
  });
});

describe('Claude detail vision', () => {
  function fakeVisionResponse(content: unknown[]) {
    const requests: any[] = [];
    requestMock.mockImplementation((_options, callback) => {
      const req = new EventEmitter() as any;
      req.write = (body: string) => requests.push(JSON.parse(body));
      req.destroy = jest.fn();
      req.end = () => {
        const res = new EventEmitter() as any; res.statusCode = 200;
        callback(res);
        res.emit('data', Buffer.from(JSON.stringify({ content })));
        res.emit('end');
      };
      return req;
    });
    return requests;
  }

  test('detail JSON preserves text after thinking blocks and disables up-front Sonnet 5.5 thinking', async () => {
    const requests = fakeVisionResponse([
      { type: 'thinking', thinking: 'internal', text: 'not answer' },
      { type: 'text', text: '{"facts":["금속 재질"],"bestH2Index":0,' },
      { type: 'redacted_thinking', data: 'opaque' },
      { type: 'text', text: '"confidence":95,"hasProduct":true}' },
    ]);
    const result = await analyzeDetailImages(['https://fake/1'], ['특징'], '상품', {
      textGenerator: 'claude-opus-5-5', apiKeys: { claude: 'synthetic-key' },
      fetchImageImpl: async () => Buffer.from('fake-image'),
    });
    expect(result[0]).toMatchObject({ facts: ['금속 재질'], bestH2: '특징', confidence: 95 });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 400, thinking: { type: 'between_tools' } });
    expect(requests[0]).not.toHaveProperty('tools');
  });

  test('relevance JSON joins only text blocks and uses supported Sonnet 5.5 thinking mode', async () => {
    jest.useFakeTimers();
    resetVisionBudget();
    try {
      const requests = fakeVisionResponse([
        { type: 'thinking', thinking: 'internal', text: 'not answer' },
        { type: 'text', text: '{"score":92,' },
        { type: 'text', text: '"reason":"상품 실물"}' },
      ]);
      imageGetMock.mockImplementation((_url, _options, callback) => {
        const req = new EventEmitter() as any;
        req.destroy = jest.fn();
        const res = new EventEmitter() as any; res.statusCode = 200; res.headers = {};
        callback(res);
        res.emit('data', Buffer.from('fake-image')); res.emit('end');
        return req;
      });
      const result = await filterImagesByRelevance(['https://fake/1'], '특징', '상품', {
        enabled: true, textGenerator: 'claude-sonnet', apiKeys: { claude: 'synthetic-key' },
      });
      expect(result.filtered).toEqual(['https://fake/1']);
      expect(result.scores[0]).toMatchObject({ score: 92, reason: '상품 실물' });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 100, thinking: { type: 'between_tools' } });
      expect(requests[0]).not.toHaveProperty('tools');
    } finally {
      jest.clearAllTimers(); jest.useRealTimers(); resetVisionBudget();
    }
  });

  test('sends shared workspace header and stops remaining images on workspace failure', async () => {
    savedSettings.claudeWorkspaceId = workspace;
    requestMock.mockImplementation((_options, callback) => {
      const req = new EventEmitter() as any;
      req.write = jest.fn(); req.destroy = jest.fn();
      req.end = () => {
        const res = new EventEmitter() as any; res.statusCode = 400;
        callback(res);
        res.emit('data', Buffer.from(JSON.stringify({ error: { message: 'anthropic-workspace-id is required' } })));
        res.emit('end');
      };
      return req;
    });
    const onLog = jest.fn();
    const result = await analyzeDetailImages(['https://fake/1', 'https://fake/2'], ['특징'], '상품', {
      textGenerator: 'claude-haiku', apiKeys: { claude: 'synthetic-key' },
      fetchImageImpl: async () => Buffer.from('fake-image'), onLog,
    });
    expect(result).toEqual([]);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][0].headers['anthropic-workspace-id']).toBe(workspace);
    expect(onLog.mock.calls.some(([line]) => line.includes('Claude Workspace ID'))).toBe(true);
  });
});
