// 📋 생성된 글목록 탭 — Tistory 발행 글 목록 조회 / 본문 읽기 / 수정발행
//
// 티스토리는 공개 Open API가 종료돼 REST 호출이 불가능하다. 그래서 발행과 똑같이
// 로그인된 브라우저 세션(Playwright, tistory-session.ts)으로 관리 화면과 편집기를 직접 다룬다.
//   목록  : /manage/posts 를 긁어 글 id·제목·날짜·썸네일 확보 (본문은 포함하지 않음)
//   본문  : /manage/post/{id} 편집기를 HTML 모드로 열어 원본 HTML을 그대로 읽음
//   수정발행: 같은 편집기에 제목/본문을 채워 넣고 발행 레이어에서 "수정" 확인
//
// 응답 규격은 Blogger/WordPress와 동일하게 맞춘다.
import { loadEnvFromFile } from '../env';
import { TISTORY_SELECTORS, TISTORY_URLS } from './tistory-selectors';
import {
  clickTistoryKakaoLoginIfVisible,
  hideTistoryBrowserWindow,
  isTistoryLoginPage,
  launchTistoryContext,
  resolveTistoryConfig,
} from './tistory-session';
import {
  attachTistoryDialogMonitor,
  clickFirst,
  dismissIntroModals,
  fillFirst,
  fillHtmlEditor,
  hasTitleInput,
  switchToHtmlMode,
  type TistoryDialogMonitor,
} from './tistory-publisher';
import type { TistoryConfig } from './tistory-types';
import type {
  PublishedPostDetailResult,
  PublishedPostItem,
  PublishedPostListResult,
  PublishedPostUpdateResult,
} from '../types';

const EDITOR_READY_TIMEOUT_MS = 90_000;
const LIST_SELECTOR_TIMEOUT_MS = 12_000;

type AuthAwareError = Error & { needsAuth?: boolean };

type ScrapedPost = {
  id: string;
  title: string;
  thumb: string;
  published: string;
  url: string;
};

type TistorySession = {
  page: any;
  config: TistoryConfig;
};

function log(message: string): void {
  console.log(`[TISTORY-POSTS] ${message}`);
}

function authError(message: string): AuthAwareError {
  const error = new Error(message) as AuthAwareError;
  error.needsAuth = true;
  return error;
}

function toErrorResult(error: unknown): { ok: false; error: string; needsAuth: boolean } {
  const typed = error as AuthAwareError | undefined;
  const message = typed?.message || String(error);
  return { ok: false, error: message, needsAuth: Boolean(typed?.needsAuth) };
}

/**
 * 티스토리 목록의 날짜 표기("2026. 7. 20. 14:32", "2026-07-20")를 UI가 파싱할 수 있는 ISO 형태로 변환.
 * 인식하지 못하면 원문을 그대로 돌려준다 (UI가 원문을 표시).
 */
function normalizeTistoryDate(raw: string): string {
  const text = String(raw || '').trim();
  if (!text) return '';
  const matched = text.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})(?:[.\s]+(\d{1,2}):(\d{2}))?/);
  if (!matched) return text;
  const [, year, month, day, hour, minute] = matched;
  const pad = (value: string | undefined, fallback: string) => String(value ?? fallback).padStart(2, '0');
  return `${year}-${pad(month, '1')}-${pad(day, '1')}T${pad(hour, '0')}:${pad(minute, '0')}:00`;
}

async function openTistorySession(
  payload: Record<string, any> = {},
): Promise<TistorySession> {
  const config = resolveTistoryConfig(payload, loadEnvFromFile());
  if (!config.blogName) {
    throw authError('티스토리 블로그 주소가 설정되지 않았습니다. 환경설정 → 티스토리에서 블로그 주소를 저장한 뒤 다시 시도해주세요.');
  }
  const launched = await launchTistoryContext(config, (message) => log(message));
  return { page: launched.page, config };
}

