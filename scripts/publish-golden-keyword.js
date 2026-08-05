#!/usr/bin/env node
/**
 * scripts/publish-golden-keyword.js — 황금키워드 배포 원본만 GitHub 에 올린다.
 *
 * 앱의 [관리자 편집 → 저장]이 data/golden-keyword.json 을 갱신하고,
 * 이 스크립트가 그 파일 하나만 커밋+푸시한다. 사용자 앱들은 raw URL 로 읽어간다.
 *
 * 사용법:
 *   npm run golden:publish
 *
 * 릴리스와 독립적이다 — 버전을 올리지 않고 키워드만 매일 갱신할 수 있다.
 * (릴리스할 때는 어차피 이 파일도 함께 커밋되어 나간다)
 *
 * 전제 조건: git 인증 (기존 릴리스 파이프라인과 동일. 새로 설정할 것 없음)
 */

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REL_PATH = 'data/golden-keyword.json';
const FILE = path.join(ROOT, REL_PATH);

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }).toString().trim();
}

function fail(message) {
  console.error(`\n❌ [golden:publish] ${message}\n`);
  process.exit(1);
}

// ─── 1. 배포 원본 검증 ───
if (!fs.existsSync(FILE)) {
  fail(`${REL_PATH} 가 없습니다.\n   앱에서 [🥇 오늘의 리더남 황금키워드 → 관리자 편집 → 저장] 을 먼저 실행하세요.`);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  fail(`${REL_PATH} 를 읽을 수 없습니다 (JSON 형식 오류): ${e.message}`);
}

if (!data || !Array.isArray(data.items)) {
  fail(`${REL_PATH} 형식이 올바르지 않습니다. items 배열이 필요합니다.`);
}
if (data.items.length === 0) {
  fail('키워드가 0건입니다. 빈 목록을 배포하면 사용자 화면이 비어버립니다.\n   의도한 것이라면 파일을 직접 커밋하세요.');
}

const reportDate = data.reportDate || '날짜 없음';
console.log(`\n🥇 [golden:publish] ${reportDate} · 키워드 ${data.items.length}건`);
data.items.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.keyword}${item.platform ? ` [${item.platform}]` : ''}`);
});

// ─── 2. 변경 여부 확인 ───
let changed;
try {
  changed = run(`git status --porcelain -- ${REL_PATH}`);
} catch (e) {
  fail(`git 상태 확인 실패: ${e.message}`);
}

if (!changed) {
  console.log(`\n✅ [golden:publish] 이미 최신입니다 — 푸시할 변경이 없습니다.\n`);
  process.exit(0);
}

// ─── 3. 이 파일만 커밋 + 푸시 ───
//   경로를 명시해 다른 작업 중인 변경이 딸려 들어가지 않게 한다.
try {
  const message = `chore: 황금키워드 ${reportDate} 갱신 (${data.items.length}건)`;
  run(`git add -- ${REL_PATH}`);
  execSync(`git commit -m "${message}" -- ${REL_PATH}`, { cwd: ROOT, stdio: 'inherit' });

  const branch = run('git rev-parse --abbrev-ref HEAD');
  execSync(`git push origin ${branch}`, { cwd: ROOT, stdio: 'inherit' });

  console.log(`\n✅ [golden:publish] 배포 완료 (${branch})`);
  console.log('   사용자 앱들이 다음 실행 때 이 키워드를 받습니다.');
  console.log('   ⏱️  GitHub raw 캐시 때문에 최대 5분 정도 걸릴 수 있습니다.\n');
} catch (e) {
  fail(`커밋/푸시 실패: ${e.message}`);
}
