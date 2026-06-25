import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { launchPersistentContextWithAutoInstall } from '../utils/playwright-browser-installer';
import { TISTORY_SELECTORS, TISTORY_URLS } from './tistory-selectors';
import { TistoryCategory, TistoryCategoryLoadResult, TistoryConfig, TistorySessionStatus, TistoryVisibility } from './tistory-types';

type LaunchResult = {
  context: any;
  page: any;
};

type ActiveTistorySession = LaunchResult & {
  profileDir: string;
  createdAt: number;
  lastUsedAt: number;
  hidden?: boolean;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const TISTORY_PROFILE_ROOT = path.join(os.homedir(), '.leadernam-orbit', 'tistory-profiles');
const ACTIVE_TISTORY_SESSIONS = new Map<string, ActiveTistorySession>();

function firstExistingPath(paths: string[]): string {
  for (const item of paths) {
    if (item && fs.existsSync(item)) return item;
  }
  return '';
}

function getDefaultBrowserExecutablePath(): string {
  if (process.platform === 'win32') {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    return firstExistingPath([
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }

  if (process.platform === 'darwin') {
    return firstExistingPath([
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ]);
  }

  return firstExistingPath([
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ]);
}

export function normalizeTistoryBlogName(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let next = raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/g, '')
    .replace(/\.tistory\.com$/i, '')
    .trim();

  next = next.replace(/[^a-zA-Z0-9_-]/g, '');
  return next;
}

export function normalizeTistoryVisibility(value?: string | null): TistoryVisibility {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'public' || raw === 'publish' || raw === 'published') return 'public';
  if (raw === 'protected' || raw === 'password') return 'protected';
  return 'private';
}

function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function getTistoryProfileDir(blogName: string, profileId?: string | null): string {
  const safeId = normalizeTistoryBlogName(profileId || 'default') || 'default';
  return path.join(TISTORY_PROFILE_ROOT, `chrome-${safeId}`);
}

function getLegacyBlogProfileDir(blogName: string): string {
  const safeBlogName = normalizeTistoryBlogName(blogName);
  return safeBlogName ? path.join(TISTORY_PROFILE_ROOT, `chrome-${safeBlogName}`) : '';
}

function getPreferredTistoryProfileDir(blogName: string, profileId?: string | null): string {
  if (profileId) return getTistoryProfileDir(blogName, profileId);

  const defaultDir = getTistoryProfileDir(blogName, 'default');
  const legacyDir = getLegacyBlogProfileDir(blogName);
  if (legacyDir && fs.existsSync(legacyDir) && !fs.existsSync(defaultDir)) {
    return legacyDir;
  }

  return defaultDir;
}

export function resolveTistoryConfig(payload: Record<string, any> = {}, env: Record<string, any> = {}): TistoryConfig {
  const candidate =
    payload['tistoryBlogName'] ||
    payload['tistoryBlogUrl'] ||
    payload['blogName'] ||
    payload['blogUrl'] ||
    env['tistoryBlogName'] ||
    env['TISTORY_BLOG_NAME'] ||
    env['tistoryBlogUrl'] ||
    env['TISTORY_BLOG_URL'] ||
    '';

  const blogName = normalizeTistoryBlogName(candidate);
  const profileId = payload['tistoryProfileId'] || env['tistoryProfileId'] || env['TISTORY_PROFILE_ID'] || '';
  const profileDir = String(payload['tistoryProfileDir'] || env['tistoryProfileDir'] || getPreferredTistoryProfileDir(blogName, profileId));
  const visibility = normalizeTistoryVisibility(
    payload['tistoryVisibility'] ||
    payload['tistoryDefaultVisibility'] ||
    env['tistoryDefaultVisibility'] ||
    env['TISTORY_DEFAULT_VISIBILITY'] ||
    'private',
  );

  const config: TistoryConfig = {
    blogName,
    blogUrl: blogName ? `https://${blogName}.tistory.com` : '',
    profileDir,
    visibility,
    timeoutMs: Number(payload['tistoryTimeoutMs'] || env['tistoryTimeoutMs'] || DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };

  const defaultCategory = payload['tistoryDefaultCategory'] || env['tistoryDefaultCategory'] || env['TISTORY_DEFAULT_CATEGORY'];
  if (defaultCategory) config.defaultCategory = String(defaultCategory);

  const protectedPassword = payload['tistoryProtectedPassword'] || env['tistoryProtectedPassword'] || env['TISTORY_PROTECTED_PASSWORD'];
  if (protectedPassword) config.protectedPassword = String(protectedPassword);

  const kakaoEmail =
    payload['tistoryKakaoEmail'] ||
    payload['kakaoEmail'] ||
    env['tistoryKakaoEmail'] ||
    env['TISTORY_KAKAO_EMAIL'] ||
    env['KAKAO_EMAIL'];
  if (kakaoEmail) config.kakaoEmail = normalizeEmail(kakaoEmail);

  const browserExecutablePath =
    payload['tistoryBrowserExecutablePath'] ||
    payload['browserExecutablePath'] ||
    env['tistoryBrowserExecutablePath'] ||
    env['TISTORY_BROWSER_EXECUTABLE_PATH'] ||
    getDefaultBrowserExecutablePath();
  if (browserExecutablePath) config.browserExecutablePath = String(browserExecutablePath);

  if (payload['tistoryHiddenBrowser'] !== undefined) {
    config.hiddenBrowser = String(payload['tistoryHiddenBrowser']).toLowerCase() === 'true' || payload['tistoryHiddenBrowser'] === true;
  }
  if (payload['tistoryKeepBrowserOpen'] !== undefined) {
    config.keepBrowserOpen = String(payload['tistoryKeepBrowserOpen']).toLowerCase() === 'true' || payload['tistoryKeepBrowserOpen'] === true;
  }
  if (payload['tistoryDryRun'] !== undefined) {
    config.dryRun = String(payload['tistoryDryRun']).toLowerCase() === 'true' || payload['tistoryDryRun'] === true;
  }

  return config;
}

async function loadChromium(): Promise<any> {
  try {
    return require('patchright').chromium;
  } catch {
    return require('playwright').chromium;
  }
}

// v3.8.159: ghost-cursor 동적 로드 (실패 시 native fallback)
let createGhostCursor: any = null;
try {
  const gc = require('ghost-cursor');
  createGhostCursor = gc.createCursor;
} catch { /* not installed — fallback to native */ }

// 사람 같은 random delay
function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.floor(Math.random() * (max - min));
  return new Promise((r) => setTimeout(r, ms));
}

// v3.8.161: Normal distribution random — uniform보다 사람 행동에 가까움
//   (Box-Muller transform — 평균 μ, 표준편차 σ)
function normalRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, mean + z * stdDev);
}

