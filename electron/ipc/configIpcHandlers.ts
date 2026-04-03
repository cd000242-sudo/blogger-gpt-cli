/**
 * 사용자 설정 + 설정 보호 + 외부 링크 IPC 핸들러
 * electron/main.ts에서 분리
 */
import { ipcMain, app, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

function getUserConfigPath(): string {
  return path.join(app.getPath('userData'), 'user-config.json');
}

function readUserConfig(): any {
  const p = getUserConfigPath();
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function registerConfigIpcHandlers(): void {
  // 설정 보호
  ipcMain.handle('set-settings-protection', async (_evt, protectedMode) => {
    try {
      const config = readUserConfig();
      config.settingsProtected = protectedMode;
      fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '설정 실패' };
    }
  });

  ipcMain.handle('is-settings-protected', async () => {
    try {
      const config = readUserConfig();
      return { ok: true, protected: !!config.settingsProtected };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '확인 실패', protected: false };
    }
  });

  // 사용자 설정
  ipcMain.handle('save-user-config', async (_evt, config) => {
    try {
      fs.writeFileSync(getUserConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '저장 실패' };
    }
  });

  ipcMain.handle('get-user-config', async () => {
    try {
      return { ok: true, config: readUserConfig() };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '읽기 실패', config: {} };
    }
  });

  // 외부 링크
  ipcMain.handle('open-link', async (_evt, href) => {
    try {
      await shell.openExternal(href);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
    }
  });

  ipcMain.handle('open-external', async (_evt, url) => {
    try {
      await shell.openExternal(url);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : '열기 실패' };
    }
  });
}
