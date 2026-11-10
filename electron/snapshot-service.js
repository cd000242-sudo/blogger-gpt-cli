"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackupAsync = createBackupAsync;
/**
 * Settings / source backup that never blocks the Electron main process.
 *
 * Why this exists: the `create-backup` IPC handler copied `src/core` and `electron/ui` with
 * copyFileSync inside the handler. In a dev run that is 500+ files; the main process stood still for
 * ~470 ms on a fast PC (seconds with a virus scanner), at every start and every 30 minutes, and all IPC
 * replies of the app waited behind it. The same copy on the async fs API lets the event loop keep turning.
 *
 * Layout and retention are unchanged: <userData>/backups/backup_YYYYMMDD_HHMMSS/{.env, src_core, electron_ui,
 * backup_info.json}; backup_ folders older than 30 days are removed.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fsp = fs.promises;
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
async function exists(p) {
    try {
        await fsp.access(p);
        return true;
    }
    catch {
        return false;
    }
}
function timestampOf(now) {
    const two = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}`;
}
async function removeExpiredBackups(backupDir, maxAgeMs) {
    try {
        const nowTime = Date.now();
        for (const name of await fsp.readdir(backupDir)) {
            if (!name.startsWith('backup_'))
                continue;
            const full = path.join(backupDir, name);
            const stat = await fsp.stat(full);
            if (stat.isDirectory() && nowTime - stat.mtimeMs > maxAgeMs) {
                await fsp.rm(full, { recursive: true, force: true });
                console.log(`[BACKUP] 🗑️ 오래된 백업 삭제: ${name}`);
            }
        }
    }
    catch (err) {
        console.warn('[BACKUP] 오래된 백업 정리 실패:', err);
    }
}
async function createBackupAsync(opts) {
    const backupDir = path.join(opts.userDataPath, 'backups');
    const backupPath = path.join(backupDir, `backup_${timestampOf(opts.now ?? new Date())}`);
    await fsp.mkdir(backupPath, { recursive: true });
    const candidates = [
        { source: path.join(opts.userDataPath, '.env'), target: path.join(backupPath, '.env') },
        { source: path.join(opts.sourceRoot, 'src', 'core'), target: path.join(backupPath, 'src_core') },
        { source: path.join(opts.sourceRoot, 'electron', 'ui'), target: path.join(backupPath, 'electron_ui') },
    ];
    const items = [];
    for (const item of candidates) {
        if (await exists(item.source))
            items.push(item);
    }
    for (const item of items) {
        try {
            await fsp.cp(item.source, item.target, { recursive: true });
            console.log(`[BACKUP] ✅ 백업 완료: ${item.source} -> ${item.target}`);
        }
        catch (err) {
            console.error(`[BACKUP] ⚠️ 백업 실패: ${item.source}`, err);
        }
    }
    const info = {
        timestamp: new Date().toISOString(),
        items: items.map((i) => ({ source: i.source, target: i.target })),
        version: opts.version,
    };
    await fsp.writeFile(path.join(backupPath, 'backup_info.json'), JSON.stringify(info, null, 2), 'utf-8');
    await removeExpiredBackups(backupDir, opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS);
    console.log(`[BACKUP] ✅ 백업 생성 완료: ${backupPath}`);
    return { ok: true, success: true, path: backupPath, backupPath };
}
