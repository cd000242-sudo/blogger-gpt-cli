/**
 * 🧬 v3.8.772 — 값이 **어느 모델·트림·유형·회차의 값**인지(VARIANT SCOPE)를 묶는다. 호출 0회·결정론.
 *
 * 실측(갤럭시 S26 공식 페이지 구조): 시리즈 페이지 한 장에 S26 과 S26+ 의 값이 함께 있고, 상단 일반 문장("약 30분 최대 69%")의 적용 모델은
 * 각주("S26+에만 적용")·비교표 열 머리가 정한다. 771 의 대상·속성 묶기(claim-property)는 **무엇의 무엇**(충전기 출력 vs 기기 충전)만 봐서,
 * 같은 시리즈·같은 속성이면 다른 모델의 69% 도 S26 의 근거로 셌다. 같은 일은 자동차(스탠다드 350km vs 롱레인지 501km)·보험(일반형 6% vs 우대형 12%)·
 * 지원금(1차 vs 2차 모집)에서도 난다.
 *
 * 규칙(값 이름을 코드에 박지 않는다 — 모양과 문서 구조만 본다):
 *   · 변형 이름 = 모델 코드(글자+숫자: S26 · EV3 · A36) 또는 라틴 이름(Product A · Laptop) + 트림(+ · Ultra · FE · Pro · Max · Standard · Long Range …),
 *     단독 트림(○○형 · N차 · 스탠다드 · 롱레인지). 트림 없는 코드는 주장·문서 이름표(제목·소제목·표 머리)에 같은 모양이 있을 때만 모델로 본다(IP68 같은 규격 이름 배제).
 *   · 값의 변형 = ① 같은 절의 가장 가까운 이름 ② 각주("X에만 적용") ③ 표 열 머리 ④ 행 머리 ⑤ 소제목 ⑥ 문서 제목. 주소(URL) 안의 모델 이름은 보지 않는다.
 *   · 문서 제목에 변형이 둘 이상이면(시리즈 페이지 "Product A | Product A+") 이름 없는 값은 **모호(AMBIGUOUS)** — 공통으로 승격하지 않는다(PAGE_ENTITY ≠ CLAIM_ENTITY).
 *     "모두 · 공통 · 둘 다" 가 있으면 명시된 변형 모두에 적용한다.
 *   · 관계: 주장에 변형이 없으면 UNKNOWN(예전 동작) · 근거가 모호하면 AMBIGUOUS · 트림이 같고 이름이 같거나 한쪽이 비면 SAME · 아니면 DIFFERENT.
 *     DIFFERENT·AMBIGUOUS 는 지지도 모순도 아니다(호출부 title-authority).
 */

export interface VariantKey { name: string; trim: string }
export type ScopeVia = 'sentence' | 'common' | 'footnote' | 'column' | 'row' | 'list' | 'caption' | 'heading' | 'document' | 'none' | 'ambiguous';
export interface VariantScope { keys: VariantKey[]; via: ScopeVia; label: string }
export interface VariantMention { key: VariantKey; index: number; end: number; family: boolean; contrast: boolean }
export interface Anchors { shapes: Set<string>; names: Set<string>; trims: Set<string> }
export type VariantRelation = 'SAME' | 'DIFFERENT' | 'AMBIGUOUS' | 'UNKNOWN';
export interface ScopedUnit {
  s: string;
  scope: VariantScope;
  mentions: VariantMention[];
  footnote?: VariantScope;
  isFootnote?: boolean;
  /** 표 행 — 칸마다 위치와 열 머리 변형 */
  cells?: Array<{ start: number; end: number; scope: VariantScope | null }>;
  row?: VariantScope | null;
  /** 칸마다 이름표 글(행 머리 + 열 머리, 변형 이름은 걷음) — 칸 값 곁에 낱말이 없을 때 속성을 여기서 찾는다 */
  cellLabels?: string[] | undefined;
}

export const NO_SCOPE: VariantScope = { keys: [], via: 'none', label: '' };
export const EMPTY_ANCHORS: Anchors = { shapes: new Set(), names: new Set(), trims: new Set() };

