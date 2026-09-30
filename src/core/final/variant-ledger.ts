/**
 * 🧾 v3.8.773 — 모델·트림 범위를 **본문 검증 장부**에도 똑같이(VARIANT LEDGER PARITY). 호출 0회·결정론.
 *
 * 772 는 제목·소제목만 모델 축으로 쟀다. 본문 사실 필터와 본문 관문(checkClaims)은 "근거 어딘가에 69% 가 있다" 로 통과시켰고,
 * 팩트체크 요약이 스스로 "갤럭시 S26은 30분 69%" 라고 쓰면 그 모델 이름을 그대로 믿었다(live f91a10).
 *
 * 규칙 — 한 값 주장의 신원(claim key) = 변형(claim-variant) + 속성 창(claim-property) + 값·단위. 제목·소제목·본문 필터·본문 관문이 같은 함수를 쓴다.
 *   · 모델 근거는 **수집한 원문**(E번호 — 페이지 제목·각주·표·문장이 정한 범위)만. 팩트체크 요약·연구 패킷은 LLM 서술이라
 *     모델이 붙은 주장에는 지지도 모순도 아니다(원문 범위를 확인할 수 없음). 모델 없는 주장에는 예전처럼 값 근거다.
 *   · 판정(모델이 붙은 주장만): SUPPORTED(같은 변형) · CONTRADICTED(같은 변형·같은 속성에 다른 값) · VARIANT_MISMATCH(다른 변형에만 있음)
 *     · UNKNOWN(모호한 시리즈 문맥·LLM 서술에만 있음). 원문이 모델을 전혀 말하지 않으면(범위 없음) 예전처럼 값 존재로 지지한다.
 *   · 사실 필터와 본문 관문은 **같은 판정을 같은 뜻으로** 쓴다 — SUPPORTED 가 아니면 둘 다 "근거 없음"(한 단계는 통과·다른 단계는 실패가 없다).
 *   · 속성 창이 다른 발생(충전기 45W ↔ 기기 45W)은 이 값의 근거로 세지 않는다. 동의어 사전은 없다 — 속성이 달라 보이는 것만으로 실패시키지는 않는다.
 *   · 주소 안의 모델 이름은 보지 않는다(보조 신호로도 쓰지 않는다).
 */
import { propertyWindow, propertyWords, propertyRelation } from './claim-property';
import { anchorsFrom, scopeHtml, scopePlain, scopeFromMentions, valueScope, variantMentions, variantRelation, type Anchors, type ScopedUnit, type VariantScope } from './claim-variant';
import { unitClass, type UnitClass } from './spec-units';

export interface ClaimKey { variant: VariantScope; property: string[] }
/**
 * v3.8.774 — PROPERTY_MISMATCH(같은 숫자가 다른 속성에만: 충전기 45W ↔ 기기 45W) · UNRESOLVED(서드파티만 말하고 당사자 1차 후보는 원문 없음 — 지우지 않되 자동 발행 근거 아님)
 * · NOT_FOUND(장부 원문에 값 없음 — 호출부가 값 존재로 판정)
 */
export type VariantVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'VARIANT_MISMATCH' | 'PROPERTY_MISMATCH' | 'UNKNOWN' | 'UNRESOLVED' | 'NOT_FOUND' | 'NOT_APPLICABLE';
/** authority — 판정을 정한 원문의 권위(PRIMARY = 당사자 1차·공적 기관 · SECONDARY = 서드파티) */
export interface VariantJudgement { claim: string; sentence: string; variant: string; verdict: VariantVerdict; sourceIds: string[]; reason: string; authority?: 'PRIMARY' | 'SECONDARY' }
export type SourceKind = 'SOURCE' | 'PROSE';
export interface LedgerSource { id: string; kind: SourceKind; scope: VariantScope; units: ScopedUnit[]; authority?: string | undefined; hasBody?: boolean | undefined }
export interface VariantLedger { anchors: Anchors; docScope: VariantScope; sources: LedgerSource[] }
const PRIMARY = new Set(['SUBJECT_OWNER_PRIMARY', 'PUBLIC_AUTHORITY_OFFICIAL']);

