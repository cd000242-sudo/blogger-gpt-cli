/**
 * v3.8.758 — 윈도우에서 Codex 가 지시서도 못 읽고 파일도 못 쓰던 것
 *
 * 실측(2026-10-09, Codex 0.162 · 윈도우):
 *   --sandbox workspace-write → 읽기 전용으로 떨어져 Get-Content 도 "Rejected", result/ 파일 생성 실패
 *   --approve-for-me          → 같은 조건에서 result/hello.html 생성 성공 (사장님이 이 방식 승인)
 *   두 플래그를 같이 주면     → "the argument '--sandbox' cannot be used with '--approve-for-me'"
 * 예전 Codex 에 없는 플래그를 주면 실행이 죽으므로 `exec --help` 에 있을 때만 쓴다.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { codexSandboxArgs, helpMentionsApproveForMe } from '../electron/agent-install';

const mainTs = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');

describe('v3.8.758 Codex 실행 권한', () => {
  test('윈도우 + 지원 → --approve-for-me 하나만(--sandbox 와 같이 주지 않는다)', () => {
    expect(codexSandboxArgs('win32', true)).toEqual(['--approve-for-me']);
  });

  test('윈도우인데 예전 Codex(미지원) → 예전 방식 그대로', () => {
    expect(codexSandboxArgs('win32', false)).toEqual(['--sandbox', 'workspace-write']);
  });

  test('맥·리눅스는 샌드박스가 제대로 돌아 그대로 둔다', () => {
    expect(codexSandboxArgs('darwin', true)).toEqual(['--sandbox', 'workspace-write']);
    expect(codexSandboxArgs('linux', true)).toEqual(['--sandbox', 'workspace-write']);
  });

  test('도움말에서 플래그를 알아본다 — 설명 문장 속 낱말이 아니라 옵션 줄', () => {
    expect(helpMentionsApproveForMe('Options:\n      --approve-for-me\n          Route approval requests')).toBe(true);
    expect(helpMentionsApproveForMe('Options:\n  -s, --sandbox <SANDBOX_MODE>')).toBe(false);
    expect(helpMentionsApproveForMe('')).toBe(false);
  });

  test('main.ts: 실행 인자를 이 함수로 만들고, 지원 여부를 실제 실행 파일에 묻는다', () => {
    expect(mainTs).toContain('...codexSandboxArgs(process.platform, process.platform === \'win32\' && codexSupportsApproveForMe(codexCommand)),');
    expect(mainTs).toContain("spawnSync(command, ['exec', '--help']");
    expect(mainTs).toContain('codexApproveForMeCache.clear();');
  });

  // 이 PC 에 npm Codex 가 있으면 실제 도움말로 판정이 맞는지 본다(없으면 건너뜀)
  const npmCodex = path.join(process.env['APPDATA'] || '', 'npm', 'node_modules', '@openai', 'codex', 'node_modules', '@openai',
    'codex-win32-x64', 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
  (process.platform === 'win32' && fs.existsSync(npmCodex) ? test : test.skip)('실제 Codex 도움말로 판정한다', () => {
    const r = spawnSync(npmCodex, ['exec', '--help'], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    expect(helpMentionsApproveForMe(`${r.stdout}${r.stderr}`)).toBe(true);
  });
});
