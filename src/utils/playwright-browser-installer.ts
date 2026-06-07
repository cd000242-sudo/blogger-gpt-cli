import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

type InstallResult = {
  ok: boolean;
  detail: string;
};

type InstallCommand = {
  label: string;
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
};

let chromiumInstallPromise: Promise<InstallResult> | null = null;

export function isMissingPlaywrightBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Executable doesn't exist/i.test(message) && /playwright install/i.test(message);
}

function resolveAsarUnpackedPath(filePath: string): string {
  return filePath.includes('app.asar')
    ? filePath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')
    : filePath;
}

function getCliPath(packageName: 'playwright' | 'patchright'): string | null {
  try {
    const pkgPath = require.resolve(`${packageName}/package.json`);
    const cliPath = path.join(path.dirname(pkgPath), 'cli.js');
    const unpackedPath = resolveAsarUnpackedPath(cliPath);
    return fs.existsSync(unpackedPath) ? unpackedPath : cliPath;
  } catch {
    return null;
  }
}

function getInstallEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PLAYWRIGHT_SKIP_BROWSER_GC: '1',
    ...extra,
  };
}

function makeCliCommands(packageName: 'playwright' | 'patchright'): InstallCommand[] {
  const cliPath = getCliPath(packageName);
  if (!cliPath) return [];

  const commands: InstallCommand[] = [{
    label: `${packageName} CLI`,
    command: process.execPath,
    args: [cliPath, 'install', 'chromium'],
    env: getInstallEnv(process.versions?.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
  }];

  commands.push({
    label: `Node ${packageName} CLI`,
    command: process.platform === 'win32' ? 'node.exe' : 'node',
    args: [cliPath, 'install', 'chromium'],
    env: getInstallEnv(),
  });

  return commands;
}

function runInstallCommand(command: InstallCommand): Promise<InstallResult> {
  return new Promise((resolve) => {
    let output = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: InstallResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    const append = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > 8000) output = output.slice(-8000);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command.command, command.args, {
        env: command.env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish({ ok: false, detail: error instanceof Error ? error.message : String(error || '') });
      return;
    }

    timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish({ ok: false, detail: 'Playwright Chromium auto install timed out.' });
    }, INSTALL_TIMEOUT_MS);

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.on('error', (error) => finish({ ok: false, detail: error.message }));
    child.on('close', (code) => {
      if (code === 0) {
        finish({ ok: true, detail: `${command.label}: Chromium install completed` });
      } else {
        finish({
          ok: false,
          detail: `${command.label}: ${output.trim() || `install exited with code ${code}`}`,
        });
      }
    });
  });
}

async function installPlaywrightChromium(onLog?: (message: string) => void): Promise<InstallResult> {
  const commands: InstallCommand[] = [
    ...makeCliCommands('playwright'),
    ...makeCliCommands('patchright'),
    {
      label: 'npx playwright',
      command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
      args: ['playwright', 'install', 'chromium'],
      env: getInstallEnv(),
    },
  ];

  let lastDetail = 'Playwright CLI was not found.';
  for (const command of commands) {
    onLog?.(`[Browser] Trying Chromium auto install with ${command.label}...`);
    const result = await runInstallCommand(command);
    if (result.ok) return result;
    lastDetail = result.detail;
  }

  return { ok: false, detail: lastDetail };
}

export function ensurePlaywrightChromiumInstalled(onLog?: (message: string) => void): Promise<InstallResult> {
  if (!chromiumInstallPromise) {
    chromiumInstallPromise = installPlaywrightChromium(onLog).finally(() => {
      chromiumInstallPromise = null;
    });
  }
  return chromiumInstallPromise;
}

export function getPlaywrightInstallFixMessage(): string {
  return [
    'This PC is missing the Playwright Chromium browser files required for automation.',
    'The app tried to install them automatically. If it still fails, check the internet connection or security software, then run the app again.',
    'If the problem continues, install Google Chrome/Microsoft Edge or run "npx playwright install chromium" once from the app install folder.',
  ].join('\n');
}

export async function retryWithPlaywrightChromiumInstall<T>(
  operation: () => Promise<T>,
  onLog?: (message: string) => void,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingPlaywrightBrowserError(error)) throw error;

    const original = error instanceof Error ? error.message : String(error || '');
    onLog?.('[Browser] Playwright Chromium is missing. Starting auto install. The first run can take a few minutes.');
    const installResult = await ensurePlaywrightChromiumInstalled(onLog);
    if (!installResult.ok) {
      throw new Error(`${original}\n\nAuto install failed: ${installResult.detail}\n${getPlaywrightInstallFixMessage()}`);
    }

    onLog?.('[Browser] Chromium auto install completed. Retrying browser launch...');
    return await operation();
  }
}

export function launchChromiumWithAutoInstall(
  chromium: any,
  options: Record<string, unknown>,
  onLog?: (message: string) => void,
): Promise<any> {
  return retryWithPlaywrightChromiumInstall(() => chromium.launch(options), onLog);
}

export function launchPersistentContextWithAutoInstall(
  chromium: any,
  userDataDir: string,
  options: Record<string, unknown>,
  onLog?: (message: string) => void,
): Promise<any> {
  return retryWithPlaywrightChromiumInstall(
    () => chromium.launchPersistentContext(userDataDir, options),
    onLog,
  );
}
