// @ts-nocheck
// 키워드 마스터 IPC 핸들러 — 통합 진입점
// 8,463줄 갓 파일을 10개 도메인 모듈로 분할
import { ipcMain } from 'electron';

import { setupWindowManagementHandlers } from './window-management';
import { setupKeywordDiscoveryHandlers } from './keyword-discovery';
import { setupRealtimeTrendsHandlers } from './realtime-trends';
import { setupSchedulingHandlers } from './scheduling-notifications';
import { setupApiSettingsHandlers } from './api-settings';
import { setupContentCrawlingHandlers } from './content-crawling';
import { setupKeywordAnalysisHandlers } from './keyword-analysis';
import { setupLicenseManagementHandlers } from './license-management';
import { setupAdvancedHuntingHandlers } from './advanced-hunting';
import { setupUtilityAiHandlers } from './utility-ai';

let handlersSetup = false;

export function setupKeywordMasterHandlers() {
  if (handlersSetup) {
    console.log('[KEYWORD-MASTER] 핸들러 이미 등록됨, 건너뜀');
    return;
  }

  console.log('[KEYWORD-MASTER] IPC 핸들러 등록 시작 (모듈화)');

  // 기존 핸들러 제거 (중복 방지)
  const handlerNames = [
    'open-keyword-master-window',
    'find-golden-keywords',
    'get-realtime-keywords',
    'get-trending-keywords',
    'hunt-timing-gold',
    'check-keyword-rank',
    'get-youtube-videos',
    'get-env',
    'save-env',
    'check-api-keys',
    'get-sns-trends',
    'get-google-trend-keywords',
    'get-license-info',
    'register-license',
    'check-premium-access',
    'infinite-keyword-search',
    'export-keywords-to-excel',
    'get-keyword-expansions',
    'get-rising-keywords',
    'get-realtime-rising',
    'search-suffix-keywords',
    'analyze-keyword-competition'
  ];

  handlerNames.forEach(name => {
    try {
      if (ipcMain.listenerCount(name) > 0) {
        ipcMain.removeHandler(name);
      }
    } catch {
      // 무시
    }
  });

  // 도메인별 핸들러 등록
  setupWindowManagementHandlers();
  setupKeywordDiscoveryHandlers();
  setupRealtimeTrendsHandlers();
  setupSchedulingHandlers();
  setupApiSettingsHandlers();
  setupContentCrawlingHandlers();
  setupKeywordAnalysisHandlers();
  setupLicenseManagementHandlers();
  setupAdvancedHuntingHandlers();
  setupUtilityAiHandlers();

  handlersSetup = true;
  console.log('[KEYWORD-MASTER] ✅ 모든 IPC 핸들러 등록 완료');
}
