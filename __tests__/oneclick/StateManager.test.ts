// __tests__/oneclick/StateManager.test.ts

import { StateManager } from '../../electron/oneclick/state/StateManager';
import type { BaseState } from '../../electron/oneclick/types';

interface TestState extends BaseState {
  platform: string;
}

function createTestState(platform: string = 'test'): TestState {
  return {
    platform,
    stepStatus: 'idle',
    message: '',
    completed: false,
    cancelled: false,
    error: null,
    browser: null,
    page: null,
  };
}

function createMockBrowser() {
  return {
    close: jest.fn(),
  };
}

describe('StateManager', () => {
  let manager: StateManager<TestState>;

  beforeEach(() => {
    manager = new StateManager<TestState>('TEST');
  });

  // ── getOrCreate ──

  it('getOrCreate: 새 키 → factory 호출하여 새 상태 반환', () => {
    const factory = jest.fn(() => createTestState('blogspot'));
    const state = manager.getOrCreate('blogspot', factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(state.platform).toBe('blogspot');
  });

  it('getOrCreate: 기존 키 → 같은 참조 반환, factory 미호출', () => {
    const factory = jest.fn(() => createTestState('blogspot'));
    const first = manager.getOrCreate('blogspot', factory);
    const second = manager.getOrCreate('blogspot', factory);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  // ── get ──

  it('get: 존재하는 키 → 상태 반환', () => {
    manager.getOrCreate('key1', () => createTestState('x'));
    expect(manager.get('key1')).toBeDefined();
    expect(manager.get('key1')!.platform).toBe('x');
  });

  it('get: 미존재 키 → undefined', () => {
    expect(manager.get('없는키')).toBeUndefined();
  });

  // ── reset ──

  it('reset: browser.close() 호출 후 states에서 제거', () => {
    const mockBrowser = createMockBrowser();
    const state = manager.getOrCreate('key1', () => createTestState());
    state.browser = mockBrowser as any;

    manager.reset('key1');

    expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    expect(manager.get('key1')).toBeUndefined();
  });

  it('reset: browser=null → 에러 없이 제거', () => {
    manager.getOrCreate('key1', () => createTestState());

    expect(() => manager.reset('key1')).not.toThrow();
    expect(manager.get('key1')).toBeUndefined();
  });

  it('reset: 미존재 키 → 에러 없이 무시', () => {
    expect(() => manager.reset('없는키')).not.toThrow();
  });

  // ── waitForLogin + confirmLogin ──

  it('waitForLogin + confirmLogin: confirm 호출 시 true 반환', async () => {
    const promise = manager.waitForLogin('key1', 5000);

    // 약간의 딜레이 후 confirm 호출
    setTimeout(() => manager.confirmLogin('key1'), 50);

    const result = await promise;
    expect(result).toBe(true);
  });

  it('waitForLogin: 타임아웃 → false 반환', async () => {
    const result = await manager.waitForLogin('key1', 100);
    expect(result).toBe(false);
  }, 2000);

  it('confirmLogin: 대기자 없으면 false 반환', () => {
    const result = manager.confirmLogin('없는키');
    expect(result).toBe(false);
  });

  it('confirmLogin: 이중 호출은 두 번째에서 false', async () => {
    const promise = manager.waitForLogin('key1', 5000);
    setTimeout(() => {
      const first = manager.confirmLogin('key1');
      const second = manager.confirmLogin('key1');
      expect(first).toBe(true);
      expect(second).toBe(false);
    }, 50);

    await promise;
  });

  // ── reset 중 waitForLogin ──

  it('reset 호출 시 진행 중인 로그인 타이머 정리', () => {
    // waitForLogin 시작 (resolve 안 됨)
    const promise = manager.waitForLogin('key1', 60000);

    // 즉시 상태 생성 + reset
    manager.getOrCreate('key1', () => createTestState());
    manager.reset('key1');

    // 타이머가 정리되었으므로 promise는 타임아웃 없이 매달려 있음
    // 추가로 confirm해도 false (resolver 제거됨)
    expect(manager.confirmLogin('key1')).toBe(false);
  });
});
