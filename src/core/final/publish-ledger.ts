/**
 * 📒 발행 장부 — 매 발행의 측정값을 남긴다 (v3.8.632)
 *
 * ## 왜 만들었나
 * 사장님: "어떤 키워드가 RPM이 높은지는 글을 써봐야할수있으니까"
 *
 * 맞는 말이라서 문제가 생긴다. RPM 은 애드센스가 나중에 주고(9/21 복구 예정),
 * 그때 받은 수치를 **어느 글의 것인지** 이어붙이려면 지금 기록이 있어야 한다.
 * 지금은 하네스 점수도, 자기중복도도 **로그로 흘려보내고 끝**이다 —
 * 17일 뒤에 "중복도가 어땠나" 물으면 답할 수 없다.
 *
 * ## 무엇을 남기나
 * 재고 나서 사라지는 것들을 붙잡는다:
 *   · 하네스 점수와 잡힌 결함 종류      → 품질이 오르고 있나
 *   · 자기중복 최대 유사도               → 하루 3편 → 10편 으로 올려도 되나
 *   · 발행 전 자가 수정이 몇 번 돌았나   → 첫 생성이 좋아지고 있나
 *   · 리포트 슬롯·등급                   → RPM 이 오면 줄기별로 묶기 위해
 *
 * ## 원칙
 * 기록 실패가 발행을 막지 않는다. 장부는 있으면 좋은 것이지 발행 조건이 아니다.
 * 한 편의 수치는 못 믿는다 — **여러 편을 모아 봐야** 뜻이 생긴다.
 * 그래서 이 파일은 판단하지 않고 쌓기만 한다.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LedgerEntry {
  /** 발행 시각 (ISO) */
  at: string;
  url: string;
  title: string;
  keyword: string;
  /** 하네스 점수 0~100 */
  auditScore?: number;
  /** 잡힌 결함 종류별 개수 */
  auditKinds?: Record<string, number>;
  /** 자기중복 최대 유사도 (0~1) */
  selfOverlapMax?: number;
  /** 임계값을 넘은 기존 글 수 */
  selfOverlapHits?: number;
  /** 발행 전 자가 수정이 다시 쓴 구간 수 */
  preflightRevised?: number;
  /** 그때 AI 를 몇 번 불렀나 */
  preflightCalls?: number;
  /** 리포트에서 온 것이면 슬롯·등급 */
  reportSlot?: string;
  reportGrade?: string;
  /** 이 글을 만드는 데 든 API 비용 (USD) — v3.8.650 */
  costUsd?: number;
  /** 나중에 애드센스에서 채운다 */
  rpm?: number;
  pageviews?: number;
}

/** 장부가 너무 커지지 않게 — 하루 10편이면 100일치 */
const MAX_ENTRIES = 1000;

/**
 * 장부 파일 위치 (v3.8.651).
 *
 * 예전에는 orchestration 안에만 있어서, 다른 파일이 장부를 건드리려면 같은 계산을
 * 한 벌 더 써야 했다 — 한쪽만 바뀌면 **서로 다른 파일**을 보게 된다.
 * 경로는 여기 한 곳에서만 정한다.
 */
export function defaultLedgerPath(): string {
  const injected = process.env['PUBLISH_LEDGER_PATH'];
  if (injected) return injected;
  const home = process.env['APPDATA'] || process.env['HOME'] || process.cwd();
  return path.join(home, 'blogger-gpt-cli', 'publish-ledger.json');
}

