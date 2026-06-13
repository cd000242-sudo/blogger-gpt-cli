import { automateBloggerConnect } from '../../electron/oneclick/automation/connect/bloggerConnect';
import type { ConnectState } from '../../electron/oneclick/types';

describe('automateBloggerConnect manual gates', () => {
  let now = 0;
  let dateSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    now = 0;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  function makeState(page: any): ConnectState {
    return {
      platform: 'blogger',
      currentStep: 0,
      totalSteps: 9,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      results: null,
      browser: null,
      page,
    };
  }

  it('does not advance when Google Cloud window is not ready', async () => {
    const page = {
      goto: jest.fn(async () => undefined),
      waitForTimeout: jest.fn(async (ms: number) => { now += ms; }),
      url: jest.fn(() => 'about:blank'),
      evaluate: jest.fn(async () => false),
      $: jest.fn(async () => null),
    };
    const state = makeState(page);

    await automateBloggerConnect(state, page);

    expect(state.completed).toBe(false);
    expect(state.stepStatus).toBe('waiting-login');
    expect(state.error).toContain('Google Cloud Console 창 준비를 확인하지 못했습니다');
    expect(page.goto).toHaveBeenCalledTimes(1);
    expect(page.goto.mock.calls.map((call: unknown[]) => call[0])).not.toContain('https://console.cloud.google.com/projectcreate');
  });
});
