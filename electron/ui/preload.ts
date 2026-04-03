// src/ui/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

console.log('[preload] ready');

contextBridge.exposeInMainWorld('api', {
  userDataPath: () => ipcRenderer.sendSync('get-user-data-path'),
  envLoad:     () => ipcRenderer.invoke('env:load'),
  envSave:     (env: any) => ipcRenderer.invoke('env:save', env),
  runExec:     (payload: any) => ipcRenderer.invoke('run:exec', payload),
  makeThumb:   (payload: any) => ipcRenderer.invoke('make-thumb', payload),
  saveThumbnailPng: (payload: any) => ipcRenderer.invoke('save-thumbnail-png', payload),
  crawlUrl:   (url: any) => ipcRenderer.invoke('crawl-url', url),
  transformContent: (args: any) => ipcRenderer.invoke('transform-content', args),
});
contextBridge.exposeInMainWorld('blogger', {
  getEnv: () => ipcRenderer.invoke('env:load'),
  saveEnv: (env: any) => ipcRenderer.invoke('env:save', env),
  openLink: async (url: string) => {
    try {
      const result = await ipcRenderer.invoke('open-external', url);
      if (typeof result === 'object' && result !== null) {
        return result.ok !== false;
      }
      return !!result;
    } catch (error) {
      console.error('[preload] openLink error:', error);
      return false;
    }
  },
  runPost: (payload: any) => ipcRenderer.invoke('run-post', payload),
  publishContent: (payload: any, title: string, content: string, thumbnailUrl: string) =>
    ipcRenderer.invoke('publish-content', { payload, title, content, thumbnailUrl }),
  generateInternalLinkContent: (payload: any) => ipcRenderer.invoke('generate-internal-link-content', payload),
  publishInternalLinkContent: (payload: any) => ipcRenderer.invoke('publish-internal-link-content', payload),
  onLog: (listener: (line: string) => void) => {
    const channel = 'log-line';
    const handler = (_event: Electron.IpcRendererEvent, line: string) => {
      try {
        listener(line);
      } catch (err) {
        console.error('[preload] onLog listener error:', err);
      }
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  onProgress: (listener: (data: { p: number; label?: string }) => void) => {
    const channel = 'run-progress';
    const handler = (_event: Electron.IpcRendererEvent, data: { p: number; label?: string }) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[preload] onProgress listener error:', err);
      }
    };
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});

contextBridge.exposeInMainWorld('externalLinksAPI', {
  read: () => ipcRenderer.invoke('external-links:read'),
  write: (links: any[]) => ipcRenderer.invoke('external-links:write', links),
});
