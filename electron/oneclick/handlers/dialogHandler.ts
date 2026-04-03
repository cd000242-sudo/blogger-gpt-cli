// electron/oneclick/handlers/dialogHandler.ts
// IPC: 파일 선택 다이얼로그

import { ipcMain, BrowserWindow, dialog } from 'electron';

export function registerDialogHandler(): void {
  ipcMain.handle('dialog:open-file', async (_evt, args: { title?: string; filters?: any[] }) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win || BrowserWindow.getAllWindows()[0], {
        title: args?.title || '파일 선택',
        filters: args?.filters || [{ name: 'All Files', extensions: ['*'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return { filePath: '' };
      return { filePath: result.filePaths[0] };
    } catch (e) {
      console.error('[DIALOG] 파일 선택 오류:', e);
      return { filePath: '', error: e instanceof Error ? e.message : String(e) };
    }
  });
}