/** 로그인 화면이면 카카오 로그인을 눌러보고, 그래도 로그인 화면이면 false */
async function ensureLoggedIn(page: any, config: TistoryConfig): Promise<boolean> {
  if (!(await isTistoryLoginPage(page))) return true;
  await clickTistoryKakaoLoginIfVisible(page, (message) => log(message), config.kakaoEmail);
  await page.waitForTimeout(2500).catch(() => null);
  return !(await isTistoryLoginPage(page));
}

// ─────────────────────────────────────────────
// 목록
// ─────────────────────────────────────────────

type ScrapeDiagnostics = {
  editLinks: number;
  dataIdNodes: number;
  checkboxes: number;
  pageTitle: string;
  bodyTextHead: string;
};

async function scrapeManagePosts(page: any): Promise<{ items: ScrapedPost[]; maxPage: number; diagnostics: ScrapeDiagnostics }> {
  return page.evaluate(() => {
    const normalize = (value: unknown) => String(value || '')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 실제 구조(2026-07 확인):
    //   <ul class="list_post"><li>
    //     <div class="check_blog"><input id="inpCheck313"></div>
    //     <div class="post_cont">
    //       <strong class="tit_post"><a class="link_cont" href="https://blog.tistory.com/entry/..." title="제목">제목</a></strong>
    //       <a href="/manage/posts?category=N"><span class="txt_cate">카테고리</span></a>
    //       <span class="txt_info">작성자</span><span class="txt_info">2026-06-29 18:15</span>
    //     </div>
    //     <div class="post_btn">... <a class="btn_post" href="/manage/post/313?returnURL=...">수정</a> ...</div>
    //   </li></ul>
    const rowNodes = new Set<Element>();
    document.querySelectorAll('ul[class*="list_post"] > li').forEach((row) => rowNodes.add(row));
    if (rowNodes.size === 0) {
      // 목록 컨테이너 클래스가 바뀌었을 때의 폴백 — 글 id를 가진 링크에서 행을 거슬러 올라간다.
      //   ⚠️ 앵커 자신이 행으로 잡히면 안 된다(예: <a class="btn_post">는 [class*="post"]에 매칭됨).
      //   그래서 부모에서부터 closest를 시작한다.
      document.querySelectorAll('a[href*="/manage/post/"], a[href*="/manage/newpost/"]').forEach((anchor) => {
        const parent = anchor.parentElement;
        const row = parent ? (parent.closest('li, tr, article') || parent.closest('[class*="item" i]')) : null;
        if (row) rowNodes.add(row);
      });
    }

    const readPostId = (row: Element): string => {
      const editHref = Array.from(row.querySelectorAll('a[href]'))
        .map((anchor) => anchor.getAttribute('href') || '')
        .find((href) => /\/manage\/(?:newpost|post)\/\d+/.test(href)) || '';
      const fromEdit = editHref.match(/\/manage\/(?:newpost|post)\/(\d+)/);
      if (fromEdit && fromEdit[1]) return fromEdit[1];

      const statsHref = Array.from(row.querySelectorAll('a[href]'))
        .map((anchor) => anchor.getAttribute('href') || '')
        .find((href) => /\/manage\/statistics\/entry\/\d+/.test(href)) || '';
      const fromStats = statsHref.match(/\/manage\/statistics\/entry\/(\d+)/);
      if (fromStats && fromStats[1]) return fromStats[1];

      const checkbox = row.querySelector('input[type="checkbox"][id]');
      const fromCheckbox = (checkbox?.getAttribute('id') || '').match(/(\d+)/);
      if (fromCheckbox && fromCheckbox[1]) return fromCheckbox[1];

      const dataId = row.getAttribute('data-entry-id') || row.getAttribute('data-post-id') || row.getAttribute('data-id') || '';
      return /^\d+$/.test(dataId.trim()) ? dataId.trim() : '';
    };

    const found = new Map<string, { id: string; title: string; thumb: string; published: string; url: string }>();

    rowNodes.forEach((row) => {
      const id = readPostId(row);
      if (!id) return;

      // 제목: 발행글로 나가는 링크(title 속성 우선)
      const titleAnchor = row.querySelector('[class*="tit_post" i] a, a[class*="link_cont" i], a[href*="/entry/" i]') as HTMLAnchorElement | null;
      const title = normalize(titleAnchor?.getAttribute('title') || titleAnchor?.innerText || titleAnchor?.textContent || '');

      const entryHref = Array.from(row.querySelectorAll('a[href]'))
        .map((anchor) => (anchor as HTMLAnchorElement).href || '')
        .find((href) => /\/entry\//i.test(href) && !/\/manage\//i.test(href)) || '';

      const rowText = normalize((row as HTMLElement).innerText || row.textContent || '');
      const dateMatch = rowText.match(/\d{4}[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}(?:[.\s]+\d{1,2}:\d{2})?/);

      const image = row.querySelector('img') as HTMLImageElement | null;
      const thumb = image ? (image.currentSrc || image.getAttribute('src') || '') : '';

      // 글 행의 최소 증거 — 제목·발행일·글주소 중 하나도 없으면 목록 행이 아니다
      if (!title && !dateMatch && !entryHref) return;

      const previous = found.get(id);
      if (previous && previous.title && !title) return;
      found.set(id, {
        id,
        title,
        thumb,
        published: dateMatch ? dateMatch[0] : '',
        url: entryHref,
      });
    });

    let maxPage = 1;
    document.querySelectorAll('a[href*="page="]').forEach((anchor) => {
      const matched = (anchor.getAttribute('href') || '').match(/[?&]page=(\d+)/);
      if (matched && matched[1]) maxPage = Math.max(maxPage, Number(matched[1]));
    });

    // 0건일 때 "글이 없음"인지 "화면 구조가 바뀌어 못 읽음"인지 구분하기 위한 진단값
    const diagnostics = {
      editLinks: document.querySelectorAll('a[href*="/manage/newpost/"], a[href*="/manage/post/"]').length,
      dataIdNodes: rowNodes.size,
      checkboxes: document.querySelectorAll('input[type="checkbox"]').length,
      pageTitle: normalize(document.title).slice(0, 80),
      bodyTextHead: normalize(document.body ? document.body.innerText : '').slice(0, 160),
    };

    return { items: Array.from(found.values()), maxPage, diagnostics };
  });
}

/**
 * 발행된 글 목록 조회. 본문(content)은 포함하지 않으므로 편집 시 getTistoryPost로 따로 읽어야 한다.
 * pageToken은 관리 화면의 페이지 번호를 문자열로 담는다.
 */
export async function listTistoryPosts(options: {
  maxResults?: number;
  pageToken?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostListResult> {
  let pageRef: any = null;
  try {
    // 목록 조회는 사용자 조작이 필요 없으므로 창을 숨긴 채 실행한다
    const session = await openTistorySession({ ...(options.payload || {}), tistoryHiddenBrowser: true });
    pageRef = session.page;

    const pageNo = Math.max(Number(options.pageToken) || 1, 1);
    // 관리 화면 주소가 개편될 수 있어 후보를 순서대로 열어보고, 글이 잡히는 첫 주소를 채택한다.
    const candidateUrls = TISTORY_URLS.managePostsCandidates(session.config.blogName, pageNo);
    let scraped: { items: ScrapedPost[]; maxPage: number; diagnostics: ScrapeDiagnostics } | null = null;
    let lastUrl = '';

    for (const listUrl of candidateUrls) {
      await pageRef.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: session.config.timeoutMs }).catch(() => null);
      await pageRef.waitForTimeout(1500).catch(() => null);

      if (!(await ensureLoggedIn(pageRef, session.config))) {
        throw authError('티스토리 로그인이 필요합니다. 환경설정 → 티스토리에서 카카오/티스토리 로그인을 완료한 뒤 새로고침해주세요.');
      }

      // 관리 화면은 목록을 JS로 그리므로 DOM 준비까지 기다린다 (없으면 다음 후보 주소로)
      await pageRef.waitForSelector('a[href*="/manage/newpost/"], a[href*="/manage/post/"]', { timeout: LIST_SELECTOR_TIMEOUT_MS }).catch(() => null);
      await pageRef.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);

      lastUrl = String(typeof pageRef.url === 'function' ? pageRef.url() : listUrl);
      const attempt = await scrapeManagePosts(pageRef);
      log(`목록 후보 ${listUrl} → 글 ${attempt.items.length}개 (편집링크 ${attempt.diagnostics.editLinks}개)`);
      if (!scraped || attempt.items.length > scraped.items.length) scraped = attempt;
      if (attempt.items.length > 0) break;
    }

    if (!scraped || scraped.items.length === 0) {
      // 여기서 빈 목록을 성공으로 돌려주면 "발행된 글이 없습니다"로 표시돼
      // 실제 원인(화면 구조 변경·권한)을 영영 알 수 없다. 진단값을 담아 실패로 알린다.
      const diag = scraped?.diagnostics;
      throw new Error(
        '티스토리 관리 화면에서 글 목록을 읽지 못했습니다. '
        + `(마지막 주소: ${lastUrl || '알 수 없음'}, 화면 제목: "${diag?.pageTitle || '없음'}", `
        + `편집링크 ${diag?.editLinks ?? 0}개 · id요소 ${diag?.dataIdNodes ?? 0}개 · 체크박스 ${diag?.checkboxes ?? 0}개) `
        + '실제로 발행한 글이 있는데도 이 메시지가 보이면 티스토리 관리 화면 구조가 바뀐 것이니 개발자에게 이 메시지를 그대로 알려주세요.',
      );
    }

    const maxResults = Math.max(Number(options.maxResults) || scraped.items.length || 0, 0);
    const sliced = maxResults > 0 ? scraped.items.slice(0, maxResults) : scraped.items;
    const items: PublishedPostItem[] = sliced.map((post) => ({
      id: post.id,
      title: post.title || '(제목 없음)',
      url: post.url || TISTORY_URLS.entry(session.config.blogName, post.id),
      published: normalizeTistoryDate(post.published),
      updated: '',
      content: '',
      imageUrl: post.thumb,
    }));

    log(`목록 ${items.length}개 확보 (page ${pageNo}/${scraped.maxPage})`);
    return {
      ok: true,
      items,
      nextPageToken: pageNo < scraped.maxPage ? String(pageNo + 1) : null,
    };
  } catch (error) {
    console.error('[TISTORY-POSTS] ❌ 글 목록 조회 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  } finally {
    if (pageRef) await hideTistoryBrowserWindow(pageRef, (message) => log(message)).catch(() => false);
  }
}

// ─────────────────────────────────────────────
// 편집기 열기 / 본문 읽기
// ─────────────────────────────────────────────

async function waitForPostEditorReady(page: any, editUrl: string, config: TistoryConfig): Promise<boolean> {
  const deadline = Date.now() + EDITOR_READY_TIMEOUT_MS;
  let lastNavigation = Date.now();

  while (Date.now() < deadline) {
    if (await hasTitleInput(page)) return true;

    const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
    if (await isTistoryLoginPage(page)) {
      await clickTistoryKakaoLoginIfVisible(page, (message) => log(message), config.kakaoEmail);
    } else if (!/\/manage\/(?:newpost|post)\/\d+/i.test(currentUrl) && Date.now() - lastNavigation > 8000) {
      lastNavigation = Date.now();
      await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
    }
    await page.waitForTimeout(2000).catch(() => null);
  }

  return hasTitleInput(page, 2000);
}

async function openPostEditor(page: any, config: TistoryConfig, postId: string): Promise<void> {
  const editUrl = TISTORY_URLS.editPost(config.blogName, postId);
  log(`편집기 열기: ${editUrl}`);
  await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs }).catch(() => null);
  await page.waitForTimeout(1200).catch(() => null);

  if (!(await waitForPostEditorReady(page, editUrl, config))) {
    throw authError('티스토리 편집기를 열지 못했습니다. 열린 브라우저에서 카카오/티스토리 로그인을 완료한 뒤 다시 시도해주세요.');
  }
  await dismissIntroModals(page, (message) => log(message));
}

