import { loadEnvFromFile } from '../env';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TISTORY_SELECTORS, TISTORY_URLS } from './tistory-selectors';
import {
  clickTistoryKakaoLoginIfVisible,
  checkTistorySession as checkSession,
  hideTistoryBrowserWindow,
  isTistoryLoginPage,
  launchTistoryContext,
  loadTistoryCategories as loadCategories,
  normalizeTistoryBlogName,
  openTistoryLoginWindow,
  resolveTistoryConfig,
  humanClick,
  humanType,
  humanScroll,
  humanLinger,
  humanPaste,
} from './tistory-session';
import {
  TistoryConfig,
  TistoryManualRecovery,
  TistoryCategoryLoadResult,
  TistoryPostingMode,
  TistoryPublishResult,
  TistorySessionStatus,
  TistoryVisibility,
} from './tistory-types';

const SHORT_TIMEOUT_MS = 3500;
const THUMBNAIL_UPLOAD_TIMEOUT_MS = 35000;
const BLOCKING_NOTICE_DISMISS_TIMEOUT_MS = 1200;

function log(onLog: ((message: string) => void) | undefined, message: string): void {
  onLog?.(`[TISTORY] ${message}`);
}

type TistoryBlockingState = {
  code: 'captcha_required' | 'publish_blocked' | 'auth_required';
  message: string;
  details: string;
  needsAuth?: boolean;
};

type TistoryDialogMonitor = {
  messages: string[];
  dispose: () => void;
};

const TISTORY_BLOCKING_RULES: Array<{
  code: TistoryBlockingState['code'];
  message: string;
  pattern: RegExp;
  needsAuth?: boolean;
}> = [
  {
    code: 'captcha_required',
    message: '티스토리 자동입력 방지/캡차 화면이 감지되었습니다. 캡차는 자동 우회하지 않고 현재 글을 실패 처리한 뒤 다음 글로 진행합니다.',
    pattern: /(captcha|recaptcha|자동\s*입력\s*방지|보안\s*문자|보안문자|로봇이\s*아닙니다|그림\s*문자|문자\s*입력|스팸\s*방지|봇이\s*아닙니다)/i,
  },
  {
    code: 'publish_blocked',
    message: '티스토리 발행 제한/차단 안내가 감지되었습니다. 현재 글을 실패 처리하고 큐를 다음 글로 넘깁니다.',
    pattern: /((글쓰기|발행|게시).{0,24}(제한|차단|실패|할\s*수\s*없|불가)|비정상.{0,24}(접근|활동)|보호\s*조치|스팸.{0,24}(의심|차단)|잠시\s*후\s*다시|이용이\s*제한|서비스\s*이용이\s*제한|정책.{0,24}위반)/i,
  },
  {
    code: 'auth_required',
    message: '티스토리 로그인/권한 확인이 필요합니다. 현재 글을 실패 처리하고 다음 글로 진행합니다.',
    pattern: /(로그인\s*세션이\s*만료|다시\s*로그인|로그인이\s*필요|인증이\s*필요|권한이\s*없습니다|permission\s*denied|login\s*required)/i,
    needsAuth: true,
  },
];

function createTistoryBlockedError(state: TistoryBlockingState, phase = ''): Error & {
  code?: string;
  tistoryBlocked?: boolean;
  needsAuth?: boolean;
  recoverable?: boolean;
} {
  const prefix = phase ? `[${phase}] ` : '';
  const error = new Error(`${prefix}${state.message}${state.details ? `\n감지 내용: ${state.details}` : ''}`) as Error & {
    code?: string;
    tistoryBlocked?: boolean;
    needsAuth?: boolean;
    recoverable?: boolean;
  };
  error.code = state.code;
  error.tistoryBlocked = true;
  error.needsAuth = !!state.needsAuth;
  error.recoverable = true;
  return error;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getLocalScheduleParts(date: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  dateDash: string;
  dateDot: string;
  dateCompact: string;
  timeColon: string;
  dateTimeText: string;
} {
  const year = String(date.getFullYear());
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hour = pad2(date.getHours());
  const minute = pad2(date.getMinutes());

  return {
    year,
    month,
    day,
    hour,
    minute,
    dateDash: `${year}-${month}-${day}`,
    dateDot: `${year}. ${month}. ${day}.`,
    dateCompact: `${year}${month}${day}`,
    timeColon: `${hour}:${minute}`,
    dateTimeText: `${year}-${month}-${day} ${hour}:${minute}`,
  };
}

function assertValidScheduleDate(scheduleDate: Date | null | undefined): Date {
  if (!scheduleDate || Number.isNaN(scheduleDate.getTime())) {
    throw new Error('Tistory scheduled publishing requires a valid schedule date and time.');
  }
  return scheduleDate;
}

function normalizePostingMode(value?: string | null): TistoryPostingMode {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'schedule' || raw === 'scheduled') return 'schedule';
  if (raw === 'draft' || raw === 'save' || raw === 'private-test') return 'draft';
  return 'publish';
}

function extractTags(payload: Record<string, any>): string[] {
  const candidates = [
    payload['generatedLabels'],
    payload['labels'],
    payload['tags'],
    payload['hashtags'],
    payload['hashTags'],
    payload['keywords'],
    payload['keyword'],
  ];

  const tags: string[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const values = Array.isArray(candidate)
      ? candidate
      : String(candidate).split(/[,#\n]/g);
    for (const value of values) {
      const tag = String(value || '').replace(/^#/, '').trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
      if (tags.length >= 10) return tags;
    }
  }
  return tags;
}

function getImageExtensionFromMime(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('avif')) return 'avif';
  return 'png';
}

function sanitizeFileStem(value: string): string {
  return String(value || 'tistory-thumbnail')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'tistory-thumbnail';
}

async function prepareThumbnailFile(
  thumbnailUrl: string,
  title: string,
  onLog?: (message: string) => void,
): Promise<{ filePath: string; cleanup: () => Promise<void> } | null> {
  const source = String(thumbnailUrl || '').trim();
  if (!source) return null;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'leadernam-tistory-thumb-'));
  let mimeType = 'image/png';
  let buffer: Buffer | null = null;

  try {
    if (/^data:image\//i.test(source)) {
      const match = source.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match?.[1] || !match?.[2]) {
        throw new Error('Invalid data:image thumbnail URL.');
      }
      mimeType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Thumbnail download failed: HTTP ${response.status}`);
      mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || mimeType;
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const stat = await fs.stat(source).catch(() => null);
      if (!stat?.isFile()) throw new Error('Thumbnail file path was not found.');
      return {
        filePath: source,
        cleanup: async () => {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
        },
      };
    }

    if (!buffer || buffer.length < 100) {
      throw new Error('Thumbnail image is empty.');
    }

    const ext = getImageExtensionFromMime(mimeType);
    const filePath = path.join(tmpDir, `${sanitizeFileStem(title)}.${ext}`);
    await fs.writeFile(filePath, buffer);
    return {
      filePath,
      cleanup: async () => {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      },
    };
  } catch (error: any) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    log(onLog, `Thumbnail file preparation failed: ${error?.message || error}`);
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripGeneratedThumbnailHero(html: string, thumbnailUrl: string): string {
  let nextHtml = String(html || '');
  nextHtml = nextHtml.replace(
    /^\s*<div\b[^>]*class=["'][^"']*\bbgpt-thumbnail-box\b[^"']*["'][\s\S]*?<\/div>\s*/i,
    '',
  );

  const source = String(thumbnailUrl || '').trim();
  if (source) {
    const escapedSource = escapeRegExp(source);
    nextHtml = nextHtml.replace(
      new RegExp(`^\\s*(?:<p[^>]*>\\s*)?<img\\b[^>]*\\bsrc=["']${escapedSource}["'][^>]*>\\s*(?:<\\/p>\\s*)?`, 'i'),
      '',
    );
  }
  return nextHtml.trimStart();
}

