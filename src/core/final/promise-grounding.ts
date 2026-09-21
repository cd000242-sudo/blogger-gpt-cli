/**
 * 🎯 제목 약속 조각의 근거 (v3.8.656 → v3.8.665 에서 공용 모듈로 → v3.8.734 검색어 재설계)
 *
 * 제목이 약속한 조각("내 종목이 코넥스 이전 대상인지")마다 따로 검색해 근거를 보탠다. 무료, LLM 호출 0.
 * orchestration(API 경로)과 main.ts(에이전트 경로)가 **같은 함수**를 쓴다 — 두 벌로 두면 한쪽만 고쳐진다.
 *
 * ## v3.8.734 — 검색어에서 키워드가 빠지던 사고
 * `promiseQuery` 는 "키워드에 이미 있는 낱말은 뺀다"는 규칙이라, 조각에서 키워드를 빼고 남은 말만 검색했다.
 * 실측(2026-09-22): 제목 「2026년 청년미래적금 2차 신청, 가구원 동의가 막히면…」 → 검색어 **"2026년"**, **"가구원 막히면 어떻게"**.
 * 결과로 탁구 대표팀·아프리카 금 제련소·해운대 아파트 기사가 `[FACT EVIDENCE]` 맨 앞 4,065자(근거의 39%)를 차지했다.
 * 발행 장부의 실제 제목으로 재 보니 약속 조각 10개 중 7개가 이랬다 — 제목 규칙이 "연도를 맨 앞에"를 강제하기 때문이다.
 *
 * 이제 모든 약속 검색은 **메인 키워드 핵심어 + 조각이 확인하려는 대상** 꼴이다.
 * 그리고 결과는 검색어가 아니라 **메인 키워드에** 관련도를 댄다(`fetchGrounding` 의 mainKeyword).
 */

import { titlePromises, promiseQuery } from './reader-retention';
import type { GroundingResult, NaverSearchFn } from './naver-grounding';
import { deriveSourceScope, type SourceScope } from './source-scope';
import { coreEntityOf, tokensOf, type EvidenceItem, type RejectedEvidence } from './evidence';

export type FetchGroundingFn = (
  query: string,
  naverSearch: NaverSearchFn,
  options: { display?: number; sourceScope?: SourceScope; mainKeyword?: string; promise?: string },
) => Promise<GroundingResult>;

export interface PromiseGroundingChunk {
  chunk: string;
  /** 실제로 쓴 검색어 */
  query: string;
  newsCount: number;
  officialCount: number;
  webCount: number;
  /** v3.8.734: 관련도 미달로 버린 수 */
  rejectedCount?: number;
}

export interface PromiseGroundingResult {
  /** 근거 장부 앞에 둘 블록들 — "[제목 약속 근거: …]\n본문" */
  blocks: string[];
  chunks: PromiseGroundingChunk[];
  /** v3.8.734: 통과한 근거 항목 / 버린 것 */
  items: Array<Omit<EvidenceItem, 'id'>>;
  rejected: RejectedEvidence[];
}

/** 키워드와 겹치지 않는 약속 조각 — 키워드 검색이 이미 찾은 것은 다시 찾지 않는다 */
export function promiseChunks(title: string, keyword: string, max = 2): string[] {
  const kwNorm = String(keyword || '').replace(/\s+/g, '');
  return titlePromises(String(title || ''))
    .filter((p) => p.replace(/\s+/g, '') !== kwNorm && !kwNorm.includes(p.replace(/\s+/g, '')))
    .slice(0, max);
}

/**
 * 혼자서는 검색어가 못 되는 말. 이것만 남으면 아무 기사나 잡힌다.
 * (연도·금액·신청·조건·중복 가능한가요·언제·어떻게·왜·차이·소득·대상 …)
 */
const ALONE_USELESS = new Set([
  '연도', '금액', '신청', '조건', '중복', '가능', '가능한가요', '언제', '어떻게', '왜', '차이', '소득', '대상', '기간',
  '방법', '기준', '여부', '확인', '얼마', '무엇', '정리', '이유', '경우', '내용', '일정', '자격', '서류', '절차', '비용',
]);

/** 물음·서술 꼬리 — 검색어에 넣으면 질문 글만 잡힌다. 확인 대상(명사)만 남긴다 */
const QUESTION_WORDS = /^(어떻게|어떡|언제|왜|무엇|뭐|뭘|얼마|어디|누가|하나|하나요|할까|할까요|되나|되나요|될까|될까요|인가|인가요|일까|일까요|있나|있나요|없나|없나요|가능한가요|가능할까|하면|이면|막히면|안되면|안\s*되면|된다면|한다면|놓쳤다면|하려면|받으려면|해야|알아야|이라면|라면)$/;
const PREDICATE_TAIL = /(하는|되는|가는|오는|리는|이는|하면|되면|히면|으면|려면|라면|다면|니까|지만|는데|해서|하고|하며|한다|된다|입니다|합니다|됩니다|인지|일까|할까|하나|까요|나요|세요)$/;
/**
 * 조사는 **확실한 것만** 뗀다. `로·도·에·와·과·만` 은 떼지 않는다 — "고속도로·수도·노도" 같은 명사 꼬리와 구별이 안 된다.
 * 한 글자 조사는 떼고 나서도 2자 이상 남을 때만.
 */
const PARTICLE = /(에서|으로|에게|부터|까지|보다|처럼|이나|라도|이냐|냐|은|는|이|가|을|를|의)$/;
const isYear = (w: string) => /^(19|20)\d{2}(년|년도)?$/.test(w);