async function readEditorTitle(page: any): Promise<string> {
  for (const selector of TISTORY_SELECTORS.editor.titleInputs) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count().catch(() => 0)) <= 0) continue;
      const value = await locator.inputValue({ timeout: 2000 }).catch(() => null);
      if (typeof value === 'string' && value.trim()) return value.trim();
      const text = await locator.innerText({ timeout: 2000 }).catch(() => '');
      if (String(text).trim()) return String(text).trim();
    } catch {
      continue;
    }
  }
  return '';
}

/** HTML 모드 소스 → 리치 에디터 innerHTML → iframe 본문 순으로 원본 HTML을 확보 */
async function readEditorHtml(page: any): Promise<string> {
  const fromCodeEditor = await page.evaluate(() => {
    const codeMirrorHost = document.querySelector('.CodeMirror') as any;
    const codeMirror = codeMirrorHost?.CodeMirror;
    if (codeMirror && typeof codeMirror.getValue === 'function') return String(codeMirror.getValue() || '');

    const cmContent = document.querySelector('.cm-content[contenteditable="true"]') as HTMLElement | null;
    if (cmContent) return String(cmContent.innerText || '');

    const textarea = document.querySelector(
      '#html-editor, textarea[name="html"], textarea[data-mode="html"], textarea.tx-source',
    ) as HTMLTextAreaElement | null;
    if (textarea) return String(textarea.value || '');

    return '';
  }).catch(() => '');
  if (String(fromCodeEditor).trim()) return String(fromCodeEditor);

  const fromRichEditor = await page.evaluate(() => {
    const selectors = ['.contents_style[contenteditable="true"]', '.editor-content[contenteditable="true"]'];
    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element && element.innerHTML.trim()) return element.innerHTML;
    }
    return '';
  }).catch(() => '');
  if (String(fromRichEditor).trim()) return String(fromRichEditor);

  try {
    const frames = typeof page.frames === 'function' ? page.frames() : [];
    const mainFrame = typeof page.mainFrame === 'function' ? page.mainFrame() : null;
    for (const frame of frames) {
      if (mainFrame && frame === mainFrame) continue;
      const html = await frame.evaluate(() => {
        const body = document.body;
        if (!body || !body.isContentEditable) return '';
        return body.innerHTML;
      }).catch(() => '');
      if (String(html).trim()) return String(html);
    }
  } catch {
    // iframe 폴백 실패는 무시 — 아래에서 빈 문자열로 처리
  }

  return '';
}

