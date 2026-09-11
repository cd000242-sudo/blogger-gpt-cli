/**
 * AI 모델 배지 드롭다운이 에이전트 모드에서 안 열리던 문제 (v3.8.716)
 *
 * 사장님: "Uncaught ReferenceError: AGENT_MODEL_CATALOG is not defined
 *          at modelRows (header-badges.js:400) … 자꾸 이러는데 왜 이런 거니?"
 *
 * v3.8.714 가 `AGENT_MODEL_CATALOG?.[provider]` 라고 적었는데 그 이름은 렌더러 어디에도
 * 선언된 적이 없다. **선언 없는 이름은 `?.` 로도 못 막는다** — 읽는 순간 ReferenceError 이고,
 * 그래서 드롭다운이 통째로 안 열렸다. 목록의 정본은 메인(`agent:models`)이다.
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

describe('① 없는 이름을 읽지 않는다', () => {
  const ui = read('electron/ui/modules/header-badges.js');

  it('⭐⭐ 선언된 적 없는 AGENT_MODEL_CATALOG 를 더는 참조하지 않는다', () => {
    expect(ui).not.toContain('AGENT_MODEL_CATALOG');
  });

  it('⭐⭐ 목록은 선언된 캐시에서 읽는다', () => {
    expect(ui).toMatch(/let agentModelCatalog = null;/);
    expect(ui).toMatch(/const list = agentModelCatalog\?\.\[provider\];/);
  });
});

describe('② 목록을 메인에서 받아 온다 (채널이 실재해야 한다)', () => {
  const ui = read('electron/ui/modules/header-badges.js');
  const main = read('electron/main.ts');

  it('⭐⭐ 렌더러가 부르는 채널을 메인이 실제로 등록해 둔다', () => {
    expect(ui).toContain(`invoke?.('agent:models')`);
    expect(main).toContain(`ipcMain.handle('agent:models'`);
  });

  it('⭐ 아직 못 받았을 때 받아 오고, 도착하면 다시 그린다', () => {
    expect(ui).toMatch(/if \(agentMode && !agentModelCatalog\)/);
    expect(ui).toMatch(/if \(catalog && isPopOpen\(pop\)\) buildModelPop\(pop\)/);
  });
});

describe('③ 목록의 정본은 한 곳이다', () => {
  it('⭐ 메인이 돌려주는 models 는 agent-models 의 표 그대로다', () => {
    const main = read('electron/main.ts');
    expect(main).toContain(`require('../dist/core/agent-models')`);
    expect(main).toContain('models: AGENT_MODELS');
    const catalog = require('../src/core/agent-models');
    expect(Object.keys(catalog.AGENT_MODELS)).toEqual(expect.arrayContaining(['claude', 'codex', 'gemini']));
    expect(catalog.AGENT_MODELS.claude.length).toBeGreaterThan(1);
  });
});
