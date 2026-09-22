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

export type ClaimKind = 'date' | 'range' | 'amount' | 'percent' | 'count' | 'rank' | 'duration';

export interface Claim { text: string; kind: ClaimKind; keys: string[] }
export interface SupportedClaim { claim: string; sourceIds: string[] }
export interface ClaimCheck { supported: SupportedClaim[]; unsupported: string[] }
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
      found.push({ text: raw, kind, keys: claimKeys(raw, kind), start: m.index, end: m.index + m[0].length });
    }
  }
  found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const out: Claim[] = [];
  let lastEnd = -1;
  for (const f of found) {
    if (f.start < lastEnd) continue;
    out.push({ text: f.text, kind: f.kind, keys: f.keys });
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
export function checkClaims(text: string, ledger: LedgerItem[], now: Date = new Date()): ClaimCheck {
  const normalized = ledger.map((l) => ({ id: l.id, text: l.text.includes(' ') || l.text.includes(',') ? norm(l.text) : l.text }));
  const all = normalized.map((l) => l.text).join('\n');
  const year = String(kstYear(now));
  const supported: SupportedClaim[] = [];
  const unsupported: string[] = [];
  for (const c of extractClaims(text)) {
    if (/^20\d{2}년$/.test(norm(c.text))) { if (!all.includes(norm(c.text)) && norm(c.text) !== `${year}년`) unsupported.push(c.text); continue; }
    const ok = c.keys.every((k) => all.includes(k));
    if (!ok) { unsupported.push(c.text); continue; }
    const ids = normalized.filter((l) => c.keys.every((k) => l.text.includes(k))).map((l) => l.id);
    supported.push({ claim: c.text, sourceIds: ids.length ? ids : normalized.filter((l) => c.keys.some((k) => l.text.includes(k))).map((l) => l.id).slice(0, 3) });
  }
  return { supported, unsupported };
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
