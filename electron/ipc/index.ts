/**
 * IPC 핸들러 통합 등록
 *
 * main.ts에서 이 파일만 import하면 모든 분리된 핸들러가 등록됩니다.
 * 새 핸들러 파일을 추가할 때 여기에 import하세요.
 */
export { registerScheduleIpcHandlers } from './scheduleIpcHandlers';
export { registerEnvIpcHandlers } from './envIpcHandlers';
export { registerConfigIpcHandlers } from './configIpcHandlers';

/**
 * 분리된 모든 IPC 핸들러를 한번에 등록
 */
export function registerAllSplitHandlers(): void {
  const { registerScheduleIpcHandlers } = require('./scheduleIpcHandlers');
  const { registerEnvIpcHandlers } = require('./envIpcHandlers');
  const { registerConfigIpcHandlers } = require('./configIpcHandlers');
  // 기존 핸들러
  const { registerAdsenseIpcHandlers } = require('../adsenseIpcHandlers');
  const { registerAdspowerIpcHandlers } = require('../adspowerIpcHandlers');
  const { registerOneclickSetupIpcHandlers } = require('../oneclickSetupIpcHandlers');

  registerScheduleIpcHandlers();
  registerEnvIpcHandlers();
  registerConfigIpcHandlers();
  registerAdsenseIpcHandlers();
  registerAdspowerIpcHandlers();
  registerOneclickSetupIpcHandlers();
}
