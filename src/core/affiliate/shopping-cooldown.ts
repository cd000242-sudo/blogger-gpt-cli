/**
 * 쇼핑모드 연속 발행 쿨다운 (v3.8.400)
 *
 * ## 왜 필요한가 — 실측(2026-08-01)
 * 쿠팡 상품 페이지를 짧은 시간에 반복 조회하자 **창을 띄운 실제 Chrome 인데도 403** 이 났고
 * 그 뒤 연속 실패했다. 후기·스펙을 못 가져오면 글의 재료가 사라진다.
 *
 * 사용자 지시:
 *   "사용자가 욕심내서 많이 작성하려다 막힐 수 있으니까 몇 분 후에 작성하게끔 권고해주고,
 *    그래도 말 안 듣고 발행 버튼 누르면 락을 걸어서 몇 분 뒤에 발행하라고 카운트하고
 *    그 시간 되면 발행할 수 있도록 풀어줘. 아니면 예약이 되게끔. 이건 쇼핑모드에만 해당."
 *
 * ## 설계 원칙
 * · **쇼핑모드에만** 적용한다. 일반 글은 쿠팡을 두드리지 않으므로 막을 이유가 없다.
 * · 시간이 지나면 **자동으로 풀린다.** 사람이 잠금을 해제할 일이 없어야 한다.
 * · 잠긴 동안에도 **예약 발행은 열어둔다** — 기다리는 대신 예약해두면 되기 때문이다.
 * · 상태 파일이 깨져도 발행을 막지 않는다(읽기 실패 = 쿨다운 없음으로 본다).
 */
import * as fs from 'fs';
import * as path from 'path';

/** 실측 근거: 15회 이상 연속 조회에서 차단됐다. 5분 간격이면 하루 수십 편도 여유롭다 */
export const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const FILE_NAME = 'shopping-cooldown.json';

export interface CooldownState {
  /** 마지막 쇼핑모드 발행 시각 */
  lastPublishAt: number;
  /** 연속 발행 횟수 — 많이 몰아 쓰면 더 길게 쉬게 한다 */
  consecutive: number;
}

export interface CooldownStatus {
  canPublish: boolean;
  remainingMs: number;
  /** 언제 풀리는지 (사람이 읽는 용도) */
  readyAtIso: string;
  /** 화면에 그대로 띄울 문구 */
  message: string;
  consecutive: number;
}

/**
 * 연속으로 몰아 쓸수록 간격을 늘린다.
 *   1편째 → 5분, 2편째 → 5분, 3편째부터 → 10분, 5편째부터 → 15분
 * 차단은 '짧은 시간에 몇 번' 이 문제지 하루 총량이 문제가 아니다.
 */
export function cooldownForCount(consecutive: number, base = DEFAULT_COOLDOWN_MS): number {
  if (consecutive >= 5) return base * 3;
  if (consecutive >= 3) return base * 2;
  return base;
}

/** 순수 계산 — 파일 없이 검증할 수 있게 분리한다 */
export function computeStatus(
  state: CooldownState | null,
  now: number,
  base = DEFAULT_COOLDOWN_MS,
): CooldownStatus {
  if (!state || !state.lastPublishAt) {
    return { canPublish: true, remainingMs: 0, readyAtIso: '', message: '', consecutive: 0 };
  }
  const wait = cooldownForCount(state.consecutive, base);
  const elapsed = now - state.lastPublishAt;

  // 시계가 뒤로 갔거나(수동 변경) 충분히 지났으면 통과
  if (elapsed < 0 || elapsed >= wait) {
    return { canPublish: true, remainingMs: 0, readyAtIso: '', message: '', consecutive: state.consecutive };
  }

  const remainingMs = wait - elapsed;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.ceil((remainingMs % 60000) / 1000);
  const left = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
  return {
    canPublish: false,
    remainingMs,
    readyAtIso: new Date(now + remainingMs).toISOString(),
    consecutive: state.consecutive,
    message: `쇼핑모드는 연속 발행 시 쿠팡이 상품 조회를 막습니다(실측 확인). `
      + `${left} 뒤에 발행하시면 후기·스펙을 정상적으로 가져옵니다. `
      + `기다리기 어려우면 예약 발행을 걸어두세요.`,
  };
}

/**
 * 마지막 발행에서 오래 지났으면 연속 카운트를 리셋한다.
 * (아침에 한 편, 저녁에 한 편 쓰는 사람을 '연속'으로 보면 안 된다)
 */
export function nextState(prev: CooldownState | null, now: number, resetAfterMs = 60 * 60 * 1000): CooldownState {
  const gap = prev?.lastPublishAt ? now - prev.lastPublishAt : Infinity;
  const consecutive = gap > resetAfterMs ? 1 : (prev?.consecutive || 0) + 1;
  return { lastPublishAt: now, consecutive };
}

function filePath(dir: string): string {
  return path.join(dir, FILE_NAME);
}

export function readState(dir: string): CooldownState | null {
  try {
    const p = filePath(dir);
    if (!fs.existsSync(p)) return null;
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!parsed || typeof parsed.lastPublishAt !== 'number') return null;
    return { lastPublishAt: parsed.lastPublishAt, consecutive: Number(parsed.consecutive) || 0 };
  } catch {
    // 상태를 못 읽으면 쿨다운 없음으로 본다 — 발행을 막는 쪽으로 실패하지 않는다
    return null;
  }
}

export function writeState(dir: string, state: CooldownState): void {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath(dir), JSON.stringify(state), 'utf8');
  } catch {
    /* 저장 실패가 발행을 막지 않는다 */
  }
}

/** 발행 직전 검사 */
export function checkShoppingCooldown(dir: string, now = Date.now(), base = DEFAULT_COOLDOWN_MS): CooldownStatus {
  return computeStatus(readState(dir), now, base);
}

/** 발행에 성공했을 때 기록 */
export function recordShoppingPublish(dir: string, now = Date.now()): CooldownState {
  const state = nextState(readState(dir), now);
  writeState(dir, state);
  return state;
}
