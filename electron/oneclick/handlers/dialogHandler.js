"use strict";
// electron/oneclick/handlers/dialogHandler.ts
// IPC: 파일 선택 다이얼로그
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDialogHandler = registerDialogHandler;
const electron_1 = require("electron");
function registerDialogHandler() {
    electron_1.ipcMain.handle('dialog:open-file', async (_evt, args) => {
        try {
            const win = electron_1.BrowserWindow.getFocusedWindow();
            const result = await electron_1.dialog.showOpenDialog(win || electron_1.BrowserWindow.getAllWindows()[0], {
                title: args?.title || '파일 선택',
                filters: args?.filters || [{ name: 'All Files', extensions: ['*'] }],
                properties: ['openFile'],
            });
            if (result.canceled || !result.filePaths.length)
                return { filePath: '' };
            return { filePath: result.filePaths[0] };
        }
        catch (e) {
            console.error('[DIALOG] 파일 선택 오류:', e);
            return { filePath: '', error: e instanceof Error ? e.message : String(e) };
        }
    });
}
