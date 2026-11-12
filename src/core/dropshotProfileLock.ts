/**
 * Dropshot browser-profile ownership helpers (v3.8.773).
 *
 * The Dropshot profile (~/.blogger-gpt/dropshot-profile) can be owned by one Chrome at a time. When the login window is
 * already open, a second Chrome hands about:blank to it and exits with code 0 at once. Retrying on other engines/channels
 * only adds blank tabs, and the raw launch log (pid, argument list, garbled Korean) must never reach the screen.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const DROPSHOT_LOGIN_BUSY_MESSAGE = '드롭샷 로그인이 이미 진행 중입니다. 열려 있는 로그인 창에서 로그인을 마쳐 주세요.';
export const DROPSHOT_PROFILE_IN_USE_MESSAGE = '드롭샷용 브라우저가 이미 열려 있습니다. 열려 있는 창에서 로그인을 마치거나 창을 닫은 뒤 다시 시도해 주세요.';
export const DROPSHOT_LOGIN_CLOSED_MESSAGE = '드롭샷 로그인 창이 닫혔습니다. 로그인을 마치지 못했다면 [로그인]을 다시 눌러 주세요.';

/** Thrown when the profile is owned by another browser; the message is already safe to show. */
export class DropshotProfileInUseError extends Error {
  constructor(message: string = DROPSHOT_PROFILE_IN_USE_MESSAGE) {
    super(message);
    this.name = 'DropshotProfileInUseError';
  }
}

const PROFILE_IN_USE_PATTERNS: RegExp[] = [
  /ProcessSingleton|SingletonLock|SingletonSocket|SingletonCookie/i,
  /user data directory[^\n]*(?:already\s+)?in use/i,
  /profile(?: directory)?[^\n]*(?:in use|locked)/i,
  /Opening in existing browser session/i,
  /기존\s*브라우저\s*세션/,
];
// Chrome prints its hand-off line in the OS code page (garbled on Korean Windows), so the reliable signal is
// "the process was launched and exited with code 0 right away".
const HANDED_OFF_AND_EXITED = /<launched>[\s\S]*<process did exit:\s*exitCode=0\b/;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message || '';
  return String(error ?? '');
}

/** True when the launch failed because another browser already owns the profile. */
export function isDropshotProfileInUseError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'DropshotProfileInUseError') return true;
  const text = errorText(error);
  if (!text) return false;
  return PROFILE_IN_USE_PATTERNS.some((pattern) => pattern.test(text)) || HANDED_OFF_AND_EXITED.test(text);
}

/** One short line for the screen: first line of the error, no paths, no launch log. */
export function summarizeDropshotLaunchError(error: unknown): string {
  const first = errorText(error).split('\n').map((line) => line.trim()).find(Boolean) || 'unknown';
  return first.replace(/[A-Za-z]:\\\S+/g, '...').replace(/\s+/g, ' ').slice(0, 100);
}

/** Message for a failed Dropshot call: lock errors are shown as they are, anything else gets the "예외:" prefix. */
export function dropshotFailureMessage(error: unknown): string {
  if (isDropshotProfileInUseError(error)) {
    return error instanceof Error && error.name === 'DropshotProfileInUseError'
      ? error.message
      : DROPSHOT_PROFILE_IN_USE_MESSAGE;
  }
  return `예외: ${errorText(error) || String(error)}`;
}

/** Runs one job at a time; while it runs, further calls get the busy answer instead of starting another run. */
export function createSingleFlight<T>() {
  let running: Promise<T> | null = null;
  return {
    isRunning: (): boolean => running !== null,
    run(work: () => Promise<T>, onBusy: () => T | Promise<T>): Promise<T> {
      if (running) return Promise.resolve(onBusy());
      const current: Promise<T> = work().finally(() => {
        if (running === current) running = null;
      });
      running = current;
      return current;
    },
  };
}

/**
 * Is the profile owned by a running browser? Read from disk, because the launch error of a second Chromium carries no
 * lock wording at all (real capture 2026-11-12: only "Target page, context or browser has been closed" + <launched> + exitCode=21).
 * Windows: Chromium keeps <profile>\lockfile open while it runs (open r+ -> EBUSY, measured) and removes it on exit.
 * POSIX: SingletonLock is a symlink "host-pid"; it counts only while that pid is alive.
 */
export function isDropshotProfileLockHeld(profileDir: string, platform: NodeJS.Platform = process.platform): boolean {
  if (platform === 'win32') {
    const lock = path.join(profileDir, 'lockfile');
    if (!fs.existsSync(lock)) return false;
    try {
      fs.closeSync(fs.openSync(lock, 'r+'));
      return false;
    } catch (error: any) {
      return error?.code === 'EBUSY' || error?.code === 'EPERM' || error?.code === 'EACCES';
    }
  }
  try {
    const target = fs.readlinkSync(path.join(profileDir, 'SingletonLock'));
    const pid = Number(String(target).split('-').pop());
    if (!(pid > 0)) return false;
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === 'EPERM';
  }
}

/** Same check with a short grace window: a browser we just closed may still be releasing the lock. */
export async function isDropshotProfileOwnedByRunningBrowser(profileDir: string, tries = 3, delayMs = 400): Promise<boolean> {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (!isDropshotProfileLockHeld(profileDir)) return false;
    if (attempt < tries - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return true;
}