const TRIMS: Array<[RegExp, string, 'bound' | 'free']> = [
  [/^(?:plus|플러스)$/i, '+', 'bound'], [/^(?:ultra|울트라)$/i, 'ultra', 'bound'], [/^fe$/i, 'fe', 'bound'],
  [/^(?:pro|프로)$/i, 'pro', 'bound'], [/^(?:max|맥스)$/i, 'max', 'bound'], [/^(?:mini|미니)$/i, 'mini', 'bound'],
  [/^(?:lite|라이트)$/i, 'lite', 'bound'], [/^(?:edge|엣지)$/i, 'edge', 'bound'],
  [/^(?:standard|스탠다드)$/i, 'standard', 'free'], [/^(?:longrange|롱레인지)$/i, 'longrange', 'free'],
];
const CODE = /^([A-Za-z]{1,4})(\d{1,4})([A-Za-z]?)(\+?)(플러스|울트라|프로|맥스|미니|라이트|엣지)?$/;
const LATIN = /^(?=[A-Za-z]*[A-Z])[A-Za-z]+(\+?)$/;
const FAMILY = /^(?:시리즈|series|라인업|lineup)$/i;
const BASE = /^(?:기본형|base)$/i;
const TYPE = /^[가-힣]{2}형$/;
const ROUND = /^\d{1,2}(?:회)?차$/;
const PARTICLE = /(?:에서는|에서|에게|으로는|으로|로는|까지|부터|보다|처럼|이며|이고|입니다|이다|와|과|은|는|이|가|을|를|의|에|로|도|만|용)$/;
const CONTRAST_SUFFIX = /(?:보다|대비)$/;
const CONTRAST_NEXT = /^(?:달리|비교|비해|비하면|다르게|대비|보다)/;
export const COMMON = /모두|공통|둘\s*다|동일하게|동일한|전\s*모델|전\s*기종|전\s*트림|\bboth\b|all\s+(?:models|variants|trims)/i;
const ONLY = /에만\s*(?:적용|해당)|에\s*한(?:함|정)|한정|전용|\bonly\b|exclusive/i;
const FOOTNOTE_HEAD = /^\s*(\*{1,3}|※|†|‡|[¹²³⁴⁵]|\(\d\)|주\s*\))\s*/;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const CLAUSE_BREAK = /,(?!\d)|;|\||、|(?<=[가-힣](?:고|며|지만|는데|면서|반면|으나))\s/g;

type Cls = 'code' | 'latin' | 'trim' | 'family' | 'base' | 'type' | 'round' | 'other';
/** closed — 조사가 붙어 있던 낱말("A와" · "S26은") — 이름은 여기서 끝난다 */
interface Tok { raw: string; w: string; start: number; end: number; cls: Cls; name?: string; shape?: string; trims?: string[]; free?: boolean; closed?: boolean }

function classify(w: string): Omit<Tok, 'raw' | 'start' | 'end' | 'w'> | null {
  const t = TRIMS.find(([re]) => re.test(w));
  if (t) return { cls: 'trim', trims: [t[1]], free: t[2] === 'free' };
  if (FAMILY.test(w)) return { cls: 'family' };
  if (BASE.test(w)) return { cls: 'base' };
  if (TYPE.test(w)) return { cls: 'type', trims: [w] };
  if (ROUND.test(w)) return { cls: 'round', trims: [w.replace('회', '')] };
  const c = w.replace(/^[가-힣]+(?=[A-Za-z])/, '').match(CODE);
  if (c) {
    const glued = c[5] ? TRIMS.find(([re]) => re.test(c[5]!))![1] : '';
    return { cls: 'code', name: `${c[1]}${c[2]}${c[3]}`.toLowerCase(), shape: `${c[1]!.toUpperCase()}#${c[2]!.length}`, trims: [...(c[4] ? ['+'] : []), ...(glued ? [glued] : [])] };
  }
  const l = w.match(LATIN);
  if (l) return { cls: 'latin', name: w.replace(/\+$/, '').toLowerCase(), trims: l[1] ? ['+'] : [] };
  return null;
}

