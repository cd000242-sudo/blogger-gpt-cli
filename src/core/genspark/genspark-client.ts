/**
 * 🔎 젠스파크 딥 리서치 연결 (v3.8.760)
 *
 * 공개 API 가 없어 화면을 조작한다. 실측(2026-10-10)으로 정한 것만 쓴다:
 *   · 진입 `agents?type=agentic_deep_research` → textarea(placeholder "무엇이든 물어보고 만들어보세요") → [aria-label="메시지 전송"]
 *   · 전송하면 주소가 `agents?id=<uuid>` — **내 작업 번호**. Dropshot 처럼 남의 결과와 섞일 일이 없다.
 *   · 완료 판정은 화면이 아니라 `GET /api/project?id=<uuid>` 의 data.status === 'FINISHED'. 실측 약 2분 10초.
 *   · 로그인 확인 `GET /api/is_login` — 로그인이면 cogen_id 가 있다.
 *
 * 로그인은 자동화 표시 없는 일반 브라우저 창으로 한다 — 구글 로그인이 자동화 브라우저를 막을 수 있다.
 * 실행은 같은 프로필을 Playwright 로 연다(화면 없이). 고객은 각자 자기 계정이다(공유 계정 금지 — Dropshot 759 사고).
 */
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { parseGensparkProject, type GensparkResearch } from './genspark-evidence';

export const GENSPARK_ORIGIN = 'https://www.genspark.ai';
export const DEEP_RESEARCH_URL = `${GENSPARK_ORIGIN}/agents?type=agentic_deep_research`;
const PROMPT_SELECTOR = 'textarea[placeholder="무엇이든 물어보고 만들어보세요"]';
const SEND_SELECTOR = '[aria-label="메시지 전송"]';

type Env = Record<string, string | undefined>;
type Log = (message: string) => void;

export function gensparkProfileDir(): string {
  return path.join(os.homedir(), '.blogger-gpt', 'genspark-profile');
}

/** 앱이 시작할 때 찾아 둔 크롬·엣지(installPuppeteerBrowserPath). 없으면 '' */
export function gensparkBrowserPath(env: Env = process.env): string {
  const candidate = String(env['PUPPETEER_EXECUTABLE_PATH'] || '');
  try { return candidate && fs.existsSync(candidate) ? candidate : ''; } catch { return ''; }
}

