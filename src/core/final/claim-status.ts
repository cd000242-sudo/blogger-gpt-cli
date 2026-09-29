/**
 * 🏷️ v3.8.763 — 주장의 상태(claim status) 보존. 호출 0회·결정론.
 *
 * 실측(run 223b32): 근거는 "12%에서 15%로 높이는 방안을 추진한다", "지방 … 25%를 지원할 계획", "가정하면 … 270만원", "연 8% 가정 … 약 2138만원 예상".
 * 패킷(LLM 정리)은 "15%로 개선됐으며, 지방 중소기업 근무 시 25%이다" 로 확정 사실로 바꿨고 Writer 는 그대로 옮겼다. 값 검사는 숫자가 근거에 있으니 통과시켰다.
 * 최초 이상 단계: PACKET. 이 모듈은 값의 존재와 별개로 **값의 상태**(현재 확정 / 미래 확정 / 조건부 / 추진 / 예정 / 추정 / 과거)를 근거에서 읽어,
 * 패킷·본문이 근거보다 확정성을 높이면 그 문장의 술어를 근거의 상태로 고친다(v3.8.764 claim-status-rewrite · 약화만, 새 호출 없음). 못 고치면 FLAG. 정책 용어·상품명·값은 코드에 없다.
 *
 * 함께 다루는 표기 안전: 근거의 분수 표기 "a/b%" 를 본문이 "a분의 b퍼센트" 로 바꾸면 원 표기로 되돌린다(뜻이 뒤집힐 수 있다).
 */
import { containsValueToken, normalizeForMatch } from './number-token';
import { extractValueTokens } from './fact-integrity';
import { rewriteSentence, metaOf, isDisclaimer } from './claim-status-rewrite';

export type ClaimStatus = 'CURRENT_CONFIRMED' | 'FUTURE_CONFIRMED' | 'PAST' | 'PLANNED' | 'ESTIMATED' | 'PROPOSED' | 'CONDITIONAL' | 'UNKNOWN';
/** 확정성 — 높을수록 강한 주장. 패킷·본문은 근거보다 높아질 수 없다 */
export const STATUS_STRENGTH: Record<ClaimStatus, number> = { CURRENT_CONFIRMED: 5, FUTURE_CONFIRMED: 4, PAST: 4, PLANNED: 3, ESTIMATED: 2, PROPOSED: 2, CONDITIONAL: 1, UNKNOWN: 0 };
export const STATUS_LABEL: Record<ClaimStatus, string> = { CURRENT_CONFIRMED: '현재 확정', FUTURE_CONFIRMED: '시행 확정(미래)', PAST: '과거', PLANNED: '예정', ESTIMATED: '추정·예상', PROPOSED: '추진·검토', CONDITIONAL: '조건부', UNKNOWN: '미상' };

