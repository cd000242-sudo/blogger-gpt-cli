/**
 * ⚖️ v3.8.760 — 판단문의 값 역할(MAXIMUM ↔ REQUIRED) 왜곡 방지. 호출 0회·결정론.
 *
 * 실측(run d7a142): 근거 "청년도약계좌는 5년 동안 월 최대 70만원을 납입할 수 있다"(상한·자유납입).
 * 원고 서론·결론·2절: "월 70만원 납입을 유지할 수 있고 … 계속 보유하는 편이 낫습니다" — 상한이 유지 **조건**이 됐다.
 * P0-2(answer-fidelity)는 답 상자·요약표·FAQ 만 봤다. 여기서는 본문 문장을 본다.
 *
 * 값의 역할은 **근거**에서 읽는다: 최대 X·X까지·X 한도 → MAXIMUM, 최소 X·X 이상 (납입)해야/필수/의무 → REQUIRED/MINIMUM,
 * 자유납입·자유적립 → FREE. 원고가 MAXIMUM 인 값을 요구 조건 꼴로 쓰면 그 문장만 약화한다. 근거에 REQUIRED 도 있으면 오탐으로 보고 두지 않는다.
 * 약화 규칙: 알려진 서술(유지·납입·넣·채우·하다 동사)만 "최대 X까지 …할 수 있고/있다" 로 바꾼다. 안전한 치환이 없으면 기록만 남기고 문장을 두지 않는다(삭제도 안 한다).
 * 상품명·금액·단위 값은 코드에 없다(근거에서 읽는다).
 */
export type ValueRole = 'MAXIMUM' | 'MINIMUM' | 'REQUIRED' | 'FREE_CONTRIBUTION';
export interface RoleEvidence { value: string; roles: ValueRole[]; hits: string[] }
export interface SemanticChange { location: string; sentence: string; value: string; roles: ValueRole[]; action: 'weakened' | 'flagged'; after?: string; reason: string }
export interface SemanticArticleResult<T> { article: T; changes: SemanticChange[] }

const plain = (s: string) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const compactAmount = (s: string) => String(s || '').replace(/\s+/g, '').replace(/,/g, '');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 숫자+단위 — 금액·거리·시간·횟수. 값 자체는 어떤 것이든 좋다(역할만 본다) */
const VALUE_SRC = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*(?:만\\s*원|억\\s*원|원|km|시간|분|일|회|개월|명|건|%|퍼센트)';
/** 값을 공백·쉼표에 너그럽게 찾는 정규식 조각 */
const loose = (value: string) => compactAmount(value).split('').map((c) => (/[\d]/.test(c) ? c : esc(c))).join('[\\s,]*');

/** 근거에서 값 X 의 역할을 읽는다 */
export function valueRoles(evidence: string, value: string): RoleEvidence {
  const text = plain(evidence);
  const v = loose(value);
  const roles = new Set<ValueRole>();
  const hits: string[] = [];
  const probe = (re: RegExp, role: ValueRole) => { const m = text.match(re); if (m) { roles.add(role); hits.push(m[0].slice(0, 60)); } };
  // "최대 70만원" · "최대 주행거리는 500km" · "70만원까지/한도" — 최대와 값 사이에 짧은 이름표(항목명)는 허용한다
  probe(new RegExp(`최대\\s*(?:[가-힣]{1,6}\\s*){0,2}${v}|${v}\\s*(?:까지|한도|이내|이하)`), 'MAXIMUM');
  probe(new RegExp(`최소\\s*(?:[가-힣]{1,6}\\s*){0,2}${v}|${v}\\s*이상`), 'MINIMUM');
  probe(new RegExp(`${v}\\s*(?:이상)?[^.]{0,12}?(?:필수|의무|반드시|해야\\s*(?:한다|합니다)|조건)`), 'REQUIRED');
  probe(new RegExp(`${v}[^.]{0,30}?자유(?:납입|적립|롭게)|자유(?:납입|적립|롭게)[^.]{0,30}?${v}`), 'FREE_CONTRIBUTION');
  return { value: compactAmount(value), roles: [...roles], hits };
}

/** 원고가 값을 요구 조건으로 쓰는 꼴 — "X을 유지하며/유지할 수 있고", "X를 납입할 수 있는 경우에만", "X 납입이 유지 조건", "X를 주행해야 한다" */
const KNOWN_VERB = '(?:납입을\\s*|납입\\s*)?(?:유지|납입|계속\\s*넣|넣|채우|채워)';
const KNOWN_TAIL = '(?:하며|하면서|해야|해야만|워야|울\\s*수\\s*있(?:으면|고|다면|어야|는\\s*경우에만)|할\\s*수\\s*있(?:으면|고|다면|어야|는\\s*경우에만)|하면|가능하면|가능하다면|이\\s*(?:유지\\s*)?조건|이\\s*필수|해야\\s*(?:한다|합니다|해요))';
const KNOWN = new RegExp(`((?:월|매월|매달|연|매년|하루|1일)\\s*)?(${VALUE_SRC})(?:을|를|은|는)?\\s*${KNOWN_VERB}${KNOWN_TAIL}`, 'g');
/** 하다 동사 일반형 — "X를 주행해야 한다" · "X를 이용해야 합니다" → "최대 X까지 주행할 수 있다" */
const HADA = new RegExp(`(${VALUE_SRC})(?:을|를|은|는)?\\s*([가-힣]{1,4})해야(?:만)?\\s*(한다|합니다|해요|함)`, 'g');
/** 그 밖의 요구 꼴 — 잡되 안전한 치환이 없어 기록만 */
const OTHER = new RegExp(`(${VALUE_SRC})(?:을|를|은|는)?\\s*[가-힣]{1,6}(?:어야|아야|려야|워야)\\s*(?:한다|합니다|해요)`, 'g');

