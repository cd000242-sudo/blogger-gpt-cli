// src/core/codex-image/codexImageRuntime.ts
// What the Codex image engine needs from the Electron main process: where the codex executable is, which
// environment to run it in, and whether this PC is connected. main.ts registers the real one at start-up
// (it owns the managed/portable Codex lookup and the login-state checks); the defaults below keep CLI use and
// tests working without Electron.

import { CodexImageError } from './codexImageErrors';

export interface CodexImageRuntime {
  /** Path (or bare name) of the codex executable. */
  resolveCommand(): string;
  /** Environment for the codex process. It must NOT set CODEX_HOME for the PC login (the CLI then uses ~/.codex). */
  buildEnv(): NodeJS.ProcessEnv;
  /** Throws a CodexImageError (Korean message) when Codex is missing, outdated, logged out or out of quota. */
  assertReady(): Promise<void>;
}

// Subscription runs must never be billed to an API key that happens to be in the environment.
const API_KEY_VARIABLES = ['CODEX_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];

export function subscriptionEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const name of API_KEY_VARIABLES) delete env[name];
  return env;
}

const defaultRuntime: CodexImageRuntime = {
  resolveCommand: () => 'codex',
  buildEnv: () => subscriptionEnv(),
  assertReady: async () => { /* without Electron the first session reports a missing install / login itself */ },
};

let registered: CodexImageRuntime | null = null;

/** main.ts registers its runtime here once; pass null to go back to the defaults (tests). */
export function setCodexImageRuntime(runtime: CodexImageRuntime | null): void {
  registered = runtime;
}

export function getCodexImageRuntime(): CodexImageRuntime {
  return registered ?? defaultRuntime;
}

export function isCodexImageError(error: unknown): error is CodexImageError {
  return error instanceof CodexImageError;
}
