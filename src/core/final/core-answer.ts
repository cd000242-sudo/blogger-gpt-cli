/**
 * 🧭 v3.8.765 — 핵심 질문의 **현재 공식 답** 을 원문에서 찾고, 그 답이 Writer 까지 가는지·글이 거꾸로 쓰지 않았는지 본다. 호출 0회·결정론.
 *
 * 실측(run 111bcf, "청년미래적금 VS 청년 도약계좌"): 현재 회차 공식 공고(본문 확보)에 "이번 2차 모집에서는 기존 가입자가 … 갈아탈 수 있는 기회를
 * 추가로 제공한다" 가 있었는데, 근거 렌더(11,000자)가 그 문장을 떼고 "중복가입 불가" 조각만 실었다. 제목은 6월 기사 제목("갈아타는 건 '6월만' 허용")을 보고
 * "갈아타기 불가" 로 먼저 결론을 냈고, 그 제목이 다시 검색어가 되어 6월 기사를 더 불러왔다. 본문 수집 성공 ≠ 핵심 답 전달 성공.
 *
 * 범위: 코드가 계획한 핵심 질문(core-questions)마다 **가능/불가** 한 축만 본다(대형 NLI 없음). 불확실하면 뒤집지 않고 CONFLICT·NEEDS_REVIEW 로 남긴다.
 * 낱말은 전환·허용을 말하는 일반 어휘뿐이다 — 상품명·기관명·회차 숫자는 코드에 없다.
 */
import type { CoreQuestion } from './core-questions';
import { sentenceRanges } from './evidence';

export type Polarity = 'YES' | 'NO';
/** 질문별 주제 표지 — 이 낱말 뒤 짧은 창(window)에서 가능/불가를 읽는다 */
const TOPIC: Record<string, RegExp> = {
  'CQ-SWITCH-AVAILABILITY': /갈아타|갈아탈|갈아탄|전환(?=하|할|이|을|은|가|\s)|환승|옮겨|옮기|옮길/g,
};
/** 제한("…에게만·…에 한해")은 지금 회차에는 안 된다는 뜻이라 NO 쪽이다 */
const NO_CUE = /불가|할\s*수\s*없|수\s*없|허용되지\s*않|허용하지\s*않|안\s*됩니다|안\s*된다|안\s*돼|보면\s*안|않습니다|끝났|종료|지났|막혀|막힌|제외|어렵습니다|에게만|에만\s*(?:허용|가능)|에\s*한해|에게\s*한해|한정|만\s*허용|만\s*가능/;
const YES_CUE = /가능|허용|제공|할\s*수\s*있|수\s*있|기회|재개|다시\s*열|추가로?\s*(?:제공|허용|열)/;
/** 창을 끊는 곳 — 각주·목록 기호, 다음 항목 */
const WINDOW_STOP = /[※*]|\s-\s|\s□|\s○/;
/** 지난 회차·과거 이야기로 쓴 문장은 현재 규칙과의 모순이 아니다 */
const PAST_CONTEXT = /지난|과거|당시|이전\s*(?:회차|모집)|예전/;
const NOW_CONTEXT = /이번|현재|지금|올해|앞으로|이제/;

