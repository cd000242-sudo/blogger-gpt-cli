/**
 * 📚 EvidenceItem — 근거를 **글자 덩어리가 아니라 항목**으로 든다. (v3.8.734)
 *
 * ## 왜
 * 감사 실측(2026-09-22): 본문 프롬프트의 `[FACT EVIDENCE]` 10,548자 중 4,065자(39%)가 탁구·금 제련·부동산 기사였다.
 * 근거가 문자열이라 **어느 줄이 어디서 왔고 이 글과 상관이 있는지** 아무도 물을 수 없었다.
 * 날짜도 주소도 버려져서 1차 공고와 2차 공고를 모델이 구분할 방법이 없었다.
 *
 * 이제 근거 하나하나가 출처·날짜·검색어·관련도를 들고 다닌다. Writer 에게 줄 때도 떼지 않는다.
 *
 * ## 관련도는 두 겹이다
 *   A. mainKeyword 관련도 — 이 글의 주제와 상관이 있는가. **검색어가 아니라 메인 키워드**에 댄다.
 *      (검색어 "청년미래적금 2026년" 에 "2026년" 하나로 걸려 든 기사를 여기서 막는다.)
 *   B. promise 관련도 — 제목이 약속한 조각을 찾으러 간 검색이면, 그 조각과도 상관이 있는가.
 * 애매하면 버린다. **근거가 모자란 것이 틀린 근거를 주는 것보다 낫다.**
 */

import { isOfficialDestination, isUserGeneratedUrl } from '../../cta/host-trust';
import { toKstDate } from './kst-date';

export type EvidenceSourceType = 'official' | 'government' | 'public_agency' | 'news' | 'blog' | 'knowledge' | 'web';

export interface EvidenceItem {
  id: string;
  mainKeyword: string;
  title: string;
  sourceName: string;
  domain: string;
  url: string;
  /** 서울 기준 YYYY-MM-DD. 모르면 null — 절대 오늘로 메우지 않는다 */
  pubDate: string | null;
  retrievedAt: string;
  sourceType: EvidenceSourceType;
  isOfficial: boolean;
  /** 이 근거를 데려온 검색어 */
  query: string;
  relevanceScore: number;
  /** 약속 조각 검색이 아니면 null */
  promiseRelevanceScore: number | null;
  /** 본문을 실제로 긁었는가 (아니면 검색 요약뿐이다) */
  hasBody: boolean;
  cleanedText: string;
}

export interface RejectedEvidence {
  title: string;
  url: string;
  query: string;
  reason: string;
  relevanceScore: number;
  promiseRelevanceScore: number | null;
}

/** 어느 주제에나 나오는 말 — 이것만 겹치는 건 주제가 겹친 게 아니다 */
const GENERIC = new Set([
  '해외', '국내', '취소', '수수료', '면제', '환불', '신청', '접수', '조회', '발급', '납부', '가입', '등록', '문의', '상담',
  '안내', '정보', '혜택', '지원', '할인', '기준', '대상', '서류', '방법', '비용', '가격', '기간', '절차', '조건', '한도',
  '보장', '변경', '해지', '예약', '예매', '후기', '정리', '총정리', '비교', '추천', '금액', '요건', '가능', '필요', '관련',
  '경우', '이상', '이하', '확인', '일정', '시기', '이유', '차이', '소득', '중복', '언제', '어떻게', '얼마', '무엇', '여부',
  '최신', '올해', '내년', '작년', '이번', '발표', '공고', '모집', '시작', '종료', '마감', '연장', '인상', '인하', '돌파',
  '무료', '유료', '공식', '홈페이지', '사이트', '바로가기', '하는법', '하는', '방식', '내용', '사항', '주의', '꿀팁',
  '지점', '지역', '사유', '경로', '판단', '개시', '이전',
]);

/**
 * 검색 가능한 낱말로 — 2자 이상만.
 * ⚠️ **조사를 떼지 않는다.** 키워드는 대개 명사 나열이라 뗄 것이 없고, 떼면 "고속도로"→"고속도",
 *    "수도"→"수" 처럼 멀쩡한 낱말이 깨진다(실측). 조사는 제목 조각을 다루는 쪽(promiseTargets)에서만 조심해서 뗀다.
 */
export function tokensOf(text: string): string[] {
  const out: string[] = [];
  for (const raw of String(text || '').replace(/[^가-힣A-Za-z0-9%\-\s]/g, ' ').split(/\s+/)) {
    let w = raw.replace(/^-+|-+$/g, '').replace(/^(.{4,})(이란|란)$/, '$1');
    // 확실한 경우만: 숫자가 든 이름이나 5자 넘는 말 뒤의 주격·목적격 조사 ("햇살론15가" → "햇살론15")
    if (/\d/.test(w) || w.length >= 5) w = w.replace(/(?<=[가-힣0-9])(이|가|은|는|을|를)$/, (m, _p, offset) => (offset >= 3 ? '' : m));
    if (w.length >= 2 && !out.includes(w)) out.push(w);
  }
  return out;
}

