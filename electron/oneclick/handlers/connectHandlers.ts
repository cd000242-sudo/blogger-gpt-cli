// electron/oneclick/handlers/connectHandlers.ts
// IPC: 플랫폼 연동 (WordPress App Password / Blogger OAuth) — 3채널

import { ipcMain } from 'electron';
import { connectStateManager } from '../state/instances';
import type { ConnectState } from '../types';
import { launchBrowser } from '../utils/browser';
import { automateWordPressConnect } from '../automation/connect/wordpressConnect';
import { automateBloggerConnect } from '../automation/connect/bloggerConnect';

const BLOGGER_ID_EXTRACT_KEY = 'blogger-blog-id';
const BLOGGER_ID_LOGIN_TIMEOUT_MS = 15 * 60 * 1000;
const BLOGGER_ID_SELECT_TIMEOUT_MS = 5 * 60 * 1000;
const BLOGGER_ID_POLL_MS = 2000;
const BLOGGER_ID_CLOSE_AFTER_DONE_MS = 10 * 60 * 1000;
const BLOGGER_ID_CLOSE_AFTER_ERROR_MS = 5 * 60 * 1000;
const CONNECT_CLOSE_AFTER_DONE_MS = 10 * 60 * 1000;
const CONNECT_TOTAL_STEPS: Record<string, number> = {
  blogger: 9,
  blogspot: 9,
  wordpress: 7,
  [BLOGGER_ID_EXTRACT_KEY]: 3,
};

function isBloggerLoginUrl(url: string): boolean {
  return /accounts\.google\.com|signin/i.test(url || '');
}

function isPageClosed(page: any): boolean {
  try {
    return typeof page?.isClosed === 'function' ? page.isClosed() : false;
  } catch {
    return false;
  }
}

function normalizeClosedPageError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error || '');
  if (/Target page|context or browser has been closed|Browser closed|Page closed/i.test(message)) {
    return new Error('브라우저 창이 닫혔습니다. Blog ID 자동 가져오기를 다시 누른 뒤 로그인/블로그 선택을 완료해주세요.');
  }
  return error instanceof Error ? error : new Error(message);
}

async function waitForOpenPage(page: any, ms: number): Promise<void> {
  if (isPageClosed(page)) throw normalizeClosedPageError('Page closed');
  try {
    await page.waitForTimeout(ms);
  } catch (error) {
    throw normalizeClosedPageError(error);
  }
}

function extractBlogIdFromUrl(url: string): string {
  const patterns = [
    /\/blog\/(?:posts|pages|stats|settings|layout|theme|comments)\/(\d+)/,
    /[?&]blogID=(\d+)/,
    /[?&]blogId=(\d+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function extractBloggerBlogIdFromPage(page: any): Promise<string> {
  const currentUrl = page.url();
  const fromUrl = extractBlogIdFromUrl(currentUrl);
  if (fromUrl) return fromUrl;

  return await page.evaluate(() => {
    const patterns = [
      /\/blog\/(?:posts|pages|stats|settings|layout|theme|comments)\/(\d+)/,
      /[?&]blogID=(\d+)/,
      /[?&]blogId=(\d+)/,
    ];
    const candidates = [
      location.href,
      document.body?.innerText || '',
      ...Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href),
    ];

    for (const value of candidates) {
      for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match?.[1]) return match[1];
      }
    }
    return '';
  });
}

async function getFirstBloggerBlogHref(page: any): Promise<string> {
  if (isPageClosed(page)) throw normalizeClosedPageError('Page closed');
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/blog/"]')) as HTMLAnchorElement[];
    return links.map(a => a.href).find(Boolean) || '';
  });
}

async function waitForBloggerLoginIfNeeded(state: ConnectState, page: any): Promise<void> {
  const startedAt = Date.now();
  while (!state.cancelled) {
    if (isPageClosed(page)) throw normalizeClosedPageError('Page closed');
    const currentUrl = page.url();
    if (!isBloggerLoginUrl(currentUrl)) return;

    state.stepStatus = 'waiting-login';
    state.message = '열린 브라우저에서 Google 로그인을 완료해주세요. 2FA/CAPTCHA가 있어도 창을 닫지 않고 최대 15분까지 기다립니다.';

    if (Date.now() - startedAt > BLOGGER_ID_LOGIN_TIMEOUT_MS) {
      throw new Error('Google 로그인 대기 시간이 15분을 넘었습니다. Blog ID 자동 버튼을 다시 눌러주세요.');
    }
    await waitForOpenPage(page, BLOGGER_ID_POLL_MS);
  }
}

