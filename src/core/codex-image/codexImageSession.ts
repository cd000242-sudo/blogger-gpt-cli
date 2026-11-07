// src/core/codex-image/codexImageSession.ts
// One `codex exec` run that draws ONE image through the image_gen tool of the user's ChatGPT subscription.
//   codex exec --skip-git-repo-check --ignore-user-config -m <model> -c model_reasoning_effort=low --json -C <tmp>
//   (instruction on stdin)
// The PC's own login folder (~/.codex, or %CODEX_HOME% when the user set it) is used as it is: the app never copies
// auth files. The file appears in <codex home>/generated_images/<thread id>/; the thread id comes from `thread.started`.

import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildCodexImageInstruction } from './codexImageInstruction';
import { extractCodexErrorText, listGeneratedImages, parseCodexThreadId, resolveCodexHome } from './codexImageFiles';
import { buildCodexImageFailure, classifyCodexImageFailure, CodexImageError } from './codexImageErrors';

export interface CodexSpawnRequest {
  command: string;
  args: string[];
  cwd: string;
  stdin: string;
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  signal?: AbortSignal | undefined;
}

export interface CodexSpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  aborted: boolean;
  spawnError?: string | undefined;
}

export interface CodexImageSessionDeps {
  spawn(request: CodexSpawnRequest): Promise<CodexSpawnResult>;
  command(): string;
  env(): NodeJS.ProcessEnv;
  now(): number;
}

export interface CodexImageSessionOptions {
  /** A named model wins over the engine default. */
  model?: string | undefined;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface CodexImageSessionResult { threadId: string; files: string[]; model: string }

/** Measured on the Naver app: gpt-6-luna with low reasoning draws one image in 35-56s. */
export const CODEX_IMAGE_DEFAULT_MODEL = 'gpt-6-luna';
export const CODEX_IMAGE_EFFORT = 'low';
export const CODEX_IMAGE_TIMEOUT_MS = 210_000;
// Clock skew between this process and the file system timestamps.
const FILE_TIME_SLACK_MS = 2_000;

export function resolveCodexImageModel(named?: string): string {
  return String(named || process.env['LEADERNAM_CODEX_IMAGE_MODEL'] || '').trim() || CODEX_IMAGE_DEFAULT_MODEL;
}

const tail = (text: string): string => (text.length > 800 ? text.slice(-800) : text);

export async function runCodexImageSession(
  prompt: string,
  deps: CodexImageSessionDeps,
  options: CodexImageSessionOptions = {},
): Promise<CodexImageSessionResult> {
  const model = resolveCodexImageModel(options.model);
  // Throws on an empty prompt before any work folder exists.
  const instruction = buildCodexImageInstruction(prompt);
  const env = deps.env();
  const startedAt = deps.now();
  const cwd = await mkdtemp(join(tmpdir(), 'orbit-codex-image-'));
  try {
    const args = ['exec', '--skip-git-repo-check', '--ignore-user-config', '-m', model,
      '-c', `model_reasoning_effort=${CODEX_IMAGE_EFFORT}`, '--json', '-C', cwd];
    const res = await deps.spawn({
      command: deps.command(), args, cwd, stdin: instruction, env,
      timeoutMs: options.timeoutMs ?? CODEX_IMAGE_TIMEOUT_MS, signal: options.signal,
    });
    if (res.aborted) throw buildCodexImageFailure('aborted', '');
    if (res.timedOut) throw buildCodexImageFailure('timeout', tail(res.stderr));
    if (res.spawnError) {
      const kind = classifyCodexImageFailure(res.spawnError);
      throw buildCodexImageFailure(kind === 'not_installed' ? 'not_installed' : 'nonzero_exit', res.spawnError);
    }

    const errorText = extractCodexErrorText(res.stdout);
    if (res.code !== 0) {
      const detail = tail(res.stderr || errorText || '');
      throw buildCodexImageFailure(classifyCodexImageFailure(`${res.stderr}\n${errorText}`), detail, model);
    }

    const threadId = parseCodexThreadId(res.stdout);
    const files = threadId
      ? await listGeneratedImages(join(resolveCodexHome(env), 'generated_images', threadId), startedAt - FILE_TIME_SLACK_MS)
      : [];
    if (files.length === 0 && errorText) {
      throw buildCodexImageFailure(classifyCodexImageFailure(errorText), tail(errorText), model);
    }
    if (!threadId) {
      throw new CodexImageError(
        'empty_output',
        'Codex 구독 이미지: 실행 결과에서 thread id 를 읽지 못해 이미지 폴더를 찾을 수 없습니다. 다른 이미지 엔진으로 바꾸지 않았고 같은 요청은 다시 보내지 않았습니다.',
        tail(res.stdout),
      );
    }
    if (files.length === 0) throw buildCodexImageFailure('empty_output', tail(res.stdout));
    return { threadId, files, model };
  } finally {
    await rm(cwd, { recursive: true, force: true }).catch(() => { /* best-effort cleanup */ });
  }
}