/**
 * 값 하나의 주장 신원 — 변형(같은 절 → 각주 → 열 → 행 → 소제목 → 문서)과 속성 창.
 * 표 칸 값 곁에 낱말이 없으면 그 칸의 행·열 머리가 속성이다("30분 충전 | 55% | 69%").
 */
export function claimKey(u: ScopedUnit, index: number, length: number): ClaimKey {
  let property = propertyWindow(u.s, index, length);
  if (!property.length && u.cells && u.cellLabels) {
    const cell = u.cells.findIndex((c) => index >= c.start && index < c.end);
    if (cell > 0) property = propertyWords(u.cellLabels[cell] || '');
  }
  return { variant: valueScope(u, index), property };
}

const flat = (s: string) => s.replace(/[\s,]/g, '').replace(/퍼센트/g, '%');
/** 값("55%" · "30만원" · "4,300mAh")이 글의 어디에 **그 값으로** 있는지 — 수가 같고 뒤 단위가 같으며 단위 뒤에 라틴 글자가 붙지 않은 자리 */
export function findValue(text: string, value: string): Array<{ index: number; length: number }> {
  const m = flat(value).match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return [];
  const [, num, unit] = m as unknown as [string, string, string];
  const out: Array<{ index: number; length: number }> = [];
  for (const n of String(text || '').matchAll(/(?<![\d.,])\d[\d,]*(?:\.\d+)?/g)) {
    if (n[0].replace(/,/g, '') !== num) continue;
    const at = (n.index || 0) + n[0].length;
    const tail = text.slice(at, at + unit.length + 6);
    let consumed = 0; let got = '';
    while (consumed < tail.length && got.length < unit.length) { const ch = tail[consumed]!; if (!/[\s,]/.test(ch)) got += ch; consumed += 1; }
    if (flat(got) !== unit || /^[A-Za-z]/.test(tail.slice(consumed))) continue;
    out.push({ index: n.index || 0, length: n[0].length + consumed });
  }
  return out;
}

/**
 * 검증 장부 — 원문(E번호, 페이지 제목이 문서 범위) + LLM 서술(팩트체크 문단·패킷, 모델 권위 없음).
 * title 은 글 제목(모델 이름의 닻), headings 는 글 소제목.
 */
export function buildVariantLedger(input: { title: string; headings?: ReadonlyArray<string>; sources: ReadonlyArray<{ id: string; title?: string; text: string; html?: string; authority?: string | undefined; hasBody?: boolean | undefined }>; prose?: ReadonlyArray<{ id: string; text: string }> }): VariantLedger {
  // v3.8.774 — 원문의 페이지 제목에 있는 코드는 그 페이지가 다루는 모델 이름이다("Y30 사양") — 주장 줄처럼 닻으로 쓴다
  const anchors = anchorsFrom([input.title, ...(input.headings || []), ...input.sources.map((s) => s.title || '').filter(Boolean)]);
  const docScope = scopeFromMentions(variantMentions(input.title, anchors), input.title, 'document');
  // html — 표·각주 관계를 이미 가진 원문만(있는 관계만 쓴다). 수집 원문은 평문(cleanedText)이라 문장·각주 표지·페이지 제목까지만 본다
  const unitsOf = (s: { title?: string; text: string; html?: string }) => (s.html ? scopeHtml(s.html, { pageTitle: s.title || '', anchors }) : scopePlain(s.text, { pageTitle: s.title || '', anchors }));
  return {
    anchors, docScope,
    sources: [
      // authority·hasBody — 기존 근거 판정(source-authority · 본문 확인 여부)을 그대로 싣는다
      ...input.sources.map((s) => { const units = unitsOf(s); return { id: s.id, kind: 'SOURCE' as const, scope: units[0]?.scope || docScope, units, authority: s.authority, hasBody: s.hasBody }; }),
      ...(input.prose || []).map((p) => ({ id: p.id, kind: 'PROSE' as const, scope: { keys: [], via: 'prose' as const, label: 'LLM 서술' }, units: scopePlain(p.text, { anchors, prose: true }) })),
    ],
  };
}