function buildTistoryImageFallback(thumbnailUrl: string, title: string): string {
  const source = String(thumbnailUrl || '').trim();
  if (!source) return '';
  const safeTitle = title.replace(/"/g, '&quot;');
  return `<p><img src="${source}" alt="${safeTitle}" /></p>`;
}

function makeRecovery(
  config: TistoryConfig,
  title: string,
  html: string,
  tags: string[],
  reason: string,
): TistoryManualRecovery {
  const blogWriteUrl = config.blogName ? TISTORY_URLS.write(config.blogName) : TISTORY_URLS.home;
  return {
    title,
    html,
    tags,
    blogWriteUrl,
    reason,
  };
}

async function locatorCount(page: any, selector: string): Promise<number> {
  try {
    return await page.locator(selector).count();
  } catch {
    return 0;
  }
}

async function firstUsableLocator(page: any, selectors: string[], timeoutMs = SHORT_TIMEOUT_MS): Promise<any | null> {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.count().catch(() => 0) <= 0) continue;
      const visible = await locator.isVisible({ timeout: timeoutMs }).catch(() => false);
      if (!visible) continue;
      return locator;
    } catch {
      continue;
    }
  }
  return null;
}

async function clickFirst(page: any, selectors: string[], timeoutMs = SHORT_TIMEOUT_MS): Promise<boolean> {
  // v3.8.159: 첫 매칭 selector를 human-like click (ghost-cursor 베지어 곡선 + random delay)
  for (const sel of selectors) {
    try {
      const locator = page.locator(sel).first();
      const count = await locator.count().catch(() => 0);
      if (count <= 0) continue;
      const visible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
      if (!visible) continue;
      const ok = await humanClick(page, sel, { timeoutMs });
      if (ok) return true;
    } catch {
      continue;
    }
  }
  // fallback to native
  const locator = await firstUsableLocator(page, selectors, timeoutMs);
  if (!locator) return false;
  try {
    await locator.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

function attachTistoryDialogMonitor(page: any, onLog?: (message: string) => void): TistoryDialogMonitor {
  const messages: string[] = [];
  const handler = async (dialog: any) => {
    const message = String(typeof dialog?.message === 'function' ? dialog.message() : '').trim();
    if (message) {
      messages.push(message);
      while (messages.length > 20) messages.shift();
      log(onLog, `Browser dialog detected and accepted: ${message.slice(0, 160)}`);
    }
    await dialog.accept().catch(() => null);
  };

  try {
    if (typeof page?.on === 'function') page.on('dialog', handler);
  } catch {
    // Dialog monitoring is best effort.
  }

  return {
    messages,
    dispose: () => {
      try {
        if (typeof page?.off === 'function') page.off('dialog', handler);
        else if (typeof page?.removeListener === 'function') page.removeListener('dialog', handler);
      } catch {
        // Ignore stale page cleanup errors.
      }
    },
  };
}

async function readTistoryPageText(page: any, timeoutMs = 1500): Promise<string> {
  try {
    const text = await page.locator('body').innerText({ timeout: timeoutMs });
    return String(text || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function detectTistoryBlockingState(page: any, dialogMessages: string[] = []): Promise<TistoryBlockingState | null> {
  const url = String(typeof page?.url === 'function' ? page.url() : '');
  const bodyText = await readTistoryPageText(page);
  const combined = `${dialogMessages.join('\n')}\n${url}\n${bodyText}`.slice(0, 12000);

  for (const rule of TISTORY_BLOCKING_RULES) {
    const match = combined.match(rule.pattern);
    if (!match) continue;
    const details = String(match[0] || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    const state: TistoryBlockingState = {
      code: rule.code,
      message: rule.message,
      details,
    };
    if (rule.needsAuth !== undefined) state.needsAuth = rule.needsAuth;
    return state;
  }

  return null;
}

async function dismissTistoryBlockingNotice(page: any, onLog?: (message: string) => void): Promise<boolean> {
  const clicked = await page.evaluate(() => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const textOf = (element: Element | null): string => {
      if (!element) return '';
      const htmlElement = element as HTMLElement;
      return [
        htmlElement.innerText || htmlElement.textContent || '',
        htmlElement.getAttribute('aria-label') || '',
        htmlElement.getAttribute('title') || '',
        htmlElement.id || '',
        String(htmlElement.className || ''),
      ].join(' ').replace(/\s+/g, ' ').trim();
    };
    const buttons = Array.from(document.querySelectorAll('button,a,[role="button"],.btn,.button')) as HTMLElement[];
    for (const button of buttons) {
      if (!visible(button)) continue;
      const text = textOf(button);
      if (!/(확인|닫기|취소|나중에|close|ok|cancel)/i.test(text)) continue;
      button.click();
      return text.slice(0, 80) || 'dismissed';
    }
    return '';
  }).catch(() => '');

  if (clicked) {
    log(onLog, `Closed blocking notice: ${clicked}`);
    await page.waitForTimeout(BLOCKING_NOTICE_DISMISS_TIMEOUT_MS).catch(() => null);
    return true;
  }
  return false;
}

async function throwIfTistoryBlocked(
  page: any,
  onLog?: (message: string) => void,
  dialogMessages: string[] = [],
  phase = '',
): Promise<void> {
  const state = await detectTistoryBlockingState(page, dialogMessages);
  if (!state) return;
  log(onLog, `${phase ? `${phase}: ` : ''}${state.message}`);
  await dismissTistoryBlockingNotice(page, onLog).catch(() => false);
  throw createTistoryBlockedError(state, phase);
}

async function fillFirst(page: any, selectors: string[], value: string, timeoutMs = SHORT_TIMEOUT_MS): Promise<boolean> {
  // v3.8.160: 길이별 행동 분기 — 사람의 실제 입력 패턴 모방
  //   - 짧은 입력 (≤30자: 태그/카테고리 검색 등): humanType (글자별 IME delay)
  //   - 중간 (31~200자: 제목 등): humanPaste (clipboard paste — 사람도 제목은 가끔 복붙)
  //   - 긴 본문 (>200자: HTML 본문/요약): humanPaste 강제 (글자별 타이핑은 부자연스러움)
  const useType = value.length <= 30;
  const useHuman = useType || true; // 어떤 길이든 human 모드 (typing or paste)
  if (useHuman) {
    for (const sel of selectors) {
      try {
        const locator = page.locator(sel).first();
        const count = await locator.count().catch(() => 0);
        if (count <= 0) continue;
        const visible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
        if (!visible) continue;
        const ok = useType
          ? await humanType(page, sel, value, { clear: true })
          : await humanPaste(page, sel, value, { clear: true });
        if (ok) return true;
      } catch {
        continue;
      }
    }
  }
  const locator = await firstUsableLocator(page, selectors, timeoutMs);
  if (!locator) return false;

  try {
    await locator.fill(value, { timeout: timeoutMs });
    return true;
  } catch {
    try {
      await locator.evaluate((element: HTMLElement | HTMLInputElement | HTMLTextAreaElement, nextValue: string) => {
        const anyElement = element as any;
        if ('value' in anyElement) {
          anyElement.value = nextValue;
        } else {
          element.innerHTML = nextValue;
          element.textContent = nextValue;
        }
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextValue }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      return true;
    } catch {
      return false;
    }
  }
}

async function hasTitleInput(page: any, timeoutMs = 1200): Promise<boolean> {
  return Boolean(await firstUsableLocator(page, TISTORY_SELECTORS.editor.titleInputs, timeoutMs));
}

function isPublicBlogPage(url: string, blogName: string): boolean {
  if (!blogName) return false;
  try {
    const parsed = new URL(url);
    const expectedHost = `${blogName}.tistory.com`.toLowerCase();
    return parsed.hostname.toLowerCase() === expectedHost
      && !parsed.pathname.toLowerCase().startsWith('/manage');
  } catch {
    return false;
  }
}

type TistoryWriteLink = {
  href: string;
  blogName: string;
  text: string;
};

function extractBlogNameFromTistoryUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^([a-zA-Z0-9_-]+)\.tistory\.com$/i);
    return normalizeTistoryBlogName(match?.[1] || '');
  } catch {
    return '';
  }
}

async function getTistoryHomeWriteLinks(page: any): Promise<TistoryWriteLink[]> {
  const selectors = TISTORY_SELECTORS.home.writeLinks.join(',');
  return page.evaluate((selector: string) => {
    return Array.from(document.querySelectorAll(selector))
      .map((node) => {
        const anchor = node as HTMLAnchorElement;
        return {
          href: anchor.href || anchor.getAttribute('href') || '',
          text: (anchor.textContent || '').trim(),
        };
      })
      .filter((item) => item.href && /\/manage\/newpost/i.test(item.href));
  }, selectors).then((items: Array<{ href: string; text: string }>) => {
    const deduped = new Map<string, TistoryWriteLink>();
    for (const item of items) {
      const blogName = extractBlogNameFromTistoryUrl(item.href);
      if (!blogName || deduped.has(item.href)) continue;
      deduped.set(item.href, { href: item.href, blogName, text: item.text });
    }
    return Array.from(deduped.values());
  }).catch(() => []);
}

async function clickTistoryHomeWriteLink(page: any, href: string, timeoutMs: number): Promise<void> {
  const clicked = await page.evaluate((targetHref: string) => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const link = links.find((anchor) => (anchor.href || anchor.getAttribute('href') || '') === targetHref);
    if (!link) return false;
    link.setAttribute('target', '_self');
    link.click();
    return true;
  }, href).catch(() => false);

  if (!clicked) {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    return;
  }

  await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => null);
}

async function revealTistoryHomeWriteLinks(page: any): Promise<boolean> {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], .link_profile, .btn_profile, .btn_menu, .btn_more, .btn_blog, .link_blog')) as HTMLElement[];
    const keywords = ['블로그', '관리', '계정', '프로필', '내 블로그'];
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') continue;
      const haystack = [
        node.textContent || '',
        node.getAttribute('aria-label') || '',
        node.getAttribute('title') || '',
        node.className || '',
        node.id || '',
      ].join(' ');
      const maybeMenu = keywords.some((keyword) => haystack.includes(keyword))
        || /profile|account|blog|menu|more|my/i.test(haystack);
      if (!maybeMenu) continue;
      node.click();
      return true;
    }
    return false;
  }).catch(() => false);
}

