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

export type TistoryDialogMonitor = {
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
    // v3.8.300: agent 모드 metadata.json 안의 tags (codex-workshop이 payload.metadata로 넘김)
    payload['metadata']?.tags,
    payload['metadata']?.hashtags,
    payload['metadata']?.keywords,
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

  // v3.8.300 폴백: tags 비어있으면 title에서 한국어 명사 추출 자동 생성 (사용자 보고: 해시태그 #태그입력 빈 상태로 발행됨)
  if (tags.length === 0) {
    const title = String(payload['title'] || payload['topic'] || payload['keyword'] || '').trim();
    if (title) {
      // 한국어 명사 후보: 2자 이상 한글/숫자 토큰
      const tokens = title
        .replace(/[^가-힣a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2 && t.length <= 12);
      const stopwords = new Set(['그리고', '하지만', '이번', '오늘', '최근', '관련', '대한', '대해', '이런', '저런', '어떤', '그것', '이것', '저것']);
      for (const tok of tokens) {
        if (stopwords.has(tok)) continue;
        if (!tags.includes(tok)) tags.push(tok);
        if (tags.length >= 6) break;
      }
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

export function normalizeTistoryPublishedImageUrl(value: string): string {
  const source = String(value || '').trim();
  if (!source || /^(?:blob:|data:|javascript:)/i.test(source)) return '';

  const normalized = source.startsWith('//') ? `https:${source}` : source;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function escapeHtmlAttribute(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeHtmlAttribute(value: string): string {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * 🖼️ v3.8.708 — 업로드한 사진을 티스토리 **첨부 표기**로 바꾼다.
 *
 * 실측(2026-09-07): 편집기가 HTML 모드에서 자기가 올린 사진을 이렇게 적는다.
 *   [##_Image|kage@<dna 이하 경로>|CDM|1.3|{"originWidth":1200,"originHeight":670,"style":"alignCenter","filename":"x.webp"}_##]
 * 이 표기라야 티스토리가 "첨부된 사진"으로 알아보고 대표·목록 썸네일에 쓴다.
 * kakaocdn 주소가 아니면(외부 주소) 빈 문자열 — 호출 쪽이 보통 `<img>` 로 간다.
 */
export function buildTistoryAttachedImageMarkup(block: string): string {
  const source = unescapeHtmlAttribute(String(block || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '');
  const kagePath = source.match(/^https:\/\/blog\.kakaocdn\.net\/dna\/(.+)$/i)?.[1] || '';
  if (!kagePath) return '';
  const attr = (name: string) => unescapeHtmlAttribute(String(block).match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] || '');
  const originWidth = Number(attr('data-origin-width')) || 0;
  const originHeight = Number(attr('data-origin-height')) || 0;
  const filename = attr('data-filename') || decodeURIComponent((kagePath.split('?')[0] || '').split('/').pop() || 'image');
  const meta = JSON.stringify({
    ...(originWidth ? { originWidth } : {}),
    ...(originHeight ? { originHeight } : {}),
    style: 'alignCenter',
    filename,
  });
  return `[##_Image|kage@${kagePath.replace(/&amp;/g, '&').replace(/&/g, '&amp;')}|CDM|1.3|${meta}_##]`;
}

function stripLeadingTemporaryImage(html: string): string {
  return String(html || '').replace(
    /^\s*(?:<p\b[^>]*>\s*)?<img\b[^>]*\bsrc=["'](?:blob:|data:image\/|javascript:)[^"']*["'][^>]*>\s*(?:<\/p>\s*)?/i,
    '',
  );
}

/**
 * 🖼️ v3.8.695 — **맨 앞에 있다고 가정하지 않는다.**
 *
 * 사장님 실물 검수: "썸네일 두번나오고"
 *
 * 예전 규칙은 전부 `^\s*` 로 **본문 맨 앞**을 붙잡았다. 그런데 발행 직전에
 * Schema.org JSON-LD `<script>` 가 본문 앞에 끼어들면서(orchestration) 앵커가 빗나갔고,
 * 그때부터 대표이미지와 본문 첫 이미지가 나란히 두 번 나왔다.
 *
 * 이제 앵커 대신 **앞부분(도입 영역)에서 처음 나오는 것 하나**를 지운다.
 * 글 중간의 같은 이미지는 건드리지 않는다 — 본문에서 다시 쓰는 경우가 있고,
 * 중복은 언제나 맨 위에서 생기기 때문이다.
 */
/**
 * 앞부분만 훑는 창. **맨몸 `<img>` 처럼 헷갈릴 수 있는 것에만** 쓴다 —
 * 글 중간에서 같은 이미지를 다시 쓰는 경우가 있어 통째로 지우면 안 되기 때문이다.
 */
const THUMBNAIL_SCAN_HEAD = 4000;

/** 앞부분에서 정규식에 처음 걸리는 것 하나만 지운다(뒤쪽 본문은 그대로 둔다) */
function dropFirstInHead(html: string, pattern: RegExp): string {
  const head = html.slice(0, THUMBNAIL_SCAN_HEAD);
  const match = head.match(pattern);
  if (!match || match.index === undefined) return html;
  return html.slice(0, match.index) + html.slice(match.index + match[0].length);
}

/** 문서 어디에 있든 처음 걸리는 것 하나만 지운다 */
function dropFirst(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  if (!match || match.index === undefined) return html;
  return html.slice(0, match.index) + html.slice(match.index + match[0].length);
}

/**
 * 🏷️ v3.8.700 — 티스토리 본문에서 **구조화 데이터(JSON-LD)를 전부 걷어낸다.**
 *
 * 사장님 실물 검수: 편집기 미리보기에 "SCRIPT" 덩어리가 그대로 보였다.
 * 티스토리 편집기는 본문의 `<script>` 를 실행하지 않고 **보이는 블록으로 바꿔 버려서**
 * 독자에게도 보이고 지워지지도 않는다.
 *
 * v3.8.695 는 orchestration 한 곳만 막았는데 **발행처가 여럿이었다.**
 * 실측(leadernam.tistory.com/316): 본문에 JSON-LD 가 **2개** 남아 있었다
 * (orchestration 의 Article 그래프 + generation 의 FAQ 스키마).
 * 그래서 만드는 쪽을 하나씩 쫓지 않고 **나가기 직전에 한 번에** 걷어낸다 —
 * 새 발행처가 생겨도 여기서 걸린다.
 */
function stripBodyJsonLd(html: string): string {
  return String(html || '').replace(/<script\b[^>]*type=["']application\/ld\+json["'][\s\S]*?<\/script>\s*/gi, '');
}

function stripGeneratedThumbnailHero(html: string, thumbnailUrl: string): string {
  let nextHtml = stripLeadingTemporaryImage(html);
  /**
   * v3.8.700 — 앞부분 4000자만 보던 것을 **문서 전체**로 넓혔다.
   * 실측(316번 글): 앞에 붙은 JSON-LD 가 워낙 커서 썸네일 박스가 **43,221자** 지점에 있었다.
   * 창 안에 안 들어와 못 지웠고, 그래서 대표이미지와 본문 이미지가 두 번 나왔다.
   * `bgpt-thumbnail-box` 는 우리가 붙인 이름이라 글 어디에 있든 그것 하나뿐이다 — 안전하다.
   */
  nextHtml = dropFirst(
    nextHtml,
    /<div\b[^>]*class=["'][^"']*\bbgpt-thumbnail-box\b[^"']*["'][\s\S]*?<\/div>\s*/i,
  );

  const source = normalizeTistoryPublishedImageUrl(thumbnailUrl);
  if (source) {
    const escapedSource = escapeRegExp(source);
    // 감싼 태그(p·div.separator·figure)가 있어도 그 이미지 하나를 걷어낸다
    nextHtml = dropFirstInHead(
      nextHtml,
      new RegExp(
        `(?:<(?:p|div|figure)\\b[^>]*>\\s*)?<img\\b[^>]*\\bsrc=["']${escapedSource}["'][^>]*>\\s*(?:<\\/(?:p|div|figure)>\\s*)?`,
        'i',
      ),
    );
  }
  return nextHtml.trimStart();
}

export function buildTistoryImageFallback(thumbnailUrl: string, title: string): string {
  const source = normalizeTistoryPublishedImageUrl(thumbnailUrl);
  if (!source) return '';
  const safeTitle = escapeHtmlAttribute(title);
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

// 📋 생성된 글목록 탭(tistory-posts.ts)에서도 동일한 조작 헬퍼를 재사용한다
export async function clickFirst(page: any, selectors: string[], timeoutMs = SHORT_TIMEOUT_MS): Promise<boolean> {
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

/**
 * 🖼️ v3.8.708 — 글쓰기 화면의 "저장된 글이 있습니다. 이어서 작성하시겠습니까?" 확인창.
 *
 * 사장님: "제목부분에 썸네일이미지가 대표이미지로 선택되서 보여야되는데 안보여"
 *
 * 실측(2026-09-07): 이 confirm 을 승낙하면 티스토리가 **옛 임시저장 글과 그 첨부파일**을
 * 편집기에 불러온다. 본문은 우리가 통째로 덮어써도 첨부 목록은 남아서, 옛 첨부가
 * 그 글의 대표 이미지(og:image)로 잡혔다 — 317번 글의 대표가 본문에 없는 엉뚱한 그림이던 이유.
 * 이 확인창만 거절하고 나머지(작성 모드 변경 등)는 전처럼 승낙한다.
 */
export function isTistoryDraftContinueDialog(message: string): boolean {
  const text = String(message || '');
  return /저장된\s*글/.test(text) && /이어서/.test(text);
}

export function attachTistoryDialogMonitor(page: any, onLog?: (message: string) => void): TistoryDialogMonitor {
  const messages: string[] = [];
  const handler = async (dialog: any) => {
    const message = String(typeof dialog?.message === 'function' ? dialog.message() : '').trim();
    const declineDraft = isTistoryDraftContinueDialog(message);
    if (message) {
      messages.push(message);
      while (messages.length > 20) messages.shift();
      log(onLog, `Browser dialog detected and ${declineDraft ? 'dismissed (old draft not loaded)' : 'accepted'}: ${message.slice(0, 160)}`);
    }
    if (declineDraft) {
      await dialog.dismiss().catch(() => null);
      return;
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

export async function fillFirst(page: any, selectors: string[], value: string, timeoutMs = SHORT_TIMEOUT_MS): Promise<boolean> {
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

export async function hasTitleInput(page: any, timeoutMs = 1200): Promise<boolean> {
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

export async function dismissIntroModals(page: any, onLog?: (message: string) => void): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    const clicked = await clickFirst(page, TISTORY_SELECTORS.editor.introModalCloseButtons, 1200);
    if (!clicked) break;
    log(onLog, 'Closed an editor intro modal.');
    await page.waitForTimeout(500).catch(() => null);
  }
}

export async function switchToHtmlMode(page: any, onLog?: (message: string) => void): Promise<boolean> {
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

export async function fillHtmlEditor(page: any, html: string): Promise<boolean> {
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

/**
 * 🖼️ v3.8.708 — 편집기 본문은 **iframe** 안에 있다.
 *
 * 실측(2026-09-07): 업로드된 사진은 두 번째 프레임(TinyMCE 본문)에
 * `<figure data-ke-type="image"><img src="https://blog.kakaocdn.net/dna/…?credential=…">` 로 들어온다.
 * 예전 코드는 메인 프레임의 img 만 봐서 업로드가 됐어도 "영구 주소를 확인하지 못했다"고 포기했다.
 * 그래서 이미지를 보는 함수는 전부 **모든 프레임**을 훑는다.
 */
function listPageFrames(page: any): any[] {
  try {
    const frames = typeof page?.frames === 'function' ? page.frames() : [];
    return Array.isArray(frames) && frames.length > 0 ? frames : [page];
  } catch {
    return [page];
  }
}

async function getPageImageSources(page: any): Promise<string[]> {
  const sources: string[] = [];
  for (const frame of listPageFrames(page)) {
    try {
      const found: string[] = await frame.evaluate(() => Array.from(document.querySelectorAll('img'))
        .map((img) => (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '')
        .filter(Boolean));
      sources.push(...found);
    } catch {
      continue;
    }
  }
  return sources;
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
    /**
     * v3.8.708 실측: 첨부 아이콘 `i.mce-i-image` 의 가장 가까운 button(`#attach-layer-btn`)은 **폭 0** 이고
     * 그 바깥 `div.mce-btn[aria-label="첨부"]` 가 실제로 보이는 컨트롤이다. 첫 조상만 보고 "안 보인다"로
     * 넘기면 메뉴가 안 열린다 — 보이는 조상이 나올 때까지 올라간다.
     */
    const clickNode = (node: HTMLElement): boolean => {
      const clickableSelector = 'button,a,label,[role="button"],.mce-btn,.toolbar-item,[tabindex]';
      const candidates: HTMLElement[] = [node];
      let cursor: HTMLElement | null = node.parentElement;
      for (let depth = 0; cursor && depth < 5; depth += 1) {
        if (cursor.matches(clickableSelector)) candidates.push(cursor);
        cursor = cursor.parentElement;
      }
      const clickable = candidates.find(visible);
      if (!clickable) return false;
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

/**
 * 🖼️ v3.8.708 — 첨부 버튼은 **메뉴를 열 뿐** 파일 선택창을 띄우지 않는다.
 *
 * 실측(2026-09-07): 툴바의 첨부(`#attach-layer-btn`, 아이콘 `.mce-i-image`)를 누르면
 * 사진(`#attach-image`)·파일·사진 슬라이드 메뉴가 열리고, **사진**을 눌러야 filechooser 가 뜬다.
 * 예전 코드는 첫 단계에서 멈춰 6초를 기다리다 "업로드 버튼을 찾지 못했다"로 끝났다 —
 * 썸네일이 한 번도 올라간 적이 없던 이유. 메뉴 항목 id 가 바뀌어도 되게 글자(사진/이미지)로도 찾는다.
 */
async function clickImageMenuItem(page: any): Promise<boolean> {
  return page.evaluate((selectors: string[]) => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!element) return false;
      const rect = (element as HTMLElement).getBoundingClientRect();
      const style = window.getComputedStyle(element as HTMLElement);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    for (const selector of selectors) {
      const node = Array.from(document.querySelectorAll(selector)).find(visible) as HTMLElement | undefined;
      if (node) {
        node.click();
        return true;
      }
    }
    const items = Array.from(document.querySelectorAll('.mce-menu-item, [role="menuitem"], .mce-floatpanel button, .mce-floatpanel a')) as HTMLElement[];
    for (const item of items) {
      if (!visible(item)) continue;
      const text = String(item.innerText || item.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^(사진|이미지|그림|image|photo)$/i.test(text)) continue;
      item.click();
      return true;
    }
    return false;
  }, TISTORY_SELECTORS.editor.imageMenuItems).catch(() => false);
}

type UploadedImageInfo = {
  src: string;
  alt: string;
  originWidth: number;
  originHeight: number;
  filename: string;
  score: number;
};

/** 프레임 하나에서 "이번에 새로 생긴 본문 이미지" 후보를 고른다 (브라우저 안에서 실행). */
const FIND_UPLOADED_IMAGE = (previous: string[]): UploadedImageInfo | null => {
  const sourceSet = new Set(previous);
  const visible = (element: Element | null): boolean => {
    if (!element) return false;
    const rect = (element as HTMLElement).getBoundingClientRect();
    const style = window.getComputedStyle(element as HTMLElement);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const scoreImage = (img: HTMLImageElement): number => {
    const src = img.currentSrc || img.src || '';
    if (!src || sourceSet.has(src)) return -1;
    if (!/^https:\/\//i.test(src)) return -1;
    if (/data:image\/svg|favicon|profile|avatar|emoji|emoticon|icon/i.test(src)) return -1;
    const rect = img.getBoundingClientRect();
    if (rect.width < 80 || rect.height < 60) return -1;
    const inEditorFigure = !!img.closest('figure[data-ke-type^="image"]');
    const inEditableArea = !!img.closest('[contenteditable="true"],.contents_style,.editor-content,.tt_article_useless_p_margin,figure');
    const onTistoryHost = /tistory|kakaocdn|daumcdn/i.test(src);
    // 본문(편집 영역)에 들어온 것도 아니고 티스토리 저장소 주소도 아니면 "이번 업로드"가 아니다
    // — 관리 화면 어딘가에 새로 뜬 그림을 대표로 잡는 사고를 막는다
    if (!inEditorFigure && !inEditableArea && !onTistoryHost) return -1;
    let score = rect.width * rect.height;
    if (inEditorFigure) score += 200000;
    if (inEditableArea) score += 100000;
    if (onTistoryHost) score += 50000;
    return score;
  };
  const images = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
  const best = images
    .map((img) => ({ img, score: scoreImage(img) }))
    .filter((entry) => entry.score >= 0 && visible(entry.img))
    .sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  const target = best.img;
  return {
    src: target.currentSrc || target.src || '',
    alt: target.alt || '',
    originWidth: Number(target.getAttribute('data-origin-width')) || target.naturalWidth || 0,
    originHeight: Number(target.getAttribute('data-origin-height')) || target.naturalHeight || 0,
    filename: target.getAttribute('data-filename') || '',
    score: best.score,
  };
};

async function findUploadedImageAcrossFrames(page: any, previousSources: string[]): Promise<UploadedImageInfo | null> {
  let best: UploadedImageInfo | null = null;
  for (const frame of listPageFrames(page)) {
    const found: UploadedImageInfo | null = await frame.evaluate(FIND_UPLOADED_IMAGE, previousSources).catch(() => null);
    if (found && /^https:\/\//i.test(found.src) && (!best || found.score > best.score)) best = found;
  }
  return best;
}

/**
 * 업로드된 이미지를 본문 첫 블록으로 쓸 HTML 로 만든다.
 * 크기·파일명은 data 속성으로 실어 두어 buildTistoryFinalHtml 이 티스토리 첨부 표기로 바꿀 수 있게 한다.
 */
export function buildUploadedThumbnailBlock(info: { src: string; alt?: string; originWidth?: number; originHeight?: number; filename?: string }, altText: string): string {
  const source = normalizeTistoryPublishedImageUrl(info?.src || '');
  if (!source) return '';
  const attrs = [
    `src="${escapeHtmlAttribute(source)}"`,
    `alt="${escapeHtmlAttribute(info.alt || altText)}"`,
    info.originWidth ? `data-origin-width="${Math.round(info.originWidth)}"` : '',
    info.originHeight ? `data-origin-height="${Math.round(info.originHeight)}"` : '',
    info.filename ? `data-filename="${escapeHtmlAttribute(info.filename)}"` : '',
    'loading="lazy"',
  ].filter(Boolean).join(' ');
  return `<p><img ${attrs} /></p>`;
}

async function captureUploadedThumbnailBlock(
  page: any,
  previousSources: string[],
  title: string,
): Promise<string> {
  const deadline = Date.now() + THUMBNAIL_UPLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const found = await findUploadedImageAcrossFrames(page, previousSources);
    if (found) return buildUploadedThumbnailBlock(found, title);
    await page.waitForTimeout(500).catch(() => null);
  }
  return '';
}
/**
 * 🖼️ v3.8.708 — 대표 이미지 배지는 **글자가 없고, 진짜 클릭이 있어야 나타난다.**
 *
 * 실측(2026-09-08, kImage 플러그인, 비공개 318번 글로 확인):
 *   - 본문은 `iframe#editor-tistory_ifr` 안에 있고, `window.tinymce` 는 메인 문서에 **노출되지 않는다**
 *     (iframe 쪽 tinymce 는 editors 가 비어 있는 껍데기). 그래서 `activeEditor.selection.select()` 길은
 *     항상 `no-editor` 로 끝났다.
 *   - 본문 iframe 의 `figure[data-ke-type="image"] img` 를 **마우스로** 누르면(selectionchange) 메인 문서에
 *     `div.mce-represent-image-btn` 이 나타나고, 그걸 누르면 `active` 가 붙으며 티스토리가 대표로 지정한다.
 *     같은 배지를 다시 누르면 해제(토글)라 이미 active 면 건드리지 않는다.
 *   - 예전 코드는 "대표/썸네일" 글자를 찾았는데 배지엔 글자가 없어 매번 빈손이었다.
 */
const EDITOR_FRAME_SELECTOR = 'iframe#editor-tistory_ifr, iframe[id$="_ifr"]';

async function clickUploadedImageInEditorFrame(page: any, uploadedSource: string): Promise<string> {
  if (typeof page.frameLocator !== 'function') return 'no-frame-locator';
  const frame = page.frameLocator(EDITOR_FRAME_SELECTOR).first();
  const candidates = [
    uploadedSource ? frame.locator(`figure[data-ke-type^="image"] img[src="${uploadedSource.replace(/"/g, '\\"')}"]`) : null,
    frame.locator('figure[data-ke-type^="image"] img'),
    frame.locator('img'),
  ].filter(Boolean);
  for (const locator of candidates) {
    try {
      if ((await locator.count()) <= 0) continue;
      await locator.first().click({ force: true, timeout: 5000 });
      return 'clicked';
    } catch {
      continue;
    }
  }
  return 'no-image';
}

async function clickRepresentativeBadge(page: any): Promise<string> {
  for (const frame of listPageFrames(page)) {
    const state: string = await frame.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('.mce-represent-image-btn'))
        .find((node) => (node as HTMLElement).getBoundingClientRect().width > 0) as HTMLElement | undefined;
      if (!badge) return 'missing';
      if (badge.classList.contains('active')) return 'already-active';
      badge.click();
      return badge.classList.contains('active') ? 'activated' : 'clicked-not-active';
    }).catch(() => 'missing');
    if (state !== 'missing') return state;
  }
  return 'missing';
}

async function trySetUploadedImageAsRepresentative(
  page: any,
  uploadedSource: string,
  onLog?: (message: string) => void,
): Promise<boolean> {
  const selected = await clickUploadedImageInEditorFrame(page, uploadedSource).catch((error: any) => `error:${error?.message || error}`);
  if (selected !== 'clicked') {
    log(onLog, `⚠️ 대표이미지 지정 — 본문 이미지를 선택하지 못했습니다 (${selected})`);
    return false;
  }

  // 배지는 selectionchange 뒤에 그려진다 — 잠깐씩 다시 본다
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await page.waitForTimeout(400).catch(() => null);
    const state = await clickRepresentativeBadge(page);
    if (state === 'missing') continue;
    log(onLog, `대표이미지 배지: ${state}`);
    return state === 'already-active' || state === 'activated';
  }
  log(onLog, '⚠️ 대표이미지 배지(.mce-represent-image-btn)가 화면에 나타나지 않았습니다');
  return false;
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
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null);
      const clicked = await clickImageUploadControl(page);
      // v3.8.708 첨부 버튼은 메뉴만 연다 — 메뉴의 "사진"까지 눌러야 파일 선택창이 뜬다
      if (clicked) {
        await page.waitForTimeout(500).catch(() => null);
        const menuClicked = await clickImageMenuItem(page);
        log(onLog, menuClicked ? '첨부 메뉴 → 사진 선택' : '첨부 메뉴에서 사진 항목을 찾지 못했습니다 (파일 선택창을 그대로 기다립니다)');
      }
      const chooser = clicked ? await fileChooserPromise : null;
      if (chooser) {
        await chooser.setFiles(prepared.filePath);
        uploaded = true;
      } else {
        uploaded = await setThumbnailFileInput(page, prepared.filePath);
      }
    }

    if (!uploaded) {
      log(onLog, '⚠️ 티스토리 이미지 업로드 버튼을 찾지 못했습니다 — 외부 주소로 대체합니다. '
        + '이 경우 블로그 목록 썸네일이 비어 보입니다(티스토리는 첨부된 이미지만 목록 썸네일로 씁니다).');
      return '';
    }

    log(onLog, '썸네일 업로드 접수 — 티스토리 영구 주소를 기다리는 중입니다.');
    await page.waitForTimeout(1200).catch(() => null);
    const imageBlock = await captureUploadedThumbnailBlock(page, beforeSources, title);
    if (!imageBlock) {
      log(onLog, '⚠️ 업로드는 됐지만 티스토리 영구 주소를 확인하지 못했습니다 — 외부 주소로 대체합니다. '
        + '이 경우 블로그 목록 썸네일이 비어 보입니다.');
      return '';
    }
    /**
     * 🖼️ v3.8.455 — 대표이미지 지정 결과를 **삼키지 않는다.**
     *
     * 예전에는 반환값을 버리고 .catch(() => false) 로 예외까지 삼켰다(성공 로그만 있었다).
     * 그래서 "og:image 는 있는데 블로그 목록 썸네일은 비어 있다"는 상태의 원인을
     * 로그만 봐서는 알 수 없었다. 실패해도 발행은 계속한다 — 알리기만 한다.
     */
    const uploadedSource = imageBlock.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '';
    const marked = await trySetUploadedImageAsRepresentative(page, unescapeHtmlAttribute(uploadedSource), onLog).catch(() => false);
    if (!marked) {
      log(onLog, '⚠️ 대표이미지 지정 컨트롤을 찾지 못했습니다 — 블로그 목록 썸네일이 비어 보일 수 있습니다 (본문 이미지는 정상)');
    }
    log(onLog, '✅ 썸네일이 티스토리에 업로드됐습니다 (영구 주소 확인)');
    return imageBlock;
  } finally {
    await prepared.cleanup().catch(() => undefined);
  }
}

export function buildTistoryFinalHtml(html: string, thumbnailUrl: string, uploadedThumbnailBlock: string, title: string): string {
  // v3.8.299 보험: publish-content를 우회한 경로(직접 publishToTistory 호출)도 대비 — 본문 H1 통째 제거
  if (typeof html === 'string') {
    html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
    /**
     * 🏷️ v3.8.700 — 구조화 데이터는 **나가기 직전에** 걷어낸다.
     * 발행처가 여럿이라(orchestration Article + generation FAQ) 만드는 쪽을 하나씩 막는 것으로는
     * 새는 곳이 남는다. 실측 316번 글에 2개가 남아 있었다.
     * 여기가 티스토리로 나가는 마지막 관문이므로, 어느 경로로 왔든 여기서 걸린다.
     */
    html = stripBodyJsonLd(html);
  }

  const uploadedSource = String(uploadedThumbnailBlock || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '';
  const permanentUploadedSource = normalizeTistoryPublishedImageUrl(uploadedSource);
  if (permanentUploadedSource) {
    const bodyWithoutGeneratedThumbnail = stripGeneratedThumbnailHero(html, thumbnailUrl);
    // v3.8.708 첨부 표기가 만들어지면 그걸 쓴다 — 티스토리가 대표·목록 썸네일로 알아보는 형태
    const lead = buildTistoryAttachedImageMarkup(uploadedThumbnailBlock) || buildTistoryImageFallback(permanentUploadedSource, title);
    return `${lead}\n${bodyWithoutGeneratedThumbnail}`.trim();
  }

  // v3.8.355: 대표 이미지 보장 강화
  //   과거: 본문에 <img>가 있으면 fallback 썸네일 스킵 → 티스토리가 첫 이미지를 대표로 인식 못할 때 블로그 목록에서 썸네일 사라짐
  //   현재: 원본 hero 박스를 제거한 뒤 유효한 fallback 썸네일을 무조건 최상단에 삽입
  const strippedBody = stripGeneratedThumbnailHero(stripLeadingTemporaryImage(html), thumbnailUrl);
  const fallbackThumbnail = buildTistoryImageFallback(thumbnailUrl, title);
  if (fallbackThumbnail) {
    return `${fallbackThumbnail}\n${strippedBody}`.trim();
  }
  // v3.8.355: thumbnailUrl이 무효(base64/blob 등)면 본문 첫 이미지를 대표로 승격
  const firstImgMatch = strippedBody.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
  const firstImgSrc = firstImgMatch?.[1] || '';
  if (firstImgSrc) {
    const promoted = normalizeTistoryPublishedImageUrl(firstImgSrc);
    if (promoted) {
      return `<p><img src="${promoted}" alt="${escapeHtmlAttribute(title)}" /></p>\n${strippedBody}`.trim();
    }
  }
  return strippedBody;
}

async function selectCategory(page: any, category: string | undefined, onLog?: (message: string) => void): Promise<void> {
  const targetCategory = String(category || '').replace(/\s+/g, ' ').trim();
  if (!targetCategory) return;

  /**
   * ⚠️ v3.8.453 — 카테고리 선택 실패는 **발행을 막지 않는다.**
   *
   * 사용자 실측: "발행 실패: Tistory category option was not found: 이슈 관련"
   * — 설정에 남아 있던 묵은 카테고리 하나 때문에 글 생성 비용을 전부 쓴 발행이
   * 마지막 단계에서 통째로 죽었다. 카테고리는 발행 후 티스토리 관리자에서
   * 옮길 수 있는 값이다. 글을 버리는 것보다 기본 카테고리로 내보내는 게 낫다.
   */
  const opened = await clickFirst(page, TISTORY_SELECTORS.editor.categoryTriggers, 5000);
  if (!opened) {
    log(onLog, `⚠️ 카테고리 선택 버튼을 찾지 못했습니다 — 기본 카테고리로 발행합니다 (선택했던 값: ${targetCategory})`);
    return;
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
    // v3.8.453: 블로그에 그 카테고리가 없다 — 발행을 죽이지 않고 기본 카테고리로 간다 (위 주석 참고)
    log(onLog, `⚠️ 카테고리 "${targetCategory}" 를 블로그에서 찾지 못했습니다 — 기본 카테고리로 발행합니다. `
      + '발행 화면의 카테고리 탭에서 🔄 로 실제 카테고리를 불러와 선택해 주세요.');
    // 열려 있는 카테고리 드롭다운을 닫는다 (다음 단계 클릭을 가리지 않게)
    await page.keyboard.press('Escape').catch(() => null);
    return;
  }
  log(onLog, `Selected category: ${targetCategory}`);
}

async function fillTags(page: any, tags: string[], onLog?: (message: string) => void): Promise<number> {
  if (!tags.length) return 0;

  const locator = await firstUsableLocator(page, TISTORY_SELECTORS.editor.tagInputs, 2500);
  if (!locator) {
    /**
     * 🔎 v3.8.704 — 못 찾았으면 **화면에 무엇이 있었는지** 남긴다.
     *
     * 예전에는 "못 찾았다" 한 줄이 전부였다. 티스토리가 화면을 바꾸면 그 다음에 할 수 있는 게
     * 없다 — 다시 재현해서 브라우저를 띄워 봐야 한다. 그때 봐야 할 것을 지금 적어 둔다.
     */
    try {
      const seen = await page.evaluate(() => {
        const boxes = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea'));
        return boxes.slice(0, 12).map((el) => {
          const e = el as HTMLInputElement;
          const rect = e.getBoundingClientRect();
          return [
            e.tagName.toLowerCase(),
            e.id ? `#${e.id}` : '',
            e.name ? `[name=${e.name}]` : '',
            e.placeholder ? `ph="${e.placeholder}"` : '',
            e.className ? `.${String(e.className).split(/\s+/).slice(0, 2).join('.')}` : '',
            rect.width > 0 && rect.height > 0 ? '' : '(안 보임)',
          ].filter(Boolean).join(' ');
        });
      });
      log(onLog, `Tag input was not found. 화면의 입력칸 ${seen.length}개: ${seen.join(' | ')}`);
    } catch {
      log(onLog, 'Tag input was not found. Skipping tags.');
    }
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

const PUBLISH_NAVIGATION_WAIT_MS = 4500;
const PUBLISH_NAVIGATION_RETRY_WAIT_MS = 8000;

/** 발행 뒤 편집 화면(/manage/newpost)을 벗어날 때까지 기다린다. 벗어나면 true. */
async function waitForPublishNavigation(page: any, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    if (currentUrl && !/manage\/newpost/i.test(currentUrl)) return true;
    await page.waitForTimeout(300).catch(() => null);
  }
  return false;
}

/** 발행 확인 버튼이 아직 보이고 살아 있을 때만 DOM 클릭 — 넘어가는 중이면 아무것도 안 한다. */
async function clickPublishConfirmByDom(page: any): Promise<boolean> {
  const plainSelectors = TISTORY_SELECTORS.editor.publishConfirmButtons.filter((selector) => !selector.includes(':has-text'));
  return page.evaluate((selectors: string[]) => {
    for (const selector of selectors) {
      const button = document.querySelector(selector) as HTMLButtonElement | null;
      if (!button) continue;
      const rect = button.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || button.disabled) continue;
      button.click();
      return true;
    }
    return false;
  }, plainSelectors).catch(() => false);
}

type TistoryManageListItem = { id?: unknown; title?: unknown };

/** 관리 화면 posts.json 한 페이지 (제목 검색어 있으면 그 결과). 실패하면 빈 배열. */
async function fetchTistoryManageList(page: any, blogName: string, searchKeyword = ''): Promise<TistoryManageListItem[]> {
  if (!blogName) return [];
  const endpoint = `https://${blogName}.tistory.com/manage/posts.json?category=-3&page=1&searchKeyword=${encodeURIComponent(searchKeyword)}&searchType=title&visibility=all`;
  return page.evaluate(async (url: string) => {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.items) ? json.items : [];
  }, endpoint).catch(() => []);
}

/** 발행 직전 목록의 가장 큰 글 id — 발행 뒤 "이보다 큰 id" 만 새 글로 인정한다. */
async function snapshotNewestTistoryPostId(page: any, blogName: string): Promise<number> {
  const items = await fetchTistoryManageList(page, blogName);
  return items.reduce((max, item) => {
    const id = Number(String(item?.id || '').trim());
    return Number.isFinite(id) && id > max ? id : max;
  }, 0);
}

const RESOLVE_PUBLISHED_POST_ATTEMPTS = 5;
const RESOLVE_PUBLISHED_POST_INTERVAL_MS = 1500;

/**
 * 🔗 v3.8.708 — 발행 뒤 티스토리는 글 페이지가 아니라 **글 목록(/manage/posts/)** 으로 보낸다.
 * 예전엔 그 목록 주소를 "발행 주소"로 돌려줘 앱의 발행 기록·CTA 점검이 글 id 없이 남았다.
 * 관리 화면 posts.json 을 제목으로 검색해 방금 나간 글의 id 를 찾는다 (못 찾으면 예전처럼 둔다).
 *
 * 실측(2026-09-08): 목록은 발행 직후 1~2초 늦게 갱신된다 — 같은 제목의 옛 글(321)을 새 글(322)로
 * 잘못 잡은 적이 있다. 그래서 발행 전에 찍어 둔 가장 큰 id 보다 큰 것만 인정하고, 몇 번 다시 본다.
 */
async function resolvePublishedPostByTitle(
  page: any,
  blogName: string,
  title: string,
  newestIdBefore = 0,
): Promise<{ url: string; postId: string } | null> {
  const wanted = String(title || '').replace(/\s+/g, ' ').trim();
  if (!wanted || !blogName) return null;
  for (let attempt = 0; attempt < RESOLVE_PUBLISHED_POST_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await page.waitForTimeout(RESOLVE_PUBLISHED_POST_INTERVAL_MS).catch(() => null);
    const items = await fetchTistoryManageList(page, blogName, wanted);
    const fresh = items.filter((item) => Number(String(item?.id || '').trim()) > newestIdBefore);
    // 제목이 정확히 같은 새 글만 — 새 글이 하나뿐이면 그것. 엉뚱한 옛 글을 "방금 발행한 글"로 기록하지 않는다
    const match = fresh.find((item) => String(item?.title || '').replace(/\s+/g, ' ').trim() === wanted)
      || (fresh.length === 1 ? fresh[0] : undefined);
    const postId = String(match?.id || '').trim();
    if (/^\d+$/.test(postId)) return { url: `https://${blogName}.tistory.com/${postId}`, postId };
  }
  return null;
}

async function finishPublish(
  page: any,
  config: TistoryConfig,
  postingMode: TistoryPostingMode,
  scheduleDate: Date | null | undefined,
  onLog?: (message: string) => void,
  title = '',
): Promise<{ url?: string; postId?: string }> {
  if (config.dryRun) {
    log(onLog, 'Dry run enabled. Leaving the editor open without publishing.');
    return {};
  }

  let newestIdBefore = 0;
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
    newestIdBefore = await snapshotNewestTistoryPostId(page, config.blogName);
    const confirmed = await clickFirst(page, TISTORY_SELECTORS.editor.publishConfirmButtons, 5000);
    if (!confirmed) throw new Error('Tistory publish confirmation button was not found.');
    /**
     * 🖱️ v3.8.708 — 발행 확인 버튼의 좌표 클릭이 **빗나간다.**
     *
     * 실측(2026-09-08, 비공개 시험 발행 5회): humanClick(좌표 클릭)은 4회 반응이 없었고 결과를
     * 묻지 않으므로 빗나가도 true 다. 그래서 "발행 완료 (주소 미확인)" 로 조용히 끝나고 글은 없었다.
     * 화면이 넘어가지 않았고 발행 버튼이 아직 그대로 보이면 DOM 클릭으로 **한 번만** 더 누른다
     * — 이미 넘어가는 중이면 버튼이 없으니 이중 발행은 나지 않는다.
     */
    const navigated = await waitForPublishNavigation(page, PUBLISH_NAVIGATION_WAIT_MS);
    if (!navigated) {
      const retried = await clickPublishConfirmByDom(page);
      if (retried) {
        log(onLog, '발행 버튼 첫 클릭에 반응이 없어 한 번 더 눌렀습니다.');
        await waitForPublishNavigation(page, PUBLISH_NAVIGATION_RETRY_WAIT_MS);
      }
    }
  }

  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  const postIdMatch = currentUrl.match(/tistory\.com\/(?:entry\/)?(\d+|[^/?#]+)$/i);
  const result: { url?: string; postId?: string } = {};
  if (currentUrl && !/manage\/newpost/i.test(currentUrl)) result.url = currentUrl;
  if (postIdMatch?.[1]) result.postId = postIdMatch[1];
  if (postingMode !== 'draft' && !result.postId) {
    const resolved = await resolvePublishedPostByTitle(page, config.blogName, title, newestIdBefore);
    if (resolved) {
      result.url = resolved.url;
      result.postId = resolved.postId;
      log(onLog, `발행된 글 주소 확인: ${resolved.url}`);
    }
  }
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
    /**
     * 🏷️ v3.8.704 — **태그를 못 넣었다고 글을 버리지 않는다.**
     *
     * 사장님: "발행 실패: Tistory tag input was not found or tags could not be added. 이건 왜이래??"
     *
     * 예전에는 여기서 던져서 **발행 전체가 실패**했다. 글은 다 써 놓고, 이미 본문·제목·
     * 카테고리까지 채워 놓은 상태에서 태그 칸 하나 때문에 통째로 버리는 셈이다.
     * 티스토리는 공개 API 가 없어 화면을 긁는 방식이라, 저쪽이 화면을 조금만 바꿔도 이렇게 된다
     * (실측: 이 파일의 한글 선택자 60곳이 이스케이프가 깨져 죽어 있었다).
     *
     * 태그는 **부가 정보**다. 글이 나가는 것이 먼저다.
     * 대신 조용히 넘기지 않는다 — 못 넣었다고 로그에 남기고, 결과에도 실어 보낸다.
     */
    const addedTags = await fillTags(page, tags, onLog);
    if (tags.length > 0 && addedTags === 0) {
      log(onLog, `⚠️ 태그 ${tags.length}개를 넣지 못했습니다 — 글은 그대로 발행합니다. (티스토리에서 직접 추가해 주세요)`);
    } else if (tags.length > addedTags && addedTags > 0) {
      log(onLog, `⚠️ 태그 ${tags.length}개 중 ${addedTags}개만 들어갔습니다.`);
    }
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'before_publish');

    const publishResult = await finishPublish(page, config, postingMode, scheduleDate, onLog, title);
    await throwIfTistoryBlocked(page, onLog, dialogMonitor.messages, 'after_publish');
    if (!publishResult.url && postingMode !== 'draft') {
      log(onLog, 'Publish completed but final URL was not detected. Returning editor URL as fallback.');
    }

    const successResult: TistoryPublishResult = {
      ok: true,
      url: publishResult.url || TISTORY_URLS.write(config.blogName),
      // v3.8.704: 태그가 몇 개 들어갔는지 함께 돌려준다 — 화면이 조용히 넘어가지 않게
      tagsRequested: tags.length,
      tagsAdded: addedTags,
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
