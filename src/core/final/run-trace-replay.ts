/**
 * 🔁 run-trace-replay — run 폴더 하나를 읽어 사람이 읽는 시간선으로 편다 (v3.8.752). 네트워크·LLM 호출 0.
 *
 * manifest.json · events.jsonl · checks.jsonl · publish-attempts.jsonl 만 읽는다.
 * "이 문장이 언제 지워졌나" 를 답하려고 만들었다 — 감사 때 그 질문에 아무도 답할 수 없었다.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ReplayResult {
  dir: string;
  manifest: Record<string, unknown> | null;
  events: Array<Record<string, unknown>>;
  checks: Array<Record<string, unknown>>;
  attempts: Array<Record<string, unknown>>;
  text: string;
}

function readJsonl(file: string): Array<Record<string, unknown>> {
  try {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return { __broken: l.slice(0, 80) }; } });
  } catch {
    return [];
  }
}

function readManifest(dir: string): Record<string, unknown> | null {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); } catch { return null; }
}

const brief = (v: unknown, n = 90): string => String(v ?? '').replace(/\s+/g, ' ').slice(0, n);

function describeEvent(e: Record<string, unknown>): string {
  const head = `#${e['seq']} ${String(e['at'] || '').slice(11, 19)} [${e['kind']}] ${e['stage']}`;
  if (e['kind'] === 'change') {
    const removed = Array.isArray(e['removed']) ? (e['removed'] as string[]) : [];
    const added = Array.isArray(e['added']) ? (e['added'] as string[]) : [];
    const lines = [
      `${head} · ${e['fn'] || ''} · 사유: ${e['reason'] || '세부 사유 미제공'} · 판단 가능: ${e['judgeable'] ? '예' : '아니오'}`,
      ...(e['beforeChars'] !== undefined ? [`   글자 ${e['beforeChars']} → ${e['afterChars']} · 지운 문장 ${removed.length} · 들어온 문장 ${added.length}`] : []),
      ...removed.slice(0, 5).map((s) => `   − ${brief(s)}`),
      ...added.slice(0, 5).map((s) => `   + ${brief(s)}`),
    ];
    return lines.join('\n');
  }
  const rest = Object.entries(e).filter(([k]) => !['seq', 'at', 'kind', 'stage'].includes(k)).map(([k, v]) => `${k}=${brief(v, 60)}`).join(' · ');
  return `${head}${rest ? ` · ${rest}` : ''}`;
}

export function replayRun(dir: string): ReplayResult {
  const manifest = readManifest(dir);
  const events = readJsonl(path.join(dir, 'events.jsonl'));
  const checks = readJsonl(path.join(dir, 'checks.jsonl'));
  const attempts = readJsonl(path.join(dir, 'publish-attempts.jsonl'));
  const snaps = Array.isArray(manifest?.['snapshots']) ? (manifest!['snapshots'] as Array<Record<string, unknown>>) : [];
  const capture = (manifest?.['capture'] || {}) as Record<string, unknown>;
  const lines: string[] = [
    `run ${manifest?.['runId'] || path.basename(dir)} · ${manifest?.['startedAtKst'] || '?'} → ${manifest?.['endedAtKst'] || '(끝나지 않음)'} · 결과 ${manifest?.['outcome'] || '?'} · 앱 ${manifest?.['appVersion'] || '?'}`,
    `캡처: ${capture['status'] || '?'} · ${Math.round(Number(capture['bytesWritten'] || 0) / 1024)}KB${Array.isArray(capture['failures']) && (capture['failures'] as unknown[]).length ? ` · 실패 ${(capture['failures'] as unknown[]).length}건: ${(capture['failures'] as unknown[]).slice(0, 3).map((f) => brief(f, 60)).join(' / ')}` : ''}`,
    `요청: ${brief(JSON.stringify(manifest?.['requested'] || {}), 200)}`,
    `실제: ${brief(JSON.stringify(manifest?.['actual'] || {}), 200)}`,
    '',
    `스냅샷 ${snaps.length}개:`,
    ...snaps.map((s) => `   ${s['id']} · ${s['bytes']}B · ${String(s['sha1'] || '').slice(0, 10)}${s['stored'] ? '' : ` · 저장 안 됨(${s['reason']})`}`),
    '',
    `사건 ${events.length}건 (순서대로):`,
    ...events.map(describeEvent),
    '',
    `검사 ${checks.length}건:`,
    ...checks.map((c) => `   #${c['seq']} ${c['name']} · ${c['status']} · ${brief(JSON.stringify(c['result'] ?? ''), 120)}${c['changedAfter'] ? ' · 검사 뒤 본문 바뀜' : ''}`),
    '',
    `발행 시도 ${attempts.length}건:`,
    ...attempts.map((a) => `   ${a['atKst'] || a['at']} · ${a['platform']} · ${a['ok'] ? '성공' : '실패'} · ${a['url'] || a['error'] || ''}`),
  ];
  return { dir, manifest, events, checks, attempts, text: lines.join('\n') };
}
