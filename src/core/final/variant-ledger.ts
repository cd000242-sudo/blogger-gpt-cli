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

export interface ClaimKey { variant: VariantScope; property: string[] }
export type VariantVerdict = 'SUPPORTED' | 'CONTRADICTED' | 'VARIANT_MISMATCH' | 'UNKNOWN' | 'NOT_APPLICABLE';
export interface VariantJudgement { claim: string; sentence: string; variant: string; verdict: VariantVerdict; sourceIds: string[]; reason: string }
export interface VariantLedger { anchors: Anchors; docScope: VariantScope; sources: Array<{ id: string; kind: 'SOURCE' | 'PROSE'; scope: VariantScope; units: ScopedUnit[] }> }

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
export function buildVariantLedger(input: { title: string; headings?: ReadonlyArray<string>; sources: ReadonlyArray<{ id: string; title?: string; text: string; html?: string }>; prose?: ReadonlyArray<{ id: string; text: string }> }): VariantLedger {
  const anchors = anchorsFrom([input.title, ...(input.headings || [])], input.sources.map((s) => s.title || '').filter(Boolean));
  const docScope = scopeFromMentions(variantMentions(input.title, anchors), input.title, 'document');
  // html — 표·각주 관계를 이미 가진 원문만(있는 관계만 쓴다). 수집 원문은 평문(cleanedText)이라 문장·각주 표지·페이지 제목까지만 본다
  const unitsOf = (s: { title?: string; text: string; html?: string }) => (s.html ? scopeHtml(s.html, { pageTitle: s.title || '', anchors }) : scopePlain(s.text, { pageTitle: s.title || '', anchors }));
  return {
    anchors, docScope,
    sources: [
      ...input.sources.map((s) => { const units = unitsOf(s); return { id: s.id, kind: 'SOURCE' as const, scope: units[0]?.scope || docScope, units }; }),
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
  return scopeHtml(String(html || '').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, ' '), { pageTitle: title, anchors: ledger.anchors, exclude: [title] });
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

/** 본문 한 단위 안의 값 하나를 장부와 대조 */
export function judgeVariantValue(ledger: VariantLedger, unit: ScopedUnit, value: string): VariantJudgement {
  const base = { claim: value, sentence: unit.s.slice(0, 160) };
  const at = findValue(unit.s, value)[0];
  if (!at) return { ...base, variant: '', verdict: 'NOT_APPLICABLE', sourceIds: [], reason: '문장에서 값 자리를 못 찾음' };
  const claim = claimKey(unit, at.index, at.length);
  if (!claim.variant.keys.length) return { ...base, variant: '', verdict: 'NOT_APPLICABLE', sourceIds: [], reason: '주장에 모델·트림 범위 없음 — 값 존재로 판정(예전 동작)' };
  const variant = claim.variant.label;
  /**
   * 발생 분류 — 속성 창은 **같은 변형 안에서** 지지·모순을 가를 때만 쓴다. 다른 변형·모호한 문맥의 발생은 속성과 관계없이 그대로 센다
   * (속성 창은 어미 차이 "충전된다고 ↔ 충전" 로도 갈려, 걸러 버리면 S26+ 의 69% 가 "장부에 없음 → 값 존재 지지" 로 샌다).
   * 같은 변형·다른 속성(SAME_OTHER_PROP)과 범위 없는 원문(UNKNOWN)만 예전 동작으로 넘긴다 — 동의어 차이로 멀쩡한 문장을 지우지 않게.
   */
  const hits: Array<{ id: string; rel: string }> = [];
  const contra: Array<{ id: string; raw: string }> = [];
  for (const src of ledger.sources) {
    for (const u of src.units) {
      for (const f of findValue(u.s, value)) {
        // LLM 서술은 모델이 붙은 주장을 어차피 지지하지 못한다 — 모호로 센다
        if (src.kind === 'PROSE') { hits.push({ id: src.id, rel: 'AMBIGUOUS' }); continue; }
        const k = claimKey(u, f.index, f.length);
        const rel = variantRelation(claim.variant, k.variant);
        const propDiffers = propertyRelation(claim.property, k.property) === 'DIFFERENT';
        hits.push({ id: src.id, rel: propDiffers && rel === 'SAME' ? 'SAME_OTHER_PROP' : propDiffers && rel === 'UNKNOWN' ? 'UNKNOWN_OTHER_PROP' : rel });
      }
      if (src.kind !== 'SOURCE') continue;
      for (const o of otherValues(u.s, value)) {
        const k = claimKey(u, o.index, o.length);
        if (variantRelation(claim.variant, k.variant) === 'SAME' && propertyRelation(claim.property, k.property) === 'SAME') contra.push({ id: src.id, raw: o.raw.replace(/\s+/g, '') });
      }
    }
  }
  const ids = (rel: string) => [...new Set(hits.filter((h) => h.rel === rel).map((h) => h.id))];
  if (ids('SAME').length) return { ...base, variant, verdict: 'SUPPORTED', sourceIds: ids('SAME'), reason: '원문이 같은 모델·트림의 값으로 말함' };
  if (contra.length) return { ...base, variant, verdict: 'CONTRADICTED', sourceIds: [...new Set(contra.map((c) => c.id))], reason: `원문의 같은 모델·같은 속성 값은 ${[...new Set(contra.map((c) => c.raw))].slice(0, 3).join('·')}` };
  if (ids('UNKNOWN').length) return { ...base, variant, verdict: 'SUPPORTED', sourceIds: ids('UNKNOWN'), reason: '원문이 모델을 말하지 않음 — 값 존재로 지지(예전 동작)' };
  if (ids('SAME_OTHER_PROP').length || ids('UNKNOWN_OTHER_PROP').length) return { ...base, variant, verdict: 'NOT_APPLICABLE', sourceIds: [...ids('SAME_OTHER_PROP'), ...ids('UNKNOWN_OTHER_PROP')], reason: '같은 모델(또는 범위 없는) 원문의 같은 값이 다른 속성 창에 있음 — 동의어일 수 있어 값 대조(예전 동작)가 판정' };
  if (ids('DIFFERENT').length) return { ...base, variant, verdict: 'VARIANT_MISMATCH', sourceIds: ids('DIFFERENT'), reason: '원문에서 이 값은 다른 모델·트림의 값' };
  if (ids('AMBIGUOUS').length) return { ...base, variant, verdict: 'UNKNOWN', sourceIds: ids('AMBIGUOUS'), reason: '시리즈 문맥·LLM 서술에만 있음 — 원문이 모델을 정하지 않음' };
  return { ...base, variant, verdict: 'NOT_APPLICABLE', sourceIds: [], reason: '장부 원문에 이 값이 없음 — 값 대조(예전 동작)가 판정' };
}

/** SUPPORTED·NOT_APPLICABLE 이 아니면 근거 없음 — 사실 필터와 본문 관문이 같은 뜻으로 쓴다 */
export const variantFails = (j: VariantJudgement) => j.verdict === 'CONTRADICTED' || j.verdict === 'VARIANT_MISMATCH' || j.verdict === 'UNKNOWN';
