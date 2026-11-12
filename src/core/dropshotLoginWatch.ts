/**
 * Dropshot login-window watcher (v3.8.773).
 *
 * Measured 2026-11-12 (F:\work\orbit-release\ds_watch.log): after the Google sign-in finished, the session cookies and the
 * session API ("user" present) were there 2 s later, but the tab stayed on https://stock.dropshot.io/ko/logIn for good.
 * The old wait loop only looked at tabs that were already on the board, so it waited the full 6 minutes and reported
 * "6분 내 로그인 미완료". This watcher notices the login from the session itself and opens the board on its own.
 *
 * Safety rules:
 *  - A tab is never moved away from the login flow on a weak hint: only a session API answer with a user (or, when the
 *    API cannot be read, a long session cookie) opens the board. A stale cookie with "nobody signed in" is ignored.
 *  - Third-party tabs (Google / Kakao sign-in pop-ups) are never navigated.
 *  - A slow board navigation is not a failure: the next tick re-judges from the tab address and the session.
 */

export type DropshotSessionProbeResult = { ok: boolean; status?: number; name?: string; signedOut?: boolean };

export type DropshotLoginWatchDeps = {
  boardUrl: string;
  isBoardUrl: (url: string) => boolean;
  isLoginUrl: (url: string) => boolean;
  /** Session API check inside a tab that is already on the board. */
  probeBoardPage: (page: any) => Promise<DropshotSessionProbeResult>;
  /** Session API check through the browser context (works while the tab still sits on the login origin). */
  probeContextSession: (context: any) => Promise<DropshotSessionProbeResult>;
  onLog?: (message: string) => void;
  now?: () => number;
};

export type DropshotLoginTickResult = { done: false } | { done: true; page: any; name?: string };

const BOARD_RETRY_MS = 20_000;
const MAX_BOARD_TRIES = 4;
const BOARD_GOTO_TIMEOUT_MS = 30_000;
const PERIODIC_PROBE_EVERY = 10;
const DROPSHOT_HOST = /(^|\.)dropshot\.io$/i;

function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

function urlOf(page: any): string {
  try { return String(page?.url?.() || ''); } catch { return ''; }
}

function pagesOf(context: any): any[] {
  try { return context?.pages?.() || []; } catch { return []; }
}

/** The session cookie the site sets at sign-in (httpOnly, long value). */
export function isDropshotSessionCookie(cookie: any): boolean {
  return /dropshot/i.test(String(cookie?.domain || ''))
    && /^ds\.session-token/i.test(String(cookie?.name || ''))
    && String(cookie?.value || '').length > 100;
}

async function hasSessionCookie(context: any): Promise<boolean> {
  try {
    const cookies = await context.cookies();
    return (cookies || []).some(isDropshotSessionCookie);
  } catch {
    return false;
  }
}

/**
 * Session API through the browser context. Unlike a fetch inside the page this is not a cross-origin request
 * (stock -> aistudio), so it works while the tab is still on the login address.
 */
export async function probeDropshotContextSession(
  context: any,
  sessionUrl: string,
  classify: (status: number, bodyText: string) => DropshotSessionProbeResult,
): Promise<DropshotSessionProbeResult> {
  try {
    const res = await context.request.get(sessionUrl, { timeout: 8_000 });
    const text = await res.text().catch(() => '');
    return classify(Number(res.status()), text);
  } catch {
    return { ok: false };
  }
}

export function createDropshotLoginWatcher(context: any, deps: DropshotLoginWatchDeps) {
  const now = deps.now ?? Date.now;
  let tickNo = 0;
  let boardTries = 0;
  let lastBoardTryAt = 0;

  const confirmBoard = async (page: any): Promise<DropshotLoginTickResult | null> => {
    const inPage = await deps.probeBoardPage(page);
    if (inPage.ok) return { done: true, page, ...(inPage.name ? { name: inPage.name } : {}) };
    // The page fetch can fail while the board is still loading; the context request does not depend on the page.
    const viaContext = await deps.probeContextSession(context);
    if (viaContext.ok) return { done: true, page, ...(viaContext.name ? { name: viaContext.name } : {}) };
    return null;
  };

  const findBoardTab = (): any => pagesOf(context).find((page) => deps.isBoardUrl(urlOf(page)));

  // Never a third-party sign-in tab. Prefer the login tab, then any other Dropshot tab, then a blank tab.
  const pickTab = (pages: any[]): any => {
    const dropshotTabs = pages.filter((page) => DROPSHOT_HOST.test(hostOf(urlOf(page))));
    return dropshotTabs.find((page) => deps.isLoginUrl(urlOf(page)))
      || dropshotTabs[0]
      || pages.find((page) => urlOf(page) === 'about:blank' || urlOf(page) === '');
  };

  return {
    async tick(): Promise<DropshotLoginTickResult> {
      tickNo += 1;
      const board = findBoardTab();
      if (board) {
        const confirmed = await confirmBoard(board);
        if (confirmed) return confirmed;
      }

      const pages = pagesOf(context);
      const cookie = await hasSessionCookie(context);
      const leftLoginOnDropshot = pages.some((page) => {
        const url = urlOf(page);
        return DROPSHOT_HOST.test(hostOf(url)) && !deps.isLoginUrl(url) && !deps.isBoardUrl(url);
      });
      const periodic = tickNo % PERIODIC_PROBE_EVERY === 1;
      if (!cookie && !leftLoginOnDropshot && !periodic) return { done: false };

      const probe = await deps.probeContextSession(context);
      if (probe.signedOut) return { done: false };
      if (!probe.ok && !cookie) return { done: false };
      if (board) return { done: false };

      const at = now();
      if (boardTries >= MAX_BOARD_TRIES || (boardTries > 0 && at - lastBoardTryAt < BOARD_RETRY_MS)) return { done: false };
      boardTries += 1;
      lastBoardTryAt = at;

      let target = pickTab(pages);
      if (!target) {
        try { target = await context.newPage(); } catch { return { done: false }; }
      }
      deps.onLog?.('[Dropshot] 로그인 신호 감지 - 보드로 이동해 확인합니다');
      try {
        await target.goto(deps.boardUrl, { waitUntil: 'domcontentloaded', timeout: BOARD_GOTO_TIMEOUT_MS });
      } catch {
        // Slow navigation is not a failure - the tab address and the session decide (here and on the next tick).
        deps.onLog?.('[Dropshot] 보드 이동이 늦어집니다 - 주소와 세션으로 다시 확인합니다');
      }
      const after = findBoardTab();
      if (after) {
        const confirmed = await confirmBoard(after);
        if (confirmed) return confirmed;
      }
      return { done: false };
    },
  };
}
