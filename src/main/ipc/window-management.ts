// @ts-nocheck
// 키워드 마스터 창 관리
import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function setupWindowManagementHandlers() {
  ipcMain.handle('open-keyword-master-window', async () => {
    try {
      const preloadPathList = [
        path.join(__dirname, 'preload.js'),
        path.join(__dirname, '..', 'electron', 'preload.js'),
        path.join(process.cwd(), 'electron', 'preload.js'),
        path.join(process.cwd(), 'dist', 'preload.js'),
        path.join(__dirname, '../preload.js'),
        path.join(__dirname, '../../preload.js'),
      ];

      const preloadPath = preloadPathList.find(p => {
        try { return fs.existsSync(p); } catch { return false; }
      });

      const keywordWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        title: 'LEWORD - 키워드마스터',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: preloadPath || path.join(__dirname, '../preload.js'),
          sandbox: false,
          webSecurity: true
        },
        backgroundColor: '#667eea',
        show: false,
        frame: true,
        autoHideMenuBar: true
      });

      const htmlPath = path.join(__dirname, '../../ui/keyword-master.html');
      if (fs.existsSync(htmlPath)) {
        keywordWindow.loadFile(htmlPath);
      } else {
        const fallbackPaths = [
          path.join(process.cwd(), 'ui/keyword-master.html'),
          path.join(__dirname, '../ui/keyword-master.html')
        ];

        let loaded = false;
        for (const p of fallbackPaths) {
          if (fs.existsSync(p)) {
            keywordWindow.loadFile(p);
            loaded = true;
            break;
          }
        }

        if (!loaded) {
          throw new Error('keyword-master.html 파일을 찾을 수 없습니다');
        }
      }

      keywordWindow.once('ready-to-show', () => {
        keywordWindow.show();
        keywordWindow.focus();
      });

      keywordWindow.webContents.on('console-message', (event, level, message) => {
        if (typeof message === 'string' && (
          message.includes('Electron Security Warning') ||
          message.includes('Content-Security-Policy') ||
          message.includes('Insecure Content-Security-Policy')
        )) {
          event.preventDefault();
          return;
        }
      });

      keywordWindow.on('closed', () => {
        console.log('[KEYWORD-MASTER] 키워드 마스터 창 닫힘');
      });

      return { success: true };
    } catch (error: any) {
      console.error('[KEYWORD-MASTER] 창 열기 실패:', error);
      return { success: false, error: error.message };
    }
  });
}
