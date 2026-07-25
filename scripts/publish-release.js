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
  let releaseExists = true;
  let isDraft = false;
  try {
    const info = execSync(
      `gh release view ${tag} --repo ${owner}/${repo} --json isDraft`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    isDraft = JSON.parse(info).isDraft;
  } catch (viewErr) {
    // v3.8.364: release가 존재하지 않는 경우 (GH_TOKEN 없이 electron-builder --publish 실패)
    //   → gh CLI로 직접 release 생성 (gh는 별도 auth 필요 없음, 이미 로그인된 상태 사용)
    releaseExists = false;
    console.log(`⚠️ [publish-release] ${tag} release가 존재하지 않음. gh CLI로 직접 생성 시도...`);
    const path = require('path');
    const fs = require('fs');
    const releaseDir = path.join(__dirname, '..', 'release');
    const requiredFiles = [
      `LEADERNAM-Orbit-${version}.exe`,
      `LEADERNAM-Orbit-${version}.exe.blockmap`,
      'latest.yml',
    ];
    const uploadFiles = requiredFiles
      .map(f => path.join(releaseDir, f))
      .filter(p => fs.existsSync(p));
    if (uploadFiles.length < 3) {
      throw new Error(`release 파일 부족: ${uploadFiles.length}/3 (재빌드 필요: npm run build && electron-builder --win)`);
    }
    const filesArg = uploadFiles.map(p => `"${p}"`).join(' ');
    execSync(
      `gh release create ${tag} ${filesArg} --repo ${owner}/${repo} --title "${version}" --notes "v${version} 자동 업로드 (GH_TOKEN 없이 gh CLI fallback)"`,
      { stdio: 'inherit' }
    );
    console.log(`✅ [publish-release] ${tag} gh CLI로 릴리스 생성 완료 (3개 파일 업로드)`);
  }

  // 항상 draft=false + latest=true로 설정 (멱등)
  execSync(
    `gh release edit ${tag} --repo ${owner}/${repo} --draft=false --latest`,
    { stdio: 'inherit' }
  );
  console.log(`✅ [publish-release] ${tag} → Latest로 공개 완료! ${!releaseExists ? '(gh CLI 신규 생성)' : isDraft ? '(Draft에서 Published로 전환)' : '(이미 Published, Latest 재확인)'}`);

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
