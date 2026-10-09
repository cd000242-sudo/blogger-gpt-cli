import * as path from 'path';

/**
 * 🧰 v3.8.755 — Codex 설치: npm 이 없는 PC 에서도 설치되게 한다.
 *
 * 사용자 PC 실측(2026-10-08): "Codex 설치하기" 가 `cmd /c npm install -g @openai/codex` 만 돌렸다.
 *   Node.js 가 없는 PC 라 cmd 가 "'npm'은(는) 내부 또는 외부 명령 … 이 아닙니다" 를 냈고,
 *   그 CP949 문구를 UTF-8 로 읽어 화면에는 깨진 글자만 떴다. 설치가 안 됐으니 auth.json 도 없었다.
 *
 * 그래서
 *   1) npm 이 있으면 예전처럼 npm 으로 설치한다(기존 사용자 동작 그대로).
 *   2) npm 이 없거나 실패하면 winget 의 OpenAI 공식 패키지(OpenAI.Codex)로 설치한다.
 *      winget 매니페스트 실측: zip 안의 portable exe, 명령 별칭 `codex`.
 *   3) 출력은 UTF-8 로 읽되 깨지면 CP949(euc-kr)로 다시 읽는다.
 *   스크립트에는 한글을 넣지 않고 ASCII 표식만 찍는다 — 설명은 Node 쪽에서 붙인다.
 */

export const CODEX_WINGET_ID = 'OpenAI.Codex';

const WINGET_FLAGS = `--id ${CODEX_WINGET_ID} -e --source winget --accept-source-agreements --accept-package-agreements`;

export const CODEX_INSTALL_DISPLAY_COMMAND = `npm install -g @openai/codex (npm 이 없으면 winget install ${CODEX_WINGET_ID})`;

export function buildCodexWindowsInstallScript(): string {
  return [
    '$ErrorActionPreference = "Continue"',
    '$ProgressPreference = "SilentlyContinue"',
    '$done = $false',
    'if (Get-Command npm -ErrorAction SilentlyContinue) {',
    '  Write-Output "ORBIT_STEP_NPM"',
    '  npm install -g @openai/codex',
    '  if ($LASTEXITCODE -eq 0) { $done = $true } else { Write-Output "ORBIT_NPM_FAILED $LASTEXITCODE" }',
    '} else { Write-Output "ORBIT_NO_NPM" }',
    'if (-not $done) {',
    '  if (Get-Command winget -ErrorAction SilentlyContinue) {',
    '    Write-Output "ORBIT_STEP_WINGET"',
    `    winget install ${WINGET_FLAGS}`,
    '    if ($LASTEXITCODE -eq 0) { $done = $true } else {',
    `      winget upgrade ${WINGET_FLAGS}`,
    '      if ($LASTEXITCODE -eq 0) { $done = $true } else { Write-Output "ORBIT_WINGET_FAILED $LASTEXITCODE" }',
    '    }',
    '  } else { Write-Output "ORBIT_NO_WINGET" }',
    '}',
    'if ($done) { exit 0 } else { exit 1 }',
  ].join('\n');
}

