import { loadEnvFromFile } from '../env';
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

function log(onLog: ((message: string) => void) | undefined, message: string): void {
  onLog?.(`[TISTORY] ${message}`);
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
  const locator = await firstUsableLocator(page, selectors, timeoutMs);
  if (!locator) return false;
  try {
    await locator.click({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function fillFirst(page: any, selectors: string[], value: string, timeoutMs = SHORT_TIMEOUT_MS): Promise<boolean> {
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

async function selectCategory(page: any, category: string | undefined, onLog?: (message: string) => void): Promise<void> {
  if (!category) return;

  const opened = await clickFirst(page, TISTORY_SELECTORS.editor.categoryTriggers, 2000);
  if (!opened) {
    log(onLog, `Category trigger not found. Skipping category: ${category}`);
    return;
  }

  await page.waitForTimeout(500).catch(() => null);
  const escaped = category.replace(/"/g, '\\"');
  const candidates = [
    `[data-category-id="${escaped}"]`,
    `text=${category}`,
    `li:has-text("${escaped}")`,
    `button:has-text("${escaped}")`,
  ];
  const selected = await clickFirst(page, candidates, 2500);
  log(onLog, selected ? `Selected category: ${category}` : `Category option not found: ${category}`);
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
  try {
    const launched = await launchTistoryContext(config, onLog);
    context = launched.context;
    const page = launched.page;
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

    const titleFilled = await fillFirst(page, TISTORY_SELECTORS.editor.titleInputs, title, 7000);
    if (!titleFilled) throw new Error('Tistory title input was not found.');

    await switchToHtmlMode(page, onLog);
    const finalHtml = thumbnailUrl && !/<img\b/i.test(html)
      ? `<p><img src="${thumbnailUrl}" alt="${title.replace(/"/g, '&quot;')}" /></p>\n${html}`
      : html;
    const htmlFilled = await fillHtmlEditor(page, finalHtml);
    if (!htmlFilled) throw new Error('Tistory body editor was not found.');

    await selectCategory(page, config.defaultCategory, onLog);
    const addedTags = await fillTags(page, tags, onLog);
    if (tags.length > 0 && addedTags === 0) {
      throw new Error('Tistory tag input was not found or tags could not be added.');
    }

    const publishResult = await finishPublish(page, config, postingMode, scheduleDate, onLog);
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
    return {
      ok: false,
      error: `${reason}\n\n자동 입력이 막힌 경우 복구 모드로 제목/본문/태그를 복사해 티스토리 에디터에 붙여넣을 수 있습니다.`,
      manualRecovery: makeRecovery(config, title, html, tags, reason),
    };
  } finally {
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
