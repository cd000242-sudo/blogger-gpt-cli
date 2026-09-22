/**
 * 🧾 RESEARCH PACKET — Writer 가 읽기 전에 **근거를 사실 목록으로 정리한다.** (v3.8.734)
 *
 * ## 왜
 * 지금까지 Writer 는 긁어 온 글자 1만 자를 통째로 받아, 읽으면서 동시에 9개 절을 썼다.
 * 웹 UI 의 모델이 잘 쓰는 이유는 "검색 → 읽기 → 정리 → 쓰기"를 나눠 하기 때문이다.
 * 여기서 '정리'를 떼어 낸다 — 사실 하나하나에 **어느 근거(sourceId)에서 왔는지**를 붙인다.
 *
 * ## 두 겹으로 만든다
 *   ① 코드: 금액·날짜·기간·비율을 근거 본문에서 직접 뽑는다. 지어낼 수가 없다(원문에 있는 글자다).
 *   ② LLM 1회: 자격·조건·기관 발표·엇갈리는 정보를 문장으로 정리한다.
 *      돌아온 JSON 은 **검증한다** — 없는 sourceId, 인용한 근거에 없는 숫자가 든 문장은 버린다.
 *      파싱이 안 되면 고치기 1회 → 다시 만들기 1회. 그래도 안 되면 ①만으로 간다(빈 객체로 Writer 를 돌리지 않는다).
 *
 * 근거가 0건이면 packet 은 status='EMPTY' 다. 그때 Writer 는 구체적인 수치·일정을 쓰지 말라는 지시를 받는다.
 */

import type { EvidenceItem } from './evidence';
import { kstToday } from './kst-date';

export interface SourcedClaim { claim: string; sourceIds: string[] }
export interface SourcedValue {
  value: string; context: string; sourceIds: string[];
  /** 748 — 어디서 왔나. LLM 문장에도 있으면 LLM_PACKET, 코드만 잡았고 진입 조건을 통과하면 DETERMINISTIC_RECOVERY, 아니면 CODE_ONLY */
  origin?: ValueOrigin;
}
export interface PacketRecovery { added: number; values: string[]; codeOnly: number }

export interface ResearchPacket {
  mainKeyword: string;
  topic: string;
  searchIntent: string;
  currentAsOf: string;
  facts: SourcedClaim[];
  numbers: SourcedValue[];
  dates: SourcedValue[];
  eligibility: SourcedClaim[];
  conditions: SourcedClaim[];
  officialStatements: SourcedClaim[];
  conflictingInformation: SourcedClaim[];
  readerQuestions: string[];
  actualSearchSuggestions: string[];
  sourceMap: Array<{ id: string; title: string; domain: string; url: string; pubDate: string | null; sourceType: string; isOfficial: boolean }>;
  /** OK = LLM 정리까지 됨 · CODE_ONLY = 코드 추출만 · EMPTY = 근거 없음 */
  status: 'OK' | 'CODE_ONLY' | 'EMPTY';
  notes: string[];
  /** 748 — LLM 정리가 빠뜨린 값을 코드 추출이 얼마나 보존했나(출처·관련도 조건 통과분만) */
  recovery?: PacketRecovery;
}

/**
 * 748 Search Pipeline — 범위값과 "N여 개 객실" 을 잡는다.
 * 실측(748b): 출처에 "약 12,800여 개 객실 · 행사 최소 3~6개월 전" 이 있었는데 코드 추출이 "6개월" 만 뽑았다(범위·'여 개' 미지원).
 * 그 실행에서 LLM 정리가 그 문장을 안 옮기자 패킷에서 값이 통째로 사라졌다 — 수치·날짜는 코드 추출이 유일한 보루다.
 * 범위 패턴을 앞에 두고, 이미 잡힌 범위 안의 부분값("6개월")은 다시 뽑지 않는다.
 */