const MARKERS: Array<{ status: ClaimStatus; re: RegExp }> = [
  { status: 'CONDITIONAL', re: /(?:통과|확정|승인|시행|개정|도입)\s*(?:시|되면|하면|할\s*경우|될\s*경우|을\s*전제)|을\s*전제로|전제로\s*한다|(?:높아|낮아|늘어|바뀌|바뀌게\s*되|변경되|개편되)(?:면|지면)|경우에\s*한해|우천\s*시|조건이\s*충족되면/ },
  { status: 'PROPOSED', re: /방안(?:을|이|도)?\s*(?:추진|검토|담|마련|제시|포함)|추진(?:한다|하고|된다|됩니다|되고|돼|중|…|\s|$)|검토\s*중|검토하고|검토되고|검토돼|건의|제안|[가-힣]{1,3}(?:편|정|법|산)안(?:에|이|은|을)?\s*(?:담|포함|반영|국회|통과|기준)|추진…|상향할\s*계획|(?:추진|검토)되는\s*대로/ },
  { status: 'PLANNED', re: /예정(?:이다|입니다|이며|으로|이라|입|이고|이죠|이에요|돼|대로)|예정$|(?:할|될|한다는|하는)\s*계획|계획(?:이다|입니다|이며|이고|이죠|이에요|대로|이\s*제시)|시행\s*예정|도입\s*예정|적용\s*예정|출시\s*예정|지원\s*계획|지원할\s*계획|목표(?:다|이다|입니다|로)/ },
  { status: 'ESTIMATED', re: /예상(?:된다|됩니다|치|액|되는|이다|되|돼)|추산|추정|전망|가정(?:하면|할\s*때|한|해서|에서는)|수준으로\s*예상|시뮬레이션/ },
  { status: 'FUTURE_CONFIRMED', re: /(?:내년|20\d{2}년|내달|다음\s*달)\s*(?:부터|에|중)[가-힣0-9\s,·%]{0,16}?(?:시행|적용|도입|출시|운영)(?:된다|됩니다|한다|합니다)/ },
  { status: 'PAST', re: /지난해|작년|당시|이전\s*회차|과거|1차\s*(?:모집|가입)에서는|예전/ },
];
/** 값 바로 앞의 "현재 확정" 표지 — 이 값이 지금 적용되는 값이라는 명시 */
const EXPLICIT_CURRENT_BEFORE = /(?:현행|현재|지금|올해|이번\s*(?:회차|모집|가입기간)|기존)\s*(?:[가-힣]{0,6}\s*){0,2}$/;
const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const sentencesOf = (text: string) => plain(text).split(/(?<=[.!?。])\s+|\n/).map((s) => s.trim()).filter((s) => s.length >= 6);

/** 문장의 상태 — 여러 표지가 있으면 가장 약한(확정성이 낮은) 것 */
export function classifyClaimStatus(sentence: string): { status: ClaimStatus; marker: string } {
  const s = plain(sentence);
  let best: { status: ClaimStatus; marker: string } | null = null;
  for (const m of MARKERS) {
    const hit = s.match(m.re);
    if (!hit) continue;
    if (!best || STATUS_STRENGTH[m.status] < STATUS_STRENGTH[best.status]) best = { status: m.status, marker: hit[0] };
  }
  return best || { status: 'CURRENT_CONFIRMED', marker: '' };
}

/** 값의 성격 — 정책·제도의 상태(추진·계획·조건)와 따로 본다. "개편안 기준 예상액" 은 status=PROPOSED, qualifier=ESTIMATE */
export type ValueQualifier = 'ESTIMATE' | 'TARGET';
const ESTIMATE_RE = MARKERS.find((m) => m.status === 'ESTIMATED')!.re;
const qualifierOf = (sentence: string): ValueQualifier | null => (ESTIMATE_RE.test(sentence) ? 'ESTIMATE' : /목표/.test(sentence) ? 'TARGET' : null);
export interface SourceValueStatus { value: string; status: ClaimStatus; marker: string; sentence: string; explicitCurrent: boolean; qualifier?: ValueQualifier | null }
/**
 * 근거에서 값의 상태를 읽는다.
 *  · 값 바로 앞에 "현행·현재·올해·기존" 이 붙은 문장이 있으면 CURRENT_CONFIRMED(그 값은 지금 적용되는 값).
 *  · 아니면 표지 있는 문장들 가운데 가장 강한 상태(예: 추진·예정·추정 중 예정).
 *  · 표지 없는 문장만 있으면 CURRENT_CONFIRMED(기본). 근거에 값이 없으면 UNKNOWN.
 * 같은 숫자라도 상태가 다르면 다른 사실이다("현행 12%" 와 "15%로 높이는 방안" 의 15%).
 */
