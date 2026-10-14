import { readFileSync } from 'fs';
import { join } from 'path';
import { createContext, runInContext } from 'vm';
import { braceBlock } from './helpers/source-block';

const read = (file: string) => readFileSync(join(__dirname, '..', file), 'utf8');
const settingsSource = read('electron/ui/modules/settings.js');
const html = read('electron/ui/index.html');

function uiHarness(saved: any = {}, env: any = {}) {
  const fields: Record<string, any> = {
    claudeKey: { value: ' test-key ' },
    claudeWorkspaceId: { value: ' wrkspc_test ' },
    claudeApiTestBtn: { disabled: false },
    claudeApiTestStatus: { textContent: '' },
  };
  const radios = ['gemini-2.5-flash', 'claude-haiku', 'claude-sonnet', 'claude-opus'].map(value => ({ value, checked: false }));
  const storage = { get: jest.fn(async () => saved), set: jest.fn(async (_key, value) => { saved = value; }) };
  const invoke = jest.fn(async () => ({ success: true, message: '연결 확인 완료' }));
  const saveEnv = jest.fn(async (payload) => { env = { ...env, ANTHROPIC_WORKSPACE_ID: payload.claudeWorkspaceId }; return { ok: true }; });
  const context = createContext({
    window: { electronAPI: { invoke }, blogger: { saveEnv, getEnv: async () => ({ ok: true, data: env }) } },
    document: {
      getElementById: (id: string) => fields[id] || null,
      querySelectorAll: () => radios,
      querySelector: () => null,
    },
    console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    localStorage: { getItem: () => null },
    getStorageManager: () => storage,
    getErrorHandler: () => ({ handle: jest.fn() }),
    debugLog: jest.fn(), addLog: jest.fn(), alert: jest.fn(), setTimeout: jest.fn(),
  });
  runInContext(settingsSource.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''), context);
  runInContext('updatePlatformStatus = () => {}; updateApiKeyStatus = () => {};', context);
  return { context, fields, radios, storage, invoke, saveEnv };
}

