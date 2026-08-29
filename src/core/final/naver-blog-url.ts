/**
 * naver-blog-url — 네이버 블로그 주소는 **모바일로 바꿔서** 읽는다. (v3.8.595)
 *
 * ## 실측 사고 — 발행글 "la1826님의블로그를 찾는 독자를 위한 …"
 * 사장님이 네이버 블로그 URL 을 넣고 발행했더니 글 주제가 **블로그 주인 별명**이 됐다.
 * 본문 다섯 섹션이 전부 "그 사람 블로그를 어떻게 읽을 것인가" 였다.
 *
 * ## 왜 그런가 — 데스크톱 주소는 껍데기다
 * 같은 글을 두 주소로 받아 보면 제목이 다르다 (2026-08-29 실측):
 *   blog.naver.com/la1826/224394201101   → `<title>la1826님의블로그 : 네이버 블로그</title>`
 *   m.blog.naver.com/la1826/224394201101 → `<title>혁신성장촉진자금 비즈스캔 총정리! …</title>`
 *
 * 데스크톱 주소는 **프레임 껍데기**라 제목이 블로그 이름이고 본문은 iframe 안에 있다.
 * 우리 크롤러는 추출 전에 iframe 을 지우므로 본문을 볼 방법이 아예 없었다.
 * 그리고 og:title 을 " : " 로 잘라 앞부분만 쓰니 정확히 `la1826님의블로그` 가 남는다.
 *
 * ## 무엇을 하나
 *   ① 네이버 블로그 주소는 읽기 전에 **m.blog.naver.com** 으로 바꾼다.
 *   ② 그래도 제목이 블로그 이름 꼴이면 **주제로 쓰지 않는다** — 별명으로 글을 쓰느니
 *      주소가 잘못됐다고 말하는 편이 낫다.
 */

/** 네이버 블로그 글 주소인가 (글 번호가 있는 것만) */
const NAVER_BLOG_POST = /^https?:\/\/(?:m\.)?blog\.naver\.com\/([A-Za-z0-9_-]+)\/(\d+)/i;
/** PostView 형태 — 파라미터로 blogId·logNo 를 넘긴다 */
const NAVER_BLOG_POSTVIEW = /^https?:\/\/(?:m\.)?blog\.naver\.com\/(?:PostView|PostViewBottom)\.(?:naver|nhn)/i;
/** 옛 blog.me 주소 */
const NAVER_BLOG_ME = /^https?:\/\/([A-Za-z0-9_-]+)\.blog\.me\/(\d+)/i;
/** 글 번호가 없는 블로그 홈 주소 */
const NAVER_BLOG_HOME = /^https?:\/\/(?:m\.)?blog\.naver\.com\/([A-Za-z0-9_-]+)\/?(?:\?|$)/i;

/**
 * 네이버 블로그 주소를 **본문이 보이는 주소**로 바꾼다.
 * 네이버 블로그가 아니면 그대로 돌려준다.
 */
export function normalizeNaverBlogUrl(url: string): string {
  const value = String(url || '').trim();
  if (!value) return value;

  const post = NAVER_BLOG_POST.exec(value);
  if (post) return `https://m.blog.naver.com/${post[1]}/${post[2]}`;

  const oldStyle = NAVER_BLOG_ME.exec(value);
  if (oldStyle) return `https://m.blog.naver.com/${oldStyle[1]}/${oldStyle[2]}`;

  if (NAVER_BLOG_POSTVIEW.test(value)) {
    try {
      const parsed = new URL(value);
      const blogId = parsed.searchParams.get('blogId');
      const logNo = parsed.searchParams.get('logNo');
      if (blogId && logNo) return `https://m.blog.naver.com/${blogId}/${logNo}`;
    } catch { /* 못 읽으면 원래 주소로 간다 */ }
  }

  const home = NAVER_BLOG_HOME.exec(value);
  if (home) return `https://m.blog.naver.com/${home[1]}`;

  return value;
}

/** 글이 아니라 **블로그 홈** 주소인가 — 홈에는 뽑을 주제가 없다 */
export function isNaverBlogHomeUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  if (NAVER_BLOG_POST.test(value) || NAVER_BLOG_ME.test(value)) return false;
  if (NAVER_BLOG_POSTVIEW.test(value)) return false;
  return NAVER_BLOG_HOME.test(value);
}

/**
 * 제목이 **글 제목이 아니라 블로그 이름**인가.
 *
 * 이런 제목이 주제가 되면 글 전체가 그 사람 블로그 소개가 된다.
 * 네이버(님의블로그)·티스토리·브런치에서 같은 꼴이 나온다.
 */
const BLOG_NAME_FORMS: RegExp[] = [
  /님의\s*블로그/,
  /^네이버\s*블로그$/,
  /:\s*네이버\s*블로그$/,
  /의\s*블로그$/,
  /블로그\s*홈$/,
  /^티스토리$/,
  /^brunch$/i,
  /^blog$/i,
];

export function looksLikeBlogNameTitle(title: string): boolean {
  const value = String(title || '').replace(/\s+/g, ' ').trim();
  if (!value) return false;
  return BLOG_NAME_FORMS.some((form) => form.test(value));
}
