/**
 * v3.8.545 — 예약발행을 "진짜 예약"으로 (사장님: "예약발행을 하면 7분 발행간격을 지킬 필요 없지 않니?")
 *
 * ## 고치기 전에 무슨 일이 있었나 (실측)
 * getPendingSchedules() 가 **발행 시각**이 지난 것만 꺼냈다.
 * 그래서 processScheduledPost 의
 *     shouldPublishNow = postingMode==='schedule' && scheduleTime <= now
 * 가 **항상 참**이 됐고, 플랫폼 예약(scheduleDate) 분기는 한 번도 타지 않았다.
 * 결과: "예약발행"이 사실은 "예약 시각에 앱이 깨어나 그 자리에서 생성 후 즉시발행"이었고,
 *       그 시각에 앱이 꺼져 있으면 글이 안 나갔다.
 *
 * ## 지금
 *   생성 시각(generateAt)       — 스케줄러가 깨어나는 기준. 레이트리밋 바닥값 유지.
 *   발행 시각(scheduleDateTime) — 플랫폼에 넘기는 예약 시각. 바닥값 없음.
 * 생성이 끝나면 아직 미래인 발행 시각으로 플랫폼 예약을 걸므로 앱을 꺼도 발행된다.
 */

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '.tmp-tests/test-schedule-545'),
    isPackaged: false,
  },
}));

import * as fs from 'fs';
import * as path from 'path';
import { braceBlock, blockBetween } from './helpers/source-block';

const DIR = path.resolve('.tmp-tests/test-schedule-545');
jest.setTimeout(30_000);

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf-8');
const queueSrc = read('electron/ui/modules/publish-queue.js');
const managerSrc = read('src/core/schedule-manager.ts');

function resetStore() {
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ }
  fs.mkdirSync(DIR, { recursive: true });
}

const MIN = 60_000;

describe('① 스케줄러는 발행 시각이 아니라 생성 시각에 깨어난다', () => {
  beforeEach(() => { resetStore(); jest.resetModules(); });
  afterAll(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* noop */ } });

  const base = {
    topic: 't', keywords: ['t'], platform: 'wordpress' as const,
    publishType: 'schedule' as const, payload: {}, maxRetries: 3,
  };

  it('⭐ 생성 시각이 지났으면 발행 시각이 미래여도 꺼낸다 (이게 진짜 예약의 전제)', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    m.addSchedule({
      ...base,
      generateAt: new Date(Date.now() - 5 * MIN).toISOString(),   // 생성은 이미 시각 도래
      scheduleDateTime: new Date(Date.now() + 120 * MIN).toISOString(), // 발행은 2시간 뒤
    });
    expect(m.getPendingSchedules()).toHaveLength(1);
  });

  it('생성 시각이 아직이면 꺼내지 않는다 — 발행 시각이 지났더라도', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    m.addSchedule({
      ...base,
      generateAt: new Date(Date.now() + 30 * MIN).toISOString(),
      scheduleDateTime: new Date(Date.now() - 30 * MIN).toISOString(),
    });
    expect(m.getPendingSchedules()).toHaveLength(0);
  });

  it('generateAt 이 없으면 예전처럼 발행 시각을 쓴다 — 기존 예약이 그대로 동작한다', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    m.addSchedule({ ...base, scheduleDateTime: new Date(Date.now() - 1 * MIN).toISOString() });
    m.addSchedule({ ...base, scheduleDateTime: new Date(Date.now() + 60 * MIN).toISOString() });
    expect(m.getPendingSchedules()).toHaveLength(1);
  });

  it('망가진 generateAt 은 발행 시각으로 되돌아간다 (조용히 영영 안 나가는 일 방지)', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    m.addSchedule({
      ...base,
      generateAt: 'not-a-date',
      scheduleDateTime: new Date(Date.now() - 1 * MIN).toISOString(),
    });
    expect(m.getPendingSchedules()).toHaveLength(1);
  });

  it('정렬도 생성 시각 기준이다 — 먼저 만들 것부터 처리한다', () => {
    const { ScheduleManager } = require('../src/core/schedule-manager');
    const m = new ScheduleManager();
    m.addSchedule({
      ...base, topic: '나중생성',
      generateAt: new Date(Date.now() - 1 * MIN).toISOString(),
      scheduleDateTime: new Date(Date.now() + 10 * MIN).toISOString(),
    });
    m.addSchedule({
      ...base, topic: '먼저생성',
      generateAt: new Date(Date.now() - 20 * MIN).toISOString(),
      scheduleDateTime: new Date(Date.now() + 500 * MIN).toISOString(),
    });
    expect(m.getPendingSchedules().map((s: any) => s.topic)).toEqual(['먼저생성', '나중생성']);
  });

  it('generationTimeOf 가 두 시각의 단일 판정 지점이다', () => {
    const { generationTimeOf } = require('../src/core/schedule-manager');
    const pub = '2026-09-01T00:00:00.000Z';
    const gen = '2026-08-30T00:00:00.000Z';
    expect(generationTimeOf({ scheduleDateTime: pub, generateAt: gen }).toISOString()).toBe(gen);
    expect(generationTimeOf({ scheduleDateTime: pub }).toISOString()).toBe(pub);
  });
});

