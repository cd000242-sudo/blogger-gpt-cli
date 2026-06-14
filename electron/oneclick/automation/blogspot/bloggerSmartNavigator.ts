import type { SetupState } from '../../types';
import { sleep } from '../../utils/browser';

export type BloggerPageKind =
  | 'google-login'
  | 'google-detour'
  | 'blogger-home'
  | 'blogger-posts'
  | 'blogger-settings'
  | 'blogger-theme-editor'
  | 'blogger-create'
  | 'blogger-other'
  | 'unknown';

export type BloggerPageScan = {
  page: any;
  kind: BloggerPageKind;
  url: string;
  host: string;
  title: string;
  blogId: string;
  publicUrl: string;
  selectedBlogTitle: string;
  evidence: string[];
  textSample: string;
};

type EnsureTarget = 'home' | 'settings' | 'theme-editor' | 'posts';

type WaitOptions = {
  timeoutMs?: number;
  reason?: string;
};

const BLOGGER_HOME = 'https://www.blogger.com/';
const DEFAULT_WAIT_MS = 30000;
const POLL_MS = 1200;

export function extractBloggerBlogId(url: string): string {
  const patterns = [
    /blogger\.com\/blog\/(?:posts|pages|settings|stats|comments|layout|theme|themes|earnings|themes\/edit)?\/?(\d+)/i,
    /blogger\.com\/blog\/themes\/edit\/(\d+)/i,
    /[?&](?:blogID|blogId|blog_id)=(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = String(url || '').match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

function classifyByUrl(url: string, host: string): BloggerPageKind {
  if (/accounts\.google\.com|signin|ServiceLogin/i.test(url)) return 'google-login';
  if (/(^|\.)support\.google\.com$|(^|\.)myaccount\.google\.com$/i.test(host)) return 'google-detour';
  if (!/(^|\.)blogger\.com$/i.test(host)) return 'unknown';
  if (/\/blog\/themes\/edit\/\d+/i.test(url)) return 'blogger-theme-editor';
  if (/\/blog\/settings\/\d+/i.test(url)) return 'blogger-settings';
  if (/\/blog\/posts\/\d+/i.test(url)) return 'blogger-posts';
  return 'blogger-other';
}

async function safeUrl(page: any): Promise<string> {
  try {
    return page.url();
  } catch {
    return '';
  }
}

async function bringToFront(page: any): Promise<void> {
  try { await page.bringToFront?.(); } catch { /* ignore */ }
}

export async function scanBloggerPage(page: any): Promise<BloggerPageScan> {
  const url = await safeUrl(page);
  let host = '';
  try { host = new URL(url).hostname; } catch { /* ignore */ }

  const baseKind = classifyByUrl(url, host);
  let dom = {
    title: '',
    textSample: '',
    blogIdFromLinks: '',
    publicUrl: '',
    selectedBlogTitle: '',
    evidence: [] as string[],
    looksCreate: false,
    looksHome: false,
  };

  try {
    dom = await page.evaluate(() => {
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
      let blogIdFromLinks = '';
      let selectedBlogTitle = '';
      let publicUrl = '';
      const evidence: string[] = [];

      for (const link of links) {
        const href = link.href || '';
        const blogMatch = href.match(/blogger\.com\/blog\/(?:posts|pages|settings|stats|comments|layout|theme|themes|earnings|themes\/edit)?\/?(\d+)/i)
          || href.match(/[?&](?:blogID|blogId|blog_id)=(\d+)/i);
        if (blogMatch?.[1] && !blogIdFromLinks) {
          blogIdFromLinks = blogMatch[1];
          selectedBlogTitle = (link.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          evidence.push(`blog link ${blogIdFromLinks}`);
        }
        if (/\.blogspot\.com/i.test(href) && !publicUrl) {
          publicUrl = href;
          evidence.push('public blogspot URL');
        }
      }

      if (document.querySelector('a[href*="/blog/posts/"], a[href*="/blog/settings/"], a[href*="/blog/themes"]')) {
        evidence.push('Blogger admin links');
      }
      if (/게시물 없음|No posts|Posts|게시물|글 검색|Search posts/i.test(text)) {
        evidence.push('posts screen text');
      }
      if (/설정|Settings|HTTPS|Search engine|검색엔진|메타 태그|Meta tags/i.test(text)) {
        evidence.push('settings text');
      }
      if (/테마|Theme|HTML 편집|Edit HTML|CodeMirror|b:skin/i.test(text) || document.querySelector('.CodeMirror, .ace_editor, textarea')) {
        evidence.push('theme editor text');
      }

      const looksCreate = /새 블로그|블로그 만들기|Create a blog|New blog|Blog title|주소|Address/i.test(text);
      const looksHome = /Blogger|블로그|내 블로그|Reading list|게시물/i.test(text)
        || !!document.querySelector('a[href*="/blog/"]');

      return {
        title: document.title || '',
        textSample: text.slice(0, 400),
        blogIdFromLinks,
        publicUrl,
        selectedBlogTitle,
        evidence: Array.from(new Set(evidence)).slice(0, 8),
        looksCreate,
        looksHome,
      };
    });
  } catch {
    // The page can be mid-navigation. URL-based classification is still useful.
  }

  const blogId = extractBloggerBlogId(url) || dom.blogIdFromLinks || '';
  let kind = baseKind;
  if (baseKind === 'blogger-other') {
    if (dom.looksCreate) kind = 'blogger-create';
    else if (dom.looksHome) kind = 'blogger-home';
  }

  const evidence = [...dom.evidence];
  if (blogId && !evidence.some(item => item.includes(blogId))) evidence.unshift(`Blog ID ${blogId}`);
  if (kind !== 'unknown') evidence.unshift(kind);

  return {
    page,
    kind,
    url,
    host,
    title: dom.title,
    blogId,
    publicUrl: dom.publicUrl,
    selectedBlogTitle: dom.selectedBlogTitle,
    evidence: Array.from(new Set(evidence)).slice(0, 10),
    textSample: dom.textSample,
  };
}

export async function scanBestBloggerPage(page: any): Promise<BloggerPageScan> {
  const pages = (() => {
    try {
      return page.context?.().pages?.() || [page];
    } catch {
      return [page];
    }
  })();

  const scans: BloggerPageScan[] = [];
  for (const candidate of pages) {
    try {
      if (candidate.isClosed?.()) continue;
      scans.push(await scanBloggerPage(candidate));
    } catch {
      // Ignore pages that are closing while we scan.
    }
  }
  if (!scans.length) return scanBloggerPage(page);

  const preferred = scans.find(scan => scan.blogId && scan.kind.startsWith('blogger-'))
    || scans.find(scan => scan.kind.startsWith('blogger-'))
    || scans.find(scan => scan.kind === 'google-detour')
    || scans.find(scan => scan.kind === 'google-login')
    || scans[0];

  await bringToFront(preferred.page);
  return preferred;
}

export async function ensureBloggerLanding(
  state: SetupState,
  page: any,
  reason = 'Blogger 화면을 확인합니다'
): Promise<{ page: any; scan: BloggerPageScan }> {
  let scan = await scanBestBloggerPage(page);

  if (scan.kind === 'google-detour') {
    state.message = `${reason}: Google 도움말/계정 화면으로 이동되어 Blogger 홈으로 복구합니다.`;
    await scan.page.goto(BLOGGER_HOME, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await scan.page.waitForLoadState?.('networkidle', { timeout: 8000 }); } catch { /* Blogger can keep polling. */ }
    await sleep(1800);
    scan = await scanBestBloggerPage(scan.page);
  }

  if (!scan.kind.startsWith('blogger-') && scan.kind !== 'google-login') {
    state.message = `${reason}: 현재 화면이 Blogger가 아니라 Blogger 홈으로 이동합니다.`;
    await scan.page.goto(BLOGGER_HOME, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await scan.page.waitForLoadState?.('networkidle', { timeout: 8000 }); } catch { /* Blogger can keep polling. */ }
    await sleep(1800);
    scan = await scanBestBloggerPage(scan.page);
  }

  return { page: scan.page, scan };
}

export async function waitForBloggerBlogId(
  state: SetupState,
  page: any,
  options: WaitOptions = {}
): Promise<{ page: any; scan: BloggerPageScan } | null> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (state.cancelled) return null;
    const landing = await ensureBloggerLanding(state, page, options.reason || '기존 블로그를 감지합니다');
    page = landing.page;
    if (landing.scan.blogId) return landing;

    state.message = 'Blogger 화면은 열렸지만 Blog ID를 아직 찾지 못했습니다. 블로그 목록이 보이면 사용할 블로그를 한 번 선택해 주세요.';
    await sleep(POLL_MS);
  }

  return null;
}

function targetUrl(target: EnsureTarget, blogId: string): string {
  if (target === 'settings') return `https://www.blogger.com/blog/settings/${blogId}`;
  if (target === 'theme-editor') return `https://www.blogger.com/blog/themes/edit/${blogId}`;
  if (target === 'posts') return `https://www.blogger.com/blog/posts/${blogId}`;
  return BLOGGER_HOME;
}

function matchesTarget(scan: BloggerPageScan, target: EnsureTarget, blogId?: string): boolean {
  if (target === 'home') return scan.kind.startsWith('blogger-');
  if (blogId && scan.blogId && scan.blogId !== blogId) return false;
  if (target === 'settings') return scan.kind === 'blogger-settings';
  if (target === 'theme-editor') return scan.kind === 'blogger-theme-editor';
  if (target === 'posts') return scan.kind === 'blogger-posts';
  return false;
}

export async function ensureBloggerTarget(
  state: SetupState,
  page: any,
  target: EnsureTarget,
  blogId = '',
  options: WaitOptions = {}
): Promise<{ ok: boolean; page: any; scan: BloggerPageScan }> {
  let landing = await ensureBloggerLanding(state, page, options.reason || 'Blogger 목표 화면을 확인합니다');
  page = landing.page;
  let scan = landing.scan;

  if (matchesTarget(scan, target, blogId)) return { ok: true, page, scan };

  if (target !== 'home' && !blogId) {
    const found = await waitForBloggerBlogId(state, page, { timeoutMs: 10000, reason: '목표 화면 이동 전 Blog ID를 찾습니다' });
    if (found?.scan.blogId) {
      page = found.page;
      scan = found.scan;
      blogId = found.scan.blogId;
    }
  }

  const url = targetUrl(target, blogId);
  state.message = `${options.reason || 'Blogger 목표 화면 이동'}: ${target} 화면으로 이동합니다.`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try { await page.waitForLoadState?.('networkidle', { timeout: 8000 }); } catch { /* Blogger can keep polling. */ }
  await sleep(2200);

  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.cancelled) return { ok: false, page, scan };
    scan = await scanBestBloggerPage(page);
    page = scan.page;
    if (matchesTarget(scan, target, blogId)) return { ok: true, page, scan };
    if (scan.kind === 'google-detour') {
      const recovered = await ensureBloggerLanding(state, page, 'Google 화면 이탈을 복구합니다');
      page = recovered.page;
      scan = recovered.scan;
      if (matchesTarget(scan, target, blogId)) return { ok: true, page, scan };
    }
    await sleep(POLL_MS);
  }

  return { ok: false, page, scan };
}
