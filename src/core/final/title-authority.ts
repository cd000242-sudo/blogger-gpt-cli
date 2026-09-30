/**
 * 🏷️ v3.8.770 — 최종 제목 권위(FINAL TITLE AUTHORITY). 호출 0회·결정론.
 *
 * 실측(BATCH 2 IT run a4fc1b): 제목 "갤럭시 S26 자급제 eSIM 듀얼심 지원, 4000mAh 45W 충전" — 블로그 비교표(E06)의 값이 패킷 facts → 제목으로 갔다.
 * 제목 사실 관문은 값이 근거 어딘가에 **있는지만** 봐서 통과했다. 뒤에 팩트체크(삼성 사양 URL)가 표준 4,300mAh · 정격 4,175mAh · 25W 를 줘
 * 본문·답 상자는 "4000mAh와 45W가 아니라 …" 로 고쳐졌지만, 제목은 다시 검사되지 않았다. 독자가 제일 먼저 보는 줄이 글 전체와 반대였다.
 *
 * 규칙: 의미를 바꾸는 단계가 모두 끝난 뒤, 제목을 **최종 문서(답 상자·본문·표·FAQ) + 채택된 팩트체크 문단** 과 다시 대조한다.
 *   · 수치: 같은 값이 최종 권위에서 거부 문맥("…가 아니라 · …로 알려진 · 다른 모델과 혼동")에만 있으면 CONTRADICTED.
 *          값이 아예 없고 같은 대상의 다른 값만 있으면 오래된 제목(STALE) — 이것도 CONTRADICTED.
 *   · 가능/불가: 제목 조각 끝의 "지원·가능·허용 / 불가·미지원" 이 최종 문장의 반대 극성과 부딪히면 CONTRADICTED.
 *   · 질문형 제목("…여부 · …할까 · ?")은 주장이 아니다.
 * 처리(resolveTitleAuthority): 이미 만든 제목 후보(제목 사실 관문 기록) 중 통과하는 것이 있으면 그것으로, 없으면 보류(MANUAL_REVIEW) — 새 제목을 짓지 않는다.
 */
import { isLexicalValue } from './value-boundary';

export type TitleClaimVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'UNCHECKED';
export interface TitleAuthorityClaim { claim: string; kind: 'numeric' | 'categorical'; verdict: TitleClaimVerdict; reason: string; evidence: string[] }
export interface TitleAuthorityResult { title: string; pass: boolean; claims: TitleAuthorityClaim[] }

const QUANTITY = /(\d[\d,]*(?:\.\d+)?)\s*(mAh|kWh|kW|W|km|㎞|인치|GB|TB|mm|kg|%|퍼센트|만\s*원|억\s*원|원|개월|시간|분)(?![A-Za-z])/g;
/** 단위만으로 같은 대상이라고 볼 수 있는 물리 단위(배터리 mAh · 충전 W · 거리 km …). %·원·기간은 같은 낱말이 곁에 있어야 같은 대상이다 */
const SPECIFIC_UNIT = /^(?:mAh|kWh|kW|W|km|㎞|인치|GB|TB|mm|kg)$/;
const REJECT = /아니라|아닌|아닙니다|알려진|섞여|섞인|혼동|혼재|다른\s*(?:지역|모델|제품|기종)|오래된|근거로[^.]{0,30}(?:않|말)|틀린|잘못|맞지\s*않/;
/** 같은 문장에 같은 단위의 다른 값이 함께 있을 때의 대조 표지 — "4000mAh보다 4300mAh를 기준으로" · "45W 충전기가 있더라도 기준은 25W" */
const CONTRAST = /보다|더라도|대신|구분|기준은|기준으로|않|없|아니/;
const QUESTION = /(?:여부|할까|될까|되나|인가|나요|까요|\?)\s*$/;
const POS_END = /(?:가능|지원|허용)(?:합니다|해요|됨|돼요|된다|한다)?\s*$/;
const NEG_END = /(?:불가능?|미지원|안\s*됨|제외)(?:합니다|해요|됩니다)?\s*$/;
const NEG_TEXT = /불가|불가능|할\s*수\s*없|허용되지\s*않|허용하지\s*않|지원하지\s*않|지원되지\s*않|안\s*됩니다|제외|없습니다/;
const POS_TEXT = /가능|할\s*수\s*있|지원합니다|지원한다|지원해요|지원하|허용/;
const GENERIC = new Set(['및', '또는', '그리고', '정리', '총정리', '방법', '기준', '안내', '확인', '비교', '가격', '여부']);

