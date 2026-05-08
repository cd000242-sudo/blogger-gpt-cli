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

async function performLaunch(senderWin: BrowserWindow | null): Promise<LaunchResult> {
  // 1. 라이선스 검증
  emitProgress(senderWin, 'license', 10, '라이선스 확인 중...');
  const oldLic = require('../dist/utils/license-manager');
  const status = await oldLic.checkLicenseStatus();
  if (!status?.activated) {
    return { ok: false, error: '라이선스가 만료되었거나 활성화되지 않았습니다. 로그인 후 다시 시도하세요.' };
  }

  // 2. LEWORD.exe 위치 탐색 (캐시는 매 실행마다 재검증)
  emitProgress(senderWin, 'locate', 35, 'LEWORD 위치 확인 중...');
  const cached = readMeta();
  let exePath = cached?.exePath && fs.existsSync(cached.exePath) ? cached.exePath : null;

  if (!exePath) {
    exePath = await locateLewordExe();
    if (!exePath) {
      return {
        ok: false,
        error: 'LEWORD를 찾지 못했습니다. .env에 LEWORD_PATH=전체경로 를 추가하거나, ~/leword-app 에 빌드하세요.'
      };
    }
    writeMeta({ exePath, resolvedAt: Date.now() });
  }

  // 3. 버전 확인 (로컬 vs GitHub)
  emitProgress(senderWin, 'version', 65, '최신 버전 확인 중...');
  const localVersion = readLocalVersion(exePath);
  const latestVersion = await fetchLatestReleaseTag();

  if (localVersion && latestVersion && compareSemver(localVersion, latestVersion) < 0) {
    // 로컬이 구버전 — 사용자에게 선택 제공
    const result = await dialog.showMessageBox(senderWin || undefined as any, {
      type: 'warning',
      title: 'LEWORD 업데이트 필요',
      message: `로컬 LEWORD(v${localVersion})가 GitHub 최신(v${latestVersion})보다 구버전입니다.`,
      detail: `~/leword-app 폴더에서 git pull + 재빌드 후 다시 실행해주세요.\n그래도 지금 실행하시겠습니까?`,
      buttons: ['지금 실행', '취소'],
      defaultId: 1,
      cancelId: 1
    });
    if (result.response !== 0) {
      return { ok: true, action: 'cancelled', exePath, localVersion, latestVersion };
    }
  }

  // 4. 실행
  const versionLabel = localVersion ? `v${localVersion}` : path.basename(exePath);
  emitProgress(senderWin, 'launch', 100, `LEWORD ${versionLabel} 실행 중...`);
  spawnDetached(exePath);
  return { ok: true, action: 'launched', exePath, localVersion: localVersion || undefined, latestVersion: latestVersion || undefined };
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
