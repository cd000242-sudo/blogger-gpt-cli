// @ts-nocheck
// 공유 유틸리티: 라이선스 체크, 전역 상태
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// 전역 중지 플래그 (키워드별로 관리)
export const keywordDiscoveryAbortMap = new Map<string, boolean>();

// 무제한 라이선스 체크 헬퍼 함수
export function checkUnlimitedLicense(): { allowed: boolean; error?: any } {
  const isDevelopment = !app.isPackaged || process.env['NODE_ENV'] === 'development';

  if (isDevelopment) {
    return { allowed: true };
  }

  try {
    const licensePath = path.join(app.getPath('userData'), 'license', 'license.json');
    if (!fs.existsSync(licensePath)) {
      return {
        allowed: false,
        error: {
          error: '라이선스가 필요합니다',
          message: '이 기능은 무제한 기간 구매자만 사용할 수 있습니다.',
          requiresUnlimited: true
        }
      };
    }

    const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
    const isUnlimited = licenseData.maxUses === -1 || licenseData.remaining === -1 || licenseData.plan === 'unlimited';

    if (!isUnlimited) {
      return {
        allowed: false,
        error: {
          error: '무제한 라이선스가 필요합니다',
          message: '이 기능은 무제한 기간 구매자만 사용할 수 있습니다.',
          requiresUnlimited: true
        }
      };
    }

    return { allowed: true };
  } catch (licenseError: any) {
    return {
      allowed: false,
      error: {
        error: '라이선스 확인 실패',
        message: '라이선스를 확인하는 중 오류가 발생했습니다.',
        requiresUnlimited: true
      }
    };
  }
}
