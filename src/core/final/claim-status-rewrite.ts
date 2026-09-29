/**
 * 🏷️ v3.8.764 — 상태 보정은 덧붙이지 않고 **문장 자체를** 고친다. 호출 0회·결정론.
 *
 * 763 은 강해진 문장 뒤에 "다만 근거상 현재 적용 중인 확정 값은 아닙니다(…)" 를 붙였다. 상태는 남지만 독자에게는 "15%로 개선됐습니다. 다만 확정 아님" 이라는 자기모순이다.
 * 여기서는 값이 걸린 **술어**(개선됐습니다 · 적용되죠 · 늘어나는 구조입니다 · 25%이다 · 으로 제시됐습니다)를 찾아 근거의 상태에 맞는 술어로 바꾼다.
 *   계획·예정 → "개선될 계획입니다" · 추진·검토 → "늘어나는 방향으로 추진되고 있습니다" · 조건부 → 근거의 조건절을 앞에("예산 통과 시 …")
 *   예상·전망 → "…으로 예상됩니다" · 목표 → "…을 목표로 하고 있습니다" · 미래 시행 → "…부터 적용될 예정입니다".
 * 정책 상태(추진·계획·조건)와 값의 성격(예상치·목표치)은 따로 본다 — "개편안 기준 예상액" 은 "개편안 기준으로 … 예상됩니다" 로 둘 다 남긴다.
 * 조건·근거안 이름·시점은 근거 문장에 있는 것만 옮긴다(지어내지 않는다). 술어를 못 찾거나 모르는 동사면 고치지 않고 FLAG 로 남긴다(면책문 덧붙이기 없음).
 * 동사 목록은 변화·적용을 뜻하는 일반 낱말뿐이다 — 상품명·정책 용어·값은 없다.
 */
import type { ClaimStatus, StrengthenedValue, ValueQualifier } from './claim-status';

type End = 'formal' | 'jyo' | 'yo' | 'plain' | 'myeo' | 'go';
const COP: Record<End, string> = { formal: '입니다', jyo: '이죠', yo: '이에요', plain: '이다', myeo: '이며', go: '이고' };
const HAVE: Record<End, string> = { formal: '있습니다', jyo: '있죠', yo: '있어요', plain: '있다', myeo: '있으며', go: '있고' };
const DOE: Record<End, string> = { formal: '됩니다', jyo: '되죠', yo: '돼요', plain: '된다', myeo: '되며', go: '되고' };
const PAST_DOE: Record<End, string> = { formal: '됐습니다', jyo: '됐죠', yo: '됐어요', plain: '됐다', myeo: '됐으며', go: '됐고' };

interface Verb { fut: string; adn: string; go: string; past: boolean }
interface Predicate { start: number; end: number; anchor: number; kind: 'verb' | 'copula' | 'report'; e: End; verb?: Verb; value?: string; reportNoun?: string; original: string }

/** 변화·적용을 뜻하는 한자어 동사(명사+되다/하다) — 일반 낱말만 */
const NOUN_VERBS = new Set(['개선', '인상', '상향', '확대', '증가', '인하', '하향', '축소', '감소', '적용', '지원', '지급', '도입', '시행', '변경', '조정', '운영', '제공', '출시', '달성', '기록', '유지', '인정', '보장', '환급', '환불', '취소', '연장', '단축', '완화', '강화', '개편', '상승', '하락', '증액', '감액', '면제', '허용']);
/** 보고 동사 — "…으로 제시됐습니다" 는 값의 출처를 말할 뿐이라 동사 자체를 바꾸지 않고 값 쪽 상태를 고친다 */
const REPORT_NOUNS = '제시|발표|공개|안내|명시|산정|계산';