// 사람 같은 타이핑 — 글자별 50~150ms random delay (한글은 IME 고려 100~250ms)
export async function humanType(page: any, selector: string, text: string, opts: { clear?: boolean } = {}): Promise<boolean> {
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    if (opts.clear) {
      await locator.click({ timeout: 4000 }).catch(() => null);
      await page.keyboard.press('Control+A').catch(() => null);
      await randomDelay(80, 180);
      await page.keyboard.press('Delete').catch(() => null);
      await randomDelay(100, 220);
    } else {
      await locator.click({ timeout: 4000 }).catch(() => null);
      await randomDelay(120, 280);
    }
    // v3.8.161: 글자별 normal distribution delay (uniform보다 사람에 가까움)
    for (const ch of text) {
      const isKorean = /[ㄱ-힝]/u.test(ch);
      // 한글: μ=140ms, σ=45ms / 영문: μ=80ms, σ=30ms
      const baseDelay = isKorean ? normalRandom(140, 45) : normalRandom(80, 30);
      await page.keyboard.type(ch, { delay: Math.min(400, Math.max(20, baseDelay)) });
      // 7% 확률로 잠시 멈춤 (생각하는 척)
      if (Math.random() < 0.07) await randomDelay(400, 1400);
      // 1% 확률로 백스페이스 1번 (오타 수정 시뮬레이션)
      if (Math.random() < 0.01) {
        await randomDelay(200, 500);
        await page.keyboard.press('Backspace').catch(() => null);
        await randomDelay(100, 300);
        await page.keyboard.type(ch, { delay: normalRandom(120, 40) });
      }
    }
    return true;
  } catch {
    return false;
  }
}

// 사람 같은 클릭 — ghost-cursor 베지어 곡선 (없으면 마우스 이동 + 클릭 분리)
export async function humanClick(page: any, selector: string, opts: { timeoutMs?: number } = {}): Promise<boolean> {
  const timeoutMs = opts.timeoutMs || 6000;
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: timeoutMs }).catch(() => null);
    const box = await locator.boundingBox().catch(() => null);
    if (!box) {
      await locator.click({ timeout: timeoutMs }).catch(() => null);
      return true;
    }
    const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
    const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);
    // ghost-cursor 가능하면 사용 (베지어 곡선 + 가속도)
    if (createGhostCursor) {
      try {
        const cursor = createGhostCursor(page);
        await cursor.moveTo({ x: targetX, y: targetY });
        await randomDelay(60, 180);
        await page.mouse.click(targetX, targetY);
        return true;
      } catch { /* fallback */ }
    }
    // Native fallback: 마우스 이동 분리 + step + v3.8.161 jitter
    const steps = 12 + Math.floor(Math.random() * 8);
    await page.mouse.move(targetX, targetY, { steps }).catch(() => null);
    await randomDelay(80, 220);
    // v3.8.161: 클릭 직전 미세 떨림 (1~3px 범위, 2~4회)
    //   사람은 클릭 전 마우스가 완전히 정지하지 않음 — micro-jitter 추가
    const jitterCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < jitterCount; i++) {
      const dx = (Math.random() - 0.5) * 4;
      const dy = (Math.random() - 0.5) * 4;
      await page.mouse.move(targetX + dx, targetY + dy, { steps: 1 }).catch(() => null);
      await randomDelay(20, 60);
    }
    await page.mouse.click(targetX, targetY).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

// 자연스러운 스크롤 (페이지 머무는 시간 + scroll 변화)
export async function humanScroll(page: any, opts: { steps?: number } = {}): Promise<void> {
  const steps = opts.steps || (2 + Math.floor(Math.random() * 4));
  for (let i = 0; i < steps; i++) {
    const dy = 100 + Math.floor(Math.random() * 400);
    await page.mouse.wheel(0, dy).catch(() => null);
    await randomDelay(300, 900);
  }
}

// 페이지 머무는 시간 (사람은 즉시 다음 동작 안 함)
export async function humanLinger(min = 800, max = 2400): Promise<void> {
  await randomDelay(min, max);
}

// v3.8.160: clipboard paste 시뮬레이션 — 본문/긴 텍스트는 사람도 외부 에디터에서 복사→paste 패턴
//   글자별 타이핑이 부자연스러운 본문/HTML 입력에 사용
//   - clipboard API로 텍스트 설정 → Ctrl+V 키보드 입력 → input/change 이벤트 dispatch
//   - typing보다 훨씬 자연스러운 사람 행동 패턴 (블로그 작성자 대부분 paste)
export async function humanPaste(page: any, selector: string, text: string, opts: { clear?: boolean } = {}): Promise<boolean> {
  try {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: 'visible', timeout: 8000 }).catch(() => null);
    // 1) 자연스러운 클릭으로 focus
    await humanClick(page, selector, { timeoutMs: 4000 });
    await randomDelay(180, 420);
    // 2) clear 옵션이면 기존 내용 선택+삭제
    if (opts.clear) {
      await page.keyboard.press('Control+A').catch(() => null);
      await randomDelay(80, 180);
      await page.keyboard.press('Delete').catch(() => null);
      await randomDelay(120, 280);
    }
    // 3) clipboard에 텍스트 설정 + paste 이벤트 dispatch
    const pasted = await page.evaluate(async ({ value, targetSel }: { value: string; targetSel: string }) => {
      try {
        const el = (document.querySelector(targetSel) as HTMLElement | null);
        if (!el) return false;
        el.focus();
        // ClipboardEvent를 직접 dispatch (가장 자연스러움)
        const dt = new DataTransfer();
        dt.setData('text/plain', value);
        dt.setData('text/html', value);
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });
        const fired = el.dispatchEvent(pasteEvent);
        if (fired && !pasteEvent.defaultPrevented) {
          // 페이지가 paste를 막지 않음 → 직접 value 주입 + InputEvent dispatch
          if ('value' in el) {
            (el as HTMLInputElement | HTMLTextAreaElement).value = value;
          } else {
            el.innerHTML = value;
          }
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: value }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      } catch {
        return false;
      }
    }, { value: text, targetSel: selector });
    if (pasted) {
      await randomDelay(200, 500);
      return true;
    }
    // 4) Fallback: Playwright의 native fill (사람-flavor 잃음)
    await locator.fill(text, { timeout: 4000 }).catch(() => null);
    return true;
  } catch {
    return false;
  }
}

