// src/core/codex-image/codexImageEngine.ts
// The 'codex-image' engine ("Codex 구독 이미지"): draws with the image_gen tool of the user's ChatGPT subscription
// through the Codex CLI. No API billing; it spends the subscription's usage window.
//
// - One `codex exec` session draws exactly ONE image; up to CODEX_IMAGE_CONCURRENCY sessions run at the same time.
//   A session's file comes from its own generated_images/<thread id>/ folder, so a result belongs to its slot by
//   construction (it never depends on the order in which sessions finish).
// - A slot that gets no image is an explicit failure. No other engine fills it and nothing is retried silently
//   (the subscription limit is the user's; a retry would spend it again). The dispatcher enforces the same rule.
// - A PC-level failure (limit reached, logged out, CLI missing...) is the same for every session: slots that were
//   already waiting when it happened fail with it at once instead of each starting a doomed session.

import { readFile } from 'fs/promises';
import { extname } from 'path';
import { ACCOUNT_LEVEL_CODES, CodexImageError } from './codexImageErrors';
import { withCodexAspectRatio, DEFAULT_CODEX_IMAGE_RATIO } from './codexImageInstruction';
import { fitCodexImageToRatio } from './codexImageFrame';
import { getCodexImageRuntime } from './codexImageRuntime';
import { runCodexImageSession, type CodexImageSessionDeps, type CodexImageSessionOptions, type CodexImageSessionResult } from './codexImageSession';
import { spawnCodex } from './codexImageSpawn';

/** How many single-image sessions run at the same time. */
export const CODEX_IMAGE_CONCURRENCY = 4;
const READY_TTL_MS = 60_000;

export interface CodexImageOutcome { ok: boolean; dataUrl: string; model?: string; error?: string }

export interface CodexImageOptions {
  aspectRatio?: string | undefined;
  onLog?: ((message: string) => void) | undefined;
  signal?: AbortSignal | undefined;
}

export interface CodexImageEngineDeps {
  runSession(prompt: string, options: CodexImageSessionOptions): Promise<CodexImageSessionResult>;
  assertReady(): Promise<void>;
  readFile(path: string): Promise<Buffer>;
  now(): number;
  isCanceled(): boolean;
  cancelSignal(): AbortSignal | undefined;
}

function sessionDeps(): CodexImageSessionDeps {
  const runtime = getCodexImageRuntime();
  return { spawn: spawnCodex, command: () => runtime.resolveCommand(), env: () => runtime.buildEnv(), now: () => Date.now() };
}

function defaultDeps(): CodexImageEngineDeps {
  return {
    runSession: (prompt, options) => runCodexImageSession(prompt, sessionDeps(), options),
    assertReady: () => getCodexImageRuntime().assertReady(),
    readFile: (path) => readFile(path),
    now: () => Date.now(),
    isCanceled: () => { try { return require('../cancel-token').isCanceled() === true; } catch { return false; } },
    cancelSignal: () => { try { return require('../cancel-token').getCancelSignal() ?? undefined; } catch { return undefined; } },
  };
}

// ── shared state (one Codex login per PC) ──
let running = 0;
const waiting: Array<() => void> = [];
let readyUntil = 0;
let readyInFlight: Promise<void> | null = null;
let accountFailure: { at: number; error: CodexImageError } | null = null;

/** Tests start from a clean slate. */
export function resetCodexImageEngineState(): void {
  running = 0;
  waiting.length = 0;
  readyUntil = 0;
  readyInFlight = null;
  accountFailure = null;
}

/** The readiness check succeeded elsewhere (settings screen): forget an old PC-level failure and the cached verdict. */
export function clearCodexImageFailure(): void {
  accountFailure = null;
  readyUntil = 0;
}

async function acquireSlot(): Promise<void> {
  if (running < CODEX_IMAGE_CONCURRENCY) { running += 1; return; }
  await new Promise<void>((resolve) => waiting.push(resolve));
}

function releaseSlot(): void {
  const next = waiting.shift();
  if (next) next(); // the slot is handed over, `running` stays the same
  else running -= 1;
}

async function ensureReady(deps: CodexImageEngineDeps): Promise<void> {
  if (readyUntil > deps.now()) return;
  if (!readyInFlight) {
    readyInFlight = deps.assertReady()
      .then(() => { readyUntil = deps.now() + READY_TTL_MS; })
      .finally(() => { readyInFlight = null; });
  }
  await readyInFlight;
}

function mimeOf(path: string): string {
  const ext = extname(path).slice(1).toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
}

function failure(error: unknown): CodexImageOutcome {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, dataUrl: '', error: message };
}

export async function makeCodexImage(
  prompt: string,
  options: CodexImageOptions = {},
  overrides: Partial<CodexImageEngineDeps> = {},
): Promise<CodexImageOutcome> {
  const deps: CodexImageEngineDeps = { ...defaultDeps(), ...overrides };
  const enqueuedAt = deps.now();
  const ratio = options.aspectRatio || DEFAULT_CODEX_IMAGE_RATIO;
  if (deps.isCanceled()) return { ok: false, dataUrl: '', error: 'CANCELED_BY_USER' };

  await acquireSlot();
  try {
    if (deps.isCanceled()) return { ok: false, dataUrl: '', error: 'CANCELED_BY_USER' };
    // A PC-level failure that happened while this slot was waiting: fail with it, start nothing.
    if (accountFailure && accountFailure.at >= enqueuedAt) return failure(accountFailure.error);

    try {
      await ensureReady(deps);
      const result = await deps.runSession(withCodexAspectRatio(prompt, ratio), { signal: options.signal ?? deps.cancelSignal() });
      const file = result.files[result.files.length - 1] as string;
      const fitted = await fitCodexImageToRatio(await deps.readFile(file), ratio);
      if (fitted.cropped) options.onLog?.(`📐 Codex 이미지 ${fitted.from} → ${fitted.to} (${ratio}, 가운데 기준 자르기)`);
      return { ok: true, dataUrl: `data:${mimeOf(file)};base64,${fitted.buffer.toString('base64')}`, model: result.model };
    } catch (error) {
      if (error instanceof CodexImageError && ACCOUNT_LEVEL_CODES.has(error.code)) {
        accountFailure = { at: deps.now(), error };
        readyUntil = 0;
      }
      if (error instanceof CodexImageError && error.code === 'aborted') return { ok: false, dataUrl: '', error: 'CANCELED_BY_USER' };
      return failure(error);
    }
  } finally {
    releaseSlot();
  }
}
