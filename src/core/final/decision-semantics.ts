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
const VALUE_SRC = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?\\s*(?:만\\s*원|억\\s*원|원|km|시간|분|일|회|개월|명|건|%|퍼센트|TB|GB|MB|kg|㎡|평)';
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
const OTHER = new RegExp(`(${VALUE_SRC})(?:을|를|은|는)?\\s*[가-힣]{1,6}(?:어야|아야|려야|워야)\\s*(?:한다|합니다|해요|됩니다|된다|유지|가능|자격)`, 'g');

/**
 * v3.8.761 — 실측(run b8cdb4)의 새 문형: "70만원 납입을 유지할 여력이 있다면", "70만원을 낼 수 있는 소득 흐름이라면", "70만원을 꾸준히 납입할 수 있으면",
 * "70만원 유지 가능하면", "70만원 저축이 흔들리지 않는다면", "X 납입이 가능해야". 값을 "낼 수 있는 능력" 조건으로 쓰는 꼴(ABILITY) — 근거가 상한이면 요구 조건이 아니다.
 */
const ABILITY_VERB = '(?:납입|저축|적립|이용|사용|주행|투자|결제|유지)';
const ABILITY = new RegExp(`((?:월|매월|매달|연|매년|하루|1일)\\s*)?(${VALUE_SRC})(?:을|를|이|은|는)?\\s*(?:${ABILITY_VERB}(?:을|를|이|은|는)?\\s*)?(?:계속|꾸준히|실제로|매달|매월)?\\s*(?:(?:유지|납입|저축|넣|낼|채우|채워|이용|사용|주행)[가-힣]{0,3}\\s*)?(?:여력|가능|수\\s*있|흔들리지\\s*않|부담(?:되|스럽)지\\s*않)[가-힣\\s]{0,10}?(?:다면|으면|면|라면|경우(?:에|라면)?|해야|어야|아야)`, 'g');
/**
 * v3.8.763 — 경계 문형(live 223b32): "X 한도로 5년 저축을 유지할 수 있으면 A 가 맞습니다", "X 한도를 유지할 수 있으면", "X까지 유지 가능하면", "X 수준을 유지할 여력이 있으면".
 * 값 뒤에 한도·까지·수준 이 붙어도, 조건절이 "유지/납입 가능" 이고 그 조건이 추천 행위(맞습니다·낫습니다·검토·봅니다…)의 직접 선행 조건이면 같은 강화다.
 * 구조: VALUE ROLE(MAXIMUM) + CONDITIONAL RELATION(…으면/다면) + RECOMMENDATION ACTION.
 */
const BOUNDARY = new RegExp(`((?:월|매월|매달|연|매년)\\s*)?(${VALUE_SRC})\\s*(?:한도로|한도를|한도까지|한도의|까지|수준을|수준으로|수준의)\\s*[가-힣0-9\\s]{0,10}?(?:유지|납입|저축|이어)[가-힣]{0,3}\\s*(?:여력|가능|수\\s*있)[가-힣\\s]{0,8}?(?:다면|으면|면|라면|경우(?:에|라면)?)`, 'g');
const RECOMMENDATION = /맞습니다|맞고|맞죠|낫습니다|낫죠|나아요|낫다|좋습니다|권합니다|추천|선택(?:합니다|하세요|이 맞)|검토(?:합니다|하는)|봅니다|비교합니다|유지(?:가|하는 편이)\s*(?:맞|낫)|(?:편|쪽)이\s*(?:맞|낫|좋|유리)|유리(?:합니다|해요|하다|하죠)/;
/**
 * v3.8.766 — 구조 판정(live ed05c6): 값 + 능력 술어(가능·수 있·여력)가 **어떤 이음말로든** 끝나고, 같은 문장 뒤쪽에 추천·행동이 오면
 * 그 값은 추천의 선행 조건이다. 실측 두 문장:
 *   답 상자 "5년간 월 70만원 납입이 가능하고 남은 기간까지 유지할 수 있다면 … 먼저 선택하는 편이 맞습니다"
 *   결론   "월 70만 원을 장기간 납입할 수 있고 … 남은 만기가 부담스럽지 않다면 유지하는 쪽이 맞습니다"
 * ABILITY 는 조건이 값 바로 뒤에서 "…가능하면" 으로 끝나야 잡았다 — 사이에 다른 조건(…하고 …다면)이 끼거나 부사("장기간")가 앞서면 놓쳤다.
 * 문형 목록을 늘리지 않는다: VALUE + ABILITY PREDICATE + RECOMMENDATION(뒤쪽) 세 가지만 본다. 값의 역할(MAXIMUM)은 근거에서 읽는다.
 */
