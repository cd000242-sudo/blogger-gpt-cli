/**
 * share-url — 공유 버튼의 주소를 실제 글 주소(canonical)로 갈아끼운다.
 *
 * ## 왜 치환이 필요한가
 * 본문을 만드는 시점에는 글 주소를 알 수 없다. 그래서 블로그 홈 주소를 기본값으로
 * 넣어두고, 발행 직후 실제 주소가 나오면 바꿔치기한다.
 * (onclick 으로 주입하던 방식은 Blogger 가 인라인 핸들러를 지워버려 실패했다.)
 *
 * ## 왜 공용 모듈인가
 * 예전에는 이 치환이 blogger-publisher 안에만 있었다. 그래서 워드프레스·티스토리로
 * 발행한 글은 공유 버튼이 **영원히 블로그 홈**을 가리켰다. 독자가 공유해도 그 글이
 * 아니라 홈이 퍼진다. 퍼블리셔마다 따로 짜면 또 어긋나므로 한 곳에 둔다.
 */

/** 공유 버튼만 골라낸다 — 본문 링크에 url= 이 들어 있어도 건드리지 않게 */
const SHARE_LINK_URL_PARAM = /(<a\b[^>]*\bdata-orbit-share="1"[^>]*\bhref="[^"]*?[?&](?:url|u)=)([^"&]*)/gi;

/**
 * 공유 버튼의 url/u 파라미터를 canonical 주소로 바꾼다.
 *
 * 주소가 없거나 http(s) 가 아니면 원본을 그대로 돌려준다 —
 * 잘못된 값으로 덮어써서 링크를 죽이느니 홈 주소라도 살아있는 편이 낫다.
 */
export function applyShareUrl(html: string, canonicalUrl: string): string {
  try {
    const source = String(html || '');
    const url = String(canonicalUrl || '').trim();
    if (!source || !/^https?:\/\//i.test(url)) return source;
    if (!source.includes('data-orbit-share')) return source;

    const encoded = encodeURIComponent(url);
    return source.replace(SHARE_LINK_URL_PARAM, (_m, prefix: string) => `${prefix}${encoded}`);
  } catch {
    return String(html || '');
  }
}

/** 치환할 게 있는지 미리 본다 — 바뀐 게 없으면 재발행 호출을 아낀다 */
export function needsShareUrlPatch(html: string, canonicalUrl: string): boolean {
  const patched = applyShareUrl(html, canonicalUrl);
  return patched !== String(html || '');
}
