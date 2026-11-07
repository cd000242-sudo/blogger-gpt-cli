// src/core/codex-image/codexImageSpawn.ts
// Spawns the codex executable, writes the instruction to stdin and collects the output. Same Windows rule as the
// text agent (main.ts runAgentProcess): npm shims (.cmd / no extension) need a shell, a real .exe does not.

import { spawn, execFile } from 'child_process';
import { extname } from 'path';
import type { CodexSpawnRequest, CodexSpawnResult } from './codexImageSession';

const quoteCmdArg = (value: string): string => `"${String(value).replace(/"/g, '""')}"`;

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true }, () => { /* already gone is fine */ });
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
  }
}

export function spawnCodex(request: CodexSpawnRequest): Promise<CodexSpawnResult> {
  return new Promise((resolve) => {
    const useShell = process.platform === 'win32' && (!extname(request.command) || /\.(cmd|bat)$/i.test(request.command));
    const command = useShell ? [request.command, ...request.args].map(quoteCmdArg).join(' ') : request.command;
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const child = spawn(command, useShell ? [] : request.args, {
      cwd: request.cwd,
      env: request.env,
      shell: useShell,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const finish = (result: Omit<CodexSpawnResult, 'stdout' | 'stderr' | 'timedOut' | 'aborted'>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
      resolve({ stdout, stderr, timedOut, aborted, ...result });
    };

    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, request.timeoutMs);
    const onAbort = (): void => { aborted = true; killTree(child.pid); };
    if (request.signal?.aborted) onAbort();
    else request.signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout?.on('data', (chunk: Buffer | string) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk: Buffer | string) => { stderr += String(chunk); });
    child.on('error', (error: Error) => finish({ code: null, spawnError: error.message }));
    child.on('close', (code: number | null) => finish({ code }));
    child.stdin?.on('error', () => { /* the process may exit before reading stdin */ });
    child.stdin?.end(request.stdin);
  });
}
