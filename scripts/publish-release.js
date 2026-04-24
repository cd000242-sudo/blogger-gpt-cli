#!/usr/bin/env node
/**
 * electron-builder가 생성한 Draft 릴리즈를 자동으로 Published(Latest)로 변환
 *
 * electron-builder는 기본적으로 GitHub Release를 Draft로 생성함.
 * Draft 상태는 electron-updater가 감지 못하므로, 이 스크립트가 빌드 후
 * 자동으로 draft=false + latest=true로 변경한다.
 *
 * 사용: npm run release 가 이 스크립트를 빌드 후 자동 실행
 * 필수: gh CLI 로그인 + GH_TOKEN 환경변수
 */

const { execSync } = require('child_process');
const pkg = require('../package.json');

const version = pkg.version;
const tag = `v${version}`;
const publishCfg = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish;
const owner = publishCfg?.owner || 'cd000242-sudo';
const repo = publishCfg?.repo || 'blogger-gpt-cli';

console.log(`\n🚀 [publish-release] ${tag} 릴리즈 공개 처리 중...`);

try {
  // 릴리즈 존재 여부 + draft 상태 확인
  const info = execSync(
    `gh release view ${tag} --repo ${owner}/${repo} --json isDraft`,
    { encoding: 'utf8' }
  );
  const { isDraft } = JSON.parse(info);

  // 항상 draft=false + latest=true로 설정 (멱등)
  execSync(
    `gh release edit ${tag} --repo ${owner}/${repo} --draft=false --latest`,
    { stdio: 'inherit' }
  );
  console.log(`✅ [publish-release] ${tag} → Latest로 공개 완료! ${isDraft ? '(Draft에서 Published로 전환)' : '(이미 Published, Latest 재확인)'}`);

  // 🔧 자동 수정 런처(FIX-AUTO-UPDATE.bat) 동봉 — 단일 파일에 PowerShell 스크립트 포함
  const path = require('path');
  const fs = require('fs');
  const fixFiles = ['FIX-AUTO-UPDATE.bat'];
  const releaseDir = path.join(__dirname, '..', 'release');
  const existingFiles = fixFiles
    .map(f => path.join(releaseDir, f))
    .filter(p => fs.existsSync(p));
  if (existingFiles.length > 0) {
    try {
      const quoted = existingFiles.map(p => `"${p}"`).join(' ');
      execSync(
        `gh release upload ${tag} ${quoted} --repo ${owner}/${repo} --clobber`,
        { stdio: 'inherit' }
      );
      console.log(`✅ [publish-release] 자동 수정 런처 ${existingFiles.length}개 동봉 완료`);
    } catch (fixErr) {
      console.warn(`⚠️ [publish-release] 자동 수정 런처 업로드 실패 (무시): ${fixErr.message}`);
    }
  }

  console.log(`🔗 https://github.com/${owner}/${repo}/releases/tag/${tag}`);
} catch (err) {
  console.error(`❌ [publish-release] 실패: ${err.message}`);
  console.error(`   수동 해결: gh release edit ${tag} --repo ${owner}/${repo} --draft=false --latest`);
  process.exit(1);
}
