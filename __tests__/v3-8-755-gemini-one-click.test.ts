/**
 * v3.8.755 — Gemini CLI 원클릭 설치 + "Gemini 설치하기" 가 Codex 를 깔던 것
 *
 * 실측: 설치 함수에 claude 갈래만 있어 gemini 가 codex(npm install -g @openai/codex)로 빠졌다.
 * Gemini CLI 는 의존성 0개 번들이라 Node 20+ 만 있으면 된다 → 공식 번들 + 공식 node.exe 를 같이 받는다.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { PortableDeps } from '../electron/codex-portable';
import {
  GEMINI_CMD,
  installGeminiPortable,
  nodeExeRelPath,
  pickGeminiRelease,
  pickNodeSha,
  readManagedGemini,
} from '../electron/gemini-portable';

const REPO = path.resolve(__dirname, '..');
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

const NODE_BYTES = Buffer.from('fake node.exe');
const ZIP_BYTES = Buffer.from('fake gemini bundle zip');

function response(body: Buffer | string | object, status = 200): Response {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return new Response(bytes, { status, headers: { 'content-length': String(bytes.length) } });
}

function fakeDeps(opts: { nodeSha?: string; zipDigest?: string } = {}) {
  const calls = { nodeDownloads: 0, zipDownloads: 0, runs: [] as string[] };
  const deps: PortableDeps = {
    fetch: async (url: string) => {
      if (url === 'https://nodejs.org/dist/index.json') {
        return response([{ version: 'v24.21.0', lts: 'Krypton' }, { version: 'v25.0.0', lts: false }]);
      }
      if (url.endsWith('/SHASUMS256.txt')) {
        return response(`${'0'.repeat(64)}  win-x64/node.lib\n${opts.nodeSha || sha(NODE_BYTES)}  win-x64/node.exe\n`);
      }
      if (url === 'https://nodejs.org/dist/v24.21.0/win-x64/node.exe') {
        calls.nodeDownloads += 1;
        return response(NODE_BYTES);
      }
      if (url.startsWith('https://api.github.com/')) {
        return response({
          tag_name: 'v0.63.0',
          assets: [{ name: 'gemini-cli-bundle.zip', browser_download_url: 'https://example.test/g.zip', size: ZIP_BYTES.length, digest: opts.zipDigest || `sha256:${sha(ZIP_BYTES)}` }],
        });
      }
      calls.zipDownloads += 1;
      return response(ZIP_BYTES);
    },
    extractZip: async (_zip, dest) => {
      fs.writeFileSync(path.join(dest, 'gemini.js'), '// bundle');
    },
    runVersion: async (exe, args) => {
      calls.runs.push([path.basename(exe), ...(args || []).map((a) => path.basename(a))].join(' '));
      return args?.[1] === '--version' ? '0.63.0' : 'v24.21.0';
    },
  };
  return { deps, calls };
}

let toolsRoot: string;
beforeEach(() => { toolsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-gemini-')); });
afterEach(() => { fs.rmSync(toolsRoot, { recursive: true, force: true }); });

describe('v3.8.755 Gemini — 공식 정보 고르기', () => {
  test('SHASUMS256.txt 에서 이 PC 용 node.exe 줄만 고른다', () => {
    const text = `${'a'.repeat(64)}  win-x64/node.lib\n${'b'.repeat(64)}  win-x64/node.exe\n${'c'.repeat(64)}  win-arm64/node.exe`;
    expect(pickNodeSha(text, nodeExeRelPath('x64'))).toBe('b'.repeat(64));
    expect(pickNodeSha(text, nodeExeRelPath('arm64'))).toBe('c'.repeat(64));
    expect(pickNodeSha('nothing', 'win-x64/node.exe')).toBeNull();
  });

  test('릴리스에서 번들 zip·sha256·버전을 고른다', () => {
    const picked = pickGeminiRelease({ tag_name: 'v0.63.0', assets: [{ name: 'gemini-cli-bundle.zip', browser_download_url: 'u', size: 3, digest: `sha256:${'d'.repeat(64)}` }] });
    expect(picked).toEqual({ url: 'u', sha256: 'd'.repeat(64), version: '0.63.0', size: 3 });
  });

  test('gemini.cmd 는 ASCII 이고 %~dp0 상대 경로만 쓴다(한글 사용자 폴더에서도 깨지지 않게)', () => {
    expect(/^[\x00-\x7F]*$/.test(GEMINI_CMD)).toBe(true);
    expect(GEMINI_CMD).toContain('"%~dp0node.exe" "%~dp0bundle\\gemini.js" %*');
    expect(GEMINI_CMD).not.toMatch(/[A-Z]:\\/);
  });
});

describe('v3.8.755 Gemini — 설치 흐름', () => {
  test('node.exe 대조 → 번들 대조 → 풀기 → 실행 확인 → current.json', async () => {
    const { deps, calls } = fakeDeps();
    const result = await installGeminiPortable({ toolsRoot, arch: 'x64', deps });
    expect(result.ok).toBe(true);
    expect(result.version).toBe('0.63.0');
    const dir = path.dirname(result.exe!);
    expect(path.basename(result.exe!)).toBe('gemini.cmd');
    expect(fs.readFileSync(result.exe!, 'ascii')).toBe(GEMINI_CMD);
    expect(fs.readFileSync(path.join(dir, 'node.exe'))).toEqual(NODE_BYTES);
    expect(fs.existsSync(path.join(dir, 'bundle', 'gemini.js'))).toBe(true);
    expect(readManagedGemini(path.join(toolsRoot, 'gemini'))).toEqual({ version: '0.63.0', exe: result.exe });
    expect(calls.runs).toContain('node.exe gemini.js --version');
  });

  test('같은 버전이 이미 있으면 아무것도 다시 받지 않는다', async () => {
    await installGeminiPortable({ toolsRoot, arch: 'x64', deps: fakeDeps().deps });
    const again = fakeDeps();
    const result = await installGeminiPortable({ toolsRoot, arch: 'x64', deps: again.deps });
    expect(result.skipped).toBe(true);
    expect(again.calls.nodeDownloads + again.calls.zipDownloads).toBe(0);
  });

  test('Gemini 만 새 판이면 node.exe 는 다시 받지 않는다', async () => {
    await installGeminiPortable({ toolsRoot, arch: 'x64', deps: fakeDeps().deps });
    fs.writeFileSync(path.join(toolsRoot, 'gemini', 'current.json'), JSON.stringify({ version: '0.62.0', exe: readManagedGemini(path.join(toolsRoot, 'gemini'))!.exe }));
    const again = fakeDeps();
    const result = await installGeminiPortable({ toolsRoot, arch: 'x64', deps: again.deps });
    expect(result.ok).toBe(true);
    expect(again.calls.nodeDownloads).toBe(0);
    expect(again.calls.zipDownloads).toBe(1);
    expect(fs.readdirSync(path.join(toolsRoot, 'gemini')).filter((n) => n.startsWith('gemini-'))).toHaveLength(1);
  });

  test('node.exe 가 공식 값과 다르면 지우고 실패한다', async () => {
    const { deps } = fakeDeps({ nodeSha: 'e'.repeat(64) });
    const result = await installGeminiPortable({ toolsRoot, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Node.js 가 공식 파일과 다릅니다');
    expect(fs.existsSync(path.join(toolsRoot, 'node', 'v24.21.0', 'node.exe'))).toBe(false);
  });

  test('번들이 공식 값과 다르면 설치하지 않는다', async () => {
    const { deps } = fakeDeps({ zipDigest: `sha256:${'f'.repeat(64)}` });
    const result = await installGeminiPortable({ toolsRoot, arch: 'x64', deps });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Gemini CLI 가 공식 파일과 다릅니다');
    expect(readManagedGemini(path.join(toolsRoot, 'gemini'))).toBeNull();
  });
});

describe('v3.8.755 Gemini — 배선', () => {
  const main = fs.readFileSync(path.join(REPO, 'electron', 'main.ts'), 'utf8');
  const between = (from: string, to: string) => {
    const at = main.indexOf(from);
    if (at < 0) throw new Error(`표식 없음: ${from}`);
    const end = main.indexOf(to, at);
    if (end < 0) throw new Error(`표식 없음: ${to}`);
    return main.slice(at, end);
  };

  test('예전 설치 길에도 gemini 갈래가 있다 — Codex 로 빠지지 않는다', () => {
    const body = between('function buildInlineAgentInstallProcess(', "const displayCommand = 'npm install -g @openai/codex';");
    expect(body).toContain("if (provider === 'gemini')");
    expect(body).toContain('npm install -g @google/gemini-cli');
  });

  test('원클릭 설치가 gemini 를 공식 번들 설치로 보낸다', () => {
    const body = between('async function installAgentForThisPc(', 'function runInlineAgentInstall(');
    expect(body).toContain("provider === 'gemini'");
    expect(body).toContain('installGeminiPortable(');
    expect(body).not.toContain("provider !== 'codex') return runInlineAgentInstall");
  });

  test('실행 확인 제한 시간 — Gemini 30초(번들 --version 만 3초대), 나머지 15초', () => {
    const body = between('function testAgentBinary(', 'async function detectAgentBinary(');
    expect(body).toContain("const timeout = binaryName === 'gemini' ? 30_000 : 15_000;");
    expect(body).not.toMatch(/timeout:\s*5000/);
  });

  test('앱이 받아 둔 gemini.cmd 가 감지 후보 맨 앞', () => {
    const body = between('function getAgentBinaryCandidates(', 'process.env.npm_config_prefix');
    expect(body).toContain("readManagedGemini(path.join(toolsRoot(), 'gemini'))");
  });
});
