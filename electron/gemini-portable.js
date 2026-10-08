"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GEMINI_CMD = exports.GEMINI_PORTABLE_DISPLAY = exports.NODE_INDEX_URL = exports.GEMINI_LATEST_DOWNLOAD = exports.GEMINI_RELEASE_API = void 0;
exports.nodeExeRelPath = nodeExeRelPath;
exports.pickNodeSha = pickNodeSha;
exports.pickGeminiRelease = pickGeminiRelease;
exports.readManagedGemini = readManagedGemini;
exports.installGeminiPortable = installGeminiPortable;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const codex_portable_1 = require("./codex-portable");
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
exports.GEMINI_RELEASE_API = 'https://api.github.com/repos/google-gemini/gemini-cli/releases/latest';
exports.GEMINI_LATEST_DOWNLOAD = 'https://github.com/google-gemini/gemini-cli/releases/latest/download/gemini-cli-bundle.zip';
exports.NODE_INDEX_URL = 'https://nodejs.org/dist/index.json';
exports.GEMINI_PORTABLE_DISPLAY = 'Gemini CLI 공식 번들 + Node.js 공식 실행 파일 내려받기';
exports.GEMINI_CMD = '@ECHO off\r\n"%~dp0node.exe" "%~dp0bundle\\gemini.js" %*\r\n';
function nodeExeRelPath(arch) {
    return arch === 'arm64' ? 'win-arm64/node.exe' : 'win-x64/node.exe';
}
/** SHASUMS256.txt 에서 이 PC 용 node.exe 의 sha256 을 찾는다 */
function pickNodeSha(shasums, relPath) {
    for (const line of String(shasums || '').split(/\r?\n/)) {
        const match = line.trim().match(/^([0-9a-f]{64})\s+(\S+)$/i);
        if (match && match[2] === relPath)
            return match[1].toLowerCase();
    }
    return null;
}
function pickGeminiRelease(json) {
    const asset = Array.isArray(json?.assets) ? json.assets.find((a) => a?.name === 'gemini-cli-bundle.zip') : null;
    if (!asset?.browser_download_url)
        return null;
    const digest = String(asset.digest || '');
    return {
        url: String(asset.browser_download_url),
        sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
        version: String(json?.tag_name || '').replace(/^v/, '') || null,
        size: Number(asset.size) || null,
    };
}
function readManagedGemini(root) {
    try {
        const current = JSON.parse(fs.readFileSync(path.join(root, 'current.json'), 'utf8'));
        const exe = String(current?.exe || '');
        if (!exe || !fs.existsSync(exe))
            return null;
        return { version: String(current?.version || ''), exe };
    }
    catch {
        return null;
    }
}
async function fetchJson(deps, url) {
    try {
        const res = await deps.fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'LEADERNAM-Orbit' } });
        return res.ok ? await res.json() : null;
    }
    catch {
        return null;
    }
}
async function fetchText(deps, url) {
    try {
        const res = await deps.fetch(url, { headers: { 'User-Agent': 'LEADERNAM-Orbit' } });
        return res.ok ? await res.text() : null;
    }
    catch {
        return null;
    }
}
/** 최신 LTS 중 이 PC 용 node.exe 가 SHASUMS 에 있는 판 */
async function resolveNode(deps, arch) {
    const index = await fetchJson(deps, exports.NODE_INDEX_URL);
    const relPath = nodeExeRelPath(arch);
    const ltsList = Array.isArray(index) ? index.filter((r) => r?.lts && typeof r.version === 'string') : [];
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
async function ensureNodeExe(deps, toolsRoot, node, onProgress) {
    const dir = path.join(toolsRoot, 'node', node.version);
    const exe = path.join(dir, 'node.exe');
    if (fs.existsSync(exe) && await deps.runVersion(exe))
        return exe;
    fs.mkdirSync(dir, { recursive: true });
    // 제자리로 바로 받는다 — 갓 받은 exe 의 이름 바꾸기는 백신 잠금에 걸릴 수 있다. 틀리면 지운다.
    onProgress({ stage: 'download', percent: 0, message: `Node.js ${node.version} 내려받기를 시작합니다(약 90MB).` });
    let sha256 = '';
    try {
        sha256 = await (0, codex_portable_1.downloadTo)(deps, { url: node.url, size: null }, exe, (p) => onProgress({ ...p, message: `Node.js ${p.message}` }));
    }
    catch (error) {
        (0, codex_portable_1.removeQuietly)(exe);
        throw error;
    }
    if (sha256 !== node.sha256) {
        (0, codex_portable_1.removeQuietly)(exe);
        throw new Error('내려받은 Node.js 가 공식 파일과 다릅니다(무결성 불일치). 다시 눌러주세요.');
    }
    if (!await deps.runVersion(exe))
        throw new Error('내려받은 Node.js 가 이 PC 에서 실행되지 않았습니다. 백신 프로그램이 막았는지 확인해주세요.');
    (0, codex_portable_1.pruneOldVersions)(path.join(toolsRoot, 'node'), dir);
    return exe;
}
async function installGeminiPortable(options) {
    const { toolsRoot, arch, deps } = options;
    const root = path.join(toolsRoot, 'gemini');
    const log = [];
    const progress = (p) => {
        if (p.stage !== 'download')
            log.push(`▶ ${p.message}`);
        try {
            options.onProgress?.(p);
        }
        catch { /* 화면 갱신 실패가 설치를 막지 않는다 */ }
    };
    progress({ stage: 'check', message: 'Gemini CLI 최신판을 확인합니다.' });
    const releaseJson = await fetchJson(deps, exports.GEMINI_RELEASE_API);
    const release = pickGeminiRelease(releaseJson) || { url: exports.GEMINI_LATEST_DOWNLOAD, sha256: null, version: null, size: null };
    if (!release.sha256)
        log.push('· 최신판 정보를 못 받아 공식 최신 주소에서 바로 받습니다(무결성 값 대조 생략).');
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
        const sha256 = await (0, codex_portable_1.downloadTo)(deps, release, zipPath, progress);
        progress({ stage: 'verify', message: '내려받은 파일이 공식 파일과 같은지 확인합니다.' });
        if (release.sha256 && sha256 !== release.sha256) {
            throw new Error('내려받은 Gemini CLI 가 공식 파일과 다릅니다(무결성 불일치). 다시 눌러주세요.');
        }
        progress({ stage: 'extract', message: '압축을 풉니다.' });
        const bundleDir = path.join(installDir, 'bundle');
        fs.mkdirSync(bundleDir, { recursive: true });
        await deps.extractZip(zipPath, bundleDir);
        const entry = path.join(bundleDir, 'gemini.js');
        if (!fs.existsSync(entry))
            throw new Error('압축 안에서 gemini.js 를 찾지 못했습니다.');
        fs.copyFileSync(nodeExe, path.join(installDir, 'node.exe'));
        const cmd = path.join(installDir, 'gemini.cmd');
        fs.writeFileSync(cmd, exports.GEMINI_CMD, 'ascii');
        progress({ stage: 'test', message: '이 PC 에서 실행되는지 확인합니다.' });
        const versionText = await deps.runVersion(path.join(installDir, 'node.exe'), [entry, '--version']);
        if (!versionText)
            throw new Error('내려받은 Gemini CLI 가 이 PC 에서 실행되지 않았습니다. 백신 프로그램이 막았는지 확인해주세요.');
        const version = release.version || versionText.match(/\d+\.\d+\.\d+/)?.[0] || `build-${stamp}`;
        fs.writeFileSync(path.join(root, 'current.json'), JSON.stringify({ version, exe: cmd, node: node.version, installedAt: new Date().toISOString() }, null, 2), 'utf8');
        installed = true;
        (0, codex_portable_1.pruneOldVersions)(root, installDir);
        progress({ stage: 'done', percent: 100, message: `Gemini CLI ${version} 설치를 마쳤습니다.` });
        return { ok: true, version, exe: cmd, log };
    }
    catch (error) {
        const message = error?.message || String(error || '알 수 없는 오류');
        log.push(`· 직접 내려받기 실패: ${message}`);
        return { ok: false, error: message, log };
    }
    finally {
        (0, codex_portable_1.removeQuietly)(zipPath);
        if (!installed)
            (0, codex_portable_1.removeQuietly)(installDir);
    }
}
