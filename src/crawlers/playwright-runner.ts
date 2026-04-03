import type { Browser, BrowserContext, Page, Route, Response } from 'playwright';

export interface CrawlOptions {
  timeoutMs?: number;
  enableImages?: boolean;
  headless?: boolean; // false → 크롬 창 보이게 (네이버 크롤링처럼)
  extraHeaders?: Record<string, string>;
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
  userAgent?: string;
  throttleMs?: { min: number; max: number };
}

export interface CrawlResourceEntry {
  url: string;
  type: string;
  status?: number;
}

export interface CrawlResult {
  html: string;
  resources: CrawlResourceEntry[];
  durationMs: number;
}

const DEFAULT_TIMEOUT = 30_000;

// ── 최신 실제 Chrome UA (2024.12 기준) ──
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const DEFAULT_THROTTLE: Required<CrawlOptions>['throttleMs'] = { min: 600, max: 1600 };
const DEFAULT_MAX_RETRIES = 2;

type PlaywrightModule = typeof import('playwright');

class PlaywrightUnavailableError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'PlaywrightUnavailableError';
    if (cause && typeof (cause as any).stack === 'string') {
      this.stack = `${this.stack ?? ''}\nCaused by: ${(cause as Error).stack}`;
    }
  }
}

let playwrightModulePromise: Promise<PlaywrightModule> | null = null;

async function loadPlaywrightModule(): Promise<PlaywrightModule> {
  if (!playwrightModulePromise) {
    playwrightModulePromise = import('playwright').catch((error) => {
      playwrightModulePromise = null;
      const hint =
        'Playwright 모듈(playwright)을 찾을 수 없습니다. 상세페이지 크롤러를 사용하려면 `npm install playwright` 명령을 실행한 뒤 앱을 다시 시작하세요.';
      throw new PlaywrightUnavailableError(hint, error);
    });
  }
  return playwrightModulePromise;
}

/**
 * Public entry point with retry & throttling safeguards.
 */
export async function fetchPage(targetUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const { chromium } = await loadPlaywrightModule();
  const maxRetries = options.timeoutMs && options.timeoutMs > 45_000 ? 1 : DEFAULT_MAX_RETRIES;
  let attempt = 0;
  let backoff = { ...DEFAULT_THROTTLE };
  let lastError: unknown = null;

  while (attempt <= maxRetries) {
    try {
      if (attempt > 0) {
        await sleepWithThrottle(backoff);
      }
      return await executeFetch(targetUrl, options, chromium);
    } catch (error) {
      lastError = error;
      if (!isRetriableError(error) || attempt === maxRetries) {
        throw error;
      }
      backoff = {
        min: Math.min(backoff.min + 400, backoff.min + 1600),
        max: Math.min(backoff.max + 800, backoff.max + 2600)
      };
      attempt += 1;
    }
  }

  throw lastError ?? new Error('Crawler failed with unknown error.');
}

async function executeFetch(
  targetUrl: string,
  options: CrawlOptions,
  chromium: PlaywrightModule['chromium']
): Promise<CrawlResult> {
  const startedAt = Date.now();

  // ── 🛡️ Stealth Launch: 자동화 감지 우회 ──
  const browser = await chromium.launch({
    headless: options.headless !== false,
    args: [
      '--disable-blink-features=AutomationControlled',        // WebDriver 감지 비활성화
      '--disable-features=IsolateOrigins,site-per-process',   // 사이트 격리 비활성화
      '--disable-web-security',                               // CORS 우회
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',                                   // "자동화된 소프트웨어" 바 숨기기
      '--window-size=1280,900',
      '--disable-extensions',
      '--disable-dev-shm-usage',
      '--lang=ko-KR,ko',
    ],
  } as any);
  let context: BrowserContext | null = null;

  try {
    context = await createStealthContext(browser, options);
    const page = await context.newPage();

    if (options.extraHeaders) {
      await page.setExtraHTTPHeaders(options.extraHeaders);
    }

    await page.route('**/*', async (route: Route) => {
      if (options.enableImages === false) {
        const requestType = route.request().resourceType();
        if (requestType === 'image' || requestType === 'media') {
          await route.abort();
          return;
        }
      }
      await route.continue();
    });

    const resources: CrawlResourceEntry[] = [];
    page.on('response', (response: Response) => {
      try {
        resources.push({
          url: response.url(),
          type: response.request().resourceType(),
          status: response.status()
        });
      } catch {
        resources.push({
          url: response.url(),
          type: response.request().resourceType()
        });
      }
    });

    // ── 🛡️ Smart Wait: CSR 사이트 대응 ──
    // networkidle는 빈 HTML 셸에서 너무 빨리 resolve → domcontentloaded 후 콘텐츠 대기
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT
    });

    // JS 프레임워크가 렌더링을 완료할 때까지 대기 (최대 10초)
    try {
      await (page as any).waitForFunction(
        () => {
          const text = document.body?.innerText || '';
          // 실제 콘텐츠가 100자 이상 렌더링될 때까지 대기
          return text.length > 100 || document.querySelectorAll('img').length > 3;
        },
        { timeout: 10000 }
      );
    } catch {
      // fallback: 타임아웃이어도 현재 상태로 진행
    }

    // 추가 대기 (lazy-load 이미지 등)
    await (page as any).waitForTimeout(2000);

    await autoScroll(page);
    await sleepWithThrottle(options.throttleMs);

    const html = await page.content();
    const durationMs = Date.now() - startedAt;

    return {
      html,
      resources,
      durationMs
    };
  } finally {
    if (context) {
      await context.close();
    }
    await browser.close();
  }
}

