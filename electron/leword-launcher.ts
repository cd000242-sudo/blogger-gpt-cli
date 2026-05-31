// leword-launcher.ts — 황금키워드(LEWORD) 외부 앱 런처
//
// 흐름: 라이선스 검증 → 로컬 LEWORD 경로 탐색 → GitHub 최신 버전 비교
//      → 일치/로컬이 더 새것이면 즉시 실행, 로컬이 구버전이면 안내 후 선택

import { ipcMain, app, BrowserWindow, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { spawn, exec } from 'child_process';
import { loadEnvFromFile } from '../dist/env';

const REPO_OWNER = 'cd000242-sudo';
const REPO_NAME = 'leword-app';
const USER_AGENT = 'leadernam-orbit-launcher';

interface InstalledMeta {
  exePath: string;
  resolvedAt: number;
}

type ProgressPhase = 'license' | 'locate' | 'version' | 'launch';

function readLocalVersion(exePath: string): string | null {
  // exePath 가 ~/leword-app/release/win-unpacked/LEWORD.exe 또는 ~/leword-app/release/LEWORD-*.exe
  // 두 케이스 모두 leword-app/package.json 까지 거슬러 올라가서 version 읽기
  let dir = path.dirname(exePath);
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg)) {
      try {
        const json = JSON.parse(fs.readFileSync(pkg, 'utf-8'));
        if (json && typeof json.version === 'string' && /leword/i.test(String(json.name || ''))) {
          return json.version;
        }
      } catch { /* noop */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // 인스톨러 파일명에서 추출 (LEWORD-2.40.5.exe)
  const m = path.basename(exePath).match(/LEWORD-(\d+\.\d+\.\d+)/i);
  return m && m[1] ? m[1] : null;
}

function fetchLatestReleaseTag(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = https.request(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': USER_AGENT
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const json = JSON.parse(body) as { tag_name?: string };
            const tag = (json.tag_name || '').replace(/^v/, '').trim();
            resolve(tag || null);
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// v3.5.98: GitHub Releases에서 최신 LEWORD .exe asset 정보 + 다운로드 URL 가져옴
function fetchLatestReleaseAsset(): Promise<{ tag: string; downloadUrl: string; size: number; name: string } | null> {
  return new Promise((resolve) => {
    const req = https.request(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': USER_AGENT
        }
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) { resolve(null); return; }
          try {
            const body = Buffer.concat(chunks).toString('utf-8');
            const json: any = JSON.parse(body);
            const tag = (json.tag_name || '').replace(/^v/, '').trim();
            const assets: any[] = Array.isArray(json.assets) ? json.assets : [];
            // .exe 우선 (인스톨러), 없으면 첫 binary asset
            const exeAsset = assets.find(a => /\.exe$/i.test(a.name || '')) || assets[0];
            if (tag && exeAsset?.browser_download_url) {
              resolve({
                tag,
                downloadUrl: exeAsset.browser_download_url,
                size: exeAsset.size || 0,
                name: exeAsset.name || `LEWORD-${tag}.exe`,
              });
            } else {
              resolve(null);
            }
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// v3.5.98: 파일 다운로드 (HTTPS, redirect 3회 자동 처리)
async function downloadFile(
  url: string,
  destPath: string,
  onProgress?: (downloaded: number, total: number) => void,
  redirectCount = 0
): Promise<void> {
  if (redirectCount > 3) throw new Error('redirect too many times');
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/octet-stream' }
    }, (res) => {
      // GitHub Releases는 302 redirect로 S3로 보냄
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, destPath, onProgress, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(String(res.headers['content-length'] || '0'), 10) || 0;
      let downloaded = 0;
      const file = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress) onProgress(downloaded, total);
      });
      res.pipe(file);
      file.on('finish', () => file.close((err) => err ? reject(err) : resolve()));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(new Error('download timeout')); });
  });
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

function getCacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'leword');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMetaPath(): string {
  return path.join(getCacheDir(), 'installed.json');
}

function readMeta(): InstalledMeta | null {
  try {
    const p = getMetaPath();
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as InstalledMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: InstalledMeta): void {
  try {
    fs.writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[LEWORD] 메타 저장 실패:', e);
  }
}

function loadCustomPath(): string {
  const env = loadEnvFromFile() as Record<string, string | undefined>;
  return (env.LEWORD_PATH || env.lewordPath || '').trim();
}

function emitProgress(
  win: BrowserWindow | null,
  phase: ProgressPhase,
  percent: number,
  message: string
): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('leword:progress', { phase, percent, message });
}

