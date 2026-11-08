/**
 * Caches that keep slow, repeated probes off the Electron main process.
 *
 * Why this exists: every status query used to run `npm config get prefix` and `where.exe` with
 * execFileSync, `codex exec --help` with spawnSync (up to 20 s), and walk the whole login folder
 * (~/.claude holds hundreds of session files). Each of those blocks the main process, so every
 * IPC reply (the whole app) waited behind them. Here the answers are remembered for the session
 * (or until the file they describe changes), and the async variants never block.
 *
 * Nothing here starts a process itself: the runners are injected, so it is testable without a CLI.
 */

export interface CommandOutputRunners {
  /** Blocking runner (fallback only). Returns null when the attempt itself failed (timeout, cannot start). */
  runSync(command: string, args: string[], timeoutMs: number): string | null;
  /** Non-blocking runner. Same contract. */
  runAsync(command: string, args: string[], timeoutMs: number): Promise<string | null>;
}

export interface CommandOutputCache {
  getSync(command: string, args: string[], timeoutMs?: number): string;
  getAsync(command: string, args: string[], timeoutMs?: number): Promise<string>;
  clear(): void;
}

const DEFAULT_TIMEOUT_MS = 3000;
const keyOf = (command: string, args: string[]) => [command, ...args].join('\u0000');

/**
 * Remembers command output for the session. A clean "nothing found" ('') is an answer and is kept;
 * a failed attempt (null: timeout, could not start) says nothing and is never kept, so a busy PC
 * cannot pin "binary not found" for the rest of the session.
 */
export function createCommandOutputCache(runners: CommandOutputRunners): CommandOutputCache {
  const values = new Map<string, string>();
  const inFlight = new Map<string, Promise<string>>();

  return {
    getSync(command, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const key = keyOf(command, args);
      const hit = values.get(key);
      if (hit !== undefined) return hit;
      const out = runners.runSync(command, args, timeoutMs);
      if (out === null) return '';
      values.set(key, out);
      return out;
    },
    getAsync(command, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const key = keyOf(command, args);
      const hit = values.get(key);
      if (hit !== undefined) return Promise.resolve(hit);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const started = runners.runAsync(command, args, timeoutMs)
        .then((out) => {
          if (out === null) return '';
          values.set(key, out);
          return out;
        })
        .catch(() => '')
        .finally(() => { inFlight.delete(key); });
      inFlight.set(key, started);
      return started;
    },
    clear() {
      values.clear();
    },
  };
}

export interface AsyncCache<V> {
  peek(key: string): V | undefined;
  /** Runs `produce` once per key (concurrent callers share it). A failed producer is not remembered. */
  ensure(key: string, produce: () => Promise<V>): Promise<V>;
  clear(): void;
}

export function createAsyncCache<V>(): AsyncCache<V> {
  const values = new Map<string, V>();
  const inFlight = new Map<string, Promise<V>>();
  return {
    peek: (key) => values.get(key),
    ensure(key, produce) {
      if (values.has(key)) return Promise.resolve(values.get(key) as V);
      const pending = inFlight.get(key);
      if (pending) return pending;
      const started = produce()
        .then((value) => {
          values.set(key, value);
          return value;
        })
        .finally(() => { inFlight.delete(key); });
      inFlight.set(key, started);
      return started;
    },
    clear() {
      values.clear();
    },
  };
}

/** Recomputes a value only when its stamp changes (for example: the credential file's mtime and size). */
export function createStampedMemo<V>() {
  const entries = new Map<string, { stamp: string; value: V }>();
  return {
    read(key: string, stamp: string, compute: () => V): V {
      const hit = entries.get(key);
      if (hit && hit.stamp === stamp) return hit.value;
      const value = compute();
      entries.set(key, { stamp, value });
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}

/** Identifies one build of a program: its path plus the file's mtime and size (changes when it is updated). */
export function binaryFingerprint(
  file: string,
  stat: (target: string) => { mtimeMs: number; size: number },
): string {
  try {
    const st = stat(file);
    return `${file}|${Math.round(st.mtimeMs)}|${st.size}`;
  } catch {
    return `${file}|missing`;
  }
}
