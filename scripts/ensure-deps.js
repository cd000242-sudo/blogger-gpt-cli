/**
 * 빌드 전에 빠진 부품(package.json dependencies)을 스스로 설치한다.
 *
 * 왜: 새 부품(예: 2026-10-10 첨부 PDF 읽기의 pdfjs-dist)이 들어와도 릴리스 순서에는 설치 단계가 없어,
 *     사장님 PC 의 node_modules 에 없으면 그 부품 없이 빌드됐다. `npm run build` 맨 앞에서 이것이 돈다.
 * 빠진 게 없으면 아무것도 하지 않는다. 설치가 실패하면 빌드를 멈춘다(부품 없이 조용히 빌드되지 않게).
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/** dependencies 중 node_modules 에 없는 이름 */
function missingDependencies(pkg, exists) {
  return Object.keys((pkg && pkg.dependencies) || {}).filter((name) => !exists(name));
}

function ensureDeps({ pkg, exists, run, log }) {
  const missing = missingDependencies(pkg, exists);
  if (missing.length === 0) return { installed: false, missing: [] };
  log(`📦 빠진 부품 ${missing.length}개(${missing.join(', ')}) — npm install 로 설치합니다`);
  const result = run('npm', ['install', '--no-audit', '--no-fund']);
  if (!result || result.status !== 0) throw new Error(`npm install 실패(종료 코드 ${result && result.status}) — 빠진 부품: ${missing.join(', ')}`);
  log('✅ 부품 설치 완료');
  return { installed: true, missing };
}

if (require.main === module) {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  try {
    ensureDeps({
      pkg,
      exists: (name) => fs.existsSync(path.join(root, 'node_modules', name, 'package.json')),
      // 윈도우의 npm 은 npm.cmd 라 셸을 거쳐야 실행된다
      run: (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }),
      log: (m) => console.log(`[ensure-deps] ${m}`),
    });
  } catch (e) {
    console.error(`[ensure-deps] ❌ ${e.message}`);
    process.exit(1);
  }
}

module.exports = { missingDependencies, ensureDeps };
