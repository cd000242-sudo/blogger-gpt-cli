import * as fs from 'fs';
import * as path from 'path';
import {
  downloadTo,
  pruneOldVersions,
  removeQuietly,
  type PortableDeps,
  type PortableInstallResult,
  type ProgressFn,
} from './codex-portable';

/**
 * 📦 v3.8.755 — Gemini CLI 원클릭 설치(윈도우): Node.js 를 따로 깔지 않는다.
 *
 * 실측(v0.63.0): npm 패키지가 의존성 0개의 번들(bundle/gemini.js)이고, GitHub 릴리스에
 *   같은 번들 zip(gemini-cli-bundle.zip, 21MB, sha256 digest 있음)이 있다. 필요한 것은 Node 20+ 뿐.
 *   → nodejs.org 의 공식 node.exe(LTS, SHASUMS256.txt 로 대조)를 같이 받아 한 폴더에 둔다.
 *
 * 폴더: tools\gemini\gemini-<시각>\{node.exe, bundle\…, gemini.cmd}
 *   gemini.cmd 는 npm 이 만드는 실행 파일과 같은 모양이다 — 앱의 기존 실행 경로(.cmd → shell)를 그대로 탄다.
 *   경로는 %~dp0 상대로만 쓴다: .cmd 는 콘솔 코드페이지로 읽혀 한글 사용자 폴더 절대경로가 깨진다.
 * node.exe 는 tools\node\ 에 버전별로 한 번만 받아 두고 복사한다(제미나이만 바뀌면 다시 받지 않는다).
 */

export const GEMINI_RELEASE_API = 'https://api.github.com/repos/google-gemini/gemini-cli/releases/latest';
export const GEMINI_LATEST_DOWNLOAD = 'https://github.com/google-gemini/gemini-cli/releases/latest/download/gemini-cli-bundle.zip';
export const NODE_INDEX_URL = 'https://nodejs.org/dist/index.json';
export const GEMINI_PORTABLE_DISPLAY = 'Gemini CLI 공식 번들 + Node.js 공식 실행 파일 내려받기';

export const GEMINI_CMD = '@ECHO off\r\n"%~dp0node.exe" "%~dp0bundle\\gemini.js" %*\r\n';

type NodeInfo = { version: string; url: string; sha256: string; relPath: string };

export function nodeExeRelPath(arch: string): string {
  return arch === 'arm64' ? 'win-arm64/node.exe' : 'win-x64/node.exe';
}

/** SHASUMS256.txt 에서 이 PC 용 node.exe 의 sha256 을 찾는다 */
export function pickNodeSha(shasums: string, relPath: string): string | null {
  for (const line of String(shasums || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f]{64})\s+(\S+)$/i);
    if (match && match[2] === relPath) return match[1]!.toLowerCase();
  }
  return null;
}

export function pickGeminiRelease(json: any): { url: string; sha256: string | null; version: string | null; size: number | null } | null {
  const asset = Array.isArray(json?.assets) ? json.assets.find((a: any) => a?.name === 'gemini-cli-bundle.zip') : null;
  if (!asset?.browser_download_url) return null;
  const digest = String(asset.digest || '');
  return {
    url: String(asset.browser_download_url),
    sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
    version: String(json?.tag_name || '').replace(/^v/, '') || null,
    size: Number(asset.size) || null,
  };
}

export function readManagedGemini(root: string): { version: string; exe: string } | null {
  try {
    const current = JSON.parse(fs.readFileSync(path.join(root, 'current.json'), 'utf8'));
    const exe = String(current?.exe || '');
    if (!exe || !fs.existsSync(exe)) return null;
    return { version: String(current?.version || ''), exe };
  } catch {
    return null;
  }
}

