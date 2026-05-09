/**
 * 🛡️ v3.5.86: 이미지 엔진 성공률 실측 카운터
 *
 * 사용자 의도: "추측이 아니라 실제 측정 데이터로 튜닝하자"
 *
 * 동작:
 * - imageDispatcher.tryEngine 반환 시 자동 기록
 * - 엔진별 success/failure + 에러 카테고리별 카운트
 * - userData/engine-stats.json에 영구 저장 (롤링 30일)
 *
 * 조회: orchestration이나 디버그 패널에서 getStats() 호출
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

interface EngineDayStats {
  date: string;             // YYYY-MM-DD
  totals: Record<string, { success: number; fail: number; failByCategory: Record<string, number> }>;
}

let _statsCache: EngineDayStats | null = null;
let _writeQueued = false;

function getStatsPath(): string {
  try {
    const electron = require('electron');
    if (electron?.app?.getPath) {
      return path.join(electron.app.getPath('userData'), 'engine-stats.json');
    }
  } catch { /* non-electron */ }
  const dir = path.join(os.homedir(), '.blogger-gpt');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'engine-stats.json');
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadStats(): EngineDayStats {
  if (_statsCache && _statsCache.date === todayKey()) return _statsCache;
  try {
    const file = getStatsPath();
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
      // 날짜가 다르면 신규 — 기존은 history 배열로 보존(최대 30개)
      if (raw.current && raw.current.date === todayKey()) {
        _statsCache = raw.current;
        return _statsCache!;
      }
      // 새 날짜 — 어제 통계는 history로
      const history = Array.isArray(raw.history) ? raw.history : [];
      if (raw.current) history.push(raw.current);
      const trimmed = history.slice(-30);
      _statsCache = { date: todayKey(), totals: {} };
      writeStats(trimmed);
      return _statsCache;
    }
  } catch { /* ignore */ }
  _statsCache = { date: todayKey(), totals: {} };
  return _statsCache;
}

function writeStats(history?: EngineDayStats[]): void {
  if (!_statsCache) return;
  if (_writeQueued) return;
  _writeQueued = true;
  setTimeout(() => {
    _writeQueued = false;
    try {
      const file = getStatsPath();
      let raw: any = {};
      try { if (fs.existsSync(file)) raw = JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { /* ignore */ }
      raw.current = _statsCache;
      if (history) raw.history = history;
      else if (!Array.isArray(raw.history)) raw.history = [];
      fs.writeFileSync(file, JSON.stringify(raw, null, 2), 'utf-8');
    } catch { /* ignore — 통계 실패가 발행 흐름 막으면 안 됨 */ }
  }, 500); // 500ms debounce
}

/** 엔진 성공 기록 */
export function recordSuccess(engine: string): void {
  const stats = loadStats();
  if (!stats.totals[engine]) stats.totals[engine] = { success: 0, fail: 0, failByCategory: {} };
  stats.totals[engine]!.success++;
  writeStats();
}

/** 엔진 실패 기록 (category는 image-error-classifier의 카테고리) */
export function recordFailure(engine: string, category: string = 'unknown'): void {
  const stats = loadStats();
  if (!stats.totals[engine]) stats.totals[engine] = { success: 0, fail: 0, failByCategory: {} };
  stats.totals[engine]!.fail++;
  stats.totals[engine]!.failByCategory[category] = (stats.totals[engine]!.failByCategory[category] || 0) + 1;
  writeStats();
}

/** 오늘 통계 조회 (UI 대시보드/디버그 패널용) */
export function getStats(): EngineDayStats {
  return loadStats();
}

/** 엔진별 성공률 % 반환 */
export function getSuccessRate(engine: string): number | null {
  const stats = loadStats();
  const t = stats.totals[engine];
  if (!t || (t.success + t.fail) === 0) return null;
  return Math.round((t.success / (t.success + t.fail)) * 1000) / 10; // 소수 1자리
}

/** 일일 누적 요약 한 줄 (로그용) */
export function summaryLine(): string {
  const stats = loadStats();
  const parts: string[] = [];
  for (const [engine, t] of Object.entries(stats.totals)) {
    const total = t.success + t.fail;
    if (total === 0) continue;
    const rate = ((t.success / total) * 100).toFixed(0);
    parts.push(`${engine}: ${t.success}/${total} (${rate}%)`);
  }
  return parts.length > 0 ? parts.join(' · ') : '기록 없음';
}
