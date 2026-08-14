/**
 * pretty-links — 워드프레스 Pretty Links 플러그인으로 단축링크를 만든다.
 *
 * ## 왜 필요한가
 * 퍼머링크가 /%category%/%postname%/ 이고 슬러그가 한글이라 주소가 평균 233자다.
 * 한글 1자가 %eb%b6%80 처럼 9자로 부풀기 때문이다. 카카오톡·인스타에 붙이면
 * 깨져 보이고, 사람이 봐서 무슨 글인지도 알 수 없다.
 *
 * ## 왜 외부 단축 서비스를 안 쓰나
 * bit.ly 같은 곳을 쓰면 링크의 주인이 그 회사가 된다. 서비스가 닫히면
 * 그동안 뿌린 링크가 전부 죽는다. 사장님은 도메인을 이미 갖고 계신다.
 *
 * ## 필드 이름은 실측으로 확인했다 (2026-08-14)
 * 플러그인이 POST 스키마를 공개하지 않아 GET /links 응답과 가져오기 샘플로 확인했다.
 * 추측으로 짜면 조용히 틀린다.
 */

export interface ShortLink {
  id: number;
  slug: string;
  url: string;
  name: string;
  prettyUrl: string;
  redirectType: string;
  clicks: number;
  uniques: number;
  createdAt: string;
}

export interface ShortLinkCreateOptions {
  /** 단축 주소 뒤에 붙는 부분. leadernam.com/go/<여기> */
  slug: string;
  /** 목적지 (긴 워드프레스 주소) */
  url: string;
  /** 목록에서 찾기 쉽게 붙이는 이름 */
  name?: string;
  /**
   * 307 이 기본이다. 301(영구)로 만들면 브라우저가 주소를 캐시해서
   * 나중에 목적지를 바꿔도 옛 곳으로 계속 간다 — 단축링크의 최대 장점을 스스로 버리는 셈.
   */
  redirectType?: '301' | '302' | '307';
  /** 제휴링크에 쓸 때. 구글은 제휴링크에 sponsored 를 요구한다. */
  nofollow?: boolean;
  sponsored?: boolean;
}

/** 응답을 우리 모양으로 (필드가 늘어나도 화면이 안 깨지게 여기서 한 번 걸러 쓴다) */
export function toShortLink(raw: any, siteUrl = ''): ShortLink {
  const slug = String(raw?.slug || '');
  return {
    id: Number(raw?.id || 0),
    slug,
    url: String(raw?.url || ''),
    name: String(raw?.name || ''),
    prettyUrl: String(raw?.pretty_url || (siteUrl ? `${siteUrl.replace(/\/+$/, '')}/${slug}` : '')),
    redirectType: String(raw?.redirect_type || '307'),
    clicks: Number(raw?.clicks || 0),
    uniques: Number(raw?.uniques || 0),
    createdAt: String(raw?.created_at || ''),
  };
}

/** Pretty Links 에 보낼 본문. 필드 이름은 실측 확인분만 쓴다. */
export function toCreateBody(options: ShortLinkCreateOptions): Record<string, any> {
  return {
    slug: normalizeSlug(options.slug),
    url: String(options.url || '').trim(),
    name: String(options.name || '').trim(),
    redirect_type: options.redirectType || '307',
    nofollow: options.nofollow ? 1 : 0,
    sponsored: options.sponsored ? 1 : 0,
    track_me: 1,          // 클릭 추적 — 어느 글이 유입을 만드는지 보려면 켜야 한다
    param_forwarding: 0,
    new_window: 0,
  };
}

/**
 * 단축 주소로 쓸 수 있게 다듬는다.
 *
 * 한글을 그대로 두면 %EC%B2%AD%EB%85%84 으로 부풀어 단축한 의미가 사라진다.
 * 그래서 영문·숫자·하이픈만 남긴다. 한글만 넣으면 빈 문자열이 되므로
 * 그때는 부르는 쪽이 자동 제안으로 채워야 한다.
 */
