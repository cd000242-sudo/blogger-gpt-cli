/**
 * host-trust — CTA 로 내보내도 되는 도메인인지 판단한다.
 *
 * ## 왜 만들었나 (실제 사고)
 * 사장님 보고: 코레일 글의 CTA 가 `postmate.waffle-gl.org/link/naver/erica2600` 로 나갔다.
 *
 * 예전 규칙은 **제외 목록에만 없으면 통과**였다.
 *   제외: blog.naver.com, tistory.com, namu.wiki, youtube.com …
 * 그래서 검색 결과에 섞여 든 낯선 집계·스팸 도메인이 200 만 돌려주면 그대로 실렸다.
 * 게다가 신뢰 목록이 `.go.kr/.or.kr/.ac.kr/.re.kr/.gov/.edu/.mil` 뿐이라
 * **korail.com 같은 진짜 공식 사이트가 오히려 우선순위를 못 받았다.**
 *
 * ## 바꾼 원칙
 * "막을 것을 고르는" 방식에서 **"통과시킬 것을 고르는"** 방식으로 뒤집는다.
 * 근거를 댈 수 있는 도메인만 내보낸다. 근거가 없으면 **CTA 를 안 넣는다** —
 * 남의 사이트 링크를 사장님 글에 싣는 것보다 CTA 가 없는 편이 낫다.
 */
import { OFFICIAL_CATALOG } from './official-catalog';

/** 기관·공공 도메인 — 여기 속하면 출처가 분명하다 */
const INSTITUTIONAL_SUFFIXES = ['.go.kr', '.or.kr', '.ac.kr', '.re.kr', '.gov', '.edu', '.mil', '.gov.kr'];

/** 카탈로그에 등록된 공식 사이트 호스트 (188개) */
let catalogHosts: Set<string> | null = null;

function getCatalogHosts(): Set<string> {
  if (catalogHosts) return catalogHosts;
  const hosts = new Set<string>();
  for (const item of OFFICIAL_CATALOG) {
    try {
      hosts.add(new URL(item.url).hostname.toLowerCase().replace(/^www\./, ''));
    } catch { /* 주소가 깨진 항목은 건너뛴다 */ }
  }
  catalogHosts = hosts;
  return hosts;
}

/** 링크 단축·중계·집계처럼 최종 목적지를 감추는 도메인 */
const REDIRECTOR_PATTERNS = [
  /(^|\.)bit\.ly$/i, /(^|\.)t\.co$/i, /(^|\.)tinyurl\.com$/i, /(^|\.)shorturl\.at$/i,
  /(^|\.)wa\.me$/i, /(^|\.)lnk\.to$/i, /(^|\.)linktr\.ee$/i,
  /\/link\//i,
];

function hostOf(url: string): string {
  try {
    return new URL(String(url || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** 호스트가 등록된 공식 사이트이거나 그 하위 도메인인가 */
function isCatalogHost(host: string): boolean {
  if (!host) return false;
  const hosts = getCatalogHosts();
  if (hosts.has(host)) return true;
  // sub.korail.com 처럼 하위 도메인도 같은 기관으로 본다
  for (const known of hosts) {
    if (host.endsWith(`.${known}`)) return true;
  }
  return false;
}

/** 기관·공공 도메인인가 */
function isInstitutional(host: string): boolean {
  return INSTITUTIONAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * 키워드에서 뽑은 영문 토큰이 도메인에 들어 있는가.
 * "KTX 예매" → ktx, "SRT 시간표" → srt 처럼 브랜드가 영문으로 드러난 경우를 받는다.
 * 두 글자 이하는 우연히 맞을 수 있어 쓰지 않는다.
 */
function matchesKeywordBrand(host: string, keyword: string): boolean {
  const tokens = String(keyword || '').toLowerCase().match(/[a-z][a-z0-9]{2,}/g) || [];
  return tokens.some((token) => host.includes(token));
}

export interface HostTrustResult {
  ok: boolean;
  /** 왜 통과·거절했는지 — 로그로 남겨야 다음에 원인을 찾는다 */
  reason: 'catalog' | 'institutional' | 'brand-match' | 'redirector' | 'unknown-host' | 'malformed';
}

/**
 * 이 주소를 CTA 로 내보내도 되는가.
 * 근거를 못 대면 거절한다 — 낯선 도메인을 사장님 글에 싣지 않는다.
 */
export function judgeCtaHost(url: string, keyword: string): HostTrustResult {
  const host = hostOf(url);
  if (!host) return { ok: false, reason: 'malformed' };

  const raw = String(url || '');
  if (REDIRECTOR_PATTERNS.some((p) => p.test(host) || p.test(raw))) {
    return { ok: false, reason: 'redirector' };
  }

  if (isCatalogHost(host)) return { ok: true, reason: 'catalog' };
  if (isInstitutional(host)) return { ok: true, reason: 'institutional' };
  if (matchesKeywordBrand(host, keyword)) return { ok: true, reason: 'brand-match' };

  return { ok: false, reason: 'unknown-host' };
}

/** 로그용 한 줄 설명 */
export function describeHostVerdict(result: HostTrustResult): string {
  switch (result.reason) {
    case 'catalog': return '등록된 공식 사이트';
    case 'institutional': return '공공·기관 도메인';
    case 'brand-match': return '키워드 브랜드와 일치';
    case 'redirector': return '링크 중계·단축 주소라 제외';
    case 'unknown-host': return '근거를 확인할 수 없는 도메인이라 제외';
    default: return '주소 형식이 올바르지 않아 제외';
  }
}
