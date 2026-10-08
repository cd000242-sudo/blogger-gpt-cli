/**
 * v3.8.755 — npm 이 없는 PC 에서 "Codex 설치하기" 가 깨진 글자로 실패하던 것
 *
 * 사용자 PC 실측(2026-10-08): 설치 버튼이 `cmd /c npm install -g @openai/codex` 만 돌렸다.
 *   Node.js 가 없어 cmd 가 CP949 오류("'npm'은(는) 내부 또는 외부 명령 …")를 냈고,
 *   앱은 그것을 UTF-8 로 읽어 화면에 깨진 글자만 보였다. 설치가 안 됐으니 auth.json 도 없었다.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  buildCodexWindowsInstallScript,
  CODEX_WINGET_ID,
  decodeInstallOutput,
  encodePowerShellCommand,
  explainCodexInstallOutput,
  getWingetCodexCandidates,
} from '../electron/agent-install';
import { braceBlock } from './helpers/source-block';

const REPO = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(REPO, 'electron', 'main.ts'), 'utf8');

/** 한국어 윈도우 cmd 가 실제로 내는 바이트: "'npm'은(는) 내부 또는 외부 명령" (CP949) */
const CP949_NPM_NOT_FOUND = Buffer.from([
  0x27, 0x6e, 0x70, 0x6d, 0x27, 0xc0, 0xba, 0x28, 0xb4, 0xc2, 0x29, 0x20, 0xb3, 0xbb, 0xba, 0xce, 0x20,
  0xb6, 0xc7, 0xb4, 0xc2, 0x20, 0xbf, 0xdc, 0xba, 0xce, 0x20, 0xb8, 0xed, 0xb7, 0xc9,
]);

describe('v3.8.755 Codex 설치 — 출력 디코딩', () => {
  test('CP949 오류 문구를 한글로 읽는다 (예전에는 깨진 글자)', () => {
    expect(CP949_NPM_NOT_FOUND.toString('utf8')).toContain('\uFFFD');
    expect(decodeInstallOutput(CP949_NPM_NOT_FOUND)).toBe("'npm'은(는) 내부 또는 외부 명령");
  });

  test('UTF-8 출력은 그대로 둔다', () => {
    const text = 'added 1 package · 설치 완료';
    expect(decodeInstallOutput(Buffer.from(text, 'utf8'))).toBe(text);
  });
});

describe('v3.8.755 Codex 설치 — 스크립트', () => {
  const script = buildCodexWindowsInstallScript();

  test('npm 이 있으면 npm 이 먼저, 없거나 실패하면 winget 공식 패키지', () => {
    const npmAt = script.indexOf('npm install -g @openai/codex');
    const wingetAt = script.indexOf(`winget install --id ${CODEX_WINGET_ID} -e`);
    expect(npmAt).toBeGreaterThan(-1);
    expect(wingetAt).toBeGreaterThan(npmAt);
    expect(CODEX_WINGET_ID).toBe('OpenAI.Codex');
    expect(script).toContain('--accept-source-agreements --accept-package-agreements');
  });

  test('스크립트는 ASCII 만 — 한글은 콘솔 인코딩에 따라 깨진다', () => {
    expect(/^[\x00-\x7F]*$/.test(script)).toBe(true);
  });

  test('EncodedCommand 는 UTF-16LE base64 로 왕복된다', () => {
    const encoded = encodePowerShellCommand(script);
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(script);
  });

  (process.platform === 'win32' ? test : test.skip)(
    '실제 PowerShell — npm·winget 둘 다 없는 PATH 에서 표식을 찍고 실패 코드로 끝난다',
    () => {
      const systemRoot = process.env.SystemRoot || 'C:\\Windows';
      const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const result = spawnSync(
        powershell,
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShellCommand(script)],
        { env: { SystemRoot: systemRoot, PATH: path.join(systemRoot, 'System32') }, windowsHide: true, timeout: 60_000 },
      );
      const output = decodeInstallOutput(Buffer.concat([result.stdout, result.stderr]));
      expect(result.status).toBe(1);
      expect(output).toContain('ORBIT_NO_NPM');
      expect(output).toContain('ORBIT_NO_WINGET');

      const explained = explainCodexInstallOutput(output);
      expect(explained).toContain('npm(Node.js)이 없습니다');
      expect(explained).toContain('winget 도 없습니다');
      expect(explained).toContain('https://nodejs.org');
      expect(explained).not.toContain('ORBIT_');
    },
    90_000,
  );
});