/** 본문 한 문장 → 범위 붙은 단위. scope 는 그 문장이 속한 절(소제목)의 범위, 없으면 글 제목의 범위 */
export function sentenceUnit(ledger: VariantLedger, sentence: string, scope?: VariantScope): ScopedUnit {
  return { s: sentence, scope: scope || ledger.docScope, mentions: variantMentions(sentence, ledger.anchors) };
}
/** 소제목들(가까운 것부터) 중 모델 이름이 있는 첫 것의 범위, 없으면 글 제목의 범위 */
export function sectionScope(ledger: VariantLedger, ...headings: ReadonlyArray<string | undefined>): VariantScope {
  for (const h of headings) { const ms = variantMentions(String(h || ''), ledger.anchors); if (ms.length) return scopeFromMentions(ms, String(h), 'heading'); }
  return ledger.docScope;
}
/** 최종 HTML → 범위 붙은 본문 단위(본문 관문용) */
export function bodyUnits(ledger: VariantLedger, html: string, title: string): ScopedUnit[] {
  // 제목 글자를 본문 문장에서 걷지 않는다(v3.8.774) — "EV9 스탠다드 주행거리는 501km" 처럼 제목을 품은 문장의 모델·속성 낱말이 지워졌다. 제목 줄(h1)은 원래 단위가 아니다
  return scopeHtml(String(html || '').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' '), { pageTitle: title, anchors: ledger.anchors });
}

/** 같은 단위의 다른 값들(모순 후보) */
function otherValues(s: string, value: string): Array<{ index: number; length: number; raw: string }> {
  const unit = (flat(value).match(/^\d+(?:\.\d+)?(.*)$/) || [])[1];
  if (!unit) return [];
  const out: Array<{ index: number; length: number; raw: string }> = [];
  for (const n of s.matchAll(/(?<![\d.,])\d[\d,]*(?:\.\d+)?/g)) {
    const candidate = `${n[0].replace(/,/g, '')}${unit}`;
    if (candidate === flat(value)) continue;
    const hit = findValue(s.slice(n.index || 0), candidate)[0];
    if (hit && hit.index === 0) out.push({ index: n.index || 0, length: hit.length, raw: s.slice(n.index || 0, (n.index || 0) + hit.length) });
  }
  return out;
}

/** 양쪽 모두 상대에게 없는 한정 낱말을 가지면(복합 ↔ 고속도로 · 표준 ↔ 정격) 같은 주장이라 단정하지 않는다 */
export function qualifierConflict(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  return a.some((w) => !b.includes(w)) && b.some((w) => !a.includes(w));
}
/**
 * 같은 값 발생이 이 주장의 근거로 맞는가 — FIT(맞음) · UNCERTAIN(창은 겹치지만 양쪽에 서로 없는 한정어: "도심 주행거리 501km" ↔ "복합 인증 주행거리 501km") · OTHER(다른 항목).
 * PROPERTY 단위(mAh …)는 단위가 속성이라 FIT. LEGACY 는 예전처럼 창이 다를 때만 OTHER. CONTEXT(W·km …)만 한정어를 본다.
 */
export function propertyFit(cls: UnitClass, a: ReadonlyArray<string>, b: ReadonlyArray<string>): 'FIT' | 'UNCERTAIN' | 'OTHER' {
  if (cls === 'PROPERTY') return 'FIT';
  if (propertyRelation([...a], [...b]) === 'DIFFERENT') return 'OTHER';
  return cls === 'CONTEXT' && qualifierConflict(a, b) ? 'UNCERTAIN' : 'FIT';
}
/** 모순을 말할 수 있는 같은 속성 — PROPERTY 는 한정어 충돌만 없으면, 그 밖은 창이 같고 한정어 충돌이 없을 때 */
export function propertyContradicts(cls: UnitClass, a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (qualifierConflict(a, b)) return false;
  return cls === 'PROPERTY' || propertyRelation([...a], [...b]) === 'SAME';
}

