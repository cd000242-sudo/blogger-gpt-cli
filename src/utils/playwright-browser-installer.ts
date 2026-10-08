import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { withGpuSafeArgs } from './chromium-safe-args';

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

/**
 * v3.8.396: 모든 Chromium 실행에 GPU 안전 인자를 강제한다.
 *
 * 실측 2026-08-01 — 사용자 PC 가 하루 3번 블루스크린으로 재부팅됐다.
 *   0x10E VIDEO_MEMORY_MANAGEMENT_INTERNAL ×2, 0x9F DRIVER_POWER_STATE_FAILURE ×1
 *   Intel Iris Xe 드라이버가 2023-06-15 판이라 최신 Chromium 과 충돌한다.
 *
 * 실행 지점마다 사람이 기억해서 넣는 방식은 실패했다(7곳 중 4곳이 빠져 있었다).
 * 그래서 **공용 래퍼에서 자동으로 합친다.** 호출부가 이미 넣었으면 중복하지 않는다.
 */
function ensureGpuSafe(options: Record<string, unknown>): Record<string, unknown> {
  const current = Array.isArray(options?.['args']) ? (options['args'] as string[]) : [];
  return { ...options, args: withGpuSafeArgs(current) };
}

export function launchChromiumWithAutoInstall(
  chromium: any,
  options: Record<string, unknown>,
  onLog?: (message: string) => void,
): Promise<any> {
  return retryWithPlaywrightChromiumInstall(() => chromium.launch(ensureGpuSafe(options)), onLog);
}

/**
 * 🧭 v3.8.756 — 전용 Chromium 이 없으면 **PC 에 이미 있는 Edge → Chrome** 으로 띄운다.
 *   그래도 안 되면 그때 전용 Chromium 을 받아 설치한다(첫 회 1~2분).
 *
 * 실측(2026-10-08): 쇼핑모드 상품 수집이 `chromium.launch()` 만 불러서, 전용 Chromium 이 없는 PC
 *   (사장님 PC 포함)에서 "Executable doesn't exist" 로 바로 끝났다 → 상품 사진·가격 없이 "링크만 사용".
 *   Edge 는 윈도우 10/11 에 기본으로 있다. 같은 수집을 Edge 로 돌리면 정상 실행됨을 확인했다.
 * 호출자가 channel 을 직접 고른 경우엔 손대지 않는다.
 */
export async function launchChromiumWithSystemFallback(
  chromium: any,
  options: Record<string, unknown>,
  onLog?: (message: string) => void,
): Promise<any> {
  try {
    return await chromium.launch(ensureGpuSafe(options));
  } catch (error) {
    if (!isMissingPlaywrightBrowserError(error) || options['channel']) throw error;
  }
  for (const channel of ['msedge', 'chrome'] as const) {
    try {
      const browser = await chromium.launch(ensureGpuSafe({ ...options, channel }));
      onLog?.(`[Browser] 전용 Chromium 이 없어 PC 의 ${channel === 'msedge' ? 'Edge' : 'Chrome'} 로 실행합니다.`);
      return browser;
    } catch { /* 다음 브라우저 */ }
  }
  return launchChromiumWithAutoInstall(chromium, options, onLog);
}

export function launchPersistentContextWithAutoInstall(
  chromium: any,
  userDataDir: string,
  options: Record<string, unknown>,
  onLog?: (message: string) => void,
): Promise<any> {
  return retryWithPlaywrightChromiumInstall(
    () => chromium.launchPersistentContext(userDataDir, ensureGpuSafe(options)),
    onLog,
  );
}
