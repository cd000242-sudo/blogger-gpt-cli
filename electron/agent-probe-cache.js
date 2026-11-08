"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommandOutputCache = createCommandOutputCache;
exports.createAsyncCache = createAsyncCache;
exports.createStampedMemo = createStampedMemo;
exports.binaryFingerprint = binaryFingerprint;
const DEFAULT_TIMEOUT_MS = 3000;
const keyOf = (command, args) => [command, ...args].join('\u0000');
/**
 * Remembers command output for the session. A clean "nothing found" ('') is an answer and is kept;
 * a failed attempt (null: timeout, could not start) says nothing and is never kept, so a busy PC
 * cannot pin "binary not found" for the rest of the session.
 */
function createCommandOutputCache(runners) {
    const values = new Map();
    const inFlight = new Map();
    return {
        getSync(command, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
            const key = keyOf(command, args);
            const hit = values.get(key);
            if (hit !== undefined)
                return hit;
            const out = runners.runSync(command, args, timeoutMs);
            if (out === null)
                return '';
            values.set(key, out);
            return out;
        },
        getAsync(command, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
            const key = keyOf(command, args);
            const hit = values.get(key);
            if (hit !== undefined)
                return Promise.resolve(hit);
            const pending = inFlight.get(key);
            if (pending)
                return pending;
            const started = runners.runAsync(command, args, timeoutMs)
                .then((out) => {
                if (out === null)
                    return '';
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
function createAsyncCache() {
    const values = new Map();
    const inFlight = new Map();
    return {
        peek: (key) => values.get(key),
        ensure(key, produce) {
            if (values.has(key))
                return Promise.resolve(values.get(key));
            const pending = inFlight.get(key);
            if (pending)
                return pending;
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
function createStampedMemo() {
    const entries = new Map();
    return {
        read(key, stamp, compute) {
            const hit = entries.get(key);
            if (hit && hit.stamp === stamp)
                return hit.value;
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
function binaryFingerprint(file, stat) {
    try {
        const st = stat(file);
        return `${file}|${Math.round(st.mtimeMs)}|${st.size}`;
    }
    catch {
        return `${file}|missing`;
    }
}
