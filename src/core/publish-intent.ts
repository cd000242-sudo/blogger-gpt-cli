// src/core/publish-intent.ts
// 🔎 발행 의도 중복 관측 (v3.8.383) — **관측 전용, 절대 차단하지 않는다**
//
// 배경: 하루 5~10편을 수동 선택 키워드로 발행하면 같은 주제를 두 번 쓰는 사고가 반드시 생긴다.
//   기존 중복 방지는 티스토리 전용 + 메모리 + 3분 창(index.ts)이라 며칠 뒤 재발행을 못 잡는다.
//
// 왜 차단하지 않는가:
//   "같은 키워드 같은 날 의도적으로 2편"이라는 정상 사용이 존재한다. 실측 충돌률 없이 임계값을
//   정하면 정상 발행을 막는다. 먼저 데이터를 모으고, 그 뒤에 차단 전환을 판단한다.
//
// 왜 절대 throw하지 않는가:
//   운영자 요구가 "파이프라인이 절대 새거나 터지면 안된다"이다. 관측 기능의 디스크 오류가
//   발행을 막으면 본말전도다. 모든 실패는 삼키고 duplicate:false로 진행한다.

import * as fs from 'fs';
import * as path from 'path';
import { writeJsonAtomic } from './utils/atomic-json';

export interface PublishIntentInput {
  platform: string;
  blogIdentity: string;
  topic: string;
  /** 저장 위치 — 미지정 시 호출부가 userData 경로를 넘긴다 (테스트는 tmpdir) */
  storePath?: string;
  /** 테스트용 시각 주입 */
  now?: number;
}

export interface PublishIntentResult {
  duplicate: boolean;
  key: string;
  previous?: { at: string; topic: string };
  daysSince?: number;
}

interface IntentRecord { at: string; topic: string }

/** 최근 N일치만 보관 (무한 증가 방지). 3,000편 규모에서도 파일이 작게 유지된다. */
const RETENTION_DAYS = 400;

/**
 * 한국어 중복 판정용 정규화 — 띄어쓰기·구두점을 제거한다.
 * "청년 월세 지원 신청방법" 과 "청년월세지원 신청 방법" 을 같은 것으로 본다
 * (실사용 중복의 대부분이 이 형태다).
 */
function normalizeTopic(topic: string): string {
  return String(topic || '')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[.,!?~·・\-_/\\()[\]{}'"“”‘’|]/g, '')
    .trim();
}

export function buildPublishIntentKey(input: { platform: string; blogIdentity: string; topic: string }): string {
  const platform = String(input.platform || '').toLowerCase().trim();
  const blog = String(input.blogIdentity || 'default').toLowerCase().trim();
  return `${platform}|${blog}|${normalizeTopic(input.topic)}`;
}

function readStore(storePath: string): Record<string, IntentRecord> {
  try {
    if (!fs.existsSync(storePath)) return {};
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    // 손상된 파일은 빈 저장소로 취급 — 발행을 막지 않는다
    return {};
  }
}

function pruneOld(store: Record<string, IntentRecord>, now: number): Record<string, IntentRecord> {
  const cutoff = now - RETENTION_DAYS * 24 * 3600 * 1000;
  const kept: Record<string, IntentRecord> = {};
  Object.entries(store).forEach(([key, rec]) => {
    const ts = new Date(rec?.at || 0).getTime();
    if (Number.isFinite(ts) && ts >= cutoff) kept[key] = rec;
  });
  return kept;
}

/**
 * 발행 의도를 기록하고, 같은 의도가 이전에 있었는지 알려준다.
 * **절대 throw하지 않으며, 반환값으로 발행을 막아서는 안 된다** (관측 전용).
 */
export function recordPublishIntent(input: PublishIntentInput): PublishIntentResult {
  const key = buildPublishIntentKey(input);
  const now = Number.isFinite(input.now as number) ? (input.now as number) : Date.now();

  try {
    const storePath = input.storePath;
    if (!storePath) return { duplicate: false, key };

    const store = pruneOld(readStore(storePath), now);
    const previous = store[key];

    const result: PublishIntentResult = { duplicate: false, key };
    if (previous) {
      const prevTs = new Date(previous.at).getTime();
      result.duplicate = true;
      result.previous = previous;
      result.daysSince = Number.isFinite(prevTs)
        ? Math.floor((now - prevTs) / (24 * 3600 * 1000))
        : 0;
    }

    store[key] = { at: new Date(now).toISOString(), topic: String(input.topic || '') };
    writeJsonAtomic(storePath, store);
    return result;
  } catch (error: any) {
    // 관측 실패가 발행을 막으면 안 된다
    console.warn('[PUBLISH-INTENT] 관측 실패 (발행은 계속 진행):', error?.message);
    return { duplicate: false, key };
  }
}

/** 경로 미지정 시 사용할 기본 저장 위치 (호출부가 userData를 넘겨준다) */
export function defaultIntentStorePath(userDataDir: string): string {
  return path.join(userDataDir, 'publish-intents.json');
}
