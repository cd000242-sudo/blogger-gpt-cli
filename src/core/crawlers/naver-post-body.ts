/**
 * 📰 네이버 블로그 본문 추출기 (v3.8.473)
 *
 * ## 왜 만들었나
 * content-crawler 의 네이버 본문 추출은 두 개의 선택자만 봤다:
 *   · `class="...post-content..."`  — 네이버가 쓰지 않는 이름
 *   · `id="postViewArea"`           — 구버전 SE2 에디터 전용
 * 현재 네이버는 스마트에디터 ONE 이라 본문이 `se-main-container` 에 들어간다.
 *
 * 실측 2026-08-11 — 라이브 글 3건 전부:
 *   페이지 평문 29,681~33,081자 · se-main-container 존재 · **추출 0자**
 * 그래서 `content.length < 100` 으로 항상 null 이 됐고, 호출부는 검색 API 의
 * description(150~200자) 으로 폴백했다. 소스 10개를 모아도 재료가 4KB 뿐이라
 * 글에 쓸 수치·조건·절차가 아예 없었다 — "뜬구름 잡는 글" 의 원인이다.
 *
 * ## 두 번째 결함: 비탐욕 매칭
 * 기존 정규식은 `([\s\S]*?)</div>` 였다. 본문 div 안에는 div 가 수십 개 중첩돼
 * 있으므로 **첫 번째 닫는 태그**에서 끊긴다. 선택자를 고쳐도 이걸 같이 고치지
 * 않으면 몇백 자만 건진다. 여는/닫는 div 를 세어 짝이 맞는 곳까지 잘라낸다.
 */

/**
 * 한 편에서 가져올 최대 글자수.
 *
 * v3.8.474 — 2,000 → 1,200 으로 내린다. 사용자 요구가 "비용은 최소" 이고,
 * 앞으로 구글·다음·공식문서까지 같은 예산(generation.ts 의 12,000자) 안에
 * 넣어야 한다. 블로그 한 편의 앞 1,200자면 수치·조건·절차는 대부분 나온다 —
 * 그 뒤는 맺음말·해시태그·이웃 인사라 토큰만 먹는다.
 * 5편 × 1,200자 = 6,000자로, 팩트체크(약 2,270자)를 더해도 상한 아래다.
 */
export const DEFAULT_MAX_BODY_CHARS = 1200;

/**
 * 이 정도는 나와야 "본문을 찾았다" 고 본다 (사이드바·댓글 영역과 구분).
 * 호출부(content-crawler)가 쓰던 100자 기준과 맞춰 잡는다 — 더 높이면 짧은 글이
 * 통째로 버려지고, 더 낮추면 네비게이션 조각을 본문으로 오인한다.
 */
const MIN_ACCEPTABLE_CHARS = 120;

/**
 * 본문이 담기는 컨테이너 — **먼저 오는 것이 우선**이다.
 * 위 두 개가 현재 네이버(스마트에디터 ONE / PostView), 아래는 구버전·타 플랫폼 잔재.
 */
const BODY_CONTAINERS: RegExp[] = [
  /<div[^>]*class=["'][^"']*\bse-main-container\b[^"']*["'][^>]*>/i,
  /<div[^>]*id=["']post-area["'][^>]*>/i,
  /<div[^>]*id=["']postViewArea["'][^>]*>/i,
  /<div[^>]*class=["'][^"']*\bse_component_wrap\b[^"']*["'][^>]*>/i,
  /<div[^>]*class=["'][^"']*\bpost_ct\b[^"']*["'][^>]*>/i,
  /<div[^>]*class=["'][^"']*\bpost-content\b[^"']*["'][^>]*>/i,
];

/**
 * 여는 태그가 매치된 지점부터 **짝이 맞는 닫는 태그**까지의 안쪽 HTML 을 돌려준다.
 * 닫는 태그를 못 찾으면(잘린 HTML) 문서 끝까지 준다 — 없는 것보다 낫다.
 */
export function extractBalancedDiv(html: string, openTagPattern: RegExp): string | null {
  const source = String(html || '');
  const opener = new RegExp(openTagPattern.source, openTagPattern.flags.replace(/g/g, ''));
  const found = opener.exec(source);
  if (!found) return null;

  const start = found.index + found[0].length;
  const scanner = /<div\b[^>]*>|<\/div\s*>/gi;
  scanner.lastIndex = start;

  let depth = 1;
  let token: RegExpExecArray | null;
  while ((token = scanner.exec(source)) !== null) {
    if (token[0][1] === '/') {
      depth -= 1;
      if (depth === 0) return source.slice(start, token.index);
    } else {
      depth += 1;
    }
  }
  return source.slice(start);
}

/** 본문에 섞여 들어오면 안 되는 것들 — 태그를 지우기 전에 통째로 걷어낸다 */
function stripNoise(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/** 사람이 읽는 글자만 남긴다. 문단 경계는 공백으로 살린다. */
function toPlainText(html: string): string {
  return stripNoise(html)
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' \n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export interface NaverPostBody {
  /** 평문 본문 (maxChars 로 자른 뒤) */
  text: string;
  /** 어떤 컨테이너에서 찾았는지 — 진단용 */
  container: string;
  /** 자르기 전 원래 길이 */
  rawLength: number;
}

/**
 * 네이버 블로그 HTML 에서 본문을 뽑는다.
 * 어느 컨테이너에서도 쓸 만한 분량이 안 나오면 null — 호출부는 기존대로
 * 검색 API description 으로 폴백한다(동작 후퇴 없음).
 */
export function extractNaverPostBody(
  html: string,
  maxChars: number = DEFAULT_MAX_BODY_CHARS,
): NaverPostBody | null {
  const source = String(html || '');
  if (source.length < 100) return null;

  let best: NaverPostBody | null = null;

  for (const pattern of BODY_CONTAINERS) {
    const inner = extractBalancedDiv(source, pattern);
    if (!inner) continue;

    const text = toPlainText(inner);
    if (text.length < MIN_ACCEPTABLE_CHARS) {
      // 짧아도 지금까지 중 제일 긴 후보라면 들고 간다 (전부 짧으면 아래에서 탈락한다)
      if (!best || text.length > best.rawLength) {
        best = { text, container: String(pattern), rawLength: text.length };
      }
      continue;
    }
    // 우선순위가 높은 컨테이너에서 충분히 나왔으면 더 볼 것 없다
    return {
      text: text.slice(0, Math.max(1, maxChars)),
      container: String(pattern),
      rawLength: text.length,
    };
  }

  if (!best || best.rawLength < MIN_ACCEPTABLE_CHARS) return null;
  return { ...best, text: best.text.slice(0, Math.max(1, maxChars)) };
}
