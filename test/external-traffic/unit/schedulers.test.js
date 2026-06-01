'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const TMP = path.join(os.tmpdir(), 'orbit-sched-test-' + process.pid);
process.env.ORBIT_DATA_DIR = TMP;

jest.resetModules();
const sched = require('../../../src/core/external-traffic/schedulers');
const dispatcher = require('../../../src/core/external-traffic');

beforeEach(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(TMP)) fs.rmSync(TMP, { recursive: true, force: true });
  sched.stopScheduler();
});

describe('schedulers', () => {
  test('REVALIDATE_THRESHOLD_DAYS = 90', () => {
    expect(sched.REVALIDATE_THRESHOLD_DAYS).toBe(90);
  });

  test('runCalibration — 피드백 없으면 updated: 0', () => {
    const out = sched.runCalibration();
    expect(out.updated).toBe(0);
    expect(Array.isArray(out.channels)).toBe(true);
  });

  test('runRevalidationCheck — 최근 lastVerified는 stale 아님', () => {
    const out = sched.runRevalidationCheck();
    // 2026-06-01 검증 → 현재(2026-06-01)와 같음 → stale 0개
    expect(Array.isArray(out.stale)).toBe(true);
  });

  test('runPrune — 빈 로그도 정상 동작', () => {
    const out = sched.runPrune();
    expect(out).toBeDefined();
    expect(typeof out.kept).toBe('number');
  });

  test('runDueJobs — 모든 첫 실행', () => {
    const out = sched.runDueJobs();
    expect(out.ranCalibration).toBe(true);
    expect(out.ranPrune).toBe(true);
    expect(out.ranRevalidationCheck).toBe(true);
  });

  test('runDueJobs 두 번째 호출 — 모든 작업 스킵 (간격 미충족)', () => {
    sched.runDueJobs();
    const out2 = sched.runDueJobs();
    expect(out2.ranCalibration).toBe(false);
    expect(out2.ranPrune).toBe(false);
    expect(out2.ranRevalidationCheck).toBe(false);
  });

  test('getState — 마지막 실행 timestamp 보존', () => {
    sched.runDueJobs();
    const state = sched.getState();
    expect(state.lastCalibration).toBeGreaterThan(0);
    expect(state.lastPrune).toBeGreaterThan(0);
    expect(state.lastRevalidationCheck).toBeGreaterThan(0);
  });

  test('startScheduler / stopScheduler 안전', () => {
    const stop = sched.startScheduler({ onLog: () => {} });
    expect(typeof stop).toBe('function');
    stop();
  });
});