describe('② 발행 분기 — 플랫폼 예약과 즉시발행이 갈린다', () => {
  it('발행 시각이 미래면 scheduleDate 를 넘긴다 (플랫폼 예약)', () => {
    // shouldPublishNow 가 거짓일 때만 scheduleDate 가 실린다
    expect(managerSrc).toContain("scheduleDate: postingMode === 'schedule' && !shouldPublishNow");
    expect(managerSrc).toContain('shouldPublishNow ? \'publish\' : postingMode');
  });

  it('두 갈래를 로그로 구분한다 — 조용히 즉시발행으로 떨어지지 않게', () => {
    expect(managerSrc).toContain('플랫폼 예약으로 올립니다');
    expect(managerSrc).toContain('이미 지나 즉시 발행합니다');
  });
});

describe('③ 큐가 두 시각을 따로 잡는다', () => {
  const block = blockBetween(queueSrc, '🗓️ v3.8.545', '// 발행 시각 순으로 정렬해 저장');

  it('⭐ 생성 시각과 발행 시각이 별개로 계산된다', () => {
    expect(block).toContain('const genStartMs = Date.now()');
    expect(block).toContain('genStartMs + (genOrder.get(it) || 0) * genIntervalMs');
  });

  it('⭐ 발행 시각에는 레이트리밋 바닥값을 걸지 않는다 (사장님 지적의 핵심)', () => {
    // 예전: cursor += getIntervalMs({ minMs: minIntervalMs })  ← 발행 시각에 7분 바닥
    expect(block).not.toContain('cursor += getIntervalMs({ minMs: minIntervalMs })');
    expect(block).toContain('cursor += (pubIntervalMs === null ? getIntervalMs({ minMs: genIntervalMs }) : pubIntervalMs)');
  });

  it('생성 간격은 여전히 레이트리밋 바닥값을 쓴다', () => {
    expect(block).toContain('getQueueMinPublishIntervalMs(enabled)');
  });

  it('무작위 모드(4~8시간)는 기존 동작을 유지한다', () => {
    expect(block).toContain("schedIntervalMode === 'random' ? null : getRawIntervalMs()");
  });

  it('generateAt 이 스케줄 항목과 IPC 양쪽에 실린다 — 한쪽만 실으면 즉시발행으로 되돌아간다', () => {
    expect(queueSrc).toContain('generateAt: generateAtIso');
    expect(queueSrc).toContain('generateAt: schedule.generateAt');
  });
});

describe('⑥ v3.8.546 — 카드에 찍은 예약 시각을 그대로 쓴다', () => {
  const block = blockBetween(queueSrc, '🕐 v3.8.546', '// 발행 시각 순으로 정렬해 저장');

  it('⭐ 예약 시간 입력칸이 실존하고 item.scheduleDate 에 묶여 있다', () => {
    expect(queueSrc).toContain('class="pq-item-schedule"');
    expect(queueSrc).toContain("item.scheduleDate = e.target.value || ''");
  });

  it('⭐ 직접 고른 시각은 간격 계산을 타지 않는다 (이게 원래 안 되던 것)', () => {
    expect(block).toContain('it.scheduleDateManual ? queueItemScheduleMs(it) : null');
    expect(block).toContain('if (manualMs !== null) return { it, publishMs: manualMs, manual: true }');
  });

  it('자동 배치 커서는 자동인 항목에서만 전진한다 — 고른 시각이 순서를 밀어내지 않게', () => {
    const planBlock = blockBetween(block, 'const plan = enabled.map', 'const genOrder');
    // manual 이면 cursor 를 건드리지 않고 즉시 return 한다
    const returnIdx = planBlock.indexOf('manual: true');
    const cursorIdx = planBlock.indexOf('cursor +=');
    expect(returnIdx).toBeGreaterThan(-1);
    expect(cursorIdx).toBeGreaterThan(returnIdx);
  });

  it('직접 고른 것만 manual 로 표시한다 — 일괄/스냅샷 값은 시작 시각으로 본다', () => {
    // 전 항목이 같은 값을 물려받는데 곧이곧대로 쓰면 30편이 같은 초에 나간다
    expect(queueSrc).toContain('item.scheduleDateManual = !!item.scheduleDate');
    expect(block).toContain('.filter(it => !it.scheduleDateManual)');
  });

  it('시각을 고르면 발행 방식도 예약으로 맞춰준다', () => {
    expect(queueSrc).toContain("if (item.scheduleDate && item.postingMode !== 'schedule') item.postingMode = 'schedule'");
  });

  it('생성 순서는 발행 시각 순이다 — 먼저 나갈 글부터 만든다', () => {
    expect(block).toContain('sort((a, b) => a.publishMs - b.publishMs)');
    expect(block).toContain('genOrder.set(p.it, rank)');
  });

  it('queueItemScheduleMs 가 잘못된 값에 흔들리지 않는다', () => {
    const fn = braceBlock(queueSrc, 'function queueItemScheduleMs');
    expect(fn).toContain("if (!raw) return null");
    expect(fn).toContain('Number.isFinite(t) ? t : null');
  });
});

