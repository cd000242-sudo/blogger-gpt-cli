// @ts-nocheck
// Keyword Analysis IPC Handlers
// analyze-keyword-competition, generate-keyword-mindmap, save-network-optimization
import { ipcMain } from 'electron';
import { EnvironmentManager } from '../../utils/environment-manager';
import * as licenseManager from '../../utils/licenseManager';
import { checkUnlimitedLicense } from './shared';

export function setupKeywordAnalysisHandlers() {

  // ========================================
  // 키워드 경쟁력 분석 핸들러
  // ========================================
  // 기존 핸들러 제거
  try {
    if (ipcMain.listenerCount('analyze-keyword-competition') > 0) {
      console.log('[KEYWORD-MASTER] 기존 analyze-keyword-competition 핸들러 제거 중...');
      ipcMain.removeHandler('analyze-keyword-competition');
    }
  } catch (e) {
    // 무시
  }

  ipcMain.handle('analyze-keyword-competition', async (_event, keyword: string) => {
    try {
      // 라이선스 체크
      const license = await licenseManager.loadLicense();
      if (!license || !license.isValid) {
        return {
          success: false,
          error: '라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.'
        };
      }

      console.log(`[COMPETITION] 키워드 경쟁력 분석 시작: "${keyword}"`);

      // 환경 변수에서 API 키 로드
      const envManager = EnvironmentManager.getInstance();
      const env = envManager.getConfig();
      const naverClientId = env.naverClientId || process.env['NAVER_CLIENT_ID'] || '';
      const naverClientSecret = env.naverClientSecret || process.env['NAVER_CLIENT_SECRET'] || '';

      if (!naverClientId || !naverClientSecret) {
        return {
          success: false,
          error: '네이버 API 키가 설정되지 않았습니다. 환경 설정에서 API 키를 입력해주세요.'
        };
      }

      const { analyzeKeywordCompetition } = await import('../../utils/keyword-competition/competition-analyzer');
      const result = await analyzeKeywordCompetition(keyword, {
        clientId: naverClientId,
        clientSecret: naverClientSecret
      });

      console.log(`[COMPETITION] ✅ 분석 완료: 점수 ${result.competitionScore}, 추천 ${result.recommendation}`);

      return {
        success: true,
        data: result
      };
    } catch (error: any) {
      console.error('[COMPETITION] 분석 실패:', error);
      return {
        success: false,
        error: error.message || '키워드 경쟁력 분석 실패'
      };
    }
  });
  console.log('[KEYWORD-MASTER] ✅ analyze-keyword-competition 핸들러 등록 완료');

  // ========================================
  // 연상 키워드 마인드맵 생성 핸들러
  // ========================================
  if (!ipcMain.listenerCount('generate-keyword-mindmap')) {
    ipcMain.handle('generate-keyword-mindmap', async (event, keyword: string, options: any = {}) => {
      try {
        // 라이선스 체크
        const license = await licenseManager.loadLicense();
        if (!license || !license.isValid) {
          event.sender.send('keyword-mindmap-progress', {
            type: 'error',
            message: '라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.'
          });
          return {
            success: false,
            error: '라이선스가 등록되지 않았습니다.'
          };
        }

        console.log(`[MINDMAP] 키워드 마인드맵 생성 시작: "${keyword}"`);
        const envManager = EnvironmentManager.getInstance();
        const env = envManager.getConfig();

        const { generateKeywordMindmap, extractAllKeywords } = await import('../../utils/keyword-mindmap');

        // 🔥 무제한 확장 옵션 처리
        const maxDepth = options.maxDepth || 3;
        const maxKeywordsPerLevel = options.maxKeywordsPerLevel || 100; // 레벨당 키워드 수 증가
        const maxTotalKeywords = options.maxTotalKeywords || undefined; // undefined = 무제한

        const mindmapOptions = {
          maxDepth: maxDepth,
          maxKeywordsPerLevel: maxKeywordsPerLevel,
          maxTotalKeywords: maxTotalKeywords, // 🔥 무제한 확장 지원
          clientId: env.naverClientId,
          clientSecret: env.naverClientSecret,
          searchAdLicense: env.naverSearchAdAccessLicense,
          searchAdSecret: env.naverSearchAdSecretKey,
          searchAdCustomerId: env.naverSearchAdCustomerId,
          smartExpansion: options.smartExpansion !== false, // 기본값 true
          // 🔥 진행 상황 실시간 전송
          onProgress: (progress: any) => {
            event.sender.send('keyword-mindmap-progress', {
              type: 'progress',
              ...progress
            });
          }
        };

        console.log(`[MINDMAP] 옵션: 깊이=${maxDepth}, 레벨당=${maxKeywordsPerLevel}, 목표=${maxTotalKeywords || '무제한'}`);

        const mindmap = await generateKeywordMindmap(keyword, mindmapOptions);
        const allKeywords = extractAllKeywords(mindmap);

        console.log(`[MINDMAP] ✅ 마인드맵 생성 완료: 총 ${allKeywords.length}개 키워드`);

        // 완료 메시지 전송
        event.sender.send('keyword-mindmap-progress', {
          type: 'complete',
          message: `✅ 완료! 총 ${allKeywords.length}개 키워드 발굴`,
          collectedKeywords: allKeywords.length
        });

        return {
          success: true,
          mindmap,
          keywords: allKeywords,
          totalKeywords: allKeywords.length,
        };
      } catch (error: any) {
        console.error('[MINDMAP] 생성 실패:', error);
        return {
          success: false,
          error: error.message || '마인드맵 생성 실패',
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ generate-keyword-mindmap 핸들러 등록 완료');
  }

  // ========================================
  // 네트워크 최적화 핸들러
  // ========================================
  if (!ipcMain.listenerCount('save-network-optimization')) {
    ipcMain.handle('save-network-optimization', async (event, settings: any) => {
      try {
        console.log('[NETWORK-OPTIMIZATION] 네트워크 최적화 설정 저장:', settings);

        // 최적화 설정을 config.json에 저장
        const envManager = EnvironmentManager.getInstance();
        await envManager.saveConfig({
          networkOptimization: settings
        });

        console.log('[NETWORK-OPTIMIZATION] ✅ 네트워크 최적화 설정 저장 완료');
        return { success: true };
      } catch (error: any) {
        console.error('[NETWORK-OPTIMIZATION] 저장 실패:', error);
        return { success: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ save-network-optimization 핸들러 등록 완료');
  }

}
