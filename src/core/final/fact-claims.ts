/**
 * 🔍 사실 주장 추출·대조 (v3.8.735)
 *
 * 제목·본문·FAQ·요약표에 든 **구체적인 값**(날짜·기간·금액·비율·인원·순위)이 근거에 글자로 있는지 본다.
 * 실측(2026-09-22, 경주 APEC 글): 근거에 없는 "11월 2일"이 제목에 들어갔는데 감사 점수는 100이었다 —
 * 점수가 제목의 값을 근거와 대조하지 않았기 때문이다. 이 모듈이 그 대조를 맡는다.
 *
 * 원칙: 표기를 정규화(공백·쉼표 제거)해 **근거 원문에 그대로 있는 값만** 뒷받침된 것으로 본다.
 * 기간 "10월 7~16일"은 시작 "10월7일"과 끝 "16일"이 모두 근거에 있어야 한다.
 * 연도 하나("2026년")는 낚시 값이 아니라 대조하지 않는다(올해면 통과).
 */

import { kstYear } from './kst-date';
import { extractRanges, isRangeBound, type ValueRange } from './range-value';
import { isLexicalValue } from './value-boundary';
import { findValue, judgeVariantValue, variantHolds, variantSkips, type VariantJudgement, type VariantLedger } from './variant-ledger';
import { isSpecDifference, specValues } from './spec-units';
import type { ScopedUnit } from './claim-variant';

export type ClaimKind = 'date' | 'range' | 'amount' | 'percent' | 'count' | 'rank' | 'duration';

/** at — 태그를 걷은 글 안의 위치(주어 낱말을 찾는 데만 쓴다) */
export interface Claim { text: string; kind: ClaimKind; keys: string[]; at?: number }
/** via 'range-endpoint' — 근거의 범위 표기(하한~상한)의 한쪽 끝으로 뒷받침됨. range 는 그 범위와 바로 앞 문맥(주어·조건·상태 낱말)을 그대로 넘긴다 */
export interface SupportedClaim { claim: string; sourceIds: string[]; via?: 'range-endpoint' | 'derived'; range?: { raw: string; lower: number; upper: number; unit: string; context: string }; operation?: string }
/** v3.8.767 — 앞 단계(사실 필터)가 근거 값으로 한 단계 검산해 둔 값(DERIVED_FROM_EVIDENCE). 글자로는 근거에 없지만 계산으로 뒷받침된다 */
export interface DerivedSupport { claim: string; operation: string; sourceIds: string[] }
/** variant(v3.8.773) — 모델·트림 범위 판정(모델이 붙은 값만). 사실 필터와 같은 장부·같은 판정 */
export interface ClaimCheck { supported: SupportedClaim[]; unsupported: string[]; variant?: VariantJudgement[] }
export interface LedgerItem { id: string; text: string }

/** 정규화 — 쉼표·공백 제거, 물결·퍼센트 표기 통일. live 736-1: 근거 "200%" 와 답변 상자 "200퍼센트" 를 다른 값으로 봐 발행을 막았다 */
export const norm = (s: string): string => String(s || '').replace(/[,\s]/g, '').replace(/[∼～]/g, '~').replace(/퍼센트|％/g, '%');

