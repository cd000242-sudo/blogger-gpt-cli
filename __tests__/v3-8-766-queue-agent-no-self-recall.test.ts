/**
 * v3.8.766 - queue + Agent mode failed every item with `already_running`.
 *
 * Flow: runPosting (holds __runPostingInFlight) -> Agent generates -> publishToPlatform().
 * publishToPlatform used to call runPosting() again whenever a queue was running, so the
 * second call hit the lock and returned { error: 'already_running' }.
 *
 * These tests execute the production function (extracted with acorn) in a vm sandbox.
 * Nothing here touches Codex, a browser, or a publishing platform.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const acorn = require('acorn');
const posting = fs.readFileSync(path.join(process.cwd(), 'electron/ui/modules/posting.js'), 'utf8');
const body = acorn.parse(posting, { ecmaVersion: 'latest', sourceType: 'module' }).body;
const node = body.map((n: any) => n.declaration || n).find((n: any) => n.id?.name === 'publishToPlatform');
if (!node) throw new Error('publishToPlatform not found');
const fnSource = posting.slice(node.start, node.end);

type Opts = { queue: boolean; agent: boolean; overrides?: Record<string, unknown> | null };

function harness({ queue, agent, overrides }: Opts) {
  const keyword = 'queue keyword';
  const appState: any = {
    isRunning: false,
    generatedContent: {
      title: 'generated title',
      content: '<h2>body</h2><p>text</p>',
      payload: { topic: keyword, platform: 'blogger', postingMode: 'immediate' },
    },
  };
  const runPosting = jest.fn(async () => ({ ok: false, error: 'already_running' }));
  const invoke = jest.fn(async (_channel: string, _args: any) => ({ ok: true, url: 'https://example.test/p' }));
  const createPayload = jest.fn(async (options: any = {}) => ({
    // values currently shown on the main form (must lose against queue item values)
    topic: keyword, title: keyword, platform: 'wordpress', postingMode: 'schedule',
    scheduleDate: '2099-01-01T00:00:00.000Z',
    ...(options.overrides || {}),
  }));
  const elements: any = { keywordInput: { value: keyword }, userRequestNote: { value: '' } };
  const win: any = {
    __queueRunning: queue,
    __agentPublishFlowActive: agent,
    __publishQueuePayloadOverrides: overrides === undefined ? null : overrides,
    electronAPI: { invoke },
    blogger: { runPost: jest.fn() },
    dispatchEvent: jest.fn(),
  };
  const context: any = {
    window: win, document: { getElementById: (id: string) => elements[id] || null },
    localStorage: { getItem: () => null, setItem: jest.fn() },
    CustomEvent: class { constructor(public type: string, public init: any) {} },
    console, setTimeout: jest.fn(), Date, JSON, Object,
    getAppState: () => appState, runPosting, createPayload,
    passesShoppingCooldown: async () => true,
    sameUserRequest: () => true,
    beginAgentJobPublish: () => true, endAgentJobPublish: jest.fn(), settleRepublishAfterPublish: () => [],
    resetArticleStateAfterPublish: jest.fn(), clearForcePublishOffer: jest.fn(), renderForcePublishOffer: jest.fn(),
    ButtonStateManager: { setLoading: jest.fn(), restore: jest.fn() },
    getErrorHandler: () => ({ handle: jest.fn() }),
  };
  for (const name of ['debugLog', 'addLog', 'setRunning', 'updateAgentProgressModal', 'showProgressModal',
    'hideProgressModal', 'showNotification', 'restoreKeywordInputInteractivity']) context[name] = jest.fn();
  vm.createContext(context);
  vm.runInContext(`${fnSource}\nthis.publishToPlatform = publishToPlatform;`, context);
  return { publish: context.publishToPlatform as (o?: any) => Promise<any>, runPosting, invoke, createPayload, win };
}

const itemOverrides = () => ({
  topic: 'queue keyword', title: 'queue keyword', platform: 'blogger',
  postingMode: 'immediate', publishType: 'immediate', scheduleDate: undefined, fromQueue: true, queueImageToken: 'pq-1',
});

describe('queue + Agent mode: publishToPlatform must not re-enter runPosting', () => {
  test('does not call runPosting and publishes the generated article', async () => {
    const h = harness({ queue: true, agent: true, overrides: itemOverrides() });
    const result = await h.publish();
    expect(h.runPosting).not.toHaveBeenCalled();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke.mock.calls[0][0]).toBe('publish-content');
    expect(result.ok).toBe(true);
    expect(result.error).not.toBe('already_running');
  });

  test('queue item values (platform, publish mode, schedule) win over the main form', async () => {
    const overrides = itemOverrides();
    const h = harness({ queue: true, agent: true, overrides });
    await h.publish();
    expect(h.createPayload.mock.calls[0][0].overrides).toBe(overrides);
    const sent = h.invoke.mock.calls[0][1].payload;
    expect(sent.platform).toBe('blogger');
    expect(sent.postingMode).toBe('immediate');
    expect(sent.publishType).toBe('immediate');
    expect(sent.scheduleDate).toBeUndefined();
    expect(sent.fromQueue).toBe(true);
    expect(sent.queueImageToken).toBe('pq-1');
    expect(sent.previewOnly).toBe(false);
  });

  test('the agent flag is cleared after the publish so the next item starts clean', async () => {
    const h = harness({ queue: true, agent: true, overrides: itemOverrides() });
    await h.publish();
    expect(h.win.__agentPublishFlowActive).toBe(false);
  });
});

describe('unchanged paths', () => {
  test('queue without Agent still delegates to runPosting', async () => {
    const h = harness({ queue: true, agent: false, overrides: itemOverrides() });
    await h.publish();
    expect(h.runPosting).toHaveBeenCalledTimes(1);
    expect(h.invoke).not.toHaveBeenCalled();
  });

  test('single (non-queue) Agent publish passes no queue overrides', async () => {
    const h = harness({ queue: false, agent: true, overrides: itemOverrides() });
    await h.publish();
    expect(h.runPosting).not.toHaveBeenCalled();
    expect(h.createPayload.mock.calls[0][0].overrides || {}).toEqual({});
    expect(h.invoke.mock.calls[0][1].payload.platform).toBe('wordpress');
  });
});
