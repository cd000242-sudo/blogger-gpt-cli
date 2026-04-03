// electron/oneclick/state/instances.ts
// 각 도메인별 StateManager 싱글턴 인스턴스

import { StateManager } from './StateManager';
import type { SetupState, ConnectState, InfraState, WebmasterState } from '../types';

export const setupStateManager = new StateManager<SetupState>('ONECLICK-SETUP');
export const connectStateManager = new StateManager<ConnectState>('ONECLICK-CONNECT');
export const infraStateManager = new StateManager<InfraState>('ONECLICK-INFRA');
export const webmasterStateManager = new StateManager<WebmasterState>('ONECLICK-WEBMASTER');