async function openEditorFromTistoryHome(
  page: any,
  config: TistoryConfig,
  onLog?: (message: string) => void,
  maxWaitMs = 180000,
): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  let lastLog = 0;
  let revealAttempts = 0;
  let directFallbackTried = false;

  await page.goto(TISTORY_URLS.home, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });

  while (Date.now() < deadline) {
    if (await hasTitleInput(page)) return;

    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    if (await isTistoryLoginPage(page) || /accounts\.kakao\.com|tistory\.com\/auth\/login/i.test(currentUrl)) {
      await clickTistoryKakaoLoginIfVisible(page, onLog, config.kakaoEmail);
      if (Date.now() - lastLog > 7000) {
        log(onLog, 'Waiting for Kakao/Tistory login before selecting the write link.');
        lastLog = Date.now();
      }
      await page.waitForTimeout(3000).catch(() => null);
      continue;
    }

    const writeLinks = await getTistoryHomeWriteLinks(page);
    if (writeLinks.length > 0) {
      const targetBlogName = normalizeTistoryBlogName(config.blogName);
      const selected = targetBlogName
        ? writeLinks.find((link) => link.blogName.toLowerCase() === targetBlogName.toLowerCase())
        : writeLinks[0];

      if (!selected) {
        const available = writeLinks.map((link) => link.blogName).join(', ');
        throw new Error(`Tistory write link for "${targetBlogName}" was not found on the logged-in home page. Available blogs: ${available || 'none'}`);
      }

      config.blogName = selected.blogName;
      config.blogUrl = `https://${selected.blogName}.tistory.com`;
      log(onLog, `Opening editor by Tistory home write link: ${selected.href}`);
      await clickTistoryHomeWriteLink(page, selected.href, config.timeoutMs);
      return;
    }

    if (revealAttempts < 4) {
      revealAttempts += 1;
      const revealed = await revealTistoryHomeWriteLinks(page);
      if (revealed) {
        log(onLog, 'Opened a Tistory home menu to reveal write links.');
        await page.waitForTimeout(1500).catch(() => null);
        continue;
      }
    }

    const targetBlogName = normalizeTistoryBlogName(config.blogName);
    if (targetBlogName && !directFallbackTried) {
      directFallbackTried = true;
      const directWriteUrl = TISTORY_URLS.write(targetBlogName);
      log(onLog, `Tistory home write link was not visible. Trying direct editor URL for the configured blog: ${directWriteUrl}`);
      await page.goto(directWriteUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
      return;
    }

    if (!/tistory\.com/i.test(currentUrl)) {
      await page.goto(TISTORY_URLS.home, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
    } else if (Date.now() - lastLog > 10000) {
      log(onLog, 'Waiting for Tistory home write links to appear.');
      lastLog = Date.now();
    }

    await page.waitForTimeout(3000).catch(() => null);
  }

  throw new Error('Tistory write link was not found in time. Log in to tistory.com and check whether the account owns a blog.');
}

async function openConfiguredTistoryEditor(
  page: any,
  config: TistoryConfig,
  onLog?: (message: string) => void,
  maxWaitMs = 180000,
): Promise<void> {
  const targetBlogName = normalizeTistoryBlogName(config.blogName);
  if (!targetBlogName) {
    await openEditorFromTistoryHome(page, config, onLog, maxWaitMs);
    return;
  }

  config.blogName = targetBlogName;
  config.blogUrl = `https://${targetBlogName}.tistory.com`;
  const writeUrl = TISTORY_URLS.write(targetBlogName);
  log(onLog, `Opening configured Tistory editor directly: ${writeUrl}`);
  await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
}

async function waitForEditorReady(
  page: any,
  config: TistoryConfig,
  onLog?: (message: string) => void,
  maxWaitMs = 180000,
): Promise<boolean> {
  const writeUrl = TISTORY_URLS.write(config.blogName);
  const deadline = Date.now() + maxWaitMs;
  let lastNavigation = 0;
  let lastLog = 0;
  let publicBlogRedirects = 0;

  while (Date.now() < deadline) {
    if (await hasTitleInput(page)) return true;

    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    await throwIfTistoryBlocked(page, onLog, [], 'editor_wait');
    const loginPage = await isTistoryLoginPage(page);
    if (isPublicBlogPage(currentUrl, config.blogName)) {
      publicBlogRedirects += 1;
      log(onLog, `Public blog page opened instead of the editor: ${currentUrl}`);
      if (publicBlogRedirects >= 2) {
        throw new Error(
          `Tistory redirected to the public blog instead of the editor. Check that "${config.blogName}" is the correct blog name and that the logged-in Kakao/Tistory account has admin permission for that blog.`,
        );
      }
    } else {
      publicBlogRedirects = 0;
    }

    if (loginPage || /accounts\.kakao\.com|tistory\.com\/auth\/login/i.test(currentUrl)) {
      await clickTistoryKakaoLoginIfVisible(page, onLog, config.kakaoEmail);
      if (Date.now() - lastLog > 7000) {
        log(onLog, 'Kakao/Tistory login is required. Complete login, captcha, or 2-step verification in the opened browser.');
        lastLog = Date.now();
      }
    } else if (!/\/manage\/newpost/i.test(currentUrl) && Date.now() - lastNavigation > 10000) {
      lastNavigation = Date.now();
      log(onLog, `Moving back to the Tistory editor: ${writeUrl}`);
      await page.goto(writeUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
    } else if (Date.now() - lastLog > 10000) {
      log(onLog, 'Waiting for the Tistory editor title input to appear.');
      lastLog = Date.now();
    }

    await page.waitForTimeout(3000).catch(() => null);
  }

  return hasTitleInput(page, 2000);
}

async function dismissIntroModals(page: any, onLog?: (message: string) => void): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const clicked = await clickFirst(page, TISTORY_SELECTORS.editor.introModalCloseButtons, 1200);
    if (!clicked) break;
    log(onLog, 'Closed an editor intro modal.');
    await page.waitForTimeout(500).catch(() => null);
  }
}

