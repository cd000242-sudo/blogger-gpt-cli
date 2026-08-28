// src/cta/cta-audit.ts
/**
 * 발행된 글의 CTA 를 다시 본다 — 링크는 썩는다. (v3.8.572)
 *
 * ## 왜 필요한가
 * 생성 시점에 아무리 잘 골라도 링크는 나중에 죽는다. 2026-08-28 leadernam.com 실측:
 *   · CTA 주소 366개 중 **31개가 죽어 있었다** (404·500·DNS 실패·200 에러페이지)
 *   · 워크넷(work.go.kr)은 고용24 로 통합되면서 통째로 404 가 됐다
 *   · `example.com/section1` 같은 **자리표시자가 그대로 나간 글**도 있었다
 *   · 발행 글의 **61% 가 기관 홈으로만** 간다 — 독자에게 "다시 찾아라"는 말이다
 *
 * 발행 직전 게이트(destination-gate)는 그때 한 번만 본다. 이 모듈은 **나간 뒤에** 다시 본다.
 *
 * ## AI 를 부르지 않는다
 * 페이지를 받아 분류만 한다. 비용 0원, 결과가 항상 같아 테스트가 된다.
 */
import { looksLikeErrorPage, isDocumentUrl } from './destination-gate';
import { looksLikeHomeUrl } from './action-link-harness';

/** CTA 주소 한 개의 상태 */
export type CtaLinkVerdict =
  /** 눌러도 아무 데도 못 간다 — 가장 급하다 */
  | 'dead'
  /** 읽을 수는 있어도 그 자리에서 할 수는 없다 */
  | 'document'
  /** 살아는 있는데 기관 홈 — "다시 찾아라"가 된다 */
  | 'home'
  /** 그 일을 할 수 있는 화면 */
  | 'action'
  /** 페이지를 못 읽어 판정 못 함 (죽었다고 단정하지 않는다) */
  | 'unknown';

export type CtaLinkCheck = {
  url: string;
  verdict: CtaLinkVerdict;
  reason: string;
};

/** 우리 글끼리의 링크·SNS 공유 버튼은 CTA 가 아니다 — 세면 숫자가 거짓말이 된다 */
const NOT_CTA =
  /story\.kakao\.com|share\.naver\.com|twitter\.com\/intent|facebook\.com\/sharer|pinterest\.com\/pin|line\.me\/R/i;

