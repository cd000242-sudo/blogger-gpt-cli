/**
 * 🧹 깃허브 릴리스 정리 — 최신 KEEP 개만 남기고 이전 버전의 릴리스를 지운다. (v3.8.668)
 *
 * 사장님: "깃허브에 669개를 다 들고 있을 필요가 있니?" — 설치본 하나가 122MB 라 669개면 80GB 였다.
 * 릴리스 자산만 지우고 **태그는 남긴다** — 몇 바이트짜리 이력이고, 특정 버전을 되돌릴 때 필요하다.
 *
 * 사용:
 *   node scripts/prune-releases.js          ← 최신 2개만 남김 (release:work 끝에 자동으로 돈다)
 *   node scripts/prune-releases.js 3 --dry  ← 3개 남기고 무엇을 지울지 보기만
 *
 * 안전장치: package.json 의 버전이 깃허브 최신 릴리스와 다르면 아무것도 지우지 않는다 —
 * 릴리스가 덜 끝났거나 다른 세션이 올린 판일 수 있다.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const KEEP = Math.max(1, Number(process.argv[2]) || 2);
const DRY = process.argv.includes('--dry');
const pkgVersion = require(path.join(__dirname, '..', 'package.json')).version;

function ver(tag) {
  return String(tag).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
}

function main() {
  const raw = execFileSync('gh', ['release', 'list', '--limit', '1000', '--json', 'tagName'], { encoding: 'utf8' });
  const list = JSON.parse(raw);
  const sorted = [...list].sort((a, b) => {
    const x = ver(a.tagName);
    const y = ver(b.tagName);
    for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return y[i] - x[i];
    return 0;
  });
  const keep = sorted.slice(0, KEEP).map((r) => r.tagName);
  const drop = sorted.slice(KEEP);

  console.log(`\n🧹 [prune-releases] 릴리스 ${list.length}개 — 남김 ${keep.join(', ') || '(없음)'} · 지울 것 ${drop.length}개${DRY ? ' (dry-run)' : ''}`);
  if (keep[0] !== `v${pkgVersion}`) {
    console.log(`   ⏭️ 건너뜀 — package.json 은 ${pkgVersion} 인데 깃허브 최신은 ${keep[0] || '(없음)'} 입니다`);
    return;
  }
  if (drop.length === 0) {
    console.log('   ✅ 지울 이전 버전 없음');
    return;
  }

  let done = 0;
  let failed = 0;
  for (const r of drop) {
    if (DRY) { done += 1; continue; }
    try {
      execFileSync('gh', ['release', 'delete', r.tagName, '--yes'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      done += 1;
    } catch (e) {
      failed += 1;
      console.log(`   ✗ ${r.tagName}: ${String((e && e.stderr) || (e && e.message) || e).trim().slice(0, 80)}`);
    }
    if ((done + failed) % 50 === 0) console.log(`   … ${done + failed}/${drop.length}`);
  }
  console.log(`   ${DRY ? '지울 예정' : '지움'} ${done} · 실패 ${failed} · 남김 ${keep.join(', ')}`);
}

try {
  main();
} catch (e) {
  // 정리가 릴리스를 막으면 안 된다 — 실패해도 조용히 끝낸다
  console.log(`   ⚠️ [prune-releases] 건너뜀: ${String((e && e.message) || e).slice(0, 100)}`);
}