// ── 🛡️ Stealth Context: 봇 감지 우회용 브라우저 컨텍스트 ──
async function createStealthContext(browser: Browser, options: CrawlOptions): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: options.userAgent || DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 실제 브라우저처럼 보이기 위한 권한 설정
    permissions: ['geolocation'],
    geolocation: { latitude: 37.5665, longitude: 126.9780 }, // 서울
    colorScheme: 'light',
    // JavaScript 활성화 (기본값이지만 명시)
    javaScriptEnabled: true,
    // 실제 브라우저 HTTP 헤더 추가
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  if (options.cookies?.length) {
    await context.addCookies(options.cookies);
  }

  // ── 🛡️ Anti-Detection Init Script ──
  // Playwright 자동화 탐지를 우회하는 JavaScript 주입
  await (context as any).addInitScript(() => {
    // 1. navigator.webdriver 숨기기 (가장 중요!)
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
    });

    // 2. Chrome runtime 객체 주입
    if (!(window as any).chrome) {
      (window as any).chrome = {
        runtime: {
          onMessage: { addListener: () => { }, removeListener: () => { } },
          sendMessage: () => { },
          connect: () => { },
          id: undefined,
        },
        loadTimes: () => ({}),
        csi: () => ({}),
      };
    }

    // 3. Permissions API 패치 (Notification 권한 쿼리 우회)
    const originalQuery = window.navigator.permissions?.query;
    if (originalQuery) {
      (window.navigator.permissions as any).query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied' as PermissionState, onchange: null });
        }
        return originalQuery.call(window.navigator.permissions, parameters);
      };
    }

    // 4. plugins/mimeTypes 위조 (비어있으면 헤드리스 감지됨)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        (arr as any).item = (i: number) => arr[i] || null;
        (arr as any).namedItem = (n: string) => arr.find(p => p.name === n) || null;
        (arr as any).refresh = () => { };
        return arr;
      },
      configurable: true,
    });

    // 5. languages 설정
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ko-KR', 'ko', 'en-US', 'en'],
      configurable: true,
    });

    // 6. WebGL 렌더러 위조 (헤드리스 감지 방지)
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) return 'Intel Inc.';           // VENDOR
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // RENDERER
      return getParameter.call(this, parameter);
    };

    // 7. connection 속성 (네트워크 정보)
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
      configurable: true,
    });

    // 8. 자동화 관련 속성 숨기기
    Object.defineProperty(navigator, 'maxTouchPoints', {
      get: () => 0, // 데스크탑은 0
      configurable: true,
    });

    // 9. iframe contentWindow 접근 시 에러 방지
    const origDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow');
    if (origDesc) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
        get: function () {
          return origDesc.get?.call(this);
        },
        configurable: true,
      });
    }
  });

  return context;
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight || totalHeight > 40000) {
          clearInterval(timer);
          resolve();
        }
      }, 200);
    });
  });
}

async function sleepWithThrottle(throttle?: CrawlOptions['throttleMs']): Promise<void> {
  const range = throttle ?? DEFAULT_THROTTLE;
  const delay = Math.floor(range.min + Math.random() * Math.max(range.max - range.min, 0));
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

function isRetriableError(error: unknown): boolean {
  if (!error) return false;
  const message = (error as Error).message || '';
  return (
    message.includes('Timeout') ||
    message.includes('net::ERR') ||
    message.includes('Request timed out') ||
    message.includes('Status 429') ||
    message.includes('Status 403') ||
    message.includes('Status 502') ||
    message.includes('Status 503')
  );
}