function findInDir(dir: string, pattern: RegExp): string | null {
  try {
    if (!fs.existsSync(dir)) return null;
    const matches = fs.readdirSync(dir).filter((f) => pattern.test(f));
    for (const m of matches) {
      const full = path.join(dir, m);
      if (fs.statSync(full).isFile()) return full;
    }
    return null;
  } catch {
    return null;
  }
}

function locateViaRegistry(): Promise<string | null> {
  return new Promise((resolve) => {
    const ps = `Get-ItemProperty HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* ` +
      `| Where-Object { $_.DisplayName -like '*LEWORD*' } ` +
      `| Select-Object -First 1 -ExpandProperty InstallLocation`;
    exec(`powershell -NoProfile -Command "${ps}"`, { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const dir = stdout.trim();
      if (!dir) { resolve(null); return; }
      const exe = path.join(dir, 'LEWORD.exe');
      resolve(fs.existsSync(exe) ? exe : null);
    });
  });
}

function scanUsersForLewordApp(): string | null {
  const home = os.homedir();
  const usersRoot = path.dirname(home); // C:\Users
  try {
    if (!fs.existsSync(usersRoot)) return null;
    for (const userDir of fs.readdirSync(usersRoot)) {
      const unpacked = path.join(usersRoot, userDir, 'leword-app', 'release', 'win-unpacked', 'LEWORD.exe');
      if (fs.existsSync(unpacked)) return unpacked;
    }
    for (const userDir of fs.readdirSync(usersRoot)) {
      const releaseDir = path.join(usersRoot, userDir, 'leword-app', 'release');
      const installer = findInDir(releaseDir, /^LEWORD-.*\.exe$/i);
      if (installer) return installer;
    }
  } catch {
    // 권한 부족 등 무시
  }
  return null;
}

async function locateLewordExe(): Promise<string | null> {
  // 1) .env 사용자 지정
  const custom = loadCustomPath();
  if (custom && fs.existsSync(custom)) return custom;

  // 2) 사용자 홈 기준 dev unpacked 경로 (homedir와 일치하는 경우)
  const home = os.homedir();
  const localAppData = process.env['LOCALAPPDATA'] || '';
  const candidates = [
    path.join(home, 'leword-app', 'release', 'win-unpacked', 'LEWORD.exe'),
    path.join(localAppData, 'Programs', 'LEWORD', 'LEWORD.exe'),
    path.join(localAppData, 'Programs', 'leword', 'LEWORD.exe'),
    path.join(localAppData, 'Programs', 'leword-app', 'LEWORD.exe')
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }

  // 3) home의 release/ 안 인스톨러
  const releaseDir = path.join(home, 'leword-app', 'release');
  const installer = findInDir(releaseDir, /^LEWORD-.*\.exe$/i);
  if (installer) return installer;

  // 4) C:\Users\* 전체 스캔 (homedir 외 사용자 폴더에 leword-app 있는 케이스)
  const scanned = scanUsersForLewordApp();
  if (scanned) return scanned;

  // 5) 레지스트리 폴백
  return locateViaRegistry();
}

function spawnDetached(exePath: string): void {
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: path.dirname(exePath)
  });
  child.unref();
}

interface LaunchResult {
  ok: boolean;
  action?: 'launched' | 'cancelled';
  exePath?: string;
  localVersion?: string;
  latestVersion?: string;
  error?: string;
}

