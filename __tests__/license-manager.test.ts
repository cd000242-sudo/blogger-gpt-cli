/**
 * LicenseManager 유닛 테스트
 * electron의 app 모듈을 모킹하여 테스트
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// electron app 모킹
const mockUserDataPath = path.join(os.tmpdir(), 'license-test-' + Date.now());
jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserDataPath;
      return os.tmpdir();
    }
  }
}));

import { LicenseManager } from '../src/utils/license-manager';

describe('LicenseManager', () => {
  let manager: LicenseManager;

  beforeAll(() => {
    if (!fs.existsSync(mockUserDataPath)) {
      fs.mkdirSync(mockUserDataPath, { recursive: true });
    }
  });

  beforeEach(() => {
    // 이전 테스트의 파일 정리
    const licensePath = path.join(mockUserDataPath, 'license.json');
    const patchPath = path.join(mockUserDataPath, 'license.patch');
    if (fs.existsSync(licensePath)) fs.unlinkSync(licensePath);
    if (fs.existsSync(patchPath)) fs.unlinkSync(patchPath);

    manager = new LicenseManager();
  });

  afterAll(() => {
    // 테스트 디렉토리 정리
    try {
      fs.rmSync(mockUserDataPath, { recursive: true, force: true });
    } catch {}
  });

  // ─── 비밀번호 해싱 ─────────────────────────────────

  describe('비밀번호 해싱 (bcrypt)', () => {
    it('hashPassword가 bcrypt 형식 반환', () => {
      const hash = (manager as any).hashPassword('testPassword123');
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('같은 비밀번호도 매번 다른 해시 생성 (salt)', () => {
      const hash1 = (manager as any).hashPassword('same');
      const hash2 = (manager as any).hashPassword('same');
      expect(hash1).not.toBe(hash2);
    });

    it('verifyPassword — bcrypt 해시 검증', () => {
      const hash = bcrypt.hashSync('myPassword', 12);
      expect((manager as any).verifyPassword('myPassword', hash)).toBe(true);
      expect((manager as any).verifyPassword('wrong', hash)).toBe(false);
    });

    it('verifyPassword — 기존 SHA256 해시 하위호환', () => {
      const sha256Hash = crypto.createHash('sha256').update('oldPassword').digest('hex');
      expect((manager as any).verifyPassword('oldPassword', sha256Hash)).toBe(true);
      expect((manager as any).verifyPassword('wrong', sha256Hash)).toBe(false);
    });
  });

  // ─── 디바이스 ID ───────────────────────────────────

  describe('디바이스 ID', () => {
    it('32자 hex 문자열 반환', () => {
      const deviceId = (manager as any).getDeviceId();
      expect(deviceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('동일 머신에서 일관된 값', () => {
      const id1 = (manager as any).getDeviceId();
      const id2 = (manager as any).getDeviceId();
      expect(id1).toBe(id2);
    });
  });

  // ─── 패치 파일 해시 ────────────────────────────────

  describe('패치 파일 해시', () => {
    it('SHA256 hex 반환', () => {
      const hash = (manager as any).hashPatchFile('test content');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('동일 입력 → 동일 해시', () => {
      const h1 = (manager as any).hashPatchFile('same');
      const h2 = (manager as any).hashPatchFile('same');
      expect(h1).toBe(h2);
    });

    it('다른 입력 → 다른 해시', () => {
      const h1 = (manager as any).hashPatchFile('a');
      const h2 = (manager as any).hashPatchFile('b');
      expect(h1).not.toBe(h2);
    });
  });

  // ─── 라이선스 상태 ─────────────────────────────────

  describe('getLicenseStatus', () => {
    it('파일이 없으면 invalid', () => {
      const status = manager.getLicenseStatus();
      expect(status.valid).toBe(false);
      expect(status.message).toContain('등록되지 않았습니다');
    });

    it('기간제 만료 감지', () => {
      const licensePath = path.join(mockUserDataPath, 'license.json');
      const expiredLicense = {
        userId: 'test',
        passwordHash: bcrypt.hashSync('pass', 12),
        licenseType: 'temporary',
        expiresAt: Date.now() - 1000, // 1초 전 만료
        activatedAt: Date.now() - 86400000,
        deviceId: (manager as any).getDeviceId(),
      };
      fs.writeFileSync(licensePath, JSON.stringify(expiredLicense), 'utf8');

      const status = manager.getLicenseStatus();
      expect(status.valid).toBe(false);
      expect(status.message).toContain('만료');
    });

    it('기간제 유효 인식', () => {
      const licensePath = path.join(mockUserDataPath, 'license.json');
      const validLicense = {
        userId: 'test',
        passwordHash: bcrypt.hashSync('pass', 12),
        licenseType: 'temporary',
        expiresAt: Date.now() + 86400000, // 내일 만료
        activatedAt: Date.now(),
        deviceId: (manager as any).getDeviceId(),
      };
      fs.writeFileSync(licensePath, JSON.stringify(validLicense), 'utf8');

      const status = manager.getLicenseStatus();
      expect(status.valid).toBe(true);
    });

    it('다른 디바이스 ID면 invalid', () => {
      const licensePath = path.join(mockUserDataPath, 'license.json');
      const otherDeviceLicense = {
        userId: 'test',
        passwordHash: bcrypt.hashSync('pass', 12),
        licenseType: 'temporary',
        expiresAt: Date.now() + 86400000,
        activatedAt: Date.now(),
        deviceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0', // 다른 디바이스
      };
      fs.writeFileSync(licensePath, JSON.stringify(otherDeviceLicense), 'utf8');

      const status = manager.getLicenseStatus();
      expect(status.valid).toBe(false);
    });
  });
});
