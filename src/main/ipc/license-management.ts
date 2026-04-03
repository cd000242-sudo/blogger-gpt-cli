// @ts-nocheck
// 라이선스 관리 및 튜토리얼 영상 IPC 핸들러
import { ipcMain, app } from 'electron';
import * as licenseManager from '../../utils/licenseManager';

export function setupLicenseManagementHandlers() {
  // ========================================
  // 사용법 영상 관리 핸들러
  // ========================================
  if (!ipcMain.listenerCount('get-tutorial-videos')) {
    ipcMain.handle('get-tutorial-videos', async () => {
      try {
        const fs = require('fs');
        const path = require('path');

        // 사용법 영상 파일 경로
        const { app } = require('electron');
        const userDataPath = app.getPath('userData');
        const videosPath = path.join(userDataPath, 'tutorial-videos.json');

        if (fs.existsSync(videosPath)) {
          const videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
          return { success: true, videos: videosData };
        }

        return { success: true, videos: {} };
      } catch (error: any) {
        console.error('[TUTORIAL] 사용법 영상 로드 실패:', error);
        return { success: false, error: error.message, videos: {} };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ get-tutorial-videos 핸들러 등록 완료');
  }

  if (!ipcMain.listenerCount('save-tutorial-video')) {
    ipcMain.handle('save-tutorial-video', async (event, data: { featureName: string; videoUrl: string }) => {
      try {
        const fs = require('fs');
        const path = require('path');

        // 사용법 영상 파일 경로
        const { app } = require('electron');
        const userDataPath = app.getPath('userData');
        const videosPath = path.join(userDataPath, 'tutorial-videos.json');

        // 기존 영상 데이터 로드
        let videosData: Record<string, string> = {};
        if (fs.existsSync(videosPath)) {
          videosData = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
        }

        // 새 영상 추가/업데이트
        videosData[data.featureName] = data.videoUrl;

        // 디렉토리 생성
        const dir = path.dirname(videosPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // 파일 저장
        fs.writeFileSync(videosPath, JSON.stringify(videosData, null, 2), 'utf8');

        console.log(`[TUTORIAL] ✅ 사용법 영상 저장 완료: ${data.featureName}`);
        return { success: true };
      } catch (error: any) {
        console.error('[TUTORIAL] 사용법 영상 저장 실패:', error);
        return { success: false, error: error.message };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ save-tutorial-video 핸들러 등록 완료');
  }

  // ========================================
  // 라이선스 관리 핸들러
  // ========================================
  if (!ipcMain.listenerCount('get-license-info')) {
    ipcMain.handle('get-license-info', async (_event, options?: { forceRefresh?: boolean }) => {
      try {
        // 서버에서 최신 라이선스 정보 동기화 (앱 시작 시 또는 강제 갱신 시)
        if (options?.forceRefresh) {
          console.log('[LICENSE] 🔄 서버에서 라이선스 정보 강제 동기화...');
          const refreshResult = await licenseManager.refreshLicenseFromServer();
          if (!refreshResult.success) {
            console.warn('[LICENSE] 서버 동기화 실패:', refreshResult.message);
            // 동기화 실패해도 로컬 라이선스로 계속 진행
          }
        }

        const license = await licenseManager.loadLicense();

        // 개발 환경이 아니고 라이선스가 없으면 차단
        if (!license || !license.isValid) {
          return {
            hasLicense: false,
            isPremium: false,
            isUnlimited: false,
            message: '라이선스가 등록되지 않았습니다. 라이선스를 등록해주세요.'
          };
        }

        // 만료 확인
        if (licenseManager.isLicenseExpired(license)) {
          return {
            hasLicense: true,
            isPremium: false,
            isUnlimited: false,
            isExpired: true,
            message: '라이선스가 만료되었습니다.',
            expiresAt: license.expiresAt,
            userId: license.userId
          };
        }

        // 🔥 라이선스 타입 판단 (영구제 우선)
        let isUnlimited = false;
        let isPremium = false;
        let is1Year = false;
        let daysLeft = 0;

        // 🔥 영구제 판단 (여러 조건 체크)
        if (license.isUnlimited === true ||
          license.plan === 'unlimited' ||
          license.licenseType === 'unlimited' ||
          license.licenseType === 'permanent' ||
          license.maxUses === -1 ||
          license.remaining === -1 ||
          !license.expiresAt) {
          isUnlimited = true;
          isPremium = true;
          console.log('[LICENSE] 🔥 영구제(무제한) 라이선스 감지!');
        } else if (license.expiresAt) {
          // 기간제인 경우에만 날짜 계산
          daysLeft = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          // 🔥 서버에서 받은 plan/licenseType 기반으로 등급 판단 (남은 일수가 아닌 원래 유형으로!)
          const typeStr = (license.licenseType || license.plan || '').toUpperCase();
          if (['1YEAR', '365DAY'].includes(typeStr)) {
            is1Year = true;
            isPremium = true;
          } else if (['3MONTHS', '90DAY', 'THREE-MONTHS-PLUS'].includes(typeStr) || daysLeft >= 90) {
            isPremium = true;
          }
        }

        console.log('[LICENSE] 📋 라이선스 정보 계산:', {
          userId: license.userId,
          plan: license.plan,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          daysLeft,
          isUnlimited,
          is1Year,
          isPremium,
          lastSyncAt: license.lastSyncAt
        });

        return {
          hasLicense: true,
          isUnlimited,  // 무제한 라이선스 여부
          is1Year,      // 1년 라이선스 여부 (PRO 트래픽 헌터용)
          isPremium,    // 프리미엄 (3개월 이상)
          licenseType: license.licenseType || license.plan,
          plan: license.plan,
          expiresAt: license.expiresAt,
          userId: license.userId,
          daysLeft,
          remaining: license.remaining,
          maxUses: license.maxUses,
          lastSyncAt: license.lastSyncAt
        };
      } catch (error: any) {
        console.error('[LICENSE] 라이선스 정보 조회 실패:', error);
        return {
          hasLicense: false,
          isPremium: false,
          isUnlimited: false,
          error: error.message
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ get-license-info 핸들러 등록 완료');
  }

  // 라이선스 서버 동기화 핸들러
  if (!ipcMain.listenerCount('refresh-license')) {
    ipcMain.handle('refresh-license', async () => {
      try {
        console.log('[LICENSE] 🔄 라이선스 서버 동기화 요청...');
        const result = await licenseManager.refreshLicenseFromServer();

        if (result.success && result.license) {
          // 동기화 성공 후 최신 정보 반환
          const license = result.license;
          let daysLeft = 0;

          // 🔥 영구제 판단
          let isUnlimited = license.isUnlimited === true ||
            !license.expiresAt ||
            license.plan === 'unlimited' ||
            license.licenseType === 'unlimited' ||
            license.licenseType === 'permanent';
          let is1Year = false;
          let isPremium = isUnlimited;

          if (!isUnlimited && license.expiresAt) {
            daysLeft = Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            // 🔥 서버에서 받은 plan/licenseType 기반으로 등급 판단
            const typeStr = (license.licenseType || license.plan || '').toUpperCase();
            is1Year = ['1YEAR', '365DAY'].includes(typeStr);
            isPremium = is1Year || ['3MONTHS', '90DAY', 'THREE-MONTHS-PLUS'].includes(typeStr) || daysLeft >= 90;
          }

          console.log('[LICENSE] 동기화 결과:', { isUnlimited, is1Year, isPremium, plan: license.plan });

          return {
            success: true,
            message: '라이선스 정보가 서버에서 동기화되었습니다.',
            license: {
              hasLicense: true,
              isUnlimited,
              is1Year,
              isPremium,
              userId: license.userId,
              plan: license.plan,
              expiresAt: license.expiresAt,
              daysLeft,
              lastSyncAt: license.lastSyncAt
            }
          };
        }

        return {
          success: false,
          message: result.message || '동기화 실패'
        };
      } catch (error: any) {
        console.error('[LICENSE] 서버 동기화 오류:', error);
        return {
          success: false,
          message: error.message || '서버 동기화 중 오류 발생'
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ refresh-license 핸들러 등록 완료');
  }

  if (!ipcMain.listenerCount('register-license')) {
    ipcMain.handle('register-license', async (_event, data: {
      licenseCode?: string;
      userId?: string;
      userPassword?: string;
    }) => {
      try {
        const deviceId = await licenseManager.getDeviceId();

        // 서버 URL (admin-panel 서버)
        const serverUrl = process.env['LICENSE_SERVER_URL'] || 'http://localhost:3000';

        const result = await licenseManager.verifyLicense(
          data.licenseCode || '',
          deviceId,
          serverUrl,
          data.userId,
          data.userPassword
        );

        if (result.valid && result.license) {
          console.log('[LICENSE] ✅ 라이선스 등록 성공:', {
            userId: result.license.userId,
            type: result.license.licenseType || result.license.plan
          });

          return {
            success: true,
            message: '라이선스가 성공적으로 등록되었습니다.',
            isPremium: result.license.plan === 'unlimited' ||
              result.license.maxUses === -1 ||
              !result.license.expiresAt
          };
        } else {
          console.error('[LICENSE] ❌ 라이선스 등록 실패:', result.message);
          return {
            success: false,
            message: result.message || '라이선스 등록에 실패했습니다.'
          };
        }
      } catch (error: any) {
        console.error('[LICENSE] 라이선스 등록 오류:', error);
        return {
          success: false,
          message: `오류: ${error.message}`
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ register-license 핸들러 등록 완료');
  }

  if (!ipcMain.listenerCount('check-premium-access')) {
    ipcMain.handle('check-premium-access', async () => {
      try {
        const license = await licenseManager.loadLicense();

        if (!license || !license.isValid) {
          return {
            allowed: false,
            message: '프리미엄 기능은 영구 라이선스 사용자만 이용 가능합니다.'
          };
        }

        if (licenseManager.isLicenseExpired(license)) {
          return {
            allowed: false,
            message: '라이선스가 만료되었습니다. 갱신해주세요.'
          };
        }

        const isPremium = license.plan === 'unlimited' ||
          license.maxUses === -1 ||
          license.remaining === -1 ||
          !license.expiresAt;

        if (!isPremium) {
          return {
            allowed: false,
            message: '이 기능은 영구 라이선스 사용자만 이용 가능합니다.\n지금 업그레이드하시겠습니까?'
          };
        }

        return {
          allowed: true
        };
      } catch (error: any) {
        console.error('[LICENSE] 프리미엄 접근 확인 실패:', error);
        return {
          allowed: false,
          message: '라이선스 확인에 실패했습니다.'
        };
      }
    });
    console.log('[KEYWORD-MASTER] ✅ check-premium-access 핸들러 등록 완료');
  }
}
