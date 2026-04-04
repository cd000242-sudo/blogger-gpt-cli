/**
 * 라이선스 관리 시스템
 * 아이디/비밀번호/코드 기반 인증
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { app } from 'electron';
import { getSessionManager, SessionValidationResult } from './session-manager';

export interface LicenseData {
  userId: string;
  passwordHash: string;
  licenseCode?: string;
  licenseType: 'temporary' | 'permanent';
  serverLicenseType?: string; // 서버에서 받은 라이선스 유형 (TRIAL7, PAID30, PAID90, PAID365, LIFE 등)
  expiresAt?: number; // 기간제인 경우 만료 시간 (timestamp)
  activatedAt: number;
  deviceId: string;
  patchFileHash?: string; // 영구제 패치 파일 해시
}

export interface LicenseAuthResult {
  success: boolean;
  message: string;
  licenseData?: LicenseData;
  sessionToken?: string;
  previousSessionTerminated?: boolean;
}

export class LicenseManager {
  private licensePath: string;
  private patchFilePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.licensePath = path.join(userDataPath, 'license.json');
    this.patchFilePath = path.join(userDataPath, 'license.patch');
  }

  /**
   * 비밀번호 해시 생성 (bcrypt, salt round 12)
   */
  private hashPassword(password: string): string {
    return bcrypt.hashSync(password, 12);
  }

  /**
   * 비밀번호 검증 (bcrypt + SHA256 하위 호환)
   */
  private verifyPassword(password: string, hash: string): boolean {
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
      return bcrypt.compareSync(password, hash);
    }
    const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
    return sha256Hash === hash;
  }

  /**
   * 패치 파일 해시 생성
   */
  private hashPatchFile(patchContent: string): string {
    return crypto.createHash('sha256').update(patchContent).digest('hex');
  }

  /**
   * 디바이스 ID 생성
   */
  private getDeviceId(): string {
    const os = require('os');
    const nets = os.networkInterfaces();
    let mac = '';
    for (const iface of Object.values(nets) as any[]) {
      for (const info of iface || []) {
        if (!info.internal && info.mac && info.mac !== '00:00:00:00:00:00') {
          mac = info.mac;
          break;
        }
      }
      if (mac) break;
    }
    const base = `${os.hostname()}|${os.platform()}|${os.arch()}|${mac}|${os.cpus()[0]?.model || ''}`;
    return crypto.createHash('sha256').update(base).digest('hex').slice(0, 32);
  }

  /**
   * 라이선스 인증 (아이디/비밀번호/코드)
   */
  async authenticate(
    userId: string,
    password: string,
    licenseCode?: string
  ): Promise<LicenseAuthResult> {
    try {
      const deviceId = this.getDeviceId();
      const passwordHash = this.hashPassword(password);

      // 기존 라이선스 확인
      let existingLicense: LicenseData | null = null;
      if (fs.existsSync(this.licensePath)) {
        try {
          existingLicense = JSON.parse(fs.readFileSync(this.licensePath, 'utf8'));
        } catch (e) {
          // 파일이 손상된 경우 무시
        }
      }

      // 기존 라이선스가 있고, 코드 기간이 남아있으면 아이디/비밀번호만으로 인증
      if (existingLicense) {
        // 아이디/비밀번호 일치 확인
        if (
          existingLicense.userId === userId &&
          this.verifyPassword(password, existingLicense.passwordHash) &&
          existingLicense.deviceId === deviceId
        ) {
          // SHA256 → bcrypt 자동 마이그레이션
          if (!existingLicense.passwordHash.startsWith('$2a$') && !existingLicense.passwordHash.startsWith('$2b$')) {
            existingLicense.passwordHash = this.hashPassword(password);
            fs.writeFileSync(this.licensePath, JSON.stringify(existingLicense, null, 2), 'utf8');
          }
          // 기간제인 경우 만료 확인
          if (existingLicense.licenseType === 'temporary') {
            if (existingLicense.expiresAt && existingLicense.expiresAt > Date.now()) {
              return {
                success: true,
                message: '라이선스 인증 성공 (기간제, 기간 남음)',
                licenseData: existingLicense
              };
            } else if (existingLicense.expiresAt && existingLicense.expiresAt <= Date.now()) {
              // 만료된 경우 코드 재등록 필요
              if (licenseCode) {
                return await this.registerLicense(userId, password, licenseCode);
              }
              return {
                success: false,
                message: '라이선스가 만료되었습니다. 코드를 다시 등록해주세요.'
              };
            }
          } else {
            // 영구제인 경우
            // 패치 파일 확인
            if (fs.existsSync(this.patchFilePath)) {
              const patchContent = fs.readFileSync(this.patchFilePath, 'utf8');
              const patchHash = this.hashPatchFile(patchContent);
              
              if (existingLicense.patchFileHash === patchHash) {
                return {
                  success: true,
                  message: '라이선스 인증 성공 (영구제, 패치 파일 확인됨)',
                  licenseData: existingLicense
                };
              }
            }
            
            // 패치 파일이 없거나 해시가 다르면 코드 재등록 필요
            if (licenseCode) {
              return await this.registerLicense(userId, password, licenseCode);
            }
            return {
              success: false,
              message: '패치 파일이 없거나 유효하지 않습니다. 코드를 다시 등록해주세요.'
            };
          }
        }
      }

      // 기존 라이선스가 없거나 인증 실패한 경우, 코드로 등록
      if (licenseCode) {
        return await this.registerLicense(userId, password, licenseCode);
      }

      // 코드 없이 로그인 시도 → 서버에 아이디/비번으로 인증 시도
      try {
        const serverResult = await this.authenticateWithServer(userId, password);
        if (serverResult) {
          return serverResult;
        }
      } catch (e) {
        console.warn('[AUTH] 서버 인증 실패, 로컬 체크로 폴백:', e);
      }

      // 서버 인증도 실패한 경우
      if (existingLicense) {
        return {
          success: false,
          message: '아이디 또는 비밀번호가 일치하지 않습니다.\n새 기기에서는 라이선스 코드를 한 번 더 입력해주세요.'
        };
      } else {
        return {
          success: false,
          message: '등록된 라이선스가 없습니다.\n\n최초 사용 시 아이디 + 비밀번호 + 라이선스 코드를 함께 입력해주세요.\n\n또는 상단의 "무료체험하기" 버튼으로 체험할 수 있습니다.'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: `라이선스 인증 실패: ${error.message || '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 서버에 아이디/비밀번호로 인증 (코드 없이 로그인)
   * 서버에 이미 등록된 사용자가 새 기기에서 로그인하거나,
   * 로컬 라이선스 파일이 없는 경우에 사용.
   */
  private async authenticateWithServer(
    userId: string,
    password: string
  ): Promise<LicenseAuthResult | null> {
    try {
      const { loadEnvFromFile } = await import('../env');
      const env = loadEnvFromFile();
      const redeemUrl = (env as any).licenseRedeemUrl ||
                        (env as any).LICENSE_REDEEM_URL ||
                        process.env['LICENSE_REDEEM_URL'] || '';

      if (!redeemUrl) return null;

      const axios = (await import('axios')).default;
      const deviceId = this.getDeviceId();

      console.log('[AUTH] 서버에 아이디/비번 인증 시도...');
      const response = await axios.post(redeemUrl, {
        action: 'login',
        appId: 'com.ridernam.blogger.automation',
        userId,
        userPassword: password,
        deviceId
      }, { timeout: 10000, headers: { 'Content-Type': 'application/json' } });

      if (response.data && (response.data.ok || response.data.valid)) {
        const data = response.data;
        const licenseType = data.licenseType || data.type || '';
        const isPermanent = licenseType === 'LIFE' || licenseType === 'permanent' || !data.expiresAt;

        // 로컬 라이선스 파일 생성 (다음 로그인부터 오프라인 가능)
        const licenseData: LicenseData = {
          userId,
          passwordHash: this.hashPassword(password),
          licenseType: isPermanent ? 'permanent' : 'temporary',
          serverLicenseType: licenseType,
          activatedAt: Date.now(),
          deviceId,
          ...(data.expiresAt && { expiresAt: new Date(data.expiresAt).getTime() })
        };

        fs.writeFileSync(this.licensePath, JSON.stringify(licenseData, null, 2), 'utf8');
        console.log('[AUTH] ✅ 서버 인증 성공 + 로컬 라이선스 파일 생성');

        // 세션 토큰 저장
        if (data.sessionToken) {
          const sessionManager = getSessionManager();
          sessionManager.setSession(userId, data.sessionToken, deviceId);
        }

        return {
          success: true,
          message: `로그인 성공! (${isPermanent ? '영구제' : '기간제'})`,
          licenseData,
          previousSessionTerminated: data.previousSessionTerminated || false
        };
      }

      return null; // 서버가 거부
    } catch (e: any) {
      console.warn('[AUTH] 서버 인증 오류:', e.message);
      return null;
    }
  }

  /**
   * 라이선스 등록 (코드 기반)
   */
  private async registerLicense(
    userId: string,
    password: string,
    licenseCode: string
  ): Promise<LicenseAuthResult> {
    try {
      const deviceId = this.getDeviceId();
      const passwordHash = this.hashPassword(password);

      // 라이선스 코드 검증 (서버 API를 통해 검증)
      const licenseInfo = await this.parseLicenseCode(licenseCode, userId, password);
      
      if (!licenseInfo) {
        return {
          success: false,
          message: '유효하지 않은 라이선스 코드입니다. 코드 형식을 확인하거나 서버에 문의해주세요.'
        };
      }

      const licenseData: LicenseData = {
        userId,
        passwordHash,
        licenseType: licenseInfo.type,
        serverLicenseType: (licenseInfo as any).licenseType, // 서버에서 받은 원본 타입 저장
        activatedAt: Date.now(),
        deviceId,
        ...(licenseCode && { licenseCode }),
        ...(licenseInfo.expiresAt && { expiresAt: licenseInfo.expiresAt })
      };

      // 영구제인 경우 패치 파일 생성
      if (licenseInfo.type === 'permanent' && licenseCode) {
        const patchContent = this.generatePatchFile(userId, deviceId, licenseCode);
        fs.writeFileSync(this.patchFilePath, patchContent, 'utf8');
        licenseData.patchFileHash = this.hashPatchFile(patchContent);
      }

      // 라이선스 파일 저장
      fs.writeFileSync(this.licensePath, JSON.stringify(licenseData, null, 2), 'utf8');

      return {
        success: true,
        message: licenseInfo.type === 'permanent' 
          ? '라이선스 등록 성공 (영구제) - 패치 파일이 생성되었습니다. 이후 아이디/비밀번호만으로 사용 가능합니다.'
          : `라이선스 등록 성공 (기간제) - ${new Date(licenseInfo.expiresAt!).toLocaleDateString()}까지 사용 가능합니다.`,
        licenseData
      };
    } catch (error: any) {
      return {
        success: false,
        message: `라이선스 등록 실패: ${error.message || '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 라이선스 코드 검증 (서버 API를 통해 검증 또는 오프라인 검증)
   * 서버가 코드 형식과 유효성을 모두 검증합니다.
   * 서버 연결 실패 시 오프라인 모드로 작동합니다.
   */
  private async parseLicenseCode(
    code: string,
    userId: string,
    password: string
  ): Promise<{ type: 'temporary' | 'permanent'; expiresAt?: number } | null> {
    try {
      // 환경 변수에서 서버 URL 가져오기
      const { loadEnvFromFile } = await import('../env');
      const env = loadEnvFromFile();
      const redeemUrl = (env as any).licenseRedeemUrl || 
                       (env as any).LICENSE_REDEEM_URL || 
                       process.env['LICENSE_REDEEM_URL'] || 
                       '';
      
      // 서버 URL이 설정되어 있으면 서버 검증 시도
      if (redeemUrl) {
        try {
          // 서버 API를 통해 코드 검증 (관리 패널 API 형식 사용)
          const axios = (await import('axios')).default;
          const deviceId = this.getDeviceId();
          const response = await axios.post(
            redeemUrl,
            {
              action: 'register',
              appId: 'com.ridernam.blogger.automation',
              licenseCode: code,
              userId,
              userPassword: password,
              deviceId // 중복 로그인 방지를 위한 디바이스 ID
            },
            {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          // 관리 패널 API 응답 형식: { ok: true, valid: true, expiresAt, licenseType, sessionToken }
          if (response.data && (response.data.ok || response.data.valid)) {
            const data = response.data;
            // licenseType을 기반으로 temporary/permanent 결정
            // LIFE = permanent, 나머지 = temporary
            const licenseType = data.licenseType || data.type || '';
            const isPermanent = licenseType === 'LIFE' || licenseType === 'permanent' || !data.expiresAt;
            
            const result: { 
              type: 'temporary' | 'permanent'; 
              expiresAt?: number; 
              licenseType?: string;
              sessionToken?: string;
              previousSessionTerminated?: boolean;
            } = {
              type: isPermanent ? 'permanent' : 'temporary',
              licenseType: licenseType
            };
            if (data.expiresAt) {
              result.expiresAt = new Date(data.expiresAt).getTime();
            }
            // 세션 토큰 저장 (중복 로그인 방지)
            if (data.sessionToken) {
              result.sessionToken = data.sessionToken;
              result.previousSessionTerminated = data.previousSessionTerminated || false;
              
              // 세션 매니저에 세션 저장
              const sessionManager = getSessionManager();
              sessionManager.setSession(userId, data.sessionToken, deviceId);
              
              if (data.previousSessionTerminated) {
                console.log('[LICENSE] ⚠️ 다른 기기의 세션이 종료되었습니다.');
              }
            }
            console.log('[LICENSE] ✅ 서버 검증 성공 - licenseType:', licenseType, 'type:', result.type);
            return result;
          }
          
          console.log('[LICENSE] ⚠️ 서버가 유효하지 않다고 응답 - 오프라인 검증 시도');
          console.log('[LICENSE] 서버 응답:', response.data);
          // 서버가 invalid 응답해도 오프라인 검증으로 폴백
        } catch (serverError: any) {
          console.warn('[LICENSE] ⚠️ 서버 연결 실패, 오프라인 모드로 전환:', serverError.message);
          // 서버 연결 실패 시 오프라인 검증으로 폴백
        }
      }
      
      // 오프라인 모드: 로컬 검증
      console.log('[LICENSE] 오프라인 모드: 로컬 코드 검증 시작');
      return this.parseOfflineLicenseCode(code, userId);
      
    } catch (error: any) {
      console.error('[LICENSE] 코드 검증 중 오류:', error.message);
      return null;
    }
  }
  
  /**
   * 오프라인 라이선스 코드 검증
   * 서버 연결 없이 로컬에서 코드 형식을 검증합니다.
   */
  private parseOfflineLicenseCode(
    code: string,
    userId: string
  ): { type: 'temporary' | 'permanent'; expiresAt?: number } | null {
    try {
      // 코드 형식 검증
      if (!code || code.trim().length < 4) {
        console.log('[LICENSE] ❌ 코드가 너무 짧음');
        return null;
      }
      
      const upperCode = code.toUpperCase().trim();
      console.log('[LICENSE] 코드 검증 시작:', upperCode);
      
      // 1. 영구제 코드 패턴 (PERM-로 시작)
      if (upperCode.startsWith('PERM-') || upperCode.startsWith('PERMANENT-')) {
        console.log('[LICENSE] ✅ 영구제 코드 감지 (PERM 접두사)');
        return { type: 'permanent' };
      }
      
      // 2. 기간제 코드 패턴 (TEMP-로 시작)
      if (upperCode.startsWith('TEMP-') || upperCode.startsWith('TRIAL-')) {
        console.log('[LICENSE] ✅ 기간제 코드 감지 (TEMP 접두사)');
        
        // 날짜 파싱 시도 (마지막 8자리가 YYYYMMDD 형식인 경우)
        const match = upperCode.match(/(\d{8})$/);
        if (match && match[1]) {
          const dateStr = match[1];
          const year = parseInt(dateStr.substring(0, 4), 10);
          const month = parseInt(dateStr.substring(4, 6), 10) - 1;
          const day = parseInt(dateStr.substring(6, 8), 10);
          
          const expiresAt = new Date(year, month, day).getTime();
          console.log('[LICENSE] 만료일:', new Date(expiresAt).toLocaleDateString());
          
          return {
            type: 'temporary',
            expiresAt
          };
        }
        
        // 날짜가 없으면 30일 기본 제공
        const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
        console.log('[LICENSE] 만료일 (기본 30일):', new Date(expiresAt).toLocaleDateString());
        return {
          type: 'temporary',
          expiresAt
        };
      }
      
      // 3. 일반 라이선스 코드 패턴 (XXXX-XXXX-XXXX-XXXX 형식)
      // 하이픈으로 구분된 4개 이상의 섹션
      const sections = upperCode.split('-');
      if (sections.length >= 3) {
        // 최소 3개 섹션 (예: NM69-17MM-36J0-9QT7)
        const hasValidFormat = sections.every(section => 
          section.length >= 2 && /^[A-Z0-9]+$/.test(section)
        );
        
        if (hasValidFormat) {
          console.log('[LICENSE] ✅ 표준 라이선스 코드 형식 감지 - 영구제로 처리');
          return { type: 'permanent' };
        }
      }
      
      // 4. 개발자/테스트 코드
      if (upperCode.includes('DEV') || upperCode.includes('TEST')) {
        console.log('[LICENSE] ✅ 개발자/테스트 코드 감지 - 영구제로 처리');
        return { type: 'permanent' };
      }
      
      // 5. 긴 코드 (15자 이상) - 서버 검증 실패 시에만 도달하므로 거부
      if (upperCode.length >= 15) {
        console.log('[LICENSE] ⚠️ 긴 코드 (15자 이상)이지만 서버 검증 실패 - 오프라인에서는 미지원');
        return null;
      }
      
      console.log('[LICENSE] ❌ 알 수 없는 코드 형식:', upperCode);
      return null;
      
    } catch (error: any) {
      console.error('[LICENSE] 오프라인 검증 오류:', error);
      return null;
    }
  }

  /**
   * 패치 파일 생성 (영구제용)
   */
  private generatePatchFile(userId: string, deviceId: string, licenseCode: string): string {
    const patchData = {
      userId,
      deviceId,
      licenseCode,
      generatedAt: Date.now()
    };

    // AES-256-GCM 실제 암호화
    const content = JSON.stringify(patchData);
    const key = crypto.scryptSync(deviceId + userId, 'lba-patch-salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * 패치 파일 복호화
   */
  private decryptPatchFile(patchContent: string, userId: string, deviceId: string): any | null {
    try {
      const [ivHex, authTagHex, encrypted] = patchContent.split(':');
      if (!ivHex || !authTagHex || !encrypted) return null;

      const key = crypto.scryptSync(deviceId + userId, 'lba-patch-salt', 32);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  /**
   * 라이선스 상태 확인
   */
  getLicenseStatus(): { valid: boolean; message: string; licenseData?: LicenseData } {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return {
          valid: false,
          message: '라이선스가 등록되지 않았습니다.'
        };
      }

      const licenseData: LicenseData = JSON.parse(fs.readFileSync(this.licensePath, 'utf8'));
      const deviceId = this.getDeviceId();

      if (licenseData.deviceId !== deviceId) {
        return {
          valid: false,
          message: '디바이스가 변경되었습니다. 다시 인증해주세요.'
        };
      }

      if (licenseData.licenseType === 'temporary') {
        if (licenseData.expiresAt && licenseData.expiresAt > Date.now()) {
          const daysLeft = Math.ceil((licenseData.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
          return {
            valid: true,
            message: `기간제 라이선스 (${daysLeft}일 남음)`,
            licenseData
          };
        } else {
          return {
            valid: false,
            message: '라이선스가 만료되었습니다. 코드를 다시 등록해주세요.'
          };
        }
      } else {
        // 영구제
        if (fs.existsSync(this.patchFilePath)) {
          const patchContent = fs.readFileSync(this.patchFilePath, 'utf8');
          const patchHash = this.hashPatchFile(patchContent);
          
          if (licenseData.patchFileHash === patchHash) {
            return {
              valid: true,
              message: '영구제 라이선스 (인증됨)',
              licenseData
            };
          }
        }
        
        return {
          valid: false,
          message: '패치 파일이 없거나 유효하지 않습니다.'
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        message: `라이선스 확인 실패: ${error.message || '알 수 없는 오류'}`
      };
    }
  }

  /**
   * 서버와 라이선스 정보 동기화 (관리 패널에서 변경된 정보 반영)
   */
  async syncWithServer(): Promise<{ success: boolean; message: string; updated?: boolean }> {
    try {
      if (!fs.existsSync(this.licensePath)) {
        return { success: false, message: '라이선스가 등록되지 않았습니다.' };
      }

      const licenseData: LicenseData = JSON.parse(fs.readFileSync(this.licensePath, 'utf8'));
      
      if (!licenseData.licenseCode) {
        return { success: false, message: '라이선스 코드가 없습니다.' };
      }

      // 환경 변수에서 서버 URL 가져오기
      const { loadEnvFromFile } = await import('../env');
      const env = loadEnvFromFile();
      const serverUrl = (env as any).licenseRedeemUrl || 
                       (env as any).LICENSE_REDEEM_URL || 
                       process.env['LICENSE_REDEEM_URL'] || 
                       '';
      
      if (!serverUrl) {
        return { success: false, message: '서버 URL이 설정되지 않았습니다.' };
      }

      const axios = (await import('axios')).default;
      const response = await axios.post(
        serverUrl,
        {
          action: 'verify',
          appId: 'com.ridernam.blogger.automation',
          code: licenseData.licenseCode,
          deviceId: this.getDeviceId()
        },
        { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data && (response.data.ok || response.data.valid)) {
        const data = response.data;
        let updated = false;
        
        // 만료일 업데이트
        if (data.expiresAt) {
          const newExpiresAt = new Date(data.expiresAt).getTime();
          if (licenseData.expiresAt !== newExpiresAt) {
            licenseData.expiresAt = newExpiresAt;
            updated = true;
          }
        } else if (licenseData.expiresAt) {
          // 서버에서 만료일이 없으면 무제한으로 변경
          delete licenseData.expiresAt;
          updated = true;
        }
        
        // 라이선스 유형 업데이트
        const serverType = data.licenseType || '';
        if (serverType && serverType !== licenseData.serverLicenseType) {
          licenseData.serverLicenseType = serverType;
          // LIFE면 permanent, 아니면 temporary
          const newType = serverType === 'LIFE' || !data.expiresAt ? 'permanent' : 'temporary';
          if (licenseData.licenseType !== newType) {
            licenseData.licenseType = newType;
          }
          updated = true;
        }
        
        if (updated) {
          fs.writeFileSync(this.licensePath, JSON.stringify(licenseData, null, 2), 'utf8');
          console.log('[LICENSE] ✅ 서버 동기화 완료 - 라이선스 정보 업데이트됨');
        }
        
        return { 
          success: true, 
          message: updated ? '라이선스 정보가 업데이트되었습니다.' : '라이선스가 최신 상태입니다.',
          updated 
        };
      }
      
      return { success: false, message: '서버 검증 실패' };
    } catch (error: any) {
      console.warn('[LICENSE] 서버 동기화 실패:', error.message);
      return { success: false, message: `서버 동기화 실패: ${error.message}` };
    }
  }

  /**
   * 라이선스 로그아웃 (파일 삭제)
   */
  async logout(): Promise<void> {
    try {
      // 서버에 로그아웃 요청 (세션 종료)
      const sessionManager = getSessionManager();
      await sessionManager.logout();
      
      if (fs.existsSync(this.licensePath)) {
        fs.unlinkSync(this.licensePath);
        console.log('[LICENSE] 라이선스 파일 삭제됨');
      }
      // 패치 파일은 삭제하지 않음 (영구제 사용자를 위해)
    } catch (error: any) {
      console.error('[LICENSE] 로그아웃 실패:', error);
      throw error;
    }
  }

  /**
   * 세션 유효성 검증 (중복 로그인 감지)
   */
  async validateSession(): Promise<SessionValidationResult> {
    const sessionManager = getSessionManager();
    return sessionManager.validateSession();
  }

  /**
   * 주기적 세션 검증 시작
   */
  startSessionValidation(onSessionExpired: (reason: string) => void): void {
    const sessionManager = getSessionManager();
    sessionManager.onSessionExpired(onSessionExpired);
    sessionManager.startPeriodicValidation();
  }

  /**
   * 주기적 세션 검증 중지
   */
  stopSessionValidation(): void {
    const sessionManager = getSessionManager();
    sessionManager.stopPeriodicValidation();
  }
}

// 싱글톤 인스턴스
let licenseManagerInstance: LicenseManager | null = null;

export function getLicenseManager(): LicenseManager {
  if (!licenseManagerInstance) {
    licenseManagerInstance = new LicenseManager();
  }
  return licenseManagerInstance;
}