interface Hit { id: string; rel: string; primary: boolean }
/** 장부의 같은 값 발생(변형 관계로 분류)과 같은 변형·같은 속성의 다른 값(모순 후보) */
function collect(ledger: VariantLedger, claim: ClaimKey, value: string, cls: UnitClass): { hits: Hit[]; contra: Array<{ id: string; raw: string; primary: boolean }> } {
  const hits: Hit[] = [];
  const contra: Array<{ id: string; raw: string; primary: boolean }> = [];
  for (const src of ledger.sources) {
    const primary = PRIMARY.has(String(src.authority || ''));
    for (const u of src.units) {
      for (const f of findValue(u.s, value)) {
        // LLM 서술은 모델이 붙은 주장을 지지하지 못한다 — 속성과 관계없이 모호(어미 차이로 "장부에 없음" 으로 새지 않게)
        if (src.kind === 'PROSE') { hits.push({ id: src.id, rel: 'AMBIGUOUS', primary: false }); continue; }
        const k = claimKey(u, f.index, f.length);
        const rel = variantRelation(claim.variant, k.variant);
        const fit = rel === 'SAME' || rel === 'UNKNOWN' ? propertyFit(cls, claim.property, k.property) : 'FIT';
        hits.push({ id: src.id, rel: fit === 'OTHER' ? `${rel}_OTHER_PROP` : fit === 'UNCERTAIN' ? 'QUALIFIER' : rel, primary });
      }
      if (src.kind !== 'SOURCE') continue;
      for (const o of otherValues(u.s, value)) {
        const k = claimKey(u, o.index, o.length);
        if (variantRelation(claim.variant, k.variant) === 'SAME' && propertyContradicts(cls, claim.property, k.property)) contra.push({ id: src.id, raw: o.raw.replace(/\s+/g, ''), primary });
      }
    }
  }
  return { hits, contra };
}

/**
 * 본문 한 단위 안의 값 하나를 장부와 대조.
 * 순서: 1차(당사자·공적 기관) 원문 지지 → 1차 원문 모순(서드파티 지지보다 우선, LOWER_AUTHORITY) → 서드파티 지지(사양값인데 당사자 후보가 원문 없이만 있으면 UNRESOLVED)
 *       → 범위 없는 원문의 값(예전 동작) → 한정어가 다른 같은 값(UNRESOLVED) → 다른 속성의 같은 숫자(사양값은 PROPERTY_MISMATCH, 그 밖은 예전 동작)
 *       → 다른 변형 → 모호 → 없음.
 * 모순은 **1차 원문만** 말할 수 있다(§3 authoritative). 서드파티끼리 다른 값은 모순이 아니다 — 실측(BATCH 1 자동차): 블로그·뉴스 수십 건의
 * "가격·보조금" 창이 겹쳐 맞는 721만 원이 모순으로 지워질 뻔했다(773 회귀).
 */
