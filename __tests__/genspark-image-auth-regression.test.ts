import fs from 'fs';
import path from 'path';
import vm from 'vm';

jest.mock('../src/core/genspark/genspark-client', () => ({
  ...jest.requireActual('../src/core/genspark/genspark-client'),
  openGensparkHeadless: jest.fn(),
  fetchJsonInPage: jest.fn(),
}));
import { openGensparkHeadless, fetchJsonInPage } from '../src/core/genspark/genspark-client';
import { makeGensparkImage, parseGensparkImageProject, judgeImageProgress } from '../src/core/genspark/genspark-image';

const source = fs.readFileSync(path.join(process.cwd(), 'electron/ui/script.js'), 'utf8');
const authCode = source.slice(source.indexOf('function setGensparkStatus('), source.indexOf("document.addEventListener('DOMContentLoaded', () => {", source.indexOf('function setGensparkStatus(')));
const jobId = '12345678-1234-1234-1234-123456789abc';

function browserMock() {
  const fill = jest.fn();
  const click = jest.fn();
  const locator = jest.fn(() => ({ first: () => ({ fill, click }) }));
  const page = {
    goto: jest.fn(), locator, waitForTimeout: jest.fn(), url: () => `https://www.genspark.ai/agents?id=${jobId}`,
    evaluate: jest.fn(async () => 'data:image/png;base64,' + 'x'.repeat(12000)),
  };
  const context = { close: jest.fn(async () => {}) };
  (openGensparkHeadless as jest.Mock).mockResolvedValue({ context, page });
  return { context, page, fill, click };
}

beforeEach(() => jest.clearAllMocks());

describe('image generation verifies authentication before entering or sending a prompt', () => {
  test('logged out: no input, no send, actionable login error and browser cleanup', async () => {
    const { context, page, fill, click } = browserMock();
    (fetchJsonInPage as jest.Mock).mockResolvedValue({ status: 200, json: { data: {} } });
    const r = await makeGensparkImage('a small house');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('GENSPARK_LOGIN_REQUIRED');
    expect(r.error).toContain('이미지 엔진 옆');
    expect(page.locator).not.toHaveBeenCalled();
    expect(fill).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  test.each([403, 500])('session lookup HTTP %s cannot become a generation attempt', async status => {
    const { page, context } = browserMock();
    (fetchJsonInPage as jest.Mock).mockResolvedValue({ status, json: null });
    const r = await makeGensparkImage('a small house');
    expect(r.error).toContain('GENSPARK_SESSION_CHECK_FAILED');
    expect(page.locator).not.toHaveBeenCalled();
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  test('logged in: one submission, only this project is polled and returned as image data', async () => {
    const { page, fill, click, context } = browserMock();
    const onLog = jest.fn();
    (fetchJsonInPage as jest.Mock)
      .mockResolvedValueOnce({ status: 200, json: { data: { cogen_id: 'test-user' } } })
      .mockResolvedValueOnce({ status: 200, json: { data: { session_state: { stop_reason: 'finished', messages: [{ session_state: { media_task_results: { own: { status: 'SUCCESS', url: 'https://www.genspark.ai/api/files/s/test-image' } } } }] } } } });
    const r = await makeGensparkImage('a small house', { onLog });
    expect(r).toMatchObject({ ok: true, projectId: jobId });
    expect(r.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(fetchJsonInPage).toHaveBeenNthCalledWith(1, page, '/api/is_login');
    expect(fetchJsonInPage).toHaveBeenNthCalledWith(2, page, `/api/project?id=${jobId}`);
    expect(fill).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(onLog.mock.calls.some(([line]) => line.includes('로그인 확인 완료'))).toBe(true);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  test('session expires after send: stop immediately rather than polling until timeout', async () => {
    const { page, context } = browserMock();
    (fetchJsonInPage as jest.Mock)
      .mockResolvedValueOnce({ status: 200, json: { cogen_id: 'test-user' } })
      .mockResolvedValueOnce({ status: 401, json: null });
    const r = await makeGensparkImage('a small house');
    expect(r.error).toContain('GENSPARK_SESSION_EXPIRED');
    expect(page.evaluate).not.toHaveBeenCalled();
    expect(fetchJsonInPage).toHaveBeenCalledTimes(2);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  test('failed task without an image URL reports failure instead of waiting 90 seconds', () => {
    const p = parseGensparkImageProject({ data: { session_state: { messages: [{ session_state: { media_task_results: { a: { status: 'FAILED' } } } }] } } });
    expect(judgeImageProgress(p, 0)).toEqual({ state: 'failed', reason: '젠스파크 이미지 생성 실패(FAILED)' });
  });
});

describe('research and image buttons share the real authentication handlers', () => {
  function renderer(invoke: jest.Mock) {
    const elements: any = { gensparkStatus: { textContent: '', style: {} }, gensparkLoginBtn: { style: {} }, gensparkCheckBtn: { style: {} } };
    const window: any = { electronAPI: { invoke }, dispatchEvent: jest.fn() };
    const context = vm.createContext({ window, document: { getElementById: (id: string) => elements[id] }, CustomEvent: class { constructor(public type: string) {} } });
    vm.runInContext(authCode, context);
    return { window, elements };
  }

  test('concurrent image/research checks reuse one request and reset disabled buttons', async () => {
    let resolve: (r: any) => void = () => {};
    const invoke = jest.fn(() => new Promise(r => { resolve = r; }));
    const { window, elements } = renderer(invoke);
    const a = window.handleGensparkCheck();
    const b = window.handleGensparkCheck();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(elements.gensparkLoginBtn.disabled).toBe(true);
    expect(window.__gensparkAuthState.busy).toBe(true);
    resolve({ loggedIn: true, email: 'test@example.com' });
    await Promise.all([a, b]);
    expect(window.__gensparkAuthState.text).toContain('리서치·이미지 공용');
    expect(window.__gensparkAuthState.busy).toBe(false);
    expect(elements.gensparkCheckBtn.disabled).toBe(false);
  });

  test('image login uses existing profile IPC, and a later expired check clears success', async () => {
    const invoke = jest.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ loggedIn: false });
    const { window, elements } = renderer(invoke);
    await window.handleGensparkLogin();
    expect(invoke).toHaveBeenNthCalledWith(1, 'genspark:login');
    await window.handleGensparkCheck();
    expect(invoke).toHaveBeenNthCalledWith(2, 'genspark:check-login');
    expect(elements.gensparkStatus.textContent).toContain('로그인이 필요합니다');
    expect(window.__gensparkAuthState.text).not.toContain('✅');
  });

  test('IPC errors release buttons and allow a fresh check', async () => {
    const invoke = jest.fn().mockRejectedValueOnce(new Error('test connection failed')).mockResolvedValueOnce({ loggedIn: true });
    const { window } = renderer(invoke);
    await window.handleGensparkCheck();
    expect(window.__gensparkAuthState.text).toContain('test connection failed');
    expect(window.__gensparkAuthState.busy).toBe(false);
    await window.handleGensparkCheck();
    expect(window.__gensparkAuthState.text).toContain('✅');
  });

  test('the installed app loads the common panel module after the handlers', () => {
    const html = fs.readFileSync(path.join(process.cwd(), 'electron/ui/index.html'), 'utf8');
    expect(html.indexOf('src="./modules/genspark-image-auth.js"')).toBeGreaterThan(html.indexOf('src="./script.js"'));
  });
});
