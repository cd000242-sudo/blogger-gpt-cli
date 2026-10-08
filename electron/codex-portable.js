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
exports.CODEX_PORTABLE_DISPLAY = exports.CODEX_LATEST_DOWNLOAD = exports.CODEX_RELEASE_API = void 0;
exports.codexAssetName = codexAssetName;
exports.getCodexToolsRoot = getCodexToolsRoot;
exports.pickCodexRelease = pickCodexRelease;
exports.readManagedCodex = readManagedCodex;
exports.installCodexPortable = installCodexPortable;
exports.createDefaultPortableDeps = createDefaultPortableDeps;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * 📦 v3.8.755 — Codex 원클릭 설치(윈도우): npm·winget·관리자 권한 없이 공식 실행 파일을 바로 받는다.
 *
 * 사장님 지시(2026-10-08): "개발자가 아닌 일반인·시니어층도 원클릭으로 다 되게".
 * 실측(rust-v0.161.0):
 *   - GitHub 릴리스의 codex-x86_64-pc-windows-msvc.exe.zip(164MB)에 실행 파일·ripgrep·보조 exe 가 다 들어 있다.
 *   - 본체 exe 는 VCRUNTIME/api-ms-win-crt 를 부르지 않는다(정적 링크) → 압축만 풀면 돈다.
 *   - 릴리스 API 가 자산마다 sha256 digest 를 준다 → 받은 파일을 그 값과 대조한다.
 *   - zip 안 codex-package.json 의 entrypoint 가 실행 파일 이름을 알려준다.
 *
 * 설치 위치: %LOCALAPPDATA%\LEADERNAM Orbit\tools\codex\<버전>\ (사용자 폴더 — 권한 불필요)
 * current.json 이 지금 쓰는 실행 파일을 가리킨다. 앱의 감지 후보 맨 앞에 들어간다.
 */