export function sourceStatusForValue(value: string, evidenceContext: string): SourceValueStatus {
  const token = normalizeForMatch(value);
  const hits: SourceValueStatus[] = [];
  const extraUnit = /(?:km|kg|tb|gb|mb|㎡|평|조원)$/i.test(token);
  for (const sentence of sentencesOf(evidenceContext)) {
    const norm = normalizeForMatch(sentence);
    if (extraUnit ? !norm.replace(/\s+/g, '').includes(token.replace(/\s+/g, '')) : !containsValueToken(norm, token)) continue;
    const at = norm.indexOf(token.replace(/\s+/g, ''));
    const before = at >= 0 ? norm.slice(Math.max(0, at - 24), at) : '';
    const explicitCurrent = EXPLICIT_CURRENT_BEFORE.test(before);
    const c = classifyClaimStatus(sentence);
    // 조건·가정 표지가 값 **뒤**에 오면(“월 50만원을 납입한다고 가정하면 …”, “예산 통과 시 …”) 그 값은 조건·가정의 입력이지 결과가 아니다 — 그 문장에서는 현재 값으로 본다
    const markerAt = c.marker ? norm.indexOf(normalizeForMatch(c.marker)) : -1;
    const antecedent = /가정|통과|되면|하면|경우|시$/.test(c.marker);
    const inputOfCondition = antecedent && markerAt > at && at >= 0;
    const status: ClaimStatus = explicitCurrent || inputOfCondition ? 'CURRENT_CONFIRMED' : c.status;
    hits.push({ value, status, marker: explicitCurrent ? (before.match(/현행|현재|지금|올해|이번|기존/) || [''])[0] : inputOfCondition ? '' : c.marker, sentence: sentence.slice(0, 200), explicitCurrent, qualifier: status === 'CURRENT_CONFIRMED' ? null : qualifierOf(sentence) });
  }
  if (hits.length === 0) return { value, status: 'UNKNOWN', marker: '', sentence: '', explicitCurrent: false };
  const explicit = hits.find((h) => h.explicitCurrent);
  if (explicit) return explicit;
  const marked = hits.filter((h) => h.status !== 'CURRENT_CONFIRMED');
  const unmarked = hits.length - marked.length;
  // 표지 없는 문장(기본 = 현재)이 표지 있는 문장보다 많거나 같으면 현재 값으로 본다 — 흔한 값(6%·50만원)이 어느 문장의 "계획" 곁에 한 번 나왔다고 예정 값이 되지 않게
  if (marked.length === 0 || marked.length <= unmarked) return hits.find((h) => h.status === 'CURRENT_CONFIRMED') || hits[0]!;
  return marked.sort((a, b) => STATUS_STRENGTH[b.status] - STATUS_STRENGTH[a.status])[0]!;
}

export interface StrengthenedValue { value: string; source: SourceValueStatus; claimStatus: ClaimStatus }
/** 문장이 근거보다 확정성을 높인 값들 */
/** 확정된 상태인가(현재·미래 확정·과거) — 예정·추정·추진·조건부는 미확정 묶음. 미확정 안에서의 차이(추진↔조건부)는 강화로 보지 않는다 */
const isConfirmed = (s: ClaimStatus) => STATUS_STRENGTH[s] >= 4;
/** 값 토큰 — fact-integrity 의 값 + 상태 대상인 단위(거리·용량·무게) 몇 개. 연도 단독은 뺀다 */
const EXTRA_UNIT = /(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:km|kg|TB|GB|MB|㎡|평|조\s*원)/g;
export function valueTokensOf(sentence: string): string[] {
  const base = extractValueTokens(sentence).filter((v) => !/^20\d{2}년$/.test(v));
  const extra = [...plain(sentence).matchAll(EXTRA_UNIT)].map((m) => m[0].replace(/\s+/g, ''));
  return [...new Set([...base, ...extra])];
}

export function findStrengthenedValues(sentence: string, evidenceContext: string): StrengthenedValue[] {
  const claim = classifyClaimStatus(sentence);
  const out: StrengthenedValue[] = [];
  for (const value of valueTokensOf(sentence)) {
    const src = sourceStatusForValue(value, evidenceContext);
    if (src.status === 'UNKNOWN' || src.status === 'CURRENT_CONFIRMED') continue;
    // 미확정(예정·추진·추정·조건부) → 확정(현재·미래 확정·과거), 또는 미래 확정·과거 → 현재 확정이면 강화
    const strengthened = (isConfirmed(claim.status) && !isConfirmed(src.status)) || (claim.status === 'CURRENT_CONFIRMED' && isConfirmed(src.status));
    if (strengthened) out.push({ value, source: src, claimStatus: claim.status });
  }
  return out;
}

