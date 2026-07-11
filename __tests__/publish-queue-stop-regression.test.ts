import fs from 'fs';
import path from 'path';

describe('publish queue stop regression', () => {
  let source = '';

  beforeAll(() => {
    source = fs.readFileSync(
      path.join(process.cwd(), 'electron', 'ui', 'modules', 'publish-queue.js'),
      'utf8',
    );
  });

  test('renders and exposes a queue stop control', () => {
    expect(source).toContain('id="pqrStopBtn"');
    expect(source).toContain('id="pqMiniStopBtn"');
    expect(source).toContain('stop: requestQueueStop');
    expect(source).toContain('isStopRequested: isQueueStopRequested');
    expect(source).toContain('window.electronAPI?.cancelTask?.()');
    expect(source).toContain("window.dispatchEvent(new CustomEvent('bgpt:queue-stop-requested'))");
  });

  test('queue delay can be interrupted by a stop request', () => {
    expect(source).toContain('async function sleepQueueInterval');
    expect(source).toContain('if (isQueueStopRequested())');
    expect(source).toContain('const waited = await sleepQueueInterval(waitMs, runModal)');
    expect(source).not.toContain('await new Promise(r => setTimeout(r, waitMs));');
  });

  test('stopped queues preserve uncompleted items instead of clearing all enabled items', () => {
    expect(source).toContain('const completedIds = new Set()');
    expect(source).toContain('STATE.keywords = STATE.keywords.filter(item => !completedIds.has(item.id))');
    expect(source).not.toContain('STATE.keywords = STATE.keywords.filter(item => !enabledIds.has(item.id) || failedIds.has(item.id))');
  });

  test('stopped items are treated separately from failed items', () => {
    expect(source).toContain('function createQueueStopSignal');
    expect(source).toContain('markStopped(index');
    expect(source).toContain('if (result.stopped)');
    expect(source).toContain("card.classList.remove('running', 'done', 'failed', 'stopped')");
  });
});