export function normalizeSlug(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** 사람이 알아볼 수 있는 슬러그인지 (플러그인 자동생성은 dzvl 같은 무작위 4글자를 준다) */
export function isMeaningfulSlug(slug: string): boolean {
  const s = normalizeSlug(slug);
  return s.length >= 4 && /[a-z]/.test(s);
}

/**
 * 제목에서 단축 주소용 영문 슬러그를 제안한다.
 *
 * AI 를 부르지 않는다 — 단축링크 하나 만들 때마다 돈이 나가면 안 되고,
 * 결과가 매번 달라지면 테스트도 못 한다. 이 사이트가 다루는 말은 정해져 있어
 * 사전으로 충분하다. 사전에 없으면 연도·숫자를 살려 넘긴다.
 */
const TERMS: Array<[RegExp, string]> = [
  [/실손|실비/, 'silson'],
  [/일상생활배상책임|일배책/, 'liability'],
  [/보험금|보험/, 'insurance'],
  [/지급\s*거절|거절/, 'denied'],
  [/이의신청|재심사/, 'appeal'],
  [/본인부담상한제/, 'copay-cap'],
  [/건강검진/, 'checkup'],
  [/실업급여/, 'unemployment'],
  [/구직촉진수당/, 'job-seeker'],
  [/이직확인서/, 'leave-cert'],
  [/산재|휴업급여/, 'injury'],
  [/지원금|보조금/, 'subsidy'],
  [/바우처|상품권/, 'voucher'],
  [/지역화폐/, 'local-pay'],
  [/소상공인/, 'small-biz'],
  [/청년/, 'youth'],
  [/전세|보증금/, 'deposit'],
  [/양도소득세|양도세/, 'capital-gains'],
  [/연말정산/, 'year-end-tax'],
  [/종합소득세/, 'income-tax'],
  [/재산세/, 'property-tax'],
  [/자동차세/, 'car-tax'],
  [/과태료|범칙금/, 'fine'],
  [/교통사고|사고/, 'accident'],
  [/렌터카|대차/, 'rental-car'],
  [/합의금|합의/, 'settlement'],
  [/환급|돌려받/, 'refund'],
  [/환불/, 'refund'],
  [/위약금|해지/, 'cancel'],
  [/채무|신용회복/, 'debt'],
  [/등본|초본|증명서/, 'certificate'],
  [/주민등록/, 'resident-reg'],
  [/신청\s*방법|신청/, 'apply'],
  [/기한|마감/, 'deadline'],
  [/서류/, 'documents'],
  [/계산/, 'calc'],
];

export function suggestSlug(title: string, fallbackId?: number | string): string {
  const t = String(title || '');
  const parts: string[] = [];
  for (const [re, en] of TERMS) {
    if (re.test(t) && !parts.includes(en)) parts.push(en);
    if (parts.length >= 3) break;
  }
  // 연도가 있으면 살린다 — "2026 기준" 같은 글은 해가 바뀌면 다른 글이 된다
  const year = t.match(/20\d{2}/);
  if (year && parts.length < 4) parts.push(year[0]);

  const slug = normalizeSlug(parts.join('-'));
  if (isMeaningfulSlug(slug)) return slug;
  // 사전에 하나도 안 걸리면 글 번호로라도 뜻이 통하게
  return fallbackId ? `post-${fallbackId}` : '';
}

/** 이미 쓰는 슬러그면 뒤에 숫자를 붙여 비켜 간다 */
export function dedupeSlug(slug: string, taken: Iterable<string>): string {
  const used = new Set(Array.from(taken, (s) => normalizeSlug(String(s))));
  const base = normalizeSlug(slug);
  if (!base) return base;
  if (!used.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const next = `${base}-${i}`;
    if (!used.has(next)) return next;
  }
  return `${base}-${Date.now().toString(36).slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────
// 실제 호출 — 인증·타임아웃은 wordpress-posts 의 것을 그대로 쓴다.
// 여기서 또 만들면 한쪽만 고쳐지는 사고가 난다.
// ─────────────────────────────────────────────────────────────
import { resolveWordPressAuth, wpFetch, toHttpError } from './wordpress-posts';

const NS = 'pretty-links/v1';

export interface ShortLinkListResult {
  ok: boolean;
  items?: ShortLink[];
  error?: string;
  needsAuth?: boolean;
}

export interface ShortLinkResult {
  ok: boolean;
  item?: ShortLink;
  error?: string;
  needsAuth?: boolean;
}

function fail(error: unknown): { ok: false; error: string; needsAuth: boolean } {
  const e = error as (Error & { needsAuth?: boolean }) | undefined;
  return { ok: false, error: e?.message || String(error), needsAuth: Boolean(e?.needsAuth) };
}

/** 단축링크 목록 (중복 확인과 클릭 통계에 함께 쓴다) */
export async function listShortLinks(options: {
  perPage?: number; search?: string; payload?: Record<string, any>;
} = {}): Promise<ShortLinkListResult> {
  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const per = Math.min(Math.max(Number(options.perPage) || 100, 1), 200);
    const q = `/links?per_page=${per}&orderby=created_at&order=desc`
      + (options.search ? `&search=${encodeURIComponent(options.search)}` : '');
    const res = await wpFetch(auth, q, {}, NS);
    if (!res.ok) throw await toHttpError(res);
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (raw?.data || raw?.links || []);
    return { ok: true, items: arr.map((r: any) => toShortLink(r, auth.siteUrl)) };
  } catch (error) {
    return fail(error);
  }
}

/**
 * 단축링크 생성.
 * 슬러그가 이미 있으면 플러그인이 거절한다 — 만들기 전에 목록으로 비켜 간다.
 * 실패하고 나서 알려주는 것보다 낫다.
 */
export async function createShortLink(options: ShortLinkCreateOptions & {
  payload?: Record<string, any>;
  /** 중복이면 뒤에 숫자를 붙여 만든다 (기본). 끄면 중복일 때 실패로 돌려준다 */
  autoDedupe?: boolean;
}): Promise<ShortLinkResult> {
  try {
    if (!String(options.url || '').trim()) return { ok: false, error: '목적지 주소가 비어 있습니다.' };
    let slug = normalizeSlug(options.slug);
    if (!slug) return { ok: false, error: '단축 주소가 비어 있습니다. 영문·숫자로 지어주세요.' };

    const auth = resolveWordPressAuth(options.payload || {});
    const existing = await listShortLinks({ perPage: 200, ...(options.payload ? { payload: options.payload } : {}) });
    if (existing.ok && existing.items) {
      const taken = existing.items.map((i) => i.slug);
      if (taken.includes(slug)) {
        if (options.autoDedupe === false) {
          return { ok: false, error: `"${slug}" 는 이미 쓰고 있는 주소입니다. 다른 걸로 지어주세요.` };
        }
        slug = dedupeSlug(slug, taken);
      }
    }

    const res = await wpFetch(auth, '/links', {
      method: 'POST',
      body: JSON.stringify(toCreateBody({ ...options, slug })),
    }, NS);
    if (!res.ok) throw await toHttpError(res);
    const raw = await res.json();
    return { ok: true, item: toShortLink(raw?.data || raw, auth.siteUrl) };
  } catch (error) {
    return fail(error);
  }
}

/** 목적지 바꾸기 — 프로필 링크 하나로 이번 달 A글, 다음 달 B글 */
export async function updateShortLink(options: {
  id: number; url?: string; name?: string; slug?: string; payload?: Record<string, any>;
}): Promise<ShortLinkResult> {
  try {
    const id = Number(options.id);
    if (!id) return { ok: false, error: '링크 번호가 없습니다.' };
    const auth = resolveWordPressAuth(options.payload || {});
    const body: Record<string, any> = {};
    if (options.url) body['url'] = String(options.url).trim();
    if (options.name !== undefined) body['name'] = String(options.name);
    if (options.slug) body['slug'] = normalizeSlug(options.slug);
    if (!Object.keys(body).length) return { ok: false, error: '바꿀 내용이 없습니다.' };

    const res = await wpFetch(auth, `/links/${id}`, { method: 'PUT', body: JSON.stringify(body) }, NS);
    if (!res.ok) throw await toHttpError(res);
    const raw = await res.json();
    return { ok: true, item: toShortLink(raw?.data || raw, auth.siteUrl) };
  } catch (error) {
    return fail(error);
  }
}

/** 클릭이 많은 순 — 어느 글이 실제로 유입을 만드는지 */
export async function topShortLinks(options: {
  from?: string; to?: string; limit?: number; payload?: Record<string, any>;
} = {}): Promise<ShortLinkListResult> {
  try {
    const auth = resolveWordPressAuth(options.payload || {});
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const q = `/reports/top-links?limit=${limit}`
      + (options.from ? `&from=${encodeURIComponent(options.from)}` : '')
      + (options.to ? `&to=${encodeURIComponent(options.to)}` : '');
    const res = await wpFetch(auth, q, {}, NS);
    if (!res.ok) throw await toHttpError(res);
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (raw?.data || []);
    return { ok: true, items: arr.map((r: any) => toShortLink(r, auth.siteUrl)) };
  } catch (error) {
    return fail(error);
  }
}
