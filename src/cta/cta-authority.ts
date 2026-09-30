/**
 * 🎯 v3.8.781 — CTA 목적지 권위(ENTITY · ACTION · DESTINATION). 호출 0회 · 새 검색 0.
 *
 * 실측(live 508d55, 인감증명서 · 요청 "정부24 공식 발급 페이지 CTA"):
 *   · 근거 E04(공식)에 정확한 발급 화면 "인감증명서 발급 바로가기"가 있었고, 본문 결론 링크도 그 주소를 썼다.
 *   · CTA 는 검색 후보 gov.kr 민원 화면 10개를 전부 "살아있지 않음(session-bound-url)" 으로 버리고 → 기관 홈 → 홈 안에서 찾은
 *     "혜택 조회" 포털로 갔다. 공식 도메인이라 적합성 검사도 통과했다(목적지 정보 없음 = 막지 않음).
 *
 * 규칙:
 *   · 후보 = 근거(공식·당사자)와 본문이 이미 쓴 공식 링크 가운데 **글의 대상**(claim-entity 의 주제와 같은 규칙)과 **행동**(발급·신청·예약…)이
 *     그 문서의 제목·본문 앞부분에 있는 것. 공식 도메인만으로는 후보가 아니다. 새 검색은 하지 않는다.
 *   · 검증된 CTA = 주소가 후보와 같거나, 근거 장부에 그 **정확한 주소**의 문서가 있고 대상·행동이 맞는 것(같은 호스트의 다른 문서 제목을 빌리지 않는다).
 *   · 검증 안 된 CTA → 후보가 있으면 후보로 바꾼다. 후보가 없으면: 작성자가 CTA 를 필수로 요구했으면 뺀다(잘못된 CTA 보다 없음 → 요구 관문이 보류),
 *     아니면 예전 그대로 둔다.
 *   · 생존 확인 실패는 종류를 나눈다. 주소 자체가 틀렸거나 404 류만 죽음(HTTP_FAIL). 세션·로그인·앱 화면·HEAD 거부·시간 초과는
 *     UNVERIFIED — 근거가 확인한 공식 행동 화면이면 버리지 않는다(무관한 공식 페이지로 바꾸지 않는다).
 */
import { checkCtaMatch } from './cta-match';
import { entitySubject } from '../core/final/claim-entity';
import { anchorsFrom, variantMentions, scopeFromMentions, variantRelation } from '../core/final/claim-variant';

export type CtaLiveness = 'ALIVE' | 'HTTP_FAIL' | 'REDIRECT' | 'AUTH_REQUIRED' | 'CLIENT_SIDE_APP' | 'HEAD_UNSUPPORTED' | 'UNKNOWN';

/** validateCtaUrl 결과 → 생존 종류. 이유 문자열은 validate-cta-url.ts 의 것 */
export function classifyCtaLiveness(check: { isValid: boolean; reason?: string | undefined; statusCode?: number | undefined }): CtaLiveness {
  const reason = String(check.reason || '');
  if (check.isValid) return reason === 'head-blocked-passthrough' ? 'HEAD_UNSUPPORTED' : 'ALIVE';
  if (reason === 'session-bound-url') return 'AUTH_REQUIRED';
  if (reason === 'redirect-to-error') return 'REDIRECT';
  if (reason === 'error-content') return 'CLIENT_SIDE_APP';
  if (reason === 'timeout') return 'UNKNOWN';
  const http = reason.match(/^http-(\d{3})$/);
  const status = Number(http?.[1] || check.statusCode || 0);
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  if (status === 405 || status === 501) return 'HEAD_UNSUPPORTED';
  if (status >= 500) return 'UNKNOWN';
  return 'HTTP_FAIL';   // 404·410·형식 오류·막힌 호스트·에러 페이지 주소
}
/** 죽었다고 말할 수 있는 것은 이것뿐 — 나머지는 확인 못 함(UNVERIFIED) */
export const isHardDead = (c: CtaLiveness): boolean => c === 'HTTP_FAIL';