export function projectIdFromUrl(url: string): string {
  return (String(url || '').match(/[?&]id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1] || '';
}

export function readLoginResponse(json: unknown): { loggedIn: boolean; email: string } {
  const d = (json as any)?.data && typeof (json as any).data === 'object' ? (json as any).data : json;
  const id = String((d as any)?.cogen_id || '');
  return { loggedIn: !!id, email: id ? String((d as any)?.cogen_email || '') : '' };
}

/** 근거를 모으는 조사 지시 — 결론 글이 아니라 확인된 사실과 출처가 필요하다 */
export function buildGensparkPrompt(keyword: string): string {
  const topic = String(keyword || '').trim();
  if (!topic) return '';
  return `${topic}에 대해 조사해줘. 정부·공공기관·제조사 같은 공식 자료를 먼저 확인하고, 최신 날짜 기준으로 조건·기간·금액·방법을 정리해줘. 각 내용마다 출처 링크를 붙여줘.`;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

export async function fetchJsonInPage(page: any, url: string): Promise<any> {
  return await page.evaluate(async (u: string) => {
    const response = await fetch(u, { credentials: 'include' });
    return { status: response.status, json: await response.json().catch(() => null) };
  }, url);
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * v3.8.761 — 리서치·이미지·로그인 확인·로그인 창이 **같은 로그인 폴더**를 쓴다. 브라우저는 한 폴더를 두 번 못 연다.
 * 그래서 모든 젠스파크 일은 이 줄을 선다 — 앞의 일이 끝나야(실패해도) 다음 일이 시작한다.
 */
export function runGensparkExclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task);
  chain = next.catch(() => undefined);
  return next;
}

/**
 * 로그인 창 — 일반 브라우저를 띄우고, 로그인되면 닫는다.
 * 사장님 실측: 이 방식(디버그 포트만 연 일반 크롬)으로 구글 계정 로그인이 됐다.
 */
export function openGensparkLoginWindow(options: { onLog?: Log; timeoutMs?: number } = {}): Promise<{ ok: boolean; email?: string; error?: string }> {
  return runGensparkExclusive(() => openLoginWindowOnce(options));
}

async function openLoginWindowOnce(options: { onLog?: Log; timeoutMs?: number }): Promise<{ ok: boolean; email?: string; error?: string }> {
  const exe = gensparkBrowserPath();
  if (!exe) return { ok: false, error: '크롬이나 엣지를 찾지 못했습니다. 크롬을 설치한 뒤 다시 눌러 주세요.' };
  const profile = gensparkProfileDir();
  fs.mkdirSync(profile, { recursive: true });
  const port = await freePort();
  const child = spawn(exe, [`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check', GENSPARK_ORIGIN], { stdio: 'ignore', windowsHide: false });
  let exited = false;
  child.once('exit', () => { exited = true; });
  options.onLog?.('🔐 젠스파크 로그인 창을 열었습니다. 로그인하면 자동으로 닫힙니다.');
  // 앱의 playwright 타입 선언이 launch 만 안다 — dropshotGenerator 와 같이 any 로 쓴다
  const { chromium } = (await import('playwright')) as any;
  const deadline = Date.now() + (options.timeoutMs ?? 10 * 60_000);
  let browser: any = null;
  try {
    while (Date.now() < deadline) {
      if (exited) return { ok: false, error: '로그인 전에 창이 닫혔습니다.' };
      await new Promise((r) => setTimeout(r, 3000));
      try {
        browser = browser || await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
        const page = browser.contexts()[0]?.pages().find((p: any) => p.url().startsWith(GENSPARK_ORIGIN));
        if (!page) continue;
        const { json } = await fetchJsonInPage(page, '/api/is_login');
        const login = readLoginResponse(json);
        if (login.loggedIn) {
          options.onLog?.('✅ 젠스파크 로그인 확인 — 창을 닫습니다.');
          const cdp = await browser.newBrowserCDPSession();
          await cdp.send('Browser.close').catch(() => {});
          return { ok: true, email: login.email };
        }
      } catch { /* 창이 아직 뜨는 중 — 다음 회차 */ }
    }
    return { ok: false, error: '10분 안에 로그인이 확인되지 않았습니다.' };
  } finally {
    if (!exited) { try { child.kill(); } catch { /* 이미 닫힘 */ } }
  }
}

/** 화면 없는 브라우저는 자기 이름에 "HeadlessChrome" 을 붙인다 — 젠스파크(Cloudflare)가 이걸 보고 봇 확인 화면을 띄운다(실측) */
export function visibleUserAgent(userAgent: string): string {
  return String(userAgent || '').replace(/HeadlessChrome\//g, 'Chrome/');
}

/** 화면 없이 젠스파크 로그인 폴더를 연다 — 반드시 runGensparkExclusive 안에서 부를 것 */
export async function openGensparkHeadless(onLog?: Log): Promise<{ context: any; page: any }> {
  const exe = gensparkBrowserPath();
  if (!exe) throw new Error('GENSPARK_NO_BROWSER: 크롬이나 엣지를 찾지 못했습니다.');
  const { chromium } = (await import('playwright')) as any;
  let context: any;
  try {
    context = await chromium.launchPersistentContext(gensparkProfileDir(), {
      executablePath: exe,
      headless: true,
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled', '--lang=ko-KR,ko', '--disable-gpu'],
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: 1280, height: 900 },
      locale: 'ko-KR',
    });
  } catch (error: any) {
    onLog?.(`⚠️ 젠스파크 브라우저를 열지 못했습니다: ${String(error?.message || error).slice(0, 120)}`);
    throw new Error('GENSPARK_PROFILE_BUSY: 젠스파크 로그인 창이 열려 있으면 닫고 다시 시도해 주세요.');
  }
  // v3.8.760 실측: 이름에서 Headless 를 빼면 봇 확인 없이 딥 리서치 화면이 뜬다. 그 브라우저의 실제 버전은 그대로 둔다
  const page = context.pages()[0] || await context.newPage();
  const userAgent = visibleUserAgent(await page.evaluate(() => navigator.userAgent));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.setUserAgentOverride', { userAgent, acceptLanguage: 'ko-KR,ko' });
  return { context, page };
}

/** 설정 화면용 — 화면 없이 열어 로그인만 확인한다 */
export function checkGensparkLogin(onLog?: Log): Promise<{ loggedIn: boolean; email: string; error?: string }> {
  return runGensparkExclusive(() => checkLoginOnce(onLog));
}

async function checkLoginOnce(onLog?: Log): Promise<{ loggedIn: boolean; email: string; error?: string }> {
  let context: any = null;
  try {
    const opened = await openGensparkHeadless(onLog);
    context = opened.context;
    const page = opened.page;
    await page.goto(GENSPARK_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const { json } = await fetchJsonInPage(page, '/api/is_login');
    return readLoginResponse(json);
  } catch (error: any) {
    return { loggedIn: false, email: '', error: String(error?.message || error).slice(0, 200) };
  } finally {
    await context?.close().catch(() => {});
  }
}

export interface GensparkRunResult {
  ok: boolean;
  projectId?: string;
  research?: GensparkResearch;
  elapsedMs: number;
  error?: string;
}

/** 딥 리서치 1회 — 한 번에 하나씩. 끝나지 않아도 그때까지 읽은 페이지는 돌려준다(finished=false) */
export function runGensparkDeepResearch(keyword: string, options: { onLog?: Log; timeoutMs?: number; isCanceled?: () => boolean } = {}): Promise<GensparkRunResult> {
  return runGensparkExclusive(() => runOnce(keyword, options));
}

async function runOnce(keyword: string, options: { onLog?: Log; timeoutMs?: number; isCanceled?: () => boolean }): Promise<GensparkRunResult> {
  const startedAt = Date.now();
  const prompt = buildGensparkPrompt(keyword);
  if (!prompt) return { ok: false, elapsedMs: 0, error: '키워드가 비었습니다' };
  const log = options.onLog;
  let context: any = null;
  try {
    const opened = await openGensparkHeadless(log);
    context = opened.context;
    const page = opened.page;
    await page.goto(DEEP_RESEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const login = readLoginResponse((await fetchJsonInPage(page, '/api/is_login')).json);
    if (!login.loggedIn) return { ok: false, elapsedMs: Date.now() - startedAt, error: 'GENSPARK_LOGIN_REQUIRED: 설정에서 젠스파크 로그인을 먼저 해 주세요.' };
    await page.locator(PROMPT_SELECTOR).first().fill(prompt, { timeout: 20_000 });
    await page.locator(SEND_SELECTOR).first().click({ timeout: 10_000 });
    log?.('🔎 젠스파크 딥 리서치 시작 — 보통 2~3분 걸립니다');

    let projectId = '';
    for (let i = 0; i < 60 && !projectId; i += 1) {
      await page.waitForTimeout(1000);
      projectId = projectIdFromUrl(page.url());
    }
    if (!projectId) return { ok: false, elapsedMs: Date.now() - startedAt, error: '젠스파크가 작업 번호를 주지 않았습니다(전송 실패)' };

    const deadline = startedAt + (options.timeoutMs ?? 8 * 60_000);
    let research: GensparkResearch | undefined;
    let lastPages = -1;
    while (Date.now() < deadline) {
      if (options.isCanceled?.()) return { ok: false, projectId, elapsedMs: Date.now() - startedAt, error: 'CANCELED_BY_USER', ...(research ? { research } : {}) };
      await page.waitForTimeout(5000);
      const { status, json } = await fetchJsonInPage(page, `/api/project?id=${projectId}`);
      if (status !== 200 || !json) continue;
      research = parseGensparkProject(json);
      if (research.pages.length !== lastPages) {
        lastPages = research.pages.length;
        log?.(`🔎 젠스파크: 검색 ${research.queries.length}회 · 읽은 페이지 ${research.pages.length}곳 (${Math.round((Date.now() - startedAt) / 1000)}초)`);
      }
      if (research.finished) return { ok: true, projectId, research, elapsedMs: Date.now() - startedAt };
      if (/FAIL|ERROR|CANCEL/i.test(research.status)) return { ok: false, projectId, research, elapsedMs: Date.now() - startedAt, error: `젠스파크 작업 상태 ${research.status}` };
    }
    return { ok: false, projectId, elapsedMs: Date.now() - startedAt, error: 'GENSPARK_TIMEOUT: 시간 안에 끝나지 않았습니다', ...(research ? { research } : {}) };
  } catch (error: any) {
    return { ok: false, elapsedMs: Date.now() - startedAt, error: String(error?.message || error).slice(0, 200) };
  } finally {
    await context?.close().catch(() => {});
  }
}