// v3.5.98: GitHub Releases에서 자동 다운로드한 LEWORD .exe 캐시 경로
function getDownloadedLewordDir(): string {
  const dir = path.join(app.getPath('userData'), 'leword', 'downloaded');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// 캐시된 다운로드 .exe 찾기 (가장 최신 버전 우선)
function findDownloadedLewordExe(): string | null {
  try {
    const dir = getDownloadedLewordDir();
    const files = fs.readdirSync(dir).filter(f => /^LEWORD-.*\.exe$/i.test(f));
    if (files.length === 0) return null;
    // semver 정렬 — 최신순
    files.sort((a, b) => {
      const va = (a.match(/LEWORD-(\d+\.\d+\.\d+)/i) || [, '0.0.0'])[1] || '0.0.0';
      const vb = (b.match(/LEWORD-(\d+\.\d+\.\d+)/i) || [, '0.0.0'])[1] || '0.0.0';
      return compareSemver(vb, va);
    });
    return path.join(dir, files[0] || '');
  } catch {
    return null;
  }
}

async function performLaunch(senderWin: BrowserWindow | null): Promise<LaunchResult> {
  // 1. 라이선스 검증 — v3.7.20: getLicenseStatus()로 교체.
  //   이전 코드는 license-manager에 존재하지 않는 `checkLicenseStatus`/`activated`를
  //   호출해서 클릭 즉시 "oldLic.checkLicenseStatus is not a function" 토스트가 떴음.
  emitProgress(senderWin, 'license', 10, '라이선스 확인 중...');
  const oldLic = require('../dist/utils/license-manager');
  const status = oldLic.getLicenseManager().getLicenseStatus();
  if (!status?.valid) {
    return { ok: false, error: status?.message || '라이선스가 만료되었거나 활성화되지 않았습니다. 로그인 후 다시 시도하세요.' };
  }

  // 2. 🚀 v3.7.20: 캐시 우선 즉시 실행 — 로컬에 LEWORD가 있으면 GitHub fetch 건너뛰고 바로 열기.
  //   기존 동작은 GitHub `fetchLatestReleaseAsset` + `fetchLatestReleaseTag`를 항상 먼저 호출 →
  //   네트워크가 느리거나 끊긴 환경에서 실행이 수 초~수십 초 지연되거나 실패 시 fallback까지 가야
  //   비로소 캐시본을 사용하는 비효율. 사용자 요구: "설치되어 있다면 자동으로 열리게".
  emitProgress(senderWin, 'locate', 30, '로컬 LEWORD 확인 중...');
  {
    const cachedMeta = readMeta();
    const cachedExe =
      findDownloadedLewordExe() ||
      (cachedMeta?.exePath && fs.existsSync(cachedMeta.exePath) ? cachedMeta.exePath : null);
    if (cachedExe) {
      const cachedVersion = readLocalVersion(cachedExe);
      const cachedLabel = cachedVersion ? `v${cachedVersion}` : path.basename(cachedExe);
      console.log('[LEWORD] ⚡ 로컬 캐시 즉시 실행:', cachedExe, cachedLabel);
      emitProgress(senderWin, 'launch', 100, `LEWORD ${cachedLabel} 실행 중...`);
      writeMeta({ exePath: cachedExe, resolvedAt: Date.now() });
      spawnDetached(cachedExe);
      return { ok: true, action: 'launched', exePath: cachedExe, localVersion: cachedVersion || undefined };
    }
  }

  // 3. 캐시가 없으면 GitHub 최신 릴리스 fetch + 자동 다운로드 (최초 1회 설치 경로)
  emitProgress(senderWin, 'version', 35, 'GitHub에서 최신 LEWORD 확인 중...');
  const latestAsset = await fetchLatestReleaseAsset();
  const latestVersion = latestAsset?.tag || await fetchLatestReleaseTag();
  let exePath: string | null = null;

  if (!exePath && latestAsset) {
    try {
      emitProgress(senderWin, 'version', 50, `LEWORD v${latestAsset.tag} 다운로드 중...`);
      const dlDir = getDownloadedLewordDir();
      const dlPath = path.join(dlDir, latestAsset.name);
      // 이전 버전 정리 (5개 초과 시 오래된 것부터 삭제)
      try {
        const oldFiles = fs.readdirSync(dlDir)
          .filter(f => /^LEWORD-.*\.exe$/i.test(f))
          .map(f => ({ name: f, path: path.join(dlDir, f), mtime: fs.statSync(path.join(dlDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime);
        for (let i = 5; i < oldFiles.length; i++) {
          const oldFile = oldFiles[i];
          if (oldFile) {
            try { fs.unlinkSync(oldFile.path); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore */ }

      await downloadFile(latestAsset.downloadUrl, dlPath, (down, total) => {
        if (total > 0) {
          const pct = Math.min(60, 50 + Math.floor((down / total) * 10));
          emitProgress(senderWin, 'version', pct, `다운로드 중... ${Math.round((down / total) * 100)}%`);
        }
      });
      console.log('[LEWORD] ✅ 자동 다운로드 완료:', dlPath);
      exePath = dlPath;
      writeMeta({ exePath, resolvedAt: Date.now() });
    } catch (dlErr: any) {
      console.warn('[LEWORD] ⚠️ 자동 다운로드 실패:', dlErr?.message);
      emitProgress(senderWin, 'version', 50, '자동 다운로드 실패 — 로컬 빌드 탐색 중...');
    }
  }

  // 3-c. 그래도 못 찾으면 기존 로컬 탐색 (옛 폴백)
  if (!exePath) {
    const cached = readMeta();
    if (cached?.exePath && fs.existsSync(cached.exePath)) {
      exePath = cached.exePath;
    } else {
      exePath = await locateLewordExe();
    }
    if (!exePath) {
      return {
        ok: false,
        error: 'LEWORD를 찾을 수 없습니다. GitHub 자동 다운로드도 실패했습니다. 인터넷 연결을 확인하세요.'
      };
    }
    writeMeta({ exePath, resolvedAt: Date.now() });
  }

  // 4. 버전 비교 (캐시된 로컬 빌드 사용 시에만 — 다운로드한 .exe는 이미 최신)
  emitProgress(senderWin, 'version', 65, '버전 확인 중...');
  const localVersion = readLocalVersion(exePath);

  const isDownloadedExe = exePath.startsWith(getDownloadedLewordDir());
  if (!isDownloadedExe && localVersion && latestVersion && compareSemver(localVersion, latestVersion) < 0) {
    // 로컬 빌드가 구버전 — 자동 다운로드 안내 (이전 dialog 제거, 자동 다운로드 시도)
    if (latestAsset) {
      try {
        emitProgress(senderWin, 'version', 70, `구버전 감지 — v${latestVersion} 자동 다운로드 중...`);
        const dlPath = path.join(getDownloadedLewordDir(), latestAsset.name);
        await downloadFile(latestAsset.downloadUrl, dlPath, (down, total) => {
          if (total > 0) {
            const pct = Math.min(85, 70 + Math.floor((down / total) * 15));
            emitProgress(senderWin, 'version', pct, `다운로드 중... ${Math.round((down / total) * 100)}%`);
          }
        });
        exePath = dlPath;
        writeMeta({ exePath, resolvedAt: Date.now() });
      } catch (e: any) {
        // 다운로드 실패 시 사용자 확인 후 구버전 실행
        const result = await dialog.showMessageBox(senderWin || undefined as any, {
          type: 'warning',
          title: 'LEWORD 업데이트 다운로드 실패',
          message: `v${latestVersion} 자동 다운로드 실패. v${localVersion} (구버전)을 실행할까요?`,
          buttons: ['지금 실행', '취소'],
          defaultId: 1,
          cancelId: 1
        });
        if (result.response !== 0) {
          return { ok: true, action: 'cancelled', exePath, localVersion, latestVersion };
        }
      }
    }
  }

  // 5. 실행
  const finalVersion = readLocalVersion(exePath) || localVersion;
  const versionLabel = finalVersion ? `v${finalVersion}` : path.basename(exePath);
  emitProgress(senderWin, 'launch', 100, `LEWORD ${versionLabel} 실행 중...`);
  spawnDetached(exePath);
  return { ok: true, action: 'launched', exePath, localVersion: finalVersion || undefined, latestVersion: latestVersion || undefined };
}

export function registerLewordLauncherHandlers(): void {
  for (const ch of ['leword:launch', 'leword:get-status', 'leword:reset-cache']) {
    try {
      if (ipcMain.listenerCount(ch) > 0) ipcMain.removeHandler(ch);
    } catch { /* noop */ }
  }

  ipcMain.handle('leword:launch', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
      return await performLaunch(win);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[LEWORD] 런처 실패:', e);
      return { ok: false, error: msg };
    }
  });

  ipcMain.handle('leword:get-status', async () => {
    const meta = readMeta();
    if (!meta) return { resolved: false };
    return {
      resolved: fs.existsSync(meta.exePath),
      exePath: meta.exePath,
      resolvedAt: meta.resolvedAt
    };
  });

  ipcMain.handle('leword:reset-cache', async () => {
    try {
      const p = getMetaPath();
      if (fs.existsSync(p)) fs.unlinkSync(p);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  console.log('[LEWORD] ✅ 런처 IPC 핸들러 등록 완료 (로컬 실행 모드)');
}