const ABILITY_CONNECTIVE = '(?:하고|하며|하면서|하면|하다면|해서|고|며|으면|면|다면|라면|는\\s*경우(?:에는|에|라면)?)';
const ABILITY_REC = new RegExp(`((?:월|매월|매달|연|매년|하루|1일)\\s*)?(${VALUE_SRC})(?:을|를|이|은|는|의)?\\s*(?:[가-힣0-9]{1,4}\\s+){0,2}?(?:[가-힣]{1,6}\\s*)?(?:가능|수\\s*있|여력이\\s*있|여력)${ABILITY_CONNECTIVE}`, 'g');
/** 명시적 계산 가정 — "매월 X를 실제로 넣는다고 가정하면 총납입액은" 은 조건이 아니라 계산이다(허용) */
const CALC_ASSUMPTION = /가정|예를\s*들어|예컨대|이라고\s*(?:놓|치|보|하)|넣는다고\s*하면|낸다고\s*하면|총\s*납입|원금은/;

export interface StrengthenedHit { value: string; match: string; kind: 'known' | 'hada' | 'other' | 'ability' | 'ability-rec' }
export function findStrengthened(sentence: string): StrengthenedHit[] {
  const s = plain(sentence);
  const out: StrengthenedHit[] = [];
  if (CALC_ASSUMPTION.test(s)) return out;
  for (const m of s.matchAll(ABILITY)) out.push({ value: m[2]!, match: m[0], kind: 'ability' });
  if (RECOMMENDATION.test(s)) for (const m of s.matchAll(BOUNDARY)) if (!out.some((o) => o.match.includes(m[2]!))) out.push({ value: m[2]!, match: m[0], kind: 'ability' });
  // v3.8.766 — 능력 절 + (다른 조건) + 뒤쪽 추천. 추천이 능력 절 **뒤에** 있어야 한다(앞에 있으면 조건이 아니다)
  for (const m of s.matchAll(ABILITY_REC)) {
    if (out.some((o) => o.match.includes(m[2]!) || m[0].includes(o.match))) continue;
    if (RECOMMENDATION.test(s.slice(m.index! + m[0].length))) out.push({ value: m[2]!, match: m[0], kind: 'ability-rec' });
  }
  for (const m of s.matchAll(KNOWN)) if (!out.some((o) => o.match.includes(m[2]!))) out.push({ value: m[2]!, match: m[0], kind: 'known' });
  for (const m of s.matchAll(HADA)) if (!out.some((o) => o.match.includes(m[1]!))) out.push({ value: m[1]!, match: m[0], kind: 'hada' });
  for (const m of s.matchAll(OTHER)) if (!out.some((o) => o.match.includes(m[1]!))) out.push({ value: m[1]!, match: m[0], kind: 'other' });
  return out;
}

/** 근거상 상한(MAXIMUM)이고 요구(REQUIRED/MINIMUM)가 아닌 값인가 */
export const isMaximumOnly = (r: RoleEvidence): boolean => r.roles.includes('MAXIMUM') && !r.roles.includes('REQUIRED') && !r.roles.includes('MINIMUM');

/**
 * 한 문장을 약화한다. 바꿀 수 없으면 after 없이 flagged.
 * @param dimensions v3.8.761 — 이 글에 실제로 있는 다른 판단축(예: 핵심 질문의 "남은 기간"). 있으면 상한 하나로 결론을 만들지 않게 조건을 병렬로 남긴다. 하드코딩 아님(호출부가 계획에서 준다)
 */