/** 되다/하다 어미 → [어미, 끝맺음, 과거] (긴 것부터) */
const endingsFor = (d: '되' | '하'): Array<[string, End, boolean]> => {
  const [pastS, pastL, formalP, jyoP, yoP, plainP, myeoP, goP, adn] = d === '되'
    ? ['됐', '되었', '됩니다', '되죠', '돼요', '된다', '되며', '되고', '되는']
    : ['했', '하였', '합니다', '하죠', '해요', '한다', '하며', '하고', '하는'];
  const rows: Array<[string, End, boolean]> = [];
  // 진행형("지원하고 있습니다")은 지금 벌어지는 일이라 과거형처럼 다룬다 — 조건부로 바꿀 때 "지원할 예정" 으로
  for (const [h, e] of [['있습니다', 'formal'], ['있죠', 'jyo'], ['있어요', 'yo'], ['있다', 'plain'], ['있으며', 'myeo'], ['있고', 'go']] as const) rows.push([`${goP} ${h}`, e, true]);
  for (const [c, e] of [['입니다', 'formal'], ['이죠', 'jyo'], ['죠', 'jyo'], ['예요', 'yo'], ['이다', 'plain'], ['다', 'plain']] as const) rows.push([`${adn} 구조${c}`, e, false]);
  for (const p of [pastL, pastS]) for (const [t, e] of [['습니다', 'formal'], ['죠', 'jyo'], ['어요', 'yo'], ['다', 'plain'], ['으며', 'myeo'], ['고', 'go']] as const) rows.push([`${p}${t}`, e, true]);
  rows.push([formalP, 'formal', false], [jyoP, 'jyo', false], [yoP, 'yo', false], [plainP, 'plain', false], [myeoP, 'myeo', false], [goP, 'go', false]);
  return rows.sort((a, b) => b[0].length - a[0].length);
};
const NOUN_ENDINGS = { 되: endingsFor('되'), 하: endingsFor('하') };

interface Lemma { past: string; formal: string; jyo: string; yo: string; plain: string; myeo: string; go: string; fut: string; adn: string }
const ji = (b: string): Lemma => ({ past: `${b}졌`, formal: `${b}집니다`, jyo: `${b}지죠`, yo: `${b}져요`, plain: `${b}진다`, myeo: `${b}지며`, go: `${b}지고`, fut: `${b}질`, adn: `${b}지는` });
/** 고유어 변화 동사 — 활용형을 손으로 적는다(규칙 활용 추측 없음) */
const LEMMAS: Lemma[] = [
  { past: '늘어났', formal: '늘어납니다', jyo: '늘어나죠', yo: '늘어나요', plain: '늘어난다', myeo: '늘어나며', go: '늘어나고', fut: '늘어날', adn: '늘어나는' },
  { past: '줄어들었', formal: '줄어듭니다', jyo: '줄어들죠', yo: '줄어들어요', plain: '줄어든다', myeo: '줄어들며', go: '줄어들고', fut: '줄어들', adn: '줄어드는' },
  { past: '올랐', formal: '오릅니다', jyo: '오르죠', yo: '올라요', plain: '오른다', myeo: '오르며', go: '오르고', fut: '오를', adn: '오르는' },
  { past: '바뀌었', formal: '바뀝니다', jyo: '바뀌죠', yo: '바뀌어요', plain: '바뀐다', myeo: '바뀌며', go: '바뀌고', fut: '바뀔', adn: '바뀌는' },
  { past: '받았', formal: '받습니다', jyo: '받죠', yo: '받아요', plain: '받는다', myeo: '받으며', go: '받고', fut: '받게 될', adn: '받는' },
  { past: '달렸', formal: '달립니다', jyo: '달리죠', yo: '달려요', plain: '달린다', myeo: '달리며', go: '달리고', fut: '달릴', adn: '달리는' },
  ji('높아'), ji('낮아'), ji('커'),
];
const LEMMA_FORMS: Array<[string, End, boolean, Lemma]> = LEMMAS.flatMap((l) => {
  const rows: Array<[string, End, boolean, Lemma]> = [];
  for (const [h, e] of [['있습니다', 'formal'], ['있죠', 'jyo'], ['있어요', 'yo'], ['있다', 'plain'], ['있으며', 'myeo'], ['있고', 'go']] as const) rows.push([`${l.go} ${h}`, e, true, l]);
  for (const [c, e] of [['입니다', 'formal'], ['이죠', 'jyo'], ['죠', 'jyo'], ['예요', 'yo'], ['이다', 'plain'], ['다', 'plain']] as const) rows.push([`${l.adn} 구조${c}`, e, false, l]);
  for (const [t, e] of [['습니다', 'formal'], ['죠', 'jyo'], ['어요', 'yo'], ['다', 'plain'], ['으며', 'myeo'], ['고', 'go']] as const) rows.push([`${l.past}${t}`, e, true, l]);
  rows.push([l.formal, 'formal', false, l], [l.jyo, 'jyo', false, l], [l.yo, 'yo', false, l], [l.plain, 'plain', false, l], [l.myeo, 'myeo', false, l], [l.go, 'go', false, l]);
  return rows;
}).sort((a, b) => b[0].length - a[0].length);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NOUN_RE = new RegExp(`(?<![가-힣])([가-힣]{2})(${[...NOUN_ENDINGS.되, ...NOUN_ENDINGS.하].map((r) => esc(r[0])).sort((a, b) => b.length - a.length).join('|')})(?![가-힣])`, 'g');
const LEMMA_RE = new RegExp(`(?<![가-힣])(${LEMMA_FORMS.map((r) => esc(r[0])).join('|')})(?![가-힣])`, 'g');
const UNIT = '(?:퍼센트포인트|퍼센트|%p|%|만\\s*[\\d,]*\\s*원|억\\s*원|조\\s*원|천\\s*원|원|km|kg|TB|GB|MB|개월|년|배|명|회|세|일|㎡|평)?';

