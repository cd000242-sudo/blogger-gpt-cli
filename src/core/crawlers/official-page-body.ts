/**
 * official-page-body — 기관 페이지에서 **본문**을 뽑는다. (v3.8.580)
 *
 * ## 왜 따로 만들었나
 * 사장님: **"결과를 스니펫 말고 본문을 긁게 해야 하는 거 아니니?"**
 *
 * 맞다. 검색 API 가 주는 description 은 120자쯤이라 표·금액표·조건 목록이 통째로 빠진다.
 * 근거 장부가 얇으면 fact-guard 가 맞는 문장까지 지운다.
 *
 * 그런데 기존 `extractArticleBody` 를 그대로 쓰면 안 된다 — 그건 **언론사 기사용**이다.
 * 실측(2026-08-29, 기관 URL 18건 · 16건):
 *
 *   · 기사 컨테이너(article-body, dic_area…)로는 **기관 페이지 전부 추출 실패**
 *   · 문장 종결 밀도 하한(0.5)에도 걸린다 — 고시·안내문은 표와 목록이라 문장이 적다
 *   · 반면 `#contents` 컨테이너로는 2,017자 · 2,566자가 깔끔하게 나왔다 (스니펫은 122자)
 *
 * ## 더 중요한 발견 — 기관 검색 결과의 대부분은 웹페이지가 아니다
 * 같은 실측에서 기관 결과 18건 중 **15건이 첨부파일**이었다(.pdf, fileDown.do).
 * 그걸 그냥 fetch 하면 바이너리가 평문으로 읽혀 **370만 자짜리 쓰레기**가 나온다.
 * 근거 장부에 그게 들어가면 없느니만 못하다.
 *
 * 그래서 두 관문을 둔다:
 *   ① 주소 모양으로 거른다 (`looksLikeFileUrl`) — 요청조차 보내지 않는다
 *   ② 응답 Content-Type 이 text/html 이 아니면 버린다 — 주소만으로는 못 거르는 게 있다
 *      (실측: `ooh.or.kr/file/down.do` 는 확장자가 없는데 application/octet-stream 이었다)
 *
 * ## 막지 않는다
 * 무엇 하나라도 어긋나면 null 을 돌려준다. 호출부는 스니펫을 그대로 쓴다.
 * 본문을 못 구하는 건 흔한 일이고, 그것 때문에 발행이 멈추면 안 된다.
 */

import { extractBalancedBlock, toPlainText } from './naver-post-body';

/** 기관 페이지 한 건에서 가져올 최대 글자수 */
export const DEFAULT_MAX_PAGE_CHARS = 900;

/** 이 정도는 나와야 본문으로 본다 (메뉴만 긁은 것과 구분) */
const MIN_ACCEPTABLE_CHARS = 250;

/** 내려받기 주소 — 요청도 보내지 않는다 */
const FILE_URL = /\.(pdf|hwp|hwpx|xlsx?|docx?|pptx?|zip|hwt|jpg|jpeg|png|gif)(\?|$)/i;
/**
 * 내려받기 경로. 확장자가 없어 주소만 봐서는 첨부파일인지 모르는 것들이다.
 * 실측으로 만난 것만 넣는다 — 넓게 잡으면 멀쩡한 안내 페이지까지 막는다.
 *   fileDown.do · FlDownload.laf · Download.do · file/down.do · DownloadBoardFile.jsp
 */
const DOWNLOAD_PATH = /file_?down|fldownload|filedownload|down(?:load)?\.do|download[a-z]*file|boardfile|\/dwld/i;

/**
 * 기관 포털이 본문을 담는 자리 — 먼저 오는 것이 우선.
 * 실측으로 확인한 것만 넣는다(서울시 보육포털·찾기쉬운 생활법령정보 모두 `#contents`).
 */