// v3.8.157: Tistory/카카오 캡차 우회 강화
//   patchright(이미 stealth) + 추가 launch args + UA spoofing 으로 자동화 탐지율 ↓
function getLaunchArgs(): string[] {
  return [
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1400,900',
    // 자동화 흔적 추가 제거
    '--disable-features=IsolateOrigins,site-per-process,AutomationControlled',
    '--disable-site-isolation-trials',
    '--disable-infobars',
    '--disable-extensions-except',
    '--no-default-browser-check',
    '--password-store=basic',
    '--use-mock-keychain',
    // 추가 stealth — fingerprint 노이즈 줄이기
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-hang-monitor',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--safebrowsing-disable-auto-update',
    '--enable-features=NetworkService,NetworkServiceInProcess',
    // 실제 사용자 환경 흉내
    '--lang=ko-KR',
  ];
}

// 실제 최신 Chrome UA — 자동화 탐지 회피 (playwright default UA에는 'HeadlessChrome' 흔적)
const REAL_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isPageClosed(page: any): boolean {
  try {
    return typeof page?.isClosed === 'function' ? page.isClosed() : false;
  } catch {
    return true;
  }
}

async function getLiveTistoryPage(context: any): Promise<any | null> {
  try {
    const pages = typeof context.pages === 'function' ? context.pages() : [];
    const livePages = pages.filter((item: any) => !isPageClosed(item));
    const preferred = livePages.find((item: any) => {
      const url = String(typeof item.url === 'function' ? item.url() : '');
      return /tistory\.com|accounts\.kakao\.com|about:blank/i.test(url);
    }) || livePages[0];
    if (preferred) return preferred;
    return await context.newPage();
  } catch {
    return null;
  }
}

async function getReusableTistorySession(
  profileDir: string,
  onLog?: (message: string) => void,
  hiddenBrowser = false,
): Promise<LaunchResult | null> {
  const active = ACTIVE_TISTORY_SESSIONS.get(profileDir);
  if (!active) return null;

  const page = await getLiveTistoryPage(active.context);
  if (!page) {
    ACTIVE_TISTORY_SESSIONS.delete(profileDir);
    return null;
  }

  active.page = page;
  active.lastUsedAt = Date.now();
  active.hidden = hiddenBrowser;
  onLog?.('[TISTORY] Reusing existing browser session.');
  if (hiddenBrowser) {
    await hideTistoryBrowserWindow(page, onLog).catch(() => false);
  } else {
    await restoreTistoryBrowserWindow(page, onLog).catch(() => false);
  }
  return { context: active.context, page };
}

export async function hideTistoryBrowserWindow(page: any, onLog?: (message: string) => void): Promise<boolean> {
  try {
    const context = typeof page.context === 'function' ? page.context() : null;
    const session = context && typeof context.newCDPSession === 'function'
      ? await context.newCDPSession(page)
      : null;
    if (!session) return false;
    const target = await session.send('Browser.getWindowForTarget').catch(() => null);
    if (!target?.windowId) {
      await session.detach().catch(() => null);
      return false;
    }
    // v3.8.156: 화면 밖 이동 + minimize 2단계 강제 (windowState 단독은 일부 환경에서 무시됨)
    await session.send('Browser.setWindowBounds', {
      windowId: target.windowId,
      bounds: { left: -32000, top: -32000, width: 100, height: 100 },
    }).catch(() => null);
    await session.send('Browser.setWindowBounds', {
      windowId: target.windowId,
      bounds: { windowState: 'minimized' },
    }).catch(() => null);
    await session.detach().catch(() => null);
    onLog?.('[TISTORY] Browser window hidden.');
    return true;
  } catch {
    return false;
  }
}

export async function restoreTistoryBrowserWindow(page: any, onLog?: (message: string) => void): Promise<boolean> {
  try {
    const context = typeof page.context === 'function' ? page.context() : null;
    const session = context && typeof context.newCDPSession === 'function'
      ? await context.newCDPSession(page)
      : null;
    if (!session) return false;
    const target = await session.send('Browser.getWindowForTarget').catch(() => null);
    if (!target?.windowId) {
      await session.detach().catch(() => null);
      return false;
    }
    await session.send('Browser.setWindowBounds', {
      windowId: target.windowId,
      bounds: { windowState: 'normal' },
    }).catch(() => null);
    await session.detach().catch(() => null);
    try { await page.bringToFront(); } catch { /* ignore */ }
    onLog?.('[TISTORY] Browser window restored.');
    return true;
  } catch {
    return false;
  }
}

