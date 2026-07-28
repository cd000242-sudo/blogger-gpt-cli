// src/core/utils/atomic-json.ts
// 🛡️ 원자적 JSON 저장 (v3.8.378 R3)
//
// fs.writeFileSync 직접 호출은 쓰기 도중 크래시/정전 시 파일이 반토막 난다.
// scheduled-posts.json이 깨지면 loadScheduleData의 JSON.parse가 실패해 예약 전체가 소실된다.
// temp 파일에 완전히 쓴 뒤 rename — rename은 같은 볼륨 안에서 원자적이다.

import * as fs from 'fs';
import * as path from 'path';

/**
 * JSON을 원자적으로 저장한다. 실패 시 기존 파일은 그대로 남는다.
 * Windows에서 대상 파일이 잠겨 rename이 실패하면 직접 쓰기로 폴백한다
 * (기존 동작과 동일한 수준 — 원자성만 잃고 기능은 유지, 경고 로그 남김).
 */
export function writeJsonAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.${process.pid}.tmp`;

  fs.writeFileSync(tmpPath, json, 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (renameErr: any) {
    // Windows: 대상이 다른 프로세스에 잠겨 있으면 EPERM/EACCES가 날 수 있다
    try { fs.unlinkSync(tmpPath); } catch { /* noop */ }
    console.warn(`[ATOMIC-JSON] rename 실패 — 직접 쓰기로 폴백 (원자성 상실): ${renameErr?.message}`);
    fs.writeFileSync(filePath, json, 'utf8');
  }
}