const NUMBER_PATTERNS: RegExp[] = [
  /\d[\d,]*(?:\.\d+)?\s*[~∼]\s*\d[\d,]*(?:\.\d+)?\s*(?:개월|년|주|일|시간|%|만원|원|명|배|회|개|박)/g,
  /\d[\d,]*(?:\.\d+)?\s*(?:억\s*)?(?:천만|백만|십만|만|천)?\s*원/g,
  /\d+(?:\.\d+)?\s*%/g,
  /\d[\d,]*\s*여\s*(?:개|실|객실|석|곳|대|편|명|건|가구|세대|박)\s*(?:객실|호실|가구|세대)?/g,   // "12,800여 개 객실" — 긴 것이 먼저
  /\d[\d,]*\s*(?:명|건|가구|세대|배|회|좌|만좌|개월|년간|세)/g,
  /\d[\d,]*\s*(?:여\s*)?(?:개|실|객실|석|곳|대|편|박)(?![가-힣])/g,
];
export type ValueOrigin = 'LLM_PACKET' | 'DETERMINISTIC_RECOVERY' | 'CODE_ONLY';
const DATE_PATTERNS: RegExp[] = [
  /(?:20\d{2}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일(?:\s*[~∼\-부터]+\s*(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일)?/g,
  /\d{1,2}\s*월\s*\d{1,2}\s*[~∼\-]\s*\d{1,2}\s*일/g,
  /20\d{2}\s*년\s*\d{1,2}\s*월/g,
];

const norm = (s: string) => String(s || '').replace(/[,\s]/g, '');

/** 값이 들어 있는 문장(앞뒤 맥락) — 숫자만 주면 무엇의 숫자인지 모른다 */
function sentenceAround(text: string, index: number, length: number): string {
  const start = Math.max(text.lastIndexOf('.', index - 1), text.lastIndexOf('\n', index - 1)) + 1;
  const dot = text.indexOf('.', index + length);
  const nl = text.indexOf('\n', index + length);
  const ends = [dot, nl].filter((n) => n >= 0);
  const end = ends.length ? Math.min(...ends) + 1 : text.length;
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 160);
}

/** 키워드 낱말(조사 뗀 2글자 이상) — 추출 상한에 걸릴 때 키워드와 겹치는 문맥의 값을 먼저 살린다 */
function keywordTokens(keyword: string): string[] {
  return String(keyword || '').toLowerCase().split(/[^0-9a-z가-힣]+/).map((w) => w.replace(/(의|와|과|을|를|은|는|이|가|에|로|으로|에서|까지|부터|도|만)$/, '')).filter((w) => w.length >= 2);
}

function extractValues(items: EvidenceItem[], patterns: RegExp[], max: number, keyword = ''): SourcedValue[] {
  const byValue = new Map<string, SourcedValue>();
  const kw = keywordTokens(keyword);
  const relevance = new Map<string, number>();
  for (const item of items) {
    const text = `${item.title}. ${item.cleanedText}`;
    const taken: Array<[number, number]> = [];   // 이미 잡힌 범위값("3~6개월")의 자리 — 그 안의 "6개월" 은 다시 뽑지 않는다
    for (const base of patterns) {
      const re = new RegExp(base.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const start = m.index; const end = m.index + m[0].length;
        if (taken.some(([s, e]) => start < e && end > s)) continue;   // 겹치면(안이든 밖이든) 먼저 잡힌 긴 패턴이 이긴다
        const value = m[0].replace(/\s+/g, ' ').trim();
        if (value.length < 2) continue;
        taken.push([start, end]);
        const key = norm(value);
        const prev = byValue.get(key);
        if (prev) { if (!prev.sourceIds.includes(item.id)) prev.sourceIds.push(item.id); continue; }
        const context = sentenceAround(text, m.index, m[0].length);
        byValue.set(key, { value, context, sourceIds: [item.id] });
        const cf = context.toLowerCase();
        relevance.set(key, kw.filter((t) => cf.includes(t)).length);
      }
    }
  }
  // 여러 근거가 되풀이하는 값이 먼저, 그다음 공식 출처의 값, 그다음 키워드 낱말과 겹치는 문맥 — 이게 글의 뼈대다
  const official = new Set(items.filter((i) => i.isOfficial).map((i) => i.id));
  return [...byValue.entries()]
    .sort(([ka, a], [kb, b]) => (b.sourceIds.length - a.sourceIds.length)
      || (Number(b.sourceIds.some((id) => official.has(id))) - Number(a.sourceIds.some((id) => official.has(id))))
      || ((relevance.get(kb) || 0) - (relevance.get(ka) || 0)))
    .map(([, v]) => v)
    .slice(0, max);
}

/** 사이트 껍데기·기사 시점 문맥 — 복구 값으로 세지 않는다(값 자체는 RAW 에 남는다) */
const RECOVERY_NOISE = /검색\s*결과|조회수|댓글\s*\d|공감\s*\d|구독자|좋아요|팔로워|작성일|게시일|방송일|기사입력|·\s*\d+\s*(?:개월|일|년)\s*전\]/;

