/**
 * Continuous publish: a long first article (Genspark wait + Claude Code, 10-15+ minutes) must not look dead,
 * the "stopped" summary must say why, and a restart must not collide with a job that is still winding down.
 *
 * Field case (2026-11-10, Orbit 3.8.767, agent = Claude Code, Genspark research ON):
 *   - Genspark deep research timed out at exactly 10 minutes on every run (genspark-timing.jsonl), so the queue
 *     sat at "1/4 시작 0%" with no log line for 10 minutes before claude.exe even started.
 *   - Someone pressed stop at ~7 minutes. The summary said "중지됨: 완료 0개 · 실패 0개 · 남은 4개 100%" with a
 *     "일부 실패" label (the word 실패 in "실패 0개" matched a /실패/ test) and no reason.
 *   - Main ignored the stop during the Genspark wait and started claude.exe anyway (ghost run), so the next
 *     queue start failed instantly with already_running and then waited a full interval for nothing.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createEsmLoader } from './helpers/esm-vm-loader';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const loader = createEsmLoader({ context: vm.createContext({}), stubs: {} });
const outcome = loader.load(path.join(root, 'electron/ui/modules/publish-queue-outcome.js'));

describe('summarizeQueueOutcome', () => {
  test('a stopped queue with 0 failures is "stopped", never an error, and names the reason', () => {
    const r = outcome.summarizeQueueOutcome({
      stopped: true, stopReason: '연속발행 중지 버튼 (시작 7분 19초 뒤)',
      successCount: 0, failedCount: 0, remainingCount: 4, total: 4,
    });
    expect(r.status).toBe('stopped');
    expect(r.message).toContain('중지됨: 완료 0개 · 실패 0개 · 남은 4개');
    expect(r.message).toContain('연속발행 중지 버튼 (시작 7분 19초 뒤)');
    expect(outcome.queueStatusLabel(r.status)).not.toContain('일부 실패');
    expect(outcome.queueStatusLabel(r.status)).toContain('중지됨');
  });

  test('failures without a stop are an error; clean runs are success', () => {
    const failed = outcome.summarizeQueueOutcome({ stopped: false, successCount: 3, failedCount: 1, remainingCount: 0, total: 4 });
    expect(failed.status).toBe('error');
    expect(failed.message).toBe('처리 완료: 성공 3개 · 실패 1개');
    expect(outcome.queueStatusLabel('error')).toBe('⚠️ 일부 실패');
    const ok = outcome.summarizeQueueOutcome({ stopped: false, successCount: 4, failedCount: 0, remainingCount: 0, total: 4 });
    expect(ok.status).toBe('success');
    expect(ok.message).toBe('전체 4개 순차발행 완료');
  });
});

describe('describeStopReason', () => {
  test('names the control that requested the stop and how long after the start', () => {
    const start = 1_000_000;
    expect(outcome.describeStopReason({ source: 'stop-button', at: start + 439_000 }, start)).toBe('중지 요청: 연속발행 중지 버튼 (시작 7분 19초 뒤)');
    expect(outcome.describeStopReason({ source: 'mini-bar-button', at: start + 5_000 }, start)).toContain('진행 막대');
  });

  test('an unknown origin is said out loud instead of hidden', () => {
    expect(outcome.describeStopReason(null, 0)).toContain('출처를 알 수 없는');
  });
});

describe('waitForPreviousRunToFinish', () => {
  const makeClock = () => {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => { t += ms; } };
  };

  test('does not wait when nothing is running', async () => {
    const c = makeClock();
    const r = await outcome.waitForPreviousRunToFinish({ isLocked: () => false, isStopped: () => false, now: c.now, sleep: c.sleep, maxMs: 60_000 });
    expect(r.state).toBe('free');
    expect(c.now()).toBe(0);
  });

  test('waits until the earlier job releases the lock, and says so while waiting', async () => {
    const c = makeClock();
    const lines: number[] = [];
    const r = await outcome.waitForPreviousRunToFinish({
      isLocked: () => c.now() < 95_000, isStopped: () => false, now: c.now, sleep: c.sleep,
      maxMs: 600_000, pollMs: 1000, logEveryMs: 30_000, onWait: (ms: number) => lines.push(ms),
    });
    expect(r.state).toBe('released');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  test('stops waiting when the queue is stopped, and gives up after the bound', async () => {
    const c = makeClock();
    const stopped = await outcome.waitForPreviousRunToFinish({ isLocked: () => true, isStopped: () => c.now() >= 3000, now: c.now, sleep: c.sleep, maxMs: 600_000 });
    expect(stopped.state).toBe('stopped');
    const c2 = makeClock();
    const timeout = await outcome.waitForPreviousRunToFinish({ isLocked: () => true, isStopped: () => false, now: c2.now, sleep: c2.sleep, maxMs: 10_000 });
    expect(timeout.state).toBe('timeout');
  });
});

describe('describeItemError', () => {
  test('already_running is explained in plain Korean', () => {
    expect(outcome.describeItemError('already_running')).toContain('앞 작업이 아직 끝나지 않아');
    expect(outcome.describeItemError('some_other_error')).toBe('some_other_error');
  });
});

describe('agent cancel epoch (main)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const epoch = require('../src/core/agent-cancel-epoch');

  test('a job sees a cancel that arrives after it started, but not one that came before', () => {
    const before = epoch.snapshotAgentCancel();
    expect(before()).toBe(false);
    epoch.bumpAgentCancelEpoch();
    expect(before()).toBe(true);
    const after = epoch.snapshotAgentCancel();
    expect(after()).toBe(false);
  });
});

describe('wiring', () => {
  const queue = read('electron/ui/modules/publish-queue.js');
  const main = read('electron/main.ts');

  test('the queue summary uses the helper and not a /실패/ word test', () => {
    expect(queue).toContain("from './publish-queue-outcome.js'");
    expect(queue).toContain('summarizeQueueOutcome(');
    expect(queue).not.toMatch(/lastStatus\s*=\s*\/실패\/\.test\(message \|\| ''\)\s*\?\s*'error'\s*:\s*'success'\s*;/);
  });

  test('stop requests record who asked, and the queue waits for an earlier job before each item', () => {
    expect(queue).toContain("requestQueueStop('mini-bar-button')");
    expect(queue).toContain("requestQueueStop('stop-button')");
    expect(queue).toContain('waitForPreviousRunToFinish(');
  });

  test('main: cancel bumps the epoch; the agent job passes it to Genspark and checks it before launching the CLI', () => {
    expect(main).toMatch(/function handleCancelTask[\s\S]{0,600}bumpAgentCancelEpoch\(\)/);
    expect(main).toMatch(/collectGensparkEvidence\(agentKeyword,\s*\{[\s\S]{0,400}isCanceled:\s*agentCanceled/);
    const guard = main.indexOf('if (agentCanceled())');
    const write = main.indexOf('writeAgentJobFiles(jobDir, request || {}, profile)');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(write);
  });
});
