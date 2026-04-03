// electron/oneclick/index.ts
// 원클릭 세팅 모듈 엔트리포인트 — IPC 핸들러 통합 등록

import { registerSetupHandlers } from './handlers/setupHandlers';
import { registerWebmasterHandlers } from './handlers/webmasterHandlers';
import { registerConnectHandlers } from './handlers/connectHandlers';
import { registerInfraHandlers } from './handlers/infraHandlers';
import { registerDialogHandler } from './handlers/dialogHandler';

/**
 * 원클릭 세팅 IPC 핸들러 15개를 등록한다.
 * - 세팅: 4채널 (start-setup, get-status, cancel, confirm-login)
 * - 웹마스터: 3채널 (start-webmaster, get-webmaster-status, cancel-webmaster)
 * - 연동: 3채널 (platform-connect, get-connect-status, cancel-connect)
 * - 인프라: 4채널 (start-infra, get-infra-status, cancel-infra, confirm-infra-login)
 * - 다이얼로그: 1채널 (dialog:open-file)
 */
export function registerOneclickSetupIpcHandlers(): void {
  console.log('[ONECLICK-IPC] 🚀 원클릭 세팅 IPC 핸들러 등록 시작...');

  registerSetupHandlers();
  registerWebmasterHandlers();
  registerConnectHandlers();
  registerInfraHandlers();
  registerDialogHandler();

  console.log('[ONECLICK-IPC] ✅ 원클릭 세팅 IPC 핸들러 15개 등록 완료');
}