describe('v3.8.755 Codex 설치 — 안내 문구', () => {
  test('npm 이 없고 winget 으로 설치되면 해결 안내는 붙이지 않는다', () => {
    const explained = explainCodexInstallOutput('ORBIT_NO_NPM\nORBIT_STEP_WINGET\nSuccessfully installed');
    expect(explained).toContain('winget(윈도우 기본 설치 도구)으로 설치합니다');
    expect(explained).toContain('OpenAI 공식 Codex(OpenAI.Codex)');
    expect(explained).toContain('Successfully installed');
    expect(explained).not.toContain('nodejs.org');
  });

  test('npm 실패 코드와 winget 실패 코드를 그대로 보여준다', () => {
    const explained = explainCodexInstallOutput('ORBIT_NPM_FAILED 1\nORBIT_WINGET_FAILED -1978335212');
    expect(explained).toContain('npm 설치가 실패했습니다(코드 1)');
    expect(explained).toContain('winget 설치도 실패했습니다(코드 -1978335212)');
  });
});

describe('v3.8.755 winget 설치 위치 감지', () => {
  const env = { LOCALAPPDATA: 'C:\\Users\\free1\\AppData\\Local', ProgramFiles: 'C:\\Program Files' } as NodeJS.ProcessEnv;
  const listDir = (dir: string): string[] => {
    if (dir === 'C:\\Users\\free1\\AppData\\Local\\Microsoft\\WinGet\\Packages') {
      return ['OpenAI.Codex_Microsoft.Winget.Source_8wekyb3d8bbwe', 'BurntSushi.ripgrep.MSVC_Microsoft.Winget.Source_8wekyb3d8bbwe'];
    }
    throw new Error('ENOENT');
  };

  test('실제 exe(Packages)를 링크(Links)보다 앞에 두고, 다른 패키지는 고르지 않는다', () => {
    const candidates = getWingetCodexCandidates(env, 'x64', listDir);
    expect(candidates[0]).toBe(
      'C:\\Users\\free1\\AppData\\Local\\Microsoft\\WinGet\\Packages\\OpenAI.Codex_Microsoft.Winget.Source_8wekyb3d8bbwe\\codex-x86_64-pc-windows-msvc.exe',
    );
    expect(candidates).toContain('C:\\Users\\free1\\AppData\\Local\\Microsoft\\WinGet\\Links\\codex.exe');
    expect(candidates).toContain('C:\\Program Files\\WinGet\\Links\\codex.exe');
    expect(candidates.some((c) => c.includes('ripgrep'))).toBe(false);
  });

  test('arm64 는 aarch64 exe', () => {
    expect(getWingetCodexCandidates(env, 'arm64', listDir)[0]).toMatch(/codex-aarch64-pc-windows-msvc\.exe$/);
  });
});

/** 반환 타입 주석의 `{` 를 피하려고, 함수 위치부터 본문 안 문장을 경계로 자른다 */
function blockWithin(fnMarker: string, innerMarker: string): string {
  const at = mainSource.indexOf(fnMarker);
  if (at < 0) throw new Error(`소스에서 표식을 찾지 못했습니다: ${fnMarker}`);
  return braceBlock(mainSource.slice(at), innerMarker);
}

describe('v3.8.755 main.ts 배선', () => {
  test('윈도우 Codex 설치는 cmd npm 단독이 아니라 PowerShell 스크립트(npm → winget)', () => {
    const block = blockWithin("const displayCommand = 'npm install -g @openai/codex';", "if (process.platform === 'win32')");
    expect(block).toContain('encodePowerShellCommand(buildCodexWindowsInstallScript())');
    expect(block).toContain('CODEX_INSTALL_DISPLAY_COMMAND');
    expect(block).not.toMatch(/args:\s*\['\/d',\s*'\/c',\s*displayCommand\]/);
  });

  test('설치 출력은 바이트로 모아 디코딩하고 Codex 안내를 붙인다', () => {
    const block = blockWithin('function runInlineAgentInstall(', 'return new Promise((resolve) =>');
    expect(block).toContain('decodeInstallOutput(Buffer.concat(chunks))');
    expect(block).toContain('explainCodexInstallOutput(text)');
    expect(block).toContain('output: readOutput()');
  });

  test('감지 후보에 winget 설치 위치가 들어간다', () => {
    const block = braceBlock(mainSource, 'function getAgentBinaryCandidates(');
    expect(block).toContain('getWingetCodexCandidates(process.env, process.arch');
  });

  test('가져오기 실패 문구는 터미널이 아니라 앱 버튼으로 안내한다', () => {
    const block = blockWithin("ipcMain.handle('agent-mode:import-system-login'", 'if (!fs.existsSync(primary))');
    expect(block).not.toContain('터미널에서 먼저 로그인한 뒤');
    expect(block).toContain('설치하기] → [');
  });
});
