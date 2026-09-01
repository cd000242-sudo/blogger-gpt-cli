/**
 * name-to-url — **기관 이름을 공식 주소로 바꾼다.** (v3.8.619)
 *
 * ## 사장님 요구
 * "어떤 주제로 글을 쓰든지 자동으로 완벽하게 버튼이 생기고 링크가 걸려야 돼요"
 *
 * ## 왜 지금은 안 되는가 (실측: 2027년 공무원 봉급 글)
 * 스마트 CTA 는 이미 제 일을 했다 — AI 가 "인사혁신처"를 확신 0.6 이상으로 지목했다.
 * 그런데 그 다음이 없었다. 이름을 주소로 바꾸는 길이 **카탈로그 조회 하나뿐**이라
 * 카탈로그(198곳)에 없는 기관이면 그대로 버려졌고, generation.ts 는 이렇게 끝났다:
 *
 *     // 매핑도 없으면 — CTA 자체 안 만듦
 *
 * 그 글의 CTA 버튼은 **0개**로 발행됐다. 목적지를 몰라서가 아니라 **주소를 못 찾아서**다.
 *
 * ## 무엇을 하는가
 * 이름 하나를 받아 **이미 우리가 아는 사전들**을 역방향으로 뒤진다.
 *   ① 공식 카탈로그(OFFICIAL_CATALOG)의 표기(txt)
 *   ② CTA 문구용 호스트 이름 사전(EXTRA_HOST_NAMES)
 * 둘 다 이미 "이 주소는 이 기관"이라고 검증해 둔 값이라, 여기서 나온 주소는 지어낸 것이 아니다.
 *
 * ## 하지 않는 것
 * 도메인을 **추측하지 않는다.** "인사혁신처니까 insa.go.kr 이겠지" 같은 조합은
 * 틀리면 독자를 엉뚱한 곳(또는 남의 사이트)으로 보낸다. 모르면 빈 값을 돌려주고,
 * 호출자가 검색 폴백 같은 다음 수단을 쓰게 둔다.
 */

import { OFFICIAL_CATALOG } from './official-catalog';
import { EXTRA_HOST_NAMES } from './cta-copy';

/** 비교용 정규화 — 공백·괄호·중점 차이로 못 찾는 일이 없게 한다 */
function normalizeName(value: string): string {
  return String(value || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[\s·・,]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * 이름이 서로 가리키는 같은 기관인가.
 *
 * "국민연금" 과 "국민연금공단", "KDI" 와 "KDI 경제교육·정보센터" 처럼
 * 한쪽이 다른 쪽을 품는 경우가 흔하다. 다만 너무 짧은 말(2글자 미만)은
 * 아무 데나 걸리므로 정확히 같을 때만 인정한다.
 */
function namesMatch(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length < 3 || right.length < 3) return false;
  return left.includes(right) || right.includes(left);
}

/**
 * 호스트를 열리는 주소로 만든다.
 *
 * 실측에서 걸렸다: `kdi.re.kr` 에 `www.` 를 붙였더니 응답이 없었다.
 * 그 기관의 실제 자리는 `eiec.kdi.re.kr` 이다. `fine.fss.or.kr`(금감원 파인),
 * `minwon.molit.go.kr`(국토부 민원)도 마찬가지로 **이미 하위 도메인**이다.
 *
 * 그래서 이름표에 적힌 호스트가 등록 도메인보다 길면(= 하위 도메인이 이미 있으면)
 * 그대로 쓰고, 그렇지 않을 때만 `www.` 를 붙인다.
 * 한국 도메인은 `go.kr`·`or.kr`·`re.kr`·`co.kr` 처럼 2단계 접미사를 쓰므로
 * 그 경우 등록 도메인은 세 마디다.
 */
function urlForHost(host: string): string {
  const labels = host.split('.');
  const twoLevelSuffix = /\.(go|or|re|co|ne|pe|kg|ms|hs|es|sc|ac)\.kr$/.test(host);
  const registrableLabels = twoLevelSuffix ? 3 : 2;
  return labels.length > registrableLabels ? `https://${host}` : `https://www.${host}`;
}

export interface NamedOfficialSite {
  name: string;
  url: string;
  /** 어느 사전에서 나왔는가 — 로그로 추적하려고 남긴다 */
  source: 'catalog' | 'host-names';
}

/** 이름 → 주소 색인. 모듈이 처음 쓰일 때 한 번만 만든다 */
const INDEX: NamedOfficialSite[] = (() => {
  const out: NamedOfficialSite[] = [];
  for (const item of OFFICIAL_CATALOG) {
    const name = String(item.txt || '').trim();
    if (name && /^https:\/\//.test(item.url)) out.push({ name, url: item.url, source: 'catalog' });
  }
  for (const [host, name] of Object.entries(EXTRA_HOST_NAMES)) {
    if (name) out.push({ name, url: urlForHost(host), source: 'host-names' });
  }
  return out;
})();

/**
 * 기관 이름으로 공식 주소를 찾는다. 못 찾으면 null — **지어내지 않는다.**
 *
 * 카탈로그를 먼저 본다. 카탈로그 항목은 행동 화면(예매·신청)까지 가리키는 경우가 많아
 * 기관 홈보다 독자에게 쓸모가 있다.
 */
export function resolveOfficialUrlByName(name: string): NamedOfficialSite | null {
  const query = String(name || '').trim();
  if (!query) return null;

  const exact = INDEX.find((item) => normalizeName(item.name) === normalizeName(query));
  if (exact) return exact;

  return INDEX.find((item) => namesMatch(item.name, query)) || null;
}

/** 이 이름을 우리가 아는가 — 로그·측정용 */
export function knowsOfficialName(name: string): boolean {
  return resolveOfficialUrlByName(name) !== null;
}

/** 색인 크기 — 사전이 얼마나 넓은지 재는 용도 */
export function officialNameIndexSize(): number {
  return INDEX.length;
}
