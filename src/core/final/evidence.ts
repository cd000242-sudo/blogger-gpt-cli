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
  /** v3.8.754 — cleanedText 가 보존 상한에서 잘렸으면 그 위치. null = 완전(또는 스니펫). 잘린 자료를 완전한 원문으로 표시하지 않기 위한 표시 */
  truncatedAt?: number | null;
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
  /** v3.8.754 — text 가 보존 상한(RETAINED_TEXT_CHARS)에서 잘렸으면 그 위치. null = 안 잘림, 없음 = 모름(스니펫 등) */
  truncatedAt?: number | null;
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
      truncatedAt: draft.truncatedAt ?? null,
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

/** 추적용 파라미터 — 문서를 가리키지 않는다. 그 밖의 쿼리(newsId·idxno·docId …)는 **문서 식별자**라 지우지 않는다 */
const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|igshid|ref|source|campaign|from|share|_ga|mc_cid|mc_eid)$/i;

/**
 * v3.8.753 — 같은 문서를 가리키는 주소끼리만 합친다.
 * 예전엔 `?` 뒤를 통째로 지워 `policyNewsView.do?newsId=A` 와 `?newsId=B` 가 한 문서가 됐다(실제 run 의 korea.kr·kbanker 가 그런 꼴이다).
 * 이제 추적 파라미터만 걷고 나머지 쿼리는 정렬해 남긴다. www/m 접두·fragment·꼬리 슬래시는 예전처럼 같은 문서로 본다.
 */
export function canonicalUrl(url: string): string {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING_PARAM.test(k)).sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';
    return `${host}${u.pathname.replace(/\/$/, '')}${query}`.toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\/(www\.|m\.)?/i, '').replace(/#.*$/, '').replace(/\/$/, '').toLowerCase();
  }
}
const titleKey = (t: string) => String(t || '').replace(/[^가-힣A-Za-z0-9]/g, '').slice(0, 28);

/**
 * 모은 근거를 하나의 장부로 — 중복(같은 주소·같은 제목의 전재 기사)을 걷고, 품질순으로 세우고, ID 를 붙인다.
 * 같은 기사면 본문이 있는 쪽·날짜가 있는 쪽을 남긴다.
 *
 * v3.8.753 — `registry`(문서 키 → id)를 주면 **같은 문서는 실행 내내 같은 id** 를 갖는다.
 * 실제 run(1b7d92): 1단계 E11(금융위 87370) 을 인용한 패킷 문장이 2단계 재정렬 뒤 E11=asiatime 기사로 바뀐 채 Writer 까지 갔다.
 * id 는 순번이 아니라 문서 이름표다 — 정렬은 품질순이어도 이름표는 옮기지 않는다. 등록부를 안 주면 예전처럼 순번을 매긴다.
 */
export function assembleEvidence(candidates: Array<Omit<EvidenceItem, 'id'>>, todayKst: string, registry?: Map<string, string>): EvidenceItem[] {
  const byKey = new Map<string, Omit<EvidenceItem, 'id'>>();
  const groupKey = new Map<Omit<EvidenceItem, 'id'>, string>();
  for (const c of candidates) {
    const key = canonicalUrl(c.url) || titleKey(c.title);
    const tk = `t:${titleKey(c.title)}`;
    const prev = byKey.get(key) || byKey.get(tk);
    if (!prev) { byKey.set(key, c); groupKey.set(c, key); if (titleKey(c.title).length >= 12) byKey.set(tk, c); continue; }
    const better = (Number(c.hasBody) - Number(prev.hasBody)) || (Number(!!c.pubDate) - Number(!!prev.pubDate)) || (c.cleanedText.length - prev.cleanedText.length);
    if (better > 0) { for (const [k, v] of byKey) if (v === prev) byKey.set(k, c); groupKey.set(c, groupKey.get(prev) || key); }
  }
  const unique = [...new Set(byKey.values())];
  const sorted = unique
    .map((it) => ({ it, q: qualityOf(it, todayKst) }))
    .sort((a, b) => b.q - a.q)
    .map(({ it }) => it);
  if (!registry) return sorted.map((it, i) => ({ ...it, id: `E${String(i + 1).padStart(2, '0')}` }));
  const taken = new Set(registry.values());
  let next = 1;
  const allocate = (): string => {
    let id = `E${String(next).padStart(2, '0')}`;
    while (taken.has(id)) { next += 1; id = `E${String(next).padStart(2, '0')}`; }
    taken.add(id); next += 1;
    return id;
  };
  return sorted.map((it) => {
    const key = groupKey.get(it) || canonicalUrl(it.url) || titleKey(it.title);
    let id = registry.get(key);
    if (!id) { id = allocate(); registry.set(key, id); }
    return { ...it, id };
  });
}

