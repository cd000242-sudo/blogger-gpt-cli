/**
 * v3.8.766 - Codex default model moves off the retired gpt-5.5.
 *
 * Model slugs were checked against the local Codex model cache (names only):
 * gpt-6.1-sol, gpt-6-astra, gpt-6.1-terra, gpt-6-sol, gpt-6-luna, gpt-5.6-*. gpt-5.5 is gone.
 * No model is executed here - catalog and wiring checks only.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { agentModelsFor, normalizeAgentModel, agentModelLabel } from '../src/core/agent-models';

const acorn = require('acorn');
const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const mainTs = read('electron/main.ts');
const mainJs = read('electron/main.js');
const workshop = read('electron/ui/modules/codex-workshop.js');

const DEFAULT_RE = /const CODEX_AGENT_DEFAULT_MODEL = '([^']+)';/;

describe('Codex catalog', () => {
  const values = agentModelsFor('codex').map((m) => m.value);

  test.each(['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-luna'])('%s is selectable', (slug) => {
    expect(values).toContain(slug);
    expect(agentModelLabel('codex', slug)).not.toBe('');
  });

  test('previously selectable models stay selectable', () => {
    for (const slug of ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) expect(values).toContain(slug);
  });

  test('the retired gpt-5.5 is not offered', () => {
    expect(values).not.toContain('gpt-5.5');
  });
});

describe('Stored gpt-5.5 migrates', () => {
  test('main normalizer maps gpt-5.5 to gpt-6.1-terra for Codex only', () => {
    expect(normalizeAgentModel('codex', 'gpt-5.5')).toBe('gpt-6.1-terra');
    expect(normalizeAgentModel('codex', ' gpt-5.5 ')).toBe('gpt-6.1-terra');
    expect(normalizeAgentModel('codex', 'gpt-6.1-sol')).toBe('gpt-6.1-sol');
    expect(normalizeAgentModel('claude', 'gpt-5.5')).toBe('');
    expect(normalizeAgentModel('codex', 'something-unknown')).toBe('');
  });

  test('the renderer moves a saved gpt-5.5 as well', () => {
    const nodes = acorn.parse(workshop, { ecmaVersion: 'latest', sourceType: 'module' }).body;
    const node = nodes.map((n: any) => n.declaration || n).find((n: any) => n.id?.name === 'normalizeAgentModelSelections');
    const ctx: any = {};
    vm.createContext(ctx);
    vm.runInContext(`${workshop.slice(node.start, node.end)}\nthis.fn = normalizeAgentModelSelections;`, ctx);
    expect(ctx.fn({ codex: 'gpt-5.5', claude: 'claude-sonnet-5-5' })).toEqual({ codex: 'gpt-6.1-terra', claude: 'claude-sonnet-5-5' });
    expect(ctx.fn({ codex: 'gpt-6-astra' }).codex).toBe('gpt-6-astra');
  });
});

describe('App default model', () => {
  test('main.ts default is gpt-6.1-terra and is a selectable catalog entry', () => {
    const slug = mainTs.match(DEFAULT_RE)?.[1];
    expect(slug).toBe('gpt-6.1-terra');
    expect(agentModelsFor('codex').map((m) => m.value)).toContain(slug);
  });

  test('the compiled main.js carries the same default', () => {
    expect(mainJs.match(DEFAULT_RE)?.[1]).toBe('gpt-6.1-terra');
  });

  test('no gpt-5.5 literal is left in main.ts', () => {
    expect(mainTs).not.toMatch(/gpt-5\.5/);
  });
});
