/**
 * src/core/naver-search-client.ts — 네이버 검색 API 단일 창구 (v3.8.526)
 *
 * ## 왜 만들었나
 * 2026-06-25 NAVER API HUB 출시로 검색 API 가 네이버클라우드로 이관됐다.
 * 그런데 앱은 60곳 넘는 자리에서 각자 URL 을 조립하고 헤더를 붙이고 있었다.
 * 그래서 개편 한 번에 60곳을 고쳐야 하는 상태였다 — 창구를 하나로 모은다.
 *
 * ## 실측으로 확정한 규격 (2026-08-18, 키 없이 직접 호출해 확인)
 *   구(舊) openapi : https://openapi.naver.com/v1/search/{type}.json
 *                    헤더 X-Naver-Client-Id / X-Naver-Client-Secret
 *   신(新) API HUB : https://naverapihub.apigw.ntruss.com/search/v1/{type}      → 401(인증만 없음) = 존재
 *                    데이터랩 /search-trend/v1/search                            → 401 = 존재
 *                    헤더 X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
 *   ※ naveropenapi.apigw.ntruss.com 은 404 — 다른 게이트웨이다 (헷갈리기 쉬움)
 *
 * ## 키를 넣으면 바로 쓰이는 구조
 * HUB 키가 있으면 HUB 로, 없으면 기존 키로 나간다. 사용자는 키만 넣으면 된다.
 * 기존 키를 강제로 끊지 않는 이유: 이관 신청자는 2027-06-30 까지 쓸 수 있는데
 * 여기서 잘라버리면 아직 HUB 키를 못 받은 사용자의 앱이 그 순간 멈춘다.
 * (쇼핑·책·전문자료 검색은 2026-07-31 종료 — 어느 쪽으로도 되살릴 수 없다)
 */

export type NaverSearchType = 'blog' | 'news' | 'webkr' | 'kin' | 'cafearticle' | 'encyc' | 'local' | 'image';

export interface NaverCredentials {
  /** 'hub' = NAVER API HUB(네이버클라우드), 'legacy' = 기존 개발자센터 */
  mode: 'hub' | 'legacy' | 'none';
  keyId: string;
  keySecret: string;
}

const HUB_BASE = 'https://naverapihub.apigw.ntruss.com';
const LEGACY_BASE = 'https://openapi.naver.com';

/** 2026-07-31 종료 — 어느 경로로도 안 된다. 부르는 쪽이 헷갈리지 않게 이름을 남겨 둔다. */
export const TERMINATED_SEARCH_TYPES = ['shop', 'book', 'doc'] as const;

