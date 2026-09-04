/**
 * 📰 스크립트 안에 숨은 기사 본문 꺼내기 (v3.8.627)
 *
 * ## 왜 만들었나
 * 사장님이 조선일보 기사 주소로 글을 뽑았더니 "개판"이 나왔다. 재현해 보니
 * 원인은 모델이 아니라 재료였다 — 실측 2026-09-04:
 *
 *   deepCrawlUrl("https://www.chosun.com/.../GXQUNOCVCRGF3PNYSO5QH6DDVE/")
 *     → 제목 "티빙, 3954만 계정 개인정보 유출… 비번 등 싹 털렸다"
 *     → **본문 0자**
 *
 * 제목 한 줄만 들고 2천 자를 쓰라고 시킨 셈이다. 그러니 지어낼 수밖에 없다.
 * 더 나쁜 건 로그가 `✅ 크롤링 완료` 였다는 것이다 — 실패가 성공으로 찍혔다.
 *
 * ## 왜 0자가 나왔나
 * 조선일보는 Arc Publishing(Fusion) 을 쓴다. HTML 에는 제목만 있고 본문은
 * `<script>Fusion.globalContent={...}</script>` 안 JSON 에 들어 있다.
 * 그런데 deepCrawlUrl 은 추출 전에 `$('script, ...').remove()` 로 스크립트를
 * 통째로 지운다. 본문이 담긴 상자를 열기 전에 버린 것이다.
 *
 * 실측: 같은 페이지에서 태그를 걷어낸 평문은 32자(제목뿐),
 *       Fusion JSON 안에는 문단 9개 · 2,019자가 그대로 있었다.
 *
 * ## 그래서 무엇을 하나
 * 스크립트를 지우기 **전에**, 원문 HTML 에서 세 갈래로 본문을 찾는다.
 * 셋 다 실제로 쓰이는 방식이고, 하나라도 걸리면 재료가 살아난다.
 *
 *   1) Fusion.globalContent      — Arc Publishing (조선일보 등)
 *   2) JSON-LD 의 articleBody    — 표준 구조화 데이터
 *   3) __NEXT_DATA__             — Next.js 로 만든 매체
 *
 * 못 찾으면 조용히 빈 값을 돌려준다. 이 파일은 "덧붙이는" 수집기이지,
 * 기존 HTML 추출을 대신하지 않는다.
 */

/** 이 정도는 나와야 본문으로 본다 — 요약·부제만 걸린 것과 구분한다. */
const MIN_BODY_CHARS = 200;

/** 한 기사에서 가져올 최대 글자수 — 기존 크롤 예산과 맞춘다. */
export const EMBEDDED_BODY_MAX_CHARS = 10000;

export interface EmbeddedArticle {
  /** 본문 평문. 못 찾았으면 빈 문자열. */
  content: string;
  /** 제목. 못 찾았으면 빈 문자열. */
  title: string;
  /** 어느 갈래에서 나왔는지 — 로그와 테스트가 읽는다. */
  source: 'fusion' | 'ld-json' | 'next-data' | 'none';
}

const EMPTY: EmbeddedArticle = { content: '', title: '', source: 'none' };

/** HTML 조각을 평문으로. 문단 사이는 줄바꿈으로 남긴다. */
function toPlain(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * `시작문자열` 뒤부터 균형 잡힌 JSON 객체 하나를 떼어 온다.
 * 문자열 안의 중괄호와 이스케이프를 세지 않으면 본문에 `{` 가 하나만 있어도 어긋난다.
 */
function balancedJsonAfter(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at === -1) return '';
  const open = source.indexOf('{', at);
  if (open === -1) return '';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return '';
}

/** 어떤 모양이든 문자열 하나로 만든다 (headlines 는 객체, 문자열 둘 다 온다). */
function firstString(...candidates: any[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** 1) Arc Publishing (Fusion) — content_elements 의 text 조각을 잇는다. */
function fromFusion(html: string): EmbeddedArticle {
  const raw = balancedJsonAfter(html, 'Fusion.globalContent');
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw);
    const elements = Array.isArray(data?.content_elements) ? data.content_elements : [];
    const content = toPlain(
      elements
        .filter((e: any) => e && (e.type === 'text' || e.type === 'raw_html') && typeof e.content === 'string')
        .map((e: any) => e.content)
        .join('\n')
    );
    if (content.length < MIN_BODY_CHARS) return EMPTY;
    const title = firstString(data?.headlines?.basic, data?.headlines?.meta_title, data?.title);
    return { content: content.slice(0, EMBEDDED_BODY_MAX_CHARS), title, source: 'fusion' };
  } catch {
    return EMPTY; // 깨진 JSON 은 그냥 없는 것으로 친다
  }
}