async function switchToHtmlMode(page: any, onLog?: (message: string) => void): Promise<boolean> {
  const opened = await clickFirst(page, TISTORY_SELECTORS.editor.modeButtons, 5000);
  if (!opened) {
    const htmlEditorAlready = await firstUsableLocator(page, TISTORY_SELECTORS.editor.htmlEditors, 1500);
    if (htmlEditorAlready) {
      log(onLog, 'HTML editor is already active.');
      return true;
    }
    log(onLog, 'HTML mode menu button was not found.');
    return false;
  }

  await page.waitForTimeout(600).catch(() => null);
  const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 })
    .then(async (dialog: any) => {
      await dialog.accept().catch(() => null);
      log(onLog, 'Accepted Tistory HTML mode confirmation dialog.');
      return true;
    })
    .catch(() => false);

  const selected = await clickFirst(page, TISTORY_SELECTORS.editor.htmlModeButtons, 5000);
  const acceptedDialog = await dialogPromise;
  if (selected || acceptedDialog) {
    await page.waitForTimeout(1500).catch(() => null);
    const htmlReady = await Promise.all(
      TISTORY_SELECTORS.editor.htmlEditors.map((selector) => locatorCount(page, selector)),
    ).then((counts) => counts.some((count) => count > 0));
    if (htmlReady) {
      log(onLog, 'Switched editor to HTML mode.');
      return true;
    }
    log(onLog, 'HTML mode was selected, but the HTML editor was not detected yet.');
    return true;
  }

  log(onLog, 'HTML mode selector was not found. Falling back to the visible editor.');
  return false;
}

async function fillCodeEditor(page: any, html: string): Promise<boolean> {
  try {
    return await page.evaluate((nextHtml: string) => {
      const codeMirrorHost = document.querySelector('.CodeMirror') as any;
      const codeMirror = codeMirrorHost?.CodeMirror;
      if (codeMirror && typeof codeMirror.setValue === 'function') {
        codeMirror.setValue(nextHtml);
        if (typeof codeMirror.save === 'function') codeMirror.save();
        const textarea = codeMirrorHost.querySelector('textarea') as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = nextHtml;
          textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextHtml }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return true;
      }

      const cmContent = document.querySelector('.cm-content[contenteditable="true"]') as HTMLElement | null;
      if (cmContent) {
        cmContent.textContent = nextHtml;
        cmContent.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: nextHtml }));
        return true;
      }

      return false;
    }, html);
  } catch {
    return false;
  }
}

