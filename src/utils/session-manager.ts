/**
 * 세션 관리자 - 중복 로그인 방지 시스템
 * 
 * 기능:
 * - 세션 토큰 저장/로드
 * - 세션 유효성 검증 (서버 통신)
 * - 중복 로그인 감지 및 처리
 * - 주기적 세션 체크
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export interface SessionData {
  userId: string;
  sessionToken: string;
  deviceId: string;
  loginAt: number;
  lastValidatedAt?: number;
}

export interface SessionValidationResult {
  valid: boolean;
  code: 'SESSION_VALID' | 'SESSION_EXPIRED_BY_OTHER_LOGIN' | 'SESSION_NOT_FOUND' | 'SERVER_ERROR' | 'OFFLINE';
  message: string;
  loginAt?: number;
}

export class SessionManager {
  private sessionPath: string;
  private sessionData: SessionData | null = null;
  private validationInterval: NodeJS.Timeout | null = null;
  private onSessionExpiredCallback: ((reason: string) => void) | null = null;
  
  // 세션 검증 주기 (5분)
  private static readonly VALIDATION_INTERVAL_MS = 5 * 60 * 1000;
  // 오프라인 허용 시간 (30분) - 서버 연결 실패 시 이 시간 동안은 세션 유지
  private static readonly OFFLINE_GRACE_PERIOD_MS = 30 * 60 * 1000;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.sessionPath = path.join(userDataPath, 'session.json');
    this.loadSession();
  }

  /**
   * 세션 데이터 로드
   */
  private loadSession(): void {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const data = fs.readFileSync(this.sessionPath, 'utf8');
        this.sessionData = JSON.parse(data);
        console.log('[SESSION] 세션 데이터 로드 완료:', this.sessionData?.userId);
      }
    } catch (error) {
      console.error('[SESSION] 세션 데이터 로드 실패:', error);
      this.sessionData = null;
    }
  }

  /**
   * 세션 데이터 저장
   */
  private saveSession(): void {
    try {
      if (this.sessionData) {
        fs.writeFileSync(this.sessionPath, JSON.stringify(this.sessionData, null, 2), 'utf8');
        console.log('[SESSION] 세션 데이터 저장 완료');
      } else {
        // 세션 데이터가 없으면 파일 삭제
        if (fs.existsSync(this.sessionPath)) {
          fs.unlinkSync(this.sessionPath);
        }
      }
    } catch (error) {
      console.error('[SESSION] 세션 데이터 저장 실패:', error);
    }
  }

  /**
   * 새 세션 설정 (로그인 성공 시 호출)
   */
  setSession(userId: string, sessionToken: string, deviceId: string): void {
    this.sessionData = {
      userId,
      sessionToken,
      deviceId,
      loginAt: Date.now(),
      lastValidatedAt: Date.now()
    };
    this.saveSession();
    console.log('[SESSION] 새 세션 설정 완료:', userId);
  }

  /**
   * 세션 토큰 가져오기
   */
  getSessionToken(): string | null {
    return this.sessionData?.sessionToken || null;
  }

  /**
   * 세션 사용자 ID 가져오기
   */
  getUserId(): string | null {
    return this.sessionData?.userId || null;
  }

  /**
   * 세션 존재 여부 확인
   */
  hasSession(): boolean {
    return this.sessionData !== null && !!this.sessionData.sessionToken;
  }

  /**
   * 세션 삭제 (로그아웃 시 호출)
   */
  clearSession(): void {
    this.sessionData = null;
    this.saveSession();
    this.stopPeriodicValidation();
    console.log('[SESSION] 세션 삭제 완료');
  }

  /**
   * 서버에서 세션 유효성 검증
   */
  async validateSession(): Promise<SessionValidationResult> {
    if (!this.sessionData) {
      return {
        valid: false,
        code: 'SESSION_NOT_FOUND',
        message: '세션이 존재하지 않습니다.'
      };
    }

    try {
      // 환경 변수에서 서버 URL 가져오기
      const { loadEnvFromFile } = await import('../env');
      const env = loadEnvFromFile();
      const serverUrl = (env as any).licenseServerUrl || 
                       (env as any).LICENSE_SERVER_URL || 
                       (env as any).licenseRedeemUrl || 
                       (env as any).LICENSE_REDEEM_URL || 
                       process.env['LICENSE_SERVER_URL'] || 
                       '';
      
      if (!serverUrl) {
        console.log('[SESSION] 서버 URL 미설정 - 오프라인 모드');
        return this.handleOfflineMode();
      }

      // 서버 URL에서 베이스 URL 추출
      const baseUrl = serverUrl.replace(/\/redeem$/, '').replace(/\/$/, '');
      
      const axios = (await import('axios')).default;
      const response = await axios.post(
        `${baseUrl}/session/validate`,
        {
          userId: this.sessionData.userId,
          sessionToken: this.sessionData.sessionToken,
          appId: 'com.ridernam.blogger.automation'
        },
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const data = response.data;
      
      // 마지막 검증 시간 업데이트
      if (data.valid) {
        this.sessionData.lastValidatedAt = Date.now();
        this.saveSession();
      }

      return {
        valid: data.valid,
        code: data.code || (data.valid ? 'SESSION_VALID' : 'SESSION_NOT_FOUND'),
        message: data.message || '',
        loginAt: data.loginAt
      };

    } catch (error: any) {
      console.warn('[SESSION] 세션 검증 서버 연결 실패:', error.message);
      return this.handleOfflineMode();
    }
  }

  /**
   * 오프라인 모드 처리
   */
  private handleOfflineMode(): SessionValidationResult {
    if (!this.sessionData) {
      return {
        valid: false,
        code: 'SESSION_NOT_FOUND',
        message: '세션이 존재하지 않습니다.'
      };
    }

    // 마지막 검증 시간 확인
    const lastValidated = this.sessionData.lastValidatedAt || this.sessionData.loginAt;
    const timeSinceLastValidation = Date.now() - lastValidated;

    if (timeSinceLastValidation < SessionManager.OFFLINE_GRACE_PERIOD_MS) {
      // 오프라인 허용 시간 내 - 세션 유효로 처리
      console.log('[SESSION] 오프라인 모드 - 세션 유효 (grace period 내)');
      return {
        valid: true,
        code: 'OFFLINE',
        message: '오프라인 모드 (서버 연결 불가)'
      };
    }

    // 오프라인 허용 시간 초과
    console.log('[SESSION] 오프라인 모드 - 세션 만료 (grace period 초과)');
    return {
      valid: false,
      code: 'OFFLINE',
      message: '서버 연결이 필요합니다. 네트워크 연결을 확인해주세요.'
    };
  }

  /**
   * 세션 만료 콜백 설정
   */
  onSessionExpired(callback: (reason: string) => void): void {
    this.onSessionExpiredCallback = callback;
  }

  /**
   * 주기적 세션 검증 시작
   */
  startPeriodicValidation(): void {
    if (this.validationInterval) {
      return; // 이미 실행 중
    }

    console.log('[SESSION] 주기적 세션 검증 시작');
    
    this.validationInterval = setInterval(async () => {
      const result = await this.validateSession();
      
      if (!result.valid && result.code === 'SESSION_EXPIRED_BY_OTHER_LOGIN') {
        console.log('[SESSION] ⚠️ 다른 기기에서 로그인 감지!');
        this.clearSession();
        
        if (this.onSessionExpiredCallback) {
          this.onSessionExpiredCallback(result.message);
        }
      }
    }, SessionManager.VALIDATION_INTERVAL_MS);
  }

  /**
   * 주기적 세션 검증 중지
   */
  stopPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
      console.log('[SESSION] 주기적 세션 검증 중지');
    }
  }

  /**
   * 서버에 로그아웃 요청
   */
  async logout(): Promise<boolean> {
    if (!this.sessionData) {
      return true;
    }

    try {
      const { loadEnvFromFile } = await import('../env');
      const env = loadEnvFromFile();
      const serverUrl = (env as any).licenseServerUrl || 
                       (env as any).LICENSE_SERVER_URL || 
                       (env as any).licenseRedeemUrl || 
                       (env as any).LICENSE_REDEEM_URL || 
                       process.env['LICENSE_SERVER_URL'] || 
                       '';
      
      if (serverUrl) {
        const baseUrl = serverUrl.replace(/\/redeem$/, '').replace(/\/$/, '');
        const axios = (await import('axios')).default;
        
        await axios.post(
          `${baseUrl}/session/logout`,
          {
            userId: this.sessionData.userId,
            sessionToken: this.sessionData.sessionToken
          },
          {
            timeout: 5000,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('[SESSION] 서버 로그아웃 완료');
      }
    } catch (error: any) {
      console.warn('[SESSION] 서버 로그아웃 실패 (무시됨):', error.message);
    }

    this.clearSession();
    return true;
  }
}

// 싱글톤 인스턴스
let sessionManagerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager();
  }
  return sessionManagerInstance;
}