describe('Claude 작업공간 설정과 5.5 선택 복원', () => {
  test.each([
    ['claude-fable-5', 'claude-sonnet'], ['claude-fable-5-1', 'claude-sonnet'],
    ['claude-opus', 'claude-opus'], ['claude-opus-4-8', 'claude-opus'],
    ['claude-haiku-5-5', 'claude-haiku'], ['claude-sonnet-5-5', 'claude-sonnet'],
  ])('저장된 %s 선택은 %s 라디오로 복원된다', async (old, expected) => {
    const h = uiHarness({ primaryGeminiTextModel: old });
    const loaded = await h.context.loadSettings();
    expect(loaded.primaryGeminiTextModel).toBe(expected);
    h.context.applyTextModelRadio({ primaryGeminiTextModel: old });
    expect(h.radios.find(r => r.checked)?.value).toBe(expected);
  });

  test('작업공간 ID 저장·재로딩과 명시적인 빈값 해제가 유지된다', async () => {
    const h = uiHarness({ claudeWorkspaceId: 'wrkspc_old' }, { ANTHROPIC_WORKSPACE_ID: 'wrkspc_env' });
    expect((await h.context.loadSettings()).claudeWorkspaceId).toBe('wrkspc_env');
    await h.context.saveSettings();
    expect(h.saveEnv).toHaveBeenLastCalledWith(expect.objectContaining({ claudeWorkspaceId: 'wrkspc_test' }));
    expect((await h.context.loadSettings()).claudeWorkspaceId).toBe('wrkspc_test');
    h.fields.claudeWorkspaceId.value = '';
    await h.context.saveSettings();
    expect(h.saveEnv).toHaveBeenLastCalledWith(expect.objectContaining({ claudeWorkspaceId: '' }));
    expect((await h.context.loadSettings()).claudeWorkspaceId).toBe('');
  });

  test('연결 확인은 저장 전 입력값으로 호출하며 결과를 텍스트로 표시한다', async () => {
    const h = uiHarness();
    await h.context.testClaudeApiKey();
    expect(h.invoke).toHaveBeenCalledWith('validate-api-key', { provider: 'claude', apiKey: 'test-key', claudeWorkspaceId: 'wrkspc_test' });
    expect(h.saveEnv).not.toHaveBeenCalled();
    expect(h.fields.claudeApiTestStatus.textContent).toContain('연결 확인 완료');
    expect(h.fields.claudeApiTestBtn.disabled).toBe(false);
    h.fields.claudeWorkspaceId.value = '';
    h.invoke.mockResolvedValueOnce({ success: false, message: '<b>workspace required</b>' });
    await h.context.testClaudeApiKey();
    expect(h.invoke).toHaveBeenLastCalledWith('validate-api-key', expect.objectContaining({ claudeWorkspaceId: '' }));
    expect(h.fields.claudeApiTestStatus.textContent).toBe('❌ <b>workspace required</b>');
  });

  test('키가 없거나 검사 중이면 호출하지 않고 실패 후 버튼을 복구한다', async () => {
    const h = uiHarness();
    h.fields.claudeKey.value = '';
    await h.context.testClaudeApiKey();
    expect(h.invoke).not.toHaveBeenCalled();
    h.fields.claudeKey.value = 'test-key';
    h.fields.claudeApiTestBtn.disabled = true;
    await h.context.testClaudeApiKey();
    expect(h.invoke).not.toHaveBeenCalled();
    h.fields.claudeApiTestBtn.disabled = false;
    h.invoke.mockRejectedValueOnce(new Error('offline'));
    await h.context.testClaudeApiKey();
    expect(h.fields.claudeApiTestBtn.disabled).toBe(false);
    expect(h.fields.claudeApiTestStatus.textContent).toContain('실패');
  });

  test('현재 세 모델만 표시하며 작업공간 안내와 버튼이 실제 함수에 연결된다', () => {
    expect(html).not.toContain('Fable');
    for (const family of ['Haiku', 'Sonnet', 'Opus']) expect(html).toContain(`Claude ${family} 5.5`);
    expect(html).toContain('id="claudeWorkspaceId"');
    expect(html).toContain('https://platform.claude.com/settings/workspaces');
    expect(html).toContain('onclick="window.testClaudeApiKey()"');
    expect(settingsSource).toContain("'claudeWorkspaceId': mergedSettings.claudeWorkspaceId");
  });

  test('에이전트의 폐지된 선택도 Sonnet 5.5로 이동하고 Codex 선택은 보존한다', () => {
    const source = read('electron/ui/modules/codex-workshop.js');
    const fn = braceBlock(source, 'export function normalizeAgentModelSelections').replace('export ', '');
    const normalize = new Function(`${fn}; return normalizeAgentModelSelections;`)();
    expect(normalize({ claude: 'claude-fable-5-1', codex: 'gpt-6-astra' })).toEqual({ claude: 'claude-sonnet-5-5', codex: 'gpt-6-astra' });
    expect(normalize({ claude: 'claude-opus' }).claude).toBe('claude-opus-5-5');
    expect(source).toContain('return normalizeAgentModelSelections(saved)');
  });

  test('Claude 비용은 고정된 옛 금액 대신 백엔드 가격표로 표시된다', async () => {
    const costEl = { textContent: '비용 확인 중', title: '' };
    const card = {
      querySelector: (selector: string) => selector === '[data-pricing-cost]' ? costEl : { value: 'claude-sonnet' },
      querySelectorAll: () => [costEl], setAttribute: jest.fn(),
    };
    const context = createContext({
      window: { electronAPI: { invoke: jest.fn(async () => ({ ok: true, tiers: [{ value: 'claude-sonnet', costKrw: 42, costLabel: '~₩42/글', derived: true, priceSource: 'fixture' }] })) } },
      document: { querySelectorAll: () => [card], getElementById: () => null },
    });
    runInContext(read('electron/ui/modules/pricing-sync.js').replace(/^export /gm, ''), context);
    await context.syncPricingLabels();
    expect(costEl.textContent).toBe('~₩42/글');
    expect(card.setAttribute).toHaveBeenCalledWith('data-cost', '42');
  });
});