async function fillHtmlEditor(page: any, html: string): Promise<boolean> {
  if (await fillFirst(page, TISTORY_SELECTORS.editor.htmlEditors, html, 5000)) return true;
  if (await fillCodeEditor(page, html)) return true;
  if (await fillFirst(page, TISTORY_SELECTORS.editor.richEditors, html, 5000)) return true;

  try {
    const frames = typeof page.frames === 'function' ? page.frames() : [];
    for (const frame of frames) {
      try {
        const body = frame.locator('body[contenteditable="true"], body').first();
        if (await body.count().catch(() => 0) > 0) {
          await body.evaluate((element: HTMLElement, nextHtml: string) => {
            element.innerHTML = nextHtml;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertHTML', data: nextHtml }));
          }, html);
          return true;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return false;
  }

  return false;
}

async function getPageImageSources(page: any): Promise<string[]> {
  try {
    return await page.evaluate(() => Array.from(document.querySelectorAll('img'))
      .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '')
      .filter(Boolean));
  } catch {
    return [];
  }
}

async function setThumbnailFileInput(page: any, filePath: string): Promise<boolean> {
  for (const selector of TISTORY_SELECTORS.editor.imageFileInputs) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.count().catch(() => 0) <= 0) continue;
      await locator.setInputFiles(filePath);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function clickImageUploadControl(page: any): Promise<boolean> {
  return page.evaluate((selectors: string[]) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const textOf = (element: Element | null): string => {
      if (!element) return '';
      const htmlElement = element as HTMLElement;
      return [
        htmlElement.innerText || htmlElement.textContent || '',
        htmlElement.getAttribute('aria-label') || '',
        htmlElement.getAttribute('title') || '',
        htmlElement.id || '',
        String(htmlElement.className || ''),
      ].join(' ').replace(/\s+/g, ' ').trim();
    };
    const clickNode = (node: HTMLElement): boolean => {
      const clickable = (
        node.matches('button,a,label,[role="button"],.mce-btn,.toolbar-item,[tabindex]')
          ? node
          : node.closest('button,a,label,[role="button"],.mce-btn,.toolbar-item,[tabindex]') as HTMLElement | null
      ) || node;
      if (!visible(clickable)) return false;
      clickable.click();
      return true;
    };

    for (const selector of selectors) {
      try {
        const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        for (const node of nodes) {
          const haystack = textOf(node);
          if (/profile|avatar|account|emoji|emoticon/i.test(haystack)) continue;
          if (clickNode(node)) return true;
        }
      } catch {
        continue;
      }
    }

    const fallbackNodes = Array.from(document.querySelectorAll(
      'button,a,label,[role="button"],.mce-btn,.toolbar-item,i,span',
    )) as HTMLElement[];
    for (const node of fallbackNodes) {
      if (!visible(node)) continue;
      const haystack = textOf(node);
      if (!/(사진|이미지|그림|첨부|파일|image|photo|picture)/i.test(haystack)) continue;
      if (/profile|avatar|account|emoji|emoticon|category|카테고리|tag|태그/i.test(haystack)) continue;
      if (clickNode(node)) return true;
    }
    return false;
  }, TISTORY_SELECTORS.editor.imageUploadButtons).catch(() => false);
}

async function captureUploadedThumbnailBlock(
  page: any,
  previousSources: string[],
  title: string,
): Promise<string> {
  try {
    await page.waitForFunction((previous: string[]) => {
      const sourceSet = new Set(previous);
      const isContentImage = (img: HTMLImageElement) => {
        const src = img.currentSrc || img.src || '';
        if (!src || sourceSet.has(src)) return false;
        if (/data:image\/svg|favicon|profile|avatar|emoji|emoticon|icon/i.test(src)) return false;
        const rect = img.getBoundingClientRect();
        return rect.width >= 80 && rect.height >= 60;
      };
      return Array.from(document.querySelectorAll('img')).some((node) => isContentImage(node as HTMLImageElement));
    }, previousSources, { timeout: THUMBNAIL_UPLOAD_TIMEOUT_MS });
  } catch {
    return '';
  }

  return page.evaluate(({ previous, altText }: { previous: string[]; altText: string }) => {
    const sourceSet = new Set(previous);
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const scoreImage = (img: HTMLImageElement): number => {
      const src = img.currentSrc || img.src || '';
      if (!src || sourceSet.has(src)) return -1;
      if (/data:image\/svg|favicon|profile|avatar|emoji|emoticon|icon/i.test(src)) return -1;
      const rect = img.getBoundingClientRect();
      if (rect.width < 80 || rect.height < 60) return -1;
      let score = rect.width * rect.height;
      if (img.closest('[contenteditable="true"],.contents_style,.editor-content,.tt_article_useless_p_margin,figure')) {
        score += 100000;
      }
      if (/tistory|kakaocdn|daumcdn|blog.kakaocdn/i.test(src)) score += 50000;
      return score;
    };

    const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const sorted = images
      .map((img) => ({ img, score: scoreImage(img) }))
      .filter((entry) => entry.score >= 0 && visible(entry.img))
      .sort((a, b) => b.score - a.score);
    const target = sorted[0]?.img;
    if (!target) return '';

    target.alt = target.alt || altText;
    target.setAttribute('loading', target.getAttribute('loading') || 'lazy');
    const wrapper = target.closest('figure,.imageblock,.imagegridblock,p,div') as HTMLElement | null;
    const html = (wrapper && visible(wrapper) ? wrapper.outerHTML : target.outerHTML).trim();
    return html;
  }, { previous: previousSources, altText: title }).catch(() => '');
}

async function trySetUploadedImageAsRepresentative(page: any, onLog?: (message: string) => void): Promise<boolean> {
  const marked = await page.evaluate(() => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const textOf = (element: Element | null): string => {
      if (!element) return '';
      const htmlElement = element as HTMLElement;
      return [
        htmlElement.innerText || htmlElement.textContent || '',
        htmlElement.getAttribute('aria-label') || '',
        htmlElement.getAttribute('title') || '',
        htmlElement.id || '',
        String(htmlElement.className || ''),
      ].join(' ').replace(/\s+/g, ' ').trim();
    };
    const candidates = Array.from(document.querySelectorAll('button,a,label,[role="button"],input[type="checkbox"],span')) as HTMLElement[];
    for (const node of candidates) {
      if (!visible(node)) continue;
      const haystack = textOf(node);
      if (!/(대표|대표\s*이미지|썸네일|thumbnail|cover)/i.test(haystack)) continue;
      if (/(해제|remove|delete|삭제)/i.test(haystack)) continue;
      const root = node.closest('figure,.imageblock,.imagegridblock,.attached,.attach,.thumbnail,.layer,.mce-container,div') as HTMLElement | null;
      if (root && !root.querySelector('img') && !/(대표|썸네일|thumbnail|cover)/i.test(textOf(root))) continue;
      const clickable = (
        node.matches('button,a,label,[role="button"],input')
          ? node
          : node.closest('button,a,label,[role="button"],input') as HTMLElement | null
      ) || node;
      clickable.click();
      return true;
    }
    return false;
  }).catch(() => false);

  if (marked) log(onLog, 'Representative thumbnail control was selected.');
  return marked;
}

async function uploadThumbnailThroughTistoryEditor(
  page: any,
  thumbnailUrl: string,
  title: string,
  onLog?: (message: string) => void,
): Promise<string> {
  if (!thumbnailUrl) return '';
  const prepared = await prepareThumbnailFile(thumbnailUrl, title, onLog);
  if (!prepared) return '';

  try {
    const beforeSources = await getPageImageSources(page);
    let uploaded = await setThumbnailFileInput(page, prepared.filePath);

    if (!uploaded) {
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 6000 }).catch(() => null);
      const clicked = await clickImageUploadControl(page);
      const chooser = clicked ? await fileChooserPromise : null;
      if (chooser) {
        await chooser.setFiles(prepared.filePath);
        uploaded = true;
      } else {
        uploaded = await setThumbnailFileInput(page, prepared.filePath);
      }
    }

    if (!uploaded) {
      log(onLog, 'Tistory image upload control was not found. Falling back to HTML image tag.');
      return '';
    }

    log(onLog, 'Thumbnail image uploaded to Tistory editor.');
    await page.waitForTimeout(1200).catch(() => null);
    const imageBlock = await captureUploadedThumbnailBlock(page, beforeSources, title);
    if (!imageBlock) {
      log(onLog, 'Uploaded thumbnail block was not detected. Falling back to HTML image tag.');
      return '';
    }
    await trySetUploadedImageAsRepresentative(page, onLog).catch(() => false);
    return imageBlock;
  } finally {
    await prepared.cleanup().catch(() => undefined);
  }
}

function buildTistoryFinalHtml(html: string, thumbnailUrl: string, uploadedThumbnailBlock: string, title: string): string {
  if (uploadedThumbnailBlock) {
    const bodyWithoutGeneratedThumbnail = stripGeneratedThumbnailHero(html, thumbnailUrl);
    return `${uploadedThumbnailBlock}\n${bodyWithoutGeneratedThumbnail}`.trim();
  }

  if (thumbnailUrl && !/<img\b/i.test(html)) {
    return `${buildTistoryImageFallback(thumbnailUrl, title)}\n${html}`.trim();
  }
  return html;
}

