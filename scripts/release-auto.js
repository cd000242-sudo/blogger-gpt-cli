#!/usr/bin/env node
// scripts/release-auto.js — 한 줄 릴리스 자동화 (any Electron + electron-builder + gh CLI 프로젝트에 호환)
//
// 사용법:
//   npm run release:auto patch               # 패치 bump (3.6.1 → 3.6.2)
//   npm run release:auto minor               # 마이너 (3.6.1 → 3.7.0)
//   npm run release:auto major               # 메이저 (3.6.1 → 4.0.0)
//   npm run release:auto 3.7.5               # 명시 버전
//   npm run release:auto patch "수정 내용"   # 커밋 메시지 명시
//
// 자동 감지:
//   - git remote 'origin' 으로부터 owner/repo 추출
//   - package.json build.win.artifactName 으로부터 .exe 파일명 추출
//   - git config user.name / user.email 없으면 변수에서 fallback
//
// 전제 조건:
//   1) gh auth login (1회)
//   2) electron-builder + npm run build 동작 가능
//   3) 변경된 파일은 미리 git add + commit 해두기 (이 script는 package.json만 커밋)

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// ─── 인자 파싱 ───
const args = process.argv.slice(2);
const bumpOrVersion = args[0];
const customMsg = args.slice(1).join(' ').trim();

if (!bumpOrVersion) {
  console.error('사용: npm run release:auto <patch|minor|major|X.Y.Z> ["커밋 메시지"]');
  console.error('예시: npm run release:auto patch "버그 수정"');
  console.error('     npm run release:auto 3.7.0 "메이저 신기능"');
  process.exit(1);
}

// ─── package.json 로드 + 버전 계산 ───
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const oldVersion = pkg.version;
let newVersion;

if (/^\d+\.\d+\.\d+$/.test(bumpOrVersion)) {
  newVersion = bumpOrVersion;
} else if (['patch', 'minor', 'major'].includes(bumpOrVersion)) {
  const parts = oldVersion.split('.').map(Number);
  const maj = parts[0] || 0;
  const min = parts[1] || 0;
  const pat = parts[2] || 0;
  if (bumpOrVersion === 'patch') newVersion = `${maj}.${min}.${pat + 1}`;
  else if (bumpOrVersion === 'minor') newVersion = `${maj}.${min + 1}.0`;
  else newVersion = `${maj + 1}.0.0`;
} else {
  console.error(`❌ 잘못된 인자: ${bumpOrVersion}`);
  console.error('   patch / minor / major / X.Y.Z 형식만 허용');
  process.exit(1);
}

const tag = `v${newVersion}`;
const commitMsg = customMsg || `release: ${tag}`;

// ─── git remote에서 owner/repo 자동 감지 ───
let owner, repo;
try {
  const remoteUrl = execSync('git remote get-url origin', { cwd: ROOT }).toString().trim();
  const m = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!m) throw new Error(`git remote가 GitHub URL 형식이 아님: ${remoteUrl}`);
  owner = m[1];
  repo = m[2];
} catch (e) {
  console.error('❌ git remote "origin"에서 owner/repo 자동 감지 실패:', e.message);
  console.error('   git remote add origin https://github.com/<owner>/<repo>.git 먼저 설정 필요');
  process.exit(1);
}

// ─── .exe 파일 경로 — package.json build.win.artifactName 활용 ───
const artifactPattern = pkg.build?.win?.artifactName || `${pkg.build?.productName || pkg.name}-\${version}.\${ext}`;
const exeName = artifactPattern.replace('${version}', newVersion).replace('${ext}', 'exe').replace('${productName}', pkg.build?.productName || pkg.name);
const exePath = `release/${exeName}`;
const blockmapPath = `${exePath}.blockmap`;
const yamlPath = 'release/latest.yml';

// ─── git config user.name/email fallback ───
let gitUser = '';
try {
  const cfgName = execSync('git config user.name', { cwd: ROOT }).toString().trim();
  const cfgEmail = execSync('git config user.email', { cwd: ROOT }).toString().trim();
  if (!cfgName || !cfgEmail) throw new Error('git config 비어있음');
} catch {
  // git config 없으면 환경 변수 또는 마지막 commit author에서 추출
  let fbName = process.env.GIT_AUTHOR_NAME || '';
  let fbEmail = process.env.GIT_AUTHOR_EMAIL || '';
  if (!fbName || !fbEmail) {
    // v3.6.3 fix: 이전엔 --format=%an<%ae> 사용했으나 Windows shell이 '<'를 stdin redirect로 해석 → 실패
    //   해결: %an, %ae 각각 별도 호출 (한 줄이라 빠름)
    try {
      const n = execSync('git log -1 --format=%an', { cwd: ROOT }).toString().trim();
      const e = execSync('git log -1 --format=%ae', { cwd: ROOT }).toString().trim();
      if (n) fbName = fbName || n;
      if (e) fbEmail = fbEmail || e;
    } catch { /* ignore */ }
  }
  if (fbName && fbEmail) {
    gitUser = `-c user.name="${fbName}" -c user.email="${fbEmail}"`;
    console.log(`ℹ️ git config 없음 — fallback 사용: ${fbName} <${fbEmail}>`);
  } else {
    console.error('❌ git author 정보 없음. git config --global user.name/email 설정 필요');
    process.exit(1);
  }
}

console.log('═══════════════════════════════════════════');
console.log(`🚀 릴리스 시작: ${oldVersion} → ${newVersion}`);
console.log(`   레포: ${owner}/${repo}`);
console.log(`   .exe: ${exePath}`);
console.log(`   커밋: "${commitMsg}"`);
console.log('═══════════════════════════════════════════\n');

const run = (cmd) => {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch {
    console.error(`❌ 실패: ${cmd}`);
    process.exit(1);
  }
};

// ─── 1. 버전 bump ───
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json: ${oldVersion} → ${newVersion}`);

// ─── 2. 빌드 ───
run('npm run build');

// ─── 3. git commit + tag + push ───
const escapedMsg = commitMsg.replace(/"/g, '\\"');
run(`git add package.json`);
run(`git ${gitUser} commit -m "${escapedMsg}"`);
run(`git ${gitUser} tag -a ${tag} -m "${tag}"`);
run('git push origin HEAD');
run(`git push origin ${tag}`);

// ─── 4. electron-builder (.exe) ───
run('npx electron-builder --win');

// ─── 5. gh release create + upload ───
if (!fs.existsSync(path.join(ROOT, exePath))) {
  console.error(`❌ .exe 파일 없음: ${exePath}`);
  console.error('   release/ 폴더 안의 실제 파일명을 확인하고 package.json build.win.artifactName 형식 점검 필요');
  process.exit(1);
}
const repoArg = `--repo ${owner}/${repo}`;
const assets = [exePath, blockmapPath, yamlPath].filter(p => fs.existsSync(path.join(ROOT, p))).map(p => `"${p}"`).join(' ');
run(`gh release create ${tag} ${assets} ${repoArg} --title "${tag}" --notes "${escapedMsg}"`);

// ─── 6. Draft → Published + Latest ───
run(`gh release edit ${tag} ${repoArg} --draft=false --latest`);

console.log('\n═══════════════════════════════════════════');
console.log(`✅ ${tag} 릴리스 완료!`);
console.log(`   🔗 https://github.com/${owner}/${repo}/releases/tag/${tag}`);
console.log('═══════════════════════════════════════════');
