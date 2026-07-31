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

  // v3.8.392 격리 수정: setTimeout 콜백이 `let manager` 를 그대로 붙잡고 있었다.
  //   전체 게이트에서 워커가 경합해 이 테스트가 5초(내부 대기와 동일 = 여유 0)를 넘기면,
  //   beforeEach 가 manager 를 새로 만든 뒤 뒤늦게 발화한 타이머가 **새 manager** 의
  //   confirmLogin 을 호출했다. 그 결과 다음 테스트("타임아웃 → false")가 true 를 받았다.
  //   → (a) 인스턴스를 지역 변수로 고정하고 (b) 내부 대기보다 넉넉한 테스트 한도를 준다.
  it('waitForLogin + confirmLogin: confirm 호출 시 true 반환', async () => {
    const m = manager;
    const promise = m.waitForLogin('key1', 5000);

    // 약간의 딜레이 후 confirm 호출
    setTimeout(() => m.confirmLogin('key1'), 50);

    const result = await promise;
    expect(result).toBe(true);
  }, 20000);

  it('waitForLogin: 타임아웃 → false 반환', async () => {
    const result = await manager.waitForLogin('key1', 100);
    expect(result).toBe(false);
  }, 2000);

  it('confirmLogin: 대기자 없으면 false 반환', () => {
    const result = manager.confirmLogin('없는키');
    expect(result).toBe(false);
  });

  it('confirmLogin: 이중 호출은 두 번째에서 false', async () => {
    const m = manager;   // 같은 이유로 인스턴스를 고정한다 (위 주석 참조)
    const promise = m.waitForLogin('key1', 5000);
    setTimeout(() => {
      const first = m.confirmLogin('key1');
      const second = m.confirmLogin('key1');
      expect(first).toBe(true);
      expect(second).toBe(false);
    }, 50);

    await promise;
  }, 20000);

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