async function selectCategory(page: any, category: string | undefined, onLog?: (message: string) => void): Promise<void> {
  const targetCategory = String(category || '').replace(/\s+/g, ' ').trim();
  if (!targetCategory) return;

  const opened = await clickFirst(page, TISTORY_SELECTORS.editor.categoryTriggers, 5000);
  if (!opened) {
    throw new Error(`Tistory category trigger was not found. Selected category: ${targetCategory}`);
  }

  await page.waitForTimeout(800).catch(() => null);
  const escaped = targetCategory.replace(/"/g, '\\"');
  const candidates = [
    `[data-category-id="${escaped}"]`,
    `button:has-text("${escaped}")`,
    `li:has-text("${escaped}")`,
    `a:has-text("${escaped}")`,
    `[role="option"]:has-text("${escaped}")`,
    `[role="menuitem"]:has-text("${escaped}")`,
  ];
  const selected = await clickFirst(page, candidates, 2500);
  if (selected) {
    log(onLog, `Selected category: ${targetCategory}`);
    return;
  }

  const selectedByDom = await page.evaluate((target: string) => {
    const normalize = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const clickElement = (element: HTMLElement) => {
      const clickable = (
        element.matches('button,a,label,li,[role="button"],[role="option"],[role="menuitem"]')
          ? element
          : element.closest('button,a,label,li,[role="button"],[role="option"],[role="menuitem"]') as HTMLElement | null
      ) || element;
      clickable.click();
    };
    const targetText = normalize(target);
    const targetLower = targetText.toLowerCase();

    const roots = Array.from(document.querySelectorAll(
      '[role="listbox"],[role="menu"],.mce-menu,.mce-menu-item,.layer,.dropdown,[class*="category" i],[id*="category" i],ul,ol',
    ))
      .filter((node) => visible(node) && normalize((node as HTMLElement).innerText || node.textContent).toLowerCase().includes(targetLower)) as HTMLElement[];
    roots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });
    const searchRoots = roots.length ? roots.slice(0, 6) : [document.body];
    const selector = '[data-category-id],[data-category],button,a,label,li,span,[role="option"],[role="menuitem"]';

    for (const root of searchRoots) {
      const candidates = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
      for (const node of candidates) {
        if (!visible(node)) continue;
        const values = [
          node.getAttribute('data-category-id'),
          node.getAttribute('data-category'),
          node.getAttribute('value'),
          node.getAttribute('title'),
          node.getAttribute('aria-label'),
          node.innerText,
          node.textContent,
        ].map(normalize).filter(Boolean);
        const exact = values.some((value) => value === targetText || value.toLowerCase() === targetLower);
        if (!exact) continue;
        clickElement(node);
        return true;
      }
    }
    return false;
  }, targetCategory).catch(() => false);

  if (!selectedByDom) {
    throw new Error(`Tistory category option was not found: ${targetCategory}`);
  }
  log(onLog, `Selected category: ${targetCategory}`);
}

async function fillTags(page: any, tags: string[], onLog?: (message: string) => void): Promise<number> {
  if (!tags.length) return 0;

  const locator = await firstUsableLocator(page, TISTORY_SELECTORS.editor.tagInputs, 2500);
  if (!locator) {
    log(onLog, 'Tag input was not found. Skipping tags.');
    return 0;
  }

  let added = 0;
  for (const tag of tags.slice(0, 10)) {
    try {
      await locator.fill(tag);
      await locator.press('Enter');
      await page.waitForTimeout(200).catch(() => null);
      added += 1;
    } catch {
      log(onLog, `Failed to add tag: ${tag}`);
      break;
    }
  }
  if (added > 0) log(onLog, `Tags added: ${added}`);
  return added;
}

async function setVisibility(page: any, visibility: TistoryVisibility, onLog?: (message: string) => void): Promise<void> {
  const valueMap: Record<TistoryVisibility, string> = {
    public: '20',
    private: '0',
    protected: '15',
  };
  const value = valueMap[visibility] || valueMap.private;
  const clicked = await page.evaluate((nextValue: string) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const inputs = Array.from(document.querySelectorAll('input[type="radio"], input[name="visibility"], input[name="basicSet"]')) as HTMLInputElement[];
    const input = inputs.find((candidate) => {
      const name = String(candidate.name || '').toLowerCase();
      const id = String(candidate.id || '').toLowerCase();
      return candidate.value === nextValue && (name.includes('visibility') || name.includes('basicset') || id.includes('visibility') || id.startsWith('open') || inputs.length <= 5);
    });
    if (!input) return false;

    const label = input.id ? document.querySelector(`label[for="${CSS.escape(input.id)}"]`) as HTMLElement | null : null;
    const closestLabel = input.closest('label') as HTMLElement | null;
    const clickable = [label, closestLabel].find(visible);
    if (clickable) {
      clickable.click();
    } else {
      input.checked = true;
      input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }, value).catch(() => false);

  if (!clicked) {
    const candidates = TISTORY_SELECTORS.editor.visibility[visibility] || TISTORY_SELECTORS.editor.visibility.private;
    const fallbackClicked = await clickFirst(page, candidates, 2000);
    if (fallbackClicked) log(onLog, `Visibility selected: ${visibility}`);
    return;
  }

  log(onLog, `Visibility selected: ${visibility}`);
}