describe.each(['module', 'legacy'])('%s 설정 저장 실패 처리', (path) => {
  function harness() {
    const h = uiHarness({ claudeWorkspaceId: 'wrkspc_previous', platform: 'wordpress' }, { ANTHROPIC_WORKSPACE_ID: 'wrkspc_previous' });
    if (path === 'legacy') {
      const fn = braceBlock(read('electron/ui/script.js'), 'async function saveSettings()');
      runInContext(fn, h.context);
      runInContext('updateAiModelStatus = () => {};', h.context);
    }
    return h;
  }

  test('백엔드 형식검증 거부 시 저장값을 변경하거나 모달을 닫지 않고 구체적인 이유를 안내한다', async () => {
    const h = harness();
    h.saveEnv.mockResolvedValueOnce({ ok: false, error: 'Claude 작업공간 ID는 wrkspc_ 형식이어야 합니다.' } as any);
    expect(await h.context.saveSettings()).toEqual({ ok: false, error: 'Claude 작업공간 ID는 wrkspc_ 형식이어야 합니다.' });
    expect(h.storage.set).not.toHaveBeenCalled();
    expect(h.context.setTimeout).not.toHaveBeenCalled();
    expect(h.fields.claudeWorkspaceId.value).toBe(' wrkspc_test ');
    expect(h.context.alert).toHaveBeenLastCalledWith(expect.stringContaining('wrkspc_ 형식'));
    expect(h.context.alert).not.toHaveBeenCalledWith('✅ 설정이 저장되었습니다.');
    expect((await h.storage.get()).claudeWorkspaceId).toBe('wrkspc_previous');
  });

  test('설정 파일 쓰기 예외 후에도 입력값을 유지하고 재시도 성공 후에만 로컬 저장·모달 닫기를 진행한다', async () => {
    const h = harness();
    h.saveEnv.mockRejectedValueOnce(new Error('설정 파일 쓰기 권한이 없습니다.'));
    expect((await h.context.saveSettings()).ok).toBe(false);
    expect(h.storage.set).not.toHaveBeenCalled();
    expect(h.context.setTimeout).not.toHaveBeenCalled();
    expect(h.context.alert).toHaveBeenLastCalledWith(expect.stringContaining('쓰기 권한'));
    expect((await h.context.saveSettings()).ok).toBe(true);
    expect(h.storage.set).toHaveBeenCalledTimes(1);
    expect(h.storage.set.mock.invocationCallOrder[0]).toBeGreaterThan(h.saveEnv.mock.invocationCallOrder[1]);
    expect(h.context.setTimeout).toHaveBeenCalledTimes(1);
    expect(h.context.alert).toHaveBeenLastCalledWith('✅ 설정이 저장되었습니다.');
  });

  test('저장 IPC를 사용할 수 없으면 로컬 저장만 하고 성공으로 표시하지 않는다', async () => {
    const h = harness();
    delete h.context.window.blogger.saveEnv;
    expect((await h.context.saveSettings()).ok).toBe(false);
    expect(h.storage.set).not.toHaveBeenCalled();
    expect(h.context.setTimeout).not.toHaveBeenCalled();
    expect(h.context.alert).toHaveBeenLastCalledWith(expect.stringContaining('설정 저장 연결'));
  });

  test('파일 저장 후 로컬 저장만 실패하면 부분 저장 상태를 알리고 모달을 유지한다', async () => {
    const h = harness();
    h.storage.set.mockRejectedValueOnce(new Error('로컬 저장 용량 부족'));
    expect((await h.context.saveSettings()).ok).toBe(false);
    expect(h.saveEnv).toHaveBeenCalledTimes(1);
    expect(h.context.setTimeout).not.toHaveBeenCalled();
    expect(h.context.alert).toHaveBeenLastCalledWith(expect.stringContaining('설정 파일은 저장했지만 화면 설정을 저장하지 못했습니다.'));
  });
});