export function appendLedgerEntry(ledgerPath: string, entry: LedgerEntry): boolean {
  try {
    let entries: LedgerEntry[] = [];
    if (fs.existsSync(ledgerPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
        if (Array.isArray(parsed)) entries = parsed;
      } catch {
        // 깨진 장부는 버리고 새로 시작한다 — 기록 하나 때문에 발행을 막지 않는다
        entries = [];
      }
    }
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
    fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
    fs.writeFileSync(ledgerPath, JSON.stringify(entries, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 🔗 발행이 끝난 뒤 그 줄에 주소를 채운다 (v3.8.651).
 *
 * ## 왜 나중에 채우나
 * 장부는 **생성이 끝날 때** 쓰인다. 발행은 그 다음이라 그 시점엔 주소를 모른다.
 * 그래서 url 이 늘 비어 있었다.
 *
 * ## 왜 주소가 필요한가
 * 사장님: "생성된 글목록에 글 rpm 값도 보이게 가능하겠네?"
 * 애드센스는 **페이지 주소별**로 RPM 을 준다. 글목록은 이미 주소를 들고 있으니
 * RPM 표시 자체는 장부 없이도 된다 — 다만 **편당 비용**(costUsd)은 장부에 있다.
 * "250원 써서 얼마 벌었나" 를 보려면 둘을 이어야 하고, 그 열쇠가 주소다.
 * 제목으로 잇는 것도 되지만 제목은 나중에 고쳐진다(오늘 실제로 한 편 고쳤다).
 *
 * 가장 최근 줄부터 거슬러 보며 **주소가 아직 빈 줄** 중 제목이 맞는 것을 채운다.
 * 같은 제목으로 여러 번 발행했어도 방금 것이 잡힌다.
 */
export function attachUrlToLedger(ledgerPath: string, title: string, url: string): boolean {
  const cleanUrl = String(url || '').trim();
  const cleanTitle = String(title || '').trim();
  if (!cleanUrl || !cleanTitle) return false;

  try {
    const entries = readLedger(ledgerPath);
    if (entries.length === 0) return false;
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!;
      if (e.url) continue;                       // 이미 채워진 줄은 건너뛴다
      if (String(e.title || '').trim() !== cleanTitle) continue;
      e.url = cleanUrl;
      fs.writeFileSync(ledgerPath, JSON.stringify(entries, null, 2), 'utf-8');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function readLedger(ledgerPath: string): LedgerEntry[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface LedgerSummary {
  count: number;
  /** 하네스 점수 — 중간값을 쓴다. 한 편이 튀어도 안 흔들리게 */
  medianScore: number | null;
  /** 최근 10편의 중간값 — 좋아지고 있는지 본다 */
  recentMedianScore: number | null;
  /** 자기중복이 임계를 넘은 편수 */
  overlapFlagged: number;
  /** 가장 자주 잡힌 결함 */
  topIssues: { kind: string; count: number }[];
  /** 자가 수정이 돌아간 비율 — 낮아질수록 첫 생성이 좋아진 것이다 */
  revisedRate: number | null;
}

function median(nums: number[]): number | null {
  const xs = nums.filter((n) => typeof n === 'number' && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** 임계값 0.35 — self-overlap.ts 의 실측 분포에서 나온 값 (322편 51,681쌍) */
export const OVERLAP_THRESHOLD = 0.35;

export function summarizeLedger(entries: LedgerEntry[], recentN = 10): LedgerSummary {
  const scores = entries.map((e) => e.auditScore).filter((n): n is number => typeof n === 'number');
  const recent = entries.slice(-recentN).map((e) => e.auditScore).filter((n): n is number => typeof n === 'number');

  const tally = new Map<string, number>();
  for (const e of entries) {
    for (const [kind, n] of Object.entries(e.auditKinds || {})) {
      tally.set(kind, (tally.get(kind) || 0) + Number(n || 0));
    }
  }

  const revised = entries.filter((e) => typeof e.preflightRevised === 'number');
  return {
    count: entries.length,
    medianScore: median(scores),
    recentMedianScore: median(recent),
    overlapFlagged: entries.filter((e) => (e.selfOverlapMax || 0) > OVERLAP_THRESHOLD).length,
    topIssues: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([kind, count]) => ({ kind, count })),
    revisedRate: revised.length === 0 ? null : revised.filter((e) => (e.preflightRevised || 0) > 0).length / revised.length,
  };
}

/** 사람이 읽을 한 줄 */
export function describeLedger(summary: LedgerSummary): string {
  if (summary.count === 0) return '발행 장부가 비어 있습니다';
  const parts = [`${summary.count}편`];
  if (summary.medianScore !== null) parts.push(`품질 중간값 ${summary.medianScore}점`);
  if (summary.recentMedianScore !== null && summary.count > 10) parts.push(`최근 10편 ${summary.recentMedianScore}점`);
  if (summary.overlapFlagged > 0) parts.push(`중복 경고 ${summary.overlapFlagged}편`);
  if (summary.revisedRate !== null) parts.push(`자가수정 ${Math.round(summary.revisedRate * 100)}%`);
  return parts.join(' · ');
}
