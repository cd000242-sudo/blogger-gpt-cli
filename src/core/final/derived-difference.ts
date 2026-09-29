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

export interface DerivedOperand { label: string; value: string; unit: string; sourceIds: string[] }
export interface DerivedCheck {
  kind: 'abs-diff';
  sentence: string;
  claim: string;
  item: string;
  operands: DerivedOperand[];
  operation: string;
  result: string;
  verdict: 'verified' | 'mismatch' | 'unverifiable';
  reason: string;
}

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
  if (tables.length === 0) return { resolved, checks };
  // 문장 분리기는 표의 칸 글자(마침표 없음)를 뒤따르는 문장 **앞**에 붙인다 — 앞머리의 칸 글자를 순서대로 벗겨 낸 실제 문장에서만 단서·방향을 읽는다
  let text = plain(sentence);
  let pos = 0;
  for (const cell of tables.flatMap((t) => [...t.headers, ...t.rows.flat()]).filter(Boolean)) {
    while (text[pos] === ' ') pos += 1;
    if (text.startsWith(cell, pos)) pos += cell.length; else break;
  }
  text = text.slice(pos).trim();
  if (!DIFF_CUE.test(text)) return { resolved, checks };
  const period = periodOf(text);
  const wantsMore = DIRECTION_MORE.test(text);
  const wantsLess = !wantsMore && DIRECTION_LESS.test(text);

  for (const token of unsupported) {
    const claim = parseAmount(token);
    if (!claim) continue;
    let best: DerivedCheck | null = null;
    for (const table of tables) {
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
    if (best) { resolved.set(token, best); checks.push(best); }
    else if (!checks.some((c) => c.claim === token)) checks.push({ kind: 'abs-diff', sentence: text, claim: token, item: '', operands: [], operation: '', result: '', verdict: 'unverifiable', reason: '같은 블록의 표에서 같은 단위·항목의 두 값을 찾지 못함' });
  }
  return { resolved, checks };
}