export function isCtaCandidate(url: string, ownHost: string): boolean {
  const value = String(url || '').trim();
  if (!/^https?:\/\//i.test(value)) return false;
  if (NOT_CTA.test(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    const own = String(ownHost || '').toLowerCase().replace(/^www\./, '');
    return !own || !host.replace(/^www\./, '').endsWith(own);
  } catch {
    return false;
  }
}

/** 글 HTML 에서 바깥으로 나가는 링크만 뽑는다 */
export function extractCtaUrls(html: string, ownHost: string): string[] {
  const found = String(html || '').matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/gi);
  const urls = Array.from(found, (m) => m[1] as string).filter((u) => isCtaCandidate(u, ownHost));
  return Array.from(new Set(urls));
}

export type FetchedPage = {
  /** 요청이 끝까지 갔는가 (네트워크 실패면 false) */
  ok: boolean;
  status: number;
  html: string;
  title?: string;
  /** 리다이렉트를 따라간 최종 주소 */
  finalUrl?: string;
  /**
   * 못 받았을 때의 이유 (node 의 error.cause.code 등).
   * **이게 없으면 죽었는지 아닌지 구분할 수 없다** — 아래 isNameNotFound 주석 참고.
   */
  errorCode?: string;
};

/**
 * 정말 사라진 도메인인가.
 *
 * ⚠️ 이 구분이 이 모듈의 정확도를 결정한다. 실측(2026-08-28)에서 확인한 것:
 *
 *   efine.go.kr        브라우저 200 "경찰청교통민원24"  · node fetch failed
 *   fill4young.kinfa   브라우저 200 "서민금융진흥원"    · node UNABLE_TO_VERIFY_LEAF_SIGNATURE
 *   lovevill.kr        브라우저 실패                   · node ENOTFOUND        ← 진짜 죽음
 *
 * 한국 관공서 사이트는 인증서 체인이 불완전하거나 node 가 안 쓰는 암호군을 쓰는 곳이 많다.
 * 브라우저에서는 멀쩡히 열린다. 그래서 **이름을 못 찾은 경우(DNS)만** 죽음으로 본다.
 * 나머지 네트워크 오류는 'unknown' — 사람이 눈으로 볼 일이지, 고치라고 할 일이 아니다.
 */
export function isNameNotFound(code?: string): boolean {
  return /ENOTFOUND|EAI_AGAIN|ERR_NAME_NOT_RESOLVED|getaddrinfo/i.test(String(code || ''));
}

function textOf(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOf(html: string): string {
  const m = String(html || '').match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  return String(m?.[1] || '').replace(/\s+/g, ' ').trim();
}

/**
 * 주소 하나를 분류한다.
 *
 * ⚠️ 순서가 중요하다. 에러 페이지에도 기관 이름과 메뉴가 있어서 홈 판정보다 먼저 물어야 한다
 *    (실측: fss.or.kr 에러 페이지가 HTTP 200 에 제목까지 멀쩡했다).
 */
export function classifyCtaLink(url: string, page: FetchedPage | null): CtaLinkCheck {
  if (isDocumentUrl(url)) {
    return { url, verdict: 'document', reason: '문서 파일 — 읽을 수는 있어도 그 자리에서 할 수 없다' };
  }
  if (!page || !page.ok) {
    // 이름을 못 찾았다 = 도메인이 사라졌다. 이것만 확실한 죽음이다.
    if (isNameNotFound(page?.errorCode)) {
      return { url, verdict: 'dead', reason: '도메인이 사라졌습니다 (DNS 조회 실패)' };
    }
    return {
      url,
      verdict: 'unknown',
      reason: `받아오지 못함 (${page?.errorCode || '원인 불명'}) — 브라우저에서는 열릴 수 있습니다`,
    };
  }
  if (page.status >= 400) {
    return { url, verdict: 'dead', reason: `HTTP ${page.status}` };
  }

  const title = page.title || titleOf(page.html);
  const text = textOf(page.html);

  if (looksLikeErrorPage(title, text)) {
    return { url, verdict: 'dead', reason: `HTTP ${page.status} 인데 "없는 페이지" 화면 (${title.slice(0, 30)})` };
  }
  // 본문을 못 읽었다(스크립트로 그리는 화면) — 죽었다고 단정하지 않는다
  if (!text || text.length < 200) {
    return { url, verdict: 'unknown', reason: '본문을 못 읽음 — 눈으로 확인 필요' };
  }
  if (looksLikeHomeUrl(page.finalUrl || url)) {
    return { url, verdict: 'home', reason: '기관 홈 — 독자가 거기서 다시 찾아야 한다' };
  }
  return { url, verdict: 'action', reason: '행동 화면' };
}

export type PostCtaReport = {
  postId: number | string;
  title: string;
  link: string;
  checks: CtaLinkCheck[];
  /** 이 글에서 가장 급한 상태 — 목록을 정렬할 때 쓴다 */
  worst: CtaLinkVerdict | 'none';
};

/** 급한 순서 — 죽은 링크가 홈보다 급하고, 홈이 없는 것보다 급하다 */
const SEVERITY: Record<string, number> = { dead: 0, document: 1, none: 2, home: 3, unknown: 4, action: 5 };

export function summarizePost(input: {
  postId: number | string; title: string; link: string; checks: CtaLinkCheck[];
}): PostCtaReport {
  const worst: CtaLinkVerdict | 'none' = input.checks.length
    ? input.checks.map((c) => c.verdict).sort((a, b) => (SEVERITY[a] ?? 9) - (SEVERITY[b] ?? 9))[0] || 'unknown'
    : 'none';
  return { ...input, worst };
}

export type CtaAuditSummary = {
  posts: number;
  links: number;
  dead: number;
  document: number;
  home: number;
  action: number;
  unknown: number;
  noCta: number;
};

export function summarizeAudit(reports: PostCtaReport[]): CtaAuditSummary {
  const s: CtaAuditSummary = { posts: reports.length, links: 0, dead: 0, document: 0, home: 0, action: 0, unknown: 0, noCta: 0 };
  for (const r of reports) {
    if (!r.checks.length) { s.noCta += 1; continue; }
    for (const c of r.checks) {
      s.links += 1;
      if (c.verdict === 'dead') s.dead += 1;
      else if (c.verdict === 'document') s.document += 1;
      else if (c.verdict === 'home') s.home += 1;
      else if (c.verdict === 'action') s.action += 1;
      else s.unknown += 1;
    }
  }
  return s;
}

/** 사람이 읽는 한 줄 요약 — 로그·알림에 그대로 쓴다 */
export function describeAudit(s: CtaAuditSummary): string {
  const pct = (n: number) => (s.links ? Math.round((n / s.links) * 100) : 0);
  return `글 ${s.posts}편 · CTA ${s.links}개 — 죽음 ${s.dead}(${pct(s.dead)}%) · 홈 ${s.home}(${pct(s.home)}%) · `
    + `행동화면 ${s.action}(${pct(s.action)}%) · 문서 ${s.document} · 미확인 ${s.unknown} · CTA 없는 글 ${s.noCta}편`;
}