export interface ActionSource { url: string; title?: string | undefined; text?: string | undefined; official: boolean; via?: 'evidence' | 'body' }
export interface ActionCandidate { url: string; title: string; rank: number; via: 'evidence' | 'body' }

const flat = (s: unknown) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sameUrl = (a: string, b: string) => flat(a).replace(/\/+$/, '') === flat(b).replace(/\/+$/, '');

/** 글의 대상 — 키워드(없으면 제목)의 첫 한글 명사. 사실 판정의 대상 축(claim-entity)과 같은 규칙 */
export function ctaSubject(keyword: string, title = ''): string {
  return entitySubject(keyword) || entitySubject(title);
}

/** 행동 화면이 아니라 정보 글(뉴스·보도자료·게시판·블로그) — 웹 구조로만 본다(기관·서비스 이름을 박지 않는다) */
const INFO_PAGE_URL = /\/(?:news|press|article|articles|board|bbs|notice|blog)s?(?:[/.?]|$)|[?&](?:newsId|articleId|nttId|idxno|bbsId)=/i;
const INFO_PAGE_TITLE = /보도자료|뉴스|기사|칼럼|블로그/;

/**
 * 이 문서가 이 대상·이 행동의 공식 **행동 화면**인가.
 *   · 대상은 **제목**으로 본다(본문 앞부분은 다른 서류를 함께 말할 수 있다 — 실측: 본인서명사실확인서 화면 본문에 인감증명서가 나온다). 제목이 없을 때만 본문 앞부분.
 *   · 행동 낱말은 그 자체로 서야 한다("발급" · "발급하기" · "인감증명서 발급 신청") — "발급사실 통보" 처럼 다른 서비스 이름의 일부면 아니다.
 *   · 정보 글(뉴스·보도자료·게시판)은 행동 화면이 아니다.
 */
function fits(input: { keyword: string; title?: string | undefined; action: string; subject: string }, dest: { url: string; title?: string | undefined; text?: string | undefined }): boolean {
  const title = flat(dest.title);
  const label = title || flat(String(dest.text || '').slice(0, 300));
  if (!input.subject || !label.includes(flat(input.subject))) return false;
  if (INFO_PAGE_URL.test(String(dest.url || '')) || INFO_PAGE_TITLE.test(title)) return false;
  const action = esc(flat(input.action));
  if (!new RegExp(`${action}(?:(?![가-힣])|하기|하러|신청|접수|바로)`).test(label)) return false;
  // 글이 모델·트림을 말하면(갤럭시 S26 · EV3 롱레인지) 목적지 제목도 같은 변형이어야 한다 — 772 변형 축을 그대로 쓴다
  const anchors = anchorsFrom([input.keyword]);
  const claimMs = variantMentions(input.keyword, anchors);
  if (claimMs.length) {
    const destMs = variantMentions(String(dest.title || ''), anchors);
    if (variantRelation(scopeFromMentions(claimMs, input.keyword, 'document'), scopeFromMentions(destMs, String(dest.title || ''), 'document')) !== 'SAME') return false;
  }
  return checkCtaMatch({ keyword: input.keyword, ...(input.title ? { title: input.title } : {}), action: input.action, destination: { url: dest.url, ...(dest.title ? { title: dest.title } : {}), ...(dest.text ? { text: dest.text } : {}) } }).ok;
}

/** 후보 하나(검색 결과 제목 · 근거 문서)가 이 글의 대상·행동 화면인가 — 생존 확인을 못 한 후보를 남길지 정할 때 */
export function candidateFits(keyword: string, action: string, dest: { url: string; title?: string | undefined; text?: string | undefined }, title = ''): boolean {
  const subject = ctaSubject(keyword, title);
  return !!action && fits({ keyword, title, action, subject }, dest);
}

