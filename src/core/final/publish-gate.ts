/**
 * 🚦 발행 결정 장부 (v3.8.735)
 *
 * 생성이 끝날 때 "이 글을 그대로 자동 발행해도 되는가"를 기록하고, 발행 창구(publishGeneratedContent)가 그것을 본다.
 * 발행 창구는 본문(html)만 받으므로 본문의 지문(해시)으로 찾는다.
 *   · 지문이 같다 = 생성한 그대로다 → MANUAL_REVIEW 면 자동 발행을 막는다.
 *   · 지문이 다르다 = 사람이 편집기에서 고쳤다 → 사람이 검토한 것이니 막지 않는다.
 * 사용자가 forcePublish 를 주면 막지 않는다.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type PublishDecision = 'AUTO_PUBLISH' | 'MANUAL_REVIEW';

/**
 * enforced — v3.8.747: 품질 루프가 켜진 글만 발행을 막는다. 루프 OFF(기존 사용자 기본)에서는 관문이 돌고 판정도 남지만
 * 고쳐 줄 편집기가 없어 막으면 막다른 길이다(실측: 루프 없는 초안 10편 중 2편이 BODY_FACT/EMPTY_SECTION 으로 막힘).
 * 736 의 설계("기본은 734 와 같다 · 차단은 켜야만")대로 OFF 는 참고 판정만 남긴다.
 */
export interface DecisionRecord { decision: PublishDecision; reason: string; title: string; at: number; enforced: boolean }

const records = new Map<string, DecisionRecord>();
const MAX = 60;

export function fingerprint(html: string): string {
  return createHash('sha1').update(String(html || '').replace(/\s+/g, ' ').trim()).digest('hex');
}

export function recordPublishDecision(html: string, decision: PublishDecision, reason: string, title = '', enforced = true): string {
  const key = fingerprint(html);
  records.set(key, { decision, reason, title, at: Date.now(), enforced });
  if (records.size > MAX) { const oldest = records.keys().next().value; if (oldest) records.delete(oldest); }
  return key;
}

export function checkPublishDecision(html: string): DecisionRecord | null {
  return records.get(fingerprint(html)) || null;
}

/**
 * v3.8.747 — 같은 제목으로 MANUAL_REVIEW 가 기록돼 있는데 지문이 다르면 "사람이 고친 본문" 이다.
 * 우회 자체는 설계(사람이 검토한 것)지만, 그 사실은 남겨야 한다 — 한 글자만 고쳐도 관문을 지나는 구조이므로 최소한 기록은 있어야 한다.
 */
export function findManualReviewByTitle(title: string): DecisionRecord | null {
  const t = String(title || '').trim();
  if (!t) return null;
  for (const r of records.values()) if (r.decision === 'MANUAL_REVIEW' && r.title === t) return r;
  return null;
}

export type PublishOverrideKind = 'forcePublish' | 'userEdited';
export interface PublishOverride { kind: PublishOverrideKind; title: string; blockedReasons: string; at: string }
const overrides: PublishOverride[] = [];

function overridePath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    if (electron?.app?.getPath) return path.join(electron.app.getPath('userData'), 'publish-overrides.jsonl');
  } catch { /* 일렉트론 밖 */ }
  return path.join(os.homedir(), '.blogger-gpt', 'publish-overrides.jsonl');
}

/** MANUAL_REVIEW 를 우회한 발행을 남긴다 — forcePublish 든 사람이 고친 본문이든 조용히 지나가지 않는다 */
export function recordPublishOverride(kind: PublishOverrideKind, title: string, blockedReasons: string): PublishOverride {
  const entry: PublishOverride = { kind, title: String(title || '').slice(0, 200), blockedReasons: String(blockedReasons || '').slice(0, 500), at: new Date().toISOString() };
  overrides.push(entry);
  if (overrides.length > MAX) overrides.shift();
  try {
    const p = overridePath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch { /* 기록 실패가 발행을 막지 않는다 */ }
  return entry;
}

export function listPublishOverrides(): PublishOverride[] { return [...overrides]; }

/** 테스트용 */
export function clearPublishDecisions(): void { records.clear(); overrides.length = 0; }