/** 값 토큰의 본문 표면형 위치 — "15%" 는 본문의 "15퍼센트", "2138만원" 은 "2,138만원" 도 찾는다 */
export function locateValue(sentence: string, value: string): { start: number; end: number; surface: string } | null {
  const core = (value.match(/\d[\d,]*(?:\.\d+)?/) || [''])[0].replace(/,/g, '');
  if (!core) return null;
  const re = new RegExp(`(?<![\\d.,])${core.split('').map(esc).join(',?')}(?![\\d])\\s*${UNIT}`);
  const m = sentence.match(re);
  if (!m || m.index === undefined) return null;
  const surface = m[0].replace(/\s+$/, '');
  return { start: m.index, end: m.index + surface.length, surface };
}

function predicatesOf(sentence: string, values: string[]): Predicate[] {
  const out: Predicate[] = [];
  for (const m of sentence.matchAll(NOUN_RE)) {
    const noun = m[1]!;
    if (!NOUN_VERBS.has(noun)) continue;
    const ending = m[2]!;
    const d: '되' | '하' = /^(?:됐|되|돼|된|됩)/.test(ending) ? '되' : '하';
    const row = NOUN_ENDINGS[d].find((r) => r[0] === ending);
    if (!row) continue;
    const verb: Verb = d === '되' ? { fut: `${noun}될`, adn: `${noun}되는`, go: `${noun}되고`, past: row[2] } : { fut: `${noun}할`, adn: `${noun}하는`, go: `${noun}하고`, past: row[2] };
    out.push({ start: m.index!, end: m.index! + m[0].length, anchor: m.index!, kind: 'verb', e: row[1], verb, original: m[0] });
  }
  for (const m of sentence.matchAll(LEMMA_RE)) {
    const row = LEMMA_FORMS.find((r) => r[0] === m[1]);
    if (!row) continue;
    const l = row[3];
    out.push({ start: m.index!, end: m.index! + m[0].length, anchor: m.index!, kind: 'verb', e: row[1], verb: { fut: l.fut, adn: l.adn, go: l.go, past: row[2] }, original: m[0] });
  }
  for (const value of values) {
    const at = locateValue(sentence, value);
    if (!at) continue;
    const rest = sentence.slice(at.end);
    const cop = rest.match(/^(입니다|이죠|이에요|예요|이다|이며|이고)(?![가-힣])/);
    if (cop) {
      const e: End = ({ 입니다: 'formal', 이죠: 'jyo', 이에요: 'yo', 예요: 'yo', 이다: 'plain', 이며: 'myeo', 이고: 'go' } as Record<string, End>)[cop[1]!]!;
      out.push({ start: at.start, end: at.end + cop[0].length, anchor: at.end, kind: 'copula', e, value: at.surface, original: sentence.slice(at.start, at.end + cop[0].length) });
    }
    const rep = rest.match(new RegExp(`^\\s*(?:으로|로)\\s+(${REPORT_NOUNS})(?:됐|되었)(습니다|죠|어요|다|으며|고)(?![가-힣])`));
    if (rep) {
      const e: End = ({ 습니다: 'formal', 죠: 'jyo', 어요: 'yo', 다: 'plain', 으며: 'myeo', 고: 'go' } as Record<string, End>)[rep[2]!]!;
      out.push({ start: at.start, end: at.end + rep[0].length, anchor: at.end, kind: 'report', e, value: at.surface, reportNoun: rep[1]!, original: sentence.slice(at.start, at.end + rep[0].length) });
    }
  }
  // 보고 동사("제시됐습니다")는 값 바로 뒤가 아니면 술어로 쓰지 않는다 — 한자어 동사 목록에 없어 위에서 이미 빠진다
  return out.sort((a, b) => a.anchor - b.anchor || a.start - b.start);
}

