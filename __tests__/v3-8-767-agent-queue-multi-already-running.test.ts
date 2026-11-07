/**
 * v3.8.767 - Agent mode: a queue item must never fail with `already_running` by calling runPosting from inside itself.
 *
 * Flow: runPosting (holds __runPostingInFlight) -> Agent writes the article -> publishToPlatform().
 * When the "generated article" slot is empty or was discarded at that moment, publishToPlatform used to fall through
 * to `runPosting()` - the caller's own lock answered `already_running` for the item, and `__agentPublishFlowActive`
 * stayed on afterwards. These tests run the real posting.js / multi-account-agent.js (helpers/renderer-publish-env.ts);
 * only the Agent CLI run and the publish IPC are fakes. Nothing here calls an agent, a paid API or a platform.
 */
import { createPublishEnv } from './helpers/renderer-publish-env';

type Env = ReturnType<typeof createPublishEnv>;

async function runQueueItem(env: Env, keyword: string, overrides: Record<string, unknown> = {}) {
  env.prepareQueueItem(keyword, overrides);
  const result = await env.win.runPosting();
  return {
    keyword, ok: result?.ok, error: result?.error,
    running: env.appState.isRunning, inflight: env.win.__runPostingInFlight || null, flow: !!env.win.__agentPublishFlowActive,
  };
}

const published = (env: Env) => env.invokeCalls.filter((c) => c.channel === 'publish-content').length;

describe('queue + Agent: consecutive items', () => {
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });

  test('every item publishes and the locks are free between items', async () => {
    const env = createPublishEnv();
    env.win.__queueRunning = true;
    const rows = [];
    for (const keyword of ['kw one', 'kw two', 'kw three']) rows.push(await runQueueItem(env, keyword));
    expect(rows.map((r) => [r.ok, r.error, r.running, r.inflight, r.flow])).toEqual([
      [true, '', false, null, false], [true, '', false, null, false], [true, '', false, null, false],
    ]);
    expect(published(env)).toBe(3);
  });

  test('a failed publish on item 1 does not block item 2', async () => {
    const env = createPublishEnv({ publishAnswer: (n) => (n === 1 ? { ok: false, error: 'boom' } : { ok: true, url: 'u' }) });
    env.win.__queueRunning = true;
    const first = await runQueueItem(env, 'a1');
    const second = await runQueueItem(env, 'a2');
    expect([first.ok, first.error, first.flow, first.inflight]).toEqual([false, 'boom', false, null]);
    expect([second.ok, second.error]).toEqual([true, '']);
  });
});

