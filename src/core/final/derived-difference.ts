/**
 * 🧮 v3.8.757 — 검산 가능한 단순 차액.
 *
 * 실측(run f607bc 017): "기간은 2년, 월 한도는 20만 원 차이이므로 …" — 같은 블록의 표에
 * 「월 최대 납입액 | 50만 원 | 70만 원」이 있고 두 값 모두 근거 장부에 있다. 20만 원은 원문에 없지만
 * 70−50 으로 검산된다. 사실 필터는 "원문에 같은 숫자가 없다" 는 이유로 문장을 지웠다.
 *
 * 지원 범위: 명시적인 두 비교 대상의 **같은 항목·같은 단위** 값 사이 단일 단계 차액(|a−b|). 피연산자는 같은 블록의 표
 * 한 줄(항목 = 행 이름표, 비교 대상 = 열 머리글)에서만 가져오고, 각 값은 근거 장부에서 직접 확인돼야 한다.
 * 범위 밖: 복리·세금·수익률·만기 계산, 여러 값의 임의 조합, 유불리 추천(차액이 맞아도 판단은 별개), 조건부·예정·과거 행.
 * eval·임의 코드 실행 없음 — 숫자 두 개의 뺄셈뿐이다.
 */
import { containsValueToken, normalizeForMatch } from './number-token';

export interface DerivedOperand { label: string; value: string; unit: string; sourceIds: string[]; /** v3.8.759 — 피연산자의 출처: 근거 장부 ID 가 있으면 'evidence', 같은 블록의 명시적 가정이면 'hypothetical' */ origin?: 'evidence' | 'hypothetical' }
export interface DerivedCheck {
  /** 'abs-diff' = 근거값 두 개의 차액 · 'hypothetical-diff' = 같은 블록의 명시적 가정(예시 기준값)에서 나온 차액(v3.8.759) */
  kind: 'abs-diff' | 'hypothetical-diff';
  sentence: string;
  claim: string;
  item: string;
  operands: DerivedOperand[];
  operation: string;
  result: string;
  /** 'hypothetical' = 계산은 맞지만 입력이 가정이라 사실로 승격하지 않는다(EXPLICIT_HYPOTHETICAL_DERIVATION) */
  verdict: 'verified' | 'mismatch' | 'unverifiable' | 'hypothetical';
  reason: string;
  /** hypothetical-diff 일 때 가정을 선언한 구절(블록 안) */
  hypothesis?: string;
}

/**
 * v3.8.759 — 명시적 가정 예시의 단순 차액.
 * 실측(run fba7e9 017): "원래 월 100만원을 받을 예정이라면 1년 조기수령은 월 94만원입니다." 뒤의 "1년 조기수령은 월 6만원 감소로 계산합니다." 가
 * 근거에 6만원이 없다는 이유로 지워졌다. 100만원은 예시 기준값(가정), 94만원은 같은 블록의 예시 값, 6 = |100 − 94|.
 * 허용: +·−·절대 차이 · 같은 블록 · 같은 단위 · 입력이 근거로 확인됐거나 그 블록이 명시적 예시로 선언한 값.
 * 금지: 복리·세금·할인·수익률·시뮬레이션·문서 간 혼합·추천 판단. 결과는 'hypothetical' 로만 남기고 사실로 승격하지 않는다.
 */
const HYPOTHESIS_MARK = /(?:원래|기본|예시|가정|예를\s*들어|예컨대)/;
const HYPOTHESIS_BASE = /(?:원래|기본\s*수령액|기본|예시|가정|예를\s*들어|예컨대)[^.]{0,30}?(\d[\d,]*(?:\.\d+)?)\s*(만\s*원|억\s*원|원)/g;
const EXAMPLE_BLOCK = /(?:이|위|아래)\s*예시|예시(?:는|입니다|이다|로|를)|가정(?:하면|해\s*보면|한\s*경우)|예를\s*들어/;
const HYPO_CUE = /감소|줄어|감액|차이|차액|증가|늘어|더\s*(?:많|적|크|작)/;
const FORBIDDEN_OP = /복리|세금|세후|세전|할인|수익률|이자율|시뮬레이션|추천|유리|불리/;
const ITEM_CUE = /(\d+\s*(?:년|개월|주|일|회|차))/;

