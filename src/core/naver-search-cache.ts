/**
 * 🗃️ 네이버 검색 성공 결과 캐시 (748 Search Pipeline)
 *
 * ## 왜
 * 같은 키워드를 하루에 3번 만들면 같은 검색을 3번 한다. 748c 실측: 최신순 블로그 보강 호출이 429 를 맞아
 * 0건으로 조용히 넘어갔고, 핵심 출처(12,800 객실·3~6개월)가 그 실행에서만 사라졌다.
 * 검색 호출을 **줄이면** 한도도 덜 맞고 같은 날 같은 검색어의 SOURCE_SET 이 흔들리지 않는다.
 *
 * ## 규칙
 *   · 키 = provider(mode) · type · query · sort · display · start · KST 날짜 버킷. 날이 바뀌면 다른 키다.
 *   · **성공(ok:true)만 저장한다** — 진짜 0건(EMPTY_VALID)은 저장하지만 429·타임아웃·오류의 [] 는 절대 저장하지 않는다.
 *   · 호출부가 `cache: true` 로 켠 호출만 본다(실시간 트렌드 같은 곳은 그대로 매번 나간다).
 *   · 파일은 app 데이터 폴더의 naver-search-cache.json 하나. 오늘 버킷이 아닌 항목은 읽을 때 버린다. 최대 400건.
 */
import * as fs from 'fs';
import * as path from 'path';
import { kstToday } from './final/kst-date';

export interface CacheEntry { items: any[]; total: number; mode: string; at: number; bucket: string }

const MAX_ENTRIES = 400;
let memory: Map<string, CacheEntry> | null = null;
let loadedFrom = '';

function cachePath(): string {
  const override = process.env['NAVER_SEARCH_CACHE_PATH'];
  if (override) return override;
  const base = process.env['APPDATA'] || process.env['LOCALAPPDATA'] || process.env['HOME'] || process.cwd();
  return path.join(base, 'blogger-gpt-cli', 'naver-search-cache.json');
}

export function cacheEnabled(): boolean {
  return process.env['NAVER_SEARCH_CACHE'] !== '0';
}

export function cacheKey(mode: string, type: string, params: Record<string, any>, bucket: string = kstToday()): string {
  const q = String(params?.['query'] || '').replace(/\s+/g, ' ').trim();
  return [mode, type, q, String(params?.['sort'] || 'sim'), String(params?.['display'] ?? ''), String(params?.['start'] ?? ''), bucket].join('|');
}

function load(): Map<string, CacheEntry> {
  const file = cachePath();
  if (memory && loadedFrom === file) return memory;
  memory = new Map(); loadedFrom = file;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const today = kstToday();
    for (const [k, v] of Object.entries<any>(raw && typeof raw === 'object' ? raw : {})) {
      if (v && v.bucket === today && Array.isArray(v.items)) memory.set(k, v as CacheEntry);
    }
  } catch { /* 없거나 깨졌으면 빈 캐시 — 캐시는 있으면 좋은 것이지 조건이 아니다 */ }
  return memory;
}

function persist(map: Map<string, CacheEntry>): void {
  try {
    const file = cachePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const entries = [...map.entries()].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    fs.writeFileSync(file, JSON.stringify(Object.fromEntries(entries)), 'utf8');
  } catch { /* 저장 실패는 검색을 막지 않는다 */ }
}

export function readCache(key: string): CacheEntry | null {
  if (!cacheEnabled()) return null;
  const hit = load().get(key);
  return hit ? { ...hit, items: [...hit.items] } : null;
}

/** 성공 결과만. ok 가 아니면 호출부가 부르지 말아야 하지만, 여기서도 한 번 더 막는다 */
export function writeCache(key: string, result: { ok: boolean; items: any[]; total: number; mode: string }): boolean {
  if (!cacheEnabled() || !result || result.ok !== true || !Array.isArray(result.items)) return false;
  const map = load();
  map.set(key, { items: result.items, total: Number(result.total) || 0, mode: String(result.mode || ''), at: Date.now(), bucket: kstToday() });
  persist(map);
  return true;
}

/** 테스트·진단용 */
export function resetNaverSearchCache(): void { memory = null; loadedFrom = ''; }
export function cacheSize(): number { return load().size; }