/** Writer 에게 보이는 머리줄 — 날짜·도메인·주소를 **떼지 않는다** */
export function evidenceHeader(item: EvidenceItem): string {
  return `[${item.id}][${TYPE_LABEL[item.sourceType]}] ${item.title}\n`
    + `  · 출처: ${item.domain || '도메인 미상'} · 게시일: ${item.pubDate || '미상(null)'} · ${item.hasBody ? '본문 확인' : '검색 요약만'}\n`
    + `  · URL: ${item.url || '없음'}`;
}

/** 렌더가 어느 문서의 어느 구간을 전달했는가(원문 오프셋) — 캡처(run-trace)에 남긴다 */
export interface RenderSelection {
  id: string;
  delivered: boolean;
  chars: number;
  /** cleanedText 의 [start, end) — 붙이면 전달 본문과 같다 */
  ranges: Array<[number, number]>;
  reason?: string;
}

/** 조건·예외·절차를 말하는 낱말 — 이런 문장이 소개문보다 먼저 들어간다 */
const CONDITION_WORDS = /(이하|이상|초과|미만|제외|포함|유지|해지|중도|우대|일반형|우대형|자격|대상|요건|조건|기간|신청|심사|개설|기여금|비과세|한도|최대|최소|만기|납입|소득|매출|가구|구간|경우|불가|가능|필요|안내|기준|절차|서류|마감|접수)/g;
/** 예외·단서를 말하는 표현 — "다만·단·않으면·받지 못하지만" 은 조건의 반대편이라 소개문보다 값어치가 크다 */
const EXCEPTION_WORDS = /(다만|단,|단 |않으면|못하|받지|안 됩니다|불가|제외|예외|특별|경우에는|경우에만|이라면|라면)/g;
const VALUE_WORDS = /\d[\d,]*(?:\.\d+)?\s*(?:만\s*원|원|억|%|퍼센트|명|건|개월|년|월|일|세|회|천|만)/g;
const SHELL_LINE = /(구독|공감|댓글|공유하기|클릭|바로가기|기자\s*$|사진=|저작권|무단전재|더보기|이전글|다음글|카카오톡|페이스북|네이버 블로그$|블로그 홈|목록)/;

/** 문장 경계 — 소수점·날짜의 마침표는 끝이 아니다. 아주 긴 문장은 공백에서 자른다. 오프셋을 돌려준다 */
export function sentenceRanges(text: string, maxLen = 320): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = 0;
  const push = (s: number, e: number) => {
    while (s < e && /\s/.test(text[s]!)) s += 1;
    let end = e;
    while (end > s && /\s/.test(text[end - 1]!)) end -= 1;
    if (end - s < 2) return;
    if (end - s <= maxLen) { out.push([s, end]); return; }
    // 긴 덩어리(문장 부호 없는 블로그 글)는 공백에서 나눈다
    let cur = s;
    while (end - cur > maxLen) {
      let cut = text.lastIndexOf(' ', cur + maxLen);
      if (cut <= cur + 40) cut = cur + maxLen;
      out.push([cur, cut]);
      cur = cut;
      while (cur < end && /\s/.test(text[cur]!)) cur += 1;
    }
    if (end - cur >= 2) out.push([cur, end]);
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (ch === '\n') { push(start, i); start = i + 1; continue; }
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '。') continue;
    const prev = text[i - 1] || '';
    const next = text[i + 1] || '';
    if (ch === '.' && /\d/.test(prev) && /\d/.test(next)) continue;   // 4.35 · 2026.9.16
    if (next && !/[\s"'”’)\]]/.test(next)) continue;                    // 문장 안의 마침표(www.fsc, 1.039)
    push(start, i + 1);
    start = i + 1;
  }
  push(start, text.length);
  return out;
}

