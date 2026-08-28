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

/**
 * 🚧 v3.8.568 — 트래픽이 새는 곳. **기관 도메인이어도 여기 걸리면 막는다.**
 *
 * 사장님: "타 블로그나 SNS 에 트래픽을 유발하거나 광고 클릭을 유발시킬 수 있는 요소로
 *          연동되면 안 돼. 허브글을 따로 넣은 게 아니기 때문에 그런 거거든."
 *
 * 맞다. 허브글이 없으면 **나간 독자가 돌아오지 않는다.** 남의 블로그로 보내는 버튼은
 * 광고 수익도 없이 트래픽만 잃는다.
 * (애드센스 광고를 눌러 다른 블로그로 가는 건 별개다 — 그건 그 블로그가 광고주다.)
 *
 * ⚠️ 이 검사가 agency-match 보다 **먼저** 돌아야 한다. 기업 공식 블로그가
 *    blog.naver.com 에 있는 경우 기관명은 맞지만 목적지로는 부적합하다.
 */
const USER_GENERATED_PATTERNS: RegExp[] = [
  // 블로그 플랫폼
  /(^|\.)blog\.naver\.com$/i, /(^|\.)blog\.me$/i, /(^|\.)tistory\.com$/i,
  /(^|\.)blog\.daum\.net$/i, /(^|\.)egloos\.com$/i, /(^|\.)blogspot\./i,
  /(^|\.)wordpress\.com$/i, /(^|\.)medium\.com$/i, /(^|\.)brunch\.co\.kr$/i,
  /(^|\.)velog\.io$/i, /(^|\.)substack\.com$/i, /(^|\.)note\.com$/i,
  /(^|\.)postype\.com$/i,
  // 카페·커뮤니티·Q&A
  /(^|\.)cafe\.naver\.com$/i, /(^|\.)cafe\.daum\.net$/i, /(^|\.)band\.us$/i,
  /(^|\.)kin\.naver\.com$/i, /(^|\.)reddit\.com$/i, /(^|\.)quora\.com$/i,
  /(^|\.)clien\.net$/i, /(^|\.)dcinside\.com$/i, /(^|\.)fmkorea\.com$/i,
  // 위키
  /(^|\.)namu\.wiki$/i, /(^|\.)wikipedia\.org$/i, /(^|\.)wikiwand\.com$/i,
  /(^|\.)fandom\.com$/i,
  // SNS·영상
  /(^|\.)youtube\.com$/i, /(^|\.)youtu\.be$/i, /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i, /(^|\.)twitter\.com$/i, /(^|\.)x\.com$/i,
  /(^|\.)threads\.net$/i, /(^|\.)tiktok\.com$/i, /(^|\.)linkedin\.com$/i,
  /(^|\.)pinterest\./i, /(^|\.)tumblr\.com$/i,
];

/**
 * 블로그·카페·커뮤니티·SNS 인가.
 *
 * v3.8.576 — export 로 연다. CTA 목적지 판정뿐 아니라 **근거 수집**에서도 같은 기준이 필요하다.
 * 사장님: "블로그로 하면 그 블로그가 잘못된 정보면 그대로 통과가 되어버리니까."
 * 두 곳이 다른 목록을 쓰면 한쪽만 막히고 다른 쪽으로 새어 들어온다.
 */
export function isUserGenerated(host: string): boolean {
  return USER_GENERATED_PATTERNS.some((p) => p.test(host));
}