/** PowerShell -EncodedCommand 는 UTF-16LE base64 — 따옴표·줄바꿈 이스케이프를 피한다 */
export function encodePowerShellCommand(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/** UTF-8 로 읽어 깨진 글자(U+FFFD)가 나오면 한국어 윈도우 콘솔 인코딩(CP949)으로 다시 읽는다 */
export function decodeInstallOutput(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  if (!utf8.includes('�')) return utf8;
  try {
    return new TextDecoder('euc-kr').decode(buffer);
  } catch {
    return utf8;
  }
}

const MARKER_TEXT: Array<[RegExp, string]> = [
  [/^ORBIT_STEP_NPM$/, '▶ npm 으로 Codex 를 설치합니다.'],
  [/^ORBIT_NO_NPM$/, '· 이 PC 에는 npm(Node.js)이 없습니다. winget(윈도우 기본 설치 도구)으로 설치합니다.'],
  [/^ORBIT_NPM_FAILED (-?\d+)$/, '· npm 설치가 실패했습니다(코드 $1). winget 으로 다시 시도합니다.'],
  [/^ORBIT_STEP_WINGET$/, `▶ winget 으로 OpenAI 공식 Codex(${CODEX_WINGET_ID})를 설치합니다.`],
  [/^ORBIT_WINGET_FAILED (-?\d+)$/, '· winget 설치도 실패했습니다(코드 $1).'],
  [/^ORBIT_NO_WINGET$/, '· 이 PC 에는 winget 도 없습니다.'],
];

/** 표식 줄을 한국어 안내로 바꾸고, 둘 다 없을 때 할 일을 맨 끝에 붙인다 */
export function explainCodexInstallOutput(output: string): string {
  const lines = String(output || '').split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    for (const [pattern, text] of MARKER_TEXT) {
      if (pattern.test(trimmed)) return trimmed.replace(pattern, text);
    }
    return line;
  });
  const text = lines.join('\n').trim();
  if (/ORBIT_NO_NPM/.test(output) && /ORBIT_NO_WINGET/.test(output)) {
    return `${text}\n\n해결: https://nodejs.org 에서 Node.js LTS 를 설치한 뒤 앱을 다시 켜고 "Codex 설치하기" 를 눌러 주세요.`;
  }
  return text;
}

/**
 * 🛡️ v3.8.758 — 윈도우 Codex 실행 권한.
 *
 * 실측(2026-10-09, Codex 0.162): 윈도우에서 `--sandbox workspace-write` 가 **읽기 전용**으로 떨어진다.
 *   Codex 가 instructions.md 를 읽는 명령(Get-Content)조차 "Rejected" 되고, result/article.html 도 못 쓴다
 *   → 작성자 요청·품질 규칙이 담긴 지시서 없이 글을 쓰고, 이미지 지시(metadata.json)도 못 만든다.
 *   `--approve-for-me`(자동 검토)로 띄우면 같은 조건에서 파일 쓰기가 됐다. 사장님이 이 방식을 골랐다.
 *   (이 플래그는 --sandbox 와 같이 못 쓴다 — 실측 오류 "cannot be used with '--approve-for-me'")
 * 예전 Codex 에 없는 플래그를 주면 실행 자체가 죽으므로, `exec --help` 에 있을 때만 쓴다.
 */
export function codexSandboxArgs(platform: string, supportsApproveForMe: boolean): string[] {
  return platform === 'win32' && supportsApproveForMe ? ['--approve-for-me'] : ['--sandbox', 'workspace-write'];
}

export function helpMentionsApproveForMe(helpText: string): boolean {
  return /(^|\s)--approve-for-me\b/m.test(String(helpText || ''));
}

type DirLister = (dir: string) => string[];

/**
 * winget portable 설치 위치 — 앱이 켜진 뒤 설치되면 PATH 가 갱신되지 않아 where.exe 로는 못 찾는다.
 * 실제 exe(Packages)를 링크(Links)보다 앞에 둔다: codex 는 옆에 있는 codex-command-runner.exe 를 찾는다.
 */
export function getWingetCodexCandidates(
  env: NodeJS.ProcessEnv,
  arch: string,
  listDir: DirLister,
): string[] {
  const exeName = arch === 'arm64' ? 'codex-aarch64-pc-windows-msvc.exe' : 'codex-x86_64-pc-windows-msvc.exe';
  const roots = [
    env.LOCALAPPDATA ? path.win32.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet') : '',
    env.ProgramFiles ? path.win32.join(env.ProgramFiles, 'WinGet') : '',
  ].filter(Boolean);

  const candidates: string[] = [];
  for (const root of roots) {
    const packagesDir = path.win32.join(root, 'Packages');
    let entries: string[] = [];
    try {
      entries = listDir(packagesDir);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (entry.toLowerCase().startsWith(`${CODEX_WINGET_ID.toLowerCase()}_`)) {
        candidates.push(path.win32.join(packagesDir, entry, exeName));
      }
    }
    candidates.push(path.win32.join(root, 'Links', 'codex.exe'));
  }
  return candidates;
}
