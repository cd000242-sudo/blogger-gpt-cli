import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateClaudeConnection } from '../src/core/llm/claude-connection';
import { loadEnvFromFile, saveEnv } from '../src/env';

const mockDir = path.join(__dirname, '..', '.tmp-tests', `claude-settings-${process.pid}`);
jest.mock('electron', () => ({ app: { getPath: () => mockDir } }));

describe('Claude connection and workspace settings', () => {
  const originalFetch = global.fetch;
  const workspace = 'wrkspc_1234567890abcdefgh';
  beforeEach(() => {
    fs.mkdirSync(mockDir, { recursive: true });
    fs.writeFileSync(path.join(mockDir, '.env'), '');
    global.fetch = jest.fn() as any;
  });
  afterEach(() => { global.fetch = originalFetch; });
  afterAll(() => { fs.rmSync(mockDir, { recursive: true, force: true }); });

  test('connection check uses the supplied workspace and a free GET request', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    expect((await validateClaudeConnection('sk-test', workspace)).success).toBe(true);
    expect(fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/models?limit=1', expect.objectContaining({
      headers: expect.objectContaining({ 'anthropic-workspace-id': workspace, 'x-api-key': 'sk-test' }),
    }));
    expect((fetch as jest.Mock).mock.calls[0][1].body).toBeUndefined();
  });

  test('missing workspace is actionable and never retried', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400, json: async () => ({
      error: { message: 'This API key is not scoped to a workspace; include anthropic-workspace-id' },
    }) });
    const result = await validateClaudeConnection('sk-test', '');
    expect(result.success).toBe(false);
    expect(result.message).toContain('wrkspc_');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('bad input makes no request', async () => {
    expect((await validateClaudeConnection('', workspace)).success).toBe(false);
    expect((await validateClaudeConnection('sk-test', 'bad\nheader')).success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('scoped keys still work without a workspace header', async () => {
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    await validateClaudeConnection('sk-test', '');
    expect((fetch as jest.Mock).mock.calls[0][1].headers['anthropic-workspace-id']).toBeUndefined();
  });

  test('saving then clearing a workspace removes old aliases and survives reload', async () => {
    fs.writeFileSync(path.join(mockDir, '.env'), `CLAUDE_WORKSPACE_ID=${workspace}\nclaudeWorkspaceId=${workspace}\n`);
    expect((await saveEnv({ claudeWorkspaceId: workspace })).ok).toBe(true);
    expect(loadEnvFromFile().claudeWorkspaceId).toBe(workspace);
    expect((await saveEnv({ claudeWorkspaceId: '' })).ok).toBe(true);
    const reloaded = loadEnvFromFile();
    expect(reloaded.claudeWorkspaceId).toBe('');
    expect(reloaded.ANTHROPIC_WORKSPACE_ID).toBe('');
    expect(reloaded.CLAUDE_WORKSPACE_ID).toBeUndefined();
  });

  test('invalid workspace does not overwrite settings', async () => {
    await saveEnv({ claudeWorkspaceId: workspace });
    expect((await saveEnv({ claudeWorkspaceId: 'bad-id' })).ok).toBe(false);
    expect(loadEnvFromFile().claudeWorkspaceId).toBe(workspace);
  });

  test('the saved Claude key wins over an older Anthropic alias used by generation', () => {
    fs.writeFileSync(path.join(mockDir, '.env'), 'CLAUDE_API_KEY=sk-current\nANTHROPIC_API_KEY=sk-obsolete\n');
    const reloaded = loadEnvFromFile();
    expect(reloaded.claudeKey).toBe('sk-current');
    expect(reloaded.CLAUDE_API_KEY).toBe('sk-current');
    expect(reloaded.ANTHROPIC_API_KEY).toBe('sk-current');
  });
});