describe('⑦ v3.8.546 — 간격을 더하지 않고 흡수한다', () => {
  const wait = blockBetween(queueSrc, '⏱️ v3.8.546', 'STATE.keywords = STATE.keywords.filter');

  it('⭐ 항목 시작 시각을 재서, 모자란 만큼만 기다린다', () => {
    // 사장님: "생성 10분 + 간격 7분 = 편당 17분. 5편이면 35분이 순수하게 늘어난다"
    expect(queueSrc).toContain('const itemStartedAt = Date.now()');
    expect(wait).toContain('const elapsedMs = Date.now() - itemStartedAt');
    expect(wait).toContain('const waitMs = Math.max(0, targetGapMs - elapsedMs)');
  });

  it('⭐ 예전처럼 간격을 통째로 자지 않는다', () => {
    expect(wait).not.toContain('const waitMs = intervalMode === \'random\'');
    // 대기는 waitMs(모자란 만큼)로만 들어간다
    expect(wait).toContain('sleepQueueInterval(waitMs, runModal)');
  });

  it('이미 넘겼으면 아예 안 기다리고 바로 다음으로 간다', () => {
    expect(wait).toContain('if (waitMs <= 0)');
    expect(wait).toContain('바로 다음 항목으로');
  });

  it('무엇이 어떻게 채워졌는지 화면에 남긴다', () => {
    expect(wait).toContain('생성으로 채움');
  });

  it('다음 항목 예약 시각도 실제로 흐른 시간을 반영한다', () => {
    expect(wait).toContain('scheduleOffsetMs += Math.max(targetGapMs, elapsedMs)');
  });
});

describe('④ 즉시 연속발행은 보호가 그대로다', () => {
  it('목표 간격은 여전히 바닥값으로 올려 받는다 (입력 하한을 낮춰도 안전한 근거)', () => {
    expect(queueSrc).toContain("const targetGapMs = intervalMode === 'random' ? getIntervalMs({ minMs: minIntervalMs }) : fixedIntervalMs");
    expect(queueSrc).toContain('const fixedIntervalMs = getIntervalMs({ minMs: minIntervalMs })');
  });

  it('getIntervalMs 는 minMs 로 항상 끌어올린다', () => {
    expect(queueSrc).toContain('return Math.max(raw, minMs)');
  });

  it('이미지 엔진·쇼핑 바닥값은 손대지 않았다', () => {
    expect(queueSrc).toContain('browser: 8 * 60 * 1000');
    expect(queueSrc).toContain('shopping: 10 * 60 * 1000');
    expect(queueSrc).toContain('const PUBLISH_QUEUE_MIN_MINUTES = 7');
  });

  it('입력 하한만 1분으로 내려갔다', () => {
    expect(queueSrc).toContain('const PUBLISH_QUEUE_MIN_INPUT_MINUTES = 1');
    expect(queueSrc).not.toContain('input.min = String(PUBLISH_QUEUE_MIN_MINUTES)');
  });
});

describe('⑤ 사장님이 알아야 할 것을 화면에 남긴다', () => {
  it('앱을 언제까지 켜둬야 하는지 알린다', () => {
    expect(queueSrc).toContain('그때까지 앱을 켜두세요');
    expect(queueSrc).toContain('앱을 꺼도 발행됩니다');
  });

  it('예약이 못 되는 항목이 있으면 개수와 해결책을 알린다', () => {
    expect(queueSrc).toContain('lateItems');
    expect(queueSrc).toContain('예약 시간을');
    expect(queueSrc).toContain('이후로 옮기면 예약으로 나갑니다');
  });

  it('간격 안내가 "설정 불가"라고 거짓말하지 않는다', () => {
    // 주석이 아니라 실제로 화면에 찍히는 문자열만 본다
    const hint = braceBlock(queueSrc, 'function updateIntervalGuardHint');
    expect(hint).not.toContain('이상만 설정 가능`');
    expect(hint).toContain('예약발행의 발행 시각은 입력한');
    expect(hint).toContain('즉시 연속발행은');
  });
});
