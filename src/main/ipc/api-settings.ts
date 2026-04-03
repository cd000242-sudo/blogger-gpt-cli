// @ts-nocheck
// API 설정 및 시스템 유틸리티 IPC 핸들러
import { ipcMain, app, shell, clipboard } from 'electron';
import { EnvironmentManager } from '../../utils/environment-manager';
import { apiHealthCheck, clearCache } from '../../utils/api-reliability';
import { checkUnlimitedLicense } from './shared';

export function setupApiSettingsHandlers() {
  // API 키 확인 핸들러
  if (!ipcMain.listenerCount('check-api-keys')) {
    ipcMain.handle('check-api-keys', async () => {
      try {
        const envManager = EnvironmentManager.getInstance();
        const env = envManager.getConfig();

        return {
          naverClientId: env.naverClientId || '',
          naverClientSecret: env.naverClientSecret || '',
          youtubeApiKey: env.youtubeApiKey || '',
          naverSearchAdAccessLicense: env.naverSearchAdAccessLicense || '',
          naverSearchAdSecretKey: env.naverSearchAdSecretKey || '',
          naverSearchAdCustomerId: env.naverSearchAdCustomerId || ''
        };
      } catch (error: any) {
        console.error('[KEYWORD-MASTER] check-api-keys 오류:', error);
        return {
          naverClientId: '',
          naverClientSecret: '',
          youtubeApiKey: '',
          naverSearchAdAccessLicense: '',
          naverSearchAdSecretKey: '',
          naverSearchAdCustomerId: ''
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ check-api-keys 핸들러 등록 완료');
  }

  // API 키 테스트 핸들러 (실제 API 호출로 검증)
  if (!ipcMain.listenerCount('test-api-keys')) {
    ipcMain.handle('test-api-keys', async () => {
      try {
        const envManager = EnvironmentManager.getInstance();
        const env = envManager.getConfig();
        const results: any = {
          naver: { configured: false, working: false, error: null },
          youtube: { configured: false, working: false, error: null },
          naverSearchAd: { configured: false, working: false, error: null }
        };

        // 네이버 API 테스트
        if (env.naverClientId && env.naverClientSecret) {
          results.naver.configured = true;
          try {
            const { getNaverAutocompleteKeywords } = await import('../../utils/naver-autocomplete');
            const testKeywords = await getNaverAutocompleteKeywords('테스트', {
              clientId: env.naverClientId,
              clientSecret: env.naverClientSecret
            });
            results.naver.working = Array.isArray(testKeywords);
            console.log('[API-TEST] 네이버 API 테스트 성공');
          } catch (err: any) {
            results.naver.error = err.message || '네이버 API 테스트 실패';
            console.error('[API-TEST] 네이버 API 테스트 실패:', err.message);
          }
        }

        // YouTube API 테스트
        if (env.youtubeApiKey) {
          results.youtube.configured = true;
          try {
            const { getYouTubeTrendKeywords } = await import('../../utils/youtube-data-api');
            const testVideos = await getYouTubeTrendKeywords({
              apiKey: env.youtubeApiKey,
              maxResults: 1
            });
            results.youtube.working = Array.isArray(testVideos);
            console.log('[API-TEST] YouTube API 테스트 성공');
          } catch (err: any) {
            results.youtube.error = err.message || 'YouTube API 테스트 실패';
            console.error('[API-TEST] YouTube API 테스트 실패:', err.message);
          }
        }

        // 네이버 검색광고 API 테스트
        if (env.naverSearchAdAccessLicense && env.naverSearchAdSecretKey && env.naverSearchAdCustomerId) {
          results.naverSearchAd.configured = true;
          try {
            const { getNaverSearchAdKeywordSuggestions } = await import('../../utils/naver-searchad-api');
            const testSuggestions = await getNaverSearchAdKeywordSuggestions({
              accessLicense: env.naverSearchAdAccessLicense,
              secretKey: env.naverSearchAdSecretKey,
              customerId: env.naverSearchAdCustomerId
            }, '테스트', 1);
            results.naverSearchAd.working = Array.isArray(testSuggestions);
            console.log('[API-TEST] 네이버 검색광고 API 테스트 성공');
          } catch (err: any) {
            results.naverSearchAd.error = err.message || '네이버 검색광고 API 테스트 실패';
            console.error('[API-TEST] 네이버 검색광고 API 테스트 실패:', err.message);
          }
        }

        return {
          success: true,
          results
        };
      } catch (error: any) {
        console.error('[KEYWORD-MASTER] test-api-keys 오류:', error);
        return {
          success: false,
          error: error.message || 'API 테스트 중 오류 발생'
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ test-api-keys 핸들러 등록 완료');
  }

  // 🔥 API 헬스 체크 핸들러 (100% 성공률 보장)
  if (!ipcMain.listenerCount('api-health-check')) {
    ipcMain.handle('api-health-check', async () => {
      try {
        console.log('[API-HEALTH] API 연결 상태 확인 시작...');

        const healthResult = await apiHealthCheck();
        const envManager = EnvironmentManager.getInstance();
        const env = envManager.getConfig();

        // API 키 구성 상태
        const apiStatus = {
          network: healthResult.network,
          naver: {
            connected: healthResult.naver,
            configured: !!(env.naverClientId && env.naverClientSecret),
            searchAdConfigured: !!(env.naverSearchAdAccessLicense && env.naverSearchAdSecretKey)
          },
          youtube: {
            connected: healthResult.youtube,
            configured: !!env.youtubeApiKey
          }
        };

        console.log('[API-HEALTH] ✅ 상태 확인 완료:', apiStatus);

        return {
          success: true,
          timestamp: new Date().toISOString(),
          ...apiStatus,
          recommendation: !healthResult.network
            ? '인터넷 연결을 확인해주세요.'
            : !apiStatus.naver.configured
              ? 'API 키를 설정하면 더 정확한 결과를 받을 수 있습니다.'
              : '모든 API가 정상 연결되었습니다.'
        };
      } catch (error: any) {
        console.error('[API-HEALTH] ❌ 오류:', error);
        return {
          success: false,
          error: error.message,
          network: false,
          naver: { connected: false, configured: false, searchAdConfigured: false },
          youtube: { connected: false, configured: false }
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ api-health-check 핸들러 등록 완료');
  }

  // 🔥 캐시 초기화 핸들러
  if (!ipcMain.listenerCount('clear-api-cache')) {
    ipcMain.handle('clear-api-cache', async (_event, pattern?: string) => {
      try {
        clearCache(pattern);
        console.log('[CACHE] ✅ 캐시 초기화 완료:', pattern || '전체');
        return { success: true, message: '캐시가 초기화되었습니다.' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ clear-api-cache 핸들러 등록 완료');
  }

  // 🔗 외부 URL 열기 핸들러
  if (!ipcMain.listenerCount('open-external-url')) {
    ipcMain.handle('open-external-url', async (_event, url: string) => {
      try {
        const { shell } = require('electron');
        await shell.openExternal(url);
        return { success: true };
      } catch (error: any) {
        console.error('[OPEN-URL] 오류:', error.message);
        return { success: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ open-external-url 핸들러 등록 완료');
  }

  // 📋 클립보드 복사 핸들러 (renderer 복사 실패 방지)
  if (!ipcMain.listenerCount('clipboard-write-text')) {
    ipcMain.handle('clipboard-write-text', async (_event, text: string) => {
      try {
        const { clipboard } = require('electron');
        clipboard.writeText(String(text || ''));
        return { success: true };
      } catch (error: any) {
        console.error('[CLIPBOARD] 오류:', error?.message || error);
        return { success: false, error: error?.message || 'clipboard error' };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ clipboard-write-text 핸들러 등록 완료');
  }

  // get-env 핸들러: 환경 설정 불러오기
  if (!ipcMain.listenerCount('get-env')) {
    ipcMain.handle('get-env', async () => {
      try {
        const envManager = EnvironmentManager.getInstance();
        const config = envManager.getConfig();
        console.log('[KEYWORD-MASTER] get-env 호출 - 설정 로드 완료');
        return { ok: true, data: config };
      } catch (error: any) {
        console.error('[KEYWORD-MASTER] get-env 오류:', error);
        return { ok: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ get-env 핸들러 등록 완료');
  }

  // save-env 핸들러: 환경 설정 저장
  if (!ipcMain.listenerCount('save-env')) {
    ipcMain.handle('save-env', async (_event, env: any) => {
      try {
        console.log('[KEYWORD-MASTER] save-env 호출:', {
          hasNaverId: !!env.naverClientId,
          hasNaverSecret: !!env.naverClientSecret,
          hasYoutube: !!env.youtubeApiKey,
          hasSearchAdLicense: !!env.naverSearchAdAccessLicense,
          hasSearchAdSecret: !!env.naverSearchAdSecretKey
        });

        const envManager = EnvironmentManager.getInstance();
        await envManager.saveConfig(env);
        envManager.reloadConfig();

        console.log('[KEYWORD-MASTER] ✅ save-env 저장 완료');
        return { ok: true, logs: '설정이 저장되었습니다.' };
      } catch (error: any) {
        console.error('[KEYWORD-MASTER] save-env 오류:', error);
        return { ok: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ save-env 핸들러 등록 완료');
  }

  // is-developer-mode 핸들러: 개발자 모드 확인
  if (!ipcMain.listenerCount('is-developer-mode')) {
    ipcMain.handle('is-developer-mode', async () => {
      const isDev = !app.isPackaged || process.env['NODE_ENV'] === 'development';
      console.log('[KEYWORD-MASTER] is-developer-mode:', isDev);
      return isDev;
    });
    console.log('[KEYWORD-MASTER] ✅ is-developer-mode 핸들러 등록 완료');
  }

  // is-packaged 핸들러: 패키징 여부 확인
  if (!ipcMain.listenerCount('is-packaged')) {
    ipcMain.handle('is-packaged', async () => {
      console.log('[KEYWORD-MASTER] is-packaged:', app.isPackaged);
      return app.isPackaged;
    });
    console.log('[KEYWORD-MASTER] ✅ is-packaged 핸들러 등록 완료');
  }

  // 키워드 설정 저장 핸들러 (save-env와 동일하게 처리)
  if (!ipcMain.listenerCount('save-keyword-settings')) {
    ipcMain.handle('save-keyword-settings', async (event, settings: any) => {
      try {
        console.log('[KEYWORD-MASTER] save-keyword-settings 호출:', {
          hasNaverId: !!settings.naverClientId,
          hasNaverSecret: !!settings.naverClientSecret,
          hasYoutube: !!settings.youtubeApiKey,
          hasSearchAdLicense: !!settings.naverSearchAdAccessLicense,
          hasSearchAdSecret: !!settings.naverSearchAdSecretKey,
          hasSearchAdCustomerId: !!settings.naverSearchAdCustomerId
        });

        const envManager = EnvironmentManager.getInstance();

        // 환경 변수 설정 객체 생성
        const envConfig: any = {};
        if (settings.naverClientId) envConfig.naverClientId = settings.naverClientId;
        if (settings.naverClientSecret) envConfig.naverClientSecret = settings.naverClientSecret;
        if (settings.youtubeApiKey) envConfig.youtubeApiKey = settings.youtubeApiKey;
        if (settings.naverSearchAdAccessLicense) envConfig.naverSearchAdAccessLicense = settings.naverSearchAdAccessLicense;
        if (settings.naverSearchAdSecretKey) envConfig.naverSearchAdSecretKey = settings.naverSearchAdSecretKey;
        if (settings.naverSearchAdCustomerId) envConfig.naverSearchAdCustomerId = settings.naverSearchAdCustomerId;

        // 설정 저장
        await envManager.saveConfig(envConfig);

        // 설정 리로드하여 즉시 반영
        envManager.reloadConfig();

        console.log('[KEYWORD-MASTER] ✅ 키워드 설정 저장 완료');
        return {
          success: true,
          saved: {
            naver: !!(envConfig.naverClientId && envConfig.naverClientSecret),
            youtube: !!envConfig.youtubeApiKey,
            searchAd: !!(envConfig.naverSearchAdAccessLicense && envConfig.naverSearchAdSecretKey && envConfig.naverSearchAdCustomerId)
          }
        };
      } catch (error: any) {
        console.error('[KEYWORD-MASTER] save-keyword-settings 오류:', error);
        return {
          success: false,
          error: error.message || '설정 저장 실패'
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ save-keyword-settings 핸들러 등록 완료');
  }
}