const unitKey = (u: string) => u.replace(/\s+/g, '').replace('퍼센트', '%').replace('㎞', 'km');
const numKey = (n: string) => Number(String(n).replace(/,/g, ''));
const sentencesOf = (text: string) => String(text || '')
  .replace(/<\/(?:td|th)\s*>/gi, ' | ')
  .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|h[1-6]|blockquote|summary|section|details|table)\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  .split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

function quantities(text: string): Array<{ num: number; unit: string; raw: string; index: number }> {
  const out: Array<{ num: number; unit: string; raw: string; index: number }> = [];
  for (const m of String(text || '').matchAll(QUANTITY)) {
    if (!isLexicalValue(text, m.index || 0, m[0])) continue;
    out.push({ num: numKey(m[1]!), unit: unitKey(m[2]!), raw: m[0], index: m.index || 0 });
  }
  return out;
}
/** 값 바로 앞의 낱말(같은 대상 판정용) — "교통비 35%" → 교통비 */
function wordBefore(text: string, index: number): string {
  const words = text.slice(Math.max(0, index - 20), index).split(/[\s,·|]+/).filter((w) => /[가-힣A-Za-z]{2,}/.test(w));
  return (words[words.length - 1] || '').replace(/(?:은|는|이|가|을|를|의)$/, '');
}

function checkNumeric(title: string, authority: string[]): TitleAuthorityClaim[] {
  const out: TitleAuthorityClaim[] = [];
  const auth = authority.map((s) => ({ s, q: quantities(s) }));
  for (const tv of quantities(title)) {
    const context = wordBefore(title, tv.index);
    const same = auth.filter((a) => a.q.some((q) => q.unit === tv.unit && q.num === tv.num));
    /**
     * 거부 표지는 **그 표지 앞의 값**에만 걸린다: "4000mAh가 아니라 4300mAh" 에서 4000mAh 만 거부, 4300mAh 는 긍정.
     * 값과 표지 사이에 같은 단위의 다른 값이 끼어 있으면 표지는 그 값의 것이다.
     */
    const rejectedHere = (a: { s: string; q: Array<{ num: number; unit: string; index: number }> }) => a.q.filter((q) => q.unit === tv.unit && q.num === tv.num).every((q) => {
      const tail = a.s.slice(q.index);
      const cue = tail.search(REJECT);
      if (cue < 0) return false;
      return !a.q.some((o) => o.unit === tv.unit && o.num !== tv.num && o.index > q.index && o.index < q.index + cue);
    });
    // 같은 단위의 다른 값과 대조되는 문장("X보다 Y를 기준으로" · "X 충전기가 있더라도 기준은 Y")도 제목 값을 지지하지 않는다 — 대조 표지가 이 값 뒤에 올 때
    const contrasted = (a: { s: string; q: Array<{ num: number; unit: string; index: number }> }) => a.q.some((o) => o.unit === tv.unit && o.num !== tv.num) && a.q.filter((q) => q.unit === tv.unit && q.num === tv.num).every((q) => CONTRAST.test(a.s.slice(q.index)));
    const affirmed = same.filter((a) => !rejectedHere(a) && !contrasted(a) && !QUESTION.test(a.s));
    const others = auth.filter((a) => a.q.some((q) => q.unit === tv.unit && q.num !== tv.num) && (SPECIFIC_UNIT.test(tv.unit) || (context && a.s.includes(context))));
    const claim = tv.raw.replace(/\s+/g, '');
    if (affirmed.length) { out.push({ claim, kind: 'numeric', verdict: 'SUPPORTED', reason: '최종 권위가 같은 값을 말함', evidence: affirmed.slice(0, 2).map((a) => a.s.slice(0, 160)) }); continue; }
    if (same.length && others.length) { out.push({ claim, kind: 'numeric', verdict: 'CONTRADICTED', reason: `최종 권위가 이 값을 거부하고 다른 값(${[...new Set(others.flatMap((a) => a.q.filter((q) => q.unit === tv.unit && q.num !== tv.num).map((q) => q.raw.replace(/\s+/g, ''))))].slice(0, 3).join('·')})을 말함`, evidence: same.slice(0, 2).map((a) => a.s.slice(0, 160)) }); continue; }
    if (!same.length && others.length) { out.push({ claim, kind: 'numeric', verdict: 'CONTRADICTED', reason: '오래된 제목 — 최종 권위에 이 값이 없고 같은 대상의 다른 값만 있음', evidence: others.slice(0, 2).map((a) => a.s.slice(0, 160)) }); continue; }
    out.push({ claim, kind: 'numeric', verdict: 'UNCHECKED', reason: '최종 권위에 같은 대상의 값이 없음(대조 불가)', evidence: [] });
  }
  return out;
}