const plain = (s: string) => String(s || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const norm = (s: string) => plain(s).replace(/\s+/g, '');

/** 문장이 이 질문에 대해 말하는 가능/불가 — 주제 표지 뒤 30자 안(각주 기호 전까지). NO 표지가 있으면 NO(“기회로 보면 안 됩니다”) */
export function answerPolarity(sentence: string, cqId: string): { polarity: Polarity; cue: string; window: string } | null {
  const topic = TOPIC[cqId];
  if (!topic) return null;
  const s = plain(sentence);
  for (const m of s.matchAll(new RegExp(topic.source, 'g'))) {
    let win = s.slice(m.index!, m.index! + m[0].length + 30);
    const stop = win.slice(m[0].length).search(WINDOW_STOP);
    if (stop >= 0) win = win.slice(0, m[0].length + stop);
    const no = win.match(NO_CUE);
    if (no) return { polarity: 'NO', cue: no[0], window: win };
    const yes = win.match(YES_CUE);
    if (yes) return { polarity: 'YES', cue: yes[0], window: win };
  }
  return null;
}

export interface EvidenceItemLike { id: string; url?: string; cleanedText: string; isOfficial?: boolean }
export interface AnswerSpan { cqId: string; itemId: string; url: string; range: [number, number]; sentence: string; polarity: Polarity; window: string }
export type AnswerVerdict = 'YES' | 'NO' | 'CONFLICT' | 'NONE';
export interface OfficialAnswer { cqId: string; question: string; verdict: AnswerVerdict; sourceAvailable: boolean; sourceIds: string[]; spans: AnswerSpan[] }

/** 현재 회차 공식 문서 — grounding officialStatus 가 roundRelevance=current 로 판정한 후보의 URL 과 같은 문서 */
export function currentOfficialIds(items: EvidenceItemLike[], officialStatus: { candidates?: Array<{ url: string; roundRelevance?: string; status?: string }> } | null | undefined): string[] {
  const urls = new Set((officialStatus?.candidates || []).filter((c) => c.roundRelevance === 'current' && c.status === 'body').map((c) => String(c.url).replace(/[?#].*$/, '').replace(/\/$/, '')));
  return items.filter((i) => i.isOfficial && urls.has(String(i.url || '').replace(/[?#].*$/, '').replace(/\/$/, ''))).map((i) => i.id);
}

/** 계획된 핵심 질문마다 현재 공식 문서의 답(가능/불가) — 문장 원문 그대로, 범위(오프셋)와 함께 */
export function officialAnswers(items: EvidenceItemLike[], officialIds: string[], questions: CoreQuestion[]): OfficialAnswer[] {
  const official = items.filter((i) => officialIds.includes(i.id));
  return questions.filter((q) => q.applicable && TOPIC[q.id]).map((q) => {
    const spans: AnswerSpan[] = [];
    for (const item of official) {
      for (const [s, e] of sentenceRanges(item.cleanedText)) {
        const sentence = item.cleanedText.slice(s, e);
        const p = answerPolarity(sentence, q.id);
        if (p) spans.push({ cqId: q.id, itemId: item.id, url: String(item.url || ''), range: [s, e], sentence: plain(sentence).slice(0, 400), polarity: p.polarity, window: p.window });
      }
    }
    const yes = spans.some((x) => x.polarity === 'YES');
    const no = spans.some((x) => x.polarity === 'NO');
    const verdict: AnswerVerdict = yes && no ? 'CONFLICT' : yes ? 'YES' : no ? 'NO' : 'NONE';
    return { cqId: q.id, question: q.question, verdict, sourceAvailable: official.length > 0, sourceIds: [...new Set(spans.map((x) => x.itemId))], spans };
  });
}

export type CoverageState = 'FOUND_AND_DELIVERED' | 'FOUND_NOT_DELIVERED' | 'NOT_FOUND_IN_SOURCE' | 'SOURCE_NOT_AVAILABLE';
/** 공식 답 문장이 Writer 에게 가는 글자(근거 렌더)에 실렸는가 — 주제 표지와 그 뒤 창이 그대로 있어야 실린 것이다 */
export function coreAnswerCoverage(answers: OfficialAnswer[], deliveredText: string): Array<{ cqId: string; state: CoverageState; verdict: AnswerVerdict; spans: Array<{ itemId: string; sentence: string; delivered: boolean }> }> {
  const delivered = norm(deliveredText);
  return answers.map((a) => {
    const spans = a.spans.map((x) => ({ itemId: x.itemId, sentence: x.sentence, delivered: delivered.includes(norm(x.window)) }));
    const state: CoverageState = !a.sourceAvailable ? 'SOURCE_NOT_AVAILABLE' : a.verdict === 'NONE' ? 'NOT_FOUND_IN_SOURCE' : spans.some((x) => x.delivered) ? 'FOUND_AND_DELIVERED' : 'FOUND_NOT_DELIVERED';
    return { cqId: a.cqId, state, verdict: a.verdict, spans };
  });
}

/** 렌더가 먼저 넣을 범위 — 답이 정해진 질문(YES/NO)의 공식 문장, 질문마다 앞의 두 개. 답이 갈리면(CONFLICT) 양쪽을 하나씩 */
export function reservationsFor(answers: OfficialAnswer[]): Array<{ id: string; range: [number, number]; reason: string }> {
  const out: Array<{ id: string; range: [number, number]; reason: string }> = [];
  for (const a of answers) {
    const pick = a.verdict === 'CONFLICT' ? [a.spans.find((x) => x.polarity === 'YES'), a.spans.find((x) => x.polarity === 'NO')] : a.spans.filter((x) => x.polarity === a.verdict).slice(0, 2);
    for (const x of pick) if (x) out.push({ id: x.itemId, range: x.range, reason: `core-answer:${a.cqId}` });
  }
  return out;
}

export type ClaimSupport = 'SUPPORTED' | 'UNSUPPORTED' | 'CONTRADICTED' | 'UNKNOWN';
export interface AnswerConflict { cqId: string; sentence: string; polarity: Polarity; official: AnswerVerdict; verdict: 'CONTRADICTED' | 'NEEDS_REVIEW'; officialSpan: string; via?: 'reason-of-previous' }
const REASON_TAIL = /(?:때문이거든요|때문입니다|때문이다|때문이죠|때문이에요|기\s*때문)[.!]?$/;
/** 이유 문장이 모순을 이어받는 조건 — "…에게만 허용된 예외" 처럼 **한정** 을 말할 때만. "중복 가입이 불가하다고 안내" 같은 다른 사실은 이어받지 않는다 */
const RESTRICT_CUE = /에게만|에만\s*(?:허용|가능)|에\s*한해|에게\s*한해|한정|만\s*허용|만\s*가능/;

/**
 * 글(패킷·초안·최종 HTML)의 문장 가운데 현재 공식 답과 **반대** 로 말하는 문장. 질문 문장·지난 회차 이야기는 제외한다.
 * 모순 문장 바로 뒤의 "…때문이거든요" 는 그 모순의 이유라 함께 모순으로 본다(값 하나 때문에 보호되지 않게).
 * 공식 답이 갈리면(CONFLICT) NEEDS_REVIEW 로만 남긴다 — 자동으로 뒤집지 않는다.
 */
export function findAnswerContradictions(textOrHtml: string, answers: OfficialAnswer[]): AnswerConflict[] {
  const out: AnswerConflict[] = [];
  const sentences = plain(textOrHtml).split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  for (const a of answers) {
    if (a.verdict === 'NONE') continue;
    const officialSpan = (a.spans.find((x) => x.polarity === a.verdict) || a.spans[0])?.sentence || '';
    let prevContradicted = false;
    for (const s of sentences) {
      if (/\?\s*$/.test(s)) { prevContradicted = false; continue; }
      const p = answerPolarity(s, a.cqId);
      const past = PAST_CONTEXT.test(s) && !NOW_CONTEXT.test(s);
      if (p && !past) {
        if (a.verdict === 'CONFLICT') { out.push({ cqId: a.cqId, sentence: s, polarity: p.polarity, official: a.verdict, verdict: 'NEEDS_REVIEW', officialSpan }); prevContradicted = false; continue; }
        if (p.polarity !== a.verdict) { out.push({ cqId: a.cqId, sentence: s, polarity: p.polarity, official: a.verdict, verdict: 'CONTRADICTED', officialSpan }); prevContradicted = true; continue; }
      } else if (!p && prevContradicted && REASON_TAIL.test(s) && RESTRICT_CUE.test(s)) {
        out.push({ cqId: a.cqId, sentence: s, polarity: a.verdict === 'YES' ? 'NO' : 'YES', official: a.verdict, verdict: 'CONTRADICTED', officialSpan, via: 'reason-of-previous' });
      }
      prevContradicted = false;
    }
  }
  return out;
}

/** 늦은 재작성 게이트용 — 문장 묶음(문단)마다 주장의 지원 상태. 현재 공식 답과 반대인 문장만 CONTRADICTED, 나머지는 UNKNOWN(값 보호는 그대로) */
export function claimSupportOf(answers: OfficialAnswer[]): (sentences: string[]) => ClaimSupport[] {
  return (sentences: string[]) => {
    const conflicts = findAnswerContradictions(sentences.join(' '), answers).filter((c) => c.verdict === 'CONTRADICTED').map((c) => norm(c.sentence));
    return sentences.map((s) => (conflicts.includes(norm(s)) ? 'CONTRADICTED' : 'UNKNOWN'));
  };
}

export interface TitleClaim { cqId: string; text: string; polarity: Polarity; support: 'SUPPORTED' | 'CONTRADICTED' | 'UNRESOLVED'; official: AnswerVerdict | 'SOURCE_NOT_AVAILABLE'; sourceIds: string[] }
/** 제목에서 결론 낱말만 중립어로 — "갈아타기 불가" → "갈아타기 조건". 주제 낱말·나머지 제목은 그대로 */
const TITLE_POLARITY = /(불가능|불가|가능|허용|금지|안\s*돼요?|안\s*됨|막힘|막혔다|종료|재개)/;
/**
 * TITLE 은 CORE ANSWER 보다 강한 결론을 낼 수 없다. 제목이 핵심 질문에 가능/불가로 답했는데
 *  · 현재 공식 답과 같으면 SUPPORTED(그대로),
 *  · 반대이거나(CONTRADICTED) 공식 답이 없거나 갈리면(UNRESOLVED) 결론 낱말을 "조건" 으로 바꾼다 — 자동으로 반대 결론을 쓰지 않는다.
 * 물음 꼴 제목("…가능할까?")은 결론이 아니라 건드리지 않는다.
 */
export function checkTitleEpistemics(title: string, answers: OfficialAnswer[]): { title: string; changed: boolean; claims: TitleClaim[] } {
  let out = String(title || '');
  const claims: TitleClaim[] = [];
  if (/\?\s*$|할까|나요|인가요/.test(out)) return { title: out, changed: false, claims };
  for (const a of answers) {
    const p = answerPolarity(out, a.cqId);
    if (!p) continue;
    const official: TitleClaim['official'] = a.sourceAvailable ? a.verdict : 'SOURCE_NOT_AVAILABLE';
    const support: TitleClaim['support'] = (a.verdict === 'YES' || a.verdict === 'NO') && a.sourceAvailable ? (a.verdict === p.polarity ? 'SUPPORTED' : 'CONTRADICTED') : 'UNRESOLVED';
    claims.push({ cqId: a.cqId, text: p.window, polarity: p.polarity, support, official, sourceIds: a.sourceIds });
    if (support === 'SUPPORTED') continue;
    const at = out.indexOf(p.window);
    const fixedWindow = p.window.replace(TITLE_POLARITY, '조건').replace(/조건\s*조건/g, '조건');
    if (at >= 0 && fixedWindow !== p.window) out = out.slice(0, at) + fixedWindow + out.slice(at + p.window.length);
  }
  return { title: out.replace(/\s{2,}/g, ' ').trim(), changed: out !== title, claims };
}