/** 조사를 한 겹씩 벗기며 알아보는 낱말이 되는지 본다("프로는" → "프로", 하지만 "프로" 의 "로" 는 벗기지 않는다) */
function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(/[^\s/·,()[\]|:;“”"'‘’=]+/g)) {
    const raw = m[0]; const start = m.index || 0;
    let w = raw.replace(/[.!?…*]+$/, '');
    let c = classify(w);
    let closed = false;
    for (let i = 0; !c && i < 3 && PARTICLE.test(w); i += 1) { w = w.replace(PARTICLE, ''); c = w ? classify(w) : null; closed = true; }
    out.push({ raw, w, start, end: start + raw.length, ...(c || { cls: 'other' as Cls }), closed });
  }
  // 두 낱말 트림: Long Range · 롱 레인지 · 기본 모델
  for (let i = 0; i + 1 < out.length; i += 1) {
    const a = out[i]!; const b = out[i + 1]!;
    const pair = `${a.w}${b.w}`.toLowerCase();
    if (/^(?:longrange|롱레인지)$/.test(pair)) out.splice(i, 2, { ...b, raw: `${a.raw} ${b.raw}`, start: a.start, cls: 'trim', trims: ['longrange'], free: true });
    else if (pair === '기본모델') out.splice(i, 2, { ...b, raw: `${a.raw} ${b.raw}`, start: a.start, cls: 'base' });
  }
  return out;
}

interface RawMention extends VariantMention { shape?: string | undefined; bare: boolean; latin: boolean; boundOnly: boolean }

function rawMentions(text: string): RawMention[] {
  const src = String(text || '').replace(URL_RE, (u) => ' '.repeat(u.length));
  const toks = tokenize(src);
  const out: RawMention[] = [];
  let i = 0;
  while (i < toks.length) {
    if (toks[i]!.cls === 'other') { i += 1; continue; }
    const run: Tok[] = [toks[i]!];
    while (i + run.length < toks.length) {
      const next = toks[i + run.length]!; const prev = run[run.length - 1]!;
      if (prev.closed || next.cls === 'other' || !/^\s+$/.test(src.slice(prev.end, next.start))) break;
      run.push(next);
    }
    i += run.length;
    const codeAt = run.map((t) => t.cls).lastIndexOf('code');
    const latinEnd = codeAt >= 0 ? -1 : run.findIndex((t) => t.cls !== 'latin');
    const nameToks = codeAt >= 0 ? [run[codeAt]!] : run.slice(0, latinEnd < 0 ? run.length : latinEnd).filter((t) => t.cls === 'latin');
    const rest = codeAt >= 0 ? run.slice(codeAt + 1) : run.slice(nameToks.length);
    const trims: string[] = [...(nameToks.length ? nameToks[nameToks.length - 1]!.trims || [] : [])];
    let family = false; let base = false;
    for (const t of rest) {
      if (t.cls === 'family') family = true;
      else if (t.cls === 'base') base = true;
      else if (t.trims) trims.push(...t.trims);
    }
    const name = codeAt >= 0 ? run[codeAt]!.name! : nameToks.map((t) => t.name).join(' ');
    const trim = base ? '' : [...new Set(trims)].join(' ');
    if (!name && !trim) continue;
    const last = run[run.length - 1]!;
    const after = src.slice(last.end, last.end + 12).trim();
    out.push({
      key: { name, trim }, index: run[0]!.start, end: last.end, family,
      contrast: CONTRAST_SUFFIX.test(last.raw) || (/[와과]$/.test(last.raw) && CONTRAST_NEXT.test(after)) || /^(?:대비|보다)/.test(after),
      shape: codeAt >= 0 ? run[codeAt]!.shape : undefined,
      bare: !trim && !family && !base,
      latin: codeAt < 0 && !!name,
      boundOnly: !name && rest.every((t) => t.cls === 'trim' && !t.free),
    });
  }
  return out;
}