async function waitForBloggerBlogIdSelection(state: ConnectState, page: any): Promise<string> {
  const startedAt = Date.now();
  let navigatedFirstBlog = false;

  while (!state.cancelled && Date.now() - startedAt <= BLOGGER_ID_SELECT_TIMEOUT_MS) {
    if (isPageClosed(page)) throw normalizeClosedPageError('Page closed');

    const blogId = await extractBloggerBlogIdFromPage(page);
    if (blogId) return blogId;

    if (!navigatedFirstBlog) {
      const firstBlogHref = await getFirstBloggerBlogHref(page);
      if (firstBlogHref) {
        navigatedFirstBlog = true;
        state.stepStatus = 'running';
        state.message = 'Blogger 블로그 링크를 찾았습니다. Blog ID 확인 페이지로 이동합니다...';
        await page.goto(firstBlogHref, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await waitForOpenPage(page, BLOGGER_ID_POLL_MS);
        continue;
      }
    }

    state.stepStatus = 'waiting-login';
    state.message = 'Blogger 화면에서 블로그를 하나 선택해 주세요. 선택 후 Blog ID를 자동으로 찾습니다. 창은 최대 5분 동안 유지됩니다.';
    await waitForOpenPage(page, BLOGGER_ID_POLL_MS);
  }

  return '';
}

export function registerConnectHandlers(): void {
  // 플랫폼 연동 시작
  ipcMain.handle('oneclick:platform-connect', async (_evt, args: { platform: string; siteUrl?: string }) => {
    const { platform, siteUrl } = args;

    await connectStateManager.reset(platform);
    const state = connectStateManager.getOrCreate(platform, (): ConnectState => ({
      platform,
      currentStep: 0,
      totalSteps: CONNECT_TOTAL_STEPS[platform] || 0,
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      results: null,
      browser: null,
      page: null,
    }));

    try {
      state.stepStatus = 'running';
      state.message = '자동화 브라우저를 확인하는 중...';

      const { browser, page } = await launchBrowser({
        viewport: { width: 1280, height: 900 },
        onStatus: (message) => {
          state.stepStatus = 'running';
          state.message = message;
        },
      });
      state.browser = browser;
      state.page = page;

      const run = async () => {
        try {
          if (platform === 'wordpress') {
            if (!siteUrl) throw new Error('WordPress 사이트 URL이 필요합니다.');
            state.totalSteps = CONNECT_TOTAL_STEPS.wordpress;
            await automateWordPressConnect(state, page, siteUrl);
          } else if (platform === 'blogger' || platform === 'blogspot') {
            state.totalSteps = CONNECT_TOTAL_STEPS[platform] || CONNECT_TOTAL_STEPS.blogger;
            await automateBloggerConnect(state, page);
          } else {
            throw new Error(`지원하지 않는 플랫폼: ${platform}`);
          }

          if (!state.cancelled) {
            state.completed = true;
            state.stepStatus = 'done';
            if (!state.message.startsWith('⚠️')) {
              state.message = '✅ 연동 완료! 추출된 값을 환경설정에 저장합니다.';
            }
          }
        } catch (err) {
          if (!state.cancelled) {
            state.error = err instanceof Error ? err.message : String(err);
            state.stepStatus = 'error';
            state.message = `❌ 오류: ${state.error}`;
          }
        } finally {
          // 사용자가 Google Cloud/OAuth 화면을 확인하거나 영상 촬영할 수 있도록 완료 후에도 창을 충분히 유지한다.
          const closeDelayMs = state.cancelled
            ? 0
            : (state.stepStatus === 'error' || state.error ? 5 * 60 * 1000 : CONNECT_CLOSE_AFTER_DONE_MS);
          setTimeout(async () => {
            try { await browser.close(); } catch { /* ignore */ }
          }, closeDelayMs);
        }
      };
      run().catch((e) => console.error('[ONECLICK-CONNECT] Unhandled:', e));

      return { ok: true };
    } catch (error) {
      state.error = error instanceof Error ? error.message : '연동 시작 실패';
      state.stepStatus = 'error';
      return { ok: false, error: state.error };
    }
  });

  // 연동 상태 조회
  ipcMain.handle('oneclick:get-connect-status', async (_evt, args: { platform: string }) => {
    const state = connectStateManager.get(args.platform);
    if (!state) return { ok: false, error: '실행 중인 연동이 없습니다' };

    return {
      ok: true,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      cancelled: state.cancelled,
      error: state.error,
      results: state.results,
    };
  });

  // 연동 취소
  ipcMain.handle('oneclick:cancel-connect', async (_evt, args: { platform: string }) => {
    const state = connectStateManager.get(args.platform);
    if (state) {
      state.cancelled = true;
      state.stepStatus = 'error';
      state.message = '사용자가 취소함';
      await connectStateManager.reset(args.platform);
    }
    return { ok: true };
  });

  // Blogger Blog ID만 따로 가져오기 — OAuth Client ID/Secret은 사용자가 복사하고,
  // Blog ID는 앱이 Blogger 관리자 화면에서 자동 추출하도록 분리한다.
  ipcMain.handle('oneclick:extract-blogger-blog-id', async () => {
    const platform = BLOGGER_ID_EXTRACT_KEY;
    if (connectStateManager.isBusy(platform)) {
      return { ok: false, error: 'Blog ID 자동 가져오기가 이미 진행 중입니다.' };
    }

    await connectStateManager.reset(platform);
    const state = connectStateManager.getOrCreate(platform, (): ConnectState => ({
      platform,
      currentStep: 0,
      totalSteps: CONNECT_TOTAL_STEPS[BLOGGER_ID_EXTRACT_KEY],
      stepStatus: 'idle',
      message: '',
      completed: false,
      cancelled: false,
      error: null,
      results: null,
      browser: null,
      page: null,
    }));

    try {
      state.stepStatus = 'running';
      state.message = '자동화 브라우저를 확인하는 중...';
      const { browser, page } = await launchBrowser({
        viewport: { width: 1280, height: 900 },
        onStatus: (message) => {
          state.stepStatus = 'running';
          state.message = message;
        },
      });
      state.browser = browser;
      state.page = page;

      const run = async () => {
        let closeDelayMs = BLOGGER_ID_CLOSE_AFTER_ERROR_MS;
        try {
          await page.goto('https://www.blogger.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await waitForOpenPage(page, BLOGGER_ID_POLL_MS);

          if (state.cancelled) return;

          state.currentStep = 0;
          await waitForBloggerLoginIfNeeded(state, page);

          if (state.cancelled) return;

          state.currentStep = 1;
          state.stepStatus = 'running';
          state.message = '로그인 확인 완료. Blog ID를 찾는 중입니다...';
          await waitForOpenPage(page, BLOGGER_ID_POLL_MS);

          if (state.cancelled) return;

          state.currentStep = 2;
          let blogId = await waitForBloggerBlogIdSelection(state, page);

          if (!blogId) {
            const firstBlogHref = await page.evaluate(() => {
              const links = Array.from(document.querySelectorAll('a[href*="/blog/"]')) as HTMLAnchorElement[];
              return links.map(a => a.href).find(Boolean) || '';
            });
            if (firstBlogHref) {
              await page.goto(firstBlogHref, { waitUntil: 'domcontentloaded', timeout: 20000 });
              await waitForOpenPage(page, BLOGGER_ID_POLL_MS);
              blogId = await extractBloggerBlogIdFromPage(page);
            }
          }

          if (!blogId) {
            state.stepStatus = 'error';
            state.error = 'Blog ID를 자동으로 찾지 못했습니다. 열린 Blogger 창에서 블로그를 하나 선택한 뒤 다시 Blog ID 자동 버튼을 눌러주세요. 창은 5분 동안 더 열어둡니다.';
            state.message = `⚠️ ${state.error}`;
            return;
          }

          state.results = { blogId };
          state.completed = true;
          state.stepStatus = 'done';
          state.message = `✅ Blog ID 자동 추출 완료: ${blogId}`;
          closeDelayMs = BLOGGER_ID_CLOSE_AFTER_DONE_MS;
        } catch (err) {
          if (!state.cancelled) {
            state.stepStatus = 'error';
            const error = normalizeClosedPageError(err);
            state.error = error.message;
            state.message = `⚠️ Blog ID 자동 추출 실패: ${state.error}`;
          }
        } finally {
          if (state.cancelled) closeDelayMs = 0;
          setTimeout(async () => {
            try { await state.browser?.close(); } catch { /* ignore */ }
          }, closeDelayMs);
        }
      };
      run().catch((e) => console.error('[ONECLICK-BLOGGER-ID] Unhandled:', e));

      return { ok: true };
    } catch (error) {
      state.stepStatus = 'error';
      state.error = error instanceof Error ? error.message : 'Blog ID 자동 가져오기 시작 실패';
      state.message = `❌ ${state.error}`;
      return { ok: false, error: state.error };
    }
  });
}
