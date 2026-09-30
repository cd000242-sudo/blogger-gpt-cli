/**
 * 🧩 v3.8.781 — 값이 **어느 문서·제도·상품의 값**인지(ENTITY SCOPE). 호출 0회·결정론.
 *
 * 실측(live 508d55): 인감증명서 글에 "웹 수수료 2028년 12월 31일까지 면제"·"이용 승인 4년 유효" 가 들어갔다. 두 값 모두 근거 E01 에 있었지만
 * **본인서명사실확인서·전자본인서명확인서** 문단의 값이었다. 772 의 변형 축(claim-variant)은 모델 코드·트림(S26 · 롱레인지)만 알아서,
 * 모델 없는 한국어 대상(서류·제도·특약·요금제)은 "근거 어딘가에 값이 있다" 로 통과했다.
 *
 * 같은 관계(SAME · DIFFERENT · UNKNOWN · AMBIGUOUS)를 한국어 명사 대상으로 넓힌다. 판정·행동은 variant-ledger 가 그대로 쓴다.
 * 규칙(대상 이름을 코드에 박지 않는다 — 글의 주제와 문장의 모양만 본다):
 *   · 주제(subject) = 글 제목의 첫 한글 명사(3음절 이상, 조사 뗌). 예: "인감증명서 온라인 발급 …" → 인감증명서
 *   · 같은 종류의 다른 대상 = 주제와 **끝 음절이 같은** 3음절 이상 한글 명사 가운데, 근거에서 **주제 조사(은·는·이·가)를 달고** 나온 것
 *     (무엇에 대해 말하는 자리에 선 대상만 — "신청서를 작성" 같은 목적어는 대상이 아니다). 증명서 ↔ 확인서 · ○○특약 ↔ △△특약 · 주택용 ↔ 산업용
 *   · 값의 대상: ① 값 문장이 대상을 하나만 말하면 그것 ② 둘 이상이면 같은 절에서 값 앞의 가장 가까운 것
 *     — 조사 없이 이름만 나란히면(평문으로 납작해진 표 머리 "인감증명서 본인서명사실확인서 … 600원 2028년") 모호
 *     ③ 문장에 없으면 앞 문장들의 주제(주제 조사가 붙은 대상 — 한국어 주제 이어받기) ④ 문서의 첫 주제는 페이지 제목의 대상(하나일 때)
 *   · 활성: 근거에 주제와 다른 대상이 하나라도 있을 때만. 없으면 이 축은 꺼져 있고 예전 동작(값 존재)이다.
 */

export interface EntityContext {
  subject: string;
  /** 주제 + 근거에서 주제 조사를 달고 나온 같은 종류의 다른 대상 */
  entities: Set<string>;
  /** 주제와 다른 대상이 있나 — 없으면 축을 쓰지 않는다 */
  active: boolean;
}
/** '' = 모름(UNKNOWN) · '*' = 모호(AMBIGUOUS) · 그 밖 = 대상 이름 */
export type EntityRef = string;
export const AMBIGUOUS_ENTITY = '*';
export type EntityRelation = 'SAME' | 'DIFFERENT' | 'UNKNOWN' | 'AMBIGUOUS';

const PARTICLE = /(?:에서는|에서|에게|으로는|으로|로는|까지|부터|보다|처럼|이나|이며|이고|이다|입니다|이란|와|과|은|는|이|가|을|를|의|에|로|도|만|란)$/;
const TOPIC = /(?:은|는|이|가)$/;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const CLAUSE_BREAK = /,(?!\d)|;|\||、|(?<=[가-힣](?:고|며|지만|는데|면서|반면|으나))\s/g;

interface Tok { noun: string; index: number; end: number; topic: boolean; bare: boolean }
/** 한글 낱말 — 조사를 한 겹(최대 두 겹) 벗긴 명사와 위치. 주제 조사가 붙었는지·조사 없이 맨 이름인지 */
function tokens(text: string): Tok[] {
  const src = String(text || '').replace(URL_RE, (u) => ' '.repeat(u.length));
  const out: Tok[] = [];
  for (const m of src.matchAll(/[가-힣]+/g)) {
    const raw = m[0];
    let noun = raw;
    for (let i = 0; i < 2 && PARTICLE.test(noun) && noun.length > 3; i += 1) noun = noun.replace(PARTICLE, '');
    out.push({ noun, index: m.index || 0, end: (m.index || 0) + raw.length, topic: noun !== raw && TOPIC.test(raw), bare: noun === raw });
  }
  return out;
}