function checkCategorical(title: string, authority: string[]): TitleAuthorityClaim[] {
  const out: TitleAuthorityClaim[] = [];
  for (const fragment of String(title || '').split(/[,·|:–—]|\s-\s/).map((f) => f.trim()).filter(Boolean)) {
    if (QUESTION.test(fragment)) continue;
    const positive = POS_END.test(fragment);
    if (!positive && !NEG_END.test(fragment)) continue;
    const body = fragment.replace(positive ? POS_END : NEG_END, '').trim();
    const keys = body.split(/\s+/).map((w) => w.replace(/(?:은|는|이|가|을|를|의|도)$/, '')).filter((w) => w.length >= 2 && !GENERIC.has(w) && !/^\d/.test(w)).slice(-3);
    if (keys.length < 2) continue;
    const about = authority.filter((s) => keys.every((k) => s.toLowerCase().includes(k.toLowerCase())) && !QUESTION.test(s));
    const same = about.filter((s) => (positive ? POS_TEXT.test(s) && !NEG_TEXT.test(s) : NEG_TEXT.test(s)));
    const opposite = about.filter((s) => (positive ? NEG_TEXT.test(s) : POS_TEXT.test(s) && !NEG_TEXT.test(s)));
    const claim = fragment;
    if (opposite.length && !same.length) out.push({ claim, kind: 'categorical', verdict: 'CONTRADICTED', reason: `최종 권위가 반대로 말함(${positive ? '불가' : '가능'})`, evidence: opposite.slice(0, 2).map((s) => s.slice(0, 160)) });
    else if (same.length) out.push({ claim, kind: 'categorical', verdict: 'SUPPORTED', reason: '최종 권위가 같은 극성으로 말함', evidence: same.slice(0, 2).map((s) => s.slice(0, 160)) });
    else out.push({ claim, kind: 'categorical', verdict: 'UNCHECKED', reason: '최종 권위에 같은 대상 문장이 없음', evidence: [] });
  }
  return out;
}

/**
 * 제목을 최종 권위와 대조한다.
 * @param finalDocument 독자가 보는 최종 HTML(답 상자·본문·표·FAQ). 제목 줄(h1)과 script·style 은 여기서 뺀다
 * @param factcheck 채택된 팩트체크 문단(주소·원문·주제 범위 통과) — 본문이 말하지 않은 공식값도 권위다
 */
export function checkTitleAuthority(title: string, finalDocument: string, factcheck: ReadonlyArray<string> = []): TitleAuthorityResult {
  const t = String(title || '').trim();
  const doc = String(finalDocument || '')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    // 제목 줄·소제목·목차 버튼은 이름표지 사실 진술이 아니다(live a4fc1b: 소제목 "4000mAh 45W 충전 성능" 이 제목 값을 지지하는 것처럼 세졌다)
    .replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<a\b[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ')
    .split(t).join(' ');
  const authority = [...sentencesOf(doc), ...factcheck.flatMap((f) => sentencesOf(f))];
  const claims = [...checkNumeric(t, authority), ...checkCategorical(t, authority)];
  return { title: t, pass: !claims.some((c) => c.verdict === 'CONTRADICTED'), claims };
}

/**
 * 모순이면 이미 만든 후보(제목 사실 관문 기록 등) 중 통과하는 첫 제목으로 바꾼다. 없으면 그대로 두고 pass=false(보류).
 * 새 제목을 짓지 않는다.
 */
export function resolveTitleAuthority(title: string, candidates: ReadonlyArray<string>, finalDocument: string, factcheck: ReadonlyArray<string> = []): { title: string; replaced: boolean; result: TitleAuthorityResult; tried: TitleAuthorityResult[] } {
  const result = checkTitleAuthority(title, finalDocument, factcheck);
  if (result.pass) return { title: result.title, replaced: false, result, tried: [] };
  const tried: TitleAuthorityResult[] = [];
  for (const c of [...new Set(candidates.map((x) => String(x || '').trim()))].filter((x) => x && x !== result.title)) {
    const r = checkTitleAuthority(c, finalDocument, factcheck);
    tried.push(r);
    if (r.pass) return { title: c, replaced: true, result: r, tried };
  }
  return { title: result.title, replaced: false, result, tried };
}
