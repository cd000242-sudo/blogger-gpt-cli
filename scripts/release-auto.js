#!/usr/bin/env node
// scripts/release-auto.js — 한 줄 릴리스 자동화
//
// 사용법:
//   npm run release:auto patch                # 패치 버전 자동 bump (3.6.1 → 3.6.2)
//   npm run release:auto minor                # 마이너 (3.6.1 → 3.7.0)
//   npm run release:auto major                # 메이저 (3.6.1 → 4.0.0)
//   npm run release:auto 3.7.5                # 명시 버전
//   npm run release:auto patch "수정 내용"   # 커밋 메시지 명시
//
// 단계:
//   1. package.json 버전 bump
//   2. npm run build (TypeScript + UI 복사)
//   3. git add + commit + tag + push
//   4. electron-builder (.exe 서명 빌드)
//   5. gh release create + 업로드
//   6. gh release edit --latest (Draft → Published)

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const bumpOrVersion = args[0];
const customMsg = args.slice(1).join(' ').trim();

if (!bumpOrVersion) {
  console.error('사용: npm run release:auto <patch|minor|major|X.Y.Z> ["커밋 메시지"]');
  console.error('예시: npm run release:auto patch "버그 수정"');
  console.error('     npm run release:auto 3.7.0 "메이저 신기능"');
  process.exit(1);
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
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

console.log('═══════════════════════════════════════════');
console.log(`🚀 릴리스 시작: ${oldVersion} → ${newVersion}`);
console.log(`   커밋 메시지: "${commitMsg}"`);
console.log('═══════════════════════════════════════════\n');

const run = (cmd, opts = {}) => {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..'), ...opts });
  } catch (e) {
    console.error(`❌ 실패: ${cmd}`);
    process.exit(1);
  }
};

// 1. 버전 bump
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✅ package.json: ${oldVersion} → ${newVersion}`);

// 2. 빌드
run('npm run build');

// 3. git commit + tag + push
//    - git config(user.name/email)가 없으면 inline -c로 우회
const gitUser = '-c user.name="park" -c user.email="cd000242@gmail.com"';
run(`git add package.json`);
// 커밋 메시지에 따옴표 안전 escape
const escapedMsg = commitMsg.replace(/"/g, '\\"');
run(`git ${gitUser} commit -m "${escapedMsg}"`);
run(`git ${gitUser} tag -a ${tag} -m "${tag}"`);
run('git push origin master');
run(`git push origin ${tag}`);

// 4. electron-builder (.exe)
run('npx electron-builder --win');

// 5. gh release create + upload
const exePath = `release/LEADERNAM-Orbit-${newVersion}.exe`;
const blockmapPath = `${exePath}.blockmap`;
const yamlPath = 'release/latest.yml';

if (!fs.existsSync(path.resolve(__dirname, '..', exePath))) {
  console.error(`❌ .exe 파일 없음: ${exePath}`);
  process.exit(1);
}

const repoArg = '--repo cd000242-sudo/blogger-gpt-cli';
const escapedTitle = `${tag}`;
const escapedNotes = escapedMsg;
run(`gh release create ${tag} "${exePath}" "${blockmapPath}" "${yamlPath}" ${repoArg} --title "${escapedTitle}" --notes "${escapedNotes}"`);

// 6. Draft → Published + Latest
run(`gh release edit ${tag} ${repoArg} --draft=false --latest`);

console.log('\n═══════════════════════════════════════════');
console.log(`✅ ${tag} 릴리스 완료!`);
console.log(`   🔗 https://github.com/cd000242-sudo/blogger-gpt-cli/releases/tag/${tag}`);
console.log('═══════════════════════════════════════════');
