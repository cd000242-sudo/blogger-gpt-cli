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
import { propertyRelation } from './claim-property';
import { anchorsFrom, labelsOf, scopeHtml, scopePlain, scopeFromMentions, variantRelation, variantMentions, NO_SCOPE, type Anchors, type ScopedUnit, type VariantScope } from './claim-variant';
import { claimKey } from './variant-ledger';

export type TitleClaimVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'UNCHECKED';
/** variant — 주장 값이 묶인 모델·트림(v3.8.772). variantExcluded — 같은 값이지만 다른·모호한 변형이라 지지로 세지 않은 권위 문장 */
export interface TitleAuthorityClaim { claim: string; kind: 'numeric' | 'categorical'; verdict: TitleClaimVerdict; reason: string; evidence: string[]; variant?: string; variantExcluded?: string[] }
export interface TitleAuthorityResult { title: string; pass: boolean; claims: TitleAuthorityClaim[] }

const QUANTITY = /(\d[\d,]*(?:\.\d+)?)\s*(mAh|kWh|kW|W|km|㎞|인치|GB|TB|mm|kg|%|퍼센트|만\s*원|억\s*원|원|개월|시간|분)(?![A-Za-z])/g;
/**
 * 단위만으로 속성이 정해지는 단위(mAh = 용량 · 인치 = 화면 · GB/TB = 저장 …). 곁 낱말이 없어도(UNKNOWN) 같은 속성으로 본다.
 * v3.8.771 — W·kW·km·kWh 는 뺐다: 충전기 출력 vs 기기 입력 · 충전기 350kW vs 차량 수용 180kW 처럼 같은 단위가 여러 속성을 뜻한다(live a4fc1b 45W).
 */
