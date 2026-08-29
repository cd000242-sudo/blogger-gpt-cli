/**
 * naver-blog-source — 네이버 블로그 글은 **네 군데서** 가져온다. (v3.8.595)
 *
 * ## 왜 만들었나
 * 사장님: "추출이 성공하게 수정해. 네이버 허브 api도 있는데 추출을 못한다는 게 말이 안 돼."
 * 맞는 말이다. 데스크톱 주소 하나만 긁어 보고 실패하던 것이지, 길이 없던 게 아니다.
 *
 * ## 네 갈래 (2026-08-29 전부 실측)
 * 같은 글(la1826/224394201101)로 넷 다 확인했다.
 *   ① m.blog.naver.com/{id}/{logNo}      → og:title + .se-main-container (본문 통째)
 *   ② PostView.naver?blogId=&logNo=      → <title> + .se-main-container (①이 막힐 때)
 *   ③ rss.blog.naver.com/{id}.xml        → 제목 + 요약. 링크의 logNo 로 그 글을 고른다
 *   ④ 네이버 검색 API — **query 를 logNo 로** 준다
 *        "224394201101" 검색 → total 1, link 가 정확히 그 글이었다.
 *        허브·레거시 키 어느 쪽이든 naverSearch 한 창구로 나간다.
 *
 * 앞에서 성공하면 뒤는 부르지 않는다. ①②③ 은 무료이고 ④ 만 API 를 쓴다.
 *
 * ## 왜 데스크톱 주소로는 안 됐나
 * 그 주소는 프레임 껍데기다 — 제목이 `{별명}님의블로그` 이고 본문은 iframe 안에 있다.
 * 우리 크롤러는 추출 전에 iframe 을 지우므로 볼 방법이 없었다 (naver-blog-url 머리말).
 */

import * as cheerio from 'cheerio';
import { looksLikeBlogNameTitle } from './naver-blog-url';

export interface NaverBlogPost {
  title: string;
  content: string;
  /** 원문 주소 (사용자가 넣은 주소 그대로) */
  url: string;
  /** 어느 갈래로 가져왔는지 — 로그용 */
  via: 'mobile' | 'postview' | 'rss' | 'search-api';
}

export interface NaverBlogRef {
  blogId: string;
  logNo: string;
}

const POST_PATH = /^https?:\/\/(?:m\.)?blog\.naver\.com\/([A-Za-z0-9_-]+)\/(\d+)/i;
const POST_ME = /^https?:\/\/([A-Za-z0-9_-]+)\.blog\.me\/(\d+)/i;
const POST_VIEW = /^https?:\/\/(?:m\.)?blog\.naver\.com\/PostView/i;

/** 주소에서 blogId·logNo 를 뽑는다. 글 주소가 아니면 null */
export function parseNaverBlogUrl(url: string): NaverBlogRef | null {
  const value = String(url || '').trim();
  if (!value) return null;

  const path = POST_PATH.exec(value);
  if (path && path[1] && path[2]) return { blogId: path[1], logNo: path[2] };

  const old = POST_ME.exec(value);
  if (old && old[1] && old[2]) return { blogId: old[1], logNo: old[2] };

  if (POST_VIEW.test(value)) {
    try {
      const parsed = new URL(value);
      const blogId = parsed.searchParams.get('blogId');
      const logNo = parsed.searchParams.get('logNo');
      if (blogId && logNo) return { blogId, logNo };
    } catch { /* 못 읽으면 글 주소가 아니다 */ }
  }
  return null;
}

const stripTags = (value: string): string => String(value || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&middot;/gi, '·')
  .replace(/\s+/g, ' ')
  .trim();

/** 네이버가 제목 뒤에 붙이는 블로그 이름을 뗀다 */
export function cleanNaverTitle(raw: string): string {
  const value = stripTags(raw).replace(/\s*:\s*네이버\s*블로그\s*$/i, '').trim();
  return looksLikeBlogNameTitle(value) ? '' : value;
}

/** 본문으로 인정할 최소 길이 — 이보다 짧으면 다음 갈래로 넘어간다 */
const MIN_CONTENT = 200;

