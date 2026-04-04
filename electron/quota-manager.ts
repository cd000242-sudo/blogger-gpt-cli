/**
 * electron/quota-manager.ts
 * 일일 무료 사용 쿼터 관리 — HMAC 서명 + 변조 감지 + 날짜 롤백 방지
 *
 * 네이버 자동화 앱의 quotaManager.ts를 참고하여 blogger-gpt-cli에 맞게 간소화.
 * publish 카운터 하나만 관리 (content/media/imageApi 불필요).
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ── 타입 ──

export interface QuotaState {
  date: string;
  publish: number;
}

interface SecureQuotaState extends QuotaState {
  lastSeenDate: string;
  _sig: string;
}

export interface QuotaStatus {
  date: string;
  limit: number;
  usage: number;
  isPaywalled: boolean;
}

// ── 보안 ──

const _INTERNAL_SALT = Buffer.from('T3JiaXRRdW90YVNhbHQyMDI2', 'base64').toString('utf-8');

function computeSignature(state: QuotaState & { lastSeenDate?: string }): string {
  const payload = JSON.stringify({
    d: state.date,
    p: state.publish,
    l: state.lastSeenDate || state.date,
  });
  return crypto.createHmac('sha256', _INTERNAL_SALT).update(payload).digest('hex').substring(0, 16);
}

function verifySignature(state: SecureQuotaState): boolean {
  const expected = computeSignature(state);
  return state._sig === expected;
}

// ── 유틸 ──

function getLocalDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getStorageFile(): string {
  try {
    return path.join(app.getPath('userData'), 'quota-state.json');
  } catch {
    return path.join(process.cwd(), 'quota-state.json');
  }
}

function getBackupFile(): string {
  return getStorageFile().replace('.json', '.backup.json');
}

const TAMPERED_STATE = (date: string): QuotaState => ({
  date,
  publish: 999,
});

const EMPTY_STATE = (date: string): QuotaState => ({
  date,
  publish: 0,
});

// ── 읽기 ──

async function readState(): Promise<QuotaState> {
  const today = getLocalDateKey();
  const storageFile = getStorageFile();
  const backupFile = getBackupFile();

  let raw: string | null = null;
  let source = 'main';

  try {
    raw = fs.readFileSync(storageFile, 'utf-8');
  } catch {
    try {
      raw = fs.readFileSync(backupFile, 'utf-8');
      source = 'backup';
      console.log('[QuotaManager] ⚠️ 메인 파일 없음 → 백업에서 복구');
    } catch {
      return EMPTY_STATE(today);
    }
  }

  try {
    const parsed = JSON.parse(raw!) as SecureQuotaState;

    if (!parsed || typeof parsed.date !== 'string') {
      throw new Error('Invalid state');
    }

    // 시그니처 검증
    if (parsed._sig) {
      if (!verifySignature(parsed)) {
        console.error('[QuotaManager] 🚨 위변조 감지! 시그니처 불일치 → 강제 차단');
        return TAMPERED_STATE(today);
      }
    }

    // 날짜 롤백 감지
    const lastSeen = parsed.lastSeenDate || parsed.date;
    if (today < lastSeen) {
      console.warn(`[QuotaManager] 🚨 날짜 롤백 감지! today=${today}, lastSeen=${lastSeen} → 기존 사용량 유지`);
      return {
        date: today,
        publish: Number(parsed.publish) || 0,
      };
    }

    // 날짜 변경 → 리셋
    if (parsed.date !== today) {
      return EMPTY_STATE(today);
    }

    return {
      date: parsed.date,
      publish: Number(parsed.publish) || 0,
    };
  } catch {
    // 메인 파싱 실패 → 백업 시도
    if (source === 'main') {
      try {
        const backupRaw = fs.readFileSync(backupFile, 'utf-8');
        const backupParsed = JSON.parse(backupRaw) as SecureQuotaState;
        if (backupParsed._sig && verifySignature(backupParsed)) {
          console.log('[QuotaManager] ⚠️ 메인 파일 손상 → 백업에서 복구 성공');
          if (backupParsed.date !== today && today >= (backupParsed.lastSeenDate || backupParsed.date)) {
            return EMPTY_STATE(today);
          }
          return { date: backupParsed.date, publish: Number(backupParsed.publish) || 0 };
        }
      } catch { /* 백업도 실패 */ }
    }
    console.error('[QuotaManager] 🚨 파일 손상 + 백업 실패 → 강제 차단');
    return TAMPERED_STATE(today);
  }
}

// ── 쓰기 ──

function writeState(state: QuotaState): void {
  const storageFile = getStorageFile();
  const backupFile = getBackupFile();
  const today = getLocalDateKey();

  const secureState: SecureQuotaState = {
    ...state,
    lastSeenDate: today >= state.date ? today : state.date,
    _sig: '',
  };
  secureState._sig = computeSignature(secureState);

  const json = JSON.stringify(secureState, null, 2);

  const dir = path.dirname(storageFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 듀얼 저장 — 한쪽 실패해도 다른 쪽 보존
  try { fs.writeFileSync(storageFile, json, 'utf-8'); }
  catch (e) { console.error('[QuotaManager] ⚠️ 메인 파일 저장 실패:', e); }

  try { fs.writeFileSync(backupFile, json, 'utf-8'); }
  catch (e) { console.error('[QuotaManager] ⚠️ 백업 파일 저장 실패:', e); }
}

// ── 공개 API ──

/** 오늘의 발행 사용량 조회 */
export async function getUsageToday(): Promise<number> {
  const state = await readState();
  return state.publish;
}

/** 쿼터 상태 조회 (UI 표시용) */
export async function getQuotaStatus(limit: number): Promise<QuotaStatus> {
  const state = await readState();
  return {
    date: state.date,
    limit,
    usage: state.publish,
    isPaywalled: state.publish >= limit,
  };
}

/** 쿼터 소비 가능 여부 확인 */
export async function canConsume(limit: number, amount: number = 1): Promise<boolean> {
  const state = await readState();
  return (state.publish + amount) <= limit;
}

/** 쿼터 소비 (선차감) */
export async function consume(amount: number = 1): Promise<QuotaState> {
  const today = getLocalDateKey();
  const state = await readState();
  const base = state.date === today ? state : EMPTY_STATE(today);

  const next: QuotaState = {
    ...base,
    publish: base.publish + amount,
  };

  writeState(next);
  console.log(`[QuotaManager] 쿼터 소비: ${base.publish} → ${next.publish}`);
  return next;
}

/** 쿼터 환불 (발행 실패 시) */
export async function refund(amount: number = 1): Promise<QuotaState> {
  const state = await readState();
  const next: QuotaState = {
    ...state,
    publish: Math.max(0, state.publish - amount),
  };

  writeState(next);
  console.log(`[QuotaManager] 쿼터 환불: ${state.publish} → ${next.publish}`);
  return next;
}