/** 받침 — 한글은 종성, 숫자는 읽는 소리, %·단위 약자는 모음으로 끝난다 */
function jongOf(word: string): number {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28;
  if (/\d/.test(ch)) return [21, 8, 0, 16, 0, 0, 1, 8, 8, 0][Number(ch)]!;
  return 0;
}
const ro = (w: string) => { const j = jongOf(w); return j === 0 || j === 8 ? '로' : '으로'; };
const iGa = (w: string) => (jongOf(w) ? '이' : '가');
const eul = (w: string) => (jongOf(w) ? '을' : '를');

export interface StatusMeta { status: ClaimStatus; qualifier: ValueQualifier | null; word: '계획' | '예정'; proposeVerb: '추진' | '검토' | '제안' | '방안' | null; basis: string | null; cond: string | null; time: string | null; estWord: '예상' | '전망' | '추정'; possibility: boolean }
const COND_RE = /(?:[가-힣A-Za-z0-9]+\s)?[가-힣A-Za-z0-9]*(?:통과|확정|승인|시행|개정|도입)\s*(?:시|되면|하면|될\s*경우|할\s*경우)(?![가-힣])|우천\s*시|[가-힣]+(?:이|가)\s*(?:높아|낮아|늘어|바뀌)(?:지면|면)/;
/** 근거 문장에서 상태 표현에 쓸 낱말만 읽는다 — 지어내지 않는다 */
export function metaOf(source: { status: ClaimStatus; marker: string; sentence: string; qualifier?: ValueQualifier | null }): StatusMeta {
  const s = source.sentence;
  const marker = source.marker || '';
  // 근거가 쓴 동사를 따른다 — 검토 > 추진 > 방안(근거에 "방안" 이 있을 때만) > 제안
  const proposeVerb = /검토/.test(marker) || (!/추진/.test(marker) && /검토/.test(s)) ? '검토' : /추진/.test(marker) || /추진/.test(s) ? '추진' : /방안/.test(marker) ? '방안' : /제안|건의/.test(s) ? '제안' : null;
  const BASIS = /[가-힣]{1,3}(?:편|정|법|산)안/;
  const basis = (marker.match(BASIS) || s.match(BASIS) || [null])[0];
  return {
    status: source.status,
    qualifier: source.qualifier ?? null,
    word: /예정/.test(marker) ? '예정' : '계획',
    proposeVerb: basis && !/추진|검토/.test(marker) ? null : proposeVerb,
    basis,
    cond: (s.match(COND_RE) || [null])[0],
    time: (s.match(/(?:내년|20\d{2}년(?:\s*\d{1,2}월)?|내달|다음\s*달)\s*(?:부터|에)(?![가-힣])/) || [null])[0],
    estWord: /전망/.test(s) ? '전망' : /추정|추산/.test(s) ? '추정' : '예상',
    possibility: /[가-힣]\s수\s*있(?:다|습니다|음|어요)/.test(s),
  };
}