export function weakenSentence(sentence: string, evidence: string, options: { dimensions?: string[] } = {}): { after: string; changes: Array<{ value: string; roles: ValueRole[]; action: 'weakened' | 'flagged'; reason: string }> } {
  const changes: Array<{ value: string; roles: ValueRole[]; action: 'weakened' | 'flagged'; reason: string }> = [];
  let after = sentence;
  const dims = (options.dimensions || []).filter(Boolean);
  for (const hit of findStrengthened(sentence)) {
    const role = valueRoles(evidence, hit.value);
    if (!isMaximumOnly(role)) continue;                                                   // 근거에 요구 조건이 있으면(또는 역할을 모르면) 손대지 않는다
    if (new RegExp(`최대\\s*${loose(hit.value)}`).test(plain(sentence))) continue;           // 이미 상한으로 말한다
    const v = compactAmount(hit.value);
    if (hit.kind === 'ability-rec') {
      // 납입·저축(금액) 꼴만 안전하게 바꾼다 — 상한을 "실제 납입 가능액" 판단으로 돌리고, 이 글의 판단축 가운데 문장에 아직 없는 것만 곁에 둔다.
      // 이음말은 그대로 이어 받는다(…가능하고 → …수 있고). 그 밖(거리·용량·시간·보상)은 안전한 치환이 없어 기록만(FLAG).
      const finance = /납입|저축|적립|넣|낼|채우|채워/.test(hit.match) || /원$/.test(v);
      if (!finance) {
        changes.push({ value: v, roles: role.roles, action: 'flagged', reason: `상한 ${v} 이 추천의 선행 조건으로 쓰였으나 안전한 치환이 없어 두었다: "${hit.match}"` });
        continue;
      }
      const conn = (hit.match.match(new RegExp(`${ABILITY_CONNECTIVE}$`)) || [''])[0].replace(/\s+/g, ' ');
      const ending = /^(?:하고|고)$/.test(conn) ? '있고' : /^(?:하며|며|하면서)$/.test(conn) ? '있으며' : /^(?:하면|으면|면|해서)$/.test(conn) ? '있으면' : /^(?:하다면|다면|라면)$/.test(conn) ? '있다면' : `있${conn.replace(/^는/, '는')}`;
      const extra = dims.filter((d) => !plain(sentence).includes(d));
      after = after.replace(hit.match, `최대 ${v} 한도 안에서 실제 납입 가능액${extra.length ? ` · ${extra.join(' · ')}` : ''}을 함께 보고 납입을 이어갈 수 ${ending}`);
      changes.push({ value: v, roles: role.roles, action: 'weakened', reason: `MAXIMUM_AS_RECOMMENDATION_CONDITION — 근거는 ${v} 을 상한으로만 말한다(${role.hits[0] || ''}) — 추천의 조건이 아니다` });
      continue;
    }
    if (hit.kind === 'ability') {
      const finance = /납입|저축|적립|유지|넣|낼|채우|채워|원/.test(hit.match) || /원$/.test(v);
      const verb = (hit.match.match(/(이용|사용|주행|투자|결제)/) || [])[1];
      const tail = (hit.match.match(/(다면|으면|면|라면|경우(?:에|라면)?|해야|어야|아야)$/) || ['', '다면'])[1] || '다면';
      const ending = /해야|어야|아야/.test(tail) ? '있어야' : `있${tail === '으면' || tail === '면' ? '으면' : tail === '라면' ? '다면' : tail.startsWith('경우') ? '는 경우' : '다면'}`;
      const replacement = finance
        ? `최대 ${v} 한도 안에서 실제 납입 가능액${dims.length ? ` · ${dims.join(' · ')}` : ''}을 함께 보고 납입을 이어갈 수 ${ending}`
        : `최대 ${v}까지 ${verb || '이용'}할 수 ${ending}`;
      after = after.replace(hit.match, replacement);
      changes.push({ value: v, roles: role.roles, action: 'weakened', reason: `근거는 ${v} 을 상한으로만 말한다(${role.hits[0] || ''}) — 낼 수 있어야 하는 조건이 아니다` });
      continue;
    }
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
export function weakenHtml(html: string, evidence: string, location: string, options: { dimensions?: string[] } = {}): { html: string; changes: SemanticChange[] } {
  const changes: SemanticChange[] = [];
  const out = String(html || '').replace(/(<[^>]*>)|([^<]+)/g, (_all, tag: string, text: string) => {
    if (tag) return tag;
    const sentences = String(text || '').split(/(?<=[.!?])\s+/);
    return sentences.map((s) => {
      const r = weakenSentence(s, evidence, options);
      for (const c of r.changes) changes.push({ location, sentence: plain(s), ...c, ...(c.action === 'weakened' ? { after: plain(r.after) } : {}) });
      return r.after;
    }).join(' ');
  });
  return { html: out, changes };
}

interface ArticleLike { introduction?: string; conclusion?: string; sections?: Array<{ takeaway?: string; h3Sections?: Array<{ content?: string }> }> }
/** 글 전체(서론·절 본문·takeaway·결론) — 표 칸·제목은 판단문이 아니라 건드리지 않는다 */
export function alignArticleDecisionSemantics<T extends ArticleLike>(article: T, evidence: string, options: { dimensions?: string[] } = {}): SemanticArticleResult<T> {
  const changes: SemanticChange[] = [];
  const run = (html: string | undefined, location: string): string | undefined => {
    if (!html) return html;
    const r = weakenHtml(html, evidence, location, options);
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