/**
 * 748 — 값의 출처를 표시한다. LLM 문장에도 같은 값이 있으면 LLM_PACKET, 코드만 잡았으면 진입 조건(출처 id·키워드 관련·잡음 아님)을
 * 통과할 때 DETERMINISTIC_RECOVERY, 아니면 CODE_ONLY. **값을 빼거나 절에 배정하지 않는다** — Writer 보기가 최종 KEEP/DEMOTE/DROP 을 정한다.
 */
export function markValueOrigins(packet: ResearchPacket): ResearchPacket {
  const claimText = norm(CLAIM_KEYS.flatMap((k) => ((packet as any)[k] || []) as SourcedClaim[]).map((c) => c.claim).join(' '));
  const kw = keywordTokens(`${packet.mainKeyword} ${packet.topic}`);
  const known = new Set(packet.sourceMap.map((s) => s.id));
  const recovered: string[] = [];
  let codeOnly = 0;
  const tag = (v: SourcedValue): SourcedValue => {
    const key = norm(v.value);
    if (key.length >= 2 && claimText.includes(key)) return { ...v, origin: 'LLM_PACKET' };
    const cf = String(v.context || '').toLowerCase();
    const related = kw.some((t) => cf.includes(t));
    const sourced = (v.sourceIds || []).some((id) => known.has(id));
    if (related && sourced && !RECOVERY_NOISE.test(v.context || '')) { recovered.push(v.value); return { ...v, origin: 'DETERMINISTIC_RECOVERY' }; }
    codeOnly += 1;
    return { ...v, origin: 'CODE_ONLY' };
  };
  const numbers = packet.numbers.map(tag);
  const dates = packet.dates.map(tag);
  return { ...packet, numbers, dates, recovery: { added: recovered.length, values: recovered.slice(0, 12), codeOnly } };
}

export function buildCodePacket(input: {
  mainKeyword: string; title: string; items: EvidenceItem[];
  readerQuestions?: string[]; searchSuggestions?: string[]; now?: Date;
}): ResearchPacket {
  const items = input.items || [];
  return {
    mainKeyword: input.mainKeyword,
    topic: input.title || input.mainKeyword,
    searchIntent: '',
    currentAsOf: kstToday(input.now),
    facts: [],
    numbers: extractValues(items, NUMBER_PATTERNS, 24, input.mainKeyword),
    dates: extractValues(items, DATE_PATTERNS, 16, input.mainKeyword),
    eligibility: [], conditions: [], officialStatements: [], conflictingInformation: [],
    readerQuestions: [...new Set((input.readerQuestions || []).map((q) => String(q).trim()).filter(Boolean))].slice(0, 10),
    actualSearchSuggestions: [...new Set((input.searchSuggestions || []).map((q) => String(q).trim()).filter(Boolean))].slice(0, 12),
    sourceMap: items.map((i) => ({ id: i.id, title: i.title, domain: i.domain, url: i.url, pubDate: i.pubDate, sourceType: i.sourceType, isOfficial: i.isOfficial })),
    status: items.length === 0 ? 'EMPTY' : 'CODE_ONLY',
    notes: [],
  };
}

export function buildPacketPrompt(mainKeyword: string, title: string, evidenceText: string, today: string): string {
  return [
    '당신은 리서처입니다. 아래 근거만 읽고, 글쓴이가 쓸 **사실 목록**을 JSON 으로 정리하세요. 글을 쓰지 마세요.',
    `오늘(서울): ${today}`,
    `메인 키워드: ${mainKeyword}`,
    `글 제목: ${title}`,
    '',
    '규칙',
    '- 모든 항목에 sourceIds 를 붙입니다. 근거의 머리줄에 있는 [E01] 같은 id 만 씁니다. id 를 지어내지 마세요.',
    '- 근거에 **글자로 적혀 있는** 것만 옮깁니다. 숫자·날짜·금액·기관명은 근거의 표기 그대로 씁니다. 추론·상식으로 채우지 마세요.',
    '- 게시일이 다른 근거끼리 내용이 다르면(예: 1차 공고와 2차 공고) 섞지 말고, 더 최근 것을 facts 에 넣고 차이는 conflictingInformation 에 적습니다.',
    '- 메인 키워드와 상관없는 내용은 버립니다.',
    '- 해당 없는 칸은 빈 배열입니다. 칸을 채우려고 지어내지 마세요.',
    '',
    '출력 (JSON 객체 하나만, 설명·코드펜스 없이)',
    '{',
    '  "searchIntent": "검색한 사람이 지금 알고 싶은 것 한 문장",',
    '  "facts": [{"claim": "…", "sourceIds": ["E01"]}],',
    '  "eligibility": [{"claim": "누가 되고 안 되는지", "sourceIds": []}],',
    '  "conditions": [{"claim": "절차·요건·서류·주의", "sourceIds": []}],',
    '  "officialStatements": [{"claim": "기관이 발표한 내용(기관명 포함)", "sourceIds": []}],',
    '  "conflictingInformation": [{"claim": "근거끼리 다른 점과 각 근거의 게시일", "sourceIds": []}]',
    '}',
    '',
    '===== 근거 =====',
    evidenceText,
  ].join('\n');
}

