/**
 * 2026-11-10 - Genspark deep research slowness.
 * Runs the real runGensparkDeepResearch against a fake browser (no Genspark call, no real profile).
 * Time is virtual: page.waitForTimeout advances Date.now, so the 10-minute caps run instantly.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('playwright', () => ({ chromium: { launchPersistentContext: jest.fn() } }));
import { chromium } from 'playwright';
import { runGensparkDeepResearch } from '../src/core/genspark/genspark-client';
import { collectGensparkEvidence, describeGensparkTimings } from '../src/core/genspark/genspark-research';
import { appendGensparkTimingLog } from '../src/core/genspark/genspark-timing-log';

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'genspark-project-2026-10-10.json'), 'utf8'));
const JOB = '12345678-1234-1234-1234-123456789abc';
const partial = { ...fixture, data: { ...fixture.data, session_state: { messages: fixture.data.session_state.messages.slice(0, 5) } } };

interface Fake { clickedAt: number; firstProjectFetchAt: number; projectFetches: number; closed: number }

/** Fake Chrome: URL gets a job id 300 ms after the send click; /api/project answers come from `polls` in order. */
function installFakeBrowser(polls: Array<{ status: number; json: unknown }>, closeCostMs = 0): Fake {
  let now = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const fake: Fake = { clickedAt: 0, firstProjectFetchAt: 0, projectFetches: 0, closed: 0 };
  let urlAt = Number.POSITIVE_INFINITY;
  const page = {
    goto: jest.fn(async () => { now += 1500; }),
    waitForTimeout: jest.fn(async (ms: number) => { now += ms; }),
    url: () => (now >= urlAt ? `https://www.genspark.ai/agents?id=${JOB}` : 'https://www.genspark.ai/agents?type=agentic_deep_research'),
    locator: () => ({ first: () => ({
      fill: async () => { now += 400; },
      click: async () => { now += 100; fake.clickedAt = now; urlAt = now + 300; },
    }) }),
    evaluate: jest.fn(async (_fn: unknown, arg?: string) => {
      if (arg === undefined) return 'Mozilla/5.0 HeadlessChrome/150.0.0.0 Safari/537.36';
      if (arg === '/api/is_login') return { status: 200, json: { data: { cogen_id: 'test-user' } } };
      fake.projectFetches += 1;
      if (!fake.firstProjectFetchAt) fake.firstProjectFetchAt = now;
      return polls[Math.min(fake.projectFetches - 1, polls.length - 1)];
    }),
  };
  const context = {
    pages: () => [page],
    newCDPSession: async () => ({ send: async () => undefined }),
    close: jest.fn(async () => { fake.closed += 1; now += closeCostMs; }),
  };
  (chromium.launchPersistentContext as jest.Mock).mockResolvedValue(context);
  return fake;
}

beforeEach(() => { process.env['PUPPETEER_EXECUTABLE_PATH'] = __filename; });
afterEach(() => { jest.restoreAllMocks(); delete process.env['PUPPETEER_EXECUTABLE_PATH']; });

describe('deep research stops waiting when waiting is pointless', () => {
  test('session expiry mid-research ends at once and keeps what was read (was: poll until the 10-minute cap)', async () => {
    installFakeBrowser([{ status: 200, json: partial }, { status: 401, json: null }]);
    const r = await runGensparkDeepResearch('test keyword');
    expect(r.ok).toBe(false);
    expect(r.error).toContain('GENSPARK_SESSION_EXPIRED');
    expect(r.research?.pages.length).toBeGreaterThan(0);
    expect(r.elapsedMs).toBeLessThan(30_000);
  });

  test('job id is picked up as soon as the URL changes, not on a 1-second grid', async () => {
    const fake = installFakeBrowser([{ status: 200, json: fixture }]);
    const r = await runGensparkDeepResearch('test keyword');
    expect(r.ok).toBe(true);
    // first poll = id wait (<= ~0.5s) + the fixed 5s poll gap; the old 1s sleep made this 6s
    expect(fake.firstProjectFetchAt - fake.clickedAt).toBeLessThan(5700);
  });
});

describe('phase timings are measured and recorded', () => {
  test('result carries per-phase timings that add up to the elapsed time', async () => {
    installFakeBrowser([{ status: 200, json: partial }, { status: 200, json: fixture }], 2500);
    const r = await runGensparkDeepResearch('test keyword');
    const t = (r as any).timings;
    expect(r.ok).toBe(true);
    expect(t).toBeDefined();
    expect(t.polls).toBe(2);
    expect(t.waitMs).toBeGreaterThanOrEqual(10_000);
    expect(t.waitMs).toBeLessThan(11_000);
    expect(t.loadMs).toBe(1500);
    expect(t.closeMs).toBe(2500);
    expect(t.openMs + t.loadMs + t.sendMs + t.waitMs).toBe(r.elapsedMs);
  });

  test('collectGensparkEvidence forwards timings and logs one line with the phases', async () => {
    const timings = { queueMs: 0, openMs: 2000, loadMs: 9000, sendMs: 4000, waitMs: 240_000, closeMs: 2500, polls: 48 };
    const logs: string[] = [];
    const r = await collectGensparkEvidence('test keyword', {
      onLog: (m) => logs.push(m),
      run: async () => ({ ok: true, projectId: 'p', elapsedMs: 255_000, timings } as any),
    });
    expect((r as any).timings).toEqual(timings);
    const line = logs.find((l) => l.includes('단계별'));
    expect(line).toBeDefined();
    expect(line).toContain('240.0초');
    expect(describeGensparkTimings(timings as any)).toContain('48회');
  });

  test('timing log line holds numbers only (no keyword, no job id) and a bad path never throws', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-timing-')), 'sub', 'timing.jsonl');
    const entry = { ok: true, pages: 25, items: 14, rejected: 11, elapsedMs: 255_000, timings: { queueMs: 0, openMs: 1, loadMs: 2, sendMs: 3, waitMs: 4, closeMs: 5, polls: 6 } };
    appendGensparkTimingLog(entry, file);
    const row = JSON.parse(fs.readFileSync(file, 'utf8').trim());
    expect(row).toMatchObject({ ok: true, pages: 25, waitMs: 4, polls: 6 });
    expect(typeof row.at).toBe('string');
    expect(JSON.stringify(row)).not.toMatch(/keyword|projectId/i);
    expect(() => appendGensparkTimingLog(entry, path.join(__filename, 'x', 'y.jsonl'))).not.toThrow();
  });
});