exports.CODEX_RELEASE_API = 'https://api.github.com/repos/openai/codex/releases/latest';
exports.CODEX_LATEST_DOWNLOAD = 'https://github.com/openai/codex/releases/latest/download/';
exports.CODEX_PORTABLE_DISPLAY = 'OpenAI 공식 Codex 내려받기(github.com/openai/codex)';
/** 바이트가 이만큼 안 들어오면 끊긴 것으로 본다 — 느린 회선은 기다리고, 멈춘 회선만 끊는다 */
const STALL_MS = 90000;
function codexAssetName(arch) {
    return arch === 'arm64' ? 'codex-aarch64-pc-windows-msvc.exe.zip' : 'codex-x86_64-pc-windows-msvc.exe.zip';
}
function getCodexToolsRoot(env, fallbackDir) {
    return path.join(env.LOCALAPPDATA || fallbackDir, 'LEADERNAM Orbit', 'tools', 'codex');
}
/** 릴리스 API 응답에서 이 PC 에 맞는 자산과 sha256 을 고른다 */
function pickCodexRelease(json, arch) {
    const name = codexAssetName(arch);
    const asset = Array.isArray(json?.assets) ? json.assets.find((a) => a?.name === name) : null;
    if (!asset?.browser_download_url)
        return null;
    const digest = String(asset.digest || '');
    const tag = String(json?.tag_name || '');
    const version = tag.match(/(\d+\.\d+\.\d+(?:[-.][\w.]+)?)$/)?.[1] || null;
    return {
        url: String(asset.browser_download_url),
        sha256: /^sha256:[0-9a-f]{64}$/i.test(digest) ? digest.slice(7).toLowerCase() : null,
        version,
        size: Number(asset.size) || null,
    };
}
function readManagedCodex(root) {
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
/** zip 안의 entrypoint 는 압축을 푼 폴더 밖을 가리키면 안 된다 */
function resolveEntrypoint(dir, arch) {
    let entry = codexAssetName(arch).replace(/\.zip$/, '');
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'codex-package.json'), 'utf8'));
        if (typeof pkg?.entrypoint === 'string' && pkg.entrypoint.trim())
            entry = pkg.entrypoint.trim();
    }
    catch { /* 옛 zip 에는 codex-package.json 이 없을 수 있다 */ }
    const resolved = path.resolve(dir, entry);
    if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
        throw new Error('Codex 패키지 정보가 올바르지 않습니다(실행 파일 경로).');
    }
    return resolved;
}
function readPackageVersion(dir) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'codex-package.json'), 'utf8'));
        return typeof pkg?.version === 'string' && pkg.version.trim() ? pkg.version.trim() : null;
    }
    catch {
        return null;
    }
}
async function fetchRelease(deps, arch) {
    try {
        const res = await deps.fetch(exports.CODEX_RELEASE_API, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'LEADERNAM-Orbit' },
        });
        if (!res.ok)
            return null;
        return pickCodexRelease(await res.json(), arch);
    }
    catch {
        return null;
    }
}
async function downloadTo(deps, info, dest, onProgress) {
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), STALL_MS);
    const rearm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => controller.abort(), STALL_MS);
    };
    const hash = crypto.createHash('sha256');
    const out = fs.createWriteStream(dest);
    try {
        const res = await deps.fetch(info.url, { signal: controller.signal, redirect: 'follow' });
        if (!res.ok || !res.body)
            throw new Error(`다운로드 서버 응답 ${res.status}`);
        const total = Number(res.headers.get('content-length')) || info.size || 0;
        const reader = res.body.getReader();
        let received = 0;
        let lastPercent = -1;
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            rearm();
            const chunk = Buffer.from(value);
            hash.update(chunk);
            received += chunk.length;
            if (!out.write(chunk))
                await new Promise((resolve) => out.once('drain', () => resolve()));
            const percent = total ? Math.min(99, Math.floor((received / total) * 100)) : -1;
            if (percent !== lastPercent) {
                lastPercent = percent;
                const mb = (received / 1048576).toFixed(0);
                const totalMb = total ? ` / ${(total / 1048576).toFixed(0)}MB` : 'MB';
                onProgress({ stage: 'download', percent: percent >= 0 ? percent : undefined, message: `내려받는 중 ${mb}${totalMb}` });
            }
        }
    }
    catch (error) {
        if (controller.signal.aborted)
            throw new Error('인터넷 연결이 멈춰 다운로드가 끊겼습니다. 연결을 확인한 뒤 다시 눌러주세요.');
        throw error;
    }
    finally {
        clearTimeout(timer);
        await new Promise((resolve) => out.end(() => resolve()));
    }
    return hash.digest('hex');
}
function removeQuietly(target) {
    try {
        fs.rmSync(target, { recursive: true, force: true });
    }
    catch { /* 쓰는 중이면 다음 설치 때 지운다 */ }
}
/** 지금 쓰는 버전 폴더만 남기고 예전 버전·남은 임시 파일을 지운다(앱이 만든 폴더만) */
function pruneOldVersions(root, keepDir) {
    let entries = [];
    try {
        entries = fs.readdirSync(root);
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry === 'current.json' || entry === path.basename(keepDir))
            continue;
        removeQuietly(path.join(root, entry));
    }
}
async function installCodexPortable(options) {
    const { root, arch, deps } = options;
    const log = [];
    const progress = (p) => {
        if (p.stage !== 'download')
            log.push(`▶ ${p.message}`);
        try {
            options.onProgress?.(p);
        }
        catch { /* 화면 갱신 실패가 설치를 막지 않는다 */ }
    };
    progress({ stage: 'check', message: 'OpenAI 공식 Codex 최신판을 확인합니다.' });
    const release = (await fetchRelease(deps, arch)) || {
        url: `${exports.CODEX_LATEST_DOWNLOAD}${codexAssetName(arch)}`,
        sha256: null,
        version: null,
        size: null,
    };
    if (!release.sha256)
        log.push('· 최신판 정보를 못 받아 공식 최신 주소에서 바로 받습니다(무결성 값 대조 생략).');
    const current = readManagedCodex(root);
    if (current && release.version && current.version === release.version && await deps.runVersion(current.exe)) {
        progress({ stage: 'done', percent: 100, message: `이미 최신 Codex(${current.version})가 설치되어 있습니다.` });
        return { ok: true, skipped: true, version: current.version, exe: current.exe, log };
    }
    const stamp = Date.now();
    const zipPath = path.join(root, `download-${stamp}.zip`);
    // 푼 폴더를 그대로 쓴다 — 갓 푼 exe 는 백신이 잠깐 잡고 있어 폴더 이름 바꾸기(rename)가 실패할 수 있다
    const installDir = path.join(root, `codex-${stamp}`);
    let installed = false;
    try {
        fs.mkdirSync(root, { recursive: true });
        progress({ stage: 'download', percent: 0, message: `Codex${release.version ? ` ${release.version}` : ''} 내려받기를 시작합니다(약 160MB).` });
        const sha256 = await downloadTo(deps, release, zipPath, progress);
        progress({ stage: 'verify', message: '내려받은 파일이 공식 파일과 같은지 확인합니다.' });
        if (release.sha256 && sha256 !== release.sha256) {
            throw new Error('내려받은 파일이 공식 파일과 다릅니다(무결성 불일치). 다시 눌러주세요.');
        }
        progress({ stage: 'extract', message: '압축을 풉니다.' });
        fs.mkdirSync(installDir, { recursive: true });
        await deps.extractZip(zipPath, installDir);
        progress({ stage: 'test', message: '이 PC 에서 실행되는지 확인합니다.' });
        const exe = resolveEntrypoint(installDir, arch);
        if (!fs.existsSync(exe))
            throw new Error('압축 안에서 Codex 실행 파일을 찾지 못했습니다.');
        const versionText = await deps.runVersion(exe);
        if (!versionText)
            throw new Error('내려받은 Codex 가 이 PC 에서 실행되지 않았습니다. 백신 프로그램이 막았는지 확인해주세요.');
        const version = readPackageVersion(installDir) || release.version || versionText.match(/\d+\.\d+\.\d+/)?.[0] || `build-${stamp}`;
        fs.writeFileSync(path.join(root, 'current.json'), JSON.stringify({ version, exe, installedAt: new Date().toISOString() }, null, 2), 'utf8');
        installed = true;
        pruneOldVersions(root, installDir);
        progress({ stage: 'done', percent: 100, message: `Codex ${version} 설치를 마쳤습니다.` });
        return { ok: true, version, exe, log };
    }
    catch (error) {
        const message = error?.message || String(error || '알 수 없는 오류');
        log.push(`· 직접 내려받기 실패: ${message}`);
        return { ok: false, error: message, log };
    }
    finally {
        removeQuietly(zipPath);
        if (!installed)
            removeQuietly(installDir);
    }
}
/** 실제 PC 용 의존성 — 윈도우 기본 tar.exe(10 1803+)로 풀고, 없으면 PowerShell Expand-Archive */
function createDefaultPortableDeps(fetchImpl) {
    const { execFile } = require('child_process');
    const run = (command, args, timeout) => new Promise((resolve) => {
        execFile(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
            resolve({ ok: !error, stdout: String(stdout || '') });
        });
    });
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    return {
        fetch: fetchImpl,
        extractZip: async (zipPath, destDir) => {
            const tar = path.join(systemRoot, 'System32', 'tar.exe');
            if (fs.existsSync(tar) && (await run(tar, ['-xf', zipPath, '-C', destDir], 10 * 60000)).ok)
                return;
            const ps = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
            const quote = (value) => `'${value.replace(/'/g, "''")}'`;
            const result = await run(ps, [
                '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                `Expand-Archive -LiteralPath ${quote(zipPath)} -DestinationPath ${quote(destDir)} -Force`,
            ], 15 * 60000);
            if (!result.ok)
                throw new Error('압축을 풀지 못했습니다. 디스크 여유 공간(1GB 이상)을 확인해주세요.');
        },
        runVersion: async (exe) => {
            const result = await run(exe, ['--version'], 60000);
            return result.ok && result.stdout.trim() ? result.stdout.trim() : null;
        },
    };
}