const PATTERNS: Array<{ kind: ClaimKind; re: RegExp }> = [
  { kind: 'range', re: /(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일?\s*(?:부터|~|∼|～|-|–)\s*(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일(?:\s*까지)?/g },
  { kind: 'date', re: /(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일/g },
  { kind: 'date', re: /20\d{2}\s*년\s*\d{1,2}\s*월(?!\s*\d{1,2}\s*일)/g },
  { kind: 'amount', re: /\d[\d,]*(?:\.\d+)?\s*(?:억\s*)?(?:천만|백만|십만|만|천)?\s*(?:원|달러|USD)/g },
  { kind: 'percent', re: /\d+(?:\.\d+)?\s*(?:%|퍼센트|％)/g },
  { kind: 'count', re: /\d[\d,]*(?:\s*(?:억|만|천)\s*\d[\d,]*)?\s*(?:명|건|가구|세대|좌|만좌|대|곳|개소|석|편|회|배)/g },
  { kind: 'duration', re: /\d+\s*(?:개월|년간|주간|일간|시간|영업일)/g },
  { kind: 'rank', re: /\d+\s*위/g },
];

/** 텍스트에서 값 주장을 뽑는다. 겹치는 자리(기간 안의 날짜)는 큰 것만 남긴다 */
export function extractClaims(text: string): Claim[] {
  const src = String(text || '').replace(/<[^>]+>/g, ' ');
  const found: Array<Claim & { start: number; end: number }> = [];
  for (const { kind, re } of PATTERNS) {
    const r = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(src)) !== null) {
      const raw = m[0].trim();
      if (kind === 'count' && /^\d{1,2}\s*회$/.test(raw)) continue;   // "2회" 같은 차수는 값이 아니다
      // v3.8.770 — 낱말 경계: "정부24 대상"→24대 · 목차 "6 위임장"→6위 는 값이 아니다(live 48417f BODY_FACT 가짜 실패)
      if (!isLexicalValue(src, m.index, m[0])) continue;
      found.push({ text: raw, kind, keys: claimKeys(raw, kind), start: m.index, end: m.index + m[0].length });
    }
  }
  found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: Claim[] = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.start < lastEnd) continue;
    out.push({ text: f.text, kind: f.kind, keys: f.keys, at: f.start });
    lastEnd = f.end;
  }
  const seen = new Set<string>();
  return out.filter((c) => { const k = norm(c.text); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** 근거에서 찾을 열쇠들 — 전부 있어야 뒷받침된 것이다 */
function claimKeys(raw: string, kind: ClaimKind): string[] {
  const n = norm(raw);
  if (kind === 'range') {
    const m = n.match(/^(?:(20\d{2})년)?(\d{1,2})월(\d{1,2})일?(?:부터|~|-|–)(?:(\d{1,2})월)?(\d{1,2})일/);
    if (m) {
      const start = `${m[2]}월${m[3]}일`;
      const end = m[4] ? `${m[4]}월${m[5]}일` : `${m[5]}일`;
      return [start, end];
    }
  }
  if (kind === 'date') return [n.replace(/^20\d{2}년/, '')];
  return [n];
}

export function ledgerFromItems(items: LedgerItem[]): LedgerItem[] {
  return items.map((i) => ({ id: i.id, text: norm(i.text) }));
}

/**
 * 값 주장을 근거와 대조한다. 뒷받침된 것은 어느 근거(id)에 있었는지 함께 돌려준다.
 * 연도만 있는 주장은 대조하지 않는다.
 */
export function checkClaims(text: string, ledger: LedgerItem[], now: Date = new Date(), derived: ReadonlyArray<DerivedSupport> = [], variant?: { ledger: VariantLedger; units: ReadonlyArray<ScopedUnit> }): ClaimCheck {
  const base = checkClaimsByValue(text, ledger, now, derived);
  if (!variant) return base;
  /**
   * v3.8.773 — 글자로 근거에 있는 값도 모델·트림이 붙은 문장이면 같은 변형의 원문 값이어야 한다(variant-ledger).
   * 사실 필터(fact-integrity)와 같은 장부·같은 판정·같은 뜻: SUPPORTED 가 아니면 근거 없음. 값이 나온 문장마다 본다.
   */
  const judged: VariantJudgement[] = [];
  const failed = new Set<string>();
  // v3.8.774 — 지지가 아닌 판정은 모두 보류(자동 발행 근거 아님). 사실 필터는 같은 판정 중 1차 원문이 반박한 것만 지운다(variantDeletes)
  const holds = variantHolds;
  for (const s of base.supported.filter((x) => !x.via)) {
    for (const u of variant.units.filter((unit) => findValue(unit.s, s.claim).length)) {
      const j = judgeVariantValue(variant.ledger, u, s.claim);
      if (variantSkips(j)) continue;
      judged.push(j);
      if (holds(j)) failed.add(s.claim);
    }
  }
  /**
   * v3.8.774 — 사양값(mAh·W·kW·Wh·kWh·km)도 같은 추출기(spec-units)·같은 장부·같은 판정. 모델이 붙은 단위만(NOT_APPLICABLE 은 건너뜀).
   * 장부 원문에 없으면(NOT_FOUND) 근거 없음 — 본문 관문의 장부(claimLedger)와 모델 장부는 같은 문서들이다.
   */
  for (const u of variant.units) {
    for (const sv of specValues(u.s)) {
      const j = judgeVariantValue(variant.ledger, u, sv.raw);
      if (j.verdict === 'NOT_APPLICABLE') continue;
      judged.push(j);
      if ((j.verdict === 'NOT_FOUND' && !isSpecDifference(u.s, sv)) || holds(j)) failed.add(sv.raw);
    }
  }
  return {
    supported: base.supported.filter((s) => !failed.has(s.claim)),
    unsupported: [...base.unsupported, ...failed],
    ...(judged.length ? { variant: judged } : {}),
  };
}

function checkClaimsByValue(text: string, ledger: LedgerItem[], now: Date, derived: ReadonlyArray<DerivedSupport>): ClaimCheck {
  const derivedByValue = new Map(derived.map((d) => [norm(d.claim), d]));
  const normalized = ledger.map((l) => ({ id: l.id, text: l.text.includes(' ') || l.text.includes(',') ? norm(l.text) : l.text }));
  const all = normalized.map((l) => l.text).join('\n');
  const year = String(kstYear(now));
  const supported: SupportedClaim[] = [];
  const unsupported: string[] = [];
  const src = String(text || '').replace(/<[^>]+>/g, ' ');
  let ranges: RangeRef[] | null = null;
  for (const c of extractClaims(text)) {
    if (/^20\d{2}년$/.test(norm(c.text))) { if (!all.includes(norm(c.text)) && norm(c.text) !== `${year}년`) unsupported.push(c.text); continue; }
    const ok = c.keys.every((k) => all.includes(k));
    if (!ok) {
      // v3.8.766 — 근거가 "13.2~14.4%" 처럼 범위로만 말하면 글자 그대로는 "13.2%" 가 없다(live ed05c6: 이 때문에 BODY_FACT_PASS=false → MANUAL_REVIEW).
      // 범위의 **두 끝 값만** 같은 값으로 인정한다(13.8% 같은 중간값은 아님). 날짜는 대상이 아니다. 주어 낱말이 있으면 범위 바로 앞 문맥에 그 낱말이 있어야 한다.
      const endpoint = ENDPOINT_KINDS.has(c.kind) ? rangeEndpointSupport(c, src, ranges || (ranges = rangeRefs(normalized))) : null;
      if (endpoint) { supported.push(endpoint); continue; }
      const d = derivedByValue.get(norm(c.text));
      if (d) { supported.push({ claim: c.text, sourceIds: d.sourceIds, via: 'derived', operation: d.operation }); continue; }
      unsupported.push(c.text);
      continue;
    }
    const ids = normalized.filter((l) => c.keys.every((k) => l.text.includes(k))).map((l) => l.id);
    supported.push({ claim: c.text, sourceIds: ids.length ? ids : normalized.filter((l) => c.keys.some((k) => l.text.includes(k))).map((l) => l.id).slice(0, 3) });
  }
  return { supported, unsupported };
}

const ENDPOINT_KINDS = new Set<ClaimKind>(['percent', 'amount', 'count', 'duration']);
interface RangeRef { id: string; range: ValueRange; context: string }
/** 근거마다 범위 표기와 그 바로 앞 문맥(40자) — 같은 범위가 여러 번 나오면 나온 자리마다 */
function rangeRefs(ledger: Array<{ id: string; text: string }>): RangeRef[] {
  const out: RangeRef[] = [];
  for (const l of ledger) {
    for (const r of extractRanges(l.text)) {
      for (let at = l.text.indexOf(r.raw); at >= 0; at = l.text.indexOf(r.raw, at + 1)) out.push({ id: l.id, range: r, context: l.text.slice(Math.max(0, at - 40), at + r.raw.length) });
    }
  }
  return out;
}
/** 값 앞의 짧은 이름표(주어) — 일반 수식어는 건너뛴다. 없으면 null(주어 제약 없음) */
const SUBJECT_SKIP = /^(?:최대|최소|약|연|월|일|기준|최고|최저|평균|각각|모두|부터|에서|까지|수준|이자|금리|단리|복리|실질|효과)$/;
function subjectBefore(src: string, at: number | undefined): string | null {
  if (at === undefined) return null;
  const words = src.slice(Math.max(0, at - 24), at).split(/[\s,·()]+/).map((w) => w.replace(/(?:은|는|이|가|의|을|를|도|과|와|에서|에게|으로|로)$/, '')).filter((w) => /^[가-힣A-Za-z0-9]{2,}$/.test(w) && !/\d/.test(w));
  for (let i = words.length - 1; i >= 0; i -= 1) if (!SUBJECT_SKIP.test(words[i]!)) return words[i]!;
  return null;
}
function rangeEndpointSupport(c: Claim, src: string, refs: RangeRef[]): SupportedClaim | null {
  const token = norm(c.text);
  const subject = subjectBefore(src, c.at);
  const hit = refs.find((r) => isRangeBound(token, [r.range]) && (!subject || r.context.includes(norm(subject))));
  if (!hit) return null;
  return { claim: c.text, sourceIds: [hit.id], via: 'range-endpoint', range: { raw: hit.range.raw, lower: hit.range.lower, upper: hit.range.upper, unit: hit.range.unit, context: hit.context } };
}

/** 주장 문구를 문장에서 걷어낸다 — 제목 재생성이 안 될 때의 마지막 수단 */
export function stripClaims(text: string, claims: string[]): string {
  let out = String(text || '');
  for (const c of claims) {
    const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
    // 뒤에 붙은 조사는 낱말 경계일 때만 뗀다 — "11월 2일 가능" 의 "가" 를 먹으면 안 된다
    out = out.replace(new RegExp(`\\s*(?:부터|까지)?\\s*${esc}(?:부터|까지|에|의|인|은|는|이|가)?(?=\\s|$|[,.!?、·])`, 'g'), ' ');
  }
  return out.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?、])/g, '$1').replace(/^[\s,·\-–—]+|[\s,·\-–—]+$/g, '').trim();
}
