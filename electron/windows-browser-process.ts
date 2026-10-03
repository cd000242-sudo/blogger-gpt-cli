import * as path from 'path';

/**
 * Playwright/Patchright and Puppeteer's browser launchers omit windowsHide.
 * chrome-headless-shell.exe can consequently create an empty Windows console,
 * even though Orbit's own AI CLI launches already set windowsHide: true.
 * Their forced browser cleanup also launches `taskkill /pid N /T /F` via cmd.
 * Restrict this compatibility guard to those known browser/helper commands.
 * Do not change arbitrary child processes or explicitly visible login terminals.
 */
export function isBrowserBackgroundCommand(command: unknown): boolean {
  if (typeof command !== 'string') return false;
  const base = path.win32.basename(command).toLowerCase();
  if (/^(?:chrome|chromium|msedge|firefox|chrome-headless-shell|headless_shell)\.exe$/.test(base)) return true;
  return /^taskkill\s+\/pid\s+\d+\s+\/t\s+\/f$/i.test(command.trim());
}

const INSTALLED = Symbol.for('orbit.windowsBrowserProcessGuard');

/** Exported dependency seam lets tests exercise the real wrapper without launching processes. */
export function installWindowsBrowserProcessGuard(
  childProcess: any = require('child_process'),
  platform: NodeJS.Platform = process.platform,
): void {
  if (platform !== 'win32' || childProcess[INSTALLED]) return;
  for (const method of ['spawn', 'spawnSync'] as const) {
    const original = childProcess[method];
    if (typeof original !== 'function') continue;
    childProcess[method] = function (this: unknown, ...args: any[]) {
      if (isBrowserBackgroundCommand(args[0])) {
        const optionsIndex = Array.isArray(args[1]) ? 2 : 1;
        const options = args[optionsIndex] || {};
        // An explicit visible request remains visible; browser headless/headed
        // selection and all command arguments are untouched.
        if (options.windowsHide === undefined) args[optionsIndex] = { ...options, windowsHide: true };
      }
      return original.apply(this, args);
    };
  }
  childProcess[INSTALLED] = true;
}
