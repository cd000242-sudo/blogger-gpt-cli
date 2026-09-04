/**
 * 자동 로그인 관리자
 * 앱 시작 시 저장된 인증 정보로 자동 로그인 시도
 */

import { getLicenseManager } from './license-manager-new';
import * as fs from 'fs';
import * as path from 'path';

// Electron app을 동적으로 가져오기 (런타임에만 필요)
function getAppPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {
    // Electron이 아닌 환경
  }
  return path.join(process.cwd(), 'data');
}

/**
 * 자동 로그인 설정 저장 경로
 */
function getAutoLoginConfigPath(): string {
  const userDataPath = getAppPath();
  return path.join(userDataPath, 'auto-login.json');
}

export interface AutoLoginResult {
  success: boolean;
  shouldShowLoginWindow: boolean;
  message?: string;
  licenseData?: any;
}

/**
 * 자동 로그인 시도
 * - 저장된 인증 정보 확인
 * - 유효한 경우 자동 로그인 성공
 * - 만료되었거나 없는 경우 로그인 창 표시 필요
 */
export async function tryAutoLogin(): Promise<AutoLoginResult> {
  try {
    const licenseManager = getLicenseManager();
    const status = licenseManager.getLicenseStatus();
    
    if (status.valid === true) {
      // 기간제인 경우 만료 확인
      if (status.licenseData?.licenseType === 'temporary' && status.licenseData?.expiresAt) {
        const expiresDate = new Date(status.licenseData.expiresAt);
        const now = new Date();

        if (expiresDate <= now) {
          return {
            success: false,
            shouldShowLoginWindow: true,
            message: '라이선스가 만료되었습니다. 코드를 다시 등록해주세요.'
          };
        }
      }

      /**
       * v3.8.636 — 라이선스가 유효해도 **로그인 창은 띄운다.**
       *
       * 사장님: "앱을 시작하면 로그인이 자동으로 되는게아니라
       *          아이디 비밀번호만 자동으로 입력되어있어야지"
       *
       * 예전에는 설정이 켜져 있으면 창을 건너뛰고 바로 들어갔다. 그러면
       * 새 버전 알림도 못 보고, 로그인된 계정이 뭐지도 모른 채 진입한다.
       * 이제 아이디·비밀번호만 채워 두고 [로그인]은 사람이 누른다.
       */
      return {
        success: false,
        shouldShowLoginWindow: true,
        message: '로그인이 필요합니다.',
        licenseData: status.licenseData
      };
    }
    
    // 라이선스가 없거나 유효하지 않은 경우
    return {
      success: false,
      shouldShowLoginWindow: true,
      message: status.message || '라이선스 인증이 필요합니다.'
    };
  } catch (error: any) {
    console.error('[AUTO-LOGIN] 자동 로그인 확인 실패:', error);
    return {
      success: false,
      shouldShowLoginWindow: true,
      message: '자동 로그인 확인 중 오류가 발생했습니다.'
    };
  }
}

/**
 * 자동 로그인 설정 저장
 */
/**
 * 비밀번호를 OS 금고(Windows DPAPI · macOS Keychain)로 잠그고 푸는다 (v3.8.636).
 *
 * 파일에 그대로 적으면 auto-login.json 을 여는 순간 비밀번호가 드러난다.
 * 잠금장치를 못 쓰는 환경이면 **저장하지 않는다** — 약하게 저장하느니
 * 안 채워지는 편이 낫다(아이디는 그대로 채워진다).
 */
function lockPassword(plain: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron');
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.encryptString(plain).toString('base64');
  } catch {
    return '';
  }
}

function unlockPassword(sealed: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { safeStorage } = require('electron');
    if (!safeStorage || !safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(sealed, 'base64'));
  } catch {
    // 다른 PC·다른 계정에서 복사해 온 파일은 못 푸는다. 그럄 비워 둔다
    return '';
  }
}

/**
 * 설정 저장.
 *
 * password 를 안 주면 **이미 저장된 것을 그대로 둔다** —
 * 예전 호출부(2인자)가 남아 있어서, 안 그러면 어느 한 곳이
 * 조용히 비밀번호를 지워 버린다.
 */
export function saveAutoLoginConfig(enabled: boolean, userId?: string, password?: string): void {
  try {
    const configPath = getAutoLoginConfigPath();

    let sealed = '';
    if (enabled) {
      if (typeof password === 'string' && password) {
        sealed = lockPassword(password);
      } else {
        try {
          const before = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          sealed = String(before?.pw || '');
        } catch {
          sealed = '';
        }
      }
    }

    const config = {
      enabled,
      userId: enabled ? userId : undefined,
      pw: sealed || undefined,
      savedAt: Date.now()
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[AUTO-LOGIN] 설정 저장:', enabled, '| 비밀번호 보관:', sealed ? '예' : '아니오');
  } catch (error: any) {
    console.error('[AUTO-LOGIN] 설정 저장 실패:', error);
  }
}

/**
 * 자동 로그인 설정 로드
 */
export function loadAutoLoginConfig(): {
  enabled: boolean;
  userId?: string | undefined;
  password?: string | undefined;
} {
  try {
    const configPath = getAutoLoginConfigPath();
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        enabled: config.enabled === true,
        userId: config.userId,
        password: config.pw ? unlockPassword(String(config.pw)) : undefined
      };
    }
  } catch (error: any) {
    console.error('[AUTO-LOGIN] 설정 로드 실패:', error);
  }
  return { enabled: false };
}

/**
 * 자동 로그인 설정 삭제
 */
export function clearAutoLoginConfig(): void {
  try {
    const configPath = getAutoLoginConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log('[AUTO-LOGIN] 자동 로그인 설정 삭제됨');
    }
  } catch (error: any) {
    console.error('[AUTO-LOGIN] 설정 삭제 실패:', error);
  }
}