async function fetchJson(deps: PortableDeps, url: string): Promise<any | null> {
  try {
    const res = await deps.fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'LEADERNAM-Orbit' } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchText(deps: PortableDeps, url: string): Promise<string | null> {
  try {
    const res = await deps.fetch(url, { headers: { 'User-Agent': 'LEADERNAM-Orbit' } });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** 최신 LTS 중 이 PC 용 node.exe 가 SHASUMS 에 있는 판 */
async function resolveNode(deps: PortableDeps, arch: string): Promise<NodeInfo> {
  const index = await fetchJson(deps, NODE_INDEX_URL);
  const relPath = nodeExeRelPath(arch);
  const ltsList = Array.isArray(index) ? index.filter((r: any) => r?.lts && typeof r.version === 'string') : [];
  for (const release of ltsList.slice(0, 3)) {
    const shasums = await fetchText(deps, `https://nodejs.org/dist/${release.version}/SHASUMS256.txt`);
    const sha256 = shasums ? pickNodeSha(shasums, relPath) : null;
    if (sha256) {
      return { version: release.version, url: `https://nodejs.org/dist/${release.version}/${relPath}`, sha256, relPath };
    }
  }
  throw new Error('Node.js 공식 사이트(nodejs.org)에서 실행 파일 정보를 받지 못했습니다. 인터넷 연결을 확인해주세요.');
}

/** tools\node\<버전>\node.exe — 있으면 다시 받지 않는다 */
async function ensureNodeExe(deps: PortableDeps, toolsRoot: string, node: NodeInfo, onProgress: ProgressFn): Promise<string> {
  const dir = path.join(toolsRoot, 'node', node.version);
  const exe = path.join(dir, 'node.exe');
  if (fs.existsSync(exe) && await deps.runVersion(exe)) return exe;

  fs.mkdirSync(dir, { recursive: true });
  // 제자리로 바로 받는다 — 갓 받은 exe 의 이름 바꾸기는 백신 잠금에 걸릴 수 있다. 틀리면 지운다.
  onProgress({ stage: 'download', percent: 0, message: `Node.js ${node.version} 내려받기를 시작합니다(약 90MB).` });
  let sha256 = '';
  try {
    sha256 = await downloadTo(deps, { url: node.url, size: null }, exe, (p) => onProgress({ ...p, message: `Node.js ${p.message}` }));
  } catch (error) {
    removeQuietly(exe);
    throw error;
  }
  if (sha256 !== node.sha256) {
    removeQuietly(exe);
    throw new Error('내려받은 Node.js 가 공식 파일과 다릅니다(무결성 불일치). 다시 눌러주세요.');
  }
  if (!await deps.runVersion(exe)) throw new Error('내려받은 Node.js 가 이 PC 에서 실행되지 않았습니다. 백신 프로그램이 막았는지 확인해주세요.');
  pruneOldVersions(path.join(toolsRoot, 'node'), dir);
  return exe;
}

export async function installGeminiPortable(options: {
  toolsRoot: string;
  arch: string;
  deps: PortableDeps;
  onProgress?: ProgressFn;
}): Promise<PortableInstallResult> {
  const { toolsRoot, arch, deps } = options;
  const root = path.join(toolsRoot, 'gemini');
  const log: string[] = [];
  const progress: ProgressFn = (p) => {
    if (p.stage !== 'download') log.push(`▶ ${p.message}`);
    try { options.onProgress?.(p); } catch { /* 화면 갱신 실패가 설치를 막지 않는다 */ }
  };

  progress({ stage: 'check', message: 'Gemini CLI 최신판을 확인합니다.' });
  const releaseJson = await fetchJson(deps, GEMINI_RELEASE_API);
  const release = pickGeminiRelease(releaseJson) || { url: GEMINI_LATEST_DOWNLOAD, sha256: null, version: null, size: null };
  if (!release.sha256) log.push('· 최신판 정보를 못 받아 공식 최신 주소에서 바로 받습니다(무결성 값 대조 생략).');

  const current = readManagedGemini(root);
  if (current && release.version && current.version === release.version) {
    const dir = path.dirname(current.exe);
    if (await deps.runVersion(path.join(dir, 'node.exe'), [path.join(dir, 'bundle', 'gemini.js'), '--version'])) {
      progress({ stage: 'done', percent: 100, message: `이미 최신 Gemini CLI(${current.version})가 설치되어 있습니다.` });
      return { ok: true, skipped: true, version: current.version, exe: current.exe, log };
    }
  }

  const stamp = Date.now();
  const zipPath = path.join(root, `download-${stamp}.zip`);
  const installDir = path.join(root, `gemini-${stamp}`);
  let installed = false;
  try {
    const node = await resolveNode(deps, arch);
    const nodeExe = await ensureNodeExe(deps, toolsRoot, node, progress);

    fs.mkdirSync(root, { recursive: true });
    progress({ stage: 'download', percent: 0, message: `Gemini CLI${release.version ? ` ${release.version}` : ''} 내려받기를 시작합니다(약 20MB).` });
    const sha256 = await downloadTo(deps, release, zipPath, progress);
    progress({ stage: 'verify', message: '내려받은 파일이 공식 파일과 같은지 확인합니다.' });
    if (release.sha256 && sha256 !== release.sha256) {
      throw new Error('내려받은 Gemini CLI 가 공식 파일과 다릅니다(무결성 불일치). 다시 눌러주세요.');
    }

    progress({ stage: 'extract', message: '압축을 풉니다.' });
    const bundleDir = path.join(installDir, 'bundle');
    fs.mkdirSync(bundleDir, { recursive: true });
    await deps.extractZip(zipPath, bundleDir);
    const entry = path.join(bundleDir, 'gemini.js');
    if (!fs.existsSync(entry)) throw new Error('압축 안에서 gemini.js 를 찾지 못했습니다.');
    fs.copyFileSync(nodeExe, path.join(installDir, 'node.exe'));
    const cmd = path.join(installDir, 'gemini.cmd');
    fs.writeFileSync(cmd, GEMINI_CMD, 'ascii');

    progress({ stage: 'test', message: '이 PC 에서 실행되는지 확인합니다.' });
    const versionText = await deps.runVersion(path.join(installDir, 'node.exe'), [entry, '--version']);
    if (!versionText) throw new Error('내려받은 Gemini CLI 가 이 PC 에서 실행되지 않았습니다. 백신 프로그램이 막았는지 확인해주세요.');

    const version = release.version || versionText.match(/\d+\.\d+\.\d+/)?.[0] || `build-${stamp}`;
    fs.writeFileSync(
      path.join(root, 'current.json'),
      JSON.stringify({ version, exe: cmd, node: node.version, installedAt: new Date().toISOString() }, null, 2),
      'utf8',
    );
    installed = true;
    pruneOldVersions(root, installDir);
    progress({ stage: 'done', percent: 100, message: `Gemini CLI ${version} 설치를 마쳤습니다.` });
    return { ok: true, version, exe: cmd, log };
  } catch (error: any) {
    const message = error?.message || String(error || '알 수 없는 오류');
    log.push(`· 직접 내려받기 실패: ${message}`);
    return { ok: false, error: message, log };
  } finally {
    removeQuietly(zipPath);
    if (!installed) removeQuietly(installDir);
  }
}