/**
 * 편집할 글의 원본 HTML/제목을 읽어온다.
 * 목록 조회와 달리 브라우저 창을 숨기지 않는 이유는, 로그인이 풀렸을 때 사용자가 직접 로그인해야 하기 때문.
 */
export async function getTistoryPost(options: {
  postId?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostDetailResult> {
  const postId = String(options.postId || '').trim();
  if (!postId) return { ok: false, error: 'postId가 없습니다.' };

  let monitor: TistoryDialogMonitor | null = null;
  let pageRef: any = null;
  let hideAfterUse = false;
  try {
    const session = await openTistorySession(options.payload || {});
    pageRef = session.page;
    monitor = attachTistoryDialogMonitor(pageRef, (message) => log(message));

    await openPostEditor(pageRef, session.config, postId);
    const title = await readEditorTitle(pageRef);
    await switchToHtmlMode(pageRef, (message) => log(message));
    const content = await readEditorHtml(pageRef);

    if (!content.trim()) {
      throw new Error('티스토리 편집기에서 본문을 읽지 못했습니다. 편집기가 완전히 열린 뒤 다시 시도해주세요.');
    }

    hideAfterUse = true;
    log(`본문 ${content.length}자 확보 (postId=${postId})`);
    return {
      ok: true,
      postId,
      title,
      url: TISTORY_URLS.entry(session.config.blogName, postId),
      content,
    };
  } catch (error) {
    console.error('[TISTORY-POSTS] ❌ 본문 조회 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  } finally {
    monitor?.dispose();
    if (hideAfterUse && pageRef) {
      await hideTistoryBrowserWindow(pageRef, (message) => log(message)).catch(() => false);
    }
  }
}

// ─────────────────────────────────────────────
// 수정발행
// ─────────────────────────────────────────────

async function confirmUpdate(page: any, config: TistoryConfig, postId: string): Promise<string> {
  const opened = await clickFirst(page, TISTORY_SELECTORS.editor.publishButtons, 6000);
  if (!opened) throw new Error('티스토리 "완료" 버튼을 찾지 못했습니다.');
  await page.waitForTimeout(1200).catch(() => null);

  // 공개 설정은 원래 글의 값을 그대로 유지해야 하므로 건드리지 않는다
  const confirmed = await clickFirst(page, TISTORY_SELECTORS.editor.updateConfirmButtons, 6000);
  if (!confirmed) throw new Error('티스토리 수정 확인 버튼을 찾지 못했습니다.');
  await page.waitForTimeout(3500).catch(() => null);

  const currentUrl = String(typeof page.url === 'function' ? page.url() : '');
  if (currentUrl && !/manage\/newpost/i.test(currentUrl)) return currentUrl;
  return TISTORY_URLS.entry(config.blogName, postId);
}

/** 수정발행 — 제목/본문만 갱신하고 카테고리·태그·공개설정은 원래 값을 유지한다 */
export async function updateTistoryPost(options: {
  postId?: string;
  title?: string;
  content?: string;
  payload?: Record<string, any>;
} = {}): Promise<PublishedPostUpdateResult> {
  const postId = String(options.postId || '').trim();
  const title = String(options.title || '').trim();
  const content = String(options.content || '');

  if (!postId) return { ok: false, error: 'postId가 없습니다.' };
  if (!content.trim()) return { ok: false, error: '본문이 비어 있습니다.' };

  let monitor: TistoryDialogMonitor | null = null;
  let pageRef: any = null;
  let hideAfterUse = false;
  try {
    const session = await openTistorySession(options.payload || {});
    pageRef = session.page;
    monitor = attachTistoryDialogMonitor(pageRef, (message) => log(message));

    await openPostEditor(pageRef, session.config, postId);

    if (title) {
      const titleFilled = await fillFirst(pageRef, TISTORY_SELECTORS.editor.titleInputs, title, 7000);
      if (!titleFilled) throw new Error('티스토리 제목 입력란을 찾지 못했습니다.');
    }

    await switchToHtmlMode(pageRef, (message) => log(message));
    const bodyFilled = await fillHtmlEditor(pageRef, content);
    if (!bodyFilled) throw new Error('티스토리 본문 편집기를 찾지 못했습니다.');

    const url = await confirmUpdate(pageRef, session.config, postId);
    hideAfterUse = true;
    log(`✅ 수정발행 완료: ${url}`);
    return { ok: true, postId, url, updated: new Date().toISOString() };
  } catch (error) {
    console.error('[TISTORY-POSTS] ❌ 수정발행 실패:', (error as Error)?.message || error);
    return toErrorResult(error);
  } finally {
    monitor?.dispose();
    if (hideAfterUse && pageRef) {
      await hideTistoryBrowserWindow(pageRef, (message) => log(message)).catch(() => false);
    }
  }
}