/**
 * 조각이 **무엇을 확인하려는가** — 물음말·서술어를 걷고 명사만 남긴다.
 * "가구원 동의가 막히면 어떻게 하나" → ["가구원", "동의"]
 * "2026년 청년미래적금 2차 신청 소득 기준" (키워드 제외) → ["2026년", "소득", "기준"]
 */
export function promiseTargets(chunk: string, keyword: string): string[] {
  const kw = new Set(tokensOf(keyword));
  const kwFlat = String(keyword || '').replace(/\s+/g, '');
  const out: string[] = [];
  for (const raw of String(chunk || '').replace(/[^가-힣A-Za-z0-9%\s]/g, ' ').split(/\s+/)) {
    if (!raw || QUESTION_WORDS.test(raw)) continue;
    if (/^(가도|해도|돼도|와도|봐도|따로|따로다)$/.test(raw)) continue;
    if (PREDICATE_TAIL.test(raw) && raw.length <= 6) continue;
    let cut = raw.replace(PARTICLE, '');
    // "복합지원센터로" 의 "로" — 긴 말 뒤에서만, "…도로"(고속도로·자전거도로)는 건드리지 않는다
    if (cut === raw && raw.length >= 6) cut = raw.replace(/(?<!도)(으로|로)$/, '');
    const w = cut.length >= 2 ? cut : raw;
    if (w.length < 2 || QUESTION_WORDS.test(w)) continue;
    if (kw.has(w) || kwFlat.includes(w)) continue;      // 키워드에 이미 있는 말 — 핵심어로 따로 붙는다
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/**
 * 약속 조각 → 검색어. **반드시 메인 키워드 핵심어로 시작한다.**
 *   "2026년 …"                         → "청년미래적금 2차 2026년"
 *   "가구원 동의가 막히면 어떻게 하나"  → "청년미래적금 2차 가구원 동의"
 *   "중복 가능한가요"                   → "창원 청년 학자금 중복"   (혼자서는 못 나가는 말도 핵심어와 함께면 된다)
 * 확인 대상이 하나도 안 남으면 빈 문자열 — 메인 검색이 이미 찾은 것을 또 찾지 않는다.
 */
export function buildPromiseSearchQuery(chunk: string, keyword: string): string {
  const core = coreEntityOf(keyword, 2);
  if (!core) return '';
  const targets = promiseTargets(chunk, keyword);
  if (targets.length === 0) return '';
  // 주제를 가리키는 말을 앞에, 혼자 못 서는 말·연도는 뒤에 — 최대 3개
  const strong = targets.filter((w) => !ALONE_USELESS.has(w) && !isYear(w));
  const weak = targets.filter((w) => ALONE_USELESS.has(w) || isYear(w));
  const picked = [...strong.sort((a, b) => b.length - a.length).slice(0, 2), ...weak].slice(0, 3);
  const ordered = targets.filter((w) => picked.includes(w));
  const date = String(chunk || '').match(/(?<!\d)(\d{1,2})[·・.](\d{1,2})(?!\d)/);
  return [core, ...ordered, date ? `${date[1]}월 ${date[2]}일` : ''].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** 검색어에 메인 키워드 핵심어가 들어 있는가 — 회귀 테스트·로그가 이걸로 잰다 */
export function queryHasCore(query: string, keyword: string): boolean {
  const flat = String(query || '').replace(/\s+/g, '');
  return coreEntityOf(keyword, 2).split(/\s+/).filter(Boolean).some((w) => flat.includes(w));
}

export async function fetchPromiseGrounding(
  title: string,
  keyword: string,
  naverSearch: NaverSearchFn,
  fetchGrounding: FetchGroundingFn,
  opts: { maxChunks?: number; charsPerChunk?: number; display?: number; sourceScope?: SourceScope } = {},
): Promise<PromiseGroundingResult> {
  const charsPerChunk = opts.charsPerChunk ?? 2000;
  const display = opts.display ?? 5;
  const blocks: string[] = [];
  const chunks: PromiseGroundingChunk[] = [];
  const items: Array<Omit<EvidenceItem, 'id'>> = [];
  const rejected: RejectedEvidence[] = [];
  const sourceScope = opts.sourceScope || deriveSourceScope(`${keyword} ${title}`);
  const seenQueries = new Set<string>();

  for (const chunk of promiseChunks(title, keyword, opts.maxChunks ?? 2)) {
    const query = buildPromiseSearchQuery(chunk, keyword);
    // 확인 대상이 없거나 같은 검색을 되풀이하게 되면 건너뛴다 — 메인 검색과 같은 결과를 또 싣지 않는다
    if (!query || seenQueries.has(query)) continue;
    seenQueries.add(query);
    const searchOptions = { display, mainKeyword: keyword, promise: chunk, ...(sourceScope ? { sourceScope } : {}) };
    const pg = await fetchGrounding(query, naverSearch, searchOptions);
    items.push(...(pg.items || []));
    rejected.push(...(pg.rejected || []));
    chunks.push({
      chunk, query, newsCount: pg.newsCount, officialCount: pg.officialCount, webCount: pg.webCount,
      rejectedCount: (pg.rejected || []).length,
    });
    if (!pg.text) continue;
    blocks.push(`[제목 약속 근거: ${chunk}]\n${pg.text.slice(0, charsPerChunk)}`);
  }
  return { blocks, chunks, items, rejected };
}

// promiseQuery 는 소제목·검사 쪽에서 계속 쓴다 — 여기서는 더 이상 검색어로 쓰지 않는다
export { promiseQuery };