const PAGE_CONTAINERS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /<div[^>]*id=["']contents["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*id=["']content["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bboard_view\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bview_cont\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bsub_content\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bcont_area\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<div[^>]*class=["'][^"']*\bcontents\b[^"']*["'][^>]*>/i, tag: 'div' },
  { pattern: /<main\b[^>]*>/i, tag: 'main' },
];

/**
 * 포털 껍데기에만 나오는 말. 본문이 아니라 메뉴·안내 문구다.
 * 실측: "본문바로가기 주메뉴바로가기 좌측 하위메뉴바로가기 로그인 …",
 *       "자바스크립트가 지원되지 않아 일부 기능이 제한됩니다".
 */
const SHELL_PHRASES = [
  /본문\s*바로\s*가기/g, /주메뉴\s*바로\s*가기/g, /좌측\s*하위메뉴\s*바로\s*가기/g,
  /(?:콘텐츠|메뉴)\s*바로\s*가기/g,
  /자바스크립트[^.]{0,40}(?:지원[^.]{0,30}|사용할 수 없습니다)/g,
  /화면내\s*검색/g, /현재위치\s*및\s*공유하기/g,
  /(?:페이스북|트위터|카카오|밴드)\s*공유/g,
  /인쇄하기|목록으로|이전\s*글|다음\s*글|만족도\s*조사/g,
];

function stripShell(text: string): string {
  let out = String(text || '');
  for (const pattern of SHELL_PHRASES) out = out.replace(pattern, ' ');
  return out.replace(/\s{2,}/g, ' ').trim();
}

/** 주소만 보고 내려받기 링크인지 — 요청을 아끼려는 1차 관문이다 */
export function looksLikeFileUrl(url: string): boolean {
  const value = String(url || '');
  return FILE_URL.test(value) || DOWNLOAD_PATH.test(value);
}

/**
 * 기관 페이지 HTML 에서 본문을 뽑는다.
 *
 * 후보를 전부 모아 **가장 긴 것**을 고른다. 기사와 달리 기관 페이지는 컨테이너가
 * 중첩돼 있어(`#contents` 안에 `.content`) 우선순위만으로는 안쪽 토막을 집는다.
 * 쓸 만한 분량이 안 나오면 null — 호출부는 스니펫을 그대로 쓴다.
 */
export function extractOfficialPageBody(
  html: string,
  maxChars: number = DEFAULT_MAX_PAGE_CHARS,
): { text: string; rawLength: number } | null {
  const source = String(html || '');
  if (source.length < 200) return null;

  const cleaned = source
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(nav|header|footer|aside|form|select)\b[\s\S]*?<\/\1>/gi, ' ');

  let best = '';
  for (const { pattern, tag } of PAGE_CONTAINERS) {
    const inner = extractBalancedBlock(cleaned, pattern, tag);
    if (!inner) continue;
    const text = stripShell(toPlainText(inner));
    if (text.length > best.length) best = text;
  }

  if (best.length < MIN_ACCEPTABLE_CHARS) return null;
  return { text: best.slice(0, Math.max(1, maxChars)), rawLength: best.length };
}

/**
 * 주소를 따라가 본문을 가져온다. **어떤 경우에도 던지지 않는다.**
 *
 * 한 번만 받아 와서 추출기를 둘 다 시도한다 —
 *   ① 기사 추출기(`extractArticleBody`) — 언론사에서 검증된 것
 *   ② 기관 페이지 추출기(위) — 고시·안내문용
 * 뉴스든 기관이든 같은 함수로 부를 수 있어야 호출부가 단순해진다.
 * 둘 다 실패하면 null 이고, 호출부는 스니펫을 그대로 쓴다.
 *
 * Content-Type 을 보는 이유는 위 머리말에 적었다 — 확장자 없는 내려받기 주소가 있다.
 */
export async function fetchPageBody(
  url: string,
  maxChars: number = DEFAULT_MAX_PAGE_CHARS,
  timeoutMs = 8000,
): Promise<string | null> {
  const target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) return null;
  if (looksLikeFileUrl(target)) return null;

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    if (!/text\/html/i.test(String(response.headers.get('content-type') || ''))) return null;

    const html = await response.text();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractArticleBody } = require('./article-body');
    const article = extractArticleBody(html, maxChars);
    if (article?.text) return article.text;

    const page = extractOfficialPageBody(html, maxChars);
    return page ? page.text : null;
  } catch {
    return null;
  }
}