const isYearToken = (w: string) => /^(19|20)\d{2}(년|년도)?$/.test(w);

/** 주제를 가리키는 낱말만 — 넓은 말·연도는 뺀다. 하나도 안 남으면 전체 낱말로 되돌린다 */
export function distinctiveTokens(text: string): string[] {
  const all = tokensOf(text);
  // 키워드가 문장 꼴일 때("…전세사기 걱정되면 볼 만할까") 서술어 조각은 주제어가 아니다
  const PREDICATE = /(하면|되면|으면|려면|라면|다면|할까|일까|인지|나요|까요|하는|되는|한다|된다|합니다|입니다|해요|돼요|볼까|만할까)$/;
  const picked = all.filter((w) => !GENERIC.has(w) && !isYearToken(w) && !PREDICATE.test(w));
  return picked.length > 0 ? picked : all.filter((w) => !isYearToken(w));
}

/** 메인 키워드의 핵심어(검색어에 반드시 붙일 말) — 긴 주제어부터 최대 2개, 원래 순서로 */
export function coreEntityOf(mainKeyword: string, max = 2): string {
  const d = distinctiveTokens(mainKeyword);
  // 숫자로 시작하는 말("100원", "7%")은 정체가 아니라 속성이다 — 이름이 되는 말을 먼저 고른다
  const rank = (w: string) => (/^\d/.test(w) ? 0 : 100) + w.length;
  const top = new Set([...d].sort((a, b) => rank(b) - rank(a)).slice(0, max));
  return d.filter((w) => top.has(w)).join(' ');
}

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let n = 0; let i = haystack.indexOf(needle);
  while (i >= 0) { n += 1; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/**
 * A. 메인 키워드 관련도 0~1.
 * 주제어가 제목·요약·본문에 실제로 얼마나 들어 있는가. 띄어쓰기 차이("청년 미래 적금")는 붙여서 한 번 더 본다.
 * 본문이 긴데 주제어가 **한 번 스치기만** 하면 절반으로 깎는다 — 다른 얘기 하다 이름만 언급한 글이다.
 */
export function scoreMainRelevance(input: { title?: string; text?: string }, mainKeyword: string): number {
  const topic = distinctiveTokens(mainKeyword);
  if (topic.length === 0) return 1;
  const title = String(input.title || '');
  const body = String(input.text || '');
  const hay = `${title}\n${body}`;
  const flat = hay.replace(/\s+/g, '');
  const hit = topic.filter((t) => hay.includes(t) || flat.includes(t));
  if (hit.length === 0) return 0;
  /**
   * 가장 긴(숫자로 시작하지 않는) 주제어가 글의 정체다 — 청년미래적금, 든든전세, 주택담보대출.
   *   · 정체가 있으면 최소 0.6 — 키워드가 길어 나머지 낱말을 다 못 맞춰도 같은 주제다(문장형 키워드).
   *   · 정체가 없으면: 주제어가 둘 이하인 짧은 키워드에서는 다른 글이다(상한 0.45).
   *     긴 키워드에서는 줄임말("주담대")일 수 있으니 나머지 주제어를 60% 넘게 맞춰야 통과한다.
   */
  const rank = (w: string) => (/^\d/.test(w) ? 0 : 100) + w.length;
  const head = [...topic].sort((a, b) => rank(b) - rank(a))[0]!;
  const hasHead = hay.includes(head) || flat.includes(head);
  let score = hit.length / topic.length;
  if (hasHead) score = Math.max(score, 0.6);
  else if (topic.length <= 2) score = Math.min(score, 0.45);
  else if (score < 0.6) score = Math.min(score, 0.45);
  const inTitle = topic.some((t) => title.includes(t) || title.replace(/\s+/g, '').includes(t));
  const mentions = hit.reduce((n, t) => n + occurrences(flat, t), 0);
  if (body.length > 400 && !inTitle && mentions < 2) score *= 0.5;
  return Math.round(score * 100) / 100;
}

/** B. 약속 조각 관련도. 조각에 키워드 밖의 주제어가 없으면 null(잴 것이 없다) */
export function scorePromiseRelevance(input: { title?: string; text?: string }, promise: string, mainKeyword: string): number | null {
  const main = new Set(tokensOf(mainKeyword));
  const mainFlat = String(mainKeyword || '').replace(/\s+/g, '');
  // 제목 조각은 문장이라 조사가 붙어 있다("동의가") — 확실한 조사만 뗀다
  const safe = (w: string) => { const c = w.replace(/(에서|으로|에게|부터|까지|은|는|이|가|을|를|의)$/, ''); return c.length >= 2 ? c : w; };
  const terms = [...new Set(tokensOf(promise).map(safe))]
    .filter((w) => !main.has(w) && !mainFlat.includes(w) && !GENERIC.has(w) && !isYearToken(w))
    .filter((w) => !/(하면|되면|히면|으면|려면|라면|다면|하나|할까|인지|나요|까요|어떻게|언제)$/.test(w));
  if (terms.length === 0) return null;
  const hay = `${input.title || ''}\n${input.text || ''}`;
  const flat = hay.replace(/\s+/g, '');
  const hit = terms.filter((t) => hay.includes(t) || flat.includes(t));
  return Math.round((hit.length / terms.length) * 100) / 100;
}

/** 통과 문턱 — 애매하면 버린다 */
export const MAIN_RELEVANCE_MIN = 0.5;
export const PROMISE_RELEVANCE_MIN = 0.34;

export function domainOf(url: string): string {
  try { return new URL(String(url)).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export function classifySource(url: string, tag: string): { sourceType: EvidenceSourceType; isOfficial: boolean } {
  const host = domainOf(url);
  const t = String(tag || '');
  if (/\.go\.kr$|(^|\.)korea\.kr$|\.gov$/.test(host)) return { sourceType: 'government', isOfficial: true };
  if (/\.or\.kr$|\.re\.kr$|\.ac\.kr$/.test(host) && isOfficialDestination(url)) return { sourceType: 'public_agency', isOfficial: true };
  if (isOfficialDestination(url) || /공식|기관/.test(t)) return { sourceType: 'official', isOfficial: true };
  if (/뉴스|news/i.test(t)) return { sourceType: 'news', isOfficial: false };
  if (/지식|kin/i.test(t)) return { sourceType: 'knowledge', isOfficial: false };
  if (/블로그|blog/i.test(t) || isUserGeneratedUrl(url)) return { sourceType: 'blog', isOfficial: false };
  return { sourceType: 'web', isOfficial: false };
}

const TYPE_LABEL: Record<EvidenceSourceType, string> = {
  government: '정부', public_agency: '공공기관', official: '공식', news: '뉴스', web: '웹', blog: '블로그', knowledge: '지식iN',
};
const TYPE_WEIGHT: Record<EvidenceSourceType, number> = {
  government: 1, public_agency: 0.95, official: 0.9, news: 0.75, web: 0.55, blog: 0.4, knowledge: 0.25,
};

export interface EvidenceDraft {
  title: string; url: string; tag: string; query: string; text: string;
  pubDate?: unknown; hasBody?: boolean; promise?: string;
  /** 검색 요약(description). 본문을 긁어 text 가 본문으로 바뀌어도 관련도는 요약까지 함께 본다 */
  snippet?: string;
}

/**
 * 후보 하나를 판정한다. 통과하면 item, 아니면 rejected.
 * `promise` 가 있으면 약속 검색으로 온 것이라 B 관련도까지 본다.
 */
export function judgeEvidence(draft: EvidenceDraft, mainKeyword: string): { item?: Omit<EvidenceItem, 'id'>; rejected?: RejectedEvidence } {
  const text = String(draft.text || '').trim();
  /**
   * 본문을 확인했으면 **본문으로만** 판정한다. 검색 요약은 본문이 없을 때만 증거다.
   * 실측(주택담보대출 금리 7% 돌파): 네이버 뉴스 검색은 기사 옆 "관련 기사 목록"의 낱말에도 걸린다.
   * 요약에는 키워드가 다 들어 있는데(관련도 1.0) 본문은 「베선트 美재무 "AI 사고 책임은…"」 이었다 — 요약을 믿으면 이런 글이 통과한다.
   */
  const judged = draft.hasBody ? text : [draft.snippet, text].filter(Boolean).join('\n');
  const relevance = scoreMainRelevance({ title: draft.title, text: judged }, mainKeyword);
  const promiseRel = draft.promise ? scorePromiseRelevance({ title: draft.title, text: judged }, draft.promise, mainKeyword) : null;
  const reject = (reason: string) => ({
    rejected: { title: draft.title, url: draft.url, query: draft.query, reason, relevanceScore: relevance, promiseRelevanceScore: promiseRel },
  });
  if (`${draft.title} ${judged}`.trim().length < 8) return reject('내용 없음');
  if (relevance < MAIN_RELEVANCE_MIN) return reject(`메인 키워드 관련도 ${relevance} < ${MAIN_RELEVANCE_MIN}`);
  if (draft.promise && promiseRel !== null && promiseRel < PROMISE_RELEVANCE_MIN) return reject(`약속 조각 관련도 ${promiseRel} < ${PROMISE_RELEVANCE_MIN}`);
  const kind = classifySource(draft.url, draft.tag);
  const domain = domainOf(draft.url);
  return {
    item: {
      mainKeyword, title: draft.title, sourceName: domain || TYPE_LABEL[kind.sourceType], domain, url: draft.url,
      pubDate: toKstDate(draft.pubDate), retrievedAt: new Date().toISOString(),
      sourceType: kind.sourceType, isOfficial: kind.isOfficial, query: draft.query,
      relevanceScore: relevance, promiseRelevanceScore: promiseRel, hasBody: !!draft.hasBody, cleanedText: text,
    },
  };
}

/** 품질 점수 — 출처 종류 × 관련도 × 최신성 × 본문 유무. 개수가 아니라 이걸로 고른다 */
export function qualityOf(item: Omit<EvidenceItem, 'id'>, todayKst: string): number {
  let recency = 0.6;   // 날짜를 모르면 중간
  if (item.pubDate) {
    const days = (Date.parse(todayKst) - Date.parse(item.pubDate)) / 86400000;
    recency = days <= 30 ? 1 : days <= 120 ? 0.85 : days <= 365 ? 0.65 : 0.4;
  }
  const body = item.hasBody ? 1 : 0.7;
  return Math.round(TYPE_WEIGHT[item.sourceType] * (0.5 + 0.5 * item.relevanceScore) * recency * body * 1000) / 1000;
}

const canonical = (url: string) => String(url || '').replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
const titleKey = (t: string) => String(t || '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 28);

/**
 * 모은 근거를 하나의 장부로 — 중복(같은 주소·같은 제목의 전재 기사)을 걷고, 품질순으로 세우고, ID 를 붙인다.
 * 같은 기사면 본문이 있는 쪽·날짜가 있는 쪽을 남긴다.
 */
export function assembleEvidence(candidates: Array<Omit<EvidenceItem, 'id'>>, todayKst: string): EvidenceItem[] {
  const byKey = new Map<string, Omit<EvidenceItem, 'id'>>();
  for (const c of candidates) {
    const key = canonical(c.url) || titleKey(c.title);
    const tk = `t:${titleKey(c.title)}`;
    const prev = byKey.get(key) || byKey.get(tk);
    if (!prev) { byKey.set(key, c); if (titleKey(c.title).length >= 12) byKey.set(tk, c); continue; }
    const better = (Number(c.hasBody) - Number(prev.hasBody)) || (Number(!!c.pubDate) - Number(!!prev.pubDate)) || (c.cleanedText.length - prev.cleanedText.length);
    if (better > 0) { for (const [k, v] of byKey) if (v === prev) byKey.set(k, c); }
  }
  const unique = [...new Set(byKey.values())];
  return unique
    .map((it) => ({ it, q: qualityOf(it, todayKst) }))
    .sort((a, b) => b.q - a.q)
    .map(({ it }, i) => ({ ...it, id: `E${String(i + 1).padStart(2, '0')}` }));
}

/** Writer 에게 보이는 머리줄 — 날짜·도메인·주소를 **떼지 않는다** */
export function evidenceHeader(item: EvidenceItem): string {
  return `[${item.id}][${TYPE_LABEL[item.sourceType]}] ${item.title}\n`
    + `  · 출처: ${item.domain || '도메인 미상'} · 게시일: ${item.pubDate || '미상(null)'} · ${item.hasBody ? '본문 확인' : '검색 요약만'}\n`
    + `  · URL: ${item.url || '없음'}`;
}

/**
 * Writer 용 근거 글자. 품질순으로 예산(글자)을 나눠 준다 — "상위 N개"로 자르지 않는다.
 * 공식 자료는 **앞자리와 큰 몫**을 먼저 받는다(뉴스 뒤에서 잘려 나가지 않게).
 */
export function renderEvidence(items: EvidenceItem[], budgetChars = 12000): { text: string; used: EvidenceItem[] } {
  const ordered = [...items].sort((a, b) => (Number(b.isOfficial) - Number(a.isOfficial)) || 0);
  const used: EvidenceItem[] = [];
  const blocks: string[] = [];
  let left = budgetChars;
  for (const item of ordered) {
    const head = evidenceHeader(item);
    const share = item.isOfficial ? 2600 : item.sourceType === 'news' ? 1800 : item.sourceType === 'web' ? 1200 : 700;
    const room = Math.min(share, left - head.length - 2);
    if (room < 120) continue;
    const body = item.cleanedText.slice(0, room);
    blocks.push(`${head}\n${body}`);
    used.push(item);
    left -= head.length + body.length + 2;
    if (left < 300) break;
  }
  return { text: blocks.join('\n\n'), used };
}
