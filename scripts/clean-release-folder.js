#!/usr/bin/env node
/**
 * release/ 폴더에서 **현재 버전이 아닌 산출물**을 지운다 (v3.8.398)
 *
 * 왜: electron-builder 는 버전마다 새 파일명으로 만들기 때문에
 *   LEADERNAM-Orbit-3.8.395.exe, -3.8.396.exe … 가 계속 쌓인다.
 *   EXE 하나가 약 120MB 라 몇 번만 빌드해도 수 GB 가 된다.
 *
 * 안전 규칙
 *   · **현재 package.json 버전 파일은 절대 지우지 않는다.**
 *   · release/ 폴더 밖은 건드리지 않는다(경로 이탈 방어).
 *   · 빌드에 필요한 고정 파일(latest.yml, FIX-AUTO-UPDATE.bat 등)은 보존한다.
 *   · win-unpacked 는 매 빌드 재생성되는 중간 산출물이라 --deep 일 때만 지운다.
 *   · 지우기 전에 무엇을 지우는지 출력한다(조용한 삭제 금지).
 *
 * 사용
 *   node scripts/clean-release-folder.js          현재 버전 외 설치파일 정리
 *   node scripts/clean-release-folder.js --deep   win-unpacked 까지 정리
 *   node scripts/clean-release-folder.js --dry    무엇을 지울지 보기만
 */
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const RELEASE_DIR = path.resolve(__dirname, '..', 'release');
const version = pkg.version;
const DRY = process.argv.includes('--dry');
const DEEP = process.argv.includes('--deep');

/** 버전과 무관하게 항상 남겨야 하는 파일 */
const KEEP_ALWAYS = new Set([
  'latest.yml',
  'FIX-AUTO-UPDATE.bat',
  'builder-effective-config.yaml',
]);

const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

function dirSize(dir) {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      total += e.isDirectory() ? dirSize(full) : (fs.statSync(full).size || 0);
    }
  } catch { /* noop */ }
  return total;
}

/** release/ 안쪽인지 확인 — 경로 이탈로 엉뚱한 걸 지우지 않게 */
function isInsideReleaseDir(target) {
  const rel = path.relative(RELEASE_DIR, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function remove(target, label) {
  if (!isInsideReleaseDir(target)) {
    console.log(`   ⚠️ 건너뜀(release 밖): ${target}`);
    return 0;
  }
  const stat = fs.statSync(target);
  const size = stat.isDirectory() ? dirSize(target) : stat.size;
  if (DRY) {
    console.log(`   [dry] 삭제 예정: ${label}  (${mb(size)})`);
    return size;
  }
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`   🗑️ 삭제: ${label}  (${mb(size)})`);
  return size;
}

function main() {
  if (!fs.existsSync(RELEASE_DIR)) {
    console.log('🧹 [clean-release] release 폴더가 없습니다 — 정리할 것 없음');
    return;
  }

  console.log(`\n🧹 [clean-release] 현재 버전 ${version} 외 산출물 정리${DRY ? ' (dry-run)' : ''}`);
  const before = dirSize(RELEASE_DIR);
  let freed = 0;

  for (const entry of fs.readdirSync(RELEASE_DIR, { withFileTypes: true })) {
    const name = entry.name;
    const full = path.join(RELEASE_DIR, name);

    if (KEEP_ALWAYS.has(name)) continue;

    if (entry.isDirectory()) {
      // win-unpacked 등 중간 산출물 — --deep 일 때만
      if (DEEP) freed += remove(full, `${name}/ (중간 산출물)`);
      continue;
    }

    // 현재 버전이 들어간 파일은 무조건 보존
    if (name.includes(version)) continue;

    // 버전 표기가 있는 산출물만 정리 대상 (예: LEADERNAM-Orbit-3.8.396.exe)
    if (/\d+\.\d+\.\d+/.test(name)) {
      freed += remove(full, name);
      continue;
    }

    // 빌드 디버그 로그는 매번 갱신되므로 남겨도 무해 — 건드리지 않는다
  }

  const after = DRY ? before : dirSize(RELEASE_DIR);
  if (freed === 0) {
    console.log('   ✅ 정리할 이전 버전 없음');
  } else {
    console.log(`   ✅ ${mb(freed)} 정리${DRY ? ' 예정' : ''} — ${mb(before)} → ${mb(after)}`);
  }
  if (!DEEP) {
    const unpacked = path.join(RELEASE_DIR, 'win-unpacked');
    if (fs.existsSync(unpacked)) {
      console.log(`   💡 win-unpacked 가 ${mb(dirSize(unpacked))} 있습니다. 완전 정리는 --deep 옵션.`);
    }
  }
}

try {
  main();
} catch (e) {
  // 정리 실패가 릴리스를 막으면 안 된다
  console.warn('🧹 [clean-release] 정리 실패(무시하고 계속):', e?.message || e);
}