/** 술어 하나를 상태에 맞게 — null 이면 안전하게 못 바꾼다(FLAG) */
function renderPredicate(p: Predicate, m: StatusMeta): string | null {
  const e = p.e;
  const q = m.qualifier;
  if (p.kind === 'verb') {
    const v = p.verb!;
    if (q === 'ESTIMATE') return `${v.fut} 것으로 ${m.estWord}${DOE[e]}`;
    if (q === 'TARGET') return `${v.adn} 것을 목표로 하고 ${HAVE[e]}`;
    switch (m.status) {
      case 'PLANNED': return `${v.fut} ${m.word}${COP[e]}`;
      case 'PROPOSED': return m.proposeVerb === '방안' ? `${v.adn} 방안이 제시${PAST_DOE[e]}` : m.proposeVerb ? `${v.adn} 방향으로 ${m.proposeVerb}되고 ${HAVE[e]}` : m.basis ? `${v.fut} 예정${COP[e]}` : null;
      case 'CONDITIONAL': return m.possibility ? `${v.fut} 수 ${HAVE[e]}` : v.past ? `${v.fut} 예정${COP[e]}` : p.original;
      case 'FUTURE_CONFIRMED': return `${v.fut} 예정${COP[e]}`;
      default: return null;
    }
  }
  const val = p.value!;
  if (p.kind === 'copula') {
    if (q === 'ESTIMATE') return `${val}${ro(val)} ${m.estWord}${DOE[e]}`;
    if (q === 'TARGET') return `${val}${eul(val)} 목표로 하고 ${HAVE[e]}`;
    switch (m.status) {
      case 'PLANNED': return `${val}${iGa(val)} 될 ${m.word}${COP[e]}`;
      case 'PROPOSED': return m.proposeVerb === '방안' ? `${val}${iGa(val)} 되는 방안이 제시${PAST_DOE[e]}` : m.proposeVerb ? `${val}${iGa(val)} 되는 방향으로 ${m.proposeVerb}되고 ${HAVE[e]}` : m.basis ? `${val}${iGa(val)} 될 예정${COP[e]}` : null;
      case 'CONDITIONAL': return m.possibility ? `${val}${iGa(val)} 될 수 ${HAVE[e]}` : p.original;
      case 'FUTURE_CONFIRMED': return `${val}${iGa(val)} 될 예정${COP[e]}`;
      default: return null;
    }
  }
  const rn = p.reportNoun!;
  if (q === 'ESTIMATE') return `${val}${ro(val)} ${m.estWord}${DOE[e]}`;
  if (q === 'TARGET') return `${val}${eul(val)} 목표로 ${rn}${PAST_DOE[e]}`;
  switch (m.status) {
    case 'PLANNED': return `${val}${ro(val)} 하는 ${m.word}이 ${rn}${PAST_DOE[e]}`;
    case 'PROPOSED': return m.proposeVerb === '방안' ? `${val}${ro(val)} 하는 방안이 ${rn}${PAST_DOE[e]}` : m.proposeVerb ? `${val}${ro(val)} ${m.proposeVerb}되고 ${HAVE[e]}` : m.basis ? p.original : null;
    case 'CONDITIONAL': case 'FUTURE_CONFIRMED': return p.original;
    default: return null;
  }
}

/** 문장 앞에 한 번만 붙는 상태 틀 — 조건절 · 근거안 기준 · 시점 · "계획대로라면" */
function prefixOf(m: StatusMeta): string | null {
  if (m.status === 'CONDITIONAL') return m.cond || '조건이 충족되면';
  if (m.status === 'FUTURE_CONFIRMED') return m.time;
  if (m.status === 'PROPOSED' && m.basis && (!m.proposeVerb || m.qualifier)) return `${m.basis} 기준으로`;
  if (m.status === 'PROPOSED' && m.qualifier && m.proposeVerb) return m.proposeVerb === '방안' ? '제시된 방안대로라면' : `${m.proposeVerb}되는 대로라면`;
  if (m.status === 'PLANNED' && m.qualifier === 'ESTIMATE') return `${m.word}대로라면`;
  return null;
}
const LEAD = /^((?:다만|또한|그리고|특히|반면|한편|이때|즉|따라서|그래서|결국|이에 따라)[,\s]+)/;

export interface RewriteResult { action: 'rewritten' | 'flagged'; after: string; reason: string }
const strength = (s: ClaimStatus) => ({ CURRENT_CONFIRMED: 5, FUTURE_CONFIRMED: 4, PAST: 4, PLANNED: 3, ESTIMATED: 2, PROPOSED: 2, CONDITIONAL: 1, UNKNOWN: 0, UNSPECIFIED: 0 } as Record<ClaimStatus, number>)[s];