/**
 * 모델로 볼 이름표 — 주장 줄(제목·소제목)의 코드 모양, 이름표(문서 제목·소제목·표 머리)에서 트림과 함께 나오거나 다른 코드와 나란히 나온 코드,
 * 트림과 함께 나온 라틴 이름·트림 묶음.
 */
export function anchorsFrom(claimLines: ReadonlyArray<string>, labels: ReadonlyArray<string> = []): Anchors {
  const a: Anchors = { shapes: new Set(), names: new Set(), trims: new Set() };
  const add = (text: string, isClaim: boolean) => {
    const ms = rawMentions(text);
    const codes = new Set(ms.filter((m) => m.shape).map((m) => m.key.name));
    for (const m of ms) {
      if (m.shape && (isClaim || !m.bare || codes.size >= 2)) a.shapes.add(m.shape);
      if (m.latin && m.key.trim) a.names.add(m.key.name);
      if (m.key.name && m.key.trim) a.trims.add(m.key.trim);
    }
  };
  for (const t of claimLines) add(t, true);
  for (const t of labels) add(t, false);
  return a;
}

/** 글 안의 변형 언급(주소 안은 제외) */
export function variantMentions(text: string, anchors: Anchors): VariantMention[] {
  return rawMentions(text).filter((m) => {
    if (m.boundOnly) return anchors.trims.has(m.key.trim);
    if (!m.bare) return true;
    if (m.shape) return anchors.shapes.has(m.shape);
    if (m.latin) return anchors.names.has(m.key.name);
    return true;
  }).map(({ key, index, end, family, contrast }) => ({ key, index, end, family, contrast }));
}

const compatible = (a: VariantKey, b: VariantKey) => (a.trim === b.trim || a.trim === '*' || b.trim === '*') && (a.name === b.name || !a.name || !b.name);
function dedupe(keys: VariantKey[]): VariantKey[] {
  const out: VariantKey[] = [];
  for (const k of keys) {
    const at = out.findIndex((o) => o.trim === k.trim && compatible(o, k));
    if (at < 0) out.push(k);
    else if (!out[at]!.name && k.name) out[at] = k;
  }
  return out;
}
export const keyLabel = (k: VariantKey) => [k.name, k.trim === '+' ? '+' : k.trim === '*' ? '(공통)' : k.trim ? ` ${k.trim}` : ''].join('').trim();
const scopeOf = (keys: VariantKey[], via: ScopeVia): VariantScope => ({ keys, via, label: keys.map(keyLabel).join('·') });
const ambiguous = (label: string): VariantScope => ({ keys: [], via: 'ambiguous', label });

/** 언급 묶음 → 범위. 변형 하나면 그것, 둘 이상이면 공통 표지가 있을 때만 모두, 아니면 모호. 시리즈 언급만 있으면 모호(공통 표지면 시리즈 전체) */
export function scopeFromMentions(ms: ReadonlyArray<VariantMention>, text: string, via: ScopeVia): VariantScope {
  const usable = ms.filter((m) => !m.contrast);
  if (!usable.length) return NO_SCOPE;
  const keys = dedupe(usable.filter((m) => !m.family).map((m) => m.key));
  const common = COMMON.test(text);
  if (!keys.length) {
    const fam = dedupe(usable.map((m) => ({ name: m.key.name, trim: '*' })));
    return common ? scopeOf(fam, 'common') : ambiguous(`${fam.map(keyLabel).join('·')} 시리즈`);
  }
  if (keys.length === 1) return scopeOf(keys, via);
  return common ? scopeOf(keys, 'common') : ambiguous(keys.map(keyLabel).join('·'));
}

function clauseAround(text: string, index: number, from: number, to: number): [number, number] {
  let s = from; let e = to;
  for (const m of text.slice(from, to).matchAll(CLAUSE_BREAK)) {
    const at = from + (m.index || 0);
    if (at < index) s = at + m[0].length; else { e = at; break; }
  }
  return [s, e];
}