export async function launchTistoryContext(
  config: TistoryConfig,
  onLog?: (message: string) => void,
): Promise<LaunchResult> {
  fs.mkdirSync(config.profileDir, { recursive: true });
  const reusable = await getReusableTistorySession(config.profileDir, onLog, !!config.hiddenBrowser);
  if (reusable) return reusable;

  const chromium = await loadChromium();
  const launchOptions = {
    headless: false,
    locale: 'ko-KR',
    viewport: { width: 1400, height: 900 },
    // v3.8.157: 캡차 우회 강화 — UA spoofing + automation 표시 제거 + 타임존
    userAgent: REAL_CHROME_UA,
    timezoneId: 'Asia/Seoul',
    // playwright default 'enable-automation' flag 제거 → navigator.webdriver 흔적 ↓
    ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
    // v3.8.155: 일반 로그인 모드에서도 명시적 윈도우 위치 + 크기 강제
    args: config.hiddenBrowser
      ? [...getLaunchArgs(), '--start-minimized', '--window-position=-32000,-32000']
      : [...getLaunchArgs(), '--window-position=100,100', '--window-size=1400,900'],
  } as Record<string, unknown>;
  if (config.browserExecutablePath && fs.existsSync(config.browserExecutablePath)) {
    launchOptions['executablePath'] = config.browserExecutablePath;
    onLog?.(`[TISTORY] Using system browser: ${config.browserExecutablePath}`);
  }

  const context = await launchPersistentContextWithAutoInstall(
    chromium,
    config.profileDir,
    launchOptions,
    onLog,
  );

  // v3.8.158: 강화 stealth — fingerprint 6종 위장 + 행동 정상화
  //   1) navigator.webdriver/plugins/languages/chrome 흔적 위장
  //   2) Canvas/WebGL/Audio fingerprint 노이즈 (자동화 탐지 1순위)
  //   3) Hardware 정보 정상화 (deviceMemory, hardwareConcurrency, screen)
  //   4) WebRTC IP 누출 차단
  //   5) Battery API mock
  //   6) Client Hints + permissions
  try {
    await context.addInitScript(() => {
      const w = window as any;
      const n = navigator as any;

      // ===== 1) navigator 흔적 위장 =====
      try { Object.defineProperty(Object.getPrototypeOf(n), 'webdriver', { get: () => undefined }); } catch {}
      try {
        Object.defineProperty(n, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
          ],
        });
      } catch {}
      try { Object.defineProperty(n, 'languages', { get: () => ['ko-KR', 'ko', 'en-US', 'en'] }); } catch {}

      // ===== 2) chrome 객체 강화 (자동화는 보통 미정의) =====
      w.chrome = w.chrome || {};
      w.chrome.runtime = w.chrome.runtime || { OnInstalledReason: { INSTALL: 'install' }, OnRestartRequiredReason: {}, PlatformOs: { WIN: 'win' } };
      w.chrome.csi = w.chrome.csi || function () { return { onloadT: Date.now(), startE: Date.now(), pageT: 0, tran: 15 }; };
      w.chrome.loadTimes = w.chrome.loadTimes || function () {
        return {
          requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000, commitLoadTime: Date.now() / 1000,
          finishDocumentLoadTime: Date.now() / 1000, finishLoadTime: Date.now() / 1000, firstPaintTime: Date.now() / 1000,
          firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true,
          npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2',
        };
      };

      // ===== 3) Canvas fingerprint 노이즈 =====
      try {
        const origGetCtx = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: any[]) {
          const ctx: any = (origGetCtx as any).apply(this, [type, ...rest]);
          if (ctx && (type === '2d' || type === 'webgl' || type === 'webgl2')) {
            const origToData = this.toDataURL;
            this.toDataURL = function (...args: any[]) {
              const result = origToData.apply(this, args as any);
              // 마지막 픽셀 1바이트 변경 — 항상 동일 noise (deterministic fingerprint X, 변화는 적게)
              return result.replace(/.$/, (c) => String.fromCharCode((c.charCodeAt(0) + 1) % 128));
            };
          }
          return ctx;
        };
      } catch {}

      // ===== 4) WebGL fingerprint 위장 (vendor/renderer) =====
      try {
        const origGetParam = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (param: number) {
          // UNMASKED_VENDOR_WEBGL = 37445, UNMASKED_RENDERER_WEBGL = 37446
          if (param === 37445) return 'Google Inc. (Intel)';
          if (param === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
          return origGetParam.call(this, param);
        };
        const origGetParam2 = (window as any).WebGL2RenderingContext?.prototype?.getParameter;
        if (origGetParam2) {
          (window as any).WebGL2RenderingContext.prototype.getParameter = function (param: number) {
            if (param === 37445) return 'Google Inc. (Intel)';
            if (param === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';
            return origGetParam2.call(this, param);
          };
        }
      } catch {}

      // ===== 5) AudioContext fingerprint 노이즈 =====
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AC) {
          const origGetChannelData = (window as any).AudioBuffer?.prototype?.getChannelData;
          if (origGetChannelData) {
            (window as any).AudioBuffer.prototype.getChannelData = function (...args: any[]) {
              const data = origGetChannelData.apply(this, args);
              // 무음 영역에 미세 노이즈 (탐지 회피)
              for (let i = 0; i < data.length; i += 100) {
                data[i] = data[i] + (Math.random() - 0.5) * 0.0000001;
              }
              return data;
            };
          }
        }
      } catch {}

      // ===== 6) Hardware 정보 — 실제 PC 환경 =====
      try { Object.defineProperty(n, 'hardwareConcurrency', { get: () => 8 }); } catch {}
      try { Object.defineProperty(n, 'deviceMemory', { get: () => 8 }); } catch {}
      try {
        // screen 정보 (자동화는 0 또는 비표준)
        Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
      } catch {}

      // ===== 7) WebRTC IP 누출 차단 =====
      try {
        const origRTC = (window as any).RTCPeerConnection;
        if (origRTC) {
          (window as any).RTCPeerConnection = function (...args: any[]) {
            const pc = new origRTC(...args);
            const origCreateOffer = pc.createOffer.bind(pc);
            pc.createOffer = (opts?: any) => origCreateOffer({ ...(opts || {}), offerToReceiveAudio: false, offerToReceiveVideo: false });
            return pc;
          };
        }
      } catch {}

      // ===== 8) Battery API mock =====
      try {
        if ((n).getBattery) {
          n.getBattery = () => Promise.resolve({
            charging: true, chargingTime: Infinity, dischargingTime: Infinity, level: 0.87,
            addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
          });
        }
      } catch {}

      // ===== 9) Permissions API 정상화 =====
      try {
        const origQuery = n.permissions?.query;
        if (origQuery) {
          n.permissions.query = (params: any) =>
            params?.name === 'notifications'
              ? Promise.resolve({ state: 'denied' } as any)
              : origQuery.call(n.permissions, params);
        }
      } catch {}

      // ===== 10) Iframe contentWindow + contentDocument stealth =====
      try {
        const origContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
        if (origContentWindow?.get) {
          Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function () {
              const win = origContentWindow.get!.call(this);
              try {
                if (win && (win as any).navigator) {
                  Object.defineProperty(Object.getPrototypeOf((win as any).navigator), 'webdriver', { get: () => undefined });
                  (win as any).chrome = (win as any).chrome || { runtime: {} };
                }
              } catch {}
              return win;
            },
          });
        }
      } catch {}

      // ===== v3.8.161: 심층 강화 11종 =====

      // 11) Function.prototype.toString 위장 — 자동화 탐지가 native 함수 변조 검증할 때 사용
      //   getter/setter override 후 toString() 호출 → 위장 코드 노출 → 발각
      //   → toString을 wrapping하여 항상 'function() { [native code] }' 반환
      try {
        const origToString = Function.prototype.toString;
        const nativeFnStr = (name: string) => `function ${name}() { [native code] }`;
        const fakeFns = new WeakSet();
        Function.prototype.toString = function () {
          if (fakeFns.has(this)) return nativeFnStr(this.name || '');
          try {
            return origToString.apply(this);
          } catch {
            return nativeFnStr(this.name || '');
          }
        };
        // Function.prototype.toString 자체도 native처럼 보여야 함
        fakeFns.add(Function.prototype.toString);
      } catch {}

      // 12) Touch/Pointer events — desktop은 maxTouchPoints=0, 자동화는 가끔 잘못된 값
      try { Object.defineProperty(n, 'maxTouchPoints', { get: () => 0 }); } catch {}
      try { Object.defineProperty(n, 'pointerEnabled', { get: () => false }); } catch {}

      // 13) navigator.connection — 실제 사용자는 wifi/4g, 자동화는 미정의/이상값
      try {
        Object.defineProperty(n, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50 + Math.floor(Math.random() * 50),
            downlink: 8 + Math.random() * 4,
            saveData: false,
            type: 'wifi',
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
          }),
        });
      } catch {}

      // 14) Storage quota — 실제 사용자 PC는 GB 단위
      try {
        if (n.storage?.estimate) {
          const origEstimate = n.storage.estimate.bind(n.storage);
          n.storage.estimate = async () => {
            try {
              const real = await origEstimate();
              return { ...real, quota: 120 * 1024 * 1024 * 1024 }; // 120GB
            } catch {
              return { quota: 120 * 1024 * 1024 * 1024, usage: 1024 * 1024 * 12 };
            }
          };
        }
      } catch {}

      // 15) Performance API timing 노이즈 — performance.now() 미세 변동
      //   자동화는 정확한 timing 사용 → fingerprint 가능
      try {
        const origNow = Performance.prototype.now;
        Performance.prototype.now = function () {
          const value = origNow.call(this);
          // 0~0.5ms random offset (실제 Chrome timing precision)
          return value + Math.random() * 0.5;
        };
      } catch {}

      // 16) Date.now timing 미세 변동 (드물게 사용되는 fingerprint)
      try {
        const origDateNow = Date.now;
        Date.now = function () {
          return origDateNow.call(Date) + Math.floor(Math.random() * 2);
        };
      } catch {}

      // 17) CDP runtime 흔적 차단 — window.cdc_* 변수가 있으면 자동화로 발각
      try {
        const cdcProps = Object.keys(w).filter((k) => /^cdc_|^cdp_|^__webdriver_/.test(k));
        for (const prop of cdcProps) {
          try { delete w[prop]; } catch {}
        }
      } catch {}

      // 18) Notification permission — 사람은 default(prompt) 또는 granted, 자동화는 보통 denied만
      try {
        if (w.Notification) {
          Object.defineProperty(w.Notification, 'permission', { get: () => 'default' });
        }
      } catch {}

      // 19) Mouse jitter helper — 클릭 전 마우스 미세 떨림 시뮬레이션
      //   사람은 클릭 직전 마우스가 완전히 정지하지 않음 (1~3px 미세 움직임)
      try {
        const origDispatch = EventTarget.prototype.dispatchEvent;
        // 추가 마우스 이벤트 dispatching은 hook 없이 humanClick에서 처리
      } catch {}

      // 20) Service Worker 정상화 — 빈 navigator.serviceWorker.controller는 자동화 신호
      try {
        if (n.serviceWorker) {
          const origGetReg = n.serviceWorker.getRegistration?.bind(n.serviceWorker);
          // 이미 등록된 SW가 있으면 그대로, 없으면 진행 (강제 fake X — site별 검증 시 실패)
        }
      } catch {}

      // 21) Iframe contentDocument도 보호 (10번 contentWindow 보완)
      try {
        const origContentDoc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentDocument');
        if (origContentDoc?.get) {
          Object.defineProperty(HTMLIFrameElement.prototype, 'contentDocument', {
            get: function () {
              const doc = origContentDoc.get!.call(this);
              try {
                if (doc?.defaultView?.navigator) {
                  Object.defineProperty(Object.getPrototypeOf(doc.defaultView.navigator), 'webdriver', { get: () => undefined });
                }
              } catch {}
              return doc;
            },
          });
        }
      } catch {}
    });
  } catch { /* addInitScript 실패해도 진행 */ }

  const pages = typeof context.pages === 'function' ? context.pages() : [];
  const page = pages.find((item: any) => {
    const url = String(typeof item.url === 'function' ? item.url() : '');
    return /tistory\.com|accounts\.kakao\.com|about:blank/i.test(url);
  }) || pages[0] || await context.newPage();

  for (const item of pages) {
    if (item === page) continue;
    try { await item.close(); } catch { /* ignore stale tabs */ }
  }

  if (config.hiddenBrowser) {
    await hideTistoryBrowserWindow(page, onLog).catch(() => false);
  } else {
    try { await page.bringToFront(); } catch { /* ignore */ }
  }
  ACTIVE_TISTORY_SESSIONS.set(config.profileDir, {
    context,
    page,
    profileDir: config.profileDir,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    hidden: !!config.hiddenBrowser,
  });
  return { context, page };
}

