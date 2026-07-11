const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

describe('UI performance regression guard', () => {
  test('main module loads the adaptive performance optimizer and chunks deferred startup work', () => {
    const main = read('electron/ui/modules/main.js');
    const optimizer = read('electron/ui/performance-optimizer.js');

    expect(main).toContain("import '../performance-optimizer.js'");
    expect(main).toContain('window.performanceOptimizer?.scheduleIdle');
    expect(main).toContain('runDeferredGroup');
    expect(main).toContain('window.performanceOptimizer, wrappedTasks');
    expect(optimizer).toContain('detectProfile()');
    expect(optimizer).toContain('scheduleIdle(callback');
    expect(optimizer).toContain('async runChunked');
    expect(optimizer).toContain('requestFrame(key, callback)');
  });

  test('logs and progress updates are capped and frame-scheduled', () => {
    const core = read('electron/ui/modules/core.js');

    expect(core).toContain('maxEntries: 360');
    expect(core).toContain('this.maxEntries = window.performanceOptimizer?.getLogLimit?.()');
    expect(core).toContain('this.trim(logContent)');
    expect(core).toContain('this.scheduleScroll(logContent)');
    expect(core).toContain("window.performanceOptimizer.requestFrame('log-scroll', cb)");
    expect(core).toContain('if (this._lastStepProgress === rounded) return;');
    expect(core).toContain('if (this._lastOverallProgress === rounded) return;');
    expect(core).not.toContain('console.log(`📈 전체 진행률 업데이트');
    expect(core).not.toContain("behavior: 'smooth'");
  });

  test('performance optimizer and main module remain valid JavaScript', () => {
    for (const file of ['electron/ui/performance-optimizer.js', 'electron/ui/modules/main.js', 'electron/ui/modules/core.js']) {
      expect(() => acorn.parse(read(file), {
        ecmaVersion: 'latest',
        sourceType: 'module',
      })).not.toThrow();
    }
  });
});