const DIRECTION_MORE = /더\s*(?:많|크|높|길)/;
const DIRECTION_LESS = /더\s*(?:적|작|낮|짧)|덜/;
const DIFF_CUE = new RegExp(`차이|차액|${DIRECTION_MORE.source}|${DIRECTION_LESS.source}`);
const CONDITIONAL_ROW = /예정|통과\s*(?:시|할\s*경우)|가정|추정|지난|과거|이전\s*회차|당시/;
const AMOUNT = /(\d[\d,]*(?:\.\d+)?)\s*(만\s*원|억\s*원|원|개월|명|건)/g;
const UNIT_NORM: Record<string, string> = { '만원': '만원', '억원': '억원', '원': '원', '개월': '개월', '명': '명', '건': '건' };

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const parseAmount = (text: string): { num: number; unit: string; token: string } | null => {
  const matches = [...String(text || '').matchAll(AMOUNT)];
  if (matches.length !== 1) return null;                       // 값이 둘 이상 든 칸은 쓰지 않는다(어느 것인지 모른다)
  const m = matches[0]!;
  const unit = UNIT_NORM[m[2]!.replace(/\s+/g, '')] || '';
  const num = Number(m[1]!.replace(/,/g, ''));
  if (!unit || !Number.isFinite(num)) return null;
  return { num, unit, token: `${m[1]!.replace(/,/g, '')}${unit}` };
};
const periodOf = (text: string): string | null => (text.match(/(?:^|[^가-힣])(월|연|년|주)\s*(?:최대|한도|납입|기준|납입액)/) || [])[1] || null;

function parseTables(blockHtml: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  for (const t of String(blockHtml || '').match(/<table[\s\S]*?<\/table>/gi) || []) {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map((r) => [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => plain(c[1] || '')));
    if (rows.length < 2) continue;
    tables.push({ headers: rows[0]!, rows: rows.slice(1) });
  }
  return tables;
}

function sourceIdsOf(context: string, token: string): string[] {
  const ids: string[] = [];
  for (const block of String(context || '').split(/\n\n(?=\[E\d{2}\])/)) {
    const id = (block.match(/^\[(E\d{2})\]/) || [])[1];
    if (id && containsValueToken(normalizeForMatch(block), normalizeForMatch(token))) ids.push(id);
  }
  return ids;
}

/**
 * 문장의 근거 없는 값들 가운데 표로 검산되는 차액을 찾는다.
 * @param unsupported 정규화된 값 토큰("20만원")
 * @param isSupported 값이 근거 장부에 직접 있는지(호출부의 대조 규칙 그대로)
 */