export async function isTistoryLoginPage(page: any): Promise<boolean> {
  const url = String(typeof page.url === 'function' ? page.url() : '');
  if (/accounts\.kakao\.com|tistory\.com\/auth\/login/i.test(url)) return true;

  try {
    const bodyText = await page.locator('body').innerText({ timeout: 3000 });
    return /로그인|카카오계정|인증/i.test(String(bodyText || '')) && !/관리|글쓰기|임시저장/i.test(String(bodyText || ''));
  } catch {
    return false;
  }
}

export async function ensureKakaoLoginPersistenceIfVisible(page: any, onLog?: (message: string) => void): Promise<boolean> {
  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  if (!/accounts\.kakao\.com/i.test(currentUrl)) return false;

  try {
    const changed = await page.evaluate(() => {
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const style = window.getComputedStyle(htmlElement);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };

      const checkboxSelectors = [
        'input[type="checkbox"][id*="save" i]',
        'input[type="checkbox"][name*="save" i]',
        'input[type="checkbox"][id*="stay" i]',
        'input[type="checkbox"][name*="stay" i]',
        'input[type="checkbox"][id*="keep" i]',
        'input[type="checkbox"][name*="keep" i]',
        'input[type="checkbox"]',
      ];

      for (const selector of checkboxSelectors) {
        const inputs = Array.from(document.querySelectorAll(selector)) as HTMLInputElement[];
        for (const input of inputs) {
          const labelText = [
            input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`)?.textContent || '' : '',
            input.closest('label')?.textContent || '',
            input.parentElement?.textContent || '',
          ].join(' ');
          const looksLikePersistence = /로그인\s*상태\s*유지|자동\s*로그인|remember|stay|keep|save/i.test(labelText)
            || /save|stay|keep|remember/i.test(`${input.id || ''} ${input.name || ''}`);
          if (!looksLikePersistence) continue;
          if (input.checked) return false;
          input.click();
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      const nodes = Array.from(document.querySelectorAll('label, button, a, span, div')) as HTMLElement[];
      const target = nodes.find((node) => visible(node) && /로그인\s*상태\s*유지|자동\s*로그인|remember|stay signed/i.test(node.textContent || ''));
      if (!target) return false;
      const clickable = (target.closest('label,button,a') as HTMLElement | null) || target;
      clickable.click();
      return true;
    });

    if (changed) {
      onLog?.('[TISTORY] Kakao login persistence option enabled.');
      await page.waitForTimeout(500).catch(() => null);
      return true;
    }
  } catch {
    // Best effort only. The user can still complete login manually.
  }

  return false;
}

export async function clickKakaoSavedAccountIfVisible(
  page: any,
  kakaoEmail?: string | null,
  onLog?: (message: string) => void,
): Promise<boolean> {
  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  if (!/accounts\.kakao\.com/i.test(currentUrl)) return false;

  try {
    const result = await page.evaluate((preferredEmail: string) => {
      const normalize = (value: string) => String(value || '').trim().toLowerCase();
      const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const style = window.getComputedStyle(htmlElement);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };

      const hasPasswordInput = Array.from(document.querySelectorAll('input')).some((input) => {
        const element = input as HTMLInputElement;
        return visible(element) && /password/i.test(element.type || '');
      });

      const nodes = Array.from(document.querySelectorAll('a, button, [role="button"], li, div, span, label')) as HTMLElement[];
      const rows = nodes
        .filter((node) => visible(node))
        .map((node) => {
          const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          const email = normalize(text.match(emailRe)?.[0] || '');
          const rect = node.getBoundingClientRect();
          return { node, text, email, area: rect.width * rect.height };
        })
        .filter((item) => {
          if (!item.email) return false;
          if (/\bremove\b|\bdelete\b|\bclose\b|새로운\s*계정|다른\s*계정|계정\s*추가/i.test(item.text)) return false;
          if (preferredEmail && item.email !== preferredEmail) return false;
          return true;
        });

      const uniqueEmails = Array.from(new Set(rows.map((item) => item.email)));
      if (!rows.length) return { clicked: false, reason: hasPasswordInput ? 'password_required' : 'no_saved_account' };
      if (!preferredEmail && uniqueEmails.length !== 1) return { clicked: false, reason: 'multiple_accounts' };

      rows.sort((a, b) => a.area - b.area);
      const selected = rows[0];
      if (!selected) return { clicked: false, reason: 'no_saved_account' };

      const clickable = (selected.node.closest('a,button,[role="button"],li,div') as HTMLElement | null) || selected.node;
      clickable.click();
      return { clicked: true, reason: 'clicked_saved_account' };
    }, normalizeEmail(kakaoEmail));

    if (result?.clicked) {
      onLog?.('[TISTORY] Kakao saved login account selected.');
      await page.waitForTimeout(2000).catch(() => null);
      return true;
    }

    if (result?.reason === 'multiple_accounts') {
      onLog?.('[TISTORY] Multiple Kakao saved accounts detected. Waiting for user selection or TISTORY_KAKAO_EMAIL.');
    }
  } catch {
    // Best effort only. Password, 2-step verification, and CAPTCHA remain user actions.
  }

  return false;
}

export async function clickTistoryKakaoLoginIfVisible(
  page: any,
  onLog?: (message: string) => void,
  kakaoEmail?: string | null,
): Promise<boolean> {
  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  if (/accounts\.kakao\.com/i.test(currentUrl)) {
    await ensureKakaoLoginPersistenceIfVisible(page, onLog);
    return clickKakaoSavedAccountIfVisible(page, kakaoEmail, onLog);
  }

  const selectors = [
    'span.txt_login',
    '.txt_login',
    'button:has-text("카카오")',
    'a:has-text("카카오")',
    ...TISTORY_SELECTORS.login.kakaoLoginButtons,
    'span.txt_login:has-text("카카오계정으로 로그인")',
    '.txt_login:has-text("카카오계정으로 로그인")',
    'span.txt_login',
    '.txt_login',
  ];

  for (const selector of selectors) {
    try {
      const target = page.locator(selector).first();
      if ((await target.count().catch(() => 0)) === 0) continue;
      if (!(await target.isVisible({ timeout: 1000 }).catch(() => false))) continue;
      const beforeUrl = String(typeof page.url === 'function' ? page.url() : '');
      const box = await target.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      } else {
        await target.evaluate((element: HTMLElement) => {
          const clickable = (element.closest('a,button') as HTMLElement | null) || element;
          clickable.click();
        });
      }
      await page.waitForTimeout(1500).catch(() => null);
      const afterUrl = String(typeof page.url === 'function' ? page.url() : '');
      if (afterUrl !== beforeUrl || /accounts\.kakao\.com/i.test(afterUrl)) {
        onLog?.('[TISTORY] Kakao login button clicked.');
        if (/accounts\.kakao\.com/i.test(afterUrl)) {
          await ensureKakaoLoginPersistenceIfVisible(page, onLog);
          await clickKakaoSavedAccountIfVisible(page, kakaoEmail, onLog);
        }
        return true;
      }
    } catch {
      // Try the next selector.
    }
  }

  try {
    const beforeUrl = String(typeof page.url === 'function' ? page.url() : '');
    const clicked = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('span.txt_login, .txt_login, a, button')) as HTMLElement[];
      const node = nodes.find((item) => (item.textContent || '').includes('카카오계정으로 로그인'));
      if (!node) return false;
      const clickable = (node.closest('a,button') as HTMLElement | null) || node;
      clickable.click();
      return true;
    });
    await page.waitForTimeout(1500).catch(() => null);
    const afterUrl = String(typeof page.url === 'function' ? page.url() : '');
    if (clicked && (afterUrl !== beforeUrl || /accounts\.kakao\.com/i.test(afterUrl))) {
      onLog?.('[TISTORY] Kakao login button clicked by fallback.');
      if (/accounts\.kakao\.com/i.test(afterUrl)) {
        await ensureKakaoLoginPersistenceIfVisible(page, onLog);
        await clickKakaoSavedAccountIfVisible(page, kakaoEmail, onLog);
      }
      return true;
    }
  } catch {
    // Ignore fallback errors.
  }

  return false;
}

export async function checkTistorySession(
  payload: Record<string, any> = {},
  env: Record<string, any> = {},
  onLog?: (message: string) => void,
): Promise<TistorySessionStatus> {
  const config = resolveTistoryConfig(payload, env);
  if (!config.blogName) {
    return {
      ok: false,
      authenticated: false,
      error: 'Tistory blog name is missing.',
    };
  }

  try {
    const launched = await launchTistoryContext(config, onLog);
    const page = launched.page;
    await page.goto(TISTORY_URLS.write(config.blogName), { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
    await page.waitForTimeout(1200).catch(() => null);
    let loginPage = await isTistoryLoginPage(page);
    if (loginPage) {
      await clickTistoryKakaoLoginIfVisible(page, onLog, config.kakaoEmail);
      await page.waitForTimeout(1800).catch(() => null);
      loginPage = await isTistoryLoginPage(page);
    }
    const titleCount = await page.locator('textarea#post-title-inp, #post-title-inp, textarea[placeholder*="제목"], input[placeholder*="제목"]').count().catch(() => 0);
    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    const authenticated = !loginPage && (titleCount > 0 || /\/manage\/newpost/i.test(currentUrl));
    if (authenticated) {
      await hideTistoryBrowserWindow(page, onLog).catch(() => false);
    }
    return {
      ok: true,
      authenticated,
      blogName: config.blogName,
      blogUrl: config.blogUrl,
      writeUrl: TISTORY_URLS.write(config.blogName),
      profileDir: config.profileDir,
    };
  } catch (error: any) {
    return {
      ok: false,
      authenticated: false,
      blogName: config.blogName,
      blogUrl: config.blogUrl,
      writeUrl: TISTORY_URLS.write(config.blogName),
      profileDir: config.profileDir,
      error: error?.message || String(error),
    };
  }
}

function dedupeTistoryCategories(categories: TistoryCategory[]): TistoryCategory[] {
  const seen = new Set<string>();
  const result: TistoryCategory[] = [];
  for (const category of categories) {
    const name = String(category.name || category.label || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const key = `${String(category.id || '').trim()}|${name}`.toLowerCase();
    const nameKey = name.toLowerCase();
    if (seen.has(key) || seen.has(nameKey)) continue;
    seen.add(key);
    seen.add(nameKey);
    result.push({
      ...category,
      name,
      label: category.label || name,
    });
  }
  return result;
}

async function extractTistoryCategoriesFromPage(page: any, source: 'editor' | 'manage'): Promise<TistoryCategory[]> {
  try {
    return await page.evaluate((categorySource: 'editor' | 'manage') => {
      const visible = (element: Element | null): element is HTMLElement => {
        if (!element) return false;
        const htmlElement = element as HTMLElement;
        const rect = htmlElement.getBoundingClientRect();
        const style = window.getComputedStyle(htmlElement);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };

      const normalizeText = (value: string) => String(value || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const blocked = /^(카테고리|카테고리 더보기|카테고리 없음|분류 전체보기|전체|전체보기|관리|추가|수정|삭제|저장|취소|확인|닫기|글쓰기|새 글|공개|비공개|보호|공지|홈|통계|스킨|댓글|방명록|콘텐츠|설정|블로그|메뉴|선택 안 함|선택 없음|기본모드|기본서체|HTML|마크다운|POWERED BY TINY)$/i;
      const looksCategory = (text: string) => {
        const cleaned = normalizeText(text).replace(/\(\d+\)$/g, '').trim();
        if (!cleaned || cleaned.length > 60) return false;
        if (blocked.test(cleaned)) return false;
        if (/powered\s+by\s+tiny|tinymce|기본\s*(?:모드|서체)|html|markdown|마크다운/i.test(cleaned)) return false;
        if (/^\d+$/.test(cleaned)) return false;
        if (/https?:\/\//i.test(cleaned)) return false;
        return /[가-힣a-zA-Z0-9]/.test(cleaned);
      };

      const readId = (element: HTMLElement): string => {
        const attrs = [
          element.getAttribute('data-category-id'),
          element.getAttribute('data-id'),
          element.getAttribute('data-value'),
          element.getAttribute('value'),
          element.getAttribute('rel'),
          element.id,
        ];
        const href = element.getAttribute('href') || '';
        const hrefMatch = href.match(/(?:category|categoryId|id)[=/](\d+)/i) || href.match(/[?&](?:category|categoryId|id)=(\d+)/i);
        if (hrefMatch?.[1]) attrs.unshift(hrefMatch[1]);
        const found = attrs.map((item) => normalizeText(item || '')).find(Boolean);
        return found || '';
      };

      const categories: Array<{ id?: string; name: string; label: string; source: 'editor' | 'manage' }> = [];
      const push = (name: string, element?: HTMLElement | null) => {
        const cleaned = normalizeText(name).replace(/\(\d+\)$/g, '').trim();
        if (!looksCategory(cleaned)) return;
        const id = element ? readId(element) : '';
        categories.push({
          ...(id ? { id } : {}),
          name: cleaned,
          label: cleaned,
          source: categorySource,
        });
      };

      const categoryLikeSelectors = categorySource === 'manage' ? [
        '[data-category-id]',
        '[data-category]',
        '[class*="category" i] a',
        '[class*="category" i] button',
        '[class*="category" i] li',
        '[id*="category" i] a',
        '[id*="category" i] button',
        '[id*="category" i] li',
        'a[href*="/category/"]',
        'a[href*="category"]',
      ] : [
        '[data-category-id]',
        '[data-category]',
        '[class*="category" i] a',
        '[class*="category" i] button',
        '[class*="category" i] li',
        '[id*="category" i] a',
        '[id*="category" i] button',
        '[id*="category" i] li',
        'a[href*="/category/"]',
        'a[href*="category"]',
      ];

      const nodes = Array.from(document.querySelectorAll(categoryLikeSelectors.join(','))) as HTMLElement[];
      for (const node of nodes) {
        if (!visible(node)) continue;
        const text = normalizeText(node.innerText || node.textContent || node.getAttribute('title') || node.getAttribute('aria-label') || '');
        push(text, node);
      }

      const fallbackNodes = categorySource === 'manage'
        ? Array.from(document.querySelectorAll('li, a, button, span, label')) as HTMLElement[]
        : [];
      for (const node of fallbackNodes) {
        if (!visible(node)) continue;
        const classId = `${node.className || ''} ${node.id || ''} ${node.getAttribute('href') || ''}`;
        if (!/category|cate|folder/i.test(classId)) continue;
        push(node.innerText || node.textContent || '', node);
      }

      return categories;
    }, source);
  } catch {
    return [];
  }
}

async function openEditorCategoryMenu(page: any): Promise<boolean> {
  for (const selector of TISTORY_SELECTORS.editor.categoryTriggers) {
    try {
      const target = page.locator(selector).first();
      if ((await target.count().catch(() => 0)) === 0) continue;
      if (!(await target.isVisible({ timeout: 1500 }).catch(() => false))) continue;
      await target.click({ timeout: 1500 }).catch(async () => {
        await target.evaluate((element: HTMLElement) => element.click());
      });
      await page.waitForTimeout(700).catch(() => null);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function loadTistoryCategories(
  payload: Record<string, any> = {},
  env: Record<string, any> = {},
  onLog?: (message: string) => void,
): Promise<TistoryCategoryLoadResult> {
  const config = resolveTistoryConfig(payload, env);
  if (!config.blogName) {
    return {
      ok: false,
      authenticated: false,
      error: 'Tistory blog name is missing.',
    };
  }

  let context: any | null = null;
  let pageToHide: any | null = null;
  let shouldHideAfterUse = false;
  try {
    const launched = await launchTistoryContext({ ...config, hiddenBrowser: true }, onLog);
    context = launched.context;
    const page = launched.page;
    pageToHide = page;

    const writeUrl = TISTORY_URLS.write(config.blogName);
    await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
    await page.waitForTimeout(1200).catch(() => null);
    if (await isTistoryLoginPage(page)) {
      await clickTistoryKakaoLoginIfVisible(page, onLog, config.kakaoEmail);
      return {
        ok: false,
        authenticated: false,
        blogName: config.blogName,
        blogUrl: config.blogUrl,
        error: 'Tistory login is required before loading categories.',
      };
    }

    await page.goto(TISTORY_URLS.category(config.blogName), { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
    await page.waitForTimeout(1500).catch(() => null);
    let categories: TistoryCategory[] = [];
    if (!(await isTistoryLoginPage(page))) {
      categories = await extractTistoryCategoriesFromPage(page, 'manage');
    }
    if (categories.length === 0) {
      await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
      await page.waitForTimeout(1200).catch(() => null);
      if (!(await isTistoryLoginPage(page))) {
        await openEditorCategoryMenu(page);
        categories = await extractTistoryCategoriesFromPage(page, 'editor');
      }
    }

    const normalized = dedupeTistoryCategories(categories);
    const result: TistoryCategoryLoadResult = {
      ok: true,
      authenticated: true,
      blogName: config.blogName,
      blogUrl: config.blogUrl,
      categories: normalized,
    };
    if (config.defaultCategory) result.selectedCategory = config.defaultCategory;
    shouldHideAfterUse = true;
    return result;
  } catch (error: any) {
    return {
      ok: false,
      authenticated: false,
      blogName: config.blogName,
      blogUrl: config.blogUrl,
      error: error?.message || String(error),
    };
  } finally {
    if (shouldHideAfterUse && pageToHide) {
      await hideTistoryBrowserWindow(pageToHide, onLog).catch(() => false);
    }
    context = null;
  }
}

export async function openTistoryLoginWindow(
  payload: Record<string, any> = {},
  env: Record<string, any> = {},
  onLog?: (message: string) => void,
): Promise<TistorySessionStatus> {
  const config = resolveTistoryConfig(payload, env);
  if (!config.blogName) {
    return {
      ok: false,
      authenticated: false,
      error: 'Tistory blog name is missing.',
    };
  }

  const launched = await launchTistoryContext(config, onLog);
  const page = launched.page;
  await page.goto(TISTORY_URLS.login, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
  await clickTistoryKakaoLoginIfVisible(page, onLog, config.kakaoEmail);
  onLog?.('[TISTORY] Login window opened. Complete Kakao/Tistory login in the browser.');

  // v3.8.156: 로그인 완료 자동 감지 + 자동 숨김 (background polling — 호출자는 즉시 응답)
  //   증상: 사용자가 카카오 로그인 후 창이 계속 떠있어 직접 닫아야 함
  //   해결: 5분간 url 변화 감시 → tistory 대시보드/관리 페이지 도달 시 자동 minimize
  (async () => {
    const maxWaitMs = 5 * 60 * 1000;
    const startedAt = Date.now();
    let lastUrl = '';
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const url = String(typeof page.url === 'function' ? page.url() : '');
        if (url === lastUrl) continue;
        lastUrl = url;
        // 로그인 성공 신호: tistory.com/manage, /admin, blogName.tistory.com (단 /login은 제외)
        const loggedInPattern = /tistory\.com\/(manage|admin)|^https?:\/\/[^/]+\.tistory\.com\/?$/i;
        const stillLoginPattern = /accounts\.kakao\.com|tistory\.com\/auth|login/i;
        if (loggedInPattern.test(url) && !stillLoginPattern.test(url)) {
          onLog?.('[TISTORY] 로그인 자동 감지 — 창 숨김');
          await hideTistoryBrowserWindow(page, onLog).catch(() => false);
          return;
        }
      } catch {
        // 페이지 닫힘 등 — 종료
        return;
      }
    }
  })().catch(() => null);

  return {
    ok: true,
    authenticated: false,
    blogName: config.blogName,
    blogUrl: config.blogUrl,
    writeUrl: TISTORY_URLS.write(config.blogName),
    profileDir: config.profileDir,
  };
}
