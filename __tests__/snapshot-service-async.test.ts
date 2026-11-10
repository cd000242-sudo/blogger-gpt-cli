/**
 * The startup / 30-minute backup used to copy `src/core` and `electron/ui` with copyFileSync inside an IPC
 * handler. Measured on the dev PC: the Electron main process stood still for ~470 ms (511 files) each time,
 * and every IPC reply of the whole app waited behind it. The copy now runs on the async fs API, so the
 * event loop keeps turning while the files move. Same files, same layout, same 30-day cleanup.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createBackupAsync } from '../electron/snapshot-service';

function mk(root: string, rel: string, body = 'x'): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
}

describe('createBackupAsync', () => {
  let tmp: string;
  let userData: string;
  let source: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bln-backup-'));
    userData = path.join(tmp, 'userData');
    source = path.join(tmp, 'app');
    fs.mkdirSync(userData, { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('copies .env, src/core and electron/ui into backup_<timestamp> and writes backup_info.json', async () => {
    mk(userData, '.env', 'KEY=1');
    mk(source, 'src/core/a.ts', 'a');
    mk(source, 'src/core/deep/b.ts', 'b');
    mk(source, 'electron/ui/index.html', '<html/>');

    const r = await createBackupAsync({
      userDataPath: userData,
      sourceRoot: source,
      version: '9.9.9',
      now: new Date(2026, 10, 10, 9, 5, 7),
    });

    expect(r.ok).toBe(true);
    expect(r.backupPath).toBe(path.join(userData, 'backups', 'backup_20261110_090507'));
    expect(fs.readFileSync(path.join(r.backupPath, '.env'), 'utf8')).toBe('KEY=1');
    expect(fs.readFileSync(path.join(r.backupPath, 'src_core', 'deep', 'b.ts'), 'utf8')).toBe('b');
    expect(fs.readFileSync(path.join(r.backupPath, 'electron_ui', 'index.html'), 'utf8')).toBe('<html/>');
    const info = JSON.parse(fs.readFileSync(path.join(r.backupPath, 'backup_info.json'), 'utf8'));
    expect(info.version).toBe('9.9.9');
    expect(info.items.map((i: { target: string }) => path.basename(i.target)).sort()).toEqual(['.env', 'electron_ui', 'src_core']);
  });

  test('skips sources that do not exist (installed build has no src/core) and still succeeds', async () => {
    const r = await createBackupAsync({ userDataPath: userData, sourceRoot: source, version: '1.0.0' });
    expect(r.ok).toBe(true);
    const info = JSON.parse(fs.readFileSync(path.join(r.backupPath, 'backup_info.json'), 'utf8'));
    expect(info.items).toEqual([]);
  });

  test('keeps the event loop turning while it copies (no long synchronous block)', async () => {
    for (let i = 0; i < 300; i++) mk(source, `src/core/f${i}.ts`, 'y'.repeat(2000));
    let ticks = 0;
    const timer = setInterval(() => { ticks += 1; }, 1);
    try {
      await createBackupAsync({ userDataPath: userData, sourceRoot: source, version: '1.0.0' });
    } finally {
      clearInterval(timer);
    }
    // A synchronous copy never lets a timer fire before it returns (ticks === 0).
    expect(ticks).toBeGreaterThanOrEqual(3);
  });

  test('removes backup_ folders older than 30 days, keeps recent ones and unrelated folders', async () => {
    const backups = path.join(userData, 'backups');
    mk(backups, 'backup_20200101_000000/old.txt');
    mk(backups, 'backup_20261101_000000/new.txt');
    mk(backups, 'notes/keep.txt');
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(backups, 'backup_20200101_000000'), old, old);

    await createBackupAsync({ userDataPath: userData, sourceRoot: source, version: '1.0.0' });

    expect(fs.existsSync(path.join(backups, 'backup_20200101_000000'))).toBe(false);
    expect(fs.existsSync(path.join(backups, 'backup_20261101_000000', 'new.txt'))).toBe(true);
    expect(fs.existsSync(path.join(backups, 'notes', 'keep.txt'))).toBe(true);
  });
});

describe('create-backup IPC handler', () => {
  test('delegates to the async service instead of copying with sync fs calls', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.ts'), 'utf8');
    const start = src.indexOf("ipcMain.handle('create-backup'");
    expect(start).toBeGreaterThan(-1);
    const end = src.indexOf('\n});', start);
    const handler = src.slice(start, end);
    expect(handler).toContain('createBackupAsync');
    expect(handler).not.toMatch(/copyFileSync|copyRecursive|readdirSync|rmSync|statSync/);
  });
});
