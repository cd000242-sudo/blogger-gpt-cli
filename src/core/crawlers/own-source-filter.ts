/**
 * 🔁 자기가 쓴 글을 다시 재료로 읽지 않는다 (v3.8.481)
 *
 * ## 잡으려는 되먹임
 * 실측 2026-08-11 — 사고를 낸 키워드로 최신순 검색을 하니 1위가 이랬다:
 *   `2026-08-11  부산 청년 게임개발자 정착지원, 소득 무관 월 25만원 받는 조건…`
 * 그런데 "소득 무관" 은 팩트체크에서 **2024년 표현**이라고 지적된 바로 그 문구다.
 * 즉 이 도구로 쓴 (틀린) 글이 다음 글의 근거가 되는 구조가 된다.
 *
 * v3.8.480 으로 최신순을 섞으면서 이 위험이 오히려 커졌다 — 방금 쓴 글이
 * 최신순 1위로 들어오기 때문이다. 틀린 정보가 스스로를 강화한다.
 *
 * ## 무엇을 하는가
 * 발행 대상으로 설정된 곳의 글은 재료에서 뺀다.
 *   · 워드프레스: WORDPRESS_SITE_URL 에서 자동으로 도메인을 얻는다
 *   · 그 외(블로그스팟·티스토리·네이버 블로그): EXCLUDE_SOURCE_DOMAINS 에
 *     쉼표로 적어 두면 함께 제외한다 (예: `myblog.tistory.com,blog.naver.com/myid`)
 *
 * 설정이 없으면 아무것도 거르지 않는다 — 지금까지의 동작과 같다.
 */

/** URL 에서 호스트만 (소문자, www/m 접두 제거) */
function hostOf(url: string): string {
  const raw = (String(url || '').match(/^https?:\/\/([^/?#]+)/i) || [])[1] || '';
  return raw.toLowerCase().replace(/:\d+$/, '').replace(/^(?:www|m)\./, '');
}

/**
 * 설정에서 "내 것" 목록을 만든다.
 * 도메인(example.com)과 경로형(blog.naver.com/myid) 둘 다 받는다 —
 * 네이버·티스토리처럼 한 도메인을 여럿이 나눠 쓰는 곳이 있기 때문이다.
 */
export function collectOwnSources(env: Record<string, any> = {}): string[] {
  const out: string[] = [];

  const wp = hostOf(String(env['WORDPRESS_SITE_URL'] || env['wordpressSiteUrl'] || ''));
  if (wp) out.push(wp);

  const extra = String(env['EXCLUDE_SOURCE_DOMAINS'] || env['excludeSourceDomains'] || '');
  for (const piece of extra.split(',')) {
    const token = piece.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^(?:www|m)\./, '')
      .replace(/\/+$/, '');
    if (token) out.push(token);
  }

  return [...new Set(out)];
}

/** 이 주소가 "내가 쓴 글" 인가 */
export function isOwnSource(url: string, ownSources: string[]): boolean {
  const raw = String(url || '').toLowerCase();
  if (!raw || !Array.isArray(ownSources) || ownSources.length === 0) return false;

  const host = hostOf(raw);
  const pathPart = raw.replace(/^https?:\/\//, '').replace(/^(?:www|m)\./, '');

  return ownSources.some((own) => {
    if (!own) return false;
    // 경로까지 지정된 경우(blog.naver.com/myid) — 앞부분이 일치하면 내 것
    if (own.includes('/')) return pathPart.startsWith(own);
    // 도메인만 지정된 경우 — 같은 도메인이거나 하위 도메인
    return host === own || host.endsWith('.' + own);
  });
}

export interface OwnFilterResult<T> {
  kept: T[];
  removed: number;
}

/**
 * 크롤링 결과에서 내 글을 뺀다.
 * 설정이 없거나 걸리는 게 없으면 원본 그대로 — 동작이 나빠지지 않는다.
 */
export function filterOwnSources<T extends { url?: string }>(
  items: T[],
  ownSources: string[],
): OwnFilterResult<T> {
  const list = Array.isArray(items) ? items : [];
  if (ownSources.length === 0) return { kept: list, removed: 0 };

  const kept = list.filter((item) => !isOwnSource(String(item?.url || ''), ownSources));
  return { kept, removed: list.length - kept.length };
}
