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

/** 검색 한 번. 어느 쪽 키든 이 함수 하나로 나간다. */
export async function naverSearch<T = any>(
  type: NaverSearchType,
  params: Record<string, any>,
  options: { payload?: Record<string, any>; timeoutMs?: number } = {},
): Promise<NaverSearchResult<T>> {
  const cred = resolveNaverCredentials(options.payload);
  if (cred.mode === 'none') {
    return { ok: false, items: [], total: 0, mode: 'none', error: '네이버 API 키가 없습니다. 환경설정에서 입력해주세요.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const res = await fetch(buildNaverSearchUrl(type, params, cred), {
      headers: naverAuthHeaders(cred),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, items: [], total: 0, mode: cred.mode, error: describeNaverFailure(res.status, cred.mode) };
    }
    const data: any = await res.json();
    return { ok: true, items: Array.isArray(data.items) ? data.items : [], total: Number(data.total || 0), mode: cred.mode };
  } catch (error: any) {
    return { ok: false, items: [], total: 0, mode: cred.mode, error: String(error?.message || error).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

/** 데이터랩(Search Trend) 한 번 */
export async function naverDatalabSearch(
  body: Record<string, any>,
  options: { payload?: Record<string, any>; timeoutMs?: number } = {},
): Promise<{ ok: boolean; data?: any; error?: string; mode: NaverCredentials['mode'] }> {
  const cred = resolveNaverCredentials(options.payload);
  if (cred.mode === 'none') {
    return { ok: false, mode: 'none', error: '네이버 API 키가 없습니다. 환경설정에서 입력해주세요.' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const res = await fetch(buildNaverDatalabUrl(cred), {
      method: 'POST',
      headers: { ...naverAuthHeaders(cred), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, mode: cred.mode, error: describeNaverFailure(res.status, cred.mode) };
    return { ok: true, mode: cred.mode, data: await res.json() };
  } catch (error: any) {
    return { ok: false, mode: cred.mode, error: String(error?.message || error).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}
