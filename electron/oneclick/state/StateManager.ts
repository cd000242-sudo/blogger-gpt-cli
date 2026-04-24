// electron/oneclick/state/StateManager.ts
// 제네릭 상태 관리 클래스 — 4벌의 중복 상태 관리를 하나로 통합

import type { BaseState } from '../types';

/**
 * 원클릭 세팅 파이프라인의 상태를 관리하는 제네릭 클래스.
 * 각 도메인(Setup, Connect, Infra, Webmaster)이 동일한 패턴으로
 * 상태 생성/조회/리셋/로그인 대기를 수행한다.
 */
export class StateManager<T extends BaseState> {
  private readonly label: string;
  private readonly states = new Map<string, T>();
  private readonly loginResolvers = new Map<string, () => void>();
  private readonly loginTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(label: string) {
    this.label = label;
  }

  /**
   * 키에 해당하는 상태를 반환한다. 없으면 factory로 생성한다.
   */
  getOrCreate(key: string, factory: () => T): T {
    const existing = this.states.get(key);
    if (existing) return existing;

    const state = factory();
    this.states.set(key, state);
    return state;
  }

  /**
   * 키에 해당하는 상태를 조회한다. 없으면 undefined.
   */
  get(key: string): T | undefined {
    return this.states.get(key);
  }

  /**
   * 상태를 리셋한다. 브라우저가 열려있으면 닫는다.
   * async로 변경 — browser.close()를 await 해서 chromium 프로세스 정리가
   * 완료된 뒤에야 새 state가 생성되도록 보장한다. (profile lock 충돌 방지)
   */
  async reset(key: string): Promise<void> {
    const state = this.states.get(key);
    if (!state) return;

    try {
      await state.browser?.close();
    } catch {
      /* ignore — 이미 닫혔거나 프로세스 종료됨 */
    }

    // 타이머 정리
    const timer = this.loginTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.loginTimers.delete(key);
    }
    this.loginResolvers.delete(key);
    this.states.delete(key);
  }

  /**
   * 특정 키가 실행 중(running/waiting-login)인지 확인.
   * 중복 `start-setup` 호출을 미리 차단하기 위해 사용.
   */
  isBusy(key: string): boolean {
    const state = this.states.get(key);
    if (!state) return false;
    return state.stepStatus === 'running' || state.stepStatus === 'waiting-login';
  }

  /**
   * 모든 활성 키를 순회하며 reset — will-quit 등 앱 종료 시 Playwright orphan 방지.
   */
  async resetAll(): Promise<void> {
    const keys = Array.from(this.states.keys());
    await Promise.allSettled(keys.map(k => this.reset(k)));
  }

  /**
   * 로그인 완료를 대기한다.
   * confirmLogin()이 호출되면 true, 타임아웃이면 false를 반환한다.
   */
  waitForLogin(key: string, timeout: number = 300_000): Promise<boolean> {
    console.log(`[${this.label}] 🔐 로그인 대기 시작 (${key})...`);

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.loginResolvers.delete(key);
        this.loginTimers.delete(key);
        console.log(`[${this.label}] ⏰ 로그인 대기 시간 초과 (${key})`);
        resolve(false);
      }, timeout);

      this.loginTimers.set(key, timer);

      this.loginResolvers.set(key, () => {
        clearTimeout(timer);
        this.loginResolvers.delete(key);
        this.loginTimers.delete(key);
        console.log(`[${this.label}] ✅ 로그인 완료 확인! (${key})`);
        resolve(true);
      });
    });
  }

  /**
   * 로그인 완료를 알린다.
   * 대기 중인 waitForLogin이 있으면 resolve하고 true를 반환한다.
   */
  confirmLogin(key: string): boolean {
    const resolver = this.loginResolvers.get(key);
    if (resolver) {
      resolver();
      return true;
    }
    return false;
  }
}
