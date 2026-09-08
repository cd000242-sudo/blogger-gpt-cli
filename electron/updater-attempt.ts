/**
 * 🧾 v3.8.707 — 설치 시도 장부
 *
 * 조용한 설치를 걸었는데 앱이 다시 켜져 보니 **버전이 그대로**라면(권한 확인창에서
 * '아니오', 설치기가 죽음 등) 같은 설치를 말없이 또 걸면 안 된다 — 창이 닫히고
 * 권한 창이 뜨는 일이 되풀이될 뿐이다. 그래서 "어느 버전을 언제 몇 번 걸었는지"를
 * userData 에 적어 두고, 다음 update-downloaded 가 그 장부를 먼저 본다.
 *
 * 설치가 실제로 끝나면 앱 버전이 장부의 버전과 같아지므로 시작 때 지운다.
 */
import * as fs from 'fs';
import * as path from 'path';

export interface InstallAttempt {
  version: string;
  at: number;
  count: number;
}

/** 이 시간 안에 같은 버전을 또 깔려 하면 "되풀이"로 본다 */
export const RETRY_WINDOW_MS = 10 * 60 * 1000;

const FILE_NAME = 'update-attempt.json';

function attemptPath(dir: string): string {
  return path.join(dir, FILE_NAME);
}

export function readAttempt(dir: string): InstallAttempt | null {
  try {
    const raw = fs.readFileSync(attemptPath(dir), 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.version !== 'string' || typeof parsed.at !== 'number') return null;
    return { version: parsed.version, at: parsed.at, count: Number(parsed.count) || 1 };
  } catch {
    return null;
  }
}

export function recordAttempt(dir: string, version: string, now: number = Date.now()): InstallAttempt {
  const prev = readAttempt(dir);
  const next: InstallAttempt = {
    version,
    at: now,
    count: prev && prev.version === version ? prev.count + 1 : 1,
  };
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(attemptPath(dir), JSON.stringify(next), 'utf-8');
  } catch (e: any) {
    // 장부를 못 써도 설치는 막지 않는다 — 되풀이 감지만 잃는다
    console.error('[Updater] 설치 시도 기록 실패:', e?.message);
  }
  return next;
}

export function clearAttempt(dir: string): void {
  try { fs.unlinkSync(attemptPath(dir)); } catch { /* 없으면 그만 */ }
}

export function isRepeatAttempt(prev: InstallAttempt | null, version: string, now: number = Date.now()): boolean {
  if (!prev || prev.version !== version) return false;
  return now - prev.at < RETRY_WINDOW_MS;
}