/** 주소에서 호스트를 뽑아 블로그·커뮤니티인지 본다 (근거 수집에서 쓴다) */
export function isUserGeneratedUrl(url: string): boolean {
  const host = hostOf(url);
  return host ? isUserGenerated(host) : false;
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
/**
 * v3.8.574 — 도메인 **자체**가 접미사인 경우도 받는다.
 *
 * hostOf 가 `www.` 를 떼기 때문에 `www.gov.kr` → `gov.kr` 이 되는데,
 * `'gov.kr'.endsWith('.gov.kr')` 는 false 다. 그래서 **정부24가 공공기관으로 안 잡혔다.**
 * 지금까지는 카탈로그(isCatalogHost)가 가려 주고 있어서 안 드러났다.
 */
function isInstitutional(host: string): boolean {
  return INSTITUTIONAL_SUFFIXES.some((suffix) => host.endsWith(suffix) || host === suffix.slice(1));
}

/**
 * 광고 추적 파라미터가 붙은 주소 — **광고 랜딩 페이지**다. (v3.8.574)
 *
 * ## 실제 사고 (2026-08-28, 사장님이 LLM 비평으로 발견)
 * "도수치료 실비보험 청구 거절" 글의 CTA 가 이랬다:
 *   https://www.lawthedream.com/insurance?utm_source=naver&utm_medium=cpc
 *     &n_media=27758&n_query=보험사부지급&n_rank=1&n_ad_group=grp-...
 * 사설 법률업체의 **네이버 파워링크 광고 랜딩**인데 배지는 "공식 권장" 이었다.
 *
 * 세 가지가 동시에 잘못이다:
 *   1. 사설 업체를 공식이라고 표기했다 — 독자를 속인다
 *   2. 광고 랜딩으로 보내면 **광고주 예산을 태운다** (클릭당 과금)
 *   3. 광고 URL 은 캠페인이 끝나면 죽는다 — 링크가 썩는다
 *
 * 검색 결과에 광고 슬롯이 섞여 들어온 것이므로, 파라미터를 떼어내는 게 아니라
 * **후보에서 버린다.** 광고에서 온 주소는 애초에 유기적 공식 결과가 아니다.
 */
const AD_TRACKING_PARAMS =
  /[?&](utm_[a-z_]+|gclid|fbclid|msclkid|yclid|n_ad|n_ad_group|n_media|n_query|n_rank|n_campaign|NaPm|trackid|track_id|affiliate_id|aff_id|clickid)=/i;

export function hasAdTracking(url: string): boolean {
  return AD_TRACKING_PARAMS.test(String(url || ''));
}

/**
 * 이 주소를 "공식"이라고 불러도 되는가 — **배지 문구를 정할 때** 쓴다.
 *
 * 통과(judgeCtaHost.ok)와는 다른 질문이다. 민간 도메인도 글이 지목한 기관이면
 * CTA 로 쓸 수 있지만(v3.8.568), 그렇다고 "공식 권장"을 붙이면 거짓말이 된다.
 * 현대차·KB손해보험 다이렉트에 "공식 권장"이 붙어 있었다(실측 11편).
 */
export function isOfficialDestination(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  if (hasAdTracking(url)) return false;
  /**
   * ⚠️ 카탈로그(isCatalogHost)는 쓰지 않는다.
   * 거기엔 백화점·항공사·렌터카 같은 **상업 사이트가 섞여 있다**(현대차가 공식으로 통과했다).
   * 공공기관 도메인만 공식으로 친다.
   *
   * 코레일·SRT 처럼 실제 공기업인데 .com/.kr 을 쓰는 곳은 "참고 링크"로 내려간다.
   * 덜 주장하는 것은 안전하지만, 과하게 주장하는 것이 지금 고치는 바로 그 버그다.
   */
  return isInstitutional(host);
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

/**
 * 🏢 v3.8.568 — **글이 지목한 기관이면 민간 도메인도 받는다.**
 *
 * ## 왜 필요한가 (사장님 실물 검수)
 * leadernam.com 의 "9·30부터 바뀌는 펀드 설명서" 글에 **CTA 가 하나도 없었다.**
 * 사장님: "이 글에 어떤 부분이 독자가 원하고, 그걸 굳이 또 검색해서 갈 필요 없이
 *          우리가 링크를 주면 된다 — 그게 왜 안 되어 있냐."
 *
 * 맞는 지적이었다. 그 글에도 독자가 할 일은 분명하다(내 펀드 설명서가 바뀌는지 확인).
 * 목적지가 없는 게 아니라 **우리가 못 찾은 것**이었다.
 *
 * 실측(2026-08-28, "펀드 투자설명서 확인 신청" 웹문서 10건):
 *   miraeasset.com · imfnsec.com · citibank.co.kr · shinhansec.com  → 전부 unknown-host 로 탈락
 *   통과한 것: kofia.or.kr(교육 페이지) · itp.or.kr(무관한 hwp) · fsc.go.kr(보도자료)
 * 독자가 실제로 가야 할 판매사·증권사가 전부 잘리고, 남은 것 중엔 행동 화면이 없어
 * v3.8.557 게이트가 정직하게 'none' 을 줬다. 그리고 v3.8.418 이 보충 검색을 이미 꺼둔 탓에
 * 뒤를 받을 것도 없었다 — **세 변경이 서로를 모른 채 겹쳐 CTA 가 0개가 됐다.**
 *
 * ## 원칙은 그대로다
 * "막을 것을 고르는" 방식으로 되돌아가지 않는다(코레일 글이 스팸 도메인으로 나간 그 사고).
 * 근거를 대는 방식은 유지하고 **근거의 종류를 하나 늘린다** — 본문이 지목한 기관.
 * 본문에 없는 회사는 여전히 못 들어온다.
 */
/**
 * ⚠️ 한글 기관명은 도메인과 절대 안 맞는다.
 *    `analyzeArticleContext` 는 "미래에셋증권" 을 주는데 도메인은 `miraeasset.com` 이다.
 *    한글→로마자 매핑표는 회사마다 제각각이라(미래에셋=miraeasset, 신한=shinhan,
 *    KB증권=kbsec) 유지가 안 된다.
 *
 *    대신 **검색 결과 제목**을 쓴다. 네이버 웹문서가 돌려주는 제목은 한글이라
 *    "미래에셋증권" 이 그대로 들어 있다. 변환이 필요 없고 훨씬 정확하다.
 *    (제목만으로 통과시켜도 안전한 이유: 블로그·SNS 는 이미 앞에서 막았고,
 *     그다음 v3.8.557 행동화면 게이트가 품질을 한 번 더 거른다)
 */
function matchesNamedAgency(host: string, agencies: string[], title: string): boolean {
  if (!agencies.length) return false;
  const normalizedTitle = String(title || '').toLowerCase().replace(/\s+/g, '');
  const normalizedHost = host.replace(/[^a-z0-9]/g, '');

  return agencies.some((raw) => {
    const agency = String(raw || '').trim().toLowerCase();
    if (agency.length < 2) return false;

    // ① 기관을 주소로 넘긴 경우 — 호스트끼리 비교
    const asHost = hostOf(agency) || (agency.includes('.') ? agency.split('/')[0] : '');
    if (asHost && asHost.includes('.')) {
      return host === asHost || host.endsWith(`.${asHost}`);
    }

    // ② 영문 기관명이 도메인에 들어 있는 경우 (miraeasset → securities.miraeasset.com)
    const token = agency.replace(/[^a-z0-9]/g, '');
    if (token.length >= 4 && normalizedHost.includes(token)) return true;

    // ③ 한글 기관명은 **검색 결과 제목**으로 맞춘다
    const koreanName = agency.replace(/\s+/g, '');
    return koreanName.length >= 2
      && /[가-힣]/.test(koreanName)
      && normalizedTitle.includes(koreanName);
  });
}

export interface HostTrustResult {
  ok: boolean;
  /** 왜 통과·거절했는지 — 로그로 남겨야 다음에 원인을 찾는다 */
  reason: 'catalog' | 'institutional' | 'brand-match' | 'agency-match'
    | 'redirector' | 'user-generated' | 'ad-tracking' | 'unknown-host' | 'malformed';
}

/**
 * 이 주소를 CTA 로 내보내도 되는가.
 * 근거를 못 대면 거절한다 — 낯선 도메인을 사장님 글에 싣지 않는다.
 */
export function judgeCtaHost(
  url: string,
  keyword: string,
  /** v3.8.568 — 본문이 지목한 기관들. 있으면 민간 도메인도 통과시킨다 */
  agencies: string[] = [],
  /** 검색 결과 제목 — 한글 기관명은 도메인이 아니라 여기서 맞춘다 */
  title = '',
): HostTrustResult {
  const host = hostOf(url);
  if (!host) return { ok: false, reason: 'malformed' };

  const raw = String(url || '');
  if (REDIRECTOR_PATTERNS.some((p) => p.test(host) || p.test(raw))) {
    return { ok: false, reason: 'redirector' };
  }

  /**
   * ⚠️ 통과 판정보다 **먼저** 본다.
   * 기업 공식 블로그가 blog.naver.com 에 있으면 기관명은 맞지만 보내면 안 된다.
   * 허브글이 없어 나간 트래픽이 돌아오지 않기 때문이다.
   */
  if (isUserGenerated(host)) return { ok: false, reason: 'user-generated' };

  /**
   * ⚠️ 통과 판정보다 **먼저** 본다.
   * 기관 도메인이어도 광고 랜딩이면 버린다 — 광고주 예산을 태우고 캠페인이 끝나면 죽는다.
   */
  if (hasAdTracking(raw)) return { ok: false, reason: 'ad-tracking' };

  if (isCatalogHost(host)) return { ok: true, reason: 'catalog' };
  if (isInstitutional(host)) return { ok: true, reason: 'institutional' };
  if (matchesKeywordBrand(host, keyword)) return { ok: true, reason: 'brand-match' };
  if (matchesNamedAgency(host, agencies, title)) return { ok: true, reason: 'agency-match' };

  return { ok: false, reason: 'unknown-host' };
}

/** 로그용 한 줄 설명 */
export function describeHostVerdict(result: HostTrustResult): string {
  switch (result.reason) {
    case 'catalog': return '등록된 공식 사이트';
    case 'institutional': return '공공·기관 도메인';
    case 'brand-match': return '키워드 브랜드와 일치';
    case 'agency-match': return '글이 지목한 기관과 일치';
    case 'redirector': return '링크 중계·단축 주소라 제외';
    case 'user-generated': return '블로그·SNS·커뮤니티라 제외 (트래픽이 새고 돌아오지 않는다)';
    case 'ad-tracking': return '광고 랜딩 주소라 제외 (광고주 예산을 태우고 캠페인이 끝나면 죽는다)';
    case 'unknown-host': return '근거를 확인할 수 없는 도메인이라 제외';
    default: return '주소 형식이 올바르지 않아 제외';
  }
}