/** 글 제목의 첫 한글 명사(3음절 이상) — 글이 다루는 대상 */
export function entitySubject(title: string): string {
  return tokens(title).find((t) => t.noun.length >= 3)?.noun || '';
}

/** 명사가 아니라 이음 꼴(하기 위해서는 · 알아서는 · 나누어서는) — 끝 음절이 같아도 대상이 아니다(실측: "위해서" 가 대상으로 잡혔다) */
const CONNECTIVE = /(?:해서|하여서|어서|아서|워서|와서|져서|려서|해야|하여)$/;
const sibling = (noun: string, subject: string) => noun.length >= 3 && !!subject && noun !== subject && noun.slice(-1) === subject.slice(-1) && !CONNECTIVE.test(noun);

/** 주제 + 근거에서 주제 조사를 달고 나온 같은 종류의 다른 대상 */
export function buildEntityContext(title: string, texts: ReadonlyArray<string>): EntityContext | null {
  const subject = entitySubject(title);
  if (!subject) return null;
  const entities = new Set<string>([subject]);
  for (const text of texts) for (const t of tokens(text)) if (t.topic && sibling(t.noun, subject)) entities.add(t.noun);
  return { subject, entities, active: entities.size > 1 };
}

const mentionsOf = (ctx: EntityContext, text: string) => tokens(text).filter((t) => ctx.entities.has(t.noun));

function clauseStart(text: string, index: number): number {
  let s = 0;
  for (const m of text.matchAll(CLAUSE_BREAK)) { const at = m.index || 0; if (at < index) s = at + m[0].length; else break; }
  return s;
}

/**
 * 값(문장 안 index) 하나의 대상. carried = 앞 문장들에서 이어받은 주제(없으면 '').
 * 문장의 대상 언급이 먼저고, 없을 때만 이어받는다.
 */
export function valueEntity(ctx: EntityContext, sentence: string, index: number, carried: EntityRef): EntityRef {
  const ms = mentionsOf(ctx, sentence);
  if (!ms.length) return carried;
  const names = [...new Set(ms.map((m) => m.noun))];
  // 조사 없이 다른 대상 이름이 바로 나란히(사이에 공백만) — 열 관계를 잃은 표 머리다
  for (let i = 0; i + 1 < ms.length; i += 1) {
    const a = ms[i]!; const b = ms[i + 1]!;
    if (a.noun !== b.noun && a.bare && /^\s+$/.test(sentence.slice(a.end, b.index))) return AMBIGUOUS_ENTITY;
  }
  if (names.length === 1) return names[0]!;
  const cs = clauseStart(sentence, index);
  const before = ms.filter((m) => m.end <= index);
  const inClause = before.filter((m) => m.index >= cs).pop();
  if (inClause) return inClause.noun;
  return before.length ? before[before.length - 1]!.noun : AMBIGUOUS_ENTITY;
}

/** 문장이 지나간 뒤의 주제 — 주제 조사가 붙은 대상이 하나면 그것, 둘 이상이면 모호, 없으면 그대로 */
export function topicAfter(ctx: EntityContext, sentence: string, carried: EntityRef): EntityRef {
  const topics = [...new Set(mentionsOf(ctx, sentence).filter((m) => m.topic).map((m) => m.noun))];
  if (!topics.length) return carried;
  return topics.length === 1 ? topics[0]! : AMBIGUOUS_ENTITY;
}

/** 페이지 제목의 대상 — 문서의 첫 주제 */
export function titleEntity(ctx: EntityContext, pageTitle: string): EntityRef {
  const names = [...new Set(mentionsOf(ctx, pageTitle).map((m) => m.noun))];
  return names.length === 1 ? names[0]! : names.length > 1 ? AMBIGUOUS_ENTITY : '';
}

/** 순서대로 놓인 문장들 → 문장마다 들어올 때의 주제(이어받기) */
export function carriedTopics(ctx: EntityContext, sentences: ReadonlyArray<string>, pageTitle = ''): EntityRef[] {
  let carried = titleEntity(ctx, pageTitle);
  return sentences.map((s) => { const now = carried; carried = topicAfter(ctx, s, carried); return now; });
}

export function entityRelation(claim: EntityRef, evidence: EntityRef): EntityRelation {
  if (!claim || claim === AMBIGUOUS_ENTITY) return 'UNKNOWN';
  if (evidence === AMBIGUOUS_ENTITY) return 'AMBIGUOUS';
  if (!evidence) return 'UNKNOWN';
  return claim === evidence ? 'SAME' : 'DIFFERENT';
}
