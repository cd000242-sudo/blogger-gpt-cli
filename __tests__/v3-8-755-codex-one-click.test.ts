/**
 * v3.8.755 — Codex 원클릭 설치(윈도우): npm·winget·관리자 권한 없이 공식 실행 파일을 직접 받는다
 *
 * 사장님 지시(2026-10-08): "개발자가 아닌 일반인·시니어층도 원클릭으로 다 되게".
 * 실측(rust-v0.161.0): 공식 zip 의 본체 exe 는 런타임 DLL 을 부르지 않아 압축만 풀면 돈다.
 */
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  codexAssetName,
  createDefaultPortableDeps,
  getCodexToolsRoot,
  installCodexPortable,
  pickCodexRelease,
  readManagedCodex,
  type CodexInstallProgress,
  type PortableDeps,
} from '../electron/codex-portable';

const REPO = path.resolve(__dirname, '..');
const read = (...p: string[]) => fs.readFileSync(path.join(REPO, ...p), 'utf8');

const ZIP_BYTES = Buffer.from('fake zip bytes for codex');
const ZIP_SHA = crypto.createHash('sha256').update(ZIP_BYTES).digest('hex');

function releaseJson(digest = `sha256:${ZIP_SHA}`) {
  return {
    tag_name: 'rust-v0.161.0',
    assets: [
      { name: 'codex-aarch64-pc-windows-msvc.exe.zip', browser_download_url: 'https://example.test/arm.zip', size: 1, digest: 'sha256:' + 'a'.repeat(64) },
      { name: 'codex-x86_64-pc-windows-msvc.exe.zip', browser_download_url: 'https://example.test/x64.zip', size: ZIP_BYTES.length, digest },
    ],
  };
}

function response(body: Buffer | object, status = 200): Response {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  return new Response(bytes, { status, headers: { 'content-length': String(bytes.length) } });
}

/** 가짜 의존성: 압축 풀기는 codex-package.json + exe 를 만들어 준다 */
function fakeDeps(overrides: Partial<PortableDeps> & { api?: () => Response; entrypoint?: string } = {}) {
  const calls = { api: 0, download: [] as string[], extract: 0, version: [] as string[] };
  const deps: PortableDeps = {
    fetch: async (url: string) => {
      if (url.startsWith('https://api.github.com/')) {
        calls.api += 1;
        return overrides.api ? overrides.api() : response(releaseJson());
      }
      calls.download.push(url);
      return response(ZIP_BYTES);
    },
    extractZip: async (_zip, dest) => {
      calls.extract += 1;
      const entry = overrides.entrypoint || 'codex-x86_64-pc-windows-msvc.exe';
      fs.writeFileSync(path.join(dest, 'codex-package.json'), JSON.stringify({ version: '0.161.0', entrypoint: entry }));
      fs.writeFileSync(path.join(dest, 'codex-x86_64-pc-windows-msvc.exe'), 'exe');
    },
    runVersion: async (exe) => {
      calls.version.push(exe);
      return 'codex-cli 0.161.0';
    },
    ...overrides,
  };
  return { deps, calls };
}

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-codex-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('v3.8.755 릴리스 정보', () => {
  test('이 PC 아키텍처의 자산과 sha256·버전을 고른다', () => {
    expect(pickCodexRelease(releaseJson(), 'x64')).toEqual({
      url: 'https://example.test/x64.zip', sha256: ZIP_SHA, version: '0.161.0', size: ZIP_BYTES.length,
    });
    expect(pickCodexRelease(releaseJson(), 'arm64')?.url).toBe('https://example.test/arm.zip');
    expect(codexAssetName('arm64')).toBe('codex-aarch64-pc-windows-msvc.exe.zip');
  });

  test('digest 형식이 아니면 대조값을 만들지 않는다', () => {
    expect(pickCodexRelease(releaseJson('md5:abc'), 'x64')?.sha256).toBeNull();
  });

  test('설치 위치는 사용자 로컬 폴더(관리자 권한 불필요)', () => {
    expect(getCodexToolsRoot({ LOCALAPPDATA: 'C:\\Users\\free1\\AppData\\Local' } as NodeJS.ProcessEnv, 'X'))
      .toBe(path.join('C:\\Users\\free1\\AppData\\Local', 'LEADERNAM Orbit', 'tools', 'codex'));
  });
});

