/**
 * R0 안전망 — 스케줄러가 같은 글을 두 번 발행하지 않는지 (v3.8.376)
 *
 * 배경 (schedule-manager.ts):
 *   - :196-198  30초마다 tick. **재진입 가드가 없다** → 앞 tick이 아직 발행 중인데 다음 tick이 겹칠 수 있다.
 *   - :229      스냅샷 배열을 for...await 로 돌면서 **루프 안에서 status를 재확인하지 않는다**
 *               → 같은 항목이 두 번 processScheduledPost 에 들어갈 수 있다.
 *   - :161-164  'processing' 상태를 영구히 제외 → 처리 중 크래시하면 그 예약은 영원히 발행되지 않는다.
 *
 * 하루 5~10편 무인 운영에서 중복 발행은 곧 중복 콘텐츠이고, 유실은 곧 누락이다.
 * 이 테스트는 R6(스케줄러 수정) 전에 깔아두는 그물이다.
 */

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '.tmp-tests/test-schedule'),
    isPackaged: false,
  },
}));

import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve('.tmp-tests/test-schedule');

// v3.8.387: 이 테스트들은 it() 안에서 schedule-manager 를 콜드 require 한다.
//   ts-jest 컴파일 비용이 테스트 시간에 포함되므로, 전체 게이트에서 워커가 경합하면
//   기본 5초를 넘겨 타임아웃으로 죽었다(단독 실행 시 147ms). 컴파일 시간은 검증 대상이
//   아니고, 이 흔들림 때문에 진짜 회귀를 구분할 수 없어 명시적으로 넉넉히 잡는다.
jest.setTimeout(30_000);

function resetStore() {
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ }
  fs.mkdirSync(DIR, { recursive: true });
}

describe('ScheduleManager — 중복 발행/유실 방지 (R0 안전망)', () => {
  beforeEach(() => {
    resetStore();
    jest.resetModules();
  });

  afterAll(() => {
    try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ }
  });

  it('tick이 겹쳐도 같은 예약이 두 번 처리되지 않는다', async () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const mgr: any = new ScheduleManager();

    const past = new Date(Date.now() - 60_000).toISOString();
    mgr.addSchedule({
      keyword: '중복테스트',
      scheduleDateTime: past,
      platform: 'wordpress',
      payload: { topic: '중복테스트', platform: 'wordpress', postingMode: 'schedule' },
    });

    const processed: string[] = [];
    // 실제 발행 대신 카운트만. 일부러 느리게 만들어 tick 겹침을 유도한다.
    mgr.processScheduledPost = jest.fn(async (schedule: any) => {
      processed.push(schedule.id);
      await new Promise(r => setTimeout(r, 50));
    });

    // tick 2개를 동시에 돌린다 (30초 간격 타이머가 겹치는 상황 재현)
    await Promise.all([mgr.checkPendingSchedules(), mgr.checkPendingSchedules()]);

    const unique = new Set(processed);
    expect(processed.length).toBe(unique.size); // 같은 id가 2번 들어가면 실패
    expect(processed.length).toBeLessThanOrEqual(1);
  });

  it('processing 상태로 멈춘 예약을 회수할 수 있다 (영구 유실 방지)', async () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const mgr: any = new ScheduleManager();

    const id = mgr.addSchedule({
      keyword: '멈춤테스트',
      scheduleDateTime: new Date(Date.now() - 60_000).toISOString(),
      platform: 'wordpress',
      payload: { topic: '멈춤테스트', platform: 'wordpress', postingMode: 'schedule' },
    });

    // 처리 중 크래시 상황: status만 processing으로 남고 프로세스가 죽었다
    mgr.updateSchedule(id?.id || id, { status: 'processing' });

    // 회수 수단이 있어야 한다. 지금은 없으므로 이 테스트는 red다.
    expect(typeof mgr.recoverStuckProcessing).toBe('function');
  });

  it('예약 목록이 시간순으로 정렬되어 가장 이른 것부터 처리된다', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const mgr: any = new ScheduleManager();

    const later = new Date(Date.now() - 10_000).toISOString();
    const earlier = new Date(Date.now() - 90_000).toISOString();
    mgr.addSchedule({ keyword: '나중', scheduleDateTime: later, platform: 'wordpress', payload: { topic: '나중' } });
    mgr.addSchedule({ keyword: '먼저', scheduleDateTime: earlier, platform: 'wordpress', payload: { topic: '먼저' } });

    const pending = mgr.getPendingSchedules();
    expect(pending.length).toBeGreaterThanOrEqual(2);
    const times = pending.map((s: any) => new Date(s.scheduleDateTime).getTime());
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted); // 정렬이 없으면 실패
  });
});
