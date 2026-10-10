/**
 * 빌드 전에 빠진 부품을 스스로 설치한다 — 사장님이 `npm install` 을 따로 할 필요가 없게.
 *
 * 계기: 2026-10-10 첨부 PDF 읽기로 pdfjs-dist 가 새로 들어왔다. 릴리스 순서(release:work · dist · build-mac)는
 * 모두 `npm run build` 로 시작하지만 그 안에 설치 단계가 없어, 사장님 PC 의 node_modules 에 없으면 그 부품 없이 빌드된다.
 * 빠진 게 없으면 아무것도 하지 않는다(빌드가 느려지지 않는다).
 */
import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { missingDependencies, ensureDeps } = require('../scripts/ensure-deps.js');

describe('빠진 부품 찾기', () => {
  test('package.json 의 dependencies 중 node_modules 에 없는 것만 고른다', () => {
    const pkg = { dependencies: { a: '1.0.0', 'pdfjs-dist': '6.3.289', '@scope/b': '^2' }, devDependencies: { c: '1' } };
    const present = new Set(['a', '@scope/b']);
    expect(missingDependencies(pkg, (n: string) => present.has(n))).toEqual(['pdfjs-dist']);
  });
  test('dependencies 가 없으면 빈 목록', () => {
    expect(missingDependencies({}, () => false)).toEqual([]);
  });
});

describe('설치', () => {
  test('빠진 게 있으면 npm install 을 한 번 돌린다', () => {
    const runs: Array<{ cmd: string; args: string[] }> = [];
    const out = ensureDeps({
      pkg: { dependencies: { 'pdfjs-dist': '6.3.289' } },
      exists: () => false,
      run: (cmd: string, args: string[]) => { runs.push({ cmd, args }); return { status: 0 }; },
      log: () => undefined,
    });
    expect(out).toEqual({ installed: true, missing: ['pdfjs-dist'] });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.args).toEqual(['install', '--no-audit', '--no-fund']);
  });
  test('빠진 게 없으면 아무것도 돌리지 않는다', () => {
    const runs: unknown[] = [];
    const out = ensureDeps({ pkg: { dependencies: { a: '1' } }, exists: () => true, run: () => { runs.push(1); return { status: 0 }; }, log: () => undefined });
    expect(out).toEqual({ installed: false, missing: [] });
    expect(runs).toHaveLength(0);
  });
  test('설치가 실패하면 빌드를 멈춘다(부품 없이 조용히 빌드되지 않게)', () => {
    expect(() => ensureDeps({ pkg: { dependencies: { x: '1' } }, exists: () => false, run: () => ({ status: 1 }), log: () => undefined })).toThrow(/npm install/);
  });
});

describe('배선 — 모든 빌드가 지나는 build 스크립트 맨 앞', () => {
  test('package.json build 가 ensure-deps 로 시작한다(release:work · dist · build-mac 모두 npm run build 를 부른다)', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts.build.startsWith('node scripts/ensure-deps.js && ')).toBe(true);
    expect(pkg.scripts['release:work']).toContain('npm run build');
    expect(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build-mac.js'), 'utf8')).toContain("run('npm', ['run', 'build'], env);");
  });
  test('지금 이 저장소의 package.json 기준으로 실제로 찾기가 돈다', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const root = path.join(__dirname, '..');
    const missing = missingDependencies(pkg, (n: string) => fs.existsSync(path.join(root, 'node_modules', n, 'package.json')));
    expect(Array.isArray(missing)).toBe(true);
  });
});
