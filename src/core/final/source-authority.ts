/**
 * 🏷️ v3.8.767 — 출처 권위는 두 종류다: 공공기관 공식(PUBLIC_AUTHORITY_OFFICIAL) · 당사자 1차(SUBJECT_OWNER_PRIMARY).
 *
 * 실측(BATCH 1):
 *   · 자동차(run 19fb30): kia.com 의 EV3 상세 페이지("EV3 특징 및 디자인 … | Kia | 대한민국")가 가격·제원의 1차 자료인데 '웹' 으로 분류돼
 *     공식 근거 0건 → EVIDENCE_GATE 실패 → MANUAL_REVIEW.
 *   · 보험(run 324f0e): samsungfire.com 의 「자동차 간접손해보험금 안내 > 자동차보험공시 > 공시실」 이 자사 보상 기준의 1차 자료인데 '웹'.
 *
 * 규칙(도메인 목록 없음 — 검색 대상 ↔ 도메인 주인 ↔ 문서 주제 관계로 판정):
 *   ① 자사 제품 페이지: 페이지 제목에 자기 도메인의 브랜드(등기 도메인 첫 마디, 3자 이상)가 있고, 제목에 메인 키워드의 대상 이름이 있다.
 *   ② 자사 공시·약관 문서: 제목이나 주소에 공시·약관·상품설명서·요금표·제원표 같은 **자기 문서** 표지가 있다.
 *   공통 제외: 공공기관(그건 PUBLIC_AUTHORITY) · 블로그·카페·SNS · 쇼핑몰 · 뉴스(태그·기자 서명·전재 금지 문구) · 비교·후기·총정리 글(남의 자료를 모은 글).
 * 권위 범위: 당사자 1차는 **그 회사의 제품·약관·요금·공시**에 대해서만 1차다. 정부 정책(보조금 확정액 등)·업계 전체 규칙을 대표하지 않는다.
 */
import { isOfficialDestination, isUserGeneratedUrl, isCommerceHost, apexHost } from '../../cta/host-trust';

export type SourceAuthority = 'PUBLIC_AUTHORITY_OFFICIAL' | 'SUBJECT_OWNER_PRIMARY' | 'SECONDARY';

export interface AuthorityVerdict {
  authority: SourceAuthority;
  /** 당사자 1차일 때 그 주인(브랜드) — 권위 범위를 말할 때 쓴다 */
  owner?: string;
  /** 판정 근거 — 캡처용 */
  reason: string;
}

/** 당사자 1차 자료의 권위 범위 — Writer 에게 보이는 머리줄과 관문 사유에 같은 말을 쓴다 */
export const OWNER_SCOPE_NOTE = '자사 제품·약관·요금·공시 범위(정부 정책·업계 전체 규칙은 대표하지 않음)';

const OWN_DOCUMENT = /(공시|약관|상품\s*설명서|상품\s*요약서|사업\s*방법서|요금표|요금제|가격표|제원표|사양표|보험금\s*지급\s*기준|publication|disclosure|terms|yakgwan|\/price|\/spec)/i;
const AGGREGATOR = /(비교|후기|리뷰|총정리|정리|추천|꿀팁|가이드|시승기|계산기|vs\b|review|guide)/i;
const NEWS_TEXT = /[가-힣]{2,4}\s*기자\b|무단\s*전재|재배포\s*금지|기사\s*제보/;

function brandOf(host: string): string {
  const apex = apexHost(host);
  const label = (apex.split('.')[0] || '').toLowerCase();
  return label.replace(/[^a-z0-9]/g, '');
}

export function classifySourceAuthority(input: { url: string; tag?: string; title?: string; text?: string; mainKeyword?: string; distinctive?: string[] }): AuthorityVerdict {
  const url = String(input.url || '');
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return { authority: 'SECONDARY', reason: '주소 없음' }; }
  if (/\.go\.kr$|(^|\.)korea\.kr$|\.gov$/.test(host) || isOfficialDestination(url)) return { authority: 'PUBLIC_AUTHORITY_OFFICIAL', reason: '공공기관 도메인' };
  const tag = String(input.tag || '');
  const title = String(input.title || '');
  if (/뉴스|news|블로그|blog|지식|kin/i.test(tag)) return { authority: 'SECONDARY', reason: `검색 채널 ${tag}` };
  if (isUserGeneratedUrl(url) || isCommerceHost(host)) return { authority: 'SECONDARY', reason: '사용자 글·쇼핑몰' };
  if (NEWS_TEXT.test(String(input.text || '').slice(0, 4000))) return { authority: 'SECONDARY', reason: '기사 꼴(기자 서명·전재 금지)' };
  if (AGGREGATOR.test(title)) return { authority: 'SECONDARY', reason: '모음·비교 글' };
  const brand = brandOf(host);
  if (brand.length < 3) return { authority: 'SECONDARY', reason: '브랜드를 읽을 수 없는 도메인' };
  const titleFlat = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const subjects = (input.distinctive || []).map((w) => w.toLowerCase().replace(/\s+/g, '')).filter((w) => w.length >= 2);
  // ① 제목이 자기 브랜드를 밝히고(| Kia |) 검색 대상(EV3)을 다룬다
  if (titleFlat.includes(brand) && subjects.some((s) => titleFlat.includes(s))) return { authority: 'SUBJECT_OWNER_PRIMARY', owner: brand, reason: `자사 제품 페이지 — 제목에 브랜드(${brand})와 대상 이름` };
  // ② 자기 공시·약관·요금·제원 문서
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* 위에서 걸렀다 */ }
  if (OWN_DOCUMENT.test(title) || OWN_DOCUMENT.test(path)) return { authority: 'SUBJECT_OWNER_PRIMARY', owner: brand, reason: `자사 공시·약관 문서(${host})` };
  return { authority: 'SECONDARY', reason: '당사자 표지 없음' };
}