async function configureScheduledPublish(
  page: any,
  scheduleDate: Date,
  onLog?: (message: string) => void,
): Promise<void> {
  const target = getLocalScheduleParts(scheduleDate);
  await page.evaluate(() => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const publishRoots = Array.from(document.querySelectorAll('[role="dialog"], .layer_publish, .layer, [class*="publish" i]'))
      .filter((element) => visible(element) && element.querySelector('input, button, select, [role="button"]')) as HTMLElement[];
    publishRoots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });
    const root = publishRoots[0];
    if (!root) return false;

    const candidates = Array.from(root.querySelectorAll('button.btn_date, button, label, a, [role="button"], li, span')) as HTMLElement[];
    const node = candidates.find((element) => {
      if (!visible(element)) return false;
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      return /^(\uC608\uC57D|schedule|reserve)$/i.test(text)
        && !/\uC644\uB8CC|\uD655\uC778|confirm|submit/i.test(text);
    });
    if (!node) return false;
    const clickable = (node.matches('button,label,a,[role="button"],li') ? node : node.closest('label,button,a,[role="button"],li') as HTMLElement | null) || node;
    clickable.click();
    return true;
  }).catch(() => false);
  await page.waitForTimeout(800).catch(() => null);

  const result = await page.evaluate((parts: ReturnType<typeof getLocalScheduleParts>) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const htmlElement = element as HTMLElement;
      const rect = htmlElement.getBoundingClientRect();
      const style = window.getComputedStyle(htmlElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const textOf = (element: Element | null): string => {
      if (!element) return '';
      const htmlElement = element as HTMLElement;
      return [
        htmlElement.innerText || htmlElement.textContent || '',
        htmlElement.getAttribute('aria-label') || '',
        htmlElement.getAttribute('title') || '',
        htmlElement.getAttribute('placeholder') || '',
        htmlElement.id || '',
        htmlElement.getAttribute('name') || '',
        htmlElement.className || '',
      ].join(' ').replace(/\s+/g, ' ').trim();
    };

    const publishRoots = Array.from(document.querySelectorAll('[role="dialog"], .layer_publish, .layer, [class*="publish" i]'))
      .filter((element) => visible(element) && element.querySelector('input, button, select, [role="button"]')) as HTMLElement[];
    publishRoots.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return (ar.width * ar.height) - (br.width * br.height);
    });
    const root = publishRoots[0];
    if (!root) {
      const controls = Array.from(document.querySelectorAll('button, a, label, input, select, textarea, [role="button"], [class*="publish" i], [id*="publish" i]'))
        .filter(visible)
        .slice(0, 80)
        .map((element) => {
          const htmlElement = element as HTMLElement;
          const input = element as HTMLInputElement;
          return {
            tag: element.tagName.toLowerCase(),
            id: htmlElement.id || '',
            className: String(htmlElement.className || '').slice(0, 120),
            type: input.type || '',
            name: input.name || '',
            value: input.value || '',
            text: textOf(element).slice(0, 120),
          };
        });
      return {
        scheduleClicked: false,
        dateFilled: false,
        timeFilled: false,
        rootText: `publish dialog not found; controls=${JSON.stringify(controls)}`,
      };
    }

    const isInsideRoot = (element: Element) => root === document.body || root.contains(element);
    const setValue = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
      if (descriptor?.set) descriptor.set.call(element, value);
      else (element as any).value = value;
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    };

    const clickElement = (element: HTMLElement) => {
      const clickable = (element.matches('button,label,a,[role="button"],li') ? element : element.closest('label,button,a,[role="button"],li') as HTMLElement | null) || element;
      clickable.click();
    };

    let scheduleClicked = false;
    const activeScheduleButton = Array.from(root.querySelectorAll('button.btn_date, button')) as HTMLElement[];
    const alreadyScheduled = activeScheduleButton.some((element) => {
      if (!visible(element)) return false;
      const text = textOf(element);
      return /^(\uC608\uC57D|schedule|reserve)$/i.test(text) && /\bon\b|active|selected/i.test(String(element.className || ''));
    });
    if (alreadyScheduled) scheduleClicked = true;

    const inputs = Array.from(root.querySelectorAll('input')) as HTMLInputElement[];
    for (const input of inputs) {
      if (scheduleClicked) break;
      const meta = textOf(input);
      const labelText = input.id ? textOf(document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) : '';
      const parentText = textOf(input.closest('label,li,div'));
      const haystack = `${meta} ${labelText} ${parentText}`;
      const isScheduleCandidate = /schedule|reserve|reserved|future/i.test(haystack)
        || /\uC608\uC57D/.test(haystack);
      if (!isScheduleCandidate) continue;
      if (input.type === 'radio' || input.type === 'checkbox') {
        if (!input.checked) input.click();
        scheduleClicked = true;
        break;
      }
    }

    if (!scheduleClicked) {
      const scheduleNodes = Array.from(root.querySelectorAll('button.btn_date, label, button, a, [role="button"], li, span')) as HTMLElement[];
      const node = scheduleNodes.find((element) => {
        if (!visible(element)) return false;
        const text = textOf(element);
        if (!/^(\uC608\uC57D|schedule|reserve)$/i.test(text)) return false;
        return !/\uC644\uB8CC|\uD655\uC778|confirm|submit/i.test(text);
      });
      if (node) {
        clickElement(node);
        scheduleClicked = true;
      }
    }

    const controlInfo = (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
      const labelText = element.id ? textOf(document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) : '';
      const parentText = textOf(element.closest('label,li,div'));
      return `${textOf(element)} ${labelText} ${parentText}`;
    };

    const allControls = Array.from(root.querySelectorAll('input, textarea, select'))
      .filter((element) => isInsideRoot(element) && visible(element)) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

    const safeControls = allControls.filter((element) => {
      const meta = controlInfo(element);
      return !/title|post-title|tag|search|password|captcha|token/i.test(meta)
        && !/\uC81C\uBAA9|\uD0DC\uADF8|\uAC80\uC0C9|\uBE44\uBC00\uBC88\uD638/i.test(meta);
    });

    const setSelectOption = (select: HTMLSelectElement, desired: string): boolean => {
      const normalized = String(Number(desired));
      for (const option of Array.from(select.options)) {
        const optionValue = String(option.value || '').trim();
        const optionText = String(option.textContent || '').trim();
        if (optionValue === desired || optionText === desired || optionValue === normalized || optionText === normalized) {
          select.value = option.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    };

    let dateFilled = false;
    let hourFilled = false;
    let minuteFilled = false;
    let timeFilled = false;

    for (const control of safeControls) {
      if ((control as HTMLInputElement).type === 'date') {
        setValue(control, parts.dateDash);
        dateFilled = true;
      }
      if ((control as HTMLInputElement).type === 'time') {
        setValue(control, parts.timeColon);
        timeFilled = true;
        hourFilled = true;
        minuteFilled = true;
      }
    }

    for (const control of safeControls) {
      const meta = controlInfo(control);
      const isSelect = control.tagName.toLowerCase() === 'select';
      if (!dateFilled && /date|calendar|reserve|schedule|publish|open/i.test(meta)) {
        setValue(control, parts.dateDash);
        dateFilled = true;
        continue;
      }
      if (!dateFilled && /\uB0A0\uC9DC|\uC608\uC57D|\uBC1C\uD589\uC77C|\uACF5\uAC1C\uC77C/.test(meta)) {
        setValue(control, parts.dateDash);
        dateFilled = true;
        continue;
      }

      if (/year/i.test(meta) || /\uB144/.test(meta)) {
        if (isSelect) dateFilled = setSelectOption(control as HTMLSelectElement, parts.year) || dateFilled;
        else setValue(control, parts.year);
        dateFilled = true;
        continue;
      }
      if (/month/i.test(meta) || /\uC6D4/.test(meta)) {
        if (isSelect) dateFilled = setSelectOption(control as HTMLSelectElement, parts.month) || dateFilled;
        else setValue(control, parts.month);
        dateFilled = true;
        continue;
      }
      if (/day/i.test(meta) || /\uC77C/.test(meta)) {
        if (isSelect) dateFilled = setSelectOption(control as HTMLSelectElement, parts.day) || dateFilled;
        else setValue(control, parts.day);
        dateFilled = true;
        continue;
      }
      if (/hour/i.test(meta) || /\uC2DC/.test(meta)) {
        if (isSelect) hourFilled = setSelectOption(control as HTMLSelectElement, parts.hour) || hourFilled;
        else setValue(control, parts.hour);
        hourFilled = true;
        continue;
      }
      if (/minute|min/i.test(meta) || /\uBD84/.test(meta)) {
        if (isSelect) minuteFilled = setSelectOption(control as HTMLSelectElement, parts.minute) || minuteFilled;
        else setValue(control, parts.minute);
        minuteFilled = true;
        continue;
      }
      if (!timeFilled && /time|clock|reserve|schedule|publish/i.test(meta)) {
        setValue(control, parts.timeColon);
        timeFilled = true;
        hourFilled = true;
        minuteFilled = true;
      }
    }

    if (!dateFilled) {
      const dateLike = safeControls.find((control) => {
        const meta = controlInfo(control);
        return /yyyy|yyyy-mm-dd|yyyy\.? ?mm|calendar/i.test(meta);
      });
      if (dateLike) {
        setValue(dateLike, parts.dateDash);
        dateFilled = true;
      }
    }

    if (!timeFilled && (!hourFilled || !minuteFilled)) {
      const timeLike = safeControls.find((control) => {
        const meta = controlInfo(control);
        return /hh:mm|time|clock/i.test(meta);
      });
      if (timeLike) {
        setValue(timeLike, parts.timeColon);
        timeFilled = true;
        hourFilled = true;
        minuteFilled = true;
      }
    }

    if (!scheduleClicked && (dateFilled || hourFilled || minuteFilled || timeFilled)) {
      scheduleClicked = true;
    }

    return {
      scheduleClicked,
      dateFilled,
      timeFilled: timeFilled || (hourFilled && minuteFilled),
      rootText: textOf(root).slice(0, 300),
    };
  }, target);

  if (!result?.scheduleClicked) {
    let debugPath = '';
    try {
      const nodePath = require('node:path');
      debugPath = nodePath.join(process.cwd(), 'tmp', 'tistory-schedule-debug.png');
      await page.screenshot({ path: debugPath, fullPage: true });
      log(onLog, `Schedule debug screenshot saved: ${debugPath}`);
    } catch {
      // Screenshot is best effort only.
    }
    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    throw new Error(`Tistory schedule option was not found in the publish dialog. URL: ${currentUrl}. Dialog preview: ${result?.rootText || 'none'}${debugPath ? `. Screenshot: ${debugPath}` : ''}`);
  }
  if (!result?.dateFilled) {
    throw new Error('Tistory schedule date field was not found or could not be filled.');
  }
  if (!result?.timeFilled) {
    throw new Error('Tistory schedule time field was not found or could not be filled.');
  }

  log(onLog, `Scheduled publish time selected: ${target.dateTimeText}`);
}

