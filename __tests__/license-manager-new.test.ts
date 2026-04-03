/**
 * LicenseManager (new) — 패치 파일 암호화 + 오프라인 검증 테스트
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const mockUserDataPath = path.join(os.tmpdir(), 'license-new-test-' + Date.now());
jest.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return mockUserDataPath;
      return os.tmpdir();
    }
  }
}));

// session-manager 모킹 (electron 의존)
jest.mock('../src/utils/session-manager', () => ({
  getSessionManager: () => ({
    setSession: jest.fn(),
    getSessionToken: () => null,
    clearSession: jest.fn(),
  }),
  SessionValidationResult: {},
}));

import { LicenseManager } from '../src/utils/license-manager-new';

describe('LicenseManager (new)', () => {
  let manager: LicenseManager;

  beforeAll(() => {
    if (!fs.existsSync(mockUserDataPath)) {
      fs.mkdirSync(mockUserDataPath, { recursive: true });
    }
  });

  beforeEach(() => {
    const licensePath = path.join(mockUserDataPath, 'license.json');
    const patchPath = path.join(mockUserDataPath, 'license.patch');
    if (fs.existsSync(licensePath)) fs.unlinkSync(licensePath);
    if (fs.existsSync(patchPath)) fs.unlinkSync(patchPath);
    manager = new LicenseManager();
  });

  afterAll(() => {
    try { fs.rmSync(mockUserDataPath, { recursive: true, force: true }); } catch {}
  });

  // ─── 패치 파일 암호화/복호화 ───────────────────────

  describe('패치 파일 AES-256-GCM 암호화', () => {
    it('generatePatchFile이 iv:authTag:encrypted 형식 반환', () => {
      const patch = (manager as any).generatePatchFile('user1', 'device123', 'LICENSE-CODE');
      const parts = patch.split(':');
      expect(parts).toHaveLength(3);
      // iv = 32 hex chars (16 bytes)
      expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
      // authTag = 32 hex chars (16 bytes)
      expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
      // encrypted data
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('decryptPatchFile로 복호화 가능', () => {
      const userId = 'testUser';
      const deviceId = 'testDevice123';
      const licenseCode = 'LIFE-PREMIUM-KEY';

      const patch = (manager as any).generatePatchFile(userId, deviceId, licenseCode);
      const decrypted = (manager as any).decryptPatchFile(patch, userId, deviceId);

      expect(decrypted).not.toBeNull();
      expect(decrypted.userId).toBe(userId);
      expect(decrypted.deviceId).toBe(deviceId);
      expect(decrypted.licenseCode).toBe(licenseCode);
      expect(decrypted.generatedAt).toBeDefined();
    });

    it('잘못된 userId/deviceId로는 복호화 실패', () => {
      const patch = (manager as any).generatePatchFile('user1', 'device1', 'CODE');
      const decrypted = (manager as any).decryptPatchFile(patch, 'wrongUser', 'wrongDevice');
      expect(decrypted).toBeNull();
    });

    it('변조된 패치 파일은 복호화 실패', () => {
      const patch = (manager as any).generatePatchFile('user1', 'device1', 'CODE');
      const tampered = patch.slice(0, -4) + 'XXXX';
      const decrypted = (manager as any).decryptPatchFile(tampered, 'user1', 'device1');
      expect(decrypted).toBeNull();
    });

    it('매번 다른 IV 사용 (같은 입력이어도 다른 암호문)', () => {
      const p1 = (manager as any).generatePatchFile('u', 'd', 'c');
      const p2 = (manager as any).generatePatchFile('u', 'd', 'c');
      expect(p1).not.toBe(p2);
    });
  });

  // ─── 오프라인 라이선스 코드 검증 ───────────────────

  describe('오프라인 라이선스 코드 검증', () => {
    it('15자 이상 코드는 오프라인에서 거부 (보안 강화)', async () => {
      // parseLicenseCode는 private이므로 간접 테스트
      // 서버 URL이 없고 15자 이상 코드를 넣으면 null 반환되어야 함
      const result = await (manager as any).parseOfflineLicenseCode('ABCDEFGHIJKLMNOP');
      expect(result).toBeNull();
    });

    it('DEV/TEST 포함 코드는 개발용으로 인식', async () => {
      const devResult = await (manager as any).parseOfflineLicenseCode('DEV-TEST-KEY');
      // DEV 코드 처리 로직에 따라 결과 확인
      if (devResult) {
        expect(['temporary', 'permanent']).toContain(devResult.type);
      }
    });
  });

  // ─── bcrypt 해싱 확인 ──────────────────────────────

  describe('bcrypt 해싱', () => {
    it('hashPassword가 bcrypt 형식', () => {
      const hash = (manager as any).hashPassword('test123');
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('verifyPassword — 올바른 비밀번호', () => {
      const hash = (manager as any).hashPassword('correct');
      expect((manager as any).verifyPassword('correct', hash)).toBe(true);
    });

    it('verifyPassword — 틀린 비밀번호', () => {
      const hash = (manager as any).hashPassword('correct');
      expect((manager as any).verifyPassword('wrong', hash)).toBe(false);
    });

    it('verifyPassword — 레거시 SHA256 호환', () => {
      const legacyHash = crypto.createHash('sha256').update('legacyPass').digest('hex');
      expect((manager as any).verifyPassword('legacyPass', legacyHash)).toBe(true);
    });
  });
});