const normKey = (s: string) => s.replace(/[\s"'“”‘’.,!?·()[\]]/g, '').toLowerCase();

/**
 * Writer 용 근거 글자. 품질순으로 예산(글자)을 나눠 준다 — "상위 N개"로 자르지 않는다.
 * 공식 자료는 **앞자리와 큰 몫**을 먼저 받는다(뉴스 뒤에서 잘려 나가지 않게).
 *
 * v3.8.753 — 앞 N자를 자르지 않고 **조건·예외·수치를 말하는 문장**을 고른다.
 * 실측(run 1b7d92): 블로그 두 편의 700자 뒤에 무기여 구간·특별중도해지 시 혜택 유지·우대형 기준이 있었는데
 * 앞 700자(소개문)만 전달됐고, 2단계에서는 예산(11,000자)에 밀려 두 문서가 통째로 빠졌다.
 *   · 1차(보장): 문서마다 점수 높은 문장부터 작은 몫(공식 900 · 그 밖 360자)을 준다 — 넓게 덮는다
 *   · 2차(채움): 남은 예산을 점수순으로 돌아가며 준다 — 종류별 상한(공식 2600 · 뉴스 1800 · 웹 1200 · 블로그 700)은 그대로
 *   · 같은 말(정규화해 같은 문장)은 두 번 넣지 않는다. 자격 상한·혜택 제외 구간·특별 절차는 낱말이 비슷해도 다른 문장이라 따로 남는다
 *   · 발췌는 원문 문장 그대로다(오프셋을 selection 에 남긴다). 문장을 만들거나 요약하지 않는다
 * 예산(budgetChars)은 늘리지 않는다 — 같은 예산 안에서 보존율을 올리는 것이 목적이다.
 */
export function renderEvidence(items: EvidenceItem[], budgetChars = 12000): { text: string; used: EvidenceItem[]; selection: RenderSelection[] } {
  const ordered = [...items].sort((a, b) => (Number(b.isOfficial) - Number(a.isOfficial)) || 0);
  // 종류별 상한 — 블로그 700→900: 실측(run 1b7d92)에서 조건·예외 문장이 700자 밖에 있었다. 총예산은 그대로다
  const capOf = (item: EvidenceItem) => (item.isOfficial ? 2600 : item.sourceType === 'news' ? 1800 : item.sourceType === 'web' ? 1200 : item.sourceType === 'knowledge' ? 500 : 900);
  const seen = new Set<string>();

  type Cand = { range: [number, number]; text: string; score: number; key: string; values: string[] };
  /** 이미 전달된 값(수치·날짜) — 같은 날짜를 되풀이하는 문장보다 새 값을 말하는 문장이 먼저다 */
  const seenValues = new Set<string>();
  const valuesOf = (text: string) => (text.match(VALUE_WORDS) || []).map((v) => v.replace(/\s+/g, ''));
  const adjusted = (c: Cand): number => {
    if (c.values.length === 0) return c.score;
    const fresh = c.values.filter((v) => !seenValues.has(v)).length;
    if (fresh === 0) return c.score * 0.7;                      // 값은 있는데 전부 이미 전달된 값 — 되풀이
    return c.score + 1.5 * Math.min(2, fresh);                  // 새 값 하나당 +1.5 (최대 +3)
  };
  const state = ordered.map((item) => {
    const topic = distinctiveTokens(item.mainKeyword || '');
    const ranges = sentenceRanges(item.cleanedText);
    const cands: Cand[] = ranges.map(([s, e], i) => {
      const text = item.cleanedText.slice(s, e);
      let score = Math.min(4, (text.match(CONDITION_WORDS) || []).length) + 2 * Math.min(3, (text.match(VALUE_WORDS) || []).length)
        + 2 * Math.min(2, (text.match(EXCEPTION_WORDS) || []).length);
      if (topic.some((t) => text.includes(t))) score += 1;
      if (i === 0) score += 0.5;
      if (SHELL_LINE.test(text)) score -= 3;
      // 스펙 나열(✔·▪·: 가 줄줄이)은 기본 소개다 — 새 조건을 말하는 문장보다 뒤로
      if ((text.match(/[✔✓▪■◆▶·]|\s:\s/g) || []).length >= 4) score *= 0.6;
      // 밀도로 세운다 — 스펙을 줄줄이 늘어놓은 긴 문장 하나가 짧은 예외 문장 셋을 밀어내지 않게
      const cand: Cand = { range: [s, e], text, score: score / (1 + text.length / 200), key: normKey(text), values: valuesOf(text) };
      return cand;
    }).filter((c) => c.key.length >= 6);
    cands.sort((a, b) => b.score - a.score);
    return { item, head: evidenceHeader(item), cap: capOf(item), cands, picked: [] as Cand[], chars: 0, headerCharged: false, maxScore: cands[0]?.score ?? 0 };
  });

  let left = budgetChars;
  /** 정해진 후보 하나를 넣어 본다 — 문서 상한·전체 예산을 넘으면 넣지 않는다 */
  const tryPickCand = (st: typeof state[number], next: Cand): boolean => {
    const len = next.text.trim().length;
    if (st.chars + len > st.cap) { st.cands = st.cands.filter((c) => c !== next); return false; }
    const headCost = st.headerCharged ? 0 : st.head.length + 1 + (left === budgetChars ? 0 : 2);
    const joinCost = st.picked.length ? 5 : 0;
    const cost = headCost + joinCost + len;
    if (cost > left) return false;
    st.picked.push(next); seen.add(next.key); for (const v of next.values) seenValues.add(v);
    st.chars += len; st.headerCharged = true; left -= cost;
    return true;
  };
  /** 1차용 — 점수순 다음 후보를 몫까지 */
  const tryPick = (st: typeof state[number], quota: number): boolean => {
    if (st.chars >= Math.min(quota, st.cap)) return false;
    for (const next of st.cands) {
      if (st.picked.includes(next) || seen.has(next.key)) continue;
      if (tryPickCand(st, next)) return true;
      if (!st.cands.includes(next)) continue;   // 상한 때문에 뺀 후보 — 다음 후보로
      return false;                              // 예산 부족
    }
    return false;
  };

  // 1차 — 문서마다 핵심 문장 몫을 먼저 (공식은 큰 몫). 조건·수치가 한 줄도 없는 문서(검색 요약만 있는 것 등)는 2차로 미룬다 —
  //   머리줄(~150자)이 본문보다 긴 문서 14건이 예산을 먼저 먹으면 정작 조건을 말하는 문서가 밀린다(실측 run 1b7d92)
  for (const st of state) {
    // 검색 요약만 있는 문서(본문 없음)는 2차로 — 요약 한 줄에 머리줄 150자를 먼저 쓰면 본문 있는 문서의 조건 문장이 밀린다
    if (!st.item.isOfficial && (st.maxScore < 1.2 || !st.item.hasBody)) continue;
    const quota = st.item.isOfficial ? 900 : 300;
    while (tryPick(st, quota)) { /* 몫을 채운다 */ }
  }
  // 2차 — 남은 예산을 **문장 점수순**으로. 돌아가며 주면 검색 요약 한 줄짜리 문서의 머리줄이 조건 문장을 밀어낸다
  // 문서 안에서도 "아직 전달되지 않은 값" 을 말하는 문장을 먼저 — 후보 순서를 그때그때 다시 세운다
  const nextOf = (st: typeof state[number]) => {
    const open = st.cands.filter((c) => !st.picked.includes(c) && !seen.has(c.key));
    if (open.length === 0) return undefined;
    return open.reduce((best, c) => (adjusted(c) > adjusted(best) ? c : best), open[0]!);
  };
  for (;;) {
    if (left <= 150) break;
    const ranked = state
      .map((st) => ({ st, next: nextOf(st) }))
      .filter((x) => x.next && x.st.chars < x.st.cap)
      .sort((a, b) => adjusted(b.next!) - adjusted(a.next!));
    let picked = false;
    for (const { st, next } of ranked) { if (tryPickCand(st, next!)) { picked = true; break; } }
    if (!picked) break;
  }

  const used: EvidenceItem[] = [];
  const blocks: string[] = [];
  const selection: RenderSelection[] = [];
  for (const st of state) {
    if (st.picked.length === 0) {
      selection.push({ id: st.item.id, delivered: false, chars: 0, ranges: [], reason: st.cands.length === 0 ? 'no-usable-sentence' : 'budget' });
      continue;
    }
    const ranges = st.picked.map((c) => c.range).sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && /^\s*$/.test(st.item.cleanedText.slice(last[1], r[0]))) last[1] = r[1]; else merged.push([r[0], r[1]]);
    }
    const body = merged.map(([s, e]) => st.item.cleanedText.slice(s, e).trim()).join(' (…) ');
    blocks.push(`${st.head}\n${body}`);
    used.push(st.item);
    selection.push({ id: st.item.id, delivered: true, chars: body.length, ranges: merged });
  }
  let text = blocks.join('\n\n');
  // 안전망 — 결합 비용 추정이 어긋나 예산을 넘으면 마지막 블록부터 뺀다 (예산은 약속이다)
  while (text.length > budgetChars && blocks.length > 1) {
    blocks.pop(); const dropped = used.pop()!;
    const sel = selection.find((s) => s.id === dropped.id)!; sel.delivered = false; sel.chars = 0; sel.ranges = []; sel.reason = 'budget';
    text = blocks.join('\n\n');
  }
  return { text, used, selection };
}