export interface StrengthenedHit { value: string; match: string; kind: 'known' | 'hada' | 'other' }
export function findStrengthened(sentence: string): StrengthenedHit[] {
  const s = plain(sentence);
  const out: StrengthenedHit[] = [];
  for (const m of s.matchAll(KNOWN)) out.push({ value: m[2]!, match: m[0], kind: 'known' });
  for (const m of s.matchAll(HADA)) if (!out.some((o) => o.match.includes(m[1]!))) out.push({ value: m[1]!, match: m[0], kind: 'hada' });
  for (const m of s.matchAll(OTHER)) if (!out.some((o) => o.match.includes(m[1]!))) out.push({ value: m[1]!, match: m[0], kind: 'other' });
  return out;
}

/** 근거상 상한(MAXIMUM)이고 요구(REQUIRED/MINIMUM)가 아닌 값인가 */
export const isMaximumOnly = (r: RoleEvidence): boolean => r.roles.includes('MAXIMUM') && !r.roles.includes('REQUIRED') && !r.roles.includes('MINIMUM');

/** 한 문장을 약화한다. 바꿀 수 없으면 after 없이 flagged */
export function weakenSentence(sentence: string, evidence: string): { after: string; changes: Array<{ value: string; roles: ValueRole[]; action: 'weakened' | 'flagged'; reason: string }> } {
  const changes: Array<{ value: string; roles: ValueRole[]; action: 'weakened' | 'flagged'; reason: string }> = [];
  let after = sentence;
  for (const hit of findStrengthened(sentence)) {
    const role = valueRoles(evidence, hit.value);
    if (!isMaximumOnly(role)) continue;                                                   // 근거에 요구 조건이 있으면(또는 역할을 모르면) 손대지 않는다
    if (new RegExp(`최대\\s*${loose(hit.value)}`).test(plain(sentence))) continue;           // 이미 상한으로 말한다
    const v = compactAmount(hit.value);
    if (hit.kind === 'known') {
      const period = (hit.match.match(/^(월|매월|매달|연|매년|하루|1일)\s*/) || [])[1];
      const replacement = `${period ? `${period} ` : ''}최대 ${v}까지 납입할 수 있고`;
      after = after.replace(hit.match, replacement);
      changes.push({ value: v, roles: role.roles, action: 'weakened', reason: `근거는 ${v} 을 상한으로만 말한다(${role.hits[0] || ''}) — 유지 조건이 아니다` });
    } else if (hit.kind === 'hada') {
      const m = hit.match.match(HADA_ONE)!;
      const ending = m[3] === '합니다' ? '있습니다' : m[3] === '해요' ? '있어요' : '있다';
      after = after.replace(hit.match, `최대 ${v}까지 ${m[2]}할 수 ${ending}`);
      changes.push({ value: v, roles: role.roles, action: 'weakened', reason: `근거는 ${v} 을 상한으로만 말한다(${role.hits[0] || ''})` });
    } else {
      changes.push({ value: v, roles: role.roles, action: 'flagged', reason: `상한 ${v} 이 요구 조건 꼴로 쓰였으나 안전한 치환이 없어 두었다: "${hit.match}"` });
    }
  }
  return { after, changes };
}
const HADA_ONE = new RegExp(`(${VALUE_SRC})(?:을|를|은|는)?\\s*([가-힣]{1,4})해야(?:만)?\\s*(한다|합니다|해요|함)`);

/** HTML 블록 안의 문장들을 태그를 살린 채 약화한다 — 태그 밖 글자에서만 치환한다 */
export function weakenHtml(html: string, evidence: string, location: string): { html: string; changes: SemanticChange[] } {
  const changes: SemanticChange[] = [];
  const out = String(html || '').replace(/(<[^>]*>)|([^<]+)/g, (_all, tag: string, text: string) => {
    if (tag) return tag;
    const sentences = String(text || '').split(/(?<=[.!?])\s+/);
    return sentences.map((s) => {
      const r = weakenSentence(s, evidence);
      for (const c of r.changes) changes.push({ location, sentence: plain(s), ...c, ...(c.action === 'weakened' ? { after: plain(r.after) } : {}) });
      return r.after;
    }).join(' ');
  });
  return { html: out, changes };
}

interface ArticleLike { introduction?: string; conclusion?: string; sections?: Array<{ takeaway?: string; h3Sections?: Array<{ content?: string }> }> }
/** 글 전체(서론·절 본문·takeaway·결론) — 표 칸·제목은 판단문이 아니라 건드리지 않는다 */
export function alignArticleDecisionSemantics<T extends ArticleLike>(article: T, evidence: string): SemanticArticleResult<T> {
  const changes: SemanticChange[] = [];
  const run = (html: string | undefined, location: string): string | undefined => {
    if (!html) return html;
    const r = weakenHtml(html, evidence, location);
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
  return { article: next, changes };
}