export function judgeVariantValue(ledger: VariantLedger, unit: ScopedUnit, value: string): VariantJudgement {
  const base = { claim: value, sentence: unit.s.slice(0, 160) };
  const at = findValue(unit.s, value)[0];
  if (!at) return { ...base, variant: '', verdict: 'NOT_APPLICABLE', sourceIds: [], reason: '문장에서 값 자리를 못 찾음' };
  const claim = claimKey(unit, at.index, at.length);
  if (!claim.variant.keys.length) return { ...base, variant: '', verdict: 'NOT_APPLICABLE', sourceIds: [], reason: '주장에 모델·트림 범위 없음 — 값 존재로 판정(예전 동작)' };
  const cls = unitClass((flat(value).match(/^\d+(?:\.\d+)?(.*)$/) || [])[1] || '');
  const { hits, contra } = collect(ledger, claim, value, cls);
  const r = (verdict: VariantVerdict, sourceIds: string[], reason: string, authority?: 'PRIMARY' | 'SECONDARY'): VariantJudgement => ({ ...base, variant: claim.variant.label, verdict, sourceIds, reason, ...(authority ? { authority } : {}) });
  const ids = (xs: ReadonlyArray<{ id: string }>) => [...new Set(xs.map((x) => x.id))];
  const rel = (name: string) => hits.filter((h) => h.rel === name);
  const others = (xs: ReadonlyArray<{ raw: string }>) => [...new Set(xs.map((c) => c.raw))].slice(0, 3).join('·');
  const same = rel('SAME');
  if (same.some((h) => h.primary)) return r('SUPPORTED', ids(same.filter((h) => h.primary)), '당사자·공식 원문이 같은 모델·트림의 값으로 말함', 'PRIMARY');
  const primaryContra = contra.filter((c) => c.primary);
  if (primaryContra.length) return r('CONTRADICTED', ids(primaryContra), `당사자·공식 원문의 같은 모델·같은 속성 값은 ${others(primaryContra)}${same.length ? ` — 서드파티(${ids(same).join(',')})의 값은 낮은 권위(LOWER_AUTHORITY)` : ''}`, 'PRIMARY');
  if (same.length) {
    const ownerUnfetched = cls !== 'LEGACY' && ledger.sources.some((s) => s.kind === 'SOURCE' && s.authority === 'SUBJECT_OWNER_PRIMARY' && s.hasBody === false);
    if (ownerUnfetched) return r('UNRESOLVED', ids(same), '사양값을 서드파티만 말하고 당사자 1차 후보는 원문을 확인하지 못함 — 지우지 않되 자동 발행 근거로 쓰지 않음', 'SECONDARY');
    return r('SUPPORTED', ids(same), '원문이 같은 모델·트림의 값으로 말함', 'SECONDARY');
  }
  if (rel('UNKNOWN').length) return r('SUPPORTED', ids(rel('UNKNOWN')), '원문이 모델을 말하지 않음 — 값 존재로 지지(예전 동작)');
  if (rel('QUALIFIER').length) return r('UNRESOLVED', ids(rel('QUALIFIER')), '같은 값이 한정어가 다른 문맥에만 있음(예: 복합 ↔ 도심) — 같은 주장인지 확인 불가, 지우지 않되 자동 발행 근거로 쓰지 않음');
  const otherProp = [...rel('SAME_OTHER_PROP'), ...rel('UNKNOWN_OTHER_PROP')];
  if (otherProp.length && cls === 'LEGACY') return r('NOT_APPLICABLE', ids(otherProp), '같은 값이 다른 속성 창에 있음 — 동의어일 수 있어 값 대조(예전 동작)가 판정');
  const auth = (xs: ReadonlyArray<Hit>) => (xs.some((h) => h.primary) ? 'PRIMARY' as const : 'SECONDARY' as const);
  if (otherProp.length) return r('PROPERTY_MISMATCH', ids(otherProp), '같은 숫자가 다른 항목(속성)의 값으로만 있음 — 예: 충전기 출력 ↔ 기기 충전', auth(otherProp));
  if (rel('DIFFERENT').length) return r('VARIANT_MISMATCH', ids(rel('DIFFERENT')), '원문에서 이 값은 다른 모델·트림의 값', auth(rel('DIFFERENT')));
  if (rel('AMBIGUOUS').length) return r('UNKNOWN', ids(rel('AMBIGUOUS')), '시리즈 문맥·LLM 서술에만 있음 — 원문이 모델을 정하지 않음');
  return r('NOT_FOUND', [], '장부 원문에 이 값이 없음 — 호출부가 값 존재로 판정');
}

/**
 * v3.8.774 — 판정은 사실 필터와 본문 관문이 공유하고, **행동**만 권위로 나눈다(되돌릴 수 없는 삭제는 권위 있는 근거가 있을 때만).
 *   · variantDeletes(사실 필터가 지움): 1차 원문의 모순 · 1차 원문이 다른 모델·다른 항목의 값이라고 말함.
 *   · variantHolds(본문 관문이 보류 — 자동 발행 근거 아님): 지지가 아닌 모든 판정(모순·다른 모델·다른 항목·모호·UNRESOLVED).
 * 773 은 서드파티·모호한 근거만으로도 지웠다 — 실측(a4fc1b)에서 맞는 S26 4300mAh·25W·55% 가 블로그 E06 때문에 지워질 뻔했다.
 */
export const variantDeletes = (j: VariantJudgement): boolean => j.verdict === 'CONTRADICTED'
  || ((j.verdict === 'VARIANT_MISMATCH' || j.verdict === 'PROPERTY_MISMATCH') && j.authority === 'PRIMARY');
export const variantHolds = (j: VariantJudgement): boolean => ['CONTRADICTED', 'VARIANT_MISMATCH', 'PROPERTY_MISMATCH', 'UNKNOWN', 'UNRESOLVED'].includes(j.verdict);
/** 판정을 건너뛸 것 — 모델 없는 주장 · 장부에 없는 값(값 존재로 판정) */
export const variantSkips = (j: VariantJudgement) => j.verdict === 'NOT_APPLICABLE' || j.verdict === 'NOT_FOUND';
