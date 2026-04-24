// electron/oneclick/state/persistence.ts
// 🗂️ 원클릭 세팅 체크포인트 persist — 앱 재시작 후 중단된 세팅을 이어서 재개할 수 있도록
//
// 파일 위치: {userData}/oneclick-checkpoints.json
// 저장 트리거: 각 step 완료 시 / 에러 발생 시 / 취소 시
// 로드 트리거: 앱 시작 시 setupHandlers.ts의 get-resume-info IPC 호출

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { SetupState } from '../types';

export interface Checkpoint {
  platform: string;
  currentStep: number;
  totalSteps: number;
  stepStatus: string;
  message: string;
  completed: boolean;
  error: string | null;
  stepResults: Array<{ index: number; label: string; ok: boolean; message: string }>;
  config?: any;
  savedAt: string;
  version: number; // 스키마 버전 — 향후 breaking change 대비
}

const CURRENT_VERSION = 1;

function getPath(): string {
  return path.join(app.getPath('userData'), 'oneclick-checkpoints.json');
}

export function saveCheckpoint(state: SetupState, config?: any): void {
  try {
    const p = getPath();
    const all = loadAllCheckpoints();
    const cp: Checkpoint = {
      platform: state.platform,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      stepStatus: state.stepStatus,
      message: state.message,
      completed: state.completed,
      error: state.error,
      stepResults: [...(state.stepResults || [])],
      config: config || undefined,
      savedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    all[state.platform] = cp;
    fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[ONECLICK-PERSIST] 체크포인트 저장 실패:', (e as Error)?.message);
  }
}

export function loadAllCheckpoints(): Record<string, Checkpoint> {
  try {
    const p = getPath();
    if (!fs.existsSync(p)) return {};
    const content = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function loadCheckpoint(platform: string): Checkpoint | null {
  const all = loadAllCheckpoints();
  const cp = all[platform];
  if (!cp || cp.version !== CURRENT_VERSION) return null;
  return cp;
}

export function clearCheckpoint(platform: string): void {
  try {
    const p = getPath();
    const all = loadAllCheckpoints();
    delete all[platform];
    fs.writeFileSync(p, JSON.stringify(all, null, 2), 'utf-8');
  } catch { /* 무시 */ }
}

/**
 * 재개 가능한 체크포인트만 반환 — 완료된 것은 제외, 24시간 이상된 것은 무효화.
 */
export function getResumableCheckpoints(): Checkpoint[] {
  const all = loadAllCheckpoints();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Object.values(all).filter(cp => {
    if (cp.completed) return false;
    if (cp.version !== CURRENT_VERSION) return false;
    try {
      const age = now - new Date(cp.savedAt).getTime();
      return age < DAY_MS;
    } catch {
      return false;
    }
  });
}
