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

export type PublishDecision = 'AUTO_PUBLISH' | 'MANUAL_REVIEW';

export interface DecisionRecord { decision: PublishDecision; reason: string; title: string; at: number }

const records = new Map<string, DecisionRecord>();
const MAX = 60;

export function fingerprint(html: string): string {
  return createHash('sha1').update(String(html || '').replace(/\s+/g, ' ').trim()).digest('hex');
}

export function recordPublishDecision(html: string, decision: PublishDecision, reason: string, title = ''): string {
  const key = fingerprint(html);
  records.set(key, { decision, reason, title, at: Date.now() });
  if (records.size > MAX) { const oldest = records.keys().next().value; if (oldest) records.delete(oldest); }
  return key;
}

export function checkPublishDecision(html: string): DecisionRecord | null {
  return records.get(fingerprint(html)) || null;
}

/** 테스트용 */
export function clearPublishDecisions(): void { records.clear(); }
