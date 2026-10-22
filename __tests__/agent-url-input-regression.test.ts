import fs from 'fs';
import path from 'path';
import vm from 'vm';
import ts from 'typescript';

const acorn = require('acorn');
const workshop = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/codex-workshop.js'), 'utf8');
const nodes = acorn.parse(workshop, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const names = [
  'getTopic', 'hasGenerationInput', 'getReferenceLines', 'normalizePlatformName',
  'buildCodexArticleTask', 'buildCodexImageTask', 'isSavedPayloadCurrent',
  'runAgentJob', 'runAgentJobFromPosting', 'openCodexWorkshopPanel',
];
const functions = names.map(name => {
  const node = nodes.map((n: any) => n.declaration || n).find((n: any) => n.id?.name === name);
  if (!node) throw new Error(`Missing production function: ${name}`);
  return workshop.slice(node.start, node.end);
}).join('\n');
const url = 'https://example.com/current-notice';
const urlPayload = () => ({ urlBasedGeneration: true, sourceUrl: url, manualCrawlUrls: [url], topic: '' });

function harness(payload: any = urlPayload(), mode = 'url', keyword = '') {
  const elements: any = {
    keywordInput: { value: keyword }, referenceUrl: { value: payload.sourceUrl || '' },
    userRequestNote: { value: payload.userRequest || '' },
    modal: { classList: { add: jest.fn() } },
  };
  // The transport boundary is mocked: no CLI, paid generation or publication occurs.
  const dispatch: jest.Mock = jest.fn(async () => { throw new Error('transport reached'); });
  const context: any = {
    URL, JSON, console, setTimeout: jest.fn(), clearTimeout: jest.fn(),
    MODAL_ID: 'modal', state: { executionMode: 'agent', activeAgentProvider: 'codex', payload: null },
    document: { getElementById: (id: string) => elements[id] },
    $: (id: string) => elements[id], localStorage: { getItem: () => mode },
    createPreviewPayload: jest.fn(async () => payload),
    sameUserRequest: (a: string, b: string) => (a || '').trim() === (b || '').trim(),
    loadAgentModeStatus: async () => ({ allowed: true }), isMaxAgentAllowed: () => true,
    getSelectedAgentProfile: () => ({ id: 'test', provider: 'codex' }),
    isAgentProfileReady: () => true, checkAgentLoginStatus: async () => ({ ready: true }),
    agentProviderLabel: () => 'Codex', normalizeAgentProviderId: (id: string) => id,
    getPayloadImagePolicy: () => 'none', describeImagePolicy: () => '이미지 없음',
    getBridgeApi: () => ({ runAgentJob: dispatch }), alert: jest.fn(),
  };
  for (const name of ['ensureStyles', 'ensureModal', 'loadExecutionPrefs', 'updateAgentProgress',
    'setModalValues', 'setAgentRunStatus', 'setSettingsStatus', 'addLog', 'renderAgentStatusPanel']) context[name] = jest.fn();
  vm.createContext(context);
  vm.runInContext(functions, context);
  return { context, dispatch, elements };
}

describe('URL-only Agent generation through the actual renderer entry points', () => {
  test.each(['', '이전에 발행한 세금 글'])('publish dispatches URL without using hidden keyword %j', async keyword => {
    const payload = urlPayload();
    const { context: c, dispatch } = harness(payload, 'url', keyword);
    await expect(c.runAgentJobFromPosting(payload)).rejects.toThrow('transport reached');
    expect(dispatch).toHaveBeenCalledTimes(1);
    const request = dispatch.mock.calls[0][0];
    expect(request.payload).toBe(payload);
    expect(request.title).toBe('');
    expect(request.articleTask).toContain(url);
    expect(request.articleTask).toContain('실제 본문에서 주제와 제목을 추출');
    if (keyword) expect(request.articleTask + request.imageTask).not.toContain(keyword);
  });

  test('workshop opens and runs with a URL and no keyword', async () => {
    const { context: c, elements, dispatch } = harness();
    await c.openCodexWorkshopPanel();
    expect(c.alert).not.toHaveBeenCalled();
    expect(elements.modal.classList.add).toHaveBeenCalledWith('is-open');
    await expect(c.runAgentJob()).rejects.toThrow('transport reached');
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test('the generated title and HTML return to the publishing flow without a keyword', async () => {
    const { context: c, dispatch, elements } = harness();
    const content = `<article><h1>원문에서 추출한 새 제목</h1>${'<h2>본문 소제목</h2><p>' + '본문 내용 '.repeat(1500) + '</p>'}<h2>두 번째</h2><h2>세 번째</h2></article>`;
    dispatch.mockResolvedValue({ ok: true, title: '원문에서 추출한 새 제목', content, jobId: 'url-job' });
    elements.codexResultPaste = { value: '' };
    c.enhanceCodexAgentImages = jest.fn(async (html: string) => ({ content: html }));
    c.recordAgentUsage = jest.fn();
    c.getTextLength = (html: string) => html.length;
    c.applyCodexResult = jest.fn(async () => {});
    const result = await c.runAgentJobFromPosting(urlPayload());
    expect(result).toMatchObject({ ok: true, title: '원문에서 추출한 새 제목', content });
    expect(elements.codexResultPaste.value).toBe(content);
    expect(c.applyCodexResult).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test.each(['', 'https://', 'javascript:alert(1)', 'file:///C:/example.html'])('invalid URL %j is blocked in both entry points even with an old keyword', async invalid => {
    const p = { urlBasedGeneration: true, sourceUrl: invalid, topic: 'old topic' };
    const { context: c, dispatch, elements } = harness(p, 'url', 'old keyword');
    await expect(c.runAgentJobFromPosting(p)).rejects.toThrow('올바른 URL');
    await c.openCodexWorkshopPanel();
    expect(c.alert).toHaveBeenCalledWith('글을 생성할 올바른 URL을 입력해주세요.');
    expect(elements.modal.classList.add).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('URL queue labels and saved topic do not become article keywords', () => {
    const { context: c } = harness();
    const p = { ...urlPayload(), title: 'old title', topic: 'URL 1: example.com', keywords: [{ keyword: 'old' }] };
    expect(c.getTopic(p)).toBe('');
    expect(c.buildCodexArticleTask(p)).not.toContain('old');
  });

  test('manual URL and shopping affiliate URL can supply the source', async () => {
    for (const p of [
      { urlBasedGeneration: true, manualCrawlUrls: [url] },
      { urlBasedGeneration: true, affiliateLinks: [url] },
    ]) {
      const { context: c, dispatch } = harness(p);
      await expect(c.runAgentJobFromPosting(p)).rejects.toThrow('transport reached');
      expect(dispatch.mock.calls[0][0].articleTask).toContain(url);
    }
  });

  test('changing the URL discards cached payload and old edited instructions', async () => {
    const { context: c, elements, dispatch } = harness();
    c.state.payload = { ...urlPayload(), sourceUrl: 'https://example.com/old', manualCrawlUrls: [] };
    elements.codexArticleTask = { value: 'old instructions' };
    elements.codexImageTask = { value: 'old image instructions' };
    await expect(c.runAgentJob()).rejects.toThrow('transport reached');
    expect(c.createPreviewPayload).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].articleTask).toContain(url);
    expect(dispatch.mock.calls[0][0].articleTask).not.toContain('old instructions');
  });

  test('unchanged URL preserves user-edited workshop instructions', async () => {
    const p = urlPayload();
    const { context: c, elements, dispatch } = harness(p);
    c.state.payload = p;
    elements.codexArticleTask = { value: 'current edited instructions' };
    await expect(c.runAgentJob()).rejects.toThrow('transport reached');
    expect(c.createPreviewPayload).not.toHaveBeenCalled();
    expect(dispatch.mock.calls[0][0].articleTask).toBe('current edited instructions');
  });

  test('keyword mode still requires and forwards a keyword', async () => {
    const { context: c, dispatch } = harness({ topic: '새 글 주제' }, 'keyword');
    await expect(c.runAgentJobFromPosting({ topic: '새 글 주제' })).rejects.toThrow('transport reached');
    expect(dispatch.mock.calls[0][0].title).toBe('새 글 주제');
    dispatch.mockClear();
    await expect(c.runAgentJobFromPosting({})).rejects.toThrow('키워드나 제목');
    expect(dispatch).not.toHaveBeenCalled();
  });
});

test('main process instructions derive the URL topic and preserve the primary source first', () => {
  const main = fs.readFileSync(path.join(process.cwd(), 'electron/main.ts'), 'utf8');
  const code = main.slice(main.indexOf('function getAgentReferenceLines('), main.indexOf('function writeAgentJobFiles('));
  const c: any = {
    normalizeAgentImagePolicy: () => 'none', describeAgentImagePolicy: () => 'none',
    describeToneStyle: () => [], agentProviderLabel: () => 'Codex',
    getAgentDemandQuestions: () => [], console: { log: jest.fn(), warn: jest.fn() },
    require: () => ({ buildAgentHarnessRules: () => '', captureAgentRequirements: () => null, agentInstructionsBlock: () => '' }),
  };
  vm.createContext(c);
  vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, c);
  const p = { ...urlPayload(), topic: 'stale keyword', manualCrawlUrls: ['https://example.com/supplement'], affiliateLinks: ['https://example.com/product'] };
  expect(c.getAgentReferenceLines(p)).toEqual([url, 'https://example.com/supplement', 'https://example.com/product']);
  const instructions = c.buildAgentJobInstructions({ title: 'stale title', payload: p }, { provider: 'codex' });
  expect(instructions).toContain('실제 본문을 읽고 주제와 제목을 추출');
  expect(instructions).toContain(url);
  expect(instructions).not.toContain('stale keyword');
  expect(instructions).not.toContain('stale title');
});
