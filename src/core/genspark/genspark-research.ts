/**
 * 🔎 젠스파크 근거 모으기 (v3.8.760) — 실행 → 근거 후보 → 관련도 심사.
 * 일반 경로(orchestration)와 에이전트 경로(main.ts)가 **이 함수 하나**를 쓴다.
 * 어떤 실패도 던지지 않는다 — 젠스파크가 안 되면 빈 근거로 돌아가고 발행은 기존 네이버 경로로 이어진다.
 */
import { runGensparkDeepResearch, type GensparkRunResult } from './genspark-client';
import { gensparkDrafts } from './genspark-evidence';
import { judgeEvidence, type EvidenceItem, type RejectedEvidence } from '../final/evidence';

export type GensparkEvidenceItem = Omit<EvidenceItem, 'id'>;

export interface GensparkEvidenceResult {
  ok: boolean;
  projectId: string;
  elapsedMs: number;
  pages: number;
  items: GensparkEvidenceItem[];
  rejected: RejectedEvidence[];
  error?: string;
}

export async function collectGensparkEvidence(
  keyword: string,
  options: {
    onLog?: (message: string) => void;
    isCanceled?: () => boolean;
    timeoutMs?: number;
    /** 시험용 — 실제 젠스파크 대신 쓸 실행기 */
    run?: (keyword: string, opts: { onLog?: (m: string) => void; isCanceled?: () => boolean; timeoutMs?: number }) => Promise<GensparkRunResult>;
  } = {},
): Promise<GensparkEvidenceResult> {
  const run = options.run || runGensparkDeepResearch;
  let result: GensparkRunResult;
  try {
    result = await run(keyword, {
      ...(options.onLog ? { onLog: options.onLog } : {}),
      ...(options.isCanceled ? { isCanceled: options.isCanceled } : {}),
      timeoutMs: options.timeoutMs ?? 10 * 60_000,
    });
  } catch (error: any) {
    return { ok: false, projectId: '', elapsedMs: 0, pages: 0, items: [], rejected: [], error: String(error?.message || error).slice(0, 200) };
  }
  const items: GensparkEvidenceItem[] = [];
  const rejected: RejectedEvidence[] = [];
  for (const draft of result.research ? gensparkDrafts(result.research) : []) {
    const verdict = judgeEvidence(draft, keyword);
    if (verdict.item) items.push({ ...verdict.item, mainKeyword: keyword });
    else if (verdict.rejected) rejected.push(verdict.rejected);
  }
  return {
    ok: result.ok,
    projectId: result.projectId || '',
    elapsedMs: result.elapsedMs,
    pages: result.research?.pages.length || 0,
    items,
    rejected,
    ...(result.error ? { error: result.error } : {}),
  };
}

/** 진행 화면에 띄울 한 줄 */
export function describeGensparkEvidence(r: GensparkEvidenceResult): string {
  const sec = Math.round(r.elapsedMs / 1000);
  const official = r.items.filter((i) => i.isOfficial).length;
  const reason = String(r.error || '').replace(/^[A-Z_]+:\s*/, '');
  if (!r.pages) return `젠스파크 근거 없음 — ${reason || '읽은 페이지가 없습니다'} (네이버 검색으로 계속)`;
  const head = `젠스파크: 읽은 페이지 ${r.pages}곳 → 근거 ${r.items.length}건(공식 ${official}) · ${sec}초`;
  return r.ok ? head : `${head} — 끝까지 못 기다림(${reason || '중단'}), 읽은 만큼만 씀`;
}

/** 에이전트 지시서에 붙일 근거 묶음 — 공식 자료 먼저, 문서마다 주소 + 본문 발췌, 전체 상한 */
export function renderGensparkEvidenceBlock(items: GensparkEvidenceItem[], maxChars = 9000): string {
  if (!items.length) return '';
  const header = '[젠스파크 딥 리서치 근거 — 젠스파크가 실제로 읽은 페이지 원문 발췌. 수치·조건은 여기 적힌 것만 인용하고 출처 주소를 남길 것]';
  const ordered = [...items].sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.relevanceScore - a.relevanceScore);
  let out = header;
  for (const [index, item] of ordered.entries()) {
    const excerpt = item.cleanedText.slice(0, 1500).trim();
    const piece = `\n\n(${index + 1}) ${item.title} — ${item.domain}${item.pubDate ? ` · ${item.pubDate}` : ''}${item.isOfficial ? ' · 공식' : ''}\n${item.url}\n${excerpt}`;
    if (out.length + piece.length > maxChars) break;
    out += piece;
  }
  return out === header ? '' : out;
}