const UNIT_NAMES_PROPERTY = /^(?:mAh|인치|GB|TB|mm|kg)$/;
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
function checkNumeric(line: ScopedUnit, authority: ReadonlyArray<ScopedUnit>): TitleAuthorityClaim[] {
  const out: TitleAuthorityClaim[] = [];
  /**
   * v3.8.771 — 값은 대상·속성과 함께 비교한다(claim-property). 같은 값이어도 다른 항목(충전기 45W ≠ 기기 충전 45W)이면 지지도 모순도 아니다.
   * 속성 창이 겹치면 같은 주장(SAME). 한쪽 창이 비면(UNKNOWN) 단위만으로 속성이 정해지는 물리 단위(mAh·W·km …)일 때만 같은 주장으로 본다.
   * v3.8.772 — 모델·트림·유형(claim-variant)도 맞아야 같은 주장이다. S26+ 의 69% 는 S26 의 69% 가 아니다 — 다른 변형(DIFFERENT)·모호(AMBIGUOUS)는 지지도 모순도 아니다.
   */
  // v3.8.773 — 주장 신원은 본문 검증 장부와 같은 함수(variant-ledger claimKey): 변형 + 속성 창(표 칸은 행·열 머리)
  const withProp = (u: ScopedUnit) => quantities(u.s).map((q) => { const k = claimKey(u, q.index, q.raw.length); return { ...q, prop: k.property, variant: k.variant }; });
  const auth = authority.map((u) => ({ s: u.s, q: withProp(u), prose: u.scope.via === 'prose' }));
  for (const tv of withProp(line)) {
    const propBound = (q: { prop: string[] }) => { const r = propertyRelation(tv.prop, q.prop); return r === 'SAME' || (r === 'UNKNOWN' && UNIT_NAMES_PROPERTY.test(tv.unit)); };
    const variantOk = (q: { variant: VariantScope }) => { const r = variantRelation(tv.variant, q.variant); return r !== 'DIFFERENT' && r !== 'AMBIGUOUS'; };
    const bound = (q: { prop: string[]; variant: VariantScope }) => variantOk(q) && propBound(q);
    const excluded = auth.flatMap((a) => a.q.filter((q) => q.unit === tv.unit && q.num === tv.num && propBound(q) && !variantOk(q)).slice(0, 1).map((q) => `${a.s.slice(0, 120)} ⟨${q.variant.via === 'ambiguous' ? `모호: ${q.variant.label}` : q.variant.label}⟩`)).slice(0, 3);
    const scoped = tv.variant.keys.length ? { variant: tv.variant.label, ...(excluded.length ? { variantExcluded: excluded } : {}) } : {};
    const same = auth.map((a) => ({ ...a, q: a.q.filter((q) => q.unit !== tv.unit || q.num !== tv.num || bound(q)) })).filter((a) => a.q.some((q) => q.unit === tv.unit && q.num === tv.num));
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
    const others = auth.filter((a) => a.q.some((q) => q.unit === tv.unit && q.num !== tv.num && bound(q)));
    const claim = tv.raw.replace(/\s+/g, '');
    if (affirmed.length) { out.push({ claim, kind: 'numeric', verdict: 'SUPPORTED', reason: '최종 권위가 같은 값을 말함', evidence: affirmed.slice(0, 2).map((a) => a.s.slice(0, 160)), ...scoped }); continue; }
    if (same.length && others.length) { out.push({ claim, kind: 'numeric', verdict: 'CONTRADICTED', reason: `최종 권위가 이 값을 거부하고 다른 값(${[...new Set(others.flatMap((a) => a.q.filter((q) => q.unit === tv.unit && q.num !== tv.num && bound(q)).map((q) => q.raw.replace(/\s+/g, ''))))].slice(0, 3).join('·')})을 말함`, evidence: same.slice(0, 2).map((a) => a.s.slice(0, 160)), ...scoped }); continue; }
    if (!same.length && others.length) { out.push({ claim, kind: 'numeric', verdict: 'CONTRADICTED', reason: '오래된 제목 — 최종 권위에 이 값이 없고 같은 대상의 다른 값만 있음', evidence: others.slice(0, 2).map((a) => a.s.slice(0, 160)), ...scoped }); continue; }
    /**
     * v3.8.773 — LLM 서술(팩트체크 문단)은 모델이 붙은 주장을 **지지하지** 못한다. 그러나 본문이 판정하지 못한 값을 서술이 거부 문맥
     * ("…로 표기하는 자료는 혼동")으로 말하면 보류 쪽 신호로 남긴다 — 거짓 통과를 만들지 않는 방향이라 모델 범위 확인 없이도 쓴다(770 T16).
     */
    const proseRejects = tv.variant.keys.length ? auth.filter((a) => a.prose && a.q.some((q) => q.unit === tv.unit && q.num === tv.num && propBound(q)) && rejectedHere(a)) : [];
    if (proseRejects.length) { out.push({ claim, kind: 'numeric', verdict: 'CONTRADICTED', reason: '팩트체크 서술이 이 값을 거부함(원문 모델 범위는 미확인)', evidence: proseRejects.slice(0, 2).map((a) => a.s.slice(0, 160)), ...scoped }); continue; }
    out.push({ claim, kind: 'numeric', verdict: 'UNCHECKED', reason: excluded.length ? '최종 권위의 같은 값은 다른 모델·트림(또는 모호한 범위)의 값 — 대조 불가' : '최종 권위에 같은 대상의 값이 없음(대조 불가)', evidence: [], ...scoped });
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
  // v3.8.772 — 제목이 곧 문서 이름표(PAGE ENTITY): 제목에 모델이 하나면 이름 없는 본문 문장은 그 모델의 문장이다
  const ctx = authorityContext(finalDocument, factcheck, { pageTitle: t, claimLines: [t], exclude: [t] });
  const claims = authorityClaims(t, ctx.units, { anchors: ctx.anchors });
  return { title: t, pass: !claims.some((c) => c.verdict === 'CONTRADICTED'), claims };
}

/**
 * 🧬 v3.8.772 — 범위 붙은 최종 권위: 최종 HTML(소제목·표 열 머리·각주·목록 머리로 변형을 정함) + 채택 팩트체크 문단(문단 안 언급·각주로 정함, 주소는 보지 않음).
 * pageTitle 이 없으면 HTML 의 h1. claimLines(제목·소제목)의 코드 모양은 모델 이름으로 본다.
 */
export function authorityContext(finalDocument: string, factcheck: ReadonlyArray<string> = [], opts: { pageTitle?: string | undefined; claimLines?: ReadonlyArray<string>; exclude?: ReadonlyArray<string> | undefined } = {}): { units: ScopedUnit[]; anchors: Anchors; docScope: VariantScope } {
  const doc = String(finalDocument || '')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<a\b[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ');
  const pageTitle = opts.pageTitle !== undefined ? opts.pageTitle : ((doc.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const anchors = anchorsFrom([...(opts.claimLines || []), pageTitle].filter(Boolean), labelsOf(doc));
  // v3.8.773 — 채택 팩트체크 문단은 LLM 서술: 모델이 붙은 주장에는 지지도 모순도 아니다(본문 검증 장부와 같은 규칙)
  const units = [...scopeHtml(doc, { pageTitle, anchors, exclude: opts.exclude }), ...factcheck.flatMap((f) => scopePlain(f, { anchors, prose: true }))];
  return { units, anchors, docScope: scopeFromMentions(variantMentions(pageTitle, anchors), pageTitle, 'document') };
}

/**
 * 최종 권위 문장 — 독자가 보는 진술(답 상자·본문·표·FAQ) + 채택 팩트체크 문단.
 * 제목 줄·소제목·목차 버튼은 이름표지 사실 진술이 아니다(live a4fc1b: 소제목 "4000mAh 45W 충전 성능" 이 제목 값을 지지하는 것처럼 세졌다).
 */
export function authoritySentences(finalDocument: string, factcheck: ReadonlyArray<string> = [], exclude: ReadonlyArray<string> = []): string[] {
  let doc = String(finalDocument || '')
    .replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<h[1-6]\b[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<a\b[^>]*class="[^"]*toc[^"]*"[^>]*>[\s\S]*?<\/a>/gi, ' ');
  for (const x of exclude) if (x) doc = doc.split(x).join(' ');
  return [...sentencesOf(doc), ...factcheck.flatMap((f) => sentencesOf(f))];
}

/**
 * 한 줄(제목·소제목)의 수치·가능/불가 주장을 최종 권위와 대조.
 * v3.8.772 — authority 가 범위 붙은 문장(authorityContext)이면 모델 축까지 본다. 문자열이면 범위 없음(예전 동작).
 * docScope — 줄 안에 모델 이름이 없을 때 줄이 따르는 범위(소제목은 제목의 모델).
 */
export function authorityClaims(line: string, authority: ReadonlyArray<string | ScopedUnit>, opts: { anchors?: Anchors; docScope?: VariantScope } = {}): TitleAuthorityClaim[] {
  const units: ScopedUnit[] = authority.map((a) => (typeof a === 'string' ? { s: a, scope: NO_SCOPE, mentions: [] } : a));
  const lineUnit: ScopedUnit = { s: line, scope: opts.docScope || NO_SCOPE, mentions: opts.anchors ? variantMentions(line, opts.anchors) : [] };
  return [...checkNumeric(lineUnit, units), ...checkCategorical(line, units.map((u) => u.s))];
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