export function resolveDerivedDifferences(
  sentence: string,
  unsupported: string[],
  blockHtml: string,
  evidenceContext: string,
  isSupported: (token: string) => boolean,
): { resolved: Map<string, DerivedCheck>; checks: DerivedCheck[] } {
  const resolved = new Map<string, DerivedCheck>();
  const checks: DerivedCheck[] = [];
  if (!blockHtml) return { resolved, checks };
  const tables = parseTables(blockHtml);
  // 문장 분리기는 표의 칸 글자(마침표 없음)를 뒤따르는 문장 **앞**에 붙인다 — 앞머리의 칸 글자를 순서대로 벗겨 낸 실제 문장에서만 단서·방향을 읽는다
  let text = plain(sentence);
  let pos = 0;
  for (const cell of tables.flatMap((t) => [...t.headers, ...t.rows.flat()]).filter(Boolean)) {
    while (text[pos] === ' ') pos += 1;
    if (text.startsWith(cell, pos)) pos += cell.length; else break;
  }
  text = text.slice(pos).trim();
  const hypotheses = findHypotheses(blockHtml);
  const tableEligible = tables.length > 0 && DIFF_CUE.test(text);
  const hypoEligible = hypotheses.length > 0 && HYPO_CUE.test(text) && !FORBIDDEN_OP.test(text);
  if (!tableEligible && !hypoEligible) return { resolved, checks };
  const period = periodOf(text);
  const wantsMore = DIRECTION_MORE.test(text);
  const wantsLess = !wantsMore && DIRECTION_LESS.test(text);

  for (const token of unsupported) {
    const claim = parseAmount(token);
    if (!claim) continue;
    let best: DerivedCheck | null = null;
    for (const table of tableEligible ? tables : []) {
      for (const row of table.rows) {
        const item = row[0] || '';
        const rowText = row.join(' ');
        if (CONDITIONAL_ROW.test(rowText)) continue;                      // 조건부·과거 행은 검산 재료가 아니다
        if (period && !item.includes(period)) continue;                    // 월 한도 ↔ 연 한도 를 섞지 않는다
        const cells = row.slice(1).map((cell, i) => ({ label: table.headers[i + 1] || `열 ${i + 2}`, amount: parseAmount(cell) }))
          .filter((c) => c.amount && c.amount.unit === claim.unit) as Array<{ label: string; amount: { num: number; unit: string; token: string } }>;
        for (let i = 0; i < cells.length; i += 1) for (let j = i + 1; j < cells.length; j += 1) {
          const a = cells[i]!; const b = cells[j]!;
          const diff = Math.abs(a.amount.num - b.amount.num);
          if (Math.abs(diff - claim.num) > 1e-9) continue;
          const operands: DerivedOperand[] = [a, b].map((c) => ({ label: c.label, value: c.amount.token, unit: c.amount.unit, sourceIds: sourceIdsOf(evidenceContext, c.amount.token) }));
          const base = { kind: 'abs-diff' as const, sentence: text, claim: token, item, operands, operation: `|${a.amount.token} − ${b.amount.token}|`, result: `${diff}${claim.unit}` };
          if (!isSupported(a.amount.token) || !isSupported(b.amount.token)) { checks.push({ ...base, verdict: 'unverifiable', reason: '피연산자가 근거 장부에 직접 확인되지 않음' }); continue; }
          if (wantsMore || wantsLess) {
            // 방향을 말하면 어느 쪽이 큰지도 맞아야 한다 — 문장이 열 머리글(비교 대상) 하나를 지목할 때만 판정한다
            const larger = a.amount.num >= b.amount.num ? a : b;
            const smaller = larger === a ? b : a;
            const named = [a, b].filter((c) => c.label.length >= 2 && text.includes(c.label));
            if (named.length === 1) {
              const expectLarger = wantsMore;
              const okDirection = expectLarger ? named[0] === larger : named[0] === smaller;
              if (!okDirection) { checks.push({ ...base, verdict: 'mismatch', reason: `방향 불일치 — ${named[0]!.label} 은 ${named[0] === larger ? '더 큰' : '더 작은'} 쪽이다` }); continue; }
            }
          }
          best = { ...base, verdict: 'verified', reason: `같은 행(${item})의 두 값 차이가 주장값과 같음 · 유불리 판단은 검증 대상 아님` };
          break;
        }
        if (best) break;
      }
      if (best) break;
    }
    if (!best && hypoEligible) {
      const h = resolveFromHypotheses(text, token, claim, hypotheses, blockHtml, tables, evidenceContext, isSupported);
      if (h) { if (h.verdict === 'hypothetical') best = h; else checks.push(h); }
    }
    if (best) { resolved.set(token, best); checks.push(best); }
    else if (!checks.some((c) => c.claim === token)) checks.push({ kind: 'abs-diff', sentence: text, claim: token, item: '', operands: [], operation: '', result: '', verdict: 'unverifiable', reason: '같은 블록의 표에서 같은 단위·항목의 두 값을 찾지 못함' });
  }
  return { resolved, checks };
}

interface Hypothesis { base: { num: number; unit: string; token: string }; clause: string }

/** 블록이 선언한 가정 기준값들 — "원래 월 100만원을 받을 예정이라면" · 표 머리글 "원래 월 100만원일 때" · "기본 수령액이 월 100만원인 경우" */
function findHypotheses(blockHtml: string): Hypothesis[] {
  const textOf = plain(blockHtml);
  const out: Hypothesis[] = [];
  for (const m of textOf.matchAll(HYPOTHESIS_BASE)) {
    const unit = UNIT_NORM[m[2]!.replace(/\s+/g, '')] || '';
    const num = Number(m[1]!.replace(/,/g, ''));
    if (!unit || !Number.isFinite(num)) continue;
    if (out.some((h) => h.base.num === num && h.base.unit === unit)) continue;
    const start = textOf.lastIndexOf('.', m.index || 0) + 1;
    const end = textOf.indexOf('.', (m.index || 0) + m[0].length);
    out.push({ base: { num, unit, token: `${m[1]!.replace(/,/g, '')}${unit}` }, clause: textOf.slice(start, end < 0 ? undefined : end + 1).trim().slice(0, 160) });
    if (out.length >= 3) break;
  }
  return out;
}