describe('queue + Agent: the generated-article slot is unusable when publishing starts', () => {
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });

  test('slot left empty by the Agent step: explicit error, no self re-entry, flag cleared, next item publishes', async () => {
    const env = createPublishEnv();
    env.win.__queueRunning = true;
    const healthy = env.win.runAgentJobFromPosting;
    let calls = 0;
    env.win.runAgentJobFromPosting = async (payload: any) => (++calls === 1 ? { ok: true, title: 't' } : healthy(payload));

    const first = await runQueueItem(env, 'e1');
    expect(first.error).not.toBe('already_running');
    expect(first.error).toBe('agent_article_missing');
    expect([first.running, first.inflight, first.flow]).toEqual([false, null, false]);
    expect(published(env)).toBe(0);

    const second = await runQueueItem(env, 'e2');
    expect([second.ok, second.error, second.flow]).toEqual([true, '', false]);
    expect(published(env)).toBe(1);
  });

  test('keyword box changed while the Agent wrote: a queue item still publishes the article it just made', async () => {
    const env = createPublishEnv();
    env.win.__queueRunning = true;
    const healthy = env.win.runAgentJobFromPosting;
    let calls = 0;
    env.win.runAgentJobFromPosting = async (payload: any) => {
      const result = await healthy(payload);
      if (++calls === 1) env.elements.keywordInput.value = 'typed meanwhile';
      return result;
    };

    const first = await runQueueItem(env, 'd1');
    expect([first.ok, first.error, first.flow]).toEqual([true, '', false]);
    const sent = env.invokeCalls.find((c) => c.channel === 'publish-content');
    expect(sent?.args.title).toBe('title of d1');
    expect(sent?.args.payload.topic).toBe('d1');   // the publish payload comes from the queue item, not the box

    const second = await runQueueItem(env, 'd2');
    expect([second.ok, second.error]).toEqual([true, '']);
    expect(published(env)).toBe(2);
  });

  test('form controls reshape the item text (line break in the keyword, CRLF in the request): the item still reaches publish', async () => {
    const env = createPublishEnv();
    env.win.__queueRunning = true;
    const LF = String.fromCharCode(10);
    const CRLF = String.fromCharCode(13) + LF;
    // <input> drops the line break, so the box no longer equals the item's own keyword
    const first = await runQueueItem(env, `line one${LF}line two`);
    expect([first.ok, first.error]).toEqual([true, '']);
    const second = await runQueueItem(env, 'plain item', { userRequest: `use a table${CRLF}${CRLF}no jokes  ` });
    expect([second.ok, second.error]).toEqual([true, '']);
    expect(published(env)).toBe(2);
  });

  test('single Agent publish: keyword box changed while the Agent wrote is still discarded, but reported explicitly', async () => {
    const env = createPublishEnv();
    env.elements.keywordInput.value = 'single kw';
    env.win.__publishQueuePayloadOverrides = null;
    const healthy = env.win.runAgentJobFromPosting;
    env.win.runAgentJobFromPosting = async (payload: any) => {
      const result = await healthy(payload);
      env.elements.keywordInput.value = 'typed meanwhile';
      return result;
    };
    const result = await env.win.runPosting();
    expect(result.error).toBe('agent_article_missing');
    expect(result.error).not.toBe('already_running');
    expect(env.win.__agentPublishFlowActive).toBe(false);
    expect(published(env)).toBe(0);
  });

  test('single (non-queue) Agent publish keeps working and still blocks a true duplicate request', async () => {
    const env = createPublishEnv({ agentDelayMs: 30 });
    env.elements.keywordInput.value = 'single kw';
    env.win.__publishQueuePayloadOverrides = null;
    const firstRun = env.win.runPosting();
    await new Promise((r) => setTimeout(r, 5));
    const duplicate = await env.win.runPosting();
    expect(duplicate.error).toBe('already_running');
    const result = await firstRun;
    expect([result.ok, result.error]).toEqual([true, '']);
    expect(published(env)).toBe(1);
    expect(env.win.__runPostingInFlight || null).toBeNull();
  });
});

describe('multi-account + Agent never takes the posting run lock', () => {
  beforeEach(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });

  test('accounts run one at a time, each generates, and runPosting locks stay untouched', async () => {
    const env = createPublishEnv({ agentDelayMs: 10 });
    const { generateArticleWithAgent, runAccountsInOrder } = env.loadModule('multi-account-agent.js');
    const seenInflight: Array<unknown> = [];
    const healthy = env.win.runAgentJobFromPosting;
    let active = 0; let maxActive = 0;
    env.win.runAgentJobFromPosting = async (payload: any) => {
      active += 1; maxActive = Math.max(maxActive, active);
      seenInflight.push(env.win.__runPostingInFlight || null);
      try { return await healthy(payload); } finally { active -= 1; }
    };
    const accounts = [{ name: 'A', topic: 'k1' }, { name: 'B', topic: 'k2' }];
    const articles = await runAccountsInOrder(accounts, async (account: any) => (
      generateArticleWithAgent({ topic: account.topic }, env.win, { getAppState: () => env.appState })
    ), { agent: true });
    expect(articles.map((a: any) => a.title)).toEqual(['title of k1', 'title of k2']);
    expect(maxActive).toBe(1);
    expect(seenInflight).toEqual([null, null]);
    expect(env.appState.generatedContent).toBeNull();
    expect(env.win.__runPostingInFlight || null).toBeNull();
  });
});