/**
 * 근거·본문이 이미 가진 공식 행동 화면 후보 — 대상+행동이 붙어 나오는 이름("인감증명서 발급 바로가기")이 먼저,
 * 행동 뒤에 다른 말이 붙은 것("인감증명서 발급사실 통보")은 뒤. 근거가 본문 링크보다 먼저.
 */
export function evidenceActionCandidates(input: { keyword: string; title?: string | undefined; action: string; sources: ReadonlyArray<ActionSource> }): ActionCandidate[] {
  const subject = ctaSubject(input.keyword, input.title || '');
  if (!subject || !input.action) return [];
  const exact = new RegExp(`${esc(subject)}\\s*${esc(input.action)}(?![가-힣])`);
  const out: ActionCandidate[] = [];
  for (const s of input.sources) {
    if (!s.official || !/^https?:\/\//i.test(String(s.url || ''))) continue;
    if (!fits({ keyword: input.keyword, title: input.title, action: input.action, subject }, s)) continue;
    if (out.some((c) => sameUrl(c.url, s.url))) continue;
    const via = s.via || 'evidence';
    out.push({ url: s.url, title: String(s.title || ''), via, rank: (exact.test(String(s.title || '')) ? 2 : 0) + (via === 'evidence' ? 1 : 0) });
  }
  return out.map((c, i) => ({ c, i })).sort((a, b) => b.c.rank - a.c.rank || a.i - b.i).map(({ c }) => c);
}

export interface CtaLike { url?: string | undefined; buttonText?: string | undefined; text?: string | undefined; hookingMessage?: string | undefined; hook?: string | undefined; [k: string]: unknown }
export interface CtaAuthorityChange { kind: 'REPLACED' | 'DROPPED'; from: string; to: string; reason: string }

/**
 * CTA 목적지 권위 적용. lookup 은 **정확한 주소**의 근거 문서만 돌려줘야 한다(같은 호스트의 다른 문서 제목을 빌리면 검증이 거짓이 된다).
 * relabel — 바꾼 CTA 의 문구(부르는 쪽의 기존 문구 규칙 buildCtaCopy 를 쓴다).
 */
export function enforceCtaDestination<T extends CtaLike>(input: {
  ctas: ReadonlyArray<T>; keyword: string; title?: string | undefined; action: string; required: boolean;
  candidates: ReadonlyArray<ActionCandidate>;
  lookup?: ((url: string) => { title?: string | undefined; text?: string | undefined } | undefined) | undefined;
  relabel?: ((cta: T, candidate: ActionCandidate) => T) | undefined;
}): { ctas: T[]; changes: CtaAuthorityChange[] } {
  const subject = ctaSubject(input.keyword, input.title || '');
  const changes: CtaAuthorityChange[] = [];
  const out: T[] = [];
  for (const cta of input.ctas) {
    const url = String(cta?.url || '');
    if (!url || !input.action) { out.push(cta); continue; }
    const info = input.lookup?.(url);
    const verified = input.candidates.some((c) => sameUrl(c.url, url))
      || (!!info && !!(info.title || info.text) && fits({ keyword: input.keyword, title: input.title, action: input.action, subject }, { url, ...info }));
    if (verified) { out.push(cta); continue; }
    const best = input.candidates[0];
    if (best) {
      const next = input.relabel ? input.relabel(cta, best) : ({ ...cta, url: best.url } as T);
      changes.push({ kind: 'REPLACED', from: url, to: best.url, reason: `대상·행동이 확인되지 않은 목적지 → 근거가 확인한 공식 ${input.action} 화면(${best.title.slice(0, 40)})` });
      if (!out.some((o) => sameUrl(String(o.url || ''), best.url))) out.push(next);
      continue;
    }
    if (input.required) {
      changes.push({ kind: 'DROPPED', from: url, to: '', reason: `작성자가 요구한 "${input.action}" CTA 인데 대상·행동이 맞는 확인된 목적지가 없음 — 잘못된 CTA 대신 뺀다(요구 관문이 보류)` });
      continue;
    }
    out.push(cta);
  }
  return { ctas: out, changes };
}