/** 블록 문장들(표 밖) — 피연산자가 놓인 문장이 가정을 명시했는지 보기 위해 */
const sentencesOf = (blockHtml: string): string[] => plain(String(blockHtml || '').replace(/<table[\s\S]*?<\/table>/gi, ' ')).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

function resolveFromHypotheses(
  text: string,
  token: string,
  claim: { num: number; unit: string; token: string },
  hypotheses: Hypothesis[],
  blockHtml: string,
  tables: Array<{ headers: string[]; rows: string[][] }>,
  evidenceContext: string,
  isSupported: (t: string) => boolean,
): DerivedCheck | null {
  const item = (text.match(ITEM_CUE) || [])[1]?.replace(/\s+/g, '') || '';
  if (!item) return null;
  const blockIsExample = EXAMPLE_BLOCK.test(plain(blockHtml));
  // 같은 항목(예: "1년")을 말하는 곳의 같은 단위 값들 — 표 행(머리글이 가정을 말하거나 근거 확인) · 문장(가정 명시·예시 블록·근거 확인)
  const candidates: Array<{ value: { num: number; unit: string; token: string }; where: string; origin: 'evidence' | 'hypothetical' }> = [];
  for (const table of tables) for (const row of table.rows) {
    if (!(row[0] || '').replace(/\s+/g, '').includes(item)) continue;
    row.slice(1).forEach((cell, i) => {
      const v = parseAmount(cell);
      if (!v || v.unit !== claim.unit) return;
      const header = table.headers[i + 1] || '';
      if (isSupported(v.token)) candidates.push({ value: v, where: `표 ${row[0]} · ${header}`, origin: 'evidence' });
      else if (HYPOTHESIS_MARK.test(header) || blockIsExample) candidates.push({ value: v, where: `표 ${row[0]} · ${header}`, origin: 'hypothetical' });
    });
  }
  for (const s of sentencesOf(blockHtml)) {
    if (s === text || !s.replace(/\s+/g, '').includes(item)) continue;
    for (const m of s.matchAll(AMOUNT)) {
      const v = parseAmount(m[0]);
      if (!v || v.unit !== claim.unit) continue;
      if (hypotheses.some((h) => h.base.num === v.num)) continue;                           // 기준값 자체는 피연산자 후보가 아니다
      if (isSupported(v.token)) candidates.push({ value: v, where: s.slice(0, 80), origin: 'evidence' });
      else if (HYPOTHESIS_MARK.test(s) || blockIsExample) candidates.push({ value: v, where: s.slice(0, 80), origin: 'hypothetical' });
    }
  }
  if (candidates.length === 0) return null;
  let firstMismatch: DerivedCheck | null = null;
  for (const h of hypotheses) {
    if (h.base.unit !== claim.unit) continue;
    for (const c of candidates) {
      const diff = Math.abs(h.base.num - c.value.num);
      const operands: DerivedOperand[] = [
        { label: '가정 기준값', value: h.base.token, unit: h.base.unit, sourceIds: [], origin: 'hypothetical' },
        { label: item, value: c.value.token, unit: c.value.unit, sourceIds: c.origin === 'evidence' ? sourceIdsOf(evidenceContext, c.value.token) : [], origin: c.origin },
      ];
      const base: DerivedCheck = { kind: 'hypothetical-diff', sentence: text, claim: token, item, operands, operation: `|${h.base.token} − ${c.value.token}|`, result: `${diff}${claim.unit}`, verdict: 'mismatch', reason: '', hypothesis: h.clause };
      if (Math.abs(diff - claim.num) <= 1e-9) return { ...base, verdict: 'hypothetical', reason: `명시적 가정(${h.base.token} 기준)의 단순 차액 — 계산은 맞지만 사실로 승격하지 않음(EXPLICIT_HYPOTHETICAL_DERIVATION)` };
      if (!firstMismatch) firstMismatch = { ...base, reason: `가정 기준값과 ${c.where} 의 차이 ${diff}${claim.unit} ≠ 주장 ${token}` };
    }
  }
  return firstMismatch;
}
