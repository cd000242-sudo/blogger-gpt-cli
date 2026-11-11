/**
 * Agent-mode readiness gate must know the Genspark image engine.
 *
 * Root cause under test: electron/ui/modules/codex-workshop.js getAgentImageEngineMeta() had no branch for
 * 'genspark-image', so verifyAgentImageIntegration() returned ready=false ("연동 방식을 확인하지 못했습니다")
 * for every Genspark pick. In Agent mode (the default of new installs) single publish, the publish queue and
 * multi-account all stop at this gate before any image is requested.
 *
 * codex-workshop.js is a browser module with no exports, so the functions are cut out of the source and run.
 */
import * as fs from 'fs';
import * as path from 'path';

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ui', 'modules', 'codex-workshop.js'), 'utf8');

function cutFunction(name: string): string {
  const start = SOURCE.search(new RegExp(`^(async )?function ${name}\\(`, 'm'));
  if (start < 0) throw new Error(`function not found: ${name}`);
  const closing = '\n}\n';
  const end = SOURCE.indexOf(closing, start);
  if (end < 0) throw new Error(`function end not found: ${name}`);
  return SOURCE.slice(start, end) + closing;
}

function load(bridge: any) {
  const names = ['normalizeAgentImageEngine', 'getAgentImageEngineMeta', 'createAgentReadinessCheck', 'verifyAgentImageIntegration', 'getAgentReadinessActionLabel'];
  const body = `${names.map(cutFunction).join('\n')}
    return { getAgentImageEngineMeta, verifyAgentImageIntegration, getAgentReadinessActionLabel };`;
  const factory = new Function('getBridgeApi', 'window', 'readAgentImageApiKey', body);
  return factory(() => bridge, {}, async () => '');
}

describe('Agent readiness gate - Genspark image engine', () => {
  it('knows genspark-image (not "unknown")', () => {
    const { getAgentImageEngineMeta } = load({});
    expect(getAgentImageEngineMeta('genspark-image').kind).not.toBe('unknown');
  });

  it('every engine the screens offer is known to the gate', () => {
    const { getAgentImageEngineMeta } = load({});
    const engines = ['genspark-image', 'dropshot-nanobanana-pro', 'codex-image', 'flow', 'nanobanana2', 'nanobananapro', 'gptimage2', 'gptimage25flare', 'prodia', 'deepinfra', 'leonardo', 'none', 'crawled'];
    const unknown = engines.filter((engine) => getAgentImageEngineMeta(engine).kind === 'unknown');
    expect(unknown).toEqual([]);
  });

  it('is ready when the Genspark session check says logged in', async () => {
    const invoke = jest.fn(async () => ({ loggedIn: true, email: 'a@b.c' }));
    const { verifyAgentImageIntegration } = load({ invoke });
    const check = await verifyAgentImageIntegration('genspark-image');
    expect(invoke).toHaveBeenCalledWith('genspark:check-login');
    expect(check.ready).toBe(true);
  });

  it('is not ready and points to the Genspark login when logged out', async () => {
    const invoke = jest.fn(async () => ({ loggedIn: false, email: '', error: 'GENSPARK_PROFILE_BUSY: 닫고 다시 시도' }));
    const { verifyAgentImageIntegration, getAgentReadinessActionLabel } = load({ invoke });
    const check = await verifyAgentImageIntegration('genspark-image');
    expect(check.ready).toBe(false);
    expect(check.action).toBe('genspark-login');
    expect(check.detail).toContain('GENSPARK_PROFILE_BUSY');
    expect(getAgentReadinessActionLabel(check)).not.toBe('바로 연동하기');
  });

  it('turns a thrown session check into a not-ready result instead of throwing', async () => {
    const { verifyAgentImageIntegration } = load({ invoke: jest.fn(async () => { throw new Error('ipc down'); }) });
    const check = await verifyAgentImageIntegration('genspark-image');
    expect(check.ready).toBe(false);
    expect(check.detail).toContain('ipc down');
  });

  it('keeps the Dropshot gate as it was (own readiness check)', async () => {
    const invoke = jest.fn(async () => ({ ready: true, message: 'ok' }));
    const { getAgentImageEngineMeta, verifyAgentImageIntegration } = load({ invoke });
    expect(getAgentImageEngineMeta('dropshot-nanobanana-pro').kind).toBe('dropshot');
    const check = await verifyAgentImageIntegration('dropshot-nanobanana-pro');
    expect(invoke).toHaveBeenCalledWith('dropshot:verify-ready', { force: true });
    expect(check.ready).toBe(true);
  });
});
