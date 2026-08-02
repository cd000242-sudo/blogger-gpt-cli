/**
 * 쿠팡 보강 결과 캐시 (v3.8.400)
 *
 * ## 왜 필요한가 — 실측(2026-08-01)
 * 짧은 시간에 상품 페이지를 15회 넘게 조회했더니 **창을 띄운 실제 Chrome 인데도 403** 이 났고
 * 그 뒤로 연속 실패했다. 쿠팡은 반복 조회를 막는다.
 *
 * 캐시가 있으면 같은 상품을 다시 긁지 않는다:
 *   · 같은 상품으로 여러 편 쓸 때
 *   · 발행이 실패해 다시 시도할 때
 *   · 예약 발행이 여러 번 도는 동안
 * 쿠팡을 두드리는 횟수 자체가 줄어 차단 위험이 낮아진다.
 *
 * ## 무엇을 캐시하나
 * 후기·스펙·옵션·배송조건만이다. **가격은 캐시하지 않는다** — 가격은 API 가 매번 준다.
 * (오래된 가격을 본문에 쓰면 독자를 속이게 된다.)
 */
import * as fs from 'fs';
import * as path from 'path';
import type { CoupangEnrichment } from './coupang-enrich';

export interface CacheEntry {
  savedAt: number;
  data: CoupangEnrichment;
}

/** 후기는 하루이틀 사이에 크게 안 변한다. 너무 길면 옛 정보가 남는다 */
export const DEFAULT_TTL_MS = 3 * 24 * 60 * 60 * 1000;   // 3일
const MAX_ENTRIES = 200;
const FILE_NAME = 'coupang-enrich-cache.json';

/** 남은 수명이 있는가 — 파일 접근 없이 판단할 수 있게 분리해 둔다 */
export function isFresh(entry: CacheEntry | undefined, now: number, ttlMs = DEFAULT_TTL_MS): boolean {
  if (!entry || typeof entry.savedAt !== 'number') return false;
  const age = now - entry.savedAt;
  return age >= 0 && age < ttlMs;
}

/** 오래된 것부터 버려 개수를 유지한다 (파일이 무한정 커지면 안 된다) */
export function pruneEntries(
  store: Record<string, CacheEntry>,
  now: number,
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = MAX_ENTRIES,
): Record<string, CacheEntry> {
  const alive = Object.entries(store).filter(([, v]) => isFresh(v, now, ttlMs));
  alive.sort((a, b) => b[1].savedAt - a[1].savedAt);
  return Object.fromEntries(alive.slice(0, maxEntries));
}

function filePath(dir: string): string {
  return path.join(dir, FILE_NAME);
}

function readStore(dir: string): Record<string, CacheEntry> {
  try {
    const p = filePath(dir);
    if (!fs.existsSync(p)) return {};
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    // 깨진 캐시가 발행을 막으면 안 된다 — 없는 셈 친다
    return {};
  }
}

function writeStore(dir: string, store: Record<string, CacheEntry>): void {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = `${filePath(dir)}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf8');
    fs.renameSync(tmp, filePath(dir));   // 쓰다 죽어도 기존 파일이 깨지지 않게
  } catch {
    /* 캐시 저장 실패는 무시한다 — 다음 번에 다시 긁으면 그만이다 */
  }
}

export function getCached(
  dir: string,
  productId: string,
  now = Date.now(),
  ttlMs = DEFAULT_TTL_MS,
): CoupangEnrichment | null {
  const entry = readStore(dir)[String(productId)];
  return isFresh(entry, now, ttlMs) ? entry!.data : null;
}

export function putCached(
  dir: string,
  productId: string,
  data: CoupangEnrichment,
  now = Date.now(),
): void {
  const store = readStore(dir);
  store[String(productId)] = { savedAt: now, data };
  writeStore(dir, pruneEntries(store, now));
}