/** 2) JSON-LD 의 articleBody — 표준을 지키는 매체는 여기에 본문을 그대로 넣는다. */
function fromJsonLd(html: string): EmbeddedArticle {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    try {
      const parsed = JSON.parse(body);
      const nodes = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
      for (const node of nodes) {
        const content = toPlain(firstString(node?.articleBody));
        if (content.length >= MIN_BODY_CHARS) {
          return {
            content: content.slice(0, EMBEDDED_BODY_MAX_CHARS),
            title: firstString(node?.headline, node?.name),
            source: 'ld-json',
          };
        }
      }
    } catch {
      // 이 블록만 건너뛴다 — 다른 블록에 있을 수 있다
    }
  }
  return EMPTY;
}

/** 3) Next.js — __NEXT_DATA__ 어딘가에 본문 문자열이 들어 있다. 가장 긴 것을 고른다. */
function fromNextData(html: string): EmbeddedArticle {
  const raw = balancedJsonAfter(html, '__NEXT_DATA__');
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw);
    let best = '';
    let title = '';
    const BODY_KEYS = /^(articleBody|body|content|contentHtml|text|articleContent)$/i;
    const TITLE_KEYS = /^(title|headline|subject)$/i;

    const walk = (node: any, depth: number): void => {
      if (!node || depth > 8) return;
      if (Array.isArray(node)) { for (const v of node) walk(v, depth + 1); return; }
      if (typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (typeof value === 'string') {
          if (BODY_KEYS.test(key)) {
            const plain = toPlain(value);
            if (plain.length > best.length) best = plain;
          } else if (TITLE_KEYS.test(key) && !title && value.trim().length > 5 && value.length < 200) {
            title = value.trim();
          }
        } else {
          walk(value, depth + 1);
        }
      }
    };
    walk(data, 0);

    if (best.length < MIN_BODY_CHARS) return EMPTY;
    return { content: best.slice(0, EMBEDDED_BODY_MAX_CHARS), title, source: 'next-data' };
  } catch {
    return EMPTY;
  }
}

/**
 * 원문 HTML 에서 스크립트 안에 숨은 기사 본문을 꺼낸다.
 *
 * ⚠️ **스크립트를 지우기 전에** 불러야 한다. cheerio 로 script 를 remove 한 뒤에
 *    부르면 찾을 것이 남아 있지 않다 — 이 버그가 정확히 그것이었다.
 */
export function extractEmbeddedArticle(html: string): EmbeddedArticle {
  if (!html || html.length < 100) return EMPTY;
  for (const attempt of [fromFusion, fromJsonLd, fromNextData]) {
    const found = attempt(html);
    if (found.content) return found;
  }
  return EMPTY;
}

/**
 * 📅 기사 작성일 꺼내기 (v3.8.633)
 *
 * ## 왜 여기인가
 * 본문과 **같은 이유**로 날짜도 사라진다. deepCrawlUrl 은 `<script>` 를 지운 뒤에
 * 날짜를 찾으므로 JSON-LD 의 `datePublished` 에는 닿지 못하고, 남은 건
 * `article:published_time` 과 `<time datetime>` 두 갈래뿐이다.
 *
 * 날짜를 못 읽으면 v3.8.633 의 URL 모드 경고("이 글은 위 날짜의 일을 다룹니다")가
 * **조용히 안 붙는다.** 그러면 사고를 낸 바로 그 조선일보 기사에서 고친 게
 * 아무 일도 안 하는 셈이 된다 — 고쳤다고 믿는데 동작하지 않는 상태다.
 *
 * 그래서 스크립트를 지우기 전에, 원문 HTML 에서 넓게 찾는다.
 * 못 찾으면 빈 문자열 — 없는 날짜를 지어내지 않는다.
 */
const DATE_META_KEYS = [
  'article:published_time',
  'og:article:published_time',
  'datepublished',
  'sailthru.date',
  'dc.date.issued',
  'dc.date',
  'pubdate',
  'date',
];

export function extractPublishDate(html: string): string {
  const source = String(html || '');
  if (!source) return '';

  const ok = (value: string): string =>
    Number.isFinite(Date.parse(value.trim())) ? value.trim() : '';

  // ① JSON-LD·Fusion JSON 안의 datePublished — 스크립트를 지우면 사라지는 갈래
  const jsonMatch = source.match(/"datePublished"\s*:\s*"([^"]{4,40})"/i);
  if (jsonMatch?.[1]) {
    const found = ok(jsonMatch[1]);
    if (found) return found;
  }

  // ② meta 태그 — 속성 순서가 매체마다 달라 통째로 훑는다
  const metas = source.match(/<meta\b[^>]*>/gi) || [];
  for (const key of DATE_META_KEYS) {
    for (const tag of metas) {
      const nameMatch = tag.match(/(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i);
      if (nameMatch?.[1]?.trim().toLowerCase() !== key) continue;
      const contentMatch = tag.match(/content\s*=\s*["']([^"']+)["']/i);
      const found = ok(contentMatch?.[1] || '');
      if (found) return found;
    }
  }

  // ③ <time datetime="..."> — 스크립트 제거 후에도 남지만 여기서 같이 본다
  const timeMatch = source.match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']+)["']/i);
  return ok(timeMatch?.[1] || '');
}
