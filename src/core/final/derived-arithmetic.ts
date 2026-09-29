/**
 * 🧮 v3.8.767 — 근거 값으로 검산되는 단일 단계 산술(DERIVED_FROM_EVIDENCE).
 *
 * 실측(BATCH 1, 세 도메인 중 둘):
 *   · 자동차(run 19fb30): 근거 "555만원"·"570만원" → 원고 "15만 원 차이". 글자 15만원이 근거에 없어 사실 필터가 문장 2개를 지웠다.
 *   · 보험(run 324f0e): 근거 "80,000원"·"35%" → 원고 "28,000원". 글자가 없어 문장과 계산 표의 칸이 지워졌다(표에 빈 칸이 남았다).
 * v3.8.757 의 단순 차액(derived-difference)은 **표 한 줄의 두 칸**만 봤다. 여기서는 같은 문장·같은 표 안의 명시적 피연산자까지 본다.
 *
 * 지원: |a − b| · a × r% · a × (1 − r%). 한 단계뿐이다.
 * 조건: 피연산자마다 근거 장부에서 직접 확인 · **같은 근거 문서 하나에 함께 있음**(같은 대상·조건·시점을 문서로 묶는 대리 기준) ·
 *       단위 호환 · 결과가 정확히 같음 · 문장(또는 표 머리글·행 이름표)에 계산 단서가 있음.
 * 범위 밖: 여러 단계(80,000 × 35% × 10일), 복리·세전/세후·수익률·누진, 서로 다른 문서의 값 조합. 이런 값은 예전처럼 근거 없음이다.
 * 가정 값(HYPOTHETICAL)과 섞지 않는다 — 피연산자가 근거로 확인되지 않으면 여기서 지원하지 않는다(가정 경로는 derived-difference 가 맡는다).
 * eval·임의 코드 실행 없음.
 */
import { containsValueToken, normalizeForMatch } from './number-token';
import type { DerivedCheck, DerivedOperand } from './derived-difference';

export type ValueRole = 'FACT' | 'DERIVED_FROM_EVIDENCE' | 'HYPOTHETICAL';

/** 파생 기록의 역할 — 계산이 맞아도 입력이 가정이면 사실로 승격하지 않는다 */
export function derivedRole(check: DerivedCheck): ValueRole | null {
  if (check.verdict === 'hypothetical') return 'HYPOTHETICAL';
  if (check.verdict === 'verified') return 'DERIVED_FROM_EVIDENCE';
  return null;
}

interface Num { num: number; unit: string; token: string; base: number }

const MONEY_SCALE: Record<string, number> = { '원': 1, '만원': 1e4, '억원': 1e8 };
const QUANTITY = /(\d[\d,]*(?:\.\d+)?)\s*(만\s*원|억\s*원|원|km|개월|명|건|시간|분)/g;
const RATE = /(\d+(?:\.\d+)?)\s*(?:%|퍼센트)(?!\s*(?:p|포인트))/g;
const DIFF_CUE = /차이|차액|더\s*(?:많|적|크|작|높|낮|받|내)/;
const CALC_CUE = /적용|곱|×|계산|산정|상당|환산|차감|빼면|결과|차이|차액/;
const FORBIDDEN = /복리|세후|세전|수익률|이자율|누진|할부|시뮬레이션/;

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