/** 나란히 적은 변형("S26과 S26+는 25W" · "A, A+ 및 B")은 함께 주어다 — 고른 언급 앞으로 "와·과·및·쉼표"로 이어진 언급을 모은다 */
function coordinated(text: string, ms: ReadonlyArray<VariantMention>, pick: VariantMention): VariantScope {
  const chain = [pick];
  for (let k = ms.indexOf(pick) - 1; k >= 0; k -= 1) {
    const between = text.slice(ms[k]!.end - 1, chain[0]!.index);
    if (/^[와과]\s+$/.test(between) || /^\S\s*(?:,|·|\/|및|&|and)\s*$/.test(between)) chain.unshift(ms[k]!); else break;
  }
  const keys = dedupe(chain.filter((m) => !m.family).map((m) => m.key));
  return keys.length >= 2 ? scopeOf(keys, 'common') : scopeOf([pick.key], 'sentence');
}

/** 값(index) 하나의 변형: 같은 절 → 문장(칸) → 각주 → 열 머리 → 행 머리 → 소제목·문서 */
export function valueScope(u: ScopedUnit, index: number): VariantScope {
  const cellIdx = u.cells ? u.cells.findIndex((c) => index >= c.start && index < c.end) : -1;
  const seg = cellIdx >= 0 ? u.cells![cellIdx]! : { start: 0, end: u.s.length };
  const ms = u.mentions.filter((m) => m.index >= seg.start && m.end <= seg.end && !m.contrast);
  if (ms.length) {
    const [cs, ce] = clauseAround(u.s, index, seg.start, seg.end);
    // "Product A, Product A+ 모두 25W" — 값의 절이 공통을 말하면 문장에 나온 변형 모두
    if (COMMON.test(u.s.slice(cs, ce))) { const c = scopeFromMentions(ms, u.s.slice(cs, ce), 'sentence'); if (c.keys.length) return c; }
    const inClause = ms.filter((m) => m.index >= cs && m.end <= ce);
    if (inClause.length) {
      const all = scopeFromMentions(inClause, u.s.slice(cs, ce), 'sentence');
      if (all.via !== 'ambiguous' || !inClause.some((m) => !m.family)) return all;
      const pick = inClause.filter((m) => !m.family && m.end <= index).pop() || inClause.find((m) => !m.family && m.index > index)!;
      return coordinated(u.s, ms, pick);
    }
    const whole = scopeFromMentions(ms, u.s.slice(seg.start, seg.end), 'sentence');
    if (whole.via !== 'ambiguous') return whole;
    const before = ms.filter((m) => !m.family && m.end <= index).pop();
    if (before) return coordinated(u.s, ms, before);
    if (!u.footnote && !(cellIdx > 0 && (u.cells![cellIdx]!.scope || u.row))) return whole;
  }
  if (u.footnote) return u.footnote;
  if (cellIdx > 0 && u.cells![cellIdx]!.scope) return u.cells![cellIdx]!.scope!;
  if (cellIdx > 0 && u.row) return u.row;
  return u.scope;
}

/** 주장 변형 ↔ 근거 변형 */
export function variantRelation(claim: VariantScope, evidence: VariantScope): VariantRelation {
  if (!claim.keys.length) return 'UNKNOWN';
  if (evidence.via === 'ambiguous') return 'AMBIGUOUS';
  if (!evidence.keys.length) return 'UNKNOWN';
  return claim.keys.some((a) => evidence.keys.some((b) => compatible(a, b))) ? 'SAME' : 'DIFFERENT';
}

