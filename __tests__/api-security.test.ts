/**
 * API 보안 테스트
 * blog-index-api와 keyword-explorer-server의 보안 설정 검증
 */

import * as fs from 'fs';
import * as path from 'path';

describe('API 보안 설정 검증', () => {
  // ─── blog-index-api.ts 보안 ────────────────────────

  describe('blog-index-api.ts', () => {
    let sourceCode: string;

    beforeAll(() => {
      sourceCode = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'api', 'blog-index-api.ts'),
        'utf8'
      );
    });

    it('helmet 미들웨어 적용됨', () => {
      expect(sourceCode).toContain("import helmet from 'helmet'");
      expect(sourceCode).toContain('app.use(helmet())');
    });

    it('express-rate-limit 적용됨', () => {
      expect(sourceCode).toContain("import rateLimit from 'express-rate-limit'");
      expect(sourceCode).toContain('rateLimit(');
    });

    it('하드코딩된 admin key 폴백 없음', () => {
      expect(sourceCode).not.toContain("'change-me-in-production'");
    });

    it('ADMIN_KEY 환경변수 미설정 시 500 에러', () => {
      expect(sourceCode).toContain("process.env['ADMIN_KEY']");
      expect(sourceCode).toContain('ADMIN_KEY 환경변수가 설정되지 않았습니다');
    });

    it('query parameter로 API 키 전달 불가', () => {
      expect(sourceCode).not.toContain("req.query['apiKey']");
      expect(sourceCode).not.toContain("req.query['adminKey']");
    });

    it('API 키는 헤더로만 전달', () => {
      expect(sourceCode).toContain("req.headers['x-api-key']");
      expect(sourceCode).toContain("req.headers['x-admin-key']");
    });

    it('admin 엔드포인트 body에서 adminKey 제거됨', () => {
      expect(sourceCode).not.toContain('req.body.adminKey');
    });
  });

  // ─── keyword-explorer-server.ts 보안 ───────────────

  describe('keyword-explorer-server.ts', () => {
    let sourceCode: string;

    beforeAll(() => {
      sourceCode = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'api', 'keyword-explorer-server.ts'),
        'utf8'
      );
    });

    it('레이트 리밋 적용됨', () => {
      expect(sourceCode).toContain("import rateLimit from 'express-rate-limit'");
      expect(sourceCode).toContain('rateLimit(');
    });

    it('CORS가 와일드카드(*) 아님', () => {
      // Access-Control-Allow-Origin: * 가 직접 설정되지 않아야 함
      expect(sourceCode).not.toMatch(/res\.header\('Access-Control-Allow-Origin',\s*'\*'\)/);
    });

    it('localhost만 허용하는 CORS 로직', () => {
      expect(sourceCode).toContain('localhost');
      expect(sourceCode).toContain('127.0.0.1');
    });
  });

  // ─── license-manager 보안 ──────────────────────────

  describe('license-manager.ts 보안', () => {
    let sourceCode: string;

    beforeAll(() => {
      sourceCode = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'utils', 'license-manager.ts'),
        'utf8'
      );
    });

    it('bcryptjs import 존재', () => {
      expect(sourceCode).toContain("import bcrypt from 'bcryptjs'");
    });

    it('hashPassword가 bcrypt 사용', () => {
      expect(sourceCode).toContain('bcrypt.hashSync(password, 12)');
    });

    it('verifyPassword 메서드 존재', () => {
      expect(sourceCode).toContain('verifyPassword(password: string, hash: string)');
    });

    it('bcrypt compareSync 사용', () => {
      expect(sourceCode).toContain('bcrypt.compareSync(password, hash)');
    });

    it('SHA256 하위호환 마이그레이션 로직', () => {
      expect(sourceCode).toContain('SHA256 해시 호환');
      expect(sourceCode).toContain("hash.startsWith('$2a$')");
    });

    it('디바이스 ID에 MAC 주소 포함', () => {
      expect(sourceCode).toContain('networkInterfaces');
      expect(sourceCode).toContain('info.mac');
    });

    it('디바이스 ID에 CPU 모델 포함', () => {
      expect(sourceCode).toContain('os.cpus()');
    });
  });

  // ─── license-manager-new.ts 보안 ──────────────────

  describe('license-manager-new.ts 보안', () => {
    let sourceCode: string;

    beforeAll(() => {
      sourceCode = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'utils', 'license-manager-new.ts'),
        'utf8'
      );
    });

    it('패치 파일이 AES-256-GCM 암호화 사용', () => {
      expect(sourceCode).toContain('aes-256-gcm');
      expect(sourceCode).toContain('createCipheriv');
      expect(sourceCode).toContain('getAuthTag');
    });

    it('패치 파일 복호화 메서드 존재', () => {
      expect(sourceCode).toContain('decryptPatchFile');
      expect(sourceCode).toContain('createDecipheriv');
      expect(sourceCode).toContain('setAuthTag');
    });

    it('15자 이상 코드 오프라인 자동 승인 제거됨', () => {
      // 15자 이상 코드가 자동으로 영구제 처리되지 않아야 함
      expect(sourceCode).toContain('오프라인에서는 미지원');
      expect(sourceCode).not.toMatch(/긴 코드.*영구제로 처리/);
    });

    it('scryptSync으로 키 파생', () => {
      expect(sourceCode).toContain('crypto.scryptSync');
    });
  });
});