function toNum(numText: string, unitText: string): Num | null {
  const unit = unitText.replace(/\s+/g, '');
  const num = Number(numText.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;
  const scale = MONEY_SCALE[unit];
  return { num, unit, token: `${numText.replace(/,/g, '')}${unit}`, base: scale ? num * scale : num };
}
const sameKind = (a: Num, b: Num) => (a.unit in MONEY_SCALE && b.unit in MONEY_SCALE) || a.unit === b.unit;

function quantitiesOf(text: string): Num[] {
  return [...String(text || '').matchAll(QUANTITY)].map((m) => toNum(m[1]!, m[2]!)).filter((v): v is Num => !!v);
}
function ratesOf(text: string): number[] {
  return [...new Set([...String(text || '').matchAll(RATE)].map((m) => Number(m[1])))];
}
/** 칸 하나에 값이 딱 하나일 때만 피연산자로 쓴다(어느 값인지 모르는 칸은 쓰지 않는다) */
function singleQuantity(cell: string): Num | null { const q = quantitiesOf(cell); return q.length === 1 ? q[0]! : null; }
function singleRate(cell: string): number | null { const r = ratesOf(cell); return r.length === 1 && quantitiesOf(cell).length === 0 ? r[0]! : null; }

interface Table { headers: string[]; rows: string[][] }
function parseTables(blockHtml: string): Table[] {
  const out: Table[] = [];
  for (const t of String(blockHtml || '').match(/<table[\s\S]*?<\/table>/gi) || []) {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((r) => [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => plain(c[1] || '')));
    if (rows.length >= 2) out.push({ headers: rows[0]!, rows: rows.slice(1) });
  }
  return out;
}

/** 근거 문서별 블록 — [E01] 로 시작하는 블록은 그 ID, 앞머리(유료 요약·공고 원문)는 'CTX' */
function evidenceBlocks(context: string): Array<{ id: string; text: string }> {
  return String(context || '').split(/\n\n(?=\[E\d{2}\])/).map((block) => ({ id: (block.match(/^\[(E\d{2})\]/) || [])[1] || 'CTX', text: normalizeForMatch(block) }));
}
const idsWith = (blocks: Array<{ id: string; text: string }>, token: string) => blocks.filter((b) => containsValueToken(b.text, normalizeForMatch(token))).map((b) => b.id);
const rateToken = (r: number) => `${r}%`;

interface Candidate { operation: string; result: number; operands: Array<{ label: string; token: string }>; kind: 'evidence-diff' | 'evidence-rate' }

function candidatesFor(claim: Num, quantities: Array<Num & { label: string }>, rates: Array<{ r: number; label: string }>, allowDiff: boolean, allowRate: boolean): Candidate[] {
  const out: Candidate[] = [];
  const pool = quantities.filter((q) => sameKind(q, claim) && q.token !== claim.token);
  if (allowDiff) {
    for (let i = 0; i < pool.length; i += 1) for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i]!; const b = pool[j]!;
      out.push({ kind: 'evidence-diff', operation: `|${a.token} − ${b.token}|`, result: Math.abs(a.base - b.base), operands: [{ label: a.label, token: a.token }, { label: b.label, token: b.token }] });
    }
  }
  if (allowRate) {
    for (const a of pool) for (const { r, label } of rates) {
      out.push({ kind: 'evidence-rate', operation: `${a.token} × ${r}%`, result: a.base * r / 100, operands: [{ label: a.label, token: a.token }, { label, token: rateToken(r) }] });
      out.push({ kind: 'evidence-rate', operation: `${a.token} × (1 − ${r}%)`, result: a.base * (1 - r / 100), operands: [{ label: a.label, token: a.token }, { label, token: rateToken(r) }] });
    }
  }
  return out;
}

/** 표 안의 값이면 그 표(같은 계산) · 문장에 차이 단서가 있으면 같은 블록 표의 같은 열(같은 항목) */
function tableScopes(sentence: string, claim: Num, tables: Table[]): Array<{ quantities: Array<Num & { label: string }>; rates: Array<{ r: number; label: string }>; cueText: string; allowDiff: boolean }> {
  const scopes: Array<{ quantities: Array<Num & { label: string }>; rates: Array<{ r: number; label: string }>; cueText: string; allowDiff: boolean }> = [];
  for (const t of tables) {
    const cells = t.rows.flatMap((row) => row.map((cell, ci) => ({ cell, label: `${row[0] || ''} · ${t.headers[ci] || ''}` })));
    const inTable = cells.some((c) => { const q = singleQuantity(c.cell); return !!q && q.base === claim.base && sameKind(q, claim); });
    if (inTable) {
      scopes.push({
        quantities: cells.map((c) => ({ q: singleQuantity(c.cell), label: c.label })).filter((x) => x.q).map((x) => ({ ...x.q!, label: x.label })),
        rates: cells.map((c) => ({ r: singleRate(c.cell), label: c.label })).filter((x) => x.r !== null).map((x) => ({ r: x.r!, label: x.label })),
        cueText: `${t.headers.join(' ')} ${t.rows.map((r) => r[0] || '').join(' ')}`,
        allowDiff: DIFF_CUE.test(t.headers.join(' ')),
      });
      continue;
    }
    if (!DIFF_CUE.test(sentence)) continue;
    // 같은 열(머리글 = 항목)의 서로 다른 행 — "EV3 555만 원 / EV6 570만 원" 의 차이
    for (let ci = 1; ci < t.headers.length; ci += 1) {
      const col = t.rows.map((row) => ({ q: singleQuantity(row[ci] || ''), label: `${row[0] || ''} · ${t.headers[ci] || ''}` })).filter((x) => x.q && sameKind(x.q, claim));
      if (col.length >= 2) scopes.push({ quantities: col.map((x) => ({ ...x.q!, label: x.label })), rates: [], cueText: sentence, allowDiff: true });
    }
  }
  return scopes;
}