/** 문장 나누기 — title-authority 와 같은 규칙(표 칸은 " | ", 블록 끝은 줄바꿈) */
export const sentencesOf = (text: string): string[] => String(text || '')
  .replace(/<\/(?:td|th)\s*>/gi, ' | ')
  .replace(/<br\s*\/?>|<\/(?:p|div|li|tr|h[1-6]|blockquote|summary|section|details|table)\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
  .split(/(?<=[.!?。])\s+|\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasValue = (s: string) => /\d/.test(s.replace(URL_RE, ''));

/** 각주면 그 범위와 표지 — "* Product A+에만 적용" · "※ S26+ 기준" · "S26+에만 해당합니다" */
function footnoteOf(u: ScopedUnit): { scope: VariantScope; marker: string } | null {
  const head = u.s.match(FOOTNOTE_HEAD);
  if (!head && !(ONLY.test(u.s) && u.s.length <= 80)) return null;
  const scope = scopeFromMentions(u.mentions, u.s, 'footnote');
  if (!scope.keys.length) return null;
  return { scope, marker: head ? head[1]!.replace(/\s+/g, '') : '' };
}
/** 각주를 앞 값에 잇는다 — 같은 표지가 값 바로 뒤에 붙은 문장("69%*")이 있으면 그것들, 없으면 바로 앞의 값 있는 문장 */
function bindFootnotes(units: ScopedUnit[], from: number): void {
  for (let i = from; i < units.length; i += 1) {
    const f = footnoteOf(units[i]!);
    if (!f) continue;
    units[i] = { ...units[i]!, isFootnote: true };
    const window = units.slice(from, i).map((u, k) => ({ u, k: from + k })).filter(({ u }) => !u.isFootnote && hasValue(u.s));
    const esc = f.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const marked = f.marker ? window.filter(({ u }) => new RegExp(`[\\d%A-Za-z가-힣)]${esc}(?![*])`).test(u.s)) : [];
    const targets = marked.length ? marked : window.slice(-1);
    for (const { k } of targets) units[k] = { ...units[k]!, footnote: f.scope };
  }
}

/** 평문(팩트체크 문단·근거 본문) → 범위 붙은 문장. 문서 범위 = 페이지 제목(있으면) 아니면 문단 전체의 언급 */
export function scopePlain(text: string, opts: { pageTitle?: string | undefined; anchors: Anchors }): ScopedUnit[] {
  const sentences = sentencesOf(String(text || '').replace(URL_RE, ' '));
  const ms = sentences.map((s) => variantMentions(s, opts.anchors));
  const doc = opts.pageTitle !== undefined
    ? scopeFromMentions(variantMentions(opts.pageTitle, opts.anchors), opts.pageTitle, 'document')
    : scopeFromMentions(ms.flat(), sentences.join(' '), 'document');
  const units: ScopedUnit[] = sentences.map((s, i) => ({ s, scope: doc, mentions: ms[i]! }));
  bindFootnotes(units, 0);
  return units;
}

/** HTML(최종 글) → 범위 붙은 문장·표 행. 제목·소제목은 문장이 아니라 범위를 정한다. exclude 는 문장에서 걷을 글(제목 줄) */
export function scopeHtml(html: string, opts: { pageTitle?: string | undefined; anchors: Anchors; exclude?: ReadonlyArray<string> | undefined }): ScopedUnit[] {
  const src = String(html || '');
  const titleText = opts.pageTitle !== undefined ? opts.pageTitle : plain((src.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const doc = scopeFromMentions(variantMentions(titleText, opts.anchors), titleText, 'document');
  const units: ScopedUnit[] = [];
  let h2 = doc; let section = doc; let sectionStart = 0;
  const scrub = (s: string) => { let out = s; for (const x of opts.exclude || []) if (x) out = out.split(x).join(' '); return out; };
  const headingScope = (text: string, parent: VariantScope) => { const ms = variantMentions(text, opts.anchors); return ms.length ? scopeFromMentions(ms, text, 'heading') : parent; };
  const pushText = (chunk: string, scope: VariantScope) => {
    for (const s of sentencesOf(scrub(chunk))) units.push({ s, scope, mentions: variantMentions(s, opts.anchors) });
  };
  const BLOCK = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>|<table\b[\s\S]*?<\/table>|<(ul|ol)\b[\s\S]*?<\/\3>/gi;
  let last = 0;
  for (const m of src.matchAll(BLOCK)) {
    pushText(src.slice(last, m.index), section);
    last = (m.index || 0) + m[0].length;
    if (m[1]) {
      const level = Number(m[1]);
      if (level === 1) continue;
      bindFootnotes(units, sectionStart); sectionStart = units.length;
      if (level === 2) { h2 = headingScope(plain(m[2] || ''), doc); section = h2; } else section = headingScope(plain(m[2] || ''), h2);
    } else if (m[3]) {
      // 목록 묶음 — 바로 앞 문장이 변형 하나를 이름 붙여 여는 머리("Product A+ 사양:")면 항목이 그 범위를 받는다
      const lead = units[units.length - 1];
      const leadScope = lead && lead.mentions.length && /[:：]\s*$/.test(lead.s) ? scopeFromMentions(lead.mentions, lead.s, 'list') : null;
      pushText(m[0], leadScope && leadScope.keys.length ? leadScope : section);
    } else {
      const caption = plain((m[0].match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i) || [])[1] || '');
      const tableScope = caption ? headingScope(caption, section) : section;
      const rows = [...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((r) => [...r[0].matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => plain(c[2] || '')));
      const header = rows[0] || [];
      const colScopes = header.map((h) => { const ms = variantMentions(h, opts.anchors); return ms.length ? scopeFromMentions(ms, h, 'column') : null; });
      rows.forEach((cells, r) => {
        let at = 0;
        const ranges = cells.map((c, i) => { const start = at; at += c.length + (i < cells.length - 1 ? 3 : 0); return { start, end: start + c.length, scope: r > 0 ? colScopes[i] || null : null }; });
        const s = cells.join(' | ');
        if (!s.trim()) return;
        const rowMs = variantMentions(cells[0] || '', opts.anchors);
        const cellLabels = r > 0 ? cells.map((_, i) => (i > 0 ? `${withoutNames(cells[0] || '', opts.anchors)} ${withoutNames(header[i] || '', opts.anchors)}` : '')) : undefined;
        units.push({ s, scope: tableScope, mentions: variantMentions(s, opts.anchors), cells: ranges, row: r > 0 && rowMs.length ? scopeFromMentions(rowMs, cells[0]!, 'row') : null, cellLabels });
      });
    }
  }
  pushText(src.slice(last), section);
  bindFootnotes(units, sectionStart);
  return units;
}

/** 이름표에서 변형 이름을 걷은 글 — "갤럭시 S26" 열 머리는 속성이 아니다 */
function withoutNames(text: string, anchors: Anchors): string {
  let out = text;
  for (const m of [...variantMentions(text, anchors)].reverse()) out = `${out.slice(0, m.index)} ${out.slice(m.end)}`;
  return out.replace(/\s+/g, ' ').trim();
}

/** 이름표(문서 제목·소제목·표 머리·캡션) — 코드 모양을 모을 곳 */
export function labelsOf(html: string): string[] {
  const src = String(html || '');
  const out = [...src.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>|<caption\b[^>]*>([\s\S]*?)<\/caption>/gi)].map((m) => plain(m[2] || m[3] || ''));
  for (const t of src.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const first = t[0].match(/<tr\b[\s\S]*?<\/tr>/i);
    if (first) out.push([...first[0].matchAll(/<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => plain(c[2] || '')).join(' | '));
  }
  return out.filter(Boolean);
}

/** 계보용 요약 — 팩트체크 문단이 **어느 변형**을 말하는지(문서 범위·언급된 변형·각주). 주소만으로 변형을 정하지 않는다 */
export function describeScope(text: string, pageTitle?: string): { document: string; variants: string[]; footnotes: Array<{ text: string; scope: string }> } {
  const src = String(text || '');
  const anchors = anchorsFrom([src.replace(URL_RE, ' '), ...(pageTitle ? [pageTitle] : [])]);
  const units = scopePlain(src, { pageTitle, anchors });
  const doc = units[0]?.scope || NO_SCOPE;
  const variants = [...new Set(units.flatMap((u) => u.mentions.map((m) => (m.family ? `${m.key.name} 시리즈` : keyLabel(m.key)))))];
  return {
    document: doc.via === 'ambiguous' ? `AMBIGUOUS(${doc.label})` : doc.keys.length ? doc.label : 'NONE',
    variants,
    footnotes: units.filter((u) => u.isFootnote).map((u) => ({ text: u.s.slice(0, 120), scope: footnoteOf(u)?.scope.label || '' })),
  };
}
