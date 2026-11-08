/**
 * Stage 2 - speed. The status query used to block the Electron main process (every IPC reply waited):
 * `npm config get prefix` + `where.exe` via execFileSync, `codex exec --help` via spawnSync (up to 20 s)
 * after every cache reset, and a depth-5 walk of the whole login folder (~/.claude has hundreds of files).
 * These caches keep the answers; no process is started here (runners are injected).
 */
import {
  binaryFingerprint,
  createAsyncCache,
  createCommandOutputCache,
  createStampedMemo,
} from '../electron/agent-probe-cache';
import { agentCredentialFileName } from '../electron/agent-login-verdict';

function runners(syncOut: string | null = 'C:\\npm', asyncOut: string | null = 'C:\\npm') {
  return {
    runSync: jest.fn((_c: string, _a: string[], _t: number) => syncOut),
    runAsync: jest.fn(async (_c: string, _a: string[], _t: number) => asyncOut),
  };
}

describe('createCommandOutputCache', () => {
  test('the blocking runner runs once per command for the whole session', () => {
    const r = runners();
    const cache = createCommandOutputCache(r);
    expect(cache.getSync('npm', ['config', 'get', 'prefix'])).toBe('C:\\npm');
    expect(cache.getSync('npm', ['config', 'get', 'prefix'])).toBe('C:\\npm');
    expect(r.runSync).toHaveBeenCalledTimes(1);
    cache.getSync('where.exe', ['claude']);
    expect(r.runSync).toHaveBeenCalledTimes(2);
  });

  test('an async lookup primes the cache: the later sync caller never blocks', async () => {
    const r = runners();
    const cache = createCommandOutputCache(r);
    await cache.getAsync('where.exe', ['claude']);
    expect(cache.getSync('where.exe', ['claude'])).toBe('C:\\npm');
    expect(r.runSync).not.toHaveBeenCalled();
  });

  test('the async path never calls the blocking runner', async () => {
    const r = runners();
    const cache = createCommandOutputCache(r);
    await cache.getAsync('npm', ['config', 'get', 'prefix']);
    expect(r.runSync).not.toHaveBeenCalled();
  });

  test('concurrent async callers share one process', async () => {
    const r = runners();
    const cache = createCommandOutputCache(r);
    await Promise.all([cache.getAsync('where.exe', ['codex']), cache.getAsync('where.exe', ['codex']), cache.getAsync('where.exe', ['codex'])]);
    expect(r.runAsync).toHaveBeenCalledTimes(1);
  });

  test('a clean "nothing found" is an answer and is kept', async () => {
    const r = runners('', '');
    const cache = createCommandOutputCache(r);
    expect(cache.getSync('where.exe', ['gemini'])).toBe('');
    expect(cache.getSync('where.exe', ['gemini'])).toBe('');
    expect(r.runSync).toHaveBeenCalledTimes(1);
    await cache.getAsync('where.exe', ['other']);
    await cache.getAsync('where.exe', ['other']);
    expect(r.runAsync).toHaveBeenCalledTimes(1);
  });

  test('a failed attempt (timeout, cannot start) is NOT kept - a busy PC must not pin "not found"', async () => {
    const r = runners(null, null);
    const cache = createCommandOutputCache(r);
    expect(cache.getSync('where.exe', ['claude'])).toBe('');
    expect(cache.getSync('where.exe', ['claude'])).toBe('');
    expect(r.runSync).toHaveBeenCalledTimes(2);
    await cache.getAsync('where.exe', ['claude']);
    await cache.getAsync('where.exe', ['claude']);
    expect(r.runAsync).toHaveBeenCalledTimes(2);
  });

  test('a runner that throws is treated as a failed attempt', async () => {
    const cache = createCommandOutputCache({
      runSync: () => null,
      runAsync: async () => { throw new Error('boom'); },
    });
    await expect(cache.getAsync('npm', ['x'])).resolves.toBe('');
  });

  test('clear() makes the next lookup run again (after an install or login)', () => {
    const r = runners();
    const cache = createCommandOutputCache(r);
    cache.getSync('where.exe', ['claude']);
    cache.clear();
    cache.getSync('where.exe', ['claude']);
    expect(r.runSync).toHaveBeenCalledTimes(2);
  });
});

describe('createAsyncCache - one probe per program build', () => {
  test('ensure runs the producer once, even for concurrent callers, and peek then answers at once', async () => {
    const cache = createAsyncCache<boolean>();
    const produce = jest.fn(async () => true);
    expect(cache.peek('codex|1|2')).toBeUndefined();
    const [a, b] = await Promise.all([cache.ensure('codex|1|2', produce), cache.ensure('codex|1|2', produce)]);
    expect([a, b]).toEqual([true, true]);
    expect(produce).toHaveBeenCalledTimes(1);
    expect(cache.peek('codex|1|2')).toBe(true);
    await cache.ensure('codex|1|2', produce);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  test('a new program build (new key) is probed again', async () => {
    const cache = createAsyncCache<boolean>();
    const produce = jest.fn(async () => false);
    await cache.ensure('codex|1|2', produce);
    await cache.ensure('codex|9|2', produce);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  test('a failed producer is not remembered', async () => {
    const cache = createAsyncCache<boolean>();
    const produce = jest.fn()
      .mockRejectedValueOnce(new Error('spawn failed'))
      .mockResolvedValueOnce(true);
    await expect(cache.ensure('k', produce)).rejects.toThrow('spawn failed');
    await expect(cache.ensure('k', produce)).resolves.toBe(true);
    expect(produce).toHaveBeenCalledTimes(2);
  });
});

describe('binaryFingerprint', () => {
  const stat = (mtimeMs: number, size = 10) => () => ({ mtimeMs, size });
  test('same file, same build -> same key; an update (mtime or size) -> new key', () => {
    expect(binaryFingerprint('C:\\codex.exe', stat(1000))).toBe(binaryFingerprint('C:\\codex.exe', stat(1000)));
    expect(binaryFingerprint('C:\\codex.exe', stat(2000))).not.toBe(binaryFingerprint('C:\\codex.exe', stat(1000)));
    expect(binaryFingerprint('C:\\codex.exe', stat(1000, 11))).not.toBe(binaryFingerprint('C:\\codex.exe', stat(1000)));
  });
  test('a missing file still gives a stable key', () => {
    const missing = () => { throw new Error('ENOENT'); };
    expect(binaryFingerprint('C:\\gone.exe', missing)).toBe('C:\\gone.exe|missing');
  });
});

describe('createStampedMemo - recompute only when the file changed', () => {
  test('same stamp -> one computation; new stamp -> recomputed', () => {
    const memo = createStampedMemo<string>();
    const compute = jest.fn(() => 'a@b.c');
    expect(memo.read('p1', 'auth.json:1:50', compute)).toBe('a@b.c');
    expect(memo.read('p1', 'auth.json:1:50', compute)).toBe('a@b.c');
    expect(compute).toHaveBeenCalledTimes(1);
    memo.read('p1', 'auth.json:2:50', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
  test('profiles do not share entries', () => {
    const memo = createStampedMemo<number>();
    const compute = jest.fn(() => 1);
    memo.read('p1', 's', compute);
    memo.read('p2', 's', compute);
    expect(compute).toHaveBeenCalledTimes(2);
  });
});

describe('agentCredentialFileName', () => {
  test('claude and codex have one known login file; others fall back to scanning', () => {
    expect(agentCredentialFileName('claude')).toBe('.credentials.json');
    expect(agentCredentialFileName('codex')).toBe('auth.json');
    expect(agentCredentialFileName('gemini')).toBeNull();
  });
});