/**
 * 문장의 근거 없는 값들 가운데 근거 값으로 한 단계 검산되는 것을 찾는다.
 * @param unsupported 정규화된 값 토큰("28000원")
 * @param isSupported 값이 근거 장부에 직접 있는지(호출부의 대조 규칙 그대로)
 */
export function resolveEvidenceArithmetic(
  sentence: string,
  unsupported: string[],
  blockHtml: string,
  evidenceContext: string,
  isSupported: (token: string) => boolean,
): { resolved: Map<string, DerivedCheck>; checks: DerivedCheck[] } {
  const resolved = new Map<string, DerivedCheck>();
  const checks: DerivedCheck[] = [];
  const text = plain(sentence);
  if (!text || FORBIDDEN.test(text)) return { resolved, checks };
  const tables = parseTables(blockHtml);
  const blocks = evidenceBlocks(evidenceContext);

  for (const token of unsupported) {
    const claim = quantitiesOf(token)[0];
    if (!claim) continue;
    const scopes = [
      { quantities: quantitiesOf(text).map((q) => ({ ...q, label: '같은 문장' })), rates: ratesOf(text).map((r) => ({ r, label: '같은 문장' })), cueText: text, allowDiff: DIFF_CUE.test(text) },
      ...tableScopes(text, claim, tables),
    ];
    let best: DerivedCheck | null = null;
    let firstFail: DerivedCheck | null = null;
    let tried = 0;
    for (const scope of scopes) {
      if (!CALC_CUE.test(scope.cueText) && !CALC_CUE.test(text)) continue;
      for (const c of candidatesFor(claim, scope.quantities, scope.rates, scope.allowDiff, true)) {
        tried += 1;
        if (Math.abs(c.result - claim.base) > 1e-6) continue;
        const operands: DerivedOperand[] = c.operands.map((o) => ({ label: o.label, value: o.token, unit: o.token.replace(/^[\d.]+/, ''), sourceIds: idsWith(blocks, o.token), origin: 'evidence' as const }));
        const base = { kind: c.kind, sentence: text, claim: token, item: '', operands, operation: c.operation, result: `${claim.num}${claim.unit}`, role: 'DERIVED_FROM_EVIDENCE' as const };
        if (!c.operands.every((o) => isSupported(o.token))) { firstFail = firstFail || { ...base, verdict: 'unverifiable', reason: '피연산자가 근거 장부에서 직접 확인되지 않음' }; continue; }
        const shared = operands[0]!.sourceIds.filter((id) => operands.slice(1).every((o) => o.sourceIds.includes(id)));
        if (shared.length === 0) { firstFail = firstFail || { ...base, verdict: 'unverifiable', reason: '피연산자가 같은 근거 문서에 함께 있지 않음 — 다른 대상·시점의 값 조합일 수 있음' }; continue; }
        best = { ...base, verdict: 'verified', reason: `한 단계 계산(${c.operation}) 결과가 주장값과 같음 · 피연산자 공통 근거 ${shared.join(',')}` };
        break;
      }
      if (best) break;
    }
    if (best) { resolved.set(token, best); checks.push(best); }
    else if (firstFail) checks.push(firstFail);
    else if (tried > 0) checks.push({ kind: 'evidence-diff', sentence: text, claim: token, item: '', operands: [], operation: '', result: '', verdict: 'mismatch', reason: '같은 문장·표의 값으로 한 단계 계산해도 주장값이 나오지 않음(여러 단계 계산은 범위 밖)' });
  }
  return { resolved, checks };
}