async function finishPublish(
  page: any,
  config: TistoryConfig,
  postingMode: TistoryPostingMode,
  scheduleDate: Date | null | undefined,
  onLog?: (message: string) => void,
): Promise<{ url?: string; postId?: string }> {
  if (config.dryRun) {
    log(onLog, 'Dry run enabled. Leaving the editor open without publishing.');
    return {};
  }

  if (postingMode === 'draft') {
    const saved = await clickFirst(page, TISTORY_SELECTORS.editor.tempSaveButtons, 4000);
    if (!saved) throw new Error('Tistory draft/temp-save button was not found.');
    await page.waitForTimeout(2000).catch(() => null);
  } else {
    const normalizedScheduleDate = postingMode === 'schedule'
      ? assertValidScheduleDate(scheduleDate)
      : null;
    const opened = await clickFirst(page, TISTORY_SELECTORS.editor.publishButtons, 5000);
    if (!opened) throw new Error('Tistory publish button was not found.');
    await page.waitForTimeout(1000).catch(() => null);
    await setVisibility(page, config.visibility, onLog);
    if (postingMode === 'schedule' && normalizedScheduleDate) {
      await configureScheduledPublish(page, normalizedScheduleDate, onLog);
    }
    const confirmed = await clickFirst(page, TISTORY_SELECTORS.editor.publishConfirmButtons, 5000);
    if (!confirmed) throw new Error('Tistory publish confirmation button was not found.');
    await page.waitForTimeout(3000).catch(() => null);
  }

  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  const postIdMatch = currentUrl.match(/tistory\.com\/(?:entry\/)?(\d+|[^/?#]+)$/i);
  const result: { url?: string; postId?: string } = {};
  if (currentUrl && !/manage\/newpost/i.test(currentUrl)) result.url = currentUrl;
  if (postIdMatch?.[1]) result.postId = postIdMatch[1];
  return result;
}

export async function publishToTistory(
  payload: Record<string, any>,
  title: string,
  html: string,
  thumbnailUrl = '',
  onLog?: (message: string) => void,
  postingModeValue?: string,
  scheduleDate?: Date | null,
): Promise<TistoryPublishResult> {
  const env = loadEnvFromFile();
  const config = resolveTistoryConfig(payload, env);
  const postingMode = normalizePostingMode(postingModeValue || payload['postingMode'] || payload['publishType']);
  const tags = extractTags(payload);

  let context: any | null = null;
  let pageToHide: any | null = null;
  let shouldHideAfterUse = false;
  let dialogMonitor: TistoryDialogMonitor | null = null;
  try {
    const launched = await launchTistoryContext(config, onLog);
    context = launched.context;
    const page = launched.page;
    dialogMonitor = attachTistoryDialogMonitor(page, onLog);
    pageToHide = page;
    const loginWaitMs = Number(payload['tistoryLoginWaitMs'] || payload['loginWaitMs'] || 180000);
    await openConfiguredTistoryEditor(
      page,
      config,
      onLog,
      Number.isFinite(loginWaitMs) && loginWaitMs > 0 ? loginWaitMs : 180000,
    );
    const editorReady = await waitForEditorReady(
      page,
      config,
      onLog,
      Number.isFinite(loginWaitMs) && loginWaitMs > 0 ? loginWaitMs : 180000,
    );

    if (!editorReady) {
      return {
        ok: false,
        error: 'Tistory login or editor entry was not completed in time. Complete Kakao/Tistory login in the opened browser, then try again.',
        needsAuth: true,
        manualRecovery: makeRecovery(config, title, html, tags, 'editor_not_ready'),
      };
    }

    if (await isTistoryLoginPage(page)) {
      return {
        ok: false,
        error: '티스토리 로그인이 필요합니다. 계정 추가하기에서 카카오/티스토리 로그인을 완료한 뒤 다시 발행해주세요.',
        needsAuth: true,
        manualRecovery: makeRecovery(config, title, html, tags, 'login_required'),
      };
    }

    await dismissIntroModals(page, onLog);
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'editor_ready');

    const titleFilled = await fillFirst(page, TISTORY_SELECTORS.editor.titleInputs, title, 7000);
    if (!titleFilled) throw new Error('Tistory title input was not found.');
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'title_fill');

    const uploadedThumbnailBlock = await uploadThumbnailThroughTistoryEditor(
      page,
      thumbnailUrl,
      title,
      onLog,
    );
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'thumbnail_upload');

    await switchToHtmlMode(page, onLog);
    const finalHtml = buildTistoryFinalHtml(html, thumbnailUrl, uploadedThumbnailBlock, title);
    const htmlFilled = await fillHtmlEditor(page, finalHtml);
    if (!htmlFilled) throw new Error('Tistory body editor was not found.');
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'body_fill');

    await selectCategory(page, config.defaultCategory, onLog);
    const addedTags = await fillTags(page, tags, onLog);
    if (tags.length > 0 && addedTags === 0) {
      throw new Error('Tistory tag input was not found or tags could not be added.');
    }
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'before_publish');

    const publishResult = await finishPublish(page, config, postingMode, scheduleDate, onLog);
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'after_publish');
    if (!publishResult.url && postingMode !== 'draft') {
      log(onLog, 'Publish completed but final URL was not detected. Returning editor URL as fallback.');
    }

    const successResult: TistoryPublishResult = {
      ok: true,
      url: publishResult.url || TISTORY_URLS.write(config.blogName),
    };
    if (publishResult.postId) successResult.postId = publishResult.postId;
    shouldHideAfterUse = true;
    return successResult;
  } catch (error: any) {
    const reason = error?.message || String(error);
    log(onLog, `Publish failed: ${reason}`);
    if (error?.tistoryBlocked || error?.recoverable) {
      shouldHideAfterUse = true;
    }
    const failureResult: TistoryPublishResult = {
      ok: false,
      error: `${reason}\n\n자동 입력이 막힌 경우 복구 모드로 제목/본문/태그를 복사해 티스토리 에디터에 붙여넣을 수 있습니다.`,
      needsAuth: !!error?.needsAuth,
      recoverable: !!error?.recoverable,
      skipped: !!error?.tistoryBlocked,
      manualRecovery: makeRecovery(config, title, html, tags, reason),
    };
    if (error?.code) failureResult.blockedReason = String(error.code);
    return failureResult;
  } finally {
    dialogMonitor?.dispose();
    if (shouldHideAfterUse && pageToHide && !config.keepBrowserOpen) {
      await hideTistoryBrowserWindow(pageToHide, onLog).catch(() => false);
    }
    context = null;
  }
}

export async function checkTistorySession(
  payload: Record<string, any> = {},
): Promise<TistorySessionStatus> {
  return checkSession(payload, loadEnvFromFile(), (message) => console.log(message));
}

export async function loadTistoryCategories(
  payload: Record<string, any> = {},
): Promise<TistoryCategoryLoadResult> {
  return loadCategories(payload, loadEnvFromFile(), (message) => console.log(message));
}

export async function openTistoryLogin(
  payload: Record<string, any> = {},
): Promise<TistorySessionStatus> {
  return openTistoryLoginWindow(payload, loadEnvFromFile(), (message) => console.log(message));
}
