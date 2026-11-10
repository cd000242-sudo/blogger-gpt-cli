/**
 * Genspark research timing record.
 * The app only prints research progress to the console, so after a slow run nothing was left to measure.
 * One JSON line per run: numbers and an error code only - no keyword, no job id, no account data.
 * Never throws: a log failure must not touch the publishing flow.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export function gensparkTimingLogPath(): string {
  return path.join(os.homedir(), '.blogger-gpt', 'genspark-timing.jsonl');
}

export function appendGensparkTimingLog(entry: Record<string, unknown>, file: string = gensparkTimingLogPath()): void {
  try {
    const { timings, ...rest } = entry as { timings?: Record<string, unknown> } & Record<string, unknown>;
    const row = { at: new Date().toISOString(), ...rest, ...(timings || {}) };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    /* a timing record is optional */
  }
}