describe('v3.8.755 직접 설치 흐름', () => {
  test('받기 → 대조 → 풀기 → 실행 확인 → current.json, 진행률을 알린다', async () => {
    const { deps, calls } = fakeDeps();
    const progress: CodexInstallProgress[] = [];
    const result = await installCodexPortable({ root, arch: 'x64', deps, onProgress: (p) => progress.push(p) });

    expect(result.ok).toBe(true);
    expect(result.version).toBe('0.161.0');
    expect(calls.download).toEqual(['https://example.test/x64.zip']);
    expect(readManagedCodex(root)).toEqual({ version: '0.161.0', exe: result.exe });
    expect(calls.version).toEqual([result.exe]);
    expect(progress.map((p) => p.stage)).toEqual(expect.arrayContaining(['check', 'download', 'verify', 'extract', 'test', 'done']));
    expect(progress.some((p) => p.stage === 'download' && typeof p.percent === 'number' && p.percent > 0)).toBe(true);
    expect(fs.readdirSync(root).filter((n) => n.endsWith('.zip'))).toEqual([]);
  });

  test('이미 같은 버전이 있고 실행되면 다시 받지 않는다', async () => {
    const first = fakeDeps();
    await installCodexPortable({ root, arch: 'x64', deps: first.deps });
    const second = fakeDeps();
    const result = await installCodexPortable({ root, arch: 'x64', deps: second.deps });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(second.calls.download).toEqual([]);
  });

  test('새 버전을 설치하면 예전 버전 폴더를 지운다', async () => {
    const oldDir = path.join(root, 'codex-1');
    fs.mkdirSync(oldDir, { recursive: true });
    fs.writeFileSync(path.join(oldDir, 'codex.exe'), 'old');
    fs.writeFileSync(path.join(root, 'current.json'), JSON.stringify({ version: '0.150.0', exe: path.join(oldDir, 'codex.exe') }));

    const { deps } = fakeDeps();
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(true);
    expect(fs.existsSync(oldDir)).toBe(false);
    expect(readManagedCodex(root)?.version).toBe('0.161.0');
  });

  test('무결성 값이 다르면 설치하지 않고 받은 파일을 치운다', async () => {
    const { deps } = fakeDeps({ api: () => response(releaseJson('sha256:' + 'b'.repeat(64))) });
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('무결성 불일치');
    expect(readManagedCodex(root)).toBeNull();
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test('릴리스 API 가 막히면 공식 최신 다운로드 주소로 받는다(대조 생략을 기록)', async () => {
    const { deps, calls } = fakeDeps({ api: () => response({ message: 'rate limited' }, 403) });
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(true);
    expect(calls.download).toEqual(['https://github.com/openai/codex/releases/latest/download/codex-x86_64-pc-windows-msvc.exe.zip']);
    expect(result.log.join('\n')).toContain('무결성 값 대조 생략');
  });

  test('실행 확인이 안 되면 실패로 돌려주고 반쯤 깔린 폴더를 남기지 않는다', async () => {
    const { deps } = fakeDeps({ runVersion: async () => null });
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('백신');
    expect(fs.readdirSync(root)).toEqual([]);
  });

  test('패키지 정보가 폴더 밖 실행 파일을 가리키면 거절한다', async () => {
    const { deps } = fakeDeps({ entrypoint: '..\\..\\evil.exe' });
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('실행 파일 경로');
  });

  test('다운로드 서버 오류는 한국어로 돌려준다', async () => {
    const { deps } = fakeDeps({
      fetch: async (url: string) => (url.startsWith('https://api.github.com/') ? response(releaseJson()) : response(Buffer.from(''), 503)),
    });
    const result = await installCodexPortable({ root, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('다운로드 서버 응답 503');
  });

  (process.platform === 'win32' ? test : test.skip)('실제 윈도우 tar.exe 로 zip 을 푼다', async () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-zip-src-'));
    try {
      fs.writeFileSync(path.join(src, 'codex-package.json'), JSON.stringify({ version: '9.9.9', entrypoint: 'codex-x86_64-pc-windows-msvc.exe' }));
      fs.writeFileSync(path.join(src, 'codex-x86_64-pc-windows-msvc.exe'), 'exe');
      const zip = path.join(src, 'pkg.zip');
      const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
      execFileSync(tar, ['-a', '-cf', zip, '-C', src, 'codex-package.json', 'codex-x86_64-pc-windows-msvc.exe'], { windowsHide: true });
      const zipBytes = fs.readFileSync(zip);
      const sha = crypto.createHash('sha256').update(zipBytes).digest('hex');

      const real = createDefaultPortableDeps(async (url: string) => (url.startsWith('https://api.github.com/')
        ? response(releaseJson(`sha256:${sha}`))
        : response(zipBytes)));
      const result = await installCodexPortable({
        root, arch: 'x64', deps: { ...real, runVersion: async () => 'codex-cli 9.9.9' },
      });
      expect(result.ok).toBe(true);
      expect(result.version).toBe('9.9.9');
      expect(fs.readFileSync(result.exe!, 'utf8')).toBe('exe');
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  }, 60_000);
});

/** 표식부터 다음 최상위 선언(function / ipcMain.handle)까지 — 길이가 아니라 경계로 자른다 */
function untilNextTopLevel(src: string, marker: string): string {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`소스에서 표식을 찾지 못했습니다: ${marker}`);
  const rest = src.slice(at + marker.length);
  const next = rest.search(/\n(?:async function |function |ipcMain\.handle\()/);
  return marker + (next < 0 ? rest : rest.slice(0, next));
}

describe('v3.8.755 배선 — 원클릭', () => {
  const main = read('electron', 'main.ts');
  const preload = read('electron', 'preload.ts');
  const ui = read('electron', 'ui', 'modules', 'codex-workshop.js');

  test('앱이 받아 둔 Codex 가 감지 후보 맨 앞(npm 보다 먼저)', () => {
    const body = untilNextTopLevel(main, 'function getAgentBinaryCandidates(');
    const managed = body.indexOf('readManagedCodex(codexToolsRoot())');
    expect(managed).toBeGreaterThan(-1);
    expect(managed).toBeLessThan(body.indexOf('process.env.npm_config_prefix'));
  });

  test('설치 버튼과 자동 업데이트가 같은 원클릭 설치를 쓴다', () => {
    expect(untilNextTopLevel(main, "ipcMain.handle('agent-mode:install-tool'")).toContain('installAgentForThisPc(provider,');
    expect(untilNextTopLevel(main, 'async function ensureLatestCodexCliForCompatibility(')).toContain("installAgentForThisPc('codex')");
    const installer = untilNextTopLevel(main, 'async function installAgentForThisPc(');
    expect(installer).toContain('installCodexPortable(');
    expect(installer).toContain('runInlineAgentInstall(provider)');
  });

  test('진행률 채널 이름이 main·preload·UI 에서 같다', () => {
    expect(main).toContain("evt.sender.send('agent-install-progress'");
    expect(preload).toContain("ipcRenderer.on('agent-install-progress', handler)");
    expect(preload).toContain('onAgentInstallProgress: ((listener');
    expect(ui).toContain('api.onAgentInstallProgress(');
  });

  test('설치가 확인되면 로그인 창을 이어서 연다', () => {
    const body = untilNextTopLevel(ui, 'async function installAgentTool(');
    expect(body).toContain("await startAgentLogin(normalizedProvider, '', { skipInstall: true })");
    expect(body).toContain('options.thenLogin !== false');
  });

  test('설치 전에 로그인을 눌러도 설치부터 한다(한 번만 — 무한 반복 금지)', () => {
    const body = untilNextTopLevel(ui, 'async function startAgentLogin(');
    expect(body).toContain('!options.skipInstall');
    expect(body).toContain('installAgentTool(normalizedProvider, null, { thenLogin: false })');
    expect(body).toContain('startAgentLogin(normalizedProvider, profileId, { skipInstall: true })');
  });
});