/** m.blog / PostView 로 받은 HTML 에서 제목과 본문을 뽑는다 */
export function extractPostFromHtml(html: string): { title: string; content: string } {
  const source = String(html || '');
  if (!source) return { title: '', content: '' };

  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(source)
    || /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i.exec(source);
  const tag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source);
  const title = cleanNaverTitle(og?.[1] || '') || cleanNaverTitle(tag?.[1] || '');

  /**
   * 본문 컨테이너 — 스마트에디터(se-main-container) 우선, 구 에디터는 postViewArea.
   *
   * 정규식으로 `</div>` 를 세다가 **본문이 잘렸다** (실측: 전체 글인데 200자 미만이 나와
   * RSS 요약 360자로 떨어졌다). 네이버 본문은 div 가 깊게 겹쳐 있어 짝을 못 맞춘다.
   * 파서에게 맡긴다 — cheerio 는 이 파일들이 이미 쓰고 있다.
   */
  const $ = cheerio.load(source);
  $('script, style, noscript').remove();

  /**
   * **순서가 곧 우선순위다.** 길이로 고르면 안 된다 — 실측에서 `.post_ct`(9,294자)가
   * `.se-main-container`(9,154자)보다 140자 길어서 이겼는데, 그 140자가
   * "이웃추가 · 폰트 크기 조정 · 신고하기" 같은 **화면 부속물**이었다.
   * 본문 컨테이너가 본문만큼 나오면 거기서 끝낸다.
   */
  let longest = '';
  for (const selector of ['.se-main-container', '#postViewArea', '.post-view', '.post_ct']) {
    const text = stripTags($(selector).first().text());
    if (text.length >= MIN_CONTENT) return { title, content: text };
    if (text.length > longest.length) longest = text;
  }

  return { title, content: longest };
}

/** RSS 에서 그 글의 항목을 고른다 (링크에 logNo 가 있는 것) */
export function pickRssItem(xml: string, logNo: string): { title: string; content: string } | null {
  const items = String(xml || '').split(/<item>/i).slice(1);
  for (const item of items) {
    if (!item.includes(logNo)) continue;
    const title = /<title>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/title>/i.exec(item);
    const description = /<description>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/description>/i.exec(item);
    const cleanTitle = cleanNaverTitle(title?.[1] || '');
    if (!cleanTitle) continue;
    return { title: cleanTitle, content: stripTags(description?.[1] || '') };
  }
  return null;
}

/** 검색 API 결과에서 그 글을 고른다 (link 에 logNo 가 있는 것) */
export function pickSearchItem(items: any[], logNo: string): { title: string; content: string } | null {
  for (const item of Array.isArray(items) ? items : []) {
    const link = String(item?.link || '');
    if (!link.includes(logNo)) continue;
    const title = cleanNaverTitle(String(item?.title || ''));
    if (!title) continue;
    return { title, content: stripTags(String(item?.description || '')) };
  }
  return null;
}

export interface NaverBlogFetchDeps {
  /** HTML 한 장 가져오기. 실패하면 빈 문자열 */
  fetchHtml: (url: string) => Promise<string>;
  /** 네이버 검색 한 번 (naverSearch 를 감싼 것) */
  searchBlog?: (query: string) => Promise<any[]>;
  log?: (msg: string) => void;
}

/**
 * 네이버 블로그 글을 가져온다. 네 갈래를 순서대로 시도한다.
 * 글 주소가 아니거나 전부 실패하면 null.
 */
export async function fetchNaverBlogPost(
  url: string,
  deps: NaverBlogFetchDeps,
): Promise<NaverBlogPost | null> {
  const ref = parseNaverBlogUrl(url);
  if (!ref) return null;
  const { blogId, logNo } = ref;
  const log = deps.log || (() => { });

  const attempts: Array<{ via: NaverBlogPost['via']; run: () => Promise<{ title: string; content: string } | null> }> = [
    {
      via: 'mobile',
      run: async () => extractPostFromHtml(await deps.fetchHtml(`https://m.blog.naver.com/${blogId}/${logNo}`)),
    },
    {
      via: 'postview',
      run: async () => extractPostFromHtml(await deps.fetchHtml(
        `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}&redirect=Dlog&widgetTypeCall=true&directAccess=false`,
      )),
    },
    {
      via: 'rss',
      run: async () => pickRssItem(await deps.fetchHtml(`https://rss.blog.naver.com/${blogId}.xml`), logNo),
    },
    {
      via: 'search-api',
      run: async () => (deps.searchBlog ? pickSearchItem(await deps.searchBlog(logNo), logNo) : null),
    },
  ];

  /** 제목만 건진 결과 — 본문까지 못 채우면 이거라도 쓴다 */
  let titleOnly: NaverBlogPost | null = null;

  for (const attempt of attempts) {
    let got: { title: string; content: string } | null = null;
    try {
      got = await attempt.run();
    } catch (error: any) {
      log(`[NAVER-BLOG] ${attempt.via} 실패: ${String(error?.message || error).slice(0, 80)}`);
      continue;
    }
    if (!got?.title) continue;

    if (got.content.length >= MIN_CONTENT) {
      log(`[NAVER-BLOG] ✅ ${attempt.via} 에서 확보: "${got.title.slice(0, 30)}" (본문 ${got.content.length}자)`);
      return { title: got.title, content: got.content, url, via: attempt.via };
    }
    if (!titleOnly) titleOnly = { title: got.title, content: got.content, url, via: attempt.via };
  }

  if (titleOnly) {
    log(`[NAVER-BLOG] ⚠️ 제목만 확보(${titleOnly.via}): "${titleOnly.title.slice(0, 30)}"`);
  }
  return titleOnly;
}