function extractJson(raw: string): any | null {
  const text = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const body = text.slice(start, end + 1);
  try { return JSON.parse(body); } catch { /* 아래에서 한 번 더 */ }
  try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]+/g, ' ')); } catch { return null; }
}

const CLAIM_KEYS = ['facts', 'eligibility', 'conditions', 'officialStatements', 'conflictingInformation'] as const;

/** 스키마 검사 — 모양이 틀리면 이유를 돌려준다(고치기 프롬프트에 그대로 쓴다) */
export function validatePacketShape(obj: any): string[] {
  const errors: string[] = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ['최상위가 JSON 객체가 아닙니다'];
  if (typeof obj.searchIntent !== 'string') errors.push('searchIntent 가 문자열이 아닙니다');
  for (const key of CLAIM_KEYS) {
    if (!Array.isArray(obj[key])) { errors.push(`${key} 가 배열이 아닙니다`); continue; }
    obj[key].forEach((c: any, i: number) => {
      if (!c || typeof c.claim !== 'string' || !Array.isArray(c.sourceIds)) errors.push(`${key}[${i}] 는 {claim, sourceIds[]} 꼴이어야 합니다`);
    });
  }
  return errors;
}

const VALUE_IN_CLAIM = /\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|십만|만|천)?\s*(?:원|%|명|건|가구|세대|배|회|좌|개월|년|월|일|세)/g;

/**
 * 근거 대조 — 이 단계가 패킷의 값어치다.
 * · 없는 sourceId 는 뗀다. 남는 id 가 없으면 그 문장을 버린다.
 * · 문장 안의 수치·날짜가 **인용한 근거 본문에 없으면** 버린다(모델이 정리하다 만든 값이다).
 */
export function groundClaims(claims: any[], items: EvidenceItem[]): { kept: SourcedClaim[]; dropped: number } {
  const byId = new Map(items.map((i) => [i.id, norm(`${i.title} ${i.cleanedText}`)]));
  const kept: SourcedClaim[] = [];
  let dropped = 0;
  for (const c of Array.isArray(claims) ? claims : []) {
    const claim = String(c?.claim || '').trim();
    const ids = [...new Set((Array.isArray(c?.sourceIds) ? c.sourceIds : []).map(String))].filter((id) => byId.has(id as string)) as string[];
    if (claim.length < 6 || ids.length === 0) { dropped += 1; continue; }
    const values = (claim.match(VALUE_IN_CLAIM) || []).map(norm);
    const cited = ids.map((id) => byId.get(id) || '').join(' ');
    if (values.some((v) => !cited.includes(v))) { dropped += 1; continue; }
    kept.push({ claim: claim.slice(0, 260), sourceIds: ids });
  }
  return { kept, dropped };
}

export type CallModel = (prompt: string, opts?: { json?: boolean }) => Promise<string>;

/**
 * 패킷을 만든다. **어떤 경우에도 던지지 않는다** — 실패하면 코드 추출분으로 돌아가고 notes 에 이유를 남긴다.
 */
