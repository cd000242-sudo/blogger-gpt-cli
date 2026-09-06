/**
 * 🎯 제목 약속 조각의 근거 (v3.8.656 → v3.8.665 에서 공용 모듈로)
 *
 * 제목이 약속한 조각("내 종목이 코넥스 이전 대상인지")마다 따로 검색해 근거를 보탠다. 무료, LLM 호출 0.
 * v3.8.665: 조각을 통째로 검색하면 뉴스 0건이었다("9·4 서민금융 복합지원센터로 가도 보증심사는 따로다").
 * 긴 낱말 셋으로 먼저 찾고(`promiseQuery`), 그래도 뉴스·기관이 0건이면 예전 검색어(키워드+조각)로 한 번 더 찾는다.
 * orchestration(API 경로)과 main.ts(에이전트 경로)가 **같은 함수**를 쓴다 — 두 벌로 두면 한쪽만 고쳐진다.
 */

import { titlePromises, promiseQuery } from './reader-retention';
import type { GroundingResult, NaverSearchFn } from './naver-grounding';

export type FetchGroundingFn = (
  query: string,
  naverSearch: NaverSearchFn,
  options: { display?: number },
) => Promise<GroundingResult>;

export interface PromiseGroundingChunk {
  chunk: string;
  /** 실제로 쓴 검색어 */
  query: string;
  newsCount: number;
  officialCount: number;
  webCount: number;
}

export interface PromiseGroundingResult {
  /** 근거 장부 앞에 둘 블록들 — "[제목 약속 근거: …]\n본문" */
  blocks: string[];
  chunks: PromiseGroundingChunk[];
}

/** 키워드와 겹치지 않는 약속 조각 — 키워드 검색이 이미 찾은 것은 다시 찾지 않는다 */
export function promiseChunks(title: string, keyword: string, max = 2): string[] {
  const kwNorm = String(keyword || '').replace(/\s+/g, '');
  return titlePromises(String(title || ''))
    .filter((p) => p.replace(/\s+/g, '') !== kwNorm && !kwNorm.includes(p.replace(/\s+/g, '')))
    .slice(0, max);
}

export async function fetchPromiseGrounding(
  title: string,
  keyword: string,
  naverSearch: NaverSearchFn,
  fetchGrounding: FetchGroundingFn,
  opts: { maxChunks?: number; charsPerChunk?: number; display?: number } = {},
): Promise<PromiseGroundingResult> {
  const charsPerChunk = opts.charsPerChunk ?? 2000;
  const display = opts.display ?? 5;
  const kwNorm = String(keyword || '').replace(/\s+/g, '');
  const blocks: string[] = [];
  const chunks: PromiseGroundingChunk[] = [];

  for (const chunk of promiseChunks(title, keyword, opts.maxChunks ?? 2)) {
    const legacy = chunk.replace(/\s+/g, '').includes(kwNorm) ? chunk : `${keyword} ${chunk}`;
    const nouns = promiseQuery(chunk, keyword);
    let query = nouns || legacy;
    let pg = await fetchGrounding(query, naverSearch, { display });
    if (nouns && pg.newsCount + pg.officialCount === 0) {
      const again = await fetchGrounding(legacy, naverSearch, { display });
      if (again.text.length > pg.text.length) { pg = again; query = legacy; }
    }
    chunks.push({ chunk, query, newsCount: pg.newsCount, officialCount: pg.officialCount, webCount: pg.webCount });
    if (!pg.text) continue;
    blocks.push(`[제목 약속 근거: ${chunk}]\n${pg.text.slice(0, charsPerChunk)}`);
  }
  return { blocks, chunks };
}