/** 상태 주석 — 근거의 표지를 그대로 인용한다(값·용어를 지어내지 않는다) */
export function statusNote(values: StrengthenedValue[]): string {
  const parts = values.map((v) => `${v.value}: ${STATUS_LABEL[v.source.status]}${v.source.marker ? `('${v.source.marker}')` : ''}`);
  return `[상태 주의 — 근거 기준 확정 값 아님: ${[...new Set(parts)].join(' · ')}]`;
}

/** 본문에 남으면 안 되는 내부 표지 — 763 괄호 주석 · Writer 보기 이름표. Writer 가 옮겨 적었으면 지운다 */
const INTERNAL_NOTE = /\s*\[상태 주의 — 근거 기준 확정 값 아님:[^\]]*\]|\[(?:예정|추정·예상|추진·검토|조건부|시행 확정\(미래\)|과거) — 현재 확정 값 아님\]\s*/g;
/** 최종 HTML 검사용 — 이 중 하나라도 보이면 내부 판정이 새어 나간 것 */
export const INTERNAL_STATUS_TOKEN = /\[상태 주의|CURRENT_CONFIRMED|FUTURE_CONFIRMED|PROPOSED|CONDITIONAL|ESTIMATED|PLANNED|현재 확정 값 아님/;

export interface StatusChange { sentence: string; values: StrengthenedValue[]; action: 'rewritten' | 'flagged'; after: string; reason: string; droppedDisclaimer?: string }
/**
 * 문장 하나 — 근거보다 확정적으로 쓴 값이 있으면 술어를 근거의 상태로 고친다(claim-status-rewrite). 못 고치면 그대로 두고 flagged(면책문을 붙이지 않는다).
 * 고친 문장이 여전히 강화로 잡히면(술어 해석이 어긋난 것) 고치지 않는다 — 두 번 돌아도 결과가 같다.
 */
export function correctSentence(sentence: string, evidenceContext: string): StatusChange | null {
  const values = findStrengthenedValues(sentence, evidenceContext);
  if (values.length === 0) return null;
  const r = rewriteSentence(sentence, values, (v) => metaOf(v.source));
  if (r.action === 'rewritten') {
    const still = findStrengthenedValues(r.after, evidenceContext).filter((x) => values.some((v) => v.value === x.value));
    if (still.length > 0) return { sentence: sentence.trim(), values, action: 'flagged', after: sentence, reason: `still-strong:${still.map((x) => x.value).join(',')}` };
  }
  return { sentence: sentence.trim(), values, action: r.action, after: r.after, reason: r.reason };
}

/**
 * 텍스트(태그 없음)의 문장마다 상태를 고친다. 질문 문장·면책 문장은 건너뛴다. 강한 문장을 고쳤으면 바로 뒤의 면책문("다만 아직 확정은 아닙니다")은 함께 남기지 않는다.
 * 바뀐 문장이 없으면 원문을 그대로 돌려준다(공백·줄바꿈 보존).
 */
export function annotateText(text: string, evidenceContext: string): { text: string; changes: StatusChange[] } {
  const changes: StatusChange[] = [];
  const source = String(text || '').replace(INTERNAL_NOTE, '');
  const parts = source.split(/(?<=[.!?])(\s+)/);   // [문장, 공백, 문장, 공백, …]
  let touched = source !== String(text || '');
  for (let i = 0; i < parts.length; i += 2) {
    const raw = parts[i]!;
    const lead = (raw.match(/^\s*/) || [''])[0];
    const s = raw.slice(lead.length);
    if (!s || /\?\s*$/.test(s) || isDisclaimer(s)) continue;
    const c = correctSentence(s, evidenceContext);
    if (!c) continue;
    changes.push(c);
    if (c.action !== 'rewritten') continue;
    parts[i] = `${lead}${c.after}`;
    touched = true;
    const next = parts[i + 2];
    if (next !== undefined && isDisclaimer(next.trim())) { c.droppedDisclaimer = next.trim(); parts.splice(i + 1, 2); }
  }
  return { text: touched ? parts.join('') : String(text || ''), changes };
}

/** HTML 의 태그 밖 글자에만 — script/style 은 건드리지 않는다 */
export function annotateHtml(html: string, evidenceContext: string, location = ''): { html: string; changes: Array<StatusChange & { location: string }> } {
  const changes: Array<StatusChange & { location: string }> = [];
  const out = String(html || '').split(/(<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>)/gi).map((seg, i) => {
    if (i % 2 === 1) return seg;
    return seg.replace(/(<[^>]*>)|([^<]+)/g, (_all, tag: string, text: string) => {
      if (tag) return tag;
      const r = annotateText(text, evidenceContext);
      for (const c of r.changes) changes.push({ location, ...c });
      return r.text;
    });
  }).join('');
  return { html: out, changes };
}

const STAGE: Record<ClaimStatus, string> = { CURRENT_CONFIRMED: '현재 적용', FUTURE_CONFIRMED: '앞으로 시행', PAST: '과거 기준', PLANNED: '계획 단계', ESTIMATED: '예상치', PROPOSED: '추진·검토 단계', CONDITIONAL: '조건부', UNKNOWN: '상태 미확인' };
/** Writer 보기용 한 줄 — 문장을 못 고친 패킷 항목에만. 자연어뿐(내부 판정명 없음) */
export function writerStatusHint(values: StrengthenedValue[]): string {
  const parts = [...new Set(values.map((v) => `${v.value} ${STAGE[v.source.status]}${v.source.qualifier === 'ESTIMATE' && v.source.status !== 'ESTIMATED' ? '·예상치' : v.source.qualifier === 'TARGET' ? '·목표치' : ''}`))];
  return `근거에서는 ${parts.join(', ')} — 현재 시행 중인 사실로 쓰지 말 것`;
}

/**
 * 패킷 문장(claim) — 값이 근거보다 확정적으로 적혔으면 문장을 근거의 상태로 고친다. 상태 메타(status·statusNote)는 trace·검증용으로 남기고 문장에는 싣지 않는다.
 * 못 고친 문장은 그대로 두고 statusHint(자연어)만 달아 Writer 보기에서 곁에 보인다.
 */
export function annotateClaims<T extends { claim: string }>(claims: T[], evidenceContext: string): { claims: Array<T & { status?: ClaimStatus; statusNote?: string; statusAction?: 'rewritten' | 'flagged'; statusHint?: string }>; changed: number } {
  let changed = 0;
  const out = claims.map((c) => {
    const ch = correctSentence(c.claim, evidenceContext);
    if (!ch) return c;
    changed += 1;
    const weakest = ch.values.map((v) => v.source.status).sort((a, b) => STATUS_STRENGTH[a] - STATUS_STRENGTH[b])[0]!;
    const meta = { status: weakest, statusNote: statusNote(ch.values), statusAction: ch.action };
    return ch.action === 'rewritten' ? { ...c, claim: ch.after, ...meta } : { ...c, ...meta, statusHint: writerStatusHint(ch.values) };
  });
  return { claims: out, changed };
}

/** 패킷 값(number) 의 상태 — 근거에서 읽는다. CURRENT 가 아니면 Writer 보기에서 "판단 기준" 이 아니라 배경으로 내린다 */
export function valueStatus(value: string, evidenceContext: string): ClaimStatus { return sourceStatusForValue(value, evidenceContext).status; }

interface PacketLike { facts?: Array<{ claim: string }>; eligibility?: Array<{ claim: string }>; conditions?: Array<{ claim: string }>; officialStatements?: Array<{ claim: string }>; conflictingInformation?: Array<{ claim: string }>; numbers?: Array<{ value: string; status?: ClaimStatus }> }
/** 패킷 전체 — 문장에는 상태 주석, 값에는 status 필드. 근거보다 확정적인 것만 손댄다(약화만) */
export function annotatePacket<T extends PacketLike>(packet: T, evidenceContext: string): { packet: T; claimChanges: number; valueStatuses: Array<{ value: string; status: ClaimStatus }> } {
  let claimChanges = 0;
  const out: PacketLike = { ...packet };
  for (const key of ['facts', 'eligibility', 'conditions', 'officialStatements', 'conflictingInformation'] as const) {
    const rows = packet[key];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const r = annotateClaims(rows, evidenceContext);
    claimChanges += r.changed;
    out[key] = r.claims;
  }
  const valueStatuses: Array<{ value: string; status: ClaimStatus }> = [];
  if (Array.isArray(packet.numbers)) {
    out.numbers = packet.numbers.map((n) => {
      const status = valueStatus(n.value, evidenceContext);
      if (status === 'CURRENT_CONFIRMED' || status === 'UNKNOWN') return n;
      valueStatuses.push({ value: n.value, status });
      return { ...n, status };
    });
  }
  return { packet: out as T, claimChanges, valueStatuses };
}

interface ArticleLike { introduction?: string; conclusion?: string; sections?: Array<{ takeaway?: string; h3Sections?: Array<{ content?: string }> }> }
/** 초안(서론·절 본문·takeaway·결론)에 상태 주석 + 분수 표기 복원. 표·제목은 건드리지 않는다 */
export function annotateArticle<T extends ArticleLike>(article: T, evidenceContext: string): { article: T; changes: Array<StatusChange & { location: string }>; fractions: Array<{ from: string; to: string }> } {
  const changes: Array<StatusChange & { location: string }> = [];
  const fractions: Array<{ from: string; to: string }> = [];
  const run = (html: string | undefined, location: string): string | undefined => {
    if (!html) return html;
    const f = restoreFractionNotation(html, evidenceContext);
    fractions.push(...f.restored);
    const r = annotateHtml(f.html, evidenceContext, location);
    changes.push(...r.changes);
    return r.html;
  };
  const next = {
    ...article,
    introduction: run(article.introduction, 'introduction'),
    conclusion: run(article.conclusion, 'conclusion'),
    sections: (article.sections || []).map((s, si) => ({
      ...s,
      takeaway: run(s.takeaway, `section.${si}.takeaway`),
      h3Sections: (s.h3Sections || []).map((h, hi) => ({ ...h, content: run(h.content, `section.${si}.h3.${hi}.content`) })),
    })),
  } as T;
  return { article: next, changes, fractions };
}

/**
 * 분수 표기 보존 — 근거 "a/b%" 를 본문이 "a분의 b퍼센트"/"b분의 a퍼센트" 로 바꾸면 원 표기로 되돌린다. 실측(run ad0616): "5/12%" → "5분의 12퍼센트"(12/5 로 읽힌다).
 * 날짜(9/29)·주소(/path)와 섞이지 않게 근거에서 "%" 가 붙은 분수만 대상으로 하고, 새 계산·반올림은 하지 않는다.
 */
export function restoreFractionNotation(html: string, evidenceContext: string): { html: string; restored: Array<{ from: string; to: string }> } {
  const fractions = [...String(evidenceContext || '').matchAll(/(?<![\d/.])(\d{1,3})\/(\d{1,3})\s*(%|퍼센트|%p)/g)].map((m) => ({ a: m[1]!, b: m[2]!, unit: m[3]!.replace('퍼센트', '%') }));
  const restored: Array<{ from: string; to: string }> = [];
  let out = String(html || '');
  for (const f of fractions) {
    for (const [x, y] of [[f.a, f.b], [f.b, f.a]]) {
      const re = new RegExp(`${x}\\s*분의\\s*${y}\\s*(?:퍼센트|%|퍼센트포인트|%p)`, 'g');
      out = out.replace(re, (whole) => { restored.push({ from: whole, to: `${f.a}/${f.b}${f.unit}` }); return `${f.a}/${f.b}${f.unit}`; });
    }
  }
  return { html: out, restored };
}