export async function buildResearchPacket(input: {
  mainKeyword: string; title: string; items: EvidenceItem[]; evidenceText: string;
  readerQuestions?: string[]; searchSuggestions?: string[];
  callModel?: CallModel; onLog?: (m: string) => void; now?: Date;
}): Promise<ResearchPacket> {
  const packet = buildCodePacket(input);
  if (packet.status === 'EMPTY' || !input.callModel || process.env['RESEARCH_PACKET_LLM'] === '0') {
    if (packet.status !== 'EMPTY') packet.notes.push('LLM 정리 생략 — 코드 추출만');
    return packet;
  }

  const prompt = buildPacketPrompt(input.mainKeyword, input.title, input.evidenceText, packet.currentAsOf);
  let parsed: any = null;
  let errors: string[] = [];
  let lastRaw = '';
  // 1회차: 생성 → 실패하면 2회차: 고치기 → 실패하면 3회차: 다시 생성
  for (const step of ['generate', 'repair', 'regenerate'] as const) {
    try {
      const ask = step === 'repair'
        ? `아래 출력은 JSON 규격에 맞지 않습니다.\n문제: ${errors.join(' / ') || 'JSON 으로 읽히지 않음'}\n내용은 바꾸지 말고 규격에 맞는 JSON 객체 하나로만 다시 출력하세요.\n\n${lastRaw.slice(0, 12000)}`
        : prompt;
      lastRaw = await input.callModel(ask, { json: true });
      parsed = extractJson(lastRaw);
      errors = parsed ? validatePacketShape(parsed) : ['JSON 으로 읽히지 않음'];
      if (parsed && errors.length === 0) break;
      input.onLog?.(`🧾 Research Packet ${step} 실패 — ${errors.slice(0, 2).join(' / ')}`);
      parsed = null;
    } catch (err: any) {
      errors = [String(err?.message || err).slice(0, 120)];
      input.onLog?.(`🧾 Research Packet ${step} 호출 실패 — ${errors[0]}`);
      if ((err as any)?.canceled === true) throw err;
      parsed = null;
    }
  }

  if (!parsed) {
    packet.notes.push(`LLM 정리 실패(${errors.slice(0, 2).join(' / ')}) — 코드 추출만 사용`);
    return packet;
  }

  let dropped = 0;
  for (const key of CLAIM_KEYS) {
    const g = groundClaims(parsed[key], input.items);
    (packet as any)[key] = g.kept.slice(0, key === 'facts' ? 18 : 10);
    dropped += g.dropped;
  }
  packet.searchIntent = String(parsed.searchIntent || '').slice(0, 200);
  packet.status = 'OK';
  if (dropped > 0) packet.notes.push(`근거와 맞지 않아 버린 문장 ${dropped}개 (없는 출처 id 또는 근거에 없는 수치)`);
  // 748 — LLM 이 옮기지 않은 값도 코드 추출분으로 남는다. 어디서 왔는지 표시만 한다(빼지도, 절에 배정하지도 않는다)
  return markValueOrigins(packet);
}

/** Writer 에게 줄 글자 — 패킷이 근거보다 먼저 온다 */
export function renderPacket(p: ResearchPacket): string {
  const line = (c: SourcedClaim) => `- ${c.claim} [${c.sourceIds.join(',')}]`;
  const val = (v: SourcedValue) => `- ${v.value} — ${v.context} [${v.sourceIds.join(',')}]`;
  const section = (title: string, rows: string[]) => (rows.length ? [`▸ ${title}`, ...rows] : []);
  return [
    `[RESEARCH PACKET — ${p.currentAsOf} 서울 기준 · 메인 키워드: ${p.mainKeyword}]`,
    ...(p.searchIntent ? [`검색 의도: ${p.searchIntent}`] : []),
    ...section('확인된 사실', p.facts.map(line)),
    ...section('자격·대상', p.eligibility.map(line)),
    ...section('조건·절차', p.conditions.map(line)),
    ...section('기관 발표', p.officialStatements.map(line)),
    ...section('수치 (근거 원문 표기 그대로)', p.numbers.map(val)),
    ...section('날짜·기간 (근거 원문 표기 그대로)', p.dates.map(val)),
    ...section('근거끼리 다른 점 — 섞어 쓰지 마세요', p.conflictingInformation.map(line)),
    ...section('검색자가 실제로 물은 것', p.readerQuestions.map((q) => `- ${q}`)),
    ...section('실제 자동완성(연관 검색어)', p.actualSearchSuggestions.length ? [`- ${p.actualSearchSuggestions.join(' / ')}`] : []),
    ...(p.status === 'EMPTY' ? ['⚠️ 확인된 근거가 없습니다. 금액·날짜·기간·자격조건을 구체적으로 쓰지 말고, 공식 창구에서 확인하라고 안내하세요.'] : []),
  ].join('\n');
}
