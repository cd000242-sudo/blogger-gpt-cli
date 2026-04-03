// electron/adspowerIpcHandlers.ts
// 🛡️ AdsPower IPC 핸들러 — 싱글톤 패턴 + API Key sanitize
import { ipcMain, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// ── 싱글톤 캐시 ──
let cachedManager: any = null;
let cachedConfig: { port: number; apiKey: string } | null = null;

/**
 * .env에서 AdsPower 설정 읽기 (포트 + API Key)
 */
function getAdsPowerConfig(): { port: number; apiKey: string } {
  try {
    const envPath = path.join(app.getPath('userData'), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const portMatch = content.match(/ADSPOWER_PORT=(\d+)/);
      const keyMatch = content.match(/ADSPOWER_API_KEY=([^\r\n]+)/);
      return {
        port: portMatch?.[1] ? parseInt(portMatch[1], 10) : 50325,
        apiKey: keyMatch?.[1]?.trim() || '',
      };
    }
  } catch {}
  return { port: 50325, apiKey: '' };
}

/**
 * 싱글톤 AdsPowerManager 인스턴스 반환
 * - 설정 변경 시 자동 재생성
 * - require()는 최초 1회만 실행
 */
function getOrCreateManager(): any {
  const config = getAdsPowerConfig();

  // 설정이 변경되지 않았으면 캐시된 인스턴스 재사용
  if (cachedManager && cachedConfig &&
      cachedConfig.port === config.port &&
      cachedConfig.apiKey === config.apiKey) {
    return cachedManager;
  }

  // 새로 생성
  try {
    const distPath = path.join(__dirname, '..', 'dist', 'core', 'adspower-manager');
    const srcPath = path.join(__dirname, '..', 'src', 'core', 'adspower-manager');

    let ManagerClass: any = null;

    if (fs.existsSync(distPath + '.js')) {
      ManagerClass = require(distPath).AdsPowerManager;
    } else if (fs.existsSync(srcPath + '.js') || fs.existsSync(srcPath + '.ts')) {
      ManagerClass = require(srcPath).AdsPowerManager;
    }

    if (!ManagerClass) {
      throw new Error('AdsPowerManager 모듈을 찾을 수 없습니다');
    }

    cachedManager = new ManagerClass({ port: config.port, apiKey: config.apiKey });
    cachedConfig = config;

    console.log(`[ADSPOWER-IPC] ✅ 싱글톤 매니저 생성 (port: ${config.port})`);
    return cachedManager;
  } catch (error) {
    console.error('[ADSPOWER-IPC] 모듈 로드 실패:', error);
    return null;
  }
}

/**
 * 에러 메시지에서 API Key 제거 (보안)
 */
function sanitizeError(error: unknown, apiKey: string): string {
  let msg = error instanceof Error ? error.message : String(error);
  if (apiKey && apiKey.length > 0) {
    msg = msg.replace(new RegExp(apiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '***');
  }
  return msg;
}

// ── IPC 핸들러 등록 ──
export function registerAdsPowerIpcHandlers(): void {
  console.log('[ADSPOWER-IPC] 🛡️ AdsPower IPC 핸들러 등록 시작...');

  const apiKey = getAdsPowerConfig().apiKey;

  // 1. 연결 상태 확인
  ipcMain.handle('adspower:check-status', async () => {
    try {
      const manager = getOrCreateManager();
      if (!manager) {
        return { ok: false, running: false, error: 'AdsPowerManager 모듈 로드 실패' };
      }

      const status = await manager.checkStatus();
      console.log(`[ADSPOWER-IPC] 상태: ${status.running ? '✅ 실행 중' : '❌ 미실행'}`);
      return { ok: true, ...status };
    } catch (error) {
      console.error('[ADSPOWER-IPC] 상태 확인 실패:', sanitizeError(error, apiKey));
      return { ok: false, running: false, error: sanitizeError(error, apiKey) };
    }
  });

  // 2. 프로필 목록 조회
  ipcMain.handle('adspower:list-profiles', async () => {
    try {
      const manager = getOrCreateManager();
      if (!manager) {
        return { ok: false, profiles: [], error: 'AdsPowerManager 모듈 로드 실패' };
      }

      const result = await manager.listProfiles();
      console.log(`[ADSPOWER-IPC] ✅ 프로필 ${result.profiles.length}개 조회 (전체: ${result.total})`);
      return { ok: true, profiles: result.profiles, total: result.total };
    } catch (error) {
      console.error('[ADSPOWER-IPC] ❌ 프로필 목록 조회 실패:', sanitizeError(error, apiKey));
      return { ok: false, profiles: [], error: sanitizeError(error, apiKey) };
    }
  });

  // 3. 프로필 브라우저 시작
  ipcMain.handle('adspower:start-profile', async (_evt, profileId: string) => {
    try {
      if (!profileId) {
        return { ok: false, error: '프로필 ID가 필요합니다' };
      }

      const manager = getOrCreateManager();
      if (!manager) {
        return { ok: false, error: 'AdsPowerManager 모듈 로드 실패' };
      }

      const result = await manager.startProfile(profileId);
      console.log(`[ADSPOWER-IPC] ✅ 프로필 시작 완료: ${profileId}`);
      return { ok: true, wsUrl: result.wsUrl };
    } catch (error) {
      console.error('[ADSPOWER-IPC] ❌ 프로필 시작 실패:', sanitizeError(error, apiKey));
      return { ok: false, error: sanitizeError(error, apiKey) };
    }
  });

  // 4. 프로필 브라우저 중지
  ipcMain.handle('adspower:stop-profile', async (_evt, profileId: string) => {
    try {
      if (!profileId) {
        return { ok: false, error: '프로필 ID가 필요합니다' };
      }

      const manager = getOrCreateManager();
      if (!manager) {
        return { ok: false, error: 'AdsPowerManager 모듈 로드 실패' };
      }

      await manager.stopProfile(profileId);
      console.log(`[ADSPOWER-IPC] ✅ 프로필 중지 완료: ${profileId}`);
      return { ok: true };
    } catch (error) {
      console.error('[ADSPOWER-IPC] ❌ 프로필 중지 실패:', sanitizeError(error, apiKey));
      return { ok: false, error: sanitizeError(error, apiKey) };
    }
  });

  console.log('[ADSPOWER-IPC] ✅ AdsPower IPC 핸들러 4개 등록 완료 (싱글톤 패턴)');
}