function pick(source: Record<string, any> | undefined, ...names: string[]): string {
  if (!source) return '';
  for (const name of names) {
    const value = source[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * v3.8.527 — 어느 키가 살아 있는지 기억한다.
 *
 * 사장님 지시: "둘 다 배선하고, 기간이 다 돼서 자연스럽게 죽으면 자연스럽게 토스".
 * 한 번 토스한 뒤에도 매번 죽은 키를 먼저 두드리면 요청이 두 배가 된다.
 * 그래서 성공한 쪽을 기억해 두고 다음부터는 곧바로 그쪽으로 간다.
 * (프로세스 수명 동안만 — 키를 바꿔 넣으면 다시 판단해야 하므로 영구 저장하지 않는다)
 */
let modeMemo: 'hub' | 'legacy' | null = null;
export function getNaverModeMemo(): 'hub' | 'legacy' | null { return modeMemo; }
export function resetNaverModeMemo(): void { modeMemo = null; }

/** 인증이 막힌 것만 "키가 죽었다"로 본다 — 타임아웃에 키를 바꾸면 멀쩡한 키를 의심하게 된다 */
function isAuthBlocked(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

/** 설정된 키를 둘 다 만들어 둔다 (있는 것만) */
export type LiveNaverCredentials = NaverCredentials & { mode: "hub" | "legacy" };

export function resolveAllNaverCredentials(payload?: Record<string, any>): LiveNaverCredentials[] {
  const env = (() => {
    try { return require('../env').loadEnvFromFile() as Record<string, any>; } catch { return {}; }
  })();
  const out: LiveNaverCredentials[] = [];

  const hubId = pick(payload, 'naverApiHubKeyId', 'naverHubKeyId') || pick(env, 'naverApiHubKeyId', 'NAVER_API_HUB_KEY_ID');
  const hubSecret = pick(payload, 'naverApiHubKey', 'naverHubKey') || pick(env, 'naverApiHubKey', 'NAVER_API_HUB_KEY');
  if (hubId && hubSecret) out.push({ mode: 'hub', keyId: hubId, keySecret: hubSecret });

  const legacyId = pick(payload, 'naverClientId') || pick(env, 'naverClientId', 'NAVER_CLIENT_ID');
  const legacySecret = pick(payload, 'naverClientSecret') || pick(env, 'naverClientSecret', 'NAVER_CLIENT_SECRET');
  if (legacyId && legacySecret) out.push({ mode: 'legacy', keyId: legacyId, keySecret: legacySecret });

  return out;
}

/**
 * 시도 순서를 정한다.
 *   ① 살아 있다고 기억해 둔 키 ② 요청이 지정한 우선순위 ③ 기본(HUB 먼저)
 * 나머지는 뒤에 붙여 둔다 — 앞의 것이 인증에서 막히면 그때 넘어간다.
 */
function orderCredentials(all: LiveNaverCredentials[], prefer?: 'hub' | 'legacy'): LiveNaverCredentials[] {
  const first = prefer || modeMemo;
  if (!first) return all;
  const head = all.filter((c) => c.mode === first);
  const tail = all.filter((c) => c.mode !== first);
  return [...head, ...tail];
}

/**
 * 어떤 키로 나갈지 정한다. HUB 우선 — 새 발급분이 있으면 그게 정답이다.
 * payload(사용자 입력) → env 순으로 본다.
 */
export function resolveNaverCredentials(payload?: Record<string, any>): NaverCredentials {
  const env = (() => {
    try { return require('../env').loadEnvFromFile() as Record<string, any>; } catch { return {}; }
  })();

  const hubId = pick(payload, 'naverApiHubKeyId', 'naverHubKeyId')
    || pick(env, 'naverApiHubKeyId', 'NAVER_API_HUB_KEY_ID');
  const hubSecret = pick(payload, 'naverApiHubKey', 'naverHubKey')
    || pick(env, 'naverApiHubKey', 'NAVER_API_HUB_KEY');
  if (hubId && hubSecret) return { mode: 'hub', keyId: hubId, keySecret: hubSecret };

  const legacyId = pick(payload, 'naverClientId') || pick(env, 'naverClientId', 'NAVER_CLIENT_ID');
  const legacySecret = pick(payload, 'naverClientSecret') || pick(env, 'naverClientSecret', 'NAVER_CLIENT_SECRET');
  if (legacyId && legacySecret) return { mode: 'legacy', keyId: legacyId, keySecret: legacySecret };

  return { mode: 'none', keyId: '', keySecret: '' };
}

export function naverAuthHeaders(cred: NaverCredentials): Record<string, string> {
  if (cred.mode === 'hub') {
    return { 'X-NCP-APIGW-API-KEY-ID': cred.keyId, 'X-NCP-APIGW-API-KEY': cred.keySecret };
  }
  return { 'X-Naver-Client-Id': cred.keyId, 'X-Naver-Client-Secret': cred.keySecret };
}

export function buildNaverSearchUrl(type: NaverSearchType, params: Record<string, any>, cred: NaverCredentials): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }
  return cred.mode === 'hub'
    ? `${HUB_BASE}/search/v1/${type}?${qs.toString()}`
    : `${LEGACY_BASE}/v1/search/${type}.json?${qs.toString()}`;
}

export function buildNaverDatalabUrl(cred: NaverCredentials): string {
  return cred.mode === 'hub'
    ? `${HUB_BASE}/search-trend/v1/search`
    : `${LEGACY_BASE}/v1/datalab/search`;
}

/** 실패를 사용자가 손쓸 수 있는 말로 바꾼다 (상태코드만 던지면 할 수 있는 게 없다) */
export function describeNaverFailure(status: number, mode: NaverCredentials['mode']): string {
  const hub = '네이버클라우드 콘솔 > AI·NAVER API 에서 Application 을 만들고 Client ID/Secret 을 환경설정에 넣어주세요.';
  if (status === 401 || status === 403) {
    return mode === 'hub'
      ? `네이버 API 인증 실패 (${status}). API HUB 키가 맞는지, Application 에서 Search API 를 선택했는지 확인해주세요.`
      : `네이버 API 인증 실패 (${status}). 기존 키가 만료됐거나 이관되지 않았습니다. ${hub}`;
  }
  if (status === 404) {
    return `네이버 API 없음 (404). 쇼핑·책·전문자료 검색은 2026-07-31 종료돼 대체가 없습니다. 그 외 API 라면 ${hub}`;
  }
  if (status === 429) {
    return ' 네이버 API 한도 초과 (429). API HUB 는 Application 에서 서비스를 선택하지 않아도 429 가 납니다 — 콘솔에서 Search API 선택을 확인해주세요.'.trim();
  }
  return `네이버 API 오류 (${status}). 계속되면 ${hub}`;
}

export interface NaverSearchResult<T = any> {
  ok: boolean;
  items: T[];
  total: number;
  error?: string;
  mode: NaverCredentials['mode'];
}

export interface NaverCallOptions {
  payload?: Record<string, any>;
  timeoutMs?: number;
  /** 이번 호출에서 먼저 써 볼 키 (테스트·특수 상황용) */
  preferMode?: 'hub' | 'legacy';
  /** 테스트에서 갈아끼우는 fetch */
  fetchImpl?: typeof fetch;
}

/**
 * 검색 한 번. 어느 쪽 키든 이 함수 하나로 나간다.
 * v3.8.527 — 인증이 막히면(401/403/404) 다른 키로 그 자리에서 넘어간다.
 */
export async function naverSearch<T = any>(
  type: NaverSearchType,
  params: Record<string, any>,
  options: NaverCallOptions = {},
): Promise<NaverSearchResult<T>> {
  const doFetch = options.fetchImpl || fetch;
  const ordered = orderCredentials(resolveAllNaverCredentials(options.payload), options.preferMode);
  if (!ordered.length) {
    return { ok: false, items: [], total: 0, mode: 'none', error: '네이버 API 키가 없습니다. 환경설정에서 입력해주세요.' };
  }

  let lastError = '';
  let lastMode: NaverCredentials['mode'] = ordered[0]!.mode;
  for (const cred of ordered) {
    lastMode = cred.mode;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
    try {
      const res = await doFetch(buildNaverSearchUrl(type, params, cred), {
        headers: naverAuthHeaders(cred),
        signal: controller.signal,
      } as any);
      if (res.ok) {
        modeMemo = cred.mode;   // 살아 있는 쪽을 기억한다
        const data: any = await res.json();
        return { ok: true, items: Array.isArray(data.items) ? data.items : [], total: Number(data.total || 0), mode: cred.mode };
      }
      lastError = describeNaverFailure(res.status, cred.mode);
      if (!isAuthBlocked(res.status)) break;      // 한도 초과 등은 키를 바꿔도 소용없다
      if (modeMemo === cred.mode) modeMemo = null; // 죽은 키 기억은 지운다
      // 인증이 막혔으면 다음 키로 넘어간다 (자연스러운 토스)
    } catch (error: any) {
      // 네트워크·타임아웃은 키 문제가 아니다 — 다른 키를 태우지 않는다
      return { ok: false, items: [], total: 0, mode: cred.mode, error: String(error?.message || error).slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, items: [], total: 0, mode: lastMode, error: lastError || '네이버 API 호출 실패' };
}

/** 데이터랩(Search Trend) 한 번 */
export async function naverDatalabSearch(
  body: Record<string, any>,
  options: NaverCallOptions = {},
): Promise<{ ok: boolean; data?: any; error?: string; mode: NaverCredentials['mode'] }> {
  const doFetch = options.fetchImpl || fetch;
  const ordered = orderCredentials(resolveAllNaverCredentials(options.payload), options.preferMode);
  if (!ordered.length) {
    return { ok: false, mode: 'none', error: '네이버 API 키가 없습니다. 환경설정에서 입력해주세요.' };
  }

  let lastError = '';
  let lastMode: NaverCredentials['mode'] = ordered[0]!.mode;
  for (const cred of ordered) {
    lastMode = cred.mode;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
    try {
      const res = await doFetch(buildNaverDatalabUrl(cred), {
        method: 'POST',
        headers: { ...naverAuthHeaders(cred), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      } as any);
      if (res.ok) {
        modeMemo = cred.mode;
        return { ok: true, mode: cred.mode, data: await res.json() };
      }
      lastError = describeNaverFailure(res.status, cred.mode);
      if (!isAuthBlocked(res.status)) break;
      if (modeMemo === cred.mode) modeMemo = null;
    } catch (error: any) {
      return { ok: false, mode: cred.mode, error: String(error?.message || error).slice(0, 200) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, mode: lastMode, error: lastError || '네이버 데이터랩 호출 실패' };
}