/**
 * 강해진 문장 하나를 근거의 상태로 고친다. 값마다 그 값이 걸린 첫 술어를 찾고, 한 술어에 걸린 값들은 가장 약한 상태로 한 번만 표현한다.
 * 같은 상태의 술어가 여럿이면 앞 술어는 "-고" 로 잇고 마지막 술어에만 상태를 싣는다(근거 문장 "15%로 높이고 25%까지 확대할 계획이다" 와 같은 짜임).
 */
export function rewriteSentence(sentence: string, values: StrengthenedValue[], metaFor: (v: StrengthenedValue) => StatusMeta): RewriteResult {
  // 문장이 스스로 "현재·지금·현행" 이라고 못박았으면 술어만 바꿔도 "현재 … 예정" 모순이 남는다 — 고치지 않고 FLAG
  if (/(?:^|[\s,])(?:현재|지금|현행)(?=[\s,]|의|는|도|까지)/.test(sentence)) return { action: 'flagged', after: sentence, reason: 'explicit-current' };
  const preds = predicatesOf(sentence, values.map((v) => v.value));
  const byPred = new Map<Predicate, StrengthenedValue[]>();
  for (const v of values) {
    const at = locateValue(sentence, v.value);
    if (!at) return { action: 'flagged', after: sentence, reason: `value-not-located:${v.value}` };
    const p = preds.find((x) => x.anchor >= at.end);
    if (!p) return { action: 'flagged', after: sentence, reason: `no-predicate:${v.value}` };
    byPred.set(p, [...(byPred.get(p) || []), v]);
  }
  const plans = [...byPred.entries()].map(([p, vs]) => {
    const metas = vs.map(metaFor).sort((a, b) => strength(a.status) - strength(b.status));
    const meta = { ...metas[0]!, qualifier: metas.find((x) => x.qualifier === 'ESTIMATE')?.qualifier || metas.find((x) => x.qualifier)?.qualifier || null };
    return { p, meta, text: renderPredicate(p, meta) };
  }).sort((a, b) => a.p.start - b.p.start);
  const failed = plans.find((x) => x.text === null);
  if (failed) return { action: 'flagged', after: sentence, reason: `unsupported:${failed.meta.status}:${failed.p.kind}:${failed.p.original}` };
  const key = (m: StatusMeta) => `${m.status}|${m.qualifier}`;
  const last = plans[plans.length - 1]!;
  const texts = plans.map((x, i) => {
    if (i === plans.length - 1 || key(x.meta) !== key(last.meta) || (x.p.e !== 'myeo' && x.p.e !== 'go')) return x.text!;
    return x.p.kind === 'verb' ? x.p.verb!.go : x.p.kind === 'copula' ? `${x.p.value}이고` : x.text!;
  });
  let out = sentence;
  for (let i = plans.length - 1; i >= 0; i -= 1) out = out.slice(0, plans[i]!.p.start) + texts[i]! + out.slice(plans[i]!.p.end);
  const prefix = prefixOf(plans[0]!.meta);
  if (prefix && !out.replace(/\s+/g, '').includes(prefix.replace(/\s+/g, ''))) {
    const lead = out.match(LEAD);
    out = lead ? `${lead[1]}${prefix} ${out.slice(lead[1]!.length)}` : `${prefix} ${out}`;
  }
  return out === sentence ? { action: 'flagged', after: sentence, reason: 'no-change' } : { action: 'rewritten', after: out, reason: plans.map((x) => `${x.meta.status}${x.meta.qualifier ? `+${x.meta.qualifier}` : ''}`).join(',') };
}

/** 강한 문장 뒤의 면책문 — 강한 문장을 고쳤으면 함께 남기지 않는다(763 의 독자용 문장 포함) */
export function isDisclaimer(sentence: string): boolean {
  const s = sentence.trim();
  if (s.includes('현재 적용 중인 확정 값은 아닙니다')) return true;
  return /^(?:다만|하지만|단|물론)[,\s]/.test(s) && /확정(?:된|은|되지|이|값)|아직|결정되지/.test(s) && /아닙니다|아니다|아니에요|아니죠|않았|않습니다|전입니다|전이에요/.test(s);
}
