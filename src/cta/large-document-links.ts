/**
 * 🗂️ large-document-links — 글 HTML 에서 **큰 문서(10MB 초과) 내려받기 링크**의 링크만 뗀다(글자는 남긴다).
 *
 * 에이전트 모드(Codex·Claude CLI)는 CTA 주소를 에이전트가 직접 고르고, API 경로의 주소 검사(validateCtaUrl)를 거치지 않는다.
 * 실측: 청년 월세지원 글 CTA 가 37MB PDF(easylaw FlDownload.laf)였다. 에이전트 결과 후처리에서 이걸로 걸러 낸다.
 *
 * - 파일처럼 보이는 주소(.pdf·.hwp·내려받기 경로)만 확인한다 — 보통 페이지마다 요청을 보내지 않는다.
 * - 확인이 실패하거나 크기를 모르면 그대로 둔다(못 본 것으로 떼지 않는다).
 * - 자기 사이트 링크는 묻지 않는다(광고 달린 사장님 사이트에 요청을 보내지 않는다).
 */

const ANCHOR = /<a\b([^>]*?)\bhref\s*=\s*(["'])(https?:[^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi;
const OWN_SITE = /^https?:\/\/(?:[a-z0-9-]+\.)*leadernam\.com(?:[/?#:]|$)/i;
/** 한 글에서 확인할 최대 주소 수 — 글 하나에 요청을 쏟아붓지 않게 */
const MAX_CHECKS = 6;

type Validate = (url: string) => Promise<{ isValid: boolean; reason?: string | undefined }>;

const decodeHref = (s: string): string => s.replace(/&amp;/g, '&');

function looksLikeFile(url: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (require('./destination-gate').isDocumentUrl(url)) return true;
  } catch { /* 아래로 */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return !!require('../core/crawlers/official-page-body').looksLikeFileUrl(url);
  } catch { return false; }
}

export async function dropLargeDocumentLinks(html: string, options: { validate?: Validate } = {}): Promise<{ html: string; removed: string[] }> {
  const source = String(html || '');
  const validate: Validate = options.validate
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    || ((u) => require('./validate-cta-url').validateCtaUrl(u, { timeout: 5000 }));

  const candidates: string[] = [];
  for (const m of source.matchAll(ANCHOR)) {
    const url = decodeHref(m[3] || '');
    if (!url || OWN_SITE.test(url) || candidates.includes(url) || !looksLikeFile(url)) continue;
    candidates.push(url);
    if (candidates.length >= MAX_CHECKS) break;
  }
  if (candidates.length === 0) return { html: source, removed: [] };

  const tooLarge = new Set<string>();
  await Promise.all(candidates.map(async (url) => {
    try {
      const r = await validate(url);
      if (r && r.reason === 'document-too-large') tooLarge.add(url);
    } catch { /* 확인 실패 — 그대로 둔다 */ }
  }));
  if (tooLarge.size === 0) return { html: source, removed: [] };

  const out = source.replace(ANCHOR, (whole, _pre, _q, href, _post, inner) => (tooLarge.has(decodeHref(href)) ? inner : whole));
  return { html: out, removed: [...tooLarge] };
}
