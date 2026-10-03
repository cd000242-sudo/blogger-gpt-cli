import { installWindowsBrowserProcessGuard, isBrowserBackgroundCommand } from '../electron/windows-browser-process';

describe('background browser console suppression', () => {
  const fakeProcesses = () => ({ spawn: jest.fn().mockReturnValue({ pid: 123 }), spawnSync: jest.fn().mockReturnValue({ status: 0 }) });

  test('hides the headless shell console without changing its arguments, pipes or environment', () => {
    const cp = fakeProcesses();
    const original = cp.spawn;
    installWindowsBrowserProcessGuard(cp, 'win32');
    const args = ['--headless', '--remote-debugging-pipe'];
    const options = { stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'], env: { SAMPLE: 'value' }, detached: false };
    const child = cp.spawn('C:\\Users\\한글\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1200\\chrome-headless-shell-win64\\chrome-headless-shell.exe', args, options);
    expect(child).toEqual({ pid: 123 });
    expect(original).toHaveBeenCalledWith(expect.any(String), args, { ...options, windowsHide: true });
    expect(options).not.toHaveProperty('windowsHide');
  });

  test('hides Playwright forced cleanup using the two-argument spawnSync overload', () => {
    const cp = fakeProcesses();
    const original = cp.spawnSync;
    installWindowsBrowserProcessGuard(cp, 'win32');
    cp.spawnSync('taskkill /pid 123 /T /F', { shell: true });
    expect(original).toHaveBeenCalledWith('taskkill /pid 123 /T /F', { shell: true, windowsHide: true });
  });

  test('keeps a headed browser headed and preserves explicitly visible launchers', () => {
    const cp = fakeProcesses();
    const original = cp.spawn;
    installWindowsBrowserProcessGuard(cp, 'win32');
    cp.spawn('chrome.exe', ['https://example.com/login'], { windowsHide: false });
    cp.spawn('powershell.exe', ['-NoExit', '-File', 'login.ps1'], { windowsHide: false });
    expect(original.mock.calls[0]).toEqual(['chrome.exe', ['https://example.com/login'], { windowsHide: false }]);
    expect(original.mock.calls[1]).toEqual(['powershell.exe', ['-NoExit', '-File', 'login.ps1'], { windowsHide: false }]);
  });

  test('leaves unrelated commands untouched and installs only once', () => {
    const cp = fakeProcesses();
    const original = cp.spawn;
    installWindowsBrowserProcessGuard(cp, 'win32');
    const wrapped = cp.spawn;
    installWindowsBrowserProcessGuard(cp, 'win32');
    expect(cp.spawn).toBe(wrapped);
    cp.spawn('codex.exe', ['exec', 'prompt'], { stdio: 'pipe' });
    expect(original).toHaveBeenCalledWith('codex.exe', ['exec', 'prompt'], { stdio: 'pipe' });
    expect(isBrowserBackgroundCommand('taskkill /pid 123 /T /F & other.exe')).toBe(false);
    expect(isBrowserBackgroundCommand('not-chrome.exe')).toBe(false);
  });

  test('does not alter non-Windows process launchers', () => {
    const cp = fakeProcesses();
    const original = cp.spawn;
    installWindowsBrowserProcessGuard(cp, 'darwin');
    expect(cp.spawn).toBe(original);
  });
});
